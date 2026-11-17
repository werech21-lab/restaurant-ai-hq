import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import { DEFAULT_GLOBAL_FILTERS, DASHBOARD_BRANCH_CARD_IDS, type GlobalFilters } from '@/lib/aether/global-filter-engine'
import { resolveBranchScope, resolveDailySeriesForBrand } from '@/lib/aether/brand-scope'
import { allocateSyntheticToday, buildAllocatedTodaySummary, loadLiveTodaySummary } from './support/dashboard-fixture'

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z') // 06:05 Asia/Kuwait, when the payload was read

function todayFilters(brand: string): GlobalFilters {
  return { ...DEFAULT_GLOBAL_FILTERS, period: 'today', brand: brand as GlobalFilters['brand'] }
}

const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0)

describe('M3 — branch cards follow the brand filter', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('M3 RED→GREEN: China Garden on the live payload does not show the all-brand 154.70 cards', () => {
    const snap = computeCoresHubSnapshot(todayFilters('china-garden'), [], loadLiveTodaySummary())
    const shownTotal = sum(snap.sales.branchRanking.map((r) => r.salesKwd))
    expect(shownTotal).not.toBeCloseTo(154.7, 2)
    expect(snap.sales.branchesUnavailable).toBe(true)
    expect(resolveBranchScope(loadLiveTodaySummary().buckets?.today, 'china-garden', DASHBOARD_BRANCH_CARD_IDS).available).toBe(false)
  })

  it('uses the exact brand split per branch when the bucket has one', () => {
    const summary = buildAllocatedTodaySummary()
    const snap = computeCoresHubSnapshot(todayFilters('china-garden'), [], summary)
    const expected = allocateSyntheticToday().byBrandByLocation
    expect(snap.sales.branchesUnavailable).toBe(false)
    expect(snap.sales.branchScope).toBe('brand')
    expect(snap.sales.branchRanking.find((r) => r.id === 'ardiya')?.salesKwd).toBeCloseTo(expected.ardiya['china-garden'].netKwd, 3)
    expect(snap.sales.branchRanking.find((r) => r.id === 'ardiya')?.orders).toBe(expected.ardiya['china-garden'].orders)
  })

  it('brand=all keeps the order-level branch cards (Ardiya 99.35 / 13)', () => {
    const scope = resolveBranchScope(loadLiveTodaySummary().buckets?.today, 'all', DASHBOARD_BRANCH_CARD_IDS)
    expect(scope.available && scope.rows.ardiya).toEqual({ netKwd: 99.35, orders: 13 })
  })
})

describe('M4 — the daily pulse never shows the company series as a brand', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('M4 RED→GREEN: with brand ≠ all and no brand series the pulse is labelled all-brands', () => {
    const snap = computeCoresHubSnapshot(todayFilters('china-garden'), [], loadLiveTodaySummary())
    expect(snap.sales.timelineScope).toBe('all-brands')
  })

  it('uses the brand daily series when the week bucket carries one', () => {
    const summary = buildAllocatedTodaySummary()
    summary.buckets!.week = {
      ...summary.buckets!.today!,
      key: 'week',
      from: '2026-11-11',
      to: '2026-11-18',
      days: 7,
    }
    const series = resolveDailySeriesForBrand(summary, 'china-garden', { fromIso: '2026-11-17', toInclusiveIso: '2026-11-17' })
    expect(series.scope).toBe('brand')
    expect(series.series[0].netKwd).toBeCloseTo(allocateSyntheticToday().byBrand['china-garden'].netKwd, 3)
    const snap = computeCoresHubSnapshot(todayFilters('china-garden'), [], summary)
    expect(snap.sales.timelineScope).toBe('brand')
    expect(snap.sales.timeline[0]?.salesKwd).toBeCloseTo(series.series[0].netKwd, 3)
  })

  it('brand=all keeps the company series (154.70 / 24 today)', () => {
    const snap = computeCoresHubSnapshot(todayFilters('all'), [], loadLiveTodaySummary())
    expect(snap.sales.timelineScope).toBe('all-brands')
    expect(snap.sales.timeline.map((p) => [p.salesKwd, p.orders])).toEqual([[154.7, 24]])
  })
})
