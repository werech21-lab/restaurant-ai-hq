/**
 * Odoo stock.location ids taken from the Venture Foods quant export
 * (database/seeds/venturefoods_odoo_cids1_dump.json). pos.config 41 and 42
 * are school-canteen registers, not stock locations.
 * A location that is not listed here stays unattributed.
 */
export const STOCK_LOCATION_BRANCH_BY_ID = {
  219: '360-mall',
  227: 'al-kout',
  235: 'assima',
  251: 'promenade',
} as const

export type StockLocationBranchId = (typeof STOCK_LOCATION_BRANCH_BY_ID)[keyof typeof STOCK_LOCATION_BRANCH_BY_ID]

/** QRN/Stock — Qurain central kitchen. */
export const CENTRAL_KITCHEN_STOCK_LOCATION_IDS = [259] as const

/**
 * Jahra stock locations. The quant export has no Jahra location row, so this
 * stays empty until that id is confirmed. Names are not used.
 */
export const EXCLUDED_STOCK_LOCATION_IDS = [] as const

export function branchIdForStockLocation(locationId: number): StockLocationBranchId | null {
  if (!Number.isInteger(locationId) || locationId <= 0) return null
  const hit = STOCK_LOCATION_BRANCH_BY_ID[locationId as keyof typeof STOCK_LOCATION_BRANCH_BY_ID]
  return hit ?? null
}

export function isCentralKitchenStockLocation(locationId: number): boolean {
  return (CENTRAL_KITCHEN_STOCK_LOCATION_IDS as readonly number[]).includes(locationId)
}

export function isExcludedStockLocation(locationId: number): boolean {
  return (EXCLUDED_STOCK_LOCATION_IDS as readonly number[]).includes(locationId)
}
