import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_TYPE_LABEL,
  KUWAIT_TIMEZONE,
  MOVEMENT_LABEL,
  STATUS_LABEL,
  UNAVAILABLE_DASH,
  dayRange,
  formatDate,
  formatDateTime,
  formatInt,
  formatKuwaitDate,
  formatKuwaitDateTime,
  formatKwd,
  formatKwdAmount,
  formatMoney,
  formatMonth,
  formatPct,
  formatQty,
  getUnavailableTooltip,
  monthRange,
  movementTypeFromQuery,
  paymentStatus,
  round2,
  round3,
  statusTone,
} from '@/lib/format'
import * as formatKwdBarrel from '@/lib/format-kwd'

describe('canonical formatters (@/lib/format)', () => {
  describe('UNAVAILABLE_DASH & getUnavailableTooltip', () => {
    it('exports em-dash constant and bilingual unavailable tooltip', () => {
      expect(UNAVAILABLE_DASH).toBe('—')
      expect(KUWAIT_TIMEZONE).toBe('Asia/Kuwait')
      expect(getUnavailableTooltip('ar')).toBe('غير متاح')
      expect(getUnavailableTooltip('en')).toBe('Unavailable')
      expect(getUnavailableTooltip()).toBe('Unavailable')
      expect(getUnavailableTooltip(undefined)).toBe('Unavailable')
    })
  })

  describe('formatKwd', () => {
    it('returns em-dash for null, undefined, NaN, Infinity, and -Infinity (never 0 or 0.000)', () => {
      const invalidValues: Array<number | null | undefined> = [
        null,
        undefined,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
      ]
      for (const val of invalidValues) {
        expect(formatKwd(val)).toBe('—')
        expect(formatKwd(val, 'en')).toBe('—')
        expect(formatKwd(val, 'ar')).toBe('—')
        expect(formatKwd(val, { locale: 'ar', showUnit: false, signed: true })).toBe('—')
      }
    })

    it('formats zero, -0, and sub-fils values rounding to -0 as positive 0.000', () => {
      expect(formatKwd(0)).toBe('0.000 KWD')
      expect(formatKwd(0, 'en')).toBe('0.000 KWD')
      expect(formatKwd(0, 'ar')).toBe('0.000 د.ك')
      expect(formatKwd(-0)).toBe('0.000 KWD')
      expect(formatKwd(-0, 'ar')).toBe('0.000 د.ك')
      expect(formatKwd(-0.0001)).toBe('0.000 KWD')
      expect(formatKwd(-0.0004, 'ar')).toBe('0.000 د.ك')
      expect(formatKwd(0, { signed: true })).toBe('0.000 KWD')
      expect(formatKwd(-0, { signed: true })).toBe('0.000 KWD')
      expect(formatKwd(0.0001, { signed: true })).toBe('0.000 KWD')
    })

    it('formats exact 3-decimal Kuwaiti fils precision, negatives, rounding, and large grouped numbers', () => {
      expect(formatKwd(-20)).toBe('-20.000 KWD')
      expect(formatKwd(-20, 'ar')).toBe('-20.000 د.ك')
      expect(formatKwd(-0.005)).toBe('-0.005 KWD')
      expect(formatKwd(-0.005, 'ar')).toBe('-0.005 د.ك')
      expect(formatKwd(12.3456)).toBe('12.346 KWD')
      expect(formatKwd(12.3456, 'ar')).toBe('12.346 د.ك')
      expect(formatKwd(35.05)).toBe('35.050 KWD')
      expect(formatKwd(18.95)).toBe('18.950 KWD')
      expect(formatKwd(200.05)).toBe('200.050 KWD')
      expect(formatKwd(1234.5)).toBe('1,234.500 KWD')
      expect(formatKwd(1234.5, 'ar')).toBe('1,234.500 د.ك')
      expect(formatKwd(1234567.89)).toBe('1,234,567.890 KWD')
      expect(formatKwd(1234567.89, 'ar')).toBe('1,234,567.890 د.ك')
    })

    it('supports showUnit: false, signed: true, and custom decimals', () => {
      expect(formatKwd(1234.5, { showUnit: false })).toBe('1,234.500')
      expect(formatKwd(-20, { locale: 'ar', showUnit: false })).toBe('-20.000')
      expect(formatKwd(0, { showUnit: false })).toBe('0.000')
      expect(formatKwd(1234.5, { signed: true })).toBe('+1,234.500 KWD')
      expect(formatKwd(1234.5, { locale: 'ar', signed: true })).toBe('+1,234.500 د.ك')
      expect(formatKwd(1234.5, { signed: true, showUnit: false })).toBe('+1,234.500')
      expect(formatKwd(-20, { signed: true })).toBe('-20.000 KWD')
      expect(formatKwd(1234.56, { decimals: 2 })).toBe('1,234.56 KWD')
      expect(formatKwd(1234.56, { decimals: 0, locale: 'ar' })).toBe('1,235 د.ك')
    })
  })

  describe('format-kwd barrel backwards-compatibility', () => {
    it('delegates formatKwdAmount and re-exports canonical KWD helpers cleanly', () => {
      expect(formatKwdBarrel.formatKwdAmount).toBe(formatKwdAmount)
      expect(formatKwdBarrel.formatKwd).toBe(formatKwd)
      expect(formatKwdBarrel.UNAVAILABLE_DASH).toBe('—')
      expect(formatKwdBarrel.getUnavailableTooltip('ar')).toBe('غير متاح')
      expect(formatKwdAmount(35.05)).toBe('35.050')
      expect(formatKwdAmount(18.95)).toBe('18.950')
      expect(formatKwdAmount(200.05)).toBe('200.050')
      expect(formatKwdAmount(-0)).toBe('0.000')
      expect(formatKwdAmount(Number.NaN)).toBe('0.000')
    })
  })

  describe('formatInt', () => {
    it('returns em-dash for null, undefined, NaN, Infinity, and -Infinity', () => {
      expect(formatInt(null)).toBe('—')
      expect(formatInt(undefined)).toBe('—')
      expect(formatInt(Number.NaN)).toBe('—')
      expect(formatInt(Number.POSITIVE_INFINITY)).toBe('—')
      expect(formatInt(Number.NEGATIVE_INFINITY)).toBe('—')
    })

    it('formats rounded integers with grouping, -0 normalization, and signed option', () => {
      expect(formatInt(0)).toBe('0')
      expect(formatInt(-0)).toBe('0')
      expect(formatInt(-0.4)).toBe('0')
      expect(formatInt(-15)).toBe('-15')
      expect(formatInt(-12500.6)).toBe('-12,501')
      expect(formatInt(12500)).toBe('12,500')
      expect(formatInt(12500, 'ar')).toBe('12,500')
      expect(formatInt(12500, 'en')).toBe('12,500')
      expect(formatInt(12500, { signed: true })).toBe('+12,500')
      expect(formatInt(-15, { signed: true })).toBe('-15')
      expect(formatInt(0, { signed: true })).toBe('0')
      expect(formatInt(0.3, { signed: true })).toBe('0')
    })
  })

  describe('formatPct', () => {
    it('returns em-dash for null, undefined, NaN, Infinity, and -Infinity', () => {
      expect(formatPct(null)).toBe('—')
      expect(formatPct(undefined)).toBe('—')
      expect(formatPct(Number.NaN)).toBe('—')
      expect(formatPct(Number.POSITIVE_INFINITY)).toBe('—')
      expect(formatPct(Number.NEGATIVE_INFINITY)).toBe('—')
    })

    it('formats 1-decimal percentages by default with -0 normalization, signed, and decimals options', () => {
      expect(formatPct(0)).toBe('0.0%')
      expect(formatPct(-0)).toBe('0.0%')
      expect(formatPct(-0.04)).toBe('0.0%')
      expect(formatPct(3.34)).toBe('3.3%')
      expect(formatPct(3.34, 'ar')).toBe('3.3%')
      expect(formatPct(-4.2)).toBe('-4.2%')
      expect(formatPct(3.34, { signed: true })).toBe('+3.3%')
      expect(formatPct(-4.2, { signed: true })).toBe('-4.2%')
      expect(formatPct(0.04, { signed: true })).toBe('0.0%')
      expect(formatPct(12.345, { decimals: 2 })).toBe('12.35%')
      expect(formatPct(100, { decimals: 0 })).toBe('100%')
    })
  })

  describe('formatDate / formatKuwaitDate & formatDateTime / formatKuwaitDateTime', () => {
    it('returns em-dash for null, undefined, empty strings, non-finite numbers, and invalid dates', () => {
      expect(formatKuwaitDate).toBe(formatDate)
      expect(formatKuwaitDateTime).toBe(formatDateTime)

      const badInputs: Array<Date | string | number | null | undefined> = [
        null,
        undefined,
        '',
        '   ',
        'not-a-date',
        '2026-02-31',
        '2026-02-31T10:00:00.000Z',
        new Date('invalid'),
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
      ]
      for (const bad of badInputs) {
        expect(formatDate(bad)).toBe('—')
        expect(formatKuwaitDate(bad, 'ar')).toBe('—')
        expect(formatDateTime(bad)).toBe('—')
        expect(formatKuwaitDateTime(bad, 'en')).toBe('—')
      }
    })

    it('always formats in Asia/Kuwait (UTC+3) across midnight and year rollover boundaries', () => {
      // 2026-11-15T21:30:00.000Z = 2026-11-16 00:30 in Asia/Kuwait (never 2026-11-15 UTC!)
      const utcBoundaryIso = '2026-11-15T21:30:00.000Z'
      expect(formatDate(utcBoundaryIso)).toBe('2026-11-16')
      expect(formatKuwaitDate(utcBoundaryIso, 'en')).toBe('2026-11-16')
      expect(formatKuwaitDate(utcBoundaryIso, 'ar')).toBe('2026-11-16')
      expect(formatDateTime(utcBoundaryIso)).toBe('2026-11-16 00:30')
      expect(formatKuwaitDateTime(utcBoundaryIso, 'en')).toBe('2026-11-16 00:30')
      expect(formatKuwaitDateTime(utcBoundaryIso, 'ar')).toBe('2026-11-16 00:30')

      // 1 second before Kuwait midnight: 2026-11-15T20:59:59.000Z = 2026-11-15 23:59 KWT
      expect(formatDate('2026-11-15T20:59:59.000Z')).toBe('2026-11-15')
      expect(formatDateTime('2026-11-15T20:59:59.000Z')).toBe('2026-11-15 23:59')

      // Exact Kuwait midnight: 2026-11-15T21:00:00.000Z = 2026-11-16 00:00 KWT (never 24:00)
      expect(formatDate('2026-11-15T21:00:00.000Z')).toBe('2026-11-16')
      expect(formatDateTime('2026-11-15T21:00:00.000Z')).toBe('2026-11-16 00:00')

      // Year rollover: 2026-12-31T21:15:00.000Z = 2027-01-01 00:15 KWT
      expect(formatDate('2026-12-31T21:15:00.000Z')).toBe('2027-01-01')
      expect(formatDateTime('2026-12-31T21:15:00.000Z')).toBe('2027-01-01 00:15')

      // Odoo space-separated UTC string ("YYYY-MM-DD HH:mm:ss")
      expect(formatDate('2026-11-15 21:30:00')).toBe('2026-11-16')
      expect(formatDateTime('2026-11-15 21:30:00')).toBe('2026-11-16 00:30')

      // Explicit +03:00 offset, Date object, date-only string, and numeric epoch 0
      expect(formatDateTime('2026-11-16T00:30:00+03:00')).toBe('2026-11-16 00:30')
      expect(formatDate(new Date('2026-11-15T21:30:00.000Z'))).toBe('2026-11-16')
      expect(formatDate('2026-11-16')).toBe('2026-11-16')
      expect(formatDateTime('2026-11-16')).toBe('2026-11-16 00:00')
      expect(formatDateTime(0)).toBe('1970-01-01 03:00')
    })

    it('supports medium localized labels, seconds, and UTC+3 zone suffix cleanly across en & ar', () => {
      const iso = '2026-11-15T21:30:45.000Z'
      expect(formatDate(iso, { locale: 'en', style: 'medium' })).toBe('Nov 16, 2026')
      expect(formatDate(iso, { locale: 'ar', style: 'medium' })).toBe('16 نوفمبر 2026')
      expect(formatDateTime(iso, { locale: 'en', style: 'medium', showZone: true })).toBe(
        'Nov 16, 2026 00:30 UTC+3',
      )
      expect(formatDateTime(iso, { locale: 'ar', style: 'medium', showZone: true })).toBe(
        '16 نوفمبر 2026، 00:30 UTC+3',
      )
      expect(formatDateTime(iso, { includeSeconds: true, showZone: true })).toBe(
        '2026-11-16 00:30:45 UTC+3',
      )
    })
  })

  describe('legacy ERP exports backwards-compatibility', () => {
    it('preserves round2, round3, formatMoney, formatQty, formatMonth, ranges, and status helpers', () => {
      expect(round2(10.555)).toBe(10.56)
      expect(round3(10.5555)).toBe(10.556)
      expect(formatMoney(1234.5)).toBe('1,234.500 د.ك')
      expect(formatMoney(1234.5, 'en')).toBe('KWD 1,234.500')
      expect(formatMoney(-20, 'ar')).toBe('-20.000 د.ك')
      expect(formatQty(5)).toBe('5')
      expect(formatQty(5.25)).toBe('5.25')
      expect(formatMonth(new Date(2026, 10, 16))).toBe('نوفمبر 2026')
      expect(monthRange(new Date(2026, 10, 16)).start.getDate()).toBe(1)
      expect(dayRange(new Date(2026, 10, 16)).start.getDate()).toBe(16)
      expect(paymentStatus(100, 100)).toBe('PAID')
      expect(paymentStatus(100, 50)).toBe('PARTIAL')
      expect(paymentStatus(100, 0)).toBe('UNPAID')
      expect(movementTypeFromQuery('وارد')).toBe('IN')
      expect(statusTone('PAID')).toContain('emerald')
      expect(ACCOUNT_TYPE_LABEL.REVENUE).toBe('إيرادات')
      expect(STATUS_LABEL.PAID).toBe('مدفوعة')
      expect(MOVEMENT_LABEL.IN).toBe('وارد')
    })
  })
})
