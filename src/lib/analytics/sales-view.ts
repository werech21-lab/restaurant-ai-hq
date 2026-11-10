import { BRANDS_DATA, CHANNELS_DATA, GROUP_ITEMS_SOLD, type BrandRow, type ChannelRow } from './sales-core-data'
import { OCTOBER_HOURLY_HEATMAP } from './brand-sales-october-data'
import { DAILY_TREND_SAMPLE } from './sales-tabs'
import { ALL_LOCATION_LIST, SCORECARD_BRAND_ID, SCORECARD_BRAND_NAME, VERIFIED_BRANCH_NET, type OdooLocationRow } from './verified-reconciliation'
import { ODOO } from '@/lib/odoo/odoo-dataset'

/**
 * Real-data view model for /erp/sales-scorecard, built only from live Odoo cross-tabulations
 * (brand × location, brand × channel, location × channel and the brand × location × channel cube).
 *
 * Group totals (October 2026, whitelisted registers):
 * - POS net sales (after order-level promotions): ODOO.totals.netSalesKwd
 * - Orders: ODOO.totals.orders
 * - Brand rows are item sales before order-level promotion lines; channel rows are payments.
 */
export const ALL_BRANDS = 'All brands'
export const ALL_CHANNELS = 'All channels'
export const TOTAL_NET = ODOO.totals.netSalesKwd
export const TOTAL_ORDERS = ODOO.totals.orders
export const TOTAL_ITEMS = GROUP_ITEMS_SOLD
export const TOTAL_DISCOUNTS = ODOO.totals.discountsKwd

export type PeriodType = 'Day' | 'Month' | 'Year' | 'day' | 'month' | 'year'

export interface SalesFilter {
  brand: string
  channel: string
  branch?: string
  period?: PeriodType
}

/** Net sales per Odoo location (restaurants + EXB + school canteens). */
export const BRANCH_NET: Record<string, number> = { ...VERIFIED_BRANCH_NET }

const CHANNEL_ID_BY_NAME: Record<string, string> = Object.fromEntries(ODOO.channels.map((c) => [c.odooName, c.id]))
const LOCATIONS = [...ODOO.restaurants, ...ODOO.exhibitions, ...ODOO.canteens]

/** Resolves a filter value (location id, code or English name) to an Odoo location id. */
export function resolveLocationId(value: string | undefined): string | null {
  if (!value || value === 'ALL' || value === 'All branches') return null
  const v = value.toLowerCase()
  const hit = ALL_LOCATION_LIST.find((l) => l.id === v || l.code.toLowerCase() === v || l.nameEn.toLowerCase() === v || l.nameAr === value)
  return hit?.id ?? null
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

export interface RealMatrixCell {
  netSales: number
  orders: number
  items: number
  discountKwd: number
}

const ipoOf = (brandName: string) => BRANDS_DATA.find((b) => b.brand === brandName)?.itemsPerOrder ?? 0

/** Brand × channel matrix straight from Odoo (lines of orders paid through each channel). */
export const REAL_BRAND_CHANNEL_DATA: Record<string, Record<string, RealMatrixCell>> = (() => {
  const out: Record<string, Record<string, RealMatrixCell>> = {}
  for (const b of BRANDS_DATA) out[b.brand] = {}
  for (const cell of ODOO.brandChannel) {
    const brand = SCORECARD_BRAND_NAME[cell.brand]
    const channel = ODOO.channels.find((c) => c.id === cell.channel)?.odooName
    if (!brand || !channel || !out[brand]) continue
    out[brand][channel] = { netSales: cell.netKwd, orders: cell.orders, items: Math.round(cell.orders * ipoOf(brand)), discountKwd: 0 }
  }
  return out
})()

/** Line discounts per brand recorded in the Odoo POS. */
export const BRAND_DISCOUNT_KWD: Record<string, number> = Object.fromEntries(
  ODOO.brands.filter((b) => b.active).map((b) => [b.en, b.discountKwd]),
)

/** Order-level promotions per location = location item sales − location payments (Odoo). */
const LOCATION_PROMO: Record<string, number> = Object.fromEntries(
  LOCATIONS.map((l) => [l.id, Math.max(0, l.brands.reduce((s, b) => s + b.netKwd, 0) - l.netKwd)]),
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
  ratioNet: number
  ratioOrders: number
  brands: BrandRow[]
  channels: ChannelRow[]
}

export function shares(f: SalesFilter) {
  const brandSel = !!f.brand && f.brand !== ALL_BRANDS
  const channelSel = !!f.channel && f.channel !== ALL_CHANNELS
  const branchSel = !!resolveLocationId(f.branch)
  const period = (f.period ?? 'month').toLowerCase()
  const pM = period === 'day' ? 1 / 31 : period === 'year' ? 12 : 1
  return { brandSel, channelSel, branchSel, brN: 1, pM }
}

type Cell = { net: number; orders: number; items: number; discounts: number }

/** Exact Odoo figures for a brand / channel / location slice (scorecard naming). */
function slice(brand: string | null, channel: string | null, loc: string | null): Cell {
  const bid = brand ? SCORECARD_BRAND_ID[brand] : null
  const cid = channel ? CHANNEL_ID_BY_NAME[channel] : null
  const location = loc ? LOCATIONS.find((l) => l.id === loc) : null
  const brandRow = brand ? BRANDS_DATA.find((b) => b.brand === brand) : null
  const ipo = brandRow?.itemsPerOrder ?? (TOTAL_ORDERS ? TOTAL_ITEMS / TOTAL_ORDERS : 0)
  const mk = (net: number, orders: number, discounts: number): Cell => ({ net, orders, items: Math.round(orders * ipo), discounts })

  if (!brand && !channel && !loc) return { net: TOTAL_NET, orders: TOTAL_ORDERS, items: TOTAL_ITEMS, discounts: TOTAL_DISCOUNTS }
  if (brand && !channel && !loc) return mk(brandRow?.netSales ?? 0, brandRow?.orders ?? 0, BRAND_DISCOUNT_KWD[brand] ?? 0)
  if (!brand && channel && !loc) {
    const c = CHANNELS_DATA.find((x) => x.channel === channel)
    return mk(c?.netSales ?? 0, c?.orders ?? 0, c?.discountKwd ?? 0)
  }
  if (!brand && !channel && loc) return mk(location?.netKwd ?? 0, location?.orders ?? 0, LOCATION_PROMO[loc] ?? 0)
  if (brand && channel && !loc) {
    const cell = REAL_BRAND_CHANNEL_DATA[brand]?.[channel]
    return mk(cell?.netSales ?? 0, cell?.orders ?? 0, 0)
  }
  if (brand && !channel && loc) {
    const bl = location?.brands.find((x) => x.brand === bid)
    return mk(bl?.netKwd ?? 0, bl?.orders ?? 0, 0)
  }
  if (!brand && channel && loc) {
    const lc = location?.channels.find((x) => x.channel === cid)
    return mk(lc?.amountKwd ?? 0, lc?.payments ?? 0, 0)
  }
  // brand × channel × location: exact net from the Odoo cube; orders follow the brand-at-location basket.
  const cube = ODOO.cube.find((x) => x.brand === bid && x.location === loc && x.channel === cid)
  const bl = location?.brands.find((x) => x.brand === bid)
  const orders = cube && bl && bl.netKwd > 0 ? Math.round((cube.netKwd / bl.netKwd) * bl.orders) : 0
  return mk(cube?.netKwd ?? 0, orders, 0)
}

const scaleOrders = (orders: number, period: string, pM: number) => (orders === 0 ? 0 : period === 'day' ? Math.max(1, Math.round(orders / 31)) : Math.round(orders * pM))

/**
 * Real Odoo view engine: every number is read from an Odoo cross-tabulation.
 */
export function computeView(f: SalesFilter): SalesView {
  const brandSel = !!f.brand && f.brand !== ALL_BRANDS && f.brand !== 'ALL'
  const channelSel = !!f.channel && f.channel !== ALL_CHANNELS && f.channel !== 'ALL'
  const loc = resolveLocationId(f.branch)
  const period = (f.period ?? 'month').toLowerCase()
  const pM = period === 'day' ? 1 / 31 : period === 'year' ? 12 : 1

  const main = slice(brandSel ? f.brand : null, channelSel ? f.channel : null, loc)
  const net = main.net * pM
  const orders = scaleOrders(main.orders, period, pM)
  const items = scaleOrders(main.items, period, pM)
  const discounts = main.discounts * pM

  const brands: BrandRow[] = BRANDS_DATA.map((b) => {
    const c = slice(b.brand, channelSel ? f.channel : null, loc)
    const scaledOrders = scaleOrders(c.orders, period, pM)
    const scaledNet = c.net * pM
    return {
      ...b,
      netSales: scaledNet,
      orders: scaledOrders,
      share: main.net > 0 ? (c.net / main.net) * 100 : 0,
      avgOrder: scaledOrders > 0 ? scaledNet / scaledOrders : 0,
    }
  })

  const channels: ChannelRow[] = CHANNELS_DATA.map((ch) => {
    const c = slice(brandSel ? f.brand : null, ch.channel, loc)
    const scaledOrders = scaleOrders(c.orders, period, pM)
    const scaledNet = c.net * pM
    return {
      ...ch,
      netSales: scaledNet,
      orders: scaledOrders,
      share: main.net > 0 ? (c.net / main.net) * 100 : 0,
      avgOrder: scaledOrders > 0 ? scaledNet / scaledOrders : 0,
      discountKwd: c.discounts * pM,
    }
  })

  return {
    filter: f,
    isFiltered: !!(brandSel || channelSel || loc || period !== 'month'),
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
export interface BranchViewRow {
  code: string
  nameAr: string
  nameEn: string
  unit: OdooLocationRow['unit']
  registers: number
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

const bucketOf = (channelId: string): 'shop' | 'tgo' | 'm' | 'other' =>
  channelId === 'shop' ? 'shop' : channelId === 'talabat-tgo' ? 'tgo' : channelId === 'talabat-tmp' || channelId === 'deliveroo-mp' ? 'm' : 'other'

/** One row per Odoo location (restaurants first, then EXB and school canteens), real channel split. */
export function computeBranches(f: SalesFilter): BranchViewRow[] {
  const period = (f.period ?? 'month').toLowerCase()
  const pM = period === 'day' ? 1 / 31 : period === 'year' ? 12 : 1
  const brandSel = !!f.brand && f.brand !== ALL_BRANDS && f.brand !== 'ALL'
  const channelSel = !!f.channel && f.channel !== ALL_CHANNELS && f.channel !== 'ALL'
  const bid = brandSel ? SCORECARD_BRAND_ID[f.brand] : null
  const cid = channelSel ? CHANNEL_ID_BY_NAME[f.channel] : null
  const only = resolveLocationId(f.branch)

  const rows = LOCATIONS.map((l) => {
    const buckets = { shop: { net: 0, orders: 0 }, tgo: { net: 0, orders: 0 }, m: { net: 0, orders: 0 }, other: { net: 0, orders: 0 } }
    let net = 0
    let orders = 0
    if (!bid) {
      for (const c of l.channels) {
        if (cid && c.channel !== cid) continue
        const k = bucketOf(c.channel)
        buckets[k].net += c.amountKwd
        buckets[k].orders += c.payments
      }
      net = cid ? buckets.shop.net + buckets.tgo.net + buckets.m.net + buckets.other.net : l.netKwd
      orders = cid ? buckets.shop.orders + buckets.tgo.orders + buckets.m.orders + buckets.other.orders : l.orders
    } else {
      const bl = l.brands.find((x) => x.brand === bid)
      for (const cell of ODOO.cube) {
        if (cell.brand !== bid || cell.location !== l.id || (cid && cell.channel !== cid)) continue
        const k = bucketOf(cell.channel)
        buckets[k].net += cell.netKwd
        buckets[k].orders += bl && bl.netKwd > 0 ? Math.round((cell.netKwd / bl.netKwd) * bl.orders) : 0
      }
      net = cid ? buckets.shop.net + buckets.tgo.net + buckets.m.net + buckets.other.net : bl?.netKwd ?? 0
      orders = cid ? buckets.shop.orders + buckets.tgo.orders + buckets.m.orders + buckets.other.orders : bl?.orders ?? 0
    }
    const top = [...l.brands].sort((a, b) => b.netKwd - a.netKwd)[0]
    return { l, buckets, net, orders, top }
  })
  const total = rows.reduce((a, r) => a + r.net, 0)
  return rows
    .map(({ l, buckets, net, orders, top }) => {
      const o = scaleOrders(orders, period, pM)
      return {
        code: l.id,
        nameAr: l.ar,
        nameEn: l.en,
        unit: l.unit as OdooLocationRow['unit'],
        registers: l.registers.length,
        brands: l.brands.map((b) => SCORECARD_BRAND_NAME[b.brand] ?? b.brand),
        net: net * pM,
        orders: o,
        shopNet: buckets.shop.net * pM,
        shopOrders: scaleOrders(buckets.shop.orders, period, pM),
        tgoNet: buckets.tgo.net * pM,
        tgoOrders: scaleOrders(buckets.tgo.orders, period, pM),
        mNet: buckets.m.net * pM,
        mOrders: scaleOrders(buckets.m.orders, period, pM),
        otherNet: buckets.other.net * pM,
        otherOrders: scaleOrders(buckets.other.orders, period, pM),
        avgOrder: o > 0 ? (net * pM) / o : 0,
        share: total > 0 ? (net / total) * 100 : 0,
        topBrand: net > 0 && top ? SCORECARD_BRAND_NAME[top.brand] ?? top.brand : '',
      }
    })
    .filter((r) => !only || r.code === only)
    .sort((a, b) => (a.unit === b.unit ? b.net - a.net : a.unit === 'restaurant' ? -1 : b.unit === 'restaurant' ? 1 : a.unit.localeCompare(b.unit)))
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
/** In-store tender mix from the Odoo Shop Sales payment methods. */
export const PAYMENT_SPLIT = [
  { key: 'KNET', ar: 'كي نت', pct: ODOO.shopTender.knet.pct },
  { key: 'Credit Card', ar: 'بطاقة ائتمان', pct: ODOO.shopTender.card.pct },
  { key: 'Cash', ar: 'نقداً', pct: ODOO.shopTender.cash.pct },
]
