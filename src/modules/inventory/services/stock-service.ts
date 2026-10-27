import { randomUUID } from 'node:crypto'
import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { db, withTransaction, type Queryable } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import {
  becameDepleted,
  findShortages,
  invoiceNeeds,
  pairKey,
  planMovement,
  reachedReorderLevel,
  stockNeeds,
  type InvoiceStockLine,
  type LedgerRow,
  type MovementRequest,
} from '@/modules/inventory/domain/stock'
import type { InventorySummary, StockBalance, StockMovement, StockShortage, StockSignal } from '@/modules/inventory/domain/types'
import { publishInventoryEvents, type InventoryEvent } from '@/modules/inventory/events'
import * as repository from '@/modules/inventory/repositories/inventory-repository'
import type {
  CreateMovementInput,
  ListBalancesQuery,
  ListMovementsQuery,
  SummaryQuery,
} from '@/modules/inventory/schemas/inventory'

export type MovementBody = { data: { movements: StockMovement[] } }
export type SummaryBody = { data: InventorySummary }

const MOVEMENT_SCOPE = 'inventory.movement.create'
const SUMMARY_LOW_STOCK_LIMIT = 10
const SUMMARY_FAST_MOVING_LIMIT = 5
const SUMMARY_WAREHOUSE_LIMIT = 100

type LedgerOptions = {
  /** When true, an inactive item or warehouse cannot receive stock. It can always give stock up, so it can be emptied. */
  enforceActive: boolean
}

function eventBase(auth: AuthContext) {
  return { version: 1 as const, occurredAt: new Date().toISOString(), tenantId: auth.tenantId }
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values))
}

/**
 * The one place stock changes. Locks the items in id order, checks that nothing goes below zero, writes the ledger rows
 * and audit rows, and collects events. Runs inside the caller's transaction; the caller publishes the events after commit.
 */
async function applyLedger(
  tx: Queryable,
  auth: AuthContext,
  rows: readonly LedgerRow[],
  events: InventoryEvent[],
  options: LedgerOptions
): Promise<repository.InsertedMovement[]> {
  if (rows.length === 0) return []
  const itemIds = unique(rows.map((row) => row.itemId))
  const warehouseIds = unique(rows.map((row) => row.warehouseId))

  const items = new Map((await repository.lockItems(tx, auth.tenantId, itemIds)).map((item) => [item.id, item]))
  const warehouses = await repository.findWarehouseStatuses(tx, auth.tenantId, warehouseIds)

  for (const row of rows) {
    const item = items.get(row.itemId)
    if (!item) throw new DomainError('item_not_found', 'The item does not exist.')
    const warehouse = warehouses.get(row.warehouseId)
    if (!warehouse) throw new DomainError('warehouse_not_found', 'The warehouse does not exist.')
    if (options.enforceActive && row.quantity > 0) {
      if (!item.isActive) throw new DomainError('item_inactive', `Item ${item.sku} is inactive and cannot receive stock.`)
      if (warehouse.status !== 'active') {
        throw new DomainError('warehouse_inactive', `Warehouse ${warehouse.code} is inactive and cannot receive stock.`)
      }
    }
  }

  const needs = stockNeeds(rows)
  if (needs.length > 0) {
    const onHand = await repository.readOnHand(tx, auth.tenantId, itemIds, warehouseIds)
    const available = new Map(onHand.map((balance) => [pairKey(balance.itemId, balance.warehouseId), balance.onHand]))
    const shortages = findShortages(needs, available)
    if (shortages.length > 0) {
      const detail = shortages
        .map((shortage) => {
          const sku = items.get(shortage.itemId)?.sku ?? shortage.itemId
          const code = warehouses.get(shortage.warehouseId)?.code ?? shortage.warehouseId
          return `${sku} @ ${code}: need ${shortage.quantity}, have ${shortage.available}`
        })
        .join('; ')
      throw new DomainError('insufficient_stock', `Not enough stock. ${detail}`)
    }
  }

  const inserted = await repository.insertMovements(tx, auth.tenantId, auth.userId, rows)

  const running = new Map(Array.from(items.values()).map((item) => [item.id, item.currentStock]))
  for (const movement of inserted) {
    const item = items.get(movement.itemId)
    if (!item) continue
    const newStock = (running.get(movement.itemId) ?? 0) + movement.quantity
    running.set(movement.itemId, newStock)
    await writeAudit(tx, {
      tenantId: auth.tenantId,
      actorId: auth.userId,
      entity: 'stock_movement',
      entityId: movement.id,
      action: 'create',
      before: null,
      after: movement,
    })
    events.push({
      ...eventBase(auth),
      name: 'inventory.stock.moved',
      payload: {
        movementId: movement.id,
        itemId: movement.itemId,
        sku: item.sku,
        warehouseId: movement.warehouseId,
        movementType: movement.movementType,
        quantity: movement.quantity,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId,
        newStock,
      },
    })
  }

  for (const item of items.values()) {
    const after = running.get(item.id) ?? item.currentStock
    if (after === item.currentStock) continue
    if (reachedReorderLevel(item.currentStock, after, item.reorderLevel)) {
      events.push({
        ...eventBase(auth),
        name: 'inventory.item.reorder_level_reached',
        payload: { itemId: item.id, sku: item.sku, name: item.name, currentStock: after, reorderLevel: item.reorderLevel },
      })
    }
    if (becameDepleted(item.currentStock, after)) {
      events.push({
        ...eventBase(auth),
        name: 'inventory.stock.depleted',
        payload: { itemId: item.id, sku: item.sku, name: item.name },
      })
    }
  }
  return inserted
}

function toRequest(input: CreateMovementInput): MovementRequest {
  if (input.type === 'TRANSFER') {
    return {
      type: 'TRANSFER',
      itemId: input.itemId,
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      quantity: input.quantity,
      note: input.note,
    }
  }
  return { type: input.type, itemId: input.itemId, warehouseId: input.warehouseId, quantity: input.quantity, note: input.note }
}

/** Manual stock entry (IN), write-off or issue (OUT) and warehouse transfer (TRANSFER). */
export async function recordMovement(
  auth: AuthContext,
  idempotencyKey: string,
  input: CreateMovementInput
): Promise<IdempotentResult<MovementBody>> {
  const events: InventoryEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<MovementBody>(
      tx,
      { tenantId: auth.tenantId, scope: MOVEMENT_SCOPE, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        const rows = planMovement(toRequest(input), randomUUID())
        const inserted = await applyLedger(tx, auth, rows, events, { enforceActive: true })
        const movements = await repository.findMovementsByIds(
          tx,
          auth.tenantId,
          inserted.map((movement) => movement.id)
        )
        return { status: 201, body: { data: { movements } } }
      }
    )
  )
  if (!outcome.replayed) await publishInventoryEvents(events)
  return outcome
}

// ---- finance integration ----

export type InvoiceStockRef = { id: string; number: string }
export type InvoiceLineRef = { itemId: string | null; warehouseId: string | null; quantity: number }

/**
 * Checks the items and warehouses a draft invoice points at. New sales need an active item and an active warehouse.
 * Throws DomainError so the finance transaction rolls back with a 422.
 */
export async function validateStockLines(
  tx: Queryable,
  tenantId: string,
  lines: ReadonlyArray<{ itemId: string | null; warehouseId: string | null }>
): Promise<void> {
  const itemIds = unique(lines.flatMap((line) => (line.itemId ? [line.itemId] : [])))
  const warehouseIds = unique(lines.flatMap((line) => (line.warehouseId ? [line.warehouseId] : [])))
  if (itemIds.length === 0 && warehouseIds.length === 0) return
  const [itemStates, warehouses] = await Promise.all([
    repository.findItemStates(tx, tenantId, itemIds),
    repository.findWarehouseStatuses(tx, tenantId, warehouseIds),
  ])
  for (const itemId of itemIds) {
    const state = itemStates.get(itemId)
    if (!state) throw new DomainError('item_not_found', 'An invoice line points at an item that does not exist.')
    if (!state.isActive) throw new DomainError('item_inactive', `Item ${state.sku} is inactive.`)
  }
  for (const warehouseId of warehouseIds) {
    const warehouse = warehouses.get(warehouseId)
    if (!warehouse) throw new DomainError('warehouse_not_found', 'An invoice line points at a warehouse that does not exist.')
    if (warehouse.status !== 'active') {
      throw new DomainError('warehouse_inactive', `Warehouse ${warehouse.code} is inactive.`)
    }
  }
}

/**
 * Reads, without locking, which lines cannot be covered by the stock on hand right now. Lines without an item are ignored.
 * It is a pre-check for the caller's own flow (a quotation, say). The authoritative check stays in `issueInvoiceStock`,
 * which locks the items first.
 */
export async function findStockShortages(
  tx: Queryable,
  tenantId: string,
  lines: readonly InvoiceLineRef[]
): Promise<StockShortage[]> {
  const needs = invoiceNeeds(lines.map((line) => ({ itemId: line.itemId, warehouseId: line.warehouseId, quantity: line.quantity })))
  if (needs.length === 0) return []
  const itemIds = unique(needs.map((need) => need.itemId))
  const warehouseIds = unique(needs.map((need) => need.warehouseId))
  const [onHand, itemStates, warehouses] = await Promise.all([
    repository.readOnHand(tx, tenantId, itemIds, warehouseIds),
    repository.findItemStates(tx, tenantId, itemIds),
    repository.findWarehouseStatuses(tx, tenantId, warehouseIds),
  ])
  const available = new Map(onHand.map((balance) => [pairKey(balance.itemId, balance.warehouseId), balance.onHand]))
  return findShortages(needs, available).map((shortage) => ({
    itemId: shortage.itemId,
    sku: itemStates.get(shortage.itemId)?.sku ?? shortage.itemId,
    warehouseId: shortage.warehouseId,
    warehouseCode: warehouses.get(shortage.warehouseId)?.code ?? shortage.warehouseId,
    required: shortage.quantity,
    available: shortage.available,
  }))
}

/**
 * Takes the stock an invoice sells, one OUT movement per item and warehouse. Runs inside the finance transaction when the
 * invoice becomes issued. Throws `insufficient_stock` (409) when any line cannot be covered, which rolls the whole issue back.
 */
export async function issueInvoiceStock(
  tx: Queryable,
  auth: AuthContext,
  invoice: InvoiceStockRef,
  lines: readonly InvoiceLineRef[],
  events: InventoryEvent[]
): Promise<void> {
  const stockLines: InvoiceStockLine[] = lines.map((line) => ({
    itemId: line.itemId,
    warehouseId: line.warehouseId,
    quantity: line.quantity,
  }))
  const needs = invoiceNeeds(stockLines).sort((a, b) => pairKey(a.itemId, a.warehouseId).localeCompare(pairKey(b.itemId, b.warehouseId)))
  const rows: LedgerRow[] = needs.map((need) => ({
    itemId: need.itemId,
    warehouseId: need.warehouseId,
    movementType: 'OUT',
    quantity: -need.quantity,
    referenceType: 'invoice',
    referenceId: invoice.id,
    note: invoice.number,
  }))
  await applyLedger(tx, auth, rows, events, { enforceActive: false })
}

/**
 * Puts back what an invoice took, as IN movements. Nets the invoice's earlier movements per item and warehouse, so a
 * second call restores nothing. Runs inside the finance transaction that voids the invoice.
 */
export async function restoreInvoiceStock(
  tx: Queryable,
  auth: AuthContext,
  invoice: InvoiceStockRef,
  events: InventoryEvent[]
): Promise<void> {
  const earlier = await repository.findInvoiceMovements(tx, auth.tenantId, invoice.id)
  const net = new Map<string, { itemId: string; warehouseId: string; quantity: number }>()
  for (const movement of earlier) {
    const key = pairKey(movement.itemId, movement.warehouseId)
    const entry = net.get(key) ?? { itemId: movement.itemId, warehouseId: movement.warehouseId, quantity: 0 }
    entry.quantity += movement.quantity
    net.set(key, entry)
  }
  const rows: LedgerRow[] = Array.from(net.values())
    .filter((entry) => entry.quantity < 0)
    .sort((a, b) => pairKey(a.itemId, a.warehouseId).localeCompare(pairKey(b.itemId, b.warehouseId)))
    .map((entry) => ({
      itemId: entry.itemId,
      warehouseId: entry.warehouseId,
      movementType: 'IN' as const,
      quantity: -entry.quantity,
      referenceType: 'invoice' as const,
      referenceId: invoice.id,
      note: invoice.number,
    }))
  await applyLedger(tx, auth, rows, events, { enforceActive: false })
}

// ---- reads ----

export function listMovements(auth: AuthContext, query: ListMovementsQuery): Promise<Page<StockMovement>> {
  return repository.listMovements(db, auth.tenantId, query)
}

export function listBalances(auth: AuthContext, query: ListBalancesQuery): Promise<Page<StockBalance>> {
  return repository.listBalances(db, auth.tenantId, query)
}

export async function getSummary(auth: AuthContext, query: SummaryQuery): Promise<SummaryBody> {
  const [totals, lowStock, fastMoving, warehouses] = await Promise.all([
    repository.summaryTotals(db, auth.tenantId),
    repository.lowStockItems(db, auth.tenantId, SUMMARY_LOW_STOCK_LIMIT),
    repository.fastMovingItems(db, auth.tenantId, query.days, SUMMARY_FAST_MOVING_LIMIT),
    repository.listWarehouses(db, auth.tenantId, { status: 'all', limit: SUMMARY_WAREHOUSE_LIMIT }),
  ])
  const valuation = Number(totals.valuation)
  if (!Number.isSafeInteger(valuation)) {
    throw new AppError(500, 'internal_error', 'The stock valuation is above the supported range.')
  }
  return {
    data: {
      valuationMinor: valuation,
      currency: totals.currency,
      itemCount: totals.itemCount,
      activeItemCount: totals.activeItemCount,
      lowStockCount: totals.lowStockCount,
      outOfStockCount: totals.outOfStockCount,
      lowStock,
      fastMoving,
      windowDays: query.days,
      warehouses: warehouses.data,
    },
  }
}
// ---- AI integration ----

export type RestockInput = {
  itemId: string
  warehouseId: string
  quantity: number
  /** The id of the approved restock request. It is stored as the movement reference. */
  referenceId: string
  note: string | null
}

/**
 * Books received stock for an approved restock request: one IN movement, referenced to the request. It books the stock
 * as received at the item's unit cost. There is no purchase order or supplier payable in the system to match it to.
 * Runs inside the caller's transaction. An inactive item or warehouse cannot receive it. The caller publishes the events
 * after commit.
 */
export async function receiveRestockWithin(
  tx: Queryable,
  auth: AuthContext,
  input: RestockInput,
  events: InventoryEvent[]
): Promise<StockMovement> {
  const planned = planMovement(
    { type: 'IN', itemId: input.itemId, warehouseId: input.warehouseId, quantity: input.quantity, note: input.note },
    randomUUID()
  )
  const rows: LedgerRow[] = planned.map((row) => ({ ...row, referenceType: 'restock', referenceId: input.referenceId }))
  const inserted = await applyLedger(tx, auth, rows, events, { enforceActive: true })
  const movements = await repository.findMovementsByIds(
    tx,
    auth.tenantId,
    inserted.map((movement) => movement.id)
  )
  const movement = movements[0]
  if (!movement) throw new DomainError('item_not_found', 'The restock movement could not be read back.')
  return movement
}

/** Active items with the stock, price and sales figures the AI engine evaluates. `itemIds` null means every active item. */
export function listStockSignals(
  tx: Queryable,
  tenantId: string,
  windowDays: number,
  itemIds: readonly string[] | null
): Promise<StockSignal[]> {
  return repository.listStockSignals(tx, tenantId, windowDays, itemIds)
}
