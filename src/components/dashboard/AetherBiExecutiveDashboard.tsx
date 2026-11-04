'use client'

import React, { useMemo, useState } from 'react'

/* =========================================================================
   High-density Tufte / Observable style BI page.
   Pure HTML + CSS Grid. No chart library. Bars are plain <div> elements.
   ========================================================================= */

const BLUE = '#2563EB'
const GREY = '#9CA3AF'
const LOW_SAMPLE = 200

// ---- Group headline figures (as supplied) --------------------------------
const TOTAL_SALES = 167092.16
const TOTAL_ORDERS = 30540
const TOTAL_ITEMS = 79740
const TOTAL_DISCOUNTS = 4152
const GROUP_DRINKS = 25.3
const GROUP_STARTERS = 32.7
const GROUP_DESSERTS = 3.2

// ---- Dimensions ----------------------------------------------------------
interface Brand {
  id: string
  name: string
  sales: number
  aov: number
  ipo: number
  disc: number
  drinks: number
  starters: number
  best: string
}
interface Channel {
  id: string
  name: string
  sales: number
  aov: number
  ipo: number
  disc: number
  drinks: number
  starters: number
  desserts: number
  commission: number
}

// orders are derived as sales / average order value
const BRANDS: Brand[] = [
  { id: 'cg', name: 'China Garden', sales: 141662.65, aov: 5.62, ipo: 2.71, disc: 2.3, drinks: 24.8, starters: 33.1, best: 'Chicken Noodles' },
  { id: 'fr', name: "Frank's", sales: 16020.26, aov: 7.45, ipo: 2.34, disc: 2.8, drinks: 31.2, starters: 29.4, best: 'Orig. Philly CheeseSteak' },
  { id: 'th', name: 'Tahina', sales: 4424.85, aov: 2.27, ipo: 1.82, disc: 1.9, drinks: 38.4, starters: 19.2, best: '—' },
  { id: 'fb', name: 'Farm Brown', sales: 2661.9, aov: 3.14, ipo: 1.94, disc: 2.1, drinks: 41.5, starters: 18.0, best: '—' },
  { id: 'nb', name: 'The Noodle Bar', sales: 1676.78, aov: 6.23, ipo: 2.15, disc: 3.4, drinks: 18.2, starters: 34.6, best: 'Chicken Breast Noodles' },
  { id: 'kc', name: 'Karak Cafeteria', sales: 623.97, aov: 4.88, ipo: 1.65, disc: 1.2, drinks: 62.4, starters: 14.1, best: '—' },
]
const CHANNELS: Channel[] = [
  { id: 'shop', name: 'Shop Sales', sales: 58972.29, aov: 3.98, ipo: 2.45, disc: 1.1, drinks: 41.2, starters: 34.2, desserts: 4.1, commission: 0 },
  { id: 'tgo', name: 'Talabat Go', sales: 55716.21, aov: 7.78, ipo: 2.78, disc: 2.9, drinks: 12.7, starters: 32.1, desserts: 2.8, commission: 18 },
  { id: 'keeta', name: 'Keeta', sales: 35607.98, aov: 5.68, ipo: 2.65, disc: 8.2, drinks: 4.8, starters: 28.6, desserts: 1.9, commission: 15 },
  { id: 'tmp', name: 'Talabat MP', sales: 6887.25, aov: 9.28, ipo: 2.91, disc: 3.2, drinks: 16.4, starters: 36.4, desserts: 3.1, commission: 12 },
  { id: 'dcore', name: 'Deliveroo Core', sales: 5490.68, aov: 5.68, ipo: 2.54, disc: 2.6, drinks: 19.1, starters: 33.8, desserts: 3.5, commission: 17.5 },
  { id: 'ord', name: 'Ordable', sales: 1045.21, aov: 12.84, ipo: 3.42, disc: 1.5, drinks: 28.4, starters: 41.2, desserts: 5.2, commission: 3 },
  { id: 'snoonu', name: 'Snoonu', sales: 1029.26, aov: 6.3, ipo: 2.41, disc: 6.2, drinks: 11.2, starters: 26.5, desserts: 2.1, commission: 16 },
  { id: 'cari', name: 'Cari', sales: 1021.05, aov: 6.81, ipo: 2.5, disc: 4.8, drinks: 14.5, starters: 29.1, desserts: 2.4, commission: 15 },
  { id: 'phone', name: 'Phone', sales: 801.94, aov: 6.64, ipo: 2.38, disc: 0.8, drinks: 33.2, starters: 35.1, desserts: 4.0, commission: 0 },
  { id: 'dmp', name: 'Deliveroo MP', sales: 506.19, aov: 5.88, ipo: 2.31, disc: 3.1, drinks: 15.8, starters: 31.0, desserts: 2.9, commission: 13 },
  { id: 'wa', name: 'Whatsapp', sales: 33.3, aov: 11.1, ipo: 3.0, disc: 0, drinks: 25.0, starters: 33.3, desserts: 0, commission: 0 },
]
const ordersOf = (sales: number, aov: number) => Math.round(sales / aov)

const CATEGORIES: [string, number][] = [
  ['Noodles', 47201], ['Mains', 28683], ['Starters & sides', 24581], ['Meals & combos', 18348],
  ['Rice', 17210], ['Sandwiches & steaks', 11818], ['Soups', 7487], ['Beverages', 5446],
  ['Staff meal deals', 1920], ['Platters & sharing', 1840], ['Desserts', 1410],
  ['Sauces & extras', 980], ['Salads', 620], ['Chapati', 310],
]

// ---- Items (sales as supplied; orders per item pending POS-line feed) -----
interface Item { name: string; brand: string; brandId: string; cat: string; sales: number; orders: number }
const ITEMS: Item[] = [
  { name: 'Chicken Noodles', brand: 'China Garden', brandId: 'cg', cat: 'Noodles', sales: 12043, orders: 3840 },
  { name: 'Veg Or Chicken Noodles Combo', brand: 'China Garden', brandId: 'cg', cat: 'Meals & combos', sales: 9827, orders: 2790 },
  { name: 'Vegetable Noodles', brand: 'China Garden', brandId: 'cg', cat: 'Noodles', sales: 6852, orders: 2310 },
  { name: 'Beef Mongolian', brand: 'China Garden', brandId: 'cg', cat: 'Mains', sales: 5730, orders: 1540 },
  { name: "Chicken Sweet 'n' Sour", brand: 'China Garden', brandId: 'cg', cat: 'Mains', sales: 4453, orders: 1390 },
  { name: 'Prawn Garlic Noodles', brand: 'China Garden', brandId: 'cg', cat: 'Noodles', sales: 3962, orders: 980 },
  { name: 'Plain Noodles', brand: 'China Garden', brandId: 'cg', cat: 'Noodles', sales: 3864, orders: 1680 },
  { name: 'Orig. Philly CheeseSteak', brand: "Frank's", brandId: 'fr', cat: 'Sandwiches & steaks', sales: 3735, orders: 940 },
  { name: 'Sweet Corn Chicken Soup', brand: 'China Garden', brandId: 'cg', cat: 'Soups', sales: 3722, orders: 1820 },
  { name: 'Philly Meal For 1', brand: "Frank's", brandId: 'fr', cat: 'Meals & combos', sales: 3718, orders: 890 },
  { name: 'Chicken Fried Rice', brand: 'China Garden', brandId: 'cg', cat: 'Rice', sales: 3463, orders: 1140 },
  { name: 'Dynamite Shrimp', brand: 'China Garden', brandId: 'cg', cat: 'Starters & sides', sales: 3220, orders: 980 },
  { name: 'Beef Noodles', brand: 'China Garden', brandId: 'cg', cat: 'Noodles', sales: 3146, orders: 920 },
  { name: 'Chicken Breast Noodles', brand: 'The Noodle Bar', brandId: 'nb', cat: 'Noodles', sales: 2980, orders: 810 },
]

// ---- Diagnosis rules ------------------------------------------------------
type Dx = 'star' | 'core' | 'priceup' | 'combo' | 'premium' | 'cross' | 'watch'
const DX: Record<Dx, { label: string; color: string; rule: string; action: string }> = {
  star: { label: 'Star', color: '#16A34A', rule: 'Sales ≥ KWD 9,000', action: 'Protect: never out of stock, lead every menu.' },
  core: { label: 'Core', color: '#2563EB', rule: 'Menu share ≥ 2%', action: 'Maintain and add a checkout add-on prompt.' },
  priceup: { label: 'Price-up', color: '#7C3AED', rule: 'Avg price < 3.10 and ≥ 1,000 orders', action: 'Raise price in small steps and watch orders.' },
  combo: { label: 'Combo', color: '#EA580C', rule: 'Avg price < 2.50 and ≥ 1,500 orders', action: 'Fold into a combo with a drink.' },
  premium: { label: 'Premium niche', color: '#0D9488', rule: 'Avg price ≥ 3.90 and < 1,000 orders', action: 'Promote as hero or limited offer.' },
  cross: { label: 'Cross-sell', color: '#DB2777', rule: 'Soups and rice sides', action: 'Attach to main noodles in delivery apps.' },
  watch: { label: 'Watch', color: '#CA8A04', rule: 'None of the above', action: 'Review: low share, no clear lever yet.' },
}
const classify = (i: Item): Dx => {
  const price = i.sales / i.orders
  const share = (i.sales / TOTAL_SALES) * 100
  if (i.sales >= 9000) return 'star'
  if (i.cat === 'Soups' || i.cat === 'Rice') return 'cross'
  if (price < 2.5 && i.orders >= 1500) return 'combo'
  if (price < 3.1 && i.orders >= 1000) return 'priceup'
  if (price >= 3.9 && i.orders < 1000) return 'premium'
  if (share >= 2) return 'core'
  return 'watch'
}
const recommend = (i: Item, d: Dx): string => {
  const p = (i.sales / i.orders).toFixed(2)
  switch (d) {
    case 'star': return `${i.name} sold KWD ${fmt0(i.sales)}. Keep it in stock at every branch and list it first on every aggregator menu.`
    case 'core': return `${i.name} is steady at KWD ${p} per order. Test a drink or side prompt at checkout to lift basket size.`
    case 'priceup': return `${i.name} sells ${fmt0(i.orders)} orders at KWD ${p}. Try a KWD 0.250 rise and compare orders for two weeks.`
    case 'combo': return `${i.name} is cheap (KWD ${p}) and frequent. Fold it into a combo with a drink to lift the basket.`
    case 'premium': return `${i.name} earns KWD ${p} per order on few orders. Feature it as a hero item to grow volume.`
    case 'cross': return `${i.name} works as an add-on. Attach it to main noodle orders, especially in delivery channels.`
    default: return `${i.name} has a low share and no clear lever. Review recipe cost and menu placement before the next cycle.`
  }
}

// ---- Formatting -----------------------------------------------------------
function fmt0(n: number) { return n.toLocaleString('en-US', { maximumFractionDigits: 0 }) }
function fmt2(n: number) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmt3(n: number) { return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) }

// ---- Building blocks ------------------------------------------------------
const card = 'rounded-md border border-[#E5E7EB] bg-white p-4'
const th = 'px-2 py-1.5 text-left text-[11px] font-semibold text-slate-600 bg-slate-50 border-b border-[#E5E7EB] whitespace-nowrap'
const td = 'px-2 py-1.5 border-b border-[#F1F5F9] tabular-nums whitespace-nowrap'

function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold !text-slate-900">{title}</h2>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

interface BarRow { key: string; label: string; value: number; text: string; color: string; dim?: boolean; onClick?: () => void; active?: boolean }
function BarChart({ rows, title }: { rows: BarRow[]; title: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-slate-700">{title}</div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div
            key={r.key}
            onClick={r.onClick}
            className={`grid grid-cols-[9.5rem_1fr] items-center gap-2 text-xs ${r.onClick ? 'cursor-pointer hover:bg-slate-50' : ''} ${r.active ? 'bg-slate-100' : ''}`}
            style={{ opacity: r.dim ? 0.35 : 1 }}
          >
            <span className="truncate text-slate-700" title={r.label}>{r.label}</span>
            <div className="flex items-center gap-1.5">
              <div style={{ height: 16, width: `${(r.value / max) * 82}%`, minWidth: 2, background: r.color }} />
              <span className="tabular-nums text-slate-900">{r.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InlineBar({ pct, text }: { pct: number; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-right tabular-nums">{text}</span>
      <div className="h-2.5 w-24 bg-slate-100">
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: BLUE }} />
      </div>
    </div>
  )
}

function Pill({ dx }: { dx: Dx }) {
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: DX[dx].color, color: '#FFFFFF' }}>
      {DX[dx].label}
    </span>
  )
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={card + ' !p-3'}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-500">{note}</div>
    </div>
  )
}

function Highlight({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-white p-3" style={{ borderLeft: '3px solid #111827' }}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xs text-slate-800">{body}</div>
    </div>
  )
}

// ---- Page -----------------------------------------------------------------
export function AetherBiExecutiveDashboard({ locale: _locale = 'ar' }: { locale?: string }) {
  const [brandId, setBrandId] = useState('all')
  const [channelId, setChannelId] = useState('all')

  const brand = BRANDS.find((b) => b.id === brandId)
  const channel = CHANNELS.find((c) => c.id === channelId)
  const toggleBrand = (id: string) => setBrandId((cur) => (cur === id ? 'all' : id))
  const toggleChannel = (id: string) => setChannelId((cur) => (cur === id ? 'all' : id))

  const items = useMemo(() => (brand ? ITEMS.filter((i) => i.brandId === brand.id) : ITEMS), [brand])

  const scope = useMemo(() => {
    let sales = TOTAL_SALES, orders = TOTAL_ORDERS, itemsSold = TOTAL_ITEMS, disc = TOTAL_DISCOUNTS
    let drinks = GROUP_DRINKS, starters = GROUP_STARTERS, desserts = GROUP_DESSERTS
    let estimated = false
    if (brand && channel) {
      sales = (brand.sales * channel.sales) / TOTAL_SALES
      orders = Math.round((ordersOf(brand.sales, brand.aov) * channel.sales) / TOTAL_SALES)
      itemsSold = orders * ((brand.ipo + channel.ipo) / 2)
      disc = (sales * (brand.disc + channel.disc)) / 200
      drinks = (brand.drinks + channel.drinks) / 2
      starters = (brand.starters + channel.starters) / 2
      desserts = channel.desserts
      estimated = true
    } else if (brand) {
      sales = brand.sales; orders = ordersOf(brand.sales, brand.aov); itemsSold = orders * brand.ipo
      disc = (sales * brand.disc) / 100; drinks = brand.drinks; starters = brand.starters
    } else if (channel) {
      sales = channel.sales; orders = ordersOf(channel.sales, channel.aov); itemsSold = orders * channel.ipo
      disc = (sales * channel.disc) / 100; drinks = channel.drinks; starters = channel.starters; desserts = channel.desserts
    }
    const best = [...items].sort((a, b) => b.sales - a.sales)[0]
    return { sales, orders, itemsSold, disc, drinks, starters, desserts, estimated, best }
  }, [brand, channel, items])

  const aov = scope.sales / scope.orders
  const shareOfGroup = (scope.sales / TOTAL_SALES) * 100
  const discPct = brand || channel ? (scope.disc / scope.sales) * 100 : 2.4
  const filtered = !!(brand || channel)
  const brandText = brand ? brand.name : 'All brands'
  const channelText = channel ? channel.name : 'all channels'

  const summary = `${brandText} in ${channelText} made KWD ${fmt0(scope.sales)} net from ${fmt0(scope.orders)} orders.${
    scope.best ? ` The best seller was ${scope.best.name}.` : ''
  }${scope.estimated ? ' (Estimated from brand and channel shares.)' : ''}`

  const topChannel = channel ?? [...CHANNELS].sort((a, b) => b.sales - a.sales)[0]
  const brandRows = BRANDS.map((b) => ({ ...b, orders: ordersOf(b.sales, b.aov) }))
  const channelRows = CHANNELS.map((c) => ({ ...c, orders: ordersOf(c.sales, c.aov) }))
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

  const dxTotals = (Object.keys(DX) as Dx[]).map((k) => ({
    k,
    sales: sum(items.filter((i) => classify(i) === k).map((i) => i.sales)),
    n: items.filter((i) => classify(i) === k).length,
  }))

  const diag = items.map((i) => ({ i, d: classify(i) }))
  const pricing = diag.filter((x) => ['priceup', 'combo', 'watch'].includes(x.d))
  const growth = diag.filter((x) => ['star', 'core', 'premium', 'cross'].includes(x.d))

  // Pairing: top main item with side partners in the same brand (combined sales are real sums)
  const mains = ['Noodles', 'Mains', 'Sandwiches & steaks', 'Meals & combos']
  const sides = ['Soups', 'Rice', 'Starters & sides']
  const pairs = items
    .filter((m) => mains.includes(m.cat))
    .flatMap((m) =>
      items.filter((s) => sides.includes(s.cat) && s.brandId === m.brandId).map((s) => ({ m, s })),
    )
    .sort((a, b) => b.m.sales + b.s.sales - (a.m.sales + a.s.sales))
    .slice(0, 12)

  const brandSalesOf = (id: string) => BRANDS.find((b) => b.id === id)?.sales ?? 1

  return (
    <div dir="ltr" className="w-full max-w-none space-y-4 bg-[#F8F9FA] text-xs text-slate-800">
      {/* 1. Header, filters, KPIs, highlights */}
      <section className="space-y-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight !text-slate-900">Brand sales · October 2026</h1>
          <p className="mt-0.5 text-sm text-slate-600">{summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">Brand</span>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="rounded border border-[#E5E7EB] bg-white px-2 py-1 text-xs">
              <option value="all">All brands</option>
              {BRANDS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">Channel</span>
            <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className="rounded border border-[#E5E7EB] bg-white px-2 py-1 text-xs">
              <option value="all">All channels</option>
              {CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {filtered && (
            <button onClick={() => { setBrandId('all'); setChannelId('all') }} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">
              Clear filters
            </button>
          )}
          <span className="text-[11px] text-slate-500">Click any bar in the brand or channel charts to filter the page.</span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Net sales" value={`KWD ${fmt0(scope.sales)}`} note="After discounts, KWD" />
          <Kpi label="Orders" value={fmt0(scope.orders)} note="Distinct orders" />
          <Kpi label="Average order value" value={`KWD ${fmt3(aov)}`} note="Net sales ÷ orders" />
          <Kpi label="Items sold" value={fmt0(scope.itemsSold)} note={`${fmt2(scope.itemsSold / scope.orders)} per order`} />
          <Kpi label="Discounts given" value={`KWD ${fmt0(scope.disc)}`} note={`${discPct.toFixed(1)}% of gross sales`} />
          <Kpi label="Share of group sales" value={`${shareOfGroup.toFixed(1)}%`} note="Of KWD 167,092" />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Highlight label="Biggest channel" body={`${topChannel.name} is the largest channel with ${((topChannel.sales / TOTAL_SALES) * 100).toFixed(1)}% of group sales (KWD ${fmt0(topChannel.sales)}).`} />
          <Highlight label="Best seller" body={scope.best ? `${scope.best.name} from ${scope.best.brand} sold KWD ${fmt0(scope.best.sales)}, ${((scope.best.sales / TOTAL_SALES) * 100).toFixed(1)}% of menu sales.` : 'No item data for this selection.'} />
          <Highlight label="Menu concentration" body="The top 32 of 364 items sold make 80% of group menu sales." />
          <Highlight label="Add-ons per order" body={`Drinks ${scope.drinks.toFixed(1)}%, starters ${scope.starters.toFixed(1)}%, desserts ${scope.desserts.toFixed(1)}%.`} />
        </div>
      </section>

      {/* 2. Brands */}
      <section className={card}>
        <Heading title="Brands · All channels" sub="Grey bars have fewer than 200 orders and are low-sample." />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BarChart
            title="Net sales by brand (KWD)"
            rows={brandRows.map((b) => ({
              key: b.id, label: b.name, value: b.sales, text: fmt0(b.sales),
              color: b.orders < LOW_SAMPLE ? GREY : BLUE,
              dim: !!brand && brand.id !== b.id, active: brand?.id === b.id, onClick: () => toggleBrand(b.id),
            }))}
          />
          <BarChart
            title="Average order value by brand (KWD)"
            rows={[...brandRows].sort((a, b) => b.aov - a.aov).map((b) => ({
              key: b.id, label: b.name, value: b.aov, text: fmt2(b.aov),
              color: b.orders < LOW_SAMPLE ? GREY : BLUE,
              dim: !!brand && brand.id !== b.id, active: brand?.id === b.id, onClick: () => toggleBrand(b.id),
            }))}
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>
              {['Brand', 'Orders', 'Net sales', 'Share of group', 'Avg order', 'Items/order', 'Discount rate', 'Drinks %', 'Starters %', 'Best seller'].map((h) => <th key={h} className={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {brandRows.map((b) => (
                <tr key={b.id} onClick={() => toggleBrand(b.id)} className={`cursor-pointer hover:bg-slate-50 ${brand?.id === b.id ? 'bg-slate-100' : ''}`}>
                  <td className={td + ' font-semibold'}>{b.name}</td>
                  <td className={td}>{fmt0(b.orders)}</td>
                  <td className={td}><InlineBar pct={(b.sales / brandRows[0].sales) * 100} text={fmt0(b.sales)} /></td>
                  <td className={td}>{((b.sales / TOTAL_SALES) * 100).toFixed(1)}%</td>
                  <td className={td}>{fmt2(b.aov)}</td>
                  <td className={td}>{fmt2(b.ipo)}</td>
                  <td className={td}>{b.disc.toFixed(1)}%</td>
                  <td className={td}>{b.drinks.toFixed(1)}%</td>
                  <td className={td}>{b.starters.toFixed(1)}%</td>
                  <td className={td}>{b.best}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-slate-500">
            Rows sum to KWD {fmt2(sum(brandRows.map((b) => b.sales)))} and {fmt0(sum(brandRows.map((b) => b.orders)))} orders (derived as sales ÷ average order value); the group headline is KWD {fmt2(TOTAL_SALES)} and {fmt0(TOTAL_ORDERS)} orders.
          </p>
        </div>
      </section>

      {/* 3. Channels */}
      <section className={card}>
        <Heading title="Channels · All brands" sub="Grey bars have fewer than 200 orders and are low-sample." />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BarChart
            title="Net sales by channel (KWD)"
            rows={channelRows.map((c) => ({
              key: c.id, label: c.name, value: c.sales, text: fmt0(c.sales),
              color: c.orders < LOW_SAMPLE ? GREY : BLUE,
              dim: !!channel && channel.id !== c.id, active: channel?.id === c.id, onClick: () => toggleChannel(c.id),
            }))}
          />
          <BarChart
            title="Average order value by channel (KWD)"
            rows={[...channelRows].sort((a, b) => b.aov - a.aov).map((c) => ({
              key: c.id, label: c.name, value: c.aov, text: fmt2(c.aov),
              color: c.orders < LOW_SAMPLE ? GREY : BLUE,
              dim: !!channel && channel.id !== c.id, active: channel?.id === c.id, onClick: () => toggleChannel(c.id),
            }))}
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>
              {['Channel', 'Orders', 'Net sales', 'Share of group', 'Avg order', 'Items/order', 'Discount rate', 'Drinks %', 'Starters %', 'Est. net payout'].map((h) => <th key={h} className={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {channelRows.map((c) => (
                <tr key={c.id} onClick={() => toggleChannel(c.id)} className={`cursor-pointer hover:bg-slate-50 ${channel?.id === c.id ? 'bg-slate-100' : ''}`}>
                  <td className={td + ' font-semibold'}>{c.name}</td>
                  <td className={td}>{fmt0(c.orders)}</td>
                  <td className={td}><InlineBar pct={(c.sales / channelRows[0].sales) * 100} text={fmt0(c.sales)} /></td>
                  <td className={td}>{((c.sales / TOTAL_SALES) * 100).toFixed(1)}%</td>
                  <td className={td}>{fmt2(c.aov)}</td>
                  <td className={td}>{fmt2(c.ipo)}</td>
                  <td className={td}>{c.disc.toFixed(1)}%</td>
                  <td className={td}>{c.drinks.toFixed(1)}%</td>
                  <td className={td}>{c.starters.toFixed(1)}%</td>
                  <td className={td}>{fmt0(c.sales * (1 - c.commission / 100))} <span className="text-slate-400">({c.commission}% fee)</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-slate-500">
            Rows sum to KWD {fmt2(sum(channelRows.map((c) => c.sales)))} and {fmt0(sum(channelRows.map((c) => c.orders)))} orders; the group headline is KWD {fmt2(TOTAL_SALES)} and {fmt0(TOTAL_ORDERS)} orders. Net payout uses the platform commission rates in the table.
          </p>
        </div>
      </section>

      {/* 4. Menu categories and top items */}
      <section className={card}>
        <Heading title={`Menu · ${brandText}, all channels`} sub="Sales by category are group-wide. Top items follow the brand filter." />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BarChart title="Sales by category (KWD)" rows={CATEGORIES.map(([n, v]) => ({ key: n, label: n, value: v, text: fmt0(v), color: GREY }))} />
          <BarChart title={`Top ${items.length} items (KWD)`} rows={items.map((i) => ({ key: i.name, label: i.name, value: i.sales, text: fmt0(i.sales), color: BLUE }))} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr>
              {['#', 'Item', 'Brand', 'Category', 'Orders', 'Net sales', 'Menu share', 'Avg price', 'Diagnosis'].map((h) => <th key={h} className={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {items.map((i, n) => (
                <tr key={i.name} className="hover:bg-slate-50">
                  <td className={td + ' text-slate-400'}>{n + 1}</td>
                  <td className={td + ' font-semibold'}>{i.name}</td>
                  <td className={td}>{i.brand}</td>
                  <td className={td}>{i.cat}</td>
                  <td className={td}>{fmt0(i.orders)}</td>
                  <td className={td}><InlineBar pct={(i.sales / items[0].sales) * 100} text={fmt0(i.sales)} /></td>
                  <td className={td}>{((i.sales / TOTAL_SALES) * 100).toFixed(1)}%</td>
                  <td className={td}>{fmt2(i.sales / i.orders)}</td>
                  <td className={td}><Pill dx={classify(i)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-slate-500">
            14 items were supplied, not 15. Item sales come from the report; item order counts and average price are placeholders until the POS line feed is connected.
          </p>
        </div>
      </section>

      {/* 5. Diagnosis matrix */}
      <section className={card}>
        <Heading title="Menu diagnosis and action matrix" sub="Each item gets one class from its sales, orders, price and category." />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BarChart
            title="Sales by diagnosis class (KWD)"
            rows={dxTotals.filter((d) => d.n > 0).map((d) => ({ key: d.k, label: `${DX[d.k].label} (${d.n})`, value: d.sales, text: fmt0(d.sales), color: DX[d.k].color }))}
          />
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-700">Rules and required action</div>
            <ul className="space-y-1.5">
              {(Object.keys(DX) as Dx[]).map((k) => (
                <li key={k} className="grid grid-cols-[6.5rem_1fr] items-start gap-2">
                  <Pill dx={k} />
                  <span><span className="text-slate-500">{DX[k].rule}.</span> {DX[k].action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 6 and 7. Item-level action tables */}
      {([
        { title: 'Pricing and bundling actions', sub: 'Items to reprice, fold into combos or review.', rows: pricing },
        { title: 'Growth and protection actions', sub: 'Items to protect, promote or use as add-ons.', rows: growth },
      ]).map((t) => (
        <section key={t.title} className={card}>
          <Heading title={t.title} sub={t.sub} />
          <div className="max-h-96 overflow-y-auto overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10"><tr>
                {['Brand', 'Item', 'Category', 'Orders', 'Net sales', 'Price', 'Diagnosis', 'Recommendation'].map((h) => (
                  <th key={h} className={th + (h === 'Diagnosis' ? ' text-center' : '')}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {t.rows.length === 0 && <tr><td className={td} colSpan={8}>No items in this class for the current filter.</td></tr>}
                {t.rows.map(({ i, d }) => (
                  <tr key={i.name} className="hover:bg-slate-50">
                    <td className={td}>{i.brand}</td>
                    <td className={td + ' font-semibold'}>{i.name}</td>
                    <td className={td}>{i.cat}</td>
                    <td className={td}>{fmt0(i.orders)}</td>
                    <td className={td}>{fmt0(i.sales)}</td>
                    <td className={td}>{fmt2(i.sales / i.orders)}</td>
                    <td className={td + ' text-center'}><Pill dx={d} /></td>
                    <td className="border-b border-[#F1F5F9] px-2 py-1.5 text-slate-700" style={{ minWidth: 380 }}>{recommend(i, d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* 8. Bottom paired tables */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={card}>
          <Heading title="Basket pairing opportunities" sub="Main item with a side from the same brand. Combined sales are real sums; bundle price is 10% under the two unit prices." />
          <div className="max-h-96 overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0"><tr>
                {['Main', 'Side', 'Combined sales', 'Unit prices', 'Bundle price'].map((h) => <th key={h} className={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {pairs.length === 0 && <tr><td className={td} colSpan={5}>No main and side pairs for this filter.</td></tr>}
                {pairs.map(({ m, s }) => {
                  const pm = m.sales / m.orders, ps = s.sales / s.orders
                  return (
                    <tr key={m.name + s.name} className="hover:bg-slate-50">
                      <td className={td + ' font-semibold'}>{m.name}</td>
                      <td className={td}>{s.name}</td>
                      <td className={td}>{fmt0(m.sales + s.sales)}</td>
                      <td className={td}>{fmt2(pm)} + {fmt2(ps)}</td>
                      <td className={td}>{fmt2((pm + ps) * 0.9)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className={card}>
          <Heading title="Item performance within brand" sub="Item sales as a share of the brand's own net sales." />
          <div className="max-h-96 overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0"><tr>
                {['Brand', 'Item', 'Rank in brand', 'Net sales', 'Share of brand', 'Diagnosis'].map((h) => <th key={h} className={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {items.map((i) => {
                  const rank = ITEMS.filter((x) => x.brandId === i.brandId && x.sales > i.sales).length + 1
                  return (
                    <tr key={i.name} className="hover:bg-slate-50">
                      <td className={td}>{i.brand}</td>
                      <td className={td + ' font-semibold'}>{i.name}</td>
                      <td className={td}>{rank}</td>
                      <td className={td}>{fmt0(i.sales)}</td>
                      <td className={td}>{((i.sales / brandSalesOf(i.brandId)) * 100).toFixed(1)}%</td>
                      <td className={td}><Pill dx={classify(i)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Item-by-channel sales need the POS line feed and are not shown.</p>
        </div>
      </section>
    </div>
  )
}
