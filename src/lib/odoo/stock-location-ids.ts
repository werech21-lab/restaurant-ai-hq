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

export type WarehouseMoveKind =
  | 'excluded'
  | 'inbound'
  | 'transfer'
  | 'transit_out'
  | 'transit_in'
  | 'consumption'
  | 'scrap_move'
  | 'internal_other'

export interface WarehouseEndpoint {
  role: 'ck' | 'branch' | 'supplier' | 'customer' | 'scrap' | 'transit' | 'other'
  branchId: string | null
  excluded: boolean
  locationId: number | null
}

/** Exclusion is decided before a supplier receipt, so Jahra stock never enters a total. */
export function classifyWarehouseMove(
  src: WarehouseEndpoint | undefined,
  dst: WarehouseEndpoint | undefined,
): { kind: WarehouseMoveKind; branchId: string | null; transitLocationId: number | null } {
  if (src?.excluded || dst?.excluded) return { kind: 'excluded', branchId: null, transitLocationId: null }
  if (src?.role === 'supplier' && dst && dst.role !== 'supplier') {
    return {
      kind: 'inbound',
      branchId: dst.role === 'branch' ? dst.branchId : null,
      transitLocationId: null,
    }
  }
  if (src?.role === 'ck' && dst?.role === 'branch') {
    return { kind: 'transfer', branchId: dst.branchId, transitLocationId: null }
  }
  if (src?.role === 'ck' && (dst?.role === 'transit' || dst?.role === 'other')) {
    return { kind: 'transit_out', branchId: null, transitLocationId: dst.locationId }
  }
  if ((src?.role === 'transit' || src?.role === 'other') && dst?.role === 'branch') {
    return { kind: 'transit_in', branchId: dst.branchId, transitLocationId: src.locationId }
  }
  if ((src?.role === 'branch' || src?.role === 'ck') && dst?.role === 'customer') {
    return { kind: 'consumption', branchId: src.branchId, transitLocationId: null }
  }
  if (dst?.role === 'scrap') {
    return { kind: 'scrap_move', branchId: src?.branchId ?? null, transitLocationId: null }
  }
  return { kind: 'internal_other', branchId: dst?.branchId ?? src?.branchId ?? null, transitLocationId: null }
}

/**
 * Direct kitchen-to-branch moves count once. A transit pair counts only the leg
 * that arrives at the branch, and only when the kitchen also sent stock into that
 * transit location. The outbound leg is not added again.
 */
export function kitchenTransfersToCount<T extends { kind: WarehouseMoveKind; transitLocationId: number | null }>(
  moves: readonly T[],
): T[] {
  const fedByKitchen = new Set<number>()
  for (const move of moves) {
    if (move.kind === 'transit_out' && move.transitLocationId != null) fedByKitchen.add(move.transitLocationId)
  }
  return moves.filter((move) => {
    if (move.kind === 'transfer') return true
    return move.kind === 'transit_in' && move.transitLocationId != null && fedByKitchen.has(move.transitLocationId)
  })
}

export function isExcludedStockLocation(
  locationId: number,
  parentPath?: string | null,
  roots: ResolvedStockRoots = emptyStockRoots(),
): boolean {
  const excluded = new Set(roots.excludedIds)
  return locationPathIds(locationId, parentPath).some((id) => excluded.has(id))
}
