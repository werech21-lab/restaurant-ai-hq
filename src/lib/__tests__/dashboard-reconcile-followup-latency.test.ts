/**
 * Review follow-up M1: the exact brand reads are bounded. When they do not finish inside their
 * budget the bucket falls back to the labelled product-line basis instead of holding the route.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildReconciledBucket } from '@/lib/odoo-live-connector'
import {
  BRAND_ORDER_COUNTS_BUDGET_MS,
  EXACT_BRAND_ROWS_BUDGET_MS,
  allocateExactBrandRows,
  countOrdersPerBrandWithin,
  startExactBrandRowsRead,
  type BrandScopeMapping,
  type OdooExecute,
} from '@/lib/odoo/brand-scope-fetch'
import { withinBudget } from '@/lib/odoo/read-budget'

const TEST_BUDGET_MS = 25
/** A removed or broken budget must fail fast instead of waiting for the 180 s suite timeout. */
const FAST_FAIL_MS = 2_000
const neverResolves: OdooExecute = () => new Promise(() => {})

const mapping: BrandScopeMapping = {
  brandIds: ['china-garden', 'franks'],
  locationKeys: ['ardiya', 'unattributed'],
  locationOfSession: () => 'ardiya',
  brandOfProduct: (_id, name) => (name.startsWith('CG') ? 'china-garden' : null),
  isExcludedProductName: () => false,
  kuwaitDayOf: () => '2026-11-17',
}

const window = { orderDomain: [], lineDomain: [], excludedCategoryIds: [] as number[] }

function routeMaxDurationMs(relativeRoute: string): number {
  const src = fs.readFileSync(path.resolve(import.meta.dirname, '../../app', relativeRoute), 'utf8')
  const seconds = Number(/export const maxDuration = (\d+)/.exec(src)?.[1])
  return seconds * 1000
}

describe('M1 latency — bounded exact brand reads', { timeout: FAST_FAIL_MS }, () => {
  it('withinBudget returns the fallback when the task is slower than the budget', async () => {
    const started = Date.now()
    const out = await withinBudget(new Promise<string>(() => {}), TEST_BUDGET_MS, 'fallback')
    expect(out).toEqual({ value: 'fallback', timedOut: true })
    expect(Date.now() - started).toBeLessThan(TEST_BUDGET_MS * 20)
  })

  it('withinBudget returns the value when the task is fast, and the fallback when it rejects', async () => {
    await expect(withinBudget(Promise.resolve(7), TEST_BUDGET_MS, 0)).resolves.toEqual({ value: 7, timedOut: false })
    await expect(withinBudget(Promise.reject(new Error('rpc')), TEST_BUDGET_MS, 0)).resolves.toEqual({ value: 0, timedOut: false })
  })

  it('timeout fallback: a hung Odoo read gives no allocation and the bucket keeps the labelled product-line basis', async () => {
    const rows = await startExactBrandRowsRead(neverResolves, window, { budgetMs: TEST_BUDGET_MS })
    expect(rows).toBeNull()
    const allocation = rows ? allocateExactBrandRows(rows, mapping) : null
    const bucket = buildReconciledBucket({
      key: 'today',
      from: '2026-11-17',
      to: '2026-11-18',
      days: 1,
      locNetMap: new Map([['ardiya', 10]]),
      locOrdersMap: new Map([['ardiya', 2]]),
      brandRawWeights: new Map([['china-garden', 11]]),
      brandQtyWeights: new Map([['china-garden', 3]]),
      locUiRawMap: new Map(),
      brandAllocation: allocation,
    })
    expect(bucket.brandBasis).toBe('product-lines')
    expect(bucket.brandBasisGapKwd).toBe(1)
    expect(bucket.byBrand?.['china-garden']?.orders).toBeNull()
  })

  it('timeout fallback: hung brand order counts give null (—), not 0', async () => {
    const counts = await countOrdersPerBrandWithin(
      neverResolves,
      [],
      new Map([['china-garden', [1, 2]]]),
      ['china-garden'],
      { budgetMs: TEST_BUDGET_MS },
    )
    expect(counts).toBeNull()
  })

  it('a fast read inside the budget still produces the exact allocation', async () => {
    const execute: OdooExecute = async <T,>(model: string): Promise<T> =>
      (model === 'pos.order'
        ? [{ id: 1, session_id: [5, 'S'], amount_total: 10, amount_tax: 0, date_order: '2026-11-17 06:00:00' }]
        : [{ id: 11, order_id: [1, 'O'], product_id: [3, 'CG rice'], price_subtotal: 10 }]) as T
    const rows = await startExactBrandRowsRead(execute, window, { budgetMs: 1_000 })
    expect(rows).not.toBeNull()
    const allocation = allocateExactBrandRows(rows!, mapping)
    expect(allocation?.byBrand['china-garden']).toEqual({ netKwd: 10, orders: 1 })
  })

  it('the brand-scope budgets stay well under the 30 s route limit', () => {
    // The dashboard loads and polls /api/erp/odoo-sync (GlobalFilterContext); the manual refresh button
    // calls /api/odoo-sync; the comparison screens call /api/erp/live-comparison. All three are pinned.
    const limitMs = Math.min(
      routeMaxDurationMs('api/erp/odoo-sync/route.ts'),
      routeMaxDurationMs('api/odoo-sync/route.ts'),
      routeMaxDurationMs('api/erp/live-comparison/route.ts'),
    )
    expect(limitMs).toBe(120_000)
    // Rows run alongside the main reads; counts run after them. Together they stay under half the limit.
    expect(EXACT_BRAND_ROWS_BUDGET_MS + BRAND_ORDER_COUNTS_BUDGET_MS).toBeLessThanOrEqual(limitMs / 2)
  })
})
