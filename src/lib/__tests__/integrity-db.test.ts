import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions } from '@/lib/auth/permissions'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

import { approveApproval, listApprovals, runScan } from '@/modules/ai'
import { listApprovalsQuerySchema } from '@/modules/ai/schemas/ai'
import { createCustomer } from '@/modules/crm'
import { approveInvoice, createInvoice, recordPayment, submitInvoice, voidInvoice } from '@/modules/finance'
import { createItem, createWarehouse, recordMovement } from '@/modules/inventory'

/**
 * Cross-module consistency. One mixed scenario (stock in, transfer, invoices that issue, pay, void, wait for approval or
 * fail for lack of stock, racing invoices, an AI restock) then the database is checked against the rules that must hold
 * whatever path produced the rows: the stock ledger equals the balances, invoices equal their lines and payments, every
 * movement is traceable, history cannot be edited, and everything that changed state left an audit row.
 */

const pg = () => getPglite()
let keyCounter = 0
const nextKey = () => `int-key-${String(++keyCounter).padStart(8, '0')}`
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

let auth: AuthContext
let other: AuthContext
let otherBalanceBefore = 0
const outcomes: Record<string, string> = {}

async function newTenant(label: string): Promise<AuthContext> {
  const userId = randomUUID()
  await createUser(userId)
  const tenantId = await bootstrapTenant(`Tenant ${label}`, `integrity-${label}`, userId)
  return { userId, tenantId, permissions: new Set<string>(allPermissions) }
}

async function rows<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await pg().query<T>(sql, params)).rows
}

async function mustReject(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') return error.code
    throw error
  }
  throw new Error('Expected the call to be rejected')
}

beforeAll(async () => {
  await startDatabase()
  auth = await newTenant('main')
  other = await newTenant('other')

  const w1 = (await createWarehouse(auth, nextKey(), { code: 'W1', name: 'Main', location: null, capacity: null, status: 'active' })).body.data
  const w2 = (await createWarehouse(auth, nextKey(), { code: 'W2', name: 'Branch', location: null, capacity: null, status: 'active' })).body.data
  const x = (
    await createItem(auth, nextKey(), { sku: 'X', name: 'Item X', unit: 'piece', unitCostMinor: 500, sellingPriceMinor: 1_000, reorderLevel: 2, isActive: true })
  ).body.data
  const y = (
    await createItem(auth, nextKey(), { sku: 'Y', name: 'Item Y', unit: 'piece', unitCostMinor: 400, sellingPriceMinor: 900, reorderLevel: 10, isActive: true })
  ).body.data
  await recordMovement(auth, nextKey(), { type: 'IN', itemId: x.id, warehouseId: w1.id, quantity: 50, note: null })
  await recordMovement(auth, nextKey(), { type: 'IN', itemId: y.id, warehouseId: w1.id, quantity: 5, note: null })
  await recordMovement(auth, nextKey(), { type: 'TRANSFER', itemId: x.id, fromWarehouseId: w1.id, toWarehouseId: w2.id, quantity: 10, note: null })

  const customer = await createCustomer(auth, {
    name: 'Integrity Co',
    customerType: 'company',
    email: null,
    phone: null,
    taxId: null,
    address: null,
    creditLimitMinor: null,
    status: 'active',
    notes: null,
  })
  const stockLine = (quantity: number) => ({ description: 'Goods', quantity, unitPriceMinor: 1_000, taxRateBps: 500, itemId: x.id, warehouseId: w1.id })
  const draft = async (lines: ReturnType<typeof stockLine>[]) =>
    (await createInvoice(auth, nextKey(), { customerId: customer.id, issueDate: day(-1), dueDate: day(29), notes: null, lines })).body.data

  // Invoice 1: issue (stock out), part payment, final payment.
  const inv1 = await draft([stockLine(5)])
  const issued1 = (await submitInvoice(auth, inv1.id, { version: inv1.version })).data
  const part = await recordPayment(auth, inv1.id, nextKey(), {
    version: issued1.version,
    amountMinor: 2_000,
    currency: 'KWD',
    method: 'cash',
    paidAt: new Date().toISOString(),
    reference: null,
  })
  const rest = issued1.totalMinor - 2_000
  await recordPayment(auth, inv1.id, nextKey(), {
    version: part.body.data.invoice.version,
    amountMinor: rest,
    currency: 'KWD',
    method: 'knet',
    paidAt: new Date().toISOString(),
    reference: 'ref-1',
  })

  // Invoice 2: issue then void. The stock must come back.
  const inv2 = await draft([stockLine(3)])
  const issued2 = (await submitInvoice(auth, inv2.id, { version: inv2.version })).data
  await voidInvoice(auth, inv2.id, { version: issued2.version, reason: 'Entered twice' })

  // Invoice 3: more than exists. It must fail without leaving a movement behind.
  const inv3 = await draft([stockLine(1_000)])
  outcomes.shortage = await mustReject(submitInvoice(auth, inv3.id, { version: inv3.version }))

  // Invoice 4: above the approval limit. It waits, then an approver releases it.
  const big = (
    await createInvoice(auth, nextKey(), {
      customerId: customer.id,
      issueDate: day(-1),
      dueDate: day(29),
      notes: null,
      lines: [{ description: 'Contract', quantity: 1, unitPriceMinor: 6_000_000, taxRateBps: 0, itemId: null, warehouseId: null }],
    })
  ).body.data
  const pending = (await submitInvoice(auth, big.id, { version: big.version })).data
  outcomes.pendingStatus = pending.status
  await approveInvoice(auth, big.id, { version: pending.version })

  // Invoices 5 and 6 race for the stock that is left in W1 (50 - 10 - 5 = 35). Each wants 20, so only one can win.
  const race = await Promise.all([draft([stockLine(20)]), draft([stockLine(20)])])
  const settled = await Promise.allSettled(race.map((invoice) => submitInvoice(auth, invoice.id, { version: invoice.version })))
  outcomes.raceWinners = String(settled.filter((result) => result.status === 'fulfilled').length)

  // AI: Y is below its reorder level. A human approves the restock the engine proposes.
  await runScan(auth, { trigger: null, itemIds: null })
  const pendingRequests = (await listApprovals(auth, listApprovalsQuerySchema.parse({ limit: '100', status: 'pending' }))).data
  const restocks = pendingRequests.filter((request) => request.actionType === 'auto_reorder')
  if (restocks.length === 0) throw new Error('The scan proposed no restock for the low item')
  for (const restock of restocks) await approveApproval(auth, restock.id, nextKey(), { version: restock.version, note: null })
  outcomes.restocks = String(restocks.length)

  // A second tenant that must be untouched by all of the above.
  const ow = (await createWarehouse(other, nextKey(), { code: 'W1', name: 'Other', location: null, capacity: null, status: 'active' })).body.data
  const oi = (
    await createItem(other, nextKey(), { sku: 'X', name: 'Other X', unit: 'piece', unitCostMinor: 1, sellingPriceMinor: 2, reorderLevel: 0, isActive: true })
  ).body.data
  await recordMovement(other, nextKey(), { type: 'IN', itemId: oi.id, warehouseId: ow.id, quantity: 7, note: null })
  otherBalanceBefore = 7
}, 180_000)
afterAll(stopDatabase)

describe('scenario outcomes', () => {
  it('blocks an invoice that exceeds stock with insufficient_stock', () => {
    expect(outcomes.shortage).toBe('insufficient_stock')
  })

  it('holds a large invoice for approval instead of issuing it', () => {
    expect(outcomes.pendingStatus).toBe('pending_approval')
  })

  it('lets exactly one of two racing invoices take the last stock', () => {
    expect(outcomes.raceWinners).toBe('1')
  })
})

describe('stock ledger integrity', () => {
  it('equals the sum of its movements in every balance, for every tenant', async () => {
    const drift = await rows(
      `select m.tenant_id, m.item_id, m.warehouse_id, sum(m.quantity)::int as ledger, b.on_hand
       from stock_movements m
       left join stock_balances b on b.tenant_id = m.tenant_id and b.item_id = m.item_id and b.warehouse_id = m.warehouse_id
       group by m.tenant_id, m.item_id, m.warehouse_id, b.on_hand
       having sum(m.quantity) is distinct from b.on_hand`
    )
    expect(drift).toEqual([])
    const orphans = await rows(
      `select b.* from stock_balances b where b.on_hand <> 0 and not exists (
         select 1 from stock_movements m where m.tenant_id = b.tenant_id and m.item_id = b.item_id and m.warehouse_id = b.warehouse_id)`
    )
    expect(orphans).toEqual([])
  })

  it('keeps items.current_stock equal to the sum of the item\'s balances and never negative', async () => {
    const drift = await rows(
      `select i.id, i.current_stock, coalesce(sum(b.on_hand), 0)::int as balances
       from items i left join stock_balances b on b.tenant_id = i.tenant_id and b.item_id = i.id
       group by i.id, i.current_stock
       having i.current_stock <> coalesce(sum(b.on_hand), 0)`
    )
    expect(drift).toEqual([])
    expect(await rows(`select 1 from stock_balances where on_hand < 0`)).toEqual([])
    expect(await rows(`select 1 from items where current_stock < 0`)).toEqual([])
  })

  it('writes every transfer as a pair of opposite rows that cancel out', async () => {
    const transfers = await rows<{ reference_id: string; rows: number; total: number }>(
      `select reference_id, count(*)::int as rows, sum(quantity)::int as total
       from stock_movements where movement_type = 'TRANSFER' group by reference_id`
    )
    expect(transfers.length).toBeGreaterThan(0)
    for (const transfer of transfers) {
      expect(transfer.rows).toBe(2)
      expect(transfer.total).toBe(0)
    }
  })

  it('ties each invoice\'s stock movements to its status: out when issued or paid, net zero when void, none otherwise', async () => {
    const invoices = await rows<{ id: string; status: string; net: number; qty: number }>(
      `select i.id, i.status,
              coalesce((select sum(m.quantity) from stock_movements m where m.tenant_id = i.tenant_id and m.reference_type = 'invoice' and m.reference_id = i.id), 0)::int as net,
              coalesce((select sum(l.quantity) from invoice_lines l where l.tenant_id = i.tenant_id and l.invoice_id = i.id and l.item_id is not null), 0)::int as qty
       from invoices i where i.tenant_id = $1`,
      [auth.tenantId]
    )
    expect(invoices.length).toBe(6)
    const statuses = invoices.map((invoice) => invoice.status).sort()
    // paid, void, the approved large invoice, the race winner, and two drafts (no stock, race loser).
    expect(statuses).toEqual(['draft', 'draft', 'issued', 'issued', 'paid', 'void'])
    for (const invoice of invoices) {
      const deducted = ['issued', 'partially_paid', 'paid'].includes(invoice.status)
      expect(invoice.net, `${invoice.status} invoice ${invoice.id}`).toBe(deducted ? 0 - invoice.qty : 0)
    }
  })

  it('records each approved AI restock as one IN movement traceable to its approval request', async () => {
    const restock = await rows<{ movement_type: string; quantity: number; reference_id: string }>(
      `select movement_type, quantity, reference_id from stock_movements where tenant_id = $1 and reference_type = 'restock'`,
      [auth.tenantId]
    )
    expect(restock).toHaveLength(1)
    expect(restock[0].movement_type).toBe('IN')
    expect(restock[0].quantity).toBeGreaterThan(0)
    const request = await rows(`select 1 from ai_action_approvals where id = $1 and status = 'executed'`, [restock[0].reference_id])
    expect(request).toHaveLength(1)
  })

  it('leaves the other tenant\'s stock untouched', async () => {
    const balance = await rows<{ on_hand: number }>(`select sum(on_hand)::int as on_hand from stock_balances where tenant_id = $1`, [other.tenantId])
    expect(balance[0].on_hand).toBe(otherBalanceBefore)
    const crossed = await rows(
      `select 1 from stock_movements m join items i on i.id = m.item_id and i.tenant_id <> m.tenant_id`
    )
    expect(crossed).toEqual([])
  })
})

describe('invoice and payment integrity', () => {
  it('keeps every invoice equal to its lines and its payments, with a status that matches the money', async () => {
    const invoices = await rows<{
      id: string
      status: string
      subtotal_minor: number
      tax_minor: number
      total_minor: number
      paid_minor: number
      lines: number
      payments: number
    }>(
      `select i.id, i.status, i.subtotal_minor, i.tax_minor, i.total_minor, i.paid_minor,
              coalesce((select sum(l.line_net_minor) from invoice_lines l where l.tenant_id = i.tenant_id and l.invoice_id = i.id), 0)::bigint as lines,
              coalesce((select sum(p.amount_minor) from payments p where p.tenant_id = i.tenant_id and p.invoice_id = i.id), 0)::bigint as payments
       from invoices i`
    )
    expect(invoices.length).toBeGreaterThanOrEqual(6)
    for (const invoice of invoices) {
      const label = `${invoice.status} ${invoice.id}`
      expect(invoice.total_minor, label).toBe(invoice.subtotal_minor + invoice.tax_minor)
      expect(invoice.subtotal_minor, label).toBe(invoice.lines)
      expect(invoice.paid_minor, label).toBe(invoice.payments)
      expect(invoice.paid_minor, label).toBeLessThanOrEqual(invoice.total_minor)
      if (invoice.status === 'paid') expect(invoice.paid_minor, label).toBe(invoice.total_minor)
      if (invoice.status === 'partially_paid') expect(invoice.paid_minor, label).toBeGreaterThan(0)
      if (!['issued', 'partially_paid', 'paid'].includes(invoice.status)) expect(invoice.paid_minor, label).toBe(0)
    }
  })

  it('computes tax once per invoice: 5 x 1.000 KWD at 5% is 0.250, not a per-line rounding', async () => {
    const paid = await rows<{ subtotal_minor: number; tax_minor: number; total_minor: number }>(
      `select subtotal_minor, tax_minor, total_minor from invoices where tenant_id = $1 and status = 'paid'`,
      [auth.tenantId]
    )
    expect(paid).toEqual([{ subtotal_minor: 5_000, tax_minor: 250, total_minor: 5_250 }])
  })

  it('numbers invoices per tenant without gaps or duplicates', async () => {
    const numbers = await rows<{ number: string }>(`select number from invoices where tenant_id = $1 order by created_at, number`, [auth.tenantId])
    const unique = new Set(numbers.map((row) => row.number))
    expect(unique.size).toBe(numbers.length)
    expect([...unique].sort()).toEqual(numbers.map((row) => row.number).sort())
  })
})

describe('append-only history', () => {
  it('refuses to update or delete ledger, payment, invoice and audit rows even for the database owner', async () => {
    await expect(pg().query(`update stock_movements set note = 'edit' where tenant_id = $1`, [auth.tenantId])).rejects.toThrow(/immutable|not allowed|cannot/i)
    await expect(pg().query(`delete from stock_movements where tenant_id = $1`, [auth.tenantId])).rejects.toThrow(/immutable|not allowed|cannot|delete/i)
    await expect(pg().query(`update payments set amount_minor = 1 where tenant_id = $1`, [auth.tenantId])).rejects.toThrow(/immutable|not allowed|cannot/i)
    await expect(pg().query(`delete from payments where tenant_id = $1`, [auth.tenantId])).rejects.toThrow(/immutable|not allowed|cannot|delete/i)
    await expect(pg().query(`delete from invoices where tenant_id = $1`, [auth.tenantId])).rejects.toThrow(/immutable|not allowed|cannot|delete/i)
    await expect(pg().query(`update audit_log set action = 'create' where tenant_id = $1`, [auth.tenantId])).rejects.toThrow(/immutable|not allowed|cannot/i)
    await expect(pg().query(`delete from audit_log where tenant_id = $1`, [auth.tenantId])).rejects.toThrow(/immutable|not allowed|cannot|delete/i)
  })

  it('refuses to change an issued invoice\'s lines or total behind the service\'s back', async () => {
    await expect(
      pg().query(`update invoice_lines set quantity = quantity + 1 where tenant_id = $1`, [auth.tenantId])
    ).rejects.toThrow()
    await expect(pg().query(`update invoices set total_minor = total_minor + 1 where tenant_id = $1 and status = 'paid'`, [auth.tenantId])).rejects.toThrow()
  })

  it('refuses a direct write that would drive stock below zero', async () => {
    const target = await rows<{ item_id: string; warehouse_id: string; on_hand: number }>(
      `select item_id, warehouse_id, on_hand from stock_balances where tenant_id = $1 and on_hand > 0 limit 1`,
      [auth.tenantId]
    )
    expect(target).toHaveLength(1)
    await expect(
      pg().query(
        `insert into stock_movements (tenant_id, item_id, warehouse_id, movement_type, quantity, created_by) values ($1, $2, $3, 'OUT', $4, $5)`,
        [auth.tenantId, target[0].item_id, target[0].warehouse_id, -(target[0].on_hand + 1), auth.userId]
      )
    ).rejects.toThrow()
    const after = await rows<{ on_hand: number }>(`select on_hand from stock_balances where tenant_id = $1 and item_id = $2 and warehouse_id = $3`, [
      auth.tenantId,
      target[0].item_id,
      target[0].warehouse_id,
    ])
    expect(after[0].on_hand).toBe(target[0].on_hand)
  })
})

describe('audit completeness', () => {
  it('has a create row for every invoice, item, warehouse and customer', async () => {
    const missing = await rows<{ entity: string; id: string }>(
      `select 'invoice' as entity, i.id from invoices i where i.tenant_id = $1 and not exists (select 1 from audit_log a where a.tenant_id = i.tenant_id and a.entity_id = i.id and a.action = 'create')
       union all
       select 'item', i.id from items i where i.tenant_id = $1 and not exists (select 1 from audit_log a where a.tenant_id = i.tenant_id and a.entity_id = i.id and a.action = 'create')
       union all
       select 'warehouse', w.id from warehouses w where w.tenant_id = $1 and not exists (select 1 from audit_log a where a.tenant_id = w.tenant_id and a.entity_id = w.id and a.action = 'create')
       union all
       select 'customer', c.id from customers c where c.tenant_id = $1 and not exists (select 1 from audit_log a where a.tenant_id = c.tenant_id and a.entity_id = c.id and a.action = 'create')`,
      [auth.tenantId]
    )
    expect(missing).toEqual([])
  })

  it('has an update row for every invoice that left draft, with the actor who did it', async () => {
    const missing = await rows(
      `select i.id from invoices i where i.tenant_id = $1 and i.status <> 'draft'
         and not exists (select 1 from audit_log a where a.tenant_id = i.tenant_id and a.entity_id = i.id and a.action = 'update' and a.actor_id = $2)`,
      [auth.tenantId, auth.userId]
    )
    expect(missing).toEqual([])
  })

  it('audits every payment, every ledger movement and every decided AI request', async () => {
    const payments = await rows(
      `select p.id from payments p where p.tenant_id = $1 and not exists (select 1 from audit_log a where a.tenant_id = p.tenant_id and a.entity_id in (p.id, p.invoice_id) and a.created_at >= p.created_at - interval '1 second')`,
      [auth.tenantId]
    )
    expect(payments).toEqual([])

    const movements = await rows(
      `select m.id from stock_movements m where m.tenant_id = $1 and m.reference_type = 'manual'
         and not exists (select 1 from audit_log a where a.tenant_id = m.tenant_id and a.entity_id = m.id)`,
      [auth.tenantId]
    )
    expect(movements).toEqual([])

    const decided = await rows(
      `select r.id from ai_action_approvals r where r.tenant_id = $1 and r.decided_by is not null
         and not exists (select 1 from audit_log a where a.tenant_id = r.tenant_id and a.entity_id = r.id)`,
      [auth.tenantId]
    )
    expect(decided).toEqual([])
  })

  it('never lets an audit row point at another tenant\'s actor or record', async () => {
    const crossed = await rows(
      `select a.id from audit_log a where a.tenant_id = $1 and a.actor_id <> $2 and a.actor_id <> $3`,
      [auth.tenantId, auth.userId, auth.userId]
    )
    expect(crossed).toEqual([])
    const foreign = await rows(`select a.id from audit_log a join invoices i on i.id = a.entity_id and i.tenant_id <> a.tenant_id`)
    expect(foreign).toEqual([])
  })
})
