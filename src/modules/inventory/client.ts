// Browser-safe public API of the Inventory module: types, Zod schemas and pure domain rules. Never import server code here.
export {
  itemUnits,
  movementTypes,
  warehouseStatuses,
  DEFAULT_PRODUCT_CATEGORY,
  MAX_MOVEMENT_QUANTITY,
  MAX_PRODUCT_PRICE_MINOR,
  MAX_STOCK,
} from '@/modules/inventory/domain/types'
export type {
  FastMovingItem,
  InventorySummary,
  Item,
  ItemDetail,
  ItemUnit,
  MovementType,
  Product,
  ReferenceType,
  StockBalance,
  StockMovement,
  StockShortage,
  StockSignal,
  Warehouse,
  WarehouseStatus,
} from '@/modules/inventory/domain/types'
export { isLowStock, stockValue, totalValue, utilizationPercent } from '@/modules/inventory/domain/stock'
export {
  createItemSchema,
  createMovementSchema,
  createWarehouseSchema,
  itemSortKeys,
  listItemsQuerySchema,
  updateItemSchema,
  updateWarehouseSchema,
} from '@/modules/inventory/schemas/inventory'
export type {
  CreateItemInput,
  CreateMovementInput,
  CreateWarehouseInput,
  ItemSortKey,
  ListItemsQuery,
  UpdateItemInput,
  UpdateWarehouseInput,
} from '@/modules/inventory/schemas/inventory'
export {
  createProductSchema,
  deleteProductSchema,
  listProductsQuerySchema,
  PRODUCT_PAGE_SIZE,
  productIdSchema,
  updateProductSchema,
} from '@/modules/inventory/schemas/product'
export type { CreateProductInput, DeleteProductInput, ListProductsQuery, UpdateProductInput } from '@/modules/inventory/schemas/product'
