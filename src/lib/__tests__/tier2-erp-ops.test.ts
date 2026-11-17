import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const { mockRedirect, mockGlobalFilterState } = vi.hoisted(() => ({
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
  mockGlobalFilterState: {
    current: null as Record<string, unknown> | null,
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp/operations',
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

import { permissions } from '@/lib/auth/permissions'
import type { ComplianceBreachItem } from '@/lib/governance-compliance'
import { LanguageProvider, type MessageKey } from '@/lib/i18n'
import { AlertsCenterV2 } from '@/components/aether/AlertsCenterV2'
import { GovernanceProvider } from '@/components/erp/GovernanceBellDrawer'
import { RegulationsComplianceStudio } from '@/components/erp/RegulationsComplianceStudio'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'
import FoodSafetyHub from '@/modules/food-safety/ui/FoodSafetyHub'
import GovernanceDesk from '@/modules/governance/ui/GovernanceDesk'
import HrWorkspace from '@/modules/hr/ui/HrWorkspace'
import { InventoryOverview } from '@/modules/inventory/ui/InventoryOverview'
import type { InventorySummary, Item } from '@/modules/inventory/domain/types'
import KitchenWorkspace from '@/modules/kitchen/ui/KitchenWorkspace'
import OperationsWorkspace from '@/modules/operations/ui/OperationsWorkspace'
import ProcurementWorkspace from '@/modules/procurement/ui/ProcurementWorkspace'

const REPO_ROOT = path.resolve(__dirname, '../../..')

const OWNED_ROUTE_PAGES = [
  'src/app/erp/compliance/page.tsx',
  'src/app/erp/contracts/page.tsx',
  'src/app/erp/food-safety/page.tsx',
  'src/app/erp/hr/page.tsx',
  'src/app/erp/inventory/page.tsx',
  'src/app/erp/kds/page.tsx',
  'src/app/erp/kitchen/page.tsx',
  'src/app/erp/operations/page.tsx',
  'src/app/erp/procurement/page.tsx',
  'src/app/erp/recipes/page.tsx',
  'src/app/erp/regulations/page.tsx',
] as const

const OWNED_UI_FILES = [
  'src/components/erp/UnlinkedSourceNotice.tsx',
  'src/components/aether/AlertsCenterV2.tsx',
  'src/components/erp/RegulationsComplianceStudio.tsx',
  'src/modules/food-safety/ui/FoodSafetyHub.tsx',
  'src/modules/governance/ui/GovernanceDesk.tsx',
  'src/modules/hr/ui/HrWorkspace.tsx',
  'src/modules/inventory/ui/InventoryOverview.tsx',
  'src/modules/inventory/ui/InventoryWorkspace.tsx',
  'src/modules/inventory/ui/ItemForm.tsx',
  'src/modules/inventory/ui/MovementHistory.tsx',
  'src/modules/inventory/ui/ProductCatalog.tsx',
  'src/modules/inventory/ui/StockMovementForm.tsx',
  'src/modules/inventory/ui/WarehouseManager.tsx',
  'src/modules/inventory/ui/shared.tsx',
  'src/modules/kitchen/ui/KitchenWorkspace.tsx',
  'src/modules/operations/ui/OperationsWorkspace.tsx',
  'src/modules/procurement/ui/AccountingSettings.tsx',
  'src/modules/procurement/ui/CreditNoteDialog.tsx',
  'src/modules/procurement/ui/InvoiceDialog.tsx',
  'src/modules/procurement/ui/LineEditor.tsx',
  'src/modules/procurement/ui/OrderDialog.tsx',
  'src/modules/procurement/ui/PagedTable.tsx',
  'src/modules/procurement/ui/PaymentDialog.tsx',
  'src/modules/procurement/ui/ProcurementWorkspace.tsx',
  'src/modules/procurement/ui/ReceiveDialog.tsx',
  'src/modules/procurement/ui/ReconciliationPanel.tsx',
  'src/modules/procurement/ui/RequestDialog.tsx',
  'src/modules/procurement/ui/ReturnDialog.tsx',
  'src/modules/procurement/ui/Selects.tsx',
  'src/modules/procurement/ui/SupplierDialog.tsx',
  'src/modules/procurement/ui/shared.tsx',
] as const

const OWNED_ALL_SOURCE_FILES = [...OWNED_ROUTE_PAGES, ...OWNED_UI_FILES] as const

const CHILD_STUDIO_FILES = [
  'src/components/erp/RegulationsComplianceStudio.tsx',
  'src/modules/food-safety/ui/FoodSafetyHub.tsx',
  'src/modules/governance/ui/GovernanceDesk.tsx',
  'src/modules/hr/ui/HrWorkspace.tsx',
  'src/modules/inventory/ui/InventoryWorkspace.tsx',
  'src/modules/kitchen/ui/KitchenWorkspace.tsx',
  'src/modules/operations/ui/OperationsWorkspace.tsx',
  'src/modules/procurement/ui/ProcurementWorkspace.tsx',
] as const

const LanguageProviderHost = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
}>

const GovernanceProviderHost = GovernanceProvider as unknown as React.ComponentType<{
  isAuditor?: boolean
  sessionRole?: 'admin'
}>

function renderWithHosts(locale: 'ar' | 'en', element: React.ReactElement): string {
  return renderToStaticMarkup(
    React.createElement(
      LanguageProviderHost,
      { initialLocale: locale },
      React.createElement(GovernanceProviderHost, { isAuditor: false, sessionRole: 'admin' }, element),
    ),
  )
}

function readRepoFile(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, relPath), 'utf8')
}

const SAMPLE_BREACH: ComplianceBreachItem = {
  id: 'live-breach-pos-discount-cap',
  category: 'discount-cap',
  severity: 'critical',
  odooModel: 'pos.order.line',
  odooDomain: [['discount', '>', 0]],
  period: { from: '2026-11-01', to: '2026-11-14' },
  odooRecordUrl: 'https://venturefoods.walnutss.com/web#id=1&model=product.product&view_type=form',
  computedValue: 8.5,
  adminThreshold: 5,
  approvedDecisionTitleAr: 'سقف خصم نقطة البيع',
  approvedDecisionTitleEn: 'POS Discount Cap',
  breachHeadlineAr: 'تجاوز حد الخصم في نقطة البيع',
  breachHeadlineEn: 'POS discount cap exceeded',
  odooMetricProofAr: 'أعلى خصم مسجل 8.5%',
  odooMetricProofEn: 'Max discount recorded 8.5%',
  approvedRuleLimitAr: 'الحد المعتمد 5%',
  approvedRuleLimitEn: 'Approved cap 5%',
  monthlyLeakKwd: 1234.5,
  affectedScopeAr: 'فرع السالمية',
  affectedScopeEn: 'Salmiya Branch',
  href: '/erp/cores?tab=sales',
  frozen: true,
  frozenAtIso: '2026-11-14T08:40:00.000Z',
  stopDirectiveAr: 'إيقاف الخصم الإضافي فوراً',
  stopDirectiveEn: 'Halt extra POS discounts immediately',
}

describe('Tier 2 ERP Operations — Static & Layout Guardrails', () => {
  it('enforces requirePageUser and avoids nested <main> across all 11 owned /erp/* page.tsx files', () => {
    for (const relPath of OWNED_ROUTE_PAGES) {
      const src = readRepoFile(relPath)
      expect(src, `${relPath} missing requirePageUser`).toContain('requirePageUser(')
      expect(src, `${relPath} has nested <main>`).not.toMatch(/<main[\s>]/)
    }
  })

  it('keeps zero sub-12px font classes, zero console.*, zero explicit any, zero @ts-ignore, and zero banned buzzwords/leaks across owned files', () => {
    const sub12Re = /text-\[(?:10|10\.5|11|11\.5)px\]/
    const bannedBuzzRe = /\bWatchdog\b|Verified Executive|Live Odoo|سجل التدقيق/i
    const leakEntityRe = /\b(croissant|avocado|heisenberg|qurain|hawally|hawalli|jahra)\b|حولي|القرين|الجهراء/i
    const consoleRe = /\bconsole\.(?:log|debug|info|warn|error)\s*\(/
    const anyRe = /:\s*any\b|\bas\s+any\b|<any>/
    const tsIgnoreRe = /@ts-ignore|@ts-nocheck/

    for (const relPath of OWNED_ALL_SOURCE_FILES) {
      const src = readRepoFile(relPath)
      expect(src, `${relPath} contains sub-12px class`).not.toMatch(sub12Re)
      expect(src, `${relPath} contains banned buzzword`).not.toMatch(bannedBuzzRe)
      expect(src, `${relPath} contains leaked excluded entity or legacy product`).not.toMatch(leakEntityRe)
      expect(src, `${relPath} contains console.* call`).not.toMatch(consoleRe)
      expect(src, `${relPath} contains explicit any`).not.toMatch(anyRe)
      expect(src, `${relPath} contains @ts-ignore/@ts-nocheck`).not.toMatch(tsIgnoreRe)
    }
  })

  it('keeps zero <h1> tags inside child ERP studios/workspaces and preserves RegulationsComplianceStudio layout grid/padding', () => {
    for (const relPath of CHILD_STUDIO_FILES) {
      const src = readRepoFile(relPath)
      expect(src, `${relPath} must not render <h1> inside TopFilterBar shell`).not.toMatch(/<h1[\s>]/)
    }

    const regSrc = readRepoFile('src/components/erp/RegulationsComplianceStudio.tsx')
    expect(regSrc).toContain('grid-cols-2')
    expect(regSrc).toContain('lg:grid-cols-4')
    expect(regSrc).toContain('p-3.5 sm:p-5')
  })

  it('enforces large touch targets (min-h-11) on /erp/kds and KitchenWorkspace', () => {
    expect(readRepoFile('src/app/erp/kds/page.tsx')).toContain('min-h-11')
    expect(readRepoFile('src/modules/kitchen/ui/KitchenWorkspace.tsx')).toContain('min-h-11')
  })
})

describe('Tier 2 Shared Flagged Components — AR/EN Parity, Null Honesty & States', () => {
  it('renders UnlinkedSourceNotice cleanly in AR and EN without Arabic pill leaks in EN', () => {
    const arHtml = renderToStaticMarkup(
      React.createElement(UnlinkedSourceNotice, {
        isAr: true,
        titleAr: 'عنوان الاختبار',
        requiredSourceAr: 'أودو',
      }),
    )
    expect(arHtml).toContain('data-unlinked-source="true"')
    expect(arHtml).toContain('غير مربوط بمصدر')
    expect(arHtml).toContain('dir="rtl"')

    const enHtml = renderToStaticMarkup(
      React.createElement(UnlinkedSourceNotice, {
        isAr: false,
        titleEn: 'غير مربوط بمصدر — Contracts Registry',
        requiredSourceEn: 'Odoo Documents',
      }),
    )
    expect(enHtml).toContain('data-unlinked-source="true"')
    expect(enHtml).toContain('Unlinked from Source')
    expect(enHtml).toContain('Unlinked from Source — Contracts Registry')
    expect(enHtml).not.toContain('غير مربوط بمصدر')
    expect(enHtml).toContain('dir="ltr"')

    const compactEnViaContext = renderWithHosts(
      'en',
      React.createElement(UnlinkedSourceNotice, { compact: true, reasonEn: 'Awaiting telemetry' }),
    )
    expect(compactEnViaContext).toContain('Unlinked from Source')
    expect(compactEnViaContext).not.toContain('غير مربوط بمصدر')
  })

  it('renders AlertsCenterV2 across loading, error, unlinked, empty, and ready states with 3-decimal KWD and Asia/Kuwait timestamps', () => {
    const loadingHtml = renderWithHosts(
      'en',
      React.createElement(AlertsCenterV2, { locale: 'en', initialState: 'loading' }),
    )
    expect(loadingHtml).toContain('data-state-block="loading"')

    const errorHtml = renderWithHosts(
      'ar',
      React.createElement(AlertsCenterV2, { locale: 'ar', initialState: 'error' }),
    )
    expect(errorHtml).toContain('data-state-block="error"')

    const unlinkedEnHtml = renderWithHosts(
      'en',
      React.createElement(AlertsCenterV2, {
        locale: 'en',
        initialState: 'unlinked',
        initialHasThresholds: false,
      }),
    )
    expect(unlinkedEnHtml).toContain('data-unlinked-source="true"')
    expect(unlinkedEnHtml).toContain('Unlinked from Source')
    expect(unlinkedEnHtml).not.toContain('غير مربوط بمصدر')

    const emptyHtml = renderWithHosts(
      'en',
      React.createElement(AlertsCenterV2, {
        locale: 'en',
        initialState: 'empty',
        initialHasThresholds: true,
        initialBreaches: [],
      }),
    )
    expect(emptyHtml).toContain('data-state-block="empty"')

    const readyArHtml = renderWithHosts(
      'ar',
      React.createElement(AlertsCenterV2, {
        locale: 'ar',
        initialState: 'ready',
        initialHasThresholds: true,
        initialBreaches: [SAMPLE_BREACH],
        initialUpdatedAtIso: '2026-11-14T08:40:00.000Z',
      }),
    )
    expect(readyArHtml).toContain('1,234.500')
    expect(readyArHtml).toContain('د.ك')
    expect(readyArHtml).toContain('2026-11-14 11:40')
    expect(readyArHtml).toContain('UTC+3')

    const readyEnHtml = renderWithHosts(
      'en',
      React.createElement(AlertsCenterV2, {
        locale: 'en',
        initialState: 'ready',
        initialHasThresholds: true,
        initialBreaches: [SAMPLE_BREACH],
        initialUpdatedAtIso: '2026-11-14T08:40:00.000Z',
      }),
    )
    expect(readyEnHtml).toContain('1,234.500')
    expect(readyEnHtml).toContain('KWD')
    expect(readyEnHtml).toContain('POS discount cap exceeded')
    expect(readyEnHtml).toContain('2026-11-14 11:40')
  })

  it('renders GovernanceDesk states cleanly (loading, error, forbidden, ready) with zero <h1> and 3-decimal KWD', () => {
    const loadingHtml = renderWithHosts(
      'en',
      React.createElement(GovernanceDesk, {
        permissions: [permissions.govViolationManage],
        initialTab: 'violations',
        initialPhase: 'loading',
      }),
    )
    expect(loadingHtml).toContain('data-state-block="loading"')
    expect(loadingHtml).not.toContain('<h1')

    const forbiddenHtml = renderWithHosts(
      'en',
      React.createElement(GovernanceDesk, {
        permissions: [permissions.govViolationManage],
        initialTab: 'violations',
        initialPhase: 'error',
        initialError: 'erp.err.forbidden' as MessageKey,
      }),
    )
    expect(forbiddenHtml).toContain('data-state-block="forbidden"')

    const readyHtml = renderWithHosts(
      'en',
      React.createElement(GovernanceDesk, {
        permissions: [permissions.govViolationManage],
        initialTab: 'violations',
        initialPhase: 'ready',
        initialData: {
          violations: [
            {
              id: 'gov-v1',
              violationNumber: 'V-2026-01',
              issuingAuthority: 'Kuwait Municipality',
              branchId: null,
              violationTypeAr: 'تخزين مبرد',
              fineAmountMinor: 250750,
              assignedEmployeeName: 'Salim Al-Harbi',
              slaDeadline: '2026-11-20',
              workflowStage: 'pending_statement',
              employeeStatementAr: null,
              actionLog: [],
              closureProofDocUrl: null,
              isNeglectedFlag: false,
              neglected: false,
              version: 1,
              createdAt: '2026-11-10T09:00:00.000Z',
            },
          ],
          hrAlerts: [
            {
              id: 'hr-a1',
              fullName: 'Khaled Al-Mutairi',
              residencyExpiry: '2026-12-01',
              workLocation: null,
            },
          ],
        },
      }),
    )
    expect(readyHtml).toContain('V-2026-01')
    expect(readyHtml).toContain('Kuwait Municipality')
    expect(readyHtml).toContain('250.750')
    expect(readyHtml).toContain('KWD')
    expect(readyHtml).not.toContain('<h1')

    const gateHtml = renderWithHosts(
      'en',
      React.createElement(GovernanceDesk, {
        permissions: [permissions.govViolationManage],
        initialTab: 'gate',
        initialPhase: 'ready',
        initialData: {
          violations: [],
          hrAlerts: [
            {
              id: 'hr-a1',
              fullName: 'Khaled Al-Mutairi',
              residencyExpiry: '2026-12-01',
              workLocation: null,
            },
          ],
        },
      }),
    )
    expect(gateHtml).toContain('Khaled Al-Mutairi')
    expect(gateHtml).toContain('2026-12-01')
    expect(gateHtml).not.toContain('<h1')
  })
})

describe('Tier 2 ERP Studios & Workspaces — SSR & Null-Honest Formatting', () => {
  it('renders RegulationsComplianceStudio and FoodSafetyHub in AR and EN with unlinked notice and "—" null KPIs', () => {
    const regEn = renderWithHosts(
      'en',
      React.createElement(RegulationsComplianceStudio, { locale: 'en' }),
    )
    expect(regEn).toContain('data-unlinked-source="true"')
    expect(regEn).toContain('Unlinked from Source')
    expect(regEn).toContain('—')
    expect(regEn).toContain('Unavailable')
    expect(regEn).not.toContain('غير مربوط بمصدر')
    expect(regEn).not.toContain('<h1')

    const regAr = renderWithHosts(
      'ar',
      React.createElement(RegulationsComplianceStudio, { locale: 'ar' }),
    )
    expect(regAr).toContain('غير مربوط بمصدر')
    expect(regAr).toContain('غير متاح')

    const fsEn = renderWithHosts('en', React.createElement(FoodSafetyHub, { locale: 'en' }))
    expect(fsEn).toContain('data-unlinked-source="true"')
    expect(fsEn).toContain('Unlinked from Source')
    expect(fsEn).not.toContain('غير مربوط بمصدر')
  })

  it('renders InventoryOverview loading, forbidden error, and 3-decimal KWD summary', () => {
    const onStockEntry = (_item: Item) => undefined
    const loadingHtml = renderWithHosts(
      'en',
      React.createElement(InventoryOverview, { reloadToken: 0, onStockEntry }),
    )
    expect(loadingHtml).toContain('aria-busy="true"')

    const forbiddenHtml = renderWithHosts(
      'en',
      React.createElement(InventoryOverview, {
        reloadToken: 0,
        onStockEntry,
        initialError: 'erp.err.forbidden' as MessageKey,
      }),
    )
    expect(forbiddenHtml).toContain('data-state-block="forbidden"')

    const summary: InventorySummary = {
      valuationMinor: 4520500,
      currency: 'KWD',
      itemCount: 18,
      activeItemCount: 16,
      lowStockCount: 2,
      outOfStockCount: 1,
      lowStock: [],
      fastMoving: [],
      windowDays: 30,
      warehouses: [
        {
          id: 'w1',
          code: 'MAIN',
          name: 'Central Store',
          location: null,
          capacity: 1000,
          status: 'active',
          unitsStored: 250,
          version: 1,
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
          createdBy: 'admin',
        },
      ],
    }

    const readyHtml = renderWithHosts(
      'en',
      React.createElement(InventoryOverview, {
        reloadToken: 0,
        onStockEntry,
        initialSummary: summary,
      }),
    )
    expect(readyHtml).toContain('4,520.500')
    expect(readyHtml).toContain('KWD')
    expect(readyHtml).toContain('25%')
  })

  it('renders KitchenWorkspace, OperationsWorkspace, HrWorkspace, and ProcurementWorkspace cleanly', () => {
    const kitchenEmpty = renderWithHosts(
      'ar',
      React.createElement(KitchenWorkspace, {
        permissions: [permissions.inventoryStockAdjust],
        initialPhase: 'ready',
        initialData: { recipes: [], waste: [], productions: [], items: [], warehouses: [] },
      }),
    )
    expect(kitchenEmpty).toContain('data-state-block="empty"')
    expect(kitchenEmpty).not.toContain('<h1')

    const opsReady = renderWithHosts(
      'en',
      React.createElement(OperationsWorkspace, {
        permissions: [permissions.opsContractManage],
        initialTab: 'contracts',
        initialPhase: 'ready',
        initialData: {
          contracts: [
            {
              id: 'c1',
              title: 'Salmiya Kitchen Lease',
              counterparty: 'Al-Noor Real Estate',
              startDate: '2026-01-01',
              endDate: '2027-01-01',
              valueMinor: 12000500,
              renewalAlertDays: 30,
              status: 'active',
              renewalDue: true,
              version: 1,
            },
          ],
          documents: [],
          tickets: [],
        },
      }),
    )
    expect(opsReady).toContain('12,000.500')
    expect(opsReady).toContain('KWD')
    expect(opsReady).toContain('overflow-x-auto')
    expect(opsReady).not.toContain('<h1')

    const hrReady = renderWithHosts(
      'en',
      React.createElement(HrWorkspace, {
        permissions: [permissions.hrEmployeeManage, permissions.hrPayrollRun],
        initialTab: 'payroll',
        initialPhase: 'ready',
        initialData: {
          employees: [
            {
              id: 'e1',
              employeeCode: 'EMP-101',
              fullName: 'Noura Al-Ajmi',
              roleTitle: 'Barista',
              department: 'Operations',
              departmentRoot: 'Operations',
              badgeCode: null,
              workEmail: null,
              workPhone: null,
              mobilePhone: null,
              workLocation: 'Salmiya',
              odooId: null,
              hasRunningContract: true,
              avatarInitials: 'NA',
              avatarPhoto: null,
              branchId: null,
              basicSalaryMinor: 450750,
              allowancesMinor: 50250,
              residencyExpiry: '2026-12-15',
              status: 'active',
              version: 1,
            },
          ],
          dashboard: {
            warnings: {
              withoutRunningContracts: 0,
              missingFromOpenBatches: 0,
              conflicts: 0,
              newContracts: 0,
              timeOffToDefer: 0,
              timeOffWithoutJoinedDocument: 0,
            },
            batches: [],
            employerCostMonthlyMinor: 5420250,
            employerCostAnnualMinor: 65043000,
            trends: {
              newEmployees: 1,
              lastDepartures: 0,
              bars: [],
            },
          },
        },
      }),
    )
    expect(hrReady).toContain('5,420.250')
    expect(hrReady).toContain('KWD')
    expect(hrReady).not.toContain('<h1')

    const procurementForbidden = renderWithHosts(
      'en',
      React.createElement(ProcurementWorkspace, { permissions: [] }),
    )
    expect(procurementForbidden).toContain('data-state-block="forbidden"')
    expect(procurementForbidden).not.toContain('<h1')
  })
})
