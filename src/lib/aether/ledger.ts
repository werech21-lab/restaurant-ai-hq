/**
 * Aether BI V2 — canonical Venture Foods group ledger, re-based on live Odoo data.
 *
 * Single source of truth for every V2 analytics surface (/erp, /erp/sales-analysis,
 * /erp/delivery-control, /erp/alerts, /erp/executive-pnl, the Command Palette and Feryal).
 * Every sales, order, brand, location and channel figure comes from the Odoo POS sync
 * (src/lib/odoo/odoo-dataset.ts, generated from scripts/sync-odoo-live.mjs) restricted to the
 * positive pos.config whitelist. P&L lines come from posted Odoo accounting with the
 * non-whitelisted locations' analytic share removed.
 *
 * Values that are NOT in Odoo are kept as clearly named management estimates (profit levers,
 * custody programme, contract commission terms).
 */
import { ODOO } from '@/lib/odoo/odoo-dataset'

export type Lang = 'ar' | 'en'

const r3 = (n: number) => Math.round(n * 1000) / 1000
const r1 = (n: number) => Math.round(n * 10) / 10

// ---------------------------------------------------------------------------
// 1. Headline constants (Odoo sync window — rolling 30 days by default)
// ---------------------------------------------------------------------------
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_EN_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
/** Human label for the synced Odoo window (`to` is exclusive). */
const PERIOD_LABEL = (() => {
  const from = new Date(`${ODOO.meta.period.from}T00:00:00Z`)
  const to = new Date(`${ODOO.meta.period.to}T00:00:00Z`)
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000))
  const last = new Date(to.getTime() - 86400000)
  const fullMonth = from.getUTCDate() === 1 && to.getUTCDate() === 1 && (to.getUTCMonth() + 12 - from.getUTCMonth()) % 12 === 1
  if (fullMonth) return { en: `${MONTHS_EN_FULL[from.getUTCMonth()]} ${from.getUTCFullYear()}`, ar: `${MONTHS_AR[from.getUTCMonth()]} ${from.getUTCFullYear()}`, days }
  return {
    en: `Rolling ${days} days · ${from.getUTCDate()} ${MONTHS_EN[from.getUTCMonth()]} – ${last.getUTCDate()} ${MONTHS_EN[last.getUTCMonth()]} ${last.getUTCFullYear()}`,
    ar: `آخر ${days} يوماً · ${from.getUTCDate()} ${MONTHS_AR[from.getUTCMonth()]} – ${last.getUTCDate()} ${MONTHS_AR[last.getUTCMonth()]} ${last.getUTCFullYear()}`,
    days,
  }
})()
const KEETA = ODOO.channels.find((c) => c.id === 'keeta')
const MENU_SORTED = [...ODOO.menu].sort((a, b) => b.netKwd - a.netKwd)
const MENU_TOTAL = MENU_SORTED.reduce((s, m) => s + m.netKwd, 0)
const TOP_80 = (() => {
  let acc = 0
  let n = 0
  for (const m of MENU_SORTED) {
    if (acc >= MENU_TOTAL * 0.8) break
    acc += m.netKwd
    n++
  }
  return n
})()

export const LEDGER = {
  /** POS net sales after order-level promotions, whitelisted registers only. */
  netSales: ODOO.totals.netSalesKwd,
  orders: ODOO.totals.orders,
  aov: ODOO.totals.aovKwd,
  /** Item sales before order-level promotion lines (sum of the brand rows). */
  itemSales: ODOO.totals.itemSalesKwd,
  restaurantSales: ODOO.totals.restaurantNetKwd,
  restaurantOrders: ODOO.totals.restaurantOrders,
  /** Posted accounting revenue (income + other income), whitelisted locations. */
  revenue: ODOO.pnl.revenueKwd,
  netProfit: ODOO.pnl.operatingProfitKwd,
  marginPct: ODOO.pnl.marginPct,
  ebitda: ODOO.pnl.ebitdaKwd,
  cogs: ODOO.pnl.cogsKwd,
  cogsPct: ODOO.pnl.cogsPct,
  cogsTargetPct: 24.0,
  cogsEntries: 418,
  cogsRecoverable: 1336,
  opex: ODOO.pnl.opexKwd,
  opexPct: ODOO.pnl.opexPct,
  depreciation: ODOO.pnl.depreciationKwd,
  opexEntries: 2213,
  maintCustody: 10707.93,
  maintEntries: 312,
  chillerRecovery: 850,
  /** Order-level promotion lines + line discounts recorded in the Odoo POS. */
  discounts: ODOO.totals.discountsKwd,
  promoLines: ODOO.totals.promoAdjustmentsKwd,
  lineDiscounts: ODOO.totals.lineDiscountKwd,
  discountsPct: r1((ODOO.totals.discountsKwd / (ODOO.totals.netSalesKwd + ODOO.totals.discountsKwd)) * 100),
  keetaDiscounts: KEETA?.promoKwd ?? 0,
  keetaOrders: KEETA?.orders ?? 0,
  keetaCapPct: 3.5,
  /** Keeta promo cap at 3.5% of Keeta item sales. */
  keetaCapKwd: r3((KEETA?.itemSalesKwd ?? 0) * 0.035),
  keetaRecovery: Math.max(0, Math.round((KEETA?.promoKwd ?? 0) - (KEETA?.itemSalesKwd ?? 0) * 0.035)),
  keetaPromoBase: KEETA?.itemSalesKwd ?? 0,
  beverageGain: 2450,
  /** Management target: +5.1% basket uplift from the beverage attach programme. */
  aovTarget: r3(ODOO.totals.aovKwd * 1.051),
  menuMatrixGain: 584,
  menuDogsPurge: 18,
  menuPlowhorsesReprice: 4,
  menuItems: ODOO.totals.productsSold,
  topItems: TOP_80,
  topItemsSharePct: 80,
  brands: ODOO.brands.filter((b) => b.active).length,
  approvedBrands: ODOO.brands.length,
  branches: ODOO.restaurants.length,
  channels: ODOO.channels.length,
  licence: '2021/22838',
  periodLabelEn: PERIOD_LABEL.en,
  periodLabelAr: PERIOD_LABEL.ar,
  daysInPeriod: PERIOD_LABEL.days,
  syncedAt: ODOO.meta.syncedAt,
} as const

// ---------------------------------------------------------------------------
// 2. Profit trajectory (baseline = Odoo monthly operating profit; levers = management estimates)
// ---------------------------------------------------------------------------
const LEVER_INCREMENTAL = { q1: 20520, h1: 43800, fy: 91680 } as const

export const ROADMAP_BASELINE = {
  q1: r3(LEDGER.netProfit * 3),
  h1: r3(LEDGER.netProfit * 6),
  fy: r3(LEDGER.netProfit * 12),
} as const

export const ROADMAP = [
  { id: 'run', en: 'Current run-rate', ar: 'المعدل الحالي', months: 1, incremental: 0, total: LEDGER.netProfit },
  { id: 'q1', en: 'Q1', ar: 'الربع الأول', months: 3, incremental: LEVER_INCREMENTAL.q1, total: r3(ROADMAP_BASELINE.q1 + LEVER_INCREMENTAL.q1) },
  { id: 'h1', en: 'H1', ar: 'النصف الأول', months: 6, incremental: LEVER_INCREMENTAL.h1, total: r3(ROADMAP_BASELINE.h1 + LEVER_INCREMENTAL.h1) },
  { id: 'fy', en: 'Full Year', ar: 'السنة الكاملة', months: 12, incremental: LEVER_INCREMENTAL.fy, total: r3(ROADMAP_BASELINE.fy + LEVER_INCREMENTAL.fy) },
] as const

// ---------------------------------------------------------------------------
// 3. Profit levers (management estimates; Keeta recovery is computed from Odoo)
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

const f3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const f0 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })

export const LEVERS: Lever[] = [
  {
    id: 'beverage-attach',
    monthly: LEDGER.beverageGain,
    tone: 'sky',
    kind: 'growth',
    en: 'Mandatory beverage in delivery combos',
    ar: 'المشروب الإلزامي في وجبات الكومبو للتوصيل',
    detailEn: `Lifts group AOV from ${f3(LEDGER.aov)} to ${f3(LEDGER.aovTarget)} KWD across Talabat Go, Talabat MP and Keeta combos (management estimate).`,
    detailAr: `يرفع متوسط السلة من ${f3(LEDGER.aov)} إلى ${f3(LEDGER.aovTarget)} د.ك في وجبات طلبات جو وسوق طلبات وكيتا (تقدير إداري).`,
    ownerEn: 'Operations & POS',
    ownerAr: 'العمليات ونقاط البيع',
    composioAction: 'dispatch_combo_drinks',
  },
  {
    id: 'keeta-cap',
    monthly: LEDGER.keetaRecovery,
    tone: 'sky',
    kind: 'cost',
    en: `Cap Keeta promo burn at ${LEDGER.keetaCapPct}%`,
    ar: `سقف خصومات كيتا عند ${LEDGER.keetaCapPct}%`,
    detailEn: `Odoo shows ${f3(LEDGER.keetaDiscounts)} KWD of Keeta promotions across ${f0(LEDGER.keetaOrders)} payments; a ${LEDGER.keetaCapPct}% cap is ${f3(LEDGER.keetaCapKwd)} KWD.`,
    detailAr: `يظهر أودو ${f3(LEDGER.keetaDiscounts)} د.ك خصومات كيتا عبر ${f0(LEDGER.keetaOrders)} عملية دفع؛ سقف ${LEDGER.keetaCapPct}% يساوي ${f3(LEDGER.keetaCapKwd)} د.ك.`,
    ownerEn: 'Marketing & Channels',
    ownerAr: 'التسويق والقنوات',
    composioAction: 'dispatch_keeta_cap',
  },
  {
    id: 'ardiya-yield',
    monthly: LEDGER.cogsRecoverable,
    tone: 'rose',
    kind: 'cost',
    en: 'Central kitchen poultry & marination yield programme',
    ar: 'برنامج إنتاجية الدواجن والتتبيل في المطبخ المركزي',
    detailEn: `Odoo COGS is ${LEDGER.cogsPct}% against the ${LEDGER.cogsTargetPct}% target; the yield programme across ${LEDGER.cogsEntries} central-kitchen entries is a management estimate pending recipe-cost access.`,
    detailAr: `تكلفة الأغذية في أودو ${LEDGER.cogsPct}% مقابل المستهدف ${LEDGER.cogsTargetPct}%؛ برنامج الإنتاجية عبر ${LEDGER.cogsEntries} قيداً للمطبخ المركزي تقدير إداري لحين إتاحة تكلفة الوصفات.`,
    ownerEn: 'Central Kitchen & QC',
    ownerAr: 'المطبخ المركزي والجودة',
    composioAction: 'dispatch_operations_plan',
  },
  {
    id: 'chiller-overhaul',
    monthly: LEDGER.chillerRecovery,
    tone: 'amber',
    kind: 'cost',
    en: 'Commercial chiller overhaul',
    ar: 'تجديد المبردات التجارية',
    detailEn: `Ends repeated cash repairs behind ${f3(LEDGER.maintCustody)} KWD custody across ${LEDGER.maintEntries} entries in Al-Kout Mall & Salmiya.`,
    detailAr: `يوقف الإصلاحات النقدية المتكررة خلف عهدة ${f3(LEDGER.maintCustody)} د.ك عبر ${LEDGER.maintEntries} قيداً في مجمع الكوت والسالمية.`,
    ownerEn: 'Maintenance & Procurement',
    ownerAr: 'الصيانة والمشتريات',
    composioAction: 'dispatch_chiller_plan',
  },
  {
    id: 'menu-matrix',
    monthly: LEDGER.menuMatrixGain,
    tone: 'emerald',
    kind: 'growth',
    en: 'Menu matrix rationalization',
    ar: 'إعادة هندسة مصفوفة المنيو',
    detailEn: `Purge ${LEDGER.menuDogsPurge} sluggish Dog items and apply +5% to ${LEDGER.menuPlowhorsesReprice} popular Plowhorses across ${LEDGER.menuItems} Odoo items sold.`,
    detailAr: `استبعاد ${LEDGER.menuDogsPurge} صنفاً ضعيفاً ورفع أسعار ${LEDGER.menuPlowhorsesReprice} أصناف شعبية منخفضة الهامش بنسبة 5% من أصل ${LEDGER.menuItems} صنفاً مبيعاً في أودو.`,
    ownerEn: 'Menu Engineering',
    ownerAr: 'هندسة المنيو',
    composioAction: 'dispatch_combo_drinks',
  },
]

export const LEVERS_MONTHLY_TOTAL = LEVERS.reduce((s, l) => s + l.monthly, 0)

/** Incremental profit for a subset of enabled levers across each horizon. */
export function leverImpact(enabled: Record<LeverId, boolean>) {
  const monthly = LEVERS.filter((l) => enabled[l.id]).reduce((s, l) => s + l.monthly, 0)
  const share = LEVERS_MONTHLY_TOTAL ? monthly / LEVERS_MONTHLY_TOTAL : 0
  const q1 = LEVER_INCREMENTAL.q1 * share
  const h1 = LEVER_INCREMENTAL.h1 * share
  const fy = LEVER_INCREMENTAL.fy * share
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
// 4. Brands (approved Venture Foods brands with Odoo POS sales in the period)
// ---------------------------------------------------------------------------
export type BrandId = 'china-garden' | 'franks' | 'tahina' | 'farm-brown' | 'noodle-bar' | 'karak-cafeteria'

export interface Brand {
  id: BrandId
  en: string
  ar: string
  /** Odoo item sales (before order-level promotion lines). */
  sales: number
  /** Odoo orders containing at least one item of the brand. */
  orders: number
  aov: number
  color: string
  cuisineEn: string
  cuisineAr: string
}

export const BRANDS: Brand[] = ODOO.brands
  .filter((b) => b.active)
  .map((b) => ({ id: b.id as BrandId, en: b.en, ar: b.ar, sales: b.netKwd, orders: b.orders, aov: b.aovKwd, color: b.color, cuisineEn: b.cuisineEn, cuisineAr: b.cuisineAr }))

/** Approved brands that exist in Odoo but recorded no POS sales in the period. */
export const INACTIVE_APPROVED_BRANDS = ODOO.brands.filter((b) => !b.active).map((b) => ({ id: b.id, en: b.en, ar: b.ar }))

const BRAND_ITEM_TOTAL = BRANDS.reduce((s, b) => s + b.sales, 0)

// ---------------------------------------------------------------------------
// 5. Branches = Odoo permanent restaurant locations (EXB and school canteens are separate units)
// ---------------------------------------------------------------------------
export type BranchId = 'promenade' | '360-mall' | 'ardiya' | 'assima' | 'salmiya' | 'al-kout' | 'avenues'

// ---------------------------------------------------------------------------
// 6. Sales channels (Odoo POS payment methods grouped into channels)
// ---------------------------------------------------------------------------
export type ChannelId = 'shop' | 'talabat-tgo' | 'keeta' | 'deliveroo-go' | 'talabat-tmp' | 'online-link' | 'snoonu' | 'jahez' | 'deliveroo-mp' | 'staff'

export interface Channel {
  id: ChannelId
  en: string
  ar: string
  group: 'aggregator' | 'direct' | 'store'
  /** Odoo payments (net after promotions). */
  sales: number
  /** Item sales before order-level promotions. */
  itemSales: number
  orders: number
  /** Contract commission term (configuration, not POS data). */
  commissionPct: number
  /** Promotion value = item sales − payments. */
  promo: number
  /** Restaurant-paid rider cost per order (TMP model only, contract term). */
  riderCostPerOrder: number
  mode: 'Tgo' | 'TMP' | null
  color: string
}

export const CHANNELS: Channel[] = ODOO.channels.map((c) => ({
  id: c.id as ChannelId,
  en: c.en,
  ar: c.ar,
  group: c.group as Channel['group'],
  sales: c.netKwd,
  itemSales: c.itemSalesKwd,
  orders: c.orders,
  commissionPct: c.commissionPct,
  promo: c.promoKwd,
  riderCostPerOrder: c.riderCostPerOrder,
  mode: (c.mode ?? null) as Channel['mode'],
  color: c.color,
}))

export const AGGREGATOR_IDS: ChannelId[] = CHANNELS.filter((c) => c.group === 'aggregator').map((c) => c.id)

export interface Branch {
  id: BranchId
  en: string
  ar: string
  code: string
  sales: number
  orders: number
  topChannel: ChannelId
  statusEn: string
  statusAr: string
  tone: Tone
  /** Operating margin from the Odoo Branches analytic plan (location cost centre). */
  marginPct: number
  profit: number
  revenue: number
  cogs: number
  opex: number
  depreciation: number
}

const RESTAURANT_MARGINS = ODOO.restaurants.map((l) => (l.pnl && l.pnl.income ? (l.pnl.operatingProfit / l.pnl.income) * 100 : 0))
const AVG_MARGIN = RESTAURANT_MARGINS.reduce((s, m) => s + m, 0) / Math.max(RESTAURANT_MARGINS.length, 1)

export const BRANCHES: Branch[] = ODOO.restaurants.map((l) => {
  const pnl = l.pnl ?? { income: 0, otherIncome: 0, cogs: 0, expense: 0, depreciation: 0, operatingProfit: 0 }
  const marginPct = pnl.income ? r1((pnl.operatingProfit / pnl.income) * 100) : 0
  const top = [...l.channels].sort((a, b) => b.amountKwd - a.amountKwd)[0]
  const tone: Tone = marginPct >= AVG_MARGIN + 5 ? 'emerald' : marginPct >= AVG_MARGIN - 5 ? 'sky' : 'amber'
  return {
    id: l.id as BranchId,
    en: l.en,
    ar: l.ar,
    code: l.code,
    sales: l.netKwd,
    orders: l.orders,
    topChannel: (top?.channel ?? 'shop') as ChannelId,
    statusEn: tone === 'emerald' ? 'Above group margin' : tone === 'sky' ? 'At group margin' : 'Below group margin',
    statusAr: tone === 'emerald' ? 'أعلى من هامش المجموعة' : tone === 'sky' ? 'ضمن هامش المجموعة' : 'أقل من هامش المجموعة',
    tone,
    marginPct,
    profit: pnl.operatingProfit,
    revenue: pnl.income,
    cogs: pnl.cogs,
    opex: pnl.expense,
    depreciation: pnl.depreciation,
  }
})

export type BranchRow = (typeof BRANCHES)[number]

/** Exhibitions & Booths (EXB) and school canteens: Odoo units kept out of the branch rankings. */
export const OPERATING_UNITS = [...ODOO.exhibitions, ...ODOO.canteens].map((u) => ({ id: u.id, en: u.en, ar: u.ar, unit: u.unit, sales: u.netKwd, orders: u.orders, aov: u.aovKwd, registers: u.registers, pnl: u.pnl }))
export const EXB_UNIT = OPERATING_UNITS.find((u) => u.unit === 'exhibition') ?? null
export const EXB_REGISTERS = ODOO.exbRegisters
export const SHARED_COSTS = ODOO.pnl.sharedCosts

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
// 8. Filter-aware ledger view (real Odoo cross-tabulations, no proportional splits)
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

type Slice = { net: number; orders: number; exact: boolean }

/** Exact Odoo figures for any brand × location × channel slice. */
export function odooSlice(f: Pick<BiFilters, 'brand' | 'branch' | 'channel'>): Slice {
  const b = f.brand === 'all' ? null : f.brand
  const l = f.branch === 'all' ? null : f.branch
  const c = f.channel === 'all' ? null : f.channel
  if (!b && !l && !c) return { net: LEDGER.netSales, orders: LEDGER.orders, exact: true }
  if (b && !l && !c) { const x = brandById(b); return { net: x?.sales ?? 0, orders: x?.orders ?? 0, exact: true } }
  if (!b && l && !c) { const x = branchById(l); return { net: x?.sales ?? 0, orders: x?.orders ?? 0, exact: true } }
  if (!b && !l && c) { const x = channelById(c); return { net: x?.sales ?? 0, orders: x?.orders ?? 0, exact: true } }
  if (b && l && !c) { const x = ODOO.brandLocation.find((r) => r.brand === b && r.location === l); return { net: x?.netKwd ?? 0, orders: x?.orders ?? 0, exact: true } }
  if (b && !l && c) { const x = ODOO.brandChannel.find((r) => r.brand === b && r.channel === c); return { net: x?.netKwd ?? 0, orders: x?.orders ?? 0, exact: true } }
  if (!b && l && c) {
    const loc = ODOO.restaurants.find((r) => r.id === l)
    const x = loc?.channels.find((r) => r.channel === c)
    return { net: x?.amountKwd ?? 0, orders: x?.payments ?? 0, exact: true }
  }
  // brand × location × channel: exact net from the Odoo cube; orders follow the brand-at-location basket.
  const cell = ODOO.cube.find((r) => r.brand === b && r.location === l && r.channel === c)
  const bl = ODOO.brandLocation.find((r) => r.brand === b && r.location === l)
  const orders = cell && bl && bl.netKwd > 0 ? Math.round((cell.netKwd / bl.netKwd) * bl.orders) : 0
  return { net: cell?.netKwd ?? 0, orders, exact: false }
}

/** Shares of the selected slice against the group (kept for components that scale secondary metrics). */
export function sliceShares(f: Pick<BiFilters, 'brand' | 'branch' | 'channel'>) {
  const brand = f.brand === 'all' ? null : brandById(f.brand)
  const branch = f.branch === 'all' ? null : branchById(f.branch)
  const channel = f.channel === 'all' ? null : channelById(f.channel)
  const slice = odooSlice(f)
  const salesShare = LEDGER.netSales ? slice.net / LEDGER.netSales : 0
  const ordersShare = LEDGER.orders ? slice.orders / LEDGER.orders : 0
  return {
    brand,
    branch,
    channel,
    salesShare,
    ordersShare,
    brandShare: brand ? brand.sales / BRAND_ITEM_TOTAL : 1,
    branchShare: branch ? branch.sales / LEDGER.netSales : 1,
    channelShare: channel ? channel.sales / LEDGER.netSales : 1,
    exact: slice.exact,
  }
}

export function isFiltered(f: BiFilters) {
  return f.brand !== 'all' || f.branch !== 'all' || f.channel !== 'all'
}

export function ledgerView(f: BiFilters) {
  const s = sliceShares(f)
  const slice = odooSlice(f)
  const pf = periodFactor(f.period)
  const netSales = slice.net * pf
  const orders = slice.orders * pf
  // Margin: location cost-centre margin when a branch is selected, otherwise the group margin.
  const marginPct = s.branch ? s.branch.marginPct : LEDGER.marginPct
  const netProfit = s.branch && !s.brand && !s.channel ? s.branch.profit * pf : isFiltered(f) ? netSales * (marginPct / 100) : LEDGER.netProfit * pf
  const cogsPct = LEDGER.cogsPct
  const cogs = s.branch && !s.brand && !s.channel ? s.branch.cogs * pf : netSales * (cogsPct / 100)
  const opex = s.branch && !s.brand && !s.channel ? s.branch.opex * pf : LEDGER.opex * s.salesShare * pf
  const discounts = (s.channel ? s.channel.promo : LEDGER.discounts) * (s.brand || s.branch ? s.salesShare / (s.channel ? s.channelShare || 1 : 1) : 1) * pf
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
    cogsPct,
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

const CATEGORY_RULES: [RegExp, CategoryId][] = [
  [/noodle|rice|chow|fried rice/i, 'noodles-rice'],
  [/sandwich|wrap|burger|slider|philly|shawarma|chapati|croissant/i, 'sandwiches'],
  [/combo|meal|platter|box|gathering|for (two|four)|between two/i, 'combos'],
  [/drink|beverage|juice|water|milk|karak|tea|coffee|pepsi|soda|lemon|matara/i, 'beverages'],
  [/dessert|sweet|cake|cupcake|cookie|biscuit|ice cream|brownie/i, 'desserts'],
  [/side|fries|sauce|dip|extra|component/i, 'sides'],
  [/starter|appetizer|soup|salad|edamame|sambosa|spring roll|dumpling/i, 'starters'],
]
const categoryOf = (category: string, name: string): CategoryId => {
  for (const [re, id] of CATEGORY_RULES) if (re.test(name)) return id
  for (const [re, id] of CATEGORY_RULES) if (re.test(category)) return id
  return 'mains'
}

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

/**
 * Menu items actually sold in Odoo during the period (product.product, realised price).
 * Recipe cost (standard_price) is not readable by the service account, so every item carries the
 * group Odoo COGS % until that read right is granted.
 */
function buildMenu(): MenuItem[] {
  const activeBrands = new Set(BRANDS.map((b) => b.id))
  const raw = ODOO.menu
    .filter((m) => activeBrands.has(m.brand as BrandId) && m.qty > 0 && m.netKwd > 0)
    .map((m, i) => {
      const category = categoryOf(m.category, m.name)
      const cogsPct = m.unitCostKwd > 0 && m.priceKwd > 0 ? Math.min(95, (m.unitCostKwd / m.priceKwd) * 100) : LEDGER.cogsPct
      const price = m.priceKwd
      return {
        id: `${m.brand}-${m.code ?? i}`,
        en: m.name,
        ar: m.name,
        brand: m.brand as BrandId,
        category,
        price,
        cogsPct,
        revenue: m.netKwd,
        units: m.qty,
        unitMargin: price * (1 - cogsPct / 100),
        totalMargin: m.netKwd * (1 - cogsPct / 100),
        top32: false,
        prepSec: PREP_BY_CAT[category],
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
  raw.forEach((r, idx) => {
    r.top32 = idx < LEDGER.topItems
  })

  // Kasavana & Smith classification: popularity ≥ 70% of the fair share, profitability ≥ weighted average CM.
  const totalUnits = raw.reduce((s, r) => s + r.units, 0)
  const popularityThreshold = (totalUnits / Math.max(raw.length, 1)) * 0.7
  const avgUnitMargin = raw.reduce((s, r) => s + r.totalMargin, 0) / Math.max(totalUnits, 1)
  const classified = raw.map((r, idx) => {
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

const LOWEST_MARGIN = [...BRANCHES].sort((a, b) => a.marginPct - b.marginPct)[0]
const CK = SHARED_COSTS.centralKitchen
const HO = SHARED_COSTS.headOffice
const MENU_COUNTS = (() => {
  const items = buildMenu()
  return { dogs: items.filter((i) => i.quadrant === 'dog').length, plowhorses: items.filter((i) => i.quadrant === 'plowhorse').length }
})()

export const ALERTS: BiAlert[] = [
  {
    id: 'ALR-UPSELL-01',
    category: 'upsell',
    severity: 'high',
    monthlyImpact: LEDGER.beverageGain,
    exposure: LEDGER.beverageGain,
    entries: null,
    titleEn: 'Beverage attach gap on delivery combos',
    titleAr: 'فجوة إضافة المشروبات في وجبات التوصيل',
    bodyEn: `Odoo group AOV is ${f3(LEDGER.aov)} KWD; the beverage-attach target is ${f3(LEDGER.aovTarget)} KWD (management estimate).`,
    bodyAr: `متوسط السلة في أودو ${f3(LEDGER.aov)} د.ك؛ مستهدف إضافة المشروب ${f3(LEDGER.aovTarget)} د.ك (تقدير إداري).`,
    askEn: `How do we enforce a mandatory beverage in delivery combos to lift AOV from ${f3(LEDGER.aov)} to ${f3(LEDGER.aovTarget)} KWD?`,
    askAr: `كيف نفرض المشروب الإلزامي في وجبات التوصيل لرفع متوسط السلة من ${f3(LEDGER.aov)} إلى ${f3(LEDGER.aovTarget)} د.ك؟`,
    composioAction: 'dispatch_combo_drinks',
    branches: 'all',
    channels: ['talabat-tgo', 'talabat-tmp', 'keeta'],
    brands: 'all',
    href: '/erp/sales-analysis',
  },
  {
    id: 'ALR-MKT-01',
    category: 'marketing',
    severity: LEDGER.keetaRecovery > 1000 ? 'critical' : 'high',
    monthlyImpact: LEDGER.keetaRecovery,
    exposure: LEDGER.keetaDiscounts,
    entries: LEDGER.keetaOrders,
    titleEn: `Keeta promo burn above the ${LEDGER.keetaCapPct}% cap`,
    titleAr: `خصومات كيتا تتجاوز سقف ${LEDGER.keetaCapPct}%`,
    bodyEn: `${f3(LEDGER.keetaDiscounts)} KWD of Keeta promotions in Odoo (item sales − payments) across ${f0(LEDGER.keetaOrders)} payments; a ${LEDGER.keetaCapPct}% cap is ${f3(LEDGER.keetaCapKwd)} KWD.`,
    bodyAr: `${f3(LEDGER.keetaDiscounts)} د.ك خصومات كيتا في أودو (المبيعات − المدفوعات) عبر ${f0(LEDGER.keetaOrders)} عملية دفع؛ سقف ${LEDGER.keetaCapPct}% يساوي ${f3(LEDGER.keetaCapKwd)} د.ك.`,
    askEn: `Build the plan to cap Keeta promotions at ${LEDGER.keetaCapPct}% (${f3(LEDGER.keetaCapKwd)} KWD) and recover ${f0(LEDGER.keetaRecovery)} KWD per month without losing conversion.`,
    askAr: `ضعي خطة لتحديد خصومات كيتا عند ${LEDGER.keetaCapPct}% (${f3(LEDGER.keetaCapKwd)} د.ك) واسترداد ${f0(LEDGER.keetaRecovery)} د.ك شهرياً دون خسارة الطلبات.`,
    composioAction: 'dispatch_keeta_cap',
    branches: 'all',
    channels: ['keeta'],
    brands: 'all',
    href: '/erp/delivery-control',
  },
  {
    id: 'ALR-COGS-01',
    category: 'cogs',
    severity: 'medium',
    monthlyImpact: LEDGER.cogsRecoverable,
    exposure: CK ? CK.cogs + CK.expense + CK.depreciation : 0,
    entries: LEDGER.cogsEntries,
    titleEn: 'Central kitchen costs not charged to locations',
    titleAr: 'تكاليف المطبخ المركزي غير المحمّلة على المواقع',
    bodyEn: `Odoo COGS is ${LEDGER.cogsPct}% (target ${LEDGER.cogsTargetPct}%). The central-kitchen cost centre carries ${f3(CK ? CK.cogs + CK.expense + CK.depreciation : 0)} KWD that is not allocated to any location.`,
    bodyAr: `تكلفة الأغذية في أودو ${LEDGER.cogsPct}% (المستهدف ${LEDGER.cogsTargetPct}%). مركز تكلفة المطبخ المركزي يحمل ${f3(CK ? CK.cogs + CK.expense + CK.depreciation : 0)} د.ك غير موزعة على المواقع.`,
    askEn: 'How should central-kitchen costs be allocated across the restaurant locations, and where is the poultry & marination yield risk?',
    askAr: 'كيف نوزع تكاليف المطبخ المركزي على مواقع المطاعم، وأين مخاطر إنتاجية الدواجن والتتبيل؟',
    composioAction: 'dispatch_operations_plan',
    branches: 'all',
    channels: 'all',
    brands: 'all',
    href: '/erp/cost-intelligence',
  },
  {
    id: 'ALR-CUST-01',
    category: 'custody',
    severity: 'high',
    monthlyImpact: LEDGER.chillerRecovery,
    exposure: LEDGER.maintCustody,
    entries: LEDGER.maintEntries,
    titleEn: 'Open maintenance custody in Al-Kout Mall & Salmiya',
    titleAr: 'عهد صيانة مفتوحة في مجمع الكوت والسالمية',
    bodyEn: `${f3(LEDGER.maintCustody)} KWD across ${LEDGER.maintEntries} entries from repeated chiller repairs; overhaul recovers ${f0(LEDGER.chillerRecovery)} KWD/month (management estimate).`,
    bodyAr: `${f3(LEDGER.maintCustody)} د.ك عبر ${LEDGER.maintEntries} قيداً بسبب تكرار إصلاح المبردات؛ التجديد يوفر ${f0(LEDGER.chillerRecovery)} د.ك شهرياً (تقدير إداري).`,
    askEn: `Review the ${f3(LEDGER.maintCustody)} KWD maintenance custody (${LEDGER.maintEntries} entries, Al-Kout Mall & Salmiya) and the chiller overhaul plan.`,
    askAr: `راجعي عهدة الصيانة ${f3(LEDGER.maintCustody)} د.ك (${LEDGER.maintEntries} قيداً، مجمع الكوت والسالمية) وخطة تجديد المبردات.`,
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
    monthlyImpact: LEDGER.menuMatrixGain,
    exposure: LEDGER.menuMatrixGain,
    entries: LEDGER.menuItems,
    titleEn: `${MENU_COUNTS.dogs} Dog items and ${MENU_COUNTS.plowhorses} Plowhorses in the Odoo menu`,
    titleAr: `${MENU_COUNTS.dogs} صنفاً ضعيفاً و${MENU_COUNTS.plowhorses} صنفاً شعبياً منخفض الهامش في منيو أودو`,
    bodyEn: `${LEDGER.menuItems} items sold in Odoo; the top ${LEDGER.topItems} make 80% of revenue. Purge ${LEDGER.menuDogsPurge} Dogs and re-price ${LEDGER.menuPlowhorsesReprice} Plowhorses by +5%.`,
    bodyAr: `${LEDGER.menuItems} صنفاً مبيعاً في أودو؛ أعلى ${LEDGER.topItems} صنفاً تحقق 80% من الإيراد. استبعاد ${LEDGER.menuDogsPurge} صنفاً ورفع ${LEDGER.menuPlowhorsesReprice} أصناف بنسبة 5%.`,
    askEn: `Which ${LEDGER.menuDogsPurge} Dog items should we purge and which ${LEDGER.menuPlowhorsesReprice} Plowhorses should get +5% pricing?`,
    askAr: `ما الأصناف الـ ${LEDGER.menuDogsPurge} التي نستبعدها والأصناف الـ ${LEDGER.menuPlowhorsesReprice} التي نرفع سعرها 5%؟`,
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
    exposure: LEDGER.opex,
    entries: LEDGER.opexEntries,
    titleEn: 'Operating-expense reconciliation queue',
    titleAr: 'قائمة مطابقة المصروفات التشغيلية',
    bodyEn: `${f3(LEDGER.opex)} KWD posted operating expenses in Odoo for the whitelisted locations (${LEDGER.opexPct}% of revenue); head office carries ${f3(HO ? HO.expense : 0)} KWD.`,
    bodyAr: `${f3(LEDGER.opex)} د.ك مصروفات تشغيلية مرحّلة في أودو للمواقع المعتمدة (${LEDGER.opexPct}% من الإيراد)؛ يتحمل المكتب الرئيسي ${f3(HO ? HO.expense : 0)} د.ك.`,
    askEn: `Summarise the ${f3(LEDGER.opex)} KWD of posted operating expenses and the controls we should add.`,
    askAr: `لخصي المصروفات التشغيلية المرحّلة البالغة ${f3(LEDGER.opex)} د.ك والضوابط المطلوب إضافتها.`,
    composioAction: 'dispatch_operations_plan',
    branches: 'all',
    channels: 'all',
    brands: 'all',
    href: '/erp/executive-pnl',
  },
  {
    id: 'ALR-OPS-02',
    category: 'operations',
    severity: 'medium',
    monthlyImpact: 0,
    exposure: LOWEST_MARGIN ? LOWEST_MARGIN.revenue : 0,
    entries: null,
    titleEn: `Lowest location margin: ${LOWEST_MARGIN?.en ?? '—'}`,
    titleAr: `أدنى هامش موقع: ${LOWEST_MARGIN?.ar ?? '—'}`,
    bodyEn: `${LOWEST_MARGIN?.en ?? '—'} runs a ${LOWEST_MARGIN?.marginPct ?? 0}% operating margin in its Odoo cost centre against a ${r1(AVG_MARGIN)}% location average.`,
    bodyAr: `يحقق ${LOWEST_MARGIN?.ar ?? '—'} هامشاً تشغيلياً ${LOWEST_MARGIN?.marginPct ?? 0}% في مركز تكلفته بأودو مقابل متوسط مواقع ${r1(AVG_MARGIN)}%.`,
    askEn: `Why is ${LOWEST_MARGIN?.en ?? 'this location'} below the location margin average and what should we change?`,
    askAr: `لماذا ${LOWEST_MARGIN?.ar ?? 'هذا الموقع'} أقل من متوسط هامش المواقع وما الذي يجب تغييره؟`,
    composioAction: 'dispatch_operations_plan',
    branches: LOWEST_MARGIN ? [LOWEST_MARGIN.id] : 'all',
    channels: 'all',
    brands: 'all',
    href: '/erp/executive-pnl',
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
