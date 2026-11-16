import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { planGovernanceWrite, readStoredPinHash } from '@/lib/governance-pin'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { NON_COMPANY_ITEM_SKUS } from '@/lib/odoo/non-company-products'
import { HIDDEN_PANEL_PRODUCT_CODES, isHiddenWarehouseLabel, isInventedPanelLead, visibleProductWhere } from '@/lib/panel-visibility'
import { inventoryValuation } from '@/lib/reports'
import { listLeads } from '@/services/crm.service'
import { listWarehouses } from '@/services/warehouse.service'

const root = process.cwd()
const source = (relative: string) => readFileSync(path.join(root, relative), 'utf8')

describe('phase 7 panel reads', () => {
  it('hides non-company products, invented leads, and excluded warehouses', async () => {
    const products = await prisma.product.findMany({ where: visibleProductWhere(), select: { code: true, name: true } })
    expect(products.some((row) => (NON_COMPANY_ITEM_SKUS as readonly string[]).includes(row.code))).toBe(false)
    expect(products.some((row) => HIDDEN_PANEL_PRODUCT_CODES.includes(row.code))).toBe(false)
    const hidden = await prisma.product.count({ where: { code: { in: [...NON_COMPANY_ITEM_SKUS] } } })
    expect(hidden).toBe(10)

    const leads = await listLeads()
    expect(leads.every((lead) => !isInventedPanelLead(lead.title))).toBe(true)
    expect(await prisma.lead.count()).toBeGreaterThan(leads.length)

    const warehouses = await listWarehouses()
    expect(warehouses.some((row) => /jahra/i.test(`${row.code ?? ''} ${row.name}`))).toBe(false)
    expect(warehouses.some((row) => isExcludedOdooEntity(`${row.code ?? ''} ${row.name} ${row.location ?? ''}`))).toBe(false)
    const jahra = await prisma.warehouse.findFirst({ where: { code: 'JAH' }, select: { id: true } })
    expect(jahra?.id).toBeTruthy()
    expect(await inventoryValuation([jahra?.id ?? ''])).toEqual({ costValue: 0, sellValue: 0 })

    const valuation = await inventoryValuation()
    const stocks = await prisma.warehouseStock.findMany({
      where: { product: visibleProductWhere() },
      include: {
        product: { select: { costPrice: true } },
        warehouse: { select: { code: true, name: true, location: true } },
      },
    })
    const visibleCost = stocks
      .filter((row) => !isHiddenWarehouseLabel([row.warehouse.code, row.warehouse.name, row.warehouse.location]))
      .reduce((sum, row) => sum + row.quantity * row.product.costPrice, 0)
    const allCost = stocks.reduce((sum, row) => sum + row.quantity * row.product.costPrice, 0)
    expect(allCost).toBeGreaterThan(visibleCost)
    expect(valuation.costValue).toBeCloseTo(visibleCost, 4)
  })

  it('does not hide invoices or purchase orders by their first numbers', () => {
    const sales = source('src/app/(panel)/sales/page.tsx')
    const reports = source('src/lib/reports.ts')
    expect(sales).not.toContain('DEMO_INVOICE_NUMBERS')
    expect(sales).toContain('visibleInvoiceWhere')
    expect(reports).not.toContain('DEMO_INVOICE_NUMBERS')
    expect(reports).not.toContain('DEMO_PURCHASE_NUMBERS')
    expect(reports).toContain('visiblePurchaseWhere')
    for (const relative of [
      'src/app/(panel)/reports/page.tsx',
      'src/app/(panel)/warehouses/page.tsx',
      'src/app/(panel)/crm/page.tsx',
      'src/app/(panel)/recipes/page.tsx',
      'src/app/actions/search.ts',
      'src/app/api/panel/search/route.ts',
    ]) {
      expect(source(relative)).toMatch(/visibleProduct/i)
    }
    expect(source('src/services/crm.service.ts')).toContain('visibleLeadWhere')
    expect(source('src/services/warehouse.service.ts')).toContain('isHiddenWarehouseLabel')
  })
})

describe('phase 7 exclusions', () => {
  it('matches the added spellings, prefixes, and digit codes', () => {
    expect(isExcludedOdooEntity('Hawali')).toBe(true)
    expect(isExcludedOdooEntity('Qurein')).toBe(true)
    expect(isExcludedOdooEntity('جهراء')).toBe(true)
    expect(isExcludedOdooEntity('بحولي')).toBe(true)
    expect(isExcludedOdooEntity('وحولي')).toBe(true)
    expect(isExcludedOdooEntity('للجهراء')).toBe(true)
    expect(isExcludedOdooEntity('JHR01')).toBe(true)
    expect(isExcludedOdooEntity('QRN12')).toBe(true)
    expect(isExcludedOdooEntity('محولين كهرباء')).toBe(false)
    expect(isExcludedOdooEntity('حوليات')).toBe(false)
    expect(isExcludedOdooEntity('QRNO')).toBe(false)
    expect(isExcludedOdooEntity('JHRA extra')).toBe(false)
  })
})

describe('phase 7 governance pin', () => {
  it('refuses a write when the load failed and never substitutes a cache hash', () => {
    expect(planGovernanceWrite({ loadFailed: true, purpose: 'settings' })).toBe('refuse')
    expect(planGovernanceWrite({ loadFailed: true, purpose: 'change-pin' })).toBe('refuse')
    expect(planGovernanceWrite({ loadFailed: false, purpose: 'settings' })).toBe('payload-only')
    expect(planGovernanceWrite({ loadFailed: false, purpose: 'change-pin' })).toBe('change-pin')
    const stored = 'vfsha256_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    expect(readStoredPinHash(stored)).toBe(stored)
    expect(readStoredPinHash('vfh1_kept')).toBe('vfh1_kept')
    expect(readStoredPinHash('plain')).toBeNull()
    const route = source('src/app/api/erp/governance/route.ts')
    expect(route).toContain('readStoredPinHash(parsed.pinHash)')
    expect(route).toContain("purpose: 'settings'")
    expect(route).toContain('DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()')
    expect(route).not.toContain("parsed.pinHash.startsWith('vfh1_')")
  })
})

describe('phase 7 governance migration', () => {
  it('denies anon on the governance sync table and is not applied from the app', () => {
    const sql = source('database/migrations/0050_governance_sync_rls.sql')
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON TABLE public.vf_executive_governance_sync FROM PUBLIC, anon, authenticated')
    expect(sql.toLowerCase()).not.toContain('password')
    expect(sql).not.toContain('INSERT INTO')
    expect(source('src/app/api/erp/governance/route.ts')).not.toContain('0050_governance_sync_rls')
  })
})
