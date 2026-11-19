import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: { user: { findUnique } },
}))

import { POST } from '@/app/api/auth/login/route'
import {
  loginAccountFailureLimiter,
  loginIpAttemptLimiter,
  loginIpFailureLimiter,
} from '@/lib/auth/api-guard'
import { EXEC_SESSION_COOKIE, verifyExecSessionToken } from '@/lib/auth/exec-session'
import { middleware } from '@/middleware'
import { SIDEBAR_SECTIONS } from '@/components/erp-sidebar'

// Test-only password injected through the AETHER_*_PASSWORD env override.
const TEMP_PASSWORD = 'test-exec-login-pass'

const NAMED = [
  'abdullah@venturefoodskw.com',
  'gm@venturefoodskw.com',
  'operations@venturefoodskw.com',
  'marketing@venturefoodskw.com',
  'mkt@venturefoodskw.com',
  'supply@venturefoodskw.com',
]

const ENV_KEYS = [
  'AETHER_ABDULLAH_PASSWORD', 'AETHER_ADMIN_PASSWORD', 'AETHER_GM_PASSWORD', 'AETHER_DGM_PASSWORD',
  'AETHER_OPS_PASSWORD', 'AETHER_CFO_PASSWORD', 'AETHER_MARKETING_PASSWORD', 'AETHER_SUPPLY_PASSWORD',
  'AETHER_AUDITOR_PASSWORD', 'AETHER_QA_PASSWORD', 'AETHER_ABDULLAH_EMAIL', 'AETHER_ADMIN_EMAIL', 'AETHER_GM_EMAIL',
  'AETHER_DGM_EMAIL', 'AETHER_OPS_EMAIL', 'AETHER_CFO_EMAIL', 'AETHER_FINANCE_EMAIL',
  'AETHER_MARKETING_EMAIL', 'AETHER_MKT_EMAIL', 'AETHER_SUPPLY_EMAIL', 'AETHER_KITCHEN_EMAIL',
  'AETHER_AUDITOR_EMAIL', 'AETHER_QA_EMAIL',
]

// Test-only DB credentials (never real): generated per run.
const DB_PASSWORD = `db-test-${Math.random().toString(36).slice(2, 10)}`
let dbHash = ''

function loginRequest(email: string, password: string, ip: string): NextRequest {
  return new NextRequest('https://aetherbi.com/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ email, password }),
  })
}

async function sessionRole(res: Response): Promise<string | null> {
  const raw = res.headers.get('set-cookie') ?? ''
  const match = new RegExp(`${EXEC_SESSION_COOKIE}=([^;]+)`).exec(raw)
  if (!match) return null
  const session = await verifyExecSessionToken(decodeURIComponent(match[1]))
  return session?.role ?? null
}

describe('login rate-limit and DB-path hardening', () => {
  beforeAll(async () => {
    dbHash = await bcrypt.hash(DB_PASSWORD, 4)
  })

  beforeEach(() => {
    for (const key of ENV_KEYS) vi.stubEnv(key, key.endsWith('_PASSWORD') ? TEMP_PASSWORD : '')
    loginIpFailureLimiter.clearAll()
    loginIpAttemptLimiter.clearAll()
    loginAccountFailureLimiter.clearAll()
    findUnique.mockReset()
    findUnique.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('lets 61 successful logins from one office IP through (successes never count against the IP)', async () => {
    for (let i = 0; i < 61; i += 1) {
      const res = await POST(loginRequest(NAMED[i % NAMED.length], TEMP_PASSWORD, '198.51.100.61'))
      expect(res.status, `success ${i + 1}`).toBe(200)
    }
  })

  it('allows a correct login after 59 failures from one IP, and blocks it after 60', async () => {
    const ip = '198.51.100.59'
    for (let i = 0; i < 59; i += 1) {
      const res = await POST(loginRequest(`probe${i}@venturefoodskw.com`, 'wrong-password', ip))
      expect(res.status).toBe(401)
    }
    const ok = await POST(loginRequest('gm@venturefoodskw.com', TEMP_PASSWORD, ip))
    expect(ok.status).toBe(200)

    const fail60 = await POST(loginRequest('probe59@venturefoodskw.com', 'wrong-password', ip))
    expect(fail60.status).toBe(401)
    const blocked = await POST(loginRequest('gm@venturefoodskw.com', TEMP_PASSWORD, ip))
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBeTruthy()
  })

  it('does not let failures from IP A block IP B', async () => {
    for (let i = 0; i < 60; i += 1) {
      await POST(loginRequest(`probe${i}@venturefoodskw.com`, 'wrong-password', '203.0.113.10'))
    }
    const blockedA = await POST(loginRequest('operations@venturefoodskw.com', TEMP_PASSWORD, '203.0.113.10'))
    expect(blockedA.status).toBe(429)
    const okB = await POST(loginRequest('operations@venturefoodskw.com', TEMP_PASSWORD, '203.0.113.11'))
    expect(okB.status).toBe(200)
  })

  it('never queries the DB for a password shorter than 8 characters', async () => {
    findUnique.mockResolvedValue({
      id: 'u-wh', email: 'warehouse@venturefoodskw.com', isActive: true, passwordHash: dbHash,
    })
    const res = await POST(loginRequest('warehouse@venturefoodskw.com', 'abcdefg', '198.51.100.70'))
    expect(res.status).toBe(401)
    expect(findUnique).not.toHaveBeenCalled()
    expect(await sessionRole(res)).toBeNull()
  })

  it('maps a DB user with an admin role row to exec role admin', async () => {
    findUnique.mockResolvedValue({
      id: 'u-wh',
      email: 'warehouse@venturefoodskw.com',
      isActive: true,
      passwordHash: dbHash,
      role: { name: 'Warehouse', isAdmin: true },
    })
    const res = await POST(loginRequest('warehouse@venturefoodskw.com', DB_PASSWORD, '198.51.100.71'))
    expect(findUnique).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(200)
    expect(((await res.json()) as { role: string }).role).toBe('admin')
    expect(await sessionRole(res)).toBe('admin')
  })

  it('returns no_access when the password matches and the role title is unknown', async () => {
    findUnique.mockResolvedValue({
      id: 'u-wh',
      email: 'warehouse@venturefoodskw.com',
      isActive: true,
      passwordHash: dbHash,
      role: { name: 'Warehouse', isAdmin: false },
    })
    const res = await POST(loginRequest('warehouse@venturefoodskw.com', DB_PASSWORD, '198.51.100.81'))
    expect(res.status).toBe(403)
    const body = (await res.json()) as { reason?: string; errorEn?: string }
    expect(body.reason).toBe('no_access')
    expect(body.errorEn).toMatch(/not on the access list/i)
    expect(await sessionRole(res)).toBeNull()
  })

  it('maps a DB role named auditor to exec role auditor', async () => {
    findUnique.mockResolvedValue({
      id: 'u-aud',
      email: 'external.auditor@venturefoodskw.com',
      isActive: true,
      passwordHash: dbHash,
      role: { name: 'auditor', isAdmin: false },
    })
    const res = await POST(loginRequest('external.auditor@venturefoodskw.com', DB_PASSWORD, '198.51.100.72'))
    expect(res.status).toBe(200)
    expect(((await res.json()) as { role: string }).role).toBe('auditor')
    expect(await sessionRole(res)).toBe('auditor')
  })

  it('does not treat an email that merely contains auditor as an auditor or an admin', async () => {
    findUnique.mockResolvedValue({
      id: 'u-aud',
      email: 'external.auditor@venturefoodskw.com',
      isActive: true,
      passwordHash: dbHash,
      role: { name: 'viewer', isAdmin: false },
    })
    const res = await POST(loginRequest('external.auditor@venturefoodskw.com', DB_PASSWORD, '198.51.100.82'))
    expect(res.status).toBe(403)
    expect(((await res.json()) as { reason?: string }).reason).toBe('no_access')
  })

  it('grants admin when the email is listed in AETHER_ADMIN_EMAILS and the role table does not map', async () => {
    vi.stubEnv('AETHER_ADMIN_EMAILS', 'warehouse@venturefoodskw.com')
    findUnique.mockResolvedValue({
      id: 'u-wh',
      email: 'warehouse@venturefoodskw.com',
      isActive: true,
      passwordHash: dbHash,
      role: { name: 'Warehouse', isAdmin: false },
    })
    const res = await POST(loginRequest('warehouse@venturefoodskw.com', DB_PASSWORD, '198.51.100.83'))
    expect(res.status).toBe(200)
    expect(((await res.json()) as { role: string }).role).toBe('admin')
  })

  it('qa-readonly fails closed without AETHER_QA_PASSWORD, then logs in as a read-only auditor', async () => {
    vi.stubEnv('AETHER_QA_PASSWORD', '')
    const closed = await POST(loginRequest('qa-readonly@venturefoodskw.com', TEMP_PASSWORD, '198.51.100.91'))
    expect(closed.status).toBe(401)
    expect(await sessionRole(closed)).toBeNull()

    vi.stubEnv('AETHER_QA_PASSWORD', TEMP_PASSWORD)
    const open = await POST(loginRequest('qa-readonly@venturefoodskw.com', TEMP_PASSWORD, '198.51.100.92'))
    expect(open.status).toBe(200)
    expect(((await open.json()) as { role: string }).role).toBe('auditor')
    expect(await sessionRole(open)).toBe('auditor')

    const raw = open.headers.get('set-cookie') ?? ''
    const token = new RegExp(`${EXEC_SESSION_COOKIE}=([^;]+)`).exec(raw)?.[1]
    expect(token).toBeTruthy()
    const post = await middleware(
      new NextRequest('https://aetherbi.com/api/erp/governance', {
        method: 'POST',
        headers: { cookie: `${EXEC_SESSION_COOKIE}=${token}` },
      }),
    )
    expect(post.status).toBe(403)

    for (const href of SIDEBAR_SECTIONS.flatMap((section) => section.items.map((item) => item.href))) {
      const get = await middleware(
        new NextRequest(`https://aetherbi.com${href}`, {
          method: 'GET',
          headers: { cookie: `${EXEC_SESSION_COOKIE}=${token}` },
        }),
      )
      expect(get.status, href).toBeLessThan(300)
    }
  })

  it('rejects an inactive DB user and a wrong DB password', async () => {
    findUnique.mockResolvedValue({
      id: 'u-wh', email: 'warehouse@venturefoodskw.com', isActive: false, passwordHash: dbHash,
    })
    const inactive = await POST(loginRequest('warehouse@venturefoodskw.com', DB_PASSWORD, '198.51.100.73'))
    expect(inactive.status).toBe(401)
    findUnique.mockResolvedValue({
      id: 'u-wh', email: 'warehouse@venturefoodskw.com', isActive: true, passwordHash: dbHash,
    })
    const wrong = await POST(loginRequest('warehouse@venturefoodskw.com', `${DB_PASSWORD}x`, '198.51.100.74'))
    expect(wrong.status).toBe(401)
  })
})
