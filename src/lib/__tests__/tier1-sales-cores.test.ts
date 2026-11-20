import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GLOBAL_FILTERS,
  computeGlobalWorkspace,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import type {
  OdooBucketSummary,
  OdooLiveSummary,
} from '@/lib/odoo/live-sync-core'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import {
  resolveBestBranchBadge,
  sanitizeCampaignName,
} from '@/lib/aether/period-delta'
import {
  computeErpComparison,
  resolveCompletedComparisonDefaults,
} from '@/lib/erp-comparison-engine'

type GlobalFilterContextValue = ReturnType<
  typeof import('@/components/aether/GlobalFilterContext').useGlobalFilter
>

const mockGlobalFilterState: { current: GlobalFilterContextValue | null } = {
  current: null,
}

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp/cores',
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

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => {
    if (!mockGlobalFilterState.current) {
      throw new Error('mockGlobalFilterState.current must be initialized in test')
    }
    return mockGlobalFilterState.current
  },
}))

import { LanguageProvider } from '@/lib/i18n'
import { CoresHubStudio } from '@/components/aether/CoresHubStudio'
import { BrandSalesAnalyticsDashboard } from '@/modules/brand-sales-analytics/ui/BrandSalesAnalyticsDashboard'
import { DeliveryRadarV5 } from '@/components/aether/DeliveryRadarV5'
import { WeekdayComparisonStudio } from '@/components/erp/ops-expansion/WeekdayComparisonStudio'
import { BeforeAfterStudio } from '@/components/aether/BeforeAfterStudio'
import { ExecutiveComparisonControlBar } from '@/components/erp/ExecutiveComparisonControlBar'
import {
  BeforeAfterDualBarChart,
  InteractiveDonutChart,
  InteractiveHorizontalRankList,
  InteractiveHoverBarChart,
} from '@/components/aether/InteractiveHoverCharts'

const LanguageProviderComponent = LanguageProvider as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

const CoresHubStudioComponent = CoresHubStudio as React.ComponentType<{
  initialTab?: 'marketing' | 'sales' | 'menu'
  initialLiveCube?: Parameters<typeof CoresHubStudio>[0] extends infer P
    ? P extends { initialLiveCube?: infer C }
      ? C
      : never
    : never
}>

const TEST_PERIOD = { from: '2026-11-01', to: '2026-11-15' }

const CHANNEL_KEYS = [
  'dine-in',
  'takeaway-direct',
  'talabat-tgo',
  'talabat-tmp',
  'keeta',
  'deliveroo',
  'jahez',
  'snoonu',
] as const

const BRANCH_KEYS = [
  'avenues',
  '360-mall',
  'assima',
  'promenade',
  'salmiya',
  'al-kout',
  'ardiya',
  'school-canteens',
] as const

const BRAND_KEYS = [
  'china-garden',
  'franks',
  'tahina',
  'farm-brown',
  'noodle-bar',
  'karak-cafeteria',
] as const

function buildChannelMap(scale = 1): Record<(typeof CHANNEL_KEYS)[number], { netKwd: number; orders: number }> {
  return {
    'dine-in': { netKwd: Number((1250.125 * scale).toFixed(3)), orders: Math.round(320 * scale) },
    'takeaway-direct': { netKwd: Number((840.25 * scale).toFixed(3)), orders: Math.round(240 * scale) },
    'talabat-tgo': { netKwd: Number((1420.375 * scale).toFixed(3)), orders: Math.round(390 * scale) },
    'talabat-tmp': { netKwd: Number((510.125 * scale).toFixed(3)), orders: Math.round(145 * scale) },
    keeta: { netKwd: Number((620.5 * scale).toFixed(3)), orders: Math.round(180 * scale) },
    deliveroo: { netKwd: Number((715.25 * scale).toFixed(3)), orders: Math.round(195 * scale) },
    jahez: { netKwd: Number((310.125 * scale).toFixed(3)), orders: Math.round(90 * scale) },
    snoonu: { netKwd: Number((225.375 * scale).toFixed(3)), orders: Math.round(70 * scale) },
  }
}

function buildBucket(scale = 1): OdooBucketSummary {
  const uiChannels = buildChannelMap(scale)
  const totalNet = Number(
    Object.values(uiChannels)
      .reduce((sum, item) => sum + item.netKwd, 0)
      .toFixed(3),
  )
  const totalOrders = Object.values(uiChannels).reduce((sum, item) => sum + item.orders, 0)

  const byBrand: NonNullable<OdooBucketSummary['byBrand']> = {
    'china-garden': { netKwd: Number((totalNet * 0.28).toFixed(3)), orders: Math.round(totalOrders * 0.25), qty: 410 },
    franks: { netKwd: Number((totalNet * 0.19).toFixed(3)), orders: Math.round(totalOrders * 0.2), qty: 320 },
    tahina: { netKwd: Number((totalNet * 0.17).toFixed(3)), orders: Math.round(totalOrders * 0.18), qty: 280 },
    'farm-brown': { netKwd: Number((totalNet * 0.14).toFixed(3)), orders: Math.round(totalOrders * 0.14), qty: 210 },
    'noodle-bar': { netKwd: Number((totalNet * 0.12).toFixed(3)), orders: Math.round(totalOrders * 0.12), qty: 190 },
    'karak-cafeteria': { netKwd: Number((totalNet * 0.1).toFixed(3)), orders: Math.round(totalOrders * 0.11), qty: 260 },
  }

  const branchWeights: Record<(typeof BRANCH_KEYS)[number], number> = {
    avenues: 0.24,
    '360-mall': 0.18,
    assima: 0.15,
    promenade: 0.12,
    salmiya: 0.11,
    'al-kout': 0.1,
    ardiya: 0.06,
    'school-canteens': 0.04,
  }

  const byLocation: NonNullable<OdooBucketSummary['byLocation']> = {}
  for (const branchId of BRANCH_KEYS) {
    const w = branchWeights[branchId]
    byLocation[branchId] = {
      netKwd: Number((totalNet * w).toFixed(3)),
      orders: Math.round(totalOrders * w),
      uiChannels: buildChannelMap(scale * w),
    }
  }

  return {
    key: 'month',
    from: TEST_PERIOD.from,
    to: TEST_PERIOD.to,
    days: 15,
    totals: {
      netSalesKwd: totalNet,
      orders: totalOrders,
      aovKwd: totalOrders > 0 ? Number((totalNet / totalOrders).toFixed(3)) : 0,
      restaurantNetKwd: Number((totalNet * 0.96).toFixed(3)),
      restaurantOrders: Math.round(totalOrders * 0.96),
    },
    byBrand,
    byLocation,
    uiChannels,
    unattributedSalesKwd: 142.375,
    unattributedOrders: 38,
    unattributedBranch: {
      id: 'unattributed',
      labelAr: 'غير منسوب لفرع',
      labelEn: 'Unattributed to Branch',
      netSalesKwd: 142.375,
      orders: 38,
      sharePct: 2.4,
    },
    accounting: {
      available: true,
      from: TEST_PERIOD.from,
      to: TEST_PERIOD.to,
      sourceModel: 'account.move.line',
      lineCount: 185,
      income: totalNet,
      otherIncome: 0,
      totalRevenue: totalNet,
      cogs: Number((totalNet * 0.31).toFixed(3)),
      deliveryCommissions: Number((totalNet * 0.085).toFixed(3)),
      deliveryCommissionLinesCount: 14,
      expense: Number((totalNet * 0.21).toFixed(3)),
      depreciation: Number((totalNet * 0.03).toFixed(3)),
      otherOpexAndDepreciation: Number((totalNet * 0.24).toFixed(3)),
      operatingProfit: Number((totalNet * 0.365).toFixed(3)),
      completeAccrualPosted: true,
      glIncomplete: false,
      aggregatorCommissionUnposted: false,
    },
  }
}

function buildLiveSummary(overrides: Partial<OdooLiveSummary> = {}): OdooLiveSummary {
  const monthBucket = buildBucket(4)
  const netSalesKwd = monthBucket.totals.netSalesKwd ?? 0
  const orders = monthBucket.totals.orders ?? 0
  const aovKwd = monthBucket.totals.aovKwd ?? 0

  const dailySeries = [
    { day: '2026-11-10', orders: 410, netKwd: 1485.125 },
    { day: '2026-11-11', orders: 430, netKwd: 1560.375 },
    { day: '2026-11-12', orders: 465, netKwd: 1690.5 },
    { day: '2026-11-13', orders: 520, netKwd: 1945.25 },
    { day: '2026-11-14', orders: 540, netKwd: 2015.875 },
    { day: '2026-11-15', orders: 495, netKwd: 1812.345 },
  ]

  const hourlySeries = [
    { hour: 12, orders: 310, netKwd: 1120.25 },
    { hour: 13, orders: 420, netKwd: 1545.375 },
    { hour: 15, orders: 215, netKwd: 742.125 },
    { hour: 16, orders: 198, netKwd: 688.5 },
    { hour: 17, orders: 224, netKwd: 790.25 },
    { hour: 20, orders: 560, netKwd: 2145.625 },
  ]

  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    partial: false,
    unavailableSections: [],
    syncedAt: '2026-11-15T18:30:00.000Z',
    latestRecordAt: '2026-11-15T18:30:00.000Z',
    latestOdooRecordAt: '2026-11-15T21:30:00+03:00',
    latestOperationalDate: '2026-11-15',
    kuwaitSyncedAt: '2026-11-15 21:30 (Asia/Kuwait)',
    period: TEST_PERIOD,
    database: null,
    totals: {
      netSalesKwd,
      orders,
      aovKwd,
    },
    unattributedSalesKwd: monthBucket.unattributedSalesKwd ?? null,
    unattributedOrders: monthBucket.unattributedOrders ?? null,
    unattributedBranch: monthBucket.unattributedBranch ?? null,
    brands: [
      { id: 'china-garden', brand: 'China Garden', netKwd: monthBucket.byBrand!['china-garden'].netKwd, sharePct: 28 },
      { id: 'franks', brand: 'Franks', netKwd: monthBucket.byBrand!.franks.netKwd, sharePct: 19 },
      { id: 'tahina', brand: 'Tahina', netKwd: monthBucket.byBrand!.tahina.netKwd, sharePct: 17 },
      { id: 'farm-brown', brand: 'Farm Brown', netKwd: monthBucket.byBrand!['farm-brown'].netKwd, sharePct: 14 },
      { id: 'noodle-bar', brand: 'Noodle Bar', netKwd: monthBucket.byBrand!['noodle-bar'].netKwd, sharePct: 12 },
      { id: 'karak-cafeteria', brand: 'Karak Cafeteria', netKwd: monthBucket.byBrand!['karak-cafeteria'].netKwd, sharePct: 10 },
    ],
    branches: BRANCH_KEYS.map((id) => ({
      id,
      name: id,
      unit: 'Venture Foods',
      netSalesKwd: monthBucket.byLocation![id].netKwd,
      orders: monthBucket.byLocation![id].orders,
      sharePct: 12.5,
    })),
    channels: CHANNEL_KEYS.map((key) => ({
      name: key,
      amountKwd: monthBucket.uiChannels![key].netKwd,
    })),
    buckets: {
      month: monthBucket,
    },
    dailySeries,
    hourlySeries,
    aggregatorReceivables: {
      readable: true,
      openReceivableKwd: 6420.375,
      openLinesCount: 29,
      fromDate: TEST_PERIOD.from,
      toDate: TEST_PERIOD.to,
      byAccount: [
        {
          accountId: 401,
          accountCode: '121200',
          accountName: 'Talabat Clearing',
          labelAr: 'ذمم طلبات',
          labelEn: 'Talabat Clearing',
          residualKwd: 3820.25,
          linesCount: 16,
        },
      ],
    },
    journeyPulse: {
      rolling30: {
        from: '2026-10-17',
        to: '2026-11-15',
        days: 30,
        netKwd: 45123.456,
        orders: 12450,
        perDayKwd: 1504.115,
      },
      prior30: {
        from: '2026-09-17',
        to: '2026-10-16',
        days: 30,
        netKwd: 42100.125,
        orders: 11800,
        perDayKwd: 1403.338,
      },
      mtd: {
        from: '2026-11-01',
        to: '2026-11-15',
        days: 15,
        netKwd: netSalesKwd,
        orders,
        perDayKwd: Number((netSalesKwd / 15).toFixed(3)),
      },
    },
    ...overrides,
  }
}

function buildLiveCube(overrides: Partial<OdooPeriodCube> = {}): OdooPeriodCube {
  const bucket = buildBucket(4)
  const totalNet = bucket.totals.netSalesKwd ?? 0
  const totalOrders = bucket.totals.orders ?? 0

  const byBranch = {} as OdooPeriodCube['byBranch']
  for (const branchId of BRANCH_KEYS) {
    const loc = bucket.byLocation![branchId]
    const bChannels = (loc.uiChannels ?? buildChannelMap(0.5)) as Record<
      (typeof CHANNEL_KEYS)[number],
      { netKwd: number; orders: number }
    >
    byBranch[branchId] = {
      netKwd: loc.netKwd,
      orders: loc.orders,
      aovKwd: loc.orders > 0 ? Number((loc.netKwd / loc.orders).toFixed(3)) : 0,
      channels: bChannels,
    }
  }

  const byBrand = {} as OdooPeriodCube['byBrand']
  for (const brandId of BRAND_KEYS) {
    const b = bucket.byBrand![brandId]
    byBrand[brandId] = {
      netKwd: b.netKwd,
      qty: b.qty ?? 100,
      linesCount: b.orders ?? 0,
      orders: b.orders,
      avgDiscountPct: 2.5,
      discountKwd: Number((b.netKwd * 0.025).toFixed(3)),
    }
  }

  const brandByBranch: OdooPeriodCube['brandByBranch'] = {}
  for (const branchId of BRANCH_KEYS) {
    brandByBranch[branchId] = {} as OdooPeriodCube['brandByBranch'][string]
    for (const brandId of BRAND_KEYS) {
      brandByBranch[branchId][brandId] = {
        netKwd: Number((byBrand[brandId].netKwd / 8).toFixed(3)),
        qty: Math.round(byBrand[brandId].qty / 8),
        linesCount: Math.round((byBrand[brandId].orders ?? 0) / 8),
        avgDiscountPct: 2.5,
        discountKwd: Number((byBrand[brandId].discountKwd / 8).toFixed(3)),
      }
    }
  }

  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    odooCompanyId: 1,
    lastSyncAt: '2026-11-15T18:30:00.000Z',
    isStale24h: false,
    dateRange: TEST_PERIOD,
    days: 15,
    totals: {
      netSalesKwd: totalNet,
      orders: totalOrders,
      aovKwd: totalOrders > 0 ? Number((totalNet / totalOrders).toFixed(3)) : 0,
      mappedBranchesNetKwd: Number((totalNet - 142.375).toFixed(3)),
      mappedBranchesOrders: Math.max(0, totalOrders - 38),
      unattributedSalesKwd: 142.375,
      unattributedOrders: 38,
      excludedEntitiesKwd: 0,
      excludedEntitiesOrders: 0,
      totalDiscountKwd: Number((totalNet * 0.025).toFixed(3)),
      avgDiscountPct: 2.5,
      discountedLinesCount: 120,
    },
    byBranch,
    unattributed: {
      id: 'unattributed',
      labelAr: 'غير منسوب لفرع',
      labelEn: 'Unattributed to Branch',
      netKwd: 142.375,
      orders: 38,
      aovKwd: 3.747,
      channels: buildChannelMap(0.02),
    },
    byBrand,
    brandByBranch,
    byChannel: (bucket.uiChannels ?? buildChannelMap(4)) as OdooPeriodCube['byChannel'],
    dailySeries: [
      {
        day: '2026-11-14',
        orders: 540,
        netKwd: 2015.875,
        unattributedNetKwd: 45.125,
        unattributedOrders: 12,
      },
      {
        day: '2026-11-15',
        orders: 495,
        netKwd: 1812.345,
        unattributedNetKwd: 38.25,
        unattributedOrders: 10,
      },
    ],
    dailyByBranch: {},
    dailyUnattributed: {},
    hourlySeries: [
      { hour: 12, orders: 310, netKwd: 1120.25 },
      { hour: 15, orders: 215, netKwd: 742.125 },
      { hour: 16, orders: 198, netKwd: 688.5 },
      { hour: 17, orders: 224, netKwd: 790.25 },
      { hour: 20, orders: 560, netKwd: 2145.625 },
    ],
    hourlyByBranch: {},
    topProducts: [
      {
        productId: 901,
        name: 'Sweet & Sour Chicken Combo',
        brandId: 'china-garden',
        netKwd: 4820.125,
        qty: 960,
        linesCount: 920,
        avgDiscountPct: 1.5,
        discountKwd: 72.3,
      },
      {
        productId: 902,
        name: 'Tahina Signature Box',
        brandId: 'tahina',
        netKwd: 3210.375,
        qty: 710,
        linesCount: 690,
        avgDiscountPct: 2.1,
        discountKwd: 67.418,
      },
    ],
    accounting: bucket.accounting ?? undefined,
    ...overrides,
  }
}

function setMockFilterContext(options: {
  filters?: Partial<GlobalFilters>
  liveSummary: OdooLiveSummary | null
  liveCube?: OdooPeriodCube | null
  cubeLoading?: boolean
  cubeError?: string | null
}) {
  const filters: Required<GlobalFilters> = {
    ...DEFAULT_GLOBAL_FILTERS,
    ...options.filters,
  }
  const workspace = computeGlobalWorkspace(filters, options.liveSummary, '/erp/cores')

  mockGlobalFilterState.current = {
    filters,
    setFilters: vi.fn(),
    updateFilter: vi.fn(),
    resetFilters: vi.fn(),
    toggleBrand: vi.fn(),
    toggleBranch: vi.fn(),
    toggleChannel: vi.fn(),
    setPeriod: vi.fn(),
    setCustomRange: vi.fn(),
    setKuwaitSlice: vi.fn(),
    setLens: vi.fn(),
    workspace,
    liveSummary: options.liveSummary,
    liveSource: options.liveSummary?.source ?? 'disconnected',
    liveSyncedAt: options.liveSummary?.syncedAt ?? null,
    refreshLiveSummary: vi.fn(async () => {}),
    isSyncingLive: false,
    manualSyncNow: vi.fn(async () => ({ ok: true })),
    liveCube: options.liveCube ?? null,
    cubeLoading: options.cubeLoading ?? false,
    cubeError: options.cubeError ?? null,
    retryCube: vi.fn(),
    sameHoursLikeForLike: false,
    setSameHoursLikeForLike: vi.fn(),
  } as unknown as GlobalFilterContextValue
}

function renderWithLang(locale: 'ar' | 'en', element: React.ReactElement): string {
  return renderToStaticMarkup(
    React.createElement(LanguageProviderComponent, { initialLocale: locale }, element),
  )
}

beforeEach(() => {
  mockGlobalFilterState.current = null
})

describe('Tier 1 Sales, Cores, Brand, Radar, Weekday & Before/After Phase B Audit', () => {
  it('/erp/cores, /erp/sales-analysis & /erp/menu-engineering render 3-decimal KWD, loading/empty/partial states, and null -> "—" + "غير متاح"', () => {
    const liveSummary = buildLiveSummary()
    const liveCube = buildLiveCube()

    // 1. Loading skeleton when liveSummary === null
    setMockFilterContext({ liveSummary: null, liveCube: null, cubeLoading: true })
    const loadingHtmlAr = renderWithLang(
      'ar',
      React.createElement(CoresHubStudioComponent, { initialTab: 'sales' }),
    )
    expect(loadingHtmlAr).toContain('role="status"')
    expect(loadingHtmlAr).not.toContain('<h1')

    // 2. Empty state when disconnected / noData
    setMockFilterContext({
      liveSummary: buildLiveSummary({ connected: false, source: 'disconnected', noData: true }),
      liveCube: null,
    })
    const emptyHtmlEn = renderWithLang(
      'en',
      React.createElement(CoresHubStudioComponent, { initialTab: 'sales' }),
    )
    expect(emptyHtmlEn).toContain('No data from Odoo for this period')

    // 3. Connected live snapshot in Sales tab (strict 3-decimal KWD, AR + EN)
    setMockFilterContext({ liveSummary, liveCube })
    // Phase 5 · Item 1: hourly buckets come only from the selected-period cube (never the summary's
    // month-to-date hourly series), so the cube is handed to the studio explicitly.
    const salesAr = renderWithLang(
      'ar',
      React.createElement(CoresHubStudioComponent, { initialTab: 'sales', initialLiveCube: liveCube }),
    )
    expect(salesAr).toContain('23,568.500')
    // This fixture's hourly rows (Σ 5,486.750) do not add up to its period total (23,568.500), so the
    // hourly section is unavailable and no peak (2,145.625) is shown — hourly must reconcile.
    expect(salesAr).not.toContain('2,145.625')
    expect(salesAr).toContain('data-hourly-unavailable="true"')
    // 2,220.875 is the 3–6 PM sum of the same non-reconciling hourly rows → also withheld.
    expect(salesAr).not.toContain('2,220.875')
    expect(salesAr).toContain('5,656.440')
    expect(salesAr).toContain('dir="ltr"')

    // 4. Menu tab with partial null (unavailableSections includes 'products') -> "غير متاح" + "—"
    setMockFilterContext({
      liveSummary: buildLiveSummary({ partial: true, unavailableSections: ['products'] }),
      liveCube: buildLiveCube({ topProducts: [] }),
    })
    const menuPartialAr = renderWithLang(
      'ar',
      React.createElement(CoresHubStudioComponent, { initialTab: 'menu' }),
    )
    expect(menuPartialAr).not.toContain('بعض الأرقام غير متاحة الآن')
    expect(menuPartialAr).toContain('data-state-block="unavailable"')
    expect(menuPartialAr).toContain('غير متاح')
    expect(menuPartialAr).toContain('—')

    // 5. Marketing tab null-honesty when cube missing & campaign label preservation
    setMockFilterContext({
      liveSummary: buildLiveSummary({ partial: true, unavailableSections: ['brands.month'] }),
      liveCube: null,
      cubeError: 'Odoo period cube upstream timeout (https://secret.example/jsonrpc)',
    })
    const mktEn = renderWithLang(
      'en',
      React.createElement(CoresHubStudioComponent, { initialTab: 'marketing' }),
    )
    expect(mktEn).not.toContain('Some figures are temporarily unavailable')
    expect(mktEn).toContain('data-state-block="unavailable"')
    expect(mktEn).not.toContain('https://secret.example')
    expect(sanitizeCampaignName(null, true)).toBe('بدون حملة')
    expect(sanitizeCampaignName('', false)).toBe('No campaign')
  })

  it('/erp/brand-sales-analytics renders live 6-brand table, 3-decimal KWD, partial warning, loading/empty & null-honesty', () => {
    setMockFilterContext({ liveSummary: null, liveCube: null, cubeLoading: true })
    const loadingEn = renderWithLang('en', React.createElement(BrandSalesAnalyticsDashboard))
    expect(loadingEn).toContain('role="status"')
    expect(loadingEn).not.toContain('<h1')

    setMockFilterContext({
      liveSummary: buildLiveSummary({ connected: false, source: 'disconnected', noData: true }),
      liveCube: null,
    })
    const emptyAr = renderWithLang('ar', React.createElement(BrandSalesAnalyticsDashboard))
    expect(emptyAr).toContain('لا توجد بيانات من Odoo لهذه الفترة')

    const partialBrandsBucket = buildBucket(4)
    partialBrandsBucket.byBrand = null
    setMockFilterContext({
      liveSummary: buildLiveSummary({
        partial: true,
        unavailableSections: ['brands.month'],
        brands: null,
        buckets: { month: partialBrandsBucket },
      }),
      liveCube: null,
    })
    const partialEn = renderWithLang('en', React.createElement(BrandSalesAnalyticsDashboard))
    expect(partialEn).not.toContain('Some figures are temporarily unavailable')
    expect(partialEn).toContain('data-unavailable="true"')
    expect(partialEn).toContain('Unavailable')
    expect(partialEn).toContain('—')

    setMockFilterContext({ liveSummary: buildLiveSummary(), liveCube: buildLiveCube() })
    const connectedEn = renderWithLang('en', React.createElement(BrandSalesAnalyticsDashboard))
    expect(connectedEn).toContain('China Garden')
    expect(connectedEn).toContain('6,599.180')
    expect(connectedEn).toContain('KWD')
  })

  it('/erp/aggregator-radar renders 3-decimal KWD, null -> "—" / "غير متاح", AR/EN unattributed + unposted commission', () => {
    setMockFilterContext({ liveSummary: null, liveCube: null, cubeLoading: true })
    const loadingHtml = renderWithLang('ar', React.createElement(DeliveryRadarV5))
    expect(loadingHtml).toContain('role="status"')
    expect(loadingHtml).not.toContain('<h1')

    setMockFilterContext({
      liveSummary: buildLiveSummary({ connected: false, source: 'disconnected', noData: true }),
      liveCube: null,
    })
    const disconnectedEn = renderWithLang('en', React.createElement(DeliveryRadarV5))
    expect(disconnectedEn).toContain('No data from Odoo for this period')

    // Partial with channels.month unavailable & unattributed must NOT coerce null to 0.000
    const bucketWithNullChannels = buildBucket(4)
    bucketWithNullChannels.uiChannels = null
    for (const branchId of BRANCH_KEYS) {
      if (bucketWithNullChannels.byLocation?.[branchId]) {
        bucketWithNullChannels.byLocation[branchId].uiChannels = null
      }
    }
    setMockFilterContext({
      liveSummary: buildLiveSummary({
        partial: true,
        unavailableSections: ['channels.month', 'receivables'],
        buckets: { month: bucketWithNullChannels },
        aggregatorReceivables: null,
      }),
      liveCube: null,
    })
    const partialEn = renderWithLang('en', React.createElement(DeliveryRadarV5))
    expect(partialEn).not.toContain('Some figures are temporarily unavailable')
    expect(partialEn).toContain('Unattributed to Branch')
    expect(partialEn).toContain('Unavailable')
    expect(partialEn).toContain('—')

    const partialAr = renderWithLang('ar', React.createElement(DeliveryRadarV5))
    expect(partialAr).toContain('غير منسوب لفرع')
    expect(partialAr).toContain('غير متاح')
    expect(partialAr).not.toContain('بعض الأرقام غير متاحة الآن')

    setMockFilterContext({ liveSummary: buildLiveSummary(), liveCube: buildLiveCube() })
    const connectedEn = renderWithLang('en', React.createElement(DeliveryRadarV5))
    expect(connectedEn).toContain('KWD')
    expect(connectedEn).toContain('6,420.375')
    expect(connectedEn).not.toContain('Pending Accounting Reconciliation')
    expect(connectedEn).not.toMatch(/overdue/i)
  })

  it('/erp/weekday-comparison, /erp/before-after & control bar render honest states, AR/EN copy, 3-decimal KWD & Least Decline badge', () => {
    setMockFilterContext({
      liveSummary: buildLiveSummary({ partial: true, unavailableSections: ['hourly'] }),
      liveCube: buildLiveCube(),
    })

    const weekdayAr = renderWithLang('ar', React.createElement(WeekdayComparisonStudio))
    expect(weekdayAr).toContain('role="status"')
    expect(weekdayAr).not.toContain('بعض الأرقام غير متاحة الآن')
    expect(weekdayAr).not.toContain('<h1')

    const beforeAfterEn = renderWithLang('en', React.createElement(BeforeAfterStudio))
    expect(beforeAfterEn).toContain('role="status"')
    expect(beforeAfterEn).not.toContain('Some figures are temporarily unavailable')
    expect(beforeAfterEn).not.toContain('<h1')

    // Verify pure Arabic copy inside Same-Hours bar on ExecutiveComparisonControlBar
    const defaults = resolveCompletedComparisonDefaults({
      sameHoursLikeForLike: true,
      referenceNowMs: Date.parse('2026-11-15T12:45:00Z'),
    })
    const barAr = renderWithLang(
      'ar',
      React.createElement(ExecutiveComparisonControlBar, {
        query: {
          mode: 'date-vs-date',
          granularity: 'single',
          periodA: defaults.periodA,
          periodB: defaults.periodB,
          brandIds: 'all',
          branchIds: 'all',
          channelIds: 'all',
          sameHoursLikeForLike: true,
        },
        onQueryChange: vi.fn(),
        odooGap: { connected: true, gapKwd: 12.345 },
      }),
    )
    expect(barAr).toContain('عبر الفترتين')
    expect(barAr).toContain('12.345')
    expect(barAr).not.toContain('Comparing 00:00')

    // Verify Least Decline / أقل تراجع semantics on negative deltas
    const declineBadge = resolveBestBranchBadge(-125.5)
    expect(declineBadge.labelEn).toContain('Least Decline')
    expect(declineBadge.labelAr).toContain('أقل تراجع')

    // Verify computeErpComparison handles identical cubes cleanly without fake deltas
    const cubeA = buildLiveCube()
    const cubeB = buildLiveCube()
    const cmp = computeErpComparison(
      {
        mode: 'date-vs-date',
        granularity: 'range',
        periodA: { from: '2026-11-08', to: '2026-11-14' },
        periodB: { from: '2026-11-01', to: '2026-11-07' },
        brandIds: 'all',
        branchIds: 'all',
        channelIds: 'all',
      },
      { cubeA, cubeB, liveSummary: buildLiveSummary() },
    )
    expect(cmp.connected).toBe(true)
    expect(cmp.byBranch.length).toBeGreaterThan(0)
  })

  it('InteractiveHoverCharts render 3-decimal KWD labels, axis units, role="img" & RTL numeric islands', () => {
    const dualHtml = renderWithLang(
      'ar',
      React.createElement(BeforeAfterDualBarChart, {
        data: [
          {
            id: 'sat',
            label: 'السبت',
            tooltipTitle: 'السبت',
            before: 1100.125,
            after: 1234.567,
            beforeFormatted: '1,100.125 د.ك',
            afterFormatted: '1,234.567 د.ك',
            diffFormatted: '+134.442 د.ك',
            pctFormatted: '+12.2%',
          },
        ],
        beforeLegend: 'الفترة ب',
        afterLegend: 'الفترة أ',
        formatAxisValue: (v: number) =>
          `${v.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} د.ك`,
        title: 'مقارنة الأيام',
        periodLabel: '2026-11-01 — 2026-11-15',
        unitLabel: 'د.ك',
        yAxisLabel: 'د.ك',
        xAxisLabel: 'اليوم',
        isAr: true,
      }),
    )
    expect(dualHtml).toContain('role="region"')
    expect(dualHtml).toContain('data-chart-axis-y="true"')
    expect(dualHtml).toContain('data-chart-axis-x="true"')
    expect(dualHtml).toContain('1,234.567')
    expect(dualHtml).toContain('2026-11-01 — 2026-11-15')

    const barHtml = renderWithLang(
      'en',
      React.createElement(InteractiveHoverBarChart, {
        data: [
          {
            id: 'h12',
            label: '12:00',
            tooltipTitle: '12:00',
            primaryValue: 456.789,
            lines: [{ label: 'Net Sales', value: '456.789 KWD', tone: 'neutral' }],
          },
        ],
        isAr: false,
        primaryLegend: 'Net Sales',
        unitLabel: 'KWD',
        yAxisLabel: 'KWD',
        xAxisLabel: 'Hour',
        periodLabel: '2026-11-01 — 2026-11-15',
        formatAxisValue: (v: number) => `${v.toFixed(3)} KWD`,
      }),
    )
    expect(barHtml).toContain('role="region"')
    expect(barHtml).toContain('data-chart-axis-y="true"')
    expect(barHtml).toContain('data-chart-axis-x="true"')
    expect(barHtml).toContain('Hour')
    expect(barHtml).toContain('KWD')

    const donutHtml = renderWithLang(
      'en',
      React.createElement(InteractiveDonutChart, {
        slices: [
          {
            id: 'china-garden',
            label: 'China Garden',
            value: 1234.567,
            valueFormatted: '1,234.567 KWD',
            pctFormatted: '60.0%',
            color: '#0ea5e9',
          },
          {
            id: 'franks',
            label: 'Franks',
            value: 823.045,
            valueFormatted: '823.045 KWD',
            pctFormatted: '40.0%',
            color: '#8b5cf6',
          },
        ],
        centerValue: '2,057.612 KWD',
        centerLabel: 'Net Sales',
        isAr: false,
      }),
    )
    expect(donutHtml).toContain('role="img"')
    expect(donutHtml).toContain('2,057.612 KWD')
    expect(donutHtml).toContain('1,234.567 KWD')

    const rankHtml = renderWithLang(
      'ar',
      React.createElement(InteractiveHorizontalRankList, {
        items: [
          {
            id: 'talabat-tgo',
            label: 'Talabat TGO',
            value: 2345.678,
            valueFormatted: '2,345.678 د.ك',
            lines: [{ label: 'Talabat TGO', value: '2,345.678 د.ك', tone: 'neutral' }],
          },
        ],
        isAr: true,
      }),
    )
    expect(rankHtml).toContain('2,345.678 د.ك')
    expect(rankHtml).toContain('dir="ltr"')
  })

  it('Static guardrails pass across all 14 Tier-1 Sales & Cores owned files', () => {
    const root = process.cwd()
    const pageFiles = [
      'src/app/erp/cores/page.tsx',
      'src/app/erp/sales-analysis/page.tsx',
      'src/app/erp/menu-engineering/page.tsx',
      'src/app/erp/brand-sales-analytics/page.tsx',
      'src/app/erp/weekday-comparison/page.tsx',
      'src/app/erp/before-after/page.tsx',
      'src/app/erp/aggregator-radar/page.tsx',
    ]
    const studioFiles = [
      'src/components/aether/CoresHubStudio.tsx',
      'src/components/aether/InteractiveHoverCharts.tsx',
      'src/modules/brand-sales-analytics/ui/BrandSalesAnalyticsDashboard.tsx',
      'src/components/erp/ops-expansion/WeekdayComparisonStudio.tsx',
      'src/components/erp/ExecutiveComparisonControlBar.tsx',
      'src/components/aether/BeforeAfterStudio.tsx',
      'src/components/aether/DeliveryRadarV5.tsx',
    ]

    for (const rel of [...pageFiles, ...studioFiles]) {
      const text = fs.readFileSync(path.join(root, rel), 'utf8')
      expect(text, `${rel} must have zero sub-12px font classes`).not.toMatch(
        /text-\[(?:10|10\.5|11|11\.5)px\]/,
      )
      expect(text, `${rel} must have zero placeholder croissant/avocado`).not.toMatch(
        /croissant|avocado|كرواسون|أفوكادو/i,
      )
      expect(text, `${rel} must have zero console.*`).not.toMatch(/\bconsole\.(?:log|debug|info|warn|error)\b/)
      expect(text, `${rel} must have zero explicit any`).not.toMatch(/:\s*any\b|\bas\s+any\b|<any>/)
      expect(text, `${rel} must have zero @ts-ignore`).not.toContain('@ts-ignore')

      const classMatches = text.matchAll(/className=["'`]([^"'`]+)["'`]/g)
      for (const m of classMatches) {
        const cls = m[1]
        const hasFlexMulti = /\bflex-wrap\b/.test(cls) || /\bflex-col\b/.test(cls)
        const hasRoundedFull = /\brounded-full\b/.test(cls)
        expect(
          hasFlexMulti && hasRoundedFull,
          `${rel} must not combine flex-wrap/flex-col with rounded-full (${cls})`,
        ).toBe(false)
      }
    }

    for (const rel of studioFiles) {
      const text = fs.readFileSync(path.join(root, rel), 'utf8')
      expect(text, `${rel} must have zero <h1> tags inside child studio`).not.toMatch(/<h1[\s>]/)
    }
  })
})
