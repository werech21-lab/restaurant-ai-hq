import { readFile } from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCookieValue,
  mockExecSession,
  mockLocale,
  mockAiRunsResult,
  mockGlobalFilterState,
} = vi.hoisted(() => ({
  mockCookieValue: { current: 'mock-exec-token' as string | undefined },
  mockExecSession: {
    current: { sub: 'admin@venturefoodskw.com', role: 'admin' } as {
      sub: string
      role: string
    } | null,
  },
  mockLocale: { current: 'ar' as 'ar' | 'en' },
  mockAiRunsResult: {
    current: {
      runs: [] as Array<{
        id: string
        createdAt: Date
        userId: string
        questionHash: string
        provider: string
        modelId: string | null
        latencyMs: number
        tokensIn: number | null
        tokensOut: number | null
        estCostMicroUsd: number | null
        status: 'ok' | 'guard_rejected' | 'error'
        errorCode: string | null
      }>,
      brief: null as { createdAt: Date; status: string } | null,
      error: false,
      source: 'postgres' as 'postgres' | 'sqlite',
    },
  },
  mockGlobalFilterState: {
    current: {
      sessionRole: 'admin' as
        | 'admin'
        | 'gm'
        | 'dgm'
        | 'ops'
        | 'cfo'
        | 'marketing'
        | 'supply'
        | 'auditor',
      isAuditor: false,
    },
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp/admin',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
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
      { href: typeof href === 'string' ? href : (href?.pathname ?? '#'), ...rest },
      children,
    ),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (mockCookieValue.current ? { value: mockCookieValue.current } : undefined),
  }),
}))

vi.mock('@/lib/auth/exec-session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/exec-session')>()
  return {
    ...actual,
    verifyExecSessionToken: vi.fn(async () => mockExecSession.current),
  }
})

vi.mock('@/lib/i18n/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/i18n/server')>()
  return {
    ...actual,
    getLocale: vi.fn(async () => mockLocale.current),
  }
})

vi.mock('@/server/ai/persist', () => ({
  safeListAiRuns: vi.fn(async () => mockAiRunsResult.current),
}))

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => mockGlobalFilterState.current,
}))

import ProductManager from '@/app/admin/ProductManager'
import AiRunsPage from '@/app/admin/ai-runs/page'
import { RolesPanel } from '@/app/(panel)/roles/roles-panel'
import { UsersPanel } from '@/app/(panel)/users/users-panel'
import { AdminExecutiveDirectoryCard } from '@/components/erp/AdminExecutiveDirectoryCard'
import AcceptInvitation from '@/components/erp/iam/AcceptInvitation'
import IamWorkspace from '@/components/erp/iam/IamWorkspace'
import { permissions } from '@/lib/auth/permissions'
import { LanguageProvider } from '@/lib/i18n'
import AdminWorkspace from '@/modules/admin/ui/AdminWorkspace'
import AiWorkspace from '@/modules/ai/ui/AiWorkspace'
import ExecutiveCenter from '@/modules/ai/ui/ExecutiveCenter'
import { InsightRow } from '@/modules/ai/ui/InsightRow'
import { KpiGrid } from '@/modules/ai/ui/KpiGrid'
import { AiMoney } from '@/modules/ai/ui/labels'
import { StatusStrip } from '@/modules/ai/ui/StatusStrip'
import DeliveryWorkspace from '@/modules/delivery/ui/DeliveryWorkspace'
import ArchiveWorkspace from '@/modules/governance/ui/ArchiveWorkspace'
import ComplianceWorkspace from '@/modules/governance/ui/ComplianceWorkspace'
import ContractsAdvisor from '@/modules/governance/ui/ContractsAdvisor'
import { BranchDialog } from '@/modules/org/ui/BranchDialog'
import OrgWorkspace from '@/modules/org/ui/OrgWorkspace'
import AnalyticPnlPanel from '@/modules/suite/ui/AnalyticPnlPanel'
import FinanceHub from '@/modules/suite/ui/FinanceHub'
import InventoryHub from '@/modules/suite/ui/InventoryHub'
import MarketingHub from '@/modules/suite/ui/MarketingHub'
import ProjectsHub from '@/modules/suite/ui/ProjectsHub'
import SalesCrmHub from '@/modules/suite/ui/SalesCrmHub'
import SuperOdooBoard from '@/modules/suite/ui/SuperOdooBoard'
import { SuiteMoney } from '@/modules/suite/ui/shared'

const el = React.createElement
const REPO_ROOT = path.resolve(__dirname, '../../..')

const LanguageProviderHost = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
}>

function renderWithLocale(locale: 'ar' | 'en', node: React.ReactElement): string {
  return renderToStaticMarkup(el(LanguageProviderHost, { initialLocale: locale }, node))
}

const OWNED_ERP_PAGE_FILES = [
  'src/app/erp/admin/page.tsx',
  'src/app/erp/archive/page.tsx',
  'src/app/erp/iam/page.tsx',
  'src/app/erp/iam/accept/page.tsx',
  'src/app/erp/org/page.tsx',
] as const

const OWNED_ERP_CHILD_STUDIO_FILES = [
  'src/modules/admin/ui/AdminWorkspace.tsx',
  'src/modules/governance/ui/ArchiveWorkspace.tsx',
  'src/components/erp/iam/IamWorkspace.tsx',
  'src/components/erp/iam/AcceptInvitation.tsx',
  'src/modules/org/ui/OrgWorkspace.tsx',
  'src/modules/governance/ui/ComplianceWorkspace.tsx',
  'src/modules/governance/ui/ContractsAdvisor.tsx',
  'src/modules/delivery/ui/DeliveryWorkspace.tsx',
  'src/modules/ai/ui/AiWorkspace.tsx',
  'src/modules/ai/ui/ExecutiveCenter.tsx',
  'src/modules/suite/ui/AnalyticPnlPanel.tsx',
  'src/modules/suite/ui/FinanceHub.tsx',
  'src/modules/suite/ui/InventoryHub.tsx',
  'src/modules/suite/ui/MarketingHub.tsx',
  'src/modules/suite/ui/ProjectsHub.tsx',
  'src/modules/suite/ui/SalesCrmHub.tsx',
  'src/modules/suite/ui/SuperOdooBoard.tsx',
] as const

const OWNED_ALL_FILES = [
  ...OWNED_ERP_PAGE_FILES,
  ...OWNED_ERP_CHILD_STUDIO_FILES,
  'src/components/erp/AdminExecutiveDirectoryCard.tsx',
  'src/components/erp/iam/InvitationDialog.tsx',
  'src/components/erp/iam/MemberDialog.tsx',
  'src/components/erp/iam/RoleDialog.tsx',
  'src/components/erp/iam/shared.tsx',
  'src/modules/org/ui/BranchDialog.tsx',
  'src/modules/org/ui/BrandDialog.tsx',
  'src/modules/org/ui/shared.tsx',
  'src/app/(panel)/roles/page.tsx',
  'src/app/(panel)/roles/roles-panel.tsx',
  'src/app/(panel)/users/page.tsx',
  'src/app/(panel)/users/users-panel.tsx',
  'src/app/admin/page.tsx',
  'src/app/admin/ProductManager.tsx',
  'src/app/admin/ai-runs/page.tsx',
  'src/modules/ai/ui/CopilotBar.tsx',
  'src/modules/ai/ui/DecisionsPanel.tsx',
  'src/modules/ai/ui/InsightList.tsx',
  'src/modules/ai/ui/InsightRow.tsx',
  'src/modules/ai/ui/KpiGrid.tsx',
  'src/modules/ai/ui/RulesPanel.tsx',
  'src/modules/ai/ui/ScanControl.tsx',
  'src/modules/ai/ui/StatusStrip.tsx',
  'src/modules/ai/ui/labels.tsx',
  'src/modules/suite/ui/shared.tsx',
] as const

describe('Wave 3C Tier 3 — Admin, IAM, Org, Archive, Roles, Users & Leftover ERP Module UIs', () => {
  beforeEach(() => {
    mockCookieValue.current = 'mock-exec-token'
    mockExecSession.current = { sub: 'admin@venturefoodskw.com', role: 'admin' }
    mockLocale.current = 'ar'
    mockGlobalFilterState.current = { sessionRole: 'admin', isAuditor: false }
  })

  describe('1. /erp/admin — AdminExecutiveDirectoryCard & AdminWorkspace', () => {
    it('strictly hides AdminExecutiveDirectoryCard for all 7 non-admin roles', () => {
      const nonAdminRoles = [
        'gm',
        'dgm',
        'ops',
        'cfo',
        'marketing',
        'supply',
        'auditor',
      ] as const
      for (const role of nonAdminRoles) {
        mockGlobalFilterState.current = {
          sessionRole: role,
          isAuditor: role === 'auditor',
        }
        const html = renderWithLocale('ar', el(AdminExecutiveDirectoryCard, { role }))
        expect(html).toBe('')
        expect(html).not.toContain('@venturefoodskw.com')
      }
    })

    it('renders AdminExecutiveDirectoryCard for admin in AR (rtl) & EN (ltr) with zero passwords', () => {
      const arHtml = renderWithLocale('ar', el(AdminExecutiveDirectoryCard, { role: 'admin' }))
      const enHtml = renderWithLocale('en', el(AdminExecutiveDirectoryCard, { role: 'admin' }))

      expect(arHtml).toContain('data-admin-role-directory="true"')
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('دليل الصلاحيات والحسابات التنفيذية')
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('Executive Access Directory')
      expect(enHtml).not.toMatch(/[\u0600-\u06FF]/)
    })

    it('renders AdminWorkspace loading StateBlock in AR & EN with zero <h1> tags', () => {
      const arHtml = renderWithLocale(
        'ar',
        el(AdminWorkspace, { permissions: Object.values(permissions), initialTab: 'accounts' }),
      )
      const enHtml = renderWithLocale(
        'en',
        el(AdminWorkspace, { permissions: Object.values(permissions), initialTab: 'activity' }),
      )

      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('data-state-block="loading"')
      expect(arHtml).not.toContain('<h1')
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('data-state-block="loading"')
      expect(enHtml).not.toContain('<h1')
    })
  })

  describe('2. /erp/archive, /erp/compliance & /erp/contracts', () => {
    it('renders ArchiveWorkspace, ComplianceWorkspace & ContractsAdvisor cleanly in AR & EN without <h1>', () => {
      const held = Object.values(permissions)
      for (const node of [
        el(ArchiveWorkspace, { permissions: held }),
        el(ComplianceWorkspace, { permissions: held, initialTab: 'laws' }),
        el(ContractsAdvisor, { permissions: held }),
      ]) {
        const arHtml = renderWithLocale('ar', node)
        const enHtml = renderWithLocale('en', node)
        expect(arHtml).toContain('dir="rtl"')
        expect(arHtml).toContain('data-state-block="loading"')
        expect(arHtml).not.toContain('<h1')
        expect(enHtml).toContain('dir="ltr"')
        expect(enHtml).toContain('data-state-block="loading"')
        expect(enHtml).not.toContain('<h1')
        expect(enHtml).not.toMatch(/[\u0600-\u06FF]/)
      }
    })
  })

  describe('3. /erp/iam & /erp/iam/accept', () => {
    it('renders IamWorkspace tabs in AR & EN and forbidden StateBlock when permissions are absent', () => {
      const arHtml = renderWithLocale(
        'ar',
        el(IamWorkspace, {
          permissions: [permissions.iamMemberRead, permissions.iamRoleRead],
          userId: 'usr-1',
        }),
      )
      const enHtml = renderWithLocale(
        'en',
        el(IamWorkspace, {
          permissions: [permissions.iamMemberRead, permissions.iamRoleRead],
          userId: 'usr-1',
        }),
      )
      const forbiddenHtml = renderWithLocale(
        'en',
        el(IamWorkspace, { permissions: [], userId: 'usr-1' }),
      )

      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('role="tablist"')
      expect(arHtml).not.toContain('<h1')
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('role="tablist"')
      expect(enHtml).not.toMatch(/[\u0600-\u06FF]/)
      expect(forbiddenHtml).toContain('data-state-block="forbidden"')
    })

    it('renders AcceptInvitation in AR & EN with dir="ltr" token input and zero <h1>', () => {
      const arHtml = renderWithLocale(
        'ar',
        el(AcceptInvitation, { initialToken: 'invite-token-123' }),
      )
      const enHtml = renderWithLocale(
        'en',
        el(AcceptInvitation, { initialToken: 'invite-token-123' }),
      )

      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('invite-token-123')
      expect(arHtml).toContain('dir="ltr"')
      expect(arHtml).not.toContain('<h1')
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).not.toContain('<h1')
      expect(enHtml).not.toMatch(/[\u0600-\u06FF]/)
    })
  })

  describe('4. /erp/org — OrgWorkspace & BranchDialog', () => {
    it('renders OrgWorkspace tabs, forbidden StateBlock & Asia/Kuwait default timezone in BranchDialog', () => {
      const arHtml = renderWithLocale(
        'ar',
        el(OrgWorkspace, {
          permissions: [permissions.orgBrandRead, permissions.orgBranchRead],
        }),
      )
      const forbiddenHtml = renderWithLocale(
        'en',
        el(OrgWorkspace, { permissions: [] }),
      )
      const dialogHtml = renderWithLocale(
        'en',
        el(BranchDialog, {
          brands: { rows: [], phase: 'ready', error: 'erp.err.generic', truncated: false, reload: vi.fn() },
          onSaved: vi.fn(),
          onCancel: vi.fn(),
          onReload: vi.fn(),
        }),
      )

      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('role="tablist"')
      expect(arHtml).not.toContain('<h1')
      expect(forbiddenHtml).toContain('data-state-block="forbidden"')
      expect(dialogHtml).toContain('value="Asia/Kuwait"')
    })
  })

  describe('5. /roles & /users — (panel) RBAC Screens', () => {
    it('renders RolesPanel matrix & empty StateBlock cleanly in AR & EN', () => {
      const roleRow = {
        id: 'role-1',
        name: 'Operations Lead',
        description: 'Branch ops',
        isAdmin: false,
        userCount: 12,
      }
      const arHtml = renderWithLocale(
        'ar',
        el(RolesPanel, {
          rows: [roleRow],
          selected: {
            ...roleRow,
            permissions: [{ module: 'sales', canView: true, canCreate: false, canEdit: false, canDelete: false }],
          },
          page: 1,
          total: 1,
          q: '',
          canCreate: true,
          canEdit: true,
          canDelete: true,
        }),
      )
      const emptyEn = renderWithLocale(
        'en',
        el(RolesPanel, {
          rows: [],
          selected: null,
          page: 1,
          total: 0,
          q: '',
          canCreate: false,
          canEdit: false,
          canDelete: false,
        }),
      )

      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('text-start')
      expect(arHtml).not.toContain('text-right')
      expect(emptyEn).toContain('data-state-block="empty"')
      expect(emptyEn).toContain('No role selected')
    })

    it('renders UsersPanel with overflow-x-auto, Asia/Kuwait timestamp island & empty StateBlock', () => {
      const arHtml = renderWithLocale(
        'ar',
        el(UsersPanel, {
          rows: [
            {
              id: 'u-1',
              name: 'GM Venture',
              email: 'gm@venturefoodskw.com',
              isActive: true,
              roleId: 'r-1',
              roleName: 'GM',
              createdAtLabel: '2026-11-15 11:30',
            },
          ],
          page: 1,
          total: 1,
          q: '',
          canCreate: true,
          canEdit: true,
          canDelete: true,
        }),
      )
      const emptyEn = renderWithLocale(
        'en',
        el(UsersPanel, {
          rows: [],
          page: 1,
          total: 0,
          q: '',
          canCreate: false,
          canEdit: false,
          canDelete: false,
        }),
      )

      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('overflow-x-auto')
      expect(arHtml).toContain('2026-11-15 11:30')
      expect(arHtml).toContain('tabular-nums')
      expect(emptyEn).toContain('data-state-block="empty"')
      expect(emptyEn).toContain('No matching users')
    })
  })

  describe('6. /admin & /admin/ai-runs', () => {
    it('renders ProductManager with 3-decimal KWD and StateBlock for forbidden/empty', () => {
      const arHtml = renderWithLocale(
        'ar',
        el(ProductManager, {
          products: [
            {
              id: 'p-1',
              name: 'Chicken Machboos',
              category: 'Mains',
              priceMinor: 12_500,
              available: true,
              version: 1,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
          query: '',
          canCreate: true,
          canUpdate: true,
          access: 'ok',
        }),
      )
      const forbiddenEn = renderWithLocale(
        'en',
        el(ProductManager, {
          products: [],
          total: 0,
          page: 1,
          pageSize: 20,
          query: '',
          canCreate: false,
          canUpdate: false,
          access: 'forbidden',
        }),
      )

      expect(arHtml).toContain('12.500 د.ك')
      expect(arHtml).not.toContain('bg-[#1c2128]')
      expect(forbiddenEn).toContain('data-state-block="forbidden"')
    })

    it('enforces admin-only RBAC on /admin/ai-runs and formats Asia/Kuwait UTC+3 dates & nulls', async () => {
      mockExecSession.current = { sub: 'auditor@venturefoodskw.com', role: 'auditor' }
      mockLocale.current = 'en'
      const forbiddenTree = await AiRunsPage()
      const forbiddenHtml = renderToStaticMarkup(forbiddenTree)
      expect(forbiddenHtml).toContain('data-state-block="forbidden"')
      expect(forbiddenHtml).toContain('restricted to administrators')

      mockExecSession.current = { sub: 'admin@venturefoodskw.com', role: 'admin' }
      mockLocale.current = 'ar'
      mockAiRunsResult.current = {
        runs: [
          {
            id: 'run-1',
            createdAt: new Date('2026-11-15T08:30:00.000Z'), // 11:30 Asia/Kuwait (UTC+3)
            userId: 'admin',
            questionHash: 'abcdef1234567890',
            provider: 'gemini',
            modelId: 'gemini-2.5-pro',
            latencyMs: 1250,
            tokensIn: null,
            tokensOut: 410,
            estCostMicroUsd: null,
            status: 'ok',
            errorCode: null,
          },
        ],
        brief: { createdAt: new Date('2026-11-15T06:00:00.000Z'), status: 'ok' },
        error: false,
        source: 'postgres',
      }
      const adminTree = await AiRunsPage()
      const adminHtml = renderToStaticMarkup(adminTree)
      expect(adminHtml).toContain('dir="rtl"')
      expect(adminHtml).toContain('2026-11-15 11:30')
      expect(adminHtml).toContain('2026-11-15 09:00')
      expect(adminHtml).toContain('1,250')
      expect(adminHtml).toContain('data-unavailable="true"')
      expect(adminHtml).toContain('title="غير متاح"')
    })
  })

  describe('7. Leftover ERP Module UIs (ai/ui, DeliveryWorkspace, V2 notices, suite/ui)', () => {
    it('renders KpiGrid, StatusStrip, InsightRow & AiMoney with 3-decimal KWD, null tooltips & Asia/Kuwait timestamps', () => {
      const html = renderWithLocale(
        'en',
        el(
          'div',
          null,
          el(KpiGrid, {
            kpis: {
              currency: 'KWD',
              revenue: null,
              receivables: { outstandingMinor: 1_250_500, overdueMinor: 100_000, overdueCount: 2 },
              inventory: { valuationMinor: 500_000, outOfStockCount: 1, lowStockCount: 3 },
              pipeline: { activeValueMinor: 250_000, activeCount: 4 },
              pendingApprovals: 2,
              openInsights: { total: 5, critical: 1, warning: 2, opportunity: 2 },
            },
          }),
          el(StatusStrip, {
            kpis: {
              currency: 'KWD',
              revenue: null,
              receivables: null,
              inventory: null,
              pipeline: null,
              pendingApprovals: 2,
              openInsights: { total: 5, critical: 1, warning: 2, opportunity: 2 },
            },
          }),
          el(InsightRow, {
            insight: {
              id: 'ins-1',
              ruleKey: 'finance.payment_reminder',
              fingerprint: 'fp-1',
              titleAr: 'فحص السيولة',
              descriptionAr: 'تحديث يومي',
              category: 'finance',
              severity: 'warning',
              status: 'open',
              metricValue: 45_250,
              metricUnit: 'fils',
              sourceEntityType: 'invoice',
              sourceEntityId: 'inv-1',
              detectedAt: '2026-11-15T08:30:00.000Z',
              resolvedAt: null,
              version: 1,
              createdAt: '2026-11-15T08:30:00.000Z',
              updatedAt: '2026-11-15T08:30:00.000Z',
              createdBy: 'system',
            },
            actions: null,
          }),
          el(AiMoney, { minor: 45_250, signed: true }),
        ),
      )

      expect(html).toContain('data-unavailable="true"')
      expect(html).toContain('title="Unavailable"')
      expect(html).toContain('1,250.500 KWD')
      expect(html).toContain('45.250 KWD')
      expect(html).toContain('+45.250 KWD')
      expect(html).toContain('2026-11-15 11:30')
    })

    it('renders AiWorkspace, ExecutiveCenter, DeliveryWorkspace, suite/ui Hubs & SuiteMoney with zero <h1> tags and 3-decimal KWD', () => {
      const held = Object.values(permissions)
      for (const node of [
        el(AiWorkspace, { initialTab: 'decisions' }),
        el(ExecutiveCenter, null),
        el(DeliveryWorkspace, { permissions: held }),
        el(AnalyticPnlPanel, null),
        el(FinanceHub, { permissions: held, initialTab: 'accounting' }),
        el(InventoryHub, { permissions: held, initialTab: 'mrp' }),
        el(MarketingHub, { permissions: held, initialTab: 'website' }),
        el(ProjectsHub, { permissions: held, initialTab: 'project' }),
        el(SalesCrmHub, { permissions: held, initialTab: 'sales' }),
        el(SuperOdooBoard, { app: 'projects', title: 'spec.project', canManage: false }),
      ]) {
        const arHtml = renderWithLocale('ar', node)
        const enHtml = renderWithLocale('en', node)
        expect(arHtml).not.toContain('<h1')
        expect(enHtml).not.toContain('<h1')
        expect(enHtml).not.toMatch(/[\u0600-\u06FF]/)
      }

      const moneyAr = renderWithLocale('ar', el(SuiteMoney, { minor: 125_500 }))
      const moneyNull = renderWithLocale('en', el(SuiteMoney, { minor: null }))
      expect(moneyAr).toContain('125.500 د.ك')
      expect(moneyNull).toContain('data-unavailable="true"')
      expect(moneyNull).toContain('title="Unavailable"')
    })
  })

  describe('8. Static HTML Shell & Guardrails Across All Owned Files', () => {
    it('enforces zero nested <main> in /erp/* page wrappers, zero <h1> in child /erp/* studios, zero sub-12px classes, and zero forbidden buzzwords', async () => {
      const sub12Re = /text-\[(?:10|10\.5|11|11\.5)px\]/
      const bannedBuzzwordsRe = /\bWatchdog\b|Verified Executive|Live Odoo|سجل التدقيق/i

      for (const rel of OWNED_ERP_PAGE_FILES) {
        const text = await readFile(path.join(REPO_ROOT, rel), 'utf8')
        expect(text, `${rel} must not render nested <main>`).not.toMatch(/<main\b/)
      }

      for (const rel of OWNED_ERP_CHILD_STUDIO_FILES) {
        const text = await readFile(path.join(REPO_ROOT, rel), 'utf8')
        expect(text, `${rel} must not render <h1>`).not.toMatch(/<h1\b/)
      }

      for (const rel of OWNED_ALL_FILES) {
        const text = await readFile(path.join(REPO_ROOT, rel), 'utf8')
        expect(text, `${rel} sub-12px`).not.toMatch(sub12Re)
        expect(text, `${rel} banned buzzword`).not.toMatch(bannedBuzzwordsRe)
        expect(text, `${rel} legacy styles.ts`).not.toContain('@/components/erp/styles')
        expect(text, `${rel} local-TZ dateTimeText`).not.toContain('dateTimeText')
        expect(text, `${rel} formatMinor`).not.toContain('formatMinor')
        expect(text, `${rel} toISOString().slice(0, 10)`).not.toMatch(/toISOString\(\)\.slice\(0,\s*10\)/)
        expect(text, `${rel} console.*`).not.toMatch(/\bconsole\.(log|debug|info)\b/)
        expect(text, `${rel} explicit any`).not.toMatch(/:\s*any\b|\bas any\b|<any>/)
        expect(text, `${rel} @ts-ignore`).not.toMatch(/@ts-(ignore|nocheck)/)
      }
    })
  })
})
