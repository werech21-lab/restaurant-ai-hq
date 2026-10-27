import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'
import { isUniqueViolation, requirePermission, versionConflict } from '@/lib/auth/require'
import { db, withTransaction, type Queryable } from '@/lib/db'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { nextSequenceValue } from '@/lib/sequences'
import { assertKwd, assertPostable, reverseLines, sumLines, toSafeMinor } from '@/modules/finance/domain/ledger'
import type { Account, FiscalPeriod, JournalEntry, JournalEntryDetail, JournalSourceType, TrialBalance } from '@/modules/finance/domain/ledger-types'
import { publishFinanceEvents, type FinanceEvent } from '@/modules/finance/events'
import * as repository from '@/modules/finance/repositories/ledger-repository'
import type {
  ClosePeriodInput,
  CreateAccountInput,
  CreateJournalEntryInput,
  CreatePeriodInput,
  JournalLineInput,
  ListAccountsQuery,
  ListJournalEntriesQuery,
  ListPeriodsQuery,
  PostJournalEntryInput,
  ReverseJournalEntryInput,
  TrialBalanceQuery,
  UpdateAccountInput,
  UpdateJournalEntryInput,
} from '@/modules/finance/schemas/ledger'

export type AccountBody = { data: Account }
export type PeriodBody = { data: FiscalPeriod }
export type JournalEntryBody = { data: JournalEntryDetail }

const CREATE_SCOPE = 'finance.journal.create'
const REVERSE_SCOPE = 'finance.journal.reverse'

function eventBase(auth: AuthContext) {
  return { version: 1 as const, occurredAt: new Date().toISOString(), tenantId: auth.tenantId }
}

const accountNotFound = () => new AppError(404, 'account_not_found', 'The account was not found.')
const periodNotFound = () => new AppError(404, 'period_not_found', 'The fiscal period was not found.')
const entryNotFound = () => new AppError(404, 'journal_entry_not_found', 'The journal entry was not found.')

type AuditEntity = 'account' | 'fiscal_period' | 'journal_entry'

async function audit(tx: Queryable, auth: AuthContext, entity: AuditEntity, id: string, action: 'create' | 'update', before: unknown, after: unknown) {
  await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity, entityId: id, action, before, after })
}

// ---- accounts ----

export async function createAccount(auth: AuthContext, input: CreateAccountInput): Promise<AccountBody> {
  requirePermission(auth, permissions.financeAccountManage)
  const events: FinanceEvent[] = []
  const account = await withTransaction(async (tx) => {
    if (input.parentId) {
      const parent = await repository.findAccount(tx, auth.tenantId, input.parentId, { lock: true })
      if (!parent) throw new AppError(422, 'parent_not_found', 'The parent account was not found.')
      if (parent.type !== input.type) throw new AppError(422, 'parent_type_mismatch', 'An account must have the same type as its parent.')
      if (parent.isPostable) throw new AppError(422, 'parent_not_header', 'A parent account must be a header account (not postable).')
    }
    let created: Account
    try {
      created = await repository.insertAccount(tx, auth.tenantId, auth.userId, input)
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, 'account_code_exists', `An account with code ${input.code} already exists.`)
      throw error
    }
    await audit(tx, auth, 'account', created.id, 'create', null, created)
    events.push({
      ...eventBase(auth),
      name: 'finance.account.created',
      payload: { accountId: created.id, code: created.code, accountType: created.type, createdBy: auth.userId },
    })
    return created
  })
  await publishFinanceEvents(events)
  return { data: account }
}

export async function updateAccount(auth: AuthContext, id: string, input: UpdateAccountInput): Promise<AccountBody> {
  requirePermission(auth, permissions.financeAccountManage)
  const events: FinanceEvent[] = []
  const account = await withTransaction(async (tx) => {
    const before = await repository.findAccount(tx, auth.tenantId, id, { lock: true })
    if (!before) throw accountNotFound()
    if (before.version !== input.version) throw versionConflict('account')
    if (!input.isActive && before.isActive && (await repository.countActiveChildren(tx, auth.tenantId, id)) > 0) {
      throw new AppError(409, 'account_has_active_children', 'Make the child accounts inactive first.')
    }
    if (!(await repository.updateAccount(tx, auth.tenantId, id, input))) throw versionConflict('account')
    const after = await repository.findAccount(tx, auth.tenantId, id)
    if (!after) throw accountNotFound()
    await audit(tx, auth, 'account', id, 'update', before, after)
    events.push({
      ...eventBase(auth),
      name: 'finance.account.updated',
      payload: { accountId: id, code: after.code, isActive: after.isActive, updatedBy: auth.userId },
    })
    return after
  })
  await publishFinanceEvents(events)
  return { data: account }
}

export async function listAccounts(auth: AuthContext, query: ListAccountsQuery): Promise<Page<Account>> {
  requirePermission(auth, permissions.financeAccountRead)
  return repository.listAccounts(db, auth.tenantId, query)
}

export async function getAccount(auth: AuthContext, id: string): Promise<AccountBody> {
  requirePermission(auth, permissions.financeAccountRead)
  const account = await repository.findAccount(db, auth.tenantId, id)
  if (!account) throw accountNotFound()
  return { data: account }
}

// ---- fiscal periods ----

export async function createPeriod(auth: AuthContext, input: CreatePeriodInput): Promise<PeriodBody> {
  requirePermission(auth, permissions.financePeriodManage)
  const events: FinanceEvent[] = []
  const period = await withTransaction(async (tx) => {
    if (await repository.findOverlappingPeriod(tx, auth.tenantId, input)) {
      throw new AppError(409, 'period_overlaps', 'Fiscal periods cannot overlap.')
    }
    let created: FiscalPeriod
    try {
      created = await repository.insertPeriod(tx, auth.tenantId, auth.userId, input)
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, 'period_name_exists', `A fiscal period named ${input.name} already exists.`)
      throw error
    }
    await audit(tx, auth, 'fiscal_period', created.id, 'create', null, created)
    events.push({
      ...eventBase(auth),
      name: 'finance.period.created',
      payload: { periodId: created.id, name: created.name, startsOn: created.startsOn, endsOn: created.endsOn, createdBy: auth.userId },
    })
    return created
  })
  await publishFinanceEvents(events)
  return { data: period }
}

/** Closing is final. It is refused while the period still holds draft entries. */
export async function closePeriod(auth: AuthContext, id: string, input: ClosePeriodInput): Promise<PeriodBody> {
  requirePermission(auth, permissions.financePeriodManage)
  const events: FinanceEvent[] = []
  const period = await withTransaction(async (tx) => {
    const before = await repository.findPeriod(tx, auth.tenantId, id, { lock: true })
    if (!before) throw periodNotFound()
    if (before.version !== input.version) throw versionConflict('fiscal period')
    if (before.status === 'closed') throw new AppError(409, 'period_closed', 'The fiscal period is already closed.')
    if ((await repository.countDraftEntriesIn(tx, auth.tenantId, before)) > 0) {
      throw new AppError(409, 'period_has_drafts', 'Post or discard the draft entries of this period before closing it.')
    }
    if (!(await repository.closePeriod(tx, auth.tenantId, id, auth.userId, input.version))) throw versionConflict('fiscal period')
    const after = await repository.findPeriod(tx, auth.tenantId, id)
    if (!after) throw periodNotFound()
    await audit(tx, auth, 'fiscal_period', id, 'update', before, after)
    events.push({ ...eventBase(auth), name: 'finance.period.closed', payload: { periodId: id, name: after.name, closedBy: auth.userId } })
    return after
  })
  await publishFinanceEvents(events)
  return { data: period }
}

export async function listPeriods(auth: AuthContext, query: ListPeriodsQuery): Promise<Page<FiscalPeriod>> {
  requirePermission(auth, permissions.financeJournalRead)
  return repository.listPeriods(db, auth.tenantId, query)
}

// ---- journal entries ----

async function requireUsableAccounts(tx: Queryable, tenantId: string, accountIds: readonly string[]): Promise<void> {
  const unique = [...new Set(accountIds)].sort()
  const found = await repository.findAccountsByIds(tx, tenantId, unique)
  if (found.length !== unique.length) throw new AppError(422, 'account_not_found', 'A line points at an account that does not exist.')
  if (found.some((account) => !account.isActive || !account.isPostable)) {
    throw new AppError(422, 'account_not_postable', 'A line points at an account that is inactive or not postable.')
  }
}

async function requireOpenPeriod(tx: Queryable, tenantId: string, date: string): Promise<FiscalPeriod> {
  const period = await repository.findPeriodForDate(tx, tenantId, date)
  if (!period) throw new AppError(422, 'no_fiscal_period', `No fiscal period covers ${date}.`)
  if (period.status !== 'open') throw new AppError(409, 'period_closed', `The fiscal period of ${date} is closed.`)
  return period
}

function journalRef(entry: JournalEntry) {
  return { entryId: entry.id, number: entry.number, entryDate: entry.entryDate }
}

/** A draft may be unbalanced while someone is still working on it. Posting is where the balance is enforced. */
export async function createJournalEntry(
  auth: AuthContext,
  idempotencyKey: string,
  input: CreateJournalEntryInput
): Promise<IdempotentResult<JournalEntryBody>> {
  requirePermission(auth, permissions.financeJournalCreate)
  assertKwd(input.currency)
  const events: FinanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<JournalEntryBody>(
      tx,
      { tenantId: auth.tenantId, scope: CREATE_SCOPE, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        await requireUsableAccounts(tx, auth.tenantId, input.lines.map((line) => line.accountId))
        const number = await nextSequenceValue(tx, auth.tenantId, 'journal')
        const id = await repository.insertEntry(tx, auth.tenantId, auth.userId, {
          number,
          entryDate: input.entryDate,
          memo: input.memo,
          sourceType: 'manual',
          reversesId: null,
        })
        await repository.insertLines(tx, auth.tenantId, auth.userId, id, input.lines)
        const detail = await repository.findEntryDetail(tx, auth.tenantId, id)
        if (!detail) throw entryNotFound()
        await audit(tx, auth, 'journal_entry', id, 'create', null, detail)
        events.push({ ...eventBase(auth), name: 'finance.journal.created', payload: { ...journalRef(detail), createdBy: auth.userId } })
        return { status: 201, body: { data: detail } }
      }
    )
  )
  if (!outcome.replayed) await publishFinanceEvents(events)
  return outcome
}

async function lockEntry(tx: Queryable, tenantId: string, id: string, version: number): Promise<JournalEntry> {
  const current = await repository.findEntry(tx, tenantId, id, { lock: true })
  if (!current) throw entryNotFound()
  if (current.version !== version) throw versionConflict('journal entry')
  return current
}

export async function updateJournalEntry(auth: AuthContext, id: string, input: UpdateJournalEntryInput): Promise<JournalEntryBody> {
  requirePermission(auth, permissions.financeJournalCreate)
  assertKwd(input.currency)
  return withTransaction(async (tx) => {
    const current = await lockEntry(tx, auth.tenantId, id, input.version)
    if (current.status !== 'draft') throw new AppError(409, 'entry_not_draft', 'Only a draft journal entry can be edited.')
    const before = await repository.findEntryDetail(tx, auth.tenantId, id)
    await requireUsableAccounts(tx, auth.tenantId, input.lines.map((line) => line.accountId))
    await repository.deleteLines(tx, auth.tenantId, id)
    await repository.insertLines(tx, auth.tenantId, auth.userId, id, input.lines)
    if (!(await repository.updateDraftHeader(tx, auth.tenantId, id, input.version, input))) throw versionConflict('journal entry')
    const after = await repository.findEntryDetail(tx, auth.tenantId, id)
    if (!after) throw entryNotFound()
    await audit(tx, auth, 'journal_entry', id, 'update', before, after)
    return { data: after }
  })
}

/** Posting locks the entry, checks it again in code, and the database checks it a third time. */
export async function postJournalEntry(auth: AuthContext, id: string, input: PostJournalEntryInput): Promise<JournalEntryBody> {
  requirePermission(auth, permissions.financeJournalPost)
  const events: FinanceEvent[] = []
  const detail = await withTransaction(async (tx) => {
    const current = await lockEntry(tx, auth.tenantId, id, input.version)
    if (current.status !== 'draft') throw new AppError(409, 'entry_not_draft', 'The journal entry is already posted.')
    const before = await repository.findEntryDetail(tx, auth.tenantId, id)
    if (!before) throw entryNotFound()
    const { totalMinor } = assertPostable(before.lines)
    await requireUsableAccounts(tx, auth.tenantId, before.lines.map((line) => line.accountId))
    await requireOpenPeriod(tx, auth.tenantId, current.entryDate)
    if (!(await repository.postEntry(tx, auth.tenantId, id, auth.userId, input.version))) throw versionConflict('journal entry')
    const after = await repository.findEntryDetail(tx, auth.tenantId, id)
    if (!after) throw entryNotFound()
    await audit(tx, auth, 'journal_entry', id, 'update', before, after)
    events.push({
      ...eventBase(auth),
      name: 'finance.journal.posted',
      payload: { ...journalRef(after), totalMinor, currency: 'KWD', sourceType: after.sourceType, postedBy: auth.userId },
    })
    return after
  })
  await publishFinanceEvents(events)
  return { data: detail }
}

/**
 * Reverses a posted entry with a new, posted entry that mirrors it. The original never changes. The reversing entry needs
 * its own date, in an open period.
 */
export async function reverseJournalEntry(
  auth: AuthContext,
  id: string,
  idempotencyKey: string,
  input: ReverseJournalEntryInput
): Promise<IdempotentResult<JournalEntryBody>> {
  requirePermission(auth, permissions.financeJournalReverse)
  requirePermission(auth, permissions.financeJournalPost)
  const events: FinanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<JournalEntryBody>(
      tx,
      { tenantId: auth.tenantId, scope: `${REVERSE_SCOPE}:${id}`, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        const original = await lockEntry(tx, auth.tenantId, id, input.version)
        if (original.status !== 'posted') throw new AppError(409, 'entry_not_posted', 'Only a posted journal entry can be reversed.')
        if (original.sourceType !== 'manual' && original.sourceType !== 'reversal') {
          throw new AppError(409, 'entry_has_source', 'This entry was made by a business document. Void or correct that document instead.')
        }
        if (await repository.findReversalOf(tx, auth.tenantId, id)) {
          throw new AppError(409, 'already_reversed', 'The journal entry was already reversed.')
        }
        await requireOpenPeriod(tx, auth.tenantId, input.entryDate)
        const originalLines = await repository.findEntryLines(tx, auth.tenantId, id)
        const lines = reverseLines(originalLines)
        const number = await nextSequenceValue(tx, auth.tenantId, 'journal')
        const reversalId = await repository.insertEntry(tx, auth.tenantId, auth.userId, {
          number,
          entryDate: input.entryDate,
          memo: input.memo || `Reversal of entry ${original.number}`,
          sourceType: 'reversal',
          reversesId: id,
        })
        await repository.insertLines(tx, auth.tenantId, auth.userId, reversalId, lines)
        const draft = await repository.findEntryDetail(tx, auth.tenantId, reversalId)
        if (!draft) throw entryNotFound()
        await audit(tx, auth, 'journal_entry', reversalId, 'create', null, draft)
        if (!(await repository.postEntry(tx, auth.tenantId, reversalId, auth.userId, draft.version))) throw versionConflict('journal entry')
        const posted = await repository.findEntryDetail(tx, auth.tenantId, reversalId)
        if (!posted) throw entryNotFound()
        await audit(tx, auth, 'journal_entry', reversalId, 'update', draft, posted)
        const totalMinor = toSafeMinor(sumLines(posted.lines).debit)
        events.push(
          {
            ...eventBase(auth),
            name: 'finance.journal.posted',
            payload: { ...journalRef(posted), totalMinor, currency: 'KWD', sourceType: 'reversal', postedBy: auth.userId },
          },
          {
            ...eventBase(auth),
            name: 'finance.journal.reversed',
            payload: { ...journalRef(original), reversalId, reversalNumber: posted.number, reversedBy: auth.userId },
          }
        )
        return { status: 201, body: { data: posted } }
      }
    )
  )
  if (!outcome.replayed) await publishFinanceEvents(events)
  return outcome
}

export async function listJournalEntries(auth: AuthContext, query: ListJournalEntriesQuery): Promise<Page<JournalEntry>> {
  requirePermission(auth, permissions.financeJournalRead)
  return repository.listEntries(db, auth.tenantId, query)
}

export async function getJournalEntry(auth: AuthContext, id: string): Promise<JournalEntryBody> {
  requirePermission(auth, permissions.financeJournalRead)
  const detail = await repository.findEntryDetail(db, auth.tenantId, id)
  if (!detail) throw entryNotFound()
  return { data: detail }
}

// ---- reports ----

/** Posted entries only. With a balanced ledger the two totals are always equal. */
export async function getTrialBalance(auth: AuthContext, query: TrialBalanceQuery): Promise<{ data: TrialBalance }> {
  requirePermission(auth, permissions.financeJournalRead)
  const rows = await repository.trialBalanceRows(db, auth.tenantId, { from: query.from ?? null, to: query.to })
  const totals = rows.reduce(
    (sum, row) => ({ debit: sum.debit + BigInt(row.debitMinor), credit: sum.credit + BigInt(row.creditMinor) }),
    { debit: 0n, credit: 0n }
  )
  return {
    data: {
      from: query.from ?? null,
      to: query.to,
      rows,
      totalDebitMinor: toSafeMinor(totals.debit),
      totalCreditMinor: toSafeMinor(totals.credit),
      balanced: totals.debit === totals.credit,
    },
  }
}

// ---- public "Within" functions for other modules ----
// Another module that owns a business document (a supplier invoice) asks finance to book it. These run inside the caller's
// transaction, so the document and its entry commit or roll back together. They never publish: the caller publishes the
// events they collect after its own commit.

export type SourcedEntryInput = {
  entryDate: string
  memo: string
  sourceType: SourceDocumentType
  sourceId: string
  lines: readonly JournalLineInput[]
}

/** The documents other modules book through finance. A manual entry and a reversal are made by finance itself. */
export type SourceDocumentType = Exclude<JournalSourceType, 'manual' | 'reversal'>

/** Sources whose entries are never reversed: a receipt or a return is corrected by a later document, not undone. */
const NEVER_REVERSED: ReadonlySet<SourceDocumentType> = new Set(['goods_receipt', 'purchase_return'])

export type AccountNet = { accountId: string; debitMinor: number; creditMinor: number }

/**
 * The posted debit and credit totals of some accounts, for another module's reconciliation. Accounts with no posted line
 * are returned with zero. It reads this company's ledger only.
 */
export async function getAccountTotalsWithin(tx: Queryable, tenantId: string, accountIds: readonly string[]): Promise<AccountNet[]> {
  return repository.accountTotals(tx, tenantId, [...new Set(accountIds)])
}

/** Reads accounts for another module (to validate settings). Returns only accounts of this company. */
export async function findAccountsWithin(tx: Queryable, tenantId: string, ids: readonly string[]): Promise<Account[]> {
  return repository.findAccountsByIds(tx, tenantId, [...new Set(ids)].sort())
}

/**
 * Creates and posts one entry that belongs to a source document. The balance is checked here and again by the database,
 * together with the accounts and the open fiscal period.
 */
export async function postSourcedEntryWithin(
  tx: Queryable,
  auth: AuthContext,
  input: SourcedEntryInput,
  events: FinanceEvent[]
): Promise<JournalEntryDetail> {
  requirePermission(auth, permissions.financeJournalCreate)
  requirePermission(auth, permissions.financeJournalPost)
  const { totalMinor } = assertPostable(input.lines)
  await requireUsableAccounts(tx, auth.tenantId, input.lines.map((line) => line.accountId))
  await requireOpenPeriod(tx, auth.tenantId, input.entryDate)
  const number = await nextSequenceValue(tx, auth.tenantId, 'journal')
  const id = await repository.insertEntry(tx, auth.tenantId, auth.userId, {
    number,
    entryDate: input.entryDate,
    memo: input.memo,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    reversesId: null,
  })
  await repository.insertLines(tx, auth.tenantId, auth.userId, id, input.lines)
  const draft = await repository.findEntryDetail(tx, auth.tenantId, id)
  if (!draft) throw entryNotFound()
  await audit(tx, auth, 'journal_entry', id, 'create', null, draft)
  if (!(await repository.postEntry(tx, auth.tenantId, id, auth.userId, draft.version))) throw versionConflict('journal entry')
  const posted = await repository.findEntryDetail(tx, auth.tenantId, id)
  if (!posted) throw entryNotFound()
  await audit(tx, auth, 'journal_entry', id, 'update', draft, posted)
  events.push(
    { ...eventBase(auth), name: 'finance.journal.created', payload: { ...journalRef(posted), createdBy: auth.userId } },
    {
      ...eventBase(auth),
      name: 'finance.journal.posted',
      payload: { ...journalRef(posted), totalMinor, currency: 'KWD', sourceType: input.sourceType, postedBy: auth.userId },
    }
  )
  return posted
}

/**
 * Reverses a posted entry that came from a source document, for the module that owns that document (voiding the invoice).
 * The database refuses to reverse such an entry any other way, so the caller names it in a transaction-local setting first.
 */
export async function reverseSourcedEntryWithin(
  tx: Queryable,
  auth: AuthContext,
  input: { entryId: string; sourceType: SourceDocumentType; entryDate: string; memo: string },
  events: FinanceEvent[]
): Promise<JournalEntryDetail> {
  requirePermission(auth, permissions.financeJournalReverse)
  requirePermission(auth, permissions.financeJournalPost)
  if (NEVER_REVERSED.has(input.sourceType)) {
    throw new AppError(409, 'entry_not_reversible', 'An entry made by this kind of document is never reversed.')
  }
  const original = await repository.findEntry(tx, auth.tenantId, input.entryId, { lock: true })
  if (!original) throw entryNotFound()
  if (original.sourceType !== input.sourceType) throw new AppError(409, 'entry_source_mismatch', 'The entry does not come from this kind of document.')
  if (original.status !== 'posted') throw new AppError(409, 'entry_not_posted', 'Only a posted journal entry can be reversed.')
  if (await repository.findReversalOf(tx, auth.tenantId, input.entryId)) {
    throw new AppError(409, 'already_reversed', 'The journal entry was already reversed.')
  }
  await requireOpenPeriod(tx, auth.tenantId, input.entryDate)
  const lines = reverseLines(await repository.findEntryLines(tx, auth.tenantId, input.entryId))
  const number = await nextSequenceValue(tx, auth.tenantId, 'journal')
  await tx.query(`select set_config('erp.source_void', $1, true)`, [input.entryId])
  const reversalId = await repository.insertEntry(tx, auth.tenantId, auth.userId, {
    number,
    entryDate: input.entryDate,
    memo: input.memo || `Reversal of entry ${original.number}`,
    sourceType: 'reversal',
    reversesId: input.entryId,
  })
  await tx.query(`select set_config('erp.source_void', '', true)`)
  await repository.insertLines(tx, auth.tenantId, auth.userId, reversalId, lines)
  const draft = await repository.findEntryDetail(tx, auth.tenantId, reversalId)
  if (!draft) throw entryNotFound()
  await audit(tx, auth, 'journal_entry', reversalId, 'create', null, draft)
  if (!(await repository.postEntry(tx, auth.tenantId, reversalId, auth.userId, draft.version))) throw versionConflict('journal entry')
  const posted = await repository.findEntryDetail(tx, auth.tenantId, reversalId)
  if (!posted) throw entryNotFound()
  await audit(tx, auth, 'journal_entry', reversalId, 'update', draft, posted)
  events.push(
    {
      ...eventBase(auth),
      name: 'finance.journal.posted',
      payload: { ...journalRef(posted), totalMinor: toSafeMinor(sumLines(posted.lines).debit), currency: 'KWD', sourceType: 'reversal', postedBy: auth.userId },
    },
    {
      ...eventBase(auth),
      name: 'finance.journal.reversed',
      payload: { ...journalRef(original), reversalId, reversalNumber: posted.number, reversedBy: auth.userId },
    }
  )
  return posted
}