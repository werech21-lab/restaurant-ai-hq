/**
 * Global Filter Engine — Real Multi-Bucket Odoo Slicing & Plain-Language Presenter
 *
 * Powers the GlobalFilterContext & TopFilterBar across:
 *   - /erp                   (ملخص الشركة)
 *   - /erp/feryal-ai         (المستشارة فريال)
 *   - /erp/aggregator-radar  (مراقبة التوصيل)
 *
 * Strictly enforces:
 *   1. ONLY the 6 approved Venture Foods restaurant brands (zero canceled/banned brands).
 *   2. ONLY the 7 active Odoo restaurant locations (zero legacy removed locations).
 *   3. Real Odoo 4-period buckets (today / week / month / year) + 3D proportional cube slicing
 *      with zero NaN / Infinity / empty crashes.
 */

import { ODOO } from '@/lib/odoo/odoo-dataset'
import {
  BRANCH_TRUE_CASH,
  JOURNEY_PLAYS,
  JOURNEY_SHORTCUTS,
  type JourneyPlay,
} from '@/lib/full-journey-enterprise-brain'
import type { OdooBucketSummary, OdooLiveSummary } from '@/lib/odoo/live-sync-core'

export type GlobalPeriod = 'today' | 'week' | 'month' | 'year'

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
  brand: GlobalBrand
  branch: GlobalBranch
  channel: GlobalChannel
}

export const DEFAULT_GLOBAL_FILTERS: GlobalFilters = {
  period: 'month',
  brand: 'all',
  branch: 'all',
  channel: 'all',
}

export interface FilterOption<T extends string> {
  id: T
  ar: string
  en: string
}

export const GLOBAL_PERIOD_OPTIONS: readonly FilterOption<GlobalPeriod>[] = [
  { id: 'today', ar: 'اليوم', en: 'Today' },
  { id: 'week', ar: 'الأسبوع', en: 'Week' },
  { id: 'month', ar: 'الشهر', en: 'Month' },
  { id: 'year', ar: 'السنة', en: 'Year' },
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
  { id: 'talabat-tmp', ar: 'طلبات TMP', en: 'Talabat TMP' },
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

const BRAND_SET = new Set<string>(APPROVED_BRAND_IDS)
const BRANCH_SET = new Set<string>(APPROVED_BRANCH_IDS)
const CHANNEL_SET = new Set<string>(APPROVED_CHANNEL_IDS)

export function isNonDefaultFilter(f: GlobalFilters): boolean {
  return f.period !== 'month' || f.brand !== 'all' || f.branch !== 'all' || f.channel !== 'all'
}

export function getPeriodLabel(p: GlobalPeriod, isAr: boolean): string {
  const opt = GLOBAL_PERIOD_OPTIONS.find((x) => x.id === p) ?? GLOBAL_PERIOD_OPTIONS[2]
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

export function buildFilterSubtitle(f: GlobalFilters, isAr: boolean): string {
  const parts = [getBrandLabel(f.brand, isAr), getBranchLabel(f.branch, isAr)]
  if (f.channel !== 'all') parts.push(getChannelLabel(f.channel, isAr))
  parts.push(getPeriodLabel(f.period, isAr))
  return parts.join(' • ')
}

// ---------------------------------------------------------------------------
// 30-day Reference Dimensional Cube (Brand × Branch × UI Channel)
// ---------------------------------------------------------------------------
type BrandKey = Exclude<GlobalBrand, 'all'>
type BranchKey = Exclude<GlobalBranch, 'all'>
type ChannelKey = Exclude<GlobalChannel, 'all'>

const safeNum = (v: unknown, fb = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fb

const safeDiv = (num: number, den: number, fb = 0): number =>
  den > 0 && Number.isFinite(num) && Number.isFinite(den) ? num / den : fb

interface Cube30Data {
  cell: Record<string, number> // `${brand}|${branch}|${channel}` -> netKwd
  brandBranch: Record<string, number>
  brandChannel: Record<string, number>
  branchChannel: Record<string, number>
  byBrand: Record<BrandKey, { netKwd: number; orders: number }>
  byBranch: Record<BranchKey, { netKwd: number; orders: number }>
  byChannel: Record<ChannelKey, { netKwd: number; orders: number }>
  totalNet30: number
  totalOrders30: number
}

const CUBE30: Cube30Data = (() => {
  const cell: Record<string, number> = {}
  const addCell = (b: string, loc: string, ch: ChannelKey, val: number) => {
    if (!BRAND_SET.has(b) || !BRANCH_SET.has(loc) || val <= 0) return
    const k = `${b}|${loc}|${ch}`
    cell[k] = (cell[k] ?? 0) + val
  }

  const rawBuckets = (ODOO as unknown as { buckets?: Partial<Record<GlobalPeriod, OdooBucketSummary>> }).buckets
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
    else if (chStr === 'shop') {
      const hr = hallShareOfShop[loc] ?? (loc === 'ardiya' ? 0 : 0.9)
      addCell(b, loc, 'dine-in', net * hr)
      addCell(b, loc, 'takeaway-direct', net * (1 - hr))
    }
  }

  const brandBranch: Record<string, number> = {}
  const brandChannel: Record<string, number> = {}
  const branchChannel: Record<string, number> = {}

  for (const [k, v] of Object.entries(cell)) {
    const [b, l, c] = k.split('|')
    brandBranch[`${b}|${l}`] = (brandBranch[`${b}|${l}`] ?? 0) + v
    brandChannel[`${b}|${c}`] = (brandChannel[`${b}|${c}`] ?? 0) + v
    branchChannel[`${l}|${c}`] = (branchChannel[`${l}|${c}`] ?? 0) + v
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
    brandBranch,
    brandChannel,
    branchChannel,
    byBrand,
    byBranch,
    byChannel,
    totalNet30,
    totalOrders30,
  }
})()

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
}

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

function simplifyPlayCopy(p: JourneyPlay): {
  titleAr: string
  titleEn: string
  problemAr: string
  problemEn: string
  solutionAr: string
  solutionEn: string
} {
  const id = p.id
  if (id === 'proc-price-creep') {
    return {
      titleAr: 'فرق سعر مورد',
      titleEn: 'Supplier Price Rise',
      problemAr: 'ارتفعت أسعار بعض مواد المطبخ تدريجياً عن الشهر الماضي بدون إشعار مسبق.',
      problemEn: 'Several kitchen ingredients crept up in price vs last month without notice.',
      solutionAr: 'تثبيت أسعار العقود ومطالبة المورد بفرق السعر أو طلب عرض بديل.',
      solutionEn: 'Lock contract prices and request a supplier credit or alternate quote.',
    }
  }
  if (id === 'proc-multi-vendor') {
    return {
      titleAr: 'توحيد أسعار الشراء',
      titleEn: 'Unify Vendor Prices',
      problemAr: 'نشتري نفس الصنف من أكثر من مورد بأسعار مختلفة.',
      problemEn: 'The same ingredient is bought from multiple suppliers at different prices.',
      solutionAr: 'الشراء بأقل سعر معتمد وتوحيد الطلبية مع المورد الأفضل.',
      solutionEn: 'Standardize orders at the lowest approved supplier rate.',
    }
  }
  if (id === 'proc-off-po') {
    return {
      titleAr: 'فواتير بدون طلب شراء',
      titleEn: 'Bills Without PO',
      problemAr: 'توجد فواتير مشتريات دخلت الحسابات مباشرة بدون أمر شراء مسبق.',
      problemEn: 'Some vendor bills were posted directly without a prior purchase order.',
      solutionAr: 'منع صرف أي فاتورة مورد لا ترتبط بأمر شراء معتمد بالنظام.',
      solutionEn: 'Require an approved purchase order before paying any supplier bill.',
    }
  }
  if (id.startsWith('kitchen-variance') || id.includes('variance')) {
    return {
      titleAr: 'نقص بالمطبخ',
      titleEn: 'Kitchen Food Gap',
      problemAr: 'استهلاك المواد الخام في المطبخ أعلى من كمية الطلبات المباعة.',
      problemEn: 'Raw food usage in the kitchen is higher than actual dishes sold.',
      solutionAr: 'وزن الوجبات يومياً وجرد الأصناف الغالية نهاية كل شفت.',
      solutionEn: 'Weigh portions daily and count top proteins at the end of every shift.',
    }
  }
  if (id.startsWith('kitchen-scrap') || id.includes('scrap')) {
    return {
      titleAr: 'هدر التحضير',
      titleEn: 'Kitchen Prep Waste',
      problemAr: 'توجد كميات طعام تالفة بسبب التحضير الزائد قبل وقت الذروة.',
      problemEn: 'Excess pre-prep is causing avoidable food waste at branches.',
      solutionAr: 'تقسيم التحضير على دفعتين حسب حركة البيع الفعلية.',
      solutionEn: 'Split prep into two smaller batches matched to live order flow.',
    }
  }
  if (id.startsWith('kitchen-pack') || id.includes('pack')) {
    return {
      titleAr: 'تكلفة التغليف',
      titleEn: 'Packaging Cost',
      problemAr: 'صرف علب وأكياس التغليف في بعض الفروع أعلى من عدد طلبات التوصيل.',
      problemEn: 'Packaging spend at some branches exceeds actual delivery order volume.',
      solutionAr: 'ربط صرف العلب والأكياس بعدد الطلبات الفعلي لكل فرع.',
      solutionEn: 'Tie packaging issuance directly to actual order counts per branch.',
    }
  }
  if (id.includes('reprice') || id.includes('price')) {
    return {
      titleAr: 'تعديل سعر صنف',
      titleEn: 'Menu Price Tweak',
      problemAr: 'بعض الأصناف الأكثر مبيعاً هامش ربحها أقل بسبب ثبات سعرها القديم.',
      problemEn: 'Top-selling dishes carry thinner margins due to unchanged older prices.',
      solutionAr: 'إضافة زيادة بسيطة (١٠٠ إلى ١٥٠ فلس) على الأصناف الرئيسية القوية.',
      solutionEn: 'Add a gentle 100–150 fils adjustment on inelastic best-sellers.',
    }
  }
  if (id.includes('combo') || id.includes('drink') || id.includes('upsell') || p.stage === 'menu') {
    return {
      titleAr: 'إضافة مشروب وكومبو',
      titleEn: 'Drink & Combo Add-on',
      problemAr: 'أغلب الفواتير تخرج بصنف واحد بدون مشروب أو طبق جانبي.',
      problemEn: 'Most orders go out as a single item without a drink or side.',
      solutionAr: 'تفعيل عرض مشروب أو سبرنغ رول بسعر مميز عند الدفع وفي التطبيقات.',
      solutionEn: 'Prompt a quick drink or side combo at checkout and on delivery apps.',
    }
  }
  if (id.includes('host') || id.includes('salmiya') || id.includes('ardiya')) {
    return {
      titleAr: 'تشغيل مطبخ إضافي',
      titleEn: 'Add Brand to Kitchen',
      problemAr: 'بعض مطابخنا تشغّل علامة واحدة رغم قدرتها على تجهيز علامة ثانية بنفس الفريق.',
      problemEn: 'Existing kitchens have spare capacity to run a second brand on the same team.',
      solutionAr: 'تشغيل فرانكس وذا نودل بار من نفس المطبخ الحالي لزيادة المبيعات بدون إيجار جديد.',
      solutionEn: "Launch Frank's or Noodle Bar from existing kitchens with zero extra rent.",
    }
  }
  if (id.includes('discount') || id.includes('comp')) {
    return {
      titleAr: 'ضبط الخصومات والمجاني',
      titleEn: 'Cap Freebies & Discounts',
      problemAr: 'توجد خصومات يدوية وطلبات مجانية متفرقة تقلل صافي المبيعات.',
      problemEn: 'Manual discounts and unlogged free orders are trimming net sales.',
      solutionAr: 'قصر الخصم والضيافة على رمز المدير فقط وبحد يومي واضح.',
      solutionEn: 'Require manager PIN and a clear daily cap for discounts and comps.',
    }
  }
  if (p.stage === 'operations') {
    return {
      titleAr: 'التزام فتح الفروع',
      titleEn: 'On-Time Branch Open',
      problemAr: 'تأخر فتح الكاشير أو الإغلاق المبكر يضيع طلبات جاهزة أول وآخر اليوم.',
      problemEn: 'Late register openings or early closings miss ready orders.',
      solutionAr: 'الالتزام بفتح واستلام الطلبات بالموعد المحدد في كل شفت.',
      solutionEn: 'Enforce on-time POS and tablet opening across every shift.',
    }
  }
  if (id.includes('repair') || id.includes('maint')) {
    return {
      titleAr: 'تكرار صيانة المعدات',
      titleEn: 'Repeat Equipment Fixes',
      problemAr: 'بعض الأجهزة تتكرر عليها فواتير الصيانة أكثر من قيمة استبدالها.',
      problemEn: 'Repeated repair bills on aging equipment cost more than replacement.',
      solutionAr: 'استبدال القطعة كثيرة الأعطال أو توقيع عقد صيانة ثابت السعر.',
      solutionEn: 'Replace repeat-failure units or lock a flat preventive maintenance contract.',
    }
  }
  if (p.stage === 'opex') {
    return {
      titleAr: 'ضبط المصاريف والعهد',
      titleEn: 'Tighten Petty Cash',
      problemAr: 'توجد عهد نقدية ومصاريف عامة مفتوحة تحتاج تسوية وتوزيعاً على الفروع.',
      problemEn: 'Open cash custodies and general bills need prompt branch settlement.',
      solutionAr: 'تصفية العهد أسبوعياً وربط كل مصروف بالفرع المسؤول عنه.',
      solutionEn: 'Settle cash custodies weekly and tag every bill to its branch.',
    }
  }
  if (id.includes('keeta')) {
    return {
      titleAr: 'خصومات تطبيق كيتا',
      titleEn: 'Keeta Promo Cap',
      problemAr: 'حملات الخصم المشتركة في كيتا تأكل جزءاً كبيراً من صافي الطلب.',
      problemEn: 'Co-funded promo discounts on Keeta eat into per-order profit.',
      solutionAr: 'وضع حد أدنى للطلب وتحديد سقف الخصم الذي تتحمله الشركة.',
      solutionEn: 'Set a minimum basket size and cap our co-funded promo share.',
    }
  }
  if (id.includes('tmp') || id.includes('tgo') || id.includes('talabat')) {
    return {
      titleAr: 'تفعيل التوصيل الذاتي',
      titleEn: 'Shift to TMP / Direct',
      problemAr: 'الاعتماد الكامل على عمولة التوصيل العالية يقلل الصافي المتبقي للشركة.',
      problemEn: 'Relying solely on high-commission delivery trims net take-home cash.',
      solutionAr: 'تفعيل حساب TMP والطلب المباشر للطلبات القريبة لتوفير فرق العمولة.',
      solutionEn: 'Activate TMP and direct ordering on nearby zones to save commission.',
    }
  }
  if (p.stage === 'delivery') {
    return {
      titleAr: 'تحصيل مستحقات التطبيقات',
      titleEn: 'Collect App Payouts',
      problemAr: 'توجد مبالغ مبيعات معلقة لدى تطبيقات التوصيل تحتاج مطابقة وتحصيلاً.',
      problemEn: 'Pending delivery app balances need weekly bank payout matching.',
      solutionAr: 'مطابقة كشوف التطبيقات أسبوعياً وتحصيل أي فروقات متأخرة فوراً.',
      solutionEn: 'Reconcile app statements weekly and collect delayed payouts.',
    }
  }
  return {
    titleAr: 'زيادة العملاء الدائمين',
    titleEn: 'Grow Repeat Guests',
    problemAr: 'أغلب العملاء يطلبون عبر التطبيقات المتكررة فنخسر العمولة في كل مرة.',
    problemEn: 'Repeat guests keep ordering via high-fee apps instead of direct.',
    solutionAr: 'وضع كرت خصم للطلب المباشر داخل كل كيس توصيل وعند الكاشير.',
    solutionEn: 'Place a direct-order VIP card in every bag and ask for phone at POS.',
  }
}

// ---------------------------------------------------------------------------
// Main Workspace Slice Computation
// ---------------------------------------------------------------------------
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
  targetStage?: JourneyPlay['stage'] | 'all'
  href?: string
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

export interface GlobalWorkspaceSlice {
  filters: GlobalFilters
  isFiltered: boolean
  subtitleAr: string
  subtitleEn: string
  periodRangeLabelAr: string
  periodRangeLabelEn: string
  periodDays: number
  salesKwd: number
  orders: number
  aovKwd: number
  /** Scale of current period alone vs 30-day month (~0.033 today, ~0.23 week, 1.0 month, ~10.9 year) */
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
  summaryCards: SummaryCardData[]
  plays: SimplePlayView[]
  totalPlaysBenefitPeriodKwd: number
  totalPlaysBenefitMonthlyKwd: number
  feryalNotes: FeryalSimpleNote[]
  feryalContextAr: string
  feryalContextEn: string
}

export function computeGlobalWorkspace(
  filters: GlobalFilters,
  liveSummary?: OdooLiveSummary | null,
): GlobalWorkspaceSlice {
  const rawBuckets = (ODOO as unknown as { buckets?: Partial<Record<GlobalPeriod, OdooBucketSummary>> }).buckets
  const monthBkt = liveSummary?.buckets?.month ?? rawBuckets?.month
  const activeBkt = liveSummary?.buckets?.[filters.period] ?? rawBuckets?.[filters.period]

  const monthGroupSales = safeNum(monthBkt?.totals.restaurantNetKwd, CUBE30.totalNet30)
  const monthGroupOrders = safeNum(monthBkt?.totals.restaurantOrders, CUBE30.totalOrders30)

  const defaultDays: Record<GlobalPeriod, number> = { today: 1, week: 7, month: 30, year: 315 }
  const periodDays = safeNum(activeBkt?.days, defaultDays[filters.period])

  const fallbackPeriodRatio: Record<GlobalPeriod, number> = {
    today: 1 / 30,
    week: 7 / 30,
    month: 1,
    year: 10.9,
  }
  const periodGroupSales = activeBkt
    ? safeNum(activeBkt.totals.restaurantNetKwd, monthGroupSales * fallbackPeriodRatio[filters.period])
    : monthGroupSales * fallbackPeriodRatio[filters.period]
  const periodGroupOrders = activeBkt
    ? safeNum(activeBkt.totals.restaurantOrders, Math.round(monthGroupOrders * fallbackPeriodRatio[filters.period]))
    : Math.round(monthGroupOrders * fallbackPeriodRatio[filters.period])

  const periodScale = Math.max(0.01, safeDiv(periodGroupSales, monthGroupSales, fallbackPeriodRatio[filters.period]))

  // Calculate exact or proportional salesKwd & orders for (period, brand, branch, channel)
  let salesKwd = 0
  let orders = 0

  const { brand, branch, channel } = filters

  if (brand === 'all' && branch === 'all' && channel === 'all') {
    salesKwd = periodGroupSales
    orders = periodGroupOrders
  } else if (brand !== 'all' && branch === 'all' && channel === 'all') {
    if (activeBkt?.byBrand?.[brand]) {
      salesKwd = safeNum(activeBkt.byBrand[brand].netKwd)
      orders = safeNum(activeBkt.byBrand[brand].orders)
    } else {
      salesKwd = CUBE30.byBrand[brand].netKwd * periodScale
      orders = Math.round(CUBE30.byBrand[brand].orders * periodScale)
    }
  } else if (brand === 'all' && branch !== 'all' && channel === 'all') {
    if (activeBkt?.byLocation?.[branch]) {
      salesKwd = safeNum(activeBkt.byLocation[branch].netKwd)
      orders = safeNum(activeBkt.byLocation[branch].orders)
    } else {
      salesKwd = CUBE30.byBranch[branch].netKwd * periodScale
      orders = Math.round(CUBE30.byBranch[branch].orders * periodScale)
    }
  } else if (brand === 'all' && branch === 'all' && channel !== 'all') {
    if (activeBkt?.uiChannels?.[channel]) {
      salesKwd = safeNum(activeBkt.uiChannels[channel].netKwd)
      orders = safeNum(activeBkt.uiChannels[channel].orders)
    } else {
      salesKwd = CUBE30.byChannel[channel].netKwd * periodScale
      orders = Math.round(CUBE30.byChannel[channel].orders * periodScale)
    }
  } else if (brand === 'all' && branch !== 'all' && channel !== 'all') {
    const locCh = activeBkt?.byLocation?.[branch]?.uiChannels?.[channel]
    if (locCh) {
      salesKwd = safeNum(locCh.netKwd)
      orders = safeNum(locCh.orders)
    } else {
      const ref30 = safeNum(CUBE30.branchChannel[`${branch}|${channel}`])
      salesKwd = ref30 * periodScale
      orders = Math.round(safeDiv(salesKwd, 4.9))
    }
  } else if (brand !== 'all' && branch !== 'all' && channel === 'all') {
    const locTotal30 = APPROVED_BRAND_IDS.reduce((s, b) => s + safeNum(CUBE30.brandBranch[`${b}|${branch}`]), 0)
    const shareInLoc = safeDiv(safeNum(CUBE30.brandBranch[`${brand}|${branch}`]), locTotal30, 0)
    const locPeriodNet = activeBkt?.byLocation?.[branch]
      ? safeNum(activeBkt.byLocation[branch].netKwd)
      : CUBE30.byBranch[branch].netKwd * periodScale
    const locPeriodOrd = activeBkt?.byLocation?.[branch]
      ? safeNum(activeBkt.byLocation[branch].orders)
      : CUBE30.byBranch[branch].orders * periodScale
    salesKwd = locPeriodNet * shareInLoc
    const brandAov = safeDiv(CUBE30.byBrand[brand].netKwd, CUBE30.byBrand[brand].orders, 4.8)
    orders = salesKwd > 0 ? Math.max(1, Math.round(Math.min(locPeriodOrd, safeDiv(salesKwd, brandAov, locPeriodOrd * shareInLoc)))) : 0
  } else if (brand !== 'all' && branch === 'all' && channel !== 'all') {
    const chTotal30 = APPROVED_BRAND_IDS.reduce((s, b) => s + safeNum(CUBE30.brandChannel[`${b}|${channel}`]), 0)
    const shareInCh = safeDiv(safeNum(CUBE30.brandChannel[`${brand}|${channel}`]), chTotal30, 0)
    const chPeriodNet = activeBkt?.uiChannels?.[channel]
      ? safeNum(activeBkt.uiChannels[channel].netKwd)
      : CUBE30.byChannel[channel].netKwd * periodScale
    const chPeriodOrd = activeBkt?.uiChannels?.[channel]
      ? safeNum(activeBkt.uiChannels[channel].orders)
      : CUBE30.byChannel[channel].orders * periodScale
    salesKwd = chPeriodNet * shareInCh
    const brandAov = safeDiv(CUBE30.byBrand[brand].netKwd, CUBE30.byBrand[brand].orders, 4.8)
    orders = salesKwd > 0 ? Math.max(1, Math.round(Math.min(chPeriodOrd, safeDiv(salesKwd, brandAov, chPeriodOrd * shareInCh)))) : 0
  } else if (brand !== 'all' && branch !== 'all' && channel !== 'all') {
    const locChTotal30 = APPROVED_BRAND_IDS.reduce((s, b) => s + safeNum(CUBE30.cell[`${b}|${branch}|${channel}`]), 0)
    const shareInLocCh = safeDiv(safeNum(CUBE30.cell[`${brand}|${branch}|${channel}`]), locChTotal30, 0)
    const locChActual = activeBkt?.byLocation?.[branch]?.uiChannels?.[channel]
    const baseNet = locChActual ? safeNum(locChActual.netKwd) : safeNum(CUBE30.branchChannel[`${branch}|${channel}`]) * periodScale
    const baseOrd = locChActual ? safeNum(locChActual.orders) : safeDiv(baseNet, 4.9)
    salesKwd = baseNet * shareInLocCh
    const brandAov = safeDiv(CUBE30.byBrand[brand].netKwd, CUBE30.byBrand[brand].orders, 4.8)
    orders = salesKwd > 0 ? Math.max(1, Math.round(Math.min(baseOrd, safeDiv(salesKwd, brandAov, baseOrd * shareInLocCh)))) : 0
  }

  salesKwd = Math.max(0, Math.round(salesKwd * 1000) / 1000)
  orders = Math.max(0, Math.round(orders))
  const aovKwd = orders > 0 ? Math.round((salesKwd / orders) * 1000) / 1000 : 0

  const approxMonthSlice = safeDiv(salesKwd, periodScale, 0)
  const dimensionShare =
    brand === 'all' && branch === 'all' && channel === 'all'
      ? 1
      : Math.min(1, Math.max(0, safeDiv(approxMonthSlice, monthGroupSales, 0)))
  const totalScale = safeDiv(salesKwd, monthGroupSales, 0)

  // -------------------------------------------------------------------------
  // 10-KWD Breakdown (وين تروح كل ١٠ دنانير مبيعات؟)
  // -------------------------------------------------------------------------
  const baseNP = JOURNEY_SHORTCUTS.netPocket
  let food10 = safeNum(baseNP.foodAndPack10, 2.68)
  let delivery10 = safeNum(baseNP.platformCut10, 1.35)
  let opexRent10 = safeNum(baseNP.branchOpexRent10, 3.45)

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
      // Lower packaging cost in dine-in
      food10 = Math.max(2.1, food10 - 0.18)
    }
  } else if (brand !== 'all' && branch === 'all') {
    // Weight delivery commission by the brand's actual channel mix
    let weightedComm = 0
    let sumCh = 0
    for (const cid of APPROVED_CHANNEL_IDS) {
      const w = safeNum(CUBE30.brandChannel[`${brand}|${cid}`])
      weightedComm += w * CHANNEL_COMM_PER10[cid]
      sumCh += w
    }
    if (sumCh > 0) delivery10 = weightedComm / sumCh
  }

  // Incorporate real YTD accounting margins when period === 'year' and unfiltered
  if (filters.period === 'year' && activeBkt?.accounting && activeBkt.accounting.income > 100_000 && brand === 'all' && branch === 'all' && channel === 'all') {
    const inc = activeBkt.accounting.income
    food10 = Math.min(4.2, Math.max(2.2, (activeBkt.accounting.cogs / inc) * 10))
  }

  food10 = Math.round(Math.min(4.8, Math.max(1.8, food10)) * 100) / 100
  delivery10 = Math.round(Math.min(2.8, Math.max(0, delivery10)) * 100) / 100
  opexRent10 = Math.round(Math.min(10 - food10 - delivery10 - 0.6, Math.max(1.8, opexRent10)) * 100) / 100
  const netPocket10 = Math.round(Math.max(0, 10 - food10 - delivery10 - opexRent10) * 100) / 100

  // -------------------------------------------------------------------------
  // Filtered & Scaled Plain-Language Recommendation Cards
  // -------------------------------------------------------------------------
  const periodBenefitUnitAr: Record<GlobalPeriod, string> = {
    today: 'يومياً',
    week: 'أسبوعياً',
    month: 'شهرياً',
    year: 'سنوياً',
  }
  const periodBenefitUnitEn: Record<GlobalPeriod, string> = {
    today: '/ day',
    week: '/ week',
    month: '/ month',
    year: '/ year',
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
    return okBrand && okBranch && okChannel
  })
  const effectivePlays = matchedRawPlays.length > 0 ? matchedRawPlays : JOURNEY_PLAYS.slice(0, 6)

  const plays: SimplePlayView[] = effectivePlays.map((p) => {
    const scope = detectPlayScope(p)
    const copy = simplifyPlayCopy(p)
    // If play is already specific to the chosen branch/brand, don't double-shrink its monthly KWD
    const brandSpecific = brand !== 'all' && scope.brands !== 'all' && scope.brands.includes(brand)
    const branchSpecific = branch !== 'all' && scope.branches !== 'all' && scope.branches.includes(branch)
    const scopeFactor = brandSpecific || branchSpecific ? 1 : dimFactorForPlay
    const monthlyBenefitKwd = Math.max(15, Math.round(p.monthlyKwd * scopeFactor))
    const pMult = filters.period === 'year' ? 12 : filters.period === 'week' ? 7 / 30 : filters.period === 'today' ? 1 / 30 : 1
    const periodBenefitKwd = Math.max(1, Math.round(monthlyBenefitKwd * pMult * 10) / 10)
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
    }
  })

  const totalPlaysBenefitMonthlyKwd = plays.reduce((s, p) => s + p.monthlyBenefitKwd, 0)
  const totalPlaysBenefitPeriodKwd = Math.round(plays.reduce((s, p) => s + p.periodBenefitKwd, 0))

  // -------------------------------------------------------------------------
  // 8 Ultra-Simple Summary Cards (2–3 words title, 1 short clear sentence)
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
        s.menu.monthlyKwd * periodScale * dimFactorForPlay,
    ),
  )
  const hostMonthlyBase = safeNum(s.host?.contribution, 2400)
  const kitchenHostKwd = Math.max(
    15,
    Math.round(hostMonthlyBase * (filters.period === 'year' ? 12 : periodScale) * (branch === 'all' ? 1 : 0.35)),
  )
  const deliveryDuesKwd = Math.max(
    0,
    Math.round(
      s.delivery.openClearingKwd *
        (channel === 'dine-in' ? 0 : branch === 'avenues' ? 0 : dimFactorForPlay),
    ),
  )

  const summaryCards: SummaryCardData[] = [
    {
      id: 'before-rent',
      num: 1,
      titleAr: 'الباقي قبل الإيجار',
      titleEn: 'Left Before Rent',
      valueAr: fKwd(beforeRentKwd, true),
      valueEn: fKwd(beforeRentKwd, false),
      descAr: `يبقى ${(10 - food10 - delivery10).toFixed(2)} د.ك من كل ١٠ دنانير بعد الأكل والتوصيل.`,
      descEn: `${(10 - food10 - delivery10).toFixed(2)} KWD stays from every 10 KWD after food & delivery.`,
      accent: 'emerald',
      targetStage: 'all',
    },
    {
      id: 'profit-upside',
      num: 2,
      titleAr: 'فرص زيادة الربح',
      titleEn: 'Profit Upside',
      valueAr: `+${fKwd(totalPlaysBenefitPeriodKwd, true)}`,
      valueEn: `+${fKwd(totalPlaysBenefitPeriodKwd, false)}`,
      descAr: `${plays.length} توصيات جاهزة تزيد الصافي بدون فتح فرع جديد.`,
      descEn: `${plays.length} ready actions that lift net cash with zero new rent.`,
      accent: 'emerald',
      targetStage: 'all',
    },
    {
      id: 'procurement-kitchen',
      num: 3,
      titleAr: 'المشتريات والمطبخ',
      titleEn: 'Buying & Kitchen',
      valueAr: fKwd(kitchenGapKwd, true),
      valueEn: fKwd(kitchenGapKwd, false),
      descAr: 'فروقات أسعار الموردين واستهلاك المواد داخل المطبخ.',
      descEn: 'Supplier price gaps and raw ingredient usage in kitchens.',
      accent: 'amber',
      targetStage: 'procurement',
    },
    {
      id: 'expenses-maint',
      num: 4,
      titleAr: 'المصاريف والصيانة',
      titleEn: 'Bills & Repairs',
      valueAr: fKwd(opexLeakKwd, true),
      valueEn: fKwd(opexLeakKwd, false),
      descAr: 'متابعة الصيانة المتكررة والعهد والفواتير العامة.',
      descEn: 'Track repeat equipment repairs, petty cash, and general bills.',
      accent: 'rose',
      targetStage: 'opex',
    },
    {
      id: 'branch-discipline',
      num: 5,
      titleAr: 'التزام الفروع',
      titleEn: 'Branch Discipline',
      valueAr: `${opsScore} / 100`,
      valueEn: `${opsScore} / 100`,
      descAr: 'التزام مواعيد الفتح وتقليل الإلغاءات والخصومات اليدوية.',
      descEn: 'On-time opening and fewer cancellations or manual discounts.',
      accent: 'sky',
      targetStage: 'operations',
    },
    {
      id: 'menu-prices',
      num: 6,
      titleAr: 'أسعار المينيو',
      titleEn: 'Menu Prices',
      valueAr: `+${fKwd(menuBenefitKwd, true)}`,
      valueEn: `+${fKwd(menuBenefitKwd, false)}`,
      descAr: 'زيادة الربح عبر الكومبو والمشروبات وتعديل بسيط للأسعار.',
      descEn: 'Lift margin with drink combos and small best-seller tweaks.',
      accent: 'sky',
      targetStage: 'menu',
    },
    {
      id: 'kitchen-capacity',
      num: 7,
      titleAr: 'استغلال المطابخ',
      titleEn: 'Kitchen Capacity',
      valueAr: `+${fKwd(kitchenHostKwd, true)}`,
      valueEn: `+${fKwd(kitchenHostKwd, false)}`,
      descAr: 'تشغيل أكثر من مطعم داخل نفس المطبخ الحالي لزيادة البيع.',
      descEn: 'Run extra Venture Foods brands inside existing kitchens.',
      accent: 'emerald',
      targetStage: 'operations',
    },
    {
      id: 'delivery-dues',
      num: 8,
      titleAr: 'مستحقات التوصيل',
      titleEn: 'Delivery Dues',
      valueAr: fKwd(deliveryDuesKwd, true),
      valueEn: fKwd(deliveryDuesKwd, false),
      descAr: 'مبالغ مستحقة لنا عند طلبات وكيتا وديليفرو بانتظار التحويل.',
      descEn: 'Pending payouts owed by Talabat, Keeta, and Deliveroo.',
      accent: 'amber',
      href: '/erp/aggregator-radar',
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
      summaryAr: `فرق استهلاك مواد المطبخ يبلغ ${fKwd(kitchenGapKwd, true)} ويحتاج وزن الوجبات يومياً.`,
      summaryEn: `Kitchen ingredient gap is ${fKwd(kitchenGapKwd, false)}; weigh portions daily.`,
      benefitAr: `+${fKwd(Math.max(25, Math.round(kitchenGapKwd * 0.35)), true)}`,
      benefitEn: `+${fKwd(Math.max(25, Math.round(kitchenGapKwd * 0.35)), false)}`,
      promptAr: `اشرحي لي ببساطة سبب نقص المطبخ حالياً (${buildFilterSubtitle(filters, true)}) وكيف نوقفه هالأسبوع؟`,
      promptEn: `Explain simply why there is a kitchen food gap (${buildFilterSubtitle(filters, false)}) and how to stop it this week.`,
      tone: 'rose',
    },
    {
      id: 'note-supplier',
      titleAr: 'فرق سعر مورد',
      titleEn: 'Supplier Price Diff',
      summaryAr: 'بعض أصناف التوريد زاد سعرها عن الشهر الماضي وتحتاج تثبيت سعر فوري.',
      summaryEn: 'Several supplier items rose vs last month and need a price lock.',
      benefitAr: plays.find((p) => p.id === 'proc-price-creep')?.periodLabelAr ?? `+${fKwd(Math.round(950 * periodScale), true)}`,
      benefitEn: plays.find((p) => p.id === 'proc-price-creep')?.periodLabelEn ?? `+${fKwd(Math.round(950 * periodScale), false)}`,
      promptAr: `شنو أهم فروقات أسعار الموردين في (${buildFilterSubtitle(filters, true)}) وشنو نطلب من المشتريات اليوم؟`,
      promptEn: `What are the main supplier price differences in (${buildFilterSubtitle(filters, false)}) and what should purchasing do today?`,
      tone: 'amber',
    },
    {
      id: 'note-menu',
      titleAr: 'تعديل سعر صنف',
      titleEn: 'Item Price Tweak',
      summaryAr: 'إضافة مشروب مع الطلب وتعديل بسيط لأقوى الأصناف يرفع صافي الربح فوراً.',
      summaryEn: 'Adding a drink combo and small price tweak lifts profit right away.',
      benefitAr: `+${fKwd(menuBenefitKwd, true)}`,
      benefitEn: `+${fKwd(menuBenefitKwd, false)}`,
      promptAr: `اقترحي لي أبسط تعديل أسعار وكومبو مشروبات لنطاق (${buildFilterSubtitle(filters, true)}) بدون ما نخسر زباين.`,
      promptEn: `Suggest the simplest menu price tweak and drink combo for (${buildFilterSubtitle(filters, false)}) without losing guests.`,
      tone: 'sky',
    },
    {
      id: 'note-delivery',
      titleAr: 'مستحقات التوصيل',
      titleEn: 'Delivery Payouts',
      summaryAr: `مراجعة الحسابات المتوقفة وتحصيل ${fKwd(deliveryDuesKwd, true)} من تطبيقات التوصيل.`,
      summaryEn: `Check stopped app accounts and collect ${fKwd(deliveryDuesKwd, false)} from delivery apps.`,
      benefitAr: fKwd(deliveryDuesKwd, true),
      benefitEn: fKwd(deliveryDuesKwd, false),
      promptAr: `عطيني ملخص سريع لمستحقات وحسابات التوصيل في (${buildFilterSubtitle(filters, true)}).`,
      promptEn: `Give me a quick summary of delivery payouts and stopped accounts for (${buildFilterSubtitle(filters, false)}).`,
      tone: 'emerald',
    },
  ]

  const periodRangeLabelAr = activeBkt
    ? `${activeBkt.from} → ${activeBkt.to}${activeBkt.isLatestOperationalDay ? ' (آخر يوم عمل مكتمل)' : ''}`
    : getPeriodLabel(filters.period, true)
  const periodRangeLabelEn = activeBkt
    ? `${activeBkt.from} → ${activeBkt.to}${activeBkt.isLatestOperationalDay ? ' (latest full day)' : ''}`
    : getPeriodLabel(filters.period, false)

  const subtitleAr = buildFilterSubtitle(filters, true)
  const subtitleEn = buildFilterSubtitle(filters, false)

  const feryalContextAr = `[الفلتر النشط حالياً: ${subtitleAr} | المبيعات الصافية: ${fKwd(salesKwd, true)} | الطلبات: ${orders.toLocaleString('en-US')} | متوسط الفاتورة: ${aovKwd.toFixed(2)} د.ك | الصافي بالجيب من كل 10 د.ك: ${netPocket10.toFixed(2)} د.ك]`
  const feryalContextEn = `[Active Filter: ${subtitleEn} | Net Sales: ${fKwd(salesKwd, false)} | Orders: ${orders.toLocaleString('en-US')} | AOV: ${aovKwd.toFixed(2)} KWD | Net in Pocket per 10 KWD: ${netPocket10.toFixed(2)} KWD]`

  return {
    filters,
    isFiltered: isNonDefaultFilter(filters),
    subtitleAr,
    subtitleEn,
    periodRangeLabelAr,
    periodRangeLabelEn,
    periodDays,
    salesKwd,
    orders,
    aovKwd,
    periodScale,
    dimensionShare,
    totalScale,
    per10: {
      food10,
      delivery10,
      opexRent10,
      netPocket10,
    },
    summaryCards,
    plays,
    totalPlaysBenefitPeriodKwd,
    totalPlaysBenefitMonthlyKwd,
    feryalNotes,
    feryalContextAr,
    feryalContextEn,
  }
}
