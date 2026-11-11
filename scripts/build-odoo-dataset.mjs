#!/usr/bin/env node
/**
 * Builds src/lib/odoo/odoo-dataset.ts from src/lib/odoo-live-snapshot.json.
 *
 * The snapshot is the raw Odoo pull (server-side, ~300 KB). This generator emits a compact,
 * typed, client-safe module with only the aggregates the UI needs. Run after every sync:
 *   node scripts/sync-odoo-live.mjs && node scripts/build-odoo-dataset.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'lib', 'odoo-live-snapshot.json'), 'utf8'))
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'lib', 'odoo', 'pos-registry.json'), 'utf8'))
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000
const pct1 = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)

/* channel metadata — contract commission terms are configuration, not POS data */
const CHANNEL_META = {
  'Shop Sales': { id: 'shop', en: 'Shop Sales (dine-in & takeaway)', ar: 'مبيعات المحل (صالة وسفري)', group: 'store', commissionPct: 0, riderCostPerOrder: 0, mode: null, color: '#133B5C' },
  'Talabat Go': { id: 'talabat-tgo', en: 'Talabat Go (Tgo)', ar: 'طلبات جو (Tgo)', group: 'aggregator', commissionPct: 17, riderCostPerOrder: 0, mode: 'Tgo', color: '#F97316' },
  Keeta: { id: 'keeta', en: 'Keeta', ar: 'كيتا', group: 'aggregator', commissionPct: 12, riderCostPerOrder: 0, mode: null, color: '#EAB308' },
  'Deliveroo Go': { id: 'deliveroo-go', en: 'Deliveroo Go', ar: 'ديليفرو جو', group: 'aggregator', commissionPct: 18, riderCostPerOrder: 0, mode: null, color: '#14B8A6' },
  'Talabat MP': { id: 'talabat-tmp', en: 'Talabat MP (TMP)', ar: 'سوق طلبات (TMP)', group: 'aggregator', commissionPct: 10, riderCostPerOrder: 0.35, mode: 'TMP', color: '#FB923C' },
  'Online payment link': { id: 'online-link', en: 'Online payment links', ar: 'روابط الدفع الإلكتروني', group: 'direct', commissionPct: 2.5, riderCostPerOrder: 0.35, mode: null, color: '#0EA5E9' },
  Snoonu: { id: 'snoonu', en: 'Snoonu', ar: 'سنونو', group: 'aggregator', commissionPct: 15, riderCostPerOrder: 0, mode: null, color: '#7C3AED' },
  Jahez: { id: 'jahez', en: 'Jahez', ar: 'جاهز', group: 'aggregator', commissionPct: 15, riderCostPerOrder: 0, mode: null, color: '#DC2626' },
  'Deliveroo MP': { id: 'deliveroo-mp', en: 'Deliveroo MP (TMP)', ar: 'ديليفرو ماركت (TMP)', group: 'aggregator', commissionPct: 10, riderCostPerOrder: 0.35, mode: 'TMP', color: '#2DD4BF' },
  'Staff & complimentary': { id: 'staff', en: 'Staff meals & complimentary', ar: 'وجبات الموظفين والضيافة', group: 'store', commissionPct: 0, riderCostPerOrder: 0, mode: null, color: '#94A3B8' },
  Cari: { id: 'cari', en: 'Cari', ar: 'كاري', group: 'aggregator', commissionPct: 14, riderCostPerOrder: 0, mode: null, color: '#64748B' },
  Bilbayt: { id: 'bilbayt', en: 'Bilbayt', ar: 'بيلبيت', group: 'aggregator', commissionPct: 15, riderCostPerOrder: 0, mode: null, color: '#64748B' },
  'Cash on delivery': { id: 'cod', en: 'Cash on delivery', ar: 'الدفع عند الاستلام', group: 'direct', commissionPct: 0, riderCostPerOrder: 0.35, mode: null, color: '#64748B' },
}
const BRAND_META = {
  'china-garden': { color: '#0284C7', cuisineEn: 'Chinese & Asian', cuisineAr: 'صيني وآسيوي' },
  franks: { color: '#059669', cuisineEn: 'Philly cheesesteaks', cuisineAr: 'ساندويتشات فيلي ستيك' },
  tahina: { color: '#D97706', cuisineEn: 'Shawarma & Levant street food', cuisineAr: 'شاورما وأكل شارع شامي' },
  'farm-brown': { color: '#0F766E', cuisineEn: 'Fried chicken, sandwiches & wraps', cuisineAr: 'دجاج مقلي وساندويتشات وراب' },
  'fresh-daily-canteen': { color: '#0891B2', cuisineEn: 'School canteens: sandwiches, bakery & drinks', cuisineAr: 'مقاصف مدرسية: ساندويتشات ومخبوزات ومشروبات' },
  'noodle-bar': { color: '#E11D48', cuisineEn: 'Asian noodles & wok', cuisineAr: 'نودلز ووك آسيوي' },
  'karak-cafeteria': { color: '#475569', cuisineEn: 'Karak tea, chapati & snacks', cuisineAr: 'كرك وشاباتي ووجبات خفيفة' },
  heisenberg: { color: '#9CA3AF', cuisineEn: 'Burgers & sliders', cuisineAr: 'برجر وسلايدرز' },
  'sushi-hoko': { color: '#9CA3AF', cuisineEn: 'Sushi', cuisineAr: 'سوشي' },
  'tasty-snacks': { color: '#9CA3AF', cuisineEn: 'Sandwiches & snacks', cuisineAr: 'ساندويتشات ووجبات خفيفة' },
}
const chMeta = (name) => CHANNEL_META[name] ?? { id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), en: name, ar: name, group: 'direct', commissionPct: 0, riderCostPerOrder: 0, mode: null, color: '#64748B' }

/* channels: payments (net after order-level promotions) + item sales (before promotions) */
const itemsByChannel = {}
for (const x of snap.brandChannel) itemsByChannel[x.channel] = (itemsByChannel[x.channel] || 0) + x.netKwd
const channels = snap.channels.map((c) => {
  const m = chMeta(c.name)
  const items = r3(itemsByChannel[c.name] ?? c.amountKwd)
  return { id: m.id, odooName: c.name, en: m.en, ar: m.ar, group: m.group, mode: m.mode, color: m.color, commissionPct: m.commissionPct, riderCostPerOrder: m.riderCostPerOrder, netKwd: c.amountKwd, itemSalesKwd: items, promoKwd: r3(Math.max(0, items - c.amountKwd)), orders: c.payments, sharePct: pct1(c.amountKwd, snap.totals.netSalesKwd) }
})
const chId = (name) => chMeta(name).id

/* brands */
const drinks = /drink|beverage|matara|hot drinks|cold drinks/i
const catsByBrand = {}
for (const c of snap.categories) (catsByBrand[c.brand] ||= []).push(c)
const prodsByBrand = {}
for (const p of snap.products) (prodsByBrand[p.brand] ||= []).push(p)
const brands = snap.brands.map((b) => {
  const cats = catsByBrand[b.id] ?? []
  const drinkNet = cats.filter((c) => drinks.test(c.name)).reduce((s, c) => s + c.netKwd, 0)
  const top = (prodsByBrand[b.id] ?? [])[0]
  return {
    id: b.id, en: b.en, ar: b.ar, posRoot: b.posRoot, ...BRAND_META[b.id],
    active: b.netKwd > 0, netKwd: b.netKwd, orders: b.orders, aovKwd: b.aovKwd, qty: b.qty,
    itemsPerOrder: b.orders ? Math.round((b.qty / b.orders) * 100) / 100 : 0,
    sharePct: b.sharePct, discountKwd: b.discountKwd, drinksPct: pct1(drinkNet, b.netKwd),
    bestSeller: top ? { name: top.name.replace(/^\[[^\]]+\]\s*/, '').trim(), qty: top.qty, netKwd: top.netKwd } : null,
  }
})

const L = registry.locations
const pnlOf = (id) => snap.accounting.locationPnl?.[id] ?? null
const mapLoc = (l) => ({
  id: l.id, en: l.en, ar: l.ar, code: l.code, unit: l.unit, netKwd: l.netKwd, orders: l.orders, aovKwd: l.aovKwd, sharePct: l.sharePct, registers: l.registers,
  brands: l.brands, channels: l.channels.map((c) => ({ channel: chId(c.channel), amountKwd: c.amountKwd, payments: c.payments })),
  pnl: pnlOf(l.id),
})
const restaurants = snap.locations.filter((l) => l.unit === 'restaurant').map(mapLoc)
const exhibitions = snap.locations.filter((l) => l.unit === 'exhibition').map(mapLoc)
const canteens = snap.locations.filter((l) => l.unit === 'canteen').map(mapLoc)
const exbRegisters = snap.registers.filter((r) => r.location === 'exhibitions')

const brandLocation = []
for (const l of snap.locations) for (const b of l.brands) brandLocation.push({ brand: b.brand, location: l.id, netKwd: b.netKwd, orders: b.orders })
const brandChannel = snap.brandChannel.map((x) => ({ brand: x.brand, channel: chId(x.channel), netKwd: x.netKwd, orders: x.orders }))
const cube = (snap.cube ?? []).map((x) => ({ brand: x.brand, location: x.location, channel: chId(x.channel), netKwd: x.netKwd }))

const topProducts = {}
for (const [b, list] of Object.entries(prodsByBrand)) topProducts[b] = list.slice(0, 15).map((p) => ({ name: p.name.replace(/^\[[^\]]+\]\s*/, '').trim(), code: (p.name.match(/^\[([^\]]+)\]/) || [])[1] ?? null, qty: p.qty, netKwd: p.netKwd, avgPrice: p.qty ? r3(p.netKwd / p.qty) : 0 }))
const categories = {}
for (const [b, list] of Object.entries(catsByBrand)) categories[b] = list.slice(0, 12).map((c) => ({ name: c.name, qty: c.qty, netKwd: c.netKwd }))
/* full menu actually sold in the period (Odoo product.product, realised price and Odoo standard cost) */
const menu = snap.products.map((p) => ({
  name: p.name.replace(/^\[[^\]]+\]\s*/, '').trim(),
  code: (p.name.match(/^\[([^\]]+)\]/) || [])[1] ?? null,
  brand: p.brand,
  category: p.category ?? 'Other',
  qty: p.qty,
  netKwd: p.netKwd,
  priceKwd: p.qty ? r3(p.netKwd / p.qty) : 0,
  listPriceKwd: p.listPrice ?? 0,
  unitCostKwd: p.unitCost ?? 0,
}))

/* in-store tender mix (Shop Sales payment methods) */
const tender = { knet: 0, card: 0, cash: 0, other: 0 }
for (const m of snap.paymentMethods ?? []) {
  if (m.channel !== 'Shop Sales') continue
  const n = m.name.toLowerCase()
  const k = /k-?net/.test(n) ? 'knet' : /credit card/.test(n) ? 'card' : /cash/.test(n) ? 'cash' : 'other'
  tender[k] += m.amountKwd
}
const tenderTotal = Object.values(tender).reduce((s, v) => s + v, 0)
const shopTender = Object.fromEntries(Object.entries(tender).map(([k, v]) => [k, { amountKwd: r3(v), pct: pct1(v, tenderTotal) }]))

const acc = snap.accounting
const w = acc.whitelisted
const revenue = r3(w.income + w.otherIncome)
const operatingProfit = r3(revenue - w.cogs - w.expense - w.depreciation)
const pnl = {
  revenueKwd: revenue, incomeKwd: w.income, otherIncomeKwd: w.otherIncome, cogsKwd: w.cogs, opexKwd: w.expense, depreciationKwd: w.depreciation,
  ebitdaKwd: r3(revenue - w.cogs - w.expense), operatingProfitKwd: operatingProfit,
  marginPct: pct1(operatingProfit, revenue), cogsPct: pct1(w.cogs, w.income), opexPct: pct1(w.expense, w.income), depreciationPct: pct1(w.depreciation, w.income),
  postedCompany: acc.postedCompany, excludedLocations: acc.excludedLocationsAnalytic,
  incomeByJournal: acc.incomeByJournal, saleOrders: acc.saleOrders,
  sharedCosts: { headOffice: pnlOf('shared:head-office'), centralKitchen: pnlOf('shared:central-kitchen') },
}

const t = snap.totals
const dataset = {
  meta: { source: snap.source, database: snap.database, serverVersion: snap.serverVersion, syncedAt: snap.syncedAt, period: snap.period, allowedPosConfigIds: snap.scope.allowedPosConfigIds },
  totals: {
    netSalesKwd: t.netSalesKwd, orders: t.orders, aovKwd: t.aovKwd, itemSalesKwd: t.brandItemsKwd, promoAdjustmentsKwd: r3(-t.promoAdjustmentsKwd), lineDiscountKwd: t.discountKwd,
    discountsKwd: r3(-t.promoAdjustmentsKwd + t.discountKwd), productsSold: t.productsSold ?? snap.products.length,
    restaurantNetKwd: r3(restaurants.reduce((s, l) => s + l.netKwd, 0)), restaurantOrders: restaurants.reduce((s, l) => s + l.orders, 0),
  },
  buckets: snap.buckets ?? null,
  pnl,
  brands,
  restaurants,
  exhibitions,
  canteens,
  exbRegisters,
  channels,
  brandLocation,
  brandChannel,
  cube,
  topProducts,
  categories,
  menu,
  shopTender,
  timeProfile: snap.timeProfile ?? { daily: [], hourly: [], weekHour: [] },
}

const out = `/* eslint-disable */
/**
 * GENERATED by scripts/build-odoo-dataset.mjs from src/lib/odoo-live-snapshot.json — do not edit.
 * Source: ${snap.source} · db ${snap.database} · Odoo ${snap.serverVersion} · synced ${snap.syncedAt}
 * Period: ${snap.period.from} → ${snap.period.to} (exclusive) · positive pos.config whitelist (${snap.scope.allowedPosConfigIds.length} registers)
 */
export const ODOO = ${JSON.stringify(dataset, null, 2)} as const

export type OdooBrandId = (typeof ODOO.brands)[number]['id']
export type OdooLocationId = (typeof ODOO.restaurants)[number]['id']
export type OdooChannelId = (typeof ODOO.channels)[number]['id']
`
fs.writeFileSync(path.join(ROOT, 'src', 'lib', 'odoo', 'odoo-dataset.ts'), out)
console.log(`✔ src/lib/odoo/odoo-dataset.ts · ${brands.length} brands · ${restaurants.length} restaurants · ${exhibitions.length} EXB · ${canteens.length} canteens · ${channels.length} channels · cube ${cube.length}`)
console.log('P&L:', pnl)
