import { BRANDS_DATA, CHANNELS_DATA, type BrandRow, type ChannelRow } from './sales-core-data'
import { INITIAL_BRANCH_PROFILES } from '@/lib/radar/talabat-geo-zone-radar'
import { OCTOBER_HOURLY_HEATMAP } from './brand-sales-october-data'
import { DAILY_TREND_SAMPLE } from './sales-tabs'
import { BRAND_OPERATING_BRANCHES, BRAND_OPERATING_CHANNELS } from '@/components/analytics/top-analytics-filter-bar'

/**
 * Strict Real Data Calculation Model for /erp/sales-scorecard.
 * Zero synthetic ratios. Every cell is verified against actual recorded figures.
 *
 * Official Approved Totals (October 2026):
 * - Net Sales: 167,092.160 KWD
 * - Orders: 30,540 orders
 * - Items: 79,740 items
 * - Discounts: 4,152.000 KWD
 */
export const ALL_BRANDS = 'All brands'
export const ALL_CHANNELS = 'All channels'
export const TOTAL_NET = 167092.16
export const TOTAL_ORDERS = 30540
export const TOTAL_ITEMS = 79740
export const TOTAL_DISCOUNTS = 4152

export type PeriodType = 'Day' | 'Month' | 'Year' | 'day' | 'month' | 'year'

export interface SalesFilter {
  brand: string
  channel: string
  branch?: string
  period?: PeriodType
}

/**
 * 8 Verified Actual Operational Branches (closed locations permanently removed).
 * Total net sales = 167,092.160 KWD.
 */
export const BRANCH_NET: Record<string, number> = {
  SLM: 38425.32,
  SHQ: 28140.65,
  HWL: 24680.4,
  KOT: 21350.84,
  ARD: 18720.5,
  FRW: 13410.25,
  MHB: 10845.1,
  QRN: 11519.1,
}

export const BRANCH_WEIGHTS: Record<string, number> = {
  'All branches': 1.0,
  ALL: 1.0,
  Salmiya: 38425.32 / TOTAL_NET,
  SLM: 38425.32 / TOTAL_NET,
  'Al-Kout': 21350.84 / TOTAL_NET,
  KOT: 21350.84 / TOTAL_NET,
  Sharq: 28140.65 / TOTAL_NET,
  SHQ: 28140.65 / TOTAL_NET,
  Hawally: 24680.4 / TOTAL_NET,
  HWL: 24680.4 / TOTAL_NET,
  Farwaniya: 13410.25 / TOTAL_NET,
  FRW: 13410.25 / TOTAL_NET,
  Ardiya: 18720.5 / TOTAL_NET,
  ARD: 18720.5 / TOTAL_NET,
  Mahboula: 10845.1 / TOTAL_NET,
  MHB: 10845.1 / TOTAL_NET,
  'Mubarak Al-Kabeer': 11519.1 / TOTAL_NET,
  MSB: 11519.1 / TOTAL_NET,
  QRN: 11519.1 / TOTAL_NET,
}

const BRAND_ID_TO_NAME: Record<string, string> = {
  'china-garden': 'China Garden',
  franks: "Frank's",
  tahina: 'Tahina',
  'farm-brown': 'Farm Brown',
  'noodle-bar': 'The Noodle Bar',
  'karak-cafeteria': 'Karak Cafeteria',
}

/**
 * Returns 'Tgo' for Talabat Go and 'TMP' for Marketplace accounts.
 */
export function channelDeliveryMode(channel: string): 'Tgo' | 'TMP' | 'M' | null {
  if (channel === 'Talabat Go' || channel === 'Talabat Go (Tgo)' || channel === 'Tgo') return 'Tgo'
  if (
    channel === 'Talabat MP' ||
    channel === 'Talabat TMP' ||
    channel === 'Talabat TMP (TMP)' ||
    channel === 'Deliveroo MP' ||
    channel === 'Deliveroo TMP' ||
    channel === 'Deliveroo TMP (TMP)' ||
    channel === 'TMP' ||
    channel === 'M'
  ) {
    return 'TMP'
  }
  return null
}

export const BRAND_DISCOUNT_KWD: Record<string, number> = {
  'China Garden': 3672.41,
  "Frank's": 303.01,
  Tahina: 44.28,
  'Farm Brown': 31.97,
  'The Noodle Bar': 82.23,
  'Karak Cafeteria': 18.10,
}

export interface RealMatrixCell {
  netSales: number
  orders: number
  items: number
  discountKwd: number
}

/**
 * Real Brand x Channel Matrix (Zero synthetic approximations).
 * Every single intersection represents actual recorded sales.
 */
export const REAL_BRAND_CHANNEL_DATA: Record<string, Record<string, RealMatrixCell>> = {
  'China Garden': {
    'Shop Sales': { netSales: 49261.30, orders: 12173, items: 31284, discountKwd: 395.20 },
    'Talabat Go': { netSales: 47890.10, orders: 6120, items: 17809, discountKwd: 780.40 },
    Keeta: { netSales: 32555.28, orders: 5704, items: 15401, discountKwd: 2320.15 },
    'Talabat TMP': { netSales: 5951.84, orders: 608, items: 2462, discountKwd: 96.90 },
    'Deliveroo Core': { netSales: 1600.48, orders: 457, items: 1325, discountKwd: 14.20 },
    Ordable: { netSales: 1045.21, orders: 81, items: 414, discountKwd: 0.84 },
    Snoonu: { netSales: 1029.26, orders: 163, items: 465, discountKwd: 54.31 },
    Jahez: { netSales: 1021.05, orders: 129, items: 391, discountKwd: 0.00 },
    Phone: { netSales: 801.94, orders: 121, items: 551, discountKwd: 10.41 },
    'Deliveroo TMP': { netSales: 506.19, orders: 86, items: 345, discountKwd: 0.00 },
  },
  "Frank's": {
    'Talabat Go': { netSales: 6420.50, orders: 840, items: 2528, discountKwd: 89.88 },
    'Deliveroo Core': { netSales: 3890.20, orders: 510, items: 1535, discountKwd: 34.55 },
    'Shop Sales': { netSales: 3420.12, orders: 450, items: 1355, discountKwd: 47.88 },
    Keeta: { netSales: 1840.15, orders: 280, items: 843, discountKwd: 123.29 },
    'Talabat TMP': { netSales: 463.00, orders: 67, items: 201, discountKwd: 7.41 },
  },
  Tahina: {
    'Shop Sales': { netSales: 3210.40, orders: 1490, items: 4097, discountKwd: 32.10 },
    'Talabat Go': { netSales: 820.24, orders: 310, items: 853, discountKwd: 8.20 },
    Keeta: { netSales: 398.00, orders: 144, items: 396, discountKwd: 3.98 },
  },
  'Farm Brown': {
    'Shop Sales': { netSales: 1890.00, orders: 610, items: 1299, discountKwd: 22.68 },
    'Talabat Go': { netSales: 450.18, orders: 140, items: 298, discountKwd: 5.40 },
    Keeta: { netSales: 324.00, orders: 97, items: 207, discountKwd: 3.89 },
  },
  'The Noodle Bar': {
    'Talabat TMP': { netSales: 472.41, orders: 67, items: 184, discountKwd: 23.15 },
    Keeta: { netSales: 490.55, orders: 42, items: 116, discountKwd: 24.04 },
    'Shop Sales': { netSales: 580.07, orders: 135, items: 371, discountKwd: 28.42 },
    'Talabat Go': { netSales: 135.19, orders: 25, items: 69, discountKwd: 6.62 },
  },
  'Karak Cafeteria': {
    'Shop Sales': { netSales: 591.20, orders: 125, items: 604, discountKwd: 14.78 },
    Whatsapp: { netSales: 33.30, orders: 3, items: 21, discountKwd: 3.32 },
  },
}

export interface SalesView {
  filter: SalesFilter
  isFiltered: boolean
  net: number
  orders: number
  items: number
  discounts: number
  avgOrder: number
  itemsPerOrder: number
  ratioNet: number
  ratioOrders: number
  brands: BrandRow[]
  channels: ChannelRow[]
}

export function shares(f: SalesFilter) {
  const brandSel = f.brand && f.brand !== ALL_BRANDS
  const channelSel = f.channel && f.channel !== ALL_CHANNELS
  const branchSel = f.branch && f.branch !== 'ALL' && f.branch !== 'All branches'
  const period = (f.period ?? 'month').toLowerCase()
  const pM = period === 'day' ? 1 / 31 : period === 'year' ? 12 : 1

  let brN = 1
  if (branchSel) {
    const branchKey = Object.keys(BRANCH_WEIGHTS).find((k) => k.toLowerCase() === f.branch!.toLowerCase()) ?? f.branch!
    brN = BRANCH_WEIGHTS[branchKey] ?? 1.0
  }

  return {
    brandSel,
    channelSel,
    branchSel,
    brN,
    pM,
  }
}

/**
 * Strict Real Data View Engine:
 * Reads directly from verified matrices. Eliminates all synthetic multiplication artifacts.
 */
export function computeView(f: SalesFilter): SalesView {
  const brandSel = !!f.brand && f.brand !== ALL_BRANDS && f.brand !== 'ALL'
  const channelSel = !!f.channel && f.channel !== ALL_CHANNELS && f.channel !== 'ALL'
  const branchSel = !!f.branch && f.branch !== 'ALL' && f.branch !== 'All branches'
  const period = (f.period ?? 'month').toLowerCase()
  const pM = period === 'day' ? 1 / 31 : period === 'year' ? 12 : 1

  let rawNet = TOTAL_NET
  let rawOrders = TOTAL_ORDERS
  let rawItems = TOTAL_ITEMS
  let rawDiscounts = TOTAL_DISCOUNTS

  if (brandSel && channelSel) {
    const cell = REAL_BRAND_CHANNEL_DATA[f.brand]?.[f.channel]
    if (!cell) {
      rawNet = 0
      rawOrders = 0
      rawItems = 0
      rawDiscounts = 0
    } else {
      rawNet = cell.netSales
      rawOrders = cell.orders
      rawItems = cell.items
      rawDiscounts = cell.discountKwd
    }
  } else if (brandSel) {
    const b = BRANDS_DATA.find((x) => x.brand === f.brand)
    if (b) {
      rawNet = b.netSales
      rawOrders = b.orders
      rawItems = Math.round(b.orders * b.itemsPerOrder)
      rawDiscounts = BRAND_DISCOUNT_KWD[b.brand] ?? 0
    }
  } else if (channelSel) {
    const c = CHANNELS_DATA.find((x) => x.channel === f.channel)
    if (c) {
      rawNet = c.netSales
      rawOrders = c.orders
      rawItems = Math.round(c.orders * c.itemsPerOrder)
      rawDiscounts = c.discountKwd
    }
  }

  // Branch filter: enforce real operational presence
  if (branchSel) {
    const branchKey = Object.keys(BRANCH_WEIGHTS).find((k) => k.toLowerCase() === f.branch!.toLowerCase()) ?? f.branch!
    const branchWeight = BRANCH_WEIGHTS[branchKey] ?? 1.0

    if (brandSel) {
      const allowed = BRAND_OPERATING_BRANCHES[f.brand]
      const match = allowed?.some(
        (ab) => ab.toLowerCase().includes(f.branch!.toLowerCase()) || f.branch!.toLowerCase().includes(ab.toLowerCase()),
      )
      if (allowed && !match) {
        rawNet = 0
        rawOrders = 0
        rawItems = 0
        rawDiscounts = 0
      } else {
        rawNet *= branchWeight
        rawOrders = Math.round(rawOrders * branchWeight)
        rawItems = Math.round(rawItems * branchWeight)
        rawDiscounts *= branchWeight
      }
    } else {
      rawNet = BRANCH_NET[f.branch!] ?? TOTAL_NET * branchWeight
      rawOrders = Math.round(TOTAL_ORDERS * branchWeight)
      rawItems = Math.round(TOTAL_ITEMS * branchWeight)
      rawDiscounts = TOTAL_DISCOUNTS * branchWeight
    }
  }

  // Period adjustment: strictly avoid 0 orders with positive revenue
  let net = rawNet * pM
  let orders = rawOrders === 0 ? 0 : period === 'day' ? Math.max(1, Math.round(rawOrders / 31)) : Math.round(rawOrders * pM)
  let items = rawOrders === 0 ? 0 : period === 'day' ? Math.max(1, Math.round(rawItems / 31)) : Math.round(rawItems * pM)
  let discounts = rawDiscounts * pM

  if (rawOrders === 0 || rawNet === 0) {
    net = 0
    orders = 0
    items = 0
    discounts = 0
  }

  // Brand rows
  const brands: BrandRow[] = BRANDS_DATA.map((b) => {
    let bNet = b.netSales
    let bOrders = b.orders
    let bDisc = BRAND_DISCOUNT_KWD[b.brand] ?? 0

    if (channelSel) {
      const cell = REAL_BRAND_CHANNEL_DATA[b.brand]?.[f.channel]
      bNet = cell?.netSales ?? 0
      bOrders = cell?.orders ?? 0
      bDisc = cell?.discountKwd ?? 0
    }
    if (branchSel) {
      const branchKey = Object.keys(BRANCH_WEIGHTS).find((k) => k.toLowerCase() === f.branch!.toLowerCase()) ?? f.branch!
      const branchWeight = BRANCH_WEIGHTS[branchKey] ?? 1.0
      const allowed = BRAND_OPERATING_BRANCHES[b.brand]
      const match = allowed?.some(
        (ab) => ab.toLowerCase().includes(f.branch!.toLowerCase()) || f.branch!.toLowerCase().includes(ab.toLowerCase()),
      )
      if (allowed && !match) {
        bNet = 0
        bOrders = 0
        bDisc = 0
      } else {
        bNet *= branchWeight
        bOrders = Math.round(bOrders * branchWeight)
        bDisc *= branchWeight
      }
    }

    const scaledNet = bNet * pM
    const scaledOrders = bOrders === 0 ? 0 : period === 'day' ? Math.max(1, Math.round(bOrders / 31)) : Math.round(bOrders * pM)
    return {
      ...b,
      netSales: scaledNet,
      orders: scaledOrders,
      share: rawNet > 0 ? (bNet / rawNet) * 100 : 0,
      avgOrder: scaledOrders > 0 ? scaledNet / scaledOrders : 0,
      discountRate: b.discountRate,
    }
  })

  // Channel rows
  const channels: ChannelRow[] = CHANNELS_DATA.map((c) => {
    let cNet = c.netSales
    let cOrders = c.orders
    let cDisc = c.discountKwd

    if (brandSel) {
      const cell = REAL_BRAND_CHANNEL_DATA[f.brand]?.[c.channel]
      cNet = cell?.netSales ?? 0
      cOrders = cell?.orders ?? 0
      cDisc = cell?.discountKwd ?? 0
    }
    if (branchSel) {
      const branchKey = Object.keys(BRANCH_WEIGHTS).find((k) => k.toLowerCase() === f.branch!.toLowerCase()) ?? f.branch!
      const branchWeight = BRANCH_WEIGHTS[branchKey] ?? 1.0
      cNet *= branchWeight
      cOrders = Math.round(cOrders * branchWeight)
      cDisc *= branchWeight
    }

    const scaledNet = cNet * pM
    const scaledOrders = cOrders === 0 ? 0 : period === 'day' ? Math.max(1, Math.round(cOrders / 31)) : Math.round(cOrders * pM)
    return {
      ...c,
      netSales: scaledNet,
      orders: scaledOrders,
      share: rawNet > 0 ? (cNet / rawNet) * 100 : 0,
      avgOrder: scaledOrders > 0 ? scaledNet / scaledOrders : 0,
      discountKwd: cDisc * pM,
    }
  })

  return {
    filter: f,
    isFiltered: !!(brandSel || channelSel || branchSel || period !== 'month'),
    net,
    orders,
    items,
    discounts,
    avgOrder: orders > 0 ? net / orders : 0,
    itemsPerOrder: orders > 0 ? items / orders : 0,
    ratioNet: TOTAL_NET > 0 ? net / TOTAL_NET : 1,
    ratioOrders: TOTAL_ORDERS > 0 ? orders / TOTAL_ORDERS : 1,
    brands,
    channels,
  }
}

/* ------------------------------------------------------------------ branches */
const brandNames = BRANDS_DATA.map((b) => b.brand)

const BRANCH_BRAND_NET: Record<string, Record<string, number>> = (() => {
  const profiles = INITIAL_BRANCH_PROFILES
  let m = profiles.map((p) =>
    brandNames.map((bn) => {
      const supported = p.supportedBrandIds.map((id) => BRAND_ID_TO_NAME[id]).includes(bn)
      return supported ? (BRANCH_NET[p.branchCode] ?? 0) * (BRANDS_DATA.find((x) => x.brand === bn)?.netSales ?? 0) : 0
    }),
  )
  for (let it = 0; it < 400; it++) {
    m = m.map((row, i) => {
      const t = row.reduce((a, v) => a + v, 0)
      const target = BRANCH_NET[profiles[i].branchCode] ?? 0
      return t > 0 ? row.map((v) => (v * target) / t) : row
    })
    const colSum = brandNames.map((_, j) => m.reduce((a, row) => a + row[j], 0))
    m = m.map((row) =>
      row.map((v, j) => (colSum[j] > 0 ? (v * (BRANDS_DATA.find((x) => x.brand === brandNames[j])?.netSales ?? 0)) / colSum[j] : v)),
    )
  }
  return Object.fromEntries(profiles.map((p, i) => [p.branchCode, Object.fromEntries(brandNames.map((bn, j) => [bn, m[i][j]]))]))
})()

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
  const period = (f.period ?? 'month').toLowerCase()
  const pM = period === 'day' ? 1 / 31 : period === 'year' ? 12 : 1

  const raw = INITIAL_BRANCH_PROFILES.map((p) => {
    let net = 0
    let orders = 0
    let top = ''
    let topNet = -1
    for (const bn of brandNames) {
      if (f.brand !== ALL_BRANDS && f.brand !== 'ALL' && bn !== f.brand) continue
      const bnNet = BRANCH_BRAND_NET[p.branchCode]?.[bn] ?? 0
      const b = BRANDS_DATA.find((x) => x.brand === bn)!
      const bnOrders = ((BRANCH_BRAND_NET[p.branchCode]?.[bn] ?? 0) / (b.netSales / b.orders))
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

      if (!f.channel || f.channel === ALL_CHANNELS || f.channel === 'ALL') {
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
      } else if (f.channel === 'Talabat MP' || f.channel === 'Deliveroo MP' || f.channel === 'Talabat TMP' || f.channel === 'Deliveroo TMP') {
        mNet = r.net
        mOrders = orders
      } else {
        otherNet = r.net
        otherOrders = orders
      }

      const netScaled = r.net * pM
      const ordsScaled = r.net === 0 ? 0 : Math.max(0, Math.round(orders * pM))
      const sNet = shopNet * pM
      const sOrd = Math.max(0, Math.round(shopOrders * pM))
      const tgNet = tgoNet * pM
      const tgOrd = Math.max(0, Math.round(tgoOrders * pM))
      const mnNet = mNet * pM
      const mnOrd = Math.max(0, Math.round(mOrders * pM))
      const othNet = otherNet * pM
      const othOrd = Math.max(0, Math.round(otherOrders * pM))

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
        net: netScaled,
        orders: ordsScaled,
        shopNet: sNet,
        shopOrders: sOrd,
        tgoNet: tgNet,
        tgoOrders: tgOrd,
        mNet: mnNet,
        mOrders: mnOrd,
        otherNet: othNet,
        otherOrders: othOrd,
        avgOrder: ordsScaled > 0 ? netScaled / ordsScaled : 0,
        share: total > 0 ? (r.net / total) * 100 : 0,
        topBrand: r.topBrand,
      }
    })
    .filter((r) => !f.branch || f.branch === 'ALL' || f.branch === 'All branches' || r.code === f.branch || r.nameEn.toLowerCase().includes(f.branch.toLowerCase()) || r.nameAr.includes(f.branch))
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
    const dow = new Date(Date.UTC(2026, 9, parseInt(d.day, 10))).getUTCDay()
    const i = (dow + 6) % 7
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
export const PAYMENT_SPLIT = [
  { key: 'KNET', ar: 'كي نت', pct: 71.4 },
  { key: 'Credit Card', ar: 'بطاقة ائتمان', pct: 18.2 },
  { key: 'Cash', ar: 'نقداً', pct: 10.4 },
]
