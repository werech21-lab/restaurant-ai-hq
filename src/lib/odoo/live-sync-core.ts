/**
 * Live Odoo sync core — shared by the Next.js route (src/app/api/odoo-sync/route.ts) and the
 * Cloudflare Pages Function (functions/api/odoo-sync.ts).
 *
 * Runtime-neutral: only `fetch`, no Node APIs and no path aliases, so both bundlers can import it.
 * Credentials are read from the server environment and never leave the server.
 */

export interface OdooEnv {
  ODOO_URL?: string
  ODOO_DB?: string
  ODOO_LOGIN?: string
  ODOO_API_KEY?: string
}

export interface OdooLiveSummary {
  source: 'live' | 'snapshot'
  syncedAt: string
  period: { from: string; to: string }
  database: string | null
  totals: { netSalesKwd: number; orders: number; aovKwd: number }
  brands: { brand: string; netKwd: number; sharePct: number }[]
  branches: { name: string; netSalesKwd: number; orders: number; sharePct: number }[]
  channels: { name: string; amountKwd: number }[]
  note?: string
}

/** Hard exclusion: these locations never appear in Aether BI data. */
const EXCLUDED_BRANCH = /jahra|الجهراء|qurain|القرين/i
const ALLOWED_HOST = 'venturefoods.walnutss.com'
const BRAND_CODE: Record<string, string> = { CG: 'China Garden', FB: 'Farm Brown', TNB: 'The Noodle Bar', HB: 'Heisenberg', TS: 'Tasty Snacks', SC: 'Fresh Daily Canteen' }
const LOCATION_ALIAS: Record<string, string> = { salmyia: 'Salmiya', salmiya: 'Salmiya', kout: 'Al-Kout Mall', promenade: 'Promenade Mall', '360': '360 Mall', 'assima mall': 'Assima Mall', avenues: 'The Avenues', ardiya: 'Ardiya', 'ardiya temp': 'Ardiya' }

type M2O = [number, string] | false
const m2oId = (v: unknown): number | null => (Array.isArray(v) ? (v[0] as number) : null)
const m2oName = (v: unknown): string | null => (Array.isArray(v) ? (v[1] as string) : null)
const r3 = (n: number) => Math.round(n * 1000) / 1000
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0)

export function branchOfPosConfig(name: string): string {
  const n = (name || '').trim()
  if (/exebition|exhibition/i.test(n)) return 'Exhibitions (EXB)'
  if (/call center/i.test(n)) return 'Call Center'
  const m = n.match(/\(([^)]+)\)/)
  if (m) {
    const key = m[1].trim().toLowerCase()
    return LOCATION_ALIAS[key] ?? m[1].trim().replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return n
}

export function channelOfPaymentMethod(pm: string): string {
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

export function hasOdooCredentials(env: OdooEnv): boolean {
  return Boolean(env.ODOO_URL && env.ODOO_DB && env.ODOO_LOGIN && env.ODOO_API_KEY)
}

/* ------------------------------------------------------------- snapshot */
interface SnapshotShape {
  syncedAt?: string
  database?: string
  period?: { from: string; to: string }
  totals?: { netSalesKwd: number; orders: number; aovKwd: number }
  brands?: { brand: string; netKwd: number; sharePct: number }[]
  branches?: { name: string; netSalesKwd: number; orders: number; sharePct: number }[]
  channels?: { name: string; amountKwd: number }[]
}

export function summaryFromSnapshot(raw: unknown, note?: string): OdooLiveSummary {
  const s = (raw ?? {}) as SnapshotShape
  return {
    source: 'snapshot',
    syncedAt: s.syncedAt ?? new Date(0).toISOString(),
    period: s.period ?? { from: '', to: '' },
    database: s.database ?? null,
    totals: s.totals ? { netSalesKwd: s.totals.netSalesKwd, orders: s.totals.orders, aovKwd: s.totals.aovKwd } : { netSalesKwd: 0, orders: 0, aovKwd: 0 },
    brands: (s.brands ?? []).filter((b) => b.netKwd > 0).map((b) => ({ brand: BRAND_CODE[b.brand] ?? b.brand, netKwd: b.netKwd, sharePct: b.sharePct })),
    branches: (s.branches ?? []).filter((b) => !EXCLUDED_BRANCH.test(b.name)).map((b) => ({ name: b.name, netSalesKwd: b.netSalesKwd, orders: b.orders, sharePct: b.sharePct })),
    channels: (s.channels ?? []).map((c) => ({ name: c.name, amountKwd: c.amountKwd })),
    ...(note ? { note } : {}),
  }
}

/* ----------------------------------------------------------------- live */
function monthToDate(now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { from: iso(from), to: iso(to) }
}

export async function fetchLiveOdooSummary(env: OdooEnv, period = monthToDate(), timeoutMs = 25_000): Promise<OdooLiveSummary> {
  if (!hasOdooCredentials(env)) throw new Error('Odoo credentials are not configured on the server')
  const base = String(env.ODOO_URL).replace(/\/+$/, '')
  const url = new URL(base)
  if (url.protocol !== 'https:' || url.hostname !== ALLOWED_HOST) throw new Error('ODOO_URL is not the Venture Foods Odoo host')
  const deadline = Date.now() + timeoutMs
  let id = 0

  const call = async (service: string, method: string, args: unknown[]): Promise<unknown> => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new Error('Odoo live sync timed out')
    const res = await fetch(`${base}/jsonrpc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: ++id, params: { service, method, args } }),
      signal: AbortSignal.timeout(remaining),
    })
    if (!res.ok) throw new Error(`Odoo HTTP ${res.status}`)
    const json = (await res.json()) as { result?: unknown; error?: { data?: { message?: string }; message?: string } }
    if (json.error) throw new Error(json.error.data?.message || json.error.message || 'Odoo error')
    return json.result
  }

  const db = String(env.ODOO_DB)
  const uid = await call('common', 'authenticate', [db, env.ODOO_LOGIN, env.ODOO_API_KEY, {}])
  if (typeof uid !== 'number' || uid <= 0) throw new Error('Odoo refused the service account')
  const ek = (model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) =>
    call('object', 'execute_kw', [db, uid, env.ODOO_API_KEY, model, method, args, kwargs])

  const configs = (await ek('pos.config', 'search_read', [[['active', 'in', [true, false]]]], { fields: ['id', 'name'], context: { active_test: false } })) as { id: number; name: string }[]
  const configName = new Map(configs.map((c) => [c.id, c.name]))
  const banned = configs.filter((c) => EXCLUDED_BRANCH.test(c.name)).map((c) => c.id)
  const categories = (await ek('pos.category', 'search_read', [[]], { fields: ['id', 'name', 'parent_id'] })) as { id: number; name: string; parent_id: M2O }[]
  const catById = new Map(categories.map((c) => [c.id, c]))
  const rootName = (catId: number | null) => {
    let c = catId ? catById.get(catId) : undefined
    let guard = 0
    while (c && c.parent_id && guard++ < 10) c = catById.get(m2oId(c.parent_id) ?? -1)
    return c?.name ?? null
  }

  const orderDomain = [['date_order', '>=', `${period.from} 00:00:00`], ['date_order', '<', `${period.to} 00:00:00`], ['state', 'in', ['paid', 'done', 'invoiced']]]
  const bySession = (await ek('pos.order', 'read_group', [orderDomain, ['amount_total:sum', 'amount_tax:sum'], ['session_id']], { lazy: false })) as { session_id: M2O; amount_total: number; amount_tax: number; __count: number }[]
  const byPayment = (await ek('pos.payment', 'read_group', [[['pos_order_id.date_order', '>=', `${period.from} 00:00:00`], ['pos_order_id.date_order', '<', `${period.to} 00:00:00`], ['pos_order_id.state', 'in', ['paid', 'done', 'invoiced']]], ['amount:sum'], ['session_id', 'payment_method_id']], { lazy: false })) as { session_id: M2O; payment_method_id: M2O; amount: number }[]
  const sessionIds = [...new Set([...bySession, ...byPayment].map((g) => m2oId(g.session_id)).filter((x): x is number => x !== null))]
  const sessions = sessionIds.length ? ((await ek('pos.session', 'read', [sessionIds, ['id', 'config_id']])) as { id: number; config_id: M2O }[]) : []
  const configOfSession = new Map(sessions.map((s) => [s.id, m2oId(s.config_id)]))

  const branchAgg = new Map<string, { net: number; orders: number }>()
  for (const g of bySession) {
    const cfg = configOfSession.get(m2oId(g.session_id) ?? -1)
    if (cfg === undefined || cfg === null || banned.includes(cfg)) continue
    const name = branchOfPosConfig(configName.get(cfg) ?? '')
    if (EXCLUDED_BRANCH.test(name)) continue
    const b = branchAgg.get(name) ?? { net: 0, orders: 0 }
    b.net += (g.amount_total || 0) - (g.amount_tax || 0)
    b.orders += g.__count || 0
    branchAgg.set(name, b)
  }
  const totalNet = [...branchAgg.values()].reduce((s, b) => s + b.net, 0)
  const totalOrders = [...branchAgg.values()].reduce((s, b) => s + b.orders, 0)

  const channelAgg = new Map<string, number>()
  for (const g of byPayment) {
    const cfg = configOfSession.get(m2oId(g.session_id) ?? -1)
    if (cfg !== undefined && cfg !== null && banned.includes(cfg)) continue
    const ch = channelOfPaymentMethod(m2oName(g.payment_method_id) ?? '')
    channelAgg.set(ch, (channelAgg.get(ch) ?? 0) + (g.amount || 0))
  }

  const lineDomain = [['order_id.date_order', '>=', `${period.from} 00:00:00`], ['order_id.date_order', '<', `${period.to} 00:00:00`], ['order_id.state', 'in', ['paid', 'done', 'invoiced']], ['order_id.session_id.config_id', 'not in', banned]]
  const byProduct = (await ek('pos.order.line', 'read_group', [lineDomain, ['price_subtotal:sum'], ['product_id']], { lazy: false })) as { product_id: M2O; price_subtotal: number }[]
  const productIds = byProduct.map((g) => m2oId(g.product_id)).filter((x): x is number => x !== null)
  const products = productIds.length ? ((await ek('product.product', 'read', [productIds, ['id', 'pos_categ_id']])) as { id: number; pos_categ_id: M2O }[]) : []
  const categOf = new Map(products.map((p) => [p.id, m2oId(p.pos_categ_id)]))
  const brandAgg = new Map<string, number>()
  for (const g of byProduct) {
    const root = rootName(categOf.get(m2oId(g.product_id) ?? -1) ?? null)
    if (!root || root === 'Admin') continue
    const brand = BRAND_CODE[root] ?? root
    brandAgg.set(brand, (brandAgg.get(brand) ?? 0) + (g.price_subtotal || 0))
  }
  const brandTotal = [...brandAgg.values()].reduce((s, v) => s + v, 0)

  return {
    source: 'live',
    syncedAt: new Date().toISOString(),
    period,
    database: db,
    totals: { netSalesKwd: r3(totalNet), orders: totalOrders, aovKwd: totalOrders ? r3(totalNet / totalOrders) : 0 },
    brands: [...brandAgg.entries()].filter(([, v]) => v > 0).map(([brand, v]) => ({ brand, netKwd: r3(v), sharePct: pct(v, brandTotal) })).sort((a, b) => b.netKwd - a.netKwd),
    branches: [...branchAgg.entries()].map(([name, b]) => ({ name, netSalesKwd: r3(b.net), orders: b.orders, sharePct: pct(b.net, totalNet) })).sort((a, b) => b.netSalesKwd - a.netSalesKwd),
    channels: [...channelAgg.entries()].map(([name, v]) => ({ name, amountKwd: r3(v) })).sort((a, b) => b.amountKwd - a.amountKwd),
  }
}

/** Rejects cross-site browser calls (Fetch Metadata). Server-to-server calls without the header pass. */
export function isSameSiteRequest(headers: Headers): boolean {
  const site = headers.get('sec-fetch-site')
  return !site || site === 'same-origin' || site === 'none'
}
