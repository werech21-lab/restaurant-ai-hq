import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn(async () => null) }))
vi.mock('@/lib/db', () => ({
  prisma: { user: { findUnique } },
}))

import { POST } from '@/app/api/auth/login/route'
import { resolveLoginErrorMessage } from '@/app/login/login-error-message'
import {
  loginAccountFailureLimiter,
  loginIpAttemptLimiter,
  loginIpFailureLimiter,
} from '@/lib/auth/api-guard'
import {
  EXEC_SESSION_COOKIE,
  DEFAULT_MARKETING_PASSWORD_SHA256,
  verifyExecSessionToken,
} from '@/lib/auth/exec-session'
import { isErpRouteAllowedForRole, resolvePostLoginRedirectForRole } from '@/lib/auth/role-access-policy'

// Test-only password injected through the AETHER_*_PASSWORD env override (real defaults are hashed in exec-session).
const TEMP_PASSWORD = 'test-exec-login-pass'

const ACCOUNTS: ReadonlyArray<{ email: string; role: string }> = [
  { email: 'abdullah@venturefoodskw.com', role: 'admin' },
  { email: 'admin@venturefoodskw.com', role: 'admin' },
  { email: 'gm@venturefoodskw.com', role: 'gm' },
  { email: 'dgm@venturefoodskw.com', role: 'dgm' },
  { email: 'operations@venturefoodskw.com', role: 'ops' },
  { email: 'cfo@venturefoodskw.com', role: 'cfo' },
  { email: 'finance@venturefoodskw.com', role: 'cfo' },
  { email: 'marketing@venturefoodskw.com', role: 'marketing' },
  { email: 'mkt@venturefoodskw.com', role: 'marketing' },
  { email: 'supply@venturefoodskw.com', role: 'supply' },
  { email: 'kitchen@venturefoodskw.com', role: 'supply' },
  { email: 'auditor@venturefoodskw.com', role: 'auditor' },
]

const ENV_PASSWORD_KEYS = [
  'AETHER_ABDULLAH_PASSWORD',
  'AETHER_ADMIN_PASSWORD',
  'AETHER_GM_PASSWORD',
  'AETHER_DGM_PASSWORD',
  'AETHER_OPS_PASSWORD',
  'AETHER_CFO_PASSWORD',
  'AETHER_MARKETING_PASSWORD',
  'AETHER_SUPPLY_PASSWORD',
  'AETHER_AUDITOR_PASSWORD',
]

const ENV_EMAIL_KEYS = [
  'AETHER_ABDULLAH_EMAIL',
  'AETHER_ADMIN_EMAIL',
  'AETHER_GM_EMAIL',
  'AETHER_DGM_EMAIL',
  'AETHER_OPS_EMAIL',
  'AETHER_CFO_EMAIL',
  'AETHER_FINANCE_EMAIL',
  'AETHER_MARKETING_EMAIL',
  'AETHER_MKT_EMAIL',
  'AETHER_SUPPLY_EMAIL',
  'AETHER_KITCHEN_EMAIL',
  'AETHER_AUDITOR_EMAIL',
]

function loginRequest(email: string, password: string, ip = '203.0.113.7'): NextRequest {
  return new NextRequest('https://aetherbi.com/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ email, password }),
  })
}

function sessionCookie(res: Response): string | null {
  const raw = res.headers.get('set-cookie') ?? ''
  const match = new RegExp(`${EXEC_SESSION_COOKIE}=([^;]+)`).exec(raw)
  return match ? match[1] : null
}

describe('named executive login', () => {
  beforeEach(() => {
    for (const key of ENV_EMAIL_KEYS) vi.stubEnv(key, '')
    for (const key of ENV_PASSWORD_KEYS) vi.stubEnv(key, TEMP_PASSWORD)
    loginIpFailureLimiter.clearAll()
    loginIpAttemptLimiter.clearAll()
    loginAccountFailureLimiter.clearAll()
    findUnique.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('no longer uses the temporary shared 6-digit password as a default', () => {
    const tempHash = createHash('sha256').update(`vf-aether-exec-2026-v1:${['123', '456'].join('')}`).digest('hex')
    expect(DEFAULT_MARKETING_PASSWORD_SHA256).not.toBe(tempHash)
  })

  for (const account of ACCOUNTS) {
    it(`logs ${account.email} in and keeps role ${account.role}`, async () => {
      const res = await POST(loginRequest(account.email, TEMP_PASSWORD))
      expect(res.status).toBe(200)
      const body = (await res.json()) as { ok: boolean; role: string }
      expect(body.ok).toBe(true)
      expect(body.role).toBe(account.role)
      const token = sessionCookie(res)
      expect(token).not.toBeNull()
      const session = await verifyExecSessionToken(decodeURIComponent(token!))
      expect(session?.role).toBe(account.role)
      expect(findUnique).not.toHaveBeenCalled()
    })
  }

  it('accepts upper-case email input for the marketing alias', async () => {
    const res = await POST(loginRequest('MKT@venturefoodskw.com', TEMP_PASSWORD))
    expect(res.status).toBe(200)
    expect(((await res.json()) as { role: string }).role).toBe('marketing')
  })

  it('rejects a wrong password with 401 and no session cookie', async () => {
    const res = await POST(loginRequest('marketing@venturefoodskw.com', `${TEMP_PASSWORD}7`))
    expect(res.status).toBe(401)
    expect(sessionCookie(res)).toBeNull()
  })

  it('rejects an unknown email with 401', async () => {
    const res = await POST(loginRequest('nobody@venturefoodskw.com', TEMP_PASSWORD))
    expect(res.status).toBe(401)
    expect(sessionCookie(res)).toBeNull()
  })

  it('lets 25 successful logins from one office IP through (successes do not consume the IP budget)', async () => {
    for (let i = 0; i < 25; i += 1) {
      const account = ACCOUNTS[i % ACCOUNTS.length]
      const res = await POST(loginRequest(account.email, TEMP_PASSWORD, '198.51.100.20'))
      expect(res.status, `attempt ${i + 1}`).toBe(200)
    }
  })

  it('still locks one account after 8 failures from the same IP, without blocking other accounts', async () => {
    const ip = '198.51.100.30'
    for (let i = 0; i < 8; i += 1) {
      const res = await POST(loginRequest('gm@venturefoodskw.com', 'wrong-password', ip))
      expect(res.status).toBe(401)
    }
    const locked = await POST(loginRequest('gm@venturefoodskw.com', TEMP_PASSWORD, ip))
    expect(locked.status).toBe(429)
    const other = await POST(loginRequest('operations@venturefoodskw.com', TEMP_PASSWORD, ip))
    expect(other.status).toBe(200)
  })

  it('blocks an IP after 60 failed attempts within 15 minutes', async () => {
    const ip = '198.51.100.40'
    for (let i = 0; i < 60; i += 1) {
      await POST(loginRequest(`probe${i}@venturefoodskw.com`, 'wrong-password', ip))
    }
    const res = await POST(loginRequest('operations@venturefoodskw.com', TEMP_PASSWORD, ip))
    expect(res.status).toBe(429)
  })

  it('keeps the marketing landing route', () => {
    expect(resolvePostLoginRedirectForRole('marketing')).toBe('/erp/cores')
    expect(isErpRouteAllowedForRole('marketing', '/erp/cores')).toBe(true)
  })
})

describe('login form error messages', () => {
  it('shows a rate-limit message with minutes for 429', () => {
    const msg = resolveLoginErrorMessage(429, { error: 'Too many attempts.', retryAfterSeconds: 125 })
    expect(msg.en).toContain('3 minutes')
    expect(msg.ar).toContain('3 دقيقة')
    expect(msg.en).not.toContain('Invalid credentials')
  })

  it('shows the origin refusal for 403 instead of invalid credentials', () => {
    const msg = resolveLoginErrorMessage(403, { error: 'Cross-origin login refused', errorAr: 'تم رفض الطلب' })
    expect(msg.en).toBe('Cross-origin login refused')
    expect(msg.ar).toBe('تم رفض الطلب')
  })

  it('falls back to invalid credentials for 401', () => {
    const msg = resolveLoginErrorMessage(401, {})
    expect(msg.en).toContain('Invalid credentials')
  })
})
