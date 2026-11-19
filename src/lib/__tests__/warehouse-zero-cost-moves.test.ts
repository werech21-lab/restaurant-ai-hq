import { describe, expect, it } from 'vitest'
import { computeWarehouseDailyChain } from '@/lib/warehouse-prep-engine'
import type { OdooLiveWarehouseChainPayload } from '@/lib/odoo-live-connector'

describe('warehouse branch table when cost is zero', () => {
  it('shows the move count and quantity for a kitchen transfer whose value is 0', () => {
    const chain = {
      connected: true,
      sourceMode: 'odoo17-live',
      noData: false,
      quantHasValueField: false,
      dateRange: { from: '2026-11-01', to: '2026-11-01' },
      valuation: {
        costedProducts: 0,
        uncostedProducts: 1,
        sources: { standard_price: 0, valuation_layer: 0, purchase_price: 0 },
        onHandCoveragePct: 0,
        movesCoveragePct: 0,
        scrapCoveragePct: 0,
        onHandValued: false,
        movesValued: false,
        scrapValued: false,
      },
      totals: {
        currentOnHandQty: 4,
        currentOnHandValueKwd: 0,
        ckOnHandValueKwd: 0,
        branchesOnHandValueKwd: 0,
        inboundSupplierKwd: 0,
        ckToBranchTransferKwd: 0,
        posConsumptionKwd: 0,
        scrapKwd: 0,
        scrapPctOfConsumption: 0,
        doneMovesCount: 3,
        scrapOrdersCount: 0,
        quantsCount: 1,
      },
      byBranchOnHand: { '360-mall': { qty: 4, valueKwd: 0 } },
      dailyMoves: [
        {
          day: '2026-11-01',
          inboundSupplierKwd: 0,
          inboundSupplierQty: 0,
          ckToBranchTransferKwd: 0,
          ckToBranchTransferQty: 6,
          posConsumptionKwd: 0,
          posConsumptionQty: 0,
          scrapKwd: 0,
          scrapQty: 0,
          movesCount: 3,
          byBranch: {
            '360-mall': {
              receivedFromCkKwd: 0,
              receivedFromCkQty: 6,
              receivedFromCkMoves: 3,
              consumedKwd: 0,
              consumedQty: 0,
              scrapKwd: 0,
              scrapQty: 0,
            },
          },
        },
      ],
      products: [],
      scraps: [],
    } as unknown as OdooLiveWarehouseChainPayload

    const snap = computeWarehouseDailyChain(undefined, undefined, 'all', null, chain)
    const mall = snap.branchPeriodSummary.find((row) => row.branchId === '360-mall')
    expect(mall?.transferMoves).toBe(3)
    expect(mall?.dispatchedKg).toBe(6)
    expect(mall?.dispatchedFromWarehouseKwd).toBe(0)
    expect(mall?.closingStockQty).toBe(4)
    expect(mall?.closingStockKwd).toBe(0)
  })
})
