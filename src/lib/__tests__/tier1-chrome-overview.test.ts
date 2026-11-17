import { readFile } from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const stubNav = {
  pathname: '/erp',
}

const stubGlobalFilterState = {
  current: null as ReturnType<typeof import('@/components/aether/GlobalFilterContext').useGlobalFilter> | null,
}

vi.mock('next/navigation', () => ({
  usePathname: () => stubNav.pathname,
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

vi.mock('@/components/aether/GlobalFilterContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/aether/GlobalFilterContext')>()
  return {
    ...actual,
    useGlobalFilter: () => {
      if (!stubGlobalFilterState.current) {
        throw new Error('stubGlobalFilterState.current was not initialized')
      }
      return stubGlobalFilterState.current
    },
  }
})

import { BiFilterProvider } from '@/components/aether/BiFilterContext'
import { FullJourney360 } from '@/components/aether/FullJourney360'
import { GlobalFilterBar } from '@/components/aether/GlobalFilterBar'
import { OdooSyncPill } from '@/components/aether/OdooSyncPill'
import { TopFilterBar } from '@/components/aether/TopFilterBar'
import { AetherBiExecutiveDashboard } from '@/components/dashboard/AetherBiExecutiveDashboard'
import { Sidebar as ErpSidebar } from '@/components/erp-sidebar'
import { GovernanceProvider } from '@/components/erp/GovernanceBellDrawer'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
import { OdooLiveStatusStrip } from '@/components/erp/OdooLiveStatusStrip'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { ThemeToggle } from '@/components/ThemeToggle'
import {
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { LanguageProvider } from '@/lib/i18n'
import type { OdooBucketSummary, OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import type { AccessUser } from '@/lib/permissions'
import { ThemeProvider } from '@/lib/theme'

const el = React.createElement

const TypedLangProvider = LanguageProvider as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

const TypedThemeProvider = ThemeProvider as React.ComponentType<{
  initialTheme?: 'dark' | 'light'
  children?: React.ReactNode
}>

const TypedGovernanceProvider = GovernanceProvider as React.ComponentType<{
  isAuditor?: boolean
  sessionRole?: 'admin' | 'gm' | 'finance' | 'ops' | 'auditor'
  children?: React.ReactNode
}>

function buildBucket(overrides: Partial<OdooBucketSummary> = {}): OdooBucketSummary {
  const baseLoc = {
    avenues: { netKwd: 4000.125, orders: 400 },
    '360-mall': { netKwd: 3000.25, orders: 300 },
    assima: { netKwd: 2000.5, orders: 200 },
    promenade: { netKwd: 1500.125, orders: 150 },
    salmiya: { netKwd: 1200, orders: 120 },
    'al-kout': { netKwd: 800, orders: 80 },
    ardiya: { netKwd: 500, orders: 50 },
  }
  return {
    key: 'month',
    from: '2026-10-17',
    to: '2026-11-15',
    days: 30,
    totals: {
      netSalesKwd: 13500.5,
      orders: 1350,
      aovKwd: 10.0,
      restaurantNetKwd: 13001,
      restaurantOrders: 1300,
    },
    byBrand: {
      'china-garden': { netKwd: 4500.25, orders: 450 },
      franks: { netKwd: 3000.25, orders: 300 },
      tahina: { netKwd: 2000, orders: 200 },
      'farm-brown': { netKwd: 1500, orders: 150 },
      'noodle-bar': { netKwd: 1200, orders: 120 },
      'karak-cafeteria': { netKwd: 800, orders: 80 },
    },
    byLocation: baseLoc,
    mappedByLocation: baseLoc,
    unattributedSalesKwd: 499.5,
    unattributedOrders: 50,
    uiChannels: {
      'dine-in': { netKwd: 5000, orders: 500 },
      'takeaway-direct': { netKwd: 2500, orders: 250 },
      'talabat-tgo': { netKwd: 3000, orders: 300 },
      'talabat-tmp': { netKwd: 1000, orders: 100 },
      keeta: { netKwd: 800, orders: 80 },
      deliveroo: { netKwd: 600, orders: 60 },
      jahez: { netKwd: 400, orders: 40 },
      snoonu: { netKwd: 200.5, orders: 20 },
    },
    accounting: {
      available: true,
      from: '2026-10-17',
      to: '2026-11-15',
      sourceModel: 'account.move.line',
      lineCount: 240,
      income: 13500.5,
      otherIncome: 0,
      totalRevenue: 13500.5,
      cogs: 4050.15,
      deliveryCommissions: 1350.05,
      expense: 5400.2,
      depreciation: 675.025,
      otherOpexAndDepreciation: 4725.175,
      operatingProfit: 3375.125,
      completeAccrualPosted: true,
      glIncomplete: false,
    },
    ...overrides,
  }
}

function buildLiveSummary(overrides: Partial<OdooLiveSummary> = {}): OdooLiveSummary {
  const monthBucket = buildBucket()
  const dailySeries = [
    { day: '2026-11-09', orders: 42, netKwd: 420.125 },
    { day: '2026-11-10', orders: 45, netKwd: 450.25 },
    { day: '2026-11-11', orders: 48, netKwd: 480.5 },
    { day: '2026-11-12', orders: 50, netKwd: 512.75 },
    { day: '2026-11-13', orders: 60, netKwd: 650.375 },
    { day: '2026-11-14', orders: 72, netKwd: 845.625 },
    { day: '2026-11-15', orders: 38, netKwd: 390.1 },
  ]
  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    partial: false,
    unavailableSections: [],
    syncedAt: '2026-11-15T12:00:00.000Z',
    lastSyncAt: '2026-11-15T12:00:00.000Z',
    latestRecordAt: '2026-11-15T11:45:00.000Z',
    latestOdooRecordAt: '2026-11-15T14:45:00+03:00',
    latestOperationalDate: '2026-11-14',
    isStale24h: false,
    todayOrders: 38,
    todaySalesKwd: 390.1,
    odooCompanyId: 1,
    dateRange: { from: '2026-10-17', to: '2026-11-15' },
    period: { from: '2026-10-17', to: '2026-11-15' },
    database: null,
    totals: { netSalesKwd: 13500.5, orders: 1350, aovKwd: 10.0 },
    unattributedSalesKwd: 499.5,
    unattributedOrders: 50,
    brands: [
      { id: 'china-garden', brand: 'China Garden', netKwd: 4500.25, sharePct: 33.3 },
      { id: 'franks', brand: "Frank's", netKwd: 3000.25, sharePct: 22.2 },
    ],
    branches: [
      { id: 'avenues', name: 'The Avenues', unit: 'KWD', netSalesKwd: 4000.125, orders: 400, sharePct: 29.6 },
    ],
    channels: [{ name: 'dine-in', amountKwd: 5000 }],
    buckets: {
      today: buildBucket({ key: 'today', from: '2026-11-15', to: '2026-11-15', days: 1 }),
      week: buildBucket({ key: 'week', from: '2026-11-09', to: '2026-11-15', days: 7 }),
      month: monthBucket,
      year: buildBucket({ key: 'year', from: '2026-01-01', to: '2026-11-15', days: 319 }),
    },
    dailySeries,
    hourlySeries: [
      { hour: 13, orders: 200, netKwd: 2100.5 },
      { hour: 16, orders: 90, netKwd: 840.25 },
    ],
    aggregatorReceivables: {
      readable: true,
      openReceivableKwd: 1245.5,
      grossPositiveReceivableKwd: 1400.5,
      creditClearingOffsetKwd: 155.0,
      openLinesCount: 12,
      posClearingLinesCount: 0,
      platformAndCorporateLinesCount: 12,
      fromDate: '2026-10-17',
      toDate: '2026-11-15',
      agingBuckets: [
        {
          key: '0_30',
          labelAr: '0–30 يوماً',
          labelEn: '0–30d',
          residualKwd: 900.25,
          positiveDebitKwd: 950.25,
          creditOffsetKwd: 50,
          linesCount: 9,
        },
      ],
    },
    journeyPulse: {
      rolling30: { from: '2026-10-17', to: '2026-11-15', days: 30, netKwd: 13500.5, orders: 1350, perDayKwd: 450.017 },
      prior30: { from: '2026-09-17', to: '2026-10-16', days: 30, netKwd: 12500.0, orders: 1250, perDayKwd: 416.667 },
      mtd: { from: '2026-11-01', to: '2026-11-15', days: 15, netKwd: 7100.0, orders: 710, perDayKwd: 473.333 },
    },
    ...overrides,
  }
}

function setFilterContext(
  liveSummary: OdooLiveSummary | null,
  overrides: {
    filters?: Partial<GlobalFilters>
    isAuditor?: boolean
    sessionRole?: 'admin' | 'gm' | 'dgm' | 'cfo' | 'ops' | 'marketing' | 'supply' | 'auditor'
    syncingOdoo?: boolean
  } = {},
) {
  const filters: Required<GlobalFilters> = {
    ...DEFAULT_GLOBAL_FILTERS,
    ...(overrides.filters ?? {}),
  }
  const workspace = computeGlobalWorkspace(filters, liveSummary, stubNav.pathname)
  stubGlobalFilterState.current = {
    filters,
    workspace,
    liveSummary,
    isAuditor: overrides.isAuditor ?? false,
    sessionRole: overrides.sessionRole ?? 'admin',
    syncingOdoo: overrides.syncingOdoo ?? false,
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

function renderWithProviders(
  locale: 'ar' | 'en',
  node: React.ReactNode,
  theme: 'dark' | 'light' = 'light',
): string {
  return renderToStaticMarkup(
    el(
      TypedLangProvider,
      { initialLocale: locale },
      el(
        TypedThemeProvider,
        { initialTheme: theme },
        el(
          BiFilterProvider,
          null,
          el(TypedGovernanceProvider, { isAuditor: false, sessionRole: 'admin' }, node),
        ),
      ),
    ),
  )
}

describe('Tier 1 Chrome, /erp & /dashboard Overview', () => {
  beforeEach(() => {
    stubNav.pathname = '/erp'
    setFilterContext(buildLiveSummary())
  })

  describe('/erp FullJourney360', () => {
    it('formats KWD strictly to 3 decimals in AR RTL and EN LTR with dir="ltr" numeric islands', () => {
      const arHtml = renderWithProviders('ar', el(FullJourney360))
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('dir="ltr"')
      expect(arHtml).toContain('tabular-nums')
      expect(arHtml).toContain('13,001.000 د.ك')
      expect(arHtml).toContain('10.001 د.ك')
      expect(arHtml).toContain('4,000.125 د.ك')
      expect(arHtml).toContain('1,245.500 د.ك')
      expect(arHtml).toContain('3,375.125 د.ك')

      const enHtml = renderWithProviders('en', el(FullJourney360))
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('13,001.000 KWD')
      expect(enHtml).toContain('10.001 KWD')
      expect(enHtml).toContain('4,000.125 KWD')
      expect(enHtml).toContain('1,245.500 KWD')
      expect(enHtml).toContain('3,375.125 KWD')
      expect(enHtml).toContain('Unattributed to Branch')
      expect(enHtml).not.toContain('غير منسوب لفرع')
      expect(enHtml).not.toContain('قيود غير مكتملة')
      expect(enHtml).not.toContain('غير مُرحَّل')
    })

    it('renders "—" with "غير متاح" / "Unavailable" tooltip and PartialWarningBanner on partial null sections', () => {
      const partialSummary = buildLiveSummary({
        partial: true,
        unavailableSections: ['year', 'receivables'],
        warningAr: 'بعض الأرقام غير متاحة الآن',
        warningEn: 'Some figures are temporarily unavailable',
        buckets: {
          month: buildBucket(),
          year: buildBucket({
            key: 'year',
            totals: {
              netSalesKwd: null,
              orders: null,
              aovKwd: null,
              restaurantNetKwd: null,
              restaurantOrders: null,
            },
            byLocation: null,
            mappedByLocation: null,
          }),
        },
        aggregatorReceivables: null,
      })

      setFilterContext(partialSummary, { filters: { period: 'year' } })

      const arHtml = renderWithProviders('ar', el(FullJourney360))
      const arMain = arHtml.split('id="admin-pos-terminal-mapping"')[0] ?? arHtml
      expect(arMain).toContain('data-odoo-partial-warning="true"')
      expect(arMain).toContain('بعض الأرقام غير متاحة الآن')
      expect(arMain).toContain('title="غير متاح"')
      expect(arMain).toContain('data-unavailable="true"')
      expect(arMain).toContain('—')
      expect(arMain).not.toContain('• متوسط 0.00 د.ك')

      const enHtml = renderWithProviders('en', el(FullJourney360))
      const enMain = enHtml.split('id="admin-pos-terminal-mapping"')[0] ?? enHtml
      expect(enMain).toContain('data-odoo-partial-warning="true"')
      expect(enMain).toContain('Some figures are temporarily unavailable')
      expect(enMain).toContain('title="Unavailable"')
      expect(enMain).toContain('• AOV —')
      expect(enMain).not.toContain('0.000 KWD')
    })

    it('renders sanitized bilingual disconnected state without Arabic leaks in English', () => {
      setFilterContext(null)

      const arHtml = renderWithProviders('ar', el(FullJourney360))
      expect(arHtml).toContain('data-odoo-no-data="true"')
      expect(arHtml).toContain('لا توجد بيانات من Odoo لهذه الفترة')

      const enHtml = renderWithProviders('en', el(FullJourney360))
      expect(enHtml).toContain('data-odoo-no-data="true"')
      expect(enHtml).toContain('No Odoo data for this period')
      expect(enHtml).not.toContain('لا توجد بيانات من Odoo')
    })

    it('renders loading skeleton during initial sync and enforces cost masking for restricted roles', () => {
      setFilterContext(null, { syncingOdoo: true })
      const loadingHtml = renderWithProviders('ar', el(FullJourney360))
      expect(loadingHtml).toContain('data-state-block="loading"')

      setFilterContext(buildLiveSummary({ readOnly: true }), {
        isAuditor: true,
        sessionRole: 'marketing',
      })
      const maskedEn = renderWithProviders('en', el(FullJourney360))
      expect(maskedEn).toContain('Restricted to Finance/GM')
      expect(maskedEn).not.toContain('+ Sync Odoo')
    })

    it('renders bilingual unposted commissions and incomplete GL warnings honestly', () => {
      const incompleteSummary = buildLiveSummary({
        buckets: {
          month: buildBucket({
            accounting: {
              available: false,
              glIncomplete: true,
              completeAccrualPosted: false,
              aggregatorCommissionUnposted: true,
              income: 13500.5,
              otherIncome: 0,
              cogs: 4050.15,
              deliveryCommissions: 0,
              expense: 0,
              depreciation: 0,
              operatingProfit: 0,
            },
          }),
        },
      })
      setFilterContext(incompleteSummary)

      const enHtml = renderWithProviders('en', el(FullJourney360))
      expect(enHtml).toContain('Incomplete GL entries for this period')
      expect(enHtml).toContain('Not posted yet')
      expect(enHtml).not.toContain('قيود غير مكتملة')
      expect(enHtml).not.toContain('غير مُرحَّل')

      const arHtml = renderWithProviders('ar', el(FullJourney360))
      expect(arHtml).toContain('قيود غير مكتملة لهذه الفترة')
      expect(arHtml).toContain('غير مُرحَّل بعد')
    })
  })

  describe('/dashboard AetherBiExecutiveDashboard', () => {
    it('supports both AR RTL and EN LTR dynamically via LanguageProvider with clean English titleEn', async () => {
      const arHtml = renderWithProviders('ar', el(AetherBiExecutiveDashboard))
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('التقرير المالي والتشغيلي')
      expect(arHtml).toContain('href="/erp"')

      const enHtml = renderWithProviders('en', el(AetherBiExecutiveDashboard))
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('Financial &amp; Operational Summary')
      expect(enHtml).toContain('Unlinked from Source — Legacy Static Dashboard')
      expect(enHtml).not.toContain('غير مربوط بمصدر — Legacy Static Dashboard')

      const dashboardPageSrc = await readFile(
        path.join(process.cwd(), 'src/app/(panel)/dashboard/page.tsx'),
        'utf8',
      )
      expect(dashboardPageSrc).not.toContain('locale="ar"')
    })
  })

  describe('Shared Chrome, Filters & Provenance Controls', () => {
    it('renders a single filter control set on /erp without duplicate GlobalFilterBar or duplicate partial banner', () => {
      stubNav.pathname = '/erp'
      setFilterContext(
        buildLiveSummary({
          partial: true,
          warningAr: 'بعض الأرقام غير متاحة الآن',
          warningEn: 'Some figures are temporarily unavailable',
        }),
      )

      const topBarHtml = renderWithProviders('en', el(TopFilterBar))
      expect(topBarHtml).toContain('Account &amp; Menu')
      expect(topBarHtml).toContain('Filters')
      expect(topBarHtml).not.toContain('data-odoo-partial-warning="true"')
      expect(topBarHtml).not.toContain('data-language-switch=""')

      const globalBarOnErp = renderWithProviders('en', el(GlobalFilterBar))
      expect(globalBarOnErp).toBe('')
    })

    it('renders PanelHeaderBar with single LanguageSwitch + ThemeToggle on /dashboard and GlobalFilterBar with 3-decimal KWD on /erp/delivery-control', () => {
      stubNav.pathname = '/dashboard'
      const dashBarHtml = renderWithProviders('en', el(TopFilterBar))
      expect(dashBarHtml).toContain('data-language-switch=""')
      expect(dashBarHtml).toContain('Switch to Emerald Dark Mode')

      stubNav.pathname = '/erp/delivery-control'
      const deliveryBarHtml = renderWithProviders('en', el(GlobalFilterBar))
      expect(deliveryBarHtml).toMatch(/\.\d{3} KWD/)

      stubNav.pathname = '/erp/delivery-sla'
      setFilterContext(
        buildLiveSummary({
          partial: true,
          warningAr: 'بعض الأرقام غير متاحة الآن',
          warningEn: 'Some figures are temporarily unavailable',
        }),
      )
      const deliverySlaTopBar = renderWithProviders('en', el(TopFilterBar))
      expect(deliverySlaTopBar).toContain('data-odoo-partial-warning="true"')
      expect(deliverySlaTopBar).toContain('Some figures are temporarily unavailable')

      for (const route of [
        '/erp/receivables',
        '/erp/brand-sales-analytics',
        '/erp/weekday-comparison',
        '/erp/before-after',
        '/erp/feryal-ai',
        '/erp/cost-intelligence',
        '/erp/warehouse-chain',
      ]) {
        stubNav.pathname = route
        const studioTopBar = renderWithProviders('en', el(TopFilterBar))
        expect(studioTopBar).not.toContain('data-odoo-partial-warning="true"')
      }

      stubNav.pathname = '/erp/odoo-sync'
      const odooSyncTopBar = renderWithProviders('en', el(TopFilterBar))
      expect(odooSyncTopBar).not.toContain('<h1')
    })

    it('renders ThemeToggle with SVG icons and zero moon/sun emojis', () => {
      const htmlLight = renderWithProviders('en', el(ThemeToggle), 'light')
      const htmlDark = renderWithProviders('ar', el(ThemeToggle), 'dark')
      expect(htmlLight).toContain('<svg')
      expect(htmlLight).not.toMatch(/[🌙☀️🌞🌚]/)
      expect(htmlDark).not.toMatch(/[🌙☀️🌞🌚]/)
    })

    it('renders OdooLiveStatusStrip with 3-decimal KWD and null-safe unavailable dash', () => {
      setFilterContext(buildLiveSummary({ todayOrders: 15, todaySalesKwd: 245.5 }))
      const enHtml = renderWithProviders('en', el(OdooLiveStatusStrip))
      expect(enHtml).toContain('245.500 KWD')

      setFilterContext(buildLiveSummary({ todayOrders: 15, todaySalesKwd: undefined }))
      const nullArHtml = renderWithProviders('ar', el(OdooLiveStatusStrip))
      expect(nullArHtml).toContain('—')
      expect(nullArHtml).toContain('title="غير متاح"')
    })

    it('renders KpiProvenanceBadge cleanly in AR and EN without mixed stale text', () => {
      const staleIso = '2025-01-01T00:00:00.000Z'
      const enHtml = renderWithProviders(
        'en',
        el(KpiProvenanceBadge, {
          odooModel: 'pos.order',
          dateRange: { from: '2026-10-17', to: '2026-11-15' },
          lastSyncAt: staleIso,
          kind: 'actual',
          isAr: false,
        }),
      )
      expect(enHtml).toContain('Actual')
      expect(enHtml).toContain('Stale')
      expect(enHtml).not.toContain('قديمة')
      expect(enHtml).not.toContain('title=')

      const arHtml = renderWithProviders(
        'ar',
        el(KpiProvenanceBadge, {
          odooModel: 'pos.order',
          dateRange: { from: '2026-10-17', to: '2026-11-15' },
          lastSyncAt: staleIso,
          kind: 'actual',
          isAr: true,
        }),
      )
      expect(arHtml).toContain('فعلي')
      expect(arHtml).toContain('قديمة')
    })

    it('renders OdooSyncPill, ErpSidebar, and MobileBottomNav cleanly in AR and EN', () => {
      const pillEn = renderWithProviders('en', el(OdooSyncPill, { isAr: false }))
      expect(pillEn).toContain('Odoo 17')

      const sampleUser: AccessUser = {
        id: 'u-1',
        name: 'Admin',
        email: 'admin@venturefoods.test',
        role: { id: 'r-1', name: 'Admin', isAdmin: true, permissions: [] },
      }
      const sideAr = renderWithProviders('ar', el(ErpSidebar, { user: sampleUser }))
      expect(sideAr).toContain('w-[272px]')
      expect(sideAr).toContain('dir="rtl"')

      const dockEn = renderWithProviders('en', el(MobileBottomNav))
      expect(dockEn).toContain('grid-cols-5')
      expect(dockEn).toContain('h-16')
      expect(dockEn).toContain('pb-[env(safe-area-inset-bottom)]')
    })
  })

  describe('Static Guardrails across Owned Files', () => {
    it('enforces zero sub-12px fonts and preserves FullJourney360 & chrome structural invariants', async () => {
      const root = process.cwd()
      const ownedPaths = [
        'src/components/shell.tsx',
        'src/components/Sidebar.tsx',
        'src/components/Topbar.tsx',
        'src/components/erp-sidebar.tsx',
        'src/components/panel-chrome.tsx',
        'src/components/mobile-bottom-nav.tsx',
        'src/components/GlobalScopeFilter.tsx',
        'src/components/aether/GlobalFilterBar.tsx',
        'src/components/aether/TopFilterBar.tsx',
        'src/components/ThemeToggle.tsx',
        'src/components/aether/OdooSyncPill.tsx',
        'src/components/erp/OdooLiveStatusStrip.tsx',
        'src/components/erp/KpiProvenanceBadge.tsx',
        'src/app/erp/layout.tsx',
        'src/app/erp/page.tsx',
        'src/components/aether/FullJourney360.tsx',
        'src/app/(panel)/dashboard/page.tsx',
        'src/components/dashboard/AetherBiExecutiveDashboard.tsx',
      ]

      const sub12Re = /text-\[(?:10|10\.5|11|11\.5)px\]/
      for (const rel of ownedPaths) {
        const src = await readFile(path.join(root, rel), 'utf8')
        expect(src, `${rel} must not contain sub-12px font classes`).not.toMatch(sub12Re)
      }

      const journeySrc = await readFile(
        path.join(root, 'src/components/aether/FullJourney360.tsx'),
        'utf8',
      )
      expect(journeySrc).not.toContain('truncate')
      expect(journeySrc).not.toContain('<h1')
      expect(journeySrc).not.toContain('href="#')
      expect(journeySrc).toContain('grid-cols-2 lg:grid-cols-4')
      expect(journeySrc).toContain('p-3.5 sm:p-5')
      expect(journeySrc).toContain('pb-28 sm:pb-12')
      expect(journeySrc).toContain('!auditorReadOnly')
      expect(journeySrc).toContain('Restricted to Finance/GM')
    })
  })
})
