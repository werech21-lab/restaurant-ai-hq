import { DomainError } from '@/lib/domain-error'
import { MAX_INVOICE_MINOR } from '@/modules/finance/client'
import type { OrderLine, SupplierInvoiceLine, SupplierPaymentStatus } from '@/modules/procurement/domain/types'

/**
 * Returns, credit notes and payments: what each may take, and how an invoice's open balance is derived. Pure. The database
 * enforces the same limits under a lock, so two concurrent requests cannot both pass.
 *
 *   balance = total - paid (posted payments) - credited (posted credit notes), never below zero
 *   return  <= received - returned, per order line
 *   credit  <= billed on the invoice line - already credited on it, and <= billed net of credits - held (received - returned)
 *   payment is allocated in full to posted invoices of ONE supplier, each allocation within that invoice's balance
 */

export function invoiceBalanceMinor(totalMinor: number, paidMinor: number, creditedMinor: number): number {
  return Math.max(0, totalMinor - paidMinor - creditedMinor)
}

export function derivePaymentStatus(totalMinor: number, paidMinor: number, creditedMinor: number): SupplierPaymentStatus {
  const balance = totalMinor - paidMinor - creditedMinor
  if (balance <= 0) return paidMinor > 0 ? 'paid' : 'credited'
  return paidMinor > 0 ? 'partially_paid' : 'unpaid'
}

// ---- purchase returns ----

export type ReturnRequestLine = { orderLineId: string; quantity: number }
export type PlannedReturnLine = { orderLineId: string; itemId: string; quantity: number; unitCostMinor: number }

/** What can still go back to the supplier on a line: received and not yet returned. */
export function returnableQuantity(line: Pick<OrderLine, 'receivedQuantity' | 'returnedQuantity'>): number {
  return Math.max(0, line.receivedQuantity - line.returnedQuantity)
}

export function planReturn(orderLines: readonly OrderLine[], request: readonly ReturnRequestLine[]): PlannedReturnLine[] {
  if (request.length === 0) throw new DomainError('nothing_to_return', 'A return needs at least one line.')
  const byId = new Map(orderLines.map((line) => [line.id, line]))
  const seen = new Set<string>()
  return request.map((requested) => {
    const line = byId.get(requested.orderLineId)
    if (!line) throw new DomainError('order_line_not_found', 'A return line does not belong to this order.')
    if (seen.has(line.id)) throw new DomainError('duplicate_return_line', 'An order line can appear once on a return.')
    seen.add(line.id)
    if (!Number.isInteger(requested.quantity) || requested.quantity < 1) {
      throw new DomainError('invalid_quantity', 'A returned quantity must be a whole number of one or more.')
    }
    const open = returnableQuantity(line)
    if (requested.quantity > open) {
      throw new DomainError('over_return', `Line ${line.lineNo} has only ${open} received and not yet returned.`)
    }
    return { orderLineId: line.id, itemId: line.itemId, quantity: requested.quantity, unitCostMinor: line.unitCostMinor }
  })
}

/** Quantity x order price over the lines, in BigInt, as whole fils. */
export function valueOfLines(lines: ReadonlyArray<{ quantity: number; unitCostMinor: number }>): number {
  const value = lines.reduce((sum, line) => sum + BigInt(line.quantity) * BigInt(line.unitCostMinor), 0n)
  if (value > BigInt(MAX_INVOICE_MINOR)) throw new DomainError('amount_too_large', 'The amount exceeds the maximum allowed amount.')
  return Number(value)
}

// ---- credit notes ----

export type CreditRequestLine = { invoiceLineId: string; quantity: number }
export type PlannedCreditLine = {
  invoiceLineId: string
  orderLineId: string
  itemId: string
  quantity: number
  unitCostMinor: number
  taxRateBps: number
  poUnitCostMinor: number
}

/**
 * What a credit note may take from one invoice line: what that line still has uncredited, and no more than what was billed
 * and is no longer held, which is billed net of credits minus (received - returned) on the order line.
 */
export function creditableQuantity(invoiceLine: Pick<SupplierInvoiceLine, 'quantity' | 'creditedQuantity'>, orderLine: OrderLine): number {
  const onLine = invoiceLine.quantity - invoiceLine.creditedQuantity
  const returnedAndBilled = orderLine.invoicedQuantity - orderLine.creditedQuantity - (orderLine.receivedQuantity - orderLine.returnedQuantity)
  return Math.max(0, Math.min(onLine, returnedAndBilled))
}

export function planCreditNote(
  invoiceLines: readonly SupplierInvoiceLine[],
  orderLines: readonly OrderLine[],
  request: readonly CreditRequestLine[]
): PlannedCreditLine[] {
  if (request.length === 0) throw new DomainError('nothing_to_credit', 'A credit note needs at least one line.')
  const invoiceById = new Map(invoiceLines.map((line) => [line.id, line]))
  const orderById = new Map(orderLines.map((line) => [line.id, line]))
  const seen = new Set<string>()
  const takenPerOrderLine = new Map<string, number>()
  return request.map((requested) => {
    const invoiceLine = invoiceById.get(requested.invoiceLineId)
    if (!invoiceLine) throw new DomainError('invoice_line_not_found', 'A credit line does not belong to this invoice.')
    if (seen.has(invoiceLine.id)) throw new DomainError('duplicate_credit_line', 'An invoice line can appear once on a credit note.')
    seen.add(invoiceLine.id)
    const orderLine = orderById.get(invoiceLine.orderLineId)
    if (!orderLine) throw new DomainError('order_line_not_found', 'The order line of an invoice line was not found.')
    if (!Number.isInteger(requested.quantity) || requested.quantity < 1) {
      throw new DomainError('invalid_quantity', 'A credited quantity must be a whole number of one or more.')
    }
    const alreadyTaken = takenPerOrderLine.get(orderLine.id) ?? 0
    // The invoice line's own limit does not shrink when another invoice line of the same order line takes part of the return.
    const onLine = invoiceLine.quantity - invoiceLine.creditedQuantity
    const sharedReturn = orderLine.invoicedQuantity - orderLine.creditedQuantity - (orderLine.receivedQuantity - orderLine.returnedQuantity)
    const open = Math.max(0, Math.min(onLine, sharedReturn - alreadyTaken))
    if (requested.quantity > open) {
      throw new DomainError('over_credit', `Invoice line ${invoiceLine.lineNo} has only ${open} billed, returned and not yet credited.`)
    }
    takenPerOrderLine.set(orderLine.id, alreadyTaken + requested.quantity)
    return {
      invoiceLineId: invoiceLine.id,
      orderLineId: invoiceLine.orderLineId,
      itemId: invoiceLine.itemId,
      quantity: requested.quantity,
      unitCostMinor: invoiceLine.unitCostMinor,
      taxRateBps: invoiceLine.taxRateBps,
      poUnitCostMinor: invoiceLine.poUnitCostMinor,
    }
  })
}

// ---- payments ----

export type AllocationRequest = { invoiceId: string; amountMinor: number }
export type PayableInvoice = { id: string; supplierId: string; status: 'posted' | 'void'; invoiceDate: string; balanceMinor: number }

/**
 * A payment is allocated in full to supplier invoices: the allocations add up to the amount, each invoice belongs to the
 * supplier, is posted, is not dated after the payment, and is not paid beyond its open balance.
 */
export function planPayment(
  supplierId: string,
  paymentDate: string,
  amountMinor: number,
  allocations: readonly AllocationRequest[],
  invoices: readonly PayableInvoice[]
): AllocationRequest[] {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new DomainError('zero_amount', 'A payment needs an amount above zero.')
  if (allocations.length === 0) throw new DomainError('allocation_mismatch', 'A payment must be allocated to at least one supplier invoice.')
  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]))
  const seen = new Set<string>()
  let allocated = 0n
  for (const allocation of allocations) {
    const invoice = byId.get(allocation.invoiceId)
    if (!invoice) throw new DomainError('invoice_not_found', 'A payment is allocated to an invoice that does not exist.')
    if (seen.has(invoice.id)) throw new DomainError('duplicate_allocation', 'An invoice can appear once on a payment.')
    seen.add(invoice.id)
    if (invoice.supplierId !== supplierId) throw new DomainError('supplier_mismatch', 'A payment can only pay invoices of its own supplier.')
    if (invoice.status !== 'posted') throw new DomainError('invoice_not_posted', 'A voided supplier invoice cannot be paid.')
    if (paymentDate < invoice.invoiceDate) throw new DomainError('payment_before_invoice', 'A payment cannot be dated before the invoice it pays.')
    if (!Number.isSafeInteger(allocation.amountMinor) || allocation.amountMinor <= 0) {
      throw new DomainError('zero_amount', 'An allocation needs an amount above zero.')
    }
    if (allocation.amountMinor > invoice.balanceMinor) {
      throw new DomainError('over_payment', `The allocation of ${allocation.amountMinor} fils is more than the open balance of ${invoice.balanceMinor}.`)
    }
    allocated += BigInt(allocation.amountMinor)
  }
  if (allocated !== BigInt(amountMinor)) {
    throw new DomainError('allocation_mismatch', `The allocations add up to ${allocated} fils but the payment is ${amountMinor}.`)
  }
  return [...allocations]
}
