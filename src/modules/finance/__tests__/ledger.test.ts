import { describe, expect, it } from 'vitest'
import { CurrencyMismatchError } from '@/lib/money'
import {
  assertKwd,
  assertPostable,
  isDateInPeriod,
  MAX_LINE_MINOR,
  netColumns,
  periodsOverlap,
  reverseLines,
  sumLines,
  toSafeMinor,
} from '@/modules/finance/domain/ledger'
import {
  createAccountSchema,
  createJournalEntrySchema,
  createPeriodSchema,
  journalLineSchema,
  reverseJournalEntrySchema,
  trialBalanceQuerySchema,
} from '@/modules/finance/schemas/ledger'

const id = '3f9d6c1e-8a2b-4d57-9a41-0c5e7b2f1a10'
const other = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

function codeOf(fn: () => unknown): string {
  try {
    fn()
    return 'ok'
  } catch (error) {
    return (error as { code?: string; name?: string }).code ?? (error as Error).name
  }
}

describe('assertPostable', () => {
  it('accepts a balanced entry and returns its total', () => {
    expect(assertPostable([{ debitMinor: 12_500, creditMinor: 0 }, { debitMinor: 0, creditMinor: 12_500 }])).toEqual({ totalMinor: 12_500 })
  })

  it('accepts several lines on each side when the totals match', () => {
    const lines = [
      { debitMinor: 333, creditMinor: 0 },
      { debitMinor: 334, creditMinor: 0 },
      { debitMinor: 0, creditMinor: 667 },
    ]
    expect(assertPostable(lines).totalMinor).toBe(667)
  })

  it('refuses an unbalanced entry by one fils', () => {
    expect(codeOf(() => assertPostable([{ debitMinor: 1000, creditMinor: 0 }, { debitMinor: 0, creditMinor: 999 }]))).toBe('unbalanced_entry')
  })

  it('refuses fewer than two lines', () => {
    expect(codeOf(() => assertPostable([]))).toBe('entry_too_short')
    expect(codeOf(() => assertPostable([{ debitMinor: 5, creditMinor: 0 }]))).toBe('entry_too_short')
  })

  it('refuses a zero line, a line on both sides and a line on neither', () => {
    const good = { debitMinor: 0, creditMinor: 100 }
    expect(codeOf(() => assertPostable([{ debitMinor: 0, creditMinor: 0 }, good]))).toBe('invalid_line')
    expect(codeOf(() => assertPostable([{ debitMinor: 50, creditMinor: 50 }, good]))).toBe('invalid_line')
  })

  it('refuses negatives, fractions and amounts above the limit', () => {
    const good = { debitMinor: 100, creditMinor: 0 }
    expect(codeOf(() => assertPostable([{ debitMinor: -100, creditMinor: 0 }, { debitMinor: 0, creditMinor: -100 }]))).toBe('invalid_line')
    expect(codeOf(() => assertPostable([{ debitMinor: 0.5, creditMinor: 0 }, good]))).toBe('invalid_line')
    expect(codeOf(() => assertPostable([{ debitMinor: MAX_LINE_MINOR + 1, creditMinor: 0 }, good]))).toBe('invalid_line')
  })

  it('does not lose precision when many large lines are summed', () => {
    const lines = Array.from({ length: 20 }, () => ({ debitMinor: MAX_LINE_MINOR, creditMinor: 0 }))
    expect(sumLines(lines).debit).toBe(20n * BigInt(MAX_LINE_MINOR))
    expect(() => toSafeMinor(sumLines(lines).debit)).not.toThrow()
    expect(() => toSafeMinor(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError)
  })
})

describe('currency', () => {
  it('accepts KWD only', () => {
    expect(() => assertKwd('KWD')).not.toThrow()
    expect(() => assertKwd('USD')).toThrow(CurrencyMismatchError)
    expect(() => assertKwd('kwd')).toThrow(CurrencyMismatchError)
  })
})

describe('reverseLines', () => {
  it('swaps each side and keeps the account and text', () => {
    const lines = [
      { accountId: id, debitMinor: 700, creditMinor: 0, description: 'a' },
      { accountId: other, debitMinor: 0, creditMinor: 700, description: 'b' },
    ]
    expect(reverseLines(lines)).toEqual([
      { accountId: id, debitMinor: 0, creditMinor: 700, description: 'a' },
      { accountId: other, debitMinor: 700, creditMinor: 0, description: 'b' },
    ])
  })

  it('reversing twice gives back the original', () => {
    const lines = [
      { accountId: id, debitMinor: 1, creditMinor: 0, description: '' },
      { accountId: other, debitMinor: 0, creditMinor: 1, description: '' },
    ]
    expect(reverseLines(reverseLines(lines))).toEqual(lines)
  })
})

describe('netColumns', () => {
  it('puts the net in the larger side, and zero in both when they cancel', () => {
    expect(netColumns(1000n, 400n)).toEqual({ debit: 600n, credit: 0n })
    expect(netColumns(400n, 1000n)).toEqual({ debit: 0n, credit: 600n })
    expect(netColumns(500n, 500n)).toEqual({ debit: 0n, credit: 0n })
  })
})

describe('periods', () => {
  const period = { startsOn: '2026-01-01', endsOn: '2026-12-31' }

  it('includes both edge days', () => {
    expect(isDateInPeriod('2026-01-01', period)).toBe(true)
    expect(isDateInPeriod('2026-12-31', period)).toBe(true)
    expect(isDateInPeriod('2025-12-31', period)).toBe(false)
    expect(isDateInPeriod('2027-01-01', period)).toBe(false)
  })

  it('treats a shared day as an overlap and back-to-back periods as fine', () => {
    expect(periodsOverlap(period, { startsOn: '2026-12-31', endsOn: '2027-06-30' })).toBe(true)
    expect(periodsOverlap(period, { startsOn: '2027-01-01', endsOn: '2027-12-31' })).toBe(false)
    expect(periodsOverlap(period, { startsOn: '2026-03-01', endsOn: '2026-03-31' })).toBe(true)
  })
})

describe('schemas', () => {
  const line = (debitMinor: number, creditMinor: number) => ({ accountId: id, debitMinor, creditMinor })

  it('accepts a balanced shape, defaults the currency to KWD and upper-cases it', () => {
    const parsed = createJournalEntrySchema.parse({ entryDate: '2026-03-01', lines: [line(100, 0), { accountId: other, creditMinor: 100 }] })
    expect(parsed.currency).toBe('KWD')
    expect(createJournalEntrySchema.parse({ entryDate: '2026-03-01', currency: 'usd', lines: [line(1, 0), line(0, 1)] }).currency).toBe('USD')
  })

  it('rejects zero, negative, fractional and two-sided lines', () => {
    expect(journalLineSchema.safeParse(line(0, 0)).success).toBe(false)
    expect(journalLineSchema.safeParse(line(-5, 0)).success).toBe(false)
    expect(journalLineSchema.safeParse(line(1.5, 0)).success).toBe(false)
    expect(journalLineSchema.safeParse(line(5, 5)).success).toBe(false)
    expect(journalLineSchema.safeParse(line(MAX_LINE_MINOR + 1, 0)).success).toBe(false)
    expect(journalLineSchema.safeParse(line(MAX_LINE_MINOR, 0)).success).toBe(true)
  })

  it('needs at least two lines and a real calendar date', () => {
    expect(createJournalEntrySchema.safeParse({ entryDate: '2026-03-01', lines: [line(1, 0)] }).success).toBe(false)
    expect(createJournalEntrySchema.safeParse({ entryDate: '2026-02-30', lines: [line(1, 0), line(0, 1)] }).success).toBe(false)
    expect(createJournalEntrySchema.safeParse({ entryDate: '01/03/2026', lines: [line(1, 0), line(0, 1)] }).success).toBe(false)
  })

  it('checks account codes and period dates', () => {
    expect(createAccountSchema.parse({ code: 'ab-1', name: 'x', type: 'asset' }).code).toBe('AB-1')
    expect(createAccountSchema.safeParse({ code: 'a b', name: 'x', type: 'asset' }).success).toBe(false)
    expect(createAccountSchema.safeParse({ code: '1000', name: 'x', type: 'income' }).success).toBe(false)
    expect(createPeriodSchema.safeParse({ name: 'P', startsOn: '2026-02-01', endsOn: '2026-01-31' }).success).toBe(false)
    expect(createPeriodSchema.safeParse({ name: 'P', startsOn: '2026-01-31', endsOn: '2026-01-31' }).success).toBe(true)
  })

  it('needs an explicit date to reverse and an end date for the trial balance', () => {
    expect(reverseJournalEntrySchema.safeParse({ version: 2 }).success).toBe(false)
    expect(reverseJournalEntrySchema.safeParse({ version: 2, entryDate: '2026-04-01' }).success).toBe(true)
    expect(trialBalanceQuerySchema.safeParse({}).success).toBe(false)
  })
})
