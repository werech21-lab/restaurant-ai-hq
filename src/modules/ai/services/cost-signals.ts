import type { Queryable } from '@/lib/db'
import type { CostScenarioInput } from '@/modules/ai/domain/scenarios'
import { listOpenCommissionWithin } from '@/modules/delivery'
import { listCostVariancesWithin, readItemCostsWithin } from '@/modules/inventory'
import { listWasteQuantitiesWithin } from '@/modules/kitchen'

/** Live variance, waste and unsettled commission. Reads other modules only through their public API. */
export async function gatherCostScenario(tx: Queryable, tenantId: string): Promise<CostScenarioInput> {
  const lines = await listCostVariancesWithin(tx, tenantId)
  const quantities = await listWasteQuantitiesWithin(tx, tenantId)
  const costs = new Map((await readItemCostsWithin(tx, tenantId, quantities.map((row) => row.itemId))).map((row) => [row.itemId, row]))
  const waste = quantities.flatMap((row) => {
    const cost = costs.get(row.itemId)
    if (!cost) return []
    return [{ itemId: row.itemId, quantity: row.quantity, unitCostMinor: cost.unitCostMinor, sellingPriceMinor: cost.sellingPriceMinor, onHand: cost.onHand }]
  })
  const commission = await listOpenCommissionWithin(tx, tenantId)
  return { lines, waste, commissionMinor: commission.commissionMinor }
}
