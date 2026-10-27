import { describe, expect, it } from 'vitest'
import { createJournalEntrySchema } from '@/modules/finance/schemas/ledger'
import {
  draftFromJournalLine,
  draftTotals,
  emptyJournalLine,
  journalIssue,
  journalLinesPayload,
  type JournalLineDraft,
} from '@/modules/finance/ui/journal-draft'

const accountA = '11111111-1111-4111-8111-111111111111'
const accountB = '22222222-2222-4222-8222-222222222222'

function draft(patch: Partial<JournalLineDraft>): JournalLineDraft {
  return { ...emptyJournalLine(), ...patch }
}

describe('journal entry drafts in the ledger screens', () => {
  it('puts the typed amount on the side the line belongs to, in fils', () => {
    const lines = journalLinesPayload([
      draft({ accountId: accountA, side: 'debit', amount: '12.500', description: ' rent ' }),
      draft({ accountId: accountB, side: 'credit', amount: '12.5' }),
    ])
    expect(lines).toEqual([
      { accountId: accountA, debitMinor: 12_500, creditMinor: 0, description: 'rent' },
      { accountId: accountB, debitMinor: 0, creditMinor: 12_500, description: '' },
    ])
  })

  it('turns an amount that is not a number into NaN, which the schema refuses', () => {
    const lines = journalLinesPayload([draft({ accountId: accountA, side: 'debit', amount: '1.2.3' })])
    expect(Number.isNaN(lines[0].debitMinor)).toBe(true)
    const parsed = createJournalEntrySchema.safeParse({ entryDate: '2026-01-31', memo: '', currency: 'KWD', lines })
    expect(parsed.success).toBe(false)
  })

  it('accepts a balanced pair through the same schema the API uses', () => {
    const parsed = createJournalEntrySchema.safeParse({
      entryDate: '2026-01-31',
      memo: 'office rent',
      currency: 'KWD',
      lines: journalLinesPayload([
        draft({ accountId: accountA, side: 'debit', amount: '250.000' }),
        draft({ accountId: accountB, side: 'credit', amount: '250.000' }),
      ]),
    })
    expect(parsed.success).toBe(true)
  })

  it('reports the debit and credit totals of a balanced draft', () => {
    const totals = draftTotals([
      draft({ accountId: accountA, side: 'debit', amount: '100.250' }),
      draft({ accountId: accountB, side: 'credit', amount: '100.250' }),
    ])
    expect(totals).toEqual({ debitMinor: 100_250, creditMinor: 100_250, differenceMinor: 0, balanced: true })
  })

  it('reports the difference of a draft that does not balance, which stays allowed in a draft', () => {
    const totals = draftTotals([
      draft({ accountId: accountA, side: 'debit', amount: '100.000' }),
      draft({ accountId: accountB, side: 'credit', amount: '99.999' }),
    ])
    expect(totals).toEqual({ debitMinor: 100_000, creditMinor: 99_999, differenceMinor: 1, balanced: false })
  })

  it('has no totals while an amount is still not a number', () => {
    expect(draftTotals([draft({ accountId: accountA, side: 'debit', amount: '' })])).toBeNull()
  })

  it('reads a saved line back onto its own side', () => {
    const credit = draftFromJournalLine({
      id: 'line-1',
      lineNo: 1,
      accountId: accountB,
      accountCode: '4100',
      accountName: 'Sales',
      debitMinor: 0,
      creditMinor: 7_000,
      description: 'invoice 12',
    })
    expect(credit.side).toBe('credit')
    expect(credit.amount).toBe('7.000')
    expect(journalLinesPayload([credit])[0]).toEqual({ accountId: accountB, debitMinor: 0, creditMinor: 7_000, description: 'invoice 12' })
  })

  it('maps every schema path a journal form can fail on to one message', () => {
    expect(journalIssue(['entryDate'])).toBe('led.err.form.date')
    expect(journalIssue(['memo'])).toBe('led.err.form.memo')
    expect(journalIssue(['lines'])).toBe('led.err.form.lines')
    expect(journalIssue(['lines', 0, 'accountId'])).toBe('led.err.form.account')
    expect(journalIssue(['lines', 0, 'debitMinor'])).toBe('led.err.form.amount')
    expect(journalIssue(['lines', 1, 'creditMinor'])).toBe('led.err.form.amount')
    expect(journalIssue(['lines', 0, 'description'])).toBe('led.err.form.lineDescription')
    expect(journalIssue(['currency'])).toBe('led.err.form.generic')
  })
})
