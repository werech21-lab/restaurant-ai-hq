"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loginAccountFailureLimiter, loginIpAttemptLimiter } from "@/lib/auth/api-guard";
import {
  authenticateExecutiveCredentials,
  createExecSessionToken,
  EXEC_SESSION_COOKIE,
  execCookieOptions,
  sanitizeExecNextPath,
} from "@/lib/auth/exec-session";
import { firstAllowedHref, type AccessUser } from "@/lib/permissions";
import { SESSION_COOKIE, sessionCookieOptions, signSessionToken } from "@/lib/session";

export async function login(
  previousOrForm: { error: string } | null | FormData,
  maybeForm?: FormData,
): Promise<{ error: string } | null> {
  const formData = previousOrForm instanceof FormData ? previousOrForm : maybeForm;
  if (!formData) return { error: "تعذر قراءة بيانات الدخول" };

  const hdrs = await headers();
  const clientIp =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip")?.trim() ||
    "local";
  const isSecure =
    (hdrs.get("x-forwarded-proto") || "").includes("https") ||
    process.env.NODE_ENV === "production";

  const ipDecision = loginIpAttemptLimiter.check(`ip:${clientIp}`);
  if (!ipDecision.allowed) {
    return { error: "تم تجاوز الحد المسموح للمحاولات — يرجى الانتظار قليلاً ثم المحاولة مجدداً." };
  }

  const email = String(formData.get("email") || "").trim().toLowerCase().slice(0, 160);
  const password = String(formData.get("password") || "").slice(0, 256);
  const nextPath = sanitizeExecNextPath(String(formData.get("next") || ""), "/erp");
  const accountKey = `acct:${clientIp}:${email || "anonymous"}`;
  if (loginAccountFailureLimiter.peekBlocked(accountKey).blocked) {
    return { error: "تم تجاوز الحد المسموح للمحاولات — يرجى الانتظار قليلاً ثم المحاولة مجدداً." };
  }

  const invalid = {
    error: "بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.",
  };

  if (!email || !password) return invalid;

  const execMatch = await authenticateExecutiveCredentials(email, password);
  if (execMatch.valid) {
    loginAccountFailureLimiter.reset(accountKey);
    const execToken = await createExecSessionToken(execMatch.email, execMatch.role);
    const jar = await cookies();
    jar.set(EXEC_SESSION_COOKIE, execToken, execCookieOptions(isSecure));
    redirect(nextPath);
  }

  if (password.length < 8 || email === "admin@aetherbi.com") {
    loginAccountFailureLimiter.check(accountKey);
    return invalid;
  }

  let destination: string | null = null;
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: { include: { permissions: true } } },
    });
    if (!user || !user.isActive) {
      loginAccountFailureLimiter.check(accountKey);
      return invalid;
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      loginAccountFailureLimiter.check(accountKey);
      return invalid;
    }

    loginAccountFailureLimiter.reset(accountKey);
    const resolvedRole = user.email.toLowerCase().includes("auditor") ? "auditor" : "admin";
    const [legacyToken, execToken, jar] = await Promise.all([
      resolvedRole === "auditor" ? Promise.resolve("") : signSessionToken(user.id),
      createExecSessionToken(user.email, resolvedRole),
      cookies(),
    ]);
    if (legacyToken) {
      jar.set(SESSION_COOKIE, legacyToken, { ...sessionCookieOptions, secure: isSecure });
    }
    jar.set(EXEC_SESSION_COOKIE, execToken, execCookieOptions(isSecure));

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
    loginAccountFailureLimiter.check(accountKey);
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
