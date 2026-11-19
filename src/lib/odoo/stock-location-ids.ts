/**
 * Odoo `stock.location` ids. A location name never chooses a branch.
 * Add an id here when it is confirmed. Anything absent stays unattributed.
 */
export const STOCK_LOCATION_BRANCH_BY_ID = {
  11: '360-mall',
  41: 'school-canteens',
  42: 'school-canteens',
} as const

export type StockLocationBranchId = (typeof STOCK_LOCATION_BRANCH_BY_ID)[keyof typeof STOCK_LOCATION_BRANCH_BY_ID]

export const CENTRAL_KITCHEN_STOCK_LOCATION_IDS = [10] as const

export function branchIdForStockLocation(locationId: number): StockLocationBranchId | null {
  if (!Number.isInteger(locationId) || locationId <= 0) return null
  const hit = STOCK_LOCATION_BRANCH_BY_ID[locationId as keyof typeof STOCK_LOCATION_BRANCH_BY_ID]
  return hit ?? null
}

export function isCentralKitchenStockLocation(locationId: number): boolean {
  return (CENTRAL_KITCHEN_STOCK_LOCATION_IDS as readonly number[]).includes(locationId)
}
