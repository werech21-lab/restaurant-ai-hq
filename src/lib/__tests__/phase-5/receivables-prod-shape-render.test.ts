/**
 * Phase 5 · Item 2 — production-shape receivables must never render an amount.
 *
 * The real 2026-11-17 dashboard payload is overlaid with the production receivable figures seen on
 * aetherbi.com (net -77,462.759 · gross 3,822,787.227 · credits -3,900,249.986 · account row
 * -79,267.054). /erp/finance and /accounting render VentureAccountingHub; /erp/receivables renders
 * ReceivablesAgingStudio. None may show a negative or >= 1,000,000 KWD amount, nor the
 * "= -77,462.759" explanation text — only the pending status and line counts.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeGlobalWorkspace } from '@/lib/aether/global-filter-engine'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'
import { dashboardContext, renderAr, setDashboardContext, todayFilters } from '../support/render-dashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp/receivables',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => dashboardContext.value,
}))

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')
const PROD_VALUES = ['77,462.759', '3,822,787.227', '3,900,249.986', '79,267.054']

function withProductionReceivables(summary: OdooLiveSummary): OdooLiveSummary {
  const ar = summary.aggregatorReceivables!
  ar.openReceivableKwd = -77462.759
  ar.grossPositiveReceivableKwd = 3822787.227
  ar.creditClearingOffsetKwd = -3900249.986
  ar.openLinesExplanationAr = 'الرصيد = 3,822,787.227 − 3,900,249.986 = -77,462.759 د.ك'
  ar.openLinesExplanationEn = 'Balance = 3,822,787.227 − 3,900,249.986 = -77,462.759 KWD'
  ar.byAccount = [
    {
      accountId: 10552,
      accountCode: '10552',
      accountName: 'POS Clearing',
      labelAr: 'مقاصة نقاط البيع',
      labelEn: 'POS Clearing',
      residualKwd: -79267.054,
      linesCount: 62766,
    },
  ]
  return summary
}

/** Every KWD-style amount (3 decimals) in the visible text, as numbers. */
function renderedAmounts(html: string): number[] {
  const text = html.replace(/<[^>]+>/g, ' ')
  return [...text.matchAll(/(-|−)?\s?\d{1,3}(?:,\d{3})*\.\d{3}/g)].map((m) =>
    Number(m[0].replace(/[−\s]/g, (c) => (c === '−' ? '-' : '')).replace(/,/g, '')),
  )
}

function expectNoLeak(html: string) {
  for (const v of PROD_VALUES) expect(html).not.toContain(v)
  for (const n of renderedAmounts(html)) {
    expect(n, `amount ${n}`).toBeGreaterThanOrEqual(0)
    expect(n, `amount ${n}`).toBeLessThan(1_000_000)
  }
  expect(html).toContain('قيد المطابقة مع المحاسبة')
  expect(html).not.toMatch(/overdue|متأخر/i)
}

describe('production-shape receivables never render an amount', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] })
    setDashboardContext(withProductionReceivables(loadLiveTodaySummary()), todayFilters('all'))
  })
  afterEach(() => vi.useRealTimers())

  it('workspace receivables are pending with no amounts, rows or buckets; delivery-dues card shows the status', () => {
    const ws = computeGlobalWorkspace(todayFilters('all'), withProductionReceivables(loadLiveTodaySummary()))
    expect(ws.receivables.pendingReconciliation).toBe(true)
    expect(ws.receivables.openReceivableKwd).toBeNull()
    expect(ws.receivables.grossPositiveReceivableKwd).toBeNull()
    expect(ws.receivables.creditClearingOffsetKwd).toBeNull()
    expect(ws.receivables.byAccount).toEqual([])
    expect(ws.receivables.agingBuckets).toEqual([])
    expect(ws.receivables.openDebitsKwd).toBeNull()
    expect(ws.receivables.unappliedCreditsKwd).toBeNull()
    expect(ws.receivables.unreconciledLineCount).toBe(66570)
    const dues = ws.summaryCards.find((c) => c.id === 'delivery-dues')!
    expect(dues.valueAr).toBe('قيد المطابقة مع المحاسبة')
    expect(dues.valueEn).toBe('Pending Accounting Reconciliation')
    expect(JSON.stringify(ws)).not.toContain('77,462.759')
  })

  it('/erp/receivables (ReceivablesAgingStudio)', async () => {
    const { ReceivablesAgingStudio } = await import('@/components/erp/ReceivablesAgingStudio')
    const html = renderAr(React.createElement(ReceivablesAgingStudio))
    expectNoLeak(html)
    expect(html).toContain('66,570')
  })

  it('/erp/finance and /accounting (VentureAccountingHub, receivables + GL tabs)', async () => {
    const { VentureAccountingHub } = await import('@/components/accounting/VentureAccountingHub')
    const recv = renderAr(React.createElement(VentureAccountingHub, { initialTab: 'receivables', embeddedInErp: true }))
    expectNoLeak(recv)
    expect(recv).toContain('data-receivables-pending="true"')
    const gl = renderAr(React.createElement(VentureAccountingHub, { initialTab: 'glSummary' }))
    for (const v of PROD_VALUES) expect(gl).not.toContain(v)
  })
})
