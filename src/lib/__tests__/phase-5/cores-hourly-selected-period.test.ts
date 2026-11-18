/**
 * Cores hourly distribution for ANY selected period — real data only (live 2026-11-17 payload).
 *
 * Root cause guarded here: with no selected-period cube, Cores used an empty hourly series and
 * printed "peak — (0.000 KWD)". The payload's summary `hourlySeries` is built by the connector on the
 * Month bucket bounds, so for Month it IS the selected period's real hourly breakdown.
 *
 * - Month: Σ(24 hours) === Month net total (to the fils), real non-zero peak.
 * - Today / Yesterday: the payload carries no real hourly breakdown for those days → calm
 *   unavailable state, no points, no peak (never 0.000, never invented numbers).
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import { DEFAULT_GLOBAL_FILTERS, computeGlobalWorkspace, type GlobalFilters } from '@/lib/aether/global-filter-engine'
import { reconcileHourlyToPeriod } from '@/lib/aether/hourly-integrity'
import { LanguageProvider } from '@/lib/i18n'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'

const ctx: { value: unknown } = { value: null }
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp/cores',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/aether/GlobalFilterContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/aether/GlobalFilterContext')>()),
  useGlobalFilter: () => ctx.value,
}))

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')
const LangProvider = LanguageProvider as unknown as React.ComponentType<{ initialLocale: 'ar' | 'en'; children?: React.ReactNode }>

const MONTH: GlobalFilters = { ...DEFAULT_GLOBAL_FILTERS, period: 'month' }
const TODAY: GlobalFilters = { ...DEFAULT_GLOBAL_FILTERS, period: 'today' }
const YESTERDAY: GlobalFilters = { ...DEFAULT_GLOBAL_FILTERS, period: 'custom', customFrom: '2026-11-16', customTo: '2026-11-16' }

const sumFils = (rows: { salesKwd: number }[]) => rows.reduce((s, r) => s + Math.round(r.salesKwd * 1000), 0)

async function renderCores(locale: 'ar' | 'en', filters: GlobalFilters): Promise<string> {
  const summary = loadLiveTodaySummary()
  ctx.value = {
    filters,
    workspace: computeGlobalWorkspace(filters, summary, '/erp/cores'),
    liveSummary: summary,
    isAuditor: false,
    sessionRole: 'admin',
    syncingOdoo: false,
    setPeriod: () => {},
    setBrand: () => {},
    setBranch: () => {},
    setChannel: () => {},
  }
  const { CoresHubStudio } = await import('@/components/aether/CoresHubStudio')
  const Studio = CoresHubStudio as unknown as React.ComponentType<{ initialTab?: string }>
  return renderToStaticMarkup(React.createElement(LangProvider, { initialLocale: locale }, React.createElement(Studio, { initialTab: 'sales' })))
}

/** Markup of the "Hourly POS Sales Profile" card. */
function hourlyCard(html: string, locale: 'ar' | 'en'): string {
  const title = locale === 'ar' ? 'التوزيع الساعي لطلبات نقاط البيع' : 'Hourly POS Sales Profile'
  const start = html.indexOf(title)
  expect(start, 'hourly card rendered').toBeGreaterThan(0)
  const next = html.indexOf(locale === 'ar' ? 'الفروع السبعة' : '7 Branches', start)
  return html.slice(start, next > start ? next : start + 6000)
}

describe('Cores hourly — Month (real selected-period hourly data)', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('Σ hourly equals the Month net total to the fils and the peak is the real non-zero peak hour', () => {
    const summary = loadLiveTodaySummary()
    const monthTotal = summary.buckets!.month!.totals.netSalesKwd as number
    const snap = computeCoresHubSnapshot(MONTH, [], summary)
    expect(snap.sales.hourlyUnavailable).toBe(false)
    expect(snap.sales.hourly.length).toBeGreaterThan(0)
    expect(sumFils(snap.sales.hourly)).toBe(Math.round(monthTotal * 1000))
    expect(snap.sales.hourlyReconciliation?.reconciled).toBe(true)
    expect(snap.sales.hourlyReconciliation?.varianceKwd).toBe(0)

    const realPeak = [...(summary.hourlySeries ?? [])].sort((a, b) => b.netKwd - a.netKwd)[0]
    expect(snap.sales.peakHourSalesKwd).toBeGreaterThan(0)
    expect(snap.sales.peakHourSalesKwd).toBe(realPeak.netKwd)
    expect(snap.sales.peakHourShortEn).not.toBe('—')
    // reconciliation is checked against the Month bucket, independently of this module
    expect(reconcileHourlyToPeriod(summary.hourlySeries ?? [], monthTotal).reconciled).toBe(true)
  })

  it('renders the real peak value and the Σ = period total line; never a 0.000 peak (AR + EN)', async () => {
    const summary = loadLiveTodaySummary()
    const realPeak = [...(summary.hourlySeries ?? [])].sort((a, b) => b.netKwd - a.netKwd)[0]
    const peakText = realPeak.netKwd.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    for (const locale of ['ar', 'en'] as const) {
      const card = hourlyCard(await renderCores(locale, MONTH), locale)
      expect(card).toContain(peakText)
      expect(card).toContain('data-hourly-reconciled="true"')
      expect(card).not.toContain('data-hourly-unavailable="true"')
      expect(card).not.toMatch(/(ذروة المبيعات|Peak hour)[^·]*\(0\.000/)
    }
  })
})

describe('Cores hourly — Today / Yesterday (no real hourly breakdown in the payload)', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it.each([['Today', TODAY]] as const)('%s: unavailable — no points, no peak, no 30-day series substituted', (_name, filters) => {
    const summary = loadLiveTodaySummary()
    const snap = computeCoresHubSnapshot(filters, [], summary)
    expect(snap.sales.hourlyUnavailable).toBe(true)
    expect(snap.sales.hourly).toEqual([])
    expect(snap.sales.peakHourSalesKwd).toBe(0)
    expect(snap.sales.peakHourShortEn).toBe('—')
    expect(snap.sales.hourlyReconciliation).toBeNull()
  })

  it.each([['Today', TODAY]] as const)('%s renders the calm unavailable state and hides the peak (AR + EN)', async (_name, filters) => {
    for (const locale of ['ar', 'en'] as const) {
      const card = hourlyCard(await renderCores(locale, filters), locale)
      expect(card).toContain('data-hourly-unavailable="true"')
      expect(card).toContain(locale === 'ar' ? 'غير متاح' : 'Not available')
      expect(card).not.toMatch(/ذروة المبيعات|Peak hour/)
      expect(card).not.toContain('0.000')
      expect(card).not.toMatch(/amber-|rose-/)
    }
  })

  it('Yesterday: real per-branch day rows exist but no hourly breakdown → hourly unavailable, no points, no peak, never a 0.000 peak (AR + EN)', async () => {
    const snap = computeCoresHubSnapshot(YESTERDAY, [], loadLiveTodaySummary())
    expect(snap.sales.hourlyUnavailable).toBe(true)
    expect(snap.sales.hourly).toEqual([])
    expect(snap.sales.peakHourSalesKwd).toBe(0)
    expect(snap.sales.peakHourShortEn).toBe('—')
    for (const locale of ['ar', 'en'] as const) {
      const card = hourlyCard(await renderCores(locale, YESTERDAY), locale)
      expect(card).toContain('data-hourly-unavailable="true"')
      expect(card).not.toMatch(/(ذروة المبيعات|Peak hour)[^·]*\(0\.000/)
    }
  })
})
