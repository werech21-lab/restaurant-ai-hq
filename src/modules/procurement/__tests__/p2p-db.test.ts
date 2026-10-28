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

import { closePeriod, createAccount, createPeriod, getJournalEntry, getTrialBalance, reverseJournalEntry } from '@/modules/finance'
import type { Account } from '@/modules/finance/client'
import { createItem, createWarehouse, updateItem } from '@/modules/inventory'
import type { Item, Warehouse } from '@/modules/inventory/client'
import {
  approveOrder,
  approveRequest,
  cancelRequest,
  convertRequest,
  createOrder,
  createReceipt,
  createRequest,
  createSupplier,
  createSupplierInvoice,
  getAccounting,
  getOrder,
  getRequest,
  getSupplierInvoice,
  listRequests,
  listSupplierInvoices,
  rejectRequest,
  submitOrder,
  submitRequest,
  updateAccounting,
  updateRequest,
  updateSettings,
  voidSupplierInvoice,
} from '@/modules/procurement'
import type { PurchaseOrderDetail, PurchaseRequestDetail, Supplier } from '@/modules/procurement/client'
import { rejectRequestSchema } from '@/modules/procurement/client'

/**
 * The procure-to-pay cycle against the real migrations: request, approval, order, partial and full receipt, supplier invoice
 * posted to the double-entry ledger, void by reversal. It checks the database guards, rollback, idempotency, concurrency,
 * permissions and the isolation of two companies. Everything is synthetic data in an in-memory database.
 */

const pg = () => getPglite()
const events: BusEvent[] = []

type World = {
  auth: AuthContext
  supplier: Supplier
  warehouse: Warehouse
  flour: Item
  sugar: Item
  inventory: Account
  payable: Account
  tax: Account
  header: Account
}

/** The accounting settings of the original invoice-basis cycle: no GRNI, no variance account, no tolerance. */
const invoiceBasis = {
  accountingBasis: 'invoice_basis' as const,
  costingMethod: 'order_price' as const,
  cogsAccountId: null,
  grniAccountId: null,
  ppvAccountId: null,
  priceToleranceBps: 0,
  taxToleranceMinor: 0,
}

let keyCounter = 0
const nextKey = () => `p2p-key-${String(++keyCounter).padStart(6, '0')}`
let supplierNumber = 0
const nextSupplierNumber = () => `SI-${String(++supplierNumber).padStart(5, '0')}`

function only(auth: AuthContext, ...granted: string[]): AuthContext {
  return { ...auth, permissions: new Set(granted) }
}

function without(auth: AuthContext, ...removed: string[]): AuthContext {
  return { ...auth, permissions: new Set([...auth.permissions].filter((permission) => !removed.includes(permission))) }
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

async function count(sql: string, params: unknown[]): Promise<number> {
  const result = await pg().query<{ n: number }>(sql, params)
  return result.rows[0].n
}

/** What the database holds that an invoice would touch. A failed invoice must leave every number unchanged. */
async function footprint(auth: AuthContext) {
  const read = (table: string) => count(`select count(*)::int as n from ${table} where tenant_id = $1`, [auth.tenantId])
  return {
    invoices: await read('supplier_invoices'),
    invoiceLines: await read('supplier_invoice_lines'),
    entries: await read('journal_entries'),
    entryLines: await read('journal_lines'),
    movements: await read('stock_movements'),
  }
}

async function account(auth: AuthContext, code: string, type: Account['type'], isPostable = true): Promise<Account> {
  return (await createAccount(auth, { code, name: `Account ${code}`, type, parentId: null, isPostable })).data
}

async function world(slug: string, options: { configure?: boolean } = {}): Promise<World> {
  const owner = randomUUID()
  await createUser(owner)
  const auth: AuthContext = { userId: owner, tenantId: await bootstrapTenant(slug, slug, owner), permissions: new Set<string>(allPermissions) }
  const supplier = (await createSupplier(auth, { code: 'GULF', name: 'Gulf Foods', paymentTermsDays: 30, notes: null })).data
  const warehouse = (await createWarehouse(auth, nextKey(), { code: 'MAIN', name: 'Main', location: null, capacity: null, status: 'active' })).body.data
  const item = async (sku: string) =>
    (await createItem(auth, nextKey(), { sku, name: `Item ${sku}`, unit: 'piece', unitCostMinor: 800, sellingPriceMinor: 1500, reorderLevel: 0, isActive: true })).body.data
  const flour = await item('FLOUR')
  const sugar = await item('SUGAR')
  const inventory = await account(auth, '1100', 'asset')
  const payable = await account(auth, '2100', 'liability')
  const tax = await account(auth, '1300', 'asset')
  const header = await account(auth, '1000', 'asset', false)
  await createPeriod(auth, { name: 'FY2026', startsOn: '2026-01-01', endsOn: '2026-12-31' })
  if (options.configure !== false) {
    await updateAccounting(auth, { ...invoiceBasis, version: 0, inventoryAccountId: inventory.id, payableAccountId: payable.id, inputTaxAccountId: tax.id })
  }
  return { auth, supplier, warehouse, flour, sugar, inventory, payable, tax, header }
}

const line = (item: Item, quantity: number, unitCostMinor = 1000, taxRateBps = 0) => ({ itemId: item.id, description: item.name, quantity, unitCostMinor, taxRateBps })

async function approvedOrder(w: World, lines = [line(w.flour, 10), line(w.sugar, 5)]): Promise<PurchaseOrderDetail> {
  const created = (await createOrder(w.auth, nextKey(), { supplierId: w.supplier.id, orderDate: '2026-05-01', expectedDate: null, notes: null, lines })).body.data
  return (await submitOrder(w.auth, created.id, { version: created.version })).data
}

async function receive(w: World, order: PurchaseOrderDetail, quantities: number[]): Promise<PurchaseOrderDetail> {
  const fresh = (await getOrder(w.auth, order.id)).data
  const result = await createReceipt(w.auth, order.id, nextKey(), {
    version: fresh.version,
    warehouseId: w.warehouse.id,
    receiptDate: '2026-05-10',
    notes: null,
    lines: quantities.map((quantity, index) => ({ orderLineId: order.lines[index].id, quantity })).filter((entry) => entry.quantity > 0),
  })
  return result.body.data.order
}

function invoiceBody(order: PurchaseOrderDetail, quantities: number[], extra: Record<string, unknown> = {}) {
  return {
    orderId: order.id,
    supplierInvoiceNumber: nextSupplierNumber(),
    invoiceDate: '2026-05-12',
    currency: 'KWD',
    expectedTotalMinor: null,
    notes: null,
    lines: quantities.map((quantity, index) => ({ orderLineId: order.lines[index].id, quantity })).filter((entry) => entry.quantity > 0),
    ...extra,
  }
}

function invoice(w: World, order: PurchaseOrderDetail, quantities: number[], extra: Record<string, unknown> = {}, key = nextKey()) {
  return createSupplierInvoice(w.auth, key, invoiceBody(order, quantities, extra) as Parameters<typeof createSupplierInvoice>[2])
}

/** Net debit of an account over all posted entries. */
async function balanceOf(auth: AuthContext, accountId: string): Promise<number> {
  const result = await pg().query<{ n: number }>(
    `select coalesce(sum(l.debit_minor - l.credit_minor), 0)::bigint as n
       from journal_lines l join journal_entries e on e.tenant_id = l.tenant_id and e.id = l.entry_id
      where l.tenant_id = $1 and l.account_id = $2 and e.status = 'posted'`,
    [auth.tenantId, accountId]
  )
  return Number(result.rows[0].n)
}

async function stockOf(w: World, item: Item): Promise<number> {
  const result = await pg().query<{ on_hand: number }>(`select on_hand from stock_balances where tenant_id = $1 and item_id = $2 and warehouse_id = $3`, [
    w.auth.tenantId,
    item.id,
    w.warehouse.id,
  ])
  return result.rows[0]?.on_hand ?? 0
}

let a: World
let b: World
let freshAccounts: World

beforeAll(async () => {
  await startDatabase()
  for (const name of [
    'procurement.request.created',
    'procurement.request.submitted',
    'procurement.request.approved',
    'procurement.request.rejected',
    'procurement.request.cancelled',
    'procurement.request.converted',
    'procurement.invoice.posted',
    'procurement.invoice.voided',
    'finance.journal.posted',
    'finance.journal.reversed',
  ]) {
    subscribe(name, (event) => void events.push(event))
  }
  a = await world('p2p-a')
  b = await world('p2p-b')
  freshAccounts = await world('p2p-fresh', { configure: false })
}, 180_000)
afterAll(stopDatabase)

// ---------------------------------------------------------------------------------------------------------------------

describe('accounting settings', () => {
  it('start empty, and an invoice cannot be posted until the accounts are chosen: nothing is written', async () => {
    const w = freshAccounts
    expect((await getAccounting(w.auth)).data).toEqual({
      inventoryAccountId: null,
      payableAccountId: null,
      inputTaxAccountId: null,
      accountingBasis: 'invoice_basis',
      grniAccountId: null,
      ppvAccountId: null,
      costingMethod: 'moving_weighted_average',
      cogsAccountId: null,
      priceToleranceBps: 0,
      taxToleranceMinor: 0,
      version: 0,
    })
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const before = await footprint(w.auth)
    expect(await outcome(invoice(w, order, [4]))).toBe('accounts_not_configured')
    expect(await footprint(w.auth)).toEqual(before)
  })

  it('are validated: types, postable, distinct, existing and the company', async () => {
    const w = freshAccounts
    const base = { ...invoiceBasis, version: 0, inventoryAccountId: w.inventory.id, payableAccountId: w.payable.id, inputTaxAccountId: null }
    expect(await outcome(updateAccounting(w.auth, { ...base, inventoryAccountId: w.payable.id, payableAccountId: w.inventory.id }))).toBe('422:account_type_invalid')
    expect(await outcome(updateAccounting(w.auth, { ...base, payableAccountId: w.tax.id }))).toBe('422:account_type_invalid')
    expect(await outcome(updateAccounting(w.auth, { ...base, inventoryAccountId: w.header.id }))).toBe('422:account_not_postable')
    expect(await outcome(updateAccounting(w.auth, { ...base, inputTaxAccountId: w.inventory.id }))).toBe('422:accounts_not_distinct')
    expect(await outcome(updateAccounting(w.auth, { ...base, inventoryAccountId: randomUUID() }))).toBe('422:account_not_found')
    expect(await outcome(updateAccounting(w.auth, { ...base, inventoryAccountId: b.inventory.id }))).toBe('422:account_not_found')
    expect(await outcome(updateAccounting(w.auth, { ...base, version: 4 }))).toBe('409:version_conflict')
    expect(await outcome(updateAccounting(only(w.auth, 'procurement.invoice.read'), base))).toBe('403:forbidden')
    expect(await outcome(getAccounting(only(w.auth)))).toBe('403:forbidden')
    expect((await getAccounting(w.auth)).data.version).toBe(0)
  })

  it('save with a version, an audit row each time, and the database refuses a wrong account type', async () => {
    const w = freshAccounts
    const saved = await updateAccounting(w.auth, { ...invoiceBasis, version: 0, inventoryAccountId: w.inventory.id, payableAccountId: w.payable.id, inputTaxAccountId: null })
    expect(saved.data).toMatchObject({ inventoryAccountId: w.inventory.id, payableAccountId: w.payable.id, inputTaxAccountId: null, version: 1 })
    const changed = await updateAccounting(w.auth, { ...invoiceBasis, version: 1, inventoryAccountId: w.inventory.id, payableAccountId: w.payable.id, inputTaxAccountId: w.tax.id })
    expect(changed.data.version).toBe(2)
    expect(await outcome(updateAccounting(w.auth, { ...invoiceBasis, version: 1, inventoryAccountId: w.inventory.id, payableAccountId: w.payable.id, inputTaxAccountId: null }))).toBe('409:version_conflict')
    const audit = await pg().query<{ action: string }>(
      `select action from audit_log where tenant_id = $1 and entity = 'procurement_accounting' order by created_at, id`,
      [w.auth.tenantId]
    )
    expect(audit.rows.map((row) => row.action)).toEqual(['create', 'update'])
    expect(await sqlFailure(`update procurement_accounting set inventory_account_id = $2 where tenant_id = $1`, [w.auth.tenantId, w.payable.id])).toContain('asset')
    expect(await sqlFailure(`update procurement_accounting set payable_account_id = $2 where tenant_id = $1`, [w.auth.tenantId, w.inventory.id])).toContain('liability')
    expect(await sqlFailure(`delete from procurement_accounting where tenant_id = $1`, [w.auth.tenantId])).toContain('cannot be deleted')
  })

  it('belong to one company', async () => {
    expect((await getAccounting(b.auth)).data.inventoryAccountId).toBe(b.inventory.id)
    expect((await getAccounting(a.auth)).data.inventoryAccountId).toBe(a.inventory.id)
    expect(await sqlFailure(`update procurement_accounting set inventory_account_id = $2 where tenant_id = $1`, [a.auth.tenantId, b.inventory.id])).not.toBe('ok')
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('purchase requests', () => {
  const requestBody = (w: World) => ({
    neededBy: '2026-06-01',
    reason: 'Stock is low',
    lines: [
      { itemId: w.flour.id, description: 'Flour', quantity: 10 },
      { itemId: w.sugar.id, description: 'Sugar', quantity: 5 },
    ],
  })

  async function submitted(w: World): Promise<PurchaseRequestDetail> {
    const created = (await createRequest(w.auth, nextKey(), requestBody(w))).body.data
    return (await submitRequest(w.auth, created.id, { version: created.version })).data
  }

  async function approvedRequest(w: World): Promise<PurchaseRequestDetail> {
    const request = await submitted(w)
    return (await approveRequest(w.auth, request.id, { version: request.version })).data
  }

  const convertBody = (w: World, request: PurchaseRequestDetail) => ({
    version: request.version,
    supplierId: w.supplier.id,
    orderDate: '2026-05-02',
    expectedDate: null,
    notes: null,
    lines: request.lines.map((entry, index) => ({ requestLineId: entry.id, unitCostMinor: 1000 + index * 250, taxRateBps: index === 0 ? 500 : 0 })),
  })

  it('goes from draft to a draft purchase order: create, edit, submit, approve, convert', async () => {
    const key = nextKey()
    const created = await createRequest(a.auth, key, requestBody(a))
    expect(created.status).toBe(201)
    expect(created.body.data).toMatchObject({ status: 'draft', requestedBy: a.auth.userId, lineCount: 2, version: 1 })

    const replay = await createRequest(a.auth, key, requestBody(a))
    expect(replay.replayed).toBe(true)
    expect(replay.body.data.id).toBe(created.body.data.id)
    expect(await count(`select count(*)::int as n from purchase_requests where tenant_id = $1 and id = $2`, [a.auth.tenantId, created.body.data.id])).toBe(1)
    expect(await outcome(createRequest(a.auth, key, { ...requestBody(a), reason: 'Different' }))).toBe('422:idempotency_key_reused')

    const id = created.body.data.id
    expect(await outcome(updateRequest(a.auth, id, { ...requestBody(a), version: 7 }))).toBe('409:version_conflict')
    const edited = await updateRequest(a.auth, id, { ...requestBody(a), version: 1, lines: [{ itemId: a.flour.id, description: 'Flour', quantity: 20 }, requestBody(a).lines[1]] })
    expect(edited.data).toMatchObject({ version: 2, lineCount: 2 })
    expect(edited.data.lines[0].quantity).toBe(20)

    const submittedRequest = await submitRequest(a.auth, id, { version: 2 })
    expect(submittedRequest.data.status).toBe('submitted')
    expect(await outcome(updateRequest(a.auth, id, { ...requestBody(a), version: 3 }))).toBe('409:request_not_draft')
    expect(await sqlFailure(`update purchase_request_lines set quantity = 99 where request_id = $1`, [id])).toContain('draft purchase request')
    expect(await sqlFailure(`delete from purchase_request_lines where request_id = $1`, [id])).toContain('draft purchase request')
    expect(await sqlFailure(`update purchase_requests set reason = 'edited' where id = $1`, [id])).toContain('draft purchase request')

    const approvedResult = await approveRequest(a.auth, id, { version: 3 })
    expect(approvedResult.data).toMatchObject({ status: 'approved', decidedBy: a.auth.userId })
    expect(await outcome(approveRequest(a.auth, id, { version: 4 }))).toBe('409:request_not_submitted')

    const request = approvedResult.data
    const unpriced = { ...convertBody(a, request), lines: [convertBody(a, request).lines[0]] }
    const ordersBefore = await count(`select count(*)::int as n from purchase_orders where tenant_id = $1`, [a.auth.tenantId])
    expect(await outcome(convertRequest(a.auth, id, nextKey(), unpriced))).toBe('request_line_unpriced')
    expect(await count(`select count(*)::int as n from purchase_orders where tenant_id = $1`, [a.auth.tenantId])).toBe(ordersBefore)

    const convertKey = nextKey()
    const converted = await convertRequest(a.auth, id, convertKey, convertBody(a, request))
    expect(converted.status).toBe(201)
    const { order } = converted.body.data
    expect(converted.body.data).toMatchObject({ status: 'converted', purchaseOrderId: order.id })
    expect(order).toMatchObject({ status: 'draft', supplierId: a.supplier.id, lineCount: 2 })
    expect(order.lines.map((entry) => [entry.itemId, entry.quantity, entry.unitCostMinor, entry.taxRateBps])).toEqual([
      [a.flour.id, 20, 1000, 500],
      [a.sugar.id, 5, 1250, 0],
    ])
    // 20 x 1000 + 5 x 1250 = 26250 net, tax 5% on 20000 = 1000.
    expect(order).toMatchObject({ subtotalMinor: 26250, taxMinor: 1000, totalMinor: 27250 })

    const again = await convertRequest(a.auth, id, convertKey, convertBody(a, request))
    expect(again.replayed).toBe(true)
    expect(await count(`select count(*)::int as n from purchase_orders where tenant_id = $1`, [a.auth.tenantId])).toBe(ordersBefore + 1)
    expect(await outcome(convertRequest(a.auth, id, nextKey(), { ...convertBody(a, request), version: converted.body.data.version }))).toBe('409:request_not_approved')
    expect(await sqlFailure(`update purchase_requests set status = 'approved', purchase_order_id = null, converted_at = null, converted_by = null where id = $1`, [id])).toContain('cannot go from')

    const audit = await pg().query<{ action: string }>(`select action from audit_log where tenant_id = $1 and entity = 'purchase_request' and entity_id = $2`, [a.auth.tenantId, id])
    expect(audit.rows.filter((row) => row.action === 'create')).toHaveLength(1)
    expect(audit.rows.filter((row) => row.action === 'update')).toHaveLength(4)
    const names = events.filter((event) => (event.payload as { requestId?: string }).requestId === id).map((event) => event.name)
    expect(names).toEqual(expect.arrayContaining(['procurement.request.created', 'procurement.request.submitted', 'procurement.request.approved', 'procurement.request.converted']))
    expect(names.filter((name) => name === 'procurement.request.converted')).toHaveLength(1)
  })

  it('can be rejected with a reason, and a rejected request is final', async () => {
    expect(rejectRequestSchema.safeParse({ version: 1, note: '   ' }).success).toBe(false)
    const request = await submitted(a)
    const rejected = await rejectRequest(a.auth, request.id, { version: request.version, note: 'Over budget' })
    expect(rejected.data).toMatchObject({ status: 'rejected', decisionNote: 'Over budget' })
    const version = rejected.data.version
    expect(await outcome(approveRequest(a.auth, request.id, { version }))).toBe('409:request_not_submitted')
    expect(await outcome(rejectRequest(a.auth, request.id, { version, note: 'again' }))).toBe('409:request_not_submitted')
    expect(await outcome(cancelRequest(a.auth, request.id, { version, reason: 'late' }))).toBe('409:request_not_cancellable')
    expect(await outcome(convertRequest(a.auth, request.id, nextKey(), convertBody(a, rejected.data)))).toBe('409:request_not_approved')
    expect(await sqlFailure(`update purchase_requests set status = 'approved' where id = $1`, [request.id])).toContain('cannot go from')
  })

  it('can be cancelled until it becomes an order, with a reason', async () => {
    const draftRequest = (await createRequest(a.auth, nextKey(), requestBody(a))).body.data
    const cancelled = await cancelRequest(a.auth, draftRequest.id, { version: draftRequest.version, reason: 'No longer needed' })
    expect(cancelled.data).toMatchObject({ status: 'cancelled', cancelledReason: 'No longer needed' })
    expect(await outcome(submitRequest(a.auth, draftRequest.id, { version: cancelled.data.version }))).toBe('409:request_not_draft')
    expect(await outcome(cancelRequest(a.auth, draftRequest.id, { version: cancelled.data.version, reason: 'twice' }))).toBe('409:request_not_cancellable')
    const approvedOne = await approvedRequest(a)
    expect((await cancelRequest(a.auth, approvedOne.id, { version: approvedOne.version, reason: 'Changed plan' })).data.status).toBe('cancelled')
  })

  it('need a line to be submitted, and only an active item can be requested', async () => {
    const created = (await createRequest(a.auth, nextKey(), requestBody(a))).body.data
    await pg().query(`delete from purchase_request_lines where request_id = $1`, [created.id])
    expect(await outcome(submitRequest(a.auth, created.id, { version: created.version }))).toBe('23001')
    const inactive = (
      await createItem(a.auth, nextKey(), { sku: 'DORMANT', name: 'Dormant', unit: 'piece', unitCostMinor: 1, sellingPriceMinor: 2, reorderLevel: 0, isActive: true })
    ).body.data
    await updateItem(a.auth, inactive.id, { version: inactive.version, name: inactive.name, unitCostMinor: 1, sellingPriceMinor: 2, reorderLevel: 0, isActive: false })
    expect(await outcome(createRequest(a.auth, nextKey(), { neededBy: null, reason: null, lines: [{ itemId: inactive.id, description: 'x', quantity: 1 }] }))).toBe('422:item_inactive')
  })

  it('check the permission of every step, and conversion needs the order permission too', async () => {
    expect(await outcome(createRequest(only(a.auth, 'procurement.request.read'), nextKey(), requestBody(a)))).toBe('403:forbidden')
    const draftRequest = (await createRequest(a.auth, nextKey(), requestBody(a))).body.data
    expect(await outcome(submitRequest(only(a.auth, 'procurement.request.create'), draftRequest.id, { version: 1 }))).toBe('403:forbidden')
    const request = await submitted(a)
    expect(await outcome(approveRequest(only(a.auth, 'procurement.request.submit'), request.id, { version: request.version }))).toBe('403:forbidden')
    expect(await outcome(rejectRequest(only(a.auth, 'procurement.request.submit'), request.id, { version: request.version, note: 'x' }))).toBe('403:forbidden')
    expect(await outcome(cancelRequest(only(a.auth, 'procurement.request.read'), request.id, { version: request.version, reason: 'x' }))).toBe('403:forbidden')
    expect(await outcome(getRequest(only(a.auth), request.id))).toBe('403:forbidden')
    expect(await outcome(listRequests(only(a.auth), { limit: 10, status: 'all' }))).toBe('403:forbidden')
    const ready = (await approveRequest(a.auth, request.id, { version: request.version })).data
    expect(await outcome(convertRequest(without(a.auth, 'procurement.request.convert'), ready.id, nextKey(), convertBody(a, ready)))).toBe('403:forbidden')
    expect(await outcome(convertRequest(without(a.auth, 'procurement.order.create'), ready.id, nextKey(), convertBody(a, ready)))).toBe('403:forbidden')
    expect((await getRequest(a.auth, ready.id)).data.status).toBe('approved')
  })

  it('are invisible and untouchable from another company', async () => {
    const request = await approvedRequest(a)
    expect(await outcome(getRequest(b.auth, request.id))).toBe('404:request_not_found')
    expect(await outcome(approveRequest(b.auth, request.id, { version: request.version }))).toBe('404:request_not_found')
    expect(await outcome(cancelRequest(b.auth, request.id, { version: request.version, reason: 'x' }))).toBe('404:request_not_found')
    expect(await outcome(convertRequest(b.auth, request.id, nextKey(), convertBody(a, request)))).toBe('404:request_not_found')
    expect((await listRequests(b.auth, { limit: 100, status: 'all' })).data.map((entry) => entry.id)).not.toContain(request.id)
    expect(await outcome(createRequest(b.auth, nextKey(), { neededBy: null, reason: null, lines: [{ itemId: a.flour.id, description: 'x', quantity: 1 }] }))).toBe('422:item_not_found')
    expect(await outcome(convertRequest(a.auth, request.id, nextKey(), { ...convertBody(a, request), supplierId: b.supplier.id }))).toBe('422:supplier_not_found')
    expect((await getRequest(a.auth, request.id)).data.status).toBe('approved')
  })

  it('page by cursor', async () => {
    const first = await listRequests(a.auth, { limit: 2, status: 'all' })
    expect(first.data).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()
    const second = await listRequests(a.auth, { limit: 2, status: 'all', cursor: first.nextCursor ?? undefined })
    expect(second.data[0].number).toBeLessThan(first.data[1].number)
    const onlyApproved = await listRequests(a.auth, { limit: 100, status: 'approved' })
    expect(onlyApproved.data.every((entry) => entry.status === 'approved')).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('supplier invoices', () => {
  it('refuse an order that has not received goods', async () => {
    const order = await approvedOrder(a)
    const before = await footprint(a.auth)
    expect(await outcome(invoice(a, order, [1]))).toBe('409:order_not_invoiceable')
    expect(await footprint(a.auth)).toEqual(before)
  })

  it('bill only what was received: partial receipts, partial invoices, then the rest', async () => {
    const w = await world('p2p-partial')
    const order = await approvedOrder(w, [line(w.flour, 10), line(w.sugar, 5)])
    const afterFirst = await receive(w, order, [6, 0])

    const first = await invoice(w, afterFirst, [4])
    expect(first.status).toBe(201)
    expect(first.body.data).toMatchObject({ status: 'posted', subtotalMinor: 4000, taxMinor: 0, totalMinor: 4000, dueDate: '2026-06-11', currency: 'KWD' })
    expect(first.body.data.lines).toHaveLength(1)

    const before = await footprint(w.auth)
    expect(await outcome(invoice(w, afterFirst, [3]))).toBe('over_invoice')
    expect(await outcome(invoice(w, afterFirst, [0, 1]))).toBe('over_invoice')
    expect(await footprint(w.auth)).toEqual(before)

    expect((await invoice(w, afterFirst, [2])).status).toBe(201)
    expect((await getOrder(w.auth, order.id)).data.lines[0]).toMatchObject({ receivedQuantity: 6, invoicedQuantity: 6 })
    expect(await outcome(invoice(w, afterFirst, [1]))).toBe('over_invoice')

    const afterSecond = await receive(w, order, [4, 5])
    expect(afterSecond.status).toBe('received')
    const rest = await invoice(w, afterSecond, [4, 5])
    expect(rest.body.data.totalMinor).toBe(9000)
    expect((await getOrder(w.auth, order.id)).data.lines.map((entry) => [entry.receivedQuantity, entry.invoicedQuantity])).toEqual([
      [10, 10],
      [5, 5],
    ])
    expect(await outcome(invoice(w, afterSecond, [1]))).toBe('over_invoice')

    // The ledger holds exactly what was billed: 4000 + 2000 + 9000, and stock holds exactly what was received.
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(15000)
    expect(await balanceOf(w.auth, w.payable.id)).toBe(-15000)
    expect(await stockOf(w, w.flour)).toBe(10)
    expect(await stockOf(w, w.sugar)).toBe(5)
  })

  it('post one balanced, traceable journal entry per invoice', async () => {
    const w = await world('p2p-journal')
    const order = await receive(w, await approvedOrder(w, [line(w.flour, 10, 1000, 500)]), [10])
    const posted = (await invoice(w, order, [10], { notes: 'May delivery' })).body.data
    // 10 x 1000 = 10000 net, 5% tax = 500, total 10500.
    expect(posted).toMatchObject({ subtotalMinor: 10000, taxMinor: 500, totalMinor: 10500, notes: 'May delivery', supplierName: 'Gulf Foods' })

    const entry = (await getJournalEntry(w.auth, posted.journalEntryId)).data
    expect(entry).toMatchObject({ status: 'posted', sourceType: 'supplier_invoice', sourceId: posted.id, entryDate: '2026-05-12', totalDebitMinor: 10500, totalCreditMinor: 10500 })
    expect(entry.lines.map((entryLine) => [entryLine.accountCode, entryLine.debitMinor, entryLine.creditMinor])).toEqual([
      ['1100', 10000, 0],
      ['1300', 500, 0],
      ['2100', 0, 10500],
    ])
    expect(await balanceOf(w.auth, w.tax.id)).toBe(500)

    const trial = (await getTrialBalance(w.auth, { to: '2026-12-31' })).data
    expect(trial.balanced).toBe(true)
    expect(trial.totalDebitMinor).toBe(10500)
    expect(trial.totalCreditMinor).toBe(10500)

    const audit = await pg().query<{ action: string; entity: string }>(
      `select entity, action from audit_log where tenant_id = $1 and entity_id in ($2, $3) order by created_at, id`,
      [w.auth.tenantId, posted.id, posted.journalEntryId]
    )
    expect(audit.rows).toEqual(expect.arrayContaining([{ entity: 'supplier_invoice', action: 'create' }, { entity: 'journal_entry', action: 'create' }, { entity: 'journal_entry', action: 'update' }]))
    const names = events.filter((event) => JSON.stringify(event.payload).includes(posted.id) || JSON.stringify(event.payload).includes(posted.journalEntryId)).map((event) => event.name)
    expect(names).toEqual(expect.arrayContaining(['procurement.invoice.posted', 'finance.journal.posted']))
  })

  it('round tax half up once, drop a tax line that rounds to zero, and refuse a zero invoice', async () => {
    const w = await world('p2p-rounding')
    const half = (await createItem(w.auth, nextKey(), { sku: 'HALF', name: 'Half', unit: 'piece', unitCostMinor: 10, sellingPriceMinor: 20, reorderLevel: 0, isActive: true })).body.data
    const half2 = (await createItem(w.auth, nextKey(), { sku: 'HALF2', name: 'Half two', unit: 'piece', unitCostMinor: 9, sellingPriceMinor: 20, reorderLevel: 0, isActive: true })).body.data
    const free = (await createItem(w.auth, nextKey(), { sku: 'FREE', name: 'Free', unit: 'piece', unitCostMinor: 0, sellingPriceMinor: 20, reorderLevel: 0, isActive: true })).body.data
    const order = await receive(w, await approvedOrder(w, [line(half, 1, 10, 500), line(half2, 1, 9, 500), line(free, 3, 0, 500)]), [1, 1, 3])

    // 10 fils at 5% is half a fils: rounds up. 9 fils at 5% is 0.45: rounds to zero on its own.
    const roundedUp = await invoice(w, order, [1])
    expect(roundedUp.body.data).toMatchObject({ subtotalMinor: 10, taxMinor: 1, totalMinor: 11 })
    const roundedDown = await invoice(w, order, [0, 1])
    expect(roundedDown.body.data).toMatchObject({ subtotalMinor: 9, taxMinor: 0, totalMinor: 9 })
    expect((await getJournalEntry(w.auth, roundedDown.body.data.journalEntryId)).data.lines).toHaveLength(2)

    const before = await footprint(w.auth)
    expect(await outcome(invoice(w, order, [0, 0, 3]))).toBe('zero_invoice')
    expect(await footprint(w.auth)).toEqual(before)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(19)
  })

  it('need the input tax account when there is tax, and nothing is written without it', async () => {
    const w = await world('p2p-notax')
    await updateAccounting(w.auth, { ...invoiceBasis, version: 1, inventoryAccountId: w.inventory.id, payableAccountId: w.payable.id, inputTaxAccountId: null })
    const taxed = await receive(w, await approvedOrder(w, [line(w.flour, 5, 1000, 500)]), [5])
    const before = await footprint(w.auth)
    expect(await outcome(invoice(w, taxed, [5]))).toBe('accounts_not_configured')
    expect(await footprint(w.auth)).toEqual(before)
    const plain = await receive(w, await approvedOrder(w, [line(w.sugar, 5, 1000, 0)]), [5])
    expect((await invoice(w, plain, [5])).status).toBe(201)
  })

  it('refuse a currency other than KWD and a supplier total that does not match, writing nothing', async () => {
    const w = await world('p2p-currency')
    const order = await receive(w, await approvedOrder(w, [line(w.flour, 10, 1000, 500)]), [10])
    const before = await footprint(w.auth)
    expect(await outcome(invoice(w, order, [10], { currency: 'USD' }))).toBe('CurrencyMismatchError:Currency mismatch: KWD and USD')
    expect(await outcome(invoice(w, order, [10], { currency: 'usd' }))).toContain('CurrencyMismatchError')
    expect(await outcome(invoice(w, order, [10], { expectedTotalMinor: 10499 }))).toBe('total_mismatch')
    expect(await outcome(invoice(w, order, [10], { expectedTotalMinor: 10501 }))).toBe('total_mismatch')
    expect(await footprint(w.auth)).toEqual(before)
    expect((await invoice(w, order, [10], { expectedTotalMinor: 10500 })).body.data.totalMinor).toBe(10500)
  })

  it('refuse a date with no fiscal period or in a closed one, writing nothing', async () => {
    const w = await world('p2p-period')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const closed = (await createPeriod(w.auth, { name: 'FY2025', startsOn: '2025-01-01', endsOn: '2025-12-31' })).data
    await closePeriod(w.auth, closed.id, { version: closed.version })
    const before = await footprint(w.auth)
    expect(await outcome(invoice(w, order, [1], { invoiceDate: '2025-06-01' }))).toBe('409:period_closed')
    expect(await outcome(invoice(w, order, [1], { invoiceDate: '2030-06-01' }))).toBe('422:no_fiscal_period')
    expect(await footprint(w.auth)).toEqual(before)
    expect((await invoice(w, order, [1])).status).toBe(201)
  })

  it('refuse a supplier invoice number that is already booked, until that invoice is voided', async () => {
    const w = await world('p2p-duplicate')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const first = await invoice(w, order, [2], { supplierInvoiceNumber: 'INV-77/A' })
    const before = await footprint(w.auth)
    expect(await outcome(invoice(w, order, [2], { supplierInvoiceNumber: 'INV-77/A' }))).toBe('409:duplicate_supplier_invoice')
    expect(await outcome(invoice(w, order, [2], { supplierInvoiceNumber: 'inv-77/a' }))).toBe('409:duplicate_supplier_invoice')
    expect(await footprint(w.auth)).toEqual(before)
    const direct = await sqlFailure(
      `update supplier_invoices set supplier_invoice_number = 'X' where id = $1`,
      [first.body.data.id]
    )
    expect(direct).toContain('cannot change')
    await voidSupplierInvoice(w.auth, first.body.data.id, { version: first.body.data.version, reason: 'Wrong number', entryDate: '2026-05-13' })
    expect((await invoice(w, order, [2], { supplierInvoiceNumber: 'INV-77/A' })).status).toBe(201)
  })

  it('are idempotent: one key books once, a different body with the same key is refused', async () => {
    const w = await world('p2p-idem')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const key = nextKey()
    const body = invoiceBody(order, [3])
    const first = await createSupplierInvoice(w.auth, key, body as Parameters<typeof createSupplierInvoice>[2])
    const second = await createSupplierInvoice(w.auth, key, body as Parameters<typeof createSupplierInvoice>[2])
    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    expect(second.body.data.id).toBe(first.body.data.id)
    expect(await count(`select count(*)::int as n from supplier_invoices where tenant_id = $1`, [w.auth.tenantId])).toBe(1)
    expect(await count(`select count(*)::int as n from journal_entries where tenant_id = $1`, [w.auth.tenantId])).toBe(1)
    expect(await outcome(createSupplierInvoice(w.auth, key, { ...body, lines: [{ orderLineId: order.lines[0].id, quantity: 4 }] } as Parameters<typeof createSupplierInvoice>[2]))).toBe('422:idempotency_key_reused')

    const raceKey = nextKey()
    const raceBody = invoiceBody(order, [2]) as Parameters<typeof createSupplierInvoice>[2]
    const race = await Promise.allSettled([createSupplierInvoice(w.auth, raceKey, raceBody), createSupplierInvoice(w.auth, raceKey, raceBody)])
    expect(race.every((entry) => entry.status === 'fulfilled')).toBe(true)
    expect(await count(`select count(*)::int as n from supplier_invoices where tenant_id = $1`, [w.auth.tenantId])).toBe(2)
  })

  it('let only one of two simultaneous invoices take the last quantity', async () => {
    const w = await world('p2p-race')
    const order = await receive(w, await approvedOrder(w, [line(w.flour, 10)]), [10])
    const results = await Promise.allSettled([invoice(w, order, [6]), invoice(w, order, [6])])
    expect(results.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((entry) => entry.status === 'rejected')
    expect((rejected as PromiseRejectedResult).reason).toMatchObject({ code: 'over_invoice' })
    expect(await count(`select coalesce(sum(l.quantity), 0)::int as n from supplier_invoice_lines l where l.tenant_id = $1`, [w.auth.tenantId])).toBe(6)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(6000)
    expect(await balanceOf(w.auth, w.payable.id)).toBe(-6000)
  })

  it('roll back the posted entry and the idempotency key when a failure comes after posting', async () => {
    const w = await world('p2p-atomic')
    const order = await receive(w, await approvedOrder(w, [{ ...line(w.flour, 10), description: 'EXPLODE' }]), [10])
    await pg().exec(`
      create function p2p_test_explode() returns trigger language plpgsql as $$ begin raise exception 'simulated failure after posting'; end; $$;
      create trigger p2p_test_explode before insert on supplier_invoice_lines for each row when (new.description = 'EXPLODE') execute function p2p_test_explode();
    `)
    const key = nextKey()
    const body = invoiceBody(order, [4]) as Parameters<typeof createSupplierInvoice>[2]
    const before = await footprint(w.auth)
    const keysBefore = await count(`select count(*)::int as n from idempotency_keys where tenant_id = $1`, [w.auth.tenantId])
    expect(await outcome(createSupplierInvoice(w.auth, key, body))).toBe('P0001')
    expect(await footprint(w.auth)).toEqual(before)
    expect(await count(`select count(*)::int as n from idempotency_keys where tenant_id = $1`, [w.auth.tenantId])).toBe(keysBefore)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(0)
    await pg().exec(`drop trigger p2p_test_explode on supplier_invoice_lines; drop function p2p_test_explode();`)
    const retried = await createSupplierInvoice(w.auth, key, body)
    expect(retried.replayed).toBe(false)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(4000)
    expect(await count(`select count(*)::int as n from supplier_invoices where tenant_id = $1`, [w.auth.tenantId])).toBe(1)
  })

  it('check the permission of the invoice and of the ledger postings it makes', async () => {
    const w = await world('p2p-perms')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const before = await footprint(w.auth)
    expect(await outcome(createSupplierInvoice(only(w.auth, 'procurement.invoice.read'), nextKey(), invoiceBody(order, [1]) as Parameters<typeof createSupplierInvoice>[2]))).toBe('403:forbidden')
    expect(await outcome(invoice({ ...w, auth: without(w.auth, 'finance.journal.post') }, order, [1]))).toBe('403:forbidden')
    expect(await outcome(invoice({ ...w, auth: without(w.auth, 'finance.journal.create') }, order, [1]))).toBe('403:forbidden')
    expect(await outcome(listSupplierInvoices(only(w.auth, 'procurement.order.read'), { limit: 10, settlement: 'all', status: 'all' }))).toBe('403:forbidden')
    expect(await footprint(w.auth)).toEqual(before)
    const posted = (await invoice(w, order, [1])).body.data
    expect(await outcome(getSupplierInvoice(only(w.auth), posted.id))).toBe('403:forbidden')
    expect(await outcome(voidSupplierInvoice(only(w.auth, 'procurement.invoice.read'), posted.id, { version: posted.version, reason: 'x', entryDate: '2026-05-13' }))).toBe('403:forbidden')
  })

  it('are invisible and unreachable from another company', async () => {
    const w = await world('p2p-iso-a')
    const other = await world('p2p-iso-b')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const posted = (await invoice(w, order, [2])).body.data
    const before = await footprint(other.auth)
    expect(await outcome(invoice(other, order, [1]))).toBe('404:order_not_found')
    expect(await outcome(getSupplierInvoice(other.auth, posted.id))).toBe('404:invoice_not_found')
    expect(await outcome(voidSupplierInvoice(other.auth, posted.id, { version: posted.version, reason: 'x', entryDate: '2026-05-13' }))).toBe('404:invoice_not_found')
    expect((await listSupplierInvoices(other.auth, { limit: 100, settlement: 'all', status: 'all' })).data).toEqual([])
    expect(await footprint(other.auth)).toEqual(before)
    expect((await getSupplierInvoice(w.auth, posted.id)).data.status).toBe('posted')
    expect(await balanceOf(other.auth, other.inventory.id)).toBe(0)
    const direct = await sqlFailure(
      `insert into supplier_invoices (id, tenant_id, number, supplier_id, supplier_name, supplier_invoice_number, order_id, invoice_date, due_date, subtotal_minor, tax_minor, total_minor, journal_entry_id, created_by)
       values ($1, $2, 99, $3, 'x', 'X-1', $4, '2026-05-12', '2026-06-12', 100, 0, 100, $5, $6)`,
      [randomUUID(), other.auth.tenantId, other.supplier.id, order.id, posted.journalEntryId, other.auth.userId]
    )
    expect(direct).not.toBe('ok')
  })

  it('page, filter and show their lines', async () => {
    const w = await world('p2p-list')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    for (let index = 0; index < 3; index += 1) await invoice(w, order, [1])
    const first = await listSupplierInvoices(w.auth, { limit: 2, settlement: 'all', status: 'all' })
    expect(first.data).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()
    const second = await listSupplierInvoices(w.auth, { limit: 2, settlement: 'all', status: 'all', cursor: first.nextCursor ?? undefined })
    expect(second.data).toHaveLength(1)
    expect(second.data[0].number).toBeLessThan(first.data[1].number)
    expect((await listSupplierInvoices(w.auth, { limit: 10, settlement: 'all', status: 'void' })).data).toEqual([])
    expect((await listSupplierInvoices(w.auth, { limit: 10, settlement: 'all', status: 'all', orderId: order.id })).data).toHaveLength(3)
    expect((await listSupplierInvoices(w.auth, { limit: 10, settlement: 'all', status: 'all', supplierId: randomUUID() })).data).toEqual([])
    const detail = (await getSupplierInvoice(w.auth, first.data[0].id)).data
    expect(detail.lines[0]).toMatchObject({ quantity: 1, unitCostMinor: 1000, taxRateBps: 0, orderLineId: order.lines[0].id })
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('voiding a supplier invoice', () => {
  it('reverses the entry, frees the quantity and leaves the ledger and the stock consistent', async () => {
    const w = await world('p2p-void')
    const order = await receive(w, await approvedOrder(w, [line(w.flour, 10, 1000, 500)]), [10])
    const posted = (await invoice(w, order, [10])).body.data
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(10000)

    expect(await outcome(voidSupplierInvoice(w.auth, posted.id, { version: 9, reason: 'Duplicate', entryDate: '2026-05-20' }))).toBe('409:version_conflict')
    const voided = (await voidSupplierInvoice(w.auth, posted.id, { version: posted.version, reason: 'Duplicate', entryDate: '2026-05-20' })).data
    expect(voided).toMatchObject({ status: 'void', voidReason: 'Duplicate', voidedBy: w.auth.userId })
    expect(voided.voidEntryId).not.toBeNull()

    const reversal = (await getJournalEntry(w.auth, voided.voidEntryId as string)).data
    expect(reversal).toMatchObject({ status: 'posted', sourceType: 'reversal', reversesId: posted.journalEntryId, entryDate: '2026-05-20', totalDebitMinor: 10500, totalCreditMinor: 10500 })
    const original = (await getJournalEntry(w.auth, posted.journalEntryId)).data
    expect(original.status).toBe('posted')
    expect(original.reversedById).toBe(voided.voidEntryId)
    for (const accountId of [w.inventory.id, w.payable.id, w.tax.id]) expect(await balanceOf(w.auth, accountId)).toBe(0)
    expect(await stockOf(w, w.flour)).toBe(10)

    expect((await getOrder(w.auth, order.id)).data.lines[0].invoicedQuantity).toBe(0)
    expect(await outcome(voidSupplierInvoice(w.auth, posted.id, { version: voided.version, reason: 'again', entryDate: '2026-05-21' }))).toBe('409:invoice_not_posted')
    const rebooked = await invoice(w, order, [10])
    expect(rebooked.body.data.totalMinor).toBe(10500)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(10000)

    const audit = await pg().query<{ action: string }>(`select action from audit_log where tenant_id = $1 and entity = 'supplier_invoice' and entity_id = $2 order by created_at, id`, [w.auth.tenantId, posted.id])
    expect(audit.rows.map((row) => row.action)).toEqual(['create', 'update'])
    const voidedEvents = events.filter((event) => event.name === 'procurement.invoice.voided' && (event.payload as { invoiceId: string }).invoiceId === posted.id)
    expect(voidedEvents).toHaveLength(1)
    expect(events.some((event) => event.name === 'finance.journal.reversed' && (event.payload as { entryId: string }).entryId === posted.journalEntryId)).toBe(true)
  })

  it('rolls everything back when the reversing date is in a closed period, and when the user may not reverse', async () => {
    const w = await world('p2p-voidfail')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const posted = (await invoice(w, order, [3])).body.data
    const closed = (await createPeriod(w.auth, { name: 'FY2025', startsOn: '2025-01-01', endsOn: '2025-12-31' })).data
    await closePeriod(w.auth, closed.id, { version: closed.version })
    const before = await footprint(w.auth)
    expect(await outcome(voidSupplierInvoice(w.auth, posted.id, { version: posted.version, reason: 'x', entryDate: '2025-06-01' }))).toBe('409:period_closed')
    expect(await outcome(voidSupplierInvoice(w.auth, posted.id, { version: posted.version, reason: 'x', entryDate: '2031-06-01' }))).toBe('422:no_fiscal_period')
    expect(await outcome(voidSupplierInvoice(without(w.auth, 'finance.journal.reverse'), posted.id, { version: posted.version, reason: 'x', entryDate: '2026-05-20' }))).toBe('403:forbidden')
    expect(await outcome(voidSupplierInvoice(without(w.auth, 'finance.journal.post'), posted.id, { version: posted.version, reason: 'x', entryDate: '2026-05-20' }))).toBe('403:forbidden')
    expect(await footprint(w.auth)).toEqual(before)
    const stillPosted = (await getSupplierInvoice(w.auth, posted.id)).data
    expect(stillPosted).toMatchObject({ status: 'posted', version: posted.version })
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(3000)
  })

  it('rolls the reversing entry back when the invoice cannot be marked void', async () => {
    const w = await world('p2p-voidatomic')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const posted = (await invoice(w, order, [3])).body.data
    await pg().exec(`
      create function p2p_test_void_explode() returns trigger language plpgsql as $$ begin raise exception 'simulated failure while voiding'; end; $$;
      create trigger p2p_test_void_explode before update on supplier_invoices for each row when (new.void_reason = 'EXPLODE') execute function p2p_test_void_explode();
    `)
    const before = await footprint(w.auth)
    expect(await outcome(voidSupplierInvoice(w.auth, posted.id, { version: posted.version, reason: 'EXPLODE', entryDate: '2026-05-20' }))).toBe('P0001')
    expect(await footprint(w.auth)).toEqual(before)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(3000)
    await pg().exec(`drop trigger p2p_test_void_explode on supplier_invoices; drop function p2p_test_void_explode();`)
    expect((await voidSupplierInvoice(w.auth, posted.id, { version: posted.version, reason: 'Fixed', entryDate: '2026-05-20' })).data.status).toBe('void')
  })

  it('is the only way to reverse the entry an invoice made', async () => {
    const w = await world('p2p-source')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const posted = (await invoice(w, order, [3])).body.data
    const entry = (await getJournalEntry(w.auth, posted.journalEntryId)).data
    expect(await outcome(reverseJournalEntry(w.auth, entry.id, nextKey(), { version: entry.version, entryDate: '2026-05-20', memo: '' }))).toBe('409:entry_has_source')
    const direct = await sqlFailure(
      `insert into journal_entries (tenant_id, number, entry_date, memo, source_type, reverses_id, created_by) values ($1, 99001, '2026-05-20', 'sneaky', 'reversal', $2, $3)`,
      [w.auth.tenantId, entry.id, w.auth.userId]
    )
    expect(direct).toContain('can only be reversed by voiding the document')
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(3000)
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('database guards on supplier invoices', () => {
  async function postedInvoice(slug: string) {
    const w = await world(slug)
    const order = await receive(w, await approvedOrder(w, [line(w.flour, 10, 1000, 500)]), [10])
    const posted = (await invoice(w, order, [6])).body.data
    return { w, order, posted }
  }

  type RawOptions = { subtotal?: number; tax?: number; total?: number; entryTotal?: number; quantity?: number; supplierId?: string; sourceId?: string; unitCost?: number }

  /** Builds an invoice with raw SQL in one transaction, so each guard can be hit on its own. */
  async function raw(w: World, order: PurchaseOrderDetail, options: RawOptions = {}): Promise<void> {
    const quantity = options.quantity ?? 1
    const subtotal = options.subtotal ?? quantity * 1000
    const tax = options.tax ?? Math.floor((quantity * 1000 * 500 + 5000) / 10000)
    const total = options.total ?? subtotal + tax
    const entryTotal = options.entryTotal ?? total
    const invoiceId = randomUUID()
    const number = 80000 + (keyCounter += 1)
    await pg().transaction(async (tx) => {
      const entry = await tx.query<{ id: string }>(
        `insert into journal_entries (tenant_id, number, entry_date, memo, source_type, source_id, created_by)
         values ($1, $2, '2026-05-12', 'raw', 'supplier_invoice', $3, $4) returning id`,
        [w.auth.tenantId, number, options.sourceId ?? invoiceId, w.auth.userId]
      )
      await tx.query(
        `insert into journal_lines (tenant_id, entry_id, line_no, account_id, debit_minor, credit_minor, created_by) values
           ($1, $2, 1, $3, $4, 0, $8), ($1, $2, 2, $5, $7, 0, $8), ($1, $2, 3, $6, 0, $9, $8)`,
        [w.auth.tenantId, entry.rows[0].id, w.inventory.id, entryTotal - tax, w.tax.id, w.payable.id, tax, w.auth.userId, entryTotal]
      )
      await tx.query(`update journal_entries set status = 'posted', posted_by = $2 where id = $1`, [entry.rows[0].id, w.auth.userId])
      await tx.query(
        `insert into supplier_invoices (id, tenant_id, number, supplier_id, supplier_name, supplier_invoice_number, order_id, invoice_date, due_date, subtotal_minor, tax_minor, total_minor, journal_entry_id, created_by)
         values ($1, $2, $3, $4, 'Gulf Foods', $5, $6, '2026-05-12', '2026-06-11', $7, $8, $9, $10, $11)`,
        [invoiceId, w.auth.tenantId, number, options.supplierId ?? w.supplier.id, `RAW-${number}`, order.id, subtotal, tax, total, entry.rows[0].id, w.auth.userId]
      )
      await tx.query(
        `insert into supplier_invoice_lines (tenant_id, invoice_id, order_id, order_line_id, item_id, line_no, description, quantity, unit_cost_minor, tax_rate_bps, created_by)
         values ($1, $2, $3, $4, $5, 1, 'Flour', $6, $7, 500, $8)`,
        [w.auth.tenantId, invoiceId, order.id, order.lines[0].id, order.lines[0].itemId, quantity, options.unitCost ?? 1000, w.auth.userId]
      )
      await tx.query('set constraints all immediate')
    })
  }

  const failure = async (promise: Promise<unknown>): Promise<string> => {
    try {
      await promise
      return 'ok'
    } catch (error) {
      return (error as Error).message
    }
  }

  it('accept a correct raw invoice, so the failures below are caused by the defect alone', async () => {
    const { w, order } = await postedInvoice('p2p-guard-ok')
    expect(await failure(raw(w, order, { quantity: 2 }))).toBe('ok')
  })

  it('refuse totals that do not match the lines, at commit', async () => {
    const { w, order } = await postedInvoice('p2p-guard-totals')
    // quantity 2 at 1000, 5%: subtotal 2000, tax 100. A subtotal of 1999 or a tax of 99 does not add up.
    expect(await failure(raw(w, order, { quantity: 2, subtotal: 1999, tax: 100, total: 2099 }))).toContain('do not match its lines')
    expect(await failure(raw(w, order, { quantity: 2, tax: 99, total: 2099 }))).toContain('do not match its lines')
  })

  it('refuse an invoice whose total differs from its posted entry, or whose entry is not its own', async () => {
    const { w, order } = await postedInvoice('p2p-guard-entry')
    expect(await failure(raw(w, order, { quantity: 2, entryTotal: 2099 }))).toContain('The invoice entry must debit inventory by the invoice net')
    expect(await failure(raw(w, order, { quantity: 2, sourceId: randomUUID() }))).toContain('needs a posted journal entry that comes from it')
  })

  it('refuse billing past the received quantity or at another price, and another supplier', async () => {
    const { w, order } = await postedInvoice('p2p-guard-qty')
    // 10 were received and 6 are invoiced, so 4 are open.
    expect(await failure(raw(w, order, { quantity: 5 }))).toContain('received and not yet invoiced')
    expect(await failure(raw(w, order, { quantity: 4 }))).toBe('ok')
    expect(await failure(raw(w, order, { quantity: 1 }))).toContain('received and not yet invoiced')
    const cheaper = await postedInvoice('p2p-guard-price')
    expect(await failure(raw(cheaper.w, cheaper.order, { quantity: 1, unitCost: 999, subtotal: 999, tax: 50, total: 1049 }))).toContain('is beyond the price tolerance')
    const fresh = await postedInvoice('p2p-guard-supplier')
    const otherSupplier = (await createSupplier(fresh.w.auth, { code: 'OTHER', name: 'Other', paymentTermsDays: 10, notes: null })).data
    expect(await failure(raw(fresh.w, fresh.order, { quantity: 1, supplierId: otherSupplier.id }))).toContain('must be the supplier of its purchase order')
  })

  it('never let a posted invoice or its lines change, or be deleted, or gain a line later', async () => {
    const { w, posted, order } = await postedInvoice('p2p-guard-final')
    expect(await sqlFailure(`update supplier_invoices set total_minor = total_minor + 1, subtotal_minor = subtotal_minor + 1 where id = $1`, [posted.id])).toContain('cannot change')
    expect(await sqlFailure(`update supplier_invoices set notes = 'edited' where id = $1`, [posted.id])).toContain('cannot change')
    expect(await sqlFailure(`delete from supplier_invoices where id = $1`, [posted.id])).toContain('cannot be deleted')
    expect(await sqlFailure(`update supplier_invoice_lines set quantity = 1 where invoice_id = $1`, [posted.id])).toContain('immutable')
    expect(await sqlFailure(`delete from supplier_invoice_lines where invoice_id = $1`, [posted.id])).toContain('cannot be deleted')
    expect(
      await sqlFailure(
        `insert into supplier_invoice_lines (tenant_id, invoice_id, order_id, order_line_id, item_id, line_no, description, quantity, unit_cost_minor, tax_rate_bps, created_by)
         values ($1, $2, $3, $4, $5, 2, 'Late', 1, 1000, 500, $6)`,
        [w.auth.tenantId, posted.id, order.id, order.lines[0].id, order.lines[0].itemId, w.auth.userId]
      )
    ).toContain('while the invoice is being created')
    expect(await sqlFailure(`update supplier_invoices set status = 'void', void_reason = 'x', voided_at = now(), voided_by = $2, void_entry_id = journal_entry_id where id = $1`, [posted.id, w.auth.userId])).toContain(
      'reverses the invoice entry'
    )
    expect(await sqlFailure(`update journal_entries set memo = 'x' where id = $1`, [posted.journalEntryId])).toContain('cannot change')
    expect(await sqlFailure(`delete from journal_lines where entry_id = $1`, [posted.journalEntryId])).toContain('cannot change')
    expect((await getSupplierInvoice(w.auth, posted.id)).data).toMatchObject({ status: 'posted', totalMinor: posted.totalMinor })
  })

  it('keep one entry per source document', async () => {
    const { w, posted } = await postedInvoice('p2p-guard-once')
    const duplicate = await sqlFailure(
      `insert into journal_entries (tenant_id, number, entry_date, memo, source_type, source_id, created_by) values ($1, 99002, '2026-05-12', 'again', 'supplier_invoice', $2, $3)`,
      [w.auth.tenantId, posted.id, w.auth.userId]
    )
    expect(duplicate).not.toBe('ok')
    expect(await sqlFailure(`insert into journal_entries (tenant_id, number, entry_date, memo, source_type, created_by) values ($1, 99003, '2026-05-12', 'x', 'supplier_invoice', $2)`, [w.auth.tenantId, w.auth.userId])).not.toBe('ok')
    expect(await sqlFailure(`insert into journal_entries (tenant_id, number, entry_date, memo, source_type, source_id, created_by) values ($1, 99004, '2026-05-12', 'x', 'manual', $2, $3)`, [w.auth.tenantId, randomUUID(), w.auth.userId])).not.toBe('ok')
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('the whole cycle, from request to ledger', () => {
  it('runs request, approval, order, partial and full receipt, invoices and a void, with stock and ledger in agreement', async () => {
    const w = await world('p2p-cycle')
    // A purchasing limit makes the order need approval.
    await updateSettings(w.auth, { version: 0, approvalThresholdMinor: 20_000 })

    const request = (
      await createRequest(w.auth, nextKey(), {
        neededBy: '2026-06-01',
        reason: 'Restock',
        lines: [
          { itemId: w.flour.id, description: 'Flour', quantity: 40 },
          { itemId: w.sugar.id, description: 'Sugar', quantity: 20 },
        ],
      })
    ).body.data
    const submittedRequest = (await submitRequest(w.auth, request.id, { version: request.version })).data
    const approvedRequestDetail = (await approveRequest(w.auth, request.id, { version: submittedRequest.version })).data
    const converted = (
      await convertRequest(w.auth, request.id, nextKey(), {
        version: approvedRequestDetail.version,
        supplierId: w.supplier.id,
        orderDate: '2026-05-02',
        expectedDate: '2026-05-20',
        notes: null,
        lines: approvedRequestDetail.lines.map((entry) => ({ requestLineId: entry.id, unitCostMinor: 1000, taxRateBps: 500 })),
      })
    ).body.data
    // 60 x 1000 = 60000 net, 5% tax = 3000, total 63000, above the 20000 limit.
    expect(converted.order).toMatchObject({ status: 'draft', subtotalMinor: 60000, taxMinor: 3000, totalMinor: 63000 })

    const pending = (await submitOrder(w.auth, converted.order.id, { version: converted.order.version })).data
    expect(pending.status).toBe('pending_approval')
    expect(await outcome(receive(w, pending, [1, 0]))).toBe('409:order_not_receivable')
    const approved = (await approveOrder(w.auth, pending.id, { version: pending.version })).data
    expect(approved.status).toBe('approved')

    expect(await outcome(invoice(w, approved, [1]))).toBe('409:order_not_invoiceable')
    const partial = await receive(w, approved, [25, 0])
    expect(partial.status).toBe('partially_received')
    const firstInvoice = (await invoice(w, partial, [25])).body.data
    expect(firstInvoice).toMatchObject({ subtotalMinor: 25000, taxMinor: 1250, totalMinor: 26250 })

    const complete = await receive(w, approved, [15, 20])
    expect(complete.status).toBe('received')
    const secondInvoice = (await invoice(w, complete, [15, 20])).body.data
    expect(secondInvoice).toMatchObject({ subtotalMinor: 35000, taxMinor: 1750, totalMinor: 36750 })
    expect(await outcome(invoice(w, complete, [1]))).toBe('over_invoice')

    expect(await stockOf(w, w.flour)).toBe(40)
    expect(await stockOf(w, w.sugar)).toBe(20)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(60000)
    expect(await balanceOf(w.auth, w.tax.id)).toBe(3000)
    expect(await balanceOf(w.auth, w.payable.id)).toBe(-63000)

    const voided = (await voidSupplierInvoice(w.auth, firstInvoice.id, { version: firstInvoice.version, reason: 'Supplier reissued', entryDate: '2026-05-25' })).data
    expect(voided.status).toBe('void')
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(35000)
    expect(await balanceOf(w.auth, w.payable.id)).toBe(-36750)
    expect(await stockOf(w, w.flour)).toBe(40)

    const reissued = (await invoice(w, complete, [25], {}, nextKey())).body.data
    expect(reissued.totalMinor).toBe(26250)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(60000)

    const trial = (await getTrialBalance(w.auth, { to: '2026-12-31' })).data
    expect(trial.balanced).toBe(true)
    expect(trial.totalDebitMinor).toBe(trial.totalCreditMinor)

    expect((await listSupplierInvoices(w.auth, { limit: 10, settlement: 'all', status: 'posted' })).data).toHaveLength(2)
    expect((await listSupplierInvoices(w.auth, { limit: 10, settlement: 'all', status: 'void' })).data.map((entry) => entry.id)).toEqual([firstInvoice.id])
    // A different company that ran the same cycle shares nothing with this one.
    expect(await balanceOf(a.auth, a.payable.id)).not.toBe(-63000)
  })
})
