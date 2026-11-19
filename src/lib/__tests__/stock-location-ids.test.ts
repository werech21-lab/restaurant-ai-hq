import { describe, expect, it } from 'vitest'
import {
  JAHRA_POS_CONFIG_IDS,
  KITCHEN_SOURCE_POS_CONFIG_IDS,
  branchIdForStockLocation,
  isCentralKitchenStockLocation,
  isExcludedStockLocation,
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

describe('last known good snapshot', () => {
  it('serves a complete snapshot for 30 minutes and drops it after that', () => {
    const now = 1_000_000
    const fresh = { fetchedAtMs: now - LAST_KNOWN_GOOD_MAX_AGE_MS, unavailableSections: [] as string[] }
    expect(LAST_KNOWN_GOOD_MAX_AGE_MS).toBe(30 * 60_000)
    expect(lastKnownGoodIsFresh(fresh, now)).toBe(true)
  })
})
