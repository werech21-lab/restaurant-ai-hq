/**
 * Aether BI — Enterprise Giants Engine.
 *
 * Strongly-typed calculation engines for the four enterprise modules, all anchored on the
 * approved October 2026 Odoo ledger in `@/lib/aether/ledger` and reacting to the global
 * brand × branch × channel × period filters:
 *
 *   1. Demand, weather & central-kitchen prep forecaster   (inspired by Nory AI / Tenzo)
 *   2. 3-way aggregator reconciliation & chargebacks        (inspired by Loop AI)
 *   3. Supplier price-creep & theoretical vs actual COGS    (inspired by MarginEdge / Supy)
 *   4. Board-ready controllable P&L & budget variance       (inspired by Restaurant365)
 *
 * Every forward-looking or exception figure is a deterministic model built on the ledger
 * (seasonal Kuwait patterns, contracted vendor prices, settlement timing). Models are labelled
 * as such in the UI; ledger totals always reconcile exactly.
 */

import {
  AGGREGATOR_IDS,
  BRANCHES,
  BRANDS,
  CHANNELS,
  LEDGER,
  LEVERS_MONTHLY_TOTAL,
  MENU_ITEMS,
  ROADMAP,
  odooSlice,
  periodFactor,
  sliceShares,
  type BiFilters,
  type BranchId,
  type BrandId,
  type ChannelId,
  type MenuItem,
  type Period,
} from '@/lib/aether/ledger'
import { ODOO } from '@/lib/odoo/odoo-dataset'

const DAYS_IN_PERIOD = LEDGER.daysInPeriod

function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // murmur3 finaliser: decorrelates near-identical keys such as consecutive dates
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d

/** Today's calendar date in Kuwait (Asia/Kuwait), computed on the server so SSR and hydration agree. */
export function kuwaitTodayISO(d: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
/** Locale-stable day label (no Intl, so server and client render identical text). */
export function dayLabel(iso: string, lang: 'ar' | 'en') {
  const d = new Date(`${iso}T00:00:00Z`)
  return lang === 'ar' ? `${DOW_AR[d.getUTCDay()]} ${d.getUTCDate()}` : `${DOW_EN[d.getUTCDay()]} ${d.getUTCDate()}`
}

// ===========================================================================
// MODULE 1 — DEMAND, WEATHER & CENTRAL KITCHEN PREP FORECASTER
// ===========================================================================

/** Kuwait trading rhythm (0 = Sunday). Thursday/Friday evenings surge; normalised to a 1.0 weekly mean. */
const RAW_DOW = [0.92, 0.9, 0.93, 0.98, 1.18, 1.24, 1.05]
const DOW_MEAN = RAW_DOW.reduce((s, v) => s + v, 0) / 7
export const DOW_FACTOR = RAW_DOW.map((v) => v / DOW_MEAN)
export const SALARY_WEEK_FACTOR = 1.12

/** Kuwait seasonal climate normals (daily high °C) and dust-event probability by month. */
const CLIMATE = [
  { high: 19, dust: 0.04 },
  { high: 22, dust: 0.06 },
  { high: 27, dust: 0.1 },
  { high: 33, dust: 0.12 },
  { high: 40, dust: 0.14 },
  { high: 45, dust: 0.22 },
  { high: 46, dust: 0.26 },
  { high: 46, dust: 0.16 },
  { high: 43, dust: 0.1 },
  { high: 37, dust: 0.08 },
  { high: 28, dust: 0.07 },
  { high: 21, dust: 0.05 },
]

/** Opening-hour demand curve 11:00 → 01:00 (lunch & late-dinner peaks). */
export const DAYPART_HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0]
const DAYPART_WEIGHTS = [4, 7, 10, 9, 5, 4, 5, 7, 9, 11, 11, 9, 6, 3]
const DAYPART_SUM = DAYPART_WEIGHTS.reduce((s, v) => s + v, 0)

export type WeatherKind = 'mild' | 'warm' | 'heat' | 'dust'

export interface ForecastDay {
  date: string
  dow: number
  dayOfMonth: number
  weekendSurge: boolean
  salaryWeek: boolean
  tempC: number
  weather: WeatherKind
  /** Fraction of dine-in demand that migrates to delivery (negative = delivery → dine-in). */
  deliveryShift: number
  multiplier: number
  orders: number
  sales: number
  dineIn: number
  takeaway: number
  delivery: number
  hourly: number[]
}

function channelMix() {
  const by = (ids: ChannelId[]) => CHANNELS.filter((c) => ids.includes(c.id)).reduce((s, c) => s + c.orders, 0)
  const total = LEDGER.orders
  return {
    // Odoo records dine-in and takeaway on the same shop tills ("Shop Sales"), so they are reported together.
    dineIn: by(['shop', 'staff']) / total,
    takeaway: 0,
    delivery: by([...AGGREGATOR_IDS, 'online-link']) / total,
  }
}
export const BASE_CHANNEL_MIX = channelMix()

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d
}

export function buildDemandForecast(f: BiFilters, anchorISO: string, horizon: number): ForecastDay[] {
  const s = sliceShares(f)
  const baseOrders = (LEDGER.orders * s.ordersShare) / DAYS_IN_PERIOD
  const baseSales = (LEDGER.netSales * s.salesShare) / DAYS_IN_PERIOD
  return Array.from({ length: horizon }, (_, i) => {
    const d = addDays(anchorISO, i)
    const iso = d.toISOString().slice(0, 10)
    const dow = d.getUTCDay()
    const dom = d.getUTCDate()
    const month = d.getUTCMonth()
    const climate = CLIMATE[month]
    const tempC = Math.round(climate.high + (hash(`t-${iso}`) - 0.5) * 6)
    const dustRoll = hash(`d-${iso}`)
    const weather: WeatherKind = dustRoll < climate.dust ? 'dust' : tempC >= 42 ? 'heat' : tempC >= 34 ? 'warm' : 'mild'
    const weatherTotal = weather === 'dust' ? 0.95 : weather === 'heat' ? 0.97 : weather === 'mild' ? 1.02 : 1
    const deliveryShift = weather === 'dust' ? 0.22 : weather === 'heat' ? 0.16 : weather === 'warm' ? 0.06 : -0.04
    const salaryWeek = dom >= 24 && dom <= 29
    const weekendSurge = dow === 4 || dow === 5
    const multiplier = DOW_FACTOR[dow] * (salaryWeek ? SALARY_WEEK_FACTOR : 1) * weatherTotal
    const orders = baseOrders * multiplier
    const sales = baseSales * multiplier
    const shifted = BASE_CHANNEL_MIX.dineIn * deliveryShift
    const dineIn = orders * (BASE_CHANNEL_MIX.dineIn - shifted)
    const delivery = orders * (BASE_CHANNEL_MIX.delivery + shifted)
    const takeaway = orders * BASE_CHANNEL_MIX.takeaway
    const eveningBoost = weekendSurge ? 1.18 : 1
    const weights = DAYPART_WEIGHTS.map((w, h) => (DAYPART_HOURS[h] >= 19 || DAYPART_HOURS[h] === 0 ? w * eveningBoost : w))
    const wSum = weights.reduce((sum, w) => sum + w, 0) || DAYPART_SUM
    return {
      date: iso,
      dow,
      dayOfMonth: dom,
      weekendSurge,
      salaryWeek,
      tempC,
      weather,
      deliveryShift,
      multiplier,
      orders,
      sales,
      dineIn,
      takeaway,
      delivery,
      hourly: weights.map((w) => (orders * w) / wSum),
    }
  })
}

/** Per-branch split of a forecast day (respects the branch filter). */
export function branchForecast(day: ForecastDay, f: BiFilters) {
  const list = BRANCHES.filter((b) => f.branch === 'all' || b.id === f.branch)
  const totalOrders = list.reduce((s, b) => s + b.orders, 0)
  return list.map((b) => {
    const w = b.orders / totalOrders
    return { id: b.id, en: b.en, ar: b.ar, orders: day.orders * w, sales: day.sales * w, hourly: day.hourly.map((h) => h * w) }
  })
}

/** Per-brand split of a forecast day (respects the brand filter). */
export function brandForecast(day: ForecastDay, f: BiFilters) {
  const list = BRANDS.filter((b) => f.brand === 'all' || b.id === f.brand)
  const totalOrders = list.reduce((s, b) => s + b.orders, 0)
  return list.map((b) => ({ id: b.id, en: b.en, ar: b.ar, color: b.color, orders: (day.orders * b.orders) / totalOrders }))
}

export interface PrepItem {
  id: string
  brand: BrandId
  en: string
  ar: string
  unitEn: string
  unitAr: string
  perOrder: number
  unitCost: number
  decimals: number
}

/** Ardiya Central Kitchen recipe-driven prep yields (per brand order). */
export const PREP_ITEMS: PrepItem[] = [
  { id: 'poultry-140', brand: 'china-garden', en: 'Marinated poultry portions (140 g)', ar: 'حصص دجاج متبل (140 غرام)', unitEn: 'portions', unitAr: 'حصة', perOrder: 0.62, unitCost: 0.273, decimals: 0 },
  { id: 'rice-batch', brand: 'china-garden', en: 'Steamed basmati rice batches (5 kg)', ar: 'دفعات أرز بسمتي مطهو (5 كيلو)', unitEn: 'batches', unitAr: 'دفعة', perOrder: 0.01375, unitCost: 2.1, decimals: 1 },
  { id: 'noodles', brand: 'china-garden', en: 'Fresh noodles', ar: 'نودلز طازجة', unitEn: 'kg', unitAr: 'كيلو', perOrder: 0.063, unitCost: 0.8, decimals: 1 },
  { id: 'cg-sauces', brand: 'china-garden', en: 'Signature wok sauces', ar: 'صوصات الووك المميزة', unitEn: 'L', unitAr: 'لتر', perOrder: 0.045, unitCost: 1.2, decimals: 1 },
  { id: 'philly-beef', brand: 'franks', en: 'Shaved Philly steak', ar: 'شرائح ستيك فيلي', unitEn: 'kg', unitAr: 'كيلو', perOrder: 0.136, unitCost: 7.14, decimals: 1 },
  { id: 'cheese-sauce', brand: 'franks', en: 'Cheese sauce', ar: 'صوص الجبن', unitEn: 'L', unitAr: 'لتر', perOrder: 0.06, unitCost: 2.4, decimals: 1 },
  { id: 'hoagie', brand: 'franks', en: 'Hoagie rolls', ar: 'خبز هوقي', unitEn: 'rolls', unitAr: 'رغيف', perOrder: 1.1, unitCost: 0.12, decimals: 0 },
  { id: 'shawarma', brand: 'tahina', en: 'Marinated chicken shawarma', ar: 'شاورما دجاج متبلة', unitEn: 'kg', unitAr: 'كيلو', perOrder: 0.12, unitCost: 2.2, decimals: 1 },
  { id: 'tahina-sauce', brand: 'tahina', en: 'Tahina sauce', ar: 'صوص الطحينة', unitEn: 'L', unitAr: 'لتر', perOrder: 0.035, unitCost: 1.6, decimals: 1 },
  { id: 'patties', brand: 'noodle-bar', en: 'Fresh egg noodles (portion)', ar: 'نودلز البيض الطازجة (حصة)', unitEn: 'portions', unitAr: 'حصة', perOrder: 1.8, unitCost: 0.31, decimals: 0 },
  { id: 'strips', brand: 'farm-brown', en: 'Fried chicken (raw)', ar: 'دجاج للقلي (خام)', unitEn: 'kg', unitAr: 'كيلو', perOrder: 0.17, unitCost: 2.3, decimals: 1 },
  { id: 'dips', brand: 'farm-brown', en: 'Signature dips', ar: 'الصوصات المميزة', unitEn: 'L', unitAr: 'لتر', perOrder: 0.05, unitCost: 1.5, decimals: 1 },
  { id: 'corn-cups', brand: 'karak-cafeteria', en: 'Karak tea servings', ar: 'حصص شاي الكرك', unitEn: 'cups', unitAr: 'كوب', perOrder: 0.6, unitCost: 0.18, decimals: 0 },
]

/** Historical over-production buffer vs. forecast-driven par buffer that delivers the approved 1,336 KWD/month. */
export const PREP_BUFFER = { current: 12, target: 4 }
/** Monthly raw prep spend implied by the approved saving (8 pp buffer reduction = 1,336 KWD). */
export const PREP_MONTHLY_SPEND = LEDGER.cogsRecoverable / ((PREP_BUFFER.current - PREP_BUFFER.target) / 100)

export function prepSheet(day: ForecastDay, f: BiFilters, bufferPct: number) {
  const brands = brandForecast(day, f)
  return PREP_ITEMS.filter((p) => brands.some((b) => b.id === p.brand)).map((p) => {
    const brandOrders = brands.find((b) => b.id === p.brand)!.orders
    const need = brandOrders * p.perOrder
    const par = need * (1 + bufferPct / 100)
    const legacy = need * (1 + PREP_BUFFER.current / 100)
    return { ...p, brandOrders, need, par, legacy, cost: par * p.unitCost, avoided: Math.max(0, (legacy - par) * p.unitCost) }
  })
}

export function wasteSavings(bufferPct: number, salesShare = 1) {
  const reductionPp = Math.max(0, PREP_BUFFER.current - bufferPct)
  const monthly = PREP_MONTHLY_SPEND * (reductionPp / 100) * salesShare
  const target = LEDGER.cogsRecoverable * salesShare
  return { monthly, target, progress: target > 0 ? Math.min(1.5, monthly / target) : 0 }
}

/** Orders a trained crew member completes per labour hour (kitchen + counter blend). */
export const ORDERS_PER_LABOUR_HOUR = 7
export const MIN_CREW_PER_HOUR = 2

export function staffingPulse(day: ForecastDay, f: BiFilters) {
  return branchForecast(day, f).map((b) => {
    const required = b.hourly.map((o) => Math.max(MIN_CREW_PER_HOUR, Math.ceil(o / ORDERS_PER_LABOUR_HOUR)))
    const peak = Math.max(...required)
    const rosterCrew = Math.max(MIN_CREW_PER_HOUR, Math.ceil(peak * 0.85))
    const currentHours = rosterCrew * DAYPART_HOURS.length
    const optimalHours = required.reduce((s, v) => s + v, 0)
    const splhCurrent = b.sales / currentHours
    const splhOptimal = b.sales / optimalHours
    const understaffedHours = required.filter((r) => r > rosterCrew).length
    return { ...b, required, peak, rosterCrew, currentHours, optimalHours, splhCurrent, splhOptimal, understaffedHours, efficiency: splhOptimal / splhCurrent }
  })
}

export interface DecisionCard {
  id: 'profit' | 'kitchen' | 'channel'
  tone: 'emerald' | 'rose' | 'sky' | 'amber'
  titleEn: string
  titleAr: string
  bodyEn: string
  bodyAr: string
  metricEn: string
  metricAr: string
  href: string
  askEn: string
  askAr: string
}

const fmtN = (n: number, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

/** Top-3 daily executive decision brief (profit protection · kitchen prep · channel action). */
export function dailyDecisionBrief(f: BiFilters, anchorISO: string): DecisionCard[] {
  const [today, tomorrow] = buildDemandForecast(f, anchorISO, 2)
  const sheet = prepSheet(tomorrow, f, PREP_BUFFER.target)
  const poultry = sheet.find((p) => p.id === 'poultry-140') ?? sheet[0]
  const s = sliceShares(f)
  const keetaShare = f.channel === 'all' || f.channel === 'keeta' ? s.brandShare * s.branchShare : 0
  const keetaSaving = LEDGER.keetaRecovery * keetaShare
  const dowEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][tomorrow.dow]
  const dowAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][tomorrow.dow]
  const swingPct = (tomorrow.multiplier - 1) * 100
  const profit: DecisionCard =
    keetaSaving > 0
      ? {
          id: 'profit',
          tone: 'emerald',
          titleEn: `Protect profit: enforce the Keeta ${LEDGER.keetaCapPct}% promo cap`,
          titleAr: `حماية الربح: تطبيق سقف خصومات كيتا ${LEDGER.keetaCapPct}%`,
          bodyEn: `Odoo shows Keeta promotions of ${fmtN(LEDGER.keetaDiscounts)} KWD against a ${fmtN(LEDGER.keetaCapKwd)} KWD cap. Capping today protects ${fmtN(keetaSaving / DAYS_IN_PERIOD, 1)} KWD per day.`,
          bodyAr: `عروض كيتا في أودو ${fmtN(LEDGER.keetaDiscounts)} د.ك مقابل سقف ${fmtN(LEDGER.keetaCapKwd)} د.ك. التطبيق اليوم يحمي ${fmtN(keetaSaving / DAYS_IN_PERIOD, 1)} د.ك يومياً.`,
          metricEn: `+${fmtN(keetaSaving)} KWD / month`,
          metricAr: `+${fmtN(keetaSaving)} د.ك / شهرياً`,
          href: '/erp/delivery-control',
          askEn: 'Brief me on enforcing the Keeta 3.5% promo cap today and the daily profit it protects.',
          askAr: 'أعطيني موجزاً عن تطبيق سقف خصومات كيتا 3.5% اليوم والربح اليومي الذي يحميه.',
        }
      : {
          id: 'profit',
          tone: 'emerald',
          titleEn: 'Protect profit: hold food cost under target',
          titleAr: 'حماية الربح: إبقاء تكلفة الأغذية دون المستهدف',
          bodyEn: `Odoo COGS is ${LEDGER.cogsPct}% against a ${LEDGER.cogsTargetPct}% target. Forecast-driven par levels keep the high-COGS locations in line.`,
          bodyAr: `تكلفة الأغذية في أودو ${LEDGER.cogsPct}% مقابل مستهدف ${LEDGER.cogsTargetPct}%. مستويات التحضير المبنية على التوقع تضبط المواقع مرتفعة التكلفة.`,
          metricEn: `+${fmtN(LEDGER.cogsRecoverable * s.salesShare)} KWD / month`,
          metricAr: `+${fmtN(LEDGER.cogsRecoverable * s.salesShare)} د.ك / شهرياً`,
          href: '/erp/cost-intelligence',
          askEn: 'Explain how we close the 0.8 point food-cost gap this week.',
          askAr: 'اشرحي كيف نغلق فجوة تكلفة الأغذية البالغة 0.8 نقطة هذا الأسبوع.',
        }
  const kitchen: DecisionCard = {
    id: 'kitchen',
    tone: swingPct >= 0 ? 'amber' : 'sky',
    titleEn: `Kitchen prep for ${dowEn}: ${swingPct >= 0 ? 'scale up' : 'trim'} ${fmtN(Math.abs(swingPct))}%`,
    titleAr: `تحضير المطبخ ليوم ${dowAr}: ${swingPct >= 0 ? 'زيادة' : 'تخفيض'} ${fmtN(Math.abs(swingPct))}%`,
    bodyEn: poultry
      ? `Prep ${fmtN(poultry.par, poultry.decimals)} × ${poultry.en} at a 4% buffer instead of 12% — ${fmtN(poultry.avoided, 1)} KWD of avoided waste tomorrow.`
      : 'Approve tomorrow’s forecast-driven prep sheet at a 4% buffer.',
    bodyAr: poultry
      ? `حضّر ${fmtN(poultry.par, poultry.decimals)} × ${poultry.ar} بهامش 4% بدلاً من 12% — وفر هدر ${fmtN(poultry.avoided, 1)} د.ك غداً.`
      : 'اعتمد ورقة تحضير الغد المبنية على التوقع بهامش 4%.',
    metricEn: `${fmtN(tomorrow.orders)} orders forecast`,
    metricAr: `${fmtN(tomorrow.orders)} طلباً متوقعاً`,
    href: '/erp/demand-forecast',
    askEn: `Brief me on tomorrow's (${dowEn}) demand forecast and the Ardiya prep plan.`,
    askAr: `أعطيني موجزاً عن توقع طلب الغد (${dowAr}) وخطة تحضير مطبخ العارضية.`,
  }
  const channel: DecisionCard =
    today.weather === 'dust' || today.weather === 'heat'
      ? {
          id: 'channel',
          tone: 'sky',
          titleEn: `Channel move: ${today.weather === 'dust' ? 'dust' : 'heat'} pushes demand to delivery`,
          titleAr: `إجراء القنوات: ${today.weather === 'dust' ? 'الغبار' : 'الحر'} يحول الطلب إلى التوصيل`,
          bodyEn: `${fmtN(today.deliveryShift * 100)}% of dine-in demand shifts to delivery. Route high-AOV combos to Talabat TMP and raise prep for riders.`,
          bodyAr: `${fmtN(today.deliveryShift * 100)}% من طلب الصالة يتحول للتوصيل. وجّه وجبات الكومبو المرتفعة إلى سوق طلبات وارفع التحضير للسائقين.`,
          metricEn: `${fmtN(today.delivery)} delivery orders today`,
          metricAr: `${fmtN(today.delivery)} طلب توصيل اليوم`,
          href: '/erp/delivery-control',
          askEn: 'Which channel actions should we take today given the weather-driven delivery shift?',
          askAr: 'ما إجراءات القنوات المطلوبة اليوم مع تحول الطلب للتوصيل بسبب الطقس؟',
        }
      : {
          id: 'channel',
          tone: 'sky',
          titleEn: 'Channel move: route combos to Talabat TMP',
          titleAr: 'إجراء القنوات: توجيه الكومبو إلى سوق طلبات',
          bodyEn: `Mild ${today.tempC}°C weather lifts dine-in. On delivery, TMP keeps more per order than Tgo after rider cost — push beverage combos there.`,
          bodyAr: `طقس معتدل ${today.tempC} درجة يرفع طلبات الصالة. في التوصيل يحقق سوق طلبات صافياً أعلى لكل طلب من طلبات جو بعد تكلفة السائق — ادفع وجبات المشروبات هناك.`,
          metricEn: `${fmtN(today.orders)} orders today`,
          metricAr: `${fmtN(today.orders)} طلباً اليوم`,
          href: '/erp/delivery-control',
          askEn: 'Compare Talabat Tgo and TMP net pocket profit per order and tell me where to route combos today.',
          askAr: 'قارني صافي الربح لكل طلب بين طلبات جو وسوق طلبات وأين نوجه الكومبو اليوم.',
        }
  return [profit, kitchen, channel]
}

// ===========================================================================
// MODULE 2 — 3-WAY RECONCILIATION, CHARGEBACKS & PER-ORDER WATERFALL
// ===========================================================================

/** Packaging (thermal box, bag, cutlery) per delivery order. */
export const PACKAGING_PER_DELIVERY_ORDER = 0.18
/** Card / KNET acquiring is settled T+1; dine-in and takeaway are reconciled POS → KNET batch → bank. */

interface ChannelExceptions {
  cancelledUnpaid: number
  promoUnapproved: number
  commissionOverbill: number
  inTransit: number
}

/** Monthly settlement exceptions per channel (October settlement pattern). */
const EXCEPTIONS: Record<ChannelId, ChannelExceptions> = {
  'talabat-tgo': { cancelledUnpaid: 186.45, promoUnapproved: 94.2, commissionOverbill: 61.38, inTransit: 1240 },
  'talabat-tmp': { cancelledUnpaid: 72.9, promoUnapproved: 38.5, commissionOverbill: 0, inTransit: 610 },
  keeta: { cancelledUnpaid: 158.7, promoUnapproved: 212.64, commissionOverbill: 44.9, inTransit: 1480 },
  'deliveroo-go': { cancelledUnpaid: 21.3, promoUnapproved: 12, commissionOverbill: 18.25, inTransit: 0 },
  'deliveroo-mp': { cancelledUnpaid: 0, promoUnapproved: 0, commissionOverbill: 0, inTransit: 0 },
  jahez: { cancelledUnpaid: 9.8, promoUnapproved: 6.4, commissionOverbill: 0, inTransit: 210 },
  snoonu: { cancelledUnpaid: 4.2, promoUnapproved: 0, commissionOverbill: 0, inTransit: 95 },
  'online-link': { cancelledUnpaid: 0, promoUnapproved: 0, commissionOverbill: 0, inTransit: 48 },
  shop: { cancelledUnpaid: 0, promoUnapproved: 0, commissionOverbill: 0, inTransit: 654 },
  staff: { cancelledUnpaid: 0, promoUnapproved: 0, commissionOverbill: 0, inTransit: 0 },
}

export interface ReconRow {
  id: ChannelId
  en: string
  ar: string
  group: 'aggregator' | 'direct' | 'store'
  posSales: number
  commission: number
  promo: number
  expected: number
  statement: number
  bank: number
  cancelledUnpaid: number
  promoUnapproved: number
  commissionOverbill: number
  inTransit: number
  recoverable: number
  status: 'matched' | 'timing' | 'exception'
}

export function threeWayReconciliation(f: BiFilters): ReconRow[] {
  const s = sliceShares({ brand: f.brand, branch: f.branch, channel: 'all' })
  const factor = s.brandShare * s.branchShare * periodFactor(f.period)
  return CHANNELS.filter((c) => f.channel === 'all' || c.id === f.channel).map((c) => {
    const ex = EXCEPTIONS[c.id]
    const posSales = c.sales * factor
    const commission = posSales * (c.commissionPct / 100)
    const promo = c.promo * factor
    const expected = posSales - commission - promo
    const cancelledUnpaid = ex.cancelledUnpaid * factor
    const promoUnapproved = ex.promoUnapproved * factor
    const commissionOverbill = ex.commissionOverbill * factor
    const inTransit = ex.inTransit * factor
    const recoverable = cancelledUnpaid + promoUnapproved + commissionOverbill
    const statement = expected - recoverable
    const bank = statement - inTransit
    const status: ReconRow['status'] = recoverable > 0.005 ? 'exception' : inTransit > 0.005 ? 'timing' : 'matched'
    return { id: c.id, en: c.en, ar: c.ar, group: c.group, posSales, commission, promo, expected, statement, bank, cancelledUnpaid, promoUnapproved, commissionOverbill, inTransit, recoverable, status }
  })
}

export type ChargebackType = 'wrongful-refund' | 'driver-delay' | 'commission-overbill' | 'missing-item' | 'cancelled-unpaid'
export type ChargebackStatus = 'detected' | 'claim-generated' | 'recovered'

export interface Chargeback {
  id: string
  channel: ChannelId
  branch: BranchId
  brand: BrandId
  type: ChargebackType
  orderRef: string
  date: string
  amount: number
  status: ChargebackStatus
}

export const CHARGEBACK_TYPES: Record<ChargebackType, { en: string; ar: string; evidenceEn: string; evidenceAr: string }> = {
  'wrongful-refund': { en: 'Wrongful customer refund', ar: 'استرداد غير مستحق للعميل', evidenceEn: 'POS ticket shows the order was prepared, sealed and handed to the rider on time.', evidenceAr: 'تذكرة نقطة البيع تثبت تحضير الطلب وإغلاقه وتسليمه للسائق في الوقت المحدد.' },
  'driver-delay': { en: 'Driver delay penalty charged to branch', ar: 'غرامة تأخير السائق محملة على الفرع', evidenceEn: 'Kitchen-ready timestamp precedes rider arrival; the delay sits with the fleet, not the branch.', evidenceAr: 'وقت جاهزية المطبخ يسبق وصول السائق؛ التأخير على أسطول المنصة وليس على الفرع.' },
  'commission-overbill': { en: 'Over-billed commission', ar: 'عمولة محتسبة بالزيادة', evidenceEn: 'Commission was applied to the pre-discount basket instead of the contracted net basis.', evidenceAr: 'احتُسبت العمولة على قيمة السلة قبل الخصم بدلاً من الأساس الصافي المتعاقد عليه.' },
  'missing-item': { en: 'Disputed missing-item claim', ar: 'مطالبة صنف مفقود متنازع عليها', evidenceEn: 'Packing checklist and sealed-bag photo confirm every item was dispatched.', evidenceAr: 'قائمة التغليف وصورة الكيس المختوم تؤكد إرسال جميع الأصناف.' },
  'cancelled-unpaid': { en: 'Cancelled after preparation, unpaid', ar: 'ملغي بعد التحضير دون سداد', evidenceEn: 'Cancellation arrived after the kitchen-ready event; contract requires full payment.', evidenceAr: 'وصل الإلغاء بعد جاهزية المطبخ؛ العقد يستوجب السداد الكامل.' },
}

export const CHARGEBACKS: Chargeback[] = [
  { id: 'CB-2610-01', channel: 'keeta', branch: '360-mall', brand: 'china-garden', type: 'commission-overbill', orderRef: 'KT-88412306', date: '2026-10-04', amount: 44.9, status: 'detected' },
  { id: 'CB-2610-02', channel: 'talabat-tgo', branch: 'salmiya', brand: 'china-garden', type: 'wrongful-refund', orderRef: 'TB-55190732', date: '2026-10-06', amount: 38.75, status: 'claim-generated' },
  { id: 'CB-2610-03', channel: 'talabat-tgo', branch: 'al-kout', brand: 'china-garden', type: 'driver-delay', orderRef: 'TB-55204417', date: '2026-10-08', amount: 27.5, status: 'detected' },
  { id: 'CB-2610-04', channel: 'keeta', branch: 'assima', brand: 'china-garden', type: 'cancelled-unpaid', orderRef: 'KT-88437751', date: '2026-10-11', amount: 31.2, status: 'recovered' },
  { id: 'CB-2610-05', channel: 'deliveroo-go', branch: 'promenade', brand: 'franks', type: 'commission-overbill', orderRef: 'DR-40217733', date: '2026-10-12', amount: 18.25, status: 'detected' },
  { id: 'CB-2610-06', channel: 'talabat-tmp', branch: 'avenues', brand: 'china-garden', type: 'missing-item', orderRef: 'TM-31097245', date: '2026-10-15', amount: 12.6, status: 'claim-generated' },
  { id: 'CB-2610-07', channel: 'talabat-tgo', branch: 'promenade', brand: 'franks', type: 'commission-overbill', orderRef: 'TB-55261190', date: '2026-10-17', amount: 61.38, status: 'detected' },
  { id: 'CB-2610-08', channel: 'keeta', branch: 'salmiya', brand: 'tahina', type: 'wrongful-refund', orderRef: 'KT-88469012', date: '2026-10-19', amount: 22.4, status: 'detected' },
  { id: 'CB-2610-09', channel: 'jahez', branch: 'ardiya', brand: 'china-garden', type: 'cancelled-unpaid', orderRef: 'JZ-77120584', date: '2026-10-22', amount: 9.8, status: 'recovered' },
  { id: 'CB-2610-10', channel: 'talabat-tgo', branch: 'salmiya', brand: 'noodle-bar', type: 'driver-delay', orderRef: 'TB-55302276', date: '2026-10-25', amount: 19.25, status: 'claim-generated' },
  { id: 'CB-2610-11', channel: 'keeta', branch: 'al-kout', brand: 'farm-brown', type: 'missing-item', orderRef: 'KT-88502318', date: '2026-10-27', amount: 15.9, status: 'detected' },
  { id: 'CB-2610-12', channel: 'talabat-tmp', branch: 'ardiya', brand: 'karak-cafeteria', type: 'cancelled-unpaid', orderRef: 'TM-31144806', date: '2026-10-29', amount: 8.4, status: 'detected' },
]

export function chargebacksFor(f: BiFilters) {
  return CHARGEBACKS.filter(
    (c) => (f.channel === 'all' || c.channel === f.channel) && (f.branch === 'all' || c.branch === f.branch) && (f.brand === 'all' || c.brand === f.brand),
  )
}

export function disputeClaim(cb: Chargeback, lang: 'ar' | 'en') {
  const ch = CHANNELS.find((c) => c.id === cb.channel)!
  const br = BRANCHES.find((b) => b.id === cb.branch)!
  const bd = BRANDS.find((b) => b.id === cb.brand)!
  const t = CHARGEBACK_TYPES[cb.type]
  const amount = cb.amount.toFixed(3)
  if (lang === 'ar') {
    return [
      `إلى: مدير حساب ${ch.ar}`,
      `الموضوع: مطالبة استرداد ${cb.id} — الطلب ${cb.orderRef}`,
      '',
      `تحية طيبة، نتقدم نحن شركة فنتشر فودز لإدارة المطاعم ذ.م.م (ترخيص رقم 2021/22838) بمطالبة استرداد مبلغ ${amount} د.ك المخصوم بتاريخ ${cb.date} عن طلب ${bd.ar} من فرع ${br.ar}.`,
      `سبب الاعتراض: ${t.ar}.`,
      `الدليل: ${t.evidenceAr}`,
      `نرجو عكس الخصم وإضافة المبلغ إلى دورة التسوية القادمة خلال 7 أيام عمل.`,
      '',
      'مع خالص التقدير،',
      'قسم مطابقة المنصات — فنتشر فودز',
    ].join('\n')
  }
  return [
    `To: ${ch.en} Account Manager`,
    `Subject: Chargeback recovery claim ${cb.id} — order ${cb.orderRef}`,
    '',
    `Venture Foods Restaurants Management Co. W.L.L. (Licence No. 2021/22838) disputes the ${amount} KWD deduction applied on ${cb.date} to a ${bd.en} order from our ${br.en} branch.`,
    `Reason: ${t.en}.`,
    `Evidence: ${t.evidenceEn}`,
    'Please reverse the deduction and credit it in the next settlement cycle within 7 business days.',
    '',
    'Kind regards,',
    'Aggregator Reconciliation Desk — Venture Foods',
  ].join('\n')
}

export interface WaterfallStep {
  key: 'gross' | 'commission' | 'discount' | 'cogs' | 'packaging' | 'rider' | 'net'
  en: string
  ar: string
  value: number
}

export const WATERFALL_CHANNELS: ChannelId[] = ['talabat-tgo', 'talabat-tmp', 'keeta', 'deliveroo-go', 'jahez']

export function orderWaterfall(channelId: ChannelId) {
  const c = CHANNELS.find((x) => x.id === channelId)!
  const net = c.sales / c.orders
  const discount = c.promo / c.orders
  const gross = net + discount
  const commission = net * (c.commissionPct / 100)
  const cogs = net * (LEDGER.cogsPct / 100)
  const packaging = PACKAGING_PER_DELIVERY_ORDER
  const rider = c.riderCostPerOrder
  const pocket = gross - commission - discount - cogs - packaging - rider
  const steps: WaterfallStep[] = [
    { key: 'gross', en: 'Gross basket', ar: 'السلة الإجمالية', value: gross },
    { key: 'commission', en: 'Aggregator commission', ar: 'عمولة المنصة', value: -commission },
    { key: 'discount', en: 'Marketing discount', ar: 'الخصم التسويقي', value: -discount },
    { key: 'cogs', en: `Food COGS (${LEDGER.cogsPct}%)`, ar: `تكلفة الأغذية (${LEDGER.cogsPct}%)`, value: -cogs },
    { key: 'packaging', en: 'Packaging', ar: 'التغليف', value: -packaging },
    ...(rider > 0 ? [{ key: 'rider' as const, en: 'Own rider', ar: 'سائق المطعم', value: -rider }] : []),
    { key: 'net', en: 'Net pocket profit', ar: 'صافي الربح للطلب', value: pocket },
  ]
  return { channel: c, gross, pocket, pocketPct: (pocket / gross) * 100, monthlyPocket: pocket * c.orders, steps }
}

// ===========================================================================
// MODULE 3 — SUPPLIER PRICE-CREEP & THEORETICAL VS ACTUAL COGS
// ===========================================================================

export type IngredientId = 'poultry-breast' | 'poultry-carton' | 'philly-beef' | 'cooking-oil' | 'basmati-rice' | 'soy-sauce' | 'tahina-paste' | 'thermal-boxes'

export interface SupplierItem {
  id: IngredientId
  en: string
  ar: string
  vendorEn: string
  vendorAr: string
  unitEn: string
  unitAr: string
  /** Base unit size used by recipes (kg / L / box). */
  recipeUnitEn: string
  recipeUnitAr: string
  recipeUnitsPerPack: number
  contract: number
  invoices: number[]
  monthlyQty: number
}

/** Contracted baselines vs. the last six weekly invoice prices (KWD per purchase unit). */
export const SUPPLIER_ITEMS: SupplierItem[] = [
  { id: 'poultry-breast', en: 'Fresh poultry breast', ar: 'صدور دجاج طازجة', vendorEn: 'Fresh poultry vendor', vendorAr: 'مورد الدواجن الطازجة', unitEn: 'kg', unitAr: 'كيلو', recipeUnitEn: 'kg', recipeUnitAr: 'كيلو', recipeUnitsPerPack: 1, contract: 1.95, invoices: [1.95, 1.96, 1.99, 2.04, 2.09, 2.145], monthlyQty: 2650 },
  { id: 'poultry-carton', en: 'Frozen poultry (10 kg carton)', ar: 'دجاج مجمد (كرتون 10 كيلو)', vendorEn: 'Frozen poultry importer', vendorAr: 'مستورد الدواجن المجمدة', unitEn: 'carton', unitAr: 'كرتون', recipeUnitEn: 'kg', recipeUnitAr: 'كيلو', recipeUnitsPerPack: 10, contract: 10.8, invoices: [10.8, 10.95, 11.1, 11.25, 11.4, 11.4], monthlyQty: 120 },
  { id: 'philly-beef', en: 'US ribeye / Philly beef', ar: 'لحم ريب آي أمريكي للفيلي', vendorEn: 'Premium beef importer', vendorAr: 'مستورد اللحوم الممتازة', unitEn: 'kg', unitAr: 'كيلو', recipeUnitEn: 'kg', recipeUnitAr: 'كيلو', recipeUnitsPerPack: 1, contract: 6.8, invoices: [6.8, 6.8, 6.92, 6.98, 7.05, 7.14], monthlyQty: 215 },
  { id: 'cooking-oil', en: 'Corn cooking oil (20 L drum)', ar: 'زيت ذرة للقلي (برميل 20 لتر)', vendorEn: 'Edible oils distributor', vendorAr: 'موزع الزيوت النباتية', unitEn: 'drum', unitAr: 'برميل', recipeUnitEn: 'L', recipeUnitAr: 'لتر', recipeUnitsPerPack: 20, contract: 8.75, invoices: [8.75, 8.75, 8.85, 8.9, 9.0, 9.1], monthlyQty: 140 },
  { id: 'basmati-rice', en: 'Basmati rice (25 kg sack)', ar: 'أرز بسمتي (كيس 25 كيلو)', vendorEn: 'Rice & grains wholesaler', vendorAr: 'تاجر جملة الأرز والحبوب', unitEn: 'sack', unitAr: 'كيس', recipeUnitEn: 'kg', recipeUnitAr: 'كيلو', recipeUnitsPerPack: 25, contract: 9.5, invoices: [9.5, 9.5, 9.55, 9.6, 9.65, 9.69], monthlyQty: 95 },
  { id: 'soy-sauce', en: 'Soy sauce (1.9 L)', ar: 'صويا صوص (1.9 لتر)', vendorEn: 'Asian pantry distributor', vendorAr: 'موزع المواد الآسيوية', unitEn: 'bottle', unitAr: 'عبوة', recipeUnitEn: 'L', recipeUnitAr: 'لتر', recipeUnitsPerPack: 1.9, contract: 1.25, invoices: [1.25, 1.25, 1.25, 1.25, 1.25, 1.25], monthlyQty: 160 },
  { id: 'tahina-paste', en: 'Tahina paste', ar: 'معجون الطحينة', vendorEn: 'Levant pantry supplier', vendorAr: 'مورد المواد الشامية', unitEn: 'kg', unitAr: 'كيلو', recipeUnitEn: 'kg', recipeUnitAr: 'كيلو', recipeUnitsPerPack: 1, contract: 1.4, invoices: [1.4, 1.42, 1.45, 1.48, 1.5, 1.512], monthlyQty: 180 },
  { id: 'thermal-boxes', en: 'Thermal delivery boxes (pack of 100)', ar: 'علب توصيل حرارية (عبوة 100)', vendorEn: 'Packaging manufacturer', vendorAr: 'مصنع مواد التغليف', unitEn: 'pack', unitAr: 'عبوة', recipeUnitEn: 'box', recipeUnitAr: 'علبة', recipeUnitsPerPack: 100, contract: 6.5, invoices: [6.5, 6.55, 6.6, 6.7, 6.8, 6.89], monthlyQty: 190 },
]

export const PRICE_CREEP_ALERT_PCT = 3

export function priceCreep(f: BiFilters) {
  const s = sliceShares(f)
  const pf = periodFactor(f.period)
  return SUPPLIER_ITEMS.map((it) => {
    const latest = it.invoices[it.invoices.length - 1]
    const prev = it.invoices[it.invoices.length - 2]
    const creepPct = ((latest - it.contract) / it.contract) * 100
    const weekPct = ((latest - prev) / prev) * 100
    const qty = it.monthlyQty * s.salesShare * pf
    const impact = (latest - it.contract) * qty
    const level: 'stable' | 'watch' | 'spike' = creepPct >= PRICE_CREEP_ALERT_PCT * 2 ? 'spike' : creepPct >= PRICE_CREEP_ALERT_PCT ? 'watch' : 'stable'
    return { ...it, latest, creepPct, weekPct, qty, impact, level, recipeUnitCost: latest / it.recipeUnitsPerPack, contractRecipeUnitCost: it.contract / it.recipeUnitsPerPack }
  })
}

/** Recipe bill of tracked ingredients per menu item (recipe units). */
export function recipeFor(item: MenuItem): Partial<Record<IngredientId, number>> {
  const n = item.en.toLowerCase()
  const r: Partial<Record<IngredientId, number>> = {}
  const delivery = BASE_CHANNEL_MIX.delivery
  if (item.brand === 'china-garden') {
    if (/(chicken|manchurian|kung pao|lollipop|sweet & sour|orange|garlic|honey|chilli|feast|combo|lunch box)/.test(n)) r['poultry-breast'] = 0.14
    if (/(beef|mongolian)/.test(n)) r['philly-beef'] = 0.12
    if (/(rice|feast|combo|lunch box)/.test(n)) r['basmati-rice'] = 0.15
    r['cooking-oil'] = 0.02
    r['soy-sauce'] = 0.02
  } else if (item.brand === 'franks') {
    if (/(philly|cheesesteak)/.test(n)) r['philly-beef'] = 0.16
    r['cooking-oil'] = 0.015
  } else if (item.brand === 'tahina') {
    if (/shawarma/.test(n)) r['poultry-breast'] = 0.15
    r['tahina-paste'] = 0.03
    r['cooking-oil'] = 0.01
  } else if (item.brand === 'noodle-bar') {
    r['philly-beef'] = 0.18
    r['cooking-oil'] = 0.015
  } else if (item.brand === 'farm-brown') {
    r['poultry-carton'] = 0.17
    r['cooking-oil'] = 0.03
  } else {
    r['cooking-oil'] = 0.01
  }
  r['thermal-boxes'] = delivery
  return r
}

export function marginErosion(ingredient: IngredientId, increasePct: number, f: BiFilters) {
  const s = sliceShares({ brand: 'all', branch: f.branch, channel: f.channel })
  const pf = periodFactor(f.period)
  const supplier = SUPPLIER_ITEMS.find((x) => x.id === ingredient)!
  const baseRecipeCost = supplier.contract / supplier.recipeUnitsPerPack
  const rows = MENU_ITEMS.filter((m) => m.top32 && (f.brand === 'all' || m.brand === f.brand))
    .map((m) => {
      const qty = recipeFor(m)[ingredient] ?? 0
      const deltaUnit = qty * baseRecipeCost * (increasePct / 100)
      const baseCost = m.price * (m.cogsPct / 100)
      const newCogsPct = ((baseCost + deltaUnit) / m.price) * 100
      const units = m.units * s.branchShare * s.channelShare * pf
      const erosion = deltaUnit * units
      const priceToRestore = deltaUnit > 0 ? (deltaUnit / (1 - m.cogsPct / 100) / m.price) * 100 : 0
      const move: 'renegotiate' | 'reprice' | 'portion' | 'none' =
        deltaUnit <= 0 ? 'none' : m.quadrant === 'star' ? 'renegotiate' : m.quadrant === 'plowhorse' ? 'reprice' : 'portion'
      return { item: m, qty, deltaUnit, baseCogsPct: m.cogsPct, newCogsPct, units, erosion, priceToRestore, move }
    })
    .sort((a, b) => b.erosion - a.erosion)
  return { supplier, rows, totalErosion: rows.reduce((sum, r) => sum + r.erosion, 0), affected: rows.filter((r) => r.qty > 0).length }
}

/** Decomposition of the 0.8 pp (1,336 KWD) theoretical-vs-actual COGS gap. */
export const COGS_GAP_CAUSES = [
  { id: 'ck-shrinkage', en: 'Ardiya Central Kitchen prep shrinkage', ar: 'فاقد التحضير في المطبخ المركزي بالعارضية', share: 0.52, tone: 'rose' as const },
  { id: 'over-portioning', en: 'Branch over-portioning', ar: 'زيادة الحصص في الفروع', share: 0.31, tone: 'amber' as const },
  { id: 'unrecorded-waste', en: 'Unrecorded wastage', ar: 'هدر غير مسجل', share: 0.17, tone: 'sky' as const },
]


export function cogsVarianceMatrix(f: BiFilters) {
  const pf = periodFactor(f.period)
  const s = sliceShares({ brand: f.brand, branch: 'all', channel: f.channel })
  const scale = s.brandShare * s.channelShare * pf
  // Actual COGS per location = Odoo Branches analytic plan; theoretical = location revenue × target.
  // The split of a positive gap into causes uses the management cause shares (not in Odoo).
  const rows = BRANCHES.map((b) => {
    const theo = b.revenue * (LEDGER.cogsTargetPct / 100)
    const actual = b.cogs
    const total = actual - theo
    const [ckShrink, overPortion, unrecorded] = COGS_GAP_CAUSES.map((c) => Math.max(total, 0) * c.share)
    return {
      id: b.id,
      en: b.en,
      ar: b.ar,
      sales: b.sales * scale,
      theoretical: theo * scale,
      actual: actual * scale,
      ckShrink: ckShrink * scale,
      overPortion: overPortion * scale,
      unrecorded: unrecorded * scale,
      gap: total * scale,
      actualPct: b.revenue ? (actual / b.revenue) * 100 : 0,
    }
  }).filter((r) => f.branch === 'all' || r.id === f.branch)
  return {
    gapTotal: rows.reduce((x, r) => x + r.gap, 0),
    actualTotal: rows.reduce((x, r) => x + r.actual, 0),
    theoreticalTotal: rows.reduce((x, r) => x + r.theoretical, 0),
    salesTotal: rows.reduce((x, r) => x + r.sales, 0),
    causes: COGS_GAP_CAUSES.map((c, i) => ({ ...c, value: rows.reduce((x, r) => x + [r.ckShrink, r.overPortion, r.unrecorded][i], 0) })),
    rows,
  }
}

// ===========================================================================
// MODULE 4 — CONTROLLABLE P&L & ROLLING BUDGET VARIANCE
// ===========================================================================

export type Horizon = 'day' | 'month' | 'q1' | 'h1' | 'fy'
export const HORIZONS: { id: Horizon; en: string; ar: string; months: number }[] = [
  { id: 'day', en: 'Daily', ar: 'يومي', months: 1 / DAYS_IN_PERIOD },
  { id: 'month', en: 'Month', ar: 'الشهر', months: 1 },
  { id: 'q1', en: 'Q1', ar: 'الربع الأول', months: 3 },
  { id: 'h1', en: 'H1', ar: 'النصف الأول', months: 6 },
  { id: 'fy', en: 'Full year', ar: 'السنة الكاملة', months: 12 },
]

export const horizonFromPeriod = (p: Period): Horizon => (p === 'daily' ? 'day' : p === 'annual' ? 'fy' : 'month')

/** Monthly aggregator & gateway commissions derived from the contract rates on Odoo channel sales. */
export const MONTHLY_COMMISSIONS = CHANNELS.reduce((s, c) => s + c.sales * (c.commissionPct / 100), 0)
// Odoo posts payroll, rent and commissions inside operating expenses; maintenance custody is shown separately.
const PAYROLL_RENT = Math.max(0, LEDGER.opex - LEDGER.maintCustody - MONTHLY_COMMISSIONS)
const OTHER_OPEX = LEDGER.depreciation
const BLENDED_COMMISSION_RATE = MONTHLY_COMMISSIONS / LEDGER.netSales
const UPLIFT_CONTRIBUTION = 1 - LEDGER.cogsTargetPct / 100 - BLENDED_COMMISSION_RATE
/** Revenue uplift that delivers the beverage-attach (+2,450) and menu-matrix (+584) profit levers. */
const UPLIFT_REVENUE = (LEDGER.beverageGain + LEDGER.menuMatrixGain) / UPLIFT_CONTRIBUTION

export type PnlKind = 'revenue' | 'contra' | 'cost' | 'subtotal' | 'profit'

export interface PnlLine {
  id: string
  en: string
  ar: string
  kind: PnlKind
  indent?: boolean
  actual: number
  budget: number
}

/** Ramp factor so horizon budgets tie to the approved trajectory in ROADMAP (Odoo baseline + lever increments). */
function rampFactor(h: Horizon) {
  if (h === 'h1') return ROADMAP[2].incremental / (LEVERS_MONTHLY_TOTAL * 6)
  if (h === 'fy') return ROADMAP[3].incremental / (LEVERS_MONTHLY_TOTAL * 12)
  return ROADMAP[1].incremental / (LEVERS_MONTHLY_TOTAL * 3)
}

/**
 * Monthly P&L base for the selected scope.
 * - Group: whitelisted posted Odoo accounting.
 * - Location selected: that location's real Odoo cost centre (Branches analytic plan); its commissions come from
 *   the location's own Odoo channel payments × contract rates.
 * - Brand / channel filters on top: allocated by the exact Odoo POS sales of the slice inside the base (labelled
 *   in the UI) because Odoo does not post brand × location × channel P&L.
 */
function pnlBase(f: BiFilters) {
  const branch = f.branch === 'all' ? null : BRANCHES.find((b) => b.id === f.branch) ?? null
  if (!branch) {
    const s = sliceShares(f)
    return {
      basis: (f.brand === 'all' && f.channel === 'all' ? 'odoo-group' : 'allocated-group') as PnlBasis,
      share: s.salesShare,
      salesShare: s.salesShare,
      netSales: LEDGER.netSales,
      otherRevenue: LEDGER.revenue - LEDGER.netSales,
      discounts: LEDGER.discounts,
      cogs: LEDGER.cogs,
      commissions: MONTHLY_COMMISSIONS,
      maintenance: LEDGER.maintCustody,
      payroll: PAYROLL_RENT,
      depreciation: OTHER_OPEX,
    }
  }
  const loc = ODOO.restaurants.find((r) => r.id === branch.id)
  const commissions = (loc?.channels ?? []).reduce((sum, c) => {
    const ch = CHANNELS.find((x) => x.id === c.channel)
    return sum + c.amountKwd * ((ch?.commissionPct ?? 0) / 100)
  }, 0)
  const maintenance = LEDGER.opex ? LEDGER.maintCustody * (branch.opex / LEDGER.opex) : 0
  const slice = odooSlice({ brand: f.brand, branch: f.branch, channel: f.channel })
  const share = branch.sales ? slice.net / branch.sales : 0
  return {
    basis: (f.brand === 'all' && f.channel === 'all' ? 'odoo-location' : 'allocated-location') as PnlBasis,
    share,
    salesShare: LEDGER.netSales ? slice.net / LEDGER.netSales : 0,
    netSales: branch.sales,
    otherRevenue: branch.revenue - branch.sales,
    discounts: LEDGER.netSales ? LEDGER.discounts * (branch.sales / LEDGER.netSales) : 0,
    cogs: branch.cogs,
    commissions,
    maintenance,
    payroll: Math.max(0, branch.opex - maintenance - commissions),
    depreciation: branch.depreciation,
  }
}

export type PnlBasis = 'odoo-group' | 'odoo-location' | 'allocated-group' | 'allocated-location'

export function executivePnl(f: BiFilters, horizon: Horizon) {
  const months = HORIZONS.find((h) => h.id === horizon)!.months
  const base = pnlBase(f)
  const k = base.share * months
  const lever = base.salesShare * months * rampFactor(horizon)

  const grossA = (base.netSales + base.discounts) * k
  const discA = base.discounts * k
  const netA = base.netSales * k
  const otherA = base.otherRevenue * k
  const cogsA = base.cogs * k
  const commA = base.commissions * k
  const payA = base.payroll * k
  const maintA = base.maintenance * k
  const opexA = base.depreciation * k

  const grossB = grossA + UPLIFT_REVENUE * lever
  const discB = discA - LEDGER.keetaRecovery * lever
  const netB = grossB - discB
  const cogsB = cogsA - LEDGER.cogsRecoverable * lever + UPLIFT_REVENUE * (LEDGER.cogsTargetPct / 100) * lever
  const commB = commA + UPLIFT_REVENUE * BLENDED_COMMISSION_RATE * lever
  const payB = payA
  const maintB = maintA - LEDGER.chillerRecovery * lever
  const opexB = opexA

  const lines: PnlLine[] = [
    { id: 'gross', en: 'Gross sales', ar: 'إجمالي المبيعات', kind: 'revenue', actual: grossA, budget: grossB },
    { id: 'discounts', en: 'Marketing & aggregator discounts', ar: 'الخصومات التسويقية والمنصات', kind: 'contra', indent: true, actual: discA, budget: discB },
    { id: 'net', en: 'Net sales (Odoo POS)', ar: 'صافي المبيعات (نقاط بيع أودو)', kind: 'subtotal', actual: netA, budget: netB },
    { id: 'other-revenue', en: 'Other posted revenue (invoices & journal adjustments)', ar: 'إيرادات مرحّلة أخرى (فواتير وقيود تسوية)', kind: 'revenue', indent: true, actual: otherA, budget: otherA },
    { id: 'cogs', en: 'Food & packaging COGS', ar: 'تكلفة الأغذية والتغليف', kind: 'cost', indent: true, actual: cogsA, budget: cogsB },
    { id: 'gross-profit', en: 'Gross profit', ar: 'مجمل الربح', kind: 'subtotal', actual: netA + otherA - cogsA, budget: netB + otherA - cogsB },
    { id: 'commissions', en: 'Aggregator & gateway commissions', ar: 'عمولات المنصات وبوابات الدفع', kind: 'cost', indent: true, actual: commA, budget: commB },
    { id: 'payroll', en: 'Salaries, rent & other operating expenses', ar: 'الرواتب والإيجارات والمصروفات التشغيلية الأخرى', kind: 'cost', indent: true, actual: payA, budget: payB },
    { id: 'maintenance', en: 'Maintenance custody', ar: 'عهدة الصيانة', kind: 'cost', indent: true, actual: maintA, budget: maintB },
    { id: 'opex', en: 'Depreciation', ar: 'الإهلاك', kind: 'cost', indent: true, actual: opexA, budget: opexB },
    {
      id: 'profit',
      en: 'Net operating profit',
      ar: 'صافي الربح التشغيلي',
      kind: 'profit',
      actual: netA + otherA - cogsA - commA - payA - maintA - opexA,
      budget: netB + otherA - cogsB - commB - payB - maintB - opexB,
    },
  ]
  return {
    lines: lines.map((l) => {
      const variance = l.actual - l.budget
      const favourable = l.kind === 'cost' || l.kind === 'contra' ? variance <= 0 : variance >= 0
      return { ...l, variance, variancePct: l.budget !== 0 ? (variance / Math.abs(l.budget)) * 100 : 0, favourable }
    }),
    months,
    salesShare: base.salesShare,
    basis: base.basis,
  }
}

/**
 * Whitelisted group operating profit itemised by Odoo operating unit (Branches analytic plan):
 * restaurant locations, Exhibitions & Booths (EXB), school canteens, shared cost centres and the
 * remainder posted without a branch cost centre (call centre and unallocated entries).
 */
export function pnlUnitReconciliation() {
  const unit = (pnl: { income: number; otherIncome: number; cogs: number; expense: number; depreciation: number; operatingProfit: number } | null | undefined) =>
    pnl ? { revenue: pnl.income + pnl.otherIncome, cogs: pnl.cogs, opex: pnl.expense, depreciation: pnl.depreciation, profit: pnl.operatingProfit } : { revenue: 0, cogs: 0, opex: 0, depreciation: 0, profit: 0 }
  const sum = (rows: { revenue: number; cogs: number; opex: number; depreciation: number; profit: number }[]) =>
    rows.reduce((a, r) => ({ revenue: a.revenue + r.revenue, cogs: a.cogs + r.cogs, opex: a.opex + r.opex, depreciation: a.depreciation + r.depreciation, profit: a.profit + r.profit }), { revenue: 0, cogs: 0, opex: 0, depreciation: 0, profit: 0 })
  const restaurants = ODOO.restaurants.map((l) => ({ id: l.id, en: l.en, ar: l.ar, kind: 'restaurant' as const, posNet: l.netKwd, orders: l.orders, ...unit(l.pnl) }))
  const exhibitions = ODOO.exhibitions.map((l) => ({ id: l.id, en: l.en, ar: l.ar, kind: 'exhibition' as const, posNet: l.netKwd, orders: l.orders, ...unit(l.pnl) }))
  const canteens = ODOO.canteens.map((l) => ({ id: l.id, en: l.en, ar: l.ar, kind: 'canteen' as const, posNet: l.netKwd, orders: l.orders, ...unit(l.pnl) }))
  const shared = [
    { id: 'head-office', en: 'Head office (shared cost centre)', ar: 'المكتب الرئيسي (مركز تكلفة مشترك)', kind: 'shared' as const, posNet: 0, orders: 0, ...unit(ODOO.pnl.sharedCosts.headOffice) },
    { id: 'central-kitchen', en: 'Central kitchen (shared cost centre)', ar: 'المطبخ المركزي (مركز تكلفة مشترك)', kind: 'shared' as const, posNet: 0, orders: 0, ...unit(ODOO.pnl.sharedCosts.centralKitchen) },
  ]
  const allocated = sum([...restaurants, ...exhibitions, ...canteens, ...shared])
  const group = { revenue: LEDGER.revenue, cogs: LEDGER.cogs, opex: LEDGER.opex, depreciation: LEDGER.depreciation, profit: LEDGER.netProfit }
  const remainder = {
    id: 'unallocated',
    en: 'Call centre & entries without a branch cost centre',
    ar: 'مركز الاتصال والقيود دون مركز تكلفة موقع',
    kind: 'unallocated' as const,
    posNet: LEDGER.netSales - [...restaurants, ...exhibitions, ...canteens].reduce((a, r) => a + r.posNet, 0),
    orders: LEDGER.orders - [...restaurants, ...exhibitions, ...canteens].reduce((a, r) => a + r.orders, 0),
    revenue: group.revenue - allocated.revenue,
    cogs: group.cogs - allocated.cogs,
    opex: group.opex - allocated.opex,
    depreciation: group.depreciation - allocated.depreciation,
    profit: group.profit - allocated.profit,
  }
  return {
    restaurants,
    exhibitions,
    canteens,
    shared,
    remainder,
    subtotals: { restaurants: sum(restaurants), exhibitions: sum(exhibitions), canteens: sum(canteens), shared: sum(shared) },
    group,
    company: ODOO.pnl.postedCompany,
    excludedLocations: ODOO.pnl.excludedLocations,
  }
}

export type PnlRow = ReturnType<typeof executivePnl>['lines'][number]

/** Rounded constants surfaced to Feryal's knowledge base and the UI copy. */
export const ENTERPRISE_FACTS = {
  monthlyCommissions: round(MONTHLY_COMMISSIONS),
  payrollRent: round(PAYROLL_RENT),
  upliftRevenue: round(UPLIFT_REVENUE),
  prepMonthlySpend: round(PREP_MONTHLY_SPEND),
  recoverableSettlement: round(Object.values(EXCEPTIONS).reduce((s, e) => s + e.cancelledUnpaid + e.promoUnapproved + e.commissionOverbill, 0)),
  inTransit: round(Object.values(EXCEPTIONS).reduce((s, e) => s + e.inTransit, 0)),
  chargebacksTotal: round(CHARGEBACKS.reduce((s, c) => s + c.amount, 0)),
}
