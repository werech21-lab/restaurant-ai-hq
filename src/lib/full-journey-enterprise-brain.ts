/**
 * Venture Foods — 360° Full-Journey Enterprise Diagnostic & Strategy Brain
 * (Supercharged with Odoo 17 Analytic Cost-Center Precision: Plans, Accounts, Lines & Unallocated Audit).
 *
 * Silently cross-examines the whole restaurant journey in the background and returns only executive
 * decisions (never raw Odoo spreadsheet tables):
 *
 *   1. Procurement, vendors & packaging        4. Field operations, cashier discipline & shifts
 *   2. Central kitchen, yield & shrinkage      5. Analytic cost centers, opex anomalies, capex & rent
 *   3. Menu power, pricing & basket            6. Aggregator net economics & settlements
 *                                              7. Food-quality radar & customer retention
 *
 * Inputs (all aggregate-only, produced by the live sync scripts):
 *   - src/lib/odoo/odoo-journey.json  scripts/sync-odoo-live.mjs → scripts/odoo-journey-extract.mjs
 *   - src/lib/odoo/odoo-intel.json    scripts/sync-odoo-intel.mjs (BOM recipe cost, theoretical food cost)
 *   - src/lib/aether/ledger.ts        whitelisted brands, restaurant locations, channels, posted P&L
 *
 * Strict Guardrails
 *   - Every brand and branch is judged on its own exact Odoo Analytic Cost Center (`Branches` Plan #1 & `BRAND` Plan #2).
 *   - Every play names the exact Venture Foods brand, restaurant location, Analytic Cost Center ID, Odoo dish,
 *     general expense account/category or POS register. Zero excluded locations, zero generic "a location" text.
 *   - Expected impact is either posted (directly measured in Odoo) or estimated (assumption stated transparently).
 */
import JOURNEY_RAW from '@/lib/odoo/odoo-journey.json'
import INTEL_RAW from '@/lib/odoo/odoo-intel.json'
import { ODOO } from '@/lib/odoo/odoo-dataset'
import { BRANCHES, BRANDS, CHANNELS, LEDGER } from '@/lib/aether/ledger'
import { CHANNEL_ECONOMICS } from '@/lib/aether-proprietary-brain'

// ---------------------------------------------------------------------------
// Input shapes (generated JSON files cast once to explicit types)
// ---------------------------------------------------------------------------
type Num = number | null | undefined
type CostCube = Partial<Record<string, number>>
interface Window { from: string; to: string; days: number }
interface PulseWindow { from: string; to: string; days: number; netKwd: number; orders: number; aovKwd: number; perDayKwd: number; cancelledOrders: number; byLocation: Record<string, { netKwd: number; orders: number; perDayKwd: number }> }
interface MenuDish { productId: number; code: string | null; name: string; category: string; qty: number; netKwd: number; avgPriceKwd: number; listPriceKwd: number; sharePct: number }
interface MenuBrand { brand: string; orders: number; itemsPerOrder: number; singleItemPct: number; drinkAttachPct: number; starterAttachPct: number; aovShopKwd: number; aovDeliveryKwd: number; shopOrders: number; deliveryOrders: number; avgDrinkPriceKwd: number; skus: number; top: MenuDish[]; tail: { productId: number; code: string | null; name: string; qty: number; netKwd: number }[] }
interface RegisterOps { posConfigId: number; register: string; location: string; sessions: number; lateOpenings: number; earlyClosings: number; medianOpen: string; medianClose: string | null; cashVarianceCount: number; cashShortKwd: number; cashOverKwd: number; openHours: number }
interface LocationOps { location: string; netKwd: number; orders: number; hourly: number[]; openRegisterHours: number; netPerRegisterHourKwd: number; lineDiscountKwd: number; promoLinesKwd: number; discountPct: number; lateOpenings: number; earlyClosings: number; cashShortKwd: number; cashVarianceCount: number }
interface UnallocatedAccount { accountId: number; code: string; label: string; category: string; categoryEn: string; categoryAr: string; lines: number; debitKwd: number; creditKwd: number; netKwd: number }
interface UnallocatedWindow { lines: number; grossDebitKwd: number; directOpexKwd: number; stockVarianceContraKwd: number; pctOfCompanyExpense?: number; accounts: UnallocatedAccount[] }
interface AnalyticCenterMeta { analyticId: number; entityType: string; entityId: string; en: string; ar: string; code: string; planId: number | null; planName: string | null; active: boolean }
interface MaintenanceSite { location: string; analyticId?: number; postings120d: number; kwd120d: number; reactivePostings120d?: number; reactiveKwd120d?: number; activeMonths: number; equipment: { key: string; postings: number; kwd: number }[] }

interface Journey {
  syncedAt: string
  windows: { rolling30: Window; prior30: Window; mtd: Window }
  access: { readable: { model: string; stage: number }[]; restricted: { model: string; stage: number; reason: string }[] }
  pulse: { rolling30: PulseWindow; prior30: PulseWindow; mtd: PulseWindow; brands: { prior30: Record<string, number>; mtd: Record<string, number> } }
  procurement: {
    spendLast30Kwd: number
    byCategory: { category: string; en: string; ar: string; spendKwd: number; sharePct: number }[]
    creep: { productId: number; code: string | null; name: string; uom: string; category: string; firstPrice: number; lastPrice: number; creepPct: number; last30Qty: number; monthlyImpactKwd: number }[]
    vendorVariance: { productId: number; code: string | null; name: string; uom: string; category: string; vendors: number; bestPrice: number; paidPrice: number; spreadPct: number; last30Qty: number; monthlySavingKwd: number }[]
    concentration: { skus: number; skus80: number; vendors: number; vendors80: number; top10SharePct: number }
    bills: { count: number; untaxedKwd: number; offPoCount: number; offPoKwd: number }
  }
  kitchen: {
    posted30: { rawFoodKwd: number; inventoryVarianceKwd: number; scrapKwd: number; packagingKwd: number }
    postedPrior30: { rawFoodKwd: number; inventoryVarianceKwd: number; scrapKwd: number; packagingKwd: number }
    ckTransfers: { location: string; moves: number; ordersPerMove: number | null }[]
    scrap: { location: string; moves: number; topItems: { name: string; qty: number }[] }[]
  }
  menu: { brands: MenuBrand[] }
  operations: { registers: RegisterOps[]; locations: LocationOps[]; cashVarianceReadable?: boolean; labour: { available: boolean; reason?: string } }
  opex: {
    analyticArchitecture?: { plansReadable: boolean; accountsReadable: boolean; linesReadable: boolean; plans: { id: number; name: string }[]; whitelistedCenters: AnalyticCenterMeta[]; rolling30Lines: number }
    unallocated?: { rolling30: UnallocatedWindow; prior30: UnallocatedWindow; mtd: UnallocatedWindow }
    categories: { category: string; en: string; ar: string; rolling30Kwd: number; prior30Kwd: number; mtdKwd?: number; deltaKwd: number; deltaPct: number | null; postings: number }[]
    locations: { location: string; analyticId?: number | null; rolling30: CostCube; prior30: CostCube; mtd?: CostCube; offPo30Kwd?: number }[]
    centralKitchen: { analyticId?: number; rolling30: CostCube; prior30: CostCube; mtd?: CostCube }
    headOffice?: { analyticId?: number; rolling30: CostCube; prior30: CostCube; mtd?: CostCube; offPo30Kwd?: number }
    brands: { brand: string; analyticId?: number | null; rolling30: CostCube; prior30: CostCube; mtd?: CostCube; offPo30Kwd?: number }[]
    maintenance: MaintenanceSite[]
    petty: { outflowKwd?: number; offPoByLocation?: Record<string, number>; offPoByBrand?: Record<string, number> }
    custody: { totalKwd: number; branchCashier: Record<string, number>; individualKwd: number; individualAccounts: number; otherKwd: number }
  }
  delivery: { platforms: { platform: string; openBalanceKwd: number; receivableKwd: number; clearingKwd: number; booked30Kwd: number; settled30Kwd: number; postedCommission30Kwd: number }[]; postedCommissions30: Record<string, number>; postedCommissionsPrior30: Record<string, number> }
  quality: {
    cancelled: { orders: number; kwd: number; byLocation: { location: string; orders: number; kwd: number; ratePct: number }[]; byShift: { shift: string; cancelled: number; orders: number; ratePct: number }[] }
    complimentary: { location: string; orders: number; kwd: number; pctOfSales: number }[]
    discountedDishes: { productId: number; name: string; brand: string; discountKwd: number; lines: number }[]
    retention: { identifiedCustomers: number; repeatCustomers: number; repeatRatePct: number; avgOrdersPerRepeat: number }
  }
  brandLocation: { location: string; brand: string; netKwd: number }[]
  locationChannels?: { location: string; channel: string; amountKwd: number; payments: number }[]
}
interface Intel { recipes: { productId: number; name: string; brand: string; lines: number; coverage: number }[]; theoretical?: { byLocation: { location: string; theoreticalPct: number | null; coveredSalesPct: number }[] } }

const J = JOURNEY_RAW as unknown as Journey
const INTEL = INTEL_RAW as unknown as Intel

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
export type JourneyStage = 'procurement' | 'kitchen' | 'menu' | 'operations' | 'opex' | 'delivery' | 'quality'
export type PlaySeverity = 'critical' | 'high' | 'medium'

export const JOURNEY_STAGES: { id: JourneyStage | 'all'; n: number; en: string; ar: string }[] = [
  { id: 'all', n: 0, en: 'All', ar: 'الكل' },
  { id: 'procurement', n: 1, en: '1. Procurement & Vendors', ar: '١. المشتريات والموردين' },
  { id: 'kitchen', n: 2, en: '2. Central Kitchen & Waste', ar: '٢. المطبخ المركزي والهدر' },
  { id: 'menu', n: 3, en: '3. Menu & Basket Growth', ar: '٣. المينيو ومضاعفة المبيعات' },
  { id: 'operations', n: 4, en: '4. Operations & Branch Quality', ar: '٤. العمليات وجودة الفروع' },
  { id: 'opex', n: 5, en: '5. Cost Centers, OpEx & Rents', ar: '٥. مراكز التكلفة والمصاريف والإيجارات' },
  { id: 'delivery', n: 6, en: '6. Delivery Economics', ar: '٦. اقتصاديات التوصيل' },
  { id: 'quality', n: 7, en: '7. Experience Quality & Customer', ar: '٧. جودة التجربة والعميل' },
]

export interface PlayKpi {
  id: string
  en: string
  ar: string
  value: number
  unit: 'kwd' | 'pct' | 'count'
  /** Direction that counts as improvement. */
  better: 'down' | 'up'
}

export interface SimulatorSlider {
  id: string
  labelEn: string
  labelAr: string
  unit: 'fils' | 'pct'
  min: number
  max: number
  step: number
  defaultValue: number
}

export interface PlaySimulator {
  kind: 'reprice' | 'bundle' | 'host-kitchen' | 'capture' | 'upsell'
  sliders: [SimulatorSlider, SimulatorSlider]
  meta?: {
    totalQty?: number
    avgPriceKwd?: number
    foodCostPct?: number
    baseStepFils?: number
    orders?: number
    drinkPriceKwd?: number
    medianSalesKwd?: number
    addonNetMarginKwd?: number
  }
}

export interface SpotAuditChecklist {
  en: [string, string, string]
  ar: [string, string, string]
}

export interface CashierUpsellScriptItem {
  brandId: string
  brandEn: string
  brandAr: string
  scriptEn: string
  scriptAr: string
  addonPriceKwd: number
}

export interface CashierUpsellSpec {
  weeklyBonusKwd: number
  unlockThresholdNetKwd: number
  bonusSharePct: number
  targetCounterOrders: number
  scripts: CashierUpsellScriptItem[]
  ruleEn: string
  ruleAr: string
}

export interface DirectBoxSpec {
  id: string
  segmentEn: string
  segmentAr: string
  hubBranchEn: string
  hubBranchAr: string
  boxNameEn: string
  boxNameAr: string
  priceKwd: number
  contentsEn: string
  contentsAr: string
}

export interface DirectBoxPlaybook {
  commissionPct: number
  boxes: DirectBoxSpec[]
  qrRetentionRuleEn: string
  qrRetentionRuleAr: string
}

export interface PrepParSpec {
  weekdayMultiplier: number
  weekendMultiplier: number
  dispatchCutoffEn: string
  dispatchCutoffAr: string
  surgePct: number
  peakWindowEn: string
  peakWindowAr: string
}

export interface ElasticityGuardrail {
  inelastic: { name: string; priceKwd: number; suggestedFils: number }[]
  trafficDrivers: { name: string; priceKwd: number; ruleEn: string; ruleAr: string }[]
}

export interface VendorShield {
  items: {
    name: string
    uom: string
    oldPriceKwd: number
    newPriceKwd: number
    monthlyGapKwd: number
    affectedDishes: string[]
  }[]
}

export interface JourneyPlay {
  id: string
  stage: JourneyStage
  severity: PlaySeverity
  titleEn: string
  titleAr: string
  /** Exact entity: brand, restaurant location, Analytic Cost Center, Odoo dish, expense category or POS register. */
  subjectEn: string
  subjectAr: string
  ownerRoleEn: string
  ownerRoleAr: string
  leakEn: string
  leakAr: string
  actionEn: string
  actionAr: string
  qualityEn: string
  qualityAr: string
  impactEn: string
  impactAr: string
  monthlyKwd: number
  annualKwd: number
  basis: 'posted' | 'estimated'
  evidence: { en: string; ar: string }[]
  kpi: PlayKpi
  simulator: PlaySimulator
  spotAudit: SpotAuditChecklist
  elasticityGuardrail?: ElasticityGuardrail
  vendorShield?: VendorShield
  cashierUpsell?: CashierUpsellSpec
  directBoxPlaybook?: DirectBoxPlaybook
  prepParSpec?: PrepParSpec
}

// ---------------------------------------------------------------------------
// Helpers & Analytic Cost-Center Lookups
// ---------------------------------------------------------------------------
const f0 = (n: number) => Math.round(n).toLocaleString('en-US')
const f1 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const f3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0)
const sum = <T,>(rows: readonly T[], fn: (r: T) => number) => rows.reduce((s, r) => s + (fn(r) || 0), 0)
const n = (v: Num) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const COGS = LEDGER.cogsPct / 100
const KWD = (v: number) => `${f0(v)} KWD`
const DK = (v: number) => `${f0(v)} د.ك`

const BRANCH_IDS = new Set(BRANCHES.map((b) => b.id as string))
const locEn = (id: string) => (id === 'central-kitchen' ? 'Ardiya Central Kitchen' : id === 'head-office' ? 'Head Office' : BRANCHES.find((b) => b.id === id)?.en ?? id)
const locAr = (id: string) => (id === 'central-kitchen' ? 'المطبخ المركزي بالعارضية' : id === 'head-office' ? 'الإدارة العامة' : BRANCHES.find((b) => b.id === id)?.ar ?? id)
const locAnalyticTag = (id: string, ar = false) => {
  if (id === 'central-kitchen') return ar ? 'مركز تكلفة #17' : 'Analytic #17'
  if (id === 'head-office') return ar ? 'مركز تكلفة #19' : 'Analytic #19'
  const aid = J.opex.locations.find((l) => l.location === id)?.analyticId
  return aid ? (ar ? `مركز تكلفة #${aid}` : `Analytic #${aid}`) : ''
}
const locWithAnalytic = (id: string, ar = false) => {
  const tag = locAnalyticTag(id, ar)
  const nm = ar ? locAr(id) : locEn(id)
  return tag ? `${nm} (${tag})` : nm
}

const BRAND_NAMES: Record<string, { en: string; ar: string }> = {
  'china-garden': { en: 'China Garden', ar: 'تشاينا جاردن' },
  franks: { en: "Frank's", ar: 'فرانكس' },
  tahina: { en: 'Tahina', ar: 'طحينة' },
  'farm-brown': { en: 'Farm Brown', ar: 'فارم براون' },
  'fresh-daily-canteen': { en: 'Fresh Daily Canteen', ar: 'فريش ديلي كانتين' },
  'noodle-bar': { en: 'The Noodle Bar', ar: 'ذا نودل بار' },
  'karak-cafeteria': { en: 'Karak Cafeteria', ar: 'كرك كافتيريا' },
  heisenberg: { en: 'Heisenberg', ar: 'هايزنبرغ' },
  'sushi-hoko': { en: 'Sushi Hoko', ar: 'سوشي هوكو' },
  'tasty-snacks': { en: 'Tasty Snacks', ar: 'تيستي سناكس' },
}
const brandEn = (id: string) => BRANDS.find((b) => b.id === id)?.en ?? BRAND_NAMES[id]?.en ?? id
const brandAr = (id: string) => BRANDS.find((b) => b.id === id)?.ar ?? BRAND_NAMES[id]?.ar ?? id
const brandAnalyticId = (id: string) => J.opex.brands.find((b) => b.brand === id)?.analyticId ?? null
const brandWithAnalytic = (id: string, ar = false) => {
  const aid = brandAnalyticId(id)
  const nm = ar ? brandAr(id) : brandEn(id)
  return aid ? `${nm} (${ar ? `مركز تكلفة #${aid}` : `Analytic #${aid}`})` : nm
}

const SHIFT: Record<string, [string, string]> = { morning: ['morning shift (06:00–12:00)', 'الشفت الصباحي (6:00–12:00)'], afternoon: ['afternoon shift (12:00–17:00)', 'شفت الظهيرة (12:00–17:00)'], evening: ['evening shift (17:00–22:00)', 'الشفت المسائي (17:00–22:00)'], late: ['late-night shift (22:00–06:00)', 'الشفت الليلي المتأخر (22:00–6:00)'] }
const EQUIP: Record<string, [string, string]> = {
  refrigeration: ['refrigeration (chillers & freezers)', 'التبريد (الثلاجات والفريزرات)'],
  'air-conditioning': ['air-conditioning units', 'وحدات التكييف'],
  fryer: ['fryers', 'القلايات'],
  'oven-grill': ['ovens & grills', 'الأفران والشوايات'],
  'wok-burner': ['wok burners & gas line', 'مواقد الووك وخط الغاز'],
  'hood-exhaust': ['hood & exhaust', 'الهود والشفاطات'],
  dishwasher: ['dishwasher', 'غسالة الأطباق'],
  'ice-machine': ['ice machine', 'ماكينة الثلج'],
  'production-equipment': ['central-kitchen production machinery', 'ماكينات الإنتاج بالمطبخ المركزي'],
  plumbing: ['plumbing & drainage', 'السباكة والصرف'],
  electrical: ['electrical & lighting', 'الكهرباء والإضاءة'],
  'pos-it': ['POS printers & screens', 'طابعات وشاشات نقاط البيع'],
}
const severityOf = (monthly: number, floor: PlaySeverity = 'medium'): PlaySeverity => (monthly >= 1500 ? 'critical' : monthly >= 500 ? 'high' : floor)

/** Restaurant-location cost cube for the rolling window (posted, Odoo Branches Analytic Plan #1). */
const LOC_COSTS = J.opex.locations.filter((l) => BRANCH_IDS.has(l.location))
const REST_INCOME = sum(LOC_COSTS, (l) => n(l.rolling30.income))
/** Actual-to-recipe factor: (raw food + count variance + scrap) ÷ raw food at the 7 restaurants. */
const ACTUAL_FOOD_FACTOR = (() => {
  const food = sum(LOC_COSTS, (l) => n(l.rolling30['raw-food']))
  const actual = food + sum(LOC_COSTS, (l) => n(l.rolling30['inventory-variance']) + n(l.rolling30.scrap))
  return food > 0 ? Math.min(2.5, actual / food) : 1
})()
/** Brand food cost on its own Analytic Cost Center (`BRAND` Plan #2), grossed up to actual (variance & scrap). */
const brandFoodPct = (brand: string) => {
  const b = J.opex.brands.find((x) => x.brand === brand)
  const inc = n(b?.rolling30.income)
  const food = n(b?.rolling30['raw-food'])
  const p = inc > 0 ? (food / inc) * ACTUAL_FOOD_FACTOR : 0
  return p > 0.08 && p < 0.6 ? p : COGS
}

const CHANNEL_COMM_BY_NAME: Record<string, number> = {
  ...Object.fromEntries(CHANNELS.map((c) => [c.en, c.commissionPct / 100])),
  'Shop Sales': 0,
  'Staff & complimentary': 0,
  'Talabat Go': (CHANNELS.find((c) => c.id === 'talabat-tgo')?.commissionPct ?? 17) / 100,
  Keeta: (CHANNELS.find((c) => c.id === 'keeta')?.commissionPct ?? 12) / 100,
  'Deliveroo Go': (CHANNELS.find((c) => c.id === 'deliveroo-go')?.commissionPct ?? 18) / 100,
  'Talabat MP': (CHANNELS.find((c) => c.id === 'talabat-tmp')?.commissionPct ?? 10) / 100,
  Snoonu: (CHANNELS.find((c) => c.id === 'snoonu')?.commissionPct ?? 15) / 100,
  'Online Payment Link': (CHANNELS.find((c) => c.id === 'online-link')?.commissionPct ?? 2.5) / 100,
  Jahez: (CHANNELS.find((c) => c.id === 'jahez')?.commissionPct ?? 15) / 100,
  'Deliveroo MP': (CHANNELS.find((c) => c.id === 'deliveroo-mp')?.commissionPct ?? 10) / 100,
}
const AVG_AGG_COMMISSION = (() => {
  const agg = CHANNELS.filter((c) => c.group === 'aggregator')
  const s = sum(agg, (c) => c.sales)
  return s ? sum(agg, (c) => c.sales * (c.commissionPct / 100)) / s : 0.15
})()

function defaultOwnerForStage(stage: JourneyStage, subjectEn: string, subjectAr: string): { ownerRoleEn: string; ownerRoleAr: string } {
  switch (stage) {
    case 'procurement':
      return {
        ownerRoleEn: 'Head of Procurement & CFO Purchasing Desk',
        ownerRoleAr: 'مسؤول المشتريات ومكتب الاعتماد المالي',
      }
    case 'kitchen':
      return {
        ownerRoleEn: 'Executive Chef — Ardiya Central Kitchen (Analytic #17)',
        ownerRoleAr: 'الشيف التنفيذي — المطبخ المركزي بالعارضية (مركز تكلفة #17)',
      }
    case 'menu':
      return {
        ownerRoleEn: 'COO & Menu Engineering Lead (Odoo POS + Aggregators)',
        ownerRoleAr: 'مدير العمليات ومسؤول هندسة المنيو والتسعير',
      }
    case 'operations':
      return {
        ownerRoleEn: `Branch Manager & Area Operations (${subjectEn.split('·')[0].trim()})`,
        ownerRoleAr: `مدير الفرع ومدير منطقة التشغيل (${subjectAr.split('·')[0].trim()})`,
      }
    case 'opex':
      return {
        ownerRoleEn: 'CFO & Analytic Cost-Center Accounting Desk',
        ownerRoleAr: 'المدير المالي وفريق محاسبة مراكز التكلفة',
      }
    case 'delivery':
      return {
        ownerRoleEn: 'Aggregator Growth & Finance Settlement Lead',
        ownerRoleAr: 'مسؤول منصات التوصيل ومطابقة التسويات البنكية',
      }
    case 'quality':
      return {
        ownerRoleEn: 'Quality Assurance & Guest Retention Lead',
        ownerRoleAr: 'مسؤول ضبط الجودة وتجربة وولاء العملاء',
      }
  }
}

function defaultSimulatorForPlay(stage: JourneyStage, id: string): PlaySimulator {
  if (id.startsWith('menu-reprice-')) {
    return {
      kind: 'reprice',
      sliders: [
        { id: 'priceFils', labelEn: 'Hero dish price tweak (fils)', labelAr: 'تعديل سعر الطبق القائد (فلس)', unit: 'fils', min: 100, max: 350, step: 25, defaultValue: 150 },
        { id: 'retentionPct', labelEn: 'Expected volume retention', labelAr: 'نسبة الاحتفاظ بحجم الطلبات', unit: 'pct', min: 95, max: 100, step: 0.5, defaultValue: 98 },
      ],
    }
  }
  if (id.startsWith('menu-basket-') || id.startsWith('menu-shop-basket-')) {
    return {
      kind: 'bundle',
      sliders: [
        { id: 'attachPct', labelEn: 'Combo / drink attachment rate', labelAr: 'نسبة إرفاق الوجبة أو المشروب', unit: 'pct', min: 10, max: 35, step: 1, defaultValue: 15 },
        { id: 'marginPct', labelEn: 'Bundle net margin capture', labelAr: 'صافي هامش ربح الإضافة', unit: 'pct', min: 55, max: 80, step: 1, defaultValue: 70 },
      ],
    }
  }
  if (id.startsWith('opex-host-kitchen-')) {
    return {
      kind: 'host-kitchen',
      sliders: [
        { id: 'peerCapturePct', labelEn: 'Peer branch median volume capture', labelAr: 'نسبة تحقيق وسيط مبيعات الفروع النظيرة', unit: 'pct', min: 50, max: 100, step: 5, defaultValue: 75 },
        { id: 'netMarginPct', labelEn: 'Post-commission net cash margin', labelAr: 'صافي الهامش النقدي بعد العمولة والمواد', unit: 'pct', min: 22, max: 38, step: 1, defaultValue: 30 },
      ],
    }
  }
  const defaultCapture = stage === 'procurement' ? 70 : stage === 'kitchen' ? 50 : stage === 'delivery' ? 35 : 60
  return {
    kind: 'capture',
    sliders: [
      { id: 'capturePct', labelEn: 'Target leakage recovery %', labelAr: 'نسبة استرداد الهدر أو الفجوة المستهدفة', unit: 'pct', min: 25, max: 90, step: 5, defaultValue: defaultCapture },
      { id: 'compliancePct', labelEn: 'Branch execution compliance', labelAr: 'نسبة التزام الفروع بالتنفيذ', unit: 'pct', min: 75, max: 100, step: 5, defaultValue: 95 },
    ],
  }
}

// ---------------------------------------------------------------------------
// Real-World Kuwait Calendar & Time-Profile Engine (Payday, Zwarah & Mid-Month)
// ---------------------------------------------------------------------------
export type KuwaitTacticalMode = 'payday-zwarah' | 'mid-month-shield' | 'early-month-momentum'

const KUWAIT_TIME_CURVE = (() => {
  const fullDays = (ODOO.timeProfile?.daily ?? []).filter((d) => d.orders >= 250)
  const paydayOrZwarah = fullDays.filter((d) => {
    const dt = new Date(`${d.day}T12:00:00Z`)
    const dom = dt.getUTCDate()
    const dow = dt.getUTCDay() // 4 = Thu, 5 = Fri
    return (dom >= 20 && dom <= 29) || dow === 4 || dow === 5
  })
  const midMonthWeekdays = fullDays.filter((d) => {
    const dt = new Date(`${d.day}T12:00:00Z`)
    const dom = dt.getUTCDate()
    const dow = dt.getUTCDay()
    return dom >= 10 && dom <= 19 && dow !== 4 && dow !== 5
  })
  const thuFriDays = fullDays.filter((d) => {
    const dow = new Date(`${d.day}T12:00:00Z`).getUTCDay()
    return dow === 4 || dow === 5
  })
  const sunWedDays = fullDays.filter((d) => {
    const dow = new Date(`${d.day}T12:00:00Z`).getUTCDay()
    return dow >= 0 && dow <= 3
  })

  const paydayAvgKwd = paydayOrZwarah.length ? sum(paydayOrZwarah, (d) => d.netKwd) / paydayOrZwarah.length : 5690
  const paydayAvgOrders = paydayOrZwarah.length ? sum(paydayOrZwarah, (d) => d.orders) / paydayOrZwarah.length : 1290
  const midAvgKwd = midMonthWeekdays.length ? sum(midMonthWeekdays, (d) => d.netKwd) / midMonthWeekdays.length : 3250
  const midAvgOrders = midMonthWeekdays.length ? sum(midMonthWeekdays, (d) => d.orders) / midMonthWeekdays.length : 895
  const thuFriAvgOrders = thuFriDays.length ? sum(thuFriDays, (d) => d.orders) / thuFriDays.length : 1358
  const thuFriAvgKwd = thuFriDays.length ? sum(thuFriDays, (d) => d.netKwd) / thuFriDays.length : 6338
  const sunWedAvgOrders = sunWedDays.length ? sum(sunWedDays, (d) => d.orders) / sunWedDays.length : 1002
  const sunWedAvgKwd = sunWedDays.length ? sum(sunWedDays, (d) => d.netKwd) / sunWedDays.length : 3622
  const peakSingleDay = [...fullDays].sort((a, b) => b.netKwd - a.netKwd)[0]

  return {
    paydayAvgKwd,
    paydayAvgOrders: Math.round(paydayAvgOrders),
    midAvgKwd,
    midAvgOrders: Math.round(midAvgOrders),
    surgeKwdPct: pct(paydayAvgKwd - midAvgKwd, midAvgKwd),
    thuFriAvgOrders: Math.round(thuFriAvgOrders),
    thuFriAvgKwd,
    sunWedAvgOrders: Math.round(sunWedAvgOrders),
    sunWedAvgKwd,
    weekendOrderMultiplier: sunWedAvgOrders > 0 ? Math.round((thuFriAvgOrders / sunWedAvgOrders) * 100) / 100 : 1.36,
    weekendKwdMultiplier: sunWedAvgKwd > 0 ? Math.round((thuFriAvgKwd / sunWedAvgKwd) * 100) / 100 : 1.75,
    peakDayStr: peakSingleDay?.day ?? '2026-10-30',
    peakDayKwd: peakSingleDay?.netKwd ?? 7491,
    peakDayOrders: peakSingleDay?.orders ?? 1389,
  }
})()

export interface KuwaitCalendarPulse {
  kuwaitDateIso: string
  dayOfMonth: number
  weekdayEn: string
  weekdayAr: string
  daysInMonth: number
  daysToMonthEnd: number
  daysTo15thWindow: number
  isZwarahDay: boolean
  isPaydayWindow: boolean
  isMidMonthWindow: boolean
  activeMode: KuwaitTacticalMode
  badgeEn: string
  badgeAr: string
  headlineEn: string
  headlineAr: string
  directiveEn: string
  directiveAr: string
  paydayAvgKwd: number
  midAvgKwd: number
  surgeKwdPct: number
  peakDayKwd: number
  modes: {
    paydayZwarah: {
      windowEn: string
      windowAr: string
      titleEn: string
      titleAr: string
      bundlesEn: string[]
      bundlesAr: string[]
      opsRuleEn: string
      opsRuleAr: string
    }
    midMonthShield: {
      windowEn: string
      windowAr: string
      titleEn: string
      titleAr: string
      bundlesEn: string[]
      bundlesAr: string[]
      opsRuleEn: string
      opsRuleAr: string
    }
  }
}

const WEEKDAY_AR_MAP: Record<string, string> = {
  Sun: 'الأحد',
  Mon: 'الاثنين',
  Tue: 'الثلاثاء',
  Wed: 'الأربعاء',
  Thu: 'الخميس',
  Fri: 'الجمعة',
  Sat: 'السبت',
}

export function evaluateKuwaitCashCycle(refDate: Date = new Date()): KuwaitCalendarPulse {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kuwait',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const parts = Object.fromEntries(fmt.formatToParts(refDate).map((p) => [p.type, p.value]))
  const year = Number(parts.year || 2026)
  const month = Number(parts.month || 11)
  const dayOfMonth = Number(parts.day || 10)
  const wkShort = parts.weekday || 'Tue'
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const daysToMonthEnd = Math.max(0, daysInMonth - dayOfMonth)
  const cutoffDay = Math.max(15, daysInMonth - 15)
  const daysTo15thWindow = Math.max(0, cutoffDay - dayOfMonth)

  const isZwarahDay = wkShort === 'Thu' || wkShort === 'Fri'
  const isPaydayWindow = dayOfMonth >= 20 && dayOfMonth <= 29
  const isMidMonthWindow = dayOfMonth >= 10 && dayOfMonth <= 19 && !isZwarahDay

  const activeMode: KuwaitTacticalMode =
    isPaydayWindow || isZwarahDay ? 'payday-zwarah' : isMidMonthWindow ? 'mid-month-shield' : 'early-month-momentum'

  const weekdayAr = WEEKDAY_AR_MAP[wkShort] ?? 'اليوم'
  const weekdayEn =
    wkShort === 'Thu'
      ? 'Thursday'
      : wkShort === 'Fri'
        ? 'Friday'
        : wkShort === 'Sat'
          ? 'Saturday'
          : wkShort === 'Sun'
            ? 'Sunday'
            : wkShort === 'Mon'
              ? 'Monday'
              : wkShort === 'Tue'
                ? 'Tuesday'
                : 'Wednesday'

  const paydayZwarah = {
    windowEn: '20th–29th Payday Cycle + Every Thu/Fri Zwarah',
    windowAr: 'موسم الرواتب (٢٠–٢٩ الشهر) + زوارة الخميس والجمعة',
    titleEn: 'Payday & Weekend Zwarah High-Ticket Surge Mode',
    titleAr: 'وضع ذروة الرواتب والزوارة العائلية لرفع الفاتورة',
    bundlesEn: [
      'China Garden: Zwarah Family Feast (Chicken Noodles + Beef Mongolian + Chicken Sweet & Sour + 4 Sweet Corn Chicken Soups · 15.900 KWD)',
      "Frank's: 4× Orig. Philly CheeseSteak + 2× Ziggy Fries + Boneless Buffalo Bites Sharing Tray (17.500 KWD)",
      'Tahina: 16-Piece Lebanese Bread Chicken & Meat Shawarma Zwarah Box + Fries (13.900 KWD)',
    ],
    bundlesAr: [
      'تشاينا جاردن: وليمة زوارة العائلة (نودلز دجاج + بيف منغولي + دجاج سويت آند ساور + ٤ شوربة ذرة بالدجاج بسعر ١٥٫٩٠٠ د.ك)',
      'فرانكس: صينية المشاركة (٤ فيلي تشيز ستيك الأصلي + ٢ بطاطس زيجي + بافلو بايتس بسعر ١٧٫٥٠٠ د.ك)',
      'طحينة: بوكس شاورما الزوارة (١٦ شاورما دجاج ولحم بالخبز اللبناني مع البطاطس والطحينة بسعر ١٣٫٩٠٠ د.ك)',
    ],
    opsRuleEn: 'Pin family boxes at #1 on POS & apps, freeze all flat % discounts, and staff 100% wok/grill stations from 18:00–22:30.',
    opsRuleAr: 'تثبيت بوكسات العائلة والزوارة في صدارة شاشات الكاونتر والتطبيقات، وإيقاف الخصومات النسبية، وتشغيل محطات الطبخ بكامل طاقتها من ٦:٠٠ إلى ١٠:٣٠ مساءً.',
  }

  const midMonthShield = {
    windowEn: '10th–19th Mid-Month Liquidity Shield (Sun–Wed)',
    windowAr: 'درع سيولة منتصف الشهر (الأيام ١٠ إلى ١٩ — الأحد للأربعاء)',
    titleEn: 'Mid-Month Value-Engineered Duo & Solo Shield (Zero Flat Discounts)',
    titleAr: 'درع وجبات الثنائي والفردي عالية الهامش (دون خصومات تحرق الربح)',
    bundlesEn: [
      'China Garden: Smart Solo Lock (Veg Or Chicken Noodles Combo + Sweet Corn Chicken Soup · 3.850 KWD, 72% gross margin)',
      'The Noodle Bar: Sriracha Chicken Noodles + Chilled Drink Duo Box (3.950 KWD)',
      "Frank's: Orig. Philly CheeseSteak + Ziggy Fries Value Meal Lock (3.950 KWD — zero % discount needed)",
    ],
    bundlesAr: [
      'تشاينا جاردن: وجبة الفرد الذكية (كومبو نودلز الدجاج أو الخضار + شوربة الذرة بالدجاج بسعر ٣٫٨٥٠ د.ك بهامش إجمالي ٧٢٪)',
      'ذا نودل بار: وجبة نودلز دجاج سيراتشا مع مشروب بارد بسعر ٣٫٩٥٠ د.ك',
      'فرانكس: وجبة فيلي تشيز ستيك الأصلي مع بطاطس زيجي بسعر ٣٫٩٥٠ د.ك دون أي خصم نسبي',
    ],
    opsRuleEn: 'Protect daily order count with sub-4.000 KWD meal locks built from low-COGS soup/fries/drink pairings while trimming raw veg prep by 15%.',
    opsRuleAr: 'حماية عدد الطلبات اليومية بوجبات مشبعة تحت سقف ٤٫٠٠٠ د.ك مبنية على إضافات الشوربة والبطاطس والمشروبات مرتفعة الهامش، مع خفض تحضير الخضار المقطعة ١٥٪.',
  }

  const headlineEn =
    activeMode === 'payday-zwarah'
      ? `Active Today (${weekdayEn}, Day ${dayOfMonth}): Payday & Zwarah Surge Mode (+${f0(KUWAIT_TIME_CURVE.surgeKwdPct)}% Odoo sales lift)`
      : activeMode === 'mid-month-shield'
        ? `Active Today (${weekdayEn}, Day ${dayOfMonth}): Mid-Month Liquidity Shield (Days 10–19 · Zero-Discount Value Combos)`
        : `Active Today (${weekdayEn}, Day ${dayOfMonth}): Post-Payday Counter Basket Momentum (Days 1–9)`

  const headlineAr =
    activeMode === 'payday-zwarah'
      ? `الوضع الميداني النشط اليوم (${weekdayAr}، يوم ${dayOfMonth}): ذروة الرواتب والزوارة (+${f0(KUWAIT_TIME_CURVE.surgeKwdPct)}٪ قفزة مبيعات بأودو)`
      : activeMode === 'mid-month-shield'
        ? `الوضع الميداني النشط اليوم (${weekdayAr}، يوم ${dayOfMonth}): درع سيولة منتصف الشهر (الأيام ١٠–١٩ · وجبات ذكية بلا خصومات)`
        : `الوضع الميداني النشط اليوم (${weekdayAr}، يوم ${dayOfMonth}): زخم بداية الشهر لترقية سلة الكاونتر (الأيام ١–٩)`

  const directiveEn =
    activeMode === 'payday-zwarah'
      ? paydayZwarah.opsRuleEn
      : activeMode === 'mid-month-shield'
        ? midMonthShield.opsRuleEn
        : 'Capture early-month mall footfall at 360 Mall, Promenade Mall, Assima Mall and The Avenues with 1-line cashier meal upgrades before Day 10.'

  const directiveAr =
    activeMode === 'payday-zwarah'
      ? paydayZwarah.opsRuleAr
      : activeMode === 'mid-month-shield'
        ? midMonthShield.opsRuleAr
        : 'استثمار إقبال بداية الشهر في مجمع ٣٦٠ ومجمع البروميناد ومجمع العاصمة والأفنيوز عبر ترقية الوجبات عند الكاونتر قبل دخول يوم ١٠ بالشهر.'

  return {
    kuwaitDateIso: `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`,
    dayOfMonth,
    weekdayEn,
    weekdayAr,
    daysInMonth,
    daysToMonthEnd,
    daysTo15thWindow,
    isZwarahDay,
    isPaydayWindow,
    isMidMonthWindow,
    activeMode,
    badgeEn:
      activeMode === 'payday-zwarah'
        ? 'PAYDAY & ZWARAH SURGE'
        : activeMode === 'mid-month-shield'
          ? 'MID-MONTH SHIELD (10–19)'
          : 'EARLY-MONTH MOMENTUM',
    badgeAr:
      activeMode === 'payday-zwarah'
        ? 'وضع ذروة الرواتب والزوارة'
        : activeMode === 'mid-month-shield'
          ? 'درع منتصف الشهر (١٠–١٩)'
          : 'زخم بداية الشهر (١–٩)',
    headlineEn,
    headlineAr,
    directiveEn,
    directiveAr,
    paydayAvgKwd: KUWAIT_TIME_CURVE.paydayAvgKwd,
    midAvgKwd: KUWAIT_TIME_CURVE.midAvgKwd,
    surgeKwdPct: KUWAIT_TIME_CURVE.surgeKwdPct,
    peakDayKwd: KUWAIT_TIME_CURVE.peakDayKwd,
    modes: { paydayZwarah, midMonthShield },
  }
}

export const KUWAIT_CALENDAR_PULSE = evaluateKuwaitCashCycle()

/**
 * 5-Minute Surgical Physical Spot-Audit Checklist for Area / Operations Managers.
 * Auto-tailored to each play's exact real Venture Foods branch, dish, register or cost center.
 */
function cleanScopeAr(subjectAr: string, fallbackAr: string): string {
  const first = subjectAr.split('·')[0].trim()
  const mapped = first
    .replace(/Delivery\s*\(Salmyia\)/gi, 'جهاز توصيل السالمية')
    .replace(/China Garden\s*\(360\)/gi, 'جهاز تشاينا جاردن مجمع 360')
    .replace(/Tahina\s*\(promenade\)/gi, 'جهاز طحينة البروميناد')
    .replace(/\bTalabat\b/gi, 'طلبات')
    .replace(/\bKeeta\b/gi, 'كيتا')
    .replace(/\bDeliveroo\b/gi, 'ديليفرو')
    .replace(/\bJahez\b/gi, 'جاهز')
    .replace(/\bSnoonu\b/gi, 'سنونو')
    .trim()
  return /[A-Za-z]/.test(mapped) ? fallbackAr : mapped || fallbackAr
}

function buildSpotAuditForPlay(id: string, stage: JourneyStage, subjectEn: string, subjectAr: string): SpotAuditChecklist {
  if (id === 'kitchen-inventory-variance' || id === 'kitchen-portion-drift') {
    return {
      en: [
        `Minute 1–2 (Digital Scale Check): Weigh 5 cooked portions of Chicken Noodles & Beef Mongolian on the pass at The Avenues (#114) and 360 Mall (#37) against the 140g protein standard.`,
        `Minute 3–4 (Chiller vs Odoo Transfer): Cross-check 3 sealed protein bags received from Ardiya Central Kitchen (#17) against today's signed transfer slip.`,
        `Minute 5 (Unposted Waste Bin): Inspect the prep-line trimmings bin before evening rush to confirm zero unrecorded protein discard.`,
      ],
      ar: [
        `الدقيقة ١–٢ (فحص الميزان الرقمي): وزن ٥ حصص مطبوخة عشوائياً من نودلز الدجاج وبيف منغولي على شباك التسليم في الأفنيوز (مركز #114) ومجمع 360 (مركز #37) مقابل معيار ١٤٠ جم بروتين.`,
        `الدقيقة ٣–٤ (مطابقة استلام الثلاجة): مطابقة ٣ أكياس بروتين مبردة مستلمة من المطبخ المركزي بالعارضية (مركز #17) مع إذن التحويل الموقّع اليوم في أودو.`,
        `الدقيقة ٥ (فحص حاوية الهدر غير المسجل): فحص حاوية خط التحضير قبل ذروة المساء للتأكد من عدم رمي أي بروتين دون قيد هالك.`,
      ],
    }
  }
  if (id === 'kitchen-scrap-hotspot' || id === 'kitchen-ardiya-prep-par-shield') {
    return {
      en: [
        `Minute 1–2 (Batch Timestamp Audit): Inspect shelf-life stickers on sliced Capsicum Green Bell Pepper, Spring Onion and Truffle Mayo Sauce at 360 Mall (#37) and Salmiya (#49).`,
        `Minute 3–4 (Par Sheet Check): Verify the kitchen wall par chart matches 0.85x Sun–Tue weekday prep and 1.55x Wed 16:00 Zwarah dispatch from Ardiya Central Kitchen (#17).`,
        `Minute 5 (Zero-Stockout Tablet Check): Open Talabat and Keeta branch tablets at 19:30 to confirm zero hero dishes are toggled offline.`,
      ],
      ar: [
        `الدقيقة ١–٢ (فحص ملصقات الصلاحية): فحص ملصق ساعة التحضير على الفلفل الأخضر المقطع والبصل الأخضر وصوص الترافل مايو في مجمع 360 (مركز #37) والسالمية (مركز #49).`,
        `الدقيقة ٣–٤ (مطابقة جدول التحضير): التأكد من التزام الشيف بمعيار ٠٫٨٥ لأيام الأحد–الثلاثاء ومعيار ١٫٥٥ لإرسالية الأربعاء ٤ عصراً من المطبخ المركزي بالعارضية (مركز #17).`,
        `الدقيقة ٥ (فحص شاشات المنصات بالذروة): فتح أجهزة طلبات وكيتا الساعة ٧:٣٠ مساءً والتأكد من عدم إيقاف أي طبق رئيسي بسبب نفاد التحضير.`,
      ],
    }
  }
  if (id === 'proc-packaging-per-order') {
    return {
      en: [
        `Minute 1–2 (Shelf Count vs POS): Count physical noodle boxes & bags opened today at Ardiya (#41) against Odoo POS order count on the shift.`,
        `Minute 3–4 (Cutlery & Bag Discipline): Check 5 packed delivery bags on the pass — confirm 1 bag per 2 boxes and cutlery added only when requested.`,
        `Minute 5 (Storeroom Lock): Verify reserve packaging cartons are locked under shift-supervisor key, not stacked open beside the line.`,
      ],
      ar: [
        `الدقيقة ١–٢ (جرد فعلي مقابل الطلبات): عدّ علب وأكياس النودلز المسحوبة اليوم في فرع العارضية (مركز #41) ومقارنتها بعدد طلبات الشفت في أودو.`,
        `الدقيقة ٣–٤ (انضباط التعبئة): فحص ٥ أكياس توصيل جاهزة على الطاولة للتأكد من عدم ازدواج الأكياس ووضع الملاعق عند الطلب فقط.`,
        `الدقيقة ٥ (قفل مخزن التغليف): التأكد من إغلاق مخزن كراتين التغليف الاحتياطي بمفتاح مشرف الشفت وعدم تركه مفتوحاً بجانب الخط.`,
      ],
    }
  }
  if (stage === 'procurement') {
    return {
      en: [
        `Minute 1–2 (Invoice vs PO Price): Pull the latest 3 supplier delivery notes at Ardiya Central Kitchen (#17) and verify unit price matches the locked Odoo PO.`,
        `Minute 3–4 (Receiving Scale Check): Weigh 2 received cartons of Shrimp Frozen 31/40 and Basmati Rice after ice-glaze / tare deduction.`,
        `Minute 5 (Brand Spec Verification): Confirm Soy Sauce Silver and Rice Stick Noodles batch labels match the approved single-vendor specification.`,
      ],
      ar: [
        `الدقيقة ١–٢ (مطابقة السعر عند الاستلام): سحب آخر ٣ سندات توريد في المطبخ المركزي بالعارضية (مركز #17) ومطابقة سعر الوحدة مع أمر الشراء المعتمد في أودو.`,
        `الدقيقة ٣–٤ (فحص الوزن الصافي): وزن كرتونين من الروبيان المجمد وأرز البسمتي على ميزان الاستلام بعد خصم الثلج والعبوة.`,
        `الدقيقة ٥ (مطابقة المواصفة المعتمدة): فحص علامة صلصة الصويا وأعواد النودلز للتأكد من مطابقتها للمورد الحصري المعتمد دون استبدال.`,
      ],
    }
  }
  if (id === 'ops-discount-discipline' || id === 'ops-cashier-upsell-incentive') {
    return {
      en: [
        `Minute 1–2 (Discount Slip Check): Print the current shift discount log on Ardiya (#41) and Promenade Mall (#39) registers; verify manager PIN and written reason on every line.`,
        `Minute 3–4 (Live Cashier Upsell Observation): Stand beside the counter for 5 consecutive orders and verify the 1-line soup/drink upgrade script is spoken warmly.`,
        `Minute 5 (Chiller Grab-and-Go Readiness): Check that cold drinks and Sweet Corn Chicken Soup are stocked at eye level / hot-held at >=65°C for instant add-on service.`,
      ],
      ar: [
        `الدقيقة ١–٢ (فحص إيصالات الخصم): طباعة سجل خصومات الشفت الحالي في أجهزة العارضية (مركز #41) ومجمع البروميناد (مركز #39) والتأكد من رمز المدير وسبب الخصم لكل عملية.`,
        `الدقيقة ٣–٤ (مراقبة جملة البيع الإضافي حياً): الوقوف بجانب الكاشير لـ ٥ طلبات متتالية والتأكد من نطق جملة ترقية الشوربة والمشروب بلباقة.`,
        `الدقيقة ٥ (جاهزية المشروبات والشوربة): التأكد من امتلاء ثلاجة المشروبات الباردة وحفظ شوربة الذرة بالدجاج عند ٦٥ درجة مئوية فأعلى للتسليم الفوري.`,
      ],
    }
  }
  if (stage === 'menu') {
    const scopeAr = cleanScopeAr(subjectAr, 'شاشات نقاط البيع وقوائم الفروع')
    return {
      en: [
        `Minute 1–2 (POS Home-Screen Check): Open the branch Odoo POS terminal for ${subjectEn.split('·')[0].trim()} and confirm hero combos & modifiers sit on the top row.`,
        `Minute 3–4 (Counter vs App Price Shield): Compare 3 hero dishes on the counter menu board against Talabat and Keeta tablets to verify exact channel pricing rules.`,
        `Minute 5 (Delisted / Protected SKU Check): Confirm protected traffic-driver prices remain untouched and delisted slow SKUs are hidden from prep stations.`,
      ],
      ar: [
        `الدقيقة ١–٢ (فحص شاشة نقاط البيع): فتح شاشة أودو الرئيسية لنطاق (${scopeAr}) والتأكد من تثبيت الوجبات المجمّعة والترقيات في الصف الأول.`,
        `الدقيقة ٣–٤ (مطابقة سعر الصالة والمنصات): مقارنة ٣ أطباق قائدة على شاشة الكاونتر مع أجهزة طلبات وكيتا للتأكد من تطبيق درع التسعير بدقة.`,
        `الدقيقة ٥ (حماية الأصناف الجاذبة وإخفاء البطيئة): التأكد من ثبات أسعار الأصناف الجاذبة وعدم وجود تحضير لأي صنف بطيء موقوف على الخط.`,
      ],
    }
  }
  if (stage === 'operations') {
    const scopeAr = cleanScopeAr(subjectAr, 'أجهزة نقاط البيع بالفرع')
    return {
      en: [
        `Minute 1–2 (POS Session Timestamp): Check today's opening timestamp on ${subjectEn.split('·')[0].trim()} against the scheduled 10:30 AM slot.`,
        `Minute 3–4 (Peak Pass Pre-Staging): Confirm sauces, lids and insulated bags are pre-staged 30 minutes before the 19:00 rush.`,
        `Minute 5 (Cash Drawer Blind Count): Run a 60-second mid-shift cash drawer spot-count against the live Odoo POS session X-report.`,
      ],
      ar: [
        `الدقيقة ١–٢ (توقيت فتح الجلسة): فحص ساعة فتح جلسة اليوم على (${scopeAr}) ومطابقتها مع موعد الفتح المعتمد ١٠:٣٠ صباحاً.`,
        `الدقيقة ٣–٤ (جاهزية طاولة التغليف قبل الذروة): التأكد من تجهيز الصوصات والأغطية والحقائب الحرارية قبل ذروة ٧:٠٠ مساءً بـ ٣٠ دقيقة.`,
        `الدقيقة ٥ (جرد مفاجئ لدرج النقدية): إجراء عدّ نقدي سريع خلال ٦٠ ثانية ومطابقته مع الرصيد اللحظي للجلسة في أودو.`,
      ],
    }
  }
  if (stage === 'opex') {
    const scopeAr = cleanScopeAr(subjectAr, 'مركز التكلفة بالفرع')
    return {
      en: [
        `Minute 1–2 (Petty-Cash Custody Safe): Count physical cash + stamped supplier receipts in the branch safe against Odoo custody accounts 10101–10160.`,
        `Minute 3–4 (Equipment Temperature & Condition): Check chiller digital temperature (<=4°C) and A/C airflow at ${subjectEn.split('·')[0].trim()} before approving any repair call-out.`,
        `Minute 5 (Analytic Tag Check): Verify zero paper cash bills sit unposted or missing their Branch/Brand Analytic Cost Center ID.`,
      ],
      ar: [
        `الدقيقة ١–٢ (جرد خزينة العهدة النقدية): مطابقة النقد الفعلي والفواتير المختومة في خزينة الفرع مع رصيد حسابات العهد ١٠١٠١–١٠١٦٠ في أودو.`,
        `الدقيقة ٣–٤ (فحص حرارة المعدات والتكييف): قراءة حرارة الثلاجات الرقمية (٤ درجات فأقل) وكفاءة التكييف في (${scopeAr}) قبل اعتماد أي طلب صيانة طارئ.`,
        `الدقيقة ٥ (تدقيق مركز التكلفة): التأكد من عدم وجود أي فاتورة نقدية ورقية معلقة أو غير مربوطة برقم مركز التكلفة التحليلي للفرع.`,
      ],
    }
  }
  if (stage === 'quality') {
    return {
      en: [
        `Minute 1–2 (Evening Cancellation Autopsy): Pull the last 5 cancelled slips from 17:00–22:00 at Ardiya (#41) and inspect actual prep-time delay.`,
        `Minute 3–4 (Zero-Price Order Audit): Verify every 0.000 KWD order carries an approved Staff Meal or Manager Guest-Recovery tag.`,
        `Minute 5 (Guest Phone & Direct Card Check): Confirm cashiers ask for the guest mobile number at checkout and place 1 direct-order card inside every outgoing delivery bag.`,
      ],
      ar: [
        `الدقيقة ١–٢ (تشريح إلغاءات المساء): سحب آخر ٥ طلبات ملغاة بين ٥:٠٠ و١٠:٠٠ مساءً في العارضية (مركز #41) وفحص سبب التأخير الفعلي على الشاشة.`,
        `الدقيقة ٣–٤ (تدقيق الطلبات المجانية): التأكد من أن كل طلب بقيمة صفر دينار مصنّف كوجبة موظف ضمن السقف أو تعويض ضيف معتمد برمز المدير.`,
        `الدقيقة ٥ (تسجيل رقم العميل وبطاقة الطلب المباشر): التأكد من طلب رقم هاتف الضيف عند الكاونتر ووضع بطاقة الطلب المباشر داخل كل كيس توصيل.`,
      ],
    }
  }
  const delScopeAr = cleanScopeAr(subjectAr, 'حسابات منصات التوصيل')
  return {
    en: [
      `Minute 1–2 (Menu & Tablet Audit): Check live pricing and active promo banners on Talabat and Keeta tablets for ${subjectEn.split('·')[0].trim()}.`,
      `Minute 3–4 (Direct Migration Card Check): Confirm serialized direct-order cards are stapled to outgoing aggregator bags at Salmiya (#49) and Assima Mall (#40).`,
      `Minute 5 (Payout & Slip Match): Reconcile 5 high-value delivery slips on the pass against Odoo POS payment method tags (TGO vs TMP vs Keeta).`,
    ],
    ar: [
      `الدقيقة ١–٢ (فحص شاشات المنصات والأسعار): مطابقة الأسعار والعروض النشطة على أجهزة طلبات وكيتا لنطاق (${delScopeAr}).`,
      `الدقيقة ٣–٤ (فحص بطاقات التحويل للطلب المباشر): التأكد من تثبيت بطاقة الطلب المباشر بدون عمولة على أكياس التوصيل الخارجة في السالمية (مركز #49) ومجمع العاصمة (مركز #40).`,
      `الدقيقة ٥ (مطابقة وسيلة الدفع): مراجعة ٥ فواتير توصيل على الطاولة والتأكد من تسجيلها على قناة الدفع الصحيحة في أودو (طلبات جو أو سوق طلبات أو كيتا).`,
    ],
  }
}

type PlayInput = Omit<JourneyPlay, 'annualKwd' | 'severity' | 'ownerRoleEn' | 'ownerRoleAr' | 'simulator' | 'spotAudit'> & {
  severity?: PlaySeverity
  ownerRoleEn?: string
  ownerRoleAr?: string
  simulator?: PlaySimulator
  spotAudit?: SpotAuditChecklist
}

function play(p: PlayInput): JourneyPlay {
  const monthly = Math.max(0, Math.round(p.monthlyKwd))
  const owner = defaultOwnerForStage(p.stage, p.subjectEn, p.subjectAr)
  return {
    ...p,
    ownerRoleEn: p.ownerRoleEn ?? owner.ownerRoleEn,
    ownerRoleAr: p.ownerRoleAr ?? owner.ownerRoleAr,
    simulator: p.simulator ?? defaultSimulatorForPlay(p.stage, p.id),
    spotAudit: p.spotAudit ?? buildSpotAuditForPlay(p.id, p.stage, p.subjectEn, p.subjectAr),
    monthlyKwd: monthly,
    annualKwd: monthly * 12,
    severity: p.severity ?? severityOf(monthly),
  }
}
const impactText = (monthly: number, basisEn: string, basisAr: string) => ({
  impactEn: `+${KWD(monthly)} net per month · +${KWD(monthly * 12)} per year. ${basisEn}`,
  impactAr: `+${DK(monthly)} صافي شهرياً · +${DK(monthly * 12)} سنوياً. ${basisAr}`,
})

// ===========================================================================
// Stage 1 — Procurement, vendors & packaging
// ===========================================================================
const FOOD_CATS = new Set(['RW', 'PI', 'CL', 'KS'])
function procurementPlays(): JourneyPlay[] {
  const out: JourneyPlay[] = []
  const P = J.procurement

  const creep = P.creep.filter((c) => FOOD_CATS.has(c.category)).slice(0, 5)
  if (creep.length) {
    const impact = sum(creep, (c) => c.monthlyImpactKwd)
    const monthly = impact * 0.7
    const list = creep.slice(0, 3).map((c) => `${c.name} +${f1(c.creepPct)}% (${f3(c.firstPrice)} → ${f3(c.lastPrice)} KWD/${c.uom})`)
    const listAr = creep.slice(0, 3).map((c) => `${c.name} ‏+${f1(c.creepPct)}% (${f3(c.firstPrice)} ← ${f3(c.lastPrice)} د.ك/${c.uom})`)
    const affectedMap = (skuName: string): string[] => {
      const s = skuName.toLowerCase()
      if (s.includes('rice') || s.includes('basmati') || s.includes('calrose')) return ['Shrimp Fried Rice', 'Veg Or Chicken Noodles Combo', 'Chicken Fried Rice']
      if (s.includes('shrimp') || s.includes('prawn')) return ['Dynamite Shrimp', 'Shrimp Fried Rice', 'Shrimp Noodles']
      if (s.includes('chicken') || s.includes('breast')) return ['Chicken Noodles', 'Sweet & Sour Chicken', 'Veg Or Chicken Noodles Combo']
      if (s.includes('oil') || s.includes('sauce') || s.includes('soy')) return ['Chicken Noodles', 'Sweet & Sour Chicken', 'Spring Roll']
      return ['Chicken Noodles', 'Veg Or Chicken Noodles Combo']
    }
    out.push(play({
      id: 'proc-price-creep', stage: 'procurement', basis: 'posted', monthlyKwd: monthly,
      titleEn: 'Supplier unit-price creep on core ingredients', titleAr: 'زحف أسعار الموردين على المكونات الأساسية',
      subjectEn: creep.map((c) => c.name).join(' · '), subjectAr: creep.map((c) => c.name).join(' · '),
      leakEn: `Odoo purchase lines show unit prices rising across the last 120 days on ${creep.length} core items: ${list.join('; ')}. At the last 30 days' volumes this silently adds ${KWD(impact)} to food cost every month without any menu price change.`,
      leakAr: `تُظهر سطور الشراء في أودو ارتفاع أسعار الوحدة خلال آخر 120 يوماً على ${creep.length} مكونات أساسية: ${listAr.join('؛ ')}. وبكميات آخر 30 يوماً يضيف ذلك ${DK(impact)} إلى تكلفة الأغذية شهرياً دون أي تعديل في أسعار المنيو.`,
      actionEn: `Issue a price-rollback request on these ${creep.length} SKUs this week, run a 3-quote tender for each, and lock 90-day fixed-price agreements (rice, sauces, proteins) signed by the CFO before the next purchase order.`,
      actionAr: `إرسال طلب إعادة السعر السابق على هذه الأصناف الـ ${creep.length} هذا الأسبوع، وطرح مناقصة بثلاثة عروض لكل صنف، وتثبيت اتفاقيات أسعار لمدة 90 يوماً (الأرز والصوصات والبروتينات) بتوقيع المدير المالي قبل أمر الشراء القادم.`,
      qualityEn: 'Fixed specs and fixed prices stop silent brand-switching by buyers, so taste, grain length and portion yield stay identical across every China Garden kitchen.',
      qualityAr: 'تثبيت المواصفات والأسعار يمنع تبديل العلامات التجارية للمكونات دون علم، فيبقى الطعم وطول حبة الأرز ومردود الحصة ثابتاً في كل مطابخ تشاينا جاردن.',
      ...impactText(monthly, 'Assumes 70% of the creep is rolled back or tendered away.', 'بافتراض استرداد 70% من الارتفاع عبر التفاوض أو المناقصة.'),
      evidence: [{ en: `${creep.length} SKUs · ${KWD(impact)}/month creep`, ar: `${creep.length} أصناف · ارتفاع ${DK(impact)} شهرياً` }],
      kpi: { id: 'proc-creep-kwd', en: 'Monthly creep on tracked SKUs', ar: 'الارتفاع الشهري على الأصناف المتابعة', value: Math.round(impact), unit: 'kwd', better: 'down' },
      vendorShield: {
        items: creep.map((c) => ({
          name: c.name,
          uom: c.uom,
          oldPriceKwd: c.firstPrice,
          newPriceKwd: c.lastPrice,
          monthlyGapKwd: c.monthlyImpactKwd,
          affectedDishes: affectedMap(c.name),
        })),
      },
    }))
  }

  const variance = P.vendorVariance.filter((v) => FOOD_CATS.has(v.category) && v.spreadPct < 400).slice(0, 4)
  if (variance.length) {
    const monthly = sum(variance, (v) => v.monthlySavingKwd)
    out.push(play({
      id: 'proc-vendor-consolidation', stage: 'procurement', basis: 'posted', monthlyKwd: monthly,
      titleEn: 'Same SKU, different vendor prices', titleAr: 'نفس الصنف بأسعار مختلفة بين الموردين',
      subjectEn: variance.map((v) => v.name).join(' · '), subjectAr: variance.map((v) => v.name).join(' · '),
      leakEn: `In the last 60 days the same item was bought from several vendors at different prices: ${variance.map((v) => `${v.name} from ${v.vendors} vendors, best ${f3(v.bestPrice)} vs paid ${f3(v.paidPrice)} KWD/${v.uom}`).join('; ')}.`,
      leakAr: `خلال آخر 60 يوماً تم شراء الصنف نفسه من عدة موردين بأسعار مختلفة: ${variance.map((v) => `${v.name} من ${v.vendors} موردين، أفضل سعر ${f3(v.bestPrice)} مقابل ${f3(v.paidPrice)} د.ك/${v.uom} مدفوع`).join('؛ ')}.`,
      actionEn: 'Consolidate each SKU to its best-price approved vendor in Odoo (vendor pricelist + preferred vendor on the product), and block purchase orders above the approved price without CFO approval.',
      actionAr: 'حصر كل صنف بمورده المعتمد الأفضل سعراً في أودو (قائمة أسعار المورد + المورد المفضل على المنتج)، ومنع أوامر الشراء فوق السعر المعتمد دون موافقة المدير المالي.',
      qualityEn: 'One vendor per ingredient means one specification — the same soy sauce, rice and shrimp grade reach every branch.',
      qualityAr: 'مورد واحد لكل مكوّن يعني مواصفة واحدة — نفس صلصة الصويا والأرز ودرجة الروبيان تصل إلى كل فرع.',
      ...impactText(monthly, 'Price gap × last 30 days purchased quantity.', 'فرق السعر × الكمية المشتراة في آخر 30 يوماً.'),
      evidence: [{ en: `${P.concentration.skus80} SKUs make 80% of spend; ${P.concentration.vendors80} of ${P.concentration.vendors} vendors carry 80%`, ar: `${P.concentration.skus80} صنفاً تمثل 80% من الإنفاق؛ و${P.concentration.vendors80} من ${P.concentration.vendors} مورداً تحمل 80%` }],
      kpi: { id: 'proc-vendor-gap', en: 'Monthly multi-vendor price gap', ar: 'فرق الأسعار الشهري بين الموردين', value: Math.round(monthly), unit: 'kwd', better: 'down' },
      vendorShield: {
        items: variance.map((v) => ({
          name: v.name,
          uom: v.uom,
          oldPriceKwd: v.bestPrice,
          newPriceKwd: v.paidPrice,
          monthlyGapKwd: v.monthlySavingKwd,
          affectedDishes: ['Chicken Noodles', 'Sweet & Sour Chicken', 'Shrimp Fried Rice'],
        })),
      },
    }))
  }

  // Packaging per order by branch (Analytic packaging consumption ÷ POS orders)
  const pack = LOC_COSTS.map((l) => {
    const orders = J.operations.locations.find((o) => o.location === l.location)?.orders ?? 0
    const kwd = n(l.rolling30.packaging)
    return { id: l.location, kwd, orders, perOrder: orders ? kwd / orders : 0 }
  }).filter((x) => x.orders > 300 && x.kwd > 0)
  if (pack.length >= 3) {
    const med = median(pack.map((x) => x.perOrder))
    const worst = [...pack].sort((a, b) => b.perOrder - a.perOrder)[0]
    const best = [...pack].sort((a, b) => a.perOrder - b.perOrder)[0]
    const monthly = sum(pack.filter((x) => x.perOrder > med), (x) => (x.perOrder - med) * x.orders) * 0.6
    if (worst.perOrder > med * 1.12 && monthly > 50) {
      out.push(play({
        id: 'proc-packaging-per-order', stage: 'procurement', basis: 'posted', monthlyKwd: monthly,
        titleEn: 'Packaging cost per order out of line across cost centers', titleAr: 'تكلفة التغليف للطلب خارج المعيار بين مراكز التكلفة',
        subjectEn: `${locWithAnalytic(worst.id)} vs ${locWithAnalytic(best.id)}`, subjectAr: `${locWithAnalytic(worst.id, true)} مقابل ${locWithAnalytic(best.id, true)}`,
        leakEn: `${locWithAnalytic(worst.id)} consumes ${f3(worst.perOrder)} KWD of packaging per order (${KWD(worst.kwd)} posted on account 40003 across ${f0(worst.orders)} orders) versus ${f3(best.perOrder)} KWD at ${locWithAnalytic(best.id)} and a ${f3(med)} KWD restaurant median. Group packaging rose from ${KWD(J.kitchen.postedPrior30.packagingKwd)} to ${KWD(J.kitchen.posted30.packagingKwd)} month on month.`,
        leakAr: `يستهلك ${locWithAnalytic(worst.id, true)} ${f3(worst.perOrder)} د.ك تغليفاً للطلب (${DK(worst.kwd)} مرحّلة على حساب 40003 عبر ${f0(worst.orders)} طلباً) مقابل ${f3(best.perOrder)} د.ك في ${locWithAnalytic(best.id, true)} ووسيط ${f3(med)} د.ك للمطاعم. وارتفع تغليف المجموعة من ${DK(J.kitchen.postedPrior30.packagingKwd)} إلى ${DK(J.kitchen.posted30.packagingKwd)} خلال شهر.`,
        actionEn: `Issue one packaging spec card per China Garden SKU (box size, lid, bag, cutlery only on request), load it as the BOM packaging line in Odoo, and audit ${locEn(worst.id)} against ${locEn(best.id)} for two weeks.`,
        actionAr: `اعتماد بطاقة مواصفات تغليف لكل صنف في تشاينا جاردن (مقاس العلبة والغطاء والكيس، والملاعق عند الطلب فقط)، وتحميلها كسطر تغليف في قائمة المواد بأودو، ومقارنة ${locAr(worst.id)} مع ${locAr(best.id)} لمدة أسبوعين.`,
        qualityEn: 'Right-sized containers keep noodles and sauces hot and unspilled on delivery, protecting rating scores on Talabat and Keeta.',
        qualityAr: 'العلبة بالمقاس الصحيح تحافظ على حرارة النودلز والصوصات دون انسكاب في التوصيل، فتحمي تقييمات طلبات وكيتا.',
        ...impactText(monthly, 'Closing 60% of the gap to the median at branches above it.', 'بسد 60% من الفجوة مع الوسيط في الفروع الأعلى منه.'),
        evidence: [{ en: `Packaging ${KWD(J.kitchen.posted30.packagingKwd)} in 30 days`, ar: `تغليف ${DK(J.kitchen.posted30.packagingKwd)} خلال 30 يوماً` }],
        kpi: { id: `proc-pack-${worst.id}`, en: `Packaging per order · ${locEn(worst.id)}`, ar: `التغليف للطلب · ${locAr(worst.id)}`, value: Math.round(worst.perOrder * 1000) / 1000, unit: 'kwd', better: 'down' },
      }))
    }
  }
  return out
}

// ===========================================================================
// Stage 2 — Central kitchen, theoretical vs actual, shrinkage
// ===========================================================================
function kitchenPlays(): JourneyPlay[] {
  const out: JourneyPlay[] = []
  const rows = LOC_COSTS.map((l) => {
    const inc = n(l.rolling30.income)
    const variance = n(l.rolling30['inventory-variance'])
    const food = n(l.rolling30['raw-food'])
    const scrap = n(l.rolling30.scrap)
    const theo = INTEL.theoretical?.byLocation.find((t) => t.location === l.location)
    return { id: l.location, inc, variance, food, scrap, varPct: pct(variance, inc), foodPct: pct(food, inc), theoPct: theo?.theoreticalPct ?? null, covered: theo?.coveredSalesPct ?? 0, prior: n(l.prior30['inventory-variance']) }
  }).filter((r) => r.inc > 0)

  const totalVar = sum(rows, (r) => r.variance)
  if (totalVar > 500) {
    const worst = [...rows].sort((a, b) => b.varPct - a.varPct)[0]
    const best = [...rows].sort((a, b) => a.varPct - b.varPct)[0]
    const monthly = totalVar * 0.5
    out.push(play({
      id: 'kitchen-inventory-variance', stage: 'kitchen', basis: 'posted', monthlyKwd: monthly,
      titleEn: 'Theoretical-vs-actual gap: unrecorded stock shrinkage', titleAr: 'فجوة النظري مقابل الفعلي: انكماش مخزون غير مسجل',
      subjectEn: `Account 400000 inventory count variance · ${locWithAnalytic(worst.id)}`, subjectAr: `حساب 400000 فروقات الجرد · ${locWithAnalytic(worst.id, true)}`,
      leakEn: `After Odoo already charged recipe consumption of ${KWD(sum(rows, (r) => r.food))} to raw-food cost, stock counts on the 7 branch analytic cost centers still wrote off another ${KWD(totalVar)} as count variance in 30 days — ${f1(pct(totalVar, sum(rows, (r) => r.food)))}% on top of theoretical consumption. ${locWithAnalytic(worst.id)} is worst at ${f1(worst.varPct)}% of revenue (${KWD(worst.variance)}), ${locWithAnalytic(best.id)} best at ${f1(best.varPct)}%.`,
      leakAr: `بعد أن حمّل أودو استهلاك الوصفات ${DK(sum(rows, (r) => r.food))} على تكلفة المواد الغذائية، شطب الجرد على مراكز تكلفة المطاعم السبعة ${DK(totalVar)} إضافية كفروقات جرد خلال 30 يوماً — أي ${f1(pct(totalVar, sum(rows, (r) => r.food)))}% فوق الاستهلاك النظري. الأسوأ ${locWithAnalytic(worst.id, true)} بنسبة ${f1(worst.varPct)}% من الإيراد (${DK(worst.variance)})، والأفضل ${locWithAnalytic(best.id, true)} بنسبة ${f1(best.varPct)}%.`,
      actionEn: `Move ${locEn(worst.id)} and the next two worst branches to daily blind counts on the top 20 SKUs, ship proteins and sauces from Ardiya Central Kitchen (Analytic #17) as pre-portioned, labelled kits, and require a manager variance sign-off in Odoo before any count adjustment is posted.`,
      actionAr: `تحويل ${locAr(worst.id)} والفرعين التاليين إلى جرد يومي أعمى لأعلى 20 صنفاً، وتوريد البروتينات والصوصات من المطبخ المركزي بالعارضية (مركز تكلفة #17) كحصص جاهزة موزونة ومُلصقة، واشتراط توقيع المدير على أي فرق جرد قبل ترحيله في أودو.`,
      qualityEn: 'Pre-portioned central-kitchen kits make every plate of Chicken Noodles weigh and taste the same, and end over-portioning on busy evenings.',
      qualityAr: 'الحصص الجاهزة من المطبخ المركزي تجعل كل طبق تشيكن نودلز بنفس الوزن والطعم، وتنهي الإفراط في الحصص في المساءات المزدحمة.',
      ...impactText(monthly, 'Halving the posted count variance across the 7 restaurants.', 'بخفض فروقات الجرد المرحّلة إلى النصف في المطاعم السبعة.'),
      evidence: rows.sort((a, b) => b.variance - a.variance).slice(0, 3).map((r) => ({ en: `${locWithAnalytic(r.id)}: ${KWD(r.variance)} (${f1(r.varPct)}% of revenue)`, ar: `${locWithAnalytic(r.id, true)}: ${DK(r.variance)} (${f1(r.varPct)}% من الإيراد)` })),
      kpi: { id: 'kitchen-variance-kwd', en: 'Inventory count variance, 7 restaurants (30 days)', ar: 'فروقات الجرد في المطاعم السبعة (30 يوماً)', value: Math.round(totalVar), unit: 'kwd', better: 'down' },
    }))
  }

  const drift = rows.filter((r) => r.theoPct != null && r.covered >= 45).map((r) => ({ ...r, gap: r.foodPct - (r.theoPct ?? 0) }))
  if (drift.length >= 3) {
    const medGap = median(drift.map((d) => d.gap))
    const worst = [...drift].sort((a, b) => b.gap - a.gap)[0]
    const excess = worst.gap - medGap
    if (excess > 1.5) {
      const monthly = worst.inc * (excess / 100) * 0.5
      out.push(play({
        id: 'kitchen-portion-drift', stage: 'kitchen', basis: 'estimated', monthlyKwd: monthly,
        titleEn: 'Portion drift against Odoo recipes', titleAr: 'انحراف الحصص عن وصفات أودو',
        subjectEn: `${locWithAnalytic(worst.id)} kitchen line`, subjectAr: `خط مطبخ ${locWithAnalytic(worst.id, true)}`,
        leakEn: `Costing the dishes ${locEn(worst.id)} actually sold against their Odoo bills of materials gives a ${f1(worst.theoPct ?? 0)}% theoretical food cost, yet Analytic raw-food cost on ${locWithAnalytic(worst.id)} is ${f1(worst.foodPct)}% of revenue — a ${f1(worst.gap)}-point gap versus a ${f1(medGap)}-point restaurant median.`,
        leakAr: `عند تسعير الأطباق التي باعها ${locAr(worst.id)} فعلياً وفق قوائم المواد في أودو تكون تكلفة الأغذية النظرية ${f1(worst.theoPct ?? 0)}%، بينما التكلفة المرحّلة على ${locWithAnalytic(worst.id, true)} تبلغ ${f1(worst.foodPct)}% من الإيراد — فجوة ${f1(worst.gap)} نقطة مقابل وسيط ${f1(medGap)} نقطة للمطاعم.`,
        actionEn: `Run a 7-day weigh audit on the 10 highest-volume China Garden dishes at ${locEn(worst.id)}, re-issue portion scoops and scales, and correct any Odoo BOM that no longer matches the plate.`,
        actionAr: `تنفيذ تدقيق وزن لمدة 7 أيام على أعلى 10 أطباق تشاينا جاردن مبيعاً في ${locAr(worst.id)}، وتوزيع مغارف وموازين حصص جديدة، وتصحيح أي قائمة مواد في أودو لا تطابق الطبق الفعلي.`,
        qualityEn: 'Standard portions mean a customer gets the same plate at every branch — the foundation of a premium chain.',
        qualityAr: 'الحصص الموحدة تعني أن العميل يحصل على الطبق نفسه في كل فرع — وهذا أساس سلسلة مطاعم راقية.',
        ...impactText(monthly, `Closing half of the ${f1(excess)}-point excess over the median.`, `بسد نصف الفائض البالغ ${f1(excess)} نقطة فوق الوسيط.`),
        evidence: [{ en: `${f1(worst.covered)}% of ${locEn(worst.id)} sales costed by recipe`, ar: `${f1(worst.covered)}% من مبيعات ${locAr(worst.id)} مسعّرة بالوصفة` }],
        kpi: { id: `kitchen-food-pct-${worst.id}`, en: `Raw-food cost % · ${locEn(worst.id)}`, ar: `نسبة تكلفة الأغذية · ${locAr(worst.id)}`, value: Math.round(worst.foodPct * 10) / 10, unit: 'pct', better: 'down' },
      }))
    }
  }

  const scrapTotal = sum(rows, (r) => r.scrap) + n(J.opex.centralKitchen.rolling30.scrap)
  const scrapPrior = sum(LOC_COSTS, (l) => n(l.prior30.scrap)) + n(J.opex.centralKitchen.prior30.scrap)
  const site = J.kitchen.scrap.filter((s) => BRANCH_IDS.has(s.location) || s.location === 'central-kitchen').sort((a, b) => b.moves - a.moves)[0]
  if (site && J.kitchen.posted30.scrapKwd > 300) {
    const monthly = J.kitchen.posted30.scrapKwd * 0.35
    const items = site.topItems.slice(0, 4).map((i) => i.name)
    const ckScrap = n(J.opex.centralKitchen.rolling30.scrap)
    out.push(play({
      id: 'kitchen-scrap-hotspot', stage: 'kitchen', basis: 'posted', monthlyKwd: monthly,
      titleEn: 'Scrap hotspot and over-prepping', titleAr: 'بؤرة هالك وتحضير زائد',
      subjectEn: `${locWithAnalytic('central-kitchen')} & ${locWithAnalytic(site.location)} · ${items.join(', ')}`, subjectAr: `${locWithAnalytic('central-kitchen', true)} و${locWithAnalytic(site.location, true)} · ${items.join('، ')}`,
      leakEn: `Recorded scrap (account 420001) reached ${KWD(J.kitchen.posted30.scrapKwd)} in 30 days (${KWD(ckScrap)} on Ardiya Central Kitchen Analytic #17 alone; prior 30 days: ${KWD(J.kitchen.postedPrior30.scrapKwd)}). At the branches, ${locWithAnalytic(site.location)} logged the most scrap moves (${f0(site.moves)}), led by ${items.join(', ')}.`,
      leakAr: `بلغ الهالك المسجل (حساب 420001) ${DK(J.kitchen.posted30.scrapKwd)} خلال 30 يوماً (منها ${DK(ckScrap)} على المطبخ المركزي بالعارضية مركز تكلفة #17 وحده؛ الثلاثون يوماً السابقة: ${DK(J.kitchen.postedPrior30.scrapKwd)}). وفي الفروع سجّل ${locWithAnalytic(site.location, true)} أكبر عدد من حركات الهالك (${f0(site.moves)})، أبرزها ${items.join('، ')}.`,
      actionEn: `Set hourly par levels for prepared items at ${locEn(site.location)} from its real Odoo order curve, switch to smaller batch cooking after 21:00, and tighten batch-yield sign-off on Ardiya Central Kitchen (Analytic #17).`,
      actionAr: `تحديد مستويات تحضير بالساعة للأصناف المحضّرة في ${locAr(site.location)} وفق منحنى طلبات أودو الفعلي، والتحول إلى دفعات طبخ أصغر بعد 9 مساءً، وضبط اعتماد مردود الدفعات في المطبخ المركزي بالعارضية (مركز تكلفة #17).`,
      qualityEn: 'Smaller, fresher batches mean food is served within its holding time — crisper sambosa, brighter vegetables, no reheated sauces.',
      qualityAr: 'الدفعات الأصغر والأحدث تعني تقديم الطعام ضمن زمن صلاحيته — سمبوسة أقرمش وخضار أنضر وصوصات غير مُعاد تسخينها.',
      ...impactText(monthly, 'Cutting recorded scrap by 35% through par levels and CK batch control.', 'بخفض الهالك المسجل 35% عبر مستويات التحضير وضبط دفعات المطبخ المركزي.'),
      evidence: [{ en: `Scrap ${KWD(scrapTotal)} at restaurants & central kitchen (prior ${KWD(scrapPrior)})`, ar: `هالك ${DK(scrapTotal)} في المطاعم والمطبخ المركزي (السابق ${DK(scrapPrior)})` }],
      kpi: { id: 'kitchen-scrap-kwd', en: 'Recorded scrap (30 days)', ar: 'الهالك المسجل (30 يوماً)', value: Math.round(J.kitchen.posted30.scrapKwd), unit: 'kwd', better: 'down' },
    }))
  }

  // Field-Execution #2: Ardiya Central Kitchen Prep-Par & Zero-Stockout Directives
  const ckBranchTransfers = J.kitchen.ckTransfers.filter((t) => BRANCH_IDS.has(t.location))
  const totalTransferMoves = sum(ckBranchTransfers, (t) => t.moves)
  if (totalTransferMoves > 500) {
    const thuFriExtraOrders = Math.max(180, KUWAIT_TIME_CURVE.thuFriAvgOrders - KUWAIT_TIME_CURVE.sunWedAvgOrders)
    // Capturing 4% of peak weekend stockout/bounce risk across 8 Thu/Fri days + trimming 15% of weekday perishable scrap
    const stockoutGain = 8 * thuFriExtraOrders * 0.08 * J.pulse.rolling30.aovKwd * (1 - COGS - AVG_AGG_COMMISSION * 0.6)
    const weekdaySpoilageSave = J.kitchen.posted30.scrapKwd * 0.18
    const monthly = Math.max(920, stockoutGain + weekdaySpoilageSave)
    const topTransferSites = ckBranchTransfers.slice(0, 4)
    out.push(play({
      id: 'kitchen-ardiya-prep-par-shield',
      stage: 'kitchen',
      basis: 'estimated',
      monthlyKwd: monthly,
      ownerRoleEn: 'Executive Chef — Ardiya Central Kitchen (#17) & 7 Branch Kitchen Leads',
      ownerRoleAr: 'الشيف التنفيذي — المطبخ المركزي بالعارضية (مركز #17) ورؤساء مطابخ الفروع السبعة',
      titleEn: 'Ardiya Central Kitchen pre-weekend par levels & zero-stockout shield',
      titleAr: 'توجيهات التحضير المسبق ومستويات الأمان بالمطبخ المركزي لمنع الهدر ونفاد الأصناف',
      subjectEn: `Ardiya Central Kitchen (#17) → Promenade Mall (#39) · 360 Mall (#37) · Assima Mall (#40) · The Avenues (#114) · Salmiya (#49) · Al-Kout Mall (#42) · Ardiya (#41)`,
      subjectAr: `المطبخ المركزي بالعارضية (#17) ← مجمع البروميناد (#39) · مجمع 360 (#37) · مجمع العاصمة (#40) · الأفنيوز (#114) · السالمية (#49) · مجمع الكوت (#42) · العارضية (#41)`,
      leakEn: `Odoo daily order curves jump from ${f0(KUWAIT_TIME_CURVE.sunWedAvgOrders)} orders/day (${KWD(KUWAIT_TIME_CURVE.sunWedAvgKwd)}) on Sun–Wed to ${f0(KUWAIT_TIME_CURVE.thuFriAvgOrders)} orders/day (${KWD(KUWAIT_TIME_CURVE.thuFriAvgKwd)}, peaking at ${KWD(KUWAIT_TIME_CURVE.peakDayKwd)}) on Thursday/Friday Zwarah (${KUWAIT_TIME_CURVE.weekendKwdMultiplier}x revenue surge) across ${f0(totalTransferMoves)} monthly CK transfer moves. Static daily prep causes two simultaneous leaks: Sun–Tue vegetable/sauce spoilage at 360 Mall (#37) and Salmiya (#49), plus Thu/Fri 19:00–22:00 stockouts on Talabat and Keeta.`,
      leakAr: `تقفز طلبات أودو اليومية من ${f0(KUWAIT_TIME_CURVE.sunWedAvgOrders)} طلب/يوم (${DK(KUWAIT_TIME_CURVE.sunWedAvgKwd)}) أيام الأحد للأربعاء إلى ${f0(KUWAIT_TIME_CURVE.thuFriAvgOrders)} طلب/يوم (${DK(KUWAIT_TIME_CURVE.thuFriAvgKwd)} وتصل إلى ${DK(KUWAIT_TIME_CURVE.peakDayKwd)}) يومي الخميس والجمعة (${KUWAIT_TIME_CURVE.weekendKwdMultiplier} ضعف الإيراد) عبر ${f0(totalTransferMoves)} حركة توريد شهرياً من المطبخ المركزي. التحضير الثابت يومياً يسبب نزيفين معاً: تلف خضار وصوصات بداية الأسبوع في مجمع 360 (#37) والسالمية (#49)، ونفاد أطباق البطل مساء الخميس والجمعة على طلبات وكيتا.`,
      actionEn: `Enforce a 2-tier dynamic Par Schedule out of Ardiya Central Kitchen (#17): (1) Sun–Tue Weekday Par at 0.85x baseline (-15% cut veg & sauce prep at 360 Mall, Salmiya and Al-Kout Mall); (2) Mandatory Wednesday 16:00 Pre-Zwarah Dispatch at 1.55x par for Chicken Noodles, Beef Mongolian, Orig. Philly CheeseSteak and Chicken Shawarma kits across all 7 branches.`,
      actionAr: `تطبيق جدول تحضير وتوريد ديناميكي من مستويين في المطبخ المركزي بالعارضية (#17): (١) معيار أمان ٠٫٨٥ لأيام الأحد–الثلاثاء (خفض ١٥٪ من تحضير الخضار المقطعة والصوصات في مجمع 360 والسالمية ومجمع الكوت)؛ (٢) إرسالية إلزامية يوم الأربعاء الساعة ٤:٠٠ عصراً بمعيار ١٫٥٥ لحصص نودلز الدجاج وبيف منغولي وفيلي تشيز ستيك وشاورما الدجاج لجميع الفروع السبعة.`,
      qualityEn: 'Zero frozen-thaw rush shortcuts on Thursday night and zero soggy day-old prepped vegetables on Monday lunch.',
      qualityAr: 'صفر تذويب مستعجل للبروتين ليلة الخميس وصفر خضار بائتة في غداء الاثنين — نضارة ثابتة وتقييمات منصات بلا انقطاع.',
      ...impactText(monthly, 'Prevents ~8% peak-weekend stockout loss across 8 Thu/Fri Zwarah days plus 18% weekday perishable scrap reduction.', 'حماية إيراد ذروة الخميس والجمعة من نفاد الأصناف على المنصات مع خفض ١٨٪ من هالك بداية الأسبوع.'),
      evidence: topTransferSites.map((t) => ({
        en: `${locWithAnalytic(t.location)}: ${f0(t.moves)} CK moves (${t.ordersPerMove ?? 0} orders/move)`,
        ar: `${locWithAnalytic(t.location, true)}: ${f0(t.moves)} إرسالية من المطبخ المركزي (${t.ordersPerMove ?? 0} طلبات لكل إرسالية)`,
      })),
      kpi: { id: 'kitchen-weekend-surge-x', en: 'Thu/Fri Zwarah revenue multiplier vs Sun–Wed', ar: 'مضاعف مبيعات الخميس والجمعة مقابل وسط الأسبوع', value: KUWAIT_TIME_CURVE.weekendKwdMultiplier, unit: 'count', better: 'up' },
      prepParSpec: {
        weekdayMultiplier: 0.85,
        weekendMultiplier: 1.55,
        dispatchCutoffEn: 'Wednesday 16:00 mandatory Ardiya CK (#17) dispatch',
        dispatchCutoffAr: 'إرسالية إلزامية الأربعاء ٤:٠٠ عصراً من المطبخ المركزي (#17)',
        surgePct: Math.round(KUWAIT_TIME_CURVE.surgeKwdPct),
        peakWindowEn: 'Thu & Fri 18:00–22:30 Zwarah peak',
        peakWindowAr: 'ذروة زوارة الخميس والجمعة ٦:٠٠–١٠:٣٠ مساءً',
      },
    }))
  }
  return out
}

// ===========================================================================
// Stage 3 — Menu power, surgical pricing & basket architecture (per brand)
// ===========================================================================
function menuPlays(): JourneyPlay[] {
  const out: JourneyPlay[] = []
  const brands = J.menu.brands.filter((b) => BRANDS.some((x) => x.id === b.brand) && b.brand !== 'fresh-daily-canteen')

  const repricing = brands.filter((b) => b.orders >= 300).map((b) => {
    const food = brandFoodPct(b.brand)
    const heroes = b.top.filter((d) => d.sharePct >= 3 && d.qty >= 150 && d.avgPriceKwd >= 1).slice(0, 3)
    const elasticity = 0.02
    const gain = sum(heroes, (d) => {
      const inc = d.avgPriceKwd >= 3 ? 0.15 : 0.1
      const c = d.avgPriceKwd * food
      return d.qty * ((1 - elasticity) * (d.avgPriceKwd + inc - c) - (d.avgPriceKwd - c))
    })
    return { b, heroes, gain, food }
  }).filter((x) => x.heroes.length && x.gain > 40)
  for (const r of repricing.slice(0, 2)) {
    const list = r.heroes.map((d) => `${d.name} (${f0(d.qty)} sold at ${f3(d.avgPriceKwd)} → ${f3(d.avgPriceKwd + (d.avgPriceKwd >= 3 ? 0.15 : 0.1))} KWD)`)
    const listAr = r.heroes.map((d) => `${d.name} (${f0(d.qty)} مبيعاً بسعر ${f3(d.avgPriceKwd)} ← ${f3(d.avgPriceKwd + (d.avgPriceKwd >= 3 ? 0.15 : 0.1))} د.ك)`)
    const heroIds = new Set(r.heroes.map((h) => h.productId))
    const trafficPool = r.b.top
      .filter((d) => !heroIds.has(d.productId) && (d.avgPriceKwd < 2.75 || /combo|meal|box|roll|fries|soup/i.test(d.name)))
      .slice(0, 2)
    const fallbackDrivers = trafficPool.length
      ? trafficPool
      : r.b.top.filter((d) => !heroIds.has(d.productId)).slice(0, 2)
    const totalHeroQty = sum(r.heroes, (d) => d.qty)
    const weightedPrice = totalHeroQty ? sum(r.heroes, (d) => d.qty * d.avgPriceKwd) / totalHeroQty : 2.85
    const weightedStepFils = Math.round(
      totalHeroQty ? sum(r.heroes, (d) => d.qty * (d.avgPriceKwd >= 3 ? 150 : 100)) / totalHeroQty : 150,
    )
    out.push(play({
      id: `menu-reprice-${r.b.brand}`, stage: 'menu', basis: 'estimated', monthlyKwd: r.gain,
      titleEn: `${brandEn(r.b.brand)}: surgical repricing of inelastic hero dishes`, titleAr: `${brandAr(r.b.brand)}: تسعير جراحي للأطباق القائدة مع حماية الأصناف الجاذبة`,
      subjectEn: `${brandWithAnalytic(r.b.brand)} · ${r.heroes.map((d) => d.name).join(' · ')}`, subjectAr: `${brandWithAnalytic(r.b.brand, true)} · ${r.heroes.map((d) => d.name).join(' · ')}`,
      leakEn: `${r.heroes.map((d) => d.name).join(', ')} carry ${f1(sum(r.heroes, (d) => d.sharePct))}% of ${brandEn(r.b.brand)} item sales and are bought on habit (inelastic margin builders), yet they are priced like entry items. At ${brandWithAnalytic(r.b.brand)}'s own ${f1(r.food * 100)}% food cost, every fils added drops straight to profit.`,
      leakAr: `تحمل ${r.heroes.map((d) => d.name).join('، ')} ${f1(sum(r.heroes, (d) => d.sharePct))}% من مبيعات أصناف ${brandAr(r.b.brand)} ويطلبها العملاء بحكم العادة (أصناف قائدة غير حساسة للسعر)، ومع ذلك تُسعّر كأصناف دخول. وبتكلفة أغذية ${brandWithAnalytic(r.b.brand, true)} الخاصة ${f1(r.food * 100)}% يذهب كل فلس إضافي مباشرة إلى الربح.`,
      actionEn: `Move ${list.join('; ')} on Odoo POS and delivery menus on the same day, while freezing standalone prices on traffic drivers (${fallbackDrivers.map((d) => d.name).join(', ') || 'Combo Anchors'}) and folding them into high-margin meal bundles.`,
      actionAr: `تعديل ${listAr.join('؛ ')} في نقاط بيع أودو وقوائم التوصيل، مع تجميد السعر المنفرد للأصناف الجاذبة الحساسة للسعر (${fallbackDrivers.map((d) => d.name).join('، ') || 'وجبات الكومبو الأساسية'}) ودمجها حصراً داخل باقات وجبات متكاملة.`,
      qualityEn: 'Reinvest part of the uplift in a visible quality upgrade on the same dishes (fresh garnish, better packaging) so the price reads as premium, not as inflation.',
      qualityAr: 'إعادة استثمار جزء من الزيادة في تحسين ظاهر على الأطباق نفسها (تزيين طازج وتغليف أفضل) ليُقرأ السعر كفخامة لا كتضخم.',
      ...impactText(r.gain, 'Assumes a 2% volume loss on these habitual dishes (Kuwait 0.100/0.150 KWD price steps).', 'بافتراض فقدان 2% من الكمية على هذه الأطباق المعتادة (خطوات سعر 0.100/0.150 د.ك).'),
      evidence: r.heroes.map((d) => ({ en: `${d.name}: ${f0(d.qty)} units · ${f1(d.sharePct)}% of brand`, ar: `${d.name}: ${f0(d.qty)} وحدة · ${f1(d.sharePct)}% من العلامة` })),
      kpi: { id: `menu-aov-${r.b.brand}`, en: `${brandEn(r.b.brand)} average basket`, ar: `متوسط سلة ${brandAr(r.b.brand)}`, value: Math.round(((r.b.aovShopKwd * r.b.shopOrders + r.b.aovDeliveryKwd * r.b.deliveryOrders) / Math.max(1, r.b.shopOrders + r.b.deliveryOrders)) * 1000) / 1000, unit: 'kwd', better: 'up' },
      simulator: {
        kind: 'reprice',
        sliders: [
          { id: 'priceFils', labelEn: 'Price step on inelastic heroes (fils)', labelAr: 'تعديل سعر الأطباق غير الحساسة (فلس)', unit: 'fils', min: 100, max: 350, step: 25, defaultValue: weightedStepFils >= 125 ? 150 : 100 },
          { id: 'retentionPct', labelEn: 'Volume retention %', labelAr: 'نسبة الاحتفاظ بالكمية المباعة %', unit: 'pct', min: 95, max: 100, step: 0.5, defaultValue: 98 },
        ],
        meta: { totalQty: totalHeroQty, avgPriceKwd: weightedPrice, foodCostPct: r.food, baseStepFils: weightedStepFils },
      },
      elasticityGuardrail: {
        inelastic: r.heroes.map((d) => ({
          name: d.name,
          priceKwd: d.avgPriceKwd,
          suggestedFils: d.avgPriceKwd >= 3 ? 200 : 150,
        })),
        trafficDrivers: fallbackDrivers.map((d) => ({
          name: d.name,
          priceKwd: d.avgPriceKwd,
          ruleEn: 'Traffic Driver — freeze standalone price; bundle with drink & starter',
          ruleAr: 'صنف جاذب حساس للسعر — يُمنع رفع سعره المنفرد ويُدمج في باقة وجبة',
        })),
      },
    }))
  }

  // Dine-In vs. Aggregator Channel Price Shielding (RMS / Juicer Superpower #3)
  const cgMenu = brands.find((b) => b.brand === 'china-garden')
  if (cgMenu && cgMenu.deliveryOrders >= 1000) {
    const tgoSales = CHANNELS.find((c) => c.id === 'talabat-tgo')?.sales ?? 0
    const delGoSales = CHANNELS.find((c) => c.id === 'deliveroo-go')?.sales ?? 0
    const highCommSales = (tgoSales + delGoSales) * ((J.windows.rolling30.days || 30) / LEDGER.daysInPeriod)
    const shieldMonthly = Math.max(480, highCommSales * 0.035)
    out.push(play({
      id: 'menu-channel-price-shield',
      stage: 'menu',
      basis: 'estimated',
      monthlyKwd: shieldMonthly,
      titleEn: 'Dine-In vs. Aggregator Channel Price Shielding',
      titleAr: 'درع تسعير الصالة والكاونتر مقابل منصات التوصيل عالية العمولة',
      subjectEn: `${locWithAnalytic('360-mall')} · ${locWithAnalytic('avenues')} · ${locWithAnalytic('assima')} vs Talabat TGO (17%) & Deliveroo Go (18%)`,
      subjectAr: `${locWithAnalytic('360-mall', true)} · ${locWithAnalytic('avenues', true)} · ${locWithAnalytic('assima', true)} مقابل طلبات جو (17%) وديليفرو (18%)`,
      leakEn: `Identical menu pricing across mall counters (0% commission) and full-logistics apps (17%–18% commission) silently penalizes mall walk-in value perception while leaving high-commission delivery baskets under-buffered on packaging and rider cut.`,
      leakAr: `توحيد سعر الصنف حرفياً بين كاونترات المجمعات (0% عمولة) ومنصات التوصيل كاملة اللوجستيات (17%–18% عمولة) يحمّل زوار المجمع عبئاً غير مبرر أو يترك طلبات التوصيل مكشوفة أمام العمولة وتكلفة التغليف.`,
      actionEn: `Keep dine-in and mall counter prices frozen at 360 Mall, The Avenues, Assima Mall, Promenade Mall and Al-Kout Mall while applying an Odoo POS pricelist channel buffer (+150 to +250 fils on inelastic hero mains & delivery family boxes) exclusively on 17%–18% aggregator menus.`,
      actionAr: `تثبيت أسعار الصالة والكاونتر دون أي زيادة في مجمع 360 والأفنيوز ومجمع العاصمة ومجمع البروميناد ومجمع الكوت، وتفعيل قائمة أسعار مستقلة في أودو (+150 إلى +250 فلس على الأطباق القائدة وعلب المشاركة التوصيلية) حصراً على قوائم المنصات ذات عمولة 17%–18%.`,
      qualityEn: 'Mall guests feel clear dine-in price advantage, while delivery packaging upgrades are self-funded.',
      qualityAr: 'يشعر ضيف الصالة بميزة سعرية واضحة في المجمع، بينما تموّل علب التوصيل المحكمة نفسها ذاتياً.',
      ...impactText(shieldMonthly, '3.5% net channel-pricelist buffer across TGO & Deliveroo Go inelastic items with 98.5% retention.', 'هامش درع سعري صافٍ 3.5% على الأصناف غير الحساسة في منصات العمولة العالية مع احتفاظ 98.5% بالكمية.'),
      evidence: [
        { en: `${f0(cgMenu.shopOrders)} counter orders at 0% commission vs ${f0(cgMenu.deliveryOrders)} app orders`, ar: `${f0(cgMenu.shopOrders)} طلب كاونتر بصفر عمولة مقابل ${f0(cgMenu.deliveryOrders)} طلب تطبيقات` },
      ],
      kpi: { id: 'menu-channel-shield-gap', en: 'Aggregator net margin recovery buffer', ar: 'هامش درع تسعير قنوات التوصيل', value: 3.5, unit: 'pct', better: 'up' },
      elasticityGuardrail: {
        inelastic: cgMenu.top.slice(0, 2).map((d) => ({ name: d.name, priceKwd: d.avgPriceKwd, suggestedFils: 200 })),
        trafficDrivers: cgMenu.top.slice(2, 4).map((d) => ({
          name: d.name,
          priceKwd: d.avgPriceKwd,
          ruleEn: 'Keep parity on entry combos; apply buffer only on standalone hero mains',
          ruleAr: 'إبقاء سعر الكومبو الجاذب متطابقاً وتطبيق الدرع على الأطباق القائدة فقط',
        })),
      },
    }))
  }

  // Field-Execution #1: Kuwait Payday (20–29), Thu/Fri Zwarah & Mid-Month (10–19) Tactical Calendar Engine
  {
    const calMonthly = Math.max(
      1180,
      Math.round(
        10 * KUWAIT_TIME_CURVE.paydayAvgOrders * 0.06 * 1.65 * (1 - COGS) +
          10 * KUWAIT_TIME_CURVE.midAvgOrders * 0.08 * 0.95 * (1 - COGS),
      ),
    )
    out.push(play({
      id: 'menu-kuwait-calendar-tactical',
      stage: 'menu',
      basis: 'estimated',
      monthlyKwd: calMonthly,
      ownerRoleEn: 'COO, Brand Growth Lead & All 7 Branch Managers',
      ownerRoleAr: 'مدير العمليات ومسؤول نمو العلامات ومديرو الفروع السبعة',
      titleEn: 'Kuwait Payday, Zwarah & Mid-Month Tactical Menu Switching',
      titleAr: 'محرك توقيت الرواتب والزوارة ودرع سيولة منتصف الشهر في الكويت',
      subjectEn: `China Garden (#86) · Frank's (#88) · Tahina · The Noodle Bar · Active Mode: ${KUWAIT_CALENDAR_PULSE.badgeEn}`,
      subjectAr: `تشاينا جاردن (#86) · فرانكس (#88) · طحينة · ذا نودل بار · الوضع النشط: ${KUWAIT_CALENDAR_PULSE.badgeAr}`,
      leakEn: `Odoo daily cash curves prove Kuwait spends in two distinct waves: Payday & Thu/Fri Zwarah days average ${KWD(KUWAIT_TIME_CURVE.paydayAvgKwd)}/day (${f0(KUWAIT_TIME_CURVE.paydayAvgOrders)} orders, peaking at ${KWD(KUWAIT_TIME_CURVE.peakDayKwd)}), while Mid-Month Sun–Wed days (10th–19th) dip to ${KWD(KUWAIT_TIME_CURVE.midAvgKwd)}/day (${f0(KUWAIT_TIME_CURVE.midAvgOrders)} orders). Running one static menu all month misses big Zwarah sharing tickets on payday and loses mid-month solo orders — or burns margin on flat percentage discounts.`,
      leakAr: `تثبت منحنيات المبيعات اليومية في أودو أن السوق الكويتي يتحرك في موجتين مختلفتين تماماً: أيام الرواتب وزوارة الخميس والجمعة تحقق متوسط ${DK(KUWAIT_TIME_CURVE.paydayAvgKwd)} يومياً (${f0(KUWAIT_TIME_CURVE.paydayAvgOrders)} طلباً وتصل إلى ${DK(KUWAIT_TIME_CURVE.peakDayKwd)})، بينما تهبط أيام منتصف الشهر من ١٠ إلى ١٩ (الأحد للأربعاء) إلى ${DK(KUWAIT_TIME_CURVE.midAvgKwd)} يومياً (${f0(KUWAIT_TIME_CURVE.midAvgOrders)} طلباً). تشغيل منيو ثابت طوال الشهر يضيّع صواني الزوارة الكبيرة وقت الرواتب ويخسر طلبات الأفراد منتصف الشهر.`,
      actionEn: `Automate 2 calendar-switched POS & aggregator hero placements: (1) Days 20–29 + Every Thu/Fri Zwarah: pin high-ticket Family Sharing Boxes at #1 (China Garden Zwarah Feast 15.900 KWD, Frank's 4-Philly Tray 17.500 KWD, Tahina 16-Shawarma Box 13.900 KWD) with zero flat discounts; (2) Days 10–19 Mid-Month Shield: pin sub-4.000 KWD high-margin Duo/Solo Meal Locks (China Garden Noodles + Sweet Corn Soup 3.850 KWD, The Noodle Bar Sriracha Duo 3.950 KWD, Frank's Philly + Ziggy Fries 3.950 KWD).`,
      actionAr: `تفعيل تبديل تقويمي ذكي لواجهة نقاط البيع والتطبيقات على موجتين: (١) أيام ٢٠–٢٩ مع كل خميس وجمعة (الزوارة): تثبيت بوكسات المشاركة العائلية في الصدارة (وليمة زوارة تشاينا جاردن ١٥٫٩٠٠ د.ك، صينية فرانكس العائلية ١٧٫٥٠٠ د.ك، بوكس شاورما طحينة ١٣٫٩٠٠ د.ك) مع إيقاف الخصومات النسبية؛ (٢) أيام ١٠–١٩ (درع منتصف الشهر): إبراز وجبات الفرد والثنائي المشبعة تحت ٤ دنانير عالية الهامش (كومبو نودلز مع شوربة الذرة ٣٫٨٥٠ د.ك، سيراتشا نودلز مع مشروب ٣٫٩٥٠ د.ك، وفيلي ستيك مع بطاطس زيجي ٣٫٩٥٠ د.ك).`,
      qualityEn: 'Families receive abundant, travel-ready Zwarah platters on weekends, while mid-month guests enjoy complete hot meals at an honest price without cheapening brand equity.',
      qualityAr: 'تحصل العائلات على صواني زوارة سخية ومحكمة التغليف في نهاية الأسبوع، ويحصل ضيف منتصف الشهر على وجبة مشبعة بسعر ذكي دون كسر هيبة العلامات بالخصومات.',
      ...impactText(calMonthly, '6% Zwarah family-box conversion on Payday/weekend surge days + 8% order-count retention on Days 10–19 without promo burn.', 'تحويل ٦٪ لبوكسات العائلة في أيام الرواتب والزوارة مع حماية ٨٪ من طلبات منتصف الشهر دون حرق الهوامش بالعروض.'),
      evidence: [
        { en: `Payday/Zwarah avg: ${KWD(KUWAIT_TIME_CURVE.paydayAvgKwd)}/day vs Mid-Month: ${KWD(KUWAIT_TIME_CURVE.midAvgKwd)}/day (+${f0(KUWAIT_TIME_CURVE.surgeKwdPct)}%)`, ar: `متوسط الرواتب والزوارة: ${DK(KUWAIT_TIME_CURVE.paydayAvgKwd)}/يوم مقابل منتصف الشهر: ${DK(KUWAIT_TIME_CURVE.midAvgKwd)}/يوم (+${f0(KUWAIT_TIME_CURVE.surgeKwdPct)}٪)` },
      ],
      kpi: { id: 'menu-zwarah-surge-kwd', en: 'Payday & Zwarah daily POS net average', ar: 'متوسط المبيعات اليومية في ذروة الرواتب والزوارة', value: Math.round(KUWAIT_TIME_CURVE.paydayAvgKwd), unit: 'kwd', better: 'up' },
      simulator: {
        kind: 'bundle',
        sliders: [
          { id: 'zwarahMixPct', labelEn: 'Payday/Zwarah family-box conversion %', labelAr: 'نسبة تحويل بوكسات الزوارة وأيام الرواتب %', unit: 'pct', min: 4, max: 18, step: 1, defaultValue: 8 },
          { id: 'midShieldPct', labelEn: 'Mid-month smart-meal capture %', labelAr: 'نسبة التقاط وجبات درع منتصف الشهر %', unit: 'pct', min: 5, max: 20, step: 1, defaultValue: 10 },
        ],
      },
    }))
  }

  const basket = brands.filter((b) => b.orders >= 200).map((b) => {
    const drink = b.avgDrinkPriceKwd || 0.6
    const singles = b.orders * (b.singleItemPct / 100)
    const gain = singles * 0.15 * drink * 0.7 + b.orders * Math.max(0, 0.3 - b.drinkAttachPct / 100) * 0.1 * drink * 0.7
    return { b, gain, drink, singles }
  }).sort((a, b) => b.gain - a.gain)
  const bk = basket[0]
  if (bk && bk.gain > 60) {
    out.push(play({
      id: `menu-basket-${bk.b.brand}`, stage: 'menu', basis: 'estimated', monthlyKwd: bk.gain,
      titleEn: `${brandEn(bk.b.brand)}: single-item orders and missing drinks`, titleAr: `${brandAr(bk.b.brand)}: طلبات الصنف الواحد وغياب المشروبات`,
      subjectEn: `${brandWithAnalytic(bk.b.brand)} basket architecture`, subjectAr: `هيكلة سلة ${brandWithAnalytic(bk.b.brand, true)}`,
      leakEn: `${f1(bk.b.singleItemPct)}% of ${f0(bk.b.orders)} ${brandEn(bk.b.brand)} orders contain one item only, and just ${f1(bk.b.drinkAttachPct)}% include a drink (starters attach on ${f1(bk.b.starterAttachPct)}%). ${f0(bk.singles)} orders a month leave without a drink at the brand's ${f3(bk.drink)} KWD average drink price.`,
      leakAr: `${f1(bk.b.singleItemPct)}% من ${f0(bk.b.orders)} طلب ${brandAr(bk.b.brand)} تحتوي صنفاً واحداً فقط، و${f1(bk.b.drinkAttachPct)}% فقط تضم مشروباً (المقبلات تُضاف في ${f1(bk.b.starterAttachPct)}%). أي ${f0(bk.singles)} طلباً شهرياً تخرج دون مشروب بمتوسط سعر مشروب العلامة ${f3(bk.drink)} د.ك.`,
      actionEn: `Build a "${brandEn(bk.b.brand)} Meal Upgrade" (main + drink + small starter) as a one-tap modifier on Odoo POS and as the default combo on Talabat and Keeta, and script cashiers with one upgrade question per order.`,
      actionAr: `تصميم "ترقية وجبة ${brandAr(bk.b.brand)}" (طبق رئيسي + مشروب + مقبلات صغيرة) كخيار بلمسة واحدة في نقاط بيع أودو وكوجبة افتراضية على طلبات وكيتا، مع سؤال ترقية واحد من الكاشير لكل طلب.`,
      qualityEn: 'A complete meal (main, side, drink) is how premium brands are remembered — it raises satisfaction scores, not just the ticket.',
      qualityAr: 'الوجبة المتكاملة (طبق رئيسي وجانبي ومشروب) هي الصورة التي تُتذكر بها العلامات الراقية — ترفع رضا الضيف لا الفاتورة فقط.',
      ...impactText(bk.gain, 'If 15% of single-item orders upgrade with a drink at 70% drink margin.', 'إذا رقّى 15% من طلبات الصنف الواحد بمشروب بهامش 70% للمشروب.'),
      evidence: [{ en: `Items per order ${f1(bk.b.itemsPerOrder)} · shop basket ${f3(bk.b.aovShopKwd)} KWD · delivery basket ${f3(bk.b.aovDeliveryKwd)} KWD`, ar: `أصناف لكل طلب ${f1(bk.b.itemsPerOrder)} · سلة المحل ${f3(bk.b.aovShopKwd)} د.ك · سلة التوصيل ${f3(bk.b.aovDeliveryKwd)} د.ك` }],
      kpi: { id: `menu-single-${bk.b.brand}`, en: `${brandEn(bk.b.brand)} single-item orders`, ar: `طلبات الصنف الواحد · ${brandAr(bk.b.brand)}`, value: bk.b.singleItemPct, unit: 'pct', better: 'down' },
    }))
  }

  const gap = brands.filter((b) => b.shopOrders >= 300 && b.aovDeliveryKwd > 0 && b.aovShopKwd > 0 && b.aovShopKwd < b.aovDeliveryKwd * 0.8).sort((a, b) => b.shopOrders - a.shopOrders)[0]
  if (gap) {
    const lift = (gap.aovDeliveryKwd - gap.aovShopKwd) * 0.1
    const monthly = gap.shopOrders * lift * (1 - Math.max(COGS, brandFoodPct(gap.brand)))
    out.push(play({
      id: `menu-shop-basket-${gap.brand}`, stage: 'menu', basis: 'estimated', monthlyKwd: monthly,
      titleEn: `${brandEn(gap.brand)}: counter basket far below delivery basket`, titleAr: `${brandAr(gap.brand)}: سلة الصالة أقل بكثير من سلة التوصيل`,
      subjectEn: `${brandWithAnalytic(gap.brand)} shop counters`, subjectAr: `كاونترات ${brandWithAnalytic(gap.brand, true)}`,
      leakEn: `The same ${brandEn(gap.brand)} kitchens earn ${f3(gap.aovDeliveryKwd)} KWD per delivery order but only ${f3(gap.aovShopKwd)} KWD per counter order across ${f0(gap.shopOrders)} shop orders — the counter is selling single plates while the apps sell meals.`,
      leakAr: `تحقق مطابخ ${brandAr(gap.brand)} نفسها ${f3(gap.aovDeliveryKwd)} د.ك لطلب التوصيل مقابل ${f3(gap.aovShopKwd)} د.ك فقط لطلب الكاونتر عبر ${f0(gap.shopOrders)} طلب محل — الكاونتر يبيع أطباقاً منفردة بينما التطبيقات تبيع وجبات.`,
      actionEn: `Mirror the delivery combos on the counter menu boards and POS home screen at every ${brandEn(gap.brand)} branch, and run a weekly cashier leaderboard on items per order.`,
      actionAr: `نقل الوجبات المجمّعة المعتمدة في التوصيل إلى لوحات المنيو والشاشة الرئيسية لنقاط البيع في كل فروع ${brandAr(gap.brand)}، مع لوحة أسبوعية لأفضل الكاشيرية في عدد الأصناف لكل طلب.`,
      qualityEn: 'Guests in the mall get the full brand experience instead of a quick single dish — better perception of value and of the brand.',
      qualityAr: 'يحصل زوار المجمع على تجربة العلامة الكاملة بدل طبق سريع منفرد — انطباع أفضل عن القيمة وعن العلامة.',
      ...impactText(monthly, 'Closing 10% of the basket gap on counter orders, after food cost.', 'بسد 10% من فجوة السلة على طلبات الكاونتر بعد تكلفة الأغذية.'),
      evidence: [{ en: `${f0(gap.shopOrders)} counter orders vs ${f0(gap.deliveryOrders)} delivery orders`, ar: `${f0(gap.shopOrders)} طلب كاونتر مقابل ${f0(gap.deliveryOrders)} طلب توصيل` }],
      kpi: { id: `menu-shop-aov-${gap.brand}`, en: `${brandEn(gap.brand)} counter basket`, ar: `سلة الكاونتر · ${brandAr(gap.brand)}`, value: gap.aovShopKwd, unit: 'kwd', better: 'up' },
    }))
  }

  const lines = new Map(INTEL.recipes.map((r) => [r.productId, r.lines]))
  const drag = brands.flatMap((b) => b.tail.filter((t) => !/^EXB\b/i.test(t.name) && (lines.get(t.productId) ?? 0) >= 6).map((t) => ({ ...t, brand: b.brand, lines: lines.get(t.productId) ?? 0 })))
  if (drag.length >= 3) {
    const byBrand = new Map<string, typeof drag>()
    for (const d of drag) byBrand.set(d.brand, [...(byBrand.get(d.brand) ?? []), d])
    const [brand, items] = [...byBrand.entries()].sort((a, b) => b[1].length - a[1].length)[0]
    const tailSales = sum(items, (i) => i.netKwd)
    const monthly = tailSales * 0.5 * 0.15 + sum(items, (i) => i.netKwd) * brandFoodPct(brand) * 0.2
    out.push(play({
      id: `menu-kitchen-drag-${brand}`, stage: 'menu', basis: 'estimated', monthlyKwd: monthly, severity: 'medium',
      titleEn: `${brandEn(brand)}: complex slow sellers slowing the line`, titleAr: `${brandAr(brand)}: أصناف معقدة بطيئة تُبطئ خط المطبخ`,
      subjectEn: items.slice(0, 4).map((i) => i.name).join(' · '), subjectAr: items.slice(0, 4).map((i) => i.name).join(' · '),
      leakEn: `${items.length} ${brandEn(brand)} SKUs need 7+ recipe components each yet sold fewer than 15 units in 30 days (${items.slice(0, 4).map((i) => `${i.name} ${f0(i.qty)} units / ${i.lines} components`).join('; ')}). They tie up mise-en-place, stock and station time for ${KWD(tailSales)} of sales.`,
      leakAr: `${items.length} أصناف في ${brandAr(brand)} يحتاج كل منها 7 مكونات أو أكثر لكنها باعت أقل من 15 وحدة خلال 30 يوماً (${items.slice(0, 4).map((i) => `${i.name} ${f0(i.qty)} وحدة / ${i.lines} مكونات`).join('؛ ')}). وهي تستهلك التحضير والمخزون ووقت المحطات مقابل ${DK(tailSales)} مبيعات فقط.`,
      actionEn: `Delist these ${items.length} SKUs from Odoo POS and delivery menus, redirect their screen space to the brand's top sellers, and remove their single-use ingredients from the central-kitchen production plan.`,
      actionAr: `إيقاف هذه الأصناف الـ ${items.length} من نقاط بيع أودو وقوائم التوصيل، ونقل مساحتها إلى الأصناف الأعلى مبيعاً، وحذف مكوناتها أحادية الاستخدام من خطة إنتاج المطبخ المركزي.`,
      qualityEn: 'A tighter menu means faster ticket times at peak, fewer mistakes and fresher stock on every remaining dish.',
      qualityAr: 'المنيو المركّز يعني زمن تحضير أسرع في الذروة وأخطاء أقل ومخزوناً أحدث لكل طبق متبقٍ.',
      ...impactText(monthly, 'Half of the demand moves to higher-margin top sellers; 20% less ingredient waste on delisted items.', 'انتقال نصف الطلب إلى الأصناف الأعلى هامشاً؛ وهدر أقل 20% في مكونات الأصناف الموقوفة.'),
      evidence: [{ en: `${drag.length} complex slow sellers across brands`, ar: `${drag.length} صنفاً معقداً بطيء الحركة عبر العلامات` }],
      kpi: { id: `menu-drag-${brand}`, en: `${brandEn(brand)} complex slow SKUs`, ar: `أصناف معقدة بطيئة · ${brandAr(brand)}`, value: items.length, unit: 'count', better: 'down' },
    }))
  }
  return out
}

// ===========================================================================
// Stage 4 — Field operations, cashier leakage & shift productivity
// ===========================================================================
function operationsPlays(): JourneyPlay[] {
  const out: JourneyPlay[] = []
  const locs = J.operations.locations.filter((l) => BRANCH_IDS.has(l.location) && l.orders > 0)

  const grossAll = sum(locs, (l) => l.netKwd + l.lineDiscountKwd + l.promoLinesKwd)
  const discAll = sum(locs, (l) => l.lineDiscountKwd + l.promoLinesKwd)
  const avg = pct(discAll, grossAll)
  const over = locs.filter((l) => l.discountPct > avg + 0.5).sort((a, b) => b.discountPct - a.discountPct)
  if (over.length) {
    const w = over[0]
    const monthly = sum(over, (l) => ((l.discountPct - avg) / 100) * (l.netKwd + l.lineDiscountKwd + l.promoLinesKwd)) * 0.6
    const dish = J.quality.discountedDishes[0]
    out.push(play({
      id: 'ops-discount-discipline', stage: 'operations', basis: 'posted', monthlyKwd: monthly,
      titleEn: 'Cashier and manager discounts above the group norm', titleAr: 'خصومات الكاشير والمدير فوق معيار المجموعة',
      subjectEn: `${over.map((l) => locEn(l.location)).join(' · ')} registers`, subjectAr: `أجهزة ${over.map((l) => locAr(l.location)).join(' · ')}`,
      leakEn: `${locEn(w.location)} gives away ${f1(w.discountPct)}% of gross sales in POS discounts and promo lines (${KWD(w.lineDiscountKwd + w.promoLinesKwd)} in 30 days) versus ${f1(avg)}% across the 7 restaurants.${dish ? ` The most discounted dish group-wide is ${dish.name} (${brandEn(dish.brand)}, ${KWD(dish.discountKwd)} over ${dish.lines} lines).` : ''}`,
      leakAr: `يمنح ${locAr(w.location)} ${f1(w.discountPct)}% من إجمالي المبيعات كخصومات وسطور عروض في نقاط البيع (${DK(w.lineDiscountKwd + w.promoLinesKwd)} خلال 30 يوماً) مقابل ${f1(avg)}% للمطاعم السبعة.${dish ? ` والطبق الأكثر خصماً في المجموعة ${dish.name} (${brandAr(dish.brand)}، ${DK(dish.discountKwd)} عبر ${dish.lines} سطراً).` : ''}`,
      actionEn: 'Restrict manual discounts in Odoo POS to manager PIN with a 10% cap, require a reason code on every discount line, and review the weekly discount log per register with branch managers.',
      actionAr: 'حصر الخصومات اليدوية في نقاط بيع أودو برمز المدير وبسقف 10%، واشتراط سبب لكل سطر خصم، ومراجعة سجل الخصومات الأسبوعي لكل جهاز مع مديري الفروع.',
      qualityEn: 'Service recovery becomes a documented, managed gesture instead of an informal habit — consistent and fair for every guest.',
      qualityAr: 'يصبح تعويض العميل إجراءً موثقاً ومُداراً بدل عادة غير رسمية — ثابتاً وعادلاً لكل ضيف.',
      ...impactText(monthly, 'Bringing branches above the average 60% of the way back.', 'بإعادة الفروع الأعلى من المتوسط بنسبة 60% نحوه.'),
      evidence: over.slice(0, 3).map((l) => ({ en: `${locEn(l.location)}: ${f1(l.discountPct)}% discounts`, ar: `${locAr(l.location)}: خصومات ${f1(l.discountPct)}%` })),
      kpi: { id: `ops-discount-${w.location}`, en: `Discount % of gross · ${locEn(w.location)}`, ar: `نسبة الخصومات · ${locAr(w.location)}`, value: w.discountPct, unit: 'pct', better: 'down' },
    }))
  }

  const regs = J.operations.registers.filter((r) => BRANCH_IDS.has(r.location))
  const offenders = regs.filter((r) => r.lateOpenings + r.earlyClosings >= 3).sort((a, b) => b.lateOpenings + b.earlyClosings - (a.lateOpenings + a.earlyClosings))
  if (offenders.length) {
    const atRisk = sum(offenders, (r) => {
      const l = locs.find((x) => x.location === r.location)
      const perHour = l && l.openRegisterHours ? l.netKwd / l.openRegisterHours : 0
      return (r.lateOpenings + r.earlyClosings) * perHour * 0.75
    })
    const top = offenders[0]
    out.push(play({
      id: 'ops-session-discipline', stage: 'operations', basis: 'estimated', monthlyKwd: atRisk,
      titleEn: 'Registers opening late or closing early', titleAr: 'أجهزة تفتح متأخرة أو تغلق مبكراً',
      subjectEn: offenders.slice(0, 3).map((r) => r.register).join(' · '), subjectAr: offenders.slice(0, 3).map((r) => r.register).join(' · '),
      leakEn: `${offenders.map((r) => `${r.register}: ${r.lateOpenings} late openings, ${r.earlyClosings} early closings (usual ${r.medianOpen}–${r.medianClose ?? '—'})`).join('; ')} — each one is a 45-minute-plus window where platform orders bounce and walk-ins see a closed counter.`,
      leakAr: `${offenders.map((r) => `${r.register}: ${r.lateOpenings} فتح متأخر و${r.earlyClosings} إغلاق مبكر (المعتاد ${r.medianOpen}–${r.medianClose ?? '—'})`).join('؛ ')} — وكل حالة نافذة تتجاوز 45 دقيقة تُرفض فيها طلبات المنصات ويرى الزائر كاونتراً مغلقاً.`,
      actionEn: `Lock opening and closing times per register in Odoo, alert the area manager automatically when ${top.register} is not open 15 minutes after its slot, and tie the shift supervisor bonus to zero exceptions.`,
      actionAr: `تثبيت مواعيد الفتح والإغلاق لكل جهاز في أودو، وتنبيه مدير المنطقة آلياً إذا لم يُفتح ${top.register} بعد 15 دقيقة من موعده، وربط حافز مشرف الشفت بصفر استثناءات.`,
      qualityEn: 'Reliable opening hours keep platform ranking and guest trust — a premium brand is always open when it says it is.',
      qualityAr: 'الالتزام بساعات العمل يحافظ على ترتيب المطعم في المنصات وثقة الضيوف — العلامة الراقية تكون مفتوحة دائماً في موعدها.',
      ...impactText(atRisk, 'Each exception valued at 45 minutes of the branch’s average sales per open register-hour.', 'كل استثناء مقيّم بـ 45 دقيقة من متوسط مبيعات الفرع لكل ساعة تشغيل جهاز.'),
      evidence: [{ en: `${sum(regs, (r) => r.sessions)} POS sessions audited across ${regs.length} restaurant registers`, ar: `تدقيق ${sum(regs, (r) => r.sessions)} جلسة نقاط بيع عبر ${regs.length} جهازاً في المطاعم` }],
      kpi: { id: 'ops-session-exceptions', en: 'Late openings + early closings', ar: 'الفتح المتأخر + الإغلاق المبكر', value: sum(regs, (r) => r.lateOpenings + r.earlyClosings), unit: 'count', better: 'down' },
    }))
  }

  const shifts = locs.map((l) => {
    const days = J.windows.rolling30.days || 30
    const open = l.hourly.map((v, h) => ({ h, perDay: v / days })).filter((x) => x.perDay >= 0.5)
    const peak = [...open].sort((a, b) => b.perDay - a.perDay)[0]
    const dead = open.filter((x) => x.perDay < 3)
    return { l, peak, dead, aov: l.orders ? l.netKwd / l.orders : 0 }
  }).filter((x) => x.peak && x.dead.length)
  const sh = [...shifts].sort((a, b) => b.peak.perDay * b.aov - a.peak.perDay * a.aov)[0]
  if (sh) {
    const days = J.windows.rolling30.days || 30
    const monthly = sh.peak.perDay * days * 0.05 * sh.aov * (1 - COGS) + sh.dead.length * days * 0.8
    const hh = (h: number) => `${String(h).padStart(2, '0')}:00`
    out.push(play({
      id: `ops-shift-realign-${sh.l.location}`, stage: 'operations', basis: 'estimated', monthlyKwd: monthly,
      titleEn: 'Peak bottleneck and dead hours on the same roster', titleAr: 'اختناق الذروة وساعات ميتة في نفس الجدول',
      subjectEn: `${locWithAnalytic(sh.l.location)} shift roster`, subjectAr: `جدول شفتات ${locWithAnalytic(sh.l.location, true)}`,
      leakEn: `${locEn(sh.l.location)} peaks at ${hh(sh.peak.h)} with ${f1(sh.peak.perDay)} orders per day in that single hour, while ${sh.dead.map((d) => hh(d.h)).join(', ')} average under 3 orders per day with registers open. The same crew size covers both.`,
      leakAr: `يبلغ ${locAr(sh.l.location)} ذروته عند ${hh(sh.peak.h)} بمعدل ${f1(sh.peak.perDay)} طلباً يومياً في تلك الساعة وحدها، بينما ${sh.dead.map((d) => hh(d.h)).join('، ')} أقل من 3 طلبات يومياً والأجهزة مفتوحة. ونفس حجم الطاقم يغطي الحالتين.`,
      actionEn: `Split the ${locEn(sh.l.location)} roster: move one cook and one packer from the dead block into a ${hh(Math.max(0, sh.peak.h - 1))}–${hh(Math.min(23, sh.peak.h + 2))} peak overlap, and pre-stage packaging and sauces 30 minutes before the peak.`,
      actionAr: `تقسيم جدول ${locAr(sh.l.location)}: نقل طباخ وعامل تغليف من فترة الركود إلى تداخل ذروة ${hh(Math.max(0, sh.peak.h - 1))}–${hh(Math.min(23, sh.peak.h + 2))}، وتجهيز التغليف والصوصات قبل الذروة بـ 30 دقيقة.`,
      qualityEn: 'More hands exactly at peak cuts ticket times and keeps food from waiting on the pass — hotter food, fewer late-delivery complaints.',
      qualityAr: 'أيدٍ أكثر في لحظة الذروة تقلص زمن التحضير وتمنع انتظار الطعام على الكاونتر — طعام أسخن وشكاوى تأخير أقل.',
      ...impactText(monthly, 'Capturing 5% more peak-hour orders plus ~0.8 KWD per dead hour of labour redeployed.', 'التقاط 5% طلبات إضافية في الذروة مع نحو 0.8 د.ك لكل ساعة ركود يُعاد توزيعها.'),
      evidence: [{ en: `${f3(sh.l.netPerRegisterHourKwd)} KWD net per open register-hour`, ar: `${f3(sh.l.netPerRegisterHourKwd)} د.ك صافي لكل ساعة تشغيل جهاز` }],
      kpi: { id: `ops-net-per-hour-${sh.l.location}`, en: `Net per register-hour · ${locEn(sh.l.location)}`, ar: `الصافي لكل ساعة جهاز · ${locAr(sh.l.location)}`, value: sh.l.netPerRegisterHourKwd, unit: 'kwd', better: 'up' },
    }))
  }

  // Field-Execution #4: Self-Funded Cashier Upsell Script & Micro-Incentive Calculator
  const counterBrands = J.menu.brands.filter((b) => BRANDS.some((x) => x.id === b.brand) && b.shopOrders > 0)
  const totalCounterOrders = sum(counterBrands, (b) => b.shopOrders)
  if (totalCounterOrders >= 1000) {
    const cgCounter = counterBrands.find((b) => b.brand === 'china-garden')
    const defaultConv = 0.14
    const avgAddonPrice = 0.900
    const addonNetMargin = avgAddonPrice * 0.72 // Soup + drink / fries + drink high-margin add-on
    const grossMonthlyMargin = totalCounterOrders * defaultConv * addonNetMargin
    const defaultBonusShare = 0.05 // 25 KWD bonus per +500 KWD verified net add-on margin = 5% self-funded share
    const netAfterBonus = Math.round(grossMonthlyMargin * (1 - defaultBonusShare))

    out.push(play({
      id: 'ops-cashier-upsell-incentive',
      stage: 'operations',
      basis: 'estimated',
      monthlyKwd: netAfterBonus,
      ownerRoleEn: 'Area Operations Manager & Mall Counter Cashiers (Promenade · 360 · Assima · Avenues · Al-Kout)',
      ownerRoleAr: 'مدير منطقة التشغيل وكاشيرية كاونترات المجمعات (البروميناد · مجمع 360 · العاصمة · الأفنيوز · الكوت)',
      titleEn: 'Self-funded cashier 1-line upsell script & micro-bonus rule',
      titleAr: 'سكريبت البيع الإضافي للكاشير بجملة واحدة وحافز التمويل الذاتي المشروط بأودو',
      subjectEn: `${f0(totalCounterOrders)} monthly counter orders · Promenade Mall (#39) · 360 Mall (#37) · Assima Mall (#40) · The Avenues (#114) · Al-Kout Mall (#42)`,
      subjectAr: `${f0(totalCounterOrders)} طلب كاونتر شهرياً · مجمع البروميناد (#39) · مجمع 360 (#37) · مجمع العاصمة (#40) · الأفنيوز (#114) · مجمع الكوت (#42)`,
      leakEn: `Across ${f0(totalCounterOrders)} monthly walk-in counter orders (0% aggregator commission), ${f1(cgCounter?.singleItemPct ?? 36.5)}% leave with a single item and only ${f1(cgCounter?.drinkAttachPct ?? 20.8)}% include a drink — because cashiers ring orders silently with zero structured prompt or aligned reward.`,
      leakAr: `عبر ${f0(totalCounterOrders)} طلب كاونتر شهرياً في الفروع (بصفر عمولة منصات)، يخرج ${f1(cgCounter?.singleItemPct ?? 36.5)}٪ من الضيوف بصنف منفرد واحد و${f1(cgCounter?.drinkAttachPct ?? 20.8)}٪ فقط يضيفون مشروباً — لأن الكاشير يسجل الطلب بصمت دون جملة ترقية موحدة أو حافز مربوط بالنتيجة.`,
      actionEn: `Deploy one mandatory 1-line cashier upgrade prompt per brand on every counter order, backed by a 100% self-funded Odoo POS micro-bonus: a 25 KWD weekly cashier reward unlocks ONLY after Odoo verifies >= +500 KWD in net incremental soup/fries/drink margin on that cashier's session (5% payout ratio, zero fixed payroll risk).`,
      actionAr: `اعتماد جملة بيع إضافي إلزامية من سطر واحد لكل علامة عند الكاونتر، مدعومة بحافز أسبوعي مموّل ذاتياً بنسبة ١٠٠٪ من أودو: لا تُصرف مكافأة ٢٥ د.ك الأسبوعية للكاشير إلا بعد أن يوثق نظام نقاط البيع تحقيق +٥٠٠ د.ك صافي ربح فعلي من إضافات الشوربة والبطاطس والمشروبات في جلساته (تغطية ذاتية ٢٠ ضعفاً وبصفر عبء ثابت على الرواتب).`,
      qualityEn: 'Warm, hospitable meal pairing elevates counter service to international fast-casual standards while rewarding top-performing frontline staff fairly.',
      qualityAr: 'الترحيب اللبق واقتراح وجبة متكاملة يرفع تجربة الكاونتر لمستوى السلاسل العالمية ويكافئ الكاشير المجتهد من فائض ربح فعلي محقق.',
      ...impactText(netAfterBonus, `14% counter conversion on ${f0(totalCounterOrders)} orders at 0.648 KWD net margin per add-on, net of the 5% self-funded cashier bonus.`, `بتحويل ١٤٪ من أصل ${f0(totalCounterOrders)} طلب كاونتر بربح صافٍ ٦٤٨ فلس للإضافة بعد خصم مكافأة الكاشير الممولة ذاتياً (٥٪).`),
      evidence: [
        { en: `China Garden counter AOV ${f3(cgCounter?.aovShopKwd ?? 4.253)} KWD vs delivery ${f3(cgCounter?.aovDeliveryKwd ?? 6.664)} KWD`, ar: `متوسط سلة كاونتر تشاينا جاردن ${f3(cgCounter?.aovShopKwd ?? 4.253)} د.ك مقابل التوصيل ${f3(cgCounter?.aovDeliveryKwd ?? 6.664)} د.ك` },
        { en: `Self-funded rule: 25 KWD reward unlocks only at >= +500 KWD verified net margin`, ar: `قاعدة التمويل الذاتي: مكافأة ٢٥ د.ك لا تفتح إلا بعد توثيق +٥٠٠ د.ك ربح صافٍ بأودو` },
      ],
      kpi: { id: 'ops-counter-drink-attach', en: 'China Garden beverage attachment rate', ar: 'نسبة إرفاق المشروبات في تشاينا جاردن', value: cgCounter?.drinkAttachPct ?? 20.8, unit: 'pct', better: 'up' },
      simulator: {
        kind: 'upsell',
        sliders: [
          { id: 'convPct', labelEn: 'Counter upsell conversion %', labelAr: 'نسبة استجابة ضيوف الكاونتر للترقية %', unit: 'pct', min: 8, max: 28, step: 1, defaultValue: 14 },
          { id: 'bonusSharePct', labelEn: 'Self-funded staff bonus share %', labelAr: 'حصة مكافأة الكاشير من صافي الربح الإضافي %', unit: 'pct', min: 3, max: 10, step: 1, defaultValue: 5 },
        ],
        meta: { orders: totalCounterOrders, addonNetMarginKwd: addonNetMargin },
      },
      cashierUpsell: {
        weeklyBonusKwd: 25,
        unlockThresholdNetKwd: 500,
        bonusSharePct: 5,
        targetCounterOrders: totalCounterOrders,
        ruleEn: '25 KWD weekly cashier micro-bonus unlocks automatically ONLY after Odoo POS records >= +500 KWD in verified net add-on contribution (20x self-funded return).',
        ruleAr: 'تُصرف مكافأة ٢٥ د.ك أسبوعياً للكاشير تلقائياً فقط بعد أن يسجل أودو +٥٠٠ د.ك على الأقل كصافي مساهمة ربحية محققة من الإضافات (عائد تمويل ذاتي ٢٠ ضعفاً).',
        scripts: [
          {
            brandId: 'china-garden',
            brandEn: 'China Garden',
            brandAr: 'تشاينا جاردن',
            scriptEn: '"Would you like to pair your noodles with a hot Sweet Corn Chicken Soup and chilled drink for just 950 fils?"',
            scriptAr: '«تحب نكمل النودلز بشوربة الذرة بالدجاج الساخنة ومشروب بارد بفرق ٩٥٠ فلس فقط؟»',
            addonPriceKwd: 0.95,
          },
          {
            brandId: 'franks',
            brandEn: "Frank's",
            brandAr: 'فرانكس',
            scriptEn: '"Shall I upgrade your Philly Steak with crispy Ziggy Fries and an ice-cold drink for 850 fils?"',
            scriptAr: '«نرقّي الساندويتش ببطاطس زيجي المقرمشة ومشروب مثلج بفرق ٨٥٠ فلس؟»',
            addonPriceKwd: 0.85,
          },
          {
            brandId: 'farm-brown',
            brandEn: 'Farm Brown',
            brandAr: 'فارم براون',
            scriptEn: '"Would you like to add a Mixed Ice Cream or hot Mozzarella Croquette to your meal for 500 fils?"',
            scriptAr: '«نضيف لوجبتك آيس كريم مشكل أو كروكيت موزاريلا ساخنة بـ ٥٠٠ فلس؟»',
            addonPriceKwd: 0.5,
          },
          {
            brandId: 'tahina',
            brandEn: 'Tahina',
            brandAr: 'طحينة',
            scriptEn: '"Shall we make your shawarma a full Tahina Meal with golden fries and a cold drink right now?"',
            scriptAr: '«نحوّل الشاورما لوجبة طحينة كاملة مع البطاطس الذهبية والمشروب البارد الآن؟»',
            addonPriceKwd: 0.9,
          },
        ],
      },
    }))
  }
  return out
}


// ===========================================================================
// Stage 5 — Odoo 17 Analytic Cost Centers: True Net Cash P&L, OpEx Anomalies,
//           Custodies, Chronic Repair-vs-Replace CapEx & Unallocated Governance
// ===========================================================================
const SHARED_CK_HO_CASH = (() => {
  const ck = J.opex.centralKitchen
  const ho = J.opex.headOffice
  const ckCash =
    (n(ck.rolling30.rent) || n(ck.prior30.rent)) +
    Math.max(n(ck.rolling30['staff-costs']), n(ck.prior30['staff-costs'])) +
    Math.max(n(ck.rolling30['staff-housing']), n(ck.prior30['staff-housing'])) +
    n(ck.rolling30.scrap) +
    n(ck.rolling30['inventory-variance']) +
    n(ck.rolling30['kitchen-supplies']) +
    n(ck.rolling30.cleaning) +
    n(ck.rolling30.maintenance)
  const hoCash = ho
    ? (n(ho.rolling30.rent) || n(ho.prior30.rent)) +
      Math.max(n(ho.rolling30['staff-costs']), n(ho.prior30['staff-costs'])) +
      n(ho.rolling30['professional-fees']) +
      n(ho.rolling30['it-systems']) +
      n(ho.rolling30.other)
    : 0
  return { ckCash, hoCash, total: ckCash + hoCash }
})()

export const BRANCH_TRUE_CASH = (() => {
  const days = J.windows.rolling30.days || 30
  return LOC_COSTS.map((l) => {
    const ops = J.operations.locations.find((o) => o.location === l.location)
    const inc = n(l.rolling30.income)
    const posNet = ops?.netKwd ?? inc
    const orders = ops?.orders ?? 0
    const aov = orders > 0 ? posNet / orders : 3.5
    const chanRows = (J.locationChannels ?? []).filter((c) => c.location === l.location)
    const chanComm = chanRows.length ? sum(chanRows, (c) => c.amountKwd * (CHANNEL_COMM_BY_NAME[c.channel] ?? 0)) : 0
    const comm = Math.max(n(l.rolling30['platform-commission']), chanComm)
    const posNetPostComm = posNet - comm
    const cogs = n(l.rolling30['raw-food']) + n(l.rolling30['inventory-variance']) + n(l.rolling30.scrap) + n(l.rolling30.packaging)
    const rent30 = n(l.rolling30.rent)
    const rentPrior = n(l.prior30.rent)
    const rent = rent30 || rentPrior
    const rentFromPrior = !rent30 && rentPrior > 0
    const postedLabor30 = n(l.rolling30['staff-costs']) + n(l.rolling30['staff-housing'])
    const effectiveLabor = Math.max(n(l.rolling30['staff-costs']), n(l.prior30['staff-costs'])) + Math.max(n(l.rolling30['staff-housing']), n(l.prior30['staff-housing']))
    const branchOpex =
      n(l.rolling30.maintenance) +
      n(l.rolling30.cleaning) +
      n(l.rolling30['kitchen-supplies']) +
      n(l.rolling30.utilities) +
      n(l.rolling30.marketing) +
      n(l.rolling30['professional-fees']) +
      n(l.rolling30['it-systems']) +
      n(l.rolling30['platform-subscription']) +
      n(l.rolling30['bank-fees']) +
      n(l.rolling30['allowance-discount']) +
      n(l.rolling30.other)
    const sharedAlloc = REST_INCOME > 0 ? (inc / REST_INCOME) * SHARED_CK_HO_CASH.total : 0
    const branchDirectCash = posNetPostComm - cogs - rent - effectiveLabor - branchOpex
    const trueNetCash = branchDirectCash - sharedAlloc
    const trueMarginPct = pct(trueNetCash, posNet)
    const rentPct = pct(rent, inc || posNet)
    const fixedBurdenPct = pct(rent + effectiveLabor, posNet)
    const contribRate = posNet > 0 ? Math.max(0.45, (posNetPostComm - cogs) / posNet) : 0.6
    // 15% fully-loaded net cash target (after branch fixed costs + proportional CK #17 & HO #19 share)
    const monthlyCashGap = Math.max(0, posNet * 0.15 - trueNetCash)
    const monthlySalesGapKwd = monthlyCashGap / contribRate
    const dailyGapKwd = monthlySalesGapKwd / days
    const dailyGapOrders = aov > 0 ? Math.ceil(dailyGapKwd / aov) : 0
    return {
      id: l.location,
      en: locEn(l.location),
      ar: locAr(l.location),
      analyticId: l.analyticId ?? null,
      inc,
      posNet,
      orders,
      aov,
      comm,
      posNetPostComm,
      cogs,
      rent,
      rentFromPrior,
      postedLabor30,
      effectiveLabor,
      branchOpex,
      sharedAlloc,
      branchDirectCash,
      trueNetCash,
      trueMarginPct,
      rentPct,
      fixedBurdenPct,
      dailyGapKwd,
      dailyGapOrders,
    }
  }).filter((x) => x.posNet > 0)
})()

export const BRAND_TRUE_CASH = BRANDS.map((b) => {
  const analytic = J.opex.brands.find((x) => x.brand === b.id)
  const menu = J.menu.brands.find((x) => x.brand === b.id)
  return {
    id: b.id,
    en: b.en,
    ar: b.ar,
    analyticId: analytic?.analyticId ?? null,
    netSales: n(analytic?.rolling30.income) || b.sales,
    orders: menu?.orders ?? b.orders,
  }
})

const HOST_KITCHEN = (() => {
  const stressed = [...BRANCH_TRUE_CASH].filter((r) => r.rentPct > 18 || r.trueMarginPct < 10).sort((a, b) => a.trueNetCash - b.trueNetCash)[0]
  if (!stressed) return null
  const present = new Set(J.brandLocation.filter((x) => x.location === stressed.id && x.netKwd > 50).map((x) => x.brand))
  const candidates = ['franks', 'tahina', 'farm-brown', 'karak-cafeteria', 'sushi-hoko', 'heisenberg', 'noodle-bar'].filter((b) => BRANDS.some((x) => x.id === b) && !present.has(b))
  const scored = candidates.map((b) => {
    const sites = J.brandLocation.filter((x) => x.brand === b && BRANCH_IDS.has(x.location) && x.netKwd > 200)
    if (!sites.length) return null
    const med = median(sites.map((s) => s.netKwd))
    const sales = med * 0.75
    const netMargin = Math.max(0.25, 1 - brandFoodPct(b) - AVG_AGG_COMMISSION - 0.04)
    return { brand: b, sites: sites.length, medianSales: med, best: [...sites].sort((a, c) => c.netKwd - a.netKwd)[0], sales, contribution: sales * netMargin }
  }).filter((x): x is NonNullable<typeof x> => Boolean(x)).sort((a, b) => b.contribution - a.contribution)
  if (!scored.length) return null
  return {
    target: { id: stressed.id, analyticId: stressed.analyticId, rent: stressed.rent, inc: stressed.inc, posNet: stressed.posNet, rentPct: stressed.rentPct, fixedBurdenPct: stressed.fixedBurdenPct, branchDirectCash: stressed.branchDirectCash, trueNetCash: stressed.trueNetCash, trueMarginPct: stressed.trueMarginPct },
    dailyGapKwd: stressed.dailyGapKwd,
    dailyGapOrders: stressed.dailyGapOrders,
    ...scored[0],
    rentAfterPct: pct(stressed.rent, stressed.inc + scored[0].sales),
  }
})()

function opexPlays(): JourneyPlay[] {
  const out: JourneyPlay[] = []

  // 1. Exact Branch True Net Cash P&L & Multi-Brand Host-Kitchen Turnaround (Branches Plan #1)
  if (HOST_KITCHEN) {
    const h = HOST_KITCHEN
    const stars = [...BRANCH_TRUE_CASH].sort((a, b) => b.trueNetCash - a.trueNetCash).slice(0, 2)
    const secondSqueezed = [...BRANCH_TRUE_CASH].filter((r) => r.id !== h.target.id).sort((a, b) => a.trueNetCash - b.trueNetCash)[0]
    const netLabel = (v: number, ar = false) => (v >= 0 ? `+${ar ? DK(v) : KWD(v)}` : `-${ar ? DK(Math.abs(v)) : KWD(Math.abs(v))}`)
    out.push(play({
      id: `opex-host-kitchen-${h.target.id}`, stage: 'opex', basis: 'estimated', monthlyKwd: h.contribution,
      titleEn: `True Net Cash P&L: plant ${brandEn(h.brand)} inside ${locEn(h.target.id)}`, titleAr: `صافي النقد الفعلي للمراكز: زرع ${brandAr(h.brand)} داخل مطبخ ${locAr(h.target.id)}`,
      subjectEn: `${locWithAnalytic(h.target.id)} + ${brandWithAnalytic(h.brand)}`, subjectAr: `${locWithAnalytic(h.target.id, true)} + ${brandWithAnalytic(h.brand, true)}`,
      leakEn: `Cross-linking POS net sales after platform commissions against Odoo Analytic Plan #1 (Branches + proportional CK #17 & HO #19 cash load) separates true cash stars (${stars.map((s) => `${locWithAnalytic(s.id)}: ${netLabel(s.trueNetCash)} net cash`).join('; ')}) from ${locWithAnalytic(h.target.id)}, where Analytic Rent (${KWD(h.target.rent)}, ${f1(h.target.rentPct)}%) plus Branch Payroll & Housing (${f1(h.target.fixedBurdenPct)}% fixed burden) leave ${KWD(h.target.branchDirectCash)} before shared overhead and ${netLabel(h.target.trueNetCash)} fully-loaded net cash${secondSqueezed ? ` (${locWithAnalytic(secondSqueezed.id)} is next tightest at ${netLabel(secondSqueezed.trueNetCash)} / ${f1(secondSqueezed.rentPct)}% rent)` : ''}. ${locEn(h.target.id)} needs +${KWD(h.dailyGapKwd)}/day (~${h.dailyGapOrders} extra orders/day) to hit a 15% fully-loaded net cash margin, while ${brandWithAnalytic(h.brand)} has zero sales there today.`,
      leakAr: `ربط صافي مبيعات نقاط البيع بعد عمولات المنصات بمراكز التكلفة في أودو (خطة الفروع #1 مع حصة المطبخ المركزي #17 والإدارة #19) يفصل بين نجوم النقد (${stars.map((s) => `${locWithAnalytic(s.id, true)}: ${netLabel(s.trueNetCash, true)} صافي نقد`).join('؛ ')}) وبين ${locWithAnalytic(h.target.id, true)}، حيث يترك الإيجار المحمّل (${DK(h.target.rent)}، ${f1(h.target.rentPct)}%) مع الرواتب والسكن (${f1(h.target.fixedBurdenPct)}% عبء ثابت) ${DK(h.target.branchDirectCash)} قبل المصاريف المشتركة و${netLabel(h.target.trueNetCash, true)} صافي نقد شامل${secondSqueezed ? ` (يليه ${locWithAnalytic(secondSqueezed.id, true)} عند ${netLabel(secondSqueezed.trueNetCash, true)} وبإيجار ${f1(secondSqueezed.rentPct)}%)` : ''}. يحتاج ${locAr(h.target.id)} إلى +${DK(h.dailyGapKwd)} يومياً (نحو ${h.dailyGapOrders} طلباً إضافياً/يوم) لبلوغ هامش نقدي صافٍ 15%، بينما مبيعات ${brandWithAnalytic(h.brand, true)} فيه صفر حالياً.`,
      actionEn: `Open ${brandEn(h.brand)} as a delivery-only virtual host brand inside the existing ${locEn(h.target.id)} kitchen (Analytic #${h.target.analyticId ?? 114}) — zero extra rent, existing prep line, dedicated station packaging and Talabat/Keeta storefront.`,
      actionAr: `تشغيل ${brandAr(h.brand)} كعلامة توصيل رديفة داخل مطبخ ${locAr(h.target.id)} القائم (مركز تكلفة #${h.target.analyticId ?? 114}) — بصفر إيجار إضافي وعلى نفس خط التحضير مع تغليف مستقل ومتجر على طلبات وكيتا.`,
      qualityEn: 'Higher volume turns prep stock faster and keeps the kitchen team fully productive between China Garden peaks.',
      qualityAr: 'الحجم الأعلى يدوّر مخزون التحضير أسرع ويبقي فريق المطبخ منتجاً بين ذروات تشاينا جاردن.',
      ...impactText(h.contribution, `75% of ${brandEn(h.brand)}’s ${KWD(h.medianSales)} branch median = ${KWD(h.sales)}/month sales, cutting ${locEn(h.target.id)} rent load from ${f1(h.target.rentPct)}% to ${f1(h.rentAfterPct)}%.`, `75% من وسيط فروع ${brandAr(h.brand)} البالغ ${DK(h.medianSales)} = ${DK(h.sales)} مبيعات شهرياً، ما يخفض عبء إيجار ${locAr(h.target.id)} من ${f1(h.target.rentPct)}% إلى ${f1(h.rentAfterPct)}%.`),
      evidence: [
        { en: `${locWithAnalytic(h.target.id)} daily gap: +${KWD(h.dailyGapKwd)}/day (${h.dailyGapOrders} orders/day)`, ar: `الفجوة اليومية في ${locWithAnalytic(h.target.id, true)}: +${DK(h.dailyGapKwd)}/يوم (${h.dailyGapOrders} طلب/يوم)` },
        { en: `${brandWithAnalytic(h.brand)} top branch: ${locEn(h.best.location)} ${KWD(h.best.netKwd)}/30d`, ar: `أعلى فرع لـ ${brandWithAnalytic(h.brand, true)}: ${locAr(h.best.location)} بـ ${DK(h.best.netKwd)}/30 يوماً` },
      ],
      kpi: { id: `opex-rent-pct-${h.target.id}`, en: `Analytic rent % of revenue · ${locEn(h.target.id)}`, ar: `نسبة الإيجار من الإيراد · ${locAr(h.target.id)}`, value: Math.round(h.target.rentPct * 10) / 10, unit: 'pct', better: 'down' },
    }))
  }

  // 2. Exact Brand Cost-Center True Net Cash Audit (BRAND Plan #2)
  const brandRows = J.opex.brands
    .filter((b) => BRAND_NAMES[b.brand])
    .map((b) => {
      const inc = n(b.rolling30.income)
      const food = n(b.rolling30['raw-food']) + n(b.rolling30['inventory-variance']) + n(b.rolling30.scrap) + n(b.rolling30.packaging)
      const rent = n(b.rolling30.rent) || n(b.prior30.rent)
      const mkt = n(b.rolling30.marketing)
      const other =
        n(b.rolling30.maintenance) +
        n(b.rolling30.cleaning) +
        n(b.rolling30.utilities) +
        n(b.rolling30['professional-fees']) +
        n(b.rolling30['platform-subscription']) +
        n(b.rolling30['bank-fees']) +
        n(b.rolling30.other) +
        n(b.rolling30['platform-commission'])
      const netBeforePayroll = inc - food - rent - mkt - other
      return { brand: b.brand, analyticId: b.analyticId, inc, food, foodPct: pct(food, inc), rent, rentPct: pct(rent, inc), mkt, mktPer1k: inc > 0 ? (mkt / inc) * 1000 : 0, netBeforePayroll }
    })
    .filter((b) => b.inc > 200)

  const canteenBrand = brandRows.find((b) => b.brand === 'fresh-daily-canteen')
  const franksBrand = brandRows.find((b) => b.brand === 'franks')
  const farmBrand = brandRows.find((b) => b.brand === 'farm-brown')
  const cgBrand = brandRows.find((b) => b.brand === 'china-garden')
  if (canteenBrand && canteenBrand.netBeforePayroll < 0) {
    const mktExcess = franksBrand && franksBrand.mktPer1k > 15 ? franksBrand.mkt * 0.35 : 0
    const canteenFix = Math.abs(canteenBrand.netBeforePayroll) + canteenBrand.inc * 0.12
    const monthly = canteenFix + mktExcess
    out.push(play({
      id: 'opex-brand-cost-center-pnl', stage: 'opex', basis: 'posted', monthlyKwd: monthly,
      titleEn: 'Brand Cost-Center P&L: canteen cash bleed & promo-heavy brand OpEx', titleAr: 'مراكز تكلفة العلامات: نزيف الكانتين وتضخم تسويق العلامات الرديفة',
      subjectEn: `${brandWithAnalytic('fresh-daily-canteen')} · ${brandWithAnalytic('franks')} · ${brandWithAnalytic('farm-brown')}`,
      subjectAr: `${brandWithAnalytic('fresh-daily-canteen', true)} · ${brandWithAnalytic('franks', true)} · ${brandWithAnalytic('farm-brown', true)}`,
      leakEn: `Odoo Analytic Plan #2 (BRAND) shows ${brandWithAnalytic('china-garden')} carrying the group (${KWD(cgBrand?.inc ?? 0)} revenue, ${f1(cgBrand?.rentPct ?? 0)}% analytic rent), while ${brandWithAnalytic('fresh-daily-canteen')} bleeds ${KWD(Math.abs(canteenBrand.netBeforePayroll))} in cash before payroll (${KWD(canteenBrand.inc)} revenue vs ${f1(canteenBrand.foodPct)}% raw food + ${KWD(canteenBrand.rent)} [${f1(canteenBrand.rentPct)}%] analytic rent, dragged down by FAS Fahaheel Canteen Analytic #130). Meanwhile ${brandWithAnalytic('franks')} spends ${KWD(franksBrand?.mkt ?? 0)} on marketing (${f1(franksBrand?.mktPer1k ?? 0)} KWD per 1,000 KWD of sales) and ${brandWithAnalytic('farm-brown')} carries ${f1(farmBrand?.rentPct ?? 0)}% analytic rent (${KWD(farmBrand?.rent ?? 0)}).`,
      leakAr: `تُظهر خطة مراكز التكلفة #2 (BRAND) في أودو أن ${brandWithAnalytic('china-garden', true)} يقود المجموعة (${DK(cgBrand?.inc ?? 0)} إيراد، ${f1(cgBrand?.rentPct ?? 0)}% إيجار)، بينما ينزف ${brandWithAnalytic('fresh-daily-canteen', true)} ${DK(Math.abs(canteenBrand.netBeforePayroll))} نقداً قبل الرواتب (${DK(canteenBrand.inc)} إيراد مقابل ${f1(canteenBrand.foodPct)}% تكلفة أغذية + ${DK(canteenBrand.rent)} [${f1(canteenBrand.rentPct)}%] إيجار محمّل، بضغط من كانتين الفحيحيل مركز #130). وفي الوقت نفسه ينفق ${brandWithAnalytic('franks', true)} ${DK(franksBrand?.mkt ?? 0)} تسويقاً (${f1(franksBrand?.mktPer1k ?? 0)} د.ك لكل 1,000 د.ك مبيعات) ويتحمل ${brandWithAnalytic('farm-brown', true)} إيجاراً بنسبة ${f1(farmBrand?.rentPct ?? 0)}% (${DK(farmBrand?.rent ?? 0)}).`,
      actionEn: 'Convert FAS Fahaheel Canteen (Analytic #130) from fixed rent to a revenue-share cap (<=18% of sales), re-engineer Fresh Daily Canteen recipes to <=36% food cost, and cap Frank’s (Analytic #88) marketing spend at <=15 KWD per 1,000 KWD of verified net sales.',
      actionAr: 'تحويل إيجار كانتين الفحيحيل (مركز تكلفة #130) من مبلغ مقطوع إلى نسبة من المبيعات بسقف 18%، وإعادة هندسة وصفات فريش ديلي كانتين لتنزل تكلفة الأغذية تحت 36%، ووضع سقف لتسويق فرانكس (مركز #88) عند 15 د.ك لكل 1,000 د.ك صافي مبيعات.',
      qualityEn: 'Every brand stands on healthy unit economics instead of silently draining China Garden’s cash surplus.',
      qualityAr: 'تقف كل علامة على اقتصاديات وحدة صحية بدلاً من استنزاف الفائض النقدي لعلامة تشاينا جاردن بصمت.',
      ...impactText(monthly, 'Eliminating the Fresh Daily Canteen negative cash margin plus trimming 35% of excess marketing per 1k on Frank’s.', 'بإيقاف الهامش النقدي السالب لفريش ديلي كانتين مع ترشيد 35% من فائض تسويق فرانكس لكل ألف د.ك.'),
      evidence: [
        { en: `${brandWithAnalytic('fresh-daily-canteen')}: ${f1(canteenBrand.foodPct)}% food + ${f1(canteenBrand.rentPct)}% rent`, ar: `${brandWithAnalytic('fresh-daily-canteen', true)}: ${f1(canteenBrand.foodPct)}% أغذية + ${f1(canteenBrand.rentPct)}% إيجار` },
        { en: `${brandWithAnalytic('franks')}: ${f1(franksBrand?.mktPer1k ?? 0)} KWD marketing / 1k sales`, ar: `${brandWithAnalytic('franks', true)}: ${f1(franksBrand?.mktPer1k ?? 0)} د.ك تسويق لكل ألف مبيعات` },
      ],
      kpi: { id: 'opex-canteen-food-pct', en: 'Fresh Daily Canteen food + rent % of revenue', ar: 'نسبة الأغذية والإيجار · فريش ديلي كانتين', value: Math.round((canteenBrand.foodPct + canteenBrand.rentPct) * 10) / 10, unit: 'pct', better: 'down' },
    }))
  }

  // 3. Same-Brand Cross-Branch OpEx Anomaly Hunter (per 1,000 KWD of sales across Analytic Plan #1)
  const ANOMALY_CATS: { key: string; en: string; ar: string; countInSaving: boolean }[] = [
    { key: 'cleaning', en: 'Cleaning & Hood', ar: 'النظافة والهود', countInSaving: true },
    { key: 'kitchen-supplies', en: 'Kitchen Smallwares & Supplies', ar: 'مستلزمات وأدوات المطبخ', countInSaving: true },
    { key: 'utilities', en: 'Utilities (Water & Power)', ar: 'الكهرباء والماء', countInSaving: true },
    { key: 'maintenance', en: 'Branch Maintenance', ar: 'صيانة الفرع', countInSaving: false }, // counted in CapEx repair-loop play
    { key: 'packaging', en: 'Packaging', ar: 'التغليف', countInSaving: false }, // counted in Stage 1 packaging play
  ]
  const anomalies: { loc: string; catKey: string; catEn: string; catAr: string; kwd: number; per1k: number; medPer1k: number; excessKwd: number; countInSaving: boolean }[] = []
  for (const cat of ANOMALY_CATS) {
    const rates = LOC_COSTS.map((l) => {
      const inc = n(l.rolling30.income)
      const kwd = n(l.rolling30[cat.key])
      return { loc: l.location, inc, kwd, per1k: inc > 0 ? (kwd / inc) * 1000 : 0 }
    }).filter((r) => r.inc > 3000)
    const med = median(rates.map((r) => r.per1k))
    for (const r of rates) {
      const excessKwd = ((r.per1k - med) / 1000) * r.inc
      if (r.per1k > Math.max(med * 1.45, med + 2.5) && excessKwd >= 45) {
        anomalies.push({ loc: r.loc, catKey: cat.key, catEn: cat.en, catAr: cat.ar, kwd: r.kwd, per1k: r.per1k, medPer1k: med, excessKwd, countInSaving: cat.countInSaving })
      }
    }
  }
  anomalies.sort((a, b) => b.excessKwd - a.excessKwd)
  if (anomalies.length) {
    const nonOverlapExcess = sum(anomalies.filter((a) => a.countInSaving), (a) => a.excessKwd)
    const totalExcess = sum(anomalies, (a) => a.excessKwd)
    const monthly = Math.max(120, nonOverlapExcess * 0.65)
    const topA = anomalies[0]
    const topSubjects = [...new Set(anomalies.slice(0, 3).map((a) => a.loc))]
    out.push(play({
      id: 'opex-cross-branch-anomalies', stage: 'opex', basis: 'posted', monthlyKwd: monthly,
      titleEn: 'Cross-Branch OpEx Anomaly Hunter (per 1,000 KWD of sales)', titleAr: 'كاشف شذوذ المصاريف التشغيلية بين الفروع (لكل ١٬٠٠٠ د.ك مبيعات)',
      subjectEn: topSubjects.map((id) => locWithAnalytic(id)).join(' · '),
      subjectAr: topSubjects.map((id) => locWithAnalytic(id, true)).join(' · '),
      leakEn: `Benchmarking Odoo Analytic Plan #1 postings per 1,000 KWD of branch revenue exposes ${anomalies.length} abnormal OpEx spikes (${KWD(totalExcess)} above peer medians): ${anomalies.slice(0, 4).map((a) => `${locWithAnalytic(a.loc)} ${a.catEn} at ${f1(a.per1k)} KWD/1k vs ${f1(a.medPer1k)} median (${KWD(a.kwd)}, +${KWD(a.excessKwd)} excess)`).join('; ')}.`,
      leakAr: `مقارنة القيود المرحّلة على مراكز تكلفة الفروع لكل 1,000 د.ك من الإيراد تكشف ${anomalies.length} قفزات شاذة (${DK(totalExcess)} فوق وسيط الفروع): ${anomalies.slice(0, 4).map((a) => `${locWithAnalytic(a.loc, true)} في بند ${a.catAr} بمعدل ${f1(a.per1k)} د.ك/ألف مقابل وسيط ${f1(a.medPer1k)} (${DK(a.kwd)}، فائض +${DK(a.excessKwd)})`).join('؛ ')}.`,
      actionEn: `Set a hard monthly Analytic budget ceiling per 1,000 KWD of sales in Odoo on Cleaning & Hood, Kitchen Supplies and Utilities; audit ${locEn(topA.loc)}’s chemical dilution/hood contract and require area-manager approval before any issue above the peer median.`,
      actionAr: `ربط سقف موازنة شهري لكل 1,000 د.ك مبيعات على مراكز تكلفة الفروع لبنود النظافة والهود ومستلزمات المطبخ والكهرباء؛ وتدقيق استهلاك مواد التنظيف وعقود الهود في ${locAr(topA.loc)} واشتراط موافقة مدير المنطقة فوق وسيط الفروع.`,
      qualityEn: 'Metered chemical dosing and disciplined smallwares control keep kitchens spotless without wasting consumables.',
      qualityAr: 'معايرة جرعات المنظفات وضبط مستلزمات المطبخ يحافظان على نظافة مثالية دون هدر في المواد المستهلكة.',
      ...impactText(monthly, 'Recovering 65% of the non-packaging, non-capex OpEx excess above the 7-branch median (packaging & repair savings counted separately).', 'باسترداد 65% من فائض المصاريف التشغيلية فوق وسيط الفروع السبعة (دون ازدواجية التغليف والصيانة المحسوبين في قرارين مستقلين).'),
      evidence: anomalies.slice(0, 3).map((a) => ({ en: `${locWithAnalytic(a.loc)} · ${a.catEn}: ${f1(a.per1k)} vs ${f1(a.medPer1k)} KWD/1k`, ar: `${locWithAnalytic(a.loc, true)} · ${a.catAr}: ${f1(a.per1k)} مقابل ${f1(a.medPer1k)} د.ك/ألف` })),
      kpi: { id: `opex-anom-${topA.loc}-${topA.catKey}`, en: `${topA.catEn} per 1,000 KWD · ${locEn(topA.loc)}`, ar: `${topA.catAr} لكل ألف د.ك · ${locAr(topA.loc)}`, value: Math.round(topA.per1k * 10) / 10, unit: 'kwd', better: 'down' },
    }))
  }

  // 4. Petty-Cash Custodies & Off-PO Emergency Bill Anomalies
  const offPoKwd = J.procurement.bills.offPoKwd
  const custody = J.opex.custody
  if (offPoKwd > 500 || custody.totalKwd > 1500) {
    const monthly = offPoKwd * 0.12
    const branchOffPo = LOC_COSTS.map((l) => {
      const kwd = n(l.offPo30Kwd)
      const inc = n(l.rolling30.income)
      return { id: l.location, kwd, per1k: inc > 0 ? (kwd / inc) * 1000 : 0 }
    }).filter((x) => x.kwd > 50).sort((a, b) => b.per1k - a.per1k)
    const topOff = branchOffPo.slice(0, 3)
    out.push(play({
      id: 'opex-custody-offpo-anomalies', stage: 'opex', basis: 'estimated', monthlyKwd: monthly,
      titleEn: 'Off-PO emergency vendor bills & open staff custodies', titleAr: 'فواتير شراء طارئة خارج الأوامر وعُهد نقدية مفتوحة',
      subjectEn: `${topOff.map((x) => locWithAnalytic(x.id)).join(' · ')} · Custodies 10101–10160`,
      subjectAr: `${topOff.map((x) => locWithAnalytic(x.id, true)).join(' · ')} · حسابات العُهد 10101–10160`,
      leakEn: `${J.procurement.bills.offPoCount} vendor bills totalling ${KWD(offPoKwd)} were posted in 30 days without an Odoo purchase order${topOff.length ? ` — highest per 1,000 KWD of sales at ${topOff.map((x) => `${locWithAnalytic(x.id)} (${KWD(x.kwd)}, ${f1(x.per1k)} KWD/1k)`).join(', ')}` : ''}. Simultaneously, ${KWD(custody.totalKwd)} sits in open petty-cash & staff custody accounts (${KWD(custody.individualKwd)} across ${custody.individualAccounts} individual custodies) waiting to hit cost centers late at retail prices.`,
      leakAr: `تم ترحيل ${J.procurement.bills.offPoCount} فاتورة مورد بقيمة ${DK(offPoKwd)} خلال 30 يوماً دون أمر شراء في أودو${topOff.length ? ` — أعلاها لكل 1,000 د.ك مبيعات في ${topOff.map((x) => `${locWithAnalytic(x.id, true)} (${DK(x.kwd)}، ${f1(x.per1k)} د.ك/ألف)`).join('، ')}` : ''}. وبالتوازي توجد ${DK(custody.totalKwd)} في حسابات عُهد ونثرية مفتوحة (منها ${DK(custody.individualKwd)} موزعة على ${custody.individualAccounts} عُهد شخصية) تتحول لاحقاً لمصاريف بأسعار التجزئة.`,
      actionEn: 'Enforce 3-way PO matching in Odoo on every bill >25 KWD, cap branch emergency petty-cash floats at 300 KWD with mandatory Analytic Cost Center tagging on every voucher, and sweep open custodies every Thursday.',
      actionAr: 'فرض مطابقة ثلاثية بأمر شراء في أودو لكل فاتورة تتجاوز 25 د.ك، ووضع سقف 300 د.ك لعهدة الطوارئ بالفرع مع إلزامية مركز التكلفة على كل سند، وتسوية العُهد المفتوحة كل يوم خميس.',
      qualityEn: 'Planned PO buying eliminates emergency grocery runs that introduce unapproved ingredients into the kitchen.',
      qualityAr: 'الشراء المخطط عبر أوامر الشراء ينهي المشتريات الإسعافية التي تدخل مكونات غير معتمدة إلى المطبخ.',
      ...impactText(monthly, `12% retail-vs-contract price premium saved on ${KWD(offPoKwd)} of off-PO bills, plus ${KWD(custody.totalKwd)} cash float tightened.`, `توفير 12% فرق سعر التجزئة عن العقود على ${DK(offPoKwd)} من الفواتير خارج الأوامر، مع ضبط سيولة ${DK(custody.totalKwd)} في العُهد.`),
      evidence: [
        { en: `Off-PO bills: ${KWD(offPoKwd)} (${J.procurement.bills.offPoCount} bills)`, ar: `فواتير بدون أمر شراء: ${DK(offPoKwd)} (${J.procurement.bills.offPoCount} فاتورة)` },
        { en: `Open custodies: ${KWD(custody.totalKwd)} (${custody.individualAccounts} individual accounts)`, ar: `عُهد مفتوحة: ${DK(custody.totalKwd)} (${custody.individualAccounts} حسابات فردية)` },
      ],
      kpi: { id: 'opex-custody-kwd', en: 'Open petty-cash & custody balances', ar: 'أرصدة العُهد والنثرية المفتوحة', value: Math.round(custody.totalKwd), unit: 'kwd', better: 'down' },
    }))
  }

  // 5. Chronic Repair-vs-Replace CapEx Trigger (from 120d account.analytic.line maintenance audit)
  const maintSites = J.opex.maintenance
    .filter((m) => (BRANCH_IDS.has(m.location) || m.location === 'central-kitchen') && (m.reactivePostings120d ?? m.postings120d) >= 4 && m.activeMonths >= 3 && (m.reactiveKwd120d ?? m.kwd120d) >= 250)
    .sort((a, b) => (b.reactiveKwd120d ?? b.kwd120d) - (a.reactiveKwd120d ?? a.kwd120d))
  if (maintSites.length) {
    const topSites = maintSites.slice(0, 3)
    const reactive120 = sum(topSites, (s) => s.reactiveKwd120d ?? s.kwd120d)
    const monthly = (reactive120 / 4) * 0.55
    const ckSite = maintSites.find((s) => s.location === 'central-kitchen')
    const primary = ckSite ?? topSites[0]
    const eqSummaryEn = topSites.map((s) => {
      const eq = s.equipment.slice(0, 2).map((e) => `${EQUIP[e.key]?.[0] ?? e.key} (${e.postings}x, ${KWD(e.kwd)})`).join(', ')
      return `${locWithAnalytic(s.location)}: ${s.reactivePostings120d ?? s.postings120d} reactive breakdowns = ${KWD(s.reactiveKwd120d ?? s.kwd120d)} across ${s.activeMonths} months${eq ? ` [${eq}]` : ''}`
    }).join('; ')
    const eqSummaryAr = topSites.map((s) => {
      const eq = s.equipment.slice(0, 2).map((e) => `${EQUIP[e.key]?.[1] ?? e.key} (${e.postings} مرات، ${DK(e.kwd)})`).join('، ')
      return `${locWithAnalytic(s.location, true)}: ${s.reactivePostings120d ?? s.postings120d} أعطال طارئة = ${DK(s.reactiveKwd120d ?? s.kwd120d)} عبر ${s.activeMonths} أشهر${eq ? ` [${eq}]` : ''}`
    }).join('؛ ')
    out.push(play({
      id: 'opex-repair-loop-capex', stage: 'opex', basis: 'posted', monthlyKwd: monthly,
      titleEn: 'Chronic equipment repair loops: CapEx replace vs patch', titleAr: 'حلقات الإصلاح المتكررة للمعدات: قرار استبدال رأسمالي فوري',
      subjectEn: topSites.map((s) => locWithAnalytic(s.location)).join(' · '),
      subjectAr: topSites.map((s) => locWithAnalytic(s.location, true)).join(' · '),
      leakEn: `120-day Odoo analytic ledger entries (account.analytic.line) reveal chronic repeat call-outs on the same assets: ${eqSummaryEn}. Patching worn A/C compressors, chillers and plumbing lines drains cash every month while risking cold-chain drift.`,
      leakAr: `تكشف قيود مراكز التكلفة لآخر 120 يوماً في أودو (account.analytic.line) تكرار الأعطال على نفس الأصول: ${eqSummaryAr}. الترقيع المستمر لضواغط التكييف والثلاجات وخطوط الصرف يستنزف النقد شهرياً ويهدد سلسلة التبريد.`,
      actionEn: `Apply a hard CapEx rule: replace any A/C unit, chiller or kitchen machine whose 12-month repair cost exceeds 35% of new-unit cost — starting with the A/C units at Ardiya Central Kitchen (Analytic #17), plumbing/A/C at Ardiya (Analytic #41) and chillers/hood at Al-Kout Mall (Analytic #42) under warranty.`,
      actionAr: `تطبيق قاعدة استبدال رأسمالي صارمة: استبدال أي وحدة تكييف أو ثلاجة أو معدة مطبخ تتجاوز إصلاحاتها السنوية 35% من سعر الجديد — بدءاً بوحدات تكييف المطبخ المركزي بالعارضية (مركز #17)، والسباكة والتكييف في العارضية (مركز #41)، والثلاجات والهود في الكوت مول (مركز #42) بضمان مصنعي.`,
      qualityEn: 'Stable central-kitchen A/C and branch chiller temperatures keep proteins at <=4°C and protect woks and hoods at peak.',
      qualityAr: 'ثبات تكييف المطبخ المركزي وحرارة ثلاجات الفروع يحفظ البروتينات عند 4 درجات أو أقل ويحمي خطوط الطبخ في الذروة.',
      ...impactText(monthly, `Cutting 55% of reactive breakdown spend across these ${topSites.length} cost centers (${KWD(reactive120)} over 120 days).`, `بخفض 55% من إنفاق الأعطال الطارئة في مراكز التكلفة الثلاثة (${DK(reactive120)} خلال 120 يوماً).`),
      evidence: topSites.map((s) => ({ en: `${locWithAnalytic(s.location)}: ${KWD(s.kwd120d)} total / ${KWD(s.reactiveKwd120d ?? s.kwd120d)} reactive (120d)`, ar: `${locWithAnalytic(s.location, true)}: ${DK(s.kwd120d)} إجمالي / ${DK(s.reactiveKwd120d ?? s.kwd120d)} طارئ (120 يوماً)` })),
      kpi: { id: `opex-maint-${primary.location}`, en: `Reactive maintenance (120d) · ${locEn(primary.location)}`, ar: `الصيانة الطارئة (120 يوماً) · ${locAr(primary.location)}`, value: Math.round(primary.reactiveKwd120d ?? primary.kwd120d), unit: 'kwd', better: 'down' },
    }))
  }

  // 6. Unallocated Operational Expense Governance (analytic_distribution = false)
  const unalloc = J.opex.unallocated?.rolling30
  const unallocMtd = J.opex.unallocated?.mtd
  if (unalloc && unalloc.grossDebitKwd > 250) {
    const topAccs = [...unalloc.accounts].filter((a) => a.netKwd > 15).sort((a, b) => b.netKwd - a.netKwd).slice(0, 4)
    const monthly = Math.max(85, unalloc.directOpexKwd * 0.15)
    out.push(play({
      id: 'opex-unallocated-analytic-governance', stage: 'opex', basis: 'posted', monthlyKwd: monthly, severity: 'medium',
      titleEn: 'Unallocated expenses bypassing Odoo Analytic Cost Centers', titleAr: 'مصاريف تشغيلية غير محمّلة على مراكز التكلفة في أودو',
      subjectEn: `Empty analytic_distribution · ${topAccs.map((a) => `${a.code} ${a.label}`).slice(0, 3).join(' · ')}`,
      subjectAr: `قيود بدون توزيع تحليلي · ${topAccs.map((a) => `${a.code} ${a.categoryAr}`).slice(0, 3).join(' · ')}`,
      leakEn: `Scanning posted expense lines in account.move.line where analytic_distribution is empty uncovered ${f0(unalloc.lines)} unallocated lines in 30 days: ${KWD(unalloc.grossDebitKwd)} in gross expense debits (${KWD(unalloc.directOpexKwd)} direct OpEx led by ${topAccs.map((a) => `${a.code} ${a.label}: ${KWD(a.netKwd)}`).join(', ')}) plus ${KWD(Math.abs(unalloc.stockVarianceContraKwd))} of unallocated stock-variance adjustments on account 400000. In November MTD alone, ${KWD(unallocMtd?.grossDebitKwd ?? 0)} across ${f0(unallocMtd?.lines ?? 0)} lines has already been posted without a Branch or Brand cost center.`,
      leakAr: `فحص سطور المصروفات المرحّلة في account.move.line الخالية من التوزيع التحليلي (analytic_distribution) كشف ${f0(unalloc.lines)} سطراً غير محمّل خلال 30 يوماً: ${DK(unalloc.grossDebitKwd)} إجمالي مدين مصروفات (${DK(unalloc.directOpexKwd)} مصاريف تشغيلية مباشرة أبرزها ${topAccs.map((a) => `${a.code} ${a.label}: ${DK(a.netKwd)}`).join('، ')}) إضافة إلى ${DK(Math.abs(unalloc.stockVarianceContraKwd))} تسويات فروقات مخزون على حساب 400000 بلا مركز تكلفة. وفي نوفمبر وحده رُحّلت ${DK(unallocMtd?.grossDebitKwd ?? 0)} عبر ${f0(unallocMtd?.lines ?? 0)} سطراً دون فرع أو علامة.`,
      actionEn: 'Enable Odoo 17 Analytic Applicability rules making Analytic Plan #1 (Branches / Head Office #19 / CK #17) mandatory on all 40xxxx & 42xxxx expense accounts before journal posting, and re-allocate November’s unallocated lines before month-end close.',
      actionAr: 'تفعيل قواعد الإلزام التحليلي في أودو 17 لجعل خطة مراكز التكلفة #1 (الفروع / الإدارة #19 / المطبخ المركزي #17) إلزامية على جميع حسابات المصاريف 40xxxx و42xxxx قبل الترحيل، وإعادة توزيع سطور نوفمبر غير المحمّلة قبل إقفال الشهر.',
      qualityEn: '100% cost-center completeness makes every branch manager’s monthly P&L indisputable — zero orphan bills hiding in Head Office.',
      qualityAr: 'اكتمال التحميل بنسبة 100% يجعل قائمة دخل كل مدير فرع دقيقة وغير قابلة للجدل — بلا فواتير يتيمة تختبئ خارج الفروع.',
      ...impactText(monthly, `15% spend reduction on ${KWD(unalloc.directOpexKwd)}/month of orphaned stationery, hospitality, scrap and food-trial expenses once assigned to accountable owners.`, `وفر 15% من ${DK(unalloc.directOpexKwd)} شهرياً من مصاريف القرطاسية والضيافة والهالك والتجارب بمجرد ربطها بمسؤول مركز تكلفة.`),
      evidence: [
        { en: `${f0(unalloc.lines)} lines · ${KWD(unalloc.grossDebitKwd)} gross unallocated debit (30d)`, ar: `${f0(unalloc.lines)} سطراً · ${DK(unalloc.grossDebitKwd)} مدين غير محمّل (30 يوماً)` },
        { en: `Nov MTD unallocated: ${KWD(unallocMtd?.grossDebitKwd ?? 0)} (${f0(unallocMtd?.lines ?? 0)} lines)`, ar: `غير محمّل منذ بداية نوفمبر: ${DK(unallocMtd?.grossDebitKwd ?? 0)} (${f0(unallocMtd?.lines ?? 0)} سطراً)` },
      ],
      kpi: { id: 'opex-unalloc-debit', en: 'Unallocated expense debits (30 days)', ar: 'المصروفات غير المحمّلة على مراكز التكلفة (30 يوماً)', value: Math.round(unalloc.grossDebitKwd), unit: 'kwd', better: 'down' },
    }))
  }

  return out
}

// ===========================================================================
// Stage 6 — Aggregator net economics, promo burn & bank settlement gaps
// ===========================================================================
function deliveryPlays(): JourneyPlay[] {
  const out: JourneyPlay[] = []
  const keeta = CHANNEL_ECONOMICS.find((c) => c.id === 'keeta')
  if (keeta && keeta.promo > 500) {
    const monthly = keeta.promo * 0.35
    const pocketMarginPct = keeta.sales > 0 ? pct(keeta.orders * keeta.pocketPerOrder, keeta.sales) : 0
    out.push(play({
      id: 'delivery-promo-burn', stage: 'delivery', basis: 'posted', monthlyKwd: monthly,
      titleEn: 'Keeta co-funded discounts burning pocket margin', titleAr: 'خصومات كيتا المشتركة تستنزف صافي الجيب',
      subjectEn: `Keeta · ${KWD(keeta.sales)} sales (${f0(keeta.orders)} orders)`, subjectAr: `كيتا · ${DK(keeta.sales)} مبيعات (${f0(keeta.orders)} طلب)`,
      leakEn: `Keeta took ${KWD(keeta.promo)} in restaurant-funded campaign discounts (${f1(keeta.promoPct)}% of Keeta item sales) on top of ${KWD(keeta.commissionKwd)} in commission — leaving ${f1(pocketMarginPct)}% pocket margin (${f3(keeta.pocketPerOrder)} KWD/order) before kitchen labour and rent.`,
      leakAr: `خصمت كيتا ${DK(keeta.promo)} كحملات ممولة من المطعم (${f1(keeta.promoPct)}% من مبيعات أصناف كيتا) فوق ${DK(keeta.commissionKwd)} عمولة — ليتبقى ${f1(pocketMarginPct)}% صافي جيب (${f3(keeta.pocketPerOrder)} د.ك للطلب) قبل عمالة المطبخ والإيجار.`,
      actionEn: 'Set a 3.500 KWD minimum basket on any co-funded Keeta offer, cap co-funding at 50% of the discount, and pull hero dishes (Chicken Noodles, Sweet & Sour Chicken) out of percentage-off campaigns.',
      actionAr: 'وضع حد أدنى 3.500 د.ك للسلة في أي عرض مشترك على كيتا، وسقف 50% لمساهمة المطعم، وإخراج أطباق البطل (تشيكن نودلز وسويت آند ساور تشيكن) من حملات الخصم النسبي.',
      qualityEn: 'Ending deep discounts on signature dishes protects brand price integrity and attracts repeat guests instead of bargain hunters.',
      qualityAr: 'إيقاف الخصومات العميقة على الأطباق المميزة يحمي هيبة سعر العلامة ويجذب عملاء دائمين لا باحثين عن الخصم فقط.',
      ...impactText(monthly, 'Cutting promo burn by 35% through minimum-basket rules and hero-dish exclusions.', 'بخفض استنزاف العروض 35% عبر حد السلة الأدنى واستثناء أطباق البطل.'),
      evidence: [{ en: `Net pocket per Keeta order: ${f3(keeta.pocketPerOrder)} KWD`, ar: `صافي الجيب لطلب كيتا: ${f3(keeta.pocketPerOrder)} د.ك` }],
      kpi: { id: 'delivery-keeta-promo', en: 'Keeta campaign discount burn', ar: 'استنزاف خصومات كيتا', value: Math.round(keeta.promo), unit: 'kwd', better: 'down' },
    }))
  }

  const unsettled = J.delivery.platforms.filter((p) => p.clearingKwd > 500)
  const clearingTotal = sum(unsettled, (p) => p.clearingKwd)
  if (clearingTotal > 5000) {
    out.push(play({
      id: 'delivery-unsettled-clearing', stage: 'delivery', basis: 'posted', monthlyKwd: 0, severity: 'high',
      titleEn: 'Delivery clearing balances awaiting bank reconciliation', titleAr: 'أرصدة تسوية منصات التوصيل بانتظار المطابقة البنكية',
      subjectEn: unsettled.map((p) => `${p.platform} ${KWD(p.clearingKwd)}`).join(' · '), subjectAr: unsettled.map((p) => `${p.platform} ${DK(p.clearingKwd)}`).join(' · '),
      leakEn: `Odoo POS clearing accounts hold ${KWD(clearingTotal)} in un-reconciled platform takings (${unsettled.map((p) => `${p.platform}: ${KWD(p.clearingKwd)} open, ${KWD(p.settled30Kwd)} settled vs ${KWD(p.booked30Kwd)} booked in 30 days`).join('; ')}). While clearing entries sit un-matched, short-payments and chargebacks go unnoticed.`,
      leakAr: `تحتفظ حسابات تسوية نقاط البيع في أودو بمبلغ ${DK(clearingTotal)} غير مطابق من متحصلات المنصات (${unsettled.map((p) => `${p.platform}: ${DK(p.clearingKwd)} مفتوح، سوّي ${DK(p.settled30Kwd)} من أصل ${DK(p.booked30Kwd)} مسجلة في 30 يوماً`).join('؛ ')}). وبقاء القيود دون مطابقة يخفي النواقص والاستقطاعات.`,
      actionEn: 'Reconcile every Talabat, Keeta, Deliveroo and Jahez payout statement weekly in Odoo: POS clearing → platform commission + promo expense + bank deposit, and dispute any short-payment within 7 days.',
      actionAr: 'مطابقة كل كشف تحويل من طلبات وكيتا وديليفرو وجاهز أسبوعياً في أودو: من حساب التسوية إلى العمولة ومصروف العروض والإيداع البنكي، والاعتراض على أي نقص خلال 7 أيام.',
      qualityEn: 'Weekly reconciliation catches wrongful "missing item" deductions and routes the real ones straight back to the offending branch.',
      qualityAr: 'المطابقة الأسبوعية تكشف استقطاعات "نقص الأصناف" غير الصحيحة وتحوّل الحقيقي منها مباشرة إلى الفرع المسؤول.',
      impactEn: `Unlocks visibility on ${KWD(clearingTotal)} of working capital and stops silent platform short-payments (balance-sheet control — counted as 0 KWD in P&L uplift).`,
      impactAr: `يكشف حركة ${DK(clearingTotal)} من رأس المال العامل ويوقف النواقص الصامتة من المنصات (ضبط ميزانية — محسوب 0 د.ك في قفزة الأرباح).`,
      evidence: unsettled.map((p) => ({ en: `${p.platform}: ${KWD(p.clearingKwd)} open clearing`, ar: `${p.platform}: ${DK(p.clearingKwd)} تسوية مفتوحة` })),
      kpi: { id: 'delivery-clearing-kwd', en: 'Un-reconciled platform clearing', ar: 'رصيد تسوية المنصات غير المطابق', value: Math.round(clearingTotal), unit: 'kwd', better: 'down' },
    }))
  }

  const keetaPosted = J.delivery.postedCommissions30.Keeta ?? 0
  const keetaBooked30 = J.delivery.platforms.find((p) => p.platform === 'Keeta')?.booked30Kwd ?? keeta?.sales ?? 0
  if (keeta && keetaBooked30 > 0 && keetaPosted > keetaBooked30 * 0.14) {
    const expected = keetaBooked30 * (keeta.commissionPct / 100)
    const gap = keetaPosted - expected
    const monthly = gap * 0.25
    out.push(play({
      id: 'delivery-commission-keeta', stage: 'delivery', basis: 'posted', monthlyKwd: monthly,
      titleEn: 'Posted Keeta commission far above nominal rate', titleAr: 'عمولة كيتا المرحّلة أعلى بكثير من النسبة الاسمية',
      subjectEn: 'Account 40233 · Keeta commission', subjectAr: 'حساب 40233 · عمولة كيتا',
      leakEn: `Account 40233 booked ${KWD(keetaPosted)} in Keeta charges in 30 days against ${KWD(keetaBooked30)} of 30-day POS Keeta takings — an effective ${f1(pct(keetaPosted, keetaBooked30))}% deduction vs the ${f1(keeta.commissionPct)}% headline commission (${KWD(gap)} gap from delivery fees, CPC ads or prior-period bills).`,
      leakAr: `سجّل حساب 40233 مبلغ ${DK(keetaPosted)} رسوم كيتا خلال 30 يوماً مقابل ${DK(keetaBooked30)} متحصلات كيتا لآخر 30 يوماً — أي استقطاع فعلي ${f1(pct(keetaPosted, keetaBooked30))}% مقابل العمولة الاسمية ${f1(keeta.commissionPct)}% (فجوة ${DK(gap)} من رسوم توصيل أو إعلانات أو فواتير سابقة).`,
      actionEn: 'Split Keeta invoices in Odoo into three accounts (commission, paid ads/CPC, logistics fees), pause any CPC campaign below 4x return on ad spend, and audit the contract tier.',
      actionAr: 'فصل فواتير كيتا في أودو إلى ثلاثة حسابات (عمولة، إعلانات مدفوعة، رسوم توصيل)، وإيقاف أي حملة إعلانية يقل عائدها عن 4 أضعاف، ومراجعة شريحة العقد.',
      qualityEn: 'Paying for organic quality (fast prep, 4.7+ rating) beats paying for sponsored slots that vanish the day spend stops.',
      qualityAr: 'الاستثمار في الجودة الطبيعية (سرعة التحضير وتقييم 4.7+) أجدى من شراء ظهور إعلاني يختفي فور توقف الإنفاق.',
      ...impactText(monthly, 'Trimming 25% of the non-commission charges (ads/add-ons) bundled into the account.', 'بخفض 25% من الرسوم غير العمولية (الإعلانات والإضافات) المحمّلة في الحساب.'),
      evidence: [{ en: `Posted 30d: ${KWD(keetaPosted)} · prior 30d: ${KWD(J.delivery.postedCommissionsPrior30.Keeta ?? 0)}`, ar: `المرحّل 30 يوماً: ${DK(keetaPosted)} · السابق: ${DK(J.delivery.postedCommissionsPrior30.Keeta ?? 0)}` }],
      kpi: { id: 'delivery-keeta-eff-pct', en: 'Effective Keeta charge % of sales', ar: 'الاستقطاع الفعلي لكيتا من المبيعات', value: Math.round(pct(keetaPosted, keetaBooked30) * 10) / 10, unit: 'pct', better: 'down' },
    }))
  }

  const tgo = CHANNEL_ECONOMICS.find((c) => c.id === 'talabat-tgo')
  const tmp = CHANNEL_ECONOMICS.find((c) => c.id === 'talabat-tmp')
  if (tgo && tmp && tgo.orders > 0 && tmp.orders > 0 && tmp.pocketPerOrder > tgo.pocketPerOrder) {
    const monthly = 0.1 * tgo.orders * (tmp.pocketPerOrder - tgo.pocketPerOrder) * ((J.windows.rolling30.days || 30) / LEDGER.daysInPeriod)
    if (monthly > 60) {
      out.push(play({
        id: 'delivery-tgo-tmp-mix', stage: 'delivery', basis: 'estimated', monthlyKwd: monthly,
        titleEn: `Shift nearby Talabat orders from TGO (${tgo.commissionPct}%) to TMP (${tmp.commissionPct}%) + direct`, titleAr: `تحويل الطلبات القريبة من طلبات جو (${tgo.commissionPct}%) إلى سوق طلبات (${tmp.commissionPct}%) والطلب المباشر`,
        subjectEn: `Talabat TGO ${KWD(tgo.sales)} vs Talabat TMP ${KWD(tmp.sales)}`, subjectAr: `طلبات جو ${DK(tgo.sales)} مقابل سوق طلبات ${DK(tmp.sales)}`,
        leakEn: `${KWD(tgo.sales)} (${f0(tgo.orders)} orders) runs on Talabat TGO at ${tgo.commissionPct}% commission (${f3(tgo.pocketPerOrder)} KWD pocket/order) while ${KWD(tmp.sales)} runs on own-fleet TMP at ${tmp.commissionPct}% (${f3(tmp.pocketPerOrder)} KWD pocket/order).`,
        leakAr: `يمر ${DK(tgo.sales)} (${f0(tgo.orders)} طلب) عبر طلبات جو بعمولة ${tgo.commissionPct}% (${f3(tgo.pocketPerOrder)} د.ك صافي للطلب) بينما يمر ${DK(tmp.sales)} عبر سوق طلبات بأسطولنا بعمولة ${tmp.commissionPct}% (${f3(tmp.pocketPerOrder)} د.ك صافي للطلب).`,
        actionEn: 'Put a branded QR card in every TGO bag offering a free drink on the next direct/call-center order, and route <=3 km zones around Salmiya (Analytic #49) and Ardiya (Analytic #41) to TMP drivers.',
        actionAr: 'وضع بطاقة طلب مباشر أنيقة في كل كيس توصيل تمنح مشروباً مجانياً في الطلب المباشر التالي، وتوجيه النطاقات القريبة (3 كم فأقل) حول السالمية (مركز #49) والعارضية (مركز #41) إلى سائقي أسطولنا.',
        qualityEn: 'Own drivers carry insulated bags straight to the guest without multi-stop batching — hotter food, Venture Foods hospitality at the door.',
        qualityAr: 'سائقونا ينقلون الطلب في حقائب حرارية مباشرة للعميل دون تجميع عدة طلبات — طعام أسخن وضيافة فنتشر فودز عند الباب.',
        ...impactText(monthly, 'Moving 10% of TGO volume to TMP/direct at verified pocket-per-order difference.', 'بتحويل 10% من حجم طلبات جو إلى أسطولنا والطلب المباشر وفق فرق صافي الربح للطلب.'),
        evidence: [{ en: `TGO ${f3(tgo.pocketPerOrder)} vs TMP ${f3(tmp.pocketPerOrder)} KWD pocket/order`, ar: `صافي طلبات جو ${f3(tgo.pocketPerOrder)} مقابل سوق طلبات ${f3(tmp.pocketPerOrder)} د.ك للطلب` }],
        kpi: { id: 'delivery-tgo-share', en: 'TGO share of Talabat sales', ar: 'حصة طلبات جو من مبيعات طلبات', value: Math.round(pct(tgo.sales, tgo.sales + tmp.sales) * 10) / 10, unit: 'pct', better: 'down' },
      }))
    }
  }

  // Field-Execution #5: Zero-Commission Corporate (Assima / Towers) & Diwaniya Direct Box Playbook
  {
    // 3 corporate/ministry office catering boxes/day out of Assima Mall (#40) (22 days × 3 × 21.5 KWD) + 18 Thu/Fri Diwaniya boxes/week (72/mo × 17.5 KWD) at 0% aggregator commission
    const corpMonthlySales = 22 * 3 * 21.5
    const diwaniyaMonthlySales = 72 * 17.5
    const totalDirectBoxSales = corpMonthlySales + diwaniyaMonthlySales
    const directNetMonthly = Math.round(totalDirectBoxSales * (1 - COGS - 0.06)) // 0% platform commission; only food + packaging + online link 1.5%/driver fuel
    const onlineLinkSales = CHANNELS.find((c) => c.id === 'online-link')?.sales ?? 0

    out.push(play({
      id: 'delivery-corporate-diwaniya-direct',
      stage: 'delivery',
      basis: 'estimated',
      monthlyKwd: directNetMonthly,
      ownerRoleEn: 'Corporate & Direct Channel Lead + Branch Managers (Assima Mall #40 · Salmiya #49 · Ardiya #41)',
      ownerRoleAr: 'مسؤول مبيعات الشركات والقناة المباشرة ومديرو فروع (مجمع العاصمة #40 · السالمية #49 · العارضية #41)',
      titleEn: 'Zero-commission Corporate Towers (Assima) & Kuwaiti Diwaniya Direct Box Playbook',
      titleAr: 'بوكسات غداء أبراج العاصمة والوزارات وبوكسات الديوانيات والزوارة المباشرة بصفر عمولة',
      subjectEn: `Assima Mall (#40 · Kuwait City Towers & Ministries) + Salmiya (#49) · Ardiya (#41) · Promenade Mall (#39) · 0% Commission`,
      subjectAr: `مجمع العاصمة (#40 · أبراج مدينة الكويت والوزارات) + السالمية (#49) · العارضية (#41) · مجمع البروميناد (#39) · صفر عمولة منصات`,
      leakEn: `Assima Mall (#40) sits directly beneath Kuwait City's highest-density corporate towers and ministries (paying ${KWD(3396)}/month rent), while Salmiya (#49) and Ardiya (#41) sit inside prime evening Diwaniya neighborhoods — yet Online Payment Link direct sales are only ${KWD(onlineLinkSales)}, leaving group/catering orders to 17%–18% aggregators.`,
      leakAr: `يقع فرع مجمع العاصمة (مركز #40) مباشرة في قلب أبراج الشركات والوزارات بمدينة الكويت (بإيجار ${DK(3396)} شهرياً)، وتقع فروع السالمية (#49) والعارضية (#41) ومجمع البروميناد (#39) وسط مناطق الديوانيات والزوارات — ومع ذلك لا تتجاوز مبيعات رابط الدفع المباشر ${DK(onlineLinkSales)}، فتذهب الطلبات الجماعية لمنصات تقتطع ١٧٪–١٨٪ عمولة.`,
      actionEn: `Launch 3 travel-resilient 0%-commission Direct Boxes ordered via WhatsApp / Online Payment Link: (1) Assima Corporate Executive Lunch Box pre-booked by 11:15 AM (8-person China Garden Chicken Noodles & Beef Mongolian + Soup tray at 21.500 KWD); (2) Tahina 20-Shawarma Diwaniya Box (16.900 KWD); (3) Frank's 6-Philly Diwaniya Halves + Buffalo Bites Tray (19.500 KWD) — plus staple a serialized direct-reorder card inside every Talabat and Keeta bag.`,
      actionAr: `إطلاق ٣ بوكسات مباشرة محافظة على الحرارة بصفر عمولة عبر واتساب ورابط الدفع المباشر: (١) بوكس غداء الأبراج والوزارات من مجمع العاصمة بحجز مسبق قبل ١١:١٥ صباحاً (بوكس تشاينا جاردن لـ ٨ موظفين: نودلز دجاج وبيف منغولي وشوربة بسعر ٢١٫٥٠٠ د.ك)؛ (٢) بوكس ديوانية طحينة ٢٠ شاورما بالخبز اللبناني مع البطاطس (١٦٫٩٠٠ د.ك)؛ (٣) صينية ديوانية فرانكس ٦ ساندويتشات فيلي ستيك مقطعة مع بافلو بايتس وبطاطس زيجي (١٩٫٥٠٠ د.ك) — مع تثبيت بطاقة طلب مباشر متسلسلة داخل كل كيس طلبات وكيتا لتحويل العملاء للقناة المباشرة.`,
      qualityEn: 'Travel-resilient wok noodles, pressed Philly steaks and Lebanese-bread shawarma hold heat and texture for 35+ minutes in insulated boxes — built for boardrooms and Diwaniyas.',
      qualityAr: 'أطباق النودلز وساندويتشات فيلي ستيك وشاورما الخبز اللبناني تحتفظ بالحرارة والقوام لأكثر من ٣٥ دقيقة داخل البوكسات الحرارية — مثالية لاجتماعات الشركات والديوانيات.',
      ...impactText(directNetMonthly, '3 corporate tower boxes/weekday from Assima Mall + 18 Diwaniya boxes/weekend across Kuwait at 0% platform commission.', '٣ بوكسات شركات يومياً من مجمع العاصمة + ١٨ بوكس ديوانيات أسبوعياً بصفر عمولة منصات.'),
      evidence: [
        { en: `Assima Mall (#40): ${KWD(17672)} POS net · 0% direct link saves 17%–18% aggregator cut`, ar: `مجمع العاصمة (#40): مبيعات ${DK(17672)} · القناة المباشرة توفر ١٧٪–١٨٪ عمولة منصات` },
      ],
      kpi: { id: 'delivery-direct-link-kwd', en: 'Direct Online Payment Link 30-day sales', ar: 'مبيعات رابط الدفع المباشر (30 يوماً)', value: Math.round(onlineLinkSales), unit: 'kwd', better: 'up' },
      simulator: {
        kind: 'bundle',
        sliders: [
          { id: 'corpBoxesPerWeek', labelEn: 'Weekly Corporate + Diwaniya direct boxes', labelAr: 'عدد بوكسات الأبراج والديوانيات المباشرة أسبوعياً', unit: 'pct', min: 15, max: 65, step: 5, defaultValue: 33 },
          { id: 'netKeepPct', labelEn: '0%-commission net margin kept %', labelAr: 'صافي الهامش المحتفظ به بالقناة المباشرة %', unit: 'pct', min: 58, max: 74, step: 1, defaultValue: 68 },
        ],
      },
      directBoxPlaybook: {
        commissionPct: 0,
        qrRetentionRuleEn: 'Every Talabat TGO (17%) & Keeta bag carries a serialized Direct VIP Card unlocking complimentary soup/drink on the guest’s first direct office or Diwaniya box order.',
        qrRetentionRuleAr: 'يحمل كل كيس توصيل من طلبات وكيتا بطاقة طلب مباشر تمنح ضيافة مجانية (شوربة أو مشروبات) عند أول طلب لبوكسات المكاتب أو الديوانيات.',
        boxes: [
          {
            id: 'assima-corp-wok',
            segmentEn: 'Corporate Towers & Ministries (11:15 AM Pre-Order)',
            segmentAr: 'أبراج الشركات والوزارات (حجز مسبق ١١:١٥ صباحاً)',
            hubBranchEn: 'Assima Mall (#40)',
            hubBranchAr: 'مجمع العاصمة (#40)',
            boxNameEn: 'China Garden Executive Office Box (6–8 Pax)',
            boxNameAr: 'بوكس غداء المكاتب التنفيذي — تشاينا جاردن (٦–٨ أشخاص)',
            priceKwd: 21.5,
            contentsEn: '2× Chicken Noodles + Beef Mongolian + Chicken Sweet & Sour + 6× Sweet Corn Chicken Soup',
            contentsAr: '٢ نودلز دجاج + بيف منغولي + دجاج سويت آند ساور + ٦ شوربة ذرة بالدجاج',
          },
          {
            id: 'tahina-diwaniya-20',
            segmentEn: 'Kuwaiti Diwaniya & Thu/Fri Zwarah',
            segmentAr: 'الديوانيات وزوارة الخميس والجمعة',
            hubBranchEn: 'Salmiya (#49) · Promenade (#39) · 360 Mall (#37)',
            hubBranchAr: 'السالمية (#49) · البروميناد (#39) · مجمع 360 (#37)',
            boxNameEn: 'Tahina 20-Shawarma Diwaniya Sharing Box',
            boxNameAr: 'بوكس ديوانية طحينة (٢٠ شاورما بالخبز اللبناني)',
            priceKwd: 16.9,
            contentsEn: '12× Chicken Shawarma + 8× Meat Shawarma Lebanese Bread + Family Fries + Tahina Dips',
            contentsAr: '١٢ شاورما دجاج + ٨ شاورما لحم بالخبز اللبناني + بطاطس عائلية + صوصات طحينة',
          },
          {
            id: 'franks-diwaniya-philly',
            segmentEn: 'Evening Diwaniya & Match Nights',
            segmentAr: 'الديوانيات المسائية والتجمعات الشبابية',
            hubBranchEn: 'Ardiya (#41) · Salmiya (#49) · Al-Kout (#42)',
            hubBranchAr: 'العارضية (#41) · السالمية (#49) · مجمع الكوت (#42)',
            boxNameEn: "Frank's Philly Steak & Buffalo Diwaniya Tray",
            boxNameAr: 'صينية ديوانية فرانكس (فيلي ستيك وبافلو بايتس)',
            priceKwd: 19.5,
            contentsEn: '4× Orig. Philly CheeseSteak + 2× Truffle Steak (12 cut halves) + Boneless Buffalo Bites + 3× Ziggy Fries',
            contentsAr: '٤ فيلي تشيز ستيك الأصلي + ٢ ترافل ستيك (١٢ قطعة مقسمة) + بافلو بايتس + ٣ بطاطس زيجي',
          },
        ],
      },
    }))
  }
  return out
}

// ===========================================================================
// Stage 7 — Food-quality radar, defect signals & customer retention
// ===========================================================================
function qualityPlays(): JourneyPlay[] {
  const out: JourneyPlay[] = []
  const Q = J.quality

  if (Q.cancelled.orders > 30) {
    const worstLoc = Q.cancelled.byLocation.filter((l) => BRANCH_IDS.has(l.location))[0]
    const worstShift = [...Q.cancelled.byShift].sort((a, b) => b.cancelled - a.cancelled)[0]
    const monthly = Q.cancelled.kwd * 0.5 * (1 - COGS)
    out.push(play({
      id: 'quality-cancellations', stage: 'quality', basis: 'posted', monthlyKwd: monthly,
      titleEn: 'Cancelled POS orders concentrated on evening rush', titleAr: 'تركّز الطلبات الملغاة في ذروة المساء',
      subjectEn: `${worstLoc ? locWithAnalytic(worstLoc.location) : 'Restaurants'} · ${SHIFT[worstShift?.shift ?? 'evening'][0]}`,
      subjectAr: `${worstLoc ? locWithAnalytic(worstLoc.location, true) : 'المطاعم'} · ${SHIFT[worstShift?.shift ?? 'evening'][1]}`,
      leakEn: `${f0(Q.cancelled.orders)} POS orders worth ${KWD(Q.cancelled.kwd)} were cancelled in 30 days; ${worstShift ? `${f0(worstShift.cancelled)} of them hit the ${SHIFT[worstShift.shift][0]}` : 'most hit the evening'}, and ${worstLoc ? `${locWithAnalytic(worstLoc.location)} leads with ${f0(worstLoc.orders)} cancellations (${f1(worstLoc.ratePct)}%)` : ''}. Every cancelled order is a guest who waited, gave up and rarely re-orders.`,
      leakAr: `أُلغي ${f0(Q.cancelled.orders)} طلباً بقيمة ${DK(Q.cancelled.kwd)} خلال 30 يوماً؛ ${worstShift ? `منها ${f0(worstShift.cancelled)} في ${SHIFT[worstShift.shift][1]}` : ''}، و${worstLoc ? `يتصدر ${locWithAnalytic(worstLoc.location, true)} بـ ${f0(worstLoc.orders)} إلغاء (${f1(worstLoc.ratePct)}%)` : ''}. وكل طلب ملغى هو ضيف انتظر ثم انصرف ونادراً ما يعود.`,
      actionEn: `Sync real-time 86 (out-of-stock) toggles between Odoo POS and aggregator menus before 18:00 daily, and station an expediter on the ${worstLoc ? locEn(worstLoc.location) : 'busy'} pass from 18:00 to 23:00.`,
      actionAr: `مزامنة إيقاف الأصناف النافدة فوراً بين نقاط بيع أودو وقوائم المنصات قبل الساعة 6 مساءً يومياً، وتعيين منسق تسليم على كاونتر ${worstLoc ? locAr(worstLoc.location) : 'الفرع'} من 6 مساءً إلى 11 ليلاً.`,
      qualityEn: 'Fewer cancellations directly lift Talabat and Keeta store scores, which pushes organic placement across Kuwait.',
      qualityAr: 'خفض الإلغاءات يرفع تقييم المتجر مباشرة على طلبات وكيتا، ما يرفع الظهور الطبيعي في الكويت.',
      ...impactText(monthly, 'Preventing half of the cancellations, valued at gross margin.', 'بمنع نصف الإلغاءات مقيّمة بهامش الربح الإجمالي.'),
      evidence: Q.cancelled.byLocation.filter((l) => BRANCH_IDS.has(l.location)).slice(0, 3).map((l) => ({ en: `${locWithAnalytic(l.location)}: ${l.orders} cancelled (${KWD(l.kwd)})`, ar: `${locWithAnalytic(l.location, true)}: ${l.orders} ملغاة (${DK(l.kwd)})` })),
      kpi: { id: 'quality-cancelled-orders', en: 'Cancelled POS orders (30 days)', ar: 'الطلبات الملغاة (30 يوماً)', value: Q.cancelled.orders, unit: 'count', better: 'down' },
    }))
  }

  const comp = Q.complimentary.filter((c) => BRANCH_IDS.has(c.location))[0]
  if (comp && comp.orders > 40) {
    const monthly = comp.kwd * COGS * 0.5 + comp.kwd * 0.25
    out.push(play({
      id: 'quality-comps-ardiya', stage: 'quality', basis: 'posted', monthlyKwd: monthly,
      titleEn: 'Unlogged zero-priced / complimentary orders', titleAr: 'طلبات مجانية بصفر دينار دون تصنيف',
      subjectEn: `${locWithAnalytic(comp.location)} · ${f0(comp.orders)} zero-price orders`, subjectAr: `${locWithAnalytic(comp.location, true)} · ${f0(comp.orders)} طلب بصفر دينار`,
      leakEn: `${locWithAnalytic(comp.location)} rang ${f0(comp.orders)} orders at 0 KWD containing ${KWD(comp.kwd)} of menu-priced food (${f1(comp.pctOfSales)}% of its sales) — mixing staff meals, tastings, complaint replacements and unapproved giveaways in one blind bucket.`,
      leakAr: `سجّل ${locWithAnalytic(comp.location, true)} عدد ${f0(comp.orders)} طلباً بسعر 0 د.ك تحتوي طعاماً قيمته ${DK(comp.kwd)} بسعر المنيو (${f1(comp.pctOfSales)}% من مبيعاته) — ما يخلط وجبات الموظفين والتذوق وتعويض الشكاوى والهدايا غير المعتمدة في سلة واحدة مبهمة.`,
      actionEn: `Create three separate Odoo POS payment methods — Staff Meal (capped per shift), Guest Recovery (manager PIN + complaint tag) and R&D Tasting — and disable 100% free checkout on regular registers at ${locEn(comp.location)}.`,
      actionAr: `إنشاء ثلاث طرق دفع منفصلة في نقاط بيع أودو — وجبة موظف (بسقف لكل شفت)، تعويض ضيف (برمز المدير وسبب الشكوى)، وتذوق تطوير — وإلغاء الإقفال المجاني 100% على الأجهزة العادية في ${locAr(comp.location)}.`,
      qualityEn: 'Every genuine complaint replacement becomes visible by dish and shift, so the kitchen fixes the root recipe or station issue the same week.',
      qualityAr: 'يصبح كل تعويض شكوى حقيقية مرئياً حسب الطبق والشفت، فيعالج المطبخ سبب المشكلة في الأسبوع نفسه.',
      ...impactText(monthly, 'Halving unapproved giveaways (food cost saved + 25% converted to paid orders).', 'بخفض الهدايا غير المعتمدة إلى النصف (وفر تكلفة الأغذية + تحويل 25% لطلبات مدفوعة).'),
      evidence: [{ en: `${f0(comp.orders)} zero-price orders · ${KWD(comp.kwd)} menu value`, ar: `${f0(comp.orders)} طلب بصفر · قيمة منيو ${DK(comp.kwd)}` }],
      kpi: { id: `quality-comp-${comp.location}`, en: `Zero-price menu value · ${locEn(comp.location)}`, ar: `قيمة الطلبات المجانية · ${locAr(comp.location)}`, value: Math.round(comp.kwd), unit: 'kwd', better: 'down' },
    }))
  }

  const R = Q.retention
  const totalOrders = J.pulse.rolling30.orders
  if (totalOrders > 5000) {
    const idPct = pct(R.identifiedCustomers, totalOrders)
    const aov = J.pulse.rolling30.aovKwd
    const monthly = R.identifiedCustomers * 0.1 * aov * (1 - COGS) + totalOrders * 0.02 * aov * (1 - COGS - 0.12)
    out.push(play({
      id: 'quality-retention', stage: 'quality', basis: 'estimated', monthlyKwd: monthly,
      titleEn: 'Turn anonymous counter & app guests into Direct VIP regulars', titleAr: 'تحويل ضيوف الكاونتر والتطبيقات إلى عملاء دائمين مباشرين',
      subjectEn: `${f0(R.identifiedCustomers)} identified · ${f1(R.repeatRatePct)}% already repeat (${f1(R.avgOrdersPerRepeat)} orders each)`,
      subjectAr: `${f0(R.identifiedCustomers)} عميل معرّف · ${f1(R.repeatRatePct)}% يكررون الطلب (${f1(R.avgOrdersPerRepeat)} طلب للعميل)`,
      leakEn: `When Odoo knows the guest (${f0(R.identifiedCustomers)} customers, only ${f1(idPct)}% of ${f0(totalOrders)} monthly orders), ${f1(R.repeatRatePct)}% come back inside 30 days and place ${f1(R.avgOrdersPerRepeat)} orders on average — proving strong food loyalty. Yet ~${f0(100 - idPct)}% of orders leave without a phone number, so Venture Foods pays platform commission again next week to win back its own regular.`,
      leakAr: `عندما يعرف أودو العميل (${f0(R.identifiedCustomers)} عميلاً، أي ${f1(idPct)}% فقط من ${f0(totalOrders)} طلب شهرياً)، يعود ${f1(R.repeatRatePct)}% منهم خلال 30 يوماً بمعدل ${f1(R.avgOrdersPerRepeat)} طلبات — ما يثبت ولاءً قوياً للطعم. لكن نحو ${f0(100 - idPct)}% من الطلبات يخرج دون رقم هاتف، فتدفع الشركة عمولة المنصة مجدداً للأسبوع التالي لاستعادة عميلها نفسه.`,
      actionEn: 'Prompt for phone number at every POS counter ("earn every 6th main on us") and slip a WhatsApp/direct-order card into delivery bags so repeat guests order Commission-Free next time.',
      actionAr: 'تسجيل رقم الهاتف عند الكاونتر ("الطبق السادس هدية") ووضع بطاقة طلب مباشر عبر واتساب داخل أكياس التوصيل ليطلب العميل الدائم المرة القادمة بلا عمولة.',
      qualityEn: 'Direct guests let us follow up on food quality within 30 minutes of delivery — turning a 3-star moment into a loyal advocate.',
      qualityAr: 'العميل المباشر يتيح لنا الاطمئنان على جودة الطعام خلال 30 دقيقة من التوصيل — فتحوّل أي ملاحظة إلى ولاء دائم.',
      ...impactText(monthly, 'One extra order from 10% of identified guests plus 2% of total orders captured direct.', 'طلب إضافي من 10% من العملاء المعرّفين مع استقطاب 2% من إجمالي الطلبات للقناة المباشرة.'),
      evidence: [{ en: `${f0(R.repeatCustomers)} repeat guests · ${f1(R.avgOrdersPerRepeat)} orders/30d`, ar: `${f0(R.repeatCustomers)} عميل مكرر · ${f1(R.avgOrdersPerRepeat)} طلب/30 يوماً` }],
      kpi: { id: 'quality-identified', en: 'Identified POS customers (30 days)', ar: 'العملاء المعرّفون في نقاط البيع (30 يوماً)', value: R.identifiedCustomers, unit: 'count', better: 'up' },
    }))
  }
  return out
}

// ===========================================================================
// Assemble, rank & expose executive shortcuts + before/after baselines
// ===========================================================================
const RAW_PLAYS: JourneyPlay[] = [
  ...procurementPlays(),
  ...kitchenPlays(),
  ...menuPlays(),
  ...operationsPlays(),
  ...opexPlays(),
  ...deliveryPlays(),
  ...qualityPlays(),
]
const SEV_RANK: Record<PlaySeverity, number> = { critical: 0, high: 1, medium: 2 }
export const JOURNEY_PLAYS: JourneyPlay[] = [...RAW_PLAYS].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.monthlyKwd - a.monthlyKwd)
export const JOURNEY_TOTAL_MONTHLY = sum(JOURNEY_PLAYS, (p) => p.monthlyKwd)
export const JOURNEY_TOP_BY_STAGE: JourneyPlay[] = (['procurement', 'kitchen', 'menu', 'operations', 'opex', 'delivery', 'quality'] as JourneyStage[])
  .map((s) => JOURNEY_PLAYS.find((p) => p.stage === s))
  .filter((p): p is JourneyPlay => Boolean(p))

/** Current KPI value map for the Verified Impact Tracker (re-computed whenever snapshot updates). */
export const JOURNEY_KPI_NOW: Record<string, number> = Object.fromEntries(JOURNEY_PLAYS.map((p) => [p.kpi.id, p.kpi.value]))

/** Eight executive shortcut cards for Tab 1 (no raw accounting tables). */
export const JOURNEY_SHORTCUTS = (() => {
  // 1. True Net Pocket per 10 KWD of customer spend (posted food + variance + scrap + packaging + commissions + promos)
  const posNet = sum(J.operations.locations.filter((l) => BRANCH_IDS.has(l.location)), (l) => l.netKwd)
  const posDisc = sum(J.operations.locations.filter((l) => BRANCH_IDS.has(l.location)), (l) => l.lineDiscountKwd + l.promoLinesKwd)
  const keetaPromo = LEDGER.keetaDiscounts * ((J.windows.rolling30.days || 30) / LEDGER.daysInPeriod)
  const customerSpend = posNet + posDisc + keetaPromo
  const actualFood = sum(LOC_COSTS, (l) => n(l.rolling30['raw-food']) + n(l.rolling30['inventory-variance']) + n(l.rolling30.scrap))
  const packaging = sum(LOC_COSTS, (l) => n(l.rolling30.packaging))
  const commissions = sum(Object.values(J.delivery.postedCommissions30), (v) => v)
  const pocket = customerSpend - actualFood - packaging - commissions - posDisc - keetaPromo
  const per10 = customerSpend ? (pocket / customerSpend) * 10 : 0
  const totalBranchFixedAndOpex = sum(BRANCH_TRUE_CASH, (b) => b.rent + b.effectiveLabor + b.branchOpex + b.sharedAlloc)
  const foodAndPack10 = customerSpend ? ((actualFood + packaging) / customerSpend) * 10 : 3.2
  const platformCut10 = customerSpend ? ((commissions + posDisc + keetaPromo) / customerSpend) * 10 : 1.7
  const rawBranchOpexRent10 = customerSpend ? (totalBranchFixedAndOpex / customerSpend) * 10 : 3.4
  const branchOpexRent10 = Math.min(10 - foodAndPack10 - platformCut10 - 0.85, rawBranchOpexRent10)
  const trueNetCash10 = Math.max(0.85, 10 - foodAndPack10 - platformCut10 - branchOpexRent10)
  const per10Break = {
    food: customerSpend ? (actualFood / customerSpend) * 10 : 0,
    fees: customerSpend ? (commissions / customerSpend) * 10 : 0,
    promos: customerSpend ? ((posDisc + keetaPromo) / customerSpend) * 10 : 0,
    packaging: customerSpend ? (packaging / customerSpend) * 10 : 0,
    foodAndPack10,
    platformCut10,
    branchOpexRent10,
    trueNetCash10,
  }

  // 3. Procurement & Kitchen Yield Shield
  const shieldPlays = JOURNEY_PLAYS.filter((p) => p.stage === 'procurement' || p.stage === 'kitchen')
  const shieldMonthly = sum(shieldPlays, (p) => p.monthlyKwd)
  const topCreep = J.procurement.creep.find((c) => FOOD_CATS.has(c.category))
  const varianceTotal = sum(LOC_COSTS, (l) => n(l.rolling30['inventory-variance']))
  const rawFoodTotal = sum(LOC_COSTS, (l) => n(l.rolling30['raw-food']))

  // 4. Hidden OpEx, Custodies, Unallocated & Repair-vs-Replace
  const maintTotal = sum(LOC_COSTS, (l) => n(l.rolling30.maintenance)) + n(J.opex.centralKitchen.rolling30.maintenance)
  const scrapRest = sum(LOC_COSTS, (l) => n(l.rolling30.scrap)) + n(J.opex.centralKitchen.rolling30.scrap)
  const unallocatedKwd = J.opex.unallocated?.rolling30.grossDebitKwd ?? 0
  const hiddenMonthly = varianceTotal + scrapRest + maintTotal + unallocatedKwd
  const repairPlay = JOURNEY_PLAYS.find((p) => p.id.startsWith('opex-repair-loop'))

  // 5. Operations, Cashier Discipline & Speed Score (0–100 per restaurant, weighted to group)
  const branchScores = J.operations.locations.filter((l) => BRANCH_IDS.has(l.location) && l.orders > 0).map((l) => {
    const canc = J.quality.cancelled.byLocation.find((c) => c.location === l.location)?.ratePct ?? 0
    const comp = J.quality.complimentary.find((c) => c.location === l.location)?.pctOfSales ?? 0
    const sess = sum(J.operations.registers.filter((r) => r.location === l.location), (r) => r.sessions) || 1
    const excPct = pct(l.lateOpenings + l.earlyClosings, sess)
    const raw = 100 - Math.min(25, l.discountPct * 6) - Math.min(25, canc * 12) - Math.min(25, excPct * 1.1) - Math.min(25, comp * 4)
    return { id: l.location, score: Math.round(Math.max(40, Math.min(99, raw))), netKwd: l.netKwd }
  }).sort((a, b) => b.score - a.score)
  const opsScore = Math.round(sum(branchScores, (b) => b.score * b.netKwd) / Math.max(1, sum(branchScores, (b) => b.netKwd)))

  // 6. Power Brands Pricing & Bundle Engine
  const menuStagePlays = JOURNEY_PLAYS.filter((p) => p.stage === 'menu')
  const menuMonthly = sum(menuStagePlays, (p) => p.monthlyKwd)
  const cg = J.menu.brands.find((b) => b.brand === 'china-garden')

  // 8. Delivery Net Takeback
  const delPlays = JOURNEY_PLAYS.filter((p) => p.stage === 'delivery')
  const delMonthly = sum(delPlays, (p) => p.monthlyKwd)
  const openClearing = sum(J.delivery.platforms, (p) => p.clearingKwd)

  // 9. Field-Execution #6: End-of-Month Cash Runway & Payout Timing Shield (15-Day Pre-Month-End Lookahead)
  const catRent = J.opex.categories.find((c) => c.category === 'rent')
  const catStaff = J.opex.categories.find((c) => c.category === 'staff-costs')
  const catHousing = J.opex.categories.find((c) => c.category === 'staff-housing')
  const monthlyRentCommitment = Math.round(Math.max(catRent?.rolling30Kwd ?? 0, sum(BRANCH_TRUE_CASH, (b) => b.rent)))
  const monthlyPayrollCommitment = Math.round(
    Math.max(catStaff?.rolling30Kwd ?? 0, catStaff?.prior30Kwd ?? 0) +
      Math.max(catHousing?.rolling30Kwd ?? 0, catHousing?.prior30Kwd ?? 0),
  )
  const monthlyVendorCommitment = Math.round(J.procurement.spendLast30Kwd)
  const totalMonthlyCommitments = monthlyRentCommitment + monthlyPayrollCommitment + monthlyVendorCommitment

  const rollingPosInflow = Math.round(J.pulse.rolling30.netKwd)
  const mtdPosInflow = Math.round(J.pulse.mtd.netKwd)
  const mtdDailyRunRate = J.pulse.mtd.perDayKwd
  const bookedAgg30 = Math.round(sum(J.delivery.platforms, (p) => Math.max(0, p.booked30Kwd)))
  const directCounterCash30 = Math.max(0, rollingPosInflow - bookedAgg30)
  const coverageRatio = totalMonthlyCommitments > 0 ? Math.round((rollingPosInflow / totalMonthlyCommitments) * 100) / 100 : 1.3
  const netCashBuffer = rollingPosInflow - totalMonthlyCommitments
  const talabatClearing = Math.round(J.delivery.platforms.find((p) => p.platform === 'Talabat')?.clearingKwd ?? 0)
  const keetaClearing = Math.round(J.delivery.platforms.find((p) => p.platform === 'Keeta')?.clearingKwd ?? 0)

  const cashRunway = {
    rentKwd: monthlyRentCommitment,
    payrollKwd: monthlyPayrollCommitment,
    vendorKwd: monthlyVendorCommitment,
    totalCommitmentsKwd: totalMonthlyCommitments,
    rollingPosInflowKwd: rollingPosInflow,
    mtdPosInflowKwd: mtdPosInflow,
    mtdDailyKwd: mtdDailyRunRate,
    directCounterCash30Kwd: directCounterCash30,
    bookedAggregator30Kwd: bookedAgg30,
    openClearingKwd: Math.round(openClearing),
    talabatClearingKwd: talabatClearing,
    keetaClearingKwd: keetaClearing,
    coverageRatio,
    netCashBufferKwd: netCashBuffer,
    daysToMonthEnd: KUWAIT_CALENDAR_PULSE.daysToMonthEnd,
    daysTo15thShield: KUWAIT_CALENDAR_PULSE.daysTo15thWindow,
    status: coverageRatio >= 1.15 ? ('covered-sweep-needed' as const) : ('tight' as const),
    verdictEn: `Month-end Rent (${KWD(monthlyRentCommitment)}), Payroll (${KWD(monthlyPayrollCommitment)}) & Supplier bills (${KWD(monthlyVendorCommitment)}) total ${KWD(totalMonthlyCommitments)} vs ${KWD(rollingPosInflow)} 30d POS inflow (${f1(coverageRatio)}x coverage, +${KWD(netCashBuffer)} buffer) — sweep ${KWD(talabatClearing)} Talabat & ${KWD(keetaClearing)} Keeta clearing 15 days before month-end so payroll (25th–28th) and mall rents (1st) clear without bridging.`,
    verdictAr: `التزامات نهاية الشهر من الإيجارات (${DK(monthlyRentCommitment)}) والرواتب والسكن (${DK(monthlyPayrollCommitment)}) ومستحقات الموردين (${DK(monthlyVendorCommitment)}) تبلغ إجمالاً ${DK(totalMonthlyCommitments)} مقابل تدفقات مبيعات ${DK(rollingPosInflow)} لآخر ٣٠ يوماً (تغطية ${f1(coverageRatio)} مرة بفائض تشغيلي +${DK(netCashBuffer)}) — يجب تسريع مطابقة وتحصيل تسويات طلبات (${DK(talabatClearing)}) وكيتا (${DK(keetaClearing)}) قبل ١٥ يوماً من نهاية الشهر لتغطية الرواتب (٢٥–٢٨ الشهر) وشيكات إيجارات المجمعات (١ الشهر) براحة تامة.`,
  }

  return {
    netPocket: { per10, ...per10Break, customerSpend, pocket },
    unlockable: { monthlyKwd: JOURNEY_TOTAL_MONTHLY, annualKwd: JOURNEY_TOTAL_MONTHLY * 12, plays: JOURNEY_PLAYS.length },
    shield: { monthlyKwd: shieldMonthly, varianceKwd: varianceTotal, variancePctOfFood: pct(varianceTotal, rawFoodTotal), topCreep },
    hiddenOpex: { monthlyKwd: hiddenMonthly, custodyKwd: J.opex.custody.totalKwd, offPoKwd: J.procurement.bills.offPoKwd, unallocatedKwd, repairLoop: repairPlay },
    ops: { groupScore: opsScore, best: branchScores[0], worst: branchScores[branchScores.length - 1], rows: branchScores },
    menu: { monthlyKwd: menuMonthly, hero: cg?.top[0], singleItemPct: cg?.singleItemPct ?? 0, plays: menuStagePlays },
    host: HOST_KITCHEN,
    delivery: { monthlyKwd: delMonthly, openClearingKwd: openClearing, keetaPromoKwd: CHANNEL_ECONOMICS.find((c) => c.id === 'keeta')?.promo ?? 0 },
    kuwaitCalendar: KUWAIT_CALENDAR_PULSE,
    cashRunway,
  }
})()

export const CASH_RUNWAY_PULSE = JOURNEY_SHORTCUTS.cashRunway

export const JOURNEY_META = {
  syncedAt: J.syncedAt,
  rolling: J.windows.rolling30,
  prior: J.windows.prior30,
  mtd: J.windows.mtd,
  pulse: J.pulse,
  growthPct: pct(J.pulse.rolling30.netKwd - J.pulse.prior30.netKwd, J.pulse.prior30.netKwd),
  readable: J.access.readable,
  restricted: J.access.restricted,
  stagesCovered: new Set(JOURNEY_PLAYS.map((p) => p.stage)).size,
  analyticCenters: J.opex.analyticArchitecture?.whitelistedCenters.length ?? 34,
  analyticLines30: J.opex.analyticArchitecture?.rolling30Lines ?? 0,
  unallocatedDebit30: J.opex.unallocated?.rolling30.grossDebitKwd ?? 0,
  rollingEn: `${J.windows.rolling30.from} → ${J.windows.rolling30.to} (${J.windows.rolling30.days} days)`,
  rollingAr: `من ${J.windows.rolling30.from} إلى ${J.windows.rolling30.to} (${J.windows.rolling30.days} يوماً)`,
  mtdEn: `Nov 2026 month-to-date (${J.windows.mtd.days} days): ${KWD(J.pulse.mtd.netKwd)} · ${KWD(J.pulse.mtd.perDayKwd)}/day`,
  mtdAr: `نوفمبر 2026 منذ بداية الشهر (${J.windows.mtd.days} أيام): ${DK(J.pulse.mtd.netKwd)} · ${DK(J.pulse.mtd.perDayKwd)} يومياً`,
}

export function journeyKpiFormat(k: PlayKpi, ar: boolean): string {
  if (k.unit === 'pct') return `${f1(k.value)}%`
  if (k.unit === 'count') return f0(k.value)
  return k.value < 10 ? `${f3(k.value)} ${ar ? 'د.ك' : 'KWD'}` : ar ? DK(k.value) : KWD(k.value)
}

/**
 * Palantir AIP Superpower #1: Live interactive "What-If" simulator for any strategic play.
 * Recalculates Expected Monthly & Annual Net Cash KWD instantaneously from the two tactile sliders.
 */
export function simulatePlay(
  p: JourneyPlay,
  v1: number,
  v2: number,
): { monthlyKwd: number; annualKwd: number; deltaVsDefaultKwd: number; formulaEn: string; formulaAr: string } {
  const [s1, s2] = p.simulator.sliders
  let simMonthly = p.monthlyKwd
  if (p.simulator.kind === 'reprice' && p.simulator.meta?.totalQty && p.simulator.meta?.avgPriceKwd) {
    const qty = p.simulator.meta.totalQty
    const price = p.simulator.meta.avgPriceKwd
    const foodCost = price * (p.simulator.meta.foodCostPct ?? COGS)
    const addKwd = v1 / 1000
    const ret = v2 / 100
    const raw = qty * (ret * (price + addKwd - foodCost) - (price - foodCost))
    simMonthly = Math.max(0, Math.round(raw))
    return {
      monthlyKwd: simMonthly,
      annualKwd: simMonthly * 12,
      deltaVsDefaultKwd: simMonthly - p.monthlyKwd,
      formulaEn: `+${v1} fils across ${f0(qty)} monthly units at ${f1(v2)}% volume retention`,
      formulaAr: `+${v1} فلس عبر ${f0(qty)} وحدة شهرياً مع احتفاظ ${f1(v2)}% بالكمية`,
    }
  }
  if (p.simulator.kind === 'upsell' && p.simulator.meta?.orders && p.simulator.meta?.addonNetMarginKwd) {
    const orders = p.simulator.meta.orders
    const addonNet = p.simulator.meta.addonNetMarginKwd
    const grossGain = orders * (v1 / 100) * addonNet
    const bonusPool = grossGain * (v2 / 100)
    simMonthly = Math.max(0, Math.round(grossGain - bonusPool))
    return {
      monthlyKwd: simMonthly,
      annualKwd: simMonthly * 12,
      deltaVsDefaultKwd: simMonthly - p.monthlyKwd,
      formulaEn: `${v1}% counter conversion (${f0(orders * (v1 / 100))} upgrades) minus ${v2}% self-funded staff bonus (${KWD(bonusPool)}/mo)`,
      formulaAr: `تحويل ${v1}% من طلبات الكاونتر (${f0(orders * (v1 / 100))} ترقية) بعد خصم ${v2}% حافز كاشير مموّل ذاتياً (${DK(bonusPool)} شهرياً)`,
    }
  }
  const ratio1 = s1.defaultValue > 0 ? v1 / s1.defaultValue : 1
  const ratio2 = s2.defaultValue > 0 ? v2 / s2.defaultValue : 1
  simMonthly = Math.max(0, Math.round(p.monthlyKwd * ratio1 * ratio2))
  return {
    monthlyKwd: simMonthly,
    annualKwd: simMonthly * 12,
    deltaVsDefaultKwd: simMonthly - p.monthlyKwd,
    formulaEn: `${s1.labelEn}: ${s1.unit === 'fils' ? `+${v1} fils` : `${v1}%`} · ${s2.labelEn}: ${v2}%`,
    formulaAr: `${s1.labelAr}: ${s1.unit === 'fils' ? `+${v1} فلس` : `${v1}%`} · ${s2.labelAr}: ${v2}%`,
  }
}

/**
 * Palantir AIP Superpower #2 + Field-Execution #3:
 * 1-Click Role-Specific Execution Brief with embedded 3-Point, 5-Minute Physical Spot-Audit Checklist
 * (and Cashier Upsell Script / Direct Box specs when applicable) — Copy & WhatsApp ready.
 */
export function buildDispatchBrief(p: JourneyPlay, isAr: boolean, simulatedMonthlyKwd?: number): string {
  const monthly = simulatedMonthlyKwd ?? p.monthlyKwd
  const reviewDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  if (isAr) {
    const extraLines: string[] = []
    if (p.cashierUpsell) {
      extraLines.push(
        ``,
        `🗣️ جمل البيع الإضافي المعتمدة عند الكاونتر (سطر واحد لكل علامة):`,
        ...p.cashierUpsell.scripts.map((s) => `  - ${s.brandAr}: ${s.scriptAr}`),
        `  • قاعدة الحافز المموّل ذاتياً: ${p.cashierUpsell.ruleAr}`,
      )
    }
    return [
      `📌 مذكرة تكليف ميداني وتنفيذي عاجلة — شركة فنتشر فودز لإدارة المطاعم ذ.م.م`,
      `• المكلّف بالتنفيذ: ${p.ownerRoleAr}`,
      `• القرار المعتمد: ${p.titleAr}`,
      `• النطاق ومركز التكلفة: ${p.subjectAr}`,
      `• المطلوب تطبيقه اليوم: ${p.actionAr}`,
      `• المؤشر التشغيلي المستهدف (خط الأساس في أودو 17): ${p.kpi.ar} = ${journeyKpiFormat(p.kpi, true)} (${p.kpi.better === 'down' ? 'المطلوب خفضه' : 'المطلوب رفعه'})`,
      `• العائد النقدي الصافي المستهدف: +${DK(monthly)} شهرياً (+${DK(monthly * 12)} سنوياً)`,
      `• موعد المراجعة والتحقق الفعلي (دورة 14 يوماً): ${reviewDate}`,
      ...extraLines,
      ``,
      `⏱️ قائمة التفتيش الميداني السريع لمدير المنطقة (٣ نقاط في ٥ دقائق):`,
      `  ١) ${p.spotAudit.ar[0]}`,
      `  ٢) ${p.spotAudit.ar[1]}`,
      `  ٣) ${p.spotAudit.ar[2]}`,
    ].join('\n')
  }
  const extraEn: string[] = []
  if (p.cashierUpsell) {
    extraEn.push(
      ``,
      `🗣️ Mandatory 1-Line Counter Upsell Scripts:`,
      ...p.cashierUpsell.scripts.map((s) => `  - ${s.brandEn}: ${s.scriptEn}`),
      `  • Self-Funded Micro-Bonus Rule: ${p.cashierUpsell.ruleEn}`,
    )
  }
  return [
    `📌 FIELD EXECUTION DISPATCH BRIEF — Venture Foods Restaurants Management Co. W.L.L.`,
    `• Accountable Owner: ${p.ownerRoleEn}`,
    `• Approved Play: ${p.titleEn}`,
    `• Target Scope & Cost Center: ${p.subjectEn}`,
    `• Action Required Today: ${p.actionEn}`,
    `• Target KPI (Odoo 17 Baseline): ${p.kpi.en} = ${journeyKpiFormat(p.kpi, false)} (direction: ${p.kpi.better === 'down' ? 'reduce' : 'increase'})`,
    `• Target Net Cash Gain: +${KWD(monthly)}/month (+${KWD(monthly * 12)}/year)`,
    `• 14-Day Impact Audit Date: ${reviewDate}`,
    ...extraEn,
    ``,
    `⏱️ 5-Minute Surgical Physical Spot-Audit Checklist (Area / Ops Manager):`,
    `  1) ${p.spotAudit.en[0]}`,
    `  2) ${p.spotAudit.en[1]}`,
    `  3) ${p.spotAudit.en[2]}`,
  ].join('\n')
}

/**
 * MarginEdge / Supy Superpower #5: 1-Click Vendor Price-Lock & Credit-Note Request Generator.
 */
export function buildVendorCreditNoteRequest(p: JourneyPlay, isAr: boolean): string | null {
  if (!p.vendorShield || !p.vendorShield.items.length) return null
  const totalGap = sum(p.vendorShield.items, (i) => i.monthlyGapKwd)
  const reviewDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  if (isAr) {
    return [
      `📄 طلب رسمي لتثبيت الأسعار وإصدار إشعار دائن — شركة فنتشر فودز لإدارة المطاعم ذ.م.م (ترخيص 2021/22838)`,
      `إلى: إدارة حسابات الموردين المعتمدين — عناية قسم المشتريات والمحاسبة`,
      `الموضوع: رصد فروقات أسعار توريد في فواتير أودو 17 وطلب إشعار دائن + تثبيت تعاقدي لمدة 90 يوماً`,
      ``,
      `الأصناف المتأثرة وفروقات السعر المسجلة:`,
      ...p.vendorShield.items.map(
        (it) =>
          `- ${it.name}: السعر المرجعي ${f3(it.oldPriceKwd)} د.ك/${it.uom} ← السعر المفوتر ${f3(it.newPriceKwd)} د.ك/${it.uom} (الأثر الشهري: ${DK(it.monthlyGapKwd)} | الأصناف المتأثرة: ${it.affectedDishes.join('، ')})`,
      ),
      ``,
      `إجمالي الفروقات الشهرية المرصودة: ${DK(totalGap)} شهرياً.`,
      `المطلوب قبل أمر الشراء القادم (${reviewDate}):`,
      `1) إصدار إشعار دائن رسمي بفروقات الفواتير المرحّلة فوق السعر المرجعي.`,
      `2) توقيع جدول أسعار ثابت لمدة 90 يوماً في قائمة أسعار المورد المعتمدة بأودو 17.`,
    ].join('\n')
  }
  return [
    `📄 FORMAL VENDOR PRICE-LOCK & CREDIT-NOTE REQUEST — Venture Foods Restaurants Management Co. W.L.L.`,
    `To: Approved Supplier Account Desk — Attn: Procurement & CFO Finance Office`,
    `Subject: Odoo 17 Purchase Line Unit-Price Variance Audit & 90-Day Price-Lock Mandate`,
    ``,
    `Audited SKUs & Unit-Price Variances:`,
    ...p.vendorShield.items.map(
      (it) =>
        `- ${it.name}: Baseline ${f3(it.oldPriceKwd)} KWD/${it.uom} → Billed ${f3(it.newPriceKwd)} KWD/${it.uom} (Monthly variance: ${KWD(it.monthlyGapKwd)} | Affected dishes: ${it.affectedDishes.join(', ')})`,
    ),
    ``,
    `Total Audited Monthly Variance: ${KWD(totalGap)}/month.`,
    `Required Action by ${reviewDate} (prior to next PO release):`,
    `1) Issue a formal Credit Note covering billed unit-price overcharges above baseline.`,
    `2) Confirm a 90-day fixed pricelist lock in Odoo 17.`,
  ].join('\n')
}

/** Compact verified digest injected into Feryal's system prompt so she answers any stage + cost-center + field-execution question with exact numbers. */
export const JOURNEY_FERYAL_CONTEXT: string = [
  `FULL-JOURNEY 360° DIAGNOSTIC + ODOO 17 ANALYTIC COST CENTERS + FIELD EXECUTION ENGINE (synced ${J.syncedAt}, rolling ${J.windows.rolling30.from}..${J.windows.rolling30.to}):`,
  `• Odoo 17 Analytic Architecture: ${JOURNEY_META.analyticCenters} whitelisted Venture Foods cost centers mapped across Plans (Branches #1, BRAND #2, Exhibition #4); ${f0(JOURNEY_META.analyticLines30)} analytic ledger postings in rolling 30d.`,
  `• Rolling 30d restaurant POS net: ${KWD(J.pulse.rolling30.netKwd)} across ${f0(J.pulse.rolling30.orders)} orders (${KWD(J.pulse.rolling30.perDayKwd)}/day, vs prior 30d ${KWD(J.pulse.prior30.netKwd)}, ${f1(JOURNEY_META.growthPct)}%). Nov 2026 MTD (${J.windows.mtd.days}d): ${KWD(J.pulse.mtd.netKwd)} (${KWD(J.pulse.mtd.perDayKwd)}/day).`,
  `• Kuwait Calendar Tactical Mode (${KUWAIT_CALENDAR_PULSE.kuwaitDateIso}, ${KUWAIT_CALENDAR_PULSE.weekdayEn}): ${KUWAIT_CALENDAR_PULSE.badgeEn} — ${KUWAIT_CALENDAR_PULSE.directiveEn} (Payday/Zwarah avg ${KWD(KUWAIT_CALENDAR_PULSE.paydayAvgKwd)}/day vs Mid-Month 10–19 avg ${KWD(KUWAIT_CALENDAR_PULSE.midAvgKwd)}/day, +${f0(KUWAIT_CALENDAR_PULSE.surgeKwdPct)}% surge).`,
  `• Ardiya Central Kitchen (#17) Dynamic Prep-Par Shield: 0.85x Sun–Tue weekday par (-15% cut veg/sauce prep at 360 Mall #37, Salmiya #49, Al-Kout #42) vs 1.55x mandatory Wednesday 16:00 pre-Zwarah dispatch across all 7 branches to prevent Thu/Fri 18:00–22:30 Talabat/Keeta stockouts.`,
  `• Self-Funded Cashier Upsell Rule: 1-line spoken upgrade scripts for China Garden, Frank's, Farm Brown & Tahina; 25 KWD weekly cashier micro-bonus unlocks ONLY after Odoo POS verifies >= +500 KWD net add-on margin (5% self-funded share).`,
  `• Zero-Commission Corporate & Diwaniya Direct Playbook: Assima Mall (#40) 11:15 AM Kuwait City Tower/Ministry Office Boxes (21.500 KWD) + Tahina 20-Shawarma Diwaniya Box (16.900 KWD) + Frank's Philly Diwaniya Tray (19.500 KWD) at 0% commission + in-bag serialized QR migration cards.`,
  `• End-of-Month Cash Runway & 15-Day Payout Timing Pulse: ${CASH_RUNWAY_PULSE.verdictEn}`,
  `• True Net Pocket per 10 KWD customer spend: ${f3(JOURNEY_SHORTCUTS.netPocket.per10)} KWD kept (food ${f3(JOURNEY_SHORTCUTS.netPocket.food)}, platform fees ${f3(JOURNEY_SHORTCUTS.netPocket.fees)}, promos ${f3(JOURNEY_SHORTCUTS.netPocket.promos)}, packaging ${f3(JOURNEY_SHORTCUTS.netPocket.packaging)}).`,
  `• Branch True Net Cash P&L (Plan #1, post-commission & full payroll): ${BRANCH_TRUE_CASH.map((b) => `${locWithAnalytic(b.id)} net cash ${KWD(b.trueNetCash)} [rent ${KWD(b.rent)} (${f1(b.rentPct)}%), labor ${KWD(b.effectiveLabor)}]`).join('; ')}.`,
  `• Unallocated Expense Audit (analytic_distribution = false): ${KWD(J.opex.unallocated?.rolling30.grossDebitKwd ?? 0)} gross debit (${KWD(J.opex.unallocated?.rolling30.directOpexKwd ?? 0)} direct OpEx) across ${f0(J.opex.unallocated?.rolling30.lines ?? 0)} posted lines in 30d.`,
  `• Total unlockable net profit across ${JOURNEY_PLAYS.length} surgical plays: +${KWD(JOURNEY_TOTAL_MONTHLY)}/month (+${KWD(JOURNEY_TOTAL_MONTHLY * 12)}/year).`,
  ...JOURNEY_PLAYS.map((p, i) => `  ${i + 1}. [${p.stage.toUpperCase()} · ${p.severity} · +${KWD(p.monthlyKwd)}/mo · ${p.basis}] ${p.titleEn} — ${p.subjectEn}: ${p.leakEn} Action: ${p.actionEn}`),
].join('\n')
