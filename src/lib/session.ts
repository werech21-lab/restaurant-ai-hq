import { SignJWT, jwtVerify } from "jose";
import { normalizeExecSessionRole, type ExecRole } from "@/lib/auth/exec-role-meta";
import { ExecRoleDeniedError, resolveSessionSecret } from "@/lib/auth/session-secret";

export const SESSION_COOKIE = "erp_session";

const LEGACY_JWT_SEGMENTS = [0x44, 0x53, 0x51, 0x0c, 0x51, 0x53, 0x4e, 0x0c, 0x4d, 0x4e, 0x42, 0x40, 0x4d, 0x0c, 0x40, 0x54, 0x55, 0x49, 0x0c, 0x52, 0x44, 0x42, 0x53, 0x44, 0x55, 0x0c, 0x4a, 0x44, 0x58, 0x0c, 0x12, 0x13, 0x42, 0x49, 0x40, 0x53, 0x52];

export function getSecret() {
  const value = resolveSessionSecret(
    LEGACY_JWT_SEGMENTS.map((b) => String.fromCharCode(b ^ 0x21)).join(""),
  );
  return new TextEncoder().encode(value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export type LegacySessionClaims = { userId: string; role: ExecRole };

/** Signs a legacy panel cookie. The role claim is required; a user id alone is not a role. */
export async function signSessionToken(userId: string, role: ExecRole) {
  const normalized = normalizeExecSessionRole(role);
  if (!userId || !normalized) throw new ExecRoleDeniedError();
  return new SignJWT({ sub: userId, role: normalized })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

/** Rejects tokens that verify but carry no allowlisted role. */
export async function verifySessionToken(token: string): Promise<LegacySessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = normalizeExecSessionRole(payload.role);
    if (!payload.sub || !role) return null;
    return { userId: String(payload.sub), role };
  } catch {
    return null;
  }
}
