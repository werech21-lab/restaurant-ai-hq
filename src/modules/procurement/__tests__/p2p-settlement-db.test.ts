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

import { createAccount, createJournalEntry, createPeriod, postJournalEntry } from '@/modules/finance'
import type { Account } from '@/modules/finance/client'
import { createItem, createWarehouse } from '@/modules/inventory'
import type { Item, Warehouse } from '@/modules/inventory/client'
import {
  approveRequest,
  convertRequest,
  createCreditNote,
  createOrder,
  createPayment,
  createReceipt,
  createRequest,
  createReturn,
  createSupplier,
  createSupplierInvoice,
  getCreditNote,
  getOrder,
  getPayment,
  getReconciliation,
  getReturn,
  getSupplierInvoice,
  listCreditNotes,
  listPayments,
  listReturns,
  listSupplierInvoices,
  previewMatch,
  submitOrder,
  submitRequest,
  updateAccounting,
  voidCreditNote,
  voidPayment,
  voidSupplierInvoice,
} from '@/modules/procurement'
import type { PurchaseOrderDetail, Supplier, SupplierInvoiceDetail } from '@/modules/procurement/client'

/**
 * Phase 1.4 against the real migrations (0001-0015) in an in-memory database: GRNI on the receipt basis, the three-way match
 * with tolerances, purchase returns, supplier credit notes, supplier payments and their settlement, the reconciliation of the
 * ledger with the documents and the stock, and one test that walks the whole cycle from the purchase request to the payment that
 * settles the invoice. Synthetic data only. PGlite runs one transaction at a time, so the concurrency tests prove the
 * outcome of competing requests (exactly one wins, nothing is lost) but not real parallel locking; that needs a real
 * PostgreSQL and is listed as a production blocker in the phase report.
 */

const pg = () => getPglite()
const events: BusEvent[] = []

type Basis = 'invoice_basis' | 'receipt_basis'

type World = {
  auth: AuthContext
  supplier: Supplier
  warehouse: Warehouse
  otherWarehouse: Warehouse
  flour: Item
  sugar: Item
  inventory: Account
  payable: Account
  tax: Account
  grni: Account
  ppv: Account
  bank: Account
  basis: Basis
}

let keyCounter = 0
const nextKey = () => `p2p-settle-${String(++keyCounter).padStart(6, '0')}`
let documentCounter = 0
const nextDocument = (prefix: string) => `${prefix}-${String(++documentCounter).padStart(5, '0')}`

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

async function count(sql: string, params: unknown[]): Promise<number> {
  const result = await pg().query<{ n: number }>(sql, params)
  return result.rows[0].n
}

/** Everything a settlement document would write. A failed document must leave every number unchanged. */
async function footprint(auth: AuthContext) {
  const read = (table: string) => count(`select count(*)::int as n from ${table} where tenant_id = $1`, [auth.tenantId])
  return {
    entries: await read('journal_entries'),
    entryLines: await read('journal_lines'),
    movements: await read('stock_movements'),
    receipts: await read('goods_receipts'),
    invoices: await read('supplier_invoices'),
    returns: await read('purchase_returns'),
    creditNotes: await read('supplier_credit_notes'),
    payments: await read('supplier_payments'),
    allocations: await read('supplier_payment_allocations'),
  }
}

async function account(auth: AuthContext, code: string, type: Account['type']): Promise<Account> {
  return (await createAccount(auth, { code, name: `Account ${code}`, type, parentId: null, isPostable: true })).data
}

async function world(slug: string, basis: Basis): Promise<World> {
  const owner = randomUUID()
  await createUser(owner)
  const auth: AuthContext = { userId: owner, tenantId: await bootstrapTenant(slug, slug, owner), permissions: new Set<string>(allPermissions) }
  const supplier = (await createSupplier(auth, { code: 'GULF', name: 'Gulf Foods', paymentTermsDays: 30, notes: null })).data
  const warehouse = (await createWarehouse(auth, nextKey(), { code: 'MAIN', name: 'Main', location: null, capacity: null, status: 'active' })).body.data
  const otherWarehouse = (await createWarehouse(auth, nextKey(), { code: 'SECOND', name: 'Second', location: null, capacity: null, status: 'active' })).body.data
  const item = async (sku: string) =>
    (await createItem(auth, nextKey(), { sku, name: `Item ${sku}`, unit: 'piece', unitCostMinor: 800, sellingPriceMinor: 1500, reorderLevel: 0, isActive: true })).body.data
  const flour = await item('FLOUR')
  const sugar = await item('SUGAR')
  const inventory = await account(auth, '1100', 'asset')
  const payable = await account(auth, '2100', 'liability')
  const tax = await account(auth, '1300', 'asset')
  const grni = await account(auth, '2150', 'liability')
  const ppv = await account(auth, '5100', 'expense')
  const bank = await account(auth, '1010', 'asset')
  await createPeriod(auth, { name: 'FY2026', startsOn: '2026-01-01', endsOn: '2026-12-31' })
  await updateAccounting(auth, {
    version: 0,
    inventoryAccountId: inventory.id,
    payableAccountId: payable.id,
    inputTaxAccountId: tax.id,
    accountingBasis: basis,
    grniAccountId: basis === 'receipt_basis' ? grni.id : null,
    ppvAccountId: basis === 'receipt_basis' ? ppv.id : null,
    priceToleranceBps: basis === 'receipt_basis' ? 200 : 0,
    taxToleranceMinor: basis === 'receipt_basis' ? 50 : 0,
  })
  return { auth, supplier, warehouse, otherWarehouse, flour, sugar, inventory, payable, tax, grni, ppv, bank, basis }
}

const line = (item: Item, quantity: number, unitCostMinor = 1000, taxRateBps = 0) => ({ itemId: item.id, description: item.name, quantity, unitCostMinor, taxRateBps })

/** Flour 10 at 1.000 with 5 percent tax, sugar 5 at 2.000 without tax. */
async function approvedOrder(w: World, lines = [line(w.flour, 10, 1000, 500), line(w.sugar, 5, 2000)]): Promise<PurchaseOrderDetail> {
  const created = (await createOrder(w.auth, nextKey(), { supplierId: w.supplier.id, orderDate: '2026-05-01', expectedDate: null, notes: null, lines })).body.data
  return (await submitOrder(w.auth, created.id, { version: created.version })).data
}

async function receiveRaw(w: World, order: PurchaseOrderDetail, quantities: number[], warehouse = w.warehouse) {
  const fresh = (await getOrder(w.auth, order.id)).data
  return createReceipt(w.auth, order.id, nextKey(), {
    version: fresh.version,
    warehouseId: warehouse.id,
    receiptDate: '2026-05-10',
    notes: null,
    lines: quantities.map((quantity, index) => ({ orderLineId: order.lines[index].id, quantity })).filter((entry) => entry.quantity > 0),
  })
}

async function receive(w: World, order: PurchaseOrderDetail, quantities: number[]): Promise<PurchaseOrderDetail> {
  return (await receiveRaw(w, order, quantities)).body.data.order
}

type Bill = { quantity: number; unitCostMinor?: number; taxRateBps?: number }

function invoiceBody(order: PurchaseOrderDetail, bills: Bill[], extra: Record<string, unknown> = {}) {
  return {
    orderId: order.id,
    supplierInvoiceNumber: nextDocument('SI'),
    invoiceDate: '2026-05-12',
    currency: 'KWD',
    expectedTotalMinor: null,
    notes: null,
    lines: bills.map((bill, index) => ({ orderLineId: order.lines[index].id, ...bill })).filter((entry) => entry.quantity > 0),
    ...extra,
  }
}

async function bill(w: World, order: PurchaseOrderDetail, bills: Bill[], extra: Record<string, unknown> = {}): Promise<SupplierInvoiceDetail> {
  const result = await createSupplierInvoice(w.auth, nextKey(), invoiceBody(order, bills, extra) as Parameters<typeof createSupplierInvoice>[2])
  return result.body.data
}

function returnGoods(w: World, order: PurchaseOrderDetail, quantities: number[], extra: { warehouseId?: string; key?: string } = {}) {
  return createReturn(w.auth, extra.key ?? nextKey(), {
    orderId: order.id,
    warehouseId: extra.warehouseId ?? w.warehouse.id,
    returnDate: '2026-05-14',
    reason: 'Damaged on arrival',
    lines: quantities.map((quantity, index) => ({ orderLineId: order.lines[index].id, quantity })).filter((entry) => entry.quantity > 0),
  })
}

function credit(w: World, invoice: SupplierInvoiceDetail, quantities: number[], extra: Record<string, unknown> = {}, key = nextKey()) {
  return createCreditNote(w.auth, key, {
    invoiceId: invoice.id,
    supplierCreditNoteNumber: nextDocument('CN'),
    creditDate: '2026-05-15',
    currency: 'KWD',
    expectedTotalMinor: null,
    reason: 'Goods returned',
    lines: quantities.map((quantity, index) => ({ invoiceLineId: invoice.lines[index].id, quantity })).filter((entry) => entry.quantity > 0),
    ...extra,
  } as Parameters<typeof createCreditNote>[2])
}

let referenceCounter = 0
function pay(w: World, allocations: Array<{ invoice: SupplierInvoiceDetail | { id: string }; amountMinor: number }>, extra: Record<string, unknown> = {}, key = nextKey()) {
  return createPayment(w.auth, key, {
    supplierId: w.supplier.id,
    paymentDate: '2026-05-20',
    amountMinor: allocations.reduce((sum, entry) => sum + entry.amountMinor, 0),
    currency: 'KWD',
    method: 'bank_transfer',
    reference: `TRF-${String(++referenceCounter).padStart(5, '0')}`,
    paidFromAccountId: w.bank.id,
    notes: null,
    allocations: allocations.map((entry) => ({ invoiceId: entry.invoice.id, amountMinor: entry.amountMinor })),
    ...extra,
  } as Parameters<typeof createPayment>[2])
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

async function stockOf(w: World, item: Item, warehouse: Warehouse = w.warehouse): Promise<number> {
  const result = await pg().query<{ on_hand: number }>(`select on_hand from stock_balances where tenant_id = $1 and item_id = $2 and warehouse_id = $3`, [
    w.auth.tenantId,
    item.id,
    warehouse.id,
  ])
  return result.rows[0]?.on_hand ?? 0
}

/** Every posted entry must balance, and no entry may be left as a draft by a procurement document. */
async function unbalancedEntries(auth: AuthContext): Promise<number> {
  return count(
    `select count(*)::int as n from journal_entries e
      where e.tenant_id = $1
        and (select coalesce(sum(l.debit_minor), 0) - coalesce(sum(l.credit_minor), 0) from journal_lines l where l.tenant_id = e.tenant_id and l.entry_id = e.id) <> 0`,
    [auth.tenantId]
  )
}

async function reconciliationOk(w: World): Promise<{ ok: boolean; differences: Record<string, number> }> {
  const report = (await getReconciliation(w.auth)).data
  return { ok: report.ok, differences: Object.fromEntries(report.checks.map((entry) => [entry.key, entry.differenceMinor])) }
}

beforeAll(async () => {
  await startDatabase()
  for (const name of [
    'procurement.receipt.posted',
    'procurement.invoice.posted',
    'procurement.return.posted',
    'procurement.creditnote.posted',
    'procurement.creditnote.voided',
    'procurement.payment.posted',
    'procurement.payment.voided',
    'finance.journal.posted',
  ]) {
    subscribe(name, (event) => void events.push(event))
  }
}, 180_000)
afterAll(stopDatabase)

// ---------------------------------------------------------------------------------------------------------------------

describe('GRNI on the receipt basis', () => {
  it('books every receipt to inventory and GRNI at the order price, and partial receipts add up', async () => {
    const w = await world('p2p-grni', 'receipt_basis')
    const order = await approvedOrder(w)
    const first = (await receiveRaw(w, order, [6, 5])).body.data
    expect(first).toMatchObject({ valueMinor: 16_000, lineCount: 2 })
    expect(first.journalEntryId).not.toBeNull()
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(16_000)
    expect(await balanceOf(w.auth, w.grni.id)).toBe(-16_000)
    const second = (await receiveRaw(w, order, [4, 0])).body.data
    expect(second.valueMinor).toBe(4_000)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(20_000)
    expect(await balanceOf(w.auth, w.grni.id)).toBe(-20_000)
    expect(await stockOf(w, w.flour)).toBe(10)
    expect(await stockOf(w, w.sugar)).toBe(5)
    expect(await unbalancedEntries(w.auth)).toBe(0)
    expect(events.some((event) => event.name === 'procurement.receipt.posted' && (event.payload as { valueMinor?: number }).valueMinor === 16_000)).toBe(true)
  })

  it('books nothing at receipt on the invoice basis, and the entry arrives with the invoice', async () => {
    const w = await world('p2p-invoice-basis', 'invoice_basis')
    const order = await approvedOrder(w)
    const receipt = (await receiveRaw(w, order, [10, 5])).body.data
    expect(receipt).toMatchObject({ valueMinor: 20_000, journalEntryId: null })
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(0)
    expect(await balanceOf(w.auth, w.grni.id)).toBe(0)
    const invoice = await bill(w, order, [{ quantity: 10 }, { quantity: 5 }])
    expect(invoice).toMatchObject({ subtotalMinor: 20_000, taxMinor: 500, totalMinor: 20_500, accountingBasis: 'invoice_basis' })
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(20_000)
    expect(await balanceOf(w.auth, w.payable.id)).toBe(-20_500)
  })

  it('clears GRNI when the invoice arrives, leaving only what is received and not yet billed', async () => {
    const w = await world('p2p-grni-clear', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const invoice = await bill(w, order, [{ quantity: 4 }, { quantity: 0 }])
    expect(invoice).toMatchObject({ subtotalMinor: 4_000, taxMinor: 200, totalMinor: 4_200, priceVarianceMinor: 0, taxVarianceMinor: 0 })
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(20_000)
    expect(await balanceOf(w.auth, w.grni.id)).toBe(-16_000)
    expect(await balanceOf(w.auth, w.payable.id)).toBe(-4_200)
    expect(await balanceOf(w.auth, w.tax.id)).toBe(200)
    expect(await balanceOf(w.auth, w.ppv.id)).toBe(0)
    expect((await reconciliationOk(w)).ok).toBe(true)
  })

  it('refuses to receive on the receipt basis before the accounts are chosen: nothing is written', async () => {
    const owner = randomUUID()
    await createUser(owner)
    const auth: AuthContext = { userId: owner, tenantId: await bootstrapTenant('p2p-grni-bare', 'p2p-grni-bare', owner), permissions: new Set<string>(allPermissions) }
    const supplier = (await createSupplier(auth, { code: 'S', name: 'S', paymentTermsDays: 0, notes: null })).data
    const warehouse = (await createWarehouse(auth, nextKey(), { code: 'W', name: 'W', location: null, capacity: null, status: 'active' })).body.data
    const item = (await createItem(auth, nextKey(), { sku: 'X', name: 'X', unit: 'piece', unitCostMinor: 1, sellingPriceMinor: 2, reorderLevel: 0, isActive: true })).body.data
    const created = (await createOrder(auth, nextKey(), { supplierId: supplier.id, orderDate: '2026-05-01', expectedDate: null, notes: null, lines: [{ itemId: item.id, description: 'X', quantity: 3, unitCostMinor: 10, taxRateBps: 0 }] })).body.data
    const approved = (await submitOrder(auth, created.id, { version: created.version })).data
    const before = await footprint(auth)
    // The company is still on the invoice basis (the default), so a receipt is accepted and books nothing.
    const receipt = await createReceipt(auth, approved.id, nextKey(), { version: approved.version, warehouseId: warehouse.id, receiptDate: '2026-05-10', notes: null, lines: [{ orderLineId: approved.lines[0].id, quantity: 3 }] })
    expect(receipt.body.data.journalEntryId).toBeNull()
    expect((await footprint(auth)).entries).toBe(before.entries)
  })

  it('rolls the receipt back as a whole when the ledger entry cannot be written', async () => {
    const w = await world('p2p-grni-rollback', 'receipt_basis')
    const order = await approvedOrder(w)
    const before = await footprint(w.auth)
    await pg().exec(`
      create function p2p_test_receipt_explode() returns trigger language plpgsql as $$ begin raise exception 'receipt boom'; end; $$;
      create trigger p2p_test_receipt_explode before insert on goods_receipt_lines for each row execute function p2p_test_receipt_explode();`)
    expect(await outcome(receiveRaw(w, order, [3, 0]))).toBe('P0001')
    await pg().exec(`drop trigger p2p_test_receipt_explode on goods_receipt_lines; drop function p2p_test_receipt_explode();`)
    expect(await footprint(w.auth)).toEqual(before)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(0)
    expect(await stockOf(w, w.flour)).toBe(0)
    expect((await receiveRaw(w, order, [3, 0])).status).toBe(201)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(3_000)
  })

  it('refuses to hand-write a receipt whose entry or value does not match its lines', async () => {
    const w = await world('p2p-grni-db', 'receipt_basis')
    const order = await approvedOrder(w)
    const receipt = (await receiveRaw(w, order, [4, 0])).body.data
    expect(await sqlFailure(`update goods_receipts set value_minor = value_minor + 1 where id = $1`, [receipt.id])).not.toBe('ok')
    expect(await sqlFailure(`delete from goods_receipts where id = $1`, [receipt.id])).not.toBe('ok')
    expect(await sqlFailure(`update journal_entries set memo = 'x' where id = $1`, [receipt.journalEntryId])).toContain('cannot change')
    const entryId = receipt.journalEntryId
    expect(entryId).not.toBeNull()
    expect(await sqlFailure(`insert into journal_entries (tenant_id, number, entry_date, memo, source_type, reverses_id, created_by) values ($1, 98001, '2026-05-20', 'sneaky', 'reversal', $2, $3)`, [w.auth.tenantId, entryId, w.auth.userId])).toContain(
      'cannot be reversed'
    )
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('three-way match', () => {
  it('books a price above the order inside the tolerance and puts the variance in its own account', async () => {
    const w = await world('p2p-match-ok', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    // Sugar at 2.040 against an order price of 2.000 is 2 percent, exactly the tolerance.
    const invoice = await bill(w, order, [{ quantity: 0 }, { quantity: 5, unitCostMinor: 2040 }])
    expect(invoice).toMatchObject({ subtotalMinor: 10_200, taxMinor: 0, totalMinor: 10_200, priceVarianceMinor: 200, taxVarianceMinor: 0 })
    expect(invoice.lines[0]).toMatchObject({ unitCostMinor: 2040, poUnitCostMinor: 2000 })
    expect(await balanceOf(w.auth, w.ppv.id)).toBe(200)
    expect(await balanceOf(w.auth, w.grni.id)).toBe(-20_000 + 10_000)
    expect(await balanceOf(w.auth, w.payable.id)).toBe(-10_200)
    expect(await unbalancedEntries(w.auth)).toBe(0)
    expect((await reconciliationOk(w)).ok).toBe(true)
  })

  it('books a price below the order as a credit to the variance account', async () => {
    const w = await world('p2p-match-below', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const invoice = await bill(w, order, [{ quantity: 0 }, { quantity: 5, unitCostMinor: 1980 }])
    expect(invoice).toMatchObject({ subtotalMinor: 9_900, priceVarianceMinor: -100 })
    expect(await balanceOf(w.auth, w.ppv.id)).toBe(-100)
    expect((await reconciliationOk(w)).ok).toBe(true)
  })

  it('blocks a price beyond the tolerance, by one fils, and writes nothing', async () => {
    const w = await world('p2p-match-block', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const before = await footprint(w.auth)
    expect(await outcome(bill(w, order, [{ quantity: 0 }, { quantity: 5, unitCostMinor: 2041 }]))).toBe('price_variance_exceeded')
    expect(await footprint(w.auth)).toEqual(before)
    expect(await outcome(bill(w, order, [{ quantity: 0 }, { quantity: 5, unitCostMinor: 2040 }]))).toBe('ok')
  })

  it('blocks tax beyond the tolerance and accepts it inside, counting only the rate difference', async () => {
    const w = await world('p2p-match-tax', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const before = await footprint(w.auth)
    // 10 x 1.000 at 6 percent is 600 against 500 at the order's 5 percent: a variance of 100, above the 50 allowed.
    expect(await outcome(bill(w, order, [{ quantity: 10, taxRateBps: 600 }, { quantity: 0 }]))).toBe('tax_variance_exceeded')
    expect(await footprint(w.auth)).toEqual(before)
    // 4 x 1.000 at 6 percent is 240 against 200: a variance of 40.
    const invoice = await bill(w, order, [{ quantity: 4, taxRateBps: 600 }, { quantity: 0 }])
    expect(invoice).toMatchObject({ subtotalMinor: 4_000, taxMinor: 240, totalMinor: 4_240, taxVarianceMinor: 40, priceVarianceMinor: 0 })
    expect(await balanceOf(w.auth, w.tax.id)).toBe(240)
    expect((await reconciliationOk(w)).ok).toBe(true)
  })

  it('refuses a total that differs from the one printed on the supplier invoice', async () => {
    const w = await world('p2p-match-total', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const before = await footprint(w.auth)
    expect(await outcome(bill(w, order, [{ quantity: 4 }, { quantity: 0 }], { expectedTotalMinor: 4_201 }))).toMatch(/total/i)
    expect(await footprint(w.auth)).toEqual(before)
    expect((await bill(w, order, [{ quantity: 4 }, { quantity: 0 }], { expectedTotalMinor: 4_200 })).totalMinor).toBe(4_200)
  })

  it('bills partially and refuses to bill more than was received, not yet billed and not returned', async () => {
    const w = await world('p2p-match-partial', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [6, 5])
    expect(await outcome(bill(w, order, [{ quantity: 7 }, { quantity: 0 }]))).toBe('over_invoice')
    await bill(w, order, [{ quantity: 4 }, { quantity: 0 }])
    expect(await outcome(bill(w, order, [{ quantity: 3 }, { quantity: 0 }]))).toBe('over_invoice')
    await bill(w, order, [{ quantity: 2 }, { quantity: 0 }])
    expect(await outcome(bill(w, order, [{ quantity: 1 }, { quantity: 0 }]))).toBe('over_invoice')
    // Goods that went back cannot be billed either.
    await returnGoods(w, order, [0, 2])
    expect(await outcome(bill(w, order, [{ quantity: 0 }, { quantity: 4 }]))).toBe('over_invoice')
    expect(await outcome(bill(w, order, [{ quantity: 0 }, { quantity: 3 }]))).toBe('ok')
  })

  it('previews exactly what the booking decides, writes nothing, and needs the permission to book', async () => {
    const w = await world('p2p-match-preview', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const before = await footprint(w.auth)
    const body = invoiceBody(order, [{ quantity: 0 }, { quantity: 5, unitCostMinor: 2041 }]) as Parameters<typeof previewMatch>[1]
    const blocked = (await previewMatch(w.auth, body)).data
    expect(blocked.status).toBe('blocked')
    expect(blocked.issues.map((issue) => issue.code)).toEqual(['price_variance_exceeded'])
    const allowed = (await previewMatch(w.auth, invoiceBody(order, [{ quantity: 0 }, { quantity: 5, unitCostMinor: 2040 }]) as Parameters<typeof previewMatch>[1])).data
    expect(allowed).toMatchObject({ status: 'within_tolerance', priceVarianceMinor: 200, totalMinor: 10_200, issues: [] })
    expect(await footprint(w.auth)).toEqual(before)
    expect(await outcome(previewMatch(only(w.auth, 'procurement.invoice.read'), body))).toBe('403:forbidden')
  })

  it('refuses a duplicate supplier invoice number and another currency', async () => {
    const w = await world('p2p-match-dup', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    await bill(w, order, [{ quantity: 1 }, { quantity: 0 }], { supplierInvoiceNumber: 'GULF-77' })
    expect(await outcome(bill(w, order, [{ quantity: 1 }, { quantity: 0 }], { supplierInvoiceNumber: 'gulf-77' }))).toBe('409:duplicate_supplier_invoice')
    expect(await outcome(bill(w, order, [{ quantity: 1 }, { quantity: 0 }], { currency: 'USD' }))).toContain('Mismatch')
  })

  it('refuses to hand-write an invoice beyond the price tolerance or whose entry clears the wrong amount', async () => {
    const w = await world('p2p-match-db', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const invoice = await bill(w, order, [{ quantity: 4 }, { quantity: 0 }])
    expect(await sqlFailure(`update supplier_invoices set price_variance_minor = 5 where id = $1`, [invoice.id])).toContain('cannot change')
    expect(await sqlFailure(`update supplier_invoice_lines set unit_cost_minor = 1 where invoice_id = $1`, [invoice.id])).toContain('immutable')
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('purchase returns', () => {
  it('sends goods back: stock goes down, GRNI is debited and inventory credited at the order price', async () => {
    const w = await world('p2p-return', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const result = await returnGoods(w, order, [3, 0])
    expect(result.status).toBe(201)
    expect(result.body.data).toMatchObject({ valueMinor: 3_000, lineCount: 1, totalQuantity: 3, returnDate: '2026-05-14' })
    expect(result.body.data.journalEntryId).not.toBeNull()
    expect(await stockOf(w, w.flour)).toBe(7)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(17_000)
    expect(await balanceOf(w.auth, w.grni.id)).toBe(-17_000)
    expect((await getOrder(w.auth, order.id)).data.lines[0]).toMatchObject({ receivedQuantity: 10, returnedQuantity: 3 })
    expect(await count(`select count(*)::int as n from stock_movements where tenant_id = $1 and reference_id = $2 and quantity = -3`, [w.auth.tenantId, result.body.data.id])).toBe(1)
    expect((await reconciliationOk(w)).ok).toBe(true)
    expect(events.some((event) => event.name === 'procurement.return.posted' && (event.payload as { returnId?: string }).returnId === result.body.data.id)).toBe(true)
  })

  it('on the invoice basis a return moves stock and books nothing: the credit note carries the money', async () => {
    const w = await world('p2p-return-invoice-basis', 'invoice_basis')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const before = await footprint(w.auth)
    const result = await returnGoods(w, order, [3, 0])
    expect(result.body.data).toMatchObject({ valueMinor: 3_000, journalEntryId: null })
    expect((await footprint(w.auth)).entries).toBe(before.entries)
    expect(await stockOf(w, w.flour)).toBe(7)
  })

  it('refuses to return more than was received and not yet returned, by one, and a partial return is allowed', async () => {
    const w = await world('p2p-return-limit', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [6, 0])
    const before = await footprint(w.auth)
    expect(await outcome(returnGoods(w, order, [7, 0]))).toBe('over_return')
    expect(await footprint(w.auth)).toEqual(before)
    await returnGoods(w, order, [4, 0])
    expect(await outcome(returnGoods(w, order, [3, 0]))).toBe('over_return')
    expect(await outcome(returnGoods(w, order, [2, 0]))).toBe('ok')
    expect(await outcome(returnGoods(w, order, [1, 0]))).toBe('over_return')
  })

  it('never takes stock below zero: a warehouse that does not hold the goods stops the whole return', async () => {
    const w = await world('p2p-return-stock', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 0])
    const before = await footprint(w.auth)
    expect(await outcome(returnGoods(w, order, [3, 0], { warehouseId: w.otherWarehouse.id }))).toBe('insufficient_stock')
    expect(await footprint(w.auth)).toEqual(before)
    expect(await stockOf(w, w.flour)).toBe(10)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(10_000)
  })

  it('is idempotent: the same key books once, another body under the same key is refused', async () => {
    const w = await world('p2p-return-idem', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 0])
    const key = nextKey()
    const first = await returnGoods(w, order, [2, 0], { key })
    const replay = await returnGoods(w, order, [2, 0], { key })
    expect(replay.replayed).toBe(true)
    expect(replay.body.data.id).toBe(first.body.data.id)
    expect(await outcome(returnGoods(w, order, [3, 0], { key }))).toBe('422:idempotency_key_reused')
    expect(await stockOf(w, w.flour)).toBe(8)
    expect(await count(`select count(*)::int as n from purchase_returns where tenant_id = $1`, [w.auth.tenantId])).toBe(1)
  })

  it('rolls everything back when the stock movement cannot be written', async () => {
    const w = await world('p2p-return-rollback', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 0])
    const before = await footprint(w.auth)
    await pg().exec(`
      create function p2p_test_return_explode() returns trigger language plpgsql as $$ begin if new.quantity < 0 then raise exception 'return boom'; end if; return new; end; $$;
      create trigger p2p_test_return_explode before insert on stock_movements for each row execute function p2p_test_return_explode();`)
    expect(await outcome(returnGoods(w, order, [2, 0]))).toBe('P0001')
    await pg().exec(`drop trigger p2p_test_return_explode on stock_movements; drop function p2p_test_return_explode();`)
    expect(await footprint(w.auth)).toEqual(before)
    expect(await balanceOf(w.auth, w.grni.id)).toBe(-10_000)
    expect((await getOrder(w.auth, order.id)).data.lines[0].returnedQuantity).toBe(0)
  })

  it('needs its permission, lists with a cursor and is isolated between companies', async () => {
    const w = await world('p2p-return-iso', 'receipt_basis')
    const other = await world('p2p-return-iso-b', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    expect(await outcome(createReturn(only(w.auth, 'procurement.return.read'), nextKey(), { orderId: order.id, warehouseId: w.warehouse.id, returnDate: '2026-05-14', reason: 'x', lines: [{ orderLineId: order.lines[0].id, quantity: 1 }] }))).toBe(
      '403:forbidden'
    )
    const first = (await returnGoods(w, order, [1, 0])).body.data
    await returnGoods(w, order, [0, 1])
    await returnGoods(w, order, [1, 0])
    const page = await listReturns(w.auth, { limit: 2 })
    expect(page.data).toHaveLength(2)
    const rest = await listReturns(w.auth, { limit: 2, cursor: page.nextCursor ?? undefined })
    expect(rest.data).toHaveLength(1)
    expect((await listReturns(w.auth, { limit: 10, orderId: order.id })).data).toHaveLength(3)
    expect((await getReturn(w.auth, first.id)).data.lines).toHaveLength(1)
    expect(await outcome(getReturn(other.auth, first.id))).toBe('404:return_not_found')
    expect((await listReturns(other.auth, { limit: 10 })).data).toEqual([])
    expect(await outcome(returnGoods(other, order, [1, 0]))).toBe('404:order_not_found')
  })

  it('cannot be changed or deleted after it is posted', async () => {
    const w = await world('p2p-return-final', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 0])
    const posted = (await returnGoods(w, order, [2, 0])).body.data
    expect(await sqlFailure(`update purchase_returns set reason = 'edited' where id = $1`, [posted.id])).not.toBe('ok')
    expect(await sqlFailure(`delete from purchase_returns where id = $1`, [posted.id])).not.toBe('ok')
    expect(await sqlFailure(`update purchase_return_lines set quantity = 1 where return_id = $1`, [posted.id])).not.toBe('ok')
    expect(await sqlFailure(`delete from purchase_return_lines where return_id = $1`, [posted.id])).not.toBe('ok')
    expect(await sqlFailure(`update purchase_order_lines set returned_quantity = 0 where order_id = $1`, [order.id])).toContain('only goes up')
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('supplier credit notes', () => {
  /** Flour 10 received and billed (10,500 with tax), 3 returned. */
  async function billedAndReturned(slug: string, basis: Basis) {
    const w = await world(slug, basis)
    const order = await receive(w, await approvedOrder(w), [10, 0])
    const invoice = await bill(w, order, [{ quantity: 10 }, { quantity: 0 }])
    const returned = (await returnGoods(w, order, [3, 0])).body.data
    return { w, order, invoice, returned }
  }

  it('cancels the billed value of returned goods: GRNI is credited, tax reversed, the balance falls', async () => {
    const { w, invoice } = await billedAndReturned('p2p-credit-receipt', 'receipt_basis')
    const result = await credit(w, invoice, [3])
    expect(result.status).toBe(201)
    expect(result.body.data).toMatchObject({ subtotalMinor: 3_000, taxMinor: 150, totalMinor: 3_150, status: 'posted', invoiceId: invoice.id })
    expect(await balanceOf(w.auth, w.grni.id)).toBe(0)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(7_000)
    expect(await balanceOf(w.auth, w.payable.id)).toBe(-7_350)
    expect(await balanceOf(w.auth, w.tax.id)).toBe(350)
    const reloaded = (await getSupplierInvoice(w.auth, invoice.id)).data
    expect(reloaded).toMatchObject({ creditedMinor: 3_150, paidMinor: 0, balanceMinor: 7_350, paymentStatus: 'unpaid' })
    expect(reloaded.lines[0].creditedQuantity).toBe(3)
    expect(await unbalancedEntries(w.auth)).toBe(0)
    expect((await reconciliationOk(w)).ok).toBe(true)
    expect(events.some((event) => event.name === 'procurement.creditnote.posted' && (event.payload as { creditNoteId?: string }).creditNoteId === result.body.data.id)).toBe(true)
  })

  it('credits inventory on the invoice basis and keeps the ledger equal to billed net minus credited net', async () => {
    const { w, invoice } = await billedAndReturned('p2p-credit-invoice-basis', 'invoice_basis')
    await credit(w, invoice, [3])
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(7_000)
    expect(await balanceOf(w.auth, w.payable.id)).toBe(-7_350)
    expect(await balanceOf(w.auth, w.grni.id)).toBe(0)
    expect((await reconciliationOk(w)).ok).toBe(true)
  })

  it('reverses a price variance at the billed price, so GRNI clears exactly and the variance is undone', async () => {
    const w = await world('p2p-credit-variance', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const invoice = await bill(w, order, [{ quantity: 0 }, { quantity: 5, unitCostMinor: 2040 }])
    await returnGoods(w, order, [0, 2])
    const note = (await credit(w, invoice, [2])).body.data
    expect(note).toMatchObject({ subtotalMinor: 4_080, taxMinor: 0, totalMinor: 4_080 })
    // Billed 5 at 2.040 (variance 200); 2 credited at 2.040 reverses 80 of it.
    expect(await balanceOf(w.auth, w.ppv.id)).toBe(120)
    expect(await balanceOf(w.auth, w.payable.id)).toBe(-6_120)
    expect((await reconciliationOk(w)).ok).toBe(true)
  })

  it('refuses a credit for goods that did not go back, or more than went back, and writes nothing', async () => {
    const { w, invoice } = await billedAndReturned('p2p-credit-limit', 'receipt_basis')
    const before = await footprint(w.auth)
    expect(await outcome(credit(w, invoice, [4]))).toBe('over_credit')
    expect(await footprint(w.auth)).toEqual(before)
    await credit(w, invoice, [2])
    expect(await outcome(credit(w, invoice, [2]))).toBe('over_credit')
    expect(await outcome(credit(w, invoice, [1]))).toBe('ok')
    const fresh = await world('p2p-credit-none', 'receipt_basis')
    const order = await receive(fresh, await approvedOrder(fresh), [10, 0])
    const billed = await bill(fresh, order, [{ quantity: 10 }, { quantity: 0 }])
    expect(await outcome(credit(fresh, billed, [1]))).toBe('over_credit')
  })

  it('refuses a credit above the open balance once the invoice is paid, and credits what is still open', async () => {
    const { w, invoice } = await billedAndReturned('p2p-credit-paid', 'receipt_basis')
    await pay(w, [{ invoice, amountMinor: 10_500 }])
    expect(await outcome(credit(w, invoice, [3]))).toBe('409:over_credit')
    const second = await billedAndReturned('p2p-credit-half-paid', 'receipt_basis')
    await pay(second.w, [{ invoice: second.invoice, amountMinor: 7_350 }])
    expect((await credit(second.w, second.invoice, [3])).status).toBe(201)
    expect((await getSupplierInvoice(second.w.auth, second.invoice.id)).data).toMatchObject({ balanceMinor: 0, paymentStatus: 'paid' })
  })

  it('refuses a duplicate supplier credit note number, another currency and a wrong expected total', async () => {
    const { w, invoice } = await billedAndReturned('p2p-credit-dup', 'receipt_basis')
    await credit(w, invoice, [1], { supplierCreditNoteNumber: 'CN-DUP' })
    expect(await outcome(credit(w, invoice, [1], { supplierCreditNoteNumber: 'cn-dup' }))).toBe('409:duplicate_supplier_credit_note')
    expect(await outcome(credit(w, invoice, [1], { currency: 'USD' }))).toContain('Mismatch')
    expect(await outcome(credit(w, invoice, [1], { expectedTotalMinor: 1_051 }))).toMatch(/total/i)
    expect(await outcome(credit(w, invoice, [1], { expectedTotalMinor: 1_050 }))).toBe('ok')
  })

  it('is idempotent and rolls back whole when the entry cannot be written', async () => {
    const { w, invoice } = await billedAndReturned('p2p-credit-idem', 'receipt_basis')
    const key = nextKey()
    const first = await credit(w, invoice, [1], { supplierCreditNoteNumber: 'CN-IDEM' }, key)
    const replay = await credit(w, invoice, [1], { supplierCreditNoteNumber: 'CN-IDEM' }, key)
    expect(replay.replayed).toBe(true)
    expect(replay.body.data.id).toBe(first.body.data.id)
    expect(await count(`select count(*)::int as n from supplier_credit_notes where tenant_id = $1`, [w.auth.tenantId])).toBe(1)
    const before = await footprint(w.auth)
    await pg().exec(`
      create function p2p_test_credit_explode() returns trigger language plpgsql as $$ begin raise exception 'credit boom'; end; $$;
      create trigger p2p_test_credit_explode before insert on supplier_credit_note_lines for each row execute function p2p_test_credit_explode();`)
    expect(await outcome(credit(w, invoice, [1]))).toBe('P0001')
    await pg().exec(`drop trigger p2p_test_credit_explode on supplier_credit_note_lines; drop function p2p_test_credit_explode();`)
    expect(await footprint(w.auth)).toEqual(before)
  })

  it('is voided by a reversing entry, which makes the credited goods creditable and the balance whole again', async () => {
    const { w, invoice } = await billedAndReturned('p2p-credit-void', 'receipt_basis')
    const note = (await credit(w, invoice, [3])).body.data
    expect(await outcome(voidCreditNote(w.auth, note.id, { version: 99, reason: 'x', entryDate: '2026-05-25' }))).toBe('409:version_conflict')
    expect(await outcome(voidCreditNote(only(w.auth, 'procurement.creditnote.read'), note.id, { version: note.version, reason: 'x', entryDate: '2026-05-25' }))).toBe('403:forbidden')
    const voided = (await voidCreditNote(w.auth, note.id, { version: note.version, reason: 'Entered twice', entryDate: '2026-05-25' })).data
    expect(voided).toMatchObject({ status: 'void', voidReason: 'Entered twice', voidedBy: w.auth.userId })
    expect(voided.voidEntryId).not.toBeNull()
    expect(await balanceOf(w.auth, w.grni.id)).toBe(3_000)
    expect(await balanceOf(w.auth, w.payable.id)).toBe(-10_500)
    expect((await getSupplierInvoice(w.auth, invoice.id)).data).toMatchObject({ creditedMinor: 0, balanceMinor: 10_500 })
    expect(await outcome(voidCreditNote(w.auth, note.id, { version: voided.version, reason: 'again', entryDate: '2026-05-25' }))).toBe('409:credit_note_not_posted')
    expect(await outcome(credit(w, invoice, [3]))).toBe('ok')
    expect((await reconciliationOk(w)).ok).toBe(true)
    expect(events.some((event) => event.name === 'procurement.creditnote.voided' && (event.payload as { creditNoteId?: string }).creditNoteId === note.id)).toBe(true)
  })

  it('blocks voiding the invoice while a credit note stands, and the credit note can no longer be edited', async () => {
    const { w, invoice } = await billedAndReturned('p2p-credit-final', 'receipt_basis')
    const note = (await credit(w, invoice, [3])).body.data
    const current = (await getSupplierInvoice(w.auth, invoice.id)).data
    expect(await outcome(voidSupplierInvoice(w.auth, invoice.id, { version: current.version, reason: 'x', entryDate: '2026-05-25' }))).toBe('409:invoice_has_credit_notes')
    expect(await sqlFailure(`update supplier_credit_notes set total_minor = 1 where id = $1`, [note.id])).toContain('cannot change')
    expect(await sqlFailure(`delete from supplier_credit_notes where id = $1`, [note.id])).not.toBe('ok')
    expect(await sqlFailure(`update supplier_credit_note_lines set quantity = 1 where credit_note_id = $1`, [note.id])).not.toBe('ok')
    expect(await sqlFailure(`insert into journal_entries (tenant_id, number, entry_date, memo, source_type, reverses_id, created_by) values ($1, 98002, '2026-05-20', 'sneaky', 'reversal', $2, $3)`, [w.auth.tenantId, note.journalEntryId, w.auth.userId])).toContain(
      'can only be reversed by voiding the document'
    )
  })

  it('lists and reads within the company only, and needs the read permission', async () => {
    const { w, invoice } = await billedAndReturned('p2p-credit-list', 'receipt_basis')
    const other = await world('p2p-credit-list-b', 'receipt_basis')
    const note = (await credit(w, invoice, [1])).body.data
    await credit(w, invoice, [1])
    const page = await listCreditNotes(w.auth, { limit: 1, status: 'all' })
    expect(page.data).toHaveLength(1)
    expect((await listCreditNotes(w.auth, { limit: 1, status: 'all', cursor: page.nextCursor ?? undefined })).data).toHaveLength(1)
    expect((await listCreditNotes(w.auth, { limit: 10, status: 'void' })).data).toEqual([])
    expect((await listCreditNotes(w.auth, { limit: 10, status: 'all', invoiceId: invoice.id })).data).toHaveLength(2)
    expect((await getCreditNote(w.auth, note.id)).data.lines).toHaveLength(1)
    expect(await outcome(getCreditNote(other.auth, note.id))).toBe('404:credit_note_not_found')
    expect((await listCreditNotes(other.auth, { limit: 10, status: 'all' })).data).toEqual([])
    expect(await outcome(listCreditNotes(only(w.auth, 'procurement.invoice.read'), { limit: 10, status: 'all' }))).toBe('403:forbidden')
    expect(await outcome(credit(other, invoice, [1]))).toBe('404:invoice_not_found')
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('supplier payments and settlement', () => {
  async function twoInvoices(slug: string, basis: Basis = 'receipt_basis') {
    const w = await world(slug, basis)
    const order = await receive(w, await approvedOrder(w), [10, 5])
    const flour = await bill(w, order, [{ quantity: 10 }, { quantity: 0 }]) // 10,500
    const sugar = await bill(w, order, [{ quantity: 0 }, { quantity: 5 }]) // 10,000
    return { w, order, flour, sugar }
  }

  it('pays an invoice in part, then in full: the status and the balance follow, and the ledger agrees', async () => {
    const { w, flour } = await twoInvoices('p2p-pay-partial')
    const first = (await pay(w, [{ invoice: flour, amountMinor: 4_000 }])).body.data
    expect(first).toMatchObject({ status: 'posted', amountMinor: 4_000, allocationCount: 1, method: 'bank_transfer' })
    expect((await getSupplierInvoice(w.auth, flour.id)).data).toMatchObject({ paidMinor: 4_000, balanceMinor: 6_500, paymentStatus: 'partially_paid' })
    expect(await balanceOf(w.auth, w.bank.id)).toBe(-4_000)
    expect(await balanceOf(w.auth, w.payable.id)).toBe(-20_500 + 4_000)
    expect((await reconciliationOk(w)).ok).toBe(true)
    await pay(w, [{ invoice: flour, amountMinor: 6_500 }])
    expect((await getSupplierInvoice(w.auth, flour.id)).data).toMatchObject({ paidMinor: 10_500, balanceMinor: 0, paymentStatus: 'paid' })
    expect(await balanceOf(w.auth, w.bank.id)).toBe(-10_500)
    expect(await balanceOf(w.auth, w.payable.id)).toBe(-10_000)
    expect((await reconciliationOk(w)).ok).toBe(true)
    expect(events.some((event) => event.name === 'procurement.payment.posted' && (event.payload as { paymentId?: string }).paymentId === first.id)).toBe(true)
  })

  it('settles several invoices with one payment, each within its own balance', async () => {
    const { w, flour, sugar } = await twoInvoices('p2p-pay-multi')
    const payment = (await pay(w, [{ invoice: flour, amountMinor: 10_500 }, { invoice: sugar, amountMinor: 2_500 }])).body.data
    expect(payment).toMatchObject({ amountMinor: 13_000, allocationCount: 2 })
    expect((await getPayment(w.auth, payment.id)).data.allocations.map((entry) => entry.amountMinor).sort((x, y) => x - y)).toEqual([2_500, 10_500])
    expect((await getSupplierInvoice(w.auth, flour.id)).data.paymentStatus).toBe('paid')
    expect((await getSupplierInvoice(w.auth, sugar.id)).data).toMatchObject({ balanceMinor: 7_500, paymentStatus: 'partially_paid' })
    expect((await listSupplierInvoices(w.auth, { limit: 10, status: 'all', settlement: 'open' })).data.map((entry) => entry.id)).toEqual([sugar.id])
    expect((await reconciliationOk(w)).ok).toBe(true)
  })

  it('refuses a payment above a balance by one fils, allocations that do not add up and a payment for nothing', async () => {
    const { w, flour } = await twoInvoices('p2p-pay-limits')
    const before = await footprint(w.auth)
    expect(await outcome(pay(w, [{ invoice: flour, amountMinor: 10_501 }]))).toBe('over_payment')
    expect(await outcome(pay(w, [{ invoice: flour, amountMinor: 1_000 }], { amountMinor: 999 }))).toBe('allocation_mismatch')
    expect(await outcome(pay(w, [{ invoice: flour, amountMinor: 1_000 }], { amountMinor: 1_001 }))).toBe('allocation_mismatch')
    expect(await outcome(pay(w, [{ invoice: flour, amountMinor: 0 }], { amountMinor: 0 }))).toMatch(/zero_amount|amountMinor|422|400/)
    expect(await outcome(pay(w, [{ invoice: flour, amountMinor: -5 }], { amountMinor: -5 }))).toMatch(/zero_amount|amountMinor|422|400/)
    expect(await footprint(w.auth)).toEqual(before)
    expect(await outcome(pay(w, [{ invoice: flour, amountMinor: 10_500 }]))).toBe('ok')
    expect(await outcome(pay(w, [{ invoice: flour, amountMinor: 1 }]))).toBe('over_payment')
  })

  it('refuses another currency, a void invoice, a date before the invoice and an account that is not cash or bank', async () => {
    const { w, flour, sugar } = await twoInvoices('p2p-pay-rules')
    expect(await outcome(pay(w, [{ invoice: flour, amountMinor: 100 }], { currency: 'USD' }))).toContain('Mismatch')
    expect(await outcome(pay(w, [{ invoice: flour, amountMinor: 100 }], { paymentDate: '2026-05-11' }))).toBe('payment_before_invoice')
    expect(await outcome(pay(w, [{ invoice: flour, amountMinor: 100 }], { paidFromAccountId: w.payable.id }))).toBe('422:account_type_invalid')
    expect(await outcome(pay(w, [{ invoice: flour, amountMinor: 100 }], { paidFromAccountId: randomUUID() }))).toBe('422:account_not_found')
    const voidable = await bill(w, await receive(w, await approvedOrder(w), [1, 0]), [{ quantity: 1 }, { quantity: 0 }])
    await voidSupplierInvoice(w.auth, voidable.id, { version: voidable.version, reason: 'Wrong', entryDate: '2026-05-25' })
    expect(await outcome(pay(w, [{ invoice: voidable, amountMinor: 100 }]))).toBe('invoice_not_posted')
    expect(await outcome(pay(w, [{ invoice: sugar, amountMinor: 100 }]))).toBe('ok')
  })

  it('refuses to pay the invoices of another supplier or of another company', async () => {
    const { w, flour } = await twoInvoices('p2p-pay-owner')
    const other = await world('p2p-pay-owner-b', 'receipt_basis')
    const otherSupplier = (await createSupplier(w.auth, { code: 'OTHER', name: 'Other Foods', paymentTermsDays: 10, notes: null })).data
    expect(await outcome(pay({ ...w, supplier: otherSupplier }, [{ invoice: flour, amountMinor: 100 }]))).toBe('supplier_mismatch')
    expect(await outcome(pay(other, [{ invoice: flour, amountMinor: 100 }]))).toBe('invoice_not_found')
    expect(await outcome(pay({ ...other, supplier: w.supplier }, [{ invoice: { id: randomUUID() }, amountMinor: 100 }]))).toBe('422:supplier_not_found')
  })

  it('does not book the same bank reference twice for a supplier, and frees it when the payment is voided', async () => {
    const { w, flour } = await twoInvoices('p2p-pay-reference')
    const first = (await pay(w, [{ invoice: flour, amountMinor: 1_000 }], { reference: 'TRF-777' })).body.data
    const before = await footprint(w.auth)
    expect(await outcome(pay(w, [{ invoice: flour, amountMinor: 1_000 }], { reference: 'trf-777' }))).toBe('409:duplicate_payment_reference')
    expect(await footprint(w.auth)).toEqual(before)
    // The database refuses it as well, whatever the code does.
    expect(await sqlFailure(`update supplier_payments set reference = 'x' where id = $1`, [first.id])).toContain('cannot change')
    await voidPayment(w.auth, first.id, { version: first.version, reason: 'Bounced', entryDate: '2026-05-25' })
    expect(await outcome(pay(w, [{ invoice: flour, amountMinor: 1_000 }], { reference: 'TRF-777' }))).toBe('ok')
  })

  it('books once for one idempotency key and refuses the same key with another body', async () => {
    const { w, flour } = await twoInvoices('p2p-pay-idem')
    const key = nextKey()
    const first = await pay(w, [{ invoice: flour, amountMinor: 2_000 }], { reference: 'TRF-IDEM' }, key)
    const replay = await pay(w, [{ invoice: flour, amountMinor: 2_000 }], { reference: 'TRF-IDEM' }, key)
    expect(replay.replayed).toBe(true)
    expect(replay.body.data.id).toBe(first.body.data.id)
    expect(await outcome(pay(w, [{ invoice: flour, amountMinor: 2_001 }], { reference: 'TRF-IDEM' }, key))).toBe('422:idempotency_key_reused')
    expect(await count(`select count(*)::int as n from supplier_payments where tenant_id = $1`, [w.auth.tenantId])).toBe(1)
    expect(await balanceOf(w.auth, w.bank.id)).toBe(-2_000)
    expect(await count(`select count(*)::int as n from journal_entries where tenant_id = $1 and source_type = 'supplier_payment'`, [w.auth.tenantId])).toBe(1)
  })

  it('voids a payment by reversing its entry: the invoice owes the amount again and the payment is final', async () => {
    const { w, flour } = await twoInvoices('p2p-pay-void')
    const payment = (await pay(w, [{ invoice: flour, amountMinor: 10_500 }])).body.data
    expect((await getSupplierInvoice(w.auth, flour.id)).data.paymentStatus).toBe('paid')
    const current = (await getSupplierInvoice(w.auth, flour.id)).data
    expect(await outcome(voidSupplierInvoice(w.auth, flour.id, { version: current.version, reason: 'x', entryDate: '2026-05-25' }))).toBe('409:invoice_has_payments')
    expect(await outcome(voidPayment(w.auth, payment.id, { version: 99, reason: 'x', entryDate: '2026-05-25' }))).toBe('409:version_conflict')
    expect(await outcome(voidPayment(only(w.auth, 'procurement.payment.read'), payment.id, { version: payment.version, reason: 'x', entryDate: '2026-05-25' }))).toBe('403:forbidden')
    const voided = (await voidPayment(w.auth, payment.id, { version: payment.version, reason: 'Bounced', entryDate: '2026-05-25' })).data
    expect(voided).toMatchObject({ status: 'void', voidReason: 'Bounced' })
    expect((await getSupplierInvoice(w.auth, flour.id)).data).toMatchObject({ paidMinor: 0, balanceMinor: 10_500, paymentStatus: 'unpaid' })
    expect(await balanceOf(w.auth, w.bank.id)).toBe(0)
    expect(await outcome(voidPayment(w.auth, payment.id, { version: voided.version, reason: 'again', entryDate: '2026-05-25' }))).toBe('409:payment_not_posted')
    expect(await sqlFailure(`update supplier_payments set status = 'posted', voided_at = null where id = $1`, [payment.id])).not.toBe('ok')
    expect((await reconciliationOk(w)).ok).toBe(true)
    expect(events.some((event) => event.name === 'procurement.payment.voided' && (event.payload as { paymentId?: string }).paymentId === payment.id)).toBe(true)
  })

  it('rolls the whole payment back when an allocation cannot be written', async () => {
    const { w, flour } = await twoInvoices('p2p-pay-rollback')
    const before = await footprint(w.auth)
    await pg().exec(`
      create function p2p_test_pay_explode() returns trigger language plpgsql as $$ begin raise exception 'pay boom'; end; $$;
      create trigger p2p_test_pay_explode before insert on supplier_payment_allocations for each row execute function p2p_test_pay_explode();`)
    expect(await outcome(pay(w, [{ invoice: flour, amountMinor: 1_000 }]))).toBe('P0001')
    await pg().exec(`drop trigger p2p_test_pay_explode on supplier_payment_allocations; drop function p2p_test_pay_explode();`)
    expect(await footprint(w.auth)).toEqual(before)
    expect(await balanceOf(w.auth, w.bank.id)).toBe(0)
    expect((await getSupplierInvoice(w.auth, flour.id)).data.paidMinor).toBe(0)
  })

  it('lists, reads and isolates payments by company, and needs the read and create permissions', async () => {
    const { w, flour, sugar } = await twoInvoices('p2p-pay-iso')
    const other = await world('p2p-pay-iso-b', 'receipt_basis')
    const first = (await pay(w, [{ invoice: flour, amountMinor: 100 }])).body.data
    await pay(w, [{ invoice: sugar, amountMinor: 100 }])
    const page = await listPayments(w.auth, { limit: 1, status: 'all' })
    expect(page.data).toHaveLength(1)
    expect((await listPayments(w.auth, { limit: 1, status: 'all', cursor: page.nextCursor ?? undefined })).data).toHaveLength(1)
    expect((await listPayments(w.auth, { limit: 10, status: 'void' })).data).toEqual([])
    expect((await listPayments(w.auth, { limit: 10, status: 'all', supplierId: randomUUID() })).data).toEqual([])
    expect(await outcome(getPayment(other.auth, first.id))).toBe('404:payment_not_found')
    expect((await listPayments(other.auth, { limit: 10, status: 'all' })).data).toEqual([])
    expect(await outcome(listPayments(only(w.auth, 'procurement.invoice.read'), { limit: 10, status: 'all' }))).toBe('403:forbidden')
    expect(await outcome(createPayment(only(w.auth, 'procurement.payment.read'), nextKey(), {
      supplierId: w.supplier.id, paymentDate: '2026-05-20', amountMinor: 100, currency: 'KWD', method: 'cash', reference: null, paidFromAccountId: w.bank.id, notes: null, allocations: [{ invoiceId: flour.id, amountMinor: 100 }],
    }))).toBe('403:forbidden')
  })

  it('cannot be changed or deleted after it is posted, and the database refuses an over-allocation', async () => {
    const { w, flour } = await twoInvoices('p2p-pay-db')
    const payment = (await pay(w, [{ invoice: flour, amountMinor: 1_000 }])).body.data
    expect(await sqlFailure(`update supplier_payments set amount_minor = 2000 where id = $1`, [payment.id])).toContain('cannot change')
    expect(await sqlFailure(`delete from supplier_payments where id = $1`, [payment.id])).not.toBe('ok')
    expect(await sqlFailure(`update supplier_payment_allocations set amount_minor = 5 where payment_id = $1`, [payment.id])).not.toBe('ok')
    expect(await sqlFailure(`delete from supplier_payment_allocations where payment_id = $1`, [payment.id])).not.toBe('ok')

    // A hand-written payment that takes more than the open balance is refused by the database itself.
    const paymentId = randomUUID()
    const failure = await sqlFailure(
      `do $$
       declare v_entry uuid; begin
         insert into journal_entries (tenant_id, number, entry_date, memo, source_type, source_id, created_by)
           values ('${w.auth.tenantId}', 97001, '2026-05-20', 'raw', 'supplier_payment', '${paymentId}', '${w.auth.userId}') returning id into v_entry;
         insert into journal_lines (tenant_id, entry_id, line_no, account_id, debit_minor, credit_minor, created_by) values
           ('${w.auth.tenantId}', v_entry, 1, '${w.payable.id}', 99999, 0, '${w.auth.userId}'),
           ('${w.auth.tenantId}', v_entry, 2, '${w.bank.id}', 0, 99999, '${w.auth.userId}');
         update journal_entries set status = 'posted', posted_by = '${w.auth.userId}' where id = v_entry;
         insert into supplier_payments (id, tenant_id, number, supplier_id, supplier_name, payment_date, amount_minor, method, paid_from_account_id, journal_entry_id, created_by)
           values ('${paymentId}', '${w.auth.tenantId}', 97001, '${w.supplier.id}', 'Gulf Foods', '2026-05-20', 99999, 'cash', '${w.bank.id}', v_entry, '${w.auth.userId}');
         insert into supplier_payment_allocations (tenant_id, payment_id, supplier_id, invoice_id, amount_minor, created_by)
           values ('${w.auth.tenantId}', '${paymentId}', '${w.supplier.id}', '${flour.id}', 99999, '${w.auth.userId}');
       end $$`
    )
    expect(failure).toContain('more than the open balance')
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('concurrency', () => {
  it('lets exactly one of two simultaneous payments take the last of a balance', async () => {
    const w = await world('p2p-race-pay', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 0])
    const invoice = await bill(w, order, [{ quantity: 10 }, { quantity: 0 }])
    const results = await Promise.allSettled([pay(w, [{ invoice, amountMinor: 10_500 }]), pay(w, [{ invoice, amountMinor: 10_500 }])])
    const codes = await Promise.all(results.map((result) => outcome(result.status === 'fulfilled' ? Promise.resolve() : Promise.reject(result.reason))))
    expect(codes.filter((code) => code === 'ok')).toHaveLength(1)
    expect(codes.filter((code) => code === 'over_payment')).toHaveLength(1)
    expect(await balanceOf(w.auth, w.bank.id)).toBe(-10_500)
    expect(await count(`select count(*)::int as n from supplier_payments where tenant_id = $1`, [w.auth.tenantId])).toBe(1)
    expect((await getSupplierInvoice(w.auth, invoice.id)).data).toMatchObject({ balanceMinor: 0, paymentStatus: 'paid' })
    expect((await reconciliationOk(w)).ok).toBe(true)
  })

  it('lets exactly one of two simultaneous payments with the same reference book', async () => {
    const w = await world('p2p-race-ref', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 0])
    const invoice = await bill(w, order, [{ quantity: 10 }, { quantity: 0 }])
    const results = await Promise.allSettled([pay(w, [{ invoice, amountMinor: 1_000 }], { reference: 'RACE-1' }), pay(w, [{ invoice, amountMinor: 1_000 }], { reference: 'RACE-1' })])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await count(`select count(*)::int as n from supplier_payments where tenant_id = $1`, [w.auth.tenantId])).toBe(1)
  })

  it('lets exactly one of two simultaneous invoices bill the last received quantity', async () => {
    const w = await world('p2p-race-bill', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [4, 0])
    const results = await Promise.allSettled([bill(w, order, [{ quantity: 4 }, { quantity: 0 }]), bill(w, order, [{ quantity: 4 }, { quantity: 0 }])])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const failed = results.find((result) => result.status === 'rejected') as PromiseRejectedResult
    expect((failed.reason as { code?: string }).code).toBe('over_invoice')
    expect(await balanceOf(w.auth, w.grni.id)).toBe(0)
    expect((await reconciliationOk(w)).ok).toBe(true)
  })

  it('lets exactly one of two simultaneous returns send back the last of the goods', async () => {
    const w = await world('p2p-race-return', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [5, 0])
    const results = await Promise.allSettled([returnGoods(w, order, [5, 0]), returnGoods(w, order, [5, 0])])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await stockOf(w, w.flour)).toBe(0)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(0)
  })

  it('lets a payment and a credit note compete for one balance without ever overdrawing the invoice', async () => {
    const w = await world('p2p-race-credit', 'receipt_basis')
    const order = await receive(w, await approvedOrder(w), [10, 0])
    const invoice = await bill(w, order, [{ quantity: 10 }, { quantity: 0 }])
    await returnGoods(w, order, [3, 0])
    const results = await Promise.allSettled([pay(w, [{ invoice, amountMinor: 10_500 }]), credit(w, invoice, [3])])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const reloaded = (await getSupplierInvoice(w.auth, invoice.id)).data
    expect(reloaded.balanceMinor).toBeGreaterThanOrEqual(0)
    expect(reloaded.paidMinor + reloaded.creditedMinor).toBeLessThanOrEqual(reloaded.totalMinor)
    expect((await reconciliationOk(w)).ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe('the ledger, the stock and the documents agree', () => {
  it('reports no difference on either basis after a full mix of documents, and reports a hand-made entry', async () => {
    for (const basis of ['receipt_basis', 'invoice_basis'] as const) {
      const w = await world(`p2p-recon-${basis.replace('_', '-')}`, basis)
      const order = await receive(w, await approvedOrder(w), [10, 5])
      const invoice = await bill(w, order, [{ quantity: 10 }, { quantity: 5, unitCostMinor: basis === 'receipt_basis' ? 2040 : undefined }])
      await returnGoods(w, order, [3, 1])
      await credit(w, invoice, [3, 1])
      await pay(w, [{ invoice, amountMinor: 5_000 }])
      const report = (await getReconciliation(w.auth)).data
      expect(report.basis).toBe(basis)
      expect(report.checks.every((entry) => entry.ok)).toBe(true)
      expect(report.ok).toBe(true)
      expect(await unbalancedEntries(w.auth)).toBe(0)

      // Inventory in the ledger equals what the warehouse holds, valued at the order price, on the receipt basis.
      if (basis === 'receipt_basis') {
        const held = (await stockOf(w, w.flour)) * 1000 + (await stockOf(w, w.sugar)) * 2000
        expect(await balanceOf(w.auth, w.inventory.id)).toBe(held)
      }

      // A manual journal on the payable account is a difference the report must show, not hide.
      const entry = (
        await createJournalEntry(w.auth, nextKey(), {
          entryDate: '2026-05-21',
          memo: 'Hand-made',
          currency: 'KWD',
          lines: [
            { accountId: w.payable.id, debitMinor: 0, creditMinor: 123, description: '' },
            { accountId: w.bank.id, debitMinor: 123, creditMinor: 0, description: '' },
          ],
        })
      ).body.data
      await postJournalEntry(w.auth, entry.id, { version: entry.version })
      const after = (await getReconciliation(w.auth)).data
      expect(after.ok).toBe(false)
      expect(after.checks.find((check) => check.key === 'payable')).toMatchObject({ ok: false, differenceMinor: 123 })
    }
  })

  it('needs the read permission and stays inside its company', async () => {
    const w = await world('p2p-recon-perm', 'receipt_basis')
    const other = await world('p2p-recon-perm-b', 'receipt_basis')
    await receive(w, await approvedOrder(w), [10, 0])
    expect(await outcome(getReconciliation(only(w.auth, 'procurement.order.read')))).toBe('403:forbidden')
    expect((await getReconciliation(w.auth)).data.checks.find((entry) => entry.key === 'inventory')).toMatchObject({ actualMinor: 10_000, expectedMinor: 10_000 })
    expect((await getReconciliation(other.auth)).data.checks.find((entry) => entry.key === 'inventory')).toMatchObject({ actualMinor: 0, expectedMinor: 0 })
  })
})

// ---------------------------------------------------------------------------------------------------------------------

describe.each(['receipt_basis', 'invoice_basis'] as const)('the whole cycle, from purchase request to payment settlement (%s)', (basis) => {
  it('runs request, order, partial receipts, partial invoices, a return, a credit note and partial payments until the invoices are settled', async () => {
    const w = await world(`p2p-cycle-${basis.replace('_', '-')}`, basis)

    // 1. Purchase request: draft, submit, approve, convert to an order with prices and tax.
    const created = (
      await createRequest(w.auth, nextKey(), {
        neededBy: '2026-06-01',
        reason: 'Weekly stock',
        lines: [
          { itemId: w.flour.id, description: 'Flour', quantity: 10 },
          { itemId: w.sugar.id, description: 'Sugar', quantity: 5 },
        ],
      })
    ).body.data
    const submitted = (await submitRequest(w.auth, created.id, { version: created.version })).data
    const approved = (await approveRequest(w.auth, submitted.id, { version: submitted.version })).data
    const converted = (
      await convertRequest(w.auth, approved.id, nextKey(), {
        version: approved.version,
        supplierId: w.supplier.id,
        orderDate: '2026-05-02',
        expectedDate: null,
        notes: null,
        lines: approved.lines.map((entry, index) => ({ requestLineId: entry.id, unitCostMinor: index === 0 ? 1000 : 2000, taxRateBps: index === 0 ? 500 : 0 })),
      })
    ).body.data
    const draftOrder = (await getOrder(w.auth, converted.order.id)).data
    const order = (await submitOrder(w.auth, draftOrder.id, { version: draftOrder.version })).data
    expect(order.status).toBe('approved')

    // 2. Partial receipts: 6 flour first, then the rest.
    const afterFirst = await receive(w, order, [6, 0])
    expect(afterFirst.status).toBe('partially_received')
    const afterAll = await receive(w, afterFirst, [4, 5])
    expect(afterAll.status).toBe('received')
    expect(await stockOf(w, w.flour)).toBe(10)
    expect(await stockOf(w, w.sugar)).toBe(5)
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(basis === 'receipt_basis' ? 20_000 : 0)

    // 3. Partial invoices: flour 7 now (7,000 + 350 tax), the rest of the goods later.
    const first = await bill(w, afterAll, [{ quantity: 7 }, { quantity: 0 }])
    expect(first).toMatchObject({ subtotalMinor: 7_000, taxMinor: 350, totalMinor: 7_350 })
    const second = await bill(w, afterAll, [{ quantity: 3 }, { quantity: 5 }])
    expect(second).toMatchObject({ subtotalMinor: 13_000, taxMinor: 150, totalMinor: 13_150 })
    expect(await outcome(bill(w, afterAll, [{ quantity: 1 }, { quantity: 0 }]))).toBe('over_invoice')
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(20_000)
    expect(await balanceOf(w.auth, w.grni.id)).toBe(0)
    expect(await balanceOf(w.auth, w.payable.id)).toBe(-20_500)

    // 4. A return of 2 flour and the supplier's credit note for them (billed on the second invoice).
    await returnGoods(w, afterAll, [2, 0])
    expect(await stockOf(w, w.flour)).toBe(8)
    const note = (await credit(w, second, [2])).body.data
    expect(note).toMatchObject({ subtotalMinor: 2_000, taxMinor: 100, totalMinor: 2_100 })
    expect(await balanceOf(w.auth, w.inventory.id)).toBe(18_000)
    expect(await balanceOf(w.auth, w.grni.id)).toBe(0)
    expect(await balanceOf(w.auth, w.payable.id)).toBe(-18_400)
    expect((await reconciliationOk(w)).ok).toBe(true)

    // 5. Partial payments, then the payments that settle both invoices.
    const partial = (await pay(w, [{ invoice: first, amountMinor: 3_000 }])).body.data
    expect((await getSupplierInvoice(w.auth, first.id)).data).toMatchObject({ balanceMinor: 4_350, paymentStatus: 'partially_paid' })
    await pay(w, [{ invoice: first, amountMinor: 4_350 }, { invoice: second, amountMinor: 5_000 }])
    expect((await getSupplierInvoice(w.auth, first.id)).data).toMatchObject({ balanceMinor: 0, paymentStatus: 'paid' })
    expect((await getSupplierInvoice(w.auth, second.id)).data).toMatchObject({ balanceMinor: 6_050, paymentStatus: 'partially_paid' })
    expect(await outcome(pay(w, [{ invoice: second, amountMinor: 6_051 }]))).toBe('over_payment')
    await pay(w, [{ invoice: second, amountMinor: 6_050 }])
    const settled = (await getSupplierInvoice(w.auth, second.id)).data
    expect(settled).toMatchObject({ totalMinor: 13_150, creditedMinor: 2_100, paidMinor: 11_050, balanceMinor: 0, paymentStatus: 'paid' })
    expect((await listSupplierInvoices(w.auth, { limit: 10, status: 'all', settlement: 'open' })).data).toEqual([])

    // 6. The ledger, the stock and the documents agree, every entry balances, and the books show the money that moved.
    expect(await balanceOf(w.auth, w.payable.id)).toBe(0)
    expect(await balanceOf(w.auth, w.bank.id)).toBe(-(3_000 + 4_350 + 5_000 + 6_050))
    expect(await balanceOf(w.auth, w.inventory.id)).toBe((await stockOf(w, w.flour)) * 1000 + (await stockOf(w, w.sugar)) * 2000)
    expect(await balanceOf(w.auth, w.grni.id)).toBe(0)
    expect(await unbalancedEntries(w.auth)).toBe(0)
    const report = (await getReconciliation(w.auth)).data
    expect(report.ok).toBe(true)
    expect(report.checks.map((entry) => entry.differenceMinor)).toEqual(basis === 'receipt_basis' ? [0, 0, 0] : [0, 0])
    expect(await count(`select count(*)::int as n from supplier_invoices i where i.tenant_id = $1 and i.total_minor - (select coalesce(sum(a.amount_minor), 0) from supplier_payment_allocations a join supplier_payments p on p.tenant_id = a.tenant_id and p.id = a.payment_id where a.tenant_id = i.tenant_id and a.invoice_id = i.id and p.status = 'posted') - (select coalesce(sum(c.total_minor), 0) from supplier_credit_notes c where c.tenant_id = i.tenant_id and c.invoice_id = i.id and c.status = 'posted') <> 0`, [w.auth.tenantId])).toBe(0)
    expect(partial.status).toBe('posted')

    // Every document wrote an audit row.
    const audited = await pg().query<{ entity: string }>(`select distinct entity from audit_log where tenant_id = $1`, [w.auth.tenantId])
    for (const entity of ['purchase_return', 'supplier_credit_note', 'supplier_payment', 'supplier_invoice', 'goods_receipt', 'purchase_order']) {
      expect(audited.rows.map((row) => row.entity)).toContain(entity)
    }
  })
})
