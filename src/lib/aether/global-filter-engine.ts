/**
 * Global Filter Engine — 5D Odoo Slicing, Weighted % Math, 7 Profit Lenses & CFO Realism
 *
 * Powers GlobalFilterContext & TopFilterBar across all 6 Aether BI pillars:
 *   - /erp                   (ملخص الشركة)
 *   - /erp/cores             (تحليل الأرقام)
 *   - /erp/before-after      (مقارنة قبل وبعد)
 *   - /erp/feryal-ai         (المستشارة فريال)
 *   - /erp/aggregator-radar  (مراقبة التوصيل)
 *   - /erp/events-intelligence (حاسبة المعارض)
 *
 * Strictly enforces:
 *   1. ONLY the 6 approved Venture Foods restaurant brands (zero canceled/banned brands).
 *   2. ONLY the 7 active Odoo restaurant locations (+ EXB booths in exhibitions).
 *   3. Automatic fallback on `today` (`اليوم`) to last completed POS operating day when early morning receipts = 0.
 *   4. 5D slicing: Period × Kuwait Slice × Brand × Branch × Channel + 7 Profit Lenses.
 *   5. Strict weighted `%` math (`sum(net) / sum(sales)`) — zero unweighted averages of percentages.
 */

import { ODOO } from '@/lib/odoo/odoo-dataset'
import {
  BRANCH_TRUE_CASH,
  JOURNEY_PLAYS,
  JOURNEY_SHORTCUTS,
  type JourneyPlay,
} from '@/lib/full-journey-enterprise-brain'
import {
  buildCfoRealismForPlay,
  scaleCfoTiers,
  type CfoRealismProfile,
} from '@/lib/odoo-cfo-realism'
import type {
  OdooBucketSummary,
  OdooLiveSummary,
  OdooPeriodBucketKey,
} from '@/lib/odoo/live-sync-core'

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

export const DEFAULT_CUSTOM_FROM = '2026-10-15'
export const DEFAULT_CUSTOM_TO = '2026-11-13'

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

/** Kuwait behavioral time slices (audit ref: أيام الرواتب ٢٠–٢٨ | منتصف الشهر ١٠–١٩ | الويكند والزوارة | الساعات الهادئة ٣–٦) — rendered in Western 0-9 numerals */
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
  { id: 'delivery-audit', ar: 'تدقيق عمولات التوصيل 🛵', en: 'Delivery Fee Audit 🛵' },
  { id: 'ardiya-buying', ar: 'مطبخ العارضية والمشتريات 🏭', en: 'Ardiya & Buying 🏭' },
  { id: 'quiet-hours', ar: 'فرص الساعات الهادئة ⏰', en: 'Quiet Hours Upside ⏰' },
  { id: 'payday-weekend', ar: 'فورة الرواتب والويكند 🔥', en: 'Payday & Weekend 🔥' },
] as const

/** ONLY the 6 approved Venture Foods restaurant brands — never include canceled or school canteen brands. */
export const GLOBAL_BRAND_OPTIONS: readonly FilterOption<GlobalBrand>[] = [
  { id: 'all', ar: 'كل المطاعم', en: 'All Brands' },
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
] as const

export const APPROVED_BRANCH_IDS: readonly Exclude<GlobalBranch, 'all'>[] = [
  'avenues',
  '360-mall',
  'assima',
  'promenade',
  'salmiya',
  'al-kout',
  'ardiya',
] as const

export const GLOBAL_CHANNEL_OPTIONS: readonly FilterOption<GlobalChannel>[] = [
  { id: 'all', ar: 'كل القنوات', en: 'All Channels' },
  { id: 'dine-in', ar: 'الصالة', en: 'Dine-in' },
  { id: 'takeaway-direct', ar: 'سفري ومباشر', en: 'Takeaway/Direct' },
  { id: 'talabat-tgo', ar: 'طلبات Tgo', en: 'Talabat Tgo' },
  { id: 'talabat-tmp', ar: 'منصة توصيل طلبات TMP', en: 'Talabat TMP' },
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

const BRAND_SET = new Set<string>(APPROVED_BRAND_IDS)
const BRANCH_SET = new Set<string>(APPROVED_BRANCH_IDS)

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

/**
 * Formal Arabic number-noun agreement for days (`يوم واحد`, `يومان`, `6 أيام`, `11 يوماً`) using Western 0-9 numerals.
 */
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

/**
 * Formal Arabic prepositional phrase `خلال ...` (`خلال يوم واحد`, `خلال يومين`, `خلال 6 أيام`, `خلال 11 يوماً`).
 */
export function formatArWithinDays(n: number): string {
  const count = Math.max(0, Math.round(Number.isFinite(n) ? n : 0))
  if (count === 1) return 'خلال يوم واحد'
  if (count === 2) return 'خلال يومين'
  return `خلال ${formatArDays(count)}`
}

/**
 * Formal Arabic number-noun agreement for opportunities (`فرصة واحدة`, `فرصتان`, `6 فرص`, `27 فرصة`) using Western 0-9 numerals.
 */
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

function shiftIsoDateDays(iso: string, deltaDays: number): string {
  const ms = Date.parse(`${iso}T12:00:00Z`)
  if (!Number.isFinite(ms)) return iso
  return new Date(ms + deltaDays * 86_400_000).toISOString().slice(0, 10)
}

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
 * directly from the Odoo 17 dataset buckets (where bucket `to` is exclusive `[from, to)`).
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
    const labels = formatInclusiveIsoRangeLabels(f, t)
    return { fromIso: f, toInclusiveIso: t, ...labels }
  }

  const snapBuckets = (
    ODOO as unknown as {
      buckets?: Partial<Record<OdooPeriodBucketKey, OdooBucketSummary>>
    }
  ).buckets
  let bkt = opts?.liveSummary?.buckets?.[period] ?? snapBuckets?.[period]
  if (
    period === 'today' &&
    (!bkt || (bkt.totals?.restaurantOrders ?? 0) <= 0) &&
    snapBuckets?.today
  ) {
    bkt = snapBuckets.today
  }

  const fromIso = bkt?.from ?? (period === 'year' ? '2026-01-01' : '2026-10-15')
  const rawExclTo = bkt?.to ?? '2026-11-14'
  const shiftedEnd = shiftIsoDateDays(rawExclTo, -1)
  const toInclusiveIso = shiftedEnd >= fromIso ? shiftedEnd : fromIso
  const labels = formatInclusiveIsoRangeLabels(fromIso, toInclusiveIso)
  return { fromIso, toInclusiveIso, ...labels }
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

// ---------------------------------------------------------------------------
// 30-day Reference Dimensional Cube & Kuwait Time-Profile Calibration
// ---------------------------------------------------------------------------
type BrandKey = Exclude<GlobalBrand, 'all'>
type BranchKey = Exclude<GlobalBranch, 'all'>
type ChannelKey = Exclude<GlobalChannel, 'all'>

const safeNum = (v: unknown, fb = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fb

const safeDiv = (num: number, den: number, fb = 0): number =>
  den > 0 && Number.isFinite(num) && Number.isFinite(den) ? num / den : fb

const CHANNEL_COMM_PER10: Record<ChannelKey, number> = {
  'dine-in': 0.0,
  'takeaway-direct': 0.18,
  'talabat-tgo': 1.85,
  'talabat-tmp': 1.35,
  keeta: 1.92,
  deliveroo: 1.78,
  jahez: 1.5,
  snoonu: 1.5,
}

const BRAND_FOOD_PER10: Record<BrandKey, number> = {
  'china-garden': 2.64,
  franks: 2.95,
  tahina: 2.52,
  'farm-brown': 2.82,
  'noodle-bar': 2.58,
  'karak-cafeteria': 2.25,
}

interface Cube30Data {
  cell: Record<string, number> // `${brand}|${branch}|${channel}` -> netKwd (sales net of tax/discounts)
  cellPocket: Record<string, number> // `${brand}|${branch}|${channel}` -> true net pocket KWD
  brandBranch: Record<string, number>
  brandChannel: Record<string, number>
  branchChannel: Record<string, number>
  byBrand: Record<BrandKey, { netKwd: number; orders: number }>
  byBranch: Record<BranchKey, { netKwd: number; orders: number }>
  byChannel: Record<ChannelKey, { netKwd: number; orders: number }>
  branchFixed10: Record<BranchKey, number>
  totalNet30: number
  totalPocket30: number
  totalOrders30: number
}

const CUBE30: Cube30Data = (() => {
  const cell: Record<string, number> = {}
  const addCell = (b: string, loc: string, ch: ChannelKey, val: number) => {
    if (!BRAND_SET.has(b) || !BRANCH_SET.has(loc) || val <= 0) return
    const k = `${b}|${loc}|${ch}`
    cell[k] = (cell[k] ?? 0) + val
  }

  const rawBuckets = (ODOO as unknown as { buckets?: Partial<Record<OdooPeriodBucketKey, OdooBucketSummary>> }).buckets
  const monthBkt = rawBuckets?.month

  // Hall vs Direct-Shop ratio per restaurant branch in 30d
  const hallShareOfShop: Record<string, number> = {}
  for (const r of ODOO.restaurants) {
    if (!BRANCH_SET.has(r.id)) continue
    const shopAmt = r.channels.find((c) => c.channel === 'shop')?.amountKwd ?? 0
    const bLoc = monthBkt?.byLocation?.[r.id] as { hallShopKwd?: number } | undefined
    if (r.id === 'ardiya') {
      hallShareOfShop[r.id] = 0
    } else if (bLoc && typeof bLoc.hallShopKwd === 'number' && shopAmt > 0) {
      hallShareOfShop[r.id] = Math.min(1, Math.max(0, bLoc.hallShopKwd / shopAmt))
    } else {
      hallShareOfShop[r.id] = 0.92
    }
  }

  for (const row of ODOO.cube) {
    const b = row.brand
    if (!BRAND_SET.has(b)) continue
    const loc = (row.location as string) === 'call-center' ? 'ardiya' : row.location
    if (!BRANCH_SET.has(loc)) continue
    const net = safeNum(row.netKwd)
    if (net <= 0) continue

    const chStr = row.channel as string
    if (chStr === 'talabat-tgo') addCell(b, loc, 'talabat-tgo', net)
    else if (chStr === 'talabat-tmp') addCell(b, loc, 'talabat-tmp', net)
    else if (chStr === 'keeta') addCell(b, loc, 'keeta', net)
    else if (chStr === 'deliveroo-go' || chStr === 'deliveroo-mp') addCell(b, loc, 'deliveroo', net)
    else if (chStr === 'jahez') addCell(b, loc, 'jahez', net)
    else if (chStr === 'snoonu') addCell(b, loc, 'snoonu', net)
    else if (chStr === 'online-link' || chStr === 'cod') addCell(b, loc, 'takeaway-direct', net)
    else {
      const hr = hallShareOfShop[loc] ?? (loc === 'ardiya' ? 0 : 0.9)
      addCell(b, loc, 'dine-in', net * hr)
      addCell(b, loc, 'takeaway-direct', net * (1 - hr))
    }
  }

  const branchFixed10 = {} as Record<BranchKey, number>
  for (const lid of APPROVED_BRANCH_IDS) {
    const btc = BRANCH_TRUE_CASH.find((x) => x.id === lid)
    if (btc && btc.posNet > 0) {
      const ratio = ((btc.rent + btc.effectiveLabor + btc.branchOpex + btc.sharedAlloc) / btc.posNet) * 10
      branchFixed10[lid] = Math.min(5.2, Math.max(2.1, ratio))
    } else {
      branchFixed10[lid] = safeNum(JOURNEY_SHORTCUTS.netPocket.branchOpexRent10, 3.45)
    }
  }

  const brandBranch: Record<string, number> = {}
  const brandChannel: Record<string, number> = {}
  const branchChannel: Record<string, number> = {}
  const cellPocket: Record<string, number> = {}
  let totalPocket30 = 0

  for (const [k, v] of Object.entries(cell)) {
    const [b, l, c] = k.split('|') as [BrandKey, BranchKey, ChannelKey]
    brandBranch[`${b}|${l}`] = (brandBranch[`${b}|${l}`] ?? 0) + v
    brandChannel[`${b}|${c}`] = (brandChannel[`${b}|${c}`] ?? 0) + v
    branchChannel[`${l}|${c}`] = (branchChannel[`${l}|${c}`] ?? 0) + v

    const food10 = Math.max(2.05, (BRAND_FOOD_PER10[b] ?? 2.68) - (c === 'dine-in' ? 0.18 : 0))
    const deliv10 = CHANNEL_COMM_PER10[c] ?? 1.35
    const opex10 = branchFixed10[l] ?? 3.45
    const pocketPer10 = Math.max(0.35, 10 - food10 - deliv10 - opex10)
    const pVal = v * (pocketPer10 / 10)
    cellPocket[k] = pVal
    totalPocket30 += pVal
  }

  const byBrand = {} as Record<BrandKey, { netKwd: number; orders: number }>
  for (const bid of APPROVED_BRAND_IDS) {
    const ob = ODOO.brands.find((x) => x.id === bid)
    byBrand[bid] = { netKwd: safeNum(ob?.netKwd), orders: safeNum(ob?.orders) }
  }

  const byBranch = {} as Record<BranchKey, { netKwd: number; orders: number }>
  for (const lid of APPROVED_BRANCH_IDS) {
    const ol = ODOO.restaurants.find((x) => x.id === lid)
    byBranch[lid] = { netKwd: safeNum(ol?.netKwd), orders: safeNum(ol?.orders) }
  }

  const byChannel = {} as Record<ChannelKey, { netKwd: number; orders: number }>
  for (const cid of APPROVED_CHANNEL_IDS) {
    const mUi = monthBkt?.uiChannels?.[cid]
    if (mUi) {
      byChannel[cid] = { netKwd: safeNum(mUi.netKwd), orders: safeNum(mUi.orders) }
    } else {
      let sumNet = 0
      for (const bid of APPROVED_BRAND_IDS) sumNet += brandChannel[`${bid}|${cid}`] ?? 0
      byChannel[cid] = { netKwd: sumNet, orders: Math.round(sumNet / 4.8) }
    }
  }

  const totalNet30 = APPROVED_BRANCH_IDS.reduce((s, lid) => s + byBranch[lid].netKwd, 0) || ODOO.totals.restaurantNetKwd
  const totalOrders30 = APPROVED_BRANCH_IDS.reduce((s, lid) => s + byBranch[lid].orders, 0) || ODOO.totals.restaurantOrders

  return {
    cell,
    cellPocket,
    brandBranch,
    brandChannel,
    branchChannel,
    byBrand,
    byBranch,
    byChannel,
    branchFixed10,
    totalNet30,
    totalPocket30,
    totalOrders30,
  }
})()

// Calibrate Kuwait Time Slices from live ODOO.timeProfile.daily & hourly
const KUWAIT_SLICE_PROFILE = (() => {
  const tp = (ODOO as unknown as {
    timeProfile?: {
      daily?: { day: string; orders: number; netKwd: number }[]
      hourly?: { hour: number; orders: number; netKwd: number }[]
    }
  }).timeProfile

  const fullDays = (tp?.daily ?? []).filter((d) => d.orders >= 100 && d.netKwd > 0)
  const totalDailyNet = fullDays.reduce((s, d) => s + d.netKwd, 0) || 1
  const totalDailyOrd = fullDays.reduce((s, d) => s + d.orders, 0) || 1
  const avgDayNet = fullDays.length > 0 ? totalDailyNet / fullDays.length : 4300
  const avgDayOrd = fullDays.length > 0 ? totalDailyOrd / fullDays.length : 850
  const lastCompletedDay = fullDays[fullDays.length - 1] ?? {
    day: '2026-11-13',
    orders: 431,
    netKwd: 2671.027,
  }

  const paydayDays = fullDays.filter((d) => {
    const dom = Number(d.day.slice(8, 10))
    return dom >= 20 && dom <= 28
  })
  const midMonthDays = fullDays.filter((d) => {
    const dom = Number(d.day.slice(8, 10))
    return dom >= 10 && dom <= 19
  })
  const weekendDays = fullDays.filter((d) => {
    const dow = new Date(`${d.day}T12:00:00Z`).getUTCDay()
    return dow === 4 || dow === 5 || dow === 6 // Thu, Fri, Sat in Kuwait
  })

  const hourly = tp?.hourly ?? []
  const totalHourlyNet = hourly.reduce((s, h) => s + h.netKwd, 0) || 1
  const totalHourlyOrd = hourly.reduce((s, h) => s + h.orders, 0) || 1
  const quietRows = hourly.filter((h) => h.hour >= 15 && h.hour <= 17) // 3:00 PM – 6:00 PM
  const quietNetShare = Math.min(0.45, Math.max(0.12, quietRows.reduce((s, h) => s + h.netKwd, 0) / totalHourlyNet))
  const quietOrdShare = Math.min(0.48, Math.max(0.14, quietRows.reduce((s, h) => s + h.orders, 0) / totalHourlyOrd))

  const calcDaySlice = (rows: typeof fullDays, fbShare: number, fbLift: number) => {
    if (rows.length === 0) return { periodShareNet: fbShare, periodShareOrd: fbShare, dayLiftNet: fbLift, dayLiftOrd: fbLift, daysCount: Math.round(30 * fbShare) }
    const sNet = rows.reduce((s, r) => s + r.netKwd, 0)
    const sOrd = rows.reduce((s, r) => s + r.orders, 0)
    return {
      periodShareNet: sNet / totalDailyNet,
      periodShareOrd: sOrd / totalDailyOrd,
      dayLiftNet: sNet / rows.length / avgDayNet,
      dayLiftOrd: sOrd / rows.length / avgDayOrd,
      daysCount: rows.length,
    }
  }

  return {
    lastCompletedDay,
    payday: calcDaySlice(paydayDays, 0.34, 1.18),
    midMonth: calcDaySlice(midMonthDays, 0.29, 0.89),
    weekend: calcDaySlice(weekendDays, 0.39, 1.34),
    quietHours: {
      netShare: quietNetShare,
      ordShare: quietOrdShare,
    },
  }
})()

function healthDotFromPct(weightedPct: number, salesKwd: number): HealthDot {
  if (salesKwd <= 0.05 || weightedPct < 10.5) return '🔴'
  if (weightedPct < 18.5) return '🟠'
  return '🟢'
}

/**
 * Strict weighted `%` math (`sum(netPocket) / sum(sales) * 100`) across matching atomic cube cells.
 */
export function computeWeightedCellMargin(filterFn: (b: BrandKey, l: BranchKey, c: ChannelKey) => boolean): {
  salesKwd: number
  netPocketKwd: number
  weightedNetPct: number
} {
  let sumSales = 0
  let sumPocket = 0
  for (const [k, salesVal] of Object.entries(CUBE30.cell)) {
    const [b, l, c] = k.split('|') as [BrandKey, BranchKey, ChannelKey]
    if (!filterFn(b, l, c)) continue
    sumSales += salesVal
    sumPocket += CUBE30.cellPocket[k] ?? 0
  }
  const weightedNetPct = sumSales > 0 ? Math.round((sumPocket / sumSales) * 1000) / 10 : 0
  return { salesKwd: sumSales, netPocketKwd: sumPocket, weightedNetPct }
}

/** Checks if a brand operates in a branch based on real Odoo 30-day cube records. */
export function isBrandBranchCompatible(brand: GlobalBrand, branch: GlobalBranch): boolean {
  if (brand === 'all' || branch === 'all') return true
  return (CUBE30.brandBranch[`${brand}|${branch}`] ?? 0) > 0.05
}

// ---------------------------------------------------------------------------
// Plain 2–3 Word Recommendation Simplifier & Filter Matcher
// ---------------------------------------------------------------------------
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

function detectPlayScope(p: JourneyPlay): {
  brands: readonly BrandKey[] | 'all'
  branches: readonly BranchKey[] | 'all'
  channels: readonly ChannelKey[] | 'all'
} {
  const txt = `${p.id} ${p.subjectEn} ${p.titleEn}`.toLowerCase()
  const matchedBrands = APPROVED_BRAND_IDS.filter((bid) => {
    if (bid === 'china-garden') return txt.includes('china garden') || txt.includes('china-garden')
    if (bid === 'franks') return txt.includes('frank')
    if (bid === 'tahina') return txt.includes('tahina')
    if (bid === 'farm-brown') return txt.includes('farm brown') || txt.includes('farm-brown')
    if (bid === 'noodle-bar') return txt.includes('noodle')
    if (bid === 'karak-cafeteria') return txt.includes('karak')
    return false
  })
  const matchedBranches = APPROVED_BRANCH_IDS.filter((lid) => {
    if (lid === '360-mall') return txt.includes('360')
    if (lid === 'al-kout') return txt.includes('kout')
    if (lid === 'salmiya') return txt.includes('salmiya') || txt.includes('salmyia')
    return txt.includes(lid)
  })
  const matchedChannels: ChannelKey[] = []
  if (txt.includes('talabat') && txt.includes('tmp')) matchedChannels.push('talabat-tmp', 'talabat-tgo')
  else if (txt.includes('talabat')) matchedChannels.push('talabat-tgo', 'talabat-tmp')
  if (txt.includes('keeta')) matchedChannels.push('keeta')
  if (txt.includes('deliveroo')) matchedChannels.push('deliveroo')
  if (txt.includes('jahez')) matchedChannels.push('jahez')
  if (txt.includes('snoonu')) matchedChannels.push('snoonu')
  if (txt.includes('counter') || txt.includes('dine')) matchedChannels.push('dine-in')
  if (txt.includes('direct') || txt.includes('whatsapp')) matchedChannels.push('takeaway-direct')

  return {
    brands: matchedBrands.length > 0 ? matchedBrands : 'all',
    branches: matchedBranches.length > 0 ? matchedBranches : 'all',
    channels: matchedChannels.length > 0 ? [...new Set(matchedChannels)] : 'all',
  }
}

const fKwd = (v: number, ar: boolean): string => {
  const rounded = v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1)
  return ar ? `${rounded} د.ك` : `${rounded} KWD`
}

const SPECIFIC_PLAY_COPY: Record<
  string,
  {
    titleAr: string
    titleEn: string
    problemAr: string
    problemEn: string
    solutionAr: string
    solutionEn: string
  }
> = {
  'proc-price-creep': {
    titleAr: 'فرق سعر مورد',
    titleEn: 'Supplier Price Rise',
    problemAr: 'ارتفعت أسعار بعض مواد المطبخ تدريجياً عن الشهر الماضي بدون إشعار مسبق.',
    problemEn: 'Several kitchen ingredients crept up in price vs last month without notice.',
    solutionAr: 'تثبيت أسعار العقود ومطالبة المورد بفرق السعر أو طلب عرض بديل.',
    solutionEn: 'Lock contract prices and request a supplier credit or alternate quote.',
  },
  'proc-vendor-consolidation': {
    titleAr: 'توحيد أسعار الشراء',
    titleEn: 'Unify Vendor Prices',
    problemAr: 'نشتري نفس الصنف الخام من أكثر من مورد بأسعار متفاوتة في أودو.',
    problemEn: 'The same raw ingredient is purchased from multiple vendors at varying rates.',
    solutionAr: 'الشراء بأقل سعر معتمد وتوحيد الطلبية مع المورد الأفضل.',
    solutionEn: 'Standardize orders at the lowest approved vendor contract rate.',
  },
  'proc-packaging-per-order': {
    titleAr: 'تكلفة التغليف لكل طلب',
    titleEn: 'Packaging Cost Cap',
    problemAr: 'صرف علب وأكياس التغليف في بعض الفروع أعلى من عدد طلبات التوصيل الفعلية.',
    problemEn: 'Packaging issuance at select branches exceeds actual delivery order volume.',
    solutionAr: 'ربط صرف العلب والأكياس بعدد الطلبات الفعلي لكل فرع في أودو.',
    solutionEn: 'Tie packaging issuance directly to verified order counts per branch.',
  },
  'kitchen-inventory-variance': {
    titleAr: 'نقص بالمطبخ',
    titleEn: 'Kitchen Food Gap',
    problemAr: 'استهلاك المواد الخام أعلى من المبيعات بعد عزل 6% تقليم الطبخ الطبيعي.',
    problemEn: 'Raw food usage exceeds dishes sold even after 6% normal cooking trim.',
    solutionAr: 'جرد الأصناف البروتينية الغالية نهاية كل شفت ومطابقتها مع مبيعات الكاشير.',
    solutionEn: 'Count top proteins at the end of every shift against POS recipe usage.',
  },
  'kitchen-ardiya-prep-par-shield': {
    titleAr: 'سقف تحضير العارضية',
    titleEn: 'Ardiya Daily Par Prep',
    problemAr: 'دفعات التحضير المركزي بالعارضية تتجاوز السحب الفعلي للفروع في أيام وسط الأسبوع.',
    problemEn: 'Central kitchen prep batches in Ardiya exceed mid-week branch pull.',
    solutionAr: 'ربط جدول تحضير العارضية بسقف سحب يومي مرن لكل فرع حسب اليوم.',
    solutionEn: 'Tie Ardiya central prep batches to dynamic weekday branch par levels.',
  },
  'kitchen-scrap-hotspot': {
    titleAr: 'هدر التحضير بالفروع',
    titleEn: 'Kitchen Prep Waste',
    problemAr: 'توجد كميات طعام تالفة بالفروع بسبب التحضير الزائد قبل وقت الذروة.',
    problemEn: 'Excess pre-peak batching is causing avoidable food scrap at branches.',
    solutionAr: 'تقسيم التحضير على دفعتين حسب حركة البيع الفعلية لتصفير التالف.',
    solutionEn: 'Split branch prep into two smaller waves matched to live order flow.',
  },
  'kitchen-portion-drift': {
    titleAr: 'ضبط أوزان الوجبات',
    titleEn: 'Recipe Portion Control',
    problemAr: 'زيادة غرامات الغرف اليدوي عن الوصفة المعتمدة ترفع تكلفة الطبق بصمت.',
    problemEn: 'Unweighed manual plating drifts above standard recipe gram targets.',
    solutionAr: 'اعتماد ملاعق معيارية وميزان خط التجهيز للأصناف الأعلى مبيعاً.',
    solutionEn: 'Enforce calibrated portion scoops and line scales on top-selling dishes.',
  },
  // Intentionally consolidated across China Garden & Frank's into ONE unified Menu Price Tweak play:
  'menu-reprice-china-garden': {
    titleAr: 'تعديل سعر صنف',
    titleEn: 'Menu Price Tweak',
    problemAr: 'الأصناف الأكثر مبيعاً هامش ربحها أقل بسبب ثبات سعرها القديم أمام ارتفاع الكلفة.',
    problemEn: 'Top-selling signature mains carry thinner margins due to unchanged older prices.',
    solutionAr: 'زيادة 100–150 فلس على الأصناف القوية مع احتفاظ 94%–97% بالطلبات.',
    solutionEn: 'Apply a 100–150 fils tweak on inelastic mains at 94%–97% guest retention.',
  },
  'menu-reprice-franks': {
    titleAr: 'تعديل سعر صنف',
    titleEn: 'Menu Price Tweak',
    problemAr: 'الأصناف الأكثر مبيعاً هامش ربحها أقل بسبب ثبات سعرها القديم أمام ارتفاع الكلفة.',
    problemEn: 'Top-selling signature mains carry thinner margins due to unchanged older prices.',
    solutionAr: 'زيادة 100–150 فلس على الأصناف القوية مع احتفاظ 94%–97% بالطلبات.',
    solutionEn: 'Apply a 100–150 fils tweak on inelastic mains at 94%–97% guest retention.',
  },
  // Intentionally consolidated single-item basket combo plays into ONE unified Drink & Combo Add-on play:
  'menu-basket-china-garden': {
    titleAr: 'إضافة مشروب وكومبو',
    titleEn: 'Drink & Combo Add-on',
    problemAr: 'أغلب الفواتير تخرج بصنف واحد بدون مشروب أو طبق جانبي عالي الهامش.',
    problemEn: 'Most single-item orders go out without a high-margin drink or side.',
    solutionAr: 'عرض مشروب وسبرنغ رول عند الدفع بتحويل واقعي 8%–15% من السلات.',
    solutionEn: 'Prompt a drink or spring roll combo targeting 8%–15% basket conversion.',
  },
  'menu-shop-basket-china-garden': {
    titleAr: 'إضافة مشروب وكومبو',
    titleEn: 'Drink & Combo Add-on',
    problemAr: 'أغلب الفواتير تخرج بصنف واحد بدون مشروب أو طبق جانبي عالي الهامش.',
    problemEn: 'Most single-item orders go out without a high-margin drink or side.',
    solutionAr: 'عرض مشروب وسبرنغ رول عند الدفع بتحويل واقعي 8%–15% من السلات.',
    solutionEn: 'Prompt a drink or spring roll combo targeting 8%–15% basket conversion.',
  },
  'menu-channel-price-shield': {
    titleAr: 'تسعير قنوات التوصيل',
    titleEn: 'Aggregator Menu Pricing',
    problemAr: 'بيع بعض الوجبات بنفس سعر الصالة على التطبيقات يلتهم هامش الربح بعد العمولة.',
    problemEn: 'Selling select combos at dine-in parity on high-fee apps erodes net margin.',
    solutionAr: 'ضبط هيكل أسعار التطبيقات لتغطية العمولة مع إبراز ميزة السعر للطلب المباشر.',
    solutionEn: 'Align delivery app menu pricing to protect net pocket margin vs direct orders.',
  },
  'menu-kuwait-calendar-tactical': {
    titleAr: 'باقات الرواتب والويكند',
    titleEn: 'Payday & Weekend Bundles',
    problemAr: 'ذروة الرواتب وعطلة نهاية الأسبوع تمر بدون باقات عائلية مسبقة التجهيز.',
    problemEn: 'Payday and Thursday-Friday peaks lack pre-built high-margin family platters.',
    solutionAr: 'تفعيل بوكس العائلة والرواتب تلقائياً أيام 24–29 الشهر والخميس والجمعة.',
    solutionEn: 'Auto-feature high-margin family platters on payday week and weekends.',
  },
  'menu-kitchen-drag-farm-brown': {
    titleAr: 'تقليص الأصناف البطيئة',
    titleEn: 'Trim Slow Menu Tail',
    problemAr: 'الأصناف النادرة الطلب تبطئ خط التجهيز وتزيد هدر التحضير المسبق.',
    problemEn: 'Low-velocity tail items slow kitchen ticket times and inflate prep waste.',
    solutionAr: 'إيقاف الأصناف ضعيفة الدوران في ذروة المساء والتركيز على الأطباق المربحة.',
    solutionEn: 'Retire slow-moving tail SKUs during peak hours to speed up kitchen throughput.',
  },
  'ops-cashier-upsell-incentive': {
    titleAr: 'حافز البيع الإضافي للكاشير',
    titleEn: 'Cashier Upsell Prompt',
    problemAr: 'تفاوت واضح في متوسط الفاتورة بين موظفي الكاشير لنفس الفرع والشفت.',
    problemEn: 'Average check varies sharply across POS cashiers on the exact same shift.',
    solutionAr: 'ربط شاشة الكاشير باقتراح فوري للمقبلات والمشروب مع حافز شهري بسيط.',
    solutionEn: 'Enable one-tap POS side/drink prompts with a clear monthly cashier target.',
  },
  'ops-discount-discipline': {
    titleAr: 'ضبط الخصومات والمجاني',
    titleEn: 'Cap Freebies & Discounts',
    problemAr: 'توجد خصومات يدوية وطلبات ضيافة متفرقة بالكاشير تقلل صافي المبيعات.',
    problemEn: 'Manual POS discounts and unlogged comps are trimming net branch sales.',
    solutionAr: 'قصر الخصم والضيافة على رمز المدير فقط وبسقف يومي واضح.',
    solutionEn: 'Require manager PIN and enforce a strict daily cap for POS discounts.',
  },
  'ops-session-discipline': {
    titleAr: 'التزام فتح وإغلاق الفروع',
    titleEn: 'On-Time Shift Discipline',
    problemAr: 'تأخر فتح جلسات الكاشير أو الإغلاق غير المطابق يضيع طلبات أول وآخر اليوم.',
    problemEn: 'Late POS session openings or unclosed shifts miss ready orders and delay audit.',
    solutionAr: 'إلزام فتح وإغلاق جلسات الكاشير والأجهزة اللوحية بالموعد المحدد في كل شفت.',
    solutionEn: 'Enforce on-time POS and aggregator tablet session discipline every shift.',
  },
  'ops-shift-realign-360-mall': {
    titleAr: 'توزيع طاقم ساعات الذروة',
    titleEn: 'Peak Shift Crew Match',
    problemAr: 'توزيع شفتات الموظفين ثابت بينما تتركز الطلبات فعلياً في ذروة الغداء والمساء.',
    problemEn: 'Flat crew scheduling leaves peak rush understaffed and quiet hours idle.',
    solutionAr: 'تقديم ساعة حضور شفت المساء لتغطية الذروة وتقليل الساعات الإضافية.',
    solutionEn: 'Stagger shift starts to match hourly order peaks without overtime.',
  },
  'opex-host-kitchen-avenues': {
    titleAr: 'تشغيل علامة إضافية بالمطبخ',
    titleEn: 'Add Brand to Kitchen',
    problemAr: 'بعض مطابخنا تشغّل علامة واحدة رغم قدرتها على تجهيز علامة ثانية بنفس الفريق.',
    problemEn: 'Existing kitchens have spare capacity to run a second brand on the same team.',
    solutionAr: 'تشغيل فرانكس أو نودل بار من نفس المطبخ الحالي لزيادة المبيعات بدون إيجار جديد.',
    solutionEn: "Launch Frank's or Noodle Bar from existing kitchens with zero extra rent.",
  },
  // Intentionally consolidated OPEX petty-cash/off-PO governance twins into ONE unified play:
  'opex-custody-offpo-anomalies': {
    titleAr: 'ضبط العهد وفواتير بدون طلب شراء',
    titleEn: 'Tighten Petty Cash & Off-PO Bills',
    problemAr: 'توجد عهد نقدية وفواتير عامة دخلت الحسابات بدون طلب شراء أو توزيع فرعي.',
    problemEn: 'Open cash custodies and direct bills posted without PO or branch analytic tag.',
    solutionAr: 'منع صرف أي فاتورة بلا أمر شراء معتمد وتصفية العهد النقدية أسبوعياً لكل فرع.',
    solutionEn: 'Require approved POs before bill payment and settle branch petty cash weekly.',
  },
  'opex-unallocated-analytic-governance': {
    titleAr: 'ضبط العهد وفواتير بدون طلب شراء',
    titleEn: 'Tighten Petty Cash & Off-PO Bills',
    problemAr: 'توجد عهد نقدية وفواتير عامة دخلت الحسابات بدون طلب شراء أو توزيع فرعي.',
    problemEn: 'Open cash custodies and direct bills posted without PO or branch analytic tag.',
    solutionAr: 'منع صرف أي فاتورة بلا أمر شراء معتمد وتصفية العهد النقدية أسبوعياً لكل فرع.',
    solutionEn: 'Require approved POs before bill payment and settle branch petty cash weekly.',
  },
  'opex-repair-loop-capex': {
    titleAr: 'تكرار صيانة المعدات',
    titleEn: 'Repeat Equipment Fixes',
    problemAr: 'بعض أجهزة التبريد والقلي تتكرر عليها فواتير الصيانة أكثر من قيمة استبدالها.',
    problemEn: 'Repeated emergency repair bills on aging kitchen units cost more than replacement.',
    solutionAr: 'استبدال القطعة كثيرة الأعطال أو توقيع عقد صيانة وقائية ثابت السعر.',
    solutionEn: 'Replace repeat-failure units or lock a flat preventive maintenance contract.',
  },
  'opex-cross-branch-anomalies': {
    titleAr: 'مراجعة مصاريف الفروع الشاذة',
    titleEn: 'Branch Expense Outlier Cap',
    problemAr: 'بعض الفروع تسجل استهلاك مستلزمات وخدمات أعلى بوضوح من فروع مماثلة بالمبيعات.',
    problemEn: 'Select branches log noticeably higher consumables and utility spend than peers.',
    solutionAr: 'ربط سقف المصاريف التشغيلية الشهرية بنسبة ثابتة من مبيعات كل فرع.',
    solutionEn: 'Benchmark and cap monthly branch consumables as a fixed share of sales.',
  },
  'delivery-corporate-diwaniya-direct': {
    titleAr: 'طلبات الديوانيات والشركات المباشرة',
    titleEn: 'Direct Diwaniya & Office Catering',
    problemAr: 'طلبات المجموعات والديوانيات تمر عبر التطبيقات بعمولة عالية بدلاً من الطلب المباشر.',
    problemEn: 'Large office and Diwaniya platters route through high-commission apps.',
    solutionAr: 'تخصيص خط واتساب سريع لباقات الشركات والديوانيات بدون عمولة وسطاء.',
    solutionEn: 'Route corporate lunches and Diwaniya platters via 0%-fee direct WhatsApp.',
  },
  'delivery-promo-burn': {
    titleAr: 'سقف الخصم التشاركي بالتطبيقات',
    titleEn: 'Aggregator Promo Spend Cap',
    problemAr: 'بعض حملات الخصم التلقائية بالتطبيقات تخصم من صافي الفاتورة بدون حد أدنى مجزٍ.',
    problemEn: 'Uncapped co-funded aggregator promos erode per-order net pocket cash.',
    solutionAr: 'قصر العروض التشاركية على حد أدنى للطلب 5.500 د.ك وسقف خصم معتمد 10%.',
    solutionEn: 'Gate co-funded app promos behind a 5.500 KWD minimum basket and 10% cap.',
  },
  'delivery-commission-keeta': {
    titleAr: 'ضبط عمولة وخصومات كيتا',
    titleEn: 'Keeta Promo & Fee Cap',
    problemAr: 'تراكم العمولة مع حملات الخصم المشتركة في كيتا يقلص صافي الربح لكل طلب.',
    problemEn: 'Stacked commission and co-funded discounts on Keeta squeeze per-order profit.',
    solutionAr: 'تحديد سقف الخصم التشاركي على كيتا وقصره على الأصناف عالية الهامش.',
    solutionEn: 'Cap co-funded Keeta discounts and restrict promos to high-margin bundles.',
  },
  'delivery-unsettled-clearing': {
    titleAr: 'تحصيل ذمم منصات التوصيل المتراكمة',
    titleEn: 'Collect App Payouts',
    problemAr: 'توجد مبالغ مبيعات معلقة في حسابات تسوية تطبيقات التوصيل تحتاج مطابقة وتحصيلاً.',
    problemEn: 'Open delivery aggregator clearing balances require weekly payout matching.',
    solutionAr: 'مطابقة كشوف طلبات وكيتا وديليفرو أسبوعياً وتحصيل أي فروقات متأخرة فوراً.',
    solutionEn: 'Reconcile Talabat, Keeta, and Deliveroo statements weekly to clear overdue dues.',
  },
  'delivery-tgo-tmp-mix': {
    titleAr: 'التحويل إلى منصة توصيل طلبات TMP',
    titleEn: 'Shift to TMP (15%)',
    problemAr: 'الاعتماد الكامل على عمولة Tgo المرتفعة يقلل الصافي المتبقي للشركة في الطلبات القريبة.',
    problemEn: 'Relying solely on Tgo fleet fees trims take-home cash on nearby delivery zones.',
    solutionAr: 'تشغيل سائقي الشركة عبر منصة توصيل طلبات TMP (15%) في الفروع المؤهلة لتوفير فرق العمولة.',
    solutionEn: 'Activate company-driver TMP (15%) in eligible branches to save commission spread.',
  },
  'quality-retention': {
    titleAr: 'زيادة العملاء الدائمين مباشرة',
    titleEn: 'Grow Direct Repeat Guests',
    problemAr: 'أغلب العملاء المتكررين يعيدون الطلب عبر التطبيقات فنخسر العمولة في كل مرة.',
    problemEn: 'Repeat guests keep re-ordering via high-fee apps instead of direct channels.',
    solutionAr: 'وضع كرت QR للطلب المباشر داخل كل كيس توصيل لمنح العميل ميزة فورية بالطلب القادم.',
    solutionEn: 'Insert a direct-order VIP QR card in every delivery bag to convert repeat guests.',
  },
  'quality-cancellations': {
    titleAr: 'تقليل إلغاء وتأخير الطلبات',
    titleEn: 'Cut Late-Order Refunds',
    problemAr: 'إلغاء الطلبات المتأخرة ومرتجعات النواقص يخصم قيمة الوجبة كاملة من صافي الفرع.',
    problemEn: 'Late-order cancellations and missing-item refunds deduct full order value.',
    solutionAr: 'فحص مطابقة الفاتورة قبل تسليم السائق وتنبيه الشيف عند تجاوز التحضير 12 دقيقة.',
    solutionEn: 'Verify bag accuracy at handoff and alert kitchen leads past the 12-minute mark.',
  },
}

function simplifyPlayCopy(p: JourneyPlay): {
  titleAr: string
  titleEn: string
  problemAr: string
  problemEn: string
  solutionAr: string
  solutionEn: string
} {
  const known = SPECIFIC_PLAY_COPY[p.id]
  if (known) return known
  return {
    titleAr: p.titleAr || p.id,
    titleEn: p.titleEn || p.id,
    problemAr: `مراجعة تشغيلية: ${p.titleAr || p.id}`,
    problemEn: `Operational review: ${p.titleEn || p.id}`,
    solutionAr: `تطبيق خطة التحسين لـ ${p.titleAr || p.id}`,
    solutionEn: `Apply optimization plan for ${p.titleEn || p.id}`,
  }
}

function normalizePlayDedupKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatConsolidatedScopeLabel(
  brands: readonly BrandKey[] | 'all',
  branches: readonly BranchKey[] | 'all',
  specificBrands: ReadonlySet<BrandKey>,
  specificBranches: ReadonlySet<BranchKey>,
  isAr: boolean,
): string {
  const orderedBranches = APPROVED_BRANCH_IDS.filter((id) =>
    branches !== 'all' ? branches.includes(id) : specificBranches.has(id),
  )
  const orderedBrands = APPROVED_BRAND_IDS.filter((id) =>
    brands !== 'all' ? brands.includes(id) : specificBrands.has(id),
  )

  const branchText =
    orderedBranches.length > 0
      ? orderedBranches.map((id) => getBranchLabel(id, isAr)).join(' • ')
      : ''
  const brandText =
    orderedBrands.length > 0
      ? orderedBrands.map((id) => getBrandLabel(id, isAr)).join(' • ')
      : ''

  if (brandText && branchText) return `${brandText} • ${branchText}`
  if (branchText) return branchText
  if (brandText) return brandText
  return isAr ? 'كل المطاعم الـ 6 والفروع الـ 7' : 'All 6 Brands & 7 Branches'
}

function matchesProfitLens(p: JourneyPlay, lens: ProfitLens): boolean {
  if (lens === 'all') return true
  const id = p.id.toLowerCase()
  if (lens === 'bleed') {
    return (
      p.stage === 'kitchen' ||
      p.stage === 'opex' ||
      id.includes('variance') ||
      id.includes('scrap') ||
      id.includes('off-po') ||
      id.includes('keeta') ||
      id.includes('discount')
    )
  }
  if (lens === 'top-pocket') {
    return p.stage === 'menu' || id.includes('host') || id.includes('tmp') || p.stage === 'quality'
  }
  if (lens === 'delivery-audit') {
    return p.stage === 'delivery' || id.includes('tmp') || id.includes('tgo') || id.includes('keeta')
  }
  if (lens === 'ardiya-buying') {
    return p.stage === 'procurement' || p.stage === 'kitchen' || id.includes('ardiya')
  }
  if (lens === 'quiet-hours') {
    return p.stage === 'menu' || id.includes('combo') || id.includes('drink') || p.stage === 'quality'
  }
  if (lens === 'payday-weekend') {
    return p.stage === 'operations' || p.stage === 'menu' || id.includes('host') || id.includes('tmp')
  }
  return true
}

// ---------------------------------------------------------------------------
// Main Workspace Slice Computation
// ---------------------------------------------------------------------------
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
  ctaAr: string
  ctaEn: string
  action: SummaryCardAction
  targetStage?: JourneyPlay['stage'] | 'all'
  href: string
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
  /** False when viewing unfiltered full group scope (brand/branch/channel/slice === 'all') so redundant 14.7% vs 14.7% is hidden */
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
  isTodayFallback: boolean
  todayFallbackDate: string | null
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
  /** Strict weighted net pocket % = (netPocketKwd / salesKwd) * 100 */
  weightedNetPct: number
  /** Group reference weighted net pocket % */
  groupWeightedNetPct: number
  /** Scale of current period + Kuwait slice vs 30-day month */
  periodScale: number
  /** Share of selected brand/branch/channel vs full restaurant group (0..1) */
  dimensionShare: number
  /** Combined scale = salesKwd / 30d group restaurant sales */
  totalScale: number
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

function computeCustomRangeOdooTotals(
  from: string,
  to: string,
  days: number,
  monthGroupSales: number,
  monthGroupOrders: number,
  liveDailySeries?: { day: string; orders: number; netKwd: number }[],
): { salesKwd: number; orders: number } {
  const fullDays = (ODOO.timeProfile?.daily ?? []).filter((d) => d.orders >= 150)
  const dayMap = new Map<string, { day: string; orders: number; netKwd: number }>(
    fullDays.map((d) => [d.day, d]),
  )
  if (Array.isArray(liveDailySeries)) {
    for (const ld of liveDailySeries) {
      if (ld && ld.day && ld.orders > 0 && ld.netKwd > 0) {
        dayMap.set(ld.day, ld)
      }
    }
  }
  const avgDailyNet = monthGroupSales / 30
  const avgDailyOrd = monthGroupOrders / 30

  if (days <= 62 && (fullDays.length > 0 || dayMap.size > 0)) {
    const weekdayBuckets: Record<number, { net: number; ord: number; n: number }> = {}
    for (const d of fullDays) {
      const dow = new Date(`${d.day}T12:00:00Z`).getUTCDay()
      weekdayBuckets[dow] ??= { net: 0, ord: 0, n: 0 }
      weekdayBuckets[dow].net += d.netKwd
      weekdayBuckets[dow].ord += d.orders
      weekdayBuckets[dow].n += 1
    }
    let sumNet = 0
    let sumOrd = 0
    const startMs = Date.parse(`${from}T12:00:00Z`)
    for (let i = 0; i < days; i++) {
      const dt = new Date(startMs + i * 86_400_000)
      const iso = dt.toISOString().slice(0, 10)
      const hit = dayMap.get(iso)
      if (hit) {
        sumNet += hit.netKwd
        sumOrd += hit.orders
      } else {
        const wb = weekdayBuckets[dt.getUTCDay()]
        if (wb && wb.n > 0) {
          sumNet += wb.net / wb.n
          sumOrd += wb.ord / wb.n
        } else {
          sumNet += avgDailyNet
          sumOrd += avgDailyOrd
        }
      }
    }
    return {
      salesKwd: Math.round(sumNet * 1000) / 1000,
      orders: Math.max(1, Math.round(sumOrd)),
    }
  }

  const ratio = days / 30
  return {
    salesKwd: Math.round(monthGroupSales * ratio * 1000) / 1000,
    orders: Math.max(1, Math.round(monthGroupOrders * ratio)),
  }
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

  const rawBuckets = (ODOO as unknown as { buckets?: Partial<Record<OdooPeriodBucketKey, OdooBucketSummary>> }).buckets
  const monthBkt = liveSummary?.buckets?.month ?? rawBuckets?.month

  // Automatic fallback to last completed POS operating day if early-morning `today` receipts === 0
  const bucketKey: OdooPeriodBucketKey | undefined =
    filters.period === 'custom' ? undefined : filters.period
  let activeBkt = bucketKey ? (liveSummary?.buckets?.[bucketKey] ?? rawBuckets?.[bucketKey]) : undefined
  let isTodayFallback = false
  let todayFallbackDate: string | null = null

  if (filters.period === 'today') {
    const liveTodayOrders = safeNum(activeBkt?.totals?.restaurantOrders)
    const liveTodayNet = safeNum(activeBkt?.totals?.restaurantNetKwd)
    if (liveTodayOrders <= 0 || liveTodayNet <= 0) {
      const snapToday = rawBuckets?.today
      if (snapToday && safeNum(snapToday.totals?.restaurantOrders) > 0) {
        activeBkt = snapToday
        isTodayFallback = true
        todayFallbackDate = snapToday.from
      } else {
        isTodayFallback = true
        todayFallbackDate = KUWAIT_SLICE_PROFILE.lastCompletedDay.day
      }
    } else if (activeBkt?.isLatestOperationalDay) {
      isTodayFallback = true
      todayFallbackDate = activeBkt.from
    }
  }

  const monthGroupSales = safeNum(monthBkt?.totals.restaurantNetKwd, CUBE30.totalNet30)
  const monthGroupOrders = safeNum(monthBkt?.totals.restaurantOrders, CUBE30.totalOrders30)

  const customTotals =
    filters.period === 'custom'
      ? computeCustomRangeOdooTotals(
          filters.customFrom,
          filters.customTo,
          customNorm.days,
          monthGroupSales,
          monthGroupOrders,
          liveSummary?.dailySeries,
        )
      : null

  const defaultDays: Record<GlobalPeriod, number> = {
    today: 1,
    week: 7,
    month: 30,
    year: 315,
    custom: customNorm.days,
  }
  let periodDays = safeNum(activeBkt?.days, defaultDays[filters.period])

  const fallbackPeriodRatio: Record<GlobalPeriod, number> = {
    today: safeDiv(KUWAIT_SLICE_PROFILE.lastCompletedDay.netKwd, monthGroupSales, 1 / 30),
    week: 7 / 30,
    month: 1,
    year: 10.9,
    custom: customTotals
      ? safeDiv(customTotals.salesKwd, monthGroupSales, customNorm.days / 30)
      : customNorm.days / 30,
  }

  const basePeriodSales =
    filters.period === 'custom' && customTotals
      ? customTotals.salesKwd
      : activeBkt && safeNum(activeBkt.totals.restaurantNetKwd) > 0
        ? safeNum(activeBkt.totals.restaurantNetKwd)
        : filters.period === 'today'
          ? KUWAIT_SLICE_PROFILE.lastCompletedDay.netKwd
          : monthGroupSales * fallbackPeriodRatio[filters.period]

  const basePeriodOrders =
    filters.period === 'custom' && customTotals
      ? customTotals.orders
      : activeBkt && safeNum(activeBkt.totals.restaurantOrders) > 0
        ? safeNum(activeBkt.totals.restaurantOrders)
        : filters.period === 'today'
          ? KUWAIT_SLICE_PROFILE.lastCompletedDay.orders
          : Math.round(monthGroupOrders * fallbackPeriodRatio[filters.period])

  // Apply Kuwait Slice multiplier from live ODOO.timeProfile
  let sliceNetMult = 1
  let sliceOrdMult = 1
  if (filters.kuwaitSlice === 'payday') {
    if (filters.period === 'today') {
      sliceNetMult = KUWAIT_SLICE_PROFILE.payday.dayLiftNet
      sliceOrdMult = KUWAIT_SLICE_PROFILE.payday.dayLiftOrd
    } else {
      sliceNetMult = KUWAIT_SLICE_PROFILE.payday.periodShareNet
      sliceOrdMult = KUWAIT_SLICE_PROFILE.payday.periodShareOrd
      periodDays = Math.max(1, Math.round(periodDays * (9 / 30)))
    }
  } else if (filters.kuwaitSlice === 'mid-month') {
    if (filters.period === 'today') {
      sliceNetMult = KUWAIT_SLICE_PROFILE.midMonth.dayLiftNet
      sliceOrdMult = KUWAIT_SLICE_PROFILE.midMonth.dayLiftOrd
    } else {
      sliceNetMult = KUWAIT_SLICE_PROFILE.midMonth.periodShareNet
      sliceOrdMult = KUWAIT_SLICE_PROFILE.midMonth.periodShareOrd
      periodDays = Math.max(1, Math.round(periodDays * (10 / 30)))
    }
  } else if (filters.kuwaitSlice === 'weekend') {
    if (filters.period === 'today') {
      sliceNetMult = KUWAIT_SLICE_PROFILE.weekend.dayLiftNet
      sliceOrdMult = KUWAIT_SLICE_PROFILE.weekend.dayLiftOrd
    } else {
      sliceNetMult = KUWAIT_SLICE_PROFILE.weekend.periodShareNet
      sliceOrdMult = KUWAIT_SLICE_PROFILE.weekend.periodShareOrd
      periodDays = Math.max(1, Math.round(periodDays * (12 / 30)))
    }
  } else if (filters.kuwaitSlice === 'quiet-hours') {
    sliceNetMult = KUWAIT_SLICE_PROFILE.quietHours.netShare
    sliceOrdMult = KUWAIT_SLICE_PROFILE.quietHours.ordShare
  }

  const periodGroupSales = basePeriodSales * sliceNetMult
  const periodGroupOrders = Math.max(1, Math.round(basePeriodOrders * sliceOrdMult))
  const basePeriodScale = Math.max(0.01, safeDiv(basePeriodSales, monthGroupSales, fallbackPeriodRatio[filters.period]))
  const periodScale = Math.max(0.004, safeDiv(periodGroupSales, monthGroupSales, basePeriodScale * sliceNetMult))

  // Calculate exact or proportional salesKwd & orders for (period, brand, branch, channel)
  let salesKwd = 0
  let orders = 0

  const { brand, branch, channel } = filters

  if (brand === 'all' && branch === 'all' && channel === 'all') {
    salesKwd = basePeriodSales
    orders = basePeriodOrders
  } else if (brand !== 'all' && branch === 'all' && channel === 'all') {
    if (activeBkt?.byBrand?.[brand] && safeNum(activeBkt.totals?.restaurantOrders) > 0) {
      salesKwd = safeNum(activeBkt.byBrand[brand].netKwd)
      orders = safeNum(activeBkt.byBrand[brand].orders)
    } else {
      salesKwd = CUBE30.byBrand[brand].netKwd * basePeriodScale
      orders = Math.round(CUBE30.byBrand[brand].orders * basePeriodScale)
    }
  } else if (brand === 'all' && branch !== 'all' && channel === 'all') {
    if (activeBkt?.byLocation?.[branch] && safeNum(activeBkt.totals?.restaurantOrders) > 0) {
      salesKwd = safeNum(activeBkt.byLocation[branch].netKwd)
      orders = safeNum(activeBkt.byLocation[branch].orders)
    } else {
      salesKwd = CUBE30.byBranch[branch].netKwd * basePeriodScale
      orders = Math.round(CUBE30.byBranch[branch].orders * basePeriodScale)
    }
  } else if (brand === 'all' && branch === 'all' && channel !== 'all') {
    if (activeBkt?.uiChannels?.[channel] && safeNum(activeBkt.totals?.restaurantOrders) > 0) {
      salesKwd = safeNum(activeBkt.uiChannels[channel].netKwd)
      orders = safeNum(activeBkt.uiChannels[channel].orders)
    } else {
      salesKwd = CUBE30.byChannel[channel].netKwd * basePeriodScale
      orders = Math.round(CUBE30.byChannel[channel].orders * basePeriodScale)
    }
  } else if (brand === 'all' && branch !== 'all' && channel !== 'all') {
    const locCh = activeBkt?.byLocation?.[branch]?.uiChannels?.[channel]
    if (locCh && safeNum(activeBkt?.totals?.restaurantOrders) > 0) {
      salesKwd = safeNum(locCh.netKwd)
      orders = safeNum(locCh.orders)
    } else {
      const ref30 = safeNum(CUBE30.branchChannel[`${branch}|${channel}`])
      salesKwd = ref30 * basePeriodScale
      orders = Math.round(safeDiv(salesKwd, 4.9))
    }
  } else if (brand !== 'all' && branch !== 'all' && channel === 'all') {
    const locTotal30 = APPROVED_BRAND_IDS.reduce((s, b) => s + safeNum(CUBE30.brandBranch[`${b}|${branch}`]), 0)
    const shareInLoc = safeDiv(safeNum(CUBE30.brandBranch[`${brand}|${branch}`]), locTotal30, 0)
    const locPeriodNet =
      activeBkt?.byLocation?.[branch] && safeNum(activeBkt.totals?.restaurantOrders) > 0
        ? safeNum(activeBkt.byLocation[branch].netKwd)
        : CUBE30.byBranch[branch].netKwd * basePeriodScale
    const locPeriodOrd =
      activeBkt?.byLocation?.[branch] && safeNum(activeBkt.totals?.restaurantOrders) > 0
        ? safeNum(activeBkt.byLocation[branch].orders)
        : CUBE30.byBranch[branch].orders * basePeriodScale
    salesKwd = locPeriodNet * shareInLoc
    const brandAov = safeDiv(CUBE30.byBrand[brand].netKwd, CUBE30.byBrand[brand].orders, 4.8)
    orders = salesKwd > 0 ? Math.max(1, Math.round(Math.min(locPeriodOrd, safeDiv(salesKwd, brandAov, locPeriodOrd * shareInLoc)))) : 0
  } else if (brand !== 'all' && branch === 'all' && channel !== 'all') {
    const chTotal30 = APPROVED_BRAND_IDS.reduce((s, b) => s + safeNum(CUBE30.brandChannel[`${b}|${channel}`]), 0)
    const shareInCh = safeDiv(safeNum(CUBE30.brandChannel[`${brand}|${channel}`]), chTotal30, 0)
    const chPeriodNet =
      activeBkt?.uiChannels?.[channel] && safeNum(activeBkt.totals?.restaurantOrders) > 0
        ? safeNum(activeBkt.uiChannels[channel].netKwd)
        : CUBE30.byChannel[channel].netKwd * basePeriodScale
    const chPeriodOrd =
      activeBkt?.uiChannels?.[channel] && safeNum(activeBkt.totals?.restaurantOrders) > 0
        ? safeNum(activeBkt.uiChannels[channel].orders)
        : CUBE30.byChannel[channel].orders * basePeriodScale
    salesKwd = chPeriodNet * shareInCh
    const brandAov = safeDiv(CUBE30.byBrand[brand].netKwd, CUBE30.byBrand[brand].orders, 4.8)
    orders = salesKwd > 0 ? Math.max(1, Math.round(Math.min(chPeriodOrd, safeDiv(salesKwd, brandAov, chPeriodOrd * shareInLocOrCh(shareInCh))))) : 0
  } else if (brand !== 'all' && branch !== 'all' && channel !== 'all') {
    const locChTotal30 = APPROVED_BRAND_IDS.reduce((s, b) => s + safeNum(CUBE30.cell[`${b}|${branch}|${channel}`]), 0)
    const shareInLocCh = safeDiv(safeNum(CUBE30.cell[`${brand}|${branch}|${channel}`]), locChTotal30, 0)
    const locChActual = activeBkt?.byLocation?.[branch]?.uiChannels?.[channel]
    const baseNet =
      locChActual && safeNum(activeBkt?.totals?.restaurantOrders) > 0
        ? safeNum(locChActual.netKwd)
        : safeNum(CUBE30.branchChannel[`${branch}|${channel}`]) * basePeriodScale
    const baseOrd =
      locChActual && safeNum(activeBkt?.totals?.restaurantOrders) > 0
        ? safeNum(locChActual.orders)
        : safeDiv(baseNet, 4.9)
    salesKwd = baseNet * shareInLocCh
    const brandAov = safeDiv(CUBE30.byBrand[brand].netKwd, CUBE30.byBrand[brand].orders, 4.8)
    orders = salesKwd > 0 ? Math.max(1, Math.round(Math.min(baseOrd, safeDiv(salesKwd, brandAov, baseOrd * shareInLocCh)))) : 0
  }

  salesKwd = Math.max(0, Math.round(salesKwd * sliceNetMult * 1000) / 1000)
  orders = salesKwd > 0 ? Math.max(1, Math.round(orders * sliceOrdMult)) : 0
  const aovKwd = orders > 0 ? Math.round((salesKwd / orders) * 1000) / 1000 : 0

  const approxMonthSlice = safeDiv(salesKwd, periodScale, 0)
  const dimensionShare =
    brand === 'all' && branch === 'all' && channel === 'all'
      ? 1
      : Math.min(1, Math.max(0, safeDiv(approxMonthSlice, monthGroupSales, 0)))
  const totalScale = safeDiv(salesKwd, monthGroupSales, 0)

  // -------------------------------------------------------------------------
  // 10-KWD Breakdown (كيف تتوزع كل 10 دنانير من المبيعات؟)
  // -------------------------------------------------------------------------
  const baseNP = JOURNEY_SHORTCUTS.netPocket
  const groupFood10 = safeNum(baseNP.foodAndPack10, 2.68)
  const groupDeliv10 = safeNum(baseNP.platformCut10, 1.35)
  const groupOpex10 = safeNum(baseNP.branchOpexRent10, 3.45)

  let food10 = groupFood10
  let delivery10 = groupDeliv10
  let opexRent10 = groupOpex10

  if (brand !== 'all') {
    food10 = BRAND_FOOD_PER10[brand] ?? food10
  }
  if (branch !== 'all') {
    const btc = BRANCH_TRUE_CASH.find((b) => b.id === branch)
    if (btc && btc.posNet > 0) {
      food10 =
        brand !== 'all'
          ? (food10 + (btc.cogs / btc.posNet) * 10) / 2
          : (btc.cogs / btc.posNet) * 10
      const fixedRatio = ((btc.rent + btc.effectiveLabor + btc.branchOpex + btc.sharedAlloc) / btc.posNet) * 10
      opexRent10 = Math.min(5.2, Math.max(2.1, fixedRatio))
      if (channel === 'all') {
        delivery10 = (btc.comm / btc.posNet) * 10
      }
    }
  }
  if (channel !== 'all') {
    delivery10 = CHANNEL_COMM_PER10[channel]
    if (channel === 'dine-in') {
      food10 = Math.max(2.1, food10 - 0.18)
    }
  } else if (brand !== 'all' && branch === 'all') {
    let weightedComm = 0
    let sumCh = 0
    for (const cid of APPROVED_CHANNEL_IDS) {
      const w = safeNum(CUBE30.brandChannel[`${brand}|${cid}`])
      weightedComm += w * CHANNEL_COMM_PER10[cid]
      sumCh += w
    }
    if (sumCh > 0) delivery10 = weightedComm / sumCh
  }

  // Kuwait Slice fixed-cost operating leverage adjustment (higher volume on Paydays/Weekends dilutes fixed rent/payroll per 10 KWD)
  if (filters.kuwaitSlice === 'payday' || filters.kuwaitSlice === 'weekend') {
    opexRent10 = Math.max(1.95, opexRent10 - 0.28)
  } else if (filters.kuwaitSlice === 'quiet-hours') {
    opexRent10 = Math.min(5.1, opexRent10 + 0.35)
  }

  if (
    filters.period === 'year' &&
    activeBkt?.accounting &&
    activeBkt.accounting.income > 100_000 &&
    brand === 'all' &&
    branch === 'all' &&
    channel === 'all' &&
    filters.kuwaitSlice === 'all'
  ) {
    const inc = activeBkt.accounting.income
    food10 = Math.min(4.2, Math.max(2.2, (activeBkt.accounting.cogs / inc) * 10))
  }

  food10 = Math.round(Math.min(4.8, Math.max(1.8, food10)) * 100) / 100
  delivery10 = Math.round(Math.min(2.8, Math.max(0, delivery10)) * 100) / 100
  opexRent10 = Math.round(Math.min(10 - food10 - delivery10 - 0.6, Math.max(1.8, opexRent10)) * 100) / 100
  const netPocket10 = Math.round(Math.max(0, 10 - food10 - delivery10 - opexRent10) * 100) / 100

  // Strict weighted net % = sum(netPocketKwd) / sum(salesKwd) * 100
  const netPocketTotalKwd = salesKwd * (netPocket10 / 10)
  const weightedNetPct = salesKwd > 0 ? Math.round((netPocketTotalKwd / salesKwd) * 1000) / 10 : 0
  const groupNetPocket10 = Math.max(0.6, 10 - groupFood10 - groupDeliv10 - groupOpex10)
  const groupWeightedNetPct = Math.round(groupNetPocket10 * 10 * 10) / 10

  // -------------------------------------------------------------------------
  // Cascading Filter Options with Live 🟢/🟠/🔴 Health Dots & Weighted %
  // -------------------------------------------------------------------------
  const cascadingBrands: FilterOption<GlobalBrand>[] = GLOBAL_BRAND_OPTIONS.map((opt) => {
    if (opt.id === 'all') {
      const m = computeWeightedCellMargin(
        (_b, l, c) => (branch === 'all' || l === branch) && (channel === 'all' || c === channel),
      )
      return {
        ...opt,
        healthDot: healthDotFromPct(m.weightedNetPct, m.salesKwd),
        weightedNetPct: m.weightedNetPct,
        salesKwd: Math.round(m.salesKwd * periodScale),
        available: true,
      }
    }
    const bid = opt.id
    const m = computeWeightedCellMargin(
      (b, l, c) => b === bid && (branch === 'all' || l === branch) && (channel === 'all' || c === channel),
    )
    const availableInBranch = branch === 'all' || (CUBE30.brandBranch[`${bid}|${branch}`] ?? 0) > 0.05
    return {
      ...opt,
      healthDot: healthDotFromPct(m.weightedNetPct, m.salesKwd),
      weightedNetPct: m.weightedNetPct,
      salesKwd: Math.round(m.salesKwd * periodScale),
      available: availableInBranch,
    }
  }).filter((o) => o.id === 'all' || o.available || o.id === brand)

  const cascadingBranches: FilterOption<GlobalBranch>[] = GLOBAL_BRANCH_OPTIONS.map((opt) => {
    if (opt.id === 'all') {
      const m = computeWeightedCellMargin(
        (b, _l, c) => (brand === 'all' || b === brand) && (channel === 'all' || c === channel),
      )
      return {
        ...opt,
        healthDot: healthDotFromPct(m.weightedNetPct, m.salesKwd),
        weightedNetPct: m.weightedNetPct,
        salesKwd: Math.round(m.salesKwd * periodScale),
        available: true,
      }
    }
    const lid = opt.id
    const m = computeWeightedCellMargin(
      (b, l, c) => l === lid && (brand === 'all' || b === brand) && (channel === 'all' || c === channel),
    )
    const availableForBrand = brand === 'all' || (CUBE30.brandBranch[`${brand}|${lid}`] ?? 0) > 0.05
    return {
      ...opt,
      healthDot: healthDotFromPct(m.weightedNetPct, m.salesKwd),
      weightedNetPct: m.weightedNetPct,
      salesKwd: Math.round(m.salesKwd * periodScale),
      available: availableForBrand,
    }
  }).filter((o) => o.id === 'all' || o.available || o.id === branch)

  const cascadingChannels: FilterOption<GlobalChannel>[] = GLOBAL_CHANNEL_OPTIONS.map((opt) => {
    if (opt.id === 'all') {
      const m = computeWeightedCellMargin(
        (b, l) => (brand === 'all' || b === brand) && (branch === 'all' || l === branch),
      )
      return {
        ...opt,
        healthDot: healthDotFromPct(m.weightedNetPct, m.salesKwd),
        weightedNetPct: m.weightedNetPct,
        salesKwd: Math.round(m.salesKwd * periodScale),
        available: true,
      }
    }
    const cid = opt.id
    const m = computeWeightedCellMargin(
      (b, l, c) => c === cid && (brand === 'all' || b === brand) && (branch === 'all' || l === branch),
    )
    return {
      ...opt,
      healthDot: healthDotFromPct(m.weightedNetPct, m.salesKwd),
      weightedNetPct: m.weightedNetPct,
      salesKwd: Math.round(m.salesKwd * periodScale),
      available: m.salesKwd > 0.05,
    }
  })

  // -------------------------------------------------------------------------
  // 1-Line Peer Benchmark & Root-Cause Diagnostic Strip
  // -------------------------------------------------------------------------
  const isFullGroupScope =
    brand === 'all' && branch === 'all' && channel === 'all' && filters.kuwaitSlice === 'all'
  const showPeerComparison = !isFullGroupScope
  const deltaPctPoints = Math.round((weightedNetPct - groupWeightedNetPct) * 10) / 10
  const diagTone: PeerDiagnosticStrip['tone'] =
    salesKwd <= 0 || deltaPctPoints <= -3 ? 'rose' : deltaPctPoints < 0 ? 'amber' : 'emerald'

  const benchmarkAr =
    salesKwd <= 0
      ? `صفر مبيعات في هذا التقاطع مقابل متوسط المجموعة ${groupWeightedNetPct.toFixed(1)}%`
      : showPeerComparison
        ? `الصافي المرجّح ${weightedNetPct.toFixed(1)}% مقابل متوسط المجموعة ${groupWeightedNetPct.toFixed(1)}% (${deltaPctPoints >= 0 ? '+' : ''}${deltaPctPoints.toFixed(1)} نقطة)`
        : `الصافي المرجّح للمجموعة ${weightedNetPct.toFixed(1)}%`

  const benchmarkEn =
    salesKwd <= 0
      ? `Zero sales in this slice vs ${groupWeightedNetPct.toFixed(1)}% group avg`
      : showPeerComparison
        ? `Weighted Net ${weightedNetPct.toFixed(1)}% vs ${groupWeightedNetPct.toFixed(1)}% group avg (${deltaPctPoints >= 0 ? '+' : ''}${deltaPctPoints.toFixed(1)} pts)`
        : `Group Weighted Net ${weightedNetPct.toFixed(1)}%`

  let rootCauseAr = ''
  let rootCauseEn = ''
  if (salesKwd <= 0) {
    rootCauseAr = 'القناة غير مفعلة لهذا الفرع أو متوقفة حالياً — راجع شاشة مراقبة التوصيل.'
    rootCauseEn = 'Channel is inactive or stopped at this branch — check Delivery Radar.'
  } else if (filters.lens === 'bleed') {
    rootCauseAr = 'عدسة النزيف: ركّز على إيقاف هدر المطبخ ومراجعة الحسابات المتوقفة فوراً.'
    rootCauseEn = 'Bleed Lens: Focus on stopping abnormal kitchen variance and offline app accounts.'
  } else if (filters.lens === 'delivery-audit' || delivery10 > groupDeliv10 + 0.22) {
    rootCauseAr = `عمولة التوصيل تقتطع ${delivery10.toFixed(2)} د.ك من كل 10 دنانير — انقل الطلبات القريبة إلى منصة توصيل طلبات TMP (15%).`
    rootCauseEn = `Delivery fees take ${delivery10.toFixed(2)} KWD per 10 KWD — shift nearby orders to TMP (15%).`
  } else if (filters.lens === 'ardiya-buying' || food10 > groupFood10 + 0.16) {
    rootCauseAr = `تكلفة المواد الغذائية ${food10.toFixed(2)} د.ك/10 — ثبّت أسعار موردي العارضية واضبط أوزان الوجبات.`
    rootCauseEn = `Food cost is ${food10.toFixed(2)} KWD/10 — lock Ardiya supplier rates and portion weights.`
  } else if (filters.lens === 'quiet-hours' || filters.kuwaitSlice === 'quiet-hours') {
    rootCauseAr = 'الساعات الهادئة (3–6 مساءً): فعّل عرض كومبو مشروب وسبرنغ رول لرفع متوسط السلة.'
    rootCauseEn = 'Quiet Hours (3–6 PM): Trigger drink + spring roll combo prompts to lift AOV.'
  } else if (filters.lens === 'payday-weekend' || filters.kuwaitSlice === 'payday' || filters.kuwaitSlice === 'weekend') {
    rootCauseAr = 'ذروة الرواتب والويكند: ارفع تحضير العارضية 20% وامنع إغلاق أجهزة التوصيل.'
    rootCauseEn = 'Payday & Weekend Surge: Pre-stage +20% Ardiya prep and keep all tablets open.'
  } else if (opexRent10 > groupOpex10 + 0.25) {
    rootCauseAr = `ضغط الإيجارات والرواتب (${opexRent10.toFixed(2)} د.ك/10) — شغّل علامة ثانية بنفس المطبخ.`
    rootCauseEn = `Fixed rent & payroll (${opexRent10.toFixed(2)} KWD/10) — run a host brand in the same kitchen.`
  } else {
    rootCauseAr = `ربحية صحية (${netPocket10.toFixed(2)} د.ك لكل 10 د.ك) مدعومة بالصالة ومنصة توصيل طلبات TMP وضبط المطبخ.`
    rootCauseEn = `Healthy pocket margin (${netPocket10.toFixed(2)} KWD/10) backed by dine-in, TMP & kitchen control.`
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

  // -------------------------------------------------------------------------
  // Filtered & Scaled Plain-Language Recommendation Cards (CFO Realism Enforced)
  // -------------------------------------------------------------------------
  const periodBenefitUnitAr: Record<GlobalPeriod, string> = {
    today: 'يومياً',
    week: 'أسبوعياً',
    month: 'شهرياً',
    year: 'سنوياً',
    custom: 'خلال الفترة',
  }
  const periodBenefitUnitEn: Record<GlobalPeriod, string> = {
    today: '/ day',
    week: '/ week',
    month: '/ month',
    year: '/ year',
    custom: '/ period',
  }

  const dimFactorForPlay =
    brand === 'all' && branch === 'all' && channel === 'all'
      ? 1
      : Math.max(0.12, dimensionShare > 0 ? Math.min(1, dimensionShare * 1.35) : 0.15)

  const matchedRawPlays = JOURNEY_PLAYS.filter((p) => {
    const scope = detectPlayScope(p)
    const okBrand = brand === 'all' || scope.brands === 'all' || scope.brands.includes(brand)
    const okBranch = branch === 'all' || scope.branches === 'all' || scope.branches.includes(branch)
    const okChannel = channel === 'all' || scope.channels === 'all' || scope.channels.includes(channel)
    const okLens = matchesProfitLens(p, filters.lens)
    return okBrand && okBranch && okChannel && okLens
  })
  const fallbackLensPlays = JOURNEY_PLAYS.filter((p) => matchesProfitLens(p, filters.lens))
  const effectivePlays =
    matchedRawPlays.length > 0
      ? matchedRawPlays
      : fallbackLensPlays.length > 0
        ? fallbackLensPlays.slice(0, 6)
        : JOURNEY_PLAYS.slice(0, 6)

  const slicePlayFactor =
    filters.kuwaitSlice === 'all'
      ? 1
      : filters.period === 'today'
        ? Math.min(1.4, Math.max(0.2, sliceNetMult))
        : Math.min(1, Math.max(0.18, sliceNetMult))

  const rawPlays: SimplePlayView[] = effectivePlays.map((p) => {
    const scope = detectPlayScope(p)
    const copy = simplifyPlayCopy(p)
    const cfoRealism = buildCfoRealismForPlay(p)
    const brandSpecific = brand !== 'all' && scope.brands !== 'all' && scope.brands.includes(brand)
    const branchSpecific = branch !== 'all' && scope.branches !== 'all' && scope.branches.includes(branch)
    const scopeFactor = (brandSpecific || branchSpecific ? 1 : dimFactorForPlay) * slicePlayFactor
    const tiersMonthly = scaleCfoTiers(cfoRealism.monthlyTiers, scopeFactor)
    const monthlyBenefitKwd = Math.max(12, Math.round(tiersMonthly.realisticKwd))
    const pMult =
      filters.period === 'year'
        ? 12
        : filters.period === 'week'
          ? 7 / 30
          : filters.period === 'today'
            ? 1 / 30
            : filters.period === 'custom'
              ? periodDays / 30
              : 1
    const tiersPeriod = scaleCfoTiers(cfoRealism.monthlyTiers, scopeFactor * pMult)
    const periodBenefitKwd = Math.max(0.5, Math.round(tiersPeriod.realisticKwd * 10) / 10)
    const specBrands = new Set<BrandKey>(scope.brands === 'all' ? [] : scope.brands)
    const specBranches = new Set<BranchKey>(scope.branches === 'all' ? [] : scope.branches)
    return {
      play: p,
      id: p.id,
      stage: p.stage,
      ...copy,
      periodBenefitKwd,
      monthlyBenefitKwd,
      annualBenefitKwd: monthlyBenefitKwd * 12,
      periodLabelAr: `${fKwd(periodBenefitKwd, true)} ${periodBenefitUnitAr[filters.period]}`,
      periodLabelEn: `${fKwd(periodBenefitKwd, false)} ${periodBenefitUnitEn[filters.period]}`,
      brands: scope.brands,
      branches: scope.branches,
      channels: scope.channels,
      scopeLabelAr: formatConsolidatedScopeLabel(scope.brands, scope.branches, specBrands, specBranches, true),
      scopeLabelEn: formatConsolidatedScopeLabel(scope.brands, scope.branches, specBrands, specBranches, false),
      mergedIds: [p.id],
      cfoRealism,
      tiersMonthly,
      tiersPeriod,
    }
  })

  // Consolidate any items sharing normalized titleEn, titleAr, problemAr, problemEn, solutionAr, or solutionEn
  // into ONE single SimplePlayView card: sum KWD/tier lifts and union affected brands, branches & channels.
  const consolidatedPlays: SimplePlayView[] = []
  const specificBrandsByIdx = new Map<number, Set<BrandKey>>()
  const specificBranchesByIdx = new Map<number, Set<BranchKey>>()
  const idxByTitleEn = new Map<string, number>()
  const idxByTitleAr = new Map<string, number>()
  const idxByProblemAr = new Map<string, number>()
  const idxByProblemEn = new Map<string, number>()
  const idxBySolutionAr = new Map<string, number>()
  const idxBySolutionEn = new Map<string, number>()

  for (const item of rawPlays) {
    const kTitleEn = normalizePlayDedupKey(item.titleEn)
    const kTitleAr = normalizePlayDedupKey(item.titleAr)
    const kProbAr = normalizePlayDedupKey(item.problemAr)
    const kProbEn = normalizePlayDedupKey(item.problemEn)
    const kSolAr = normalizePlayDedupKey(item.solutionAr)
    const kSolEn = normalizePlayDedupKey(item.solutionEn)

    const existingIdx =
      idxByTitleEn.get(kTitleEn) ??
      idxByTitleAr.get(kTitleAr) ??
      idxByProblemAr.get(kProbAr) ??
      idxByProblemEn.get(kProbEn) ??
      idxBySolutionAr.get(kSolAr) ??
      idxBySolutionEn.get(kSolEn)

    if (existingIdx === undefined) {
      const nextIdx = consolidatedPlays.length
      const bSet = new Set<BrandKey>(item.brands === 'all' ? [] : item.brands)
      const lSet = new Set<BranchKey>(item.branches === 'all' ? [] : item.branches)
      specificBrandsByIdx.set(nextIdx, bSet)
      specificBranchesByIdx.set(nextIdx, lSet)
      consolidatedPlays.push(item)
      idxByTitleEn.set(kTitleEn, nextIdx)
      idxByTitleAr.set(kTitleAr, nextIdx)
      idxByProblemAr.set(kProbAr, nextIdx)
      idxByProblemEn.set(kProbEn, nextIdx)
      idxBySolutionAr.set(kSolAr, nextIdx)
      idxBySolutionEn.set(kSolEn, nextIdx)
    } else {
      const prev = consolidatedPlays[existingIdx]
      const bSet = specificBrandsByIdx.get(existingIdx) ?? new Set<BrandKey>()
      const lSet = specificBranchesByIdx.get(existingIdx) ?? new Set<BranchKey>()
      if (item.brands !== 'all') item.brands.forEach((b) => bSet.add(b))
      if (item.branches !== 'all') item.branches.forEach((l) => lSet.add(l))

      const mergedBrands: readonly BrandKey[] | 'all' =
        prev.brands === 'all' || item.brands === 'all'
          ? 'all'
          : APPROVED_BRAND_IDS.filter((b) => prev.brands.includes(b) || item.brands.includes(b))
      const mergedBranches: readonly BranchKey[] | 'all' =
        prev.branches === 'all' || item.branches === 'all'
          ? 'all'
          : APPROVED_BRANCH_IDS.filter((l) => prev.branches.includes(l) || item.branches.includes(l))
      const mergedChannels: readonly ChannelKey[] | 'all' =
        prev.channels === 'all' || item.channels === 'all'
          ? 'all'
          : APPROVED_CHANNEL_IDS.filter((c) => prev.channels.includes(c) || item.channels.includes(c))

      const nextMonthly = prev.monthlyBenefitKwd + item.monthlyBenefitKwd
      const nextPeriod = Math.round((prev.periodBenefitKwd + item.periodBenefitKwd) * 10) / 10
      const nextTiersMonthly = {
        conservativeKwd: prev.tiersMonthly.conservativeKwd + item.tiersMonthly.conservativeKwd,
        realisticKwd: prev.tiersMonthly.realisticKwd + item.tiersMonthly.realisticKwd,
        stretchKwd: prev.tiersMonthly.stretchKwd + item.tiersMonthly.stretchKwd,
      }
      const nextTiersPeriod = {
        conservativeKwd:
          Math.round((prev.tiersPeriod.conservativeKwd + item.tiersPeriod.conservativeKwd) * 10) / 10,
        realisticKwd:
          Math.round((prev.tiersPeriod.realisticKwd + item.tiersPeriod.realisticKwd) * 10) / 10,
        stretchKwd:
          Math.round((prev.tiersPeriod.stretchKwd + item.tiersPeriod.stretchKwd) * 10) / 10,
      }

      consolidatedPlays[existingIdx] = {
        ...prev,
        id: prev.id === 'proc-price-creep' || item.id === 'proc-price-creep' ? 'proc-price-creep' : prev.id,
        periodBenefitKwd: nextPeriod,
        monthlyBenefitKwd: nextMonthly,
        annualBenefitKwd: nextMonthly * 12,
        periodLabelAr: `${fKwd(nextPeriod, true)} ${periodBenefitUnitAr[filters.period]}`,
        periodLabelEn: `${fKwd(nextPeriod, false)} ${periodBenefitUnitEn[filters.period]}`,
        brands: mergedBrands,
        branches: mergedBranches,
        channels: mergedChannels,
        scopeLabelAr: formatConsolidatedScopeLabel(mergedBrands, mergedBranches, bSet, lSet, true),
        scopeLabelEn: formatConsolidatedScopeLabel(mergedBrands, mergedBranches, bSet, lSet, false),
        mergedIds: Array.from(new Set([...prev.mergedIds, ...item.mergedIds])),
        cfoRealism: {
          ...prev.cfoRealism,
          monthlyTiers: {
            ...prev.cfoRealism.monthlyTiers,
            ...nextTiersMonthly,
          },
        },
        tiersMonthly: nextTiersMonthly,
        tiersPeriod: nextTiersPeriod,
      }

      idxByTitleEn.set(kTitleEn, existingIdx)
      idxByTitleAr.set(kTitleAr, existingIdx)
      idxByProblemAr.set(kProbAr, existingIdx)
      idxByProblemEn.set(kProbEn, existingIdx)
      idxBySolutionAr.set(kSolAr, existingIdx)
      idxBySolutionEn.set(kSolEn, existingIdx)
    }
  }

  const plays: SimplePlayView[] = consolidatedPlays.sort(
    (a, b) => b.monthlyBenefitKwd - a.monthlyBenefitKwd,
  )

  const totalPlaysBenefitMonthlyKwd = plays.reduce((s, p) => s + p.monthlyBenefitKwd, 0)
  const totalPlaysBenefitPeriodKwd = Math.round(plays.reduce((s, p) => s + p.periodBenefitKwd, 0))

  // -------------------------------------------------------------------------
  // 6 Canonical Executive Module Jump Cards (3x2 Grid -> Single Canonical Home)
  // -------------------------------------------------------------------------
  const s = JOURNEY_SHORTCUTS
  const beforeRentPocketRatio = Math.max(0.15, (10 - food10 - delivery10) / 10)
  const beforeRentKwd = Math.round(salesKwd * beforeRentPocketRatio)
  const kitchenGapKwd = Math.max(0, Math.round(s.shield.varianceKwd * (totalScale || periodScale * dimFactorForPlay)))
  const opexLeakKwd = Math.max(0, Math.round(s.hiddenOpex.monthlyKwd * (totalScale || periodScale * dimFactorForPlay)))
  const branchOpsRow = branch !== 'all' ? s.ops.rows.find((r) => r.id === branch) : undefined
  const opsScore = branchOpsRow ? branchOpsRow.score : s.ops.groupScore
  const menuBenefitKwd = Math.max(
    10,
    Math.round(
      plays.filter((p) => p.stage === 'menu').reduce((acc, p) => acc + p.periodBenefitKwd, 0) ||
        s.menu.monthlyKwd * periodScale * dimFactorForPlay * 0.72,
    ),
  )
  const hostMonthlyBase = safeNum(s.host?.contribution, 2400)
  const kitchenHostKwd = Math.max(
    15,
    Math.round(hostMonthlyBase * (filters.period === 'year' ? 12 : periodScale) * (branch === 'all' ? 1 : 0.35)),
  )
  const baseClearingKwd =
    liveSummary?.aggregatorReceivables?.readable &&
    (liveSummary.aggregatorReceivables.openReceivableKwd ?? 0) > 0
      ? liveSummary.aggregatorReceivables.openReceivableKwd
      : s.delivery.openClearingKwd
  const deliveryDuesKwd = Math.max(
    0,
    Math.round(
      baseClearingKwd *
        (channel === 'dine-in' ? 0 : branch === 'avenues' ? 0 : dimFactorForPlay),
    ),
  )

  const disciplineDot: HealthDot = opsScore >= 85 ? '🟢' : opsScore >= 60 ? '🟠' : '🔴'
  const disciplineAccent: SummaryCardData['accent'] =
    opsScore >= 85 ? 'emerald' : opsScore >= 60 ? 'amber' : 'rose'

  const summaryCards: SummaryCardData[] = [
    {
      id: 'procurement-kitchen',
      num: 1,
      titleAr: 'المشتريات والمطبخ',
      titleEn: 'Buying & Kitchen',
      valueAr: fKwd(kitchenGapKwd, true),
      valueEn: fKwd(kitchenGapKwd, false),
      descAr: 'فروقات أسعار الموردين وهدر المطبخ بعد عزل 6% تقليم طبيعي.',
      descEn: 'Supplier price gaps & kitchen variance net of 6% normal trim.',
      accent: 'rose',
      statusDot: '🔴',
      statusLabelAr: 'يتطلب ضبطاً عاجلاً',
      statusLabelEn: 'Urgent Action Required',
      ctaAr: 'فحص المشتريات ↗',
      ctaEn: 'Audit Buying ↗',
      action: 'stage-procurement',
      targetStage: 'procurement',
      href: '/erp/warehouse-chain',
    },
    {
      id: 'expenses-maint',
      num: 2,
      titleAr: 'الفواتير والصيانة',
      titleEn: 'Monthly Bills',
      valueAr: fKwd(opexLeakKwd, true),
      valueEn: fKwd(opexLeakKwd, false),
      descAr: 'الصيانة المتكررة والعهد النثرية والفواتير التشغيلية العامة.',
      descEn: 'Repeated equipment repairs, petty cash & monthly bills.',
      accent: 'rose',
      statusDot: '🔴',
      statusLabelAr: 'يتطلب ضبطاً عاجلاً',
      statusLabelEn: 'Urgent Action Required',
      ctaAr: 'تفاصيل المصاريف ↗',
      ctaEn: 'Monthly Bills ↗',
      action: 'stage-opex',
      targetStage: 'opex',
      href: '/erp/planning',
    },
    {
      // Taxonomy ref: مستحقات التوصيل -> ذمم منصات التوصيل المتراكمة
      id: 'delivery-dues',
      num: 3,
      titleAr: 'ذمم منصات التوصيل المتراكمة',
      titleEn: 'Cumulative Aggregator Receivables',
      valueAr: fKwd(deliveryDuesKwd, true),
      valueEn: fKwd(deliveryDuesKwd, false),
      descAr:
        'مبالغ مستحقة لدى طلبات وكيتا وديليفرو وجاهز وسنونو (رصيد متراكم مفتوح من فترات سابقة قيد التحصيل).',
      descEn:
        'Unsettled aggregator payouts across Talabat, Keeta & Deliveroo (Open cumulative balance from prior periods under collection).',
      accent: 'amber',
      statusDot: '🟠',
      statusLabelAr: 'رصيد/التزام تحت المتابعة',
      statusLabelEn: 'Monitored Balance / Obligation',
      badgeAr: 'رصيد تراكمي',
      badgeEn: 'Cumulative Balance',
      ctaAr: 'مراقبة التوصيل ↗',
      ctaEn: 'Delivery Radar ↗',
      action: 'href-radar',
      href: '/erp/aggregator-radar',
    },
    {
      id: 'branch-discipline',
      num: 4,
      titleAr: 'انضباط الفروع',
      titleEn: 'Branch Discipline',
      valueAr: `${opsScore} من 100`,
      valueEn: `${opsScore} / 100`,
      descAr: 'سرعة التجهيز والتزام الفتح وتقليل المرتجعات والخصومات.',
      descEn: 'Prep SLA speed, opening discipline & POS discount control.',
      accent: disciplineAccent,
      statusDot: disciplineDot,
      statusLabelAr:
        opsScore >= 85
          ? 'ضمن المستهدف'
          : opsScore >= 60
            ? 'رصيد/التزام تحت المتابعة'
            : 'يتطلب ضبطاً عاجلاً',
      statusLabelEn:
        opsScore >= 85
          ? 'On Target'
          : opsScore >= 60
            ? 'Monitored Balance / Obligation'
            : 'Urgent Action Required',
      badgeAr: 'المستهدف: 85+',
      badgeEn: 'Target: 85+',
      ctaAr: 'مقارنة الفروع ↗',
      ctaEn: 'Branch Speed ↗',
      action: 'chart-branches',
      targetStage: 'operations',
      href: '/erp/prep-sla',
    },
    {
      id: 'menu-prices',
      num: 5,
      titleAr: 'أسعار المينيو والوجبات',
      titleEn: 'Menu Profit',
      valueAr: `+${fKwd(menuBenefitKwd, true)}`,
      valueEn: `+${fKwd(menuBenefitKwd, false)}`,
      descAr: 'رفع ربح الوجبات والإضافات بتحويل 8%–15% واحتفاظ 94%–97%.',
      descEn: 'Combo & add-on margin lift at 8%–15% conversion.',
      accent: 'emerald',
      statusDot: '🟢',
      statusLabelAr: 'فرصة زيادة ربح جاهزة',
      statusLabelEn: 'Ready Profit Upside',
      ctaAr: 'المينيو والأصناف ↗',
      ctaEn: 'Menu Profit ↗',
      action: 'href-menu',
      href: '/erp/cores',
    },
    {
      id: 'kitchen-capacity',
      num: 6,
      titleAr: 'طاقة المطابخ الهادئة',
      titleEn: 'Quiet Hours',
      valueAr: `+${fKwd(kitchenHostKwd, true)}`,
      valueEn: `+${fKwd(kitchenHostKwd, false)}`,
      descAr: 'تشغيل علامات إضافية وعروض الساعات الهادئة (3–6 مساءً) بدون إيجار جديد.',
      descEn: 'Zero-rent cross-brand quiet-hour upside (3–6 PM) inside existing kitchens.',
      accent: 'emerald',
      statusDot: '🟢',
      statusLabelAr: 'فرصة زيادة ربح جاهزة',
      statusLabelEn: 'Ready Profit Upside',
      ctaAr: 'خطة الساعات الهادئة ↗',
      ctaEn: 'Quiet-Hours Plan ↗',
      action: 'lens-quiet',
      targetStage: 'operations',
      href: '/erp/weekday-comparison',
    },
  ]

  // -------------------------------------------------------------------------
  // Feryal Left-Column Plain Notes (أهم ملاحظات اليوم)
  // -------------------------------------------------------------------------
  const feryalNotes: FeryalSimpleNote[] = [
    {
      id: 'note-kitchen',
      titleAr: 'نقص بالمطبخ',
      titleEn: 'Kitchen Gap',
      summaryAr: `فرق استهلاك مواد المطبخ يبلغ ${fKwd(kitchenGapKwd, true)} بعد عزل 6% تقليم الطبخ الطبيعي.`,
      summaryEn: `Kitchen ingredient gap is ${fKwd(kitchenGapKwd, false)} net of 6% normal trim.`,
      benefitAr: `+${fKwd(Math.max(25, Math.round(kitchenGapKwd * 0.35)), true)}`,
      benefitEn: `+${fKwd(Math.max(25, Math.round(kitchenGapKwd * 0.35)), false)}`,
      promptAr: `اشرحي لي بوضوح سبب نقص المطبخ حالياً (${buildFilterSubtitle(filters, true)}) وكيف نوقفه هذا الأسبوع؟`,
      promptEn: `Explain simply why there is a kitchen food gap (${buildFilterSubtitle(filters, false)}) and how to stop it this week.`,
      tone: 'rose',
    },
    {
      id: 'note-supplier',
      titleAr: 'فرق سعر مورد',
      titleEn: 'Supplier Price Diff',
      summaryAr: 'بعض أصناف التوريد زاد سعرها في وصفات العارضية وتحتاج تثبيت سعر فوري.',
      summaryEn: 'Several Ardiya recipe ingredients rose vs last month and need a price lock.',
      benefitAr: plays.find((p) => p.id === 'proc-price-creep')?.periodLabelAr ?? `+${fKwd(Math.round(740 * periodScale), true)}`,
      benefitEn: plays.find((p) => p.id === 'proc-price-creep')?.periodLabelEn ?? `+${fKwd(Math.round(740 * periodScale), false)}`,
      promptAr: `ما أهم فروقات أسعار الموردين في (${buildFilterSubtitle(filters, true)}) وما الإجراء المطلوب من المشتريات اليوم؟`,
      promptEn: `What are the main supplier price differences in (${buildFilterSubtitle(filters, false)}) and what should purchasing do today?`,
      tone: 'amber',
    },
    {
      id: 'note-menu',
      titleAr: 'تعديل سعر صنف',
      titleEn: 'Item Price Tweak',
      summaryAr: 'كومبو مشروبات (تحويل 8%–15%) وتعديل مدروس للأسعار (احتفاظ 94%–97%) يرفع الصافي فوراً.',
      summaryEn: 'Drink combo (8%–15% conversion) and gentle price tweak (94%–97% retention) lift profit.',
      benefitAr: `+${fKwd(menuBenefitKwd, true)}`,
      benefitEn: `+${fKwd(menuBenefitKwd, false)}`,
      promptAr: `اقترحي لي أنسب تعديل أسعار وكومبو مشروبات لنطاق (${buildFilterSubtitle(filters, true)}) دون خسارة عملاء.`,
      promptEn: `Suggest the simplest menu price tweak and drink combo for (${buildFilterSubtitle(filters, false)}) without losing guests.`,
      tone: 'sky',
    },
    {
      id: 'note-delivery',
      titleAr: 'منصة توصيل طلبات TMP و Tgo',
      titleEn: 'Dual TMP & Tgo',
      summaryAr: `مراجعة الحسابات المتوقفة فعلياً ومتابعة تحصيل ذمم منصات التوصيل المتراكمة (${fKwd(deliveryDuesKwd, true)} — رصيد متراكم مفتوح من فترات سابقة قيد التحصيل).`,
      summaryEn: `Check verified stopped accounts and collect cumulative aggregator receivables (${fKwd(deliveryDuesKwd, false)} — open cumulative balance from prior periods under collection).`,
      benefitAr: fKwd(deliveryDuesKwd, true),
      benefitEn: fKwd(deliveryDuesKwd, false),
      promptAr: `أعطني ملخصاً سريعاً لحسابات منصة توصيل طلبات TMP (15%) و Tgo وذمم منصات التوصيل المتراكمة في (${buildFilterSubtitle(filters, true)}).`,
      promptEn: `Give me a quick summary of TMP (15%) vs Tgo accounts and cumulative aggregator receivables for (${buildFilterSubtitle(filters, false)}).`,
      tone: 'emerald',
    },
  ]

  const resolvedPeriodWindow = formatPeriodCalendarWindow(filters.period, {
    customFrom: filters.customFrom,
    customTo: filters.customTo,
    liveSummary,
  })
  const periodCalendarWindowAr = resolvedPeriodWindow.labelAr
  const periodCalendarWindowEn = resolvedPeriodWindow.labelEn

  const periodRangeLabelAr =
    filters.period === 'custom'
      ? `${periodCalendarWindowAr} (${formatArDays(periodDays)})`
      : `${periodCalendarWindowAr}${isTodayFallback ? ' (آخر يوم عمل مكتمل)' : ''}`
  const periodRangeLabelEn =
    filters.period === 'custom'
      ? `${periodCalendarWindowEn} (${periodDays}d)`
      : `${periodCalendarWindowEn}${isTodayFallback ? ' (last full POS day)' : ''}`

  const subtitleAr = buildFilterSubtitle(filters, true, liveSummary)
  const subtitleEn = buildFilterSubtitle(filters, false, liveSummary)

  const peerClauseAr = showPeerComparison ? ` مقابل متوسط المجموعة ${groupWeightedNetPct.toFixed(1)}%` : ''
  const peerClauseEn = showPeerComparison ? ` vs ${groupWeightedNetPct.toFixed(1)}% group avg` : ''
  const feryalContextAr = `[الفلتر النشط: ${subtitleAr} | المبيعات الصافية: ${fKwd(salesKwd, true)} | الطلبات: ${orders.toLocaleString('en-US')} | متوسط الفاتورة: ${aovKwd.toFixed(2)} د.ك | الصافي المرجّح بالجيب: ${weightedNetPct.toFixed(1)}% (${netPocket10.toFixed(2)} د.ك/10)${peerClauseAr} | التشخيص: ${rootCauseAr}]`
  const feryalContextEn = `[Active Filter: ${subtitleEn} | Net Sales: ${fKwd(salesKwd, false)} | Orders: ${orders.toLocaleString('en-US')} | AOV: ${aovKwd.toFixed(2)} KWD | Weighted Net Pocket: ${weightedNetPct.toFixed(1)}% (${netPocket10.toFixed(2)} KWD/10)${peerClauseEn} | Diagnosis: ${rootCauseEn}]`

  return {
    filters,
    isFiltered: isNonDefaultFilter(filters),
    isTodayFallback,
    todayFallbackDate,
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

function shareInLocOrCh(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 0
}
