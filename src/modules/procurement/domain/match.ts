import { DomainError } from '@/lib/domain-error'
import { MAX_INVOICE_MINOR, computeTotals } from '@/modules/finance/client'
import type { MatchIssue, MatchLine, MatchResult, MatchStatus, OrderLine } from '@/modules/procurement/domain/types'

/**
 * Three-way match: the supplier's invoice against the purchase order (price, rate) and what was received (quantity). It is
 * pure, so the preview and the booking use the same rules, and the database enforces the same limits again.
 *
 *   quantity  A line bills at most what is received and not yet billed, after returns and credit notes.
 *   price     The billed price may differ from the order price by `priceToleranceBps` of the order price. The variance is
 *             quantity x (billed - order price), positive when the supplier billed more.
 *   tax       The tax of the invoice (per line in basis points, summed unrounded, rounded half up once) may differ from the
 *             tax at the ORDER's rates on the billed prices by `taxToleranceMinor`. The price-driven part of the tax is
 *             therefore not a tax variance.
 *
 * Outside a tolerance the line or the invoice is blocked. There is no override: raising a tolerance is a settings decision.
 */

export type Tolerance = { priceToleranceBps: number; taxToleranceMinor: number }
export const NO_TOLERANCE: Tolerance = { priceToleranceBps: 0, taxToleranceMinor: 0 }

export type MatchRequestLine = {
  orderLineId: string
  quantity: number
  /** The price on the supplier's invoice. Absent means the order price. */
  unitCostMinor?: number | null
  /** The rate on the supplier's invoice. Absent means the order's rate. */
  taxRateBps?: number | null
}

export type PlannedInvoiceLine = {
  orderLineId: string
  itemId: string
  description: string
  quantity: number
  unitCostMinor: number
  taxRateBps: number
  poUnitCostMinor: number
  poTaxRateBps: number
}

/** Open to bill on a line: received, minus returned, minus billed net of credit notes. Never negative. */
export function invoiceableQuantity(line: Pick<OrderLine, 'receivedQuantity' | 'returnedQuantity' | 'invoicedQuantity' | 'creditedQuantity'>): number {
  return Math.max(0, line.receivedQuantity - line.returnedQuantity - (line.invoicedQuantity - line.creditedQuantity))
}

/** True when |billed - order| x 10,000 <= tolerance x order, in BigInt so no price can overflow or round. */
export function priceWithinTolerance(billedMinor: number, orderMinor: number, toleranceBps: number): boolean {
  const difference = BigInt(billedMinor) - BigInt(orderMinor)
  const absolute = difference < 0n ? -difference : difference
  return absolute * 10_000n <= BigInt(toleranceBps) * BigInt(orderMinor)
}

function sumNet(lines: ReadonlyArray<{ quantity: number; unitCostMinor: number }>): bigint {
  return lines.reduce((sum, line) => sum + BigInt(line.quantity) * BigInt(line.unitCostMinor), 0n)
}

function safeMinor(value: bigint): number {
  if (value > BigInt(MAX_INVOICE_MINOR) || value < -BigInt(MAX_INVOICE_MINOR)) {
    throw new DomainError('amount_too_large', 'The amount exceeds the maximum allowed amount.')
  }
  return Number(value)
}

export type MatchEvaluation = { result: MatchResult; planned: PlannedInvoiceLine[] }

export function evaluateMatch(orderLines: readonly OrderLine[], request: readonly MatchRequestLine[], tolerance: Tolerance = NO_TOLERANCE): MatchEvaluation {
  const issues: MatchIssue[] = []
  const byId = new Map(orderLines.map((line) => [line.id, line]))
  const seen = new Set<string>()
  const planned: PlannedInvoiceLine[] = []
  const lines: MatchLine[] = []

  if (request.length === 0) {
    issues.push({ code: 'invalid_quantity', orderLineId: null, message: 'An invoice needs at least one line.' })
  }

  for (const requested of request) {
    const line = byId.get(requested.orderLineId)
    if (!line) {
      issues.push({ code: 'order_line_not_found', orderLineId: requested.orderLineId, message: 'An invoice line does not belong to this order.' })
      continue
    }
    if (seen.has(line.id)) {
      issues.push({ code: 'duplicate_invoice_line', orderLineId: line.id, message: 'An order line can appear once on an invoice.' })
      continue
    }
    seen.add(line.id)
    const billedCost = requested.unitCostMinor ?? line.unitCostMinor
    const billedRate = requested.taxRateBps ?? line.taxRateBps
    const open = invoiceableQuantity(line)
    const lineIssues: MatchIssue[] = []

    if (!Number.isInteger(requested.quantity) || requested.quantity < 1) {
      lineIssues.push({ code: 'invalid_quantity', orderLineId: line.id, message: 'An invoiced quantity must be a whole number of one or more.' })
    } else if (requested.quantity > open) {
      lineIssues.push({ code: 'over_invoice', orderLineId: line.id, message: `Line ${line.lineNo} has only ${open} received and not yet invoiced.` })
    }
    if (!Number.isInteger(billedCost) || billedCost < 0 || billedCost > 1_000_000_000 || !Number.isInteger(billedRate) || billedRate < 0 || billedRate > 10_000) {
      lineIssues.push({ code: 'invalid_price', orderLineId: line.id, message: `Line ${line.lineNo} has a price or tax rate outside the allowed range.` })
    } else if (!priceWithinTolerance(billedCost, line.unitCostMinor, tolerance.priceToleranceBps)) {
      lineIssues.push({
        code: 'price_variance_exceeded',
        orderLineId: line.id,
        message: `Line ${line.lineNo} is billed at ${billedCost} fils but ordered at ${line.unitCostMinor}, beyond the tolerance of ${tolerance.priceToleranceBps} basis points.`,
      })
    }
    issues.push(...lineIssues)

    const varied = billedCost !== line.unitCostMinor || billedRate !== line.taxRateBps
    const status: MatchStatus = lineIssues.length > 0 ? 'blocked' : varied ? 'within_tolerance' : 'matched'
    lines.push({
      orderLineId: line.id,
      lineNo: line.lineNo,
      openQuantity: open,
      quantity: requested.quantity,
      poUnitCostMinor: line.unitCostMinor,
      billedUnitCostMinor: billedCost,
      poTaxRateBps: line.taxRateBps,
      billedTaxRateBps: billedRate,
      priceVarianceMinor: lineIssues.length > 0 ? 0 : safeMinor(BigInt(requested.quantity) * (BigInt(billedCost) - BigInt(line.unitCostMinor))),
      status,
    })
    if (lineIssues.length === 0) {
      planned.push({
        orderLineId: line.id,
        itemId: line.itemId,
        description: line.description,
        quantity: requested.quantity,
        unitCostMinor: billedCost,
        taxRateBps: billedRate,
        poUnitCostMinor: line.unitCostMinor,
        poTaxRateBps: line.taxRateBps,
      })
    }
  }

  let totals = { subtotalMinor: 0, taxMinor: 0, totalMinor: 0 }
  let taxAtOrderRates = 0
  let poNet = 0n
  if (planned.length > 0) {
    totals = computeTotals(planned.map((line) => ({ quantity: line.quantity, unitPriceMinor: line.unitCostMinor, taxRateBps: line.taxRateBps })))
    taxAtOrderRates = computeTotals(planned.map((line) => ({ quantity: line.quantity, unitPriceMinor: line.unitCostMinor, taxRateBps: line.poTaxRateBps }))).taxMinor
    poNet = sumNet(planned.map((line) => ({ quantity: line.quantity, unitCostMinor: line.poUnitCostMinor })))
  }
  const taxVarianceMinor = totals.taxMinor - taxAtOrderRates
  if (Math.abs(taxVarianceMinor) > tolerance.taxToleranceMinor) {
    issues.push({
      code: 'tax_variance_exceeded',
      orderLineId: null,
      message: `The invoice tax differs from the tax at the order's rates by ${taxVarianceMinor} fils, beyond the tolerance of ${tolerance.taxToleranceMinor}.`,
    })
  }
  const priceVarianceMinor = safeMinor(BigInt(totals.subtotalMinor) - poNet)
  const anyVariance = priceVarianceMinor !== 0 || taxVarianceMinor !== 0 || lines.some((line) => line.billedTaxRateBps !== line.poTaxRateBps)
  const status: MatchStatus = issues.length > 0 ? 'blocked' : anyVariance ? 'within_tolerance' : 'matched'

  return {
    planned: issues.length > 0 ? [] : planned,
    result: {
      status,
      lines,
      poNetMinor: safeMinor(poNet),
      subtotalMinor: totals.subtotalMinor,
      taxMinor: totals.taxMinor,
      totalMinor: totals.totalMinor,
      priceVarianceMinor,
      taxVarianceMinor,
      priceToleranceBps: tolerance.priceToleranceBps,
      taxToleranceMinor: tolerance.taxToleranceMinor,
      issues,
    },
  }
}

/** Throws the first problem of a match as a DomainError, or returns the planned lines when nothing blocks the invoice. */
export function planInvoice(orderLines: readonly OrderLine[], request: readonly MatchRequestLine[], tolerance: Tolerance = NO_TOLERANCE): PlannedInvoiceLine[] {
  if (request.length === 0) throw new DomainError('nothing_to_invoice', 'An invoice needs at least one line.')
  const { result, planned } = evaluateMatch(orderLines, request, tolerance)
  const first = result.issues[0]
  if (first) throw new DomainError(first.code, first.message)
  return planned
}
