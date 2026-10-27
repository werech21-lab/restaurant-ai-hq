import { createHash, randomBytes } from 'node:crypto'

/**
 * Pure rules for inviting users and managing roles inside a tenant. No database access here.
 *
 * Why these rules: a person who may invite or edit roles must never be able to create more power than they hold, and nobody
 * becomes an administrator by default. Administrative power is the `iam.*` permission family.
 */

export const ADMIN_PERMISSION_PREFIX = 'iam.'
/** The permission that lets someone create roles and hand out administrative roles. */
export const ROLE_MANAGE = 'iam.role.manage'

export const DEFAULT_INVITATION_DAYS = 7
export const MAX_INVITATION_DAYS = 30
export const INVITATION_TOKEN_BYTES = 32

export type RoleLike = { permissions: readonly string[] }

/** A role is administrative when it holds any `iam.*` permission. */
export function isAdministrativeRole(role: RoleLike): boolean {
  return role.permissions.some((permission) => permission.startsWith(ADMIN_PERMISSION_PREFIX))
}

/** Permissions the role holds that the actor does not. */
export function permissionsBeyond(actor: ReadonlySet<string>, role: RoleLike): string[] {
  return role.permissions.filter((permission) => !actor.has(permission))
}

export type GrantDecision = { ok: true } | { ok: false; code: 'grant_exceeds_permissions' | 'admin_role_requires_role_manage'; missing: string[] }

/**
 * May `actor` give someone this role (by invitation, role change, or by writing it)?
 * - Never more than the actor holds.
 * - An administrative role also needs `iam.role.manage`, so a person who may only invite cannot mint administrators.
 */
export function checkGrant(actor: ReadonlySet<string>, role: RoleLike): GrantDecision {
  const missing = permissionsBeyond(actor, role)
  if (missing.length > 0) return { ok: false, code: 'grant_exceeds_permissions', missing }
  if (isAdministrativeRole(role) && !actor.has(ROLE_MANAGE)) return { ok: false, code: 'admin_role_requires_role_manage', missing: [] }
  return { ok: true }
}

/** May `actor` change or remove a member who currently holds `current`? Administrators are managed only by administrators. */
export function mayManageCurrentRole(actor: ReadonlySet<string>, current: RoleLike): boolean {
  return !isAdministrativeRole(current) || actor.has(ROLE_MANAGE)
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked'
export type EffectiveInvitationStatus = InvitationStatus | 'expired'

/** There is no scheduler, so a pending invitation past its expiry reads as expired. */
export function effectiveInvitationStatus(status: InvitationStatus, expiresAt: Date, now: Date): EffectiveInvitationStatus {
  return status === 'pending' && expiresAt.getTime() <= now.getTime() ? 'expired' : status
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function invitationExpiry(now: Date, days: number): Date {
  return new Date(now.getTime() + days * 86_400_000)
}

/** A fresh random token (256 bits). It is shown once and never stored. */
export function generateInvitationToken(): string {
  return randomBytes(INVITATION_TOKEN_BYTES).toString('base64url')
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

/** The stored form of a token. */
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}
