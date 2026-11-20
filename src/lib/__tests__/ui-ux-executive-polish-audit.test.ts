import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const stubNav = {
  pathname: '/erp',
}

const stubGlobalFilterState = {
  current: null as ReturnType<
    typeof import('@/components/aether/GlobalFilterContext').useGlobalFilter
  > | null,
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
import {
  CoresHubStudio,
  resolveDynamicKpiGridClass as resolveCoresKpiGridClass,
} from '@/components/aether/CoresHubStudio'
import {
  FullJourney360,
  resolveDynamicKpiGridClass as resolveSummaryKpiGridClass,
} from '@/components/aether/FullJourney360'
import { OdooSyncPill } from '@/components/aether/OdooSyncPill'
import { ScopeBadge } from '@/components/aether/ScopeBadge'
import { TopFilterBar } from '@/components/aether/TopFilterBar'
import { Sidebar as ErpSidebar } from '@/components/erp-sidebar'
import { GovernanceProvider } from '@/components/erp/GovernanceBellDrawer'
import {
  KpiProvenanceBadge,
  computeCollisionAwarePopoverCoords,
} from '@/components/erp/KpiProvenanceBadge'
import { OdooPartialWarningBanner } from '@/components/erp/OdooPartialWarningBanner'
import {
  FeryalGovernanceStudio,
  applyFeryalPromptAutoResize,
  computeFeryalPromptResize,
  shouldSubmitFeryalPromptOnKeyDown,
} from '@/components/erp/feryal-governance-studio'
import {
  CompactInfoTooltip,
  computeCompactTooltipCoords,
} from '@/components/ui/compact-info-tooltip'
import {
  DetailsPopover,
  computeDetailsPopoverCoords,
} from '@/components/ui/details-popover'
import { KpiCard } from '@/components/ui/kpi-card'
import { PartialWarningBanner } from '@/components/ui/partial-warning-banner'
import { StatCard } from '@/components/ui/stat-card'
import {
  DEFAULT_GLOBAL_FILTERS,
  computeGlobalWorkspace,
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

const TypedCoresHubStudio = CoresHubStudio as React.ComponentType<{
  initialTab?: 'marketing' | 'sales' | 'menu'
}>

function buildBucketFixture(overrides: Partial<OdooBucketSummary> = {}): OdooBucketSummary {
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

function buildLiveSummaryFixture(overrides: Partial<OdooLiveSummary> = {}): OdooLiveSummary {
  const monthBucket = buildBucketFixture()
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
      {
        id: 'avenues',
        name: 'The Avenues',
        unit: 'KWD',
        netSalesKwd: 4000.125,
        orders: 400,
        sharePct: 29.6,
      },
    ],
    channels: [{ name: 'dine-in', amountKwd: 5000 }],
    buckets: {
      today: buildBucketFixture({ key: 'today', from: '2026-11-15', to: '2026-11-15', days: 1 }),
      week: buildBucketFixture({ key: 'week', from: '2026-11-09', to: '2026-11-15', days: 7 }),
      month: monthBucket,
      year: buildBucketFixture({ key: 'year', from: '2026-01-01', to: '2026-11-15', days: 319 }),
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
      posClearingLinesCount: 4,
      platformAndCorporateLinesCount: 8,
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
      rolling30: {
        from: '2026-10-17',
        to: '2026-11-15',
        days: 30,
        netKwd: 13500.5,
        orders: 1350,
        perDayKwd: 450.017,
      },
      prior30: {
        from: '2026-09-17',
        to: '2026-10-16',
        days: 30,
        netKwd: 12500.0,
        orders: 1250,
        perDayKwd: 416.667,
      },
      mtd: {
        from: '2026-11-01',
        to: '2026-11-15',
        days: 15,
        netKwd: 7100.0,
        orders: 710,
        perDayKwd: 473.333,
      },
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

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

function stripStringLiterals(code: string): string {
  return code
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
}

async function collectFilesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules' || entry.name === '.next') {
        continue
      }
      files.push(...(await collectFilesUnder(full)))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files.sort()
}

describe('Executive UI/UX Polish Audit — Full 10-Defect Regression Suite', () => {
  beforeEach(() => {
    stubNav.pathname = '/erp'
    setFilterContext(buildLiveSummaryFixture())
  })

  describe('Defect #1 — Portal Popovers, Collision-Aware Flip & Unclipped KPI Containers', () => {
    it('flips DetailsPopover, KpiProvenanceBadge, and CompactInfoTooltip vertically & horizontally within 12px viewport bounds in LTR & RTL', () => {
      // 1. Ample room below & right -> opens below at trigger left
      const standard = computeDetailsPopoverCoords({
        triggerRect: { top: 120, bottom: 152, left: 160, right: 240 },
        popoverWidth: 288,
        popoverHeight: 176,
        viewportWidth: 1440,
        viewportHeight: 900,
        isRtl: false,
        align: 'start',
      })
      expect(standard.placement).toBe('bottom')
      expect(standard.top).toBe(160)
      expect(standard.left).toBe(160)

      // 2. Near bottom & right edge in LTR -> flips upward AND flips horizontally to fit left of right margin
      const bottomRightLtr = computeDetailsPopoverCoords({
        triggerRect: { top: 710, bottom: 742, left: 1180, right: 1260 },
        popoverWidth: 288,
        popoverHeight: 176,
        viewportWidth: 1280,
        viewportHeight: 768,
        isRtl: false,
        align: 'start',
      })
      expect(bottomRightLtr.placement).toBe('top')
      expect(bottomRightLtr.top).toBe(526)
      expect(bottomRightLtr.horizontalAlign).toBe('end')
      expect(bottomRightLtr.left).toBeGreaterThanOrEqual(12)
      expect(bottomRightLtr.left + 288).toBeLessThanOrEqual(1280 - 12)

      // 3. Near bottom & left edge in RTL (`align='start'` prefers right edge -> overflows left `< 12` -> flips right)
      const bottomLeftRtl = computeDetailsPopoverCoords({
        triggerRect: { top: 700, bottom: 732, left: 24, right: 104 },
        popoverWidth: 288,
        popoverHeight: 176,
        viewportWidth: 1280,
        viewportHeight: 768,
        isRtl: true,
        align: 'start',
      })
      expect(bottomLeftRtl.placement).toBe('top')
      expect(bottomLeftRtl.horizontalAlign).toBe('end')
      expect(bottomLeftRtl.left).toBe(24)

      // 4. KpiProvenanceBadge collision math flips up near viewport bottom & clamps horizontally
      const provFlip = computeCollisionAwarePopoverCoords({
        triggerRect: { top: 705, bottom: 735, left: 1190, right: 1265 },
        popoverWidth: 288,
        popoverHeight: 180,
        viewportWidth: 1280,
        viewportHeight: 768,
        isRtl: false,
      })
      expect(provFlip.placement).toBe('top')
      expect(provFlip.left).toBeGreaterThanOrEqual(12)
      expect(provFlip.left + 288).toBeLessThanOrEqual(1280 - 12)

      // 5. CompactInfoTooltip flips below when near top of viewport and clamps near edges
      const tipNearTop = computeCompactTooltipCoords({
        triggerRect: { top: 20, bottom: 44, left: 16, right: 40 },
        panelWidth: 288,
        panelHeight: 96,
        viewportWidth: 1280,
        viewportHeight: 800,
        isRtl: false,
      })
      expect(tipNearTop.placement).toBe('bottom')
      expect(tipNearTop.left).toBeGreaterThanOrEqual(12)
    })

    it('renders DetailsPopover, KpiProvenanceBadge, and CompactInfoTooltip via fixed z-50 portals and keeps KpiCard & StatCard overflow-visible', async () => {
      const detailsHtml = renderWithProviders(
        'en',
        el(DetailsPopover, {
          isAr: false,
          open: true,
          heading: 'GL Account Breakdown',
          children: el('span', null, 'Account 400001'),
        }),
      )
      expect(detailsHtml).toContain('data-details-portal="true"')
      expect(detailsHtml).toContain('fixed z-50')
      expect(detailsHtml).toContain('z-index:9999')

      const provHtml = renderWithProviders(
        'en',
        el(KpiProvenanceBadge, {
          odooModel: 'pos.order',
          dateRange: { from: '2026-11-01', to: '2026-11-15' },
          lastSyncAt: '2026-11-15T12:00:00.000Z',
          kind: 'actual',
          isAr: false,
          open: true,
        }),
      )
      expect(provHtml).toContain('data-kpi-provenance-portal="true"')
      expect(provHtml).toContain('fixed z-50')
      expect(provHtml).toContain('z-index:9999')

      const compactTipHtml = renderWithProviders(
        'en',
        el(CompactInfoTooltip, {
          text: 'Open month net profit withheld until lock date',
          label: 'Accounting close status',
          isAr: false,
          open: true,
        }),
      )
      expect(compactTipHtml).toContain('data-compact-info-portal="true"')
      expect(compactTipHtml).toContain('fixed z-50')
      expect(compactTipHtml).toContain('z-index:9999')

      const kpiHtml = renderWithProviders(
        'en',
        el(KpiCard, { label: 'Net Sales', value: 1250.5, locale: 'en' }),
      )
      expect(kpiHtml).toContain('overflow-visible')
      expect(kpiHtml).not.toContain('overflow-hidden')

      const statHtml = renderWithProviders(
        'en',
        el(StatCard, { label: 'Active Branches', value: '7' }),
      )
      expect(statHtml).toContain('overflow-visible')
      expect(statHtml).not.toContain('overflow-hidden')

      const root = process.cwd()
      for (const rel of [
        'src/components/ui/details-popover.tsx',
        'src/components/ui/compact-info-tooltip.tsx',
        'src/components/erp/KpiProvenanceBadge.tsx',
      ]) {
        const src = await readFile(path.join(root, rel), 'utf8')
        expect(src, `${rel} must portal into document.body`).toContain(
          'createPortal(',
        )
        expect(src, `${rel} must target document.body`).toContain('document.body')
      }
    })
  })

  describe('Defect #2 — Dynamic KPI Grids, Hidden Zero-Placeholder Cards & Real Odoo KPI Promotion', () => {
    it('maps visible card counts 1..4 & 6 to exact responsive grid column classes with zero trailing empty slots', () => {
      for (const resolver of [resolveSummaryKpiGridClass, resolveCoresKpiGridClass]) {
        expect(resolver(1)).toBe('grid-cols-1')
        expect(resolver(2)).toBe('grid-cols-1 md:grid-cols-2')
        expect(resolver(3)).toBe('grid-cols-1 md:grid-cols-2 lg:grid-cols-3')
        expect(resolver(4)).toBe('grid-cols-1 md:grid-cols-2 lg:grid-cols-4')
        expect(resolver(6)).toBe('grid-cols-1 md:grid-cols-2 lg:grid-cols-3')
      }
    })

    it('hides unposted GL, zero Aggregator Commissions, and zero Unattributed Branch cards while promoting Average Order Value and Top Performing Branch', () => {
      const zeroUnattributedAndUnpostedSummary = buildLiveSummaryFixture({
        unattributedSalesKwd: 0,
        unattributedOrders: 0,
        buckets: {
          month: buildBucketFixture({
            unattributedSalesKwd: 0,
            unattributedOrders: 0,
            accounting: {
              available: false,
              glIncomplete: true,
              completeAccrualPosted: false,
              aggregatorCommissionUnposted: true,
              income: 0,
              otherIncome: 0,
              cogs: 0,
              deliveryCommissions: 0,
              expense: 0,
              depreciation: 0,
              operatingProfit: 0,
            },
          }),
        },
      })
      setFilterContext(zeroUnattributedAndUnpostedSummary)

      const summaryEn = renderWithProviders('en', el(FullJourney360))
      expect(summaryEn).not.toContain('Posted general ledger entries')
      expect(summaryEn).not.toContain('Aggregator Commissions')
      expect(summaryEn).not.toContain('data-branch-card="unattributed"')
      expect(summaryEn).not.toContain('Unattributed to Branch')
      expect(summaryEn).toContain('data-kpi="average-order-value"')
      expect(summaryEn).toContain('Average Order Value')
      expect(summaryEn).toContain('data-kpi="top-performing-branch"')
      expect(summaryEn).toContain('Top Performing Branch')

      stubNav.pathname = '/erp/cores'
      setFilterContext(zeroUnattributedAndUnpostedSummary)
      const coresEn = renderWithProviders('en', el(TypedCoresHubStudio, { initialTab: 'sales' }))
      expect(coresEn).not.toContain('data-unattributed-card="true"')
      expect(coresEn).not.toContain('Unattributed to Branch')
      expect(coresEn).toContain('Average Order Value')
      expect(coresEn).toContain('Top Performing Branch')
    })
  })

  describe('Defect #3 — Temporary Warning Banner Suppression & Hero Net Sales Card Cleanup', () => {
    it('suppresses partial warning clutter banners globally and keeps Hero Net Sales comparison + AOV on a clean single row without hourly fallback clutter', () => {
      const partialNoHourlySummary = buildLiveSummaryFixture({
        partial: true,
        unavailableSections: ['accounting', 'hourly'],
        warningAr: 'بعض الأرقام غير متاحة الآن',
        warningEn: 'Some figures are temporarily unavailable',
        hourlySeries: [],
        buckets: {
          today: buildBucketFixture({
            key: 'today',
            from: '2026-11-15',
            to: '2026-11-15',
            days: 1,
          }),
          month: buildBucketFixture(),
        },
      })

      expect(
        renderWithProviders(
          'en',
          el(OdooPartialWarningBanner, { summary: partialNoHourlySummary, isAr: false }),
        ),
      ).toBe('')
      expect(
        renderWithProviders(
          'en',
          el(PartialWarningBanner, { summary: partialNoHourlySummary, partial: true, locale: 'en' }),
        ),
      ).toBe('')

      setFilterContext(partialNoHourlySummary, { filters: { period: 'today' } })
      const summaryEn = renderWithProviders('en', el(FullJourney360))
      expect(summaryEn).toContain('ae-hero-emerald-card')
      expect(summaryEn).not.toContain('Some figures are temporarily unavailable')
      expect(summaryEn).not.toContain('Trend not available — no hourly data for this period')
      expect(summaryEn).toContain('data-hero-comparison-row="true"')

      const summaryAr = renderWithProviders('ar', el(FullJourney360))
      expect(summaryAr).not.toContain('بعض الأرقام غير متاحة الآن')
      expect(summaryAr).not.toContain('الاتجاه غير متاح — لا توجد بيانات بالساعة لهذه الفترة')
      expect(summaryAr).toContain('data-hero-comparison-row="true"')

      stubNav.pathname = '/erp/cores'
      setFilterContext(partialNoHourlySummary, { filters: { period: 'today' } })
      const coresEn = renderWithProviders('en', el(TypedCoresHubStudio, { initialTab: 'sales' }))
      expect(coresEn).not.toContain('Some figures are temporarily unavailable')
    })
  })

  describe('Defect #4 — Non-Overlapping Scrollable Sidebar & Pinned User Profile Footer', () => {
    it('renders <nav> with flex-1 min-h-0 overflow-y-auto pb-24 above a static shrink-0 user footer so Governance & Strategy and Decision Room never clip', async () => {
      const sampleUser: AccessUser = {
        id: 'u-admin',
        name: 'Abdullah Awirah',
        email: 'admin@venturefoods.test',
        role: { id: 'r-admin', name: 'Admin', isAdmin: true, permissions: [] },
      }

      for (const locale of ['en', 'ar'] as const) {
        const html = renderWithProviders(locale, el(ErpSidebar, { user: sampleUser }))
        expect(html).toContain('flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain')
        expect(html).toContain('pb-24')
        expect(html).toContain('data-sidebar-section="governance-strategy"')
        expect(html).toContain('href="/erp/decisions"')
        expect(html).toContain('data-sidebar-footer="true"')

        const decisionIdx = html.indexOf('href="/erp/decisions"')
        const footerIdx = html.indexOf('data-sidebar-footer="true"')
        expect(decisionIdx).toBeGreaterThan(-1)
        expect(footerIdx).toBeGreaterThan(decisionIdx)

        if (locale === 'en') {
          expect(html).toContain('Governance &amp; Strategy')
          expect(html).toContain('Decision Room')
        } else {
          expect(html).toContain('الحوكمة والتخطيط')
          expect(html).toContain('غرفة القرار')
        }
      }

      const shellSrc = await readFile(
        path.join(process.cwd(), 'src/components/erp/shell.tsx'),
        'utf8',
      )
      expect(shellSrc).toContain('overflow-y: auto !important')
      expect(shellSrc).toContain('padding-bottom: 6rem !important')
      expect(shellSrc).toContain('position: static !important')
      expect(shellSrc).toContain('flex-shrink: 0 !important')
    })
  })

  describe('Defect #5 — Posted General Ledger Entries Card Compact Info Tooltip', () => {
    it('renders Posted general ledger entries with crisp ledger lines and CompactInfoTooltip instead of verbose inline disclaimers', () => {
      setFilterContext(buildLiveSummaryFixture())
      const enHtml = renderWithProviders('en', el(FullJourney360))
      expect(enHtml).toContain('Posted general ledger entries')
      expect(enHtml).toContain('data-posted-gl-lines="true"')
      expect(enHtml).toContain('data-compact-info-tooltip="true"')
      expect(enHtml).toContain('data-net-profit-withheld="true"')
    })
  })

  describe('Defects #6 & #7 — Branch Title/Badge Non-Collision & Single Section-Header POS Note', () => {
    it('truncates branch titles safely next to shrink-0 percentage badges and renders Mapped Odoo POS note once in section header', () => {
      setFilterContext(buildLiveSummaryFixture())
      const enHtml = renderWithProviders('en', el(FullJourney360))

      expect(enHtml).toContain('data-branch-card="promenade"')
      expect(enHtml).toContain('title="Promenade"')

      // Section header has the mapped POS note once; individual branch cards never repeat "Mapped Odoo POS location"
      const headerNoteMatches = enHtml.match(/Mapped Odoo 17 POS locations/g) ?? []
      expect(headerNoteMatches.length).toBe(1)
      expect(enHtml).not.toContain('Mapped Odoo POS location')

      const promenadeSegment =
        enHtml.split('data-branch-card="promenade"')[1]?.split('</article>')[0] ??
        enHtml.split('data-branch-card="promenade"')[1]?.slice(0, 1800) ??
        ''
      expect(promenadeSegment).toContain('min-w-0 flex-1 truncate')
      expect(promenadeSegment).toContain('shrink-0 whitespace-nowrap')
      expect(promenadeSegment).not.toContain('Mapped Odoo')

      stubNav.pathname = '/erp/cores'
      setFilterContext(buildLiveSummaryFixture())
      const coresEn = renderWithProviders('en', el(TypedCoresHubStudio, { initialTab: 'sales' }))
      const coresNoteMatches = coresEn.match(/Mapped Odoo 17 POS branch locations/g) ?? []
      expect(coresNoteMatches.length).toBe(1)
      expect(coresEn).not.toContain('Mapped Odoo POS location')
    })
  })

  describe('Defect #8 — Top Header Bar Alignment & Non-Crowding Left of Period: Today', () => {
    it('keeps desktop topbar controls flex-nowrap with shrink-0 pills and truncated page title next to Period: Today', () => {
      stubNav.pathname = '/erp'
      setFilterContext(buildLiveSummaryFixture(), { filters: { period: 'today' } })

      const topBarEn = renderWithProviders('en', el(TopFilterBar))
      expect(topBarEn).toContain('data-topbar-row="desktop"')
      expect(topBarEn).toContain('data-topbar-start="true"')
      expect(topBarEn).toContain('data-topbar-end="true"')
      expect(topBarEn).toContain('Period: Today')
      expect(topBarEn).toContain('ae-top-title hidden xl:block min-w-0 flex-1 truncate')

      const scopeHtml = renderWithProviders(
        'en',
        el(ScopeBadge, { kind: 'company-wide', target: 'gl-card', isAr: false }),
      )
      expect(scopeHtml).toContain('shrink-0')
      expect(scopeHtml).toContain('whitespace-nowrap')

      const syncHtml = renderWithProviders('en', el(OdooSyncPill, { isAr: false }))
      expect(syncHtml).toContain('Odoo 17')
      expect(syncHtml).toContain('whitespace-nowrap')
    })
  })

  describe('Defect #9 — Ask Feryal Smooth Auto-Expanding <textarea> up to 40vh', () => {
    it('auto-grows height without scrollbar up to 40vh, enables overflow-y-auto only past 40vh, and handles Enter vs Shift+Enter', () => {
      // 1. Empty value resets height & hides scrollbar
      expect(computeFeryalPromptResize('', 44, 900)).toEqual({
        heightStyle: '',
        overflowScroll: false,
      })

      // 2. Multi-line prompt below 40vh (viewport 900 -> maxPx = 360) -> exact scrollHeight, overflowScroll: false
      expect(computeFeryalPromptResize('Line 1\nLine 2\nLine 3', 148, 900)).toEqual({
        heightStyle: '148px',
        overflowScroll: false,
      })

      // 3. Long pasted prompt above 40vh (scrollHeight 540 > 360) -> capped at 360px, overflowScroll: true
      expect(computeFeryalPromptResize('Long prompt', 540, 900)).toEqual({
        heightStyle: '360px',
        overflowScroll: true,
      })

      // 4. Imperative DOM resize helper resets height to 'auto' before measuring and toggles overflowY
      const fakeTextarea = {
        scrollHeight: 132,
        style: { height: '40px', overflowY: 'hidden' },
      }
      const grewBelowCap = applyFeryalPromptAutoResize(fakeTextarea, 'Three lines', 900)
      expect(grewBelowCap).toBe(false)
      expect(fakeTextarea.style.height).toBe('132px')
      expect(fakeTextarea.style.overflowY).toBe('hidden')

      fakeTextarea.scrollHeight = 520
      const hitCap = applyFeryalPromptAutoResize(fakeTextarea, 'Twenty lines', 900)
      expect(hitCap).toBe(true)
      expect(fakeTextarea.style.height).toBe('360px')
      expect(fakeTextarea.style.overflowY).toBe('auto')

      const cleared = applyFeryalPromptAutoResize(fakeTextarea, '', 900)
      expect(cleared).toBe(false)
      expect(fakeTextarea.style.height).toBe('')
      expect(fakeTextarea.style.overflowY).toBe('hidden')

      // 5. Keyboard Enter vs Shift+Enter vs IME composition
      expect(
        shouldSubmitFeryalPromptOnKeyDown({
          key: 'Enter',
          shiftKey: false,
          isComposing: false,
          sending: false,
          inputText: 'Show yesterday sales by branch',
          attachmentCount: 0,
        }),
      ).toEqual({ preventDefault: true, shouldSend: true })

      expect(
        shouldSubmitFeryalPromptOnKeyDown({
          key: 'Enter',
          shiftKey: true,
          isComposing: false,
          sending: false,
          inputText: 'Line 1',
          attachmentCount: 0,
        }),
      ).toEqual({ preventDefault: false, shouldSend: false })

      expect(
        shouldSubmitFeryalPromptOnKeyDown({
          key: 'Enter',
          shiftKey: false,
          isComposing: true,
          sending: false,
          inputText: 'مرحبا',
          attachmentCount: 0,
        }),
      ).toEqual({ preventDefault: false, shouldSend: false })
    })

    it('renders FeryalGovernanceStudio composer with data-feryal-auto-textarea, max-h-[40vh], resize-none, and zero "truncate" in source', async () => {
      stubNav.pathname = '/erp/feryal-ai'
      setFilterContext(buildLiveSummaryFixture())

      const feryalEn = renderWithProviders(
        'en',
        el(FeryalGovernanceStudio, { sessionRole: 'admin' }),
      )
      expect(feryalEn).toContain('data-feryal-auto-textarea="true"')
      expect(feryalEn).toContain('data-feryal-chat-input="true"')
      expect(feryalEn).toContain('max-h-[40vh]')
      expect(feryalEn).toContain('resize-none')

      const feryalSrc = await readFile(
        path.join(process.cwd(), 'src/components/erp/feryal-governance-studio.tsx'),
        'utf8',
      )
      expect(feryalSrc.includes('truncate')).toBe(false)
      expect(feryalSrc).toContain('data-feryal-simulation-period-guard')
      expect(feryalSrc).toContain('data-rerun-simulation-30d')
    })
  })

  describe('Defect #10 — Full-Site ERP Routes & Studio Invariants Audit', () => {
    it('verifies all src/app/erp/** pages and executive studios uphold static invariants and overflow-visible unclipped surfaces', async () => {
      const root = process.cwd()
      const erpAppFiles = await collectFilesUnder(path.join(root, 'src', 'app', 'erp'))
      expect(erpAppFiles.length).toBeGreaterThanOrEqual(35)

      const keyStudioRelPaths = [
        'src/components/ui/details-popover.tsx',
        'src/components/ui/compact-info-tooltip.tsx',
        'src/components/ui/kpi-card.tsx',
        'src/components/ui/stat-card.tsx',
        'src/components/erp/KpiProvenanceBadge.tsx',
        'src/components/erp/shell.tsx',
        'src/components/erp-sidebar.tsx',
        'src/components/aether/TopFilterBar.tsx',
        'src/components/aether/FullJourney360.tsx',
        'src/components/aether/CoresHubStudio.tsx',
        'src/components/erp/SalesScorecardStudio.tsx',
        'src/components/erp/feryal-governance-studio.tsx',
        'src/components/aether/DecisionRoomStudio.tsx',
        'src/components/aether/BeforeAfterStudio.tsx',
        'src/components/erp/ops-expansion/WeekdayComparisonStudio.tsx',
        'src/components/erp/ExecutiveComparisonControlBar.tsx',
        'src/components/erp/SeasonsStudio.tsx',
        'src/components/erp/StrategicPlanningStudio.tsx',
        'src/components/aether/BoothStudyV5.tsx',
        'src/components/aether/AlertsCenterV2.tsx',
        'src/components/erp/WarehouseDailyChainStudio.tsx',
        'src/components/aether/DeliveryRadarV5.tsx',
        'src/components/erp/FinanceDashboard.tsx',
        'src/components/erp/ReceivablesAgingStudio.tsx',
        'src/components/erp/ExecutivePnlStudio.tsx',
        'src/components/aether/CostIntelligenceV2.tsx',
      ]

      const allTargetPaths = [
        ...erpAppFiles,
        ...keyStudioRelPaths.map((rel) => path.join(root, rel)),
      ]

      const sub12Re = /text-\[(?:[0-9]|10|10\.5|11|11\.5)px\]/
      const consoleRe = /\bconsole\.(?:log|warn|error|info|debug)\b/
      const anyTypeRe = /(?:\bas\s+any\b|:\s*any\b|<any>)/
      const tsIgnoreRe = /@ts-(?:ignore|expect-error)/
      const forbiddenIdentifierRe =
        /\b(?:mock[A-Za-z0-9_]*|MOCK_[A-Z0-9_]+|seed[A-Za-z0-9_]*|SEED_[A-Z0-9_]+)\b/

      const violations: string[] = []
      for (const fullPath of allTargetPaths) {
        const buf = await readFile(fullPath)
        const rel = path.relative(root, fullPath).split(path.sep).join('/')
        if (buf.includes(0)) {
          violations.push(`${rel}: contains null byte`)
          continue
        }
        const raw = buf.toString('utf8')
        const noComments = stripComments(raw)
        const identifiersOnly = stripStringLiterals(noComments)

        if (sub12Re.test(raw)) violations.push(`${rel}: contains sub-12px font class`)
        if (!rel.endsWith('/error.tsx') && consoleRe.test(noComments)) {
          violations.push(`${rel}: contains console.*`)
        }
        if (anyTypeRe.test(noComments)) violations.push(`${rel}: contains explicit any`)
        if (tsIgnoreRe.test(raw)) violations.push(`${rel}: contains @ts-ignore`)
        if (forbiddenIdentifierRe.test(identifiersOnly)) {
          violations.push(`${rel}: contains forbidden placeholder identifier`)
        }
      }

      expect(violations).toEqual([])

      for (const studioRel of [
        'src/components/aether/FullJourney360.tsx',
        'src/components/aether/CoresHubStudio.tsx',
        'src/components/erp/SalesScorecardStudio.tsx',
        'src/components/aether/DecisionRoomStudio.tsx',
        'src/components/aether/BeforeAfterStudio.tsx',
        'src/components/erp/ExecutiveComparisonControlBar.tsx',
        'src/components/erp/WarehouseDailyChainStudio.tsx',
        'src/components/aether/DeliveryRadarV5.tsx',
        'src/components/erp/FinanceDashboard.tsx',
        'src/components/erp/ReceivablesAgingStudio.tsx',
        'src/components/erp/ExecutivePnlStudio.tsx',
        'src/components/aether/CostIntelligenceV2.tsx',
      ]) {
        const src = await readFile(path.join(root, studioRel), 'utf8')
        expect(src, `${studioRel} must preserve overflow-visible surfaces`).toContain(
          'overflow-visible',
        )
      }
    })
  })
})
