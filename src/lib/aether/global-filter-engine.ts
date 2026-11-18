/**
 * Global Filter Engine — Live Odoo 17 Slicing, Strict GL Accounting & Zero-Fallback Disconnect Truth
 *
 * Strictly enforces:
 *   1. ONLY the 6 approved Venture Foods restaurant brands (zero canceled/banned brands).
 *   2. ONLY the 7 active Odoo restaurant locations (+ standalone 8th bucket «غير منسوب لفرع»).
 *   3. Zero static fallback datasets (`odoo-dataset`, `odoo-journey`, `full-journey-enterprise-brain`, `odoo-cfo-realism`).
 *   4. Strict disconnect truth (`odooConnected: false`, `noData: true`, `'لا توجد بيانات من Odoo لهذه الفترة'`).
 *   5. Explicit GL incomplete warning (`glIncomplete: true`, `'قيود غير مكتملة لهذه الفترة'`) and unposted commission indicator (`'غير مُرحَّل بعد'`).
 */

import {
  PER_CUSTOMER_DUE_DATE_AGING_VERIFIED,
  RECEIVABLES_PENDING_DETAIL,
  RECEIVABLES_PENDING_STATUS,
  canShowReceivableAmounts,
} from '@/lib/aether/receivables-status'
import { closedMonthWithheldReason, isWindowWithinClosedMonths } from '@/lib/aether/closed-month-policy'
import type { JourneyPlay } from '@/lib/full-journey-enterprise-brain'
import type { CfoRealismProfile } from '@/lib/odoo-cfo-realism'
import type {
  OdooBucketSummary,
  OdooLiveSummary,
  OdooPeriodBucketKey,
  OdooReceivableAccountRow,
  OdooReceivableAgingBucket,
} from '@/lib/odoo/live-sync-core'
import { clampPeriodToKuwaitToday, getKuwaitTimeContext } from '@/lib/aether/period-delta'
import { companyDailySeries, resolveBrandHeadline } from '@/lib/aether/brand-scope'
import { formatArReconciliationFormula, toDisplayableAging } from '@/lib/odoo/receivable-aging'

export type GlobalPeriod = 'today' | 'week' | 'month' | 'year' | 'custom'

export type KuwaitSlice = 'all' | 'payday' | 'mid-month' | 'weekend' | 'quiet-hours'

export type ProfitLens =
  | 'all'
  | 'bleed'
  | 'top-pocket'
  | 'delivery-audit'
  | 'ardiya-buying'
  | 'quiet-hours'
  | 'payday-weekend'

export type GlobalBrand =
  | 'all'
  | 'china-garden'
  | 'franks'
  | 'tahina'
  | 'farm-brown'
  | 'noodle-bar'
  | 'karak-cafeteria'

export type GlobalBranch =
  | 'all'
  | 'avenues'
  | '360-mall'
  | 'assima'
  | 'promenade'
  | 'salmiya'
  | 'al-kout'
  | 'ardiya'
  | 'school-canteens'
  | 'exhibitions'

export type GlobalChannel =
  | 'all'
  | 'dine-in'
  | 'takeaway-direct'
  | 'talabat-tgo'
  | 'talabat-tmp'
  | 'keeta'
  | 'deliveroo'
  | 'jahez'
  | 'snoonu'

export interface GlobalFilters {
  period: GlobalPeriod
  customFrom?: string
  customTo?: string
  kuwaitSlice?: KuwaitSlice
  brand: GlobalBrand
  branch: GlobalBranch
  channel: GlobalChannel
  lens?: ProfitLens
}

const BOOTSTRAP_YESTERDAY_ISO = getKuwaitTimeContext().yesterdayIso

function shiftIsoDateDays(iso: string, deltaDays: number): string {
  const ms = Date.parse(`${iso}T12:00:00Z`)
  if (!Number.isFinite(ms)) return iso
  return new Date(ms + deltaDays * 86_400_000).toISOString().slice(0, 10)
}

export const DEFAULT_CUSTOM_FROM = shiftIsoDateDays(BOOTSTRAP_YESTERDAY_ISO, -29)
export const DEFAULT_CUSTOM_TO = BOOTSTRAP_YESTERDAY_ISO

export const DEFAULT_GLOBAL_FILTERS: Required<GlobalFilters> = {
  period: 'month',
  customFrom: DEFAULT_CUSTOM_FROM,
  customTo: DEFAULT_CUSTOM_TO,
  kuwaitSlice: 'all',
  brand: 'all',
  branch: 'all',
  channel: 'all',
  lens: 'all',
}

export type HealthDot = '🟢' | '🟠' | '🔴'

export interface FilterOption<T extends string> {
  id: T
  ar: string
  en: string
  healthDot?: HealthDot
  weightedNetPct?: number
  salesKwd?: number
  available?: boolean
}

export const GLOBAL_PERIOD_OPTIONS: readonly FilterOption<GlobalPeriod>[] = [
  { id: 'today', ar: 'اليوم', en: 'Today' },
  { id: 'week', ar: 'الأسبوع', en: 'Week' },
  { id: 'month', ar: 'الشهر', en: 'Month' },
  { id: 'year', ar: 'السنة', en: 'Year' },
  { id: 'custom', ar: 'مخصص 📅', en: 'Custom 📅' },
] as const

export const GLOBAL_KUWAIT_SLICE_OPTIONS: readonly FilterOption<KuwaitSlice>[] = [
  { id: 'all', ar: 'كل الأوقات', en: 'All Times' },
  { id: 'payday', ar: 'أيام الرواتب 20–28', en: 'Paydays 20–28' },
  { id: 'mid-month', ar: 'منتصف الشهر 10–19', en: 'Mid-Month 10–19' },
  { id: 'weekend', ar: 'الويكند والزوارة', en: 'Weekend & Gatherings' },
  { id: 'quiet-hours', ar: 'الساعات الهادئة 3–6', en: 'Quiet Hours 3–6' },
] as const

export const GLOBAL_PROFIT_LENS_OPTIONS: readonly FilterOption<ProfitLens>[] = [
  { id: 'all', ar: 'عرض الكل 🌐', en: 'Show All 🌐' },
  { id: 'bleed', ar: 'أكبر نزيف وتوقف 🔴', en: 'Top Bleed & Stops 🔴' },
  { id: 'top-pocket', ar: 'الأعلى صافي بالجيب 🟢', en: 'Highest Net Pocket 🟢' },
  { id: 'delivery-audit', ar: 'عمولات منصات التوصيل 🛵', en: 'Delivery Fee Review 🛵' },
  { id: 'ardiya-buying', ar: 'مطبخ العارضية والمشتريات 🏭', en: 'Ardiya & Buying 🏭' },
  { id: 'quiet-hours', ar: 'فرص الساعات الهادئة ⏰', en: 'Quiet Hours Upside ⏰' },
  { id: 'payday-weekend', ar: 'فورة الرواتب والويكند 🔥', en: 'Payday & Weekend 🔥' },
] as const

/** ONLY the 6 approved Venture Foods restaurant brands — never include canceled or school canteen brands. */
export const GLOBAL_BRAND_OPTIONS: readonly FilterOption<GlobalBrand>[] = [
  { id: 'all', ar: 'كل العلامات التجارية', en: 'All Brands' },
  { id: 'china-garden', ar: 'تشاينا جاردن', en: 'China Garden' },
  { id: 'franks', ar: 'فرانكس', en: "Frank's" },
  { id: 'tahina', ar: 'طحينة', en: 'Tahina' },
  { id: 'farm-brown', ar: 'فارم براون', en: 'Farm Brown' },
  { id: 'noodle-bar', ar: 'ذا نودل بار', en: 'The Noodle Bar' },
  { id: 'karak-cafeteria', ar: 'كرك كافتيريا', en: 'Karak Cafeteria' },
] as const

export const APPROVED_BRAND_IDS: readonly Exclude<GlobalBrand, 'all'>[] = [
  'china-garden',
  'franks',
  'tahina',
  'farm-brown',
  'noodle-bar',
  'karak-cafeteria',
] as const

/** ONLY the 7 active Odoo restaurant locations — never include removed legacy locations. */
export const GLOBAL_BRANCH_OPTIONS: readonly FilterOption<GlobalBranch>[] = [
  { id: 'all', ar: 'كل الفروع', en: 'All Branches' },
  { id: 'avenues', ar: 'الأفنيوز', en: 'The Avenues' },
  { id: '360-mall', ar: 'مول 360', en: '360' },
  { id: 'assima', ar: 'العاصمة', en: 'Assima' },
  { id: 'promenade', ar: 'بروميناد', en: 'Promenade' },
  { id: 'salmiya', ar: 'السالمية', en: 'Salmiya' },
  { id: 'al-kout', ar: 'الكوت', en: 'Al-Kout' },
  { id: 'ardiya', ar: 'مطبخ العارضية', en: 'Ardiya' },
  { id: 'school-canteens', ar: 'مقاصف المدارس', en: 'School canteens' },
  { id: 'exhibitions', ar: 'بوثات المعارض', en: 'Exhibition Booths' },
] as const

export const APPROVED_BRANCH_IDS = [
  'avenues',
  '360-mall',
  'assima',
  'promenade',
  'salmiya',
  'al-kout',
  'ardiya',
] as const satisfies readonly Exclude<GlobalBranch, 'all'>[]

/**
 * Branch cards on the Executive Dashboard: the seven restaurants plus the school canteens and the
 * exhibition booths, so the cards add up to the company total.
 */
export const DASHBOARD_BRANCH_CARD_IDS = [
  ...APPROVED_BRANCH_IDS,
  'school-canteens',
  'exhibitions',
] as const satisfies readonly Exclude<GlobalBranch, 'all'>[]

/**
 * Custom range without a matching `customBucket` in the payload (e.g. the previous period's payload
 * is still on screen while the custom fetch is pending or failed): derive the bucket from the SAME
 * payload's per-day, per-branch rows so the headline and the branch rows come from identical data.
 * Only when the whole range lies inside the payload's daily coverage; otherwise `undefined`.
 * Brands / channels are not in the daily rows, so they stay `null` (shown as unavailable).
 */
export function deriveCustomBucketFromDaily(
  liveSummary: Pick<OdooLiveSummary, 'dailyByBranch' | 'dailyUnattributed'> | null | undefined,
  fromIso: string,
  toInclusiveIso: string,
): OdooBucketSummary | undefined {
  const byDay = liveSummary?.dailyByBranch
  if (!byDay) return undefined
  const days = Object.keys(byDay).sort()
  if (days.length === 0 || fromIso < days[0] || toInclusiveIso > days[days.length - 1]) return undefined
  const inRange = days.filter((d) => d >= fromIso && d <= toInclusiveIso)
  const fils = (n: unknown) => Math.round((Number(n) || 0) * 1000)
  const loc = new Map<string, { netFils: number; orders: number }>()
  let unFils = 0
  let unOrders = 0
  for (const d of inRange) {
    for (const [branchId, cell] of Object.entries(byDay[d] ?? {})) {
      const acc = loc.get(branchId) ?? { netFils: 0, orders: 0 }
      acc.netFils += fils(cell?.netKwd)
      acc.orders += Math.max(0, Math.round(Number(cell?.orders) || 0))
      loc.set(branchId, acc)
    }
    const u = liveSummary?.dailyUnattributed?.[d]
    unFils += fils(u?.netKwd)
    unOrders += Math.max(0, Math.round(Number(u?.orders) || 0))
  }
  const byLocation: NonNullable<OdooBucketSummary['byLocation']> = {}
  const mappedByLocation: NonNullable<OdooBucketSummary['mappedByLocation']> = {}
  let totalFils = unFils
  let totalOrders = unOrders
  for (const [branchId, acc] of loc) {
    byLocation[branchId] = { netKwd: acc.netFils / 1000, orders: acc.orders, uiChannels: null }
    mappedByLocation[branchId] = { netKwd: acc.netFils / 1000, orders: acc.orders }
    totalFils += acc.netFils
    totalOrders += acc.orders
  }
  const net = totalFils / 1000
  return {
    key: 'custom',
    from: fromIso,
    to: shiftIsoDateDays(toInclusiveIso, 1),
    days: Math.round((Date.parse(`${toInclusiveIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000) + 1,
    totals: {
      netSalesKwd: net,
      orders: totalOrders,
      aovKwd: totalOrders > 0 ? Math.round((net / totalOrders) * 1000) / 1000 : null,
      restaurantNetKwd: net,
      restaurantOrders: totalOrders,
    },
    byBrand: null,
    byLocation,
    mappedByLocation,
    unattributedSalesKwd: unFils / 1000,
    unattributedOrders: unOrders,
    uiChannels: null,
  }
}

/**
 * The summary bucket for the selected period, shared by the workspace engine and the pages so the
 * headline and the branch rows always use the same data: period bucket, or for Custom the matching
 * `customBucket`, else a bucket derived from the same payload's daily rows.
 */
export function resolveSummaryBucket(
  filters: Pick<GlobalFilters, 'period' | 'customFrom' | 'customTo'>,
  liveSummary: OdooLiveSummary | null | undefined,
): OdooBucketSummary | undefined {
  if (!liveSummary) return undefined
  if (filters.period !== 'custom') return liveSummary.buckets?.[filters.period] ?? undefined
  if (!filters.customFrom || !filters.customTo) return undefined
  const clamped = clampPeriodToKuwaitToday({ from: filters.customFrom, to: filters.customTo })
  const cb = liveSummary.customBucket
  if (cb && cb.from === clamped.from && (cb.to === shiftIsoDateDays(clamped.to, 1) || cb.to === clamped.to)) {
    return cb
  }
  return deriveCustomBucketFromDaily(liveSummary, clamped.from, clamped.to)
}

/**
 * Exhibition booths are shown only when the payload actually reports them (a byLocation entry);
 * payloads from before booths were counted have none, and a missing group is never shown as 0.000.
 */
export function isExhibitionGroupReported(bucket: { byLocation?: Record<string, unknown> | null; mappedByLocation?: Record<string, unknown> | null } | null | undefined): boolean {
  return Boolean(bucket?.byLocation?.exhibitions ?? bucket?.mappedByLocation?.exhibitions)
}

/** Non-restaurant groups that are part of company totals (like branches, but not restaurants). */
export const COMPANY_GROUP_BRANCH_IDS = ['school-canteens', 'exhibitions'] as const satisfies readonly Exclude<GlobalBranch, 'all'>[]

export const GLOBAL_CHANNEL_OPTIONS: readonly FilterOption<GlobalChannel>[] = [
  { id: 'all', ar: 'كل القنوات', en: 'All Channels' },
  { id: 'dine-in', ar: 'الصالة', en: 'Dine-in' },
  { id: 'takeaway-direct', ar: 'سفري ومباشر', en: 'Takeaway/Direct' },
  { id: 'talabat-tgo', ar: 'طلبات (أسطول المنصة)', en: 'Talabat Tgo' },
  { id: 'talabat-tmp', ar: 'طلبات (سائقي الشركة)', en: 'Talabat TMP' },
  { id: 'keeta', ar: 'كيتا', en: 'Keeta' },
  { id: 'deliveroo', ar: 'ديليفرو', en: 'Deliveroo' },
  { id: 'jahez', ar: 'جاهز', en: 'Jahez' },
  { id: 'snoonu', ar: 'سنونو', en: 'Snoonu' },
] as const

export const APPROVED_CHANNEL_IDS: readonly Exclude<GlobalChannel, 'all'>[] = [
  'dine-in',
  'takeaway-direct',
  'talabat-tgo',
  'talabat-tmp',
  'keeta',
  'deliveroo',
  'jahez',
  'snoonu',
] as const

export const APPROVED_KUWAIT_SLICES: readonly KuwaitSlice[] = [
  'all',
  'payday',
  'mid-month',
  'weekend',
  'quiet-hours',
] as const

export const APPROVED_PROFIT_LENSES: readonly ProfitLens[] = [
  'all',
  'bleed',
  'top-pocket',
  'delivery-audit',
  'ardiya-buying',
  'quiet-hours',
  'payday-weekend',
] as const

type BrandKey = Exclude<GlobalBrand, 'all'>
type BranchKey = Exclude<GlobalBranch, 'all'>
type ChannelKey = Exclude<GlobalChannel, 'all'>

const safeNum = (v: unknown, fb = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fb

const safeDiv = (num: number, den: number, fb = 0): number =>
  den > 0 && Number.isFinite(num) && Number.isFinite(den) ? num / den : fb

export function isNonDefaultFilter(f: GlobalFilters): boolean {
  return (
    f.period !== 'month' ||
    (f.kuwaitSlice ?? 'all') !== 'all' ||
    f.brand !== 'all' ||
    f.branch !== 'all' ||
    f.channel !== 'all' ||
    (f.lens ?? 'all') !== 'all'
  )
}

export function inclusiveIsoDayCount(fromIso: string, toInclusiveIso: string): number {
  const start = Date.parse(`${fromIso}T00:00:00Z`)
  const end = Date.parse(`${toInclusiveIso}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1
  return Math.round((end - start) / 86_400_000) + 1
}

/** Calendar length of the month containing an ISO date (28–31). */
export function calendarDaysInIsoMonth(iso: string | undefined): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7))
  if (!Number.isInteger(year) || month < 1 || month > 12) return null
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return length >= 28 && length <= 31 ? length : null
}

export function formatArDays(n: number): string {
  const count = Math.max(0, Math.round(Number.isFinite(n) ? n : 0))
  if (count === 0) return '0 يوم'
  if (count === 1) return 'يوم واحد'
  if (count === 2) return 'يومان'
  const mod100 = count % 100
  if (mod100 >= 3 && mod100 <= 10) return `${count} أيام`
  if (mod100 >= 11 && mod100 <= 99) return `${count} يوماً`
  return `${count} يوم`
}

export function formatArWithinDays(n: number): string {
  const count = Math.max(0, Math.round(Number.isFinite(n) ? n : 0))
  if (count === 1) return 'خلال يوم واحد'
  if (count === 2) return 'خلال يومين'
  return `خلال ${formatArDays(count)}`
}

export function formatArOpportunities(n: number): string {
  const count = Math.max(0, Math.round(Number.isFinite(n) ? n : 0))
  if (count === 0) return '0 فرص'
  if (count === 1) return 'فرصة واحدة'
  if (count === 2) return 'فرصتان'
  const mod100 = count % 100
  if (mod100 >= 3 && mod100 <= 10) return `${count} فرص`
  return `${count} فرصة`
}

export function getPeriodLabel(p: GlobalPeriod, isAr: boolean): string {
  const opt = GLOBAL_PERIOD_OPTIONS.find((x) => x.id === p) ?? GLOBAL_PERIOD_OPTIONS[2]
  return isAr ? opt.ar : opt.en
}

const PERIOD_EN_MONTHS = [
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

const PERIOD_AR_MONTHS = [
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

function parseIsoYmd(iso: string): { year: number; monthIdx: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const year = Number(m[1])
  const monthIdx = Number(m[2]) - 1
  const day = Number(m[3])
  if (monthIdx < 0 || monthIdx > 11 || day < 1 || day > 31) return null
  return { year, monthIdx, day }
}

export function formatInclusiveIsoRangeLabels(
  fromIso: string,
  toInclusiveIso: string,
): { labelEn: string; labelAr: string } {
  const a = parseIsoYmd(fromIso)
  const b = parseIsoYmd(toInclusiveIso)
  if (!a || !b) {
    return {
      labelEn: fromIso === toInclusiveIso ? fromIso : `${fromIso} – ${toInclusiveIso}`,
      labelAr: fromIso === toInclusiveIso ? fromIso : `${fromIso} – ${toInclusiveIso}`,
    }
  }
  if (fromIso === toInclusiveIso) {
    return {
      labelEn: `${PERIOD_EN_MONTHS[a.monthIdx]} ${a.day}, ${a.year}`,
      labelAr: `${a.day} ${PERIOD_AR_MONTHS[a.monthIdx]} ${a.year}`,
    }
  }
  if (a.year === b.year) {
    return {
      labelEn: `${PERIOD_EN_MONTHS[a.monthIdx]} ${a.day} – ${PERIOD_EN_MONTHS[b.monthIdx]} ${b.day}, ${b.year}`,
      labelAr: `${a.day} ${PERIOD_AR_MONTHS[a.monthIdx]} – ${b.day} ${PERIOD_AR_MONTHS[b.monthIdx]} ${b.year}`,
    }
  }
  return {
    labelEn: `${PERIOD_EN_MONTHS[a.monthIdx]} ${a.day}, ${a.year} – ${PERIOD_EN_MONTHS[b.monthIdx]} ${b.day}, ${b.year}`,
    labelAr: `${a.day} ${PERIOD_AR_MONTHS[a.monthIdx]} ${a.year} – ${b.day} ${PERIOD_AR_MONTHS[b.monthIdx]} ${b.year}`,
  }
}

/**
 * Resolves the concrete inclusive calendar date window for any Period selection (`today`, `week`, `month`, `year`, `custom`)
 * strictly from live Odoo buckets or dynamic Kuwait calendar context (zero static snapshot fallback).
 */
export function formatPeriodCalendarWindow(
  period: GlobalPeriod,
  opts?: {
    customFrom?: string
    customTo?: string
    liveSummary?: OdooLiveSummary | null
  },
): {
  fromIso: string
  toInclusiveIso: string
  labelEn: string
  labelAr: string
} {
  if (period === 'custom') {
    const isoRe = /^\d{4}-\d{2}-\d{2}$/
    let f = opts?.customFrom && isoRe.test(opts.customFrom) ? opts.customFrom : DEFAULT_CUSTOM_FROM
    let t = opts?.customTo && isoRe.test(opts.customTo) ? opts.customTo : DEFAULT_CUSTOM_TO
    if (f > t) {
      const tmp = f
      f = t
      t = tmp
    }
    const clampedCustom = clampPeriodToKuwaitToday({ from: f, to: t })
    const labels = formatInclusiveIsoRangeLabels(clampedCustom.from, clampedCustom.to)
    return { fromIso: clampedCustom.from, toInclusiveIso: clampedCustom.to, ...labels }
  }

  const bkt = opts?.liveSummary?.connected === true ? opts.liveSummary.buckets?.[period] : undefined
  if (bkt?.from && bkt?.to) {
    const shiftedEnd = shiftIsoDateDays(bkt.to, -1)
    const rawToInclusiveIso = shiftedEnd >= bkt.from ? shiftedEnd : bkt.from
    const clampedBucket = clampPeriodToKuwaitToday({ from: bkt.from, to: rawToInclusiveIso })
    const labels = formatInclusiveIsoRangeLabels(clampedBucket.from, clampedBucket.to)
    return { fromIso: clampedBucket.from, toInclusiveIso: clampedBucket.to, ...labels }
  }

  if (opts?.liveSummary?.dateRange?.from && opts?.liveSummary?.dateRange?.to) {
    const clampedRange = clampPeriodToKuwaitToday({
      from: opts.liveSummary.dateRange.from,
      to: opts.liveSummary.dateRange.to,
    })
    const labels = formatInclusiveIsoRangeLabels(clampedRange.from, clampedRange.to)
    return { fromIso: clampedRange.from, toInclusiveIso: clampedRange.to, ...labels }
  }

  const kwCtx = getKuwaitTimeContext()
  const anchorIso = kwCtx.yesterdayIso
  const fromIso =
    period === 'today'
      ? anchorIso
      : period === 'week'
        ? shiftIsoDateDays(anchorIso, -6)
        : period === 'year'
          ? `${anchorIso.slice(0, 4)}-01-01`
          : `${anchorIso.slice(0, 7)}-01`
  const labels = formatInclusiveIsoRangeLabels(fromIso, anchorIso)
  return { fromIso, toInclusiveIso: anchorIso, ...labels }
}

export function getKuwaitSliceLabel(s: KuwaitSlice, isAr: boolean): string {
  const opt = GLOBAL_KUWAIT_SLICE_OPTIONS.find((x) => x.id === s) ?? GLOBAL_KUWAIT_SLICE_OPTIONS[0]
  return isAr ? opt.ar : opt.en
}

export function getProfitLensLabel(l: ProfitLens, isAr: boolean): string {
  const opt = GLOBAL_PROFIT_LENS_OPTIONS.find((x) => x.id === l) ?? GLOBAL_PROFIT_LENS_OPTIONS[0]
  return isAr ? opt.ar : opt.en
}

export function getBrandLabel(b: GlobalBrand, isAr: boolean): string {
  const opt = GLOBAL_BRAND_OPTIONS.find((x) => x.id === b) ?? GLOBAL_BRAND_OPTIONS[0]
  return isAr ? opt.ar : opt.en
}

export function getBranchLabel(b: GlobalBranch, isAr: boolean): string {
  const opt = GLOBAL_BRANCH_OPTIONS.find((x) => x.id === b) ?? GLOBAL_BRANCH_OPTIONS[0]
  return isAr ? opt.ar : opt.en
}

export function getChannelLabel(c: GlobalChannel, isAr: boolean): string {
  const opt = GLOBAL_CHANNEL_OPTIONS.find((x) => x.id === c) ?? GLOBAL_CHANNEL_OPTIONS[0]
  return isAr ? opt.ar : opt.en
}

export function buildFilterSubtitle(
  f: GlobalFilters,
  isAr: boolean,
  liveSummary?: OdooLiveSummary | null,
): string {
  const rawParts = [getBrandLabel(f.brand, isAr), getBranchLabel(f.branch, isAr)]
  if (f.channel !== 'all') rawParts.push(getChannelLabel(f.channel, isAr))
  const periodWindow = formatPeriodCalendarWindow(f.period ?? 'month', {
    customFrom: f.customFrom,
    customTo: f.customTo,
    liveSummary,
  })
  const cleanPeriodBase = getPeriodLabel(f.period ?? 'month', isAr).replace(/\s*📅$/, '')
  const windowLabel = isAr ? periodWindow.labelAr : periodWindow.labelEn
  rawParts.push(`${cleanPeriodBase} (${windowLabel})`)
  const ks = f.kuwaitSlice ?? 'all'
  const ln = f.lens ?? 'all'
  if (ks !== 'all') rawParts.push(getKuwaitSliceLabel(ks, isAr))
  const overlapsSliceAndLens =
    (ks === 'quiet-hours' && ln === 'quiet-hours') ||
    ((ks === 'payday' || ks === 'weekend') && ln === 'payday-weekend')
  if (ln !== 'all' && !overlapsSliceAndLens) {
    rawParts.push(getProfitLensLabel(ln, isAr))
  }
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const seg of rawParts) {
    const key = seg.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(seg)
  }
  return deduped.join(' • ')
}

/**
 * Legacy helper retained for type compatibility — returns zeros instead of static CUBE30 synthetic pocket margins.
 */
export function computeWeightedCellMargin(
  _filterFn: (b: BrandKey, l: BranchKey, c: ChannelKey) => boolean,
): {
  salesKwd: number
  netPocketKwd: number
  weightedNetPct: number
} {
  return { salesKwd: 0, netPocketKwd: 0, weightedNetPct: 0 }
}

/**
 * Checks whether a brand and branch filter selection is valid.
 * Without static CUBE30 assumptions, all approved 6 brands × 7 branches are selectable and evaluated against live Odoo data.
 */
export function isBrandBranchCompatible(brand: GlobalBrand, branch: GlobalBranch): boolean {
  if (brand === 'all' || branch === 'all') return true
  return (
    (APPROVED_BRAND_IDS as readonly string[]).includes(brand) &&
    ((APPROVED_BRANCH_IDS as readonly string[]).includes(branch) ||
      (COMPANY_GROUP_BRANCH_IDS as readonly string[]).includes(branch))
  )
}

export interface SimplePlayView {
  play: JourneyPlay
  id: string
  stage: JourneyPlay['stage']
  titleAr: string
  titleEn: string
  problemAr: string
  problemEn: string
  solutionAr: string
  solutionEn: string
  periodBenefitKwd: number
  monthlyBenefitKwd: number
  annualBenefitKwd: number
  periodLabelAr: string
  periodLabelEn: string
  brands: readonly BrandKey[] | 'all'
  branches: readonly BranchKey[] | 'all'
  channels: readonly ChannelKey[] | 'all'
  scopeLabelAr: string
  scopeLabelEn: string
  mergedIds: readonly string[]
  cfoRealism: CfoRealismProfile
  tiersMonthly: { conservativeKwd: number; realisticKwd: number; stretchKwd: number }
  tiersPeriod: { conservativeKwd: number; realisticKwd: number; stretchKwd: number }
}

export type SummaryCardAction =
  | 'stage-procurement'
  | 'stage-opex'
  | 'href-radar'
  | 'chart-branches'
  | 'href-menu'
  | 'lens-quiet'

export interface SummaryCardData {
  id: string
  num: number
  titleAr: string
  titleEn: string
  valueAr: string
  valueEn: string
  descAr: string
  descEn: string
  accent: 'emerald' | 'sky' | 'amber' | 'rose'
  statusDot: HealthDot
  statusLabelAr: string
  statusLabelEn: string
  badgeAr?: string
  badgeEn?: string
  periodLabelAr?: string
  periodLabelEn?: string
  sourceLabelAr?: string
  sourceLabelEn?: string
  ctaAr: string
  ctaEn: string
  action: SummaryCardAction
  targetStage?: JourneyPlay['stage'] | 'all'
  href: string
}

export interface WorkspaceLedgerAccounting {
  available: boolean
  completeAccrualPosted: boolean
  glIncomplete: boolean
  glWarningAr: string | null
  aggregatorCommissionUnposted: boolean
  aggregatorCommissionDisplayAr: string | null
  from: string
  to: string
  sourceModel: 'account.move.line'
  lineCount: number
  totalRevenueKwd: number | null
  cogsKwd: number | null
  deliveryCommissionsKwd: number | null
  platformSubscriptionKwd: number | null
  thirdPartyDeliveryKwd: number | null
  commissionAccounts: { code: string; name: string; amountKwd: number }[]
  otherOpexAndDepreciationKwd: number | null
  beforeRentKwd: number | null
  operatingProfitKwd: number | null
  cogsPct: number | null
  deliveryCommPct: number | null
  opexRentDeprPct: number | null
  beforeRentPct: number | null
  netProfitPct: number | null
  /** GL closed-through date (Odoo `res.company` lock dates). */
  glClosedThroughDate?: string | null
  /** True when Net Profit / Net Margin are hidden because the window includes an open GL month. */
  netProfitWithheld?: boolean
  netProfitWithheldReasonAr?: string
  netProfitWithheldReasonEn?: string
  unavailableReasonAr: string | null
  unavailableReasonEn: string | null
  /** True when a brand, branch, channel, or slice filter hides the company ledger. */
  glScopeLimited: boolean
  revenueAccounts?: {
    code: string
    name: string
    accountType: 'income' | 'income_other'
    amountKwd: number
  }[]
}

export interface WorkspaceReceivablesMeta {
  unavailable?: boolean
  /**
   * Phase 5 · Item 2: true until per-customer due-date aging is verified. While pending, every
   * amount below is `null` and account/aging lists are empty — only line counts remain.
   */
  pendingReconciliation: boolean
  openReceivableKwd: number | null
  grossPositiveReceivableKwd: number | null
  creditClearingOffsetKwd: number | null
  unreconciledLineCount: number
  posClearingLinesCount: number
  platformAndCorporateLinesCount: number
  fromDate: string
  toDate: string
  latestMaturityDate: string | null
  maturityStatusAr: string
  maturityStatusEn: string
  openLinesExplanationAr: string
  openLinesExplanationEn: string
  sourceLabelAr: string
  sourceLabelEn: string
  reconciliationFormulaAr: string
  reconciliationFormulaEn: string
  byAccount: OdooReceivableAccountRow[]
  agingBuckets: OdooReceivableAgingBucket[]
  /** Positive open residuals (owed to us); `null` when the payload has no due-date aging. */
  openDebitsKwd: number | null
  /** Negative open residuals (unmatched payments, clearing credits), shown as one separate line. */
  unappliedCreditsKwd: number | null
  agingHiddenReasonAr: string | null
  agingHiddenReasonEn: string | null
}

export interface FeryalSimpleNote {
  id: string
  titleAr: string
  titleEn: string
  summaryAr: string
  summaryEn: string
  benefitAr: string
  benefitEn: string
  promptAr: string
  promptEn: string
  tone: 'emerald' | 'amber' | 'rose' | 'sky'
}

export interface PeerDiagnosticStrip {
  activeWeightedNetPct: number
  groupWeightedNetPct: number
  deltaPctPoints: number
  showPeerComparison: boolean
  tone: 'emerald' | 'amber' | 'rose'
  benchmarkAr: string
  benchmarkEn: string
  rootCauseAr: string
  rootCauseEn: string
}

export interface GlobalWorkspaceSlice {
  filters: Required<GlobalFilters>
  isFiltered: boolean
  odooConnected: boolean
  noData: boolean
  noDataMessageAr: string | null
  partial: boolean
  unavailableSections: string[]
  warningAr: string | null
  warningEn: string | null
  sectionUnavailable: boolean
  nullableSalesKwd: number | null
  nullableOrders: number | null
  nullableAovKwd: number | null
  /** Basis of the brand headline: `product-lines` is not reconciled to order net (see gap). */
  brandBasis: 'order-level' | 'order-allocated' | 'product-lines'
  brandBasisGapKwd: number | null
  lastSyncAt: string | null
  isStale24h: boolean
  odooCompanyId: number | null
  dateRange: { from: string; to: string }
  unattributedSalesKwd: number
  unattributedOrders: number
  unattributedBranch: OdooLiveSummary['unattributedBranch'] | null
  glIncomplete: boolean
  glWarningAr: string | null
  aggregatorCommissionUnposted: boolean
  aggregatorCommissionDisplayAr: string | null
  isTodayFallback: boolean
  todayFallbackDate: string | null
  lastSyncedAt: string | null
  subtitleAr: string
  subtitleEn: string
  periodCalendarWindowAr: string
  periodCalendarWindowEn: string
  periodRangeLabelAr: string
  periodRangeLabelEn: string
  periodDays: number
  salesKwd: number
  orders: number
  aovKwd: number
  weightedNetPct: number
  groupWeightedNetPct: number
  periodScale: number
  dimensionShare: number
  totalScale: number
  accounting: WorkspaceLedgerAccounting
  receivables: WorkspaceReceivablesMeta
  per10: {
    food10: number
    delivery10: number
    opexRent10: number
    netPocket10: number
  }
  cascadingOptions: {
    brands: FilterOption<GlobalBrand>[]
    branches: FilterOption<GlobalBranch>[]
    channels: FilterOption<GlobalChannel>[]
  }
  diagnosticStrip: PeerDiagnosticStrip
  summaryCards: SummaryCardData[]
  plays: SimplePlayView[]
  totalPlaysBenefitPeriodKwd: number
  totalPlaysBenefitMonthlyKwd: number
  feryalNotes: FeryalSimpleNote[]
  feryalContextAr: string
  feryalContextEn: string
}

function normalizeIsoRange(
  fromRaw?: string,
  toRaw?: string,
): { from: string; to: string; days: number } {
  const isoRe = /^\d{4}-\d{2}-\d{2}$/
  let f = fromRaw && isoRe.test(fromRaw) ? fromRaw : DEFAULT_CUSTOM_FROM
  let t = toRaw && isoRe.test(toRaw) ? toRaw : DEFAULT_CUSTOM_TO
  if (f > t) {
    const tmp = f
    f = t
    t = tmp
  }
  const msFrom = Date.parse(`${f}T00:00:00Z`)
  const msTo = Date.parse(`${t}T00:00:00Z`)
  const rawDays =
    Number.isFinite(msFrom) && Number.isFinite(msTo)
      ? Math.round((msTo - msFrom) / 86_400_000) + 1
      : 30
  return { from: f, to: t, days: Math.min(730, Math.max(1, rawDays)) }
}

const fKwd = (v: number, ar: boolean): string => {
  const clean = Number.isFinite(v) ? v : 0
  const rounded = clean >= 100 ? Math.round(clean).toLocaleString('en-US') : clean.toFixed(1)
  return ar ? `${rounded} د.ك` : `${rounded} KWD`
}

function computeLiveKuwaitSliceMultipliers(
  slice: KuwaitSlice,
  period: GlobalPeriod,
  periodDays: number,
  liveSummary?: OdooLiveSummary | null,
): { netMult: number; ordMult: number; slicedDays: number } {
  if (slice === 'all') {
    return { netMult: 1, ordMult: 1, slicedDays: periodDays }
  }
  if (!liveSummary || liveSummary.connected !== true) {
    return { netMult: 0, ordMult: 0, slicedDays: periodDays }
  }

  if (slice === 'quiet-hours') {
    const hourly = liveSummary.hourlySeries ?? []
    const totalNet = hourly.reduce((s, h) => s + safeNum(h.netKwd), 0)
    const totalOrd = hourly.reduce((s, h) => s + safeNum(h.orders), 0)
    if (totalNet <= 0) return { netMult: 0, ordMult: 0, slicedDays: periodDays }
    const quietRows = hourly.filter((h) => h.hour >= 15 && h.hour <= 17)
    const qNet = quietRows.reduce((s, h) => s + safeNum(h.netKwd), 0)
    const qOrd = quietRows.reduce((s, h) => s + safeNum(h.orders), 0)
    return {
      netMult: safeDiv(qNet, totalNet, 0),
      ordMult: safeDiv(qOrd, totalOrd, 0),
      slicedDays: periodDays,
    }
  }

  const daily = (liveSummary.dailySeries ?? []).filter((d) => d.orders > 0 && d.netKwd > 0)
  const totalNet = daily.reduce((s, d) => s + d.netKwd, 0)
  const totalOrd = daily.reduce((s, d) => s + d.orders, 0)
  if (daily.length === 0 || totalNet <= 0) {
    return { netMult: 0, ordMult: 0, slicedDays: periodDays }
  }

  const matching = daily.filter((d) => {
    const dom = Number(d.day.slice(8, 10))
    const dow = new Date(`${d.day}T12:00:00Z`).getUTCDay()
    if (slice === 'payday') return dom >= 20 && dom <= 28
    if (slice === 'mid-month') return dom >= 10 && dom <= 19
    if (slice === 'weekend') return dow === 4 || dow === 5 || dow === 6
    return true
  })

  if (matching.length === 0) {
    return { netMult: 0, ordMult: 0, slicedDays: 0 }
  }

  const mNet = matching.reduce((s, r) => s + r.netKwd, 0)
  const mOrd = matching.reduce((s, r) => s + r.orders, 0)

  if (period === 'today') {
    const avgNet = totalNet / daily.length
    const avgOrd = totalOrd / daily.length
    return {
      netMult: safeDiv(mNet / matching.length, avgNet, 0),
      ordMult: safeDiv(mOrd / matching.length, avgOrd, 0),
      slicedDays: 1,
    }
  }

  const shareDays = Math.max(1, Math.round(periodDays * (matching.length / daily.length)))
  return {
    netMult: safeDiv(mNet, totalNet, 0),
    ordMult: safeDiv(mOrd, totalOrd, 0),
    slicedDays: shareDays,
  }
}

function buildEmptyReceivables(fromIso: string, toIso: string): WorkspaceReceivablesMeta {
  return {
    unavailable: false,
    pendingReconciliation: false,
    openReceivableKwd: 0,
    grossPositiveReceivableKwd: 0,
    creditClearingOffsetKwd: 0,
    unreconciledLineCount: 0,
    posClearingLinesCount: 0,
    platformAndCorporateLinesCount: 0,
    fromDate: fromIso,
    toDate: toIso,
    latestMaturityDate: null,
    maturityStatusAr: 'لا توجد بيانات ذمم من Odoo لهذه الفترة',
    maturityStatusEn: 'No Odoo receivable data for this period',
    openLinesExplanationAr: 'لا توجد بيانات من Odoo لهذه الفترة',
    openLinesExplanationEn: 'No Odoo data for this period',
    sourceLabelAr: 'أودو 17 — قيود دفتر الأستاذ للذمم المدينة غير المسوّاة',
    sourceLabelEn: 'Odoo 17 — Receivable Ledger (account.move.line)',
    reconciliationFormulaAr: 'لا توجد بيانات من Odoo لهذه الفترة',
    reconciliationFormulaEn: 'No Odoo data for this period',
    byAccount: [],
    agingBuckets: [],
    openDebitsKwd: null,
    unappliedCreditsKwd: null,
    agingHiddenReasonAr: null,
    agingHiddenReasonEn: null,
  }
}

function buildUnavailableReceivables(fromIso: string, toIso: string): WorkspaceReceivablesMeta {
  return {
    unavailable: true,
    pendingReconciliation: false,
    openReceivableKwd: 0,
    grossPositiveReceivableKwd: 0,
    creditClearingOffsetKwd: 0,
    unreconciledLineCount: 0,
    posClearingLinesCount: 0,
    platformAndCorporateLinesCount: 0,
    fromDate: fromIso,
    toDate: toIso,
    latestMaturityDate: null,
    maturityStatusAr: 'غير متاح',
    maturityStatusEn: '—',
    openLinesExplanationAr: 'غير متاح',
    openLinesExplanationEn: '—',
    sourceLabelAr: 'أودو 17 — قيود دفتر الأستاذ للذمم المدينة غير المسوّاة',
    sourceLabelEn: 'Odoo 17 — Receivable Ledger (account.move.line)',
    reconciliationFormulaAr: 'غير متاح',
    reconciliationFormulaEn: '—',
    byAccount: [],
    agingBuckets: [],
    openDebitsKwd: null,
    unappliedCreditsKwd: null,
    agingHiddenReasonAr: null,
    agingHiddenReasonEn: null,
  }
}

/**
 * Phase 5 · Item 2: until per-customer due-date aging is verified, strip every receivable amount
 * (net, gross, credits, per-account rows, aging buckets, amount-bearing explanation/formula text).
 * Unreconciled line counts, dates and source labels are kept.
 */
export function applyReceivablesExecutivePolicy(
  r: WorkspaceReceivablesMeta,
  verified: boolean = PER_CUSTOMER_DUE_DATE_AGING_VERIFIED,
): WorkspaceReceivablesMeta {
  if (r.unavailable || canShowReceivableAmounts(r, verified)) return r
  return {
    ...r,
    pendingReconciliation: true,
    openReceivableKwd: null,
    grossPositiveReceivableKwd: null,
    creditClearingOffsetKwd: null,
    byAccount: [],
    agingBuckets: [],
    openDebitsKwd: null,
    unappliedCreditsKwd: null,
    agingHiddenReasonAr: null,
    agingHiddenReasonEn: null,
    maturityStatusAr: RECEIVABLES_PENDING_STATUS.ar,
    maturityStatusEn: RECEIVABLES_PENDING_STATUS.en,
    openLinesExplanationAr: RECEIVABLES_PENDING_DETAIL.ar,
    openLinesExplanationEn: RECEIVABLES_PENDING_DETAIL.en,
    reconciliationFormulaAr: RECEIVABLES_PENDING_STATUS.ar,
    reconciliationFormulaEn: RECEIVABLES_PENDING_STATUS.en,
  }
}

function buildSummaryCards(params: {
  odooConnected: boolean
  activeIsoWindowAr: string
  activeIsoWindowEn: string
  receivables: WorkspaceReceivablesMeta
  deliveryDuesKwd: number | null
  opexActualKwd: number | null
  quietHoursActualKwd: number | null
  glWarningAr: string | null
}): SummaryCardData[] {
  const {
    odooConnected,
    activeIsoWindowAr,
    activeIsoWindowEn,
    receivables,
    deliveryDuesKwd,
    opexActualKwd,
    quietHoursActualKwd,
    glWarningAr,
  } = params

  const disconnectedLabelAr = 'لا توجد بيانات من Odoo لهذه الفترة'
  const disconnectedLabelEn = 'No Odoo data for this period'

  return [
    {
      id: 'procurement-kitchen',
      num: 1,
      titleAr: 'المشتريات والمطبخ',
      titleEn: 'Buying & Kitchen',
      valueAr: odooConnected ? 'غير مربوط بمصدر' : disconnectedLabelAr,
      valueEn: odooConnected ? 'Unlinked BoM Source' : disconnectedLabelEn,
      descAr: odooConnected
        ? 'حركات المخزن والتالف الفعلي متاحة في شاشة سلسلة المخزن بدون نسب هدر تقديرية.'
        : disconnectedLabelAr,
      descEn: odooConnected
        ? 'Actual stock moves & scrap are shown in Warehouse Chain without synthetic trim estimates.'
        : disconnectedLabelEn,
      periodLabelAr: activeIsoWindowAr,
      periodLabelEn: activeIsoWindowEn,
      sourceLabelAr: 'أودو 17 — stock.move / stock.scrap',
      sourceLabelEn: 'Odoo 17 (stock.move + stock.scrap)',
      accent: 'amber',
      statusDot: '🟠',
      statusLabelAr: odooConnected ? 'حركات فعلية فقط' : 'غير متصل',
      statusLabelEn: odooConnected ? 'Actual Moves Only' : 'Disconnected',
      ctaAr: 'فحص المخزن ↗',
      ctaEn: 'Warehouse Chain ↗',
      action: 'stage-procurement',
      targetStage: 'procurement',
      href: '/erp/warehouse-chain',
    },
    {
      id: 'expenses-maint',
      num: 2,
      titleAr: 'الفواتير والصيانة',
      titleEn: 'Monthly Bills',
      valueAr:
        !odooConnected
          ? disconnectedLabelAr
          : opexActualKwd !== null
            ? fKwd(opexActualKwd, true)
            : (glWarningAr ?? 'قيود غير مكتملة لهذه الفترة'),
      valueEn:
        !odooConnected
          ? disconnectedLabelEn
          : opexActualKwd !== null
            ? fKwd(opexActualKwd, false)
            : 'Incomplete GL entries for this period',
      descAr:
        !odooConnected
          ? disconnectedLabelAr
          : opexActualKwd !== null
            ? 'إجمالي المصروفات التشغيلية والإهلاك المرحّلة فعلياً في دفتر الأستاذ العام.'
            : 'قيود المصروفات والإهلاك غير مكتملة لهذه الفترة في دفتر الأستاذ العام.',
      descEn:
        !odooConnected
          ? disconnectedLabelEn
          : opexActualKwd !== null
            ? 'Actual posted operating expenses & depreciation in Odoo General Ledger.'
            : 'Operating expense & depreciation entries are incomplete for this period.',
      periodLabelAr: activeIsoWindowAr,
      periodLabelEn: activeIsoWindowEn,
      sourceLabelAr: 'أودو 17 — دفتر الأستاذ العام (account.move.line)',
      sourceLabelEn: 'Odoo 17 (account.move.line · Opex)',
      accent: opexActualKwd !== null ? 'sky' : 'amber',
      statusDot: opexActualKwd !== null ? '🟢' : '🟠',
      statusLabelAr: opexActualKwd !== null ? 'قيود مرحّلة' : 'قيود غير مكتملة لهذه الفترة',
      statusLabelEn: opexActualKwd !== null ? 'Posted GL' : 'Incomplete GL',
      ctaAr: 'تفاصيل المصاريف ↗',
      ctaEn: 'Monthly Bills ↗',
      action: 'stage-opex',
      targetStage: 'opex',
      href: '/erp/cost-intelligence',
    },
    {
      id: 'delivery-dues',
      num: 3,
      titleAr: 'ذمم منصات التوصيل المتراكمة',
      titleEn: 'Cumulative Aggregator Receivables',
      valueAr: !odooConnected
        ? disconnectedLabelAr
        : receivables.pendingReconciliation
          ? RECEIVABLES_PENDING_STATUS.ar
          : receivables.unavailable || deliveryDuesKwd === null
            ? 'غير متاح'
            : fKwd(deliveryDuesKwd, true),
      valueEn: !odooConnected
        ? disconnectedLabelEn
        : receivables.pendingReconciliation
          ? RECEIVABLES_PENDING_STATUS.en
          : receivables.unavailable || deliveryDuesKwd === null
            ? '—'
            : fKwd(deliveryDuesKwd, false),
      descAr: !odooConnected
        ? disconnectedLabelAr
        : receivables.pendingReconciliation
          ? RECEIVABLES_PENDING_DETAIL.ar
          : receivables.unavailable || deliveryDuesKwd === null
          ? 'بعض الأرقام غير متاحة الآن — تعذّر جلب أرصدة الذمم المدينة مؤقتاً.'
          : `الفترة: من ${receivables.fromDate} إلى ${receivables.toDate} • ${receivables.reconciliationFormulaAr}.`,
      descEn: !odooConnected
        ? disconnectedLabelEn
        : receivables.pendingReconciliation
          ? RECEIVABLES_PENDING_DETAIL.en
          : receivables.unavailable || deliveryDuesKwd === null
          ? 'Some figures are temporarily unavailable — could not retrieve open receivables.'
          : `Period: ${receivables.fromDate} to ${receivables.toDate} • ${receivables.reconciliationFormulaEn}.`,
      periodLabelAr: `من ${receivables.fromDate} إلى ${receivables.toDate}`,
      periodLabelEn: `${receivables.fromDate} to ${receivables.toDate}`,
      sourceLabelAr: receivables.sourceLabelAr,
      sourceLabelEn: receivables.sourceLabelEn,
      accent: 'amber',
      statusDot: '🟠',
      statusLabelAr: !odooConnected
        ? 'غير متصل'
        : receivables.pendingReconciliation
          ? RECEIVABLES_PENDING_STATUS.ar
          : receivables.unavailable || deliveryDuesKwd === null
          ? 'غير متاح'
          : 'رصيد فعلي من أودو',
      statusLabelEn: !odooConnected
        ? 'Disconnected'
        : receivables.pendingReconciliation
          ? RECEIVABLES_PENDING_STATUS.en
          : receivables.unavailable || deliveryDuesKwd === null
          ? 'Unavailable'
          : 'Odoo 17 AR',
      badgeAr: 'رصيد تراكمي',
      badgeEn: 'Cumulative Balance',
      ctaAr: 'تفاصيل الذمم والمطابقة ↗',
      ctaEn: 'Receivables Ledger ↗',
      action: 'href-radar',
      href: '/erp/receivables',
    },
    {
      id: 'menu-prices',
      num: 5,
      titleAr: 'أسعار المينيو والوجبات',
      titleEn: 'Menu Sales Mix',
      valueAr: odooConnected ? 'بيانات فعلية' : disconnectedLabelAr,
      valueEn: odooConnected ? 'Actual POS Mix' : disconnectedLabelEn,
      descAr: 'مبيعات وخصومات الأصناف الفعلية من بنود نقاط البيع في أودو (pos.order.line).',
      descEn: 'Actual item sales, quantities, and discounts from Odoo POS lines (pos.order.line).',
      periodLabelAr: activeIsoWindowAr,
      periodLabelEn: activeIsoWindowEn,
      sourceLabelAr: 'أودو 17 — بنود نقاط البيع (pos.order.line)',
      sourceLabelEn: 'Odoo 17 (pos.order.line)',
      accent: 'sky',
      statusDot: odooConnected ? '🟢' : '🟠',
      statusLabelAr: odooConnected ? 'مبيعات فعلية' : 'غير متصل',
      statusLabelEn: odooConnected ? 'Actual POS Lines' : 'Disconnected',
      ctaAr: 'المينيو والأصناف ↗',
      ctaEn: 'Menu Analytics ↗',
      action: 'href-menu',
      href: '/erp/cores',
    },
    {
      id: 'kitchen-capacity',
      num: 6,
      titleAr: 'مبيعات الساعات الهادئة (3–6 م)',
      titleEn: 'Quiet Hours Sales (3–6 PM)',
      valueAr: !odooConnected
        ? disconnectedLabelAr
        : quietHoursActualKwd === null
          ? 'غير متاح'
          : fKwd(quietHoursActualKwd, true),
      valueEn: !odooConnected
        ? disconnectedLabelEn
        : quietHoursActualKwd === null
          ? '—'
          : fKwd(quietHoursActualKwd, false),
      descAr: 'صافي المبيعات الفعلية المسجلة بين 3:00 و6:00 مساءً في نقاط البيع بدون تقديرات افتراضية.',
      descEn: 'Actual POS net sales recorded between 3:00 PM and 6:00 PM with zero synthetic estimates.',
      periodLabelAr: activeIsoWindowAr,
      periodLabelEn: activeIsoWindowEn,
      sourceLabelAr: 'أودو 17 — إيصالات نقاط البيع (pos.order)',
      sourceLabelEn: 'Odoo 17 (pos.order · 15:00–17:59)',
      accent: odooConnected && quietHoursActualKwd !== null ? 'sky' : 'amber',
      statusDot: odooConnected && quietHoursActualKwd !== null ? '🟢' : '🟠',
      statusLabelAr: !odooConnected
        ? 'غير متصل'
        : quietHoursActualKwd === null
          ? 'غير متاح'
          : 'قراءة فعلية',
      statusLabelEn: !odooConnected
        ? 'Disconnected'
        : quietHoursActualKwd === null
          ? 'Unavailable'
          : 'Actual Telemetry',
      ctaAr: 'مقارنة الساعات ↗',
      ctaEn: 'Hourly Comparison ↗',
      action: 'lens-quiet',
      targetStage: 'operations',
      href: '/erp/weekday-comparison',
    },
  ]
}

export function computeGlobalWorkspace(
  rawFilters: GlobalFilters,
  liveSummary?: OdooLiveSummary | null,
  pathname?: string | null,
): GlobalWorkspaceSlice {
  const customNorm = normalizeIsoRange(rawFilters.customFrom, rawFilters.customTo)
  const enforceHomeOnlyLens = Boolean(pathname && pathname !== '/erp')
  const filters: Required<GlobalFilters> = {
    period: rawFilters.period ?? 'month',
    customFrom: customNorm.from,
    customTo: customNorm.to,
    kuwaitSlice: enforceHomeOnlyLens ? 'all' : (rawFilters.kuwaitSlice ?? 'all'),
    brand: rawFilters.brand ?? 'all',
    branch: rawFilters.branch ?? 'all',
    channel: rawFilters.channel ?? 'all',
    lens: enforceHomeOnlyLens ? 'all' : (rawFilters.lens ?? 'all'),
  }

  const resolvedPeriodWindow = formatPeriodCalendarWindow(filters.period, {
    customFrom: filters.customFrom,
    customTo: filters.customTo,
    liveSummary,
  })
  const periodCalendarWindowAr = resolvedPeriodWindow.labelAr
  const periodCalendarWindowEn = resolvedPeriodWindow.labelEn
  const activeIsoWindowAr = `من ${resolvedPeriodWindow.fromIso} إلى ${resolvedPeriodWindow.toInclusiveIso}`
  const activeIsoWindowEn = `${resolvedPeriodWindow.fromIso} to ${resolvedPeriodWindow.toInclusiveIso}`

  const monthWindow = formatPeriodCalendarWindow('month', { liveSummary })
  const liveMonthDays = liveSummary?.buckets?.month?.days
  const defaultDays: Record<GlobalPeriod, number> = {
    today: 1,
    week: 7,
    month:
      typeof liveMonthDays === 'number' && liveMonthDays > 0
        ? liveMonthDays
        : inclusiveIsoDayCount(monthWindow.fromIso, monthWindow.toInclusiveIso),
    year: 315,
    custom: customNorm.days,
  }

  const odooConnected = Boolean(
    liveSummary &&
      liveSummary.connected === true &&
      liveSummary.sourceMode !== 'disconnected',
  )

  if (!odooConnected || !liveSummary) {
    const noDataMessageAr = liveSummary?.messageAr ?? 'لا توجد بيانات من Odoo لهذه الفترة'
    const subtitleAr = buildFilterSubtitle(filters, true, liveSummary)
    const subtitleEn = buildFilterSubtitle(filters, false, liveSummary)
    const emptyRec = buildEmptyReceivables(
      resolvedPeriodWindow.fromIso,
      resolvedPeriodWindow.toInclusiveIso,
    )
    const disconnectedAccounting: WorkspaceLedgerAccounting = {
      available: false,
      completeAccrualPosted: false,
      glIncomplete: true,
      glWarningAr: noDataMessageAr,
      aggregatorCommissionUnposted: true,
      aggregatorCommissionDisplayAr: 'غير مُرحَّل بعد',
      from: resolvedPeriodWindow.fromIso,
      to: resolvedPeriodWindow.toInclusiveIso,
      sourceModel: 'account.move.line',
      lineCount: 0,
      totalRevenueKwd: null,
      cogsKwd: null,
      deliveryCommissionsKwd: null,
      platformSubscriptionKwd: null,
      thirdPartyDeliveryKwd: null,
      commissionAccounts: [],
      otherOpexAndDepreciationKwd: null,
      beforeRentKwd: null,
      operatingProfitKwd: null,
      cogsPct: null,
      deliveryCommPct: null,
      opexRentDeprPct: null,
      beforeRentPct: null,
      netProfitPct: null,
      unavailableReasonAr: noDataMessageAr,
      unavailableReasonEn: 'No Odoo data for this period',
      glScopeLimited: false,
    }

    const cascadingBrands: FilterOption<GlobalBrand>[] = GLOBAL_BRAND_OPTIONS.map((opt) => ({
      ...opt,
      healthDot: '🔴' as const,
      weightedNetPct: undefined,
      salesKwd: 0,
      available: true,
    }))
    const cascadingBranches: FilterOption<GlobalBranch>[] = GLOBAL_BRANCH_OPTIONS.map((opt) => ({
      ...opt,
      healthDot: '🔴' as const,
      weightedNetPct: undefined,
      salesKwd: 0,
      available: true,
    }))
    const cascadingChannels: FilterOption<GlobalChannel>[] = GLOBAL_CHANNEL_OPTIONS.map((opt) => ({
      ...opt,
      healthDot: '🔴' as const,
      weightedNetPct: undefined,
      salesKwd: 0,
      available: true,
    }))

    return {
      filters,
      isFiltered: isNonDefaultFilter(filters),
      odooConnected: false,
      noData: true,
      noDataMessageAr,
      partial: false,
      unavailableSections: [],
      warningAr: null,
      warningEn: null,
      sectionUnavailable: false,
      nullableSalesKwd: 0,
      nullableOrders: 0,
      nullableAovKwd: 0,
      brandBasis: 'order-level',
      brandBasisGapKwd: 0,
      lastSyncAt: liveSummary?.lastSyncAt ?? null,
      isStale24h: Boolean(liveSummary?.isStale24h),
      odooCompanyId: liveSummary?.odooCompanyId ?? null,
      dateRange: liveSummary?.dateRange ?? {
        from: resolvedPeriodWindow.fromIso,
        to: resolvedPeriodWindow.toInclusiveIso,
      },
      unattributedSalesKwd: 0,
      unattributedOrders: 0,
      unattributedBranch: null,
      glIncomplete: true,
      glWarningAr: noDataMessageAr,
      aggregatorCommissionUnposted: true,
      aggregatorCommissionDisplayAr: 'غير مُرحَّل بعد',
      isTodayFallback: false,
      todayFallbackDate: null,
      lastSyncedAt: null,
      subtitleAr,
      subtitleEn,
      periodCalendarWindowAr,
      periodCalendarWindowEn,
      periodRangeLabelAr: periodCalendarWindowAr,
      periodRangeLabelEn: periodCalendarWindowEn,
      periodDays: defaultDays[filters.period],
      salesKwd: 0,
      orders: 0,
      aovKwd: 0,
      weightedNetPct: 0,
      groupWeightedNetPct: 0,
      periodScale: 0,
      dimensionShare: 0,
      totalScale: 0,
      accounting: disconnectedAccounting,
      receivables: emptyRec,
      per10: { food10: 0, delivery10: 0, opexRent10: 0, netPocket10: 0 },
      cascadingOptions: {
        brands: cascadingBrands,
        branches: cascadingBranches,
        channels: cascadingChannels,
      },
      diagnosticStrip: {
        activeWeightedNetPct: 0,
        groupWeightedNetPct: 0,
        deltaPctPoints: 0,
        showPeerComparison: false,
        tone: 'rose',
        benchmarkAr: noDataMessageAr,
        benchmarkEn: 'No Odoo data for this period',
        rootCauseAr: noDataMessageAr,
        rootCauseEn: 'Odoo 17 connection is not configured or unreachable.',
      },
      summaryCards: buildSummaryCards({
        odooConnected: false,
        activeIsoWindowAr,
        activeIsoWindowEn,
        receivables: emptyRec,
        deliveryDuesKwd: 0,
        opexActualKwd: null,
        quietHoursActualKwd: 0,
        glWarningAr: noDataMessageAr,
      }),
      plays: [],
      totalPlaysBenefitPeriodKwd: 0,
      totalPlaysBenefitMonthlyKwd: 0,
      feryalNotes: [],
      feryalContextAr: `[${noDataMessageAr}]`,
      feryalContextEn: '[No Odoo data for this period]',
    }
  }

  // -------------------------------------------------------------------------
  // Connected Live Odoo 17 Computation (Zero Static Fallbacks)
  // -------------------------------------------------------------------------
  const monthBkt = liveSummary.buckets?.month

  const clampedCustomForBucket = clampPeriodToKuwaitToday({
    from: filters.customFrom,
    to: filters.customTo,
  })
  const customBucketMatch =
    filters.period === 'custom' ? resolveSummaryBucket(filters, liveSummary) : undefined

  const bucketKey: OdooPeriodBucketKey | undefined =
    filters.period === 'custom' ? undefined : filters.period
  const activeBkt: OdooBucketSummary | undefined =
    filters.period === 'custom'
      ? customBucketMatch
      : bucketKey
        ? liveSummary.buckets?.[bucketKey]
        : undefined

  const isTodayFallback = Boolean(filters.period === 'today' && activeBkt?.isLatestOperationalDay)
  const todayFallbackDate = isTodayFallback ? (activeBkt?.from ?? null) : null

  const monthGroupSales = safeNum(monthBkt?.totals?.restaurantNetKwd)
  const rawPeriodDays = safeNum(activeBkt?.days, defaultDays[filters.period])

  // Custom range fallback strictly over live dailySeries days within [from..to] (ZERO extrapolation!)
  const customLiveDaysTotals = (() => {
    if (filters.period !== 'custom' || customBucketMatch) return null
    const matchingDays = (liveSummary.dailySeries ?? []).filter(
      (d) => d.day >= clampedCustomForBucket.from && d.day <= clampedCustomForBucket.to,
    )
    const net = matchingDays.reduce((s, d) => s + safeNum(d.netKwd), 0)
    const ord = matchingDays.reduce((s, d) => s + safeNum(d.orders), 0)
    return { salesKwd: Math.round(net * 1000) / 1000, orders: Math.round(ord) }
  })()

  const basePeriodSales =
    activeBkt
      ? safeNum(activeBkt.totals?.restaurantNetKwd)
      : customLiveDaysTotals
        ? customLiveDaysTotals.salesKwd
        : 0

  const basePeriodOrders =
    activeBkt
      ? safeNum(activeBkt.totals?.restaurantOrders)
      : customLiveDaysTotals
        ? customLiveDaysTotals.orders
        : 0

  const sliceMult = computeLiveKuwaitSliceMultipliers(
    filters.kuwaitSlice,
    filters.period,
    rawPeriodDays,
    liveSummary,
  )
  const periodDays = sliceMult.slicedDays
  const sliceNetMult = sliceMult.netMult
  const sliceOrdMult = sliceMult.ordMult

  const periodGroupSales = basePeriodSales * sliceNetMult
  const periodScale = monthGroupSales > 0 ? safeDiv(periodGroupSales, monthGroupSales, 0) : 0

  const computeSliceSalesAndOrders = (
    tBrand: GlobalBrand,
    tBranch: GlobalBranch,
    tChannel: GlobalChannel,
  ): { salesKwd: number; orders: number; ordersKnown: boolean; scopeAvailable: boolean } => {
    let rawSales = 0
    let rawOrd = 0
    // A brand slice is only shown from exact brand data; there is no pro-rata estimate.
    let ordersKnown = true
    let scopeAvailable = true

    if (tBrand === 'all' && tBranch === 'all' && tChannel === 'all') {
      rawSales = basePeriodSales
      rawOrd = basePeriodOrders
    } else if (!activeBkt) {
      // Custom window before customBucket finishes loading: only branch dailyByBranch if available
      if (tBrand === 'all' && tBranch !== 'all' && tChannel === 'all' && liveSummary.dailyByBranch) {
        for (const [dayIso, byLoc] of Object.entries(liveSummary.dailyByBranch)) {
          if (dayIso >= clampedCustomForBucket.from && dayIso <= clampedCustomForBucket.to) {
            rawSales += safeNum(byLoc?.[tBranch]?.netKwd)
            rawOrd += safeNum(byLoc?.[tBranch]?.orders)
          }
        }
      }
    } else if (tBrand !== 'all' && tBranch === 'all' && tChannel === 'all') {
      const headline = resolveBrandHeadline(activeBkt, tBrand)
      rawSales = headline?.netKwd ?? 0
      rawOrd = headline?.orders ?? 0
      ordersKnown = headline?.orders !== null && headline !== null
      scopeAvailable = headline !== null
    } else if (tBrand === 'all' && tBranch !== 'all' && tChannel === 'all') {
      const branchLoc = activeBkt.byLocation?.[tBranch]
      rawSales = safeNum(branchLoc?.netKwd)
      rawOrd = safeNum(branchLoc?.orders)
    } else if (tBrand === 'all' && tBranch === 'all' && tChannel !== 'all') {
      rawSales = safeNum(activeBkt.uiChannels?.[tChannel]?.netKwd)
      rawOrd = safeNum(activeBkt.uiChannels?.[tChannel]?.orders)
    } else if (tBrand === 'all' && tBranch !== 'all' && tChannel !== 'all') {
      const locCh = activeBkt.byLocation?.[tBranch]?.uiChannels?.[tChannel]
      rawSales = safeNum(locCh?.netKwd)
      rawOrd = safeNum(locCh?.orders)
    } else if (tBrand !== 'all' && tBranch !== 'all' && tChannel === 'all') {
      const cell = activeBkt.byBrandByLocation?.[tBranch]?.[tBrand]
      rawSales = safeNum(cell?.netKwd)
      rawOrd = safeNum(cell?.orders)
      scopeAvailable = Boolean(activeBkt.byBrandByLocation)
    } else {
      // Brand × channel has no exact Odoo split yet.
      scopeAvailable = false
    }

    const finalSalesKwd = Math.max(0, Math.round(rawSales * sliceNetMult * 1000) / 1000)
    const finalOrders = finalSalesKwd > 0 ? Math.max(0, Math.round(rawOrd * sliceOrdMult)) : 0
    return { salesKwd: finalSalesKwd, orders: finalOrders, ordersKnown, scopeAvailable }
  }

  const { brand, branch, channel } = filters
  const bucketTotalsUnavailable = Boolean(
    activeBkt &&
      (activeBkt.totals.restaurantNetKwd === null || activeBkt.totals.restaurantOrders === null),
  )
  // A section absent from the bucket (older / trimmed payloads) is unavailable, exactly like null —
  // never a row of 0.000 values.
  const channelsSectionUnavailable = Boolean(activeBkt && activeBkt.uiChannels == null)
  const brandsSectionUnavailable = Boolean(activeBkt && activeBkt.byBrand == null)
  const branchesSectionUnavailable = Boolean(activeBkt && activeBkt.byLocation == null)
  const hourlySectionUnavailable = Boolean(liveSummary.hourlySeries === null)
  const activeSlice = computeSliceSalesAndOrders(brand, branch, channel)
  const sectionUnavailable = Boolean(
    !activeSlice.scopeAvailable ||
    bucketTotalsUnavailable ||
      (channel !== 'all' && channelsSectionUnavailable) ||
      (brand !== 'all' && brandsSectionUnavailable) ||
      (branch !== 'all' && branchesSectionUnavailable) ||
      (filters.kuwaitSlice === 'quiet-hours' && hourlySectionUnavailable),
  )

  const salesKwd = activeSlice.salesKwd
  const orders = activeSlice.orders
  const aovKwd = orders > 0 ? Math.round((salesKwd / orders) * 1000) / 1000 : 0
  const ordersUnavailable = sectionUnavailable || !activeSlice.ordersKnown
  const nullableSalesKwd = sectionUnavailable ? null : salesKwd
  const nullableOrders = ordersUnavailable ? null : orders
  const nullableAovKwd = ordersUnavailable ? null : aovKwd
  const brandHeadline = brand === 'all' ? null : resolveBrandHeadline(activeBkt, brand)

  const unattributedSalesKwd = safeNum(
    activeBkt?.unattributedSalesKwd,
    filters.period === 'month' ? safeNum(liveSummary.unattributedSalesKwd) : 0,
  )
  const unattributedOrders = safeNum(
    activeBkt?.unattributedOrders,
    filters.period === 'month' ? safeNum(liveSummary.unattributedOrders) : 0,
  )
  const unattributedBranch =
    activeBkt?.unattributedBranch ??
    (filters.period === 'month' ? (liveSummary.unattributedBranch ?? null) : null)

  const dimensionShare =
    brand === 'all' && branch === 'all' && channel === 'all'
      ? 1
      : basePeriodSales > 0
        ? Math.min(1, Math.max(0, safeDiv(salesKwd, basePeriodSales * Math.max(0.0001, sliceNetMult), 0)))
        : 0
  const totalScale = monthGroupSales > 0 ? safeDiv(salesKwd, monthGroupSales, 0) : 0

  // -------------------------------------------------------------------------
  // Odoo 17 General Ledger Accounting (`account.move.line`) — Strict Completeness & Commission Checks
  // -------------------------------------------------------------------------
  const isFullGroupScope =
    brand === 'all' && branch === 'all' && channel === 'all' && filters.kuwaitSlice === 'all'
  const rawGl = activeBkt?.accounting
  const rawGlRev = rawGl
    ? safeNum(rawGl.totalRevenue, safeNum(rawGl.income) + safeNum(rawGl.otherIncome))
    : 0

  const postedDelivCommVal = Math.max(0, safeNum(rawGl?.deliveryCommissions))
  const postedExpenseVal = Math.max(0, safeNum(rawGl?.expense))
  const postedDeprVal = Math.max(0, safeNum(rawGl?.depreciation))

  const aggregatorCommissionUnposted = Boolean(
    rawGl?.aggregatorCommissionUnposted === true || postedDelivCommVal <= 0,
  )
  const aggregatorCommissionDisplayAr = aggregatorCommissionUnposted ? 'غير مُرحَّل بعد' : null

  const glIncompleteFromRaw = Boolean(
    !rawGl ||
      rawGl.available === false ||
      rawGl.glIncomplete === true ||
      rawGl.completeAccrualPosted !== true ||
      postedExpenseVal <= 0 ||
      postedDelivCommVal <= 0 ||
      postedDeprVal <= 0,
  )
  const glWarningAr = glIncompleteFromRaw ? 'قيود غير مكتملة لهذه الفترة' : null

  let accounting: WorkspaceLedgerAccounting
  if (!isFullGroupScope) {
    accounting = {
      available: false,
      completeAccrualPosted: false,
      glIncomplete: true,
      glWarningAr: 'قيود غير مكتملة لهذه الفترة',
      aggregatorCommissionUnposted,
      aggregatorCommissionDisplayAr,
      from: resolvedPeriodWindow.fromIso,
      to: resolvedPeriodWindow.toInclusiveIso,
      sourceModel: 'account.move.line',
      lineCount: 0,
      totalRevenueKwd: null,
      cogsKwd: null,
      deliveryCommissionsKwd: null,
      platformSubscriptionKwd: null,
      thirdPartyDeliveryKwd: null,
      commissionAccounts: [],
      otherOpexAndDepreciationKwd: null,
      beforeRentKwd: null,
      operatingProfitKwd: null,
      cogsPct: null,
      deliveryCommPct: null,
      opexRentDeprPct: null,
      beforeRentPct: null,
      netProfitPct: null,
      unavailableReasonAr: 'دفتر الأستاذ غير مقسّم حسب هذا الفلتر.',
      unavailableReasonEn: 'The general ledger is not split by this filter.',
      glScopeLimited: true,
    }
  } else if (!rawGl || rawGl.available === false || rawGlRev <= 0 || glIncompleteFromRaw) {
    const cogsVal = Math.max(0, safeNum(rawGl?.cogs))
    const postedOpexVal = postedExpenseVal + postedDeprVal
    const postedLines = Boolean(
      rawGl && (rawGlRev > 0 || cogsVal > 0 || postedOpexVal > 0),
    )
    accounting = {
      available: postedLines,
      completeAccrualPosted: false,
      glIncomplete: true,
      glWarningAr: 'قيود غير مكتملة لهذه الفترة',
      aggregatorCommissionUnposted,
      aggregatorCommissionDisplayAr,
      from: rawGl?.from ?? resolvedPeriodWindow.fromIso,
      to: rawGl?.to ?? resolvedPeriodWindow.toInclusiveIso,
      sourceModel: 'account.move.line',
      lineCount: safeNum(rawGl?.lineCount),
      totalRevenueKwd: rawGlRev > 0 ? Math.round(rawGlRev * 1000) / 1000 : null,
      cogsKwd: cogsVal > 0 ? Math.round(cogsVal * 1000) / 1000 : null,
      deliveryCommissionsKwd: aggregatorCommissionUnposted
        ? null
        : Math.round(postedDelivCommVal * 1000) / 1000,
      platformSubscriptionKwd:
        rawGl && (rawGl.platformSubscriptionKwd ?? 0) > 0
          ? Math.round((rawGl.platformSubscriptionKwd ?? 0) * 1000) / 1000
          : null,
      thirdPartyDeliveryKwd:
        rawGl && (rawGl.thirdPartyDeliveryKwd ?? 0) > 0
          ? Math.round((rawGl.thirdPartyDeliveryKwd ?? 0) * 1000) / 1000
          : null,
      commissionAccounts: rawGl?.commissionAccounts ?? [],
      otherOpexAndDepreciationKwd:
        postedOpexVal > 0 ? Math.round(postedOpexVal * 1000) / 1000 : null,
      beforeRentKwd: null,
      operatingProfitKwd: null,
      cogsPct: cogsVal > 0 && rawGlRev > 0 ? Math.round((cogsVal / rawGlRev) * 1000) / 10 : null,
      deliveryCommPct:
        !aggregatorCommissionUnposted && rawGlRev > 0
          ? Math.round((postedDelivCommVal / rawGlRev) * 1000) / 10
          : null,
      opexRentDeprPct: null,
      beforeRentPct: null,
      netProfitPct: null,
      unavailableReasonAr: 'قيود غير مكتملة لهذه الفترة',
      unavailableReasonEn: 'Incomplete GL entries for this period',
      glScopeLimited: false,
      revenueAccounts: rawGl?.revenueAccounts ?? [],
      glClosedThroughDate: rawGl?.glClosedThroughDate ?? null,
    }
    // Phase 5 · Item 7: profit is hidden here too; when the window is not inside closed GL months
    // (including when Odoo has no lock dates at all) say so with the one calm note.
    if (rawGl && !isWindowWithinClosedMonths(accounting.to, rawGl.glClosedThroughDate)) {
      const reason = closedMonthWithheldReason(rawGl.glClosedThroughDate)
      accounting = {
        ...accounting,
        netProfitWithheld: true,
        netProfitWithheldReasonAr: reason.ar,
        netProfitWithheldReasonEn: reason.en,
      }
    }
  } else {
    const cogsVal = Math.max(0, safeNum(rawGl.cogs))
    const otherOpexVal =
      typeof rawGl.otherOpexAndDepreciation === 'number'
        ? Math.max(0, rawGl.otherOpexAndDepreciation)
        : Math.max(0, postedExpenseVal - postedDelivCommVal) + postedDeprVal
    const opProfitVal =
      typeof rawGl.operatingProfit === 'number'
        ? rawGl.operatingProfit
        : rawGlRev - cogsVal - postedDelivCommVal - otherOpexVal
    const glBeforeRentKwd = rawGlRev - cogsVal - postedDelivCommVal

    accounting = {
      available: true,
      completeAccrualPosted: true,
      glIncomplete: false,
      glWarningAr: null,
      aggregatorCommissionUnposted: false,
      aggregatorCommissionDisplayAr: null,
      from: rawGl.from ?? resolvedPeriodWindow.fromIso,
      to: rawGl.to ?? resolvedPeriodWindow.toInclusiveIso,
      sourceModel: 'account.move.line',
      lineCount: safeNum(rawGl.lineCount),
      totalRevenueKwd: Math.round(rawGlRev * 1000) / 1000,
      cogsKwd: Math.round(cogsVal * 1000) / 1000,
      deliveryCommissionsKwd: Math.round(postedDelivCommVal * 1000) / 1000,
      platformSubscriptionKwd:
        rawGl.platformSubscriptionKwd && rawGl.platformSubscriptionKwd > 0
          ? Math.round(rawGl.platformSubscriptionKwd * 1000) / 1000
          : null,
      thirdPartyDeliveryKwd:
        rawGl.thirdPartyDeliveryKwd && rawGl.thirdPartyDeliveryKwd > 0
          ? Math.round(rawGl.thirdPartyDeliveryKwd * 1000) / 1000
          : null,
      commissionAccounts: rawGl.commissionAccounts ?? [],
      otherOpexAndDepreciationKwd: Math.round(otherOpexVal * 1000) / 1000,
      beforeRentKwd: Math.round(glBeforeRentKwd * 1000) / 1000,
      operatingProfitKwd: Math.round(opProfitVal * 1000) / 1000,
      cogsPct: Math.round((cogsVal / rawGlRev) * 1000) / 10,
      deliveryCommPct: Math.round((postedDelivCommVal / rawGlRev) * 1000) / 10,
      opexRentDeprPct: Math.round((otherOpexVal / rawGlRev) * 1000) / 10,
      beforeRentPct: Math.round((glBeforeRentKwd / rawGlRev) * 1000) / 10,
      netProfitPct: Math.round((opProfitVal / rawGlRev) * 1000) / 10,
      unavailableReasonAr: null,
      unavailableReasonEn: null,
      glScopeLimited: false,
      revenueAccounts: rawGl.revenueAccounts ?? [],
      glClosedThroughDate: rawGl.glClosedThroughDate ?? null,
      netProfitWithheld: false,
    }
    // Phase 5 · Item 7: Net Profit / Net Margin only for windows inside closed GL months.
    if (!isWindowWithinClosedMonths(accounting.to, rawGl.glClosedThroughDate)) {
      const reason = closedMonthWithheldReason(rawGl.glClosedThroughDate)
      accounting = {
        ...accounting,
        operatingProfitKwd: null,
        netProfitPct: null,
        netProfitWithheld: true,
        netProfitWithheldReasonAr: reason.ar,
        netProfitWithheldReasonEn: reason.en,
      }
    }
  }

  const food10 =
    accounting.cogsPct !== null ? Math.round((accounting.cogsPct / 10) * 100) / 100 : 0
  const delivery10 =
    accounting.deliveryCommPct !== null ? Math.round((accounting.deliveryCommPct / 10) * 100) / 100 : 0
  const opexRent10 =
    accounting.opexRentDeprPct !== null ? Math.round((accounting.opexRentDeprPct / 10) * 100) / 100 : 0
  const netPocket10 =
    accounting.netProfitPct !== null ? Math.round((accounting.netProfitPct / 10) * 100) / 100 : 0

  const weightedNetPct = accounting.netProfitPct ?? 0
  const groupGlMonth = monthBkt?.accounting
  const groupGlMonthRev = groupGlMonth
    ? safeNum(groupGlMonth.totalRevenue, safeNum(groupGlMonth.income) + safeNum(groupGlMonth.otherIncome))
    : 0
  const groupWeightedNetPct =
    groupGlMonth &&
    isWindowWithinClosedMonths(groupGlMonth.to, groupGlMonth.glClosedThroughDate) &&
    groupGlMonth.available !== false &&
    groupGlMonth.glIncomplete !== true &&
    groupGlMonth.completeAccrualPosted === true &&
    groupGlMonthRev > 0
      ? Math.round(
          ((typeof groupGlMonth.operatingProfit === 'number'
            ? groupGlMonth.operatingProfit
            : groupGlMonthRev -
              safeNum(groupGlMonth.cogs) -
              safeNum(groupGlMonth.expense) -
              safeNum(groupGlMonth.depreciation)) /
            groupGlMonthRev) *
            1000,
        ) / 10
      : 0

  // Cascading Filter Options strictly from live Odoo POS
  const cascadingBrands: FilterOption<GlobalBrand>[] = GLOBAL_BRAND_OPTIONS.map((opt) => {
    if (opt.id !== 'all' && (brandsSectionUnavailable || bucketTotalsUnavailable)) {
      return {
        ...opt,
        healthDot: '🟠' as const,
        weightedNetPct: undefined,
        salesKwd: undefined,
        available: true,
      }
    }
    const m = computeSliceSalesAndOrders(opt.id, branch, channel)
    return {
      ...opt,
      healthDot: m.salesKwd > 0.05 ? ('🟢' as const) : ('🔴' as const),
      weightedNetPct: undefined,
      salesKwd: bucketTotalsUnavailable ? undefined : Math.round(m.salesKwd * 1000) / 1000,
      available: opt.id === 'all' || m.salesKwd > 0.05 || opt.id === brand,
    }
  })

  const boothsReported = isExhibitionGroupReported(activeBkt)
  const cascadingBranches: FilterOption<GlobalBranch>[] = GLOBAL_BRANCH_OPTIONS.filter(
    (opt) => opt.id !== 'exhibitions' || boothsReported,
  ).map((opt) => {
    if (opt.id !== 'all' && (bucketTotalsUnavailable || branchesSectionUnavailable)) {
      return {
        ...opt,
        healthDot: '🟠' as const,
        weightedNetPct: undefined,
        salesKwd: undefined,
        available: true,
      }
    }
    const m = computeSliceSalesAndOrders(brand, opt.id, channel)
    return {
      ...opt,
      healthDot: m.salesKwd > 0.05 ? ('🟢' as const) : ('🔴' as const),
      weightedNetPct: undefined,
      salesKwd: bucketTotalsUnavailable ? undefined : Math.round(m.salesKwd * 1000) / 1000,
      available: opt.id === 'all' || m.salesKwd > 0.05 || opt.id === branch,
    }
  })

  const cascadingChannels: FilterOption<GlobalChannel>[] = GLOBAL_CHANNEL_OPTIONS.map((opt) => {
    if (opt.id !== 'all' && channelsSectionUnavailable) {
      return {
        ...opt,
        healthDot: '🟠' as const,
        weightedNetPct: undefined,
        salesKwd: undefined,
        available: true,
      }
    }
    const m = computeSliceSalesAndOrders(brand, branch, opt.id)
    return {
      ...opt,
      healthDot: m.salesKwd > 0.05 ? ('🟢' as const) : ('🔴' as const),
      weightedNetPct: undefined,
      salesKwd: bucketTotalsUnavailable ? undefined : Math.round(m.salesKwd * 1000) / 1000,
      available: opt.id === 'all' || m.salesKwd > 0.05 || opt.id === channel,
    }
  })

  const showPeerComparison = !isFullGroupScope
  const deltaPctPoints =
    accounting.netProfitPct !== null
      ? Math.round((accounting.netProfitPct - groupWeightedNetPct) * 10) / 10
      : 0
  const diagTone: PeerDiagnosticStrip['tone'] =
    salesKwd <= 0
      ? 'rose'
      : accounting.netProfitPct === null
        ? 'amber'
        : accounting.netProfitPct < 0
          ? 'rose'
          : 'emerald'

  const benchmarkAr =
    salesKwd <= 0
      ? 'لا توجد مبيعات مسجلة في هذا التقاطع'
      : accounting.netProfitPct === null
        ? (accounting.glWarningAr ?? 'قيود غير مكتملة لهذه الفترة')
        : `صافي الربح المحاسبي (دفتر الأستاذ العام): ${accounting.netProfitPct.toFixed(1)}%`

  const benchmarkEn =
    salesKwd <= 0
      ? 'Zero POS sales in this slice'
      : accounting.netProfitPct === null
        ? 'Incomplete GL entries for this period'
        : `GL Operating Margin (account.move.line): ${accounting.netProfitPct.toFixed(1)}%`

  let rootCauseAr = ''
  let rootCauseEn = ''
  if (salesKwd <= 0) {
    rootCauseAr = 'لا توجد بيانات من Odoo لهذه الفترة أو لهذا التقاطع.'
    rootCauseEn = 'No Odoo POS sales recorded for this period or slice.'
  } else if (accounting.netProfitPct !== null && !accounting.glIncomplete) {
    rootCauseAr = `قيود دفتر الأستاذ العام (account.move.line): تكلفة البضاعة ${accounting.cogsPct?.toFixed(1)}% • عمولات مرحّلة ${accounting.deliveryCommPct?.toFixed(1)}% • مصاريف وإيجارات وإهلاك ${accounting.opexRentDeprPct?.toFixed(1)}% • صافي التشغيل ${accounting.netProfitPct.toFixed(1)}%.`
    rootCauseEn = `Odoo GL (account.move.line): COGS ${accounting.cogsPct?.toFixed(1)}% • Posted Commissions ${accounting.deliveryCommPct?.toFixed(1)}% • Rent/Opex/Depr ${accounting.opexRentDeprPct?.toFixed(1)}% • Operating Net ${accounting.netProfitPct.toFixed(1)}%.`
  } else {
    const commNoteAr = aggregatorCommissionUnposted ? ' • عمولات المنصات: غير مُرحَّل بعد' : ''
    rootCauseAr = `قيود غير مكتملة لهذه الفترة${commNoteAr}`
    rootCauseEn = `Incomplete GL entries for this period${aggregatorCommissionUnposted ? ' • Aggregator commissions: Unposted' : ''}`
  }

  const diagnosticStrip: PeerDiagnosticStrip = {
    activeWeightedNetPct: weightedNetPct,
    groupWeightedNetPct,
    deltaPctPoints,
    showPeerComparison,
    tone: diagTone,
    benchmarkAr,
    benchmarkEn,
    rootCauseAr,
    rootCauseEn,
  }

  // Live Receivables strictly from Odoo 17 (zero static 1,183.208 fallback!)
  const arRaw = liveSummary.aggregatorReceivables
  const receivablesUnavailable = Boolean(
    arRaw === null ||
      (arRaw !== undefined && arRaw.readable === false) ||
      (liveSummary.unavailableSections ?? []).includes('receivables'),
  )
  const rawReceivablesMeta: WorkspaceReceivablesMeta = receivablesUnavailable
    ? buildUnavailableReceivables(resolvedPeriodWindow.fromIso, resolvedPeriodWindow.toInclusiveIso)
    : arRaw && arRaw.readable
      ? {
          unavailable: false,
          pendingReconciliation: false,
          openReceivableKwd: Math.round(safeNum(arRaw.openReceivableKwd) * 1000) / 1000,
          grossPositiveReceivableKwd:
            Math.round(safeNum(arRaw.grossPositiveReceivableKwd) * 1000) / 1000,
          creditClearingOffsetKwd:
            Math.round(Math.abs(safeNum(arRaw.creditClearingOffsetKwd)) * 1000) / 1000,
          unreconciledLineCount: safeNum(arRaw.openLinesCount),
          posClearingLinesCount: safeNum(arRaw.posClearingLinesCount),
          platformAndCorporateLinesCount: safeNum(arRaw.platformAndCorporateLinesCount),
          fromDate: arRaw.fromDate ?? resolvedPeriodWindow.fromIso,
          toDate: arRaw.toDate ?? resolvedPeriodWindow.toInclusiveIso,
          latestMaturityDate: arRaw.latestMaturityDate ?? null,
          maturityStatusAr: arRaw.maturityStatusAr ?? 'رصيد ذمم فعلي من أودو',
          maturityStatusEn: arRaw.maturityStatusEn ?? 'Live Odoo receivable balance',
          openLinesExplanationAr: arRaw.openLinesExplanationAr ?? '',
          openLinesExplanationEn: arRaw.openLinesExplanationEn ?? '',
          sourceLabelAr: 'أودو 17 — قيود دفتر الأستاذ للذمم المدينة غير المسوّاة',
          sourceLabelEn: 'Odoo 17 — Receivable Ledger (account.move.line · asset_receivable · reconciled=false)',
          byAccount: arRaw.byAccount ?? [],
          ...(() => {
            const aging = toDisplayableAging(arRaw)
            const formula = formatArReconciliationFormula({
              openReceivableKwd: safeNum(arRaw.openReceivableKwd),
              grossPositiveReceivableKwd: safeNum(arRaw.grossPositiveReceivableKwd),
              creditClearingOffsetKwd: safeNum(arRaw.creditClearingOffsetKwd),
              openDebitsKwd: aging.openDebitsKwd,
              unappliedCreditsKwd: aging.unappliedCreditsKwd,
            })
            return {
              agingBuckets: aging.buckets,
              openDebitsKwd: aging.openDebitsKwd,
              unappliedCreditsKwd: aging.unappliedCreditsKwd,
              agingHiddenReasonAr: aging.hiddenReasonAr,
              agingHiddenReasonEn: aging.hiddenReasonEn,
              reconciliationFormulaAr: formula.ar,
              reconciliationFormulaEn: formula.en,
            }
          })(),
        }
      : buildEmptyReceivables(resolvedPeriodWindow.fromIso, resolvedPeriodWindow.toInclusiveIso)
  const receivables = applyReceivablesExecutivePolicy(rawReceivablesMeta)

  const deliveryDuesKwd: number | null =
    receivables.unavailable || receivables.pendingReconciliation || receivables.openReceivableKwd === null
      ? null
      : channel === 'dine-in'
        ? 0
        : Math.max(0, Math.round(receivables.openReceivableKwd))

  const quietHoursShare = computeLiveKuwaitSliceMultipliers(
    'quiet-hours',
    filters.period,
    rawPeriodDays,
    liveSummary,
  ).netMult
  const quietHoursActualKwd: number | null =
    hourlySectionUnavailable || sectionUnavailable
      ? null
      : Math.round(salesKwd * quietHoursShare * 1000) / 1000

  const summaryCards = buildSummaryCards({
    odooConnected: true,
    activeIsoWindowAr,
    activeIsoWindowEn,
    receivables,
    deliveryDuesKwd,
    opexActualKwd: accounting.otherOpexAndDepreciationKwd,
    quietHoursActualKwd,
    glWarningAr: accounting.glWarningAr,
  })

  // Static plays and linear-division notes remain empty unless backed by a live Odoo source
  const plays: SimplePlayView[] = []
  const totalPlaysBenefitMonthlyKwd = 0
  const totalPlaysBenefitPeriodKwd = 0
  const feryalNotes: FeryalSimpleNote[] = []

  const periodRangeLabelAr =
    filters.period === 'custom' || filters.period === 'month'
      ? `${periodCalendarWindowAr} (${formatArDays(periodDays)})`
      : `${periodCalendarWindowAr}${isTodayFallback ? ' (آخر يوم عمل مكتمل)' : ''}`
  const periodRangeLabelEn =
    filters.period === 'custom' || filters.period === 'month'
      ? `${periodCalendarWindowEn} (${periodDays}d)`
      : `${periodCalendarWindowEn}${isTodayFallback ? ' (last full POS day)' : ''}`

  const subtitleAr = buildFilterSubtitle(filters, true, liveSummary)
  const subtitleEn = buildFilterSubtitle(filters, false, liveSummary)

  const glMarginLabelAr =
    accounting.netProfitPct !== null
      ? `${accounting.netProfitPct.toFixed(1)}%`
      : (accounting.glWarningAr ?? 'قيود غير مكتملة لهذه الفترة')
  const glMarginLabelEn =
    accounting.netProfitPct !== null ? `${accounting.netProfitPct.toFixed(1)}%` : 'Incomplete GL entries'
  const feryalSalesAr = nullableSalesKwd === null ? 'غير متاح' : fKwd(nullableSalesKwd, true)
  const feryalSalesEn = nullableSalesKwd === null ? '—' : fKwd(nullableSalesKwd, false)
  const feryalOrdersStr = nullableOrders === null ? '—' : nullableOrders.toLocaleString('en-US')
  const feryalAovAr = nullableAovKwd === null ? 'غير متاح' : `${nullableAovKwd.toFixed(2)} د.ك`
  const feryalAovEn = nullableAovKwd === null ? '—' : `${nullableAovKwd.toFixed(2)} KWD`
  const feryalContextAr = `[الفلتر النشط: ${subtitleAr} | المبيعات الصافية: ${feryalSalesAr} | غير منسوب لفرع: ${fKwd(unattributedSalesKwd, true)} | الطلبات: ${feryalOrdersStr} | متوسط الفاتورة: ${feryalAovAr} | صافي الربح المحاسبي: ${glMarginLabelAr} | عمولات المنصات: ${aggregatorCommissionDisplayAr ?? 'مرحّلة'}]`
  const feryalContextEn = `[Active Filter: ${subtitleEn} | Net Sales: ${feryalSalesEn} | Unattributed: ${fKwd(unattributedSalesKwd, false)} | Orders: ${feryalOrdersStr} | AOV: ${feryalAovEn} | GL Margin: ${glMarginLabelEn}]`

  const noData = Boolean(
    !sectionUnavailable && (liveSummary.noData || (salesKwd <= 0 && orders <= 0)),
  )
  const partial = Boolean(liveSummary.partial)
  const unavailableSections = liveSummary.unavailableSections ?? []

  return {
    filters,
    isFiltered: isNonDefaultFilter(filters),
    odooConnected: true,
    noData,
    noDataMessageAr: noData ? (liveSummary.messageAr ?? 'لا توجد بيانات من Odoo لهذه الفترة') : null,
    partial,
    unavailableSections,
    warningAr: partial ? (liveSummary.warningAr ?? 'بعض الأرقام غير متاحة الآن') : null,
    warningEn: partial ? (liveSummary.warningEn ?? 'Some figures are temporarily unavailable') : null,
    sectionUnavailable,
    nullableSalesKwd,
    nullableOrders,
    nullableAovKwd,
    brandBasis: brandHeadline?.basis ?? 'order-level',
    brandBasisGapKwd: brandHeadline?.basisGapKwd ?? 0,
    lastSyncAt: liveSummary.lastSyncAt ?? liveSummary.syncedAt ?? null,
    isStale24h: Boolean(liveSummary.isStale24h ?? liveSummary.isStaleOver24h),
    odooCompanyId: liveSummary.odooCompanyId ?? null,
    dateRange: {
      from: resolvedPeriodWindow.fromIso,
      to: resolvedPeriodWindow.toInclusiveIso,
    },
    unattributedSalesKwd,
    unattributedOrders,
    unattributedBranch,
    glIncomplete: accounting.glIncomplete,
    glWarningAr: accounting.glWarningAr,
    aggregatorCommissionUnposted: accounting.aggregatorCommissionUnposted,
    aggregatorCommissionDisplayAr: accounting.aggregatorCommissionDisplayAr,
    isTodayFallback,
    todayFallbackDate,
    lastSyncedAt: liveSummary.lastSyncAt ?? liveSummary.syncedAt ?? null,
    subtitleAr,
    subtitleEn,
    periodCalendarWindowAr,
    periodCalendarWindowEn,
    periodRangeLabelAr,
    periodRangeLabelEn,
    periodDays,
    salesKwd,
    orders,
    aovKwd,
    weightedNetPct,
    groupWeightedNetPct,
    periodScale,
    dimensionShare,
    totalScale,
    accounting,
    receivables,
    per10: {
      food10,
      delivery10,
      opexRent10,
      netPocket10,
    },
    cascadingOptions: {
      brands: cascadingBrands,
      branches: cascadingBranches,
      channels: cascadingChannels,
    },
    diagnosticStrip,
    summaryCards,
    plays,
    totalPlaysBenefitPeriodKwd,
    totalPlaysBenefitMonthlyKwd,
    feryalNotes,
    feryalContextAr,
    feryalContextEn,
  }
}

export interface SignedDeltaDisplay {
  pct: number
  text: string
  arrow: '▲' | '▼' | '•'
  sign: 'positive' | 'negative' | 'flat'
  tone: 'emerald' | 'rose' | 'neutral'
}

export function formatSignedDelta(rawPct: number): SignedDeltaDisplay {
  const safe = Number.isFinite(rawPct) ? Math.round(rawPct * 10) / 10 : 0
  if (safe > 0) {
    return {
      pct: safe,
      text: `▲ +${safe.toFixed(1)}%`,
      arrow: '▲',
      sign: 'positive',
      tone: 'emerald',
    }
  }
  if (safe < 0) {
    return {
      pct: safe,
      text: `▼ ${safe.toFixed(1)}%`,
      arrow: '▼',
      sign: 'negative',
      tone: 'rose',
    }
  }
  return {
    pct: 0,
    text: '• 0.0%',
    arrow: '•',
    sign: 'flat',
    tone: 'neutral',
  }
}

/** Rounds a % change to one decimal; `null` unless both sides are positive. */
function pctChange(current: number, prior: number): number | null {
  if (!(current > 0) || !(prior > 0)) return null
  const pct = ((current - prior) / prior) * 100
  return Number.isFinite(pct) ? Math.round(pct * 10) / 10 : null
}

const DAYS_PER_WEEK = 7
const DAYS_PER_MONTH_WINDOW = 30

/**
 * Like-for-like period-over-period Net Sales % delta from live Odoo `dailySeries` / `journeyPulse`.
 *
 * Returns `null` ("no comparison") whenever a real prior period is not in the payload, so the UI
 * shows `—` instead of a fake `+0.0%`. Every input series is company-wide, so any brand, branch or
 * channel filter also returns `null` rather than labelling a company delta as the filtered one.
 * `today` has no same-hours prior-week data in the payload, so it returns `null` unless the
 * caller opts in to whole-day comparison (`sameHoursLikeForLike`).
 */
export function computePeriodOverPeriodDeltaPct(
  filters: GlobalFilters,
  _workspace: Pick<GlobalWorkspaceSlice, 'salesKwd' | 'isTodayFallback'>,
  liveSummary?: OdooLiveSummary | null,
  options?: { referenceNowMs?: number; sameHoursLikeForLike?: boolean },
): number | null {
  if (!liveSummary || liveSummary.connected !== true) {
    return null
  }
  const isDimensionFiltered =
    (filters.brand ?? 'all') !== 'all' || (filters.branch ?? 'all') !== 'all' || (filters.channel ?? 'all') !== 'all'
  if (isDimensionFiltered) return null

  const dailyMap = new Map<string, { day: string; orders: number; netKwd: number }>()
  // Same company series as the timeline: dailySeries filled from the per-branch daily rows.
  for (const d of companyDailySeries(liveSummary)) {
    if (d.orders > 0 && d.netKwd > 0) dailyMap.set(d.day, d)
  }
  const orderedDays = [...dailyMap.values()].sort((a, b) => a.day.localeCompare(b.day))
  const kwCtx = getKuwaitTimeContext(options?.referenceNowMs)
  const activeIncompleteTodayIso = kwCtx.todayIso
  const completedDays = options?.sameHoursLikeForLike
    ? orderedDays
    : orderedDays.filter((d) => d.day < activeIncompleteTodayIso)

  if (filters.period === 'month') {
    const r30 = liveSummary.journeyPulse?.rolling30
    const p30 = liveSummary.journeyPulse?.prior30
    const equalPulse =
      r30 !== undefined &&
      p30 !== undefined &&
      r30.days > 0 &&
      r30.days === p30.days
    if (equalPulse) {
      const pulseDelta = pctChange(r30.netKwd, p30.netKwd)
      if (pulseDelta !== null) return pulseDelta
    }
    const monthDays = liveSummary.buckets?.month?.days
    const windowDays =
      typeof monthDays === 'number' && monthDays > 0 ? monthDays : DAYS_PER_MONTH_WINDOW
    if (completedDays.length < 2 * windowDays) return null
    const sum = (rows: typeof completedDays) => rows.reduce((s, d) => s + d.netKwd, 0)
    return pctChange(
      sum(completedDays.slice(-windowDays)),
      sum(completedDays.slice(-2 * windowDays, -windowDays)),
    )
  }

  if (filters.period === 'week') {
    if (completedDays.length < 2 * DAYS_PER_WEEK) return null
    const sum = (rows: typeof completedDays) => rows.reduce((s, d) => s + d.netKwd, 0)
    return pctChange(
      sum(completedDays.slice(-DAYS_PER_WEEK)),
      sum(completedDays.slice(-2 * DAYS_PER_WEEK, -DAYS_PER_WEEK)),
    )
  }

  if (filters.period === 'today') {
    // Comparing a partial today with a whole prior day is not like-for-like; only the explicit
    // whole-day mode compares the latest day with the same weekday one week earlier.
    if (!options?.sameHoursLikeForLike) return null
    const latest = completedDays[completedDays.length - 1]
    const sameWeekdayIso = latest ? shiftIsoDateDays(latest.day, -DAYS_PER_WEEK) : null
    const prior = completedDays.find((d) => d.day === sameWeekdayIso)
    return latest && prior ? pctChange(latest.netKwd, prior.netKwd) : null
  }

  if (filters.period === 'custom' && filters.customFrom && filters.customTo) {
    const rawFrom = filters.customFrom <= filters.customTo ? filters.customFrom : filters.customTo
    const rawTo = filters.customFrom <= filters.customTo ? filters.customTo : filters.customFrom
    const effectiveTo =
      !options?.sameHoursLikeForLike && rawTo >= activeIncompleteTodayIso
        ? shiftIsoDateDays(activeIncompleteTodayIso, -1)
        : rawTo
    const effectiveFrom = rawFrom <= effectiveTo ? rawFrom : effectiveTo
    const spanDays = Math.max(
      1,
      Math.round(
        (Date.parse(`${effectiveTo}T00:00:00Z`) - Date.parse(`${effectiveFrom}T00:00:00Z`)) /
          86_400_000,
      ) + 1,
    )
    const priorTo = shiftIsoDateDays(effectiveFrom, -1)
    const priorFrom = shiftIsoDateDays(effectiveFrom, -spanDays)
    const currRows = completedDays.filter((d) => d.day >= effectiveFrom && d.day <= effectiveTo)
    const prevRows = completedDays.filter((d) => d.day >= priorFrom && d.day <= priorTo)
    if (currRows.length > 0 && currRows.length === prevRows.length) {
      const currSum = currRows.reduce((s, d) => s + d.netKwd, 0)
      const prevSum = prevRows.reduce((s, d) => s + d.netKwd, 0)
      return pctChange(currSum, prevSum)
    }
  }

  return null
}
