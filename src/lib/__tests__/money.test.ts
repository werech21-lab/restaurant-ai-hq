import { describe, expect, it } from 'vitest'
import {
  addMoney,
  bpsToInput,
  CurrencyMismatchError,
  minorToInput,
  formatMinor,
  money,
  parseKwdToMinor,
  parseWholeNumber,
  parsePercentToBps,
  subtractMoney,
  type Money,
} from '@/lib/money'

const usd = { amountMinor: 100, currency: 'USD' } as unknown as Money

describe('money arithmetic', () => {
  it('adds and subtracts in minor units', () => {
    expect(addMoney(money(1500), money(250))).toEqual({ amountMinor: 1750, currency: 'KWD' })
    expect(subtractMoney(money(1500), money(250))).toEqual({ amountMinor: 1250, currency: 'KWD' })
  })

  it('handles zero and negative results', () => {
    expect(addMoney(money(0), money(0)).amountMinor).toBe(0)
    expect(subtractMoney(money(100), money(250)).amountMinor).toBe(-150)
  })

  it('rejects a currency mismatch', () => {
    expect(() => addMoney(money(1), usd)).toThrow(CurrencyMismatchError)
    expect(() => subtractMoney(money(1), usd)).toThrow(CurrencyMismatchError)
  })

  it('rejects non-integer and unsafe amounts', () => {
    expect(() => money(1.5)).toThrow(RangeError)
    expect(() => money(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError)
    expect(() => money(Number.NaN)).toThrow(RangeError)
  })
})

describe('formatMinor', () => {
  it('always shows three decimals', () => {
    expect(formatMinor(0)).toBe('0.000')
    expect(formatMinor(5)).toBe('0.005')
    expect(formatMinor(1500)).toBe('1.500')
    expect(formatMinor(1234567)).toBe('1,234.567')
  })

  it('formats negatives', () => {
    expect(formatMinor(-1500)).toBe('-1.500')
    expect(formatMinor(-5)).toBe('-0.005')
  })
})

describe('form input formatters', () => {
  it('round-trips amounts and percentages', () => {
    expect(minorToInput(0)).toBe('0.000')
    expect(minorToInput(12500)).toBe('12.500')
    expect(minorToInput(1_000_000_000)).toBe('1000000.000')
    expect(parseKwdToMinor(minorToInput(1234567))).toBe(1234567)
    expect(bpsToInput(0)).toBe('0.00')
    expect(bpsToInput(1500)).toBe('15.00')
    expect(bpsToInput(333)).toBe('3.33')
    expect(parsePercentToBps(bpsToInput(10000))).toBe(10000)
  })

  it('rejects negative and non-integer values', () => {
    expect(() => minorToInput(-1)).toThrow(RangeError)
    expect(() => minorToInput(1.5)).toThrow(RangeError)
    expect(() => bpsToInput(-1)).toThrow(RangeError)
  })
})

describe('parseKwdToMinor', () => {
  it('parses whole and fractional amounts', () => {
    expect(parseKwdToMinor('12')).toBe(12000)
    expect(parseKwdToMinor('12.5')).toBe(12500)
    expect(parseKwdToMinor('12.505')).toBe(12505)
    expect(parseKwdToMinor('0')).toBe(0)
    expect(parseKwdToMinor('1,234.500')).toBe(1234500)
  })

  it('accepts Arabic-Indic digits', () => {
    expect(parseKwdToMinor('١٢٫٥')).toBe(12500)
  })

  it('rejects invalid input', () => {
    expect(parseKwdToMinor('')).toBeNull()
    expect(parseKwdToMinor('-5')).toBeNull()
    expect(parseKwdToMinor('1.2345')).toBeNull()
    expect(parseKwdToMinor('abc')).toBeNull()
  })
})

describe('parsePercentToBps', () => {
  it('parses percentages to basis points', () => {
    expect(parsePercentToBps('15')).toBe(1500)
    expect(parsePercentToBps('7.5')).toBe(750)
    expect(parsePercentToBps('0')).toBe(0)
    expect(parsePercentToBps('100')).toBe(10000)
  })

  it('rejects out of range and malformed values', () => {
    expect(parsePercentToBps('100.01')).toBeNull()
    expect(parsePercentToBps('101')).toBeNull()
    expect(parsePercentToBps('-1')).toBeNull()
    expect(parsePercentToBps('1.234')).toBeNull()
  })
})

describe('parseWholeNumber', () => {
  it('reads whole numbers, including Arabic-Indic digits and grouping', () => {
    expect(parseWholeNumber('0')).toBe(0)
    expect(parseWholeNumber('25')).toBe(25)
    expect(parseWholeNumber(' 1,000 ')).toBe(1000)
    expect(parseWholeNumber('٣٠')).toBe(30)
  })

  it('rejects decimals, signs, text, empty input and oversized numbers', () => {
    for (const input of ['', '1.5', '-1', '+1', 'abc', '1e3', '1234567890']) {
      expect(parseWholeNumber(input)).toBeNull()
    }
  })
})
