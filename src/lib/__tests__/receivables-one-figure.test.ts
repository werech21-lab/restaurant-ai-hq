/**
 * /erp, /erp/receivables and /erp/finance read one customer-receivable object.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeGlobalWorkspace } from '@/lib/aether/global-filter-engine'
import { loadLiveTodaySummary } from './support/dashboard-fixture'
import { dashboardContext, renderAr, setDashboardContext, todayFilters } from './support/render-dashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => dashboardContext.value,
}))

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')
const NET = '30,310.675'
const DEBITS = '31,662.047'
const CREDITS = '-1,351.372'
const INCLUSIVE_NET = '29,318.356'
const INCLUSIVE_DEBITS = '3,931,045.214'

describe('one customer-receivable figure on every page', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('renders the same 10552-free debits, credits and net on the dashboard, receivables and finance', async () => {
    const summary = loadLiveTodaySummary()
    const current = summary.aggregatorReceivables
    if (!current) throw new Error('fixture has no receivables')
    summary.aggregatorReceivables = {
      ...current,
      readable: true,
      openReceivableKwd: 29318.356,
      grossPositiveReceivableKwd: 3931045.214,
      creditClearingOffsetKwd: -3901726.858,
      platformNetKwd: 30310.675,
      platformOpenDebitsKwd: 30310.675,
      platformUnappliedCreditsKwd: 0,
      byAccount: [
        {
          accountId: 1666,
          accountCode: '10501',
          accountName: 'Talabat',
          labelAr: '10501',
          labelEn: '10501',
          residualKwd: 30310.675,
          linesCount: 6,
        },
        {
          accountId: 35,
          accountCode: '10552',
          accountName: 'POS',
          labelAr: '10552',
          labelEn: '10552',
          residualKwd: -992.319,
          linesCount: 4,
        },
      ],
      byPartner: [
        {
          partnerId: 1,
          partnerName: 'Talabat',
          accountId: 1666,
          accountCode: '10501',
          accountName: 'Talabat',
          residualKwd: 31662.047,
          linesCount: 1,
          oldestPostingDate: '2026-01-01',
        },
        {
          partnerId: 2,
          partnerName: 'Credit A',
          accountId: 1666,
          accountCode: '10501',
          accountName: 'Talabat',
          residualKwd: -1301.872,
          linesCount: 1,
          oldestPostingDate: '2026-01-02',
        },
        {
          partnerId: 3,
          partnerName: 'Credit B',
          accountId: 1666,
          accountCode: '10501',
          accountName: 'Talabat',
          residualKwd: -36.553,
          linesCount: 1,
          oldestPostingDate: '2026-01-03',
        },
        {
          partnerId: 4,
          partnerName: 'Credit C',
          accountId: 1666,
          accountCode: '10501',
          accountName: 'Talabat',
          residualKwd: -12.645,
          linesCount: 1,
          oldestPostingDate: '2026-01-04',
        },
        {
          partnerId: 5,
          partnerName: 'Credit D',
          accountId: 1666,
          accountCode: '10501',
          accountName: 'Talabat',
          residualKwd: -0.302,
          linesCount: 1,
          oldestPostingDate: '2026-01-05',
        },
      ],
    }
    const filters = todayFilters('all')
    const workspace = computeGlobalWorkspace(filters, summary)
    const figures = workspace.receivables.figures
    expect(figures).toBeDefined()
    expect(figures?.netKwd).toBe(30310.675)
    expect(figures?.openDebitsKwd).toBe(31662.047)
    expect(figures?.unappliedCreditsKwd).toBe(-1351.372)
    expect(workspace.receivables.reconciliationFormulaAr).toBe(figures?.formulaAr)

    setDashboardContext(summary, filters)
    const { FullJourney360 } = await import('@/components/aether/FullJourney360')
    const { ReceivablesAgingStudio } = await import('@/components/erp/ReceivablesAgingStudio')
    const { VentureAccountingHub } = await import('@/components/accounting/VentureAccountingHub')
    const { OdooAccountingAnalyticsHub } = await import('@/components/accounting/OdooAccountingAnalyticsHub')

    const pages = [
      renderAr(React.createElement(FullJourney360)),
      renderAr(React.createElement(ReceivablesAgingStudio)),
      renderAr(React.createElement(VentureAccountingHub, { locale: 'ar', initialTab: 'receivables' })),
      renderAr(React.createElement(OdooAccountingAnalyticsHub, { isAr: true, locale: 'ar' })),
    ]
    for (const html of pages) {
      expect(html).toContain(NET)
      expect(html).not.toContain(INCLUSIVE_NET)
      expect(html).not.toContain(INCLUSIVE_DEBITS)
    }
    for (const html of pages.slice(0, 3)) {
      expect(html).toContain(DEBITS)
      expect(html).toContain(CREDITS)
    }
  })
})
