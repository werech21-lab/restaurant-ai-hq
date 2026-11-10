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
  { id: 'all', n: 0, en: 'All Steps', ar: 'كل الخطوات' },
  { id: 'procurement', n: 1, en: '1. Purchases & Suppliers', ar: '١. المشتريات والموردين' },
  { id: 'kitchen', n: 2, en: '2. Kitchen & Cut Waste', ar: '٢. المطبخ وتقليل الهدر' },
  { id: 'menu', n: 3, en: '3. Menu Prices & Bundles', ar: '٣. أسعار المينيو والوجبات' },
  { id: 'operations', n: 4, en: '4. Branches & Cashiers', ar: '٤. الفروع والكاشير' },
  { id: 'opex', n: 5, en: '5. Rents, Expenses & Repairs', ar: '٥. الإيجارات والمصاريف والصيانة' },
  { id: 'delivery', n: 6, en: '6. Delivery Apps & Payouts', ar: '٦. تطبيقات التوصيل والتحصيل' },
  { id: 'quality', n: 7, en: '7. Food Quality & Repeat Guests', ar: '٧. جودة الأكل وتكرار الطلب' },
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
const locWithAnalytic = (id: string, ar = false) => (ar ? locAr(id) : locEn(id))

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
const brandWithAnalytic = (id: string, ar = false) => (ar ? brandAr(id) : brandEn(id))

const ITEM_AR_MAP: Record<string, string> = {
  'Orange Whole': 'البرتقال الطازج',
  'Basmati Rice CG TNB TAH': 'أرز بسمتي',
  'Soy Sauce Silver': 'صلصة الصويا',
  'Rice Stick Noodles': 'أعواد نودلز الأرز',
  'Shrimp Frozen 31/40': 'روبيان مجمد',
  'Red Chili Whole Dry': 'فلفل أحمر مجفف',
  'Purchasing Dept': 'مستلزمات قسم المشتريات',
  'HO Stationery': 'قرطاسية ومطبوعات',
  'Cheddar Cheese Spread 230G Kraft Bottle': 'جبن شيدر كرافت',
  'Chicken Brined FB Prod': 'دجاج متبل (فارم براون)',
  'Sambosa Pizza Prod': 'سمبوسة بيتزا',
  'Sambosa Cheese Prod': 'سمبوسة جبن',
  'General Tso Sauce Prod': 'صوص جنرال تسو',
  'Spring Onion': 'بصل أخضر',
  Broccoli: 'بروكلي طازج',
  'Capsicum Green Bell Pepper': 'فلفل أخضر بارد',
  'CG Printed Paper Plate 20*12.5*5 cm': 'صحون ورقية تشاينا جاردن',
  'CG Paper Box #8 Kids Meal Box 13x12x15cm': 'علب وجبات أطفال تشاينا جاردن',
  'Kinza Cola 250ml': 'كينزا كولا ٢٥٠ مل',
  'CG Paper Noodle Box #1 P.E Coated 73*60*92': 'علب نودلز تشاينا جاردن',
  'Thai Umbrella Jasmin Rice': 'أرز ياسمين تايلاندي',
  'Water Tap': 'مياه تحضير',
  'Green Peas Frozen': 'بازلاء خضراء مجمدة',
  'Truffle Mayo Sauce #1 Prod': 'صوص الترافل مايو',
  Mint: 'نعناع طازج',
  'Green Beans': 'فاصوليا خضراء',
  'Lettuce Romaine': 'خس روماني',
  'Coriander Herbs Bunch': 'كزبرة خضراء',
  'Onion Red': 'بصل أحمر',
  'Cabbage White': 'ملفوف أبيض',
  Carrot: 'جزر طازج',
  Ginger: 'زنجبيل طازج',
  'Plastic Bag Clear 25*35 cm': 'أكياس تغليف شفافة',
  'Chicken Noodles': 'نودلز الدجاج',
  'Veg Or Chicken Noodles Combo': 'وجبة نودلز الدجاج أو الخضار',
  'Vegetable Noodles': 'نودلز الخضار',
  'Beef Mongolian': 'بيف منغولي',
  'Mongolian Beef': 'بيف منغولي',
  'Sweet & Sour Chicken': 'دجاج سويت آند ساور',
  "Chicken Sweet 'N' Sour Platter For 6": 'صينية دجاج سويت آند ساور لـ ٦ أشخاص',
  'Dynamite Shrimp': 'دايناميت شرمب',
  'Shrimp Fried Rice': 'أرز مقلي بالروبيان',
  'Chicken Fried Rice': 'أرز مقلي بالدجاج',
  'Vegetable Fried Rice': 'أرز مقلي بالخضار',
  'Shrimp Noodles': 'نودلز الروبيان',
  'Spring Roll': 'سبرنغ رول',
  'Spicy Chicken Noodles': 'نودلز الدجاج الحار',
  'Kuwaiti Noodles': 'نودلز كويتية',
  'Orig. Philly CheeseSteak': 'فيلي تشيز ستيك الأصلي',
  'Phily Meal for 1': 'وجبة فيلي لشخص واحد',
  'Philly Phill Phill': 'ساندويتش فيلي دبل',
  "Mushroom n' Smith": 'ساندويتش مشروم ستيك',
  'Truffle Steak': 'ساندويتش ترافل ستيك',
  'Chicken Fillet Meal': 'وجبة فيليه دجاج',
  'Kids Meal -Chicken Filet': 'وجبة أطفال فيليه دجاج',
  'Kids Meal - Chicken Strip': 'وجبة أطفال ستربس دجاج',
  'Wrap Meal': 'وجبة راب دجاج',
  'Classic Chicken Sandwich': 'ساندويتش دجاج كلاسيك',
  'Classic Wrap': 'راب دجاج كلاسيك',
  'Just HOT! Chicken Sandwich': 'ساندويتش دجاج سبايسي',
  'Black Chicken Sandwich': 'ساندويتش دجاج بلاك',
  'Chicken Shawarma - Lebanese Bread': 'شاورما دجاج بالخبز اللبناني',
  'Shawarma Tahina Meal - Chicken': 'وجبة شاورما دجاج طحينة',
  'Sriracha Chicken Noodles': 'نودلز دجاج سيراتشا',
  'Fresh Noodles - Chicken': 'نودلز طازجة بالدجاج',
  'Fresh Noodles - Vegetarian': 'نودلز طازجة بالخضار',
  'Fresh Noodles - Vegetarian or Chicken Combo': 'وجبة نودلز طازجة بالدجاج أو الخضار',
  'Matara Original Karak': 'مطارة كرك أصلي',
  'Original Karak Cup': 'كوب كرك أصلي',
  'Chapati Box (6 pcs)': 'بوكس جباتي (٦ حبات)',
}

const ITEM_EN_MAP: Record<string, string> = {
  'Orange Whole': 'Fresh Oranges',
  'Basmati Rice CG TNB TAH': 'Basmati Rice',
  'Soy Sauce Silver': 'Soy Sauce',
  'Rice Stick Noodles': 'Rice Stick Noodles',
  'Shrimp Frozen 31/40': 'Frozen Shrimp',
  'Red Chili Whole Dry': 'Dried Red Chili',
  'Purchasing Dept': 'Purchasing Supplies',
  'HO Stationery': 'Office Stationery',
  'Cheddar Cheese Spread 230G Kraft Bottle': 'Kraft Cheddar Cheese',
  'Chicken Brined FB Prod': 'Marinated Chicken (Farm Brown)',
  'Sambosa Pizza Prod': 'Pizza Sambosa',
  'Sambosa Cheese Prod': 'Cheese Sambosa',
  'General Tso Sauce Prod': 'General Tso Sauce',
  'CG Printed Paper Plate 20*12.5*5 cm': 'China Garden Paper Plates',
  'CG Paper Box #8 Kids Meal Box 13x12x15cm': 'China Garden Kids Meal Boxes',
  'CG Paper Noodle Box #1 P.E Coated 73*60*92': 'China Garden Noodle Boxes',
  'Thai Umbrella Jasmin Rice': 'Thai Jasmine Rice',
  'Truffle Mayo Sauce #1 Prod': 'Truffle Mayo Sauce',
  'Plastic Bag Clear 25*35 cm': 'Clear Packaging Bags',
  'Pastry Wrapper Frozen medium 190*190mm': 'Pastry Wrappers',
}

export function enItemName(raw: string): string {
  const clean = raw
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^EXB\s+/i, '')
    .trim()
  if (ITEM_EN_MAP[clean]) return ITEM_EN_MAP[clean]
  return clean
    .replace(/\b(?:CG|TNB|TAH|FB)\b/g, '')
    .replace(/\bProd\b/gi, '')
    .replace(/#\d+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function arItemName(raw: string): string {
  const clean = raw
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^EXB\s+/i, '')
    .trim()
  if (ITEM_AR_MAP[clean]) return ITEM_AR_MAP[clean]
  return enItemName(clean)
}

/** Strips any residual raw Odoo internal IDs, cost-center numbers, GL codes or SKU tags from executive copy. */
export function stripRawOdooTags(text: string): string {
  return text
    .replace(/\s*\((?:مركز تكلفة|مركز|Analytic|Cost Center)\s*#?\d+\)/gi, '')
    .replace(/\s*\(#\d+\)/g, '')
    .replace(/\s*\(CK\d*\)/gi, '')
    .replace(/\bCG\s+TNB\s+TAH\b/gi, '')
    .replace(/\bAccount\s+\d{4,6}\b/gi, 'the expense ledger')
    .replace(/حساب\s+\d{4,6}/g, 'سجل المصروفات')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function arUom(uom: string): string {
  const u = uom.toLowerCase()
  if (u.includes('kg')) return 'كجم'
  if (u.includes('ltr') || u.includes('liter') || u === 'l') return 'لتر'
  if (u.includes('ctn') || u.includes('carton') || u.includes('box')) return 'كرتون'
  if (u.includes('pcs') || u.includes('unit') || u.includes('each')) return 'حبة'
  if (u.includes('btl') || u.includes('bottle')) return 'عبوة'
  if (u.includes('bag') || u.includes('pkt') || u.includes('pack')) return 'كيس'
  return 'وحدة'
}

function arPlatformName(plat: string): string {
  const map: Record<string, string> = {
    Talabat: 'طلبات',
    Keeta: 'كيتا',
    Deliveroo: 'ديليفرو',
    Jahez: 'جاهز',
    Snoonu: 'سنونو',
    Cari: 'كاري',
    Bilbayt: 'بالبيت',
  }
  return map[plat] ?? plat
}

function arRegisterName(reg: string): string {
  return reg
    .replace(/China Garden\s*\(Promenade\)/gi, 'كاشير تشاينا جاردن (البروميناد)')
    .replace(/Farm Brown\s*\(Promenade\)/gi, 'كاشير فارم براون (البروميناد)')
    .replace(/Tahina\s*\(promenade\)/gi, 'كاشير طحينة (البروميناد)')
    .replace(/Delivery\s*\(Promenade\)/gi, 'كاشير توصيل البروميناد')
    .replace(/China Garden\s*\(Assima Mall\)/gi, 'كاشير تشاينا جاردن (مجمع العاصمة)')
    .replace(/Delivery\s*\(Assima Mall\)/gi, 'كاشير توصيل مجمع العاصمة')
    .replace(/China Garden\s*\(360\)/gi, 'كاشير تشاينا جاردن (مجمع 360)')
    .replace(/Delivery\s*\(360\)/gi, 'كاشير توصيل مجمع 360')
    .replace(/China Garden\s*\(Salmiya\)/gi, 'كاشير تشاينا جاردن (السالمية)')
    .replace(/Delivery\s*\(Salmyia\)/gi, 'كاشير توصيل السالمية')
    .replace(/China Garden\s*\(KOUT\)/gi, 'كاشير تشاينا جاردن (الكوت)')
    .replace(/Delivery\s*\(Kout\)/gi, 'كاشير توصيل الكوت')
    .replace(/Delivery\s*\(Ardiya\)/gi, 'كاشير توصيل العارضية')
    .replace(/China Garden\s*\(Avenues\)/gi, 'كاشير تشاينا جاردن (الأفنيوز)')
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
        ownerRoleEn: 'Purchasing Manager & Finance Manager',
        ownerRoleAr: 'مسؤول المشتريات والمدير المالي',
      }
    case 'kitchen':
      return {
        ownerRoleEn: 'Executive Chef — Ardiya Central Kitchen',
        ownerRoleAr: 'الشيف التنفيذي — المطبخ المركزي بالعارضية',
      }
    case 'menu':
      return {
        ownerRoleEn: 'Operations Manager & Menu Team',
        ownerRoleAr: 'مدير العمليات ومسؤول المينيو',
      }
    case 'operations':
      return {
        ownerRoleEn: `Branch Manager & Area Manager (${subjectEn.split('·')[0].trim()})`,
        ownerRoleAr: `مدير الفرع ومدير المنطقة (${subjectAr.split('·')[0].trim()})`,
      }
    case 'opex':
      return {
        ownerRoleEn: 'Finance Manager & Accounting Team',
        ownerRoleAr: 'المدير المالي وقسم المحاسبة',
      }
    case 'delivery':
      return {
        ownerRoleEn: 'Delivery Apps Coordinator & Finance Team',
        ownerRoleAr: 'مسؤول تطبيقات التوصيل وقسم المحاسبة',
      }
    case 'quality':
      return {
        ownerRoleEn: 'Quality Supervisor & Customer Care',
        ownerRoleAr: 'مشرف الجودة ومتابعة الزبائن',
      }
  }
}

function defaultSimulatorForPlay(stage: JourneyStage, id: string): PlaySimulator {
  if (id.startsWith('menu-reprice-')) {
    return {
      kind: 'reprice',
      sliders: [
        { id: 'priceFils', labelEn: 'Price increase per dish (fils)', labelAr: 'الزيادة المقترحة على الطبق (فلس)', unit: 'fils', min: 100, max: 350, step: 25, defaultValue: 150 },
        { id: 'retentionPct', labelEn: 'Orders kept at new price %', labelAr: 'نسبة ثبات الطلبات بعد التعديل %', unit: 'pct', min: 95, max: 100, step: 0.5, defaultValue: 98 },
      ],
    }
  }
  if (id.startsWith('menu-basket-') || id.startsWith('menu-shop-basket-')) {
    return {
      kind: 'bundle',
      sliders: [
        { id: 'attachPct', labelEn: 'Customers adding a meal / drink %', labelAr: 'نسبة الزبائن اللي يضيفون وجبة أو مشروب %', unit: 'pct', min: 10, max: 35, step: 1, defaultValue: 15 },
        { id: 'marginPct', labelEn: 'Net profit margin on add-on %', labelAr: 'نسبة الربح الصافي من الإضافة %', unit: 'pct', min: 55, max: 80, step: 1, defaultValue: 70 },
      ],
    }
  }
  if (id.startsWith('opex-host-kitchen-')) {
    return {
      kind: 'host-kitchen',
      sliders: [
        { id: 'peerCapturePct', labelEn: 'Expected sales vs other branches %', labelAr: 'نسبة المبيعات المتوقعة مقارنة بالفروع الثانية %', unit: 'pct', min: 50, max: 100, step: 5, defaultValue: 75 },
        { id: 'netMarginPct', labelEn: 'Net profit after app fee & food %', labelAr: 'نسبة الربح الصافي بعد العمولة والأكل %', unit: 'pct', min: 22, max: 38, step: 1, defaultValue: 30 },
      ],
    }
  }
  const defaultCapture = stage === 'procurement' ? 70 : stage === 'kitchen' ? 50 : stage === 'delivery' ? 35 : 60
  return {
    kind: 'capture',
    sliders: [
      { id: 'capturePct', labelEn: 'Target savings achieved %', labelAr: 'نسبة التوفير المستهدفة %', unit: 'pct', min: 25, max: 90, step: 5, defaultValue: defaultCapture },
      { id: 'compliancePct', labelEn: 'Branch team follow-through %', labelAr: 'نسبة التزام الفروع بالتطبيق %', unit: 'pct', min: 75, max: 100, step: 5, defaultValue: 95 },
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
    windowEn: 'Days 20–29 (Payday) + Every Thu/Fri Zwarah',
    windowAr: 'أيام الرواتب (٢٠–٢٩ الشهر) + زوارة الخميس والجمعة',
    titleEn: 'Family & Zwarah Sharing Platters (Peak Days)',
    titleAr: 'صواني العائلة والزوارة لزيادة قيمة الفاتورة',
    bundlesEn: [
      'China Garden: Zwarah Family Platter (Chicken Noodles + Beef Mongolian + Sweet & Sour Chicken + 4 Corn Soups · 15.900 KWD)',
      "Frank's: 4× Orig. Philly CheeseSteak + 2× Ziggy Fries + Buffalo Bites Sharing Tray (17.500 KWD)",
      'Tahina: 16-Piece Lebanese Bread Chicken & Meat Shawarma Zwarah Box + Fries (13.900 KWD)',
    ],
    bundlesAr: [
      'تشاينا جاردن: صينية زوارة العائلة (نودلز دجاج + بيف منغولي + دجاج سويت آند ساور + ٤ شوربة ذرة بالدجاج بسعر ١٥٫٩٠٠ د.ك)',
      'فرانكس: صينية جمعة الأهل (٤ فيلي تشيز ستيك الأصلي + ٢ بطاطس زيجي + بافلو بايتس بسعر ١٧٫٥٠٠ د.ك)',
      'طحينة: بوكس شاورما الزوارة (١٦ شاورما دجاج ولحم بالخبز اللبناني مع البطاطس والطحينة بسعر ١٣٫٩٠٠ د.ك)',
    ],
    opsRuleEn: 'Put family boxes first on POS & delivery apps, stop percentage discounts, and keep full kitchen crew from 6:00 PM to 10:30 PM.',
    opsRuleAr: 'إظهار بوكسات العائلة والزوارة أول شيء في الكاشير والتطبيقات، وإيقاف الخصومات المفتوحة، وتجهيز طاقم المطبخ بالكامل من ٦:٠٠ إلى ١٠:٣٠ مساءً.',
  }

  const midMonthShield = {
    windowEn: 'Days 10–19 Mid-Month Quiet Days (Sun–Wed)',
    windowAr: 'أيام هدوء منتصف الشهر (١٠ إلى ١٩ الشهر — الأحد للأربعاء)',
    titleEn: 'Smart Solo & Duo Value Meals (No Margin-Burning Discounts)',
    titleAr: 'وجبات مشبعة للأفراد وشخصين بسعر مناسب (بدون خصومات تضر الربح)',
    bundlesEn: [
      'China Garden: Complete Solo Meal (Chicken/Veg Noodles + Sweet Corn Chicken Soup · 3.850 KWD)',
      'The Noodle Bar: Sriracha Chicken Noodles + Cold Drink Meal (3.950 KWD)',
      "Frank's: Orig. Philly CheeseSteak + Ziggy Fries Complete Meal (3.950 KWD)",
    ],
    bundlesAr: [
      'تشاينا جاردن: وجبة فردية كاملة (نودلز الدجاج أو الخضار + شوربة الذرة بالدجاج بسعر ٣٫٨٥٠ د.ك)',
      'ذا نودل بار: وجبة نودلز دجاج سيراتشا مع مشروب بارد بسعر ٣٫٩٥٠ د.ك',
      'فرانكس: وجبة فيلي تشيز ستيك الأصلي مع بطاطس زيجي بسعر ٣٫٩٥٠ د.ك بدون أي خصم',
    ],
    opsRuleEn: 'Keep daily orders steady with filling meals under 4.000 KWD paired with soup, fries or drinks, and cut weekday vegetable prep by 15%.',
    opsRuleAr: 'الحفاظ على عدد الطلبات اليومية بوجبات مشبعة أقل من ٤٫٠٠٠ د.ك مع شوربة أو بطاطس ومشروب، وتقليل تقطيع الخضار ١٥٪ وسط الأسبوع لمنع التلف.',
  }

  const headlineEn =
    activeMode === 'payday-zwarah'
      ? `Today's Plan (${weekdayEn}, Day ${dayOfMonth}): Payday & Zwarah Family Rush (+${f0(KUWAIT_TIME_CURVE.surgeKwdPct)}% higher sales)`
      : activeMode === 'mid-month-shield'
        ? `Today's Plan (${weekdayEn}, Day ${dayOfMonth}): Mid-Month Value Meals (Days 10–19 · Steady Orders Without Discounts)`
        : `Today's Plan (${weekdayEn}, Day ${dayOfMonth}): Early-Month Mall & Counter Meal Upgrades (Days 1–9)`

  const headlineAr =
    activeMode === 'payday-zwarah'
      ? `خطة اليوم (${weekdayAr}، يوم ${dayOfMonth}): موسم الرواتب والزوارة (+${f0(KUWAIT_TIME_CURVE.surgeKwdPct)}٪ زيادة في المبيعات)`
      : activeMode === 'mid-month-shield'
        ? `خطة اليوم (${weekdayAr}، يوم ${dayOfMonth}): عروض منتصف الشهر الذكية (الأيام ١٠–١٩ · وجبات مشبعة بدون خصومات)`
        : `خطة اليوم (${weekdayAr}، يوم ${dayOfMonth}): تنشيط وجبات الكاشير بداية الشهر (الأيام ١–٩)`

  const directiveEn =
    activeMode === 'payday-zwarah'
      ? paydayZwarah.opsRuleEn
      : activeMode === 'mid-month-shield'
        ? midMonthShield.opsRuleEn
        : 'Make the most of early-month mall visitors at 360 Mall, Promenade, Assima and The Avenues by offering simple meal + drink upgrades at the counter.'

  const directiveAr =
    activeMode === 'payday-zwarah'
      ? paydayZwarah.opsRuleAr
      : activeMode === 'mid-month-shield'
        ? midMonthShield.opsRuleAr
        : 'الاستفادة من حركة المجمعات أول الشهر في مجمع ٣٦٠ والبروميناد والعاصمة والأفنيوز باقتراح إضافة شوربة أو مشروب مع كل طلب عند الكاشير.'

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
        ? 'Payday & Zwarah Season'
        : activeMode === 'mid-month-shield'
          ? 'Mid-Month Smart Meals (10–19)'
          : 'Early-Month Activity (1–9)',
    badgeAr:
      activeMode === 'payday-zwarah'
        ? 'موسم الرواتب والزوارة'
        : activeMode === 'mid-month-shield'
          ? 'عروض منتصف الشهر (١٠–١٩)'
          : 'نشاط بداية الشهر (١–٩)',
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
 * 5-Minute Quick Branch Check for Area / Operations Managers.
 */
function cleanScopeAr(subjectAr: string, fallbackAr: string): string {
  const first = subjectAr.split('·')[0].trim()
  const mapped = arRegisterName(first)
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
        `Minute 1–2 (Scale Check): Weigh 5 cooked portions of Chicken Noodles & Beef Mongolian at The Avenues and 360 Mall to make sure protein matches the 140g recipe.`,
        `Minute 3–4 (Chiller Check): Match 3 chilled protein bags received from Ardiya Central Kitchen against today's signed delivery slip.`,
        `Minute 5 (Waste Bin Check): Check the prep-line bin before evening rush to make sure nothing is thrown away without recording it.`,
      ],
      ar: [
        `الدقيقة ١–٢ (وزن الوجبات): وزن ٥ صحون جاهزة من نودلز الدجاج وبيف منغولي في الأفنيوز ومجمع 360 للتأكد من التزام الطباخ بمعيار ١٤٠ جرام دجاج أو لحم.`,
        `الدقيقة ٣–٤ (تشييك الثلاجة): مطابقة ٣ أكياس مستلمة من المطبخ المركزي بالعارضية مع ورقة الاستلام الموقعة اليوم.`,
        `الدقيقة ٥ (تشييك الهدر): إلقاء نظرة سريعة على سلة خط التحضير قبل زحمة المساء للتأكد من عدم رمي أي مواد بدون تسجيلها.`,
      ],
    }
  }
  if (id === 'kitchen-scrap-hotspot' || id === 'kitchen-ardiya-prep-par-shield') {
    return {
      en: [
        `Minute 1–2 (Prep Stickers): Check prep time stickers on cut green pepper, spring onion and truffle mayo at 360 Mall and Salmiya.`,
        `Minute 3–4 (Prep Quantities): Confirm lighter weekday prep (Sun–Tue) and full Thursday/Friday weekend prep sent Wednesday 4:00 PM from Ardiya.`,
        `Minute 5 (App Tablets at 7:30 PM): Check Talabat and Keeta tablets during evening rush to confirm top dishes are all available.`,
      ],
      ar: [
        `الدقيقة ١–٢ (تاريخ التحضير): فحص ملصق وقت التجهيز على الفلفل الأخضر والبصل الأخضر وصوص الترافل مايو في مجمع 360 والسالمية.`,
        `الدقيقة ٣–٤ (كميات التحضير): التأكد من تقليل تحضير الخضار أول الأسبوع، واستلام طلبية الخميس والجمعة كاملة يوم الأربعاء ٤ عصراً من العارضية.`,
        `الدقيقة ٥ (تشييك تابلت التطبيقات): فتح أجهزة طلبات وكيتا الساعة ٧:٣٠ مساءً والتأكد أن كل الأطباق الرئيسية متوفرة وما في صنف مقفل.`,
      ],
    }
  }
  if (id === 'proc-packaging-per-order') {
    return {
      en: [
        `Minute 1–2 (Boxes vs Orders): Compare noodle boxes & bags used today at Ardiya against today's POS order count.`,
        `Minute 3–4 (Packing Check): Check 5 packed delivery bags — 1 bag per 2 boxes, and plastic cutlery added only when requested.`,
        `Minute 5 (Storeroom Key): Confirm spare packaging cartons are locked with the shift supervisor.`,
      ],
      ar: [
        `الدقيقة ١–٢ (عدد العلب مقابل الطلبات): مقارنة عدد العلب والأكياس المستخدمة اليوم في فرع العارضية مع عدد طلبات الكاشير.`,
        `الدقيقة ٣–٤ (طريقة التغليف): فحص ٥ أكياس توصيل جاهزة للتأكد من عدم تدبيل الأكياس ووضع الملاعق عند طلب الزبون فقط.`,
        `الدقيقة ٥ (مخزن التغليف): التأكد من قفل مخزن كراتين التغليف الاحتياطي عند مشرف الشفت.`,
      ],
    }
  }
  if (stage === 'procurement') {
    return {
      en: [
        `Minute 1–2 (Invoice Price Check): Check the latest 3 supplier invoices at Ardiya Central Kitchen against the agreed price in Odoo.`,
        `Minute 3–4 (Net Weight Check): Weigh 2 cartons of frozen shrimp and basmati rice on the receiving scale after deducting ice/box weight.`,
        `Minute 5 (Approved Brand Check): Confirm soy sauce and rice noodles match the exact approved supplier brand.`,
      ],
      ar: [
        `الدقيقة ١–٢ (مراجعة سعر الفاتورة): مقارنة آخر ٣ فواتير استلام في مطبخ العارضية مع السعر المتفق عليه في أودو.`,
        `الدقيقة ٣–٤ (وزن البضاعة الصافي): وزن كرتونين روبيان مجمد وأرز بسمتي على الميزان بعد خصم وزن الثلج والكرتون.`,
        `الدقيقة ٥ (تشييك نوع البضاعة): التأكد أن صلصة الصويا وأعواد النودلز المستلمة هي نفس النوع المتفق عليه بدون تغيير.`,
      ],
    }
  }
  if (id === 'ops-discount-discipline' || id === 'ops-cashier-upsell-incentive') {
    return {
      en: [
        `Minute 1–2 (Discount Slips): Print today's discount list at Ardiya and Promenade; confirm manager PIN and reason on every discount.`,
        `Minute 3–4 (Listen at Counter): Stand by the cashier for 5 orders and check that they politely offer the soup/drink meal upgrade.`,
        `Minute 5 (Drinks & Soup Ready): Confirm cold drinks are full in the display fridge and corn soup is hot and ready to serve.`,
      ],
      ar: [
        `الدقيقة ١–٢ (مراجعة الخصومات): طباعة كشف خصومات الشفت الحالي في العارضية والبروميناد والتأكد من وجود موافقة المدير والسبب.`,
        `الدقيقة ٣–٤ (متابعة الكاشير): الوقوف بجانب الكاشير لـ ٥ طلبات والتأكد أنه يقترح إضافة الشوربة والمشروب بأسلوب لطيف.`,
        `الدقيقة ٥ (جاهزية المشروبات والشوربة): التأكد أن ثلاجة المشروبات مليانة وشوربة الذرة ساخنة وجاهزة للتسليم فوراً.`,
      ],
    }
  }
  if (stage === 'menu') {
    const scopeAr = cleanScopeAr(subjectAr, 'شاشات الكاشير بالفروع')
    return {
      en: [
        `Minute 1–2 (POS Screen): Open the POS screen for ${subjectEn.split('·')[0].trim()} and confirm meal combos sit on the first row.`,
        `Minute 3–4 (Menu vs App Prices): Compare 3 popular dishes on the counter menu against Talabat and Keeta tablets.`,
        `Minute 5 (Basic Item Prices): Confirm basic customer-favorite prices stayed unchanged and removed slow items are hidden.`,
      ],
      ar: [
        `الدقيقة ١–٢ (شاشة الكاشير): فتح شاشة الكاشير في (${scopeAr}) والتأكد من وضع الوجبات المشتركة والإضافات في الصف الأول.`,
        `الدقيقة ٣–٤ (مقارنة الأسعار): مقارنة أسعار ٣ أطباق رئيسية على لوحة الفرع مع أجهزة طلبات وكيتا.`,
        `الدقيقة ٥ (تشييك الأصناف): التأكد من ثبات أسعار الأصناف الأساسية اللي تجذب الزبائن وإخفاء الأصناف البطيئة الملغاة.`,
      ],
    }
  }
  if (stage === 'operations') {
    const scopeAr = cleanScopeAr(subjectAr, 'كاشير الفرع')
    return {
      en: [
        `Minute 1–2 (Opening Time): Check today's opening time on ${subjectEn.split('·')[0].trim()} against the 10:30 AM schedule.`,
        `Minute 3–4 (Ready Before Rush): Confirm sauces, lids and thermal bags are ready 30 minutes before the 7:00 PM rush.`,
        `Minute 5 (Quick Cash Count): Count the cash drawer in 60 seconds and match it to the live Odoo POS balance.`,
      ],
      ar: [
        `الدقيقة ١–٢ (وقت فتح الكاشير): التأكد من فتح (${scopeAr}) في الموعد المحدد الساعة ١٠:٣٠ صباحاً بدون تأخير.`,
        `الدقيقة ٣–٤ (التجهيز قبل الزحمة): التأكد من تجهيز الصوصات والأغطية والشنط الحرارية قبل الساعة ٦:٣٠ مساءً.`,
        `الدقيقة ٥ (عدّ الكاش السريع): عدّ درج الكاشير خلال دقيقة ومطابقته مع الرقم الموجود في شاشة أودو.`,
      ],
    }
  }
  if (stage === 'opex') {
    const scopeAr = cleanScopeAr(subjectAr, 'الفرع')
    return {
      en: [
        `Minute 1–2 (Petty Cash Safe): Count cash and stamped receipts in the branch safe and match them to Odoo.`,
        `Minute 3–4 (Fridge & A/C Check): Check fridge temperature (4°C or below) and A/C cooling at ${subjectEn.split('·')[0].trim()} before calling a technician.`,
        `Minute 5 (Branch Name on Bills): Make sure every cash purchase receipt has the exact branch and restaurant name written on it.`,
      ],
      ar: [
        `الدقيقة ١–٢ (تشييك العهدة): عدّ الكاش والفواتير المختومة في خزنة الفرع ومطابقتها مع الرصيد المسجل في أودو.`,
        `الدقيقة ٣–٤ (حرارة الثلاجات والتكييف): فحص حرارة الثلاجات (٤ درجات أو أقل) وتبريد التكييف في (${scopeAr}) قبل طلب فني صيانة.`,
        `الدقيقة ٥ (تسجيل الفواتير): التأكد من عدم وجود فواتير كاش معلقة بدون تحديد اسم الفرع والمطعم عليها.`,
      ],
    }
  }
  if (stage === 'quality') {
    return {
      en: [
        `Minute 1–2 (Evening Cancelled Orders): Check the last 5 cancelled evening orders at Ardiya and see why they were delayed.`,
        `Minute 3–4 (Free Orders Check): Make sure every 0 KWD order is logged as either Staff Meal or Manager Customer Recovery.`,
        `Minute 5 (Customer Phone & Card): Confirm cashiers ask for the guest phone number and put a direct-order card inside every delivery bag.`,
      ],
      ar: [
        `الدقيقة ١–٢ (مراجعة الطلبات الملغاة): سحب آخر ٥ طلبات ألغيت بالمساء في فرع العارضية ومعرفة سبب التأخير الحقيقي.`,
        `الدقيقة ٣–٤ (مراجعة الطلبات المجانية): التأكد أن أي طلب بقيمة صفر مسجل إما وجبة موظفين أو تعويض زبون بموافقة المدير.`,
        `الدقيقة ٥ (رقم الزبون وكرت الطلب المباشر): التأكد من تسجيل رقم تلفون الزبون عند الكاشير ووضع كرت الطلب المباشر داخل كل كيس توصيل.`,
      ],
    }
  }
  const delScopeAr = cleanScopeAr(subjectAr, 'أجهزة تطبيقات التوصيل')
  return {
    en: [
      `Minute 1–2 (App Tablets): Check prices and active offers on Talabat and Keeta tablets for ${subjectEn.split('·')[0].trim()}.`,
      `Minute 3–4 (Direct Order Cards): Confirm direct-order cards are stapled to outgoing delivery bags at Salmiya and Assima Mall.`,
      `Minute 5 (Payment Type Check): Check 5 delivery receipts on the counter to confirm they are rung under the right app in Odoo.`,
    ],
    ar: [
      `الدقيقة ١–٢ (تشييك أجهزة التطبيقات): مراجعة الأسعار والعروض الشغالة على تابلت طلبات وكيتا في (${delScopeAr}).`,
      `الدقيقة ٣–٤ (كروت الطلب المباشر): التأكد من تدبيس كرت الطلب المباشر بدون عمولة على أكياس التوصيل في السالمية ومجمع العاصمة.`,
      `الدقيقة ٥ (طريقة الدفع بالكاشير): مراجعة ٥ فواتير توصيل والتأكد من تسجيلها على التطبيق الصحيح في أودو.`,
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
  const spot = p.spotAudit ?? buildSpotAuditForPlay(p.id, p.stage, p.subjectEn, p.subjectAr)
  return {
    ...p,
    titleEn: stripRawOdooTags(p.titleEn),
    titleAr: stripRawOdooTags(p.titleAr),
    subjectEn: stripRawOdooTags(p.subjectEn),
    subjectAr: stripRawOdooTags(p.subjectAr),
    leakEn: stripRawOdooTags(p.leakEn),
    leakAr: stripRawOdooTags(p.leakAr),
    actionEn: stripRawOdooTags(p.actionEn),
    actionAr: stripRawOdooTags(p.actionAr),
    qualityEn: stripRawOdooTags(p.qualityEn),
    qualityAr: stripRawOdooTags(p.qualityAr),
    impactEn: stripRawOdooTags(p.impactEn),
    impactAr: stripRawOdooTags(p.impactAr),
    ownerRoleEn: stripRawOdooTags(p.ownerRoleEn ?? owner.ownerRoleEn),
    ownerRoleAr: stripRawOdooTags(p.ownerRoleAr ?? owner.ownerRoleAr),
    evidence: p.evidence.map((e) => ({ en: stripRawOdooTags(e.en), ar: stripRawOdooTags(e.ar) })),
    kpi: { ...p.kpi, en: stripRawOdooTags(p.kpi.en), ar: stripRawOdooTags(p.kpi.ar) },
    simulator: p.simulator ?? defaultSimulatorForPlay(p.stage, p.id),
    spotAudit: {
      en: [stripRawOdooTags(spot.en[0]), stripRawOdooTags(spot.en[1]), stripRawOdooTags(spot.en[2])],
      ar: [stripRawOdooTags(spot.ar[0]), stripRawOdooTags(spot.ar[1]), stripRawOdooTags(spot.ar[2])],
    },
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
    const list = creep.slice(0, 3).map((c) => `${enItemName(c.name)} +${f1(c.creepPct)}% (${f3(c.firstPrice)} → ${f3(c.lastPrice)} KWD/${c.uom})`)
    const listAr = creep.slice(0, 3).map((c) => `${arItemName(c.name)} +${f1(c.creepPct)}% (${f3(c.firstPrice)} ← ${f3(c.lastPrice)} د.ك/${arUom(c.uom)})`)
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
      titleEn: 'Suppliers raised prices on key kitchen ingredients', titleAr: 'ارتفاع أسعار شراء بعض المواد الأساسية من الموردين',
      subjectEn: creep.map((c) => enItemName(c.name)).join(' · '), subjectAr: creep.map((c) => arItemName(c.name)).join(' · '),
      leakEn: `Supplier invoices in Odoo show price increases over the last 4 months on ${creep.length} key items: ${list.join('; ')}. At current monthly usage, this adds ${KWD(impact)} to food cost every month.`,
      leakAr: `توضح فواتير الشراء في أودو أن أسعار ${creep.length} مواد أساسية ارتفعت خلال آخر ٤ أشهر: ${listAr.join('؛ ')}. وعلى كمياتنا الحالية، الزيادة هذي تكلفنا ${DK(impact)} إضافية كل شهر.`,
      actionEn: `Ask these suppliers to return to the previous agreed price this week, get 3 competing quotes for each item, and fix prices for 90 days on rice, sauces and shrimp before the next order.`,
      actionAr: `مخاطبة الموردين هذا الأسبوع للرجوع للسعر المتفق عليه، وأخذ ٣ عروض أسعار بديلة لكل مادة، وتثبيت سعر الشراء لمدة ٣ أشهر للأرز والصوصات والروبيان قبل الطلبية القادمة.`,
      qualityEn: 'Fixing both the brand and price with suppliers ensures every branch receives the exact same quality of rice, sauce and shrimp.',
      qualityAr: 'تثبيت النوع والسعر مع المورد يضمن وصول نفس جودة الأرز والصوص والروبيان لكل فروعنا بدون تغيير في الطعم.',
      ...impactText(monthly, 'Based on recovering 70% of the recent supplier price increase.', 'بتوفير ٧٠٪ من فرق زيادة الأسعار بعد التفاوض أو تغيير المورد.'),
      evidence: [{ en: `${creep.length} ingredients · +${KWD(impact)}/month extra cost`, ar: `${creep.length} مواد أساسية · +${DK(impact)} فرق شهري` }],
      kpi: { id: 'proc-creep-kwd', en: 'Extra monthly cost from supplier price rises', ar: 'الزيادة الشهرية في أسعار الموردين', value: Math.round(impact), unit: 'kwd', better: 'down' },
      vendorShield: {
        items: creep.map((c) => ({
          name: enItemName(c.name),
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
      titleEn: 'Buying the same item at different prices from multiple suppliers', titleAr: 'شراء نفس الصنف بأسعار متفاوتة من أكثر من مورد',
      subjectEn: variance.map((v) => enItemName(v.name)).join(' · '), subjectAr: variance.map((v) => arItemName(v.name)).join(' · '),
      leakEn: `Over the last 60 days, the same ingredient was bought from different suppliers at different prices: ${variance.map((v) => `${enItemName(v.name)} (${v.vendors} suppliers, best price ${f3(v.bestPrice)} vs paid ${f3(v.paidPrice)} KWD/${v.uom})`).join('; ')}.`,
      leakAr: `خلال آخر شهرين اشترينا نفس المادة من أكثر من مورد بأسعار مختلفة: ${variance.map((v) => `${arItemName(v.name)} من ${v.vendors} موردين، أقل سعر ${f3(v.bestPrice)} مقابل ${f3(v.paidPrice)} د.ك/${arUom(v.uom)}`).join('؛ ')}.`,
      actionEn: 'Assign one approved best-price supplier per ingredient in Odoo, and require Finance Manager approval if anyone tries to order at a higher price.',
      actionAr: 'اعتماد المورد الأرخص والأفضل جودة لكل مادة في أودو، ومنع إصدار أي طلب شراء بسعر أعلى إلا بموافقة المدير المالي.',
      qualityEn: 'Buying from one approved supplier keeps ingredient quality and taste consistent across every kitchen.',
      qualityAr: 'الشراء من مورد واحد معتمد يوحد جودة المكونات ويحافظ على نفس الطعم في كل الفروع.',
      ...impactText(monthly, 'Price difference × last 30 days purchased quantity.', 'حسب فرق السعر مضروباً في كمية مشتريات آخر ٣٠ يوماً.'),
      evidence: [{ en: `${P.concentration.skus80} items represent 80% of purchases`, ar: `${P.concentration.skus80} مادة تمثل ٨٠٪ من مشترياتنا` }],
      kpi: { id: 'proc-vendor-gap', en: 'Monthly price gap across suppliers', ar: 'فرق السعر الشهري بين الموردين', value: Math.round(monthly), unit: 'kwd', better: 'down' },
      vendorShield: {
        items: variance.map((v) => ({
          name: enItemName(v.name),
          uom: v.uom,
          oldPriceKwd: v.bestPrice,
          newPriceKwd: v.paidPrice,
          monthlyGapKwd: v.monthlySavingKwd,
          affectedDishes: ['Chicken Noodles', 'Sweet & Sour Chicken', 'Shrimp Fried Rice'],
        })),
      },
    }))
  }

  // Packaging per order by branch
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
        titleEn: 'High packaging cost per order at some branches', titleAr: 'ارتفاع استهلاك علب وأكياس التغليف في بعض الفروع',
        subjectEn: `${locEn(worst.id)} vs ${locEn(best.id)}`, subjectAr: `${locAr(worst.id)} مقارنة بـ ${locAr(best.id)}`,
        leakEn: `${locEn(worst.id)} spends ${f3(worst.perOrder)} KWD on packaging per order (${KWD(worst.kwd)} across ${f0(worst.orders)} orders) compared to ${f3(best.perOrder)} KWD at ${locEn(best.id)} and a ${f3(med)} KWD branch average. Total packaging rose from ${KWD(J.kitchen.postedPrior30.packagingKwd)} to ${KWD(J.kitchen.posted30.packagingKwd)} this month.`,
        leakAr: `يصرف فرع ${locAr(worst.id)} حوالي ${f3(worst.perOrder)} د.ك تغليف لكل طلب (${DK(worst.kwd)} لعدد ${f0(worst.orders)} طلب) مقارنة بـ ${f3(best.perOrder)} د.ك فقط في ${locAr(best.id)} ومتوسط ${f3(med)} د.ك لباقي الفروع. كما زاد إجمالي التغليف بالشركة من ${DK(J.kitchen.postedPrior30.packagingKwd)} إلى ${DK(J.kitchen.posted30.packagingKwd)}.`,
        actionEn: `Set a clear packing guide per dish (exact box size, 1 bag per 2 boxes, cutlery only when requested) and review ${locEn(worst.id)} daily for two weeks.`,
        actionAr: `تحديد مقاس العلبة والكيس المناسب لكل طبق وعدم تدبيل الأكياس، ووضع الملاعق البلاستيك عند طلب الزبون فقط، ومتابعة فرع ${locAr(worst.id)} لمدة أسبوعين.`,
        qualityEn: 'Using the right box size keeps noodles and sauces hot and prevents spills on delivery.',
        qualityAr: 'اختيار مقاس العلبة الصح يحفظ حرارة الأكل ويمنع انسكاب الصوص بالطريق، وهذا يرفع تقييمنا في التطبيقات.',
        ...impactText(monthly, 'Saving 60% of the extra packaging gap at higher-spend branches.', 'بتوفير ٦٠٪ من الاستهلاك الزائد للتغليف في الفروع الأعلى صرفاً.'),
        evidence: [{ en: `Total packaging: ${KWD(J.kitchen.posted30.packagingKwd)} in 30 days`, ar: `إجمالي التغليف: ${DK(J.kitchen.posted30.packagingKwd)} في ٣٠ يوماً` }],
        kpi: { id: `proc-pack-${worst.id}`, en: `Packaging cost per order · ${locEn(worst.id)}`, ar: `تكلفة التغليف للطلب · ${locAr(worst.id)}`, value: Math.round(worst.perOrder * 1000) / 1000, unit: 'kwd', better: 'down' },
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
      titleEn: 'Kitchen ingredient usage is higher than approved recipes', titleAr: 'فرق واضح بين استهلاك المطبخ الفعلي والوصفات المعتمدة',
      subjectEn: `Stock count differences · ${locEn(worst.id)}`, subjectAr: `فروقات جرد المواد الغذائية · ${locAr(worst.id)}`,
      leakEn: `Beyond the ${KWD(sum(rows, (r) => r.food))} of recipe ingredients used, end-of-period stock counts across our 7 restaurants showed ${KWD(totalVar)} in missing/extra consumed stock in 30 days (+${f1(pct(totalVar, sum(rows, (r) => r.food)))}% above recipe quantities). ${locEn(worst.id)} had the largest gap at ${f1(worst.varPct)}% of sales (${KWD(worst.variance)}), while ${locEn(best.id)} was best at ${f1(best.varPct)}%.`,
      leakAr: `غير تكلفة الأكل المحسوبة بالوصفات (${DK(sum(rows, (r) => r.food))})، أظهر الجرد الفعلي في الفروع السبعة نقصاً واستهلاكاً زائداً بقيمة ${DK(totalVar)} خلال ٣٠ يوماً (يعني +${f1(pct(totalVar, sum(rows, (r) => r.food)))}٪ فوق كمية الوصفات). أعلى فرق كان في ${locAr(worst.id)} بقيمة ${DK(worst.variance)} (${f1(worst.varPct)}٪ من المبيعات)، وأفضل التزام كان في ${locAr(best.id)} (${f1(best.varPct)}٪).`,
      actionEn: `Run a quick daily count on the top 20 items at ${locEn(worst.id)} and the next two branches, send pre-weighed protein & sauce packs from Ardiya Central Kitchen, and require manager sign-off before posting stock adjustments.`,
      actionAr: `تطبيق جرد يومي سريع لأهم ٢٠ صنف في ${locAr(worst.id)} وأكثر فرعين بعده، وإرسال الدجاج واللحم والصوصات من مطبخ العارضية بأكياس موزونة جاهزة للطبخ، وعدم تسجيل أي تسوية جرد إلا بعد مراجعة المدير.`,
      qualityEn: 'Pre-weighed packs from the central kitchen guarantee every plate of Chicken Noodles has the exact same generous portion and taste.',
      qualityAr: 'الأكياس الموزونة الجاهزة من المطبخ المركزي تخلي كل صحن نودلز يطلع بنفس الكمية والطعم حتى وقت الزحمة.',
      ...impactText(monthly, 'Cutting stock count differences in half across our 7 branches.', 'بتقليل فروقات الجرد والاستهلاك الزائد للنصف في الفروع السبعة.'),
      evidence: rows.sort((a, b) => b.variance - a.variance).slice(0, 3).map((r) => ({ en: `${locEn(r.id)}: ${KWD(r.variance)} (${f1(r.varPct)}% of sales)`, ar: `${locAr(r.id)}: ${DK(r.variance)} (${f1(r.varPct)}٪ من المبيعات)` })),
      kpi: { id: 'kitchen-variance-kwd', en: 'Monthly stock count gap across 7 branches', ar: 'إجمالي فروقات جرد المطبخ (٣٠ يوماً)', value: Math.round(totalVar), unit: 'kwd', better: 'down' },
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
        titleEn: 'Extra-heavy portioning on the cooking line', titleAr: 'زيادة كمية الغرف بالصحن عن المعيار في خط الطبخ',
        subjectEn: `${locEn(worst.id)} kitchen`, subjectAr: `مطبخ فرع ${locAr(worst.id)}`,
        leakEn: `Based on the dishes sold at ${locEn(worst.id)}, recipe food cost should be ${f1(worst.theoPct ?? 0)}%, but actual raw-food cost reached ${f1(worst.foodPct)}% of sales — ${f1(worst.gap)} points higher (branch average gap is ${f1(medGap)} points).`,
        leakAr: `حسب الأطباق اللي باعها فرع ${locAr(worst.id)}، المفروض تكلفة الأكل تكون ${f1(worst.theoPct ?? 0)}٪، لكن التكلفة الفعلية وصلت ${f1(worst.foodPct)}٪ من المبيعات — بزيادة ${f1(worst.gap)} نقطة عن الوصفة (مقابل متوسط ${f1(medGap)} نقطة في باقي الفروع).`,
        actionEn: `Check portion weights for 7 days on the top 10 China Garden dishes at ${locEn(worst.id)}, provide standard scoops and scales on the line, and update any recipe in Odoo if the dish size changed.`,
        actionAr: `مراجعة وزن الصحون لمدة أسبوع لأكثر ١٠ أطباق مبيعاً في ${locAr(worst.id)}، وتوفير مغارف معيارية وميزان على خط الطبخ للتقيد بالكمية المعتمدة.`,
        qualityEn: 'Consistent scoops mean every guest gets the same balanced dish on every visit.',
        qualityAr: 'الالتزام بالمغارف المعيارية يضمن أن الزبون يستلم نفس الطبق المتوازن بكل مرة يطلب فيها.',
        ...impactText(monthly, `Closing half of the ${f1(excess)}-point extra food cost gap at ${locEn(worst.id)}.`, `بتقليل نصف الزيادة في استهلاك المواد بفرع ${locAr(worst.id)}.`),
        evidence: [{ en: `${f1(worst.covered)}% of ${locEn(worst.id)} sales linked to recipes`, ar: `${f1(worst.covered)}٪ من مبيعات ${locAr(worst.id)} مربوطة بالوصفات` }],
        kpi: { id: `kitchen-food-pct-${worst.id}`, en: `Food cost % · ${locEn(worst.id)}`, ar: `نسبة تكلفة الأكل · ${locAr(worst.id)}`, value: Math.round(worst.foodPct * 10) / 10, unit: 'pct', better: 'down' },
      }))
    }
  }

  const scrapTotal = sum(rows, (r) => r.scrap) + n(J.opex.centralKitchen.rolling30.scrap)
  const scrapPrior = sum(LOC_COSTS, (l) => n(l.prior30.scrap)) + n(J.opex.centralKitchen.prior30.scrap)
  const site = J.kitchen.scrap.filter((s) => BRANCH_IDS.has(s.location) || s.location === 'central-kitchen').sort((a, b) => b.moves - a.moves)[0]
  if (site && J.kitchen.posted30.scrapKwd > 300) {
    const monthly = J.kitchen.posted30.scrapKwd * 0.35
    const items = site.topItems.slice(0, 4).map((i) => enItemName(i.name))
    const itemsAr = site.topItems.slice(0, 4).map((i) => arItemName(i.name))
    const ckScrap = n(J.opex.centralKitchen.rolling30.scrap)
    out.push(play({
      id: 'kitchen-scrap-hotspot', stage: 'kitchen', basis: 'posted', monthlyKwd: monthly,
      titleEn: 'Cut spoiled food & over-prepping in kitchens', titleAr: 'تقليل التالف والتحضير الزائد عن الحاجة في المطبخ',
      subjectEn: `${locEn('central-kitchen')} & ${locEn(site.location)} · ${items.join(', ')}`, subjectAr: `${locAr('central-kitchen')} و${locAr(site.location)} · ${itemsAr.join('، ')}`,
      leakEn: `Recorded spoiled/discarded food reached ${KWD(J.kitchen.posted30.scrapKwd)} in 30 days (${KWD(ckScrap)} in Ardiya Central Kitchen alone; prior 30 days: ${KWD(J.kitchen.postedPrior30.scrapKwd)}). Among branches, ${locEn(site.location)} logged the most waste entries (${f0(site.moves)}), mainly ${items.join(', ')}.`,
      leakAr: `وصلت قيمة المواد التالفة المسجلة إلى ${DK(J.kitchen.posted30.scrapKwd)} خلال ٣٠ يوماً (منها ${DK(ckScrap)} في المطبخ المركزي بالعارضية، مقارنة بـ ${DK(J.kitchen.postedPrior30.scrapKwd)} الشهر الماضي). وفي الفروع سجل ${locAr(site.location)} أعلى عدد مرات إتلاف (${f0(site.moves)} مرة)، وأكثرها في: ${itemsAr.join('، ')}.`,
      actionEn: `Match daily prep quantities at ${locEn(site.location)} to actual hourly orders, cook smaller batches after 9:00 PM, and tighten batch prep quantities in Ardiya Central Kitchen.`,
      actionAr: `ربط كميات التحضير اليومي في ${locAr(site.location)} بحجم الطلبات الفعلي لكل يوم، والطبخ بدفعات صغيرة بعد الساعة ٩ بالليل، وتقليل الكميات الفائضة في مطبخ العارضية.`,
      qualityEn: 'Cooking smaller batches more often means guests get fresher, crispier food instead of items sitting warm for hours.',
      qualityAr: 'تحضير كميات أصغر أول بأول يخلي الأكل يوصل للزبون طازج وساخن ومقرمش بدل ما يطول على خط التسخين.',
      ...impactText(monthly, 'Cutting recorded kitchen waste by 35% through smarter daily prep.', 'بتقليل التالف اليومي بنسبة ٣٥٪ عبر ضبط كميات التحضير.'),
      evidence: [{ en: `Recorded waste: ${KWD(scrapTotal)} (prior month: ${KWD(scrapPrior)})`, ar: `إجمالي التالف: ${DK(scrapTotal)} (الشهر السابق: ${DK(scrapPrior)})` }],
      kpi: { id: 'kitchen-scrap-kwd', en: 'Recorded kitchen waste (30 days)', ar: 'قيمة التالف المسجل (٣٠ يوماً)', value: Math.round(J.kitchen.posted30.scrapKwd), unit: 'kwd', better: 'down' },
    }))
  }

  // Field-Execution #2: Ardiya Central Kitchen Prep-Par & Zero-Stockout Directives
  const ckBranchTransfers = J.kitchen.ckTransfers.filter((t) => BRANCH_IDS.has(t.location))
  const totalTransferMoves = sum(ckBranchTransfers, (t) => t.moves)
  if (totalTransferMoves > 500) {
    const thuFriExtraOrders = Math.max(180, KUWAIT_TIME_CURVE.thuFriAvgOrders - KUWAIT_TIME_CURVE.sunWedAvgOrders)
    const stockoutGain = 8 * thuFriExtraOrders * 0.08 * J.pulse.rolling30.aovKwd * (1 - COGS - AVG_AGG_COMMISSION * 0.6)
    const weekdaySpoilageSave = J.kitchen.posted30.scrapKwd * 0.18
    const monthly = Math.max(920, stockoutGain + weekdaySpoilageSave)
    const topTransferSites = ckBranchTransfers.slice(0, 4)
    out.push(play({
      id: 'kitchen-ardiya-prep-par-shield',
      stage: 'kitchen',
      basis: 'estimated',
      monthlyKwd: monthly,
      ownerRoleEn: 'Executive Chef — Ardiya Central Kitchen & Branch Kitchen Supervisors',
      ownerRoleAr: 'الشيف التنفيذي لمطبخ العارضية ومشرفو مطابخ الفروع',
      titleEn: 'Smart weekday vs weekend prep schedule from Ardiya Kitchen',
      titleAr: 'جدول تحضير مرن من مطبخ العارضية (أقل وسط الأسبوع وأكثر للويكند)',
      subjectEn: `Ardiya Central Kitchen → Promenade · 360 Mall · Assima · The Avenues · Salmiya · Al-Kout · Ardiya`,
      subjectAr: `مطبخ العارضية المركزي ← البروميناد · مجمع 360 · العاصمة · الأفنيوز · السالمية · الكوت · العارضية`,
      leakEn: `Daily orders jump from ${f0(KUWAIT_TIME_CURVE.sunWedAvgOrders)} orders/day (${KWD(KUWAIT_TIME_CURVE.sunWedAvgKwd)}) on Sun–Wed to ${f0(KUWAIT_TIME_CURVE.thuFriAvgOrders)} orders/day (${KWD(KUWAIT_TIME_CURVE.thuFriAvgKwd)}, reaching ${KWD(KUWAIT_TIME_CURVE.peakDayKwd)}) on Thursday & Friday. Preparing the same fixed amount every day causes leftover spoiled vegetables early in the week and sold-out popular dishes on Thursday/Friday nights.`,
      leakAr: `طلباتنا اليومية ترتفع من ${f0(KUWAIT_TIME_CURVE.sunWedAvgOrders)} طلب باليوم (${DK(KUWAIT_TIME_CURVE.sunWedAvgKwd)}) وسط الأسبوع إلى ${f0(KUWAIT_TIME_CURVE.thuFriAvgOrders)} طلب باليوم (${DK(KUWAIT_TIME_CURVE.thuFriAvgKwd)} وتوصل ${DK(KUWAIT_TIME_CURVE.peakDayKwd)}) يوم الخميس والجمعة. التحضير بنفس الكمية كل يوم يسبب تلف خضار وصوصات أول الأسبوع، ونفاد أهم الأطباق ليلة الخميس والجمعة على طلبات وكيتا.`,
      actionEn: `Set two simple prep levels from Ardiya Central Kitchen: (1) Sunday–Tuesday: reduce cut vegetables & sauces by 15% at 360 Mall, Salmiya and Al-Kout; (2) Wednesday 4:00 PM: send +55% weekend prep of Chicken Noodles, Beef Mongolian, Philly Steak and Chicken Shawarma to all 7 branches.`,
      actionAr: `اعتماد جدول تحضير واضح من مطبخ العارضية: (١) من الأحد للثلاثاء: تخفيض تحضير الخضار والصوصات ١٥٪ في مجمع 360 والسالمية والكوت لمنع التلف؛ (٢) يوم الأربعاء الساعة ٤ عصراً: إرسال كمية الويكند كاملة (+٥٥٪) من نودلز الدجاج وبيف منغولي وفيلي ستيك وشاورما الدجاج لكل الفروع السبعة.`,
      qualityEn: 'Freshly prepped vegetables all week and zero sold-out dishes during Thursday and Friday family rush.',
      qualityAr: 'خضار طازجة طول الأسبوع، ولا يخلص أي طبق رئيسي على الزبائن وقت زحمة الخميس والجمعة.',
      ...impactText(monthly, 'Prevents sold-out orders on busy weekends and cuts 18% of weekday kitchen waste.', 'منع ضياع طلبات الويكند بسبب نفاد الأصناف مع تقليل ١٨٪ من تالف وسط الأسبوع.'),
      evidence: topTransferSites.map((t) => ({
        en: `${locEn(t.location)}: ${f0(t.moves)} kitchen deliveries/month`,
        ar: `${locAr(t.location)}: ${f0(t.moves)} طلبية شهرياً من مطبخ العارضية`,
      })),
      kpi: { id: 'kitchen-weekend-surge-x', en: 'Weekend vs weekday sales ratio', ar: 'نسبة زيادة مبيعات الويكند عن وسط الأسبوع', value: KUWAIT_TIME_CURVE.weekendKwdMultiplier, unit: 'count', better: 'up' },
      prepParSpec: {
        weekdayMultiplier: 0.85,
        weekendMultiplier: 1.55,
        dispatchCutoffEn: 'Wednesday 4:00 PM weekend delivery from Ardiya',
        dispatchCutoffAr: 'توصيل طلبية الويكند الأربعاء ٤:٠٠ عصراً من العارضية',
        surgePct: Math.round(KUWAIT_TIME_CURVE.surgeKwdPct),
        peakWindowEn: 'Thu & Fri 6:00 PM – 10:30 PM rush',
        peakWindowAr: 'ذروة الخميس والجمعة ٦:٠٠ – ١٠:٣٠ مساءً',
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
    const list = r.heroes.map((d) => `${enItemName(d.name)} (${f0(d.qty)} sold at ${f3(d.avgPriceKwd)} → ${f3(d.avgPriceKwd + (d.avgPriceKwd >= 3 ? 0.15 : 0.1))} KWD)`)
    const listAr = r.heroes.map((d) => `${arItemName(d.name)} (${f0(d.qty)} طلب بسعر ${f3(d.avgPriceKwd)} ← ${f3(d.avgPriceKwd + (d.avgPriceKwd >= 3 ? 0.15 : 0.1))} د.ك)`)
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
      titleEn: `${brandEn(r.b.brand)}: smart price update on top sellers while keeping core meal prices fixed`,
      titleAr: `${brandAr(r.b.brand)}: تحسين أسعار الأطباق الأكثر طلباً وتثبيت أسعار الأصناف الأساسية`,
      subjectEn: `${brandEn(r.b.brand)} · ${r.heroes.map((d) => enItemName(d.name)).join(' · ')}`,
      subjectAr: `${brandAr(r.b.brand)} · ${r.heroes.map((d) => arItemName(d.name)).join(' · ')}`,
      leakEn: `${r.heroes.map((d) => enItemName(d.name)).join(', ')} bring ${f1(sum(r.heroes, (d) => d.sharePct))}% of ${brandEn(r.b.brand)} item sales and guests order them out of habit, yet they are priced like entry items. At ${brandEn(r.b.brand)}'s ${f1(r.food * 100)}% food cost, every 100–150 fils goes straight to profit.`,
      leakAr: `الأطباق الأكثر طلباً (${r.heroes.map((d) => arItemName(d.name)).join('، ')}) تمثّل ${f1(sum(r.heroes, (d) => d.sharePct))}% من مبيعات ${brandAr(r.b.brand)} ويطلبها الزبون باستمرار، لكن سعرها الحالي أقل من قيمتها. ومع تكلفة أكل ${f1(r.food * 100)}%، أي تعديل بسيط (١٠٠–١٥٠ فلس) يذهب مباشرة للربح.`,
      actionEn: `Update ${list.join('; ')} on Odoo POS and delivery apps on the same day, while keeping standalone prices fixed on core value meals (${fallbackDrivers.map((d) => enItemName(d.name)).join(', ') || 'Core Combo Meals'}) and pairing them with drinks and sides.`,
      actionAr: `تعديل أسعار ${listAr.join('؛ ')} في الكاشير وتطبيقات التوصيل، مع تثبيت أسعار الأصناف الأساسية الجاذبة للزبائن (${fallbackDrivers.map((d) => arItemName(d.name)).join('، ') || 'وجبات الكومبو الأساسية'}) دون أي زيادة.`,
      qualityEn: 'Put part of the gain into a visible upgrade on those dishes (fresh garnish and sturdier packaging) so guests feel higher quality.',
      qualityAr: 'تحسين التغليف والتقديم النهائي لهذه الأطباق بحيث يلمس الزبون جودة أعلى مع السعر الجديد.',
      ...impactText(r.gain, 'Assumes a conservative 2% dip in volume on these popular dishes (100–150 fils step).', 'باحتساب تحفّظ ٢٪ فقط في الكمية عند تعديل ١٠٠ إلى ١٥٠ فلس على الأطباق الأكثر طلباً.'),
      evidence: r.heroes.map((d) => ({ en: `${enItemName(d.name)}: ${f0(d.qty)} units · ${f1(d.sharePct)}% of brand`, ar: `${arItemName(d.name)}: ${f0(d.qty)} طلب · ${f1(d.sharePct)}% من مبيعات المطعم` })),
      kpi: { id: `menu-aov-${r.b.brand}`, en: `${brandEn(r.b.brand)} average basket`, ar: `متوسط فاتورة ${brandAr(r.b.brand)}`, value: Math.round(((r.b.aovShopKwd * r.b.shopOrders + r.b.aovDeliveryKwd * r.b.deliveryOrders) / Math.max(1, r.b.shopOrders + r.b.deliveryOrders)) * 1000) / 1000, unit: 'kwd', better: 'up' },
      simulator: {
        kind: 'reprice',
        sliders: [
          { id: 'priceFils', labelEn: 'Price adjustment on top sellers (fils)', labelAr: 'مقدار تعديل سعر الأطباق الأكثر طلباً (فلس)', unit: 'fils', min: 100, max: 350, step: 25, defaultValue: weightedStepFils >= 125 ? 150 : 100 },
          { id: 'retentionPct', labelEn: 'Customer order retention %', labelAr: 'نسبة ثبات الطلبات بعد التعديل %', unit: 'pct', min: 95, max: 100, step: 0.5, defaultValue: 98 },
        ],
        meta: { totalQty: totalHeroQty, avgPriceKwd: weightedPrice, foodCostPct: r.food, baseStepFils: weightedStepFils },
      },
      elasticityGuardrail: {
        inelastic: r.heroes.map((d) => ({
          name: enItemName(d.name),
          priceKwd: d.avgPriceKwd,
          suggestedFils: d.avgPriceKwd >= 3 ? 200 : 150,
        })),
        trafficDrivers: fallbackDrivers.map((d) => ({
          name: enItemName(d.name),
          priceKwd: d.avgPriceKwd,
          ruleEn: 'Core Traffic Item — keep standalone price fixed; offer as meal combo',
          ruleAr: 'صنف أساسي يجذب الزبائن — يبقى سعره ثابتاً بدون زيادة',
        })),
      },
    }))
  }

  // Dine-In vs. Aggregator Channel Separate Pricing
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
      titleEn: 'Keep Mall Counter Prices Fixed & Set a Separate Delivery App Menu Price',
      titleAr: 'تثبيت أسعار الصالة والكاونتر وتخصيص تسعيرة مستقلة لتطبيقات التوصيل',
      subjectEn: `${locEn('360-mall')} · ${locEn('avenues')} · ${locEn('assima')} vs Talabat Tgo (17%) & Deliveroo (18%)`,
      subjectAr: `${locAr('360-mall')} · ${locAr('avenues')} · ${locAr('assima')} مقابل طلبات Tgo (17%) وديليفرو (18%)`,
      leakEn: `Using the exact same menu price at mall counters (0% commission) and full-delivery apps (17%–18% commission) leaves high-commission app orders short on packaging and platform fees.`,
      leakAr: `توحيد نفس السعر بين كاونتر المجمع (صفر عمولة) وتطبيقات التوصيل (عمولة ١٧٪–١٨٪) يقلل ربح طلب التوصيل بعد خصم العمولة وعلب التغليف.`,
      actionEn: `Keep dine-in and mall counter prices untouched across 360 Mall, The Avenues, Assima Mall, Promenade Mall and Al-Kout Mall, while setting a separate Odoo delivery pricelist (+150 to +250 fils on top main dishes & family boxes) on 17%–18% apps.`,
      actionAr: `تثبيت أسعار الصالة والكاونتر بدون أي زيادة في مجمع 360 والأفنيوز والعاصمة والبروميناد والكوت، وتخصيص قائمة أسعار للتوصيل في أودو (+١٥٠ إلى +٢٥٠ فلس على الأطباق الأكثر طلباً والبوكسات العائلية) في التطبيقات ذات العمولة العالية فقط.`,
      qualityEn: 'Mall visitors see clear dine-in value, while delivery packaging costs are covered automatically.',
      qualityAr: 'يشعر زائر المجمع بسعر ممتاز عند الكاونتر، وتغطي طلبات التوصيل تكلفة تغليفها المحكم.',
      ...impactText(shieldMonthly, '3.5% net recovery across Tgo & Deliveroo top sellers with 98.5% order retention.', 'تعويض ٣٫٥٪ من عمولة التوصيل على الأطباق الأكثر طلباً مع ثبات ٩٨٫٥٪ من الطلبات.'),
      evidence: [
        { en: `${f0(cgMenu.shopOrders)} counter orders at 0% commission vs ${f0(cgMenu.deliveryOrders)} app orders`, ar: `${f0(cgMenu.shopOrders)} طلب كاونتر بصفر عمولة مقابل ${f0(cgMenu.deliveryOrders)} طلب عبر التطبيقات` },
      ],
      kpi: { id: 'menu-channel-shield-gap', en: 'Delivery menu margin recovery', ar: 'نسبة تعويض هامش قوائم التوصيل', value: 3.5, unit: 'pct', better: 'up' },
      elasticityGuardrail: {
        inelastic: cgMenu.top.slice(0, 2).map((d) => ({ name: enItemName(d.name), priceKwd: d.avgPriceKwd, suggestedFils: 200 })),
        trafficDrivers: cgMenu.top.slice(2, 4).map((d) => ({
          name: enItemName(d.name),
          priceKwd: d.avgPriceKwd,
          ruleEn: 'Keep same price on entry combos; adjust standalone popular mains only',
          ruleAr: 'يبقى سعر وجبات الكومبو ثابتاً والتعديل على الأطباق الرئيسية فقط',
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
      titleEn: 'Kuwait Payday, Zwarah & Mid-Month Menu Offers',
      titleAr: 'عروض أيام الرواتب وزوارة الويكند ووجبات منتصف الشهر',
      subjectEn: `China Garden · Frank's · Tahina · The Noodle Bar · Active Mode: ${KUWAIT_CALENDAR_PULSE.badgeEn}`,
      subjectAr: `تشاينا جاردن · فرانكس · طحينة · ذا نودل بار · الوضع الحالي: ${KUWAIT_CALENDAR_PULSE.badgeAr}`,
      leakEn: `Odoo daily sales show two clear spending waves in Kuwait: Payday & Thu/Fri Zwarah days average ${KWD(KUWAIT_TIME_CURVE.paydayAvgKwd)}/day (${f0(KUWAIT_TIME_CURVE.paydayAvgOrders)} orders, peaking at ${KWD(KUWAIT_TIME_CURVE.peakDayKwd)}), while Mid-Month Sun–Wed days (10th–19th) dip to ${KWD(KUWAIT_TIME_CURVE.midAvgKwd)}/day (${f0(KUWAIT_TIME_CURVE.midAvgOrders)} orders). Keeping one static menu misses big Zwarah sharing orders on weekends and loses solo orders mid-month.`,
      leakAr: `توضح مبيعات أودو اليومية أن السوق في الكويت يمر بموجتين: أيام الرواتب وزوارة الخميس والجمعة بمتوسط ${DK(KUWAIT_TIME_CURVE.paydayAvgKwd)} يومياً (${f0(KUWAIT_TIME_CURVE.paydayAvgOrders)} طلب وتصل إلى ${DK(KUWAIT_TIME_CURVE.peakDayKwd)})، بينما تهدأ أيام منتصف الشهر من ١٠ إلى ١٩ إلى ${DK(KUWAIT_TIME_CURVE.midAvgKwd)} يومياً (${f0(KUWAIT_TIME_CURVE.midAvgOrders)} طلب). بقاء المنيو بنفس الترتيب طوال الشهر يضيّع صواني الزوارة الكبيرة بالويكند ويقلل طلبات الأفراد بمنتصف الشهر.`,
      actionEn: `Switch featured POS & delivery app banners by calendar date: (1) Days 20–29 + Every Thu/Fri Zwarah: highlight Family Sharing Boxes first (China Garden Zwarah Feast 15.900 KWD, Frank's 4-Philly Tray 17.500 KWD, Tahina 16-Shawarma Box 13.900 KWD) with zero flat discounts; (2) Days 10–19 Mid-Month Value Meals: feature filling meals under 4 KWD (China Garden Noodles + Sweet Corn Soup 3.850 KWD, The Noodle Bar Sriracha Meal 3.950 KWD, Frank's Philly + Ziggy Fries 3.950 KWD).`,
      actionAr: `تبديل الأصناف البارزة في الكاشير والتطبيقات حسب أيام الشهر: (١) أيام ٢٠–٢٩ ومع كل خميس وجمعة (الزوارة): إبراز بوكسات المشاركة العائلية بالصدارة (وليمة زوارة تشاينا جاردن ١٥٫٩٠٠ د.ك، صينية فرانكس العائلية ١٧٫٥٠٠ د.ك، بوكس شاورما طحينة ١٣٫٩٠٠ د.ك) بدون خصومات؛ (٢) أيام ١٠–١٩ (عروض منتصف الشهر): إبراز وجبات مشبعة للأفراد تحت ٤ دنانير بربح ممتاز (وجبة نودلز مع شوربة الذرة ٣٫٨٥٠ د.ك، سيراتشا نودلز مع مشروب ٣٫٩٥٠ د.ك، وفيلي ستيك مع بطاطس زيجي ٣٫٩٥٠ د.ك).`,
      qualityEn: 'Families receive generous, hot Zwarah platters on weekends, while mid-month guests get complete meals at an attractive price without hurting margins.',
      qualityAr: 'تحصل العائلات على صواني زوارة سخية ومرتبة في الويكند، ويحصل زبون منتصف الشهر على وجبة مشبعة بسعر مناسب بدون خصومات تضر الربح.',
      ...impactText(calMonthly, '6% Zwarah family-box uptake on Payday/weekend days + 8% order retention on Days 10–19 without discount burn.', 'زيادة ٦٪ في طلب البوكسات العائلية أيام الرواتب والزوارة مع الحفاظ على ٨٪ من طلبات منتصف الشهر بدون حرق الأسعار.'),
      evidence: [
        { en: `Payday/Zwarah avg: ${KWD(KUWAIT_TIME_CURVE.paydayAvgKwd)}/day vs Mid-Month: ${KWD(KUWAIT_TIME_CURVE.midAvgKwd)}/day (+${f0(KUWAIT_TIME_CURVE.surgeKwdPct)}%)`, ar: `متوسط الرواتب والزوارة: ${DK(KUWAIT_TIME_CURVE.paydayAvgKwd)}/يوم مقابل منتصف الشهر: ${DK(KUWAIT_TIME_CURVE.midAvgKwd)}/يوم (+${f0(KUWAIT_TIME_CURVE.surgeKwdPct)}٪)` },
      ],
      kpi: { id: 'menu-zwarah-surge-kwd', en: 'Payday & Zwarah daily sales average', ar: 'متوسط المبيعات اليومية في أيام الرواتب والزوارة', value: Math.round(KUWAIT_TIME_CURVE.paydayAvgKwd), unit: 'kwd', better: 'up' },
      simulator: {
        kind: 'bundle',
        sliders: [
          { id: 'zwarahMixPct', labelEn: 'Payday/Zwarah family-box uptake %', labelAr: 'نسبة إقبال الزبائن على بوكسات الزوارة والرواتب %', unit: 'pct', min: 4, max: 18, step: 1, defaultValue: 8 },
          { id: 'midShieldPct', labelEn: 'Mid-month value meal uptake %', labelAr: 'نسبة إقبال الزبائن على وجبات منتصف الشهر %', unit: 'pct', min: 5, max: 20, step: 1, defaultValue: 10 },
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
      titleEn: `${brandEn(brand)}: remove slow, multi-ingredient dishes slowing down the kitchen`, titleAr: `${brandAr(brand)}: إلغاء الأصناف البطيئة كثيرة المكونات لتسريع المطبخ`,
      subjectEn: items.slice(0, 4).map((i) => enItemName(i.name)).join(' · '), subjectAr: items.slice(0, 4).map((i) => arItemName(i.name)).join(' · '),
      leakEn: `${items.length} ${brandEn(brand)} items require 7+ ingredients each yet sold fewer than 15 units in 30 days (${items.slice(0, 4).map((i) => `${enItemName(i.name)} ${f0(i.qty)} units / ${i.lines} ingredients`).join('; ')}). They tie up prep space and cook time for just ${KWD(tailSales)} of sales.`,
      leakAr: `${items.length} أصناف في ${brandAr(brand)} يحتاج كل واحد منها 7 مكونات أو أكثر لكنها باعت أقل من 15 طلب طوال الشهر (${items.slice(0, 4).map((i) => `${arItemName(i.name)} ${f0(i.qty)} طلب / ${i.lines} مكونات`).join('؛ ')}). تأخذ وقت التحضير ومساحة الثلاجة مقابل ${DK(tailSales)} مبيعات فقط.`,
      actionEn: `Remove these ${items.length} slow items from Odoo POS and delivery menus, give their screen space to top sellers, and drop their single-use ingredients from Ardiya Central Kitchen prep.`,
      actionAr: `إلغاء هذه الأصناف الـ ${items.length} من الكاشير وتطبيقات التوصيل، وإعطاء مساحتها للأطباق الأكثر طلباً، وإيقاف تحضير مكوناتها الخاصة في مطبخ العارضية.`,
      qualityEn: 'A focused menu means faster prep at peak hours, fewer mistakes and fresher ingredients on every main dish.',
      qualityAr: 'منيو مختصر وواضح يعني تحضير أسرع وقت الزحمة وأخطاء أقل ومكونات طازجة دائماً.',
      ...impactText(monthly, 'Half of those orders shift to higher-margin popular dishes; 20% less ingredient waste.', 'انتقال نصف الطلبات للأصناف الأكثر ربحاً وتوفير 20% من هدر المكونات.'),
      evidence: [{ en: `${drag.length} slow multi-ingredient dishes across brands`, ar: `${drag.length} صنفاً بطيئاً كثير المكونات` }],
      kpi: { id: `menu-drag-${brand}`, en: `${brandEn(brand)} slow complex items`, ar: `الأصناف البطيئة · ${brandAr(brand)}`, value: items.length, unit: 'count', better: 'down' },
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
      titleEn: 'Manual cashier discounts above the company average', titleAr: 'ضبط خصومات الكاشير اليدوية الزائدة في الفروع',
      subjectEn: `${over.map((l) => locEn(l.location)).join(' · ')} registers`, subjectAr: `كاشير ${over.map((l) => locAr(l.location)).join(' · ')}`,
      leakEn: `${locEn(w.location)} gave ${f1(w.discountPct)}% of sales in POS discounts (${KWD(w.lineDiscountKwd + w.promoLinesKwd)} in 30 days) compared with ${f1(avg)}% across all 7 branches.${dish ? ` Most discounted item: ${enItemName(dish.name)} (${brandEn(dish.brand)}, ${KWD(dish.discountKwd)} across ${dish.lines} orders).` : ''}`,
      leakAr: `سجّل فرع ${locAr(w.location)} خصومات بنسبة ${f1(w.discountPct)}% من المبيعات (${DK(w.lineDiscountKwd + w.promoLinesKwd)} خلال 30 يوماً) مقابل متوسط ${f1(avg)}% في باقي الفروع.${dish ? ` وأكثر طبق عليه خصومات هو ${arItemName(dish.name)} (${brandAr(dish.brand)}، بقيمة ${DK(dish.discountKwd)} في ${dish.lines} طلب).` : ''}`,
      actionEn: 'Require a manager PIN for any manual POS discount with a 10% cap, make selecting a reason mandatory, and review the weekly discount report per cashier.',
      actionAr: 'ربط أي خصم يدوي في الكاشير برقم سري للمدير وبحد أقصى 10%، وإلزام كتابة سبب الخصم، ومراجعة كشف الخصومات أسبوعياً مع مديري الفروع.',
      qualityEn: 'Customer compensation stays fair, documented and under clear manager oversight.',
      qualityAr: 'يبقى تعويض الزبون منظماً وواضح السبب تحت إشراف مدير الفرع.',
      ...impactText(monthly, 'Bringing high-discount branches 60% closer to the company average.', 'بتقليص الخصومات الزائدة بنسبة 60% لتعود إلى المعدل الطبيعي للشركة.'),
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
      titleEn: 'Cashier registers opening late or closing early', titleAr: 'الالتزام بمواعيد فتح وإغلاق أجهزة الكاشير بالوقت المحدد',
      subjectEn: offenders.slice(0, 3).map((r) => r.register).join(' · '), subjectAr: offenders.slice(0, 3).map((r) => arRegisterName(r.register)).join(' · '),
      leakEn: `${offenders.map((r) => `${r.register}: ${r.lateOpenings} late openings, ${r.earlyClosings} early closings (usual ${r.medianOpen}–${r.medianClose ?? '—'})`).join('; ')} — each delay means 45+ minutes of missed delivery and walk-in orders.`,
      leakAr: `${offenders.map((r) => `${arRegisterName(r.register)}: ${r.lateOpenings} مرة فتح متأخر و${r.earlyClosings} مرة إغلاق مبكر (الوقت المعتاد ${r.medianOpen}–${r.medianClose ?? '—'})`).join('؛ ')} — كل تأخير يضيّع أكثر من 45 دقيقة من طلبات التوصيل وزوار المجمع.`,
      actionEn: `Set fixed opening and closing schedules per register in Odoo, send an automatic alert to the area manager if ${top.register} is not open within 15 minutes, and tie shift supervisor bonuses to on-time opening.`,
      actionAr: `تثبيت وقت الفتح والإغلاق لكل كاشير في أودو، وإرسال تنبيه فوري لمدير المنطقة إذا تأخر فتح ${arRegisterName(top.register)} أكثر من 15 دقيقة، وربط مكافأة مشرف الشفت بالالتزام الكامل.`,
      qualityEn: 'Opening on time protects our delivery app visibility and customer trust.',
      qualityAr: 'الالتزام بوقت الفتح يحافظ على ظهور المطعم في مقدمة تطبيقات التوصيل وثقة الزبائن.',
      ...impactText(atRisk, 'Each late/early session valued at 45 minutes of average hourly register sales.', 'كل تأخير في الفتح أو إغلاق مبكر محسوب بمتوسط مبيعات 45 دقيقة للفرع.'),
      evidence: [{ en: `${sum(regs, (r) => r.sessions)} POS sessions checked across ${regs.length} branch registers`, ar: `مراجعة ${sum(regs, (r) => r.sessions)} شفت كاشير عبر ${regs.length} جهاز في الفروع` }],
      kpi: { id: 'ops-session-exceptions', en: 'Late openings + early closings', ar: 'مرات الفتح المتأخر والإغلاق المبكر', value: sum(regs, (r) => r.lateOpenings + r.earlyClosings), unit: 'count', better: 'down' },
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
      subjectEn: `${f0(totalCounterOrders)} monthly counter orders · Promenade Mall · 360 Mall · Assima Mall · The Avenues · Al-Kout Mall`,
      subjectAr: `${f0(totalCounterOrders)} طلب كاونتر شهرياً · مجمع البروميناد · مجمع 360 · مجمع العاصمة · الأفنيوز · مجمع الكوت`,
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

  // 1. Branch Net Profit & Running an Extra Brand in the Same Kitchen
  if (HOST_KITCHEN) {
    const h = HOST_KITCHEN
    const stars = [...BRANCH_TRUE_CASH].sort((a, b) => b.trueNetCash - a.trueNetCash).slice(0, 2)
    const secondSqueezed = [...BRANCH_TRUE_CASH].filter((r) => r.id !== h.target.id).sort((a, b) => a.trueNetCash - b.trueNetCash)[0]
    const netLabel = (v: number, ar = false) => (v >= 0 ? `+${ar ? DK(v) : KWD(v)}` : `-${ar ? DK(Math.abs(v)) : KWD(Math.abs(v))}`)
    out.push(play({
      id: `opex-host-kitchen-${h.target.id}`, stage: 'opex', basis: 'estimated', monthlyKwd: h.contribution,
      titleEn: `Run ${brandEn(h.brand)} inside ${locEn(h.target.id)} kitchen (zero extra rent)`,
      titleAr: `تشغيل مطعم إضافي (${brandAr(h.brand)}) بنفس مطبخ ${locAr(h.target.id)} (بدون إيجار جديد)`,
      subjectEn: `${locEn(h.target.id)} + ${brandEn(h.brand)}`, subjectAr: `${locAr(h.target.id)} + ${brandAr(h.brand)}`,
      leakEn: `Comparing net branch sales after delivery commissions against rent and payroll shows strong cash branches (${stars.map((s) => `${locEn(s.id)}: ${netLabel(s.trueNetCash)}`).join('; ')}) versus ${locEn(h.target.id)}, where monthly rent (${KWD(h.target.rent)}, ${f1(h.target.rentPct)}%) and salaries (${f1(h.target.fixedBurdenPct)}% fixed costs) leave ${KWD(h.target.branchDirectCash)} before shared kitchen/HQ expenses and ${netLabel(h.target.trueNetCash)} final net cash${secondSqueezed ? ` (${locEn(secondSqueezed.id)} is next at ${netLabel(secondSqueezed.trueNetCash)} / ${f1(secondSqueezed.rentPct)}% rent)` : ''}. ${locEn(h.target.id)} needs +${KWD(h.dailyGapKwd)}/day (~${h.dailyGapOrders} extra orders/day) to hit a healthy 15% net profit margin, while ${brandEn(h.brand)} is not active there yet.`,
      leakAr: `مقارنة مبيعات الفروع بعد العمولات بالإيجارات والرواتب توضح الفروع الأعلى ربحاً (${stars.map((s) => `${locAr(s.id)}: ${netLabel(s.trueNetCash, true)}`).join('؛ ')}) مقابل فرع ${locAr(h.target.id)}، حيث يأخذ الإيجار (${DK(h.target.rent)}، بنسبة ${f1(h.target.rentPct)}%) مع الرواتب والسكن (${f1(h.target.fixedBurdenPct)}%) جزءاً كبيراً من الدخل ليبقى ${DK(h.target.branchDirectCash)} قبل مصاريف المطبخ المركزي والإدارة و${netLabel(h.target.trueNetCash, true)} صافي نهائي${secondSqueezed ? ` (يليه ${locAr(secondSqueezed.id)} عند ${netLabel(secondSqueezed.trueNetCash, true)})` : ''}. يحتاج ${locAr(h.target.id)} إلى +${DK(h.dailyGapKwd)} يومياً (حوالي ${h.dailyGapOrders} طلب إضافي باليوم) للوصول إلى ربح صافي 15%، بينما مطعم ${brandAr(h.brand)} غير مفعّل في هذا الفرع حالياً.`,
      actionEn: `Activate ${brandEn(h.brand)} for delivery orders from the existing ${locEn(h.target.id)} kitchen — zero extra rent, using the same kitchen team with dedicated packaging and Talabat/Keeta accounts.`,
      actionAr: `تفعيل مطعم ${brandAr(h.brand)} لطلبات التوصيل من داخل مطبخ ${locAr(h.target.id)} الحالي — بدون أي إيجار إضافي وبنفس الطاقم مع تغليف خاص بـ ${brandAr(h.brand)} وحسابات مستقلة على طلبات وكيتا.`,
      qualityEn: 'Higher order volume keeps ingredients fresh and utilizes the kitchen team efficiently between peak waves.',
      qualityAr: 'زيادة الطلبات تحرك المخزون أولاً بأول وتستفيد من وقت الطاقم بين فترات الذروة.',
      ...impactText(h.contribution, `75% of ${brandEn(h.brand)}’s ${KWD(h.medianSales)} branch average = ${KWD(h.sales)}/month sales, bringing ${locEn(h.target.id)} rent down from ${f1(h.target.rentPct)}% to ${f1(h.rentAfterPct)}%.`, `تحقيق 75% من متوسط مبيعات فروع ${brandAr(h.brand)} (${DK(h.sales)} شهرياً) يخفض نسبة إيجار ${locAr(h.target.id)} من ${f1(h.target.rentPct)}% إلى ${f1(h.rentAfterPct)}%.`),
      evidence: [
        { en: `${locEn(h.target.id)} daily target: +${KWD(h.dailyGapKwd)}/day (${h.dailyGapOrders} orders/day)`, ar: `المطلوب يومياً في ${locAr(h.target.id)}: +${DK(h.dailyGapKwd)}/يوم (${h.dailyGapOrders} طلب/يوم)` },
        { en: `${brandEn(h.brand)} top branch: ${locEn(h.best.location)} ${KWD(h.best.netKwd)}/30d`, ar: `أعلى فرع لمطعم ${brandAr(h.brand)}: ${locAr(h.best.location)} بمبيعات ${DK(h.best.netKwd)} شهرياً` },
      ],
      kpi: { id: `opex-rent-pct-${h.target.id}`, en: `Rent % of sales · ${locEn(h.target.id)}`, ar: `نسبة الإيجار من المبيعات · ${locAr(h.target.id)}`, value: Math.round(h.target.rentPct * 10) / 10, unit: 'pct', better: 'down' },
    }))
  }

  // 2. Brand Profit Review: Canteen Loss & Marketing Cap
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
      titleEn: "Stop school canteen losses & cap Frank's marketing spend",
      titleAr: 'مراجعة خسارة الكانتين وضبط مصاريف تسويق فرانكس',
      subjectEn: `${brandEn('fresh-daily-canteen')} · ${brandEn('franks')} · ${brandEn('farm-brown')}`,
      subjectAr: `${brandAr('fresh-daily-canteen')} · ${brandAr('franks')} · ${brandAr('farm-brown')}`,
      leakEn: `Odoo brand results show ${brandEn('china-garden')} generating strong profit (${KWD(cgBrand?.inc ?? 0)} sales, ${f1(cgBrand?.rentPct ?? 0)}% rent), while ${brandEn('fresh-daily-canteen')} loses ${KWD(Math.abs(canteenBrand.netBeforePayroll))} before salaries (${KWD(canteenBrand.inc)} sales vs ${f1(canteenBrand.foodPct)}% food cost + ${KWD(canteenBrand.rent)} [${f1(canteenBrand.rentPct)}%] rent). Meanwhile ${brandEn('franks')} spends ${KWD(franksBrand?.mkt ?? 0)} on marketing (${f1(franksBrand?.mktPer1k ?? 0)} KWD per 1,000 KWD of sales) and ${brandEn('farm-brown')} pays ${f1(farmBrand?.rentPct ?? 0)}% in rent (${KWD(farmBrand?.rent ?? 0)}).`,
      leakAr: `توضح أرقام أودو أن مطعم ${brandAr('china-garden')} يحقق فائضاً ممتازاً (${DK(cgBrand?.inc ?? 0)} مبيعات، وإيجار ${f1(cgBrand?.rentPct ?? 0)}% فقط)، بينما يخسر نشاط ${brandAr('fresh-daily-canteen')} مبلغ ${DK(Math.abs(canteenBrand.netBeforePayroll))} قبل الرواتب (${DK(canteenBrand.inc)} مبيعات مقابل ${f1(canteenBrand.foodPct)}% تكلفة مواد + ${DK(canteenBrand.rent)} [${f1(canteenBrand.rentPct)}%] إيجار). وفي نفس الوقت يصرف ${brandAr('franks')} مبلغ ${DK(franksBrand?.mkt ?? 0)} على التسويق (${f1(franksBrand?.mktPer1k ?? 0)} د.ك لكل ألف دينار مبيعات).`,
      actionEn: "Renegotiate canteen rent from a fixed fee to a revenue-share cap (<=18% of sales), adjust canteen recipes to <=36% food cost, and cap Frank's marketing budget at <=15 KWD per 1,000 KWD of sales.",
      actionAr: 'تعديل عقد إيجار الكانتين ليكون نسبة من المبيعات بحد أقصى 18% بدل المبلغ الثابت، وضبط وصفات الكانتين لتكون تكلفة المواد أقل من 36%، ووضع سقف لتسويق فرانكس لا يتجاوز 15 د.ك لكل ألف دينار مبيعات.',
      qualityEn: 'Every brand covers its own expenses profitably without eating into China Garden’s profits.',
      qualityAr: 'يربح كل مطعم بذاته بدل أن يستهلك من أرباح تشاينا جاردن.',
      ...impactText(monthly, "Stopping the canteen cash loss plus saving 35% of excess marketing spend on Frank's.", 'بإيقاف خسارة الكانتين الشهرية وتوفير 35% من مصاريف التسويق الزائدة في فرانكس.'),
      evidence: [
        { en: `${brandEn('fresh-daily-canteen')}: ${f1(canteenBrand.foodPct)}% food + ${f1(canteenBrand.rentPct)}% rent`, ar: `${brandAr('fresh-daily-canteen')}: ${f1(canteenBrand.foodPct)}% مواد + ${f1(canteenBrand.rentPct)}% إيجار` },
        { en: `${brandEn('franks')}: ${f1(franksBrand?.mktPer1k ?? 0)} KWD marketing / 1k sales`, ar: `${brandAr('franks')}: ${f1(franksBrand?.mktPer1k ?? 0)} د.ك تسويق لكل ألف دينار مبيعات` },
      ],
      kpi: { id: 'opex-canteen-food-pct', en: 'Canteen food + rent % of sales', ar: 'نسبة المواد والإيجار · الكانتين', value: Math.round((canteenBrand.foodPct + canteenBrand.rentPct) * 10) / 10, unit: 'pct', better: 'down' },
    }))
  }

  // 3. Branch Cleaning, Kitchen Supplies & Utilities Spend Comparison
  const ANOMALY_CATS: { key: string; en: string; ar: string; countInSaving: boolean }[] = [
    { key: 'cleaning', en: 'Cleaning & Hood', ar: 'المنظفات وتنظيف الهود', countInSaving: true },
    { key: 'kitchen-supplies', en: 'Kitchen Smallwares & Supplies', ar: 'أدوات ومستلزمات المطبخ', countInSaving: true },
    { key: 'utilities', en: 'Utilities (Water & Power)', ar: 'الكهرباء والماء', countInSaving: true },
    { key: 'maintenance', en: 'Branch Maintenance', ar: 'صيانة الفرع', countInSaving: false },
    { key: 'packaging', en: 'Packaging', ar: 'التغليف', countInSaving: false },
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
      titleEn: 'Cut excess cleaning & kitchen supply bills in high-spend branches',
      titleAr: 'ضبط مصاريف النظافة ومستلزمات المطبخ الزائدة في بعض الفروع',
      subjectEn: topSubjects.map((id) => locEn(id)).join(' · '),
      subjectAr: topSubjects.map((id) => locAr(id)).join(' · '),
      leakEn: `Comparing branch expenses per 1,000 KWD of sales highlights ${anomalies.length} branches spending far above normal (${KWD(totalExcess)} above peer average): ${anomalies.slice(0, 4).map((a) => `${locEn(a.loc)} ${a.catEn} at ${f1(a.per1k)} KWD/1k vs ${f1(a.medPer1k)} normal (${KWD(a.kwd)}, +${KWD(a.excessKwd)} extra)`).join('; ')}.`,
      leakAr: `مقارنة مصاريف الفروع لكل ألف دينار مبيعات تكشف ${anomalies.length} بنود أعلى بكثير من المعدل الطبيعي لباقي الفروع (بزيادة ${DK(totalExcess)}): ${anomalies.slice(0, 4).map((a) => `${locAr(a.loc)} في ${a.catAr} يصرف ${f1(a.per1k)} د.ك لكل ألف مبيعات مقابل معدل ${f1(a.medPer1k)} د.ك (${DK(a.kwd)}، بزيادة +${DK(a.excessKwd)})`).join('؛ ')}.`,
      actionEn: `Set a monthly branch spending cap per 1,000 KWD of sales on Cleaning, Kitchen Supplies and Utilities; check ${locEn(topA.loc)}’s chemical usage and hood-cleaning invoices, and require area-manager approval above the cap.`,
      actionAr: `تحديد سقف شهري للصرف في كل فرع على المنظفات ومستلزمات المطبخ والكهرباء حسب مبيعاته؛ ومراجعة استهلاك مواد التنظيف وفواتير الهود في ${locAr(topA.loc)} واشتراط موافقة مدير المنطقة لأي طلب فوق السقف.`,
      qualityEn: 'Proper dosing dispensers keep kitchens spotless without wasting cleaning chemicals or supplies.',
      qualityAr: 'استخدام مضخات معايرة للمنظفات يحافظ على أعلى نظافة للمطبخ بدون تبذير للمواد.',
      ...impactText(monthly, 'Saving 65% of the extra cleaning, kitchen supply and utility spend above the 7-branch average.', 'بتوفير 65% من المصاريف الزائدة عن المعدل الطبيعي للفروع السبعة (بدون تكرار حساب التغليف والصيانة).'),
      evidence: anomalies.slice(0, 3).map((a) => ({ en: `${locEn(a.loc)} · ${a.catEn}: ${f1(a.per1k)} vs ${f1(a.medPer1k)} KWD/1k`, ar: `${locAr(a.loc)} · ${a.catAr}: ${f1(a.per1k)} مقابل معدل ${f1(a.medPer1k)} د.ك/ألف` })),
      kpi: { id: `opex-anom-${topA.loc}-${topA.catKey}`, en: `${topA.catEn} per 1,000 KWD · ${locEn(topA.loc)}`, ar: `${topA.catAr} لكل ألف د.ك · ${locAr(topA.loc)}`, value: Math.round(topA.per1k * 10) / 10, unit: 'kwd', better: 'down' },
    }))
  }

  // 4. Petty-Cash Custodies & Direct Cash Purchases Without Purchase Orders
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
      titleEn: 'Stop cash purchases without POs & close open petty-cash floats weekly',
      titleAr: 'ضبط المشتريات الفورية بدون أمر شراء وإقفال العُهد النقدية كل خميس',
      subjectEn: `${topOff.map((x) => locEn(x.id)).join(' · ')} · Open petty-cash floats`,
      subjectAr: `${topOff.map((x) => locAr(x.id)).join(' · ')} · العُهد النقدية المفتوحة`,
      leakEn: `${J.procurement.bills.offPoCount} supplier bills totalling ${KWD(offPoKwd)} were entered in 30 days without an approved purchase order${topOff.length ? ` — highest at ${topOff.map((x) => `${locEn(x.id)} (${KWD(x.kwd)})`).join(', ')}` : ''}. At the same time, ${KWD(custody.totalKwd)} sits in open petty-cash floats (${KWD(custody.individualKwd)} across ${custody.individualAccounts} staff floats) bought at retail grocery prices.`,
      leakAr: `دُفعت ${J.procurement.bills.offPoCount} فاتورة مشتريات بقيمة ${DK(offPoKwd)} خلال 30 يوماً بدون أمر شراء مسبق${topOff.length ? ` — أكثرها في ${topOff.map((x) => `${locAr(x.id)} (${DK(x.kwd)})`).join('، ')}` : ''}. كما يوجد ${DK(custody.totalKwd)} في عُهد نقدية مفتوحة (${DK(custody.individualKwd)} موزعة على ${custody.individualAccounts} موظفين) تُشترى غالباً بأسعار الجمعيات والتجزئة المرتفعة.`,
      actionEn: 'Require an Odoo purchase order on every bill above 25 KWD, cap branch emergency petty cash at 300 KWD linked to the branch name, and settle all open staff floats every Thursday.',
      actionAr: 'منع أي فاتورة شراء فوق 25 د.ك بدون أمر شراء معتمد في أودو، وتحديد سقف عهدة الطوارئ للفرع بـ 300 د.ك فقط، وتصفية جميع العُهد النقدية المفتوحة كل يوم خميس.',
      qualityEn: 'Planned supplier orders stop last-minute grocery runs and keep kitchen ingredients consistent.',
      qualityAr: 'الشراء المنظّم من الموردين المعتمدين يمنع الشراء العشوائي ويحافظ على ثبات طعم وجودة الأكل.',
      ...impactText(monthly, `Saving the 12% retail price markup on ${KWD(offPoKwd)} of unplanned bills while tightening ${KWD(custody.totalKwd)} in open cash floats.`, `توفير 12% فرق سعر السوق العادي عن أسعار عقود الموردين على ${DK(offPoKwd)}، مع ضبط ${DK(custody.totalKwd)} في العُهد المفتوحة.`),
      evidence: [
        { en: `Bills without PO: ${KWD(offPoKwd)} (${J.procurement.bills.offPoCount} bills)`, ar: `فواتير بدون أمر شراء: ${DK(offPoKwd)} (${J.procurement.bills.offPoCount} فاتورة)` },
        { en: `Open petty-cash floats: ${KWD(custody.totalKwd)} (${custody.individualAccounts} staff accounts)`, ar: `عُهد نقدية مفتوحة: ${DK(custody.totalKwd)} (${custody.individualAccounts} عهدة موظف)` },
      ],
      kpi: { id: 'opex-custody-kwd', en: 'Open petty-cash & custody balances', ar: 'رصيد العُهد النقدية المفتوحة', value: Math.round(custody.totalKwd), unit: 'kwd', better: 'down' },
    }))
  }

  // 5. Equipment Breaking Down Repeatedly: Buying New Saves More Than Constant Repairs
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
      return `${locEn(s.location)}: ${s.reactivePostings120d ?? s.postings120d} emergency repairs = ${KWD(s.reactiveKwd120d ?? s.kwd120d)} over ${s.activeMonths} months${eq ? ` [${eq}]` : ''}`
    }).join('; ')
    const eqSummaryAr = topSites.map((s) => {
      const eq = s.equipment.slice(0, 2).map((e) => `${EQUIP[e.key]?.[1] ?? e.key} (${e.postings} مرات، ${DK(e.kwd)})`).join('، ')
      return `${locAr(s.location)}: ${s.reactivePostings120d ?? s.postings120d} تصليحات طارئة بتكلفة ${DK(s.reactiveKwd120d ?? s.kwd120d)} خلال ${s.activeMonths} أشهر${eq ? ` (${eq})` : ''}`
    }).join('؛ ')
    out.push(play({
      id: 'opex-repair-loop-capex', stage: 'opex', basis: 'posted', monthlyKwd: monthly,
      titleEn: 'Equipment breaking down repeatedly: buying new saves more than constant repairs',
      titleAr: 'معدات تتكرر أعطالها: شراء جديد أوفر من تصليحها',
      subjectEn: topSites.map((s) => locEn(s.location)).join(' · '),
      subjectAr: topSites.map((s) => locAr(s.location)).join(' · '),
      leakEn: `4-month maintenance invoices show repeated repair call-outs on the exact same equipment: ${eqSummaryEn}. Paying for emergency A/C, chiller and plumbing patches every few weeks drains cash and puts cold storage at risk.`,
      leakAr: `فواتير الصيانة لآخر ٤ أشهر تكشف تكرار التصليح على نفس المعدات: ${eqSummaryAr}. استمرار دفع فواتير تصليح التكييف والثلاجات والسباكة كل أسبوعين يكلّف أكثر من شراء جديد ويعرّض تبريد اللحوم للخطر.`,
      actionEn: `Replace any A/C unit, chiller or kitchen machine whose yearly repair bills exceed 35% of a new unit's price — starting with the A/C units at Ardiya Central Kitchen, plumbing/A/C at Ardiya branch, and chillers/hood at Al-Kout Mall under manufacturer warranty.`,
      actionAr: `استبدال أي مكيف أو ثلاجة أو معدة مطبخ تتجاوز فواتير تصليحها السنوية ٣٥٪ من سعر الجديد — بدءاً بمكيفات مطبخ العارضية المركزي، والتكييف والسباكة في فرع العارضية، وثلاجات وهود مجمع الكوت مع كفالة المصنع.`,
      qualityEn: 'Reliable central-kitchen A/C and branch chillers keep meat and poultry safely at <=4°C even in summer peak.',
      qualityAr: 'مكيفات وثلاجات جديدة ومضمونة تحفظ اللحوم والدجاج بدرجة تبريد آمنة (٤ درجات أو أقل) وتحمي المطبخ وقت الذروة.',
      ...impactText(monthly, `Saving 55% of emergency breakdown bills across these ${topSites.length} locations (${KWD(reactive120)} over 4 months).`, `توفير 55% من فواتير التصليحات الطارئة في هذه المواقع الثلاثة (${DK(reactive120)} خلال ٤ أشهر).`),
      evidence: topSites.map((s) => ({ en: `${locEn(s.location)}: ${KWD(s.kwd120d)} total / ${KWD(s.reactiveKwd120d ?? s.kwd120d)} emergency repairs (4m)`, ar: `${locAr(s.location)}: ${DK(s.kwd120d)} إجمالي / ${DK(s.reactiveKwd120d ?? s.kwd120d)} تصليح طارئ (٤ أشهر)` })),
      kpi: { id: `opex-maint-${primary.location}`, en: `Emergency repairs (4 months) · ${locEn(primary.location)}`, ar: `فواتير الصيانة الطارئة (٤ أشهر) · ${locAr(primary.location)}`, value: Math.round(primary.reactiveKwd120d ?? primary.kwd120d), unit: 'kwd', better: 'down' },
    }))
  }

  // 6. Tagging Every Expense Bill to Its Branch or Restaurant in Odoo
  const unalloc = J.opex.unallocated?.rolling30
  const unallocMtd = J.opex.unallocated?.mtd
  if (unalloc && unalloc.grossDebitKwd > 250) {
    const monthly = Math.max(85, unalloc.directOpexKwd * 0.15)
    out.push(play({
      id: 'opex-unallocated-analytic-governance', stage: 'opex', basis: 'posted', monthlyKwd: monthly, severity: 'medium',
      titleEn: 'Tag every expense bill to its branch or brand in Odoo',
      titleAr: 'ربط كل فاتورة مصاريف باسم الفرع أو المطعم الخاص بها في أودو',
      subjectEn: 'Stationery · Kitchen tools · Hospitality · Food trials',
      subjectAr: 'القرطاسية · أدوات المطبخ · الضيافة · تجارب الأطعمة',
      leakEn: `In the last 30 days, ${f0(unalloc.lines)} expense entries totalling ${KWD(unalloc.grossDebitKwd)} (${KWD(unalloc.directOpexKwd)} in direct stationery, kitchen tools, hospitality and food trials plus ${KWD(Math.abs(unalloc.stockVarianceContraKwd))} in stock adjustments) were posted in Odoo without selecting which branch or brand spent them. In November so far, ${KWD(unallocMtd?.grossDebitKwd ?? 0)} across ${f0(unallocMtd?.lines ?? 0)} entries is also untagged.`,
      leakAr: `خلال آخر 30 يوماً، سُجلت ${f0(unalloc.lines)} فاتورة مصاريف بقيمة ${DK(unalloc.grossDebitKwd)} (منها ${DK(unalloc.directOpexKwd)} قرطاسية وأدوات مطبخ وضيافة وتجارب أطعمة، و${DK(Math.abs(unalloc.stockVarianceContraKwd))} فروقات مخزون) بدون تحديد اسم الفرع أو المطعم الذي صرفها في أودو. ومنذ بداية نوفمبر هناك ${DK(unallocMtd?.grossDebitKwd ?? 0)} عبر ${f0(unallocMtd?.lines ?? 0)} قيد بدون تحديد الفرع.`,
      actionEn: 'Make selecting a Branch, Central Kitchen, Head Office or Brand mandatory in Odoo before any expense bill can be saved, and assign November’s untagged bills before month-end close.',
      actionAr: 'جعل اختيار اسم الفرع أو المطبخ المركزي أو الإدارة إلزامياً في أودو قبل حفظ أي فاتورة مصروفات، وتوزيع فواتير نوفمبر غير المربوطة على فروعها قبل إقفال الشهر.',
      qualityEn: 'Every branch manager sees a 100% accurate monthly profit sheet with zero orphan bills.',
      qualityAr: 'تكون حسبة أرباح ومصاريف كل فرع واضحة ودقيقة ١٠٠٪ بدون مصاريف ضائعة بين الفروع.',
      ...impactText(monthly, `15% spend reduction on ${KWD(unalloc.directOpexKwd)}/month of untagged stationery, hospitality and trial bills once each branch is accountable.`, `توفير 15% من مصاريف القرطاسية والضيافة والتجارب (${DK(unalloc.directOpexKwd)} شهرياً) بمجرد تحميل كل فرع مسؤولية فواتيره.`),
      evidence: [
        { en: `${f0(unalloc.lines)} untagged entries · ${KWD(unalloc.grossDebitKwd)} total (30d)`, ar: `${f0(unalloc.lines)} قيد بدون تحديد فرع · ${DK(unalloc.grossDebitKwd)} (30 يوماً)` },
        { en: `Nov MTD untagged: ${KWD(unallocMtd?.grossDebitKwd ?? 0)} (${f0(unallocMtd?.lines ?? 0)} entries)`, ar: `فواتير نوفمبر بدون تحديد فرع: ${DK(unallocMtd?.grossDebitKwd ?? 0)} (${f0(unallocMtd?.lines ?? 0)} قيد)` },
      ],
      kpi: { id: 'opex-unalloc-debit', en: 'Expenses without branch tag (30 days)', ar: 'مصاريف غير مربوطة بفرع محدد (30 يوماً)', value: Math.round(unalloc.grossDebitKwd), unit: 'kwd', better: 'down' },
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
      titleEn: 'Cap Keeta co-funded discounts eating into order profit',
      titleAr: 'إيقاف خصومات كيتا المشتركة التي تأكل ربح الطلب',
      subjectEn: `Keeta · ${KWD(keeta.sales)} sales (${f0(keeta.orders)} orders)`, subjectAr: `كيتا · ${DK(keeta.sales)} مبيعات (${f0(keeta.orders)} طلب)`,
      leakEn: `Keeta deducted ${KWD(keeta.promo)} in restaurant-funded campaign discounts (${f1(keeta.promoPct)}% of Keeta sales) on top of ${KWD(keeta.commissionKwd)} commission — leaving ${f1(pocketMarginPct)}% (${f3(keeta.pocketPerOrder)} KWD/order) before salaries and rent.`,
      leakAr: `خصمت كيتا ${DK(keeta.promo)} كعروض وخصومات على حساب المطعم (${f1(keeta.promoPct)}% من مبيعات كيتا) فوق ${DK(keeta.commissionKwd)} عمولة — ليبقى ${f1(pocketMarginPct)}% فقط (${f3(keeta.pocketPerOrder)} د.ك للطلب) قبل الرواتب والإيجار.`,
      actionEn: 'Set a 3.500 KWD minimum order on any co-funded Keeta offer, cap our share of the discount at 50%, and remove best-sellers (Chicken Noodles, Sweet & Sour Chicken) from percentage-off promos.',
      actionAr: 'وضع حد أدنى للطلب ٣٫٥٠٠ د.ك في أي عرض مشترك على كيتا، وألا تتجاوز مساهمة المطعم ٥٠٪ من الخصم، وإخراج الأطباق الأكثر طلباً (نودلز الدجاج ودجاج سويت آند ساور) من خصومات النسبة المئوية.',
      qualityEn: 'Protecting prices on signature dishes keeps brand value strong and attracts loyal customers.',
      qualityAr: 'حماية أسعار الأطباق الرئيسية تحافظ على قيمة المطعم وتجذب زبائن دائمين.',
      ...impactText(monthly, 'Saving 35% of discount burn via minimum-basket rules and excluding top sellers.', 'بتوفير 35% من خصومات العروض عبر شرط الحد الأدنى للطلب واستثناء الأطباق الأكثر طلباً.'),
      evidence: [{ en: `Left per Keeta order before rent & salaries: ${f3(keeta.pocketPerOrder)} KWD`, ar: `المتبقي من طلب كيتا قبل الإيجار والرواتب: ${f3(keeta.pocketPerOrder)} د.ك` }],
      kpi: { id: 'delivery-keeta-promo', en: 'Keeta discount cost', ar: 'خصومات عروض كيتا المحمّلة علينا', value: Math.round(keeta.promo), unit: 'kwd', better: 'down' },
    }))
  }

  const unsettled = J.delivery.platforms.filter((p) => p.clearingKwd > 500)
  const clearingTotal = sum(unsettled, (p) => p.clearingKwd)
  if (clearingTotal > 5000) {
    out.push(play({
      id: 'delivery-unsettled-clearing', stage: 'delivery', basis: 'posted', monthlyKwd: 0, severity: 'high',
      titleEn: 'Match delivery app payouts with bank deposits weekly',
      titleAr: 'مطابقة مستحقات تطبيقات التوصيل مع الإيداعات البنكية أسبوعياً',
      subjectEn: unsettled.map((p) => `${p.platform} ${KWD(p.clearingKwd)}`).join(' · '), subjectAr: unsettled.map((p) => `${arPlatformName(p.platform)} ${DK(p.clearingKwd)}`).join(' · '),
      leakEn: `Odoo delivery clearing holds ${KWD(clearingTotal)} awaiting bank matching (${unsettled.map((p) => `${p.platform}: ${KWD(p.clearingKwd)} open, ${KWD(p.settled30Kwd)} matched vs ${KWD(p.booked30Kwd)} sales in 30 days`).join('; ')}). Leaving payouts unmatched hides short-payments and unfair deductions.`,
      leakAr: `توجد مستحقات بقيمة ${DK(clearingTotal)} في حسابات تسوية المنصات بأودو بانتظار المطابقة مع البنك (${unsettled.map((p) => `${arPlatformName(p.platform)}: ${DK(p.clearingKwd)} معلق، تمت مطابقة ${DK(p.settled30Kwd)} من أصل ${DK(p.booked30Kwd)} مبيعات آخر 30 يوماً`).join('؛ ')}). تأخير المطابقة يخفي أي نقص في التحويلات أو خصومات غير صحيحة.`,
      actionEn: 'Match every Talabat, Keeta, Deliveroo and Jahez bank payout statement weekly in Odoo (sales → commission + promo cost + net bank deposit) and dispute any short-payment within 7 days.',
      actionAr: 'مطابقة كشوف تحويلات طلبات وكيتا وديليفرو وجاهز كل أسبوع مع كشف البنك في أودو، وتقديم اعتراض رسمي على أي خصم أو نقص خلال 7 أيام.',
      qualityEn: 'Weekly matching catches unfair "missing item" deductions immediately.',
      qualityAr: 'المطابقة الأسبوعية تكشف فوراً أي خصم غير صحيح بحجة نقص الأصناف.',
      impactEn: `Tracks ${KWD(clearingTotal)} of cash receivables and stops silent payout deductions (counted as 0 KWD in new profit so numbers are never inflated).`,
      impactAr: `يحفظ تحصيل ${DK(clearingTotal)} من مستحقات الشركة ويمنع الخصومات غير المبررة (محسوب 0 د.ك في زيادة الأرباح لعدم تضخيم الأرقام).`,
      evidence: unsettled.map((p) => ({ en: `${p.platform}: ${KWD(p.clearingKwd)} open balance`, ar: `${arPlatformName(p.platform)}: ${DK(p.clearingKwd)} رصيد بانتظار المطابقة` })),
      kpi: { id: 'delivery-clearing-kwd', en: 'Unmatched platform receivables', ar: 'مستحقات المنصات بانتظار المطابقة', value: Math.round(clearingTotal), unit: 'kwd', better: 'down' },
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
      titleEn: 'Keeta actual deducted fees are higher than the 12% contract rate',
      titleAr: 'الخصم الفعلي في فواتير كيتا أعلى من نسبة العقد (12%)',
      subjectEn: 'Keeta commission & extra ad/delivery fees', subjectAr: 'عمولات ورسوم كيتا المسجلة',
      leakEn: `Odoo recorded ${KWD(keetaPosted)} in Keeta charges in 30 days against ${KWD(keetaBooked30)} of Keeta POS sales — an actual ${f1(pct(keetaPosted, keetaBooked30))}% cut versus the ${f1(keeta.commissionPct)}% contract commission (${KWD(gap)} extra from paid ads, delivery fees or prior-period bills).`,
      leakAr: `سُجلت رسوم وعمولات لكيتا بقيمة ${DK(keetaPosted)} خلال 30 يوماً مقابل مبيعات ${DK(keetaBooked30)} — أي خصم فعلي ${f1(pct(keetaPosted, keetaBooked30))}% مقابل نسبة العقد ${f1(keeta.commissionPct)}% (بفارق ${DK(gap)} نتيجة إعلانات مدفوعة أو رسوم توصيل إضافية).`,
      actionEn: 'Separate Keeta bills in Odoo into commission, paid ads, and delivery fees, pause any paid ad campaign returning less than 4x in sales, and audit the contract rate.',
      actionAr: 'فصل فواتير كيتا في المحاسبة إلى عمولة أساسية وإعلانات مدفوعة ورسوم توصيل، وإيقاف أي إعلان مموّل لا يحقق مبيعات تعادل ٤ أضعاف تكلفته.',
      qualityEn: 'Fast prep and a 4.7+ rating win better app visibility than paid ads.',
      qualityAr: 'سرعة التحضير وتقييم الزبائن العالي يرفعان ظهور المطعم بالتطبيق أفضل من الإعلانات المدفوعة.',
      ...impactText(monthly, 'Cutting 25% of extra non-commission ad/fee charges.', 'بتوفير 25% من رسوم الإعلانات والإضافات الزائدة فوق العمولة.'),
      evidence: [{ en: `Posted 30d: ${KWD(keetaPosted)} · prior 30d: ${KWD(J.delivery.postedCommissionsPrior30.Keeta ?? 0)}`, ar: `المسجل آخر 30 يوماً: ${DK(keetaPosted)} · الشهر السابق: ${DK(J.delivery.postedCommissionsPrior30.Keeta ?? 0)}` }],
      kpi: { id: 'delivery-keeta-eff-pct', en: 'Actual Keeta deduction % of sales', ar: 'نسبة خصم كيتا الفعلية من المبيعات', value: Math.round(pct(keetaPosted, keetaBooked30) * 10) / 10, unit: 'pct', better: 'down' },
    }))
  }

  const tgo = CHANNEL_ECONOMICS.find((c) => c.id === 'talabat-tgo')
  const tmp = CHANNEL_ECONOMICS.find((c) => c.id === 'talabat-tmp')
  if (tgo && tmp && tgo.orders > 0 && tmp.orders > 0 && tmp.pocketPerOrder > tgo.pocketPerOrder) {
    const monthly = 0.1 * tgo.orders * (tmp.pocketPerOrder - tgo.pocketPerOrder) * ((J.windows.rolling30.days || 30) / LEDGER.daysInPeriod)
    if (monthly > 60) {
      out.push(play({
        id: 'delivery-tgo-tmp-mix', stage: 'delivery', basis: 'estimated', monthlyKwd: monthly,
        titleEn: `Shift nearby Talabat orders from Tgo (${tgo.commissionPct}%) to TMP (${tmp.commissionPct}%) & direct ordering`,
        titleAr: `تحويل الطلبات القريبة من طلبات Tgo (${tgo.commissionPct}%) إلى توصيل سائقينا TMP (${tmp.commissionPct}%) والطلب المباشر`,
        subjectEn: `Talabat Tgo ${KWD(tgo.sales)} vs Talabat TMP ${KWD(tmp.sales)}`, subjectAr: `طلبات Tgo ${DK(tgo.sales)} مقابل طلبات TMP ${DK(tmp.sales)}`,
        leakEn: `${KWD(tgo.sales)} (${f0(tgo.orders)} orders) runs on Talabat Tgo at ${tgo.commissionPct}% commission (${f3(tgo.pocketPerOrder)} KWD kept/order) while ${KWD(tmp.sales)} runs on our own-fleet TMP at ${tmp.commissionPct}% (${f3(tmp.pocketPerOrder)} KWD kept/order).`,
        leakAr: `يمر ${DK(tgo.sales)} (${f0(tgo.orders)} طلب) عبر طلبات Tgo بعمولة ${tgo.commissionPct}% (يبقى ${f3(tgo.pocketPerOrder)} د.ك للطلب) بينما يمر ${DK(tmp.sales)} عبر سائقينا TMP بعمولة ${tmp.commissionPct}% فقط (يبقى ${f3(tmp.pocketPerOrder)} د.ك للطلب).`,
        actionEn: 'Re-open closed TMP (10%) accounts at 360 and Assima, place a direct-order QR card in every Tgo bag offering a free drink on the next direct order, and cover <=3 km zones around Salmiya and Ardiya with our own TMP drivers.',
        actionAr: 'إعادة تفعيل حسابات TMP (عمولة 10%) في 360 والعاصمة، ووضع كرت طلب مباشر داخل كل كيس توصيل يمنح مشروباً مجانياً بالطلب القادم، وتغطية المناطق القريبة (٣ كم فأقل) حول السالمية والعارضية بسائقينا.',
        qualityEn: 'Our own drivers carry insulated bags straight to the customer without multi-order delays — hotter food at the door.',
        qualityAr: 'سائقو الشركة يوصلون الطلب مباشرة بحقائب حرارية بدون تأخير تجميع عدة طلبات — فيصل الأكل ساخناً للزبون.',
        ...impactText(monthly, 'Shifting 10% of Tgo orders to TMP (10%) and direct ordering.', 'بتحويل 10% من طلبات Tgo إلى توصيل سائقينا (10%) والطلب المباشر.'),
        evidence: [{ en: `Tgo ${f3(tgo.pocketPerOrder)} vs TMP ${f3(tmp.pocketPerOrder)} KWD kept/order`, ar: `المتبقي بطلب Tgo ${f3(tgo.pocketPerOrder)} د.ك مقابل TMP ${f3(tmp.pocketPerOrder)} د.ك` }],
        kpi: { id: 'delivery-tgo-share', en: 'Tgo share of Talabat sales', ar: 'حصة Tgo (17%) من مبيعات طلبات', value: Math.round(pct(tgo.sales, tgo.sales + tmp.sales) * 10) / 10, unit: 'pct', better: 'down' },
      }))
    }
  }

  // Field-Execution #5: Zero-Commission Corporate (Assima / Towers) & Diwaniya Direct Box Playbook
  {
    const corpMonthlySales = 22 * 3 * 21.5
    const diwaniyaMonthlySales = 72 * 17.5
    const totalDirectBoxSales = corpMonthlySales + diwaniyaMonthlySales
    const directNetMonthly = Math.round(totalDirectBoxSales * (1 - COGS - 0.06))
    const onlineLinkSales = CHANNELS.find((c) => c.id === 'online-link')?.sales ?? 0

    out.push(play({
      id: 'delivery-corporate-diwaniya-direct',
      stage: 'delivery',
      basis: 'estimated',
      monthlyKwd: directNetMonthly,
      ownerRoleEn: 'Corporate & Direct Channel Lead + Branch Managers (Assima Mall · Salmiya · Ardiya)',
      ownerRoleAr: 'مسؤول مبيعات الشركات والطلب المباشر ومديرو فروع (مجمع العاصمة · السالمية · العارضية)',
      titleEn: 'Direct Office Lunch Boxes (Assima Towers) & Diwaniya Boxes at 0% App Commission',
      titleAr: 'بوكسات غداء أبراج العاصمة وبوكسات الديوانيات والزوارة بالطلب المباشر (صفر عمولة)',
      subjectEn: 'Assima Mall (Kuwait City Towers & Ministries) + Salmiya · Ardiya · Promenade Mall · 0% Commission',
      subjectAr: 'مجمع العاصمة (أبراج مدينة الكويت والوزارات) + السالمية · العارضية · البروميناد · صفر عمولة منصات',
      leakEn: `Assima Mall sits right beneath Kuwait City's busiest office towers and ministries (paying ${KWD(3396)}/month rent), while Salmiya and Ardiya sit inside active evening Diwaniya areas — yet direct Online Payment Link sales are only ${KWD(onlineLinkSales)}, leaving large group orders to 17%–18% apps.`,
      leakAr: `يقع فرع مجمع العاصمة وسط أبراج الشركات والوزارات في الديرة (بإيجار ${DK(3396)} شهرياً)، وتقع فروع السالمية والعارضية والبروميناد وسط مناطق الديوانيات والزوارات — ورغم ذلك لا تتعدى مبيعات رابط الدفع المباشر ${DK(onlineLinkSales)}، فتذهب الطلبات الكبيرة للتطبيقات بعمولة ١٧٪–١٨٪.`,
      actionEn: `Launch 3 Direct Sharing Boxes ordered via WhatsApp / Payment Link at 0% commission: (1) Assima Office Lunch Box pre-booked by 11:15 AM (8-person China Garden Chicken Noodles, Beef Mongolian & Soup tray at 21.500 KWD); (2) Tahina 20-Shawarma Diwaniya Box (16.900 KWD); (3) Frank's 6-Philly Diwaniya Tray (19.500 KWD) — plus place a direct-order card inside every Talabat and Keeta bag.`,
      actionAr: `إطلاق ٣ بوكسات مشاركة بالطلب المباشر عبر واتساب ورابط الدفع (صفر عمولة): (١) بوكس غداء المكاتب والوزارات من فرع العاصمة بحجز مسبق قبل ١١:١٥ صباحاً (يكفي ٨ أشخاص من تشاينا جاردن بسعر ٢١٫٥٠٠ د.ك)؛ (٢) بوكس ديوانية طحينة ٢٠ شاورما مع بطاطس (١٦٫٩٠٠ د.ك)؛ (٣) صينية ديوانية فرانكس ٦ ساندويتشات فيلي ستيك مقطعة مع بافلو بايتس وبطاطس زيجي (١٩٫٥٠٠ د.ك) — مع وضع كرت طلب مباشر داخل كل كيس توصيل.`,
      qualityEn: 'Wok noodles, Philly steaks and Lebanese-bread shawarma stay hot and fresh for 35+ minutes in insulated boxes — ideal for offices and Diwaniyas.',
      qualityAr: 'أطباق النودلز وساندويتشات فيلي ستيك وشاورما طحينة تحتفظ بحرارتها لأكثر من ٣٥ دقيقة في البوكسات الحرارية — مناسبة تماماً للمكاتب والديوانيات.',
      ...impactText(directNetMonthly, '3 office boxes/weekday from Assima Mall + 18 Diwaniya boxes/weekend across Kuwait at 0% app commission.', '٣ بوكسات مكاتب يومياً من فرع العاصمة + ١٨ بوكس ديوانيات أسبوعياً بصفر عمولة تطبيقات.'),
      evidence: [
        { en: `Assima Mall: ${KWD(17672)} POS net · direct link saves 17%–18% app commission`, ar: `مجمع العاصمة: مبيعات ${DK(17672)} · البيع المباشر يوفر ١٧٪–١٨٪ عمولة المنصات` },
      ],
      kpi: { id: 'delivery-direct-link-kwd', en: 'Direct Payment Link 30-day sales', ar: 'مبيعات رابط الدفع المباشر (30 يوماً)', value: Math.round(onlineLinkSales), unit: 'kwd', better: 'up' },
      simulator: {
        kind: 'bundle',
        sliders: [
          { id: 'corpBoxesPerWeek', labelEn: 'Weekly Office + Diwaniya direct boxes', labelAr: 'عدد بوكسات المكاتب والديوانيات أسبوعياً', unit: 'pct', min: 15, max: 65, step: 5, defaultValue: 33 },
          { id: 'netKeepPct', labelEn: '0%-commission net margin kept %', labelAr: 'نسبة الصافي المحتفظ به بالبيع المباشر %', unit: 'pct', min: 58, max: 74, step: 1, defaultValue: 68 },
        ],
      },
      directBoxPlaybook: {
        commissionPct: 0,
        qrRetentionRuleEn: 'Every Talabat & Keeta bag carries a Direct Order Card offering free soup/drinks on the customer’s first direct office or Diwaniya box order.',
        qrRetentionRuleAr: 'يوضع داخل كل كيس توصيل كرت طلب مباشر يمنح ضيافة مجانية (شوربة أو مشروبات) عند أول طلب لبوكسات المكاتب أو الديوانيات.',
        boxes: [
          {
            id: 'assima-corp-wok',
            segmentEn: 'Office Towers & Ministries (11:15 AM Pre-Order)',
            segmentAr: 'أبراج الشركات والوزارات (حجز مسبق ١١:١٥ صباحاً)',
            hubBranchEn: 'Assima Mall',
            hubBranchAr: 'مجمع العاصمة',
            boxNameEn: 'China Garden Office Lunch Box (6–8 Pax)',
            boxNameAr: 'بوكس غداء المكاتب — تشاينا جاردن (٦–٨ أشخاص)',
            priceKwd: 21.5,
            contentsEn: '2× Chicken Noodles + Beef Mongolian + Chicken Sweet & Sour + 6× Sweet Corn Chicken Soup',
            contentsAr: '٢ نودلز دجاج + بيف منغولي + دجاج سويت آند ساور + ٦ شوربة ذرة بالدجاج',
          },
          {
            id: 'tahina-diwaniya-20',
            segmentEn: 'Kuwaiti Diwaniya & Thu/Fri Zwarah',
            segmentAr: 'الديوانيات وزوارة الخميس والجمعة',
            hubBranchEn: 'Salmiya · Promenade · 360',
            hubBranchAr: 'السالمية · البروميناد · مجمع 360',
            boxNameEn: 'Tahina 20-Shawarma Diwaniya Box',
            boxNameAr: 'بوكس ديوانية طحينة (٢٠ شاورما بالخبز اللبناني)',
            priceKwd: 16.9,
            contentsEn: '12× Chicken Shawarma + 8× Meat Shawarma Lebanese Bread + Family Fries + Tahina Dips',
            contentsAr: '١٢ شاورما دجاج + ٨ شاورما لحم بالخبز اللبناني + بطاطس عائلية + صوصات طحينة',
          },
          {
            id: 'franks-diwaniya-philly',
            segmentEn: 'Evening Diwaniya & Gatherings',
            segmentAr: 'الديوانيات المسائية والجمعات',
            hubBranchEn: 'Ardiya · Salmiya · Al-Kout',
            hubBranchAr: 'العارضية · السالمية · مجمع الكوت',
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
      `📌 توجيه تنفيذي سريع — شركة فنتشر فودز لإدارة المطاعم ذ.م.م`,
      `• المسؤول عن التنفيذ: ${p.ownerRoleAr}`,
      `• الخطوة المطلوبة: ${p.titleAr}`,
      `• الفرع أو المطعم: ${p.subjectAr}`,
      `• المطلوب تطبيقه اليوم: ${p.actionAr}`,
      `• الرقم الحالي في أودو: ${p.kpi.ar} = ${journeyKpiFormat(p.kpi, true)} (${p.kpi.better === 'down' ? 'المطلوب تخفيضه' : 'المطلوب زيادته'})`,
      `• الربح أو التوفير الشهري المتوقع: +${DK(monthly)} شهرياً (+${DK(monthly * 12)} سنوياً)`,
      `• موعد متابعة النتيجة (بعد ١٤ يوماً): ${reviewDate}`,
      ...extraLines,
      ``,
      `⏱️ نقاط التفتيش السريع لمدير المنطقة (٣ نقاط في ٥ دقائق):`,
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
    `📌 FIELD EXECUTION BRIEF — Venture Foods Restaurants Management Co. W.L.L.`,
    `• Accountable Owner: ${p.ownerRoleEn}`,
    `• Action Step: ${p.titleEn}`,
    `• Branch / Brand Scope: ${p.subjectEn}`,
    `• Action Required Today: ${p.actionEn}`,
    `• Current Odoo Baseline: ${p.kpi.en} = ${journeyKpiFormat(p.kpi, false)} (direction: ${p.kpi.better === 'down' ? 'reduce' : 'increase'})`,
    `• Expected Monthly Gain: +${KWD(monthly)}/month (+${KWD(monthly * 12)}/year)`,
    `• 14-Day Follow-up Date: ${reviewDate}`,
    ...extraEn,
    ``,
    `⏱️ 5-Minute Physical Spot-Check (Area / Ops Manager):`,
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
      `📄 طلب تثبيت أسعار وتعويض فرق الفواتير — شركة فنتشر فودز لإدارة المطاعم ذ.م.م (ترخيص 2021/22838)`,
      `إلى: إدارة مبيعات المورد المعتمد — عناية قسم المشتريات والمحاسبة`,
      `الموضوع: رصد زيادة في أسعار التوريد وطلب تعويض فرق السعر وتثبيت الأسعار لمدة 90 يوماً`,
      ``,
      `الأصناف التي ارتفع سعرها في الفواتير الأخيرة:`,
      ...p.vendorShield.items.map(
        (it) =>
          `- ${arItemName(it.name)}: السعر السابق ${f3(it.oldPriceKwd)} د.ك/${arUom(it.uom)} ← السعر الجديد ${f3(it.newPriceKwd)} د.ك/${arUom(it.uom)} (الفرق الشهري: ${DK(it.monthlyGapKwd)} | يدخل في تحضير: ${it.affectedDishes.map(arItemName).join('، ')})`,
      ),
      ``,
      `إجمالي فرق الأسعار الشهري: ${DK(totalGap)} شهرياً.`,
      `المطلوب قبل طلبية الشراء القادمة (${reviewDate}):`,
      `1) إصدار إشعار دائن بقيمة فرق الأسعار المحسوبة فوق السعر المتفق عليه.`,
      `2) تثبيت الأسعار المعتمدة لمدة 90 يوماً في أودو.`,
    ].join('\n')
  }
  return [
    `📄 VENDOR PRICE-LOCK & CREDIT-NOTE REQUEST — Venture Foods Restaurants Management Co. W.L.L.`,
    `To: Approved Supplier Account Desk — Attn: Procurement & Finance Office`,
    `Subject: Billed Unit-Price Increase Review & 90-Day Price-Lock Request`,
    ``,
    `Items Billed Above Agreed Baseline:`,
    ...p.vendorShield.items.map(
      (it) =>
        `- ${enItemName(it.name)}: Previous ${f3(it.oldPriceKwd)} KWD/${it.uom} → Billed ${f3(it.newPriceKwd)} KWD/${it.uom} (Monthly difference: ${KWD(it.monthlyGapKwd)} | Used in: ${it.affectedDishes.map(enItemName).join(', ')})`,
    ),
    ``,
    `Total Monthly Difference: ${KWD(totalGap)}/month.`,
    `Required Action by ${reviewDate} (prior to next PO):`,
    `1) Issue a Credit Note covering billed price differences above baseline.`,
    `2) Confirm a 90-day fixed pricelist in Odoo.`,
  ].join('\n')
}

/** Compact verified digest injected into Feryal's system prompt so she answers any stage + branch/brand + field-execution question in plain language with exact numbers and zero raw internal IDs. */
export const JOURNEY_FERYAL_CONTEXT: string = [
  `VENTURE FOODS LIVE ODOO SUMMARY & PROFIT OPPORTUNITIES (synced ${J.syncedAt}, period ${J.windows.rolling30.from}..${J.windows.rolling30.to}):`,
  `• Rolling 30d restaurant POS net sales: ${KWD(J.pulse.rolling30.netKwd)} across ${f0(J.pulse.rolling30.orders)} orders (${KWD(J.pulse.rolling30.perDayKwd)}/day, vs prior 30d ${KWD(J.pulse.prior30.netKwd)}, ${f1(JOURNEY_META.growthPct)}%). Nov 2026 MTD (${J.windows.mtd.days}d): ${KWD(J.pulse.mtd.netKwd)} (${KWD(J.pulse.mtd.perDayKwd)}/day).`,
  `• Where every 10 KWD of customer sales goes: Sales left before rent & salaries = ${f3(JOURNEY_SHORTCUTS.netPocket.per10)} KWD (food ${f3(JOURNEY_SHORTCUTS.netPocket.food)}, platform fees ${f3(JOURNEY_SHORTCUTS.netPocket.fees)}, promos ${f3(JOURNEY_SHORTCUTS.netPocket.promos)}, packaging ${f3(JOURNEY_SHORTCUTS.netPocket.packaging)}); Final Net Profit in Pocket after rent, salaries & branch expenses = ${f3(JOURNEY_SHORTCUTS.netPocket.trueNetCash10)} KWD.`,
  `• Kuwait Calendar Mode (${KUWAIT_CALENDAR_PULSE.kuwaitDateIso}, ${KUWAIT_CALENDAR_PULSE.weekdayEn}): ${KUWAIT_CALENDAR_PULSE.badgeEn} — ${KUWAIT_CALENDAR_PULSE.directiveEn} (Payday/Zwarah avg ${KWD(KUWAIT_CALENDAR_PULSE.paydayAvgKwd)}/day vs Mid-Month 10–19 avg ${KWD(KUWAIT_CALENDAR_PULSE.midAvgKwd)}/day, +${f0(KUWAIT_CALENDAR_PULSE.surgeKwdPct)}% surge).`,
  `• Ardiya Central Kitchen Prep Schedule: 0.85x Sun–Tue weekday prep (-15% cut veg/sauce prep at 360, Salmiya, Al-Kout) vs 1.55x mandatory Wednesday 4:00 PM pre-weekend dispatch across all 7 branches to prevent Thu/Fri peak stockouts.`,
  `• Self-Funded Cashier Upsell Rule: 1-line counter upgrade prompt for China Garden, Frank's, Farm Brown & Tahina; 25 KWD weekly cashier bonus unlocks ONLY after Odoo POS verifies >= +500 KWD net add-on profit (5% self-funded share).`,
  `• Zero-Commission Direct Boxes: Assima Mall 11:15 AM Office Lunch Boxes (21.500 KWD) + Tahina 20-Shawarma Diwaniya Box (16.900 KWD) + Frank's Philly Diwaniya Tray (19.500 KWD) at 0% commission + direct-order cards inside delivery bags.`,
  `• End-of-Month Cash Commitments & Delivery Payout Sweep: ${CASH_RUNWAY_PULSE.verdictEn}`,
  `• Branch Net Profit (after platform commissions, rent & payroll): ${BRANCH_TRUE_CASH.map((b) => `${locEn(b.id)} net profit ${KWD(b.trueNetCash)} [rent ${KWD(b.rent)} (${f1(b.rentPct)}%), salaries ${KWD(b.effectiveLabor)}]`).join('; ')}.`,
  `• Untagged Expense Bills: ${KWD(J.opex.unallocated?.rolling30.grossDebitKwd ?? 0)} (${KWD(J.opex.unallocated?.rolling30.directOpexKwd ?? 0)} direct expenses) across ${f0(J.opex.unallocated?.rolling30.lines ?? 0)} entries in 30d without branch selection.`,
  `• Total unlockable extra profit across ${JOURNEY_PLAYS.length} practical steps: +${KWD(JOURNEY_TOTAL_MONTHLY)}/month (+${KWD(JOURNEY_TOTAL_MONTHLY * 12)}/year).`,
  ...JOURNEY_PLAYS.map((p, i) => `  ${i + 1}. [${p.stage.toUpperCase()} · +${KWD(p.monthlyKwd)}/mo] ${p.titleEn} — ${p.subjectEn}: ${p.leakEn} Action: ${p.actionEn}`),
].join('\n')
