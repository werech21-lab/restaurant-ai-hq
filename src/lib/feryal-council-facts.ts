import { Decimal } from '@/server/ai/decimal'
import type { ComparableFact } from '@/server/ai/structured-claim'

function canonicalNumber(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const parsed = Decimal.parse(Object.is(value, -0) ? '0' : String(value))
  return parsed ? parsed.canonical() : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * Numeric facts taken from the agent's own structuredFacts object.
 * A test-only records list is not read.
 */
export function numericFactsFromStructured(
  structured: unknown,
  period: { from: string; to: string } | null,
): ComparableFact[] {
  const record = asRecord(structured) ?? {}
  const nested = asRecord(record.period)
  const from = typeof nested?.from === 'string' ? nested.from : period?.from ?? ''
  const to = typeof nested?.to === 'string' ? nested.to : period?.to ?? from
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return []
  const periodKey = from === to ? from : `${from}..${to}`
  const facts: ComparableFact[] = []
  const seen = new Set<string>()
  const push = (
    metric: string,
    entityType: string,
    entityId: string,
    entityName: string,
    amount: unknown,
    unit: 'KWD' | 'orders' | 'qty',
  ) => {
    const value = canonicalNumber(amount)
    if (!value || !entityId) return
    const id = `${metric}|${entityId}|${periodKey}`
    if (seen.has(id)) return
    seen.add(id)
    facts.push({
      id,
      metric,
      period: periodKey,
      date: from === to ? from : periodKey,
      unit,
      value,
      entityType,
      entityId,
      entityName,
    })
  }
  const rows = Array.isArray(record.branches) ? record.branches : []
  for (const row of rows) {
    const item = asRecord(row)
    const id = typeof item?.id === 'string' ? item.id : ''
    const name = typeof item?.nameAr === 'string' ? item.nameAr : id
    if (!item || !id) continue
    push('net_sales_kwd', 'branch', id, name, item.netKwd, 'KWD')
    push('orders', 'branch', id, name, item.orders, 'orders')
  }
  const branch = asRecord(record.branch)
  if (branch && typeof branch.id === 'string') {
    const name = typeof branch.nameAr === 'string' ? branch.nameAr : branch.id
    push('net_sales_kwd', 'branch', branch.id, name, branch.netKwd, 'KWD')
    push('orders', 'branch', branch.id, name, branch.orders, 'orders')
  }
  if ('totalNetKwd' in record) push('net_sales_kwd', 'company', 'company', 'company', record.totalNetKwd, 'KWD')
  if ('companyTotalNetKwd' in record) push('net_sales_kwd', 'company', 'company', 'company', record.companyTotalNetKwd, 'KWD')
  if ('totalOrders' in record) push('orders', 'company', 'company', 'company', record.totalOrders, 'orders')
  if ('companyTotalOrders' in record) push('orders', 'company', 'company', 'company', record.companyTotalOrders, 'orders')
  const brandId = typeof record.brandId === 'string' ? record.brandId : 'items'
  const brandName = typeof record.scope === 'string' ? record.scope : brandId
  if ('itemNetTotalKwd' in record) push('item_net_kwd', 'brand', brandId, brandName, record.itemNetTotalKwd, 'KWD')
  if ('itemQtyTotal' in record) push('item_qty', 'brand', brandId, brandName, record.itemQtyTotal, 'qty')
  const itemRows = [
    ...(Array.isArray(record.itemRows) ? record.itemRows : []),
    ...(Array.isArray(record.topItems) ? record.topItems : []),
  ]
  for (const row of itemRows) {
    const item = asRecord(row)
    if (!item) continue
    const id = item.productId != null ? String(item.productId) : typeof item.name === 'string' ? item.name : ''
    const name = typeof item.name === 'string' ? item.name : id
    if (!id) continue
    push('item_net_kwd', 'product', id, name, item.netKwd ?? item.net1, 'KWD')
    if (typeof item.qty === 'number') push('item_qty', 'product', id, name, item.qty, 'qty')
    if (typeof item.unitPriceKwd === 'number') push('item_unit_price_kwd', 'product', id, name, item.unitPriceKwd, 'KWD')
  }
  return facts
}
