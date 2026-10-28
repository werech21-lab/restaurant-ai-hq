import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions } from '@/lib/auth/permissions'
import { withTransaction } from '@/lib/db'
import { createCustomer } from '@/modules/crm'
import { createAccount, createInvoice, createPeriod, submitInvoice, voidInvoice } from '@/modules/finance'
import type { Account } from '@/modules/finance/client'
import { createItem, createWarehouse, receivePurchaseWithin } from '@/modules/inventory'
import type { Item, Warehouse } from '@/modules/inventory/client'
import {
  createOrder,
  createReceipt,
  createReturn,
  createSupplier,
  createSupplierInvoice,
  getOrder,
  submitOrder,
  updateAccounting,
} from '@/modules/procurement'
import type { PurchaseOrderDetail, Supplier } from '@/modules/procurement/client'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

/**
 * Moving weighted average is experimental. These cases run on the in-process database. They are not production approval.
 * PGlite runs one transaction at a time, so the concurrent receipts prove the final average, not a real lock wait.
 */

const pg = () => getPglite()
let keyCounter = 0
const nextKey = () => `val-key-${String(++keyCounter).padStart(6, '0')}`

type Company = {
  auth: AuthContext
  supplier: Supplier
  warehouse: Warehouse
  item: Item
  inventory: Account
  payable: Account
  grni: Account
  ppv: Account
  cogs: Account
  customerId: string
}

async function account(auth: AuthContext, code: string, type: Account['type']): Promise<Account> {
  return (await createAccount(auth, { code, name: code, type, parentId: null, isPostable: true })).data
}

async function company(slug: string, costingMethod: 'moving_weighted_average' | 'order_price'): Promise<Company> {
  const owner = randomUUID()
  await createUser(owner)
  const auth: AuthContext = { userId: owner, tenantId: await bootstrapTenant(slug, slug, owner), permissions: new Set(allPermissions) }
  const supplier = (await createSupplier(auth, { code: 'MILL', name: 'Mill', paymentTermsDays: 30, notes: null })).data
  const warehouse = (await createWarehouse(auth, nextKey(), { code: 'MAIN', name: 'Main', location: null, capacity: null, status: 'active' })).body.data
  const item = (
    await createItem(auth, nextKey(), { sku: 'FLOUR', name: 'Flour', unit: 'piece', unitCostMinor: 800, sellingPriceMinor: 1_500, reorderLevel: 0, isActive: true })
  ).body.data
  const inventory = await account(auth, '1400', 'asset')
  const payable = await account(auth, '2100', 'liability')
  const grni = await account(auth, '2150', 'liability')
  const ppv = await account(auth, '5100', 'expense')
  const cogs = await account(auth, '5200', 'expense')
  await account(auth, '1300', 'asset')
  await createPeriod(auth, { name: 'FY2026', startsOn: '2026-01-01', endsOn: '2026-12-31' })
  const tax = await account(auth, '1310', 'asset')
  await updateAccounting(auth, {
    version: 0,
    inventoryAccountId: inventory.id,
    payableAccountId: payable.id,
    inputTaxAccountId: tax.id,
    accountingBasis: 'receipt_basis',
    grniAccountId: grni.id,
    ppvAccountId: ppv.id,
    costingMethod,
    cogsAccountId: costingMethod === 'moving_weighted_average' ? cogs.id : null,
    priceToleranceBps: 2_000,
    taxToleranceMinor: 0,
  })
  const customerId = (
    await createCustomer(auth, {
      name: 'Cafe',
      customerType: 'company',
      email: null,
      phone: null,
      taxId: null,
      address: null,
      creditLimitMinor: null,
      status: 'active',
      notes: null,
    })
  ).id
  return { auth, supplier, warehouse, item, inventory, payable, grni, ppv, cogs, customerId }
}

async function orderFor(company: Company, quantity: number, unitCostMinor: number): Promise<PurchaseOrderDetail> {
  const created = (
    await createOrder(company.auth, nextKey(), {
      supplierId: company.supplier.id,
      orderDate: '2026-05-01',
      expectedDate: null,
      notes: null,
      lines: [{ itemId: company.item.id, description: 'Flour', quantity, unitCostMinor, taxRateBps: 0 }],
    })
  ).body.data
  return (await submitOrder(company.auth, created.id, { version: created.version })).data
}

async function receive(company: Company, order: PurchaseOrderDetail, quantity: number, key = nextKey()) {
  const fresh = (await getOrder(company.auth, order.id)).data
  return createReceipt(company.auth, order.id, key, {
    version: fresh.version,
    warehouseId: company.warehouse.id,
    receiptDate: '2026-05-02',
    notes: null,
    lines: [{ orderLineId: order.lines[0].id, quantity }],
  })
}

async function count(sql: string, params: unknown[]): Promise<number> {
  return (await pg().query<{ n: number }>(sql, params)).rows[0].n
}

async function balance(auth: AuthContext, accountId: string): Promise<number> {
  const result = await pg().query<{ n: string }>(
    `select coalesce(sum(l.debit_minor - l.credit_minor), 0)::text as n
       from journal_lines l join journal_entries e on e.tenant_id = l.tenant_id and e.id = l.entry_id
      where l.tenant_id = $1 and l.account_id = $2 and e.status = 'posted'`,
    [auth.tenantId, accountId]
  )
  return Number(result.rows[0].n)
}

async function averageOf(auth: AuthContext, itemId: string): Promise<number> {
  return Number((await pg().query<{ n: string }>(`select unit_cost_minor::text as n from items where tenant_id = $1 and id = $2`, [auth.tenantId, itemId])).rows[0].n)
}

async function onHand(auth: AuthContext, itemId: string): Promise<number> {
  return (await pg().query<{ n: number }>(`select current_stock as n from items where tenant_id = $1 and id = $2`, [auth.tenantId, itemId])).rows[0].n
}

let moving: Company
let pinned: Company
let other: Company

beforeAll(async () => {
  await startDatabase()
  moving = await company('val-mwa', 'moving_weighted_average')
  pinned = await company('val-order', 'order_price')
  other = await company('val-other', 'moving_weighted_average')
}, 180_000)
afterAll(stopDatabase)

describe('experimental moving weighted average', () => {
  it('revalues on partial receipts, posts COGS at the average then in force, and does not edit the receipt', async () => {
    const first = await orderFor(moving, 10, 1_000)
    const firstReceipt = await receive(moving, first, 6)
    const receiptEntry = firstReceipt.body.data.journalEntryId
    expect(receiptEntry).toBeTruthy()
    const receiptLines = await pg().query<{ debit: string; credit: string }>(
      `select debit_minor::text as debit, credit_minor::text as credit from journal_lines where tenant_id = $1 and entry_id = $2 order by line_no`,
      [moving.auth.tenantId, receiptEntry]
    )
    expect(await averageOf(moving.auth, moving.item.id)).toBe(1_000)
    await receive(moving, first, 4)
    expect(await onHand(moving.auth, moving.item.id)).toBe(10)
    expect(await averageOf(moving.auth, moving.item.id)).toBe(1_000)

    const second = await orderFor(moving, 10, 3_000)
    await receive(moving, second, 10)
    expect(await onHand(moving.auth, moving.item.id)).toBe(20)
    expect(await averageOf(moving.auth, moving.item.id)).toBe(2_000)
    expect(await balance(moving.auth, moving.inventory.id)).toBe(40_000)

    const draft = (
      await createInvoice(moving.auth, nextKey(), {
        customerId: moving.customerId,
        issueDate: '2026-05-10',
        dueDate: '2026-06-10',
        notes: null,
        lines: [{ description: 'Flour', quantity: 10, unitPriceMinor: 1_500, taxRateBps: 0, itemId: moving.item.id, warehouseId: moving.warehouse.id }],
      })
    ).body.data
    const issued = (await submitInvoice(moving.auth, draft.id, { version: draft.version })).data
    expect(issued.status).toBe('issued')
    expect(await averageOf(moving.auth, moving.item.id)).toBe(2_000)
    expect(await onHand(moving.auth, moving.item.id)).toBe(10)
    expect(await balance(moving.auth, moving.cogs.id)).toBe(20_000)
    expect(await balance(moving.auth, moving.inventory.id)).toBe(20_000)

    const returned = await createReturn(moving.auth, nextKey(), {
      orderId: first.id,
      warehouseId: moving.warehouse.id,
      returnDate: '2026-05-11',
      reason: 'Damaged',
      lines: [{ orderLineId: first.lines[0].id, quantity: 5 }],
    })
    expect(returned.body.data.valueMinor).toBe(5_000)
    expect(await onHand(moving.auth, moving.item.id)).toBe(5)
    expect(await averageOf(moving.auth, moving.item.id)).toBe(3_000)
    expect(await balance(moving.auth, moving.inventory.id)).toBe(15_000)

    const sameReceipt = await pg().query<{ debit: string; credit: string }>(
      `select debit_minor::text as debit, credit_minor::text as credit from journal_lines where tenant_id = $1 and entry_id = $2 order by line_no`,
      [moving.auth.tenantId, receiptEntry]
    )
    expect(sameReceipt.rows).toEqual(receiptLines.rows)

    const billed = await createSupplierInvoice(moving.auth, nextKey(), {
      orderId: second.id,
      supplierInvoiceNumber: 'SI-VAL-1',
      invoiceDate: '2026-05-12',
      currency: 'KWD',
      expectedTotalMinor: null,
      notes: null,
      lines: [{ orderLineId: second.lines[0].id, quantity: 10, unitCostMinor: 3_600, taxRateBps: 0 }],
    })
    expect(billed.body.data.priceVarianceMinor).toBe(6_000)
    expect(await averageOf(moving.auth, moving.item.id)).toBe(3_600)
    expect(await onHand(moving.auth, moving.item.id)).toBe(5)
    expect(await balance(moving.auth, moving.inventory.id)).toBe(18_000)
    expect(await balance(moving.auth, moving.ppv.id)).toBe(3_000)
    expect(await balance(moving.auth, moving.inventory.id)).toBe((await onHand(moving.auth, moving.item.id)) * (await averageOf(moving.auth, moving.item.id)))

    const unbalanced = await count(
      `select count(*)::int as n from journal_entries e
        where e.tenant_id = $1
          and (select coalesce(sum(debit_minor), 0) - coalesce(sum(credit_minor), 0) from journal_lines l where l.tenant_id = e.tenant_id and l.entry_id = e.id) <> 0`,
      [moving.auth.tenantId]
    )
    expect(unbalanced).toBe(0)
    await expect(pg().query(`update item_cost_events set value_delta_minor = 0 where tenant_id = $1`, [moving.auth.tenantId])).rejects.toThrow(/immutable/i)
  })

  it('replays a receipt and a supplier invoice without a second cost event', async () => {
    const eventsBefore = await count(`select count(*)::int as n from item_cost_events where tenant_id = $1`, [moving.auth.tenantId])
    const journalsBefore = await count(`select count(*)::int as n from journal_entries where tenant_id = $1`, [moving.auth.tenantId])
    const purchase = await orderFor(moving, 2, 1_000)
    const key = nextKey()
    const fresh = (await getOrder(moving.auth, purchase.id)).data
    const input = {
      version: fresh.version,
      warehouseId: moving.warehouse.id,
      receiptDate: '2026-05-02',
      notes: null,
      lines: [{ orderLineId: purchase.lines[0].id, quantity: 2 }],
    }
    const first = await createReceipt(moving.auth, purchase.id, key, input)
    const second = await createReceipt(moving.auth, purchase.id, key, input)
    expect(second.replayed).toBe(true)
    expect(second.body.data.id).toBe(first.body.data.id)
    const invoiceKey = nextKey()
    const invoiceInput = {
      orderId: purchase.id,
      supplierInvoiceNumber: 'SI-REPLAY',
      invoiceDate: '2026-05-13',
      currency: 'KWD' as const,
      expectedTotalMinor: null,
      notes: null,
      lines: [{ orderLineId: purchase.lines[0].id, quantity: 2 }],
    }
    await createSupplierInvoice(moving.auth, invoiceKey, invoiceInput)
    const replayed = await createSupplierInvoice(moving.auth, invoiceKey, invoiceInput)
    expect(replayed.replayed).toBe(true)
    const eventsAfter = await count(`select count(*)::int as n from item_cost_events where tenant_id = $1`, [moving.auth.tenantId])
    const journalsAfter = await count(`select count(*)::int as n from journal_entries where tenant_id = $1`, [moving.auth.tenantId])
    expect(eventsAfter - eventsBefore).toBe(1)
    expect(journalsAfter - journalsBefore).toBe(2)
  })

  it('keeps both concurrent receipts in the average', async () => {
    const extra = (
      await createItem(moving.auth, nextKey(), {
        sku: 'SUGAR',
        name: 'Sugar',
        unit: 'piece',
        unitCostMinor: 800,
        sellingPriceMinor: 1_500,
        reorderLevel: 0,
        isActive: true,
      })
    ).body.data
    await Promise.all([
      withTransaction((tx) =>
        receivePurchaseWithin(tx, moving.auth, { warehouseId: moving.warehouse.id, receiptId: randomUUID(), lines: [{ itemId: extra.id, quantity: 10, unitCostMinor: 1_000 }], note: null }, [])
      ),
      withTransaction((tx) =>
        receivePurchaseWithin(tx, moving.auth, { warehouseId: moving.warehouse.id, receiptId: randomUUID(), lines: [{ itemId: extra.id, quantity: 10, unitCostMinor: 3_000 }], note: null }, [])
      ),
    ])
    expect(await onHand(moving.auth, extra.id)).toBe(20)
    expect(await averageOf(moving.auth, extra.id)).toBe(2_000)
  })

  it('voids the sale with a new reversal and restores the issued cost', async () => {
    const draft = (
      await createInvoice(moving.auth, nextKey(), {
        customerId: moving.customerId,
        issueDate: '2026-05-14',
        dueDate: '2026-06-14',
        notes: null,
        lines: [{ description: 'Flour', quantity: 2, unitPriceMinor: 1_500, taxRateBps: 0, itemId: moving.item.id, warehouseId: moving.warehouse.id }],
      })
    ).body.data
    const beforeAverage = await averageOf(moving.auth, moving.item.id)
    const beforeQty = await onHand(moving.auth, moving.item.id)
    const issued = (await submitInvoice(moving.auth, draft.id, { version: draft.version })).data
    expect(await onHand(moving.auth, moving.item.id)).toBe(beforeQty - 2)
    expect(await averageOf(moving.auth, moving.item.id)).toBe(beforeAverage)
    const cogs = await balance(moving.auth, moving.cogs.id)
    const voided = (await voidInvoice(moving.auth, issued.id, { version: issued.version, reason: 'Wrong quantity' })).data
    expect(voided.status).toBe('void')
    expect(await onHand(moving.auth, moving.item.id)).toBe(beforeQty)
    expect(await averageOf(moving.auth, moving.item.id)).toBe(beforeAverage)
    expect(await balance(moving.auth, moving.cogs.id)).toBe(cogs - 2 * beforeAverage)
    const live = await count(
      `select count(*)::int as n from journal_entries e
        where e.tenant_id = $1 and e.source_type = 'sales_cogs' and e.source_id = $2
          and not exists (select 1 from journal_entries r where r.tenant_id = e.tenant_id and r.reverses_id = e.id)`,
      [moving.auth.tenantId, issued.id]
    )
    expect(live).toBe(0)
  })

  it('refuses a sale past the stock on hand and leaves the books untouched', async () => {
    const eventsBefore = await count(`select count(*)::int as n from item_cost_events where tenant_id = $1`, [moving.auth.tenantId])
    const journalsBefore = await count(`select count(*)::int as n from journal_entries where tenant_id = $1 and source_type = 'sales_cogs'`, [moving.auth.tenantId])
    const draft = (
      await createInvoice(moving.auth, nextKey(), {
        customerId: moving.customerId,
        issueDate: '2026-05-15',
        dueDate: '2026-06-15',
        notes: null,
        lines: [{ description: 'Flour', quantity: 1_000, unitPriceMinor: 1_500, taxRateBps: 0, itemId: moving.item.id, warehouseId: moving.warehouse.id }],
      })
    ).body.data
    await expect(submitInvoice(moving.auth, draft.id, { version: draft.version })).rejects.toMatchObject({ code: 'insufficient_stock' })
    expect(await count(`select count(*)::int as n from item_cost_events where tenant_id = $1`, [moving.auth.tenantId])).toBe(eventsBefore)
    expect(await count(`select count(*)::int as n from journal_entries where tenant_id = $1 and source_type = 'sales_cogs'`, [moving.auth.tenantId])).toBe(journalsBefore)
  })

  it('does not post COGS or change the catalogue cost when the company stays on order price', async () => {
    const purchase = await orderFor(pinned, 4, 1_000)
    await receive(pinned, purchase, 4)
    expect(await averageOf(pinned.auth, pinned.item.id)).toBe(800)
    const draft = (
      await createInvoice(pinned.auth, nextKey(), {
        customerId: pinned.customerId,
        issueDate: '2026-05-10',
        dueDate: '2026-06-10',
        notes: null,
        lines: [{ description: 'Flour', quantity: 1, unitPriceMinor: 1_500, taxRateBps: 0, itemId: pinned.item.id, warehouseId: pinned.warehouse.id }],
      })
    ).body.data
    await submitInvoice(pinned.auth, draft.id, { version: draft.version })
    expect(await count(`select count(*)::int as n from journal_entries where tenant_id = $1 and source_type = 'sales_cogs'`, [pinned.auth.tenantId])).toBe(0)
    expect(await count(`select count(*)::int as n from item_cost_events where tenant_id = $1`, [pinned.auth.tenantId])).toBe(0)
    expect(await averageOf(pinned.auth, pinned.item.id)).toBe(800)
  })

  it('keeps another company out of these cost events', async () => {
    expect(await count(`select count(*)::int as n from item_cost_events where tenant_id = $1`, [other.auth.tenantId])).toBe(0)
    expect(await count(`select count(*)::int as n from item_cost_events where tenant_id = $1 and item_id = $2`, [other.auth.tenantId, moving.item.id])).toBe(0)
    const foreign = await pg().query(`select id from items where tenant_id = $1 and id = $2`, [other.auth.tenantId, moving.item.id])
    expect(foreign.rows).toEqual([])
  })
})
