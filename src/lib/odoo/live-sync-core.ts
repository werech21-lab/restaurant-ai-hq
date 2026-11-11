/**
 * Live Odoo sync core — shared by the Next.js route (src/app/api/odoo-sync/route.ts) and the
 * Cloudflare Pages Function (functions/api/odoo-sync.ts).
 *
 * Runtime-neutral: only `fetch`, no Node APIs and no path aliases, so both bundlers can import it.
 * Credentials are read from the server environment and never leave the server.
 *
 * Scope is a POSITIVE whitelist (./pos-registry.json): only the listed pos.config registers and
 * the approved Venture Foods brands are ever queried or returned.
 */
import registry from './pos-registry.json'

export interface OdooEnv {
  ODOO_URL?: string
  ODOO_DB?: string
  ODOO_LOGIN?: string
  ODOO_API_KEY?: string
}

export type OdooPeriodBucketKey = 'today' | 'week' | 'month' | 'year'

export interface OdooBucketSummary {
  key: OdooPeriodBucketKey
  from: string
  to: string
  days: number
  isLatestOperationalDay?: boolean
  totals: {
    netSalesKwd: number
    orders: number
    aovKwd: number
    restaurantNetKwd: number
    restaurantOrders: number
  }
  byBrand?: Record<string, { netKwd: number; orders: number; qty?: number }>
  byLocation?: Record<string, { netKwd: number; orders: number; uiChannels?: Record<string, { netKwd: number; orders: number }> }>
  uiChannels?: Record<string, { netKwd: number; orders: number }>
  accounting?: { income: number; otherIncome: number; cogs: number; expense: number; depreciation: number; operatingProfit: number }
}

export interface OdooLiveSummary {
  source: 'live' | 'snapshot'
  syncedAt: string
  bucket?: OdooPeriodBucketKey
  period: { from: string; to: string }
  database: string | null
  totals: { netSalesKwd: number; orders: number; aovKwd: number }
  brands: { id: string; brand: string; netKwd: number; sharePct: number }[]
  branches: { id: string; name: string; unit: string; netSalesKwd: number; orders: number; sharePct: number }[]
  channels: { name: string; amountKwd: number }[]
  buckets?: Partial<Record<OdooPeriodBucketKey, OdooBucketSummary>>
  /** Rolling 30-day vs prior 30-day vs month-to-date totals (whitelisted registers, Kuwait calendar days). */
  journeyPulse?: Record<'rolling30' | 'prior30' | 'mtd', { from: string; to: string; days: number; netKwd: number; orders: number; perDayKwd: number }>
  /** Read-permission audit of the 7 journey stages for the BI service user. */
  access?: { readable: string[]; restricted: string[] }
  /** Odoo 17 Analytic Cost-Center access & unallocated expense pulse. */
  analyticCostCenters?: {
    plansReadable: boolean
    accountsReadable: boolean
    linesReadable: boolean
    whitelistedCenters: number
    unallocatedExpenseDebit30Kwd?: number
    unallocatedLines30?: number
  }
  note?: string
}

/** Models probed by the live access audit (one per journey stage concern + Odoo 17 Analytic Cost Centers). */
export const JOURNEY_AUDIT_MODELS = [
  'pos.order',
  'pos.order.line',
  'pos.payment',
  'pos.session',
  'purchase.order.line',
  'account.move',
  'account.move.line',
  'account.analytic.plan',
  'account.analytic.account',
  'account.analytic.line',
  'stock.move',
  'stock.scrap',
  'mrp.bom',
  'hr.attendance',
] as const

/** Rolling 30 complete days, the 30 before them, and month-to-date (Kuwait time, `to` exclusive). */
export function journeyWindows(now = new Date()) {
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const today = new Date(now.getTime() + 3 * 3600 * 1000)
  const t = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const shift = (d: Date, days: number) => new Date(d.getTime() + days * 86400000)
  return {
    rolling30: { from: iso(shift(t, -30)), to: iso(t), days: 30 },
    prior30: { from: iso(shift(t, -60)), to: iso(shift(t, -30)), days: 30 },
    mtd: { from: iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1))), to: iso(shift(t, 1)), days: t.getUTCDate() },
  }
}

type Registry = {
  allowedPosConfigIds: number[]
  registers: Record<string, { location: string }>
  locations: Record<string, { en: string; ar: string; code: string; unit: string; analyticId?: number; analyticIds?: number[] }>
  sharedCostAnalyticIds?: Record<string, number>
  brands: { id: string; en: string; ar: string; posRoot: string | null; analyticId?: number }[]
  excludedBranchAnalyticIds?: number[]
}
const REG = registry as unknown as Registry
export const ALLOWED_POS_CONFIG_IDS: readonly number[] = REG.allowedPosConfigIds
const ALLOWED_HOST = 'venturefoods.walnutss.com'

type M2O = [number, string] | false
const m2oId = (v: unknown): number | null => (Array.isArray(v) ? (v[0] as number) : null)
const m2oName = (v: unknown): string | null => (Array.isArray(v) ? (v[1] as string) : null)
const r3 = (n: number) => Math.round(n * 1000) / 1000
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0)

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
  buckets?: Partial<Record<OdooPeriodBucketKey, OdooBucketSummary>>
  brands?: { id: string; en: string; netKwd: number; sharePct: number }[]
  locations?: { id: string; en: string; unit: string; netKwd: number; orders: number; sharePct: number }[]
  channels?: { name: string; amountKwd: number }[]
  journey?: {
    pulse?: Record<'rolling30' | 'prior30' | 'mtd', { from: string; to: string; days: number; netKwd: number; orders: number; perDayKwd: number }>
    access?: { readable: { model: string }[]; restricted: { model: string }[] }
    opex?: {
      analyticArchitecture?: { plansReadable?: boolean; accountsReadable?: boolean; linesReadable?: boolean; whitelistedCenters?: unknown[] }
      unallocated?: { rolling30?: { grossDebitKwd?: number; lines?: number } }
    }
  }
}

export function parseBucketKey(raw?: string | null): OdooPeriodBucketKey {
  if (raw === 'today' || raw === 'week' || raw === 'month' || raw === 'year') return raw
  return 'month'
}

export function periodWindowForBucket(bucket: OdooPeriodBucketKey, now = new Date()): { from: string; to: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const kw = new Date(now.getTime() + 3 * 3600 * 1000)
  const t = new Date(Date.UTC(kw.getUTCFullYear(), kw.getUTCMonth(), kw.getUTCDate()))
  const shift = (d: Date, days: number) => new Date(d.getTime() + days * 86400000)
  if (bucket === 'today') {
    // Before 10:00 AM Kuwait time, use the most recent complete operational day so morning checks aren't zero.
    if (kw.getUTCHours() < 10) return { from: iso(shift(t, -1)), to: iso(t) }
    return { from: iso(t), to: iso(shift(t, 1)) }
  }
  if (bucket === 'week') return { from: iso(shift(t, -7)), to: iso(shift(t, 1)) }
  if (bucket === 'year') return { from: `${t.getUTCFullYear()}-01-01`, to: iso(shift(t, 1)) }
  return { from: iso(shift(t, -30)), to: iso(shift(t, 1)) }
}

export function summaryFromSnapshot(raw: unknown, note?: string, bucket: OdooPeriodBucketKey = 'month'): OdooLiveSummary {
  const s = (raw ?? {}) as SnapshotShape
  const jp = s.journey?.pulse
  const aa = s.journey?.opex?.analyticArchitecture
  const un = s.journey?.opex?.unallocated?.rolling30
  const b = s.buckets?.[bucket]
  const bucketBrandEntries = b?.byBrand ? Object.entries(b.byBrand).filter(([, v]) => v.netKwd > 0) : null
  const bucketBrandTotal = bucketBrandEntries ? bucketBrandEntries.reduce((acc, [, v]) => acc + v.netKwd, 0) : 0
  const bucketLocEntries = b?.byLocation ? Object.entries(b.byLocation) : null
  const bucketLocTotal = b?.totals.netSalesKwd ?? 0
  return {
    source: 'snapshot',
    syncedAt: s.syncedAt ?? new Date(0).toISOString(),
    bucket,
    period: b ? { from: b.from, to: b.to } : (s.period ?? { from: '', to: '' }),
    database: s.database ?? null,
    totals: b
      ? { netSalesKwd: b.totals.netSalesKwd, orders: b.totals.orders, aovKwd: b.totals.aovKwd }
      : s.totals
        ? { netSalesKwd: s.totals.netSalesKwd, orders: s.totals.orders, aovKwd: s.totals.aovKwd }
        : { netSalesKwd: 0, orders: 0, aovKwd: 0 },
    brands: bucketBrandEntries
      ? bucketBrandEntries.map(([bid, v]) => ({ id: bid, brand: REG.brands.find((x) => x.id === bid)?.en ?? bid, netKwd: v.netKwd, sharePct: pct(v.netKwd, bucketBrandTotal) })).sort((a, x) => x.netKwd - a.netKwd)
      : (s.brands ?? []).filter((x) => x.netKwd > 0).map((x) => ({ id: x.id, brand: x.en, netKwd: x.netKwd, sharePct: x.sharePct })),
    branches: bucketLocEntries
      ? bucketLocEntries.map(([lid, v]) => ({ id: lid, name: REG.locations[lid]?.en ?? lid, unit: REG.locations[lid]?.unit ?? 'restaurant', netSalesKwd: v.netKwd, orders: v.orders, sharePct: pct(v.netKwd, bucketLocTotal) })).sort((a, x) => x.netSalesKwd - a.netSalesKwd)
      : (s.locations ?? []).map((l) => ({ id: l.id, name: l.en, unit: l.unit, netSalesKwd: l.netKwd, orders: l.orders, sharePct: l.sharePct })),
    channels: b?.uiChannels
      ? Object.entries(b.uiChannels).map(([name, v]) => ({ name, amountKwd: v.netKwd })).sort((a, x) => x.amountKwd - a.amountKwd)
      : (s.channels ?? []).map((c) => ({ name: c.name, amountKwd: c.amountKwd })),
    ...(s.buckets ? { buckets: s.buckets } : {}),
    ...(jp
      ? { journeyPulse: Object.fromEntries((['rolling30', 'prior30', 'mtd'] as const).map((k) => [k, { from: jp[k].from, to: jp[k].to, days: jp[k].days, netKwd: jp[k].netKwd, orders: jp[k].orders, perDayKwd: jp[k].perDayKwd }])) as OdooLiveSummary['journeyPulse'] }
      : {}),
    ...(s.journey?.access ? { access: { readable: s.journey.access.readable.map((a) => a.model), restricted: s.journey.access.restricted.map((a) => a.model) } } : {}),
    ...(aa
      ? {
          analyticCostCenters: {
            plansReadable: Boolean(aa.plansReadable),
            accountsReadable: Boolean(aa.accountsReadable),
            linesReadable: Boolean(aa.linesReadable),
            whitelistedCenters: aa.whitelistedCenters?.length ?? 0,
            unallocatedExpenseDebit30Kwd: un?.grossDebitKwd,
            unallocatedLines30: un?.lines,
          },
        }
      : {}),
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

const ACTIVE_BRAND_IDS = ['china-garden', 'franks', 'tahina', 'farm-brown', 'noodle-bar', 'karak-cafeteria'] as const
const UI_CHANNEL_KEYS = ['dine-in', 'takeaway-direct', 'talabat-tgo', 'talabat-tmp', 'keeta', 'deliveroo', 'jahez', 'snoonu'] as const

function reconcileAmounts(rawMap: Map<string, number>, keys: readonly string[], targetTotal: number): Map<string, number> {
  const target = Math.max(0, r3(targetTotal))
  const posEntries = keys.map((k) => [k, Math.max(0, Number(rawMap.get(k)) || 0)] as const)
  const rawSum = posEntries.reduce((s, [, v]) => s + v, 0)
  const out = new Map<string, number>()
  if (target <= 0) {
    for (const k of keys) out.set(k, 0)
    return out
  }
  if (rawSum <= 0) {
    for (const k of keys) out.set(k, 0)
    out.set(keys[0], target)
    return out
  }
  let roundedSum = 0
  let maxKey = keys[0]
  let maxVal = -1
  for (const [k, v] of posEntries) {
    const scaled = r3((v / rawSum) * target)
    out.set(k, scaled)
    roundedSum += scaled
    if (scaled > maxVal) {
      maxVal = scaled
      maxKey = k
    }
  }
  const residual = r3(target - roundedSum)
  if (residual !== 0) {
    out.set(maxKey, Math.max(0, r3((out.get(maxKey) ?? 0) + residual)))
  }
  return out
}

export async function fetchLiveOdooSummary(env: OdooEnv, period = monthToDate(), timeoutMs = 25_000, bucket?: OdooPeriodBucketKey): Promise<OdooLiveSummary> {
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

  const restaurantLocIds = Object.entries(REG.locations).filter(([, v]) => v.unit === 'restaurant').map(([k]) => k)
  const restaurantAllowed = ALLOWED_POS_CONFIG_IDS.filter((cfgId) => {
    const loc = REG.registers[String(cfgId)]?.location
    return Boolean(loc && REG.locations[loc]?.unit === 'restaurant')
  })
  const allowedSet = new Set(restaurantAllowed)
  const configs = (await ek('pos.config', 'search_read', [[['id', 'in', restaurantAllowed], ['active', 'in', [true, false]]]], { fields: ['id', 'name'], context: { active_test: false } })) as { id: number; name: string }[]
  const configNameById = new Map(configs.map((c) => [c.id, c.name]))
  const isDeliveryCfg = (cfgId: number) => {
    const loc = REG.registers[String(cfgId)]?.location
    const nm = configNameById.get(cfgId) ?? ''
    return loc === 'ardiya' || /delivery|call\s*center/i.test(nm)
  }

  const categories = (await ek('pos.category', 'search_read', [[]], { fields: ['id', 'name', 'parent_id'] })) as { id: number; name: string; parent_id: M2O }[]
  const catById = new Map(categories.map((c) => [c.id, c]))
  const rootName = (catId: number | null) => {
    let c = catId ? catById.get(catId) : undefined
    let guard = 0
    while (c && c.parent_id && guard++ < 10) c = catById.get(m2oId(c.parent_id) ?? -1)
    return c?.name ?? null
  }
  const brandOfRoot = new Map(REG.brands.filter((b) => b.posRoot).map((b) => [b.posRoot as string, b]))

  const orderDomain = [['date_order', '>=', `${period.from} 00:00:00`], ['date_order', '<', `${period.to} 00:00:00`], ['state', 'in', ['paid', 'done', 'invoiced']], ['session_id.config_id', 'in', restaurantAllowed]]
  const bySession = (await ek('pos.order', 'read_group', [orderDomain, ['amount_total:sum', 'amount_tax:sum'], ['session_id']], { lazy: false })) as { session_id: M2O; amount_total: number; amount_tax: number; __count: number }[]
  const byPayment = (await ek('pos.payment', 'read_group', [[['pos_order_id.date_order', '>=', `${period.from} 00:00:00`], ['pos_order_id.date_order', '<', `${period.to} 00:00:00`], ['pos_order_id.state', 'in', ['paid', 'done', 'invoiced']], ['session_id.config_id', 'in', restaurantAllowed]], ['amount:sum'], ['session_id', 'payment_method_id']], { lazy: false })) as { session_id: M2O; payment_method_id: M2O; amount: number; __count?: number }[]
  const sessionIds = [...new Set([...bySession, ...byPayment].map((g) => m2oId(g.session_id)).filter((x): x is number => x !== null))]
  const sessions = sessionIds.length ? ((await ek('pos.session', 'read', [sessionIds, ['id', 'config_id']])) as { id: number; config_id: M2O }[]) : []
  const configOfSession = new Map(sessions.map((s) => [s.id, m2oId(s.config_id)]))

  const locAgg = new Map<string, { net: number; orders: number }>()
  for (const g of bySession) {
    const cfg = configOfSession.get(m2oId(g.session_id) ?? -1)
    if (cfg === undefined || cfg === null || !allowedSet.has(cfg)) continue
    const loc = REG.registers[String(cfg)]?.location
    if (!loc || REG.locations[loc]?.unit !== 'restaurant') continue
    const b = locAgg.get(loc) ?? { net: 0, orders: 0 }
    b.net += Math.max(0, (g.amount_total || 0) - (g.amount_tax || 0))
    b.orders += Math.max(0, g.__count || 0)
    locAgg.set(loc, b)
  }
  const targetNet = r3([...locAgg.values()].reduce((s, b) => s + b.net, 0))
  const totalOrders = [...locAgg.values()].reduce((s, b) => s + b.orders, 0)
  const rawLocMap = new Map(restaurantLocIds.map((loc) => [loc, locAgg.get(loc)?.net ?? 0]))
  const reconciledLocNet = reconcileAmounts(rawLocMap, restaurantLocIds, targetNet)

  const locRawUi = new Map<string, Record<string, { netKwd: number; orders: number }>>()
  for (const loc of restaurantLocIds) {
    locRawUi.set(loc, Object.fromEntries(UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }])))
  }
  for (const g of byPayment) {
    const cfg = configOfSession.get(m2oId(g.session_id) ?? -1)
    if (cfg === undefined || cfg === null || !allowedSet.has(cfg)) continue
    const loc = REG.registers[String(cfg)]?.location
    if (!loc || !locRawUi.has(loc)) continue
    const ch = channelOfPaymentMethod(m2oName(g.payment_method_id) ?? '')
    const amt = Math.max(0, g.amount || 0)
    const cnt = Math.max(0, g.__count || 0)
    const row = locRawUi.get(loc)!
    let uiKey: (typeof UI_CHANNEL_KEYS)[number] = 'dine-in'
    if (ch === 'Talabat Go') uiKey = 'talabat-tgo'
    else if (ch === 'Talabat MP') uiKey = 'talabat-tmp'
    else if (ch === 'Keeta') uiKey = 'keeta'
    else if (ch === 'Deliveroo Go' || ch === 'Deliveroo MP') uiKey = 'deliveroo'
    else if (ch === 'Jahez' || ch === 'Cari') uiKey = 'jahez'
    else if (ch === 'Snoonu') uiKey = 'snoonu'
    else if (ch === 'Online payment link' || ch === 'Cash on delivery' || ch === 'Bilbayt') uiKey = 'takeaway-direct'
    else uiKey = isDeliveryCfg(cfg) ? 'takeaway-direct' : 'dine-in'
    row[uiKey].netKwd += amt
    row[uiKey].orders += cnt
  }

  const byLocation: NonNullable<OdooBucketSummary['byLocation']> = {}
  const aggUiChannels: Record<string, { netKwd: number; orders: number }> = Object.fromEntries(UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }]))
  for (const loc of restaurantLocIds) {
    const locTarget = reconciledLocNet.get(loc) ?? 0
    const rawUi = locRawUi.get(loc)!
    const rawUiMap = new Map<string, number>(UI_CHANNEL_KEYS.map((ck) => [ck, rawUi[ck].netKwd]))
    if (loc === 'ardiya' && (rawUiMap.get('dine-in') ?? 0) > 0) {
      rawUiMap.set('takeaway-direct', (rawUiMap.get('takeaway-direct') ?? 0) + (rawUiMap.get('dine-in') ?? 0))
      rawUiMap.set('dine-in', 0)
    }
    const allowedCk = loc === 'ardiya' ? UI_CHANNEL_KEYS.filter((ck) => ck !== 'dine-in') : UI_CHANNEL_KEYS
    const recUi = reconcileAmounts(rawUiMap, allowedCk, locTarget)
    const locUi: Record<string, { netKwd: number; orders: number }> = {}
    for (const ck of UI_CHANNEL_KEYS) {
      const nv = r3(recUi.get(ck) ?? 0)
      const ov = nv > 0 ? Math.max(1, rawUi[ck].orders || Math.round(nv / 4.8)) : 0
      locUi[ck] = { netKwd: nv, orders: ov }
      aggUiChannels[ck].netKwd = r3(aggUiChannels[ck].netKwd + nv)
      aggUiChannels[ck].orders += ov
    }
    byLocation[loc] = {
      netKwd: locTarget,
      orders: locAgg.get(loc)?.orders ?? 0,
      uiChannels: locUi,
    }
  }
  const aggRawMap = new Map<string, number>(UI_CHANNEL_KEYS.map((ck) => [ck, aggUiChannels[ck].netKwd]))
  const reconciledAggUi = reconcileAmounts(aggRawMap, UI_CHANNEL_KEYS, targetNet)
  for (const ck of UI_CHANNEL_KEYS) {
    aggUiChannels[ck].netKwd = reconciledAggUi.get(ck) ?? 0
  }

  const lineDomain = [['order_id.date_order', '>=', `${period.from} 00:00:00`], ['order_id.date_order', '<', `${period.to} 00:00:00`], ['order_id.state', 'in', ['paid', 'done', 'invoiced']], ['order_id.session_id.config_id', 'in', restaurantAllowed]]
  const byProduct = (await ek('pos.order.line', 'read_group', [lineDomain, ['price_subtotal:sum', 'qty:sum'], ['product_id']], { lazy: false })) as { product_id: M2O; price_subtotal: number; qty?: number }[]
  const productIds = byProduct.map((g) => m2oId(g.product_id)).filter((x): x is number => x !== null)
  const products = productIds.length ? ((await ek('product.product', 'read', [productIds, ['id', 'pos_categ_id']])) as { id: number; pos_categ_id: M2O }[]) : []
  const categOf = new Map(products.map((p) => [p.id, m2oId(p.pos_categ_id)]))
  const brandAgg = new Map<string, { rawNet: number; qty: number }>()
  for (const g of byProduct) {
    const root = rootName(categOf.get(m2oId(g.product_id) ?? -1) ?? null)
    const brand = root ? brandOfRoot.get(root) : undefined
    if (!brand || !(ACTIVE_BRAND_IDS as readonly string[]).includes(brand.id)) continue
    const prev = brandAgg.get(brand.id) ?? { rawNet: 0, qty: 0 }
    prev.rawNet += g.price_subtotal || 0
    prev.qty += g.qty || 0
    brandAgg.set(brand.id, prev)
  }
  const rawBrandMap = new Map<string, number>(ACTIVE_BRAND_IDS.map((bid) => [bid, Math.max(0, brandAgg.get(bid)?.rawNet ?? 0)]))
  const reconciledBrandNet = reconcileAmounts(rawBrandMap, ACTIVE_BRAND_IDS, targetNet)
  const byBrand: NonNullable<OdooBucketSummary['byBrand']> = {}
  for (const bid of ACTIVE_BRAND_IDS) {
    const nv = reconciledBrandNet.get(bid) ?? 0
    byBrand[bid] = {
      netKwd: nv,
      orders: nv > 0 ? Math.max(1, Math.round((nv / Math.max(1, targetNet)) * totalOrders)) : 0,
      qty: r3(Math.max(0, brandAgg.get(bid)?.qty ?? 0)),
    }
  }

  // Journey pulse (3 grouped totals) and the access audit run in parallel; neither may fail the summary.
  const windows = journeyWindows()
  const pulseOf = async (w: { from: string; to: string; days: number }) => {
    const rows = (await ek('pos.order', 'read_group', [[['date_order', '>=', `${w.from} 00:00:00`], ['date_order', '<', `${w.to} 00:00:00`], ['state', 'in', ['paid', 'done', 'invoiced']], ['session_id.config_id', 'in', restaurantAllowed]], ['amount_total:sum', 'amount_tax:sum'], []], { lazy: false })) as { amount_total: number; amount_tax: number; __count: number }[]
    const net = (rows[0]?.amount_total || 0) - (rows[0]?.amount_tax || 0)
    return { ...w, netKwd: r3(net), orders: rows[0]?.__count ?? 0, perDayKwd: r3(net / Math.max(1, w.days)) }
  }
  const [pulse, audit, unalloc] = await Promise.all([
    Promise.all([pulseOf(windows.rolling30), pulseOf(windows.prior30), pulseOf(windows.mtd)]).then(([rolling30, prior30, mtd]) => ({ rolling30, prior30, mtd })).catch(() => undefined),
    Promise.all(
      JOURNEY_AUDIT_MODELS.map((m) =>
        ek(m, 'check_access_rights', ['read', false])
          .then((ok) => [m, ok === true] as const)
          .catch(() => [m, false] as const),
      ),
    ).catch(() => [] as (readonly [string, boolean])[]),
    (
      ek(
        'account.move.line',
        'read_group',
        [[['date', '>=', windows.rolling30.from], ['date', '<', windows.rolling30.to], ['parent_state', '=', 'posted'], ['account_id.account_type', 'in', ['expense', 'expense_direct_cost', 'expense_depreciation']], ['analytic_distribution', '=', false]], ['debit:sum'], []],
        { lazy: false },
      ) as Promise<{ debit?: number; __count?: number }[]>
    )
      .then((rows) => ({ debitKwd: r3(rows[0]?.debit ?? 0), lines: rows[0]?.__count ?? 0 }))
      .catch(() => undefined),
  ])
  const access = audit.length ? { readable: audit.filter(([, ok]) => ok).map(([m]) => m), restricted: audit.filter(([, ok]) => !ok).map(([m]) => m) } : undefined
  const readableSet = new Set(access?.readable ?? [])
  const exclSet = new Set(REG.excludedBranchAnalyticIds ?? [])
  const wlCount = new Set([
    ...Object.values(REG.locations).flatMap((l) => l.analyticIds ?? (l.analyticId ? [l.analyticId] : [])),
    ...Object.values(REG.sharedCostAnalyticIds ?? {}),
    ...REG.brands.map((b) => b.analyticId).filter((x): x is number => typeof x === 'number'),
  ].filter((id) => !exclSet.has(id))).size
  const analyticCostCenters = access
    ? {
        plansReadable: readableSet.has('account.analytic.plan'),
        accountsReadable: readableSet.has('account.analytic.account'),
        linesReadable: readableSet.has('account.analytic.line'),
        whitelistedCenters: wlCount,
        ...(unalloc ? { unallocatedExpenseDebit30Kwd: unalloc.debitKwd, unallocatedLines30: unalloc.lines } : {}),
      }
    : undefined

  const days = Math.max(1, Math.round((new Date(`${period.to}T00:00:00Z`).getTime() - new Date(`${period.from}T00:00:00Z`).getTime()) / 86400000))
  const liveBucket: OdooBucketSummary | undefined = bucket
    ? {
        key: bucket,
        from: period.from,
        to: period.to,
        days,
        totals: {
          netSalesKwd: targetNet,
          orders: totalOrders,
          aovKwd: totalOrders ? r3(targetNet / totalOrders) : 0,
          restaurantNetKwd: targetNet,
          restaurantOrders: totalOrders,
        },
        byBrand,
        byLocation,
        uiChannels: aggUiChannels,
      }
    : undefined

  return {
    source: 'live',
    syncedAt: new Date().toISOString(),
    ...(bucket ? { bucket } : {}),
    period,
    database: db,
    totals: { netSalesKwd: targetNet, orders: totalOrders, aovKwd: totalOrders ? r3(targetNet / totalOrders) : 0 },
    brands: ACTIVE_BRAND_IDS.filter((bid) => (reconciledBrandNet.get(bid) ?? 0) > 0).map((bid) => {
      const nv = reconciledBrandNet.get(bid) ?? 0
      return { id: bid, brand: REG.brands.find((b) => b.id === bid)?.en ?? bid, netKwd: nv, sharePct: pct(nv, targetNet) }
    }).sort((a, b) => b.netKwd - a.netKwd),
    branches: restaurantLocIds.map((lid) => {
      const nv = reconciledLocNet.get(lid) ?? 0
      return { id: lid, name: REG.locations[lid]?.en ?? lid, unit: 'restaurant', netSalesKwd: nv, orders: locAgg.get(lid)?.orders ?? 0, sharePct: pct(nv, targetNet) }
    }).sort((a, b) => b.netSalesKwd - a.netSalesKwd),
    channels: UI_CHANNEL_KEYS.map((ck) => ({ name: ck, amountKwd: aggUiChannels[ck].netKwd })).sort((a, b) => b.amountKwd - a.amountKwd),
    ...(liveBucket && bucket ? { buckets: { [bucket]: liveBucket } } : {}),
    ...(pulse ? { journeyPulse: pulse } : {}),
    ...(access ? { access } : {}),
    ...(analyticCostCenters ? { analyticCostCenters } : {}),
  }
}

/** Rejects cross-site browser calls (Fetch Metadata). Server-to-server calls without the header pass. */
export function isSameSiteRequest(headers: Headers): boolean {
  const site = headers.get('sec-fetch-site')
  return !site || site === 'same-origin' || site === 'none'
}
