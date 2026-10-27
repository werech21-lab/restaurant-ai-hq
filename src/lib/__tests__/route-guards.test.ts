import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The two guards the shared wrapper adds to every route: cross-site writes are refused before anything touches the
 * database, and an authenticated caller gets a bounded number of calls per route group. Authentication is replaced by a
 * stub here so the guards are tested on their own; `api-access-matrix.test.ts` proves the real checks on every route.
 */

const stub = vi.hoisted(() => ({
  signedIn: true,
  userId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  authenticateCalls: 0,
  sessionCalls: 0,
}))

vi.mock('@/lib/auth/context', async () => {
  const { AppError } = await import('@/lib/api/errors')
  const unauthenticated = () => new AppError(401, 'unauthenticated', 'Sign in to continue.')
  return {
    authenticate: async () => {
      stub.authenticateCalls += 1
      if (!stub.signedIn) throw unauthenticated()
      return { userId: stub.userId, tenantId: stub.tenantId, permissions: new Set(['finance.invoice.create']) }
    },
    authenticateSession: async () => {
      stub.sessionCalls += 1
      if (!stub.signedIn) throw unauthenticated()
      return { userId: stub.userId, email: 'owner@example.com', emailConfirmed: true }
    },
  }
})

import { CROSS_SITE_CODE, protectedRoute, sessionRoute } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { API_RATE_LIMITS, apiRateLimiter } from '@/lib/rate-limit'

const HOST = 'erp.example.com'

type RouteHandler = (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<NextResponse>

let handlerCalls = 0

const route: RouteHandler = protectedRoute(permissions.financeInvoiceCreate, async ({ auth }) => {
  handlerCalls += 1
  return NextResponse.json({ tenantId: auth.tenantId })
})

const session: RouteHandler = sessionRoute(async ({ session: user }) => {
  handlerCalls += 1
  return NextResponse.json({ userId: user.userId })
})

function call(
  method: string,
  headers: Record<string, string> = {},
  path = '/api/v1/finance/invoices',
  handler: RouteHandler = route
): Promise<NextResponse> {
  const hasBody = method !== 'GET' && method !== 'DELETE'
  const request = new NextRequest(`https://${HOST}${path}`, {
    method,
    headers: { host: HOST, 'content-type': 'application/json', ...headers },
    body: hasBody ? '{}' : undefined,
  })
  return handler(request, { params: Promise.resolve({}) })
}

async function body(response: NextResponse): Promise<{ error?: { code: string; message: string; details?: unknown } }> {
  return (await response.json()) as { error?: { code: string; message: string; details?: unknown } }
}

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const

beforeEach(() => {
  apiRateLimiter.reset()
  handlerCalls = 0
  stub.signedIn = true
  stub.authenticateCalls = 0
  stub.sessionCalls = 0
  stub.tenantId = '22222222-2222-4222-8222-222222222222'
})

describe('requests the origin guard lets through', () => {
  it('allows a write with no browser headers at all, so server-to-server callers and tests still work', async () => {
    const response = await call('POST')
    expect(response.status).toBe(200)
    expect(handlerCalls).toBe(1)
  })

  it('allows a same-origin browser write, by Origin and by Sec-Fetch-Site', async () => {
    const sameOrigin: Record<string, string>[] = [
      { origin: `https://${HOST}` },
      { 'sec-fetch-site': 'same-origin' },
      { origin: `https://${HOST}`, 'sec-fetch-site': 'same-origin' },
      { 'sec-fetch-site': 'none' },
    ]
    for (const headers of sameOrigin) {
      const response = await call('POST', headers)
      expect(response.status, JSON.stringify(headers)).toBe(200)
    }
    expect(handlerCalls).toBe(4)
  })

  it('ignores the case of the Origin host, which the browser may send either way', async () => {
    expect((await call('POST', { origin: `https://${HOST.toUpperCase()}` })).status).toBe(200)
  })

  it('allows a cross-site read, because a read changes nothing and its body is unreadable without CORS headers', async () => {
    const response = await call('GET', { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' })
    expect(response.status).toBe(200)
    expect(handlerCalls).toBe(1)
  })
})

describe('requests the origin guard refuses', () => {
  it('refuses every state-changing method sent from another origin', async () => {
    for (const method of WRITE_METHODS) {
      const response = await call(method, { origin: 'https://attacker.example' })
      expect(response.status, method).toBe(403)
      expect((await body(response)).error?.code, method).toBe(CROSS_SITE_CODE)
    }
    expect(handlerCalls).toBe(0)
  })

  it('refuses a cross-site or same-site fetch even when no Origin header is sent', async () => {
    for (const site of ['cross-site', 'same-site']) {
      const response = await call('POST', { 'sec-fetch-site': site })
      expect(response.status, site).toBe(403)
      expect((await body(response)).error?.code, site).toBe(CROSS_SITE_CODE)
    }
  })

  it('refuses an opaque Origin, which is what a sandboxed frame or a cross-origin redirect sends', async () => {
    for (const origin of ['null', 'not a url', 'https://']) {
      const response = await call('POST', { origin })
      expect(response.status, origin).toBe(403)
    }
  })

  it('refuses a host that only looks like ours: another port, a prefix, a suffix', async () => {
    for (const origin of [`https://${HOST}:8443`, `https://evil-${HOST}`, `https://${HOST}.evil.example`]) {
      const response = await call('POST', { origin })
      expect(response.status, origin).toBe(403)
    }
  })

  it('refuses before authentication runs, so a forged write costs no database work', async () => {
    const response = await call('POST', { origin: 'https://attacker.example' })
    expect(response.status).toBe(403)
    expect(stub.authenticateCalls).toBe(0)
    expect(handlerCalls).toBe(0)
  })

  it('answers with the project error body and no detail about the request', async () => {
    const payload = await body(await call('POST', { origin: 'https://attacker.example' }))
    expect(payload).toEqual({ error: { code: CROSS_SITE_CODE, message: 'This request did not come from the application.' } })
  })

  it('refuses a cross-site write on a session-only route too, before it proves who the caller is', async () => {
    const response = await call('POST', { origin: 'https://attacker.example' }, '/api/v1/iam/invitations/accept', session)
    expect(response.status).toBe(403)
    expect((await body(response)).error?.code).toBe(CROSS_SITE_CODE)
    expect(stub.sessionCalls).toBe(0)
  })
})

describe('the rate limit on writes', () => {
  it('allows the whole write budget and then answers 429 with Retry-After', async () => {
    for (let sent = 0; sent < API_RATE_LIMITS.write.limit; sent += 1) {
      expect((await call('POST')).status).toBe(200)
    }
    const refused = await call('POST')
    expect(refused.status).toBe(429)
    const retryAfter = Number(refused.headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(API_RATE_LIMITS.write.windowMs / 1000)
    expect((await body(refused)).error?.code).toBe('rate_limited')
    expect(handlerCalls).toBe(API_RATE_LIMITS.write.limit)
  })

  it('does not run the handler once the budget is spent', async () => {
    for (let sent = 0; sent <= API_RATE_LIMITS.write.limit; sent += 1) await call('POST')
    handlerCalls = 0
    expect((await call('PATCH')).status).toBe(429)
    expect(handlerCalls).toBe(0)
  })

  it('leaves the read budget untouched when the write budget is gone', async () => {
    for (let sent = 0; sent <= API_RATE_LIMITS.write.limit; sent += 1) await call('POST')
    expect((await call('GET')).status).toBe(200)
  })

  it('spends one budget per route group, not one for the whole API', async () => {
    for (let sent = 0; sent <= API_RATE_LIMITS.write.limit; sent += 1) await call('POST')
    expect((await call('POST')).status).toBe(429)
    expect((await call('POST', {}, '/api/v1/crm/quotations')).status).toBe(200)
  })

  it('counts the sub-paths of one resource against that resource', async () => {
    for (let sent = 0; sent < API_RATE_LIMITS.write.limit; sent += 1) {
      await call('POST', {}, '/api/v1/finance/invoices/6f1b0f3e-0000-4000-8000-000000000000/approve')
    }
    expect((await call('POST')).status).toBe(429)
  })

  it('gives every tenant its own budget, so one company cannot starve another', async () => {
    for (let sent = 0; sent <= API_RATE_LIMITS.write.limit; sent += 1) await call('POST')
    expect((await call('POST')).status).toBe(429)
    stub.tenantId = '33333333-3333-4333-8333-333333333333'
    expect((await call('POST')).status).toBe(200)
  })
})

describe('the rate limit and authentication', () => {
  it('never answers 429 to a caller who is not signed in: the answer stays 401 and nothing is counted', async () => {
    stub.signedIn = false
    for (let sent = 0; sent < API_RATE_LIMITS.write.limit + 5; sent += 1) {
      expect((await call('POST')).status).toBe(401)
    }
    expect(apiRateLimiter.size()).toBe(0)
    expect(handlerCalls).toBe(0)
  })

  it('limits a session-only route by the person, with no tenant in the key', async () => {
    const accept = '/api/v1/iam/invitations/accept'
    for (let sent = 0; sent < API_RATE_LIMITS.write.limit; sent += 1) {
      expect((await call('POST', {}, accept, session)).status).toBe(200)
    }
    expect((await call('POST', {}, accept, session)).status).toBe(429)
    expect(handlerCalls).toBe(API_RATE_LIMITS.write.limit)
  })
})

describe('the guards leave the normal path alone', () => {
  it('still hands the handler the resolved tenant and returns its answer unchanged', async () => {
    const response = await call('POST', { origin: `https://${HOST}`, 'sec-fetch-site': 'same-origin' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ tenantId: stub.tenantId })
  })
})
