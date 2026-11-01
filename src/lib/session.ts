import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "erp_session";

export function getSecret() {
  const value = process.env.AUTH_SECRET || "erp-pro-local-auth-secret-key-32chars";
  return new TextEncoder().encode(value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export async function signSessionToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}
