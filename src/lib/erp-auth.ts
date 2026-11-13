import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_AUDITOR_EMAIL,
  EXEC_SESSION_COOKIE,
  verifyExecSessionToken,
  type ExecSessionRole,
} from "@/lib/auth/exec-session";
import { can, type AccessUser, type PermissionAction } from "@/lib/permissions";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export type ErpAuthenticatedUser = AccessUser & {
  sessionRole?: ExecSessionRole;
  isAuditor?: boolean;
};

function buildExecutiveAdminUser(
  email = DEFAULT_ADMIN_EMAIL,
): ErpAuthenticatedUser {
  return {
    id: "usr_venture_exec_001",
    name: "الإدارة التنفيذية · فنتشر فودز",
    email: email || DEFAULT_ADMIN_EMAIL,
    sessionRole: "executive",
    isAuditor: false,
    role: {
      id: "role_executive_admin",
      name: "Executive Admin",
      isAdmin: true,
      permissions: [],
    },
  };
}

function buildReadOnlyAuditorUser(
  email = DEFAULT_AUDITOR_EMAIL,
): ErpAuthenticatedUser {
  return {
    id: "usr_venture_auditor_001",
    name: "حساب مراجعة — قراءة فقط",
    email: email || DEFAULT_AUDITOR_EMAIL,
    sessionRole: "auditor",
    isAuditor: true,
    role: {
      id: "role_auditor_readonly",
      name: "Read-Only Auditor",
      isAdmin: true,
      permissions: [],
    },
  };
}

export const getCurrentSessionRole = cache(
  async (): Promise<ExecSessionRole> => {
    try {
      const jar = await cookies();
      const execToken = jar.get(EXEC_SESSION_COOKIE)?.value;
      const execSession = await verifyExecSessionToken(execToken);
      return execSession?.role === "auditor" ? "auditor" : "executive";
    } catch {
      return "executive";
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
        if (execSession.role === "auditor") {
          return buildReadOnlyAuditorUser(execSession.sub);
        }
        return buildExecutiveAdminUser(execSession.sub);
      }

      const token = jar.get(SESSION_COOKIE)?.value;
      if (!token) return null;
      const userId = await verifySessionToken(token);
      if (!userId) return null;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: { include: { permissions: true } } },
      });
      if (!user || !user.isActive) return null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        sessionRole: "executive",
        isAuditor: false,
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
  if (!user) {
    redirect("/login");
  }
  return user;
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
