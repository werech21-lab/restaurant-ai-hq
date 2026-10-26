export type Currency = 'KWD'

/** Money is integer minor units (fils for KWD) plus a currency code. Never a float. */
export type Money = { amountMinor: number; currency: Currency }

export const MINOR_PER_UNIT = 1000

export class CurrencyMismatchError extends Error {
  constructor(left: string, right: string) {
    super(`Currency mismatch: ${left} and ${right}`)
    this.name = 'CurrencyMismatchError'
  }
}

export function money(amountMinor: number, currency: Currency = 'KWD'): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError('amountMinor must be a safe integer')
  }
  return { amountMinor, currency }
}

function assertSameCurrency(left: Money, right: Money) {
  if (left.currency !== right.currency) {
    throw new CurrencyMismatchError(left.currency, right.currency)
  }
}

export function addMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right)
  return money(left.amountMinor + right.amountMinor, left.currency)
}

export function subtractMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right)
  return money(left.amountMinor - right.amountMinor, left.currency)
}

/** Formats integer fils as a three-decimal string such as 1,234.500. */
export function formatMinor(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError('amountMinor must be a safe integer')
  }
  const negative = amountMinor < 0
  const abs = Math.abs(amountMinor)
  const fraction = abs % MINOR_PER_UNIT
  const whole = (abs - fraction) / MINOR_PER_UNIT
  const sign = negative ? '-' : ''
  return `${sign}${whole.toLocaleString('en-US')}.${String(fraction).padStart(3, '0')}`
}

/** Formats integer fils as a plain decimal for form inputs (no grouping): 12500 becomes 12.500. */
export function minorToInput(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError('amountMinor must be a non-negative safe integer')
  }
  return `${Math.floor(amountMinor / MINOR_PER_UNIT)}.${String(amountMinor % MINOR_PER_UNIT).padStart(3, '0')}`
}

/** Formats basis points as a percentage for form inputs: 1500 becomes 15.00. */
export function bpsToInput(bps: number): string {
  if (!Number.isSafeInteger(bps) || bps < 0) {
    throw new RangeError('bps must be a non-negative safe integer')
  }
  return `${Math.floor(bps / 100)}.${String(bps % 100).padStart(2, '0')}`
}

function normalizeDigits(input: string): string {
  return input
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/\u066B/g, '.')
    .replace(/[,\u066C\s]/g, '')
}

/** Parses a KWD amount typed by a person (up to three decimals) into integer fils. Returns null when invalid. */
export function parseKwdToMinor(input: string): number | null {
  const match = /^(\d{1,12})(?:\.(\d{1,3}))?$/.exec(normalizeDigits(input.trim()))
  if (!match) return null
  const whole = Number(match[1])
  const fraction = Number((match[2] ?? '').padEnd(3, '0'))
  return whole * MINOR_PER_UNIT + fraction
}

/** Parses a whole number typed by a person (Arabic-Indic digits and grouping accepted). Decimals and signs return null. */
export function parseWholeNumber(input: string): number | null {
  const match = /^\d{1,9}$/.exec(normalizeDigits(input.trim()))
  return match ? Number(match[0]) : null
}

/** Parses a percentage typed by a person (up to two decimals, 0 to 100) into basis points. Returns null when invalid. */
export function parsePercentToBps(input: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(normalizeDigits(input.trim()))
  if (!match) return null
  const bps = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return bps > 10000 ? null : bps
}
