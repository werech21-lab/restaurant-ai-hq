import { describe, expect, it } from 'vitest'
import { DomainError } from '@/lib/domain-error'
import { computeTotals, lineNetMinor, MAX_INVOICE_MINOR } from '@/modules/finance/domain/totals'

describe('computeTotals', () => {
  it('returns zeros for an empty invoice', () => {
    expect(computeTotals([])).toEqual({ subtotalMinor: 0, taxMinor: 0, totalMinor: 0 })
  })

  it('computes a single line with exact tax', () => {
    // 3 x 10.000 KWD = 30.000, 15% tax = 4.500
    expect(computeTotals([{ quantity: 3, unitPriceMinor: 10000, taxRateBps: 1500 }])).toEqual({
      subtotalMinor: 30000,
      taxMinor: 4500,
      totalMinor: 34500,
    })
  })

  it('supports a zero price and a zero tax rate', () => {
    expect(computeTotals([{ quantity: 5, unitPriceMinor: 0, taxRateBps: 1500 }]).totalMinor).toBe(0)
    expect(computeTotals([{ quantity: 2, unitPriceMinor: 1000, taxRateBps: 0 }])).toEqual({
      subtotalMinor: 2000,
      taxMinor: 0,
      totalMinor: 2000,
    })
  })

  it('applies different rates per line', () => {
    const totals = computeTotals([
      { quantity: 1, unitPriceMinor: 10000, taxRateBps: 1000 },
      { quantity: 1, unitPriceMinor: 20000, taxRateBps: 500 },
    ])
    expect(totals).toEqual({ subtotalMinor: 30000, taxMinor: 2000, totalMinor: 32000 })
  })

  it('rounds once per invoice, not per line', () => {
    // Each line: net 3 fils at 15% = 0.45 fils. Rounded per line that would be 0 + 0 + 0 = 0.
    // Summed first: 1.35 fils, rounded once = 1.
    const lines = [1, 2, 3].map(() => ({ quantity: 1, unitPriceMinor: 3, taxRateBps: 1500 }))
    expect(computeTotals(lines)).toEqual({ subtotalMinor: 9, taxMinor: 1, totalMinor: 10 })
  })

  it('rounds exactly half up', () => {
    // net 10 fils at 5% = 0.5 fils -> 1
    expect(computeTotals([{ quantity: 1, unitPriceMinor: 10, taxRateBps: 500 }]).taxMinor).toBe(1)
    // net 9 fils at 5% = 0.45 fils -> 0
    expect(computeTotals([{ quantity: 1, unitPriceMinor: 9, taxRateBps: 500 }]).taxMinor).toBe(0)
    // net 30 fils at 5% = 1.5 fils -> 2
    expect(computeTotals([{ quantity: 1, unitPriceMinor: 30, taxRateBps: 500 }]).taxMinor).toBe(2)
  })

  it('keeps total equal to subtotal plus tax', () => {
    const totals = computeTotals([
      { quantity: 7, unitPriceMinor: 1234, taxRateBps: 1250 },
      { quantity: 3, unitPriceMinor: 999, taxRateBps: 333 },
    ])
    expect(totals.totalMinor).toBe(totals.subtotalMinor + totals.taxMinor)
  })

  it('rejects negative or fractional inputs', () => {
    expect(() => computeTotals([{ quantity: -1, unitPriceMinor: 100, taxRateBps: 0 }])).toThrow(DomainError)
    expect(() => computeTotals([{ quantity: 1, unitPriceMinor: -100, taxRateBps: 0 }])).toThrow(DomainError)
    expect(() => computeTotals([{ quantity: 1, unitPriceMinor: 100, taxRateBps: -1 }])).toThrow(DomainError)
    expect(() => computeTotals([{ quantity: 1.5, unitPriceMinor: 100, taxRateBps: 0 }])).toThrow(DomainError)
    expect(() => computeTotals([{ quantity: 1, unitPriceMinor: 100.5, taxRateBps: 0 }])).toThrow(DomainError)
    expect(() => computeTotals([{ quantity: 0, unitPriceMinor: 100, taxRateBps: 0 }])).toThrow(DomainError)
    expect(() => computeTotals([{ quantity: 1, unitPriceMinor: 100, taxRateBps: 10001 }])).toThrow(DomainError)
  })

  it('accepts the largest allowed invoice and rejects anything above it', () => {
    expect(computeTotals([{ quantity: 1000, unitPriceMinor: 1_000_000_000, taxRateBps: 0 }]).totalMinor).toBe(MAX_INVOICE_MINOR)
    expect(() => computeTotals([{ quantity: 1001, unitPriceMinor: 1_000_000_000, taxRateBps: 0 }])).toThrow(DomainError)
  })

  it('does not lose precision on large amounts', () => {
    // net x rate is about 1e15, past what a float multiplies exactly. BigInt keeps it exact.
    const totals = computeTotals([{ quantity: 300_000, unitPriceMinor: 1_000_001, taxRateBps: 3333 }])
    expect(totals.subtotalMinor).toBe(300_000_300_000)
    expect(totals.taxMinor).toBe(Number((300_000_300_000n * 3333n + 5000n) / 10000n))
    expect(totals.totalMinor).toBe(totals.subtotalMinor + totals.taxMinor)
  })
})

describe('lineNetMinor', () => {
  it('multiplies quantity by unit price', () => {
    expect(lineNetMinor({ quantity: 4, unitPriceMinor: 2500 })).toBe(10000)
    expect(lineNetMinor({ quantity: 4, unitPriceMinor: 0 })).toBe(0)
  })
})
