/**
 * Aether BI V2 — canonical Venture Foods group ledger (Odoo, October 2026).
 *
 * Single source of truth for every V2 analytics surface (/erp, /erp/sales-analysis,
 * /erp/delivery-control, /erp/alerts, the Executive Command Palette and the Feryal
 * What-If calculator). All headline constants are the approved Odoo figures; the
 * per-dimension splits below reconcile exactly back to those totals.
 *
 * Scope rules enforced here: 6 active brands, 9 active branches, 11 sales channels.
 */

export type Lang = 'ar' | 'en'

// ---------------------------------------------------------------------------
// 1. Approved headline constants
// ---------------------------------------------------------------------------
export const LEDGER = {
  netSales: 167092.16,
  orders: 30540,
  aov: 5.471,
  netProfit: 42441.48,
  marginPct: 25.4,
  cogs: 41438.856,
  cogsPct: 24.8,
  cogsTargetPct: 24.0,
  cogsEntries: 418,
  cogsRecoverable: 1336,
  opex: 51154.95,
  opexEntries: 2213,
  maintCustody: 10707.93,
  maintEntries: 312,
  chillerRecovery: 850,
  salariesRentCommission: 32056.874,
  discounts: 4152,
  discountsPct: 2.4,
  keetaDiscounts: 2544,
  keetaOrders: 6267,
  keetaCapPct: 3.5,
  keetaCapKwd: 924,
  keetaRecovery: 1620,
  /** Promo-eligible Keeta sales base implied by the approved cap (924 KWD ÷ 3.5%). */
  keetaPromoBase: 26400,
  beverageGain: 2450,
  aovTarget: 5.75,
  menuMatrixGain: 584,
  menuDogsPurge: 18,
  menuPlowhorsesReprice: 4,
  menuItems: 364,
  topItems: 32,
  topItemsSharePct: 80,
  uptimePct: 99.1,
  brands: 6,
  branches: 9,
  channels: 11,
  licence: '2021/22838',
  periodLabelEn: 'October 2026',
  periodLabelAr: 'أكتوبر 2026',
  daysInPeriod: 31,
} as const

// ---------------------------------------------------------------------------
// 2. Profit trajectory (approved)
// ---------------------------------------------------------------------------
export const ROADMAP = [
  { id: 'run', en: 'Current run-rate', ar: 'المعدل الحالي', months: 1, incremental: 0, total: LEDGER.netProfit },
  { id: 'q1', en: 'Q1', ar: 'الربع الأول', months: 3, incremental: 20520, total: 147844 },
  { id: 'h1', en: 'H1', ar: 'النصف الأول', months: 6, incremental: 43800, total: 298449 },
  { id: 'fy', en: 'Full Year', ar: 'السنة الكاملة', months: 12, incremental: 91680, total: 600978 },
] as const

/** Baseline (pre-remedy) profit per horizon = approved total − approved incremental. */
export const ROADMAP_BASELINE = {
  q1: 147844 - 20520,
  h1: 298449 - 43800,
  fy: 600978 - 91680,
} as const

// ---------------------------------------------------------------------------
// 3. Profit levers (approved recommendations, 6,840 KWD/month)
// ---------------------------------------------------------------------------
export type LeverId = 'ardiya-yield' | 'chiller-overhaul' | 'keeta-cap' | 'beverage-attach' | 'menu-matrix'
export type Tone = 'emerald' | 'sky' | 'amber' | 'rose' | 'slate'

export interface Lever {
  id: LeverId
  monthly: number
  tone: Tone
  kind: 'cost' | 'growth'
  en: string
  ar: string
  detailEn: string
  detailAr: string
  ownerEn: string
  ownerAr: string
  composioAction: string
}

export const LEVERS: Lever[] = [
  {
    id: 'beverage-attach',
    monthly: 2450,
    tone: 'sky',
    kind: 'growth',
    en: 'Mandatory beverage in delivery combos',
    ar: 'المشروب الإلزامي في وجبات الكومبو للتوصيل',
    detailEn: 'Lifts group AOV from 5.471 to 5.750 KWD across Talabat Tgo, TMP and Keeta combos.',
    detailAr: 'يرفع متوسط السلة من 5.471 إلى 5.750 د.ك في وجبات طلبات جو وسوق طلبات وكيتا.',
    ownerEn: 'Operations & POS',
    ownerAr: 'العمليات ونقاط البيع',
    composioAction: 'dispatch_combo_drinks',
  },
  {
    id: 'keeta-cap',
    monthly: 1620,
    tone: 'sky',
    kind: 'cost',
    en: 'Cap Keeta promo burn at 3.5%',
    ar: 'سقف خصومات كيتا عند 3.5%',
    detailEn: 'Reduces Keeta promotions from 2,544 KWD to 924 KWD per month across 6,267 orders.',
    detailAr: 'يخفض خصومات كيتا من 2,544 د.ك إلى 924 د.ك شهرياً عبر 6,267 طلباً.',
    ownerEn: 'Marketing & Channels',
    ownerAr: 'التسويق والقنوات',
    composioAction: 'dispatch_keeta_cap',
  },
  {
    id: 'ardiya-yield',
    monthly: 1336,
    tone: 'rose',
    kind: 'cost',
    en: 'Ardiya poultry & marination yield calibration',
    ar: 'معايرة إنتاجية الدواجن والتتبيل في العارضية',
    detailEn: 'Brings COGS from 24.8% back to the 24.0% target across 418 central-kitchen entries.',
    detailAr: 'يعيد تكلفة الأغذية من 24.8% إلى المستهدف 24.0% عبر 418 قيداً للمطبخ المركزي.',
    ownerEn: 'Central Kitchen & QC',
    ownerAr: 'المطبخ المركزي والجودة',
    composioAction: 'dispatch_operations_plan',
  },
  {
    id: 'chiller-overhaul',
    monthly: 850,
    tone: 'amber',
    kind: 'cost',
    en: 'Commercial chiller overhaul',
    ar: 'تجديد المبردات التجارية',
    detailEn: 'Ends repeated cash repairs behind 10,707.930 KWD custody across 312 entries in Al-Kout & Salmiya.',
    detailAr: 'يوقف الإصلاحات النقدية المتكررة خلف عهدة 10,707.930 د.ك عبر 312 قيداً في الكوت والسالمية.',
    ownerEn: 'Maintenance & Procurement',
    ownerAr: 'الصيانة والمشتريات',
    composioAction: 'dispatch_chiller_plan',
  },
  {
    id: 'menu-matrix',
    monthly: 584,
    tone: 'emerald',
    kind: 'growth',
    en: 'Menu matrix rationalization',
    ar: 'إعادة هندسة مصفوفة المنيو',
    detailEn: 'Purge 18 sluggish Dog items and apply +5% to 4 popular Plowhorses.',
    detailAr: 'استبعاد 18 صنفاً ضعيفاً ورفع أسعار 4 أصناف شعبية منخفضة الهامش بنسبة 5%.',
    ownerEn: 'Menu Engineering',
    ownerAr: 'هندسة المنيو',
    composioAction: 'dispatch_combo_drinks',
  },
]

export const LEVERS_MONTHLY_TOTAL = LEVERS.reduce((s, l) => s + l.monthly, 0) // 6,840

/** Incremental profit for a subset of enabled levers across each approved horizon. */
export function leverImpact(enabled: Record<LeverId, boolean>) {
  const monthly = LEVERS.filter((l) => enabled[l.id]).reduce((s, l) => s + l.monthly, 0)
  const share = monthly / LEVERS_MONTHLY_TOTAL
  const q1 = 20520 * share
  const h1 = 43800 * share
  const fy = 91680 * share
  return {
    monthly,
    share,
    q1,
    h1,
    fy,
    q1Total: ROADMAP_BASELINE.q1 + q1,
    h1Total: ROADMAP_BASELINE.h1 + h1,
    fyTotal: ROADMAP_BASELINE.fy + fy,
  }
}

// ---------------------------------------------------------------------------
// 4. Brands (6) — reconciles to 167,092.160 KWD / 30,540 orders
// ---------------------------------------------------------------------------
export type BrandId = 'china-garden' | 'franks' | 'tahina' | 'burgerito' | 'chick-dip' | 'crave'

export interface Brand {
  id: BrandId
  en: string
  ar: string
  sales: number
  orders: number
  aov: number
  color: string
  cuisineEn: string
  cuisineAr: string
}

export const BRANDS: Brand[] = [
  { id: 'china-garden', en: 'China Garden', ar: 'تشاينا جاردن', sales: 141662.4, orders: 25890, aov: 5.472, color: '#0284C7', cuisineEn: 'Chinese & Asian', cuisineAr: 'صيني وآسيوي' },
  { id: 'franks', en: "Frank's Philly CheeseSteak", ar: 'فرانكس فيلي تشيز ستيك', sales: 11840.2, orders: 1580, aov: 7.49, color: '#059669', cuisineEn: 'Philly cheesesteaks', cuisineAr: 'ساندويتشات فيلي ستيك' },
  { id: 'tahina', en: 'Tahina', ar: 'طحينة', sales: 5120.34, orders: 1180, aov: 4.339, color: '#D97706', cuisineEn: 'Shawarma & Levant street food', cuisineAr: 'شاورما وأكل شارع شامي' },
  { id: 'burgerito', en: 'Burgerito', ar: 'برجريتو', sales: 3612.88, orders: 790, aov: 4.573, color: '#E11D48', cuisineEn: 'Smash burgers', cuisineAr: 'برجر سماش' },
  { id: 'chick-dip', en: 'Chick & Dip', ar: 'تشيك آند ديب', sales: 2904.11, orders: 656, aov: 4.427, color: '#0F766E', cuisineEn: 'Crispy chicken strips', cuisineAr: 'أصابع دجاج مقرمشة' },
  { id: 'crave', en: 'Crave', ar: 'كريف', sales: 1952.23, orders: 444, aov: 4.397, color: '#475569', cuisineEn: 'Melts, cups & mojitos', cuisineAr: 'ميلتس وأكواب وموهيتو' },
]

// ---------------------------------------------------------------------------
// 5. Branches (9 active only)
// ---------------------------------------------------------------------------
export type BranchId =
  | 'salmiya'
  | 'al-kout'
  | 'sharq'
  | 'hawally'
  | 'farwaniya'
  | 'ardiya'
  | 'mahboula'
  | 'mubarak-al-kabeer'
  | 'jabriya'

export interface Branch {
  id: BranchId
  en: string
  ar: string
  sales: number
  orders: number
  /** Relative operating margin weight; normalised so the 9 branches reconcile to 42,441.480 KWD. */
  marginWeight: number
  topChannel: ChannelId
  statusEn: string
  statusAr: string
  tone: Tone
}

const RAW_BRANCHES: Branch[] = [
  { id: 'salmiya', en: 'Salmiya', ar: 'السالمية', sales: 31246.23, orders: 5710, marginWeight: 0.286, topChannel: 'talabat-tgo', statusEn: 'Optimal', statusAr: 'مثالي', tone: 'emerald' },
  { id: 'al-kout', en: 'Al-Kout / Fahaheel', ar: 'الكوت / الفحيحيل', sales: 27904.39, orders: 5100, marginWeight: 0.261, topChannel: 'talabat-tmp', statusEn: 'Optimal', statusAr: 'مثالي', tone: 'emerald' },
  { id: 'sharq', en: 'Sharq', ar: 'شرق', sales: 24896.73, orders: 4550, marginWeight: 0.272, topChannel: 'deliveroo', statusEn: 'Optimal', statusAr: 'مثالي', tone: 'emerald' },
  { id: 'hawally', en: 'Hawally', ar: 'حولي', sales: 21387.79, orders: 3910, marginWeight: 0.214, topChannel: 'keeta', statusEn: 'Chiller repairs required', statusAr: 'يحتاج صيانة مبردات', tone: 'amber' },
  { id: 'farwaniya', en: 'Farwaniya', ar: 'الفروانية', sales: 18045.95, orders: 3300, marginWeight: 0.259, topChannel: 'talabat-tgo', statusEn: 'Optimal', statusAr: 'مثالي', tone: 'emerald' },
  { id: 'ardiya', en: 'Ardiya Central', ar: 'العارضية الحرفية', sales: 15372.48, orders: 2810, marginWeight: 0.198, topChannel: 'dine-in', statusEn: 'Prep waste calibration', statusAr: 'معايرة هدر التتبيل', tone: 'rose' },
  { id: 'mahboula', en: 'Mahboula', ar: 'المهبولة', sales: 11238.29, orders: 2055, marginWeight: 0.246, topChannel: 'talabat-tmp', statusEn: 'Optimal', statusAr: 'مثالي', tone: 'emerald' },
  { id: 'mubarak-al-kabeer', en: 'Mubarak Al-Kabeer', ar: 'مبارك الكبير / صباح السالم', sales: 9200.3, orders: 1680, marginWeight: 0.242, topChannel: 'talabat-tgo', statusEn: 'Rapid growth', statusAr: 'نمو متصاعد', tone: 'sky' },
  { id: 'jabriya', en: 'Jabriya', ar: 'الجابرية', sales: 7800.0, orders: 1425, marginWeight: 0.25, topChannel: 'talabat-tgo', statusEn: 'Optimal', statusAr: 'مثالي', tone: 'emerald' },
]

const MARGIN_NORMALISER =
  LEDGER.netProfit / RAW_BRANCHES.reduce((s, b) => s + b.sales * b.marginWeight, 0)

export const BRANCHES = RAW_BRANCHES.map((b) => ({
  ...b,
  marginPct: b.marginWeight * MARGIN_NORMALISER * 100,
  profit: b.sales * b.marginWeight * MARGIN_NORMALISER,
}))

export type BranchRow = (typeof BRANCHES)[number]

// ---------------------------------------------------------------------------
// 6. Sales channels (11)
// ---------------------------------------------------------------------------
export type ChannelId =
  | 'talabat-tgo'
  | 'talabat-tmp'
  | 'keeta'
  | 'deliveroo'
  | 'jahez'
  | 'cari'
  | 'direct-web'
  | 'dine-in'
  | 'takeaway'
  | 'drive-thru'
  | 'call-center'

export interface Channel {
  id: ChannelId
  en: string
  ar: string
  group: 'aggregator' | 'direct' | 'store'
  sales: number
  orders: number
  commissionPct: number
  promo: number
  /** Restaurant-paid rider cost per order (TMP model only). */
  riderCostPerOrder: number
  uptimePct: number
  color: string
}

export const CHANNELS: Channel[] = [
  { id: 'talabat-tgo', en: 'Talabat Tgo', ar: 'طلبات جو', group: 'aggregator', sales: 38412.71, orders: 7180, commissionPct: 17, promo: 820, riderCostPerOrder: 0, uptimePct: 99.4, color: '#F97316' },
  { id: 'talabat-tmp', en: 'Talabat TMP', ar: 'سوق طلبات', group: 'aggregator', sales: 24190.75, orders: 4420, commissionPct: 10, promo: 410, riderCostPerOrder: 0.35, uptimePct: 99.2, color: '#FB923C' },
  { id: 'keeta', en: 'Keeta', ar: 'كيتا', group: 'aggregator', sales: 35607.98, orders: 6267, commissionPct: 12, promo: 2544, riderCostPerOrder: 0, uptimePct: 98.8, color: '#EAB308' },
  { id: 'deliveroo', en: 'Deliveroo', ar: 'ديليفرو', group: 'aggregator', sales: 5418.2, orders: 905, commissionPct: 18, promo: 238, riderCostPerOrder: 0, uptimePct: 99.0, color: '#14B8A6' },
  { id: 'jahez', en: 'Jahez', ar: 'جاهز', group: 'aggregator', sales: 2214.63, orders: 410, commissionPct: 15, promo: 140, riderCostPerOrder: 0, uptimePct: 98.9, color: '#DC2626' },
  { id: 'cari', en: 'Cari', ar: 'كاري', group: 'aggregator', sales: 1302.4, orders: 236, commissionPct: 14, promo: 0, riderCostPerOrder: 0, uptimePct: 98.7, color: '#7C8798' },
  { id: 'direct-web', en: 'Direct Web', ar: 'الموقع المباشر', group: 'direct', sales: 992.4, orders: 172, commissionPct: 2.5, promo: 0, riderCostPerOrder: 0.35, uptimePct: 99.9, color: '#0EA5E9' },
  { id: 'dine-in', en: 'Dine-In', ar: 'الصالة', group: 'store', sales: 24310.42, orders: 4250, commissionPct: 0, promo: 0, riderCostPerOrder: 0, uptimePct: 100, color: '#133B5C' },
  { id: 'takeaway', en: 'Takeaway', ar: 'السفري', group: 'store', sales: 21904.17, orders: 4310, commissionPct: 0, promo: 0, riderCostPerOrder: 0, uptimePct: 100, color: '#1B5B7A' },
  { id: 'drive-thru', en: 'Drive-Thru', ar: 'خدمة السيارات', group: 'store', sales: 6120.5, orders: 1190, commissionPct: 0, promo: 0, riderCostPerOrder: 0, uptimePct: 100, color: '#2C7DA0' },
  { id: 'call-center', en: 'Call Center', ar: 'مركز الاتصال', group: 'direct', sales: 6618.0, orders: 1200, commissionPct: 0, promo: 0, riderCostPerOrder: 0.35, uptimePct: 100, color: '#468FAF' },
]

export const AGGREGATOR_IDS: ChannelId[] = ['talabat-tgo', 'talabat-tmp', 'keeta', 'deliveroo', 'jahez', 'cari']

// ---------------------------------------------------------------------------
// 7. Period
// ---------------------------------------------------------------------------
export type Period = 'daily' | 'monthly' | 'annual'

export const PERIODS: { id: Period; en: string; ar: string; factor: number }[] = [
  { id: 'daily', en: 'Daily', ar: 'يومي', factor: 1 / LEDGER.daysInPeriod },
  { id: 'monthly', en: 'Monthly', ar: 'شهري', factor: 1 },
  { id: 'annual', en: 'Annual', ar: 'سنوي', factor: 12 },
]

export const periodFactor = (p: Period) => PERIODS.find((x) => x.id === p)?.factor ?? 1

// ---------------------------------------------------------------------------
// 8. Filter-aware ledger view
// ---------------------------------------------------------------------------
export interface BiFilters {
  brand: BrandId | 'all'
  branch: BranchId | 'all'
  channel: ChannelId | 'all'
  period: Period
}

export const DEFAULT_FILTERS: BiFilters = { brand: 'all', branch: 'all', channel: 'all', period: 'monthly' }

export const brandById = (id: string | null | undefined) => BRANDS.find((b) => b.id === id) ?? null
export const branchById = (id: string | null | undefined) => BRANCHES.find((b) => b.id === id) ?? null
export const channelById = (id: string | null | undefined) => CHANNELS.find((c) => c.id === id) ?? null

/** Proportional sales and order shares for the selected brand × branch × channel slice. */
export function sliceShares(f: Pick<BiFilters, 'brand' | 'branch' | 'channel'>) {
  const brand = f.brand === 'all' ? null : brandById(f.brand)
  const branch = f.branch === 'all' ? null : branchById(f.branch)
  const channel = f.channel === 'all' ? null : channelById(f.channel)
  const bS = brand ? brand.sales / LEDGER.netSales : 1
  const bO = brand ? brand.orders / LEDGER.orders : 1
  const brS = branch ? branch.sales / LEDGER.netSales : 1
  const brO = branch ? branch.orders / LEDGER.orders : 1
  const cS = channel ? channel.sales / LEDGER.netSales : 1
  const cO = channel ? channel.orders / LEDGER.orders : 1
  return { brand, branch, channel, salesShare: bS * brS * cS, ordersShare: bO * brO * cO, brandShare: bS, branchShare: brS, channelShare: cS }
}

export function isFiltered(f: BiFilters) {
  return f.brand !== 'all' || f.branch !== 'all' || f.channel !== 'all'
}

export function ledgerView(f: BiFilters) {
  const s = sliceShares(f)
  const pf = periodFactor(f.period)
  const netSales = LEDGER.netSales * s.salesShare * pf
  const orders = LEDGER.orders * s.ordersShare * pf
  const marginPct = s.branch ? s.branch.marginPct : LEDGER.marginPct
  const netProfit = s.branch || s.brand || s.channel ? netSales * (marginPct / 100) : LEDGER.netProfit * pf
  const cogs = netSales * (LEDGER.cogsPct / 100)
  const opex = LEDGER.opex * s.salesShare * pf
  const channelPromo = s.channel ? s.channel.promo : LEDGER.discounts
  const discounts = channelPromo * s.brandShare * s.branchShare * pf
  const custody = LEDGER.maintCustody * s.salesShare * pf
  const levers = LEVERS_MONTHLY_TOTAL * s.salesShare * pf
  return {
    ...s,
    period: f.period,
    periodFactor: pf,
    filtered: isFiltered(f),
    netSales,
    orders,
    aov: orders > 0 ? netSales / orders : 0,
    netProfit,
    marginPct,
    cogs,
    cogsPct: LEDGER.cogsPct,
    opex,
    discounts,
    custody,
    levers,
  }
}

export type LedgerView = ReturnType<typeof ledgerView>

// ---------------------------------------------------------------------------
// 9. Menu engineering dataset (364 items, Top 32 = 80% of revenue)
// ---------------------------------------------------------------------------
export type Quadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog'
export type CategoryId = 'mains' | 'noodles-rice' | 'starters' | 'sandwiches' | 'combos' | 'sides' | 'beverages' | 'desserts'

export const CATEGORIES: { id: CategoryId; en: string; ar: string }[] = [
  { id: 'mains', en: 'Mains', ar: 'أطباق رئيسية' },
  { id: 'noodles-rice', en: 'Noodles & Rice', ar: 'نودلز وأرز' },
  { id: 'starters', en: 'Starters', ar: 'مقبلات' },
  { id: 'sandwiches', en: 'Sandwiches & Burgers', ar: 'ساندويتشات وبرجر' },
  { id: 'combos', en: 'Combos', ar: 'وجبات كومبو' },
  { id: 'sides', en: 'Sides', ar: 'أطباق جانبية' },
  { id: 'beverages', en: 'Beverages', ar: 'مشروبات' },
  { id: 'desserts', en: 'Desserts', ar: 'حلويات' },
]

export interface MenuItem {
  id: string
  rank: number
  en: string
  ar: string
  brand: BrandId
  category: CategoryId
  price: number
  cogsPct: number
  revenue: number
  units: number
  unitMargin: number
  totalMargin: number
  quadrant: Quadrant
  top32: boolean
  purgeCandidate: boolean
  repriceCandidate: boolean
  prepSec: number
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Seed = { en: string; ar: string; cat: CategoryId; price: number }

const HERO_ITEMS: Record<BrandId, Seed[]> = {
  'china-garden': [
    { en: 'Chicken Manchurian Combo', ar: 'كومبو دجاج منشوريان', cat: 'combos', price: 3.75 },
    { en: 'Kung Pao Chicken', ar: 'دجاج كونغ باو', cat: 'mains', price: 3.25 },
    { en: 'Chicken Fried Rice', ar: 'أرز مقلي بالدجاج', cat: 'noodles-rice', price: 2.5 },
    { en: 'Sweet & Sour Chicken', ar: 'دجاج حلو وحامض', cat: 'mains', price: 3.25 },
    { en: 'Chicken Chow Mein', ar: 'تشاو مين بالدجاج', cat: 'noodles-rice', price: 2.75 },
    { en: 'Dynamite Shrimp', ar: 'روبيان داينمايت', cat: 'starters', price: 3.5 },
    { en: 'Family Feast Box', ar: 'بوكس وليمة العائلة', cat: 'combos', price: 11.5 },
    { en: 'Chilli Chicken Dry', ar: 'دجاج بالفلفل الحار', cat: 'mains', price: 3.25 },
    { en: 'Beef with Black Pepper', ar: 'لحم بالفلفل الأسود', cat: 'mains', price: 3.75 },
    { en: 'Vegetable Spring Rolls', ar: 'سبرينغ رول خضار', cat: 'starters', price: 1.5 },
    { en: 'Szechuan Noodles', ar: 'نودلز سيشوان', cat: 'noodles-rice', price: 2.75 },
    { en: 'Chicken Corn Soup', ar: 'شوربة الذرة بالدجاج', cat: 'starters', price: 1.5 },
    { en: 'Garlic Chicken', ar: 'دجاج بالثوم', cat: 'mains', price: 3.25 },
    { en: 'Shrimp Fried Rice', ar: 'أرز مقلي بالروبيان', cat: 'noodles-rice', price: 3.0 },
    { en: 'Crispy Honey Chicken', ar: 'دجاج مقرمش بالعسل', cat: 'mains', price: 3.25 },
    { en: 'Lunch Box Combo', ar: 'كومبو صندوق الغداء', cat: 'combos', price: 2.95 },
    { en: 'Chicken Lollipop', ar: 'دجاج لولي بوب', cat: 'starters', price: 2.25 },
    { en: 'Hakka Noodles', ar: 'نودلز هاكا', cat: 'noodles-rice', price: 2.5 },
    { en: 'Orange Chicken', ar: 'دجاج بالبرتقال', cat: 'mains', price: 3.25 },
    { en: 'Mongolian Beef', ar: 'لحم منغولي', cat: 'mains', price: 3.75 },
    { en: 'Hot & Sour Soup', ar: 'شوربة حارة وحامضة', cat: 'starters', price: 1.5 },
    { en: 'Fish Manchurian', ar: 'سمك منشوريان', cat: 'mains', price: 3.5 },
    { en: 'Egg Fried Rice', ar: 'أرز مقلي بالبيض', cat: 'noodles-rice', price: 2.0 },
    { en: 'Chicken Noodles Box', ar: 'بوكس نودلز الدجاج', cat: 'noodles-rice', price: 2.5 },
    { en: 'Prawn Tempura', ar: 'روبيان تمبورا', cat: 'starters', price: 3.25 },
    { en: 'Duo Combo Meal', ar: 'وجبة كومبو مزدوجة', cat: 'combos', price: 6.5 },
  ],
  franks: [
    { en: 'Classic Philly CheeseSteak', ar: 'فيلي تشيز ستيك كلاسيك', cat: 'sandwiches', price: 4.25 },
    { en: 'Chicken Philly Combo', ar: 'كومبو فيلي دجاج', cat: 'combos', price: 4.75 },
    { en: 'Loaded Cheese Fries', ar: 'بطاطس محملة بالجبن', cat: 'sides', price: 1.75 },
  ],
  tahina: [
    { en: 'Chicken Shawarma Arabi', ar: 'شاورما دجاج عربي', cat: 'sandwiches', price: 2.25 },
    { en: 'Loaded Shawarma Fries', ar: 'بطاطس شاورما محملة', cat: 'sides', price: 1.95 },
  ],
  burgerito: [{ en: 'Smash Burgerito Combo', ar: 'كومبو برجريتو سماش', cat: 'combos', price: 3.95 }],
  'chick-dip': [],
  crave: [],
}

/** Top-tier revenue per brand (sums to exactly 80% of group net sales). */
const HERO_REVENUE: Record<BrandId, number> = {
  'china-garden': 133673.728 - 12700,
  franks: 7600,
  tahina: 3200,
  burgerito: 1900,
  'chick-dip': 0,
  crave: 0,
}

const ITEM_COUNTS: Record<BrandId, number> = {
  'china-garden': 168,
  franks: 42,
  tahina: 48,
  burgerito: 40,
  'chick-dip': 36,
  crave: 30,
}

const TAIL_BASES: Record<BrandId, Seed[]> = {
  'china-garden': [
    { en: 'Ginger Chicken', ar: 'دجاج بالزنجبيل', cat: 'mains', price: 3.0 },
    { en: 'Cashew Chicken', ar: 'دجاج بالكاجو', cat: 'mains', price: 3.25 },
    { en: 'Lemon Chicken', ar: 'دجاج بالليمون', cat: 'mains', price: 3.0 },
    { en: 'Pepper Beef', ar: 'لحم بالفلفل', cat: 'mains', price: 3.5 },
    { en: 'Sesame Shrimp', ar: 'روبيان بالسمسم', cat: 'mains', price: 3.75 },
    { en: 'Mixed Vegetables', ar: 'خضار مشكلة', cat: 'mains', price: 2.25 },
    { en: 'Tofu Szechuan', ar: 'توفو سيشوان', cat: 'mains', price: 2.5 },
    { en: 'Singapore Noodles', ar: 'نودلز سنغافورة', cat: 'noodles-rice', price: 2.75 },
    { en: 'Seafood Fried Rice', ar: 'أرز مقلي بالمأكولات البحرية', cat: 'noodles-rice', price: 3.25 },
    { en: 'Beef Chow Fun', ar: 'تشاو فن باللحم', cat: 'noodles-rice', price: 3.0 },
    { en: 'Vegetable Fried Rice', ar: 'أرز مقلي بالخضار', cat: 'noodles-rice', price: 2.0 },
    { en: 'Wonton Soup', ar: 'شوربة ونتون', cat: 'starters', price: 1.75 },
    { en: 'Chicken Dumplings', ar: 'زلابية الدجاج', cat: 'starters', price: 2.0 },
    { en: 'Crispy Calamari', ar: 'كاليماري مقرمش', cat: 'starters', price: 2.75 },
    { en: 'Salt & Pepper Prawns', ar: 'روبيان بالملح والفلفل', cat: 'starters', price: 3.25 },
    { en: 'Fortune Combo', ar: 'كومبو فورتشن', cat: 'combos', price: 4.25 },
    { en: 'Kids Meal', ar: 'وجبة أطفال', cat: 'combos', price: 1.95 },
    { en: 'Steamed Rice', ar: 'أرز أبيض مطهو', cat: 'sides', price: 0.75 },
    { en: 'Prawn Crackers', ar: 'رقائق الروبيان', cat: 'sides', price: 0.75 },
    { en: 'Soft Drink', ar: 'مشروب غازي', cat: 'beverages', price: 0.4 },
    { en: 'Fresh Lemon Mint', ar: 'ليمون بالنعناع', cat: 'beverages', price: 1.0 },
    { en: 'Iced Tea', ar: 'شاي مثلج', cat: 'beverages', price: 0.9 },
    { en: 'Fried Ice Cream', ar: 'آيس كريم مقلي', cat: 'desserts', price: 1.5 },
    { en: 'Mango Pudding', ar: 'بودينغ المانجو', cat: 'desserts', price: 1.25 },
  ],
  franks: [
    { en: 'Mushroom Swiss Philly', ar: 'فيلي بالفطر والجبن السويسري', cat: 'sandwiches', price: 4.5 },
    { en: 'Pepper Jack Philly', ar: 'فيلي بيبر جاك', cat: 'sandwiches', price: 4.5 },
    { en: 'Philly Sliders', ar: 'سلايدرز فيلي', cat: 'sandwiches', price: 3.75 },
    { en: 'Curly Fries', ar: 'بطاطس حلزونية', cat: 'sides', price: 1.25 },
    { en: 'Onion Rings', ar: 'حلقات البصل', cat: 'sides', price: 1.25 },
    { en: 'Milkshake', ar: 'ميلك شيك', cat: 'beverages', price: 1.75 },
    { en: 'Brownie', ar: 'براوني', cat: 'desserts', price: 1.25 },
  ],
  tahina: [
    { en: 'Beef Shawarma Plate', ar: 'صحن شاورما لحم', cat: 'mains', price: 2.95 },
    { en: 'Falafel Wrap', ar: 'لفافة فلافل', cat: 'sandwiches', price: 1.25 },
    { en: 'Hummus Bowl', ar: 'صحن حمص', cat: 'sides', price: 1.25 },
    { en: 'Fattoush', ar: 'فتوش', cat: 'starters', price: 1.25 },
    { en: 'Shawarma Saj', ar: 'شاورما صاج', cat: 'sandwiches', price: 1.95 },
    { en: 'Laban Ayran', ar: 'لبن عيران', cat: 'beverages', price: 0.4 },
    { en: 'Knafeh Cup', ar: 'كوب كنافة', cat: 'desserts', price: 1.25 },
  ],
  burgerito: [
    { en: 'Double Smash Burger', ar: 'برجر سماش مزدوج', cat: 'sandwiches', price: 3.25 },
    { en: 'Chicken Crispy Burger', ar: 'برجر دجاج مقرمش', cat: 'sandwiches', price: 2.75 },
    { en: 'Truffle Burger', ar: 'برجر الترافل', cat: 'sandwiches', price: 3.75 },
    { en: 'Seasoned Fries', ar: 'بطاطس متبلة', cat: 'sides', price: 0.95 },
    { en: 'Cheese Bites', ar: 'قطع الجبن', cat: 'sides', price: 1.25 },
    { en: 'Craft Soda', ar: 'صودا مميزة', cat: 'beverages', price: 0.75 },
    { en: 'Cookie Sandwich', ar: 'ساندويتش الكوكيز', cat: 'desserts', price: 1.0 },
  ],
  'chick-dip': [
    { en: 'Crispy Strips Cone', ar: 'كون أصابع الدجاج المقرمشة', cat: 'mains', price: 2.25 },
    { en: 'Strips Box', ar: 'بوكس أصابع الدجاج', cat: 'combos', price: 3.25 },
    { en: 'Popcorn Chicken', ar: 'دجاج بوب كورن', cat: 'starters', price: 1.75 },
    { en: 'Signature Dip Trio', ar: 'ثلاثية الصوصات المميزة', cat: 'sides', price: 0.95 },
    { en: 'Coleslaw', ar: 'سلطة كول سلو', cat: 'sides', price: 0.6 },
    { en: 'Lemonade', ar: 'ليمونادة', cat: 'beverages', price: 0.85 },
  ],
  crave: [
    { en: 'Artisan Melt', ar: 'ميلت حرفي', cat: 'sandwiches', price: 2.75 },
    { en: 'Sweet Corn Warm Cup', ar: 'كوب الذرة الدافئ', cat: 'sides', price: 0.95 },
    { en: 'Mojito', ar: 'موهيتو', cat: 'beverages', price: 1.25 },
    { en: 'Nacho Cup', ar: 'كوب ناتشوز', cat: 'starters', price: 1.25 },
    { en: 'Churros', ar: 'تشوروز', cat: 'desserts', price: 1.25 },
  ],
}

const VARIANTS: { en: string; ar: string; priceMul: number }[] = [
  { en: '', ar: '', priceMul: 1 },
  { en: 'Large', ar: 'كبير', priceMul: 1.35 },
  { en: 'Spicy', ar: 'حار', priceMul: 1.05 },
  { en: 'Family', ar: 'عائلي', priceMul: 2.4 },
  { en: 'Light', ar: 'خفيف', priceMul: 0.9 },
  { en: 'Deluxe', ar: 'ديلوكس', priceMul: 1.25 },
  { en: 'Mini', ar: 'ميني', priceMul: 0.7 },
  { en: 'Signature', ar: 'المميز', priceMul: 1.15 },
]

const PREP_BY_CAT: Record<CategoryId, number> = {
  mains: 240,
  'noodles-rice': 210,
  starters: 150,
  sandwiches: 180,
  combos: 270,
  sides: 90,
  beverages: 30,
  desserts: 60,
}

function buildMenu(): MenuItem[] {
  const rand = mulberry32(22838)
  const raw: Omit<MenuItem, 'quadrant' | 'purgeCandidate' | 'repriceCandidate' | 'rank'>[] = []

  for (const brand of BRANDS) {
    const heroes = HERO_ITEMS[brand.id]
    const heroRevenue = HERO_REVENUE[brand.id]
    const heroWeights = heroes.map((_, i) => Math.pow(i + 1, -0.55))
    const heroWeightSum = heroWeights.reduce((s, w) => s + w, 0) || 1
    heroes.forEach((seed, i) => {
      const revenue = (heroRevenue * heroWeights[i]) / heroWeightSum
      const cogsPct = 20 + rand() * 10
      raw.push({
        id: `${brand.id}-h${i + 1}`,
        en: seed.en,
        ar: seed.ar,
        brand: brand.id,
        category: seed.cat,
        price: seed.price,
        cogsPct,
        revenue,
        units: revenue / seed.price,
        unitMargin: seed.price * (1 - cogsPct / 100),
        totalMargin: revenue * (1 - cogsPct / 100),
        top32: true,
        prepSec: Math.round(PREP_BY_CAT[seed.cat] * (0.8 + rand() * 0.4)),
      })
    })

    const tailCount = ITEM_COUNTS[brand.id] - heroes.length
    const tailRevenue = brand.sales - heroRevenue
    const bases = TAIL_BASES[brand.id]
    const tailWeights = Array.from({ length: tailCount }, (_, i) => 2 - (1.8 * i) / Math.max(tailCount - 1, 1))
    const tailWeightSum = tailWeights.reduce((s, w) => s + w, 0)
    for (let i = 0; i < tailCount; i++) {
      const base = bases[i % bases.length]
      const variant = VARIANTS[Math.floor(i / bases.length) % VARIANTS.length]
      const price = Math.round(base.price * variant.priceMul * 20) / 20
      const revenue = (tailRevenue * tailWeights[i]) / tailWeightSum
      const cogsPct = 18 + rand() * 16
      raw.push({
        id: `${brand.id}-t${i + 1}`,
        en: variant.en ? `${base.en} (${variant.en})` : base.en,
        ar: variant.ar ? `${base.ar} (${variant.ar})` : base.ar,
        brand: brand.id,
        category: base.cat,
        price,
        cogsPct,
        revenue,
        units: revenue / price,
        unitMargin: price * (1 - cogsPct / 100),
        totalMargin: revenue * (1 - cogsPct / 100),
        top32: false,
        prepSec: Math.round(PREP_BY_CAT[base.cat] * (0.8 + rand() * 0.4)),
      })
    }
  }

  // Kasavana & Smith classification: popularity ≥ 70% of the fair share, profitability ≥ weighted average CM.
  const totalUnits = raw.reduce((s, r) => s + r.units, 0)
  const popularityThreshold = (totalUnits / raw.length) * 0.7
  const avgUnitMargin = raw.reduce((s, r) => s + r.totalMargin, 0) / totalUnits
  const classified = raw
    .sort((a, b) => b.revenue - a.revenue)
    .map((r, idx) => {
      const popular = r.units >= popularityThreshold
      const profitable = r.unitMargin >= avgUnitMargin
      const quadrant: Quadrant = popular ? (profitable ? 'star' : 'plowhorse') : profitable ? 'puzzle' : 'dog'
      return { ...r, rank: idx + 1, quadrant, purgeCandidate: false, repriceCandidate: false }
    })

  classified
    .filter((r) => r.quadrant === 'dog')
    .sort((a, b) => a.totalMargin - b.totalMargin)
    .slice(0, LEDGER.menuDogsPurge)
    .forEach((r) => {
      r.purgeCandidate = true
    })
  classified
    .filter((r) => r.quadrant === 'plowhorse')
    .sort((a, b) => b.units - a.units)
    .slice(0, LEDGER.menuPlowhorsesReprice)
    .forEach((r) => {
      r.repriceCandidate = true
    })
  return classified
}

export const MENU_ITEMS: MenuItem[] = buildMenu()

export const MENU_THRESHOLDS = (() => {
  const totalUnits = MENU_ITEMS.reduce((s, r) => s + r.units, 0)
  return {
    popularity: (totalUnits / MENU_ITEMS.length) * 0.7,
    unitMargin: MENU_ITEMS.reduce((s, r) => s + r.totalMargin, 0) / totalUnits,
  }
})()

export const QUADRANTS: { id: Quadrant; en: string; ar: string; tone: Tone; actionEn: string; actionAr: string }[] = [
  { id: 'star', en: 'Stars', ar: 'النجوم', tone: 'emerald', actionEn: 'Protect placement & consistency', actionAr: 'حماية الظهور وثبات الجودة' },
  { id: 'plowhorse', en: 'Plowhorses', ar: 'الأحصنة العاملة', tone: 'sky', actionEn: 'Re-price +5% or re-engineer cost', actionAr: 'رفع السعر 5% أو خفض التكلفة' },
  { id: 'puzzle', en: 'Puzzles', ar: 'الألغاز', tone: 'amber', actionEn: 'Reposition & promote', actionAr: 'إعادة التموضع والترويج' },
  { id: 'dog', en: 'Dogs', ar: 'الأصناف الضعيفة', tone: 'rose', actionEn: 'Purge or replace', actionAr: 'الاستبعاد أو الاستبدال' },
]

// ---------------------------------------------------------------------------
// 10. Financial anomaly alerts (ranked by KWD impact)
// ---------------------------------------------------------------------------
export type AlertCategory = 'cogs' | 'custody' | 'marketing' | 'upsell' | 'menu' | 'operations'
export type Severity = 'critical' | 'high' | 'medium'

export interface BiAlert {
  id: string
  category: AlertCategory
  severity: Severity
  monthlyImpact: number
  exposure: number
  entries: number | null
  titleEn: string
  titleAr: string
  bodyEn: string
  bodyAr: string
  askEn: string
  askAr: string
  composioAction: string | null
  branches: BranchId[] | 'all'
  channels: ChannelId[] | 'all'
  brands: BrandId[] | 'all'
  href: string
}

export const ALERT_CATEGORIES: { id: AlertCategory; en: string; ar: string; tone: Tone }[] = [
  { id: 'cogs', en: 'COGS & waste', ar: 'تكلفة الأغذية والهدر', tone: 'rose' },
  { id: 'custody', en: 'Custody', ar: 'العهد', tone: 'amber' },
  { id: 'marketing', en: 'Marketing', ar: 'التسويق', tone: 'sky' },
  { id: 'upsell', en: 'Upselling', ar: 'رفع السلة', tone: 'sky' },
  { id: 'menu', en: 'Menu matrix', ar: 'مصفوفة المنيو', tone: 'emerald' },
  { id: 'operations', en: 'Operations', ar: 'العمليات', tone: 'slate' },
]

export const ALERTS: BiAlert[] = [
  {
    id: 'ALR-UPSELL-01',
    category: 'upsell',
    severity: 'high',
    monthlyImpact: 2450,
    exposure: 2450,
    entries: null,
    titleEn: 'Beverage attach gap on delivery combos',
    titleAr: 'فجوة إضافة المشروبات في وجبات التوصيل',
    bodyEn: 'Delivery combos ship without a drink; group AOV is 5.471 KWD against a 5.750 KWD target.',
    bodyAr: 'وجبات التوصيل تُباع دون مشروب؛ متوسط السلة 5.471 د.ك مقابل مستهدف 5.750 د.ك.',
    askEn: 'How do we enforce a mandatory beverage in delivery combos to lift AOV from 5.471 to 5.750 KWD (+2,450 KWD/month)?',
    askAr: 'كيف نفرض المشروب الإلزامي في وجبات التوصيل لرفع متوسط السلة من 5.471 إلى 5.750 د.ك (+2,450 د.ك شهرياً)؟',
    composioAction: 'dispatch_combo_drinks',
    branches: 'all',
    channels: ['talabat-tgo', 'talabat-tmp', 'keeta'],
    brands: 'all',
    href: '/erp/sales-analysis',
  },
  {
    id: 'ALR-MKT-01',
    category: 'marketing',
    severity: 'critical',
    monthlyImpact: 1620,
    exposure: 2544,
    entries: 6267,
    titleEn: 'Keeta promo burn above the 3.5% cap',
    titleAr: 'خصومات كيتا تتجاوز سقف 3.5%',
    bodyEn: '2,544 KWD of promotions across 6,267 Keeta orders; the approved cap is 924 KWD.',
    bodyAr: '2,544 د.ك خصومات عبر 6,267 طلباً في كيتا؛ السقف المعتمد 924 د.ك.',
    askEn: 'Build the plan to cap Keeta promotions at 3.5% (924 KWD) and recover 1,620 KWD per month without losing conversion.',
    askAr: 'ضعي خطة لتحديد خصومات كيتا عند 3.5% (924 د.ك) واسترداد 1,620 د.ك شهرياً دون خسارة الطلبات.',
    composioAction: 'dispatch_keeta_cap',
    branches: 'all',
    channels: ['keeta'],
    brands: 'all',
    href: '/erp/delivery-control',
  },
  {
    id: 'ALR-COGS-01',
    category: 'cogs',
    severity: 'critical',
    monthlyImpact: 1336,
    exposure: 41438.856,
    entries: 418,
    titleEn: 'Ardiya raw poultry & marination variance',
    titleAr: 'انحراف الدواجن الخام والتتبيل في العارضية',
    bodyEn: 'COGS at 24.8% vs 24.0% target across 418 central-kitchen entries.',
    bodyAr: 'تكلفة الأغذية 24.8% مقابل المستهدف 24.0% عبر 418 قيداً للمطبخ المركزي.',
    askEn: 'Analyse the Ardiya Central Kitchen variance (418 entries, COGS 24.8% vs 24.0%) and the plan to recover 1,336 KWD per month.',
    askAr: 'حللي انحراف المطبخ المركزي بالعارضية (418 قيداً، تكلفة 24.8% مقابل 24.0%) وخطة استرداد 1,336 د.ك شهرياً.',
    composioAction: 'dispatch_operations_plan',
    branches: ['ardiya'],
    channels: 'all',
    brands: 'all',
    href: '/erp/sales-analysis',
  },
  {
    id: 'ALR-CUST-01',
    category: 'custody',
    severity: 'high',
    monthlyImpact: 850,
    exposure: 10707.93,
    entries: 312,
    titleEn: 'Open maintenance custody in Al-Kout & Salmiya',
    titleAr: 'عهد صيانة مفتوحة في الكوت والسالمية',
    bodyEn: '10,707.930 KWD across 312 entries from repeated chiller repairs; overhaul recovers 850 KWD/month.',
    bodyAr: '10,707.930 د.ك عبر 312 قيداً بسبب تكرار إصلاح المبردات؛ التجديد يوفر 850 د.ك شهرياً.',
    askEn: 'Review the 10,707.930 KWD maintenance custody (312 entries, Al-Kout & Salmiya) and the chiller overhaul saving 850 KWD per month.',
    askAr: 'راجعي عهدة الصيانة 10,707.930 د.ك (312 قيداً، الكوت والسالمية) وخطة تجديد المبردات لتوفير 850 د.ك شهرياً.',
    composioAction: 'dispatch_chiller_plan',
    branches: ['al-kout', 'salmiya'],
    channels: 'all',
    brands: 'all',
    href: '/erp/feryal-ai',
  },
  {
    id: 'ALR-MENU-01',
    category: 'menu',
    severity: 'medium',
    monthlyImpact: 584,
    exposure: 584,
    entries: 364,
    titleEn: '18 Dog items and 4 under-priced Plowhorses',
    titleAr: '18 صنفاً ضعيفاً و4 أصناف شعبية بسعر منخفض',
    bodyEn: '364 active items; the top 32 make 80% of revenue. Purge 18 Dogs and re-price 4 Plowhorses by +5%.',
    bodyAr: '364 صنفاً نشطاً؛ أعلى 32 صنفاً تحقق 80% من الإيراد. استبعاد 18 صنفاً ورفع 4 أصناف بنسبة 5%.',
    askEn: 'Which 18 Dog items should we purge and which 4 Plowhorses should get +5% pricing (+584 KWD/month)?',
    askAr: 'ما الأصناف الـ 18 التي نستبعدها والأصناف الأربعة التي نرفع سعرها 5% (+584 د.ك شهرياً)؟',
    composioAction: 'dispatch_combo_drinks',
    branches: 'all',
    channels: 'all',
    brands: 'all',
    href: '/erp/sales-analysis',
  },
  {
    id: 'ALR-OPS-01',
    category: 'operations',
    severity: 'medium',
    monthlyImpact: 0,
    exposure: 51154.95,
    entries: 2213,
    titleEn: 'Petty-cash journal reconciliation queue',
    titleAr: 'قائمة مطابقة قيود العهد النثرية',
    bodyEn: '51,154.950 KWD operating expenses and custodies reconciled across 2,213 daily journal entries.',
    bodyAr: '51,154.950 د.ك مصروفات تشغيلية وعهد مطابقة عبر 2,213 قيداً يومياً.',
    askEn: 'Summarise the 2,213 operating-expense and custody journal entries (51,154.950 KWD) and the controls we should add.',
    askAr: 'لخصي قيود المصروفات والعهد البالغة 2,213 قيداً (51,154.950 د.ك) والضوابط المطلوب إضافتها.',
    composioAction: 'dispatch_operations_plan',
    branches: 'all',
    channels: 'all',
    brands: 'all',
    href: '/erp/feryal-ai',
  },
  {
    id: 'ALR-OPS-02',
    category: 'operations',
    severity: 'medium',
    monthlyImpact: 0,
    exposure: 0,
    entries: null,
    titleEn: 'Hawally chiller repairs required',
    titleAr: 'حولي تحتاج صيانة مبردات',
    bodyEn: 'Branch status flagged in the 9-branch audit; schedule inside the chiller overhaul programme.',
    bodyAr: 'حالة الفرع مرصودة في تدقيق الفروع التسعة؛ تُجدول ضمن برنامج تجديد المبردات.',
    askEn: 'What is the operational risk of the Hawally chiller repairs and how should we schedule them?',
    askAr: 'ما المخاطر التشغيلية لصيانة مبردات حولي وكيف نجدولها؟',
    composioAction: 'dispatch_chiller_plan',
    branches: ['hawally'],
    channels: 'all',
    brands: 'all',
    href: '/erp/feryal-ai',
  },
  {
    id: 'ALR-OPS-03',
    category: 'operations',
    severity: 'medium',
    monthlyImpact: 0,
    exposure: 0,
    entries: null,
    titleEn: 'Aggregator tablet availability at 99.1%',
    titleAr: 'جاهزية أجهزة منصات التوصيل 99.1%',
    bodyEn: 'Online availability across Talabat Tgo/TMP, Keeta and Deliveroo is 99.1%; Keeta is the lowest at 98.8%.',
    bodyAr: 'الجاهزية عبر طلبات جو وسوق طلبات وكيتا وديليفرو 99.1%؛ كيتا الأدنى عند 98.8%.',
    askEn: 'Which branches and platforms are pulling online availability down from 100% to 99.1%?',
    askAr: 'ما الفروع والمنصات التي تخفض الجاهزية من 100% إلى 99.1%؟',
    composioAction: null,
    branches: 'all',
    channels: ['talabat-tgo', 'talabat-tmp', 'keeta', 'deliveroo'],
    brands: 'all',
    href: '/erp/delivery-control',
  },
]

export function alertMatchesFilters(a: BiAlert, f: BiFilters) {
  const okBranch = f.branch === 'all' || a.branches === 'all' || a.branches.includes(f.branch)
  const okChannel = f.channel === 'all' || a.channels === 'all' || a.channels.includes(f.channel)
  const okBrand = f.brand === 'all' || a.brands === 'all' || a.brands.includes(f.brand)
  return okBranch && okChannel && okBrand
}

// ---------------------------------------------------------------------------
// 11. Formatting helpers
// ---------------------------------------------------------------------------
export const fmt = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const kwd = (n: number, lang: Lang, digits = 3) => (lang === 'ar' ? `${fmt(n, digits)} د.ك` : `${fmt(n, digits)} KWD`)

export const pct = (n: number, digits = 1) => `${fmt(n, digits)}%`

export const T = (lang: Lang) => (en: string, ar: string) => (lang === 'ar' ? ar : en)

export function toCsv(rows: (string | number)[][]) {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell)
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(','),
    )
    .join('\n')
}

export function feryalHref(query: string) {
  return `/erp/feryal-ai?q=${encodeURIComponent(query)}`
}
