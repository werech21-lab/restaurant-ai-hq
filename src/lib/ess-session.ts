import { SignJWT, jwtVerify } from 'jose'
import { getSecret } from '@/lib/session'

export const ESS_COOKIE = 'ess_employee_session'

export const essCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 12,
}

export async function signEssToken(employeeId: string, code: string) {
  return new SignJWT({ role: 'ess', code })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(employeeId)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(getSecret())
}

export async function verifyEssToken(token: string): Promise<{ employeeId: string; code: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.role !== 'ess' || !payload.sub) return null
    return { employeeId: String(payload.sub), code: String(payload.code || '') }
  } catch {
    return null
  }
}
