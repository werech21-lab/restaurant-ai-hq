import { describe, expect, it } from 'vitest'
import { CurrencyMismatchError } from '@/lib/money'
import { computeTotals } from '@/modules/finance/client'
import {
  addDays,
  assertInvoiceCurrency,
  assertTotalMatches,
  buildPostingLines,
  canInvoiceOrder,
  canVoidInvoice,
  invoiceableQuantity,
  planInvoice,
} from '@/modules/procurement/domain/invoice'
import { canCancelRequest, isRequestEditable, planConversion } from '@/modules/procurement/domain/request'
import type { OrderLine, RequestLine } from '@/modules/procurement/domain/types'

/** The pure rules of the procure-to-pay cycle: what can be invoiced, how an invoice is posted, and how a request becomes an order. */

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function orderLine(n: number, quantity: number, receivedQuantity: number, invoicedQuantity = 0, unitCostMinor = 1000, taxRateBps = 0): OrderLine {
  return { id: uuid(n), lineNo: n, itemId: uuid(100 + n), description: `line ${n}`, quantity, unitCostMinor, taxRateBps, receivedQuantity, returnedQuantity: 0, invoicedQuantity, creditedQuantity: 0 }
}

function codeOf(fn: () => unknown): string {
  try {
    fn()
    return 'ok'
  } catch (error) {
    return (error as { code?: string; name?: string }).code ?? (error as Error).name
  }
}

const accounts = { inventoryAccountId: uuid(901), payableAccountId: uuid(902), inputTaxAccountId: uuid(903) }

describe('what can be invoiced', () => {
  it('is what was received and not yet invoiced, never below zero', () => {
    expect(invoiceableQuantity(orderLine(1, 10, 6, 4))).toBe(2)
    expect(invoiceableQuantity(orderLine(1, 10, 0, 0))).toBe(0)
    expect(invoiceableQuantity(orderLine(1, 10, 3, 5))).toBe(0)
  })

  it('plans a partial invoice and copies price and tax from the order line', () => {
    const planned = planInvoice([orderLine(1, 10, 6, 0, 1250, 500), orderLine(2, 5, 5, 2)], [
      { orderLineId: uuid(1), quantity: 4 },
      { orderLineId: uuid(2), quantity: 3 },
    ])
    expect(planned).toEqual([
      { orderLineId: uuid(1), itemId: uuid(101), description: 'line 1', quantity: 4, unitCostMinor: 1250, taxRateBps: 500, poUnitCostMinor: 1250, poTaxRateBps: 500 },
      { orderLineId: uuid(2), itemId: uuid(102), description: 'line 2', quantity: 3, unitCostMinor: 1000, taxRateBps: 0, poUnitCostMinor: 1000, poTaxRateBps: 0 },
    ])
  })

  it('allows billing the exact open quantity and refuses one more', () => {
    expect(planInvoice([orderLine(1, 10, 6, 4)], [{ orderLineId: uuid(1), quantity: 2 }])).toHaveLength(1)
    expect(codeOf(() => planInvoice([orderLine(1, 10, 6, 4)], [{ orderLineId: uuid(1), quantity: 3 }]))).toBe('over_invoice')
  })

  it('refuses goods that were ordered but not received', () => {
    expect(codeOf(() => planInvoice([orderLine(1, 10, 0, 0)], [{ orderLineId: uuid(1), quantity: 1 }]))).toBe('over_invoice')
  })

  it('refuses an empty invoice, an unknown line, a repeated line and a bad quantity', () => {
    const lines = [orderLine(1, 10, 10)]
    expect(codeOf(() => planInvoice(lines, []))).toBe('nothing_to_invoice')
    expect(codeOf(() => planInvoice(lines, [{ orderLineId: uuid(9), quantity: 1 }]))).toBe('order_line_not_found')
    expect(
      codeOf(() =>
        planInvoice(lines, [
          { orderLineId: uuid(1), quantity: 1 },
          { orderLineId: uuid(1), quantity: 1 },
        ])
      )
    ).toBe('duplicate_invoice_line')
    expect(codeOf(() => planInvoice(lines, [{ orderLineId: uuid(1), quantity: 0 }]))).toBe('invalid_quantity')
    expect(codeOf(() => planInvoice(lines, [{ orderLineId: uuid(1), quantity: -2 }]))).toBe('invalid_quantity')
    expect(codeOf(() => planInvoice(lines, [{ orderLineId: uuid(1), quantity: 1.5 }]))).toBe('invalid_quantity')
  })

  it('only invoices an order that has received goods', () => {
    expect(['draft', 'pending_approval', 'approved', 'cancelled'].some((status) => canInvoiceOrder(status as never))).toBe(false)
    expect(canInvoiceOrder('partially_received')).toBe(true)
    expect(canInvoiceOrder('received')).toBe(true)
    expect(canVoidInvoice('posted')).toBe(true)
    expect(canVoidInvoice('void')).toBe(false)
  })
})

describe('currency and the supplier total', () => {
  it('accepts KWD and refuses any other currency', () => {
    expect(() => assertInvoiceCurrency('KWD')).not.toThrow()
    expect(codeOf(() => assertInvoiceCurrency('USD'))).toBe('CurrencyMismatchError')
    expect(() => assertInvoiceCurrency('usd')).toThrow(CurrencyMismatchError)
  })

  it('stops when the supplier total differs by even one fils', () => {
    const totals = computeTotals([{ quantity: 3, unitPriceMinor: 1000, taxRateBps: 500 }])
    expect(totals.totalMinor).toBe(3150)
    expect(() => assertTotalMatches(null, totals)).not.toThrow()
    expect(() => assertTotalMatches(undefined, totals)).not.toThrow()
    expect(() => assertTotalMatches(3150, totals)).not.toThrow()
    expect(codeOf(() => assertTotalMatches(3149, totals))).toBe('total_mismatch')
    expect(codeOf(() => assertTotalMatches(3151, totals))).toBe('total_mismatch')
    expect(codeOf(() => assertTotalMatches(0, totals))).toBe('total_mismatch')
  })
})

describe('posting lines', () => {
  const sum = (lines: ReadonlyArray<{ debitMinor: number; creditMinor: number }>) => ({
    debit: lines.reduce((total, line) => total + BigInt(line.debitMinor), 0n),
    credit: lines.reduce((total, line) => total + BigInt(line.creditMinor), 0n),
  })

  it('debits inventory by the net and credits payable by the total, balanced', () => {
    const totals = computeTotals([{ quantity: 4, unitPriceMinor: 2500, taxRateBps: 0 }])
    const lines = buildPostingLines(totals, accounts, 'memo')
    expect(lines).toEqual([
      { accountId: accounts.inventoryAccountId, debitMinor: 10000, creditMinor: 0, description: 'memo' },
      { accountId: accounts.payableAccountId, debitMinor: 0, creditMinor: 10000, description: 'memo' },
    ])
  })

  it('adds an input tax debit when there is tax, and the entry still balances', () => {
    const totals = computeTotals([{ quantity: 4, unitPriceMinor: 2500, taxRateBps: 500 }])
    const lines = buildPostingLines(totals, accounts, 'memo')
    expect(lines.map((line) => [line.accountId, line.debitMinor, line.creditMinor])).toEqual([
      [accounts.inventoryAccountId, 10000, 0],
      [accounts.inputTaxAccountId, 500, 0],
      [accounts.payableAccountId, 0, 10500],
    ])
    const { debit, credit } = sum(lines)
    expect(debit).toBe(credit)
  })

  it('balances at the rounding edge: tax rounds half up once for the whole invoice', () => {
    // 10 fils at 5% is exactly half a fils of tax, which rounds up to 1.
    const up = computeTotals([{ quantity: 1, unitPriceMinor: 10, taxRateBps: 500 }])
    expect(up).toEqual({ subtotalMinor: 10, taxMinor: 1, totalMinor: 11 })
    expect(sum(buildPostingLines(up, accounts, 'm')).debit).toBe(11n)
    // 9 fils at 5% is 0.45 fils, which rounds down to 0, so there is no tax line at all.
    const down = computeTotals([{ quantity: 1, unitPriceMinor: 9, taxRateBps: 500 }])
    expect(down.taxMinor).toBe(0)
    expect(buildPostingLines(down, { ...accounts, inputTaxAccountId: null }, 'm')).toHaveLength(2)
    // Two lines whose unrounded taxes add up to a whole fils: 0.45 + 0.45 = 0.9, which rounds to 1 once.
    const pair = computeTotals([
      { quantity: 1, unitPriceMinor: 9, taxRateBps: 500 },
      { quantity: 1, unitPriceMinor: 9, taxRateBps: 500 },
    ])
    expect(pair.taxMinor).toBe(1)
    const { debit, credit } = sum(buildPostingLines(pair, accounts, 'm'))
    expect(debit).toBe(credit)
  })

  it('refuses a zero invoice', () => {
    const zero = computeTotals([{ quantity: 5, unitPriceMinor: 0, taxRateBps: 500 }])
    expect(codeOf(() => buildPostingLines(zero, accounts, 'm'))).toBe('zero_invoice')
  })

  it('refuses to post before the accounts are chosen, and tax without a tax account', () => {
    const plain = computeTotals([{ quantity: 1, unitPriceMinor: 1000, taxRateBps: 0 }])
    const taxed = computeTotals([{ quantity: 1, unitPriceMinor: 1000, taxRateBps: 500 }])
    expect(codeOf(() => buildPostingLines(plain, { inventoryAccountId: null, payableAccountId: null, inputTaxAccountId: null }, 'm'))).toBe('accounts_not_configured')
    expect(codeOf(() => buildPostingLines(plain, { ...accounts, payableAccountId: null }, 'm'))).toBe('accounts_not_configured')
    expect(codeOf(() => buildPostingLines(taxed, { ...accounts, inputTaxAccountId: null }, 'm'))).toBe('accounts_not_configured')
    expect(() => buildPostingLines(plain, { ...accounts, inputTaxAccountId: null }, 'm')).not.toThrow()
  })

  it('stays exact for very large amounts', () => {
    const big = computeTotals([{ quantity: 400_000, unitPriceMinor: 999_999, taxRateBps: 10_000 }])
    const { debit, credit } = sum(buildPostingLines(big, accounts, 'm'))
    expect(debit).toBe(credit)
    expect(debit).toBe(BigInt(big.totalMinor))
    expect(codeOf(() => computeTotals([{ quantity: 1_000_000, unitPriceMinor: 999_999, taxRateBps: 10_000 }]))).toBe('amount_too_large')
  })
})

describe('due dates', () => {
  it('adds days across month, year and leap-day boundaries without time zone effects', () => {
    expect(addDays('2026-05-01', 30)).toBe('2026-05-31')
    expect(addDays('2026-12-15', 30)).toBe('2027-01-14')
    expect(addDays('2028-02-15', 14)).toBe('2028-02-29')
    expect(addDays('2027-02-15', 14)).toBe('2027-03-01')
    expect(addDays('2026-05-01', 0)).toBe('2026-05-01')
  })
})

describe('purchase requests', () => {
  const lines: RequestLine[] = [
    { id: uuid(1), lineNo: 1, itemId: uuid(101), description: 'Flour', quantity: 10 },
    { id: uuid(2), lineNo: 2, itemId: uuid(102), description: 'Sugar', quantity: 5 },
  ]

  it('can be edited only as a draft, and withdrawn until it becomes an order', () => {
    expect(isRequestEditable('draft')).toBe(true)
    expect(['submitted', 'approved', 'rejected', 'converted', 'cancelled'].some((status) => isRequestEditable(status as never))).toBe(false)
    expect(['draft', 'submitted', 'approved'].every((status) => canCancelRequest(status as never))).toBe(true)
    expect(['rejected', 'converted', 'cancelled'].some((status) => canCancelRequest(status as never))).toBe(false)
  })

  it('becomes order lines once every line is priced, keeping items and quantities', () => {
    const planned = planConversion(lines, [
      { requestLineId: uuid(2), unitCostMinor: 700, taxRateBps: 0 },
      { requestLineId: uuid(1), unitCostMinor: 1200, taxRateBps: 500 },
    ])
    expect(planned).toEqual([
      { itemId: uuid(101), description: 'Flour', quantity: 10, unitCostMinor: 1200, taxRateBps: 500 },
      { itemId: uuid(102), description: 'Sugar', quantity: 5, unitCostMinor: 700, taxRateBps: 0 },
    ])
  })

  it('refuses a missing price, an unknown line and a line priced twice', () => {
    expect(codeOf(() => planConversion(lines, [{ requestLineId: uuid(1), unitCostMinor: 1, taxRateBps: 0 }]))).toBe('request_line_unpriced')
    expect(codeOf(() => planConversion(lines, [{ requestLineId: uuid(9), unitCostMinor: 1, taxRateBps: 0 }]))).toBe('request_line_not_found')
    expect(
      codeOf(() =>
        planConversion(lines, [
          { requestLineId: uuid(1), unitCostMinor: 1, taxRateBps: 0 },
          { requestLineId: uuid(1), unitCostMinor: 2, taxRateBps: 0 },
        ])
      )
    ).toBe('duplicate_request_line')
  })
})
