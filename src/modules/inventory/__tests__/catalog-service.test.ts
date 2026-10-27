import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  bootstrapTenant,
  createUser,
  getPglite,
  startDatabase,
  stopDatabase,
} from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'
import { DomainError } from '@/lib/domain-error'
import { subscribe, type BusEvent } from '@/lib/events/bus'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

import { withTransaction } from '@/lib/db'
import {
  createItem,
  createWarehouse,
  findItemWithin,
  getItem,
  getWarehouse,
  listItems,
  listWarehouses,
  recordMovement,
  setSellingPriceWithin,
  updateItem,
  updateWarehouse,
  type InventoryEvent,
  type Item,
  type Warehouse,
} from '@/modules/inventory'
import {
  createItemSchema,
  createWarehouseSchema,
  listItemsQuerySchema,
  listWarehousesQuerySchema,
  type CreateItemInput,
  type CreateWarehouseInput,
  type UpdateItemInput,
} from '@/modules/inventory/schemas/inventory'

const USER_A = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
const USER_B = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'
const MISSING_ID = '99999999-9999-4999-8999-999999999999'

let authA: AuthContext
let authB: AuthContext
const events: BusEvent[] = []
const unsubscribers: Array<() => void> = []

let keyCounter = 0
const nextKey = () => `cat-key-${String(++keyCounter).padStart(8, '0')}`
let skuCounter = 0
let codeCounter = 0

function itemInput(overrides: Partial<CreateItemInput> = {}): CreateItemInput {
  skuCounter += 1
  return {
    sku: `CAT-${skuCounter}`,
    name: `Catalog item ${skuCounter}`,
    unit: 'piece',
    unitCostMinor: 1_000,
    sellingPriceMinor: 2_000,
    reorderLevel: 5,
    isActive: true,
    ...overrides,
  }
}

function warehouseInput(overrides: Partial<CreateWarehouseInput> = {}): CreateWarehouseInput {
  codeCounter += 1
  return { code: `CW${codeCounter}`, name: `Catalog warehouse ${codeCounter}`, location: null, capacity: null, status: 'active', ...overrides }
}

function updateInput(item: Item, overrides: Partial<UpdateItemInput> = {}): UpdateItemInput {
  return {
    version: item.version,
    name: item.name,
    unitCostMinor: item.unitCostMinor,
    sellingPriceMinor: item.sellingPriceMinor,
    reorderLevel: item.reorderLevel,
    isActive: item.isActive,
    ...overrides,
  }
}

async function newItem(auth: AuthContext, overrides: Partial<CreateItemInput> = {}): Promise<Item> {
  return (await createItem(auth, nextKey(), itemInput(overrides))).body.data
}

async function newWarehouse(auth: AuthContext, overrides: Partial<CreateWarehouseInput> = {}): Promise<Warehouse> {
  return (await createWarehouse(auth, nextKey(), warehouseInput(overrides))).body.data
}

type AuditRow = { action: string; actor_id: string; tenant_id: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null }

async function auditRows(entity: string, entityId: string): Promise<AuditRow[]> {
  const result = await getPglite().query<AuditRow>(
    'select action, actor_id, tenant_id, before, after from audit_log where entity = $1 and entity_id = $2 order by created_at, id',
    [entity, entityId]
  )
  return result.rows
}

async function auditCount(tenantId: string, entity: string): Promise<number> {
  const result = await getPglite().query<{ count: number }>('select count(*)::int as count from audit_log where tenant_id = $1 and entity = $2', [tenantId, entity])
  return result.rows[0].count
}

async function stockState(itemId: string): Promise<{ currentStock: number; balanceSum: number; movements: number }> {
  const pg = getPglite()
  const item = await pg.query<{ current_stock: number }>('select current_stock from items where id = $1', [itemId])
  const balances = await pg.query<{ total: number }>('select coalesce(sum(on_hand), 0)::int as total from stock_balances where item_id = $1', [itemId])
  const movements = await pg.query<{ count: number }>('select count(*)::int as count from stock_movements where item_id = $1', [itemId])
  return { currentStock: item.rows[0].current_stock, balanceSum: balances.rows[0].total, movements: movements.rows[0].count }
}

function eventsNamed(name: string): BusEvent[] {
  return events.filter((event) => event.name === name)
}

beforeAll(async () => {
  await startDatabase()
  await createUser(USER_A)
  await createUser(USER_B)
  const tenantA = await bootstrapTenant('Catalog Tenant A', 'catalog-a', USER_A)
  const tenantB = await bootstrapTenant('Catalog Tenant B', 'catalog-b', USER_B)
  authA = { userId: USER_A, tenantId: tenantA, permissions: new Set<string>() }
  authB = { userId: USER_B, tenantId: tenantB, permissions: new Set<string>() }
  for (const name of ['inventory.item.created', 'inventory.item.updated', 'inventory.warehouse.created', 'inventory.warehouse.updated']) {
    unsubscribers.push(subscribe(name, (event) => void events.push(event)))
  }
}, 60_000)

afterAll(async () => {
  for (const unsubscribe of unsubscribers) unsubscribe()
  await stopDatabase()
})

describe('catalog service: items', () => {
  it('creates an item for the caller\'s tenant with zero stock, version 1, the actor and a create audit row', async () => {
    const item = await newItem(authA, { name: 'Olive oil 1L' })
    expect(item).toMatchObject({ name: 'Olive oil 1L', currentStock: 0, version: 1, isActive: true, currency: 'KWD', createdBy: USER_A })
    const rows = await getPglite().query<{ tenant_id: string }>('select tenant_id from items where id = $1', [item.id])
    expect(rows.rows[0].tenant_id).toBe(authA.tenantId)
    const audit = await auditRows('item', item.id)
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({ action: 'create', actor_id: USER_A, tenant_id: authA.tenantId, before: null })
    expect(audit[0].after).toMatchObject({ id: item.id, sku: item.sku, version: 1 })
  })

  it('stores the SKU the schema normalises (trimmed, upper case)', async () => {
    const input = createItemSchema.parse({
      sku: '  norm-sku.1 ',
      name: 'Normalised',
      unit: 'piece',
      unitCostMinor: 10,
      sellingPriceMinor: 20,
      reorderLevel: 0,
    })
    const created = (await createItem(authA, nextKey(), input)).body.data
    expect(created.sku).toBe('NORM-SKU.1')
    expect(created.isActive).toBe(true)
  })

  it('rejects a duplicate SKU in the same tenant with 409 sku_exists, writes no audit row and emits no event', async () => {
    const first = await newItem(authA)
    const auditBefore = await auditCount(authA.tenantId, 'item')
    const createdEventsBefore = eventsNamed('inventory.item.created').length
    await expect(createItem(authA, nextKey(), itemInput({ sku: first.sku }))).rejects.toMatchObject({ status: 409, code: 'sku_exists' })
    expect(await auditCount(authA.tenantId, 'item')).toBe(auditBefore)
    expect(eventsNamed('inventory.item.created')).toHaveLength(createdEventsBefore)
    const count = await getPglite().query<{ count: number }>('select count(*)::int as count from items where tenant_id = $1 and sku = $2', [authA.tenantId, first.sku])
    expect(count.rows[0].count).toBe(1)
  })

  it('allows the same SKU in another tenant', async () => {
    const mine = await newItem(authA)
    const theirs = (await createItem(authB, nextKey(), itemInput({ sku: mine.sku }))).body.data
    expect(theirs.id).not.toBe(mine.id)
    expect(theirs.sku).toBe(mine.sku)
  })

  it('publishes inventory.item.created once, after the commit, with the actor and tenant', async () => {
    const before = eventsNamed('inventory.item.created').length
    const item = await newItem(authA)
    const published = eventsNamed('inventory.item.created')
    expect(published).toHaveLength(before + 1)
    const event = published[published.length - 1]
    expect(event).toMatchObject({ version: 1, tenantId: authA.tenantId, payload: { itemId: item.id, sku: item.sku, createdBy: USER_A } })
  })

  it('replays the same Idempotency-Key without a second row, audit row or event, and refuses the key with another body', async () => {
    const key = nextKey()
    const input = itemInput()
    const first = await createItem(authA, key, input)
    const createdEvents = eventsNamed('inventory.item.created').length
    const second = await createItem(authA, key, input)
    expect(first.status).toBe(201)
    expect(first.replayed).toBe(false)
    expect(second).toMatchObject({ status: 201, replayed: true })
    expect(second.body.data.id).toBe(first.body.data.id)
    expect(await auditRows('item', first.body.data.id)).toHaveLength(1)
    expect(eventsNamed('inventory.item.created')).toHaveLength(createdEvents)
    await expect(createItem(authA, key, itemInput())).rejects.toMatchObject({ status: 422, code: 'idempotency_key_reused' })
  })

  it('scopes an Idempotency-Key to the tenant: the same key in another tenant creates its own item', async () => {
    const key = nextKey()
    const input = itemInput()
    const forA = await createItem(authA, key, input)
    const forB = await createItem(authB, key, input)
    expect(forB.replayed).toBe(false)
    expect(forB.body.data.id).not.toBe(forA.body.data.id)
  })

  it('updates the editable fields, bumps the version, keeps SKU, unit and stock, and audits before and after', async () => {
    const item = await newItem(authA, { name: 'Before', unitCostMinor: 100, sellingPriceMinor: 200, reorderLevel: 3 })
    const updated = (await updateItem(authA, item.id, updateInput(item, { name: 'After', unitCostMinor: 150, sellingPriceMinor: 250, reorderLevel: 9 }))).data
    expect(updated).toMatchObject({
      id: item.id,
      sku: item.sku,
      unit: item.unit,
      name: 'After',
      unitCostMinor: 150,
      sellingPriceMinor: 250,
      reorderLevel: 9,
      version: 2,
      currentStock: 0,
    })
    const audit = await auditRows('item', item.id)
    expect(audit.map((row) => row.action)).toEqual(['create', 'update'])
    expect(audit[1]).toMatchObject({ actor_id: USER_A, tenant_id: authA.tenantId })
    expect(audit[1].before).toMatchObject({ name: 'Before', version: 1, unitCostMinor: 100 })
    expect(audit[1].after).toMatchObject({ name: 'After', version: 2, unitCostMinor: 150 })
  })

  it('publishes inventory.item.updated only for a successful update', async () => {
    const item = await newItem(authA)
    const before = eventsNamed('inventory.item.updated').length
    await expect(updateItem(authA, item.id, updateInput(item, { version: 7 }))).rejects.toMatchObject({ code: 'version_conflict' })
    expect(eventsNamed('inventory.item.updated')).toHaveLength(before)
    await updateItem(authA, item.id, updateInput(item, { name: 'Renamed' }))
    const published = eventsNamed('inventory.item.updated')
    expect(published).toHaveLength(before + 1)
    expect(published[published.length - 1].payload).toMatchObject({ itemId: item.id, sku: item.sku, updatedBy: USER_A })
  })

  it('returns 409 version_conflict for a stale or future version and leaves the row and audit trail unchanged', async () => {
    const item = await newItem(authA)
    await updateItem(authA, item.id, updateInput(item, { name: 'Winner' }))
    await expect(updateItem(authA, item.id, updateInput(item, { name: 'Loser' }))).rejects.toMatchObject({ status: 409, code: 'version_conflict' })
    await expect(updateItem(authA, item.id, updateInput(item, { version: 99, name: 'Future' }))).rejects.toMatchObject({ status: 409, code: 'version_conflict' })
    const current = (await getItem(authA, item.id)).data
    expect(current).toMatchObject({ name: 'Winner', version: 2 })
    expect(await auditRows('item', item.id)).toHaveLength(2)
  })

  it('lets only one of two concurrent updates with the same version win', async () => {
    const item = await newItem(authA)
    const results = await Promise.allSettled([
      updateItem(authA, item.id, updateInput(item, { name: 'Racer one' })),
      updateItem(authA, item.id, updateInput(item, { name: 'Racer two' })),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason).toMatchObject({ status: 409, code: 'version_conflict' })
    expect((await getItem(authA, item.id)).data.version).toBe(2)
  })

  it('returns 404 item_not_found for an unknown id on read and update', async () => {
    await expect(getItem(authA, MISSING_ID)).rejects.toMatchObject({ status: 404, code: 'item_not_found' })
    await expect(
      updateItem(authA, MISSING_ID, { version: 1, name: 'x', unitCostMinor: 0, sellingPriceMinor: 0, reorderLevel: 0, isActive: true })
    ).rejects.toMatchObject({ status: 404, code: 'item_not_found' })
  })

  it('hides an item from another tenant on read and list, and refuses to update it without changing it', async () => {
    const item = await newItem(authA, { name: 'Tenant A secret item' })
    await expect(getItem(authB, item.id)).rejects.toMatchObject({ status: 404, code: 'item_not_found' })
    await expect(updateItem(authB, item.id, updateInput(item, { name: 'Hijacked' }))).rejects.toMatchObject({ status: 404, code: 'item_not_found' })
    const seenByB = await listItems(authB, listItemsQuerySchema.parse({ q: 'Tenant A secret item', status: 'all' }))
    expect(seenByB.data).toHaveLength(0)
    const seenByA = await listItems(authA, listItemsQuerySchema.parse({ q: 'Tenant A secret item', status: 'all' }))
    expect(seenByA.data.map((row) => row.id)).toEqual([item.id])
    expect((await getItem(authA, item.id)).data).toMatchObject({ name: 'Tenant A secret item', version: 1 })
    expect(await auditRows('item', item.id)).toHaveLength(1)
  })

  it('lists active items by default, inactive on request, and all with status all', async () => {
    const active = await newItem(authA, { name: 'Status filter active' })
    const dormant = await newItem(authA, { name: 'Status filter dormant', isActive: false })
    const ids = async (status?: 'active' | 'inactive' | 'all') =>
      (await listItems(authA, listItemsQuerySchema.parse({ q: 'Status filter', limit: '100', ...(status ? { status } : {}) }))).data.map((row) => row.id)
    expect(await ids()).toEqual([active.id])
    expect(await ids('inactive')).toEqual([dormant.id])
    expect((await ids('all')).sort()).toEqual([active.id, dormant.id].sort())
  })

  it('pages the list with a cursor without repeating or skipping an item', async () => {
    const created: Item[] = []
    for (const name of ['Cursor page a', 'Cursor page b', 'Cursor page c', 'Cursor page d', 'Cursor page e']) created.push(await newItem(authA, { name }))
    const seen: string[] = []
    let cursor: string | undefined
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await listItems(authA, listItemsQuerySchema.parse({ q: 'Cursor page', limit: '2', ...(cursor ? { cursor } : {}) }))
      expect(page.data.length).toBeLessThanOrEqual(2)
      seen.push(...page.data.map((row) => row.id))
      if (!page.nextCursor) break
      cursor = page.nextCursor
    }
    expect(seen).toEqual(created.map((row) => row.id))
  })

  it('never writes stock: an update leaves current_stock, balances and the ledger as the triggers made them', async () => {
    const item = await newItem(authA, { reorderLevel: 0 })
    const warehouse = await newWarehouse(authA)
    await recordMovement(authA, nextKey(), { type: 'IN', itemId: item.id, warehouseId: warehouse.id, quantity: 12, note: null })
    expect(await stockState(item.id)).toEqual({ currentStock: 12, balanceSum: 12, movements: 1 })
    const updated = (await updateItem(authA, item.id, updateInput(item, { name: 'Stocked and renamed', reorderLevel: 4 }))).data
    expect(updated.currentStock).toBe(12)
    expect(await stockState(item.id)).toEqual({ currentStock: 12, balanceSum: 12, movements: 1 })
    const detail = (await getItem(authA, item.id)).data
    expect(detail.currentStock).toBe(12)
    expect(detail.balances.map((balance) => balance.onHand)).toEqual([12])
    expect(detail.movements).toHaveLength(1)
  })

  it('creates an item without any stock row or ledger movement', async () => {
    const item = await newItem(authA)
    expect(await stockState(item.id)).toEqual({ currentStock: 0, balanceSum: 0, movements: 0 })
  })

  it('refuses to receive stock for a deactivated item, lets it be emptied, and receives again once reactivated', async () => {
    const item = await newItem(authA, { reorderLevel: 0 })
    const warehouse = await newWarehouse(authA)
    await recordMovement(authA, nextKey(), { type: 'IN', itemId: item.id, warehouseId: warehouse.id, quantity: 5, note: null })
    const deactivated = (await updateItem(authA, item.id, updateInput(item, { isActive: false }))).data
    expect(deactivated.isActive).toBe(false)
    await expect(recordMovement(authA, nextKey(), { type: 'IN', itemId: item.id, warehouseId: warehouse.id, quantity: 1, note: null })).rejects.toMatchObject({
      code: 'item_inactive',
    })
    await expect(recordMovement(authA, nextKey(), { type: 'OUT', itemId: item.id, warehouseId: warehouse.id, quantity: 5, note: null })).resolves.toMatchObject({ status: 201 })
    const reactivated = (await updateItem(authA, item.id, updateInput(deactivated, { isActive: true }))).data
    expect(reactivated).toMatchObject({ isActive: true, version: 3 })
    await expect(recordMovement(authA, nextKey(), { type: 'IN', itemId: item.id, warehouseId: warehouse.id, quantity: 2, note: null })).resolves.toMatchObject({ status: 201 })
    expect(await stockState(item.id)).toEqual({ currentStock: 2, balanceSum: 2, movements: 3 })
  })
})

describe('catalog service: warehouses', () => {
  it('creates a warehouse for the caller\'s tenant with the actor, zero units and a create audit row', async () => {
    const warehouse = await newWarehouse(authA, { name: 'Dry store', location: 'Shuwaikh', capacity: 300 })
    expect(warehouse).toMatchObject({ name: 'Dry store', location: 'Shuwaikh', capacity: 300, status: 'active', unitsStored: 0, version: 1, createdBy: USER_A })
    const audit = await auditRows('warehouse', warehouse.id)
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({ action: 'create', actor_id: USER_A, tenant_id: authA.tenantId, before: null })
    expect(audit[0].after).toMatchObject({ id: warehouse.id, code: warehouse.code, version: 1 })
  })

  it('stores the code the schema normalises (trimmed, upper case)', async () => {
    const input = createWarehouseSchema.parse({ code: ' cold-1 ', name: 'Cold', status: 'active' })
    const created = (await createWarehouse(authA, nextKey(), input)).body.data
    expect(created.code).toBe('COLD-1')
    expect(created).toMatchObject({ location: null, capacity: null })
  })

  it('rejects a duplicate code in the same tenant with 409 warehouse_code_exists and allows it in another tenant', async () => {
    const first = await newWarehouse(authA)
    const auditBefore = await auditCount(authA.tenantId, 'warehouse')
    await expect(createWarehouse(authA, nextKey(), warehouseInput({ code: first.code }))).rejects.toMatchObject({ status: 409, code: 'warehouse_code_exists' })
    expect(await auditCount(authA.tenantId, 'warehouse')).toBe(auditBefore)
    await expect(createWarehouse(authB, nextKey(), warehouseInput({ code: first.code }))).resolves.toMatchObject({ status: 201 })
  })

  it('publishes inventory.warehouse.created once and not again on an idempotent replay', async () => {
    const key = nextKey()
    const input = warehouseInput()
    const before = eventsNamed('inventory.warehouse.created').length
    const first = await createWarehouse(authA, key, input)
    const second = await createWarehouse(authA, key, input)
    expect(second.replayed).toBe(true)
    expect(second.body.data.id).toBe(first.body.data.id)
    const published = eventsNamed('inventory.warehouse.created')
    expect(published).toHaveLength(before + 1)
    expect(published[published.length - 1]).toMatchObject({ tenantId: authA.tenantId, payload: { warehouseId: first.body.data.id, code: input.code, createdBy: USER_A } })
    expect(await auditRows('warehouse', first.body.data.id)).toHaveLength(1)
    await expect(createWarehouse(authA, key, warehouseInput())).rejects.toMatchObject({ status: 422, code: 'idempotency_key_reused' })
  })

  it('updates name, location, capacity and status by version, keeps the code, and audits before and after', async () => {
    const warehouse = await newWarehouse(authA, { name: 'Old name', location: null, capacity: 100 })
    const updated = (
      await updateWarehouse(authA, warehouse.id, { version: warehouse.version, name: 'New name', location: 'Kuwait City', capacity: 250, status: 'inactive' })
    ).data
    expect(updated).toMatchObject({ code: warehouse.code, name: 'New name', location: 'Kuwait City', capacity: 250, status: 'inactive', version: 2 })
    const audit = await auditRows('warehouse', warehouse.id)
    expect(audit.map((row) => row.action)).toEqual(['create', 'update'])
    expect(audit[1].before).toMatchObject({ name: 'Old name', status: 'active', version: 1 })
    expect(audit[1].after).toMatchObject({ name: 'New name', status: 'inactive', version: 2 })
  })

  it('returns 409 version_conflict on a stale version, with no change, no audit row and no event', async () => {
    const warehouse = await newWarehouse(authA)
    await updateWarehouse(authA, warehouse.id, { version: 1, name: 'Winner', location: null, capacity: null, status: 'active' })
    const eventsBefore = eventsNamed('inventory.warehouse.updated').length
    await expect(updateWarehouse(authA, warehouse.id, { version: 1, name: 'Loser', location: null, capacity: null, status: 'active' })).rejects.toMatchObject({
      status: 409,
      code: 'version_conflict',
    })
    expect((await getWarehouse(authA, warehouse.id)).data).toMatchObject({ name: 'Winner', version: 2 })
    expect(await auditRows('warehouse', warehouse.id)).toHaveLength(2)
    expect(eventsNamed('inventory.warehouse.updated')).toHaveLength(eventsBefore)
  })

  it('returns 404 warehouse_not_found for an unknown id and hides another tenant\'s warehouse', async () => {
    const warehouse = await newWarehouse(authA, { name: 'Tenant A depot' })
    await expect(getWarehouse(authA, MISSING_ID)).rejects.toMatchObject({ status: 404, code: 'warehouse_not_found' })
    await expect(updateWarehouse(authA, MISSING_ID, { version: 1, name: 'x', location: null, capacity: null, status: 'active' })).rejects.toMatchObject({
      status: 404,
      code: 'warehouse_not_found',
    })
    await expect(getWarehouse(authB, warehouse.id)).rejects.toMatchObject({ status: 404, code: 'warehouse_not_found' })
    await expect(
      updateWarehouse(authB, warehouse.id, { version: 1, name: 'Hijacked', location: null, capacity: null, status: 'inactive' })
    ).rejects.toMatchObject({ status: 404, code: 'warehouse_not_found' })
    expect((await getWarehouse(authA, warehouse.id)).data).toMatchObject({ name: 'Tenant A depot', status: 'active', version: 1 })
    const listedForB = await listWarehouses(authB, listWarehousesQuerySchema.parse({ limit: '100' }))
    expect(listedForB.data.map((row) => row.id)).not.toContain(warehouse.id)
    const listedForA = await listWarehouses(authA, listWarehousesQuerySchema.parse({ limit: '100' }))
    expect(listedForA.data.map((row) => row.id)).toContain(warehouse.id)
  })

  it('filters the list by status, defaulting to all', async () => {
    const live = await newWarehouse(authB, { name: 'Filter live' })
    const retired = await newWarehouse(authB, { name: 'Filter retired', status: 'inactive' })
    const ids = async (status?: 'active' | 'inactive' | 'all') =>
      (await listWarehouses(authB, listWarehousesQuerySchema.parse({ limit: '100', ...(status ? { status } : {}) }))).data.map((row) => row.id)
    expect(await ids('active')).toContain(live.id)
    expect(await ids('active')).not.toContain(retired.id)
    expect(await ids('inactive')).toContain(retired.id)
    expect(await ids('inactive')).not.toContain(live.id)
    const everything = await ids()
    expect(everything).toContain(live.id)
    expect(everything).toContain(retired.id)
  })

  it('reports units stored from the trigger-maintained balances and never changes them when the warehouse is edited', async () => {
    const item = await newItem(authA, { reorderLevel: 0 })
    const warehouse = await newWarehouse(authA)
    await recordMovement(authA, nextKey(), { type: 'IN', itemId: item.id, warehouseId: warehouse.id, quantity: 7, note: null })
    expect((await getWarehouse(authA, warehouse.id)).data.unitsStored).toBe(7)
    const updated = (await updateWarehouse(authA, warehouse.id, { version: 1, name: 'Renamed depot', location: null, capacity: 50, status: 'active' })).data
    expect(updated.unitsStored).toBe(7)
    expect(await stockState(item.id)).toEqual({ currentStock: 7, balanceSum: 7, movements: 1 })
  })

  it('refuses to receive stock in a deactivated warehouse, lets it be emptied, and receives again once reactivated', async () => {
    const item = await newItem(authA, { reorderLevel: 0 })
    const warehouse = await newWarehouse(authA)
    await recordMovement(authA, nextKey(), { type: 'IN', itemId: item.id, warehouseId: warehouse.id, quantity: 4, note: null })
    const inactive = (await updateWarehouse(authA, warehouse.id, { version: 1, name: warehouse.name, location: null, capacity: null, status: 'inactive' })).data
    await expect(recordMovement(authA, nextKey(), { type: 'IN', itemId: item.id, warehouseId: warehouse.id, quantity: 1, note: null })).rejects.toMatchObject({
      code: 'warehouse_inactive',
    })
    await expect(recordMovement(authA, nextKey(), { type: 'OUT', itemId: item.id, warehouseId: warehouse.id, quantity: 4, note: null })).resolves.toMatchObject({ status: 201 })
    await updateWarehouse(authA, warehouse.id, { version: inactive.version, name: warehouse.name, location: null, capacity: null, status: 'active' })
    await expect(recordMovement(authA, nextKey(), { type: 'IN', itemId: item.id, warehouseId: warehouse.id, quantity: 1, note: null })).resolves.toMatchObject({ status: 201 })
  })
})

describe('catalog service: AI integration (findItemWithin, setSellingPriceWithin)', () => {
  const run = async <T,>(work: (tx: Parameters<typeof findItemWithin>[0], collected: InventoryEvent[]) => Promise<T>): Promise<{ result: T; collected: InventoryEvent[] }> => {
    const collected: InventoryEvent[] = []
    const result = await withTransaction((tx) => work(tx, collected))
    return { result, collected }
  }

  it('findItemWithin reads an item of the tenant and returns null for an unknown id or another tenant\'s item', async () => {
    const item = await newItem(authA)
    const found = await run((tx) => findItemWithin(tx, authA.tenantId, item.id, true))
    expect(found.result).toMatchObject({ id: item.id, sku: item.sku })
    expect((await run((tx) => findItemWithin(tx, authA.tenantId, MISSING_ID, false))).result).toBeNull()
    expect((await run((tx) => findItemWithin(tx, authB.tenantId, item.id, false))).result).toBeNull()
  })

  it('changes only the selling price, bumps the version, audits before and after and returns the event unpublished', async () => {
    const item = await newItem(authA, { name: 'Price target', unitCostMinor: 400, sellingPriceMinor: 900, reorderLevel: 6 })
    const eventsBefore = eventsNamed('inventory.item.updated').length
    const { result, collected } = await run((tx, list) =>
      setSellingPriceWithin(tx, authA, { itemId: item.id, expectedPriceMinor: 900, newPriceMinor: 750 }, list)
    )
    expect(result).toMatchObject({
      id: item.id,
      name: 'Price target',
      unitCostMinor: 400,
      sellingPriceMinor: 750,
      reorderLevel: 6,
      isActive: true,
      version: 2,
      currentStock: 0,
    })
    expect(collected).toHaveLength(1)
    expect(collected[0]).toMatchObject({ name: 'inventory.item.updated', tenantId: authA.tenantId, payload: { itemId: item.id, updatedBy: USER_A } })
    expect(eventsNamed('inventory.item.updated')).toHaveLength(eventsBefore)
    const audit = await auditRows('item', item.id)
    expect(audit.map((row) => row.action)).toEqual(['create', 'update'])
    expect(audit[1].before).toMatchObject({ sellingPriceMinor: 900, version: 1 })
    expect(audit[1].after).toMatchObject({ sellingPriceMinor: 750, version: 2 })
    expect((await getItem(authA, item.id)).data.sellingPriceMinor).toBe(750)
  })

  it('keeps an inactive item inactive when only its price changes', async () => {
    const item = await newItem(authA, { isActive: false, sellingPriceMinor: 500 })
    const { result } = await run((tx, list) => setSellingPriceWithin(tx, authA, { itemId: item.id, expectedPriceMinor: 500, newPriceMinor: 450 }, list))
    expect(result).toMatchObject({ isActive: false, sellingPriceMinor: 450 })
  })

  it('refuses with proposal_stale when the price is no longer the expected one, and changes nothing', async () => {
    const item = await newItem(authA, { sellingPriceMinor: 1_000 })
    await updateItem(authA, item.id, updateInput(item, { sellingPriceMinor: 1_100 }))
    const collected: InventoryEvent[] = []
    const attempt = withTransaction((tx) => setSellingPriceWithin(tx, authA, { itemId: item.id, expectedPriceMinor: 1_000, newPriceMinor: 800 }, collected))
    await expect(attempt).rejects.toBeInstanceOf(DomainError)
    await expect(attempt).rejects.toMatchObject({ code: 'proposal_stale' })
    expect(collected).toHaveLength(0)
    expect((await getItem(authA, item.id)).data).toMatchObject({ sellingPriceMinor: 1_100, version: 2 })
    expect(await auditRows('item', item.id)).toHaveLength(2)
  })

  it('returns 404 item_not_found for an unknown item or another tenant\'s item', async () => {
    const item = await newItem(authA, { sellingPriceMinor: 300 })
    await expect(
      run((tx, list) => setSellingPriceWithin(tx, authA, { itemId: MISSING_ID, expectedPriceMinor: 300, newPriceMinor: 200 }, list))
    ).rejects.toMatchObject({ status: 404, code: 'item_not_found' })
    await expect(
      run((tx, list) => setSellingPriceWithin(tx, authB, { itemId: item.id, expectedPriceMinor: 300, newPriceMinor: 200 }, list))
    ).rejects.toMatchObject({ status: 404, code: 'item_not_found' })
    expect((await getItem(authA, item.id)).data).toMatchObject({ sellingPriceMinor: 300, version: 1 })
  })

  it('rolls the price change back with the caller\'s transaction', async () => {
    const item = await newItem(authA, { sellingPriceMinor: 600 })
    await expect(
      withTransaction(async (tx) => {
        await setSellingPriceWithin(tx, authA, { itemId: item.id, expectedPriceMinor: 600, newPriceMinor: 550 }, [])
        throw new Error('caller aborts')
      })
    ).rejects.toThrow('caller aborts')
    expect((await getItem(authA, item.id)).data).toMatchObject({ sellingPriceMinor: 600, version: 1 })
    expect(await auditRows('item', item.id)).toHaveLength(1)
  })
})
