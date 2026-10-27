import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { AppError, errorResponse } from '@/lib/api/errors'
import { authenticate, authenticateSession, type AuthContext, type SessionUser } from '@/lib/auth/context'
import type { Permission } from '@/lib/auth/permissions'
import { conflictDomainCodes, DomainError } from '@/lib/domain-error'
import { errorFields, logger } from '@/lib/logger'
import { CurrencyMismatchError } from '@/lib/money'

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

/** Wraps a route handler: authenticates, checks the RBAC permission, and converts every failure to the error body. */
export function protectedRoute(permission: Permission, handler: (args: RouteArgs) => Promise<NextResponse>) {
  return async (request: NextRequest, context: RouteParams): Promise<NextResponse> => {
    try {
      const auth = await authenticate(request, permission)
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
      const session = await authenticateSession()
      return await handler({ request, session, params: await context.params })
    } catch (error) {
      return toErrorResponse(error, request)
    }
  }
}
