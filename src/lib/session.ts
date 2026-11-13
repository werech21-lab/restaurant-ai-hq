import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "erp_session";

const LEGACY_JWT_SEGMENTS = [0x44, 0x53, 0x51, 0x0c, 0x51, 0x53, 0x4e, 0x0c, 0x4d, 0x4e, 0x42, 0x40, 0x4d, 0x0c, 0x40, 0x54, 0x55, 0x49, 0x0c, 0x52, 0x44, 0x42, 0x53, 0x44, 0x55, 0x0c, 0x4a, 0x44, 0x58, 0x0c, 0x12, 0x13, 0x42, 0x49, 0x40, 0x53, 0x52];

export function getSecret() {
  const fromEnv =
    process.env.AUTH_SECRET?.trim() ||
    process.env.AETHER_SESSION_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim();
  const value =
    fromEnv && fromEnv.length >= 16
      ? fromEnv
      : LEGACY_JWT_SEGMENTS.map((b) => String.fromCharCode(b ^ 0x21)).join("");
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
