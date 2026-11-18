/**
 * Phase 1 · Item 1.6 (U7) + 1.1 Cores bucket resolver — Negative refund clamp removal.
 *
 * Owner rules enforced in this test:
 * - Zero hand-typed KWD literals anywhere in test code.
 * - Every input figure comes strictly from `loadLiveTodaySummary()` (`dashboard-today-2026-11-17.json`),
 *   deriving negative refund hours/days/unattributed balances purely by negating real non-zero
 *   entries from the payload and adjusting totals by the exact algebraic delta (`-2 * entry`).
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import {
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  resolveSummaryBucket,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { formatKwd, formatPct, type FormatLocale } from '@/lib/format'
import { LanguageProvider } from '@/lib/i18n'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import type { OdooPeriodHourly } from '@/lib/odoo-live-connector'
import { FIXTURE_DAY, loadLiveTodaySummary } from '../support/dashboard-fixture'

const mockFilterCtx: { value: unknown } = { value: null }

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push() {},
    replace() {},
    refresh() {},
    back() {},
    forward() {},
    prefetch() {},
  }),
  usePathname: () => '/erp',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/aether/GlobalFilterContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/aether/GlobalFilterContext')>()),
  useGlobalFilter: () => mockFilterCtx.value,
}))

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')
const FILS_PER_KWD = 1000
const KWD_TOLERANCE = 1 / FILS_PER_KWD

const toFils = (kwd: number): number => Math.round(kwd * FILS_PER_KWD)
const fromFils = (fils: number): number => fils / FILS_PER_KWD

const TypedLangProvider = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: FormatLocale
  children?: React.ReactNode
}>

function setMockFilterContext(
  summary: OdooLiveSummary,
  filters: GlobalFilters,
  pathname = '/erp',
): void {
  mockFilterCtx.value = {
    filters,
    workspace: computeGlobalWorkspace(filters, summary, pathname),
    liveSummary: summary,
    isAuditor: false,
    sessionRole: 'admin',
    syncingOdoo: false,
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

function assertValidSvgGeometry(html: string, contextLabel: string): void {
  expect(html, `${contextLabel}: must not emit NaN anywhere in markup`).not.toMatch(/\bNaN\b/)
  expect(html, `${contextLabel}: must not emit Infinity in markup`).not.toMatch(/\bInfinity\b/)

  for (const tagMatch of html.matchAll(/<(?:rect|path)\b([^>]*)>/gi)) {
    const attrs = tagMatch[1] ?? ''
    const hMatch = /\bheight="([^"]+)"/i.exec(attrs)
    if (hMatch && !hMatch[1].endsWith('%')) {
      const h = Number(hMatch[1])
      expect(Number.isFinite(h), `${contextLabel}: height="${hMatch[1]}" finite`).toBe(true)
      expect(h, `${contextLabel}: height="${hMatch[1]}" >= 0`).toBeGreaterThanOrEqual(0)
    }
    const wMatch = /\bwidth="([^"]+)"/i.exec(attrs)
    if (wMatch && !wMatch[1].endsWith('%')) {
      const w = Number(wMatch[1])
      expect(Number.isFinite(w), `${contextLabel}: width="${wMatch[1]}" finite`).toBe(true)
      expect(w, `${contextLabel}: width="${wMatch[1]}" >= 0`).toBeGreaterThanOrEqual(0)
    }
    const yMatch = /\by="([^"]+)"/i.exec(attrs)
    if (yMatch && !yMatch[1].endsWith('%')) {
      expect(Number.isFinite(Number(yMatch[1])), `${contextLabel}: y="${yMatch[1]}" finite`).toBe(
        true,
      )
    }
  }

  for (const pathMatch of html.matchAll(/<path\b[^>]*\bd="([^"]*)"/gi)) {
    const d = pathMatch[1] ?? ''
    expect(d, `${contextLabel}: <path d="..."> must not contain NaN`).not.toContain('NaN')
    expect(d, `${contextLabel}: <path d="..."> must not contain undefined`).not.toContain(
      'undefined',
    )
  }
}

/**
 * Clones the real 2026-11-17 payload and algebraically negates one real positive hour in
 * `hourlySeries`, adjusting the Month bucket total by `-2 * hour.netKwd` in integer fils.
 */
function buildMonthPayloadWithNegatedHour() {
  const summary = loadLiveTodaySummary()
  const hours = summary.hourlySeries ?? []
  const positiveHours = [...hours]
    .filter((h) => toFils(h.netKwd) > 0)
    .sort((a, b) => a.netKwd - b.netKwd)
  expect(positiveHours.length).toBeGreaterThan(0)

  const targetOriginal = { ...positiveHours[0] }
  const deltaFils = -2 * toFils(targetOriginal.netKwd)

  summary.hourlySeries = hours.map((h) =>
    h.hour === targetOriginal.hour ? { ...h, netKwd: -targetOriginal.netKwd } : { ...h },
  )

  const month = summary.buckets!.month!
  const origMonthFils = toFils(month.totals.netSalesKwd as number)
  const adjustedMonthKwd = fromFils(origMonthFils + deltaFils)
  month.totals.netSalesKwd = adjustedMonthKwd
  month.totals.restaurantNetKwd = adjustedMonthKwd
  if (month.totals.orders && month.totals.orders > 0) {
    month.totals.aovKwd = fromFils(
      Math.round((adjustedMonthKwd / month.totals.orders) * FILS_PER_KWD),
    )
  }
  summary.totals.netSalesKwd = adjustedMonthKwd

  return {
    summary,
    refundHour: targetOriginal.hour,
    expectedRefundNetKwd: -targetOriginal.netKwd,
    expectedRefundOrders: targetOriginal.orders,
    adjustedMonthKwd,
  }
}

function extractBalancedElement(html: string, matchIndex: number): string | null {
  const open = html.lastIndexOf('<', matchIndex)
  if (open < 0) return null
  const openEnd = html.indexOf('>', open)
  if (openEnd < 0) return null
  const tag = /^<([a-z0-9]+)/i.exec(html.slice(open, openEnd + 1))?.[1]
  if (!tag) return null
  let depth = 0
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi')
  re.lastIndex = open
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1
    if (depth === 0) {
      return html.slice(open, m.index + m[0].length)
    }
  }
  return null
}

function parseSignedBranchCards(html: string, locale: FormatLocale) {
  const unitRe =
    locale === 'ar' ? /(-?[\d,]+\.\d{3})\s*د\.ك/ : /(-?[\d,]+\.\d{3})\s*KWD/
  const cards: Array<{ id: string; salesKwd: number; outerHtml: string }> = []
  for (const m of html.matchAll(/data-branch-card="([^"]+)"/g)) {
    const outer = extractBalancedElement(html, m.index ?? 0)
    if (!outer) continue
    const text = outer.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const kwdMatch = unitRe.exec(text)
    expect(kwdMatch, `branch card ${m[1]} signed KWD in "${text}"`).not.toBeNull()
    cards.push({
      id: m[1],
      salesKwd: Number(kwdMatch![1].replace(/,/g, '')),
      outerHtml: outer,
    })
  }
  return cards
}

describe('Phase 1 · 1.6 (U7) + 1.1 — Negative refund hours & signed KWD unclamped', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] })
  })

  afterEach(() => {
    vi.doUnmock('recharts')
    vi.useRealTimers()
  })

  it('1. computeCoresHubSnapshot & CoresHubStudio keep a real negated refund hour negative and Σ(hourly) === periodTotal within ±0.001 (AR + EN)', async () => {
    const {
      summary,
      refundHour,
      expectedRefundNetKwd,
      expectedRefundOrders,
      adjustedMonthKwd,
    } = buildMonthPayloadWithNegatedHour()

    const monthFilters: GlobalFilters = { ...DEFAULT_GLOBAL_FILTERS, period: 'month' }
    const snap = computeCoresHubSnapshot(monthFilters, [], summary)

    expect(snap.sales.hourlyUnavailable).toBe(false)
    expect(snap.sales.hourlyReconciliation?.reconciled).toBe(true)
    expect(snap.sales.hourlyReconciliation?.varianceKwd).toBe(0)

    const refundPoint = snap.sales.hourly.find((pt) => pt.id === `hr-${refundHour}`)
    expect(refundPoint).toBeDefined()
    expect(refundPoint!.salesKwd).toBeLessThan(0)
    expect(refundPoint!.salesKwd).toBe(expectedRefundNetKwd)
    expect(refundPoint!.orders).toBe(expectedRefundOrders)
    expect(refundPoint!.orders).toBeGreaterThanOrEqual(0)
    if (expectedRefundOrders > 0) {
      expect(refundPoint!.aovKwd).toBeLessThan(0)
    }

    const hourlySumKwd = snap.sales.hourly.reduce((sum, pt) => sum + pt.salesKwd, 0)
    expect(Math.abs(hourlySumKwd - adjustedMonthKwd)).toBeLessThanOrEqual(KWD_TOLERANCE)
    expect(snap.sales.hourly.reduce((sum, pt) => sum + toFils(pt.salesKwd), 0)).toBe(
      toFils(adjustedMonthKwd),
    )

    const { CoresHubStudio } = await import('@/components/aether/CoresHubStudio')
    const Studio = CoresHubStudio as unknown as React.ComponentType<{ initialTab?: 'sales' }>
    for (const locale of ['ar', 'en'] as const) {
      setMockFilterContext(summary, monthFilters, '/erp/cores')
      const html = renderToStaticMarkup(
        React.createElement(
          TypedLangProvider,
          { initialLocale: locale },
          React.createElement(Studio, { initialTab: 'sales' }),
        ),
      )

      assertValidSvgGeometry(html, `CoresHubStudio(${locale})`)
      expect(html).toContain('data-hourly-reconciled="true"')
      expect(html).toContain(`data-min-value="${expectedRefundNetKwd}"`)
      expect(html).toContain(formatKwd(adjustedMonthKwd, { locale }))
      const expectedCompactNeg = String(Math.round(expectedRefundNetKwd))
      expect(html).toContain(expectedCompactNeg)
    }
  })

  it('2. cores-hub-engine resolves custom-range bucket via resolveSummaryBucket (1.1) and reconciles negative refund hour in periodHourly', () => {
    const summary = loadLiveTodaySummary()
    expect(summary.customBucket).toBeUndefined()

    const customFilters: GlobalFilters = {
      ...DEFAULT_GLOBAL_FILTERS,
      period: 'custom',
      customFrom: FIXTURE_DAY,
      customTo: FIXTURE_DAY,
    }

    const dayBranches = summary.dailyByBranch?.[FIXTURE_DAY] ?? {}
    const activeEntries = Object.entries(dayBranches)
      .filter(([, cell]) => cell && toFils(cell.netKwd ?? 0) > 0)
      .sort((a, b) => (a[1]?.netKwd ?? 0) - (b[1]?.netKwd ?? 0))
    expect(activeEntries.length).toBeGreaterThanOrEqual(2)

    const [negatedBranchId, negatedBranchCell] = activeEntries[0]
    const originalBranchNet = negatedBranchCell!.netKwd as number
    dayBranches[negatedBranchId] = {
      ...negatedBranchCell,
      netKwd: -originalBranchNet,
    }

    const resolvedBucket = resolveSummaryBucket(customFilters, summary)
    expect(resolvedBucket).toBeDefined()
    const expectedCustomTotal = resolvedBucket!.totals.netSalesKwd as number

    const hourlySeries = activeEntries.map(([branchId, cell], idx) => ({
      hour: 9 + idx,
      orders: cell?.orders ?? 0,
      netKwd: branchId === negatedBranchId ? -originalBranchNet : (cell?.netKwd ?? 0),
    }))
    const periodHourly: OdooPeriodHourly = {
      connected: true,
      available: true,
      dateRange: { from: FIXTURE_DAY, to: FIXTURE_DAY },
      hourlySeries,
    }

    const snap = computeCoresHubSnapshot(customFilters, [], summary, null, periodHourly)
    expect(snap.sales.hourlyUnavailable).toBe(false)
    expect(snap.sales.hourlyReconciliation?.reconciled).toBe(true)

    const refundHourPt = snap.sales.hourly.find((pt) => pt.id === 'hr-9')
    expect(refundHourPt).toBeDefined()
    expect(refundHourPt!.salesKwd).toBe(-originalBranchNet)
    expect(refundHourPt!.salesKwd).toBeLessThan(0)

    const sumHourly = snap.sales.hourly.reduce((s, pt) => s + pt.salesKwd, 0)
    expect(Math.abs(sumHourly - expectedCustomTotal)).toBeLessThanOrEqual(KWD_TOLERANCE)
  })

  it('3. FullJourney360 renders 1-day timeline with negative refund hour via comboHourlyFallback -> TimelineAreaChart without clamping or SVG NaN', async () => {
    const {
      summary,
      refundHour,
      expectedRefundNetKwd,
      adjustedMonthKwd,
    } = buildMonthPayloadWithNegatedHour()

    const monthFilters: GlobalFilters = { ...DEFAULT_GLOBAL_FILTERS, period: 'month' }
    const { FullJourney360 } = await import('@/components/aether/FullJourney360')

    for (const locale of ['ar', 'en'] as const) {
      setMockFilterContext(summary, monthFilters, '/erp')
      const html = renderToStaticMarkup(
        React.createElement(
          TypedLangProvider,
          { initialLocale: locale },
          React.createElement(FullJourney360),
        ),
      )

      assertValidSvgGeometry(html, `FullJourney360-month-hourly(${locale})`)
      expect(html).toContain(formatKwd(adjustedMonthKwd, { locale }))
      expect(html).toContain('data-chart-mode="hourly-area"')
      // Proves FullJourney360 comboHourlyFallback passed the negative refund hour into TimelineAreaChart unclamped
      expect(html).toContain(`data-min-value="${expectedRefundNetKwd}"`)
      expect(html).toContain('data-sparkline="true"')

      const snap = computeCoresHubSnapshot(monthFilters, [], summary)
      const negPt = snap.sales.hourly.find((h) => h.id === `hr-${refundHour}`)
      expect(negPt?.salesKwd).toBe(expectedRefundNetKwd)
      expect(
        Math.abs(snap.sales.hourly.reduce((s, h) => s + h.salesKwd, 0) - adjustedMonthKwd),
      ).toBeLessThanOrEqual(KWD_TOLERANCE)
    }
  })

  it('4. FullJourney360 preserves negative unattributedSalesKwd, negative daily comboData, and negative weeklyPills with Σ(branchCards) === headline', async () => {
    const summary = loadLiveTodaySummary()
    const allDays = Object.keys(summary.dailyByBranch ?? {}).sort()
    const sevenDays = allDays.slice(-7)
    expect(sevenDays).toHaveLength(7)

    // Negate the real dailyUnattributed entries across the 7-day window so unattributedSalesKwd < 0
    const nextDailyUnattributed = { ...(summary.dailyUnattributed ?? {}) }
    for (const day of sevenDays) {
      const existing = nextDailyUnattributed[day]
      if (existing && toFils(existing.netKwd ?? 0) !== 0) {
        nextDailyUnattributed[day] = {
          ...existing,
          netKwd: -Math.abs(existing.netKwd as number),
        }
      }
    }
    summary.dailyUnattributed = nextDailyUnattributed
    const negUnattributedKwd = fromFils(
      sevenDays.reduce((s, day) => s + toFils(summary.dailyUnattributed?.[day]?.netKwd ?? 0), 0),
    )
    expect(negUnattributedKwd).toBeLessThan(0)

    // Build real 7-day series strictly by summing real dailyByBranch + dailyUnattributed cells
    const realSevenDaySeries = sevenDays.map((day) => {
      const cells = Object.values(summary.dailyByBranch?.[day] ?? {})
      const uCell = summary.dailyUnattributed?.[day]
      const netFils =
        cells.reduce((s, c) => s + toFils(c?.netKwd ?? 0), 0) + toFils(uCell?.netKwd ?? 0)
      const orders =
        cells.reduce((s, c) => s + Math.round(c?.orders ?? 0), 0) + Math.round(uCell?.orders ?? 0)
      return { day, orders, netKwd: fromFils(netFils) }
    })

    // Negate the smallest positive day in the 7-day timeline series
    const smallestDay = [...realSevenDaySeries]
      .filter((d) => toFils(d.netKwd) > 0)
      .sort((a, b) => a.netKwd - b.netKwd)[0]!
    const negatedDayKwd = -smallestDay.netKwd
    summary.dailySeries = realSevenDaySeries.map((d) =>
      d.day === smallestDay.day ? { ...d, netKwd: negatedDayKwd } : d,
    )

    const customWeekFilters: GlobalFilters = {
      ...DEFAULT_GLOBAL_FILTERS,
      period: 'custom',
      customFrom: sevenDays[0],
      customTo: sevenDays[sevenDays.length - 1],
    }
    const derivedWeekBucket = resolveSummaryBucket(customWeekFilters, summary)
    expect(derivedWeekBucket).toBeDefined()
    const expectedHeadlineKwd = derivedWeekBucket!.totals.netSalesKwd as number

    const { FullJourney360 } = await import('@/components/aether/FullJourney360')

    for (const locale of ['ar', 'en'] as const) {
      setMockFilterContext(summary, customWeekFilters, '/erp')
      const html = renderToStaticMarkup(
        React.createElement(
          TypedLangProvider,
          { initialLocale: locale },
          React.createElement(FullJourney360),
        ),
      )

      assertValidSvgGeometry(html, `FullJourney360-custom-7d-signed(${locale})`)

      // 1) Branch cards include signed negative unattributed and sum to exact headline
      const cards = parseSignedBranchCards(html, locale)
      const unattribCard = cards.find((c) => c.id === 'unattributed')
      expect(unattribCard).toBeDefined()
      expect(unattribCard!.salesKwd).toBeLessThan(0)
      expect(Math.abs(unattribCard!.salesKwd - negUnattributedKwd)).toBeLessThanOrEqual(
        KWD_TOLERANCE,
      )

      const sumBranchCards = cards.reduce((s, c) => s + c.salesKwd, 0)
      expect(Math.abs(sumBranchCards - expectedHeadlineKwd)).toBeLessThanOrEqual(KWD_TOLERANCE)

      // 2) Operational ledger row also renders the exact signed negative KWD
      const ledgerIdx = html.indexOf('data-ledger-row="unattributed"')
      expect(ledgerIdx).toBeGreaterThan(0)
      const ledgerRowHtml = extractBalancedElement(html, ledgerIdx) ?? ''
      expect(ledgerRowHtml).toContain(formatKwd(negUnattributedKwd, { locale }))

      // 3) Weekly pulse pill aria-label preserves the negative day KWD (never clamped to 0.000)
      expect(html).toContain(formatKwd(negatedDayKwd, { locale }))

      // 4) Multi-day comboData renders SalesNetComposedChart with negative min-value intact
      expect(html).toContain('data-chart-kind="sales-net-combo"')
      expect(html).toContain(`data-min-value="${negatedDayKwd}"`)
    }
  })

  it('5. v35-chart-kit SalesNetComposedChart, ComparisonBarChart, TimelineAreaChart, and renderSignedBarShape handle negative values cleanly while V35DonutChart & StackedProgressBar keep proportional safety', async () => {
    const { summary, refundHour, expectedRefundNetKwd } = buildMonthPayloadWithNegatedHour()
    const snap = computeCoresHubSnapshot(
      { ...DEFAULT_GLOBAL_FILTERS, period: 'month' },
      [],
      summary,
    )
    const positiveRef = snap.sales.hourly.find((h) => h.salesKwd > 0)!

    const {
      ComparisonBarChart,
      renderSignedBarShape,
      SalesNetComposedChart,
      StackedProgressBar,
      TimelineAreaChart,
      V35DonutChart,
    } = await import('@/components/charts/v35-chart-kit')

    // (a) Direct SVG bar geometry check on renderSignedBarShape with negative height (Recharts downward bar)
    const negativeBarSvg = renderToStaticMarkup(
      React.createElement(
        'svg',
        null,
        renderSignedBarShape({
          x: 24,
          y: positiveRef.salesKwd,
          width: 18,
          height: expectedRefundNetKwd,
          fill: '#2563EB',
          radius: [6, 6, 0, 0],
        }),
      ),
    )
    assertValidSvgGeometry(negativeBarSvg, 'renderSignedBarShape-negative-bar')
    expect(negativeBarSvg).toContain('<path')
    expect(negativeBarSvg).toContain('class="recharts-rectangle"')
    expect(negativeBarSvg).not.toContain('height="-')

    // Degenerate zero-height or NaN bar shape renders an empty <g> without NaN or <path>
    const zeroBarSvg = renderToStaticMarkup(
      React.createElement(
        'svg',
        null,
        renderSignedBarShape({ x: 24, y: 100, width: 18, height: 0 }),
        renderSignedBarShape({ x: Number.NaN, y: 100, width: 18, height: expectedRefundNetKwd }),
      ),
    )
    assertValidSvgGeometry(zeroBarSvg, 'renderSignedBarShape-degenerate')
    expect(zeroBarSvg).not.toContain('<path')

    // (b) ComparisonBarChart with mixed positive + negative real hours
    const barData = snap.sales.hourly.map((pt) => ({
      id: pt.id,
      label: pt.labelEn,
      tooltipTitle: pt.tooltipTitleEn,
      value: pt.salesKwd,
    }))
    const barHtml = renderToStaticMarkup(
      React.createElement(ComparisonBarChart, {
        data: barData,
        isAr: false,
        primaryLabel: 'Hourly Net Sales',
      }),
    )
    assertValidSvgGeometry(barHtml, 'ComparisonBarChart-mixed')
    expect(barHtml).toContain(`data-min-value="${expectedRefundNetKwd}"`)
    expect(barHtml).toContain(String(Math.round(expectedRefundNetKwd)))

    // (c) ComparisonBarChart when ALL bars are negative (edge case: minY < 0, maxY === 0)
    const allNegativeBarHtml = renderToStaticMarkup(
      React.createElement(ComparisonBarChart, {
        data: [
          {
            id: `hr-${refundHour}`,
            label: `H${refundHour}`,
            value: expectedRefundNetKwd,
          },
          {
            id: `hr-${refundHour}-b`,
            label: `H${refundHour}B`,
            value: expectedRefundNetKwd,
            comparisonValue: expectedRefundNetKwd,
          },
        ],
        isAr: true,
        primaryLabel: 'الحالي',
        comparisonLabel: 'السابق',
      }),
    )
    assertValidSvgGeometry(allNegativeBarHtml, 'ComparisonBarChart-all-negative')
    expect(allNegativeBarHtml).toContain(`data-min-value="${expectedRefundNetKwd}"`)
    expect(allNegativeBarHtml).toContain(String(Math.round(expectedRefundNetKwd)))

    // (d) SalesNetComposedChart & TimelineAreaChart Recharts prop/domain/tick inspection
    const capturedYDomains: unknown[] = []
    const capturedTickFormatters: Array<(v: number) => string> = []
    const capturedChartData: unknown[][] = []

    vi.resetModules()
    vi.doMock('recharts', async (importOriginal) => {
      const actual = await importOriginal<typeof import('recharts')>()
      return {
        ...actual,
        ResponsiveContainer: ({ children }: { children?: React.ReactNode }) =>
          React.createElement('div', { 'data-mock-rc': 'true' }, children),
        AreaChart: ({ children, data }: { children?: React.ReactNode; data?: unknown[] }) => {
          if (Array.isArray(data)) capturedChartData.push(data)
          return React.createElement('svg', null, children)
        },
        ComposedChart: ({ children, data }: { children?: React.ReactNode; data?: unknown[] }) => {
          if (Array.isArray(data)) capturedChartData.push(data)
          return React.createElement('svg', null, children)
        },
        YAxis: ({
          domain,
          tickFormatter,
        }: {
          domain?: unknown
          tickFormatter?: (v: number) => string
        }) => {
          capturedYDomains.push(domain)
          if (tickFormatter) capturedTickFormatters.push(tickFormatter)
          return React.createElement('g')
        },
        XAxis: () => React.createElement('g'),
        CartesianGrid: () => null,
        Tooltip: () => null,
        Area: () => React.createElement('path'),
        Bar: () => React.createElement('g'),
        Line: () => React.createElement('path'),
      }
    })

    const mockedKit = await import('@/components/charts/v35-chart-kit')

    const composedData = snap.sales.hourly.slice(0, 6).map((pt) => ({
      id: pt.id,
      label: pt.labelAr,
      tooltipTitle: pt.tooltipTitleAr,
      salesKwd: pt.salesKwd,
      netKwd: pt.salesKwd,
      netMarginPct: pt.sharePct,
      lines: [{ label: 'Sales', value: formatKwd(pt.salesKwd, { locale: 'ar' }), bold: true }],
    }))
    const composedHtml = renderToStaticMarkup(
      React.createElement(mockedKit.SalesNetComposedChart, {
        data: composedData,
        isAr: true,
        salesLegend: 'المبيعات',
        netLegend: 'الصافي',
      }),
    )
    assertValidSvgGeometry(composedHtml, 'SalesNetComposedChart-signed')
    expect(composedHtml).toContain(`data-min-value="${expectedRefundNetKwd}"`)

    const areaHourlyHtml = renderToStaticMarkup(
      React.createElement(mockedKit.TimelineAreaChart, {
        dailySeries: summary.dailySeries ?? [],
        hourlySeries: (summary.hourlySeries ?? []).map((h) => ({
          hour: h.hour,
          netKwd: h.netKwd,
          orders: h.orders,
        })),
        isAr: false,
      }),
    )
    assertValidSvgGeometry(areaHourlyHtml, 'TimelineAreaChart-hourly-signed')
    expect(areaHourlyHtml).toContain(`data-min-value="${expectedRefundNetKwd}"`)

    // Plotted rows passed to ComposedChart & AreaChart retain the exact negative refund value
    const composedRows = capturedChartData[0] as Array<{ salesKwd: number; netKwd: number }>
    expect(composedRows.some((r) => r.salesKwd === expectedRefundNetKwd)).toBe(true)
    expect(composedRows.some((r) => r.netKwd === expectedRefundNetKwd)).toBe(true)

    const areaRows = capturedChartData[1] as Array<{ value: number }>
    expect(areaRows.some((r) => r.value === expectedRefundNetKwd)).toBe(true)

    // YAxis domains switch from [0, 'auto'] to ['auto', 'auto'] when min < 0, and tickFormatters preserve '-'
    for (const dom of capturedYDomains) {
      expect(dom).toEqual(['auto', 'auto'])
    }
    for (const fmt of capturedTickFormatters) {
      expect(fmt(expectedRefundNetKwd)).toBe(String(Math.round(expectedRefundNetKwd)))
    }

    vi.doUnmock('recharts')
    vi.resetModules()

    // (e) V35DonutChart & StackedProgressBar still clamp negative proportional inputs safely (no negative widths)
    const donutHtml = renderToStaticMarkup(
      React.createElement(V35DonutChart, {
        slices: [
          {
            id: 'pos',
            label: 'Positive',
            value: positiveRef.salesKwd,
            valueFormatted: formatKwd(positiveRef.salesKwd, { locale: 'en' }),
            pctFormatted: formatPct(100, { locale: 'en' }),
          },
          {
            id: 'neg',
            label: 'Refund',
            value: expectedRefundNetKwd,
            valueFormatted: formatKwd(expectedRefundNetKwd, { locale: 'en' }),
            pctFormatted: formatPct(0, { locale: 'en' }),
          },
        ],
        centerValue: formatKwd(positiveRef.salesKwd, { locale: 'en' }),
        isAr: false,
      }),
    )
    assertValidSvgGeometry(donutHtml, 'V35DonutChart-proportional')

    const stackedHtml = renderToStaticMarkup(
      React.createElement(StackedProgressBar, {
        segments: [
          { id: 'pos', label: 'Positive', value: positiveRef.salesKwd },
          { id: 'neg', label: 'Refund', value: expectedRefundNetKwd },
        ],
        isAr: false,
      }),
    )
    assertValidSvgGeometry(stackedHtml, 'StackedProgressBar-proportional')
    expect(stackedHtml).not.toMatch(/width:-\d/)
  })
})
