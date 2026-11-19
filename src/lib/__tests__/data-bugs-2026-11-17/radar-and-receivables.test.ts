import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OdooBucketSummary, OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { bustOdooLiveCache, fetchLiveOdooSnapshot, type OdooPeriodCube } from '@/lib/odoo-live-connector'
import { mergeSessionPaymentGroups } from '@/lib/odoo/pos-order-query'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  DEFAULT_GLOBAL_FILTERS,
  computeGlobalWorkspace,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { normalizeComparisonQueryWindows } from '@/lib/erp-comparison-engine'
import {
  resolveReceivablesDateRange,
  selectReceivablesHeadline,
} from '@/lib/aether/receivables-headline'

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
import { DeliveryRadarV5 } from '@/components/aether/DeliveryRadarV5'

const TypedLanguageProvider = LanguageProvider as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

const DeliveryRadarWithCube = DeliveryRadarV5 as React.ComponentType<{
  initialLiveCube?: OdooPeriodCube | null
}>

const FIXTURE_NOW = new Date('2026-11-17T11:30:00.000Z')
const TODAY_ISO = '2026-11-17'
const ALL_BRANCH_KEYS = [...APPROVED_BRANCH_IDS, 'school-canteens'] as const
const ODOO_ENV_KEYS = ['ODOO_URL', 'ODOO_DB', 'ODOO_USERNAME', 'ODOO_LOGIN', 'ODOO_API_KEY'] as const

function buildEmptyChannels() {
  return Object.fromEntries(
    APPROVED_CHANNEL_IDS.map((ch) => [ch, { netKwd: 0, orders: 0 }]),
  ) as OdooPeriodCube['byChannel']
}

function buildRadarTodayCube(): OdooPeriodCube {
  const byBranch = {} as OdooPeriodCube['byBranch']
  for (const br of ALL_BRANCH_KEYS) {
    byBranch[br] = {
      netKwd: 0,
      orders: 0,
      aovKwd: 0,
      channels: buildEmptyChannels(),
    }
  }
  // Today's Al-Kout partial day: Talabat 31.200 (5) + Keeta 19.200 (4) = 50.400 KWD / 9 payments
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
      netSalesKwd: 214.5,
      orders: 43,
      aovKwd: 4.988,
      mappedBranchesNetKwd: 214.5,
      mappedBranchesOrders: 43,
      unattributedSalesKwd: 0,
      unattributedOrders: 0,
      excludedEntitiesKwd: 0,
      excludedEntitiesOrders: 0,
      totalDiscountKwd: 0,
      avgDiscountPct: 0,
      discountedLinesCount: 0,
    },
    byBranch,
    unattributed: {
      id: 'unattributed',
      labelAr: 'غير منسوب لفرع',
      labelEn: 'Unattributed to Branch',
      netKwd: 0,
      orders: 0,
      aovKwd: 0,
      channels: buildEmptyChannels(),
    },
    byBrand: Object.fromEntries(
      APPROVED_BRAND_IDS.map((bid) => [
        bid,
        { netKwd: 0, qty: 0, linesCount: 0, orders: 0, avgDiscountPct: 0, discountKwd: 0 },
      ]),
    ) as OdooPeriodCube['byBrand'],
    brandByBranch: {},
    byChannel: {
      ...buildEmptyChannels(),
      'dine-in': { netKwd: 164.1, orders: 34 },
      'talabat-tgo': { netKwd: 31.2, orders: 5 },
      keeta: { netKwd: 19.2, orders: 4 },
    },
    dailySeries: [],
    dailyByBranch: {},
    dailyUnattributed: {},
    hourlySeries: [],
    hourlyByBranch: {},
    topProducts: [],
  }
}

function buildRadarSummary(
  receivableOverrides: Partial<NonNullable<OdooLiveSummary['aggregatorReceivables']>> = {},
): OdooLiveSummary {
  const todayChannels = {
    ...buildEmptyChannels(),
    'dine-in': { netKwd: 164.1, orders: 34 },
    'talabat-tgo': { netKwd: 31.2, orders: 5 },
    keeta: { netKwd: 19.2, orders: 4 },
  }
  const todayBucket: OdooBucketSummary = {
    key: 'today',
    from: TODAY_ISO,
    to: '2026-11-18',
    days: 1,
    totals: {
      netSalesKwd: 214.5,
      orders: 43,
      aovKwd: 4.988,
      restaurantNetKwd: 214.5,
      restaurantOrders: 43,
    },
    byLocation: {
      'al-kout': {
        netKwd: 214.5,
        orders: 43,
        uiChannels: todayChannels,
      },
    },
    mappedByLocation: {
      'al-kout': { netKwd: 214.5, orders: 43 },
    },
    byBrand: Object.fromEntries(
      APPROVED_BRAND_IDS.map((bid) => [bid, { netKwd: 0, orders: 0, qty: 0 }]),
    ),
    uiChannels: todayChannels,
    unattributedSalesKwd: 0,
    unattributedOrders: 0,
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
    totals: { netSalesKwd: 214.5, orders: 43, aovKwd: 4.988 },
    brands: [],
    branches: [],
    channels: [],
    buckets: {
      today: todayBucket,
      month: { ...todayBucket, key: 'month' },
    },
    dailySeries: [{ day: TODAY_ISO, orders: 43, netKwd: 214.5 }],
    hourlySeries: [],
    aggregatorReceivables: {
      readable: true,
      openReceivableKwd: -77462.759,
      grossPositiveReceivableKwd: 10000,
      creditClearingOffsetKwd: -87462.759,
      openLinesCount: 412,
      fromDate: '2025-01-15',
      toDate: '2026-11-14',
      agingBasis: 'open-debits-by-due-date',
      agingBuckets: [
        {
          key: '0_30',
          labelAr: '0–30 يوماً',
          labelEn: '0–30 days',
          residualKwd: 10000,
          positiveDebitKwd: 10000,
          creditOffsetKwd: 0,
          linesCount: 42,
        },
      ],
      openDebitsKwd: 10000,
      unappliedCreditsKwd: -87462.759,
      unappliedCreditLinesCount: 370,
      ...receivableOverrides,
    },
  }
}

function renderRadar(
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

describe('Bug B — Aggregator Radar today cube parity, dateRange badge & payment count semantics', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] })
    mockGlobalFilterState.current = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses today cube when A == B == today, renders cube dateRange next to matrix title, and reconciles Al-Kout row sum to 50.400 / 9', () => {
    // DeliveryRadarV5 requests live-comparison with fromA=toA=fromB=toB=today
    const norm = normalizeComparisonQueryWindows({
      mode: 'date-vs-date',
      granularity: 'single',
      periodA: { from: TODAY_ISO, to: TODAY_ISO },
      periodB: { from: TODAY_ISO, to: TODAY_ISO },
      brandIds: 'all',
      branchIds: 'all',
      channelIds: 'all',
    })
    expect(norm.normA.fromIso).toBe(TODAY_ISO)
    expect(norm.normA.toIso).toBe(TODAY_ISO)

    const todayCube = buildRadarTodayCube()
    const summary = buildRadarSummary()

    // Row sum for Al-Kout in cube equals Al-Kout aggregator total (31.200 + 19.200 = 50.400 KWD, 5 + 4 = 9 payments)
    const aggregatorKeys = ['talabat-tgo', 'talabat-tmp', 'keeta', 'deliveroo', 'jahez', 'snoonu'] as const
    const alKoutRowSumKwd = Number(
      aggregatorKeys
        .reduce((s, k) => s + todayCube.byBranch['al-kout'].channels[k].netKwd, 0)
        .toFixed(3),
    )
    const alKoutRowSumPayments = aggregatorKeys.reduce(
      (s, k) => s + todayCube.byBranch['al-kout'].channels[k].orders,
      0,
    )
    expect(alKoutRowSumKwd).toBe(50.4)
    expect(alKoutRowSumPayments).toBe(9)

    // Render Radar with branch=al-kout and today's cube: summary card (50.400) and matrix rows (31.200 + 19.200) match,
    // and the cube's actual dateRange is rendered next to the matrix title
    const htmlAr = renderRadar('ar', { period: 'today', branch: 'al-kout' }, summary, todayCube)
    expect(htmlAr).toContain('50.400')
    expect(htmlAr).toContain('31.200')
    expect(htmlAr).toContain('19.200')
    expect(htmlAr).not.toContain('92.350')
    expect(htmlAr).not.toContain('58.100')
    expect(htmlAr).toContain('data-matrix-date-range="true"')
    expect(htmlAr).toContain(`${TODAY_ISO} → ${TODAY_ISO}`)

    // Even if a cube had a different dateRange, the matrix header explicitly displays that cube's dateRange
    const mismatchedCube = buildRadarTodayCube()
    mismatchedCube.dateRange = { from: '2026-11-16', to: '2026-11-16' }
    const htmlMismatchEn = renderRadar('en', { period: 'today', branch: 'al-kout' }, summary, mismatchedCube)
    expect(htmlMismatchEn).toContain('2026-11-16 → 2026-11-16')
  })

  it('documents split-tender payment count behaviour and labels the matrix column Payments', () => {
    // 1 split-tender order (#9001) paid half Cash (5.000) + half KNET (5.000) in session 701 produces __count = 1 on each payment_method_id (total 2 payments for 1 order)
    const merged = mergeSessionPaymentGroups(
      [
        { session_id: [701, 'POS/701'], payment_method_id: [1, 'Cash'], amount: 5, __count: 1 },
        { session_id: [701, 'POS/701'], payment_method_id: [2, 'KNET'], amount: 5, __count: 1 },
      ],
      [
        { session_id: [701, 'POS/701'], payment_method_id: [1, 'Cash'], __count: 1 },
        { session_id: [701, 'POS/701'], payment_method_id: [2, 'KNET'], __count: 1 },
      ],
    )
    const totalPaymentLines = merged.reduce((s, r) => s + r.orders, 0)
    expect(totalPaymentLines).toBe(2)

    const connectorSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/odoo-live-connector.ts'),
      'utf8',
    )
    expect(connectorSrc).toMatch(/split-tender/i)

    const todayCube = buildRadarTodayCube()
    const summary = buildRadarSummary()
    const htmlAr = renderRadar('ar', { period: 'today', branch: 'al-kout' }, summary, todayCube)
    const htmlEn = renderRadar('en', { period: 'today', branch: 'al-kout' }, summary, todayCube)
    expect(htmlAr).toContain('عدد الدفعات')
    expect(htmlEn).toContain('Payments')
    // Aggregator counts are payments, never "orders".
    expect(htmlEn).not.toMatch(/\d orders • AOV/)
  })
})

describe('Bug C — Open Unreconciled Receivables positive headline, unapplied credits breakdown & honest null fromDate', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] })
    mockGlobalFilterState.current = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
  })

  it('selectReceivablesHeadline: debits 10,000 and credits -87,462.759 -> headline 10,000, credits -87,462.759, net -77,462.759, and headline is never < 0', () => {
    const res = selectReceivablesHeadline({
      openDebitsKwd: 10000,
      unappliedCreditsKwd: -87462.759,
      openReceivableKwd: -77462.759,
      unreconciledLineCount: 412,
    })
    expect(res).toEqual({
      openDebitsKwd: 10000,
      unappliedCreditsKwd: -87462.759,
      netKwd: -77462.759,
      lines: 412,
    })
    expect(res.openDebitsKwd).not.toBeNull()
    expect(res.openDebitsKwd!).toBeGreaterThanOrEqual(0)

    // Even if malformed negative openDebitsKwd is passed, headline is clamped >= 0
    const clamped = selectReceivablesHeadline({
      openDebitsKwd: -50,
      unappliedCreditsKwd: -100,
      openReceivableKwd: -150,
      unreconciledLineCount: 3,
    })
    expect(clamped.openDebitsKwd).toBe(0)

    expect(
      resolveReceivablesDateRange(
        { fromDate: TODAY_ISO, toDate: '2026-11-14' },
        { readable: true, fromDate: null, toDate: '2026-11-14' },
      ),
    ).toBe('—')
    expect(
      resolveReceivablesDateRange(
        { fromDate: '2025-01-15', toDate: '2026-11-14' },
        { readable: true, fromDate: '2025-01-15', toDate: '2026-11-14' },
      ),
    ).toEqual({ from: '2025-01-15', to: '2026-11-14' })

    const summary = buildRadarSummary()
    const ws = computeGlobalWorkspace({ ...DEFAULT_GLOBAL_FILTERS, period: 'today' }, summary)
    expect(ws.receivables.pendingReconciliation).toBe(true)
    expect(ws.receivables.agingBuckets).toEqual([])
    expect(ws.receivables.openReceivableKwd).toBe(-77462.759)
    expect(summary.aggregatorReceivables?.openReceivableKwd).toBe(-77462.759)

    const htmlAr = renderRadar('ar', { period: 'today' }, summary, buildRadarTodayCube())
    const arCard =
      htmlAr.split('مبيعات ودفعات كل منصة توصيل')[0]?.split('الذمم المدينة المفتوحة للمنصات والمقاصة')[1] ?? ''
    expect(arCard).toContain('10,000.000')
    expect(arCard).not.toContain('بانتظار مراجعة المحاسبة')
    expect(arCard).not.toMatch(/overdue|متأخر|مستحق/i)

    const htmlEn = renderRadar('en', { period: 'today' }, summary, buildRadarTodayCube())
    const enCard =
      htmlEn.split('Sales by Delivery Platform')[0]?.split('Open Unreconciled Receivables')[1] ?? ''
    expect(enCard).toContain('10,000.000')
    expect(enCard).not.toMatch(/overdue/i)
  })

  it('missing min date in odoo-live-connector returns fromDate === null (no 2024-12-31) and DeliveryRadarV5 renders window as "—"', async () => {
    const saved: Partial<Record<(typeof ODOO_ENV_KEYS)[number], string | undefined>> = {}
    for (const key of ODOO_ENV_KEYS) saved[key] = process.env[key]
    process.env.ODOO_URL = 'https://localhost:8069'
    process.env.ODOO_DB = 'vf_test'
    process.env.ODOO_USERNAME = 'bi@example.com'
    process.env.ODOO_API_KEY = 'test_key'
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })

    try {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number
          params?: { service?: string; method?: string; args?: unknown[] }
        }
        const rpcOk = (result: unknown) =>
          new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, result }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })

        if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
          return rpcOk(7)
        }
        const args = body.params?.args ?? []
        const model = String(args[3] ?? '')
        const method = String(args[4] ?? '')
        const kwargs = (args[6] as Record<string, unknown> | undefined) ?? {}

        if (model === 'pos.config' && method === 'search_read') {
          return rpcOk([{ id: 8, name: 'Promenade 1', active: true, company_id: [1, 'Venture Foods'] }])
        }
        if (model === 'res.users' && method === 'read') {
          return rpcOk([{ id: 7, company_id: [1, 'Venture Foods'] }])
        }
        if (model === 'pos.order' && method === 'search_read') {
          return rpcOk([
            {
              id: 1,
              date_order: '2026-11-17 09:00:00',
              amount_total: 100,
              config_id: [8, 'Promenade 1'],
              company_id: [1, 'Venture Foods'],
            },
          ])
        }
        if (model === 'account.move.line' && method === 'read_group') {
          return rpcOk([
            { account_id: [101, '10552 Account Receivable (PoS)'], amount_residual: -77462.759, __count: 10 },
          ])
        }
        if (model === 'account.move.line' && method === 'search_read') {
          // Simulate min-date read failing/empty while max-date succeeds
          if (kwargs.order === 'date asc') return rpcOk([])
          if (kwargs.order === 'date desc') return rpcOk([{ date: '2026-11-14' }])
          return rpcOk([])
        }
        return rpcOk([])
      })

      const snapshot = await fetchLiveOdooSnapshot({
        period: 'today',
        forceRefresh: true,
        referenceNowMs: FIXTURE_NOW.getTime(),
      })

      expect(snapshot.aggregatorReceivables?.readable).toBe(true)
      expect(snapshot.aggregatorReceivables?.fromDate).toBeNull()
      expect(snapshot.aggregatorReceivables?.fromDate).not.toBe('2024-12-31')
      expect(snapshot.aggregatorReceivables?.toDate).toBe('2026-11-14')

      // Render DeliveryRadarV5 with fromDate === null -> receivables card badge renders "—", never 2024-12-31 or today's date
      const summaryNoFrom = buildRadarSummary({ fromDate: null, toDate: '2026-11-14' })
      const htmlEn = renderRadar('en', { period: 'today' }, summaryNoFrom, buildRadarTodayCube())
      const enCard =
        htmlEn.split('Sales by Delivery Platform')[0]?.split('Open Unreconciled Receivables')[1] ?? ''
      expect(enCard).not.toContain('2024-12-31')
      expect(enCard).not.toContain(`${TODAY_ISO} → 2026-11-14`)
      expect(enCard).toContain('Date Range: —')
    } finally {
      for (const key of ODOO_ENV_KEYS) {
        if (saved[key] === undefined) delete process.env[key]
        else process.env[key] = saved[key]
      }
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
    }
  })
})
