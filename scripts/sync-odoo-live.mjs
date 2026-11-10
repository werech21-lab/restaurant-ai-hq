#!/usr/bin/env node
/**
 * Live Odoo -> Aether BI synchronisation (positive pos.config ID whitelist).
 *
 * Reads ODOO_URL / ODOO_DB / ODOO_LOGIN / ODOO_API_KEY from .env.local (git-ignored), talks to
 * <ODOO_URL>/jsonrpc server-side and writes a credential-free snapshot to
 * src/lib/odoo-live-snapshot.json.
 *
 * Scope is controlled ONLY by src/lib/odoo/pos-registry.json:
 *   - allowedPosConfigIds  → the registers that exist for Aether BI (everything else is ignored)
 *   - locations            → restaurant locations (branch layer), EXB unit, school-canteen unit
 *   - brands               → the approved Venture Foods brands (root POS category per brand)
 *   - excludedBranchAnalyticIds → accounting analytic accounts removed from the P&L reconciliation
 *
 * Every Odoo query runs in its own try/catch; a missing read permission is logged and reported.
 *
 * Usage:
 *   node scripts/sync-odoo-live.mjs                          # previous full month
 *   node scripts/sync-odoo-live.mjs --from 2026-10-01 --to 2026-11-01
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SNAPSHOT = path.join(ROOT, 'src', 'lib', 'odoo-live-snapshot.json')
const REGISTRY = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'lib', 'odoo', 'pos-registry.json'), 'utf8'))
const ALLOWED = REGISTRY.allowedPosConfigIds
const ALLOWED_SET = new Set(ALLOWED)

/* ------------------------------------------------------------------ env */
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

const argv = process.argv.slice(2)
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
function defaultPeriod() {
  const now = new Date()
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 1, 1))
  const iso = (d) => d.toISOString().slice(0, 10)
  return { from: iso(from), to: iso(to) }
}
const PERIOD = { ...defaultPeriod(), ...(arg('--from') ? { from: arg('--from') } : {}), ...(arg('--to') ? { to: arg('--to') } : {}) }

function fail(msg) { console.error(`\n✖ ${msg}`); process.exit(1) }
for (const [k, v] of Object.entries({ ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_API_KEY })) if (!v) fail(`${k} is missing in .env.local`)

/* ------------------------------------------------------------------ rpc */
let rpcId = 0
async function rpc(service, method, args) {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: ++rpcId, params: { service, method, args } }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.error) { const e = new Error(json.error.data?.message || json.error.message || 'Odoo error'); e.odoo = json.error; throw e }
  return json.result
}
let UID = 0
const ek = (model, method, args = [], kwargs = {}) => rpc('object', 'execute_kw', [ODOO_DB, UID, ODOO_API_KEY, model, method, args, kwargs])
const MISSING_READ = new Map()
const isAccessError = (e) => /AccessError|access right|not allowed to access|AccessDenied|record rules/i.test(`${e.message} ${JSON.stringify(e.odoo ?? {})}`)
async function safe(label, fn, fallback) {
  try { return await fn() } catch (e) {
    const model = label.split(' ')[0]
    if (isAccessError(e)) { MISSING_READ.set(model, String(e.message).slice(0, 200)); console.warn(`  ⛔ no read permission on ${model} (${label})`) }
    else console.warn(`  ! ${label}: ${String(e.message).slice(0, 200)}`)
    return fallback
  }
}
const m2oId = (v) => (Array.isArray(v) ? v[0] : null)
const m2oName = (v) => (Array.isArray(v) ? v[1] : null)
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)

/* ------------------------------------------------------------- channels */
function channelOf(pm) {
  const n = (pm || '').toLowerCase()
  if (/talabat go/.test(n)) return 'Talabat Go'
  if (/talabat mp/.test(n)) return 'Talabat MP'
  if (/deliveroo go/.test(n)) return 'Deliveroo Go'
  if (/deliveroo mp/.test(n)) return 'Deliveroo MP'
  if (/keeta/.test(n)) return 'Keeta'
  if (/jahez/.test(n)) return 'Jahez'
  if (/cari/.test(n)) return 'Cari'
  if (/snoonu/.test(n)) return 'Snoonu'
  if (/bilbayt/.test(n)) return 'Bilbayt'
  if (/hesabe|hessabe|fatoorah|payment link/.test(n)) return 'Online payment link'
  if (/staff meal|complementary|ktest/.test(n)) return 'Staff & complimentary'
  if (/cash on delivery/.test(n)) return 'Cash on delivery'
  return 'Shop Sales'
}

async function main() {
  console.log(`▶ Odoo ${ODOO_URL} · db=${ODOO_DB} · period ${PERIOD.from} → ${PERIOD.to} (exclusive)`)
  const version = await safe('common version', () => rpc('common', 'version', []), {})
  UID = await rpc('common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}])
  if (!Number.isInteger(UID) || UID <= 0) fail('Authentication refused (check ODOO_LOGIN / ODOO_API_KEY / ODOO_DB).')
  console.log(`▶ Authenticated uid=${UID} · server ${version.server_version ?? '?'} · ${ALLOWED.length} whitelisted registers`)

  /* master data (whitelisted registers only) */
  const configs = await safe('pos.config search_read', () => ek('pos.config', 'search_read', [[['id', 'in', ALLOWED], ['active', 'in', [true, false]]]], { fields: ['id', 'name', 'active', 'company_id'], context: { active_test: false } }), [])
  const configById = new Map(configs.map((c) => [c.id, c]))
  const locationOfConfig = (id) => REGISTRY.registers[String(id)]?.location ?? null
  const posCategories = await safe('pos.category search_read', () => ek('pos.category', 'search_read', [[]], { fields: ['id', 'name', 'parent_id'] }), [])
  const catById = new Map(posCategories.map((c) => [c.id, c]))
  const rootOf = (id) => { let c = catById.get(id); let g = 0; while (c && c.parent_id && g++ < 10) c = catById.get(m2oId(c.parent_id)); return c ?? null }
  const brandByRoot = new Map(REGISTRY.brands.filter((b) => b.posRoot).map((b) => [b.posRoot, b]))
  const rootCatIdOfBrand = new Map(REGISTRY.brands.map((b) => [b.id, posCategories.find((c) => !c.parent_id && c.name === b.posRoot)?.id ?? null]))
  const payMethods = await safe('pos.payment.method search_read', () => ek('pos.payment.method', 'search_read', [[]], { fields: ['id', 'name'] }), [])
  const methodsOfChannel = new Map()
  for (const p of payMethods) { const ch = channelOf(p.name); methodsOfChannel.set(ch, [...(methodsOfChannel.get(ch) || []), p.id]) }

  const base = [['date_order', '>=', `${PERIOD.from} 00:00:00`], ['date_order', '<', `${PERIOD.to} 00:00:00`], ['state', 'in', ['paid', 'done', 'invoiced']], ['session_id.config_id', 'in', ALLOWED]]
  const lineBase = [['order_id.date_order', '>=', `${PERIOD.from} 00:00:00`], ['order_id.date_order', '<', `${PERIOD.to} 00:00:00`], ['order_id.state', 'in', ['paid', 'done', 'invoiced']], ['order_id.session_id.config_id', 'in', ALLOWED]]

  /* orders & net by register (via session) */
  const bySession = await safe('pos.order read_group session', () => ek('pos.order', 'read_group', [base, ['amount_total:sum', 'amount_tax:sum'], ['session_id']], { lazy: false }), [])
  const sessionIds = [...new Set(bySession.map((g) => m2oId(g.session_id)).filter(Boolean))]
  const sessions = sessionIds.length ? await safe('pos.session read', () => ek('pos.session', 'read', [sessionIds, ['id', 'config_id']]), []) : []
  const cfgOfSession = new Map(sessions.map((s) => [s.id, m2oId(s.config_id)]))
  const regAgg = new Map()
  for (const g of bySession) {
    const cfg = cfgOfSession.get(m2oId(g.session_id))
    if (!ALLOWED_SET.has(cfg)) continue
    const r = regAgg.get(cfg) || { orders: 0, net: 0 }
    r.orders += g.__count || 0
    r.net += (g.amount_total || 0) - (g.amount_tax || 0)
    regAgg.set(cfg, r)
  }
  const registers = [...regAgg.entries()].map(([id, r]) => ({ posConfigId: id, name: configById.get(id)?.name ?? `POS ${id}`, location: locationOfConfig(id), orders: r.orders, netKwd: r3(r.net) })).sort((a, b) => a.posConfigId - b.posConfigId)
  const totalNet = registers.reduce((s, r) => s + r.netKwd, 0)
  const totalOrders = registers.reduce((s, r) => s + r.orders, 0)

  /* product lines per register → brand & category */
  const linesByCfg = new Map()
  for (const r of registers) {
    linesByCfg.set(r.posConfigId, await safe(`pos.order.line read_group cfg ${r.posConfigId}`, () => ek('pos.order.line', 'read_group', [[...lineBase.slice(0, 3), ['order_id.session_id.config_id', '=', r.posConfigId]], ['price_subtotal:sum', 'qty:sum'], ['product_id']], { lazy: false }), []))
  }
  const productIds = [...new Set([...linesByCfg.values()].flat().map((g) => m2oId(g.product_id)).filter(Boolean))]
  const productInfo = productIds.length ? await safe('product.product read', () => ek('product.product', 'read', [productIds, ['id', 'pos_categ_id', 'lst_price']]), []) : []
  // Product cost is a restricted field in Odoo; read it separately so a missing right never breaks the brand mapping.
  const productCost = productIds.length ? await safe('product.product standard_price', () => ek('product.product', 'read', [productIds, ['id', 'standard_price']]), []) : []
  const costOfProduct = new Map(productCost.map((p) => [p.id, Number(p.standard_price) || 0]))
  const catOfProduct = new Map(productInfo.map((p) => [p.id, m2oId(p.pos_categ_id)]))
  const priceOfProduct = new Map(productInfo.map((p) => [p.id, { list: Number(p.lst_price) || 0, cost: costOfProduct.get(p.id) ?? 0 }]))
  const brandOfProduct = (pid) => { const root = rootOf(catOfProduct.get(pid)); return root ? brandByRoot.get(root.name)?.id ?? (root.name === 'Admin' ? null : 'uncategorised') : 'uncategorised' }

  const brandNet = new Map(); const brandQty = new Map(); const locBrandNet = new Map(); const productAgg = new Map(); const catAgg = new Map()
  let promoAdjustments = 0
  for (const [cfg, rows] of linesByCfg) {
    const loc = locationOfConfig(cfg)
    for (const g of rows) {
      const pid = m2oId(g.product_id)
      const brand = brandOfProduct(pid)
      const net = Number(g.price_subtotal) || 0
      const qty = Number(g.qty) || 0
      if (brand === null) continue
      if (brand === 'uncategorised') { promoAdjustments += net; continue }
      brandNet.set(brand, (brandNet.get(brand) || 0) + net)
      brandQty.set(brand, (brandQty.get(brand) || 0) + qty)
      const k = `${loc}|${brand}`
      locBrandNet.set(k, (locBrandNet.get(k) || 0) + net)
      const p = productAgg.get(pid) || { productId: pid, name: m2oName(g.product_id), brand, category: catById.get(catOfProduct.get(pid))?.name ?? 'Other', listPrice: r3(priceOfProduct.get(pid)?.list), unitCost: r3(priceOfProduct.get(pid)?.cost), qty: 0, netKwd: 0 }
      p.qty += qty; p.netKwd += net; productAgg.set(pid, p)
      const catName = catById.get(catOfProduct.get(pid))?.name ?? 'Other'
      const ck = `${brand}|${catName}`
      const c = catAgg.get(ck) || { brand, name: catName, qty: 0, netKwd: 0 }
      c.qty += qty; c.netKwd += net; catAgg.set(ck, c)
    }
  }

  /* real order counts: orders containing at least one item of the brand (overall, per location, per channel) */
  const locIds = [...new Set(registers.map((r) => r.location))]
  const cfgsOfLoc = (loc) => ALLOWED.filter((id) => locationOfConfig(id) === loc)
  const brandOrders = new Map(); const locBrandOrders = new Map()
  for (const b of REGISTRY.brands) {
    const root = rootCatIdOfBrand.get(b.id)
    if (!root || !(brandNet.get(b.id) > 0)) continue
    brandOrders.set(b.id, await safe(`pos.order search_count brand ${b.id}`, () => ek('pos.order', 'search_count', [[...base, ['lines.product_id.pos_categ_id', 'child_of', root]]]), 0))
    for (const loc of locIds) {
      if (!(locBrandNet.get(`${loc}|${b.id}`) > 0)) continue
      locBrandOrders.set(`${loc}|${b.id}`, await safe(`pos.order search_count ${b.id}@${loc}`, () => ek('pos.order', 'search_count', [[...base.slice(0, 3), ['session_id.config_id', 'in', cfgsOfLoc(loc)], ['lines.product_id.pos_categ_id', 'child_of', root]]]), 0))
    }
  }

  /* payments → channels (overall, per location) */
  const byPayment = await safe('pos.payment read_group', () => ek('pos.payment', 'read_group', [[['pos_order_id.date_order', '>=', `${PERIOD.from} 00:00:00`], ['pos_order_id.date_order', '<', `${PERIOD.to} 00:00:00`], ['pos_order_id.state', 'in', ['paid', 'done', 'invoiced']], ['session_id.config_id', 'in', ALLOWED]], ['amount:sum'], ['session_id', 'payment_method_id']], { lazy: false }), [])
  const paySessionIds = [...new Set(byPayment.map((g) => m2oId(g.session_id)).filter((id) => id && !cfgOfSession.has(id)))]
  if (paySessionIds.length) for (const s of await safe('pos.session read (payments)', () => ek('pos.session', 'read', [paySessionIds, ['id', 'config_id']]), [])) cfgOfSession.set(s.id, m2oId(s.config_id))
  const channelAgg = new Map(); const locChannel = new Map(); const methodAgg = new Map()
  for (const g of byPayment) {
    const cfg = cfgOfSession.get(m2oId(g.session_id))
    if (!ALLOWED_SET.has(cfg)) continue
    const loc = locationOfConfig(cfg)
    const pm = m2oName(g.payment_method_id) || 'Unknown'
    const ch = channelOf(pm)
    const amt = Number(g.amount) || 0
    const c = channelAgg.get(ch) || { name: ch, amountKwd: 0, payments: 0 }
    c.amountKwd += amt; c.payments += g.__count || 0; channelAgg.set(ch, c)
    const lk = `${loc}|${ch}`
    const l = locChannel.get(lk) || { location: loc, channel: ch, amountKwd: 0, payments: 0 }
    l.amountKwd += amt; l.payments += g.__count || 0; locChannel.set(lk, l)
    const m = methodAgg.get(pm) || { name: pm, channel: ch, amountKwd: 0, payments: 0 }
    m.amountKwd += amt; m.payments += g.__count || 0; methodAgg.set(pm, m)
  }

  /* brand × channel: lines of orders paid through the channel's payment methods (orders with split tenders count once per channel) */
  const brandChannel = []
  for (const [ch, methodIds] of methodsOfChannel) {
    if (!channelAgg.has(ch)) continue
    const rows = await safe(`pos.order.line read_group channel ${ch}`, () => ek('pos.order.line', 'read_group', [[...lineBase, ['order_id.payment_ids.payment_method_id', 'in', methodIds]], ['price_subtotal:sum'], ['product_id']], { lazy: false }), [])
    const per = new Map()
    for (const g of rows) { const b = brandOfProduct(m2oId(g.product_id)); if (b && b !== 'uncategorised') per.set(b, (per.get(b) || 0) + (Number(g.price_subtotal) || 0)) }
    for (const [b, net] of per) {
      if (net <= 0) continue
      const root = rootCatIdOfBrand.get(b)
      const orders = root ? await safe(`pos.order search_count ${b}/${ch}`, () => ek('pos.order', 'search_count', [[...base, ['payment_ids.payment_method_id', 'in', methodIds], ['lines.product_id.pos_categ_id', 'child_of', root]]]), 0) : 0
      brandChannel.push({ brand: b, channel: ch, netKwd: r3(net), orders })
    }
  }

  /* brand × location × channel net cube (lines of orders at the location paid through the channel) */
  const cube = []
  for (const loc of locIds) {
    for (const [ch, methodIds] of methodsOfChannel) {
      if (!locChannel.has(`${loc}|${ch}`)) continue
      const rows = await safe(`pos.order.line read_group cube ${loc}/${ch}`, () => ek('pos.order.line', 'read_group', [[...lineBase.slice(0, 3), ['order_id.session_id.config_id', 'in', cfgsOfLoc(loc)], ['order_id.payment_ids.payment_method_id', 'in', methodIds]], ['price_subtotal:sum'], ['product_id']], { lazy: false }), [])
      const per = new Map()
      for (const g of rows) { const b = brandOfProduct(m2oId(g.product_id)); if (b && b !== 'uncategorised') per.set(b, (per.get(b) || 0) + (Number(g.price_subtotal) || 0)) }
      for (const [b, net] of per) if (net > 0) cube.push({ brand: b, location: loc, channel: ch, netKwd: r3(net) })
    }
  }

  /* time profile: every whitelisted order's timestamp (Odoo stores UTC; Kuwait = UTC+3) */
  const orderTimes = await safe('pos.order search_read times', () => ek('pos.order', 'search_read', [base], { fields: ['date_order', 'amount_total', 'amount_tax'], limit: 200000 }), [])
  const daily = {}; const hourly = Array.from({ length: 24 }, () => ({ orders: 0, netKwd: 0 })); const weekHour = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ orders: 0, netKwd: 0 })))
  for (const o of orderTimes) {
    const t = new Date(String(o.date_order).replace(' ', 'T') + 'Z')
    const k = new Date(t.getTime() + 3 * 3600 * 1000)
    const day = k.toISOString().slice(0, 10)
    const h = k.getUTCHours()
    const dow = (k.getUTCDay() + 6) % 7 // Monday = 0
    const net = (Number(o.amount_total) || 0) - (Number(o.amount_tax) || 0)
    const d = (daily[day] ||= { orders: 0, netKwd: 0 }); d.orders++; d.netKwd += net
    hourly[h].orders++; hourly[h].netKwd += net
    weekHour[dow][h].orders++; weekHour[dow][h].netKwd += net
  }
  const timeProfile = {
    daily: Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, orders: v.orders, netKwd: r3(v.netKwd) })),
    hourly: hourly.map((v, hour) => ({ hour, orders: v.orders, netKwd: r3(v.netKwd) })),
    weekHour: weekHour.map((row) => row.map((v) => [v.orders, r3(v.netKwd)])),
  }

  /* discounts (discounted lines only; not groupable server-side) */
  const discLines = await safe('pos.order.line discounted', () => ek('pos.order.line', 'search_read', [[...lineBase, ['discount', '>', 0]], ], { fields: ['price_unit', 'qty', 'discount', 'product_id'], limit: 300000 }), [])
  let discountKwd = 0; const brandDiscount = new Map()
  for (const l of discLines) {
    const d = (Number(l.price_unit) || 0) * (Number(l.qty) || 0) * ((Number(l.discount) || 0) / 100)
    discountKwd += d
    const b = brandOfProduct(m2oId(l.product_id))
    if (b && b !== 'uncategorised') brandDiscount.set(b, (brandDiscount.get(b) || 0) + d)
  }

  /* accounting: posted P&L (company ledger) and the excluded locations' analytic share */
  const aml = await safe('account.move.line read_group', () => ek('account.move.line', 'read_group', [[['date', '>=', PERIOD.from], ['date', '<', PERIOD.to], ['parent_state', '=', 'posted']], ['balance:sum'], ['account_id']], { lazy: false }), [])
  const accIds = aml.map((g) => m2oId(g.account_id)).filter(Boolean)
  const accounts = accIds.length ? await safe('account.account read', () => ek('account.account', 'read', [accIds, ['id', 'account_type']]), []) : []
  const typeOf = new Map(accounts.map((a) => [a.id, a.account_type]))
  const TYPES = { income: 'income', income_other: 'otherIncome', expense_direct_cost: 'cogs', expense: 'expense', expense_depreciation: 'depreciation' }
  const posted = { income: 0, otherIncome: 0, cogs: 0, expense: 0, depreciation: 0 }
  for (const g of aml) { const t = TYPES[typeOf.get(m2oId(g.account_id))]; if (t) posted[t] += t === 'income' || t === 'otherIncome' ? -(g.balance || 0) : g.balance || 0 }
  const aal = await safe('account.analytic.line read_group', () => ek('account.analytic.line', 'read_group', [[['date', '>=', PERIOD.from], ['date', '<', PERIOD.to], ['account_id', 'in', REGISTRY.excludedBranchAnalyticIds]], ['amount:sum'], ['general_account_id']], { lazy: false }), [])
  const aalAccIds = aal.map((g) => m2oId(g.general_account_id)).filter((id) => id && !typeOf.has(id))
  if (aalAccIds.length) for (const a of await safe('account.account read (analytic)', () => ek('account.account', 'read', [aalAccIds, ['id', 'account_type']]), [])) typeOf.set(a.id, a.account_type)
  const excluded = { income: 0, otherIncome: 0, cogs: 0, expense: 0, depreciation: 0 }
  for (const g of aal) { const t = TYPES[typeOf.get(m2oId(g.general_account_id))]; if (t) excluded[t] += t === 'income' || t === 'otherIncome' ? g.amount || 0 : -(g.amount || 0) }
  const journals = await safe('account.move.line read_group journal', () => ek('account.move.line', 'read_group', [[['date', '>=', PERIOD.from], ['date', '<', PERIOD.to], ['parent_state', '=', 'posted'], ['account_id.account_type', 'in', ['income', 'income_other']]], ['balance:sum'], ['journal_id']], { lazy: false }), [])
  const saleOrders = await safe('sale.order read_group', () => ek('sale.order', 'read_group', [[['date_order', '>=', `${PERIOD.from} 00:00:00`], ['date_order', '<', `${PERIOD.to} 00:00:00`], ['state', 'in', ['sale', 'done']]], ['amount_untaxed:sum'], []], { lazy: false }), [])
  const whitelisted = Object.fromEntries(Object.keys(posted).map((k) => [k, r3(posted[k] - excluded[k])]))

  /* per-location P&L from the Branches analytic plan (real cost centres; shared costs reported separately) */
  const locAnalytic = {}
  for (const [id, l] of Object.entries(REGISTRY.locations)) for (const a of l.analyticIds ?? (l.analyticId ? [l.analyticId] : [])) locAnalytic[a] = id
  for (const [id, a] of Object.entries(REGISTRY.sharedCostAnalyticIds ?? {})) locAnalytic[a] = `shared:${id}`
  const plRows = await safe('account.analytic.line read_group locations', () => ek('account.analytic.line', 'read_group', [[['date', '>=', PERIOD.from], ['date', '<', PERIOD.to], ['account_id', 'in', Object.keys(locAnalytic).map(Number)]], ['amount:sum'], ['account_id', 'general_account_id']], { lazy: false }), [])
  const plAccIds = plRows.map((g) => m2oId(g.general_account_id)).filter((id) => id && !typeOf.has(id))
  if (plAccIds.length) for (const a of await safe('account.account read (locations)', () => ek('account.account', 'read', [[...new Set(plAccIds)], ['id', 'account_type']]), [])) typeOf.set(a.id, a.account_type)
  const locationPnl = {}
  for (const g of plRows) {
    const key = locAnalytic[m2oId(g.account_id)]
    const t = TYPES[typeOf.get(m2oId(g.general_account_id))]
    if (!key || !t) continue
    const p = (locationPnl[key] ||= { income: 0, otherIncome: 0, cogs: 0, expense: 0, depreciation: 0 })
    p[t] += t === 'income' || t === 'otherIncome' ? g.amount || 0 : -(g.amount || 0)
  }
  for (const p of Object.values(locationPnl)) { for (const k of Object.keys(p)) p[k] = r3(p[k]); p.operatingProfit = r3(p.income + p.otherIncome - p.cogs - p.expense - p.depreciation) }

  /* assemble */
  const L = REGISTRY.locations
  const locations = locIds.map((id) => {
    const regs = registers.filter((r) => r.location === id)
    const net = regs.reduce((s, r) => s + r.netKwd, 0)
    const orders = regs.reduce((s, r) => s + r.orders, 0)
    return {
      id, en: L[id]?.en ?? id, ar: L[id]?.ar ?? id, code: L[id]?.code ?? id, unit: L[id]?.unit ?? 'restaurant',
      netKwd: r3(net), orders, aovKwd: orders ? r3(net / orders) : 0, sharePct: pct(net, totalNet),
      registers: regs.map((r) => r.posConfigId),
      brands: REGISTRY.brands.map((b) => ({ brand: b.id, netKwd: r3(locBrandNet.get(`${id}|${b.id}`) || 0), orders: locBrandOrders.get(`${id}|${b.id}`) || 0 })).filter((x) => x.netKwd > 0),
      channels: [...locChannel.values()].filter((c) => c.location === id).map((c) => ({ channel: c.channel, amountKwd: r3(c.amountKwd), payments: c.payments })).sort((a, b) => b.amountKwd - a.amountKwd),
    }
  }).sort((a, b) => b.netKwd - a.netKwd)
  const brandItemTotal = [...brandNet.values()].reduce((s, v) => s + v, 0)
  const brands = REGISTRY.brands.map((b) => {
    const net = brandNet.get(b.id) || 0
    const orders = brandOrders.get(b.id) || 0
    return { id: b.id, en: b.en, ar: b.ar, posRoot: b.posRoot, netKwd: r3(net), orders, aovKwd: orders ? r3(net / orders) : 0, qty: r3(brandQty.get(b.id) || 0), sharePct: pct(net, brandItemTotal), discountKwd: r3(brandDiscount.get(b.id) || 0) }
  })

  const snapshot = {
    source: ODOO_URL,
    database: ODOO_DB,
    serverVersion: version.server_version ?? null,
    syncedAt: new Date().toISOString(),
    period: PERIOD,
    scope: { allowedPosConfigIds: ALLOWED, brands: REGISTRY.brands.map((b) => b.id) },
    totals: { netSalesKwd: r3(totalNet), orders: totalOrders, aovKwd: totalOrders ? r3(totalNet / totalOrders) : 0, brandItemsKwd: r3(brandItemTotal), promoAdjustmentsKwd: r3(promoAdjustments), discountKwd: r3(discountKwd), productsSold: productAgg.size },
    registers,
    locations,
    brands,
    channels: [...channelAgg.values()].map((c) => ({ ...c, amountKwd: r3(c.amountKwd) })).sort((a, b) => b.amountKwd - a.amountKwd),
    brandChannel,
    cube,
    timeProfile,
    paymentMethods: [...methodAgg.values()].map((m) => ({ ...m, amountKwd: r3(m.amountKwd) })).sort((a, b) => b.amountKwd - a.amountKwd),
    categories: [...catAgg.values()].map((c) => ({ ...c, netKwd: r3(c.netKwd) })).sort((a, b) => b.netKwd - a.netKwd),
    products: [...productAgg.values()].map((p) => ({ ...p, netKwd: r3(p.netKwd) })).filter((p) => p.qty > 0 && p.netKwd > 0).sort((a, b) => b.netKwd - a.netKwd),
    accounting: {
      postedCompany: Object.fromEntries(Object.entries(posted).map(([k, v]) => [k, r3(v)])),
      excludedLocationsAnalytic: Object.fromEntries(Object.entries(excluded).map(([k, v]) => [k, r3(v)])),
      whitelisted,
      locationPnl,
      incomeByJournal: journals.map((g) => ({ journal: m2oName(g.journal_id), lines: g.__count, incomeKwd: r3(-(g.balance || 0)) })),
      saleOrders: { count: saleOrders[0]?.__count ?? 0, untaxedKwd: r3(saleOrders[0]?.amount_untaxed ?? 0) },
    },
    permissions: { missingRead: [...MISSING_READ.keys()] },
  }

  console.log(`\n■ Whitelisted POS: ${snapshot.totals.netSalesKwd} KWD · ${totalOrders} orders · AOV ${snapshot.totals.aovKwd} · promo/discount lines ${snapshot.totals.promoAdjustmentsKwd} · line discounts ${snapshot.totals.discountKwd}`)
  console.log('\n■ Locations:')
  for (const l of locations) console.log(`   - [${l.unit}] ${l.en.padEnd(34)} ${l.netKwd.toFixed(3).padStart(12)} KWD ${String(l.orders).padStart(6)} orders  ${l.sharePct}%  regs ${l.registers.join(',')}`)
  console.log('\n■ Brands:')
  for (const b of brands) console.log(`   - ${b.en.padEnd(22)} ${b.netKwd.toFixed(3).padStart(12)} KWD ${String(b.orders).padStart(6)} orders  AOV ${b.aovKwd}  ${b.sharePct}%`)
  console.log('\n■ Channels:', snapshot.channels.map((c) => `${c.name}=${c.amountKwd}`).join(' | '))
  console.log('\n■ Accounting (posted):', snapshot.accounting.postedCompany)
  console.log('■ Excluded locations (analytic):', snapshot.accounting.excludedLocationsAnalytic)
  console.log('■ Whitelisted accounting:', whitelisted)
  console.log('■ Location P&L (analytic):', Object.entries(locationPnl).map(([k, p]) => `${k}: rev ${p.income} · cogs ${p.cogs} · opex ${p.expense} · dep ${p.depreciation} · op ${p.operatingProfit}`).join('\n   '))
  console.log('■ Income by journal:', snapshot.accounting.incomeByJournal.map((j) => `${j.journal}=${j.incomeKwd}`).join(' | '), '· sale.order', snapshot.accounting.saleOrders)

  fs.writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`\n✔ Snapshot written → ${path.relative(ROOT, SNAPSHOT)} (no credentials stored)`)
  if (MISSING_READ.size) { console.log('\n■ Missing Odoo read permissions:'); for (const [m, msg] of MISSING_READ) console.log(`   - ${m}: ${msg}`) }
  else console.log('■ Permissions: the service user could read every queried model.')
}

main().catch((e) => fail(e.message))
