import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import posRegistry from '@/lib/odoo/pos-registry.json'
import type { OdooBucketSummary, OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import { resolveBestBranchBadge } from '@/lib/aether/period-delta'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  DEFAULT_GLOBAL_FILTERS,
  computeGlobalWorkspace,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import {
  computeErpComparison,
  normalizeComparisonQueryWindows,
  type ErpComparisonQuery,
} from '@/lib/erp-comparison-engine'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import { selectCubeHeadline } from '@/lib/aether/period-cube-headline'

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
      throw new Error('mockGlobalFilterState.current must be initialized')
    }
    return mockGlobalFilterState.current
  },
}))

import { LanguageProvider } from '@/lib/i18n'
import { CoresHubStudio } from '@/components/aether/CoresHubStudio'

const TypedLanguageProvider = LanguageProvider as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

const CoresHubStudioWithCube = CoresHubStudio as React.ComponentType<{
  initialTab?: 'marketing' | 'sales' | 'menu'
  initialLiveCube?: OdooPeriodCube | null
}>

// 2026-11-17 14:30 Asia/Kuwait (11:30 UTC)
const FIXTURE_NOW = new Date('2026-11-17T11:30:00.000Z')
const TODAY_ISO = '2026-11-17'
const YESTERDAY_ISO = '2026-11-16'

const ALL_BRANCH_KEYS = [...APPROVED_BRANCH_IDS, 'school-canteens'] as const

function buildEmptyChannels() {
  return Object.fromEntries(
    APPROVED_CHANNEL_IDS.map((ch) => [ch, { netKwd: 0, orders: 0 }]),
  ) as OdooPeriodCube['byChannel']
}

function buildTodayCubeFixture(overrides: Partial<OdooPeriodCube> = {}): OdooPeriodCube {
  const byBranch = {} as OdooPeriodCube['byBranch']
  for (const br of ALL_BRANCH_KEYS) {
    byBranch[br] = {
      netKwd: 400,
      orders: 80,
      aovKwd: 5,
      channels: buildEmptyChannels(),
    }
  }
  byBranch['al-kout'] = {
    netKwd: 214.5,
    orders: 43,
    aovKwd: 4.988,
    channels: {
      ...buildEmptyChannels(),
      'dine-in': { netKwd: 164.1, orders: 34 },
      'talabat-tgo': { netKwd: 31.2, orders: 5 },
      keeta: { netKwd: 19.2, orders: 4 },
    },
  }

  const byBrand = Object.fromEntries(
    APPROVED_BRAND_IDS.map((bid) => [
      bid,
      { netKwd: 300, qty: 60, linesCount: 55, orders: 48 as number | null, avgDiscountPct: 0, discountKwd: 0 },
    ]),
  ) as OdooPeriodCube['byBrand']
  byBrand['china-garden'] = {
    netKwd: 912.375,
    qty: 190,
    linesCount: 175,
    orders: 152,
    avgDiscountPct: 1.5,
    discountKwd: 13.894,
  }
  byBrand['noodle-bar'] = {
    netKwd: 445.25,
    qty: 88,
    linesCount: 82,
    orders: null,
    avgDiscountPct: 0,
    discountKwd: 0,
  }

  const brandByBranch: OdooPeriodCube['brandByBranch'] = {
    'al-kout': Object.fromEntries(
      APPROVED_BRAND_IDS.map((bid) => [
        bid,
        { netKwd: bid === 'china-garden' ? 128.75 : 17.15, qty: 25, linesCount: 22, avgDiscountPct: 0, discountKwd: 0 },
      ]),
    ) as OdooPeriodCube['brandByBranch'][string],
  }

  const byChannel: OdooPeriodCube['byChannel'] = {
    ...buildEmptyChannels(),
    'dine-in': { netKwd: 1850.5, orders: 410 },
    'talabat-tgo': { netKwd: 980.25, orders: 215 },
    keeta: { netKwd: 676.075, orders: 166 },
  }

  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    odooCompanyId: 1,
    lastSyncAt: '2026-11-17T11:25:00.000Z',
    isStale24h: false,
    dateRange: { from: TODAY_ISO, to: TODAY_ISO },
    days: 1,
    totals: {
      netSalesKwd: 3506.825,
      orders: 791,
      aovKwd: 4.433,
      mappedBranchesNetKwd: 3414.5,
      mappedBranchesOrders: 770,
      unattributedSalesKwd: 92.325,
      unattributedOrders: 21,
      excludedEntitiesKwd: 0,
      excludedEntitiesOrders: 0,
      totalDiscountKwd: 18.5,
      avgDiscountPct: 1.2,
      discountedLinesCount: 14,
    },
    byBranch,
    unattributed: {
      id: 'unattributed',
      labelAr: 'غير منسوب لفرع',
      labelEn: 'Unattributed to Branch',
      netKwd: 92.325,
      orders: 21,
      aovKwd: 4.396,
      channels: buildEmptyChannels(),
    },
    byBrand,
    brandByBranch,
    byChannel,
    dailySeries: [
      {
        day: TODAY_ISO,
        orders: 791,
        netKwd: 3506.825,
        unattributedNetKwd: 92.325,
        unattributedOrders: 21,
      },
    ],
    dailyByBranch: {
      [TODAY_ISO]: Object.fromEntries(
        ALL_BRANCH_KEYS.map((br) => [
          br,
          br === 'al-kout' ? { netKwd: 214.5, orders: 43 } : { netKwd: 400, orders: 80 },
        ]),
      ) as OdooPeriodCube['dailyByBranch'][string],
    },
    dailyUnattributed: {
      [TODAY_ISO]: { netKwd: 92.325, orders: 21 },
    },
    hourlySeries: [
      { hour: 12, orders: 120, netKwd: 540.25 },
      { hour: 13, orders: 165, netKwd: 745.5 },
    ],
    hourlyByBranch: {
      'al-kout': [
        { hour: 12, orders: 18, netKwd: 89.5 },
        { hour: 13, orders: 25, netKwd: 125.0 },
      ],
    },
    topProducts: [],
    ...overrides,
  }
}

function buildLiveSummaryFixture(overrides: Partial<OdooLiveSummary> = {}): OdooLiveSummary {
  const todayBucket: OdooBucketSummary = {
    key: 'today',
    from: TODAY_ISO,
    to: '2026-11-18',
    days: 1,
    totals: {
      netSalesKwd: 3506.825,
      orders: 791,
      aovKwd: 4.433,
      restaurantNetKwd: 3506.825,
      restaurantOrders: 791,
    },
    byLocation: Object.fromEntries(
      ALL_BRANCH_KEYS.map((br) => [
        br,
        br === 'al-kout'
          ? { netKwd: 214.5, orders: 43, uiChannels: buildEmptyChannels() }
          : { netKwd: 400, orders: 80, uiChannels: buildEmptyChannels() },
      ]),
    ),
    mappedByLocation: Object.fromEntries(
      ALL_BRANCH_KEYS.map((br) => [
        br,
        br === 'al-kout'
          ? { netKwd: 214.5, orders: 43 }
          : { netKwd: 400, orders: 80 },
      ]),
    ),
    byBrand: Object.fromEntries(
      APPROVED_BRAND_IDS.map((bid) => [bid, { netKwd: 500, orders: 100, qty: 120 }]),
    ),
    uiChannels: buildEmptyChannels(),
    unattributedSalesKwd: 92.325,
    unattributedOrders: 21,
  }

  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    syncedAt: '2026-11-17T11:25:00.000Z',
    lastSyncAt: '2026-11-17T11:25:00.000Z',
    latestRecordAt: '2026-11-17T11:20:00.000Z',
    latestOperationalDate: TODAY_ISO,
    period: { from: TODAY_ISO, to: TODAY_ISO },
    database: null,
    totals: { netSalesKwd: 3506.825, orders: 791, aovKwd: 4.433 },
    brands: [],
    branches: [],
    channels: [],
    buckets: {
      today: todayBucket,
      month: { ...todayBucket, key: 'month', from: '2026-11-01', to: '2026-11-18', days: 17 },
    },
    dailySeries: [
      { day: '2026-11-15', orders: 710, netKwd: 3120.5 },
      { day: YESTERDAY_ISO, orders: 750, netKwd: 3340.25 },
      { day: TODAY_ISO, orders: 791, netKwd: 3506.825 },
    ],
    dailyByBranch: {
      '2026-11-15': { 'al-kout': { netKwd: 0, orders: 0 }, avenues: { netKwd: 600, orders: 110 } },
      [YESTERDAY_ISO]: { avenues: { netKwd: 640, orders: 118 } }, // al-kout row missing on 2026-11-16
      [TODAY_ISO]: { 'al-kout': { netKwd: 214.5, orders: 43 }, avenues: { netKwd: 690, orders: 125 } },
    },
    hourlySeries: [
      { hour: 12, orders: 120, netKwd: 540.25 },
      { hour: 13, orders: 165, netKwd: 745.5 },
    ],
    ...overrides,
  }
}

function renderCores(
  locale: 'ar' | 'en',
  filtersOverride: Partial<GlobalFilters>,
  summary: OdooLiveSummary,
  liveCube: OdooPeriodCube | null = null,
): string {
  const filters: GlobalFilters = {
    ...DEFAULT_GLOBAL_FILTERS,
    ...filtersOverride,
  }
  mockGlobalFilterState.current = {
    filters,
    workspace: computeGlobalWorkspace(filters, summary, '/erp/cores'),
    liveSummary: summary,
  } as unknown as GlobalFilterContextValue

  return renderToStaticMarkup(
    React.createElement(
      TypedLanguageProvider,
      { initialLocale: locale },
      React.createElement(CoresHubStudioWithCube, {
        initialTab: 'sales',
        initialLiveCube: liveCube,
      }),
    ),
  )
}

describe('Bug A — Single-window live-comparison normalization & period cube headline scoping', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] })
    mockGlobalFilterState.current = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('normalizeComparisonQueryWindows: A == B == today (single and range) returns today with excludedIncompleteToday === false', () => {
    const singleQuery: ErpComparisonQuery = {
      mode: 'date-vs-date',
      granularity: 'single',
      periodA: { from: TODAY_ISO, to: TODAY_ISO },
      periodB: { from: TODAY_ISO, to: TODAY_ISO },
      brandIds: 'all',
      branchIds: 'all',
      channelIds: 'all',
    }
    const singleNorm = normalizeComparisonQueryWindows(singleQuery)
    expect(singleNorm.normA.fromIso).toBe(TODAY_ISO)
    expect(singleNorm.normA.toIso).toBe(TODAY_ISO)
    expect(singleNorm.normB.fromIso).toBe(TODAY_ISO)
    expect(singleNorm.normB.toIso).toBe(TODAY_ISO)
    expect(singleNorm.likeForLikeMeta.excludedIncompleteToday).toBe(false)

    const rangeQuery: ErpComparisonQuery = {
      mode: 'date-vs-date',
      granularity: 'range',
      periodA: { from: '2026-11-11', to: TODAY_ISO },
      periodB: { from: '2026-11-11', to: TODAY_ISO },
      brandIds: 'all',
      branchIds: 'all',
      channelIds: 'all',
    }
    const rangeNorm = normalizeComparisonQueryWindows(rangeQuery)
    expect(rangeNorm.normA.fromIso).toBe('2026-11-11')
    expect(rangeNorm.normA.toIso).toBe(TODAY_ISO)
    expect(rangeNorm.normB.fromIso).toBe('2026-11-11')
    expect(rangeNorm.normB.toIso).toBe(TODAY_ISO)
    expect(rangeNorm.likeForLikeMeta.excludedIncompleteToday).toBe(false)
  })

  it('normalizeComparisonQueryWindows: A != B touching today still excludes incomplete today (locked comparison behaviour)', () => {
    const twoDayQuery: ErpComparisonQuery = {
      mode: 'date-vs-date',
      granularity: 'single',
      periodA: { from: TODAY_ISO, to: TODAY_ISO },
      periodB: { from: '2026-11-10', to: '2026-11-10' },
      brandIds: 'all',
      branchIds: 'all',
      channelIds: 'all',
    }
    const singleNorm = normalizeComparisonQueryWindows(twoDayQuery)
    expect(singleNorm.likeForLikeMeta.excludedIncompleteToday).toBe(true)
    expect(singleNorm.normA.fromIso).toBe(YESTERDAY_ISO)
    expect(singleNorm.normB.fromIso).toBe('2026-11-10')

    const twoRangeQuery: ErpComparisonQuery = {
      mode: 'date-vs-date',
      granularity: 'range',
      periodA: { from: '2026-11-11', to: TODAY_ISO },
      periodB: { from: '2026-11-04', to: '2026-11-10' },
      brandIds: 'all',
      branchIds: 'all',
      channelIds: 'all',
    }
    const rangeNorm = normalizeComparisonQueryWindows(twoRangeQuery)
    expect(rangeNorm.likeForLikeMeta.excludedIncompleteToday).toBe(true)
    expect(rangeNorm.normA.toIso).toBe(YESTERDAY_ISO)
  })

  it('selectCubeHeadline: scopes branch, brand, brand+branch, channel, and returns nulls when unavailable', () => {
    const cube = buildTodayCubeFixture()

    // 1. All-company default
    expect(selectCubeHeadline(cube, { branch: 'all', brand: 'all', channel: 'all' })).toEqual({
      netSalesKwd: 3506.825,
      orders: 791,
      aovKwd: 4.433,
    })

    // 2. Branch = al-kout returns byBranch['al-kout'] exactly, never company totals
    const alKout = selectCubeHeadline(cube, { branch: 'al-kout', brand: 'all', channel: 'all' })
    expect(alKout).toEqual({
      netSalesKwd: 214.5,
      orders: 43,
      aovKwd: 4.988,
    })
    expect(alKout.netSalesKwd).not.toBe(cube.totals.netSalesKwd)

    // 3. Brand -> byBrand[brand] (with known orders vs null orders)
    expect(selectCubeHeadline(cube, { branch: 'all', brand: 'china-garden', channel: 'all' })).toEqual({
      netSalesKwd: 912.375,
      orders: 152,
      aovKwd: 6.002,
    })
    expect(selectCubeHeadline(cube, { branch: 'all', brand: 'noodle-bar', channel: 'all' })).toEqual({
      netSalesKwd: 445.25,
      orders: null,
      aovKwd: null,
    })

    // 4. Brand + branch -> brandByBranch[branch][brand] with orders: null & aovKwd: null
    expect(selectCubeHeadline(cube, { branch: 'al-kout', brand: 'china-garden', channel: 'all' })).toEqual({
      netSalesKwd: 128.75,
      orders: null,
      aovKwd: null,
    })

    // 5. Channel -> byChannel[channel] when branch='all', or byBranch[branch].channels[channel]
    expect(selectCubeHeadline(cube, { branch: 'all', brand: 'all', channel: 'talabat-tgo' })).toEqual({
      netSalesKwd: 980.25,
      orders: 215,
      aovKwd: 4.559,
    })
    expect(selectCubeHeadline(cube, { branch: 'al-kout', brand: 'all', channel: 'talabat-tgo' })).toEqual({
      netSalesKwd: 31.2,
      orders: 5,
      aovKwd: 6.24,
    })

    // 6. Brand + channel cannot be split from pos.payment -> nulls
    expect(selectCubeHeadline(cube, { branch: 'all', brand: 'china-garden', channel: 'talabat-tgo' })).toEqual({
      netSalesKwd: null,
      orders: null,
      aovKwd: null,
    })

    // 7. Missing branch -> nulls (never 0, never company totals)
    const cubeMissingAlKout = buildTodayCubeFixture()
    delete (cubeMissingAlKout.byBranch as Record<string, unknown>)['al-kout']
    expect(selectCubeHeadline(cubeMissingAlKout, { branch: 'al-kout', brand: 'all', channel: 'all' })).toEqual({
      netSalesKwd: null,
      orders: null,
      aovKwd: null,
    })
    expect(selectCubeHeadline(cube, { branch: 'non-existent-branch', brand: 'all', channel: 'all' })).toEqual({
      netSalesKwd: null,
      orders: null,
      aovKwd: null,
    })
  })

  it('Cores daily series: drops days where branch row is missing, and keeps 0 only when branch row explicitly exists with 0', () => {
    const summary = buildLiveSummaryFixture()
    const filters: GlobalFilters = {
      ...DEFAULT_GLOBAL_FILTERS,
      period: 'custom',
      customFrom: '2026-11-15',
      customTo: TODAY_ISO,
      branch: 'al-kout',
    }

    // Without liveCube (liveSummary.dailyByBranch): 2026-11-15 has explicit 0, 2026-11-16 is missing al-kout, 2026-11-17 has 214.5
    const snapSummary = computeCoresHubSnapshot(filters, [], summary, null)
    expect(snapSummary.sales.timeline.map((pt) => ({ id: pt.id, salesKwd: pt.salesKwd, orders: pt.orders }))).toEqual([
      { id: '2026-11-15', salesKwd: 0, orders: 0 },
      { id: TODAY_ISO, salesKwd: 214.5, orders: 43 },
    ])

    // With liveCube (liveCube.dailyByBranch): same rule applies
    const cube = buildTodayCubeFixture({
      dateRange: { from: '2026-11-15', to: TODAY_ISO },
      days: 3,
      dailyByBranch: {
        '2026-11-15': { 'al-kout': { netKwd: 0, orders: 0 } } as OdooPeriodCube['dailyByBranch'][string],
        [YESTERDAY_ISO]: { avenues: { netKwd: 640, orders: 118 } } as OdooPeriodCube['dailyByBranch'][string],
        [TODAY_ISO]: { 'al-kout': { netKwd: 214.5, orders: 43 } } as OdooPeriodCube['dailyByBranch'][string],
      },
    })
    const snapCube = computeCoresHubSnapshot(filters, [], summary, cube)
    expect(snapCube.sales.timeline.map((pt) => ({ id: pt.id, salesKwd: pt.salesKwd, orders: pt.orders }))).toEqual([
      { id: '2026-11-15', salesKwd: 0, orders: 0 },
      { id: TODAY_ISO, salesKwd: 214.5, orders: 43 },
    ])
  })

  it('CoresHubStudio: renders snapshot.sales.headline for branch=al-kout (never company totals), renders غير متاح for null, and hides daily timeline on 1-day window', () => {
    const summary = buildLiveSummaryFixture()
    const cube = buildTodayCubeFixture()

    const htmlAlKoutAr = renderCores('ar', { period: 'today', branch: 'al-kout' }, summary, cube)
    expect(htmlAlKoutAr).toContain('214.500')
    expect(htmlAlKoutAr).toContain('4.988')
    expect(htmlAlKoutAr).not.toContain('3,506.825')
    expect(htmlAlKoutAr).not.toContain('791 طلب')
    // Single-day window hides Daily Net Sales Timeline and renders Hourly POS Sales Profile
    expect(htmlAlKoutAr).not.toContain('المسار اليومي لصافي المبيعات')
    expect(htmlAlKoutAr).toContain('التوزيع الساعي لطلبات نقاط البيع')

    // Brand + branch (orders = null, aov = null) renders "غير متاح" in AR and "—" in EN, never 0 orders
    const htmlBrandBranchAr = renderCores(
      'ar',
      { period: 'today', branch: 'al-kout', brand: 'china-garden' },
      summary,
      cube,
    )
    expect(htmlBrandBranchAr).toContain('128.750')
    expect(htmlBrandBranchAr).toContain('غير متاح')
    expect(htmlBrandBranchAr).not.toContain('0 طلب مسجّل')

    const htmlBrandBranchEn = renderCores(
      'en',
      { period: 'today', branch: 'al-kout', brand: 'china-garden' },
      summary,
      cube,
    )
    expect(htmlBrandBranchEn).toContain('128.750')
    expect(htmlBrandBranchEn).not.toContain('Daily Net Sales Timeline')
    expect(htmlBrandBranchEn).toContain('Hourly POS Sales Profile')

    // Multi-day window still renders Daily Net Sales Timeline
    const multiDayCube = buildTodayCubeFixture({
      dateRange: { from: '2026-11-01', to: TODAY_ISO },
      days: 17,
    })
    const htmlMonthEn = renderCores('en', { period: 'month', branch: 'all' }, summary, multiDayCube)
    expect(htmlMonthEn).toContain('Daily Net Sales Timeline')
    expect(htmlMonthEn).toContain('Hourly POS Sales Profile')
  })
})

describe('Bug D — Top Lift entity validation (The Noodle Bar & approved entities only, never delta <= 0)', () => {
  it('confirms The Noodle Bar (noodle-bar) is a registered company brand and Top Lift only appears for delta > 0', () => {
    const regBrand = posRegistry.brands.find((b) => b.id === 'noodle-bar')
    expect(regBrand).toMatchObject({
      id: 'noodle-bar',
      en: 'The Noodle Bar',
      posRoot: 'TNB',
      analyticId: 90,
    })
    expect(APPROVED_BRAND_IDS).toContain('noodle-bar')

    // resolveBestBranchBadge never shows Top Lift / أعلى تحسن when delta <= 0
    expect(resolveBestBranchBadge(42.5)).toEqual({
      labelAr: 'أعلى تحسن',
      labelEn: 'Top Lift',
      tone: 'emerald',
    })
    for (const nonPositive of [0, -0.001, -50, Number.NaN]) {
      const badge = resolveBestBranchBadge(nonPositive)
      expect(badge.labelEn).not.toBe('Top Lift')
      expect(badge.labelAr).not.toBe('أعلى تحسن')
      expect(badge.tone).toBe('neutral')
    }

    // computeErpComparison topGainer entities are strictly approved brands/branches and null when all deltas <= 0
    const cubeA = buildTodayCubeFixture({ dateRange: { from: '2026-11-16', to: '2026-11-16' } })
    const cubeB = buildTodayCubeFixture({ dateRange: { from: '2026-11-09', to: '2026-11-09' } })
    cubeA.byBrand['noodle-bar'].netKwd = 780
    cubeB.byBrand['noodle-bar'].netKwd = 410

    const positiveCmp = computeErpComparison(
      {
        mode: 'date-vs-date',
        granularity: 'single',
        periodA: { from: '2026-11-16', to: '2026-11-16' },
        periodB: { from: '2026-11-09', to: '2026-11-09' },
        brandIds: 'all',
        branchIds: 'all',
        channelIds: 'all',
      },
      { cubeA, cubeB },
    )
    expect(positiveCmp.insights.topGainerBrand?.id).toBe('noodle-bar')
    expect(APPROVED_BRAND_IDS).toContain(positiveCmp.insights.topGainerBrand?.id)

    // When all branches and brands have delta <= 0, topGainerBranch, topGainerBrand, and topGainer are all null
    const flatCmp = computeErpComparison(
      {
        mode: 'date-vs-date',
        granularity: 'single',
        periodA: { from: '2026-11-16', to: '2026-11-16' },
        periodB: { from: '2026-11-09', to: '2026-11-09' },
        brandIds: 'all',
        branchIds: 'all',
        channelIds: 'all',
      },
      { cubeA: cubeB, cubeB },
    )
    expect(flatCmp.insights.topGainerBranch).toBeNull()
    expect(flatCmp.insights.topGainerBrand).toBeNull()
    expect(flatCmp.insights.topGainer).toBeNull()
  })
})
