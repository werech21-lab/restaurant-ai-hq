import type { NextResponse } from 'next/server'
import { type ErrorBody, errorResponse } from '@/lib/api/errors'

/**
 * A fixed-window request counter held in the memory of one Node process.
 *
 * It protects a single server instance and nothing more. Two instances behind a load balancer each keep their own counters,
 * so the effective limit is the configured limit multiplied by the number of instances, and a restart forgets every window.
 * Protecting a multi-instance deployment needs a shared store or a limiter at the edge, which is a deployment decision and
 * deliberately not taken here: this module adds no dependency, no Redis and no queue.
 *
 * Counting starts only after a caller is authenticated, because the key is the tenant, the user and the route group. A flood
 * of anonymous requests is therefore not slowed down by this module; it is refused with 401 by authentication instead.
 */

export type RateLimitKind = 'read' | 'write'

export type RateLimitKey = {
  tenantId: string
  userId: string
  group: string
  kind: RateLimitKind
}

export type RateLimitRule = { limit: number; windowMs: number }

export type RateLimitRules = Record<RateLimitKind, RateLimitRule>

export type RateLimitDecision =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; retryAfterSeconds: number; resetAt: number }

/** Injected so tests are deterministic. Production passes `Date.now`. */
export type Clock = () => number

/**
 * Reads are the cheap, repeated calls a screen makes while a person works; writes change data and are far rarer.
 * One window is one minute, which is short enough that a person who hits the limit waits seconds, not minutes.
 */
export const API_RATE_LIMITS: RateLimitRules = {
  read: { limit: 240, windowMs: 60_000 },
  write: { limit: 60, windowMs: 60_000 },
}

/** Above this many live windows the oldest are dropped, so a long-lived process cannot grow without bound. */
const MAX_TRACKED_WINDOWS = 20_000

type Window = { startedAt: number; count: number; kind: RateLimitKind }

/**
 * Derives the bucket a path belongs to: `/api/v1/finance/invoices/<id>/approve` and `/api/v1/finance/invoices` share the
 * budget `finance/invoices`, so one resource cannot be hammered through its sub-paths. Record ids never enter the key.
 */
export function routeGroup(pathname: string): string {
  const parts = pathname.split('/').filter((part) => part.length > 0)
  const afterApi = parts[0] === 'api' ? parts.slice(/^v\d+$/.test(parts[1] ?? '') ? 2 : 1) : parts
  const group = afterApi.slice(0, 2).join('/')
  return group.length > 0 ? group : 'root'
}

function keyOf(key: RateLimitKey): string {
  return `${key.kind}:${key.tenantId}:${key.userId}:${key.group}`
}

export class RateLimiter {
  private readonly windows = new Map<string, Window>()

  constructor(
    private readonly rules: RateLimitRules,
    private readonly clock: Clock,
    private readonly maxWindows: number = MAX_TRACKED_WINDOWS
  ) {}

  /** Counts one request against its key and says whether it may proceed. A refused request is not counted. */
  check(key: RateLimitKey): RateLimitDecision {
    const rule = this.rules[key.kind]
    const now = this.clock()
    if (this.windows.size >= this.maxWindows) this.evict(now)

    const name = keyOf(key)
    const current = this.windows.get(name)
    if (!current || now - current.startedAt >= rule.windowMs) {
      this.windows.set(name, { startedAt: now, count: 1, kind: key.kind })
      return { allowed: true, remaining: rule.limit - 1, resetAt: now + rule.windowMs }
    }

    const resetAt = current.startedAt + rule.windowMs
    if (current.count >= rule.limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)), resetAt }
    }
    current.count += 1
    return { allowed: true, remaining: rule.limit - current.count, resetAt }
  }

  /** Forgets every window. Used between tests and when a process wants a clean slate. */
  reset(): void {
    this.windows.clear()
  }

  size(): number {
    return this.windows.size
  }

  /** Drops windows that have already expired, then, if that was not enough, the oldest entries in insertion order. */
  private evict(now: number): void {
    for (const [name, window] of this.windows) {
      if (now - window.startedAt >= this.rules[window.kind].windowMs) this.windows.delete(name)
    }
    for (const name of this.windows.keys()) {
      if (this.windows.size < this.maxWindows) break
      this.windows.delete(name)
    }
  }
}

/** The one limiter every API route shares, in this process only. */
export const apiRateLimiter = new RateLimiter(API_RATE_LIMITS, Date.now)

export const RATE_LIMITED_CODE = 'rate_limited'

/** The tenant slot for the few calls made before a person belongs to a company. No tenant id can ever equal it. */
export const SESSION_SCOPE = 'session'

/** 429 in the project's error body, with the header that tells a client how long to wait. */
export function rateLimitedResponse(retryAfterSeconds: number): NextResponse<ErrorBody> {
  const response = errorResponse(429, RATE_LIMITED_CODE, 'Too many requests. Wait a moment and try again.', {
    retryAfterSeconds,
  })
  response.headers.set('Retry-After', String(retryAfterSeconds))
  return response
}
