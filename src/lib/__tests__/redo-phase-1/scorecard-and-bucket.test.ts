/**
 * Redo Phase 1 — Items 1.1 & 1.2:
 *   - 1.1 Unified `resolveSummaryBucket`, sparse `dailyByBranch` boundary coverage,
 *         unclamped negative refund slices, and URL/storage branch filter preservation
 *         for `exhibitions` & `school-canteens`.
 *   - 1.2 `SalesScorecardStudio` initial/in-flight loading skeleton (`loadingSummary`),
 *         calm unavailable early return (zero `0.000` underneath), out-of-coverage custom
 *         range unavailability (`غير متاح` / `—`), and Custom 1–17 Nov parity with Home
 *         (`FullJourney360`) in AR & EN (`Σrows = headline ±0.001`, zero `0.000`).
 *
 * HARD RULE: Zero hand-typed KWD values. Every figure is derived mathematically from
 * `loadLiveTodaySummary()` (`dashboard-today-2026-11-17.json`) and `pos-registry.json`.
 */
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as GlobalFilterCtxModule from '@/components/aether/GlobalFilterContext'
import { SalesScorecardStudio } from '@/components/erp/SalesScorecardStudio'
import {
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  deriveCustomBucketFromDaily,
  resolveSummaryBucket,
  type GlobalBranch,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { LanguageProvider } from '@/lib/i18n'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import posRegistry from '@/lib/odoo/pos-registry.json'
import { buildLiveEnterpriseDepartments } from '@/lib/reports/enterprise-reports-registry'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'
import { dashboardContext, textOfAttr } from '../support/render-dashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp/sales-scorecard',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/aether/GlobalFilterContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/aether/GlobalFilterContext')>()
  return {
    ...actual,
    useGlobalFilter: () => (dashboardContext.value ?? actual.useGlobalFilter()),
  }
})

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')
const CUSTOM_NOV_1_17: GlobalFilters = {
  ...DEFAULT_GLOBAL_FILTERS,
  period: 'custom',
  customFrom: '2026-11-01',
  customTo: '2026-11-17',
}

const LangProvider = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

const toFils = (kwd: number): number => Math.round(kwd * 1000)

function sumRangeFils(summary: OdooLiveSummary, fromIso: string, toInclusiveIso: string): number {
  let total = 0
  for (const [day, byLoc] of Object.entries(summary.dailyByBranch ?? {})) {
    if (day < fromIso || day > toInclusiveIso) continue
    for (const cell of Object.values(byLoc)) {
      total += toFils(cell.netKwd)
    }
  }
  for (const [day, u] of Object.entries(summary.dailyUnattributed ?? {})) {
    if (day < fromIso || day > toInclusiveIso) continue
    total += toFils(u.netKwd)
  }
  return total
}

function sumRangeOrders(summary: OdooLiveSummary, fromIso: string, toInclusiveIso: string): number {
  let total = 0
  for (const [day, byLoc] of Object.entries(summary.dailyByBranch ?? {})) {
    if (day < fromIso || day > toInclusiveIso) continue
    for (const cell of Object.values(byLoc)) {
      total += Math.round(cell.orders)
    }
  }
  for (const [day, u] of Object.entries(summary.dailyUnattributed ?? {})) {
    if (day < fromIso || day > toInclusiveIso) continue
    total += Math.round(u.orders)
  }
  return total
}

/**
 * Algebraically reclassifies the real `dailyUnattributed` entries from `loadLiveTodaySummary()`
 * into `pos-registry.json` locations (`exhibitions` on Fri/Sat, `school-canteens` on Sun–Thu)
 * with ZERO invented or hand-typed KWD figures — conserving total fils and total orders 100%.
 */
function buildBoothAndCanteenSummaryFromLive(): OdooLiveSummary {
  const clone = structuredClone(loadLiveTodaySummary())
  const boothKey = 'exhibitions'
  const canteenKey = 'school-canteens'
  expect(posRegistry.locations).toHaveProperty(boothKey)
  expect(posRegistry.locations).toHaveProperty(canteenKey)

  const allDays = new Set([
    ...Object.keys(clone.dailyByBranch ?? {}),
    ...Object.keys(clone.dailyUnattributed ?? {}),
  ])
  clone.dailyByBranch ??= {}
  clone.dailyUnattributed ??= {}

  for (const day of [...allDays].sort()) {
    const u = clone.dailyUnattributed[day] ?? { netKwd: 0, orders: 0 }
    const dow = new Date(`${day}T12:00:00Z`).getUTCDay()
    const isWeekendBoothDay = dow === 5 || dow === 6
    const dayEntry = (clone.dailyByBranch[day] ??= {})
    dayEntry[boothKey] = isWeekendBoothDay ? { netKwd: u.netKwd, orders: u.orders } : { netKwd: 0, orders: 0 }
    dayEntry[canteenKey] = isWeekendBoothDay ? { netKwd: 0, orders: 0 } : { netKwd: u.netKwd, orders: u.orders }
    clone.dailyUnattributed[day] = { netKwd: 0, orders: 0 }
  }
  return clone
}

function setMockContext(
  summary: OdooLiveSummary | null,
  filters: GlobalFilters,
  extra?: { syncingOdoo?: boolean; loadingSummary?: boolean },
) {
  dashboardContext.value = {
    filters: { ...DEFAULT_GLOBAL_FILTERS, ...filters },
    workspace: computeGlobalWorkspace(filters, summary, '/erp/sales-scorecard'),
    liveSummary: summary,
    isAuditor: false,
    sessionRole: 'admin',
    syncingOdoo: extra?.syncingOdoo ?? false,
    ...(extra?.loadingSummary !== undefined ? { loadingSummary: extra.loadingSummary } : {}),
    syncCooldownSec: 0,
    triggerOdooSyncNow: async () => {},
    setPeriod: () => {},
    setCustomRange: () => {},
    setKuwaitSlice: () => {},
    setBrand: () => {},
    setBranch: () => {},
    setChannel: () => {},
    setLens: () => {},
    resetFilters: () => {},
    buildShareDeepLinkText: () => '',
  }
}

function renderScorecard(locale: 'ar' | 'en'): string {
  return renderToStaticMarkup(
    React.createElement(LangProvider, { initialLocale: locale }, React.createElement(SalesScorecardStudio)),
  )
}

async function renderHome(summary: OdooLiveSummary, filters: GlobalFilters, locale: 'ar' | 'en'): Promise<string> {
  dashboardContext.value = {
    filters: { ...DEFAULT_GLOBAL_FILTERS, ...filters },
    workspace: computeGlobalWorkspace(filters, summary, '/erp'),
    liveSummary: summary,
    isAuditor: false,
    sessionRole: 'admin',
    syncingOdoo: false,
    loadingSummary: false,
  }
  const { FullJourney360 } = await import('@/components/aether/FullJourney360')
  return renderToStaticMarkup(
    React.createElement(LangProvider, { initialLocale: locale }, React.createElement(FullJourney360)),
  )
}

function parseHomeLedgerRows(html: string) {
  const rows: { id: string; salesFils: number; orders: number | null }[] = []
  for (const m of html.matchAll(/<tr[^>]*data-ledger-row="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...m[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) =>
      c[1].replace(/<[^>]+>/g, ' ').trim(),
    )
    const kwd = /(-?[\d,]+\.\d{3})/.exec(cells[1] ?? '')
    const ord = /^\s*([\d,]+)\s*$/.exec(cells[2] ?? '')
    rows.push({
      id: m[1],
      salesFils: kwd ? toFils(Number(kwd[1].replace(/,/g, ''))) : Number.NaN,
      orders: ord ? Number(ord[1].replace(/,/g, '')) : null,
    })
  }
  return rows
}

function parseScorecardBranchRows(html: string) {
  const rows: { id: string; salesFils: number; orders: number | null; rawText: string }[] = []
  const ids = [...html.matchAll(/data-scorecard-branch-row="([^"]+)"/g)].map((m) => m[1])
  for (const id of ids) {
    const salesText = textOfAttr(html, 'data-scorecard-branch-sales', id) ?? ''
    const ordersText = textOfAttr(html, 'data-scorecard-branch-orders', id) ?? ''
    const kwd = /(-?[\d,]+\.\d{3})/.exec(salesText)
    const ord = /^\s*([\d,]+)\s*$/.exec(ordersText)
    rows.push({
      id,
      salesFils: kwd ? toFils(Number(kwd[1].replace(/,/g, ''))) : Number.NaN,
      orders: ord ? Number(ord[1].replace(/,/g, '')) : null,
      rawText: `${salesText} ${ordersText}`.trim(),
    })
  }
  return rows
}

function parseHeadlineKwdFils(html: string): number {
  const text = textOfAttr(html, 'data-kpi', 'net-sales') ?? ''
  const m = /(-?[\d,]+\.\d{3})/.exec(text)
  return m ? toFils(Number(m[1].replace(/,/g, ''))) : Number.NaN
}

describe('Phase 1 · Items 1.1 & 1.2 — Unified bucket resolver, URL branch filter & Scorecard parity', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  describe('1.1 — Sparse dailyByBranch boundaries, unclamped negative refunds, unified callers & branch sanitization', () => {
    it('sums [fromIso..toInclusiveIso] when start and/or end day had 0 POS orders (absent keys in dailyByBranch) inside covered history', () => {
      const summary = structuredClone(loadLiveTodaySummary())
      delete summary.dailyByBranch?.['2026-11-01']
      delete summary.dailyUnattributed?.['2026-11-01']
      delete summary.dailyByBranch?.['2026-11-17']
      delete summary.dailyUnattributed?.['2026-11-17']

      const expectedFils = sumRangeFils(summary, '2026-11-01', '2026-11-17')
      const expectedOrders = sumRangeOrders(summary, '2026-11-01', '2026-11-17')

      const derived = deriveCustomBucketFromDaily(summary, '2026-11-01', '2026-11-17')
      expect(derived).toBeDefined()
      expect(toFils(derived!.totals.netSalesKwd as number)).toBe(expectedFils)
      expect(derived!.totals.orders).toBe(expectedOrders)

      const viaResolver = resolveSummaryBucket(CUSTOM_NOV_1_17, summary)
      expect(viaResolver).toBeDefined()
      expect(toFils(viaResolver!.totals.netSalesKwd as number)).toBe(expectedFils)

      // Genuinely predating days[0] or exceeding summary latest date still returns undefined
      expect(deriveCustomBucketFromDaily(summary, '2026-08-01', '2026-08-15')).toBeUndefined()
      vi.setSystemTime(new Date('2026-11-26T09:00:00Z'))
      expect(deriveCustomBucketFromDaily(summary, '2026-11-01', '2026-11-25')).toBeUndefined()
    })

    it('preserves net-negative refund slices in computeGlobalWorkspace without Math.max(0, ...) clamping', () => {
      const summary = structuredClone(loadLiveTodaySummary())
      const todayPromenade = summary.buckets!.today!.byLocation!.promenade!
      const positiveNet = todayPromenade.netKwd
      const positiveOrders = todayPromenade.orders
      expect(positiveNet).toBeGreaterThan(0)

      todayPromenade.netKwd = -positiveNet
      if (summary.buckets!.today!.mappedByLocation?.promenade) {
        summary.buckets!.today!.mappedByLocation.promenade.netKwd = -positiveNet
      }

      const ws = computeGlobalWorkspace(
        { ...DEFAULT_GLOBAL_FILTERS, period: 'today', branch: 'promenade' },
        summary,
      )
      expect(toFils(ws.salesKwd)).toBe(-toFils(positiveNet))
      expect(ws.nullableSalesKwd).not.toBeNull()
      expect(toFils(ws.nullableSalesKwd!)).toBe(-toFils(positiveNet))
      expect(ws.orders).toBe(positiveOrders)
      expect(ws.noData).toBe(false)
    })

    it('unifies enterprise-reports-registry custom bucket resolution via resolveSummaryBucket (never leaking month totals)', () => {
      const summary = loadLiveTodaySummary()
      expect(summary.customBucket).toBeUndefined()
      const ws = computeGlobalWorkspace(CUSTOM_NOV_1_17, summary)
      const depts = buildLiveEnterpriseDepartments(ws, summary, false)
      const allReportsJson = JSON.stringify(depts)

      const monthNetFormatted = summary.buckets!.month!.totals.netSalesKwd!.toLocaleString('en-US', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      })
      const customNetFormatted = (sumRangeFils(summary, '2026-11-01', '2026-11-17') / 1000).toLocaleString(
        'en-US',
        { minimumFractionDigits: 3, maximumFractionDigits: 3 },
      )
      expect(allReportsJson).toContain(customNetFormatted)
      expect(allReportsJson).not.toContain(monthNetFormatted)
    })

    it('preserves branch=exhibitions and branch=school-canteens in GlobalFilterContext sanitizeFilters', () => {
      const sanitize = (
        GlobalFilterCtxModule as unknown as {
          sanitizeFilters?: (raw: Partial<GlobalFilters> | null | undefined, pathname?: string | null) => Required<GlobalFilters>
        }
      ).sanitizeFilters
      expect(typeof sanitize).toBe('function')

      for (const specialBranch of ['exhibitions', 'school-canteens'] as const satisfies readonly GlobalBranch[]) {
        expect(sanitize!({ branch: specialBranch }, '/erp').branch).toBe(specialBranch)
        expect(sanitize!({ branch: specialBranch }, '/erp/sales-scorecard').branch).toBe(specialBranch)
      }
      expect(sanitize!({ branch: 'jahra' as GlobalBranch }, '/erp').branch).toBe('all')
    })

    it('replaces all direct liveSummary.customBucket reads in DeliveryRadarV5, feryal-governance-studio, enterprise-reports-registry & BrandSalesAnalyticsDashboard with resolveSummaryBucket', () => {
      const repoRoot = path.resolve(import.meta.dirname, '../../../..')
      const files = [
        'src/components/aether/DeliveryRadarV5.tsx',
        'src/components/erp/feryal-governance-studio.tsx',
        'src/lib/reports/enterprise-reports-registry.ts',
        'src/modules/brand-sales-analytics/ui/BrandSalesAnalyticsDashboard.tsx',
      ]
      for (const rel of files) {
        const src = fs.readFileSync(path.join(repoRoot, rel), 'utf8')
        expect(src, `${rel} must import/call resolveSummaryBucket`).toContain('resolveSummaryBucket')
        expect(src, `${rel} must not read liveSummary.customBucket directly`).not.toMatch(
          /liveSummary\??\.customBucket/,
        )
      }
    })
  })

  describe('1.2 — Scorecard loading skeleton, calm unavailable early return & Custom 1–17 Nov parity with Home', () => {
    it('renders loading skeleton when loadingSummary=true and liveSummary=null (never Odoo unavailable + 0.000)', () => {
      setMockContext(null, CUSTOM_NOV_1_17, { syncingOdoo: false, loadingSummary: true })
      const arHtml = renderScorecard('ar')
      const enHtml = renderScorecard('en')

      expect(arHtml).toContain('data-state-block="loading"')
      expect(arHtml).not.toContain('الاتصال المباشر مع Odoo غير متاح حالياً')
      expect(arHtml).not.toContain('0.000')

      expect(enHtml).toContain('data-state-block="loading"')
      expect(enHtml).not.toContain('0.000')

      // Real GlobalFilterProvider initial mount (before first pullSilentStatus settles):
      dashboardContext.value = null
      const realProviderAr = renderToStaticMarkup(
        React.createElement(
          LangProvider,
          { initialLocale: 'ar' },
          React.createElement(GlobalFilterCtxModule.GlobalFilterProvider, null, React.createElement(SalesScorecardStudio)),
        ),
      )
      expect(realProviderAr).toContain('data-state-block="loading"')
      expect(realProviderAr).not.toContain('الاتصال المباشر مع Odoo غير متاح حالياً')
      expect(realProviderAr).not.toContain('0.000')
    })

    it('renders calm unavailable StateBlock and returns early when !liveSummary or !odooConnected (zero 0.000 cards/rows underneath)', () => {
      setMockContext(null, CUSTOM_NOV_1_17, { syncingOdoo: false, loadingSummary: false })
      const nullAr = renderScorecard('ar')
      const nullEn = renderScorecard('en')

      expect(nullAr).toContain('غير متاح')
      expect(nullAr).not.toContain('0.000')
      expect(nullAr).not.toContain('ترتيب الـ 6 علامات تجارية')

      expect(nullEn).toContain('Not available')
      expect(nullEn).not.toContain('0.000')
      expect(nullEn).not.toContain('6 Brands Scorecard')
    })

    it('marks totals, brands, branches and channels unavailable (غير متاح / —, never 0.000) when custom range has no active bucket', () => {
      const summary = loadLiveTodaySummary()
      const outOfCoverageCustom: GlobalFilters = {
        ...DEFAULT_GLOBAL_FILTERS,
        period: 'custom',
        customFrom: '2025-01-01',
        customTo: '2025-01-15',
      }
      const ws = computeGlobalWorkspace(outOfCoverageCustom, summary, '/erp/sales-scorecard')
      expect(ws.sectionUnavailable).toBe(true)
      expect(ws.nullableSalesKwd).toBeNull()
      expect(ws.nullableOrders).toBeNull()
      expect(ws.nullableAovKwd).toBeNull()
      for (const b of ws.cascadingOptions.brands.filter((x) => x.id !== 'all')) {
        expect(b.salesKwd).toBeUndefined()
      }
      for (const ch of ws.cascadingOptions.channels.filter((x) => x.id !== 'all')) {
        expect(ch.salesKwd).toBeUndefined()
      }

      setMockContext(summary, outOfCoverageCustom, { syncingOdoo: false, loadingSummary: false })
      const arHtml = renderScorecard('ar')
      const enHtml = renderScorecard('en')

      expect(arHtml).toContain('غير متاح')
      expect(arHtml).not.toContain('0.000')
      expect(enHtml).toContain('—')
      expect(enHtml).not.toContain('0.000')
    })

    it.each(['ar', 'en'] as const)(
      '%s: Custom 2026-11-01..2026-11-17 on loadLiveTodaySummary() matches Home headline & branch rows, Σrows = headline ±0.001, no — where orders > 0, and zero 0.000',
      async (locale) => {
        const summary = loadLiveTodaySummary()
        const expectedHeadlineFils = sumRangeFils(summary, '2026-11-01', '2026-11-17')

        const homeHtml = await renderHome(summary, CUSTOM_NOV_1_17, locale)
        const homeHeadlineFils = parseHeadlineKwdFils(homeHtml)
        const homeNonZeroRows = parseHomeLedgerRows(homeHtml)
          .filter((r) => r.salesFils !== 0)
          .sort((a, b) => a.id.localeCompare(b.id))

        setMockContext(summary, CUSTOM_NOV_1_17, { syncingOdoo: false, loadingSummary: false })
        const scorecardHtml = renderScorecard(locale)
        const scorecardHeadlineFils = parseHeadlineKwdFils(scorecardHtml)
        const scorecardRows = parseScorecardBranchRows(scorecardHtml).sort((a, b) =>
          a.id.localeCompare(b.id),
        )

        expect(scorecardHeadlineFils).toBe(expectedHeadlineFils)
        expect(scorecardHeadlineFils).toBe(homeHeadlineFils)
        expect(scorecardHtml).not.toContain('0.000')

        const rowSumFils = scorecardRows.reduce((s, r) => s + r.salesFils, 0)
        expect(Math.abs(rowSumFils - scorecardHeadlineFils)).toBeLessThanOrEqual(1)

        expect(scorecardRows.map((r) => ({ id: r.id, salesFils: r.salesFils, orders: r.orders }))).toEqual(
          homeNonZeroRows,
        )
        for (const r of scorecardRows) {
          if ((r.orders ?? 0) > 0) {
            expect(r.orders).not.toBeNull()
            expect(r.rawText).not.toContain('—')
          }
        }
      },
    )

    it('AR and EN Scorecard branch rows & totals match Home identically on booth+canteen real-day payload (incl. بوثات المعارض & مقاصف المدارس, zero 0.000)', async () => {
      const boothSummary = buildBoothAndCanteenSummaryFromLive()
      const expectedHeadlineFils = sumRangeFils(boothSummary, '2026-11-01', '2026-11-17')

      const homeAr = await renderHome(boothSummary, CUSTOM_NOV_1_17, 'ar')
      const homeEn = await renderHome(boothSummary, CUSTOM_NOV_1_17, 'en')

      setMockContext(boothSummary, CUSTOM_NOV_1_17, { syncingOdoo: false, loadingSummary: false })
      const scorecardAr = renderScorecard('ar')
      const scorecardEn = renderScorecard('en')

      expect(scorecardAr).toContain('بوثات المعارض')
      expect(scorecardEn).toContain('Exhibition Booths')
      expect(scorecardAr).toContain('مقاصف المدارس')
      expect(scorecardEn).toContain('School canteens')

      expect(scorecardAr).not.toContain('0.000')
      expect(scorecardEn).not.toContain('0.000')

      const scRowsAr = parseScorecardBranchRows(scorecardAr).sort((a, b) => a.id.localeCompare(b.id))
      const scRowsEn = parseScorecardBranchRows(scorecardEn).sort((a, b) => a.id.localeCompare(b.id))
      const homeRowsAr = parseHomeLedgerRows(homeAr)
        .filter((r) => r.salesFils !== 0)
        .sort((a, b) => a.id.localeCompare(b.id))

      expect(scRowsAr.map(({ id, salesFils, orders }) => ({ id, salesFils, orders }))).toEqual(
        scRowsEn.map(({ id, salesFils, orders }) => ({ id, salesFils, orders })),
      )
      expect(scRowsAr.map(({ id, salesFils, orders }) => ({ id, salesFils, orders }))).toEqual(homeRowsAr)
      expect(scRowsAr.some((r) => r.id === 'exhibitions')).toBe(true)
      expect(scRowsAr.some((r) => r.id === 'school-canteens')).toBe(true)

      const sumFils = scRowsAr.reduce((s, r) => s + r.salesFils, 0)
      expect(Math.abs(sumFils - expectedHeadlineFils)).toBeLessThanOrEqual(1)
    })
  })
})
