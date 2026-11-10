#!/usr/bin/env node
/**
 * Live Odoo -> Aether BI synchronisation & schema inspection.
 *
 * Reads ODOO_URL / ODOO_DB / ODOO_LOGIN / ODOO_API_KEY from .env.local (git-ignored),
 * talks to <ODOO_URL>/jsonrpc server-side, prints the real brands, branches, channels and
 * menu items, and writes a credential-free snapshot to src/lib/odoo-live-snapshot.json.
 *
 * Usage:
 *   node scripts/sync-odoo-live.mjs                     # discover + sync (period = previous full month)
 *   node scripts/sync-odoo-live.mjs --from 2026-10-01 --to 2026-11-01
 *   node scripts/sync-odoo-live.mjs --discover-only     # schema inspection, no snapshot write
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SNAPSHOT = path.join(ROOT, 'src', 'lib', 'odoo-live-snapshot.json')
const EXCLUDED_BRANCH = /jahra|الجهراء|qurain|القرين/i

/* ------------------------------------------------------------------ env */
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {}
  const out = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    out[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return out
}
const fileEnv = loadEnvFile(path.join(ROOT, '.env.local'))
const env = (k) => process.env[k] || fileEnv[k] || ''
const ODOO_URL = env('ODOO_URL').replace(/\/+$/, '')
const ODOO_LOGIN = env('ODOO_LOGIN')
const ODOO_API_KEY = env('ODOO_API_KEY')
let ODOO_DB = env('ODOO_DB')

const argv = process.argv.slice(2)
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
const DISCOVER_ONLY = argv.includes('--discover-only')

function defaultPeriod() {
  const now = new Date()
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 1, 1))
  const iso = (d) => d.toISOString().slice(0, 10)
  return { from: iso(from), to: iso(to) }
}
const PERIOD = { ...defaultPeriod(), ...(arg('--from') ? { from: arg('--from') } : {}), ...(arg('--to') ? { to: arg('--to') } : {}) }

function fail(msg) {
  console.error(`\n✖ ${msg}`)
  process.exit(1)
}
if (!ODOO_URL) fail('ODOO_URL is missing in .env.local')
if (!ODOO_API_KEY) fail('ODOO_API_KEY is missing in .env.local')

/* ------------------------------------------------------------------ rpc */
let rpcId = 0
async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).pathname}`)
  const json = await res.json()
  if (json.error) {
    const e = new Error(json.error.data?.message || json.error.message || 'Odoo error')
    e.odoo = json.error
    throw e
  }
  return json.result
}
const rpc = (service, method, args) => post(`${ODOO_URL}/jsonrpc`, { jsonrpc: '2.0', method: 'call', id: ++rpcId, params: { service, method, args } })

let UID = 0
const ek = (model, method, args = [], kwargs = {}) => rpc('object', 'execute_kw', [ODOO_DB, UID, ODOO_API_KEY, model, method, args, kwargs])

/** Models the service user could not read (ACL / record rules), reported at the end of the run. */
const MISSING_READ = new Map()
const isAccessError = (e) => /AccessError|access right|not allowed to access|AccessDenied|record rules|Access Denied/i.test(`${e.message} ${JSON.stringify(e.odoo ?? {})}`)

/**
 * Every Odoo query runs in its own try/catch. An ACL failure on one model is logged and recorded,
 * and the sync continues with everything that is readable.
 */
async function safe(label, fn, fallback) {
  try {
    return await fn()
  } catch (e) {
    const model = label.split(' ')[0]
    if (isAccessError(e)) {
      MISSING_READ.set(model, String(e.message).slice(0, 200))
      console.warn(`  ⛔ no read permission on ${model} (${label})`)
    } else {
      console.warn(`  ! ${label}: ${String(e.message).slice(0, 200)}`)
    }
    return fallback
  }
}

/* ------------------------------------------------------------ discovery */
async function resolveDatabase() {
  if (ODOO_DB) return ODOO_DB
  const viaService = await safe('db.list', () => rpc('db', 'list', []), null)
  if (Array.isArray(viaService) && viaService.length) return viaService[0]
  const viaWeb = await safe('/web/database/list', () => post(`${ODOO_URL}/web/database/list`, { jsonrpc: '2.0', method: 'call', params: {} }), null)
  if (Array.isArray(viaWeb) && viaWeb.length) return viaWeb[0]
  const html = await safe('/web/login', async () => (await fetch(`${ODOO_URL}/web/login`)).text(), '')
  const m = html.match(/"db"\s*:\s*"([^"]+)"/) || html.match(/name="db"\s+value="([^"]+)"/)
  return m ? m[1] : 'venturefoods'
}

const m2oName = (v) => (Array.isArray(v) ? v[1] : null)
const m2oId = (v) => (Array.isArray(v) ? v[0] : null)
const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000

async function main() {
  console.log(`▶ Odoo host  : ${ODOO_URL}`)
  const version = await safe('version', () => rpc('common', 'version', []), {})
  console.log(`▶ Server     : ${version.server_version ?? 'unknown'}`)
  ODOO_DB = await resolveDatabase()
  console.log(`▶ Database   : ${ODOO_DB}`)
  if (!ODOO_LOGIN) fail('ODOO_LOGIN is empty in .env.local — set the login (email) of the user that owns the API key, then re-run.')

  UID = await rpc('common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}])
  if (!Number.isInteger(UID) || UID <= 0) fail('Authentication refused (check ODOO_LOGIN / ODOO_API_KEY / ODOO_DB).')
  console.log(`▶ Authenticated uid=${UID}`)

  /* 1. installed models relevant to brands / branches / channels */
  const CANDIDATES = ['pos.config', 'pos.session', 'pos.order', 'pos.order.line', 'pos.payment', 'pos.payment.method', 'pos.category',
    'res.company', 'stock.warehouse', 'crm.team', 'account.analytic.account', 'account.analytic.plan', 'product.brand', 'product.product',
    'product.template', 'product.category', 'sale.order', 'account.move.line', 'account.account']
  const models = await safe('ir.model search_read', () => ek('ir.model', 'search_read', [['|', ['model', 'in', CANDIDATES], ['model', 'ilike', 'brand']]], { fields: ['model', 'name'], limit: 200 }), null)
  // If ir.model itself is not readable, probe every candidate directly (each probe is guarded).
  const installed = new Set(models ? models.map((m) => m.model) : CANDIDATES)
  console.log('\n■ Installed candidate models:')
  if (models) for (const m of models) console.log(`   - ${m.model.padEnd(28)} ${m.name}`)
  else console.log('   (ir.model not readable — probing candidates one by one)')
  const readable = {}
  for (const model of CANDIDATES.filter((m) => installed.has(m))) {
    const n = await safe(`${model} search_count`, () => ek(model, 'search_count', [[]]), null)
    readable[model] = n
    console.log(`   · ${model.padEnd(28)} ${n === null ? 'NOT READABLE' : `${n} records`}`)
  }

  /* 2. brand-ish fields on pos.config / product.template */
  const brandFields = {}
  for (const model of ['pos.config', 'product.template', 'pos.order', 'res.company']) {
    if (!installed.has(model)) continue
    const fields = await safe(`fields_get ${model}`, () => ek(model, 'fields_get', [], { attributes: ['string', 'type', 'relation'] }), {})
    const hits = Object.entries(fields).filter(([k, f]) => /brand|x_/i.test(k) || /brand|علامة/i.test(f.string || ''))
    brandFields[model] = hits.map(([k, f]) => ({ field: k, label: f.string, type: f.type, relation: f.relation ?? null }))
    if (hits.length) console.log(`\n■ Brand-like fields on ${model}:`, brandFields[model])
  }

  /* 3. companies, POS configs, warehouses, analytic accounts, teams */
  const companies = await safe('res.company', () => ek('res.company', 'search_read', [[]], { fields: ['id', 'name', 'currency_id'] }), [])
  const posConfigMeta = installed.has('pos.config') ? await safe('pos.config fields_get', () => ek('pos.config', 'fields_get', [], { attributes: ['type'] }), {}) : {}
  const posConfigFields = ['id', 'name', 'active', 'company_id', 'crm_team_id', 'picking_type_id', 'payment_method_ids', 'iface_available_categ_ids', 'warehouse_id']
    .filter((f) => f === 'id' || f in posConfigMeta)
  const posConfigs = installed.has('pos.config')
    ? await safe('pos.config', () => ek('pos.config', 'search_read', [['|', ['active', '=', true], ['active', '=', false]]], { fields: posConfigFields, context: { active_test: false } }), [])
    : []
  // POS config → warehouse via its operation type (Odoo 16 has no direct warehouse field on pos.config)
  const warehouses = installed.has('stock.warehouse') ? await safe('stock.warehouse', () => ek('stock.warehouse', 'search_read', [[]], { fields: ['id', 'name', 'code', 'company_id'] }), []) : []
  const analytic = installed.has('account.analytic.account') ? await safe('analytic', () => ek('account.analytic.account', 'search_read', [[]], { fields: ['id', 'name', 'code', 'plan_id', 'company_id'] }), []) : []
  const teams = installed.has('crm.team') ? await safe('crm.team', () => ek('crm.team', 'search_read', [[]], { fields: ['id', 'name', 'company_id'] }), []) : []
  const payMethods = installed.has('pos.payment.method') ? await safe('pos.payment.method', () => ek('pos.payment.method', 'search_read', [[]], { fields: ['id', 'name', 'company_id', 'journal_id'] }), []) : []
  const posCategories = installed.has('pos.category') ? await safe('pos.category', () => ek('pos.category', 'search_read', [[]], { fields: ['id', 'name', 'parent_id'] }), []) : []
  const brandModel = [...installed].find((m) => /brand/.test(m) && m !== 'pos.config')
  const brandRecords = brandModel ? await safe(brandModel, () => ek(brandModel, 'search_read', [[]], { fields: ['id', 'name'] }), []) : []
  // Product catalogue: templates carry the brand/category, variants carry the sales lines.
  const tmplBrandFields = (brandFields['product.template'] || []).filter((f) => ['many2one', 'char', 'selection'].includes(f.type)).map((f) => f.field)
  const templates = installed.has('product.template')
    ? await safe('product.template search_read', () => ek('product.template', 'search_read', [[['available_in_pos', '=', true]]], { fields: ['id', 'name', 'list_price', 'categ_id', 'pos_categ_id', ...tmplBrandFields], limit: 5000 }), [])
    : []
  const variantCount = installed.has('product.product')
    ? await safe('product.product search_count', () => ek('product.product', 'search_count', [[['available_in_pos', '=', true]]]), null)
    : null
  console.log(`\n■ POS menu items: ${templates.length} templates · ${variantCount ?? 'n/a'} variants`)

  console.log(`\n■ Companies (${companies.length}):`); companies.forEach((c) => console.log(`   - [${c.id}] ${c.name}`))
  console.log(`\n■ POS configurations (${posConfigs.length}):`); posConfigs.forEach((c) => console.log(`   - [${c.id}] ${c.name}${c.active === false ? ' (archived)' : ''}`))
  console.log(`\n■ Warehouses (${warehouses.length}):`); warehouses.forEach((w) => console.log(`   - [${w.id}] ${w.name} (${w.code})`))
  console.log(`\n■ Analytic accounts (${analytic.length}):`); analytic.slice(0, 80).forEach((a) => console.log(`   - [${a.id}] ${a.name} · plan=${m2oName(a.plan_id)}`))
  console.log(`\n■ Sales teams (${teams.length}):`); teams.forEach((t) => console.log(`   - [${t.id}] ${t.name}`))
  console.log(`\n■ POS payment methods / channels (${payMethods.length}):`); payMethods.forEach((p) => console.log(`   - [${p.id}] ${p.name}`))
  console.log(`\n■ POS categories (${posCategories.length}):`); posCategories.forEach((p) => console.log(`   - [${p.id}] ${p.name}${p.parent_id ? ` ⟵ ${m2oName(p.parent_id)}` : ''}`))
  if (brandModel) { console.log(`\n■ ${brandModel} (${brandRecords.length}):`); brandRecords.forEach((b) => console.log(`   - [${b.id}] ${b.name}`)) }

  if (DISCOVER_ONLY) { reportPermissions(); return }

  /* 4. period aggregates from POS
   * Odoo 16: pos.order.config_id is a non-stored related field, so everything is grouped by the
   * stored session_id and mapped session → POS config. Excluded branches are filtered by POS name. */
  console.log(`\n▶ Period ${PERIOD.from} → ${PERIOD.to} (exclusive)`)
  const configById = new Map(posConfigs.map((c) => [c.id, c]))
  const bannedIds = posConfigs.filter((c) => EXCLUDED_BRANCH.test(c.name)).map((c) => c.id)
  const isBanned = (cfgId) => bannedIds.includes(cfgId)
  const orderDomain = [['date_order', '>=', `${PERIOD.from} 00:00:00`], ['date_order', '<', `${PERIOD.to} 00:00:00`], ['state', 'in', ['paid', 'done', 'invoiced']]]
  const bySession = installed.has('pos.order')
    ? await safe('pos.order read_group by session', () => ek('pos.order', 'read_group', [orderDomain, ['amount_total:sum', 'amount_tax:sum'], ['session_id']], { lazy: false }), [])
    : []
  const byPayment = installed.has('pos.payment')
    ? await safe('pos.payment read_group', () => ek('pos.payment', 'read_group', [[['pos_order_id.date_order', '>=', `${PERIOD.from} 00:00:00`], ['pos_order_id.date_order', '<', `${PERIOD.to} 00:00:00`], ['pos_order_id.state', 'in', ['paid', 'done', 'invoiced']]], ['amount:sum'], ['session_id', 'payment_method_id']], { lazy: false }), [])
    : []
  const sessionIds = [...new Set([...bySession, ...byPayment].map((g) => m2oId(g.session_id)).filter(Boolean))]
  const sessions = sessionIds.length ? await safe('pos.session read', () => ek('pos.session', 'read', [sessionIds, ['id', 'config_id']]), []) : []
  const configOfSession = new Map(sessions.map((x) => [x.id, m2oId(x.config_id)]))

  // Physical branch = location in the POS name: "China Garden (Salmiya)", "Delivery (Salmyia)" → Salmiya
  const LOCATION_ALIAS = { salmyia: 'Salmiya', salmiya: 'Salmiya', kout: 'Al-Kout Mall', promenade: 'Promenade Mall', '360': '360 Mall', 'assima mall': 'Assima Mall', avenues: 'The Avenues', ardiya: 'Ardiya', 'ardiya temp': 'Ardiya' }
  const branchOf = (cfgName) => {
    const n = (cfgName || '').trim()
    if (/exebition|exhibition/i.test(n)) return 'Exhibitions (EXB)'
    if (/call center/i.test(n)) return 'Call Center'
    const m = n.match(/\(([^)]+)\)/) || n.match(/^China Garden\s*\(?(.+?)\)?$/i)
    if (m) { const key = m[1].trim().toLowerCase(); return LOCATION_ALIAS[key] ?? m[1].trim().replace(/\b\w/g, (c) => c.toUpperCase()) }
    return n
  }

  const perConfig = new Map()
  let excluded = { configs: new Set(), net: 0, orders: 0 }
  for (const g of bySession) {
    const cfgId = configOfSession.get(m2oId(g.session_id))
    const net = (Number(g.amount_total) || 0) - (Number(g.amount_tax) || 0)
    const orders = g.__count ?? 0
    if (isBanned(cfgId)) { excluded.configs.add(cfgId); excluded.net += net; excluded.orders += orders; continue }
    const p = perConfig.get(cfgId) || { posConfigId: cfgId, name: configById.get(cfgId)?.name ?? `POS ${cfgId}`, orders: 0, net: 0 }
    p.orders += orders
    p.net += net
    perConfig.set(cfgId, p)
  }
  const posTotals = [...perConfig.values()].map((p) => ({ posConfigId: p.posConfigId, name: p.name, branch: branchOf(p.name), orders: p.orders, netSalesKwd: round3(p.net) })).sort((a, b) => b.netSalesKwd - a.netSalesKwd)
  const branchAgg = new Map()
  for (const p of posTotals) {
    const b = branchAgg.get(p.branch) || { name: p.branch, posConfigs: [], orders: 0, netSalesKwd: 0 }
    b.posConfigs.push(p.name)
    b.orders += p.orders
    b.netSalesKwd += p.netSalesKwd
    branchAgg.set(p.branch, b)
  }
  const totalNet = posTotals.reduce((x, b) => x + b.netSalesKwd, 0)
  const totalOrders = posTotals.reduce((x, b) => x + b.orders, 0)
  const branches = [...branchAgg.values()].map((b) => ({ ...b, netSalesKwd: round3(b.netSalesKwd), aovKwd: b.orders ? round3(b.netSalesKwd / b.orders) : 0, sharePct: totalNet ? Math.round((b.netSalesKwd / totalNet) * 1000) / 10 : 0 })).sort((a, b) => b.netSalesKwd - a.netSalesKwd)

  /* channels: payment methods bucketed into sales channels */
  const channelOf = (pm) => {
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
    return 'Shop Sales' // cash, K-NET, credit card and exhibition tills
  }
  const channelMap = new Map()
  const methodMap = new Map()
  for (const g of byPayment) {
    if (isBanned(configOfSession.get(m2oId(g.session_id)))) continue
    const pm = m2oName(g.payment_method_id) || 'Unknown'
    const ch = channelOf(pm)
    const c = channelMap.get(ch) || { name: ch, amountKwd: 0, payments: 0 }
    c.amountKwd += Number(g.amount) || 0
    c.payments += g.__count ?? 0
    channelMap.set(ch, c)
    if (!/\((qur|jah)\)/i.test(pm)) {
      const m = methodMap.get(pm) || { name: pm, channel: ch, amountKwd: 0, payments: 0 }
      m.amountKwd += Number(g.amount) || 0
      m.payments += g.__count ?? 0
      methodMap.set(pm, m)
    }
  }
  const channels = [...channelMap.values()].map((c) => ({ ...c, amountKwd: round3(c.amountKwd) })).sort((a, b) => b.amountKwd - a.amountKwd)
  const paymentMethodTotals = [...methodMap.values()].map((c) => ({ ...c, amountKwd: round3(c.amountKwd) })).sort((a, b) => b.amountKwd - a.amountKwd)

  /* lines: one grouped call per active POS config (product level), so brand × branch is exact */
  const lineBase = [['order_id.date_order', '>=', `${PERIOD.from} 00:00:00`], ['order_id.date_order', '<', `${PERIOD.to} 00:00:00`], ['order_id.state', 'in', ['paid', 'done', 'invoiced']]]
  const linesByConfig = new Map()
  for (const p of posTotals) {
    const rows = await safe(`pos.order.line read_group config ${p.posConfigId}`, () => ek('pos.order.line', 'read_group', [[...lineBase, ['order_id.session_id.config_id', '=', p.posConfigId]], ['price_subtotal:sum', 'qty:sum'], ['product_id']], { lazy: false }), [])
    linesByConfig.set(p.posConfigId, rows)
  }
  const productIds = [...new Set([...linesByConfig.values()].flat().map((g) => m2oId(g.product_id)).filter(Boolean))]
  const productInfo = productIds.length ? await safe('product.product read', () => ek('product.product', 'read', [productIds, ['id', 'pos_categ_id', 'product_tmpl_id']]), []) : []
  const posCategOfProduct = new Map(productInfo.map((p) => [p.id, m2oId(p.pos_categ_id)]))

  // Brand = root POS category in the Odoo menu tree (codes expanded with the analytic BRAND plan names)
  // SC = Fresh Daily Canteen (product codes RIFDC*, school canteen tills)
  const BRAND_CODE = { CG: 'China Garden', FB: 'Farm Brown', TNB: 'The Noodle Bar', HB: 'Heisenberg', TS: 'Tasty Snacks', SC: 'Fresh Daily Canteen' }
  const catById = new Map(posCategories.map((c) => [c.id, c]))
  const rootOf = (id) => { let c = catById.get(id); let guard = 0; while (c && c.parent_id && guard++ < 10) c = catById.get(m2oId(c.parent_id)); return c }
  const brandAgg = new Map()
  const brandBranchMap = new Map()
  const productAgg = new Map()
  const catAgg = new Map()
  for (const [cfgId, rows] of linesByConfig) {
    const branch = branchOf(configById.get(cfgId)?.name)
    for (const g of rows) {
      const pid = m2oId(g.product_id)
      const catId = posCategOfProduct.get(pid)
      const code = rootOf(catId)?.name ?? 'Uncategorised'
      const brand = BRAND_CODE[code] ?? code
      const net = Number(g.price_subtotal) || 0
      const qty = Number(g.qty) || 0
      const b = brandAgg.get(brand) || { brand, odooCategory: code, netKwd: 0, qty: 0 }
      b.netKwd += net; b.qty += qty; brandAgg.set(brand, b)
      const key = `${brand}|${branch}`
      brandBranchMap.set(key, (brandBranchMap.get(key) || 0) + net)
      const pr = productAgg.get(pid) || { productId: pid, name: m2oName(g.product_id), brand, qty: 0, netKwd: 0 }
      pr.qty += qty; pr.netKwd += net; productAgg.set(pid, pr)
      const catName = catById.get(catId)?.name ?? 'Uncategorised'
      const ck = `${brand}|${catName}`
      const c = catAgg.get(ck) || { brand, name: catName, qty: 0, netKwd: 0 }
      c.qty += qty; c.netKwd += net; catAgg.set(ck, c)
    }
  }
  const brandTotal = [...brandAgg.values()].reduce((x, b) => x + b.netKwd, 0)
  const brands = [...brandAgg.values()].map((b) => ({ ...b, netKwd: round3(b.netKwd), sharePct: brandTotal ? Math.round((b.netKwd / brandTotal) * 1000) / 10 : 0 })).sort((a, b) => b.netKwd - a.netKwd)
  const brandBranch = [...brandBranchMap.entries()].map(([k, v]) => { const [brand, branch] = k.split('|'); return { brand, branch, netKwd: round3(v) } }).filter((x) => x.netKwd !== 0)
  const products = [...productAgg.values()].map((p) => ({ ...p, netKwd: round3(p.netKwd) })).sort((a, b) => b.netKwd - a.netKwd).slice(0, 400)
  const categories = [...catAgg.values()].map((c) => ({ ...c, netKwd: round3(c.netKwd) })).sort((a, b) => b.netKwd - a.netKwd)
  const analyticBrands = analytic.filter((a) => m2oName(a.plan_id) === 'BRAND' && !a.name.includes('/')).map((a) => a.name)

  /* discounts: discounted lines only (sum(price_unit*qty*disc) is not groupable) */
  const discountedLines = installed.has('pos.order.line')
    ? await safe('pos.order.line discounted lines', () => ek('pos.order.line', 'search_read', [[...lineBase, ['discount', '>', 0], ['order_id.session_id.config_id', 'not in', bannedIds]]], { fields: ['price_unit', 'qty', 'discount'], limit: 300000 }), [])
    : []
  const discountKwd = discountedLines.reduce((x, l) => x + (Number(l.price_unit) || 0) * (Number(l.qty) || 0) * ((Number(l.discount) || 0) / 100), 0)

  /* 5. accounting: P&L by account type for posted moves (company-wide ledger) */
  const amlGroups = installed.has('account.move.line')
    ? await safe('account.move.line read_group', () => ek('account.move.line', 'read_group', [[['date', '>=', PERIOD.from], ['date', '<', PERIOD.to], ['parent_state', '=', 'posted']], ['balance:sum'], ['account_id']], { lazy: false }), [])
    : []
  const accountIds = amlGroups.map((g) => m2oId(g.account_id)).filter(Boolean)
  const accounts = accountIds.length ? await safe('account.account read', () => ek('account.account', 'read', [accountIds, ['id', 'code', 'name', 'account_type']]), []) : []
  const accType = new Map(accounts.map((a) => [a.id, a]))
  const pnl = { income: 0, other_income: 0, cogs: 0, expense: 0, depreciation: 0 }
  for (const g of amlGroups) {
    const a = accType.get(m2oId(g.account_id))
    if (!a) continue
    const bal = Number(g.balance) || 0
    if (a.account_type === 'income') pnl.income += -bal
    else if (a.account_type === 'income_other') pnl.other_income += -bal
    else if (a.account_type === 'expense_direct_cost') pnl.cogs += bal
    else if (a.account_type === 'expense') pnl.expense += bal
    else if (a.account_type === 'expense_depreciation') pnl.depreciation += bal
  }
  excluded = { configs: excluded.configs.size, net: excluded.net, orders: excluded.orders }

  const snapshot = {
    source: ODOO_URL,
    database: ODOO_DB,
    serverVersion: version.server_version ?? null,
    syncedAt: new Date().toISOString(),
    period: PERIOD,
    schema: { installedModels: [...installed].sort(), brandModel: brandModel ?? null, brandFields },
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
    brandRecords: brandRecords.map((b) => ({ id: b.id, name: b.name })),
    analyticBrands,
    brands,
    brandBranch,
    posConfigs: posConfigs.filter((c) => !EXCLUDED_BRANCH.test(c.name)).map((c) => ({ id: c.id, name: c.name, active: c.active !== false, branch: branchOf(c.name) })),
    posTotals,
    warehouses: warehouses.filter((w) => !EXCLUDED_BRANCH.test(w.name)).map((w) => ({ id: w.id, name: w.name, code: w.code })),
    posCategories: posCategories.map((p) => ({ id: p.id, name: p.name, parent: m2oName(p.parent_id) })),
    paymentMethods: paymentMethodTotals,
    totals: { netSalesKwd: round3(totalNet), orders: totalOrders, aovKwd: totalOrders ? round3(totalNet / totalOrders) : 0, discountKwd: round3(discountKwd), excludedPosConfigs: excluded.configs, excludedNetKwd: round3(excluded.net), excludedOrders: excluded.orders },
    pnl: Object.fromEntries(Object.entries(pnl).map(([k, v]) => [k, round3(v)])),
    branches,
    channels,
    categories,
    products,
    menuItems: templates.filter((t) => !EXCLUDED_BRANCH.test(t.name)).map((t) => ({ id: t.id, name: t.name, listPrice: round3(t.list_price), category: m2oName(t.categ_id), posCategory: m2oName(t.pos_categ_id), ...Object.fromEntries(tmplBrandFields.map((f) => [f, Array.isArray(t[f]) ? t[f][1] : t[f] ?? null])) })),
    permissions: { missingRead: [...MISSING_READ.keys()] },
  }

  console.log(`\n■ Branch revenue (${branches.length} locations from ${posTotals.length} POS configs; excluded POS=${excluded.configs}):`)
  branches.forEach((b) => console.log(`   - ${b.name.padEnd(24)} ${b.netSalesKwd.toFixed(3).padStart(14)} KWD  ${String(b.orders).padStart(7)} orders  ${String(b.sharePct).padStart(5)}%  [${b.posConfigs.join(' · ')}]`))
  console.log(`\n■ Totals: net ${snapshot.totals.netSalesKwd} KWD · ${snapshot.totals.orders} orders · AOV ${snapshot.totals.aovKwd} · discounts ${snapshot.totals.discountKwd}`)
  console.log('■ P&L (posted, period):', snapshot.pnl)
  console.log(`■ Channels: ${channels.map((c) => `${c.name}=${c.amountKwd}`).join(' | ')}`)
  console.log('\n■ Brands (root POS category, period net):')
  brands.forEach((b) => console.log(`   - ${b.brand.padEnd(22)} ${b.netKwd.toFixed(3).padStart(14)} KWD  ${b.sharePct}%  (odoo category: ${b.odooCategory})`))
  console.log(`■ Analytic BRAND plan: ${analyticBrands.join(', ')}`)
  console.log(`■ Excluded (hard ban): ${excluded.configs} POS configs · ${round3(excluded.net)} KWD · ${excluded.orders} orders`)
  console.log(`■ Products in period: ${products.length} · categories: ${categories.length} · brand×branch cells: ${brandBranch.length}`)

  fs.writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`\n✔ Snapshot written → ${path.relative(ROOT, SNAPSHOT)} (no credentials stored)`)
  reportPermissions()
}

function reportPermissions() {
  if (!MISSING_READ.size) { console.log('\n■ Permissions: bi_analytics could read every queried model.'); return }
  console.log('\n■ Missing Odoo read permissions for the service user (ask IT to grant read access):')
  for (const [model, msg] of MISSING_READ) console.log(`   - ${model.padEnd(26)} ${msg}`)
}

main().catch((e) => fail(e.message))
