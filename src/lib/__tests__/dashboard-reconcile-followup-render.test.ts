/**
 * Follow-up to the independent review of da810af (H1, M2, M3, M4).
 * Every assertion renders the real components; nothing greps the source.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveComboChartScope } from '@/lib/aether/brand-scope'
import { buildArTieOut } from '@/lib/odoo/receivable-aging'
import { computeGlobalWorkspace } from '@/lib/aether/global-filter-engine'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { buildAllocatedTodaySummary, loadLiveTodaySummary } from './support/dashboard-fixture'
import {
  dashboardContext,
  renderAr,
  scopeBadgesOf,
  setDashboardContext,
  textOfAttr,
  todayFilters,
} from './support/render-dashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => dashboardContext.value,
}))

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')
const COMPANY_WIDE_CARDS = ['gl-operating-net', 'aggregator-commissions', 'ledger-ar', 'gl-distribution'] as const

async function renderDashboard(summary: OdooLiveSummary, brand: string): Promise<string> {
  setDashboardContext(summary, todayFilters(brand))
  const { FullJourney360 } = await import('@/components/aether/FullJourney360')
  return renderAr(React.createElement(FullJourney360))
}

/**
 * SYNTHETIC receivable on the new due-date basis. The split is invented for the test only;
 * it is built so that open debits + unapplied credits = the live open AR headline (1,182.708).
 */
function withDueDateAging(summary: OdooLiveSummary): OdooLiveSummary {
  const ar = summary.aggregatorReceivables!
  ar.agingBasis = 'open-debits-by-due-date'
  ar.agingBuckets = [
    { key: '0_30', labelAr: '0–30 يوماً', labelEn: '0–30 days', residualKwd: 300, positiveDebitKwd: 300, creditOffsetKwd: 0, linesCount: 3 },
    { key: '31_60', labelAr: '31–60 يوماً', labelEn: '31–60 days', residualKwd: 200, positiveDebitKwd: 200, creditOffsetKwd: 0, linesCount: 2 },
    { key: 'over_60', labelAr: 'أكثر من 60 يوماً', labelEn: 'Over 60 days', residualKwd: 3276.2, positiveDebitKwd: 3276.2, creditOffsetKwd: 0, linesCount: 9 },
  ]
  ar.openDebitsKwd = 3776.2
  ar.unappliedCreditsKwd = -2593.492
  ar.unappliedCreditLinesCount = 4
  return summary
}

describe('H1 — every company-wide or all-brand card says so under a brand filter (rendered)', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('brand = China Garden: the four GL/AR cards carry «على مستوى الشركة», combo and pulse carry «كل العلامات»', async () => {
    const html = await renderDashboard(loadLiveTodaySummary(), 'china-garden')
    const badges = scopeBadgesOf(html)
    for (const card of COMPANY_WIDE_CARDS) expect(badges[card], card).toBe('company-wide')
    expect(badges['sales-net-combo']).toBe('all-brands')
    expect(badges['weekly-pulse']).toBe('all-brands')
    expect(html.match(/على مستوى الشركة/g)?.length ?? 0).toBeGreaterThanOrEqual(COMPANY_WIDE_CARDS.length)
  })

  it('brand = all: no scope badge is shown anywhere', async () => {
    const html = await renderDashboard(loadLiveTodaySummary(), 'all')
    expect(scopeBadgesOf(html)).toEqual({})
    expect(html).not.toContain('data-scope-badge=')
  })

  it('combo chart: a brand-scoped series drops the company GL margin; an all-brand series is labelled', () => {
    expect(resolveComboChartScope({ brand: 'all', group: 'timeline', timelineScope: 'all-brands' })).toEqual({
      badge: null,
      plotCompanyMargin: true,
    })
    expect(resolveComboChartScope({ brand: 'china-garden', group: 'timeline', timelineScope: 'all-brands' })).toEqual({
      badge: 'all-brands',
      plotCompanyMargin: true,
    })
    expect(resolveComboChartScope({ brand: 'china-garden', group: 'timeline', timelineScope: 'brand' })).toEqual({
      badge: null,
      plotCompanyMargin: false,
    })
    expect(resolveComboChartScope({ brand: 'china-garden', group: 'branches', timelineScope: 'all-brands' })).toEqual({
      badge: null,
      plotCompanyMargin: false,
    })
  })
})

describe('M4 — the product-line gap is labelled as an all-brands gap', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('brand = China Garden on the live payload shows "Σ all brands vs order net", not a brand gap', async () => {
    const html = await renderDashboard(loadLiveTodaySummary(), 'china-garden')
    const basis = textOfAttr(html, 'data-brand-basis', 'product-lines')
    expect(basis).toContain('الفرق بين مجموع كل العلامات وصافي الطلبات')
    expect(basis).not.toContain('الفرق عن صافي الطلبات')
    expect(basis).toContain('5.600')
  })
})

describe('M3 — AR card: aging total + unapplied credits tie back to open AR with one credit figure', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('buildArTieOut ties debits + credits to the headline and flags a mismatch', () => {
    expect(buildArTieOut({ openDebitsKwd: 3776.2, unappliedCreditsKwd: -2593.492, openReceivableKwd: 1182.708 })).toEqual({
      openDebitsKwd: 3776.2,
      unappliedCreditsKwd: -2593.492,
      openReceivableKwd: 1182.708,
      ties: true,
      differenceKwd: 0,
    })
    expect(buildArTieOut({ openDebitsKwd: 3776.2, unappliedCreditsKwd: -2593.492, openReceivableKwd: 1180 })?.ties).toBe(false)
    expect(buildArTieOut({ openDebitsKwd: null, unappliedCreditsKwd: null, openReceivableKwd: 1182.708 })).toBeNull()
  })

  it('due-date basis: until per-customer aging is verified (Phase 5 · Item 2) the card shows the neutral status, not the tie-out amounts', async () => {
    const html = await renderDashboard(withDueDateAging(loadLiveTodaySummary()), 'all')
    expect(html).toContain('data-receivables-status="pending-reconciliation"')
    expect(html).toContain('قيد المطابقة مع المحاسبة')
    expect(html).not.toContain('data-ar-tie-out=')
    expect(html).not.toContain('1,182.708')
  })

  it('the reconciliation formula uses the same line-level credit figure as the card', () => {
    const ws = computeGlobalWorkspace(todayFilters('all'), withDueDateAging(loadLiveTodaySummary()))
    expect(ws.receivables.reconciliationFormulaEn).toContain('3,776.20')
    expect(ws.receivables.reconciliationFormulaEn).toContain('2,593.49')
    expect(ws.receivables.reconciliationFormulaEn).toContain('1,182.71')
    expect(String(ws.receivables.reconciliationFormulaEn).toLowerCase()).toContain('unapplied')
  })

  it('legacy payload: no tie-out and no second credit figure; neutral pending status instead of amounts', async () => {
    const html = await renderDashboard(loadLiveTodaySummary(), 'all')
    expect(html).not.toContain('data-ar-tie-out=')
    expect(html).not.toContain('data-ar-unapplied-credits=')
    expect(html).toContain('data-receivables-status="pending-reconciliation"')
  })
})

describe('M2 — unknown brand orders render as —, never 0 (rendered)', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('Feryal today-notes: China Garden on the product-line basis shows — for orders', async () => {
    setDashboardContext(loadLiveTodaySummary(), todayFilters('china-garden'))
    const { FeryalGovernanceStudio } = await import('@/components/erp/feryal-governance-studio')
    const html = renderAr(React.createElement(FeryalGovernanceStudio, { sessionRole: 'admin', initialMainTab: 'today-notes' }))
    const orders = textOfAttr(html, 'data-feryal-orders', 'value')
    expect(orders).not.toBeNull()
    expect(orders).toContain('—')
    expect(orders).not.toMatch(/\d/)
  })

  it('Feryal today-notes: allocated China Garden shows its real order count', async () => {
    setDashboardContext(buildAllocatedTodaySummary(), todayFilters('china-garden'))
    const { FeryalGovernanceStudio } = await import('@/components/erp/feryal-governance-studio')
    const html = renderAr(React.createElement(FeryalGovernanceStudio, { sessionRole: 'admin', initialMainTab: 'today-notes' }))
    expect(textOfAttr(html, 'data-feryal-orders', 'value')).toContain('20')
  })
})
