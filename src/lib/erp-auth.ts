import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, type AccessUser, type PermissionAction } from "@/lib/permissions";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export const getCurrentUser = cache(async (): Promise<AccessUser | null> => {
  const jar = await cookies();
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
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/session-end");
  return user;
}

export async function checkPermission(module: string, action: PermissionAction) {
  const user = await getCurrentUser();
  if (!user) {
    return { allowed: false as const, user: null, message: "انتهت الجلسة، أعد تسجيل الدخول" };
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
