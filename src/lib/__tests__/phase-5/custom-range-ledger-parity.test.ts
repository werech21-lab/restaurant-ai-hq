/**
 * Regression: /erp Custom range (1–17 Nov 2026) — the branch ledger must use the same payload as the
 * headline, in Arabic and English. Real 2026-11-17 payload only (it carries per-day, per-branch rows
 * for 14 Sep – 17 Nov but no customBucket for 1–17 Nov, i.e. the state that broke the ledger).
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GLOBAL_FILTERS,
  computeGlobalWorkspace,
  resolveSummaryBucket,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { LanguageProvider } from '@/lib/i18n'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'
import { dashboardContext } from '../support/render-dashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => dashboardContext.value,
}))

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')
const CUSTOM: GlobalFilters = { ...DEFAULT_GLOBAL_FILTERS, period: 'custom', customFrom: '2026-11-01', customTo: '2026-11-17' }
const LangProvider = LanguageProvider as unknown as React.ComponentType<{ initialLocale: 'ar' | 'en'; children?: React.ReactNode }>
const fils = (n: number) => Math.round(n * 1000)

function realDailySumFils(summary: ReturnType<typeof loadLiveTodaySummary>) {
  let total = 0
  for (const [day, row] of Object.entries(summary.dailyByBranch ?? {})) {
    if (day < CUSTOM.customFrom! || day > CUSTOM.customTo!) continue
    for (const cell of Object.values(row)) total += fils(cell.netKwd)
    total += fils(summary.dailyUnattributed?.[day]?.netKwd ?? 0)
  }
  return total
}

async function renderHome(locale: 'ar' | 'en') {
  const summary = loadLiveTodaySummary()
  dashboardContext.value = {
    filters: CUSTOM,
    workspace: computeGlobalWorkspace(CUSTOM, summary),
    liveSummary: summary,
    isAuditor: false,
    sessionRole: 'admin',
    syncingOdoo: false,
  }
  const { FullJourney360 } = await import('@/components/aether/FullJourney360')
  return renderToStaticMarkup(React.createElement(LangProvider, { initialLocale: locale }, React.createElement(FullJourney360)))
}

/** Ledger rows: id, sales (KWD, 3 decimals) and orders (integer or null when "—"). */
function ledgerRows(html: string) {
  const rows: { id: string; salesFils: number; orders: number | null }[] = []
  for (const m of html.matchAll(/<tr[^>]*data-ledger-row="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...m[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1].replace(/<[^>]+>/g, ' ').trim())
    const kwd = /([\d,]+\.\d{3})/.exec(cells[1] ?? '')
    const ord = /^\s*([\d,]+)\s*$/.exec(cells[2] ?? '')
    rows.push({ id: m[1], salesFils: kwd ? fils(Number(kwd[1].replace(/,/g, ''))) : NaN, orders: ord ? Number(ord[1].replace(/,/g, '')) : null })
  }
  return rows
}

describe('/erp Custom 1–17 Nov 2026 — ledger uses the same payload as the headline', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('the payload has no customBucket for the range, so the bucket is derived from its real daily rows', () => {
    const summary = loadLiveTodaySummary()
    expect(summary.customBucket).toBeUndefined()
    const bucket = resolveSummaryBucket(CUSTOM, summary)!
    expect(bucket.from).toBe('2026-11-01')
    expect(fils(bucket.totals.netSalesKwd as number)).toBe(realDailySumFils(summary))
    const ws = computeGlobalWorkspace(CUSTOM, summary)
    expect(fils(ws.salesKwd)).toBe(realDailySumFils(summary))
  })

  it.each(['ar', 'en'] as const)('%s: ledger rows sum exactly to the headline and every branch shows its order count', async (locale) => {
    const summary = loadLiveTodaySummary()
    const html = await renderHome(locale)
    const rows = ledgerRows(html)
    expect(rows.length).toBeGreaterThan(0)
    const headlineFils = realDailySumFils(summary)
    expect(rows.reduce((s, r) => s + r.salesFils, 0)).toBe(headlineFils)
    for (const r of rows) expect(r.orders, `orders for ${r.id}`).not.toBeNull()
    // Every group the payload reports for these days has its own row.
    const reported = new Set(Object.values(summary.dailyByBranch ?? {}).flatMap((d) => Object.keys(d)))
    for (const id of reported) expect(rows.some((r) => r.id === id), `row ${id}`).toBe(true)
    // The booths row appears exactly when the payload reports booths (this payload predates them).
    expect(rows.some((r) => r.id === 'exhibitions')).toBe(reported.has('exhibitions'))
  })

  it('Arabic and English ledgers are identical (same rows, same sales, same orders)', async () => {
    const ar = ledgerRows(await renderHome('ar')).sort((a, b) => a.id.localeCompare(b.id))
    const en = ledgerRows(await renderHome('en')).sort((a, b) => a.id.localeCompare(b.id))
    expect(ar).toEqual(en)
  })
})
