/**
 * Exact brand view of POS sales, reconciled to order-level net.
 *
 * Why this exists: `pos.order.line` product totals per brand do not add up to `pos.order` net,
 * because order-level discount / reward / refund lines carry no brand. Showing brand line totals
 * next to order totals made the dashboard mix two bases, and brand order counts were estimated
 * pro-rata. This module works per order, so every figure it returns is a real count or an exact
 * fils-level allocation inside one order.
 *
 * Rules:
 * - An order counts once for every brand it contains (an order with China Garden and Frank's
 *   items counts for both).
 * - Refund orders (`amount_total < 0`) reduce brand net but are not counted as orders, matching the
 *   company order count (`amount_total >= 0`).
 * - Brand-less negative lines (discounts, rewards) and the order rounding residual are allocated to
 *   that order's brands pro rata to their line totals. Brand-less positive lines stay "unbranded".
 * - Excluded and non-company lines are removed and reported separately.
 * Invariant: Σ brands + unbranded + excluded lines = Σ order net, exactly in fils.
 */

export const FILS_PER_KWD = 1000
export const UNATTRIBUTED_LOCATION_KEY = 'unattributed'

export interface PosOrderHeader {
  orderId: number
  locationKey: string
  dayIso: string
  netKwd: number
  isRefund: boolean
}

export interface PosOrderLineInput {
  orderId: number
  netKwd: number
  lineClass: BrandLineClass
}

export type BrandLineClass =
  | { kind: 'brand'; brandId: string }
  | { kind: 'excluded' }
  | { kind: 'unbranded' }

export interface BrandScopeCell {
  netKwd: number
  orders: number
}

export interface BrandAllocationResult {
  basis: 'order-allocated'
  byBrand: Record<string, BrandScopeCell>
  byBrandByLocation: Record<string, Record<string, BrandScopeCell>>
  byBrandDaily: Record<string, Record<string, BrandScopeCell>>
  unbrandedNetKwd: number
  excludedLineNetKwd: number
  orderNetKwd: number
}

interface OrderLineTotalsFils {
  brandFils: Map<string, number>
  excludedFils: number
  unbrandedPositiveFils: number
}

interface CellFils {
  fils: number
  orders: number
}

export function toFils(kwd: number): number {
  return Math.round((Number(kwd) || 0) * FILS_PER_KWD)
}

export function fromFils(fils: number): number {
  return fils / FILS_PER_KWD
}

function emptyLineTotals(): OrderLineTotalsFils {
  return { brandFils: new Map(), excludedFils: 0, unbrandedPositiveFils: 0 }
}

function groupLinesByOrder(lines: readonly PosOrderLineInput[]): Map<number, OrderLineTotalsFils> {
  const byOrder = new Map<number, OrderLineTotalsFils>()
  for (const line of lines) {
    const totals = byOrder.get(line.orderId) ?? emptyLineTotals()
    const fils = toFils(line.netKwd)
    if (line.lineClass.kind === 'brand') {
      const bid = line.lineClass.brandId
      totals.brandFils.set(bid, (totals.brandFils.get(bid) ?? 0) + fils)
    } else if (line.lineClass.kind === 'excluded') {
      totals.excludedFils += fils
    } else if (fils > 0) {
      totals.unbrandedPositiveFils += fils
    }
    byOrder.set(line.orderId, totals)
  }
  return byOrder
}

/**
 * Splits an integer amount over weights with the largest-remainder method, so the parts are
 * integers that add up exactly to the amount.
 */
export function allocateByLargestRemainder(
  amountFils: number,
  weights: ReadonlyMap<string, number>,
): Map<string, number> {
  const entries = [...weights.entries()].map(([k, w]) => [k, Math.abs(w)] as const)
  const weightTotal = entries.reduce((s, [, w]) => s + w, 0)
  const parts = new Map<string, number>()
  if (weightTotal === 0 || entries.length === 0) return parts
  const sign = amountFils < 0 ? -1 : 1
  const magnitude = Math.abs(amountFils)
  const exact = entries.map(([k, w]) => ({ k, raw: (magnitude * w) / weightTotal }))
  let assigned = 0
  for (const e of exact) {
    const floor = Math.floor(e.raw)
    parts.set(e.k, floor)
    assigned += floor
  }
  const byRemainder = [...exact].sort((a, b) => b.raw - Math.floor(b.raw) - (a.raw - Math.floor(a.raw)))
  for (let i = 0; i < magnitude - assigned; i++) {
    const target = byRemainder[i % byRemainder.length].k
    parts.set(target, (parts.get(target) ?? 0) + 1)
  }
  for (const [k, v] of parts) parts.set(k, v * sign)
  return parts
}

/** Brand net (fils) for one order after the order-level adjustment is shared out. */
export function allocateOrderToBrands(orderNetFils: number, totals: OrderLineTotalsFils): {
  brandFils: Map<string, number>
  unbrandedFils: number
} {
  const brandLineFils = [...totals.brandFils.values()].reduce((s, v) => s + v, 0)
  const adjustmentFils = orderNetFils - totals.excludedFils - totals.unbrandedPositiveFils - brandLineFils
  const shares = allocateByLargestRemainder(adjustmentFils, totals.brandFils)
  if (shares.size === 0) {
    return { brandFils: new Map(), unbrandedFils: orderNetFils - totals.excludedFils }
  }
  const brandFils = new Map<string, number>()
  for (const [bid, fils] of totals.brandFils) {
    brandFils.set(bid, fils + (shares.get(bid) ?? 0))
  }
  return { brandFils, unbrandedFils: totals.unbrandedPositiveFils }
}

function addToCell(
  target: Map<string, Map<string, CellFils>>,
  outerKey: string,
  brandId: string,
  fils: number,
  countsAsOrder: boolean,
): void {
  const inner = target.get(outerKey) ?? new Map<string, CellFils>()
  const cell = inner.get(brandId) ?? { fils: 0, orders: 0 }
  cell.fils += fils
  if (countsAsOrder) cell.orders += 1
  inner.set(brandId, cell)
  target.set(outerKey, inner)
}

function toCells(inner: Map<string, CellFils> | undefined, brandIds: readonly string[]): Record<string, BrandScopeCell> {
  return Object.fromEntries(
    brandIds.map((bid) => {
      const cell = inner?.get(bid)
      return [bid, { netKwd: fromFils(cell?.fils ?? 0), orders: cell?.orders ?? 0 }]
    }),
  )
}

function toNestedCells(
  source: Map<string, Map<string, CellFils>>,
  outerKeys: readonly string[],
  brandIds: readonly string[],
): Record<string, Record<string, BrandScopeCell>> {
  return Object.fromEntries(outerKeys.map((key) => [key, toCells(source.get(key), brandIds)]))
}

export function allocateBrandsFromOrders(input: {
  orders: readonly PosOrderHeader[]
  lines: readonly PosOrderLineInput[]
  brandIds: readonly string[]
  locationKeys: readonly string[]
}): BrandAllocationResult {
  const linesByOrder = groupLinesByOrder(input.lines)
  const total = new Map<string, Map<string, CellFils>>()
  const byLocation = new Map<string, Map<string, CellFils>>()
  const byDay = new Map<string, Map<string, CellFils>>()
  let unbrandedFils = 0
  let excludedFils = 0
  let orderNetFils = 0
  const knownBrands = new Set(input.brandIds)

  for (const order of input.orders) {
    const netFils = toFils(order.netKwd)
    orderNetFils += netFils
    const totals = linesByOrder.get(order.orderId) ?? emptyLineTotals()
    excludedFils += totals.excludedFils
    const allocation = allocateOrderToBrands(netFils, totals)
    unbrandedFils += allocation.unbrandedFils
    for (const [bid, fils] of allocation.brandFils) {
      if (!knownBrands.has(bid)) {
        unbrandedFils += fils
        continue
      }
      const countsAsOrder = !order.isRefund
      addToCell(total, 'all', bid, fils, countsAsOrder)
      addToCell(byLocation, order.locationKey, bid, fils, countsAsOrder)
      addToCell(byDay, order.dayIso, bid, fils, countsAsOrder)
    }
  }

  const days = [...byDay.keys()].sort()
  return {
    basis: 'order-allocated',
    byBrand: toCells(total.get('all'), input.brandIds),
    byBrandByLocation: toNestedCells(byLocation, input.locationKeys, input.brandIds),
    byBrandDaily: toNestedCells(byDay, days, input.brandIds),
    unbrandedNetKwd: fromFils(unbrandedFils),
    excludedLineNetKwd: fromFils(excludedFils),
    orderNetKwd: fromFils(orderNetFils),
  }
}
