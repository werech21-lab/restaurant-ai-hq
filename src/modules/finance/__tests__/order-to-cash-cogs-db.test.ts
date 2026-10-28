import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions } from '@/lib/auth/permissions'
import { acceptQuotation, convertQuotation, createCustomer, createQuotation, sendQuotation } from '@/modules/crm'
import { createAccount, createPeriod, getInvoice, recordPayment } from '@/modules/finance'
import type { Account } from '@/modules/finance/client'
import { createItem, createWarehouse } from '@/modules/inventory'
import type { Item, Warehouse } from '@/modules/inventory/client'
import { createOrder, createReceipt, createSupplier, getOrder, submitOrder, updateAccounting } from '@/modules/procurement'
import type { PurchaseOrderDetail, Supplier } from '@/modules/procurement/client'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

/**
 * One procure-to-pay receipt, then a quotation converted into a sales invoice and a partial collection.
 * Moving weighted average posts COGS. Order price does not. A second company sees none of it.
 */

const pg = () => getPglite()
let keyCounter = 0
const nextKey = () => `otc-key-${String(++keyCounter).padStart(6, '0')}`

type Company = {
  auth: AuthContext
  supplier: Supplier
  warehouse: Warehouse
  item: Item
  inventory: Account
  cogs: Account
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
  const tax = await account(auth, '1310', 'asset')
  await createPeriod(auth, { name: 'FY2026', startsOn: '2026-01-01', endsOn: '2026-12-31' })
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
    priceToleranceBps: 0,
    taxToleranceMinor: 0,
  })
  return { auth, supplier, warehouse, item, inventory, cogs }
}

async function receiveTen(company: Company): Promise<PurchaseOrderDetail> {
  const created = (
    await createOrder(company.auth, nextKey(), {
      supplierId: company.supplier.id,
      orderDate: '2026-05-01',
      expectedDate: null,
      notes: null,
      lines: [{ itemId: company.item.id, description: 'Flour', quantity: 10, unitCostMinor: 1_000, taxRateBps: 0 }],
    })
  ).body.data
  const approved = (await submitOrder(company.auth, created.id, { version: created.version })).data
  const fresh = (await getOrder(company.auth, approved.id)).data
  await createReceipt(company.auth, approved.id, nextKey(), {
    version: fresh.version,
    warehouseId: company.warehouse.id,
    receiptDate: '2026-05-02',
    notes: null,
    lines: [{ orderLineId: approved.lines[0].id, quantity: 10 }],
  })
  return approved
}

async function sellFour(company: Company) {
  const customer = await createCustomer(company.auth, {
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
  const quote = (
    await createQuotation(company.auth, nextKey(), {
      customerId: customer.id,
      leadId: null,
      validUntil: '2026-12-31',
      notes: null,
      lines: [
        {
          description: 'Flour',
          quantity: 4,
          unitPriceMinor: 1_500,
          taxRateBps: 0,
          itemId: company.item.id,
          warehouseId: company.warehouse.id,
        },
      ],
    })
  ).body.data
  const sent = await sendQuotation(company.auth, quote.id, { version: quote.version })
  const accepted = await acceptQuotation(company.auth, quote.id, { version: sent.data.version })
  return convertQuotation(company.auth, nextKey(), quote.id, { version: accepted.data.version })
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

async function onHand(auth: AuthContext, itemId: string): Promise<number> {
  return (await pg().query<{ n: number }>(`select current_stock as n from items where tenant_id = $1 and id = $2`, [auth.tenantId, itemId])).rows[0].n
}

async function averageOf(auth: AuthContext, itemId: string): Promise<number> {
  return Number((await pg().query<{ n: string }>(`select unit_cost_minor::text as n from items where tenant_id = $1 and id = $2`, [auth.tenantId, itemId])).rows[0].n)
}

let moving: Company
let pinned: Company
let other: Company

beforeAll(async () => {
  await startDatabase()
  moving = await company('otc-mwa', 'moving_weighted_average')
  pinned = await company('otc-order', 'order_price')
  other = await company('otc-other', 'order_price')
}, 180_000)
afterAll(stopDatabase)

describe('procure to pay into quote to cash', () => {
  it('posts COGS when the quotation is converted under moving weighted average, then collects part of the invoice', async () => {
    await receiveTen(moving)
    expect(await onHand(moving.auth, moving.item.id)).toBe(10)
    expect(await balance(moving.auth, moving.inventory.id)).toBe(10_000)

    const sold = await sellFour(moving)
    const invoice = sold.body.data.invoice
    expect(sold.body.data.stockDeducted).toBe(true)
    expect(invoice).toMatchObject({ status: 'issued', totalMinor: 6_000, cogsEntryId: expect.any(String) })
    expect(await onHand(moving.auth, moving.item.id)).toBe(6)
    expect(await averageOf(moving.auth, moving.item.id)).toBe(1_000)
    expect(await balance(moving.auth, moving.cogs.id)).toBe(4_000)
    expect(await balance(moving.auth, moving.inventory.id)).toBe(6_000)

    const detail = await getInvoice(moving.auth, invoice.id)
    expect(detail.data.cogsEntryId).toBe(invoice.cogsEntryId)
    const entry = await pg().query<{ source_type: string; debit: string; credit: string }>(
      `select e.source_type, l.debit_minor::text as debit, l.credit_minor::text as credit
         from journal_entries e join journal_lines l on l.tenant_id = e.tenant_id and l.entry_id = e.id
        where e.tenant_id = $1 and e.id = $2
        order by l.line_no`,
      [moving.auth.tenantId, detail.data.cogsEntryId]
    )
    expect(entry.rows).toEqual([
      { source_type: 'sales_cogs', debit: '4000', credit: '0' },
      { source_type: 'sales_cogs', debit: '0', credit: '4000' },
    ])

    const paid = await recordPayment(moving.auth, invoice.id, nextKey(), {
      version: invoice.version,
      amountMinor: 2_000,
      currency: 'KWD',
      method: 'knet',
      paidAt: '2026-10-28T09:00:00.000Z',
      reference: null,
    })
    expect(paid.body.data.invoice).toMatchObject({ status: 'partially_paid', paidMinor: 2_000, cogsEntryId: invoice.cogsEntryId })
    await expect(getInvoice(other.auth, invoice.id)).rejects.toMatchObject({ status: 404 })
    const leaked = await pg().query<{ n: number }>(
      `select count(*)::int as n from journal_entries where tenant_id = $1 and source_id = $2`,
      [other.auth.tenantId, invoice.id]
    )
    expect(leaked.rows[0].n).toBe(0)
  })

  it('converts a quotation under order price without a cost-of-goods entry and leaves the catalogue cost', async () => {
    await receiveTen(pinned)
    const sold = await sellFour(pinned)
    expect(sold.body.data.invoice.cogsEntryId).toBeNull()
    expect(await averageOf(pinned.auth, pinned.item.id)).toBe(800)
    expect(await onHand(pinned.auth, pinned.item.id)).toBe(6)
    expect(await balance(pinned.auth, pinned.cogs.id)).toBe(0)
    const cogsRows = await pg().query<{ n: number }>(
      `select count(*)::int as n from journal_entries where tenant_id = $1 and source_type = 'sales_cogs'`,
      [pinned.auth.tenantId]
    )
    expect(cogsRows.rows[0].n).toBe(0)
  })
})
