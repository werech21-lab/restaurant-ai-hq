import type { MessageKey } from '@/lib/i18n'
import { minorToInput, parseKwdToMinor } from '@/lib/money'
import { sumLines, type JournalLine, type JournalLineInput } from '@/modules/finance/client'

/** A journal line is either a debit or a credit, so the editor keeps one amount and the side it belongs to. */
export type LineSide = 'debit' | 'credit'

export type JournalLineDraft = {
  key: string
  accountId: string
  side: LineSide
  /** The amount in KWD exactly as typed. */
  amount: string
  description: string
}

let lineCounter = 0

export function emptyJournalLine(side: LineSide = 'debit'): JournalLineDraft {
  lineCounter += 1
  return { key: `jl-${lineCounter}`, accountId: '', side, amount: '', description: '' }
}

export function draftFromJournalLine(line: JournalLine): JournalLineDraft {
  const side: LineSide = line.creditMinor > 0 ? 'credit' : 'debit'
  return {
    ...emptyJournalLine(side),
    accountId: line.accountId,
    amount: minorToInput(side === 'credit' ? line.creditMinor : line.debitMinor),
    description: line.description,
  }
}

/** The lines as the API takes them. An amount that is not a number becomes NaN, which the Zod schema refuses. */
export function journalLinesPayload(drafts: readonly JournalLineDraft[]): JournalLineInput[] {
  return drafts.map((draft) => {
    const amountMinor = parseKwdToMinor(draft.amount) ?? Number.NaN
    return {
      accountId: draft.accountId,
      debitMinor: draft.side === 'debit' ? amountMinor : 0,
      creditMinor: draft.side === 'credit' ? amountMinor : 0,
      description: draft.description.trim(),
    }
  })
}

export type DraftTotals = { debitMinor: number; creditMinor: number; differenceMinor: number; balanced: boolean }

/**
 * The debit and credit totals of the typed lines, or null while an amount is not a number yet or the sum is too large to
 * show. A draft may be unbalanced: this only tells the user where the entry stands, posting is what enforces the balance.
 */
export function draftTotals(drafts: readonly JournalLineDraft[]): DraftTotals | null {
  const lines = journalLinesPayload(drafts)
  if (lines.some((line) => !Number.isSafeInteger(line.debitMinor) || !Number.isSafeInteger(line.creditMinor))) return null
  const { debit, credit } = sumLines(lines)
  const limit = BigInt(Number.MAX_SAFE_INTEGER)
  if (debit > limit || credit > limit) return null
  const debitMinor = Number(debit)
  const creditMinor = Number(credit)
  return { debitMinor, creditMinor, differenceMinor: debitMinor - creditMinor, balanced: debitMinor === creditMinor }
}

/** The one message a failed schema path maps to. */
export function journalIssue(path: ReadonlyArray<PropertyKey>): MessageKey {
  const [root, , field] = path
  if (root === 'entryDate') return 'led.err.form.date'
  if (root === 'memo') return 'led.err.form.memo'
  if (root === 'lines' && path.length === 1) return 'led.err.form.lines'
  if (root === 'lines' && field === 'accountId') return 'led.err.form.account'
  if (root === 'lines' && (field === 'debitMinor' || field === 'creditMinor')) return 'led.err.form.amount'
  if (root === 'lines' && field === 'description') return 'led.err.form.lineDescription'
  return 'led.err.form.generic'
}
