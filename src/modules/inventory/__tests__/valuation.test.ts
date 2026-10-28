import { describe, expect, it } from 'vitest'
import { DomainError } from '@/lib/domain-error'
import { applyIssueCost, applyReceiptCost, applyReturnCost, applyVarianceCost } from '@/modules/inventory/domain/valuation'
import { buildCreditNoteLines, buildInvoiceLines } from '@/modules/procurement/domain/posting'

const accounts = {
  inventoryAccountId: 'inventory',
  payableAccountId: 'payable',
  inputTaxAccountId: null,
  grniAccountId: 'grni',
  ppvAccountId: 'ppv',
}

function nets(lines: { accountId: string; debitMinor: number; creditMinor: number }[]): number {
  return lines.reduce((sum, line) => sum + line.debitMinor - line.creditMinor, 0)
}

describe('moving weighted average', () => {
  it('starts the average at the receipt cost when nothing is on hand', () => {
    expect(applyReceiptCost(0, 800, 5, 1_000)).toMatchObject({ averageAfterMinor: 1_000, valueDeltaMinor: 5_000, qtyAfter: 5 })
  })

  it('blends a second receipt and rounds half up once', () => {
    expect(applyReceiptCost(1, 1, 1, 2)).toMatchObject({ averageAfterMinor: 2, valueDeltaMinor: 2, qtyAfter: 2 })
    expect(applyReceiptCost(10, 1_000, 10, 3_000)).toMatchObject({ averageAfterMinor: 2_000, valueDeltaMinor: 30_000, qtyAfter: 20 })
  })

  it('issues at the average already in force and does not change it', () => {
    expect(applyIssueCost(20, 2_000, 10)).toMatchObject({
      averageAfterMinor: 2_000,
      valueDeltaMinor: -20_000,
      qtyAfter: 10,
      unitCostMinor: 2_000,
    })
  })

  it('removes a return at the order price and refuses a value below zero', () => {
    expect(applyReturnCost(5, 3_000, 5, 1_000)).toMatchObject({ averageAfterMinor: 3_000, valueDeltaMinor: -5_000, qtyAfter: 0 })
    expect(() => applyReturnCost(1, 100, 1, 101)).toThrow(DomainError)
    expect(() => applyReturnCost(1, 100, 1, 101)).toThrow(expect.objectContaining({ code: 'cost_exceeds_stock' }))
  })

  it('applies a price variance only to the quantity named, without changing the quantity', () => {
    expect(applyVarianceCost(5, 3_000, 5, 600)).toMatchObject({ averageAfterMinor: 3_600, valueDeltaMinor: 3_000, qtyDelta: 0, qtyAfter: 5 })
  })
})

describe('the new invoice reclass', () => {
  it('moves only the still-on-hand variance onto inventory and stays balanced', () => {
    const lines = buildInvoiceLines('receipt_basis', { subtotalMinor: 36_000, taxMinor: 0, totalMinor: 36_000 }, 30_000, accounts, 'invoice', 3_000)
    expect(nets(lines)).toBe(0)
    expect(lines).toEqual([
      { accountId: 'grni', debitMinor: 30_000, creditMinor: 0, description: 'invoice' },
      { accountId: 'ppv', debitMinor: 3_000, creditMinor: 0, description: 'invoice' },
      { accountId: 'inventory', debitMinor: 3_000, creditMinor: 0, description: 'invoice' },
      { accountId: 'payable', debitMinor: 0, creditMinor: 36_000, description: 'invoice' },
    ])
    const credit = buildCreditNoteLines('receipt_basis', { subtotalMinor: 36_000, taxMinor: 0, totalMinor: 36_000 }, 30_000, accounts, 'credit', 3_000)
    expect(nets(credit)).toBe(0)
  })
})
