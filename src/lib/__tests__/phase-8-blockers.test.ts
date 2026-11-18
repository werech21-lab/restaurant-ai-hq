import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { DEFAULT_MASTER_PIN_HASH } from '@/lib/governance-compliance'
import { planPinCheck, planPinWrite } from '@/lib/governance-pin'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { isHiddenWarehouseLabel, visibleProductWhere } from '@/lib/panel-visibility'
import { costOfGoods, inventoryValuation, salesSummary, scopeWarehouseIds } from '@/lib/reports'
import { countLowStock } from '@/lib/stock'

const source = (relative: string) => readFileSync(path.join(process.cwd(), relative), 'utf8')

describe('phase 8 exclusions', () => {
  it('matches the added spellings and keeps a leading kaf', () => {
    expect(isExcludedOdooEntity('Hawaly')).toBe(false) // Hawally not excluded (owner decision 2026-11-18)
    expect(isExcludedOdooEntity('Gurain')).toBe(true)
    expect(isExcludedOdooEntity('Jahara')).toBe(true)
    expect(isExcludedOdooEntity('الجهرا')).toBe(true)
    expect(isExcludedOdooEntity('Heizenberg')).toBe(true)
    expect(isExcludedOdooEntity('H e i s e n b e r g')).toBe(true)
    expect(isExcludedOdooEntity('كحولي')).toBe(false)
    expect(isExcludedOdooEntity('معقم كحولي')).toBe(false)
    expect(isExcludedOdooEntity('بحولي')).toBe(false)
  })
})

describe('phase 8 warehouse scope', () => {
  it('values, sells, costs and counts low stock on visible warehouses only', async () => {
    const visibleIds = await scopeWarehouseIds()
    const hidden = await prisma.warehouse.findMany({
      select: { id: true, code: true, name: true, location: true },
    })
    const hiddenIds = hidden
      .filter((row) => isHiddenWarehouseLabel([row.code, row.name, row.location]))
      .map((row) => row.id)
    expect(hiddenIds.length).toBeGreaterThan(0)
    expect(visibleIds.some((id) => hiddenIds.includes(id))).toBe(false)

    const stocks = await prisma.warehouseStock.findMany({
      where: { product: visibleProductWhere() },
      include: { product: { select: { costPrice: true, reorderLevel: true } } },
    })
    const visibleCost = stocks
      .filter((row) => visibleIds.includes(row.warehouseId))
      .reduce((sum, row) => sum + row.quantity * row.product.costPrice, 0)
    const productCost = (
      await prisma.product.findMany({ where: visibleProductWhere(), select: { currentStock: true, costPrice: true } })
    ).reduce((sum, row) => sum + row.currentStock * row.costPrice, 0)
    const valuation = await inventoryValuation()
    expect(valuation.costValue).toBeCloseTo(visibleCost, 4)
    expect(valuation.costValue).not.toBeCloseTo(productCost, 4)

    const jahra = hidden.find((row) => row.code === 'JAH')
    expect(await inventoryValuation([jahra?.id ?? ''])).toEqual({ costValue: 0, sellValue: 0 })
    expect(await salesSummary(undefined, undefined, hiddenIds)).toEqual({ total: 0, count: 0 })
    expect(await costOfGoods(undefined, undefined, hiddenIds)).toBe(0)

    const low = await countLowStock()
    const byProduct = new Map<string, { qty: number; reorder: number }>()
    for (const row of stocks) {
      if (!visibleIds.includes(row.warehouseId)) continue
      const prev = byProduct.get(row.productId)
      if (prev) prev.qty += row.quantity
      else byProduct.set(row.productId, { qty: row.quantity, reorder: row.product.reorderLevel })
    }
    const expectedLow = [...byProduct.values()].filter((row) => row.qty <= row.reorder).length
    expect(low).toBe(expectedLow)
  })

  it('keeps a document that still has a real line and filters exports', () => {
    const visibility = source('src/lib/panel-visibility.ts')
    expect(visibility).toContain('items: { some: { product: visibleProductWhere() } }')
    expect(visibility).not.toContain('NOT: { items: { some:')
    const sales = source('src/app/(panel)/sales/page.tsx')
    const purchases = source('src/app/(panel)/purchases/page.tsx')
    const exports = source('src/services/report.service.ts')
    const bi = source('src/services/bi.service.ts')
    expect(sales).toContain('scopeWarehouseIds')
    expect(sales).toContain('visibleProductWhere')
    expect(purchases).toContain('visiblePurchaseWhere')
    expect(exports).toContain('visibleInvoiceWhere')
    expect(exports).toContain('scopeWarehouseIds')
    expect(bi).toContain('scopeWarehouseIds')
    expect(bi).toContain('HIDDEN_PANEL_PRODUCT_CODES')
  })
})

describe('phase 8 pin and database', () => {
  it('fails closed when the governance read is down, including after the pool returns', () => {
    const down = {
      loadFailed: true,
      postgresConfigured: true,
      poolAvailable: false,
      pinHash: DEFAULT_MASTER_PIN_HASH,
      initialEmpty: true,
    }
    expect(planPinCheck(down)).toBe('deny')
    expect(planPinCheck({ ...down, pinHash: '', poolAvailable: true })).toBe('deny')
    expect(
      planPinWrite({
        loadFailed: true,
        postgresConfigured: true,
        poolAvailable: true,
        purpose: 'change-pin',
      }),
    ).toBe('refuse')
    expect(planPinCheck({ ...down, loadFailed: false, poolAvailable: true, pinHash: DEFAULT_MASTER_PIN_HASH, initialEmpty: false })).toBe('stored')
    const route = source('src/app/api/erp/governance/route.ts')
    expect(route).toContain('failedGovernanceEnvelope')
    expect(route).toContain("pinHash: ''")
  })

  it('points the test database at a temp copy', () => {
    expect(process.env.SQLITE_URL ?? '').toContain(`/tmp/aetherbi-vitest-${process.pid}.db`)
    expect(source('src/lib/db.ts')).toContain('aetherbi-vitest-')
    expect(source('src/lib/db.ts')).not.toContain('prisma/dev.db`')
  })
})
