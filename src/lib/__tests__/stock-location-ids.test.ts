import { describe, expect, it } from 'vitest'
import {
  CENTRAL_KITCHEN_STOCK_LOCATION_IDS,
  EXCLUDED_STOCK_LOCATION_IDS,
  branchIdForStockLocation,
  isCentralKitchenStockLocation,
  isExcludedStockLocation,
} from '@/lib/odoo/stock-location-ids'

describe('stock.location ids', () => {
  it('maps the quant-export locations and does not treat pos.config 41 or 42 as locations', () => {
    expect(branchIdForStockLocation(219)).toBe('360-mall')
    expect(branchIdForStockLocation(227)).toBe('al-kout')
    expect(branchIdForStockLocation(235)).toBe('assima')
    expect(branchIdForStockLocation(251)).toBe('promenade')
    expect(isCentralKitchenStockLocation(259)).toBe(true)
    expect(CENTRAL_KITCHEN_STOCK_LOCATION_IDS).toEqual([259])
    expect(branchIdForStockLocation(41)).toBeNull()
    expect(branchIdForStockLocation(42)).toBeNull()
    expect(branchIdForStockLocation(11)).toBeNull()
    expect(isExcludedStockLocation(41)).toBe(false)
    expect(EXCLUDED_STOCK_LOCATION_IDS).not.toContain(41)
  })
})
