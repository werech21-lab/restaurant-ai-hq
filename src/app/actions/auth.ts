"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  createExecSessionToken,
  EXEC_SESSION_COOKIE,
  execCookieOptions,
  sanitizeExecNextPath,
  verifyExecutiveCredentials,
} from "@/lib/auth/exec-session";
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
  const nextPath = sanitizeExecNextPath(String(formData.get("next") || ""), "/erp");
  const invalid = {
    error: "بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.",
  };

  if (!email || !password) return invalid;

  const isExecValid = await verifyExecutiveCredentials(email, password);
  if (isExecValid) {
    const execToken = await createExecSessionToken(email);
    const jar = await cookies();
    jar.set(EXEC_SESSION_COOKIE, execToken, execCookieOptions());
    redirect(nextPath);
  }

  if (password.length < 8 || email === "admin@aetherbi.com") {
    return invalid;
  }

  let destination: string | null = null;
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: { include: { permissions: true } } },
    });
    if (!user || !user.isActive) return invalid;
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) return invalid;

    const [legacyToken, execToken, jar] = await Promise.all([
      signSessionToken(user.id),
      createExecSessionToken(user.email),
      cookies(),
    ]);
    jar.set(SESSION_COOKIE, legacyToken, sessionCookieOptions);
    jar.set(EXEC_SESSION_COOKIE, execToken, execCookieOptions());

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
    destination = firstAllowedHref(access) || "/erp";
  } catch {
    return invalid;
  }

  redirect(destination);
}

export async function logout() {
  const jar = await cookies();
  jar.set(EXEC_SESSION_COOKIE, "", { ...execCookieOptions(), maxAge: 0, path: "/" });
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0, path: "/" });
  redirect("/login");
}
