import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_AUDITOR_EMAIL,
  EXEC_SESSION_COOKIE,
  createExecSessionToken,
} from '@/lib/auth/exec-session'
import {
  DEFAULT_GLOBAL_FILTERS,
  computeGlobalWorkspace,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import type { OdooBucketSummary, OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { UNAVAILABLE_DASH } from '@/lib/format'
import {
  NON_COMPANY_ITEM_SKUS,
  isNonCompanyCatalogItem,
  nonCompanyItemSql,
} from '@/lib/odoo/non-company-products'

type GlobalFilterContextValue = ReturnType<
  typeof import('@/components/aether/GlobalFilterContext').useGlobalFilter
>

const mockGlobalFilterState: { current: GlobalFilterContextValue | null } = {
  current: null,
}

const contractCreateSpy = vi.fn(async (_auth: unknown, _key: string, input: Record<string, unknown>) => ({
  status: 201 as const,
  replayed: false,
  body: { data: { id: 'contract-kw-1', ...input } },
}))

const deliveryOrderCreateSpy = vi.fn(async (_auth: unknown, _key: string, input: Record<string, unknown>) => ({
  status: 201 as const,
  replayed: false,
  body: { data: { id: 'order-kw-1', ...input } },
}))

const emailDispatchSpy = vi.fn(async () => ({
  ok: true,
  engine: 'none' as const,
  message: 'mocked',
}))

const forensicDispatchSpy = vi.fn(async () => ({
  delivery: { ok: true, engine: 'none' as const, message: 'mocked' },
  smtp: { configured: false, enabled: false, from: 'sec@venturefoodskw.com', host: 'smtp.gmail.com', port: 465, provider: 'google_workspace' as const },
  telegramBroadcast: false,
  chunksSent: 0,
  channels: [],
  report: {
    en: 'mock report',
    ar: 'تقرير',
    sections: {
      critical: [],
      watch: [],
      clean: [],
      rejectedEstate: [],
      recordedLostMinor: 0,
      penaltyMinor: 0,
      kuwaitDate: '2026-11-17',
      kuwaitTime: '01:30',
    },
  },
}))

vi.mock('@/lib/email/server-mail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/server-mail')>()
  return {
    ...actual,
    dispatchServerEmail: () => emailDispatchSpy(),
    getSmtpPublicStatus: vi.fn(async () => ({
      configured: false,
      enabled: false,
      from: 'sec@venturefoodskw.com',
      host: 'smtp.gmail.com',
      port: 465,
      provider: 'google_workspace' as const,
    })),
  }
})

vi.mock('@/lib/alerts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/alerts')>()
  return {
    ...actual,
    dispatchExclusiveOperationalReport: () => forensicDispatchSpy(),
    listExclusiveRadarRecipients: () => [],
  }
})

vi.mock('@/lib/odoo-live-connector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/odoo-live-connector')>()
  return {
    ...actual,
    fetchLiveOdooHrSummary: vi.fn(async () => ({
      connected: true,
      sourceMode: 'live' as const,
      accessGranted: true,
      noData: false,
      odooCompanyId: 1,
      lastSyncAt: '2026-11-16T12:00:00Z',
      isStale24h: false,
      totals: { activeEmployeesCount: 40, departmentsCount: 5, workLocationsCount: 7 },
      byDepartment: [],
      byWorkLocation: [],
    })),
  }
})

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp',
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

vi.mock('@/modules/operations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/operations')>()
  return {
    ...actual,
    createContract: (...args: [unknown, string, Record<string, unknown>]) =>
      contractCreateSpy(...args),
  }
})

vi.mock('@/modules/delivery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/delivery')>()
  return {
    ...actual,
    listPartners: vi.fn(async () => [{ id: 'partner-1', code: 'TAL', name: 'Talabat', commissionBps: 1500 }]),
    createOrder: (...args: [unknown, string, Record<string, unknown>]) =>
      deliveryOrderCreateSpy(...args),
  }
})

vi.mock('@/modules/governance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/governance')>()
  return {
    ...actual,
    stageArchive: vi.fn(async (_auth: unknown, _key: string, input: { fileName: string; documentCategory: string }) => ({
      status: 201 as const,
      replayed: false,
      body: {
        data: {
          id: 'arch-1',
          fileName: input.fileName,
          documentCategory: input.documentCategory,
          routedToModule: input.documentCategory === 'contract' ? '/erp/contracts' : '/erp/delivery',
          amountMinor: 150_000,
          status: 'pending' as const,
          routedRecordId: null,
          extracted: { counterparty: 'شركة التوريد الوطنية' },
        },
      },
    })),
    markArchive: vi.fn(async (_auth: unknown, id: string, status: string, recordId: string | null) => ({
      id,
      status,
      routedRecordId: recordId,
    })),
  }
})

import { LanguageProvider as I18nProvider } from '@/lib/i18n'
import SmartDropzoneFromComponents from '@/components/SmartDropzonePortal'
import SmartDropzoneFromModule from '@/modules/smart-dropzone/ui/SmartDropzonePortal'
import { DeliveryRadarV5 } from '@/components/aether/DeliveryRadarV5'
import { BrandSalesAnalyticsDashboard } from '@/modules/brand-sales-analytics/ui/BrandSalesAnalyticsDashboard'
import { FullJourney360 } from '@/components/aether/FullJourney360'
import * as BeforeAfterModule from '@/components/aether/BeforeAfterStudio'
import * as WeekdayModule from '@/components/erp/ops-expansion/WeekdayComparisonStudio'
import { routeArchive } from '@/lib/governance-routing'
import { GET as radarAlertGet, POST as radarAlertPost } from '@/app/api/aggregator-radar/alert/route'
import { GET as hrSummaryGet } from '@/app/api/erp/hr-summary/route'

const TypedI18nProvider = I18nProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

function renderWithProviders(locale: 'ar' | 'en', node: React.ReactElement): string {
  return renderToStaticMarkup(
    React.createElement(TypedI18nProvider, { initialLocale: locale }, node),
  )
}

function buildCompleteBucket(): OdooBucketSummary {
  const uiChannels = {
    'dine-in': { netKwd: 1200, orders: 120 },
    'takeaway-direct': { netKwd: 800, orders: 80 },
    'talabat-tgo': { netKwd: 1500.125, orders: 150 },
    'talabat-tmp': { netKwd: 500.25, orders: 50 },
    keeta: { netKwd: 600.5, orders: 60 },
    deliveroo: { netKwd: 400, orders: 40 },
    jahez: { netKwd: 360, orders: 36 },
    snoonu: { netKwd: 300, orders: 30 },
  }
  const byLocation = {
    avenues: { netKwd: 4000.125, orders: 400, uiChannels },
    '360-mall': { netKwd: 3000.25, orders: 300, uiChannels },
    assima: { netKwd: 2000.5, orders: 200, uiChannels },
    promenade: { netKwd: 1500, orders: 150, uiChannels },
    salmiya: { netKwd: 1200, orders: 120, uiChannels },
    'al-kout': { netKwd: 800, orders: 80, uiChannels },
    ardiya: { netKwd: 500, orders: 50, uiChannels },
  }
  const byBrand = {
    'china-garden': { netKwd: 1800, orders: 180, qty: 220 },
    franks: { netKwd: 1400, orders: 140, qty: 170 },
    tahina: { netKwd: 1000, orders: 100, qty: 130 },
    'farm-brown': { netKwd: 800, orders: 80, qty: 95 },
    'noodle-bar': { netKwd: 600, orders: 60, qty: 75 },
    'karak-cafeteria': { netKwd: 600, orders: 60, qty: 90 },
  }
  return {
    key: 'month',
    from: '2026-10-17',
    to: '2026-11-15',
    days: 30,
    totals: {
      netSalesKwd: 13000.875,
      orders: 1300,
      aovKwd: 10.001,
      restaurantNetKwd: 13000.875,
      restaurantOrders: 1300,
    },
    byBrand,
    byLocation,
    mappedByLocation: byLocation,
    unattributedSalesKwd: 0,
    unattributedOrders: 0,
    uiChannels,
    accounting: {
      available: true,
      from: '2026-10-17',
      to: '2026-11-15',
      sourceModel: 'account.move.line',
      lineCount: 240,
      income: 13000.875,
      otherIncome: 0,
      totalRevenue: 13000.875,
      cogs: 3900,
      deliveryCommissions: 950,
      expense: 4650,
      depreciation: 150,
      otherOpexAndDepreciation: 850,
      operatingProfit: 3550.875,
      completeAccrualPosted: true,
      glIncomplete: false,
    },
  } as unknown as OdooBucketSummary
}

function buildSummaryWithBucket(bucket: OdooBucketSummary): OdooLiveSummary {
  return {
    connected: true,
    source: 'live',
    sourceMode: 'odoo17-live',
    noData: false,
    totals: { netSalesKwd: 13000.875, orders: 1300, aovKwd: 10.001 },
    unattributedSalesKwd: 0,
    unattributedOrders: 0,
    dateRange: { from: '2026-10-17', to: '2026-11-15' },
    period: { from: '2026-10-17', to: '2026-11-15' },
    syncedAt: '2026-11-15T12:00:00Z',
    lastSyncAt: '2026-11-15T12:00:00Z',
    latestRecordAt: '2026-11-15T11:45:00.000Z',
    latestOdooRecordAt: '2026-11-15T14:45:00+03:00',
    latestOperationalDate: '2026-11-14',
    todayOrders: 40,
    todaySalesKwd: 410.5,
    isStale24h: false,
    staleAgeHours: 0.5,
    odooCompanyId: 1,
    partial: true,
    unavailableSections: ['partial-row-test'],
    warningAr: 'بعض الأرقام غير متاحة الآن',
    warningEn: 'Some figures are temporarily unavailable',
    diagnosticCode: 'PARTIAL_LIVE',
    buckets: {
      today: bucket,
      week: bucket,
      month: bucket,
      year: bucket,
    },
    dailySeries: [{ day: '2026-11-15', netKwd: 13000.875, orders: 1300 }],
    hourlySeries: [{ hour: 13, netKwd: 1200, orders: 120 }],
    brands: [],
    locations: [],
    topProducts: [],
    accounting: {
      available: true,
      completeAccrualPosted: true,
      glIncomplete: false,
      aggregatorCommissionUnposted: false,
      fromDate: '2026-11-01',
      toDate: '2026-11-16',
      revenueExTaxKwd: 13000.875,
      cogsKwd: 3900,
      deliveryCommissionsKwd: 950,
      grossProfitKwd: 8150.875,
      payrollKwd: 2200,
      rentKwd: 1500,
      utilitiesKwd: 300,
      marketingKwd: 250,
      otherOpexKwd: 200,
      depreciationKwd: 150,
      operatingProfitKwd: 3550.875,
      cogsPct: 30,
      deliveryCommPct: 7.3,
      rentPct: 11.5,
      payrollPct: 16.9,
      netProfitPct: 27.3,
      beforeRentKwd: 5050.875,
      beforeRentPct: 38.8,
      otherOpexAndDepreciationKwd: 850,
      postedMoveLineCount: 42,
      populatedExpenseBuckets: 5,
    },
    aggregatorReceivables: {
      available: true,
      fromDate: '2026-11-01',
      toDate: '2026-11-16',
      totalOutstandingKwd: 1100.5,
      unreconciledLineCount: 6,
      aging: { d0_7: 600.5, d8_15: 300, d16_30: 200, d31_plus: 0 },
      byPlatform: [],
    },
    stockTransfers: {
      available: true,
      fromDate: '2026-11-01',
      toDate: '2026-11-16',
      donePickingsCount: 14,
      doneMovesCount: 80,
      totalTransferredQty: 420,
      topProducts: [],
      byDestination: [],
    },
    journeyPulse: {
      mtd: { from: '2026-11-01', to: '2026-11-16', days: 16, netKwd: 13000.875, orders: 1300 },
      rolling30: { from: '2026-10-18', to: '2026-11-16', days: 30, netKwd: 25000, orders: 2500 },
      prior30: { from: '2026-09-18', to: '2026-10-17', days: 30, netKwd: 24000, orders: 2400 },
    },
  } as unknown as OdooLiveSummary
}

function installGlobalContext(summary: OdooLiveSummary, filterOverrides: Partial<GlobalFilters> = {}) {
  const filters: GlobalFilters = {
    ...DEFAULT_GLOBAL_FILTERS,
    period: 'month',
    ...filterOverrides,
  }
  const workspace = computeGlobalWorkspace(filters, summary)
  mockGlobalFilterState.current = {
    filters,
    workspace,
    liveSummary: summary,
    sessionRole: 'admin',
    isAuditor: false,
    syncingOdoo: false,
    setPeriod: vi.fn(),
    setBrand: vi.fn(),
    setBranch: vi.fn(),
    setChannel: vi.fn(),
    setCustomRange: vi.fn(),
    resetFilters: vi.fn(),
    refreshLiveOdoo: vi.fn(async () => {}),
    copyDeepLink: vi.fn(async () => true),
    buildWhatsAppShareUrl: vi.fn(() => 'https://wa.me/?text=test'),
  } as unknown as GlobalFilterContextValue
}

function evaluateSqlFilterAgainstItem(
  sku: string,
  name: string,
): boolean {
  const params: unknown[] = ['tenant-001']
  const sql = nonCompanyItemSql('i.sku', 'i.name', params)
  // Verify the SQL clause binds parameters starting at $2 and evaluate exact SQL semantics:
  // true = item kept (company item), false = item filtered out (non-company item).
  expect(sql).toContain('i.sku <> all($2::text[])')
  const skuBlockList = params[1] as string[]
  if (skuBlockList.includes(sku)) return false

  for (let idx = 2; idx < params.length; idx += 1) {
    const bound = params[idx]
    if (typeof bound === 'string') {
      const needle = bound.replace(/^%|%$/g, '').toLowerCase()
      if (name.toLowerCase().includes(needle)) return false
    } else if (Array.isArray(bound)) {
      for (const pat of bound) {
        const needle = String(pat).replace(/^%|%$/g, '').toLowerCase()
        if (name.toLowerCase().includes(needle)) return false
      }
    }
  }
  return true
}

describe('Final /audit + /refactor Verification Suite (RED -> GREEN)', () => {
  beforeEach(() => {
    contractCreateSpy.mockClear()
    deliveryOrderCreateSpy.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('S1. Security /audit: /api/aggregator-radar/alert rejects spoofed cron & unauthenticated manualTrigger', () => {
    it('rejects GET ?cron=true and spoofed x-vercel-cron header without valid CRON_SECRET bearer token', async () => {
      const spoofedQueryReq = new NextRequest(
        'https://aetherbi.com/api/aggregator-radar/alert?cron=true',
        { method: 'GET' },
      )
      const res1 = await radarAlertGet(spoofedQueryReq)
      expect(res1.status).toBe(401)

      const spoofedHeaderReq = new NextRequest(
        'https://aetherbi.com/api/aggregator-radar/alert',
        {
          method: 'GET',
          headers: { 'x-vercel-cron': '1' },
        },
      )
      const res2 = await radarAlertGet(spoofedHeaderReq)
      expect(res2.status).toBe(401)
    })

    it('rejects POST with manualTrigger=true when caller is unauthenticated or auditor instead of swallowing auth error', async () => {
      emailDispatchSpy.mockClear()
      const unauthManualPost = new NextRequest(
        'https://aetherbi.com/api/aggregator-radar/alert',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            manualTrigger: true,
            kind: 'talabat_area_alert',
            emailText: 'Unauthenticated relay attempt',
          }),
        },
      )
      const unauthRes = await radarAlertPost(unauthManualPost)
      expect([401, 500]).toContain(unauthRes.status)
      expect(emailDispatchSpy).not.toHaveBeenCalled()

      const auditorToken = await createExecSessionToken(DEFAULT_AUDITOR_EMAIL, 'auditor')
      const auditorManualPost = new NextRequest(
        'https://aetherbi.com/api/aggregator-radar/alert',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `${EXEC_SESSION_COOKIE}=${auditorToken}`,
          },
          body: JSON.stringify({
            manualTrigger: true,
            kind: 'talabat_area_alert',
            emailText: 'Auditor relay attempt',
          }),
        },
      )
      const auditorRes = await radarAlertPost(auditorManualPost)
      expect(auditorRes.status).toBe(403)
      expect(emailDispatchSpy).not.toHaveBeenCalled()
    })
  })

  describe('S2. Security /audit: /api/erp/hr-summary blocks read-only auditor session with HTTP 403', () => {
    it('denies auditor access to HR employee counts on GET /api/erp/hr-summary', async () => {
      const auditorToken = await createExecSessionToken(DEFAULT_AUDITOR_EMAIL, 'auditor')
      const req = new NextRequest('https://aetherbi.com/api/erp/hr-summary', {
        method: 'GET',
        headers: {
          cookie: `${EXEC_SESSION_COOKIE}=${auditorToken}`,
          'sec-fetch-site': 'same-origin',
          host: 'aetherbi.com',
        },
      })
      const res = await hrSummaryGet(req)
      expect(res.status).toBe(403)
      const body = (await res.json()) as { ok?: boolean; error?: string }
      expect(body.ok).toBe(false)
      expect(body.error).toBe('Read-only auditor session')
    })
  })

  describe('M2. Single SmartDropzonePortal implementation (zero parallel duplicate)', () => {
    it('re-exports the canonical module implementation from src/components/SmartDropzonePortal.tsx', () => {
      expect(SmartDropzoneFromComponents).toBe(SmartDropzoneFromModule)
      const reExportSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/components/SmartDropzonePortal.tsx'),
        'utf8',
      )
      const nonEmptyLines = reExportSrc
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      expect(nonEmptyLines.length).toBeLessThanOrEqual(3)
      expect(reExportSrc).toContain("@/modules/smart-dropzone/ui/SmartDropzonePortal")
    })
  })

  describe('L1. nonCompanyItemSql() stays in 100% parity with isNonCompanyCatalogItem()', () => {
    it('blocks croissant, avocado, all Arabic spelling variants, and bracketed non-company SKUs in SQL just like JS', () => {
      const blockedSamples: ReadonlyArray<readonly [string, string]> = [
        ...NON_COMPANY_ITEM_SKUS.map((sku) => [sku, 'Plain Item'] as const),
        ['VF-CUSTOM-1', '[RIFDC013] Bakery Roll'],
        ['VF-CUSTOM-2', 'Butter Croissant'],
        ['VF-CUSTOM-3', 'كرواسون جبن'],
        ['VF-CUSTOM-4', 'كرواسان زبدة'],
        ['VF-CUSTOM-5', 'Fresh Hass Avocado'],
        ['VF-CUSTOM-6', 'سلطة أفوكادو'],
        ['VF-CUSTOM-7', 'عصير افوكادو'],
      ]

      for (const [sku, name] of blockedSamples) {
        expect(isNonCompanyCatalogItem(sku, name), `JS should block ${sku} / ${name}`).toBe(true)
        expect(
          evaluateSqlFilterAgainstItem(sku, name),
          `SQL should also block ${sku} / ${name}`,
        ).toBe(false)
      }

      const allowedSamples: ReadonlyArray<readonly [string, string]> = [
        ['CG-001', 'Sweet & Sour Chicken'],
        ['TH-002', 'بوكس شاورما طحينة'],
        ['FR-003', "Frank's Beef Slider"],
        ['FB-004', 'بروستد فارم براون'],
        ['TNB-005', 'نودلز دجاج سيشوان'],
        ['KC-006', 'شاي كرك زعفران'],
      ]

      for (const [sku, name] of allowedSamples) {
        expect(isNonCompanyCatalogItem(sku, name), `JS should allow ${sku}`).toBe(false)
        expect(evaluateSqlFilterAgainstItem(sku, name), `SQL should allow ${sku}`).toBe(true)
      }
    })
  })

  describe('L2. Fail-closed totals when a single contributing row is null (never summed with ?? 0)', () => {
    it('DeliveryRadarV5 renders unavailable total instead of partial sum when one aggregator channel is null', () => {
      const bucket = buildCompleteBucket()
      // Set ONE aggregator channel ('talabat-tgo') to null; remaining 5 aggregators sum to 2,160.750 KWD.
      ;(bucket.uiChannels as Record<string, unknown>)['talabat-tgo'] = {
        netKwd: null,
        orders: null,
      }
      installGlobalContext(buildSummaryWithBucket(bucket))

      const enHtml = renderWithProviders('en', React.createElement(DeliveryRadarV5))
      const arHtml = renderWithProviders('ar', React.createElement(DeliveryRadarV5))

      // Must NOT present partial sum 2,160.750 as complete Aggregator POS Sales total
      expect(enHtml).not.toContain('2,160.750')
      expect(arHtml).not.toContain('2,160.750')
      expect(arHtml).toContain('غير متاح')
    })

    it('BrandSalesAnalyticsDashboard renders unavailable total instead of partial sum when one brand row is null', () => {
      const bucket = buildCompleteBucket()
      // Set ONE brand ('franks' = 1,400 KWD) to null; remaining 5 brands sum to 4,800.000 KWD.
      ;(bucket.byBrand as Record<string, unknown>).franks = {
        netKwd: null,
        orders: null,
        qty: null,
      }
      installGlobalContext(buildSummaryWithBucket(bucket))

      const enHtml = renderWithProviders('en', React.createElement(BrandSalesAnalyticsDashboard))
      // Must NOT present 4,800.000 KWD as Total 6-Brand Sales
      expect(enHtml).not.toContain('4,800.000')
      expect(enHtml).toContain('data-unavailable="true"')
    })

    it('FullJourney360 fails branch sharePct closed to em-dash instead of inflating shares when one branch row is null', () => {
      const bucket = buildCompleteBucket()
      // Set ONE mapped branch ('avenues' = 4,000.125 KWD) to null; remaining 6 branches sum to 9,000.750 KWD.
      // If avenues were counted as 0 in denom, '360-mall' (3,000.250 KWD) would show fake share 33.3%!
      ;(bucket.byLocation as Record<string, unknown>).avenues = {
        netKwd: null,
        orders: null,
      }
      ;(bucket.mappedByLocation as Record<string, unknown>).avenues = {
        netKwd: null,
        orders: null,
      }
      installGlobalContext(buildSummaryWithBucket(bucket))

      const enHtml = renderWithProviders('en', React.createElement(FullJourney360))
      expect(enHtml).not.toContain('33.3%')
      expect(enHtml).toContain('data-unavailable="true"')
    })
  })

  describe('L3. fmtSignedPp returns em-dash on non-finite values instead of 0.0 pp', () => {
    it('formats NaN, Infinity, null, and undefined as em-dash while preserving signed finite pp', () => {
      const beforeAfterFmt = (
        BeforeAfterModule as unknown as {
          fmtSignedPp?: (pp: number | null | undefined) => string
        }
      ).fmtSignedPp
      const weekdayFmt = (
        WeekdayModule as unknown as {
          fmtSignedPp?: (pp: number | null | undefined) => string
        }
      ).fmtSignedPp

      expect(typeof beforeAfterFmt).toBe('function')
      expect(typeof weekdayFmt).toBe('function')

      for (const fn of [beforeAfterFmt!, weekdayFmt!]) {
        expect(fn(Number.NaN)).toBe(UNAVAILABLE_DASH)
        expect(fn(Number.POSITIVE_INFINITY)).toBe(UNAVAILABLE_DASH)
        expect(fn(Number.NEGATIVE_INFINITY)).toBe(UNAVAILABLE_DASH)
        expect(fn(null)).toBe(UNAVAILABLE_DASH)
        expect(fn(undefined)).toBe(UNAVAILABLE_DASH)
        expect(fn(2.34)).toBe('+2.3 pp')
        expect(fn(-1.25)).toBe('-1.3 pp')
        expect(fn(0)).toBe('0.0 pp')
        expect(fn(-0)).toBe('0.0 pp')
      }
    })
  })

  describe('L4. governance-routing.ts uses Asia/Kuwait calendar day between 00:00 and 03:00 Kuwait time', () => {
    it('stamps 2026-11-17 (not UTC 2026-11-16) at 2026-11-16T22:30:00Z (01:30 Asia/Kuwait)', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-11-16T22:30:00.000Z'))

      const fakeAuth = {
        userId: 'u-admin',
        tenantId: 't-vf',
        role: 'admin',
        permissions: new Set<string>(),
      } as unknown as Parameters<typeof routeArchive>[0]['auth']

      const contractReq = new NextRequest('https://aetherbi.com/api/v1/governance/archive', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'idem-kw-contract-1',
        },
        body: JSON.stringify({
          fileName: 'lease-2026.pdf',
          documentCategory: 'contract',
          text: 'Contract',
        }),
      })

      const contractRes = await routeArchive({ request: contractReq, auth: fakeAuth, params: {} })
      expect(contractRes.status).toBe(201)
      expect(contractCreateSpy).toHaveBeenCalledTimes(1)
      expect(contractCreateSpy.mock.calls[0]?.[2]).toMatchObject({
        startDate: '2026-11-17',
        endDate: '2027-11-17',
      })

      const deliveryReq = new NextRequest('https://aetherbi.com/api/v1/governance/archive', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'idem-kw-delivery-1',
        },
        body: JSON.stringify({
          fileName: 'delivery-slip.pdf',
          documentCategory: 'delivery_waybill',
          text: 'Delivery',
        }),
      })

      const deliveryRes = await routeArchive({ request: deliveryReq, auth: fakeAuth, params: {} })
      expect(deliveryRes.status).toBe(201)
      expect(deliveryOrderCreateSpy).toHaveBeenCalledTimes(1)
      expect(deliveryOrderCreateSpy.mock.calls[0]?.[2]).toMatchObject({
        orderedOn: '2026-11-17',
      })
    })
  })
})
