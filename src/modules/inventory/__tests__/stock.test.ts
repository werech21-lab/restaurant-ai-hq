import { describe, expect, it } from 'vitest'
import { DomainError } from '@/lib/domain-error'
import { CurrencyMismatchError, money, type Money } from '@/lib/money'
import {
  becameDepleted,
  findShortages,
  invoiceNeeds,
  isLowStock,
  pairKey,
  planMovement,
  reachedReorderLevel,
  stockNeeds,
  stockValue,
  totalValue,
  utilizationPercent,
} from '@/modules/inventory/domain/stock'

const ITEM = '11111111-1111-4111-8111-111111111111'
const OTHER_ITEM = '22222222-2222-4222-8222-222222222222'
const WH_A = '33333333-3333-4333-8333-333333333333'
const WH_B = '44444444-4444-4444-8444-444444444444'
const TRANSFER_ID = '55555555-5555-4555-8555-555555555555'
const usd = { amountMinor: 100, currency: 'USD' } as unknown as Money

function expectDomainCode(run: () => unknown, code: string) {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe(code)
    return
  }
  throw new Error(`Expected DomainError ${code}`)
}

describe('planMovement', () => {
  it('writes IN as a positive row and OUT as a negative row', () => {
    const [stockIn] = planMovement({ type: 'IN', itemId: ITEM, warehouseId: WH_A, quantity: 5, note: null }, TRANSFER_ID)
    expect(stockIn).toMatchObject({ movementType: 'IN', quantity: 5, referenceType: 'manual', referenceId: null })
    const [stockOut] = planMovement({ type: 'OUT', itemId: ITEM, warehouseId: WH_A, quantity: 5, note: 'Damaged' }, TRANSFER_ID)
    expect(stockOut).toMatchObject({ movementType: 'OUT', quantity: -5, note: 'Damaged' })
  })

  it('writes a transfer as two rows that share one id and cancel each other out', () => {
    const rows = planMovement({ type: 'TRANSFER', itemId: ITEM, fromWarehouseId: WH_A, toWarehouseId: WH_B, quantity: 7, note: null }, TRANSFER_ID)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ warehouseId: WH_A, quantity: -7, referenceType: 'transfer', referenceId: TRANSFER_ID })
    expect(rows[1]).toMatchObject({ warehouseId: WH_B, quantity: 7, referenceType: 'transfer', referenceId: TRANSFER_ID })
    expect(rows.reduce((sum, row) => sum + row.quantity, 0)).toBe(0)
  })

  it('rejects zero, negative, fractional and oversized quantities', () => {
    for (const quantity of [0, -1, 1.5, 1_000_001, Number.NaN]) {
      expectDomainCode(() => planMovement({ type: 'IN', itemId: ITEM, warehouseId: WH_A, quantity, note: null }, TRANSFER_ID), 'invalid_quantity')
    }
  })

  it('accepts the largest allowed quantity', () => {
    expect(planMovement({ type: 'IN', itemId: ITEM, warehouseId: WH_A, quantity: 1_000_000, note: null }, TRANSFER_ID)[0].quantity).toBe(1_000_000)
  })

  it('rejects a transfer to the same warehouse', () => {
    expectDomainCode(
      () => planMovement({ type: 'TRANSFER', itemId: ITEM, fromWarehouseId: WH_A, toWarehouseId: WH_A, quantity: 1, note: null }, TRANSFER_ID),
      'same_warehouse'
    )
  })
})

describe('stockNeeds and findShortages', () => {
  it('asks only for the stock that leaves a warehouse', () => {
    const rows = planMovement({ type: 'TRANSFER', itemId: ITEM, fromWarehouseId: WH_A, toWarehouseId: WH_B, quantity: 7, note: null }, TRANSFER_ID)
    expect(stockNeeds(rows)).toEqual([{ itemId: ITEM, warehouseId: WH_A, quantity: 7 }])
  })

  it('needs nothing for an IN movement', () => {
    expect(stockNeeds(planMovement({ type: 'IN', itemId: ITEM, warehouseId: WH_A, quantity: 3, note: null }, TRANSFER_ID))).toEqual([])
  })

  it('nets inflows against outflows of the same item and warehouse', () => {
    const needs = stockNeeds([
      { itemId: ITEM, warehouseId: WH_A, movementType: 'OUT', quantity: -10, referenceType: 'invoice', referenceId: TRANSFER_ID, note: null },
      { itemId: ITEM, warehouseId: WH_A, movementType: 'IN', quantity: 4, referenceType: 'invoice', referenceId: TRANSFER_ID, note: null },
    ])
    expect(needs).toEqual([{ itemId: ITEM, warehouseId: WH_A, quantity: 6 }])
  })

  it('reports a shortage when stock is below the need, and treats a missing balance as zero', () => {
    const needs = [
      { itemId: ITEM, warehouseId: WH_A, quantity: 5 },
      { itemId: OTHER_ITEM, warehouseId: WH_A, quantity: 1 },
    ]
    const available = new Map([[pairKey(ITEM, WH_A), 4]])
    expect(findShortages(needs, available)).toEqual([
      { itemId: ITEM, warehouseId: WH_A, quantity: 5, available: 4 },
      { itemId: OTHER_ITEM, warehouseId: WH_A, quantity: 1, available: 0 },
    ])
  })

  it('accepts a need that equals the stock on hand exactly', () => {
    expect(findShortages([{ itemId: ITEM, warehouseId: WH_A, quantity: 4 }], new Map([[pairKey(ITEM, WH_A), 4]]))).toEqual([])
  })
})

describe('invoiceNeeds', () => {
  it('adds up lines for the same item and warehouse and ignores lines without an item', () => {
    const needs = invoiceNeeds([
      { itemId: ITEM, warehouseId: WH_A, quantity: 2 },
      { itemId: ITEM, warehouseId: WH_A, quantity: 3 },
      { itemId: ITEM, warehouseId: WH_B, quantity: 1 },
      { itemId: null, warehouseId: null, quantity: 99 },
    ])
    expect(needs).toEqual([
      { itemId: ITEM, warehouseId: WH_A, quantity: 5 },
      { itemId: ITEM, warehouseId: WH_B, quantity: 1 },
    ])
  })

  it('is empty for an invoice with only service lines', () => {
    expect(invoiceNeeds([{ itemId: null, warehouseId: null, quantity: 3 }])).toEqual([])
  })

  it('rejects a line quantity that is zero or fractional', () => {
    expectDomainCode(() => invoiceNeeds([{ itemId: ITEM, warehouseId: WH_A, quantity: 0 }]), 'invalid_quantity')
    expectDomainCode(() => invoiceNeeds([{ itemId: ITEM, warehouseId: WH_A, quantity: 1.5 }]), 'invalid_quantity')
  })
})

describe('reorder and depletion rules', () => {
  it('fires when stock crosses down to the reorder level, once per crossing', () => {
    expect(reachedReorderLevel(11, 10, 10)).toBe(true)
    expect(reachedReorderLevel(11, 3, 10)).toBe(true)
    expect(reachedReorderLevel(10, 9, 10)).toBe(false)
    expect(reachedReorderLevel(20, 15, 10)).toBe(false)
    expect(reachedReorderLevel(5, 8, 10)).toBe(false)
  })

  it('handles a reorder level of zero', () => {
    expect(reachedReorderLevel(1, 0, 0)).toBe(true)
    expect(reachedReorderLevel(0, 0, 0)).toBe(false)
  })

  it('flags depletion only when stock reaches exactly zero from above', () => {
    expect(becameDepleted(3, 0)).toBe(true)
    expect(becameDepleted(0, 0)).toBe(false)
    expect(becameDepleted(3, 1)).toBe(false)
  })

  it('treats stock at or below the level as low', () => {
    expect(isLowStock(10, 10)).toBe(true)
    expect(isLowStock(11, 10)).toBe(false)
    expect(isLowStock(0, 0)).toBe(true)
  })
})

describe('stock valuation', () => {
  it('multiplies quantity by unit cost in whole fils', () => {
    expect(stockValue(12, money(2_500)).amountMinor).toBe(30_000)
    expect(stockValue(1, money(1)).amountMinor).toBe(1)
  })

  it('is zero for no stock or no cost', () => {
    expect(stockValue(0, money(2_500)).amountMinor).toBe(0)
    expect(stockValue(10, money(0)).amountMinor).toBe(0)
  })

  it('rejects negative or fractional quantities and negative costs', () => {
    expectDomainCode(() => stockValue(-1, money(100)), 'invalid_quantity')
    expectDomainCode(() => stockValue(1.5, money(100)), 'invalid_quantity')
    expectDomainCode(() => stockValue(1, money(-100)), 'invalid_cost')
  })

  it('refuses a value beyond the safe integer range instead of losing digits', () => {
    expectDomainCode(() => stockValue(100_000_000, money(1_000_000_000)), 'amount_too_large')
  })

  it('sums values and rejects a currency mismatch', () => {
    expect(totalValue([money(100), money(250), money(0)]).amountMinor).toBe(350)
    expect(totalValue([]).amountMinor).toBe(0)
    expect(() => totalValue([money(100), usd])).toThrow(CurrencyMismatchError)
  })
})

describe('utilizationPercent', () => {
  it('rounds to a whole percent and handles missing and zero capacity', () => {
    expect(utilizationPercent(50, 200)).toBe(25)
    expect(utilizationPercent(1, 3)).toBe(33)
    expect(utilizationPercent(0, 100)).toBe(0)
    expect(utilizationPercent(5, null)).toBeNull()
    expect(utilizationPercent(0, 0)).toBe(0)
    expect(utilizationPercent(5, 0)).toBe(100)
    expect(utilizationPercent(150, 100)).toBe(150)
  })
})
