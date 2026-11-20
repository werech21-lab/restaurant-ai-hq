import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authSessionState = vi.hoisted(() => ({
  ok: true,
  session: {
    sub: 'exec-admin-1',
    userId: 'exec-admin-1',
    email: 'admin@venturefoods.kw',
    role: 'admin',
  },
}))

const mockFilterState = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}))

vi.mock('@/lib/auth/api-guard', () => ({
  ENTERPRISE_API_SECURITY_HEADERS: {
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
  },
  executiveAiBurstLimiter: {
    check: () => ({ allowed: true, retryAfterSeconds: 0 }),
  },
  buildRateLimitedJsonResponse: (retryAfterSeconds: number) =>
    Response.json({ ok: false, error: 'RATE_LIMITED', retryAfterSeconds }, { status: 429 }),
  requireExecApiSession: vi.fn(async (_req: unknown, opts?: { allowAuditor?: boolean }) => {
    if (!authSessionState.ok) {
      return {
        ok: false as const,
        response: Response.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 }),
      }
    }
    if (authSessionState.session.role === 'auditor' && opts?.allowAuditor === false) {
      return {
        ok: false as const,
        response: Response.json({ ok: false, error: 'FORBIDDEN_AUDITOR' }, { status: 403 }),
      }
    }
    return {
      ok: true as const,
      session: { ...authSessionState.session },
    }
  }),
}))

vi.mock('@/server/ai/persist', () => ({
  persistAiRuns: vi.fn(async () => undefined),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    prefetch,
    ...rest
  }: {
    href: string
    children?: React.ReactNode
    prefetch?: boolean
    [key: string]: unknown
  }) =>
    React.createElement(
      'a',
      {
        href,
        'data-prefetch': prefetch === undefined ? undefined : String(prefetch),
        ...rest,
      },
      children,
    ),
}))

vi.mock('@/components/aether/GlobalFilterContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/aether/GlobalFilterContext')>()
  return {
    ...actual,
    useGlobalFilter: () => {
      if (!mockFilterState.current) {
        throw new Error('mockFilterState.current must be initialized before rendering studio')
      }
      return mockFilterState.current
    },
  }
})

import {
  DEFAULT_GLOBAL_FILTERS,
  computeGlobalWorkspace,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import {
  ERP_BUST_CACHE_EVENT,
  ERP_ODOO_SYNC_EVENT,
  ERP_READ_CACHE_PREFIX,
  bustErpReadCache,
  fetchWithErpReadCache,
  inspectErpReadCacheEntry,
  peekErpReadCache,
  writeErpReadCache,
} from '@/lib/erp-read-cache'
import {
  buildOdooReadResponseHeaders,
  deduplicateServerGet,
  isForceRefreshSearchParams,
  odooSyncResponseHeaders,
  odooSyncSwrGetHeaders,
} from '@/app/api/odoo-sync/route'
import { CORE_EXECUTIVE_PREFETCH_ROUTES } from '@/components/erp-sidebar'
import { LanguageProvider as I18nProvider } from '@/lib/i18n'
import { PartialWarningBanner } from '@/components/ui/partial-warning-banner'
import { OdooPartialWarningBanner } from '@/components/erp/OdooPartialWarningBanner'
import { DeliveryRadarV5 } from '@/components/aether/DeliveryRadarV5'
import { FullJourney360 } from '@/components/aether/FullJourney360'
import { CoresHubStudio } from '@/components/aether/CoresHubStudio'
import { WarehouseDailyChainStudio } from '@/components/erp/WarehouseDailyChainStudio'
import { OdooAccountingAnalyticsHub } from '@/components/accounting/OdooAccountingAnalyticsHub'
import { ReceivablesAgingStudio } from '@/components/erp/ReceivablesAgingStudio'
import { ExecutivePnlStudio } from '@/components/erp/ExecutivePnlStudio'
import { StrategicPlanningStudio } from '@/components/erp/StrategicPlanningStudio'
import { BoothStudyV5 } from '@/components/aether/BoothStudyV5'
import {
  KpiProvenanceBadge,
  computeCollisionAwarePopoverCoords,
} from '@/components/erp/KpiProvenanceBadge'
import {
  FERYAL_PROMPT_MAX_VH_RATIO,
  applyFeryalPromptAutoResize,
  computeFeryalPromptResize,
  shouldSubmitFeryalPromptOnKeyDown,
} from '@/components/erp/feryal-governance-studio'
import { runFeryalVisionAnalysis } from '@/lib/feryal-multimodal'
import {
  DELETE as deleteFeryalThreads,
  GET as getFeryalThreads,
  POST as postFeryalThreads,
} from '@/app/api/erp/feryal/threads/route'
import { POST as postFeryalVision } from '@/app/api/erp/feryal/vision/route'
import {
  buildLiveDecisionSnapshotFromSummary,
  generateLiveOdooDecisionSnapshot,
} from '@/lib/aether/live-decision-generator'
import {
  LABEL_DETERMINISTIC_SIM,
  LABEL_MANUAL_WHAT_IF,
  LABEL_ODOO_ACTUAL,
  buildStrategicAdvisorFallback,
  computeStrategicPlanning,
  computeWhatIfStrategicSimulation,
  extractOdooVerifiedPlanningActuals,
} from '@/lib/aether/strategic-planning-engine'
import { POST as postPlanningAdvisor } from '@/app/api/erp/planning-advisor/route'
import {
  GET as getCouncilDecisions,
  POST as postCouncilDecisions,
} from '@/app/api/erp/council/decisions/route'
import type { OdooBucketSummary, OdooLiveSummary } from '@/lib/odoo/live-sync-core'

const TypedI18nProvider = I18nProvider as unknown as React.ComponentType<{
  initialLocale?: 'ar' | 'en'
  children?: React.ReactNode
}>

const TypedDeliveryRadarV5 = DeliveryRadarV5 as unknown as React.ComponentType<{
  initialShowZeroRows?: boolean
}>

const TypedCoresHubStudio = CoresHubStudio as unknown as React.ComponentType<{
  initialTab?: 'sales' | 'marketing' | 'menu'
}>

function renderStudio(locale: 'ar' | 'en', node: React.ReactElement): string {
  return renderToStaticMarkup(
    React.createElement(TypedI18nProvider, { initialLocale: locale }, node),
  )
}

function buildExecutiveFixtureSummary(overrides: Partial<OdooLiveSummary> = {}): OdooLiveSummary {
  const monthBucket: OdooBucketSummary = {
    key: 'month',
    from: '2026-10-20',
    to: '2026-11-18',
    days: 30,
    totals: {
      netSalesKwd: 48250.75,
      orders: 11240,
      aovKwd: 4.293,
      restaurantNetKwd: 46800.5,
      restaurantOrders: 10900,
    },
    byBrand: {
      'china-garden': { netKwd: 16400.25, orders: 3600 },
      franks: { netKwd: 10250.5, orders: 2450 },
      tahina: { netKwd: 8100.0, orders: 2100 },
      'farm-brown': { netKwd: 5500.0, orders: 1250 },
      'noodle-bar': { netKwd: 4800.0, orders: 1090 },
      'karak-cafeteria': { netKwd: 3200.0, orders: 750 },
    },
    byLocation: {
      avenues: {
        netKwd: 12400.5,
        orders: 2800,
        uiChannels: {
          'dine-in': { netKwd: 5100.25, orders: 1100 },
          'takeaway-direct': { netKwd: 1900.25, orders: 450 },
          'talabat-tgo': { netKwd: 3200.0, orders: 750 },
          'talabat-tmp': { netKwd: 0, orders: 0 },
          deliveroo: { netKwd: 2200.0, orders: 500 },
          keeta: { netKwd: 0, orders: 0 },
          jahez: { netKwd: 0, orders: 0 },
          snoonu: { netKwd: 0, orders: 0 },
          cari: { netKwd: 0, orders: 0 },
        },
      },
      '360-mall': {
        netKwd: 9800.25,
        orders: 2200,
        uiChannels: {
          'dine-in': { netKwd: 4200.25, orders: 900 },
          'takeaway-direct': { netKwd: 1600.0, orders: 380 },
          'talabat-tgo': { netKwd: 2600.0, orders: 600 },
          'talabat-tmp': { netKwd: 0, orders: 0 },
          deliveroo: { netKwd: 1400.0, orders: 320 },
          keeta: { netKwd: 0, orders: 0 },
          jahez: { netKwd: 0, orders: 0 },
          snoonu: { netKwd: 0, orders: 0 },
          cari: { netKwd: 0, orders: 0 },
        },
      },
      promenade: {
        netKwd: 6450.0,
        orders: 1520,
        uiChannels: {
          'dine-in': { netKwd: 2450.0, orders: 560 },
          'takeaway-direct': { netKwd: 1000.0, orders: 240 },
          'talabat-tgo': { netKwd: 2000.0, orders: 480 },
          'talabat-tmp': { netKwd: 0, orders: 0 },
          deliveroo: { netKwd: 1000.0, orders: 240 },
          keeta: { netKwd: 0, orders: 0 },
          jahez: { netKwd: 0, orders: 0 },
          snoonu: { netKwd: 0, orders: 0 },
          cari: { netKwd: 0, orders: 0 },
        },
      },
      salmiya: { netKwd: 5900.0, orders: 1400 },
      assima: { netKwd: 5200.0, orders: 1210 },
      'al-kout': { netKwd: 4400.0, orders: 1020 },
      ardiya: { netKwd: 2650.0, orders: 750 },
      exhibitions: { netKwd: 1450.0, orders: 340 },
    },
    uiChannels: {
      'dine-in': { netKwd: 16500.5, orders: 3650 },
      'takeaway-direct': { netKwd: 6250.25, orders: 1510 },
      'talabat-tgo': { netKwd: 14500.0, orders: 3480 },
      'talabat-tmp': { netKwd: 0, orders: 0 },
      deliveroo: { netKwd: 8200.0, orders: 1920 },
      keeta: { netKwd: 2800.0, orders: 680 },
      jahez: { netKwd: 0, orders: 0 },
      snoonu: { netKwd: 0, orders: 0 },
      cari: { netKwd: 0, orders: 0 },
    },
    unattributedSalesKwd: 0,
    unattributedOrders: 0,
    accounting: {
      available: true,
      from: '2026-10-20',
      to: '2026-11-18',
      sourceModel: 'account.move.line',
      lineCount: 240,
      income: 48250.75,
      otherIncome: 0,
      totalRevenue: 48250.75,
      cogs: 14957.733,
      deliveryCommissions: 4120.5,
      deliveryCommissionLinesCount: 18,
      expense: 11200.25,
      depreciation: 1400.0,
      otherOpexAndDepreciation: 12600.25,
      operatingProfit: 16572.267,
      completeAccrualPosted: true,
      glIncomplete: false,
      aggregatorCommissionUnposted: false,
    },
  }

  const todayBucket: OdooBucketSummary = {
    ...monthBucket,
    key: 'today',
    from: '2026-11-18',
    to: '2026-11-18',
    days: 1,
    totals: {
      netSalesKwd: 1845.5,
      orders: 430,
      aovKwd: 4.292,
      restaurantNetKwd: 1845.5,
      restaurantOrders: 430,
    },
    byLocation: {
      avenues: { netKwd: 1100.5, orders: 250 },
      '360-mall': { netKwd: 745.0, orders: 180 },
    },
    unattributedSalesKwd: 0,
    unattributedOrders: 0,
    unattributedBranch: {
      id: 'unattributed',
      labelAr: 'غير منسوب لفرع',
      labelEn: 'Unattributed to Branch',
      netSalesKwd: 0,
      orders: 0,
      sharePct: 0,
    },
    accounting: {
      available: false,
      from: '2026-11-18',
      to: '2026-11-18',
      sourceModel: 'account.move.line',
      lineCount: 0,
      income: 0,
      otherIncome: 0,
      totalRevenue: 0,
      cogs: 0,
      deliveryCommissions: 0,
      deliveryCommissionLinesCount: 0,
      expense: 0,
      depreciation: 0,
      otherOpexAndDepreciation: 0,
      operatingProfit: 0,
      completeAccrualPosted: false,
      glIncomplete: true,
      aggregatorCommissionUnposted: true,
    },
  }

  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    partial: true,
    warningAr: 'بعض الأرقام غير متاحة الآن',
    warningEn: 'Some figures are temporarily unavailable',
    unavailableSections: ['stockTransfers'],
    syncedAt: '2026-11-18T18:30:00.000Z',
    lastSyncAt: '2026-11-18T18:30:00.000Z',
    latestOperationalDate: '2026-11-18',
    period: { from: '2026-10-20', to: '2026-11-18' },
    database: null,
    totals: {
      netSalesKwd: 48250.75,
      orders: 11240,
      aovKwd: 4.293,
    },
    unattributedSalesKwd: 0,
    unattributedOrders: 0,
    brands: [
      { id: 'china-garden', brand: 'China Garden', netKwd: 16400.25, sharePct: 34 },
      { id: 'franks', brand: 'Franks', netKwd: 10250.5, sharePct: 21.2 },
    ],
    branches: [
      { id: 'avenues', name: 'Avenues', unit: 'Venture Foods', netSalesKwd: 12400.5, orders: 2800, sharePct: 25.7 },
      { id: 'promenade', name: 'Promenade', unit: 'Venture Foods', netSalesKwd: 6450.0, orders: 1520, sharePct: 13.4 },
      { id: 'ardiya', name: 'Ardiya', unit: 'Venture Foods', netSalesKwd: 2650.0, orders: 750, sharePct: 5.5 },
    ],
    channels: [
      { name: 'dine-in', amountKwd: 16500.5 },
      { name: 'talabat-tgo', amountKwd: 14500.0 },
    ],
    buckets: {
      today: todayBucket,
      month: monthBucket,
      year: {
        ...monthBucket,
        key: 'year',
        from: '2026-01-01',
        to: '2026-11-18',
        days: 322,
        totals: {
          netSalesKwd: 498250.5,
          orders: 115200,
          aovKwd: 4.325,
          restaurantNetKwd: 482000.0,
          restaurantOrders: 111500,
        },
      },
    },
    dailySeries: [
      { day: '2026-11-17', orders: 510, netKwd: 2248.0 },
      { day: '2026-11-18', orders: 430, netKwd: 1845.5 },
    ],
    hourlySeries: [
      { hour: 13, orders: 180, netKwd: 780.5 },
      { hour: 15, orders: 32, netKwd: 128.0 },
      { hour: 16, orders: 28, netKwd: 112.5 },
      { hour: 17, orders: 35, netKwd: 140.0 },
      { hour: 20, orders: 260, netKwd: 1140.25 },
    ],
    aggregatorReceivables: {
      readable: true,
      openReceivableKwd: 8420.5,
      grossPositiveReceivableKwd: 9771.872,
      creditClearingOffsetKwd: -1351.372,
      openLinesCount: 34,
      fromDate: '2026-10-20',
      toDate: '2026-11-18',
      agingBuckets: [
        {
          key: '0_30',
          labelAr: '0–30 يوماً',
          labelEn: '0–30 days',
          positiveDebitKwd: 7220.5,
          creditOffsetKwd: -1351.372,
          residualKwd: 5869.128,
          linesCount: 25,
        },
        {
          key: '31_60',
          labelAr: '31–60 يوماً',
          labelEn: '31–60 days',
          positiveDebitKwd: 1651.372,
          creditOffsetKwd: 0,
          residualKwd: 1651.372,
          linesCount: 6,
        },
        {
          key: 'over_60',
          labelAr: 'أكثر من 60 يوماً',
          labelEn: 'Over 60 days',
          positiveDebitKwd: 900.0,
          creditOffsetKwd: 0,
          residualKwd: 900.0,
          linesCount: 3,
        },
      ],
      byAccount: [
        {
          accountId: 401,
          accountCode: '121200',
          accountName: 'Talabat Receivable',
          labelAr: 'ذمم طلبات',
          labelEn: 'Talabat Receivable',
          residualKwd: 5420.5,
          linesCount: 19,
        },
      ],
      byPartner: [
        {
          partnerId: 801,
          partnerName: 'Talabat General Trading',
          accountId: 401,
          accountCode: '121200',
          accountName: 'Talabat Receivable',
          residualKwd: 5420.5,
          linesCount: 19,
          oldestPostingDate: '2026-10-05',
        },
        {
          partnerId: 802,
          partnerName: 'Deliveroo Kuwait',
          accountId: 402,
          accountCode: '121201',
          accountName: 'Deliveroo Receivable',
          residualKwd: 4351.372,
          linesCount: 12,
          oldestPostingDate: '2026-10-25',
        },
        {
          partnerId: 803,
          partnerName: 'Unapplied Clearing Credits',
          accountId: 403,
          accountCode: '121205',
          accountName: 'Customer Clearing',
          residualKwd: -1351.372,
          linesCount: 3,
          oldestPostingDate: '2026-11-10',
        },
      ],
    },
    ...overrides,
  }
}

function setActiveMockContext(
  summary: OdooLiveSummary,
  filterOverrides: Partial<GlobalFilters> = {},
): void {
  const filters: Required<GlobalFilters> = {
    ...DEFAULT_GLOBAL_FILTERS,
    period: 'month',
    ...filterOverrides,
  }
  const workspace = computeGlobalWorkspace(filters, summary)
  mockFilterState.current = {
    filters,
    workspace,
    liveSummary: summary,
    liveCube: null,
    cubeLoading: false,
    syncingOdoo: false,
    sessionRole: 'admin',
    setPeriod: vi.fn(),
    setBrand: vi.fn(),
    setBranch: vi.fn(),
    setChannel: vi.fn(),
    setCustomRange: vi.fn(),
    resetFilters: vi.fn(),
    triggerOdooSyncNow: vi.fn(async () => undefined),
  }
}

describe('AetherBI Executive Polish v2 — Comprehensive Sections 1–5 Acceptance Suite', () => {
  beforeEach(() => {
    bustErpReadCache()
    authSessionState.ok = true
    authSessionState.session = {
      sub: 'exec-admin-1',
      userId: 'exec-admin-1',
      email: 'admin@venturefoods.kw',
      role: 'admin',
    }
  })

  afterEach(() => {
    bustErpReadCache()
    mockFilterState.current = null
    vi.restoreAllMocks()
  })

  describe('Section 1 — SWR Read-Layer Cache, Server Headers & Route Prefetching', () => {
    it('delivers L1/L2 SWR cache hits, deduplicates concurrent GETs, revalidates stale entries, and busts on Sync Odoo', async () => {
      const storageBacking = new Map<string, string>()
      const fakeStorage: Storage = {
        get length() {
          return storageBacking.size
        },
        clear: () => storageBacking.clear(),
        getItem: (k: string) => storageBacking.get(k) ?? null,
        key: (index: number) => [...storageBacking.keys()][index] ?? null,
        removeItem: (k: string) => {
          storageBacking.delete(k)
        },
        setItem: (k: string, v: string) => {
          storageBacking.set(k, v)
        },
      }
      vi.stubGlobal('window', {
        sessionStorage: fakeStorage,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })

      writeErpReadCache('summary:period=month', { netSalesKwd: 48250.75 })
      expect(peekErpReadCache<{ netSalesKwd: number }>('summary:period=month')).toEqual({
        netSalesKwd: 48250.75,
      })
      expect(storageBacking.has(`${ERP_READ_CACHE_PREFIX}summary:period=month`)).toBe(true)

      // Deduplicate concurrent identical in-flight GET calls
      let callCount = 0
      const slowFetcher = async () => {
        callCount += 1
        await new Promise((r) => setTimeout(r, 15))
        return { orders: 11240 }
      }
      const [r1, r2, r3] = await Promise.all([
        fetchWithErpReadCache('cube:month', slowFetcher),
        fetchWithErpReadCache('cube:month', slowFetcher),
        fetchWithErpReadCache('cube:month', slowFetcher),
      ])
      expect(callCount).toBe(1)
      expect(r1).toEqual({ orders: 11240 })
      expect(r2).toEqual({ orders: 11240 })
      expect(r3).toEqual({ orders: 11240 })

      // Stale-While-Revalidate returns warm value immediately and triggers background onRevalidate
      storageBacking.set(
        `${ERP_READ_CACHE_PREFIX}stale:key`,
        JSON.stringify({ data: { v: 'warm-v1' }, savedAt: Date.now() - 120_000 }),
      )
      const inspected = inspectErpReadCacheEntry<{ v: string }>('stale:key', {
        ttlMs: 60_000,
        maxStaleMs: 900_000,
      })
      expect(inspected?.isStale).toBe(true)

      let revalidatedValue: { v: string } | null = null
      const immediate = await fetchWithErpReadCache(
        'stale:key',
        async () => ({ v: 'fresh-v2' }),
        {
          ttlMs: 60_000,
          maxStaleMs: 900_000,
          onRevalidate: (fresh) => {
            revalidatedValue = fresh
          },
        },
      )
      expect(immediate).toEqual({ v: 'warm-v1' })
      await new Promise((r) => setTimeout(r, 15))
      expect(revalidatedValue).toEqual({ v: 'fresh-v2' })
      expect(peekErpReadCache<{ v: string }>('stale:key')).toEqual({ v: 'fresh-v2' })

      // Prefix bust & full bust on Sync Odoo
      bustErpReadCache('cube:')
      expect(peekErpReadCache('cube:month')).toBeNull()
      expect(peekErpReadCache('summary:period=month')).not.toBeNull()

      bustErpReadCache()
      expect(peekErpReadCache('summary:period=month')).toBeNull()
      expect(ERP_ODOO_SYNC_EVENT).toBe('aether:odoo-sync')
      expect(ERP_BUST_CACHE_EVENT).toBe('aether:bust-read-cache')
      vi.unstubAllGlobals()
    })

    it('configures private SWR headers for normal GETs, no-store on forceRefresh, and prefetches all 11 core routes', async () => {
      expect(isForceRefreshSearchParams(new URLSearchParams('period=month'))).toBe(false)
      expect(isForceRefreshSearchParams(new URLSearchParams('force=1'))).toBe(true)
      expect(isForceRefreshSearchParams(new URLSearchParams('forceRefresh=true'))).toBe(true)

      expect(buildOdooReadResponseHeaders(false)).toBe(odooSyncSwrGetHeaders)
      expect(odooSyncSwrGetHeaders['cache-control']).toBe(
        'private, max-age=30, stale-while-revalidate=300',
      )
      expect(buildOdooReadResponseHeaders(true)).toBe(odooSyncResponseHeaders)
      expect(odooSyncResponseHeaders['cache-control']).toContain('no-store')

      const map = new Map<string, Promise<number>>()
      let hits = 0
      const [a, b] = await Promise.all([
        deduplicateServerGet(map, 'k1', false, async () => ++hits),
        deduplicateServerGet(map, 'k1', false, async () => ++hits),
      ])
      expect(a).toBe(1)
      expect(b).toBe(1)
      expect(hits).toBe(1)

      expect(CORE_EXECUTIVE_PREFETCH_ROUTES).toEqual([
        '/erp',
        '/erp/cores',
        '/erp/weekday-comparison',
        '/erp/before-after',
        '/erp/warehouse-chain',
        '/erp/finance',
        '/erp/receivables',
        '/erp/executive-pnl',
        '/erp/decisions',
        '/erp/planning',
        '/erp/feryal-ai',
      ])
    })
  })

  describe('Section 2 — Zero Yellow Clutter Banners, "Show zero rows" Toggle & Executive-First Finance', () => {
    it('suppresses PartialWarningBanner & OdooPartialWarningBanner globally and keeps zero yellow banner markup across studios', () => {
      const summary = buildExecutiveFixtureSummary({ partial: true })
      expect(
        renderToStaticMarkup(React.createElement(PartialWarningBanner, { summary, locale: 'en' })),
      ).toBe('')
      expect(
        renderToStaticMarkup(React.createElement(OdooPartialWarningBanner, { summary, isAr: false })),
      ).toBe('')

      setActiveMockContext(summary, { period: 'month' })

      const pages = [
        renderStudio('en', React.createElement(FullJourney360)),
        renderStudio('en', React.createElement(CoresHubStudio)),
        renderStudio('en', React.createElement(OdooAccountingAnalyticsHub, { isAr: false, locale: 'en' })),
        renderStudio('en', React.createElement(ReceivablesAgingStudio)),
        renderStudio('en', React.createElement(ExecutivePnlStudio)),
        renderStudio('en', React.createElement(DeliveryRadarV5)),
        renderStudio('en', React.createElement(StrategicPlanningStudio)),
        renderStudio('en', React.createElement(BoothStudyV5)),
      ]

      for (const html of pages) {
        expect(html).not.toContain('data-odoo-partial-warning="true"')
        expect(html).not.toContain('Some figures are temporarily unavailable')
        expect(html).not.toContain('Incomplete GL entries for this period')
      }
    })

    it('hides 0.000 KWD / 0 order rows by default in DeliveryRadarV5 and reveals them when Show zero rows is ON', () => {
      const summary = buildExecutiveFixtureSummary()
      setActiveMockContext(summary, { period: 'month' })

      const defaultOffHtml = renderStudio(
        'en',
        React.createElement(TypedDeliveryRadarV5, { initialShowZeroRows: false }),
      )
      expect(defaultOffHtml).toContain('data-show-zero-rows-toggle="true"')
      expect(defaultOffHtml).toContain('Show zero rows')
      expect(defaultOffHtml).toContain('data-matrix-row="avenues|talabat-tgo"')
      expect(defaultOffHtml).not.toContain('data-matrix-row="avenues|jahez"')
      expect(defaultOffHtml).not.toContain('data-matrix-row="avenues|snoonu"')

      const toggledOnHtml = renderStudio(
        'en',
        React.createElement(TypedDeliveryRadarV5, { initialShowZeroRows: true }),
      )
      expect(toggledOnHtml).toContain('data-matrix-row="avenues|jahez"')
      expect(toggledOnHtml).toContain('data-matrix-row="avenues|snoonu"')
    })

    it('renders Executive Odoo Intelligence strips at top and collapsible ledgers below on Finance, AR Aging, and P&L, plus dynamic KPI hiding on Today', () => {
      const summary = buildExecutiveFixtureSummary()
      setActiveMockContext(summary, { period: 'month' })

      const glHtml = renderStudio(
        'en',
        React.createElement(OdooAccountingAnalyticsHub, { isAr: false, locale: 'en' }),
      )
      const arHtml = renderStudio('en', React.createElement(ReceivablesAgingStudio))
      const pnlHtml = renderStudio('en', React.createElement(ExecutivePnlStudio))

      expect(glHtml).toContain('data-finance-ai-insights="true"')
      expect(arHtml).toContain('data-finance-ai-insights="true"')
      expect(arHtml).toContain('<details')
      expect(pnlHtml).toContain('data-finance-ai-insights="true"')

      // On Today, unposted GL & Aggregator Commission cards hide on FullJourney360 while AOV & Top Branch promote
      setActiveMockContext(summary, { period: 'today' })
      const todayHomeEn = renderStudio('en', React.createElement(FullJourney360))
      expect(todayHomeEn).not.toContain('Posted general ledger entries')
      expect(todayHomeEn).not.toContain('Unattributed to Branch')
      expect(todayHomeEn).toContain('Average Order Value')
      expect(todayHomeEn).toContain('Top Performing Branch')

      const whHtml = renderStudio(
        'en',
        React.createElement(WarehouseDailyChainStudio, {
          initialWarehouseChain: {
            connected: true,
            sourceMode: 'odoo17-live',
            noData: false,
            odooCompanyId: 1,
            lastSyncAt: '2026-11-18T18:30:00.000Z',
            isStale24h: false,
            dateRange: { from: '2026-10-20', to: '2026-11-18' },
            quantHasValueField: true,
            totals: {
              currentOnHandQty: 450,
              currentOnHandValueKwd: 4200.5,
              ckOnHandValueKwd: 2800.25,
              branchesOnHandValueKwd: 1400.25,
              inboundSupplierKwd: 1100.0,
              ckToBranchTransferKwd: 900.0,
              posConsumptionKwd: 750.0,
              scrapKwd: 0,
              scrapPctOfConsumption: 0,
              doneMovesCount: 40,
              scrapOrdersCount: 0,
              quantsCount: 30,
            },
            byBranchOnHand: {
              avenues: { qty: 200, valueKwd: 1400.25 },
              ardiya: { qty: 0, valueKwd: 0 },
            },
            dailyMoves: [],
            products: [],
            scraps: [],
          },
        }),
      )
      expect(whHtml).toContain('data-show-zero-rows-toggle="true"')
    })
  })

  describe('Section 3 — KpiProvenanceBadge Portal, Collision-Aware Flip, Non-Overlapping Sidebar & Clean Branch Cards', () => {
    it('flips KpiProvenanceBadge upward near bottom viewport edge and clamps RTL/LTR coordinates safely', () => {
      const flippedUp = computeCollisionAwarePopoverCoords({
        triggerRect: { top: 710, bottom: 736, left: 960, right: 1040 },
        popoverWidth: 288,
        popoverHeight: 180,
        viewportWidth: 1080,
        viewportHeight: 768,
        isRtl: false,
      })
      expect(flippedUp.placement).toBe('top')
      expect(flippedUp.top).toBeLessThan(710)
      expect(flippedUp.left).toBeLessThanOrEqual(1080 - 288 - 12)
      expect(flippedUp.left).toBeGreaterThanOrEqual(12)

      const rtlClamped = computeCollisionAwarePopoverCoords({
        triggerRect: { top: 120, bottom: 146, left: 16, right: 96 },
        popoverWidth: 288,
        popoverHeight: 180,
        viewportWidth: 1280,
        viewportHeight: 800,
        isRtl: true,
      })
      expect(rtlClamped.placement).toBe('bottom')
      expect(rtlClamped.left).toBeGreaterThanOrEqual(12)

      const openBadgeHtml = renderStudio(
        'en',
        React.createElement(KpiProvenanceBadge, {
          odooModel: 'pos.order',
          dateRange: { from: '2026-11-18', to: '2026-11-18' },
          lastSyncAt: '2026-11-18T18:30:00.000Z',
          kind: 'فعلي',
          queryOrFormula: 'pos.order.read_group',
          open: true,
        }),
      )
      expect(openBadgeHtml).toContain('data-kpi-provenance-portal="true"')
      expect(openBadgeHtml).toContain('z-50')
    })

    it('enforces non-overlapping Sidebar flex-column scroll + pinned footer and omits "Mapped Odoo POS location" & "Trend not available"', () => {
      const repoRoot = process.cwd()
      const sidebarSrc = readFileSync(path.join(repoRoot, 'src/components/erp-sidebar.tsx'), 'utf8')
      expect(sidebarSrc).toContain('h-dvh max-h-dvh shrink-0 flex-col overflow-hidden')
      expect(sidebarSrc).toContain('flex-1 min-h-0 overflow-y-auto')
      expect(sidebarSrc).toContain('data-sidebar-footer="true"')

      const summary = buildExecutiveFixtureSummary({ hourlySeries: [] })
      setActiveMockContext(summary, { period: 'today' })
      const homeHtml = renderStudio('en', React.createElement(FullJourney360))
      expect(homeHtml).not.toContain('Trend not available')

      setActiveMockContext(summary, { period: 'month' })
      const coresHtml = renderStudio('en', React.createElement(TypedCoresHubStudio, { initialTab: 'sales' }))
      expect(coresHtml).not.toContain('Mapped Odoo POS location')
      expect(coresHtml).toContain('Promenade')
    })
  })

  describe('Section 4 — Ferial 40vh Composer, User-Scoped Persistent Chat Threads & Multimodal Vision', () => {
    it('caps auto-expanding prompt height at 40vh, submits on Enter, inserts newline on Shift+Enter, and keeps zero truncate in feryal-governance-studio.tsx', () => {
      expect(FERYAL_PROMPT_MAX_VH_RATIO).toBe(0.4)
      expect(computeFeryalPromptResize('سؤال قصير', 88, 900)).toEqual({
        heightStyle: '88px',
        overflowScroll: false,
      })
      expect(computeFeryalPromptResize('سؤال طويل جداً', 520, 900)).toEqual({
        heightStyle: '360px',
        overflowScroll: true,
      })

      const mockTextarea = {
        scrollHeight: 480,
        style: { height: '', overflowY: 'hidden' },
      }
      expect(applyFeryalPromptAutoResize(mockTextarea, 'نص طويل', 1000)).toBe(true)
      expect(mockTextarea.style.height).toBe('400px')
      expect(mockTextarea.style.overflowY).toBe('auto')

      expect(
        shouldSubmitFeryalPromptOnKeyDown({
          key: 'Enter',
          shiftKey: false,
          isComposing: false,
          sending: false,
          inputText: 'مبيعات أمس',
          attachmentCount: 0,
        }),
      ).toEqual({ preventDefault: true, shouldSend: true })

      expect(
        shouldSubmitFeryalPromptOnKeyDown({
          key: 'Enter',
          shiftKey: true,
          isComposing: false,
          sending: false,
          inputText: 'مبيعات أمس',
          attachmentCount: 0,
        }),
      ).toEqual({ preventDefault: false, shouldSend: false })

      const feryalStudioSrc = readFileSync(
        path.join(process.cwd(), 'src/components/erp/feryal-governance-studio.tsx'),
        'utf8',
      )
      expect(feryalStudioSrc.includes('truncate')).toBe(false)
    })

    it('persists, reloads, isolates per user, and deletes Ferial chat threads via /api/erp/feryal/threads while blocking auditor writes', async () => {
      const saveRes = await postFeryalThreads(
        new NextRequest('http://localhost/api/erp/feryal/threads', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            thread: {
              id: 'thread-exec-1',
              title: 'مبيعات بروميناد أمس',
              lang: 'ar',
              messages: [
                { id: 'm1', sender: 'user', text: 'كم مبيعات بروميناد أمس؟', time: '21:10' },
                { id: 'm2', sender: 'feryal', text: 'بلغ صافي مبيعات بروميناد 517.900 د.ك عبر 107 طلبات.', time: '21:10' },
              ],
            },
          }),
        }),
      )
      expect(saveRes.status).toBe(200)

      const listUserARes = await getFeryalThreads(
        new NextRequest('http://localhost/api/erp/feryal/threads', { method: 'GET' }),
      )
      expect(listUserARes.status).toBe(200)
      const listUserABody = (await listUserARes.json()) as {
        ok: boolean
        threads: Array<{ id: string; messages: Array<{ id: string; text: string }> }>
      }
      expect(listUserABody.ok).toBe(true)
      const reloaded = listUserABody.threads.find((t) => t.id === 'thread-exec-1')
      expect(reloaded?.messages).toHaveLength(2)
      expect(reloaded?.messages[1]?.text).toContain('517.900')

      // User B cannot see User A's threads
      authSessionState.session = {
        sub: 'exec-cfo-2',
        userId: 'exec-cfo-2',
        email: 'cfo@venturefoods.kw',
        role: 'cfo',
      }
      const listUserBRes = await getFeryalThreads(
        new NextRequest('http://localhost/api/erp/feryal/threads', { method: 'GET' }),
      )
      const listUserBBody = (await listUserBRes.json()) as { threads: Array<{ id: string }> }
      expect(listUserBBody.threads.find((t) => t.id === 'thread-exec-1')).toBeUndefined()

      // Auditor gets 403 on POST/DELETE
      authSessionState.session = {
        sub: 'auditor-1',
        userId: 'auditor-1',
        email: 'auditor@venturefoods.kw',
        role: 'auditor',
      }
      const auditorPost = await postFeryalThreads(
        new NextRequest('http://localhost/api/erp/feryal/threads', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ thread: { id: 't-aud', messages: [{ id: '1', sender: 'user', text: 'hi' }] } }),
        }),
      )
      expect(auditorPost.status).toBe(403)

      // Switch back to User A and delete thread
      authSessionState.session = {
        sub: 'exec-admin-1',
        userId: 'exec-admin-1',
        email: 'admin@venturefoods.kw',
        role: 'admin',
      }
      const delRes = await deleteFeryalThreads(
        new NextRequest('http://localhost/api/erp/feryal/threads?id=thread-exec-1', {
          method: 'DELETE',
        }),
      )
      expect(delRes.status).toBe(200)
      const afterDel = (await (
        await getFeryalThreads(new NextRequest('http://localhost/api/erp/feryal/threads'))
      ).json()) as { threads: Array<{ id: string }> }
      expect(afterDel.threads.find((t) => t.id === 'thread-exec-1')).toBeUndefined()
    })

    it('analyzes operational photos and video keyframes via Gemini with Claude vision fallback and enforces auth/media guards on /api/erp/feryal/vision', async () => {
      const geminiFetch: typeof fetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: 'COMPLIANCE: GREEN\nفحص محطة التحضير في فرع الأفنيوز يظهر نظافة الأسطح وترتيب العبوات بوضوح دون ملاحظات حرجة.',
                    },
                  ],
                },
              },
            ],
            usageMetadata: { promptTokenCount: 320, candidatesTokenCount: 65 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )

      const geminiOutcome = await runFeryalVisionAnalysis(
        {
          prompt: 'افحص نظافة محطة التحضير',
          locale: 'ar',
          branch: 'avenues',
          mediaItems: [
            {
              id: 'img-1',
              kind: 'image',
              name: 'prep-station.jpg',
              mimeType: 'image/jpeg',
              base64Data: 'dGVzdC1pbWFnZS1ieXRlcw==',
            },
          ],
        },
        {
          fetchImpl: geminiFetch,
          keys: { google: 'AIzaSyTestKey123456789012345', anthropic: 'sk-ant-test123456789012345' },
        },
      )
      expect(geminiOutcome.httpStatus).toBe(200)
      expect(geminiOutcome.response.ok).toBe(true)
      expect(geminiOutcome.response.provider).toBe('gemini')
      expect(geminiOutcome.response.reply).toContain('محطة التحضير')

      // Fallback to Anthropic Claude when Gemini fails on video keyframes
      const fallbackFetch: typeof fetch = vi.fn(async (inputUrl) => {
        const url = String(inputUrl)
        if (url.includes('generativelanguage.googleapis.com')) {
          return new Response('upstream error', { status: 503 })
        }
        return new Response(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: 'COMPLIANCE: YELLOW\nShelf inspection across the 3 extracted video frames shows one unlabeled dry-storage bin on the middle rack.',
              },
            ],
            usage: { input_tokens: 410, output_tokens: 58 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      })

      const claudeFallback = await runFeryalVisionAnalysis(
        {
          prompt: 'Inspect dry storage video walk-through',
          locale: 'en',
          branch: 'promenade',
          mediaItems: [
            {
              id: 'vid-1',
              kind: 'video',
              name: 'walkthrough.mp4',
              mimeType: 'video/mp4',
              durationSec: 6,
              extractedFrames: [
                { index: 1, timestampSec: 1, timestampLabel: '00:01', mimeType: 'image/jpeg', base64Data: 'ZnJhbWUx' },
                { index: 2, timestampSec: 3, timestampLabel: '00:03', mimeType: 'image/jpeg', base64Data: 'ZnJhbWUy' },
              ],
            },
          ],
        },
        {
          fetchImpl: fallbackFetch,
          keys: { google: 'AIzaSyTestKey123456789012345', anthropic: 'sk-ant-test123456789012345' },
        },
      )
      expect(claudeFallback.httpStatus).toBe(200)
      expect(claudeFallback.response.provider).toBe('claude')
      expect(claudeFallback.response.reply).toContain('unlabeled dry-storage bin')

      // Route-level validation: empty body -> 400 MEDIA_REQUIRED, auditor -> 403
      const emptyVisionRes = await postFeryalVision(
        new NextRequest('http://localhost/api/erp/feryal/vision', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: 'inspect', mediaItems: [] }),
        }),
      )
      expect(emptyVisionRes.status).toBe(400)

      authSessionState.session.role = 'auditor'
      const auditorVisionRes = await postFeryalVision(
        new NextRequest('http://localhost/api/erp/feryal/vision', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: 'inspect', mediaItems: [] }),
        }),
      )
      expect(auditorVisionRes.status).toBe(403)
    })
  })

  describe('Section 5 — Live Odoo + AI Decision Room, Strategic Planning & Booth Feasibility', () => {
    it('generates KWD-grounded executive decision cards from live Odoo data and guards AI rationale enrichment', async () => {
      const summary = buildExecutiveFixtureSummary()
      const baseSnap = buildLiveDecisionSnapshotFromSummary(summary)
      expect(baseSnap.available).toBe(true)
      const allFindings = baseSnap.reports.flatMap((r) => r.findings)
      expect(allFindings.length).toBeGreaterThanOrEqual(4)

      const fingerprints = allFindings.map((f) => f.fingerprint)
      expect(fingerprints.some((fp) => fp.startsWith('benchmark:branch-velocity-gap:'))).toBe(true)
      expect(fingerprints).toContain('delivery:channel-aggregator-shift:company')
      expect(fingerprints).toContain('drivers:quiet-hours-15-18:company')
      expect(fingerprints).toContain('cfo:receivables-clearing:account-move-line')
      // unattributedSalesKwd === 0 -> unattributed terminal card must NOT be emitted
      expect(fingerprints).not.toContain('cfo:unattributed-pos-terminals:mapping')

      // Rejects ungrounded invented numbers from LLM and keeps deterministic Odoo-grounded rationale
      const hallucinatedSnap = await generateLiveOdooDecisionSnapshot({
        summary,
        callLlm: async () =>
          JSON.stringify({
            rationales: [
              {
                fingerprint: 'delivery:channel-aggregator-shift:company',
                rootCauseAr: 'نسبة الربح الوهمية 99.9% بمبيعات 999,999.000 د.ك غير موجودة في أودو.',
                rootCauseEn: 'Invented 99.9% margin and 999,999.000 KWD sales not in Odoo.',
              },
            ],
          }),
      })
      expect(hallucinatedSnap.aiEnriched).toBe(false)

      // Persist Approve ('accepted') and Dismiss ('rejected') via POST /api/erp/council/decisions
      const firstCard = allFindings[0]!
      const approveRes = await postCouncilDecisions(
        new NextRequest('http://localhost/api/erp/council/decisions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            fingerprint: firstCard.fingerprint,
            status: 'accepted',
            note: 'Approved by CEO',
            findingMeta: {
              advisorId: firstCard.advisorId,
              titleAr: firstCard.titleAr,
              titleEn: firstCard.titleEn,
              kind: firstCard.kind,
              expectedWeeklyKwd: firstCard.weeklyImpact?.value ?? 250,
            },
          }),
        }),
      )
      expect(approveRes.status).toBe(200)

      const dismissRes = await postCouncilDecisions(
        new NextRequest('http://localhost/api/erp/council/decisions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            fingerprint: firstCard.fingerprint,
            status: 'rejected',
            note: 'Dismissed after review',
            findingMeta: {
              advisorId: firstCard.advisorId,
              titleAr: firstCard.titleAr,
              titleEn: firstCard.titleEn,
              kind: firstCard.kind,
              expectedWeeklyKwd: firstCard.weeklyImpact?.value ?? 250,
            },
          }),
        }),
      )
      expect(dismissRes.status).toBe(200)

      const listRes = await getCouncilDecisions(
        new NextRequest('http://localhost/api/erp/council/decisions', { method: 'GET' }),
      )
      expect(listRes.status).toBe(200)
      const listJson = (await listRes.json()) as {
        decisions: Array<{ fingerprint: string; status: string }>
      }
      expect(
        listJson.decisions.find((d) => d.fingerprint === firstCard.fingerprint)?.status,
      ).toBe('rejected')
    })

    it('separates Odoo Verified Actual, Manual What-If Input, and Deterministic Simulation across Strategic Planning & Booth Feasibility + Planning Advisor API', async () => {
      const summary = buildExecutiveFixtureSummary()
      setActiveMockContext(summary, { period: 'month' })

      const planningHtml = renderStudio('en', React.createElement(StrategicPlanningStudio))
      const boothHtml = renderStudio('en', React.createElement(BoothStudyV5))

      for (const html of [planningHtml, boothHtml]) {
        expect(html).toContain(LABEL_ODOO_ACTUAL.en)
        expect(html).toContain(LABEL_MANUAL_WHAT_IF.en)
        expect(html).toContain(LABEL_DETERMINISTIC_SIM.en)
        expect(html).not.toContain('data-odoo-partial-warning="true"')
      }

      const actuals = extractOdooVerifiedPlanningActuals(summary)
      expect(actuals.available).toBe(true)
      expect(actuals.month30dNetSalesKwd).toBe(48250.75)
      expect(actuals.exhibitionsActuals.available).toBe(true)
      expect(actuals.exhibitionsActuals.netKwd).toBe(1450)

      const workspace = computeGlobalWorkspace({ ...DEFAULT_GLOBAL_FILTERS, period: 'month' }, summary)
      const planningSnap = computeStrategicPlanning(workspace, summary)
      const sim = computeWhatIfStrategicSimulation(planningSnap, {
        targetGrowthPct: 12,
        directChannelShiftPct: 5,
        costEfficiencyPct: 3,
        horizonDays: 30,
        roadmapCostCapKwd: 5000,
        roadmapMonthlyGainKwd: 2200,
      })
      expect(sim.projectedSalesKwd).toBeGreaterThan(actuals.month30dNetSalesKwd)

      const fallbackRecs = buildStrategicAdvisorFallback({
        actuals,
        whatIf: {
          targetGrowthPct: 12,
          directChannelShiftPct: 5,
          costEfficiencyPct: 3,
          horizonDays: 30,
          roadmapCostCapKwd: 5000,
          roadmapMonthlyGainKwd: 2200,
        },
        sim,
      })
      expect(fallbackRecs.length).toBeGreaterThanOrEqual(3)

      const advisorRes = await postPlanningAdvisor(
        new NextRequest('http://localhost/api/erp/planning-advisor', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            mode: 'booth-feasibility',
            liveSummary: summary,
            boothInputs: {
              brandId: 'china-garden',
              brandLabelEn: 'China Garden',
              brandLabelAr: 'تشاينا جاردن',
              days: 14,
              rentKwd: 1800,
              setupKwd: 450,
              staffCount: 3,
              staffCostKwd: 600,
              avgTicketKwd: 4.25,
              foodCostPct: 30,
              expectedDailyOrders: 95,
            },
          }),
        }),
      )
      expect(advisorRes.status).toBe(200)
      const advisorBody = (await advisorRes.json()) as {
        ok: boolean
        recommendations: Array<{ titleEn: string; bodyEn: string }>
      }
      expect(advisorBody.ok).toBe(true)
      expect(advisorBody.recommendations.length).toBeGreaterThanOrEqual(3)
    })
  })
})
