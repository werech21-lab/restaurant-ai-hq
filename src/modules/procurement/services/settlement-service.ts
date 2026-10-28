import { randomUUID } from 'node:crypto'
import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import type { AuthContext } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'
import { requirePermission, versionConflict } from '@/lib/auth/require'
import { db, withTransaction, type Queryable } from '@/lib/db'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { nextSequenceValue } from '@/lib/sequences'
import { computeTotals } from '@/modules/finance/client'
import {
  findAccountsWithin,
  getAccountTotalsWithin,
  postSourcedEntryWithin,
  publishFinanceEvents,
  reverseSourcedEntryWithin,
  type FinanceEvent,
} from '@/modules/finance'
import { publishInventoryEvents, returnPurchaseWithin, type InventoryEvent } from '@/modules/inventory'
import { reclassVariance } from '@/modules/procurement/services/valuation-bridge'
import { assertInvoiceCurrency, assertTotalMatches } from '@/modules/procurement/domain/invoice'
import { buildCreditNoteLines, buildPaymentLines, buildReturnLines } from '@/modules/procurement/domain/posting'
import { buildReconciliation } from '@/modules/procurement/domain/reconcile'
import { planCreditNote, planPayment, planReturn, valueOfLines } from '@/modules/procurement/domain/settlement'
import type {
  PurchaseReturn,
  PurchaseReturnDetail,
  ReconciliationReport,
  SupplierCreditNote,
  SupplierCreditNoteDetail,
  SupplierPayment,
  SupplierPaymentDetail,
} from '@/modules/procurement/domain/types'
import { publishProcurementEvents, type ProcurementEvent } from '@/modules/procurement/events'
import * as invoiceRepository from '@/modules/procurement/repositories/invoice-repository'
import * as procurementRepository from '@/modules/procurement/repositories/procurement-repository'
import * as repository from '@/modules/procurement/repositories/settlement-repository'
import type {
  CreateCreditNoteInput,
  CreatePaymentInput,
  CreateReturnInput,
  ListCreditNotesQuery,
  ListPaymentsQuery,
  ListReturnsQuery,
  VoidCreditNoteInput,
  VoidPaymentInput,
} from '@/modules/procurement/schemas/settlement'
import { audit, eventBase, loadDetail as loadOrderDetail, orderNotFound } from '@/modules/procurement/services/procurement-service'

export type ReturnBody = { data: PurchaseReturnDetail }
export type CreditNoteBody = { data: SupplierCreditNoteDetail }
export type PaymentBody = { data: SupplierPaymentDetail }
export type ReconciliationBody = { data: ReconciliationReport }

const RETURN_SCOPE = 'procurement.return.create'
const CREDIT_SCOPE = 'procurement.creditnote.create'
const PAYMENT_SCOPE = 'procurement.payment.create'

const returnNotFound = () => new AppError(404, 'return_not_found', 'The purchase return was not found.')
const creditNoteNotFound = () => new AppError(404, 'credit_note_not_found', 'The supplier credit note was not found.')
const paymentNotFound = () => new AppError(404, 'payment_not_found', 'The supplier payment was not found.')
const invoiceNotFound = () => new AppError(404, 'invoice_not_found', 'The supplier invoice was not found.')

// ---- purchase returns ----

/**
 * Sends received goods back to the supplier. One transaction: it locks the order, checks every line against what is received
 * and not yet returned, books the value on the receipt basis (Dr GRNI, Cr inventory), writes the append-only return (the
 * database raises the returned quantities) and takes the goods out of stock through the inventory module. Stock never goes below
 * zero: a warehouse that holds less than is sent back stops the whole return with 409 `insufficient_stock`. On the invoice
 * basis a return books nothing; the credit note accounts for it. Events go out after the commit.
 */
export async function createReturn(auth: AuthContext, idempotencyKey: string, input: CreateReturnInput): Promise<IdempotentResult<ReturnBody>> {
  requirePermission(auth, permissions.procurementReturnCreate)
  const events: ProcurementEvent[] = []
  const inventoryEvents: InventoryEvent[] = []
  const financeEvents: FinanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<ReturnBody>(
      tx,
      { tenantId: auth.tenantId, scope: RETURN_SCOPE, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        const order = await procurementRepository.findOrder(tx, auth.tenantId, input.orderId, { lock: true })
        if (!order) throw orderNotFound()
        const orderDetail = await loadOrderDetail(tx, auth.tenantId, order.id)
        const planned = planReturn(orderDetail.lines, input.lines)
        const valueMinor = valueOfLines(planned)
        const accounting = await invoiceRepository.findAccounting(tx, auth.tenantId)
        const returnId = randomUUID()
        const number = await nextSequenceValue(tx, auth.tenantId, 'purchase_return')
        let journalEntryId: string | null = null
        if (accounting.accountingBasis === 'receipt_basis' && valueMinor > 0) {
          const memo = `Purchase return ${number} - purchase order ${order.number}`
          const entry = await postSourcedEntryWithin(
            tx,
            auth,
            { entryDate: input.returnDate, memo, sourceType: 'purchase_return', sourceId: returnId, lines: buildReturnLines(valueMinor, accounting, memo) },
            financeEvents
          )
          journalEntryId = entry.id
        }
        await repository.insertReturn(tx, auth.tenantId, auth.userId, {
          id: returnId,
          number,
          supplierId: order.supplierId,
          orderId: order.id,
          warehouseId: input.warehouseId,
          returnDate: input.returnDate,
          reason: input.reason,
          valueMinor,
          journalEntryId,
        })
        await repository.insertReturnLines(tx, auth.tenantId, auth.userId, returnId, order.id, planned)
        await returnPurchaseWithin(
          tx,
          auth,
          {
            warehouseId: input.warehouseId,
            returnId,
            lines: planned.map((line) => ({ itemId: line.itemId, quantity: line.quantity, unitCostMinor: line.unitCostMinor })),
            note: `Return ${number} for purchase order ${order.number}`,
          },
          inventoryEvents
        )
        await procurementRepository.bumpOrderVersion(tx, auth.tenantId, order.id)
        await tx.query('set constraints all immediate')
        const detail = await repository.findReturn(tx, auth.tenantId, returnId)
        if (!detail) throw returnNotFound()
        await audit(tx, auth, 'purchase_return', returnId, 'create', null, detail)
        events.push({
          ...eventBase(auth),
          name: 'procurement.return.posted',
          payload: {
            returnId,
            number,
            orderId: order.id,
            orderNumber: order.number,
            supplierId: order.supplierId,
            warehouseId: input.warehouseId,
            lineCount: detail.lineCount,
            totalQuantity: detail.totalQuantity,
            valueMinor,
            journalEntryId,
            returnedBy: auth.userId,
          },
        })
        return { status: 201, body: { data: detail } }
      }
    )
  )
  if (!outcome.replayed) {
    await publishProcurementEvents(events)
    await publishInventoryEvents(inventoryEvents)
    await publishFinanceEvents(financeEvents)
  }
  return outcome
}

export async function listReturns(auth: AuthContext, query: ListReturnsQuery): Promise<Page<PurchaseReturn>> {
  requirePermission(auth, permissions.procurementReturnRead)
  return repository.listReturns(db, auth.tenantId, query)
}

export async function getReturn(auth: AuthContext, id: string): Promise<ReturnBody> {
  requirePermission(auth, permissions.procurementReturnRead)
  const detail = await repository.findReturn(db, auth.tenantId, id)
  if (!detail) throw returnNotFound()
  return { data: detail }
}

// ---- supplier credit notes ----

/**
 * Books the supplier's credit note for billed goods that went back. One transaction: it locks the invoice and the order, plans
 * the lines against what was billed and returned and not yet credited, keeps the total within the invoice's open balance, posts
 * one balanced entry (the mirror of the invoice, at the billed price) and writes the credit note. The database checks the same
 * limits under the invoice lock, so a payment and a credit note cannot both take the last of a balance.
 */
export async function createCreditNote(auth: AuthContext, idempotencyKey: string, input: CreateCreditNoteInput): Promise<IdempotentResult<CreditNoteBody>> {
  requirePermission(auth, permissions.procurementCreditNoteCreate)
  assertInvoiceCurrency(input.currency)
  const events: ProcurementEvent[] = []
  const financeEvents: FinanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<CreditNoteBody>(
      tx,
      { tenantId: auth.tenantId, scope: CREDIT_SCOPE, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        const invoice = await invoiceRepository.findInvoice(tx, auth.tenantId, input.invoiceId, { lock: true })
        if (!invoice) throw invoiceNotFound()
        if (invoice.status !== 'posted') throw new AppError(409, 'invoice_not_posted', 'Only a posted supplier invoice can be credited.')
        const order = await procurementRepository.findOrder(tx, auth.tenantId, invoice.orderId, { lock: true })
        if (!order) throw orderNotFound()
        if (await repository.existsActiveCreditNumber(tx, auth.tenantId, invoice.supplierId, input.supplierCreditNoteNumber)) {
          throw new AppError(409, 'duplicate_supplier_credit_note', `Credit note ${input.supplierCreditNoteNumber} of this supplier is already booked.`)
        }
        const fresh = await invoiceRepository.findInvoice(tx, auth.tenantId, invoice.id)
        if (!fresh) throw invoiceNotFound()
        const orderDetail = await loadOrderDetail(tx, auth.tenantId, order.id)
        const invoiceLines = await invoiceRepository.findInvoiceLines(tx, auth.tenantId, invoice.id)
        const planned = planCreditNote(invoiceLines, orderDetail.lines, input.lines)
        const totals = computeTotals(planned.map((line) => ({ quantity: line.quantity, unitPriceMinor: line.unitCostMinor, taxRateBps: line.taxRateBps })))
        if (totals.totalMinor > fresh.balanceMinor) {
          // A conflict, not a typo: the open balance may have been paid in the meantime.
          throw new AppError(409, 'over_credit', `The credit note total of ${totals.totalMinor} fils is more than the open balance of ${fresh.balanceMinor} of the invoice.`)
        }
        assertTotalMatches(input.expectedTotalMinor, totals)
        const accounting = await invoiceRepository.findAccounting(tx, auth.tenantId)
        const memo = `Supplier credit note ${input.supplierCreditNoteNumber} - invoice ${invoice.supplierInvoiceNumber}`
        const poNetMinor = valueOfLines(planned.map((line) => ({ quantity: line.quantity, unitCostMinor: line.poUnitCostMinor })))
        const noteId = randomUUID()
        const reclass = await reclassVariance(tx, auth, 'supplier_credit_note', noteId, planned, 'credit')
        const entry = await postSourcedEntryWithin(
          tx,
          auth,
          {
            entryDate: input.creditDate,
            memo,
            sourceType: 'supplier_credit_note',
            sourceId: noteId,
            lines: buildCreditNoteLines(
              invoice.accountingBasis,
              totals,
              poNetMinor,
              accounting,
              memo,
              invoice.accountingBasis === 'receipt_basis' ? reclass : 0
            ),
          },
          financeEvents
        )
        const number = await nextSequenceValue(tx, auth.tenantId, 'supplier_credit_note')
        await repository.insertCreditNote(tx, auth.tenantId, auth.userId, {
          id: noteId,
          number,
          supplierId: invoice.supplierId,
          supplierName: invoice.supplierName,
          supplierCreditNoteNumber: input.supplierCreditNoteNumber,
          invoiceId: invoice.id,
          orderId: invoice.orderId,
          creditDate: input.creditDate,
          ...totals,
          reason: input.reason,
          journalEntryId: entry.id,
        })
        await repository.insertCreditNoteLines(tx, auth.tenantId, auth.userId, noteId, invoice.id, planned)
        await procurementRepository.bumpOrderVersion(tx, auth.tenantId, order.id)
        await tx.query('set constraints all immediate')
        const detail = await repository.findCreditNoteDetail(tx, auth.tenantId, noteId)
        if (!detail) throw creditNoteNotFound()
        await audit(tx, auth, 'supplier_credit_note', noteId, 'create', null, detail)
        events.push({
          ...eventBase(auth),
          name: 'procurement.creditnote.posted',
          payload: {
            creditNoteId: noteId,
            number,
            supplierCreditNoteNumber: input.supplierCreditNoteNumber,
            supplierId: invoice.supplierId,
            invoiceId: invoice.id,
            totalMinor: totals.totalMinor,
            currency: 'KWD',
            journalEntryId: entry.id,
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

/** Voids a credit note by reversing its entry. The credited quantities become creditable again and the invoice balance grows back. */
export async function voidCreditNote(auth: AuthContext, id: string, input: VoidCreditNoteInput): Promise<CreditNoteBody> {
  requirePermission(auth, permissions.procurementCreditNoteVoid)
  const events: ProcurementEvent[] = []
  const financeEvents: FinanceEvent[] = []
  const detail = await withTransaction(async (tx) => {
    const current = await repository.findCreditNote(tx, auth.tenantId, id, { lock: true })
    if (!current) throw creditNoteNotFound()
    if (current.version !== input.version) throw versionConflict('supplier credit note')
    if (current.status !== 'posted') throw new AppError(409, 'credit_note_not_posted', 'Only a posted credit note can be voided.')
    const before = await loadCreditNote(tx, auth.tenantId, id)
    const reversal = await reverseSourcedEntryWithin(
      tx,
      auth,
      { entryId: current.journalEntryId, sourceType: 'supplier_credit_note', entryDate: input.entryDate, memo: `Void supplier credit note ${current.supplierCreditNoteNumber}` },
      financeEvents
    )
    if (!(await repository.voidCreditNote(tx, auth.tenantId, id, auth.userId, input.version, { reason: input.reason, voidEntryId: reversal.id }))) {
      throw versionConflict('supplier credit note')
    }
    const after = await loadCreditNote(tx, auth.tenantId, id)
    await audit(tx, auth, 'supplier_credit_note', id, 'update', before, after)
    events.push({
      ...eventBase(auth),
      name: 'procurement.creditnote.voided',
      payload: {
        creditNoteId: id,
        number: after.number,
        supplierId: after.supplierId,
        invoiceId: after.invoiceId,
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

async function loadCreditNote(tx: Queryable, tenantId: string, id: string): Promise<SupplierCreditNoteDetail> {
  const detail = await repository.findCreditNoteDetail(tx, tenantId, id)
  if (!detail) throw creditNoteNotFound()
  return detail
}

export async function listCreditNotes(auth: AuthContext, query: ListCreditNotesQuery): Promise<Page<SupplierCreditNote>> {
  requirePermission(auth, permissions.procurementCreditNoteRead)
  return repository.listCreditNotes(db, auth.tenantId, query)
}

export async function getCreditNote(auth: AuthContext, id: string): Promise<CreditNoteBody> {
  requirePermission(auth, permissions.procurementCreditNoteRead)
  return { data: await loadCreditNote(db, auth.tenantId, id) }
}

// ---- supplier payments ----

/**
 * Pays one supplier's invoices. One transaction: it locks the named invoices in id order, allocates the whole amount within
 * each invoice's open balance (so a partial payment is an allocation below the balance), posts Dr payable / Cr the paying
 * account, and writes the payment and its allocations. A bank or cheque reference cannot be booked twice for a supplier, an
 * idempotency key books once, and the database re-checks every balance under the invoice lock.
 */
export async function createPayment(auth: AuthContext, idempotencyKey: string, input: CreatePaymentInput): Promise<IdempotentResult<PaymentBody>> {
  requirePermission(auth, permissions.procurementPaymentCreate)
  assertInvoiceCurrency(input.currency)
  const events: ProcurementEvent[] = []
  const financeEvents: FinanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<PaymentBody>(
      tx,
      { tenantId: auth.tenantId, scope: PAYMENT_SCOPE, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        const supplier = await procurementRepository.findSupplier(tx, auth.tenantId, input.supplierId)
        if (!supplier) throw new AppError(422, 'supplier_not_found', 'The supplier was not found.')
        if (input.reference && (await repository.existsActiveReference(tx, auth.tenantId, supplier.id, input.reference))) {
          throw new AppError(409, 'duplicate_payment_reference', `Reference ${input.reference} was already used for a payment to this supplier.`)
        }
        const accounting = await invoiceRepository.findAccounting(tx, auth.tenantId)
        const [paidFrom] = await findAccountsWithin(tx, auth.tenantId, [input.paidFromAccountId])
        if (!paidFrom) throw new AppError(422, 'account_not_found', 'The paying account does not exist.')
        if (paidFrom.type !== 'asset') throw new AppError(422, 'account_type_invalid', 'A payment is made from an asset account (cash or bank).')
        if (!paidFrom.isActive || !paidFrom.isPostable) throw new AppError(422, 'account_not_postable', 'The paying account is inactive or not postable.')
        const invoices = await invoiceRepository.findInvoicesLocked(
          tx,
          auth.tenantId,
          input.allocations.map((allocation) => allocation.invoiceId)
        )
        const allocations = planPayment(
          supplier.id,
          input.paymentDate,
          input.amountMinor,
          input.allocations,
          invoices.map((invoice) => ({
            id: invoice.id,
            supplierId: invoice.supplierId,
            status: invoice.status,
            invoiceDate: invoice.invoiceDate,
            balanceMinor: invoice.balanceMinor,
          }))
        )
        const paymentId = randomUUID()
        const number = await nextSequenceValue(tx, auth.tenantId, 'supplier_payment')
        const memo = `Supplier payment ${number} - ${supplier.name}`
        const entry = await postSourcedEntryWithin(
          tx,
          auth,
          {
            entryDate: input.paymentDate,
            memo,
            sourceType: 'supplier_payment',
            sourceId: paymentId,
            lines: buildPaymentLines(input.amountMinor, paidFrom.id, accounting, memo),
          },
          financeEvents
        )
        await repository.insertPayment(tx, auth.tenantId, auth.userId, {
          id: paymentId,
          number,
          supplierId: supplier.id,
          supplierName: supplier.name,
          paymentDate: input.paymentDate,
          amountMinor: input.amountMinor,
          method: input.method,
          reference: input.reference,
          paidFromAccountId: paidFrom.id,
          notes: input.notes,
          journalEntryId: entry.id,
        })
        await repository.insertAllocations(tx, auth.tenantId, auth.userId, paymentId, supplier.id, allocations)
        await tx.query('set constraints all immediate')
        const detail = await loadPayment(tx, auth.tenantId, paymentId)
        await audit(tx, auth, 'supplier_payment', paymentId, 'create', null, detail)
        events.push({
          ...eventBase(auth),
          name: 'procurement.payment.posted',
          payload: {
            paymentId,
            number,
            supplierId: supplier.id,
            amountMinor: input.amountMinor,
            currency: 'KWD',
            method: input.method,
            invoiceIds: allocations.map((allocation) => allocation.invoiceId),
            journalEntryId: entry.id,
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

/** Voids a payment by reversing its entry. The allocated invoices owe the amount again. The payment and its allocations are never edited. */
export async function voidPayment(auth: AuthContext, id: string, input: VoidPaymentInput): Promise<PaymentBody> {
  requirePermission(auth, permissions.procurementPaymentVoid)
  const events: ProcurementEvent[] = []
  const financeEvents: FinanceEvent[] = []
  const detail = await withTransaction(async (tx) => {
    const current = await repository.findPayment(tx, auth.tenantId, id, { lock: true })
    if (!current) throw paymentNotFound()
    if (current.version !== input.version) throw versionConflict('supplier payment')
    if (current.status !== 'posted') throw new AppError(409, 'payment_not_posted', 'Only a posted payment can be voided.')
    const before = await loadPayment(tx, auth.tenantId, id)
    const reversal = await reverseSourcedEntryWithin(
      tx,
      auth,
      { entryId: current.journalEntryId, sourceType: 'supplier_payment', entryDate: input.entryDate, memo: `Void supplier payment ${current.number}` },
      financeEvents
    )
    if (!(await repository.voidPayment(tx, auth.tenantId, id, auth.userId, input.version, { reason: input.reason, voidEntryId: reversal.id }))) {
      throw versionConflict('supplier payment')
    }
    const after = await loadPayment(tx, auth.tenantId, id)
    await audit(tx, auth, 'supplier_payment', id, 'update', before, after)
    events.push({
      ...eventBase(auth),
      name: 'procurement.payment.voided',
      payload: {
        paymentId: id,
        number: after.number,
        supplierId: after.supplierId,
        amountMinor: after.amountMinor,
        currency: 'KWD',
        invoiceIds: after.allocations.map((allocation) => allocation.invoiceId),
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

async function loadPayment(tx: Queryable, tenantId: string, id: string): Promise<SupplierPaymentDetail> {
  const detail = await repository.findPaymentDetail(tx, tenantId, id)
  if (!detail) throw paymentNotFound()
  return detail
}

export async function listPayments(auth: AuthContext, query: ListPaymentsQuery): Promise<Page<SupplierPayment>> {
  requirePermission(auth, permissions.procurementPaymentRead)
  return repository.listPayments(db, auth.tenantId, query)
}

export async function getPayment(auth: AuthContext, id: string): Promise<PaymentBody> {
  requirePermission(auth, permissions.procurementPaymentRead)
  return { data: await loadPayment(db, auth.tenantId, id) }
}

// ---- reconciliation ----

/**
 * Compares what the procurement documents say the ledger must hold (inventory, GRNI, payable) with what the ledger holds. It
 * changes nothing. A difference is reported as it is: it means an entry is missing, or someone posted to one of these accounts
 * by hand.
 */
export async function getReconciliation(auth: AuthContext): Promise<ReconciliationBody> {
  requirePermission(auth, permissions.procurementInvoiceRead)
  const accounting = await invoiceRepository.findAccounting(db, auth.tenantId)
  const figures = await repository.reconciliationFigures(db, auth.tenantId)
  const ids = [accounting.inventoryAccountId, accounting.grniAccountId, accounting.payableAccountId].filter((id): id is string => id !== null)
  const totals = new Map((await getAccountTotalsWithin(db, auth.tenantId, ids)).map((entry) => [entry.accountId, entry]))
  const pick = (id: string | null) => {
    const entry = id ? totals.get(id) : undefined
    return entry ? { debitMinor: entry.debitMinor, creditMinor: entry.creditMinor } : null
  }
  return {
    data: buildReconciliation(accounting.accountingBasis, figures, {
      inventory: pick(accounting.inventoryAccountId),
      grni: pick(accounting.grniAccountId),
      payable: pick(accounting.payableAccountId),
    }),
  }
}
