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
  getItem,
  getWarehouse,
  listItems,
  listWarehouses,
  updateItem,
  updateWarehouse,
} from '@/modules/inventory/services/catalog-service'
export {
  findStockShortages,
  getSummary,
  issueInvoiceStock,
  listBalances,
  listMovements,
  recordMovement,
  restoreInvoiceStock,
  validateStockLines,
} from '@/modules/inventory/services/stock-service'
export { publishInventoryEvents } from '@/modules/inventory/events'
export type { InventoryEvent } from '@/modules/inventory/events'
export type { InvoiceLineRef, InvoiceStockRef } from '@/modules/inventory/services/stock-service'
export type * from '@/modules/inventory/domain/types'
