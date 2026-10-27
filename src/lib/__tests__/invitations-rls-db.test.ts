import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'

/**
 * Row level security and grants on `tenant_invitations` (migration 0010), tested as the Supabase roles a browser holds.
 * The API connects as the table owner and is covered elsewhere. This is the second line: a user who talks to the database
 * directly can read their own company's invitations if allowed, never the token hash, and can write nothing.
 */

const pg = () => getPglite()

type Company = { tenantId: string; owner: string; invitationId: string; reader: string; noPermission: string }
let a: Company
let b: Company

async function asRole<T>(role: 'anon' | 'authenticated', uid: string | null, fn: () => Promise<T>): Promise<T> {
  await pg().exec(`select set_config('test.uid', '${uid ?? ''}', false); set role ${role}`)
  try {
    return await fn()
  } finally {
    await pg().exec(`reset role; select set_config('test.uid', '', false)`)
  }
}

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return 'ok'
  } catch (error) {
    return (error as Error).message
  }
}

async function memberWith(tenantId: string, ownerId: string, granted: string[]): Promise<string> {
  const userId = randomUUID()
  await createUser(userId)
  const role = await pg().query<{ id: string }>('insert into roles (tenant_id, name, created_by) values ($1, $2, $3) returning id', [tenantId, `r-${randomUUID()}`, ownerId])
  for (const permission of granted) {
    await pg().query('insert into role_permissions (tenant_id, role_id, permission, created_by) values ($1, $2, $3, $4)', [tenantId, role.rows[0].id, permission, ownerId])
  }
  await pg().query('insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $4)', [tenantId, userId, role.rows[0].id, ownerId])
  return userId
}

async function company(label: string): Promise<Company> {
  const owner = randomUUID()
  await createUser(owner)
  const tenantId = await bootstrapTenant(`Invites ${label}`, `invites-${label}`, owner)
  const viewer = await pg().query<{ id: string }>(`select id from roles where tenant_id = $1 and name = 'viewer'`, [tenantId])
  const invitation = await pg().query<{ id: string }>(
    `insert into tenant_invitations (tenant_id, email, role_id, token_hash, expires_at, created_by)
     values ($1, $2, $3, $4, now() + interval '7 days', $5) returning id`,
    [tenantId, `${label}@example.test`, viewer.rows[0].id, randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', ''), owner]
  )
  return {
    tenantId,
    owner,
    invitationId: invitation.rows[0].id,
    reader: await memberWith(tenantId, owner, ['iam.member.read']),
    noPermission: await memberWith(tenantId, owner, ['finance.invoice.read']),
  }
}

beforeAll(async () => {
  await startDatabase()
  await pg().exec(`create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$`)
  a = await company('a')
  b = await company('b')
}, 120_000)
afterAll(stopDatabase)

const safeColumns = 'id, tenant_id, email, role_id, status, expires_at, version'

describe('reading invitations as a database user', () => {
  it('shows a member who holds iam.member.read their own company\'s invitations and nobody else\'s', async () => {
    const rows = await asRole('authenticated', a.reader, async () => (await pg().query<{ id: string }>(`select id from tenant_invitations`)).rows)
    expect(rows.map((row) => row.id)).toEqual([a.invitationId])
    const ownerRows = await asRole('authenticated', a.owner, async () => (await pg().query<{ id: string }>(`select ${safeColumns} from tenant_invitations`)).rows)
    expect(ownerRows.map((row) => row.id)).toEqual([a.invitationId])
  })

  it('shows nothing to a member without that permission, to a stranger, and to the other company', async () => {
    const stranger = randomUUID()
    await createUser(stranger)
    for (const uid of [a.noPermission, stranger]) {
      const rows = await asRole('authenticated', uid, async () => (await pg().query(`select id from tenant_invitations where tenant_id = $1`, [a.tenantId])).rows)
      expect(rows).toEqual([])
    }
    const crossRows = await asRole('authenticated', b.owner, async () => (await pg().query(`select id from tenant_invitations where tenant_id = $1`, [a.tenantId])).rows)
    expect(crossRows).toEqual([])
  })

  it('never lets anyone read token_hash, not even an owner, and select * is refused', async () => {
    for (const uid of [a.owner, a.reader]) {
      expect(await asRole('authenticated', uid, () => failure(pg().query('select token_hash from tenant_invitations')))).toMatch(/permission denied/)
      expect(await asRole('authenticated', uid, () => failure(pg().query('select * from tenant_invitations')))).toMatch(/permission denied/)
      expect(await asRole('authenticated', uid, () => failure(pg().query(`select count(*) from tenant_invitations where token_hash like 'a%'`)))).toMatch(/permission denied/)
    }
  })

  it('is closed to anonymous callers', async () => {
    expect(await asRole('anon', null, () => failure(pg().query(`select ${safeColumns} from tenant_invitations`)))).toMatch(/permission denied/)
  })
})

describe('writing invitations as a database user', () => {
  it('refuses insert, update and delete to everyone, owners included', async () => {
    const viewer = await pg().query<{ id: string }>(`select id from roles where tenant_id = $1 and name = 'viewer'`, [a.tenantId])
    for (const uid of [a.owner, a.reader, b.owner]) {
      expect(
        await asRole('authenticated', uid, () =>
          failure(
            pg().query(
              `insert into tenant_invitations (tenant_id, email, role_id, token_hash, expires_at, created_by) values ($1, 'x@example.test', $2, $3, now() + interval '1 day', $4)`,
              [a.tenantId, viewer.rows[0].id, 'f'.repeat(64), uid]
            )
          )
        )
      ).toMatch(/permission denied/)
      expect(await asRole('authenticated', uid, () => failure(pg().query(`update tenant_invitations set status = 'accepted'`)))).toMatch(/permission denied/)
      expect(await asRole('authenticated', uid, () => failure(pg().query(`delete from tenant_invitations`)))).toMatch(/permission denied/)
    }
    const status = await pg().query<{ status: string }>('select status from tenant_invitations where id = $1', [a.invitationId])
    expect(status.rows[0].status).toBe('pending')
  })
})

describe('the table itself', () => {
  it('refuses a delete even from the owner role, and refuses an invitation that points at another company\'s role', async () => {
    expect(await failure(pg().query('delete from tenant_invitations where id = $1', [a.invitationId]))).toMatch(/cannot be deleted|delete/i)
    const foreignRole = await pg().query<{ id: string }>(`select id from roles where tenant_id = $1 and name = 'viewer'`, [b.tenantId])
    expect(
      await failure(
        pg().query(
          `insert into tenant_invitations (tenant_id, email, role_id, token_hash, expires_at, created_by) values ($1, 'cross@example.test', $2, $3, now() + interval '1 day', $4)`,
          [a.tenantId, foreignRole.rows[0].id, 'e'.repeat(64), a.owner]
        )
      )
    ).toMatch(/foreign key|violates/i)
  })

  it('refuses a token hash that is not 64 hex characters, an upper-case email, and a duplicate hash', async () => {
    const viewer = await pg().query<{ id: string }>(`select id from roles where tenant_id = $1 and name = 'viewer'`, [a.tenantId])
    const insert = (email: string, hash: string) =>
      failure(
        pg().query(
          `insert into tenant_invitations (tenant_id, email, role_id, token_hash, expires_at, created_by) values ($1, $2, $3, $4, now() + interval '1 day', $5)`,
          [a.tenantId, email, viewer.rows[0].id, hash, a.owner]
        )
      )
    expect(await insert('ok1@example.test', 'short')).toMatch(/check|violates/i)
    expect(await insert('Upper@Example.test', 'd'.repeat(64))).toMatch(/check|violates/i)
    expect(await insert('ok2@example.test', 'c'.repeat(64))).toBe('ok')
    expect(await insert('ok3@example.test', 'c'.repeat(64))).toMatch(/unique|duplicate/i)
  })
})
