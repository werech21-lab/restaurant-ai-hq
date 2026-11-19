import { readFile } from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mockGlobalFilterState = {
  current: null as ReturnType<
    typeof import('@/components/aether/GlobalFilterContext').useGlobalFilter
  > | null,
}

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp/executive-pnl',
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
      if (!mockGlobalFilterState.current) {
        throw new Error('mockGlobalFilterState.current was not initialized')
      }
      return mockGlobalFilterState.current
    },
  }
})

import { ConnectPanel } from '@/app/(panel)/settings/aetherbi-connect/connect-panel'
import { DomainPanel } from '@/app/(panel)/settings/aetherbi/domain-panel'
import { OdooDataCenterClient } from '@/app/(panel)/settings/odoo-data-center/odoo-data-center-client'
import { OdooSyncPanel } from '@/app/(panel)/settings/odoo-sync/odoo-sync-panel'
import { OdooAccountingAnalyticsHub } from '@/components/accounting/OdooAccountingAnalyticsHub'
import { VentureAccountingHub } from '@/components/accounting/VentureAccountingHub'
import { AdminPosTerminalMappingPanel } from '@/components/erp/AdminPosTerminalMappingPanel'
import { ExecutivePnlStudio } from '@/components/erp/ExecutivePnlStudio'
import { ReceivablesAgingStudio } from '@/components/erp/ReceivablesAgingStudio'
import { SalesScorecardStudio } from '@/components/erp/SalesScorecardStudio'
import { DepartmentalReportsHub } from '@/components/reports/DepartmentalReportsHub'
import {
  DEFAULT_GLOBAL_FILTERS,
  computeGlobalWorkspace,
  type GlobalFilters,
  type GlobalWorkspaceSlice,
} from '@/lib/aether/global-filter-engine'
import { permissions } from '@/lib/auth/permissions'
import { LanguageProvider } from '@/lib/i18n'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { JournalEntryDialog } from '@/modules/finance/ui/JournalEntryDialog'
import { TrialBalancePanel } from '@/modules/finance/ui/TrialBalancePanel'
import OdooSync from '@/modules/odoo/ui/OdooSync'

type GlobalFilterContextVal = ReturnType<
  typeof import('@/components/aether/GlobalFilterContext').useGlobalFilter
>

const TypedLangProvider = LanguageProvider as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

function buildLiveSummary(overrides: Partial<OdooLiveSummary> = {}): OdooLiveSummary {
  const makeBucket = (
    key: 'today' | 'week' | 'month' | 'year',
  ): NonNullable<NonNullable<OdooLiveSummary['buckets']>['month']> => ({
    key,
    from: '2026-10-17',
    to: '2026-11-15',
    days: 30,
    totals: {
      netSalesKwd: 12500.5,
      orders: 1000,
      aovKwd: 12.501,
      restaurantNetKwd: 12500.5,
      restaurantOrders: 1000,
    },
    uiChannels: {
      'dine-in': { netKwd: 5000.25, orders: 400 },
      'talabat-tgo': { netKwd: 7500.25, orders: 600 },
    },
    byBrand: {
      'china-garden': { netKwd: 6000.25, orders: 480 },
      franks: { netKwd: 6500.25, orders: 520 },
    },
    byLocation: {
      promenade: {
        netKwd: 7000.25,
        orders: 550,
        uiChannels: {
          'dine-in': { netKwd: 3000.125, orders: 220 },
          'talabat-tgo': { netKwd: 4000.125, orders: 330 },
        },
      },
      salmiya: {
        netKwd: 5500.25,
        orders: 450,
        uiChannels: {
          'dine-in': { netKwd: 2000.125, orders: 180 },
          'talabat-tgo': { netKwd: 3500.125, orders: 270 },
        },
      },
    },
    accounting: {
      available: true,
      from: '2026-10-17',
      to: '2026-11-15',
      income: 12500.5,
      otherIncome: 0,
      totalRevenue: 12500.5,
      cogs: 3750.15,
      deliveryCommissions: 1125.05,
      expense: 2000.1,
      depreciation: 400.1,
      otherOpexAndDepreciation: 2400.2,
      operatingProfit: 5225.1,
      lineCount: 420,
      glIncomplete: false,
      aggregatorCommissionUnposted: false,
      revenueAccounts: [
        { code: '4000', name: 'POS Food Sales', amountKwd: 12500.5, accountType: 'income' },
      ],
    },
  })

  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    partial: false,
    unavailableSections: [],
    warningAr: undefined,
    warningEn: undefined,
    lastSyncAt: '2026-11-15T12:00:00.000Z',
    kuwaitSyncedAt: '2026-11-15 15:00',
    isStale24h: false,
    odooCompanyId: 1,
    dateRange: { from: '2026-10-17', to: '2026-11-15' },
    period: { from: '2026-10-17', to: '2026-11-15' },
    database: null,
    syncedAt: '2026-11-15T12:00:00.000Z',
    totals: { netSalesKwd: 12500.5, orders: 1000, aovKwd: 12.5 },
    brands: [
      { id: 'china-garden', brand: 'China Garden', netKwd: 6000.25, sharePct: 48.0 },
      { id: 'franks', brand: 'Franks', netKwd: 6500.25, sharePct: 52.0 },
    ],
    branches: [
      {
        id: 'promenade',
        name: 'Promenade',
        unit: 'PRM',
        netSalesKwd: 7000.25,
        orders: 550,
        sharePct: 56.0,
      },
      {
        id: 'salmiya',
        name: 'Salmiya',
        unit: 'SLM',
        netSalesKwd: 5500.25,
        orders: 450,
        sharePct: 44.0,
      },
    ],
    channels: [
      { name: 'dine-in', amountKwd: 5000.25 },
      { name: 'talabat', amountKwd: 7500.25 },
    ],
    buckets: {
      today: makeBucket('today'),
      week: makeBucket('week'),
      month: makeBucket('month'),
      year: makeBucket('year'),
    },
    aggregatorReceivables: {
      readable: true,
      openReceivableKwd: 4500.125,
      grossPositiveReceivableKwd: 5100.375,
      creditClearingOffsetKwd: 600.25,
      openLinesCount: 48,
      posClearingLinesCount: 12,
      platformAndCorporateLinesCount: 36,
      fromDate: '2026-10-17',
      toDate: '2026-11-15',
      latestMaturityDate: '2026-11-20',
      maturityStatusAr: 'محدث',
      maturityStatusEn: 'Current',
      openLinesExplanationAr: 'تفصيل الذمم غير المسوّاة',
      openLinesExplanationEn: 'Unreconciled receivables breakdown',
      agingBuckets: [
        {
          key: '0_30',
          labelAr: '0–30 يوماً',
          labelEn: '0–30 Days',
          linesCount: 48,
          residualKwd: 4500.125,
          positiveDebitKwd: 5100.375,
          creditOffsetKwd: -600.25,
        },
      ],
      byAccount: [
        {
          accountId: 105,
          accountCode: '10501',
          accountName: '10501 Talabat Receivable',
          labelAr: 'طلبات',
          labelEn: 'Talabat Receivable',
          linesCount: 36,
          residualKwd: 4500.125,
        },
      ],
    },
    ...overrides,
  }
}

function buildContext(
  summary: OdooLiveSummary | null,
  overrides: Partial<GlobalFilterContextVal> = {},
  workspaceOverrides?: (ws: GlobalWorkspaceSlice) => GlobalWorkspaceSlice,
): GlobalFilterContextVal {
  const filters: Required<GlobalFilters> = { ...DEFAULT_GLOBAL_FILTERS, period: 'month' }
  const baseWorkspace = computeGlobalWorkspace(filters, summary, '/erp/executive-pnl')
  const workspace = workspaceOverrides ? workspaceOverrides(baseWorkspace) : baseWorkspace
  return {
    filters,
    workspace,
    liveSummary: summary,
    isAuditor: false,
    sessionRole: 'admin',
    syncingOdoo: false,
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
    ...overrides,
  }
}

describe('Tier 1 Finance, Scorecard, Reports & Settings Audits', () => {
  afterEach(() => {
    mockGlobalFilterState.current = null
  })

  it('formats ExecutivePnlStudio KWD strictly to 3 decimals and renders null -> "—" / "غير متاح" + partial banner', () => {
    const summary = buildLiveSummary({
      partial: true,
      warningAr: 'بعض أرقام القنوات غير متاحة الآن',
      warningEn: 'Some channel figures are temporarily unavailable',
    })
    mockGlobalFilterState.current = buildContext(summary)

    const liveEn = renderToStaticMarkup(
      React.createElement(TypedLangProvider, { initialLocale: 'en' }, React.createElement(ExecutivePnlStudio)),
    )
    expect(liveEn).toContain('data-odoo-partial-warning="true"')
    expect(liveEn).toContain('Some channel figures are temporarily unavailable')
    expect(liveEn).toContain('12,500.500 KWD')
    expect(liveEn).toContain('6,000.250 KWD') // brand contribution at fils precision (6000.25)
    expect(liveEn).toContain('7,000.250 KWD') // branch contribution at fils precision (7000.25)

    // Null / unavailable state
    mockGlobalFilterState.current = buildContext(
      summary,
      {},
      (ws) => ({
        ...ws,
        nullableSalesKwd: null,
        nullableOrders: null,
        accounting: {
          ...ws.accounting,
          totalRevenueKwd: null,
          cogsKwd: null,
          cogsPct: null,
          operatingProfitKwd: null,
          netProfitPct: null,
        },
        cascadingOptions: {
          ...ws.cascadingOptions,
          brands: ws.cascadingOptions.brands.map((b) =>
            b.id === 'all' ? b : { ...b, salesKwd: undefined },
          ),
        },
      }),
    )

    const nullAr = renderToStaticMarkup(
      React.createElement(TypedLangProvider, { initialLocale: 'ar' }, React.createElement(ExecutivePnlStudio)),
    )
    expect(nullAr).toContain('—')
    expect(nullAr).toContain('غير متاح')
    expect(nullAr).not.toContain('0.000 د.ك')
    expect(nullAr).not.toContain('width:2%')
  })

  it('Phase 5 · Item 4: SalesScorecardStudio brand shares are over the brand sum and total exactly 100.0%', () => {
    const summary = buildLiveSummary()
    mockGlobalFilterState.current = buildContext(summary)
    const html = renderToStaticMarkup(
      React.createElement(TypedLangProvider, { initialLocale: 'en' }, React.createElement(SalesScorecardStudio)),
    )
    const brandCard = html.split('6 Brands Scorecard')[1]?.split('7 Active Branches Scorecard')[0] ?? ''
    const text = brandCard.replace(/<[^>]+>/g, ' ')
    const rowText = text.split('Σ')[0]
    const rowShares = [...rowText.matchAll(/(\d+(?:\.\d)?)%/g)].map((m) => Math.round(Number(m[1]) * 10))
    expect(rowShares.length).toBe(6)
    expect(rowShares.reduce((a, b) => a + b, 0)).toBe(1000)
    expect(text).toContain('6,500.250 KWD')
    expect(brandCard).toContain('data-brand-share-basis="true"')
    expect(text).toMatch(/Σ 100(\.0)?%/)
    // Amounts are the engine's fils-precision values, not whole-KWD rounding.
    const ctx = mockGlobalFilterState.current as { workspace: { cascadingOptions: { brands: { id: string; salesKwd?: number }[] } } }
    for (const b of ctx.workspace.cascadingOptions.brands.filter((x) => x.id !== 'all')) {
      expect(typeof b.salesKwd).toBe('number')
      expect(Math.round((b.salesKwd as number) * 1000) / 1000).toBe(b.salesKwd)
    }
  })

  it('formats SalesScorecardStudio KWD to 3 decimals (no integer rounding) and shows loading/null states honestly', () => {
    const summary = buildLiveSummary({
      partial: true,
      warningAr: 'تحذير بيانات جزئية',
      warningEn: 'Partial data warning',
    })
    mockGlobalFilterState.current = buildContext(summary)

    const liveEn = renderToStaticMarkup(
      React.createElement(TypedLangProvider, { initialLocale: 'en' }, React.createElement(SalesScorecardStudio)),
    )
    expect(liveEn).toContain('data-odoo-partial-warning="true"')
    expect(liveEn).toContain('12,500.500 KWD')
    expect(liveEn).toContain('6,500.250 KWD')
    expect(liveEn).toContain('6 Brands Scorecard')
    expect(liveEn).toContain('7 Active Branches Scorecard')
    expect(liveEn).toContain('8 Sales Channels Scorecard')

    // Loading skeleton when syncingOdoo && liveSummary === null
    mockGlobalFilterState.current = buildContext(null, { syncingOdoo: true })
    const loadingAr = renderToStaticMarkup(
      React.createElement(TypedLangProvider, { initialLocale: 'ar' }, React.createElement(SalesScorecardStudio)),
    )
    expect(loadingAr).toContain('data-state-block="loading"')
  })

  it('renders ReceivablesAgingStudio 3-decimal KWD, Asia/Kuwait sync timestamp, and unavailable StateBlock when unverified', () => {
    const summary = buildLiveSummary({
      kuwaitSyncedAt: undefined,
      latestOdooRecordAt: '2026-11-15T21:30:00.000Z', // 2026-11-16 00:30 Asia/Kuwait!
    })
    mockGlobalFilterState.current = buildContext(summary)

    const liveEn = renderToStaticMarkup(
      React.createElement(TypedLangProvider, { initialLocale: 'en' }, React.createElement(ReceivablesAgingStudio)),
    )
    expect(liveEn).toContain('4,500.125 KWD')
    expect(liveEn).toContain('2026-11-16 00:30')
    expect(liveEn).not.toMatch(/overdue/i)

    // Unavailable receivables state
    mockGlobalFilterState.current = buildContext(
      buildLiveSummary({
        partial: true,
        unavailableSections: ['receivables'],
        aggregatorReceivables: null,
      }),
    )
    const unavailAr = renderToStaticMarkup(
      React.createElement(TypedLangProvider, { initialLocale: 'ar' }, React.createElement(ReceivablesAgingStudio)),
    )
    expect(unavailAr).toContain('data-odoo-partial-warning="true"')
    expect(unavailAr).toContain('data-state-block="unavailable"')
    expect(unavailAr).toContain('غير متاح')
    expect(unavailAr).not.toContain('0.000 د.ك')
  })

  it('renders OdooAccountingAnalyticsHub and VentureAccountingHub with clean English parity (no leaked Arabic) and null honesty', () => {
    const disconnected = buildLiveSummary({ connected: false, noData: true })
    mockGlobalFilterState.current = buildContext(disconnected)

    const emptyEn = renderToStaticMarkup(
      React.createElement(
        TypedLangProvider,
        { initialLocale: 'en' },
        React.createElement(OdooAccountingAnalyticsHub, { isAr: false, locale: 'en' }),
      ),
    )
    expect(emptyEn).toContain('No Odoo GL data for this period')
    expect(emptyEn).not.toContain('لا توجد بيانات من Odoo لهذه الفترة')

    const partialGl = buildLiveSummary({
      partial: true,
      buckets: {
        month: {
          ...buildLiveSummary().buckets!.month!,
          accounting: {
            ...buildLiveSummary().buckets!.month!.accounting!,
            glIncomplete: true,
            aggregatorCommissionUnposted: true,
          },
        },
      },
    })
    mockGlobalFilterState.current = buildContext(partialGl)

    const glUnavailableEn = renderToStaticMarkup(
      React.createElement(
        TypedLangProvider,
        { initialLocale: 'en' },
        React.createElement(OdooAccountingAnalyticsHub, { isAr: false, locale: 'en' }),
      ),
    )
    expect(glUnavailableEn).toContain('Incomplete GL entries for this period')
    expect(glUnavailableEn).toContain('Posted GL Revenue')
    expect(glUnavailableEn).not.toContain('No Odoo GL data for this period')
    expect(glUnavailableEn).not.toContain('لا توجد بيانات من Odoo لهذه الفترة')
    expect(glUnavailableEn).not.toContain('قيود غير مكتملة لهذه الفترة')

    // With available GL + unposted aggregator commission flag + incomplete GL warning banner
    mockGlobalFilterState.current = buildContext(buildLiveSummary({ partial: true }), {}, (ws) => ({
      ...ws,
      glIncomplete: true,
      aggregatorCommissionUnposted: true,
      accounting: {
        ...ws.accounting,
        available: true,
        glIncomplete: true,
        aggregatorCommissionUnposted: true,
      },
    }))
    const glEn = renderToStaticMarkup(
      React.createElement(
        TypedLangProvider,
        { initialLocale: 'en' },
        React.createElement(OdooAccountingAnalyticsHub, { isAr: false, locale: 'en' }),
      ),
    )
    expect(glEn).toContain('Incomplete GL entries for this period')
    expect(glEn).toContain('Unposted')
    expect(glEn).not.toContain('قيود غير مكتملة لهذه الفترة')
    expect(glEn).not.toContain('غير مُرحَّل بعد')

    // VentureAccountingHub partial banner when not embeddedInErp
    const ventureEn = renderToStaticMarkup(
      React.createElement(
        TypedLangProvider,
        { initialLocale: 'en' },
        React.createElement(VentureAccountingHub, { locale: 'en', embeddedInErp: false }),
      ),
    )
    expect(ventureEn).toContain('data-odoo-partial-warning="true"')
  })

  it('renders TrialBalancePanel and JournalEntryDialog loading skeletons in SSR without errors', () => {
    const tbHtml = renderToStaticMarkup(
      React.createElement(
        TypedLangProvider,
        { initialLocale: 'ar' },
        React.createElement(TrialBalancePanel, { reloadToken: 0 }),
      ),
    )
    expect(tbHtml).toContain('data-state-block="loading"')

    const jeHtml = renderToStaticMarkup(
      React.createElement(
        TypedLangProvider,
        { initialLocale: 'en' },
        React.createElement(JournalEntryDialog, {
          entryId: 'je-1',
          onChanged: () => {},
          onClose: () => {},
          onOpenEntry: () => {},
        }),
      ),
    )
    expect(jeHtml).toContain('data-state-block="loading"')
  })

  it('renders DepartmentalReportsHub with partial warning banner, bilingual EN copy, and zero sub-12px classes', () => {
    const summary = buildLiveSummary({ partial: true, unavailableSections: ['receivables'] })
    mockGlobalFilterState.current = buildContext(summary)

    const hubEn = renderToStaticMarkup(
      React.createElement(
        TypedLangProvider,
        { initialLocale: 'en' },
        React.createElement(DepartmentalReportsHub, { locale: 'en' }),
      ),
    )
    expect(hubEn).toContain('data-odoo-partial-warning="true"')
    expect(hubEn).toContain('pos.order')
    expect(hubEn).not.toContain('Not linked')
    expect(hubEn).not.toContain('غير مربوط بمصدر')
    expect(hubEn).not.toContain('text-[11px]')

    // Disconnected English state must not leak Arabic heading
    mockGlobalFilterState.current = buildContext(buildLiveSummary({ connected: false, noData: true }))
    const emptyHubEn = renderToStaticMarkup(
      React.createElement(
        TypedLangProvider,
        { initialLocale: 'en' },
        React.createElement(DepartmentalReportsHub, { locale: 'en' }),
      ),
    )
    expect(emptyHubEn).toContain('No Odoo data for this period')
    expect(emptyHubEn).not.toContain('لا توجد بيانات من Odoo لهذه الفترة')
  })

  it('enforces AdminPosTerminalMappingPanel role gating and preserves unmapped Arabic copy', () => {
    mockGlobalFilterState.current = buildContext(buildLiveSummary(), {
      sessionRole: 'cfo',
      isAuditor: false,
    })

    for (const role of ['cfo', 'gm', 'dgm', 'ops', 'marketing', 'supply', 'auditor'] as const) {
      const deniedHtml = renderToStaticMarkup(
        React.createElement(
          TypedLangProvider,
          { initialLocale: 'ar' },
          React.createElement(AdminPosTerminalMappingPanel, { role }),
        ),
      )
      expect(deniedHtml).toBe('')
    }

    mockGlobalFilterState.current = buildContext(buildLiveSummary(), {
      sessionRole: 'admin',
      isAuditor: false,
    })
    const adminHtml = renderToStaticMarkup(
      React.createElement(
        TypedLangProvider,
        { initialLocale: 'ar' },
        React.createElement(AdminPosTerminalMappingPanel, { role: 'admin' }),
      ),
    )
    expect(adminHtml).toContain('data-admin-pos-mapping-panel="true"')
    expect(adminHtml).toContain('غير مصنّف — أجهزة غير مربوطة')
  })

  it('keeps OdooSync, OdooSyncPanel, OdooDataCenterClient, DomainPanel & ConnectPanel free of secret/path leaks and formats Kuwait timestamps', () => {
    const syncPanelHtml = renderToStaticMarkup(
      React.createElement(
        TypedLangProvider,
        { initialLocale: 'ar' },
        React.createElement(OdooSyncPanel, {
          initialDump: {
            path: 'backups/odoo-full-dump/secret-internal-path.json',
            exists: true,
            bytes: 2048,
            counts: { 'pos.order': 1250 },
            exportedAt: '2026-11-15T21:30:00.000Z',
          },
        }),
      ),
    )
    expect(syncPanelHtml).toContain('2026-11-16 00:30')
    expect(syncPanelHtml).toContain('1,250')
    expect(syncPanelHtml).not.toContain('backups/odoo-full-dump')
    expect(syncPanelHtml).not.toContain('ODOO_API_KEY')
    expect(syncPanelHtml).not.toContain('text-[11px]')

    const odooSyncHtml = renderToStaticMarkup(
      React.createElement(
        TypedLangProvider,
        { initialLocale: 'ar' },
        React.createElement(OdooSync, { permissions: [permissions.adminOdooSync] }),
      ),
    )
    expect(odooSyncHtml).toContain('type="password"')
    expect(odooSyncHtml).toContain('data-state-block="loading"')

    const dcHtml = renderToStaticMarkup(
      React.createElement(
        TypedLangProvider,
        { initialLocale: 'en' },
        React.createElement(OdooDataCenterClient),
      ),
    )
    expect(dcHtml).toContain('data-state-block="loading"')

    const domainHtml = renderToStaticMarkup(
      React.createElement(
        TypedLangProvider,
        { initialLocale: 'en' },
        React.createElement(DomainPanel),
      ),
    )
    expect(domainHtml).toContain('DNS Records for aetherbi.com')

    const connectNullHtml = renderToStaticMarkup(
      React.createElement(
        TypedLangProvider,
        { initialLocale: 'ar' },
        React.createElement(ConnectPanel, {
          visits: null,
          leads: null,
          domainMessage: 'متصل',
        }),
      ),
    )
    expect(connectNullHtml).toContain('—')
    expect(connectNullHtml).toContain('title="غير متاح"')
  })

  it('passes static guardrails (zero sub-12px fonts, zero console.*, zero explicit any, zero ODOO_* env leaks) across all owned files', async () => {
    const ownedFiles = [
      'src/app/erp/executive-pnl/page.tsx',
      'src/components/erp/ExecutivePnlStudio.tsx',
      'src/app/erp/sales-scorecard/page.tsx',
      'src/components/erp/SalesScorecardStudio.tsx',
      'src/app/erp/finance/page.tsx',
      'src/app/erp/ledger/page.tsx',
      'src/app/erp/receivables/page.tsx',
      'src/components/erp/ReceivablesAgingStudio.tsx',
      'src/components/accounting/OdooAccountingAnalyticsHub.tsx',
      'src/components/accounting/VentureAccountingHub.tsx',
      'src/modules/finance/ui/AccountDialog.tsx',
      'src/modules/finance/ui/journal-draft.ts',
      'src/modules/finance/ui/JournalEntryDialog.tsx',
      'src/modules/finance/ui/JournalLineEditor.tsx',
      'src/modules/finance/ui/LedgerWorkspace.tsx',
      'src/modules/finance/ui/PeriodDialog.tsx',
      'src/modules/finance/ui/shared.tsx',
      'src/modules/finance/ui/TrialBalancePanel.tsx',
      'src/modules/finance/ui/useAccounts.ts',
      'src/app/(panel)/bi-analytics/page.tsx',
      'src/app/(panel)/bi-analytics/radar-button.tsx',
      'src/app/(panel)/reports/page.tsx',
      'src/components/reports/DepartmentalReportsHub.tsx',
      'src/app/erp/odoo-sync/page.tsx',
      'src/app/(panel)/settings/odoo-sync/odoo-sync-panel.tsx',
      'src/app/(panel)/settings/odoo-sync/page.tsx',
      'src/app/(panel)/settings/odoo-data-center/odoo-data-center-client.tsx',
      'src/app/(panel)/settings/odoo-data-center/page.tsx',
      'src/app/(panel)/settings/aetherbi/domain-panel.tsx',
      'src/app/(panel)/settings/aetherbi/page.tsx',
      'src/app/(panel)/settings/aetherbi-connect/connect-panel.tsx',
      'src/app/(panel)/settings/aetherbi-connect/page.tsx',
      'src/modules/odoo/ui/OdooSync.tsx',
      'src/components/erp/AdminPosTerminalMappingPanel.tsx',
    ]

    for (const rel of ownedFiles) {
      const full = path.join(process.cwd(), rel)
      const content = await readFile(full, 'utf8')
      expect(content, `${rel} sub-12px`).not.toMatch(/text-\[(?:10|10\.5|11|11\.5)px\]/)
      expect(content, `${rel} console.*`).not.toMatch(/\bconsole\.(log|debug|info|warn|error)\b/)
      expect(content, `${rel} explicit any`).not.toMatch(/:\s*any\b|\bas any\b|<any>/)
      expect(content, `${rel} ts-ignore`).not.toMatch(/@ts-(ignore|nocheck)/)
      expect(content, `${rel} ODOO_ env secret leak`).not.toMatch(
        /\b(ODOO_URL|ODOO_DB|ODOO_USERNAME|ODOO_API_KEY)\b/,
      )
    }
  })
})
