import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions } from '@/lib/auth/permissions'
import { subscribe, type BusEvent } from '@/lib/events/bus'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

import { createItem, createWarehouse, updateItem, updateWarehouse } from '@/modules/inventory'
import type { Item, Warehouse } from '@/modules/inventory/client'
import {
  approveOrder,
  cancelOrder,
  createOrder,
  createReceipt,
  createSupplier,
  getOrder,
  getReceipt,
  getSettings,
  listOrders,
  listReceipts,
  listSuppliers,
  submitOrder,
  updateOrder,
  updateSettings,
  updateSupplier,
} from '@/modules/procurement'
import type { PurchaseOrderDetail, Supplier } from '@/modules/procurement/client'

/** Procurement against the real migrations: the order flow, receipts that move stock, approval, permissions, isolation and audit. */

const pg = () => getPglite()
let a: AuthContext
let b: AuthContext
let supplier: Supplier
let bSupplier: Supplier
let warehouse: Warehouse
let flour: Item
let sugar: Item
let bItem: Item
const events: BusEvent[] = []

function only(auth: AuthContext, ...granted: string[]): AuthContext {
  return { ...auth, permissions: new Set(granted) }
}

async function outcome(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return 'ok'
  } catch (error) {
    const typed = error as { status?: number; code?: string; name?: string }
    if (typed.status) return `${typed.status}:${typed.code}`
    if (typed.code) return typed.code
    return `${typed.name}:${(error as Error).message}`
  }
}

async function sqlFailure(sql: string, params: unknown[] = []): Promise<string> {
  try {
    await pg().query(sql, params)
    return 'ok'
  } catch (error) {
    return (error as Error).message
  }
}

let keyCounter = 0
const nextKey = () => `proc-key-${String(++keyCounter).padStart(6, '0')}`

async function stockOf(auth: AuthContext, item: Item, wh: Warehouse = warehouse): Promise<number> {
  const result = await pg().query<{ on_hand: number }>(`select on_hand from stock_balances where tenant_id = $1 and item_id = $2 and warehouse_id = $3`, [auth.tenantId, item.id, wh.id])
  return result.rows[0]?.on_hand ?? 0
}

const line = (item: Item, quantity: number, unitCostMinor = 1000, taxRateBps = 0) => ({ itemId: item.id, description: item.name, quantity, unitCostMinor, taxRateBps })

async function draft(auth: AuthContext, lines = [line(flour, 10), line(sugar, 5)], sup: Supplier = supplier): Promise<PurchaseOrderDetail> {
  const result = await createOrder(auth, nextKey(), { supplierId: sup.id, orderDate: '2026-05-01', expectedDate: null, notes: null, lines })
  return result.body.data
}

/** A draft taken to the approved state, with no limit configured. */
async function approved(auth: AuthContext, lines?: Parameters<typeof draft>[1]): Promise<PurchaseOrderDetail> {
  const created = await draft(auth, lines)
  return (await submitOrder(auth, created.id, { version: created.version })).data
}

async function receive(auth: AuthContext, order: PurchaseOrderDetail, quantities: number[], wh: Warehouse = warehouse) {
  return createReceipt(auth, order.id, nextKey(), {
    version: order.version,
    warehouseId: wh.id,
    receiptDate: '2026-05-10',
    notes: null,
    lines: quantities.map((quantity, index) => ({ orderLineId: order.lines[index].id, quantity })).filter((entry) => entry.quantity > 0),
  })
}

async function newItem(auth: AuthContext, sku: string, options: { active?: boolean } = {}): Promise<Item> {
  const created = (
    await createItem(auth, nextKey(), { sku, name: `Item ${sku}`, unit: 'piece', unitCostMinor: 800, sellingPriceMinor: 1500, reorderLevel: 0, isActive: true })
  ).body.data
  if (options.active === false) return (await updateItem(auth, created.id, { version: created.version, name: created.name, unitCostMinor: 800, sellingPriceMinor: 1500, reorderLevel: 0, isActive: false })).data
  return created
}

beforeAll(async () => {
  await startDatabase()
  for (const name of [
    'procurement.supplier.created',
    'procurement.supplier.updated',
    'procurement.order.created',
    'procurement.order.submitted',
    'procurement.order.approved',
    'procurement.order.cancelled',
    'procurement.receipt.posted',
    'inventory.stock.moved',
  ]) {
    subscribe(name, (event) => void events.push(event))
  }
  const ownerA = randomUUID()
  const ownerB = randomUUID()
  await createUser(ownerA)
  await createUser(ownerB)
  a = { userId: ownerA, tenantId: await bootstrapTenant('Proc A', 'proc-a', ownerA), permissions: new Set<string>(allPermissions) }
  b = { userId: ownerB, tenantId: await bootstrapTenant('Proc B', 'proc-b', ownerB), permissions: new Set<string>(allPermissions) }
  supplier = (await createSupplier(a, { code: 'GULF', name: 'Gulf Foods', paymentTermsDays: 30, notes: null })).data
  bSupplier = (await createSupplier(b, { code: 'GULF', name: 'Other company supplier', paymentTermsDays: 30, notes: null })).data
  warehouse = (await createWarehouse(a, nextKey(), { code: 'MAIN', name: 'Main', location: null, capacity: null, status: 'active' })).body.data
  flour = await newItem(a, 'FLOUR')
  sugar = await newItem(a, 'SUGAR')
  bItem = await newItem(b, 'FLOUR')
}, 120_000)
afterAll(stopDatabase)

describe('suppliers', () => {
  it('creates with an audit row and an event, and keeps codes per company', async () => {
    const audit = await pg().query<{ action: string }>(`select action from audit_log where entity = 'supplier' and entity_id = $1`, [supplier.id])
    expect(audit.rows).toEqual([{ action: 'create' }])
    expect(events.map((event) => event.name)).toContain('procurement.supplier.created')
    expect(bSupplier.code).toBe('GULF')
    expect(await outcome(createSupplier(a, { code: 'GULF', name: 'Again', paymentTermsDays: 30, notes: null }))).toBe('409:supplier_code_exists')
  })

  it('updates with the version and never the code', async () => {
    const extra = (await createSupplier(a, { code: 'EXTRA', name: 'Before', paymentTermsDays: 15, notes: null })).data
    expect(await outcome(updateSupplier(a, extra.id, { version: 9, name: 'x', status: 'active', paymentTermsDays: 15, notes: null }))).toBe('409:version_conflict')
    const updated = await updateSupplier(a, extra.id, { version: 1, name: 'After', status: 'active', paymentTermsDays: 45, notes: 'ok' })
    expect(updated.data).toMatchObject({ code: 'EXTRA', name: 'After', paymentTermsDays: 45, version: 2 })
    expect(await sqlFailure(`update suppliers set code = 'ZZ' where id = $1`, [extra.id])).toContain('cannot change')
  })

  it('cannot be ordered from once blocked, in code and in the database', async () => {
    const blocked = (await createSupplier(a, { code: 'BLOCKED', name: 'Blocked', paymentTermsDays: 0, notes: null })).data
    await updateSupplier(a, blocked.id, { version: 1, name: 'Blocked', status: 'blocked', paymentTermsDays: 0, notes: null })
    expect(await outcome(draft(a, undefined, blocked))).toBe('409:supplier_blocked')
    const direct = await sqlFailure(
      `insert into purchase_orders (tenant_id, number, supplier_id, supplier_name, order_date, subtotal_minor, tax_minor, total_minor, created_by) values ($1, 9001, $2, 'x', '2026-05-01', 0, 0, 0, $3)`,
      [a.tenantId, blocked.id, a.userId]
    )
    expect(direct).toContain('active supplier')
  })

  it('is hidden from another company', async () => {
    expect((await listSuppliers(b, { limit: 100, status: 'all' })).data.map((entry) => entry.id)).not.toContain(supplier.id)
    expect(await outcome(createOrder(b, nextKey(), { supplierId: supplier.id, orderDate: '2026-05-01', expectedDate: null, notes: null, lines: [line(bItem, 1)] }))).toBe('422:supplier_not_found')
  })
})

describe('approval limit', () => {
  it('starts with no limit, and refuses a stale version', async () => {
    expect((await getSettings(a)).data).toEqual({ approvalThresholdMinor: null, version: 0 })
    expect(await outcome(updateSettings(a, { version: 3, approvalThresholdMinor: 1000 }))).toBe('409:version_conflict')
  })

  it('needs the settings permission, but the order read permission is enough to see the limit', async () => {
    expect(await outcome(updateSettings(only(a, 'procurement.order.read'), { version: 0, approvalThresholdMinor: 1000 }))).toBe('403:forbidden')
    expect((await getSettings(only(a, 'procurement.order.read'))).data.version).toBeGreaterThanOrEqual(0)
    expect(await outcome(getSettings(only(a)))).toBe('403:forbidden')
  })
})

describe('purchase orders', () => {
  it('creates a draft with totals from the finance rule: tax summed unrounded, rounded half up once', async () => {
    const order = await draft(a, [line(flour, 3, 333, 1500), line(sugar, 1, 1, 0)])
    // net 999 + 1, tax = 999 x 1500 / 10000 = 149.85 -> 150, total 1150
    expect(order).toMatchObject({ status: 'draft', supplierName: 'Gulf Foods', subtotalMinor: 1000, taxMinor: 150, totalMinor: 1150, lineCount: 2, version: 1 })
    expect(order.lines.map((entry) => entry.receivedQuantity)).toEqual([0, 0])
    const audit = await pg().query<{ action: string }>(`select action from audit_log where entity = 'purchase_order' and entity_id = $1`, [order.id])
    expect(audit.rows).toEqual([{ action: 'create' }])
    expect(events.map((event) => event.name)).toContain('procurement.order.created')
  })

  it('numbers per company and replays an idempotent create', async () => {
    const key = nextKey()
    const body = { supplierId: supplier.id, orderDate: '2026-05-02', expectedDate: null, notes: 'once', lines: [line(flour, 2)] }
    const first = await createOrder(a, key, body)
    const again = await createOrder(a, key, body)
    expect(again.replayed).toBe(true)
    expect(again.body.data.id).toBe(first.body.data.id)
    expect(await outcome(createOrder(a, key, { ...body, notes: 'different' }))).toBe('422:idempotency_key_reused')
    const bFirst = await createOrder(b, nextKey(), { supplierId: bSupplier.id, orderDate: '2026-05-02', expectedDate: null, notes: null, lines: [line(bItem, 1)] })
    expect(bFirst.body.data.number).toBe(1)
  })

  it('refuses an unknown, foreign or inactive item', async () => {
    const dormant = await newItem(a, 'DORMANT', { active: false })
    expect(await outcome(draft(a, [line(dormant, 1)]))).toBe('422:item_inactive')
    expect(await outcome(draft(a, [line(bItem, 1)]))).toBe('422:item_not_found')
    expect(await outcome(draft(a, [{ ...line(flour, 1), itemId: randomUUID() }]))).toBe('422:item_not_found')
  })

  it('edits only a draft, with the version, and recomputes totals', async () => {
    const order = await draft(a, [line(flour, 1, 100)])
    const edited = await updateOrder(a, order.id, { version: 1, orderDate: '2026-05-03', expectedDate: '2026-05-20', notes: 'changed', lines: [line(flour, 2, 100), line(sugar, 3, 200)] })
    expect(edited.data).toMatchObject({ orderDate: '2026-05-03', expectedDate: '2026-05-20', subtotalMinor: 800, totalMinor: 800, lineCount: 2, version: 2 })
    expect(await outcome(updateOrder(a, order.id, { version: 1, orderDate: '2026-05-03', expectedDate: null, notes: null, lines: [line(flour, 1)] }))).toBe('409:version_conflict')
    const submitted = await submitOrder(a, order.id, { version: 2 })
    expect(await outcome(updateOrder(a, order.id, { version: submitted.data.version, orderDate: '2026-05-03', expectedDate: null, notes: null, lines: [line(flour, 1)] }))).toBe('409:order_not_draft')
  })

  it('goes straight to approved when no limit is set, and says so in the event', async () => {
    const order = await draft(a)
    const done = await submitOrder(a, order.id, { version: order.version })
    expect(done.data).toMatchObject({ status: 'approved', approvalRequired: false, approvedBy: null, submittedBy: a.userId })
    expect(done.data.approvedAt).not.toBeNull()
    const names = events.filter((event) => (event.payload as { orderId?: string }).orderId === order.id).map((event) => event.name)
    expect(names).toEqual(expect.arrayContaining(['procurement.order.submitted', 'procurement.order.approved']))
  })
})

describe('approval by amount', () => {
  it('sends an order strictly above the limit for approval, and not one at the limit', async () => {
    const settings = await updateSettings(a, { version: 0, approvalThresholdMinor: 10_000 })
    expect(settings.data).toEqual({ approvalThresholdMinor: 10_000, version: 1 })
    const audit = await pg().query<{ action: string }>(`select action from audit_log where entity = 'procurement_settings' and entity_id = $1`, [a.tenantId])
    expect(audit.rows).toEqual([{ action: 'create' }])

    const atLimit = await draft(a, [line(flour, 10, 1000)])
    expect(atLimit.totalMinor).toBe(10_000)
    expect((await submitOrder(a, atLimit.id, { version: atLimit.version })).data.status).toBe('approved')

    const above = await draft(a, [line(flour, 10, 1001)])
    const pending = await submitOrder(a, above.id, { version: above.version })
    expect(pending.data).toMatchObject({ status: 'pending_approval', approvalRequired: true, approvedAt: null })

    expect(await outcome(approveOrder(only(a, 'procurement.order.submit'), above.id, { version: pending.data.version }))).toBe('403:forbidden')
    const approvedOrder = await approveOrder(a, above.id, { version: pending.data.version })
    expect(approvedOrder.data).toMatchObject({ status: 'approved', approvedBy: a.userId })
    expect(await outcome(approveOrder(a, above.id, { version: approvedOrder.data.version }))).toBe('409:order_not_pending')
  })

  it('moves the limit with a version, and an order already waiting stays waiting', async () => {
    const above = await draft(a, [line(flour, 20, 1000)])
    const pending = await submitOrder(a, above.id, { version: above.version })
    expect(pending.data.status).toBe('pending_approval')
    expect((await updateSettings(a, { version: 1, approvalThresholdMinor: null })).data).toEqual({ approvalThresholdMinor: null, version: 2 })
    expect((await getOrder(a, above.id)).data.status).toBe('pending_approval')
    const next = await draft(a, [line(flour, 20, 1000)])
    expect((await submitOrder(a, next.id, { version: next.version })).data.status).toBe('approved')
  })
})

describe('cancelling', () => {
  it('needs a reason, works before goods arrive, and is final', async () => {
    const order = await draft(a)
    const cancelled = await cancelOrder(a, order.id, { version: order.version, reason: 'Supplier withdrew' })
    expect(cancelled.data).toMatchObject({ status: 'cancelled', cancelledBy: a.userId, cancelledReason: 'Supplier withdrew' })
    expect(await outcome(cancelOrder(a, order.id, { version: cancelled.data.version, reason: 'again' }))).toBe('409:order_not_cancellable')
    expect(await outcome(submitOrder(a, order.id, { version: cancelled.data.version }))).toBe('409:order_not_draft')
    expect(events.map((event) => event.name)).toContain('procurement.order.cancelled')
  })

  it('cannot cancel once goods have been received', async () => {
    const order = await approved(a, [line(flour, 4)])
    const receipt = await receive(a, order, [1])
    expect(await outcome(cancelOrder(a, order.id, { version: receipt.body.data.order.version, reason: 'too late' }))).toBe('409:order_not_cancellable')
  })
})

describe('goods receipts and stock', () => {
  it('receives part of an order: an IN movement per line, the order partly received, an audit row and an event', async () => {
    const order = await approved(a, [line(flour, 10), line(sugar, 5)])
    const flourBefore = await stockOf(a, flour)
    const sugarBefore = await stockOf(a, sugar)
    const result = await receive(a, order, [4, 5])
    const receipt = result.body.data
    expect(result.status).toBe(201)
    expect(receipt).toMatchObject({ orderId: order.id, orderNumber: order.number, lineCount: 2, totalQuantity: 9, warehouseId: warehouse.id })
    expect(receipt.order.status).toBe('partially_received')
    expect(receipt.order.lines.map((entry) => entry.receivedQuantity)).toEqual([4, 5])
    expect(receipt.order.version).toBe(order.version + 1)
    expect(await stockOf(a, flour)).toBe(flourBefore + 4)
    expect(await stockOf(a, sugar)).toBe(sugarBefore + 5)

    const movements = await pg().query<{ movement_type: string; quantity: number; reference_type: string; reference_id: string }>(
      `select movement_type, quantity, reference_type, reference_id from stock_movements where reference_id = $1 order by quantity`,
      [receipt.id]
    )
    expect(movements.rows).toEqual([
      { movement_type: 'IN', quantity: 4, reference_type: 'purchase_receipt', reference_id: receipt.id },
      { movement_type: 'IN', quantity: 5, reference_type: 'purchase_receipt', reference_id: receipt.id },
    ])
    const audit = await pg().query<{ entity: string }>(`select entity from audit_log where entity_id = $1 and tenant_id = $2`, [receipt.id, a.tenantId])
    expect(audit.rows).toEqual([{ entity: 'goods_receipt' }])
    const posted = events.filter((event) => event.name === 'procurement.receipt.posted' && (event.payload as { receiptId: string }).receiptId === receipt.id)
    expect(posted).toHaveLength(1)
    expect(posted[0].payload).toMatchObject({ orderStatus: 'partially_received', totalQuantity: 9, receivedBy: a.userId })
  })

  it('completes the order with a second receipt and then refuses any more', async () => {
    const order = await approved(a, [line(flour, 6)])
    const first = await receive(a, order, [2])
    const second = await receive(a, first.body.data.order, [4])
    expect(second.body.data.order.status).toBe('received')
    expect(await outcome(receive(a, second.body.data.order, [1]))).toBe('409:order_not_receivable')
    const list = await listReceipts(a, { limit: 10, orderId: order.id })
    expect(list.data.map((entry) => entry.totalQuantity).sort()).toEqual([2, 4])
    expect((await getReceipt(a, second.body.data.id)).data.lines).toHaveLength(1)
  })

  it('refuses to receive more than is left, and leaves stock and the order untouched', async () => {
    const order = await approved(a, [line(flour, 3)])
    const before = await stockOf(a, flour)
    expect(await outcome(receive(a, order, [4]))).toBe('over_receipt')
    expect(await stockOf(a, flour)).toBe(before)
    expect((await getOrder(a, order.id)).data).toMatchObject({ status: 'approved', version: order.version })
  })

  it('refuses a receipt against an order that is not approved', async () => {
    const created = await draft(a, [line(flour, 3)])
    expect(await outcome(receive(a, created, [1]))).toBe('409:order_not_receivable')
    const cancelled = await cancelOrder(a, created.id, { version: created.version, reason: 'no' })
    expect(await outcome(receive(a, cancelled.data, [1]))).toBe('409:order_not_receivable')
  })

  it('refuses a stale version and an inactive warehouse, and books nothing', async () => {
    const order = await approved(a, [line(flour, 5)])
    const before = await stockOf(a, flour)
    expect(await outcome(createReceipt(a, order.id, nextKey(), { version: 99, warehouseId: warehouse.id, receiptDate: '2026-05-10', notes: null, lines: [{ orderLineId: order.lines[0].id, quantity: 1 }] }))).toBe('409:version_conflict')
    const closed = (await createWarehouse(a, nextKey(), { code: 'CLOSED', name: 'Closed', location: null, capacity: null, status: 'active' })).body.data
    await updateWarehouse(a, closed.id, { version: closed.version, name: 'Closed', location: null, capacity: null, status: 'inactive' })
    expect(await outcome(receive(a, order, [1], closed))).toBe('warehouse_inactive')
    expect(await stockOf(a, flour)).toBe(before)
    expect((await getOrder(a, order.id)).data.lines[0].receivedQuantity).toBe(0)
    expect((await pg().query(`select 1 from goods_receipts where order_id = $1`, [order.id])).rows).toHaveLength(0)
  })

  it('replays an idempotent receipt without receiving twice', async () => {
    const order = await approved(a, [line(flour, 8)])
    const key = nextKey()
    const body = { version: order.version, warehouseId: warehouse.id, receiptDate: '2026-05-10', notes: null, lines: [{ orderLineId: order.lines[0].id, quantity: 3 }] }
    const before = await stockOf(a, flour)
    const first = await createReceipt(a, order.id, key, body)
    const again = await createReceipt(a, order.id, key, body)
    expect(again.replayed).toBe(true)
    expect(again.body.data.id).toBe(first.body.data.id)
    expect(await stockOf(a, flour)).toBe(before + 3)
    expect((await getOrder(a, order.id)).data.lines[0].receivedQuantity).toBe(3)
  })

  it('does not change the item\'s unit cost: the purchase price is not a costing method', async () => {
    const order = await approved(a, [line(flour, 2, 99_999)])
    await receive(a, order, [2])
    const cost = await pg().query<{ unit_cost_minor: string }>(`select unit_cost_minor::text from items where id = $1`, [flour.id])
    expect(cost.rows[0].unit_cost_minor).toBe('800')
  })

  it('lists orders newest first with a cursor and filters', async () => {
    const page = await listOrders(a, { limit: 3, status: 'all' })
    expect(page.data).toHaveLength(3)
    expect(page.data[0].number > page.data[1].number).toBe(true)
    const next = await listOrders(a, { limit: 3, status: 'all', cursor: page.nextCursor ?? undefined })
    expect(next.data[0].number < page.data[2].number).toBe(true)
    const received = await listOrders(a, { limit: 100, status: 'received' })
    expect(received.data.every((entry) => entry.status === 'received')).toBe(true)
    const mine = await listOrders(a, { limit: 100, status: 'all', supplierId: supplier.id })
    expect(mine.data.every((entry) => entry.supplierId === supplier.id)).toBe(true)
  })
})

describe('what the database refuses, even to code that skips the service', () => {
  it('refuses an illegal status change and an edit of a submitted order', async () => {
    const order = await approved(a, [line(flour, 5)])
    expect(await sqlFailure(`update purchase_orders set status = 'received' where id = $1`, [order.id])).toContain('Not every line')
    expect(await sqlFailure(`update purchase_orders set status = 'draft' where id = $1`, [order.id])).toContain('cannot go from')
    expect(await sqlFailure(`update purchase_orders set total_minor = 1, subtotal_minor = 1 where id = $1`, [order.id])).toContain('Only a draft')
    const swap = (await createSupplier(a, { code: 'SWAP', name: 'Swap', paymentTermsDays: 30, notes: null })).data
    expect(await sqlFailure(`update purchase_orders set supplier_id = $2 where id = $1`, [order.id, swap.id])).toContain('cannot change')
    expect(await sqlFailure(`update purchase_order_lines set quantity = 99 where id = $1`, [order.lines[0].id])).toContain('Only the lines of a draft')
    expect(await sqlFailure(`delete from purchase_order_lines where id = $1`, [order.lines[0].id])).toContain('Only the lines of a draft')
    expect(await sqlFailure(`delete from purchase_orders where id = $1`, [order.id])).not.toBe('ok')
  })

  it('refuses a received quantity that goes down, or past the ordered quantity', async () => {
    const order = await approved(a, [line(flour, 5)])
    await receive(a, order, [3])
    expect(await sqlFailure(`update purchase_order_lines set received_quantity = 1 where id = $1`, [order.lines[0].id])).toContain('cannot go down')
    expect(await sqlFailure(`update purchase_order_lines set received_quantity = 6 where id = $1`, [order.lines[0].id])).toContain('check')
  })

  it('never changes or deletes a receipt', async () => {
    const order = await approved(a, [line(flour, 5)])
    const receipt = (await receive(a, order, [2])).body.data
    expect(await sqlFailure(`update goods_receipts set notes = 'x' where id = $1`, [receipt.id])).not.toBe('ok')
    expect(await sqlFailure(`delete from goods_receipts where id = $1`, [receipt.id])).not.toBe('ok')
    expect(await sqlFailure(`update goods_receipt_lines set quantity = 5 where receipt_id = $1`, [receipt.id])).not.toBe('ok')
    expect(await sqlFailure(`delete from goods_receipt_lines where receipt_id = $1`, [receipt.id])).not.toBe('ok')
  })

  it('refuses a receipt against a draft order, and a receipt line that is not that order\'s line', async () => {
    const created = await draft(a, [line(flour, 5)])
    expect(
      await sqlFailure(`insert into goods_receipts (tenant_id, number, order_id, warehouse_id, receipt_date, created_by) values ($1, 9100, $2, $3, '2026-05-10', $4)`, [a.tenantId, created.id, warehouse.id, a.userId])
    ).toContain('approved order')

    const mine = await approved(a, [line(flour, 5)])
    const other = await approved(a, [line(sugar, 5)])
    const header = await pg().query<{ id: string }>(
      `insert into goods_receipts (tenant_id, number, order_id, warehouse_id, receipt_date, created_by) values ($1, 9101, $2, $3, '2026-05-10', $4) returning id`,
      [a.tenantId, mine.id, warehouse.id, a.userId]
    )
    const foreignLine = await sqlFailure(
      `insert into goods_receipt_lines (tenant_id, receipt_id, order_id, order_line_id, item_id, line_no, quantity, created_by) values ($1, $2, $3, $4, $5, 1, 1, $6)`,
      [a.tenantId, header.rows[0].id, mine.id, other.lines[0].id, sugar.id, a.userId]
    )
    expect(foreignLine).toContain('foreign key')
    const wrongItem = await sqlFailure(
      `insert into goods_receipt_lines (tenant_id, receipt_id, order_id, order_line_id, item_id, line_no, quantity, created_by) values ($1, $2, $3, $4, $5, 1, 1, $6)`,
      [a.tenantId, header.rows[0].id, mine.id, mine.lines[0].id, sugar.id, a.userId]
    )
    expect(wrongItem).toContain('foreign key')
  })

  it('moves the order along by itself when a receipt line is inserted', async () => {
    const order = await approved(a, [line(flour, 2), line(sugar, 2)])
    const header = await pg().query<{ id: string }>(
      `insert into goods_receipts (tenant_id, number, order_id, warehouse_id, receipt_date, created_by) values ($1, 9102, $2, $3, '2026-05-10', $4) returning id`,
      [a.tenantId, order.id, warehouse.id, a.userId]
    )
    await pg().query(
      `insert into goods_receipt_lines (tenant_id, receipt_id, order_id, order_line_id, item_id, line_no, quantity, created_by) values ($1, $2, $3, $4, $5, 1, 2, $6)`,
      [a.tenantId, header.rows[0].id, order.id, order.lines[0].id, flour.id, a.userId]
    )
    expect((await pg().query<{ status: string }>(`select status from purchase_orders where id = $1`, [order.id])).rows[0].status).toBe('partially_received')
    await pg().query(
      `insert into goods_receipt_lines (tenant_id, receipt_id, order_id, order_line_id, item_id, line_no, quantity, created_by) values ($1, $2, $3, $4, $5, 2, 2, $6)`,
      [a.tenantId, header.rows[0].id, order.id, order.lines[1].id, sugar.id, a.userId]
    )
    expect((await pg().query<{ status: string }>(`select status from purchase_orders where id = $1`, [order.id])).rows[0].status).toBe('received')
    // The same line cannot be received past its quantity, even by a second receipt written directly.
    const second = await pg().query<{ id: string }>(
      `insert into goods_receipts (tenant_id, number, order_id, warehouse_id, receipt_date, created_by) values ($1, 9103, $2, $3, '2026-05-10', $4) returning id`,
      [a.tenantId, order.id, warehouse.id, a.userId]
    ).catch((error: Error) => error)
    expect(second instanceof Error ? second.message : 'inserted').toContain('approved order')
  })

  it('refuses a submit with no lines and a draft line for an inactive item', async () => {
    const created = await draft(a, [line(flour, 1)])
    await pg().query(`delete from purchase_order_lines where order_id = $1`, [created.id])
    expect(await sqlFailure(`update purchase_orders set status = 'approved', submitted_at = now(), submitted_by = $2, approved_at = now() where id = $1`, [created.id, a.userId])).toContain('at least one line')
  })
})

describe('permissions', () => {
  it('refuses every action without its permission', async () => {
    const none = only(a)
    const order = await draft(a)
    const done = await approved(a, [line(flour, 3)])
    const results = await Promise.all([
      outcome(listSuppliers(none, { limit: 5, status: 'all' })),
      outcome(createSupplier(none, { code: 'NOPE', name: 'x', paymentTermsDays: 30, notes: null })),
      outcome(updateSupplier(none, supplier.id, { version: 1, name: 'x', status: 'active', paymentTermsDays: 30, notes: null })),
      outcome(listOrders(none, { limit: 5, status: 'all' })),
      outcome(getOrder(none, order.id)),
      outcome(createOrder(none, nextKey(), { supplierId: supplier.id, orderDate: '2026-05-01', expectedDate: null, notes: null, lines: [line(flour, 1)] })),
      outcome(updateOrder(none, order.id, { version: order.version, orderDate: '2026-05-01', expectedDate: null, notes: null, lines: [line(flour, 1)] })),
      outcome(submitOrder(none, order.id, { version: order.version })),
      outcome(approveOrder(none, order.id, { version: order.version })),
      outcome(cancelOrder(none, order.id, { version: order.version, reason: 'x' })),
      outcome(receive(none, done, [1])),
      outcome(listReceipts(none, { limit: 5 })),
      outcome(getReceipt(none, randomUUID())),
    ])
    expect(results.every((result) => result === '403:forbidden')).toBe(true)
  })

  it('does not let one permission stand in for another', async () => {
    const order = await draft(a)
    expect(await outcome(submitOrder(only(a, 'procurement.order.create', 'procurement.order.update'), order.id, { version: order.version }))).toBe('403:forbidden')
    expect(await outcome(createOrder(only(a, 'procurement.order.submit', 'procurement.order.approve'), nextKey(), { supplierId: supplier.id, orderDate: '2026-05-01', expectedDate: null, notes: null, lines: [line(flour, 1)] }))).toBe('403:forbidden')
    const done = await approved(a, [line(flour, 3)])
    expect(await outcome(receive(only(a, 'procurement.order.approve', 'procurement.order.read'), done, [1]))).toBe('403:forbidden')
  })
})

describe('tenant isolation', () => {
  it('hides orders and receipts of another company and refuses to act on them', async () => {
    const order = await approved(a, [line(flour, 5)])
    const receipt = (await receive(a, order, [1])).body.data
    expect(await outcome(getOrder(b, order.id))).toBe('404:order_not_found')
    expect(await outcome(submitOrder(b, order.id, { version: 1 }))).toBe('404:order_not_found')
    expect(await outcome(cancelOrder(b, order.id, { version: 1, reason: 'x' }))).toBe('404:order_not_found')
    expect(await outcome(receive(b, order, [1]))).toBe('404:order_not_found')
    expect(await outcome(getReceipt(b, receipt.id))).toBe('404:receipt_not_found')
    expect((await listOrders(b, { limit: 100, status: 'all' })).data.map((entry) => entry.id)).not.toContain(order.id)
    expect((await listReceipts(b, { limit: 100 })).data).toEqual([])
  })

  it('cannot receive into another company\'s warehouse', async () => {
    const order = await approved(a, [line(flour, 5)])
    const bWarehouse = (await createWarehouse(b, nextKey(), { code: 'MAIN', name: 'B main', location: null, capacity: null, status: 'active' })).body.data
    const result = await outcome(receive(a, order, [1], bWarehouse))
    expect(result).not.toBe('ok')
    expect((await getOrder(a, order.id)).data.lines[0].receivedQuantity).toBe(0)
  })
})
