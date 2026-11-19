/**
 * Stock locations are not hardcoded. Each one is the lot or view location of the
 * warehouse behind a pos.config:
 *   pos.config → picking_type_id → stock.picking.type.warehouse_id
 *   → stock.warehouse lot_stock_id and view_location_id.
 * A location matches when its id, or any id in parent_path (Odoo child_of),
 * is that view or lot. Names are not used.
 */
export type StockLocationBranchId =
  | '360-mall'
  | 'al-kout'
  | 'assima'
  | 'promenade'
  | 'avenues'
  | 'salmiya'
  | 'ardiya'

/** pos.config ids whose warehouse is excluded from branch rows. */
export const JAHRA_POS_CONFIG_IDS = [25, 39] as const

/** pos.config ids whose warehouse is the central-kitchen source. Transfers out of it are not sales. */
export const KITCHEN_SOURCE_POS_CONFIG_IDS = [24, 36] as const

export const STOCK_LOCATION_MAP_TTL_MS = 24 * 60 * 60 * 1000

export interface ResolvedStockRoots {
  branchById: Record<number, StockLocationBranchId>
  kitchenIds: number[]
  excludedIds: number[]
}

export interface RegisterPickingLink {
  configId: number
  pickingTypeId: number | null
}

export interface PickingWarehouseLink {
  pickingTypeId: number
  warehouseId: number | null
}

export interface WarehouseStockLocations {
  warehouseId: number
  lotStockId: number | null
  viewLocationId: number | null
}

function addId(target: Set<number>, id: number | null): void {
  if (id !== null && Number.isInteger(id) && id > 0) target.add(id)
}

export function stockRootsFromRegisterChain(input: {
  branchOfConfig: Readonly<Record<number, StockLocationBranchId>>
  configs: readonly RegisterPickingLink[]
  pickingTypes: readonly PickingWarehouseLink[]
  warehouses: readonly WarehouseStockLocations[]
}): ResolvedStockRoots {
  const warehouseOfPicking = new Map(input.pickingTypes.map((row) => [row.pickingTypeId, row.warehouseId]))
  const locationsOfWarehouse = new Map(input.warehouses.map((row) => [row.warehouseId, row]))
  const branchById: Record<number, StockLocationBranchId> = {}
  const kitchenIds = new Set<number>()
  const excludedIds = new Set<number>()
  const jahra = new Set<number>(JAHRA_POS_CONFIG_IDS)
  const kitchen = new Set<number>(KITCHEN_SOURCE_POS_CONFIG_IDS)

  for (const config of input.configs) {
    if (config.pickingTypeId == null) continue
    const warehouseId = warehouseOfPicking.get(config.pickingTypeId)
    if (warehouseId == null) continue
    const places = locationsOfWarehouse.get(warehouseId)
    if (!places) continue
    if (jahra.has(config.configId)) {
      addId(excludedIds, places.lotStockId)
      addId(excludedIds, places.viewLocationId)
      continue
    }
    if (kitchen.has(config.configId)) {
      addId(kitchenIds, places.lotStockId)
      addId(kitchenIds, places.viewLocationId)
      continue
    }
    const branch = input.branchOfConfig[config.configId]
    if (!branch) continue
    if (places.lotStockId != null && places.lotStockId > 0) branchById[places.lotStockId] = branch
    if (places.viewLocationId != null && places.viewLocationId > 0) branchById[places.viewLocationId] = branch
  }

  return {
    branchById,
    kitchenIds: [...kitchenIds],
    excludedIds: [...excludedIds],
  }
}

export function emptyStockRoots(): ResolvedStockRoots {
  return { branchById: {}, kitchenIds: [], excludedIds: [] }
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
  roots: ResolvedStockRoots = emptyStockRoots(),
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
  roots: ResolvedStockRoots = emptyStockRoots(),
): boolean {
  const kitchen = new Set(roots.kitchenIds)
  return locationPathIds(locationId, parentPath).some((id) => kitchen.has(id))
}

export function isExcludedStockLocation(
  locationId: number,
  parentPath?: string | null,
  roots: ResolvedStockRoots = emptyStockRoots(),
): boolean {
  const excluded = new Set(roots.excludedIds)
  return locationPathIds(locationId, parentPath).some((id) => excluded.has(id))
}
