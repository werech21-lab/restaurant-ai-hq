import type { Currency } from '@/lib/money'

export const itemUnits = ['piece', 'kg', 'g', 'l', 'ml', 'box'] as const
export type ItemUnit = (typeof itemUnits)[number]

export const warehouseStatuses = ['active', 'inactive'] as const
export type WarehouseStatus = (typeof warehouseStatuses)[number]

export const movementTypes = ['IN', 'OUT', 'TRANSFER'] as const
export type MovementType = (typeof movementTypes)[number]

/** `restock` is stock received because an approved restock request said so. Its reference is that request's id. */
export const referenceTypes = ['manual', 'invoice', 'transfer', 'restock'] as const
export type ReferenceType = (typeof referenceTypes)[number]

/** Largest quantity of one movement, and the largest stock of one item. Keeps every sum inside a safe integer. */
export const MAX_MOVEMENT_QUANTITY = 1_000_000
export const MAX_STOCK = 100_000_000

export type Item = {
  id: string
  sku: string
  name: string
  unit: ItemUnit
  unitCostMinor: number
  sellingPriceMinor: number
  currency: Currency
  reorderLevel: number
  currentStock: number
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type Warehouse = {
  id: string
  code: string
  name: string
  location: string | null
  capacity: number | null
  status: WarehouseStatus
  /** Units currently stored, summed over every item. */
  unitsStored: number
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type StockBalance = {
  id: string
  itemId: string
  sku: string
  itemName: string
  unit: ItemUnit
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  onHand: number
}

export type StockMovement = {
  id: string
  itemId: string
  sku: string
  itemName: string
  warehouseId: string
  warehouseCode: string
  movementType: MovementType
  /** Signed: positive adds stock, negative removes it. */
  quantity: number
  referenceType: ReferenceType
  referenceId: string | null
  note: string | null
  createdAt: string
  createdBy: string
}

/** A stock line that cannot be covered right now: what it needs and what the warehouse holds. */
export type StockShortage = {
  itemId: string
  sku: string
  warehouseId: string
  warehouseCode: string
  required: number
  available: number
}

/**
 * What the AI module reads about one active item: its stock, its prices, how much left in the window, and the
 * active warehouse that already holds the most of it (where a restock is received). `restockWarehouse` is null
 * when the tenant has no active warehouse.
 */
export type StockSignal = {
  itemId: string
  sku: string
  name: string
  unit: ItemUnit
  currentStock: number
  reorderLevel: number
  unitCostMinor: number
  sellingPriceMinor: number
  version: number
  outQuantity: number
  restockWarehouse: { id: string; code: string; name: string } | null
}

export type ItemDetail = Item & {
  balances: StockBalance[]
  movements: StockMovement[]
}

export type FastMovingItem = {
  itemId: string
  sku: string
  name: string
  unit: ItemUnit
  outQuantity: number
}

export type InventorySummary = {
  valuationMinor: number
  currency: Currency
  itemCount: number
  activeItemCount: number
  lowStockCount: number
  outOfStockCount: number
  lowStock: Item[]
  fastMoving: FastMovingItem[]
  windowDays: number
  warehouses: Warehouse[]
}
