import type { ItemUnit } from '@/modules/inventory/client'
import type { DraftMessage } from '@/modules/ai/domain/types'

// Arabic text the engine writes. Pure functions, so the same data always gives the same text and tests can pin it.
// Numbers use Latin digits with grouping commas, like the rest of the dashboard.

const UNIT_LABELS: Record<ItemUnit, string> = {
  piece: 'قطعة',
  kg: 'كجم',
  g: 'جرام',
  l: 'لتر',
  ml: 'مل',
  box: 'علبة',
}

export function unitLabelAr(unit: ItemUnit): string {
  return UNIT_LABELS[unit]
}

export function formatCount(value: number): string {
  return Math.trunc(value).toLocaleString('en-US')
}

/** Fils to `1,234.500 د.ك`. Exact: it splits the integer, never divides into a float. */
export function formatKwd(minor: number): string {
  const negative = minor < 0
  const absolute = Math.abs(Math.trunc(minor))
  const whole = Math.floor(absolute / 1000)
  const fraction = String(absolute % 1000).padStart(3, '0')
  return `${negative ? '-' : ''}${whole.toLocaleString('en-US')}.${fraction} د.ك`
}

/** Basis points to a percentage without a float: 2000 gives `20`, 250 gives `2.5`, -150 gives `-1.5`. */
export function formatBps(bps: number): string {
  const negative = bps < 0
  const absolute = Math.abs(Math.trunc(bps))
  const whole = Math.floor(absolute / 100)
  const fraction = absolute % 100
  const text = fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`
  return negative ? `-${text}` : text
}

/** One decimal place of `numerator / denominator`, rounded half up, for display only. */
export function formatPerDay(quantity: number, windowDays: number): string {
  const tenths = Math.floor((quantity * 10 * 2 + windowDays) / (windowDays * 2))
  return `${Math.floor(tenths / 10)}.${tenths % 10}`
}

const KUWAIT_COUNTRY_CODE = '965'

/**
 * A wa.me link for a phone number. Kuwait numbers are 8 digits, so a bare 8-digit number gets the 965 prefix (the system is
 * KWD only). Anything that is not 8 to 15 digits after cleaning gives null, so a bad number never makes a broken link.
 */
export function buildWhatsappUrl(phone: string | null, text: string): { phone: string; url: string } | null {
  if (phone === null) return null
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 8) digits = `${KUWAIT_COUNTRY_CODE}${digits}`
  if (digits.length < 8 || digits.length > 15) return null
  return { phone: digits, url: `https://wa.me/${digits}?text=${encodeURIComponent(text)}` }
}

export function toDraftMessage(textAr: string, phone: string | null): DraftMessage {
  const link = buildWhatsappUrl(phone, textAr)
  return { textAr, phone: link?.phone ?? null, whatsappUrl: link?.url ?? null }
}

export type ReminderInvoice = { number: string; balanceMinor: number; daysOverdue: number }

export function paymentReminderText(args: {
  customerName: string
  overdueMinor: number
  invoices: readonly ReminderInvoice[]
  overdueInvoiceCount: number
}): string {
  const lines = args.invoices.map(
    (invoice) => `- ${invoice.number}: ${formatKwd(invoice.balanceMinor)} (متأخرة ${formatCount(invoice.daysOverdue)} يومًا)`
  )
  const more = args.overdueInvoiceCount - args.invoices.length
  if (more > 0) lines.push(`- و${formatCount(more)} فواتير أخرى`)
  return [
    `السيد/ة ${args.customerName} المحترم/ة،`,
    `نود تذكيركم بوجود ${formatCount(args.overdueInvoiceCount)} فاتورة مستحقة السداد بإجمالي ${formatKwd(args.overdueMinor)}:`,
    ...lines,
    'نرجو التكرم بالسداد في أقرب وقت، وإن كان السداد قد تم فنرجو تجاهل هذه الرسالة.',
    'شكرًا لتعاونكم.',
  ].join('\n')
}

export function leadFollowupText(args: { customerName: string; leadTitle: string }): string {
  return [
    `السيد/ة ${args.customerName} المحترم/ة،`,
    `نتابع معكم بخصوص «${args.leadTitle}». هل لديكم أي استفسار أو ملاحظات نستطيع مساعدتكم فيها لإتمام الاتفاق؟`,
    'يسعدنا خدمتكم.',
  ].join('\n')
}
