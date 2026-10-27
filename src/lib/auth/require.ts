import { AppError } from '@/lib/api/errors'
import type { AuthContext } from '@/lib/auth/context'
import type { Permission } from '@/lib/auth/permissions'

/**
 * The permission check a service repeats on its own, so a caller that skips the route (a server action, a job) is still
 * refused. The route's `protectedRoute` is the first line, this is the second.
 */
export function requirePermission(auth: AuthContext, permission: Permission): void {
  if (!auth.permissions.has(permission)) throw new AppError(403, 'forbidden', 'You do not have permission for this action.')
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === '23505'
}

export function versionConflict(what: string): AppError {
  return new AppError(409, 'version_conflict', `The ${what} was changed by someone else. Reload it and try again.`)
}