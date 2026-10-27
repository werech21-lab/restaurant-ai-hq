import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import { AppError } from '@/lib/api/errors'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions } from '@/lib/auth/permissions'
import { DomainError } from '@/lib/domain-error'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

import {
  acknowledgeInsight,
  approveApproval,
  getApproval,
  getInsight,
  listApprovals,
  listInsights,
  listRules,
  rejectApproval,
  resolveInsight,
  runScan,
  updateRule,
} from '@/modules/ai'
import { listApprovalsQuerySchema, listInsightsQuerySchema } from '@/modules/ai/schemas/ai'
import {
  convertQuotation,
  createCustomer,
  createLead,
  createQuotation,
  getCustomer,
  getCustomerProfile,
  getLead,
  getQuotation,
  listCustomers,
  listLeads,
  listQuotations,
  moveLead,
  sendQuotation,
  updateCustomer,
  updateLead,
  updateQuotation,
} from '@/modules/crm'
import { listCustomersQuerySchema } from '@/modules/crm/schemas/customer'
import { listLeadsQuerySchema } from '@/modules/crm/schemas/lead'
import { listQuotationsQuerySchema } from '@/modules/crm/schemas/quotation'
import {
  approveInvoice,
  createInvoice,
  getInvoice,
  listInvoices,
  recordPayment,
  submitInvoice,
  updateInvoice,
  voidInvoice,
} from '@/modules/finance'
import { listInvoicesQuerySchema } from '@/modules/finance/schemas/invoice'
import {
  createItem,
  createWarehouse,
  getItem,
  getWarehouse,
  listBalances,
  listItems,
  listMovements,
  listWarehouses,
  recordMovement,
  updateItem,
  updateWarehouse,
} from '@/modules/inventory'
import { listBalancesQuerySchema, listItemsQuerySchema, listMovementsQuerySchema, listWarehousesQuerySchema } from '@/modules/inventory/schemas/inventory'

/**
 * One company must never read, change or attach to another company's records, and a branch (warehouse) of one company
 * must never receive or send stock for another. Every service is called as company B against company A's real ids.
 * After the attempts, company A's rows must be byte for byte what they were.
 */

type Company = {
  auth: AuthContext
  warehouseId: string
  branchId: string
  itemId: string
  customerId: string
  draftInvoiceId: string
  issuedInvoiceId: string
  leadId: string
  quotationId: string
  insightId: string
  approvalId: string
  ruleId: string
}

let keyCounter = 0
const nextKey = () => `iso-key-${String(++keyCounter).padStart(8, '0')}`
let counter = 0
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

let a: Company
let b: Company

const SNAPSHOT_TABLES = [
  'invoices',
  'invoice_lines',
  'payments',
  'items',
  'warehouses',
  'customers',
  'crm_leads_pipeline',
  'sales_quotations',
  'sales_quotation_lines',
  'stock_movements',
  'stock_balances',
  'ai_insights_alerts',
  'ai_action_approvals',
  'erp_automation_rules',
  'audit_log',
] as const

async function snapshot(tenantId: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  for (const table of SNAPSHOT_TABLES) {
    const rows = await getPglite().query<{ n: number; digest: string | null }>(
      `select count(*)::int as n, md5(coalesce(string_agg(t::text, '|' order by t.id), '')) as digest from ${table} t where t.tenant_id = $1`,
      [tenantId]
    )
    result[table] = `${rows.rows[0].n}:${rows.rows[0].digest}`
  }
  return result
}

async function outcome(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof AppError) return `app:${error.status}:${error.code}`
    if (error instanceof DomainError) return `domain:${error.code}`
    if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') return `pg:${error.code}`
    throw error
  }
  return 'allowed'
}

const REFUSED = /^(app:(404|409|422):|domain:|pg:(23503|23514|23505))/

async function buildCompany(label: string): Promise<Company> {
  const userId = randomUUID()
  await createUser(userId)
  const tenantId = await bootstrapTenant(`Company ${label}`, `iso-${label}-${++counter}`, userId)
  const auth: AuthContext = { userId, tenantId, permissions: new Set<string>(allPermissions) }

  const warehouse = (await createWarehouse(auth, nextKey(), { code: 'MAIN', name: `Main ${label}`, location: null, capacity: null, status: 'active' })).body.data
  const branch = (await createWarehouse(auth, nextKey(), { code: 'BR1', name: `Branch ${label}`, location: null, capacity: null, status: 'active' })).body.data
  const item = (
    await createItem(auth, nextKey(), {
      sku: `SKU-${label}`,
      name: `Item ${label}`,
      unit: 'piece',
      unitCostMinor: 500,
      sellingPriceMinor: 1_000,
      reorderLevel: 10,
      isActive: true,
    })
  ).body.data
  await recordMovement(auth, nextKey(), { type: 'IN', itemId: item.id, warehouseId: warehouse.id, quantity: 8, note: null })
  const customer = await createCustomer(auth, {
    name: `Customer ${label}`,
    customerType: 'company',
    email: null,
    phone: null,
    taxId: null,
    address: null,
    creditLimitMinor: null,
    status: 'active',
    notes: null,
  })
  const line = { description: 'Sale', quantity: 1, unitPriceMinor: 1_000, taxRateBps: 0, itemId: item.id, warehouseId: warehouse.id }
  const draft = (await createInvoice(auth, nextKey(), { customerId: customer.id, issueDate: day(0), dueDate: day(30), notes: null, lines: [line] })).body.data
  const toIssue = (await createInvoice(auth, nextKey(), { customerId: customer.id, issueDate: day(-60), dueDate: day(-45), notes: null, lines: [line] })).body.data
  const issued = (await submitInvoice(auth, toIssue.id, { version: toIssue.version })).data
  const lead = (
    await createLead(auth, nextKey(), {
      customerId: customer.id,
      title: `Lead ${label}`,
      stage: 'qualified',
      expectedRevenueMinor: 5_000,
      probability: 70,
      assignedTo: null,
      expectedCloseDate: null,
      notes: null,
    })
  ).body.data
  const quotation = (
    await createQuotation(auth, nextKey(), {
      customerId: customer.id,
      leadId: lead.id,
      validUntil: day(30),
      notes: null,
      lines: [{ description: 'Quote', quantity: 1, unitPriceMinor: 2_000, taxRateBps: 0, itemId: null, warehouseId: null }],
    })
  ).body.data
  await runScan(auth, { trigger: null, itemIds: null })
  const insight = (await listInsights(auth, listInsightsQuerySchema.parse({ limit: '100' }))).data[0]
  const approval = (await listApprovals(auth, listApprovalsQuerySchema.parse({ limit: '100', status: 'pending' }))).data[0]
  const rule = (await listRules(auth)).data[0]
  if (!insight || !approval || !rule) throw new Error('The scan produced no insight, approval or rule to attack')

  return {
    auth,
    warehouseId: warehouse.id,
    branchId: branch.id,
    itemId: item.id,
    customerId: customer.id,
    draftInvoiceId: draft.id,
    issuedInvoiceId: issued.id,
    leadId: lead.id,
    quotationId: quotation.id,
    insightId: insight.id,
    approvalId: approval.id,
    ruleId: rule.id,
  }
}

beforeAll(async () => {
  await startDatabase()
  a = await buildCompany('a')
  b = await buildCompany('b')
}, 180_000)
afterAll(stopDatabase)

describe('reading another company\'s records by id', () => {
  it('answers 404 for every record type, never the record', async () => {
    const attempts: Record<string, Promise<unknown>> = {
      item: getItem(b.auth, a.itemId),
      warehouse: getWarehouse(b.auth, a.warehouseId),
      branch: getWarehouse(b.auth, a.branchId),
      invoice: getInvoice(b.auth, a.draftInvoiceId),
      issuedInvoice: getInvoice(b.auth, a.issuedInvoiceId),
      customer: getCustomer(b.auth, a.customerId),
      customerProfile: getCustomerProfile(b.auth, a.customerId),
      lead: getLead(b.auth, a.leadId),
      quotation: getQuotation(b.auth, a.quotationId),
      insight: getInsight(b.auth, a.insightId),
      approval: getApproval(b.auth, a.approvalId),
    }
    for (const [name, promise] of Object.entries(attempts)) {
      expect(await outcome(promise), name).toMatch(/^app:404:/)
    }
  })

  it('answers 404 for ids that do not exist at all, the same as for another company\'s ids', async () => {
    const ghost = randomUUID()
    expect(await outcome(getInvoice(b.auth, ghost))).toBe(await outcome(getInvoice(b.auth, a.draftInvoiceId)))
    expect(await outcome(getItem(b.auth, ghost))).toBe(await outcome(getItem(b.auth, a.itemId)))
  })
})

describe('lists never include another company\'s rows', () => {
  it('returns only the caller\'s records from every list endpoint', async () => {
    const own = (rows: readonly { id: string }[]) => rows.map((row) => row.id)
    const lists: [string, string[], string[]][] = [
      ['items', own((await listItems(b.auth, listItemsQuerySchema.parse({ limit: '100' }))).data), [a.itemId]],
      ['warehouses', own((await listWarehouses(b.auth, listWarehousesQuerySchema.parse({ limit: '100' }))).data), [a.warehouseId, a.branchId]],
      ['invoices', own((await listInvoices(b.auth, listInvoicesQuerySchema.parse({ limit: '100' }))).data), [a.draftInvoiceId, a.issuedInvoiceId]],
      ['customers', own((await listCustomers(b.auth, listCustomersQuerySchema.parse({ limit: '100' }))).data), [a.customerId]],
      ['leads', own((await listLeads(b.auth, listLeadsQuerySchema.parse({ limit: '100' }))).data), [a.leadId]],
      ['quotations', own((await listQuotations(b.auth, listQuotationsQuerySchema.parse({ limit: '100' }))).data), [a.quotationId]],
      ['insights', own((await listInsights(b.auth, listInsightsQuerySchema.parse({ limit: '100' }))).data), [a.insightId]],
      ['approvals', own((await listApprovals(b.auth, listApprovalsQuerySchema.parse({ limit: '100', status: 'all' }))).data), [a.approvalId]],
      ['rules', own((await listRules(b.auth)).data), [a.ruleId]],
    ]
    for (const [name, seen, foreign] of lists) {
      expect(seen.length, `${name} is not empty, so the check means something`).toBeGreaterThan(0)
      expect(seen.filter((id) => foreign.includes(id)), name).toEqual([])
    }
    const movements = (await listMovements(b.auth, listMovementsQuerySchema.parse({ limit: '100' }))).data
    expect(movements.length).toBeGreaterThan(0)
    expect(movements.filter((movement) => movement.itemId === a.itemId || movement.warehouseId === a.warehouseId)).toEqual([])
    const balances = (await listBalances(b.auth, listBalancesQuerySchema.parse({ limit: '100' }))).data
    expect(balances.length).toBeGreaterThan(0)
    expect(balances.filter((balance) => balance.itemId === a.itemId)).toEqual([])
  })
})

describe('changing another company\'s records', () => {
  it('refuses every update, status change, payment, approval and decision, and leaves company A untouched', async () => {
    const before = await snapshot(a.auth.tenantId)
    const line = { description: 'x', quantity: 1, unitPriceMinor: 1, taxRateBps: 0, itemId: null, warehouseId: null }
    const attempts: Record<string, Promise<unknown>> = {
      updateItem: updateItem(b.auth, a.itemId, { version: 1, name: 'pwned', unitCostMinor: 1, sellingPriceMinor: 1, reorderLevel: 0, isActive: false }),
      updateWarehouse: updateWarehouse(b.auth, a.warehouseId, { version: 1, name: 'pwned', location: null, capacity: null, status: 'inactive' }),
      updateBranch: updateWarehouse(b.auth, a.branchId, { version: 1, name: 'pwned', location: null, capacity: null, status: 'inactive' }),
      updateCustomer: updateCustomer(b.auth, a.customerId, {
        version: 1,
        name: 'pwned',
        customerType: 'company',
        email: null,
        phone: null,
        taxId: null,
        address: null,
        creditLimitMinor: 0,
        status: 'blocked',
        notes: null,
      }),
      updateLead: updateLead(b.auth, a.leadId, {
        version: 1,
        title: 'pwned',
        expectedRevenueMinor: 0,
        probability: 0,
        assignedTo: null,
        expectedCloseDate: null,
        notes: null,
      }),
      moveLead: moveLead(b.auth, a.leadId, { stage: 'won', version: 1 }),
      updateQuotation: updateQuotation(b.auth, a.quotationId, { version: 1, customerId: a.customerId, leadId: null, validUntil: day(10), notes: null, lines: [line] }),
      sendQuotation: sendQuotation(b.auth, a.quotationId, { version: 1 }),
      convertQuotation: convertQuotation(b.auth, nextKey(), a.quotationId, { version: 1 }),
      updateInvoice: updateInvoice(b.auth, a.draftInvoiceId, { version: 1, customerId: a.customerId, issueDate: day(0), dueDate: day(5), notes: null, lines: [line] }),
      submitInvoice: submitInvoice(b.auth, a.draftInvoiceId, { version: 1 }),
      approveInvoice: approveInvoice(b.auth, a.issuedInvoiceId, { version: 2 }),
      voidInvoice: voidInvoice(b.auth, a.issuedInvoiceId, { version: 2, reason: 'attack' }),
      recordPayment: recordPayment(b.auth, a.issuedInvoiceId, nextKey(), {
        version: 2,
        amountMinor: 1,
        currency: 'KWD',
        method: 'cash',
        paidAt: new Date().toISOString(),
        reference: null,
      }),
      approveApproval: approveApproval(b.auth, a.approvalId, nextKey(), { version: 1, note: null }),
      rejectApproval: rejectApproval(b.auth, a.approvalId, { version: 1, note: null }),
      acknowledgeInsight: acknowledgeInsight(b.auth, a.insightId, { version: 1 }),
      resolveInsight: resolveInsight(b.auth, a.insightId, { version: 1 }),
      updateRule: updateRule(b.auth, a.ruleId, { version: 1, name: 'pwned', isActive: false, conditionJson: {} }),
    }
    const results: Record<string, string> = {}
    for (const [name, promise] of Object.entries(attempts)) results[name] = await outcome(promise)
    for (const [name, result] of Object.entries(results)) expect(result, name).toMatch(REFUSED)
    expect(await snapshot(a.auth.tenantId)).toEqual(before)
  })
})

describe('attaching to another company\'s records', () => {
  it('refuses to create anything that points at company A\'s customer, item, warehouse, lead or branch', async () => {
    const beforeA = await snapshot(a.auth.tenantId)
    const beforeB = await snapshot(b.auth.tenantId)
    const foreignLine = { description: 'x', quantity: 1, unitPriceMinor: 1_000, taxRateBps: 0, itemId: a.itemId, warehouseId: a.warehouseId }
    const ownLine = { description: 'x', quantity: 1, unitPriceMinor: 1_000, taxRateBps: 0, itemId: null, warehouseId: null }
    const attempts: Record<string, Promise<unknown>> = {
      invoiceForForeignCustomer: createInvoice(b.auth, nextKey(), { customerId: a.customerId, issueDate: day(0), dueDate: day(30), notes: null, lines: [ownLine] }),
      invoiceWithForeignStock: createInvoice(b.auth, nextKey(), { customerId: b.customerId, issueDate: day(0), dueDate: day(30), notes: null, lines: [foreignLine] }),
      invoiceWithForeignWarehouse: createInvoice(b.auth, nextKey(), {
        customerId: b.customerId,
        issueDate: day(0),
        dueDate: day(30),
        notes: null,
        lines: [{ ...foreignLine, itemId: b.itemId }],
      }),
      stockIntoForeignWarehouse: recordMovement(b.auth, nextKey(), { type: 'IN', itemId: b.itemId, warehouseId: a.warehouseId, quantity: 5, note: null }),
      stockIntoForeignBranch: recordMovement(b.auth, nextKey(), { type: 'IN', itemId: b.itemId, warehouseId: a.branchId, quantity: 5, note: null }),
      stockOfForeignItem: recordMovement(b.auth, nextKey(), { type: 'IN', itemId: a.itemId, warehouseId: b.warehouseId, quantity: 5, note: null }),
      transferToForeignBranch: recordMovement(b.auth, nextKey(), {
        type: 'TRANSFER',
        itemId: b.itemId,
        fromWarehouseId: b.warehouseId,
        toWarehouseId: a.branchId,
        quantity: 2,
        note: null,
      }),
      transferFromForeignWarehouse: recordMovement(b.auth, nextKey(), {
        type: 'TRANSFER',
        itemId: b.itemId,
        fromWarehouseId: a.warehouseId,
        toWarehouseId: b.warehouseId,
        quantity: 2,
        note: null,
      }),
      leadForForeignCustomer: createLead(b.auth, nextKey(), {
        customerId: a.customerId,
        title: 'x',
        stage: 'new',
        expectedRevenueMinor: 1,
        probability: 10,
        assignedTo: null,
        expectedCloseDate: null,
        notes: null,
      }),
      quotationForForeignCustomer: createQuotation(b.auth, nextKey(), { customerId: a.customerId, leadId: null, validUntil: day(10), notes: null, lines: [ownLine] }),
      quotationWithForeignLead: createQuotation(b.auth, nextKey(), { customerId: b.customerId, leadId: a.leadId, validUntil: day(10), notes: null, lines: [ownLine] }),
      quotationWithForeignItem: createQuotation(b.auth, nextKey(), { customerId: b.customerId, leadId: null, validUntil: day(10), notes: null, lines: [foreignLine] }),
    }
    const results: Record<string, string> = {}
    for (const [name, promise] of Object.entries(attempts)) results[name] = await outcome(promise)
    for (const [name, result] of Object.entries(results)) expect(result, name).toMatch(REFUSED)
    expect(await snapshot(a.auth.tenantId)).toEqual(beforeA)
    expect(await snapshot(b.auth.tenantId)).toEqual(beforeB)
  })

  it('does not allow assigning a lead to a user who is not a member of the company', async () => {
    const outsider = randomUUID()
    await createUser(outsider)
    const result = await outcome(
      createLead(b.auth, nextKey(), {
        customerId: b.customerId,
        title: 'x',
        stage: 'new',
        expectedRevenueMinor: 1,
        probability: 10,
        assignedTo: outsider,
        expectedCloseDate: null,
        notes: null,
      })
    )
    expect(result).toMatch(REFUSED)
  })
})

describe('idempotency keys are private to a company', () => {
  it('does not replay company A\'s response to company B when B sends the same key and payload', async () => {
    const key = nextKey()
    const payload = { sku: 'SHARED-KEY', name: 'Shared', unit: 'piece', unitCostMinor: 1, sellingPriceMinor: 2, reorderLevel: 0, isActive: true } as const
    const first = await createItem(a.auth, key, payload)
    const second = await createItem(b.auth, key, payload)
    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(false)
    expect(second.body.data.id).not.toBe(first.body.data.id)
    const owner = await getPglite().query<{ tenant_id: string }>('select tenant_id from items where id = $1', [second.body.data.id])
    expect(owner.rows[0].tenant_id).toBe(b.auth.tenantId)
  })
})

describe('permissions inside one company', () => {
  const without = (company: Company, ...removed: string[]): AuthContext => ({
    ...company.auth,
    permissions: new Set(allPermissions.filter((permission) => !removed.includes(permission))),
  })

  it('refuses to approve or reject an AI request without ai.action.approve, even in the owner\'s own company', async () => {
    const result = await outcome(approveApproval(without(a, 'ai.action.approve'), a.approvalId, nextKey(), { version: 1, note: null }))
    expect(result).toMatch(/^app:403:/)
    expect(await outcome(rejectApproval(without(a, 'ai.action.approve'), a.approvalId, { version: 1, note: null }))).toMatch(/^app:403:/)
    const row = await getPglite().query<{ status: string }>('select status from ai_action_approvals where id = $1', [a.approvalId])
    expect(row.rows[0].status).toBe('pending')
  })

  it('refuses to convert a quotation without finance.invoice.create', async () => {
    const result = await outcome(convertQuotation(without(a, 'finance.invoice.create'), nextKey(), a.quotationId, { version: 1 }))
    expect(result).toMatch(/^app:403:/)
  })
})
