import { DomainError } from '@/lib/domain-error'
import type { OrderLine, OrderStatus } from '@/modules/procurement/domain/types'

/** Strictly above the limit needs approval. A null limit means nobody has set one, so nothing needs approval. */
export function orderNeedsApproval(totalMinor: number, thresholdMinor: number | null): boolean {
  return thresholdMinor !== null && totalMinor > thresholdMinor
}

export function isEditable(status: OrderStatus): boolean {
  return status === 'draft'
}

export function canCancel(status: OrderStatus): boolean {
  return status === 'draft' || status === 'pending_approval' || status === 'approved'
}

export function canReceive(status: OrderStatus): boolean {
  return status === 'approved' || status === 'partially_received'
}

export type ReceiptRequestLine = { orderLineId: string; quantity: number }

export type PlannedReceiptLine = { orderLineId: string; itemId: string; quantity: number }

/**
 * Checks a receipt against the order's lines: every line must belong to the order, and no line may take in more than is
 * still open. Returns the lines with their items, in the order given.
 */
export function planReceipt(orderLines: readonly OrderLine[], request: readonly ReceiptRequestLine[]): PlannedReceiptLine[] {
  const byId = new Map(orderLines.map((line) => [line.id, line]))
  const seen = new Set<string>()
  return request.map((requested) => {
    const line = byId.get(requested.orderLineId)
    if (!line) throw new DomainError('order_line_not_found', 'A receipt line does not belong to this order.')
    if (seen.has(line.id)) throw new DomainError('duplicate_receipt_line', 'An order line can appear once on a receipt.')
    seen.add(line.id)
    if (!Number.isInteger(requested.quantity) || requested.quantity < 1) {
      throw new DomainError('invalid_quantity', 'A received quantity must be a whole number of one or more.')
    }
    const open = line.quantity - line.receivedQuantity
    if (requested.quantity > open) {
      throw new DomainError('over_receipt', `Line ${line.lineNo} has only ${open} left to receive.`)
    }
    return { orderLineId: line.id, itemId: line.itemId, quantity: requested.quantity }
  })
}

/** Where the order stands after a receipt is applied to these lines. */
export function statusAfterReceipt(lines: ReadonlyArray<Pick<OrderLine, 'quantity' | 'receivedQuantity'>>): 'partially_received' | 'received' {
  return lines.every((line) => line.receivedQuantity >= line.quantity) ? 'received' : 'partially_received'
}