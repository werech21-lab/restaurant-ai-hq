import { describe, expect, it } from 'vitest'
import { buildReconciledBucket } from '@/lib/odoo-live-connector'
import {
  allocateBrandsFromOrders,
  allocateByLargestRemainder,
  toFils,
} from '@/lib/odoo/brand-order-allocation'
import { countOrdersPerBrand, fetchExactBrandAllocation, type OdooExecute } from '@/lib/odoo/brand-scope-fetch'
import { BRAND_IDS, LOCATION_KEYS, allocateSyntheticToday } from './support/dashboard-fixture'

/** Today bucket inputs from the 17 Nov 2026 live payload (order-level 154.70 KWD / 24 orders). */
function liveTodayBucketInputs() {
  return {
    key: 'today' as const,
    from: '2026-11-17',
    to: '2026-11-18',
    days: 1,
    locNetMap: new Map([['ardiya', 99.35], ['promenade', 31.55], ['salmiya', 18.35], ['al-kout', 5.45]]),
    locOrdersMap: new Map([['ardiya', 13], ['promenade', 7], ['salmiya', 3], ['al-kout', 1]]),
    brandRawWeights: new Map([['china-garden', 133.55], ['franks', 23.5], ['noodle-bar', 3.25]]),
    brandQtyWeights: new Map([['china-garden', 50], ['franks', 9], ['noodle-bar', 1]]),
    locUiRawMap: new Map(),
  }
}

describe('M1 — brand order counts are real or null, never pro-rata', () => {
  it('M1 RED→GREEN: does not report China Garden = 20 orders estimated from 133.55/160.30 × 24', () => {
    const bucket = buildReconciledBucket(liveTodayBucketInputs())
    expect(bucket.totals.restaurantOrders).toBe(24)
    expect(bucket.byBrand?.['china-garden']?.orders).not.toBe(20)
    expect(bucket.byBrand?.['china-garden']?.orders).toBeNull()
    expect(bucket.byBrand?.['franks']?.orders).toBeNull()
    expect(bucket.byBrand?.['noodle-bar']?.orders).toBeNull()
  })

  it('uses real distinct order counts when Odoo supplied them', () => {
    const bucket = buildReconciledBucket({
      ...liveTodayBucketInputs(),
      brandOrdersMap: new Map([['china-garden', 19], ['franks', 5], ['noodle-bar', 1]]),
    })
    expect(bucket.byBrand?.['china-garden']?.orders).toBe(19)
    expect(bucket.byBrand?.['noodle-bar']?.orders).toBe(1)
    expect(bucket.byBrand?.['tahina']?.orders).toBeNull()
  })

  it('countOrdersPerBrand runs one search_count per brand on orders holding a brand product', async () => {
    const calls: unknown[][] = []
    const execute: OdooExecute = async <T,>(model: string, method: string, args: unknown[]) => {
      calls.push([model, method, args])
      return 7 as T
    }
    const counts = await countOrdersPerBrand(
      execute,
      [['state', 'in', ['paid', 'done', 'invoiced']], ['amount_total', '>=', 0]],
      new Map([['china-garden', [11, 12]]]),
      ['china-garden', 'franks'],
    )
    expect(counts.get('china-garden')).toBe(7)
    expect(counts.get('franks')).toBe(0)
    expect(calls).toHaveLength(1)
    expect(JSON.stringify(calls[0])).toContain('"lines.product_id","in",[11,12]')
    expect(JSON.stringify(calls[0])).toContain('"amount_total",">=",0')
  })
})

describe('M2 — brand net is on the order-net basis or labelled with its gap', () => {
  it('M2 RED→GREEN: brand line sum 160.30 vs order net 154.70 exposes brandBasisGapKwd and is not reconciled', () => {
    const bucket = buildReconciledBucket(liveTodayBucketInputs())
    expect(bucket.brandBasis).toBe('product-lines')
    expect(bucket.brandBasisGapKwd).toBeCloseTo(5.6, 3)
    expect(bucket.byBrandByLocation).toBeNull()
  })

  it('allocates brand-less discount lines inside each order; Σ brands + unbranded + excluded = order net exactly', () => {
    const result = allocateSyntheticToday()
    const brandFils = BRAND_IDS.reduce((s, bid) => s + toFils(result.byBrand[bid].netKwd), 0)
    expect(brandFils + toFils(result.unbrandedNetKwd) + toFils(result.excludedLineNetKwd)).toBe(toFils(result.orderNetKwd))
    expect(result.orderNetKwd).toBeCloseTo(154.7, 3)
    // The −1.60 discount is shared 10 : 5 between China Garden and Frank's inside its own order.
    expect(result.byBrandByLocation.ardiya['franks'].netKwd).toBeCloseTo(8.95 + 5 - 0.533, 3)
  })

  it('counts an order once for every brand it contains, and never counts refunds as orders', () => {
    const result = allocateBrandsFromOrders({
      orders: [
        { orderId: 1, locationKey: 'ardiya', dayIso: '2026-11-17', netKwd: 12, isRefund: false },
        { orderId: 2, locationKey: 'ardiya', dayIso: '2026-11-17', netKwd: -4, isRefund: true },
      ],
      lines: [
        { orderId: 1, netKwd: 8, lineClass: { kind: 'brand', brandId: 'china-garden' } },
        { orderId: 1, netKwd: 4, lineClass: { kind: 'brand', brandId: 'franks' } },
        { orderId: 2, netKwd: -4, lineClass: { kind: 'brand', brandId: 'china-garden' } },
      ],
      brandIds: BRAND_IDS,
      locationKeys: LOCATION_KEYS,
    })
    expect(result.byBrand['china-garden']).toEqual({ netKwd: 4, orders: 1 })
    expect(result.byBrand['franks']).toEqual({ netKwd: 4, orders: 1 })
  })

  it('removes excluded / non-company lines and keeps brand-less positive lines unbranded', () => {
    const result = allocateBrandsFromOrders({
      orders: [{ orderId: 1, locationKey: 'unattributed', dayIso: '2026-11-17', netKwd: 10, isRefund: false }],
      lines: [
        { orderId: 1, netKwd: 6, lineClass: { kind: 'brand', brandId: 'tahina' } },
        { orderId: 1, netKwd: 3, lineClass: { kind: 'excluded' } },
        { orderId: 1, netKwd: 1, lineClass: { kind: 'unbranded' } },
      ],
      brandIds: BRAND_IDS,
      locationKeys: LOCATION_KEYS,
    })
    expect(result.byBrand['tahina'].netKwd).toBe(6)
    expect(result.excludedLineNetKwd).toBe(3)
    expect(result.unbrandedNetKwd).toBe(1)
    expect(result.byBrandByLocation.unattributed['tahina']).toEqual({ netKwd: 6, orders: 1 })
  })

  it('largest-remainder allocation returns integer fils that add up exactly', () => {
    const parts = allocateByLargestRemainder(-1000, new Map([['a', 1], ['b', 1], ['c', 1]]))
    expect([...parts.values()].reduce((s, v) => s + v, 0)).toBe(-1000)
    expect([...parts.values()].every(Number.isInteger)).toBe(true)
  })

  it('buildReconciledBucket switches to the exact allocation only when it covers the same order net', () => {
    const allocation = allocateSyntheticToday()
    const exact = buildReconciledBucket({ ...liveTodayBucketInputs(), brandAllocation: allocation })
    expect(exact.brandBasis).toBe('order-allocated')
    expect(exact.brandBasisGapKwd).toBe(0)
    const brandSum = BRAND_IDS.reduce((s, bid) => s + (exact.byBrand?.[bid]?.netKwd ?? 0), 0)
    expect(brandSum + (exact.unbrandedNetKwd ?? 0) + (exact.excludedLineNetKwd ?? 0)).toBeCloseTo(
      exact.totals.restaurantNetKwd ?? Number.NaN,
      3,
    )
    const stale = buildReconciledBucket({
      ...liveTodayBucketInputs(),
      brandAllocation: { ...allocation, orderNetKwd: allocation.orderNetKwd + 3 },
    })
    expect(stale.brandBasis).toBe('product-lines')
    expect(stale.byBrandByLocation).toBeNull()
  })

  it('fetchExactBrandAllocation classifies excluded-category lines and refuses truncated reads', async () => {
    const rows: Record<string, unknown[]> = {
      'pos.order': [
        { id: 1, session_id: [5, 'S'], amount_total: 11, amount_tax: 0, date_order: '2026-11-17 03:00:00' },
      ],
      'pos.order.line': [
        { id: 10, order_id: [1, 'O'], product_id: [100, 'Kung Pao'], price_subtotal: 8 },
        { id: 11, order_id: [1, 'O'], product_id: [101, 'Staff Meal'], price_subtotal: 3 },
      ],
    }
    const execute: OdooExecute = async <T,>(model: string, _m: string, args: unknown[]) => {
      const domain = JSON.stringify(args[0])
      if (domain.includes('product_id.pos_categ_id')) return [{ id: 11 }] as T
      return rows[model] as T
    }
    const mapping = {
      brandIds: BRAND_IDS,
      locationKeys: LOCATION_KEYS,
      locationOfSession: () => 'ardiya',
      brandOfProduct: (pid: number | null) => (pid === 100 ? 'china-garden' : null),
      isExcludedProductName: () => false,
      kuwaitDayOf: () => '2026-11-17',
    }
    const window = { orderDomain: [], lineDomain: [], excludedCategoryIds: [42] }
    const result = await fetchExactBrandAllocation(execute, window, mapping)
    expect(result?.byBrand['china-garden']).toEqual({ netKwd: 8, orders: 1 })
    expect(result?.excludedLineNetKwd).toBe(3)
    const truncated = await fetchExactBrandAllocation(execute, window, mapping, 1)
    expect(truncated).toBeNull()
  })
})
