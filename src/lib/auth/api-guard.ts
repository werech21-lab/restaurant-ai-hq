/**
 * Enterprise API Security Guard, Sliding-Window Brute-Force Rate Limiter,
 * Constant-Time Digest Verifier & Unified HTTP Security Headers.
 */

import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import {
  EXEC_SESSION_COOKIE,
  resolveExecRoleProfile,
  verifyExecSessionToken,
  type ExecSessionPayload,
} from '@/lib/auth/exec-session'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

export const ENTERPRISE_PERMISSIONS_POLICY =
  'camera=(self), microphone=(self), geolocation=()'

export const ENTERPRISE_API_SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': ENTERPRISE_PERMISSIONS_POLICY,
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
}

/**
 * Constant-time SHA-256 hex digest comparison backed by Node `crypto.timingSafeEqual`.
 */
export function constantTimeHexEqual(aHex: string, bHex: string): boolean {
  const aBuf = createHash('sha256').update(aHex.toLowerCase()).digest()
  const bBuf = createHash('sha256').update(bHex.toLowerCase()).digest()
  const lenOk = aHex.length === bHex.length && aHex.length > 0
  return timingSafeEqual(aBuf, bBuf) && lenOk
}

/**
 * Sliding-window in-memory rate limiter for login, PIN, and AI proxy endpoints.
 */
export class SlidingWindowLimiter {
  private readonly buckets = new Map<string, number[]>()
  private calls = 0

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  check(
    key: string,
    now = Date.now(),
  ): { allowed: true; remaining: number } | { allowed: false; retryAfterSeconds: number } {
    this.calls += 1
    if (this.calls >= 250) {
      this.calls = 0
      this.sweep(now)
    }

    const cutoff = now - this.windowMs
    const history = (this.buckets.get(key) ?? []).filter((ts) => ts > cutoff)

    if (history.length >= this.maxRequests) {
      this.buckets.set(key, history)
      const oldest = history[0] ?? now
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000))
      return { allowed: false, retryAfterSeconds }
    }

    history.push(now)
    this.buckets.set(key, history)
    return { allowed: true, remaining: Math.max(0, this.maxRequests - history.length) }
  }

  peekBlocked(
    key: string,
    now = Date.now(),
  ): { blocked: false } | { blocked: true; retryAfterSeconds: number } {
    const cutoff = now - this.windowMs
    const history = (this.buckets.get(key) ?? []).filter((ts) => ts > cutoff)
    if (history.length === 0) {
      this.buckets.delete(key)
      return { blocked: false }
    }
    this.buckets.set(key, history)
    if (history.length >= this.maxRequests) {
      const oldest = history[0] ?? now
      return {
        blocked: true,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000)),
      }
    }
    return { blocked: false }
  }

  reset(key: string): void {
    this.buckets.delete(key)
  }

  clearAll(): void {
    this.buckets.clear()
  }

  private sweep(now: number): void {
    const cutoff = now - this.windowMs
    for (const [k, list] of this.buckets.entries()) {
      const kept = list.filter((ts) => ts > cutoff)
      if (kept.length === 0) this.buckets.delete(k)
      else this.buckets.set(k, kept)
    }
  }
}

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000
const ONE_MINUTE_MS = 60 * 1000

/** Max 8 failed login attempts per (IP + email) within 15 minutes, and 20 total attempts per IP within 15 minutes. */
export const loginAccountFailureLimiter = new SlidingWindowLimiter(8, FIFTEEN_MINUTES_MS)
export const loginIpAttemptLimiter = new SlidingWindowLimiter(20, FIFTEEN_MINUTES_MS)

/** Max 5 failed Manager PIN attempts per (IP + session sub) within 15 minutes. */
export const managerPinFailureLimiter = new SlidingWindowLimiter(5, FIFTEEN_MINUTES_MS)

/** Max 60 AI / Vision / Voice requests per minute per authenticated executive session. */
export const executiveAiBurstLimiter = new SlidingWindowLimiter(60, ONE_MINUTE_MS)

export function extractClientIp(request?: NextRequest | Request | null): string {
  if (!request) return 'local'
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first.slice(0, 64)
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp.slice(0, 64)
  return 'local'
}

export function buildRateLimitedJsonResponse(
  retryAfterSeconds: number,
  messageEn = 'Too many attempts. Please wait before trying again.',
  messageAr = 'تم تجاوز الحد المسموح للمحاولات — يرجى الانتظار قليلاً ثم المحاولة مجدداً.',
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: messageEn,
      errorAr: messageAr,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        ...ENTERPRISE_API_SECURITY_HEADERS,
        'Retry-After': String(retryAfterSeconds),
      },
    },
  )
}

export interface ExecApiGuardSuccess {
  ok: true
  session: ExecSessionPayload
}

export interface ExecApiGuardFailure {
  ok: false
  response: NextResponse
}

/**
 * Verifies server-side `aether_exec_session` (or legacy `erp_session` fallback) and enforces RBAC:
 * - Returns `401 Unauthorized` when missing, expired, or tampered.
 * - Returns `403 Forbidden` when `allowAuditor === false` and `session.role === 'auditor'`.
 */
export async function requireExecApiSession(
  request: NextRequest,
  options: { allowAuditor?: boolean } = {},
): Promise<ExecApiGuardSuccess | ExecApiGuardFailure> {
  const allowAuditor = options.allowAuditor ?? false

  const rawExecToken =
    request.cookies.get(EXEC_SESSION_COOKIE)?.value ??
    request.cookies.get('aether_exec_session')?.value

  let resolvedSession = await verifyExecSessionToken(rawExecToken)

  if (!resolvedSession) {
    const legacyJwt = request.cookies.get(SESSION_COOKIE)?.value
    const legacyUserId = legacyJwt ? await verifySessionToken(legacyJwt) : null
    if (legacyUserId) {
      const profile = resolveExecRoleProfile('admin')
      resolvedSession = {
        sub: legacyUserId,
        role: 'admin',
        nameAr: profile.nameAr,
        nameEn: profile.nameEn,
        titleAr: profile.titleAr,
        titleEn: profile.titleEn,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }
    }
  }

  if (!resolvedSession) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: 'Authentication required',
          errorAr: 'يرجى تسجيل الدخول للمتابعة.',
        },
        { status: 401, headers: ENTERPRISE_API_SECURITY_HEADERS },
      ),
    }
  }

  if (!allowAuditor && resolvedSession.role === 'auditor') {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: 'Read-only auditor session',
          errorAr: 'حساب مراجعة للقراءة فقط — التعديل والاعتماد غير متاحين.',
        },
        { status: 403, headers: ENTERPRISE_API_SECURITY_HEADERS },
      ),
    }
  }

  return { ok: true, session: resolvedSession }
}

/**
 * Strictly requires `role === 'admin'` (`401` if unauthenticated, `403` for `gm`, `dgm`, `ops`, `cfo`, `auditor`).
 */
export async function requireAdminOnlyApiSession(
  request: NextRequest,
): Promise<ExecApiGuardSuccess | ExecApiGuardFailure> {
  const guard = await requireExecApiSession(request, { allowAuditor: true })
  if (!guard.ok) return guard

  if (guard.session.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: 'forbidden_admin_only',
          message: 'System Administrator privileges are required for POS terminal mapping.',
          errorAr: 'هذه الصلاحية محصورة بمسؤول النظام فقط.',
        },
        { status: 403, headers: ENTERPRISE_API_SECURITY_HEADERS },
      ),
    }
  }

  return guard
}
