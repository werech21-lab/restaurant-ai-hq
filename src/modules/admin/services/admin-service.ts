import { randomUUID } from 'node:crypto'
import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { flagKeys, flagsForRole, type PermissionFlags } from '@/lib/auth/member-flags'
import { withTransaction, type Queryable } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import * as repository from '@/modules/admin/repositories/admin-repository'
import type { AccountRow, ActivityRow, SecurityRow } from '@/modules/admin/repositories/admin-repository'
import type { CreateAccountInput, ListActivityQuery, UpdateAccountInput, UpdateSecurityInput } from '@/modules/admin/schemas/admin'

function versionConflict(): AppError {
  return new AppError(409, 'version_conflict', 'This account was changed by someone else. Reload it and try again.')
}

function normalizeFlags(value: unknown, role: string): PermissionFlags {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const flags = flagsForRole(role)
  for (const key of flagKeys) {
    if (typeof source[key] === 'boolean') flags[key] = source[key]
  }
  return flags
}

async function actorLabel(tx: Parameters<typeof repository.findAccount>[0], auth: AuthContext): Promise<{ name: string; role: string }> {
  const actor = await repository.findAccount(tx, auth.tenantId, auth.userId)
  return { name: actor?.displayName ?? 'مستخدم', role: actor?.role ?? 'owner' }
}

async function record(
  tx: Parameters<typeof repository.insertActivity>[0],
  auth: AuthContext,
  input: { actionType: string; entityId: string; descriptionAr: string; metadata?: Record<string, unknown>; ipAddress: string | null }
): Promise<void> {
  const actor = await actorLabel(tx, auth)
  await repository.insertActivity(tx, {
    tenantId: auth.tenantId,
    actorId: auth.userId,
    actorName: actor.name,
    actorRole: actor.role,
    actionType: input.actionType,
    module: 'admin',
    entityType: 'tenant_member',
    entityId: input.entityId,
    descriptionAr: input.descriptionAr,
    metadata: input.metadata ?? {},
    ipAddress: input.ipAddress,
  })
}

function guardLastOwner(account: AccountRow, nextRole: string, nextStatus: string, otherOwners: number): void {
  const wasOwner = account.role === 'owner' && account.status === 'active'
  const staysOwner = nextRole === 'owner' && nextStatus === 'active'
  if (wasOwner && !staysOwner && otherOwners === 0) {
    throw new DomainError('invalid_transition', 'The last active owner cannot be suspended, revoked, deleted, or demoted.')
  }
}

export async function listAccounts(auth: AuthContext): Promise<{ data: AccountRow[] }> {
  const data = await withTransaction(async (tx) => {
    const rows = await repository.listAccounts(tx, auth.tenantId)
    return rows.map((row) => ({ ...row, flags: normalizeFlags(row.flags, row.role) }))
  })
  return { data }
}

export async function createAccount(auth: AuthContext, input: CreateAccountInput, ipAddress: string | null): Promise<{ data: AccountRow }> {
  const email = input.email.toLowerCase()
  const flags = input.flags ?? flagsForRole(input.role)
  return withTransaction(async (tx) => {
    const roleId = await repository.findRoleId(tx, auth.tenantId, input.role)
    if (!roleId) throw new DomainError('role_missing', 'That role is not available for this company.')
    let userId = await repository.findUserByEmail(tx, email)
    if (userId) {
      const existing = await repository.findAccount(tx, auth.tenantId, userId)
      if (existing) throw new AppError(409, 'account_exists', 'An account with this email already belongs to the company.')
    } else {
      userId = randomUUID()
      await repository.insertAuthUser(tx, userId, email)
    }
    await repository.setDisplayName(tx, userId, input.displayName)
    await repository.insertMember(tx, { tenantId: auth.tenantId, userId, roleId, flags, branchScope: input.branchScope ?? null, createdBy: auth.userId })
    await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'tenant_member', entityId: userId, action: 'create', before: null, after: { email, role: input.role, status: 'active', flags } })
    await record(tx, auth, { actionType: 'create', entityId: userId, descriptionAr: `إضافة حساب ${input.displayName}`, metadata: { role: input.role }, ipAddress })
    const created = await repository.findAccount(tx, auth.tenantId, userId)
    if (!created) throw new AppError(500, 'account_missing', 'The account could not be read back.')
    return { data: { ...created, flags: normalizeFlags(created.flags, created.role) } }
  })
}

export async function updateAccount(auth: AuthContext, userId: string, input: UpdateAccountInput, ipAddress: string | null): Promise<{ data: AccountRow }> {
  return withTransaction(async (tx) => {
    const current = await repository.findAccount(tx, auth.tenantId, userId)
    if (!current) throw new AppError(404, 'account_not_found', 'That account is not in this company.')
    if (current.status === 'deleted' && input.status && input.status !== 'deleted') {
      throw new DomainError('invalid_transition', 'A deleted account stays deleted.')
    }
    const nextRole = input.role ?? current.role
    const nextStatus = input.status ?? current.status
    const nextFlags = input.flags ?? normalizeFlags(current.flags, current.role)
    const branchScope = input.branchScope === undefined ? current.branchScope : input.branchScope
    const others = await repository.countActiveOwners(tx, auth.tenantId, userId)
    guardLastOwner(current, nextRole, nextStatus, others)
    const roleId = await repository.findRoleId(tx, auth.tenantId, nextRole)
    if (!roleId) throw new DomainError('role_missing', 'That role is not available for this company.')
    const saved = await repository.updateMember(tx, { tenantId: auth.tenantId, userId, version: input.version, roleId, status: nextStatus, flags: nextFlags, branchScope })
    if (!saved) throw versionConflict()
    await writeAudit(tx, {
      tenantId: auth.tenantId,
      actorId: auth.userId,
      entity: 'tenant_member',
      entityId: userId,
      action: 'update',
      before: { role: current.role, status: current.status, flags: normalizeFlags(current.flags, current.role) },
      after: { role: nextRole, status: nextStatus, flags: nextFlags },
    })
    const verb = nextStatus === 'suspended' ? 'إيقاف حساب' : nextStatus === 'deleted' ? 'حذف حساب' : nextStatus === 'revoked' ? 'إلغاء حساب' : 'تحديث حساب'
    await record(tx, auth, { actionType: nextStatus === current.status ? 'update' : nextStatus, entityId: userId, descriptionAr: `${verb} ${current.displayName}`, metadata: { role: nextRole, status: nextStatus }, ipAddress })
    const updated = await repository.findAccount(tx, auth.tenantId, userId)
    if (!updated) throw new AppError(500, 'account_missing', 'The account could not be read back.')
    return { data: { ...updated, flags: normalizeFlags(updated.flags, updated.role) } }
  })
}

export async function listActivity(auth: AuthContext, query: ListActivityQuery): Promise<{ data: ActivityRow[] }> {
  const data = await withTransaction((tx) => repository.listActivity(tx, auth.tenantId, query))
  return { data }
}

export async function getSecurity(auth: AuthContext): Promise<{ data: SecurityRow }> {
  const data = await withTransaction((tx) => repository.getSecurity(tx, auth.tenantId))
  if (!data) throw new AppError(404, 'security_not_found', 'Security settings are not ready for this company.')
  return { data }
}

export async function updateSecurity(auth: AuthContext, input: UpdateSecurityInput, ipAddress: string | null): Promise<{ data: SecurityRow }> {
  return withTransaction(async (tx) => {
    const before = await repository.getSecurity(tx, auth.tenantId)
    if (!before) throw new AppError(404, 'security_not_found', 'Security settings are not ready for this company.')
    const saved = await repository.updateSecurity(tx, auth.tenantId, input)
    if (!saved) throw versionConflict()
    await writeAudit(tx, {
      tenantId: auth.tenantId,
      actorId: auth.userId,
      entity: 'tenant_security_settings',
      entityId: auth.tenantId,
      action: 'update',
      before,
      after: { ...before, sessionMinutes: input.sessionMinutes, booksLocked: input.booksLocked, version: before.version + 1 },
    })
    await record(tx, auth, {
      actionType: 'update',
      entityId: auth.tenantId,
      descriptionAr: input.booksLocked ? 'قفل الدفاتر المحاسبية' : 'تحديث إعدادات الأمان',
      metadata: { sessionMinutes: input.sessionMinutes, booksLocked: input.booksLocked },
      ipAddress,
    })
    const data = await repository.getSecurity(tx, auth.tenantId)
    if (!data) throw new AppError(500, 'security_not_found', 'Security settings could not be read back.')
    return { data }
  })
}

export async function recordMovementWithin(
  tx: Queryable,
  auth: AuthContext,
  input: {
    module: 'hr' | 'operations'
    actionType: string
    entityType: string
    entityId: string
    descriptionAr: string
    amountMinor?: number
  },
): Promise<void> {
  const actor = await actorLabel(tx, auth)
  await repository.insertActivity(tx, {
    tenantId: auth.tenantId,
    actorId: auth.userId,
    actorName: actor.name,
    actorRole: actor.role,
    actionType: input.actionType,
    module: input.module,
    entityType: input.entityType,
    entityId: input.entityId,
    descriptionAr: input.descriptionAr,
    metadata: input.amountMinor === undefined ? {} : { amountMinor: input.amountMinor, currency: 'KWD' },
    ipAddress: null,
  })
}
