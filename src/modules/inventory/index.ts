// Server-side public API of the Inventory module. Browser code imports from './client' instead.
export {
  createItemHandler,
  createMovementHandler,
  createWarehouseHandler,
  getItemHandler,
  getWarehouseHandler,
  inventorySummaryHandler,
  listBalancesHandler,
  listItemsHandler,
  listMovementsHandler,
  listWarehousesHandler,
  updateItemHandler,
  updateWarehouseHandler,
} from '@/modules/inventory/api/v1/inventory'
export {
  createItem,
  createWarehouse,
  findItemWithin,
  getItem,
  getWarehouse,
  listItems,
  listWarehouses,
  setSellingPriceWithin,
  updateItem,
  updateWarehouse,
} from '@/modules/inventory/services/catalog-service'
export {
  findStockShortages,
  getSummary,
  issueInvoiceStock,
  listBalances,
  listMovements,
  listStockSignals,
  receivePurchaseWithin,
  receiveRestockWithin,
  recordMovement,
  restoreInvoiceStock,
  returnPurchaseWithin,
  validateStockLines,
} from '@/modules/inventory/services/stock-service'
export { applyPriceVarianceWithin, readCostingWithin, setCostingPolicyWithin } from '@/modules/inventory/services/cost-service'
export type { IssuedCost } from '@/modules/inventory/services/cost-service'
export { createProduct, deleteProduct, listProducts, updateProduct } from '@/modules/inventory/services/product-service'
export type { ProductBody, ProductPage } from '@/modules/inventory/services/product-service'
export { publishInventoryEvents } from '@/modules/inventory/events'
export type { InventoryEvent } from '@/modules/inventory/events'
export type { InvoiceLineRef, InvoiceStockRef, PurchaseReceiptInput, PurchaseReturnInput, RestockInput } from '@/modules/inventory/services/stock-service'
export type * from '@/modules/inventory/domain/types'
export type { SellingPriceChange } from '@/modules/inventory/services/catalog-service'
