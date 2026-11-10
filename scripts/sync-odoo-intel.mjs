#!/usr/bin/env node
/**
 * Live Odoo -> Aether BI operational intelligence pull (second pass after scripts/sync-odoo-live.mjs).
 *
 * Reads credentials from .env.local (git-ignored) and writes a credential-free, aggregate-only file
 * src/lib/odoo/odoo-intel.json used by the background Aether brain (src/lib/aether-proprietary-brain.ts).
 * Scope follows the positive pos.config whitelist and location analytic accounts in
 * src/lib/odoo/pos-registry.json; stock locations are matched only against whitelisted restaurant names.
 *
 *   1. Recipe cost per menu item  : mrp.bom (+ sub-BOMs) × latest purchase.order.line price, UoM converted
 *   2. Supplier unit-price creep  : purchase.order.line, first vs last 30 days of a 120-day window
 *   3. Kitchen scrap              : stock.scrap valued with stock.move price_unit, whitelisted locations only
 *   4. POS session discipline     : pos.session late openings & cash differences, refunds and cancellations
 *   5. Rent & maintenance         : location analytic lines on rent / maintenance expense accounts
 *
 * No vendor, employee or customer names are stored. Every query runs in its own try/catch.
 *
 * Usage: node scripts/sync-odoo-intel.mjs [--from 2026-10-01 --to 2026-11-01]
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'src', 'lib', 'odoo', 'odoo-intel.json')
const SNAPSHOT = path.join(ROOT, 'src', 'lib', 'odoo-live-snapshot.json')
const REGISTRY = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'lib', 'odoo', 'pos-registry.json'), 'utf8'))
const ALLOWED = REGISTRY.allowedPosConfigIds
const ALLOWED_SET = new Set(ALLOWED)

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {}
  const out = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return out
}
const fileEnv = loadEnvFile(path.join(ROOT, '.env.local'))
const env = (k) => process.env[k] || fileEnv[k] || ''
const ODOO_URL = env('ODOO_URL').replace(/\/+$/, '')
const ODOO_DB = env('ODOO_DB')
const ODOO_LOGIN = env('ODOO_LOGIN')
const ODOO_API_KEY = env('ODOO_API_KEY')
for (const [k, v] of Object.entries({ ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_API_KEY })) if (!v) { console.error(`✖ ${k} is missing in .env.local`); process.exit(1) }

const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'))
const argv = process.argv.slice(2)
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
const PERIOD = { from: arg('--from') ?? snapshot.period?.from, to: arg('--to') ?? snapshot.period?.to }
if (!PERIOD.from || !PERIOD.to) { console.error('✖ Period missing (run sync-odoo-live first or pass --from/--to)'); process.exit(1) }

let rpcId = 0
async function rpc(service, method, args) {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: ++rpcId, params: { service, method, args } }),
    signal: AbortSignal.timeout(180_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.error) { const e = new Error(json.error.data?.message || json.error.message || 'Odoo error'); e.odoo = json.error; throw e }
  return json.result
}
let UID = 0
const ek = (model, method, args = [], kwargs = {}) => rpc('object', 'execute_kw', [ODOO_DB, UID, ODOO_API_KEY, model, method, args, kwargs])
const ISSUES = []
async function safe(label, fn, fallback) {
  try { return await fn() } catch (e) {
    const msg = String(e.message).split('\n')[0].slice(0, 160)
    ISSUES.push(`${label}: ${msg}`)
    console.warn(`  ! ${label}: ${msg}`)
    return fallback
  }
}
const m2oId = (v) => (Array.isArray(v) ? v[0] : null)
const m2oName = (v) => (Array.isArray(v) ? v[1] : null)
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out }
async function readMany(model, ids, fields) {
  const out = []
  for (const part of chunk(ids, 400)) out.push(...(await ek(model, 'read', [part, fields])))
  return out
}
async function searchReadAll(model, domain, fields, order = 'id asc', pageSize = 2000, max = 60000) {
  const out = []
  for (let offset = 0; offset < max; offset += pageSize) {
    const page = await ek(model, 'search_read', [domain], { fields, order, limit: pageSize, offset })
    out.push(...page)
    if (page.length < pageSize) break
  }
  return out
}
const isoDaysBefore = (iso, days) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - days); return d.toISOString().slice(0, 10) }
const kuwaitMinutes = (utc) => { const d = new Date(`${String(utc).replace(' ', 'T')}Z`); return ((d.getUTCHours() + 3) % 24) * 60 + d.getUTCMinutes() }
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

/** Whitelisted restaurant locations: name patterns used to match stock locations. */
const LOCATION_PATTERNS = {
  promenade: /promenade|بروميناد/i,
  '360-mall': /(^|[^0-9])360([^0-9]|$)/,
  ardiya: /ardiya|عارضية/i,
  assima: /assima|عاصمة/i,
  salmiya: /salmiya|سالمية/i,
  'al-kout': /kout|كوت/i,
  avenues: /avenue|أفنيوز|افنيوز/i,
}
const RESTAURANT_IDS = Object.entries(REGISTRY.locations).filter(([, l]) => l.unit === 'restaurant').map(([id]) => id)
const locationOfConfig = (id) => REGISTRY.registers[String(id)]?.location ?? null

async function main() {
  console.log(`▶ Odoo intel · ${ODOO_URL} · db=${ODOO_DB} · period ${PERIOD.from} → ${PERIOD.to}`)
  UID = await rpc('common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}])
  if (!Number.isInteger(UID) || UID <= 0) { console.error('✖ Authentication refused'); process.exit(1) }

  const uoms = await safe('uom.uom search_read', () => ek('uom.uom', 'search_read', [[['active', 'in', [true, false]]]], { fields: ['id', 'name', 'factor', 'category_id'], context: { active_test: false } }), [])
  const uomById = new Map(uoms.map((u) => [u.id, { factor: Number(u.factor) || 1, cat: m2oId(u.category_id), name: u.name }]))
  /** Price per unit of `fromUom` → price per unit of `toUom` (same category only). */
  const convertPrice = (price, fromUom, toUom) => {
    if (!fromUom || !toUom || fromUom === toUom) return price
    const a = uomById.get(fromUom); const b = uomById.get(toUom)
    if (!a || !b || a.cat !== b.cat) return null
    return (price * a.factor) / b.factor
  }

  /* ───────────── 1. Recipe cost per menu item (BOM × latest purchase price) ───────────── */
  const menuProducts = (snapshot.products ?? []).filter((p) => p.brand && p.brand !== 'uncategorised' && p.qty > 0)
  const menuIds = menuProducts.map((p) => p.productId).filter(Boolean)
  const menuInfo = menuIds.length ? await safe('product.product read (menu)', () => readMany('product.product', menuIds, ['id', 'product_tmpl_id', 'uom_id']), []) : []
  const tmplOfProduct = new Map(menuInfo.map((p) => [p.id, m2oId(p.product_tmpl_id)]))
  const purchaseFrom = isoDaysBefore(PERIOD.to, 180)

  const bomByTmpl = new Map()
  const bomLines = new Map()
  const priceOfProduct = new Map() // productId → { price, uom }
  const loadBoms = async (tmplIds) => {
    const need = tmplIds.filter((t) => t && !bomByTmpl.has(t))
    if (!need.length) return []
    const boms = []
    for (const part of chunk(need, 300)) boms.push(...(await safe('mrp.bom search_read', () => ek('mrp.bom', 'search_read', [[['product_tmpl_id', 'in', part], ['active', '=', true]]], { fields: ['id', 'product_tmpl_id', 'product_qty', 'product_uom_id', 'sequence'], order: 'sequence asc, id asc' }), [])))
    for (const t of need) bomByTmpl.set(t, null)
    for (const b of boms) { const t = m2oId(b.product_tmpl_id); if (!bomByTmpl.get(t)) bomByTmpl.set(t, b) }
    const ids = boms.map((b) => b.id)
    const lines = []
    for (const part of chunk(ids, 300)) lines.push(...(await safe('mrp.bom.line search_read', () => ek('mrp.bom.line', 'search_read', [[['bom_id', 'in', part]]], { fields: ['bom_id', 'product_id', 'product_qty', 'product_uom_id'] }), [])))
    for (const l of lines) { const b = m2oId(l.bom_id); bomLines.set(b, [...(bomLines.get(b) || []), l]) }
    return lines
  }
  const loadPrices = async (productIds) => {
    const need = productIds.filter((p) => p && !priceOfProduct.has(p))
    for (const p of need) priceOfProduct.set(p, null)
    for (const part of chunk(need, 200)) {
      const rows = await safe('purchase.order.line search_read (prices)', () => ek('purchase.order.line', 'search_read', [[['product_id', 'in', part], ['order_id.state', 'in', ['purchase', 'done']], ['order_id.date_order', '>=', `${purchaseFrom} 00:00:00`], ['order_id.date_order', '<', `${PERIOD.to} 00:00:00`], ['price_unit', '>', 0]]], { fields: ['product_id', 'price_unit', 'product_uom'], order: 'id desc' }), [])
      for (const r of rows) { const pid = m2oId(r.product_id); if (!priceOfProduct.get(pid)) priceOfProduct.set(pid, { price: Number(r.price_unit), uom: m2oId(r.product_uom) }) }
    }
  }

  let lines = await loadBoms([...new Set(menuInfo.map((p) => m2oId(p.product_tmpl_id)))])
  // Up to two levels of semi-finished sub-recipes (central-kitchen preparations).
  for (let depth = 0; depth < 2 && lines.length; depth++) {
    const ingIds = [...new Set(lines.map((l) => m2oId(l.product_id)).filter(Boolean))]
    await loadPrices(ingIds)
    const unpriced = ingIds.filter((id) => !priceOfProduct.get(id))
    const ingInfo = unpriced.length ? await safe('product.product read (ingredients)', () => readMany('product.product', unpriced, ['id', 'product_tmpl_id']), []) : []
    for (const p of ingInfo) tmplOfProduct.set(p.id, m2oId(p.product_tmpl_id))
    lines = await loadBoms(ingInfo.map((p) => m2oId(p.product_tmpl_id)))
  }
  if (lines.length) await loadPrices([...new Set(lines.map((l) => m2oId(l.product_id)).filter(Boolean))])

  const costMemo = new Map()
  /** Cost of one unit of the BOM's product_uom; returns { cost, priced, total }. */
  const bomCost = (bom, depth = 0) => {
    if (costMemo.has(bom.id)) return costMemo.get(bom.id)
    let cost = 0; let priced = 0; let total = 0
    for (const l of bomLines.get(bom.id) || []) {
      const pid = m2oId(l.product_id); const lineUom = m2oId(l.product_uom_id); const qty = Number(l.product_qty) || 0
      total++
      const pp = priceOfProduct.get(pid)
      let unit = pp ? convertPrice(pp.price, pp.uom, lineUom) : null
      if (unit == null && depth < 2) {
        const sub = bomByTmpl.get(tmplOfProduct.get(pid))
        if (sub) { const sc = bomCost(sub, depth + 1); if (sc.total && sc.priced / sc.total >= 0.8) unit = convertPrice(sc.cost, m2oId(sub.product_uom_id), lineUom) }
      }
      if (unit != null) { cost += unit * qty; priced++ }
    }
    const qty = Number(bom.product_qty) || 1
    const res = { cost: cost / qty, priced, total }
    costMemo.set(bom.id, res)
    return res
  }
  const recipes = []
  for (const p of menuProducts) {
    const bom = bomByTmpl.get(tmplOfProduct.get(p.productId))
    if (!bom) continue
    const c = bomCost(bom)
    if (!c.total) continue
    recipes.push({ productId: p.productId, name: p.name, brand: p.brand, recipeCostKwd: r3(c.cost), coverage: r1((c.priced / c.total) * 100), lines: c.total })
  }
  console.log(`■ Recipes: ${recipes.length} menu items with a BOM · ${recipes.filter((r) => r.coverage >= 80).length} costed ≥80%`)

  /* ───────────── 1b. Theoretical food cost of what was actually sold (stage 2 yield gap) ─────────────
   * Recipe cost ≥80% priced, grossed up for the unpriced share of BOM lines, × qty sold per location
   * (snapshot.journey.locDishQty from sync-odoo-live). Compared in the brain against posted food cost,
   * inventory count variance and scrap per location (analytic plan). */
  const costed = new Map(recipes.filter((r) => r.coverage >= 80).map((r) => [r.productId, r.recipeCostKwd / (r.coverage / 100)]))
  const avgPrice = new Map(menuProducts.map((p) => [p.productId, p.qty ? p.netKwd / p.qty : 0]))
  const brandOfPid = new Map(menuProducts.map((p) => [p.productId, p.brand]))
  const theoLoc = []; const theoBrand = new Map()
  for (const [location, dishes] of Object.entries(snapshot.journey?.locDishQty ?? {})) {
    let cost = 0; let coveredSales = 0; let sales = 0
    for (const [pidRaw, qty] of Object.entries(dishes)) {
      const pid = Number(pidRaw); const price = avgPrice.get(pid) ?? 0; const s = price * qty
      sales += s
      const unit = costed.get(pid)
      if (unit == null) continue
      cost += unit * qty; coveredSales += s
      const b = brandOfPid.get(pid)
      if (b) { const t = theoBrand.get(b) || { cost: 0, coveredSales: 0 }; t.cost += unit * qty; t.coveredSales += s; theoBrand.set(b, t) }
    }
    theoLoc.push({ location, theoreticalPct: coveredSales ? r1((cost / coveredSales) * 100) : null, coveredSalesPct: sales ? r1((coveredSales / sales) * 100) : 0, coveredSalesKwd: r3(coveredSales), theoreticalCostKwd: r3(cost) })
  }
  const theoretical = {
    method: 'BOM recipe cost (≥80% priced, grossed up) × POS qty sold, rolling window',
    byLocation: theoLoc.sort((a, b) => a.location.localeCompare(b.location)),
    byBrand: [...theoBrand.entries()].map(([brand, t]) => ({ brand, theoreticalPct: t.coveredSales ? r1((t.cost / t.coveredSales) * 100) : null, coveredSalesKwd: r3(t.coveredSales), theoreticalCostKwd: r3(t.cost) })),
  }
  console.log(`■ Theoretical food cost: ${theoLoc.map((t) => `${t.location} ${t.theoreticalPct}% (${t.coveredSalesPct}% covered)`).join(' | ')}`)

  /* ───────────── 2. Supplier unit-price creep ───────────── */
  const creepFrom = isoDaysBefore(PERIOD.to, 120)
  const lastFrom = isoDaysBefore(PERIOD.to, 30)
  const firstTo = isoDaysBefore(PERIOD.to, 90)
  const poLines = await safe('purchase.order.line search_read (creep)', () => searchReadAll('purchase.order.line', [['order_id.state', 'in', ['purchase', 'done']], ['order_id.date_order', '>=', `${creepFrom} 00:00:00`], ['order_id.date_order', '<', `${PERIOD.to} 00:00:00`], ['price_unit', '>', 0], ['product_qty', '>', 0]], ['product_id', 'price_unit', 'product_qty', 'product_uom', 'order_id']), [])
  const orderIds = [...new Set(poLines.map((l) => m2oId(l.order_id)).filter(Boolean))]
  const orders = orderIds.length ? await safe('purchase.order read', () => readMany('purchase.order', orderIds, ['id', 'date_order']), []) : []
  const dateOfOrder = new Map(orders.map((o) => [o.id, String(o.date_order).slice(0, 10)]))
  const groups = new Map()
  for (const l of poLines) {
    const k = `${m2oId(l.product_id)}|${m2oId(l.product_uom)}`
    const g = groups.get(k) || { productId: m2oId(l.product_id), name: m2oName(l.product_id), uom: m2oName(l.product_uom), first: [], last: [], lastQty: 0, spendLast: 0 }
    const d = dateOfOrder.get(m2oId(l.order_id))
    if (!d) continue
    if (d < firstTo) g.first.push({ p: Number(l.price_unit), q: Number(l.product_qty) })
    if (d >= lastFrom) { g.last.push({ p: Number(l.price_unit), q: Number(l.product_qty) }); g.lastQty += Number(l.product_qty); g.spendLast += Number(l.price_unit) * Number(l.product_qty) }
    groups.set(k, g)
  }
  const wavg = (a) => { const q = a.reduce((s, x) => s + x.q, 0); return q ? a.reduce((s, x) => s + x.p * x.q, 0) / q : 0 }
  const priceCreep = [...groups.values()]
    .filter((g) => g.first.length >= 1 && g.last.length >= 1)
    .map((g) => { const f = wavg(g.first); const l = wavg(g.last); return { productId: g.productId, name: g.name, uom: g.uom, firstPrice: r3(f), lastPrice: r3(l), creepPct: r1(f ? ((l - f) / f) * 100 : 0), last30Qty: r3(g.lastQty), last30SpendKwd: r3(g.spendLast), monthlyImpactKwd: r3((l - f) * g.lastQty) } })
    .filter((x) => Math.abs(x.creepPct) >= 0.5)
    .sort((a, b) => b.monthlyImpactKwd - a.monthlyImpactKwd)
  const purchaseSpendLast30 = r3([...groups.values()].reduce((s, g) => s + g.spendLast, 0))
  console.log(`■ Price creep: ${poLines.length} purchase lines · ${priceCreep.filter((x) => x.creepPct > 0).length} products up · impact ${r3(priceCreep.filter((x) => x.monthlyImpactKwd > 0).reduce((s, x) => s + x.monthlyImpactKwd, 0))} KWD/month`)

  /* ───────────── 3. Kitchen scrap (whitelisted restaurant locations only) ───────────── */
  const scraps = await safe('stock.scrap search_read', () => searchReadAll('stock.scrap', [['state', '=', 'done'], ['date_done', '>=', `${PERIOD.from} 00:00:00`], ['date_done', '<', `${PERIOD.to} 00:00:00`]], ['product_id', 'scrap_qty', 'location_id', 'move_id']), [])
  const stockLocIds = [...new Set(scraps.map((s) => m2oId(s.location_id)).filter(Boolean))]
  const stockLocs = stockLocIds.length ? await safe('stock.location read', () => readMany('stock.location', stockLocIds, ['id', 'complete_name']), []) : []
  const restaurantOfStockLoc = new Map()
  for (const l of stockLocs) { const hit = Object.entries(LOCATION_PATTERNS).find(([, re]) => re.test(l.complete_name || '')); if (hit) restaurantOfStockLoc.set(l.id, hit[0]) }
  const matched = scraps.filter((s) => restaurantOfStockLoc.has(m2oId(s.location_id)))
  const moveIds = [...new Set(matched.map((s) => m2oId(s.move_id)).filter(Boolean))]
  const moves = moveIds.length ? await safe('stock.move read (scrap)', () => readMany('stock.move', moveIds, ['id', 'price_unit']), []) : []
  const priceOfMove = new Map(moves.map((m) => [m.id, Math.abs(Number(m.price_unit) || 0)]))
  const scrapByLoc = new Map(); const scrapByProduct = new Map()
  for (const s of matched) {
    const loc = restaurantOfStockLoc.get(m2oId(s.location_id))
    const qty = Number(s.scrap_qty) || 0
    const value = qty * (priceOfMove.get(m2oId(s.move_id)) ?? 0)
    const a = scrapByLoc.get(loc) || { location: loc, count: 0, valueKwd: 0 }
    a.count++; a.valueKwd += value; scrapByLoc.set(loc, a)
    const pk = m2oId(s.product_id)
    const b = scrapByProduct.get(pk) || { name: m2oName(s.product_id), qty: 0, valueKwd: 0 }
    b.qty += qty; b.valueKwd += value; scrapByProduct.set(pk, b)
  }
  const scrap = {
    matchedLocations: [...new Set([...restaurantOfStockLoc.values()])],
    records: matched.length,
    totalValueKwd: r3([...scrapByLoc.values()].reduce((s, x) => s + x.valueKwd, 0)),
    byLocation: [...scrapByLoc.values()].map((x) => ({ ...x, valueKwd: r3(x.valueKwd) })).sort((a, b) => b.valueKwd - a.valueKwd),
    topProducts: [...scrapByProduct.values()].map((x) => ({ ...x, qty: r3(x.qty), valueKwd: r3(x.valueKwd) })).sort((a, b) => b.valueKwd - a.valueKwd).slice(0, 10),
  }
  console.log(`■ Scrap: ${matched.length} records at whitelisted locations · ${scrap.totalValueKwd} KWD`)

  /* ───────────── 4. POS session discipline, refunds & cancellations ───────────── */
  const sessDomain = [['config_id', 'in', ALLOWED], ['start_at', '>=', `${PERIOD.from} 00:00:00`], ['start_at', '<', `${PERIOD.to} 00:00:00`]]
  // cash_register_difference is computed from bank-statement lines; fall back to session times when that is restricted.
  let sessions = await safe('pos.session search_read', () => searchReadAll('pos.session', sessDomain, ['id', 'config_id', 'start_at', 'stop_at', 'cash_register_difference']), [])
  if (!sessions.length) sessions = await safe('pos.session search_read (session times)', () => searchReadAll('pos.session', sessDomain, ['id', 'config_id', 'start_at', 'stop_at']), [])
  const sessionsByCfg = new Map()
  for (const s of sessions) { const c = m2oId(s.config_id); if (!ALLOWED_SET.has(c)) continue; sessionsByCfg.set(c, [...(sessionsByCfg.get(c) || []), s]) }
  const discipline = new Map()
  for (const [cfg, list] of sessionsByCfg) {
    const loc = locationOfConfig(cfg)
    if (!RESTAURANT_IDS.includes(loc)) continue
    const starts = list.filter((s) => s.start_at).map((s) => kuwaitMinutes(s.start_at))
    const med = median(starts)
    const late = starts.filter((m) => m > med + 45).length
    const d = discipline.get(loc) || { location: loc, sessions: 0, lateOpenings: 0, cashDifferenceKwd: 0, registers: 0 }
    d.sessions += list.length; d.lateOpenings += late; d.registers += 1
    d.cashDifferenceKwd += list.reduce((s, x) => s + Math.abs(Number(x.cash_register_difference) || 0), 0)
    discipline.set(loc, d)
  }
  const sessionLoc = new Map(sessions.map((s) => [s.id, locationOfConfig(m2oId(s.config_id))]))
  const baseDates = [['date_order', '>=', `${PERIOD.from} 00:00:00`], ['date_order', '<', `${PERIOD.to} 00:00:00`], ['session_id.config_id', 'in', ALLOWED]]
  const refundGroups = await safe('pos.order read_group refunds', () => ek('pos.order', 'read_group', [[...baseDates, ['state', 'in', ['paid', 'done', 'invoiced']], ['amount_total', '<', 0]], ['amount_total:sum'], ['session_id']], { lazy: false }), [])
  const cancelGroups = await safe('pos.order read_group cancelled', () => ek('pos.order', 'read_group', [[...baseDates, ['state', '=', 'cancel']], ['amount_total:sum'], ['session_id']], { lazy: false }), [])
  const refundByLoc = new Map()
  for (const g of refundGroups) { const loc = sessionLoc.get(m2oId(g.session_id)); if (!RESTAURANT_IDS.includes(loc)) continue; const a = refundByLoc.get(loc) || { location: loc, refundOrders: 0, refundKwd: 0, cancelledOrders: 0 }; a.refundOrders += g.__count || 0; a.refundKwd += Math.abs(g.amount_total || 0); refundByLoc.set(loc, a) }
  for (const g of cancelGroups) { const loc = sessionLoc.get(m2oId(g.session_id)); if (!RESTAURANT_IDS.includes(loc)) continue; const a = refundByLoc.get(loc) || { location: loc, refundOrders: 0, refundKwd: 0, cancelledOrders: 0 }; a.cancelledOrders += g.__count || 0; refundByLoc.set(loc, a) }
  const sessionsOut = [...discipline.values()].map((d) => ({ ...d, cashDifferenceKwd: r3(d.cashDifferenceKwd) }))
  const refunds = [...refundByLoc.values()].map((r) => ({ ...r, refundKwd: r3(r.refundKwd) }))
  console.log(`■ Sessions: ${sessionsOut.reduce((s, x) => s + x.sessions, 0)} · late openings ${sessionsOut.reduce((s, x) => s + x.lateOpenings, 0)} · refunds ${refunds.reduce((s, x) => s + x.refundOrders, 0)}`)

  /* ───────────── 5. Rent & maintenance per location (analytic lines) ───────────── */
  const locAnalytic = {}
  for (const id of RESTAURANT_IDS) { const l = REGISTRY.locations[id]; for (const a of l.analyticIds ?? (l.analyticId ? [l.analyticId] : [])) locAnalytic[a] = id }
  const costRows = await safe('account.analytic.line read_group (costs)', () => ek('account.analytic.line', 'read_group', [[['date', '>=', PERIOD.from], ['date', '<', PERIOD.to], ['account_id', 'in', Object.keys(locAnalytic).map(Number)]], ['amount:sum'], ['account_id', 'general_account_id']], { lazy: false }), [])
  const accIds = [...new Set(costRows.map((g) => m2oId(g.general_account_id)).filter(Boolean))]
  const accounts = accIds.length ? await safe('account.account read (costs)', () => readMany('account.account', accIds, ['id', 'name', 'code', 'account_type']), []) : []
  const accById = new Map(accounts.map((a) => [a.id, a]))
  const RENT = /rent|lease|إيجار|ايجار|أجار|اجار/i
  const MAINT = /maint|repair|صيان|تصليح/i
  const costByLoc = new Map()
  for (const g of costRows) {
    const loc = locAnalytic[m2oId(g.account_id)]
    const acc = accById.get(m2oId(g.general_account_id))
    if (!loc || !acc || !/^expense/.test(acc.account_type || '')) continue
    const amount = -(Number(g.amount) || 0)
    const c = costByLoc.get(loc) || { location: loc, rentKwd: 0, maintenanceKwd: 0, otherOpexKwd: 0, depreciationKwd: 0 }
    const name = `${acc.code ?? ''} ${acc.name ?? ''}`
    if (acc.account_type === 'expense_depreciation') c.depreciationKwd += amount
    else if (acc.account_type === 'expense_direct_cost') continue
    else if (RENT.test(name)) c.rentKwd += amount
    else if (MAINT.test(name)) c.maintenanceKwd += amount
    else c.otherOpexKwd += amount
    costByLoc.set(loc, c)
  }
  const locationCosts = [...costByLoc.values()].map((c) => ({ location: c.location, rentKwd: r3(c.rentKwd), maintenanceKwd: r3(c.maintenanceKwd), otherOpexKwd: r3(c.otherOpexKwd), depreciationKwd: r3(c.depreciationKwd) }))
  console.log(`■ Location costs: ${locationCosts.map((c) => `${c.location} rent ${c.rentKwd} · maint ${c.maintenanceKwd}`).join(' | ')}`)

  const intel = {
    source: ODOO_URL,
    syncedAt: new Date().toISOString(),
    period: PERIOD,
    recipes,
    theoretical,
    purchase: { windowDays: 120, linesRead: poLines.length, spendLast30Kwd: purchaseSpendLast30, priceCreep: priceCreep.slice(0, 40) },
    scrap,
    sessions: sessionsOut,
    refunds,
    locationCosts,
    issues: ISSUES,
  }
  fs.writeFileSync(OUT, JSON.stringify(intel, null, 2) + '\n')
  console.log(`\n✔ Intel written → ${path.relative(ROOT, OUT)} (aggregates only, no credentials)`)
  if (ISSUES.length) console.log(`■ ${ISSUES.length} query issue(s) logged in the file`)
}

main().catch((e) => { console.error(`✖ ${e.message}`); process.exit(1) })
