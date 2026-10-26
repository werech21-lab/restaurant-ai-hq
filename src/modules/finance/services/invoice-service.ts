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
  restoreInvoiceStock,
  validateStockLines,
  type InventoryEvent,
} from '@/modules/inventory'
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
  const [lines, payments] = await Promise.all([
    repository.listLines(tx, tenantId, invoice.id),
    repository.listPayments(tx, tenantId, invoice.id),
  ])
  return { ...invoice, lines, payments }
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
    await issueInvoiceStock(tx, auth, { id: updated.id, number: updated.number }, lines, stockEvents)
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
    await issueInvoiceStock(tx, auth, { id: updated.id, number: updated.number }, lines, stockEvents)
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
