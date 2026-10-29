import type { Queryable } from '@/lib/db'
import type { PermissionFlags } from '@/modules/admin/domain/access'
import type { ListActivityQuery } from '@/modules/admin/schemas/admin'

export type AccountRow = {
  userId: string
  email: string | null
  displayName: string
  role: string
  status: 'active' | 'suspended' | 'revoked' | 'deleted'
  branchScope: string | null
  flags: PermissionFlags
  version: number
}

export type ActivityRow = {
  id: string
  actorName: string
  actorRole: string
  actionType: string
  module: string
  entityType: string
  entityId: string
  descriptionAr: string
  metadata: { amountMinor?: number; currency?: string }
  createdAt: string
}

export type SecurityRow = {
  sessionMinutes: number
  booksLocked: boolean
  planCode: string
  planNameAr: string
  version: number
}

const accountSql = `
  select m.user_id as "userId", u.email, coalesce(nullif(p.display_name, ''), u.email, 'مستخدم') as "displayName",
         r.name as role, m.status, m.branch_scope as "branchScope", m.permission_flags as flags, m.version
  from tenant_members m
  join roles r on r.tenant_id = m.tenant_id and r.id = m.role_id
  join auth.users u on u.id = m.user_id
  left join profiles p on p.id = m.user_id`

export async function listAccounts(tx: Queryable, tenantId: string): Promise<AccountRow[]> {
  const result = await tx.query<AccountRow>(`${accountSql} where m.tenant_id = $1 order by m.created_at, m.user_id`, [tenantId])
  return result.rows
}

export async function findAccount(tx: Queryable, tenantId: string, userId: string): Promise<AccountRow | null> {
  const result = await tx.query<AccountRow>(`${accountSql} where m.tenant_id = $1 and m.user_id = $2`, [tenantId, userId])
  return result.rows[0] ?? null
}

export async function findRoleId(tx: Queryable, tenantId: string, name: string): Promise<string | null> {
  const result = await tx.query<{ id: string }>('select id from roles where tenant_id = $1 and name = $2', [tenantId, name])
  return result.rows[0]?.id ?? null
}

export async function countActiveOwners(tx: Queryable, tenantId: string, exceptUserId: string | null): Promise<number> {
  const result = await tx.query<{ n: number }>(
    `select count(*)::int as n
     from tenant_members m
     join roles r on r.tenant_id = m.tenant_id and r.id = m.role_id
     where m.tenant_id = $1 and m.status = 'active' and r.name = 'owner' and ($2::uuid is null or m.user_id <> $2)`,
    [tenantId, exceptUserId]
  )
  return result.rows[0].n
}

export async function findUserByEmail(tx: Queryable, email: string): Promise<string | null> {
  const result = await tx.query<{ id: string }>('select id from auth.users where lower(email) = $1', [email])
  return result.rows[0]?.id ?? null
}

const authDefaults = (id: string, email: string): Record<string, unknown> => ({
  id,
  instance_id: '00000000-0000-0000-0000-000000000000',
  aud: 'authenticated',
  role: 'authenticated',
  email,
  encrypted_password: '',
  email_confirmed_at: new Date().toISOString(),
  confirmation_token: '',
  recovery_token: '',
  email_change_token_new: '',
  email_change: '',
  email_change_token_current: '',
  reauthentication_token: '',
  phone: '',
  phone_change: '',
  phone_change_token: '',
  email_change_confirm_status: 0,
  is_sso_user: false,
  is_anonymous: false,
  raw_app_meta_data: { provider: 'email', providers: ['email'] },
  raw_user_meta_data: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

/** Inserts the auth row the hosted project requires. The local test database only needs id and email. */
export async function insertAuthUser(tx: Queryable, id: string, email: string): Promise<void> {
  const needed = await tx.query<{ column_name: string }>(
    `select column_name from information_schema.columns
     where table_schema = 'auth' and table_name = 'users' and is_nullable = 'NO' and column_default is null
     order by ordinal_position`
  )
  const known = authDefaults(id, email)
  const columns = ['id', 'email']
  const params: unknown[] = [id, email]
  for (const row of needed.rows) {
    if (columns.includes(row.column_name)) continue
    if (!(row.column_name in known)) throw new Error(`auth.users column ${row.column_name} has no default`)
    columns.push(row.column_name)
    params.push(known[row.column_name])
  }
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
  await tx.query(`insert into auth.users (${columns.join(', ')}) values (${placeholders})`, params)
  await tx.query(
    `insert into profiles (id, display_name) values ($1, '') on conflict (id) do nothing`,
    [id]
  )
}

export async function insertMember(
  tx: Queryable,
  input: { tenantId: string; userId: string; roleId: string; flags: PermissionFlags; branchScope: string | null; createdBy: string }
): Promise<void> {
  await tx.query(
    `insert into tenant_members (tenant_id, user_id, role_id, status, branch_scope, permission_flags, created_by)
     values ($1, $2, $3, 'active', $4, $5::jsonb, $6)`,
    [input.tenantId, input.userId, input.roleId, input.branchScope, JSON.stringify(input.flags), input.createdBy]
  )
}

export async function updateMember(
  tx: Queryable,
  input: { tenantId: string; userId: string; version: number; roleId: string; status: string; flags: PermissionFlags; branchScope: string | null }
): Promise<boolean> {
  const result = await tx.query(
    `update tenant_members
        set role_id = $4, status = $5, permission_flags = $6::jsonb, branch_scope = $7, version = version + 1
      where tenant_id = $1 and user_id = $2 and version = $3`,
    [input.tenantId, input.userId, input.version, input.roleId, input.status, JSON.stringify(input.flags), input.branchScope]
  )
  return (result.rowCount ?? 0) === 1
}

export async function setDisplayName(tx: Queryable, userId: string, displayName: string): Promise<void> {
  await tx.query(
    `insert into profiles (id, display_name) values ($1, $2)
     on conflict (id) do update set display_name = excluded.display_name`,
    [userId, displayName]
  )
}

export async function insertActivity(
  tx: Queryable,
  input: {
    tenantId: string
    actorId: string
    actorName: string
    actorRole: string
    actionType: string
    module: string
    entityType: string
    entityId: string
    descriptionAr: string
    metadata: Record<string, unknown>
    ipAddress: string | null
  }
): Promise<void> {
  await tx.query(
    `insert into audit_activity_logs (
       tenant_id, actor_id, actor_name, actor_role, action_type, module, entity_type, entity_id, description_ar, metadata_json, ip_address
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::inet)`,
    [
      input.tenantId,
      input.actorId,
      input.actorName,
      input.actorRole,
      input.actionType,
      input.module,
      input.entityType,
      input.entityId,
      input.descriptionAr,
      JSON.stringify(input.metadata),
      input.ipAddress,
    ]
  )
}

export async function listActivity(tx: Queryable, tenantId: string, query: ListActivityQuery): Promise<ActivityRow[]> {
  const needle = query.q ? query.q.replace(/[\\%_]/g, '') : null
  const result = await tx.query<ActivityRow>(
    `select id, actor_name as "actorName", actor_role as "actorRole", action_type as "actionType", module,
            entity_type as "entityType", entity_id as "entityId", description_ar as "descriptionAr",
            metadata_json as metadata, created_at as "createdAt"
     from audit_activity_logs
     where tenant_id = $1
       and ($2::text is null or module = $2)
       and ($3::text is null or description_ar ilike '%' || $3 || '%' or actor_name ilike '%' || $3 || '%')
       and ($4::timestamptz is null or created_at < $4::timestamptz)
     order by created_at desc, id desc
     limit $5`,
    [tenantId, query.module ?? null, needle && needle.length > 0 ? needle : null, query.before ?? null, query.limit]
  )
  return result.rows.map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
    metadata: {
      amountMinor: typeof row.metadata.amountMinor === 'number' ? row.metadata.amountMinor : Number(row.metadata.amountMinor ?? NaN),
      currency: row.metadata.currency,
    },
  })).map((row) => ({
    ...row,
    metadata: { ...row.metadata, amountMinor: Number.isSafeInteger(row.metadata.amountMinor) ? row.metadata.amountMinor : undefined },
  }))
}

export async function getSecurity(tx: Queryable, tenantId: string): Promise<SecurityRow | null> {
  const result = await tx.query<SecurityRow>(
    `select session_minutes as "sessionMinutes", books_locked as "booksLocked", plan_code as "planCode",
            plan_name_ar as "planNameAr", version
     from tenant_security_settings where tenant_id = $1`,
    [tenantId]
  )
  return result.rows[0] ?? null
}

export async function updateSecurity(tx: Queryable, tenantId: string, input: { version: number; sessionMinutes: number; booksLocked: boolean }): Promise<boolean> {
  const result = await tx.query(
    `update tenant_security_settings
        set session_minutes = $3, books_locked = $4, version = version + 1
      where tenant_id = $1 and version = $2`,
    [tenantId, input.version, input.sessionMinutes, input.booksLocked]
  )
  return (result.rowCount ?? 0) === 1
}
