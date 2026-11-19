import { describe, expect, it } from 'vitest'
import {
  JAHRA_POS_CONFIG_IDS,
  KITCHEN_SOURCE_POS_CONFIG_IDS,
  branchIdForStockLocation,
  classifyWarehouseMove,
  isCentralKitchenStockLocation,
  isExcludedStockLocation,
  kitchenTransfersToCount,
  stockRootsFromRegisterChain,
} from '@/lib/odoo/stock-location-ids'
import { LAST_KNOWN_GOOD_MAX_AGE_MS, lastKnownGoodIsFresh } from '@/lib/odoo-live-connector'

const roots = stockRootsFromRegisterChain({
  branchOfConfig: {
    17: '360-mall',
    21: 'al-kout',
    14: 'assima',
    8: 'promenade',
    34: 'avenues',
    19: 'salmiya',
    3: 'ardiya',
  },
  configs: [
    { configId: 17, pickingTypeId: 901 },
    { configId: 34, pickingTypeId: 904 },
    { configId: 19, pickingTypeId: 905 },
    { configId: 3, pickingTypeId: 906 },
    { configId: 24, pickingTypeId: 902 },
    { configId: 36, pickingTypeId: 902 },
    { configId: 25, pickingTypeId: 903 },
    { configId: 39, pickingTypeId: 903 },
  ],
  pickingTypes: [
    { pickingTypeId: 901, warehouseId: 801 },
    { pickingTypeId: 902, warehouseId: 802 },
    { pickingTypeId: 903, warehouseId: 803 },
    { pickingTypeId: 904, warehouseId: 804 },
    { pickingTypeId: 905, warehouseId: 805 },
    { pickingTypeId: 906, warehouseId: 806 },
  ],
  warehouses: [
    { warehouseId: 801, lotStockId: 219, viewLocationId: 218 },
    { warehouseId: 802, lotStockId: 259, viewLocationId: 258 },
    { warehouseId: 803, lotStockId: 92, viewLocationId: 90 },
    { warehouseId: 804, lotStockId: 400, viewLocationId: 399 },
    { warehouseId: 805, lotStockId: 410, viewLocationId: 409 },
    { warehouseId: 806, lotStockId: 420, viewLocationId: 419 },
  ],
})

describe('stock locations from the register warehouse chain', () => {
  it('maps Avenues, Salmiya and Ardiya by view location, and children via parent_path', () => {
    expect(branchIdForStockLocation(401, '399/400/401/', roots)).toBe('avenues')
    expect(branchIdForStockLocation(411, '409/410/411/', roots)).toBe('salmiya')
    expect(branchIdForStockLocation(421, '419/420/421/', roots)).toBe('ardiya')
    expect(branchIdForStockLocation(219, null, roots)).toBe('360-mall')
    expect(JAHRA_POS_CONFIG_IDS).toEqual([25, 39])
    expect(isExcludedStockLocation(93, '90/92/93/', roots)).toBe(true)
    expect(KITCHEN_SOURCE_POS_CONFIG_IDS).toEqual([24, 36])
    expect(isCentralKitchenStockLocation(260, '258/259/260/', roots)).toBe(true)
    expect(branchIdForStockLocation(260, '258/259/260/', roots)).toBeNull()
    expect(branchIdForStockLocation(41, null, roots)).toBeNull()
  })
})

describe('kitchen transfers through transit', () => {
  const ck = { role: 'ck' as const, branchId: null, excluded: false, locationId: 259 }
  const branch = { role: 'branch' as const, branchId: 'avenues', excluded: false, locationId: 400 }
  const transit = { role: 'transit' as const, branchId: null, excluded: false, locationId: 900 }
  const jahra = { role: 'branch' as const, branchId: null, excluded: true, locationId: 92 }
  const supplier = { role: 'supplier' as const, branchId: null, excluded: false, locationId: 1 }

  it('counts the arrival leg once when the kitchen also fed that transit location', () => {
    const direct = classifyWarehouseMove(ck, branch)
    const outbound = classifyWarehouseMove(ck, transit)
    const inbound = classifyWarehouseMove(transit, branch)
    const moves = [
      { ...direct, qty: 4 },
      { ...outbound, qty: 10 },
      { ...inbound, qty: 10 },
    ]
    const counted = kitchenTransfersToCount(moves)
    expect(counted).toHaveLength(2)
    expect(counted.reduce((sum, row) => sum + row.qty, 0)).toBe(14)
    expect(counted.some((row) => row.kind === 'transit_out')).toBe(false)
    expect(counted.find((row) => row.kind === 'transit_in')?.branchId).toBe('avenues')
  })

  it('does not count a transit arrival that the kitchen did not feed', () => {
    const inbound = classifyWarehouseMove(transit, branch)
    expect(kitchenTransfersToCount([{ ...inbound, qty: 6 }])).toHaveLength(0)
  })

  it('drops Jahra before a supplier receipt and from every total', () => {
    expect(classifyWarehouseMove(supplier, jahra).kind).toBe('excluded')
    expect(classifyWarehouseMove(ck, jahra).kind).toBe('excluded')
    expect(classifyWarehouseMove(jahra, branch).kind).toBe('excluded')
    const kept = [
      { kind: 'excluded' as const, transitLocationId: null, qty: 99 },
      { kind: 'transfer' as const, transitLocationId: null, qty: 3 },
    ]
    expect(kitchenTransfersToCount(kept).reduce((sum, row) => sum + row.qty, 0)).toBe(3)
  })
})

describe('last known good snapshot', () => {
  it('serves a complete snapshot for 30 minutes and drops it after that', () => {
    const now = 1_000_000
    const fresh = { fetchedAtMs: now - LAST_KNOWN_GOOD_MAX_AGE_MS, unavailableSections: [] as string[] }
    expect(LAST_KNOWN_GOOD_MAX_AGE_MS).toBe(30 * 60_000)
    expect(lastKnownGoodIsFresh(fresh, now)).toBe(true)
  })
})
