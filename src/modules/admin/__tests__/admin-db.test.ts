import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions } from '@/lib/auth/permissions'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import { createAccount, listAccounts, listActivity, updateAccount, updateSecurity } from '@/modules/admin'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

const pg = () => getPglite()

let auth: AuthContext

beforeAll(async () => {
  await startDatabase()
  const owner = randomUUID()
  await createUser(owner, 'owner@admin-test.invalid')
  auth = { userId: owner, tenantId: await bootstrapTenant('Admin Co', `admin-${owner.slice(0, 8)}`, owner), permissions: new Set(allPermissions) }
}, 180_000)
afterAll(stopDatabase)

describe('admin accounts and the activity log', () => {
  it('creates, suspends, updates permissions, and soft-deletes an account', async () => {
    const created = await createAccount(auth, { email: 'books@admin-test.invalid', displayName: 'Chief Accountant', role: 'accountant' }, null)
    expect(created.data.status).toBe('active')
    expect(created.data.flags.can_post_journal).toBe(true)
    expect(created.data.flags.can_manage_users).toBe(false)

    const suspended = await updateAccount(auth, created.data.userId, { version: created.data.version, status: 'suspended' }, null)
    expect(suspended.data.status).toBe('suspended')
    const active = await pg().query<{ n: number }>(
      `select count(*)::int as n from tenant_members where tenant_id = $1 and user_id = $2 and status = 'active'`,
      [auth.tenantId, created.data.userId]
    )
    expect(active.rows[0].n).toBe(0)

    const flagged = await updateAccount(auth, created.data.userId, {
      version: suspended.data.version,
      flags: { ...suspended.data.flags, can_post_journal: false, can_export_reports: true },
    }, null)
    expect(flagged.data.flags.can_post_journal).toBe(false)

    const removed = await updateAccount(auth, created.data.userId, { version: flagged.data.version, status: 'deleted' }, null)
    expect(removed.data.status).toBe('deleted')
    await expect(updateAccount(auth, created.data.userId, { version: removed.data.version, status: 'active' }, null)).rejects.toMatchObject({ code: 'invalid_transition' })

    const accounts = await listAccounts(auth)
    expect(accounts.data.some((row) => row.userId === created.data.userId && row.status === 'deleted')).toBe(true)
    const feed = await listActivity(auth, { limit: 20 })
    expect(feed.data.some((row) => row.module === 'admin' && row.descriptionAr.includes('Chief Accountant'))).toBe(true)
  }, 60_000)

  it('refuses to suspend the last active owner and locks posted journals', async () => {
    await expect(updateAccount(auth, auth.userId, { version: 1, status: 'suspended' }, null)).rejects.toMatchObject({ code: 'invalid_transition' })
    const security = await updateSecurity(auth, { version: 1, sessionMinutes: 90, booksLocked: true }, null)
    expect(security.data.booksLocked).toBe(true)
    expect(security.data.sessionMinutes).toBe(90)
    await expect(
      pg().query(
        `insert into journal_entries (tenant_id, number, entry_date, status, posted_at, posted_by, created_by)
         values ($1, 1, '2026-10-01', 'posted', now(), $2, $2)`,
        [auth.tenantId, auth.userId]
      )
    ).rejects.toThrow(/books_locked/)
  }, 60_000)
})
