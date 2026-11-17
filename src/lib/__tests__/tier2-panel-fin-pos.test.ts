import { readFile } from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/sales',
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

vi.mock('@/app/actions/kds', () => ({
  startPrepAction: vi.fn(),
  toggleItemDoneAction: vi.fn(),
  markReadyAction: vi.fn(),
  bumpTicketAction: vi.fn(),
}))

vi.mock('@/app/actions/delivery', () => ({
  updatePlatformAction: vi.fn(),
  settlePlatformAction: vi.fn(),
}))

vi.mock('@/app/actions/recipes', () => ({
  saveRecipeAction: vi.fn(),
  deleteRecipeAction: vi.fn(),
}))

vi.mock('@/app/actions/crm', () => ({
  moveLeadAction: vi.fn(),
  saveLeadAction: vi.fn(),
  saveQuotationAction: vi.fn(),
  sendQuotationAction: vi.fn(),
  convertQuotationAction: vi.fn(),
}))

vi.mock('@/app/actions/payments', () => ({
  createInvoicePayLinkAction: vi.fn(),
  createInvoicePayLinkByNumberAction: vi.fn(),
  createSubscriptionPayLinkAction: vi.fn(),
}))

vi.mock('@/app/actions/warehouses', () => ({
  saveWarehouseAction: vi.fn(),
  transferStockAction: vi.fn(),
}))

import { KdsBoard } from '@/app/(kds)/kds/kds-board'
import { VentureKdsHub } from '@/components/kds/VentureKdsHub'
import { PosTerminal } from '@/app/(pos)/pos/pos-terminal'
import { VenturePosHub } from '@/components/pos/VenturePosHub'
import { ReconciliationClient } from '@/app/(panel)/accounting/reconciliation/recon-client'
import { CrmBoard, QuoteActions } from '@/app/(panel)/crm/crm-board'
import { VentureCrmHub } from '@/components/crm/VentureCrmHub'
import { DeliveryHubPanel } from '@/app/(panel)/delivery-hub/delivery-hub-panel'
import { InventoryPanel } from '@/app/(panel)/inventory/inventory-panel'
import {
  InvoicePayLinkButton,
  PaymentCreateForms,
  PaymentsEmptyBlock,
} from '@/app/(panel)/payments/payment-forms'
import { VenturePurchasesHub } from '@/components/purchases/VenturePurchasesHub'
import { RecipesPanel } from '@/app/(panel)/recipes/recipes-panel'
import { VentureRecipesHub } from '@/components/recipes/VentureRecipesHub'
import { SalesCommandCenter } from '@/components/sales/SalesCommandCenter'
import { StockCountView } from '@/app/(panel)/stock-count/stock-count-view'
import { VentureWarehousesHub } from '@/components/warehouses/VentureWarehousesHub'
import {
  WarehouseForms,
  isStockTransferProduct,
} from '@/app/(panel)/warehouses/warehouse-forms'
import { LanguageProvider } from '@/lib/i18n'

const TypedLangProvider = LanguageProvider as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

function renderWithLang(locale: 'ar' | 'en', node: React.ReactElement): string {
  return renderToStaticMarkup(
    React.createElement(TypedLangProvider, { initialLocale: locale }, node),
  )
}

const OWNED_FILES = [
  'src/app/(kds)/kds/kds-board.tsx',
  'src/app/(kds)/kds/page.tsx',
  'src/components/kds/VentureKdsHub.tsx',
  'src/app/(pos)/pos/page.tsx',
  'src/app/(pos)/pos/pos-terminal.tsx',
  'src/components/pos/VenturePosHub.tsx',
  'src/app/(panel)/accounting/page.tsx',
  'src/app/(panel)/accounting/reconciliation/page.tsx',
  'src/app/(panel)/accounting/reconciliation/recon-client.tsx',
  'src/app/(panel)/central-kitchen/page.tsx',
  'src/app/(panel)/crm/crm-board.tsx',
  'src/app/(panel)/crm/page.tsx',
  'src/components/crm/VentureCrmHub.tsx',
  'src/app/(panel)/delivery-hub/delivery-hub-panel.tsx',
  'src/app/(panel)/delivery-hub/page.tsx',
  'src/app/(panel)/inventory/inventory-panel.tsx',
  'src/app/(panel)/inventory/page.tsx',
  'src/app/(panel)/payments/page.tsx',
  'src/app/(panel)/payments/payment-forms.tsx',
  'src/app/(panel)/purchases/page.tsx',
  'src/app/(panel)/purchases/suppliers/[id]/page.tsx',
  'src/components/purchases/VenturePurchasesHub.tsx',
  'src/app/(panel)/recipes/page.tsx',
  'src/app/(panel)/recipes/recipes-panel.tsx',
  'src/components/recipes/VentureRecipesHub.tsx',
  'src/app/(panel)/sales/page.tsx',
  'src/app/(panel)/sales/customers/[id]/page.tsx',
  'src/components/sales/SalesCommandCenter.tsx',
  'src/app/(panel)/stock-count/page.tsx',
  'src/app/(panel)/stock-count/stock-count-view.tsx',
  'src/app/(panel)/warehouses/page.tsx',
  'src/app/(panel)/warehouses/warehouse-forms.tsx',
  'src/components/warehouses/VentureWarehousesHub.tsx',
] as const

describe('Tier 2 (panel) Finance/Sales/Purchases/Inventory/Warehouses + POS & KDS Audits', () => {
  it('renders /kds and /pos hubs with large touch targets (min-h-11), honest unlinked StateBlock, 3-decimal KWD, and zero Arabic in EN', () => {
    const kdsAr = renderToStaticMarkup(React.createElement(VentureKdsHub, { locale: 'ar' }))
    const kdsEn = renderToStaticMarkup(React.createElement(VentureKdsHub, { locale: 'en' }))
    expect(kdsAr).toContain('dir="rtl"')
    expect(kdsAr).toContain('data-state-block="unlinked"')
    expect(kdsAr).toContain('min-h-11')
    expect(kdsEn).toContain('dir="ltr"')
    expect(kdsEn).toContain('data-state-block="unlinked"')
    expect(kdsEn).toContain('min-h-11')
    expect(kdsEn).not.toContain('غير مربوط بمصدر')

    const kdsBoardEn = renderWithLang('en', React.createElement(KdsBoard))
    expect(kdsBoardEn).toContain('dir="ltr"')
    expect(kdsBoardEn).toContain('data-state-block="loading"')
    expect(kdsBoardEn).toContain('min-h-11')
    expect(kdsBoardEn).toContain('Kitchen Display')

    const posAr = renderToStaticMarkup(React.createElement(VenturePosHub, { locale: 'ar' }))
    const posEn = renderToStaticMarkup(React.createElement(VenturePosHub, { locale: 'en' }))
    expect(posAr).toContain('dir="rtl"')
    expect(posAr).toContain('data-state-block="unlinked"')
    expect(posAr).toContain('min-h-11')
    expect(posEn).toContain('dir="ltr"')
    expect(posEn).toContain('data-state-block="unlinked"')
    expect(posEn).toContain('min-h-11')
    expect(posEn).not.toContain('غير مربوط بمصدر')

    const posTermEn = renderWithLang(
      'en',
      React.createElement(PosTerminal, {
        products: [],
        walkInId: 'walk-in',
        customers: [],
        brands: [],
        branches: [],
        orderTypes: [],
      }),
    )
    expect(posTermEn).toContain('0.000 KWD')
    expect(posTermEn).toContain('data-state-block="unlinked"')
    expect(posTermEn).toContain('min-h-11')
  })

  it('renders ReconciliationClient with 3-decimal KWD, formatInt KPIs, overflow-x-auto DataTable, and loading/error/empty states', () => {
    const data = {
      summary: {
        total: 12,
        matched: 10,
        shortfall: 1,
        overCommission: 1,
        review: 0,
        bankHint: '10143 / 10212 NBK',
      },
      matches: [
        {
          id: 'm1',
          source: 'Talabat Nov 14',
          platform: 'TALABAT',
          channel: 'TGO',
          expectedCommissionBps: 1700,
          gross: 1250.375,
          commission: 212.564,
          net: 1037.811,
          bankHint: '10143 NBK',
          status: 'MATCHED' as const,
          noteAr: 'مطابق TGO',
          noteEn: 'Matched TGO',
        },
      ],
    }

    const enHtml = renderToStaticMarkup(
      React.createElement(ReconciliationClient, { initial: data, locale: 'en' }),
    )
    expect(enHtml).toContain('dir="ltr"')
    expect(enHtml).toContain('data-data-table="true"')
    expect(enHtml).toContain('data-table-scroll="true"')
    expect(enHtml).toContain('1,250.375 KWD')
    expect(enHtml).toContain('212.564 KWD')
    expect(enHtml).toContain('1,037.811 KWD')
    expect(enHtml).toContain('17%')
    expect(enHtml).toContain('Matched')

    const arHtml = renderToStaticMarkup(
      React.createElement(ReconciliationClient, { initial: data, locale: 'ar' }),
    )
    expect(arHtml).toContain('dir="rtl"')
    expect(arHtml).toContain('1,250.375 د.ك')
    expect(arHtml).toContain('مطابق')

    const emptyHtml = renderToStaticMarkup(
      React.createElement(ReconciliationClient, {
        initial: { ...data, matches: [] },
        locale: 'en',
      }),
    )
    expect(emptyHtml).toContain('data-state-block="empty"')

    const loadingHtml = renderToStaticMarkup(
      React.createElement(ReconciliationClient, { initial: data, locale: 'ar', loading: true }),
    )
    expect(loadingHtml).toContain('data-state-block="loading"')

    const errorHtml = renderToStaticMarkup(
      React.createElement(ReconciliationClient, { initial: data, locale: 'en', error: true }),
    )
    expect(errorHtml).toContain('data-state-block="error"')
  })

  it('renders DeliveryHubPanel with complete AR/EN parity, 3-decimal KWD, and Asia/Kuwait timestamps', () => {
    const platforms = [
      {
        code: 'TALABAT',
        nameAr: 'طلبات',
        nameEn: 'Talabat',
        commissionPercent: 22,
        fixedFeeKwd: 0.15,
        orderCount: 15,
        grossSales: 842.5,
        commissionTotal: 185.35,
        deliveryFeeTotal: 12.25,
        marketingDiscountTotal: 5.0,
        netPayout: 664.4,
      },
    ]
    const orders = [
      {
        id: 'o1',
        platformCode: 'TALABAT',
        invoiceNumber: 'INV-00412',
        grossAmount: 42.125,
        commissionAmount: 9.268,
        netPayout: 32.857,
        createdAt: '2026-11-15T21:30:00.000Z', // 2026-11-16 00:30 Asia/Kuwait
      },
    ]

    const arHtml = renderWithLang(
      'ar',
      React.createElement(DeliveryHubPanel, {
        platforms,
        orders,
        brandCode: null,
        canEdit: true,
        canSettle: true,
      }),
    )
    expect(arHtml).toContain('dir="rtl"')
    expect(arHtml).toContain('842.500 د.ك')
    expect(arHtml).toContain('2026-11-16 00:30')
    expect(arHtml).not.toContain('Gross Sales')
    expect(arHtml).not.toContain('Net Payout')

    const enHtml = renderWithLang(
      'en',
      React.createElement(DeliveryHubPanel, {
        platforms,
        orders: [],
        brandCode: null,
        canEdit: false,
        canSettle: false,
      }),
    )
    expect(enHtml).toContain('dir="ltr"')
    expect(enHtml).toContain('842.500 KWD')
    expect(enHtml).toContain('data-state-block="empty"')
  })

  it('renders VentureCrmHub, CrmBoard, and QuoteActions with AR/EN parity, 3-decimal KWD, and empty/unlinked states', () => {
    const crmAr = renderToStaticMarkup(React.createElement(VentureCrmHub, { locale: 'ar' }))
    const crmEn = renderToStaticMarkup(React.createElement(VentureCrmHub, { locale: 'en' }))
    expect(crmAr).toContain('لا توجد عقود كاترينج مرتبطة')
    expect(crmAr).toContain('data-state-block="unlinked"')
    expect(crmEn).toContain('No catering contracts are linked')
    expect(crmEn).not.toContain('لا توجد عقود كاترينج مرتبطة')

    const boardEn = renderToStaticMarkup(
      React.createElement(CrmBoard, {
        leads: [],
        canEdit: true,
        canCreate: true,
        customers: [],
        products: [{ id: 'p1', name: 'Chicken Box', price: 3.5 }],
        locale: 'en',
      }),
    )
    expect(boardEn).toContain('dir="ltr"')
    expect(boardEn).toContain('3.500 KWD')
    expect(boardEn).toContain('data-state-block="empty"')
    expect(boardEn).not.toContain('فرصة جديدة')

    const quoteEn = renderToStaticMarkup(
      React.createElement(QuoteActions, { id: 'q1', status: 'DRAFT', locale: 'en' }),
    )
    expect(quoteEn).toContain('Convert to sales invoice')
    expect(quoteEn).not.toContain('تحويل إلى فاتورة مبيعات')
  })

  it('renders InventoryPanel, RecipesPanel, StockCountView, PaymentCreateForms, WarehouseForms, and Venture hubs cleanly in AR & EN', () => {
    const invEn = renderWithLang(
      'en',
      React.createElement(InventoryPanel, {
        tab: 'products',
        q: '',
        page: 1,
        total: 0,
        filter: '',
        products: [],
        categories: [],
        movements: [],
        canCreate: false,
        canEdit: false,
        canDelete: false,
      }),
    )
    expect(invEn).toContain('data-state-block="unlinked"')
    expect(invEn).not.toContain('غير مربوط بمصدر')

    const recEn = renderWithLang(
      'en',
      React.createElement(RecipesPanel, {
        rows: [
          {
            id: 'r1',
            name: 'وصفة دجاج',
            nameEn: 'Chicken Bowl',
            brandCode: 'china-garden',
            menuProductId: 'm1',
            menuCode: 'CG-101',
            menuName: 'Chicken Bowl',
            sellingPrice: 4.5,
            ingredientCost: 1.463,
            foodCostPercent: 32.5,
            marginPercent: 67.5,
            targetFoodCostPercent: 30,
            overTarget: true,
            lineCount: 4,
            active: true,
          },
        ],
        products: [],
        brands: [],
        canCreate: false,
        canEdit: false,
        canDelete: false,
      }),
    )
    expect(recEn).toContain('4.500 KWD')
    expect(recEn).toContain('1.463 KWD')
    expect(recEn).toContain('32.5%')
    expect(recEn).toContain('67.5%')

    const stockEn = renderToStaticMarkup(
      React.createElement(StockCountView, {
        locale: 'en',
        scopeLabel: 'All Branches',
        lowCount: 4,
        lowItems: [
          {
            id: 'i1',
            name: 'Soy Sauce',
            code: 'RW-001',
            currentStock: 2,
            reorderLevel: 10,
            estCostKwd: 5.75,
          },
        ],
      }),
    )
    expect(stockEn).toContain('5.750 KWD')
    expect(stockEn).toContain('data-data-table="true"')

    const stockEmptyAr = renderToStaticMarkup(
      React.createElement(StockCountView, {
        locale: 'ar',
        scopeLabel: 'كل الفروع',
        lowCount: 0,
        lowItems: [],
      }),
    )
    expect(stockEmptyAr).toContain('data-state-block="empty"')

    const payFormsEn = renderToStaticMarkup(
      React.createElement(PaymentCreateForms, {
        organizations: [{ id: 'org1', name: 'Venture Foods' }],
        locale: 'en',
      }),
    )
    expect(payFormsEn).toContain('step="0.001"')
    expect(payFormsEn).toContain('Amount (KWD)')

    const payLinkEn = renderToStaticMarkup(
      React.createElement(InvoicePayLinkButton, { invoiceId: 'inv-1', locale: 'en' }),
    )
    expect(payLinkEn).toContain('Generate payment link')

    const payEmptyAr = renderToStaticMarkup(
      React.createElement(PaymentsEmptyBlock, { locale: 'ar' }),
    )
    expect(payEmptyAr).toContain('data-state-block="empty"')

    for (const Hub of [VenturePurchasesHub, VentureRecipesHub, VentureWarehousesHub]) {
      const en = renderToStaticMarkup(React.createElement(Hub, { locale: 'en' }))
      expect(en).toContain('data-state-block="unlinked"')
      expect(en).not.toContain('غير مربوط بمصدر')
    }

    const salesHubEn = renderToStaticMarkup(
      React.createElement(SalesCommandCenter, { initialLocale: 'en' }),
    )
    expect(salesHubEn).toContain('data-state-block="unlinked"')
    expect(salesHubEn).not.toContain('غير مربوط بمصدر')

    const whFormsEn = renderWithLang(
      'en',
      React.createElement(WarehouseForms, {
        warehouses: [{ id: 'w1', name: 'Central Kitchen' }],
        products: [{ id: 'p1', name: 'Beef', code: 'RW-100' }],
        canCreate: true,
      }),
    )
    expect(whFormsEn).toContain('Inter-Branch Stock Transfer')
    expect(isStockTransferProduct({ id: 'p1', name: '10% on your order', code: 'DISC-10' })).toBe(false)
    expect(isStockTransferProduct({ id: 'p2', name: 'Beef', code: 'RW-100' })).toBe(true)
  })

  it('passes strict static guardrails (zero sub-12px fonts, console.*, any, @ts-ignore, banned buzzwords, croissant/avocado, or toFixed) across all owned files', async () => {
    for (const rel of OWNED_FILES) {
      const full = path.join(process.cwd(), rel)
      const content = await readFile(full, 'utf8')
      expect(content, `${rel} sub-12px`).not.toMatch(/text-\[(?:10|10\.5|11|11\.5)px\]/)
      expect(content, `${rel} console.*`).not.toMatch(/\bconsole\.(log|debug|info|warn|error)\b/)
      expect(content, `${rel} explicit any`).not.toMatch(/:\s*any\b|\bas any\b|<any>/)
      expect(content, `${rel} ts-ignore`).not.toMatch(/@ts-(ignore|nocheck)/)
      expect(content, `${rel} banned buzzwords`).not.toMatch(
        /\bWatchdog\b|Verified Executive|Live Odoo|سجل التدقيق/i,
      )
      expect(content, `${rel} banned demo food/excluded`).not.toMatch(
        /croissant|avocado|hawall|qurain|heisenberg|jahra/i,
      )
      expect(content, `${rel} raw toFixed`).not.toMatch(/\.toFixed\s*\(/)
    }

    const salesPage = await readFile(path.join(process.cwd(), 'src/app/(panel)/sales/page.tsx'), 'utf8')
    expect(salesPage).toContain('visibleInvoiceWhere')
    expect(salesPage).toContain('visibleProductWhere')
    expect(salesPage).toContain('scopeWarehouseIds')

    const purchasesPage = await readFile(path.join(process.cwd(), 'src/app/(panel)/purchases/page.tsx'), 'utf8')
    expect(purchasesPage).toContain('visiblePurchaseWhere')

    const warehousesPage = await readFile(path.join(process.cwd(), 'src/app/(panel)/warehouses/page.tsx'), 'utf8')
    expect(warehousesPage).toContain('visibleProductWhere')
  })
})
