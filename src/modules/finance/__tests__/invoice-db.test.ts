import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/context'
import { subscribe } from '@/lib/events/bus'
import type { BusEvent } from '@/lib/events/bus'
import {
  bootstrapTenant,
  createUser,
  getPglite,
  startDatabase,
  stopDatabase,
} from '@/lib/__tests__/support/database'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

import { CurrencyMismatchError } from '@/lib/money'
import { createCustomer } from '@/modules/crm'
import {
  approveInvoice,
  createInvoice,
  getInvoice,
  getInvoiceSummary,
  listInvoices,
  recordPayment,
  submitInvoice,
  updateInvoice,
  voidInvoice,
} from '@/modules/finance'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

let authA: AuthContext
let authB: AuthContext
let customerA: string
const events: BusEvent[] = []

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

function invoiceInput(unitPriceMinor: number, overrides: { quantity?: number; taxRateBps?: number } = {}) {
  return {
    customerId: customerA,
    issueDate: day(-1),
    dueDate: day(29),
    notes: null,
    lines: [
      {
        description: 'Catering',
        quantity: overrides.quantity ?? 1,
        unitPriceMinor,
        taxRateBps: overrides.taxRateBps ?? 0,
        itemId: null,
        warehouseId: null,
      },
    ],
  }
}

let keyCounter = 0
const nextKey = () => `test-key-${String(++keyCounter).padStart(8, '0')}`

async function createDraft(unitPriceMinor: number, overrides: { quantity?: number; taxRateBps?: number } = {}) {
  const outcome = await createInvoice(authA, nextKey(), invoiceInput(unitPriceMinor, overrides))
  return outcome.body.data
}

async function expectRejection(promise: Promise<unknown>, match: Record<string, unknown>) {
  await expect(promise).rejects.toMatchObject(match)
}

beforeAll(async () => {
  await startDatabase()
  await createUser(USER_A)
  await createUser(USER_B)
  const tenantA = await bootstrapTenant('Tenant A', 'tenant-a', USER_A)
  const tenantB = await bootstrapTenant('Tenant B', 'tenant-b', USER_B)
  authA = { userId: USER_A, tenantId: tenantA, permissions: new Set<string>() }
  authB = { userId: USER_B, tenantId: tenantB, permissions: new Set<string>() }
  customerA = (await createCustomer(authA, { name: 'Al Noor Catering', customerType: 'company', email: null, phone: null, taxId: null, address: null, creditLimitMinor: null, status: 'active', notes: null })).id
  subscribe('finance.invoice.created', (event) => void events.push(event))
  subscribe('finance.invoice.issued', (event) => void events.push(event))
  subscribe('finance.payment.recorded', (event) => void events.push(event))
}, 60_000)

afterAll(async () => {
  await stopDatabase()
})

describe('creating invoices', () => {
  it('numbers invoices per tenant, computes totals once per invoice and writes an audit row', async () => {
    const first = await createDraft(10_000, { quantity: 2, taxRateBps: 1500 })
    expect(first.number).toBe('INV-000001')
    expect(first).toMatchObject({ status: 'draft', subtotalMinor: 20_000, taxMinor: 3_000, totalMinor: 23_000, version: 1 })
    expect(first.lines).toHaveLength(1)
    expect(first.lines[0].lineNetMinor).toBe(20_000)

    const audit = await getPglite().query<{ action: string; entity: string }>(
      "select action, entity from audit_log where entity_id = $1",
      [first.id]
    )
    expect(audit.rows).toEqual([{ action: 'create', entity: 'invoice' }])
    expect(events.some((event) => event.name === 'finance.invoice.created')).toBe(true)
  })

  it('stores tax rounded once for the whole invoice', async () => {
    const outcome = await createInvoice(authA, nextKey(), {
      ...invoiceInput(3, { taxRateBps: 1500 }),
      lines: [1, 2, 3].map((index) => ({ description: `Line ${index}`, quantity: 1, unitPriceMinor: 3, taxRateBps: 1500, itemId: null, warehouseId: null })),
    })
    expect(outcome.body.data).toMatchObject({ subtotalMinor: 9, taxMinor: 1, totalMinor: 10 })
  })

  it('replays the same Idempotency-Key without creating a second invoice or event', async () => {
    const key = nextKey()
    const input = invoiceInput(5_000)
    const first = await createInvoice(authA, key, input)
    const eventsBefore = events.length
    const second = await createInvoice(authA, key, input)
    expect(second.replayed).toBe(true)
    expect(second.body.data.id).toBe(first.body.data.id)
    expect(events.length).toBe(eventsBefore)
    const count = await getPglite().query<{ count: number }>('select count(*)::int as count from invoices where id = $1', [first.body.data.id])
    expect(count.rows[0].count).toBe(1)
    await expectRejection(createInvoice(authA, key, invoiceInput(6_000)), { status: 422, code: 'idempotency_key_reused' })
  })

  it('rejects a customer from another tenant', async () => {
    const foreign = await createCustomer(authB, { name: 'Other tenant customer', customerType: 'company', email: null, phone: null, taxId: null, address: null, creditLimitMinor: null, status: 'active', notes: null })
    await expectRejection(createInvoice(authA, nextKey(), { ...invoiceInput(1_000), customerId: foreign.id }), {
      code: 'customer_not_found',
    })
  })

  it('does not leave a half-written invoice when a line is invalid', async () => {
    const before = await getPglite().query<{ count: number }>('select count(*)::int as count from invoices')
    await expect(
      createInvoice(authA, nextKey(), { ...invoiceInput(1_000), lines: [{ description: 'Bad', quantity: 0, unitPriceMinor: 1, taxRateBps: 0, itemId: null, warehouseId: null }] })
    ).rejects.toMatchObject({ code: 'invalid_line' })
    const after = await getPglite().query<{ count: number }>('select count(*)::int as count from invoices')
    expect(after.rows[0].count).toBe(before.rows[0].count)
  })
})

describe('editing, submitting and approving', () => {
  it('edits a draft, bumps the version and rejects a stale version with 409', async () => {
    const draft = await createDraft(1_000)
    const edited = await updateInvoice(authA, draft.id, { ...invoiceInput(2_500, { quantity: 2 }), version: draft.version })
    expect(edited.data).toMatchObject({ version: 2, subtotalMinor: 5_000, totalMinor: 5_000 })
    await expectRejection(updateInvoice(authA, draft.id, { ...invoiceInput(9_000), version: draft.version }), {
      status: 409,
      code: 'version_conflict',
    })
  })

  it('issues an invoice at exactly 5,000.000 KWD without approval', async () => {
    const draft = await createDraft(5_000_000)
    const issued = await submitInvoice(authA, draft.id, { version: draft.version })
    expect(issued.data).toMatchObject({ status: 'issued', requiresApproval: false })
    expect(events.some((event) => event.name === 'finance.invoice.issued')).toBe(true)
  })

  it('holds an invoice above 5,000.000 KWD for approval, then issues it on approval', async () => {
    const draft = await createDraft(5_000_001)
    const pending = await submitInvoice(authA, draft.id, { version: draft.version })
    expect(pending.data).toMatchObject({ status: 'pending_approval', requiresApproval: true })
    await expectRejection(
      recordPayment(authA, draft.id, nextKey(), {
        version: pending.data.version,
        amountMinor: 100,
        currency: 'KWD',
        method: 'cash',
        paidAt: new Date().toISOString(),
        reference: null,
      }),
      { code: 'invalid_transition' }
    )
    const approved = await approveInvoice(authA, draft.id, { version: pending.data.version })
    expect(approved.data).toMatchObject({ status: 'issued', approvedBy: USER_A })
    expect(approved.data.approvedAt).not.toBeNull()
  })

  it('does not allow editing after submit', async () => {
    const draft = await createDraft(1_000)
    const issued = await submitInvoice(authA, draft.id, { version: draft.version })
    await expectRejection(updateInvoice(authA, draft.id, { ...invoiceInput(1), version: issued.data.version }), { code: 'not_editable' })
  })
})

describe('payments and void', () => {
  const pay = (version: number, amountMinor: number) => ({
    version,
    amountMinor,
    currency: 'KWD' as const,
    method: 'knet' as const,
    paidAt: new Date().toISOString(),
    reference: null,
  })

  it('moves through partially paid to paid, and refuses overpayment, void after payment and a replayed key with new data', async () => {
    const draft = await createDraft(10_000)
    const issued = (await submitInvoice(authA, draft.id, { version: draft.version })).data

    const key = nextKey()
    const firstBody = pay(issued.version, 4_000)
    const first = await recordPayment(authA, draft.id, key, firstBody)
    expect(first.status).toBe(201)
    expect(first.body.data.invoice).toMatchObject({ status: 'partially_paid', paidMinor: 4_000 })

    const replay = await recordPayment(authA, draft.id, key, { ...firstBody })
    expect(replay.replayed).toBe(true)
    expect(replay.body.data.payment.id).toBe(first.body.data.payment.id)
    await expectRejection(recordPayment(authA, draft.id, key, { ...firstBody, amountMinor: 4_001 }), {
      status: 422,
      code: 'idempotency_key_reused',
    })

    await expectRejection(recordPayment(authA, draft.id, nextKey(), pay(first.body.data.invoice.version, 6_001)), {
      code: 'payment_exceeds_balance',
    })
    await expectRejection(voidInvoice(authA, draft.id, { version: first.body.data.invoice.version, reason: 'mistake' }), {
      code: 'cannot_void',
    })

    const second = await recordPayment(authA, draft.id, nextKey(), pay(first.body.data.invoice.version, 6_000))
    expect(second.body.data.invoice).toMatchObject({ status: 'paid', paidMinor: 10_000 })
    expect(second.body.data.invoice.payments).toHaveLength(2)

    const detail = await getInvoice(authA, draft.id)
    expect(detail.data.payments.reduce((sum, payment) => sum + payment.amountMinor, 0)).toBe(10_000)
    expect(events.filter((event) => event.name === 'finance.payment.recorded' && (event.payload as { invoiceId: string }).invoiceId === draft.id)).toHaveLength(2)
  })

  it('voids an unpaid issued invoice, keeps the row and its number, and then freezes it', async () => {
    const draft = await createDraft(1_000)
    const issued = (await submitInvoice(authA, draft.id, { version: draft.version })).data
    const voided = await voidInvoice(authA, draft.id, { version: issued.version, reason: 'Entered twice' })
    expect(voided.data).toMatchObject({ status: 'void', voidReason: 'Entered twice' })
    expect(voided.data.voidedAt).not.toBeNull()
    await expectRejection(voidInvoice(authA, draft.id, { version: voided.data.version, reason: 'again' }), { code: 'invalid_transition' })
    const still = await getInvoice(authA, draft.id)
    expect(still.data.number).toBe(draft.number)
  })

  describe('rejected payments leave no trace', () => {
    async function snapshot(invoiceId: string) {
      const database = getPglite()
      const payments = await database.query<{ count: number }>('select count(*)::int as count from payments where tenant_id = $1', [authA.tenantId])
      const invoiceAudit = await database.query<{ count: number }>(
        'select count(*)::int as count from audit_log where tenant_id = $1 and entity_id = $2',
        [authA.tenantId, invoiceId]
      )
      const paymentAudit = await database.query<{ count: number }>(
        "select count(*)::int as count from audit_log where tenant_id = $1 and entity = 'payment'",
        [authA.tenantId]
      )
      const keys = await database.query<{ count: number }>('select count(*)::int as count from idempotency_keys where tenant_id = $1', [authA.tenantId])
      const row = await database.query<{ status: string; paid_minor: number; version: number }>(
        'select status, paid_minor::int as paid_minor, version from invoices where id = $1',
        [invoiceId]
      )
      return {
        payments: payments.rows[0].count,
        invoiceAudit: invoiceAudit.rows[0].count,
        paymentAudit: paymentAudit.rows[0].count,
        keys: keys.rows[0].count,
        invoice: row.rows[0],
        recordedEvents: events.filter((event) => event.name === 'finance.payment.recorded').length,
      }
    }

    it('rejects a non-KWD payment with CurrencyMismatchError and changes nothing', async () => {
      const draft = await createDraft(10_000)
      const issued = (await submitInvoice(authA, draft.id, { version: draft.version })).data
      const before = await snapshot(draft.id)

      await expect(
        recordPayment(authA, draft.id, nextKey(), { ...pay(issued.version, 4_000), currency: 'USD' as unknown as 'KWD' })
      ).rejects.toBeInstanceOf(CurrencyMismatchError)

      expect(await snapshot(draft.id)).toEqual(before)
      expect(before.invoice).toEqual({ status: 'issued', paid_minor: 0, version: issued.version })
      const detail = await getInvoice(authA, draft.id)
      expect(detail.data).toMatchObject({ status: 'issued', paidMinor: 0, version: issued.version })
      expect(detail.data.payments).toHaveLength(0)
    })

    it('still accepts a KWD payment with the same key after a currency mismatch was rejected', async () => {
      const draft = await createDraft(10_000)
      const issued = (await submitInvoice(authA, draft.id, { version: draft.version })).data
      const key = nextKey()
      await expect(
        recordPayment(authA, draft.id, key, { ...pay(issued.version, 4_000), currency: 'USD' as unknown as 'KWD' })
      ).rejects.toBeInstanceOf(CurrencyMismatchError)

      const accepted = await recordPayment(authA, draft.id, key, pay(issued.version, 4_000))
      expect(accepted.replayed).toBe(false)
      expect(accepted.body.data.invoice).toMatchObject({ status: 'partially_paid', paidMinor: 4_000 })
      expect(accepted.body.data.invoice.payments).toHaveLength(1)
    })

    it('rejects zero and negative payments with payment_not_positive and changes nothing', async () => {
      const draft = await createDraft(10_000)
      const issued = (await submitInvoice(authA, draft.id, { version: draft.version })).data
      const before = await snapshot(draft.id)

      for (const amountMinor of [0, -1, -4_000]) {
        await expectRejection(recordPayment(authA, draft.id, nextKey(), pay(issued.version, amountMinor)), { code: 'payment_not_positive' })
      }

      expect(await snapshot(draft.id)).toEqual(before)
    })
  })
})

describe('listing', () => {
  it('pages through every invoice exactly once in each sort order, with filters', async () => {
    const totals = [7_000, 3_000, 9_000, 3_000, 5_000]
    for (const total of totals) await createDraft(total)

    for (const sort of ['createdAt', 'dueDate', 'totalMinor'] as const) {
      for (const direction of ['asc', 'desc'] as const) {
        const seen: string[] = []
        let cursor: string | undefined
        let guard = 0
        do {
          const page = await listInvoices(authA, { limit: 3, sort, direction, cursor })
          expect(page.data.length).toBeLessThanOrEqual(3)
          page.data.forEach((invoice) => seen.push(invoice.id))
          cursor = page.nextCursor ?? undefined
          guard += 1
        } while (cursor && guard < 50)
        const all = await getPglite().query<{ count: number }>('select count(*)::int as count from invoices where tenant_id = $1', [authA.tenantId])
        expect(seen).toHaveLength(all.rows[0].count)
        expect(new Set(seen).size).toBe(seen.length)
      }
    }

    const sorted = await listInvoices(authA, { limit: 100, sort: 'totalMinor', direction: 'asc', status: 'draft' })
    const sortedTotals = sorted.data.map((invoice) => invoice.totalMinor)
    expect(sortedTotals).toEqual([...sortedTotals].sort((left, right) => left - right))
    expect(sorted.data.every((invoice) => invoice.status === 'draft')).toBe(true)

    const search = await listInvoices(authA, { limit: 100, sort: 'createdAt', direction: 'desc', q: 'al noor' })
    expect(search.data.length).toBeGreaterThan(0)
    const none = await listInvoices(authA, { limit: 100, sort: 'createdAt', direction: 'desc', q: '50%_' })
    expect(none.data).toHaveLength(0)
  })

  it('never shows one tenant another tenant\'s invoices', async () => {
    const foreignCustomer = await createCustomer(authB, { name: 'B customer', customerType: 'company', email: null, phone: null, taxId: null, address: null, creditLimitMinor: null, status: 'active', notes: null })
    const own = await createInvoice(authB, nextKey(), { ...invoiceInput(1_000), customerId: foreignCustomer.id })
    expect(own.body.data.number).toBe('INV-000001')
    const listB = await listInvoices(authB, { limit: 100, sort: 'createdAt', direction: 'desc' })
    expect(listB.data.map((invoice) => invoice.id)).toEqual([own.body.data.id])
    await expectRejection(getInvoice(authB, (await listInvoices(authA, { limit: 1, sort: 'createdAt', direction: 'desc' })).data[0].id), {
      status: 404,
    })
  })
})

describe('summary', () => {
  it('reports outstanding, overdue and monthly figures', async () => {
    const overdueDraft = await createInvoice(authB, nextKey(), {
      ...invoiceInput(2_000),
      customerId: (await createCustomer(authB, { name: 'Late payer', customerType: 'company', email: null, phone: null, taxId: null, address: null, creditLimitMinor: null, status: 'active', notes: null })).id,
      issueDate: day(-40),
      dueDate: day(-10),
    })
    await submitInvoice(authB, overdueDraft.body.data.id, { version: overdueDraft.body.data.version })
    const summary = (await getInvoiceSummary(authB)).data
    expect(summary.approvalThresholdMinor).toBe(5_000_000)
    expect(summary.overdueCount).toBe(1)
    expect(summary.overdueMinor).toBe(2_000)
    expect(summary.outstandingMinor).toBe(2_000)
    expect(summary.countsByStatus.issued).toBe(1)
    expect(summary.countsByStatus.draft).toBe(1)
    expect(summary.months).toHaveLength(6)
    expect(summary.months.reduce((sum, month) => sum + month.invoicedMinor, 0)).toBe(2_000)
  })
})

describe('database guards', () => {
  async function issuedInvoiceId(): Promise<string> {
    const draft = await createDraft(2_000)
    await submitInvoice(authA, draft.id, { version: draft.version })
    return draft.id
  }

  async function expectSqlError(sql: string, params: unknown[], pattern: RegExp) {
    await expect(getPglite().query(sql, params)).rejects.toThrow(pattern)
  }

  it('refuses to delete invoices, payments and audit rows', async () => {
    const id = await issuedInvoiceId()
    await expectSqlError('delete from invoices where id = $1', [id], /cannot be deleted/)
    await expectSqlError('delete from audit_log where entity_id = $1', [id], /cannot be deleted/)
    await expectSqlError('delete from payments', [], /cannot be deleted/)
    await expectSqlError('update audit_log set action = $1 where entity_id = $2', ['delete', id], /immutable/)
  })

  it('freezes amounts, dates and lines once an invoice leaves draft', async () => {
    const id = await issuedInvoiceId()
    await expectSqlError('update invoices set subtotal_minor = 1, total_minor = 1 where id = $1', [id], /no longer a draft/)
    await expectSqlError("update invoices set due_date = due_date + 1 where id = $1", [id], /no longer a draft/)
    await expectSqlError('update invoice_lines set quantity = 5 where invoice_id = $1', [id], /only change while the invoice is a draft/)
    await expectSqlError('delete from invoice_lines where invoice_id = $1', [id], /only change while the invoice is a draft/)
  })

  it('refuses totals that do not match the lines at commit', async () => {
    const draft = await createDraft(1_000)
    await expect(
      getPglite().transaction(async (transaction) => {
        await transaction.query('update invoices set subtotal_minor = 999, total_minor = 999 where id = $1', [draft.id])
      })
    ).rejects.toThrow(/do not match the invoice lines/)
  })

  it('refuses a paid amount above the total, a negative payment, and a lowered paid amount', async () => {
    const id = await issuedInvoiceId()
    await expectSqlError('update invoices set paid_minor = 2001, status = $2 where id = $1', [id, 'partially_paid'], /invoices_paid_within_total/)
    await expectSqlError(
      'insert into payments (tenant_id, invoice_id, amount_minor, method, paid_at, created_by) values ($1, $2, -5, $3, now(), $4)',
      [authA.tenantId, id, 'cash', USER_A],
      /payments_amount_minor_check/
    )
  })

  it('refuses a cross-tenant reference between an invoice and a customer', async () => {
    const foreign = await createCustomer(authB, { name: 'B2', customerType: 'company', email: null, phone: null, taxId: null, address: null, creditLimitMinor: null, status: 'active', notes: null })
    await expectSqlError(
      `insert into invoices (tenant_id, number, customer_id, customer_name, issue_date, due_date, subtotal_minor, tax_minor, total_minor, created_by)
       values ($1, 'X-1', $2, 'x', '2026-01-01', '2026-01-02', 0, 0, 0, $3)`,
      [authA.tenantId, foreign.id, USER_A],
      /foreign key/
    )
  })

  it('does not let a client choose payments that exceed the invoice via the API path', async () => {
    const draft = await createDraft(1_000)
    const issued = (await submitInvoice(authA, draft.id, { version: draft.version })).data
    await expectRejection(
      recordPayment(authA, draft.id, nextKey(), {
        version: issued.version,
        amountMinor: 1_001,
        currency: 'KWD',
        method: 'cash',
        paidAt: new Date().toISOString(),
        reference: null,
      }),
      { code: 'payment_exceeds_balance' }
    )
  })
})
