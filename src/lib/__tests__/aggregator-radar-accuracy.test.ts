import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  OdooBucketSummary,
  OdooLedgerAccountingSummary,
  OdooLiveSummary,
} from '@/lib/odoo/live-sync-core'
import {
  buildLedgerAccountingFromGroups,
  type OdooPeriodCube,
} from '@/lib/odoo-live-connector'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  DEFAULT_GLOBAL_FILTERS,
  computeGlobalWorkspace,
  formatPeriodCalendarWindow,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'

type GlobalFilterContextValue = ReturnType<
  typeof import('@/components/aether/GlobalFilterContext').useGlobalFilter
>

const mockGlobalFilterState: { current: GlobalFilterContextValue | null } = {
  current: null,
}

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp/aggregator-radar',
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
import {
  AGGREGATOR_CHANNELS,
  DeliveryRadarV5,
  computeAggregatorRadarViewModel,
} from '@/components/aether/DeliveryRadarV5'

const TypedLanguageProvider = LanguageProvider as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

const DeliveryRadarWithCube = DeliveryRadarV5 as React.ComponentType<{
  initialLiveCube?: OdooPeriodCube | null
}>

const FIXTURE_NOW = new Date('2026-11-18T11:00:00.000Z') // 14:00 Asia/Kuwait on 2026-11-18
const MTD_FROM = '2026-11-01'
const TODAY_ISO = '2026-11-18'
const YESTERDAY_ISO = '2026-11-17'

function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}

function buildEmptyChannels(): OdooPeriodCube['byChannel'] {
  return Object.fromEntries(
    APPROVED_CHANNEL_IDS.map((ch) => [ch, { netKwd: 0, orders: 0 }]),
  ) as OdooPeriodCube['byChannel']
}

function buildStructuralCube(opts?: {
  accounting?: OdooLedgerAccountingSummary
  extraBranch?: { id: string; channel: 'snoonu'; netKwd: number; orders: number }
}): OdooPeriodCube {
  const byBranch = {} as Record<string, OdooPeriodCube['byBranch']['avenues']>
  for (const br of [...APPROVED_BRANCH_IDS, 'school-canteens', 'exhibitions'] as const) {
    byBranch[br] = {
      netKwd: 0,
      orders: 0,
      aovKwd: 0,
      channels: buildEmptyChannels(),
    }
  }

  // Simple structural sales across restaurants, booths, school canteens, and unattributed:
  // - avenues:         talabat-tgo 20 (2), dine-in 50 (5) -> 70 (7)
  // - al-kout:         keeta 10 (2)                       -> 10 (2)
  // - exhibitions:     talabat-tgo 5 (1), jahez 5 (1)     -> 10 (2)
  // - school-canteens: deliveroo 5 (1)                    ->  5 (1)
  // - unattributed:    keeta 5 (1)                        ->  5 (1)
  byBranch.avenues = {
    netKwd: 70,
    orders: 7,
    aovKwd: 10,
    channels: {
      ...buildEmptyChannels(),
      'dine-in': { netKwd: 50, orders: 5 },
      'talabat-tgo': { netKwd: 20, orders: 2 },
    },
  }
  byBranch['al-kout'] = {
    netKwd: 10,
    orders: 2,
    aovKwd: 5,
    channels: {
      ...buildEmptyChannels(),
      keeta: { netKwd: 10, orders: 2 },
    },
  }
  byBranch.exhibitions = {
    netKwd: 10,
    orders: 2,
    aovKwd: 5,
    channels: {
      ...buildEmptyChannels(),
      'talabat-tgo': { netKwd: 5, orders: 1 },
      jahez: { netKwd: 5, orders: 1 },
    },
  }
  byBranch['school-canteens'] = {
    netKwd: 5,
    orders: 1,
    aovKwd: 5,
    channels: {
      ...buildEmptyChannels(),
      deliveroo: { netKwd: 5, orders: 1 },
    },
  }

  const extraKwd = opts?.extraBranch?.netKwd ?? 0
  const extraOrders = opts?.extraBranch?.orders ?? 0
  if (opts?.extraBranch) {
    byBranch[opts.extraBranch.id] = {
      netKwd: extraKwd,
      orders: extraOrders,
      aovKwd: extraOrders > 0 ? round3(extraKwd / extraOrders) : 0,
      channels: {
        ...buildEmptyChannels(),
        [opts.extraBranch.channel]: { netKwd: extraKwd, orders: extraOrders },
      },
    }
  }

  const byChannel: OdooPeriodCube['byChannel'] = {
    ...buildEmptyChannels(),
    'dine-in': { netKwd: 50, orders: 5 },
    'talabat-tgo': { netKwd: 25, orders: 3 },
    keeta: { netKwd: 15, orders: 3 },
    jahez: { netKwd: 5, orders: 1 },
    deliveroo: { netKwd: 5, orders: 1 },
    ...(opts?.extraBranch
      ? { [opts.extraBranch.channel]: { netKwd: extraKwd, orders: extraOrders } }
      : {}),
  }

  const mappedNet = 95 + extraKwd
  const mappedOrders = 12 + extraOrders
  const totalNet = mappedNet + 5
  const totalOrders = mappedOrders + 1

  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    odooCompanyId: 1,
    lastSyncAt: '2026-11-18T10:55:00.000Z',
    isStale24h: false,
    dateRange: { from: MTD_FROM, to: TODAY_ISO },
    days: 18,
    totals: {
      netSalesKwd: totalNet,
      orders: totalOrders,
      aovKwd: round3(totalNet / totalOrders),
      mappedBranchesNetKwd: mappedNet,
      mappedBranchesOrders: mappedOrders,
      unattributedSalesKwd: 5,
      unattributedOrders: 1,
      excludedEntitiesKwd: 0,
      excludedEntitiesOrders: 0,
      totalDiscountKwd: 0,
      avgDiscountPct: 0,
      discountedLinesCount: 0,
    },
    byBranch: byBranch as OdooPeriodCube['byBranch'],
    unattributed: {
      id: 'unattributed',
      labelAr: 'غير منسوب لفرع',
      labelEn: 'Unattributed to Branch',
      netKwd: 5,
      orders: 1,
      aovKwd: 5,
      channels: {
        ...buildEmptyChannels(),
        keeta: { netKwd: 5, orders: 1 },
      },
    },
    byBrand: Object.fromEntries(
      APPROVED_BRAND_IDS.map((bid) => [
        bid,
        { netKwd: 0, qty: 0, linesCount: 0, orders: 0, avgDiscountPct: 0, discountKwd: 0 },
      ]),
    ) as OdooPeriodCube['byBrand'],
    brandByBranch: {},
    byChannel,
    dailySeries: [],
    dailyByBranch: {},
    dailyUnattributed: {},
    hourlySeries: [],
    hourlyByBranch: {},
    topProducts: [],
    accounting: opts?.accounting,
  }
}

function buildStructuralSummary(opts?: {
  monthFrom?: string
  monthTo?: string
  accounting?: OdooLedgerAccountingSummary
}): OdooLiveSummary {
  const uiChannels = {
    ...buildEmptyChannels(),
    'dine-in': { netKwd: 50, orders: 5 },
    'talabat-tgo': { netKwd: 25, orders: 3 },
    keeta: { netKwd: 15, orders: 3 },
    jahez: { netKwd: 5, orders: 1 },
    deliveroo: { netKwd: 5, orders: 1 },
  }

  const accounting: OdooLedgerAccountingSummary = opts?.accounting ?? {
    available: true,
    from: MTD_FROM,
    to: YESTERDAY_ISO,
    sourceModel: 'account.move.line',
    lineCount: 20,
    income: 200,
    otherIncome: 0,
    totalRevenue: 200,
    cogs: 50,
    deliveryCommissions: 10,
    deliveryCommissionLinesCount: 3,
    expense: 20,
    depreciation: 10,
    otherOpexAndDepreciation: 20,
    operatingProfit: 120,
    completeAccrualPosted: true,
    glIncomplete: false,
    aggregatorCommissionUnposted: false,
    commissionAccounts: [
      {
        code: '40224',
        name: 'Delivery App Commission',
        amountKwd: 10,
        linesCount: 3,
        matchedBy: 'code',
      },
    ],
  }

  const monthBucket: OdooBucketSummary = {
    key: 'month',
    from: opts?.monthFrom ?? '2026-10-20',
    to: opts?.monthTo ?? '2026-11-19',
    days: 30,
    totals: {
      netSalesKwd: 100,
      orders: 13,
      aovKwd: round3(100 / 13),
      restaurantNetKwd: 95,
      restaurantOrders: 12,
    },
    byLocation: {
      avenues: {
        netKwd: 70,
        orders: 7,
        uiChannels: {
          ...buildEmptyChannels(),
          'dine-in': { netKwd: 50, orders: 5 },
          'talabat-tgo': { netKwd: 20, orders: 2 },
        },
      },
      'al-kout': {
        netKwd: 10,
        orders: 2,
        uiChannels: {
          ...buildEmptyChannels(),
          keeta: { netKwd: 10, orders: 2 },
        },
      },
      exhibitions: {
        netKwd: 10,
        orders: 2,
        uiChannels: {
          ...buildEmptyChannels(),
          'talabat-tgo': { netKwd: 5, orders: 1 },
          jahez: { netKwd: 5, orders: 1 },
        },
      },
      'school-canteens': {
        netKwd: 5,
        orders: 1,
        uiChannels: {
          ...buildEmptyChannels(),
          deliveroo: { netKwd: 5, orders: 1 },
        },
      },
    },
    mappedByLocation: {
      avenues: { netKwd: 70, orders: 7 },
      'al-kout': { netKwd: 10, orders: 2 },
      exhibitions: { netKwd: 10, orders: 2 },
      'school-canteens': { netKwd: 5, orders: 1 },
    },
    byBrand: Object.fromEntries(
      APPROVED_BRAND_IDS.map((bid) => [bid, { netKwd: 0, orders: 0, qty: 0 }]),
    ),
    uiChannels,
    unattributedSalesKwd: 5,
    unattributedOrders: 1,
    accounting,
  }

  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    syncedAt: '2026-11-18T10:55:00.000Z',
    lastSyncAt: '2026-11-18T10:55:00.000Z',
    latestRecordAt: '2026-11-18T10:50:00.000Z',
    latestOperationalDate: TODAY_ISO,
    period: { from: MTD_FROM, to: TODAY_ISO },
    dateRange: { from: MTD_FROM, to: TODAY_ISO },
    database: null,
    totals: { netSalesKwd: 100, orders: 13, aovKwd: round3(100 / 13) },
    brands: [],
    branches: [],
    channels: [],
    buckets: {
      today: { ...monthBucket, key: 'today', from: TODAY_ISO, to: '2026-11-19', days: 1 },
      week: { ...monthBucket, key: 'week', from: '2026-11-12', to: '2026-11-19', days: 7 },
      month: monthBucket,
      year: { ...monthBucket, key: 'year', from: '2026-01-01', to: '2026-11-19', days: 322 },
    },
    dailySeries: [{ day: TODAY_ISO, orders: 13, netKwd: 100 }],
    hourlySeries: [],
  }
}

function renderRadar(
  locale: 'ar' | 'en',
  filtersOverride: Partial<GlobalFilters>,
  summary: OdooLiveSummary,
  liveCube: OdooPeriodCube | null,
): string {
  const filters: GlobalFilters = {
    ...DEFAULT_GLOBAL_FILTERS,
    period: 'month',
    ...filtersOverride,
  }
  mockGlobalFilterState.current = {
    filters,
    workspace: computeGlobalWorkspace(filters, summary, '/erp/aggregator-radar'),
    liveSummary: summary,
    sessionRole: 'admin',
  } as unknown as GlobalFilterContextValue

  return renderToStaticMarkup(
    React.createElement(
      TypedLanguageProvider,
      { initialLocale: locale },
      React.createElement(DeliveryRadarWithCube, { initialLiveCube: liveCube }),
    ),
  )
}

describe('Aggregator Radar Accuracy (Fixes 1–5)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] })
    mockGlobalFilterState.current = null
  })

  afterEach(() => {
    vi.useRealTimers()
    mockGlobalFilterState.current = null
  })

  it('Fix 1: includes exhibition booths, school canteens, and extra active branches with exact sum equality across KPI 1, Donut, and Matrix', () => {
    const cube = buildStructuralCube()
    const vm = computeAggregatorRadarViewModel({
      odooConnected: true,
      noData: false,
      selectedBranch: 'all',
      selectedChannel: 'all',
      channelFilter: 'all',
      searchQuery: '',
      liveCube: cube,
      activeBucket: null,
    })

    // Matrix includes exhibition booths, school canteens, and unattributed rows
    const branchIds = new Set(vm.matrixRows.map((r) => r.branchId))
    expect(branchIds.has('exhibitions')).toBe(true)
    expect(branchIds.has('school-canteens')).toBe(true)
    expect(branchIds.has('unattributed')).toBe(true)
    expect(branchIds.has('avenues')).toBe(true)
    expect(branchIds.has('al-kout')).toBe(true)

    const exhibitionRow = vm.matrixRows.find(
      (r) => r.branchId === 'exhibitions' && r.channelKey === 'talabat-tgo',
    )
    const canteenRow = vm.matrixRows.find(
      (r) => r.branchId === 'school-canteens' && r.channelKey === 'deliveroo',
    )
    expect(exhibitionRow?.branchLabelAr).toBe('بوثات المعارض')
    expect(exhibitionRow?.branchLabelEn).toBe('Exhibition Booths')
    expect(exhibitionRow?.salesKwd).toBe(5)
    expect(canteenRow?.branchLabelAr).toBe('مقاصف المدارس')
    expect(canteenRow?.branchLabelEn).toBe('School canteens')
    expect(canteenRow?.salesKwd).toBe(5)

    // Donut slices match platform summaries with positive sales
    const donutByChannel = new Map(
      vm.platformSummaries
        .filter((p) => (p.salesKwd ?? 0) > 0)
        .map((p) => [p.key, p.salesKwd as number]),
    )

    // Per-platform matrix sum === platformSummaries[ch].salesKwd === donutSlices[ch].value EXACTLY
    for (const { key } of AGGREGATOR_CHANNELS) {
      const platformSummary = vm.platformSummaries.find((p) => p.key === key)
      const matrixPlatformSum = round3(
        vm.matrixRows
          .filter((r) => r.channelKey === key)
          .reduce((s, r) => s + (r.salesKwd ?? 0), 0),
      )
      expect(matrixPlatformSum).toBe(platformSummary?.salesKwd)
      if ((platformSummary?.salesKwd ?? 0) > 0) {
        expect(matrixPlatformSum).toBe(donutByChannel.get(key))
      }
    }

    // Total matrix sum === KPI 1 === Donut total EXACTLY (50.000 KWD, 8 payments)
    const donutTotal = round3([...donutByChannel.values()].reduce((s, v) => s + v, 0))
    const rawMatrixSum = round3(vm.matrixRows.reduce((s, r) => s + (r.salesKwd ?? 0), 0))
    expect(vm.totalAggregatorSalesKwd).toBe(50)
    expect(donutTotal).toBe(50)
    expect(rawMatrixSum).toBe(50)
    expect(vm.matrixTotals.salesKwd).toBe(50)
    expect(vm.matrixTotals.orders).toBe(8)
    expect(vm.matrixTotals.salesKwd).toBe(vm.totalAggregatorSalesKwd)
    expect(vm.matrixTotals.salesKwd).toBe(donutTotal)
    expect(vm.matrixTotals.shareOfAggregatorPct).toBe(100)

    // Any extra active branch outside GLOBAL_BRANCH_OPTIONS with aggregator sales is preserved with a readable fallback label
    const cubeWithExtra = buildStructuralCube({
      extraBranch: { id: 'pop-up-kiosk', channel: 'snoonu', netKwd: 10, orders: 2 },
    })
    const vmExtra = computeAggregatorRadarViewModel({
      odooConnected: true,
      noData: false,
      selectedBranch: 'all',
      selectedChannel: 'all',
      channelFilter: 'all',
      searchQuery: '',
      liveCube: cubeWithExtra,
      activeBucket: null,
    })
    const extraRow = vmExtra.matrixRows.find(
      (r) => r.branchId === 'pop-up-kiosk' && r.channelKey === 'snoonu',
    )
    expect(extraRow?.branchLabelEn).toBe('Pop Up Kiosk')
    expect(extraRow?.branchLabelEn).not.toBe('All Branches')
    expect(vmExtra.totalAggregatorSalesKwd).toBe(60)
    expect(vmExtra.matrixTotals.salesKwd).toBe(60)

    // Render AR & EN DOM and verify headings, booths, canteens, and totals row
    const summary = buildStructuralSummary()
    const htmlAr = renderRadar('ar', { period: 'month' }, summary, cube)
    const htmlEn = renderRadar('en', { period: 'month' }, summary, cube)

    expect(htmlAr).toContain('بوثات المعارض')
    expect(htmlAr).toContain('مقاصف المدارس')
    expect(htmlAr).toContain('data-matrix-totals-row="true"')
    expect(htmlAr).toContain('50.000')
    expect(htmlAr).not.toContain('(7 فروع + غير منسوب لفرع)')

    expect(htmlEn).toContain('Exhibition Booths')
    expect(htmlEn).toContain('School canteens')
    expect(htmlEn).toContain('data-matrix-totals-row="true"')
    expect(htmlEn).toContain('50.000')
    expect(htmlEn).not.toContain('(7 Branches + Unattributed)')
  })

  it('Fix 2: renders primary (commission / aggregator sales) and secondary (commission / total GL revenue) ratios in AR & EN', () => {
    const summary = buildStructuralSummary()
    const cube = buildStructuralCube({ accounting: summary.buckets?.month?.accounting ?? undefined })

    // Commission = 10 KWD, Aggregator sales = 50 KWD -> 20.0%
    // Commission = 10 KWD, Total GL revenue = 200 KWD -> 5.0%
    const htmlAr = renderRadar('ar', { period: 'month' }, summary, cube)
    const htmlEn = renderRadar('en', { period: 'month' }, summary, cube)

    expect(htmlAr).toContain('data-commission-ratio="aggregator"')
    expect(htmlAr).toContain('20.0% من مبيعات منصات التوصيل')
    expect(htmlAr).toContain('data-commission-ratio="total-revenue"')
    expect(htmlAr).toContain('5.0% من إجمالي الإيرادات (الدفتر العام)')

    expect(htmlEn).toContain('data-commission-ratio="aggregator"')
    expect(htmlEn).toContain('20.0% of aggregator sales')
    expect(htmlEn).toContain('data-commission-ratio="total-revenue"')
    expect(htmlEn).toContain('5.0% of total revenue (GL)')
  })

  it('Fix 3: populates commissionAccounts (code vs name_only), excludes non-commission expenses, and flags only name_only rows with accountant-confirmation chip', () => {
    const accountById = new Map([
      [1, { id: 1, code: '30001', name: 'POS Revenue', account_type: 'income' }],
      [2, { id: 2, code: '40224', name: 'Delivery App Commission', account_type: 'expense' }],
      [3, { id: 3, code: '49999', name: 'Talabat Promo Commission', account_type: 'expense' }],
      [4, { id: 4, code: '40900', name: 'Office Supplies', account_type: 'expense' }],
      [5, { id: 5, code: '40500', name: 'Kitchen Depreciation', account_type: 'expense_depreciation' }],
    ])

    const accounting = buildLedgerAccountingFromGroups({
      fromIso: MTD_FROM,
      toInclusiveIso: YESTERDAY_ISO,
      accountById,
      rows: [
        { account_id: [1, '30001 POS Revenue'], balance: -200, __count: 10 },
        { account_id: [2, '40224 Delivery App Commission'], balance: 5, __count: 2 },
        { account_id: [3, '49999 Talabat Promo Commission'], balance: 5, __count: 1 },
        { account_id: [4, '40900 Office Supplies'], balance: 10, __count: 1 },
        { account_id: [5, '40500 Kitchen Depreciation'], balance: 10, __count: 1 },
      ],
    })

    expect(accounting.deliveryCommissions).toBe(10)
    expect(accounting.commissionAccounts).toBeDefined()
    expect(accounting.commissionAccounts).toHaveLength(2)

    const codeRow = accounting.commissionAccounts?.find((a) => a.code === '40224')
    const nameOnlyRow = accounting.commissionAccounts?.find((a) => a.code === '49999')
    const nonCommRow = accounting.commissionAccounts?.find((a) => a.code === '40900')

    expect(codeRow).toMatchObject({
      code: '40224',
      name: 'Delivery App Commission',
      amountKwd: 5,
      matchedBy: 'code',
    })
    expect(nameOnlyRow).toMatchObject({
      code: '49999',
      name: 'Talabat Promo Commission',
      amountKwd: 5,
      matchedBy: 'name_only',
    })
    expect(nonCommRow).toBeUndefined()

    const summary = buildStructuralSummary({ accounting })
    const cube = buildStructuralCube({ accounting })

    const htmlAr = renderRadar('ar', { period: 'month' }, summary, cube)
    const htmlEn = renderRadar('en', { period: 'month' }, summary, cube)

    expect(htmlAr).toContain('data-commission-accounts-breakdown="true"')
    expect(htmlAr).toContain('تفصيل حسابات العمولات (2)')
    expect(htmlAr).toContain('40224')
    expect(htmlAr).toContain('Delivery App Commission')
    expect(htmlAr).toContain('49999')
    expect(htmlAr).toContain('Talabat Promo Commission')
    expect(htmlAr).toContain('5.000')
    expect(htmlAr).not.toContain('40900')

    expect(htmlEn).toContain('data-commission-accounts-breakdown="true"')
    expect(htmlEn).toContain('Commission accounts (2)')
    expect(htmlEn).toContain('40224')
    expect(htmlEn).toContain('49999')
    expect(htmlEn).not.toContain('40900')

    // Flag ONLY 49999 (name_only) — never 40224 (code)
    const arMatches = htmlAr.match(/data-commission-match="name-only"/g) ?? []
    const enMatches = htmlEn.match(/data-commission-match="name-only"/g) ?? []
    expect(arMatches).toHaveLength(1)
    expect(enMatches).toHaveLength(1)

    const arItems = htmlAr.match(/<li[\s\S]*?<\/li>/g) ?? []
    const ar40224Li = arItems.find((li) => li.includes('40224')) ?? ''
    const ar49999Li = arItems.find((li) => li.includes('49999')) ?? ''
    expect(ar40224Li).not.toContain('يحتاج تأكيد المحاسب')
    expect(ar49999Li).toContain('يحتاج تأكيد المحاسب')

    const enItems = htmlEn.match(/<li[\s\S]*?<\/li>/g) ?? []
    const en40224Li = enItems.find((li) => li.includes('40224')) ?? ''
    const en49999Li = enItems.find((li) => li.includes('49999')) ?? ''
    expect(en40224Li).not.toContain('Needs accountant confirmation')
    expect(en49999Li).toContain('Needs accountant confirmation')
  })

  it('Fix 4: uses "عدد الدفعات" / "Payments" and per-payment averages across KPIs, cards, donut, and matrix in AR & EN', () => {
    const summary = buildStructuralSummary()
    const cube = buildStructuralCube({ accounting: summary.buckets?.month?.accounting ?? undefined })

    const htmlAr = renderRadar('ar', { period: 'month' }, summary, cube)
    const htmlEn = renderRadar('en', { period: 'month' }, summary, cube)

    // Arabic wording
    expect(htmlAr).toContain('>عدد الدفعات<')
    expect(htmlAr).toContain('>متوسط الدفعة<')
    expect(htmlAr).toContain('عدد الدفعات: 8')
    expect(htmlAr).toContain('5 دفعة مباشرة بدون عمولة تطبيقات')
    expect(htmlAr).toContain('مبيعات وعدد دفعات كل منصة توصيل')
    expect(htmlAr).toContain('3 دفعة')
    expect(htmlAr).not.toContain('طلب مباشر')

    // English wording
    expect(htmlEn).toContain('>Payments<')
    expect(htmlEn).toContain('>Avg per Payment<')
    expect(htmlEn).toContain('8 payments • Avg per payment')
    expect(htmlEn).toContain('5 direct payments without aggregator commission')
    expect(htmlEn).toContain('3 payments')
    expect(htmlEn).not.toContain('Payouts / Batches')
    expect(htmlEn).not.toContain('payouts / batches')
    expect(htmlEn).not.toContain('Avg per Payout')
    expect(htmlEn).not.toContain('Avg per payout')
    expect(htmlEn).not.toContain('direct orders')
    expect(htmlEn).not.toMatch(/\b\d+\s+orders\b/i)
  })

  it('Fix 5: resolves "month" preset to calendar MTD (1st to today, not rolling 30d) and shows GL end date on KPI 3 when GL ends at yesterday', () => {
    // Summary whose month bucket has rolling-30 dates (2026-10-20 -> 2026-11-19 exclusive)
    // and GL ending at yesterday (2026-11-17) while Kuwait today is 2026-11-18
    const summary = buildStructuralSummary({
      monthFrom: '2026-10-20',
      monthTo: '2026-11-19',
    })

    const mtdWithSummary = formatPeriodCalendarWindow('month', { liveSummary: summary })
    expect(mtdWithSummary.fromIso).toBe('2026-11-01')
    expect(mtdWithSummary.toInclusiveIso).toBe('2026-11-18')
    expect(mtdWithSummary.fromIso).not.toBe('2026-10-20')

    const mtdWithoutSummary = formatPeriodCalendarWindow('month')
    expect(mtdWithoutSummary.fromIso).toBe('2026-11-01')
    expect(mtdWithoutSummary.toInclusiveIso).toBe('2026-11-18')

    const cube = buildStructuralCube({ accounting: summary.buckets?.month?.accounting ?? undefined })
    const htmlAr = renderRadar('ar', { period: 'month' }, summary, cube)
    const htmlEn = renderRadar('en', { period: 'month' }, summary, cube)

    // Header reflects calendar MTD, not rolling-30
    expect(htmlAr).toContain('2026-11-01 → 2026-11-18')
    expect(htmlAr).not.toContain('2026-10-20')
    expect(htmlEn).toContain('2026-11-01 → 2026-11-18')
    expect(htmlEn).not.toContain('2026-10-20')

    // KPI 3 Commission Card visibly renders GL end date (2026-11-17) in AR & EN
    expect(htmlAr).toContain('data-gl-end-date="2026-11-17"')
    expect(htmlAr).toContain('قيود الدفتر حتى 2026-11-17')
    expect(htmlEn).toContain('data-gl-end-date="2026-11-17"')
    expect(htmlEn).toContain('GL posted through 2026-11-17')
  })
})
