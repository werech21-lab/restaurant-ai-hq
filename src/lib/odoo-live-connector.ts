/**
 * Production Odoo 17 Live JSON-RPC Connector (`src/lib/odoo-live-connector.ts`)
 *
 * Security & Architecture Guarantees:
 * - Strictly SERVER-ONLY: throws immediately if ever evaluated in a browser context (`typeof window !== 'undefined'`).
 * - Zero external dependencies; Node.js & Edge-compatible HTTPS `fetch` (`POST ${ODOO_URL}/jsonrpc`).
 * - Reads `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME` (fallback `ODOO_LOGIN`), and `ODOO_API_KEY` exclusively from `process.env`.
 * - NEVER exposes credentials, URLs, database names, or usernames in return payloads or error messages.
 * - Enforces 60-second server-side TTL cache (`LIVE_SNAPSHOT_TTL_MS = 60_000`) with instant bust on manual `POST` sync,
 *   in-flight request coalescing, and `0.000 KWD` dimensional reconciliation (`sum(Brands) === sum(Branches) === sum(Channels)`).
 */
import baselineSnapshot from '@/lib/odoo-live-snapshot.json'
import posRegistry from '@/lib/odoo/pos-registry.json'
import {
  channelOfPaymentMethod,
  computeOdooFreshnessStatus,
  normalizeOdooDateOrderToIso,
  parseBucketKey,
  summaryFromSnapshot,
  type OdooBucketSummary,
  type OdooLiveSummary,
  type OdooPeriodBucketKey,
  type OdooReceivableClearingSummary,
  type OdooStockTransferSummary,
} from '@/lib/odoo/live-sync-core'

if (typeof window !== 'undefined') {
  throw new Error(
    'Security violation: src/lib/odoo-live-connector.ts is strictly server-only and cannot be imported in client components.',
  )
}

const KUWAIT_OFFSET_MS = 3 * 3600 * 1000
const AUTH_TIMEOUT_MS = 10_000
const DEFAULT_KW_TIMEOUT_MS = 18_000
const AUTH_UID_TTL_MS = 15 * 60_000
const LIVE_SNAPSHOT_TTL_MS = 60_000

const ACTIVE_BRAND_IDS = [
  'china-garden',
  'franks',
  'tahina',
  'farm-brown',
  'noodle-bar',
  'karak-cafeteria',
] as const

const ACTIVE_BRANCH_IDS = [
  'avenues',
  '360-mall',
  'assima',
  'promenade',
  'salmiya',
  'al-kout',
  'ardiya',
] as const

const UI_CHANNEL_KEYS = [
  'dine-in',
  'takeaway-direct',
  'talabat-tgo',
  'talabat-tmp',
  'keeta',
  'deliveroo',
  'jahez',
  'snoonu',
] as const

type RegistryShape = {
  allowedPosConfigIds: number[]
  registers: Record<string, { location: string }>
  locations: Record<
    string,
    {
      en: string
      ar: string
      code: string
      unit: string
      analyticId?: number
      analyticIds?: number[]
    }
  >
  brands: {
    id: string
    en: string
    ar: string
    posRoot: string | null
    analyticId?: number
  }[]
}

const REG = posRegistry as unknown as RegistryShape

type M2O = [number, string] | false | null | undefined

interface ServerOdooConfig {
  url: string
  db: string
  username: string
  apiKey: string
}

export interface OdooLiveSyncEnvelope extends OdooLiveSummary {
  ok: true
  connected: boolean
  sourceMode: 'odoo17-live' | 'verified-baseline'
  envConfigured: boolean
  latestRecordAt: string
  kuwaitSyncedAt: string
  hoursSinceLatestRecord: number
  hoursSinceLatestOdooRecord: number
  isStaleOver24h: boolean
  todayOrdersCount: number
  todaySalesKwd: number
  lastCheckedAt: string
  readOnly: boolean
  cached?: boolean
}

interface CachedCoreSnapshot {
  fetchedAtMs: number
  connected: boolean
  sourceMode: 'odoo17-live' | 'verified-baseline'
  envConfigured: boolean
  latestRecordAt: string
  latestOperationalDate: string
  todayOrdersCount: number
  todaySalesKwd: number
  buckets: Record<OdooPeriodBucketKey, OdooBucketSummary>
  dailySeries: { day: string; orders: number; netKwd: number }[]
  hourlySeries: { hour: number; orders: number; netKwd: number }[]
  stockTransfers?: OdooStockTransferSummary
  aggregatorReceivables?: OdooReceivableClearingSummary
  journeyPulse?: OdooLiveSummary['journeyPulse']
  note?: string
}

let uidCache: {
  fingerprint: string
  uid: number
  expiresAtMs: number
} | null = null

let coreSnapshotCache: CachedCoreSnapshot | null = null
let inflightCorePull: Promise<CachedCoreSnapshot> | null = null
let rpcSequence = 0

const r3 = (n: number): number => Math.round((Number(n) || 0) * 1000) / 1000
const pct1 = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0

const m2oId = (v: unknown): number | null =>
  Array.isArray(v) && typeof v[0] === 'number' ? v[0] : null
const m2oName = (v: unknown): string | null =>
  Array.isArray(v) && typeof v[1] === 'string' ? v[1] : null

function assertServerRuntime(): void {
  if (typeof window !== 'undefined') {
    throw new Error('odoo-live-connector cannot execute in browser runtime.')
  }
}

function formatUtcIsoFromMs(ms: number): string {
  const safeMs = Number.isFinite(ms) ? ms : 0
  return new Date(safeMs).toISOString()
}

function readServerOdooConfig(): ServerOdooConfig | null {
  assertServerRuntime()
  const rawUrl = (process.env.ODOO_URL ?? '').trim().replace(/\/+$/, '')
  const db = (process.env.ODOO_DB ?? '').trim()
  const username = (process.env.ODOO_USERNAME ?? process.env.ODOO_LOGIN ?? '').trim()
  const apiKey = (process.env.ODOO_API_KEY ?? '').trim()

  if (!rawUrl || !db || !username || !apiKey) {
    return null
  }

  try {
    const parsed = new URL(rawUrl)
    const isLocalDev =
      parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    if (parsed.protocol !== 'https:' && !(isLocalDev && parsed.protocol === 'http:')) {
      return null
    }
  } catch {
    return null
  }

  return { url: rawUrl, db, username, apiKey }
}

export function isOdooLiveEnvConfigured(): boolean {
  return readServerOdooConfig() !== null
}

/** Strips all Odoo credentials, hostnames, DB names, usernames, and hex tokens from any string. */
export function redactOdooSecrets(rawMessage: unknown): string {
  let msg = typeof rawMessage === 'string' ? rawMessage : String(rawMessage ?? '')
  const secrets = [
    process.env.ODOO_API_KEY,
    process.env.ODOO_USERNAME,
    process.env.ODOO_LOGIN,
    process.env.ODOO_DB,
    process.env.ODOO_URL,
  ]
  for (const s of secrets) {
    const trimmed = (s ?? '').trim()
    if (trimmed.length >= 3) {
      msg = msg.split(trimmed).join('[REDACTED]')
    }
  }
  msg = msg.replace(/https?:\/\/[^\s"'<>]+/gi, '[REDACTED_URL]')
  msg = msg.replace(/\b[a-f0-9]{32,64}\b/gi, '[REDACTED_KEY]')
  return msg
}

/** Guarantees zero secret or infrastructure fields ever leave the server. */
export function sanitizeOdooPublicPayload<T extends object>(payload: T): T {
  const clone = { ...(payload as Record<string, unknown>) }
  clone.database = null
  delete clone.odooUrl
  delete clone.odooDb
  delete clone.odooUsername
  delete clone.odooLogin
  delete clone.odooApiKey
  delete clone.ODOO_URL
  delete clone.ODOO_DB
  delete clone.ODOO_USERNAME
  delete clone.ODOO_API_KEY
  if (typeof clone.note === 'string') {
    clone.note = redactOdooSecrets(clone.note)
  }
  if (typeof clone.message === 'string') {
    clone.message = redactOdooSecrets(clone.message)
  }
  return clone as T
}

function configFingerprint(cfg: ServerOdooConfig): string {
  return `${cfg.url.length}:${cfg.db.length}:${cfg.username.length}:${cfg.apiKey.slice(0, 4).length}`
}

async function rawOdooJsonRpc<T = unknown>(
  cfg: ServerOdooConfig,
  service: 'common' | 'object',
  method: string,
  args: unknown[],
  timeoutMs: number,
): Promise<T> {
  assertServerRuntime()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${cfg.url}/jsonrpc`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        id: ++rpcSequence,
        params: { service, method, args },
      }),
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`Odoo JSON-RPC HTTP ${res.status}`)
    }

    const body = (await res.json()) as {
      result?: T
      error?: { message?: string; data?: { message?: string; name?: string } }
    }

    if (body.error) {
      const detail =
        body.error.data?.message || body.error.message || 'Odoo JSON-RPC execution error'
      throw new Error(redactOdooSecrets(detail))
    }

    return body.result as T
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'Odoo network error'
    throw new Error(redactOdooSecrets(rawMsg))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Authenticates against Odoo 17 `common.authenticate` with `10s` `AbortController` timeout
 * and 15-minute in-memory UID caching.
 */
export async function authenticateOdoo(options?: {
  forceReauth?: boolean
  timeoutMs?: number
}): Promise<number> {
  const cfg = readServerOdooConfig()
  if (!cfg) {
    throw new Error('Odoo 17 environment variables are not configured on the server.')
  }

  const fp = configFingerprint(cfg)
  const nowMs = Date.now()
  if (
    !options?.forceReauth &&
    uidCache &&
    uidCache.fingerprint === fp &&
    uidCache.expiresAtMs > nowMs &&
    uidCache.uid > 0
  ) {
    return uidCache.uid
  }

  const uid = await rawOdooJsonRpc<number | false>(
    cfg,
    'common',
    'authenticate',
    [cfg.db, cfg.username, cfg.apiKey, {}],
    options?.timeoutMs ?? AUTH_TIMEOUT_MS,
  )

  if (typeof uid !== 'number' || uid <= 0) {
    uidCache = null
    throw new Error('Odoo 17 authentication refused for service user.')
  }

  uidCache = {
    fingerprint: fp,
    uid,
    expiresAtMs: nowMs + AUTH_UID_TTL_MS,
  }
  return uid
}

/**
 * Typed Odoo 17 `object.execute_kw` caller with automatic 1x re-authentication on stale UID.
 */
export async function executeOdooKw<T = unknown>(
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
  options?: { timeoutMs?: number },
): Promise<T> {
  const cfg = readServerOdooConfig()
  if (!cfg) {
    throw new Error('Odoo 17 environment variables are not configured on the server.')
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_KW_TIMEOUT_MS
  let uid = await authenticateOdoo({ timeoutMs: Math.min(timeoutMs, AUTH_TIMEOUT_MS) })

  try {
    return await rawOdooJsonRpc<T>(
      cfg,
      'object',
      'execute_kw',
      [cfg.db, uid, cfg.apiKey, model, method, args, kwargs],
      timeoutMs,
    )
  } catch (firstErr) {
    const errText = firstErr instanceof Error ? firstErr.message.toLowerCase() : ''
    if (errText.includes('session') || errText.includes('access denied') || errText.includes('uid')) {
      uid = await authenticateOdoo({ forceReauth: true, timeoutMs: AUTH_TIMEOUT_MS })
      return rawOdooJsonRpc<T>(
        cfg,
        'object',
        'execute_kw',
        [cfg.db, uid, cfg.apiKey, model, method, args, kwargs],
        timeoutMs,
      )
    }
    throw firstErr
  }
}

/** Busts the 60-second server-side Odoo live snapshot cache immediately. */
export function bustOdooLiveCache(): void {
  coreSnapshotCache = null
  inflightCorePull = null
}

function reconcileAmounts(
  rawMap: Map<string, number>,
  keys: readonly string[],
  targetTotal: number,
): Map<string, number> {
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

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const baseMs = Date.parse(`${isoDate}T00:00:00.000Z`)
  return new Date(baseMs + deltaDays * 86_400_000).toISOString().slice(0, 10)
}

function kuwaitRangeToOdooUtcStrings(fromKuwaitIso: string, toExclusiveKuwaitIso: string): {
  fromUtc: string
  toUtc: string
} {
  const startUtcMs = Date.parse(`${fromKuwaitIso}T00:00:00.000Z`) - KUWAIT_OFFSET_MS
  const endUtcMs = Date.parse(`${toExclusiveKuwaitIso}T00:00:00.000Z`) - KUWAIT_OFFSET_MS
  const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
  return { fromUtc: fmt(startUtcMs), toUtc: fmt(endUtcMs) }
}

/**
 * Maps an Odoo `pos.config` record to one of Venture Foods' 7 active restaurant branches,
 * using `pos-registry.json` first and smart fuzzy matching for newly added restaurant terminals
 * while strictly isolating exhibitions/catering/test registers.
 */
function resolveRestaurantBranchForConfig(
  cfgId: number,
  cfgName: string,
): (typeof ACTIVE_BRANCH_IDS)[number] | null {
  const regEntry = REG.registers[String(cfgId)]
  if (regEntry) {
    const loc = regEntry.location
    if (loc === 'call-center') return 'ardiya'
    if (REG.locations[loc]?.unit === 'restaurant' && (ACTIVE_BRANCH_IDS as readonly string[]).includes(loc)) {
      return loc as (typeof ACTIVE_BRANCH_IDS)[number]
    }
    return null
  }

  const lower = (cfgName || '').toLowerCase()
  if (
    /exhibition|bazaar|booth|catering|test|training|admin|closed|demo/i.test(lower)
  ) {
    return null
  }
  if (/avenues|افنيوز|الأفنيوز/.test(lower)) return 'avenues'
  if (/360/.test(lower)) return '360-mall'
  if (/assima|عاصمة|العاصمة/.test(lower)) return 'assima'
  if (/promenade|بروميناد/.test(lower)) return 'promenade'
  if (/salmiya|salmyia|سالمية|السالمية/.test(lower)) return 'salmiya'
  if (/kout|كوت|الكوت/.test(lower)) return 'al-kout'
  if (/ardiya|central|call\s*center|عارضية|العارضية/.test(lower)) return 'ardiya'
  return null
}

function mapPaymentChannelToUiChannel(
  paymentChannelName: string,
  isDeliveryTerminal: boolean,
): (typeof UI_CHANNEL_KEYS)[number] {
  if (paymentChannelName === 'Talabat Go') return 'talabat-tgo'
  if (paymentChannelName === 'Talabat MP') return 'talabat-tmp'
  if (paymentChannelName === 'Keeta') return 'keeta'
  if (paymentChannelName === 'Deliveroo Go' || paymentChannelName === 'Deliveroo MP') return 'deliveroo'
  if (paymentChannelName === 'Jahez' || paymentChannelName === 'Cari') return 'jahez'
  if (paymentChannelName === 'Snoonu') return 'snoonu'
  if (
    paymentChannelName === 'Online payment link' ||
    paymentChannelName === 'Cash on delivery' ||
    paymentChannelName === 'Bilbayt'
  ) {
    return 'takeaway-direct'
  }
  return isDeliveryTerminal ? 'takeaway-direct' : 'dine-in'
}

function buildBaselineFallbackCore(note?: string): CachedCoreSnapshot {
  const baseMonth = summaryFromSnapshot(baselineSnapshot, note, 'month')
  const baseToday = summaryFromSnapshot(baselineSnapshot, note, 'today')
  const baseWeek = summaryFromSnapshot(baselineSnapshot, note, 'week')
  const baseYear = summaryFromSnapshot(baselineSnapshot, note, 'year')

  const rawSnap = baselineSnapshot as unknown as {
    buckets?: Partial<Record<OdooPeriodBucketKey, OdooBucketSummary>>
    timeProfile?: {
      daily?: { day: string; orders: number; netKwd: number }[]
      hourly?: { hour: number; orders: number; netKwd: number }[]
    }
  }

  const fallbackBucket = (
    key: OdooPeriodBucketKey,
    sum: OdooLiveSummary,
    days: number,
  ): OdooBucketSummary =>
    rawSnap.buckets?.[key] ?? {
      key,
      from: sum.period.from || '2026-10-12',
      to: sum.period.to || '2026-11-11',
      days,
      totals: {
        netSalesKwd: sum.totals.netSalesKwd,
        orders: sum.totals.orders,
        aovKwd: sum.totals.aovKwd,
        restaurantNetKwd: sum.totals.netSalesKwd,
        restaurantOrders: sum.totals.orders,
      },
    }

  const buckets: Record<OdooPeriodBucketKey, OdooBucketSummary> = {
    today: fallbackBucket('today', baseToday, 1),
    week: fallbackBucket('week', baseWeek, 7),
    month: fallbackBucket('month', baseMonth, 30),
    year: fallbackBucket('year', baseYear, 315),
  }

  return {
    fetchedAtMs: Date.now(),
    connected: false,
    sourceMode: 'verified-baseline',
    envConfigured: isOdooLiveEnvConfigured(),
    latestRecordAt: baseMonth.latestRecordAt ?? baseMonth.syncedAt,
    latestOperationalDate: baseMonth.latestOperationalDate ?? '2026-11-10',
    todayOrdersCount: 0,
    todaySalesKwd: 0,
    buckets,
    dailySeries: rawSnap.timeProfile?.daily ?? [],
    hourlySeries: rawSnap.timeProfile?.hourly ?? [],
    journeyPulse: baseMonth.journeyPulse,
    note:
      note ??
      (isOdooLiveEnvConfigured()
        ? 'Live Odoo 17 temporarily unreachable; displaying verified baseline ledger snapshot.'
        : 'ODOO_API_KEY is not configured in server environment; displaying verified baseline ledger snapshot.'),
  }
}

async function safeSubQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

function buildReconciledBucket(params: {
  key: OdooPeriodBucketKey
  from: string
  to: string
  days: number
  isLatestOperationalDay?: boolean
  locNetMap: Map<string, number>
  locOrdersMap: Map<string, number>
  brandRawWeights: Map<string, number>
  brandQtyWeights: Map<string, number>
  locUiRawMap: Map<string, Record<string, { netKwd: number; orders: number }>>
  accounting?: OdooBucketSummary['accounting']
}): OdooBucketSummary {
  const {
    key,
    from,
    to,
    days,
    isLatestOperationalDay,
    locNetMap,
    locOrdersMap,
    brandRawWeights,
    brandQtyWeights,
    locUiRawMap,
    accounting,
  } = params

  const targetNet = r3(
    ACTIVE_BRANCH_IDS.reduce((acc, lid) => acc + Math.max(0, locNetMap.get(lid) ?? 0), 0),
  )
  const totalOrders = Math.max(
    0,
    Math.round(
      ACTIVE_BRANCH_IDS.reduce((acc, lid) => acc + Math.max(0, locOrdersMap.get(lid) ?? 0), 0),
    ),
  )

  const reconciledLocNet = reconcileAmounts(locNetMap, ACTIVE_BRANCH_IDS, targetNet)
  const reconciledBrandNet = reconcileAmounts(brandRawWeights, ACTIVE_BRAND_IDS, targetNet)

  const byBrand: NonNullable<OdooBucketSummary['byBrand']> = {}
  for (const bid of ACTIVE_BRAND_IDS) {
    const nv = reconciledBrandNet.get(bid) ?? 0
    byBrand[bid] = {
      netKwd: nv,
      orders:
        nv > 0 && targetNet > 0
          ? Math.max(1, Math.round((nv / targetNet) * totalOrders))
          : 0,
      qty: r3(brandQtyWeights.get(bid) ?? 0),
    }
  }

  const byLocation: NonNullable<OdooBucketSummary['byLocation']> = {}
  const aggUiChannels: Record<string, { netKwd: number; orders: number }> = Object.fromEntries(
    UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }]),
  )

  for (const lid of ACTIVE_BRANCH_IDS) {
    const locTarget = reconciledLocNet.get(lid) ?? 0
    const locOrd = Math.max(0, Math.round(locOrdersMap.get(lid) ?? 0))
    const rawUi =
      locUiRawMap.get(lid) ??
      Object.fromEntries(UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }]))

    const rawUiMap = new Map<string, number>(
      UI_CHANNEL_KEYS.map((ck) => [ck, Math.max(0, rawUi[ck]?.netKwd ?? 0)]),
    )
    if (lid === 'ardiya' && (rawUiMap.get('dine-in') ?? 0) > 0) {
      rawUiMap.set(
        'takeaway-direct',
        (rawUiMap.get('takeaway-direct') ?? 0) + (rawUiMap.get('dine-in') ?? 0),
      )
      rawUiMap.set('dine-in', 0)
    }

    const allowedCk =
      lid === 'ardiya' ? UI_CHANNEL_KEYS.filter((ck) => ck !== 'dine-in') : UI_CHANNEL_KEYS
    const recUi = reconcileAmounts(rawUiMap, allowedCk, locTarget)
    const locUi: Record<string, { netKwd: number; orders: number }> = {}
    for (const ck of UI_CHANNEL_KEYS) {
      const nv = r3(recUi.get(ck) ?? 0)
      const ov =
        nv > 0
          ? Math.max(
              1,
              locTarget > 0 && locOrd > 0
                ? Math.round((nv / locTarget) * locOrd)
                : Math.round(nv / 4.8),
            )
          : 0
      locUi[ck] = { netKwd: nv, orders: ov }
      aggUiChannels[ck].netKwd = r3(aggUiChannels[ck].netKwd + nv)
      aggUiChannels[ck].orders += ov
    }

    byLocation[lid] = {
      netKwd: locTarget,
      orders: locOrd,
      uiChannels: locUi,
    }
  }

  const aggRawMap = new Map<string, number>(
    UI_CHANNEL_KEYS.map((ck) => [ck, aggUiChannels[ck].netKwd]),
  )
  const reconciledAggUi = reconcileAmounts(aggRawMap, UI_CHANNEL_KEYS, targetNet)
  for (const ck of UI_CHANNEL_KEYS) {
    aggUiChannels[ck].netKwd = reconciledAggUi.get(ck) ?? 0
  }

  return {
    key,
    from,
    to,
    days,
    ...(isLatestOperationalDay ? { isLatestOperationalDay: true } : {}),
    totals: {
      netSalesKwd: targetNet,
      orders: totalOrders,
      aovKwd: totalOrders > 0 ? r3(targetNet / totalOrders) : 0,
      restaurantNetKwd: targetNet,
      restaurantOrders: totalOrders,
    },
    byBrand,
    byLocation,
    uiChannels: aggUiChannels,
    ...(accounting ? { accounting } : {}),
  }
}

async function pullFreshCoreSnapshotFromOdoo(): Promise<CachedCoreSnapshot> {
  const cfg = readServerOdooConfig()
  if (!cfg) {
    return buildBaselineFallbackCore()
  }

  // 1. Discover & map POS configs + POS categories
  const [allConfigs, posCategories] = await Promise.all([
    executeOdooKw<{ id: number; name: string; company_id?: M2O }[]>(
      'pos.config',
      'search_read',
      [[['active', 'in', [true, false]]]],
      { fields: ['id', 'name', 'company_id'], context: { active_test: false } },
    ),
    safeSubQuery(
      () =>
        executeOdooKw<{ id: number; name: string; parent_id: M2O }[]>(
          'pos.category',
          'search_read',
          [[]],
          { fields: ['id', 'name', 'parent_id'] },
        ),
      [],
    ),
  ])

  const branchOfConfigId = new Map<number, (typeof ACTIVE_BRANCH_IDS)[number]>()
  const configNameById = new Map<number, string>()
  for (const c of allConfigs) {
    configNameById.set(c.id, c.name)
    const mappedBranch = resolveRestaurantBranchForConfig(c.id, c.name)
    if (mappedBranch) {
      branchOfConfigId.set(c.id, mappedBranch)
    }
  }
  // Ensure every whitelisted restaurant config ID in registry is included even if omitted above
  for (const cfgId of REG.allowedPosConfigIds) {
    if (!branchOfConfigId.has(cfgId)) {
      const b = resolveRestaurantBranchForConfig(cfgId, configNameById.get(cfgId) ?? '')
      if (b) branchOfConfigId.set(cfgId, b)
    }
  }
  const restaurantConfigIds = [...branchOfConfigId.keys()]

  const catById = new Map(posCategories.map((c) => [c.id, c]))
  const resolveRootCatName = (catId: number | null): string | null => {
    let cur = catId ? catById.get(catId) : undefined
    let guard = 0
    while (cur && cur.parent_id && guard++ < 12) {
      cur = catById.get(m2oId(cur.parent_id) ?? -1)
    }
    return cur?.name ?? null
  }
  const brandByPosRoot = new Map(
    REG.brands.filter((b) => b.posRoot).map((b) => [b.posRoot as string, b.id]),
  )

  // 2. Compute exact Kuwait (`UTC+3`) calendar windows
  const nowUtcMs = Date.now()
  const kwNow = new Date(nowUtcMs + KUWAIT_OFFSET_MS)
  const todayKwIso = kwNow.toISOString().slice(0, 10)
  const tomorrowKwIso = shiftIsoDate(todayKwIso, 1)
  const weekFromKwIso = shiftIsoDate(todayKwIso, -6) // 7 inclusive Kuwait days: [today-6 .. today]
  const monthFromKwIso = shiftIsoDate(todayKwIso, -29) // 30 inclusive Kuwait days: [today-29 .. today]
  const series35FromKwIso = shiftIsoDate(todayKwIso, -34) // 35 Kuwait days for curves & comparison
  const prior30FromKwIso = shiftIsoDate(todayKwIso, -59)
  const mtdFromKwIso = `${todayKwIso.slice(0, 7)}-01`
  const yearFromKwIso = `${todayKwIso.slice(0, 4)}-01-01`

  const bounds35 = kuwaitRangeToOdooUtcStrings(series35FromKwIso, tomorrowKwIso)
  const boundsMonth = kuwaitRangeToOdooUtcStrings(monthFromKwIso, tomorrowKwIso)
  const boundsToday = kuwaitRangeToOdooUtcStrings(todayKwIso, tomorrowKwIso)
  const boundsYear = kuwaitRangeToOdooUtcStrings(yearFromKwIso, tomorrowKwIso)
  const boundsPrior30 = kuwaitRangeToOdooUtcStrings(prior30FromKwIso, monthFromKwIso)

  // 3. Parallel live queries (POS grouped daily/hourly orders, payments, product lines, YTD, stock transfers, AR clearing)
  const [
    latestOrderRows,
    ordersByDaySessionRows,
    ordersByHourRows,
    payments30Rows,
    paymentsTodayRows,
    productLines30Rows,
    productLinesTodayRows,
    ytdAggRows,
    prior30AggRows,
    stockTransfers,
    aggregatorReceivables,
  ] = await Promise.all([
    executeOdooKw<{ id: number; date_order: string }[]>(
      'pos.order',
      'search_read',
      [
        [
          ['state', 'in', ['paid', 'done', 'invoiced']],
          ['session_id.config_id', 'in', restaurantConfigIds],
        ],
      ],
      { fields: ['id', 'date_order'], order: 'date_order desc', limit: 1 },
    ),
    executeOdooKw<
      {
        __count?: number
        amount_total?: number
        amount_tax?: number
        session_id: M2O
        __range?: { 'date_order:day'?: { from?: string; to?: string } }
      }[]
    >(
      'pos.order',
      'read_group',
      [
        [
          ['date_order', '>=', bounds35.fromUtc],
          ['date_order', '<', bounds35.toUtc],
          ['state', 'in', ['paid', 'done', 'invoiced']],
          ['session_id.config_id', 'in', restaurantConfigIds],
        ],
        ['amount_total:sum', 'amount_tax:sum'],
        ['date_order:day', 'session_id'],
      ],
      { lazy: false, context: { tz: 'Asia/Kuwait' } },
    ),
    safeSubQuery(
      () =>
        executeOdooKw<
          {
            __count?: number
            amount_total?: number
            amount_tax?: number
            __range?: { 'date_order:hour'?: { from?: string; to?: string } }
          }[]
        >(
          'pos.order',
          'read_group',
          [
            [
              ['date_order', '>=', boundsMonth.fromUtc],
              ['date_order', '<', boundsMonth.toUtc],
              ['state', 'in', ['paid', 'done', 'invoiced']],
              ['session_id.config_id', 'in', restaurantConfigIds],
            ],
            ['amount_total:sum', 'amount_tax:sum'],
            ['date_order:hour'],
          ],
          { lazy: false, context: { tz: 'Asia/Kuwait' } },
        ),
      [],
    ),
    safeSubQuery(
      () =>
        executeOdooKw<
          {
            session_id: M2O
            payment_method_id: M2O
            amount: number
            __count?: number
          }[]
        >(
          'pos.payment',
          'read_group',
          [
            [
              ['pos_order_id.date_order', '>=', boundsMonth.fromUtc],
              ['pos_order_id.date_order', '<', boundsMonth.toUtc],
              ['pos_order_id.state', 'in', ['paid', 'done', 'invoiced']],
              ['session_id.config_id', 'in', restaurantConfigIds],
            ],
            ['amount:sum'],
            ['session_id', 'payment_method_id'],
          ],
          { lazy: false },
        ),
      [],
    ),
    safeSubQuery(
      () =>
        executeOdooKw<
          {
            session_id: M2O
            payment_method_id: M2O
            amount: number
            __count?: number
          }[]
        >(
          'pos.payment',
          'read_group',
          [
            [
              ['pos_order_id.date_order', '>=', boundsToday.fromUtc],
              ['pos_order_id.date_order', '<', boundsToday.toUtc],
              ['pos_order_id.state', 'in', ['paid', 'done', 'invoiced']],
              ['session_id.config_id', 'in', restaurantConfigIds],
            ],
            ['amount:sum'],
            ['session_id', 'payment_method_id'],
          ],
          { lazy: false },
        ),
      [],
    ),
    safeSubQuery(
      () =>
        executeOdooKw<{ product_id: M2O; price_subtotal: number; qty?: number }[]>(
          'pos.order.line',
          'read_group',
          [
            [
              ['order_id.date_order', '>=', boundsMonth.fromUtc],
              ['order_id.date_order', '<', boundsMonth.toUtc],
              ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
              ['order_id.session_id.config_id', 'in', restaurantConfigIds],
            ],
            ['price_subtotal:sum', 'qty:sum'],
            ['product_id'],
          ],
          { lazy: false },
        ),
      [],
    ),
    safeSubQuery(
      () =>
        executeOdooKw<{ product_id: M2O; price_subtotal: number; qty?: number }[]>(
          'pos.order.line',
          'read_group',
          [
            [
              ['order_id.date_order', '>=', boundsToday.fromUtc],
              ['order_id.date_order', '<', boundsToday.toUtc],
              ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
              ['order_id.session_id.config_id', 'in', restaurantConfigIds],
            ],
            ['price_subtotal:sum', 'qty:sum'],
            ['product_id'],
          ],
          { lazy: false },
        ),
      [],
    ),
    safeSubQuery(
      () =>
        executeOdooKw<{ amount_total?: number; amount_tax?: number; __count?: number }[]>(
          'pos.order',
          'read_group',
          [
            [
              ['date_order', '>=', boundsYear.fromUtc],
              ['date_order', '<', boundsYear.toUtc],
              ['state', 'in', ['paid', 'done', 'invoiced']],
              ['session_id.config_id', 'in', restaurantConfigIds],
            ],
            ['amount_total:sum', 'amount_tax:sum'],
            [],
          ],
          { lazy: false },
        ),
      [],
    ),
    safeSubQuery(
      () =>
        executeOdooKw<{ amount_total?: number; amount_tax?: number; __count?: number }[]>(
          'pos.order',
          'read_group',
          [
            [
              ['date_order', '>=', boundsPrior30.fromUtc],
              ['date_order', '<', boundsPrior30.toUtc],
              ['state', 'in', ['paid', 'done', 'invoiced']],
              ['session_id.config_id', 'in', restaurantConfigIds],
            ],
            ['amount_total:sum', 'amount_tax:sum'],
            [],
          ],
          { lazy: false },
        ),
      [],
    ),
    // Optional isolated sub-query 3: Central Kitchen / Branch stock.picking transfers
    safeSubQuery<OdooStockTransferSummary | undefined>(async () => {
      const pickings = await executeOdooKw<
        {
          id: number
          state: string
          scheduled_date?: string | false
          date_done?: string | false
          location_id?: M2O
          location_dest_id?: M2O
        }[]
      >(
        'stock.picking',
        'search_read',
        [[['state', 'in', ['done', 'assigned', 'waiting', 'confirmed']]]],
        {
          fields: ['state', 'scheduled_date', 'date_done', 'location_id', 'location_dest_id'],
          order: 'id desc',
          limit: 15,
        },
        { timeoutMs: 8_000 },
      )
      const recentDoneCount = pickings.filter((p) => p.state === 'done').length
      const pendingCount = pickings.filter((p) => p.state !== 'done').length
      const latestDoneRaw = pickings.find((p) => typeof p.date_done === 'string')?.date_done
      const latestTransferAt =
        typeof latestDoneRaw === 'string' ? normalizeOdooDateOrderToIso(latestDoneRaw) : null
      return {
        readable: true,
        recentDoneCount,
        pendingCount,
        latestTransferAt,
        routes: pickings.slice(0, 6).map((p) => ({
          origin: m2oName(p.location_id) ?? 'Central Warehouse',
          destination: m2oName(p.location_dest_id) ?? 'Branch Kitchen',
          state: p.state,
          scheduledDate:
            typeof p.scheduled_date === 'string'
              ? normalizeOdooDateOrderToIso(p.scheduled_date)
              : null,
        })),
      }
    }, undefined),
    // Optional isolated sub-query 4: Open aggregator/customer receivable clearing lines
    safeSubQuery<OdooReceivableClearingSummary | undefined>(async () => {
      const rows = await executeOdooKw<{ amount_residual?: number; __count?: number }[]>(
        'account.move.line',
        'read_group',
        [
          [
            ['parent_state', '=', 'posted'],
            ['account_id.account_type', '=', 'asset_receivable'],
            ['reconciled', '=', false],
          ],
          ['amount_residual:sum'],
          [],
        ],
        { lazy: false },
        { timeoutMs: 8_000 },
      )
      return {
        readable: true,
        openReceivableKwd: r3(Math.max(0, Number(rows?.[0]?.amount_residual ?? 0))),
        openLinesCount: Math.max(0, Number(rows?.[0]?.__count ?? 0)),
      }
    }, undefined),
  ])

  // 4. Resolve session -> config_id mapping for all encountered sessions + product -> brand mapping
  const allSessionIds = [
    ...new Set(
      [
        ...ordersByDaySessionRows.map((o) => m2oId(o.session_id)),
        ...payments30Rows.map((p) => m2oId(p.session_id)),
        ...paymentsTodayRows.map((p) => m2oId(p.session_id)),
      ].filter((x): x is number => x !== null),
    ),
  ]

  const allProductIds = [
    ...new Set(
      [...productLines30Rows, ...productLinesTodayRows]
        .map((l) => m2oId(l.product_id))
        .filter((x): x is number => x !== null),
    ),
  ]

  const [sessionRecords, productRecords] = await Promise.all([
    allSessionIds.length > 0
      ? safeSubQuery(
          () =>
            executeOdooKw<{ id: number; config_id: M2O }[]>(
              'pos.session',
              'read',
              [allSessionIds, ['id', 'config_id']],
            ),
          [],
        )
      : Promise.resolve([]),
    allProductIds.length > 0
      ? safeSubQuery(
          () =>
            executeOdooKw<{ id: number; pos_categ_id: M2O }[]>(
              'product.product',
              'read',
              [allProductIds, ['id', 'pos_categ_id']],
            ),
          [],
        )
      : Promise.resolve([]),
  ])

  const configOfSession = new Map<number, number>()
  for (const s of sessionRecords) {
    const cid = m2oId(s.config_id)
    if (cid !== null) configOfSession.set(s.id, cid)
  }

  const brandOfProductId = new Map<number, string>()
  for (const p of productRecords) {
    const rootName = resolveRootCatName(m2oId(p.pos_categ_id))
    const bid = rootName ? brandByPosRoot.get(rootName) : undefined
    if (bid && (ACTIVE_BRAND_IDS as readonly string[]).includes(bid)) {
      brandOfProductId.set(p.id, bid)
    }
  }

  // 5. Aggregate daily & hourly Kuwait series + per-branch totals for Today, Week (7d), Month (30d), MTD
  const dailyMap = new Map<string, { orders: number; netKwd: number }>()
  const dailyLocMap = new Map<
    string,
    Map<string, { orders: number; net: number }>
  >()
  const hourlyAcc = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orders: 0,
    netKwd: 0,
  }))

  const locTodayNet = new Map<string, number>()
  const locTodayOrd = new Map<string, number>()
  const locWeekNet = new Map<string, number>()
  const locWeekOrd = new Map<string, number>()
  const locMonthNet = new Map<string, number>()
  const locMonthOrd = new Map<string, number>()
  let mtdNet = 0
  let mtdOrders = 0

  const newestOrderIso: string | null = normalizeOdooDateOrderToIso(
    latestOrderRows?.[0]?.date_order,
  )

  for (const row of ordersByDaySessionRows) {
    const rawFromUtc = row.__range?.['date_order:day']?.from
    const parsedRangeIso = rawFromUtc ? normalizeOdooDateOrderToIso(rawFromUtc) : null
    if (!parsedRangeIso) continue

    const sid = m2oId(row.session_id)
    const cfgId = sid !== null ? configOfSession.get(sid) : undefined
    const branch = cfgId !== undefined ? branchOfConfigId.get(cfgId) : undefined
    if (!branch) continue

    const kwDt = new Date(Date.parse(parsedRangeIso) + KUWAIT_OFFSET_MS)
    const dayIso = kwDt.toISOString().slice(0, 10)
    const ordCount = Math.max(0, Number(row.__count ?? 0))
    const net = Math.max(0, (Number(row.amount_total) || 0) - (Number(row.amount_tax) || 0))
    if (ordCount <= 0 && net <= 0) continue

    const dPrev = dailyMap.get(dayIso) ?? { orders: 0, netKwd: 0 }
    dPrev.orders += ordCount
    dPrev.netKwd += net
    dailyMap.set(dayIso, dPrev)

    let byB = dailyLocMap.get(dayIso)
    if (!byB) {
      byB = new Map()
      dailyLocMap.set(dayIso, byB)
    }
    const lbPrev = byB.get(branch) ?? { orders: 0, net: 0 }
    lbPrev.orders += ordCount
    lbPrev.net += net
    byB.set(branch, lbPrev)

    if (dayIso >= monthFromKwIso && dayIso <= todayKwIso) {
      locMonthNet.set(branch, (locMonthNet.get(branch) ?? 0) + net)
      locMonthOrd.set(branch, (locMonthOrd.get(branch) ?? 0) + ordCount)
    }
    if (dayIso >= weekFromKwIso && dayIso <= todayKwIso) {
      locWeekNet.set(branch, (locWeekNet.get(branch) ?? 0) + net)
      locWeekOrd.set(branch, (locWeekOrd.get(branch) ?? 0) + ordCount)
    }
    if (dayIso === todayKwIso) {
      locTodayNet.set(branch, (locTodayNet.get(branch) ?? 0) + net)
      locTodayOrd.set(branch, (locTodayOrd.get(branch) ?? 0) + ordCount)
    }
    if (dayIso >= mtdFromKwIso && dayIso <= todayKwIso) {
      mtdNet += net
      mtdOrders += ordCount
    }
  }

  for (const hRow of ordersByHourRows) {
    const rawHourFromUtc = hRow.__range?.['date_order:hour']?.from
    const parsedHourIso = rawHourFromUtc ? normalizeOdooDateOrderToIso(rawHourFromUtc) : null
    if (!parsedHourIso) continue
    const kwDt = new Date(Date.parse(parsedHourIso) + KUWAIT_OFFSET_MS)
    const kwHour = kwDt.getUTCHours()
    const ordCount = Math.max(0, Number(hRow.__count ?? 0))
    const net = Math.max(0, (Number(hRow.amount_total) || 0) - (Number(hRow.amount_tax) || 0))
    hourlyAcc[kwHour].orders += ordCount
    hourlyAcc[kwHour].netKwd += net
  }

  const dailySeries = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, orders: v.orders, netKwd: r3(v.netKwd) }))

  const hourlySeries = hourlyAcc.map((h) => ({
    hour: h.hour,
    orders: h.orders,
    netKwd: r3(h.netKwd),
  }))

  const rawTodayOrdersCount = ACTIVE_BRANCH_IDS.reduce(
    (s, b) => s + (locTodayOrd.get(b) ?? 0),
    0,
  )
  const rawTodaySalesKwd = r3(
    ACTIVE_BRANCH_IDS.reduce((s, b) => s + (locTodayNet.get(b) ?? 0), 0),
  )

  // If Kuwait today has 0 orders yet (e.g. 4:00 AM before doors open), populate `buckets.today`
  // with the latest completed operational POS day while reporting `todayOrdersCount: 0` honestly in telemetry!
  let todayBucketFrom = todayKwIso
  let todayBucketTo = tomorrowKwIso
  let todayIsFallbackDay = false
  if (rawTodayOrdersCount <= 0 && dailySeries.length > 0) {
    const latestNonZeroDay = [...dailySeries].reverse().find((d) => d.orders > 0 && d.netKwd > 0)
    if (latestNonZeroDay) {
      todayBucketFrom = latestNonZeroDay.day
      todayBucketTo = shiftIsoDate(latestNonZeroDay.day, 1)
      todayIsFallbackDay = true
      const byB = dailyLocMap.get(latestNonZeroDay.day)
      if (byB) {
        for (const [b, vals] of byB.entries()) {
          locTodayNet.set(b, vals.net)
          locTodayOrd.set(b, vals.orders)
        }
      }
    }
  }

  // 6. Aggregate Brand weights & Channel weights (30d & Today)
  const buildBrandMaps = (rows: { product_id: M2O; price_subtotal: number; qty?: number }[]) => {
    const netMap = new Map<string, number>()
    const qtyMap = new Map<string, number>()
    for (const r of rows) {
      const pid = m2oId(r.product_id)
      const bid = pid !== null ? brandOfProductId.get(pid) : undefined
      if (!bid) continue
      netMap.set(bid, (netMap.get(bid) ?? 0) + Math.max(0, Number(r.price_subtotal) || 0))
      qtyMap.set(bid, (qtyMap.get(bid) ?? 0) + Math.max(0, Number(r.qty) || 0))
    }
    return { netMap, qtyMap }
  }

  const brand30 = buildBrandMaps(productLines30Rows)
  const brandTodayRaw = buildBrandMaps(productLinesTodayRows)
  const hasTodayBrandLines = [...brandTodayRaw.netMap.values()].some((v) => v > 0)
  const brandToday = hasTodayBrandLines ? brandTodayRaw : brand30

  const buildLocUiMap = (
    payRows: { session_id: M2O; payment_method_id: M2O; amount: number; __count?: number }[],
  ) => {
    const map = new Map<string, Record<string, { netKwd: number; orders: number }>>()
    for (const lid of ACTIVE_BRANCH_IDS) {
      map.set(
        lid,
        Object.fromEntries(UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }])),
      )
    }
    for (const p of payRows) {
      const sid = m2oId(p.session_id)
      const cfgId = sid !== null ? configOfSession.get(sid) : undefined
      const lid = cfgId !== undefined ? branchOfConfigId.get(cfgId) : undefined
      if (!lid) continue
      const cfgName = (cfgId !== undefined ? configNameById.get(cfgId) : '') ?? ''
      const isDelivCfg = lid === 'ardiya' || /delivery|call\s*center/i.test(cfgName)
      const pmChannel = channelOfPaymentMethod(m2oName(p.payment_method_id) ?? '')
      const uiKey = mapPaymentChannelToUiChannel(pmChannel, isDelivCfg)
      const row = map.get(lid)!
      row[uiKey].netKwd += Math.max(0, Number(p.amount) || 0)
      row[uiKey].orders += Math.max(0, Number(p.__count) || 0)
    }
    return map
  }

  const locUi30 = buildLocUiMap(payments30Rows)
  const locUiTodayRaw = buildLocUiMap(paymentsTodayRows)
  const hasTodayPayments = paymentsTodayRows.some((p) => (Number(p.amount) || 0) > 0)
  const locUiToday = hasTodayPayments && !todayIsFallbackDay ? locUiTodayRaw : locUi30

  // 7. Build YTD bucket (`year`) from 1-row live aggregate + 30d branch/brand/channel distribution
  const ytdTotalNet = r3(
    Math.max(
      0,
      (Number(ytdAggRows?.[0]?.amount_total) || 0) -
        (Number(ytdAggRows?.[0]?.amount_tax) || 0),
    ),
  )
  const ytdTotalOrd = Math.max(0, Number(ytdAggRows?.[0]?.__count ?? 0))
  const monthSumNet = ACTIVE_BRANCH_IDS.reduce((s, l) => s + (locMonthNet.get(l) ?? 0), 0)
  const monthSumOrd = ACTIVE_BRANCH_IDS.reduce((s, l) => s + (locMonthOrd.get(l) ?? 0), 0)
  const locYearNet = new Map<string, number>()
  const locYearOrd = new Map<string, number>()
  if (ytdTotalOrd > 0 && ytdTotalNet > 0) {
    const recYtdLoc = reconcileAmounts(locMonthNet, ACTIVE_BRANCH_IDS, ytdTotalNet)
    let ordAcc = 0
    for (let i = 0; i < ACTIVE_BRANCH_IDS.length; i++) {
      const lid = ACTIVE_BRANCH_IDS[i]
      locYearNet.set(lid, recYtdLoc.get(lid) ?? 0)
      if (i === ACTIVE_BRANCH_IDS.length - 1) {
        locYearOrd.set(lid, Math.max(0, ytdTotalOrd - ordAcc))
      } else {
        const share =
          monthSumOrd > 0
            ? (locMonthOrd.get(lid) ?? 0) / monthSumOrd
            : monthSumNet > 0
              ? (locMonthNet.get(lid) ?? 0) / monthSumNet
              : 1 / ACTIVE_BRANCH_IDS.length
        const partOrd = Math.round(ytdTotalOrd * share)
        locYearOrd.set(lid, partOrd)
        ordAcc += partOrd
      }
    }
  }
  const ytdDays = Math.max(
    1,
    Math.round(
      (Date.parse(`${tomorrowKwIso}T00:00:00Z`) - Date.parse(`${yearFromKwIso}T00:00:00Z`)) /
        86_400_000,
    ),
  )

  const snapRawBuckets = (
    baselineSnapshot as unknown as {
      buckets?: Partial<Record<OdooPeriodBucketKey, OdooBucketSummary>>
    }
  ).buckets

  const todayBucket = buildReconciledBucket({
    key: 'today',
    from: todayBucketFrom,
    to: todayBucketTo,
    days: 1,
    isLatestOperationalDay: todayIsFallbackDay,
    locNetMap: locTodayNet,
    locOrdersMap: locTodayOrd,
    brandRawWeights: brandToday.netMap,
    brandQtyWeights: brandToday.qtyMap,
    locUiRawMap: locUiToday,
  })

  const weekBucket = buildReconciledBucket({
    key: 'week',
    from: weekFromKwIso,
    to: tomorrowKwIso,
    days: 7,
    locNetMap: locWeekNet,
    locOrdersMap: locWeekOrd,
    brandRawWeights: brand30.netMap,
    brandQtyWeights: brand30.qtyMap,
    locUiRawMap: locUi30,
  })

  const monthBucket = buildReconciledBucket({
    key: 'month',
    from: monthFromKwIso,
    to: tomorrowKwIso,
    days: 30,
    locNetMap: locMonthNet,
    locOrdersMap: locMonthOrd,
    brandRawWeights: brand30.netMap,
    brandQtyWeights: brand30.qtyMap,
    locUiRawMap: locUi30,
  })

  const hasLiveYtd = [...locYearOrd.values()].some((v) => v > 0)
  const yearBucket = hasLiveYtd
    ? buildReconciledBucket({
        key: 'year',
        from: yearFromKwIso,
        to: tomorrowKwIso,
        days: ytdDays,
        locNetMap: locYearNet,
        locOrdersMap: locYearOrd,
        brandRawWeights: brand30.netMap,
        brandQtyWeights: brand30.qtyMap,
        locUiRawMap: locUi30,
        accounting: snapRawBuckets?.year?.accounting,
      })
    : (snapRawBuckets?.year ?? monthBucket)

  const prior30Net = r3(
    Math.max(
      0,
      (Number(prior30AggRows?.[0]?.amount_total) || 0) -
        (Number(prior30AggRows?.[0]?.amount_tax) || 0),
    ),
  )
  const prior30Orders = Math.max(0, Number(prior30AggRows?.[0]?.__count ?? 0))
  const mtdDays = Math.max(1, kwNow.getUTCDate())

  const journeyPulse: OdooLiveSummary['journeyPulse'] = {
    rolling30: {
      from: monthFromKwIso,
      to: tomorrowKwIso,
      days: 30,
      netKwd: monthBucket.totals.restaurantNetKwd,
      orders: monthBucket.totals.restaurantOrders,
      perDayKwd: r3(monthBucket.totals.restaurantNetKwd / 30),
    },
    prior30: {
      from: prior30FromKwIso,
      to: monthFromKwIso,
      days: 30,
      netKwd: prior30Net,
      orders: prior30Orders,
      perDayKwd: r3(prior30Net / 30),
    },
    mtd: {
      from: mtdFromKwIso,
      to: tomorrowKwIso,
      days: mtdDays,
      netKwd: r3(mtdNet),
      orders: mtdOrders,
      perDayKwd: r3(mtdNet / mtdDays),
    },
  }

  const baselineInfo = summaryFromSnapshot(baselineSnapshot, undefined, 'month')
  const resolvedLatestRecordAt =
    newestOrderIso ?? baselineInfo.latestRecordAt ?? baselineInfo.syncedAt
  const resolvedOperationalDate = new Date(
    Date.parse(resolvedLatestRecordAt) + KUWAIT_OFFSET_MS,
  )
    .toISOString()
    .slice(0, 10)

  return {
    fetchedAtMs: Date.now(),
    connected: true,
    sourceMode: 'odoo17-live',
    envConfigured: true,
    latestRecordAt: resolvedLatestRecordAt,
    latestOperationalDate: resolvedOperationalDate,
    todayOrdersCount: rawTodayOrdersCount,
    todaySalesKwd: rawTodaySalesKwd,
    buckets: {
      today: todayBucket,
      week: weekBucket,
      month: monthBucket,
      year: yearBucket,
    },
    dailySeries,
    hourlySeries,
    ...(stockTransfers ? { stockTransfers } : {}),
    ...(aggregatorReceivables ? { aggregatorReceivables } : {}),
    journeyPulse,
  }
}

function formatEnvelopeFromCore(
  core: CachedCoreSnapshot,
  bucketKey: OdooPeriodBucketKey,
  options: {
    readOnly: boolean
    cached: boolean
    referenceNowMs: number
    noteOverride?: string
  },
): OdooLiveSyncEnvelope {
  const bkt = core.buckets[bucketKey] ?? core.buckets.month
  const freshness = computeOdooFreshnessStatus(core.latestRecordAt, options.referenceNowMs)
  const totalNet = bkt.totals.restaurantNetKwd

  const brands = ACTIVE_BRAND_IDS.map((bid) => {
    const nv = bkt.byBrand?.[bid]?.netKwd ?? 0
    return {
      id: bid,
      brand: REG.brands.find((b) => b.id === bid)?.en ?? bid,
      netKwd: nv,
      sharePct: pct1(nv, totalNet),
    }
  })
    .filter((b) => b.netKwd > 0)
    .sort((a, b) => b.netKwd - a.netKwd)

  const branches = ACTIVE_BRANCH_IDS.map((lid) => {
    const nv = bkt.byLocation?.[lid]?.netKwd ?? 0
    const ord = bkt.byLocation?.[lid]?.orders ?? 0
    return {
      id: lid,
      name: REG.locations[lid]?.en ?? lid,
      unit: 'restaurant',
      netSalesKwd: nv,
      orders: ord,
      sharePct: pct1(nv, totalNet),
    }
  }).sort((a, b) => b.netSalesKwd - a.netSalesKwd)

  const channels = UI_CHANNEL_KEYS.map((ck) => ({
    name: ck,
    amountKwd: bkt.uiChannels?.[ck]?.netKwd ?? 0,
  })).sort((a, b) => b.amountKwd - a.amountKwd)

  const noteText = options.noteOverride ?? core.note

  const envelope: OdooLiveSyncEnvelope = {
    ok: true,
    source: core.connected ? 'live' : 'snapshot',
    connected: core.connected,
    sourceMode: core.sourceMode,
    envConfigured: core.envConfigured,
    syncedAt: freshness.latestRecordIso,
    latestRecordAt: freshness.latestRecordIso,
    kuwaitSyncedAt: freshness.kuwaitTimestamp,
    latestOperationalDate: core.latestOperationalDate,
    hoursSinceLatestRecord: freshness.hoursSinceLatestOdooRecord,
    hoursSinceLatestOdooRecord: freshness.hoursSinceLatestOdooRecord,
    isStaleOver24h: freshness.isStaleOver24h,
    todayOrdersCount: core.todayOrdersCount,
    todaySalesKwd: core.todaySalesKwd,
    lastCheckedAt: formatUtcIsoFromMs(options.referenceNowMs),
    readOnly: options.readOnly,
    cached: options.cached,
    bucket: bucketKey,
    period: { from: bkt.from, to: bkt.to },
    database: null,
    totals: {
      netSalesKwd: bkt.totals.restaurantNetKwd,
      orders: bkt.totals.restaurantOrders,
      aovKwd: bkt.totals.aovKwd,
    },
    brands,
    branches,
    channels,
    buckets: core.buckets,
    dailySeries: core.dailySeries,
    hourlySeries: core.hourlySeries,
    ...(core.stockTransfers ? { stockTransfers: core.stockTransfers } : {}),
    ...(core.aggregatorReceivables
      ? { aggregatorReceivables: core.aggregatorReceivables }
      : {}),
    ...(core.journeyPulse ? { journeyPulse: core.journeyPulse } : {}),
    ...(noteText ? { note: redactOdooSecrets(noteText) } : {}),
  }

  return sanitizeOdooPublicPayload(envelope)
}

/**
 * Read-only accessor for `auditor` sessions: returns the latest warm server cache if available,
 * or the verified baseline snapshot, WITHOUT triggering a new write/mutation sync action.
 */
export function getReadOnlyOdooSnapshotStatus(
  rawPeriod?: string | null,
  referenceNowMs = Date.now(),
): OdooLiveSyncEnvelope {
  assertServerRuntime()
  const bucket = parseBucketKey(rawPeriod)
  if (coreSnapshotCache) {
    return formatEnvelopeFromCore(coreSnapshotCache, bucket, {
      readOnly: true,
      cached: true,
      referenceNowMs,
      noteOverride: coreSnapshotCache.connected
        ? 'Read-only auditor session: displaying live synced Odoo 17 telemetry.'
        : 'Read-only auditor session: displaying verified Odoo 17 ledger snapshot.',
    })
  }
  const fallback = buildBaselineFallbackCore(
    'Read-only auditor session: displaying verified Odoo 17 ledger snapshot.',
  )
  return formatEnvelopeFromCore(fallback, bucket, {
    readOnly: true,
    cached: false,
    referenceNowMs,
  })
}

/**
 * Primary server-side live Odoo 17 snapshot fetcher with 60-second TTL cache,
 * concurrent request coalescing, instant cache-bust (`forceRefresh: true`), and safe baseline fallback.
 */
export async function fetchLiveOdooSnapshot(options?: {
  period?: string | null
  forceRefresh?: boolean
  readOnly?: boolean
  referenceNowMs?: number
}): Promise<OdooLiveSyncEnvelope> {
  assertServerRuntime()
  const bucket = parseBucketKey(options?.period)
  const referenceNowMs = options?.referenceNowMs ?? Date.now()
  const readOnly = Boolean(options?.readOnly)

  if (options?.forceRefresh) {
    bustOdooLiveCache()
  }

  if (
    !options?.forceRefresh &&
    coreSnapshotCache &&
    referenceNowMs - coreSnapshotCache.fetchedAtMs < LIVE_SNAPSHOT_TTL_MS
  ) {
    return formatEnvelopeFromCore(coreSnapshotCache, bucket, {
      readOnly,
      cached: true,
      referenceNowMs,
    })
  }

  if (!isOdooLiveEnvConfigured()) {
    const baseline = buildBaselineFallbackCore()
    coreSnapshotCache = baseline
    return formatEnvelopeFromCore(baseline, bucket, {
      readOnly,
      cached: false,
      referenceNowMs,
    })
  }

  try {
    if (!inflightCorePull) {
      inflightCorePull = pullFreshCoreSnapshotFromOdoo().finally(() => {
        inflightCorePull = null
      })
    }
    const freshCore = await inflightCorePull
    coreSnapshotCache = freshCore
    return formatEnvelopeFromCore(freshCore, bucket, {
      readOnly,
      cached: false,
      referenceNowMs: Date.now(),
    })
  } catch (err) {
    const safeReason = redactOdooSecrets(
      err instanceof Error ? err.message : 'Odoo connection error',
    )
    const fallback = buildBaselineFallbackCore(
      `Live Odoo 17 sync fallback (${safeReason}); displaying verified baseline ledger snapshot.`,
    )
    return formatEnvelopeFromCore(fallback, bucket, {
      readOnly,
      cached: false,
      referenceNowMs: Date.now(),
    })
  }
}
