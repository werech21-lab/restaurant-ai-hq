import { DomainError } from '@/lib/domain-error'
import { addMoney, money, type Money } from '@/lib/money'
import { MAX_MOVEMENT_QUANTITY, type MovementType, type ReferenceType } from '@/modules/inventory/domain/types'

/** One row of the stock ledger before it is written. Quantity is signed. */
export type LedgerRow = {
  itemId: string
  warehouseId: string
  movementType: MovementType
  quantity: number
  referenceType: ReferenceType
  referenceId: string | null
  note: string | null
}

export type MovementRequest =
  | { type: 'IN' | 'OUT'; itemId: string; warehouseId: string; quantity: number; note: string | null }
  | { type: 'TRANSFER'; itemId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; note: string | null }

export type StockNeed = { itemId: string; warehouseId: string; quantity: number }

export type Shortage = StockNeed & { available: number }

export function pairKey(itemId: string, warehouseId: string): string {
  return `${itemId}:${warehouseId}`
}

function assertQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_MOVEMENT_QUANTITY) {
    throw new DomainError('invalid_quantity', `Quantity must be a whole number from 1 to ${MAX_MOVEMENT_QUANTITY.toLocaleString('en-US')}.`)
  }
}

/**
 * Turns a manual request into ledger rows. IN is positive, OUT is negative. A transfer is two rows that share
 * `transferId`: negative at the source and positive at the destination, so a transfer never changes the item total.
 */
export function planMovement(request: MovementRequest, transferId: string): LedgerRow[] {
  assertQuantity(request.quantity)
  if (request.type === 'TRANSFER') {
    if (request.fromWarehouseId === request.toWarehouseId) {
      throw new DomainError('same_warehouse', 'A transfer needs two different warehouses.')
    }
    const shared = { itemId: request.itemId, movementType: 'TRANSFER' as const, referenceType: 'transfer' as const, referenceId: transferId, note: request.note }
    return [
      { ...shared, warehouseId: request.fromWarehouseId, quantity: -request.quantity },
      { ...shared, warehouseId: request.toWarehouseId, quantity: request.quantity },
    ]
  }
  return [
    {
      itemId: request.itemId,
      warehouseId: request.warehouseId,
      movementType: request.type,
      quantity: request.type === 'IN' ? request.quantity : -request.quantity,
      referenceType: 'manual',
      referenceId: null,
      note: request.note,
    },
  ]
}

/** Net stock each item and warehouse must be able to give up. Inflows in the same batch offset outflows of the same pair. */
export function stockNeeds(rows: readonly LedgerRow[]): StockNeed[] {
  const net = new Map<string, StockNeed>()
  for (const row of rows) {
    const key = pairKey(row.itemId, row.warehouseId)
    const entry = net.get(key) ?? { itemId: row.itemId, warehouseId: row.warehouseId, quantity: 0 }
    entry.quantity += row.quantity
    net.set(key, entry)
  }
  return Array.from(net.values())
    .filter((entry) => entry.quantity < 0)
    .map((entry) => ({ ...entry, quantity: -entry.quantity }))
}

/** Compares needs with what is on hand. `available` is keyed by pairKey; a missing pair means zero. */
export function findShortages(needs: readonly StockNeed[], available: ReadonlyMap<string, number>): Shortage[] {
  return needs
    .map((need) => ({ ...need, available: available.get(pairKey(need.itemId, need.warehouseId)) ?? 0 }))
    .filter((need) => need.available < need.quantity)
}

export type InvoiceStockLine = { itemId: string | null; warehouseId: string | null; quantity: number }

/** Sums the stock an invoice takes, per item and warehouse. Lines without an item take nothing. */
export function invoiceNeeds(lines: readonly InvoiceStockLine[]): StockNeed[] {
  const totals = new Map<string, StockNeed>()
  for (const line of lines) {
    if (line.itemId === null || line.warehouseId === null) continue
    assertQuantity(line.quantity)
    const key = pairKey(line.itemId, line.warehouseId)
    const entry = totals.get(key) ?? { itemId: line.itemId, warehouseId: line.warehouseId, quantity: 0 }
    entry.quantity += line.quantity
    totals.set(key, entry)
  }
  return Array.from(totals.values())
}

/** True when stock crosses down to the reorder level or below. Fires once per crossing, not on every later sale. */
export function reachedReorderLevel(before: number, after: number, reorderLevel: number): boolean {
  return before > reorderLevel && after <= reorderLevel
}

export function becameDepleted(before: number, after: number): boolean {
  return before > 0 && after === 0
}

/** An item is low when stock is at or below its reorder level. */
export function isLowStock(currentStock: number, reorderLevel: number): boolean {
  return currentStock <= reorderLevel
}

/** Value of stock on hand: quantity x unit cost, in integer fils. */
export function stockValue(quantity: number, unitCost: Money): Money {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new DomainError('invalid_quantity', 'Stock quantity must be a whole number of zero or more.')
  }
  if (!Number.isSafeInteger(unitCost.amountMinor) || unitCost.amountMinor < 0) {
    throw new DomainError('invalid_cost', 'Unit cost must be zero or more.')
  }
  const value = BigInt(quantity) * BigInt(unitCost.amountMinor)
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new DomainError('amount_too_large', 'The stock value is above the maximum allowed amount.')
  }
  return money(Number(value), unitCost.currency)
}

/** Adds stock values. Mixing currencies throws CurrencyMismatchError. */
export function totalValue(values: readonly Money[]): Money {
  return values.reduce((sum, value) => addMoney(sum, value), money(0))
}

/** Share of a warehouse's capacity in use, as a whole percent. Null when no capacity is set. Zero capacity with stock is 100. */
export function utilizationPercent(unitsStored: number, capacity: number | null): number | null {
  if (capacity === null) return null
  if (capacity === 0) return unitsStored > 0 ? 100 : 0
  return Math.round((unitsStored * 100) / capacity)
}
