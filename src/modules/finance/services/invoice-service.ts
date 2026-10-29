import { AppError } from '@/lib/api/errors'
import type { Page } from '@/lib/api/cursor'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { db, withTransaction, type Queryable } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { nextSequenceValue } from '@/lib/sequences'
import { findCustomer } from '@/modules/crm'
import {
  issueInvoiceStock,
  publishInventoryEvents,
  readCostingWithin,
  restoreInvoiceStock,
  validateStockLines,
  type InventoryEvent,
} from '@/modules/inventory'
import { findAccountsWithin, findActiveSourcedEntryWithin, postSourcedEntryWithin, reverseSourcedEntryWithin } from '@/modules/finance/services/ledger-service'
import { buildCollectionLines, buildRevenueLines } from '@/modules/finance/domain/operational-posting'
import {
  applyPayment,
  approve as approveRule,
  assertEditable,
  formatInvoiceNumber,
  submit as submitRule,
  voidInvoice as voidRule,
} from '@/modules/finance/domain/invoice'
import { computeTotals } from '@/modules/finance/domain/totals'
import type {
  CustomerFinancials,
  InvoiceBalance,
  ReceivableSignal,
  FinanceSettings,
  Invoice,
  InvoiceDetail,
  InvoiceSummary,
  Payment,
} from '@/modules/finance/domain/types'
import { publishFinanceEvents, type FinanceEvent } from '@/modules/finance/events'
import * as repository from '@/modules/finance/repositories/invoice-repository'
import type {
  CreateInvoiceInput,
  ListInvoicesQuery,
  RecordPaymentInput,
  UpdateInvoiceInput,
  VersionBody,
  VoidInvoiceInput,
} from '@/modules/finance/schemas/invoice'

export type InvoiceBody = { data: InvoiceDetail }
export type PaymentBody = { data: { invoice: InvoiceDetail; payment: Payment } }

const CREATE_SCOPE = 'finance.invoice.create'
const PAYMENT_SCOPE = 'finance.payment.create'
const COLLECTION_SCOPE = 'finance.collection.post'
const REVENUE_SCOPE = 'finance.revenue.post'

function collectionDate(paidAt: string): string {
  return new Date(paidAt).toISOString().slice(0, 10)
}

async function bookCollection(
  tx: Queryable,
  auth: AuthContext,
  payment: { id: string; amountMinor: number; paidAt: string },
  invoiceNumber: string,
  events: FinanceEvent[]
): Promise<string | null> {
  const accounts = await repository.getOperationalAccounts(tx, auth.tenantId)
  if (!accounts?.receivableAccountId || !accounts.collectionAccountId) return null
  const existing = await findActiveSourcedEntryWithin(tx, auth.tenantId, 'customer_collection', payment.id)
  if (existing) return existing
  const found = await findAccountsWithin(tx, auth.tenantId, [accounts.receivableAccountId, accounts.collectionAccountId])
  const byId = new Map(found.map((account) => [account.id, account]))
  const cash = byId.get(accounts.collectionAccountId)
  const receivable = byId.get(accounts.receivableAccountId)
  if (!cash || !receivable || cash.type !== 'asset' || receivable.type !== 'asset' || !cash.isPostable || !receivable.isPostable) {
    throw new DomainError('accounts_not_configured', 'Collection needs a postable asset cash account and a postable asset receivable account.')
  }
  const memo = `Collection ${invoiceNumber}`
  const entry = await postSourcedEntryWithin(
    tx,
    auth,
    {
      entryDate: collectionDate(payment.paidAt),
      memo,
      sourceType: 'customer_collection',
      sourceId: payment.id,
      lines: buildCollectionLines(payment.amountMinor, cash.id, receivable.id, memo),
    },
    events
  )
  return entry.id
}

async function bookRevenue(
  tx: Queryable,
  auth: AuthContext,
  invoice: { id: string; number: string; issueDate: string; totalMinor: number },
  events: FinanceEvent[]
): Promise<string | null> {
  if (!Number.isSafeInteger(invoice.totalMinor) || invoice.totalMinor <= 0) return null
  const accounts = await repository.getOperationalAccounts(tx, auth.tenantId)
  if (!accounts?.receivableAccountId || !accounts.revenueAccountId) return null
  const existing = await findActiveSourcedEntryWithin(tx, auth.tenantId, 'sales_revenue', invoice.id)
  if (existing) return existing
  const found = await findAccountsWithin(tx, auth.tenantId, [accounts.receivableAccountId, accounts.revenueAccountId])
  const byId = new Map(found.map((account) => [account.id, account]))
  const receivable = byId.get(accounts.receivableAccountId)
  const revenue = byId.get(accounts.revenueAccountId)
  if (!receivable || !revenue || receivable.type !== 'asset' || revenue.type !== 'revenue' || !receivable.isPostable || !revenue.isPostable) {
    throw new DomainError('accounts_not_configured', 'Sales revenue needs a postable asset receivable account and a postable revenue account.')
  }
  const memo = `Sales ${invoice.number}`
  const entry = await postSourcedEntryWithin(
    tx,
    auth,
    {
      entryDate: invoice.issueDate,
      memo,
      sourceType: 'sales_revenue',
      sourceId: invoice.id,
      lines: buildRevenueLines(invoice.totalMinor, receivable.id, revenue.id, memo),
    },
    events
  )
  return entry.id
}
const SEQUENCE_NAME = 'finance.invoice'

function invoiceNotFound(): AppError {
  return new AppError(404, 'invoice_not_found', 'The invoice was not found.')
}

function versionConflict(): AppError {
  return new AppError(409, 'version_conflict', 'The invoice was changed by someone else. Reload it and try again.')
}

async function requireSettings(tx: Queryable, tenantId: string): Promise<FinanceSettings> {
  const settings = await repository.getSettings(tx, tenantId)
  if (!settings) {
    throw new DomainError('finance_not_configured', 'Finance settings are missing for this tenant.')
  }
  return settings
}

async function requireCustomer(tx: Queryable, tenantId: string, customerId: string) {
  const customer = await findCustomer(tx, tenantId, customerId)
  if (!customer) {
    throw new DomainError('customer_not_found', 'The customer does not exist.')
  }
  if (customer.status !== 'active') {
    throw new DomainError('customer_inactive', 'The customer is not active, so it cannot be invoiced.')
  }
  return customer
}

/** Loads and locks an invoice for the rest of the transaction, then checks the caller's version. */
async function lockInvoice(tx: Queryable, tenantId: string, id: string, expectedVersion: number): Promise<Invoice> {
  const invoice = await repository.findInvoice(tx, tenantId, id, { lock: true })
  if (!invoice) throw invoiceNotFound()
  if (invoice.version !== expectedVersion) throw versionConflict()
  return invoice
}

async function loadDetail(tx: Queryable, tenantId: string, invoice: Invoice): Promise<InvoiceDetail> {
  const [lines, payments, cogsEntryId] = await Promise.all([
    repository.listLines(tx, tenantId, invoice.id),
    repository.listPayments(tx, tenantId, invoice.id),
    findActiveSourcedEntryWithin(tx, tenantId, 'sales_cogs', invoice.id),
  ])
  return { ...invoice, lines, payments, cogsEntryId }
}

function ref(invoice: Invoice) {
  return {
    invoiceId: invoice.id,
    number: invoice.number,
    customerId: invoice.customerId,
    totalMinor: invoice.totalMinor,
    currency: invoice.currency,
  }
}

/** Publishes finance and inventory events after the transaction has committed. */
async function publishAll(events: readonly FinanceEvent[], stockEvents: readonly InventoryEvent[]): Promise<void> {
  await publishFinanceEvents(events)
  await publishInventoryEvents(stockEvents)
}

function eventBase(auth: AuthContext) {
  return { version: 1 as const, occurredAt: new Date().toISOString(), tenantId: auth.tenantId }
}

async function audit(
  tx: Queryable,
  auth: AuthContext,
  entity: 'invoice' | 'payment',
  entityId: string,
  action: 'create' | 'update',
  before: unknown,
  after: unknown
): Promise<void> {
  await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity, entityId, action, before, after })
}

/**
 * Creates a draft invoice inside the caller's transaction. Used by `createInvoice` and by other modules' public flows
 * (a quotation conversion) that must create the invoice, move stock and change their own rows atomically.
 * The caller owns the transaction, idempotency and publishing the collected events after commit.
 */
export async function createInvoiceWithin(
  tx: Queryable,
  auth: AuthContext,
  input: CreateInvoiceInput,
  events: FinanceEvent[]
): Promise<InvoiceDetail> {
  const settings = await requireSettings(tx, auth.tenantId)
  const customer = await requireCustomer(tx, auth.tenantId, input.customerId)
  await validateStockLines(tx, auth.tenantId, input.lines)
  const totals = computeTotals(input.lines)
  const sequence = await nextSequenceValue(tx, auth.tenantId, SEQUENCE_NAME)
  const invoice = await repository.insertInvoice(tx, auth.tenantId, auth.userId, {
    number: formatInvoiceNumber(settings.invoicePrefix, sequence),
    customerId: customer.id,
    customerName: customer.name,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    notes: input.notes,
    ...totals,
  })
  await repository.insertLines(tx, auth.tenantId, auth.userId, invoice.id, input.lines)
  const detail = await loadDetail(tx, auth.tenantId, invoice)
  await audit(tx, auth, 'invoice', invoice.id, 'create', null, detail)
  events.push({
    ...eventBase(auth),
    name: 'finance.invoice.created',
    payload: { ...ref(invoice), createdBy: auth.userId },
  })
  return detail
}

export async function createInvoice(
  auth: AuthContext,
  idempotencyKey: string,
  input: CreateInvoiceInput
): Promise<IdempotentResult<InvoiceBody>> {
  const events: FinanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<InvoiceBody>(
      tx,
      { tenantId: auth.tenantId, scope: CREATE_SCOPE, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => ({ status: 201, body: { data: await createInvoiceWithin(tx, auth, input, events) } })
    )
  )
  if (!outcome.replayed) await publishFinanceEvents(events)
  return outcome
}

export async function updateInvoice(auth: AuthContext, id: string, input: UpdateInvoiceInput): Promise<InvoiceBody> {
  const events: FinanceEvent[] = []
  const body = await withTransaction(async (tx): Promise<InvoiceBody> => {
    const current = await lockInvoice(tx, auth.tenantId, id, input.version)
    assertEditable(current)
    const before = await loadDetail(tx, auth.tenantId, current)
    const customer = await requireCustomer(tx, auth.tenantId, input.customerId)
    await validateStockLines(tx, auth.tenantId, input.lines)
    const totals = computeTotals(input.lines)
    const updated = await repository.updateDraftHeader(tx, auth.tenantId, id, input.version, {
      customerId: customer.id,
      customerName: customer.name,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      notes: input.notes,
      ...totals,
    })
    if (!updated) throw versionConflict()
    await repository.deleteLines(tx, auth.tenantId, id)
    await repository.insertLines(tx, auth.tenantId, auth.userId, id, input.lines)
    const after = await loadDetail(tx, auth.tenantId, updated)
    await audit(tx, auth, 'invoice', id, 'update', before, after)
    events.push({
      ...eventBase(auth),
      name: 'finance.invoice.updated',
      payload: { ...ref(updated), updatedBy: auth.userId },
    })
    return { data: after }
  })
  await publishFinanceEvents(events)
  return body
}

/**
 * Submits a draft invoice inside the caller's transaction: issued (and stock taken) when the total is within the approval
 * limit, otherwise pending approval. The caller owns the transaction and publishes both event lists after commit.
 */
/**
 * Issues the stock and, when the company has chosen moving weighted average, posts COGS at the average in force.
 * Order price posts nothing to the ledger. A missing COGS account fails the issue instead of skipping the entry.
 */
async function postCostOfGoods(
  tx: Queryable,
  auth: AuthContext,
  invoice: { id: string; number: string; issueDate: string },
  lines: readonly { itemId: string | null; warehouseId: string | null; quantity: number }[],
  events: FinanceEvent[],
  stockEvents: InventoryEvent[]
): Promise<void> {
  const policy = await readCostingWithin(tx, auth.tenantId)
  if (policy.method === 'moving_weighted_average' && (!policy.cogsAccountId || !policy.inventoryAccountId)) {
    throw new AppError(409, 'cogs_account_required', 'Choose a COGS account and an inventory account before issuing stock under moving weighted average.')
  }
  const costs = await issueInvoiceStock(tx, auth, { id: invoice.id, number: invoice.number }, lines, stockEvents)
  if (policy.method !== 'moving_weighted_average') return
  const amount = costs.reduce((sum, cost) => sum + cost.amountMinor, 0)
  if (amount <= 0) return
  const memo = `COGS ${invoice.number}`
  await postSourcedEntryWithin(
    tx,
    auth,
    {
      entryDate: invoice.issueDate,
      memo,
      sourceType: 'sales_cogs',
      sourceId: invoice.id,
      lines: [
        { accountId: policy.cogsAccountId ?? '', debitMinor: amount, creditMinor: 0, description: memo },
        { accountId: policy.inventoryAccountId ?? '', debitMinor: 0, creditMinor: amount, description: memo },
      ],
    },
    events
  )
}

export async function submitInvoiceWithin(
  tx: Queryable,
  auth: AuthContext,
  id: string,
  input: VersionBody,
  events: FinanceEvent[],
  stockEvents: InventoryEvent[]
): Promise<InvoiceDetail> {
  const current = await lockInvoice(tx, auth.tenantId, id, input.version)
  const settings = await requireSettings(tx, auth.tenantId)
  const lines = await repository.listLines(tx, auth.tenantId, id)
  const decision = submitRule(
    { status: current.status, totalMinor: current.totalMinor, lineCount: lines.length },
    settings.approvalThresholdMinor
  )
  const updated = await repository.applyStatusChange(tx, auth.tenantId, id, input.version, {
    status: decision.status,
    requiresApproval: decision.requiresApproval,
    submittedAt: 'now',
  })
  if (!updated) throw versionConflict()
  await audit(tx, auth, 'invoice', id, 'update', current, updated)
  events.push({
    ...eventBase(auth),
    name: 'finance.invoice.submitted',
    payload: { ...ref(updated), requiresApproval: decision.requiresApproval, submittedBy: auth.userId },
  })
  if (updated.status === 'issued') {
    // Stock leaves in the same transaction. Not enough stock throws and the whole submit rolls back.
    await postCostOfGoods(tx, auth, updated, lines, events, stockEvents)
    await bookRevenue(tx, auth, updated, events)
    events.push({ ...eventBase(auth), name: 'finance.invoice.issued', payload: ref(updated) })
  }
  return loadDetail(tx, auth.tenantId, updated)
}

export async function submitInvoice(auth: AuthContext, id: string, input: VersionBody): Promise<InvoiceBody> {
  const events: FinanceEvent[] = []
  const stockEvents: InventoryEvent[] = []
  const body = await withTransaction(
    async (tx): Promise<InvoiceBody> => ({ data: await submitInvoiceWithin(tx, auth, id, input, events, stockEvents) })
  )
  await publishAll(events, stockEvents)
  return body
}

export async function approveInvoice(auth: AuthContext, id: string, input: VersionBody): Promise<InvoiceBody> {
  const events: FinanceEvent[] = []
  const stockEvents: InventoryEvent[] = []
  const body = await withTransaction(async (tx): Promise<InvoiceBody> => {
    const current = await lockInvoice(tx, auth.tenantId, id, input.version)
    const next = approveRule(current)
    const updated = await repository.applyStatusChange(tx, auth.tenantId, id, input.version, {
      status: next.status,
      approvedBy: auth.userId,
    })
    if (!updated) throw versionConflict()
    await audit(tx, auth, 'invoice', id, 'update', current, updated)
    const lines = await repository.listLines(tx, auth.tenantId, id)
    await postCostOfGoods(tx, auth, updated, lines, events, stockEvents)
    await bookRevenue(tx, auth, updated, events)
    events.push(
      { ...eventBase(auth), name: 'finance.invoice.approved', payload: { ...ref(updated), approvedBy: auth.userId } },
      { ...eventBase(auth), name: 'finance.invoice.issued', payload: ref(updated) }
    )
    return { data: await loadDetail(tx, auth.tenantId, updated) }
  })
  await publishAll(events, stockEvents)
  return body
}

export async function voidInvoice(auth: AuthContext, id: string, input: VoidInvoiceInput): Promise<InvoiceBody> {
  const events: FinanceEvent[] = []
  const stockEvents: InventoryEvent[] = []
  const body = await withTransaction(async (tx): Promise<InvoiceBody> => {
    const current = await lockInvoice(tx, auth.tenantId, id, input.version)
    const next = voidRule(current, input.reason)
    const updated = await repository.applyStatusChange(tx, auth.tenantId, id, input.version, {
      status: next.status,
      voidReason: input.reason,
    })
    if (!updated) throw versionConflict()
    await audit(tx, auth, 'invoice', id, 'update', current, updated)
    // Only an issued invoice has taken stock. Void is refused once a payment exists, so this is always an unpaid invoice.
    if (current.status === 'issued') {
      const cogsId = await findActiveSourcedEntryWithin(tx, auth.tenantId, 'sales_cogs', updated.id)
      if (cogsId) {
        await reverseSourcedEntryWithin(
          tx,
          auth,
          { entryId: cogsId, sourceType: 'sales_cogs', entryDate: current.issueDate, memo: `Void COGS ${updated.number}` },
          events
        )
      }
      const revenueId = await findActiveSourcedEntryWithin(tx, auth.tenantId, 'sales_revenue', updated.id)
      if (revenueId) {
        await reverseSourcedEntryWithin(
          tx,
          auth,
          { entryId: revenueId, sourceType: 'sales_revenue', entryDate: current.issueDate, memo: `Void sales ${updated.number}` },
          events
        )
      }
      await restoreInvoiceStock(tx, auth, { id: updated.id, number: updated.number }, stockEvents)
    }
    events.push({
      ...eventBase(auth),
      name: 'finance.invoice.voided',
      payload: { ...ref(updated), voidedBy: auth.userId, reason: input.reason },
    })
    return { data: await loadDetail(tx, auth.tenantId, updated) }
  })
  await publishAll(events, stockEvents)
  return body
}

export async function recordPayment(
  auth: AuthContext,
  id: string,
  idempotencyKey: string,
  input: RecordPaymentInput
): Promise<IdempotentResult<PaymentBody>> {
  const events: FinanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<PaymentBody>(
      tx,
      {
        tenantId: auth.tenantId,
        scope: `${PAYMENT_SCOPE}:${id}`,
        key: idempotencyKey,
        requestHash: hashRequest(input),
      },
      async () => {
        const current = await lockInvoice(tx, auth.tenantId, id, input.version)
        const result = applyPayment(current, { amountMinor: input.amountMinor, currency: input.currency })
        const payment = await repository.insertPayment(tx, auth.tenantId, auth.userId, {
          invoiceId: id,
          amountMinor: input.amountMinor,
          method: input.method,
          paidAt: input.paidAt,
          reference: input.reference,
        })
        const updated = await repository.applyStatusChange(tx, auth.tenantId, id, input.version, {
          status: result.status,
          paidMinor: result.paidMinor,
        })
        if (!updated) throw versionConflict()
        await audit(tx, auth, 'payment', payment.id, 'create', null, payment)
        await audit(tx, auth, 'invoice', id, 'update', current, updated)
        await bookCollection(tx, auth, payment, updated.number, events)
        events.push({
          ...eventBase(auth),
          name: 'finance.payment.recorded',
          payload: {
            ...ref(updated),
            paymentId: payment.id,
            amountMinor: payment.amountMinor,
            paidMinor: updated.paidMinor,
            recordedBy: auth.userId,
          },
        })
        if (updated.status === 'paid') {
          events.push({ ...eventBase(auth), name: 'finance.invoice.paid', payload: ref(updated) })
        }
        const invoice = await loadDetail(tx, auth.tenantId, updated)
        return { status: 201, body: { data: { invoice, payment } } }
      }
    )
  )
  if (!outcome.replayed) await publishFinanceEvents(events)
  if (outcome.replayed) {
    const extra: FinanceEvent[] = []
    await withTransaction((tx) => bookCollection(tx, auth, outcome.body.data.payment, outcome.body.data.invoice.number, extra))
    if (extra.length > 0) await publishFinanceEvents(extra)
  }
  return outcome
}

/** Posts a cash/receivable entry for every collection that does not have one yet. */
export async function postOpenCollections(auth: AuthContext, idempotencyKey: string): Promise<IdempotentResult<{ data: { posted: number } }>> {
  const events: FinanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<{ data: { posted: number } }>(
      tx,
      { tenantId: auth.tenantId, scope: COLLECTION_SCOPE, key: idempotencyKey, requestHash: hashRequest({ scope: COLLECTION_SCOPE }) },
      async () => {
        const accounts = await repository.getOperationalAccounts(tx, auth.tenantId)
        if (!accounts?.receivableAccountId || !accounts.collectionAccountId) {
          throw new DomainError('accounts_not_configured', 'Choose the cash and receivable accounts before posting collections.')
        }
        const open = await repository.listUnjournaledPayments(tx, auth.tenantId)
        for (const payment of open) await bookCollection(tx, auth, payment, payment.invoiceNumber, events)
        return { status: 200, body: { data: { posted: open.length } } }
      }
    )
  )
  if (!outcome.replayed) await publishFinanceEvents(events)
  return outcome
}

/** Posts the receivable and sales entry for every issued invoice that does not have one yet. */
export async function postOpenRevenue(auth: AuthContext, idempotencyKey: string): Promise<IdempotentResult<{ data: { posted: number } }>> {
  const events: FinanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<{ data: { posted: number } }>(
      tx,
      { tenantId: auth.tenantId, scope: REVENUE_SCOPE, key: idempotencyKey, requestHash: hashRequest({ scope: REVENUE_SCOPE }) },
      async () => {
        const accounts = await repository.getOperationalAccounts(tx, auth.tenantId)
        if (!accounts?.receivableAccountId || !accounts.revenueAccountId) {
          throw new DomainError('accounts_not_configured', 'Choose the receivable and sales accounts before posting sales revenue.')
        }
        const open = await repository.listUnjournaledSales(tx, auth.tenantId)
        for (const invoice of open) await bookRevenue(tx, auth, invoice, events)
        return { status: 200, body: { data: { posted: open.length } } }
      }
    )
  )
  if (!outcome.replayed) await publishFinanceEvents(events)
  return outcome
}

export function listInvoices(auth: AuthContext, query: ListInvoicesQuery): Promise<Page<Invoice>> {
  return repository.listInvoices(db, auth.tenantId, query)
}

export async function getInvoice(auth: AuthContext, id: string): Promise<InvoiceBody> {
  const invoice = await repository.findInvoice(db, auth.tenantId, id)
  if (!invoice) throw invoiceNotFound()
  return { data: await loadDetail(db, auth.tenantId, invoice) }
}

/**
 * What a customer owes and has been invoiced. Runs in the caller's transaction so a credit check and the invoice it
 * guards see the same data. Open balance is issued and partially paid invoices; drafts and pending approval are not counted.
 */
export function getCustomerFinancials(tx: Queryable, tenantId: string, customerId: string): Promise<CustomerFinancials> {
  return repository.customerFinancials(tx, tenantId, customerId)
}

export async function getInvoiceSummary(auth: AuthContext): Promise<{ data: InvoiceSummary }> {
  const settings = await requireSettings(db, auth.tenantId)
  return { data: await repository.summarize(db, auth.tenantId, settings.approvalThresholdMinor) }
}

/** Customers with open invoices overdue by at least minDaysOverdue days, for the AI engine. Runs in the caller's transaction. */
export function listReceivableSignals(tx: Queryable, tenantId: string, minDaysOverdue: number): Promise<ReceivableSignal[]> {
  return repository.receivableSignals(tx, tenantId, minDaysOverdue)
}

export function getOperationalAccountsWithin(tx: Queryable, tenantId: string): Promise<repository.OperationalAccounts | null> {
  return repository.getOperationalAccounts(tx, tenantId)
}

/** Current status and unpaid balance of the given invoices, for the AI engine. Runs in the caller's transaction. */
export function getInvoiceBalances(tx: Queryable, tenantId: string, ids: readonly string[]): Promise<InvoiceBalance[]> {
  return repository.invoiceBalances(tx, tenantId, ids)
}
