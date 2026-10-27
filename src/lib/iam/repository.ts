import type { Page } from '@/lib/api/cursor'
import { keysetClauses, toPage } from '@/lib/api/keyset'
import type { Queryable } from '@/lib/db'
import type { EffectiveInvitationStatus, InvitationStatus } from '@/lib/iam/domain'
import type { ListInvitationsQuery, ListMembersQuery, ListRolesQuery, UpdateRoleInput } from '@/lib/iam/schemas'
import type { Invitation, Member, Role } from '@/lib/iam/types'

type Stamped<T, K extends string> = Omit<T, K> & { [P in K]: Date }
type MemberRow = Stamped<Member, 'createdAt'>
type RoleRow = Stamped<Stamped<Role, 'createdAt'>, 'updatedAt'>
type InvitationRow = Omit<Invitation, 'expiresAt' | 'acceptedAt' | 'revokedAt' | 'createdAt'> & {
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null)

function toMember(row: MemberRow): Member {
  return { ...row, createdAt: row.createdAt.toISOString() }
}
function toRole(row: RoleRow): Role {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }
}
function toInvitation(row: InvitationRow): Invitation {
  return {
    ...row,
    expiresAt: row.expiresAt.toISOString(),
    acceptedAt: iso(row.acceptedAt),
    revokedAt: iso(row.revokedAt),
    createdAt: row.createdAt.toISOString(),
  }
}

// ---- tenant ----

/** Serialises every membership or role change of one tenant, so two admins cannot both remove "the other" last admin. */
export async function lockTenant(tx: Queryable, tenantId: string): Promise<boolean> {
  const result = await tx.query<{ status: string }>('select status from tenants where id = $1 for update', [tenantId])
  return result.rows[0]?.status === 'active'
}

// ---- members ----

const MEMBER_SELECT = `select m.user_id as id, m.user_id as "userId", coalesce(p.display_name, '') as "displayName", u.email as email,
    m.role_id as "roleId", r.name as "roleName", m.created_at as "createdAt"
  from tenant_members m
  join roles r on r.tenant_id = m.tenant_id and r.id = m.role_id
  left join profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.tenant_id = $1`

export async function listMembers(tx: Queryable, tenantId: string, query: ListMembersQuery): Promise<Page<Member>> {
  const params: unknown[] = [tenantId]
  const keyset = keysetClauses({ sortKey: 'createdAt', column: { sql: '"createdAt"', cast: 'timestamptz' }, direction: 'asc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<MemberRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (${MEMBER_SELECT}) x where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'createdAt', 'asc')
  return { data: page.data.map(toMember), nextCursor: page.nextCursor }
}

export async function findMember(tx: Queryable, tenantId: string, userId: string): Promise<Member | null> {
  const result = await tx.query<MemberRow>(`${MEMBER_SELECT} and m.user_id = $2 for update of m`, [tenantId, userId])
  return result.rows[0] ? toMember(result.rows[0]) : null
}

export async function isEmailMember(tx: Queryable, tenantId: string, email: string): Promise<boolean> {
  const result = await tx.query(
    `select 1 from tenant_members m join auth.users u on u.id = m.user_id where m.tenant_id = $1 and lower(u.email) = $2`,
    [tenantId, email]
  )
  return result.rows.length > 0
}

export async function isMember(tx: Queryable, tenantId: string, userId: string): Promise<boolean> {
  const result = await tx.query('select 1 from tenant_members where tenant_id = $1 and user_id = $2', [tenantId, userId])
  return result.rows.length > 0
}

export async function insertMember(tx: Queryable, tenantId: string, userId: string, roleId: string, createdBy: string): Promise<void> {
  await tx.query('insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $4)', [tenantId, userId, roleId, createdBy])
}

export async function changeMemberRole(tx: Queryable, tenantId: string, userId: string, expectedRoleId: string, roleId: string): Promise<boolean> {
  const result = await tx.query('update tenant_members set role_id = $4 where tenant_id = $1 and user_id = $2 and role_id = $3', [tenantId, userId, expectedRoleId, roleId])
  return (result.rowCount ?? 0) > 0
}

export async function deleteMember(tx: Queryable, tenantId: string, userId: string, expectedRoleId: string): Promise<boolean> {
  const result = await tx.query('delete from tenant_members where tenant_id = $1 and user_id = $2 and role_id = $3', [tenantId, userId, expectedRoleId])
  return (result.rowCount ?? 0) > 0
}

/** Members whose role holds `permission`. */
export async function countHolders(tx: Queryable, tenantId: string, permission: string): Promise<number> {
  const result = await tx.query<{ n: number }>(
    `select count(*)::int as n from tenant_members m
     join role_permissions rp on rp.tenant_id = m.tenant_id and rp.role_id = m.role_id and rp.permission = $2
     where m.tenant_id = $1`,
    [tenantId, permission]
  )
  return result.rows[0].n
}

/** The permissions a member holds right now. Empty when they are not a member. */
export async function memberPermissions(tx: Queryable, tenantId: string, userId: string): Promise<Set<string>> {
  const result = await tx.query<{ permission: string }>(
    `select rp.permission from tenant_members m
     join role_permissions rp on rp.tenant_id = m.tenant_id and rp.role_id = m.role_id
     where m.tenant_id = $1 and m.user_id = $2`,
    [tenantId, userId]
  )
  return new Set(result.rows.map((row) => row.permission))
}

// ---- roles ----

const ROLE_COLUMNS = `r.id, r.name, r.description, r.is_system as "isSystem", r.version,
  coalesce((select array_agg(rp.permission order by rp.permission) from role_permissions rp where rp.tenant_id = r.tenant_id and rp.role_id = r.id), '{}') as permissions,
  (select count(*) from tenant_members m where m.tenant_id = r.tenant_id and m.role_id = r.id)::int as "memberCount",
  r.created_at as "createdAt", r.updated_at as "updatedAt"`

export async function listRoles(tx: Queryable, tenantId: string, query: ListRolesQuery): Promise<Page<Role>> {
  const params: unknown[] = [tenantId]
  const keyset = keysetClauses({ sortKey: 'name', column: { sql: 'name', cast: 'text' }, direction: 'asc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<RoleRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (select ${ROLE_COLUMNS} from roles r where r.tenant_id = $1) x
     where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'name', 'asc')
  return { data: page.data.map(toRole), nextCursor: page.nextCursor }
}

export async function findRole(tx: Queryable, tenantId: string, id: string, options: { lock: boolean } = { lock: false }): Promise<Role | null> {
  if (options.lock) {
    const locked = await tx.query('select id from roles where tenant_id = $1 and id = $2 for update', [tenantId, id])
    if (locked.rows.length === 0) return null
  }
  const result = await tx.query<RoleRow>(`select ${ROLE_COLUMNS} from roles r where r.tenant_id = $1 and r.id = $2`, [tenantId, id])
  return result.rows[0] ? toRole(result.rows[0]) : null
}

async function writePermissions(tx: Queryable, tenantId: string, roleId: string, userId: string, permissions: readonly string[]): Promise<void> {
  if (permissions.length === 0) return
  await tx.query(
    `insert into role_permissions (tenant_id, role_id, permission, created_by)
     select $1, $2, permission, $3 from unnest($4::text[]) as permission`,
    [tenantId, roleId, userId, permissions]
  )
}

export async function insertRole(
  tx: Queryable,
  tenantId: string,
  userId: string,
  input: { name: string; description: string; permissions: readonly string[] }
): Promise<string> {
  const result = await tx.query<{ id: string }>(
    `insert into roles (tenant_id, name, description, created_by) values ($1, $2, $3, $4) returning id`,
    [tenantId, input.name, input.description, userId]
  )
  await writePermissions(tx, tenantId, result.rows[0].id, userId, input.permissions)
  return result.rows[0].id
}

/** Replaces the role's permission set. The caller holds the row lock and has checked the version. */
export async function updateRole(tx: Queryable, tenantId: string, id: string, userId: string, input: UpdateRoleInput): Promise<boolean> {
  const result = await tx.query(
    `update roles set name = $4, description = $5, version = version + 1 where tenant_id = $1 and id = $2 and version = $3`,
    [tenantId, id, input.version, input.name, input.description]
  )
  if ((result.rowCount ?? 0) === 0) return false
  await tx.query('delete from role_permissions where tenant_id = $1 and role_id = $2', [tenantId, id])
  await writePermissions(tx, tenantId, id, userId, input.permissions)
  return true
}

// ---- invitations ----

const INVITATION_COLUMNS = `i.id, i.email, i.role_id as "roleId", r.name as "roleName",
  case when i.status = 'pending' and i.expires_at <= $NOW then 'expired' else i.status end as status,
  i.expires_at as "expiresAt", i.accepted_by as "acceptedBy", i.accepted_at as "acceptedAt", i.revoked_at as "revokedAt",
  i.version, i.created_at as "createdAt", i.created_by as "createdBy"`

const invitationColumns = (nowParam: number) => INVITATION_COLUMNS.replace('$NOW', `$${nowParam}::timestamptz`)

export async function listInvitations(tx: Queryable, tenantId: string, query: ListInvitationsQuery, now: Date): Promise<Page<Invitation>> {
  const params: unknown[] = [tenantId, now.toISOString()]
  const keyset = keysetClauses({ sortKey: 'createdAt', column: { sql: '"createdAt"', cast: 'timestamptz' }, direction: 'desc', cursor: query.cursor, params })
  let filter = ''
  if (query.status !== 'all') {
    params.push(query.status)
    filter = ` and status = $${params.length}`
  }
  params.push(query.limit + 1)
  const result = await tx.query<InvitationRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (
       select ${invitationColumns(2)} from tenant_invitations i join roles r on r.tenant_id = i.tenant_id and r.id = i.role_id where i.tenant_id = $1
     ) x where true${filter}${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'createdAt', 'desc')
  return { data: page.data.map(toInvitation), nextCursor: page.nextCursor }
}

export async function findInvitation(tx: Queryable, tenantId: string, id: string, now: Date, options: { lock: boolean } = { lock: false }): Promise<Invitation | null> {
  const result = await tx.query<InvitationRow>(
    `select ${invitationColumns(3)} from tenant_invitations i join roles r on r.tenant_id = i.tenant_id and r.id = i.role_id
     where i.tenant_id = $1 and i.id = $2${options.lock ? ' for update of i' : ''}`,
    [tenantId, id, now.toISOString()]
  )
  return result.rows[0] ? toInvitation(result.rows[0]) : null
}

export type InvitationForAccept = {
  id: string
  tenantId: string
  email: string
  roleId: string
  status: InvitationStatus
  expiresAt: Date
  createdBy: string
}

/** The token is the credential, so this is the one lookup that is not scoped by tenant. It locks the row. */
export async function findInvitationByTokenHash(tx: Queryable, tokenHash: string, lock: boolean): Promise<InvitationForAccept | null> {
  const result = await tx.query<InvitationForAccept>(
    `select id, tenant_id as "tenantId", email, role_id as "roleId", status, expires_at as "expiresAt", created_by as "createdBy"
     from tenant_invitations where token_hash = $1${lock ? ' for update' : ''}`,
    [tokenHash]
  )
  return result.rows[0] ?? null
}

export async function insertInvitation(
  tx: Queryable,
  tenantId: string,
  userId: string,
  input: { email: string; roleId: string; tokenHash: string; expiresAt: Date }
): Promise<string> {
  const result = await tx.query<{ id: string }>(
    `insert into tenant_invitations (tenant_id, email, role_id, token_hash, expires_at, created_by) values ($1, $2, $3, $4, $5, $6) returning id`,
    [tenantId, input.email, input.roleId, input.tokenHash, input.expiresAt.toISOString(), userId]
  )
  return result.rows[0].id
}

/** Pending invitations for this email that are past their expiry are closed, so a new invitation can be made. Returns their ids. */
export async function revokeExpiredFor(tx: Queryable, tenantId: string, email: string, now: Date): Promise<string[]> {
  const result = await tx.query<{ id: string }>(
    `update tenant_invitations set status = 'revoked', revoked_at = $4::timestamptz, version = version + 1
     where tenant_id = $1 and email = $2 and status = 'pending' and expires_at <= $3::timestamptz returning id`,
    [tenantId, email, now.toISOString(), now.toISOString()]
  )
  return result.rows.map((row) => row.id)
}

export async function revokeInvitation(tx: Queryable, tenantId: string, id: string, version: number, now: Date): Promise<boolean> {
  const result = await tx.query(
    `update tenant_invitations set status = 'revoked', revoked_at = $4::timestamptz, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'pending'`,
    [tenantId, id, version, now.toISOString()]
  )
  return (result.rowCount ?? 0) > 0
}

export async function markAccepted(tx: Queryable, id: string, userId: string, now: Date): Promise<void> {
  await tx.query(
    `update tenant_invitations set status = 'accepted', accepted_by = $2, accepted_at = $3::timestamptz, version = version + 1 where id = $1 and status = 'pending'`,
    [id, userId, now.toISOString()]
  )
}

export async function roleName(tx: Queryable, tenantId: string, roleId: string): Promise<string | null> {
  const result = await tx.query<{ name: string }>('select name from roles where tenant_id = $1 and id = $2', [tenantId, roleId])
  return result.rows[0]?.name ?? null
}

export type { EffectiveInvitationStatus }
