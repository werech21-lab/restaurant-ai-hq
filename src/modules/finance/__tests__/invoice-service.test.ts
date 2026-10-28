import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/api/errors'
import type { AuthContext } from '@/lib/auth/context'
import { DomainError } from '@/lib/domain-error'
import { CurrencyMismatchError } from '@/lib/money'
import type { Invoice, InvoiceLine } from '@/modules/finance/domain/types'
import type { FinanceEvent } from '@/modules/finance/events'

const tx = { query: vi.fn() }

vi.mock('@/lib/db', () => ({
  db: { query: vi.fn() },
  withTransaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
}))
vi.mock('@/lib/audit', () => ({ writeAudit: vi.fn(async () => undefined) }))
vi.mock('@/lib/sequences', () => ({ nextSequenceValue: vi.fn(async () => 7) }))
vi.mock('@/lib/idempotency', async () => {
  const actual = await vi.importActual<typeof import('@/lib/idempotency')>('@/lib/idempotency')
  return { ...actual, runIdempotent: vi.fn() }
})
vi.mock('@/modules/crm', () => ({ findCustomer: vi.fn() }))
vi.mock('@/modules/inventory', () => ({
  validateStockLines: vi.fn(async () => undefined),
  issueInvoiceStock: vi.fn(async () => []),
  restoreInvoiceStock: vi.fn(async () => undefined),
  publishInventoryEvents: vi.fn(async () => undefined),
  readCostingWithin: vi.fn(async () => ({ method: 'order_price', cogsAccountId: null, inventoryAccountId: null })),
}))
vi.mock('@/modules/finance/services/ledger-service', () => ({
  postSourcedEntryWithin: vi.fn(),
  reverseSourcedEntryWithin: vi.fn(),
  findActiveSourcedEntryWithin: vi.fn(async () => null),
}))
vi.mock('@/modules/finance/events', () => ({ publishFinanceEvents: vi.fn(async () => undefined) }))
vi.mock('@/modules/finance/repositories/invoice-repository', () => ({
  getSettings: vi.fn(),
  findInvoice: vi.fn(),
  listLines: vi.fn(),
  listPayments: vi.fn(),
  insertInvoice: vi.fn(),
  insertLines: vi.fn(),
  deleteLines: vi.fn(),
  updateDraftHeader: vi.fn(),
  applyStatusChange: vi.fn(),
  insertPayment: vi.fn(),
  listInvoices: vi.fn(),
  summarize: vi.fn(),
}))

import { writeAudit } from '@/lib/audit'
import { runIdempotent } from '@/lib/idempotency'
import { findCustomer } from '@/modules/crm'
import { issueInvoiceStock, restoreInvoiceStock, validateStockLines } from '@/modules/inventory'
import { publishFinanceEvents } from '@/modules/finance/events'
import * as repository from '@/modules/finance/repositories/invoice-repository'
import {
  approveInvoice,
  createInvoice,
  recordPayment,
  submitInvoice,
  updateInvoice,
  voidInvoice,
} from '@/modules/finance/services/invoice-service'

const auth: AuthContext = { userId: 'user-1', tenantId: 'tenant-1', permissions: new Set<string>() }
const INVOICE_ID = '11111111-1111-4111-8111-111111111111'
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222'

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: INVOICE_ID,
    number: 'INV-000007',
    customerId: CUSTOMER_ID,
    customerName: 'Al Noor Catering',
    status: 'draft',
    currency: 'KWD',
    issueDate: '2026-10-01',
    dueDate: '2026-10-31',
    notes: null,
    subtotalMinor: 100_000,
    taxMinor: 0,
    totalMinor: 100_000,
    paidMinor: 0,
    requiresApproval: false,
    submittedAt: null,
    approvedAt: null,
    approvedBy: null,
    voidedAt: null,
    voidReason: null,
    version: 3,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    createdBy: 'user-1',
    ...overrides,
  }
}

const line: InvoiceLine = {
  id: 'line-1',
  position: 1,
  description: 'Catering',
  quantity: 1,
  unitPriceMinor: 100_000,
  taxRateBps: 0,
  lineNetMinor: 100_000,
  itemId: null,
  warehouseId: null,
}

function publishedNames(): string[] {
  const calls = vi.mocked(publishFinanceEvents).mock.calls
  return calls.flatMap(([events]) => (events as readonly FinanceEvent[]).map((event) => event.name))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(runIdempotent).mockImplementation(async (_tx, _args, run) => ({ replayed: false, ...(await run()) }))
  vi.mocked(repository.getSettings).mockResolvedValue({ currency: 'KWD', invoicePrefix: 'INV', approvalThresholdMinor: 5_000_000 })
  vi.mocked(repository.listLines).mockResolvedValue([line])
  vi.mocked(repository.listPayments).mockResolvedValue([])
  vi.mocked(findCustomer).mockResolvedValue({ id: CUSTOMER_ID, name: 'Al Noor Catering', status: 'active' })
})

describe('createInvoice', () => {
  const input = {
    customerId: CUSTOMER_ID,
    issueDate: '2026-10-01',
    dueDate: '2026-10-31',
    notes: null,
    lines: [{ description: 'Catering', quantity: 2, unitPriceMinor: 10_000, taxRateBps: 1500, itemId: null, warehouseId: null }],
  }

  it('numbers the invoice from the sequence, snapshots the customer and computes totals once', async () => {
    vi.mocked(repository.insertInvoice).mockResolvedValue(invoice({ status: 'draft' }))
    const outcome = await createInvoice(auth, 'key-12345678', input)

    expect(outcome.status).toBe(201)
    expect(outcome.replayed).toBe(false)
    expect(repository.insertInvoice).toHaveBeenCalledWith(
      tx,
      'tenant-1',
      'user-1',
      expect.objectContaining({
        number: 'INV-000007',
        customerName: 'Al Noor Catering',
        subtotalMinor: 20_000,
        taxMinor: 3_000,
        totalMinor: 23_000,
      })
    )
    expect(writeAudit).toHaveBeenCalledWith(tx, expect.objectContaining({ entity: 'invoice', action: 'create', actorId: 'user-1' }))
    expect(publishedNames()).toEqual(['finance.invoice.created'])
  })

  it('emits nothing when the request is a replay', async () => {
    vi.mocked(runIdempotent).mockResolvedValue({ replayed: true, status: 201, body: { data: { ...invoice(), lines: [line], payments: [] } } })
    const outcome = await createInvoice(auth, 'key-12345678', input)
    expect(outcome.replayed).toBe(true)
    expect(repository.insertInvoice).not.toHaveBeenCalled()
    expect(publishFinanceEvents).not.toHaveBeenCalled()
  })

  it('rejects an unknown or inactive customer before writing anything', async () => {
    vi.mocked(findCustomer).mockResolvedValue(null)
    await expect(createInvoice(auth, 'key-12345678', input)).rejects.toMatchObject({ code: 'customer_not_found' })
    vi.mocked(findCustomer).mockResolvedValue({ id: CUSTOMER_ID, name: 'X', status: 'blocked' })
    await expect(createInvoice(auth, 'key-12345678', input)).rejects.toMatchObject({ code: 'customer_inactive' })
    expect(repository.insertInvoice).not.toHaveBeenCalled()
    expect(publishFinanceEvents).not.toHaveBeenCalled()
  })

  it('fails when finance settings are missing', async () => {
    vi.mocked(repository.getSettings).mockResolvedValue(null)
    await expect(createInvoice(auth, 'key-12345678', input)).rejects.toMatchObject({ code: 'finance_not_configured' })
  })
})

describe('updateInvoice', () => {
  const input = {
    version: 3,
    customerId: CUSTOMER_ID,
    issueDate: '2026-10-01',
    dueDate: '2026-10-31',
    notes: null,
    lines: [{ description: 'Catering', quantity: 1, unitPriceMinor: 5_000, taxRateBps: 0, itemId: null, warehouseId: null }],
  }

  it('refuses to edit an invoice that is no longer a draft', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ status: 'issued' }))
    await expect(updateInvoice(auth, INVOICE_ID, input)).rejects.toMatchObject({ code: 'not_editable' })
    expect(repository.deleteLines).not.toHaveBeenCalled()
  })

  it('returns 409 when the version is stale', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ version: 4 }))
    await expect(updateInvoice(auth, INVOICE_ID, input)).rejects.toMatchObject({ status: 409, code: 'version_conflict' })
  })

  it('replaces the lines and emits one event', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice())
    vi.mocked(repository.updateDraftHeader).mockResolvedValue(invoice({ version: 4, totalMinor: 5_000 }))
    await updateInvoice(auth, INVOICE_ID, input)
    expect(repository.deleteLines).toHaveBeenCalledOnce()
    expect(repository.insertLines).toHaveBeenCalledOnce()
    expect(publishedNames()).toEqual(['finance.invoice.updated'])
  })
})

describe('submitInvoice', () => {
  it('issues directly when the total is at or below 5,000.000 KWD', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ totalMinor: 5_000_000 }))
    vi.mocked(repository.applyStatusChange).mockResolvedValue(invoice({ status: 'issued', version: 4 }))
    await submitInvoice(auth, INVOICE_ID, { version: 3 })
    expect(repository.applyStatusChange).toHaveBeenCalledWith(
      tx,
      'tenant-1',
      INVOICE_ID,
      3,
      expect.objectContaining({ status: 'issued', requiresApproval: false })
    )
    expect(publishedNames()).toEqual(['finance.invoice.submitted', 'finance.invoice.issued'])
  })

  it('holds the invoice for approval above 5,000.000 KWD', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ totalMinor: 5_000_001 }))
    vi.mocked(repository.applyStatusChange).mockResolvedValue(invoice({ status: 'pending_approval', requiresApproval: true, version: 4 }))
    await submitInvoice(auth, INVOICE_ID, { version: 3 })
    expect(repository.applyStatusChange).toHaveBeenCalledWith(
      tx,
      'tenant-1',
      INVOICE_ID,
      3,
      expect.objectContaining({ status: 'pending_approval', requiresApproval: true })
    )
    expect(publishedNames()).toEqual(['finance.invoice.submitted'])
  })

  it('returns 404 for an unknown invoice and 409 for a stale version', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(null)
    await expect(submitInvoice(auth, INVOICE_ID, { version: 3 })).rejects.toMatchObject({ status: 404 })
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ version: 9 }))
    await expect(submitInvoice(auth, INVOICE_ID, { version: 3 })).rejects.toBeInstanceOf(AppError)
  })

  it('rejects an invoice without lines', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice())
    vi.mocked(repository.listLines).mockResolvedValue([])
    await expect(submitInvoice(auth, INVOICE_ID, { version: 3 })).rejects.toMatchObject({ code: 'empty_invoice' })
    expect(repository.applyStatusChange).not.toHaveBeenCalled()
  })
})

describe('approveInvoice', () => {
  it('issues an invoice that is pending approval and records who approved it', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ status: 'pending_approval', requiresApproval: true }))
    vi.mocked(repository.applyStatusChange).mockResolvedValue(invoice({ status: 'issued', requiresApproval: true, version: 4 }))
    await approveInvoice(auth, INVOICE_ID, { version: 3 })
    expect(repository.applyStatusChange).toHaveBeenCalledWith(tx, 'tenant-1', INVOICE_ID, 3, { status: 'issued', approvedBy: 'user-1' })
    expect(publishedNames()).toEqual(['finance.invoice.approved', 'finance.invoice.issued'])
  })

  it('rejects an invoice that is not pending approval', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ status: 'draft' }))
    await expect(approveInvoice(auth, INVOICE_ID, { version: 3 })).rejects.toMatchObject({ code: 'invalid_transition' })
  })
})

describe('voidInvoice', () => {
  it('voids an unpaid invoice with a reason', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ status: 'issued' }))
    vi.mocked(repository.applyStatusChange).mockResolvedValue(invoice({ status: 'void', version: 4 }))
    await voidInvoice(auth, INVOICE_ID, { version: 3, reason: 'Entered twice' })
    expect(publishedNames()).toEqual(['finance.invoice.voided'])
  })

  it('refuses when a payment exists', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ status: 'partially_paid', paidMinor: 1_000 }))
    await expect(voidInvoice(auth, INVOICE_ID, { version: 3, reason: 'x' })).rejects.toBeInstanceOf(DomainError)
    expect(repository.applyStatusChange).not.toHaveBeenCalled()
  })
})

describe('stock integration', () => {
  const stockLine: InvoiceLine = { ...line, itemId: '33333333-3333-4333-8333-333333333333', warehouseId: '44444444-4444-4444-8444-444444444444' }

  it('checks the items and warehouses when a draft is created or edited', async () => {
    const lines = [{ description: 'Cola', quantity: 2, unitPriceMinor: 500, taxRateBps: 0, itemId: stockLine.itemId, warehouseId: stockLine.warehouseId }]
    vi.mocked(repository.insertInvoice).mockResolvedValue(invoice())
    await createInvoice(auth, 'key-12345678', { customerId: CUSTOMER_ID, issueDate: '2026-10-01', dueDate: '2026-10-31', notes: null, lines })
    expect(validateStockLines).toHaveBeenCalledWith(tx, 'tenant-1', lines)

    vi.mocked(repository.findInvoice).mockResolvedValue(invoice())
    vi.mocked(repository.updateDraftHeader).mockResolvedValue(invoice({ version: 4 }))
    await updateInvoice(auth, INVOICE_ID, { version: 3, customerId: CUSTOMER_ID, issueDate: '2026-10-01', dueDate: '2026-10-31', notes: null, lines })
    expect(validateStockLines).toHaveBeenCalledTimes(2)
  })

  it('takes stock in the same transaction when submit issues the invoice', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice())
    vi.mocked(repository.listLines).mockResolvedValue([stockLine])
    vi.mocked(repository.applyStatusChange).mockResolvedValue(invoice({ status: 'issued', version: 4 }))
    await submitInvoice(auth, INVOICE_ID, { version: 3 })
    expect(issueInvoiceStock).toHaveBeenCalledWith(tx, auth, { id: INVOICE_ID, number: 'INV-000007' }, [stockLine], expect.any(Array))
  })

  it('takes no stock while the invoice waits for approval', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ totalMinor: 5_000_001 }))
    vi.mocked(repository.listLines).mockResolvedValue([stockLine])
    vi.mocked(repository.applyStatusChange).mockResolvedValue(invoice({ status: 'pending_approval', requiresApproval: true, version: 4 }))
    await submitInvoice(auth, INVOICE_ID, { version: 3 })
    expect(issueInvoiceStock).not.toHaveBeenCalled()
  })

  it('takes stock when approval issues the invoice', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ status: 'pending_approval', requiresApproval: true }))
    vi.mocked(repository.listLines).mockResolvedValue([stockLine])
    vi.mocked(repository.applyStatusChange).mockResolvedValue(invoice({ status: 'issued', requiresApproval: true, version: 4 }))
    await approveInvoice(auth, INVOICE_ID, { version: 3 })
    expect(issueInvoiceStock).toHaveBeenCalledWith(tx, auth, { id: INVOICE_ID, number: 'INV-000007' }, [stockLine], expect.any(Array))
  })

  it('rolls back and publishes nothing when stock is short', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice())
    vi.mocked(repository.listLines).mockResolvedValue([stockLine])
    vi.mocked(repository.applyStatusChange).mockResolvedValue(invoice({ status: 'issued', version: 4 }))
    vi.mocked(issueInvoiceStock).mockRejectedValueOnce(new DomainError('insufficient_stock', 'Not enough stock.'))
    await expect(submitInvoice(auth, INVOICE_ID, { version: 3 })).rejects.toMatchObject({ code: 'insufficient_stock' })
    expect(publishFinanceEvents).not.toHaveBeenCalled()
  })

  it('puts stock back when an issued invoice is voided', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ status: 'issued' }))
    vi.mocked(repository.applyStatusChange).mockResolvedValue(invoice({ status: 'void', version: 4 }))
    await voidInvoice(auth, INVOICE_ID, { version: 3, reason: 'Entered twice' })
    expect(restoreInvoiceStock).toHaveBeenCalledWith(tx, auth, { id: INVOICE_ID, number: 'INV-000007' }, expect.any(Array))
  })

  it('does not restore stock for an invoice that never took any', async () => {
    for (const status of ['draft', 'pending_approval'] as const) {
      vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ status }))
      vi.mocked(repository.applyStatusChange).mockResolvedValue(invoice({ status: 'void', version: 4 }))
      await voidInvoice(auth, INVOICE_ID, { version: 3, reason: 'Cancelled' })
    }
    expect(restoreInvoiceStock).not.toHaveBeenCalled()
  })

  it('restores nothing when a paid invoice cannot be voided', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ status: 'paid', paidMinor: 100_000 }))
    await expect(voidInvoice(auth, INVOICE_ID, { version: 3, reason: 'x' })).rejects.toMatchObject({ code: 'cannot_void' })
    expect(restoreInvoiceStock).not.toHaveBeenCalled()
  })
})

describe('recordPayment', () => {
  const payment = {
    id: 'pay-1',
    invoiceId: INVOICE_ID,
    amountMinor: 100_000,
    currency: 'KWD' as const,
    method: 'cash' as const,
    paidAt: '2026-10-05T09:00:00.000Z',
    reference: null,
    createdAt: '2026-10-05T09:00:01.000Z',
    createdBy: 'user-1',
  }
  const body = (amountMinor: number) => ({
    version: 3,
    amountMinor,
    currency: 'KWD' as const,
    method: 'cash' as const,
    paidAt: '2026-10-05T09:00:00.000Z',
    reference: null,
  })

  it('marks the invoice paid and emits payment and paid events', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ status: 'issued' }))
    vi.mocked(repository.insertPayment).mockResolvedValue(payment)
    vi.mocked(repository.applyStatusChange).mockResolvedValue(invoice({ status: 'paid', paidMinor: 100_000, version: 4 }))
    const outcome = await recordPayment(auth, INVOICE_ID, 'key-12345678', body(100_000))
    expect(outcome.status).toBe(201)
    expect(repository.applyStatusChange).toHaveBeenCalledWith(tx, 'tenant-1', INVOICE_ID, 3, { status: 'paid', paidMinor: 100_000 })
    expect(publishedNames()).toEqual(['finance.payment.recorded', 'finance.invoice.paid'])
  })

  it('records a partial payment without a paid event', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ status: 'issued' }))
    vi.mocked(repository.insertPayment).mockResolvedValue({ ...payment, amountMinor: 40_000 })
    vi.mocked(repository.applyStatusChange).mockResolvedValue(invoice({ status: 'partially_paid', paidMinor: 40_000, version: 4 }))
    await recordPayment(auth, INVOICE_ID, 'key-12345678', body(40_000))
    expect(publishedNames()).toEqual(['finance.payment.recorded'])
  })

  it('rejects an overpayment before inserting anything', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ status: 'issued' }))
    await expect(recordPayment(auth, INVOICE_ID, 'key-12345678', body(100_001))).rejects.toMatchObject({
      code: 'payment_exceeds_balance',
    })
    expect(repository.insertPayment).not.toHaveBeenCalled()
    expect(publishFinanceEvents).not.toHaveBeenCalled()
  })

  it('rejects a non-KWD payment with CurrencyMismatchError before inserting, changing or auditing anything', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ status: 'issued' }))
    await expect(
      recordPayment(auth, INVOICE_ID, 'key-12345678', { ...body(40_000), currency: 'USD' as unknown as 'KWD' })
    ).rejects.toBeInstanceOf(CurrencyMismatchError)
    expect(repository.insertPayment).not.toHaveBeenCalled()
    expect(repository.applyStatusChange).not.toHaveBeenCalled()
    expect(writeAudit).not.toHaveBeenCalled()
    expect(publishFinanceEvents).not.toHaveBeenCalled()
  })

  it('rejects zero and negative payments with payment_not_positive before inserting anything', async () => {
    vi.mocked(repository.findInvoice).mockResolvedValue(invoice({ status: 'issued' }))
    for (const amountMinor of [0, -1, -40_000]) {
      await expect(recordPayment(auth, INVOICE_ID, 'key-12345678', body(amountMinor))).rejects.toMatchObject({
        code: 'payment_not_positive',
      })
    }
    expect(repository.insertPayment).not.toHaveBeenCalled()
    expect(repository.applyStatusChange).not.toHaveBeenCalled()
    expect(writeAudit).not.toHaveBeenCalled()
    expect(publishFinanceEvents).not.toHaveBeenCalled()
  })
})
