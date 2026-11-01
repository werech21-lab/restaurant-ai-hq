import type { Locale } from '@/lib/i18n'
import { panelAr, panelEn, type PanelMessageKey } from '@/lib/i18n/panel-messages'

const ARABIC_RE = /[\u0600-\u06FF]/

/** Returns true when a string still contains Arabic script (leaks in EN mode). */
export function containsArabic(value: string) {
  return ARABIC_RE.test(value)
}

/** Strict bilingual selector for mixed call sites. */
export function pickLocaleText(locale: Locale, ar: string, en: string) {
  return locale === 'en' ? en : ar
}

/** Status labels without importing React (server-safe). */
export function statusLabel(locale: Locale, status: string) {
  const map: Record<string, { ar: string; en: string }> = {
    DRAFT: { ar: 'مسودة', en: 'Draft' },
    PAID: { ar: 'مدفوعة', en: 'Paid' },
    PARTIAL: { ar: 'مدفوعة جزئياً', en: 'Partially Paid' },
    UNPAID: { ar: 'غير مدفوعة', en: 'Unpaid' },
    PENDING: { ar: 'بانتظار الدفع', en: 'Pending' },
    EXPIRED: { ar: 'منتهي', en: 'Expired' },
    SENT: { ar: 'مُرسل', en: 'Sent' },
    ACCEPTED: { ar: 'مقبول', en: 'Accepted' },
    CONVERTED: { ar: 'محوّل', en: 'Converted' },
    PRESENT: { ar: 'حاضر', en: 'Present' },
    ABSENT: { ar: 'غائب', en: 'Absent' },
    LATE: { ar: 'متأخر', en: 'Late' },
    LEAVE: { ar: 'إجازة', en: 'On leave' },
  }
  const row = map[status]
  if (!row) return status
  return locale === 'en' ? row.en : row.ar
}

export function accountTypeLabel(locale: Locale, type: string) {
  const map: Record<string, { ar: string; en: string }> = {
    ASSET: { ar: 'أصول', en: 'Assets' },
    LIABILITY: { ar: 'خصوم', en: 'Liabilities' },
    EQUITY: { ar: 'حقوق ملكية', en: 'Equity' },
    REVENUE: { ar: 'إيرادات', en: 'Revenue' },
    EXPENSE: { ar: 'مصروفات', en: 'Expenses' },
  }
  const row = map[type]
  if (!row) return type
  return locale === 'en' ? row.en : row.ar
}

export function movementLabel(locale: Locale, type: string) {
  const map: Record<string, { ar: string; en: string }> = {
    OPENING: { ar: 'رصيد افتتاحي', en: 'Opening balance' },
    IN: { ar: 'وارد', en: 'Inbound' },
    OUT: { ar: 'صادر', en: 'Outbound' },
    TRANSFER_OUT: { ar: 'تحويل صادر', en: 'Transfer out' },
    TRANSFER_IN: { ar: 'تحويل وارد', en: 'Transfer in' },
  }
  const row = map[type]
  if (!row) return type
  return locale === 'en' ? row.en : row.ar
}

export function attendanceLabel(locale: Locale, status: string) {
  const map: Record<string, { ar: string; en: string }> = {
    PRESENT: { ar: 'حاضر', en: 'Present' },
    ABSENT: { ar: 'غائب', en: 'Absent' },
    LATE: { ar: 'متأخر', en: 'Late' },
    LEAVE: { ar: 'إجازة', en: 'Leave' },
  }
  const row = map[status]
  if (!row) return status
  return locale === 'en' ? row.en : row.ar
}

export function quoteStatusLabel(locale: Locale, status: string) {
  const map: Record<string, { ar: string; en: string }> = {
    DRAFT: { ar: 'مسودة', en: 'Draft' },
    SENT: { ar: 'مُرسل', en: 'Sent' },
    ACCEPTED: { ar: 'مقبول', en: 'Accepted' },
    CONVERTED: { ar: 'محوّل لفاتورة', en: 'Converted to invoice' },
  }
  const row = map[status]
  if (!row) return statusLabel(locale, status)
  return locale === 'en' ? row.en : row.ar
}

export function journalEntryKindLabel(locale: Locale, referenceType: string) {
  if (referenceType === 'MANUAL') {
    return locale === 'en' ? 'Manual entry' : 'قيد يدوي'
  }
  return locale === 'en' ? 'System entry' : 'قيد آلي'
}

export function payrollStatusLabel(locale: Locale, status: string) {
  if (status === 'PAID') return locale === 'en' ? 'Disbursed' : 'مصروف'
  return locale === 'en' ? 'Draft' : 'مسودة'
}

export function paymentVoucherLabel(locale: Locale, type: string) {
  if (type === 'RECEIPT') return locale === 'en' ? 'Receipt voucher' : 'سند قبض'
  return locale === 'en' ? 'Payment voucher' : 'سند صرف'
}

export function moduleNavLabel(locale: Locale, labelKey: PanelMessageKey) {
  return locale === 'en' ? panelEn[labelKey] : panelAr[labelKey]
}

/** Landing EN keys that must never resolve to Arabic. */
export const LANDING_EN_PURE_KEYS = [
  'land.hero.bullet1',
  'land.hero.bullet2',
  'land.hero.bullet3',
  'land.feat.finance.title',
  'land.feat.finance.body',
  'land.feat.inventory.title',
  'land.feat.inventory.body',
  'land.feat.pos.title',
  'land.feat.pos.body',
  'land.feat.hr.title',
  'land.feat.hr.body',
  'land.feat.crm.title',
  'land.feat.crm.body',
  'land.feat.ai.title',
  'land.feat.ai.body',
  'land.plan.starter.detail',
  'land.plan.growth.detail',
  'land.plan.enterprise.price',
  'land.plan.enterprise.detail',
  'land.plan.perMonth',
  'land.footer',
] as const
