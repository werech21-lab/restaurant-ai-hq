import { BRANDS_DATA, CHANNELS_DATA, type BrandRow, type ChannelRow } from './sales-core-data'
import { INITIAL_BRANCH_PROFILES } from '@/lib/radar/talabat-geo-zone-radar'
import { OCTOBER_HOURLY_HEATMAP } from './brand-sales-october-data'
import { DAILY_TREND_SAMPLE } from './sales-tabs'

/**
 * One calculation model for /erp/sales-scorecard so every tab reacts to the Brand and Channel filters.
 *
 * Approved totals: net sales 167,092.160 KWD, 30,540 orders, 79,740 items, discounts 4,152 KWD.
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

/**
 * Returns 'Tgo' for Talabat Go (Platform Delivery) and 'M' for Marketplace (Talabat MP, Deliveroo MP).
 */
export function channelDeliveryMode(channel: string): 'Tgo' | 'M' | null {
  if (channel === 'Talabat Go') return 'Tgo'
  if (channel === 'Talabat MP' || channel === 'Deliveroo MP') return 'M'
  return null
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
 * Branch net sales (KWD) for the 9 Actual Operational Restaurant Branches:
 * (السالمية، شرق، حولي، الفحيحيل/الكوت، العارضية، الفروانية، المهبولة، الجهراء، صباح السالم/مبارك الكبير).
 * Sum = 167,092.160 KWD.
 */
const BRANCH_NET: Record<string, number> = {
  SLM: 38425.32,
  SHQ: 28140.65,
  HWL: 24680.4,
  KOT: 21350.84,
  ARD: 18720.5,
  FRW: 13410.25,
  MHB: 10845.1,
  JHR: 7265.8,
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

// Official channel bucket totals from CHANNELS_DATA:
// Shop Sales = 58,953.09 KWD (14,818 orders)
// Tgo (Talabat Go) = 55,716.21 KWD (7,163 orders)
// M (Talabat MP + Deliveroo MP) = 6,887.25 + 506.19 = 7,393.44 KWD (742 + 86 = 828 orders)
// Other Platforms = 45,029.42 KWD (7,731 orders)
const SHOP_NET_SHARE = 58953.09 / TOTAL_NET
const TGO_NET_SHARE = 55716.21 / TOTAL_NET
const M_NET_SHARE = (6887.25 + 506.19) / TOTAL_NET

const SHOP_ORD_SHARE = 14818 / TOTAL_ORDERS
const TGO_ORD_SHARE = 7163 / TOTAL_ORDERS
const M_ORD_SHARE = (742 + 86) / TOTAL_ORDERS

export interface BranchViewRow {
  code: string
  nameAr: string
  nameEn: string
  fleet: string
  zonesOnline: number
  zonesTotal: number
  tgoAccountsCount: number
  mAccountsCount: number
  lostToday: number
  brands: string[]
  net: number
  orders: number
  shopNet: number
  shopOrders: number
  tgoNet: number
  tgoOrders: number
  mNet: number
  mOrders: number
  otherNet: number
  otherOrders: number
  avgOrder: number
  share: number
  topBrand: string
}

function roundWithTarget(rawVals: number[], targetInt: number): number[] {
  const floored = rawVals.map((v) => Math.floor(v))
  const rem = Math.max(0, targetInt - floored.reduce((a, b) => a + b, 0))
  const order = rawVals
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
  const add = new Set(order.slice(0, rem).map((x) => x.i))
  return floored.map((v, i) => v + (add.has(i) ? 1 : 0))
}

export function computeBranches(f: SalesFilter): BranchViewRow[] {
  const s = shares(f)
  const raw = INITIAL_BRANCH_PROFILES.map((p) => {
    let net = 0
    let orders = 0
    let top = ''
    let topNet = -1
    for (const bn of brandNames) {
      if (f.brand !== ALL_BRANDS && bn !== f.brand) continue
      const bnNet = (BRANCH_BRAND_NET[p.branchCode]?.[bn] ?? 0) * s.cN
      const b = brandByName(bn)!
      const bnOrders = ((BRANCH_BRAND_NET[p.branchCode]?.[bn] ?? 0) / (b.netSales / b.orders)) * s.cO
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
      tgoAccountsCount: p.zoneAccounts.filter((a) => a.deliveryMode === 'Tgo').length,
      mAccountsCount: p.zoneAccounts.filter((a) => a.deliveryMode === 'M').length,
      lostToday: p.totalLostKwdToday,
      brands: p.supportedBrandIds.map((id) => BRAND_ID_TO_NAME[id]),
      net,
      rawOrders: orders,
      topBrand: net > 0 ? top : '',
    }
  })

  const targetOrders = Math.round(raw.reduce((a, r) => a + r.rawOrders, 0))
  const branchOrders = roundWithTarget(raw.map((r) => r.rawOrders), targetOrders)
  const total = raw.reduce((a, r) => a + r.net, 0)

  return raw
    .map((r, idx) => {
      const orders = branchOrders[idx]
      let shopNet = 0, tgoNet = 0, mNet = 0, otherNet = 0
      let shopOrders = 0, tgoOrders = 0, mOrders = 0, otherOrders = 0

      if (f.channel === ALL_CHANNELS) {
        shopNet = r.net * SHOP_NET_SHARE
        tgoNet = r.net * TGO_NET_SHARE
        mNet = r.net * M_NET_SHARE
        otherNet = Math.max(0, r.net - shopNet - tgoNet - mNet)

        const rawBuckets = [
          orders * SHOP_ORD_SHARE,
          orders * TGO_ORD_SHARE,
          orders * M_ORD_SHARE,
          orders * Math.max(0, 1 - SHOP_ORD_SHARE - TGO_ORD_SHARE - M_ORD_SHARE),
        ]
        const roundedBuckets = roundWithTarget(rawBuckets, orders)
        shopOrders = roundedBuckets[0]
        tgoOrders = roundedBuckets[1]
        mOrders = roundedBuckets[2]
        otherOrders = roundedBuckets[3]
      } else if (f.channel === 'Shop Sales') {
        shopNet = r.net
        shopOrders = orders
      } else if (f.channel === 'Talabat Go') {
        tgoNet = r.net
        tgoOrders = orders
      } else if (f.channel === 'Talabat MP' || f.channel === 'Deliveroo MP') {
        mNet = r.net
        mOrders = orders
      } else {
        otherNet = r.net
        otherOrders = orders
      }

      return {
        code: r.code,
        nameAr: r.nameAr,
        nameEn: r.nameEn,
        fleet: r.fleet,
        zonesOnline: r.zonesOnline,
        zonesTotal: r.zonesTotal,
        tgoAccountsCount: r.tgoAccountsCount,
        mAccountsCount: r.mAccountsCount,
        lostToday: r.lostToday,
        brands: r.brands,
        net: r.net,
        orders,
        shopNet,
        shopOrders,
        tgoNet,
        tgoOrders,
        mNet,
        mOrders,
        otherNet,
        otherOrders,
        avgOrder: orders > 0 ? r.net / orders : 0,
        share: total > 0 ? (r.net / total) * 100 : 0,
        topBrand: r.topBrand,
      }
    })
    .sort((a, b) => b.net - a.net)
}

/* ------------------------------------------------------------- weekday x hour */
export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const
const WEEKDAY_AR = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']
export const weekdayLabelAr = (i: number) => WEEKDAY_AR[i]

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
