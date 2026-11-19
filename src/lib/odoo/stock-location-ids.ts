/**
 * Stock locations for the seven restaurants and the central kitchen.
 *
 * The quant export only contains 360, KOUT, ASM, PRM and QRN. Avenues, Salmiya,
 * Ardiya and Jahra are resolved from `stock.warehouse` (code → lot_stock_id and
 * view_location_id) because those rows were not in the export. pos.config 41 and
 * 42 are school-canteen registers, not stock locations.
 * A location that is not a mapped warehouse, and not a child of one, stays
 * unattributed.
 */
export type StockLocationBranchId =
  | '360-mall'
  | 'al-kout'
  | 'assima'
  | 'promenade'
  | 'avenues'
  | 'salmiya'
  | 'ardiya'

/** Locations confirmed in the quant export. The other three restaurants come from stock.warehouse. */
export const STOCK_LOCATION_BRANCH_BY_ID: Record<number, StockLocationBranchId> = {
  219: '360-mall',
  227: 'al-kout',
  235: 'assima',
  251: 'promenade',
}

/** QRN/Stock — Qurain central kitchen, confirmed in the quant export. */
export const CENTRAL_KITCHEN_STOCK_LOCATION_IDS = [259] as const

/**
 * Seed ids. Jahra's lot and view locations are added from stock.warehouse
 * when its code is one of EXCLUDED_WAREHOUSE_CODES.
 */
export const EXCLUDED_STOCK_LOCATION_IDS = [] as const

/** Odoo stock.warehouse.code → restaurant. KOUT is the live code; KOT is the registry alias. */
export const STOCK_WAREHOUSE_BRANCH_BY_CODE = {
  '360': '360-mall',
  KOUT: 'al-kout',
  KOT: 'al-kout',
  ASM: 'assima',
  PRM: 'promenade',
  AVN: 'avenues',
  SLM: 'salmiya',
  ARD: 'ardiya',
} as const

export const CENTRAL_KITCHEN_WAREHOUSE_CODES = ['QRN'] as const

/** Closed Jahra warehouse. Its lot and view locations are excluded by id. */
export const EXCLUDED_WAREHOUSE_CODES = ['JHR'] as const

export interface StockWarehouseLot {
  code: string
  lotStockId: number | null
  viewLocationId: number | null
}

export interface ResolvedStockRoots {
  branchById: Record<number, StockLocationBranchId>
  kitchenIds: number[]
  excludedIds: number[]
}

function addId(target: Set<number>, id: number | null): void {
  if (id !== null && Number.isInteger(id) && id > 0) target.add(id)
}

export function resolveStockRoots(warehouses: readonly StockWarehouseLot[]): ResolvedStockRoots {
  const branchById: Record<number, StockLocationBranchId> = { ...STOCK_LOCATION_BRANCH_BY_ID }
  const kitchenIds = new Set<number>(CENTRAL_KITCHEN_STOCK_LOCATION_IDS)
  const excludedIds = new Set<number>(EXCLUDED_STOCK_LOCATION_IDS)
  for (const warehouse of warehouses) {
    const code = warehouse.code.trim().toUpperCase()
    const branch = STOCK_WAREHOUSE_BRANCH_BY_CODE[code as keyof typeof STOCK_WAREHOUSE_BRANCH_BY_CODE]
    if ((EXCLUDED_WAREHOUSE_CODES as readonly string[]).includes(code)) {
      addId(excludedIds, warehouse.lotStockId)
      addId(excludedIds, warehouse.viewLocationId)
      continue
    }
    if ((CENTRAL_KITCHEN_WAREHOUSE_CODES as readonly string[]).includes(code)) {
      addId(kitchenIds, warehouse.lotStockId)
      addId(kitchenIds, warehouse.viewLocationId)
      continue
    }
    if (!branch) continue
    if (warehouse.lotStockId !== null && warehouse.lotStockId > 0) branchById[warehouse.lotStockId] = branch
    if (warehouse.viewLocationId !== null && warehouse.viewLocationId > 0) branchById[warehouse.viewLocationId] = branch
  }
  return {
    branchById,
    kitchenIds: [...kitchenIds],
    excludedIds: [...excludedIds],
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
  roots: ResolvedStockRoots = resolveStockRoots([]),
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
  roots: ResolvedStockRoots = resolveStockRoots([]),
): boolean {
  const kitchen = new Set(roots.kitchenIds)
  return locationPathIds(locationId, parentPath).some((id) => kitchen.has(id))
}

export function isExcludedStockLocation(
  locationId: number,
  parentPath?: string | null,
  roots: ResolvedStockRoots = resolveStockRoots([]),
): boolean {
  const excluded = new Set(roots.excludedIds)
  return locationPathIds(locationId, parentPath).some((id) => excluded.has(id))
}
