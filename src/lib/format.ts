export const KUWAIT_TIMEZONE = 'Asia/Kuwait' as const

export const UNAVAILABLE_DASH = '—' as const

export type FormatLocale = 'ar' | 'en'

export interface FormatKwdOptions {
  locale?: FormatLocale
  showUnit?: boolean
  signed?: boolean
  decimals?: number
}

export interface FormatIntOptions {
  locale?: FormatLocale
  signed?: boolean
}

export interface FormatPctOptions {
  locale?: FormatLocale
  decimals?: number
  signed?: boolean
}

export interface FormatDateOptions {
  locale?: FormatLocale
  style?: 'iso' | 'medium'
}

export interface FormatDateTimeOptions {
  locale?: FormatLocale
  style?: 'iso' | 'medium'
  includeSeconds?: boolean
  showZone?: boolean
}

const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000

const EN_SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

const AR_MONTH_NAMES = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const

const GROUPED_FORMATTERS = new Map<number, Intl.NumberFormat>()

function getGroupedFormatter(decimals: number): Intl.NumberFormat {
  let formatter = GROUPED_FORMATTERS.get(decimals)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true,
    })
    GROUPED_FORMATTERS.set(decimals, formatter)
  }
  return formatter
}

function normalizeDecimals(decimals: number | undefined, fallback: number): number {
  if (decimals === undefined) return fallback
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 20) return fallback
  return decimals
}

function formatSignedMagnitude(value: number, decimals: number, signed: boolean): string {
  const absFormatted = getGroupedFormatter(decimals).format(Math.abs(value))
  // Normalize -0 (Object.is(rounded, -0)) and values rounding to 0 so '-0.000' / '+0.000' never appear.
  const isRoundedZero = !/[1-9]/.test(absFormatted)
  if (isRoundedZero) {
    return absFormatted
  }
  const prefix = value < 0 ? '-' : signed ? '+' : ''
  return `${prefix}${absFormatted}`
}

export function getUnavailableTooltip(locale?: FormatLocale): string {
  return locale === 'ar' ? 'غير متاح' : 'Unavailable'
}

/**
 * Canonical Kuwaiti Dinar formatter:
 * - Returns '—' for null, undefined, NaN, or non-finite numbers (never '0' or '0.000').
 * - Formats to exact 3 decimal places (fils precision) by default with ASCII digits and grouping.
 * - Appends 'KWD' ('en', default) or 'د.ك' ('ar') unless showUnit === false.
 * - Normalizes -0 to 0.000 and prefixes '+' when signed === true and rounded > 0.
 */
export function formatKwd(
  value: number | null | undefined,
  localeOrOpts?: FormatLocale | FormatKwdOptions,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return UNAVAILABLE_DASH
  }

  const opts: FormatKwdOptions =
    typeof localeOrOpts === 'string' ? { locale: localeOrOpts } : (localeOrOpts ?? {})
  const locale: FormatLocale = opts.locale === 'ar' ? 'ar' : 'en'
  const showUnit = opts.showUnit ?? true
  const signed = opts.signed ?? false
  const decimals = normalizeDecimals(opts.decimals, 3)

  const magnitude = formatSignedMagnitude(value, decimals, signed)
  if (!showUnit) {
    return magnitude
  }

  const unit = locale === 'ar' ? 'د.ك' : 'KWD'
  return `${magnitude} ${unit}`
}

/**
 * Backwards-compatible numeric-only 3-decimal KWD formatter (used via `@/lib/format-kwd`).
 * Coerces non-finite values to 0.000 to preserve legacy non-nullable caller behavior.
 */
export function formatKwdAmount(value: number): string {
  const safe = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return formatSignedMagnitude(safe, 3, false)
}

/**
 * Canonical integer formatter:
 * - Returns '—' for null, undefined, NaN, or non-finite numbers.
 * - Rounds to nearest integer with comma grouping and '+' prefix when signed && rounded > 0.
 */
export function formatInt(
  value: number | null | undefined,
  localeOrOpts?: FormatLocale | FormatIntOptions,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return UNAVAILABLE_DASH
  }

  const opts: FormatIntOptions =
    typeof localeOrOpts === 'string' ? { locale: localeOrOpts } : (localeOrOpts ?? {})
  const signed = opts.signed ?? false

  return formatSignedMagnitude(value, 0, signed)
}

/**
 * Canonical percentage formatter:
 * - Returns '—' for null, undefined, NaN, or non-finite numbers.
 * - Formats percentage points to 1 decimal by default (e.g. 3.34 -> '3.3%', -4.2 -> '-4.2%').
 */
export function formatPct(
  value: number | null | undefined,
  localeOrOpts?: FormatLocale | FormatPctOptions,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return UNAVAILABLE_DASH
  }

  const opts: FormatPctOptions =
    typeof localeOrOpts === 'string' ? { locale: localeOrOpts } : (localeOrOpts ?? {})
  const decimals = normalizeDecimals(opts.decimals, 1)
  const signed = opts.signed ?? false

  const magnitude = formatSignedMagnitude(value, decimals, signed)
  return `${magnitude}%`
}

interface KuwaitDateTimeParts {
  year: number
  month: number
  day: number
  yyyy: string
  mm: string
  dd: string
  hh: string
  min: string
  sec: string
}

const KUWAIT_PARTS_FORMATTER = (() => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: KUWAIT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
  } catch {
    return null
  }
})()

function isValidCalendarYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const probe = new Date(Date.UTC(year, month - 1, day))
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() + 1 === month &&
    probe.getUTCDate() === day
  )
}

function parseDateInput(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const fromEpoch = new Date(value)
    return Number.isNaN(fromEpoch.getTime()) ? null : fromEpoch
  }

  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null

  // Pure YYYY-MM-DD calendar date: anchor at Asia/Kuwait midnight (UTC+3).
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (dateOnlyMatch) {
    const y = Number(dateOnlyMatch[1])
    const m = Number(dateOnlyMatch[2])
    const d = Number(dateOnlyMatch[3])
    if (!isValidCalendarYmd(y, m, d)) return null
    const parsed = new Date(`${trimmed}T00:00:00+03:00`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  // Space-separated naive Odoo UTC timestamp ("YYYY-MM-DD HH:mm[:ss]"): interpret as UTC.
  const odooUtcMatch = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,6}))?$/.exec(
    trimmed,
  )
  if (odooUtcMatch) {
    const y = Number(odooUtcMatch[1])
    const m = Number(odooUtcMatch[2])
    const d = Number(odooUtcMatch[3])
    if (!isValidCalendarYmd(y, m, d)) return null
    const sec = odooUtcMatch[6] ?? '00'
    const ms = (odooUtcMatch[7] ?? '000').slice(0, 3).padEnd(3, '0')
    const isoUtc = `${odooUtcMatch[1]}-${odooUtcMatch[2]}-${odooUtcMatch[3]}T${odooUtcMatch[4]}:${odooUtcMatch[5]}:${sec}.${ms}Z`
    const parsed = new Date(isoUtc)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  // Validate leading YYYY-MM-DD on ISO timestamps so overflow dates never roll over silently.
  const leadingYmd = /^(\d{4})-(\d{2})-(\d{2})T/.exec(trimmed)
  if (leadingYmd) {
    const y = Number(leadingYmd[1])
    const m = Number(leadingYmd[2])
    const d = Number(leadingYmd[3])
    if (!isValidCalendarYmd(y, m, d)) return null
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function extractKuwaitParts(date: Date): KuwaitDateTimeParts {
  if (KUWAIT_PARTS_FORMATTER) {
    try {
      const parts = KUWAIT_PARTS_FORMATTER.formatToParts(date)
      const get = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === type)?.value ?? ''
      const yyyy = get('year')
      const mm = get('month')
      const dd = get('day')
      const rawHour = get('hour')
      const hh = rawHour === '24' ? '00' : rawHour
      const min = get('minute')
      const sec = get('second')
      if (yyyy && mm && dd && hh && min && sec) {
        return {
          year: Number(yyyy),
          month: Number(mm),
          day: Number(dd),
          yyyy,
          mm,
          dd,
          hh,
          min,
          sec,
        }
      }
    } catch {
      // Fall through to deterministic UTC+3 arithmetic below.
    }
  }

  // Kuwait is permanently UTC+3 with zero DST transitions.
  const kw = new Date(date.getTime() + KUWAIT_OFFSET_MS)
  const pad = (n: number) => String(n).padStart(2, '0')
  const year = kw.getUTCFullYear()
  const month = kw.getUTCMonth() + 1
  const day = kw.getUTCDate()
  return {
    year,
    month,
    day,
    yyyy: String(year).padStart(4, '0'),
    mm: pad(month),
    dd: pad(day),
    hh: pad(kw.getUTCHours()),
    min: pad(kw.getUTCMinutes()),
    sec: pad(kw.getUTCSeconds()),
  }
}

/**
 * Formats a date in `Asia/Kuwait` (`UTC+3`), returning `'—'` for null, undefined, empty, or invalid inputs.
 * Backwards-compatible with 1-arg `formatDate(d)` callers while supporting `'ar'` / `'en'` locales and options.
 */
export function formatDate(
  value: Date | string | number | null | undefined,
  localeOrOpts?: FormatLocale | FormatDateOptions,
): string {
  const date = parseDateInput(value)
  if (!date) return UNAVAILABLE_DASH

  const opts: FormatDateOptions =
    typeof localeOrOpts === 'string' ? { locale: localeOrOpts } : (localeOrOpts ?? {})
  const locale: FormatLocale = opts.locale === 'ar' ? 'ar' : 'en'
  const style = opts.style ?? 'iso'
  const parts = extractKuwaitParts(date)

  if (style === 'medium') {
    const monthIdx = parts.month - 1
    return locale === 'ar'
      ? `${parts.day} ${AR_MONTH_NAMES[monthIdx]} ${parts.year}`
      : `${EN_SHORT_MONTHS[monthIdx]} ${parts.day}, ${parts.year}`
  }

  return `${parts.yyyy}-${parts.mm}-${parts.dd}`
}

/**
 * Alias for `formatDate` — explicitly conveys `Asia/Kuwait` (`UTC+3`) calendar-day formatting.
 */
export const formatKuwaitDate = formatDate

/**
 * Formats a date + 24h time in `Asia/Kuwait` (`UTC+3`), returning `'—'` for null, undefined, empty, or invalid inputs.
 */
export function formatDateTime(
  value: Date | string | number | null | undefined,
  localeOrOpts?: FormatLocale | FormatDateTimeOptions,
): string {
  const date = parseDateInput(value)
  if (!date) return UNAVAILABLE_DASH

  const opts: FormatDateTimeOptions =
    typeof localeOrOpts === 'string' ? { locale: localeOrOpts } : (localeOrOpts ?? {})
  const locale: FormatLocale = opts.locale === 'ar' ? 'ar' : 'en'
  const style = opts.style ?? 'iso'
  const includeSeconds = opts.includeSeconds ?? false
  const showZone = opts.showZone ?? false
  const parts = extractKuwaitParts(date)

  const timeSegment = includeSeconds
    ? `${parts.hh}:${parts.min}:${parts.sec}`
    : `${parts.hh}:${parts.min}`
  const zoneSuffix = showZone ? ' UTC+3' : ''

  if (style === 'medium') {
    const monthIdx = parts.month - 1
    return locale === 'ar'
      ? `${parts.day} ${AR_MONTH_NAMES[monthIdx]} ${parts.year}، ${timeSegment}${zoneSuffix}`
      : `${EN_SHORT_MONTHS[monthIdx]} ${parts.day}, ${parts.year} ${timeSegment}${zoneSuffix}`
  }

  return `${parts.yyyy}-${parts.mm}-${parts.dd} ${timeSegment}${zoneSuffix}`
}

/**
 * Alias for `formatDateTime` — explicitly conveys `Asia/Kuwait` (`UTC+3`) timestamp formatting.
 */
export const formatKuwaitDateTime = formatDateTime

// ============================================================================
// Backwards-Compatible Legacy ERP Formatters & Helpers
// ============================================================================

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function round3(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000
}

const CURRENCY_LABEL: Record<string, string> = {
  KWD: 'د.ك',
  SAR: 'د.ك',
  USD: 'د.ك',
}

/** Kuwait dinar formatting: 3 decimal places (fils). Pass locale `en` for `KWD 0.000`. */
export function formatMoney(value: number, currency: string | 'ar' | 'en' = 'KWD') {
  const safe = Number.isFinite(value) ? value : 0
  const negative = safe < 0
  const [whole, fraction] = Math.abs(safe).toFixed(3).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const amount = `${negative ? '-' : ''}${grouped}.${fraction}`
  if (currency === 'en') return `KWD ${amount}`
  if (currency === 'ar') return `${amount} د.ك`
  const label = CURRENCY_LABEL[currency] ?? 'د.ك'
  return `${amount} ${label}`
}

export function formatQty(value: number) {
  const safe = Number.isFinite(value) ? value : 0
  if (Number.isInteger(safe)) return String(safe)
  return safe.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

export function formatMonth(value: Date) {
  const parts = extractKuwaitParts(value)
  return `${AR_MONTH_NAMES[parts.month - 1]} ${parts.year}`
}

export function monthRange(value = new Date()) {
  const start = new Date(value.getFullYear(), value.getMonth(), 1)
  const end = new Date(value.getFullYear(), value.getMonth() + 1, 1)
  return { start, end }
}

export function dayRange(value = new Date()) {
  const start = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  ASSET: 'أصول',
  LIABILITY: 'خصوم',
  EQUITY: 'حقوق ملكية',
  REVENUE: 'إيرادات',
  EXPENSE: 'مصروفات',
}

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'مسودة',
  PAID: 'مدفوعة',
  PARTIAL: 'مدفوعة جزئياً',
  UNPAID: 'غير مدفوعة',
  PENDING: 'بانتظار الدفع',
  EXPIRED: 'منتهي',
  SENT: 'مُرسل',
  ACCEPTED: 'مقبول',
  CONVERTED: 'محوّل',
}

export const MOVEMENT_LABEL: Record<string, string> = {
  OPENING: 'رصيد افتتاحي',
  IN: 'وارد',
  OUT: 'صادر',
  TRANSFER_OUT: 'تحويل صادر',
  TRANSFER_IN: 'تحويل وارد',
}

export function paymentStatus(total: number, paid: number) {
  if (paid >= total - 0.001) return 'PAID'
  if (paid > 0.001) return 'PARTIAL'
  return 'UNPAID'
}

export function movementTypeFromQuery(query: string) {
  const value = query.trim()
  const upper = value.toUpperCase()
  if (value.includes('افتتاح') || upper === 'OPENING') return 'OPENING'
  if (value.includes('وارد') || upper === 'IN') return 'IN'
  if (value.includes('تحويل صادر') || upper === 'TRANSFER_OUT') return 'TRANSFER_OUT'
  if (value.includes('تحويل وارد') || upper === 'TRANSFER_IN') return 'TRANSFER_IN'
  if (value.includes('صادر') || upper === 'OUT') return 'OUT'
  return ''
}

export function statusTone(status: string) {
  if (status === 'PAID') return 'bg-emerald-600 text-white'
  if (status === 'DRAFT') return 'bg-[#00a99d] text-white'
  if (status === 'PARTIAL' || status === 'PENDING') return 'bg-amber-500 text-white'
  return 'bg-red-600 text-white'
}
