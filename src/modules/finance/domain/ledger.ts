import { DomainError } from '@/lib/domain-error'
import { CurrencyMismatchError } from '@/lib/money'

/** Largest amount on one journal line, in fils (1,000,000,000.000 KWD). The database enforces the same limit. */
export const MAX_LINE_MINOR = 1_000_000_000_000

export type LineAmounts = { debitMinor: number; creditMinor: number }

function assertWholeAmount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_LINE_MINOR) {
    throw new DomainError('invalid_line', 'A line amount must be a whole number of fils between 0 and the limit.')
  }
}

/** Sums debits and credits as BigInt, so a long entry cannot lose precision. */
export function sumLines(lines: readonly LineAmounts[]): { debit: bigint; credit: bigint } {
  let debit = 0n
  let credit = 0n
  for (const line of lines) {
    debit += BigInt(line.debitMinor)
    credit += BigInt(line.creditMinor)
  }
  return { debit, credit }
}

/**
 * The rules an entry must meet to be posted: at least two lines, each on exactly one side and above zero, and equal
 * totals. The database checks the same things again when the entry is posted.
 */
export function assertPostable(lines: readonly LineAmounts[]): { totalMinor: number } {
  if (lines.length < 2) {
    throw new DomainError('entry_too_short', 'A journal entry needs at least two lines.')
  }
  for (const line of lines) {
    assertWholeAmount(line.debitMinor)
    assertWholeAmount(line.creditMinor)
    if ((line.debitMinor > 0) === (line.creditMinor > 0)) {
      throw new DomainError('invalid_line', 'Each line is either a debit or a credit above zero, never both and never zero.')
    }
  }
  const { debit, credit } = sumLines(lines)
  if (debit !== credit) {
    throw new DomainError('unbalanced_entry', `The entry is not balanced: debits ${debit} and credits ${credit} fils.`)
  }
  return { totalMinor: Number(debit) }
}

/** The ledger is KWD only. Any other currency is refused the same way finance refuses a payment. */
export function assertKwd(currency: string): void {
  if (currency !== 'KWD') throw new CurrencyMismatchError('KWD', currency)
}

type ReversibleLine = { accountId: string; debitMinor: number; creditMinor: number; description: string }

/** The lines of a reversing entry: every debit becomes a credit of the same amount on the same account, and the reverse. */
export function reverseLines<T extends ReversibleLine>(lines: readonly T[]): ReversibleLine[] {
  return lines.map((line) => ({
    accountId: line.accountId,
    debitMinor: line.creditMinor,
    creditMinor: line.debitMinor,
    description: line.description,
  }))
}

export type PeriodRange = { startsOn: string; endsOn: string }

/** Dates are YYYY-MM-DD, which sort correctly as text. */
export function isDateInPeriod(date: string, period: PeriodRange): boolean {
  return date >= period.startsOn && date <= period.endsOn
}

export function periodsOverlap(a: PeriodRange, b: PeriodRange): boolean {
  return a.startsOn <= b.endsOn && b.startsOn <= a.endsOn
}

/** Turns an account's debit and credit totals into one trial balance row: the net goes in the side that is larger. */
export function netColumns(debit: bigint, credit: bigint): { debit: bigint; credit: bigint } {
  const net = debit - credit
  return net >= 0n ? { debit: net, credit: 0n } : { debit: 0n, credit: -net }
}

export function toSafeMinor(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('The total is too large to represent.')
  }
  return Number(value)
}
