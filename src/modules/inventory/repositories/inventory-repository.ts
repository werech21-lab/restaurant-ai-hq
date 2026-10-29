import type { Page } from '@/lib/api/cursor'
import { keysetClauses, toPage, type SortColumn } from '@/lib/api/keyset'
import type { Queryable } from '@/lib/db'
import type { Currency } from '@/lib/money'
import type { LedgerRow } from '@/modules/inventory/domain/stock'
import type {
  FastMovingItem,
  Item,
  ItemUnit,
  MovementType,
  ReferenceType,
  StockBalance,
  StockSignal,
  StockMovement,
  Warehouse,
  WarehouseStatus,
} from '@/modules/inventory/domain/types'
import type {
  BalanceSortKey,
  CreateItemInput,
  CreateWarehouseInput,
  ItemSortKey,
  ListBalancesQuery,
  ListItemsQuery,
  ListMovementsQuery,
  ListWarehousesQuery,
  UpdateItemInput,
  UpdateWarehouseInput,
} from '@/modules/inventory/schemas/inventory'

type Stamped<T> = Omit<T, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date }
type ItemRow = Stamped<Item>
type WarehouseRow = Stamped<Warehouse>
type MovementRow = Omit<StockMovement, 'createdAt'> & { createdAt: Date }

const ITEM_COLUMNS = `id, sku, name, unit, unit_cost_minor as "unitCostMinor", selling_price_minor as "sellingPriceMinor",
  currency, reorder_level as "reorderLevel", current_stock as "currentStock", is_active as "isActive", version,
  created_at as "createdAt", updated_at as "updatedAt", created_by as "createdBy"`

const WAREHOUSE_COLUMNS = `w.id, w.code, w.name, w.location, w.capacity, w.status, w.version,
  coalesce((select sum(b.on_hand) from stock_balances b where b.tenant_id = w.tenant_id and b.warehouse_id = w.id), 0)::bigint as "unitsStored",
  w.created_at as "createdAt", w.updated_at as "updatedAt", w.created_by as "createdBy"`

const itemSortColumns: Record<ItemSortKey, SortColumn> = {
  name: { sql: 'name', cast: 'text' },
  sku: { sql: 'sku', cast: 'text' },
  currentStock: { sql: 'current_stock', cast: 'bigint' },
  sellingPriceMinor: { sql: 'selling_price_minor', cast: 'bigint' },
}

const balanceSortColumns: Record<BalanceSortKey, SortColumn> = {
  itemName: { sql: '"itemName"', cast: 'text' },
  onHand: { sql: '"onHand"', cast: 'bigint' },
}

function toItem(row: ItemRow): Item {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }
}

function toWarehouse(row: WarehouseRow): Warehouse {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }
}

function toMovement(row: MovementRow): StockMovement {
  return { ...row, createdAt: row.createdAt.toISOString() }
}

function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
}

// ---- items ----

export async function insertItem(tx: Queryable, tenantId: string, userId: string, input: CreateItemInput): Promise<Item> {
  const result = await tx.query<ItemRow>(
    `insert into items (tenant_id, sku, name, unit, unit_cost_minor, selling_price_minor, reorder_level, is_active, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning ${ITEM_COLUMNS}`,
    [tenantId, input.sku, input.name, input.unit, input.unitCostMinor, input.sellingPriceMinor, input.reorderLevel, input.isActive, userId]
  )
  return toItem(result.rows[0])
}

export async function findItem(tx: Queryable, tenantId: string, id: string, options: { lock: boolean } = { lock: false }): Promise<Item | null> {
  const result = await tx.query<ItemRow>(
    `select ${ITEM_COLUMNS} from items where tenant_id = $1 and id = $2${options.lock ? ' for update' : ''}`,
    [tenantId, id]
  )
  return result.rows[0] ? toItem(result.rows[0]) : null
}

/** Locks the items in id order, so two movements touching the same items can never deadlock. */
export async function lockItems(tx: Queryable, tenantId: string, ids: readonly string[]): Promise<Item[]> {
  const result = await tx.query<ItemRow>(
    `select ${ITEM_COLUMNS} from items where tenant_id = $1 and id = any($2::uuid[]) order by id for update`,
    [tenantId, ids]
  )
  return result.rows.map(toItem)
}

export async function findItemStates(
  tx: Queryable,
  tenantId: string,
  ids: readonly string[]
): Promise<Map<string, { sku: string; isActive: boolean }>> {
  const result = await tx.query<{ id: string; sku: string; isActive: boolean }>(
    'select id, sku, is_active as "isActive" from items where tenant_id = $1 and id = any($2::uuid[])',
    [tenantId, ids]
  )
  return new Map(result.rows.map((row) => [row.id, { sku: row.sku, isActive: row.isActive }]))
}

export async function updateItem(tx: Queryable, tenantId: string, id: string, input: UpdateItemInput): Promise<Item | null> {
  const result = await tx.query<ItemRow>(
    `update items set name = $4, unit_cost_minor = $5, selling_price_minor = $6, reorder_level = $7, is_active = $8,
       version = version + 1
     where tenant_id = $1 and id = $2 and version = $3
     returning ${ITEM_COLUMNS}`,
    [tenantId, id, input.version, input.name, input.unitCostMinor, input.sellingPriceMinor, input.reorderLevel, input.isActive]
  )
  return result.rows[0] ? toItem(result.rows[0]) : null
}

export async function listItems(tx: Queryable, tenantId: string, query: ListItemsQuery): Promise<Page<Item>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status === 'active') filters += ' and is_active'
  if (query.status === 'inactive') filters += ' and not is_active'
  if (query.lowStock) filters += ' and is_active and current_stock <= reorder_level'
  if (query.q) {
    params.push(likePattern(query.q))
    filters += ` and (sku ilike $${params.length} or name ilike $${params.length})`
  }
  const keyset = keysetClauses({
    sortKey: query.sort,
    column: itemSortColumns[query.sort],
    direction: query.direction,
    cursor: query.cursor,
    params,
  })
  params.push(query.limit + 1)
  const result = await tx.query<ItemRow & { sortValue: string }>(
    `select ${ITEM_COLUMNS}, ${keyset.selectValue}
     from items
     where tenant_id = $1${filters}${keyset.where}
     order by ${keyset.orderBy}
     limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, query.sort, query.direction)
  return { data: page.data.map(toItem), nextCursor: page.nextCursor }
}

// ---- warehouses ----

export async function insertWarehouse(tx: Queryable, tenantId: string, userId: string, input: CreateWarehouseInput): Promise<Warehouse> {
  const inserted = await tx.query<{ id: string }>(
    `insert into warehouses (tenant_id, code, name, location, capacity, status, created_by)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [tenantId, input.code, input.name, input.location, input.capacity, input.status, userId]
  )
  const created = await findWarehouse(tx, tenantId, inserted.rows[0].id)
  if (!created) throw new Error('Inserted warehouse could not be read back')
  return created
}

export async function findWarehouse(tx: Queryable, tenantId: string, id: string, options: { lock: boolean } = { lock: false }): Promise<Warehouse | null> {
  if (options.lock) {
    await tx.query('select 1 from warehouses where tenant_id = $1 and id = $2 for update', [tenantId, id])
  }
  const result = await tx.query<WarehouseRow>(
    `select ${WAREHOUSE_COLUMNS} from warehouses w where w.tenant_id = $1 and w.id = $2`,
    [tenantId, id]
  )
  return result.rows[0] ? toWarehouse(result.rows[0]) : null
}

export async function findWarehouseStatuses(
  tx: Queryable,
  tenantId: string,
  ids: readonly string[]
): Promise<Map<string, { code: string; status: WarehouseStatus }>> {
  const result = await tx.query<{ id: string; code: string; status: WarehouseStatus }>(
    'select id, code, status from warehouses where tenant_id = $1 and id = any($2::uuid[])',
    [tenantId, ids]
  )
  return new Map(result.rows.map((row) => [row.id, { code: row.code, status: row.status }]))
}

export async function updateWarehouse(tx: Queryable, tenantId: string, id: string, input: UpdateWarehouseInput): Promise<boolean> {
  const result = await tx.query(
    `update warehouses set name = $4, location = $5, capacity = $6, status = $7, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3`,
    [tenantId, id, input.version, input.name, input.location, input.capacity, input.status]
  )
  return (result.rowCount ?? 0) > 0
}

export async function listWarehouses(tx: Queryable, tenantId: string, query: ListWarehousesQuery): Promise<Page<Warehouse>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status !== 'all') {
    params.push(query.status)
    filters += ` and w.status = $${params.length}`
  }
  // Warehouses are listed by name. The cursor carries the name and id like every other keyset list.
  const keyset = keysetClauses({
    sortKey: 'name',
    column: { sql: 'name', cast: 'text' },
    direction: 'asc',
    cursor: query.cursor,
    params,
  })
  params.push(query.limit + 1)
  const result = await tx.query<WarehouseRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (
       select ${WAREHOUSE_COLUMNS} from warehouses w where w.tenant_id = $1${filters}
     ) x
     where true${keyset.where}
     order by ${keyset.orderBy}
     limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'name', 'asc')
  return { data: page.data.map(toWarehouse), nextCursor: page.nextCursor }
}

// ---- stock ledger and balances ----

export async function readOnHand(
  tx: Queryable,
  tenantId: string,
  itemIds: readonly string[],
  warehouseIds: readonly string[]
): Promise<Array<{ itemId: string; warehouseId: string; onHand: number }>> {
  const result = await tx.query<{ itemId: string; warehouseId: string; onHand: number }>(
    `select item_id as "itemId", warehouse_id as "warehouseId", on_hand as "onHand"
     from stock_balances
     where tenant_id = $1 and item_id = any($2::uuid[]) and warehouse_id = any($3::uuid[])`,
    [tenantId, itemIds, warehouseIds]
  )
  return result.rows
}

export type InsertedMovement = {
  id: string
  itemId: string
  warehouseId: string
  movementType: MovementType
  quantity: number
  referenceType: ReferenceType
  referenceId: string | null
  note: string | null
}

export async function insertMovements(
  tx: Queryable,
  tenantId: string,
  userId: string,
  rows: readonly LedgerRow[]
): Promise<InsertedMovement[]> {
  const inserted: InsertedMovement[] = []
  // One row at a time, in the order given: the trigger updates balances per row and the caller sorts for lock order.
  for (const row of rows) {
    const result = await tx.query<InsertedMovement>(
      `insert into stock_movements
         (tenant_id, item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, note, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id, item_id as "itemId", warehouse_id as "warehouseId", movement_type as "movementType", quantity,
         reference_type as "referenceType", reference_id as "referenceId", note`,
      [tenantId, row.itemId, row.warehouseId, row.movementType, row.quantity, row.referenceType, row.referenceId, row.note, userId]
    )
    inserted.push(result.rows[0])
  }
  return inserted
}

export type InvoiceMovement = { itemId: string; warehouseId: string; movementType: MovementType; quantity: number }

export async function findInvoiceMovements(tx: Queryable, tenantId: string, invoiceId: string): Promise<InvoiceMovement[]> {
  const result = await tx.query<InvoiceMovement>(
    `select item_id as "itemId", warehouse_id as "warehouseId", movement_type as "movementType", quantity
     from stock_movements
     where tenant_id = $1 and reference_type = 'invoice' and reference_id = $2
     order by item_id, warehouse_id, movement_type`,
    [tenantId, invoiceId]
  )
  return result.rows
}

export async function findMovementsByIds(tx: Queryable, tenantId: string, ids: readonly string[]): Promise<StockMovement[]> {
  const result = await tx.query<MovementRow>(
    `select m.id, m.item_id as "itemId", i.sku, i.name as "itemName", m.warehouse_id as "warehouseId", w.code as "warehouseCode",
            m.movement_type as "movementType", m.quantity, m.reference_type as "referenceType", m.reference_id as "referenceId",
            m.note, m.created_at as "createdAt", m.created_by as "createdBy"
     from stock_movements m
     join items i on i.tenant_id = m.tenant_id and i.id = m.item_id
     join warehouses w on w.tenant_id = m.tenant_id and w.id = m.warehouse_id
     where m.tenant_id = $1 and m.id = any($2::uuid[])
     order by m.created_at, m.id`,
    [tenantId, ids]
  )
  return result.rows.map(toMovement)
}

export async function listMovements(tx: Queryable, tenantId: string, query: ListMovementsQuery): Promise<Page<StockMovement>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.itemId) {
    params.push(query.itemId)
    filters += ` and "itemId" = $${params.length}`
  }
  if (query.warehouseId) {
    params.push(query.warehouseId)
    filters += ` and "warehouseId" = $${params.length}`
  }
  if (query.type) {
    params.push(query.type)
    filters += ` and "movementType" = $${params.length}`
  }
  const keyset = keysetClauses({
    sortKey: 'createdAt',
    column: { sql: '"createdAt"', cast: 'timestamptz' },
    direction: query.direction,
    cursor: query.cursor,
    params,
  })
  params.push(query.limit + 1)
  const result = await tx.query<MovementRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (
       select m.id, m.item_id as "itemId", i.sku, i.name as "itemName", m.warehouse_id as "warehouseId", w.code as "warehouseCode",
              m.movement_type as "movementType", m.quantity, m.reference_type as "referenceType", m.reference_id as "referenceId",
              m.note, m.created_at as "createdAt", m.created_by as "createdBy"
       from stock_movements m
       join items i on i.tenant_id = m.tenant_id and i.id = m.item_id
       join warehouses w on w.tenant_id = m.tenant_id and w.id = m.warehouse_id
       where m.tenant_id = $1
     ) x
     where true${filters}${keyset.where}
     order by ${keyset.orderBy}
     limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'createdAt', query.direction)
  return { data: page.data.map(toMovement), nextCursor: page.nextCursor }
}

export async function listBalances(tx: Queryable, tenantId: string, query: ListBalancesQuery): Promise<Page<StockBalance>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.itemId) {
    params.push(query.itemId)
    filters += ` and "itemId" = $${params.length}`
  }
  if (query.warehouseId) {
    params.push(query.warehouseId)
    filters += ` and "warehouseId" = $${params.length}`
  }
  const keyset = keysetClauses({
    sortKey: query.sort,
    column: balanceSortColumns[query.sort],
    direction: query.direction,
    cursor: query.cursor,
    params,
  })
  params.push(query.limit + 1)
  const result = await tx.query<StockBalance & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (
       select b.id, b.item_id as "itemId", i.sku, i.name as "itemName", i.unit, b.warehouse_id as "warehouseId",
              w.code as "warehouseCode", w.name as "warehouseName", b.on_hand as "onHand"
       from stock_balances b
       join items i on i.tenant_id = b.tenant_id and i.id = b.item_id
       join warehouses w on w.tenant_id = b.tenant_id and w.id = b.warehouse_id
       where b.tenant_id = $1
     ) x
     where true${filters}${keyset.where}
     order by ${keyset.orderBy}
     limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, query.sort, query.direction)
  return { data: page.data, nextCursor: page.nextCursor }
}

export async function listItemBalances(tx: Queryable, tenantId: string, itemId: string): Promise<StockBalance[]> {
  const result = await tx.query<StockBalance>(
    `select b.id, b.item_id as "itemId", i.sku, i.name as "itemName", i.unit, b.warehouse_id as "warehouseId",
            w.code as "warehouseCode", w.name as "warehouseName", b.on_hand as "onHand"
     from stock_balances b
     join items i on i.tenant_id = b.tenant_id and i.id = b.item_id
     join warehouses w on w.tenant_id = b.tenant_id and w.id = b.warehouse_id
     where b.tenant_id = $1 and b.item_id = $2
     order by w.name, b.id`,
    [tenantId, itemId]
  )
  return result.rows
}

// ---- summary ----

export type SummaryTotals = {
  itemCount: number
  activeItemCount: number
  lowStockCount: number
  outOfStockCount: number
  valuation: string
  currency: Currency
}

export async function summaryTotals(tx: Queryable, tenantId: string): Promise<SummaryTotals> {
  const result = await tx.query<SummaryTotals>(
    `select count(*)::bigint as "itemCount",
            (count(*) filter (where is_active))::bigint as "activeItemCount",
            (count(*) filter (where is_active and current_stock <= reorder_level))::bigint as "lowStockCount",
            (count(*) filter (where is_active and current_stock = 0))::bigint as "outOfStockCount",
            coalesce(sum(current_stock::numeric * unit_cost_minor), 0)::text as valuation,
            'KWD'::text as currency
     from items where tenant_id = $1`,
    [tenantId]
  )
  return result.rows[0]
}

export async function lowStockItems(tx: Queryable, tenantId: string, limit: number): Promise<Item[]> {
  const result = await tx.query<ItemRow>(
    `select ${ITEM_COLUMNS} from items
     where tenant_id = $1 and is_active and current_stock <= reorder_level
     order by current_stock, name, id
     limit $2`,
    [tenantId, limit]
  )
  return result.rows.map(toItem)
}

export async function fastMovingItems(tx: Queryable, tenantId: string, days: number, limit: number): Promise<FastMovingItem[]> {
  const result = await tx.query<{ itemId: string; sku: string; name: string; unit: ItemUnit; outQuantity: number }>(
    `select i.id as "itemId", i.sku, i.name, i.unit, (-sum(m.quantity))::bigint as "outQuantity"
     from stock_movements m
     join items i on i.tenant_id = m.tenant_id and i.id = m.item_id
     where m.tenant_id = $1 and m.movement_type = 'OUT' and m.created_at >= now() - ($2::int * interval '1 day')
     group by i.id, i.sku, i.name, i.unit
     order by "outQuantity" desc, i.name, i.id
     limit $3`,
    [tenantId, days, limit]
  )
  return result.rows
}

type StockSignalRow = Omit<StockSignal, 'restockWarehouse'> & {
  warehouseId: string | null
  warehouseCode: string | null
  warehouseName: string | null
}

/**
 * Active items with what the AI engine needs: stock, prices, the units that left in the window and the active
 * warehouse holding the most of the item (ties go to the lowest code). Pass `itemIds` to look at some items only.
 */
export async function listStockSignals(
  tx: Queryable,
  tenantId: string,
  windowDays: number,
  itemIds: readonly string[] | null
): Promise<StockSignal[]> {
  const result = await tx.query<StockSignalRow>(
    `select i.id as "itemId", i.sku, i.name, i.unit, i.current_stock as "currentStock", i.reorder_level as "reorderLevel",
            i.unit_cost_minor as "unitCostMinor", i.selling_price_minor as "sellingPriceMinor", i.version,
            coalesce((select -sum(m.quantity) from stock_movements m
                      where m.tenant_id = i.tenant_id and m.item_id = i.id and m.movement_type = 'OUT'
                        and m.created_at >= now() - ($2::int * interval '1 day')), 0)::bigint as "outQuantity",
            w.id as "warehouseId", w.code as "warehouseCode", w.name as "warehouseName"
     from items i
     left join lateral (
       select w2.id, w2.code, w2.name
       from warehouses w2
       left join stock_balances sb on sb.tenant_id = w2.tenant_id and sb.warehouse_id = w2.id and sb.item_id = i.id
       where w2.tenant_id = i.tenant_id and w2.status = 'active'
       order by coalesce(sb.on_hand, 0) desc, w2.code, w2.id
       limit 1
     ) w on true
     where i.tenant_id = $1 and i.is_active and ($3::uuid[] is null or i.id = any($3::uuid[]))
     order by i.name, i.id`,
    [tenantId, windowDays, itemIds === null ? null : [...itemIds]]
  )
  return result.rows.map(({ warehouseId, warehouseCode, warehouseName, ...signal }) => ({
    ...signal,
    restockWarehouse:
      warehouseId !== null && warehouseCode !== null && warehouseName !== null
        ? { id: warehouseId, code: warehouseCode, name: warehouseName }
        : null,
  }))
}

export type CostVarianceRow = {
  itemId: string
  sku: string
  name: string
  onHand: number
  unitCostMinor: number
  openingUnitMinor: number
  sellingPriceMinor: number
}

export async function listCostVariances(tx: Queryable, tenantId: string): Promise<CostVarianceRow[]> {
  const result = await tx.query<CostVarianceRow>(
    `select i.id as "itemId", i.sku, i.name, i.current_stock as "onHand",
            i.unit_cost_minor::bigint as "unitCostMinor", i.selling_price_minor::bigint as "sellingPriceMinor",
            coalesce((
              select e.average_before_minor from item_cost_events e
              where e.tenant_id = i.tenant_id and e.item_id = i.id and e.kind = 'receipt'
              order by e.created_at desc, e.id desc
              limit 1
            ), i.unit_cost_minor)::bigint as "openingUnitMinor"
     from items i
     where i.tenant_id = $1 and i.is_active
     order by i.sku, i.id`,
    [tenantId]
  )
  return result.rows.map((row) => ({
    ...row,
    onHand: Number(row.onHand),
    unitCostMinor: Number(row.unitCostMinor),
    openingUnitMinor: Number(row.openingUnitMinor),
    sellingPriceMinor: Number(row.sellingPriceMinor),
  }))
}

export async function readItemCosts(
  tx: Queryable,
  tenantId: string,
  ids: readonly string[]
): Promise<Array<{ itemId: string; unitCostMinor: number; sellingPriceMinor: number; onHand: number }>> {
  if (ids.length === 0) return []
  const result = await tx.query<{ itemId: string; unitCostMinor: number; sellingPriceMinor: number; onHand: number }>(
    `select id as "itemId", unit_cost_minor::bigint as "unitCostMinor", selling_price_minor::bigint as "sellingPriceMinor",
            current_stock as "onHand"
     from items where tenant_id = $1 and id = any($2::uuid[])`,
    [tenantId, [...ids]]
  )
  return result.rows.map((row) => ({
    itemId: row.itemId,
    unitCostMinor: Number(row.unitCostMinor),
    sellingPriceMinor: Number(row.sellingPriceMinor),
    onHand: Number(row.onHand),
  }))
}
