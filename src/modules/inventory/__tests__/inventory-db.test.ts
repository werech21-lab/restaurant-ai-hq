import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  bootstrapTenant,
  createUser,
  getPglite,
  startDatabase,
  stopDatabase,
} from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'
import { subscribe, type BusEvent } from '@/lib/events/bus'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

import { createCustomer } from '@/modules/crm'
import { approveInvoice, createInvoice, getInvoice, recordPayment, submitInvoice, voidInvoice } from '@/modules/finance'
import {
  createItem,
  createWarehouse,
  getItem,
  getSummary,
  getWarehouse,
  listBalances,
  listItems,
  listMovements,
  listWarehouses,
  receivePurchaseWithin,
  recordMovement,
  returnPurchaseWithin,
  updateItem,
  updateWarehouse,
  type InventoryEvent,
  type Item,
  type Warehouse,
} from '@/modules/inventory'
import {
  listBalancesQuerySchema,
  listItemsQuerySchema,
  listMovementsQuerySchema,
  listWarehousesQuerySchema,
  summaryQuerySchema,
  type CreateItemInput,
  type CreateWarehouseInput,
} from '@/modules/inventory/schemas/inventory'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

let authA: AuthContext
let authB: AuthContext
let authC: AuthContext
let customerA: string
let mainWarehouse: Warehouse
let backWarehouse: Warehouse
const events: BusEvent[] = []

let keyCounter = 0
const nextKey = () => `inv-key-${String(++keyCounter).padStart(8, '0')}`
let skuCounter = 0
let codeCounter = 0

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

function itemInput(overrides: Partial<CreateItemInput> = {}): CreateItemInput {
  return {
    sku: `SKU-${++skuCounter}`,
    name: `Item ${skuCounter}`,
    unit: 'piece',
    unitCostMinor: 1_000,
    sellingPriceMinor: 2_000,
    reorderLevel: 5,
    isActive: true,
    ...overrides,
  }
}

function warehouseInput(overrides: Partial<CreateWarehouseInput> = {}): CreateWarehouseInput {
  return { code: `W${++codeCounter}`, name: `Warehouse ${codeCounter}`, location: null, capacity: null, status: 'active', ...overrides }
}

async function newItem(auth: AuthContext, overrides: Partial<CreateItemInput> = {}): Promise<Item> {
  return (await createItem(auth, nextKey(), itemInput(overrides))).body.data
}

async function newWarehouse(auth: AuthContext, overrides: Partial<CreateWarehouseInput> = {}): Promise<Warehouse> {
  return (await createWarehouse(auth, nextKey(), warehouseInput(overrides))).body.data
}

async function stockIn(auth: AuthContext, itemId: string, warehouseId: string, quantity: number) {
  return recordMovement(auth, nextKey(), { type: 'IN', itemId, warehouseId, quantity, note: null })
}

async function stockOut(auth: AuthContext, itemId: string, warehouseId: string, quantity: number) {
  return recordMovement(auth, nextKey(), { type: 'OUT', itemId, warehouseId, quantity, note: null })
}

async function currentStock(itemId: string): Promise<number> {
  const result = await getPglite().query<{ current_stock: number }>('select current_stock from items where id = $1', [itemId])
  return result.rows[0].current_stock
}

async function onHand(itemId: string, warehouseId: string): Promise<number> {
  const result = await getPglite().query<{ on_hand: number }>(
    'select on_hand from stock_balances where item_id = $1 and warehouse_id = $2',
    [itemId, warehouseId]
  )
  return result.rows[0]?.on_hand ?? 0
}

async function countMovements(itemId: string): Promise<number> {
  const result = await getPglite().query<{ count: number }>('select count(*)::int as count from stock_movements where item_id = $1', [itemId])
  return result.rows[0].count
}

/** Every item's cached stock must equal both its ledger sum and its balance sum. */
async function expectLedgerConsistent(tenantId: string) {
  const result = await getPglite().query<{ bad: number }>(
    `select count(*)::int as bad from items i
     where i.tenant_id = $1 and (
       i.current_stock <> coalesce((select sum(m.quantity) from stock_movements m where m.tenant_id = i.tenant_id and m.item_id = i.id), 0)
       or i.current_stock <> coalesce((select sum(b.on_hand) from stock_balances b where b.tenant_id = i.tenant_id and b.item_id = i.id), 0)
     )`,
    [tenantId]
  )
  expect(result.rows[0].bad).toBe(0)
}

function eventNames(): string[] {
  return events.map((event) => event.name)
}

async function invoiceFor(
  auth: AuthContext,
  lines: Array<{ itemId: string; warehouseId: string; quantity: number; unitPriceMinor?: number }>
) {
  const outcome = await createInvoice(auth, nextKey(), {
    customerId: customerA,
    issueDate: day(-1),
    dueDate: day(29),
    notes: null,
    lines: lines.map((line, index) => ({
      description: `Line ${index + 1}`,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor ?? 1_000,
      taxRateBps: 0,
      itemId: line.itemId,
      warehouseId: line.warehouseId,
    })),
  })
  return outcome.body.data
}

beforeAll(async () => {
  await startDatabase()
  await createUser(USER_A)
  await createUser(USER_B)
  await createUser(USER_C)
  const tenantA = await bootstrapTenant('Tenant A', 'tenant-a', USER_A)
  const tenantB = await bootstrapTenant('Tenant B', 'tenant-b', USER_B)
  const tenantC = await bootstrapTenant('Tenant C', 'tenant-c', USER_C)
  authA = { userId: USER_A, tenantId: tenantA, permissions: new Set<string>() }
  authB = { userId: USER_B, tenantId: tenantB, permissions: new Set<string>() }
  authC = { userId: USER_C, tenantId: tenantC, permissions: new Set<string>() }
  customerA = (await createCustomer(authA, { name: 'Al Noor Catering', customerType: 'company', email: null, phone: null, taxId: null, address: null, creditLimitMinor: null, status: 'active', notes: null })).id
  mainWarehouse = await newWarehouse(authA, { code: 'MAIN', name: 'Main store' })
  backWarehouse = await newWarehouse(authA, { code: 'BACK', name: 'Back store' })
  for (const name of [
    'inventory.stock.moved',
    'inventory.stock.depleted',
    'inventory.item.reorder_level_reached',
    'inventory.item.created',
    'inventory.warehouse.created',
  ]) {
    subscribe(name, (event) => void events.push(event))
  }
}, 60_000)

afterAll(async () => {
  await stopDatabase()
})

describe('bootstrap permissions', () => {
  it('gives owners the inventory permissions and viewers read only', async () => {
    const result = await getPglite().query<{ name: string; permission: string }>(
      `select r.name, rp.permission from roles r join role_permissions rp on rp.role_id = r.id
       where r.tenant_id = $1 and rp.permission like 'inventory.%'`,
      [authA.tenantId]
    )
    const byRole = (name: string) => result.rows.filter((row) => row.name === name).map((row) => row.permission).sort()
    expect(byRole('owner')).toEqual([
      'inventory.item.create',
      'inventory.item.read',
      'inventory.item.update',
      'inventory.stock.adjust',
      'inventory.stock.read',
      'inventory.warehouse.create',
      'inventory.warehouse.read',
      'inventory.warehouse.update',
    ])
    expect(byRole('viewer')).toEqual(['inventory.item.read', 'inventory.stock.read', 'inventory.warehouse.read'])
  })
})

describe('items', () => {
  it('creates an item with zero stock, an audit row and an event', async () => {
    events.length = 0
    const item = await newItem(authA, { sku: 'COLA-33', name: 'Cola 330ml' })
    expect(item).toMatchObject({ sku: 'COLA-33', currentStock: 0, version: 1, isActive: true, currency: 'KWD' })
    const audit = await getPglite().query<{ action: string }>("select action from audit_log where entity = 'item' and entity_id = $1", [item.id])
    expect(audit.rows).toEqual([{ action: 'create' }])
    expect(eventNames()).toContain('inventory.item.created')
  })

  it('rejects a duplicate SKU in the same tenant with 409 and allows it in another tenant', async () => {
    await newItem(authA, { sku: 'DUP-1' })
    await expect(createItem(authA, nextKey(), itemInput({ sku: 'DUP-1' }))).rejects.toMatchObject({ status: 409, code: 'sku_exists' })
    await expect(createItem(authB, nextKey(), itemInput({ sku: 'DUP-1' }))).resolves.toMatchObject({ status: 201 })
  })

  it('replays the same Idempotency-Key without creating a second item, and refuses the key with a different body', async () => {
    const key = nextKey()
    const input = itemInput({ sku: 'IDEM-1' })
    const first = await createItem(authA, key, input)
    const second = await createItem(authA, key, input)
    expect(second.replayed).toBe(true)
    expect(second.body.data.id).toBe(first.body.data.id)
    const count = await getPglite().query<{ count: number }>("select count(*)::int as count from items where sku = 'IDEM-1' and tenant_id = $1", [authA.tenantId])
    expect(count.rows[0].count).toBe(1)
    await expect(createItem(authA, key, itemInput({ sku: 'IDEM-2' }))).rejects.toMatchObject({ status: 422, code: 'idempotency_key_reused' })
  })

  it('updates an item by version and returns 409 on a stale version', async () => {
    const item = await newItem(authA)
    const updated = await updateItem(authA, item.id, {
      version: 1,
      name: 'Renamed',
      unitCostMinor: 1_500,
      sellingPriceMinor: 2_500,
      reorderLevel: 8,
      isActive: true,
    })
    expect(updated.data).toMatchObject({ name: 'Renamed', unitCostMinor: 1_500, reorderLevel: 8, version: 2, sku: item.sku })
    await expect(
      updateItem(authA, item.id, { version: 1, name: 'Late', unitCostMinor: 1, sellingPriceMinor: 1, reorderLevel: 0, isActive: true })
    ).rejects.toMatchObject({ status: 409, code: 'version_conflict' })
    const audit = await getPglite().query<{ action: string }>("select action from audit_log where entity = 'item' and entity_id = $1 order by created_at", [item.id])
    expect(audit.rows.map((row) => row.action)).toEqual(['create', 'update'])
  })

  it('returns 404 for an unknown item and hides another tenant\'s item', async () => {
    const item = await newItem(authA)
    await expect(getItem(authA, '99999999-9999-4999-8999-999999999999')).rejects.toMatchObject({ status: 404, code: 'item_not_found' })
    await expect(getItem(authB, item.id)).rejects.toMatchObject({ status: 404 })
    await expect(
      updateItem(authB, item.id, { version: 1, name: 'Hack', unitCostMinor: 1, sellingPriceMinor: 1, reorderLevel: 0, isActive: true })
    ).rejects.toMatchObject({ status: 404 })
  })

  it('stores whole-number quantities only', async () => {
    const item = await newItem(authA)
    await expect(getPglite().query('update items set current_stock = -1 where id = $1', [item.id])).rejects.toThrow()
    await expect(getPglite().query('update items set unit_cost_minor = -1 where id = $1', [item.id])).rejects.toThrow()
    await expect(getPglite().query('update items set reorder_level = -1 where id = $1', [item.id])).rejects.toThrow()
  })
})

describe('warehouses', () => {
  it('creates, rejects a duplicate code, and updates by version', async () => {
    const created = await newWarehouse(authA, { code: 'COLD', name: 'Cold room', location: 'Shuwaikh', capacity: 500 })
    expect(created).toMatchObject({ code: 'COLD', location: 'Shuwaikh', capacity: 500, status: 'active', unitsStored: 0, version: 1 })
    await expect(createWarehouse(authA, nextKey(), warehouseInput({ code: 'COLD' }))).rejects.toMatchObject({ status: 409, code: 'warehouse_code_exists' })
    const updated = await updateWarehouse(authA, created.id, { version: 1, name: 'Cold room 2', location: null, capacity: 800, status: 'inactive' })
    expect(updated.data).toMatchObject({ name: 'Cold room 2', capacity: 800, status: 'inactive', version: 2 })
    await expect(updateWarehouse(authA, created.id, { version: 1, name: 'x', location: null, capacity: null, status: 'active' })).rejects.toMatchObject({
      status: 409,
      code: 'version_conflict',
    })
    await expect(getWarehouse(authB, created.id)).rejects.toMatchObject({ status: 404 })
  })

  it('reports units stored and pages by name', async () => {
    const item = await newItem(authA)
    const first = await newWarehouse(authA, { name: 'Zeta list 1' })
    await newWarehouse(authA, { name: 'Zeta list 2' })
    await newWarehouse(authA, { name: 'Zeta list 3' })
    await stockIn(authA, item.id, first.id, 12)
    expect((await getWarehouse(authA, first.id)).data.unitsStored).toBe(12)

    const seen: string[] = []
    let cursor: string | undefined
    for (let guard = 0; guard < 20; guard += 1) {
      const page = await listWarehouses(authA, listWarehousesQuerySchema.parse({ limit: '2', ...(cursor ? { cursor } : {}) }))
      seen.push(...page.data.map((warehouse) => warehouse.id))
      if (!page.nextCursor) break
      cursor = page.nextCursor
    }
    expect(new Set(seen).size).toBe(seen.length)
    expect(seen).toContain(first.id)
    const names = (await listWarehouses(authA, listWarehousesQuerySchema.parse({ status: 'all', limit: '100' }))).data.map((warehouse) => warehouse.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })
})

describe('stock movements', () => {
  it('adds stock with IN and keeps item, balance and ledger in step', async () => {
    events.length = 0
    const item = await newItem(authA, { reorderLevel: 0 })
    const outcome = await recordMovement(authA, nextKey(), { type: 'IN', itemId: item.id, warehouseId: mainWarehouse.id, quantity: 40, note: 'Opening count' })
    expect(outcome.status).toBe(201)
    expect(outcome.body.data.movements).toHaveLength(1)
    expect(outcome.body.data.movements[0]).toMatchObject({ movementType: 'IN', quantity: 40, referenceType: 'manual', referenceId: null, note: 'Opening count', sku: item.sku })
    expect(await currentStock(item.id)).toBe(40)
    expect(await onHand(item.id, mainWarehouse.id)).toBe(40)
    expect(eventNames()).toContain('inventory.stock.moved')
    await expectLedgerConsistent(authA.tenantId)
  })

  it('removes stock with OUT and writes an audit row per movement', async () => {
    const item = await newItem(authA, { reorderLevel: 0 })
    await stockIn(authA, item.id, mainWarehouse.id, 10)
    const outcome = await stockOut(authA, item.id, mainWarehouse.id, 4)
    expect(outcome.body.data.movements[0]).toMatchObject({ movementType: 'OUT', quantity: -4 })
    expect(await currentStock(item.id)).toBe(6)
    const audit = await getPglite().query<{ count: number }>("select count(*)::int as count from audit_log where entity = 'stock_movement' and entity_id = $1", [
      outcome.body.data.movements[0].id,
    ])
    expect(audit.rows[0].count).toBe(1)
  })

  it('refuses an OUT larger than the stock with 409 and writes nothing', async () => {
    const item = await newItem(authA)
    await stockIn(authA, item.id, mainWarehouse.id, 3)
    const before = await countMovements(item.id)
    await expect(stockOut(authA, item.id, mainWarehouse.id, 4)).rejects.toMatchObject({ code: 'insufficient_stock' })
    expect(await currentStock(item.id)).toBe(3)
    expect(await countMovements(item.id)).toBe(before)
  })

  it('looks at the warehouse, not the item total, when checking stock', async () => {
    const item = await newItem(authA)
    await stockIn(authA, item.id, mainWarehouse.id, 10)
    await expect(stockOut(authA, item.id, backWarehouse.id, 1)).rejects.toMatchObject({ code: 'insufficient_stock' })
  })

  it('allows an OUT of exactly the stock on hand and then reports depletion', async () => {
    events.length = 0
    const item = await newItem(authA, { reorderLevel: 0 })
    await stockIn(authA, item.id, mainWarehouse.id, 5)
    await stockOut(authA, item.id, mainWarehouse.id, 5)
    expect(await currentStock(item.id)).toBe(0)
    expect(events.filter((event) => event.name === 'inventory.stock.depleted')).toHaveLength(1)
  })

  it('fires the reorder alert once, when stock first reaches the reorder level', async () => {
    events.length = 0
    const item = await newItem(authA, { reorderLevel: 10 })
    await stockIn(authA, item.id, mainWarehouse.id, 30)
    expect(eventNames()).not.toContain('inventory.item.reorder_level_reached')
    await stockOut(authA, item.id, mainWarehouse.id, 15)
    expect(eventNames()).not.toContain('inventory.item.reorder_level_reached')
    await stockOut(authA, item.id, mainWarehouse.id, 5)
    const alerts = events.filter((event) => event.name === 'inventory.item.reorder_level_reached')
    expect(alerts).toHaveLength(1)
    expect(alerts[0].payload).toMatchObject({ itemId: item.id, currentStock: 10, reorderLevel: 10 })
    await stockOut(authA, item.id, mainWarehouse.id, 2)
    expect(events.filter((event) => event.name === 'inventory.item.reorder_level_reached')).toHaveLength(1)
    await stockIn(authA, item.id, mainWarehouse.id, 20)
    await stockOut(authA, item.id, mainWarehouse.id, 25)
    expect(events.filter((event) => event.name === 'inventory.item.reorder_level_reached')).toHaveLength(2)
  })

  it('transfers stock atomically as two linked rows without changing the item total', async () => {
    events.length = 0
    const item = await newItem(authA, { reorderLevel: 0 })
    await stockIn(authA, item.id, mainWarehouse.id, 20)
    const outcome = await recordMovement(authA, nextKey(), {
      type: 'TRANSFER',
      itemId: item.id,
      fromWarehouseId: mainWarehouse.id,
      toWarehouseId: backWarehouse.id,
      quantity: 8,
      note: 'Rebalance',
    })
    const [out, into] = outcome.body.data.movements
    expect(outcome.body.data.movements).toHaveLength(2)
    expect(out.referenceId).not.toBeNull()
    expect(out.referenceId).toBe(into.referenceId)
    expect([out.quantity, into.quantity].sort((a, b) => a - b)).toEqual([-8, 8])
    expect(await onHand(item.id, mainWarehouse.id)).toBe(12)
    expect(await onHand(item.id, backWarehouse.id)).toBe(8)
    expect(await currentStock(item.id)).toBe(20)
    expect(eventNames()).not.toContain('inventory.item.reorder_level_reached')
    expect(eventNames()).not.toContain('inventory.stock.depleted')
    await expectLedgerConsistent(authA.tenantId)
  })

  it('refuses a transfer larger than the source stock and leaves both warehouses unchanged', async () => {
    const item = await newItem(authA)
    await stockIn(authA, item.id, mainWarehouse.id, 5)
    await expect(
      recordMovement(authA, nextKey(), { type: 'TRANSFER', itemId: item.id, fromWarehouseId: mainWarehouse.id, toWarehouseId: backWarehouse.id, quantity: 6, note: null })
    ).rejects.toMatchObject({ code: 'insufficient_stock' })
    expect(await onHand(item.id, mainWarehouse.id)).toBe(5)
    expect(await onHand(item.id, backWarehouse.id)).toBe(0)
    expect(await countMovements(item.id)).toBe(1)
  })

  it('replays a movement with the same Idempotency-Key exactly once', async () => {
    const item = await newItem(authA)
    const key = nextKey()
    const body = { type: 'IN' as const, itemId: item.id, warehouseId: mainWarehouse.id, quantity: 9, note: null }
    const first = await recordMovement(authA, key, body)
    const second = await recordMovement(authA, key, body)
    expect(second.replayed).toBe(true)
    expect(second.body.data.movements[0].id).toBe(first.body.data.movements[0].id)
    expect(await currentStock(item.id)).toBe(9)
    await expect(recordMovement(authA, key, { ...body, quantity: 10 })).rejects.toMatchObject({ code: 'idempotency_key_reused' })
  })

  it('lets only one of two competing withdrawals succeed', async () => {
    const item = await newItem(authA)
    await stockIn(authA, item.id, mainWarehouse.id, 4)
    const results = await Promise.allSettled([stockOut(authA, item.id, mainWarehouse.id, 3), stockOut(authA, item.id, mainWarehouse.id, 3)])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(await currentStock(item.id)).toBe(1)
    await expectLedgerConsistent(authA.tenantId)
  })

  it('rejects unknown ids and ids from another tenant', async () => {
    const item = await newItem(authA)
    const foreignWarehouse = await newWarehouse(authB)
    await expect(stockIn(authA, '99999999-9999-4999-8999-999999999999', mainWarehouse.id, 1)).rejects.toMatchObject({ code: 'item_not_found' })
    await expect(stockIn(authA, item.id, '99999999-9999-4999-8999-999999999999', 1)).rejects.toMatchObject({ code: 'warehouse_not_found' })
    await expect(stockIn(authA, item.id, foreignWarehouse.id, 1)).rejects.toMatchObject({ code: 'warehouse_not_found' })
    await expect(stockIn(authB, item.id, foreignWarehouse.id, 1)).rejects.toMatchObject({ code: 'item_not_found' })
  })

  it('does not let an inactive item or warehouse receive stock, but lets it be emptied', async () => {
    const item = await newItem(authA)
    const retiring = await newWarehouse(authA)
    await stockIn(authA, item.id, retiring.id, 10)
    await updateWarehouse(authA, retiring.id, { version: 1, name: retiring.name, location: null, capacity: null, status: 'inactive' })
    await expect(stockIn(authA, item.id, retiring.id, 1)).rejects.toMatchObject({ code: 'warehouse_inactive' })
    await expect(
      recordMovement(authA, nextKey(), { type: 'TRANSFER', itemId: item.id, fromWarehouseId: mainWarehouse.id, toWarehouseId: retiring.id, quantity: 1, note: null })
    ).rejects.toMatchObject({ code: 'warehouse_inactive' })
    await expect(
      recordMovement(authA, nextKey(), { type: 'TRANSFER', itemId: item.id, fromWarehouseId: retiring.id, toWarehouseId: mainWarehouse.id, quantity: 10, note: null })
    ).resolves.toMatchObject({ status: 201 })
    expect(await onHand(item.id, retiring.id)).toBe(0)

    const dormant = await newItem(authA)
    await stockIn(authA, dormant.id, mainWarehouse.id, 2)
    await updateItem(authA, dormant.id, { version: 1, name: dormant.name, unitCostMinor: 1, sellingPriceMinor: 1, reorderLevel: 0, isActive: false })
    await expect(stockIn(authA, dormant.id, mainWarehouse.id, 1)).rejects.toMatchObject({ code: 'item_inactive' })
    await expect(stockOut(authA, dormant.id, mainWarehouse.id, 2)).resolves.toMatchObject({ status: 201 })
  })
})

describe('database guards', () => {
  it('accepts a purchase receipt reference only with the receipt id, and keeps it append-only', async () => {
    const item = await newItem(authA)
    const insert = (referenceId: string | null) =>
      getPglite().query<{ id: string }>(
        `insert into stock_movements (tenant_id, item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, created_by)
         values ($1, $2, $3, 'IN', 4, 'purchase_receipt', $4, $5) returning id`,
        [authA.tenantId, item.id, mainWarehouse.id, referenceId, authA.userId]
      )
    await expect(insert(null)).rejects.toThrow()
    const inserted = await insert('55555555-5555-4555-8555-555555555555')
    expect(await currentStock(item.id)).toBe(4)
    await expect(getPglite().query('update stock_movements set quantity = 9 where id = $1', [inserted.rows[0].id])).rejects.toThrow()
  })
  it('accepts a purchase return reference only with the return id, and a return never takes a balance below zero', async () => {
    const item = await newItem(authA)
    await stockIn(authA, item.id, mainWarehouse.id, 5)
    const insert = (quantity: number, referenceId: string | null) =>
      getPglite().query<{ id: string }>(
        `insert into stock_movements (tenant_id, item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, created_by)
         values ($1, $2, $3, 'OUT', $4, 'purchase_return', $5, $6) returning id`,
        [authA.tenantId, item.id, mainWarehouse.id, quantity, referenceId, authA.userId]
      )
    await expect(insert(-2, null)).rejects.toThrow()
    const inserted = await insert(-2, '66666666-6666-4666-8666-666666666666')
    expect(await currentStock(item.id)).toBe(3)
    await expect(insert(-4, '77777777-7777-4777-8777-777777777777')).rejects.toThrow()
    expect(await currentStock(item.id)).toBe(3)
    await expect(getPglite().query('update stock_movements set quantity = -1 where id = $1', [inserted.rows[0].id])).rejects.toThrow()
    await expect(getPglite().query('delete from stock_movements where id = $1', [inserted.rows[0].id])).rejects.toThrow()
  })

  it('keeps the ledger append-only', async () => {
    const item = await newItem(authA)
    const moved = (await stockIn(authA, item.id, mainWarehouse.id, 3)).body.data.movements[0]
    await expect(getPglite().query('update stock_movements set quantity = 99 where id = $1', [moved.id])).rejects.toThrow()
    await expect(getPglite().query('delete from stock_movements where id = $1', [moved.id])).rejects.toThrow()
    await expect(getPglite().query('delete from stock_balances where item_id = $1', [item.id])).rejects.toThrow()
  })

  it('refuses a ledger row that would take a balance below zero, even when written directly', async () => {
    const item = await newItem(authA)
    await expect(
      getPglite().query(
        "insert into stock_movements (tenant_id, item_id, warehouse_id, movement_type, quantity, created_by) values ($1, $2, $3, 'OUT', -1, $4)",
        [authA.tenantId, item.id, mainWarehouse.id, authA.userId]
      )
    ).rejects.toThrow()
    expect(await currentStock(item.id)).toBe(0)
  })

  it('refuses rows with the wrong sign, a zero quantity or a missing reference', async () => {
    const item = await newItem(authA)
    const insert = (type: string, quantity: number, referenceType = 'manual', referenceId: string | null = null) =>
      getPglite().query(
        `insert into stock_movements (tenant_id, item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [authA.tenantId, item.id, mainWarehouse.id, type, quantity, referenceType, referenceId, authA.userId]
      )
    await expect(insert('IN', -5)).rejects.toThrow()
    await expect(insert('OUT', 5)).rejects.toThrow()
    await expect(insert('IN', 0)).rejects.toThrow()
    await expect(insert('IN', 5, 'invoice', null)).rejects.toThrow()
    await expect(insert('IN', 5, 'manual', '99999999-9999-4999-8999-999999999999')).rejects.toThrow()
    await expect(insert('TRANSFER', 5, 'manual')).rejects.toThrow()
    await expect(insert('IN', 1_000_001)).rejects.toThrow()
  })

  it('refuses an item or warehouse from another tenant', async () => {
    const foreignItem = await newItem(authB)
    await expect(
      getPglite().query(
        "insert into stock_movements (tenant_id, item_id, warehouse_id, movement_type, quantity, created_by) values ($1, $2, $3, 'IN', 1, $4)",
        [authA.tenantId, foreignItem.id, mainWarehouse.id, authA.userId]
      )
    ).rejects.toThrow()
  })

  it('writes one movement per invoice, item, warehouse and direction', async () => {
    const item = await newItem(authA)
    await stockIn(authA, item.id, mainWarehouse.id, 10)
    const reference = '88888888-8888-4888-8888-888888888888'
    const insert = () =>
      getPglite().query(
        `insert into stock_movements (tenant_id, item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, created_by)
         values ($1, $2, $3, 'OUT', -1, 'invoice', $4, $5)`,
        [authA.tenantId, item.id, mainWarehouse.id, reference, authA.userId]
      )
    await insert()
    await expect(insert()).rejects.toThrow()
    expect(await currentStock(item.id)).toBe(9)
  })
})

describe('purchase receipts and returns through the public API', () => {
  const run = async <T,>(work: (tx: Parameters<typeof receivePurchaseWithin>[0], events: InventoryEvent[]) => Promise<T>): Promise<{ result: T; events: InventoryEvent[] }> => {
    const { withTransaction } = await import('@/lib/db')
    const collected: InventoryEvent[] = []
    const result = await withTransaction((tx) => work(tx, collected))
    return { result, events: collected }
  }

  it('receives goods in, then takes returned goods out, each movement referenced to its document', async () => {
    const item = await newItem(authA)
    const receiptId = '88888888-8888-4888-8888-888888888888'
    const returnId = '99999999-9999-4999-8999-999999999999'
    const received = await run((tx, collected) =>
      receivePurchaseWithin(tx, authA, { warehouseId: mainWarehouse.id, receiptId, lines: [{ itemId: item.id, quantity: 6 }], note: null }, collected)
    )
    expect(received.result.map((movement) => [movement.movementType, movement.quantity, movement.referenceType, movement.referenceId])).toEqual([['IN', 6, 'purchase_receipt', receiptId]])
    const returned = await run((tx, collected) =>
      returnPurchaseWithin(tx, authA, { warehouseId: mainWarehouse.id, returnId, lines: [{ itemId: item.id, quantity: 4 }], note: 'Damaged' }, collected)
    )
    expect(returned.result.map((movement) => [movement.movementType, movement.quantity, movement.referenceType, movement.referenceId, movement.note])).toEqual([
      ['OUT', -4, 'purchase_return', returnId, 'Damaged'],
    ])
    expect(returned.events.length).toBeGreaterThan(0)
    expect(await currentStock(item.id)).toBe(2)
    await expectLedgerConsistent(authA.tenantId)
  })

  it('stops a whole return when one line is short: no stock moves, no row is kept', async () => {
    const enough = await newItem(authA)
    const short = await newItem(authA)
    await stockIn(authA, enough.id, mainWarehouse.id, 5)
    await stockIn(authA, short.id, mainWarehouse.id, 1)
    const before = (await getPglite().query<{ n: number }>('select count(*)::int as n from stock_movements where tenant_id = $1', [authA.tenantId])).rows[0].n
    await expect(
      run((tx, collected) =>
        returnPurchaseWithin(
          tx,
          authA,
          { warehouseId: mainWarehouse.id, returnId: 'aaaaaaaa-0000-4000-8000-000000000001', lines: [{ itemId: enough.id, quantity: 5 }, { itemId: short.id, quantity: 2 }], note: null },
          collected
        )
      )
    ).rejects.toMatchObject({ code: 'insufficient_stock' })
    expect(await currentStock(enough.id)).toBe(5)
    expect(await currentStock(short.id)).toBe(1)
    expect((await getPglite().query<{ n: number }>('select count(*)::int as n from stock_movements where tenant_id = $1', [authA.tenantId])).rows[0].n).toBe(before)
  })

  it('lets an inactive item or warehouse lose stock through a return, but not receive it', async () => {
    const item = await newItem(authA)
    const warehouse = await newWarehouse(authA)
    await run((tx, collected) =>
      receivePurchaseWithin(tx, authA, { warehouseId: warehouse.id, receiptId: 'bbbbbbbb-0000-4000-8000-000000000001', lines: [{ itemId: item.id, quantity: 3 }], note: null }, collected)
    )
    await updateWarehouse(authA, warehouse.id, { version: 1, name: warehouse.name, location: null, capacity: null, status: 'inactive' })
    await expect(
      run((tx, collected) =>
        receivePurchaseWithin(tx, authA, { warehouseId: warehouse.id, receiptId: 'bbbbbbbb-0000-4000-8000-000000000002', lines: [{ itemId: item.id, quantity: 1 }], note: null }, collected)
      )
    ).rejects.toMatchObject({ code: 'warehouse_inactive' })
    await run((tx, collected) =>
      returnPurchaseWithin(tx, authA, { warehouseId: warehouse.id, returnId: 'bbbbbbbb-0000-4000-8000-000000000003', lines: [{ itemId: item.id, quantity: 3 }], note: null }, collected)
    )
    expect(await onHand(item.id, warehouse.id)).toBe(0)
  })

  it('refuses a return of zero, a fraction, a negative or more than a movement may carry', async () => {
    const item = await newItem(authA)
    await stockIn(authA, item.id, mainWarehouse.id, 5)
    for (const quantity of [0, -1, 1.5, 1_000_001]) {
      await expect(
        run((tx, collected) =>
          returnPurchaseWithin(tx, authA, { warehouseId: mainWarehouse.id, returnId: 'cccccccc-0000-4000-8000-000000000001', lines: [{ itemId: item.id, quantity }], note: null }, collected)
        )
      ).rejects.toBeDefined()
    }
    expect(await currentStock(item.id)).toBe(5)
  })

  it('does not see or move another company stock', async () => {
    const item = await newItem(authA)
    await stockIn(authA, item.id, mainWarehouse.id, 5)
    await expect(
      run((tx, collected) =>
        returnPurchaseWithin(tx, authB, { warehouseId: mainWarehouse.id, returnId: 'dddddddd-0000-4000-8000-000000000001', lines: [{ itemId: item.id, quantity: 1 }], note: null }, collected)
      )
    ).rejects.toBeDefined()
    expect(await currentStock(item.id)).toBe(5)
  })
})

describe('invoices take and return stock', () => {
  it('rejects draft lines that point at an unknown or inactive item or warehouse', async () => {
    const item = await newItem(authA)
    await expect(invoiceFor(authA, [{ itemId: '99999999-9999-4999-8999-999999999999', warehouseId: mainWarehouse.id, quantity: 1 }])).rejects.toMatchObject({
      code: 'item_not_found',
    })
    await expect(invoiceFor(authA, [{ itemId: item.id, warehouseId: '99999999-9999-4999-8999-999999999999', quantity: 1 }])).rejects.toMatchObject({
      code: 'warehouse_not_found',
    })
    const dormantWarehouse = await newWarehouse(authA, { status: 'inactive' })
    await expect(invoiceFor(authA, [{ itemId: item.id, warehouseId: dormantWarehouse.id, quantity: 1 }])).rejects.toMatchObject({ code: 'warehouse_inactive' })
    const foreign = await newItem(authB)
    await expect(invoiceFor(authA, [{ itemId: foreign.id, warehouseId: mainWarehouse.id, quantity: 1 }])).rejects.toMatchObject({ code: 'item_not_found' })
  })

  it('takes no stock while the invoice is a draft', async () => {
    const item = await newItem(authA)
    await stockIn(authA, item.id, mainWarehouse.id, 10)
    await invoiceFor(authA, [{ itemId: item.id, warehouseId: mainWarehouse.id, quantity: 4 }])
    expect(await currentStock(item.id)).toBe(10)
  })

  it('takes stock when submit issues the invoice, and totals lines for the same item', async () => {
    events.length = 0
    const item = await newItem(authA, { reorderLevel: 0 })
    await stockIn(authA, item.id, mainWarehouse.id, 10)
    await stockIn(authA, item.id, backWarehouse.id, 5)
    const draft = await invoiceFor(authA, [
      { itemId: item.id, warehouseId: mainWarehouse.id, quantity: 2 },
      { itemId: item.id, warehouseId: mainWarehouse.id, quantity: 3 },
      { itemId: item.id, warehouseId: backWarehouse.id, quantity: 1 },
    ])
    const issued = (await submitInvoice(authA, draft.id, { version: draft.version })).data
    expect(issued.status).toBe('issued')
    expect(await onHand(item.id, mainWarehouse.id)).toBe(5)
    expect(await onHand(item.id, backWarehouse.id)).toBe(4)
    const rows = await getPglite().query<{ warehouse_id: string; quantity: number; movement_type: string; note: string }>(
      "select warehouse_id, quantity, movement_type, note from stock_movements where reference_type = 'invoice' and reference_id = $1 order by quantity",
      [draft.id]
    )
    expect(rows.rows).toHaveLength(2)
    expect(rows.rows.map((row) => row.quantity)).toEqual([-5, -1])
    expect(rows.rows.every((row) => row.movement_type === 'OUT' && row.note === draft.number)).toBe(true)
    expect(eventNames()).toContain('inventory.stock.moved')
    await expectLedgerConsistent(authA.tenantId)
  })

  it('leaves service lines alone', async () => {
    const draft = (
      await createInvoice(authA, nextKey(), {
        customerId: customerA,
        issueDate: day(-1),
        dueDate: day(29),
        notes: null,
        lines: [{ description: 'Delivery', quantity: 1, unitPriceMinor: 3_000, taxRateBps: 0, itemId: null, warehouseId: null }],
      })
    ).body.data
    await expect(submitInvoice(authA, draft.id, { version: draft.version })).resolves.toMatchObject({ data: { status: 'issued' } })
  })

  it('blocks the submit when stock is short, rolls everything back and leaves the invoice a draft', async () => {
    const enough = await newItem(authA)
    const scarce = await newItem(authA)
    await stockIn(authA, enough.id, mainWarehouse.id, 10)
    await stockIn(authA, scarce.id, mainWarehouse.id, 2)
    const draft = await invoiceFor(authA, [
      { itemId: enough.id, warehouseId: mainWarehouse.id, quantity: 5 },
      { itemId: scarce.id, warehouseId: mainWarehouse.id, quantity: 3 },
    ])
    await expect(submitInvoice(authA, draft.id, { version: draft.version })).rejects.toMatchObject({ code: 'insufficient_stock' })
    const after = (await getInvoice(authA, draft.id)).data
    expect(after).toMatchObject({ status: 'draft', version: draft.version })
    expect(await currentStock(enough.id)).toBe(10)
    expect(await currentStock(scarce.id)).toBe(2)
    expect(await countMovements(enough.id)).toBe(1)
  })

  it('takes stock only when an invoice above the threshold is approved', async () => {
    const item = await newItem(authA)
    await stockIn(authA, item.id, mainWarehouse.id, 10)
    const draft = await invoiceFor(authA, [{ itemId: item.id, warehouseId: mainWarehouse.id, quantity: 4, unitPriceMinor: 6_000_000 }])
    const pending = (await submitInvoice(authA, draft.id, { version: draft.version })).data
    expect(pending.status).toBe('pending_approval')
    expect(await currentStock(item.id)).toBe(10)
    const issued = (await approveInvoice(authA, draft.id, { version: pending.version })).data
    expect(issued.status).toBe('issued')
    expect(await currentStock(item.id)).toBe(6)
  })

  it('blocks approval when stock vanished meanwhile and keeps the invoice pending', async () => {
    const item = await newItem(authA)
    await stockIn(authA, item.id, mainWarehouse.id, 5)
    const draft = await invoiceFor(authA, [{ itemId: item.id, warehouseId: mainWarehouse.id, quantity: 5, unitPriceMinor: 2_000_000 }])
    const pending = (await submitInvoice(authA, draft.id, { version: draft.version })).data
    expect(pending.status).toBe('pending_approval')
    await stockOut(authA, item.id, mainWarehouse.id, 3)
    await expect(approveInvoice(authA, draft.id, { version: pending.version })).rejects.toMatchObject({ code: 'insufficient_stock' })
    expect((await getInvoice(authA, draft.id)).data.status).toBe('pending_approval')
    expect(await currentStock(item.id)).toBe(2)
  })

  it('puts the stock back when an issued, unpaid invoice is voided, and does so only once', async () => {
    const item = await newItem(authA, { reorderLevel: 0 })
    await stockIn(authA, item.id, mainWarehouse.id, 10)
    const draft = await invoiceFor(authA, [{ itemId: item.id, warehouseId: mainWarehouse.id, quantity: 7 }])
    const issued = (await submitInvoice(authA, draft.id, { version: draft.version })).data
    expect(await currentStock(item.id)).toBe(3)
    const voided = (await voidInvoice(authA, draft.id, { version: issued.version, reason: 'Wrong customer' })).data
    expect(voided.status).toBe('void')
    expect(await currentStock(item.id)).toBe(10)
    const rows = await getPglite().query<{ movement_type: string; quantity: number }>(
      "select movement_type, quantity from stock_movements where reference_type = 'invoice' and reference_id = $1 order by quantity",
      [draft.id]
    )
    expect(rows.rows).toEqual([
      { movement_type: 'OUT', quantity: -7 },
      { movement_type: 'IN', quantity: 7 },
    ])
    await expectLedgerConsistent(authA.tenantId)
  })

  it('restores stock even when the item has been deactivated since', async () => {
    const item = await newItem(authA, { reorderLevel: 0 })
    await stockIn(authA, item.id, mainWarehouse.id, 6)
    const draft = await invoiceFor(authA, [{ itemId: item.id, warehouseId: mainWarehouse.id, quantity: 6 }])
    const issued = (await submitInvoice(authA, draft.id, { version: draft.version })).data
    await updateItem(authA, item.id, { version: 1, name: item.name, unitCostMinor: 1, sellingPriceMinor: 1, reorderLevel: 0, isActive: false })
    await voidInvoice(authA, draft.id, { version: issued.version, reason: 'Cancelled' })
    expect(await currentStock(item.id)).toBe(6)
  })

  it('voids a draft or pending invoice without touching stock', async () => {
    const item = await newItem(authA)
    await stockIn(authA, item.id, mainWarehouse.id, 10)
    const draft = await invoiceFor(authA, [{ itemId: item.id, warehouseId: mainWarehouse.id, quantity: 2 }])
    await voidInvoice(authA, draft.id, { version: draft.version, reason: 'Not needed' })
    const big = await invoiceFor(authA, [{ itemId: item.id, warehouseId: mainWarehouse.id, quantity: 2, unitPriceMinor: 6_000_000 }])
    const pending = (await submitInvoice(authA, big.id, { version: big.version })).data
    await voidInvoice(authA, big.id, { version: pending.version, reason: 'Not needed' })
    expect(await currentStock(item.id)).toBe(10)
    expect(await countMovements(item.id)).toBe(1)
  })

  it('keeps the stock out when a paid invoice cannot be voided', async () => {
    const item = await newItem(authA)
    await stockIn(authA, item.id, mainWarehouse.id, 10)
    const draft = await invoiceFor(authA, [{ itemId: item.id, warehouseId: mainWarehouse.id, quantity: 4 }])
    const issued = (await submitInvoice(authA, draft.id, { version: draft.version })).data
    const paid = await recordPayment(authA, draft.id, nextKey(), {
      version: issued.version,
      amountMinor: 1_000,
      currency: 'KWD',
      method: 'cash',
      paidAt: new Date().toISOString(),
      reference: null,
    })
    await expect(voidInvoice(authA, draft.id, { version: paid.body.data.invoice.version, reason: 'Too late' })).rejects.toMatchObject({ code: 'cannot_void' })
    expect(await currentStock(item.id)).toBe(6)
  })
})

describe('reading stock', () => {
  it('pages items by name, stock and price without repeating or skipping, and filters by search text', async () => {
    const created: Item[] = []
    for (const [index, name] of ['Paged apple', 'Paged banana', 'Paged cherry', 'Paged date', 'Paged elder', 'Paged fig', 'Paged grape'].entries()) {
      const item = await newItem(authC, { name, sellingPriceMinor: (index % 3) * 100, reorderLevel: 0 })
      created.push(item)
      if (index % 2 === 0) await stockIn(authC, item.id, (await ensureWarehouse(authC)).id, index + 1)
    }
    for (const sort of ['name', 'sku', 'currentStock', 'sellingPriceMinor'] as const) {
      for (const direction of ['asc', 'desc'] as const) {
        const ids: string[] = []
        let cursor: string | undefined
        for (let guard = 0; guard < 20; guard += 1) {
          const page = await listItems(authC, listItemsQuerySchema.parse({ q: 'Paged', limit: '3', sort, direction, ...(cursor ? { cursor } : {}) }))
          ids.push(...page.data.map((item) => item.id))
          if (!page.nextCursor) break
          cursor = page.nextCursor
        }
        expect(ids).toHaveLength(created.length)
        expect(new Set(ids).size).toBe(created.length)
      }
    }
    const byName = await listItems(authC, listItemsQuerySchema.parse({ q: 'Paged', limit: '100', sort: 'name', direction: 'desc' }))
    expect(byName.data.map((item) => item.name)).toEqual([...created.map((item) => item.name)].reverse())
    expect((await listItems(authC, listItemsQuerySchema.parse({ q: created[0].sku.toLowerCase() }))).data.map((item) => item.id)).toEqual([created[0].id])
  })

  it('treats % and _ in the search text literally', async () => {
    const special = await newItem(authC, { name: 'Discount 50% off' })
    await newItem(authC, { name: 'Discount 50 off' })
    const found = await listItems(authC, listItemsQuerySchema.parse({ q: '50%' }))
    expect(found.data.map((item) => item.id)).toEqual([special.id])
    const underscore = await listItems(authC, listItemsQuerySchema.parse({ q: 'Discount_50' }))
    expect(underscore.data).toHaveLength(0)
  })

  it('filters by status and low stock', async () => {
    const low = await newItem(authC, { name: 'Filter low', reorderLevel: 5 })
    const fine = await newItem(authC, { name: 'Filter fine', reorderLevel: 1 })
    const warehouse = await ensureWarehouse(authC)
    await stockIn(authC, low.id, warehouse.id, 5)
    await stockIn(authC, fine.id, warehouse.id, 50)
    const lowOnly = await listItems(authC, listItemsQuerySchema.parse({ q: 'Filter', lowStock: 'true' }))
    expect(lowOnly.data.map((item) => item.id)).toEqual([low.id])
    await updateItem(authC, fine.id, { version: 1, name: fine.name, unitCostMinor: 1, sellingPriceMinor: 1, reorderLevel: 1, isActive: false })
    expect((await listItems(authC, listItemsQuerySchema.parse({ q: 'Filter' }))).data.map((item) => item.id)).toEqual([low.id])
    expect((await listItems(authC, listItemsQuerySchema.parse({ q: 'Filter', status: 'inactive' }))).data.map((item) => item.id)).toEqual([fine.id])
    expect((await listItems(authC, listItemsQuerySchema.parse({ q: 'Filter', status: 'all' }))).data).toHaveLength(2)
  })

  it('lists movements newest first with item, warehouse and type filters, and pages through them', async () => {
    const item = await newItem(authA, { reorderLevel: 0 })
    await stockIn(authA, item.id, mainWarehouse.id, 20)
    await stockIn(authA, item.id, backWarehouse.id, 10)
    await stockOut(authA, item.id, mainWarehouse.id, 3)
    await recordMovement(authA, nextKey(), { type: 'TRANSFER', itemId: item.id, fromWarehouseId: mainWarehouse.id, toWarehouseId: backWarehouse.id, quantity: 2, note: null })

    const all = await listMovements(authA, listMovementsQuerySchema.parse({ itemId: item.id, limit: '100' }))
    expect(all.data).toHaveLength(5)
    const times = all.data.map((movement) => movement.createdAt)
    expect(times).toEqual([...times].sort().reverse())
    expect((await listMovements(authA, listMovementsQuerySchema.parse({ itemId: item.id, type: 'OUT' }))).data).toHaveLength(1)
    expect((await listMovements(authA, listMovementsQuerySchema.parse({ itemId: item.id, type: 'TRANSFER' }))).data).toHaveLength(2)
    expect((await listMovements(authA, listMovementsQuerySchema.parse({ itemId: item.id, warehouseId: backWarehouse.id }))).data).toHaveLength(2)

    const seen: string[] = []
    let cursor: string | undefined
    for (let guard = 0; guard < 20; guard += 1) {
      const page = await listMovements(authA, listMovementsQuerySchema.parse({ itemId: item.id, limit: '2', ...(cursor ? { cursor } : {}) }))
      seen.push(...page.data.map((movement) => movement.id))
      if (!page.nextCursor) break
      cursor = page.nextCursor
    }
    expect(seen).toEqual(all.data.map((movement) => movement.id))
  })

  it('lists balances per item and warehouse and shows them in the item detail', async () => {
    const item = await newItem(authA, { reorderLevel: 0 })
    await stockIn(authA, item.id, mainWarehouse.id, 7)
    await stockIn(authA, item.id, backWarehouse.id, 3)
    const balances = await listBalances(authA, listBalancesQuerySchema.parse({ itemId: item.id, sort: 'onHand', direction: 'desc' }))
    expect(balances.data.map((balance) => [balance.warehouseCode, balance.onHand])).toEqual([
      ['MAIN', 7],
      ['BACK', 3],
    ])
    const detail = (await getItem(authA, item.id)).data
    expect(detail.balances).toHaveLength(2)
    expect(detail.movements).toHaveLength(2)
    expect(detail.currentStock).toBe(10)
  })

  it('never shows one tenant another tenant\'s stock', async () => {
    const mine = await newItem(authB, { name: 'Tenant B only' })
    const visibleToA = await listItems(authA, listItemsQuerySchema.parse({ q: 'Tenant B only', status: 'all' }))
    expect(visibleToA.data).toHaveLength(0)
    const visibleToB = await listItems(authB, listItemsQuerySchema.parse({ q: 'Tenant B only', status: 'all' }))
    expect(visibleToB.data.map((item) => item.id)).toEqual([mine.id])
    const movementsForA = await listMovements(authA, listMovementsQuerySchema.parse({ itemId: mine.id }))
    expect(movementsForA.data).toHaveLength(0)
  })
})

let sharedWarehouseC: Warehouse | null = null
async function ensureWarehouse(auth: AuthContext): Promise<Warehouse> {
  if (!sharedWarehouseC) sharedWarehouseC = await newWarehouse(auth, { code: 'SHARED', name: 'Shared' })
  return sharedWarehouseC
}

describe('summary', () => {
  it('values stock at quantity x unit cost and lists low stock and fast movers', async () => {
    // A fresh tenant, so every number below is known exactly.
    const owner = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    await createUser(owner)
    const tenant = await bootstrapTenant('Tenant D', 'tenant-d', owner)
    const auth: AuthContext = { userId: owner, tenantId: tenant, permissions: new Set<string>() }
    const warehouse = await newWarehouse(auth, { code: 'ONE', name: 'One', capacity: 200 })

    const a = await newItem(auth, { name: 'Alpha', unitCostMinor: 1_000, reorderLevel: 5 })
    const b = await newItem(auth, { name: 'Bravo', unitCostMinor: 250, reorderLevel: 4 })
    const c = await newItem(auth, { name: 'Charlie', unitCostMinor: 5_000, reorderLevel: 0 })
    const d = await newItem(auth, { name: 'Delta', unitCostMinor: 10, reorderLevel: 0 })

    await stockIn(auth, a.id, warehouse.id, 16)
    await stockOut(auth, a.id, warehouse.id, 6)
    await stockIn(auth, b.id, warehouse.id, 8)
    await stockOut(auth, b.id, warehouse.id, 1)
    await stockIn(auth, d.id, warehouse.id, 100)
    await updateItem(auth, d.id, { version: 1, name: d.name, unitCostMinor: 10, sellingPriceMinor: 1, reorderLevel: 0, isActive: false })
    // An old withdrawal, written directly so it falls outside a 30 day window.
    await getPglite().query(
      "insert into stock_movements (tenant_id, item_id, warehouse_id, movement_type, quantity, created_by, created_at) values ($1, $2, $3, 'OUT', -3, $4, now() - interval '60 days')",
      [tenant, b.id, warehouse.id, owner]
    )

    const summary = (await getSummary(auth, summaryQuerySchema.parse({}))).data
    // Alpha 10 x 1,000 + Bravo 4 x 250 + Charlie 0 + Delta 100 x 10
    expect(summary.valuationMinor).toBe(12_000)
    expect(summary.currency).toBe('KWD')
    expect(summary.itemCount).toBe(4)
    expect(summary.activeItemCount).toBe(3)
    expect(summary.lowStockCount).toBe(2)
    expect(summary.outOfStockCount).toBe(1)
    expect(summary.lowStock.map((item) => item.name)).toEqual(['Charlie', 'Bravo'])
    expect(summary.windowDays).toBe(30)
    expect(summary.fastMoving.map((item) => [item.name, item.outQuantity])).toEqual([
      ['Alpha', 6],
      ['Bravo', 1],
    ])
    expect(summary.warehouses).toHaveLength(1)
    expect(summary.warehouses[0]).toMatchObject({ code: 'ONE', unitsStored: 114, capacity: 200 })

    const wider = (await getSummary(auth, summaryQuerySchema.parse({ days: '90' }))).data
    expect(wider.fastMoving.map((item) => [item.name, item.outQuantity])).toEqual([
      ['Alpha', 6],
      ['Bravo', 4],
    ])
  })

  it('is zero for a tenant with no stock', async () => {
    const owner = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    await createUser(owner)
    const tenant = await bootstrapTenant('Tenant E', 'tenant-e', owner)
    const summary = (await getSummary({ userId: owner, tenantId: tenant, permissions: new Set<string>() }, summaryQuerySchema.parse({}))).data
    expect(summary).toMatchObject({ valuationMinor: 0, itemCount: 0, lowStockCount: 0, outOfStockCount: 0, lowStock: [], fastMoving: [], warehouses: [] })
  })
})
