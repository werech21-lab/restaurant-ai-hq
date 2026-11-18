/**
 * Warehouse valuation honesty, on the real Odoo export of 31 Oct 2026 (stock.quant quantities; the
 * export carries no product cost). With quantities and no cost, KWD sections are «غير متاح» — never
 * a wall of 0.000 next to real quantities (what production showed on /erp/warehouse-chain).
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CoverageCounter, resolveProductCosts } from '@/lib/odoo/warehouse-valuation'
import { resolveWarehouseValuation } from '@/lib/warehouse-prep-engine'
import type { OdooLiveWarehouseChainPayload } from '@/lib/odoo-live-connector'

const dump = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'database/seeds/venturefoods_odoo_cids1_dump.json'), 'utf8')) as {
  models: { 'stock.quant': { product_id: [number, string]; location_id: [number, string]; quantity: number }[] }
}
const internalQuants = dump.models['stock.quant'].filter((q) => /\/Stock$/.test(q.location_id[1]))
const productIds = [...new Set(internalQuants.map((q) => q.product_id[0]))]
const onHandQty = internalQuants.reduce((s, q) => s + q.quantity, 0)

describe('real export: quantities without cost', () => {
  it('no Odoo cost source → no product is costed (never a 0.000 cost)', () => {
    const costs = resolveProductCosts(productIds, { standardPrice: new Map(), valuationLayer: new Map(), purchase: new Map() })
    expect(costs.size).toBe(0)
  })

  it('coverage of the on-hand quantity is 0% → the on-hand value is not shown', () => {
    const c = new CoverageCounter()
    for (const q of internalQuants) c.add(q.quantity, false)
    expect(c.pct()).toBe(0)
    expect(c.valued()).toBe(false)
  })

  it('a payload with real quantities and all-zero KWD totals (as production returned) infers "not valued"', () => {
    const chain = {
      totals: { currentOnHandQty: onHandQty, currentOnHandValueKwd: 0, inboundSupplierKwd: 0, ckToBranchTransferKwd: 0, posConsumptionKwd: 0, scrapKwd: 0 },
      dailyMoves: [],
      scraps: [],
    } as unknown as OdooLiveWarehouseChainPayload
    expect(onHandQty).toBeGreaterThan(0)
    const v = resolveWarehouseValuation(chain)
    expect(v.onHandValued).toBe(false)
  })

  it('a zero cost from Odoo is not a cost: standard price 0 falls through to the next source or stays unknown', () => {
    const pid = productIds[0]
    const costs = resolveProductCosts([pid], { standardPrice: new Map([[pid, 0]]), valuationLayer: new Map(), purchase: new Map() })
    expect(costs.has(pid)).toBe(false)
  })
})
