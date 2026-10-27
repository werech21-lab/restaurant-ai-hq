import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { db, withTransaction, type Queryable } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import type { ItemDetail, Item, Warehouse } from '@/modules/inventory/domain/types'
import { publishInventoryEvents, type InventoryEvent } from '@/modules/inventory/events'
import * as repository from '@/modules/inventory/repositories/inventory-repository'
import type {
  CreateItemInput,
  CreateWarehouseInput,
  ListItemsQuery,
  ListWarehousesQuery,
  UpdateItemInput,
  UpdateWarehouseInput,
} from '@/modules/inventory/schemas/inventory'

export type ItemBody = { data: Item }
export type ItemDetailBody = { data: ItemDetail }
export type WarehouseBody = { data: Warehouse }

const ITEM_SCOPE = 'inventory.item.create'
const WAREHOUSE_SCOPE = 'inventory.warehouse.create'
const DETAIL_MOVEMENTS = 20

function eventBase(auth: AuthContext) {
  return { version: 1 as const, occurredAt: new Date().toISOString(), tenantId: auth.tenantId }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === '23505'
}

function itemNotFound(): AppError {
  return new AppError(404, 'item_not_found', 'The item was not found.')
}

function warehouseNotFound(): AppError {
  return new AppError(404, 'warehouse_not_found', 'The warehouse was not found.')
}

function versionConflict(what: 'item' | 'warehouse'): AppError {
  return new AppError(409, 'version_conflict', `The ${what} was changed by someone else. Reload it and try again.`)
}

async function audit(
  tx: Queryable,
  auth: AuthContext,
  entity: 'item' | 'warehouse',
  entityId: string,
  action: 'create' | 'update',
  before: unknown,
  after: unknown
): Promise<void> {
  await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity, entityId, action, before, after })
}

// ---- items ----

export async function createItem(auth: AuthContext, idempotencyKey: string, input: CreateItemInput): Promise<IdempotentResult<ItemBody>> {
  const events: InventoryEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<ItemBody>(
      tx,
      { tenantId: auth.tenantId, scope: ITEM_SCOPE, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        let item: Item
        try {
          item = await repository.insertItem(tx, auth.tenantId, auth.userId, input)
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new AppError(409, 'sku_exists', `An item with SKU ${input.sku} already exists.`)
          }
          throw error
        }
        await audit(tx, auth, 'item', item.id, 'create', null, item)
        events.push({
          ...eventBase(auth),
          name: 'inventory.item.created',
          payload: { itemId: item.id, sku: item.sku, createdBy: auth.userId },
        })
        return { status: 201, body: { data: item } }
      }
    )
  )
  if (!outcome.replayed) await publishInventoryEvents(events)
  return outcome
}

export async function updateItem(auth: AuthContext, id: string, input: UpdateItemInput): Promise<ItemBody> {
  const events: InventoryEvent[] = []
  const body = await withTransaction(async (tx): Promise<ItemBody> => {
    const before = await repository.findItem(tx, auth.tenantId, id, { lock: true })
    if (!before) throw itemNotFound()
    if (before.version !== input.version) throw versionConflict('item')
    const after = await repository.updateItem(tx, auth.tenantId, id, input)
    if (!after) throw versionConflict('item')
    await audit(tx, auth, 'item', id, 'update', before, after)
    events.push({
      ...eventBase(auth),
      name: 'inventory.item.updated',
      payload: { itemId: id, sku: after.sku, updatedBy: auth.userId },
    })
    return { data: after }
  })
  await publishInventoryEvents(events)
  return body
}

export function listItems(auth: AuthContext, query: ListItemsQuery): Promise<Page<Item>> {
  return repository.listItems(db, auth.tenantId, query)
}

export async function getItem(auth: AuthContext, id: string): Promise<ItemDetailBody> {
  const item = await repository.findItem(db, auth.tenantId, id)
  if (!item) throw itemNotFound()
  const [balances, movements] = await Promise.all([
    repository.listItemBalances(db, auth.tenantId, id),
    repository.listMovements(db, auth.tenantId, { itemId: id, limit: DETAIL_MOVEMENTS, direction: 'desc' }),
  ])
  return { data: { ...item, balances, movements: movements.data } }
}

// ---- warehouses ----

export async function createWarehouse(
  auth: AuthContext,
  idempotencyKey: string,
  input: CreateWarehouseInput
): Promise<IdempotentResult<WarehouseBody>> {
  const events: InventoryEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<WarehouseBody>(
      tx,
      { tenantId: auth.tenantId, scope: WAREHOUSE_SCOPE, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        let warehouse: Warehouse
        try {
          warehouse = await repository.insertWarehouse(tx, auth.tenantId, auth.userId, input)
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new AppError(409, 'warehouse_code_exists', `A warehouse with code ${input.code} already exists.`)
          }
          throw error
        }
        await audit(tx, auth, 'warehouse', warehouse.id, 'create', null, warehouse)
        events.push({
          ...eventBase(auth),
          name: 'inventory.warehouse.created',
          payload: { warehouseId: warehouse.id, code: warehouse.code, createdBy: auth.userId },
        })
        return { status: 201, body: { data: warehouse } }
      }
    )
  )
  if (!outcome.replayed) await publishInventoryEvents(events)
  return outcome
}

export async function updateWarehouse(auth: AuthContext, id: string, input: UpdateWarehouseInput): Promise<WarehouseBody> {
  const events: InventoryEvent[] = []
  const body = await withTransaction(async (tx): Promise<WarehouseBody> => {
    const before = await repository.findWarehouse(tx, auth.tenantId, id, { lock: true })
    if (!before) throw warehouseNotFound()
    if (before.version !== input.version) throw versionConflict('warehouse')
    const changed = await repository.updateWarehouse(tx, auth.tenantId, id, input)
    if (!changed) throw versionConflict('warehouse')
    const after = await repository.findWarehouse(tx, auth.tenantId, id)
    if (!after) throw warehouseNotFound()
    await audit(tx, auth, 'warehouse', id, 'update', before, after)
    events.push({
      ...eventBase(auth),
      name: 'inventory.warehouse.updated',
      payload: { warehouseId: id, code: after.code, updatedBy: auth.userId },
    })
    return { data: after }
  })
  await publishInventoryEvents(events)
  return body
}

export function listWarehouses(auth: AuthContext, query: ListWarehousesQuery): Promise<Page<Warehouse>> {
  return repository.listWarehouses(db, auth.tenantId, query)
}

export async function getWarehouse(auth: AuthContext, id: string): Promise<WarehouseBody> {
  const warehouse = await repository.findWarehouse(db, auth.tenantId, id)
  if (!warehouse) throw warehouseNotFound()
  return { data: warehouse }
}

// ---- AI integration ----

/** Reads an item, locking it when the caller is about to change something that depends on it. Null when it does not exist. */
export function findItemWithin(tx: Queryable, tenantId: string, id: string, lock: boolean): Promise<Item | null> {
  return repository.findItem(tx, tenantId, id, { lock })
}

export type SellingPriceChange = {
  itemId: string
  /** The price the request was made against. A different current price means the request is stale. */
  expectedPriceMinor: number
  newPriceMinor: number
}

/**
 * Changes only the selling price of an item, inside the caller's transaction. Locks the item, refuses when the price is no
 * longer the one the request was made against (409 `proposal_stale`), then updates with the item's other fields as they are.
 * The caller publishes the events after commit.
 */
export async function setSellingPriceWithin(
  tx: Queryable,
  auth: AuthContext,
  change: SellingPriceChange,
  events: InventoryEvent[]
): Promise<Item> {
  const before = await repository.findItem(tx, auth.tenantId, change.itemId, { lock: true })
  if (!before) throw itemNotFound()
  if (before.sellingPriceMinor !== change.expectedPriceMinor) {
    throw new DomainError('proposal_stale', 'The selling price changed after this request was made.')
  }
  const after = await repository.updateItem(tx, auth.tenantId, change.itemId, {
    version: before.version,
    name: before.name,
    unitCostMinor: before.unitCostMinor,
    sellingPriceMinor: change.newPriceMinor,
    reorderLevel: before.reorderLevel,
    isActive: before.isActive,
  })
  if (!after) throw versionConflict('item')
  await audit(tx, auth, 'item', change.itemId, 'update', before, after)
  events.push({
    ...eventBase(auth),
    name: 'inventory.item.updated',
    payload: { itemId: change.itemId, sku: after.sku, updatedBy: auth.userId },
  })
  return after
}
