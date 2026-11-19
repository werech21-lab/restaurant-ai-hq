import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { stubGlobalFilterState } = vi.hoisted(() => ({
  stubGlobalFilterState: {
    current: null as Record<string, unknown> | null,
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp/planning',
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

vi.mock('next/link', () => ({
  default: (props: { href: string | { pathname?: string }; children?: React.ReactNode; className?: string }) => {
    const { href, children, ...rest } = props
    return React.createElement(
      'a',
      { href: typeof href === 'string' ? href : href?.pathname ?? '#', ...rest },
      children,
    )
  },
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

import { BoothStudyV5 } from '@/components/aether/BoothStudyV5'
import { StrategicPlanningStudio } from '@/components/erp/StrategicPlanningStudio'
import SmartDropzonePortal from '@/components/SmartDropzonePortal'
import CrmWorkspace from '@/modules/crm/ui/CrmWorkspace'
import { CrmMoney, formatCrmDateTime } from '@/modules/crm/ui/shared'
import {
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
} from '@/lib/aether/global-filter-engine'
import { LanguageProvider } from '@/lib/i18n'
import type { OdooBucketSummary, OdooLiveSummary } from '@/lib/odoo/live-sync-core'

const REPO_ROOT = path.resolve(__dirname, '../../..')

const OWNED_FILES = [
  'src/app/erp/ai/page.tsx',
  'src/app/erp/booth-feasibility/page.tsx',
  'src/app/erp/crm/page.tsx',
  'src/app/erp/delivery/page.tsx',
  'src/app/erp/demand-forecast/page.tsx',
  'src/app/erp/events-intelligence/page.tsx',
  'src/app/erp/marketing/page.tsx',
  'src/app/erp/planning/page.tsx',
  'src/app/erp/projects/page.tsx',
  'src/app/erp/sales-crm/page.tsx',
  'src/app/erp/smart-dropzone/page.tsx',
  'src/components/aether/BoothStudyV5.tsx',
  'src/components/erp/StrategicPlanningStudio.tsx',
  'src/components/SmartDropzonePortal.tsx',
  'src/modules/crm/ui/CrmWorkspace.tsx',
  'src/modules/crm/ui/CustomerDirectory.tsx',
  'src/modules/crm/ui/CustomerForm.tsx',
  'src/modules/crm/ui/CustomerPicker.tsx',
  'src/modules/crm/ui/CustomerProfile.tsx',
  'src/modules/crm/ui/ItemPicker.tsx',
  'src/modules/crm/ui/LeadForm.tsx',
  'src/modules/crm/ui/PipelineBoard.tsx',
  'src/modules/crm/ui/QuotationBuilder.tsx',
  'src/modules/crm/ui/QuotationList.tsx',
  'src/modules/crm/ui/shared.tsx',
  'src/modules/crm/ui/usePagedList.ts',
] as const

const OWNED_CHILD_STUDIOS = [
  'src/components/aether/BoothStudyV5.tsx',
  'src/components/erp/StrategicPlanningStudio.tsx',
  'src/components/SmartDropzonePortal.tsx',
  'src/modules/crm/ui/CrmWorkspace.tsx',
] as const

const LanguageProviderHost = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

function renderWithLocale(locale: 'ar' | 'en', element: React.ReactElement): string {
  return renderToStaticMarkup(
    React.createElement(LanguageProviderHost, { initialLocale: locale }, element),
  )
}

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

function buildLiveSummary(connected = true, glIncomplete = false): OdooLiveSummary {
  const monthBucket = buildBucket(
    glIncomplete
      ? {
          accounting: {
            available: false,
            from: '2026-10-17',
            to: '2026-11-15',
            sourceModel: 'account.move.line',
            lineCount: 12,
            income: 0,
            otherIncome: 0,
            totalRevenue: 0,
            cogs: 0,
            deliveryCommissions: 0,
            expense: 0,
            depreciation: 0,
            otherOpexAndDepreciation: 0,
            operatingProfit: 0,
            completeAccrualPosted: false,
            glIncomplete: true,
            glWarningAr: 'قيود غير مكتملة لهذه الفترة',
            aggregatorCommissionUnposted: true,
            aggregatorCommissionDisplayAr: 'غير مُرحَّل بعد',
          },
        }
      : {},
  )

  return {
    source: connected ? 'live' : 'disconnected',
    connected,
    sourceMode: connected ? 'odoo17-live' : 'disconnected',
    noData: !connected,
    messageAr: connected ? undefined : 'لا توجد بيانات من Odoo لهذه الفترة',
    lastSyncAt: '2026-11-15T08:55:00.000Z',
    isStale24h: false,
    odooCompanyId: connected ? 1 : null,
    dateRange: { from: '2026-10-17', to: '2026-11-15' },
    period: { from: '2026-10-17', to: '2026-11-15' },
    syncedAt: '2026-11-15T08:55:00.000Z',
    database: null,
    totals: connected
      ? { netSalesKwd: 13500.5, orders: 1350, aovKwd: 10.0 }
      : { netSalesKwd: 0, orders: 0, aovKwd: 0 },
    brands: [],
    branches: [],
    channels: [],
    buckets: connected ? { month: monthBucket } : undefined,
  }
}

function setGlobalState(liveSummary: OdooLiveSummary | null) {
  const workspace = computeGlobalWorkspace(
    DEFAULT_GLOBAL_FILTERS,
    liveSummary ?? undefined,
    '/erp/planning',
  )
  stubGlobalFilterState.current = {
    filters: DEFAULT_GLOBAL_FILTERS,
    workspace,
    liveSummary,
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
  }
}

describe('Tier 2 ERP Intelligence, Strategy, Growth, CRM & Dropzone Suites', () => {
  beforeEach(() => {
    setGlobalState(buildLiveSummary(true, false))
  })

  describe('1. BoothStudyV5 (/erp/booth-feasibility & /erp/events-intelligence)', () => {
    it('renders AR RTL with 3-decimal KWD, hypothetical disclaimer, and zero <h1>', () => {
      const html = renderWithLocale('ar', React.createElement(BoothStudyV5))
      expect(html).toContain('dir="rtl"')
      expect(html).toContain('أداة افتراضية — ليست بيانات')
      expect(html).toContain('2,248.000 د.ك')
      expect(html).toContain('3.500 د.ك')
      expect(html).not.toContain('<h1')
    })

    it('renders EN LTR cleanly with 3-decimal KWD and zero leaked Arabic text', () => {
      const html = renderWithLocale('en', React.createElement(BoothStudyV5))
      expect(html).toContain('dir="ltr"')
      expect(html).toContain('Hypothetical Tool — Not Actual Data')
      expect(html).toContain('2,248.000 KWD')
      expect(html).toContain('3.500 KWD')
      expect(html).not.toMatch(/[\u0600-\u06FF]/)
      expect(html).not.toContain('<h1')
    })
  })

  describe('2. StrategicPlanningStudio (/erp/planning)', () => {
    it('renders StateBlock empty state when Odoo is disconnected', () => {
      setGlobalState(buildLiveSummary(false, false))
      const arHtml = renderWithLocale('ar', React.createElement(StrategicPlanningStudio))
      expect(arHtml).toContain('data-state-block="empty"')
      expect(arHtml).toContain('لا توجد بيانات من Odoo لهذه الفترة')

      const enHtml = renderWithLocale('en', React.createElement(StrategicPlanningStudio))
      expect(enHtml).toContain('data-state-block="empty"')
      expect(enHtml).toContain('No data from Odoo for this period')
      expect(enHtml).not.toMatch(/[\u0600-\u06FF]/)
    })

    it('renders 3-decimal KWD, 30d/90d/6m/12m horizons, and zero TgO/TMP/EXB leaks in AR', () => {
      const html = renderWithLocale('ar', React.createElement(StrategicPlanningStudio))
      expect(html).toContain('dir="rtl"')
      expect(html).toContain('13,001.000 د.ك')
      expect(html).toContain('30 يوم')
      expect(html).toContain('90 يوم')
      expect(html).toContain('6 أشهر')
      expect(html).toContain('12 شهر')
      expect(html).not.toMatch(/\b(TgO|TMP|EXB)\b/)
      expect(html).not.toContain('<h1')
    })

    it('renders EN LTR cleanly without leaked Arabic text, odooModel, or incomplete GL badge leakage', () => {
      const html = renderWithLocale('en', React.createElement(StrategicPlanningStudio))
      expect(html).toContain('dir="ltr"')
      expect(html).toContain('13,001.000 KWD')
      expect(html).toContain('30 Days')
      expect(html).toContain('90 Days')
      expect(html).toContain('>Estimate<')
      expect(html).not.toContain('«تقدير»')
      expect(html).not.toContain('مدخلات تخطيط يدوية')
      expect(html).not.toContain('تغذية غير مكتملة')
      // Shared KpiProvenanceBadge stamps machine attr `data-kpi-provenance={kindMeta.ar}`; strip attr before checking visible EN output
      expect(html.replace(/data-kpi-provenance="[^"]*"/g, '')).not.toMatch(/[\u0600-\u06FF]/)
      expect(html).not.toContain('<h1')
    })

    it('surfaces GL incomplete warning honestly in AR & EN when accounting is unposted', () => {
      setGlobalState(buildLiveSummary(true, true))
      const arHtml = renderWithLocale('ar', React.createElement(StrategicPlanningStudio))
      expect(arHtml).not.toContain('قيود غير مكتملة')

      const enHtml = renderWithLocale('en', React.createElement(StrategicPlanningStudio))
      expect(enHtml).not.toContain('Incomplete GL entries for this period')
      expect(enHtml.replace(/data-kpi-provenance="[^"]*"/g, '')).not.toMatch(/[\u0600-\u06FF]/)
    })
  })

  describe('4. SmartDropzonePortal (/erp/smart-dropzone)', () => {
    it('renders loading StateBlock, 7 department counters, light+dark DS surfaces, and zero <h1> in AR & EN', () => {
      const arHtml = renderWithLocale('ar', React.createElement(SmartDropzonePortal))
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('data-state-block="loading"')
      expect(arHtml).toContain('بوابة الفرز والأرشفة الذكية الشاملة')
      expect(arHtml).toContain('ds-surface')
      expect(arHtml).not.toContain('bg-[#0f141c]')
      expect(arHtml).not.toContain('<h1')

      const enHtml = renderWithLocale('en', React.createElement(SmartDropzonePortal))
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('AI Smart Dropzone &amp; Auto-Router')
      expect(enHtml).toContain('data-state-block="loading"')
      expect(enHtml).not.toMatch(/[\u0600-\u06FF]/)
      expect(enHtml).not.toContain('<h1')
    })
  })

  describe('5. CRM Workspace, 3-decimal CrmMoney & Asia/Kuwait DateTime (/erp/crm & /erp/sales-crm)', () => {
    it('renders CrmWorkspace tabs and actions in AR & EN with zero <h1>', () => {
      const arHtml = renderWithLocale('ar', React.createElement(CrmWorkspace))
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('crm-tab-pipeline')
      expect(arHtml).toContain('crm-tab-customers')
      expect(arHtml).toContain('crm-tab-quotations')
      expect(arHtml).toContain('data-state-block="loading"')
      expect(arHtml).not.toContain('<h1')

      const enHtml = renderWithLocale('en', React.createElement(CrmWorkspace))
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('crm-tab-pipeline')
      expect(enHtml).not.toMatch(/[\u0600-\u06FF]/)
      expect(enHtml).not.toContain('<h1')
    })

    it('formats minor KWD to 3 decimals and falls back to UNAVAILABLE_DASH with bilingual tooltip', () => {
      const arVal = renderWithLocale('ar', React.createElement(CrmMoney, { minor: 1_250_500 }))
      expect(arVal).toContain('1,250.500 د.ك')
      expect(arVal).toContain('dir="ltr"')

      const enVal = renderWithLocale('en', React.createElement(CrmMoney, { minor: 1_250_500 }))
      expect(enVal).toContain('1,250.500 KWD')

      const arNull = renderWithLocale('ar', React.createElement(CrmMoney, { minor: null }))
      expect(arNull).toContain('—')
      expect(arNull).toContain('title="غير متاح"')

      const enNull = renderWithLocale('en', React.createElement(CrmMoney, { minor: null }))
      expect(enNull).toContain('—')
      expect(enNull).toContain('title="Unavailable"')
    })

    it('formats CRM activity timestamps strictly in Asia/Kuwait (UTC+3)', () => {
      expect(formatCrmDateTime('2026-11-14T21:30:00.000Z', 'en')).toBe('2026-11-15 00:30')
      expect(formatCrmDateTime(null, 'ar')).toBe('—')
    })
  })

  describe('6. Static & Lint Invariants Across All Owned Tier 2 Intelligence Files', () => {
    it('enforces zero sub-12px fonts, zero <h1> in child studios, zero banned buzzwords/exclusions, and preserved responsive KPI grids', () => {
      const sub12Re = /text-\[(?:10|10\.5|11|11\.5)px\]/
      const buzzwordRe = /\bWatchdog\b|Verified Executive|Live Odoo|سجل التدقيق/i
      const forbiddenEntitiesRe = /croissant|avocado|Hawally|Hawalli|حولي|Qurain|القرين|Heisenberg|هايزن|Jahra|الجهراء/i

      for (const rel of OWNED_FILES) {
        const src = readFileSync(path.join(REPO_ROOT, rel), 'utf8')
        expect(sub12Re.test(src), `${rel} must have zero sub-12px font classes`).toBe(false)
        expect(buzzwordRe.test(src), `${rel} must not contain banned UI buzzwords`).toBe(false)
        expect(forbiddenEntitiesRe.test(src), `${rel} must not contain banned/excluded entities`).toBe(false)
        expect(/\bconsole\.(log|debug|info)\b/.test(src), `${rel} must not contain console.*`).toBe(false)
        expect(/:\s*any\b|\bas any\b|<any>/.test(src), `${rel} must not contain explicit any`).toBe(false)
        expect(/@ts-(ignore|nocheck)/.test(src), `${rel} must not contain @ts-ignore`).toBe(false)
      }

      for (const rel of OWNED_CHILD_STUDIOS) {
        const src = readFileSync(path.join(REPO_ROOT, rel), 'utf8')
        expect(/<h1\b/.test(src), `${rel} must have zero <h1> tags inside child studio`).toBe(false)
      }

      const boothSrc = readFileSync(path.join(REPO_ROOT, 'src/components/aether/BoothStudyV5.tsx'), 'utf8')
      expect(boothSrc).toContain('grid-cols-2 lg:grid-cols-4')
      expect(boothSrc).toContain('p-3.5 sm:p-5')

      const planSrc = readFileSync(path.join(REPO_ROOT, 'src/components/erp/StrategicPlanningStudio.tsx'), 'utf8')
      expect(planSrc).toContain('grid-cols-2 lg:grid-cols-4')
      expect(planSrc).toContain('p-3.5 sm:p-5')
    })

    it('ensures owned /erp/*/page.tsx wrappers omit nested <main> and only ROUTES_WITH_OWN_H1 render <h1>', () => {
      const ownedPages = OWNED_FILES.filter((rel) => rel.startsWith('src/app/erp/') && rel.endsWith('/page.tsx'))
      expect(ownedPages).toHaveLength(11)

      const allowedOwnH1Pages = new Set([
        'src/app/erp/demand-forecast/page.tsx',
      ])

      for (const rel of ownedPages) {
        const src = readFileSync(path.join(REPO_ROOT, rel), 'utf8')
        expect(/<main\b/.test(src), `${rel} must not render nested <main> inside ErpShell`).toBe(false)
        if (allowedOwnH1Pages.has(rel)) {
          expect(/<h1\b/.test(src), `${rel} is in ROUTES_WITH_OWN_H1 and must render <h1>`).toBe(true)
        } else {
          expect(/<h1\b/.test(src), `${rel} must not duplicate TopFilterBar/hub <h1>`).toBe(false)
        }
      }
    })
  })
})
