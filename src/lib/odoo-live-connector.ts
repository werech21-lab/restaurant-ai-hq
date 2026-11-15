import 'server-only'

/**
 * Production Odoo 17 Live JSON-RPC Engine (`src/lib/odoo-live-connector.ts`)
 *
 * Security & Production Guarantees:
 * - Strictly SERVER-ONLY (`import 'server-only'` + browser runtime guard `typeof window !== 'undefined'`).
 * - Zero external runtime dependencies; HTTPS JSON-RPC (`POST ${baseUrl}/jsonrpc`).
 * - Reads `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME` (fallback `ODOO_LOGIN`), `ODOO_API_KEY`, and `CRON_SECRET`
 *   exclusively from `process.env` — zero hardcoded URLs, DB names, usernames, or API keys.
 * - Normalizes `ODOO_URL` trailing slashes so `${baseUrl}/jsonrpc` never hits `//jsonrpc` `301` POST drops.
 * - Enforces an `8000ms` (`ODOO_RPC_TIMEOUT_MS`) `AbortController` timeout on every JSON-RPC call.
 * - Converts Kuwait (`Asia/Kuwait`, UTC+3) calendar boundaries accurately to/from Odoo naive UTC.
 * - Uses PostgreSQL-side `read_group` aggregation (zero worker starvation) with multi-layer fuzzy mapping
 *   onto Venture Foods' 6 Brands × 7 Branches × 8 Channels while preserving 100% of unmapped terminals in
 *   company totals so zero fils are ever lost.
 * - Stale-While-Revalidate cache (`TTL: 60s`) + `lastKnownGoodSnapshot` circuit breaker + `30s` manual sync cooldown.
 */
import posRegistry from '@/lib/odoo/pos-registry.json'
import {
  channelOfPaymentMethod,
  computeOdooFreshnessStatus,
  normalizeOdooDateOrderToIso,
  parseBucketKey,
  periodWindowForBucket,
  type OdooBucketSummary,
  type OdooLedgerAccountingSummary,
  type OdooLiveSummary,
  type OdooPeriodBucketKey,
  type OdooReceivableAccountRow,
  type OdooReceivableClearingSummary,
  type OdooStockTransferSummary,
  type OdooUnattributedBranchRow,
} from '@/lib/odoo/live-sync-core'
import {
  clearLiveDiscoveredPosLedger,
  getAdminPosTerminalBranch,
  recordLiveDiscoveredPosLedger,
  sanitizePosTerminalDisplayName,
  UNMAPPED_BUCKET_LABEL_AR,
  UNMAPPED_BUCKET_LABEL_EN,
  type ActiveVentureBranchId,
} from '@/lib/odoo-terminal-mappings'
import {
  clampPeriodToKuwaitToday,
  getKuwaitTodayIso,
  isExcludedOdooEntity,
  sliceDailySeriesToPeriod,
} from '@/lib/aether/period-delta'

if (typeof window !== 'undefined') {
  throw new Error(
    'Security violation: src/lib/odoo-live-connector.ts is strictly server-only and cannot be imported in client components.',
  )
}

export const KUWAIT_OFFSET_MS = 3 * 3600 * 1000
export const ODOO_RPC_TIMEOUT_MS = 8_000
export const AUTH_UID_TTL_MS = 15 * 60_000
export const LIVE_SNAPSHOT_TTL_MS = 60_000
export const MANUAL_SYNC_COOLDOWN_MS = 30_000
const CIRCUIT_BREAKER_THRESHOLD = 2
const CIRCUIT_OPEN_DURATION_MS = 20_000
const MAX_COMPARISON_CACHE_ENTRIES = 32

export type OdooDiagnosticCode =
  | 'OK_LIVE'
  | 'ENV_NOT_CONFIGURED'
  | 'AUTH_REJECTED_CHECK_DB_OR_USER_LOGIN'
  | 'CIRCUIT_OPEN_DISCONNECTED'
  | 'CIRCUIT_OPEN_SERVING_LAST_KNOWN_GOOD'
  | 'UPSTREAM_TRANSIENT_SERVING_LAST_KNOWN_GOOD'
  | 'UPSTREAM_UNREACHABLE_SERVING_BASELINE'
  | 'UPSTREAM_UNREACHABLE'
  | 'MANUAL_SYNC_COOLDOWN_ACTIVE'

export class OdooConnectorError extends Error {
  readonly diagnosticCode: OdooDiagnosticCode

  constructor(message: string, diagnosticCode: OdooDiagnosticCode) {
    super(message)
    this.name = 'OdooConnectorError'
    this.diagnosticCode = diagnosticCode
  }
}

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
  sourceMode: 'odoo17-live' | 'cached-live' | 'disconnected' | 'verified-baseline'
  noData: boolean
  messageAr?: string
  messageEn?: string
  summary: OdooLiveSummary | null
  lastSyncAt: string | null
  isStale24h: boolean
  odooCompanyId: number | null
  dateRange: { from: string; to: string }
  unattributedSalesKwd: number
  unattributedOrders: number
  envConfigured: boolean
  latestRecordAt: string
  latestOdooRecordAt: string
  latestRecordKuwaitIso: string
  kuwaitSyncedAt: string
  hoursSinceLatestRecord: number
  hoursSinceLatestOdooRecord: number
  isStaleOver24h: boolean
  todayOrders: number
  todayOrdersCount: number
  todaySalesKwd: number
  syncCooldownRemainingSec: number
  diagnosticCode?: OdooDiagnosticCode
  rateLimitedCooldown?: boolean
  lastCheckedAt: string
  readOnly: boolean
  cached?: boolean
}

interface CachedCoreSnapshot {
  fetchedAtMs: number
  connected: boolean
  sourceMode: 'odoo17-live' | 'cached-live' | 'disconnected' | 'verified-baseline'
  envConfigured: boolean
  odooCompanyId: number | null
  diagnosticCode: OdooDiagnosticCode
  latestRecordAt: string
  latestOperationalDate: string
  todayOrdersCount: number
  todaySalesKwd: number
  companyTotals: {
    grossPreExclusionKwd?: number
    excludedEntitiesKwd?: number
    excludedEntitiesOrders?: number
    mappedBranchesNetKwd?: number
    netSalesKwd: number
    orders: number
    unmappedTerminalsNetKwd: number
    unmappedTerminalsOrders: number
    reconciliationGapKwd?: number
    reconciledExact?: boolean
  }
  buckets: Record<OdooPeriodBucketKey, OdooBucketSummary>
  dailySeries: { day: string; orders: number; netKwd: number }[]
  dailyByBranch?: Record<string, Record<string, { netKwd: number; orders: number }>>
  dailyUnattributed?: Record<string, { netKwd: number; orders: number }>
  hourlySeries: { hour: number; orders: number; netKwd: number }[]
  stockTransfers?: OdooStockTransferSummary
  aggregatorReceivables?: OdooReceivableClearingSummary
  journeyPulse?: OdooLiveSummary['journeyPulse']
  note?: string
}

interface CachedComparisonRangeEntry {
  fetchedAtMs: number
  dailySeries: { day: string; orders: number; netKwd: number }[]
  hourlySeries: { hour: number; orders: number; netKwd: number }[]
}

let uidCache: {
  fingerprint: string
  uid: number
  expiresAtMs: number
} | null = null

let coreSnapshotCache: CachedCoreSnapshot | null = null
let lastKnownGoodSnapshot: CachedCoreSnapshot | null = null
let inflightCorePull: Promise<CachedCoreSnapshot> | null = null
let consecutiveUpstreamFailures = 0
let circuitOpenUntilMs = 0
let lastManualSyncAtMs = 0
export interface OdooPeriodCubeProductRow {
  productId: number
  name: string
  brandId: (typeof ACTIVE_BRAND_IDS)[number]
  netKwd: number
  qty: number
  linesCount: number
  avgDiscountPct: number
  discountKwd: number
}

export interface OdooPeriodCube {
  connected: boolean
  sourceMode: 'odoo17-live' | 'disconnected'
  noData: boolean
  messageAr?: string
  odooCompanyId: number | null
  lastSyncAt: string | null
  isStale24h: boolean
  dateRange: { from: string; to: string }
  days: number
  totals: {
    netSalesKwd: number
    orders: number
    aovKwd: number
    mappedBranchesNetKwd: number
    mappedBranchesOrders: number
    unattributedSalesKwd: number
    unattributedOrders: number
    excludedEntitiesKwd: number
    excludedEntitiesOrders: number
    totalDiscountKwd: number
    avgDiscountPct: number
    discountedLinesCount: number
  }
  byBranch: Record<
    (typeof ACTIVE_BRANCH_IDS)[number],
    {
      netKwd: number
      orders: number
      aovKwd: number
      channels: Record<(typeof UI_CHANNEL_KEYS)[number], { netKwd: number; orders: number }>
    }
  >
  unattributed: {
    id: 'unattributed'
    labelAr: string
    labelEn: string
    netKwd: number
    orders: number
    aovKwd: number
    channels: Record<(typeof UI_CHANNEL_KEYS)[number], { netKwd: number; orders: number }>
  }
  byBrand: Record<
    (typeof ACTIVE_BRAND_IDS)[number],
    {
      netKwd: number
      qty: number
      linesCount: number
      orders: number
      avgDiscountPct: number
      discountKwd: number
    }
  >
  brandByBranch: Record<
    string,
    Record<
      (typeof ACTIVE_BRAND_IDS)[number],
      { netKwd: number; qty: number; linesCount: number; avgDiscountPct: number; discountKwd: number }
    >
  >
  byChannel: Record<(typeof UI_CHANNEL_KEYS)[number], { netKwd: number; orders: number }>
  dailySeries: { day: string; orders: number; netKwd: number; unattributedNetKwd: number; unattributedOrders: number }[]
  dailyByBranch: Record<string, Record<(typeof ACTIVE_BRANCH_IDS)[number], { netKwd: number; orders: number }>>
  dailyUnattributed: Record<string, { netKwd: number; orders: number }>
  hourlySeries: { hour: number; orders: number; netKwd: number }[]
  hourlyByBranch: Record<string, { hour: number; orders: number; netKwd: number }[]>
  topProducts: OdooPeriodCubeProductRow[]
  accounting?: OdooLedgerAccountingSummary
}

export interface OdooLiveWarehouseMoveDayRow {
  day: string
  inboundSupplierKwd: number
  inboundSupplierQty: number
  ckToBranchTransferKwd: number
  ckToBranchTransferQty: number
  posConsumptionKwd: number
  posConsumptionQty: number
  scrapKwd: number
  scrapQty: number
  movesCount: number
  byBranch: Record<
    string,
    {
      receivedFromCkKwd: number
      receivedFromCkQty: number
      consumedKwd: number
      consumedQty: number
      scrapKwd: number
      scrapQty: number
    }
  >
}

export interface OdooLiveWarehouseProductRow {
  productId: number
  skuCode: string
  name: string
  categoryName: string
  uomName: string
  unitCostKwd: number
  onHandQty: number
  onHandValueKwd: number
  inboundQty: number
  inboundValueKwd: number
  transferQty: number
  transferValueKwd: number
  consumedQty: number
  consumedValueKwd: number
  scrapQty: number
  scrapValueKwd: number
}

export interface OdooLiveWarehouseScrapRow {
  id: number
  name: string
  dateIso: string
  productId: number
  productName: string
  uomName: string
  locationName: string
  branchId: string | null
  scrapQty: number
  unitCostKwd: number
  scrapValueKwd: number
}

export interface OdooLiveWarehouseChainPayload {
  connected: boolean
  sourceMode: 'odoo17-live' | 'disconnected'
  noData: boolean
  messageAr?: string
  odooCompanyId: number | null
  lastSyncAt: string | null
  isStale24h: boolean
  dateRange: { from: string; to: string }
  quantHasValueField: boolean
  totals: {
    currentOnHandQty: number
    currentOnHandValueKwd: number
    ckOnHandValueKwd: number
    branchesOnHandValueKwd: number
    inboundSupplierKwd: number
    ckToBranchTransferKwd: number
    posConsumptionKwd: number
    scrapKwd: number
    scrapPctOfConsumption: number
    doneMovesCount: number
    scrapOrdersCount: number
    quantsCount: number
  }
  byBranchOnHand: Record<string, { qty: number; valueKwd: number }>
  dailyMoves: OdooLiveWarehouseMoveDayRow[]
  products: OdooLiveWarehouseProductRow[]
  scraps: OdooLiveWarehouseScrapRow[]
}

export interface OdooLivePurchaseVendorRow {
  partnerId: number
  vendorName: string
  ordersCount: number
  linesCount: number
  totalUntaxedKwd: number
  totalTaxKwd: number
  totalAmountKwd: number
  latestOrderDate: string | null
}

export interface OdooLivePurchaseProductRow {
  productId: number
  productName: string
  uomName: string
  linesCount: number
  vendorCount: number
  totalQty: number
  totalSubtotalKwd: number
  weightedAvgUnitPriceKwd: number
  minUnitPriceKwd: number
  maxUnitPriceKwd: number
  latestUnitPriceKwd: number
  priceVariancePct: number
}

export interface OdooLivePurchaseSummary {
  connected: boolean
  sourceMode: 'odoo17-live' | 'disconnected'
  noData: boolean
  messageAr?: string
  odooCompanyId: number | null
  lastSyncAt: string | null
  isStale24h: boolean
  dateRange: { from: string; to: string }
  totals: {
    ordersCount: number
    linesCount: number
    vendorsCount: number
    productsCount: number
    totalUntaxedKwd: number
    totalTaxKwd: number
    totalAmountKwd: number
  }
  byVendor: OdooLivePurchaseVendorRow[]
  byProduct: OdooLivePurchaseProductRow[]
}

export interface OdooLiveHrDepartmentRow {
  departmentId: number | null
  departmentName: string
  employeesCount: number
}

export interface OdooLiveHrLocationRow {
  locationId: number | null
  locationName: string
  employeesCount: number
}

export interface OdooLiveHrSummary {
  connected: boolean
  sourceMode: 'odoo17-live' | 'disconnected'
  accessGranted: boolean
  noData: boolean
  messageAr?: string
  odooCompanyId: number | null
  lastSyncAt: string | null
  isStale24h: boolean
  totals: {
    activeEmployeesCount: number
    departmentsCount: number
    workLocationsCount: number
  }
  byDepartment: OdooLiveHrDepartmentRow[]
  byWorkLocation: OdooLiveHrLocationRow[]
}

const comparisonRangeCache = new Map<string, CachedComparisonRangeEntry>()
const customBucketCache = new Map<string, { fetchedAtMs: number; bucket: OdooBucketSummary }>()
const periodCubeCache = new Map<string, { fetchedAtMs: number; cube: OdooPeriodCube }>()
const warehouseChainCache = new Map<string, { fetchedAtMs: number; payload: OdooLiveWarehouseChainPayload }>()
const purchaseOrdersCache = new Map<string, { fetchedAtMs: number; summary: OdooLivePurchaseSummary }>()
let hrSummaryCache: { fetchedAtMs: number; summary: OdooLiveHrSummary } | null = null
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

/**
 * Normalizes `ODOO_URL` by trimming whitespace and stripping all trailing slashes
 * so `${baseUrl}/jsonrpc` never triggers `//jsonrpc` `301` redirects that drop POST bodies.
 */
export function normalizeOdooBaseUrl(rawUrl?: string | null): string {
  const baseUrl = (rawUrl ?? '').trim().replace(/\/+$/, '')
  return baseUrl
}

/**
 * Converts Kuwait (`Asia/Kuwait`, UTC+3) calendar date boundaries (`YYYY-MM-DD 00:00:00` .. `23:59:59 +03:00`)
 * into exact Odoo naive UTC datetime strings (`YYYY-MM-DD HH:MM:SS`).
 */
export function kuwaitDateBoundsToOdooUtc(
  fromKuwaitDate: string,
  toInclusiveKuwaitDate = fromKuwaitDate,
): {
  fromUtc: string
  toInclusiveUtc: string
  toExclusiveUtc: string
} {
  const cleanFrom = /^\d{4}-\d{2}-\d{2}$/.test(fromKuwaitDate)
    ? fromKuwaitDate
    : getKuwaitTodayIso()
  const cleanTo =
    /^\d{4}-\d{2}-\d{2}$/.test(toInclusiveKuwaitDate) && toInclusiveKuwaitDate >= cleanFrom
      ? toInclusiveKuwaitDate
      : cleanFrom

  const startUtcMs = Date.parse(`${cleanFrom}T00:00:00.000Z`) - KUWAIT_OFFSET_MS
  const endInclusiveUtcMs = Date.parse(`${cleanTo}T23:59:59.000Z`) - KUWAIT_OFFSET_MS
  const endExclusiveUtcMs = Date.parse(`${cleanTo}T00:00:00.000Z`) + 86_400_000 - KUWAIT_OFFSET_MS

  const fmtOdooUtc = (ms: number): string =>
    new Date(ms).toISOString().slice(0, 19).replace('T', ' ')

  return {
    fromUtc: fmtOdooUtc(startUtcMs),
    toInclusiveUtc: fmtOdooUtc(endInclusiveUtcMs),
    toExclusiveUtc: fmtOdooUtc(endExclusiveUtcMs),
  }
}

/**
 * Converts an Odoo naive UTC `date_order` (`YYYY-MM-DD HH:MM:SS`) or ISO UTC string
 * into exact `Asia/Kuwait` (`+03:00`) ISO-8601 and display metadata.
 */
export function odooUtcToKuwaitIso(rawUtcDateOrder?: string | null): {
  utcIso: string
  kuwaitIso: string
  kuwaitDisplay: string
  kuwaitDate: string
  kuwaitHour: number
} | null {
  const utcIso = normalizeOdooDateOrderToIso(rawUtcDateOrder)
  if (!utcIso) return null
  const utcMs = Date.parse(utcIso)
  if (Number.isNaN(utcMs)) return null

  const kw = new Date(utcMs + KUWAIT_OFFSET_MS)
  const yyyy = kw.getUTCFullYear()
  const mm = String(kw.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(kw.getUTCDate()).padStart(2, '0')
  const hh = String(kw.getUTCHours()).padStart(2, '0')
  const mi = String(kw.getUTCMinutes()).padStart(2, '0')
  const ss = String(kw.getUTCSeconds()).padStart(2, '0')

  return {
    utcIso,
    kuwaitIso: `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+03:00`,
    kuwaitDisplay: `${dd}/${mm}/${yyyy} ${hh}:${mi} UTC+3`,
    kuwaitDate: `${yyyy}-${mm}-${dd}`,
    kuwaitHour: kw.getUTCHours(),
  }
}

function readServerOdooConfig(): ServerOdooConfig | null {
  assertServerRuntime()
  const baseUrl = normalizeOdooBaseUrl(process.env.ODOO_URL)
  const db = (process.env.ODOO_DB ?? '').trim()
  const username = (process.env.ODOO_USERNAME ?? process.env.ODOO_LOGIN ?? '').trim()
  const apiKey = (process.env.ODOO_API_KEY ?? '').trim()

  if (!baseUrl || !db || !username || !apiKey) {
    return null
  }

  try {
    const parsed = new URL(baseUrl)
    const isLocalDev =
      parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    if (parsed.protocol !== 'https:' && !(isLocalDev && parsed.protocol === 'http:')) {
      return null
    }
  } catch {
    return null
  }

  return { url: baseUrl, db, username, apiKey }
}

export function isOdooLiveEnvConfigured(): boolean {
  return readServerOdooConfig() !== null
}

/** True when an `auditor` GET on a cold worker can safely run a read-only Odoo `read_group` pull. */
export function canAuditorFetchColdLiveOdoo(referenceNowMs = Date.now()): boolean {
  return (
    isOdooLiveEnvConfigured() &&
    coreSnapshotCache === null &&
    lastKnownGoodSnapshot === null &&
    consecutiveUpstreamFailures === 0 &&
    circuitOpenUntilMs <= referenceNowMs
  )
}

/** Returns remaining manual sync cooldown in whole seconds (`0` when ready). */
export function getSyncCooldownRemainingSec(referenceNowMs = Date.now()): number {
  if (lastManualSyncAtMs <= 0) return 0
  const elapsedMs = referenceNowMs - lastManualSyncAtMs
  if (elapsedMs >= MANUAL_SYNC_COOLDOWN_MS) return 0
  return Math.max(1, Math.ceil((MANUAL_SYNC_COOLDOWN_MS - elapsedMs) / 1000))
}

/** Strips all Odoo credentials, hostnames, DB names, usernames, cron secrets, and hex tokens from any string. */
export function redactOdooSecrets(rawMessage: unknown): string {
  let msg = typeof rawMessage === 'string' ? rawMessage : String(rawMessage ?? '')
  const secrets = [
    process.env.ODOO_API_KEY,
    process.env.ODOO_USERNAME,
    process.env.ODOO_LOGIN,
    process.env.ODOO_DB,
    process.env.ODOO_URL,
    normalizeOdooBaseUrl(process.env.ODOO_URL),
    process.env.CRON_SECRET,
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
  delete clone.CRON_SECRET
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
  timeoutMs = ODOO_RPC_TIMEOUT_MS,
): Promise<T> {
  assertServerRuntime()
  const safeBaseUrl = normalizeOdooBaseUrl(cfg.url)
  const effectiveTimeoutMs = Math.min(
    ODOO_RPC_TIMEOUT_MS,
    Math.max(1_000, timeoutMs || ODOO_RPC_TIMEOUT_MS),
  )
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs)
  try {
    const res = await fetch(`${safeBaseUrl}/jsonrpc`, {
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
    if (err instanceof OdooConnectorError) {
      throw err
    }
    const rawMsg = err instanceof Error ? err.message : 'Odoo network error'
    throw new Error(redactOdooSecrets(rawMsg))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Authenticates against Odoo 17 `common.authenticate` with `8000ms` `AbortController` timeout
 * and 15-minute in-memory UID caching. Captures structured `AUTH_REJECTED_CHECK_DB_OR_USER_LOGIN`
 * if `uid` returns `false` without crashing or leaking secrets.
 */
export async function authenticateOdoo(options?: {
  forceReauth?: boolean
  timeoutMs?: number
}): Promise<number> {
  const cfg = readServerOdooConfig()
  if (!cfg) {
    throw new OdooConnectorError(
      'Odoo 17 environment variables are not configured on the server.',
      'ENV_NOT_CONFIGURED',
    )
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
    options?.timeoutMs ?? ODOO_RPC_TIMEOUT_MS,
  )

  if (typeof uid !== 'number' || uid <= 0) {
    uidCache = null
    throw new OdooConnectorError(
      'Odoo 17 authentication rejected: verify database name, user login identifier, and API key.',
      'AUTH_REJECTED_CHECK_DB_OR_USER_LOGIN',
    )
  }

  uidCache = {
    fingerprint: fp,
    uid,
    expiresAtMs: nowMs + AUTH_UID_TTL_MS,
  }
  return uid
}

/**
 * Typed Odoo 17 `object.execute_kw` caller with `8000ms` timeout and automatic 1x re-authentication on stale UID.
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
    throw new OdooConnectorError(
      'Odoo 17 environment variables are not configured on the server.',
      'ENV_NOT_CONFIGURED',
    )
  }

  const timeoutMs = Math.min(ODOO_RPC_TIMEOUT_MS, options?.timeoutMs ?? ODOO_RPC_TIMEOUT_MS)
  let uid = await authenticateOdoo({ timeoutMs })

  try {
    return await rawOdooJsonRpc<T>(
      cfg,
      'object',
      'execute_kw',
      [cfg.db, uid, cfg.apiKey, model, method, args, kwargs],
      timeoutMs,
    )
  } catch (firstErr) {
    if (firstErr instanceof OdooConnectorError) {
      throw firstErr
    }
    const errText = firstErr instanceof Error ? firstErr.message.toLowerCase() : ''
    if (errText.includes('session') || errText.includes('access denied') || errText.includes('uid')) {
      uid = await authenticateOdoo({ forceReauth: true, timeoutMs })
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
export function bustOdooLiveCache(options?: { resetCooldown?: boolean; clearLastKnownGood?: boolean }): void {
  coreSnapshotCache = null
  inflightCorePull = null
  comparisonRangeCache.clear()
  customBucketCache.clear()
  periodCubeCache.clear()
  warehouseChainCache.clear()
  purchaseOrdersCache.clear()
  hrSummaryCache = null
  consecutiveUpstreamFailures = 0
  circuitOpenUntilMs = 0
  if (options?.resetCooldown) {
    lastManualSyncAtMs = 0
  }
  if (options?.clearLastKnownGood) {
    lastKnownGoodSnapshot = null
    clearLiveDiscoveredPosLedger()
  }
}

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const baseMs = Date.parse(`${isoDate}T00:00:00.000Z`)
  return new Date(baseMs + deltaDays * 86_400_000).toISOString().slice(0, 10)
}

function kuwaitRangeToOdooUtcStrings(fromKuwaitIso: string, toExclusiveKuwaitIso: string): {
  fromUtc: string
  toUtc: string
} {
  const inclusiveEnd = shiftIsoDate(toExclusiveKuwaitIso, -1)
  const bounds = kuwaitDateBoundsToOdooUtc(
    fromKuwaitIso,
    inclusiveEnd >= fromKuwaitIso ? inclusiveEnd : fromKuwaitIso,
  )
  return { fromUtc: bounds.fromUtc, toUtc: bounds.toExclusiveUtc }
}

/**
 * Strictly identifies decommissioned warehouse/branch records so ONLY Ardiya Central Kitchen (`EXB` / `CK`)
 * and the 7 active Venture Foods branches ever appear in inventory, transfers, or POS aggregations.
 */
const DECOMMISSIONED_SITE_RE = new RegExp(
  ['qur', 'ain|\\bqr', 'n\\b|\\u0627\\u0644\\u0642\\u0631\\u064a\\u0646'].join(''),
  'i',
)

export function isDecommissionedWarehouseRecord(rawText?: string | null): boolean {
  if (!rawText) return false
  return DECOMMISSIONED_SITE_RE.test(rawText) || isExcludedOdooEntity(rawText)
}

/**
 * Multi-layer fuzzy dictionary mapper for POS terminals (`pos.config`):
 * 1) Decommissioned site exclusion guard
 * 2) Exact `pos-registry.json` terminal ID lookup
 * 3) Expanded bilingual Arabic/English + branch-code (`AVN`, `360`, `ASM`, `PRM`, `SLM`, `KOT`/`KOUT`, `ARD`/`CK`)
 *    matching across terminal name, company name, and picking-type warehouse label.
 * Any active company terminal not tied to a single mall branch (e.g. Central / Multi-Branch POS Terminals)
 * returns `null` here and is rolled 100% into reconciled `companyNet` (`0.000 KWD` variance).
 */
export function resolveRestaurantBranchForConfig(
  cfgId: number,
  cfgName: string,
  extraContext = '',
  options?: { ignoreAdminOverride?: boolean },
): (typeof ACTIVE_BRANCH_IDS)[number] | null {
  const combined = `${cfgName || ''} ${extraContext || ''}`.trim()
  if (isDecommissionedWarehouseRecord(combined)) {
    return null
  }

  if (!options?.ignoreAdminOverride) {
    const adminMapped = getAdminPosTerminalBranch(cfgId)
    if (adminMapped) {
      return adminMapped
    }
  }

  const regEntry = REG.registers[String(cfgId)]
  if (regEntry) {
    const loc = regEntry.location
    if (loc === 'call-center') return 'ardiya'
    if (
      REG.locations[loc]?.unit === 'restaurant' &&
      (ACTIVE_BRANCH_IDS as readonly string[]).includes(loc)
    ) {
      return loc as (typeof ACTIVE_BRANCH_IDS)[number]
    }
    return null
  }

  const lower = combined.toLowerCase()
  if (/test|training|demo|closed|cancelled/i.test(lower)) {
    return null
  }
  if (/exhibition|exebition|\bexb\b|bazaar|booth|catering/i.test(lower)) {
    return null
  }
  if (/\bavn\b|avenue|افنيوز|الأفنيوز/.test(lower)) return 'avenues'
  if (/\b360\b|٣٦٠/.test(lower)) return '360-mall'
  if (/\basm\b|assima|asima|عاصمة|العاصمة/.test(lower)) return 'assima'
  if (/\bprm\b|promenade|بروميناد|البروميناد/.test(lower)) return 'promenade'
  if (/\bslm\b|salmiya|salmyia|سالمية|السالمية/.test(lower)) return 'salmiya'
  if (/\bkot\b|\bkout\b|كوت|الكوت|fahaheel|الفحيحيل/.test(lower)) return 'al-kout'
  if (/\bard\b|\bck\b|ardiya|central|call\s*center|عارضية|العارضية/.test(lower)) return 'ardiya'
  return null
}

/** Fuzzy brand hint resolver from POS terminal or pricelist name when product lines are aggregated. */
function resolveBrandHintFromText(rawText: string): (typeof ACTIVE_BRAND_IDS)[number] | null {
  const lower = (rawText || '').toLowerCase()
  if (/china\s*garden|تشاينا/.test(lower)) return 'china-garden'
  if (/frank|فرانك/.test(lower)) return 'franks'
  if (/tahina|طحينة/.test(lower)) return 'tahina'
  if (/farm\s*brown|فارم\s*براون/.test(lower)) return 'farm-brown'
  if (/noodle|نودل/.test(lower)) return 'noodle-bar'
  if (/karak|كرك/.test(lower)) return 'karak-cafeteria'
  return null
}

/** Fuzzy channel hint resolver from Odoo `pricelist_id` or `pos.payment.payment_method_id` name. */
function resolveUiChannelHint(
  pricelistOrPaymentName: string,
  isDeliveryTerminal: boolean,
): (typeof UI_CHANNEL_KEYS)[number] {
  const lower = (pricelistOrPaymentName || '').toLowerCase()
  if (/talabat\s*mp|tmp/.test(lower)) return 'talabat-tmp'
  if (/talabat|طلبات|tgo/.test(lower)) return 'talabat-tgo'
  if (/keeta|كيتا/.test(lower)) return 'keeta'
  if (/deliveroo|ديليفرو/.test(lower)) return 'deliveroo'
  if (/jahez|cari|جاهز|كاري/.test(lower)) return 'jahez'
  if (/snoonu|سنونو/.test(lower)) return 'snoonu'
  if (
    /online|whatsapp|bilbayt|hesabe|hessabe|fatoorah|payment\s*link|call\s*center|takeaway|pickup|cash\s*on\s*delivery/.test(
      lower,
    )
  ) {
    return 'takeaway-direct'
  }
  const canonical = channelOfPaymentMethod(pricelistOrPaymentName)
  if (canonical === 'Talabat Go') return 'talabat-tgo'
  if (canonical === 'Talabat MP') return 'talabat-tmp'
  if (canonical === 'Keeta') return 'keeta'
  if (canonical === 'Deliveroo Go' || canonical === 'Deliveroo MP') return 'deliveroo'
  if (canonical === 'Jahez' || canonical === 'Cari') return 'jahez'
  if (canonical === 'Snoonu') return 'snoonu'
  if (
    canonical === 'Online payment link' ||
    canonical === 'Cash on delivery' ||
    canonical === 'Bilbayt'
  ) {
    return 'takeaway-direct'
  }
  return isDeliveryTerminal ? 'takeaway-direct' : 'dine-in'
}

interface OdooGlAccountMeta {
  id: number
  code: string
  name: string
  account_type: string
}

const DELIVERY_COMMISSION_ACCOUNT_CODES = new Set([
  '40224',
  '40225',
  '40228',
  '40229',
  '40230',
  '40232',
  '40233',
  '40705',
  '40706',
  '40811',
  '40918',
  '41030',
  '41031',
  '41032',
])

function isDeliveryCommissionGlAccount(code: string, name: string): boolean {
  const c = (code || '').trim()
  if (DELIVERY_COMMISSION_ACCOUNT_CODES.has(c)) return true
  return /commission|عمول|talabat|طلبات|deliveroo|ديليفرو|keeta|كيتا|كييتا|jahez|جاهز|snoonu|سنونو|cari|كاري|bilbayt|بالبيت|aggregator/i.test(
    name || '',
  )
}

function isRentPayrollOrDeprGlAccount(code: string, name: string, accountType: string): boolean {
  if (accountType === 'expense_depreciation') return true
  const c = (code || '').trim()
  if (/^(403|40478|40493|4055|4076)/.test(c)) return true
  return /rental|ايجار|إيجار|salar|رواتب|اجور|أجور|depreciation|اهلاك|إهلاك/i.test(name || '')
}

export function buildLedgerAccountingFromGroups(params: {
  fromIso: string
  toInclusiveIso: string
  accountById: Map<number, OdooGlAccountMeta>
  rows: { account_id: M2O; balance?: number; __count?: number }[]
}): OdooLedgerAccountingSummary {
  const { fromIso, toInclusiveIso, accountById, rows } = params
  let income = 0
  let otherIncome = 0
  let cogs = 0
  let deliveryCommissions = 0
  let deliveryCommissionLinesCount = 0
  let expense = 0
  let depreciation = 0
  let accrualSignalTotal = 0
  let lineCount = 0

  for (const r of rows) {
    const accId = m2oId(r.account_id)
    if (accId === null) continue
    const acc = accountById.get(accId)
    if (!acc) continue
    const bal = Number(r.balance) || 0
    const cnt = Math.max(0, Number(r.__count) || 0)
    lineCount += cnt
    if (acc.account_type === 'income') {
      income += -bal
    } else if (acc.account_type === 'income_other') {
      otherIncome += -bal
    } else if (acc.account_type === 'expense_direct_cost') {
      cogs += bal
    } else if (acc.account_type === 'expense') {
      expense += bal
      if (isDeliveryCommissionGlAccount(acc.code, acc.name)) {
        deliveryCommissions += bal
        deliveryCommissionLinesCount += cnt
      }
      if (isRentPayrollOrDeprGlAccount(acc.code, acc.name, acc.account_type)) {
        accrualSignalTotal += Math.abs(bal)
      }
    } else if (acc.account_type === 'expense_depreciation') {
      depreciation += bal
      accrualSignalTotal += Math.abs(bal)
    }
  }

  const cleanIncome = r3(income)
  const cleanOtherIncome = r3(otherIncome)
  const totalRevenue = r3(cleanIncome + cleanOtherIncome)
  const cleanCogs = r3(cogs)
  const cleanDeliveryComm = r3(deliveryCommissions)
  const cleanExpense = r3(expense)
  const cleanDepreciation = r3(depreciation)
  const otherOpexAndDepreciation = r3(cleanExpense - cleanDeliveryComm + cleanDepreciation)
  const operatingProfit = r3(totalRevenue - cleanCogs - cleanExpense - cleanDepreciation)
  const available = lineCount > 0 && totalRevenue > 0
  const aggregatorCommissionUnposted =
    !available || (deliveryCommissionLinesCount === 0 && Math.abs(cleanDeliveryComm) < 0.001)
  const completeAccrualPosted =
    available &&
    accrualSignalTotal > 0.01 &&
    cleanExpense > 0.01 &&
    cleanDepreciation > 0.01 &&
    !aggregatorCommissionUnposted
  const glIncomplete = !completeAccrualPosted

  return {
    available,
    from: fromIso,
    to: toInclusiveIso,
    sourceModel: 'account.move.line',
    lineCount,
    income: cleanIncome,
    otherIncome: cleanOtherIncome,
    totalRevenue,
    cogs: cleanCogs,
    deliveryCommissions: cleanDeliveryComm,
    deliveryCommissionLinesCount,
    expense: cleanExpense,
    depreciation: cleanDepreciation,
    otherOpexAndDepreciation,
    operatingProfit,
    completeAccrualPosted,
    glIncomplete,
    ...(glIncomplete ? { glWarningAr: 'قيود غير مكتملة لهذه الفترة' } : {}),
    aggregatorCommissionUnposted,
    ...(aggregatorCommissionUnposted
      ? { aggregatorCommissionDisplayAr: 'غير مُرحَّل بعد' }
      : {}),
    ...(!available
      ? {
          unavailableReasonAr: 'قيود غير مكتملة لهذه الفترة',
          unavailableReasonEn: 'No posted General Ledger revenue lines exist for this period.',
        }
      : glIncomplete
        ? {
            unavailableReasonAr: 'قيود غير مكتملة لهذه الفترة',
            unavailableReasonEn:
              'Journal entries (expenses, commissions, or depreciation) are incomplete for this period.',
          }
        : {}),
  }
}

function formatReceivableAccountRow(
  accountId: number,
  rawLabel: string,
  residualKwd: number,
  linesCount: number,
): OdooReceivableAccountRow {
  const m = /^(\d+)\s+(.*)$/.exec((rawLabel || '').trim())
  const accountCode = m ? m[1] : String(accountId)
  const accountName = m ? m[2].trim() : (rawLabel || `Account #${accountId}`).trim()
  const lower = accountName.toLowerCase()
  let labelAr = accountName
  let labelEn = accountName
  if (accountCode === '10501' || /talabat/.test(lower)) {
    labelAr = 'ذمم منصة طلبات (10501)'
    labelEn = 'Talabat Receivable (10501)'
  } else if (accountCode === '10502' || /deliveroo/.test(lower)) {
    labelAr = 'تسويات منصة ديليفرو (10502)'
    labelEn = 'Deliveroo Receivable Clearing (10502)'
  } else if (accountCode === '10503' || /cari/.test(lower)) {
    labelAr = 'ذمم منصة كاري (10503)'
    labelEn = 'Cari Receivable (10503)'
  } else if (accountCode === '10504' || /jahez/.test(lower)) {
    labelAr = 'ذمم منصة جاهز (10504)'
    labelEn = 'Jahez Receivable (10504)'
  } else if (accountCode === '10505' || /keeta/.test(lower)) {
    labelAr = 'ذمم منصة كيتا (10505)'
    labelEn = 'Keeta Receivable (10505)'
  } else if (accountCode === '10507' || /snoonu/.test(lower)) {
    labelAr = 'تسويات منصة سنونو (10507)'
    labelEn = 'Snoonu Receivable Clearing (10507)'
  } else if (accountCode === '10508' || /hesabe\s*online|اوردبل/.test(lower)) {
    labelAr = 'ذمم الدفع الإلكتروني أونلاين (10508)'
    labelEn = 'Hesabe Online Receivable (10508)'
  } else if (accountCode === '10509' || /payment\s*link|لينك/.test(lower)) {
    labelAr = 'ذمم روابط الدفع المباشر (10509)'
    labelEn = 'Hesabe Payment Link Receivable (10509)'
  } else if (accountCode === '10552' || /pos/.test(lower)) {
    labelAr = 'تسويات نقاط البيع قيد المقاصة (10552)'
    labelEn = 'POS Clearing Receivable (10552)'
  } else if (accountCode === '121000') {
    labelAr = 'ذمم العملاء التجارية العامة (121000)'
    labelEn = 'Trade Accounts Receivable (121000)'
  }
  return {
    accountId,
    accountCode,
    accountName,
    labelAr,
    labelEn,
    residualKwd: r3(residualKwd),
    linesCount: Math.max(0, Math.round(linesCount)),
  }
}

function resolveDefaultDisconnectedDateRange(
  bucketKey: OdooPeriodBucketKey,
  customFrom?: string | null,
  customTo?: string | null,
  referenceNowMs = Date.now(),
): { from: string; to: string } {
  const isoRe = /^\d{4}-\d{2}-\d{2}$/
  if (customFrom && customTo && isoRe.test(customFrom) && isoRe.test(customTo)) {
    const clamped = clampPeriodToKuwaitToday(
      {
        from: customFrom <= customTo ? customFrom : customTo,
        to: customFrom <= customTo ? customTo : customFrom,
      },
      referenceNowMs,
    )
    return { from: clamped.from, to: clamped.to }
  }
  const win = periodWindowForBucket(bucketKey, new Date(referenceNowMs))
  const shiftedInclusiveTo = isoRe.test(win.to) ? shiftIsoDate(win.to, -1) : getKuwaitTodayIso(referenceNowMs)
  const clamped = clampPeriodToKuwaitToday(
    {
      from: win.from,
      to: shiftedInclusiveTo >= win.from ? shiftedInclusiveTo : win.from,
    },
    referenceNowMs,
  )
  return { from: clamped.from, to: clamped.to }
}

export function buildDisconnectedOdooEnvelope(options?: {
  bucket?: OdooPeriodBucketKey
  customFrom?: string | null
  customTo?: string | null
  readOnly?: boolean
  referenceNowMs?: number
  diagnosticCode?: OdooDiagnosticCode
  note?: string
}): OdooLiveSyncEnvelope {
  const referenceNowMs = options?.referenceNowMs ?? Date.now()
  const bucket = options?.bucket ?? 'month'
  const dateRange = resolveDefaultDisconnectedDateRange(
    bucket,
    options?.customFrom,
    options?.customTo,
    referenceNowMs,
  )
  const envConfigured = isOdooLiveEnvConfigured()
  const diagnosticCode: OdooDiagnosticCode =
    options?.diagnosticCode ?? (envConfigured ? 'UPSTREAM_UNREACHABLE' : 'ENV_NOT_CONFIGURED')

  const envelope: OdooLiveSyncEnvelope = {
    ok: true,
    source: 'disconnected',
    connected: false,
    sourceMode: 'disconnected',
    noData: true,
    messageAr: 'لا توجد بيانات من Odoo لهذه الفترة',
    messageEn: 'No data from Odoo for this period',
    summary: null,
    lastSyncAt: null,
    isStale24h: false,
    odooCompanyId: null,
    dateRange,
    unattributedSalesKwd: 0,
    unattributedOrders: 0,
    envConfigured,
    syncedAt: '',
    latestRecordAt: '',
    latestOdooRecordAt: '',
    latestRecordKuwaitIso: '',
    kuwaitSyncedAt: '',
    latestOperationalDate: '',
    hoursSinceLatestRecord: 0,
    hoursSinceLatestOdooRecord: 0,
    isStaleOver24h: false,
    todayOrders: 0,
    todayOrdersCount: 0,
    todaySalesKwd: 0,
    syncCooldownRemainingSec: getSyncCooldownRemainingSec(referenceNowMs),
    diagnosticCode,
    lastCheckedAt: formatUtcIsoFromMs(referenceNowMs),
    readOnly: Boolean(options?.readOnly),
    cached: false,
    bucket,
    period: dateRange,
    database: null,
    totals: { netSalesKwd: 0, orders: 0, aovKwd: 0 },
    brands: [],
    branches: [],
    channels: [],
    dailySeries: [],
    hourlySeries: [],
    ...(options?.note ? { note: redactOdooSecrets(options.note) } : {}),
  }

  return sanitizeOdooPublicPayload(envelope)
}

async function safeSubQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

export function buildReconciledBucket(params: {
  key: OdooPeriodBucketKey
  from: string
  to: string
  days: number
  isLatestOperationalDay?: boolean
  locNetMap: Map<string, number>
  locOrdersMap: Map<string, number>
  unmappedNetKwd?: number
  unmappedOrders?: number
  excludedNetKwd?: number
  excludedOrders?: number
  brandRawWeights: Map<string, number>
  brandQtyWeights: Map<string, number>
  brandOrdersMap?: Map<string, number>
  locUiRawMap: Map<string, Record<string, { netKwd: number; orders: number }>>
  unmappedUiRaw?: Record<string, { netKwd: number; orders: number }>
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
    unmappedNetKwd = 0,
    unmappedOrders = 0,
    excludedNetKwd = 0,
    excludedOrders = 0,
    brandRawWeights,
    brandQtyWeights,
    brandOrdersMap,
    locUiRawMap,
    unmappedUiRaw,
    accounting,
  } = params

  const mappedBranchNet = r3(
    ACTIVE_BRANCH_IDS.reduce((acc, lid) => acc + Math.max(0, locNetMap.get(lid) ?? 0), 0),
  )
  const mappedBranchOrders = Math.max(
    0,
    Math.round(
      ACTIVE_BRANCH_IDS.reduce((acc, lid) => acc + Math.max(0, locOrdersMap.get(lid) ?? 0), 0),
    ),
  )

  const unattributedSalesKwd = r3(Math.max(0, unmappedNetKwd))
  const unattributedOrders = Math.max(0, Math.round(unmappedOrders))
  const companyNet = r3(mappedBranchNet + unattributedSalesKwd)
  const companyOrders = Math.max(0, mappedBranchOrders + unattributedOrders)

  const unattributedBranch: OdooUnattributedBranchRow = {
    id: 'unattributed',
    labelAr: UNMAPPED_BUCKET_LABEL_AR,
    labelEn: UNMAPPED_BUCKET_LABEL_EN,
    netSalesKwd: unattributedSalesKwd,
    orders: unattributedOrders,
    sharePct: pct1(unattributedSalesKwd, companyNet),
  }

  const byBrand: NonNullable<OdooBucketSummary['byBrand']> = {}
  const totalBrandRawNet = ACTIVE_BRAND_IDS.reduce(
    (acc, bid) => acc + Math.max(0, brandRawWeights.get(bid) ?? 0),
    0,
  )
  for (const bid of ACTIVE_BRAND_IDS) {
    const nv = r3(Math.max(0, brandRawWeights.get(bid) ?? 0))
    const explicitOrd = brandOrdersMap?.get(bid)
    const bOrd =
      explicitOrd !== undefined
        ? Math.max(0, Math.round(explicitOrd))
        : totalBrandRawNet > 0 && companyOrders > 0 && nv > 0
          ? Math.round((nv / totalBrandRawNet) * companyOrders)
          : 0
    byBrand[bid] = {
      netKwd: nv,
      orders: bOrd,
      qty: r3(Math.max(0, brandQtyWeights.get(bid) ?? 0)),
    }
  }

  const byLocation: NonNullable<OdooBucketSummary['byLocation']> = {}
  const mappedByLocation: NonNullable<OdooBucketSummary['mappedByLocation']> = {}
  const aggUiChannels: Record<string, { netKwd: number; orders: number }> = Object.fromEntries(
    UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }]),
  )

  for (const lid of ACTIVE_BRANCH_IDS) {
    const locRealNet = r3(Math.max(0, locNetMap.get(lid) ?? 0))
    const locRealOrd = Math.max(0, Math.round(locOrdersMap.get(lid) ?? 0))
    const rawUi =
      locUiRawMap.get(lid) ??
      Object.fromEntries(UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }]))

    const rawUiMap = new Map<string, { netKwd: number; orders: number }>(
      UI_CHANNEL_KEYS.map((ck) => [
        ck,
        {
          netKwd: Math.max(0, Number(rawUi[ck]?.netKwd) || 0),
          orders: Math.max(0, Math.round(Number(rawUi[ck]?.orders) || 0)),
        },
      ]),
    )
    if (lid === 'ardiya' && (rawUiMap.get('dine-in')?.netKwd ?? 0) > 0) {
      const dineIn = rawUiMap.get('dine-in')!
      const takeaway = rawUiMap.get('takeaway-direct')!
      rawUiMap.set('takeaway-direct', {
        netKwd: takeaway.netKwd + dineIn.netKwd,
        orders: takeaway.orders + dineIn.orders,
      })
      rawUiMap.set('dine-in', { netKwd: 0, orders: 0 })
    }

    const locUi: Record<string, { netKwd: number; orders: number }> = {}
    for (const ck of UI_CHANNEL_KEYS) {
      const entry = rawUiMap.get(ck) ?? { netKwd: 0, orders: 0 }
      const nv = r3(entry.netKwd)
      const ov = entry.orders
      locUi[ck] = { netKwd: nv, orders: ov }
      aggUiChannels[ck].netKwd = r3(aggUiChannels[ck].netKwd + nv)
      aggUiChannels[ck].orders += ov
    }

    byLocation[lid] = {
      netKwd: locRealNet,
      orders: locRealOrd,
      uiChannels: locUi,
    }
    mappedByLocation[lid] = {
      netKwd: locRealNet,
      orders: locRealOrd,
    }
  }

  if (unmappedUiRaw) {
    for (const ck of UI_CHANNEL_KEYS) {
      const uEntry = unmappedUiRaw[ck]
      if (!uEntry) continue
      aggUiChannels[ck].netKwd = r3(
        aggUiChannels[ck].netKwd + Math.max(0, Number(uEntry.netKwd) || 0),
      )
      aggUiChannels[ck].orders += Math.max(0, Math.round(Number(uEntry.orders) || 0))
    }
  }

  return {
    key,
    from,
    to,
    days,
    ...(isLatestOperationalDay ? { isLatestOperationalDay: true } : {}),
    totals: {
      netSalesKwd: companyNet,
      orders: companyOrders,
      aovKwd: companyOrders > 0 ? r3(companyNet / companyOrders) : 0,
      restaurantNetKwd: companyNet,
      restaurantOrders: companyOrders,
    },
    byBrand,
    byLocation,
    mappedByLocation,
    unattributedSalesKwd,
    unattributedOrders,
    unattributedBranch,
    unmappedSummary: {
      netSalesKwd: unattributedSalesKwd,
      orders: unattributedOrders,
    },
    excludedSummary: {
      netSalesKwd: r3(Math.max(0, excludedNetKwd)),
      orders: Math.max(0, Math.round(excludedOrders)),
    },
    uiChannels: aggUiChannels,
    ...(accounting ? { accounting } : {}),
  }
}

async function pullFreshCoreSnapshotFromOdoo(): Promise<CachedCoreSnapshot> {
  const cfg = readServerOdooConfig()
  if (!cfg) {
    throw new OdooConnectorError(
      'Odoo 17 environment variables are not configured on the server.',
      'ENV_NOT_CONFIGURED',
    )
  }

  const uid = await authenticateOdoo()

  // 1. Discover & map all POS configs (`id`, `name`, `company_id`, `picking_type_id`), POS categories, GL Chart of Accounts, user's company_id, and latest order timestamp
  const [allConfigs, posCategories, glAccountsRaw, userCompanyRows, latestOrderCandidates] = await Promise.all([
    safeSubQuery(
      () =>
        executeOdooKw<{ id: number; name: string; company_id?: M2O; picking_type_id?: M2O }[]>(
          'pos.config',
          'search_read',
          [[['active', 'in', [true, false]]]],
          {
            fields: ['id', 'name', 'company_id', 'picking_type_id'],
            context: { active_test: false },
          },
        ),
      [],
    ).then(async (rows) =>
      rows.length > 0
        ? rows
        : executeOdooKw<{ id: number; name: string; company_id?: M2O; picking_type_id?: M2O }[]>(
            'pos.config',
            'search_read',
            [[['active', 'in', [true, false]]]],
            { fields: ['id', 'name', 'company_id'], context: { active_test: false } },
          ),
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
    safeSubQuery(
      () =>
        executeOdooKw<OdooGlAccountMeta[]>(
          'account.account',
          'search_read',
          [
            [
              [
                'account_type',
                'in',
                ['income', 'income_other', 'expense_direct_cost', 'expense', 'expense_depreciation'],
              ],
            ],
          ],
          { fields: ['id', 'code', 'name', 'account_type'] },
        ),
      [],
    ),
    safeSubQuery(
      () =>
        executeOdooKw<{ id: number; company_id?: M2O }[]>(
          'res.users',
          'read',
          [[uid], ['id', 'company_id']],
        ),
      [],
    ),
    executeOdooKw<{ id: number; date_order: string; amount_total?: number; config_id?: M2O; company_id?: M2O }[]>(
      'pos.order',
      'search_read',
      [[['state', 'in', ['paid', 'done', 'invoiced']]]],
      {
        fields: ['date_order', 'amount_total', 'config_id', 'company_id'],
        order: 'date_order desc',
        limit: 12,
      },
    ),
  ])

  const resolvedCompanyId =
    m2oId(userCompanyRows?.[0]?.company_id) ??
    m2oId(allConfigs.find((c) => m2oId(c.company_id) !== null)?.company_id) ??
    null
  const companyDomain: unknown[][] =
    resolvedCompanyId !== null ? [['company_id', '=', resolvedCompanyId]] : []

  const activeGlAccountById = new Map<number, OdooGlAccountMeta>()
  for (const acc of glAccountsRaw) {
    const label = `${acc.code ?? ''} ${acc.name ?? ''}`.trim()
    if (isDecommissionedWarehouseRecord(label)) continue
    activeGlAccountById.set(acc.id, acc)
  }
  const activeGlAccountIds = [...activeGlAccountById.keys()]

  const branchOfConfigId = new Map<number, (typeof ACTIVE_BRANCH_IDS)[number]>()
  const nativeBranchOfConfigId = new Map<number, (typeof ACTIVE_BRANCH_IDS)[number]>()
  const configNameById = new Map<number, string>()
  const displayConfigNameById = new Map<number, string>()
  const decommissionedConfigIds = new Set<number>()
  for (const c of allConfigs) {
    const extraCtx = `${m2oName(c.company_id) ?? ''} ${m2oName(c.picking_type_id) ?? ''}`.trim()
    configNameById.set(c.id, `${c.name} ${extraCtx}`.trim())
    displayConfigNameById.set(c.id, sanitizePosTerminalDisplayName(c.id, c.name))
    if (isDecommissionedWarehouseRecord(`${c.name} ${extraCtx}`)) {
      decommissionedConfigIds.add(c.id)
      continue
    }
    const nativeBranch = resolveRestaurantBranchForConfig(c.id, c.name, extraCtx, {
      ignoreAdminOverride: true,
    })
    if (nativeBranch) {
      nativeBranchOfConfigId.set(c.id, nativeBranch)
    }
    const mappedBranch = resolveRestaurantBranchForConfig(c.id, c.name, extraCtx)
    if (mappedBranch) {
      branchOfConfigId.set(c.id, mappedBranch)
    }
  }
  for (const cfgId of REG.allowedPosConfigIds) {
    if (!nativeBranchOfConfigId.has(cfgId) && !decommissionedConfigIds.has(cfgId)) {
      const nb = resolveRestaurantBranchForConfig(cfgId, configNameById.get(cfgId) ?? '', '', {
        ignoreAdminOverride: true,
      })
      if (nb) nativeBranchOfConfigId.set(cfgId, nb)
    }
    if (!branchOfConfigId.has(cfgId) && !decommissionedConfigIds.has(cfgId)) {
      const b = resolveRestaurantBranchForConfig(cfgId, configNameById.get(cfgId) ?? '')
      if (b) branchOfConfigId.set(cfgId, b)
    }
  }

  const catById = new Map(posCategories.map((c) => [c.id, c]))
  const resolveRootCat = (catId: number | null): { id: number; name: string } | null => {
    let cur = catId ? catById.get(catId) : undefined
    let guard = 0
    while (cur && cur.parent_id && guard++ < 12) {
      const pid = m2oId(cur.parent_id)
      if (pid === null || !catById.has(pid)) break
      cur = catById.get(pid)
    }
    return cur ? { id: cur.id, name: cur.name } : null
  }
  const resolveRootCatName = (catId: number | null): string | null => resolveRootCat(catId)?.name ?? null
  const excludedPosCategoryIds = new Set<number>()
  for (const c of posCategories) {
    const root = resolveRootCat(c.id)
    if (
      c.id === 150 ||
      root?.id === 150 ||
      isExcludedOdooEntity(c.name) ||
      isExcludedOdooEntity(root?.name)
    ) {
      excludedPosCategoryIds.add(c.id)
    }
  }

  const excludedPosDomain: unknown[][] = [
    ...companyDomain,
    ...(decommissionedConfigIds.size > 0
      ? [['session_id.config_id', 'not in', [...decommissionedConfigIds]]]
      : []),
  ]
  const excludedPosLineDomain: unknown[][] = [
    ...(resolvedCompanyId !== null ? [['company_id', '=', resolvedCompanyId]] : []),
    ...(decommissionedConfigIds.size > 0
      ? [['order_id.session_id.config_id', 'not in', [...decommissionedConfigIds]]]
      : []),
    ...(excludedPosCategoryIds.size > 0
      ? [['product_id.pos_categ_id', 'not in', [...excludedPosCategoryIds]]]
      : []),
  ]
  const brandByPosRoot = new Map(
    REG.brands.filter((b) => b.posRoot).map((b) => [b.posRoot as string, b.id]),
  )

  // 2. Compute exact Kuwait (`UTC+3`) calendar windows -> Odoo naive UTC strings
  const nowUtcMs = Date.now()
  const kwNow = new Date(nowUtcMs + KUWAIT_OFFSET_MS)
  const todayKwIso = kwNow.toISOString().slice(0, 10)
  const tomorrowKwIso = shiftIsoDate(todayKwIso, 1)

  const newestActiveOrderRow =
    latestOrderCandidates.find((r) => {
      const cid = m2oId(r.config_id)
      const compId = m2oId(r.company_id)
      if (cid !== null && decommissionedConfigIds.has(cid)) return false
      if (resolvedCompanyId !== null && compId !== null && compId !== resolvedCompanyId) return false
      return true
    }) ?? latestOrderCandidates[0]
  const newestOrderConverted = odooUtcToKuwaitIso(newestActiveOrderRow?.date_order)

  const anchorDayKwIso =
    newestOrderConverted?.kuwaitDate && newestOrderConverted.kuwaitDate <= todayKwIso
      ? newestOrderConverted.kuwaitDate
      : todayKwIso
  const anchorTomorrowKwIso = shiftIsoDate(anchorDayKwIso, 1)
  const todayIsFallbackDay = anchorDayKwIso !== todayKwIso

  const weekFromKwIso = shiftIsoDate(anchorDayKwIso, -6)
  const monthFromKwIso = shiftIsoDate(anchorDayKwIso, -29)
  // Pre-index 65 days of daily history back from anchorDayKwIso up through tomorrowKwIso
  const series65FromKwIso = shiftIsoDate(anchorDayKwIso, -64)
  const prior30FromKwIso = shiftIsoDate(monthFromKwIso, -30)
  const mtdFromKwIso = `${anchorDayKwIso.slice(0, 7)}-01`
  const yearFromKwIso = `${anchorDayKwIso.slice(0, 4)}-01-01`

  const bounds65 = kuwaitRangeToOdooUtcStrings(series65FromKwIso, tomorrowKwIso)
  const boundsMonth = kuwaitRangeToOdooUtcStrings(monthFromKwIso, anchorTomorrowKwIso)
  const boundsWeek = kuwaitRangeToOdooUtcStrings(weekFromKwIso, anchorTomorrowKwIso)
  const boundsToday = kuwaitRangeToOdooUtcStrings(anchorDayKwIso, anchorTomorrowKwIso)
  const boundsYear = kuwaitRangeToOdooUtcStrings(yearFromKwIso, anchorTomorrowKwIso)
  const boundsPrior30 = kuwaitRangeToOdooUtcStrings(prior30FromKwIso, monthFromKwIso)

  const excludedPaymentDomain: unknown[][] = [
    ...(resolvedCompanyId !== null ? [['pos_order_id.company_id', '=', resolvedCompanyId]] : []),
    ...(decommissionedConfigIds.size > 0
      ? [['session_id.config_id', 'not in', [...decommissionedConfigIds]]]
      : []),
  ]

  // 3. Parallel PostgreSQL-side `read_group` queries across ALL active company POS terminals
  const [
    ordersByDaySessionPricelistRows,
    ordersByHourRows,
    payments30Rows,
    paymentsWeekRows,
    paymentsTodayRows,
    paymentsYearRows,
    productLines30Rows,
    productLinesWeekRows,
    productLinesTodayRows,
    productLinesYearRows,
    ytdAggRows,
    prior30AggRows,
    stockTransfers,
    aggregatorReceivables,
    decommissionedOrders30Rows,
    glTodayRows,
    glWeekRows,
    glMonthRows,
    glYearRows,
  ] = await Promise.all([
    executeOdooKw<
      {
        __count?: number
        amount_total?: number
        amount_tax?: number
        session_id: M2O
        pricelist_id?: M2O
        __range?: { 'date_order:day'?: { from?: string; to?: string } }
      }[]
    >(
      'pos.order',
      'read_group',
      [
        [
          ['date_order', '>=', bounds65.fromUtc],
          ['date_order', '<', bounds65.toUtc],
          ['state', 'in', ['paid', 'done', 'invoiced']],
          ...excludedPosDomain,
        ],
        ['amount_total:sum', 'amount_tax:sum'],
        ['session_id', 'pricelist_id', 'date_order:day'],
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
              ...excludedPosDomain,
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
              ...excludedPaymentDomain,
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
              ['pos_order_id.date_order', '>=', boundsWeek.fromUtc],
              ['pos_order_id.date_order', '<', boundsWeek.toUtc],
              ['pos_order_id.state', 'in', ['paid', 'done', 'invoiced']],
              ...excludedPaymentDomain,
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
              ...excludedPaymentDomain,
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
              ['pos_order_id.date_order', '>=', boundsYear.fromUtc],
              ['pos_order_id.date_order', '<', boundsYear.toUtc],
              ['pos_order_id.state', 'in', ['paid', 'done', 'invoiced']],
              ...excludedPaymentDomain,
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
              ...excludedPosLineDomain,
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
              ['order_id.date_order', '>=', boundsWeek.fromUtc],
              ['order_id.date_order', '<', boundsWeek.toUtc],
              ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
              ...excludedPosLineDomain,
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
              ...excludedPosLineDomain,
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
              ['order_id.date_order', '>=', boundsYear.fromUtc],
              ['order_id.date_order', '<', boundsYear.toUtc],
              ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
              ...excludedPosLineDomain,
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
        executeOdooKw<{ session_id: M2O; amount_total?: number; amount_tax?: number; __count?: number }[]>(
          'pos.order',
          'read_group',
          [
            [
              ['date_order', '>=', boundsYear.fromUtc],
              ['date_order', '<', boundsYear.toUtc],
              ['state', 'in', ['paid', 'done', 'invoiced']],
              ...excludedPosDomain,
            ],
            ['amount_total:sum', 'amount_tax:sum'],
            ['session_id'],
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
              ...excludedPosDomain,
            ],
            ['amount_total:sum', 'amount_tax:sum'],
            [],
          ],
          { lazy: false },
        ),
      [],
    ),
    safeSubQuery<OdooStockTransferSummary | undefined>(async () => {
      const [pickings, doneCount30, pendingCountTotal] = await Promise.all([
        executeOdooKw<
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
            limit: 40,
          },
        ),
        safeSubQuery(
          () =>
            executeOdooKw<number>(
              'stock.picking',
              'search_count',
              [[['state', '=', 'done'], ['date_done', '>=', boundsMonth.fromUtc]]],
            ),
          0,
        ),
        safeSubQuery(
          () =>
            executeOdooKw<number>(
              'stock.picking',
              'search_count',
              [[['state', 'in', ['assigned', 'waiting', 'confirmed']]]],
            ),
          0,
        ),
      ])
      // Strictly strip any decommissioned warehouse/branch records so ONLY Ardiya Central Kitchen & 7 active branches appear
      const activePickings = pickings.filter(
        (p) =>
          !isDecommissionedWarehouseRecord(m2oName(p.location_id)) &&
          !isDecommissionedWarehouseRecord(m2oName(p.location_dest_id)),
      )
      const sampleDoneCount = activePickings.filter((p) => p.state === 'done').length
      const samplePendingCount = activePickings.filter((p) => p.state !== 'done').length
      const recentDoneCount = Math.max(sampleDoneCount, Number(doneCount30) || 0)
      const pendingCount = Math.max(samplePendingCount, Number(pendingCountTotal) || 0)
      const latestDoneRaw = activePickings.find((p) => typeof p.date_done === 'string')?.date_done
      const latestTransferAt =
        typeof latestDoneRaw === 'string' ? normalizeOdooDateOrderToIso(latestDoneRaw) : null
      return {
        readable: true,
        recentDoneCount,
        pendingCount,
        latestTransferAt,
        routes: activePickings.slice(0, 8).map((p) => ({
          origin: m2oName(p.location_id) ?? 'Ardiya Central Kitchen (EXB)',
          destination: m2oName(p.location_dest_id) ?? 'Branch Kitchen',
          state: p.state,
          scheduledDate:
            typeof p.scheduled_date === 'string'
              ? normalizeOdooDateOrderToIso(p.scheduled_date)
              : null,
        })),
      }
    }, undefined),
    safeSubQuery<OdooReceivableClearingSummary | undefined>(async () => {
      const arDomain: unknown[][] = [
        ['parent_state', '=', 'posted'],
        ['account_id.account_type', '=', 'asset_receivable'],
        ['reconciled', '=', false],
      ]
      const ar30CutIso = shiftIsoDate(todayKwIso, -30)
      const ar60CutIso = shiftIsoDate(todayKwIso, -60)
      const [byAccRows, minDateRows, maxDateRows, maxMaturityRows, age0_30Rows, age31_60Rows, ageOver60Rows] = await Promise.all([
        executeOdooKw<{ account_id: M2O; amount_residual?: number; __count?: number }[]>(
          'account.move.line',
          'read_group',
          [arDomain, ['amount_residual:sum'], ['account_id']],
          { lazy: false },
        ),
        safeSubQuery(
          () =>
            executeOdooKw<{ date?: string }[]>(
              'account.move.line',
              'search_read',
              [arDomain],
              { fields: ['date'], order: 'date asc', limit: 1 },
            ),
          [],
        ),
        safeSubQuery(
          () =>
            executeOdooKw<{ date?: string }[]>(
              'account.move.line',
              'search_read',
              [arDomain],
              { fields: ['date'], order: 'date desc', limit: 1 },
            ),
          [],
        ),
        safeSubQuery(
          () =>
            executeOdooKw<{ date_maturity?: string | false }[]>(
              'account.move.line',
              'search_read',
              [[...arDomain, ['date_maturity', '!=', false]]],
              { fields: ['date_maturity'], order: 'date_maturity desc', limit: 1 },
            ),
          [],
        ),
        safeSubQuery(
          () =>
            executeOdooKw<{ account_id: M2O; amount_residual?: number; __count?: number }[]>(
              'account.move.line',
              'read_group',
              [[...arDomain, ['date', '>=', ar30CutIso]], ['amount_residual:sum'], ['account_id']],
              { lazy: false },
            ),
          [],
        ),
        safeSubQuery(
          () =>
            executeOdooKw<{ account_id: M2O; amount_residual?: number; __count?: number }[]>(
              'account.move.line',
              'read_group',
              [[...arDomain, ['date', '>=', ar60CutIso], ['date', '<', ar30CutIso]], ['amount_residual:sum'], ['account_id']],
              { lazy: false },
            ),
          [],
        ),
        safeSubQuery(
          () =>
            executeOdooKw<{ account_id: M2O; amount_residual?: number; __count?: number }[]>(
              'account.move.line',
              'read_group',
              [[...arDomain, ['date', '<', ar60CutIso]], ['amount_residual:sum'], ['account_id']],
              { lazy: false },
            ),
          [],
        ),
      ])

      const byAccount: OdooReceivableAccountRow[] = []
      let netSum = 0
      let grossPositive = 0
      let creditOffset = 0
      let totalLines = 0
      let posClearingLinesCount = 0
      let posClearingNetKwd = 0

      for (const r of byAccRows) {
        const accId = m2oId(r.account_id)
        const accName = m2oName(r.account_id) ?? ''
        if (accId === null || isDecommissionedWarehouseRecord(accName)) continue
        const resVal = Number(r.amount_residual) || 0
        const cnt = Math.max(0, Number(r.__count) || 0)
        netSum += resVal
        totalLines += cnt
        if (accName.includes('10552') || /Account Receivable \(PoS\)/i.test(accName)) {
          posClearingLinesCount += cnt
          posClearingNetKwd += resVal
        }
        if (resVal > 0) grossPositive += resVal
        else if (resVal < 0) creditOffset += resVal
        byAccount.push(formatReceivableAccountRow(accId, accName, resVal, cnt))
      }
      byAccount.sort((a, b) => b.residualKwd - a.residualKwd)

      const platformAndCorporateLinesCount = Math.max(0, totalLines - posClearingLinesCount)
      const platformNetKwd = r3(netSum - posClearingNetKwd)

      const summarizeAgeRows = (
        key: '0_30' | '31_60' | 'over_60',
        labelAr: string,
        labelEn: string,
        rows: { account_id: M2O; amount_residual?: number; __count?: number }[],
      ) => {
        let residual = 0
        let posDebit = 0
        let credOff = 0
        let lines = 0
        for (const row of rows) {
          const accId = m2oId(row.account_id)
          const accName = m2oName(row.account_id) ?? ''
          if (accId === null || isDecommissionedWarehouseRecord(accName)) continue
          const val = Number(row.amount_residual) || 0
          const cnt = Math.max(0, Number(row.__count) || 0)
          residual += val
          lines += cnt
          if (val > 0) posDebit += val
          else if (val < 0) credOff += val
        }
        return {
          key,
          labelAr,
          labelEn,
          residualKwd: r3(residual),
          positiveDebitKwd: r3(posDebit),
          creditOffsetKwd: r3(credOff),
          linesCount: lines,
        }
      }

      const computedAging = [
        summarizeAgeRows('0_30', '0–30 يوماً (تسويات جارية)', '0–30 Days (Current Settlements)', age0_30Rows),
        summarizeAgeRows('31_60', '31–60 يوماً (قيد المطابقة)', '31–60 Days (Pending Clearing)', age31_60Rows),
        summarizeAgeRows('over_60', 'أكثر من 60 يوماً (تراكمي سابق)', '>60 Days (Prior Unreconciled)', ageOver60Rows),
      ]
      const hasLiveAging = computedAging.some((b) => b.linesCount > 0)

      const fromDate =
        typeof minDateRows?.[0]?.date === 'string' ? minDateRows[0].date : '2024-12-31'
      const toDate =
        typeof maxDateRows?.[0]?.date === 'string' ? maxDateRows[0].date : todayKwIso
      const latestMaturityDate =
        typeof maxMaturityRows?.[0]?.date_maturity === 'string'
          ? maxMaturityRows[0].date_maturity
          : null

      return {
        readable: true,
        openReceivableKwd: r3(netSum),
        grossPositiveReceivableKwd: r3(grossPositive),
        creditClearingOffsetKwd: r3(creditOffset),
        openLinesCount: totalLines,
        posClearingLinesCount,
        platformAndCorporateLinesCount,
        fromDate,
        toDate,
        latestMaturityDate,
        maturityStatusAr: latestMaturityDate
          ? `مستحق التحصيل والمقاصة حالياً (آخر استحقاق مفوتر ${latestMaturityDate} + تسويات منصات أسبوعية جارية)`
          : 'مستحق التحصيل والمقاصة ضمن دورة التسويات الأسبوعية الجارية',
        maturityStatusEn: latestMaturityDate
          ? `Currently due for collection & clearing (latest invoiced maturity ${latestMaturityDate} + weekly aggregator settlements)`
          : 'Currently due within weekly aggregator clearing cycle',
        openLinesExplanationAr: `إجمالي ${totalLines.toLocaleString('en-US')} سطراً غير مسوّى في أودو يتكون من ${posClearingLinesCount.toLocaleString('en-US')} قيد مقاصة إيصالات كاشير فردية بحساب 10552 (${r3(posClearingNetKwd).toLocaleString('en-US')} د.ك) + ${platformAndCorporateLinesCount.toLocaleString('en-US')} قيود منصات توصيل وعملاء شركات (${platformNetKwd >= 0 ? '+' : ''}${platformNetKwd.toLocaleString('en-US')} د.ك)، وبالمجموع: +${r3(grossPositive).toLocaleString('en-US')} مدين موجب ناقص ${Math.abs(r3(creditOffset)).toLocaleString('en-US')} مقاصة دائنة = ${r3(netSum).toLocaleString('en-US')} د.ك.`,
        openLinesExplanationEn: `The ${totalLines.toLocaleString('en-US')} unreconciled Odoo lines consist of ${posClearingLinesCount.toLocaleString('en-US')} individual POS receipt clearing entries in account 10552 (${r3(posClearingNetKwd).toLocaleString('en-US')} KWD) plus ${platformAndCorporateLinesCount.toLocaleString('en-US')} aggregator & corporate AR lines (${platformNetKwd >= 0 ? '+' : ''}${platformNetKwd.toLocaleString('en-US')} KWD): +${r3(grossPositive).toLocaleString('en-US')} positive debit minus ${Math.abs(r3(creditOffset)).toLocaleString('en-US')} credit clearing = ${r3(netSum).toLocaleString('en-US')} KWD.`,
        sourceModel: 'account.move.line',
        byAccount,
        agingBuckets: computedAging,
      }
    }, undefined),
    decommissionedConfigIds.size > 0
      ? safeSubQuery(
          () =>
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
                  ...companyDomain,
                  ['date_order', '>=', boundsMonth.fromUtc],
                  ['date_order', '<', boundsMonth.toUtc],
                  ['state', 'in', ['paid', 'done', 'invoiced']],
                  ['session_id.config_id', 'in', [...decommissionedConfigIds]],
                ],
                ['amount_total:sum', 'amount_tax:sum'],
                ['session_id', 'date_order:day'],
              ],
              { lazy: false, context: { tz: 'Asia/Kuwait' } },
            ),
          [],
        )
      : Promise.resolve([]),
    activeGlAccountIds.length > 0
      ? safeSubQuery(
          () =>
            executeOdooKw<{ account_id: M2O; balance?: number; __count?: number }[]>(
              'account.move.line',
              'read_group',
              [
                [
                  ...companyDomain,
                  ['parent_state', '=', 'posted'],
                  ['date', '>=', anchorDayKwIso],
                  ['date', '<=', anchorDayKwIso],
                  ['account_id', 'in', activeGlAccountIds],
                ],
                ['balance:sum'],
                ['account_id'],
              ],
              { lazy: false },
            ),
          [],
        )
      : Promise.resolve([]),
    activeGlAccountIds.length > 0
      ? safeSubQuery(
          () =>
            executeOdooKw<{ account_id: M2O; balance?: number; __count?: number }[]>(
              'account.move.line',
              'read_group',
              [
                [
                  ...companyDomain,
                  ['parent_state', '=', 'posted'],
                  ['date', '>=', weekFromKwIso],
                  ['date', '<=', anchorDayKwIso],
                  ['account_id', 'in', activeGlAccountIds],
                ],
                ['balance:sum'],
                ['account_id'],
              ],
              { lazy: false },
            ),
          [],
        )
      : Promise.resolve([]),
    activeGlAccountIds.length > 0
      ? safeSubQuery(
          () =>
            executeOdooKw<{ account_id: M2O; balance?: number; __count?: number }[]>(
              'account.move.line',
              'read_group',
              [
                [
                  ...companyDomain,
                  ['parent_state', '=', 'posted'],
                  ['date', '>=', monthFromKwIso],
                  ['date', '<=', anchorDayKwIso],
                  ['account_id', 'in', activeGlAccountIds],
                ],
                ['balance:sum'],
                ['account_id'],
              ],
              { lazy: false },
            ),
          [],
        )
      : Promise.resolve([]),
    activeGlAccountIds.length > 0
      ? safeSubQuery(
          () =>
            executeOdooKw<{ account_id: M2O; balance?: number; __count?: number }[]>(
              'account.move.line',
              'read_group',
              [
                [
                  ...companyDomain,
                  ['parent_state', '=', 'posted'],
                  ['date', '>=', yearFromKwIso],
                  ['date', '<=', anchorDayKwIso],
                  ['account_id', 'in', activeGlAccountIds],
                ],
                ['balance:sum'],
                ['account_id'],
              ],
              { lazy: false },
            ),
          [],
        )
      : Promise.resolve([]),
  ])

  // 4. Resolve session -> config_id + product -> brand mapping
  const allSessionIds = [
    ...new Set(
      [
        ...ordersByDaySessionPricelistRows.map((o) => m2oId(o.session_id)),
        ...decommissionedOrders30Rows.map((o) => m2oId(o.session_id)),
        ...payments30Rows.map((p) => m2oId(p.session_id)),
        ...paymentsWeekRows.map((p) => m2oId(p.session_id)),
        ...paymentsTodayRows.map((p) => m2oId(p.session_id)),
        ...paymentsYearRows.map((p) => m2oId(p.session_id)),
        ...ytdAggRows.map((o) => m2oId(o.session_id)),
      ].filter((x): x is number => x !== null),
    ),
  ]

  const allProductIds = [
    ...new Set(
      [
        ...productLines30Rows,
        ...productLinesWeekRows,
        ...productLinesTodayRows,
        ...productLinesYearRows,
      ]
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
            executeOdooKw<{ id: number; name?: string; pos_categ_id: M2O }[]>(
              'product.product',
              'read',
              [allProductIds, ['id', 'name', 'pos_categ_id']],
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
    const posCatId = m2oId(p.pos_categ_id)
    if (posCatId !== null && excludedPosCategoryIds.has(posCatId)) continue
    if (isExcludedOdooEntity(p.name)) continue
    const rootName = resolveRootCatName(posCatId)
    const bid =
      (rootName ? brandByPosRoot.get(rootName) : undefined) ??
      resolveBrandHintFromText(`${rootName ?? ''} ${p.name ?? ''}`)
    if (bid && (ACTIVE_BRAND_IDS as readonly string[]).includes(bid)) {
      brandOfProductId.set(p.id, bid)
    }
  }

  // 5. Aggregate daily & hourly Kuwait series + 7 mapped branches + standalone unattributed bucket
  const dailyMap = new Map<string, { orders: number; netKwd: number }>()
  const dailyLocMap = new Map<string, Map<string, { orders: number; net: number }>>()
  const dailyUnmappedMap = new Map<string, { orders: number; net: number }>()
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

  let unmappedTodayNet = 0
  let unmappedTodayOrd = 0
  let unmappedWeekNet = 0
  let unmappedWeekOrd = 0
  let unmappedMonthNet = 0
  let unmappedMonthOrd = 0

  const pricelistUiHints30 = new Map<string, Record<string, { netKwd: number; orders: number }>>()
  for (const lid of ACTIVE_BRANCH_IDS) {
    pricelistUiHints30.set(
      lid,
      Object.fromEntries(UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }])),
    )
  }
  const unmappedPricelistUiHints30: Record<string, { netKwd: number; orders: number }> =
    Object.fromEntries(UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }]))

  let mtdNet = 0
  let mtdOrders = 0

  const rawTerminalMonthStats = new Map<number, { orders: number; net: number }>()
  const nativeTerminalMonthStats = new Map<number, { orders: number; net: number }>()
  const nativeBranchMonthStats = Object.fromEntries(
    ACTIVE_BRANCH_IDS.map((id) => [id, { netSalesKwd: 0, orders: 0 }]),
  ) as Record<ActiveVentureBranchId, { netSalesKwd: number; orders: number }>

  let excludedMonthNet = 0
  let excludedMonthOrd = 0
  let excludedWeekNet = 0
  let excludedWeekOrd = 0
  let excludedTodayNet = 0
  let excludedTodayOrd = 0
  let excludedPos24Net = 0
  let excludedPos24Ord = 0
  let excludedPos36Net = 0
  let excludedPos36Ord = 0

  for (const exRow of decommissionedOrders30Rows) {
    const rawFromUtc = exRow.__range?.['date_order:day']?.from
    const parsedRange = rawFromUtc ? odooUtcToKuwaitIso(rawFromUtc) : null
    if (!parsedRange) continue
    const dayIso = parsedRange.kuwaitDate
    const ordCount = Math.max(0, Number(exRow.__count ?? 0))
    const net = Math.max(0, (Number(exRow.amount_total) || 0) - (Number(exRow.amount_tax) || 0))
    if (ordCount <= 0 && net <= 0) continue
    const sid = m2oId(exRow.session_id)
    const cfgId = sid !== null ? configOfSession.get(sid) : undefined
    if (dayIso >= monthFromKwIso && dayIso <= anchorDayKwIso) {
      excludedMonthNet += net
      excludedMonthOrd += ordCount
      if (cfgId === 36) {
        excludedPos36Net += net
        excludedPos36Ord += ordCount
      } else {
        excludedPos24Net += net
        excludedPos24Ord += ordCount
      }
    }
    if (dayIso >= weekFromKwIso && dayIso <= anchorDayKwIso) {
      excludedWeekNet += net
      excludedWeekOrd += ordCount
    }
    if (dayIso === anchorDayKwIso) {
      excludedTodayNet += net
      excludedTodayOrd += ordCount
    }
  }

  for (const row of ordersByDaySessionPricelistRows) {
    const rawFromUtc = row.__range?.['date_order:day']?.from
    const parsedRange = rawFromUtc ? odooUtcToKuwaitIso(rawFromUtc) : null
    if (!parsedRange) continue

    const dayIso = parsedRange.kuwaitDate
    const ordCount = Math.max(0, Number(row.__count ?? 0))
    const net = Math.max(0, (Number(row.amount_total) || 0) - (Number(row.amount_tax) || 0))
    if (ordCount <= 0 && net <= 0) continue

    const sid = m2oId(row.session_id)
    const cfgId = sid !== null ? configOfSession.get(sid) : undefined
    if (cfgId !== undefined && decommissionedConfigIds.has(cfgId)) {
      continue
    }
    const branch = cfgId !== undefined ? branchOfConfigId.get(cfgId) : undefined
    const nativeBranch = cfgId !== undefined ? nativeBranchOfConfigId.get(cfgId) : undefined

    if (dayIso >= monthFromKwIso && dayIso <= anchorDayKwIso) {
      if (nativeBranch) {
        nativeBranchMonthStats[nativeBranch].netSalesKwd = r3(
          nativeBranchMonthStats[nativeBranch].netSalesKwd + net,
        )
        nativeBranchMonthStats[nativeBranch].orders += ordCount
        if (cfgId !== undefined) {
          const prevN = nativeTerminalMonthStats.get(cfgId) ?? { orders: 0, net: 0 }
          prevN.orders += ordCount
          prevN.net = r3(prevN.net + net)
          nativeTerminalMonthStats.set(cfgId, prevN)
        }
      } else if (cfgId !== undefined) {
        const prevT = rawTerminalMonthStats.get(cfgId) ?? { orders: 0, net: 0 }
        prevT.orders += ordCount
        prevT.net = r3(prevT.net + net)
        rawTerminalMonthStats.set(cfgId, prevT)
      }
    }

    const dPrev = dailyMap.get(dayIso) ?? { orders: 0, netKwd: 0 }
    dPrev.orders += ordCount
    dPrev.netKwd += net
    dailyMap.set(dayIso, dPrev)

    if (dayIso >= mtdFromKwIso && dayIso <= anchorDayKwIso) {
      mtdNet += net
      mtdOrders += ordCount
    }

    if (!branch) {
      const uPrev = dailyUnmappedMap.get(dayIso) ?? { orders: 0, net: 0 }
      uPrev.orders += ordCount
      uPrev.net += net
      dailyUnmappedMap.set(dayIso, uPrev)

      if (dayIso >= monthFromKwIso && dayIso <= anchorDayKwIso) {
        unmappedMonthNet += net
        unmappedMonthOrd += ordCount
        const cfgName = (cfgId !== undefined ? configNameById.get(cfgId) : '') ?? ''
        const plName = m2oName(row.pricelist_id) ?? ''
        const hintedCh = resolveUiChannelHint(`${plName} ${cfgName}`, true)
        unmappedPricelistUiHints30[hintedCh].netKwd += net
        unmappedPricelistUiHints30[hintedCh].orders += ordCount
      }
      if (dayIso >= weekFromKwIso && dayIso <= anchorDayKwIso) {
        unmappedWeekNet += net
        unmappedWeekOrd += ordCount
      }
      if (dayIso === anchorDayKwIso) {
        unmappedTodayNet += net
        unmappedTodayOrd += ordCount
      }
      continue
    }

    let byB = dailyLocMap.get(dayIso)
    if (!byB) {
      byB = new Map()
      dailyLocMap.set(dayIso, byB)
    }
    const lbPrev = byB.get(branch) ?? { orders: 0, net: 0 }
    lbPrev.orders += ordCount
    lbPrev.net += net
    byB.set(branch, lbPrev)

    if (dayIso >= monthFromKwIso && dayIso <= anchorDayKwIso) {
      locMonthNet.set(branch, (locMonthNet.get(branch) ?? 0) + net)
      locMonthOrd.set(branch, (locMonthOrd.get(branch) ?? 0) + ordCount)

      const cfgName = (cfgId !== undefined ? configNameById.get(cfgId) : '') ?? ''
      const isDelivCfg = branch === 'ardiya' || /delivery|call\s*center/i.test(cfgName)
      const plName = m2oName(row.pricelist_id) ?? ''
      const hintedCh = resolveUiChannelHint(`${plName} ${cfgName}`, isDelivCfg)
      const hintRow = pricelistUiHints30.get(branch)!
      hintRow[hintedCh].netKwd += net
      hintRow[hintedCh].orders += ordCount
    }
    if (dayIso >= weekFromKwIso && dayIso <= anchorDayKwIso) {
      locWeekNet.set(branch, (locWeekNet.get(branch) ?? 0) + net)
      locWeekOrd.set(branch, (locWeekOrd.get(branch) ?? 0) + ordCount)
    }
    if (dayIso === anchorDayKwIso) {
      locTodayNet.set(branch, (locTodayNet.get(branch) ?? 0) + net)
      locTodayOrd.set(branch, (locTodayOrd.get(branch) ?? 0) + ordCount)
    }
  }

  // Auto-discover all unmapped Odoo 17 `pos.config` terminals (sanitized names, zero invented baseline)
  const discoveredCandidateMap = new Map<
    number,
    { terminal_id: number; terminal_name: string; orders_count: number; net_sales_kwd: number }
  >()
  for (const [cfgId, stat] of rawTerminalMonthStats.entries()) {
    discoveredCandidateMap.set(cfgId, {
      terminal_id: cfgId,
      terminal_name:
        displayConfigNameById.get(cfgId) ??
        sanitizePosTerminalDisplayName(cfgId, configNameById.get(cfgId) ?? `POS Terminal #${cfgId}`),
      orders_count: stat.orders,
      net_sales_kwd: r3(stat.net),
    })
  }
  for (const c of allConfigs) {
    if (
      !decommissionedConfigIds.has(c.id) &&
      !nativeBranchOfConfigId.has(c.id) &&
      !discoveredCandidateMap.has(c.id) &&
      !/test|training|demo|closed|cancelled/i.test(c.name || '')
    ) {
      discoveredCandidateMap.set(c.id, {
        terminal_id: c.id,
        terminal_name: displayConfigNameById.get(c.id) ?? sanitizePosTerminalDisplayName(c.id, c.name),
        orders_count: 0,
        net_sales_kwd: 0,
      })
    }
  }
  const nativeMappedTerminalsLive = [...nativeBranchOfConfigId.entries()].map(
    ([cfgId, nb]) => ({
      terminal_id: cfgId,
      terminal_name:
        displayConfigNameById.get(cfgId) ??
        sanitizePosTerminalDisplayName(cfgId, configNameById.get(cfgId) ?? `POS Terminal #${cfgId}`),
      branch_id: nb,
      orders_count: nativeTerminalMonthStats.get(cfgId)?.orders ?? 0,
      net_sales_kwd: r3(nativeTerminalMonthStats.get(cfgId)?.net ?? 0),
    }),
  )

  recordLiveDiscoveredPosLedger({
    candidateTerminals: [...discoveredCandidateMap.values()].sort(
      (a, b) => b.net_sales_kwd - a.net_sales_kwd || a.terminal_id - b.terminal_id,
    ),
    nativeMappedTerminals: nativeMappedTerminalsLive,
    baseBranches: nativeBranchMonthStats,
    excludedEntitiesKwd: r3(excludedMonthNet),
    excludedEntitiesOrders: Math.round(excludedMonthOrd),
    excludedPos24Kwd: r3(excludedPos24Net),
    excludedPos24Orders: Math.round(excludedPos24Ord),
    excludedPos36Kwd: r3(excludedPos36Net),
    excludedPos36Orders: Math.round(excludedPos36Ord),
  })

  for (const hRow of ordersByHourRows) {
    const rawHourFromUtc = hRow.__range?.['date_order:hour']?.from
    const parsedHour = rawHourFromUtc ? odooUtcToKuwaitIso(rawHourFromUtc) : null
    if (!parsedHour) continue
    const kwHour = parsedHour.kuwaitHour
    const ordCount = Math.max(0, Number(hRow.__count ?? 0))
    const net = Math.max(0, (Number(hRow.amount_total) || 0) - (Number(hRow.amount_tax) || 0))
    hourlyAcc[kwHour].orders += ordCount
    hourlyAcc[kwHour].netKwd += net
  }

  const dailySeries = [...dailyMap.entries()]
    .filter(([, v]) => v.orders > 0 || v.netKwd > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, orders: Math.round(v.orders), netKwd: r3(v.netKwd) }))

  const allActiveDays = new Set<string>([
    ...dailyLocMap.keys(),
    ...dailyUnmappedMap.keys(),
  ])
  const dailyByBranch: Record<string, Record<string, { netKwd: number; orders: number }>> = {}
  const dailyUnattributed: Record<string, { netKwd: number; orders: number }> = {}
  for (const day of [...allActiveDays].sort()) {
    const locMap = dailyLocMap.get(day)
    const dayEntry: Record<string, { netKwd: number; orders: number }> = {}
    for (const lid of ACTIVE_BRANCH_IDS) {
      const m = locMap?.get(lid)
      dayEntry[lid] = {
        netKwd: r3(m?.net ?? 0),
        orders: Math.max(0, Math.round(m?.orders ?? 0)),
      }
    }
    dailyByBranch[day] = dayEntry
    const unm = dailyUnmappedMap.get(day)
    dailyUnattributed[day] = {
      netKwd: r3(unm?.net ?? 0),
      orders: Math.max(0, Math.round(unm?.orders ?? 0)),
    }
  }

  const hourlySeries = hourlyAcc.map((h) => ({
    hour: h.hour,
    orders: h.orders,
    netKwd: r3(h.netKwd),
  }))

  const calendarTodayStats = dailyMap.get(todayKwIso) ?? { orders: 0, netKwd: 0 }
  const rawTodayOrdersCount = Math.max(0, Math.round(calendarTodayStats.orders))
  const rawTodaySalesKwd = r3(Math.max(0, calendarTodayStats.netKwd))

  const todayBucketFrom = anchorDayKwIso
  const todayBucketTo = anchorTomorrowKwIso
  const canonicalBucketToExclusive = anchorTomorrowKwIso

  // 6. Aggregate Brand weights & Channel weights strictly from live period queries
  const buildBrandMaps = (rows: { product_id: M2O; price_subtotal: number; qty?: number }[]) => {
    const netMap = new Map<string, number>()
    const qtyMap = new Map<string, number>()
    for (const r of rows) {
      const pid = m2oId(r.product_id)
      const pName = m2oName(r.product_id) ?? ''
      if (isExcludedOdooEntity(pName)) continue
      const bid =
        (pid !== null ? brandOfProductId.get(pid) : undefined) ??
        resolveBrandHintFromText(pName)
      if (!bid || !(ACTIVE_BRAND_IDS as readonly string[]).includes(bid)) continue
      netMap.set(bid, (netMap.get(bid) ?? 0) + Math.max(0, Number(r.price_subtotal) || 0))
      qtyMap.set(bid, (qtyMap.get(bid) ?? 0) + Math.max(0, Number(r.qty) || 0))
    }
    return { netMap, qtyMap }
  }

  const brand30 = buildBrandMaps(productLines30Rows)
  const brandWeek = buildBrandMaps(productLinesWeekRows)
  const brandToday = buildBrandMaps(productLinesTodayRows)
  const brandYear = buildBrandMaps(productLinesYearRows)

  const buildLocAndUnmappedUiMap = (
    payRows: { session_id: M2O; payment_method_id: M2O; amount: number; __count?: number }[],
  ) => {
    const locMap = new Map<string, Record<string, { netKwd: number; orders: number }>>()
    for (const lid of ACTIVE_BRANCH_IDS) {
      locMap.set(
        lid,
        Object.fromEntries(UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }])),
      )
    }
    const unmappedUi: Record<string, { netKwd: number; orders: number }> = Object.fromEntries(
      UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }]),
    )
    for (const p of payRows) {
      const sid = m2oId(p.session_id)
      const cfgId = sid !== null ? configOfSession.get(sid) : undefined
      if (cfgId !== undefined && decommissionedConfigIds.has(cfgId)) continue
      const lid = cfgId !== undefined ? branchOfConfigId.get(cfgId) : undefined
      const cfgName = (cfgId !== undefined ? configNameById.get(cfgId) : '') ?? ''
      const isDelivCfg = !lid || lid === 'ardiya' || /delivery|call\s*center/i.test(cfgName)
      const uiKey = resolveUiChannelHint(m2oName(p.payment_method_id) ?? '', isDelivCfg)
      const amt = Math.max(0, Number(p.amount) || 0)
      const cnt = Math.max(0, Number(p.__count) || 0)
      if (!lid) {
        unmappedUi[uiKey].netKwd += amt
        unmappedUi[uiKey].orders += cnt
      } else {
        const row = locMap.get(lid)!
        row[uiKey].netKwd += amt
        row[uiKey].orders += cnt
      }
    }
    return { locMap, unmappedUi }
  }

  const has30Payments = payments30Rows.some((p) => (Number(p.amount) || 0) > 0)
  const built30Ui = buildLocAndUnmappedUiMap(payments30Rows)
  const locUi30 = has30Payments ? built30Ui.locMap : pricelistUiHints30
  const unmappedUi30 = has30Payments ? built30Ui.unmappedUi : unmappedPricelistUiHints30

  const builtWeekUi = buildLocAndUnmappedUiMap(paymentsWeekRows)
  const builtTodayUi = buildLocAndUnmappedUiMap(paymentsTodayRows)
  const builtYearUi = buildLocAndUnmappedUiMap(paymentsYearRows)

  // 7. Build YTD bucket (`year`) strictly from live `ytdAggRows` (`session_id -> config_id`) without forced reconciliation
  const locYearNet = new Map<string, number>()
  const locYearOrd = new Map<string, number>()
  let unmappedYearNet = 0
  let unmappedYearOrd = 0
  for (const yrRow of ytdAggRows) {
    const sid = m2oId(yrRow.session_id)
    const cfgId = sid !== null ? configOfSession.get(sid) : undefined
    if (cfgId !== undefined && decommissionedConfigIds.has(cfgId)) continue
    const net = Math.max(0, (Number(yrRow.amount_total) || 0) - (Number(yrRow.amount_tax) || 0))
    const ord = Math.max(0, Number(yrRow.__count ?? 0))
    if (ord <= 0 && net <= 0) continue
    const branch = cfgId !== undefined ? branchOfConfigId.get(cfgId) : undefined
    if (!branch) {
      unmappedYearNet += net
      unmappedYearOrd += ord
    } else {
      locYearNet.set(branch, (locYearNet.get(branch) ?? 0) + net)
      locYearOrd.set(branch, (locYearOrd.get(branch) ?? 0) + ord)
    }
  }

  const ytdDays = Math.max(
    1,
    Math.round(
      (Date.parse(`${anchorTomorrowKwIso}T00:00:00Z`) - Date.parse(`${yearFromKwIso}T00:00:00Z`)) /
        86_400_000,
    ),
  )

  const todayInclusiveIso = shiftIsoDate(todayBucketTo, -1)
  const canonicalInclusiveIso = shiftIsoDate(canonicalBucketToExclusive, -1)
  const liveTodayAccounting =
    activeGlAccountIds.length > 0
      ? buildLedgerAccountingFromGroups({
          fromIso: todayBucketFrom,
          toInclusiveIso: todayInclusiveIso >= todayBucketFrom ? todayInclusiveIso : todayBucketFrom,
          accountById: activeGlAccountById,
          rows: glTodayRows,
        })
      : undefined
  const liveWeekAccounting =
    activeGlAccountIds.length > 0
      ? buildLedgerAccountingFromGroups({
          fromIso: weekFromKwIso,
          toInclusiveIso: canonicalInclusiveIso,
          accountById: activeGlAccountById,
          rows: glWeekRows,
        })
      : undefined
  const liveMonthAccounting =
    activeGlAccountIds.length > 0
      ? buildLedgerAccountingFromGroups({
          fromIso: monthFromKwIso,
          toInclusiveIso: canonicalInclusiveIso,
          accountById: activeGlAccountById,
          rows: glMonthRows,
        })
      : undefined
  const liveYearAccounting =
    activeGlAccountIds.length > 0
      ? buildLedgerAccountingFromGroups({
          fromIso: yearFromKwIso,
          toInclusiveIso: canonicalInclusiveIso,
          accountById: activeGlAccountById,
          rows: glYearRows,
        })
      : undefined

  const todayBucket = buildReconciledBucket({
    key: 'today',
    from: todayBucketFrom,
    to: todayBucketTo,
    days: 1,
    isLatestOperationalDay: todayIsFallbackDay,
    locNetMap: locTodayNet,
    locOrdersMap: locTodayOrd,
    unmappedNetKwd: unmappedTodayNet,
    unmappedOrders: unmappedTodayOrd,
    excludedNetKwd: excludedTodayNet,
    excludedOrders: excludedTodayOrd,
    brandRawWeights: brandToday.netMap,
    brandQtyWeights: brandToday.qtyMap,
    locUiRawMap: builtTodayUi.locMap,
    unmappedUiRaw: builtTodayUi.unmappedUi,
    accounting: liveTodayAccounting,
  })

  const weekBucket = buildReconciledBucket({
    key: 'week',
    from: weekFromKwIso,
    to: canonicalBucketToExclusive,
    days: 7,
    locNetMap: locWeekNet,
    locOrdersMap: locWeekOrd,
    unmappedNetKwd: unmappedWeekNet,
    unmappedOrders: unmappedWeekOrd,
    excludedNetKwd: excludedWeekNet,
    excludedOrders: excludedWeekOrd,
    brandRawWeights: brandWeek.netMap,
    brandQtyWeights: brandWeek.qtyMap,
    locUiRawMap: builtWeekUi.locMap,
    unmappedUiRaw: builtWeekUi.unmappedUi,
    accounting: liveWeekAccounting,
  })

  const monthBucket = buildReconciledBucket({
    key: 'month',
    from: monthFromKwIso,
    to: canonicalBucketToExclusive,
    days: 30,
    locNetMap: locMonthNet,
    locOrdersMap: locMonthOrd,
    unmappedNetKwd: unmappedMonthNet,
    unmappedOrders: unmappedMonthOrd,
    excludedNetKwd: excludedMonthNet,
    excludedOrders: excludedMonthOrd,
    brandRawWeights: brand30.netMap,
    brandQtyWeights: brand30.qtyMap,
    locUiRawMap: locUi30,
    unmappedUiRaw: unmappedUi30,
    accounting: liveMonthAccounting,
  })

  const yearBucket = buildReconciledBucket({
    key: 'year',
    from: yearFromKwIso,
    to: canonicalBucketToExclusive,
    days: ytdDays,
    locNetMap: locYearNet,
    locOrdersMap: locYearOrd,
    unmappedNetKwd: unmappedYearNet,
    unmappedOrders: unmappedYearOrd,
    brandRawWeights: brandYear.netMap,
    brandQtyWeights: brandYear.qtyMap,
    locUiRawMap: builtYearUi.locMap,
    unmappedUiRaw: builtYearUi.unmappedUi,
    accounting: liveYearAccounting,
  })

  const prior30Net = r3(
    Math.max(
      0,
      (Number(prior30AggRows?.[0]?.amount_total) || 0) -
        (Number(prior30AggRows?.[0]?.amount_tax) || 0),
    ),
  )
  const prior30Orders = Math.max(0, Number(prior30AggRows?.[0]?.__count ?? 0))
  const mtdDays = Math.max(
    1,
    Math.round(
      (Date.parse(`${anchorTomorrowKwIso}T00:00:00Z`) - Date.parse(`${mtdFromKwIso}T00:00:00Z`)) /
        86_400_000,
    ),
  )

  const journeyPulse: OdooLiveSummary['journeyPulse'] = {
    rolling30: {
      from: monthFromKwIso,
      to: todayBucketFrom,
      days: 30,
      netKwd: monthBucket.totals.restaurantNetKwd,
      orders: monthBucket.totals.restaurantOrders,
      perDayKwd: r3(monthBucket.totals.restaurantNetKwd / 30),
    },
    prior30: {
      from: prior30FromKwIso,
      to: shiftIsoDate(monthFromKwIso, -1),
      days: 30,
      netKwd: prior30Net,
      orders: prior30Orders,
      perDayKwd: r3(prior30Net / 30),
    },
    mtd: {
      from: mtdFromKwIso,
      to: todayBucketFrom,
      days: mtdDays,
      netKwd: r3(mtdNet),
      orders: mtdOrders,
      perDayKwd: r3(mtdNet / mtdDays),
    },
  }

  const fetchedAtMs = Date.now()
  const resolvedLatestRecordAt =
    newestOrderConverted?.utcIso ?? formatUtcIsoFromMs(fetchedAtMs)
  const resolvedOperationalDate =
    newestOrderConverted?.kuwaitDate ?? anchorDayKwIso

  const liveMappedBranchesNet = r3(
    ACTIVE_BRANCH_IDS.reduce((s, lid) => s + Math.max(0, locMonthNet.get(lid) ?? 0), 0),
  )
  const liveExcludedMonthNet = r3(excludedMonthNet)
  const liveExcludedMonthOrd = Math.round(excludedMonthOrd)
  const liveGrossPreExclusionNet = r3(monthBucket.totals.netSalesKwd + liveExcludedMonthNet)

  return {
    fetchedAtMs,
    connected: true,
    sourceMode: 'odoo17-live',
    envConfigured: true,
    odooCompanyId: resolvedCompanyId,
    diagnosticCode: 'OK_LIVE',
    latestRecordAt: resolvedLatestRecordAt,
    latestOperationalDate: resolvedOperationalDate,
    todayOrdersCount: rawTodayOrdersCount,
    todaySalesKwd: rawTodaySalesKwd,
    companyTotals: {
      grossPreExclusionKwd: liveGrossPreExclusionNet,
      excludedEntitiesKwd: liveExcludedMonthNet,
      excludedEntitiesOrders: liveExcludedMonthOrd,
      mappedBranchesNetKwd: liveMappedBranchesNet,
      netSalesKwd: monthBucket.totals.netSalesKwd,
      orders: monthBucket.totals.orders,
      unmappedTerminalsNetKwd: r3(unmappedMonthNet),
      unmappedTerminalsOrders: Math.round(unmappedMonthOrd),
      reconciliationGapKwd: 0,
      reconciledExact: true,
    },
    buckets: {
      today: todayBucket,
      week: weekBucket,
      month: monthBucket,
      year: yearBucket,
    },
    dailySeries,
    dailyByBranch,
    dailyUnattributed,
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
    customBucket?: OdooBucketSummary
    sourceModeOverride?: OdooLiveSyncEnvelope['sourceMode']
    connectedOverride?: boolean
    diagnosticCodeOverride?: OdooDiagnosticCode
    rateLimitedCooldown?: boolean
    noteOverride?: string
  },
): OdooLiveSyncEnvelope {
  const bkt = options.customBucket ?? core.buckets[bucketKey] ?? core.buckets.month
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
    .filter((b) => b.netKwd > 0 && !isExcludedOdooEntity(b.id) && !isExcludedOdooEntity(b.brand))
    .sort((a, b) => b.netKwd - a.netKwd)

  const branchSource = bkt.mappedByLocation ?? bkt.byLocation
  const rawBranches = ACTIVE_BRANCH_IDS.map((lid) => {
    const nv = r3(branchSource?.[lid]?.netKwd ?? 0)
    const ord = Math.max(0, Math.round(branchSource?.[lid]?.orders ?? 0))
    return {
      id: lid,
      name: REG.locations[lid]?.en ?? lid,
      unit: 'restaurant',
      netSalesKwd: nv,
      orders: ord,
    }
  }).filter((b) => !isExcludedOdooEntity(b.id) && !isExcludedOdooEntity(b.name))

  const branchSumNet = r3(rawBranches.reduce((acc, b) => acc + b.netSalesKwd, 0))
  const branchSumOrd = rawBranches.reduce((acc, b) => acc + b.orders, 0)
  const bktUnmappedNet = bkt.unmappedSummary
    ? r3(Math.max(0, bkt.unmappedSummary.netSalesKwd))
    : r3(Math.max(0, bkt.unattributedSalesKwd ?? 0))
  const bktUnmappedOrd = bkt.unmappedSummary
    ? Math.max(0, Math.round(bkt.unmappedSummary.orders))
    : Math.max(0, Math.round(bkt.unattributedOrders ?? 0))
  const bucketCompanyNet = r3(branchSumNet + bktUnmappedNet)
  const bucketCompanyOrd = branchSumOrd + bktUnmappedOrd
  const bktExcludedNet = bkt.excludedSummary
    ? r3(Math.max(0, bkt.excludedSummary.netSalesKwd))
    : bucketKey === 'month' && !options.customBucket
      ? r3(Math.max(0, core.companyTotals.excludedEntitiesKwd ?? 0))
      : 0
  const bktExcludedOrd = bkt.excludedSummary
    ? Math.max(0, Math.round(bkt.excludedSummary.orders))
    : bucketKey === 'month' && !options.customBucket
      ? Math.max(0, Math.round(core.companyTotals.excludedEntitiesOrders ?? 0))
      : 0
  const bucketGrossPreExclusionNet = r3(bucketCompanyNet + bktExcludedNet)
  const bucketReconciliationGap = r3(
    Math.max(
      Math.abs(r3(bucketGrossPreExclusionNet - bktExcludedNet) - bucketCompanyNet),
      Math.abs(r3(branchSumNet + bktUnmappedNet) - bucketCompanyNet),
    ),
  )

  const branches = rawBranches
    .map((b) => ({
      ...b,
      sharePct: pct1(b.netSalesKwd, bucketCompanyNet > 0 ? bucketCompanyNet : totalNet),
    }))
    .sort((a, b) => b.netSalesKwd - a.netSalesKwd)

  const channels = UI_CHANNEL_KEYS.map((ck) => ({
    name: ck,
    amountKwd: bkt.uiChannels?.[ck]?.netKwd ?? 0,
  })).sort((a, b) => b.amountKwd - a.amountKwd)

  const effectiveConnected = options.connectedOverride ?? core.connected
  const effectiveSourceMode = options.sourceModeOverride ?? core.sourceMode
  const effectiveDiag: OdooDiagnosticCode | undefined =
    options.diagnosticCodeOverride ?? core.diagnosticCode
  const noteText = options.noteOverride ?? core.note
  const cooldownSec = getSyncCooldownRemainingSec(options.referenceNowMs)
  const shiftedInclusiveEnd = shiftIsoDate(bkt.to, -1)
  const canonicalInclusiveTo =
    shiftedInclusiveEnd >= bkt.from ? shiftedInclusiveEnd : bkt.from
  const clampedPeriod = clampPeriodToKuwaitToday(
    { from: bkt.from, to: canonicalInclusiveTo },
    options.referenceNowMs,
  )
  const slicedDailySeries = sliceDailySeriesToPeriod(
    core.dailySeries,
    { from: clampedPeriod.from, to: clampedPeriod.to },
    options.referenceNowMs,
  )

  const lastSyncAt = formatUtcIsoFromMs(core.fetchedAtMs)
  const dateRange = { from: clampedPeriod.from, to: clampedPeriod.to }
  const periodHasNoData = bucketCompanyOrd <= 0 && bucketCompanyNet <= 0
  const unattributedBranch: OdooUnattributedBranchRow = bkt.unattributedBranch ?? {
    id: 'unattributed',
    labelAr: UNMAPPED_BUCKET_LABEL_AR,
    labelEn: UNMAPPED_BUCKET_LABEL_EN,
    netSalesKwd: bktUnmappedNet,
    orders: bktUnmappedOrd,
    sharePct: pct1(bktUnmappedNet, bucketCompanyNet),
  }

  const summaryPayload: OdooLiveSummary = {
    source: 'live',
    connected: effectiveConnected,
    sourceMode: effectiveSourceMode,
    noData: periodHasNoData,
    ...(periodHasNoData ? { messageAr: 'لا توجد بيانات من Odoo لهذه الفترة' } : {}),
    lastSyncAt,
    isStale24h: freshness.isStaleOver24h,
    odooCompanyId: core.odooCompanyId,
    dateRange,
    syncedAt: freshness.latestRecordIso,
    latestRecordAt: freshness.latestRecordIso,
    latestOperationalDate: core.latestOperationalDate,
    hoursSinceLatestRecord: freshness.hoursSinceLatestOdooRecord,
    isStaleOver24h: freshness.isStaleOver24h,
    todayOrdersCount: core.todayOrdersCount,
    todaySalesKwd: core.todaySalesKwd,
    syncCooldownRemainingSec: cooldownSec,
    bucket: options.customBucket ? 'custom' : bucketKey,
    period: dateRange,
    database: null,
    totals: {
      netSalesKwd: bkt.totals.restaurantNetKwd,
      orders: bkt.totals.restaurantOrders,
      aovKwd: bkt.totals.aovKwd,
    },
    companyTotals: {
      grossPreExclusionKwd: bucketGrossPreExclusionNet,
      excludedEntitiesKwd: bktExcludedNet,
      excludedEntitiesOrders: bktExcludedOrd,
      mappedBranchesNetKwd: branchSumNet,
      netSalesKwd: bucketCompanyNet,
      orders: bucketCompanyOrd,
      unmappedTerminalsNetKwd: bktUnmappedNet,
      unmappedTerminalsOrders: bktUnmappedOrd,
      reconciliationGapKwd: bucketReconciliationGap,
      reconciledExact: bucketReconciliationGap === 0,
    },
    unattributedSalesKwd: bktUnmappedNet,
    unattributedOrders: bktUnmappedOrd,
    unattributedBranch,
    brands,
    branches,
    channels,
    buckets: core.buckets,
    ...(options.customBucket ? { customBucket: options.customBucket } : {}),
    dailySeries: slicedDailySeries,
    ...(core.dailyByBranch ? { dailyByBranch: core.dailyByBranch } : {}),
    ...(core.dailyUnattributed ? { dailyUnattributed: core.dailyUnattributed } : {}),
    hourlySeries: core.hourlySeries,
    ...(core.stockTransfers ? { stockTransfers: core.stockTransfers } : {}),
    ...(core.aggregatorReceivables
      ? { aggregatorReceivables: core.aggregatorReceivables }
      : {}),
    ...(core.journeyPulse
      ? {
          journeyPulse: {
            ...core.journeyPulse,
            rolling30: {
              ...core.journeyPulse.rolling30,
              to: clampedPeriod.to,
            },
            mtd: {
              ...core.journeyPulse.mtd,
              to: clampedPeriod.to,
            },
          },
        }
      : {}),
    ...(noteText ? { note: redactOdooSecrets(noteText) } : {}),
  }

  const envelope: OdooLiveSyncEnvelope = {
    ...summaryPayload,
    ok: true,
    connected: effectiveConnected,
    sourceMode: effectiveSourceMode,
    noData: periodHasNoData,
    ...(periodHasNoData ? { messageAr: 'لا توجد بيانات من Odoo لهذه الفترة' } : {}),
    summary: summaryPayload,
    lastSyncAt,
    isStale24h: freshness.isStaleOver24h,
    odooCompanyId: core.odooCompanyId,
    dateRange,
    unattributedSalesKwd: bktUnmappedNet,
    unattributedOrders: bktUnmappedOrd,
    envConfigured: core.envConfigured,
    latestRecordAt: freshness.latestRecordIso,
    latestOdooRecordAt: freshness.kuwaitIso,
    latestRecordKuwaitIso: freshness.kuwaitIso,
    kuwaitSyncedAt: freshness.kuwaitTimestamp,
    hoursSinceLatestRecord: freshness.hoursSinceLatestOdooRecord,
    hoursSinceLatestOdooRecord: freshness.hoursSinceLatestOdooRecord,
    isStaleOver24h: freshness.isStaleOver24h,
    todayOrders: core.todayOrdersCount,
    todayOrdersCount: core.todayOrdersCount,
    todaySalesKwd: core.todaySalesKwd,
    syncCooldownRemainingSec: cooldownSec,
    diagnosticCode: effectiveDiag,
    ...(options.rateLimitedCooldown ? { rateLimitedCooldown: true } : {}),
    lastCheckedAt: formatUtcIsoFromMs(options.referenceNowMs),
    readOnly: options.readOnly,
    cached: options.cached,
  }

  return sanitizeOdooPublicPayload(envelope)
}

/**
 * Fetches exact live Odoo 17 POS + `account.move.line` accounting summary for an arbitrary custom `[fromIso, toInclusiveIso]` range.
 * Powered directly by `fetchLiveOdooPeriodCube` so brands, channels, 7 branches, and unattributed sales are 100% live from Odoo 17.
 */
export async function fetchLiveOdooCustomBucket(
  rawFromIso?: string | null,
  rawToInclusiveIso?: string | null,
  referenceNowMs = Date.now(),
): Promise<OdooBucketSummary | undefined> {
  assertServerRuntime()
  if (!rawFromIso || !rawToInclusiveIso) return undefined
  const isoRe = /^\d{4}-\d{2}-\d{2}$/
  if (!isoRe.test(rawFromIso) || !isoRe.test(rawToInclusiveIso)) return undefined
  const clamped = clampPeriodToKuwaitToday(
    {
      from: rawFromIso <= rawToInclusiveIso ? rawFromIso : rawToInclusiveIso,
      to: rawFromIso <= rawToInclusiveIso ? rawToInclusiveIso : rawFromIso,
    },
    referenceNowMs,
  )
  if (!isOdooLiveEnvConfigured()) return undefined

  const cacheKey = `${clamped.from}..${clamped.to}`
  const cached = customBucketCache.get(cacheKey)
  if (cached && referenceNowMs - cached.fetchedAtMs < LIVE_SNAPSHOT_TTL_MS) {
    return cached.bucket
  }

  const cube = await fetchLiveOdooPeriodCube(clamped.from, clamped.to, referenceNowMs)
  if (!cube.connected) return undefined

  const locNet = new Map<string, number>()
  const locOrd = new Map<string, number>()
  const locUiMap = new Map<string, Record<string, { netKwd: number; orders: number }>>()
  for (const lid of ACTIVE_BRANCH_IDS) {
    const br = cube.byBranch[lid]
    locNet.set(lid, br?.netKwd ?? 0)
    locOrd.set(lid, br?.orders ?? 0)
    locUiMap.set(
      lid,
      br?.channels ??
        Object.fromEntries(UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }])),
    )
  }

  const brandNetW = new Map<string, number>()
  const brandQtyW = new Map<string, number>()
  const brandOrdW = new Map<string, number>()
  for (const bid of ACTIVE_BRAND_IDS) {
    brandNetW.set(bid, cube.byBrand[bid]?.netKwd ?? 0)
    brandQtyW.set(bid, cube.byBrand[bid]?.qty ?? 0)
    brandOrdW.set(bid, cube.byBrand[bid]?.orders ?? 0)
  }

  const builtCustom = buildReconciledBucket({
    key: 'month',
    from: cube.dateRange.from,
    to: shiftIsoDate(cube.dateRange.to, 1),
    days: cube.days,
    locNetMap: locNet,
    locOrdersMap: locOrd,
    unmappedNetKwd: cube.totals.unattributedSalesKwd,
    unmappedOrders: cube.totals.unattributedOrders,
    excludedNetKwd: cube.totals.excludedEntitiesKwd,
    excludedOrders: cube.totals.excludedEntitiesOrders,
    brandRawWeights: brandNetW,
    brandQtyWeights: brandQtyW,
    brandOrdersMap: brandOrdW,
    locUiRawMap: locUiMap,
    unmappedUiRaw: cube.unattributed.channels,
    accounting: cube.accounting,
  })
  const customBucket: OdooBucketSummary = { ...builtCustom, key: 'custom' }
  if (customBucketCache.size >= 24) {
    const oldest = customBucketCache.keys().next().value
    if (oldest) customBucketCache.delete(oldest)
  }
  customBucketCache.set(cacheKey, { fetchedAtMs: referenceNowMs, bucket: customBucket })
  return customBucket
}

/**
 * Read-only accessor for `auditor` sessions: returns the latest warm live server cache if connected,
 * or a strict disconnected envelope with zero invented fallback numbers.
 */
export function getReadOnlyOdooSnapshotStatus(
  rawPeriod?: string | null,
  referenceNowMs = Date.now(),
): OdooLiveSyncEnvelope {
  assertServerRuntime()
  const bucket = parseBucketKey(rawPeriod)
  if (!isOdooLiveEnvConfigured()) {
    return buildDisconnectedOdooEnvelope({
      bucket,
      readOnly: true,
      referenceNowMs,
      diagnosticCode: 'ENV_NOT_CONFIGURED',
    })
  }
  if (coreSnapshotCache && coreSnapshotCache.connected) {
    return formatEnvelopeFromCore(coreSnapshotCache, bucket, {
      readOnly: true,
      cached: true,
      referenceNowMs,
      noteOverride: 'Read-only auditor session: displaying synced Odoo 17 telemetry.',
    })
  }
  return buildDisconnectedOdooEnvelope({
    bucket,
    readOnly: true,
    referenceNowMs,
    diagnosticCode: 'UPSTREAM_UNREACHABLE',
  })
}

/**
 * Primary server-side live Odoo 17 snapshot fetcher:
 * - 60-second TTL cache when connected
 * - Strict no-fallback disconnect mode (`connected: false, sourceMode: 'disconnected', noData: true, summary: null`)
 *   whenever `ODOO_*` env vars are missing or Odoo JSON-RPC fails.
 */
export async function fetchLiveOdooSnapshot(options?: {
  period?: string | null
  customFrom?: string | null
  customTo?: string | null
  forceRefresh?: boolean
  readOnly?: boolean
  referenceNowMs?: number
}): Promise<OdooLiveSyncEnvelope> {
  assertServerRuntime()
  const bucket = parseBucketKey(options?.period)
  const referenceNowMs = options?.referenceNowMs ?? Date.now()
  const readOnly = Boolean(options?.readOnly)
  const isCustomPeriod = Boolean(
    options?.period === 'custom' && options?.customFrom && options?.customTo,
  )

  if (!isOdooLiveEnvConfigured()) {
    coreSnapshotCache = null
    lastKnownGoodSnapshot = null
    clearLiveDiscoveredPosLedger()
    return buildDisconnectedOdooEnvelope({
      bucket,
      customFrom: options?.customFrom,
      customTo: options?.customTo,
      readOnly,
      referenceNowMs,
      diagnosticCode: 'ENV_NOT_CONFIGURED',
    })
  }

  if (options?.forceRefresh) {
    coreSnapshotCache = null
    inflightCorePull = null
    customBucketCache.clear()
    periodCubeCache.clear()
    warehouseChainCache.clear()
    purchaseOrdersCache.clear()
    hrSummaryCache = null
    circuitOpenUntilMs = 0
  }

  if (
    !options?.forceRefresh &&
    coreSnapshotCache &&
    coreSnapshotCache.connected &&
    referenceNowMs - coreSnapshotCache.fetchedAtMs < LIVE_SNAPSHOT_TTL_MS
  ) {
    const customBucket = isCustomPeriod
      ? await fetchLiveOdooCustomBucket(options?.customFrom, options?.customTo, referenceNowMs)
      : undefined
    if (isCustomPeriod && !customBucket) {
      return buildDisconnectedOdooEnvelope({
        bucket,
        customFrom: options?.customFrom,
        customTo: options?.customTo,
        readOnly,
        referenceNowMs,
        diagnosticCode: 'UPSTREAM_UNREACHABLE',
      })
    }
    return formatEnvelopeFromCore(coreSnapshotCache, bucket, {
      readOnly,
      cached: true,
      referenceNowMs,
      customBucket,
    })
  }

  if (!options?.forceRefresh && circuitOpenUntilMs > referenceNowMs) {
    return buildDisconnectedOdooEnvelope({
      bucket,
      customFrom: options?.customFrom,
      customTo: options?.customTo,
      readOnly,
      referenceNowMs,
      diagnosticCode: 'CIRCUIT_OPEN_DISCONNECTED',
      note: 'Odoo 17 upstream circuit breaker active; disconnected until upstream recovers.',
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
    lastKnownGoodSnapshot = freshCore
    consecutiveUpstreamFailures = 0
    circuitOpenUntilMs = 0

    const nowAfterPull = Date.now()
    const customBucket = isCustomPeriod
      ? await fetchLiveOdooCustomBucket(options?.customFrom, options?.customTo, nowAfterPull)
      : undefined
    if (isCustomPeriod && !customBucket) {
      return buildDisconnectedOdooEnvelope({
        bucket,
        customFrom: options?.customFrom,
        customTo: options?.customTo,
        readOnly,
        referenceNowMs: nowAfterPull,
        diagnosticCode: 'UPSTREAM_UNREACHABLE',
      })
    }

    return formatEnvelopeFromCore(freshCore, bucket, {
      readOnly,
      cached: false,
      referenceNowMs: nowAfterPull,
      customBucket,
    })
  } catch (err) {
    consecutiveUpstreamFailures += 1
    if (consecutiveUpstreamFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      circuitOpenUntilMs = Date.now() + CIRCUIT_OPEN_DURATION_MS
    }
    coreSnapshotCache = null
    lastKnownGoodSnapshot = null
    clearLiveDiscoveredPosLedger()

    const diagCode: OdooDiagnosticCode =
      err instanceof OdooConnectorError ? err.diagnosticCode : 'UPSTREAM_UNREACHABLE'
    const safeReason = redactOdooSecrets(
      err instanceof Error ? err.message : 'Odoo connection error',
    )

    return buildDisconnectedOdooEnvelope({
      bucket,
      customFrom: options?.customFrom,
      customTo: options?.customTo,
      readOnly,
      referenceNowMs: Date.now(),
      diagnosticCode: diagCode,
      note: `Odoo 17 connection failed (${safeReason}).`,
    })
  }
}

/**
 * Rate-limited manual `POST` sync handler enforcing the 30-second cooldown (`MANUAL_SYNC_COOLDOWN_MS`)
 * so rapid executive clicks never overload Odoo's workers, while Cron jobs (`isCron: true`) always refresh cleanly.
 */
export async function triggerManualOdooSync(options?: {
  period?: string | null
  customFrom?: string | null
  customTo?: string | null
  isCron?: boolean
  referenceNowMs?: number
}): Promise<OdooLiveSyncEnvelope> {
  assertServerRuntime()
  const nowMs = options?.referenceNowMs ?? Date.now()
  const bucket = parseBucketKey(options?.period)
  const remainingSec = getSyncCooldownRemainingSec(nowMs)

  if (!isOdooLiveEnvConfigured()) {
    coreSnapshotCache = null
    lastKnownGoodSnapshot = null
    clearLiveDiscoveredPosLedger()
    return buildDisconnectedOdooEnvelope({
      bucket,
      customFrom: options?.customFrom,
      customTo: options?.customTo,
      readOnly: false,
      referenceNowMs: nowMs,
      diagnosticCode: 'ENV_NOT_CONFIGURED',
    })
  }

  if (!options?.isCron && remainingSec > 0 && coreSnapshotCache && coreSnapshotCache.connected) {
    const customBucket =
      options?.period === 'custom' && options?.customFrom && options?.customTo
        ? await fetchLiveOdooCustomBucket(options.customFrom, options.customTo, nowMs)
        : undefined
    return formatEnvelopeFromCore(coreSnapshotCache, bucket, {
      readOnly: false,
      cached: true,
      referenceNowMs: nowMs,
      customBucket,
      diagnosticCodeOverride: 'MANUAL_SYNC_COOLDOWN_ACTIVE',
      rateLimitedCooldown: true,
      noteOverride: `Manual sync cooldown active (${remainingSec}s remaining); serving warm cached snapshot.`,
    })
  }

  if (!options?.isCron) {
    lastManualSyncAtMs = nowMs
  }

  return fetchLiveOdooSnapshot({
    period: options?.period,
    customFrom: options?.customFrom,
    customTo: options?.customTo,
    forceRefresh: true,
    readOnly: false,
    referenceNowMs: nowMs,
  })
}

/**
 * Live comparison overlay returning the connected live daily series & branch series,
 * or strict disconnected envelope when Odoo is unreachable or unconfigured.
 */
export async function fetchLiveOdooComparisonOverlay(params: {
  fromA: string
  toA: string
  fromB: string
  toB: string
  readOnly?: boolean
  referenceNowMs?: number
}): Promise<OdooLiveSyncEnvelope> {
  assertServerRuntime()
  const nowMs = params.referenceNowMs ?? Date.now()
  if (!isOdooLiveEnvConfigured()) {
    return buildDisconnectedOdooEnvelope({
      bucket: 'month',
      readOnly: Boolean(params.readOnly),
      referenceNowMs: nowMs,
      diagnosticCode: 'ENV_NOT_CONFIGURED',
    })
  }

  const baseEnvelope = await fetchLiveOdooSnapshot({
    period: 'month',
    readOnly: Boolean(params.readOnly),
    referenceNowMs: nowMs,
  })
  if (!baseEnvelope.connected || !coreSnapshotCache) {
    return baseEnvelope
  }

  const kwTodayIso = getKuwaitTodayIso(nowMs)
  return sanitizeOdooPublicPayload({
    ...baseEnvelope,
    dailySeries: (coreSnapshotCache.dailySeries ?? []).filter((d) => d.day <= kwTodayIso),
    ...(coreSnapshotCache.dailyByBranch ? { dailyByBranch: coreSnapshotCache.dailyByBranch } : {}),
    ...(coreSnapshotCache.dailyUnattributed
      ? { dailyUnattributed: coreSnapshotCache.dailyUnattributed }
      : {}),
  })
}

function buildDisconnectedPeriodCube(
  dateRange: { from: string; to: string },
  messageAr = 'لا توجد بيانات من Odoo لهذه الفترة',
): OdooPeriodCube {
  const days = Math.max(
    1,
    Math.round(
      (Date.parse(`${dateRange.to}T00:00:00Z`) - Date.parse(`${dateRange.from}T00:00:00Z`)) /
        86_400_000,
    ) + 1,
  )
  const emptyChannels = () =>
    Object.fromEntries(UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }])) as Record<
      (typeof UI_CHANNEL_KEYS)[number],
      { netKwd: 0; orders: 0 }
    >
  const byBranch = Object.fromEntries(
    ACTIVE_BRANCH_IDS.map((lid) => [
      lid,
      { netKwd: 0, orders: 0, aovKwd: 0, channels: emptyChannels() },
    ]),
  ) as OdooPeriodCube['byBranch']
  const byBrand = Object.fromEntries(
    ACTIVE_BRAND_IDS.map((bid) => [
      bid,
      { netKwd: 0, qty: 0, linesCount: 0, orders: 0, avgDiscountPct: 0, discountKwd: 0 },
    ]),
  ) as OdooPeriodCube['byBrand']
  const emptyHours = () =>
    Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, netKwd: 0 }))
  const hourlyByBranch: OdooPeriodCube['hourlyByBranch'] = {
    unattributed: emptyHours(),
  }
  for (const lid of ACTIVE_BRANCH_IDS) {
    hourlyByBranch[lid] = emptyHours()
  }
  return {
    connected: false,
    sourceMode: 'disconnected',
    noData: true,
    messageAr,
    odooCompanyId: null,
    lastSyncAt: null,
    isStale24h: false,
    dateRange,
    days,
    totals: {
      netSalesKwd: 0,
      orders: 0,
      aovKwd: 0,
      mappedBranchesNetKwd: 0,
      mappedBranchesOrders: 0,
      unattributedSalesKwd: 0,
      unattributedOrders: 0,
      excludedEntitiesKwd: 0,
      excludedEntitiesOrders: 0,
      totalDiscountKwd: 0,
      avgDiscountPct: 0,
      discountedLinesCount: 0,
    },
    byBranch,
    unattributed: {
      id: 'unattributed',
      labelAr: UNMAPPED_BUCKET_LABEL_AR,
      labelEn: UNMAPPED_BUCKET_LABEL_EN,
      netKwd: 0,
      orders: 0,
      aovKwd: 0,
      channels: emptyChannels(),
    },
    byBrand,
    brandByBranch: {},
    byChannel: emptyChannels(),
    dailySeries: [],
    dailyByBranch: {},
    dailyUnattributed: {},
    hourlySeries: emptyHours(),
    hourlyByBranch,
    topProducts: [],
  }
}

/**
 * Queries Odoo 17 live via `executeOdooKw` for an exact Kuwait date period `[fromKwIso, toKwIso]` (inclusive):
 *  (a) `pos.order` grouped by `session_id` (-> `pos.session.config_id`), `pricelist_id`, `date_order:day`
 *  (b) `pos.order` grouped by `session_id`, `date_order:hour`
 *  (c) `pos.payment` grouped by `session_id`, `payment_method_id`
 *  (d) `pos.order.line` grouped by `product_id` (`price_subtotal:sum`, `qty:sum`, `discount:avg`) overall & per branch
 *  (e) `account.move.line` posted GL entries (`glIncomplete` & `aggregatorCommissionUnposted` flags)
 */
export async function fetchLiveOdooPeriodCube(
  fromKwIso: string,
  toKwIso: string,
  referenceNowMs = Date.now(),
): Promise<OdooPeriodCube> {
  assertServerRuntime()
  const isoRe = /^\d{4}-\d{2}-\d{2}$/
  const fallbackToday = getKuwaitTodayIso(referenceNowMs)
  const rawFrom = isoRe.test(fromKwIso) ? fromKwIso : fallbackToday
  const rawTo = isoRe.test(toKwIso) ? toKwIso : rawFrom
  const clamped = clampPeriodToKuwaitToday(
    {
      from: rawFrom <= rawTo ? rawFrom : rawTo,
      to: rawFrom <= rawTo ? rawTo : rawFrom,
    },
    referenceNowMs,
  )
  const dateRange = { from: clamped.from, to: clamped.to }

  if (!isOdooLiveEnvConfigured()) {
    return buildDisconnectedPeriodCube(dateRange)
  }

  const cacheKey = `${dateRange.from}..${dateRange.to}`
  const cached = periodCubeCache.get(cacheKey)
  if (cached && referenceNowMs - cached.fetchedAtMs < LIVE_SNAPSHOT_TTL_MS) {
    return cached.cube
  }

  try {
    const uid = await authenticateOdoo()
    const bounds = kuwaitDateBoundsToOdooUtc(dateRange.from, dateRange.to)
    const days = Math.max(
      1,
      Math.round(
        (Date.parse(`${dateRange.to}T00:00:00Z`) - Date.parse(`${dateRange.from}T00:00:00Z`)) /
          86_400_000,
      ) + 1,
    )

    const [allConfigs, posCategories, glAccountsRaw, userCompanyRows, latestOrderRows] =
      await Promise.all([
        executeOdooKw<{ id: number; name: string; company_id?: M2O; picking_type_id?: M2O }[]>(
          'pos.config',
          'search_read',
          [[['active', 'in', [true, false]]]],
          {
            fields: ['id', 'name', 'company_id', 'picking_type_id'],
            context: { active_test: false },
          },
        ).catch(() =>
          executeOdooKw<{ id: number; name: string; company_id?: M2O; picking_type_id?: M2O }[]>(
            'pos.config',
            'search_read',
            [[['active', 'in', [true, false]]]],
            { fields: ['id', 'name', 'company_id'], context: { active_test: false } },
          ),
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
        safeSubQuery(
          () =>
            executeOdooKw<OdooGlAccountMeta[]>(
              'account.account',
              'search_read',
              [
                [
                  [
                    'account_type',
                    'in',
                    [
                      'income',
                      'income_other',
                      'expense_direct_cost',
                      'expense',
                      'expense_depreciation',
                    ],
                  ],
                ],
              ],
              { fields: ['id', 'code', 'name', 'account_type'] },
            ),
          [],
        ),
        safeSubQuery(
          () =>
            executeOdooKw<{ id: number; company_id?: M2O }[]>(
              'res.users',
              'read',
              [[uid], ['id', 'company_id']],
            ),
          [],
        ),
        safeSubQuery(
          () =>
            executeOdooKw<{ id: number; date_order: string }[]>(
              'pos.order',
              'search_read',
              [[['state', 'in', ['paid', 'done', 'invoiced']]]],
              { fields: ['date_order'], order: 'date_order desc', limit: 1 },
            ),
          [],
        ),
      ])

    const resolvedCompanyId =
      m2oId(userCompanyRows?.[0]?.company_id) ??
      m2oId(allConfigs.find((c) => m2oId(c.company_id) !== null)?.company_id) ??
      null
    const companyDomain: unknown[][] =
      resolvedCompanyId !== null ? [['company_id', '=', resolvedCompanyId]] : []

    const decommCfgIds = new Set<number>()
    const branchOfCfg = new Map<number, (typeof ACTIVE_BRANCH_IDS)[number]>()
    const cfgIdsByBranch = new Map<(typeof ACTIVE_BRANCH_IDS)[number], number[]>()
    for (const lid of ACTIVE_BRANCH_IDS) {
      cfgIdsByBranch.set(lid, [])
    }
    const cfgNameMap = new Map<number, string>()
    for (const c of allConfigs) {
      const extra = `${m2oName(c.company_id) ?? ''} ${m2oName(c.picking_type_id) ?? ''}`.trim()
      cfgNameMap.set(c.id, `${c.name} ${extra}`.trim())
      if (isDecommissionedWarehouseRecord(`${c.name} ${extra}`)) {
        decommCfgIds.add(c.id)
        continue
      }
      const mb = resolveRestaurantBranchForConfig(c.id, c.name, extra)
      if (mb) {
        branchOfCfg.set(c.id, mb)
        cfgIdsByBranch.get(mb)!.push(c.id)
      }
    }
    for (const cfgId of REG.allowedPosConfigIds) {
      if (!branchOfCfg.has(cfgId) && !decommCfgIds.has(cfgId)) {
        const mb = resolveRestaurantBranchForConfig(cfgId, cfgNameMap.get(cfgId) ?? '')
        if (mb) {
          branchOfCfg.set(cfgId, mb)
          cfgIdsByBranch.get(mb)!.push(cfgId)
        }
      }
    }

    const catById = new Map(posCategories.map((c) => [c.id, c]))
    const resolveRootCat = (catId: number | null): { id: number; name: string } | null => {
      let cur = catId ? catById.get(catId) : undefined
      let guard = 0
      while (cur && cur.parent_id && guard++ < 12) {
        const pid = m2oId(cur.parent_id)
        if (pid === null || !catById.has(pid)) break
        cur = catById.get(pid)
      }
      return cur ? { id: cur.id, name: cur.name } : null
    }
    const excludedPosCatIds = new Set<number>()
    for (const c of posCategories) {
      const root = resolveRootCat(c.id)
      if (
        c.id === 150 ||
        root?.id === 150 ||
        isExcludedOdooEntity(c.name) ||
        isExcludedOdooEntity(root?.name)
      ) {
        excludedPosCatIds.add(c.id)
      }
    }
    const brandByPosRoot = new Map(
      REG.brands.filter((b) => b.posRoot).map((b) => [b.posRoot as string, b.id]),
    )

    const activeAccMap = new Map<number, OdooGlAccountMeta>()
    for (const a of glAccountsRaw) {
      if (!isDecommissionedWarehouseRecord(`${a.code ?? ''} ${a.name ?? ''}`)) {
        activeAccMap.set(a.id, a)
      }
    }
    const activeAccIds = [...activeAccMap.keys()]

    const exclPosOrderDomain: unknown[][] = [
      ...companyDomain,
      ...(decommCfgIds.size > 0 ? [['session_id.config_id', 'not in', [...decommCfgIds]]] : []),
    ]
    const exclPaymentDomain: unknown[][] = [
      ...(resolvedCompanyId !== null ? [['pos_order_id.company_id', '=', resolvedCompanyId]] : []),
      ...(decommCfgIds.size > 0 ? [['session_id.config_id', 'not in', [...decommCfgIds]]] : []),
    ]
    const exclLineDomain: unknown[][] = [
      ...companyDomain,
      ...(decommCfgIds.size > 0
        ? [['order_id.session_id.config_id', 'not in', [...decommCfgIds]]]
        : []),
      ...(excludedPosCatIds.size > 0
        ? [['product_id.pos_categ_id', 'not in', [...excludedPosCatIds]]]
        : []),
    ]

    type LineGroupRow = {
      product_id: M2O
      price_subtotal?: number
      qty?: number
      discount?: number
      __count?: number
    }

    const [
      dailyOrderRows,
      hourlyOrderRows,
      paymentRows,
      lineRowsAll,
      discountedLineRows,
      decommOrderRows,
      glRows,
    ] = await Promise.all([
      executeOdooKw<
        {
          __count?: number
          amount_total?: number
          amount_tax?: number
          session_id: M2O
          pricelist_id?: M2O
          __range?: { 'date_order:day'?: { from?: string; to?: string } }
        }[]
      >(
        'pos.order',
        'read_group',
        [
          [
            ['date_order', '>=', bounds.fromUtc],
            ['date_order', '<', bounds.toExclusiveUtc],
            ['state', 'in', ['paid', 'done', 'invoiced']],
            ...exclPosOrderDomain,
          ],
          ['amount_total:sum', 'amount_tax:sum'],
          ['session_id', 'pricelist_id', 'date_order:day'],
        ],
        { lazy: false, context: { tz: 'Asia/Kuwait' } },
      ),
      executeOdooKw<
        {
          __count?: number
          amount_total?: number
          amount_tax?: number
          session_id: M2O
          __range?: { 'date_order:hour'?: { from?: string; to?: string } }
        }[]
      >(
        'pos.order',
        'read_group',
        [
          [
            ['date_order', '>=', bounds.fromUtc],
            ['date_order', '<', bounds.toExclusiveUtc],
            ['state', 'in', ['paid', 'done', 'invoiced']],
            ...exclPosOrderDomain,
          ],
          ['amount_total:sum', 'amount_tax:sum'],
          ['session_id', 'date_order:hour'],
        ],
        { lazy: false, context: { tz: 'Asia/Kuwait' } },
      ),
      executeOdooKw<
        {
          session_id: M2O
          payment_method_id: M2O
          amount?: number
          __count?: number
        }[]
      >(
        'pos.payment',
        'read_group',
        [
          [
            ['pos_order_id.date_order', '>=', bounds.fromUtc],
            ['pos_order_id.date_order', '<', bounds.toExclusiveUtc],
            ['pos_order_id.state', 'in', ['paid', 'done', 'invoiced']],
            ...exclPaymentDomain,
          ],
          ['amount:sum'],
          ['session_id', 'payment_method_id'],
        ],
        { lazy: false },
      ),
      executeOdooKw<LineGroupRow[]>(
        'pos.order.line',
        'read_group',
        [
          [
            ['order_id.date_order', '>=', bounds.fromUtc],
            ['order_id.date_order', '<', bounds.toExclusiveUtc],
            ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
            ...exclLineDomain,
          ],
          ['price_subtotal:sum', 'qty:sum', 'discount:avg'],
          ['product_id'],
        ],
        { lazy: false },
      ),
      safeSubQuery(
        () =>
          executeOdooKw<LineGroupRow[]>(
            'pos.order.line',
            'read_group',
            [
              [
                ['order_id.date_order', '>=', bounds.fromUtc],
                ['order_id.date_order', '<', bounds.toExclusiveUtc],
                ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
                ['discount', '>', 0],
                ...exclLineDomain,
              ],
              ['price_subtotal:sum', 'qty:sum', 'discount:avg'],
              ['product_id'],
            ],
            { lazy: false },
          ),
        [],
      ),
      decommCfgIds.size > 0
        ? safeSubQuery(
            () =>
              executeOdooKw<{ amount_total?: number; amount_tax?: number; __count?: number }[]>(
                'pos.order',
                'read_group',
                [
                  [
                    ...companyDomain,
                    ['date_order', '>=', bounds.fromUtc],
                    ['date_order', '<', bounds.toExclusiveUtc],
                    ['state', 'in', ['paid', 'done', 'invoiced']],
                    ['session_id.config_id', 'in', [...decommCfgIds]],
                  ],
                  ['amount_total:sum', 'amount_tax:sum'],
                  [],
                ],
                { lazy: false },
              ),
            [],
          )
        : Promise.resolve([]),
      activeAccIds.length > 0
        ? safeSubQuery(
            () =>
              executeOdooKw<{ account_id: M2O; balance?: number; __count?: number }[]>(
                'account.move.line',
                'read_group',
                [
                  [
                    ...companyDomain,
                    ['parent_state', '=', 'posted'],
                    ['date', '>=', dateRange.from],
                    ['date', '<=', dateRange.to],
                    ['account_id', 'in', activeAccIds],
                  ],
                  ['balance:sum'],
                  ['account_id'],
                ],
                { lazy: false },
              ),
            [],
          )
        : Promise.resolve([]),
    ])

    // Per-branch `pos.order.line` read_group in 2 small waves of <=4 to preserve Odoo worker pool
    const allMappedAndDecommCfgIds = [
      ...new Set([...branchOfCfg.keys(), ...decommCfgIds]),
    ]
    const branchLineTargets: { key: string; domain: unknown[][] }[] = []
    for (const lid of ACTIVE_BRANCH_IDS) {
      const cids = cfgIdsByBranch.get(lid) ?? []
      if (cids.length > 0) {
        branchLineTargets.push({
          key: lid,
          domain: [['order_id.session_id.config_id', 'in', cids]],
        })
      }
    }
    branchLineTargets.push({
      key: 'unattributed',
      domain:
        allMappedAndDecommCfgIds.length > 0
          ? [['order_id.session_id.config_id', 'not in', allMappedAndDecommCfgIds]]
          : [],
    })

    const lineRowsByTarget = new Map<string, LineGroupRow[]>()
    for (let i = 0; i < branchLineTargets.length; i += 4) {
      const wave = branchLineTargets.slice(i, i + 4)
      const waveResults = await Promise.all(
        wave.map((t) =>
          safeSubQuery(
            () =>
              executeOdooKw<LineGroupRow[]>(
                'pos.order.line',
                'read_group',
                [
                  [
                    ['order_id.date_order', '>=', bounds.fromUtc],
                    ['order_id.date_order', '<', bounds.toExclusiveUtc],
                    ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
                    ...exclLineDomain,
                    ...t.domain,
                  ],
                  ['price_subtotal:sum', 'qty:sum', 'discount:avg'],
                  ['product_id'],
                ],
                { lazy: false },
              ),
            [],
          ),
        ),
      )
      for (let j = 0; j < wave.length; j++) {
        lineRowsByTarget.set(wave[j].key, waveResults[j])
      }
    }

    const allSessionIds = [
      ...new Set(
        [
          ...dailyOrderRows.map((o) => m2oId(o.session_id)),
          ...hourlyOrderRows.map((o) => m2oId(o.session_id)),
          ...paymentRows.map((p) => m2oId(p.session_id)),
        ].filter((x): x is number => x !== null),
      ),
    ]
    const allProductIds = [
      ...new Set(
        [
          ...lineRowsAll.map((l) => m2oId(l.product_id)),
          ...[...lineRowsByTarget.values()].flatMap((rows) => rows.map((l) => m2oId(l.product_id))),
        ].filter((x): x is number => x !== null),
      ),
    ]

    const [sessionRecords, productRecords] = await Promise.all([
      allSessionIds.length > 0
        ? executeOdooKw<{ id: number; config_id: M2O }[]>(
            'pos.session',
            'read',
            [allSessionIds, ['id', 'config_id']],
          )
        : Promise.resolve([]),
      allProductIds.length > 0
        ? executeOdooKw<{ id: number; name?: string; pos_categ_id: M2O }[]>(
            'product.product',
            'read',
            [allProductIds, ['id', 'name', 'pos_categ_id']],
          )
        : Promise.resolve([]),
    ])

    const cfgOfSession = new Map<number, number>()
    for (const s of sessionRecords) {
      const cid = m2oId(s.config_id)
      if (cid !== null) cfgOfSession.set(s.id, cid)
    }

    const productMetaById = new Map<
      number,
      { name: string; brandId: (typeof ACTIVE_BRAND_IDS)[number] }
    >()
    for (const p of productRecords) {
      const posCatId = m2oId(p.pos_categ_id)
      if (posCatId !== null && excludedPosCatIds.has(posCatId)) continue
      const pName = (p.name ?? '').trim()
      if (isExcludedOdooEntity(pName)) continue
      const rootName = resolveRootCat(posCatId)?.name ?? null
      const bid =
        (rootName ? brandByPosRoot.get(rootName) : undefined) ??
        resolveBrandHintFromText(`${rootName ?? ''} ${pName}`)
      if (bid && (ACTIVE_BRAND_IDS as readonly string[]).includes(bid)) {
        productMetaById.set(p.id, {
          name: pName || `Product #${p.id}`,
          brandId: bid as (typeof ACTIVE_BRAND_IDS)[number],
        })
      }
    }

    const emptyChannels = () =>
      Object.fromEntries(UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }])) as Record<
        (typeof UI_CHANNEL_KEYS)[number],
        { netKwd: number; orders: number }
      >

    const byBranch = Object.fromEntries(
      ACTIVE_BRANCH_IDS.map((lid) => [
        lid,
        { netKwd: 0, orders: 0, aovKwd: 0, channels: emptyChannels() },
      ]),
    ) as OdooPeriodCube['byBranch']
    const pricelistFallbackByBranch = Object.fromEntries(
      ACTIVE_BRANCH_IDS.map((lid) => [lid, emptyChannels()]),
    ) as Record<(typeof ACTIVE_BRANCH_IDS)[number], ReturnType<typeof emptyChannels>>
    const pricelistFallbackUnattributed = emptyChannels()

    let unattributedSalesKwd = 0
    let unattributedOrders = 0
    const unattributedChannels = emptyChannels()

    const dailyTotalsMap = new Map<
      string,
      { orders: number; netKwd: number; unattributedNetKwd: number; unattributedOrders: number }
    >()
    const dailyLocMap = new Map<string, Map<(typeof ACTIVE_BRANCH_IDS)[number], { netKwd: number; orders: number }>>()

    for (const row of dailyOrderRows) {
      const rawFromUtc = row.__range?.['date_order:day']?.from
      const conv = rawFromUtc ? odooUtcToKuwaitIso(rawFromUtc) : null
      const dayIso = conv?.kuwaitDate ?? dateRange.from
      const sid = m2oId(row.session_id)
      const cid = sid !== null ? cfgOfSession.get(sid) : undefined
      if (cid !== undefined && decommCfgIds.has(cid)) continue

      const ord = Math.max(0, Number(row.__count ?? 0))
      const net = Math.max(0, (Number(row.amount_total) || 0) - (Number(row.amount_tax) || 0))
      if (ord <= 0 && net <= 0) continue

      const branch = cid !== undefined ? branchOfCfg.get(cid) : undefined
      const cfgNm = (cid !== undefined ? cfgNameMap.get(cid) : '') ?? ''
      const plNm = m2oName(row.pricelist_id) ?? ''

      const dPrev = dailyTotalsMap.get(dayIso) ?? {
        orders: 0,
        netKwd: 0,
        unattributedNetKwd: 0,
        unattributedOrders: 0,
      }
      dPrev.orders += ord
      dPrev.netKwd += net

      if (!branch) {
        unattributedSalesKwd += net
        unattributedOrders += ord
        dPrev.unattributedNetKwd += net
        dPrev.unattributedOrders += ord
        const chKey = resolveUiChannelHint(`${plNm} ${cfgNm}`, true)
        pricelistFallbackUnattributed[chKey].netKwd += net
        pricelistFallbackUnattributed[chKey].orders += ord
      } else {
        byBranch[branch].netKwd += net
        byBranch[branch].orders += ord
        let byB = dailyLocMap.get(dayIso)
        if (!byB) {
          byB = new Map()
          dailyLocMap.set(dayIso, byB)
        }
        const bPrev = byB.get(branch) ?? { netKwd: 0, orders: 0 }
        bPrev.netKwd += net
        bPrev.orders += ord
        byB.set(branch, bPrev)

        const isDeliv = branch === 'ardiya' || /delivery|call\s*center/i.test(cfgNm)
        const chKey = resolveUiChannelHint(`${plNm} ${cfgNm}`, isDeliv)
        pricelistFallbackByBranch[branch][chKey].netKwd += net
        pricelistFallbackByBranch[branch][chKey].orders += ord
      }
      dailyTotalsMap.set(dayIso, dPrev)
    }

    const hasPayments = paymentRows.some((p) => (Number(p.amount) || 0) > 0)
    if (hasPayments) {
      for (const p of paymentRows) {
        const sid = m2oId(p.session_id)
        const cid = sid !== null ? cfgOfSession.get(sid) : undefined
        if (cid !== undefined && decommCfgIds.has(cid)) continue
        const branch = cid !== undefined ? branchOfCfg.get(cid) : undefined
        const cfgNm = (cid !== undefined ? cfgNameMap.get(cid) : '') ?? ''
        const isDeliv = !branch || branch === 'ardiya' || /delivery|call\s*center/i.test(cfgNm)
        const chKey = resolveUiChannelHint(m2oName(p.payment_method_id) ?? '', isDeliv)
        const amt = Math.max(0, Number(p.amount) || 0)
        const cnt = Math.max(0, Number(p.__count) || 0)
        if (!branch) {
          unattributedChannels[chKey].netKwd += amt
          unattributedChannels[chKey].orders += cnt
        } else {
          byBranch[branch].channels[chKey].netKwd += amt
          byBranch[branch].channels[chKey].orders += cnt
        }
      }
    } else {
      for (const lid of ACTIVE_BRANCH_IDS) {
        byBranch[lid].channels = pricelistFallbackByBranch[lid]
      }
      for (const ck of UI_CHANNEL_KEYS) {
        unattributedChannels[ck] = pricelistFallbackUnattributed[ck]
      }
    }

    const byChannel = emptyChannels()
    for (const lid of ACTIVE_BRANCH_IDS) {
      if ((byBranch[lid === 'ardiya' ? 'ardiya' : lid].channels['dine-in']?.netKwd ?? 0) > 0 && lid === 'ardiya') {
        const di = byBranch.ardiya.channels['dine-in']
        byBranch.ardiya.channels['takeaway-direct'].netKwd += di.netKwd
        byBranch.ardiya.channels['takeaway-direct'].orders += di.orders
        byBranch.ardiya.channels['dine-in'] = { netKwd: 0, orders: 0 }
      }
      byBranch[lid].netKwd = r3(byBranch[lid].netKwd)
      byBranch[lid].orders = Math.round(byBranch[lid].orders)
      byBranch[lid].aovKwd =
        byBranch[lid].orders > 0 ? r3(byBranch[lid].netKwd / byBranch[lid].orders) : 0
      for (const ck of UI_CHANNEL_KEYS) {
        byBranch[lid].channels[ck].netKwd = r3(byBranch[lid].channels[ck].netKwd)
        byBranch[lid].channels[ck].orders = Math.round(byBranch[lid].channels[ck].orders)
        byChannel[ck].netKwd = r3(byChannel[ck].netKwd + byBranch[lid].channels[ck].netKwd)
        byChannel[ck].orders += byBranch[lid].channels[ck].orders
      }
    }
    unattributedSalesKwd = r3(unattributedSalesKwd)
    unattributedOrders = Math.round(unattributedOrders)
    for (const ck of UI_CHANNEL_KEYS) {
      unattributedChannels[ck].netKwd = r3(unattributedChannels[ck].netKwd)
      unattributedChannels[ck].orders = Math.round(unattributedChannels[ck].orders)
      byChannel[ck].netKwd = r3(byChannel[ck].netKwd + unattributedChannels[ck].netKwd)
      byChannel[ck].orders += unattributedChannels[ck].orders
    }

    const hourlyAcc = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, netKwd: 0 }))
    const hourlyByBranch: OdooPeriodCube['hourlyByBranch'] = {
      unattributed: Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, netKwd: 0 })),
    }
    for (const lid of ACTIVE_BRANCH_IDS) {
      hourlyByBranch[lid] = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        orders: 0,
        netKwd: 0,
      }))
    }
    for (const hRow of hourlyOrderRows) {
      const rawHourUtc = hRow.__range?.['date_order:hour']?.from
      const conv = rawHourUtc ? odooUtcToKuwaitIso(rawHourUtc) : null
      if (!conv) continue
      const sid = m2oId(hRow.session_id)
      const cid = sid !== null ? cfgOfSession.get(sid) : undefined
      if (cid !== undefined && decommCfgIds.has(cid)) continue
      const ord = Math.max(0, Number(hRow.__count ?? 0))
      const net = Math.max(0, (Number(hRow.amount_total) || 0) - (Number(hRow.amount_tax) || 0))
      const hr = conv.kuwaitHour
      hourlyAcc[hr].orders += ord
      hourlyAcc[hr].netKwd += net
      const branch = cid !== undefined ? branchOfCfg.get(cid) : undefined
      const targetKey = branch ?? 'unattributed'
      hourlyByBranch[targetKey][hr].orders += ord
      hourlyByBranch[targetKey][hr].netKwd += net
    }
    const hourlySeries = hourlyAcc.map((h) => ({
      hour: h.hour,
      orders: Math.round(h.orders),
      netKwd: r3(h.netKwd),
    }))
    for (const k of Object.keys(hourlyByBranch)) {
      hourlyByBranch[k] = hourlyByBranch[k].map((h) => ({
        hour: h.hour,
        orders: Math.round(h.orders),
        netKwd: r3(h.netKwd),
      }))
    }

    // Discounts by product from `discountedLineRows` (`discount > 0`)
    const discountByProductId = new Map<
      number,
      { discountedLines: number; avgDiscOnDiscounted: number; discountKwd: number }
    >()
    let totalDiscountKwd = 0
    let discountedLinesCount = 0
    let weightedDiscNumerator = 0
    let totalLinesCountAll = 0

    for (const dRow of discountedLineRows) {
      const pid = m2oId(dRow.product_id)
      if (pid === null) continue
      const meta = productMetaById.get(pid)
      const fallbackBid = resolveBrandHintFromText(m2oName(dRow.product_id) ?? '')
      if (!meta && !fallbackBid) continue
      const sub = Math.max(0, Number(dRow.price_subtotal) || 0)
      const discPct = Math.min(99.9, Math.max(0, Number(dRow.discount) || 0))
      const cnt = Math.max(0, Math.round(Number(dRow.__count) || 0))
      const discKwd =
        discPct >= 99.9
          ? 0
          : discPct > 0 && sub > 0
            ? r3((sub * (discPct / 100)) / (1 - discPct / 100))
            : 0
      discountByProductId.set(pid, {
        discountedLines: cnt,
        avgDiscOnDiscounted: discPct,
        discountKwd: discKwd,
      })
      totalDiscountKwd += discKwd
      discountedLinesCount += cnt
      weightedDiscNumerator += discPct * cnt
    }

    const byBrand = Object.fromEntries(
      ACTIVE_BRAND_IDS.map((bid) => [
        bid,
        { netKwd: 0, qty: 0, linesCount: 0, orders: 0, avgDiscountPct: 0, discountKwd: 0 },
      ]),
    ) as OdooPeriodCube['byBrand']
    const brandDiscNumerator = new Map<string, number>()
    const topProductsRaw: OdooPeriodCubeProductRow[] = []

    for (const lRow of lineRowsAll) {
      const pid = m2oId(lRow.product_id)
      if (pid === null) continue
      const rawLabel = m2oName(lRow.product_id) ?? ''
      if (isExcludedOdooEntity(rawLabel)) continue
      const meta = productMetaById.get(pid)
      const fallbackBid = resolveBrandHintFromText(rawLabel)
      const bid = (meta?.brandId ?? fallbackBid) as (typeof ACTIVE_BRAND_IDS)[number] | null
      if (!bid || !(ACTIVE_BRAND_IDS as readonly string[]).includes(bid)) continue

      const net = Math.max(0, Number(lRow.price_subtotal) || 0)
      const qty = Math.max(0, Number(lRow.qty) || 0)
      const cnt = Math.max(0, Math.round(Number(lRow.__count) || 0))
      const avgDisc = Math.max(0, Number(lRow.discount) || 0)
      const discMeta = discountByProductId.get(pid)
      const prodDiscKwd = discMeta?.discountKwd ?? 0

      totalLinesCountAll += cnt
      byBrand[bid].netKwd += net
      byBrand[bid].qty += qty
      byBrand[bid].linesCount += cnt
      byBrand[bid].discountKwd += prodDiscKwd
      brandDiscNumerator.set(bid, (brandDiscNumerator.get(bid) ?? 0) + avgDisc * cnt)

      topProductsRaw.push({
        productId: pid,
        name: meta?.name || rawLabel || `Product #${pid}`,
        brandId: bid,
        netKwd: r3(net),
        qty: r3(qty),
        linesCount: cnt,
        avgDiscountPct: Math.round(avgDisc * 100) / 100,
        discountKwd: r3(prodDiscKwd),
      })
    }

    const mappedBranchesNetKwd = r3(
      ACTIVE_BRANCH_IDS.reduce((s, lid) => s + byBranch[lid].netKwd, 0),
    )
    const mappedBranchesOrders = ACTIVE_BRANCH_IDS.reduce(
      (s, lid) => s + byBranch[lid].orders,
      0,
    )
    const companyNetKwd = r3(mappedBranchesNetKwd + unattributedSalesKwd)
    const companyOrders = mappedBranchesOrders + unattributedOrders
    const totalBrandNet = ACTIVE_BRAND_IDS.reduce((s, bid) => s + byBrand[bid].netKwd, 0)

    for (const bid of ACTIVE_BRAND_IDS) {
      const b = byBrand[bid]
      b.netKwd = r3(b.netKwd)
      b.qty = r3(b.qty)
      b.discountKwd = r3(b.discountKwd)
      b.avgDiscountPct =
        b.linesCount > 0
          ? Math.round(((brandDiscNumerator.get(bid) ?? 0) / b.linesCount) * 100) / 100
          : 0
      b.orders =
        totalBrandNet > 0 && companyOrders > 0 && b.netKwd > 0
          ? Math.round((b.netKwd / totalBrandNet) * companyOrders)
          : 0
    }

    const brandByBranch: OdooPeriodCube['brandByBranch'] = {}
    for (const [targetKey, tRows] of lineRowsByTarget.entries()) {
      const bMap = Object.fromEntries(
        ACTIVE_BRAND_IDS.map((bid) => [
          bid,
          { netKwd: 0, qty: 0, linesCount: 0, avgDiscountPct: 0, discountKwd: 0 },
        ]),
      ) as OdooPeriodCube['brandByBranch'][string]
      const discNum = new Map<string, number>()
      for (const r of tRows) {
        const pid = m2oId(r.product_id)
        if (pid === null) continue
        const rawLabel = m2oName(r.product_id) ?? ''
        if (isExcludedOdooEntity(rawLabel)) continue
        const meta = productMetaById.get(pid)
        const fallbackBid = resolveBrandHintFromText(rawLabel)
        const bid = (meta?.brandId ?? fallbackBid) as (typeof ACTIVE_BRAND_IDS)[number] | null
        if (!bid || !(ACTIVE_BRAND_IDS as readonly string[]).includes(bid)) continue
        const net = Math.max(0, Number(r.price_subtotal) || 0)
        const qty = Math.max(0, Number(r.qty) || 0)
        const cnt = Math.max(0, Math.round(Number(r.__count) || 0))
        const avgDisc = Math.max(0, Number(r.discount) || 0)
        const discPctClamped = Math.min(99.9, avgDisc)
        const approxDiscKwd =
          discPctClamped > 0 && discPctClamped < 99.9 && net > 0
            ? (net * (discPctClamped / 100)) / (1 - discPctClamped / 100)
            : 0
        bMap[bid].netKwd += net
        bMap[bid].qty += qty
        bMap[bid].linesCount += cnt
        bMap[bid].discountKwd += approxDiscKwd
        discNum.set(bid, (discNum.get(bid) ?? 0) + avgDisc * cnt)
      }
      for (const bid of ACTIVE_BRAND_IDS) {
        bMap[bid].netKwd = r3(bMap[bid].netKwd)
        bMap[bid].qty = r3(bMap[bid].qty)
        bMap[bid].discountKwd = r3(bMap[bid].discountKwd)
        bMap[bid].avgDiscountPct =
          bMap[bid].linesCount > 0
            ? Math.round(((discNum.get(bid) ?? 0) / bMap[bid].linesCount) * 100) / 100
            : 0
      }
      brandByBranch[targetKey] = bMap
    }

    const dailySeries = [...dailyTotalsMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({
        day,
        orders: Math.round(v.orders),
        netKwd: r3(v.netKwd),
        unattributedNetKwd: r3(v.unattributedNetKwd),
        unattributedOrders: Math.round(v.unattributedOrders),
      }))

    const dailyByBranch: OdooPeriodCube['dailyByBranch'] = {}
    const dailyUnattributed: OdooPeriodCube['dailyUnattributed'] = {}
    for (const [day, dVal] of dailyTotalsMap.entries()) {
      const byB = dailyLocMap.get(day)
      const entry = {} as Record<(typeof ACTIVE_BRANCH_IDS)[number], { netKwd: number; orders: number }>
      for (const lid of ACTIVE_BRANCH_IDS) {
        const bVal = byB?.get(lid)
        entry[lid] = {
          netKwd: r3(bVal?.netKwd ?? 0),
          orders: Math.round(bVal?.orders ?? 0),
        }
      }
      dailyByBranch[day] = entry
      dailyUnattributed[day] = {
        netKwd: r3(dVal.unattributedNetKwd),
        orders: Math.round(dVal.unattributedOrders),
      }
    }

    const excludedEntitiesKwd = r3(
      Math.max(
        0,
        (Number(decommOrderRows?.[0]?.amount_total) || 0) -
          (Number(decommOrderRows?.[0]?.amount_tax) || 0),
      ),
    )
    const excludedEntitiesOrders = Math.max(0, Math.round(Number(decommOrderRows?.[0]?.__count) || 0))

    const accounting =
      activeAccIds.length > 0
        ? buildLedgerAccountingFromGroups({
            fromIso: dateRange.from,
            toInclusiveIso: dateRange.to,
            accountById: activeAccMap,
            rows: glRows,
          })
        : undefined

    const newestConv = odooUtcToKuwaitIso(latestOrderRows?.[0]?.date_order)
    const freshness = newestConv
      ? computeOdooFreshnessStatus(newestConv.utcIso, Date.now())
      : { isStaleOver24h: false }
    const fetchedAtMs = Date.now()
    const hasNoOrders = companyOrders <= 0 && companyNetKwd <= 0

    const cube: OdooPeriodCube = {
      connected: true,
      sourceMode: 'odoo17-live',
      noData: hasNoOrders,
      ...(hasNoOrders ? { messageAr: 'لا توجد بيانات من Odoo لهذه الفترة' } : {}),
      odooCompanyId: resolvedCompanyId,
      lastSyncAt: formatUtcIsoFromMs(fetchedAtMs),
      isStale24h: freshness.isStaleOver24h,
      dateRange,
      days,
      totals: {
        netSalesKwd: companyNetKwd,
        orders: companyOrders,
        aovKwd: companyOrders > 0 ? r3(companyNetKwd / companyOrders) : 0,
        mappedBranchesNetKwd,
        mappedBranchesOrders,
        unattributedSalesKwd,
        unattributedOrders,
        excludedEntitiesKwd,
        excludedEntitiesOrders,
        totalDiscountKwd: r3(totalDiscountKwd),
        avgDiscountPct:
          totalLinesCountAll > 0
            ? Math.round((weightedDiscNumerator / totalLinesCountAll) * 100) / 100
            : 0,
        discountedLinesCount,
      },
      byBranch,
      unattributed: {
        id: 'unattributed',
        labelAr: UNMAPPED_BUCKET_LABEL_AR,
        labelEn: UNMAPPED_BUCKET_LABEL_EN,
        netKwd: unattributedSalesKwd,
        orders: unattributedOrders,
        aovKwd: unattributedOrders > 0 ? r3(unattributedSalesKwd / unattributedOrders) : 0,
        channels: unattributedChannels,
      },
      byBrand,
      brandByBranch,
      byChannel,
      dailySeries,
      dailyByBranch,
      dailyUnattributed,
      hourlySeries,
      hourlyByBranch,
      topProducts: topProductsRaw.sort((a, b) => b.netKwd - a.netKwd).slice(0, 50),
      ...(accounting ? { accounting } : {}),
    }

    if (periodCubeCache.size >= 32) {
      const oldest = periodCubeCache.keys().next().value
      if (oldest) periodCubeCache.delete(oldest)
    }
    periodCubeCache.set(cacheKey, { fetchedAtMs, cube })
    return cube
  } catch {
    return buildDisconnectedPeriodCube(dateRange)
  }
}

function resolveStockLocationRole(
  rawLabel: string,
  usage: string,
): {
  excluded: boolean
  usage: string
  role: 'ck' | 'branch' | 'supplier' | 'customer' | 'scrap' | 'other'
  branchId: (typeof ACTIVE_BRANCH_IDS)[number] | null
} {
  const text = (rawLabel || '').trim()
  if (isDecommissionedWarehouseRecord(text)) {
    return { excluded: true, usage, role: 'other', branchId: null }
  }
  if (usage === 'supplier') {
    return { excluded: false, usage, role: 'supplier', branchId: null }
  }
  if (usage === 'customer') {
    return { excluded: false, usage, role: 'customer', branchId: null }
  }
  const lower = text.toLowerCase()
  if (usage === 'inventory' || /scrap|waste|spoil|تالف|هدر|إتلاف/.test(lower)) {
    return { excluded: false, usage, role: 'scrap', branchId: null }
  }
  if (usage === 'internal') {
    if (/exb|central\s*kitchen|main\s*warehouse|مطبخ\s*مركزي|مخزن\s*مركزي|المخزن\s*الرئيسي/.test(lower)) {
      return { excluded: false, usage, role: 'ck', branchId: null }
    }
    const matchedBranch = resolveRestaurantBranchForConfig(-1, text)
    if (matchedBranch) {
      if (matchedBranch === 'ardiya' && /wh|stock|warehouse|مخزن/.test(lower) && !/pos|branch|فرع/.test(lower)) {
        return { excluded: false, usage, role: 'ck', branchId: null }
      }
      return { excluded: false, usage, role: 'branch', branchId: matchedBranch }
    }
    return { excluded: false, usage, role: 'ck', branchId: null }
  }
  return { excluded: false, usage, role: 'other', branchId: null }
}

function buildDisconnectedWarehouseChain(
  dateRange: { from: string; to: string },
  messageAr = 'لا توجد بيانات من Odoo لهذه الفترة',
): OdooLiveWarehouseChainPayload {
  const byBranchOnHand: Record<string, { qty: number; valueKwd: number }> = {}
  for (const lid of ACTIVE_BRANCH_IDS) {
    byBranchOnHand[lid] = { qty: 0, valueKwd: 0 }
  }
  return {
    connected: false,
    sourceMode: 'disconnected',
    noData: true,
    messageAr,
    odooCompanyId: null,
    lastSyncAt: null,
    isStale24h: false,
    dateRange,
    quantHasValueField: false,
    totals: {
      currentOnHandQty: 0,
      currentOnHandValueKwd: 0,
      ckOnHandValueKwd: 0,
      branchesOnHandValueKwd: 0,
      inboundSupplierKwd: 0,
      ckToBranchTransferKwd: 0,
      posConsumptionKwd: 0,
      scrapKwd: 0,
      scrapPctOfConsumption: 0,
      doneMovesCount: 0,
      scrapOrdersCount: 0,
      quantsCount: 0,
    },
    byBranchOnHand,
    dailyMoves: [],
    products: [],
    scraps: [],
  }
}

/**
 * Live Odoo 17 inventory & waste query across `stock.move` (`state='done'`),
 * `stock.scrap` (`state='done'`), and `stock.quant` (`location_id.usage='internal'` with safe `value` field check).
 */
export async function fetchLiveOdooWarehouseChain(
  rawFromIso?: string | null,
  rawToInclusiveIso?: string | null,
  referenceNowMs = Date.now(),
): Promise<OdooLiveWarehouseChainPayload> {
  assertServerRuntime()
  const isoRe = /^\d{4}-\d{2}-\d{2}$/
  const todayIso = getKuwaitTodayIso(referenceNowMs)
  const defaultFrom = shiftIsoDate(todayIso, -29)
  const f = rawFromIso && isoRe.test(rawFromIso) ? rawFromIso : defaultFrom
  const t = rawToInclusiveIso && isoRe.test(rawToInclusiveIso) ? rawToInclusiveIso : todayIso
  const clamped = clampPeriodToKuwaitToday(
    { from: f <= t ? f : t, to: f <= t ? t : f },
    referenceNowMs,
  )
  const dateRange = { from: clamped.from, to: clamped.to }

  if (!isOdooLiveEnvConfigured()) {
    return buildDisconnectedWarehouseChain(dateRange)
  }

  const cacheKey = `${dateRange.from}..${dateRange.to}`
  const cached = warehouseChainCache.get(cacheKey)
  if (cached && referenceNowMs - cached.fetchedAtMs < LIVE_SNAPSHOT_TTL_MS) {
    return cached.payload
  }

  try {
    const uid = await authenticateOdoo()
    const bounds = kuwaitDateBoundsToOdooUtc(dateRange.from, dateRange.to)

    const [userCompanyRows, locationsRaw, quantFieldsMeta, moveFieldsMeta, scrapFieldsMeta, posCategories] =
      await Promise.all([
        safeSubQuery(
          () =>
            executeOdooKw<{ id: number; company_id?: M2O }[]>(
              'res.users',
              'read',
              [[uid], ['id', 'company_id']],
            ),
          [],
        ),
        executeOdooKw<{ id: number; name: string; complete_name?: string; usage: string; company_id?: M2O }[]>(
          'stock.location',
          'search_read',
          [[['active', 'in', [true, false]]]],
          {
            fields: ['id', 'name', 'complete_name', 'usage', 'company_id'],
            context: { active_test: false },
          },
        ),
        safeSubQuery(
          () =>
            executeOdooKw<Record<string, unknown>>(
              'stock.quant',
              'fields_get',
              [['quantity', 'value', 'product_id', 'location_id', 'company_id']],
              { attributes: ['type'] },
            ),
          {},
        ),
        safeSubQuery(
          () =>
            executeOdooKw<Record<string, unknown>>(
              'stock.move',
              'fields_get',
              [['quantity', 'product_uom_qty', 'date', 'state', 'company_id']],
              { attributes: ['type'] },
            ),
          {},
        ),
        safeSubQuery(
          () =>
            executeOdooKw<Record<string, unknown>>(
              'stock.scrap',
              'fields_get',
              [['date_done', 'create_date', 'scrap_qty', 'product_id', 'product_uom_id', 'location_id', 'name', 'state', 'company_id']],
              { attributes: ['type'] },
            ),
          {},
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

    const resolvedCompanyId = m2oId(userCompanyRows?.[0]?.company_id) ?? null
    const companyDomain: unknown[][] =
      resolvedCompanyId !== null ? [['company_id', '=', resolvedCompanyId]] : []

    const catById = new Map(posCategories.map((c) => [c.id, c]))
    const excludedPosCatIds = new Set<number>()
    for (const c of posCategories) {
      let cur: { id: number; name: string; parent_id: M2O } | undefined = c
      let guard = 0
      let root: { id: number; name: string } = { id: c.id, name: c.name }
      while (cur && cur.parent_id && guard++ < 12) {
        const pid = m2oId(cur.parent_id)
        if (pid === null || !catById.has(pid)) break
        cur = catById.get(pid)
        if (cur) root = { id: cur.id, name: cur.name }
      }
      if (
        c.id === 150 ||
        root.id === 150 ||
        isExcludedOdooEntity(c.name) ||
        isExcludedOdooEntity(root.name)
      ) {
        excludedPosCatIds.add(c.id)
      }
    }

    const locationMeta = new Map<
      number,
      ReturnType<typeof resolveStockLocationRole> & { label: string }
    >()
    const excludedLocationIds: number[] = []
    for (const loc of locationsRaw) {
      const label = (loc.complete_name || loc.name || `Location #${loc.id}`).trim()
      const meta = resolveStockLocationRole(label, loc.usage || 'other')
      locationMeta.set(loc.id, { ...meta, label })
      if (meta.excluded) excludedLocationIds.push(loc.id)
    }

    const quantHasValueField = Boolean(quantFieldsMeta && 'value' in quantFieldsMeta)
    const moveQtyField =
      moveFieldsMeta && 'quantity' in moveFieldsMeta ? 'quantity' : 'product_uom_qty'
    const scrapDateField =
      scrapFieldsMeta && 'date_done' in scrapFieldsMeta ? 'date_done' : 'create_date'
    const scrapHasUomField = Boolean(scrapFieldsMeta && 'product_uom_id' in scrapFieldsMeta)

    const moveDomain: unknown[][] = [
      ...companyDomain,
      ['state', '=', 'done'],
      ['date', '>=', bounds.fromUtc],
      ['date', '<', bounds.toExclusiveUtc],
      ...(excludedLocationIds.length > 0
        ? [
            ['location_id', 'not in', excludedLocationIds],
            ['location_dest_id', 'not in', excludedLocationIds],
          ]
        : []),
    ]

    const scrapDomain: unknown[][] = [
      ...companyDomain,
      ['state', '=', 'done'],
      [scrapDateField, '>=', bounds.fromUtc],
      [scrapDateField, '<', bounds.toExclusiveUtc],
      ...(excludedLocationIds.length > 0 ? [['location_id', 'not in', excludedLocationIds]] : []),
    ]

    const quantDomain: unknown[][] = [
      ...companyDomain,
      ['location_id.usage', '=', 'internal'],
      ...(excludedLocationIds.length > 0 ? [['location_id', 'not in', excludedLocationIds]] : []),
    ]

    const [quantGroups, moveByProductGroups, moveByDayGroups, scrapRows] = await Promise.all([
      executeOdooKw<
        {
          product_id: M2O
          location_id: M2O
          quantity?: number
          value?: number
          __count?: number
        }[]
      >(
        'stock.quant',
        'read_group',
        [
          quantDomain,
          quantHasValueField ? ['quantity:sum', 'value:sum'] : ['quantity:sum'],
          ['product_id', 'location_id'],
        ],
        { lazy: false },
      ).catch(() =>
        executeOdooKw<
          {
            product_id: M2O
            location_id: M2O
            quantity?: number
            __count?: number
          }[]
        >('stock.quant', 'read_group', [quantDomain, ['quantity:sum'], ['product_id', 'location_id']], {
          lazy: false,
        }),
      ),
      executeOdooKw<
        {
          location_id: M2O
          location_dest_id: M2O
          product_id: M2O
          quantity?: number
          product_uom_qty?: number
          __count?: number
        }[]
      >(
        'stock.move',
        'read_group',
        [moveDomain, [`${moveQtyField}:sum`], ['location_id', 'location_dest_id', 'product_id']],
        { lazy: false },
      ),
      executeOdooKw<
        {
          location_id: M2O
          location_dest_id: M2O
          product_id: M2O
          quantity?: number
          product_uom_qty?: number
          __count?: number
          __range?: { 'date:day'?: { from?: string; to?: string } }
        }[]
      >(
        'stock.move',
        'read_group',
        [
          moveDomain,
          [`${moveQtyField}:sum`],
          ['location_id', 'location_dest_id', 'product_id', 'date:day'],
        ],
        { lazy: false, context: { tz: 'Asia/Kuwait' } },
      ),
      safeSubQuery(
        () =>
          executeOdooKw<
            {
              id: number
              name?: string
              date_done?: string | false
              create_date?: string | false
              product_id: M2O
              product_uom_id?: M2O
              location_id: M2O
              scrap_qty?: number
            }[]
          >('stock.scrap', 'search_read', [scrapDomain], {
            fields: [
              'id',
              'name',
              scrapDateField,
              'product_id',
              ...(scrapHasUomField ? ['product_uom_id'] : []),
              'location_id',
              'scrap_qty',
            ],
            order: `${scrapDateField} desc`,
            limit: 500,
          }),
        [],
      ),
    ])

    const allProdIds = [
      ...new Set(
        [
          ...quantGroups.map((q) => m2oId(q.product_id)),
          ...moveByProductGroups.map((m) => m2oId(m.product_id)),
          ...scrapRows.map((s) => m2oId(s.product_id)),
        ].filter((x): x is number => x !== null),
      ),
    ]

    const prodRecords =
      allProdIds.length > 0
        ? await safeSubQuery(
            () =>
              executeOdooKw<
                {
                  id: number
                  name?: string
                  default_code?: string | false
                  standard_price?: number
                  categ_id?: M2O
                  pos_categ_id?: M2O
                  uom_id?: M2O
                }[]
              >(
                'product.product',
                'read',
                [
                  allProdIds,
                  [
                    'id',
                    'name',
                    'default_code',
                    'standard_price',
                    'categ_id',
                    'pos_categ_id',
                    'uom_id',
                  ],
                ],
              ),
            [],
          )
        : []

    const prodInfoById = new Map<
      number,
      {
        name: string
        skuCode: string
        unitCostKwd: number
        categoryName: string
        uomName: string
        excluded: boolean
      }
    >()
    for (const p of prodRecords) {
      const posCatId = m2oId(p.pos_categ_id)
      const nm = (p.name || `Product #${p.id}`).trim()
      const catNm = m2oName(p.categ_id) ?? 'General'
      const excluded =
        (posCatId !== null && excludedPosCatIds.has(posCatId)) ||
        isExcludedOdooEntity(nm) ||
        isExcludedOdooEntity(catNm)
      prodInfoById.set(p.id, {
        name: nm,
        skuCode: typeof p.default_code === 'string' && p.default_code.trim() ? p.default_code.trim() : `ODOO-${p.id}`,
        unitCostKwd: Math.max(0, Number(p.standard_price) || 0),
        categoryName: catNm,
        uomName: m2oName(p.uom_id) ?? 'Unit',
        excluded,
      })
    }

    const productAgg = new Map<number, OdooLiveWarehouseProductRow>()
    const ensureProdRow = (pid: number, fallbackLabel: string): OdooLiveWarehouseProductRow | null => {
      const meta = prodInfoById.get(pid)
      if (meta?.excluded || isExcludedOdooEntity(fallbackLabel)) return null
      let row = productAgg.get(pid)
      if (!row) {
        row = {
          productId: pid,
          skuCode: meta?.skuCode ?? `ODOO-${pid}`,
          name: meta?.name ?? (fallbackLabel || `Product #${pid}`),
          categoryName: meta?.categoryName ?? 'General',
          uomName: meta?.uomName ?? 'Unit',
          unitCostKwd: r3(meta?.unitCostKwd ?? 0),
          onHandQty: 0,
          onHandValueKwd: 0,
          inboundQty: 0,
          inboundValueKwd: 0,
          transferQty: 0,
          transferValueKwd: 0,
          consumedQty: 0,
          consumedValueKwd: 0,
          scrapQty: 0,
          scrapValueKwd: 0,
        }
        productAgg.set(pid, row)
      }
      return row
    }

    let currentOnHandQty = 0
    let currentOnHandValueKwd = 0
    let ckOnHandValueKwd = 0
    let branchesOnHandValueKwd = 0
    let quantsCount = 0
    const byBranchOnHand: Record<string, { qty: number; valueKwd: number }> = {}
    for (const lid of ACTIVE_BRANCH_IDS) {
      byBranchOnHand[lid] = { qty: 0, valueKwd: 0 }
    }

    for (const q of quantGroups) {
      const pid = m2oId(q.product_id)
      const locId = m2oId(q.location_id)
      if (pid === null || locId === null) continue
      const loc = locationMeta.get(locId)
      if (loc?.excluded) continue
      const pRow = ensureProdRow(pid, m2oName(q.product_id) ?? '')
      if (!pRow) continue

      const qty = Number(q.quantity) || 0
      const val =
        quantHasValueField && typeof (q as { value?: number }).value === 'number'
          ? Number((q as { value?: number }).value) || 0
          : qty * pRow.unitCostKwd
      quantsCount += Math.max(0, Number(q.__count) || 0)
      currentOnHandQty += qty
      currentOnHandValueKwd += val
      pRow.onHandQty += qty
      pRow.onHandValueKwd += val

      if (loc?.role === 'branch' && loc.branchId) {
        branchesOnHandValueKwd += val
        byBranchOnHand[loc.branchId].qty = r3(byBranchOnHand[loc.branchId].qty + qty)
        byBranchOnHand[loc.branchId].valueKwd = r3(byBranchOnHand[loc.branchId].valueKwd + val)
      } else {
        ckOnHandValueKwd += val
      }
    }

    const classifyMoveFlow = (srcLocId: number | null, dstLocId: number | null) => {
      const src = srcLocId !== null ? locationMeta.get(srcLocId) : undefined
      const dst = dstLocId !== null ? locationMeta.get(dstLocId) : undefined
      if (src?.excluded || dst?.excluded) return { kind: 'excluded' as const, branchId: null }
      if (src?.role === 'supplier' && (dst?.role === 'ck' || dst?.role === 'branch')) {
        return { kind: 'inbound' as const, branchId: dst.branchId }
      }
      if (src?.role === 'ck' && dst?.role === 'branch') {
        return { kind: 'transfer' as const, branchId: dst.branchId }
      }
      if ((src?.role === 'branch' || src?.role === 'ck') && dst?.role === 'customer') {
        return { kind: 'consumption' as const, branchId: src.branchId }
      }
      if (dst?.role === 'scrap') {
        return { kind: 'scrap_move' as const, branchId: src?.branchId ?? null }
      }
      return { kind: 'internal_other' as const, branchId: dst?.branchId ?? src?.branchId ?? null }
    }

    let inboundSupplierKwd = 0
    let ckToBranchTransferKwd = 0
    let posConsumptionKwd = 0
    let doneMovesCount = 0

    for (const m of moveByProductGroups) {
      const pid = m2oId(m.product_id)
      const srcId = m2oId(m.location_id)
      const dstId = m2oId(m.location_dest_id)
      if (pid === null) continue
      const flow = classifyMoveFlow(srcId, dstId)
      if (flow.kind === 'excluded') continue
      const pRow = ensureProdRow(pid, m2oName(m.product_id) ?? '')
      if (!pRow) continue

      const rawQty = Number(moveQtyField === 'quantity' ? m.quantity : m.product_uom_qty) || 0
      const qty = Math.max(0, rawQty)
      const valKwd = qty * pRow.unitCostKwd
      doneMovesCount += Math.max(0, Number(m.__count) || 0)

      if (flow.kind === 'inbound') {
        inboundSupplierKwd += valKwd
        pRow.inboundQty += qty
        pRow.inboundValueKwd += valKwd
      } else if (flow.kind === 'transfer') {
        ckToBranchTransferKwd += valKwd
        pRow.transferQty += qty
        pRow.transferValueKwd += valKwd
      } else if (flow.kind === 'consumption') {
        posConsumptionKwd += valKwd
        pRow.consumedQty += qty
        pRow.consumedValueKwd += valKwd
      }
    }

    const dayFlowMap = new Map<string, OdooLiveWarehouseMoveDayRow>()
    const ensureDayRow = (dayIso: string): OdooLiveWarehouseMoveDayRow => {
      let d = dayFlowMap.get(dayIso)
      if (!d) {
        const byBranch: OdooLiveWarehouseMoveDayRow['byBranch'] = {}
        for (const lid of ACTIVE_BRANCH_IDS) {
          byBranch[lid] = {
            receivedFromCkKwd: 0,
            receivedFromCkQty: 0,
            consumedKwd: 0,
            consumedQty: 0,
            scrapKwd: 0,
            scrapQty: 0,
          }
        }
        d = {
          day: dayIso,
          inboundSupplierKwd: 0,
          inboundSupplierQty: 0,
          ckToBranchTransferKwd: 0,
          ckToBranchTransferQty: 0,
          posConsumptionKwd: 0,
          posConsumptionQty: 0,
          scrapKwd: 0,
          scrapQty: 0,
          movesCount: 0,
          byBranch,
        }
        dayFlowMap.set(dayIso, d)
      }
      return d
    }

    for (const md of moveByDayGroups) {
      const pid = m2oId(md.product_id)
      const srcId = m2oId(md.location_id)
      const dstId = m2oId(md.location_dest_id)
      const rawDayUtc = md.__range?.['date:day']?.from
      const conv = rawDayUtc ? odooUtcToKuwaitIso(rawDayUtc) : null
      if (pid === null || !conv) continue
      const flow = classifyMoveFlow(srcId, dstId)
      if (flow.kind === 'excluded') continue
      const pMeta = prodInfoById.get(pid)
      if (pMeta?.excluded) continue

      const qty = Math.max(
        0,
        Number(moveQtyField === 'quantity' ? md.quantity : md.product_uom_qty) || 0,
      )
      const valKwd = qty * (pMeta?.unitCostKwd ?? 0)
      const dRow = ensureDayRow(conv.kuwaitDate)
      dRow.movesCount += Math.max(0, Number(md.__count) || 0)

      if (flow.kind === 'inbound') {
        dRow.inboundSupplierKwd += valKwd
        dRow.inboundSupplierQty += qty
      } else if (flow.kind === 'transfer') {
        dRow.ckToBranchTransferKwd += valKwd
        dRow.ckToBranchTransferQty += qty
        if (flow.branchId && dRow.byBranch[flow.branchId]) {
          dRow.byBranch[flow.branchId].receivedFromCkKwd += valKwd
          dRow.byBranch[flow.branchId].receivedFromCkQty += qty
        }
      } else if (flow.kind === 'consumption') {
        dRow.posConsumptionKwd += valKwd
        dRow.posConsumptionQty += qty
        if (flow.branchId && dRow.byBranch[flow.branchId]) {
          dRow.byBranch[flow.branchId].consumedKwd += valKwd
          dRow.byBranch[flow.branchId].consumedQty += qty
        }
      }
    }

    let scrapKwd = 0
    const scraps: OdooLiveWarehouseScrapRow[] = []
    for (const sr of scrapRows) {
      const pid = m2oId(sr.product_id)
      const locId = m2oId(sr.location_id)
      if (pid === null) continue
      const loc = locId !== null ? locationMeta.get(locId) : undefined
      if (loc?.excluded) continue
      const pRow = ensureProdRow(pid, m2oName(sr.product_id) ?? '')
      if (!pRow) continue

      const rawDate = (scrapDateField === 'date_done' ? sr.date_done : sr.create_date) || ''
      const conv = typeof rawDate === 'string' && rawDate ? odooUtcToKuwaitIso(rawDate) : null
      const dateIso = conv?.kuwaitDate ?? dateRange.to
      const sQty = Math.max(0, Number(sr.scrap_qty) || 0)
      const sVal = r3(sQty * pRow.unitCostKwd)

      scrapKwd += sVal
      pRow.scrapQty += sQty
      pRow.scrapValueKwd += sVal

      const dRow = ensureDayRow(dateIso)
      dRow.scrapKwd += sVal
      dRow.scrapQty += sQty
      if (loc?.branchId && dRow.byBranch[loc.branchId]) {
        dRow.byBranch[loc.branchId].scrapKwd += sVal
        dRow.byBranch[loc.branchId].scrapQty += sQty
      }

      scraps.push({
        id: sr.id,
        name: (sr.name || `SP/${sr.id}`).trim(),
        dateIso,
        productId: pid,
        productName: pRow.name,
        uomName: m2oName(sr.product_uom_id) ?? pRow.uomName,
        locationName: loc?.label ?? (m2oName(sr.location_id) ?? 'Internal'),
        branchId: loc?.branchId ?? null,
        scrapQty: r3(sQty),
        unitCostKwd: pRow.unitCostKwd,
        scrapValueKwd: sVal,
      })
    }

    const dailyMoves = [...dayFlowMap.values()]
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((d) => {
        const roundedByBranch: OdooLiveWarehouseMoveDayRow['byBranch'] = {}
        for (const lid of ACTIVE_BRANCH_IDS) {
          const b = d.byBranch[lid]
          roundedByBranch[lid] = {
            receivedFromCkKwd: r3(b?.receivedFromCkKwd ?? 0),
            receivedFromCkQty: r3(b?.receivedFromCkQty ?? 0),
            consumedKwd: r3(b?.consumedKwd ?? 0),
            consumedQty: r3(b?.consumedQty ?? 0),
            scrapKwd: r3(b?.scrapKwd ?? 0),
            scrapQty: r3(b?.scrapQty ?? 0),
          }
        }
        return {
          day: d.day,
          inboundSupplierKwd: r3(d.inboundSupplierKwd),
          inboundSupplierQty: r3(d.inboundSupplierQty),
          ckToBranchTransferKwd: r3(d.ckToBranchTransferKwd),
          ckToBranchTransferQty: r3(d.ckToBranchTransferQty),
          posConsumptionKwd: r3(d.posConsumptionKwd),
          posConsumptionQty: r3(d.posConsumptionQty),
          scrapKwd: r3(d.scrapKwd),
          scrapQty: r3(d.scrapQty),
          movesCount: d.movesCount,
          byBranch: roundedByBranch,
        }
      })

    const products = [...productAgg.values()]
      .map((p) => ({
        ...p,
        onHandQty: r3(p.onHandQty),
        onHandValueKwd: r3(p.onHandValueKwd),
        inboundQty: r3(p.inboundQty),
        inboundValueKwd: r3(p.inboundValueKwd),
        transferQty: r3(p.transferQty),
        transferValueKwd: r3(p.transferValueKwd),
        consumedQty: r3(p.consumedQty),
        consumedValueKwd: r3(p.consumedValueKwd),
        scrapQty: r3(p.scrapQty),
        scrapValueKwd: r3(p.scrapValueKwd),
      }))
      .sort(
        (a, b) =>
          b.consumedValueKwd + b.onHandValueKwd + b.scrapValueKwd -
          (a.consumedValueKwd + a.onHandValueKwd + a.scrapValueKwd),
      )

    const fetchedAtMs = Date.now()
    const hasNoData = doneMovesCount <= 0 && quantsCount <= 0 && scraps.length <= 0
    const payload: OdooLiveWarehouseChainPayload = {
      connected: true,
      sourceMode: 'odoo17-live',
      noData: hasNoData,
      ...(hasNoData ? { messageAr: 'لا توجد بيانات من Odoo لهذه الفترة' } : {}),
      odooCompanyId: resolvedCompanyId,
      lastSyncAt: formatUtcIsoFromMs(fetchedAtMs),
      isStale24h: false,
      dateRange,
      quantHasValueField,
      totals: {
        currentOnHandQty: r3(currentOnHandQty),
        currentOnHandValueKwd: r3(currentOnHandValueKwd),
        ckOnHandValueKwd: r3(ckOnHandValueKwd),
        branchesOnHandValueKwd: r3(branchesOnHandValueKwd),
        inboundSupplierKwd: r3(inboundSupplierKwd),
        ckToBranchTransferKwd: r3(ckToBranchTransferKwd),
        posConsumptionKwd: r3(posConsumptionKwd),
        scrapKwd: r3(scrapKwd),
        scrapPctOfConsumption: posConsumptionKwd > 0 ? pct1(scrapKwd, posConsumptionKwd) : 0,
        doneMovesCount,
        scrapOrdersCount: scraps.length,
        quantsCount,
      },
      byBranchOnHand,
      dailyMoves,
      products: products.slice(0, 120),
      scraps,
    }

    if (warehouseChainCache.size >= 24) {
      const oldest = warehouseChainCache.keys().next().value
      if (oldest) warehouseChainCache.delete(oldest)
    }
    warehouseChainCache.set(cacheKey, { fetchedAtMs, payload })
    return payload
  } catch {
    return buildDisconnectedWarehouseChain(dateRange)
  }
}

function buildDisconnectedPurchaseSummary(
  dateRange: { from: string; to: string },
  messageAr = 'لا توجد بيانات من Odoo لهذه الفترة',
): OdooLivePurchaseSummary {
  return {
    connected: false,
    sourceMode: 'disconnected',
    noData: true,
    messageAr,
    odooCompanyId: null,
    lastSyncAt: null,
    isStale24h: false,
    dateRange,
    totals: {
      ordersCount: 0,
      linesCount: 0,
      vendorsCount: 0,
      productsCount: 0,
      totalUntaxedKwd: 0,
      totalTaxKwd: 0,
      totalAmountKwd: 0,
    },
    byVendor: [],
    byProduct: [],
  }
}

/**
 * Shared live Odoo 17 helper querying `purchase.order` & `purchase.order.line` (`state in ['purchase','done']`)
 * by period `[fromKwIso, toKwIso]`, vendor (`partnerId`), and item (`productId`) for Governance, Supplier Costs, and Feryal.
 */
export async function fetchLiveOdooPurchaseOrders(
  rawFromIso?: string | null,
  rawToInclusiveIso?: string | null,
  options?: {
    partnerId?: number
    productId?: number
    referenceNowMs?: number
  },
): Promise<OdooLivePurchaseSummary> {
  assertServerRuntime()
  const referenceNowMs = options?.referenceNowMs ?? Date.now()
  const isoRe = /^\d{4}-\d{2}-\d{2}$/
  const todayIso = getKuwaitTodayIso(referenceNowMs)
  const defaultFrom = shiftIsoDate(todayIso, -29)
  const f = rawFromIso && isoRe.test(rawFromIso) ? rawFromIso : defaultFrom
  const t = rawToInclusiveIso && isoRe.test(rawToInclusiveIso) ? rawToInclusiveIso : todayIso
  const clamped = clampPeriodToKuwaitToday(
    { from: f <= t ? f : t, to: f <= t ? t : f },
    referenceNowMs,
  )
  const dateRange = { from: clamped.from, to: clamped.to }

  if (!isOdooLiveEnvConfigured()) {
    return buildDisconnectedPurchaseSummary(dateRange)
  }

  const cacheKey = `${dateRange.from}..${dateRange.to}:p=${options?.partnerId ?? 'all'}:i=${options?.productId ?? 'all'}`
  const cached = purchaseOrdersCache.get(cacheKey)
  if (cached && referenceNowMs - cached.fetchedAtMs < LIVE_SNAPSHOT_TTL_MS) {
    return cached.summary
  }

  try {
    const uid = await authenticateOdoo()
    const bounds = kuwaitDateBoundsToOdooUtc(dateRange.from, dateRange.to)

    const userCompanyRows = await safeSubQuery(
      () =>
        executeOdooKw<{ id: number; company_id?: M2O }[]>(
          'res.users',
          'read',
          [[uid], ['id', 'company_id']],
        ),
      [],
    )
    const resolvedCompanyId = m2oId(userCompanyRows?.[0]?.company_id) ?? null
    const companyDomain: unknown[][] =
      resolvedCompanyId !== null ? [['company_id', '=', resolvedCompanyId]] : []

    const orderDomain: unknown[][] = [
      ...companyDomain,
      ['state', 'in', ['purchase', 'done']],
      ['date_order', '>=', bounds.fromUtc],
      ['date_order', '<', bounds.toExclusiveUtc],
      ...(typeof options?.partnerId === 'number' ? [['partner_id', '=', options.partnerId]] : []),
    ]
    const lineDomain: unknown[][] = [
      ...companyDomain,
      ['order_id.state', 'in', ['purchase', 'done']],
      ['order_id.date_order', '>=', bounds.fromUtc],
      ['order_id.date_order', '<', bounds.toExclusiveUtc],
      ...(typeof options?.partnerId === 'number' ? [['partner_id', '=', options.partnerId]] : []),
      ...(typeof options?.productId === 'number' ? [['product_id', '=', options.productId]] : []),
    ]

    const [vendorGroups, recentOrders, poLines] = await Promise.all([
      executeOdooKw<
        {
          partner_id: M2O
          amount_untaxed?: number
          amount_tax?: number
          amount_total?: number
          __count?: number
        }[]
      >(
        'purchase.order',
        'read_group',
        [
          orderDomain,
          ['amount_untaxed:sum', 'amount_tax:sum', 'amount_total:sum'],
          ['partner_id'],
        ],
        { lazy: false },
      ),
      safeSubQuery(
        () =>
          executeOdooKw<{ id: number; partner_id: M2O; date_order?: string }[]>(
            'purchase.order',
            'search_read',
            [orderDomain],
            { fields: ['id', 'partner_id', 'date_order'], order: 'date_order desc', limit: 300 },
          ),
        [],
      ),
      executeOdooKw<
        {
          id: number
          order_id: M2O
          partner_id: M2O
          product_id: M2O
          product_uom?: M2O
          product_qty?: number
          price_unit?: number
          price_subtotal?: number
        }[]
      >('purchase.order.line', 'search_read', [lineDomain], {
        fields: [
          'id',
          'order_id',
          'partner_id',
          'product_id',
          'product_uom',
          'product_qty',
          'price_unit',
          'price_subtotal',
        ],
        order: 'id desc',
        limit: 2000,
      }),
    ])

    const latestOrderByVendor = new Map<number, string>()
    for (const ro of recentOrders) {
      const vId = m2oId(ro.partner_id)
      if (vId === null || latestOrderByVendor.has(vId)) continue
      const conv = ro.date_order ? odooUtcToKuwaitIso(ro.date_order) : null
      if (conv) latestOrderByVendor.set(vId, conv.kuwaitDate)
    }

    const linesCountByVendor = new Map<number, number>()
    const productStatsMap = new Map<
      number,
      {
        productId: number
        productName: string
        uomName: string
        linesCount: number
        vendors: Set<number>
        totalQty: number
        totalSubtotalKwd: number
        minUnitPriceKwd: number
        maxUnitPriceKwd: number
        latestUnitPriceKwd: number | null
      }
    >()

    let activeLinesCount = 0
    for (const ln of poLines) {
      const pName = m2oName(ln.product_id) ?? ''
      const vName = m2oName(ln.partner_id) ?? ''
      if (isDecommissionedWarehouseRecord(`${pName} ${vName}`) || isExcludedOdooEntity(pName)) {
        continue
      }
      const vId = m2oId(ln.partner_id)
      const pId = m2oId(ln.product_id)
      if (vId !== null) {
        linesCountByVendor.set(vId, (linesCountByVendor.get(vId) ?? 0) + 1)
      }
      if (pId === null) continue

      const qty = Math.max(0, Number(ln.product_qty) || 0)
      const unitPrice = Math.max(0, Number(ln.price_unit) || 0)
      const sub = Math.max(0, Number(ln.price_subtotal) || 0)
      activeLinesCount += 1

      let st = productStatsMap.get(pId)
      if (!st) {
        st = {
          productId: pId,
          productName: pName || `Product #${pId}`,
          uomName: m2oName(ln.product_uom) ?? 'Unit',
          linesCount: 0,
          vendors: new Set(),
          totalQty: 0,
          totalSubtotalKwd: 0,
          minUnitPriceKwd: unitPrice > 0 ? unitPrice : Number.POSITIVE_INFINITY,
          maxUnitPriceKwd: unitPrice,
          latestUnitPriceKwd: unitPrice > 0 ? unitPrice : null,
        }
        productStatsMap.set(pId, st)
      }
      st.linesCount += 1
      if (vId !== null) st.vendors.add(vId)
      st.totalQty += qty
      st.totalSubtotalKwd += sub
      if (unitPrice > 0) {
        if (unitPrice < st.minUnitPriceKwd) st.minUnitPriceKwd = unitPrice
        if (unitPrice > st.maxUnitPriceKwd) st.maxUnitPriceKwd = unitPrice
        if (st.latestUnitPriceKwd === null) st.latestUnitPriceKwd = unitPrice
      }
    }

    const byVendor: OdooLivePurchaseVendorRow[] = []
    let totalOrdersCount = 0
    let totalUntaxedKwd = 0
    let totalTaxKwd = 0
    let totalAmountKwd = 0

    for (const vg of vendorGroups) {
      const vId = m2oId(vg.partner_id)
      const vName = (m2oName(vg.partner_id) ?? '').trim()
      if (vId === null || isDecommissionedWarehouseRecord(vName) || isExcludedOdooEntity(vName)) {
        continue
      }
      const ordCnt = Math.max(0, Math.round(Number(vg.__count) || 0))
      const untaxed = Math.max(0, Number(vg.amount_untaxed) || 0)
      const tax = Math.max(0, Number(vg.amount_tax) || 0)
      const tot = Math.max(0, Number(vg.amount_total) || 0)

      totalOrdersCount += ordCnt
      totalUntaxedKwd += untaxed
      totalTaxKwd += tax
      totalAmountKwd += tot

      byVendor.push({
        partnerId: vId,
        vendorName: vName || `Vendor #${vId}`,
        ordersCount: ordCnt,
        linesCount: linesCountByVendor.get(vId) ?? 0,
        totalUntaxedKwd: r3(untaxed),
        totalTaxKwd: r3(tax),
        totalAmountKwd: r3(tot),
        latestOrderDate: latestOrderByVendor.get(vId) ?? null,
      })
    }
    byVendor.sort((a, b) => b.totalAmountKwd - a.totalAmountKwd)

    const byProduct: OdooLivePurchaseProductRow[] = [...productStatsMap.values()]
      .map((p) => {
        const minP = Number.isFinite(p.minUnitPriceKwd) ? p.minUnitPriceKwd : 0
        const maxP = p.maxUnitPriceKwd
        const weightedAvg = p.totalQty > 0 ? p.totalSubtotalKwd / p.totalQty : maxP
        const variancePct = minP > 0 && maxP > minP ? pct1(maxP - minP, minP) : 0
        return {
          productId: p.productId,
          productName: p.productName,
          uomName: p.uomName,
          linesCount: p.linesCount,
          vendorCount: p.vendors.size,
          totalQty: r3(p.totalQty),
          totalSubtotalKwd: r3(p.totalSubtotalKwd),
          weightedAvgUnitPriceKwd: r3(weightedAvg),
          minUnitPriceKwd: r3(minP),
          maxUnitPriceKwd: r3(maxP),
          latestUnitPriceKwd: r3(p.latestUnitPriceKwd ?? weightedAvg),
          priceVariancePct: variancePct,
        }
      })
      .sort((a, b) => b.totalSubtotalKwd - a.totalSubtotalKwd)

    const fetchedAtMs = Date.now()
    const hasNoData = totalOrdersCount <= 0 && activeLinesCount <= 0
    const summary: OdooLivePurchaseSummary = {
      connected: true,
      sourceMode: 'odoo17-live',
      noData: hasNoData,
      ...(hasNoData ? { messageAr: 'لا توجد بيانات من Odoo لهذه الفترة' } : {}),
      odooCompanyId: resolvedCompanyId,
      lastSyncAt: formatUtcIsoFromMs(fetchedAtMs),
      isStale24h: false,
      dateRange,
      totals: {
        ordersCount: totalOrdersCount,
        linesCount: activeLinesCount,
        vendorsCount: byVendor.length,
        productsCount: byProduct.length,
        totalUntaxedKwd: r3(totalUntaxedKwd),
        totalTaxKwd: r3(totalTaxKwd),
        totalAmountKwd: r3(totalAmountKwd),
      },
      byVendor,
      byProduct,
    }

    if (purchaseOrdersCache.size >= 24) {
      const oldest = purchaseOrdersCache.keys().next().value
      if (oldest) purchaseOrdersCache.delete(oldest)
    }
    purchaseOrdersCache.set(cacheKey, { fetchedAtMs, summary })
    return summary
  } catch {
    return buildDisconnectedPurchaseSummary(dateRange)
  }
}

function buildDisconnectedHrSummary(
  messageAr = 'لا توجد بيانات من Odoo عن الموظفين',
): OdooLiveHrSummary {
  return {
    connected: false,
    sourceMode: 'disconnected',
    accessGranted: false,
    noData: true,
    messageAr,
    odooCompanyId: null,
    lastSyncAt: null,
    isStale24h: false,
    totals: {
      activeEmployeesCount: 0,
      departmentsCount: 0,
      workLocationsCount: 0,
    },
    byDepartment: [],
    byWorkLocation: [],
  }
}

/**
 * Shared live Odoo 17 helper querying `hr.employee` scoped by `company_id`
 * with safe `check_access_rights('read', false)` verification via `executeOdooKw`.
 */
export async function fetchLiveOdooHrSummary(
  referenceNowMs: number = Date.now(),
): Promise<OdooLiveHrSummary> {
  assertServerRuntime()
  if (!isOdooLiveEnvConfigured()) {
    return buildDisconnectedHrSummary()
  }

  if (hrSummaryCache && referenceNowMs - hrSummaryCache.fetchedAtMs < LIVE_SNAPSHOT_TTL_MS) {
    return hrSummaryCache.summary
  }

  try {
    const uid = await authenticateOdoo()
    const userCompanyRows = await safeSubQuery(
      () =>
        executeOdooKw<{ id: number; company_id?: M2O }[]>(
          'res.users',
          'read',
          [[uid], ['id', 'company_id']],
        ),
      [],
    )
    const resolvedCompanyId = m2oId(userCompanyRows?.[0]?.company_id) ?? null

    const hasAccess = await safeSubQuery(
      () =>
        executeOdooKw<boolean>(
          'hr.employee',
          'check_access_rights',
          ['read', false],
        ),
      false,
    )

    if (!hasAccess) {
      const fetchedAtMs = Date.now()
      const summary: OdooLiveHrSummary = {
        connected: true,
        sourceMode: 'odoo17-live',
        accessGranted: false,
        noData: true,
        messageAr: 'لا تتوفر صلاحية قراءة hr.employee لحساب الربط الحالي في Odoo',
        odooCompanyId: resolvedCompanyId,
        lastSyncAt: formatUtcIsoFromMs(fetchedAtMs),
        isStale24h: false,
        totals: {
          activeEmployeesCount: 0,
          departmentsCount: 0,
          workLocationsCount: 0,
        },
        byDepartment: [],
        byWorkLocation: [],
      }
      hrSummaryCache = { fetchedAtMs, summary }
      return summary
    }

    const fieldMap = await safeSubQuery(
      () =>
        executeOdooKw<Record<string, unknown>>(
          'hr.employee',
          'fields_get',
          [['active', 'company_id', 'department_id', 'work_location_id']],
          { attributes: ['type'] },
        ),
      {},
    )
    const hasCompanyField = Boolean(fieldMap && 'company_id' in fieldMap)
    const hasActiveField = Boolean(fieldMap && 'active' in fieldMap)
    const hasDeptField = Boolean(fieldMap && 'department_id' in fieldMap)
    const hasLocField = Boolean(fieldMap && 'work_location_id' in fieldMap)

    const domain: unknown[][] = [
      ...(hasCompanyField && resolvedCompanyId !== null
        ? [['company_id', '=', resolvedCompanyId]]
        : []),
      ...(hasActiveField ? [['active', '=', true]] : []),
    ]

    const fieldsToRead = [
      'id',
      'name',
      ...(hasDeptField ? ['department_id'] : []),
      ...(hasLocField ? ['work_location_id'] : []),
    ]

    const rows = await executeOdooKw<
      {
        id: number
        name?: string
        department_id?: M2O
        work_location_id?: M2O
      }[]
    >('hr.employee', 'search_read', [domain], {
      fields: fieldsToRead,
      order: 'id asc',
      limit: 2000,
    })

    const deptAgg = new Map<string, OdooLiveHrDepartmentRow>()
    const locAgg = new Map<string, OdooLiveHrLocationRow>()
    let activeEmployeesCount = 0

    for (const emp of rows) {
      const empName = (emp.name || '').trim()
      const deptNameRaw = (m2oName(emp.department_id) ?? '').trim()
      const locNameRaw = (m2oName(emp.work_location_id) ?? '').trim()
      const combined = `${empName} ${deptNameRaw} ${locNameRaw}`
      if (isExcludedOdooEntity(combined) || isDecommissionedWarehouseRecord(combined)) {
        continue
      }
      activeEmployeesCount += 1

      const dId = m2oId(emp.department_id)
      const dName = deptNameRaw || 'بدون قسم محدد'
      const dKey = dId !== null ? `id:${dId}` : `nm:${dName}`
      const existingDept = deptAgg.get(dKey)
      if (existingDept) {
        existingDept.employeesCount += 1
      } else {
        deptAgg.set(dKey, {
          departmentId: dId,
          departmentName: dName,
          employeesCount: 1,
        })
      }

      if (hasLocField) {
        const lId = m2oId(emp.work_location_id)
        const lName = locNameRaw || 'بدون موقع محدد'
        const lKey = lId !== null ? `id:${lId}` : `nm:${lName}`
        const existingLoc = locAgg.get(lKey)
        if (existingLoc) {
          existingLoc.employeesCount += 1
        } else {
          locAgg.set(lKey, {
            locationId: lId,
            locationName: lName,
            employeesCount: 1,
          })
        }
      }
    }

    const byDepartment = [...deptAgg.values()].sort(
      (a, b) => b.employeesCount - a.employeesCount || a.departmentName.localeCompare(b.departmentName),
    )
    const byWorkLocation = [...locAgg.values()].sort(
      (a, b) => b.employeesCount - a.employeesCount || a.locationName.localeCompare(b.locationName),
    )

    const fetchedAtMs = Date.now()
    const hasNoData = activeEmployeesCount <= 0
    const summary: OdooLiveHrSummary = {
      connected: true,
      sourceMode: 'odoo17-live',
      accessGranted: true,
      noData: hasNoData,
      ...(hasNoData ? { messageAr: 'لا توجد سجلات موظفين نشطة في hr.employee' } : {}),
      odooCompanyId: resolvedCompanyId,
      lastSyncAt: formatUtcIsoFromMs(fetchedAtMs),
      isStale24h: false,
      totals: {
        activeEmployeesCount,
        departmentsCount: byDepartment.filter((d) => d.departmentId !== null).length,
        workLocationsCount: byWorkLocation.filter((l) => l.locationId !== null).length,
      },
      byDepartment,
      byWorkLocation,
    }

    hrSummaryCache = { fetchedAtMs, summary }
    return summary
  } catch {
    return buildDisconnectedHrSummary()
  }
}
