import { DomainError } from '@/lib/domain-error'
import type { OrderLineInput } from '@/modules/procurement/schemas/procurement'
import type { RequestLine, RequestStatus } from '@/modules/procurement/domain/types'

export function isRequestEditable(status: RequestStatus): boolean {
  return status === 'draft'
}

/** A request can be withdrawn until it has been turned into an order. A rejected or converted request is final. */
export function canCancelRequest(status: RequestStatus): boolean {
  return status === 'draft' || status === 'submitted' || status === 'approved'
}

export type PricedRequestLine = { requestLineId: string; unitCostMinor: number; taxRateBps: number }

/**
 * Turns an approved request into the lines of a purchase order. The request names the items and quantities. The buyer supplies
 * the price and tax, so every request line must be priced exactly once. Returns the lines in the request's order.
 */
export function planConversion(requestLines: readonly RequestLine[], priced: readonly PricedRequestLine[]): OrderLineInput[] {
  const byId = new Map(requestLines.map((line) => [line.id, line]))
  const seen = new Set<string>()
  for (const entry of priced) {
    if (!byId.has(entry.requestLineId)) throw new DomainError('request_line_not_found', 'A priced line does not belong to this request.')
    if (seen.has(entry.requestLineId)) throw new DomainError('duplicate_request_line', 'A request line can be priced once.')
    seen.add(entry.requestLineId)
  }
  if (seen.size !== requestLines.length) {
    throw new DomainError('request_line_unpriced', 'Every line of the request needs a price before it becomes an order.')
  }
  const pricing = new Map(priced.map((entry) => [entry.requestLineId, entry]))
  return requestLines.map((line) => {
    const price = pricing.get(line.id)
    if (!price) throw new DomainError('request_line_unpriced', 'Every line of the request needs a price before it becomes an order.')
    return {
      itemId: line.itemId,
      description: line.description,
      quantity: line.quantity,
      unitCostMinor: price.unitCostMinor,
      taxRateBps: price.taxRateBps,
    }
  })
}