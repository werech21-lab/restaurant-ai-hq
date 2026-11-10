/**
 * Odoo October 2026 brand and channel rows for /erp/sales-scorecard, its tabs and the filter model.
 * Generated from the live Odoo sync (src/lib/odoo/odoo-dataset.ts) — positive pos.config whitelist,
 * approved Venture Foods brands only. No reconciliation scaling is applied.
 */
import { ODOO } from '@/lib/odoo/odoo-dataset'

export interface BrandRow {
  brand: string;
  orders: number;
  /** Odoo item sales before order-level promotion lines. */
  netSales: number;
  share: number;
  avgOrder: number;
  itemsPerOrder: number;
  discountRate: number;
  drinksPct: number;
  startersPct: number;
  /** Group Odoo COGS % (per-brand recipe cost is not readable by the service account). */
  cogsPct: number;
  bestSeller: string;
}

export interface ChannelRow {
  channel: string;
  orders: number;
  /** Odoo payments through the channel (net after order-level promotions). */
  netSales: number;
  share: number;
  avgOrder: number;
  itemsPerOrder: number;
  discountRate: number;
  /** Promotion value in KWD = channel item sales − channel payments (Odoo). */
  discountKwd: number;
  drinksPct: number;
  startersPct: number;
  dessertsPct: number;
}

const STARTERS = /appetizer|starter|soup|salad|side|fries|edamame|sambosa|tiqimis/i
const DRINKS = /drink|beverage|matara|hot drinks|cold drinks/i
const DESSERTS = /dessert|desssert|sweet|cake|cookie|biscuit|ice cream/i
const r2 = (n: number) => Math.round(n * 100) / 100
const r1 = (n: number) => Math.round(n * 10) / 10

const categoryShare = (brandId: string, re: RegExp) => {
  const cats = (ODOO.categories as Record<string, readonly { name: string; netKwd: number }[]>)[brandId] ?? []
  const total = cats.reduce((s, c) => s + c.netKwd, 0)
  return total ? r1((cats.filter((c) => re.test(c.name)).reduce((s, c) => s + c.netKwd, 0) / total) * 100) : 0
}
const groupShare = (re: RegExp) => {
  const all = Object.values(ODOO.categories as Record<string, readonly { name: string; netKwd: number }[]>).flat()
  const total = all.reduce((s, c) => s + c.netKwd, 0)
  return total ? r1((all.filter((c) => re.test(c.name)).reduce((s, c) => s + c.netKwd, 0) / total) * 100) : 0
}

export const BRANDS_DATA: BrandRow[] = ODOO.brands
  .filter((b) => b.active)
  .map((b) => ({
    brand: b.en,
    orders: b.orders,
    netSales: b.netKwd,
    share: b.sharePct,
    avgOrder: b.aovKwd,
    itemsPerOrder: b.itemsPerOrder,
    discountRate: b.netKwd ? r2((b.discountKwd / (b.netKwd + b.discountKwd)) * 100) : 0,
    drinksPct: b.drinksPct,
    startersPct: categoryShare(b.id, STARTERS),
    cogsPct: ODOO.pnl.cogsPct,
    bestSeller: b.bestSeller?.name ?? '—',
  }))

const GROUP_ITEMS = ODOO.brands.reduce((s, b) => s + b.qty, 0)
const GROUP_IPO = ODOO.totals.orders ? r2(GROUP_ITEMS / ODOO.totals.orders) : 0

export const CHANNELS_DATA: ChannelRow[] = ODOO.channels.map((c) => ({
  channel: c.odooName,
  orders: c.orders,
  netSales: c.netKwd,
  share: c.sharePct,
  avgOrder: c.orders ? Math.round((c.netKwd / c.orders) * 1000) / 1000 : 0,
  itemsPerOrder: GROUP_IPO,
  discountRate: c.itemSalesKwd ? r2((c.promoKwd / c.itemSalesKwd) * 100) : 0,
  discountKwd: c.promoKwd,
  drinksPct: groupShare(DRINKS),
  startersPct: groupShare(STARTERS),
  dessertsPct: groupShare(DESSERTS),
}))

export const GROUP_ITEMS_SOLD = Math.round(GROUP_ITEMS)
