import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OdooBucketSummary, OdooLiveSummary, OdooReceivableClearingSummary } from '@/lib/odoo/live-sync-core'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  DEFAULT_GLOBAL_FILTERS,
  computeGlobalWorkspace,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { selectReceivablesHeadline } from '@/lib/aether/receivables-headline'
import {
  askFeryalOdooAgent,
  resetFeryalAuditCache,
  type FeryalOdooDataSource,
} from '@/lib/feryal-odoo-agent'

type GlobalFilterContextValue = ReturnType<
  typeof import('@/components/aether/GlobalFilterContext').useGlobalFilter
>

const mockGlobalFilterState: { current: GlobalFilterContextValue | null } = {
  current: null,
}

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp/receivables',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname?: string }
    children?: React.ReactNode
    className?: string
  }) =>
    React.createElement(
      'a',
      { href: typeof href === 'string' ? href : href?.pathname ?? '#', ...rest },
      children,
    ),
}))

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => {
    if (!mockGlobalFilterState.current) {
      throw new Error('mockGlobalFilterState.current must be initialized')
    }
    return mockGlobalFilterState.current
  },
}))

import { LanguageProvider } from '@/lib/i18n'
import { ReceivablesAgingStudio } from '@/components/erp/ReceivablesAgingStudio'
import { VentureAccountingHub } from '@/components/accounting/VentureAccountingHub'
import { OdooAccountingAnalyticsHub } from '@/components/accounting/OdooAccountingAnalyticsHub'
import { DeliveryRadarV5 } from '@/components/aether/DeliveryRadarV5'

const TypedLanguageProvider = LanguageProvider as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

const FIXTURE_NOW = new Date('2026-11-17T11:30:00.000Z')
const REASON_AR = 'قيد المطابقة مع المحاسبة — غير متاح بعد'
const REASON_EN = 'Under reconciliation with accounting — not available yet'

/** Real production shape from Odoo 17 (62,766 POS clearing 10552 lines netted with platform lines). */
const PROD_RECEIVABLES: OdooReceivableClearingSummary = {
  readable: true,
  openReceivableKwd: -77462.759,
  grossPositiveReceivableKwd: 1804.295,
  creditClearingOffsetKwd: -79267.054,
  openLinesCount: 66570,
  posClearingLinesCount: 62766,
  platformAndCorporateLinesCount: 3804,
  fromDate: '2024-12-31',
  toDate: '2026-11-14',
  latestMaturityDate: '2026-07-03',
  sourceModel: 'account.move.line',
  agingBasis: 'open-debits-by-due-date',
  agingBuckets: [
    {
      key: '0_30',
      labelAr: '0–30 يوماً',
      labelEn: '0–30 days',
      residualKwd: 18.11,
      positiveDebitKwd: 18.11,
      creditOffsetKwd: 0,
      linesCount: 2,
    },
    {
      key: '31_60',
      labelAr: '31–60 يوماً',
      labelEn: '31–60 days',
      residualKwd: 88825.725,
      positiveDebitKwd: 88825.725,
      creditOffsetKwd: 0,
      linesCount: 510,
    },
    {
      key: 'over_60',
      labelAr: 'أكثر من 60 يوماً',
      labelEn: 'Over 60 days',
      residualKwd: 3733943.392,
      positiveDebitKwd: 3733943.392,
      creditOffsetKwd: 0,
      linesCount: 62254,
    },
  ],
  openDebitsKwd: 3822787.227,
  unappliedCreditsKwd: -3900249.986,
  unappliedCreditLinesCount: 3804,
  byAccount: [
    {
      accountId: 101,
      accountCode: '10552',
      accountName: '10552 Account Receivable (PoS)',
      labelAr: 'مقاصة نقاط البيع 10552',
      labelEn: 'Account Receivable (PoS)',
      residualKwd: -79267.054,
      linesCount: 62766,
    },
    {
      accountId: 102,
      accountCode: '10501',
      accountName: '10501 Talabat Receivable',
      labelAr: 'ذمم طلبات',
      labelEn: 'Talabat Receivable',
      residualKwd: 1804.295,
      linesCount: 3804,
    },
  ],
}

function buildSummaryWithReceivables(
  receivables: OdooReceivableClearingSummary,
): OdooLiveSummary {
  const emptyChannels = Object.fromEntries(
    APPROVED_CHANNEL_IDS.map((ch) => [ch, { netKwd: 100, orders: 20 }]),
  ) as Record<(typeof APPROVED_CHANNEL_IDS)[number], { netKwd: number; orders: number }>
  const bucket: OdooBucketSummary = {
    key: 'month',
    from: '2026-11-01',
    to: '2026-11-18',
    days: 17,
    totals: {
      netSalesKwd: 12500.5,
      orders: 2400,
      aovKwd: 5.209,
      restaurantNetKwd: 12500.5,
      restaurantOrders: 2400,
    },
    byLocation: Object.fromEntries(
      [...APPROVED_BRANCH_IDS, 'school-canteens'].map((br) => [
        br,
        { netKwd: 1562.562, orders: 300, uiChannels: emptyChannels },
      ]),
    ),
    mappedByLocation: Object.fromEntries(
      [...APPROVED_BRANCH_IDS, 'school-canteens'].map((br) => [
        br,
        { netKwd: 1562.562, orders: 300 },
      ]),
    ),
    byBrand: Object.fromEntries(
      APPROVED_BRAND_IDS.map((bid) => [bid, { netKwd: 2083.417, orders: 400, qty: 520 }]),
    ),
    uiChannels: emptyChannels,
    unattributedSalesKwd: 0,
    unattributedOrders: 0,
    accounting: {
      available: true,
      from: '2026-11-01',
      to: '2026-11-17',
      sourceModel: 'account.move.line',
      lineCount: 180,
      income: 12500.5,
      otherIncome: 0,
      totalRevenue: 12500.5,
      cogs: 3750,
      deliveryCommissions: 950,
      deliveryCommissionLinesCount: 14,
      expense: 2800,
      depreciation: 300,
      otherOpexAndDepreciation: 3100,
      operatingProfit: 4700.5,
      completeAccrualPosted: true,
      glIncomplete: false,
    },
  }

  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    syncedAt: '2026-11-17T11:25:00.000Z',
    lastSyncAt: '2026-11-17T11:25:00.000Z',
    latestRecordAt: '2026-11-17T11:20:00.000Z',
    latestOperationalDate: '2026-11-17',
    period: { from: '2026-11-01', to: '2026-11-17' },
    database: null,
    totals: { netSalesKwd: 12500.5, orders: 2400, aovKwd: 5.209 },
    brands: [],
    branches: [],
    channels: [],
    buckets: {
      today: { ...bucket, key: 'today', from: '2026-11-17', to: '2026-11-18', days: 1 },
      month: bucket,
    },
    dailySeries: [{ day: '2026-11-17', orders: 2400, netKwd: 12500.5 }],
    hourlySeries: [{ hour: 13, orders: 200, netKwd: 1050.25 }],
    aggregatorReceivables: structuredClone(receivables),
  }
}

function renderWithContext(locale: 'ar' | 'en', summary: OdooLiveSummary, node: React.ReactElement): string {
  const filters: GlobalFilters = { ...DEFAULT_GLOBAL_FILTERS, period: 'month' }
  mockGlobalFilterState.current = {
    filters,
    workspace: computeGlobalWorkspace(filters, summary, '/erp/receivables'),
    liveSummary: summary,
    isAuditor: false,
    sessionRole: 'admin',
    syncingOdoo: false,
    setPeriod: vi.fn(),
  } as unknown as GlobalFilterContextValue

  return renderToStaticMarkup(
    React.createElement(TypedLanguageProvider, { initialLocale: locale }, node),
  )
}

describe('Prompt A — Critical receivables honesty (prod 10552 clearing / negative net / 10x gross debits)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] })
    mockGlobalFilterState.current = null
    resetFeryalAuditCache()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('marks workspace receivables unavailable with empty buckets, null debit/credit splits, and exact bilingual reason on prod shape while keeping raw API payload intact', () => {
    const summary = buildSummaryWithReceivables(PROD_RECEIVABLES)
    const ws = computeGlobalWorkspace({ ...DEFAULT_GLOBAL_FILTERS, period: 'month' }, summary)

    // Raw API response is untouched
    expect(summary.aggregatorReceivables?.openReceivableKwd).toBe(-77462.759)
    expect(summary.aggregatorReceivables?.openDebitsKwd).toBe(3822787.227)
    expect(summary.aggregatorReceivables?.posClearingLinesCount).toBe(62766)

    // Workspace display model is unavailable with exact bilingual reason
    expect(ws.receivables.unavailable).toBe(true)
    expect(ws.receivables.agingBuckets).toEqual([])
    expect(ws.receivables.openDebitsKwd).toBeNull()
    expect(ws.receivables.unappliedCreditsKwd).toBeNull()
    expect(ws.receivables.agingHiddenReasonAr).toBe(REASON_AR)
    expect(ws.receivables.agingHiddenReasonEn).toBe(REASON_EN)

    // Verify each of the 3 trigger conditions independently
    // (a) posClearingLinesCount > 0 alone
    const posClearingOnly = computeGlobalWorkspace(
      DEFAULT_GLOBAL_FILTERS,
      buildSummaryWithReceivables({
        ...PROD_RECEIVABLES,
        openReceivableKwd: 1500,
        grossPositiveReceivableKwd: 1500,
        openDebitsKwd: 1500,
        unappliedCreditsKwd: 0,
        posClearingLinesCount: 1,
      }),
    )
    expect(posClearingOnly.receivables.unavailable).toBe(true)

    // (b) openReceivableKwd < 0 alone
    const negativeNetOnly = computeGlobalWorkspace(
      DEFAULT_GLOBAL_FILTERS,
      buildSummaryWithReceivables({
        ...PROD_RECEIVABLES,
        posClearingLinesCount: 0,
        openReceivableKwd: -0.001,
        grossPositiveReceivableKwd: 500,
        openDebitsKwd: 500,
        unappliedCreditsKwd: -500.001,
      }),
    )
    expect(negativeNetOnly.receivables.unavailable).toBe(true)

    // (c) openDebitsKwd > 10 * grossPositiveReceivableKwd alone
    const inflatedDebitsOnly = computeGlobalWorkspace(
      DEFAULT_GLOBAL_FILTERS,
      buildSummaryWithReceivables({
        ...PROD_RECEIVABLES,
        posClearingLinesCount: 0,
        openReceivableKwd: 200,
        grossPositiveReceivableKwd: 200,
        openDebitsKwd: 2001,
        unappliedCreditsKwd: -1801,
      }),
    )
    expect(inflatedDebitsOnly.receivables.unavailable).toBe(true)

    // Clean reconciled payload stays available
    const clean = computeGlobalWorkspace(
      DEFAULT_GLOBAL_FILTERS,
      buildSummaryWithReceivables({
        ...PROD_RECEIVABLES,
        posClearingLinesCount: 0,
        openReceivableKwd: 1804.295,
        grossPositiveReceivableKwd: 1804.295,
        creditClearingOffsetKwd: 0,
        openDebitsKwd: 1804.295,
        unappliedCreditsKwd: 0,
      }),
    )
    expect(clean.receivables.unavailable).toBe(false)
    expect(clean.receivables.openDebitsKwd).toBe(1804.295)
  })

  it('selectReceivablesHeadline returns all nulls on prod shape and Radar card renders calm unavailable state', () => {
    expect(selectReceivablesHeadline(PROD_RECEIVABLES)).toEqual({
      openDebitsKwd: null,
      unappliedCreditsKwd: null,
      netKwd: null,
      lines: null,
    })

    const summary = buildSummaryWithReceivables(PROD_RECEIVABLES)
    const ws = computeGlobalWorkspace(DEFAULT_GLOBAL_FILTERS, summary)
    expect(selectReceivablesHeadline(ws.receivables)).toEqual({
      openDebitsKwd: null,
      unappliedCreditsKwd: null,
      netKwd: null,
      lines: null,
    })

    const radarAr = renderWithContext('ar', summary, React.createElement(DeliveryRadarV5))
    expect(radarAr).not.toContain('77,462')
    expect(radarAr).not.toContain('3,822,787')
    expect(radarAr).not.toContain('3,900,249')
    expect(radarAr).not.toContain('3,733,943')
  })

  it('ReceivablesAgingStudio, VentureAccountingHub, and OdooAccountingAnalyticsHub render calm gray unavailable state with exact bilingual reason and zero red/amber or unverified numbers', () => {
    const summary = buildSummaryWithReceivables(PROD_RECEIVABLES)
    const bannedDigits = ['77,462', '3,822,787', '3,900,249', '3,733,943', '88,825', '62,766']

    // 1. ReceivablesAgingStudio (AR & EN)
    const agingAr = renderWithContext('ar', summary, React.createElement(ReceivablesAgingStudio))
    const agingEn = renderWithContext('en', summary, React.createElement(ReceivablesAgingStudio))
    expect(agingAr).toContain(REASON_AR)
    expect(agingEn).toContain(REASON_EN)
    for (const num of bannedDigits) {
      expect(agingAr).not.toContain(num)
      expect(agingEn).not.toContain(num)
    }
    expect(agingAr).not.toMatch(/\b(?:bg|text|ring)-(?:amber|rose|red)-\d/)
    expect(agingEn).not.toMatch(/\b(?:bg|text|ring)-(?:amber|rose|red)-\d/)

    // 2. VentureAccountingHub (receivables tab AR & EN)
    const ventureAr = renderWithContext(
      'ar',
      summary,
      React.createElement(VentureAccountingHub, { locale: 'ar', initialTab: 'receivables' }),
    )
    const ventureEn = renderWithContext(
      'en',
      summary,
      React.createElement(VentureAccountingHub, { locale: 'en', initialTab: 'receivables' }),
    )
    expect(ventureAr).toContain(REASON_AR)
    expect(ventureEn).toContain(REASON_EN)
    for (const num of bannedDigits) {
      expect(ventureAr).not.toContain(num)
      expect(ventureEn).not.toContain(num)
    }

    // 3. OdooAccountingAnalyticsHub (Net Open Receivables AR card in AR & EN)
    const glAr = renderWithContext(
      'ar',
      summary,
      React.createElement(OdooAccountingAnalyticsHub, { isAr: true, locale: 'ar' }),
    )
    const glEn = renderWithContext(
      'en',
      summary,
      React.createElement(OdooAccountingAnalyticsHub, { isAr: false, locale: 'en' }),
    )
    const glArCard = glAr.split('صافي الذمم المدينة المفتوحة')[1] ?? ''
    const glEnCard = glEn.split('Net Open Receivables (AR)')[1] ?? ''
    expect(glArCard).toContain(REASON_AR)
    expect(glEnCard).toContain(REASON_EN)
    for (const num of bannedDigits) {
      expect(glArCard).not.toContain(num)
      expect(glEnCard).not.toContain(num)
    }
    expect(glArCard).not.toMatch(/\b(?:bg|text|ring)-(?:amber|rose|red)-\d/)
    expect(glEnCard).not.toMatch(/\b(?:bg|text|ring)-(?:amber|rose|red)-\d/)
  })

  it('Feryal receivables tool returns finalizeNoData with exact Arabic reason and zero >= 1,000,000 or negative receivable numbers', async () => {
    const stubDataSource: FeryalOdooDataSource = {
      fetchPeriodCube: async () => null,
      fetchPurchaseOrders: async () => null,
      fetchWarehouseChain: async () => null,
      fetchReceivablesSummary: async () => structuredClone(PROD_RECEIVABLES),
      fetchBranchTopProducts: async () => [],
      fetchHrEmployees: async () => null,
    }

    const res = await askFeryalOdooAgent({
      question: 'كم رصيد الذمم المدينة المفتوحة وأعمار الديون؟',
      userSub: 'owner-test',
      userRole: 'admin',
      referenceNowMs: FIXTURE_NOW.getTime(),
      dataSource: stubDataSource,
      skipAuditLog: true,
    })

    expect(res.status).toBe('no_odoo_data')
    expect(res.reply).toContain(REASON_AR)
    expect(res.reply).not.toContain('77,462')
    expect(res.reply).not.toMatch(/-\s*\d/)

    const parsedNumbers = [...res.reply.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) =>
      Number(m[0].replace(/,/g, '')),
    )
    for (const n of parsedNumbers) {
      expect(n).toBeLessThan(1_000_000)
    }
  })
})
