import { emit } from '@/lib/events/bus'
import type { MovementType, ReferenceType } from '@/modules/inventory/domain/types'

type EventBase<N extends string, P> = {
  name: N
  version: 1
  occurredAt: string
  tenantId: string
  payload: P
}

export type StockMovedEvent = EventBase<
  'inventory.stock.moved',
  {
    movementId: string
    itemId: string
    sku: string
    warehouseId: string
    movementType: MovementType
    quantity: number
    referenceType: ReferenceType
    referenceId: string | null
    newStock: number
  }
>

export type StockDepletedEvent = EventBase<'inventory.stock.depleted', { itemId: string; sku: string; name: string }>

/** Stock fell to or below the item's reorder level. Fires once per crossing. */
export type ReorderLevelReachedEvent = EventBase<
  'inventory.item.reorder_level_reached',
  { itemId: string; sku: string; name: string; currentStock: number; reorderLevel: number }
>

export type ItemCreatedEvent = EventBase<'inventory.item.created', { itemId: string; sku: string; createdBy: string }>
export type ItemUpdatedEvent = EventBase<'inventory.item.updated', { itemId: string; sku: string; updatedBy: string }>
export type WarehouseCreatedEvent = EventBase<'inventory.warehouse.created', { warehouseId: string; code: string; createdBy: string }>
export type WarehouseUpdatedEvent = EventBase<'inventory.warehouse.updated', { warehouseId: string; code: string; updatedBy: string }>

export type InventoryEvent =
  | StockMovedEvent
  | StockDepletedEvent
  | ReorderLevelReachedEvent
  | ItemCreatedEvent
  | ItemUpdatedEvent
  | WarehouseCreatedEvent
  | WarehouseUpdatedEvent

/** Call only after the transaction that wrote the data has committed. Handler failures never reach the caller. */
export async function publishInventoryEvents(events: readonly InventoryEvent[]): Promise<void> {
  for (const event of events) {
    await emit(event)
  }
}
