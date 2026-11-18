import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'

const mockNavState = {
  pathname: '/erp/executive-pnl',
}

const mockGlobalFilterState = {
  current: null as ReturnType<
    typeof import('@/components/aether/GlobalFilterContext').useGlobalFilter
  > | null,
}

const mockReceivablesOverride = {
  verified: null as boolean | null,
}

vi.mock('next/navigation', () => ({
  usePathname: () => mockNavState.pathname,
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

vi.mock('@/lib/auth/context', () => ({
  requirePageUser: vi.fn(),
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

vi.mock('@/lib/aether/receivables-status', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/aether/receivables-status')>()
  return {
    ...actual,
    canShowReceivableAmounts: (
      receivables: Parameters<typeof actual.canShowReceivableAmounts>[0],
      verified?: boolean,
    ) =>
      actual.canShowReceivableAmounts(
        receivables,
        mockReceivablesOverride.verified !== null ? mockReceivablesOverride.verified : verified,
      ),
  }
})

import { metadata as executivePnlMetadata } from '@/app/erp/executive-pnl/page'
import { BiFilterProvider } from '@/components/aether/BiFilterContext'
import { OdooAccountingAnalyticsHub } from '@/components/accounting/OdooAccountingAnalyticsHub'
import { VentureAccountingHub } from '@/components/accounting/VentureAccountingHub'
import { ExecutivePnlStudio } from '@/components/erp/ExecutivePnlStudio'
import { GovernanceProvider } from '@/components/erp/GovernanceBellDrawer'
import { ReceivablesAgingStudio } from '@/components/erp/ReceivablesAgingStudio'
import { SIDEBAR_ITEMS, Sidebar as ErpSidebar } from '@/components/erp-sidebar'
import {
  PROFIT_AFTER_CLOSE_NOTE,
  lastClosedMonthDateRange,
} from '@/lib/aether/closed-month-policy'
import {
  DEFAULT_GLOBAL_FILTERS,
  applyReceivablesExecutivePolicy,
  computeGlobalWorkspace,
  type GlobalFilters,
  type GlobalWorkspaceSlice,
  type WorkspaceReceivablesMeta,
} from '@/lib/aether/global-filter-engine'
import {
  PER_CUSTOMER_DUE_DATE_AGING_VERIFIED,
  RECEIVABLES_PENDING_STATUS,
} from '@/lib/aether/receivables-status'
import { routeTitle } from '@/lib/aether/route-titles'
import { LanguageProvider } from '@/lib/i18n'
import {
  buildLedgerAccountingFromGroups,
  bustOdooLiveCache,
  fetchLiveOdooSnapshot,
} from '@/lib/odoo-live-connector'
import { companyPosConfigAllowed } from '@/lib/odoo/company-pos'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import {
  buildGlBalanceSheetFromGroups,
  buildGlTrialBalanceFromGroups,
  buildPartnerAgingRows,
  fetchGlAnalyticBreakdown,
  fetchGlBalanceSheet,
  fetchGlTrialBalance,
  probeCrossoveredBudget,
  type GlAccountMeta,
  type GlMoveLineGroupRow,
  type GlOdooReadContext,
  type OdooExecuteFn,
  type PartnerAgingGroupRow,
} from '@/lib/odoo/gl-statements'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import {
  PLATFORM_EXPENSE_CLASSES,
  PLATFORM_TOKEN_RE,
  classifyPlatformExpenseAccount,
  legacyIsDeliveryCommissionGlAccount,
  type PlatformExpenseClass,
} from '@/lib/odoo/platform-expense-accounts'
import posRegistry from '@/lib/odoo/pos-registry.json'
import { summarizeArAging } from '@/lib/odoo/receivable-aging'
import type { AccessUser } from '@/lib/permissions'
import { ThemeProvider } from '@/lib/theme'
import {
  compareArBucketTotals,
  parseAgedReceivableReportCsv,
  parseAgedReceivableReportXlsx,
  type ArBucketTotals,
} from '../../../scripts/verify-ar-aging'

type GlobalFilterContextVal = ReturnType<
  typeof import('@/components/aether/GlobalFilterContext').useGlobalFilter
>

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

interface DumpAccountRecord {
  id: number
  code: string
  name: string
  account_type: string
}

const ROOT_DIR = process.cwd()
const DUMP_PATH = path.join(ROOT_DIR, 'backups/odoo-full-dump/venturefoods_odoo_cids1_dump.json')
const DUMP_DATA = JSON.parse(fs.readFileSync(DUMP_PATH, 'utf8')) as {
  models: { 'account.account': DumpAccountRecord[] }
}
const DUMP_ACCOUNTS: readonly DumpAccountRecord[] = DUMP_DATA.models['account.account']
const DUMP_ACCOUNT_BY_CODE = new Map(DUMP_ACCOUNTS.map((a) => [a.code, a]))

const r3 = (n: number): number => Math.round(n * 1000) / 1000

function mustDumpAccount(code: string): GlAccountMeta {
  const acc = DUMP_ACCOUNT_BY_CODE.get(code)
  if (!acc) throw new Error(`Expected real dump account ${code} in ${DUMP_PATH}`)
  return { id: acc.id, code: acc.code, name: acc.name, account_type: acc.account_type }
}

function formatExpectedKwd(n: number): string {
  return `${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
}

const FIXTURE_NOW_MS = Date.parse('2026-11-15T12:00:00.000Z')
const ODOO_ENV_KEYS = [
  'ODOO_URL',
  'ODOO_DB',
  'ODOO_USERNAME',
  'ODOO_LOGIN',
  'ODOO_API_KEY',
] as const

const makeExecuteOdoo =
  (impl: (model: string, method: string, args?: unknown[]) => Promise<unknown>): OdooExecuteFn =>
  async <T = unknown>(model: string, method: string, args?: unknown[]) =>
    (await impl(model, method, args)) as T

const SAMPLE_ADMIN_USER: AccessUser = {
  id: 'u-admin-part2',
  name: 'Admin',
  email: 'admin@venturefoods.test',
  role: { id: 'r-admin', name: 'Admin', isAdmin: true, permissions: [] },
}

function buildMinimalLiveSummary(
  accounting: NonNullable<OdooLiveSummary['buckets']>['month'] extends infer B
    ? B extends { accounting?: infer A }
      ? NonNullable<A>
      : never
    : never,
  options?: {
    customBucketFrom?: string
    customBucketTo?: string
    posNetSalesKwd?: number
    receivables?: OdooLiveSummary['aggregatorReceivables']
  },
): OdooLiveSummary {
  const posSales = options?.posNetSalesKwd ?? r3(accounting.totalRevenue ?? accounting.income)
  const bucketFrom = accounting.from ?? '2026-10-17'
  const bucketTo = accounting.to ?? '2026-11-15'
  const monthBucket = {
    key: 'month' as const,
    from: bucketFrom,
    to: bucketTo,
    days: 30,
    totals: {
      netSalesKwd: posSales,
      orders: 10,
      aovKwd: r3(posSales / 10),
      restaurantNetKwd: posSales,
      restaurantOrders: 10,
    },
    uiChannels: { 'dine-in': { netKwd: posSales, orders: 10 } },
    byBrand: { 'china-garden': { netKwd: posSales, orders: 10 } },
    byLocation: { promenade: { netKwd: posSales, orders: 10 } },
    accounting,
  }
  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    partial: false,
    unavailableSections: [],
    syncedAt: '2026-11-15T12:00:00.000Z',
    lastSyncAt: '2026-11-15T12:00:00.000Z',
    kuwaitSyncedAt: '2026-11-15 15:00',
    isStale24h: false,
    odooCompanyId: 1,
    dateRange: { from: bucketFrom, to: bucketTo },
    period: { from: bucketFrom, to: bucketTo },
    database: null,
    totals: { netSalesKwd: posSales, orders: 10, aovKwd: r3(posSales / 10) },
    brands: [{ id: 'china-garden', brand: 'China Garden', netKwd: posSales, sharePct: 100 }],
    branches: [
      { id: 'promenade', name: 'Promenade', unit: 'PRM', netSalesKwd: posSales, orders: 10, sharePct: 100 },
    ],
    channels: [{ name: 'dine-in', amountKwd: posSales }],
    buckets: {
      today: { ...monthBucket, key: 'today', days: 1 },
      week: { ...monthBucket, key: 'week', days: 7 },
      month: monthBucket,
      year: { ...monthBucket, key: 'year', days: 319 },
    },
    ...(options?.customBucketFrom && options?.customBucketTo
      ? {
          customBucket: {
            ...monthBucket,
            key: 'custom' as const,
            from: options.customBucketFrom,
            to: options.customBucketTo,
          },
        }
      : {}),
    ...(options?.receivables !== undefined ? { aggregatorReceivables: options.receivables } : {}),
  }
}

function buildContext(
  summary: OdooLiveSummary | null,
  filtersOverride: Partial<GlobalFilters> = {},
  ctxOverrides: Partial<GlobalFilterContextVal> = {},
  workspaceTransform?: (ws: GlobalWorkspaceSlice) => GlobalWorkspaceSlice,
): GlobalFilterContextVal {
  const filters: Required<GlobalFilters> = {
    ...DEFAULT_GLOBAL_FILTERS,
    period: 'month',
    ...filtersOverride,
  }
  const baseWs = computeGlobalWorkspace(filters, summary, mockNavState.pathname)
  const workspace = workspaceTransform ? workspaceTransform(baseWs) : baseWs
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
    ...ctxOverrides,
  }
}

function renderWithLang(locale: 'ar' | 'en', node: React.ReactElement): string {
  return renderToStaticMarkup(React.createElement(TypedLangProvider, { initialLocale: locale }, node))
}

function rpcJson(id: number, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('Part 2 — Accounting Pages from Real Odoo GL, AR/AP Aging, Budget Probe & Commission Rules', () => {
  const savedEnv: Partial<Record<(typeof ODOO_ENV_KEYS)[number], string | undefined>> = {}

  beforeEach(() => {
    for (const k of ODOO_ENV_KEYS) savedEnv[k] = process.env[k]
    mockNavState.pathname = '/erp/executive-pnl'
    mockReceivablesOverride.verified = null
    mockGlobalFilterState.current = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    for (const k of ODOO_ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k]
      else process.env[k] = savedEnv[k]
    }
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
    mockReceivablesOverride.verified = null
    mockGlobalFilterState.current = null
  })

  describe('§F(a) Per-line P&L states in ExecutivePnlStudio & OdooAccountingAnalyticsHub', () => {
    it('renders GL revenue, COGS & opex when commission & depreciation are 0, shows unposted notice per line, omits fake ranges, and renders expandable real account rows', async () => {
      // Real account metadata shapes from venturefoods_odoo_cids1_dump.json
      const foodRev = mustDumpAccount('50001')
      const otherRev = mustDumpAccount('52001')
      const cogsAcc = mustDumpAccount('40001')
      const opexAcc = mustDumpAccount('40081')
      const cashAcc = mustDumpAccount('10001')

      // Synthetic balanced GL movement rows (debits == credits across all P&L + cash offset)
      const revFoodCredit = 100.25
      const revOtherCredit = 19.75
      const cogsDebit = 32.5
      const opexDebit = 14.125
      const cashNetDebit = r3(revFoodCredit + revOtherCredit - cogsDebit - opexDebit)

      const accountById = new Map<number, GlAccountMeta>([
        [foodRev.id, foodRev],
        [otherRev.id, otherRev],
        [cogsAcc.id, cogsAcc],
        [opexAcc.id, opexAcc],
        [cashAcc.id, cashAcc],
      ])
      const rows: GlMoveLineGroupRow[] = [
        { account_id: [foodRev.id, `${foodRev.code} ${foodRev.name}`], debit: 0, credit: revFoodCredit, balance: -revFoodCredit, __count: 3 },
        { account_id: [otherRev.id, `${otherRev.code} ${otherRev.name}`], debit: 0, credit: revOtherCredit, balance: -revOtherCredit, __count: 1 },
        { account_id: [cogsAcc.id, `${cogsAcc.code} ${cogsAcc.name}`], debit: cogsDebit, credit: 0, balance: cogsDebit, __count: 2 },
        { account_id: [opexAcc.id, `${opexAcc.code} ${opexAcc.name}`], debit: opexDebit, credit: 0, balance: opexDebit, __count: 1 },
        { account_id: [cashAcc.id, `${cashAcc.code} ${cashAcc.name}`], debit: r3(revFoodCredit + revOtherCredit), credit: r3(cogsDebit + opexDebit), balance: cashNetDebit, __count: 7 },
      ]

      const expectedRevenue = r3(revFoodCredit + revOtherCredit)
      const expectedCogs = r3(cogsDebit)
      const expectedOpex = r3(opexDebit)
      const expectedGrossProfit = r3(expectedRevenue - expectedCogs)

      const builtGl = buildLedgerAccountingFromGroups({
        fromIso: '2026-11-01',
        toInclusiveIso: '2026-11-15',
        accountById,
        rows,
      })

      expect(builtGl.available).toBe(true)
      expect(builtGl.glIncomplete).toBe(true)
      expect(builtGl.aggregatorCommissionUnposted).toBe(true)
      expect(builtGl.totalRevenue).toBe(expectedRevenue)
      expect(builtGl.cogs).toBe(expectedCogs)
      expect(builtGl.otherOpexKwd).toBe(expectedOpex)
      expect(builtGl.deliveryCommissions).toBe(0)
      expect(builtGl.depreciation).toBe(0)

      const grpByKey = new Map((builtGl.incomeStatementGroups ?? []).map((g) => [g.key, g]))
      expect(grpByKey.get('revenue')?.posted).toBe(true)
      expect(grpByKey.get('revenue')?.accounts.map((a) => a.code)).toContain('50001')
      expect(grpByKey.get('cogs')?.posted).toBe(true)
      expect(grpByKey.get('other_opex')?.posted).toBe(true)
      expect(grpByKey.get('platform_commission')?.posted).toBe(false)
      expect(grpByKey.get('depreciation')?.posted).toBe(false)

      const summary = buildMinimalLiveSummary({ ...builtGl, glClosedThroughDate: null })
      mockGlobalFilterState.current = buildContext(summary)

      // 1. ExecutivePnlStudio AR & EN
      const pnlAr = renderWithLang('ar', React.createElement(ExecutivePnlStudio))
      const pnlEn = renderWithLang('en', React.createElement(ExecutivePnlStudio))

      expect(pnlAr).toContain(formatExpectedKwd(expectedRevenue))
      expect(pnlAr).toContain(formatExpectedKwd(expectedCogs))
      expect(pnlAr).toContain(formatExpectedKwd(expectedGrossProfit))
      expect(pnlAr).toContain(formatExpectedKwd(expectedOpex))
      expect(pnlAr).toContain('لم يُرحَّل بعد في أودو لهذه الفترة')
      expect(pnlAr).toContain('<details')
      expect(pnlAr).toContain(foodRev.code)
      expect(pnlAr).toContain(cogsAcc.code)
      expect(pnlAr).toContain(opexAcc.code)

      expect(pnlEn).toContain(formatExpectedKwd(expectedRevenue))
      expect(pnlEn).toContain('Not yet posted in Odoo for this period')

      // Zero hardcoded fake GL code ranges in rendered HTML or source file
      const pnlSource = fs.readFileSync(
        path.join(ROOT_DIR, 'src/components/erp/ExecutivePnlStudio.tsx'),
        'utf8',
      )
      for (const fakeRange of ['4000–4999', '5000–5199', '6120', '6200–7999']) {
        expect(pnlAr).not.toContain(fakeRange)
        expect(pnlEn).not.toContain(fakeRange)
        expect(pnlSource).not.toContain(fakeRange)
      }

      // 2. OdooAccountingAnalyticsHub AR & EN: inline banner, NEVER whole-tab empty state
      const hubAr = renderWithLang(
        'ar',
        React.createElement(OdooAccountingAnalyticsHub, { isAr: true, locale: 'ar' }),
      )
      const hubEn = renderWithLang(
        'en',
        React.createElement(OdooAccountingAnalyticsHub, { isAr: false, locale: 'en' }),
      )

      expect(hubAr).not.toContain('لا توجد بيانات من Odoo لهذه الفترة')
      expect(hubAr).toContain('قيود غير مكتملة لهذه الفترة')
      expect(hubAr).toContain('2026-11-01 → 2026-11-15')
      expect(hubAr).toContain(formatExpectedKwd(expectedRevenue))
      expect(hubAr).toContain(formatExpectedKwd(expectedCogs))
      expect(hubAr).toContain('غير مُرحَّل بعد')
      expect(hubAr).toContain('لم يُرحَّل بعد في أودو لهذه الفترة')

      expect(hubEn).not.toContain('No Odoo GL data for this period')
      expect(hubEn).toContain('Incomplete GL entries for this period')
      expect(hubEn).toContain('Not yet posted in Odoo for this period')

      // 3. VentureAccountingHub in ERP mode renders only glSummary & receivables (no unlinked petty-cash/cheques/leases/fleet/localDb tabs)
      const ventureErp = renderWithLang(
        'ar',
        React.createElement(VentureAccountingHub, { locale: 'ar', embeddedInErp: true }),
      )
      expect(ventureErp).toContain('ملخص دفتر الأستاذ (Odoo GL)')
      expect(ventureErp).toContain('الذمم المدينة وأعمار الديون')
      expect(ventureErp).not.toContain('data-unlinked-source="true"')
      expect(ventureErp).not.toContain('سجلات النظام المحلي')
      expect(ventureErp).not.toContain('غير مُتحقق')
    })
  })

  describe('§F(b) Lock date gating & Last Closed Month quick button', () => {
    it('withholds profit when window is open, reveals profit when window <= glClosedThroughDate, supports Last Closed Month range, and shows plain one-line notice when lock date is null', () => {
      vi.useFakeTimers({ now: new Date(FIXTURE_NOW_MS), toFake: ['Date'] })

      // Verify helper ranges for month-end, mid-month, and null lock dates
      expect(lastClosedMonthDateRange('2026-10-31')).toEqual({
        fromIso: '2026-10-01',
        toIso: '2026-10-31',
        labelAr: 'أكتوبر 2026',
        labelEn: 'Oct 2026',
      })
      expect(lastClosedMonthDateRange('2026-10-15')).toEqual({
        fromIso: '2026-09-01',
        toIso: '2026-09-30',
        labelAr: 'سبتمبر 2026',
        labelEn: 'Sep 2026',
      })
      expect(lastClosedMonthDateRange(null)).toBeNull()

      const baseGl = {
        available: true,
        from: '2026-10-17',
        to: '2026-11-15',
        sourceModel: 'account.move.line' as const,
        lineCount: 15,
        income: 100,
        otherIncome: 0,
        totalRevenue: 100,
        cogs: 30,
        deliveryCommissions: 10,
        deliveryCommissionLinesCount: 2,
        expense: 25,
        depreciation: 5,
        otherOpexAndDepreciation: 20,
        operatingProfit: 40,
        completeAccrualPosted: true,
        glIncomplete: false,
        aggregatorCommissionUnposted: false,
        glClosedThroughDate: '2026-10-31',
      }

      // Case 1: Window ends 2026-11-15 > 2026-10-31 -> profit withheld, Last Closed Month button shown
      const openSummary = buildMinimalLiveSummary(baseGl)
      const openWs = computeGlobalWorkspace(
        { ...DEFAULT_GLOBAL_FILTERS, period: 'month' },
        openSummary,
        '/erp/executive-pnl',
      )
      expect(openWs.accounting.operatingProfitKwd).toBeNull()
      expect(openWs.accounting.netProfitPct).toBeNull()
      expect(openWs.accounting.netProfitWithheld).toBe(true)

      const setCustomRangeSpy = vi.fn()
      mockGlobalFilterState.current = buildContext(
        openSummary,
        { period: 'month' },
        { setCustomRange: setCustomRangeSpy },
      )
      const openHtmlEn = renderWithLang('en', React.createElement(ExecutivePnlStudio))
      expect(openHtmlEn).toContain('data-net-profit-withheld="true"')
      expect(openHtmlEn).not.toContain('40.000 KWD')
      expect(openHtmlEn).toContain('Last Closed Month (Oct 2026)')
      expect(openHtmlEn).toContain('aria-pressed="false"')

      // Case 2: Custom window set to closed month (2026-10-01 .. 2026-10-31 <= 2026-10-31) -> profit & margin shown
      const closedRange = lastClosedMonthDateRange('2026-10-31')!
      const closedGl = {
        ...baseGl,
        from: closedRange.fromIso,
        to: closedRange.toIso,
      }
      const closedSummary = buildMinimalLiveSummary(closedGl, {
        customBucketFrom: closedRange.fromIso,
        customBucketTo: closedRange.toIso,
      })
      const closedFilters: Partial<GlobalFilters> = {
        period: 'custom',
        customFrom: closedRange.fromIso,
        customTo: closedRange.toIso,
      }
      const closedWs = computeGlobalWorkspace(
        { ...DEFAULT_GLOBAL_FILTERS, ...closedFilters },
        closedSummary,
        '/erp/executive-pnl',
      )
      const expectedMarginPct = Math.round((40 / 100) * 1000) / 10
      expect(closedWs.accounting.netProfitWithheld).toBe(false)
      expect(closedWs.accounting.operatingProfitKwd).toBe(40)
      expect(closedWs.accounting.netProfitPct).toBe(expectedMarginPct)

      mockGlobalFilterState.current = buildContext(closedSummary, closedFilters)
      const closedHtmlEn = renderWithLang('en', React.createElement(ExecutivePnlStudio))
      expect(closedHtmlEn).not.toContain('data-net-profit-withheld="true"')
      expect(closedHtmlEn).toContain('40.000 KWD')
      expect(closedHtmlEn).toContain(`${expectedMarginPct.toFixed(1)}%`)
      expect(closedHtmlEn).toContain('aria-pressed="true"')

      // Case 3: glClosedThroughDate === null -> plain one-line notice & no Last Closed Month button
      const noLockSummary = buildMinimalLiveSummary({ ...baseGl, glClosedThroughDate: null })
      mockGlobalFilterState.current = buildContext(noLockSummary, { period: 'month' })
      const noLockAr = renderWithLang('ar', React.createElement(ExecutivePnlStudio))
      const noLockEn = renderWithLang('en', React.createElement(ExecutivePnlStudio))
      expect(noLockAr).toContain('لا يوجد تاريخ إقفال محاسبي مُعيَّن في أودو بعد')
      expect(noLockAr).toContain(PROFIT_AFTER_CLOSE_NOTE.ar)
      expect(noLockAr).not.toContain('آخر شهر مُقفل')
      expect(noLockEn).toContain('No accounting lock date is configured in Odoo yet')
      expect(noLockEn).toContain(PROFIT_AFTER_CLOSE_NOTE.en)
      expect(noLockEn).not.toContain('Last Closed Month')
    })
  })

  describe('§F(c) Balance Sheet equation & Trial Balance debit == credit', () => {
    it('computes Assets = Liabilities + Equity (with Current-Year Earnings = -Σ(P&L balances)) and balanced Trial Balance from real dump accounts', async () => {
      const cashAcc = mustDumpAccount('10001') // asset_cash
      const arAcc = mustDumpAccount('10501') // asset_receivable
      const fixedAcc = mustDumpAccount('101510') // asset_fixed
      const apAcc = mustDumpAccount('20100') // liability_payable
      const accruedAcc = mustDumpAccount('20301') // liability_current
      const capitalAcc = mustDumpAccount('30001') // equity
      const revAcc = mustDumpAccount('50001') // income
      const cogsAcc = mustDumpAccount('40001') // expense_direct_cost
      const expAcc = mustDumpAccount('40081') // expense
      const deprAcc = mustDumpAccount('40601') // expense_depreciation

      // Construct exact double-entry balanced rows (every number derives Assets == Liabilities + Equity)
      const cashDr = 1250.375
      const cashCr = 420.125
      const arDr = 310.5
      const arCr = 0
      const fixedDr = 500.0
      const fixedCr = 0

      const apDr = 0
      const apCr = 215.25
      const accruedDr = 0
      const accruedCr = 85.125
      const capitalDr = 0
      const capitalCr = 1000.0

      const revDr = 0
      const revCr = 600.75
      const cogsDr = 180.25
      const cogsCr = 0
      const expDr = 60.125
      const expCr = 0
      const deprDr = 20.0
      const deprCr = 0

      // Check our synthetic journal ties before passing to builder:
      // Assets net = (1250.375-420.125) + 310.5 + 500 = 1640.750
      // Liab net = 215.25 + 85.125 = 300.375
      // Equity accounts = 1000.000
      // YTD P&L net profit = 600.75 - (180.25 + 60.125 + 20) = 340.375
      // Liab + Equity + YTD Earnings = 300.375 + 1000 + 340.375 = 1640.750 (exact match!)
      const bsAccounts = [cashAcc, arAcc, fixedAcc, apAcc, accruedAcc, capitalAcc]
      const pnlAccounts = [revAcc, cogsAcc, expAcc, deprAcc]
      const bsRows: GlMoveLineGroupRow[] = [
        { account_id: [cashAcc.id, cashAcc.name], debit: cashDr, credit: cashCr, balance: r3(cashDr - cashCr), __count: 4 },
        { account_id: [arAcc.id, arAcc.name], debit: arDr, credit: arCr, balance: r3(arDr - arCr), __count: 2 },
        { account_id: [fixedAcc.id, fixedAcc.name], debit: fixedDr, credit: fixedCr, balance: r3(fixedDr - fixedCr), __count: 1 },
        { account_id: [apAcc.id, apAcc.name], debit: apDr, credit: apCr, balance: r3(apDr - apCr), __count: 3 },
        { account_id: [accruedAcc.id, accruedAcc.name], debit: accruedDr, credit: accruedCr, balance: r3(accruedDr - accruedCr), __count: 1 },
        { account_id: [capitalAcc.id, capitalAcc.name], debit: capitalDr, credit: capitalCr, balance: r3(capitalDr - capitalCr), __count: 1 },
      ]
      const pnlRows: GlMoveLineGroupRow[] = [
        { account_id: [revAcc.id, revAcc.name], debit: revDr, credit: revCr, balance: r3(revDr - revCr), __count: 5 },
        { account_id: [cogsAcc.id, cogsAcc.name], debit: cogsDr, credit: cogsCr, balance: r3(cogsDr - cogsCr), __count: 2 },
        { account_id: [expAcc.id, expAcc.name], debit: expDr, credit: expCr, balance: r3(expDr - expCr), __count: 1 },
        { account_id: [deprAcc.id, deprAcc.name], debit: deprDr, credit: deprCr, balance: r3(deprDr - deprCr), __count: 1 },
      ]

      const allRows = [...bsRows, ...pnlRows]
      const allMap = new Map([...bsAccounts, ...pnlAccounts].map((a) => [a.id, a]))
      const expectedTotalDebit = r3(allRows.reduce((s, r) => s + (r.debit ?? 0), 0))
      const expectedTotalCredit = r3(allRows.reduce((s, r) => s + (r.credit ?? 0), 0))
      expect(expectedTotalDebit).toBe(expectedTotalCredit)

      const tb = buildGlTrialBalanceFromGroups({
        fromIso: '2026-01-01',
        toInclusiveIso: '2026-10-31',
        accountById: allMap,
        rows: allRows,
      })
      expect(tb.readable).toBe(true)
      expect(tb.balanced).toBe(true)
      expect(tb.differenceKwd).toBe(0)
      expect(tb.totalDebitKwd).toBe(expectedTotalDebit)
      expect(tb.totalCreditKwd).toBe(expectedTotalCredit)

      const expectedAssets = r3((cashDr - cashCr) + (arDr - arCr) + (fixedDr - fixedCr))
      const expectedLiabilities = r3(-(apDr - apCr) - (accruedDr - accruedCr))
      const expectedCurrentYearEarnings = r3(-pnlRows.reduce((s, r) => s + (r.balance ?? 0), 0))
      const expectedEquity = r3(-(capitalDr - capitalCr) + expectedCurrentYearEarnings)

      const bs = buildGlBalanceSheetFromGroups({
        asOfIso: '2026-10-31',
        fiscalYearStartIso: '2026-01-01',
        balanceAccounts: bsAccounts,
        balanceRows: bsRows,
        ytdPnlAccountById: new Map(pnlAccounts.map((a) => [a.id, a])),
        ytdPnlRows: pnlRows,
      })

      expect(bs.readable).toBe(true)
      expect(bs.equationBalanced).toBe(true)
      expect(bs.differenceKwd).toBe(0)
      expect(bs.assetsTotalKwd).toBe(expectedAssets)
      expect(bs.liabilitiesTotalKwd).toBe(expectedLiabilities)
      expect(bs.currentYearEarningsKwd).toBe(expectedCurrentYearEarnings)
      expect(bs.equityTotalKwd).toBe(expectedEquity)
      expect(bs.assetsTotalKwd).toBe(r3(bs.liabilitiesTotalKwd + bs.equityTotalKwd))

      // Error handling: failed read marks unavailable section without returning silent null
      const marked: string[] = []
      const failingCtx: GlOdooReadContext = {
        executeOdoo: async () => {
          throw new Error('Odoo read_group timeout')
        },
        markUnavailable: (sec) => marked.push(sec),
      }
      const failedTb = await fetchGlTrialBalance({
        ...failingCtx,
        fromIso: '2026-10-01',
        toInclusiveIso: '2026-10-31',
      })
      const failedBs = await fetchGlBalanceSheet({
        ...failingCtx,
        asOfIso: '2026-10-31',
      })
      expect(failedTb.readable).toBe(false)
      expect(failedBs.readable).toBe(false)
      expect(marked).toEqual(['gl.trialBalance', 'gl.balanceSheet'])
    })
  })

  describe('§F(d) AR company_id domain, per-partner == per-account AR, AP aging & verify-ar-aging.ts', () => {
    it('enforces company_id domain on AR & AP in fetchLiveOdooSnapshot, ties per-partner AR buckets to per-account totals, and populates AP aging', async () => {
      vi.useFakeTimers({ now: new Date(FIXTURE_NOW_MS), toFake: ['Date'] })
      process.env.ODOO_URL = 'https://odoo.test.invalid'
      process.env.ODOO_DB = 'vf_test'
      process.env.ODOO_USERNAME = 'bi@test.invalid'
      process.env.ODOO_API_KEY = 'unit-test-token'
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })

      const talabatAr = mustDumpAccount('10501')
      const posAr = mustDumpAccount('10552')
      const apFood = mustDumpAccount('20200')
      const revAcc = mustDumpAccount('50001')

      // Synthetic AR fixture lines:
      // Talabat Co. (partner 301) on 10501: 120.500 (0_30) + 45.250 (31_60) - 15.750 unapplied credit
      // Deliveroo Customer (partner 302) on 10501: 30.000 (over_60)
      // POS Clearing (partner 303) on 10552: -25.000 unapplied credit
      const ar0_30ByAcc = [{ account_id: [talabatAr.id, `${talabatAr.code} ${talabatAr.name}`], amount_residual: 120.5, __count: 2 }]
      const ar31_60ByAcc = [{ account_id: [talabatAr.id, `${talabatAr.code} ${talabatAr.name}`], amount_residual: 45.25, __count: 1 }]
      const arOver60ByAcc = [{ account_id: [talabatAr.id, `${talabatAr.code} ${talabatAr.name}`], amount_residual: 30.0, __count: 1 }]
      const arCreditsByAcc = [
        { account_id: [talabatAr.id, `${talabatAr.code} ${talabatAr.name}`], amount_residual: -15.75, __count: 1 },
        { account_id: [posAr.id, `${posAr.code} ${posAr.name}`], amount_residual: -25.0, __count: 2 },
      ]
      const arByAccTotal = [
        { account_id: [talabatAr.id, `${talabatAr.code} ${talabatAr.name}`], amount_residual: r3(120.5 + 45.25 + 30.0 - 15.75), __count: 5 },
        { account_id: [posAr.id, `${posAr.code} ${posAr.name}`], amount_residual: -25.0, __count: 2 },
      ]

      const ar0_30ByPartner: PartnerAgingGroupRow[] = [{ partner_id: [301, 'Talabat Co.'], amount_residual: 120.5, __count: 2 }]
      const ar31_60ByPartner: PartnerAgingGroupRow[] = [{ partner_id: [301, 'Talabat Co.'], amount_residual: 45.25, __count: 1 }]
      const arOver60ByPartner: PartnerAgingGroupRow[] = [{ partner_id: [302, 'Corporate Client A'], amount_residual: 30.0, __count: 1 }]
      const arCreditsByPartner: PartnerAgingGroupRow[] = [
        { partner_id: [301, 'Talabat Co.'], amount_residual: -15.75, __count: 1 },
        { partner_id: [303, 'POS Clearing Partner'], amount_residual: -25.0, __count: 2 },
      ]

      // Synthetic AP fixture lines (Odoo payable bills are negative amount_residual, advances are positive):
      // Supplier A (partner 401): -200.500 (0_30), -50.250 (31_60), +20.000 (advance debit)
      const apOwed0_30Acc = [{ account_id: [apFood.id, `${apFood.code} ${apFood.name}`], amount_residual: -200.5, __count: 2 }]
      const apOwed31_60Acc = [{ account_id: [apFood.id, `${apFood.code} ${apFood.name}`], amount_residual: -50.25, __count: 1 }]
      const apOwedOver60Acc: typeof apOwed0_30Acc = []
      const apAdvanceAcc = [{ account_id: [apFood.id, `${apFood.code} ${apFood.name}`], amount_residual: 20.0, __count: 1 }]
      const apByAccTotal = [{ account_id: [apFood.id, `${apFood.code} ${apFood.name}`], amount_residual: r3(-200.5 - 50.25 + 20.0), __count: 4 }]

      const apOwed0_30Partner: PartnerAgingGroupRow[] = [{ partner_id: [401, 'Kuwait Food Supply'], amount_residual: -200.5, __count: 2 }]
      const apOwed31_60Partner: PartnerAgingGroupRow[] = [{ partner_id: [401, 'Kuwait Food Supply'], amount_residual: -50.25, __count: 1 }]
      const apAdvancePartner: PartnerAgingGroupRow[] = [{ partner_id: [401, 'Kuwait Food Supply'], amount_residual: 20.0, __count: 1 }]

      const capturedArDomains: string[] = []
      const capturedApDomains: string[] = []

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number
          params?: { service?: string; method?: string; args?: unknown[] }
        }
        const reqId = body.id ?? 1
        if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
          return rpcJson(reqId, 7)
        }
        const args = body.params?.args ?? []
        const model = String(args[3] ?? '')
        const method = String(args[4] ?? '')
        const methodArgs = (args[5] as unknown[]) ?? []
        const domain = (methodArgs[0] as unknown[]) ?? []
        const domainJson = JSON.stringify(domain)
        const groupby = (methodArgs[2] as string[]) ?? []

        if (model === 'res.users' && method === 'read') {
          return rpcJson(reqId, [{ id: 7, company_id: [1, 'Venture Foods'] }])
        }
        if (model === 'res.company' && method === 'search_read') {
          return rpcJson(reqId, [{ period_lock_date: '2026-10-31', fiscalyear_lock_date: '2025-12-31' }])
        }
        if (model === 'pos.config' && method === 'search_read') {
          return rpcJson(reqId, [{ id: 8, name: 'Promenade 1', active: true, company_id: [1, 'Venture Foods'] }])
        }
        if (model === 'pos.category' && method === 'search_read') {
          return rpcJson(reqId, [{ id: 10, name: 'CG', parent_id: false }])
        }
        if (model === 'account.account' && method === 'search_read') {
          return rpcJson(reqId, [talabatAr, posAr, apFood, revAcc])
        }
        if (model === 'pos.order' && method === 'search_read') {
          return rpcJson(reqId, [{ id: 1, date_order: '2026-11-15 09:00:00', amount_total: 100, config_id: [8, 'Promenade 1'], company_id: [1, 'Venture Foods'] }])
        }
        if (model === 'ir.model' && method === 'search_read') {
          return rpcJson(reqId, [])
        }
        if (model === 'account.move.line' && method === 'read_group') {
          if (domainJson.includes('"asset_receivable"')) {
            capturedArDomains.push(domainJson)
            const byPartner = groupby.includes('partner_id')
            if (domainJson.includes('["amount_residual","<",0]')) {
              return rpcJson(reqId, byPartner ? arCreditsByPartner : arCreditsByAcc)
            }
            if (domainJson.includes('["amount_residual",">",0]')) {
              const hasGte = domainJson.includes('"date_maturity",">="')
              const hasLt = domainJson.includes('"date_maturity","<"')
              if (hasGte && !hasLt) return rpcJson(reqId, byPartner ? ar0_30ByPartner : ar0_30ByAcc)
              if (hasGte && hasLt) return rpcJson(reqId, byPartner ? ar31_60ByPartner : ar31_60ByAcc)
              return rpcJson(reqId, byPartner ? arOver60ByPartner : arOver60ByAcc)
            }
            return rpcJson(reqId, arByAccTotal)
          }

          if (domainJson.includes('"liability_payable"')) {
            capturedApDomains.push(domainJson)
            const byPartner = groupby.includes('partner_id')
            if (domainJson.includes('["amount_residual",">",0]')) {
              return rpcJson(reqId, byPartner ? apAdvancePartner : apAdvanceAcc)
            }
            if (domainJson.includes('["amount_residual","<",0]')) {
              const hasGte = domainJson.includes('"date_maturity",">="')
              const hasLt = domainJson.includes('"date_maturity","<"')
              if (hasGte && !hasLt) return rpcJson(reqId, byPartner ? apOwed0_30Partner : apOwed0_30Acc)
              if (hasGte && hasLt) return rpcJson(reqId, byPartner ? apOwed31_60Partner : apOwed31_60Acc)
              return rpcJson(reqId, byPartner ? [] : apOwedOver60Acc)
            }
            return rpcJson(reqId, apByAccTotal)
          }

          return rpcJson(reqId, [{ account_id: [revAcc.id, revAcc.name], debit: 0, credit: 100, balance: -100, __count: 2 }])
        }
        if (model === 'account.move.line' && method === 'search_read') {
          if (domainJson.includes('"asset_receivable"')) {
            capturedArDomains.push(domainJson)
            return rpcJson(reqId, [{ date: '2026-10-01', date_maturity: '2026-11-20' }])
          }
        }
        return rpcJson(reqId, [])
      })

      const snap = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: FIXTURE_NOW_MS,
      })

      // 1. Both AR and AP domains MUST include company_id = 1
      expect(capturedArDomains.length).toBeGreaterThanOrEqual(10)
      for (const d of capturedArDomains) {
        expect(d).toContain('["company_id","=",1]')
      }
      expect(capturedApDomains.length).toBeGreaterThanOrEqual(9)
      for (const d of capturedApDomains) {
        expect(d).toContain('["company_id","=",1]')
      }

      // 2. AR per-partner aging buckets sum equal to per-account buckets
      const ar = snap.aggregatorReceivables!
      expect(ar.readable).toBe(true)
      expect(ar.companyId).toBe(1)
      expect(ar.partnerCount).toBe(3)
      const byPartner = ar.byPartner ?? []
      expect(byPartner).toHaveLength(3)

      for (const bucketKey of ['0_30', '31_60', 'over_60'] as const) {
        const partnerBucketSum = r3(
          byPartner.reduce(
            (s, p) => s + (p.buckets.find((b) => b.key === bucketKey)?.residualKwd ?? 0),
            0,
          ),
        )
        const accBucketVal = ar.agingBuckets?.find((b) => b.key === bucketKey)?.residualKwd ?? 0
        expect(partnerBucketSum).toBe(accBucketVal)
      }
      const partnerCreditsSum = r3(byPartner.reduce((s, p) => s + p.unappliedCreditsKwd, 0))
      const partnerNetSum = r3(byPartner.reduce((s, p) => s + p.residualKwd, 0))
      expect(partnerCreditsSum).toBe(ar.unappliedCreditsKwd)
      expect(partnerNetSum).toBe(ar.openReceivableKwd)

      // 3. AP aging (`liability_payable`) flips payables to positive owed amounts & matches per-partner sum
      const ap = ar.apAging!
      expect(ap.readable).toBe(true)
      expect(ap.companyId).toBe(1)
      expect(ap.openCreditsKwd).toBe(r3(200.5 + 50.25))
      expect(ap.unappliedDebitsKwd).toBe(-20.0)
      expect(ap.openPayableKwd).toBe(r3(200.5 + 50.25 - 20.0))
      expect(ap.byPartner).toHaveLength(1)
      expect(ap.byPartner[0]?.partnerName).toBe('Kuwait Food Supply')
      expect(ap.byPartner[0]?.residualKwd).toBe(ap.openPayableKwd)
    })

    it('buildPartnerAgingRows agrees with summarizeArAging, and verify-ar-aging.ts parses CSV/XLSX and enforces 0.001 KWD tolerance', () => {
      const debits0_30: PartnerAgingGroupRow[] = [
        { partnerId: 11, partnerName: 'Talabat', residualKwd: 50.125, linesCount: 2 },
        { partnerId: 12, partnerName: 'Jahez', residualKwd: 19.875, linesCount: 1 },
      ]
      const debits31_60: PartnerAgingGroupRow[] = [
        { partnerId: 11, partnerName: 'Talabat', residualKwd: 12.5, linesCount: 1 },
      ]
      const credits: PartnerAgingGroupRow[] = [
        { partnerId: 12, partnerName: 'Jahez', residualKwd: -4.25, linesCount: 1 },
      ]

      const partnerRows = buildPartnerAgingRows({
        debitsByBucketPartner: { '0_30': debits0_30, '31_60': debits31_60 },
        creditsByPartner: credits,
      })
      const acctSummary = summarizeArAging({
        debitsByBucket: {
          '0_30': { residualKwd: r3(50.125 + 19.875), linesCount: 3 },
          '31_60': { residualKwd: 12.5, linesCount: 1 },
        },
        credits: { residualKwd: -4.25, linesCount: 1 },
      })

      expect(r3(partnerRows.reduce((s, p) => s + p.residualKwd, 0))).toBe(acctSummary.openReceivableKwd)
      expect(r3(partnerRows.reduce((s, p) => s + p.unappliedCreditsKwd, 0))).toBe(acctSummary.unappliedCreditsKwd)

      // verify-ar-aging.ts: parse Odoo native CSV export & normalized CSV export
      const odooNativeCsv = [
        'Partner,At Date,1 - 30,31 - 60,61 - 90,91 - 120,Older,Total',
        'Talabat,50.125,0.000,12.500,0.000,0.000,0.000,62.625',
        'Jahez,19.875,0.000,0.000,0.000,0.000,0.000,15.625',
        'Total,70.000,0.000,12.500,0.000,0.000,0.000,78.250',
      ].join('\n')
      const parsedOdooTotals = parseAgedReceivableReportCsv(odooNativeCsv)
      expect(parsedOdooTotals).toEqual({
        '0_30': 70.0,
        '31_60': 12.5,
        over_60: 0,
        unapplied_credits: -4.25,
        total: 78.25,
      })

      // XLSX workbook round-trip test
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([
        ['Partner', '0_30', '31_60', 'over_60', 'unapplied_credits', 'total'],
        ['Talabat', 50.125, 12.5, 0, 0, 62.625],
        ['Jahez', 19.875, 0, 0, -4.25, 15.625],
      ])
      XLSX.utils.book_append_sheet(wb, ws, 'Aged Receivable')
      const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
      const parsedXlsxTotals = parseAgedReceivableReportXlsx(xlsxBuf)
      expect(parsedXlsxTotals).toEqual(parsedOdooTotals)

      const computed: ArBucketTotals = {
        '0_30': acctSummary.buckets.find((b) => b.key === '0_30')!.residualKwd,
        '31_60': acctSummary.buckets.find((b) => b.key === '31_60')!.residualKwd,
        over_60: acctSummary.buckets.find((b) => b.key === 'over_60')!.residualKwd,
        unapplied_credits: acctSummary.unappliedCreditsKwd,
        total: acctSummary.openReceivableKwd,
      }

      // Within 0.001 KWD -> PASS
      expect(compareArBucketTotals(computed, parsedOdooTotals, 0.001).passed).toBe(true)
      expect(
        compareArBucketTotals(
          { ...computed, '0_30': r3(computed['0_30'] + 0.001) },
          parsedOdooTotals,
          0.001,
        ).passed,
      ).toBe(true)

      // Diff > 0.001 KWD -> FAIL on the offending bucket
      const failedComparison = compareArBucketTotals(
        { ...computed, '0_30': r3(computed['0_30'] + 0.002) },
        parsedOdooTotals,
        0.001,
      )
      expect(failedComparison.passed).toBe(false)
      expect(failedComparison.rows.find((r) => r.bucket === '0_30')?.withinTolerance).toBe(false)
    })
  })

  describe('§F(e) Receivables flag remains false; pending hides all amounts while verified renders per-partner AR + AP tables', () => {
    it('keeps PER_CUSTOMER_DUE_DATE_AGING_VERIFIED === false, shows only non-amount metadata while pending, and renders AR + AP tables when verified', () => {
      expect(PER_CUSTOMER_DUE_DATE_AGING_VERIFIED).toBe(false)

      const rawMeta: WorkspaceReceivablesMeta = {
        unavailable: false,
        pendingReconciliation: false,
        companyId: 1,
        asOfDate: '2026-11-15',
        partnerCount: 2,
        accountNames: [
          {
            code: '10501',
            name: '10501 Account Receivable-Talabat Company',
            labelAr: 'ذمم منصة طلبات (10501)',
            labelEn: 'Talabat Receivable (10501)',
          },
          {
            code: '10552',
            name: '10552 Account Receivable (PoS)',
            labelAr: 'تسويات نقاط البيع قيد المقاصة (10552)',
            labelEn: 'POS Clearing Receivable (10552)',
          },
        ],
        openReceivableKwd: 200.125,
        grossPositiveReceivableKwd: 250.375,
        creditClearingOffsetKwd: -50.25,
        unreconciledLineCount: 44,
        posClearingLinesCount: 12,
        platformAndCorporateLinesCount: 32,
        fromDate: '2026-10-01',
        toDate: '2026-11-15',
        latestMaturityDate: '2026-11-20',
        maturityStatusAr: 'مستحق',
        maturityStatusEn: 'Current',
        openLinesExplanationAr: 'صافي 200.125 د.ك',
        openLinesExplanationEn: 'Net 200.125 KWD',
        sourceLabelAr: 'أودو 17',
        sourceLabelEn: 'Odoo 17',
        reconciliationFormulaAr: '250.375 - 50.250 = 200.125 د.ك',
        reconciliationFormulaEn: '250.375 - 50.250 = 200.125 KWD',
        byAccount: [
          {
            accountId: 1666,
            accountCode: '10501',
            accountName: 'Talabat',
            labelAr: 'ذمم منصة طلبات (10501)',
            labelEn: 'Talabat Receivable (10501)',
            residualKwd: 200.125,
            linesCount: 32,
          },
        ],
        byPartner: [
          {
            partnerId: 301,
            partnerName: 'Talabat Co.',
            residualKwd: 250.375,
            openDebitsKwd: 250.375,
            unappliedCreditsKwd: 0,
            linesCount: 32,
            buckets: [
              { key: '0_30', labelAr: '0–30 يوماً', labelEn: '0–30 days', residualKwd: 250.375, positiveDebitKwd: 250.375, creditOffsetKwd: 0, linesCount: 32 },
              { key: '31_60', labelAr: '31–60 يوماً', labelEn: '31–60 days', residualKwd: 0, positiveDebitKwd: 0, creditOffsetKwd: 0, linesCount: 0 },
              { key: 'over_60', labelAr: 'أكثر من 60 يوماً', labelEn: 'Over 60 days', residualKwd: 0, positiveDebitKwd: 0, creditOffsetKwd: 0, linesCount: 0 },
            ],
          },
          {
            partnerId: 302,
            partnerName: 'POS Clearing Partner',
            residualKwd: -50.25,
            openDebitsKwd: 0,
            unappliedCreditsKwd: -50.25,
            linesCount: 12,
            buckets: [
              { key: '0_30', labelAr: '0–30 يوماً', labelEn: '0–30 days', residualKwd: 0, positiveDebitKwd: 0, creditOffsetKwd: 0, linesCount: 0 },
              { key: '31_60', labelAr: '31–60 يوماً', labelEn: '31–60 days', residualKwd: 0, positiveDebitKwd: 0, creditOffsetKwd: 0, linesCount: 0 },
              { key: 'over_60', labelAr: 'أكثر من 60 يوماً', labelEn: 'Over 60 days', residualKwd: 0, positiveDebitKwd: 0, creditOffsetKwd: 0, linesCount: 0 },
            ],
          },
        ],
        agingBuckets: [
          { key: '0_30', labelAr: '0–30 يوماً', labelEn: '0–30 days', residualKwd: 250.375, positiveDebitKwd: 250.375, creditOffsetKwd: 0, linesCount: 32 },
        ],
        openDebitsKwd: 250.375,
        unappliedCreditsKwd: -50.25,
        agingHiddenReasonAr: null,
        agingHiddenReasonEn: null,
        apAging: {
          readable: true,
          companyId: 1,
          asOfDate: '2026-11-15',
          openPayableKwd: 88.5,
          openCreditsKwd: 98.5,
          unappliedDebitsKwd: -10.0,
          openLinesCount: 6,
          byAccount: [
            {
              accountId: 1736,
              accountCode: '20200',
              accountName: 'Account Payable -Food Suppliers',
              labelAr: 'موردو المواد الغذائية (20200)',
              labelEn: 'Food Suppliers Payable (20200)',
              residualKwd: 88.5,
              linesCount: 6,
            },
          ],
          byPartner: [
            {
              partnerId: 401,
              partnerName: 'Gulf Poultry Vendor',
              residualKwd: 88.5,
              openDebitsKwd: 98.5,
              unappliedCreditsKwd: -10.0,
              linesCount: 6,
              buckets: [
                { key: '0_30', labelAr: '0–30 يوماً', labelEn: '0–30 days', residualKwd: 98.5, positiveDebitKwd: 98.5, creditOffsetKwd: 0, linesCount: 5 },
                { key: '31_60', labelAr: '31–60 يوماً', labelEn: '31–60 days', residualKwd: 0, positiveDebitKwd: 0, creditOffsetKwd: 0, linesCount: 0 },
                { key: 'over_60', labelAr: 'أكثر من 60 يوماً', labelEn: 'Over 60 days', residualKwd: 0, positiveDebitKwd: 0, creditOffsetKwd: 0, linesCount: 0 },
              ],
            },
          ],
          agingBuckets: [],
        },
      }

      const pendingMeta = applyReceivablesExecutivePolicy(rawMeta)
      expect(pendingMeta.pendingReconciliation).toBe(true)
      expect(pendingMeta.openReceivableKwd).toBeNull()
      expect(pendingMeta.byAccount).toEqual([])
      expect(pendingMeta.byPartner).toEqual([])
      expect(pendingMeta.apAging).toBeNull()
      expect(pendingMeta.companyId).toBe(1)
      expect(pendingMeta.asOfDate).toBe('2026-11-15')
      expect(pendingMeta.partnerCount).toBe(2)
      expect(pendingMeta.accountNames).toHaveLength(2)

      const summary = buildMinimalLiveSummary({
        available: true,
        from: '2026-10-17',
        to: '2026-11-15',
        lineCount: 10,
        income: 100,
        otherIncome: 0,
        totalRevenue: 100,
        cogs: 30,
        deliveryCommissions: 5,
        expense: 15,
        depreciation: 2,
        operatingProfit: 48,
        completeAccrualPosted: true,
        glIncomplete: false,
      })

      mockGlobalFilterState.current = buildContext(summary, {}, {}, (ws) => ({
        ...ws,
        receivables: pendingMeta,
      }))

      // 1. Pending state: ZERO AR/AP amounts, real metadata + status pill, zero blank amount cards
      const pendingStudioEn = renderWithLang('en', React.createElement(ReceivablesAgingStudio))
      const pendingHubEn = renderWithLang(
        'en',
        React.createElement(OdooAccountingAnalyticsHub, { isAr: false, locale: 'en' }),
      )

      for (const amt of ['200.125', '250.375', '50.250', '88.500', '98.500']) {
        expect(pendingStudioEn).not.toContain(amt)
        expect(pendingHubEn).not.toContain(amt)
      }
      expect(pendingStudioEn).toContain('data-receivables-pending="true"')
      expect(pendingStudioEn).toContain(RECEIVABLES_PENDING_STATUS.en)
      expect(pendingStudioEn).toContain('(#1)')
      expect(pendingStudioEn).toContain('Open balance as of 2026-11-15')
      expect(pendingStudioEn).toContain('44')
      expect(pendingStudioEn).toContain('10501')
      expect(pendingStudioEn).toContain('10552')
      expect(pendingStudioEn).not.toContain('Net Open Receivables Balance')
      expect(pendingHubEn).toContain(RECEIVABLES_PENDING_STATUS.en)
      expect(pendingHubEn).toContain('44 unreconciled AR lines')

      // 2. Verified state: renders per-partner AR + AP tables and verified amounts
      const verifiedMeta = applyReceivablesExecutivePolicy(rawMeta, true)
      expect(verifiedMeta.pendingReconciliation).toBe(false)
      expect(verifiedMeta.openReceivableKwd).toBe(200.125)
      expect(verifiedMeta.byPartner).toHaveLength(2)
      expect(verifiedMeta.apAging?.readable).toBe(true)

      mockReceivablesOverride.verified = true
      mockGlobalFilterState.current = buildContext(summary, {}, {}, (ws) => ({
        ...ws,
        receivables: verifiedMeta,
      }))
      const verifiedStudioEn = renderWithLang('en', React.createElement(ReceivablesAgingStudio))
      const verifiedHubEn = renderWithLang(
        'en',
        React.createElement(OdooAccountingAnalyticsHub, { isAr: false, locale: 'en' }),
      )

      expect(verifiedStudioEn).not.toContain('data-receivables-pending="true"')
      expect(verifiedStudioEn).toContain('Per-Partner Accounts Receivable Aging')
      expect(verifiedStudioEn).toContain('Talabat Co.')
      expect(verifiedStudioEn).toContain('250.375 KWD')
      expect(verifiedStudioEn).toContain('Accounts Payable Aging (liability_payable)')
      expect(verifiedStudioEn).toContain('Gulf Poultry Vendor')
      expect(verifiedStudioEn).toContain('88.500 KWD')
      expect(verifiedHubEn).toContain('200.125 KWD')
    })
  })

  describe('§F(f) Budget probe (absent/unreadable omits all Budget/موازنة text; readable renders Budget vs Actual)', () => {
    it('removes every "موازنة" and "Budget" string across ExecutivePnlStudio, route-titles, sidebar, and page metadata when budgetProbe is absent or unreadable, and renders table when readable', async () => {
      // Static navigation & metadata check
      const title = routeTitle('/erp/executive-pnl')
      expect(title?.ar).toBe('قائمة الدخل ومطابقة نقاط البيع مع الأستاذ العام')
      expect(title?.en).toBe('Income Statement & POS–GL Reconciliation')
      expect(title?.ar).not.toContain('موازنة')
      expect(title?.en).not.toMatch(/budget/i)

      const sidebarEntry = SIDEBAR_ITEMS.find((i) => i.href === '/erp/executive-pnl')
      expect(sidebarEntry?.labelAr).toBe('قائمة الدخل ومطابقة نقاط البيع مع الأستاذ العام')
      expect(sidebarEntry?.labelAr).not.toContain('موازنة')
      expect(sidebarEntry?.labelEn).not.toMatch(/budget/i)

      expect(String(executivePnlMetadata.title)).not.toContain('موازنة')
      expect(String(executivePnlMetadata.title)).not.toMatch(/budget/i)
      expect(String(executivePnlMetadata.description)).not.toContain('موازنة')
      expect(String(executivePnlMetadata.description)).not.toMatch(/budget/i)

      const sidebarAr = renderWithLang(
        'ar',
        React.createElement(
          TypedThemeProvider,
          { initialTheme: 'light' },
          React.createElement(
            BiFilterProvider,
            null,
            React.createElement(
              TypedGovernanceProvider,
              { isAuditor: false, sessionRole: 'admin' },
              React.createElement(ErpSidebar, { user: SAMPLE_ADMIN_USER }),
            ),
          ),
        ),
      )
      expect(sidebarAr).not.toContain('موازنة')
      expect(sidebarAr).not.toMatch(/\bbudget\b/i)

      // 1. probeCrossoveredBudget unit checks (model absent vs access denied vs readable)
      const absentProbe = await probeCrossoveredBudget({
        fromIso: '2026-01-01',
        toInclusiveIso: '2026-10-31',
        executeOdoo: makeExecuteOdoo(async () => []),
      })
      expect(absentProbe).toMatchObject({ probed: true, modelPresent: false, readable: false, lines: [] })

      const readableProbe = await probeCrossoveredBudget({
        fromIso: '2026-01-01',
        toInclusiveIso: '2026-10-31',
        executeOdoo: makeExecuteOdoo(async (model, method) => {
          if (model === 'ir.model' && method === 'search_read') {
            return [{ id: 1, model: 'crossovered.budget' }]
          }
          if (model === 'crossovered.budget' && method === 'check_access_rights') {
            return true
          }
          if (model === 'crossovered.budget.lines' && method === 'search_read') {
            return [
              {
                general_budget_id: [1, 'FY2026 Operating Plan'],
                analytic_account_id: [39, 'Promenade Mall'],
                planned_amount: 500.0,
                practical_amount: 450.25,
                date_from: '2026-01-01',
                date_to: '2026-10-31',
              },
            ]
          }
          return []
        }),
      })
      expect(readableProbe.readable).toBe(true)
      expect(readableProbe.lines).toHaveLength(1)
      expect(readableProbe.lines[0]?.varianceKwd).toBe(r3(450.25 - 500.0))

      // 2. Rendered ExecutivePnlStudio with absent / unreadable budgetProbe -> ZERO "موازنة" or "Budget"
      const baseGl = {
        available: true,
        from: '2026-10-17',
        to: '2026-11-15',
        sourceModel: 'account.move.line' as const,
        lineCount: 10,
        income: 100,
        otherIncome: 0,
        totalRevenue: 100,
        cogs: 30,
        deliveryCommissions: 0,
        expense: 15,
        depreciation: 0,
        glIncomplete: true,
        operatingProfit: 55,
        glClosedThroughDate: null,
      }

      for (const probe of [undefined, absentProbe]) {
        const sum = buildMinimalLiveSummary({ ...baseGl, ...(probe ? { budgetProbe: probe } : {}) })
        mockGlobalFilterState.current = buildContext(sum)
        const arHtml = renderWithLang('ar', React.createElement(ExecutivePnlStudio))
        const enHtml = renderWithLang('en', React.createElement(ExecutivePnlStudio))
        expect(arHtml).not.toContain('موازنة')
        expect(arHtml).not.toMatch(/\bbudget\b/i)
        expect(enHtml).not.toContain('موازنة')
        expect(enHtml).not.toMatch(/\bbudget\b/i)
      }

      // 3. Rendered ExecutivePnlStudio when budgetProbe.readable === true with lines -> Budget vs Actual table renders
      const sumWithBudget = buildMinimalLiveSummary({ ...baseGl, budgetProbe: readableProbe })
      mockGlobalFilterState.current = buildContext(sumWithBudget)
      const arBudgetHtml = renderWithLang('ar', React.createElement(ExecutivePnlStudio))
      const enBudgetHtml = renderWithLang('en', React.createElement(ExecutivePnlStudio))
      expect(arBudgetHtml).toContain('الموازنة مقابل الفعلي (crossovered.budget.lines)')
      expect(arBudgetHtml).toContain('FY2026 Operating Plan')
      expect(arBudgetHtml).toContain('500.000')
      expect(arBudgetHtml).toContain('450.250')
      expect(arBudgetHtml).toContain('-49.750')
      expect(enBudgetHtml).toContain('Budget vs Actual (crossovered.budget.lines)')
    })
  })

  describe('§F(g) Deterministic commission classifier on all 330 real dump expense accounts', () => {
    it('classifies all 330 real dump expense accounts, verifies every §E code/range, enforces word-safe Carriage vs \\bcari\\b, rejects non-expense types, and matches the 13-account diff snapshot', () => {
      const expenseAccounts = DUMP_ACCOUNTS.filter((a) => a.account_type === 'expense')
      expect(expenseAccounts).toHaveLength(330)

      const counts: Record<PlatformExpenseClass, number> = {
        platform_commission: 0,
        platform_subscription: 0,
        third_party_delivery: 0,
        payment_gateway: 0,
        bank_fees: 0,
        ads: 0,
        other: 0,
      }

      const changedAccounts: Array<{
        code: string
        name: string
        legacy: boolean
        newClass: PlatformExpenseClass
      }> = []

      for (const acc of expenseAccounts) {
        const cls = classifyPlatformExpenseAccount(acc.code, acc.name, acc.account_type)
        counts[cls] += 1
        const legacy = legacyIsDeliveryCommissionGlAccount(acc.code, acc.name)
        const isNewComm = cls === 'platform_commission'
        if (legacy !== isNewComm) {
          changedAccounts.push({
            code: acc.code,
            name: acc.name,
            legacy,
            newClass: cls,
          })
        }
      }

      expect(counts).toEqual({
        platform_commission: 33,
        platform_subscription: 4,
        third_party_delivery: 9,
        payment_gateway: 3,
        bank_fees: 5,
        ads: 12,
        other: 264,
      })

      // Verify every code / range in Part 2 §E lines 289-296 against real dump rows
      const expectedCodeGroups: ReadonlyArray<readonly [PlatformExpenseClass, readonly string[]]> = [
        ['platform_subscription', ['40224', '40225', '40226', '40228']],
        [
          'platform_commission',
          [
            '40229',
            '40230',
            '40705',
            '40811',
            '40812',
            '40813',
            '40814',
            '40815',
            '40816',
            '40866',
            '40867',
            '40868',
            '40918',
            '40919',
            '40920',
            '40921',
            '40922',
            '40923',
            '40973',
            '40974',
            '40975',
            '40976',
            '40977',
            '40978',
            '41028',
            '41029',
            '41030',
            '41031',
            '41032',
            '41033',
            '40702',
            '40703',
            '40704',
          ],
        ],
        ['third_party_delivery', ['40231', '40232', '40233', '40234', '40235', '40236', '40237', '40239', '40240']],
        ['other', ['40241', '40242']],
        ['payment_gateway', ['40706']],
        ['bank_fees', ['40756', '40757', '40758', '40759']],
        ['other', ['40378', '40761']],
        ['ads', ['40127', '40128', '40129', '40130', '40131', '40132', '40133', '40134', '40984']],
      ]

      for (const [expectedClass, codes] of expectedCodeGroups) {
        for (const code of codes) {
          const acc = mustDumpAccount(code)
          expect(
            classifyPlatformExpenseAccount(acc.code, acc.name, acc.account_type),
            `account ${code} (${acc.name})`,
          ).toBe(expectedClass)
        }
      }

      // Word-safe `Carriage` vs `\bcari\b` + explicit Carriage Commission
      expect(/\bcari\b/i.test('Carriage Company')).toBe(false)
      expect(/\bcari\b/i.test('Cari Commission')).toBe(true)
      expect(PLATFORM_TOKEN_RE.test('Carriage Company')).toBe(true)
      expect(classifyPlatformExpenseAccount('40866', 'Carriage Company', 'expense')).not.toBe(
        'platform_commission',
      )
      expect(classifyPlatformExpenseAccount('40866', 'Carriage Company', 'expense')).toBe('other')
      expect(classifyPlatformExpenseAccount('40866', 'Caricature Commission', 'expense')).toBe('other')
      expect(
        classifyPlatformExpenseAccount(
          '40866',
          'Carriage Commission - China Garden China Gardenعمولة شركة كاريدج ــ',
          'expense',
        ),
      ).toBe('platform_commission')

      // Non-`expense` account types always return 'other'
      for (const nonExpenseType of [
        'income',
        'income_other',
        'expense_direct_cost',
        'expense_depreciation',
        'asset_receivable',
        'liability_payable',
      ]) {
        expect(classifyPlatformExpenseAccount('40811', 'Talabat Commission', nonExpenseType)).toBe(
          'other',
        )
      }

      // Exact snapshot of accounts whose classification changed vs legacyIsDeliveryCommissionGlAccount
      expect(changedAccounts).toEqual([
        {
          code: '40224',
          name: 'Subscriptions - Talabat Contracts اشتراكات ــ عقود شركة طلبات',
          legacy: true,
          newClass: 'platform_subscription',
        },
        {
          code: '40225',
          name: 'Subscriptions - Deliveroo Contracts اشتراكات ــ عقود شركة ديليفرو',
          legacy: true,
          newClass: 'platform_subscription',
        },
        {
          code: '40228',
          name: 'Subscription - Bibayt Contract اشتراك ــ عقد شركة بالبيت السنوي',
          legacy: true,
          newClass: 'platform_subscription',
        },
        {
          code: '40231',
          name: 'The Cost Of The Order Delivery Service - Cary Company تكلفة خدمة توصيل اوردار ــ شركة كاري',
          legacy: true,
          newClass: 'third_party_delivery',
        },
        {
          code: '40232',
          name: 'The Cost Of The Order Delivery Service - Armada Company تكلفة خدمة توصيل اوردار ــ شركة ارمادا',
          legacy: true,
          newClass: 'third_party_delivery',
        },
        {
          code: '40233',
          name: 'The Cost Of The Order Delivery Service - Wiyak Company تكلفة خدمة توصيل اوردار ــ شركة وياك',
          legacy: true,
          newClass: 'third_party_delivery',
        },
        {
          code: '40378',
          name: 'Office Commission عمولة مكتب',
          legacy: true,
          newClass: 'other',
        },
        {
          code: '40706',
          name: 'Hesabe Commission عمولة شركة حسابي',
          legacy: true,
          newClass: 'payment_gateway',
        },
        {
          code: '40756',
          name: 'Bank Commission عمولة بنكية',
          legacy: true,
          newClass: 'bank_fees',
        },
        {
          code: '40757',
          name: 'Bank Commission - Central Kitchen عمولة بنكية - المطبخ المركزي',
          legacy: true,
          newClass: 'bank_fees',
        },
        {
          code: '40758',
          name: 'Bank Commission - Management عمولة بنكية - الادارة',
          legacy: true,
          newClass: 'bank_fees',
        },
        {
          code: '40759',
          name: 'Bank Commission - Call Center عمولة بنكية - الكول سنتر',
          legacy: true,
          newClass: 'bank_fees',
        },
        {
          code: '40761',
          name: 'Commissions & Brokerage عمولات & سمسرة',
          legacy: true,
          newClass: 'other',
        },
      ])
    })
  })

  describe('§F(h) Excluded entities (IDs 24, 25, 39, 40 / decommissioned names) never appear in Trial Balance, Balance Sheet, Budget lines, or Analytic Breakdown', () => {
    it('filters excluded POS IDs (24, 25, 39, 40), excluded analytic IDs, and decommissioned names out of Trial Balance, Balance Sheet, Budget lines, and Analytic Breakdown', async () => {
      // Excluded POS config IDs (24, 25, 39, 40) remain strictly rejected
      for (const excludedPosId of [24, 25, 39, 40]) {
        expect(companyPosConfigAllowed(excludedPosId, `Terminal ${excludedPosId}`, true)).toBe(false)
      }

      // Real excluded accounts from venturefoods_odoo_cids1_dump.json
      const exclCashQurain = mustDumpAccount('10106')
      const exclCashJahra = mustDumpAccount('10114')
      const exclRevQurain = mustDumpAccount('50406')
      const exclRevHeisenberg = mustDumpAccount('9950473')
      const exclExpQurain = mustDumpAccount('40322')

      // Active real accounts
      const activeCash = mustDumpAccount('10001')
      const activeCapital = mustDumpAccount('30001')
      const activeRev = mustDumpAccount('50001')

      for (const excl of [exclCashQurain, exclCashJahra, exclRevQurain, exclRevHeisenberg, exclExpQurain]) {
        expect(isExcludedOdooEntity(`${excl.code} ${excl.name}`)).toBe(true)
      }

      // 1. Trial Balance strips excluded accounts
      const tbMap = new Map(
        [activeCash, activeCapital, activeRev, exclCashQurain, exclRevQurain, exclRevHeisenberg, exclExpQurain].map(
          (a) => [a.id, a],
        ),
      )
      const tb = buildGlTrialBalanceFromGroups({
        fromIso: '2026-10-01',
        toInclusiveIso: '2026-10-31',
        accountById: tbMap,
        rows: [
          { account_id: [activeCash.id, activeCash.name], debit: 150, credit: 0, balance: 150, __count: 2 },
          { account_id: [activeCapital.id, activeCapital.name], debit: 0, credit: 100, balance: -100, __count: 1 },
          { account_id: [activeRev.id, activeRev.name], debit: 0, credit: 50, balance: -50, __count: 1 },
          { account_id: [exclCashQurain.id, exclCashQurain.name], debit: 999, credit: 0, balance: 999, __count: 3 },
          { account_id: [exclRevHeisenberg.id, exclRevHeisenberg.name], debit: 0, credit: 999, balance: -999, __count: 3 },
        ],
      })
      expect(tb.rows.map((r) => r.code)).toEqual([activeCash.code, activeCapital.code, activeRev.code])
      expect(tb.totalDebitKwd).toBe(150)
      expect(tb.totalCreditKwd).toBe(150)

      // 2. Balance Sheet strips excluded BS & P&L accounts
      const bs = buildGlBalanceSheetFromGroups({
        asOfIso: '2026-10-31',
        fiscalYearStartIso: '2026-01-01',
        balanceAccounts: [activeCash, activeCapital, exclCashQurain, exclCashJahra],
        balanceRows: [
          { account_id: [activeCash.id, activeCash.name], debit: 150, credit: 0, balance: 150, __count: 2 },
          { account_id: [activeCapital.id, activeCapital.name], debit: 0, credit: 100, balance: -100, __count: 1 },
          { account_id: [exclCashQurain.id, exclCashQurain.name], debit: 800, credit: 0, balance: 800, __count: 1 },
          { account_id: [exclCashJahra.id, exclCashJahra.name], debit: 700, credit: 0, balance: 700, __count: 1 },
        ],
        ytdPnlAccountById: new Map([
          [activeRev.id, activeRev],
          [exclRevHeisenberg.id, exclRevHeisenberg],
          [exclExpQurain.id, exclExpQurain],
        ]),
        ytdPnlRows: [
          { account_id: [activeRev.id, activeRev.name], debit: 0, credit: 50, balance: -50, __count: 1 },
          { account_id: [exclRevHeisenberg.id, exclRevHeisenberg.name], debit: 0, credit: 400, balance: -400, __count: 1 },
          { account_id: [exclExpQurain.id, exclExpQurain.name], debit: 200, credit: 0, balance: 200, __count: 1 },
        ],
      })
      expect(bs.assetsTotalKwd).toBe(150)
      expect(bs.currentYearEarningsKwd).toBe(50)
      expect(bs.equationBalanced).toBe(true)
      expect(JSON.stringify(bs)).not.toMatch(/qurain|jahra|heisenberg|القرين|الجهراء|هايزن/i)

      // 3. Budget probe strips decommissioned analytic names
      const budgetProbe = await probeCrossoveredBudget({
        fromIso: '2026-01-01',
        toInclusiveIso: '2026-10-31',
        executeOdoo: makeExecuteOdoo(async (model, method) => {
          if (model === 'ir.model' && method === 'search_read') {
            return [{ id: 1, model: 'crossovered.budget' }]
          }
          if (model === 'crossovered.budget' && method === 'check_access_rights') {
            return true
          }
          if (model === 'crossovered.budget.lines' && method === 'search_read') {
            return [
              {
                general_budget_id: [1, 'FY2026 Operating'],
                analytic_account_id: [114, 'The Avenues'],
                planned_amount: 300,
                practical_amount: 280,
              },
              {
                general_budget_id: [1, 'FY2026 Operating'],
                analytic_account_id: [24, 'Decommissioned Qurain Warehouse'],
                planned_amount: 500,
                practical_amount: 450,
              },
              {
                general_budget_id: [1, 'FY2026 Operating'],
                analytic_account_id: [25, 'Jahra Closed Branch'],
                planned_amount: 500,
                practical_amount: 450,
              },
              {
                general_budget_id: [1, 'FY2026 Operating'],
                analytic_account_id: [94, 'Heisenberg Kitchen'],
                planned_amount: 500,
                practical_amount: 450,
              },
            ]
          }
          return []
        }),
      })
      expect(budgetProbe.lines.map((l) => l.analyticName)).toEqual(['The Avenues'])

      // 4. Analytic Breakdown excludes excluded IDs (registry excludedBranchAnalyticIds + 24, 25, 39, 40) and decommissioned names
      const excludedIds = [...(posRegistry.excludedBranchAnalyticIds ?? []), 24, 25, 39, 40]
      let capturedAnalyticDomain = ''
      const analytic = await fetchGlAnalyticBreakdown({
        fromIso: '2026-10-01',
        toInclusiveIso: '2026-10-31',
        totalPnlNetKwd: 100,
        totalPnlAbsKwd: 100,
        excludedAnalyticIds: excludedIds,
        executeOdoo: makeExecuteOdoo(async (model, method, args) => {
          if (model === 'ir.model' && method === 'search_read') {
            return [{ id: 1, model: 'account.analytic.line' }]
          }
          if (model === 'account.analytic.line' && method === 'check_access_rights') {
            return true
          }
          if (model === 'account.analytic.line' && method === 'read_group') {
            capturedAnalyticDomain = JSON.stringify(args?.[0] ?? [])
            return [
              { account_id: [114, 'The Avenues'], amount: 75 },
              { account_id: [24, 'Decommissioned 24'], amount: 900 },
              { account_id: [25, 'Closed 25'], amount: 800 },
              { account_id: [39, 'Closed 39'], amount: 700 },
              { account_id: [40, 'Closed 40'], amount: 600 },
              { account_id: [94, 'Heisenberg'], amount: 500 },
              { account_id: [120, 'فرع القرين'], amount: 400 },
              { account_id: [121, 'Jahra Branch'], amount: 300 },
              { account_id: [122, 'Hawally Restaurant'], amount: 200 },
            ]
          }
          return []
        }),
      })

      for (const id of [24, 25, 39, 40, ...(posRegistry.excludedBranchAnalyticIds ?? [])]) {
        expect(capturedAnalyticDomain).toContain(String(id))
      }
      expect(analytic.readable).toBe(true)
      expect(analytic.populated).toBe(true)
      expect(analytic.branches.map((b) => b.analyticName)).toEqual(['The Avenues'])
      expect(analytic.unallocatedKwd).toBe(25)
    })
  })
})
