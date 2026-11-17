"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  extractClientIp,
  loginAccountFailureLimiter,
  loginIpFailureLimiter,
} from "@/lib/auth/api-guard";
import {
  authenticateExecutiveCredentials,
  createExecSessionToken,
  EXEC_SESSION_COOKIE,
  execCookieOptions,
  sanitizeExecNextPath,
} from "@/lib/auth/exec-session";
import { resolvePostLoginRedirectForRole } from "@/lib/auth/role-access-policy";
import { firstAllowedHref, type AccessUser } from "@/lib/permissions";
import { SESSION_COOKIE, sessionCookieOptions, signSessionToken } from "@/lib/session";

export async function login(
  previousOrForm: { error: string } | null | FormData,
  maybeForm?: FormData,
): Promise<{ error: string } | null> {
  const formData = previousOrForm instanceof FormData ? previousOrForm : maybeForm;
  if (!formData) return { error: "تعذر قراءة بيانات الدخول" };

  const hdrs = await headers();
  const clientIp = extractClientIp({ headers: hdrs });
  const isSecure =
    (hdrs.get("x-forwarded-proto") || "").includes("https") ||
    process.env.NODE_ENV === "production";

  const rateLimited = {
    error: "تم تجاوز الحد المسموح للمحاولات — يرجى الانتظار قليلاً ثم المحاولة مجدداً.",
  };

  const ipKey = `ip:${clientIp}`;
  if (loginIpFailureLimiter.peekBlocked(ipKey).blocked) {
    return rateLimited;
  }

  const email = String(formData.get("email") || "").trim().toLowerCase().slice(0, 160);
  const password = String(formData.get("password") || "").trim().slice(0, 256);
  const rawNext = String(formData.get("next") || "").trim();
  const nextPath = sanitizeExecNextPath(rawNext, "/erp");
  const accountKey = `acct:${clientIp}:${email || "anonymous"}`;
  if (loginAccountFailureLimiter.peekBlocked(accountKey).blocked) {
    return rateLimited;
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
    jar.set(
      EXEC_SESSION_COOKIE,
      execToken,
      execCookieOptions(process.env.NODE_ENV === "production"),
    );
    redirect(resolvePostLoginRedirectForRole(execMatch.role, rawNext ? nextPath : ""));
  }

  if (password.length < 8 || email === "admin@aetherbi.com") {
    loginIpFailureLimiter.check(ipKey);
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
      loginIpFailureLimiter.check(ipKey);
      loginAccountFailureLimiter.check(accountKey);
      return invalid;
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      loginIpFailureLimiter.check(ipKey);
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
    loginIpFailureLimiter.check(ipKey);
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
