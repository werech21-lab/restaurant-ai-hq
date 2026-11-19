import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  DEFAULT_ADMIN_EMAIL,
  EXEC_SESSION_COOKIE,
  resolveExecRoleProfile,
  verifyExecSessionToken,
  type ExecSessionRole,
} from "@/lib/auth/exec-session";
import { isValidExecRole } from "@/lib/auth/exec-role-meta";
import { resolveAccessRole } from "@/lib/auth/role-source";
import { resolveSupabaseExecAccess } from "@/lib/auth/supabase-access";
import { can, type AccessUser, type PermissionAction } from "@/lib/permissions";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export type ErpAuthenticatedUser = AccessUser & {
  sessionRole?: ExecSessionRole;
  isAuditor?: boolean;
  titleAr?: string;
  titleEn?: string;
  nameAr?: string;
  nameEn?: string;
};

function buildNamedExecutiveUser(
  role: ExecSessionRole,
  email = DEFAULT_ADMIN_EMAIL,
): ErpAuthenticatedUser {
  const profile = resolveExecRoleProfile(role);
  const roleIdMap: Record<ExecSessionRole, string> = {
    admin: "role_system_admin",
    gm: "role_general_manager",
    dgm: "role_deputy_gm",
    ops: "role_operations_manager",
    cfo: "role_finance_cfo",
    marketing: "role_marketing_lead",
    supply: "role_supply_manager",
    auditor: "role_auditor_readonly",
  };
  const userIdMap: Record<ExecSessionRole, string> = {
    admin: "usr_venture_admin_001",
    gm: "usr_venture_gm_001",
    dgm: "usr_venture_dgm_001",
    ops: "usr_venture_ops_001",
    cfo: "usr_venture_cfo_001",
    marketing: "usr_venture_marketing_001",
    supply: "usr_venture_supply_001",
    auditor: "usr_venture_auditor_001",
  };

  const auditorReadOnlyPermissions = [
    { module: "accounting", canView: true, canCreate: false, canEdit: false, canDelete: false },
    { module: "reports", canView: true, canCreate: false, canEdit: false, canDelete: false },
  ];

  return {
    id: userIdMap[profile.role],
    name: profile.role === "auditor" ? profile.titleAr : profile.nameAr,
    email: email || DEFAULT_ADMIN_EMAIL,
    sessionRole: profile.role,
    isAuditor: profile.isAuditor,
    titleAr: profile.titleAr,
    titleEn: profile.titleEn,
    nameAr: profile.nameAr,
    nameEn: profile.nameEn,
    role: {
      id: roleIdMap[profile.role],
      name: profile.titleEn,
      isAdmin: profile.role !== "auditor" && profile.role !== "marketing" && profile.role !== "supply",
      permissions: profile.role === "auditor" ? auditorReadOnlyPermissions : [],
    },
  };
}

export const getCurrentSessionRole = cache(
  async (): Promise<ExecSessionRole | null> => {
    try {
      const jar = await cookies();
      const execToken = jar.get(EXEC_SESSION_COOKIE)?.value;
      const execSession = await verifyExecSessionToken(execToken);
      if (execSession) return execSession.role;
      const access = await resolveSupabaseExecAccess();
      if (access.status === "allowed") return access.role;
      if (access.status === "rejected") return null;
      const legacy = await verifySessionToken(jar.get(SESSION_COOKIE)?.value ?? "");
      return legacy?.role ?? null;
    } catch {
      return null;
    }
  },
);

export const getCurrentUser = cache(
  async (): Promise<ErpAuthenticatedUser | null> => {
    try {
      const jar = await cookies();
      const execToken = jar.get(EXEC_SESSION_COOKIE)?.value;
      const execSession = await verifyExecSessionToken(execToken);
      if (execSession) {
        return buildNamedExecutiveUser(execSession.role, execSession.sub);
      }

      const supabaseAccess = await resolveSupabaseExecAccess();
      if (supabaseAccess.status === "allowed") {
        return buildNamedExecutiveUser(
          supabaseAccess.role,
          supabaseAccess.email || DEFAULT_ADMIN_EMAIL,
        );
      }
      if (supabaseAccess.status === "rejected") return null;

      const token = jar.get(SESSION_COOKIE)?.value;
      if (!token) return null;
      const legacy = await verifySessionToken(token);
      if (!legacy) return null;

      const user = await prisma.user.findUnique({
        where: { id: legacy.userId },
        include: { role: { include: { permissions: true } } },
      });
      if (!user || !user.isActive) return null;
      const allowed = resolveAccessRole({
        email: user.email,
        roleName: user.role.name,
        isAdmin: user.role.isAdmin,
      });
      if (!allowed || allowed !== legacy.role || !isValidExecRole(legacy.role)) return null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        sessionRole: legacy.role,
        isAuditor: legacy.role === "auditor",
        role: {
          id: user.role.id,
          name: user.role.name,
          isAdmin: user.role.isAdmin,
          permissions: user.role.permissions.map((permission) => ({
            module: permission.module,
            canView: permission.canView,
            canCreate: permission.canCreate,
            canEdit: permission.canEdit,
            canDelete: permission.canDelete,
          })),
        },
      };
    } catch {
      return null;
    }
  },
);

export async function requireUser(): Promise<ErpAuthenticatedUser> {
  const user = await getCurrentUser();
  if (user?.sessionRole && isValidExecRole(user.sessionRole)) return user;
  const access = await resolveSupabaseExecAccess();
  if (access.status === "rejected") redirect("/login?reason=no_access");
  try {
    const jar = await cookies();
    if (jar.get(SESSION_COOKIE)?.value) redirect("/login?reason=no_access");
  } catch (err) {
    if (isNextRedirect(err)) throw err;
  }
  redirect("/login");
}

function isNextRedirect(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "digest" in err &&
      String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT"),
  );
}

export async function checkPermission(module: string, action: PermissionAction) {
  const user = await getCurrentUser();
  if (!user) {
    return { allowed: false as const, user: null, message: "انتهت الجلسة، أعد تسجيل الدخول" };
  }
  if (user.isAuditor && action !== "view") {
    return {
      allowed: false as const,
      user,
      message: "حساب مراجعة للقراءة فقط — التعديل والاعتماد غير متاحين.",
    };
  }
  if (!can(user, module, action)) {
    return { allowed: false as const, user, message: "ليست لديك صلاحية لهذا الإجراء" };
  }
  return { allowed: true as const, user, message: null };
}

export async function guard(module: string, action: PermissionAction) {
  const result = await checkPermission(module, action);
  return { user: result.allowed ? result.user : null, message: result.message };
}

export async function guardAny(modules: string[]) {
  const user = await getCurrentUser();
  if (!user) return { user: null };
  const allowed = modules.some(
    (module) => can(user, module, "view") || can(user, module, "create"),
  );
  return { user: allowed ? user : null };
}
