import type { Page } from '@/lib/api/cursor'
import { keysetClauses, toPage } from '@/lib/api/keyset'
import type { Queryable } from '@/lib/db'
import { netColumns, toSafeMinor } from '@/modules/finance/domain/ledger'
import type {
  Account,
  FiscalPeriod,
  JournalEntry,
  JournalEntryDetail,
  JournalLine,
  JournalSourceType,
  TrialBalanceRow,
  AccountType,
} from '@/modules/finance/domain/ledger-types'
import type {
  CreateAccountInput,
  CreatePeriodInput,
  JournalLineInput,
  ListAccountsQuery,
  ListJournalEntriesQuery,
  ListPeriodsQuery,
  UpdateAccountInput,
} from '@/modules/finance/schemas/ledger'

type Stamped<T> = Omit<T, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date }

function stamp<T extends { createdAt: Date; updatedAt: Date }>(row: T): Omit<T, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string } {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null
  return value instanceof Date ? value.toISOString() : value
}

// ---- accounts ----

const ACCOUNT_COLUMNS = `a.id, a.code, a.name, a.type, a.parent_id as "parentId", a.is_postable as "isPostable", a.is_active as "isActive",
  a.version, a.created_at as "createdAt", a.updated_at as "updatedAt", a.created_by as "createdBy"`

export async function insertAccount(tx: Queryable, tenantId: string, userId: string, input: CreateAccountInput): Promise<Account> {
  const inserted = await tx.query<{ id: string }>(
    `insert into accounts (tenant_id, code, name, type, parent_id, is_postable, created_by)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [tenantId, input.code, input.name, input.type, input.parentId, input.isPostable, userId]
  )
  const created = await findAccount(tx, tenantId, inserted.rows[0].id)
  if (!created) throw new Error('Inserted account could not be read back')
  return created
}

export async function findAccount(tx: Queryable, tenantId: string, id: string, options: { lock: boolean } = { lock: false }): Promise<Account | null> {
  if (options.lock) await tx.query('select 1 from accounts where tenant_id = $1 and id = $2 for update', [tenantId, id])
  const result = await tx.query<Stamped<Account>>(`select ${ACCOUNT_COLUMNS} from accounts a where a.tenant_id = $1 and a.id = $2`, [tenantId, id])
  return result.rows[0] ? (stamp(result.rows[0]) as Account) : null
}

export async function updateAccount(tx: Queryable, tenantId: string, id: string, input: UpdateAccountInput): Promise<boolean> {
  const result = await tx.query(
    'update accounts set name = $4, is_active = $5, version = version + 1 where tenant_id = $1 and id = $2 and version = $3',
    [tenantId, id, input.version, input.name, input.isActive]
  )
  return (result.rowCount ?? 0) > 0
}

export async function countActiveChildren(tx: Queryable, tenantId: string, id: string): Promise<number> {
  const result = await tx.query<{ n: number }>(
    'select count(*)::int as n from accounts where tenant_id = $1 and parent_id = $2 and is_active',
    [tenantId, id]
  )
  return result.rows[0].n
}

export async function findAccountsByIds(tx: Queryable, tenantId: string, ids: readonly string[]): Promise<Account[]> {
  if (ids.length === 0) return []
  const result = await tx.query<Stamped<Account>>(
    `select ${ACCOUNT_COLUMNS} from accounts a where a.tenant_id = $1 and a.id = any($2::uuid[]) order by a.id`,
    [tenantId, [...ids]]
  )
  return result.rows.map((row) => stamp(row) as Account)
}

export async function listAccounts(tx: Queryable, tenantId: string, query: ListAccountsQuery): Promise<Page<Account>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status !== 'all') filters += query.status === 'active' ? ' and a.is_active' : ' and not a.is_active'
  if (query.type) {
    params.push(query.type)
    filters += ` and a.type = $${params.length}`
  }
  const keyset = keysetClauses({ sortKey: 'code', column: { sql: 'code', cast: 'text' }, direction: 'asc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<Stamped<Account> & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (select ${ACCOUNT_COLUMNS} from accounts a where a.tenant_id = $1${filters}) x
     where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'code', 'asc')
  return { data: page.data.map((row) => stamp(row) as Account), nextCursor: page.nextCursor }
}

// ---- fiscal periods ----

const PERIOD_COLUMNS = `p.id, p.name, to_char(p.starts_on, 'YYYY-MM-DD') as "startsOn", to_char(p.ends_on, 'YYYY-MM-DD') as "endsOn", p.status,
  p.closed_at as "closedAt", p.closed_by as "closedBy", p.version,
  p.created_at as "createdAt", p.updated_at as "updatedAt", p.created_by as "createdBy"`

type PeriodRow = Stamped<Omit<FiscalPeriod, 'closedAt'>> & { closedAt: Date | null }

function periodFromRow(row: PeriodRow): FiscalPeriod {
  return { ...stamp(row), closedAt: iso(row.closedAt) } as FiscalPeriod
}

export async function insertPeriod(tx: Queryable, tenantId: string, userId: string, input: CreatePeriodInput): Promise<FiscalPeriod> {
  const inserted = await tx.query<{ id: string }>(
    'insert into fiscal_periods (tenant_id, name, starts_on, ends_on, created_by) values ($1, $2, $3, $4, $5) returning id',
    [tenantId, input.name, input.startsOn, input.endsOn, userId]
  )
  const created = await findPeriod(tx, tenantId, inserted.rows[0].id)
  if (!created) throw new Error('Inserted period could not be read back')
  return created
}

export async function findPeriod(tx: Queryable, tenantId: string, id: string, options: { lock: boolean } = { lock: false }): Promise<FiscalPeriod | null> {
  if (options.lock) await tx.query('select 1 from fiscal_periods where tenant_id = $1 and id = $2 for update', [tenantId, id])
  const result = await tx.query<PeriodRow>(`select ${PERIOD_COLUMNS} from fiscal_periods p where p.tenant_id = $1 and p.id = $2`, [tenantId, id])
  return result.rows[0] ? periodFromRow(result.rows[0]) : null
}

export async function findPeriodForDate(tx: Queryable, tenantId: string, date: string): Promise<FiscalPeriod | null> {
  const result = await tx.query<PeriodRow>(
    `select ${PERIOD_COLUMNS} from fiscal_periods p where p.tenant_id = $1 and $2::date between p.starts_on and p.ends_on`,
    [tenantId, date]
  )
  return result.rows[0] ? periodFromRow(result.rows[0]) : null
}

export async function closePeriod(tx: Queryable, tenantId: string, id: string, userId: string, version: number): Promise<boolean> {
  const result = await tx.query(
    `update fiscal_periods set status = 'closed', closed_at = now(), closed_by = $4, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'open'`,
    [tenantId, id, version, userId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function countDraftEntriesIn(tx: Queryable, tenantId: string, period: { startsOn: string; endsOn: string }): Promise<number> {
  const result = await tx.query<{ n: number }>(
    `select count(*)::int as n from journal_entries where tenant_id = $1 and status = 'draft' and entry_date between $2::date and $3::date`,
    [tenantId, period.startsOn, period.endsOn]
  )
  return result.rows[0].n
}

export async function findOverlappingPeriod(tx: Queryable, tenantId: string, input: { startsOn: string; endsOn: string }): Promise<boolean> {
  const result = await tx.query<{ one: number }>(
    'select 1 as one from fiscal_periods where tenant_id = $1 and starts_on <= $3::date and ends_on >= $2::date limit 1',
    [tenantId, input.startsOn, input.endsOn]
  )
  return result.rows.length > 0
}

export async function listPeriods(tx: Queryable, tenantId: string, query: ListPeriodsQuery): Promise<Page<FiscalPeriod>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status !== 'all') {
    params.push(query.status)
    filters += ` and p.status = $${params.length}`
  }
  const keyset = keysetClauses({ sortKey: 'startsOn', column: { sql: '"startsOn"', cast: 'text' }, direction: 'desc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<PeriodRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (select ${PERIOD_COLUMNS} from fiscal_periods p where p.tenant_id = $1${filters}) x
     where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'startsOn', 'desc')
  return { data: page.data.map((row) => periodFromRow(row as PeriodRow)), nextCursor: page.nextCursor }
}

// ---- journal entries ----

const ENTRY_COLUMNS = `e.id, e.number, to_char(e.entry_date, 'YYYY-MM-DD') as "entryDate", e.memo, e.currency, e.status, e.source_type as "sourceType", e.source_id as "sourceId",
  e.reverses_id as "reversesId",
  (select r.id from journal_entries r where r.tenant_id = e.tenant_id and r.reverses_id = e.id) as "reversedById",
  e.period_id as "periodId", e.posted_at as "postedAt", e.posted_by as "postedBy",
  (select count(*)::int from journal_lines l where l.tenant_id = e.tenant_id and l.entry_id = e.id) as "lineCount",
  (select coalesce(sum(l.debit_minor), 0)::text from journal_lines l where l.tenant_id = e.tenant_id and l.entry_id = e.id) as "totalDebit",
  (select coalesce(sum(l.credit_minor), 0)::text from journal_lines l where l.tenant_id = e.tenant_id and l.entry_id = e.id) as "totalCredit",
  e.version, e.created_at as "createdAt", e.updated_at as "updatedAt", e.created_by as "createdBy"`

type EntryRow = Stamped<
  Omit<JournalEntry, 'postedAt' | 'totalDebitMinor' | 'totalCreditMinor'> & { totalDebit: string; totalCredit: string }
> & { postedAt: Date | null }

function entryFromRow(row: EntryRow): JournalEntry {
  const { totalDebit, totalCredit, ...rest } = row
  return {
    ...stamp(rest),
    postedAt: iso(row.postedAt),
    totalDebitMinor: toSafeMinor(BigInt(totalDebit)),
    totalCreditMinor: toSafeMinor(BigInt(totalCredit)),
  } as JournalEntry
}

export async function insertEntry(
  tx: Queryable,
  tenantId: string,
  userId: string,
  entry: {
    number: number
    entryDate: string
    memo: string
    sourceType: JournalSourceType
    sourceId?: string | null
    reversesId: string | null
  }
): Promise<string> {
  const inserted = await tx.query<{ id: string }>(
    `insert into journal_entries (tenant_id, number, entry_date, memo, source_type, source_id, reverses_id, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [tenantId, entry.number, entry.entryDate, entry.memo, entry.sourceType, entry.sourceId ?? null, entry.reversesId, userId]
  )
  return inserted.rows[0].id
}

export async function insertLines(tx: Queryable, tenantId: string, userId: string, entryId: string, lines: readonly JournalLineInput[]): Promise<void> {
  for (const [index, line] of lines.entries()) {
    await tx.query(
      `insert into journal_lines (tenant_id, entry_id, line_no, account_id, debit_minor, credit_minor, description, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId, entryId, index + 1, line.accountId, line.debitMinor, line.creditMinor, line.description, userId]
    )
  }
}

export async function deleteLines(tx: Queryable, tenantId: string, entryId: string): Promise<void> {
  await tx.query('delete from journal_lines where tenant_id = $1 and entry_id = $2', [tenantId, entryId])
}

export async function updateDraftHeader(
  tx: Queryable,
  tenantId: string,
  id: string,
  version: number,
  header: { entryDate: string; memo: string }
): Promise<boolean> {
  const result = await tx.query(
    `update journal_entries set entry_date = $4, memo = $5, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'draft'`,
    [tenantId, id, version, header.entryDate, header.memo]
  )
  return (result.rowCount ?? 0) > 0
}

export async function postEntry(tx: Queryable, tenantId: string, id: string, userId: string, version: number): Promise<boolean> {
  const result = await tx.query(
    `update journal_entries set status = 'posted', posted_by = $4, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'draft'`,
    [tenantId, id, version, userId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function findEntry(tx: Queryable, tenantId: string, id: string, options: { lock: boolean } = { lock: false }): Promise<JournalEntry | null> {
  if (options.lock) await tx.query('select 1 from journal_entries where tenant_id = $1 and id = $2 for update', [tenantId, id])
  const result = await tx.query<EntryRow>(`select ${ENTRY_COLUMNS} from journal_entries e where e.tenant_id = $1 and e.id = $2`, [tenantId, id])
  return result.rows[0] ? entryFromRow(result.rows[0]) : null
}

export async function findEntryLines(tx: Queryable, tenantId: string, entryId: string): Promise<JournalLine[]> {
  const result = await tx.query<{
    id: string
    lineNo: number
    accountId: string
    accountCode: string
    accountName: string
    debit: string
    credit: string
    description: string
  }>(
    `select l.id, l.line_no as "lineNo", l.account_id as "accountId", a.code as "accountCode", a.name as "accountName",
            l.debit_minor::text as debit, l.credit_minor::text as credit, l.description
     from journal_lines l join accounts a on a.tenant_id = l.tenant_id and a.id = l.account_id
     where l.tenant_id = $1 and l.entry_id = $2 order by l.line_no`,
    [tenantId, entryId]
  )
  return result.rows.map((row) => ({
    id: row.id,
    lineNo: row.lineNo,
    accountId: row.accountId,
    accountCode: row.accountCode,
    accountName: row.accountName,
    debitMinor: Number(row.debit),
    creditMinor: Number(row.credit),
    description: row.description,
  }))
}

export async function findEntryDetail(tx: Queryable, tenantId: string, id: string): Promise<JournalEntryDetail | null> {
  const entry = await findEntry(tx, tenantId, id)
  if (!entry) return null
  return { ...entry, lines: await findEntryLines(tx, tenantId, id) }
}

export async function findReversalOf(tx: Queryable, tenantId: string, id: string): Promise<string | null> {
  const result = await tx.query<{ id: string }>('select id from journal_entries where tenant_id = $1 and reverses_id = $2', [tenantId, id])
  return result.rows[0]?.id ?? null
}

/** The posted source entry that has not itself been reversed. Null when the document posted nothing. */
export async function findActiveSourceEntry(
  tx: Queryable,
  tenantId: string,
  sourceType: string,
  sourceId: string
): Promise<string | null> {
  const result = await tx.query<{ id: string }>(
    `select e.id from journal_entries e
      where e.tenant_id = $1 and e.source_type = $2 and e.source_id = $3 and e.status = 'posted'
        and not exists (select 1 from journal_entries r where r.tenant_id = e.tenant_id and r.reverses_id = e.id)`,
    [tenantId, sourceType, sourceId]
  )
  return result.rows[0]?.id ?? null
}

export async function listEntries(tx: Queryable, tenantId: string, query: ListJournalEntriesQuery): Promise<Page<JournalEntry>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status !== 'all') {
    params.push(query.status)
    filters += ` and e.status = $${params.length}`
  }
  if (query.from) {
    params.push(query.from)
    filters += ` and e.entry_date >= $${params.length}::date`
  }
  if (query.to) {
    params.push(query.to)
    filters += ` and e.entry_date <= $${params.length}::date`
  }
  const keyset = keysetClauses({ sortKey: 'number', column: { sql: 'number', cast: 'bigint' }, direction: 'desc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<EntryRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (select ${ENTRY_COLUMNS} from journal_entries e where e.tenant_id = $1${filters}) x
     where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'number', 'desc')
  return { data: page.data.map((row) => entryFromRow(row as EntryRow)), nextCursor: page.nextCursor }
}

/** Posted debit and credit totals per account, zero for an account with no posted line. Sums are text, converted as BigInt. */
export async function accountTotals(
  tx: Queryable,
  tenantId: string,
  accountIds: readonly string[]
): Promise<Array<{ accountId: string; debitMinor: number; creditMinor: number }>> {
  if (accountIds.length === 0) return []
  const result = await tx.query<{ accountId: string; debit: string; credit: string }>(
    `select a.id as "accountId", coalesce(sum(l.debit_minor), 0)::text as debit, coalesce(sum(l.credit_minor), 0)::text as credit
     from accounts a
     left join journal_lines l on l.tenant_id = a.tenant_id and l.account_id = a.id
       and exists (select 1 from journal_entries e where e.tenant_id = l.tenant_id and e.id = l.entry_id and e.status = 'posted')
     where a.tenant_id = $1 and a.id = any($2::uuid[])
     group by a.id order by a.id`,
    [tenantId, accountIds]
  )
  return result.rows.map((row) => ({
    accountId: row.accountId,
    debitMinor: toSafeMinor(BigInt(row.debit)),
    creditMinor: toSafeMinor(BigInt(row.credit)),
  }))
}

// ---- reports ----

/** Posted lines only, grouped by account. The totals are summed as text and added up as BigInt in the caller. */
export async function trialBalanceRows(tx: Queryable, tenantId: string, range: { from: string | null; to: string }): Promise<TrialBalanceRow[]> {
  const params: unknown[] = [tenantId, range.to]
  let fromClause = ''
  if (range.from) {
    params.push(range.from)
    fromClause = ` and e.entry_date >= $${params.length}::date`
  }
  const result = await tx.query<{ accountId: string; code: string; name: string; type: AccountType; debit: string; credit: string }>(
    `select a.id as "accountId", a.code, a.name, a.type, sum(l.debit_minor)::text as debit, sum(l.credit_minor)::text as credit
     from journal_lines l
     join journal_entries e on e.tenant_id = l.tenant_id and e.id = l.entry_id and e.status = 'posted'
     join accounts a on a.tenant_id = l.tenant_id and a.id = l.account_id
     where l.tenant_id = $1 and e.entry_date <= $2::date${fromClause}
     group by a.id, a.code, a.name, a.type
     order by a.code`,
    params
  )
  return result.rows.map((row) => {
    const net = netColumns(BigInt(row.debit), BigInt(row.credit))
    return {
      accountId: row.accountId,
      code: row.code,
      name: row.name,
      type: row.type,
      debitMinor: toSafeMinor(net.debit),
      creditMinor: toSafeMinor(net.credit),
    }
  })
}
