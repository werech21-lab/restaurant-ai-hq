"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { firstAllowedHref, type AccessUser } from "@/lib/permissions";
import { SESSION_COOKIE, sessionCookieOptions, signSessionToken } from "@/lib/session";

export async function login(
  previousOrForm: { error: string } | null | FormData,
  maybeForm?: FormData,
): Promise<{ error: string } | null> {
  const formData = previousOrForm instanceof FormData ? previousOrForm : maybeForm;
  if (!formData) return { error: "تعذر قراءة بيانات الدخول" };
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: { include: { permissions: true } } },
  });
  const invalid = { error: "بيانات الدخول غير صحيحة أو الحساب موقوف" };
  if (!user || !user.isActive) return invalid;
  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) return invalid;

  const token = await signSessionToken(user.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions);

  const access: AccessUser = {
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
  redirect(firstAllowedHref(access));
}

export async function logout() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  redirect("/login");
}
