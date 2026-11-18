/** Review r2 lows: Cores Hub never shows estimated or invented order counts. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import { DEFAULT_GLOBAL_FILTERS, type GlobalFilters } from '@/lib/aether/global-filter-engine'
import { buildAllocatedTodaySummary, loadLiveTodaySummary } from './support/dashboard-fixture'

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')
const today = (brand = 'all'): GlobalFilters => ({ ...DEFAULT_GLOBAL_FILTERS, period: 'today', brand: brand as GlobalFilters['brand'] })
/** A custom range with no custom bucket in the payload: the engine falls back to labels without counts. */
const customWithoutBucket: GlobalFilters = { ...DEFAULT_GLOBAL_FILTERS, period: 'custom', customFrom: '2026-11-17', customTo: '2026-11-17' }

describe('r2 — Cores Hub order counts', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('legacy payload (no brandBasis): brand share shows no estimated orders (was CG 20 / Frank\'s 4)', () => {
    const snap = computeCoresHubSnapshot(today(), [], loadLiveTodaySummary())
    const cg = snap.sales.brandShare.find((r) => r.id === 'china-garden')
    expect(cg?.salesKwd).toBeCloseTo(133.55, 3)
    for (const row of snap.sales.brandShare) {
      expect(row.orders, row.id).toBeNull()
      expect(row.aovKwd, row.id).toBeNull()
    }
  })

  it('order-allocated payload: brand share keeps the real counts', () => {
    const snap = computeCoresHubSnapshot(today(), [], buildAllocatedTodaySummary())
    expect(snap.sales.brandShare.find((r) => r.id === 'china-garden')?.orders).toBe(20)
    expect(snap.sales.brandShare.find((r) => r.id === 'franks')?.orders).toBe(4)
  })

  it('fallback without a customBucket: branch rows use the payload\'s real daily counts; brand and channel orders stay unknown, never 0', () => {
    const summary = loadLiveTodaySummary()
    const snap = computeCoresHubSnapshot(customWithoutBucket, [], summary)
    const ardiya = snap.sales.branchRanking.find((r) => r.id === 'ardiya')
    expect(ardiya?.salesKwd).toBeGreaterThan(0)
    // The bucket is derived from the same payload's dailyByBranch rows (Arabic/English ledger parity).
    expect(ardiya?.orders).toBe(summary.dailyByBranch!['2026-11-17'].ardiya.orders)
    for (const row of snap.sales.brandShare) expect(row.orders, row.id).toBeNull()
    for (const row of snap.sales.channelRanking) expect(row.orders, row.id).toBeNull()
  })

  it('brand filter on an allocated payload: unattributed row keeps a real or unknown count, never a coerced 0', () => {
    const summary = buildAllocatedTodaySummary()
    const today0 = summary.buckets!.today!
    today0.byBrandByLocation!.unattributed = { 'china-garden': { netKwd: 1.5, orders: null as unknown as number } }
    const snap = computeCoresHubSnapshot(today('china-garden'), [], summary)
    expect(snap.sales.unattributedOrders).toBeNull()
  })

  it('brand = all on the live payload: branch ranking keeps real order counts (154.70 / 24)', () => {
    const snap = computeCoresHubSnapshot(today(), [], loadLiveTodaySummary())
    const total = snap.sales.branchRanking.reduce((s, r) => s + (r.orders ?? 0), 0)
    expect(total).toBe(24)
    expect(snap.sales.branchRanking.every((r) => r.orders !== null)).toBe(true)
  })
})
