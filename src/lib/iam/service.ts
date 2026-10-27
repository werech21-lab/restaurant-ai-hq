import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext, SessionUser } from '@/lib/auth/context'
import { permissions, type Permission } from '@/lib/auth/permissions'
import { db, withTransaction, type Queryable } from '@/lib/db'
import {
  DEFAULT_INVITATION_DAYS,
  ROLE_MANAGE,
  checkGrant,
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  mayManageCurrentRole,
  normalizeEmail,
  permissionsBeyond,
  type RoleLike,
} from '@/lib/iam/domain'
import { publishIamEvents, stamp, type IamEvent } from '@/lib/iam/events'
import * as repository from '@/lib/iam/repository'
import type {
  AcceptInvitationInput,
  ChangeMemberRoleInput,
  CreateInvitationInput,
  CreateRoleInput,
  ListInvitationsQuery,
  ListMembersQuery,
  ListRolesQuery,
  RemoveMemberQuery,
  RevokeInvitationInput,
  UpdateRoleInput,
} from '@/lib/iam/schemas'
import type { AcceptedInvitation, CreatedInvitation, Invitation, Member, Role } from '@/lib/iam/types'

function requirePermission(auth: AuthContext, permission: Permission): void {
  if (!auth.permissions.has(permission)) throw new AppError(403, 'forbidden', 'You do not have permission for this action.')
}

const versionConflict = () => new AppError(409, 'version_conflict', 'This record was changed by someone else. Reload it and try again.')
const invalidInvitation = () => new AppError(404, 'invitation_invalid', 'This invitation is not valid.')

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === '23505'
}

/** Refuses a role the actor may not hand out: more than they hold, or administrative without `iam.role.manage`. */
function assertGrantable(auth: AuthContext, role: RoleLike): void {
  const decision = checkGrant(auth.permissions, role)
  if (decision.ok) return
  if (decision.code === 'grant_exceeds_permissions') {
    throw new AppError(403, decision.code, 'That role holds permissions you do not hold yourself.', { missing: decision.missing })
  }
  throw new AppError(403, decision.code, 'Only someone who can manage roles may hand out an administrative role.')
}

async function lockActiveTenant(tx: Queryable, tenantId: string): Promise<void> {
  if (!(await repository.lockTenant(tx, tenantId))) throw new AppError(403, 'tenant_suspended', 'This company is suspended.')
}

/** The tenant must always keep someone who can manage roles, otherwise nobody could ever fix it. */
async function assertAdminRemains(tx: Queryable, tenantId: string): Promise<void> {
  if ((await repository.countHolders(tx, tenantId, ROLE_MANAGE)) < 1) {
    throw new AppError(409, 'last_admin', 'This would leave the company without anyone who can manage roles.')
  }
}

async function audit(
  tx: Queryable,
  tenantId: string,
  actorId: string,
  entity: 'invitation' | 'member' | 'role',
  entityId: string,
  action: 'create' | 'update' | 'delete',
  before: unknown,
  after: unknown
): Promise<void> {
  await writeAudit(tx, { tenantId, actorId, entity, entityId, action, before, after })
}

// ---- reads ----

export async function listMembers(auth: AuthContext, query: ListMembersQuery): Promise<Page<Member>> {
  requirePermission(auth, permissions.iamMemberRead)
  return repository.listMembers(db, auth.tenantId, query)
}

export async function listRoles(auth: AuthContext, query: ListRolesQuery): Promise<Page<Role>> {
  requirePermission(auth, permissions.iamRoleRead)
  return repository.listRoles(db, auth.tenantId, query)
}

export async function listInvitations(auth: AuthContext, query: ListInvitationsQuery, now: Date = new Date()): Promise<Page<Invitation>> {
  requirePermission(auth, permissions.iamMemberRead)
  return repository.listInvitations(db, auth.tenantId, query, now)
}

// ---- invitations ----

/**
 * Creates an invitation for an email, with an explicit role. The token is returned here and nowhere else: only its hash is
 * stored. Nothing is sent. The inviter hands the link over.
 */
export async function createInvitation(auth: AuthContext, input: CreateInvitationInput, now: Date = new Date()): Promise<CreatedInvitation> {
  requirePermission(auth, permissions.iamMemberInvite)
  const events: IamEvent[] = []
  const token = generateInvitationToken()
  const invitation = await withTransaction(async (tx) => {
    await lockActiveTenant(tx, auth.tenantId)
    const role = await repository.findRole(tx, auth.tenantId, input.roleId)
    if (!role) throw new AppError(404, 'role_not_found', 'The role was not found.')
    assertGrantable(auth, role)
    if (await repository.isEmailMember(tx, auth.tenantId, input.email)) {
      throw new AppError(409, 'already_member', 'This person is already a member of the company.')
    }
    for (const closedId of await repository.revokeExpiredFor(tx, auth.tenantId, input.email, now)) {
      await audit(tx, auth.tenantId, auth.userId, 'invitation', closedId, 'update', { status: 'pending' }, { status: 'revoked', reason: 'expired' })
    }
    const expiresAt = invitationExpiry(now, input.expiresInDays ?? DEFAULT_INVITATION_DAYS)
    let id: string
    try {
      id = await repository.insertInvitation(tx, auth.tenantId, auth.userId, { email: input.email, roleId: role.id, tokenHash: hashInvitationToken(token), expiresAt })
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, 'invitation_pending', 'There is already an open invitation for this email.')
      throw error
    }
    const created = await repository.findInvitation(tx, auth.tenantId, id, now)
    if (!created) throw new AppError(500, 'internal_error', 'The invitation could not be read back.')
    await audit(tx, auth.tenantId, auth.userId, 'invitation', id, 'create', null, created)
    events.push({
      ...stamp(auth.tenantId),
      name: 'iam.invitation.created',
      payload: { invitationId: id, roleId: role.id, createdBy: auth.userId, expiresAt: created.expiresAt },
    })
    return created
  })
  await publishIamEvents(events)
  return { invitation, token }
}

export async function revokeInvitation(auth: AuthContext, id: string, input: RevokeInvitationInput, now: Date = new Date()): Promise<Invitation> {
  requirePermission(auth, permissions.iamMemberInvite)
  const events: IamEvent[] = []
  const revoked = await withTransaction(async (tx) => {
    const before = await repository.findInvitation(tx, auth.tenantId, id, now, { lock: true })
    if (!before) throw new AppError(404, 'invitation_not_found', 'The invitation was not found.')
    if (before.version !== input.version) throw versionConflict()
    if (before.status !== 'pending') throw new AppError(409, 'invitation_not_pending', `The invitation is already ${before.status}.`)
    if (!(await repository.revokeInvitation(tx, auth.tenantId, id, input.version, now))) throw versionConflict()
    const after = await repository.findInvitation(tx, auth.tenantId, id, now)
    if (!after) throw new AppError(500, 'internal_error', 'The invitation could not be read back.')
    await audit(tx, auth.tenantId, auth.userId, 'invitation', id, 'update', before, after)
    events.push({ ...stamp(auth.tenantId), name: 'iam.invitation.revoked', payload: { invitationId: id, revokedBy: auth.userId } })
    return after
  })
  await publishIamEvents(events)
  return revoked
}

/**
 * The invited person accepts with the token. Needs a signed-in user whose confirmed email matches. Every way it can fail
 * (unknown token, wrong email, used, revoked, expired, suspended company, inviter no longer allowed to grant the role)
 * answers the same 404, so a guesser learns nothing.
 */
export async function acceptInvitation(session: SessionUser, input: AcceptInvitationInput, now: Date = new Date()): Promise<AcceptedInvitation> {
  if (!session.email || !session.emailConfirmed) {
    throw new AppError(403, 'email_unconfirmed', 'Confirm your email address before accepting an invitation.')
  }
  const email = normalizeEmail(session.email)
  const tokenHash = hashInvitationToken(input.token)
  const events: IamEvent[] = []
  const accepted = await withTransaction(async (tx): Promise<AcceptedInvitation> => {
    // Lock order is tenant, then invitation, the same as every other writer.
    const peek = await repository.findInvitationByTokenHash(tx, tokenHash, false)
    if (!peek) throw invalidInvitation()
    if (!(await repository.lockTenant(tx, peek.tenantId))) throw invalidInvitation()
    const invitation = await repository.findInvitationByTokenHash(tx, tokenHash, true)
    if (!invitation || invitation.status !== 'pending' || invitation.expiresAt.getTime() <= now.getTime() || invitation.email !== email) {
      throw invalidInvitation()
    }
    const role = await repository.findRole(tx, invitation.tenantId, invitation.roleId)
    if (!role) throw invalidInvitation()
    // The request is only as good as the person who made it was when they made it, and still is.
    if (!(await repository.isMember(tx, invitation.tenantId, invitation.createdBy))) throw invalidInvitation()
    const inviterPermissions = await repository.memberPermissions(tx, invitation.tenantId, invitation.createdBy)
    if (!checkGrant(inviterPermissions, role).ok) throw invalidInvitation()
    if (await repository.isMember(tx, invitation.tenantId, session.userId)) {
      throw new AppError(409, 'already_member', 'You are already a member of this company.')
    }
    await repository.insertMember(tx, invitation.tenantId, session.userId, role.id, invitation.createdBy)
    await repository.markAccepted(tx, invitation.id, session.userId, now)
    await audit(tx, invitation.tenantId, session.userId, 'invitation', invitation.id, 'update', { status: 'pending' }, { status: 'accepted', acceptedBy: session.userId })
    await audit(tx, invitation.tenantId, session.userId, 'member', session.userId, 'create', null, { userId: session.userId, roleId: role.id, via: 'invitation' })
    events.push({
      ...stamp(invitation.tenantId),
      name: 'iam.invitation.accepted',
      payload: { invitationId: invitation.id, userId: session.userId, roleId: role.id },
    })
    return { tenantId: invitation.tenantId, roleId: role.id, roleName: role.name }
  })
  await publishIamEvents(events)
  return accepted
}

// ---- members ----

export async function changeMemberRole(auth: AuthContext, userId: string, input: ChangeMemberRoleInput): Promise<Member> {
  requirePermission(auth, permissions.iamMemberUpdate)
  if (userId === auth.userId) throw new AppError(403, 'cannot_change_own_role', 'You cannot change your own role.')
  const events: IamEvent[] = []
  const member = await withTransaction(async (tx) => {
    await lockActiveTenant(tx, auth.tenantId)
    const before = await repository.findMember(tx, auth.tenantId, userId)
    if (!before) throw new AppError(404, 'member_not_found', 'The member was not found.')
    if (before.roleId !== input.expectedRoleId) throw versionConflict()
    const current = await repository.findRole(tx, auth.tenantId, before.roleId)
    if (!current) throw new AppError(500, 'internal_error', 'The current role is missing.')
    if (!mayManageCurrentRole(auth.permissions, current)) {
      throw new AppError(403, 'admin_member_requires_role_manage', 'Only someone who can manage roles may change an administrator.')
    }
    if (input.roleId === before.roleId) throw new AppError(422, 'role_unchanged', 'The member already has this role.')
    const next = await repository.findRole(tx, auth.tenantId, input.roleId)
    if (!next) throw new AppError(404, 'role_not_found', 'The role was not found.')
    assertGrantable(auth, next)
    if (!(await repository.changeMemberRole(tx, auth.tenantId, userId, before.roleId, next.id))) throw versionConflict()
    await assertAdminRemains(tx, auth.tenantId)
    const after = await repository.findMember(tx, auth.tenantId, userId)
    if (!after) throw new AppError(500, 'internal_error', 'The member could not be read back.')
    await audit(tx, auth.tenantId, auth.userId, 'member', userId, 'update', before, after)
    events.push({
      ...stamp(auth.tenantId),
      name: 'iam.member.role_changed',
      payload: { userId, fromRoleId: before.roleId, toRoleId: next.id, changedBy: auth.userId },
    })
    return after
  })
  await publishIamEvents(events)
  return member
}

export async function removeMember(auth: AuthContext, userId: string, query: RemoveMemberQuery): Promise<void> {
  requirePermission(auth, permissions.iamMemberRemove)
  if (userId === auth.userId) throw new AppError(403, 'cannot_remove_self', 'You cannot remove yourself.')
  const events: IamEvent[] = []
  await withTransaction(async (tx) => {
    await lockActiveTenant(tx, auth.tenantId)
    const before = await repository.findMember(tx, auth.tenantId, userId)
    if (!before) throw new AppError(404, 'member_not_found', 'The member was not found.')
    if (before.roleId !== query.expectedRoleId) throw versionConflict()
    const current = await repository.findRole(tx, auth.tenantId, before.roleId)
    if (!current) throw new AppError(500, 'internal_error', 'The current role is missing.')
    if (!mayManageCurrentRole(auth.permissions, current)) {
      throw new AppError(403, 'admin_member_requires_role_manage', 'Only someone who can manage roles may remove an administrator.')
    }
    if (!(await repository.deleteMember(tx, auth.tenantId, userId, before.roleId))) throw versionConflict()
    await assertAdminRemains(tx, auth.tenantId)
    await audit(tx, auth.tenantId, auth.userId, 'member', userId, 'delete', before, null)
    events.push({ ...stamp(auth.tenantId), name: 'iam.member.removed', payload: { userId, roleId: before.roleId, removedBy: auth.userId } })
  })
  await publishIamEvents(events)
}

// ---- roles ----

export async function createRole(auth: AuthContext, input: CreateRoleInput): Promise<Role> {
  requirePermission(auth, permissions.iamRoleManage)
  const events: IamEvent[] = []
  const role = await withTransaction(async (tx) => {
    await lockActiveTenant(tx, auth.tenantId)
    assertGrantable(auth, input)
    let id: string
    try {
      id = await repository.insertRole(tx, auth.tenantId, auth.userId, input)
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, 'role_exists', `A role named ${input.name} already exists.`)
      throw error
    }
    const created = await repository.findRole(tx, auth.tenantId, id)
    if (!created) throw new AppError(500, 'internal_error', 'The role could not be read back.')
    await audit(tx, auth.tenantId, auth.userId, 'role', id, 'create', null, created)
    events.push({ ...stamp(auth.tenantId), name: 'iam.role.created', payload: { roleId: id, createdBy: auth.userId, permissionCount: created.permissions.length } })
    return created
  })
  await publishIamEvents(events)
  return role
}

export async function updateRole(auth: AuthContext, id: string, input: UpdateRoleInput): Promise<Role> {
  requirePermission(auth, permissions.iamRoleManage)
  const events: IamEvent[] = []
  const role = await withTransaction(async (tx) => {
    await lockActiveTenant(tx, auth.tenantId)
    const before = await repository.findRole(tx, auth.tenantId, id, { lock: true })
    if (!before) throw new AppError(404, 'role_not_found', 'The role was not found.')
    if (before.isSystem) throw new AppError(403, 'system_role_locked', 'Built-in roles cannot be edited. Create a custom role instead.')
    if (before.version !== input.version) throw versionConflict()
    // You may only edit a role that is no more powerful than you, and only make it no more powerful than you.
    const above = permissionsBeyond(auth.permissions, before)
    if (above.length > 0) throw new AppError(403, 'grant_exceeds_permissions', 'That role holds permissions you do not hold yourself.', { missing: above })
    assertGrantable(auth, input)
    let changed: boolean
    try {
      changed = await repository.updateRole(tx, auth.tenantId, id, auth.userId, input)
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, 'role_exists', `A role named ${input.name} already exists.`)
      throw error
    }
    if (!changed) throw versionConflict()
    await assertAdminRemains(tx, auth.tenantId)
    const after = await repository.findRole(tx, auth.tenantId, id)
    if (!after) throw new AppError(500, 'internal_error', 'The role could not be read back.')
    await audit(tx, auth.tenantId, auth.userId, 'role', id, 'update', before, after)
    events.push({ ...stamp(auth.tenantId), name: 'iam.role.updated', payload: { roleId: id, updatedBy: auth.userId, permissionCount: after.permissions.length } })
    return after
  })
  await publishIamEvents(events)
  return role
}
