/**
 * V35 Polish — Comparison Studios (`WeekdayComparisonStudio` & `BeforeAfterStudio`)
 * shared chart-kit integration tests.
 *
 * Verifies real rendered markup uses `@/components/charts/v35-chart-kit`
 * (`data-chart-kind="comparison-bar"` / `"timeline-area"`, `data-y-axis-side="right"` in AR RTL),
 * removes legacy inline gray-track div bars (`h-[156px]` / `h-[140px]`), and preserves
 * 3-decimal KWD and `—` (`UNAVAILABLE_DASH`) precision.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import type { OdooBucketSummary, OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'

type StudioHookOverride = {
  active: boolean
  index: number
  cubeA: OdooPeriodCube | null
  cubeB: OdooPeriodCube | null
  chartMetric: 'sales' | 'orders' | 'cumulative'
  lastSyncAt: string | null
}

const studioHookOverride: StudioHookOverride = {
  active: false,
  index: 0,
  cubeA: null,
  cubeB: null,
  chartMetric: 'sales',
  lastSyncAt: '2026-11-15T18:30:00.000Z',
}

const noopSetState = (() => {}) as React.Dispatch<React.SetStateAction<unknown>>

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  const wrappedUseState = ((initialState: unknown) => {
    const res = actual.useState(initialState)
    if (!studioHookOverride.active) {
      return res
    }
    const idx = studioHookOverride.index++
    if (idx === 0) return res
    if (idx === 1) return [studioHookOverride.cubeA, noopSetState]
    if (idx === 2) return [studioHookOverride.cubeB, noopSetState]
    if (idx === 3) return [false, noopSetState] // loading
    if (idx === 4) return [false, noopSetState] // apiError
    if (idx === 5) return [0, noopSetState] // retryTick
    if (idx === 6) return [true, noopSetState] // apiConnected
    if (idx === 7) return [false, noopSetState] // apiNoData
    if (idx === 8) return [studioHookOverride.lastSyncAt, noopSetState]
    if (idx === 9) return [false, noopSetState] // apiIsStale24h
    if (idx === 10) {
      studioHookOverride.active = false
      return [studioHookOverride.chartMetric, noopSetState]
    }
    studioHookOverride.active = false
    return res
  }) as typeof actual.useState

  return {
    ...actual,
    default: {
      ...actual,
      useState: wrappedUseState,
    },
    useState: wrappedUseState,
  }
})

const stubGlobalFilterState: { value: unknown } = { value: null }

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp/weekday-comparison',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => stubGlobalFilterState.value,
}))

import { BeforeAfterStudio } from '@/components/aether/BeforeAfterStudio'
import { WeekdayComparisonStudio } from '@/components/erp/ops-expansion/WeekdayComparisonStudio'
import { LanguageProvider } from '@/lib/i18n'

const TypedLangProvider = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

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
    'dine-in': { netKwd: Number((250.125 * scale).toFixed(3)), orders: Math.round(60 * scale) },
    'takeaway-direct': { netKwd: Number((180.25 * scale).toFixed(3)), orders: Math.round(45 * scale) },
    'talabat-tgo': { netKwd: Number((310.375 * scale).toFixed(3)), orders: Math.round(80 * scale) },
    'talabat-tmp': { netKwd: Number((110.125 * scale).toFixed(3)), orders: Math.round(30 * scale) },
    keeta: { netKwd: Number((140.5 * scale).toFixed(3)), orders: Math.round(35 * scale) },
    deliveroo: { netKwd: Number((155.25 * scale).toFixed(3)), orders: Math.round(40 * scale) },
    jahez: { netKwd: Number((70.125 * scale).toFixed(3)), orders: Math.round(20 * scale) },
    snoonu: { netKwd: Number((50.375 * scale).toFixed(3)), orders: Math.round(15 * scale) },
  }
}

function buildLiveCube(
  dateRange: { from: string; to: string },
  scale: number,
  options: { glIncomplete?: boolean; nullBrandOrders?: boolean } = {},
): OdooPeriodCube {
  const uiChannels = buildChannelMap(scale)
  const totalNet = Number(
    Object.values(uiChannels)
      .reduce((sum, item) => sum + item.netKwd, 0)
      .toFixed(3),
  )
  const totalOrders = Object.values(uiChannels).reduce((sum, item) => sum + item.orders, 0)

  const byBranch = {} as OdooPeriodCube['byBranch']
  BRANCH_KEYS.forEach((branchId, idx) => {
    const share = idx === 0 ? 0.25 : idx === 1 ? 0.2 : idx === 7 ? 0.05 : 0.1
    const netKwd = Number((totalNet * share).toFixed(3))
    const orders = Math.max(1, Math.round(totalOrders * share))
    byBranch[branchId] = {
      netKwd,
      orders,
      aovKwd: Number((netKwd / orders).toFixed(3)),
      channels: buildChannelMap(scale * share),
    }
  })

  const byBrand = {} as OdooPeriodCube['byBrand']
  BRAND_KEYS.forEach((brandId, idx) => {
    const share = idx === 0 ? 0.3 : idx === 1 ? 0.2 : 0.125
    const netKwd = Number((totalNet * share).toFixed(3))
    const orders = options.nullBrandOrders ? null : Math.max(1, Math.round(totalOrders * share))
    byBrand[brandId] = {
      netKwd,
      qty: Math.round(120 * scale * share),
      linesCount: Math.round(80 * scale * share),
      orders,
      avgDiscountPct: 2.0,
      discountKwd: Number((netKwd * 0.02).toFixed(3)),
    }
  })

  const brandByBranch: OdooPeriodCube['brandByBranch'] = {}
  for (const branchId of BRANCH_KEYS) {
    brandByBranch[branchId] = {} as OdooPeriodCube['brandByBranch'][string]
    for (const brandId of BRAND_KEYS) {
      brandByBranch[branchId][brandId] = {
        netKwd: Number((byBrand[brandId].netKwd / 8).toFixed(3)),
        qty: Math.round(byBrand[brandId].qty / 8),
        linesCount: Math.round(byBrand[brandId].linesCount / 8),
        avgDiscountPct: 2.0,
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
    dateRange,
    days: 2,
    totals: {
      netSalesKwd: totalNet,
      orders: totalOrders,
      aovKwd: Number((totalNet / Math.max(1, totalOrders)).toFixed(3)),
      mappedBranchesNetKwd: Number((totalNet - 45.125 * scale).toFixed(3)),
      mappedBranchesOrders: Math.max(0, totalOrders - 10),
      unattributedSalesKwd: Number((45.125 * scale).toFixed(3)),
      unattributedOrders: 10,
      excludedEntitiesKwd: 0,
      excludedEntitiesOrders: 0,
      totalDiscountKwd: Number((totalNet * 0.02).toFixed(3)),
      avgDiscountPct: 2.0,
      discountedLinesCount: 40,
    },
    byBranch,
    unattributed: {
      id: 'unattributed',
      labelAr: 'غير منسوب لفرع',
      labelEn: 'Unattributed to Branch',
      netKwd: Number((45.125 * scale).toFixed(3)),
      orders: 10,
      aovKwd: Number((4.513 * scale).toFixed(3)),
      channels: buildChannelMap(0.05 * scale),
    },
    byBrand,
    brandByBranch,
    byChannel: uiChannels,
    dailySeries: [
      {
        day: dateRange.from,
        orders: Math.round(totalOrders * 0.45),
        netKwd: Number((totalNet * 0.45).toFixed(3)),
        unattributedNetKwd: Number((20.0 * scale).toFixed(3)),
        unattributedOrders: 4,
      },
      {
        day: dateRange.to,
        orders: Math.round(totalOrders * 0.55),
        netKwd: Number((totalNet * 0.55).toFixed(3)),
        unattributedNetKwd: Number((25.125 * scale).toFixed(3)),
        unattributedOrders: 6,
      },
    ],
    dailyByBranch: {},
    dailyUnattributed: {},
    hourlySeries: [
      { hour: 12, orders: 60, netKwd: Number((totalNet * 0.25).toFixed(3)) },
      { hour: 15, orders: 80, netKwd: Number((totalNet * 0.35).toFixed(3)) },
      { hour: 20, orders: 110, netKwd: Number((totalNet * 0.4).toFixed(3)) },
    ],
    hourlyByBranch: {},
    topProducts: [],
    accounting: options.glIncomplete
      ? {
          available: false,
          from: dateRange.from,
          to: dateRange.to,
          sourceModel: 'account.move.line',
          lineCount: 10,
          income: totalNet,
          otherIncome: 0,
          totalRevenue: totalNet,
          cogs: 0,
          deliveryCommissions: 0,
          expense: 0,
          depreciation: 0,
          otherOpexAndDepreciation: 0,
          operatingProfit: 0,
          completeAccrualPosted: false,
          glIncomplete: true,
          glWarningAr: 'دفتر الأستاذ بلا بند مصروف لهذه الفترة',
          aggregatorCommissionUnposted: true,
          aggregatorCommissionDisplayAr: 'غير مُرحَّل بعد',
        }
      : {
          available: true,
          from: dateRange.from,
          to: dateRange.to,
          sourceModel: 'account.move.line',
          lineCount: 120,
          income: totalNet,
          otherIncome: 0,
          totalRevenue: totalNet,
          cogs: Number((totalNet * 0.28).toFixed(3)),
          deliveryCommissions: Number((totalNet * 0.1).toFixed(3)),
          expense: Number((totalNet * 0.38).toFixed(3)),
          depreciation: Number((totalNet * 0.04).toFixed(3)),
          otherOpexAndDepreciation: Number((totalNet * 0.34).toFixed(3)),
          operatingProfit: Number((totalNet * 0.28).toFixed(3)),
          completeAccrualPosted: true,
          glIncomplete: false,
        },
  }
}

function buildMinimalLiveSummary(): OdooLiveSummary {
  const monthBucket: OdooBucketSummary = {
    key: 'month',
    from: '2026-10-17',
    to: '2026-11-15',
    days: 30,
    totals: {
      netSalesKwd: 1267.125,
      orders: 325,
      aovKwd: 3.899,
      restaurantNetKwd: 1267.125,
      restaurantOrders: 325,
    },
    byBrand: null,
    byLocation: null,
    mappedByLocation: null,
    uiChannels: buildChannelMap(1),
  }
  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    partial: false,
    unavailableSections: [],
    syncedAt: '2026-11-15T18:30:00.000Z',
    lastSyncAt: '2026-11-15T18:30:00.000Z',
    latestOperationalDate: '2026-11-15',
    isStale24h: false,
    odooCompanyId: 1,
    dateRange: { from: '2026-10-17', to: '2026-11-15' },
    period: { from: '2026-10-17', to: '2026-11-15' },
    database: null,
    totals: { netSalesKwd: 1267.125, orders: 325, aovKwd: 3.899 },
    brands: [],
    branches: [],
    channels: [],
    buckets: { month: monthBucket },
  }
}

function setContext(filters: Partial<GlobalFilters> = {}) {
  const merged: GlobalFilters = { ...DEFAULT_GLOBAL_FILTERS, ...filters }
  const summary = buildMinimalLiveSummary()
  stubGlobalFilterState.value = {
    filters: merged,
    workspace: computeGlobalWorkspace(merged, summary, '/erp/weekday-comparison'),
    liveSummary: summary,
    isAuditor: false,
    sessionRole: 'admin',
    syncingOdoo: false,
  }
}

function renderStudio(
  locale: 'ar' | 'en',
  StudioComponent: React.ComponentType,
  opts: {
    cubeA: OdooPeriodCube
    cubeB: OdooPeriodCube
    chartMetric?: 'sales' | 'orders' | 'cumulative'
  },
): string {
  function Activator() {
    studioHookOverride.active = true
    studioHookOverride.index = 0
    studioHookOverride.cubeA = opts.cubeA
    studioHookOverride.cubeB = opts.cubeB
    studioHookOverride.chartMetric = opts.chartMetric ?? 'sales'
    studioHookOverride.lastSyncAt = opts.cubeA.lastSyncAt
    return React.createElement(StudioComponent)
  }

  try {
    return renderToStaticMarkup(
      React.createElement(TypedLangProvider, { initialLocale: locale }, React.createElement(Activator)),
    )
  } finally {
    studioHookOverride.active = false
    studioHookOverride.index = 0
  }
}

describe('V35 Polish — WeekdayComparisonStudio & BeforeAfterStudio shared chart-kit integration', () => {
  beforeEach(() => setContext())
  afterEach(() => {
    studioHookOverride.active = false
    studioHookOverride.index = 0
  })

  it('WeekdayComparisonStudio renders via v35-chart-kit ComparisonBarChart & TimelineAreaChart with AR RTL right Y-axis, zero legacy track bars, and 3-decimal KWD / — precision', () => {
    const cubeA = buildLiveCube({ from: '2026-11-14', to: '2026-11-15' }, 1.2)
    const cubeB = buildLiveCube({ from: '2026-11-07', to: '2026-11-08' }, 1.0)

    const arBarHtml = renderStudio('ar', WeekdayComparisonStudio, {
      cubeA,
      cubeB,
      chartMetric: 'sales',
    })
    expect(arBarHtml).toContain('dir="rtl"')
    expect(arBarHtml).toContain('data-chart-kind="comparison-bar"')
    expect(arBarHtml).toContain('data-y-axis-side="right"')
    expect(arBarHtml).toContain('data-x-axis-reversed="true"')
    expect(arBarHtml).not.toContain('h-[156px]')
    expect(arBarHtml).not.toContain('h-[140px]')
    expect(arBarHtml).toContain('1,520.600')
    expect(arBarHtml).toContain('1,267.100')
    expect(arBarHtml).toMatch(/1,520\.600\s*د\.ك/)

    const enBarHtml = renderStudio('en', WeekdayComparisonStudio, {
      cubeA,
      cubeB,
      chartMetric: 'sales',
    })
    expect(enBarHtml).toContain('dir="ltr"')
    expect(enBarHtml).toContain('data-chart-kind="comparison-bar"')
    expect(enBarHtml).toContain('data-y-axis-side="left"')
    expect(enBarHtml).toContain('1,520.600')
    expect(enBarHtml).toMatch(/1,520\.600\s*KWD/)

    const arAreaHtml = renderStudio('ar', WeekdayComparisonStudio, {
      cubeA,
      cubeB,
      chartMetric: 'cumulative',
    })
    expect(arAreaHtml).toContain('data-chart-kind="timeline-area"')
    expect(arAreaHtml).toContain('data-y-axis-side="right"')
    expect(arAreaHtml).not.toContain('h-[156px]')
    expect(arAreaHtml).not.toContain('h-[140px]')

    // Incomplete GL renders — with data-unavailable="true" & calm UnavailableState while keeping 3-decimal Net Sales
    const glIncompleteA = buildLiveCube({ from: '2026-11-14', to: '2026-11-15' }, 1.2, {
      glIncomplete: true,
    })
    const glIncompleteB = buildLiveCube({ from: '2026-11-07', to: '2026-11-08' }, 1.0, {
      glIncomplete: true,
    })
    const incompleteHtml = renderStudio('ar', WeekdayComparisonStudio, {
      cubeA: glIncompleteA,
      cubeB: glIncompleteB,
    })
    expect(incompleteHtml).not.toContain('دفتر الأستاذ بلا بند مصروف')
    expect(incompleteHtml).not.toContain('تكلفة المواد وعمولات المنصات')
    expect(incompleteHtml).toContain('1,520.600')
  })

  it('BeforeAfterStudio renders via v35-chart-kit ComparisonBarChart & TimelineAreaChart with AR RTL right Y-axis, zero legacy track bars, and 3-decimal KWD / — precision', () => {
    const cubeA = buildLiveCube({ from: '2026-11-10', to: '2026-11-15' }, 1.25)
    const cubeB = buildLiveCube({ from: '2026-11-01', to: '2026-11-06' }, 1.0)

    const arBarHtml = renderStudio('ar', BeforeAfterStudio, {
      cubeA,
      cubeB,
      chartMetric: 'sales',
    })
    expect(arBarHtml).toContain('dir="rtl"')
    expect(arBarHtml).toContain('data-chart-kind="comparison-bar"')
    expect(arBarHtml).toContain('data-y-axis-side="right"')
    expect(arBarHtml).toContain('data-x-axis-reversed="true"')
    expect(arBarHtml).not.toContain('h-[156px]')
    expect(arBarHtml).not.toContain('h-[140px]')
    expect(arBarHtml).toContain('1,583.900')
    expect(arBarHtml).toContain('1,267.100')

    const enBarHtml = renderStudio('en', BeforeAfterStudio, {
      cubeA,
      cubeB,
      chartMetric: 'sales',
    })
    expect(enBarHtml).toContain('dir="ltr"')
    expect(enBarHtml).toContain('data-chart-kind="comparison-bar"')
    expect(enBarHtml).toContain('data-y-axis-side="left"')
    expect(enBarHtml).toContain('1,583.900')

    const arAreaHtml = renderStudio('ar', BeforeAfterStudio, {
      cubeA,
      cubeB,
      chartMetric: 'cumulative',
    })
    expect(arAreaHtml).toContain('data-chart-kind="timeline-area"')
    expect(arAreaHtml).toContain('data-y-axis-side="right"')
    expect(arAreaHtml).not.toContain('h-[156px]')
    expect(arAreaHtml).not.toContain('h-[140px]')

    const glIncompleteA = buildLiveCube({ from: '2026-11-10', to: '2026-11-15' }, 1.25, {
      glIncomplete: true,
    })
    const glIncompleteB = buildLiveCube({ from: '2026-11-01', to: '2026-11-06' }, 1.0, {
      glIncomplete: true,
    })
    const incompleteHtml = renderStudio('en', BeforeAfterStudio, {
      cubeA: glIncompleteA,
      cubeB: glIncompleteB,
    })
    expect(incompleteHtml).not.toContain('Incomplete GL entries for this period')
    expect(incompleteHtml).not.toContain('COGS & Platform Commissions')
    expect(incompleteHtml).toContain('1,583.900')
  })

  it('WeekdayComparisonStudio & BeforeAfterStudio source files import shared v35-chart-kit and contain zero legacy gray-track bar dimensions', async () => {
    const root = process.cwd()
    const [weekdaySrc, beforeAfterSrc] = await Promise.all([
      readFile(
        path.join(root, 'src/components/erp/ops-expansion/WeekdayComparisonStudio.tsx'),
        'utf8',
      ),
      readFile(path.join(root, 'src/components/aether/BeforeAfterStudio.tsx'), 'utf8'),
    ])

    for (const src of [weekdaySrc, beforeAfterSrc]) {
      expect(src).toContain('@/components/charts/v35-chart-kit')
      expect(src).toContain('ComparisonBarChart')
      expect(src).toContain('TimelineAreaChart')
      expect(src).not.toContain('h-[156px]')
      expect(src).not.toContain('h-[140px]')
    }
  })
})
