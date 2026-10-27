import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions, permissions } from '@/lib/auth/permissions'
import { subscribe, type BusEvent } from '@/lib/events/bus'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

import {
  acknowledgeInsight,
  approveApproval,
  getApproval,
  getDashboard,
  getInsight,
  handleInventoryEvent,
  listApprovals,
  listInsights,
  listRules,
  registerAiEventHandlers,
  rejectApproval,
  resolveInsight,
  runCommand,
  runScan,
  updateRule,
  type Approval,
  type Insight,
  type ScanResult,
} from '@/modules/ai'
import { listApprovalsQuerySchema, listInsightsQuerySchema } from '@/modules/ai/schemas/ai'
import { createCustomer, createLead, createQuotation, getCustomer, getQuotation, updateQuotation, type Customer, type Lead, type QuotationDetail } from '@/modules/crm'
import { createInvoice, getInvoice, recordPayment, submitInvoice } from '@/modules/finance'
import { createItem, createWarehouse, getItem, recordMovement, updateItem, updateWarehouse, type Item, type Warehouse } from '@/modules/inventory'

const FULL_SCAN = { trigger: null, itemIds: null } as const
const KEY_PAD = 8

let keyCounter = 0
const nextKey = () => `ai-key-${String(++keyCounter).padStart(KEY_PAD, '0')}`
let counter = 0

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

type Fixture = {
  auth: AuthContext
  warehouse: Warehouse
  low: Item
  fast: Item
  thin: Item
  customer: Customer
  invoiceNumber: string
  invoiceId: string
  lead: Lead
  quote: QuotationDetail
}

function authWithout(auth: AuthContext, ...removed: string[]): AuthContext {
  return { ...auth, permissions: new Set(allPermissions.filter((permission) => !removed.includes(permission))) }
}

function authWith(auth: AuthContext, ...granted: string[]): AuthContext {
  return { ...auth, permissions: new Set(granted) }
}

async function newTenant(label: string): Promise<AuthContext> {
  const userId = randomUUID()
  await createUser(userId)
  const tenantId = await bootstrapTenant(`Tenant ${label}`, `tenant-${label}-${++counter}`, userId)
  return { userId, tenantId, permissions: new Set<string>(allPermissions) }
}

async function stockIn(auth: AuthContext, item: Item, warehouse: Warehouse, quantity: number): Promise<void> {
  await recordMovement(auth, nextKey(), { type: 'IN', itemId: item.id, warehouseId: warehouse.id, quantity, note: null })
}

async function stockOut(auth: AuthContext, item: Item, warehouse: Warehouse, quantity: number): Promise<void> {
  await recordMovement(auth, nextKey(), { type: 'OUT', itemId: item.id, warehouseId: warehouse.id, quantity, note: null })
}

async function newItem(
  auth: AuthContext,
  warehouse: Warehouse,
  sku: string,
  options: { stock: number; reorderLevel: number; costMinor: number; priceMinor: number }
): Promise<Item> {
  const item = (
    await createItem(auth, nextKey(), {
      sku,
      name: `صنف ${sku}`,
      unit: 'piece',
      unitCostMinor: options.costMinor,
      sellingPriceMinor: options.priceMinor,
      reorderLevel: options.reorderLevel,
      isActive: true,
    })
  ).body.data
  if (options.stock > 0) await stockIn(auth, item, warehouse, options.stock)
  return item
}

async function backdateLead(leadId: string, days: number): Promise<void> {
  const pg = getPglite()
  await pg.exec('alter table crm_leads_pipeline disable trigger user')
  await pg.query(`update crm_leads_pipeline set updated_at = now() - ($2::int * interval '1 day') where id = $1`, [leadId, days])
  await pg.exec('alter table crm_leads_pipeline enable trigger user')
}

/**
 * One tenant with a finding for every rule: a low item, a fast-depleting item, a thin-margin item, a customer with one
 * overdue invoice (45 days, 2,000.000 KWD), and a likely lead that went quiet 20 days ago with a draft quotation.
 */
async function fixture(label: string): Promise<Fixture> {
  const auth = await newTenant(label)
  const warehouse = (
    await createWarehouse(auth, nextKey(), { code: 'MAIN', name: 'المخزن الرئيسي', location: null, capacity: null, status: 'active' })
  ).body.data
  const low = await newItem(auth, warehouse, 'LOW', { stock: 5, reorderLevel: 10, costMinor: 500, priceMinor: 1_000 })
  const fast = await newItem(auth, warehouse, 'FAST', { stock: 130, reorderLevel: 5, costMinor: 400, priceMinor: 1_000 })
  await stockOut(auth, fast, warehouse, 90)
  const thin = await newItem(auth, warehouse, 'THIN', { stock: 100, reorderLevel: 5, costMinor: 800, priceMinor: 900 })

  const customer = await createCustomer(auth, {
    name: 'شركة النور',
    customerType: 'company',
    email: null,
    phone: '55512345',
    taxId: null,
    address: null,
    creditLimitMinor: null,
    status: 'active',
    notes: null,
  })
  const line = { description: 'خدمة', quantity: 1, unitPriceMinor: 2_000_000, taxRateBps: 0, itemId: null, warehouseId: null }
  const created = (
    await createInvoice(auth, nextKey(), { customerId: customer.id, issueDate: day(-60), dueDate: day(-45), notes: null, lines: [line] })
  ).body.data
  const issued = (await submitInvoice(auth, created.id, { version: created.version })).data

  const lead = (
    await createLead(auth, nextKey(), {
      customerId: customer.id,
      title: 'عقد توريد',
      stage: 'qualified',
      expectedRevenueMinor: 5_000_000,
      probability: 70,
      assignedTo: null,
      expectedCloseDate: null,
      notes: null,
    })
  ).body.data
  const quote = (
    await createQuotation(auth, nextKey(), {
      customerId: customer.id,
      leadId: lead.id,
      validUntil: day(30),
      notes: null,
      lines: [
        { description: 'خدمة أ', quantity: 1, unitPriceMinor: 6_000, taxRateBps: 500, itemId: null, warehouseId: null },
        { description: 'خدمة ب', quantity: 2, unitPriceMinor: 2_000, taxRateBps: 0, itemId: null, warehouseId: null },
      ],
    })
  ).body.data
  await backdateLead(lead.id, 20)
  return { auth, warehouse, low, fast, thin, customer, invoiceNumber: issued.number, invoiceId: issued.id, lead, quote }
}

async function pendingApprovals(auth: AuthContext): Promise<Approval[]> {
  return (await listApprovals(auth, listApprovalsQuerySchema.parse({ limit: '100' }))).data
}

async function liveInsights(auth: AuthContext): Promise<Insight[]> {
  return (await listInsights(auth, listInsightsQuerySchema.parse({ limit: '100' }))).data
}

async function allApprovals(auth: AuthContext, status = 'all'): Promise<Approval[]> {
  return (await listApprovals(auth, listApprovalsQuerySchema.parse({ limit: '100', status }))).data
}

function of(approvals: readonly Approval[], actionType: Approval['actionType']): Approval {
  const found = approvals.find((approval) => approval.actionType === actionType)
  if (!found) throw new Error(`No ${actionType} request`)
  return found
}

function approve(auth: AuthContext, approval: Approval, key: string = nextKey(), note?: string) {
  return approveApproval(auth, approval.id, key, { version: approval.version, note: note ?? null })
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const result = await getPglite().query<{ count: number }>(`select count(*)::int as count from ${sql}`, params)
  return result.rows[0].count
}

async function scan(auth: AuthContext): Promise<ScanResult> {
  return runScan(auth, FULL_SCAN)
}

beforeAll(async () => {
  await startDatabase()
}, 60_000)

afterAll(async () => {
  await stopDatabase()
})

describe('scan', () => {
  it('turns live finance, inventory and CRM data into insights and requests, one per finding', async () => {
    const f = await fixture('scan')
    const result = await scan(f.auth)

    expect(result.rulesRun.sort()).toEqual(
      [
        'crm.discount_incentive',
        'crm.stalled_leads',
        'finance.credit_hold',
        'finance.margin_floor',
        'finance.payment_reminder',
        'inventory.fast_depleting',
        'inventory.low_stock',
      ].sort()
    )
    expect(result).toMatchObject({ skipped: [], findings: 7, insightsCreated: 7, approvalsCreated: 7, insightsUpdated: 0, insightsResolved: 0 })

    const insights = await liveInsights(f.auth)
    expect(insights).toHaveLength(7)
    expect(insights.every((insight) => insight.status === 'open')).toBe(true)

    const approvals = await pendingApprovals(f.auth)
    expect(approvals.map((approval) => approval.actionType).sort()).toEqual(
      ['auto_reorder', 'auto_reorder', 'credit_hold', 'discount_approval', 'lead_followup', 'payment_reminder', 'price_adjustment'].sort()
    )
    expect(approvals.every((approval) => approval.status === 'pending' && approval.decidedBy === null && approval.insightId !== null)).toBe(true)

    const reorder = approvals.find((approval) => approval.actionType === 'auto_reorder' && approval.ruleKey === 'inventory.low_stock')
    expect(reorder).toMatchObject({
      estimatedImpactFils: -7_500,
      payloadJson: { itemId: f.low.id, warehouseId: f.warehouse.id, quantity: 15, targetStock: 20, totalCostMinor: 7_500 },
    })
    expect(of(approvals, 'payment_reminder')).toMatchObject({ estimatedImpactFils: 2_000_000 })
    expect(of(approvals, 'price_adjustment')).toMatchObject({ estimatedImpactFils: 0, payloadJson: { newPriceMinor: 1_000, currentPriceMinor: 900 } })
    expect(of(approvals, 'discount_approval')).toMatchObject({ payloadJson: { quotationId: f.quote.id, discountBps: 500 } })
    expect(of(approvals, 'lead_followup')).toMatchObject({ estimatedImpactFils: 5_000_000 })

    const scans = await count(`audit_log where tenant_id = $1 and entity = 'ai_scan'`, [f.auth.tenantId])
    expect(scans).toBe(1)
    const created = await count(`audit_log where tenant_id = $1 and entity in ('ai_insight', 'ai_action_approval') and action = 'create'`, [f.auth.tenantId])
    expect(created).toBe(14)
  }, 60_000)

  it('is repeatable: a rescan creates nothing and leaves versions alone', async () => {
    const f = await fixture('rescan')
    await scan(f.auth)
    const before = await pendingApprovals(f.auth)
    const insightsBefore = await liveInsights(f.auth)

    const again = await scan(f.auth)
    expect(again).toMatchObject({ findings: 7, insightsCreated: 0, insightsUpdated: 0, approvalsCreated: 0, approvalsUpdated: 0, insightsResolved: 0, approvalsWithdrawn: 0 })
    const after = await pendingApprovals(f.auth)
    expect(after.map((a) => [a.id, a.version]).sort()).toEqual(before.map((a) => [a.id, a.version]).sort())
    expect((await liveInsights(f.auth)).map((i) => [i.id, i.version]).sort()).toEqual(insightsBefore.map((i) => [i.id, i.version]).sort())
  }, 60_000)

  it('updates a pending request in place when the numbers move, and bumps its version once', async () => {
    const f = await fixture('refresh')
    await scan(f.auth)
    const before = of(await pendingApprovals(f.auth), 'payment_reminder')
    const payment = await getInvoice(f.auth, f.invoiceId)
    await recordPayment(f.auth, f.invoiceId, nextKey(), {
      version: payment.data.version,
      amountMinor: 500_000,
      currency: 'KWD',
      method: 'cash',
      paidAt: new Date().toISOString(),
      reference: null,
    })
    const result = await scan(f.auth)
    expect(result.approvalsUpdated).toBeGreaterThanOrEqual(1)
    expect(result.approvalsCreated).toBe(0)
    const after = of(await pendingApprovals(f.auth), 'payment_reminder')
    expect(after.id).toBe(before.id)
    expect(after.version).toBe(before.version + 1)
    expect(after.estimatedImpactFils).toBe(1_500_000)
  }, 60_000)

  it('resolves insights and withdraws requests when the cause is gone', async () => {
    const f = await fixture('clear')
    await scan(f.auth)
    await stockIn(f.auth, f.low, f.warehouse, 50)
    const invoice = await getInvoice(f.auth, f.invoiceId)
    await recordPayment(f.auth, f.invoiceId, nextKey(), {
      version: invoice.data.version,
      amountMinor: 2_000_000,
      currency: 'KWD',
      method: 'cash',
      paidAt: new Date().toISOString(),
      reference: null,
    })

    const result = await scan(f.auth)
    expect(result.insightsResolved).toBe(3)
    expect(result.approvalsWithdrawn).toBe(3)

    const live = await liveInsights(f.auth)
    expect(live.map((insight) => insight.ruleKey)).not.toContain('inventory.low_stock')
    expect(live.map((insight) => insight.ruleKey)).not.toContain('finance.payment_reminder')
    expect(live.map((insight) => insight.ruleKey)).not.toContain('finance.credit_hold')

    const withdrawn = (await allApprovals(f.auth, 'rejected')).filter((approval) => approval.ruleKey === 'finance.payment_reminder')
    expect(withdrawn).toHaveLength(1)
    expect(withdrawn[0]).toMatchObject({ status: 'rejected', decidedBy: null })
    expect(withdrawn[0].decidedAt).not.toBeNull()
    expect(withdrawn[0].decisionNote).toContain('سُحب')
  }, 60_000)

  it('does not ask again for a week after an executive refused, then does', async () => {
    const f = await fixture('cooldown')
    await scan(f.auth)
    const reminder = of(await pendingApprovals(f.auth), 'payment_reminder')
    await rejectApproval(f.auth, reminder.id, { version: reminder.version, note: 'سأتصل بهم' })

    const during = await scan(f.auth)
    expect(during.approvalsCreated).toBe(0)
    expect((await pendingApprovals(f.auth)).map((approval) => approval.actionType)).not.toContain('payment_reminder')
    expect((await liveInsights(f.auth)).map((insight) => insight.ruleKey)).toContain('finance.payment_reminder')

    await getPglite().query(`update ai_action_approvals set decided_at = now() - interval '8 days' where id = $1`, [reminder.id])
    const after = await scan(f.auth)
    expect(after.approvalsCreated).toBe(1)
    const fresh = of(await pendingApprovals(f.auth), 'payment_reminder')
    expect(fresh.id).not.toBe(reminder.id)
  }, 60_000)

  it('does not count its own withdrawal as a decision', async () => {
    const f = await fixture('withdraw-cooldown')
    await scan(f.auth)
    const invoice = await getInvoice(f.auth, f.invoiceId)
    await recordPayment(f.auth, f.invoiceId, nextKey(), {
      version: invoice.data.version,
      amountMinor: 2_000_000,
      currency: 'KWD',
      method: 'cash',
      paidAt: new Date().toISOString(),
      reference: null,
    })
    await scan(f.auth)
    // A new overdue invoice raises the same customer again at once: the engine's withdrawal started no cooldown.
    const line = { description: 'خدمة', quantity: 1, unitPriceMinor: 3_000_000, taxRateBps: 0, itemId: null, warehouseId: null }
    const created = (
      await createInvoice(f.auth, nextKey(), { customerId: f.customer.id, issueDate: day(-40), dueDate: day(-20), notes: null, lines: [line] })
    ).body.data
    await submitInvoice(f.auth, created.id, { version: created.version })
    const result = await scan(f.auth)
    expect(result.approvalsCreated).toBeGreaterThanOrEqual(1)
    expect((await pendingApprovals(f.auth)).map((approval) => approval.actionType)).toContain('payment_reminder')
  }, 60_000)

  it('keeps an acknowledged insight acknowledged through a rescan that changes it', async () => {
    const f = await fixture('ack')
    await scan(f.auth)
    const insight = (await liveInsights(f.auth)).find((entry) => entry.ruleKey === 'inventory.low_stock')
    if (!insight) throw new Error('missing insight')
    const acknowledged = (await acknowledgeInsight(f.auth, insight.id, { version: insight.version })).data
    expect(acknowledged.status).toBe('acknowledged')

    await recordMovement(f.auth, nextKey(), { type: 'OUT', itemId: f.low.id, warehouseId: f.warehouse.id, quantity: 2, note: null })
    const result = await scan(f.auth)
    expect(result.insightsUpdated).toBeGreaterThanOrEqual(1)
    const after = (await getInsight(f.auth, insight.id)).data
    expect(after).toMatchObject({ status: 'acknowledged', metricValue: 3 })
    expect(after.version).toBe(acknowledged.version + 1)
  }, 60_000)

  it('skips a rule the caller cannot read the data for, and leaves its earlier findings alone', async () => {
    const f = await fixture('perm-scan')
    await scan(f.auth)
    const limited = authWithout(f.auth, permissions.financeInvoiceRead)
    const result = await scan(limited)
    expect(result.skipped.map((skip) => skip.ruleKey).sort()).toEqual(['finance.credit_hold', 'finance.payment_reminder'])
    expect(result.skipped.every((skip) => skip.reason === 'missing_permission')).toBe(true)
    expect(result.insightsResolved).toBe(0)
    expect((await liveInsights(f.auth)).map((insight) => insight.ruleKey)).toContain('finance.payment_reminder')
  }, 60_000)

  it('runs only active rules and reports the rest', async () => {
    const f = await fixture('inactive')
    const rules = (await listRules(f.auth)).data
    const margin = rules.find((rule) => rule.ruleKey === 'finance.margin_floor')
    if (!margin) throw new Error('missing rule')
    await updateRule(f.auth, margin.id, { version: margin.version, name: margin.name, isActive: false, conditionJson: margin.conditionJson })
    const result = await scan(f.auth)
    expect(result.rulesRun).not.toContain('finance.margin_floor')
    expect(result.skipped).toEqual([{ ruleKey: 'finance.margin_floor', reason: 'inactive' }])
    expect(result.findings).toBe(6)
  }, 60_000)

  it('reports a rule with a damaged condition instead of failing the scan', async () => {
    const f = await fixture('bad-condition')
    await getPglite().query(`update erp_automation_rules set condition_json = '{"nonsense": true}'::jsonb where tenant_id = $1 and rule_key = 'crm.stalled_leads'`, [f.auth.tenantId])
    const result = await scan(f.auth)
    expect(result.skipped).toEqual([{ ruleKey: 'crm.stalled_leads', reason: 'invalid_condition' }])
    expect(result.findings).toBe(6)
  }, 60_000)

  it('uses the thresholds stored in the rule', async () => {
    const f = await fixture('thresholds')
    const rules = (await listRules(f.auth)).data
    const reminder = rules.find((rule) => rule.ruleKey === 'finance.payment_reminder')
    if (!reminder) throw new Error('missing rule')
    const updated = (
      await updateRule(f.auth, reminder.id, { version: reminder.version, name: reminder.name, isActive: true, conditionJson: { minOverdueDays: 90 } })
    ).data
    expect(updated.conditionJson).toEqual({ minOverdueDays: 90, minOverdueMinor: 1_000_000, cooldownDays: 7 })
    await scan(f.auth)
    expect((await liveInsights(f.auth)).map((insight) => insight.ruleKey)).not.toContain('finance.payment_reminder')
  }, 60_000)
})

describe('approve and execute', () => {
  it('restocks: books an IN movement referenced to the request, in one transaction with audit', async () => {
    const f = await fixture('exec-reorder')
    await scan(f.auth)
    const request = (await pendingApprovals(f.auth)).find((a) => a.actionType === 'auto_reorder' && a.ruleKey === 'inventory.low_stock')
    if (!request) throw new Error('missing request')
    const events: BusEvent[] = []
    const unsubscribers = ['inventory.stock.moved', 'ai.approval.executed'].map((name) => subscribe(name, (event) => void events.push(event)))

    const outcome = await approve(f.auth, request, nextKey(), 'موافق')
    unsubscribers.forEach((off) => off())

    expect(outcome.replayed).toBe(false)
    expect(outcome.status).toBe(200)
    expect(outcome.body.data).toMatchObject({ status: 'executed', decidedBy: f.auth.userId, decisionNote: 'موافق' })
    expect(outcome.body.data.decidedAt).not.toBeNull()
    expect(outcome.body.data.resultJson?.summaryAr).toContain('سُجّل استلام 15')
    expect(outcome.body.data.resultJson?.refs.map((ref) => ref.type)).toEqual(['stock_movement', 'item'])

    const movements = await getPglite().query<{ movement_type: string; quantity: number; reference_type: string; reference_id: string; warehouse_id: string }>(
      `select movement_type, quantity, reference_type, reference_id, warehouse_id from stock_movements where item_id = $1 and reference_type = 'restock'`,
      [f.low.id]
    )
    expect(movements.rows).toEqual([
      { movement_type: 'IN', quantity: 15, reference_type: 'restock', reference_id: request.id, warehouse_id: f.warehouse.id },
    ])
    expect((await getItem(f.auth, f.low.id)).data.currentStock).toBe(20)
    expect(events.map((event) => event.name).sort()).toEqual(['ai.approval.executed', 'inventory.stock.moved'])

    const audited = await count(`audit_log where tenant_id = $1 and entity_id = $2 and action = 'update'`, [f.auth.tenantId, request.id])
    expect(audited).toBe(1)
    const movementAudit = await count(`audit_log where tenant_id = $1 and entity = 'stock_movement'`, [f.auth.tenantId])
    expect(movementAudit).toBeGreaterThanOrEqual(1)
  }, 60_000)

  it('raises the price to the margin floor through the inventory update', async () => {
    const f = await fixture('exec-price')
    await scan(f.auth)
    const request = of(await pendingApprovals(f.auth), 'price_adjustment')
    const before = (await getItem(f.auth, f.thin.id)).data
    const outcome = await approve(f.auth, request)
    expect(outcome.body.data.status).toBe('executed')
    expect(outcome.body.data.resultJson?.summaryAr).toContain('1.000 د.ك')
    const after = (await getItem(f.auth, f.thin.id)).data
    expect(after).toMatchObject({ sellingPriceMinor: 1_000, unitCostMinor: before.unitCostMinor, name: before.name, reorderLevel: before.reorderLevel })
    expect(after.version).toBe(before.version + 1)
    const audit = await count(`audit_log where tenant_id = $1 and entity = 'item' and entity_id = $2 and action = 'update'`, [f.auth.tenantId, f.thin.id])
    expect(audit).toBe(1)
    // The finding is fixed, so the next scan resolves it.
    const result = await scan(f.auth)
    expect((await liveInsights(f.auth)).map((insight) => insight.ruleKey)).not.toContain('finance.margin_floor')
    expect(result.insightsResolved).toBeGreaterThanOrEqual(1)
  }, 60_000)

  it('blocks the customer for a credit hold, and only that field changes', async () => {
    const f = await fixture('exec-hold')
    await scan(f.auth)
    const request = of(await pendingApprovals(f.auth), 'credit_hold')
    const before = (await getCustomer(f.auth, f.customer.id)).data
    const outcome = await approve(f.auth, request)
    expect(outcome.body.data.resultJson?.summaryAr).toContain('حُظر العميل')
    const after = (await getCustomer(f.auth, f.customer.id)).data
    expect(after).toMatchObject({ status: 'blocked', name: before.name, phone: before.phone, creditLimitMinor: before.creditLimitMinor })
    expect(after.version).toBe(before.version + 1)
    const audit = await count(`audit_log where tenant_id = $1 and entity = 'customer' and entity_id = $2 and action = 'update'`, [f.auth.tenantId, f.customer.id])
    expect(audit).toBe(1)
  }, 60_000)

  it('discounts every unit price of the draft quotation and recomputes the totals once', async () => {
    const f = await fixture('exec-discount')
    await scan(f.auth)
    const request = of(await pendingApprovals(f.auth), 'discount_approval')
    const outcome = await approve(f.auth, request)
    expect(outcome.body.data.status).toBe('executed')

    const quote = (await getQuotation(f.auth, f.quote.id)).data
    // 6,000 and 2,000 less 5% are 5,700 and 1,900. Net 5,700 + 3,800 = 9,500. Tax 5% of 5,700 = 285. Total 9,785.
    expect(quote.lines.map((line) => line.unitPriceMinor)).toEqual([5_700, 1_900])
    expect(quote).toMatchObject({ subtotalMinor: 9_500, taxMinor: 285, totalMinor: 9_785, status: 'draft' })
    expect(quote.version).toBe(f.quote.version + 1)
    expect(outcome.body.data.resultJson?.summaryAr).toContain('9.785 د.ك')
    const audit = await count(`audit_log where tenant_id = $1 and entity = 'quotation' and entity_id = $2 and action = 'update'`, [f.auth.tenantId, f.quote.id])
    expect(audit).toBe(1)
  }, 60_000)

  it('writes a ready message for a reminder and changes nothing in finance or CRM', async () => {
    const f = await fixture('exec-reminder')
    await scan(f.auth)
    const request = of(await pendingApprovals(f.auth), 'payment_reminder')
    const invoiceBefore = (await getInvoice(f.auth, f.invoiceId)).data
    const customerBefore = (await getCustomer(f.auth, f.customer.id)).data
    const outcome = await approve(f.auth, request)

    const message = outcome.body.data.resultJson?.message
    expect(message?.textAr).toContain('السيد/ة شركة النور المحترم/ة')
    expect(message?.textAr).toContain(`- ${f.invoiceNumber}: 2,000.000 د.ك (متأخرة 45 يومًا)`)
    expect(message?.phone).toBe('96555512345')
    expect(message?.whatsappUrl).toBe(`https://wa.me/96555512345?text=${encodeURIComponent(message?.textAr ?? '')}`)
    expect((await getInvoice(f.auth, f.invoiceId)).data).toEqual(invoiceBefore)
    expect((await getCustomer(f.auth, f.customer.id)).data).toEqual(customerBefore)
    const audit = await count(`audit_log where tenant_id = $1 and entity_id = $2 and action = 'update'`, [f.auth.tenantId, request.id])
    expect(audit).toBe(1)
  }, 60_000)

  it('gives the message without a link when the approver cannot read customers', async () => {
    const f = await fixture('exec-nolink')
    await scan(f.auth)
    const request = of(await pendingApprovals(f.auth), 'payment_reminder')
    const outcome = await approve(authWithout(f.auth, permissions.crmCustomerRead), request)
    expect(outcome.body.data.resultJson?.message).toMatchObject({ phone: null, whatsappUrl: null })
    expect(outcome.body.data.resultJson?.message?.textAr).toContain('شركة النور')
  }, 60_000)

  it('writes a follow-up message for a stalled lead and leaves the lead alone', async () => {
    const f = await fixture('exec-followup')
    await scan(f.auth)
    const request = of(await pendingApprovals(f.auth), 'lead_followup')
    const outcome = await approve(f.auth, request)
    expect(outcome.body.data.resultJson?.message?.textAr).toContain('«عقد توريد»')
    expect(outcome.body.data.resultJson?.message?.whatsappUrl).toContain('https://wa.me/96555512345')
    expect(outcome.body.data.resultJson?.refs.map((ref) => ref.type)).toEqual(['lead', 'customer'])
    const lead = await getPglite().query<{ stage: string; version: number }>('select stage, version from crm_leads_pipeline where id = $1', [f.lead.id])
    expect(lead.rows[0]).toEqual({ stage: 'qualified', version: f.lead.version })
  }, 60_000)
})

describe('approval safety', () => {
  it('replays the same key without acting twice, and refuses the key for a different request', async () => {
    const f = await fixture('idem')
    await scan(f.auth)
    const request = (await pendingApprovals(f.auth)).find((a) => a.actionType === 'auto_reorder' && a.ruleKey === 'inventory.low_stock')
    if (!request) throw new Error('missing request')
    const key = nextKey()
    const first = await approve(f.auth, request, key, 'أ')
    const replay = await approve(f.auth, request, key, 'أ')
    expect(replay.replayed).toBe(true)
    expect(replay.body).toEqual(first.body)
    expect(await count(`stock_movements where tenant_id = $1 and reference_type = 'restock'`, [f.auth.tenantId])).toBe(1)
    await expect(approve(f.auth, request, key, 'ب')).rejects.toMatchObject({ status: 422, code: 'idempotency_key_reused' })
  }, 60_000)

  it('refuses a request that was decided already, whoever asks', async () => {
    const f = await fixture('decided')
    await scan(f.auth)
    const request = of(await pendingApprovals(f.auth), 'payment_reminder')
    const done = (await approve(f.auth, request)).body.data
    await expect(approveApproval(f.auth, request.id, nextKey(), { version: done.version, note: null })).rejects.toMatchObject({ code: 'invalid_transition' })
    await expect(rejectApproval(f.auth, request.id, { version: done.version, note: null })).rejects.toMatchObject({ code: 'invalid_transition' })

    const other = of(await pendingApprovals(f.auth), 'lead_followup')
    const rejected = (await rejectApproval(f.auth, other.id, { version: other.version, note: 'لاحقًا' })).data
    expect(rejected).toMatchObject({ status: 'rejected', decidedBy: f.auth.userId, decisionNote: 'لاحقًا' })
    await expect(approveApproval(f.auth, other.id, nextKey(), { version: rejected.version, note: null })).rejects.toMatchObject({ code: 'invalid_transition' })
  }, 60_000)

  it('returns 409 version_conflict for a stale version and 404 for an unknown request', async () => {
    const f = await fixture('version')
    await scan(f.auth)
    const request = of(await pendingApprovals(f.auth), 'payment_reminder')
    await expect(approveApproval(f.auth, request.id, nextKey(), { version: request.version + 1, note: null })).rejects.toMatchObject({ status: 409, code: 'version_conflict' })
    await expect(rejectApproval(f.auth, request.id, { version: request.version + 5, note: null })).rejects.toMatchObject({ status: 409, code: 'version_conflict' })
    await expect(approveApproval(f.auth, randomUUID(), nextKey(), { version: 1, note: null })).rejects.toMatchObject({ status: 404 })
    expect((await getApproval(f.auth, request.id)).data.status).toBe('pending')
  }, 60_000)

  it('needs the permission of the underlying action, not only the right to approve', async () => {
    const f = await fixture('perm-exec')
    await scan(f.auth)
    const approvals = await pendingApprovals(f.auth)
    const reorder = approvals.find((a) => a.actionType === 'auto_reorder' && a.ruleKey === 'inventory.low_stock')
    if (!reorder) throw new Error('missing request')
    const executive = authWith(f.auth, permissions.aiActionApprove, permissions.aiActionRead)
    await expect(approve(executive, reorder)).rejects.toMatchObject({ status: 403, code: 'forbidden' })
    await expect(approve(executive, of(approvals, 'credit_hold'))).rejects.toMatchObject({ status: 403 })
    await expect(approve(executive, of(approvals, 'price_adjustment'))).rejects.toMatchObject({ status: 403 })
    await expect(approve(executive, of(approvals, 'discount_approval'))).rejects.toMatchObject({ status: 403 })
    await expect(approve(executive, of(approvals, 'payment_reminder'))).rejects.toMatchObject({ status: 403 })
    expect((await getApproval(f.auth, reorder.id)).data.status).toBe('pending')
    expect(await count(`stock_movements where tenant_id = $1 and reference_type = 'restock'`, [f.auth.tenantId])).toBe(0)

    const granted = authWith(f.auth, permissions.aiActionApprove, permissions.aiActionRead, permissions.inventoryStockAdjust)
    expect((await approve(granted, reorder)).body.data.status).toBe('executed')
  }, 60_000)

  it('rolls everything back when the domain action fails', async () => {
    const f = await fixture('rollback')
    await scan(f.auth)
    const request = (await pendingApprovals(f.auth)).find((a) => a.actionType === 'auto_reorder' && a.ruleKey === 'inventory.low_stock')
    if (!request) throw new Error('missing request')
    // The proposal receives into the main warehouse. Make it inactive after the proposal was made.
    await updateWarehouse(f.auth, f.warehouse.id, {
      version: f.warehouse.version,
      name: f.warehouse.name,
      location: null,
      capacity: null,
      status: 'inactive',
    })

    const keys = await count('idempotency_keys where tenant_id = $1', [f.auth.tenantId])
    const key = nextKey()
    await expect(approve(f.auth, request, key)).rejects.toMatchObject({ code: 'warehouse_inactive' })
    expect((await getApproval(f.auth, request.id)).data).toMatchObject({ status: 'pending', version: request.version, resultJson: null })
    expect(await count(`stock_movements where tenant_id = $1 and reference_type = 'restock'`, [f.auth.tenantId])).toBe(0)
    expect(await count('idempotency_keys where tenant_id = $1', [f.auth.tenantId])).toBe(keys)
    expect(await count(`audit_log where tenant_id = $1 and entity_id = $2`, [f.auth.tenantId, request.id])).toBe(1)
  }, 60_000)

  it('refuses a restock whose stock already reached the target, and one whose cost changed', async () => {
    const f = await fixture('stale-reorder')
    await scan(f.auth)
    const approvals = await pendingApprovals(f.auth)
    const reorder = approvals.find((a) => a.actionType === 'auto_reorder' && a.ruleKey === 'inventory.low_stock')
    if (!reorder) throw new Error('missing request')
    await stockIn(f.auth, f.low, f.warehouse, 15)
    await expect(approve(f.auth, reorder)).rejects.toMatchObject({ code: 'proposal_stale' })

    const fast = approvals.find((a) => a.ruleKey === 'inventory.fast_depleting')
    if (!fast) throw new Error('missing request')
    const item = (await getItem(f.auth, f.fast.id)).data
    await updateItem(f.auth, f.fast.id, {
      version: item.version,
      name: item.name,
      unitCostMinor: 450,
      sellingPriceMinor: item.sellingPriceMinor,
      reorderLevel: item.reorderLevel,
      isActive: true,
    })
    await expect(approve(f.auth, fast)).rejects.toMatchObject({ code: 'proposal_stale' })
    expect((await getApproval(f.auth, fast.id)).data.status).toBe('pending')
  }, 60_000)

  it('refuses a price change when the price moved, and a discount when the draft was edited', async () => {
    const f = await fixture('stale-price')
    await scan(f.auth)
    const approvals = await pendingApprovals(f.auth)
    const item = (await getItem(f.auth, f.thin.id)).data
    await updateItem(f.auth, f.thin.id, {
      version: item.version,
      name: item.name,
      unitCostMinor: item.unitCostMinor,
      sellingPriceMinor: 950,
      reorderLevel: item.reorderLevel,
      isActive: true,
    })
    await expect(approve(f.auth, of(approvals, 'price_adjustment'))).rejects.toMatchObject({ code: 'proposal_stale' })

    const quote = (await getQuotation(f.auth, f.quote.id)).data
    await updateQuotation(f.auth, f.quote.id, {
      version: quote.version,
      customerId: quote.customerId,
      leadId: quote.leadId,
      validUntil: quote.validUntil,
      notes: 'تعديل يدوي',
      lines: quote.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        taxRateBps: line.taxRateBps,
        itemId: line.itemId,
        warehouseId: line.warehouseId,
      })),
    })
    await expect(approve(f.auth, of(approvals, 'discount_approval'))).rejects.toMatchObject({ code: 'proposal_stale' })
    expect((await getQuotation(f.auth, f.quote.id)).data.lines.map((line) => line.unitPriceMinor)).toEqual([6_000, 2_000])
  }, 60_000)

  it('refuses a credit hold once the debt is paid or the customer is already blocked, and a reminder once an invoice changed', async () => {
    const f = await fixture('stale-finance')
    await scan(f.auth)
    const approvals = await pendingApprovals(f.auth)
    const hold = of(approvals, 'credit_hold')
    const reminder = of(approvals, 'payment_reminder')

    const customer = (await getCustomer(f.auth, f.customer.id)).data
    const { updateCustomer } = await import('@/modules/crm')
    await updateCustomer(f.auth, f.customer.id, {
      name: customer.name,
      customerType: customer.customerType,
      email: customer.email,
      phone: customer.phone,
      taxId: customer.taxId,
      address: customer.address,
      creditLimitMinor: customer.creditLimitMinor,
      status: 'blocked',
      notes: customer.notes,
      version: customer.version,
    })
    await expect(approve(f.auth, hold)).rejects.toMatchObject({ code: 'customer_already_blocked' })

    const invoice = (await getInvoice(f.auth, f.invoiceId)).data
    await recordPayment(f.auth, f.invoiceId, nextKey(), {
      version: invoice.version,
      amountMinor: 100_000,
      currency: 'KWD',
      method: 'cash',
      paidAt: new Date().toISOString(),
      reference: null,
    })
    await expect(approve(f.auth, reminder)).rejects.toMatchObject({ code: 'proposal_stale' })
    expect((await getApproval(f.auth, hold.id)).data.status).toBe('pending')
    expect((await getApproval(f.auth, reminder.id)).data.status).toBe('pending')

    const paid = (await getInvoice(f.auth, f.invoiceId)).data
    await recordPayment(f.auth, f.invoiceId, nextKey(), {
      version: paid.version,
      amountMinor: paid.totalMinor - paid.paidMinor,
      currency: 'KWD',
      method: 'cash',
      paidAt: new Date().toISOString(),
      reference: null,
    })
    await expect(approve(f.auth, hold)).rejects.toMatchObject({ code: 'proposal_stale' })
  }, 60_000)

  it('refuses a follow-up once the lead is closed', async () => {
    const f = await fixture('stale-lead')
    await scan(f.auth)
    const request = of(await pendingApprovals(f.auth), 'lead_followup')
    await getPglite().query(`update crm_leads_pipeline set stage = 'lost', probability = 0 where id = $1`, [f.lead.id])
    await expect(approve(f.auth, request)).rejects.toMatchObject({ code: 'proposal_stale' })
  }, 60_000)
})

describe('isolation and rules', () => {
  it('keeps one tenant’s insights, requests and rules out of another’s reach', async () => {
    const a = await fixture('iso-a')
    const b = await newTenant('iso-b')
    await scan(a.auth)
    const request = of(await pendingApprovals(a.auth), 'payment_reminder')
    const insight = (await liveInsights(a.auth))[0]

    expect(await liveInsights(b)).toEqual([])
    expect(await pendingApprovals(b)).toEqual([])
    await expect(getApproval(b, request.id)).rejects.toMatchObject({ status: 404 })
    await expect(getInsight(b, insight.id)).rejects.toMatchObject({ status: 404 })
    await expect(approveApproval(b, request.id, nextKey(), { version: request.version, note: null })).rejects.toMatchObject({ status: 404 })
    await expect(rejectApproval(b, request.id, { version: request.version, note: null })).rejects.toMatchObject({ status: 404 })
    await expect(acknowledgeInsight(b, insight.id, { version: insight.version })).rejects.toMatchObject({ status: 404 })

    const empty = await scan(b)
    expect(empty).toMatchObject({ findings: 0, insightsCreated: 0, approvalsCreated: 0 })
    const rulesB = (await listRules(b)).data
    await expect(updateRule(a.auth, rulesB[0].id, { version: 1, name: 'x', isActive: true, conditionJson: {} })).rejects.toMatchObject({ status: 404 })
    expect((await pendingApprovals(a.auth)).length).toBe(7)
  }, 60_000)

  it('seeds the seven default rules for a new tenant and keeps them editable', async () => {
    const auth = await newTenant('rules')
    const rules = (await listRules(auth)).data
    expect(rules.map((rule) => rule.ruleKey).sort()).toEqual([
      'crm.discount_incentive',
      'crm.stalled_leads',
      'finance.credit_hold',
      'finance.margin_floor',
      'finance.payment_reminder',
      'inventory.fast_depleting',
      'inventory.low_stock',
    ])
    expect(rules.every((rule) => rule.isActive)).toBe(true)
    const low = rules.find((rule) => rule.ruleKey === 'inventory.low_stock')
    expect(low).toMatchObject({
      triggerEvent: 'inventory.item.reorder_level_reached',
      actionType: 'auto_reorder',
      conditionJson: { restockMultiplier: 2, targetCoverDays: 30, windowDays: 30, cooldownDays: 7 },
    })
    if (!low) throw new Error('missing rule')

    await expect(updateRule(auth, low.id, { version: low.version, name: low.name, isActive: true, conditionJson: { restockMultiplier: 0 } })).rejects.toMatchObject({
      status: 422,
      code: 'condition_invalid',
    })
    await expect(updateRule(auth, low.id, { version: low.version, name: low.name, isActive: true, conditionJson: { typo: 1 } })).rejects.toMatchObject({ status: 422 })
    const edited = (await updateRule(auth, low.id, { version: low.version, name: 'اسم جديد', isActive: false, conditionJson: { restockMultiplier: 3 } })).data
    expect(edited).toMatchObject({ name: 'اسم جديد', isActive: false, version: low.version + 1, conditionJson: { restockMultiplier: 3, targetCoverDays: 30 } })
    await expect(updateRule(auth, low.id, { version: low.version, name: 'x', isActive: true, conditionJson: {} })).rejects.toMatchObject({ status: 409, code: 'version_conflict' })
    expect(await count(`audit_log where tenant_id = $1 and entity = 'automation_rule' and entity_id = $2`, [auth.tenantId, low.id])).toBe(1)
  }, 60_000)

  it('moves insights forward only', async () => {
    const f = await fixture('insight-flow')
    await scan(f.auth)
    const insight = (await liveInsights(f.auth))[0]
    await expect(acknowledgeInsight(f.auth, insight.id, { version: insight.version + 1 })).rejects.toMatchObject({ status: 409, code: 'version_conflict' })
    const acknowledged = (await acknowledgeInsight(f.auth, insight.id, { version: insight.version })).data
    await expect(acknowledgeInsight(f.auth, insight.id, { version: acknowledged.version })).rejects.toMatchObject({ code: 'invalid_transition' })
    const resolved = (await resolveInsight(f.auth, insight.id, { version: acknowledged.version })).data
    expect(resolved.status).toBe('resolved')
    expect(resolved.resolvedAt).not.toBeNull()
    await expect(resolveInsight(f.auth, insight.id, { version: resolved.version })).rejects.toMatchObject({ code: 'invalid_transition' })
    // A manually resolved finding that is still true comes back as a new insight on the next scan.
    const result = await scan(f.auth)
    expect(result.insightsCreated).toBe(1)
    expect((await liveInsights(f.auth)).filter((entry) => entry.fingerprint === insight.fingerprint)).toHaveLength(1)
  }, 60_000)
})

describe('database guards', () => {
  it('refuses deletes, reopening, and a second pending request for one finding', async () => {
    const f = await fixture('guards')
    await scan(f.auth)
    const pg = getPglite()
    const request = of(await pendingApprovals(f.auth), 'payment_reminder')
    const insight = (await liveInsights(f.auth))[0]

    await expect(pg.query('delete from ai_action_approvals where id = $1', [request.id])).rejects.toThrow()
    await expect(pg.query('delete from ai_insights_alerts where id = $1', [insight.id])).rejects.toThrow()
    await expect(pg.query('delete from erp_automation_rules where tenant_id = $1', [f.auth.tenantId])).rejects.toThrow()
    await expect(
      pg.query(
        `insert into ai_action_approvals (tenant_id, rule_key, fingerprint, action_type, title_ar, summary_ar, payload_json, estimated_impact_fils, created_by)
         values ($1, $2, $3, 'payment_reminder', 't', 's', '{}'::jsonb, 1, $4)`,
        [f.auth.tenantId, request.ruleKey, request.fingerprint, f.auth.userId]
      )
    ).rejects.toThrow()
    await expect(pg.query(`update ai_action_approvals set status = 'approved' where id = $1`, [request.id])).rejects.toThrow()

    await approve(f.auth, request)
    await expect(pg.query(`update ai_action_approvals set status = 'pending', decided_at = null, decided_by = null, result_json = null where id = $1`, [request.id])).rejects.toThrow()
    await expect(pg.query(`update ai_action_approvals set payload_json = '{}'::jsonb where id = $1`, [request.id])).rejects.toThrow()

    const resolved = (await resolveInsight(f.auth, insight.id, { version: insight.version })).data
    await expect(pg.query(`update ai_insights_alerts set status = 'open', resolved_at = null where id = $1`, [resolved.id])).rejects.toThrow()
    await expect(pg.query(`update ai_insights_alerts set fingerprint = 'other' where id = $1`, [resolved.id])).rejects.toThrow()
  }, 60_000)

  it('rejects values outside the allowed sets', async () => {
    const f = await fixture('checks')
    const pg = getPglite()
    await expect(
      pg.query(
        `insert into ai_insights_alerts (tenant_id, rule_key, fingerprint, severity, category, title_ar, description_ar, metric_value, metric_unit, created_by)
         values ($1, 'r', 'f1', 'fatal', 'finance', 't', 'd', 1, 'count', $2)`,
        [f.auth.tenantId, f.auth.userId]
      )
    ).rejects.toThrow()
    await expect(
      pg.query(
        `insert into ai_action_approvals (tenant_id, rule_key, fingerprint, action_type, title_ar, summary_ar, payload_json, estimated_impact_fils, created_by)
         values ($1, 'r', 'f2', 'delete_everything', 't', 's', '{}'::jsonb, 1, $2)`,
        [f.auth.tenantId, f.auth.userId]
      )
    ).rejects.toThrow()
    await expect(
      pg.query(
        `insert into ai_action_approvals (tenant_id, rule_key, fingerprint, action_type, title_ar, summary_ar, payload_json, estimated_impact_fils, status, created_by)
         values ($1, 'r', 'f3', 'credit_hold', 't', 's', '{}'::jsonb, 1, 'executed', $2)`,
        [f.auth.tenantId, f.auth.userId]
      )
    ).rejects.toThrow()
  }, 60_000)
})

describe('dashboard and command bar', () => {
  it('reads the five KPIs live from finance, inventory and CRM', async () => {
    const f = await fixture('kpi')
    await scan(f.auth)
    const data = await getDashboard(f.auth)
    const stockValue = 5 * 500 + 40 * 400 + 100 * 800
    expect(data.kpis).toMatchObject({
      currency: 'KWD',
      receivables: { outstandingMinor: 2_000_000, overdueMinor: 2_000_000, overdueCount: 1 },
      inventory: { valuationMinor: stockValue, lowStockCount: 1, outOfStockCount: 0 },
      pipeline: { activeValueMinor: 5_000_000, activeCount: 1 },
      pendingApprovals: 7,
      openInsights: { critical: 2, warning: 3, opportunity: 2, total: 7 },
    })
    // The invoice was issued 60 days ago, so it is not this month's revenue unless the month happens to cover it.
    expect(data.kpis.revenue).not.toBeNull()
    expect(data.insights[0].severity).toBe('critical')
    expect(data.approvals).toHaveLength(7)
    expect(data.approvals[0].estimatedImpactFils).toBeGreaterThanOrEqual(data.approvals[6].estimatedImpactFils)
  }, 60_000)

  it('shows a block as unavailable instead of zero when the caller may not read it', async () => {
    const f = await fixture('kpi-perm')
    const data = await getDashboard(authWith(f.auth, permissions.aiInsightRead))
    expect(data.kpis).toMatchObject({ revenue: null, receivables: null, inventory: null, pipeline: null, pendingApprovals: null })
    expect(data.kpis.openInsights).toEqual({ critical: 0, warning: 0, opportunity: 0, total: 0 })
    expect(data.approvals).toEqual([])
  }, 60_000)

  it('runs the full scan from the Arabic phrase', async () => {
    const f = await fixture('cmd-scan')
    const outcome = await runCommand(f.auth, { text: 'فحص ذكي شامل للنظام' })
    expect(outcome.intent).toBe('scan')
    expect(outcome.scan).toMatchObject({ findings: 7, insightsCreated: 7 })
    expect(outcome.insights).toHaveLength(7)
    expect(outcome.insights[0].severity).toBe('critical')
    await expect(runCommand(authWithout(f.auth, permissions.aiScanRun), { text: 'فحص' })).rejects.toMatchObject({ status: 403 })
  }, 60_000)

  it('filters insights by words and searches records with direct links', async () => {
    const f = await fixture('cmd-search')
    await scan(f.auth)

    const inventory = await runCommand(f.auth, { text: 'المخزون' })
    expect(inventory.intent).toBe('filter')
    expect(inventory.insights.map((insight) => insight.category)).toEqual(['inventory', 'inventory'])

    const critical = await runCommand(f.auth, { text: 'الفواتير الحرجة' })
    expect(critical.insights.every((insight) => insight.category === 'finance' && insight.severity === 'critical')).toBe(true)
    expect(critical.insights.length).toBeGreaterThanOrEqual(2)

    const byNumber = await runCommand(f.auth, { text: f.invoiceNumber })
    expect(byNumber.intent).toBe('search')
    expect(byNumber.results).toContainEqual({
      kind: 'invoice',
      id: f.invoiceId,
      label: f.invoiceNumber,
      detail: 'شركة النور · 2,000.000 د.ك',
      href: `/erp/finance?invoice=${f.invoiceId}`,
    })

    const bySku = await runCommand(f.auth, { text: 'FAST' })
    expect(bySku.results).toContainEqual(expect.objectContaining({ kind: 'item', id: f.fast.id, href: `/erp/inventory?item=${f.fast.id}` }))

    const byName = await runCommand(f.auth, { text: 'النور' })
    expect(byName.results).toContainEqual(expect.objectContaining({ kind: 'customer', id: f.customer.id, label: 'شركة النور', href: `/erp/crm?customer=${f.customer.id}` }))

    const none = await runCommand(f.auth, { text: 'لاشيءمطلقا' })
    expect(none.results).toEqual([])
  }, 60_000)

  it('searches only what the caller may read', async () => {
    const f = await fixture('cmd-perm')
    const limited = authWith(f.auth, permissions.aiInsightRead, permissions.inventoryItemRead)
    const outcome = await runCommand(limited, { text: 'FAST' })
    expect(outcome.results.map((result) => result.kind)).toEqual(['item'])
    expect((await runCommand(limited, { text: f.invoiceNumber })).results).toEqual([])
    expect((await runCommand(authWith(f.auth, permissions.inventoryItemRead), { text: 'مخزون' })).insights).toEqual([])
  }, 60_000)
})

describe('event processor', () => {
  it('looks at an item as soon as its stock reaches the reorder level, once, and for that item only', async () => {
    const auth = await newTenant('events')
    const warehouse = (await createWarehouse(auth, nextKey(), { code: 'MAIN', name: 'رئيسي', location: null, capacity: null, status: 'active' })).body.data
    const watched = await newItem(auth, warehouse, 'WATCHED', { stock: 30, reorderLevel: 10, costMinor: 250, priceMinor: 600 })
    // Already low before the processor is on. The event for WATCHED must not pick it up.
    const bystander = await newItem(auth, warehouse, 'BYSTANDER', { stock: 4, reorderLevel: 10, costMinor: 250, priceMinor: 600 })
    expect(bystander.id).not.toBe(watched.id)

    registerAiEventHandlers()
    registerAiEventHandlers()
    await stockOut(auth, watched, warehouse, 22)

    const insights = await liveInsights(auth)
    expect(insights).toHaveLength(1)
    expect(insights[0]).toMatchObject({ ruleKey: 'inventory.low_stock', sourceEntityId: watched.id, status: 'open', createdBy: auth.userId })
    const approvals = await pendingApprovals(auth)
    expect(approvals).toHaveLength(1)
    expect(approvals[0]).toMatchObject({ actionType: 'auto_reorder', payloadJson: { itemId: watched.id, quantity: 14, targetStock: 22 } })

    // The same event delivered again changes nothing: same insight, same request, same version.
    await handleInventoryEvent({
      name: 'inventory.item.reorder_level_reached',
      version: 1,
      occurredAt: new Date().toISOString(),
      tenantId: auth.tenantId,
      payload: { itemId: watched.id, sku: 'WATCHED', name: 'x', currentStock: 8, reorderLevel: 10 },
    })
    expect(await liveInsights(auth)).toHaveLength(1)
    const again = await pendingApprovals(auth)
    expect(again).toHaveLength(1)
    expect([again[0].id, again[0].version]).toEqual([approvals[0].id, approvals[0].version])
    expect(await count(`audit_log where tenant_id = $1 and entity = 'ai_scan'`, [auth.tenantId])).toBeGreaterThanOrEqual(1)
  }, 60_000)
})
