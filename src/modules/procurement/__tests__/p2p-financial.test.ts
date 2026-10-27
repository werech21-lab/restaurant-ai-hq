import { describe, expect, it } from 'vitest'
import { CurrencyMismatchError } from '@/lib/money'
import { assertInvoiceCurrency } from '@/modules/procurement/domain/invoice'
import { evaluateMatch, invoiceableQuantity, planInvoice, priceWithinTolerance } from '@/modules/procurement/domain/match'
import {
  buildCreditNoteLines,
  buildInvoiceLines,
  buildPaymentLines,
  buildReceiptLines,
  buildReturnLines,
  type LedgerAccounts,
} from '@/modules/procurement/domain/posting'
import { buildReconciliation } from '@/modules/procurement/domain/reconcile'
import {
  creditableQuantity,
  derivePaymentStatus,
  invoiceBalanceMinor,
  planCreditNote,
  planPayment,
  planReturn,
  returnableQuantity,
  valueOfLines,
} from '@/modules/procurement/domain/settlement'
import type { OrderLine, SupplierInvoiceLine } from '@/modules/procurement/domain/types'

/**
 * The pure rules of phase 1.4: three-way match with tolerances, the journal lines of every procurement document, what a return,
 * a credit note and a payment may take, and the reconciliation figures. Rounding, zero, negatives and a currency mismatch are
 * covered on purpose.
 */

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

type OrderLineOptions = { received?: number; returned?: number; invoiced?: number; credited?: number; cost?: number; rate?: number }

function orderLine(n: number, quantity: number, options: OrderLineOptions = {}): OrderLine {
  return {
    id: uuid(n),
    lineNo: n,
    itemId: uuid(100 + n),
    description: `line ${n}`,
    quantity,
    unitCostMinor: options.cost ?? 1000,
    taxRateBps: options.rate ?? 0,
    receivedQuantity: options.received ?? quantity,
    returnedQuantity: options.returned ?? 0,
    invoicedQuantity: options.invoiced ?? 0,
    creditedQuantity: options.credited ?? 0,
  }
}

function invoiceLine(n: number, orderLineId: string, quantity: number, creditedQuantity = 0, unitCostMinor = 1000, taxRateBps = 0, poUnitCostMinor = unitCostMinor): SupplierInvoiceLine {
  return { id: uuid(200 + n), lineNo: n, orderLineId, itemId: uuid(100 + n), description: `line ${n}`, quantity, unitCostMinor, taxRateBps, poUnitCostMinor, poTaxRateBps: taxRateBps, creditedQuantity }
}

function codeOf(fn: () => unknown): string {
  try {
    fn()
    return 'ok'
  } catch (error) {
    return (error as { code?: string; name?: string }).code ?? (error as Error).name
  }
}

const accounts: LedgerAccounts = {
  inventoryAccountId: uuid(901),
  payableAccountId: uuid(902),
  inputTaxAccountId: uuid(903),
  grniAccountId: uuid(904),
  ppvAccountId: uuid(905),
}

function balance(lines: ReadonlyArray<{ debitMinor: number; creditMinor: number }>): { debit: number; credit: number } {
  return { debit: lines.reduce((sum, line) => sum + line.debitMinor, 0), credit: lines.reduce((sum, line) => sum + line.creditMinor, 0) }
}

function net(lines: ReadonlyArray<{ accountId: string; debitMinor: number; creditMinor: number }>, accountId: string): number {
  return lines.filter((line) => line.accountId === accountId).reduce((sum, line) => sum + line.debitMinor - line.creditMinor, 0)
}

describe('what can be billed', () => {
  it('is received, minus returned, minus billed net of credit notes, never below zero', () => {
    expect(invoiceableQuantity(orderLine(1, 10, { received: 10, returned: 2, invoiced: 5, credited: 0 }))).toBe(3)
    expect(invoiceableQuantity(orderLine(1, 10, { received: 10, returned: 3, invoiced: 10, credited: 3 }))).toBe(0)
    expect(invoiceableQuantity(orderLine(1, 10, { received: 4, returned: 4, invoiced: 0 }))).toBe(0)
    expect(invoiceableQuantity(orderLine(1, 10, { received: 2, returned: 0, invoiced: 5 }))).toBe(0)
  })
})

describe('price tolerance', () => {
  it('is checked as a share of the order price, in whole numbers, and is exact at the boundary', () => {
    expect(priceWithinTolerance(1000, 1000, 0)).toBe(true)
    expect(priceWithinTolerance(1001, 1000, 0)).toBe(false)
    expect(priceWithinTolerance(1010, 1000, 100)).toBe(true) // exactly 1 percent
    expect(priceWithinTolerance(1011, 1000, 100)).toBe(false)
    expect(priceWithinTolerance(990, 1000, 100)).toBe(true)
    expect(priceWithinTolerance(989, 1000, 100)).toBe(false)
  })

  it('treats a zero order price as no room: only a zero price matches', () => {
    expect(priceWithinTolerance(0, 0, 500)).toBe(true)
    expect(priceWithinTolerance(1, 0, 500)).toBe(false)
  })

  it('does not overflow on the largest price', () => {
    expect(priceWithinTolerance(1_000_000_000, 1_000_000_000, 10_000)).toBe(true)
    expect(priceWithinTolerance(1_000_000_000, 1, 0)).toBe(false)
  })
})

describe('three-way match', () => {
  it('matches when quantity, price and rate agree with the order', () => {
    const { result, planned } = evaluateMatch([orderLine(1, 10, { rate: 500 })], [{ orderLineId: uuid(1), quantity: 4 }])
    expect(result).toMatchObject({ status: 'matched', poNetMinor: 4000, subtotalMinor: 4000, taxMinor: 200, totalMinor: 4200, priceVarianceMinor: 0, taxVarianceMinor: 0, issues: [] })
    expect(planned).toHaveLength(1)
  })

  it('accepts a price above the order inside the tolerance and reports the variance', () => {
    const { result } = evaluateMatch([orderLine(1, 10)], [{ orderLineId: uuid(1), quantity: 4, unitCostMinor: 1020 }], { priceToleranceBps: 200, taxToleranceMinor: 0 })
    expect(result).toMatchObject({ status: 'within_tolerance', poNetMinor: 4000, subtotalMinor: 4080, priceVarianceMinor: 80, issues: [] })
    expect(result.lines[0]).toMatchObject({ status: 'within_tolerance', priceVarianceMinor: 80 })
  })

  it('reports a price below the order as a negative variance', () => {
    const { result } = evaluateMatch([orderLine(1, 10)], [{ orderLineId: uuid(1), quantity: 4, unitCostMinor: 990 }], { priceToleranceBps: 200, taxToleranceMinor: 0 })
    expect(result).toMatchObject({ status: 'within_tolerance', subtotalMinor: 3960, priceVarianceMinor: -40 })
  })

  it('blocks a price beyond the tolerance, and plans nothing', () => {
    const { result, planned } = evaluateMatch([orderLine(1, 10)], [{ orderLineId: uuid(1), quantity: 4, unitCostMinor: 1021 }], { priceToleranceBps: 200, taxToleranceMinor: 0 })
    expect(result.status).toBe('blocked')
    expect(result.issues.map((issue) => issue.code)).toEqual(['price_variance_exceeded'])
    expect(planned).toEqual([])
  })

  it('blocks billing past the open quantity, one line at a time', () => {
    const lines = [orderLine(1, 10, { received: 6, invoiced: 4 }), orderLine(2, 5)]
    const { result } = evaluateMatch(lines, [
      { orderLineId: uuid(1), quantity: 3 },
      { orderLineId: uuid(2), quantity: 5 },
    ])
    expect(result.issues).toMatchObject([{ code: 'over_invoice', orderLineId: uuid(1) }])
    expect(result.lines.map((line) => line.status)).toEqual(['blocked', 'matched'])
  })

  it('reports tax that differs from the order rates on the billed prices, and the tolerance decides', () => {
    const lines = [orderLine(1, 10, { rate: 500 })]
    const request = [{ orderLineId: uuid(1), quantity: 10, taxRateBps: 600 }]
    // 10 x 1000 at 6 percent is 600, at the order's 5 percent it is 500: a variance of 100.
    expect(evaluateMatch(lines, request, { priceToleranceBps: 0, taxToleranceMinor: 99 }).result.issues.map((issue) => issue.code)).toEqual(['tax_variance_exceeded'])
    const allowed = evaluateMatch(lines, request, { priceToleranceBps: 0, taxToleranceMinor: 100 }).result
    expect(allowed).toMatchObject({ status: 'within_tolerance', taxMinor: 600, taxVarianceMinor: 100, issues: [] })
  })

  it('does not count tax that follows a price change as a tax variance', () => {
    const { result } = evaluateMatch([orderLine(1, 10, { rate: 500 })], [{ orderLineId: uuid(1), quantity: 10, unitCostMinor: 1100 }], { priceToleranceBps: 1000, taxToleranceMinor: 0 })
    expect(result).toMatchObject({ subtotalMinor: 11000, taxMinor: 550, priceVarianceMinor: 1000, taxVarianceMinor: 0, status: 'within_tolerance' })
  })

  it('rounds the tax once per invoice, half up, from unrounded line taxes', () => {
    // Three lines of 1 x 10 fils at 5 percent: each line tax is 0.5 fils. Rounding per line would give 0 or 3; once gives 2 (1.5 up).
    const lines = [orderLine(1, 1, { cost: 10, rate: 500 }), orderLine(2, 1, { cost: 10, rate: 500 }), orderLine(3, 1, { cost: 10, rate: 500 })]
    const { result } = evaluateMatch(lines, [
      { orderLineId: uuid(1), quantity: 1 },
      { orderLineId: uuid(2), quantity: 1 },
      { orderLineId: uuid(3), quantity: 1 },
    ])
    expect(result).toMatchObject({ subtotalMinor: 30, taxMinor: 2, totalMinor: 32 })
  })

  it('refuses zero and negative quantities and out-of-range prices and rates', () => {
    const lines = [orderLine(1, 10)]
    const codes = (quantity: number, extra: { unitCostMinor?: number; taxRateBps?: number } = {}) =>
      evaluateMatch(lines, [{ orderLineId: uuid(1), quantity, ...extra }]).result.issues.map((issue) => issue.code)
    expect(codes(0)).toEqual(['invalid_quantity'])
    expect(codes(-1)).toEqual(['invalid_quantity'])
    expect(codes(1.5)).toEqual(['invalid_quantity'])
    expect(codes(1, { unitCostMinor: -1 })).toEqual(['invalid_price'])
    expect(codes(1, { taxRateBps: 10_001 })).toEqual(['invalid_price'])
  })

  it('refuses an unknown line, a repeated line and an empty request', () => {
    expect(codeOf(() => planInvoice([orderLine(1, 10)], [{ orderLineId: uuid(9), quantity: 1 }]))).toBe('order_line_not_found')
    expect(
      codeOf(() =>
        planInvoice([orderLine(1, 10)], [
          { orderLineId: uuid(1), quantity: 1 },
          { orderLineId: uuid(1), quantity: 1 },
        ])
      )
    ).toBe('duplicate_invoice_line')
    expect(codeOf(() => planInvoice([orderLine(1, 10)], []))).toBe('nothing_to_invoice')
  })

  it('copies the order price and rate onto every planned line', () => {
    const planned = planInvoice([orderLine(1, 10, { cost: 1250, rate: 500 })], [{ orderLineId: uuid(1), quantity: 2, unitCostMinor: 1260 }], { priceToleranceBps: 100, taxToleranceMinor: 5 })
    expect(planned[0]).toMatchObject({ unitCostMinor: 1260, poUnitCostMinor: 1250, taxRateBps: 500, poTaxRateBps: 500 })
  })
})

describe('the journal lines of every document', () => {
  it('post a receipt as Dr inventory / Cr GRNI and a return as the mirror', () => {
    const receipt = buildReceiptLines(7000, accounts, 'receipt')
    expect(balance(receipt)).toEqual({ debit: 7000, credit: 7000 })
    expect(net(receipt, accounts.inventoryAccountId!)).toBe(7000)
    expect(net(receipt, accounts.grniAccountId!)).toBe(-7000)
    const returned = buildReturnLines(3000, accounts, 'return')
    expect(net(returned, accounts.grniAccountId!)).toBe(3000)
    expect(net(returned, accounts.inventoryAccountId!)).toBe(-3000)
  })

  it('refuse a receipt or a return of nothing, a negative value and a missing account', () => {
    expect(codeOf(() => buildReceiptLines(0, accounts, 'm'))).toBe('zero_amount')
    expect(codeOf(() => buildReceiptLines(-5, accounts, 'm'))).toBe('zero_amount')
    expect(codeOf(() => buildReturnLines(0, accounts, 'm'))).toBe('zero_amount')
    expect(codeOf(() => buildReceiptLines(10, { ...accounts, grniAccountId: null }, 'm'))).toBe('accounts_not_configured')
    expect(codeOf(() => buildReturnLines(10, { ...accounts, inventoryAccountId: null }, 'm'))).toBe('accounts_not_configured')
    expect(codeOf(() => buildReceiptLines(2_000_000_000_000, accounts, 'm'))).toBe('amount_too_large')
  })

  it('post an invoice-basis invoice as Dr inventory, Dr tax / Cr payable', () => {
    const lines = buildInvoiceLines('invoice_basis', { subtotalMinor: 10_000, taxMinor: 500, totalMinor: 10_500 }, 10_000, accounts, 'm')
    expect(balance(lines)).toEqual({ debit: 10_500, credit: 10_500 })
    expect(net(lines, accounts.inventoryAccountId!)).toBe(10_000)
    expect(net(lines, accounts.inputTaxAccountId!)).toBe(500)
    expect(net(lines, accounts.payableAccountId!)).toBe(-10_500)
  })

  it('post a receipt-basis invoice by clearing GRNI at the order price and booking the variance', () => {
    const above = buildInvoiceLines('receipt_basis', { subtotalMinor: 4080, taxMinor: 204, totalMinor: 4284 }, 4000, accounts, 'm')
    expect(balance(above)).toEqual({ debit: 4284, credit: 4284 })
    expect(net(above, accounts.grniAccountId!)).toBe(4000)
    expect(net(above, accounts.ppvAccountId!)).toBe(80)
    expect(net(above, accounts.inventoryAccountId!)).toBe(0)
    const below = buildInvoiceLines('receipt_basis', { subtotalMinor: 3960, taxMinor: 0, totalMinor: 3960 }, 4000, accounts, 'm')
    expect(balance(below)).toEqual({ debit: 4000, credit: 4000 }) // Dr GRNI 4,000 / Cr variance 40 and payable 3,960
    expect(net(below, accounts.ppvAccountId!)).toBe(-40)
  })

  it('post no variance line for a zero variance and no tax line for zero tax', () => {
    const lines = buildInvoiceLines('receipt_basis', { subtotalMinor: 4000, taxMinor: 0, totalMinor: 4000 }, 4000, accounts, 'm')
    expect(lines).toHaveLength(2)
  })

  it('refuse an invoice with tax and no tax account, a variance and no variance account, and a zero total', () => {
    expect(codeOf(() => buildInvoiceLines('invoice_basis', { subtotalMinor: 100, taxMinor: 5, totalMinor: 105 }, 100, { ...accounts, inputTaxAccountId: null }, 'm'))).toBe('accounts_not_configured')
    expect(codeOf(() => buildInvoiceLines('receipt_basis', { subtotalMinor: 110, taxMinor: 0, totalMinor: 110 }, 100, { ...accounts, ppvAccountId: null }, 'm'))).toBe('accounts_not_configured')
    expect(codeOf(() => buildInvoiceLines('invoice_basis', { subtotalMinor: 0, taxMinor: 0, totalMinor: 0 }, 0, accounts, 'm'))).toBe('zero_invoice')
  })

  it('post a credit note as the mirror of the invoice, on both bases', () => {
    const invoiceBasis = buildCreditNoteLines('invoice_basis', { subtotalMinor: 3000, taxMinor: 150, totalMinor: 3150 }, 3000, accounts, 'm')
    expect(balance(invoiceBasis)).toEqual({ debit: 3150, credit: 3150 })
    expect(net(invoiceBasis, accounts.payableAccountId!)).toBe(3150)
    expect(net(invoiceBasis, accounts.inventoryAccountId!)).toBe(-3000)
    const receiptBasis = buildCreditNoteLines('receipt_basis', { subtotalMinor: 3060, taxMinor: 153, totalMinor: 3213 }, 3000, accounts, 'm')
    expect(balance(receiptBasis)).toEqual({ debit: 3213, credit: 3213 })
    expect(net(receiptBasis, accounts.grniAccountId!)).toBe(-3000)
    expect(net(receiptBasis, accounts.ppvAccountId!)).toBe(-60)
    const cheaper = buildCreditNoteLines('receipt_basis', { subtotalMinor: 2940, taxMinor: 0, totalMinor: 2940 }, 3000, accounts, 'm')
    expect(net(cheaper, accounts.ppvAccountId!)).toBe(60)
  })

  it('post a payment as Dr payable / Cr the paying account, and refuse zero and negative amounts', () => {
    const lines = buildPaymentLines(2500, uuid(950), accounts, 'm')
    expect(balance(lines)).toEqual({ debit: 2500, credit: 2500 })
    expect(net(lines, accounts.payableAccountId!)).toBe(2500)
    expect(net(lines, uuid(950))).toBe(-2500)
    expect(codeOf(() => buildPaymentLines(0, uuid(950), accounts, 'm'))).toBe('zero_amount')
    expect(codeOf(() => buildPaymentLines(-1, uuid(950), accounts, 'm'))).toBe('zero_amount')
    expect(codeOf(() => buildPaymentLines(10, uuid(950), { ...accounts, payableAccountId: null }, 'm'))).toBe('accounts_not_configured')
  })

  it('refuse a document in another currency than KWD', () => {
    expect(codeOf(() => assertInvoiceCurrency('KWD'))).toBe('ok')
    expect(codeOf(() => assertInvoiceCurrency('USD'))).toBe(new CurrencyMismatchError('KWD', 'USD').name)
  })
})

describe('purchase returns', () => {
  it('may take what was received and not yet returned', () => {
    expect(returnableQuantity(orderLine(1, 10, { received: 6, returned: 2 }))).toBe(4)
    expect(returnableQuantity(orderLine(1, 10, { received: 2, returned: 5 }))).toBe(0)
    const planned = planReturn([orderLine(1, 10, { received: 6, returned: 2, cost: 1250 })], [{ orderLineId: uuid(1), quantity: 4 }])
    expect(planned).toEqual([{ orderLineId: uuid(1), itemId: uuid(101), quantity: 4, unitCostMinor: 1250 }])
  })

  it('refuses one more than is open, zero, a fraction, a repeat, an unknown line and an empty return', () => {
    const lines = [orderLine(1, 10, { received: 6, returned: 2 })]
    expect(codeOf(() => planReturn(lines, [{ orderLineId: uuid(1), quantity: 5 }]))).toBe('over_return')
    expect(codeOf(() => planReturn(lines, [{ orderLineId: uuid(1), quantity: 0 }]))).toBe('invalid_quantity')
    expect(codeOf(() => planReturn(lines, [{ orderLineId: uuid(1), quantity: 1.5 }]))).toBe('invalid_quantity')
    expect(codeOf(() => planReturn(lines, [{ orderLineId: uuid(1), quantity: 1 }, { orderLineId: uuid(1), quantity: 1 }]))).toBe('duplicate_return_line')
    expect(codeOf(() => planReturn(lines, [{ orderLineId: uuid(9), quantity: 1 }]))).toBe('order_line_not_found')
    expect(codeOf(() => planReturn(lines, []))).toBe('nothing_to_return')
  })

  it('values lines in BigInt and refuses a value beyond the maximum', () => {
    expect(valueOfLines([{ quantity: 3, unitCostMinor: 1250 }, { quantity: 2, unitCostMinor: 7 }])).toBe(3764)
    expect(valueOfLines([])).toBe(0)
    expect(codeOf(() => valueOfLines([{ quantity: 1_000_000, unitCostMinor: 1_000_000_000 }]))).toBe('amount_too_large')
  })
})

describe('credit notes', () => {
  it('may take only goods that were billed and are no longer held', () => {
    // Billed 10, received 10, 3 went back and are not credited yet: 3 can be credited.
    const order = orderLine(1, 10, { received: 10, returned: 3, invoiced: 10, credited: 0 })
    expect(creditableQuantity(invoiceLine(1, uuid(1), 10), order)).toBe(3)
    // Nothing went back: nothing to credit.
    expect(creditableQuantity(invoiceLine(1, uuid(1), 10), orderLine(1, 10, { received: 10, invoiced: 10 }))).toBe(0)
    // Goods that were never billed (received 10, billed 4, returned 3) are not creditable: 7 held >= 4 billed net.
    expect(creditableQuantity(invoiceLine(1, uuid(1), 4), orderLine(1, 10, { received: 10, returned: 3, invoiced: 4 }))).toBe(0)
  })

  it('plans a credit at the billed price and copies the order price', () => {
    const order = orderLine(1, 10, { received: 10, returned: 4, invoiced: 10 })
    const planned = planCreditNote([invoiceLine(1, uuid(1), 10, 0, 1020, 500, 1000)], [order], [{ invoiceLineId: uuid(201), quantity: 4 }])
    expect(planned).toEqual([{ invoiceLineId: uuid(201), orderLineId: uuid(1), itemId: uuid(101), quantity: 4, unitCostMinor: 1020, taxRateBps: 500, poUnitCostMinor: 1000 }])
  })

  it('refuses more than was returned, zero, a repeat and an unknown line', () => {
    const order = orderLine(1, 10, { received: 10, returned: 4, invoiced: 10 })
    const lines = [invoiceLine(1, uuid(1), 10)]
    expect(codeOf(() => planCreditNote(lines, [order], [{ invoiceLineId: uuid(201), quantity: 5 }]))).toBe('over_credit')
    expect(codeOf(() => planCreditNote(lines, [order], [{ invoiceLineId: uuid(201), quantity: 0 }]))).toBe('invalid_quantity')
    expect(codeOf(() => planCreditNote(lines, [order], [{ invoiceLineId: uuid(201), quantity: 1 }, { invoiceLineId: uuid(201), quantity: 1 }]))).toBe('duplicate_credit_line')
    expect(codeOf(() => planCreditNote(lines, [order], [{ invoiceLineId: uuid(999), quantity: 1 }]))).toBe('invoice_line_not_found')
    expect(codeOf(() => planCreditNote(lines, [order], []))).toBe('nothing_to_credit')
  })

  it('shares one return between two invoices of the same order line', () => {
    // 10 billed over two invoices (6 and 4), 5 went back: 5 can be credited across both, not 5 on each.
    const order = orderLine(1, 10, { received: 10, returned: 5, invoiced: 10 })
    const first = { ...invoiceLine(1, uuid(1), 6), id: uuid(201) }
    const second = { ...invoiceLine(2, uuid(1), 4), id: uuid(202) }
    expect(codeOf(() => planCreditNote([first, second], [order], [{ invoiceLineId: uuid(201), quantity: 4 }, { invoiceLineId: uuid(202), quantity: 2 }]))).toBe('over_credit')
    expect(planCreditNote([first, second], [order], [{ invoiceLineId: uuid(201), quantity: 3 }, { invoiceLineId: uuid(202), quantity: 2 }])).toHaveLength(2)
  })
})

describe('supplier payments', () => {
  const invoice = (n: number, balanceMinor: number, extra: Partial<{ supplierId: string; status: 'posted' | 'void'; invoiceDate: string }> = {}) => ({
    id: uuid(300 + n),
    supplierId: uuid(1),
    status: 'posted' as const,
    invoiceDate: '2026-05-01',
    balanceMinor,
    ...extra,
  })

  it('derives the balance and the status from total, paid and credited', () => {
    expect(invoiceBalanceMinor(10_000, 4_000, 1_000)).toBe(5_000)
    expect(invoiceBalanceMinor(10_000, 10_000, 0)).toBe(0)
    expect(invoiceBalanceMinor(10_000, 9_000, 3_000)).toBe(0)
    expect(derivePaymentStatus(10_000, 0, 0)).toBe('unpaid')
    expect(derivePaymentStatus(10_000, 4_000, 0)).toBe('partially_paid')
    expect(derivePaymentStatus(10_000, 4_000, 1_000)).toBe('partially_paid')
    expect(derivePaymentStatus(10_000, 10_000, 0)).toBe('paid')
    expect(derivePaymentStatus(10_000, 6_000, 4_000)).toBe('paid')
    expect(derivePaymentStatus(10_000, 0, 10_000)).toBe('credited')
  })

  it('allocates a payment in full, partially or across invoices', () => {
    const invoices = [invoice(1, 5_000), invoice(2, 3_000)]
    expect(planPayment(uuid(1), '2026-05-10', 2_000, [{ invoiceId: uuid(301), amountMinor: 2_000 }], invoices)).toHaveLength(1)
    expect(planPayment(uuid(1), '2026-05-10', 8_000, [{ invoiceId: uuid(301), amountMinor: 5_000 }, { invoiceId: uuid(302), amountMinor: 3_000 }], invoices)).toHaveLength(2)
  })

  it('refuses a payment beyond a balance by one fils, and exactly the balance passes', () => {
    const invoices = [invoice(1, 5_000)]
    expect(codeOf(() => planPayment(uuid(1), '2026-05-10', 5_001, [{ invoiceId: uuid(301), amountMinor: 5_001 }], invoices))).toBe('over_payment')
    expect(codeOf(() => planPayment(uuid(1), '2026-05-10', 5_000, [{ invoiceId: uuid(301), amountMinor: 5_000 }], invoices))).toBe('ok')
  })

  it('refuses allocations that do not add up to the amount, in either direction', () => {
    const invoices = [invoice(1, 5_000)]
    expect(codeOf(() => planPayment(uuid(1), '2026-05-10', 2_000, [{ invoiceId: uuid(301), amountMinor: 1_999 }], invoices))).toBe('allocation_mismatch')
    expect(codeOf(() => planPayment(uuid(1), '2026-05-10', 1_999, [{ invoiceId: uuid(301), amountMinor: 2_000 }], invoices))).toBe('allocation_mismatch')
    expect(codeOf(() => planPayment(uuid(1), '2026-05-10', 100, [], invoices))).toBe('allocation_mismatch')
  })

  it('refuses zero and negative amounts', () => {
    const invoices = [invoice(1, 5_000)]
    expect(codeOf(() => planPayment(uuid(1), '2026-05-10', 0, [{ invoiceId: uuid(301), amountMinor: 0 }], invoices))).toBe('zero_amount')
    expect(codeOf(() => planPayment(uuid(1), '2026-05-10', -5, [{ invoiceId: uuid(301), amountMinor: -5 }], invoices))).toBe('zero_amount')
    expect(codeOf(() => planPayment(uuid(1), '2026-05-10', 5, [{ invoiceId: uuid(301), amountMinor: 0 }], invoices))).toBe('zero_amount')
  })

  it('refuses another supplier, a void invoice, a date before the invoice, a repeat and an unknown invoice', () => {
    const amount = (invoices: ReturnType<typeof invoice>[], date = '2026-05-10') => planPayment(uuid(1), date, 100, [{ invoiceId: uuid(301), amountMinor: 100 }], invoices)
    expect(codeOf(() => amount([invoice(1, 500, { supplierId: uuid(2) })]))).toBe('supplier_mismatch')
    expect(codeOf(() => amount([invoice(1, 500, { status: 'void' })]))).toBe('invoice_not_posted')
    expect(codeOf(() => amount([invoice(1, 500)], '2026-04-30'))).toBe('payment_before_invoice')
    expect(codeOf(() => amount([]))).toBe('invoice_not_found')
    expect(
      codeOf(() => planPayment(uuid(1), '2026-05-10', 200, [{ invoiceId: uuid(301), amountMinor: 100 }, { invoiceId: uuid(301), amountMinor: 100 }], [invoice(1, 500)]))
    ).toBe('duplicate_allocation')
  })
})

describe('reconciliation figures', () => {
  const figures = { heldValueMinor: 7_000, unbilledValueMinor: 3_000, billedNetMinor: 4_000, openPayableMinor: 4_200 }

  it('is ok when the ledger holds what the documents say, on the receipt basis', () => {
    const report = buildReconciliation('receipt_basis', figures, {
      inventory: { debitMinor: 9_000, creditMinor: 2_000 },
      grni: { debitMinor: 4_000, creditMinor: 7_000 },
      payable: { debitMinor: 1_000, creditMinor: 5_200 },
    })
    expect(report.ok).toBe(true)
    expect(report.checks.map((entry) => [entry.key, entry.actualMinor, entry.expectedMinor])).toEqual([
      ['inventory', 7_000, 7_000],
      ['grni', 3_000, 3_000],
      ['payable', 4_200, 4_200],
    ])
  })

  it('names the account and the difference when the ledger is off', () => {
    const report = buildReconciliation('receipt_basis', figures, {
      inventory: { debitMinor: 7_000, creditMinor: 0 },
      grni: { debitMinor: 0, creditMinor: 2_900 },
      payable: { debitMinor: 0, creditMinor: 4_200 },
    })
    expect(report.ok).toBe(false)
    expect(report.checks.find((entry) => entry.key === 'grni')).toMatchObject({ ok: false, differenceMinor: -100 })
  })

  it('has no GRNI check on the invoice basis and treats a missing account as zero', () => {
    const report = buildReconciliation('invoice_basis', { ...figures, billedNetMinor: 0, openPayableMinor: 0 }, { inventory: null, grni: null, payable: null })
    expect(report.checks.map((entry) => entry.key)).toEqual(['inventory', 'payable'])
    expect(report.ok).toBe(true)
  })
})
