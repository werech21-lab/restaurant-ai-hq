import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  bootstrapTenant,
  createUser,
  getPglite,
  startDatabase,
  stopDatabase,
} from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions, permissions } from '@/lib/auth/permissions'
import { subscribe, type BusEvent } from '@/lib/events/bus'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

import {
  acceptQuotation,
  convertQuotation,
  createCustomer,
  createLead,
  createQuotation,
  expireQuotation,
  getCustomer,
  getCustomerProfile,
  getLead,
  getQuotation,
  getStageSummary,
  listCustomers,
  listLeads,
  listQuotations,
  listTeam,
  moveLead,
  rejectQuotation,
  sendQuotation,
  updateCustomer,
  updateLead,
  updateQuotation,
  type Customer,
  type Lead,
  type QuotationDetail,
} from '@/modules/crm'
import { approveInvoice, createInvoice, getInvoice, recordPayment, submitInvoice } from '@/modules/finance'
import { createItem, createWarehouse, recordMovement, type Item, type Warehouse } from '@/modules/inventory'
import { listCustomersQuerySchema, type CreateCustomerInput, type UpdateCustomerInput } from '@/modules/crm/schemas/customer'
import { listLeadsQuerySchema, type CreateLeadInput } from '@/modules/crm/schemas/lead'
import { listQuotationsQuerySchema, type QuotationLineInput } from '@/modules/crm/schemas/quotation'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

let authA: AuthContext
let authB: AuthContext
let warehouse: Warehouse
let cola: Item
const events: BusEvent[] = []

let keyCounter = 0
const nextKey = () => `crm-key-${String(++keyCounter).padStart(8, '0')}`
let counter = 0

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

function authWithout(auth: AuthContext, ...removed: string[]): AuthContext {
  return { ...auth, permissions: new Set(allPermissions.filter((permission) => !removed.includes(permission))) }
}

function customerInput(overrides: Partial<CreateCustomerInput> = {}): CreateCustomerInput {
  return {
    name: `Customer ${++counter}`,
    customerType: 'company',
    email: null,
    phone: null,
    taxId: null,
    address: null,
    creditLimitMinor: null,
    status: 'active',
    notes: null,
    ...overrides,
  }
}

function toUpdate(customer: Customer, overrides: Partial<UpdateCustomerInput> = {}): UpdateCustomerInput {
  return {
    name: customer.name,
    customerType: customer.customerType,
    email: customer.email,
    phone: customer.phone,
    taxId: customer.taxId,
    address: customer.address,
    creditLimitMinor: customer.creditLimitMinor,
    status: customer.status,
    notes: customer.notes,
    version: customer.version,
    ...overrides,
  }
}

function leadInput(customerId: string, overrides: Partial<CreateLeadInput> = {}): CreateLeadInput {
  return {
    customerId,
    title: `Lead ${++counter}`,
    stage: 'new',
    expectedRevenueMinor: 10_000,
    probability: 30,
    assignedTo: null,
    expectedCloseDate: null,
    notes: null,
    ...overrides,
  }
}

/** One stock line (10 cola at 1.500, 5% tax) plus one service line. Net 17,500, tax 750, total 18,250. */
function standardLines(): QuotationLineInput[] {
  return [
    {
      description: 'Cola 330ml',
      quantity: 10,
      unitPriceMinor: 1_500,
      taxRateBps: 500,
      itemId: cola.id,
      warehouseId: warehouse.id,
    },
    { description: 'Delivery', quantity: 1, unitPriceMinor: 2_500, taxRateBps: 0, itemId: null, warehouseId: null },
  ]
}

async function newCustomer(overrides: Partial<CreateCustomerInput> = {}, auth: AuthContext = authA): Promise<Customer> {
  return createCustomer(auth, customerInput(overrides))
}

async function newLead(customerId: string, overrides: Partial<CreateLeadInput> = {}, auth: AuthContext = authA): Promise<Lead> {
  return (await createLead(auth, nextKey(), leadInput(customerId, overrides))).body.data
}

async function newQuote(
  customerId: string,
  overrides: { leadId?: string | null; validUntil?: string; lines?: QuotationLineInput[]; notes?: string | null } = {},
  auth: AuthContext = authA
): Promise<QuotationDetail> {
  const outcome = await createQuotation(auth, nextKey(), {
    customerId,
    leadId: overrides.leadId ?? null,
    validUntil: overrides.validUntil ?? day(14),
    notes: overrides.notes ?? null,
    lines: overrides.lines ?? standardLines(),
  })
  return outcome.body.data
}

async function acceptedQuote(
  customerId: string,
  overrides: { leadId?: string | null; lines?: QuotationLineInput[] } = {}
): Promise<QuotationDetail> {
  const draft = await newQuote(customerId, overrides)
  const sent = await sendQuotation(authA, draft.id, { version: draft.version })
  return (await acceptQuotation(authA, draft.id, { version: sent.data.version })).data
}

async function convert(quote: QuotationDetail, auth: AuthContext = authA, key: string = nextKey()) {
  return convertQuotation(auth, key, quote.id, { version: quote.version })
}

async function onHand(itemId: string): Promise<number> {
  const result = await getPglite().query<{ on_hand: number }>(
    'select coalesce(sum(on_hand), 0)::int as on_hand from stock_balances where item_id = $1',
    [itemId]
  )
  return result.rows[0].on_hand
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const result = await getPglite().query<{ count: number }>(`select count(*)::int as count from ${sql}`, params)
  return result.rows[0].count
}

function eventNames(): string[] {
  return events.map((event) => event.name)
}

async function stockIn(quantity: number): Promise<void> {
  await recordMovement(authA, nextKey(), {
    type: 'IN',
    itemId: cola.id,
    warehouseId: warehouse.id,
    quantity,
    note: null,
  })
}

beforeAll(async () => {
  await startDatabase()
  await createUser(USER_A)
  await createUser(USER_B)
  const tenantA = await bootstrapTenant('Tenant A', 'tenant-a', USER_A)
  const tenantB = await bootstrapTenant('Tenant B', 'tenant-b', USER_B)
  authA = { userId: USER_A, tenantId: tenantA, permissions: new Set<string>(allPermissions) }
  authB = { userId: USER_B, tenantId: tenantB, permissions: new Set<string>(allPermissions) }
  warehouse = (
    await createWarehouse(authA, nextKey(), { code: 'MAIN', name: 'Main store', location: null, capacity: null, status: 'active' })
  ).body.data
  cola = (
    await createItem(authA, nextKey(), {
      sku: 'COLA-33',
      name: 'Cola 330ml',
      unit: 'piece',
      unitCostMinor: 700,
      sellingPriceMinor: 1_500,
      reorderLevel: 5,
      isActive: true,
    })
  ).body.data
  await stockIn(500)
  for (const name of [
    'crm.customer.created',
    'crm.customer.updated',
    'crm.lead.created',
    'crm.lead.moved',
    'crm.lead.won',
    'crm.lead.lost',
    'crm.quotation.created',
    'crm.quotation.status_changed',
    'crm.quotation.converted',
    'finance.invoice.created',
    'finance.invoice.submitted',
    'finance.invoice.issued',
    'inventory.stock.moved',
  ]) {
    subscribe(name, (event) => void events.push(event))
  }
}, 60_000)

afterAll(async () => {
  await stopDatabase()
})

describe('bootstrap permissions', () => {
  it('gives owners and accountants every CRM permission and viewers read only', async () => {
    const result = await getPglite().query<{ name: string; permission: string }>(
      `select r.name, rp.permission from roles r join role_permissions rp on rp.role_id = r.id
       where r.tenant_id = $1 and rp.permission like 'crm.%'`,
      [authA.tenantId]
    )
    const byRole = (name: string) => result.rows.filter((row) => row.name === name).map((row) => row.permission).sort()
    const crm = allPermissions.filter((permission) => permission.startsWith('crm.')).sort()
    expect(byRole('owner')).toEqual(crm)
    expect(byRole('accountant')).toEqual(crm)
    expect(byRole('viewer')).toEqual(['crm.customer.read', 'crm.lead.read', 'crm.quotation.read'])
    expect(byRole('approver')).toEqual(['crm.customer.read', 'crm.lead.read', 'crm.quotation.read'])
  })
})

describe('customers', () => {
  it('creates a customer with the new fields, an audit row and an event', async () => {
    events.length = 0
    const customer = await newCustomer({
      name: 'Al Noor Catering',
      taxId: 'TAX-1001',
      address: 'Kuwait City',
      creditLimitMinor: 50_000,
      status: 'prospect',
    })
    expect(customer).toMatchObject({
      customerType: 'company',
      taxId: 'TAX-1001',
      creditLimitMinor: 50_000,
      status: 'prospect',
      version: 1,
    })
    const audit = await getPglite().query<{ action: string }>(
      "select action from audit_log where entity = 'customer' and entity_id = $1",
      [customer.id]
    )
    expect(audit.rows).toEqual([{ action: 'create' }])
    expect(eventNames()).toContain('crm.customer.created')
  })

  it('updates by version, audits before and after, and returns 409 on a stale version', async () => {
    const customer = await newCustomer({ name: 'Old name' })
    const updated = await updateCustomer(authA, customer.id, toUpdate(customer, { name: 'New name', status: 'blocked' }))
    expect(updated.data).toMatchObject({ name: 'New name', status: 'blocked', version: 2 })
    await expect(updateCustomer(authA, customer.id, toUpdate(customer, { name: 'Late' }))).rejects.toMatchObject({
      status: 409,
      code: 'version_conflict',
    })
    const audit = await getPglite().query<{ before: { name: string }; after: { name: string } }>(
      "select before, after from audit_log where entity = 'customer' and entity_id = $1 and action = 'update'",
      [customer.id]
    )
    expect(audit.rows).toHaveLength(1)
    expect(audit.rows[0].before.name).toBe('Old name')
    expect(audit.rows[0].after.name).toBe('New name')
  })

  it('filters the list by status and searches name, phone and tax id', async () => {
    const unique = `Zeta-${Date.now()}`
    const lead = await newCustomer({ name: `${unique} Lead`, status: 'lead', taxId: `TX-${unique}` })
    await newCustomer({ name: `${unique} Active`, status: 'active' })
    const byStatus = await listCustomers(authA, listCustomersQuerySchema.parse({ q: unique, status: 'lead' }))
    expect(byStatus.data.map((row) => row.id)).toEqual([lead.id])
    const all = await listCustomers(authA, listCustomersQuerySchema.parse({ q: unique }))
    expect(all.data).toHaveLength(2)
    const byTax = await listCustomers(authA, listCustomersQuerySchema.parse({ q: `TX-${unique}` }))
    expect(byTax.data.map((row) => row.id)).toEqual([lead.id])
  })

  it('paginates with a cursor', async () => {
    const tag = `Page-${Date.now()}`
    for (let index = 0; index < 3; index += 1) await newCustomer({ name: `${tag} ${index}` })
    const first = await listCustomers(authA, listCustomersQuerySchema.parse({ q: tag, limit: '2' }))
    expect(first.data).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()
    const second = await listCustomers(authA, listCustomersQuerySchema.parse({ q: tag, limit: '2', cursor: first.nextCursor }))
    expect(second.data).toHaveLength(1)
    expect(second.nextCursor).toBeNull()
  })

  it('never shows or changes another tenant\'s customer', async () => {
    const customer = await newCustomer()
    await expect(getCustomer(authB, customer.id)).rejects.toMatchObject({ status: 404 })
    await expect(updateCustomer(authB, customer.id, toUpdate(customer))).rejects.toMatchObject({ status: 404 })
    await expect(getCustomerProfile(authB, customer.id)).rejects.toMatchObject({ status: 404 })
    const listed = await listCustomers(authB, listCustomersQuerySchema.parse({ q: customer.name }))
    expect(listed.data).toHaveLength(0)
  })

  it('refuses a customer status the database does not know', async () => {
    await expect(
      getPglite().query("update customers set status = 'inactive' where tenant_id = $1", [authA.tenantId])
    ).rejects.toThrow()
  })
})

describe('leads', () => {
  it('creates a lead in an open stage with audit, event and idempotent replay', async () => {
    events.length = 0
    const customer = await newCustomer()
    const key = nextKey()
    const input = leadInput(customer.id, { title: 'Ramadan catering', expectedRevenueMinor: 25_000, probability: 40 })
    const first = await createLead(authA, key, input)
    const second = await createLead(authA, key, input)
    expect(first.status).toBe(201)
    expect(second.replayed).toBe(true)
    expect(second.body.data.id).toBe(first.body.data.id)
    expect(first.body.data).toMatchObject({
      stage: 'new',
      probability: 40,
      expectedRevenueMinor: 25_000,
      customerName: customer.name,
    })
    expect(await count('crm_leads_pipeline where customer_id = $1', [customer.id])).toBe(1)
    expect(eventNames().filter((name) => name === 'crm.lead.created')).toHaveLength(1)
    await expect(createLead(authA, key, { ...input, title: 'Other' })).rejects.toMatchObject({
      status: 422,
      code: 'idempotency_key_reused',
    })
  })

  it('refuses a lead for a missing, foreign or blocked customer', async () => {
    const blocked = await newCustomer({ status: 'blocked' })
    await expect(createLead(authA, nextKey(), leadInput(blocked.id))).rejects.toMatchObject({ code: 'customer_blocked' })
    await expect(
      createLead(authA, nextKey(), leadInput('99999999-9999-4999-8999-999999999999'))
    ).rejects.toMatchObject({ code: 'customer_not_found' })
    const foreign = await newCustomer({}, authB)
    await expect(createLead(authA, nextKey(), leadInput(foreign.id))).rejects.toMatchObject({ code: 'customer_not_found' })
  })

  it('moves freely between open stages and keeps the probability', async () => {
    events.length = 0
    const customer = await newCustomer()
    let lead = await newLead(customer.id, { probability: 35 })
    for (const stage of ['contacted', 'qualified', 'proposal', 'qualified', 'new'] as const) {
      lead = (await moveLead(authA, lead.id, { stage, version: lead.version })).data
      expect(lead).toMatchObject({ stage, probability: 35 })
    }
    expect(eventNames().filter((name) => name === 'crm.lead.moved')).toHaveLength(5)
    expect(lead.version).toBe(6)
  })

  it('wins with probability 100, loses with probability 0, and then freezes', async () => {
    events.length = 0
    const customer = await newCustomer()
    const lead = await newLead(customer.id, { probability: 60 })
    const won = (await moveLead(authA, lead.id, { stage: 'won', version: lead.version })).data
    expect(won).toMatchObject({ stage: 'won', probability: 100 })
    expect(eventNames()).toEqual(expect.arrayContaining(['crm.lead.moved', 'crm.lead.won']))

    await expect(moveLead(authA, lead.id, { stage: 'new', version: won.version })).rejects.toMatchObject({
      code: 'invalid_transition',
    })
    await expect(
      updateLead(authA, lead.id, { ...leadInput(customer.id), version: won.version })
    ).rejects.toMatchObject({ code: 'not_editable' })

    const other = await newLead(customer.id, { probability: 60 })
    const lost = (await moveLead(authA, other.id, { stage: 'lost', version: other.version })).data
    expect(lost).toMatchObject({ stage: 'lost', probability: 0 })
    expect(eventNames()).toContain('crm.lead.lost')
  })

  it('has a database guard behind the final stages', async () => {
    const customer = await newCustomer()
    const lead = await newLead(customer.id)
    const won = (await moveLead(authA, lead.id, { stage: 'won', version: lead.version })).data
    await expect(
      getPglite().query("update crm_leads_pipeline set stage = 'new', probability = 10 where id = $1", [won.id])
    ).rejects.toThrow()
    await expect(
      getPglite().query("update crm_leads_pipeline set probability = 50 where id = $1", [won.id])
    ).rejects.toThrow()
    await expect(getPglite().query('delete from crm_leads_pipeline where id = $1', [won.id])).rejects.toThrow()
  })

  it('updates by version and returns 409 on a stale version', async () => {
    const customer = await newCustomer()
    const lead = await newLead(customer.id)
    const { customerId: _customerId, stage: _stage, ...fields } = leadInput(customer.id, {
      title: 'Renamed',
      expectedRevenueMinor: 77_000,
      probability: 80,
      assignedTo: USER_A,
      expectedCloseDate: day(30),
    })
    const updated = await updateLead(authA, lead.id, { ...fields, version: lead.version })
    expect(updated.data).toMatchObject({ title: 'Renamed', expectedRevenueMinor: 77_000, probability: 80, assignedTo: USER_A, version: 2 })
    await expect(updateLead(authA, lead.id, { ...fields, version: lead.version })).rejects.toMatchObject({
      status: 409,
      code: 'version_conflict',
    })
    await expect(moveLead(authA, lead.id, { stage: 'contacted', version: lead.version })).rejects.toMatchObject({
      status: 409,
      code: 'version_conflict',
    })
  })

  it('refuses to assign a lead to someone outside the tenant', async () => {
    const customer = await newCustomer()
    await expect(
      createLead(authA, nextKey(), leadInput(customer.id, { assignedTo: USER_B }))
    ).rejects.toMatchObject({ code: '23503' })
  })

  it('lists with filters, summarises per stage over all leads and isolates tenants', async () => {
    const customer = await newCustomer({}, authB)
    const a = await newLead(customer.id, { expectedRevenueMinor: 1_000, assignedTo: USER_B }, authB)
    await newLead(customer.id, { expectedRevenueMinor: 2_000 }, authB)
    const c = await newLead(customer.id, { expectedRevenueMinor: 500, stage: 'proposal' }, authB)
    await moveLead(authB, c.id, { stage: 'won', version: c.version })

    const summary = (await getStageSummary(authB)).data
    expect(summary.map((entry) => entry.stage)).toEqual(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'])
    expect(summary.find((entry) => entry.stage === 'new')).toEqual({ stage: 'new', count: 2, expectedRevenueMinor: 3_000 })
    expect(summary.find((entry) => entry.stage === 'won')).toEqual({ stage: 'won', count: 1, expectedRevenueMinor: 500 })
    expect(summary.find((entry) => entry.stage === 'lost')).toEqual({ stage: 'lost', count: 0, expectedRevenueMinor: 0 })

    const mine = await listLeads(authB, listLeadsQuerySchema.parse({ assignedTo: USER_B }))
    expect(mine.data.map((lead) => lead.id)).toEqual([a.id])
    const byStage = await listLeads(authB, listLeadsQuerySchema.parse({ stage: 'new', sort: 'expectedRevenueMinor', direction: 'desc' }))
    expect(byStage.data.map((lead) => lead.expectedRevenueMinor)).toEqual([2_000, 1_000])
    const page = await listLeads(authB, listLeadsQuerySchema.parse({ limit: '2', sort: 'expectedRevenueMinor', direction: 'asc' }))
    expect(page.data).toHaveLength(2)
    expect(page.nextCursor).not.toBeNull()

    await expect(getLead(authA, a.id)).rejects.toMatchObject({ status: 404 })
    expect((await listLeads(authA, listLeadsQuerySchema.parse({ customerId: customer.id }))).data).toHaveLength(0)
  })

  it('lists the tenant team for the assignee picker', async () => {
    const team = (await listTeam(authA)).data
    expect(team).toEqual([expect.objectContaining({ userId: USER_A, role: 'owner' })])
  })
})

describe('quotations', () => {
  it('creates a numbered draft with totals, lines, audit and event', async () => {
    events.length = 0
    const customer = await newCustomer({ name: 'Quote customer' })
    const quote = await newQuote(customer.id)
    expect(quote.quoteNumber).toMatch(/^QT-\d{6}$/)
    expect(quote).toMatchObject({
      status: 'draft',
      customerName: 'Quote customer',
      subtotalMinor: 17_500,
      taxMinor: 750,
      totalMinor: 18_250,
      version: 1,
      invoiceId: null,
    })
    expect(quote.lines.map((line) => [line.position, line.lineNetMinor])).toEqual([
      [1, 15_000],
      [2, 2_500],
    ])
    expect(await count("audit_log where entity = 'quotation' and entity_id = $1", [quote.id])).toBe(1)
    expect(eventNames()).toContain('crm.quotation.created')

  })

  it('refuses another tenant\'s stock item on a line', async () => {
    const foreignCustomer = await newCustomer({}, authB)
    await expect(newQuote(foreignCustomer.id, {}, authB)).rejects.toBeDefined()
    expect(await count('sales_quotations where customer_id = $1', [foreignCustomer.id])).toBe(0)
  })

  it('numbers each tenant from 1 and never repeats a number', async () => {
    const customerB = await newCustomer({}, authB)
    const itemB = (
      await createItem(authB, nextKey(), {
        sku: 'B-ITEM',
        name: 'B item',
        unit: 'piece',
        unitCostMinor: 1,
        sellingPriceMinor: 2,
        reorderLevel: 0,
        isActive: true,
      })
    ).body.data
    const warehouseB = (
      await createWarehouse(authB, nextKey(), { code: 'BW', name: 'B warehouse', location: null, capacity: null, status: 'active' })
    ).body.data
    const lines: QuotationLineInput[] = [
      { description: 'B', quantity: 1, unitPriceMinor: 100, taxRateBps: 0, itemId: itemB.id, warehouseId: warehouseB.id },
    ]
    const first = await newQuote(customerB.id, { lines }, authB)
    const second = await newQuote(customerB.id, { lines }, authB)
    expect([first.quoteNumber, second.quoteNumber]).toEqual(['QT-000001', 'QT-000002'])
    const customerA = await newCustomer()
    const a = await newQuote(customerA.id)
    const b = await newQuote(customerA.id)
    expect(a.quoteNumber).not.toBe(b.quoteNumber)
  })

  it('rounds tax half up once per quotation, not per line', async () => {
    const customer = await newCustomer()
    const line = (description: string): QuotationLineInput => ({
      description,
      quantity: 1,
      unitPriceMinor: 1_010,
      taxRateBps: 250,
      itemId: null,
      warehouseId: null,
    })
    const quote = await newQuote(customer.id, { lines: [line('One'), line('Two')] })
    // Each line's tax is 25.25 fils. Per line rounding would give 25 + 25 = 50. Once per quotation it is 50.5, which rounds to 51.
    expect(quote).toMatchObject({ subtotalMinor: 2_020, taxMinor: 51, totalMinor: 2_071 })
  })

  it('handles a zero-priced line and a zero total', async () => {
    const customer = await newCustomer()
    const quote = await newQuote(customer.id, {
      lines: [{ description: 'Free sample', quantity: 4, unitPriceMinor: 0, taxRateBps: 500, itemId: null, warehouseId: null }],
    })
    expect(quote).toMatchObject({ subtotalMinor: 0, taxMinor: 0, totalMinor: 0 })
  })

  it('replays an idempotent create and refuses the key with a different body', async () => {
    const customer = await newCustomer()
    const key = nextKey()
    const body = { customerId: customer.id, leadId: null, validUntil: day(7), notes: null, lines: standardLines() }
    const first = await createQuotation(authA, key, body)
    const second = await createQuotation(authA, key, body)
    expect(second.replayed).toBe(true)
    expect(second.body.data.id).toBe(first.body.data.id)
    expect(await count('sales_quotations where customer_id = $1', [customer.id])).toBe(1)
    await expect(createQuotation(authA, key, { ...body, validUntil: day(8) })).rejects.toMatchObject({
      status: 422,
      code: 'idempotency_key_reused',
    })
  })

  it('refuses invalid references and dates', async () => {
    const customer = await newCustomer()
    const other = await newCustomer()
    const blocked = await newCustomer({ status: 'blocked' })
    const otherLead = await newLead(other.id)
    const closedLead = await newLead(customer.id)
    await moveLead(authA, closedLead.id, { stage: 'lost', version: closedLead.version })

    await expect(newQuote(customer.id, { validUntil: day(-1) })).rejects.toMatchObject({ code: 'invalid_valid_until' })
    await expect(newQuote(blocked.id)).rejects.toMatchObject({ code: 'customer_blocked' })
    await expect(newQuote('99999999-9999-4999-8999-999999999999')).rejects.toMatchObject({ code: 'customer_not_found' })
    await expect(newQuote(customer.id, { leadId: otherLead.id })).rejects.toMatchObject({ code: 'lead_customer_mismatch' })
    await expect(newQuote(customer.id, { leadId: closedLead.id })).rejects.toMatchObject({ code: 'lead_closed' })
    await expect(newQuote(customer.id, { leadId: '99999999-9999-4999-8999-999999999999' })).rejects.toMatchObject({
      code: 'lead_not_found',
    })
    await expect(
      newQuote(customer.id, {
        lines: [
          {
            description: 'Ghost',
            quantity: 1,
            unitPriceMinor: 1,
            taxRateBps: 0,
            itemId: '99999999-9999-4999-8999-999999999999',
            warehouseId: warehouse.id,
          },
        ],
      })
    ).rejects.toBeDefined()
  })

  it('edits a draft by version, replacing its lines and totals, and returns 409 on a stale version', async () => {
    const customer = await newCustomer()
    const draft = await newQuote(customer.id)
    const updated = await updateQuotation(authA, draft.id, {
      customerId: customer.id,
      leadId: null,
      validUntil: day(20),
      notes: 'Revised',
      version: draft.version,
      lines: [{ description: 'Only line', quantity: 2, unitPriceMinor: 4_000, taxRateBps: 1_000, itemId: null, warehouseId: null }],
    })
    expect(updated.data).toMatchObject({ subtotalMinor: 8_000, taxMinor: 800, totalMinor: 8_800, version: 2, notes: 'Revised' })
    expect(updated.data.lines).toHaveLength(1)
    expect(await count('sales_quotation_lines where quotation_id = $1', [draft.id])).toBe(1)
    await expect(
      updateQuotation(authA, draft.id, {
        customerId: customer.id,
        leadId: null,
        validUntil: day(20),
        notes: null,
        version: draft.version,
        lines: standardLines(),
      })
    ).rejects.toMatchObject({ status: 409, code: 'version_conflict' })
    const audit = await getPglite().query<{ action: string }>(
      "select action from audit_log where entity = 'quotation' and entity_id = $1 order by created_at, id",
      [draft.id]
    )
    expect(audit.rows.map((row) => row.action)).toEqual(['create', 'update'])
  })

  it('walks draft, sent, accepted and refuses edits once sent', async () => {
    events.length = 0
    const customer = await newCustomer()
    const draft = await newQuote(customer.id)
    const sent = (await sendQuotation(authA, draft.id, { version: draft.version })).data
    expect(sent).toMatchObject({ status: 'sent', version: 2 })
    expect(sent.sentAt).not.toBeNull()
    await expect(
      updateQuotation(authA, draft.id, {
        customerId: customer.id,
        leadId: null,
        validUntil: day(20),
        notes: null,
        version: sent.version,
        lines: standardLines(),
      })
    ).rejects.toMatchObject({ code: 'not_editable' })
    await expect(sendQuotation(authA, draft.id, { version: sent.version })).rejects.toMatchObject({ code: 'invalid_transition' })
    const accepted = (await acceptQuotation(authA, draft.id, { version: sent.version })).data
    expect(accepted).toMatchObject({ status: 'accepted', version: 3 })
    expect(accepted.acceptedAt).not.toBeNull()
    expect(accepted.invoiceId).toBeNull()
    expect(await count('invoices where tenant_id = $1 and notes like $2', [authA.tenantId, `%${accepted.quoteNumber}%`])).toBe(0)
    expect(events.filter((event) => event.name === 'crm.quotation.status_changed')).toHaveLength(2)
  })

  it('rejects a sent quotation and keeps the rejection final', async () => {
    const customer = await newCustomer()
    const draft = await newQuote(customer.id)
    await expect(rejectQuotation(authA, draft.id, { version: draft.version })).rejects.toMatchObject({ code: 'invalid_transition' })
    const sent = (await sendQuotation(authA, draft.id, { version: draft.version })).data
    const rejected = (await rejectQuotation(authA, draft.id, { version: sent.version })).data
    expect(rejected.status).toBe('rejected')
    await expect(acceptQuotation(authA, draft.id, { version: rejected.version })).rejects.toMatchObject({ code: 'invalid_transition' })
    await expect(convert({ ...rejected } as QuotationDetail)).rejects.toMatchObject({ code: 'invalid_transition' })
  })

  it('cannot accept after the valid-until date and can then mark it expired, never before', async () => {
    const customer = await newCustomer()
    const draft = await newQuote(customer.id, { validUntil: day(3) })
    const sent = (await sendQuotation(authA, draft.id, { version: draft.version })).data
    await expect(expireQuotation(authA, draft.id, { version: sent.version })).rejects.toMatchObject({ code: 'invalid_transition' })
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date(Date.now() + 10 * 86_400_000))
      await expect(acceptQuotation(authA, draft.id, { version: sent.version })).rejects.toMatchObject({
        code: 'quote_expired',
      })
      const expired = (await expireQuotation(authA, draft.id, { version: sent.version })).data
      expect(expired.status).toBe('expired')
      await expect(acceptQuotation(authA, draft.id, { version: expired.version })).rejects.toMatchObject({ code: 'invalid_transition' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows live stock shortages on an open quotation and none once it is closed', async () => {
    const customer = await newCustomer()
    const huge = await newQuote(customer.id, {
      lines: [
        { description: 'Cola', quantity: 1_000_000, unitPriceMinor: 1, taxRateBps: 0, itemId: cola.id, warehouseId: warehouse.id },
      ],
    })
    expect(huge.stockShortages).toHaveLength(1)
    expect(huge.stockShortages[0]).toMatchObject({ sku: 'COLA-33', warehouseCode: 'MAIN', required: 1_000_000 })
    const fine = await newQuote(customer.id)
    expect(fine.stockShortages).toEqual([])
    const noStockPermission = authWithout(authA, permissions.inventoryStockRead)
    expect((await getQuotation(noStockPermission, huge.id)).data.stockShortages).toEqual([])
    const sent = (await sendQuotation(authA, huge.id, { version: huge.version })).data
    const rejected = (await rejectQuotation(authA, huge.id, { version: sent.version })).data
    expect(rejected.stockShortages).toEqual([])
  })

  it('has database guards: frozen once sent, no line changes, no deletes, no skipped statuses', async () => {
    const customer = await newCustomer()
    const draft = await newQuote(customer.id)
    const sent = (await sendQuotation(authA, draft.id, { version: draft.version })).data
    const db = getPglite()
    await expect(db.query('update sales_quotations set total_minor = total_minor + 1 where id = $1', [draft.id])).rejects.toThrow()
    await expect(db.query("update sales_quotations set notes = 'x', customer_name = 'Y' where id = $1", [draft.id])).rejects.toThrow()
    await expect(db.query('delete from sales_quotations where id = $1', [draft.id])).rejects.toThrow()
    await expect(db.query('delete from sales_quotation_lines where quotation_id = $1', [draft.id])).rejects.toThrow()
    await expect(
      db.query(
        `insert into sales_quotation_lines (tenant_id, quotation_id, position, description, quantity, unit_price_minor, tax_rate_bps, created_by)
         values ($1, $2, 9, 'Late line', 1, 100, 0, $3)`,
        [authA.tenantId, draft.id, USER_A]
      )
    ).rejects.toThrow()
    await expect(db.query("update sales_quotations set status = 'converted' where id = $1", [draft.id])).rejects.toThrow()

    const fresh = await newQuote(customer.id)
    await expect(db.query("update sales_quotations set status = 'accepted' where id = $1", [fresh.id])).rejects.toThrow()
    expect(sent.status).toBe('sent')
  })

  it('refuses totals that do not match the lines', async () => {
    const customer = await newCustomer()
    const draft = await newQuote(customer.id)
    await expect(
      getPglite().query('update sales_quotations set subtotal_minor = 1, total_minor = 1 + tax_minor where id = $1', [draft.id])
    ).rejects.toThrow()
  })

  it('lists with filters and keeps tenants apart', async () => {
    const customer = await newCustomer({ name: `Lister ${Date.now()}` })
    const one = await newQuote(customer.id)
    const two = await newQuote(customer.id)
    await sendQuotation(authA, two.id, { version: two.version })
    const all = await listQuotations(authA, listQuotationsQuerySchema.parse({ customerId: customer.id }))
    expect(all.data.map((row) => row.id).sort()).toEqual([one.id, two.id].sort())
    const sentOnly = await listQuotations(authA, listQuotationsQuerySchema.parse({ customerId: customer.id, status: 'sent' }))
    expect(sentOnly.data.map((row) => row.id)).toEqual([two.id])
    const byNumber = await listQuotations(authA, listQuotationsQuerySchema.parse({ q: one.quoteNumber }))
    expect(byNumber.data.map((row) => row.id)).toEqual([one.id])
    const sorted = await listQuotations(authA, listQuotationsQuerySchema.parse({ customerId: customer.id, sort: 'totalMinor', limit: '1' }))
    expect(sorted.nextCursor).not.toBeNull()
    expect((await listQuotations(authB, listQuotationsQuerySchema.parse({ customerId: customer.id }))).data).toEqual([])
    await expect(getQuotation(authB, one.id)).rejects.toMatchObject({ status: 404 })
    await expect(sendQuotation(authB, one.id, { version: one.version })).rejects.toMatchObject({ status: 404 })
  })
})

describe('quote to cash', () => {
  it('issues the invoice, takes the stock, wins the lead and writes audit and events in one go', async () => {
    const customer = await newCustomer({ name: 'Cash customer' })
    const lead = await newLead(customer.id, { probability: 55, expectedRevenueMinor: 18_250 })
    const quote = await acceptedQuote(customer.id, { leadId: lead.id })
    const before = await onHand(cola.id)
    events.length = 0

    const outcome = await convert(quote)
    const { quotation, invoice, lead: wonLead, stockDeducted } = outcome.body.data

    expect(outcome.status).toBe(200)
    expect(outcome.replayed).toBe(false)
    expect(stockDeducted).toBe(true)
    expect(invoice).toMatchObject({
      status: 'issued',
      customerId: customer.id,
      customerName: 'Cash customer',
      subtotalMinor: 17_500,
      taxMinor: 750,
      totalMinor: 18_250,
      issueDate: day(0),
      dueDate: day(30),
    })
    expect(invoice.notes).toBe(`Quotation ${quote.quoteNumber}`)
    expect(invoice.lines.map((line) => [line.description, line.quantity, line.unitPriceMinor, line.itemId, line.warehouseId])).toEqual([
      ['Cola 330ml', 10, 1_500, cola.id, warehouse.id],
      ['Delivery', 1, 2_500, null, null],
    ])
    expect(quotation).toMatchObject({ status: 'converted', invoiceId: invoice.id, version: quote.version + 1 })
    expect(quotation.convertedAt).not.toBeNull()
    expect(quotation.stockShortages).toEqual([])
    expect(wonLead).toMatchObject({ id: lead.id, stage: 'won', probability: 100 })

    expect(await onHand(cola.id)).toBe(before - 10)
    const movement = await getPglite().query<{ movement_type: string; quantity: number; reference_type: string; reference_id: string }>(
      'select movement_type, quantity, reference_type, reference_id from stock_movements where reference_id = $1',
      [invoice.id]
    )
    expect(movement.rows).toEqual([{ movement_type: 'OUT', quantity: -10, reference_type: 'invoice', reference_id: invoice.id }])

    const auditEntities = await getPglite().query<{ entity: string; action: string }>(
      `select entity, action from audit_log
       where tenant_id = $1 and entity_id in ($2, $3, $4) order by created_at, id`,
      [authA.tenantId, quote.id, invoice.id, lead.id]
    )
    const entries = auditEntities.rows.map((row) => `${row.entity}:${row.action}`)
    expect(entries).toEqual(expect.arrayContaining(['invoice:create', 'invoice:update', 'quotation:update', 'lead:update']))

    expect(eventNames()).toEqual(
      expect.arrayContaining([
        'finance.invoice.created',
        'finance.invoice.submitted',
        'finance.invoice.issued',
        'inventory.stock.moved',
        'crm.quotation.converted',
        'crm.lead.moved',
        'crm.lead.won',
      ])
    )
    const converted = events.find((event) => event.name === 'crm.quotation.converted')
    expect(converted?.payload).toMatchObject({ quotationId: quote.id, invoiceId: invoice.id, totalMinor: 18_250, convertedBy: USER_A })
    const won = events.find((event) => event.name === 'crm.lead.won')
    expect(won?.payload).toMatchObject({ leadId: lead.id, quotationId: quote.id })

    // The invoice total is exactly the quotation total. The ledger and cached stock still agree.
    expect(invoice.totalMinor).toBe(quote.totalMinor)
    const consistent = await getPglite().query<{ bad: number }>(
      `select count(*)::int as bad from items i where i.tenant_id = $1
       and i.current_stock <> coalesce((select sum(m.quantity) from stock_movements m where m.item_id = i.id), 0)`,
      [authA.tenantId]
    )
    expect(consistent.rows[0].bad).toBe(0)
  })

  it('converts a quotation with no lead and with no stock lines, without touching stock', async () => {
    const customer = await newCustomer()
    const quote = await acceptedQuote(customer.id, {
      lines: [{ description: 'Consulting', quantity: 2, unitPriceMinor: 5_000, taxRateBps: 0, itemId: null, warehouseId: null }],
    })
    const before = await onHand(cola.id)
    const outcome = await convert(quote)
    expect(outcome.body.data.lead).toBeNull()
    expect(outcome.body.data.invoice).toMatchObject({ status: 'issued', totalMinor: 10_000 })
    expect(await onHand(cola.id)).toBe(before)
  })

  it('leaves a lead that is already lost as it is', async () => {
    const customer = await newCustomer()
    const lead = await newLead(customer.id)
    const quote = await acceptedQuote(customer.id, { leadId: lead.id })
    await moveLead(authA, lead.id, { stage: 'lost', version: lead.version })
    const outcome = await convert(quote)
    expect(outcome.body.data.lead).toBeNull()
    expect((await getLead(authA, lead.id)).data).toMatchObject({ stage: 'lost', probability: 0 })
  })

  it('creates a pending-approval invoice above the approval limit and takes the stock only on approval', async () => {
    const original = await getPglite().query<{ approval_threshold_minor: number }>(
      'select approval_threshold_minor from finance_settings where tenant_id = $1',
      [authA.tenantId]
    )
    const customer = await newCustomer()
    const lead = await newLead(customer.id)
    const quote = await acceptedQuote(customer.id, { leadId: lead.id })
    await getPglite().query('update finance_settings set approval_threshold_minor = $2 where tenant_id = $1', [authA.tenantId, 18_249])
    try {
      const before = await onHand(cola.id)
      const outcome = await convert(quote)
      const { invoice, stockDeducted, lead: wonLead } = outcome.body.data
      expect(invoice).toMatchObject({ status: 'pending_approval', requiresApproval: true, totalMinor: 18_250 })
      expect(stockDeducted).toBe(false)
      expect(wonLead?.stage).toBe('won')
      expect(await onHand(cola.id)).toBe(before)
      expect(await count('stock_movements where reference_id = $1', [invoice.id])).toBe(0)

      const approved = await approveInvoice(authA, invoice.id, { version: invoice.version })
      expect(approved.data.status).toBe('issued')
      expect(await onHand(cola.id)).toBe(before - 10)
    } finally {
      await getPglite().query('update finance_settings set approval_threshold_minor = $2 where tenant_id = $1', [
        authA.tenantId,
        original.rows[0].approval_threshold_minor,
      ])
    }
  })

  it('issues at exactly the approval limit, because approval needs a total strictly above it', async () => {
    const original = await getPglite().query<{ approval_threshold_minor: number }>(
      'select approval_threshold_minor from finance_settings where tenant_id = $1',
      [authA.tenantId]
    )
    const customer = await newCustomer()
    const quote = await acceptedQuote(customer.id)
    await getPglite().query('update finance_settings set approval_threshold_minor = $2 where tenant_id = $1', [authA.tenantId, 18_250])
    try {
      expect((await convert(quote)).body.data.invoice.status).toBe('issued')
    } finally {
      await getPglite().query('update finance_settings set approval_threshold_minor = $2 where tenant_id = $1', [
        authA.tenantId,
        original.rows[0].approval_threshold_minor,
      ])
    }
  })

  it('blocks on insufficient stock and changes nothing, then works after restocking', async () => {
    const customer = await newCustomer()
    const lead = await newLead(customer.id)
    const quote = await acceptedQuote(customer.id, {
      leadId: lead.id,
      lines: [
        { description: 'Cola', quantity: 400, unitPriceMinor: 10, taxRateBps: 0, itemId: cola.id, warehouseId: warehouse.id },
      ],
    })
    // Leave less than the quotation needs.
    const have = await onHand(cola.id)
    await recordMovement(authA, nextKey(), {
      type: 'OUT',
      itemId: cola.id,
      warehouseId: warehouse.id,
      quantity: have - 399,
      note: 'make room',
    })
    const invoicesBefore = await count('invoices where tenant_id = $1', [authA.tenantId])
    const movementsBefore = await count('stock_movements where tenant_id = $1', [authA.tenantId])
    const keysBefore = await count('idempotency_keys where tenant_id = $1', [authA.tenantId])
    events.length = 0
    const key = nextKey()

    await expect(convert(quote, authA, key)).rejects.toMatchObject({ code: 'insufficient_stock' })
    await expect(convert(quote, authA, key)).rejects.toThrow('COLA-33 @ MAIN: need 400, have 399')

    expect(await count('invoices where tenant_id = $1', [authA.tenantId])).toBe(invoicesBefore)
    expect(await count('stock_movements where tenant_id = $1', [authA.tenantId])).toBe(movementsBefore)
    expect(await count('idempotency_keys where tenant_id = $1', [authA.tenantId])).toBe(keysBefore)
    expect((await getQuotation(authA, quote.id)).data).toMatchObject({ status: 'accepted', version: quote.version, invoiceId: null })
    expect((await getLead(authA, lead.id)).data.stage).toBe('new')
    expect(events).toEqual([])

    await stockIn(2)
    const retry = await convert(quote, authA, key)
    expect(retry.body.data.invoice.status).toBe('issued')
    await stockIn(500)
  })

  it('rolls back the invoice, the stock movement, the lead and the audit rows when a late step fails', async () => {
    const customer = await newCustomer()
    const lead = await newLead(customer.id)
    const quote = await acceptedQuote(customer.id, { leadId: lead.id })
    const db = getPglite()
    // Fails the last write of the conversion, after the invoice and the stock movement were already written.
    await db.exec(`
      create function test_fail_convert() returns trigger language plpgsql as $$
      begin
        if new.status = 'converted' then raise exception 'forced failure after the stock moved'; end if;
        return new;
      end;
      $$;
      create trigger test_fail_convert before update on sales_quotations for each row execute function test_fail_convert();
    `)
    const stockBefore = await onHand(cola.id)
    const invoicesBefore = await count('invoices where tenant_id = $1', [authA.tenantId])
    const movementsBefore = await count('stock_movements where tenant_id = $1', [authA.tenantId])
    const auditBefore = await count('audit_log where tenant_id = $1', [authA.tenantId])
    const sequenceBefore = await db.query<{ last_value: number }>(
      "select last_value from tenant_sequences where tenant_id = $1 and name = 'finance.invoice'",
      [authA.tenantId]
    )
    events.length = 0
    try {
      await expect(convert(quote)).rejects.toThrow('forced failure after the stock moved')
    } finally {
      await db.exec('drop trigger test_fail_convert on sales_quotations; drop function test_fail_convert();')
    }
    expect(await onHand(cola.id)).toBe(stockBefore)
    expect(await count('invoices where tenant_id = $1', [authA.tenantId])).toBe(invoicesBefore)
    expect(await count('stock_movements where tenant_id = $1', [authA.tenantId])).toBe(movementsBefore)
    expect(await count('audit_log where tenant_id = $1', [authA.tenantId])).toBe(auditBefore)
    const sequenceAfter = await db.query<{ last_value: number }>(
      "select last_value from tenant_sequences where tenant_id = $1 and name = 'finance.invoice'",
      [authA.tenantId]
    )
    expect(sequenceAfter.rows).toEqual(sequenceBefore.rows)
    expect((await getQuotation(authA, quote.id)).data).toMatchObject({ status: 'accepted', invoiceId: null })
    expect((await getLead(authA, lead.id)).data.stage).toBe('new')
    expect(events).toEqual([])
    expect((await convert(quote)).body.data.invoice.status).toBe('issued')
  })

  it('blocks when open balance plus the new invoice exceeds the credit limit, and allows exactly the limit', async () => {
    const customer = await newCustomer({ creditLimitMinor: 20_000 })
    const first = await acceptedQuote(customer.id)
    await convert(first)
    const second = await acceptedQuote(customer.id)
    events.length = 0
    const invoicesBefore = await count('invoices where customer_id = $1', [customer.id])

    await expect(convert(second)).rejects.toMatchObject({ code: 'credit_limit_exceeded' })
    expect(await count('invoices where customer_id = $1', [customer.id])).toBe(invoicesBefore)
    expect((await getQuotation(authA, second.id)).data.status).toBe('accepted')
    expect(events).toEqual([])

    const current = (await getCustomer(authA, customer.id)).data
    await updateCustomer(authA, customer.id, toUpdate(current, { creditLimitMinor: 36_499 }))
    await expect(convert(second)).rejects.toMatchObject({ code: 'credit_limit_exceeded' })
    const current2 = (await getCustomer(authA, customer.id)).data
    await updateCustomer(authA, customer.id, toUpdate(current2, { creditLimitMinor: 36_500 }))
    expect((await convert(second)).body.data.invoice.status).toBe('issued')
  })

  it('ignores the credit limit when there is none and counts a paid invoice as no balance', async () => {
    const customer = await newCustomer({ creditLimitMinor: 18_250 })
    const first = await acceptedQuote(customer.id)
    const invoice = (await convert(first)).body.data.invoice
    await recordPayment(authA, invoice.id, nextKey(), {
      version: invoice.version,
      amountMinor: invoice.totalMinor,
      currency: 'KWD',
      method: 'cash',
      paidAt: new Date().toISOString(),
      reference: null,
    })
    const second = await acceptedQuote(customer.id)
    expect((await convert(second)).body.data.invoice.status).toBe('issued')

    const unlimited = await newCustomer({ creditLimitMinor: null })
    for (let index = 0; index < 2; index += 1) {
      expect((await convert(await acceptedQuote(unlimited.id))).body.data.invoice.status).toBe('issued')
    }
  })

  it('refuses a customer that is not active and tells the user to activate it', async () => {
    const customer = await newCustomer()
    const quote = await acceptedQuote(customer.id)
    for (const status of ['prospect', 'lead', 'blocked'] as const) {
      const current = (await getCustomer(authA, customer.id)).data
      await updateCustomer(authA, customer.id, toUpdate(current, { status }))
      await expect(convert(quote)).rejects.toMatchObject({ code: 'customer_not_active' })
      await expect(convert(quote)).rejects.toThrow('Activate the customer')
    }
    expect(await count('invoices where customer_id = $1', [customer.id])).toBe(0)
    const current = (await getCustomer(authA, customer.id)).data
    await updateCustomer(authA, customer.id, toUpdate(current, { status: 'active' }))
    expect((await convert(quote)).body.data.invoice.status).toBe('issued')
  })

  it('converts only an accepted quotation', async () => {
    const customer = await newCustomer()
    const draft = await newQuote(customer.id)
    await expect(convert(draft)).rejects.toMatchObject({ code: 'invalid_transition' })
    const sent = (await sendQuotation(authA, draft.id, { version: draft.version })).data
    await expect(convert({ ...draft, version: sent.version })).rejects.toMatchObject({ code: 'invalid_transition' })
    expect(await count('invoices where customer_id = $1', [customer.id])).toBe(0)
  })

  it('replays the same Idempotency-Key without a second invoice or a second stock movement', async () => {
    const customer = await newCustomer()
    const quote = await acceptedQuote(customer.id)
    const key = nextKey()
    const first = await convert(quote, authA, key)
    const stockAfter = await onHand(cola.id)
    events.length = 0
    const second = await convert(quote, authA, key)
    expect(second.replayed).toBe(true)
    expect(second.body.data.invoice.id).toBe(first.body.data.invoice.id)
    expect(await count('invoices where customer_id = $1', [customer.id])).toBe(1)
    expect(await onHand(cola.id)).toBe(stockAfter)
    expect(events).toEqual([])
    await expect(
      convertQuotation(authA, key, quote.id, { version: quote.version + 5 })
    ).rejects.toMatchObject({ status: 422, code: 'idempotency_key_reused' })
  })

  it('returns 409 on a stale version and cannot convert twice with a new key', async () => {
    const customer = await newCustomer()
    const quote = await acceptedQuote(customer.id)
    await expect(convertQuotation(authA, nextKey(), quote.id, { version: quote.version - 1 })).rejects.toMatchObject({
      status: 409,
      code: 'version_conflict',
    })
    await convert(quote)
    await expect(convert(quote)).rejects.toMatchObject({ status: 409, code: 'version_conflict' })
    const converted = (await getQuotation(authA, quote.id)).data
    await expect(convert(converted)).rejects.toMatchObject({ code: 'invalid_transition' })
    expect(await count('invoices where customer_id = $1', [customer.id])).toBe(1)
  })

  it('needs the finance create and submit permissions on top of the convert permission', async () => {
    const customer = await newCustomer()
    const quote = await acceptedQuote(customer.id)
    await expect(convert(quote, authWithout(authA, permissions.financeInvoiceCreate))).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
    })
    await expect(convert(quote, authWithout(authA, permissions.financeInvoiceSubmit))).rejects.toMatchObject({ status: 403 })
    expect(await count('invoices where customer_id = $1', [customer.id])).toBe(0)
    expect((await getQuotation(authA, quote.id)).data.status).toBe('accepted')
  })

  it('never converts another tenant\'s quotation', async () => {
    const customer = await newCustomer()
    const quote = await acceptedQuote(customer.id)
    await expect(convert(quote, authB)).rejects.toMatchObject({ status: 404 })
    expect((await getQuotation(authA, quote.id)).data.status).toBe('accepted')
  })

  it('keeps the database consistent: a converted quotation always points at an invoice with the same total', async () => {
    const result = await getPglite().query<{ bad: number }>(
      `select count(*)::int as bad
       from sales_quotations q left join invoices i on i.tenant_id = q.tenant_id and i.id = q.invoice_id
       where q.status = 'converted' and (i.id is null or i.total_minor <> q.total_minor or i.customer_id <> q.customer_id)`
    )
    expect(result.rows[0].bad).toBe(0)
  })
})

describe('customer 360 profile', () => {
  it('shows invoiced, open balance, quotations, leads and an activity history', async () => {
    const customer = await newCustomer({ name: 'Profile customer', creditLimitMinor: 100_000 })
    const lead = await newLead(customer.id)
    const quote = await acceptedQuote(customer.id, { leadId: lead.id })
    const invoice = (await convert(quote)).body.data.invoice
    await recordPayment(authA, invoice.id, nextKey(), {
      version: invoice.version,
      amountMinor: 5_000,
      currency: 'KWD',
      method: 'cash',
      paidAt: new Date().toISOString(),
      reference: null,
    })
    await newQuote(customer.id)

    const profile = (await getCustomerProfile(authA, customer.id)).data
    expect(profile.customer).toMatchObject({ id: customer.id, creditLimitMinor: 100_000 })
    expect(profile.financials).toMatchObject({
      totalInvoicedMinor: 18_250,
      openBalanceMinor: 13_250,
      overdueMinor: 0,
      invoiceCount: 1,
    })
    expect(profile.financials?.recentInvoices.map((row) => row.id)).toEqual([invoice.id])
    expect(profile.financials?.recentPayments).toEqual([
      expect.objectContaining({ invoiceId: invoice.id, invoiceNumber: invoice.number, amountMinor: 5_000 }),
    ])
    expect(profile.quotations).toHaveLength(2)
    expect(profile.leads).toEqual([expect.objectContaining({ id: lead.id, stage: 'won' })])
    const kinds = profile.activity.map((entry) => `${entry.kind}:${entry.action}`)
    expect(kinds).toEqual(
      expect.arrayContaining(['payment:recorded', 'invoice:created', 'quotation:converted', 'quotation:created', 'lead:won', 'lead:created'])
    )
    const times = profile.activity.map((entry) => entry.at)
    expect([...times].sort().reverse()).toEqual(times)
    expect((await getInvoice(authA, invoice.id)).data.paidMinor).toBe(5_000)
  })

  it('leaves out the sections the caller cannot read instead of failing', async () => {
    const customer = await newCustomer()
    await convert(await acceptedQuote(customer.id))
    const noFinance = (await getCustomerProfile(authWithout(authA, permissions.financeInvoiceRead), customer.id)).data
    expect(noFinance.financials).toBeNull()
    expect(noFinance.quotations).toHaveLength(1)
    expect(noFinance.activity.some((entry) => entry.kind === 'invoice' || entry.kind === 'payment')).toBe(false)
    const noCrmLists = (
      await getCustomerProfile(authWithout(authA, permissions.crmQuotationRead, permissions.crmLeadRead), customer.id)
    ).data
    expect(noCrmLists.quotations).toEqual([])
    expect(noCrmLists.leads).toEqual([])
    expect(noCrmLists.financials?.invoiceCount).toBe(1)
  })

  it('reports an overdue balance for an issued invoice past its due date, and not for one that is not due yet', async () => {
    const customer = await newCustomer()
    const line = { description: 'Service', quantity: 1, unitPriceMinor: 4_000, taxRateBps: 0, itemId: null, warehouseId: null }
    const overdue = (
      await createInvoice(authA, nextKey(), { customerId: customer.id, issueDate: day(-40), dueDate: day(-10), notes: null, lines: [line] })
    ).body.data
    await submitInvoice(authA, overdue.id, { version: overdue.version })
    const current = (
      await createInvoice(authA, nextKey(), { customerId: customer.id, issueDate: day(0), dueDate: day(30), notes: null, lines: [line] })
    ).body.data
    await submitInvoice(authA, current.id, { version: current.version })
    const draft = (
      await createInvoice(authA, nextKey(), { customerId: customer.id, issueDate: day(-40), dueDate: day(-10), notes: null, lines: [line] })
    ).body.data
    expect(draft.status).toBe('draft')

    const financials = (await getCustomerProfile(authA, customer.id)).data.financials
    expect(financials).toMatchObject({ totalInvoicedMinor: 8_000, openBalanceMinor: 8_000, overdueMinor: 4_000, invoiceCount: 2 })
  })

  it('shows a customer with no history as empty and zero', async () => {
    const customer = await newCustomer()
    const profile = (await getCustomerProfile(authA, customer.id)).data
    expect(profile.financials).toMatchObject({ totalInvoicedMinor: 0, openBalanceMinor: 0, overdueMinor: 0, invoiceCount: 0 })
    expect(profile.quotations).toEqual([])
    expect(profile.leads).toEqual([])
    expect(profile.activity).toEqual([])
  })
})
