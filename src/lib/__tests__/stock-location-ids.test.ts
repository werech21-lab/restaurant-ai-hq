import { describe, expect, it } from 'vitest'
import {
  CENTRAL_KITCHEN_STOCK_LOCATION_IDS,
  EXCLUDED_STOCK_LOCATION_IDS,
  STOCK_LOCATION_CHILD_OF_IDS,
  branchIdForStockLocation,
  isCentralKitchenStockLocation,
  isExcludedStockLocation,
} from '@/lib/odoo/stock-location-ids'
import { LAST_KNOWN_GOOD_MAX_AGE_MS, lastKnownGoodIsFresh } from '@/lib/odoo-live-connector'

describe('stock.location ids', () => {
  it('uses the quant-export ids and treats a child of 219 as 360 Mall', () => {
    expect(branchIdForStockLocation(219)).toBe('360-mall')
    expect(branchIdForStockLocation(227)).toBe('al-kout')
    expect(branchIdForStockLocation(235)).toBe('assima')
    expect(branchIdForStockLocation(251)).toBe('promenade')
    expect(branchIdForStockLocation(401, '1/219/401/')).toBe('360-mall')
    expect(isCentralKitchenStockLocation(259)).toBe(true)
    expect(isCentralKitchenStockLocation(260, '1/259/260/')).toBe(true)
    expect(CENTRAL_KITCHEN_STOCK_LOCATION_IDS).toEqual([259])
    expect(STOCK_LOCATION_CHILD_OF_IDS).toEqual([219, 227, 235, 251, 259])
    expect(branchIdForStockLocation(41)).toBeNull()
    expect(branchIdForStockLocation(42)).toBeNull()
    expect(isExcludedStockLocation(41)).toBe(false)
    expect(EXCLUDED_STOCK_LOCATION_IDS).toEqual([])
    expect(branchIdForStockLocation(999, '1/999/')).toBeNull()
    expect(isCentralKitchenStockLocation(999, '1/999/')).toBe(false)
  })
})

describe('last known good snapshot', () => {
  it('serves a complete snapshot for 30 minutes and drops it after that', () => {
    const now = 1_000_000
    const fresh = { fetchedAtMs: now - LAST_KNOWN_GOOD_MAX_AGE_MS, unavailableSections: [] as string[] }
    const stale = { fetchedAtMs: now - LAST_KNOWN_GOOD_MAX_AGE_MS - 1, unavailableSections: [] as string[] }
    expect(LAST_KNOWN_GOOD_MAX_AGE_MS).toBe(30 * 60_000)
    expect(lastKnownGoodIsFresh(fresh, now)).toBe(true)
    expect(lastKnownGoodIsFresh(stale, now)).toBe(false)
  })
})
