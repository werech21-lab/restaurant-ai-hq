import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import { approveApproval, runScan } from '@/modules/ai'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions } from '@/lib/auth/permissions'
import { createCustomer } from '@/modules/crm'
import { createAccount, createInvoice, createPeriod, postOpenCollections, postOpenRevenue, recordPayment, submitInvoice } from '@/modules/finance'
import type { Account } from '@/modules/finance/client'
import { createItem, createWarehouse, recordMovement } from '@/modules/inventory'
import type { Item, Warehouse } from '@/modules/inventory/client'
import { createOrder, createPartner, settleOrder } from '@/modules/delivery'
import { recordProduction, recordWaste } from '@/modules/kitchen'
import { updateAccounting } from '@/modules/procurement'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

const pg = () => getPglite()
let keyCounter = 0
const nextKey = () => `ops-key-${String(++keyCounter).padStart(6, '0')}`

type Books = {
  auth: AuthContext
  warehouse: Warehouse
  item: Item
  cash: Account
  receivable: Account
  inventory: Account
  cogs: Account
  commission: Account
}

async function account(auth: AuthContext, code: string, type: Account['type']): Promise<Account> {
  return (await createAccount(auth, { code, name: code, type, parentId: null, isPostable: true })).data
}

async function books(): Promise<Books> {
  const owner = randomUUID()
  await createUser(owner)
  const auth: AuthContext = { userId: owner, tenantId: await bootstrapTenant('ops', 'ops', owner), permissions: new Set(allPermissions) }
  const warehouse = (await createWarehouse(auth, nextKey(), { code: 'MAIN', name: 'Main', location: null, capacity: null, status: 'active' })).body.data
  const item = (
    await createItem(auth, nextKey(), { sku: 'FLOUR', name: 'Flour', unit: 'piece', unitCostMinor: 800, sellingPriceMinor: 1_500, reorderLevel: 0, isActive: true })
  ).body.data
  const cash = await account(auth, '1000', 'asset')
  const receivable = await account(auth, '1100', 'asset')
  const inventory = await account(auth, '1200', 'asset')
  const cogs = await account(auth, '5200', 'expense')
  const commission = await account(auth, '5300', 'expense')
  const payable = await account(auth, '2000', 'liability')
  await createPeriod(auth, { name: 'FY2026', startsOn: '2026-01-01', endsOn: '2026-12-31' })
  await updateAccounting(auth, {
    version: 0,
    inventoryAccountId: inventory.id,
    payableAccountId: payable.id,
    inputTaxAccountId: null,
    accountingBasis: 'invoice_basis',
    grniAccountId: null,
    ppvAccountId: null,
    costingMethod: 'moving_weighted_average',
    cogsAccountId: cogs.id,
    priceToleranceBps: 0,
    taxToleranceMinor: 0,
  })
  return { auth, warehouse, item, cash, receivable, inventory, cogs, commission }
}

async function onHand(auth: AuthContext, itemId: string): Promise<number> {
  return (await pg().query<{ n: number }>(`select current_stock as n from items where tenant_id = $1 and id = $2`, [auth.tenantId, itemId])).rows[0].n
}

async function price(auth: AuthContext, itemId: string): Promise<number> {
  return Number((await pg().query<{ n: string }>(`select selling_price_minor::text as n from items where tenant_id = $1 and id = $2`, [auth.tenantId, itemId])).rows[0].n)
}

async function unbalanced(auth: AuthContext): Promise<number> {
  const result = await pg().query<{ n: number }>(
    `select count(*)::int as n from journal_entries e
      where e.tenant_id = $1 and e.status = 'posted'
        and (select coalesce(sum(debit_minor), 0) from journal_lines l where l.tenant_id = e.tenant_id and l.entry_id = e.id)
          <> (select coalesce(sum(credit_minor), 0) from journal_lines l where l.tenant_id = e.tenant_id and l.entry_id = e.id)`,
    [auth.tenantId]
  )
  return result.rows[0].n
}

async function linesOf(auth: AuthContext, sourceType: string): Promise<Array<{ debit: string; credit: string }>> {
  const result = await pg().query<{ debit: string; credit: string }>(
    `select l.debit_minor::text as debit, l.credit_minor::text as credit
       from journal_entries e
       join journal_lines l on l.tenant_id = e.tenant_id and l.entry_id = e.id
      where e.tenant_id = $1 and e.source_type = $2
      order by e.created_at, l.line_no`,
    [auth.tenantId, sourceType]
  )
  return result.rows
}

let company: Books

beforeAll(async () => {
  await startDatabase()
  company = await books()
}, 180_000)
afterAll(stopDatabase)

describe('operational posting', () => {
  it('posts a collection only after cash and receivable accounts exist, then kitchen, delivery and an approved scenario', async () => {
    const { auth, warehouse, item, cash, receivable, inventory, cogs, commission } = company
    const customer = await createCustomer(auth, {
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
    const draft = (
      await createInvoice(auth, nextKey(), {
        customerId: customer.id,
        issueDate: '2026-10-01',
        dueDate: '2026-11-01',
        notes: null,
        lines: [{ description: 'Catering', quantity: 1, unitPriceMinor: 6_000, taxRateBps: 0, itemId: null, warehouseId: null }],
      })
    ).body.data
    const issued = await submitInvoice(auth, draft.id, { version: draft.version })
    const paid = await recordPayment(auth, draft.id, nextKey(), {
      version: issued.data.version,
      amountMinor: 6_000,
      currency: 'KWD',
      method: 'knet',
      paidAt: '2026-10-28T09:00:00.000Z',
      reference: null,
    })
    expect(paid.body.data.invoice.status).toBe('paid')
    expect(await linesOf(auth, 'customer_collection')).toEqual([])

    await pg().query(
      `update finance_settings
          set receivable_account_id = $2, collection_account_id = $3, commission_account_id = $4
        where tenant_id = $1`,
      [auth.tenantId, receivable.id, cash.id, commission.id]
    )
    const posted = await postOpenCollections(auth, nextKey())
    expect(posted.body.data.posted).toBe(1)
    expect(await linesOf(auth, 'customer_collection')).toEqual([
      { debit: '6000', credit: '0' },
      { debit: '0', credit: '6000' },
    ])

    await recordMovement(auth, nextKey(), { type: 'IN', itemId: item.id, warehouseId: warehouse.id, quantity: 10, note: null })
    await expect(recordWaste(auth, nextKey(), { itemId: item.id, warehouseId: warehouse.id, quantity: 100, wastedOn: '2026-10-28', reason: 'too much' })).rejects.toMatchObject({
      code: 'insufficient_stock',
    })
    expect(await onHand(auth, item.id)).toBe(10)

    const free = (
      await createItem(auth, nextKey(), { sku: 'WATER', name: 'Water', unit: 'piece', unitCostMinor: 0, sellingPriceMinor: 0, reorderLevel: 0, isActive: true })
    ).body.data
    await recordMovement(auth, nextKey(), { type: 'IN', itemId: free.id, warehouseId: warehouse.id, quantity: 2, note: null })
    await expect(recordWaste(auth, nextKey(), { itemId: free.id, warehouseId: warehouse.id, quantity: 1, wastedOn: '2026-10-28', reason: 'no cost' })).rejects.toMatchObject({
      code: 'zero_amount',
    })
    expect(await onHand(auth, free.id)).toBe(2)

    const wasted = await recordWaste(auth, nextKey(), { itemId: item.id, warehouseId: warehouse.id, quantity: 1, wastedOn: '2026-10-28', reason: 'spill' })
    expect(wasted.body.data.costMinor).toBe(800)
    expect(await onHand(auth, item.id)).toBe(9)
    expect(await linesOf(auth, 'kitchen_issue')).toEqual([
      { debit: '800', credit: '0' },
      { debit: '0', credit: '800' },
    ])

    const recipe = await pg().query<{ id: string }>(
      `insert into recipes (tenant_id, name, yield_quantity, notes, created_by)
       values ($1, 'Bread', 1, null, $2) returning id`,
      [auth.tenantId, auth.userId]
    )
    await pg().query(
      `insert into recipe_lines (tenant_id, recipe_id, item_id, quantity, created_by) values ($1, $2, $3, 1, $4)`,
      [auth.tenantId, recipe.rows[0].id, item.id, auth.userId]
    )
    const produced = await recordProduction(auth, nextKey(), { recipeId: recipe.rows[0].id, warehouseId: warehouse.id, batches: 1, producedOn: '2026-10-28', notes: null })
    expect(produced.body.data.costMinor).toBe(800)
    expect(await onHand(auth, item.id)).toBe(8)

    const partner = (await createPartner(auth, nextKey(), { code: 'RIDER', name: 'Rider', commissionBps: 0 })).body.data
    const order = (await createOrder(auth, nextKey(), { partnerId: partner.id, orderedOn: '2026-10-28', grossMinor: 2_000, commissionMinor: 500 })).body.data

    const before = await price(auth, item.id)
    const scan = await runScan(auth, { trigger: null, itemIds: null })
    expect(scan.rulesRun).toContain('operations.cost_scenarios')
    const request = await pg().query<{ id: string; version: number }>(
      `select id, version from ai_action_approvals
        where tenant_id = $1 and action_type = 'scenario_choice' and status = 'pending'`,
      [auth.tenantId]
    )
    expect(request.rows).toHaveLength(1)
    const decided = await approveApproval(auth, request.rows[0].id, nextKey(), { version: request.rows[0].version, note: null, optionKey: 'reduce_waste' })
    expect(decided.body.data.status).toBe('executed')
    expect(decided.body.data.resultJson?.summaryAr).toContain('سجل التدقيق')
    expect(await price(auth, item.id)).toBe(before)
    expect(await onHand(auth, item.id)).toBe(8)

    const settled = await settleOrder(auth, nextKey(), { orderId: order.id, settledOn: '2026-10-28' })
    expect(settled.body.data.journalEntryId).toEqual(expect.any(String))
    await expect(settleOrder(auth, nextKey(), { orderId: order.id, settledOn: '2026-10-28' })).rejects.toMatchObject({ code: 'invalid_transition' })
    expect(await linesOf(auth, 'delivery_commission')).toEqual([
      { debit: '500', credit: '0' },
      { debit: '0', credit: '500' },
    ])
    expect(await unbalanced(auth)).toBe(0)
    const audit = await pg().query<{ n: number }>(
      `select count(*)::int as n from audit_log where tenant_id = $1 and entity = 'ai_action_approval' and entity_id = $2 and action = 'update'`,
      [auth.tenantId, request.rows[0].id]
    )
    expect(audit.rows[0].n).toBe(1)
    expect(inventory.id).toBeTruthy()
    expect(cogs.id).toBeTruthy()
  }, 120_000)

  it('posts the missing sales entry so the collection nets the receivable to zero', async () => {
    const { auth, receivable } = company
    const sales = await account(auth, '4000', 'revenue')
    await pg().query(`update finance_settings set revenue_account_id = $2 where tenant_id = $1`, [auth.tenantId, sales.id])
    const posted = await postOpenRevenue(auth, nextKey())
    expect(posted.body.data.posted).toBe(1)
    expect(await linesOf(auth, 'sales_revenue')).toEqual([
      { debit: '6000', credit: '0' },
      { debit: '0', credit: '6000' },
    ])
    const net = await pg().query<{ n: string }>(
      `select coalesce(sum(l.debit_minor - l.credit_minor), 0)::text as n
         from journal_lines l
        where l.tenant_id = $1 and l.account_id = $2`,
      [auth.tenantId, receivable.id]
    )
    expect(net.rows[0].n).toBe('0')
    expect(await unbalanced(auth)).toBe(0)
    const again = await postOpenRevenue(auth, nextKey())
    expect(again.body.data.posted).toBe(0)
  }, 60_000)
})
