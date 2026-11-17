/**
 * Phase 5 · Item 7 follow-up — when Odoo has no GL lock dates at all, profit is not silently
 * hidden: every surface shows ONE calm note ("Profit appears after the month is closed in accounting").
 * Uses the real 2026-11-17 dashboard payload (no lock dates, as in production today).
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeGlobalWorkspace } from '@/lib/aether/global-filter-engine'
import { PROFIT_AFTER_CLOSE_NOTE, closedMonthWithheldReason } from '@/lib/aether/closed-month-policy'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'
import { dashboardContext, renderAr, setDashboardContext, todayFilters } from '../support/render-dashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => dashboardContext.value,
}))

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')
const count = (html: string, s: string) => html.split(s).length - 1

/** Same payload with the GL marked fully posted, so only the lock-date rule can hide profit. */
function withCompleteGl(summary: OdooLiveSummary, closedThrough: string | null): OdooLiveSummary {
  const gl = summary.buckets!.today!.accounting!
  Object.assign(gl, {
    completeAccrualPosted: true,
    glIncomplete: false,
    aggregatorCommissionUnposted: false,
    expense: Math.max(1, gl.expense),
    depreciation: Math.max(1, gl.depreciation),
    deliveryCommissions: Math.max(1, gl.deliveryCommissions ?? 0),
    deliveryCommissionLinesCount: Math.max(1, gl.deliveryCommissionLinesCount ?? 0),
    glClosedThroughDate: closedThrough,
  })
  delete (gl as { glWarningAr?: string }).glWarningAr
  return summary
}

describe('profit with no Odoo lock dates', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('the reason for "no lock dates" is the single calm note', () => {
    expect(closedMonthWithheldReason(null)).toEqual(PROFIT_AFTER_CLOSE_NOTE)
    expect(PROFIT_AFTER_CLOSE_NOTE.en).toBe('Profit appears after the month is closed in accounting')
  })

  it('real payload (no lock dates): workspace withholds profit and carries the note', () => {
    const ws = computeGlobalWorkspace(todayFilters('all'), loadLiveTodaySummary())
    expect(ws.accounting.operatingProfitKwd).toBeNull()
    expect(ws.accounting.netProfitWithheld).toBe(true)
    expect(ws.accounting.netProfitWithheldReasonEn).toBe(PROFIT_AFTER_CLOSE_NOTE.en)
    expect(ws.accounting.netProfitWithheldReasonAr).toBe(PROFIT_AFTER_CLOSE_NOTE.ar)
  })

  it('fully posted GL, no lock dates: Home and the accounting hub each show the note exactly once and no profit', async () => {
    const summary = withCompleteGl(loadLiveTodaySummary(), null)
    setDashboardContext(summary, todayFilters('all'))
    const ws = computeGlobalWorkspace(todayFilters('all'), summary)
    expect(ws.accounting.available).toBe(true)
    expect(ws.accounting.operatingProfitKwd).toBeNull()

    const { FullJourney360 } = await import('@/components/aether/FullJourney360')
    const home = renderAr(React.createElement(FullJourney360))
    expect(count(home, PROFIT_AFTER_CLOSE_NOTE.ar)).toBe(1)
    expect(home).not.toContain('2,746.197')

    const { OdooAccountingAnalyticsHub } = await import('@/components/accounting/OdooAccountingAnalyticsHub')
    const hub = renderAr(React.createElement(OdooAccountingAnalyticsHub, { isAr: true, locale: 'ar' }))
    expect(count(hub, PROFIT_AFTER_CLOSE_NOTE.ar)).toBe(1)
    expect(hub).not.toContain('2,746.197')
  })

  it('once the month is locked in Odoo, the same profit is shown and the note disappears', () => {
    const ws = computeGlobalWorkspace(todayFilters('all'), withCompleteGl(loadLiveTodaySummary(), '2026-11-30'))
    expect(ws.accounting.netProfitWithheld).toBe(false)
    expect(ws.accounting.operatingProfitKwd).toBe(2746.197)
  })
})
