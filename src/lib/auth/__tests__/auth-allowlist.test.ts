import { SignJWT } from 'jose'
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { messageForLoginReason } from '@/app/login/login-error-message'
import { requireExecApiSession } from '@/lib/auth/api-guard'
import {
  createExecSessionToken,
  inferExecRoleFromEmail,
  verifyExecSessionToken,
} from '@/lib/auth/exec-session'
import { resolveAccessRole } from '@/lib/auth/role-source'
import {
  ExecRoleDeniedError,
  SessionSecretMissingError,
  resetSessionSecretLogForTests,
} from '@/lib/auth/session-secret'
import { logger } from '@/lib/logger'
import { middleware } from '@/middleware'
import { getSecret, SESSION_COOKIE, signSessionToken, verifySessionToken } from '@/lib/session'

const SECRET_KEYS = ['AETHER_SESSION_SECRET', 'SESSION_SECRET', 'AUTH_SECRET', 'AETHER_ADMIN_EMAILS'] as const

afterEach(() => {
  vi.unstubAllEnvs()
  resetSessionSecretLogForTests()
})

describe('executive role allowlist', () => {
  it('keeps named accounts and denies every other email', () => {
    expect(inferExecRoleFromEmail('gm@venturefoodskw.com')).toBe('gm')
    expect(inferExecRoleFromEmail('abdullah@venturefoodskw.com')).toBe('admin')
    expect(inferExecRoleFromEmail('admin@venturefoodskw.com')).toBe('admin')
    expect(inferExecRoleFromEmail('auditor@venturefoodskw.com')).toBe('auditor')
    expect(inferExecRoleFromEmail('someone@gmail.com')).toBeNull()
    expect(inferExecRoleFromEmail('not-an-auditor@example.com')).toBeNull()
  })

  it('reads admin emails from AETHER_ADMIN_EMAILS and denies when it is empty', () => {
    expect(resolveAccessRole({ email: 'ops-lead@venturefoodskw.com', adminEmails: new Set() })).toBeNull()
    expect(
      resolveAccessRole({
        email: 'ops-lead@venturefoodskw.com',
        adminEmails: new Set(['ops-lead@venturefoodskw.com']),
      }),
    ).toBe('admin')
  })

  it('prefers a mapped role-table name over the admin allowlist', () => {
    expect(
      resolveAccessRole({
        email: 'auditor@venturefoodskw.com',
        roleName: 'auditor',
        isAdmin: true,
        adminEmails: new Set(['auditor@venturefoodskw.com']),
      }),
    ).toBe('auditor')
    expect(resolveAccessRole({ email: 'clerk@venturefoodskw.com', roleName: 'ops' })).toBe('ops')
    expect(resolveAccessRole({ email: 'clerk@venturefoodskw.com', isAdmin: true })).toBe('admin')
    expect(resolveAccessRole({ email: 'clerk@venturefoodskw.com', roleName: 'Warehouse', isAdmin: false })).toBeNull()
  })

  it('refuses to sign an executive session for an unknown email', async () => {
    await expect(createExecSessionToken('stranger@example.com')).rejects.toBeInstanceOf(ExecRoleDeniedError)
    const token = await createExecSessionToken('cfo@venturefoodskw.com')
    expect((await verifyExecSessionToken(token))?.role).toBe('cfo')
  })

  it('maps the login reason to the access-denied message', () => {
    expect(messageForLoginReason('no_access')?.en).toMatch(/not on the access list/i)
    expect(messageForLoginReason('no_access')?.ar.length).toBeGreaterThan(0)
    expect(messageForLoginReason(undefined)).toBeNull()
  })
})

describe('legacy session cookies', () => {
  it('rejects a signed cookie that has no role and accepts one that carries a role', async () => {
    const roleless = await new SignJWT({ sub: 'user-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(getSecret())
    expect(await verifySessionToken(roleless)).toBeNull()

    const signed = await signSessionToken('user-2', 'ops')
    expect(await verifySessionToken(signed)).toEqual({ userId: 'user-2', role: 'ops' })

    const guard = await requireExecApiSession(
      new NextRequest('https://aetherbi.com/api/erp/odoo-sync', {
        headers: { cookie: `${SESSION_COOKIE}=${roleless}` },
      }),
    )
    expect(guard.ok).toBe(false)

    const allowed = await requireExecApiSession(
      new NextRequest('https://aetherbi.com/api/erp/odoo-sync', {
        headers: { cookie: `${SESSION_COOKIE}=${signed}` },
      }),
      { allowAuditor: true },
    )
    expect(allowed.ok).toBe(true)
    if (allowed.ok) expect(allowed.session.role).toBe('ops')
  })

  it('sends a role-less legacy cookie back to login with the access message', async () => {
    const roleless = await new SignJWT({ sub: 'user-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(getSecret())
    const res = await middleware(
      new NextRequest('https://aetherbi.com/erp', {
        headers: { cookie: `${SESSION_COOKIE}=${roleless}` },
      }),
    )
    expect(res.status).toBe(307)
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('/login')
    expect(location).toContain('reason=no_access')
  })
})

describe('production session secret', () => {
  it('refuses the built-in fallback when production has no secret, without throwing from verify', async () => {
    const token = await createExecSessionToken('gm@venturefoodskw.com', 'gm')
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
    for (const key of SECRET_KEYS) vi.stubEnv(key, '')
    vi.stubEnv('NODE_ENV', 'production')
    resetSessionSecretLogForTests()

    await expect(verifyExecSessionToken(token)).resolves.toBeNull()
    await expect(verifySessionToken(await signSessionToken('user-1', 'admin').catch(() => 'x'))).resolves.toBeNull()
    await expect(createExecSessionToken('gm@venturefoodskw.com', 'gm')).rejects.toBeInstanceOf(
      SessionSecretMissingError,
    )
    expect(errorSpy).toHaveBeenCalled()
    const messages = errorSpy.mock.calls.map((call) => String(call[0]))
    expect(messages).toContain('session_secret_missing')
    errorSpy.mockRestore()
  })
})
