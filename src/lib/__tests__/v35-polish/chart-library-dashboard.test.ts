/**
 * V35 Polish — Chart Library & Executive Dashboard polish integration tests.
 *
 * Covers:
 * - White rounded ChartCard / V35ChartCardHeader / DetailsPopover / V35Sparkline contracts
 * - StackedProgressBar dynamic caller segments & empty/unavailable withholding
 * - HourWeekdayHeatmap real matrix cells vs calm UnavailableState (strict Answer 3)
 * - InteractiveHoverBarChart backward-compatible props (CoresHubStudio safety)
 * - FullJourney360 KPI sparklines, Channel Mix StackedProgressBar & Sortable/Searchable Ledger Table
 *   against live today fixture (AR & EN, brand=all & brand=china-garden)
 * - Static CSS guardrails (logical RTL/LTR classes & >=12px typography)
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InteractiveHoverBarChart } from '@/components/aether/InteractiveHoverCharts'
import {
  HourWeekdayHeatmap,
  StackedProgressBar,
  V35ChartCardHeader,
  V35Sparkline,
} from '@/components/charts/v35-chart-kit'
import { ChartCard } from '@/components/ui/chart-card'
import type { GlobalFilters } from '@/lib/aether/global-filter-engine'
import { LanguageProvider } from '@/lib/i18n'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'
import {
  dashboardContext,
  renderAr,
  scopeBadgesOf,
  setDashboardContext,
  textOfAttr,
  todayFilters,
} from '../support/render-dashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => dashboardContext.value,
}))

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')

const TypedLangProvider = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

function renderEn(node: React.ReactElement): string {
  return renderToStaticMarkup(
    React.createElement(TypedLangProvider, { initialLocale: 'en' }, node),
  )
}

async function renderDashboard(
  locale: 'ar' | 'en',
  summary: OdooLiveSummary,
  filters: GlobalFilters,
): Promise<string> {
  setDashboardContext(summary, filters)
  const { FullJourney360 } = await import('@/components/aether/FullJourney360')
  const el = React.createElement(FullJourney360)
  return locale === 'ar' ? renderAr(el) : renderEn(el)
}

interface ExtractedElement {
  openTag: string
  outerHtml: string
  text: string
}

function extractBalancedElement(html: string, matchIndex: number): ExtractedElement | null {
  const open = html.lastIndexOf('<', matchIndex)
  if (open < 0) return null
  const openEnd = html.indexOf('>', open)
  if (openEnd < 0) return null
  const openTag = html.slice(open, openEnd + 1)
  const tag = /^<([a-z0-9]+)/i.exec(openTag)?.[1]
  if (!tag) return null
  let depth = 0
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi')
  re.lastIndex = open
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1
    if (depth === 0) {
      const outerHtml = html.slice(open, m.index + m[0].length)
      return {
        openTag,
        outerHtml,
        text: outerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      }
    }
  }
  return null
}

function findElementByAttr(html: string, attr: string, value: string): ExtractedElement | null {
  const token = `${attr}="${value}"`
  const idx = html.indexOf(token)
  if (idx < 0) return null
  return extractBalancedElement(html, idx)
}

function findCardByTag(
  html: string,
  tagName: string,
  predicate: (outerHtml: string) => boolean,
): ExtractedElement | null {
  const re = new RegExp(`<${tagName}\\b[^>]*>`, 'gi')
  for (const m of html.matchAll(re)) {
    const el = extractBalancedElement(html, (m.index ?? 0) + 1)
    if (el && predicate(el.outerHtml)) return el
  }
  return null
}

describe('V35 Polish — Chart Library Cards, Headers, Sparklines, StackedProgressBar & HourWeekdayHeatmap', () => {
  it('ChartCard, V35ChartCardHeader, and V35Sparkline render white rounded header with DetailsPopover (zero title=), big tabular KPI, emerald/rose delta pill, and smooth sparkline (>=2 finite points only)', () => {
    const posCardHtml = renderToStaticMarkup(
      React.createElement(
        ChartCard,
        {
          title: 'Monthly Net Sales',
          period: '2026-11-01 → 2026-11-17',
          unit: 'KWD',
          locale: 'en',
          infoContent: 'Aggregated directly from posted POS orders.',
          infoLabel: 'Sales formula details',
          kpiValue: '66,487.040 KWD',
          deltaPct: 12.4,
          deltaLabel: 'vs prior 17d',
          sparklineValues: [52100.125, 58400.5, 61200.25, 66487.04],
        },
        React.createElement('div', null, 'Chart canvas'),
      ),
    )

    expect(posCardHtml).toContain('data-chart-card="true"')
    expect(posCardHtml).toContain('rounded-2xl')
    expect(posCardHtml).toContain('bg-white')
    expect(posCardHtml).toContain('border-slate-200/85')
    expect(posCardHtml).toContain('dark:border-slate-800')
    expect(posCardHtml).toContain('dark:bg-slate-900/95')
    expect(posCardHtml).toContain('Monthly Net Sales')
    expect(posCardHtml).toContain('data-details-trigger="true"')
    expect(posCardHtml).toContain('aria-label="Sales formula details"')
    expect(posCardHtml).not.toMatch(/\btitle=/)
    expect(posCardHtml).toContain('66,487.040 KWD')
    expect(posCardHtml).toContain('tabular-nums')
    expect(posCardHtml).toContain('data-delta-tone="emerald"')
    expect(posCardHtml).toContain('bg-emerald-50')
    expect(posCardHtml).toContain('+12.4%')
    expect(posCardHtml).toContain('data-sparkline="true"')

    const sparkEl = findElementByAttr(posCardHtml, 'data-sparkline', 'true')
    expect(sparkEl).not.toBeNull()
    expect(sparkEl!.outerHtml).toContain('<svg')
    expect(sparkEl!.outerHtml).toContain('<path')
    expect(sparkEl!.outerHtml).not.toContain('<circle')

    // Negative delta renders rose pill with tabular-nums; deltaHigherIsBetter=false flips polarity
    const negCardHtml = renderToStaticMarkup(
      React.createElement(V35ChartCardHeader, {
        title: 'Operating Expenses',
        kpiValue: '12,340.500 KWD',
        deltaPct: -4.8,
        isAr: false,
        asCard: true,
        sparklineValues: [154.7], // < 2 points -> no sparkline
      }),
    )
    expect(negCardHtml).toContain('rounded-2xl')
    expect(negCardHtml).toContain('bg-white')
    expect(negCardHtml).toContain('12,340.500 KWD')
    expect(negCardHtml).toContain('data-delta-tone="rose"')
    expect(negCardHtml).toContain('bg-rose-50')
    expect(negCardHtml).toContain('tabular-nums')
    expect(negCardHtml).toContain('-4.8%')
    expect(negCardHtml).not.toContain('data-sparkline="true"')

    const favorableDropHtml = renderToStaticMarkup(
      React.createElement(V35ChartCardHeader, {
        title: 'COGS Ratio',
        kpiValue: '66,487.040 KWD',
        deltaPct: -3.2,
        deltaHigherIsBetter: false,
        isAr: false,
      }),
    )
    expect(favorableDropHtml).toContain('data-delta-tone="emerald"')
    expect(favorableDropHtml).toContain('-3.2%')

    // V35Sparkline returns null when fewer than 2 finite values exist
    expect(renderToStaticMarkup(React.createElement(V35Sparkline, { values: [] }))).toBe('')
    expect(renderToStaticMarkup(React.createElement(V35Sparkline, { values: [154.7] }))).toBe('')
    expect(
      renderToStaticMarkup(
        React.createElement(V35Sparkline, {
          values: [154.7, Number.NaN, null, undefined, Number.POSITIVE_INFINITY],
        }),
      ),
    ).toBe('')

    const validSparkHtml = renderToStaticMarkup(
      React.createElement(V35Sparkline, { values: [12.5, 45.25, 38.75, 66.4] }),
    )
    expect(validSparkHtml).toContain('<svg')
    expect(validSparkHtml).toContain('data-sparkline="true"')
    expect(validSparkHtml).toContain('<path')
    expect(validSparkHtml).not.toContain('<circle')
  })

  it('StackedProgressBar renders strictly dynamic caller segments with 3-decimal KWD + %, logical Tailwind, and calm UnavailableState when empty/missing', () => {
    const segments = [
      { id: 'talabat-go', label: 'Talabat GO', value: 62.95, orders: 9 },
      { id: 'keeta', label: 'Keeta', value: 57.8, orders: 11 },
      { id: 'dine-in', label: 'Dine-in', value: 33.95, orders: 4 },
    ]

    const enHtml = renderToStaticMarkup(
      React.createElement(StackedProgressBar, {
        segments,
        isAr: false,
        title: 'Channel Mix',
      }),
    )
    expect(enHtml).toContain('data-chart-kind="stacked-progress"')
    expect(enHtml).toContain('data-chart-mode="ready"')
    expect(enHtml).toContain('Talabat GO')
    expect(enHtml).toContain('Keeta')
    expect(enHtml).toContain('Dine-in')
    expect(enHtml).not.toContain('Deliveroo')
    expect(enHtml).not.toContain('Jahez')
    expect(enHtml).not.toContain('Snoonu')
    expect(enHtml).toContain('62.950 KWD')
    expect(enHtml).toContain('57.800 KWD')
    expect(enHtml).toContain('33.950 KWD')
    expect(enHtml).toContain('40.7%')
    expect(enHtml).toContain('37.4%')
    expect(enHtml).toContain('21.9%')
    expect(enHtml).toContain('text-start')
    expect(enHtml).toContain('border-e')
    expect(enHtml).not.toMatch(/\b(?:ml|mr|pl|pr)-|text-left|text-right/)

    const arItemsHtml = renderToStaticMarkup(
      React.createElement(StackedProgressBar, {
        items: segments,
        isAr: true,
        title: 'توزيع القنوات',
      }),
    )
    expect(arItemsHtml).toContain('dir="rtl"')
    expect(arItemsHtml).toContain('data-chart-kind="stacked-progress"')
    expect(arItemsHtml).toContain('data-chart-mode="ready"')
    expect(arItemsHtml).toContain('62.950 د.ك')
    expect(arItemsHtml).toContain('57.800 د.ك')
    expect(arItemsHtml).toContain('33.950 د.ك')
    expect(arItemsHtml).not.toContain('Deliveroo')
    expect(arItemsHtml).not.toContain('Jahez')

    for (const emptyProps of [
      { segments: [], isAr: true },
      { segments: undefined, isAr: true },
      { segments: [{ id: 'zero', label: 'Talabat GO', value: 0 }], isAr: true },
    ]) {
      const arEmpty = renderToStaticMarkup(React.createElement(StackedProgressBar, emptyProps))
      expect(arEmpty).toContain('data-chart-kind="stacked-progress"')
      expect(arEmpty).toContain('data-chart-mode="unavailable"')
      expect(arEmpty).toContain('data-unavailable-state="true"')
      expect(arEmpty).toContain('غير متاح بعد')
    }

    const enEmpty = renderToStaticMarkup(
      React.createElement(StackedProgressBar, { segments: [], isAr: false }),
    )
    expect(enEmpty).toContain('data-chart-kind="stacked-progress"')
    expect(enEmpty).toContain('data-chart-mode="unavailable"')
    expect(enEmpty).toContain('data-unavailable-state="true"')
    expect(enEmpty).toContain('Not available yet')
  })

  it('HourWeekdayHeatmap renders real Hour x Weekday matrix with 3-decimal KWD ONLY when real cells are supplied, and UnavailableState with zero invented cells when missing/empty', () => {
    const realCells = [
      { dow: 6, hour: 12, salesKwd: 120.5, orders: 18 },
      { dow: 0, hour: 19, salesKwd: 345.125, orders: 42 },
      { dow: 0, hour: 20, salesKwd: 88.75, orders: 11 },
    ]

    const enMatrix = renderToStaticMarkup(
      React.createElement(HourWeekdayHeatmap, {
        cells: realCells,
        isAr: false,
        title: 'Peak Hour Matrix',
      }),
    )
    expect(enMatrix).toContain('dir="ltr"')
    expect(enMatrix).toContain('data-chart-kind="hour-weekday-heatmap"')
    expect(enMatrix).toContain('data-chart-mode="matrix"')
    expect(enMatrix).toContain('Sat')
    expect(enMatrix).toContain('Sun')
    expect(enMatrix).toContain('120.500 KWD')
    expect(enMatrix).toContain('345.125 KWD')
    expect(enMatrix).toContain('88.750 KWD')
    expect(enMatrix).toContain('data-heat-level="')
    expect(enMatrix).toContain('data-heat-empty="true"')
    expect(enMatrix).not.toContain('0.000 KWD')

    const arMatrix = renderToStaticMarkup(
      React.createElement(HourWeekdayHeatmap, {
        cells: realCells,
        isAr: true,
        title: 'مصفوفة الساعات والأيام',
      }),
    )
    expect(arMatrix).toContain('dir="rtl"')
    expect(arMatrix).toContain('data-chart-kind="hour-weekday-heatmap"')
    expect(arMatrix).toContain('data-chart-mode="matrix"')
    expect(arMatrix).toContain('السبت')
    expect(arMatrix).toContain('الأحد')
    expect(arMatrix).toContain('120.500 د.ك')
    expect(arMatrix).toContain('345.125 د.ك')
    expect(arMatrix).toContain('88.750 د.ك')

    for (const emptyInput of [null, undefined, []] as const) {
      const arUnavailable = renderToStaticMarkup(
        React.createElement(HourWeekdayHeatmap, { cells: emptyInput, isAr: true }),
      )
      expect(arUnavailable).toContain('data-chart-kind="hour-weekday-heatmap"')
      expect(arUnavailable).toContain('data-chart-mode="unavailable"')
      expect(arUnavailable).toContain('data-unavailable-state="true"')
      expect(arUnavailable).toContain('غير متاح بعد')
      expect(arUnavailable).not.toContain('<table')
      expect(arUnavailable).not.toContain('data-heat-level=')
      expect(arUnavailable).not.toContain('0.000')

      const enUnavailable = renderToStaticMarkup(
        React.createElement(HourWeekdayHeatmap, { cells: emptyInput, isAr: false }),
      )
      expect(enUnavailable).toContain('data-chart-kind="hour-weekday-heatmap"')
      expect(enUnavailable).toContain('data-chart-mode="unavailable"')
      expect(enUnavailable).toContain('data-unavailable-state="true"')
      expect(enUnavailable).toContain('Not available yet')
      expect(enUnavailable).not.toContain('<table')
      expect(enUnavailable).not.toContain('data-heat-level=')
      expect(enUnavailable).not.toContain('0.000')
    }
  })

  it('InteractiveHoverBarChart preserves backward-compatible CoresHubStudio props (heightClass, xAxisLabel, yAxisLabel, primaryLegend, secondaryLegend)', () => {
    const dualHtml = renderToStaticMarkup(
      React.createElement(InteractiveHoverBarChart, {
        data: [
          {
            id: '2026-11-16',
            label: '2026-11-16',
            tooltipTitle: '2026-11-16',
            primaryValue: 485.25,
            secondaryValue: 420.1,
            lines: [
              { label: 'Current', value: '485.250 KWD', bold: true },
              { label: 'Prior', value: '420.100 KWD', tone: 'slate' },
            ],
          },
          {
            id: '2026-11-17',
            label: '2026-11-17',
            tooltipTitle: '2026-11-17',
            primaryValue: 154.7,
            secondaryValue: 140.25,
            lines: [
              { label: 'Current', value: '154.700 KWD', bold: true },
              { label: 'Prior', value: '140.250 KWD', tone: 'slate' },
            ],
          },
        ],
        isAr: false,
        heightClass: 'h-56',
        xAxisLabel: 'Days (Asia/Kuwait)',
        yAxisLabel: 'Net Sales (KWD)',
        primaryLegend: 'POS Net Sales',
        secondaryLegend: 'Prior Period',
      }),
    )

    expect(dualHtml).toContain('role="region"')
    expect(dualHtml).toContain('data-chart-kind="comparison-bar"')
    expect(dualHtml).toContain('data-chart-axis-x="true"')
    expect(dualHtml).toContain('data-chart-axis-y="true"')
    expect(dualHtml).toContain('Days (Asia/Kuwait)')
    expect(dualHtml).toContain('Net Sales (KWD)')
    expect(dualHtml).toContain('POS Net Sales')
    expect(dualHtml).toContain('Prior Period')
    expect(dualHtml).toContain('height:224px')

    const singleSeriesArHtml = renderToStaticMarkup(
      React.createElement(InteractiveHoverBarChart, {
        data: [
          {
            id: 'hr-12',
            label: '12:00',
            tooltipTitle: '12:00',
            primaryValue: 64.25,
            lines: [{ label: 'المبيعات', value: '64.250 د.ك', bold: true }],
          },
          {
            id: 'hr-15',
            label: '15:00',
            tooltipTitle: '15:00',
            primaryValue: 101.05,
            lines: [{ label: 'المبيعات', value: '101.050 د.ك', bold: true }],
          },
        ],
        isAr: true,
        heightClass: 'h-52',
        xAxisLabel: 'الساعة (توقيت الكويت)',
        yAxisLabel: 'صافي المبيعات (د.ك)',
        primaryLegend: 'صافي المبيعات الساعية',
      }),
    )

    expect(singleSeriesArHtml).toContain('dir="rtl"')
    expect(singleSeriesArHtml).toContain('data-chart-kind="comparison-bar"')
    expect(singleSeriesArHtml).toContain('data-y-axis-side="right"')
    expect(singleSeriesArHtml).toContain('صافي المبيعات الساعية')
    expect(singleSeriesArHtml).toContain('الساعة (توقيت الكويت)')
    expect(singleSeriesArHtml).toContain('صافي المبيعات (د.ك)')
  })
})

describe('V35 Polish — FullJourney360 Live Fixture Sparklines, Channel Mix & Sortable Ledger Table', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('keeps KPI text parity (154.700 د.ك / 24), shows a calm "trend not available" note instead of a sparkline when the day has no real hourly data, renders active Channel Mix segments excluding zero channels, and renders sortable/searchable ledger table in AR & EN (brand=all)', async () => {
    // The live 2026-11-17 payload has day-level totals only. Its summary `hourlySeries` is the
    // rolling-30-day series (Σ = 130,946.856), which must never be drawn as "today". With no real
    // selected-period hourly data, Home shows NO sparkline — a calm unavailable note instead.
    const arHtml = await renderDashboard('ar', loadLiveTodaySummary(), todayFilters('all'))
    const enHtml = await renderDashboard('en', loadLiveTodaySummary(), todayFilters('all'))

    // 1. Exact KPI text parity preserved; no sparkline, calm note in Cards 1 & 2
    expect(textOfAttr(arHtml, 'data-kpi', 'net-sales')).toBe('154.700 د.ك')
    expect(textOfAttr(arHtml, 'data-kpi', 'total-orders')).toBe('24')
    expect(textOfAttr(enHtml, 'data-kpi', 'net-sales')).toBe('154.700 KWD')
    expect(textOfAttr(enHtml, 'data-kpi', 'total-orders')).toBe('24')

    for (const [html, note] of [
      [arHtml, 'الاتجاه غير متاح — لا توجد بيانات ساعية لهذه الفترة'],
      [enHtml, 'Trend not available — no hourly data for this period'],
    ] as const) {
      const salesCard = findCardByTag(html, 'article', (h) => h.includes('data-kpi="net-sales"'))
      const ordersCard = findCardByTag(html, 'article', (h) => h.includes('data-kpi="total-orders"'))
      expect(salesCard).not.toBeNull()
      expect(ordersCard).not.toBeNull()
      for (const card of [salesCard!, ordersCard!]) {
        expect(card.outerHtml).not.toContain('data-sparkline="true"')
        expect(card.outerHtml).toContain('data-sparkline-unavailable="true"')
        expect(card.text).toContain(note)
        expect(card.outerHtml).not.toMatch(/amber-|rose-/)
      }
    }

    // 2. Channel Mix StackedProgressBar: active channels rendered, zero-sales channels excluded
    const arChannelCard = findCardByTag(
      arHtml,
      'section',
      (h) => h.includes('data-chart-card="true"') && h.includes('توزيع المبيعات حسب القناة'),
    )
    expect(arChannelCard).not.toBeNull()
    expect(arChannelCard!.outerHtml).toContain('data-chart-kind="stacked-progress"')
    expect(arChannelCard!.outerHtml).toContain('data-chart-mode="ready"')
    expect(arChannelCard!.text).toContain('طلبات (أسطول المنصة)')
    expect(arChannelCard!.text).toContain('كيتا')
    expect(arChannelCard!.text).toContain('طلبات (سائقي الشركة)')
    expect(arChannelCard!.text).toContain('ديليفرو')
    expect(arChannelCard!.text).toContain('62.950')
    expect(arChannelCard!.text).toContain('57.800')
    expect(arChannelCard!.text).toContain('27.000')
    expect(arChannelCard!.text).toContain('6.950')
    expect(arChannelCard!.text).not.toContain('جاهز')
    expect(arChannelCard!.text).not.toContain('سنونو')
    expect(arChannelCard!.text).not.toContain('الصالة')
    expect(arChannelCard!.text).not.toContain('سفري ومباشر')

    const enChannelCard = findCardByTag(
      enHtml,
      'section',
      (h) => h.includes('data-chart-card="true"') && h.includes('Sales Mix by Channel'),
    )
    expect(enChannelCard).not.toBeNull()
    expect(enChannelCard!.outerHtml).toContain('data-chart-kind="stacked-progress"')
    expect(enChannelCard!.outerHtml).toContain('data-chart-mode="ready"')
    expect(enChannelCard!.text).toContain('Talabat Tgo')
    expect(enChannelCard!.text).toContain('Keeta')
    expect(enChannelCard!.text).toContain('Talabat TMP')
    expect(enChannelCard!.text).toContain('Deliveroo')
    expect(enChannelCard!.text).not.toContain('Jahez')
    expect(enChannelCard!.text).not.toContain('Snoonu')
    expect(enChannelCard!.text).not.toContain('Dine-in')
    expect(enChannelCard!.text).not.toContain('Takeaway/Direct')

    expect(scopeBadgesOf(arHtml)).toEqual({})
    expect(scopeBadgesOf(enHtml)).toEqual({})

    // 3. Sortable & Searchable [data-ledger-table="true"]
    const arLedger = findElementByAttr(arHtml, 'data-ledger-table', 'true')
    expect(arLedger).not.toBeNull()
    expect(arLedger!.outerHtml).toContain('type="search"')
    expect(arLedger!.outerHtml).toContain('placeholder="ابحث…"')
    expect(arLedger!.outerHtml).toContain('<table')
    expect(arLedger!.outerHtml).toContain('aria-sort="descending"')
    expect(arLedger!.outerHtml).toContain('aria-sort="none"')
    expect(arLedger!.outerHtml).toContain('tabular-nums')
    expect(arLedger!.text).toContain('مطبخ العارضية')
    expect(arLedger!.text).toContain('99.350')
    expect(arLedger!.text).toContain('بروميناد')
    expect(arLedger!.text).toContain('31.550')
    expect(arLedger!.text).toContain('السالمية')
    expect(arLedger!.text).toContain('18.350')
    expect(arLedger!.text).toContain('الكوت')
    expect(arLedger!.text).toContain('5.450')
    expect(arLedger!.text).toContain('غير منسوب لفرع')
    const arTable = findCardByTag(arLedger!.outerHtml, 'table', () => true)
    expect(arTable).not.toBeNull()
    expect(arTable!.outerHtml).not.toContain('data-branch-card')

    const enLedger = findElementByAttr(enHtml, 'data-ledger-table', 'true')
    expect(enLedger).not.toBeNull()
    expect(enLedger!.outerHtml).toContain('type="search"')
    expect(enLedger!.outerHtml).toContain('placeholder="Search branch…"')
    expect(enLedger!.outerHtml).toContain('<table')
    expect(enLedger!.outerHtml).toContain('aria-sort="descending"')
    expect(enLedger!.outerHtml).toContain('tabular-nums')
    expect(enLedger!.text).toContain('Ardiya')
    expect(enLedger!.text).toContain('99.350')
    expect(enLedger!.text).toContain('Promenade')
    expect(enLedger!.text).toContain('31.550')
    expect(enLedger!.text).toContain('Salmiya')
    expect(enLedger!.text).toContain('18.350')
    expect(enLedger!.text).toContain('Al-Kout')
    expect(enLedger!.text).toContain('5.450')
    expect(enLedger!.text).toContain('Unattributed to Branch')
    const enTable = findCardByTag(enLedger!.outerHtml, 'table', () => true)
    expect(enTable).not.toBeNull()
    expect(enTable!.outerHtml).not.toContain('data-branch-card')
  })

  it('withholds all-brand Channel Mix and [data-ledger-table="true"] via calm UnavailableState on brand=china-garden (AR & EN)', async () => {
    const arHtml = await renderDashboard('ar', loadLiveTodaySummary(), todayFilters('china-garden'))
    const enHtml = await renderDashboard('en', loadLiveTodaySummary(), todayFilters('china-garden'))

    const arChannelCard = findCardByTag(
      arHtml,
      'section',
      (h) => h.includes('data-chart-card="true"') && h.includes('توزيع المبيعات حسب القناة'),
    )
    expect(arChannelCard).not.toBeNull()
    expect(arChannelCard!.outerHtml).toContain('data-unavailable-state="true"')
    expect(arChannelCard!.text).toContain('غير متاح بعد')
    expect(arChannelCard!.outerHtml).not.toContain('data-chart-kind="stacked-progress"')
    expect(arChannelCard!.outerHtml).not.toContain('62.950')

    const enChannelCard = findCardByTag(
      enHtml,
      'section',
      (h) => h.includes('data-chart-card="true"') && h.includes('Sales Mix by Channel'),
    )
    expect(enChannelCard).not.toBeNull()
    expect(enChannelCard!.outerHtml).toContain('data-unavailable-state="true"')
    expect(enChannelCard!.text).toContain('Not available yet')
    expect(enChannelCard!.outerHtml).not.toContain('data-chart-kind="stacked-progress"')
    expect(enChannelCard!.outerHtml).not.toContain('62.950')

    const arLedger = findElementByAttr(arHtml, 'data-ledger-table', 'true')
    expect(arLedger).not.toBeNull()
    expect(arLedger!.outerHtml).toContain('data-unavailable-state="true"')
    expect(arLedger!.text).toContain('غير متاح بعد')
    expect(arLedger!.outerHtml).not.toContain('<table')
    expect(arLedger!.outerHtml).not.toContain('154.700')
    expect(arLedger!.outerHtml).not.toContain('99.350')
    expect(arLedger!.text).not.toMatch(/\b24\b/)

    const enLedger = findElementByAttr(enHtml, 'data-ledger-table', 'true')
    expect(enLedger).not.toBeNull()
    expect(enLedger!.outerHtml).toContain('data-unavailable-state="true"')
    expect(enLedger!.text).toContain('Not available yet')
    expect(enLedger!.outerHtml).not.toContain('<table')
    expect(enLedger!.outerHtml).not.toContain('154.700')
    expect(enLedger!.outerHtml).not.toContain('99.350')
    expect(enLedger!.text).not.toMatch(/\b24\b/)

    expect(scopeBadgesOf(arHtml)).toEqual({
      'ledger-ar': 'company-wide',
      'sales-net-combo': 'all-brands',
      'weekly-pulse': 'all-brands',
    })
  })
})

describe('V35 Polish — Static CSS Guardrails (Logical RTL/LTR & >=12px Typography)', () => {
  it('enforces zero physical ml-/mr-/pl-/pr-/text-left/text-right classes and zero sub-12px font classes across Chart Library & FullJourney360 files', async () => {
    const root = process.cwd()
    const targetFiles = [
      'src/components/charts/v35-chart-kit.tsx',
      'src/components/charts/v35-chart-theme.ts',
      'src/components/ui/chart-card.tsx',
      'src/components/aether/InteractiveHoverCharts.tsx',
      'src/components/aether/FullJourney360.tsx',
    ]

    const physicalDirectionalRe =
      /(?<![a-zA-Z0-9_-])(?:[a-z]+:)*(?:ml|mr|pl|pr)-(?:[a-zA-Z0-9[]|auto)|(?<![a-zA-Z0-9_-])(?:[a-z]+:)*text-(?:left|right)(?![a-zA-Z0-9_-])/
    const sub12PxRe = /text-\[(?:[0-9]|10|11)(?:\.\d+)?px\]/

    for (const rel of targetFiles) {
      const src = await readFile(path.join(root, rel), 'utf8')
      expect(
        physicalDirectionalRe.test(src),
        `${rel} must not contain physical ml-/mr-/pl-/pr-/text-left/text-right classes`,
      ).toBe(false)
      expect(
        sub12PxRe.test(src),
        `${rel} must not contain sub-12px font classes`,
      ).toBe(false)
    }
  })
})
