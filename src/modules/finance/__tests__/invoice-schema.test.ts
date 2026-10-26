import { describe, expect, it } from 'vitest'
import {
  createInvoiceSchema,
  invoiceLineSchema,
  listInvoicesQuerySchema,
  recordPaymentSchema,
} from '@/modules/finance/schemas/invoice'

const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222'
const STOCK_ITEM_ID = '33333333-3333-4333-8333-333333333333'
const STOCK_WAREHOUSE_ID = '44444444-4444-4444-8444-444444444444'
const line = { description: 'Catering', quantity: 1, unitPriceMinor: 1000, taxRateBps: 0 }
const valid = { customerId: CUSTOMER_ID, issueDate: '2026-10-01', dueDate: '2026-10-31', lines: [line] }

describe('createInvoiceSchema', () => {
  it('accepts a valid invoice and defaults notes to null', () => {
    expect(createInvoiceSchema.parse(valid).notes).toBeNull()
  })

  it('rejects a due date before the issue date', () => {
    expect(createInvoiceSchema.safeParse({ ...valid, dueDate: '2026-09-30' }).success).toBe(false)
  })

  it('rejects impossible dates and a missing line list', () => {
    expect(createInvoiceSchema.safeParse({ ...valid, issueDate: '2026-02-30' }).success).toBe(false)
    expect(createInvoiceSchema.safeParse({ ...valid, lines: [] }).success).toBe(false)
  })

  it('rejects fractional, negative and out of range line values', () => {
    for (const bad of [
      { quantity: 1.5 },
      { quantity: 0 },
      { quantity: -2 },
      { unitPriceMinor: -1 },
      { unitPriceMinor: 10.5 },
      { taxRateBps: 10001 },
      { taxRateBps: -1 },
    ]) {
      expect(createInvoiceSchema.safeParse({ ...valid, lines: [{ ...line, ...bad }] }).success).toBe(false)
    }
  })

  it('rejects more than 200 lines', () => {
    expect(createInvoiceSchema.safeParse({ ...valid, lines: Array.from({ length: 201 }, () => line) }).success).toBe(false)
  })
})

describe('recordPaymentSchema', () => {
  const payment = { version: 1, amountMinor: 500, currency: 'KWD', method: 'cash', paidAt: '2026-10-05T09:00:00Z' }

  it('accepts a valid payment', () => {
    expect(recordPaymentSchema.safeParse(payment).success).toBe(true)
  })

  it('rejects zero, negative and non-KWD payments', () => {
    expect(recordPaymentSchema.safeParse({ ...payment, amountMinor: 0 }).success).toBe(false)
    expect(recordPaymentSchema.safeParse({ ...payment, amountMinor: -5 }).success).toBe(false)
    expect(recordPaymentSchema.safeParse({ ...payment, currency: 'USD' }).success).toBe(false)
    expect(recordPaymentSchema.safeParse({ ...payment, paidAt: 'yesterday' }).success).toBe(false)
  })
})

describe('listInvoicesQuerySchema', () => {
  it('defaults to newest first, 25 per page, and caps the limit at 100', () => {
    expect(listInvoicesQuerySchema.parse({})).toMatchObject({ limit: 25, sort: 'createdAt', direction: 'desc' })
    expect(listInvoicesQuerySchema.safeParse({ limit: '101' }).success).toBe(false)
  })

  it('only allows whitelisted sort keys and statuses', () => {
    expect(listInvoicesQuerySchema.safeParse({ sort: 'notes; drop table' }).success).toBe(false)
    expect(listInvoicesQuerySchema.safeParse({ status: 'archived' }).success).toBe(false)
    expect(listInvoicesQuerySchema.safeParse({ status: 'paid', sort: 'dueDate', direction: 'asc' }).success).toBe(true)
  })
})

describe('invoice lines with stock', () => {
  it('treats a missing item and warehouse as a service line', () => {
    expect(invoiceLineSchema.parse(line)).toMatchObject({ itemId: null, warehouseId: null })
  })

  it('needs an item and a warehouse together', () => {
    expect(invoiceLineSchema.safeParse({ ...line, itemId: STOCK_ITEM_ID, warehouseId: STOCK_WAREHOUSE_ID }).success).toBe(true)
    expect(invoiceLineSchema.safeParse({ ...line, itemId: STOCK_ITEM_ID }).success).toBe(false)
    expect(invoiceLineSchema.safeParse({ ...line, warehouseId: STOCK_WAREHOUSE_ID }).success).toBe(false)
    expect(invoiceLineSchema.safeParse({ ...line, itemId: 'x', warehouseId: STOCK_WAREHOUSE_ID }).success).toBe(false)
  })
})
