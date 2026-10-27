import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { AppError, errorResponse } from '@/lib/api/errors'
import { authenticate, authenticateSession, type AuthContext, type SessionUser } from '@/lib/auth/context'
import type { Permission } from '@/lib/auth/permissions'
import { conflictDomainCodes, DomainError } from '@/lib/domain-error'
import { checkRequestOrigin, isStateChanging } from '@/lib/http-origin'
import { errorFields, logger } from '@/lib/logger'
import { CurrencyMismatchError } from '@/lib/money'
import { apiRateLimiter, rateLimitedResponse, routeGroup, SESSION_SCOPE, type RateLimitKind } from '@/lib/rate-limit'

type RouteParams = { params: Promise<Record<string, string>> }

export type RouteArgs = {
  request: NextRequest
  auth: AuthContext
  params: Record<string, string>
}

type PgError = { code?: unknown }

function pgCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as PgError).code
    return typeof code === 'string' ? code : null
  }
  return null
}

/** Maps any thrown value to the standard error body. Unexpected errors are logged and never leak details. */
export function toErrorResponse(error: unknown, request?: NextRequest): NextResponse {
  if (error instanceof AppError) {
    if (error.status === 500) logger.error('Request failed', { path: request?.nextUrl.pathname, code: error.code })
    return errorResponse(error.status, error.code, error.message, error.details)
  }
  if (error instanceof ZodError) {
    return errorResponse(
      422,
      'validation_failed',
      'The request did not pass validation.',
      error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
    )
  }
  if (error instanceof CurrencyMismatchError) {
    return errorResponse(422, 'currency_mismatch', error.message)
  }
  if (error instanceof DomainError) {
    return errorResponse(conflictDomainCodes.has(error.code) ? 409 : 422, error.code, error.message)
  }
  const code = pgCode(error)
  if (code === '23505') return errorResponse(409, 'conflict', 'The record conflicts with an existing one.')
  if (code === '23503') return errorResponse(422, 'reference_invalid', 'A referenced record does not exist.')
  if (code === '23001') return errorResponse(409, 'rule_violation', 'The change is not allowed by the accounting rules.')
  if (code === '23514') return errorResponse(422, 'constraint_violation', 'The data violates a business constraint.')
  logger.error('Unhandled request error', { path: request?.nextUrl.pathname, method: request?.method, ...errorFields(error) })
  return errorResponse(500, 'internal_error', 'Something went wrong. Try again later.')
}

export const CROSS_SITE_CODE = 'cross_site_forbidden'

/**
 * Refuses a state-changing call that a page on another site made the browser send. It runs before authentication so a
 * forged request costs no database work, and it never lets anything through that authentication would have refused.
 */
function originGuard(request: NextRequest): NextResponse | null {
  const verdict = checkRequestOrigin(request)
  if (verdict.allowed) return null
  logger.warn('Cross-site request refused', {
    path: request.nextUrl.pathname,
    method: request.method,
    refusal: verdict.refusal,
    observed: verdict.observed,
  })
  return errorResponse(403, CROSS_SITE_CODE, 'This request did not come from the application.')
}

/** Counts the call against the caller's budget for this route group. Reads and writes have separate budgets. */
function rateGuard(request: NextRequest, tenantId: string, userId: string): NextResponse | null {
  const kind: RateLimitKind = isStateChanging(request.method) ? 'write' : 'read'
  const decision = apiRateLimiter.check({ tenantId, userId, group: routeGroup(request.nextUrl.pathname), kind })
  if (decision.allowed) return null
  logger.warn('Rate limit reached', { path: request.nextUrl.pathname, method: request.method, kind, tenantId })
  return rateLimitedResponse(decision.retryAfterSeconds)
}

/**
 * Wraps a route handler: refuses cross-site writes, authenticates, checks the RBAC permission, counts the call against the
 * caller's rate limit, and converts every failure to the error body.
 */
export function protectedRoute(permission: Permission, handler: (args: RouteArgs) => Promise<NextResponse>) {
  return async (request: NextRequest, context: RouteParams): Promise<NextResponse> => {
    try {
      const crossSite = originGuard(request)
      if (crossSite) return crossSite
      const auth = await authenticate(request, permission)
      const limited = rateGuard(request, auth.tenantId, auth.userId)
      if (limited) return limited
      return await handler({ request, auth, params: await context.params })
    } catch (error) {
      return toErrorResponse(error, request)
    }
  }
}

export type SessionRouteArgs = { request: NextRequest; session: SessionUser; params: Record<string, string> }

/**
 * For the few calls a signed-in person makes before they belong to any company (accepting an invitation).
 * It proves who they are and nothing more: the handler must not read or change tenant data without its own checks.
 */
export function sessionRoute(handler: (args: SessionRouteArgs) => Promise<NextResponse>) {
  return async (request: NextRequest, context: RouteParams): Promise<NextResponse> => {
    try {
      const crossSite = originGuard(request)
      if (crossSite) return crossSite
      const session = await authenticateSession()
      const limited = rateGuard(request, SESSION_SCOPE, session.userId)
      if (limited) return limited
      return await handler({ request, session, params: await context.params })
    } catch (error) {
      return toErrorResponse(error, request)
    }
  }
}
