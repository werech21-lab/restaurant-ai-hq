/**
 * Reads the Odoo rows behind the exact brand view and hands them to the pure allocator.
 *
 * The Odoo call is injected (`execute`) so the composition root owns the connection and tests can
 * pass a fake. Every read is bounded: when a window holds more rows than `maxRows`, the exact view
 * is reported as unavailable (`null`) instead of being computed from a truncated sample.
 */
import {
  allocateBrandsFromOrders,
  type BrandAllocationResult,
  type BrandLineClass,
  type PosOrderHeader,
  type PosOrderLineInput,
} from '@/lib/odoo/brand-order-allocation'

/** Upper bound on order or line rows read for one window (a busy week stays well below it). */
export const MAX_EXACT_BRAND_ROWS = 25_000

export type OdooExecute = <T>(
  model: string,
  method: string,
  args: unknown[],
  kwargs?: Record<string, unknown>,
) => Promise<T>

type M2O = [number, string] | false | null | undefined

interface OrderRow {
  id: number
  session_id?: M2O
  amount_total?: number
  amount_tax?: number
  date_order?: string
}

interface LineRow {
  id: number
  order_id?: M2O
  product_id?: M2O
  price_subtotal?: number
}

export interface BrandScopeWindow {
  /** `pos.order` domain for the window (company configs, paid states, refunds included). */
  orderDomain: unknown[][]
  /** `pos.order.line` domain for the same orders, without the excluded-category clause. */
  lineDomain: unknown[][]
  excludedCategoryIds: readonly number[]
}

export interface BrandScopeMapping {
  brandIds: readonly string[]
  locationKeys: readonly string[]
  locationOfSession: (sessionId: number | null) => string
  brandOfProduct: (productId: number | null, productName: string) => string | null
  isExcludedProductName: (productName: string) => boolean
  kuwaitDayOf: (dateOrderUtc: string | undefined) => string | null
}

function m2oId(v: M2O): number | null {
  return Array.isArray(v) && typeof v[0] === 'number' ? v[0] : null
}

function m2oName(v: M2O): string {
  return Array.isArray(v) && typeof v[1] === 'string' ? v[1] : ''
}

function searchReadBounded<T>(
  execute: OdooExecute,
  model: string,
  domain: unknown[][],
  fields: string[],
  maxRows: number,
): Promise<T[]> {
  return execute<T[]>(model, 'search_read', [domain], { fields, limit: maxRows + 1 })
}

function classifyLine(
  row: LineRow,
  excludedLineIds: ReadonlySet<number>,
  mapping: BrandScopeMapping,
): BrandLineClass {
  const name = m2oName(row.product_id).trim()
  if (excludedLineIds.has(row.id) || mapping.isExcludedProductName(name)) return { kind: 'excluded' }
  const brandId = mapping.brandOfProduct(m2oId(row.product_id), name)
  return brandId ? { kind: 'brand', brandId } : { kind: 'unbranded' }
}

function toOrderHeader(row: OrderRow, mapping: BrandScopeMapping): PosOrderHeader | null {
  const dayIso = mapping.kuwaitDayOf(row.date_order)
  if (!dayIso) return null
  const amountTotal = Number(row.amount_total) || 0
  return {
    orderId: row.id,
    locationKey: mapping.locationOfSession(m2oId(row.session_id)),
    dayIso,
    netKwd: amountTotal - (Number(row.amount_tax) || 0),
    isRefund: amountTotal < 0,
  }
}

/** Exact per-order brand allocation for one window, or `null` when it cannot be computed in full. */
export async function fetchExactBrandAllocation(
  execute: OdooExecute,
  window: BrandScopeWindow,
  mapping: BrandScopeMapping,
  maxRows: number = MAX_EXACT_BRAND_ROWS,
): Promise<BrandAllocationResult | null> {
  const excludedLineDomain =
    window.excludedCategoryIds.length > 0
      ? [...window.lineDomain, ['product_id.pos_categ_id', 'in', [...window.excludedCategoryIds]]]
      : null
  const [orderRows, lineRows, excludedRows] = await Promise.all([
    searchReadBounded<OrderRow>(execute, 'pos.order', window.orderDomain, ['id', 'session_id', 'amount_total', 'amount_tax', 'date_order'], maxRows),
    searchReadBounded<LineRow>(execute, 'pos.order.line', window.lineDomain, ['id', 'order_id', 'product_id', 'price_subtotal'], maxRows),
    excludedLineDomain
      ? searchReadBounded<{ id: number }>(execute, 'pos.order.line', excludedLineDomain, ['id'], maxRows)
      : Promise.resolve([] as { id: number }[]),
  ])
  if ([orderRows, lineRows, excludedRows].some((rows) => rows.length > maxRows)) return null

  const orders = orderRows.map((r) => toOrderHeader(r, mapping))
  if (orders.some((o) => o === null)) return null
  const orderIds = new Set(orderRows.map((r) => r.id))
  const excludedLineIds = new Set(excludedRows.map((r) => r.id))
  const lines: PosOrderLineInput[] = []
  for (const row of lineRows) {
    const orderId = m2oId(row.order_id)
    if (orderId === null || !orderIds.has(orderId)) continue
    lines.push({ orderId, netKwd: Number(row.price_subtotal) || 0, lineClass: classifyLine(row, excludedLineIds, mapping) })
  }
  return allocateBrandsFromOrders({
    orders: orders as PosOrderHeader[],
    lines,
    brandIds: mapping.brandIds,
    locationKeys: mapping.locationKeys,
  })
}

/**
 * Real distinct order counts per brand (`search_count` of orders holding at least one line of the
 * brand). Used for long windows where per-order allocation would be too large to read.
 */
export async function countOrdersPerBrand(
  execute: OdooExecute,
  nonRefundOrderDomain: unknown[][],
  productIdsByBrand: ReadonlyMap<string, readonly number[]>,
  brandIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = await Promise.all(
    brandIds.map(async (bid) => {
      const productIds = productIdsByBrand.get(bid) ?? []
      if (productIds.length === 0) return [bid, 0] as const
      const n = await execute<number>('pos.order', 'search_count', [
        [...nonRefundOrderDomain, ['lines.product_id', 'in', [...productIds]]],
      ])
      return [bid, Math.max(0, Math.round(Number(n) || 0))] as const
    }),
  )
  return new Map(counts)
}
