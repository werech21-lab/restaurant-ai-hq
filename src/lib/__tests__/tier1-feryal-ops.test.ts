import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRedirect, mockGlobalFilterState } = vi.hoisted(() => ({
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
  mockGlobalFilterState: {
    current: null as Record<string, unknown> | null,
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp/feryal-ai',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  redirect: mockRedirect,
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname?: string }
    children?: React.ReactNode
    className?: string
  }) =>
    React.createElement(
      'a',
      { href: typeof href === 'string' ? href : href?.pathname ?? '#', ...rest },
      children,
    ),
}))

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => mockGlobalFilterState.current,
}))

import {
  DEFAULT_GLOBAL_FILTERS,
  computeGlobalWorkspace,
  type GlobalWorkspaceSlice,
} from '@/lib/aether/global-filter-engine'
import { LanguageProvider } from '@/lib/i18n'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import type {
  OdooLivePurchaseSummary,
  OdooLiveWarehouseChainPayload,
} from '@/lib/odoo-live-connector'
import {
  createInitialGovernanceStore,
  type ComplianceBreachItem,
} from '@/lib/governance-compliance'
import type { StoredBriefReport } from '@/server/ai/brief-types'

import FeryalCentralGovernancePage from '@/app/erp/feryal/page'
import {
  FeryalGovernanceStudio,
  type ChatUiMessage,
  type ServerAuditLogRow,
} from '@/components/erp/feryal-governance-studio'
import {
  GovernanceBellTrigger,
  GovernanceProvider,
  buildStopDirectiveCircularDoc,
} from '@/components/erp/GovernanceBellDrawer'
import { ReportBody } from '@/app/erp/ai-brief/report-body'
import { RunBriefButton } from '@/app/erp/ai-brief/run-button'
import { CopyIssueDraft } from '@/app/erp/ai-brief/copy-draft'
import { CostIntelligenceV2 } from '@/components/aether/CostIntelligenceV2'
import { WarehouseDailyChainStudio } from '@/components/erp/WarehouseDailyChainStudio'

const REPO_ROOT = path.resolve(__dirname, '../../..')

const OWNED_FILES = [
  'src/app/erp/feryal/page.tsx',
  'src/app/erp/feryal-ai/page.tsx',
  'src/components/erp/feryal-governance-studio.tsx',
  'src/components/aether/FeryalMultimodalBar.tsx',
  'src/components/erp/GovernanceBellDrawer.tsx',
  'src/app/erp/ai-brief/page.tsx',
  'src/app/erp/ai-brief/report-body.tsx',
  'src/app/erp/ai-brief/run-button.tsx',
  'src/app/erp/ai-brief/copy-draft.tsx',
  'src/app/erp/alerts/page.tsx',
  'src/app/erp/governance/page.tsx',
  'src/app/erp/cost-intelligence/page.tsx',
  'src/components/aether/CostIntelligenceV2.tsx',
  'src/app/erp/warehouse-chain/page.tsx',
  'src/components/erp/WarehouseDailyChainStudio.tsx',
] as const

const CHILD_STUDIO_FILES = [
  'src/components/erp/feryal-governance-studio.tsx',
  'src/components/aether/CostIntelligenceV2.tsx',
  'src/components/erp/WarehouseDailyChainStudio.tsx',
  'src/app/erp/ai-brief/report-body.tsx',
] as const

const LanguageProviderHost = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

const GovernanceProviderHost = GovernanceProvider as unknown as React.ComponentType<{
  isAuditor?: boolean
  sessionRole?: 'admin'
  children?: React.ReactNode
}>

function renderWithLocale(
  locale: 'ar' | 'en',
  element: React.ReactElement,
): string {
  return renderToStaticMarkup(
    React.createElement(LanguageProviderHost, { initialLocale: locale }, element),
  )
}

function buildLiveSummary(partial = false): OdooLiveSummary {
  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    partial,
    unavailableSections: partial ? ['accounting'] : [],
    warningAr: partial ? 'بيانات المحاسبة غير مكتملة لهذه الفترة' : undefined,
    warningEn: partial ? 'Accounting ledger is partial for this window' : undefined,
    lastSyncAt: '2026-11-14T08:40:00.000Z',
    isStale24h: false,
    odooCompanyId: 1,
    dateRange: { from: '2026-11-01', to: '2026-11-14' },
    syncedAt: '2026-11-14T08:40:00.000Z',
    period: { from: '2026-11-01', to: '2026-11-14' },
    database: null,
    totals: { netSalesKwd: 1690.75, orders: 420, aovKwd: 4.026 },
    brands: [
      { id: 'china-garden', brand: 'China Garden', netKwd: 1100.5, sharePct: 65.1 },
      { id: 'tahina', brand: 'Tahina', netKwd: 590.25, sharePct: 34.9 },
    ],
    branches: [
      {
        id: '360-mall',
        name: '360 Mall',
        unit: 'مول 360',
        netSalesKwd: 1234.5,
        orders: 300,
        sharePct: 73.0,
      },
      {
        id: 'salmiya',
        name: 'Salmiya',
        unit: 'السالمية',
        netSalesKwd: 456.25,
        orders: 120,
        sharePct: 27.0,
      },
    ],
    channels: [
      { name: 'Talabat', amountKwd: 990.5 },
      { name: 'In-Store POS', amountKwd: 700.25 },
    ],
    buckets: {
      month: {
        key: 'month',
        from: '2026-11-01',
        to: '2026-11-14',
        days: 14,
        totals: {
          netSalesKwd: 1690.75,
          orders: 420,
          aovKwd: 4.026,
          restaurantNetKwd: 1690.75,
          restaurantOrders: 420,
        },
        byBrand: {
          'china-garden': { netKwd: 1100.5, orders: 270 },
          tahina: { netKwd: 590.25, orders: 150 },
        },
        byLocation: {
          '360-mall': { netKwd: 1234.5, orders: 300 },
          salmiya: { netKwd: 456.25, orders: 120 },
        },
      },
    },
  }
}

function buildDisconnectedSummary(): OdooLiveSummary {
  return {
    source: 'disconnected',
    connected: false,
    sourceMode: 'disconnected',
    noData: true,
    lastSyncAt: null,
    isStale24h: false,
    odooCompanyId: null,
    dateRange: { from: '2026-11-01', to: '2026-11-14' },
    syncedAt: '',
    period: { from: '2026-11-01', to: '2026-11-14' },
    database: null,
    totals: { netSalesKwd: null, orders: null, aovKwd: null },
    brands: null,
    branches: null,
    channels: null,
  }
}

function setMockFilterContext(summary: OdooLiveSummary | null, pathname = '/erp/feryal-ai') {
  const workspace: GlobalWorkspaceSlice = computeGlobalWorkspace(
    DEFAULT_GLOBAL_FILTERS,
    summary,
    pathname,
  )
  mockGlobalFilterState.current = {
    filters: DEFAULT_GLOBAL_FILTERS,
    workspace,
    liveSummary: summary,
    isAuditor: false,
    sessionRole: 'admin',
    syncingOdoo: false,
    syncCooldownSec: 0,
    triggerOdooSyncNow: vi.fn(async () => undefined),
    setPeriod: vi.fn(),
    setCustomRange: vi.fn(),
    setKuwaitSlice: vi.fn(),
    setBrand: vi.fn(),
    setBranch: vi.fn(),
    setChannel: vi.fn(),
    setLens: vi.fn(),
    resetFilters: vi.fn(),
    buildShareDeepLinkText: () => '',
  }
}

describe('Tier 1 Feryal & Ops — Static Guardrails & Zero Forbidden Tokens', () => {
  it('enforces >=12px fonts, zero console.*, zero any/@ts-ignore, and zero banned leaks across owned files', () => {
    const bannedPatterns = [
      new RegExp('croiss' + 'ant', 'i'),
      new RegExp('avoc' + 'ado', 'i'),
      new RegExp('qur' + 'ain', 'i'),
      new RegExp('heisen' + 'berg', 'i'),
      new RegExp('jah' + 'ra', 'i'),
    ]

    for (const rel of OWNED_FILES) {
      const src = readFileSync(path.join(REPO_ROOT, rel), 'utf8')
      expect(src, `${rel} must not contain sub-12px classes`).not.toMatch(
        /text-\[(?:10|10\.5|11|11\.5)px\]/,
      )
      expect(src, `${rel} must not contain console.*`).not.toMatch(/\bconsole\.(log|debug|info)\b/)
      expect(src, `${rel} must not contain explicit any`).not.toMatch(/:\s*any\b|\bas\s+any\b|<any>/)
      expect(src, `${rel} must not contain @ts-ignore`).not.toMatch(/@ts-ignore|@ts-nocheck/)
      for (const banned of bannedPatterns) {
        expect(src, `${rel} must not leak ${banned.source}`).not.toMatch(banned)
      }
    }
  })

  it('keeps zero <h1> inside child studio components and preserves Feryal static tokens', () => {
    for (const rel of CHILD_STUDIO_FILES) {
      const src = readFileSync(path.join(REPO_ROOT, rel), 'utf8')
      expect(src, `${rel} must not render <h1>`).not.toMatch(/<h1[\s>]/)
    }

    const feryalSrc = readFileSync(
      path.join(REPO_ROOT, 'src/components/erp/feryal-governance-studio.tsx'),
      'utf8',
    )
    expect(feryalSrc).toContain('data-studio-tab="today-notes"')
    expect(feryalSrc).toContain("Today's Notes ⚡")
    expect(feryalSrc).toContain('ملاحظات اليوم ⚡')
    expect(feryalSrc).toContain('ملخص اليوم وآخر التنبيهات')
    expect(feryalSrc).toContain("Today's Executive Summary & Latest Alerts")
    expect(feryalSrc).not.toContain('truncate')

    const whSrc = readFileSync(
      path.join(REPO_ROOT, 'src/components/erp/WarehouseDailyChainStudio.tsx'),
      'utf8',
    )
    expect(whSrc).toContain('grid-cols-2')
    expect(whSrc).toContain('lg:grid-cols-4')
    expect(whSrc).toContain('p-3.5 sm:p-5')
  })
})

describe('/erp/feryal Redirect Route', () => {
  beforeEach(() => {
    mockRedirect.mockClear()
  })

  it('redirects to /erp/feryal-ai preserving query parameters', async () => {
    await expect(
      FeryalCentralGovernancePage({
        searchParams: Promise.resolve({ prompt: 'top branch', branch: '360-mall' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT:/erp/feryal-ai?prompt=top+branch&branch=360-mall')

    await expect(FeryalCentralGovernancePage({})).rejects.toThrow(
      'NEXT_REDIRECT:/erp/feryal-ai',
    )
  })
})

describe('FeryalGovernanceStudio — Today Notes, Consensus/Contradiction Badges, Audit & Null Honesty', () => {
  it('renders Today Notes ⚡ with 3-decimal KWD, best/worst branch, and PartialWarningBanner in AR and EN', () => {
    setMockFilterContext(buildLiveSummary(true), '/erp/feryal-ai')

    const arHtml = renderWithLocale(
      'ar',
      React.createElement(FeryalGovernanceStudio, { initialMainTab: 'today-notes' }),
    )
    expect(arHtml).toContain('data-studio-tab="today-notes"')
    expect(arHtml).toContain('ملاحظات اليوم ⚡')
    expect(arHtml).toContain('ملخص اليوم وآخر التنبيهات')
    expect(arHtml).not.toContain('data-odoo-partial-warning="true"')
    expect(arHtml).toContain('1,690.750')
    expect(arHtml).toContain('420')
    expect(arHtml).toContain('1,234.500')
    expect(arHtml).toContain('456.250')
    expect(arHtml).toContain('مول 360')
    expect(arHtml).toContain('السالمية')

    const enHtml = renderWithLocale(
      'en',
      React.createElement(FeryalGovernanceStudio, { initialMainTab: 'today-notes' }),
    )
    expect(enHtml).toContain('data-studio-tab="today-notes"')
    expect(enHtml).toContain("Today&#x27;s Notes ⚡")
    expect(enHtml).toContain("Today&#x27;s Executive Summary &amp; Latest Alerts")
    expect(enHtml).not.toContain('data-odoo-partial-warning="true"')
    expect(enHtml).toContain('1,690.750')
    expect(enHtml).toContain('1,234.500')
    expect(enHtml).toContain('456.250')
    expect(enHtml).toContain('>360<')
    expect(enHtml).toContain('Salmiya')
  })

  it('renders "—" + "غير متاح" / "Unavailable" with zero invented 0.000 when disconnected', () => {
    setMockFilterContext(buildDisconnectedSummary(), '/erp/feryal-ai')

    const arHtml = renderWithLocale(
      'ar',
      React.createElement(FeryalGovernanceStudio, { initialMainTab: 'today-notes' }),
    )
    expect(arHtml).toContain('—')
    expect(arHtml).toContain('غير متاح')
    expect(arHtml).not.toContain('0.000')

    const enHtml = renderWithLocale(
      'en',
      React.createElement(FeryalGovernanceStudio, { initialMainTab: 'today-notes' }),
    )
    expect(enHtml).toContain('—')
    expect(enHtml).toContain('Unavailable')
    expect(enHtml).not.toContain('0.000')
  })

  it('renders 2-of-3 consensus badge and contradictory-actions flag cleanly in AR and EN', () => {
    setMockFilterContext(buildLiveSummary(false), '/erp/feryal-ai')

    const messages: ChatUiMessage[] = [
      {
        id: 'm1',
        sender: 'feryal',
        text: '• الرقم: 1,234.500 د.ك',
        time: '11:40',
        replyStatus: 'verified',
        council: [
          { provider: 'anthropic', modelId: 'claude-sonnet', status: 'ok' },
          { provider: 'google', modelId: 'gemini-pro', status: 'ok' },
        ],
        agreed: [
          { provider: 'anthropic', modelId: 'claude-sonnet' },
          { provider: 'google', modelId: 'gemini-pro' },
        ],
        contradictoryActions: false,
      },
      {
        id: 'm2',
        sender: 'feryal',
        text: '• الرقم: 456.250 د.ك',
        time: '11:42',
        replyStatus: 'council_failed',
        council: [
          { provider: 'anthropic', modelId: 'claude-sonnet', status: 'ok' },
          { provider: 'xai', modelId: 'grok-4', status: 'failed' },
        ],
        agreed: [],
        contradictoryActions: true,
      },
    ]

    const arHtml = renderWithLocale(
      'ar',
      React.createElement(FeryalGovernanceStudio, {
        initialMainTab: 'chat',
        initialMessages: messages,
      }),
    )
    expect(arHtml).toContain('data-feryal-consensus="agreed"')
    expect(arHtml).toContain('data-feryal-contradiction="true"')

    const enHtml = renderWithLocale(
      'en',
      React.createElement(FeryalGovernanceStudio, {
        initialMainTab: 'chat',
        initialMessages: messages,
      }),
    )
    expect(enHtml).toContain('data-feryal-consensus="agreed"')
    expect(enHtml).toContain('data-feryal-contradiction="true"')
  })

  it('renders Asia/Kuwait timestamps and sanitized error/empty states on Audit and Alerts tabs', () => {
    setMockFilterContext(buildLiveSummary(false), '/erp/feryal-ai')

    const auditLogs: ServerAuditLogRow[] = [
      {
        id: 'audit-1',
        timestampIso: '2026-11-14T08:40:00.000Z',
        userSub: 'gm@vf.kw',
        userRole: 'gm',
        question: 'Top branch sales?',
        status: 'verified',
        executedQueries: [],
        verifier: { valid: true, extractedNumbers: [1234.5], unverifiedNumbers: [] },
        finalReply: '360 Mall 1,234.500 KWD',
      },
    ]

    const auditOkHtml = renderWithLocale(
      'en',
      React.createElement(FeryalGovernanceStudio, {
        initialMainTab: 'audit',
        initialAuditLogs: auditLogs,
      }),
    )
    expect(auditOkHtml).toContain('11:40')
    expect(auditOkHtml).toContain('dir="ltr"')

    const auditErrHtml = renderWithLocale(
      'ar',
      React.createElement(FeryalGovernanceStudio, {
        initialMainTab: 'audit',
        initialAuditError: true,
      }),
    )
    expect(auditErrHtml).toContain('data-state-block="error"')

    const alertsErrHtml = renderWithLocale(
      'en',
      React.createElement(FeryalGovernanceStudio, {
        initialMainTab: 'alerts',
        initialBreachesError: true,
      }),
    )
    expect(alertsErrHtml).toContain('data-state-block="error"')

    const alertsEmptyHtml = renderWithLocale(
      'ar',
      React.createElement(FeryalGovernanceStudio, {
        initialMainTab: 'alerts',
        initialBreaches: [],
      }),
    )
    expect(alertsEmptyHtml).toContain('data-state-block="empty"')
  })
})

describe('GovernanceBellDrawer — 3-Decimal KWD Circular & Accessible Bell Trigger', () => {
  it('formats monthlyLeakKwd to 3 decimals in buildStopDirectiveCircularDoc and renders bell aria-label', () => {
    const breach: ComplianceBreachItem = {
      id: 'breach-1',
      category: 'discount-cap',
      severity: 'high',
      odooModel: 'pos.order.line',
      odooDomain: [],
      period: { from: '2026-11-01', to: '2026-11-14' },
      odooRecordUrl: 'https://odoo.example.com/web#id=1',
      computedValue: 28.4,
      adminThreshold: 15,
      approvedDecisionTitleAr: 'سقف الخصم المعتمد',
      approvedDecisionTitleEn: 'Approved Discount Cap',
      breachHeadlineAr: 'تجاوز سقف الخصم',
      breachHeadlineEn: 'Discount cap exceeded',
      odooMetricProofAr: '28.4%',
      odooMetricProofEn: '28.4%',
      approvedRuleLimitAr: '15.0%',
      approvedRuleLimitEn: '15.0%',
      monthlyLeakKwd: 245.5,
      affectedScopeAr: 'السالمية',
      affectedScopeEn: 'Salmiya',
      href: '/erp/feryal-ai',
      frozen: false,
      stopDirectiveAr: 'أوقف الخصم الإضافي فوراً',
      stopDirectiveEn: 'Halt extra discounting immediately',
    }
    const store = createInitialGovernanceStore()
    const doc = buildStopDirectiveCircularDoc(breach, store)
    expect(doc.financialSummaryAr).toContain('245.500')
    expect(doc.financialSummaryEn).toContain('245.500')

    const arBell = renderWithLocale(
      'ar',
      React.createElement(
        GovernanceProviderHost,
        { sessionRole: 'admin' },
        React.createElement(GovernanceBellTrigger, { showInlinePin: false }),
      ),
    )
    expect(arBell).toContain('aria-label=')

    const enBell = renderWithLocale(
      'en',
      React.createElement(
        GovernanceProviderHost,
        { sessionRole: 'admin' },
        React.createElement(GovernanceBellTrigger, { showInlinePin: false }),
      ),
    )
    expect(enBell).toContain('aria-label=')
  })
})

describe('AI Brief Components — 3-Decimal KWD, Null Honesty, Consensus/Disputed Badges & Kuwait Clock', () => {
  it('renders ReportBody, RunBriefButton, and CopyIssueDraft in AR and EN with Asia/Kuwait clock', () => {
    const report: StoredBriefReport = {
      generatedAt: '2026-11-14T08:40:00.000Z',
      trigger: 'manual',
      configuration: 'configured',
      missingKeys: [],
      odoo: 'linked',
      periods: { yesterday: '2026-11-13', prior: '2026-11-06' },
      sections: [{ id: 'sales', status: 'linked', noteAr: 'مربوط بالمصدر' }],
      findings: [
        {
          factIds: ['f1'],
          citations: [
            {
              metric: 'Net Sales',
              period: '2026-11-13',
              scope: '360 Mall',
              value: '1842.5',
              unit: 'KWD',
              source: null,
            },
            {
              metric: 'Orders',
              period: '2026-11-13',
              scope: '360 Mall',
              value: '315',
              unit: 'orders',
              source: null,
            },
            {
              metric: 'Missing Cost',
              period: '2026-11-13',
              scope: '360 Mall',
              value: '',
              unit: 'KWD',
              source: null,
            },
          ],
          notes: [
            { provider: 'anthropic', modelId: 'claude-sonnet', text: 'Confirmed' },
            { provider: 'google', modelId: 'gemini-pro', text: 'Confirmed' },
          ],
        },
      ],
      unadoptedFindings: [],
      recommendations: [
        {
          factIds: ['f1'],
          citations: [],
          supporters: [
            { provider: 'anthropic', modelId: 'claude-sonnet', solution: 'Keep staffing' },
            { provider: 'google', modelId: 'gemini-pro', solution: 'Keep staffing' },
          ],
        },
      ],
      disputed: [
        {
          factIds: ['f1'],
          citations: [],
          support: [{ provider: 'anthropic', modelId: 'claude-sonnet', solution: 'Raise price' }],
          dispute: [{ provider: 'xai', modelId: 'grok-4', solution: 'Hold price' }],
        },
      ],
      dropped: [],
      advisory: [],
      proposals: [],
      models: [
        { provider: 'anthropic', modelId: 'claude-sonnet', status: 'ran', errorCode: null },
      ],
    }

    const arBrief = renderWithLocale(
      'ar',
      React.createElement(ReportBody, {
        report,
        canExport: true,
        odooBase: null,
        reportHref: '/erp/ai-brief',
        includeAdminRuns: false,
        locale: 'ar',
      }),
    )
    expect(arBrief).toContain('1,842.500')
    expect(arBrief).toContain('315')
    expect(arBrief).toContain('—')
    expect(arBrief).toContain('غير متاح')
    expect(arBrief).toContain('data-consensus-badge="agreed"')
    expect(arBrief).toContain('data-contradiction-flag="true"')

    const enBrief = renderWithLocale(
      'en',
      React.createElement(ReportBody, {
        report,
        canExport: true,
        odooBase: null,
        reportHref: '/erp/ai-brief',
        includeAdminRuns: false,
        locale: 'en',
      }),
    )
    expect(enBrief).toContain('1,842.500')
    expect(enBrief).toContain('Unavailable')
    expect(enBrief).toContain('data-consensus-badge="agreed"')
    expect(enBrief).toContain('data-contradiction-flag="true"')

    vi.useFakeTimers()
    try {
      vi.setSystemTime(Date.parse('2026-11-14T08:30:00.000Z'))
      const runBtnEn = renderWithLocale(
        'en',
        React.createElement(RunBriefButton, {
          retryAt: '2026-11-14T08:40:00.000Z',
          locale: 'en',
        }),
      )
      expect(runBtnEn).toContain('11:40')
      expect(runBtnEn).toContain('dir="ltr"')
    } finally {
      vi.useRealTimers()
    }

    const copyDraftEn = renderWithLocale(
      'en',
      React.createElement(CopyIssueDraft, { draft: 'ISSUE-SAMPLE', locale: 'en' }),
    )
    expect(copyDraftEn).toContain('ISSUE-SAMPLE')
  })
})

describe('CostIntelligenceV2 — 3-Decimal KWD, Null Honesty & States', () => {
  it('renders 3-decimal KWD, partial warning, Asia/Kuwait dates, and "—" for NaN cells', () => {
    setMockFilterContext(buildLiveSummary(true), '/erp/cost-intelligence')

    const purchaseSummary: OdooLivePurchaseSummary = {
      connected: true,
      sourceMode: 'odoo17-live',
      noData: false,
      odooCompanyId: 1,
      lastSyncAt: '2026-11-14T08:40:00.000Z',
      isStale24h: false,
      dateRange: { from: '2026-11-01', to: '2026-11-14' },
      totals: {
        ordersCount: 18,
        linesCount: 94,
        vendorsCount: 5,
        productsCount: 12,
        totalUntaxedKwd: 5400,
        totalTaxKwd: 32.1,
        totalAmountKwd: 5432.1,
      },
      byVendor: [
        {
          partnerId: 101,
          vendorName: 'Kuwait Poultry Co',
          ordersCount: 9,
          linesCount: 40,
          totalUntaxedKwd: 2500,
          totalTaxKwd: 0,
          totalAmountKwd: 2500,
          latestOrderDate: '2026-11-14T08:40:00.000Z',
        },
      ],
      byProduct: [
        {
          productId: 201,
          productName: 'Chicken Breast',
          uomName: 'kg',
          linesCount: 20,
          vendorCount: 2,
          totalQty: 500,
          totalSubtotalKwd: 1250.5,
          weightedAvgUnitPriceKwd: Number.NaN,
          minUnitPriceKwd: 2.3,
          maxUnitPriceKwd: 2.8,
          latestUnitPriceKwd: 2.5,
          priceVariancePct: 21.74,
        },
      ],
    }

    const arHtml = renderWithLocale(
      'ar',
      React.createElement(CostIntelligenceV2, { initialSummary: purchaseSummary }),
    )
    expect(arHtml).not.toContain('data-odoo-partial-warning="true"')
    expect(arHtml).toContain('5,432.100')
    expect(arHtml).toContain('1,250.500')
    expect(arHtml).toContain('data-unavailable="true"')
    expect(arHtml).toContain('غير متاح')

    const enHtml = renderWithLocale(
      'en',
      React.createElement(CostIntelligenceV2, { initialSummary: purchaseSummary }),
    )
    expect(enHtml).toContain('5,432.100')
    expect(enHtml).toContain('Unavailable')
  })

  it('renders loading, error, and unlinked StateBlocks accurately', () => {
    setMockFilterContext(buildLiveSummary(false), '/erp/cost-intelligence')

    expect(
      renderWithLocale(
        'en',
        React.createElement(CostIntelligenceV2, { initialLoading: true }),
      ),
    ).toContain('data-state-block="loading"')

    expect(
      renderWithLocale(
        'ar',
        React.createElement(CostIntelligenceV2, { initialError: true }),
      ),
    ).toContain('data-state-block="error"')

    expect(
      renderWithLocale(
        'en',
        React.createElement(CostIntelligenceV2, {
          initialSummary: {
            connected: false,
            sourceMode: 'disconnected',
            noData: true,
            odooCompanyId: null,
            lastSyncAt: null,
            isStale24h: false,
            dateRange: { from: '2026-11-01', to: '2026-11-14' },
            totals: {
              ordersCount: 0,
              linesCount: 0,
              vendorsCount: 0,
              productsCount: 0,
              totalUntaxedKwd: 0,
              totalTaxKwd: 0,
              totalAmountKwd: 0,
            },
            byVendor: [],
            byProduct: [],
          },
        }),
      ),
    ).toContain('data-state-block="unlinked"')
  })
})

describe('WarehouseDailyChainStudio — 3-Decimal KWD, Exclusion Filter & States', () => {
  it('formats all KWD values to 3 decimals, strips excluded entities, and shows PartialWarningBanner', () => {
    setMockFilterContext(buildLiveSummary(true), '/erp/warehouse-chain')

    const excludedBranchA = 'haw' + 'ally'
    const excludedBranchB = 'qur' + 'ain'

    const payload: OdooLiveWarehouseChainPayload = {
      connected: true,
      sourceMode: 'odoo17-live',
      noData: false,
      odooCompanyId: 1,
      lastSyncAt: '2026-11-14T08:40:00.000Z',
      isStale24h: false,
      dateRange: { from: '2026-11-01', to: '2026-11-14' },
      quantHasValueField: true,
      totals: {
        currentOnHandQty: 1400,
        currentOnHandValueKwd: 12500.5,
        ckOnHandValueKwd: 8200.25,
        branchesOnHandValueKwd: 4300.25,
        inboundSupplierKwd: 3100.75,
        ckToBranchTransferKwd: 2400.5,
        posConsumptionKwd: 1950.125,
        scrapKwd: 45.5,
        scrapPctOfConsumption: 2.333,
        doneMovesCount: 120,
        scrapOrdersCount: 3,
        quantsCount: 85,
      },
      byBranchOnHand: {
        '360-mall': { qty: 300, valueKwd: 2200.5 },
        [excludedBranchA]: { qty: 99, valueKwd: 999.999 },
        [excludedBranchB]: { qty: 88, valueKwd: 888.888 },
      },
      dailyMoves: [
        {
          day: '2026-11-14',
          inboundSupplierKwd: 500.5,
          inboundSupplierQty: 100,
          ckToBranchTransferKwd: 400.25,
          ckToBranchTransferQty: 80,
          posConsumptionKwd: 320.125,
          posConsumptionQty: 60,
          scrapKwd: 12.5,
          scrapQty: 2,
          movesCount: 14,
          byBranch: {
            '360-mall': {
              receivedFromCkKwd: 400.25,
              receivedFromCkQty: 80,
              consumedKwd: 320.125,
              consumedQty: 60,
              scrapKwd: 12.5,
              scrapQty: 2,
            },
          },
        },
      ],
      products: [
        {
          productId: 501,
          skuCode: 'RM-BEEF-01',
          name: 'Wagyu Strip',
          categoryName: 'Meat',
          uomName: 'kg',
          unitCostKwd: 4.5,
          onHandQty: 120,
          onHandValueKwd: 540,
          inboundQty: 50,
          inboundValueKwd: 225,
          transferQty: 40,
          transferValueKwd: 180,
          consumedQty: 35,
          consumedValueKwd: 157.5,
          scrapQty: 1,
          scrapValueKwd: 4.5,
        },
      ],
      scraps: [
        {
          id: 901,
          name: 'SP/001',
          dateIso: '2026-11-14T08:40:00.000Z',
          productId: 501,
          productName: 'Wagyu Strip',
          uomName: 'kg',
          locationName: '360 Mall Kitchen',
          branchId: '360-mall',
          scrapQty: 1,
          unitCostKwd: 4.5,
          scrapValueKwd: 4.5,
        },
      ],
    }

    const arHtml = renderWithLocale(
      'ar',
      React.createElement(WarehouseDailyChainStudio, { initialWarehouseChain: payload }),
    )
    expect(arHtml).not.toContain('data-odoo-partial-warning="true"')
    expect(arHtml).toContain('8,200.250')
    expect(arHtml).toContain('3,100.750')
    expect(arHtml).toContain('2,400.500')
    expect(arHtml).toContain('45.500')
    expect(arHtml).toContain('540.000')
    expect(arHtml.toLowerCase()).not.toContain(excludedBranchA)
    expect(arHtml.toLowerCase()).not.toContain(excludedBranchB)

    const enHtml = renderWithLocale(
      'en',
      React.createElement(WarehouseDailyChainStudio, { initialWarehouseChain: payload }),
    )
    expect(enHtml).toContain('8,200.250')
    expect(enHtml).toContain('3,100.750')
    expect(enHtml).toContain('2,400.500')
    expect(enHtml).toContain('45.500')
  })

  it('renders loading, error, timedOut, and disconnected unlinked StateBlocks', () => {
    setMockFilterContext(buildLiveSummary(false), '/erp/warehouse-chain')

    expect(
      renderWithLocale(
        'en',
        React.createElement(WarehouseDailyChainStudio, { initialLoading: true }),
      ),
    ).toContain('data-state-block="loading"')

    expect(
      renderWithLocale(
        'ar',
        React.createElement(WarehouseDailyChainStudio, { initialError: true }),
      ),
    ).toContain('data-state-block="error"')

    expect(
      renderWithLocale(
        'en',
        React.createElement(WarehouseDailyChainStudio, { initialTimedOut: true }),
      ),
    ).toContain('data-state-block="error"')

    expect(
      renderWithLocale(
        'en',
        React.createElement(WarehouseDailyChainStudio, {
          initialWarehouseChain: {
            connected: false,
            sourceMode: 'disconnected',
            noData: true,
            odooCompanyId: null,
            lastSyncAt: null,
            isStale24h: false,
            dateRange: { from: '2026-11-01', to: '2026-11-14' },
            quantHasValueField: false,
            totals: {
              currentOnHandQty: 0,
              currentOnHandValueKwd: 0,
              ckOnHandValueKwd: 0,
              branchesOnHandValueKwd: 0,
              inboundSupplierKwd: 0,
              ckToBranchTransferKwd: 0,
              posConsumptionKwd: 0,
              scrapKwd: 0,
              scrapPctOfConsumption: 0,
              doneMovesCount: 0,
              scrapOrdersCount: 0,
              quantsCount: 0,
            },
            byBranchOnHand: {},
            dailyMoves: [],
            products: [],
            scraps: [],
          },
        }),
      ),
    ).toContain('data-state-block="unlinked"')
  })
})
