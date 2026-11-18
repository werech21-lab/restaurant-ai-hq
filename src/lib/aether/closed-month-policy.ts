/**
 * Phase 5 · Item 7 — Net Profit / Net Margin only for closed General Ledger months.
 *
 * A month is "closed" once Accounting has locked it in Odoo 17 via `res.company`:
 *   - `period_lock_date`     (lock for non-advisers — the monthly close), or
 *   - `fiscalyear_lock_date` (hard lock for everyone).
 * The GL is closed through the later of the two. Net Profit and Net Margin are shown only when the
 * selected window ends on or before that date; otherwise they are withheld (never estimated).
 * If the lock date cannot be read, nothing is treated as closed (fail-closed).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function cleanIso(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const d = v.trim().slice(0, 10)
  return ISO_DATE.test(d) ? d : null
}

/** Odoo returns `false` for unset dates; returns the later valid lock date or `null`. */
export function resolveGlClosedThroughDate(
  periodLockDate: unknown,
  fiscalyearLockDate: unknown,
): string | null {
  const a = cleanIso(periodLockDate)
  const b = cleanIso(fiscalyearLockDate)
  if (a && b) return a > b ? a : b
  return a ?? b
}

/** True only when the whole window ends on or before the GL closed-through date. */
export function isWindowWithinClosedMonths(
  toInclusiveIso: string | null | undefined,
  closedThroughIso: string | null | undefined,
): boolean {
  const to = cleanIso(toInclusiveIso)
  const closed = cleanIso(closedThroughIso)
  if (!to || !closed) return false
  return to <= closed
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

function resolveLastClosedMonthParts(
  closedThroughIso: string | null | undefined,
): { year: number; month: number; lastDay: number; labelAr: string; labelEn: string } | null {
  const closed = cleanIso(closedThroughIso)
  if (!closed) return null
  let y = Number(closed.slice(0, 4))
  let m = Number(closed.slice(5, 7)) // 1-based
  const d = Number(closed.slice(8, 10))
  if (m < 1 || m > 12 || d < 1) return null
  const inputMonthLastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  if (d > inputMonthLastDay) return null
  if (d < inputMonthLastDay) {
    m -= 1
    if (m === 0) {
      m = 12
      y -= 1
    }
  }
  const closedLastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return {
    year: y,
    month: m,
    lastDay: closedLastDay,
    labelAr: `${MONTHS_AR[m - 1]} ${y}`,
    labelEn: `${MONTHS_EN[m - 1]} ${y}`,
  }
}

/** Last fully closed calendar month label (e.g. "Oct 2026"), or `null` when none is closed. */
export function lastClosedMonthLabel(
  closedThroughIso: string | null | undefined,
  locale: 'ar' | 'en',
): string | null {
  const parts = resolveLastClosedMonthParts(closedThroughIso)
  if (!parts) return null
  return locale === 'ar' ? parts.labelAr : parts.labelEn
}

/** Date range (`YYYY-MM-01..YYYY-MM-lastDay`) and bilingual labels for the last fully closed calendar month. */
export function lastClosedMonthDateRange(
  closedThroughIso: string | null | undefined,
): { fromIso: string; toIso: string; labelAr: string; labelEn: string } | null {
  const parts = resolveLastClosedMonthParts(closedThroughIso)
  if (!parts) return null
  const mm = String(parts.month).padStart(2, '0')
  const dd = String(parts.lastDay).padStart(2, '0')
  return {
    fromIso: `${parts.year}-${mm}-01`,
    toIso: `${parts.year}-${mm}-${dd}`,
    labelAr: parts.labelAr,
    labelEn: parts.labelEn,
  }
}

/** Single calm note used when Odoo has no lock dates at all (nothing is closed yet). */
export const PROFIT_AFTER_CLOSE_NOTE = {
  en: 'Profit appears after the month is closed in accounting',
  ar: 'يظهر الربح بعد إقفال الشهر في المحاسبة',
} as const

export function closedMonthWithheldReason(closedThroughIso: string | null | undefined): {
  ar: string
  en: string
} {
  const ar = lastClosedMonthLabel(closedThroughIso, 'ar')
  const en = lastClosedMonthLabel(closedThroughIso, 'en')
  if (!ar || !en) return { ...PROFIT_AFTER_CLOSE_NOTE }
  return {
    ar: `صافي الربح يُعرض للأشهر المُقفلة محاسبياً فقط — آخر شهر مُقفل: ${ar}`,
    en: `Net Profit is shown for closed GL months only — last closed month: ${en}`,
  }
}
