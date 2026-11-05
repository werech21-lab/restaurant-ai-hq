import { BRANDS_DATA, CHANNELS_DATA, type BrandRow, type ChannelRow } from './sales-core-data'
import { INITIAL_BRANCH_PROFILES } from '@/lib/radar/talabat-geo-zone-radar'
import { OCTOBER_HOURLY_HEATMAP } from './brand-sales-october-data'
import { DAILY_TREND_SAMPLE } from './sales-tabs'

/**
 * One calculation model for /erp/sales-scorecard so every tab reacts to the Brand and Channel filters.
 *
 * Approved totals: net sales 167,092.160 KWD, 30,540 orders, 79,740 items, discounts 4,152 KWD.
 * The Odoo extract holds brand totals and channel totals, but not the brand x channel cross-tab.
 * When both are needed we use the independence model: cell = brand total x channel total / group total
 * (the page has always done this for its headline). Rates (items per order, drinks %, starters %) stay
 * those of the row being shown. Every filtered figure is therefore an allocation, not an Odoo cell.
 */
export const ALL_BRANDS = 'All brands'
export const ALL_CHANNELS = 'All channels'
export const TOTAL_NET = 167092.16
export const TOTAL_ORDERS = 30540
export const TOTAL_ITEMS = 79740
export const TOTAL_DISCOUNTS = 4152
/** Group discount rate (discounts ÷ gross sales) in %, used to scale one row's rate by another's. */
const GROUP_DISC_RATE = (TOTAL_DISCOUNTS / (TOTAL_NET + TOTAL_DISCOUNTS)) * 100

export interface SalesFilter { brand: string; channel: string }

const BRAND_ID_TO_NAME: Record<string, string> = {
  'china-garden': 'China Garden',
  franks: "Frank's",
  tahina: 'Tahina',
  'farm-brown': 'Farm Brown',
  'noodle-bar': 'The Noodle Bar',
  'karak-cafeteria': 'Karak Cafeteria',
}

// Brand discount value in KWD: net x r / (1 - r), scaled so the six brands add up to the official 4,152.
const rawBrandDisc = BRANDS_DATA.map((b) => (b.netSales * (b.discountRate / 100)) / (1 - b.discountRate / 100))
const rawBrandDiscSum = rawBrandDisc.reduce((a, b) => a + b, 0)
export const BRAND_DISCOUNT_KWD: Record<string, number> = Object.fromEntries(
  BRANDS_DATA.map((b, i) => [b.brand, (rawBrandDisc[i] / rawBrandDiscSum) * TOTAL_DISCOUNTS]),
)

export interface SalesView {
  filter: SalesFilter
  isFiltered: boolean
  net: number
  orders: number
  items: number
  discounts: number
  avgOrder: number
  itemsPerOrder: number
  /** selection net sales ÷ group net sales (1 when nothing is filtered) */
  ratioNet: number
  /** selection orders ÷ group orders */
  ratioOrders: number
  brands: BrandRow[]
  channels: ChannelRow[]
}

const brandByName = (n: string) => BRANDS_DATA.find((b) => b.brand === n)
const channelByName = (n: string) => CHANNELS_DATA.find((c) => c.channel === n)

export function shares(f: SalesFilter) {
  const b = f.brand !== ALL_BRANDS ? brandByName(f.brand) : undefined
  const c = f.channel !== ALL_CHANNELS ? channelByName(f.channel) : undefined
  return {
    b,
    c,
    bN: b ? b.netSales / TOTAL_NET : 1,
    bO: b ? b.orders / TOTAL_ORDERS : 1,
    bD: b ? BRAND_DISCOUNT_KWD[b.brand] / TOTAL_DISCOUNTS : 1,
    cN: c ? c.netSales / TOTAL_NET : 1,
    cO: c ? c.orders / TOTAL_ORDERS : 1,
    cD: c ? c.discountKwd / TOTAL_DISCOUNTS : 1,
  }
}

export function computeView(f: SalesFilter): SalesView {
  const s = shares(f)
  const net = TOTAL_NET * s.bN * s.cN
  const orders = Math.max(0, Math.round(TOTAL_ORDERS * s.bO * s.cO))
  const items = Math.round(TOTAL_ITEMS * s.bO * s.cO)
  const discounts = TOTAL_DISCOUNTS * s.bD * s.cD

  // Brand rows: scaled by the channel filter only.
  const brandNets = BRANDS_DATA.map((b) => b.netSales * s.cN)
  const brandNetSum = brandNets.reduce((a, v) => a + v, 0)
  const brands: BrandRow[] = BRANDS_DATA.map((b, i) => {
    const n = brandNets[i]
    const o = Math.round(b.orders * s.cO)
    const rate = s.c ? Math.min(60, b.discountRate * (s.c.discountRate / GROUP_DISC_RATE)) : b.discountRate
    return {
      ...b,
      netSales: n,
      orders: o,
      share: brandNetSum > 0 ? (n / brandNetSum) * 100 : 0,
      avgOrder: o > 0 ? n / o : 0,
      discountRate: rate,
    }
  })

  // Channel rows: scaled by the brand filter only.
  const channelNets = CHANNELS_DATA.map((c) => c.netSales * s.bN)
  const channelNetSum = channelNets.reduce((a, v) => a + v, 0)
  const channels: ChannelRow[] = CHANNELS_DATA.map((c, i) => {
    const n = channelNets[i]
    const o = Math.round(c.orders * s.bO)
    const rate = s.b ? Math.min(60, c.discountRate * (s.b.discountRate / GROUP_DISC_RATE)) : c.discountRate
    return {
      ...c,
      netSales: n,
      orders: o,
      share: channelNetSum > 0 ? (n / channelNetSum) * 100 : 0,
      avgOrder: o > 0 ? n / o : 0,
      discountRate: rate,
      discountKwd: c.discountKwd * s.bD,
    }
  })

  return {
    filter: f,
    isFiltered: !!(s.b || s.c),
    net,
    orders,
    items,
    discounts,
    avgOrder: orders > 0 ? net / orders : 0,
    itemsPerOrder: orders > 0 ? items / orders : 0,
    ratioNet: s.bN * s.cN,
    ratioOrders: s.bO * s.cO,
    brands,
    channels,
  }
}

/* ------------------------------------------------------------------ branches */
/**
 * Branch net sales (KWD) for the nine active branches in the delivery radar. Source: the Odoo branch sales
 * series already used by the command-center chart; the nine values add up to exactly 167,092.16.
 */
const BRANCH_NET: Record<string, number> = {
  AVN: 38425.32,
  '360': 28140.65,
  ASM: 24680.4,
  SLM: 21350.84,
  KOT: 18720.5,
  ARD: 13410.25,
  PRM: 10845.1,
  FRW: 7265.8,
  QRN: 4253.3,
}

const brandNames = BRANDS_DATA.map((b) => b.brand)

/**
 * Branch x brand net sales. Seed = branch total x brand total, zero where the radar says the branch does not
 * run that brand (supportedBrandIds), then iterative proportional fitting so the rows add up to the branch
 * totals and the columns to the brand totals.
 */
const BRANCH_BRAND_NET: Record<string, Record<string, number>> = (() => {
  const profiles = INITIAL_BRANCH_PROFILES
  let m = profiles.map((p) =>
    brandNames.map((bn) => {
      const supported = p.supportedBrandIds.map((id) => BRAND_ID_TO_NAME[id]).includes(bn)
      return supported ? (BRANCH_NET[p.branchCode] ?? 0) * (brandByName(bn)?.netSales ?? 0) : 0
    }),
  )
  for (let it = 0; it < 400; it++) {
    m = m.map((row, i) => {
      const t = row.reduce((a, v) => a + v, 0)
      const target = BRANCH_NET[profiles[i].branchCode] ?? 0
      return t > 0 ? row.map((v) => (v * target) / t) : row
    })
    const colSum = brandNames.map((_, j) => m.reduce((a, row) => a + row[j], 0))
    m = m.map((row) => row.map((v, j) => (colSum[j] > 0 ? (v * (brandByName(brandNames[j])?.netSales ?? 0)) / colSum[j] : v)))
  }
  return Object.fromEntries(profiles.map((p, i) => [p.branchCode, Object.fromEntries(brandNames.map((bn, j) => [bn, m[i][j]]))]))
})()

export interface BranchViewRow {
  code: string
  nameAr: string
  nameEn: string
  fleet: string
  zonesOnline: number
  zonesTotal: number
  lostToday: number
  brands: string[]
  net: number
  orders: number
  avgOrder: number
  share: number
  topBrand: string
}

export function computeBranches(f: SalesFilter): BranchViewRow[] {
  const s = shares(f)
  const rows = INITIAL_BRANCH_PROFILES.map((p) => {
    let net = 0
    let orders = 0
    let top = ''
    let topNet = -1
    for (const bn of brandNames) {
      if (f.brand !== ALL_BRANDS && bn !== f.brand) continue
      const bnNet = (BRANCH_BRAND_NET[p.branchCode]?.[bn] ?? 0) * s.cN
      const b = brandByName(bn)!
      // brand orders follow the brand's own average order, so branch averages differ with their brand mix
      const bnOrders = (BRANCH_BRAND_NET[p.branchCode]?.[bn] ?? 0) / (b.netSales / b.orders) * s.cO
      net += bnNet
      orders += bnOrders
      if (bnNet > topNet) {
        topNet = bnNet
        top = bn
      }
    }
    return {
      code: p.branchCode,
      nameAr: p.branchNameAr,
      nameEn: p.branchNameEn,
      fleet: p.assignedFleetType,
      zonesOnline: p.onlineZonesCount,
      zonesTotal: p.totalZonesCount,
      lostToday: p.totalLostKwdToday,
      brands: p.supportedBrandIds.map((id) => BRAND_ID_TO_NAME[id]),
      net,
      orders: Math.round(orders),
      avgOrder: orders > 0 ? net / orders : 0,
      share: 0,
      topBrand: net > 0 ? top : '',
    }
  })
  const total = rows.reduce((a, r) => a + r.net, 0)
  return rows.map((r) => ({ ...r, share: total > 0 ? (r.net / total) * 100 : 0 })).sort((a, b) => b.net - a.net)
}

/* ------------------------------------------------------------- weekday x hour */
export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const
const WEEKDAY_AR = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']
export const weekdayLabelAr = (i: number) => WEEKDAY_AR[i]

/**
 * Weekday weights come from the dated sample days (every third day of October 2026, covering all seven
 * weekdays); hour weights come from the October hourly dataset. Cell = filtered total x weekday share x hour
 * share, so the grid always adds up to the filtered total. It is an estimate: Odoo order dates per weekday
 * and hour are not in the project dataset.
 */
function weekdayShares(key: 'sales' | 'orders'): number[] {
  const sums = Array(7).fill(0) as number[]
  const counts = Array(7).fill(0) as number[]
  for (const d of DAILY_TREND_SAMPLE) {
    const dow = new Date(Date.UTC(2026, 9, parseInt(d.day, 10))).getUTCDay() // 0 = Sunday
    const i = (dow + 6) % 7 // Monday first
    sums[i] += d[key]
    counts[i] += 1
  }
  const daysInMonth = Array(7).fill(0) as number[]
  for (let day = 1; day <= 31; day++) daysInMonth[(new Date(Date.UTC(2026, 9, day)).getUTCDay() + 6) % 7] += 1
  const w = sums.map((s, i) => (counts[i] ? (s / counts[i]) * daysInMonth[i] : 0))
  const t = w.reduce((a, v) => a + v, 0)
  return w.map((v) => v / t)
}

const HOUR_ORDERS = Array(24).fill(0) as number[]
const HOUR_SALES = Array(24).fill(0) as number[]
OCTOBER_HOURLY_HEATMAP.forEach((h) => {
  HOUR_ORDERS[h.hour] += h.orders
  HOUR_SALES[h.hour] += h.salesKwd
})
const hourOrdersTotal = HOUR_ORDERS.reduce((a, v) => a + v, 0)
const hourSalesTotal = HOUR_SALES.reduce((a, v) => a + v, 0)
const WD_ORDERS = weekdayShares('orders')
const WD_SALES = weekdayShares('sales')

export interface HeatCell { day: number; hour: number; orders: number; sales: number }

export function computeHeat(view: SalesView): { cells: HeatCell[][]; maxOrders: number } {
  let maxOrders = 0
  const cells = WEEKDAYS.map((_, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const orders = view.orders * WD_ORDERS[d] * (HOUR_ORDERS[h] / hourOrdersTotal)
      const sales = view.net * WD_SALES[d] * (HOUR_SALES[h] / hourSalesTotal)
      maxOrders = Math.max(maxOrders, orders)
      return { day: d, hour: h, orders, sales }
    }),
  )
  return { cells, maxOrders }
}

/** Share of orders in an hour window, from the October hourly dataset. */
export const hourShare = (hours: number[]) => hours.reduce((a, h) => a + HOUR_ORDERS[h], 0) / hourOrdersTotal

/* ------------------------------------------------------------------ payments */
/** Payment split from the project's report 14 (Payment Method Split): KNET 71.4%, Credit Card 18.2%, Cash 10.4%. */
export const PAYMENT_SPLIT = [
  { key: 'KNET', ar: 'كي نت', pct: 71.4 },
  { key: 'Credit Card', ar: 'بطاقة ائتمان', pct: 18.2 },
  { key: 'Cash', ar: 'نقداً', pct: 10.4 },
]
