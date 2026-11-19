/**
 * Confirmed Odoo stock.location ids from the Venture Foods quant export
 * (database/seeds/venturefoods_odoo_cids1_dump.json, exported 2026-10-31).
 * That extract's internal locations are only:
 *   219 360/Stock, 227 KOUT/Stock, 235 ASM/Stock, 251 PRM/Stock, 259 QRN/Stock.
 * Avenues, Salmiya, Ardiya and Jahra have no stock.location row in the export,
 * and the live Odoo credentials are not readable from this environment, so no
 * further ids are recorded. pos.config 41 and 42 are school-canteen registers,
 * not stock locations.
 * A location matches a root when its id, or any id in parent_path (Odoo child_of),
 * is one of these constants. Anything else stays unattributed.
 */
export type StockLocationBranchId = '360-mall' | 'al-kout' | 'assima' | 'promenade'

/** child_of these ids. Confirmed in the quant export; not warehouse codes. */
export const STOCK_LOCATION_BRANCH_BY_ID: Record<number, StockLocationBranchId> = {
  219: '360-mall',
  227: 'al-kout',
  235: 'assima',
  251: 'promenade',
}

/**
 * QRN/Stock. Kitchen-to-branch transfers leave this location (and its children).
 * A transfer is not a sale: only a move onward to a customer location is consumption.
 */
export const CENTRAL_KITCHEN_STOCK_LOCATION_IDS = [259] as const

/**
 * Jahra stock.location ids. The quant export has none, so this stays empty
 * rather than guessing a warehouse code.
 */
export const EXCLUDED_STOCK_LOCATION_IDS = [] as const

export const STOCK_LOCATION_CHILD_OF_IDS: readonly number[] = [
  ...Object.keys(STOCK_LOCATION_BRANCH_BY_ID).map((id) => Number(id)),
  ...CENTRAL_KITCHEN_STOCK_LOCATION_IDS,
]

export interface ResolvedStockRoots {
  branchById: Record<number, StockLocationBranchId>
  kitchenIds: number[]
  excludedIds: number[]
}

export function resolveStockRoots(): ResolvedStockRoots {
  return {
    branchById: { ...STOCK_LOCATION_BRANCH_BY_ID },
    kitchenIds: [...CENTRAL_KITCHEN_STOCK_LOCATION_IDS],
    excludedIds: [...EXCLUDED_STOCK_LOCATION_IDS],
  }
}

/** Ancestor ids from Odoo parent_path (`1/219/305/`) plus the location itself. */
export function locationPathIds(locationId: number, parentPath?: string | null): number[] {
  const ids: number[] = []
  if (typeof parentPath === 'string') {
    for (const part of parentPath.split('/')) {
      const n = Number(part)
      if (Number.isInteger(n) && n > 0) ids.push(n)
    }
  }
  if (!ids.includes(locationId)) ids.push(locationId)
  return ids
}

export function branchIdForStockLocation(
  locationId: number,
  parentPath?: string | null,
  roots: ResolvedStockRoots = resolveStockRoots(),
): StockLocationBranchId | null {
  if (!Number.isInteger(locationId) || locationId <= 0) return null
  for (const id of locationPathIds(locationId, parentPath)) {
    const hit = roots.branchById[id]
    if (hit) return hit
  }
  return null
}

export function isCentralKitchenStockLocation(
  locationId: number,
  parentPath?: string | null,
  roots: ResolvedStockRoots = resolveStockRoots(),
): boolean {
  const kitchen = new Set(roots.kitchenIds)
  return locationPathIds(locationId, parentPath).some((id) => kitchen.has(id))
}

export function isExcludedStockLocation(
  locationId: number,
  parentPath?: string | null,
  roots: ResolvedStockRoots = resolveStockRoots(),
): boolean {
  const excluded = new Set(roots.excludedIds)
  return locationPathIds(locationId, parentPath).some((id) => excluded.has(id))
}
