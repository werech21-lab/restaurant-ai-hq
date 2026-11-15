/**
 * Enterprise Giants Engine (`src/lib/enterprise-giants-engine.ts`).
 *
 * Cleaned of all static supplier arrays (`SUPPLIER_ITEMS`), hardcoded chargebacks (`CHARGEBACKS`),
 * static prep sheets (`PREP_ITEMS`), static COGS gap splits, and `ODOO` dataset imports.
 */

import type { BiFilters, BranchId, BrandId, ChannelId, MenuItem, Period } from '@/lib/aether/ledger'

export function kuwaitTodayISO(d: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuwait',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export function dayLabel(iso: string, lang: 'ar' | 'en') {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return lang === 'ar'
    ? `${DOW_AR[d.getUTCDay()]} ${d.getUTCDate()}`
    : `${DOW_EN[d.getUTCDay()]} ${d.getUTCDate()}`
}

export const DOW_FACTOR = [1, 1, 1, 1, 1, 1, 1]
export const SALARY_WEEK_FACTOR = 1
export const DAYPART_HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0]
export const BASE_CHANNEL_MIX = { dineIn: 0, takeaway: 0, delivery: 0 }

export type WeatherKind = 'mild' | 'warm' | 'heat' | 'dust'

export interface ForecastDay {
  date: string
  dow: number
  dayOfMonth: number
  weekendSurge: boolean
  salaryWeek: boolean
  tempC: number
  weather: WeatherKind
  deliveryShift: number
  multiplier: number
  orders: number
  sales: number
  dineIn: number
  takeaway: number
  delivery: number
  hourly: number[]
}

export function buildDemandForecast(_f: BiFilters, anchorISO: string, horizon: number): ForecastDay[] {
  return Array.from({ length: Math.max(1, horizon) }, (_, i) => {
    const base = new Date(`${anchorISO}T00:00:00Z`)
    if (!Number.isNaN(base.getTime())) base.setUTCDate(base.getUTCDate() + i)
    const iso = Number.isNaN(base.getTime()) ? anchorISO : base.toISOString().slice(0, 10)
    const dow = Number.isNaN(base.getTime()) ? 0 : base.getUTCDay()
    const dayOfMonth = Number.isNaN(base.getTime()) ? 1 : base.getUTCDate()
    return {
      date: iso,
      dow,
      dayOfMonth,
      weekendSurge: false,
      salaryWeek: false,
      tempC: 0,
      weather: 'mild',
      deliveryShift: 0,
      multiplier: 0,
      orders: 0,
      sales: 0,
      dineIn: 0,
      takeaway: 0,
      delivery: 0,
      hourly: DAYPART_HOURS.map(() => 0),
    }
  })
}

export function branchForecast(_day: ForecastDay, _f: BiFilters): {
  id: BranchId
  en: string
  ar: string
  orders: number
  sales: number
  hourly: number[]
}[] {
  return []
}

export function brandForecast(_day: ForecastDay, _f: BiFilters): {
  id: BrandId
  en: string
  ar: string
  color: string
  orders: number
}[] {
  return []
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

export const PREP_ITEMS: PrepItem[] = []
export const PREP_BUFFER = { current: 0, target: 0 }
export const PREP_MONTHLY_SPEND = 0

export function prepSheet(_day: ForecastDay, _f: BiFilters, _bufferPct: number) {
  return [] as Array<
    PrepItem & {
      brandOrders: number
      need: number
      par: number
      legacy: number
      cost: number
      avoided: number
    }
  >
}

export function wasteSavings(_bufferPct: number, _salesShare = 1) {
  return { monthly: 0, target: 0, progress: 0 }
}

export const ORDERS_PER_LABOUR_HOUR = 0
export const MIN_CREW_PER_HOUR = 0

export function staffingPulse(_day: ForecastDay, _f: BiFilters) {
  return [] as Array<{
    id: BranchId
    en: string
    ar: string
    orders: number
    sales: number
    hourly: number[]
    required: number[]
    peak: number
    rosterCrew: number
    currentHours: number
    optimalHours: number
    splhCurrent: number
    splhOptimal: number
    understaffedHours: number
    efficiency: number
  }>
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

export function dailyDecisionBrief(_f: BiFilters, _anchorISO: string): DecisionCard[] {
  return []
}

export const PACKAGING_PER_DELIVERY_ORDER = 0

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

export function threeWayReconciliation(_f: BiFilters): ReconRow[] {
  return []
}

export type ChargebackType =
  | 'wrongful-refund'
  | 'driver-delay'
  | 'commission-overbill'
  | 'missing-item'
  | 'cancelled-unpaid'
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

export const CHARGEBACK_TYPES: Record<
  ChargebackType,
  { en: string; ar: string; evidenceEn: string; evidenceAr: string }
> = {
  'wrongful-refund': { en: 'Refund', ar: 'استرداد', evidenceEn: '', evidenceAr: '' },
  'driver-delay': { en: 'Driver delay', ar: 'تأخير سائق', evidenceEn: '', evidenceAr: '' },
  'commission-overbill': { en: 'Commission variance', ar: 'فرق عمولة', evidenceEn: '', evidenceAr: '' },
  'missing-item': { en: 'Missing item', ar: 'صنف مفقود', evidenceEn: '', evidenceAr: '' },
  'cancelled-unpaid': { en: 'Cancelled order', ar: 'طلب ملغي', evidenceEn: '', evidenceAr: '' },
}

export const CHARGEBACKS: Chargeback[] = []

export function chargebacksFor(_f: BiFilters): Chargeback[] {
  return []
}

export function disputeClaim(_cb: Chargeback, _lang: 'ar' | 'en'): string {
  return ''
}

export interface WaterfallStep {
  key: 'gross' | 'commission' | 'discount' | 'cogs' | 'packaging' | 'rider' | 'net'
  en: string
  ar: string
  value: number
}

export const WATERFALL_CHANNELS: ChannelId[] = [
  'talabat-tgo',
  'talabat-tmp',
  'keeta',
  'deliveroo-go',
  'jahez',
]

export function orderWaterfall(channelId: ChannelId) {
  return {
    channel: { id: channelId, en: channelId, ar: channelId },
    gross: 0,
    pocket: 0,
    pocketPct: 0,
    monthlyPocket: 0,
    steps: [] as WaterfallStep[],
  }
}

export type IngredientId =
  | 'poultry-breast'
  | 'poultry-carton'
  | 'philly-beef'
  | 'cooking-oil'
  | 'basmati-rice'
  | 'soy-sauce'
  | 'tahina-paste'
  | 'thermal-boxes'

export interface SupplierItem {
  id: IngredientId
  en: string
  ar: string
  vendorEn: string
  vendorAr: string
  unitEn: string
  unitAr: string
  recipeUnitEn: string
  recipeUnitAr: string
  recipeUnitsPerPack: number
  contract: number
  invoices: number[]
  monthlyQty: number
}

export const SUPPLIER_ITEMS: SupplierItem[] = []
export const PRICE_CREEP_ALERT_PCT = 0

export function priceCreep(_f: BiFilters) {
  return [] as Array<
    SupplierItem & {
      latest: number
      creepPct: number
      weekPct: number
      qty: number
      impact: number
      level: 'stable' | 'watch' | 'spike'
      recipeUnitCost: number
      contractRecipeUnitCost: number
    }
  >
}

export function recipeFor(_item: MenuItem): Partial<Record<IngredientId, number>> {
  return {}
}

export function marginErosion(_ingredient: IngredientId, _increasePct: number, _f: BiFilters) {
  return {
    supplier: null,
    rows: [],
    totalErosion: 0,
    affected: 0,
  }
}

export const COGS_GAP_CAUSES: Array<{
  id: string
  en: string
  ar: string
  share: number
  tone: 'rose' | 'amber' | 'sky'
}> = []

export function cogsVarianceMatrix(_f: BiFilters) {
  return {
    gapTotal: 0,
    actualTotal: 0,
    theoreticalTotal: 0,
    salesTotal: 0,
    causes: [],
    rows: [],
  }
}

export type Horizon = 'day' | 'month' | 'q1' | 'h1' | 'fy'
export const HORIZONS: { id: Horizon; en: string; ar: string; months: number }[] = [
  { id: 'day', en: 'Daily', ar: 'يومي', months: 1 / 30 },
  { id: 'month', en: 'Month', ar: 'الشهر', months: 1 },
  { id: 'q1', en: 'Q1', ar: 'الربع الأول', months: 3 },
  { id: 'h1', en: 'H1', ar: 'النصف الأول', months: 6 },
  { id: 'fy', en: 'Full year', ar: 'السنة الكاملة', months: 12 },
]

export const horizonFromPeriod = (p: Period): Horizon =>
  p === 'daily' ? 'day' : p === 'annual' ? 'fy' : 'month'

export const MONTHLY_COMMISSIONS = 0

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

export type PnlBasis = 'odoo-group' | 'odoo-location' | 'allocated-group' | 'allocated-location'

export function executivePnl(_f: BiFilters, horizon: Horizon) {
  const months = HORIZONS.find((h) => h.id === horizon)?.months ?? 1
  return {
    lines: [] as Array<
      PnlLine & {
        variance: number
        variancePct: number
        favourable: boolean
      }
    >,
    months,
    salesShare: 0,
    basis: 'odoo-group' as PnlBasis,
  }
}

export type PnlRow = ReturnType<typeof executivePnl>['lines'][number]

export const ENTERPRISE_FACTS = {
  monthlyCommissions: 0,
  payrollRent: 0,
  upliftRevenue: 0,
  prepMonthlySpend: 0,
  recoverableSettlement: 0,
  inTransit: 0,
  chargebacksTotal: 0,
}
