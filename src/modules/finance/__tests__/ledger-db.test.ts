import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions } from '@/lib/auth/permissions'
import { subscribe, type BusEvent } from '@/lib/events/bus'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

import {
  closePeriod,
  createAccount,
  createJournalEntry,
  createPeriod,
  getJournalEntry,
  getTrialBalance,
  listAccounts,
  listJournalEntries,
  listPeriods,
  postJournalEntry,
  reverseJournalEntry,
  updateAccount,
  updateJournalEntry,
} from '@/modules/finance'
import type { Account, JournalEntryDetail } from '@/modules/finance/client'

/** The general ledger against the real migrations: balance, immutability, reversal, periods, permissions, isolation and audit. */

const pg = () => getPglite()
let a: AuthContext
let b: AuthContext
let cash: Account
let payable: Account
let revenue: Account
let header: Account
let bCash: Account
let bRevenue: Account
const events: BusEvent[] = []

function only(auth: AuthContext, ...granted: string[]): AuthContext {
  return { ...auth, permissions: new Set(granted) }
}

async function outcome(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return 'ok'
  } catch (error) {
    const typed = error as { status?: number; code?: string; name?: string }
    if (typed.status) return `${typed.status}:${typed.code}`
    if (typed.code) return typed.code
    return `${typed.name}:${(error as Error).message}`
  }
}

async function sqlFailure(sql: string, params: unknown[] = []): Promise<string> {
  try {
    await pg().query(sql, params)
    return 'ok'
  } catch (error) {
    return (error as Error).message
  }
}

let keyCounter = 0
const nextKey = () => `ledger-key-${String(++keyCounter).padStart(6, '0')}`

function lines(...pairs: Array<[Account, number, number]>) {
  return pairs.map(([account, debitMinor, creditMinor]) => ({ accountId: account.id, debitMinor, creditMinor, description: '' }))
}

async function draft(auth: AuthContext, entryDate: string, amount: number, memo = 'sale'): Promise<JournalEntryDetail> {
  const outcome = await createJournalEntry(auth, nextKey(), {
    entryDate,
    memo,
    currency: 'KWD',
    lines: lines([cash, amount, 0], [revenue, 0, amount]),
  })
  return outcome.body.data
}

async function posted(auth: AuthContext, entryDate: string, amount: number): Promise<JournalEntryDetail> {
  const created = await draft(auth, entryDate, amount)
  return (await postJournalEntry(auth, created.id, { version: created.version })).data
}

beforeAll(async () => {
  await startDatabase()
  for (const name of [
    'finance.account.created',
    'finance.account.updated',
    'finance.period.created',
    'finance.period.closed',
    'finance.journal.created',
    'finance.journal.posted',
    'finance.journal.reversed',
  ]) {
    subscribe(name, (event) => void events.push(event))
  }
  const ownerA = randomUUID()
  const ownerB = randomUUID()
  await createUser(ownerA)
  await createUser(ownerB)
  a = { userId: ownerA, tenantId: await bootstrapTenant('Ledger A', 'ledger-a', ownerA), permissions: new Set<string>(allPermissions) }
  b = { userId: ownerB, tenantId: await bootstrapTenant('Ledger B', 'ledger-b', ownerB), permissions: new Set<string>(allPermissions) }

  header = (await createAccount(a, { code: '1', name: 'Assets', type: 'asset', parentId: null, isPostable: false })).data
  cash = (await createAccount(a, { code: '1000', name: 'Cash', type: 'asset', parentId: header.id, isPostable: true })).data
  payable = (await createAccount(a, { code: '2000', name: 'Payables', type: 'liability', parentId: null, isPostable: true })).data
  revenue = (await createAccount(a, { code: '4000', name: 'Revenue', type: 'revenue', parentId: null, isPostable: true })).data
  bCash = (await createAccount(b, { code: '1000', name: 'Cash', type: 'asset', parentId: null, isPostable: true })).data
  bRevenue = (await createAccount(b, { code: '4000', name: 'Revenue', type: 'revenue', parentId: null, isPostable: true })).data

  await createPeriod(a, { name: 'FY2025', startsOn: '2025-01-01', endsOn: '2025-12-31' })
  await createPeriod(a, { name: 'FY2026', startsOn: '2026-01-01', endsOn: '2026-12-31' })
  await createPeriod(b, { name: 'FY2026', startsOn: '2026-01-01', endsOn: '2026-12-31' })
}, 120_000)
afterAll(stopDatabase)

describe('accounts', () => {
  it('creates, audits and announces an account, and keeps its code per company', async () => {
    const audit = await pg().query<{ action: string; before: unknown }>(`select action, before from audit_log where entity = 'account' and entity_id = $1`, [cash.id])
    expect(audit.rows).toEqual([{ action: 'create', before: null }])
    expect(events.map((event) => event.name)).toContain('finance.account.created')
    expect(bCash.code).toBe(cash.code)
    expect(await outcome(createAccount(a, { code: '1000', name: 'Again', type: 'asset', parentId: null, isPostable: true }))).toBe('409:account_code_exists')
  })

  it('enforces the parent rules in code and in the database', async () => {
    expect(await outcome(createAccount(a, { code: '1100', name: 'Under a postable parent', type: 'asset', parentId: cash.id, isPostable: true }))).toBe('422:parent_not_header')
    expect(await outcome(createAccount(a, { code: '1200', name: 'Wrong type', type: 'expense', parentId: header.id, isPostable: true }))).toBe('422:parent_type_mismatch')
    const direct = await sqlFailure(
      `insert into accounts (tenant_id, code, name, type, parent_id, is_postable, created_by) values ($1, '1300', 'x', 'expense', $2, true, $3)`,
      [a.tenantId, header.id, a.userId]
    )
    expect(direct).toContain('same type as its parent')
  })

  it('never changes code, type or parent, and refuses a stale version', async () => {
    expect(await sqlFailure(`update accounts set code = 'ZZZ' where id = $1`, [payable.id])).toContain('cannot change')
    expect(await sqlFailure(`update accounts set type = 'asset' where id = $1`, [payable.id])).toContain('cannot change')
    expect(await outcome(updateAccount(a, payable.id, { version: 9, name: 'X', isActive: true }))).toBe('409:version_conflict')
    const updated = await updateAccount(a, payable.id, { version: 1, name: 'Trade payables', isActive: true })
    expect(updated.data).toMatchObject({ name: 'Trade payables', code: '2000', version: 2 })
  })

  it('refuses to retire a header that still has active children, and a line on an inactive account', async () => {
    expect(await outcome(updateAccount(a, header.id, { version: 1, name: 'Assets', isActive: false }))).toBe('409:account_has_active_children')
    const spare = (await createAccount(a, { code: '9000', name: 'Spare', type: 'expense', parentId: null, isPostable: true })).data
    await updateAccount(a, spare.id, { version: 1, name: 'Spare', isActive: false })
    expect(
      await outcome(createJournalEntry(a, nextKey(), { entryDate: '2026-02-01', memo: '', currency: 'KWD', lines: lines([spare, 100, 0], [revenue, 0, 100]) }))
    ).toBe('422:account_not_postable')
  })

  it('refuses a line on a header account', async () => {
    expect(
      await outcome(createJournalEntry(a, nextKey(), { entryDate: '2026-02-01', memo: '', currency: 'KWD', lines: lines([header, 100, 0], [revenue, 0, 100]) }))
    ).toBe('422:account_not_postable')
  })

  it('lists with a cursor and filters by type', async () => {
    const first = await listAccounts(a, { limit: 2, status: 'all' })
    expect(first.data).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()
    const second = await listAccounts(a, { limit: 2, status: 'all', cursor: first.nextCursor ?? undefined })
    expect(second.data[0].code > first.data[1].code).toBe(true)
    const liabilities = await listAccounts(a, { limit: 50, status: 'all', type: 'liability' })
    expect(liabilities.data.map((account) => account.code)).toEqual(['2000'])
  })
})

describe('fiscal periods', () => {
  it('refuses overlapping periods in code and in the database', async () => {
    expect(await outcome(createPeriod(a, { name: 'Overlap', startsOn: '2026-06-01', endsOn: '2027-05-31' }))).toBe('409:period_overlaps')
    const direct = await sqlFailure(`insert into fiscal_periods (tenant_id, name, starts_on, ends_on, created_by) values ($1, 'Sneaky', '2026-12-31', '2027-01-31', $2)`, [a.tenantId, a.userId])
    expect(direct).toContain('cannot overlap')
  })

  it('allows the same range in another company', async () => {
    expect((await listPeriods(b, { limit: 10, status: 'all' })).data.map((period) => period.name)).toEqual(['FY2026'])
  })

  it('never changes the dates of a period', async () => {
    const [period] = (await listPeriods(a, { limit: 10, status: 'open' })).data
    expect(await sqlFailure(`update fiscal_periods set ends_on = '2030-01-01' where id = $1`, [period.id])).toContain('dates')
  })
})

describe('journal entries', () => {
  it('creates a draft with a company number, an audit row and an event, and reads it back with its lines', async () => {
    const entry = await draft(a, '2026-02-10', 12_500)
    expect(entry).toMatchObject({ status: 'draft', currency: 'KWD', sourceType: 'manual', lineCount: 2, totalDebitMinor: 12_500, totalCreditMinor: 12_500, version: 1 })
    expect(entry.lines.map((line) => line.accountCode)).toEqual(['1000', '4000'])
    const next = await draft(a, '2026-02-11', 100)
    expect(next.number).toBe(entry.number + 1)
    const audit = await pg().query<{ action: string }>(`select action from audit_log where entity = 'journal_entry' and entity_id = $1`, [entry.id])
    expect(audit.rows).toEqual([{ action: 'create' }])
    expect(events.map((event) => event.name)).toContain('finance.journal.created')
    expect((await getJournalEntry(a, entry.id)).data.lines).toHaveLength(2)
  })

  it('numbers independently per company', async () => {
    const first = await createJournalEntry(b, nextKey(), { entryDate: '2026-02-10', memo: '', currency: 'KWD', lines: lines([bCash, 50, 0], [bRevenue, 0, 50]) })
    expect(first.body.data.number).toBe(1)
  })

  it('replays an idempotent create and refuses the same key with a different body', async () => {
    const key = nextKey()
    const body = { entryDate: '2026-02-12', memo: 'once', currency: 'KWD' as const, lines: lines([cash, 700, 0], [revenue, 0, 700]) }
    const before = (await pg().query<{ n: number }>(`select count(*)::int as n from journal_entries where tenant_id = $1`, [a.tenantId])).rows[0].n
    const first = await createJournalEntry(a, key, body)
    const again = await createJournalEntry(a, key, body)
    expect(again.replayed).toBe(true)
    expect(again.body.data.id).toBe(first.body.data.id)
    const after = (await pg().query<{ n: number }>(`select count(*)::int as n from journal_entries where tenant_id = $1`, [a.tenantId])).rows[0].n
    expect(after).toBe(before + 1)
    expect(await outcome(createJournalEntry(a, key, { ...body, memo: 'different' }))).toBe('422:idempotency_key_reused')
  })

  it('refuses a currency other than KWD', async () => {
    const result = await outcome(createJournalEntry(a, nextKey(), { entryDate: '2026-02-12', memo: '', currency: 'USD', lines: lines([cash, 100, 0], [revenue, 0, 100]) }))
    expect(result).toContain('CurrencyMismatchError')
    expect(await sqlFailure(`update journal_entries set currency = 'USD' where tenant_id = $1 and status = 'draft'`, [a.tenantId])).toContain('check')
  })

  it('lets a draft be unbalanced, replaced and edited, then refuses to post it until it balances', async () => {
    const created = (
      await createJournalEntry(a, nextKey(), { entryDate: '2026-03-01', memo: 'wip', currency: 'KWD', lines: lines([cash, 1000, 0], [revenue, 0, 900]) })
    ).body.data
    expect(await outcome(postJournalEntry(a, created.id, { version: created.version }))).toBe('unbalanced_entry')
    const fixed = await updateJournalEntry(a, created.id, {
      version: created.version,
      entryDate: '2026-03-02',
      memo: 'fixed',
      currency: 'KWD',
      lines: lines([cash, 1000, 0], [revenue, 0, 600], [payable, 0, 400]),
    })
    expect(fixed.data).toMatchObject({ memo: 'fixed', entryDate: '2026-03-02', lineCount: 3, version: 2 })
    expect(await outcome(updateJournalEntry(a, created.id, { version: 1, entryDate: '2026-03-02', memo: '', currency: 'KWD', lines: lines([cash, 1, 0], [revenue, 0, 1]) }))).toBe('409:version_conflict')
    const done = await postJournalEntry(a, created.id, { version: fixed.data.version })
    expect(done.data.status).toBe('posted')
  })

  it('posts a balanced entry: sets the period, the poster and the time, writes audit and publishes after commit', async () => {
    const entry = await draft(a, '2026-03-05', 2500)
    const result = await postJournalEntry(a, entry.id, { version: entry.version })
    expect(result.data).toMatchObject({ status: 'posted', postedBy: a.userId, version: 2 })
    expect(result.data.postedAt).not.toBeNull()
    expect(result.data.periodId).not.toBeNull()
    const audit = await pg().query<{ action: string }>(`select action from audit_log where entity = 'journal_entry' and entity_id = $1 order by id`, [entry.id])
    expect(audit.rows.map((row) => row.action)).toEqual(['create', 'update'])
    const posts = events.filter((event) => event.name === 'finance.journal.posted' && (event.payload as { entryId: string }).entryId === entry.id)
    expect(posts).toHaveLength(1)
    expect(posts[0].payload).toMatchObject({ totalMinor: 2500, currency: 'KWD', sourceType: 'manual', postedBy: a.userId })
  })

  it('refuses a stale version and a second post', async () => {
    const entry = await draft(a, '2026-03-06', 100)
    expect(await outcome(postJournalEntry(a, entry.id, { version: 7 }))).toBe('409:version_conflict')
    const done = await postJournalEntry(a, entry.id, { version: entry.version })
    expect(await outcome(postJournalEntry(a, entry.id, { version: done.data.version }))).toBe('409:entry_not_draft')
    expect(await outcome(updateJournalEntry(a, entry.id, { version: done.data.version, entryDate: '2026-03-06', memo: '', currency: 'KWD', lines: lines([cash, 1, 0], [revenue, 0, 1]) }))).toBe('409:entry_not_draft')
  })

  it('lists newest first with a cursor and filters by status and date', async () => {
    const page = await listJournalEntries(a, { limit: 3, status: 'all' })
    expect(page.data).toHaveLength(3)
    expect(page.data[0].number > page.data[1].number).toBe(true)
    expect(page.nextCursor).not.toBeNull()
    const next = await listJournalEntries(a, { limit: 3, status: 'all', cursor: page.nextCursor ?? undefined })
    expect(next.data[0].number < page.data[2].number).toBe(true)
    const draftsOnly = await listJournalEntries(a, { limit: 100, status: 'draft' })
    expect(draftsOnly.data.every((entry) => entry.status === 'draft')).toBe(true)
    const march = await listJournalEntries(a, { limit: 100, status: 'all', from: '2026-03-01', to: '2026-03-31' })
    expect(march.data.every((entry) => entry.entryDate.startsWith('2026-03'))).toBe(true)
  })
})

describe('what the database refuses, even to code that skips the service', () => {
  it('refuses to post an unbalanced entry, a one-line entry, and an entry with no period', async () => {
    const unbalanced = (await createJournalEntry(a, nextKey(), { entryDate: '2026-04-01', memo: '', currency: 'KWD', lines: lines([cash, 100, 0], [revenue, 0, 90]) })).body.data
    expect(await sqlFailure(`update journal_entries set status = 'posted', posted_by = $2 where id = $1`, [unbalanced.id, a.userId])).toContain('not balanced')

    const oneLine = await pg().query<{ id: string }>(
      `insert into journal_entries (tenant_id, number, entry_date, created_by) values ($1, 9001, '2026-04-01', $2) returning id`,
      [a.tenantId, a.userId]
    )
    await pg().query(`insert into journal_lines (tenant_id, entry_id, line_no, account_id, debit_minor, created_by) values ($1, $2, 1, $3, 5, $4)`, [a.tenantId, oneLine.rows[0].id, cash.id, a.userId])
    expect(await sqlFailure(`update journal_entries set status = 'posted', posted_by = $2 where id = $1`, [oneLine.rows[0].id, a.userId])).toContain('at least two lines')

    const noPeriod = await draft(a, '2031-01-01', 100)
    expect(await sqlFailure(`update journal_entries set status = 'posted', posted_by = $2 where id = $1`, [noPeriod.id, a.userId])).toContain('No fiscal period')
    expect(await outcome(postJournalEntry(a, noPeriod.id, { version: noPeriod.version }))).toBe('422:no_fiscal_period')
  })

  it('refuses a line on both sides or neither, and a line above the limit', async () => {
    const entry = await draft(a, '2026-04-02', 100)
    const insert = (debit: number, credit: number) =>
      sqlFailure(`insert into journal_lines (tenant_id, entry_id, line_no, account_id, debit_minor, credit_minor, created_by) values ($1, $2, 50, $3, $4, $5, $6)`, [a.tenantId, entry.id, cash.id, debit, credit, a.userId])
    expect(await insert(5, 5)).toContain('journal_lines_one_side')
    expect(await insert(0, 0)).toContain('journal_lines_one_side')
    expect(await insert(-5, 0)).toContain('check')
    expect(await insert(1_000_000_000_001, 0)).toContain('check')
  })

  it('never changes or deletes a posted entry or its lines', async () => {
    const entry = await posted(a, '2026-04-03', 4000)
    expect(await sqlFailure(`update journal_entries set memo = 'tampered' where id = $1`, [entry.id])).toContain('posted journal entry cannot change')
    expect(await sqlFailure(`update journal_entries set status = 'draft' where id = $1`, [entry.id])).toContain('posted journal entry cannot change')
    expect(await sqlFailure(`delete from journal_entries where id = $1`, [entry.id])).not.toBe('ok')
    expect((await pg().query(`select 1 from journal_entries where id = $1`, [entry.id])).rows).toHaveLength(1)
    expect(await sqlFailure(`update journal_lines set debit_minor = 1 where id = $1`, [entry.lines[0].id])).toContain('lines of a posted')
    expect(await sqlFailure(`delete from journal_lines where id = $1`, [entry.lines[0].id])).toContain('lines of a posted')
    expect(await sqlFailure(`insert into journal_lines (tenant_id, entry_id, line_no, account_id, credit_minor, created_by) values ($1, $2, 9, $3, 1, $4)`, [a.tenantId, entry.id, cash.id, a.userId])).toContain('lines of a posted')
    const after = (await getJournalEntry(a, entry.id)).data
    expect(after).toMatchObject({ memo: 'sale', status: 'posted', totalDebitMinor: 4000, totalCreditMinor: 4000 })
  })

  it('does not let an account with lines change between postable and header', async () => {
    expect(await sqlFailure(`update accounts set is_postable = false where id = $1`, [cash.id])).toContain('postable and header')
  })
})

describe('reversal', () => {
  it('posts a mirror entry, leaves the original untouched and nets the books to zero', async () => {
    const original = await posted(a, '2026-05-01', 8000)
    const key = nextKey()
    const result = await reverseJournalEntry(a, original.id, key, { version: original.version, entryDate: '2026-05-02', memo: '' })
    const reversal = result.body.data
    expect(reversal).toMatchObject({ status: 'posted', sourceType: 'reversal', reversesId: original.id, entryDate: '2026-05-02', totalDebitMinor: 8000, totalCreditMinor: 8000 })
    expect(reversal.lines.map((line) => [line.accountCode, line.debitMinor, line.creditMinor])).toEqual([
      ['1000', 0, 8000],
      ['4000', 8000, 0],
    ])
    const reread = (await getJournalEntry(a, original.id)).data
    expect(reread).toMatchObject({ status: 'posted', memo: 'sale', reversedById: reversal.id, version: original.version })
    const names = events.map((event) => event.name)
    expect(names).toContain('finance.journal.reversed')
    // The same key replays the same reversal and does not post a second one.
    const replay = await reverseJournalEntry(a, original.id, key, { version: original.version, entryDate: '2026-05-02', memo: '' })
    expect(replay.replayed).toBe(true)
    expect(replay.body.data.id).toBe(reversal.id)
  })

  it('refuses a second reversal, a reversal of a draft, and a stale version', async () => {
    const original = await posted(a, '2026-05-03', 100)
    await reverseJournalEntry(a, original.id, nextKey(), { version: original.version, entryDate: '2026-05-03', memo: '' })
    expect(await outcome(reverseJournalEntry(a, original.id, nextKey(), { version: original.version, entryDate: '2026-05-03', memo: '' }))).toBe('409:already_reversed')
    const pending = await draft(a, '2026-05-04', 100)
    expect(await outcome(reverseJournalEntry(a, pending.id, nextKey(), { version: pending.version, entryDate: '2026-05-04', memo: '' }))).toBe('409:entry_not_posted')
    const fresh = await posted(a, '2026-05-05', 100)
    expect(await outcome(reverseJournalEntry(a, fresh.id, nextKey(), { version: 99, entryDate: '2026-05-05', memo: '' }))).toBe('409:version_conflict')
  })

  it('refuses a forged reversal that does not mirror the original', async () => {
    const original = await posted(a, '2026-05-06', 300)
    const forged = await pg().query<{ id: string }>(
      `insert into journal_entries (tenant_id, number, entry_date, source_type, reverses_id, created_by) values ($1, 9100, '2026-05-06', 'reversal', $2, $3) returning id`,
      [a.tenantId, original.id, a.userId]
    )
    // Same direction as the original: balanced, but not a mirror.
    await pg().query(`insert into journal_lines (tenant_id, entry_id, line_no, account_id, debit_minor, created_by) values ($1, $2, 1, $3, 300, $4)`, [a.tenantId, forged.rows[0].id, cash.id, a.userId])
    await pg().query(`insert into journal_lines (tenant_id, entry_id, line_no, account_id, credit_minor, created_by) values ($1, $2, 2, $3, 300, $4)`, [a.tenantId, forged.rows[0].id, revenue.id, a.userId])
    expect(await sqlFailure(`update journal_entries set status = 'posted', posted_by = $2 where id = $1`, [forged.rows[0].id, a.userId])).toContain('mirror')
  })

  it('refuses a reversal dated in a closed period but lets the original stay in it', async () => {
    const old = await posted(a, '2025-06-01', 450)
    await closePeriodNamed('FY2025')
    expect(await outcome(reverseJournalEntry(a, old.id, nextKey(), { version: old.version, entryDate: '2025-06-02', memo: '' }))).toBe('409:period_closed')
    const fixed = await reverseJournalEntry(a, old.id, nextKey(), { version: old.version, entryDate: '2026-06-02', memo: 'correction in the open year' })
    expect(fixed.body.data).toMatchObject({ status: 'posted', entryDate: '2026-06-02' })
  })
})

async function closePeriodNamed(name: string) {
  const all = await listPeriods(a, { limit: 100, status: 'all' })
  const period = all.data.find((candidate) => candidate.name === name)
  if (!period) throw new Error('period missing')
  return closePeriod(a, period.id, { version: period.version })
}

describe('closing a period', () => {
  it('is refused while the period holds a draft, then final once closed', async () => {
    await createPeriod(a, { name: 'FY2027', startsOn: '2027-01-01', endsOn: '2027-12-31' })
    const pending = await draft(a, '2027-02-01', 100)
    expect(await outcome(closePeriodNamed('FY2027'))).toBe('409:period_has_drafts')
    await postJournalEntry(a, pending.id, { version: pending.version })
    const closed = await closePeriodNamed('FY2027')
    expect(closed.data).toMatchObject({ status: 'closed', closedBy: a.userId })
    expect(closed.data.closedAt).not.toBeNull()
    expect(events.map((event) => event.name)).toContain('finance.period.closed')
    expect(await outcome(closePeriodNamed('FY2027'))).toBe('409:period_closed')
    expect(await sqlFailure(`update fiscal_periods set name = 'Renamed' where id = $1`, [closed.data.id])).toContain('final')
    expect(await sqlFailure(`update fiscal_periods set status = 'open', closed_at = null, closed_by = null where id = $1`, [closed.data.id])).toContain('final')
  })

  it('refuses to post into a closed period, in code and in the database', async () => {
    const entry = await draft(a, '2025-09-01', 100)
    expect(await outcome(postJournalEntry(a, entry.id, { version: entry.version }))).toBe('409:period_closed')
    expect(await sqlFailure(`update journal_entries set status = 'posted', posted_by = $2 where id = $1`, [entry.id, a.userId])).toContain('closed')
  })

  it('refuses to close a period twice and records who closed it in the audit log', async () => {
    const audit = await pg().query<{ after: { status: string; closedBy: string } }>(
      `select after from audit_log where entity = 'fiscal_period' and action = 'update' and tenant_id = $1`,
      [a.tenantId]
    )
    expect(audit.rows.some((row) => row.after.status === 'closed' && row.after.closedBy === a.userId)).toBe(true)
  })
})

describe('trial balance', () => {
  it('counts posted entries only and balances to the fils', async () => {
    await draft(a, '2026-07-01', 777)
    const report = (await getTrialBalance(a, { to: '2026-12-31' })).data
    expect(report.balanced).toBe(true)
    expect(report.totalDebitMinor).toBe(report.totalCreditMinor)
    const cashRow = report.rows.find((row) => row.code === '1000')
    expect(cashRow).toBeDefined()
    const manual = await pg().query<{ debit: string; credit: string }>(
      `select coalesce(sum(l.debit_minor), 0)::text as debit, coalesce(sum(l.credit_minor), 0)::text as credit
       from journal_lines l join journal_entries e on e.id = l.entry_id
       where l.tenant_id = $1 and l.account_id = $2 and e.status = 'posted' and e.entry_date <= '2026-12-31'`,
      [a.tenantId, cash.id]
    )
    expect(BigInt(cashRow?.debitMinor ?? 0) - BigInt(cashRow?.creditMinor ?? 0)).toBe(BigInt(manual.rows[0].debit) - BigInt(manual.rows[0].credit))
  })

  it('narrows by date', async () => {
    const wide = (await getTrialBalance(a, { to: '2026-12-31' })).data
    const narrow = (await getTrialBalance(a, { from: '2026-05-01', to: '2026-05-31' })).data
    expect(narrow.balanced).toBe(true)
    expect(narrow.totalDebitMinor).toBeLessThan(wide.totalDebitMinor)
    const nothing = (await getTrialBalance(a, { to: '2020-01-01' })).data
    expect(nothing).toMatchObject({ rows: [], totalDebitMinor: 0, totalCreditMinor: 0, balanced: true })
  })
})

describe('permissions', () => {
  it('refuses every action without its permission', async () => {
    const none = only(a)
    const entry = await draft(a, '2026-08-01', 100)
    const done = await posted(a, '2026-08-02', 100)
    const body = { entryDate: '2026-08-03', memo: '', currency: 'KWD' as const, lines: lines([cash, 1, 0], [revenue, 0, 1]) }
    const results = await Promise.all([
      outcome(listAccounts(none, { limit: 5, status: 'all' })),
      outcome(createAccount(none, { code: 'X1', name: 'x', type: 'asset', parentId: null, isPostable: true })),
      outcome(updateAccount(none, cash.id, { version: 1, name: 'x', isActive: true })),
      outcome(listPeriods(none, { limit: 5, status: 'all' })),
      outcome(createPeriod(none, { name: 'P', startsOn: '2040-01-01', endsOn: '2040-12-31' })),
      outcome(closePeriod(none, randomUUID(), { version: 1 })),
      outcome(listJournalEntries(none, { limit: 5, status: 'all' })),
      outcome(getJournalEntry(none, entry.id)),
      outcome(createJournalEntry(none, nextKey(), body)),
      outcome(updateJournalEntry(none, entry.id, { version: entry.version, ...body })),
      outcome(postJournalEntry(none, entry.id, { version: entry.version })),
      outcome(reverseJournalEntry(none, done.id, nextKey(), { version: done.version, entryDate: '2026-08-04', memo: '' })),
      outcome(getTrialBalance(none, { to: '2026-12-31' })),
    ])
    expect(results.every((result) => result === '403:forbidden')).toBe(true)
  })

  it('does not let the right to reverse stand in for the right to post, or the other way round', async () => {
    const done = await posted(a, '2026-08-05', 100)
    const onlyReverse = only(a, 'finance.journal.reverse', 'finance.journal.read')
    const onlyPost = only(a, 'finance.journal.post', 'finance.journal.read')
    expect(await outcome(reverseJournalEntry(onlyReverse, done.id, nextKey(), { version: done.version, entryDate: '2026-08-06', memo: '' }))).toBe('403:forbidden')
    expect(await outcome(reverseJournalEntry(onlyPost, done.id, nextKey(), { version: done.version, entryDate: '2026-08-06', memo: '' }))).toBe('403:forbidden')
    const draftOnly = await draft(a, '2026-08-07', 100)
    expect(await outcome(postJournalEntry(only(a, 'finance.journal.create'), draftOnly.id, { version: draftOnly.version }))).toBe('403:forbidden')
  })
})

describe('tenant isolation', () => {
  it('hides accounts, periods and entries of another company', async () => {
    const mine = await posted(a, '2026-09-01', 5000)
    expect(await outcome(getJournalEntry(b, mine.id))).toBe('404:journal_entry_not_found')
    expect(await outcome(postJournalEntry(b, mine.id, { version: 1 }))).toBe('404:journal_entry_not_found')
    expect(await outcome(reverseJournalEntry(b, mine.id, nextKey(), { version: mine.version, entryDate: '2026-09-02', memo: '' }))).toBe('404:journal_entry_not_found')
    expect(await outcome(updateAccount(b, cash.id, { version: 1, name: 'Stolen', isActive: false }))).toBe('404:account_not_found')
    expect(await outcome(closePeriod(b, (await listPeriods(a, { limit: 1, status: 'all' })).data[0].id, { version: 1 }))).toBe('404:period_not_found')
    expect((await listJournalEntries(b, { limit: 100, status: 'all' })).data.map((entry) => entry.id)).not.toContain(mine.id)
    expect((await listAccounts(b, { limit: 100, status: 'all' })).data.map((account) => account.id)).not.toContain(cash.id)
  })

  it('refuses a line that points at another company\'s account', async () => {
    expect(
      await outcome(createJournalEntry(b, nextKey(), { entryDate: '2026-09-01', memo: '', currency: 'KWD', lines: lines([cash, 100, 0], [bRevenue, 0, 100]) }))
    ).toBe('422:account_not_found')
    const direct = await sqlFailure(
      `insert into journal_lines (tenant_id, entry_id, line_no, account_id, debit_minor, created_by)
       select $1, e.id, 40, $2, 5, $3 from journal_entries e where e.tenant_id = $1 limit 1`,
      [b.tenantId, cash.id, b.userId]
    )
    expect(direct).toContain('not postable')
  })

  it('keeps the trial balance of each company apart', async () => {
    const mineOnly = (await getTrialBalance(b, { to: '2026-12-31' })).data
    expect(mineOnly.rows.every((row) => row.code === '1000' || row.code === '4000')).toBe(true)
    expect(mineOnly.totalDebitMinor).toBe(0)
  })
})
