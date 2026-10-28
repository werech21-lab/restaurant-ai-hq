import { randomUUID } from 'node:crypto'
import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import type { AuthContext } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'
import { isUniqueViolation, requirePermission, versionConflict } from '@/lib/auth/require'
import { db, withTransaction, type Queryable } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { nextSequenceValue } from '@/lib/sequences'
import {
  findAccountsWithin,
  postSourcedEntryWithin,
  publishFinanceEvents,
  reverseSourcedEntryWithin,
  type FinanceEvent,
} from '@/modules/finance'
import { setCostingPolicyWithin } from '@/modules/inventory'
import { addDays, assertInvoiceCurrency, assertTotalMatches, canInvoiceOrder, canVoidInvoice } from '@/modules/procurement/domain/invoice'
import { evaluateMatch } from '@/modules/procurement/domain/match'
import { buildInvoiceLines } from '@/modules/procurement/domain/posting'
import type { MatchResult, ProcurementAccounting, SupplierInvoice, SupplierInvoiceDetail } from '@/modules/procurement/domain/types'
import { publishProcurementEvents, type ProcurementEvent } from '@/modules/procurement/events'
import * as repository from '@/modules/procurement/repositories/invoice-repository'
import * as procurementRepository from '@/modules/procurement/repositories/procurement-repository'
import type {
  CreateSupplierInvoiceInput,
  ListSupplierInvoicesQuery,
  MatchPreviewInput,
  UpdateAccountingInput,
  VoidSupplierInvoiceInput,
} from '@/modules/procurement/schemas/invoice'
import { audit, eventBase, loadDetail as loadOrderDetail, orderNotFound } from '@/modules/procurement/services/procurement-service'
import { reclassVariance } from '@/modules/procurement/services/valuation-bridge'

export type InvoiceBody = { data: SupplierInvoiceDetail }
export type AccountingBody = { data: ProcurementAccounting }
export type MatchBody = { data: MatchResult }

const CREATE_SCOPE = 'procurement.invoice.create'

const invoiceNotFound = () => new AppError(404, 'invoice_not_found', 'The supplier invoice was not found.')

async function loadInvoice(tx: Queryable, tenantId: string, id: string): Promise<SupplierInvoiceDetail> {
  const detail = await repository.findInvoiceDetail(tx, tenantId, id)
  if (!detail) throw invoiceNotFound()
  return detail
}

/** The database refuses a basis or account change after documents exist; this turns that into a clear 409. */
function isRuleViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23001'
}

// ---- accounting settings ----

export async function getAccounting(auth: AuthContext): Promise<AccountingBody> {
  requirePermission(auth, permissions.procurementInvoiceRead)
  return { data: await repository.findAccounting(db, auth.tenantId) }
}

/**
 * Chooses the accounts and the match tolerances. The inventory account must be an asset, the payable and GRNI accounts
 * liabilities, the price variance account an expense. Every account must be active, postable and different from the others.
 * The receipt basis needs the GRNI and the variance account. The basis cannot change once a receipt or an invoice exists, and
 * the accounts cannot change once a procurement entry was posted.
 */
export async function updateAccounting(auth: AuthContext, input: UpdateAccountingInput): Promise<AccountingBody> {
  requirePermission(auth, permissions.procurementSettingsManage)
  const accounting = await withTransaction(async (tx) => {
    const before = await repository.findAccounting(tx, auth.tenantId, { lock: true })
    if (before.version !== input.version) throw versionConflict('accounting settings')
    const ids = [
      input.inventoryAccountId,
      input.payableAccountId,
      ...(input.inputTaxAccountId ? [input.inputTaxAccountId] : []),
      ...(input.grniAccountId ? [input.grniAccountId] : []),
      ...(input.ppvAccountId ? [input.ppvAccountId] : []),
      ...(input.cogsAccountId ? [input.cogsAccountId] : []),
    ]
    if (new Set(ids).size !== ids.length) throw new AppError(422, 'accounts_not_distinct', 'The procurement accounts must all be different.')
    if (input.accountingBasis === 'receipt_basis' && (!input.grniAccountId || !input.ppvAccountId)) {
      throw new AppError(422, 'accounts_not_configured', 'The receipt basis needs a GRNI account and a purchase price variance account.')
    }
    const found = await findAccountsWithin(tx, auth.tenantId, ids)
    const byId = new Map(found.map((account) => [account.id, account]))
    if (found.length !== ids.length) throw new AppError(422, 'account_not_found', 'An account does not exist.')
    if (byId.get(input.inventoryAccountId)?.type !== 'asset') throw new AppError(422, 'account_type_invalid', 'The inventory account must be an asset account.')
    if (byId.get(input.payableAccountId)?.type !== 'liability') throw new AppError(422, 'account_type_invalid', 'The payable account must be a liability account.')
    if (input.grniAccountId && byId.get(input.grniAccountId)?.type !== 'liability') {
      throw new AppError(422, 'account_type_invalid', 'The GRNI account must be a liability account.')
    }
    if (input.ppvAccountId && byId.get(input.ppvAccountId)?.type !== 'expense') {
      throw new AppError(422, 'account_type_invalid', 'The purchase price variance account must be an expense account.')
    }
    if (input.costingMethod === 'moving_weighted_average' && !input.cogsAccountId) {
      throw new AppError(422, 'accounts_not_configured', 'Moving weighted average needs a cost of goods account.')
    }
    if (input.cogsAccountId && byId.get(input.cogsAccountId)?.type !== 'expense') {
      throw new AppError(422, 'account_type_invalid', 'The cost of goods account must be an expense account.')
    }
    if (before.version > 0 && before.costingMethod !== input.costingMethod) {
      const receipts = await tx.query('select 1 from goods_receipts where tenant_id = $1 limit 1', [auth.tenantId])
      if (receipts.rows.length > 0) {
        throw new AppError(409, 'costing_method_locked', 'The costing method cannot change once a goods receipt exists.')
      }
    }
    if (found.some((account) => !account.isActive || !account.isPostable)) {
      throw new AppError(422, 'account_not_postable', 'An account is inactive or not postable.')
    }
    try {
      if (before.version === 0) {
        await repository.insertAccounting(tx, auth.tenantId, auth.userId, input)
      } else if (!(await repository.updateAccounting(tx, auth.tenantId, input.version, input))) {
        throw versionConflict('accounting settings')
      }
    } catch (error) {
      if (isUniqueViolation(error)) throw versionConflict('accounting settings')
      if (isRuleViolation(error)) {
        throw new AppError(409, 'accounting_locked', 'The basis cannot change once receipts or invoices exist, and the accounts cannot change once entries were posted.')
      }
      throw error
    }
    await setCostingPolicyWithin(tx, auth, {
      method: input.costingMethod,
      cogsAccountId: input.cogsAccountId,
      inventoryAccountId: input.inventoryAccountId,
    })
    const after = await repository.findAccounting(tx, auth.tenantId)
    const first = before.version === 0
    // Version 0 is the defaults the reader synthesises when no row exists yet, so a create has no previous state.
    await audit(tx, auth, 'procurement_accounting', auth.tenantId, first ? 'create' : 'update', first ? null : before, after)
    return after
  })
  return { data: accounting }
}

// ---- three-way match ----

/**
 * Matches an invoice against the order, what was received and the company's tolerances, and writes nothing. It is the same
 * evaluation the booking runs, so a `blocked` result is exactly what the booking would refuse.
 */
export async function previewMatch(auth: AuthContext, input: MatchPreviewInput): Promise<MatchBody> {
  // A POST that writes nothing; it needs the permission of the booking it previews, so a read-only role cannot call a POST route.
  requirePermission(auth, permissions.procurementInvoiceCreate)
  const order = await procurementRepository.findOrder(db, auth.tenantId, input.orderId)
  if (!order) throw orderNotFound()
  const accounting = await repository.findAccounting(db, auth.tenantId)
  const lines = await procurementRepository.findOrderLines(db, auth.tenantId, order.id)
  const { result } = evaluateMatch(lines, input.lines, { priceToleranceBps: accounting.priceToleranceBps, taxToleranceMinor: accounting.taxToleranceMinor })
  return { data: result }
}

// ---- supplier invoices ----

/**
 * Books a supplier invoice for goods that were received. One transaction: it locks the order, matches the lines against what is
 * received and not yet invoiced (after returns and credit notes) and against the price and tax tolerances, creates and posts
 * one balanced journal entry through finance, then writes the invoice and its lines. The database checks the quantity limit,
 * the price tolerance, the totals, the variances and the entry account by account again. Any failure rolls back the invoice and
 * the entry together. Events go out after the commit.
 */
export async function createSupplierInvoice(
  auth: AuthContext,
  idempotencyKey: string,
  input: CreateSupplierInvoiceInput
): Promise<IdempotentResult<InvoiceBody>> {
  requirePermission(auth, permissions.procurementInvoiceCreate)
  assertInvoiceCurrency(input.currency)
  const events: ProcurementEvent[] = []
  const financeEvents: FinanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<InvoiceBody>(
      tx,
      { tenantId: auth.tenantId, scope: CREATE_SCOPE, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        const order = await procurementRepository.findOrder(tx, auth.tenantId, input.orderId, { lock: true })
        if (!order) throw orderNotFound()
        if (!canInvoiceOrder(order.status)) {
          throw new AppError(409, 'order_not_invoiceable', 'Only an order that has received goods can be invoiced.')
        }
        const supplier = await procurementRepository.findSupplier(tx, auth.tenantId, order.supplierId)
        if (!supplier) throw new AppError(422, 'supplier_not_found', 'The supplier was not found.')
        if (await repository.existsActiveSupplierNumber(tx, auth.tenantId, supplier.id, input.supplierInvoiceNumber)) {
          throw new AppError(409, 'duplicate_supplier_invoice', `Invoice ${input.supplierInvoiceNumber} of this supplier is already booked.`)
        }
        const accounting = await repository.findAccounting(tx, auth.tenantId)
        const orderDetail = await loadOrderDetail(tx, auth.tenantId, order.id)
        const { result, planned } = evaluateMatch(orderDetail.lines, input.lines, {
          priceToleranceBps: accounting.priceToleranceBps,
          taxToleranceMinor: accounting.taxToleranceMinor,
        })
        const issue = result.issues[0]
        if (issue) throw new DomainError(issue.code, issue.message)
        const totals = { subtotalMinor: result.subtotalMinor, taxMinor: result.taxMinor, totalMinor: result.totalMinor }
        assertTotalMatches(input.expectedTotalMinor, totals)
        const memo = `Supplier invoice ${input.supplierInvoiceNumber} - ${supplier.name}`
        const invoiceId = randomUUID()
        const reclass = await reclassVariance(tx, auth, 'supplier_invoice', invoiceId, planned, 'invoice')
        const postingLines = buildInvoiceLines(
          accounting.accountingBasis,
          totals,
          result.poNetMinor,
          accounting,
          memo,
          accounting.accountingBasis === 'receipt_basis' ? reclass : 0
        )

        const entry = await postSourcedEntryWithin(
          tx,
          auth,
          { entryDate: input.invoiceDate, memo, sourceType: 'supplier_invoice', sourceId: invoiceId, lines: postingLines },
          financeEvents
        )
        const number = await nextSequenceValue(tx, auth.tenantId, 'supplier_invoice')
        await repository.insertInvoice(tx, auth.tenantId, auth.userId, {
          id: invoiceId,
          number,
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierInvoiceNumber: input.supplierInvoiceNumber,
          orderId: order.id,
          invoiceDate: input.invoiceDate,
          dueDate: addDays(input.invoiceDate, supplier.paymentTermsDays),
          ...totals,
          accountingBasis: accounting.accountingBasis,
          priceVarianceMinor: result.priceVarianceMinor,
          taxVarianceMinor: result.taxVarianceMinor,
          notes: input.notes,
          journalEntryId: entry.id,
        })
        await repository.insertInvoiceLines(tx, auth.tenantId, auth.userId, invoiceId, order.id, planned)
        // The deferred totals check would run at commit. Running it now keeps every failure inside this transaction's own error handling.
        await tx.query('set constraints all immediate')
        const detail = await loadInvoice(tx, auth.tenantId, invoiceId)
        await audit(tx, auth, 'supplier_invoice', invoiceId, 'create', null, detail)
        events.push({
          ...eventBase(auth),
          name: 'procurement.invoice.posted',
          payload: {
            invoiceId,
            number,
            supplierInvoiceNumber: input.supplierInvoiceNumber,
            supplierId: supplier.id,
            orderId: order.id,
            orderNumber: order.number,
            totalMinor: totals.totalMinor,
            currency: 'KWD',
            journalEntryId: entry.id,
            priceVarianceMinor: result.priceVarianceMinor,
            taxVarianceMinor: result.taxVarianceMinor,
            postedBy: auth.userId,
          },
        })
        return { status: 201, body: { data: detail } }
      }
    )
  )
  if (!outcome.replayed) {
    await publishProcurementEvents(events)
    await publishFinanceEvents(financeEvents)
  }
  return outcome
}

/**
 * Voids a posted invoice by reversing its journal entry (a new posted entry that mirrors it) and marking the invoice void, in
 * one transaction. The quantities it billed become billable again. An invoice that has a payment or a credit note cannot be
 * voided: void those first. The original entry and the invoice rows are never edited.
 */
export async function voidSupplierInvoice(auth: AuthContext, id: string, input: VoidSupplierInvoiceInput): Promise<InvoiceBody> {
  requirePermission(auth, permissions.procurementInvoiceVoid)
  const events: ProcurementEvent[] = []
  const financeEvents: FinanceEvent[] = []
  const detail = await withTransaction(async (tx) => {
    const current = await repository.findInvoice(tx, auth.tenantId, id, { lock: true })
    if (!current) throw invoiceNotFound()
    if (current.version !== input.version) throw versionConflict('supplier invoice')
    if (!canVoidInvoice(current.status)) throw new AppError(409, 'invoice_not_posted', 'Only a posted supplier invoice can be voided.')
    if (current.paidMinor > 0) throw new AppError(409, 'invoice_has_payments', 'An invoice with a payment cannot be voided. Void the payment first.')
    if (current.creditedMinor > 0) throw new AppError(409, 'invoice_has_credit_notes', 'An invoice with a credit note cannot be voided. Void the credit note first.')
    const before = await loadInvoice(tx, auth.tenantId, id)
    const reversal = await reverseSourcedEntryWithin(
      tx,
      auth,
      { entryId: current.journalEntryId, sourceType: 'supplier_invoice', entryDate: input.entryDate, memo: `Void supplier invoice ${current.supplierInvoiceNumber}` },
      financeEvents
    )
    if (!(await repository.voidInvoice(tx, auth.tenantId, id, auth.userId, input.version, { reason: input.reason, voidEntryId: reversal.id }))) {
      throw versionConflict('supplier invoice')
    }
    const after = await loadInvoice(tx, auth.tenantId, id)
    await audit(tx, auth, 'supplier_invoice', id, 'update', before, after)
    events.push({
      ...eventBase(auth),
      name: 'procurement.invoice.voided',
      payload: {
        invoiceId: id,
        number: after.number,
        supplierId: after.supplierId,
        orderId: after.orderId,
        totalMinor: after.totalMinor,
        currency: 'KWD',
        reversalEntryId: reversal.id,
        reason: input.reason,
        voidedBy: auth.userId,
      },
    })
    return after
  })
  await publishProcurementEvents(events)
  await publishFinanceEvents(financeEvents)
  return { data: detail }
}

export async function listSupplierInvoices(auth: AuthContext, query: ListSupplierInvoicesQuery): Promise<Page<SupplierInvoice>> {
  requirePermission(auth, permissions.procurementInvoiceRead)
  return repository.listInvoices(db, auth.tenantId, query)
}

export async function getSupplierInvoice(auth: AuthContext, id: string): Promise<InvoiceBody> {
  requirePermission(auth, permissions.procurementInvoiceRead)
  const detail = await repository.findInvoiceDetail(db, auth.tenantId, id)
  if (!detail) throw invoiceNotFound()
  return { data: detail }
}
