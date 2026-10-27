import { describe, expect, it } from 'vitest'
import { API_RATE_LIMITS, rateLimitedResponse, RateLimiter, routeGroup, type RateLimitKey, type RateLimitKind } from '@/lib/rate-limit'

/**
 * The limiter on its own: no request, no database, and a clock the test moves by hand, so every window boundary is exact.
 */

const key = (overrides: Partial<RateLimitKey> = {}): RateLimitKey => ({
  tenantId: 'tenant-a',
  userId: 'user-a',
  group: 'finance/invoices',
  kind: 'write',
  ...overrides,
})

function fixedClock(start = 1_700_000_000_000) {
  let now = start
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms
    },
  }
}

const rules = { read: { limit: 5, windowMs: 10_000 }, write: { limit: 2, windowMs: 10_000 } }

describe('routeGroup', () => {
  it('keeps the module and the resource and drops ids and sub-paths, so one resource shares one budget', () => {
    expect(routeGroup('/api/v1/finance/invoices')).toBe('finance/invoices')
    expect(routeGroup('/api/v1/finance/invoices/6f1b0f3e-0000-4000-8000-000000000000')).toBe('finance/invoices')
    expect(routeGroup('/api/v1/finance/invoices/6f1b0f3e-0000-4000-8000-000000000000/approve')).toBe('finance/invoices')
    expect(routeGroup('/api/v1/procurement/orders/1/receipts')).toBe('procurement/orders')
  })

  it('separates resources inside one module and modules from each other', () => {
    expect(routeGroup('/api/v1/finance/payments')).not.toBe(routeGroup('/api/v1/finance/invoices'))
    expect(routeGroup('/api/v1/crm/invoices')).not.toBe(routeGroup('/api/v1/finance/invoices'))
  })

  it('still returns a stable group for an unversioned or empty path', () => {
    expect(routeGroup('/api/health')).toBe('health')
    expect(routeGroup('/erp/finance/invoices')).toBe('erp/finance')
    expect(routeGroup('/')).toBe('root')
    expect(routeGroup('')).toBe('root')
  })
})

describe('counting inside one window', () => {
  it('allows exactly the limit and refuses the next call', () => {
    const clock = fixedClock()
    const limiter = new RateLimiter(rules, clock.now)
    expect(limiter.check(key())).toMatchObject({ allowed: true, remaining: 1 })
    expect(limiter.check(key())).toMatchObject({ allowed: true, remaining: 0 })
    expect(limiter.check(key())).toMatchObject({ allowed: false })
  })

  it('reports the whole seconds left in the window, rounded up and never below one', () => {
    const clock = fixedClock()
    const limiter = new RateLimiter(rules, clock.now)
    limiter.check(key())
    limiter.check(key())
    clock.advance(1_200)
    const refused = limiter.check(key())
    expect(refused.allowed).toBe(false)
    if (!refused.allowed) expect(refused.retryAfterSeconds).toBe(9)
    clock.advance(8_700)
    const last = limiter.check(key())
    expect(last.allowed).toBe(false)
    if (!last.allowed) expect(last.retryAfterSeconds).toBe(1)
  })

  it('does not count a refused call, so hammering the door cannot push the window forward', () => {
    const clock = fixedClock()
    const limiter = new RateLimiter(rules, clock.now)
    limiter.check(key())
    limiter.check(key())
    for (let attempt = 0; attempt < 50; attempt += 1) expect(limiter.check(key()).allowed).toBe(false)
    clock.advance(10_000)
    expect(limiter.check(key()).allowed).toBe(true)
  })
})

describe('window rollover', () => {
  it('opens a fresh window once the old one has elapsed', () => {
    const clock = fixedClock()
    const limiter = new RateLimiter(rules, clock.now)
    limiter.check(key())
    limiter.check(key())
    clock.advance(9_999)
    expect(limiter.check(key()).allowed).toBe(false)
    clock.advance(1)
    expect(limiter.check(key())).toMatchObject({ allowed: true, remaining: 1 })
  })

  it('gives the same answer for the same clock and the same calls', () => {
    const replay = (): boolean[] => {
      const clock = fixedClock()
      const limiter = new RateLimiter(rules, clock.now)
      const seen: boolean[] = []
      for (const step of [0, 0, 0, 5_000, 5_000, 0]) {
        clock.advance(step)
        seen.push(limiter.check(key()).allowed)
      }
      return seen
    }
    expect(replay()).toEqual(replay())
    expect(replay()).toEqual([true, true, false, false, true, true])
  })
})

describe('what makes a key', () => {
  it('counts reads and writes against separate budgets', () => {
    const clock = fixedClock()
    const limiter = new RateLimiter(rules, clock.now)
    for (let call = 0; call < rules.write.limit; call += 1) expect(limiter.check(key({ kind: 'write' })).allowed).toBe(true)
    expect(limiter.check(key({ kind: 'write' })).allowed).toBe(false)
    for (let call = 0; call < rules.read.limit; call += 1) expect(limiter.check(key({ kind: 'read' })).allowed).toBe(true)
    expect(limiter.check(key({ kind: 'read' })).allowed).toBe(false)
  })

  it('never lets one caller spend another caller\'s budget', () => {
    const clock = fixedClock()
    const limiter = new RateLimiter(rules, clock.now)
    limiter.check(key())
    limiter.check(key())
    expect(limiter.check(key()).allowed).toBe(false)
    for (const fresh of [key({ tenantId: 'tenant-b' }), key({ userId: 'user-b' }), key({ group: 'crm/quotations' })]) {
      expect(limiter.check(fresh).allowed).toBe(true)
    }
    expect(limiter.check(key()).allowed).toBe(false)
  })
})

describe('bounded memory', () => {
  it('drops windows that have already elapsed instead of keeping them for ever', () => {
    const clock = fixedClock()
    const limiter = new RateLimiter(rules, clock.now, 2)
    limiter.check(key({ userId: 'user-a' }))
    limiter.check(key({ userId: 'user-b' }))
    expect(limiter.size()).toBe(2)
    clock.advance(10_000)
    limiter.check(key({ userId: 'user-c' }))
    expect(limiter.size()).toBe(1)
  })

  it('stays inside the cap when every window is still live, by forgetting the oldest first', () => {
    const clock = fixedClock()
    const limiter = new RateLimiter(rules, clock.now, 3)
    for (const user of ['user-a', 'user-b', 'user-c', 'user-d', 'user-e']) {
      clock.advance(1)
      limiter.check(key({ userId: user }))
    }
    expect(limiter.size()).toBeLessThanOrEqual(3)
    // The oldest caller was forgotten, so their next call starts a new window. The cap trades precision for bounded memory.
    expect(limiter.check(key({ userId: 'user-a' })).allowed).toBe(true)
  })

  it('forgets everything on reset', () => {
    const clock = fixedClock()
    const limiter = new RateLimiter(rules, clock.now)
    limiter.check(key())
    limiter.check(key())
    expect(limiter.check(key()).allowed).toBe(false)
    limiter.reset()
    expect(limiter.size()).toBe(0)
    expect(limiter.check(key()).allowed).toBe(true)
  })
})

describe('the 429 answer', () => {
  it('uses the project error body, the 429 status and a Retry-After header', async () => {
    const response = rateLimitedResponse(37)
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('37')
    expect(await response.json()).toEqual({
      error: { code: 'rate_limited', message: 'Too many requests. Wait a moment and try again.', details: { retryAfterSeconds: 37 } },
    })
  })

  it('leaks nothing about the caller or the server', async () => {
    const text = JSON.stringify(await rateLimitedResponse(5).json())
    expect(text).not.toMatch(/tenant|stack|node_modules/i)
  })
})

describe('the limits the API ships with', () => {
  it('keeps writes stricter than reads and both on a one-minute window', () => {
    const kinds: RateLimitKind[] = ['read', 'write']
    for (const kind of kinds) {
      expect(API_RATE_LIMITS[kind].windowMs).toBe(60_000)
      expect(API_RATE_LIMITS[kind].limit).toBeGreaterThan(0)
    }
    expect(API_RATE_LIMITS.write.limit).toBeLessThan(API_RATE_LIMITS.read.limit)
  })
})
