import { describe, expect, it } from 'vitest'
import { canCancel, canReceive, isEditable, orderNeedsApproval, planReceipt, statusAfterReceipt } from '@/modules/procurement/domain/order'
import type { OrderLine } from '@/modules/procurement/domain/types'
import {
  createOrderSchema,
  createReceiptSchema,
  createSupplierSchema,
  orderLineSchema,
  updateSettingsSchema,
} from '@/modules/procurement/schemas/procurement'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function line(n: number, quantity: number, receivedQuantity = 0): OrderLine {
  return { id: uuid(n), lineNo: n, itemId: uuid(100 + n), description: `line ${n}`, quantity, unitCostMinor: 1000, taxRateBps: 0, receivedQuantity, returnedQuantity: 0, invoicedQuantity: 0, creditedQuantity: 0 }
}

function codeOf(fn: () => unknown): string {
  try {
    fn()
    return 'ok'
  } catch (error) {
    return (error as { code?: string }).code ?? (error as Error).name
  }
}

describe('orderNeedsApproval', () => {
  it('needs approval only when the total is strictly above the limit', () => {
    expect(orderNeedsApproval(5_000_001, 5_000_000)).toBe(true)
    expect(orderNeedsApproval(5_000_000, 5_000_000)).toBe(false)
    expect(orderNeedsApproval(4_999_999, 5_000_000)).toBe(false)
  })

  it('a zero limit approves nothing without a person, and a total of zero never needs it', () => {
    expect(orderNeedsApproval(1, 0)).toBe(true)
    expect(orderNeedsApproval(0, 0)).toBe(false)
  })

  it('with no limit set nothing needs approval, however large', () => {
    expect(orderNeedsApproval(1_000_000_000_000, null)).toBe(false)
  })
})

describe('status rules', () => {
  it('only a draft is editable', () => {
    expect(isEditable('draft')).toBe(true)
    for (const status of ['pending_approval', 'approved', 'partially_received', 'received', 'cancelled'] as const) expect(isEditable(status)).toBe(false)
  })

  it('cancels before any goods arrive and not after', () => {
    expect(['draft', 'pending_approval', 'approved'].every((status) => canCancel(status as 'draft'))).toBe(true)
    expect(['partially_received', 'received', 'cancelled'].some((status) => canCancel(status as 'draft'))).toBe(false)
  })

  it('receives only against an approved or partly received order', () => {
    expect(canReceive('approved')).toBe(true)
    expect(canReceive('partially_received')).toBe(true)
    for (const status of ['draft', 'pending_approval', 'received', 'cancelled'] as const) expect(canReceive(status)).toBe(false)
  })
})

describe('planReceipt', () => {
  const lines = [line(1, 10), line(2, 5, 2)]

  it('accepts a partial receipt and keeps the item of each line', () => {
    expect(planReceipt(lines, [{ orderLineId: uuid(1), quantity: 4 }])).toEqual([{ orderLineId: uuid(1), itemId: uuid(101), quantity: 4 }])
  })

  it('accepts exactly what is left, and refuses one more', () => {
    expect(planReceipt(lines, [{ orderLineId: uuid(2), quantity: 3 }])[0].quantity).toBe(3)
    expect(codeOf(() => planReceipt(lines, [{ orderLineId: uuid(2), quantity: 4 }]))).toBe('over_receipt')
  })

  it('refuses a line from another order, a repeated line, zero, negatives and fractions', () => {
    expect(codeOf(() => planReceipt(lines, [{ orderLineId: uuid(9), quantity: 1 }]))).toBe('order_line_not_found')
    expect(
      codeOf(() =>
        planReceipt(lines, [
          { orderLineId: uuid(1), quantity: 1 },
          { orderLineId: uuid(1), quantity: 1 },
        ])
      )
    ).toBe('duplicate_receipt_line')
    for (const quantity of [0, -1, 1.5]) expect(codeOf(() => planReceipt(lines, [{ orderLineId: uuid(1), quantity }]))).toBe('invalid_quantity')
  })

  it('refuses a line that is already fully received', () => {
    expect(codeOf(() => planReceipt([line(1, 5, 5)], [{ orderLineId: uuid(1), quantity: 1 }]))).toBe('over_receipt')
  })
})

describe('statusAfterReceipt', () => {
  it('is received only when every line is complete', () => {
    expect(statusAfterReceipt([line(1, 5, 5), line(2, 3, 3)])).toBe('received')
    expect(statusAfterReceipt([line(1, 5, 5), line(2, 3, 2)])).toBe('partially_received')
    expect(statusAfterReceipt([line(1, 5, 1)])).toBe('partially_received')
  })
})

describe('schemas', () => {
  const goodLine = { itemId: uuid(1), description: 'Flour', quantity: 10, unitCostMinor: 1500, taxRateBps: 0 }

  it('accepts a whole-number line and refuses fractions, negatives, zero quantity and a tax above 100 percent', () => {
    expect(orderLineSchema.safeParse(goodLine).success).toBe(true)
    expect(orderLineSchema.safeParse({ ...goodLine, quantity: 1.5 }).success).toBe(false)
    expect(orderLineSchema.safeParse({ ...goodLine, quantity: 0 }).success).toBe(false)
    expect(orderLineSchema.safeParse({ ...goodLine, unitCostMinor: -1 }).success).toBe(false)
    expect(orderLineSchema.safeParse({ ...goodLine, unitCostMinor: 10.5 }).success).toBe(false)
    expect(orderLineSchema.safeParse({ ...goodLine, taxRateBps: 10_001 }).success).toBe(false)
  })

  it('needs a line, real dates and an expected date on or after the order date', () => {
    const base = { supplierId: uuid(5), orderDate: '2026-05-01', lines: [goodLine] }
    expect(createOrderSchema.safeParse(base).success).toBe(true)
    expect(createOrderSchema.safeParse({ ...base, lines: [] }).success).toBe(false)
    expect(createOrderSchema.safeParse({ ...base, orderDate: '2026-02-30' }).success).toBe(false)
    expect(createOrderSchema.safeParse({ ...base, expectedDate: '2026-04-30' }).success).toBe(false)
    expect(createOrderSchema.safeParse({ ...base, expectedDate: '2026-05-01' }).success).toBe(true)
  })

  it('upper-cases supplier codes and bounds the payment terms', () => {
    expect(createSupplierSchema.parse({ code: 'gulf-1', name: 'Gulf Foods' }).code).toBe('GULF-1')
    expect(createSupplierSchema.safeParse({ code: 'has space', name: 'x' }).success).toBe(false)
    expect(createSupplierSchema.safeParse({ code: 'A', name: 'x', paymentTermsDays: 366 }).success).toBe(false)
    expect(createSupplierSchema.safeParse({ code: 'A', name: 'x', paymentTermsDays: -1 }).success).toBe(false)
  })

  it('refuses a receipt that repeats an order line', () => {
    const base = { version: 1, warehouseId: uuid(7), receiptDate: '2026-05-02' }
    expect(createReceiptSchema.safeParse({ ...base, lines: [{ orderLineId: uuid(1), quantity: 1 }] }).success).toBe(true)
    expect(
      createReceiptSchema.safeParse({
        ...base,
        lines: [
          { orderLineId: uuid(1), quantity: 1 },
          { orderLineId: uuid(1), quantity: 2 },
        ],
      }).success
    ).toBe(false)
  })

  it('takes a null or whole-fils approval limit and never a fraction or a negative', () => {
    expect(updateSettingsSchema.safeParse({ version: 0, approvalThresholdMinor: null }).success).toBe(true)
    expect(updateSettingsSchema.safeParse({ version: 0, approvalThresholdMinor: 5_000_000 }).success).toBe(true)
    expect(updateSettingsSchema.safeParse({ version: 0, approvalThresholdMinor: -1 }).success).toBe(false)
    expect(updateSettingsSchema.safeParse({ version: 0, approvalThresholdMinor: 1.5 }).success).toBe(false)
  })
})
