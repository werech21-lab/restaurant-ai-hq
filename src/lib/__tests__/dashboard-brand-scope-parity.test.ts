import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import {
  APPROVED_BRAND_IDS,
  computeGlobalWorkspace,
  DASHBOARD_BRANCH_CARD_IDS,
  DEFAULT_GLOBAL_FILTERS,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { resolveBranchScope, sharesOf } from '@/lib/aether/brand-scope'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { buildAllocatedTodaySummary, loadLiveTodaySummary } from './support/dashboard-fixture'

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')
const KWD_TOLERANCE = 0.001
const SHARE_TOLERANCE_PCT = 0.1
const BRAND_FILTERS = ['all', ...APPROVED_BRAND_IDS] as const

function todayFilters(brand: string): GlobalFilters {
  return { ...DEFAULT_GLOBAL_FILTERS, period: 'today', brand: brand as GlobalFilters['brand'] }
}

function assertParity(summary: OdooLiveSummary, brand: string) {
  const ws = computeGlobalWorkspace(todayFilters(brand), summary)
  const snap = computeCoresHubSnapshot(todayFilters(brand), [], summary)
  const scope = resolveBranchScope(summary.buckets?.today, brand, DASHBOARD_BRANCH_CARD_IDS)
  if (!scope.available) {
    // No exact split: cards must be withheld, never shown with all-brand numbers.
    expect(snap.sales.branchRanking.every((r) => r.salesKwd === 0)).toBe(true)
    if (ws.nullableSalesKwd !== null && ws.nullableSalesKwd > 0) expect(snap.sales.branchesUnavailable).toBe(true)
    return
  }
  const cards = [...DASHBOARD_BRANCH_CARD_IDS.map((id) => scope.rows[id]), scope.unattributed]
  const cardNet = cards.reduce((s, c) => s + c.netKwd, 0)
  expect(Math.abs(cardNet - (ws.nullableSalesKwd ?? Number.NaN))).toBeLessThanOrEqual(KWD_TOLERANCE)
  const cardOrders = cards.reduce((s, c) => s + (c.orders ?? 0), 0)
  if (ws.nullableOrders === null) expect(cards.every((c) => c.orders === null)).toBe(true)
  else expect(cardOrders).toBe(ws.nullableOrders)
  const shares = sharesOf(cards.map((c) => c.netKwd)).filter((v): v is number => v !== null)
  if (cardNet > 0) expect(Math.abs(shares.reduce((s, v) => s + v, 0) - 100)).toBeLessThanOrEqual(SHARE_TOLERANCE_PCT)
  const rankingNet = snap.sales.branchRanking.reduce((s, r) => s + r.salesKwd, 0)
  expect(Math.abs(rankingNet - cardNet)).toBeLessThanOrEqual(KWD_TOLERANCE)
  if (rankingNet > 0) {
    const rankingShares = snap.sales.branchRanking.reduce((s, r) => s + r.sharePct, 0)
    expect(Math.abs(rankingShares - 100)).toBeLessThanOrEqual(SHARE_TOLERANCE_PCT * snap.sales.branchRanking.length)
  }
}

describe('dashboard brand-scope parity: headline = Σ branch cards for every brand filter', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('live fixture, brand=all reconciles to 154.70 KWD / 24 orders', () => {
    const summary = loadLiveTodaySummary()
    const ws = computeGlobalWorkspace(todayFilters('all'), summary)
    expect(ws.nullableSalesKwd).toBeCloseTo(154.7, 3)
    expect(ws.nullableOrders).toBe(24)
    assertParity(summary, 'all')
  })

  it.each(BRAND_FILTERS)('live fixture (product-line brand basis), brand=%s', (brand) => {
    const summary = loadLiveTodaySummary()
    assertParity(summary, brand)
    if (brand !== 'all') {
      const ws = computeGlobalWorkspace(todayFilters(brand), summary)
      expect(ws.nullableOrders).toBeNull()
      expect(ws.brandBasis).toBe('product-lines')
      expect(ws.brandBasisGapKwd).toBeCloseTo(5.6, 3)
    }
  })

  it('live fixture brand totals keep their values: China Garden 133.55, Frank\'s 23.50, Noodle Bar 3.25 (product lines)', () => {
    const summary = loadLiveTodaySummary()
    const net = (b: string) => computeGlobalWorkspace(todayFilters(b), summary).nullableSalesKwd
    expect(net('china-garden')).toBeCloseTo(133.55, 3)
    expect(net('franks')).toBeCloseTo(23.5, 3)
    expect(net('noodle-bar')).toBeCloseTo(3.25, 3)
    expect((net('china-garden') ?? 0) + (net('franks') ?? 0) + (net('noodle-bar') ?? 0) - 154.7).toBeCloseTo(5.6, 3)
  })

  it.each(BRAND_FILTERS)('order-allocated fixture, brand=%s', (brand) => {
    assertParity(buildAllocatedTodaySummary(), brand)
  })

  it('order-allocated fixture: Σ brands + unbranded = 154.70, and brand orders are real counts', () => {
    const summary = buildAllocatedTodaySummary()
    const total = APPROVED_BRAND_IDS.reduce(
      (s, b) => s + (computeGlobalWorkspace(todayFilters(b), summary).nullableSalesKwd ?? 0),
      0,
    )
    expect(total + (summary.buckets?.today?.unbrandedNetKwd ?? 0)).toBeCloseTo(154.7, 3)
    expect(computeGlobalWorkspace(todayFilters('china-garden'), summary).nullableOrders).toBe(20)
    expect(computeGlobalWorkspace(todayFilters('franks'), summary).nullableOrders).toBe(4)
    expect(computeGlobalWorkspace(todayFilters('noodle-bar'), summary).nullableOrders).toBe(1)
  })

  it('school canteens stay in the branch cards and the totals', () => {
    expect(DASHBOARD_BRANCH_CARD_IDS).toContain('school-canteens')
  })
})
