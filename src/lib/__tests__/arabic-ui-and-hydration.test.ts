/**
 * Regression & Live-Gate Suite — Item 5:
 *   Part A: Deterministic SSR vs client pass-1 hydration on `/erp/demand-forecast` (`DemandForecastPanel`)
 *           and `/erp/decisions` (`DecisionRoomStudio`) — zero `React #418` mismatch even with warm SWR cache.
 *   Part B: 100% Arabic localization of `(COGS)` tags and English formulas / ORM identifiers across
 *           Finance (`/erp/finance`), Executive P&L (`/erp/executive-pnl`), Main `/erp`, and Decision Room (`/erp/decisions`).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import React, { createElement } from 'react'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import {
  buildLiveDecisionSnapshotFromSummary,
  bustDecisionSwrCache,
  writeDecisionSwrCache,
} from '@/lib/aether/live-decision-generator'
import { runCouncil } from '@/lib/council/runner'
import { templateSummary } from '@/lib/council/executive-summary'
import type { ExecutiveContextPack } from '@/lib/feryal/executive-advisor'
import { LanguageProvider } from '@/lib/i18n'
import type {
  OdooBucketSummary,
  OdooLedgerAccountingSummary,
  OdooLiveSummary,
} from '@/lib/odoo/live-sync-core'
import {
  DecisionRoomStudio,
  DecisionRoomView,
  DemandForecastPanel,
  localizeEstimateFormulaAr,
  localizeEstimateFormulaEn,
  localizeEstimateInputKeyAr,
} from '@/components/aether/DecisionRoomStudio'
import { FullJourney360 } from '@/components/aether/FullJourney360'
import { ExecutivePnlStudio } from '@/components/erp/ExecutivePnlStudio'
import FinanceDashboard from '@/components/erp/FinanceDashboard'
import {
  KpiProvenanceBadge,
  localizeOdooModelAr,
  localizeQueryOrFormulaAr,
} from '@/components/erp/KpiProvenanceBadge'
import { OdooAccountingAnalyticsHub } from '@/components/accounting/OdooAccountingAnalyticsHub'
import { VentureAccountingHub } from '@/components/accounting/VentureAccountingHub'
import { loadLiveTodaySummary } from './support/dashboard-fixture'

const testFilterContext: {
  current: {
    filters: Required<GlobalFilters>
    workspace: ReturnType<typeof computeGlobalWorkspace>
    liveSummary: OdooLiveSummary | null
    isAuditor: boolean
    sessionRole: 'admin'
    syncingOdoo: boolean
    syncCooldownSec: number
    triggerOdooSyncNow: () => Promise<void>
    setPeriod: () => void
    setCustomRange: () => void
    setKuwaitSlice: () => void
    setBrand: () => void
    setBranch: () => void
    setChannel: () => void
    setLens: () => void
    resetFilters: () => void
    buildShareDeepLinkText: () => string
  } | null
} = { current: null }

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push() {},
    replace() {},
    refresh() {},
    back() {},
    forward() {},
    prefetch() {},
  }),
  usePathname: () => '/erp/demand-forecast',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => testFilterContext.current,
}))

const TypedLangProvider = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

function configureContext(
  summary: OdooLiveSummary | null,
  filterOverrides: Partial<GlobalFilters> = {},
): void {
  const filters: Required<GlobalFilters> = {
    ...DEFAULT_GLOBAL_FILTERS,
    ...filterOverrides,
  }
  testFilterContext.current = {
    filters,
    workspace: computeGlobalWorkspace(filters, summary),
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

function renderWithLang(locale: 'ar' | 'en', element: React.ReactElement): string {
  return renderToStaticMarkup(
    createElement(TypedLangProvider, { initialLocale: locale }, element),
  )
}

function renderSsrString(locale: 'ar' | 'en', element: React.ReactElement): string {
  return renderToString(
    createElement(TypedLangProvider, { initialLocale: locale }, element),
  )
}

function stripTagsToVisibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildClosedGlSummary(): OdooLiveSummary {
  const base = loadLiveTodaySummary()
  const closedAccounting: OdooLedgerAccountingSummary = {
    available: true,
    from: '2026-10-01',
    to: '2026-10-31',
    sourceModel: 'account.move.line',
    glClosedThroughDate: '2026-10-31',
    completeAccrualPosted: true,
    glIncomplete: false,
    aggregatorCommissionUnposted: false,
    lineCount: 412,
    income: 185420.5,
    otherIncome: 0,
    totalRevenue: 185420.5,
    cogs: 61240.25,
    deliveryCommissions: 19450.125,
    expense: 60110.125,
    depreciation: 8000,
    otherOpexAndDepreciation: 68110.125,
    operatingProfit: 36620.0,
    revenueAccounts: [
      { code: '400001', name: 'مبيعات المطاعم', accountType: 'income', amountKwd: 185420.5 },
    ],
    commissionAccounts: [{ code: '40866', name: 'عمولات منصات التوصيل', amountKwd: 19450.125 }],
  }

  const fallbackBucket: OdooBucketSummary = {
    key: 'custom',
    from: '2026-10-01',
    to: '2026-10-31',
    days: 31,
    totals: {
      netSalesKwd: base.totals.netSalesKwd,
      orders: base.totals.orders,
      aovKwd: base.totals.aovKwd,
      restaurantNetKwd: base.totals.netSalesKwd,
      restaurantOrders: base.totals.orders,
    },
    byBrand: {},
    byLocation: {},
    mappedByLocation: {},
    uiChannels: {},
    unattributedSalesKwd: 420.5,
    unattributedOrders: 85,
    accounting: closedAccounting,
  }

  return {
    ...base,
    unattributedSalesKwd: 420.5,
    unattributedOrders: 85,
    unmappedTerminals: [
      { terminal_id: 91, terminal_name: 'POS #91', net_sales_kwd: 420.5, orders_count: 85 },
    ],
    buckets: {
      ...base.buckets,
      month: base.buckets?.month
        ? {
            ...base.buckets.month,
            from: '2026-10-01',
            to: '2026-10-31',
            unattributedSalesKwd: 420.5,
            unattributedOrders: 85,
            accounting: closedAccounting,
          }
        : undefined,
    },
    customBucket: base.buckets?.month
      ? {
          ...base.buckets.month,
          key: 'custom',
          from: '2026-10-01',
          to: '2026-10-31',
          days: 31,
          unattributedSalesKwd: 420.5,
          unattributedOrders: 85,
          accounting: closedAccounting,
        }
      : fallbackBucket,
  }
}

function buildSampleContextPack(): ExecutiveContextPack {
  return {
    available: true,
    period: { from: '2026-10-01', to: '2026-10-31', days: 31, labelAr: 'أكتوبر', labelEn: 'Oct' },
    syncedAt: '2026-11-17T03:00:36.564Z',
    totals: {
      netSalesKwd: '185420.500',
      totalQty: 42500,
      skuCount: 64,
      orderCount: 19400,
    },
    tierSummary: {
      A: { skuCount: 14, netSalesKwd: '148336.400', revenueSharePct: '80.0' },
      B: { skuCount: 18, netSalesKwd: '27813.075', revenueSharePct: '15.0' },
      C: { skuCount: 32, netSalesKwd: '9271.025', revenueSharePct: '5.0' },
    },
    skus: [
      {
        productId: 101,
        name: 'وجبة دجاج كرسبي عائلي',
        brandId: 'warrior',
        brandNameAr: 'وورير',
        brandNameEn: 'Warrior',
        paretoTier: 'A',
        qty: 4200,
        netSalesKwd: '24150.000',
        avgUnitNetKwd: '5.750',
        revenueSharePct: '13.0',
        cumulativeSharePct: '13.0',
      },
    ],
    branchChannelMix: {
      available: true,
      directNetSalesKwd: '74168.200',
      directOrders: 8100,
      aggregatorNetSalesKwd: '111252.300',
      aggregatorOrders: 11300,
      topBranches: [],
      topChannels: [],
    },
  } as unknown as ExecutiveContextPack
}

describe('Item 5 — Demand Forecast Hydration Safety & Full Arabic Formula/COGS Localization', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-11-17T03:05:00.000Z'), toFake: ['Date'] })
    bustDecisionSwrCache()
  })

  afterEach(() => {
    bustDecisionSwrCache()
    vi.useRealTimers()
  })

  describe('Part A — Hydration Parity (`React #418` Prevention) on `/erp/demand-forecast` & `/erp/decisions`', () => {
    it('renders identical SSR and client pass-1 HTML on DemandForecastPanel even when SWR cache and GlobalFilterContext are warm', () => {
      const liveSummary = loadLiveTodaySummary()

      // 1. Server SSR render: cold cache, liveSummary === null
      bustDecisionSwrCache()
      configureContext(null)
      const ssrAr = renderSsrString('ar', createElement(DemandForecastPanel))
      const ssrEn = renderSsrString('en', createElement(DemandForecastPanel))

      // 2. Client initial hydration pass-1: sessionStorage / L1 SWR cache AND GlobalFilterContext are already warm!
      const snap = buildLiveDecisionSnapshotFromSummary(liveSummary)
      writeDecisionSwrCache('room', {
        generatedAt: snap.generatedAt,
        reports: snap.reports,
        summary: snap.summary,
        liveSummary,
        canDecide: true,
      })
      configureContext(liveSummary)

      const clientPass1Ar = renderSsrString('ar', createElement(DemandForecastPanel))
      const clientPass1En = renderSsrString('en', createElement(DemandForecastPanel))

      expect(clientPass1Ar).toBe(ssrAr)
      expect(clientPass1En).toBe(ssrEn)
      expect(ssrAr).toContain('data-demand-forecast-panel="true"')
      expect(ssrAr).toContain('data-state-block="loading"')
    })

    it('renders identical SSR and client pass-1 HTML on DecisionRoomStudio even when SWR cache is warm', () => {
      const liveSummary = loadLiveTodaySummary()

      bustDecisionSwrCache()
      configureContext(null)
      const ssrAr = renderSsrString('ar', createElement(DecisionRoomStudio))

      const snap = buildLiveDecisionSnapshotFromSummary(liveSummary)
      writeDecisionSwrCache('room', {
        generatedAt: snap.generatedAt,
        reports: snap.reports,
        summary: snap.summary,
        liveSummary,
        canDecide: true,
      })
      writeDecisionSwrCache('decisions', [
        {
          id: 'dec-1',
          fingerprint: snap.reports[0]?.findings[0]?.fingerprint ?? 'fp-1',
          advisorId: 'cfo',
          kind: 'receivables-credits-clearing',
          branchId: null,
          titleAr: 'تحصيل الذمم المفتوحة',
          titleEn: 'Collect open AR',
          status: 'accepted',
          note: null,
          decidedBy: 'admin',
          decidedAt: '2026-11-17T02:00:00.000Z',
          decidedDay: '2026-11-17',
          expectedWeeklyKwd: 500,
          outcome: null,
          outcomeAt: null,
        },
      ])
      configureContext(liveSummary)

      const clientPass1Ar = renderSsrString('ar', createElement(DecisionRoomStudio))
      expect(clientPass1Ar).toBe(ssrAr)
    })

    it('renders deterministic ForecastView on SSR when explicit initialSummary is supplied, with pure Arabic labels', () => {
      const liveSummary = loadLiveTodaySummary()
      configureContext(null)

      const arHtml = renderSsrString(
        'ar',
        createElement(DemandForecastPanel, { initialSummary: liveSummary }),
      )
      const arClientHtml = renderSsrString(
        'ar',
        createElement(DemandForecastPanel, { initialSummary: liveSummary }),
      )
      expect(arClientHtml).toBe(arHtml)
      expect(arHtml).toContain('data-forecast-bars="true"')

      const arText = stripTagsToVisibleText(arHtml)
      expect(arText).toContain('طلبات نقاط البيع')
      expect(arText).toContain('متوسط نسبة خطأ النموذج في الاختبار الرجعي')
      expect(arText).not.toContain('pos.order')
      expect(arText).not.toContain('(MAPE)')
    })

    it('forbids synchronous SWR cache reads inside useState initializers in DecisionRoomStudio.tsx', () => {
      const src = readFileSync(
        path.resolve(process.cwd(), 'src/components/aether/DecisionRoomStudio.tsx'),
        'utf8',
      )
      expect(src).not.toMatch(/useState\s*(?:<[^>]+>)?\s*\(\s*\(\)\s*=>[\s\S]{0,160}?peekDecisionSwrCache/)
      expect(src).not.toMatch(/useState\s*(?:<[^>]+>)?\s*\(\s*\(\)\s*=>[\s\S]{0,160}?peekErpReadCache/)
    })
  })

  describe('Part B — Zero `(COGS)` Tags & 100% Pure Arabic Formulas Across All 4 Pages', () => {
    it('localizes KpiProvenanceBadge models and formulas into 100% Arabic in RTL while keeping English intact in LTR', () => {
      expect(localizeOdooModelAr('pos.order')).toBe('طلبات نقاط البيع')
      expect(localizeOdooModelAr('account.move.line')).toBe('قيود دفتر الأستاذ العام')
      expect(localizeOdooModelAr('pos.order + account.move.line')).toBe(
        'طلبات نقاط البيع + قيود الأستاذ العام',
      )

      const formulas = [
        "SUM(debit - credit) ON direct_cost accounts WHERE parent_state = 'posted'",
        '(COGS + DeliveryCommissions + OpexRentDepr + OperatingProfit) / Revenue * 10 KWD',
        'Revenue - COGS',
        'Gross Margin = (Revenue - COGS) / Revenue',
        'pos.order.read_group([["state","in",["paid","done","invoiced"]]],["amount_total:sum"])',
        'SUM(price_subtotal) ON pos.order.line',
      ]

      for (const rawFormula of formulas) {
        const localized = localizeQueryOrFormulaAr(rawFormula, 'account.move.line', '2026-10-01 → 2026-10-31')
        expect(localized, `Expected pure Arabic for: ${rawFormula}`).not.toMatch(/[A-Za-z]/)
        expect(localized).not.toContain('COGS')

        const openArHtml = renderWithLang(
          'ar',
          createElement(KpiProvenanceBadge, {
            odooModel: 'account.move.line',
            dateRange: { from: '2026-10-01', to: '2026-10-31' },
            lastSyncAt: '2026-11-17T03:00:00.000Z',
            kind: 'formula',
            queryOrFormula: rawFormula,
            isAr: true,
            open: true,
          }),
        )
        const visibleAr = stripTagsToVisibleText(openArHtml)
        expect(visibleAr).not.toContain('COGS')
        expect(visibleAr).not.toContain('account.move.line')
        expect(visibleAr).not.toContain('pos.order')
        expect(visibleAr).not.toMatch(/\bSUM\s*\(/i)
      }

      const openEnHtml = renderWithLang(
        'en',
        createElement(KpiProvenanceBadge, {
          odooModel: 'account.move.line',
          dateRange: { from: '2026-10-01', to: '2026-10-31' },
          lastSyncAt: '2026-11-17T03:00:00.000Z',
          kind: 'formula',
          queryOrFormula: 'Revenue - COGS',
          isAr: false,
          open: true,
        }),
      )
      expect(stripTagsToVisibleText(openEnHtml)).toContain('Revenue - COGS')
      expect(stripTagsToVisibleText(openEnHtml)).toContain('account.move.line')
    })

    it('removes all `(COGS)` tags and English ORM codes from ExecutivePnlStudio (`/erp/executive-pnl`) in Arabic mode', () => {
      const closedSummary = buildClosedGlSummary()
      configureContext(closedSummary, {
        period: 'custom',
        customFrom: '2026-10-01',
        customTo: '2026-10-31',
      })

      const arHtml = renderWithLang('ar', createElement(ExecutivePnlStudio))
      const arText = stripTagsToVisibleText(arHtml)

      expect(arText).toContain('تكلفة البضاعة المباعة الفعلية')
      expect(arText).toContain('تكلفة البضاعة المباعة والمواد الغذائية والتعبئة الفعلية')
      expect(arText).not.toContain('(COGS)')
      expect(arText).not.toMatch(/\bCOGS\b/i)
      expect(arText).not.toContain('account.move.line')
      expect(arText).not.toContain('expense_direct_cost')
      expect(arText).not.toContain('OP-NET')

      const enHtml = renderWithLang('en', createElement(ExecutivePnlStudio))
      const enText = stripTagsToVisibleText(enHtml)
      expect(enText).toContain('Actual GL COGS')
      expect(enText).toContain('Posted Cost of Goods Sold & Packaging (COGS)')
    })

    it('removes all `(COGS)` tags and English formulas from Finance (`/erp/finance`) components in Arabic mode', () => {
      const closedSummary = buildClosedGlSummary()
      configureContext(closedSummary, {
        period: 'custom',
        customFrom: '2026-10-01',
        customTo: '2026-10-31',
      })

      const hubArHtml = renderWithLang(
        'ar',
        createElement(OdooAccountingAnalyticsHub, { isAr: true, locale: 'ar' }),
      )
      const hubArText = stripTagsToVisibleText(hubArHtml)
      expect(hubArText).toContain('تكلفة البضاعة المباعة المرحّلة')
      expect(hubArText).toContain('تكلفة البضاعة المباعة')
      expect(hubArText).not.toContain('(COGS)')
      expect(hubArText).not.toMatch(/\bCOGS\b/i)
      expect(hubArText).not.toContain('account.move.line')

      const ventureGlArHtml = renderWithLang(
        'ar',
        createElement(VentureAccountingHub, { locale: 'ar', initialTab: 'glSummary', embeddedInErp: true }),
      )
      const ventureRecvArHtml = renderWithLang(
        'ar',
        createElement(VentureAccountingHub, { locale: 'ar', initialTab: 'receivables', embeddedInErp: true }),
      )
      const finDashArHtml = renderWithLang('ar', createElement(FinanceDashboard))

      for (const html of [ventureGlArHtml, ventureRecvArHtml, finDashArHtml]) {
        const txt = stripTagsToVisibleText(html)
        expect(txt).not.toContain('(COGS)')
        expect(txt).not.toMatch(/\bCOGS\b/i)
        expect(txt).not.toContain('Odoo GL')
      }

      const glPanelSrc = readFileSync(
        path.resolve(process.cwd(), 'src/components/accounting/GlStatementsPanel.tsx'),
        'utf8',
      )
      expect(glPanelSrc).toContain('= الالتزامات + حقوق الملكية')
    })

    it('removes all `(COGS)` tags and raw ORM identifiers from Main `/erp` (`FullJourney360`) in Arabic mode', () => {
      const closedSummary = buildClosedGlSummary()
      configureContext(closedSummary, {
        period: 'custom',
        customFrom: '2026-10-01',
        customTo: '2026-10-31',
      })

      const homeArHtml = renderWithLang('ar', createElement(FullJourney360))
      const homeArText = stripTagsToVisibleText(homeArHtml)

      expect(homeArText).toContain('تكلفة البضاعة المباعة والمواد')
      expect(homeArText).not.toContain('(COGS)')
      expect(homeArText).not.toMatch(/\bCOGS\b/i)
      expect(homeArText).not.toContain('pos.order')
      expect(homeArText).not.toContain('account.move.line')
      expect(homeArText).not.toContain('pos.payment')
    })

    it('localizes all Decision Room (`DecisionRoomView` & `live-decision-generator`) formulas and inputs into 100% Arabic', () => {
      const closedSummary = buildClosedGlSummary()
      const contextPack = buildSampleContextPack()
      const councilSnap = runCouncil({
        cfo: { summary: closedSummary },
        seasons: { summary: closedSummary, events: [] },
        drivers: { summary: closedSummary },
        benchmark: { summary: closedSummary },
        forecast: { summary: closedSummary },
      })
      const liveSnap = buildLiveDecisionSnapshotFromSummary(closedSummary, contextPack, councilSnap)
      expect(liveSnap.available).toBe(true)

      const liveOnlySnap = buildLiveDecisionSnapshotFromSummary(closedSummary, contextPack)
      for (const f of liveOnlySnap.reports.flatMap((r) => r.findings)) {
        if (f.weeklyImpact) {
          expect(
            f.weeklyImpact.formula,
            `Expected pure Arabic live formula for ${f.fingerprint}`,
          ).not.toMatch(/[A-Za-z]/)
        }
        expect(f.rootCause.ar).not.toMatch(/\b(?:account\.move\.line|pos\.order\.line|standard_price|COGS)\b/i)
      }

      for (const tab of ['all', 'drivers', 'benchmark', 'forecast'] as const) {
        const roomArHtml = renderToStaticMarkup(
          createElement(DecisionRoomView, {
            locale: 'ar',
            generatedAt: liveSnap.generatedAt,
            reports: liveSnap.reports,
            summary: liveSnap.summary ?? templateSummary(councilSnap),
            decisions: [],
            canDecide: true,
            liveSummary: closedSummary,
            initialTab: tab,
            onDecide: () => {},
          }),
        )
        const roomArText = stripTagsToVisibleText(roomArHtml)
        expect(roomArText).not.toContain('(COGS)')
        expect(roomArText).not.toMatch(/\bCOGS\b/i)
        expect(roomArText).not.toContain('pos.order')
        expect(roomArText).not.toContain('account.move.line')
        expect(roomArText).not.toContain('standard_price')
        expect(roomArText).not.toContain('(MAPE)')
        expect(roomArText).not.toContain('weekly clearing pace')
        expect(roomArText).not.toContain('peer_median')
        expect(roomArText).not.toContain('open_debits_kwd')
      }

      // Verify helper parity in both directions
      expect(
        localizeEstimateFormulaAr('50% × (orders last 28 days ÷ 4) × ticket drop per order'),
      ).not.toMatch(/[A-Za-z]/)
      expect(localizeEstimateInputKeyAr('overdue_over_30d_kwd')).toBe(
        'الذمم المتأخرة فوق 30 يوماً (د.ك)',
      )
      expect(
        localizeEstimateFormulaEn(
          '25% × (الذمم المتأخرة فوق 30 يوماً 900.000 + القيمة المطلقة للأرصدة الدائنة 150.000) وتيرة التسوية الأسبوعية',
        ),
      ).toContain('weekly clearing pace')
    })
  })

  describe('Part C — Repo Static Invariants Across Owned Item-5 Files', () => {
    it('enforces zero console.*, zero explicit any, zero sub-12px classes, and zero forbidden identifiers', () => {
      const ownedRelPaths = [
        'src/app/erp/demand-forecast/page.tsx',
        'src/components/aether/DecisionRoomStudio.tsx',
        'src/lib/aether/live-decision-generator.ts',
        'src/components/aether/FullJourney360.tsx',
        'src/components/erp/ExecutivePnlStudio.tsx',
        'src/components/erp/FinanceDashboard.tsx',
        'src/components/erp/KpiProvenanceBadge.tsx',
        'src/components/accounting/OdooAccountingAnalyticsHub.tsx',
        'src/components/accounting/GlStatementsPanel.tsx',
        'src/components/accounting/VentureAccountingHub.tsx',
      ]
      const sub12Re = /text-\[(?:[0-9]|10|10\.5|11|11\.5)px\]/
      const consoleRe = /\bconsole\.(?:log|warn|error|info|debug)\b/
      const anyTypeRe = /(?:\bas\s+any\b|:\s*any\b|<any>)/
      const tsIgnoreRe = /@ts-(?:ignore|expect-error)/

      for (const rel of ownedRelPaths) {
        const raw = readFileSync(path.resolve(process.cwd(), rel), 'utf8')
        const noComments = raw
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '')
        expect(sub12Re.test(raw), `${rel} contains sub-12px font class`).toBe(false)
        expect(consoleRe.test(noComments), `${rel} contains console.*`).toBe(false)
        expect(anyTypeRe.test(noComments), `${rel} contains explicit any`).toBe(false)
        expect(tsIgnoreRe.test(raw), `${rel} contains @ts-ignore/@ts-expect-error`).toBe(false)
      }
    })
  })
})
