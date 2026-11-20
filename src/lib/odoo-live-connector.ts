import 'server-only'
import { CoverageCounter, resolveProductCosts, type CostSource, type WarehouseValuationSummary } from '@/lib/odoo/warehouse-valuation'

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
import { resolveGlClosedThroughDate } from '@/lib/aether/closed-month-policy'
import { errorFields, logger } from '@/lib/logger'
import { classifyPlatformExpenseAccount } from '@/lib/odoo/platform-expense-accounts'
import posRegistry from '@/lib/odoo/pos-registry.json'
import {
  buildReceivablePartnerRows,
  channelOfPaymentMethod,
  computeOdooFreshnessStatus,
  receivablesCustomerSplit,
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
  type OdooUnavailableSectionKey,
} from '@/lib/odoo/live-sync-core'
import {
  ACTIVE_VENTURE_BRANCH_IDS,
  clearLiveDiscoveredPosLedger,
  getAdminPosTerminalBranch,
  hydrateAdminPosTerminalMappings,
  recordLiveDiscoveredPosLedger,
  sanitizePosTerminalDisplayName,
  UNMAPPED_BUCKET_LABEL_AR,
  UNMAPPED_BUCKET_LABEL_EN,
  type ActiveVentureBranchId,
} from '@/lib/odoo-terminal-mappings'
import {
  anchorKuwaitDay,
  companyPosConfigAllowed,
  isQurainPosConfigId,
  isPinnedSchoolCanteenConfigId,
  QURAIN_POS_CONFIG_IDS,
  posOrderNet,
  SCHOOL_CANTEEN_BRANCH_ID,
  EXHIBITION_BRANCH_ID,
  isExhibitionConfigId,
  signedKwd,
} from '@/lib/odoo/company-pos'
import { isNonCompanyCatalogItem } from '@/lib/odoo/non-company-products'
import { buildRegisterReconciliation } from '@/lib/odoo/register-reconciliation'
import type { BrandAllocationResult } from '@/lib/odoo/brand-order-allocation'
import { computeUnifiedReceivableAging, UnverifiedReceivableAccountError } from '@/lib/odoo/receivable-aging'
import {
  buildOpenReceivableClauses,
  isVerifiedReceivableAccountId,
  POS_CLEARING_ACCOUNT_ID,
} from '@/lib/odoo/receivable-domain'
import {
  branchIdForStockLocation,
  isCentralKitchenStockLocation,
  isExcludedStockLocation,
  JAHRA_POS_CONFIG_IDS,
  KITCHEN_SOURCE_POS_CONFIG_IDS,
  STOCK_LOCATION_MAP_TTL_MS,
  classifyWarehouseMove,
  emptyStockRoots,
  kitchenTransfersToCount,
  stockRootsFromRegisterChain,
  type RegisterPickingLink,
  type ResolvedStockRoots,
  type StockLocationBranchId,
} from '@/lib/odoo/stock-location-ids'
import {
  allocateExactBrandRows,
  countOrdersPerBrandWithin,
  startExactBrandRowsRead,
  type ExactBrandRows,
  type OdooExecute,
} from '@/lib/odoo/brand-scope-fetch'
import {
  buildPosOrderUtcDomain,
  posRegisterScopeClauses,
  buildPosPaymentUtcDomain,
  clearYearClosedCache,
  kuwaitDateBoundsToOdooUtc,
  mergeDaySessionPricelistGroups,
  mergeHourGroups,
  mergeProductLineGroups,
  mergeRowsByKey,
  mergeSessionGroups,
  mergeSessionPaymentGroups,
  readClosedYearPlusToday,
  readYearClosedPersistentEntry,
  registerDefaultYearClosedPersistentStore,
  writeYearClosedPersistentEntry,
  YEAR_CLOSED_MAX,
  YEAR_CLOSED_READ_TIMEOUT_MS,
  YEAR_CLOSED_TTL_MS,
  YEAR_PAYMENT_GROUP_BY,
  YEAR_REGISTER_READ_CONCURRENCY,
  foldYearBranchChannels,
  yearClosedWindow,
  yearReadCall,
  type HourGroupRow,
} from '@/lib/odoo/pos-order-query'
import { getDefaultPostgresYearClosedStore } from '@/lib/odoo/closed-year-store'
import {
  clampPeriodToKuwaitToday,
  getKuwaitTodayIso,
  isExcludedOdooEntity,
  isExcludedRecordId,
  sliceDailySeriesToPeriod,
} from '@/lib/aether/period-delta'

if (typeof window !== 'undefined') {
  throw new Error(
    'Security violation: src/lib/odoo-live-connector.ts is strictly server-only and cannot be imported in client components.',
  )
}

export const KUWAIT_OFFSET_MS = 3 * 3600 * 1000
export const ODOO_RPC_TIMEOUT_MS = 8_000
/** stock.quant / stock.move read_group only. Other RPC calls stay on the 8s cap. */
export const STOCK_READ_GROUP_TIMEOUT_MS = 25_000
export const AUTH_UID_TTL_MS = 15 * 60_000
export const LIVE_SNAPSHOT_TTL_MS = 60_000
/** A partial pull may reuse a complete snapshot only while it is still this fresh. */
export const LAST_KNOWN_GOOD_MAX_AGE_MS = 30 * 60_000

export function lastKnownGoodIsFresh(
  snapshot: { fetchedAtMs: number; unavailableSections: readonly string[] } | null | undefined,
  nowMs: number,
): boolean {
  if (!snapshot || snapshot.unavailableSections.length > 0) return false
  return nowMs - snapshot.fetchedAtMs <= LAST_KNOWN_GOOD_MAX_AGE_MS
}
export const MANUAL_SYNC_COOLDOWN_MS = 30_000
const CIRCUIT_BREAKER_THRESHOLD = 2
const CIRCUIT_OPEN_DURATION_MS = 20_000
const MAX_COMPARISON_CACHE_ENTRIES = 32

export const PARTIAL_ODOO_WARNING_AR = 'بعض الأرقام غير متاحة الآن'
export const PARTIAL_ODOO_WARNING_EN = 'Some figures are temporarily unavailable'

export type OdooDiagnosticCode =
  | 'OK_LIVE'
  | 'PARTIAL_LIVE'
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
  SCHOOL_CANTEEN_BRANCH_ID,
  EXHIBITION_BRANCH_ID,
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
  registers: Record<string, { location: string; delivery?: boolean }>
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
  partial: boolean
  unavailableSections: string[]
  warningAr?: string
  warningEn?: string
  messageAr?: string
  messageEn?: string
  summary: OdooLiveSummary | null
  lastSyncAt: string | null
  isStale24h: boolean
  odooCompanyId: number | null
  dateRange: { from: string; to: string }
  unattributedSalesKwd: number | null
  unattributedOrders: number | null
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
  partial: boolean
  unavailableSections: OdooUnavailableSectionKey[]
  latestRecordAt: string
  latestOperationalDate: string
  todayOrdersCount: number
  todaySalesKwd: number
  companyTotals: {
    grossPreExclusionKwd?: number | null
    excludedEntitiesKwd?: number | null
    excludedEntitiesOrders?: number | null
    mappedBranchesNetKwd?: number | null
    netSalesKwd: number
    orders: number
    unmappedTerminalsNetKwd: number
    unmappedTerminalsOrders: number
    reconciliationGapKwd?: number | null
    reconciledExact?: boolean
  }
  buckets: Record<OdooPeriodBucketKey, OdooBucketSummary>
  dailySeries: { day: string; orders: number; netKwd: number }[]
  dailyByBranch?: Record<string, Record<string, { netKwd: number; orders: number }>>
  dailyUnattributed?: Record<string, { netKwd: number; orders: number }>
  hourlySeries: { hour: number; orders: number; netKwd: number }[] | null
  stockTransfers?: OdooStockTransferSummary | null
  aggregatorReceivables?: OdooReceivableClearingSummary | null
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

export interface OdooPeriodCubeBranchCell {
  netKwd: number
  orders: number
  aovKwd: number
  channels: Record<(typeof UI_CHANNEL_KEYS)[number], { netKwd: number; orders: number }>
}

/** Connector-internal: every group (booths included) is always built. */
type CompleteCubeByBranch = Record<(typeof ACTIVE_BRANCH_IDS)[number], OdooPeriodCubeBranchCell>

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
  /** Every group is present on a live cube; `exhibitions` is optional for cubes cached before booths were counted. */
  byBranch: Record<
    Exclude<(typeof ACTIVE_BRANCH_IDS)[number], typeof EXHIBITION_BRANCH_ID>,
    OdooPeriodCubeBranchCell
  > &
    Partial<Record<typeof EXHIBITION_BRANCH_ID, OdooPeriodCubeBranchCell>>
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
      /** Real distinct orders holding the brand; `null` when the count could not be read. */
      orders: number | null
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
  /** Hourly read succeeded (independent of the other sections). `false` → hourly unavailable. */
  hourlyAvailable?: boolean
  /** Per-branch hourly read succeeded. `false` → branch-filtered hourly unavailable. */
  hourlyByBranchAvailable?: boolean
  topProducts: OdooPeriodCubeProductRow[]
  /** All product groups of the period (server-side only; absent on older cached cubes). */
  menuProducts?: OdooPeriodCubeProductRow[]
  accounting?: OdooLedgerAccountingSummary
  posConfigIds?: {
    companyId: number | null
    configIdsByBranch: Record<string, number[]>
    includedConfigIds?: number[]
    excludedConfigIds: number[]
    excludedPosCategoryIds: number[]
  }
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
      receivedFromCkMoves?: number
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
  /** False when Odoo holds no cost for the product (standard price, valuation layer or purchase). */
  costKnown?: boolean
  costSource?: CostSource | null
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
  /** Set when the query failed. Exceptions are never reported as an empty period. */
  fetchStatus?: 'ok' | 'timeout' | 'error' | 'disconnected'
  messageAr?: string
  messageEn?: string
  odooCompanyId: number | null
  lastSyncAt: string | null
  isStale24h: boolean
  dateRange: { from: string; to: string }
  quantHasValueField: boolean
  /** Cost coverage of the KWD figures (absent on payloads cached before valuation coverage). */
  valuation?: WarehouseValuationSummary
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

interface CachedPeriodCubeEntry {
  fetchedAtMs: number
  cachedAtMs: number
  cube: OdooPeriodCube
  closedHistorical: boolean
}

const globalForOdooLiveCaches = globalThis as unknown as {
  __vfOdooPeriodCubeCache?: Map<string, CachedPeriodCubeEntry>
  __vfOdooPeriodCubeInflight?: Map<string, Promise<OdooPeriodCube>>
}

registerDefaultYearClosedPersistentStore(getDefaultPostgresYearClosedStore())

const comparisonRangeCache = new Map<string, CachedComparisonRangeEntry>()
const customBucketCache = new Map<string, { fetchedAtMs: number; bucket: OdooBucketSummary }>()
const periodCubeCache =
  globalForOdooLiveCaches.__vfOdooPeriodCubeCache ??
  (globalForOdooLiveCaches.__vfOdooPeriodCubeCache = new Map<string, CachedPeriodCubeEntry>())
const periodCubeInflight =
  globalForOdooLiveCaches.__vfOdooPeriodCubeInflight ??
  (globalForOdooLiveCaches.__vfOdooPeriodCubeInflight = new Map<string, Promise<OdooPeriodCube>>())
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

export { kuwaitDateBoundsToOdooUtc }

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
  timeoutCapMs = ODOO_RPC_TIMEOUT_MS,
): Promise<T> {
  assertServerRuntime()
  const safeBaseUrl = normalizeOdooBaseUrl(cfg.url)
  const effectiveTimeoutMs = Math.min(
    timeoutCapMs,
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
  options?: { timeoutMs?: number; timeoutCapMs?: number },
): Promise<T> {
  const cfg = readServerOdooConfig()
  if (!cfg) {
    throw new OdooConnectorError(
      'Odoo 17 environment variables are not configured on the server.',
      'ENV_NOT_CONFIGURED',
    )
  }

  const cap = options?.timeoutCapMs ?? ODOO_RPC_TIMEOUT_MS
  const timeoutMs = Math.min(cap, Math.max(1_000, options?.timeoutMs ?? ODOO_RPC_TIMEOUT_MS))
  let uid = await authenticateOdoo({ timeoutMs: Math.min(ODOO_RPC_TIMEOUT_MS, timeoutMs) })

  try {
    return await rawOdooJsonRpc<T>(
      cfg,
      'object',
      'execute_kw',
      [cfg.db, uid, cfg.apiKey, model, method, args, kwargs],
      timeoutMs,
      cap,
    )
  } catch (firstErr) {
    if (firstErr instanceof OdooConnectorError) {
      throw firstErr
    }
    const errText = firstErr instanceof Error ? firstErr.message.toLowerCase() : ''
    if (errText.includes('session') || errText.includes('access denied') || errText.includes('uid')) {
      uid = await authenticateOdoo({ forceReauth: true, timeoutMs: Math.min(ODOO_RPC_TIMEOUT_MS, timeoutMs) })
      return rawOdooJsonRpc<T>(
        cfg,
        'object',
        'execute_kw',
        [cfg.db, uid, cfg.apiKey, model, method, args, kwargs],
        timeoutMs,
        cap,
      )
    }
    throw firstErr
  }
}

function clearOpenPeriodCubesOnly(): void {
  for (const [key, entry] of periodCubeCache.entries()) {
    if (!entry.closedHistorical) {
      periodCubeCache.delete(key)
    }
  }
}

/**
 * Busts the 60-second server-side Odoo live snapshot cache immediately.
 * Closed-year entries (`Jan 1 .. yesterday` and closed historical cubes `toIso < todayKwIso`)
 * stay warm unless `clearClosedYear: true` or `clearLastKnownGood: true` is passed.
 */
export function bustOdooLiveCache(options?: {
  resetCooldown?: boolean
  clearLastKnownGood?: boolean
  clearClosedYear?: boolean
  memoryOnly?: boolean
}): void {
  coreSnapshotCache = null
  inflightCorePull = null
  comparisonRangeCache.clear()
  customBucketCache.clear()
  if (options?.clearClosedYear || options?.clearLastKnownGood) {
    periodCubeCache.clear()
    periodCubeInflight.clear()
    clearYearClosedCache({ memoryOnly: options?.memoryOnly })
  } else {
    clearOpenPeriodCubesOnly()
  }
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
 * Jahra and Heisenberg stay out of inventory, transfers, and POS aggregations.
 * Delivery (Qurain) is a live cashier and is not decommissioned (founder, 2026-11-19).
 */
const EXCLUDED_GL_ACCOUNT_CODES = [
  '10114',
  '10119',
  '101531',
  '10328',
  '40079',
  '40080',
  '40097',
  '9950473',
] as const

/** Account-code exclusion only. A display name never decides this. */
export function isDecommissionedWarehouseRecord(rawText?: string | null): boolean {
  if (!rawText) return false
  const code = /^(\d+)\b/.exec(rawText.trim())?.[1]
  return code != null && (EXCLUDED_GL_ACCOUNT_CODES as readonly string[]).includes(code)
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
  _cfgName: string,
  _extraContext = '',
  options?: { ignoreAdminOverride?: boolean },
): (typeof ACTIVE_BRANCH_IDS)[number] | null {
  if (isExcludedRecordId('pos_config', cfgId) || isQurainPosConfigId(cfgId)) {
    return null
  }
  if (isPinnedSchoolCanteenConfigId(cfgId)) {
    return companyPosConfigAllowed(cfgId, _cfgName, true) ? SCHOOL_CANTEEN_BRANCH_ID : null
  }
  if (isExhibitionConfigId(cfgId)) {
    return companyPosConfigAllowed(cfgId, _cfgName, true) ? EXHIBITION_BRANCH_ID : null
  }
  if (!options?.ignoreAdminOverride) {
    const adminMapped = getAdminPosTerminalBranch(cfgId)
    if (adminMapped) return adminMapped
  }
  const regEntry = REG.registers[String(cfgId)]
  if (!regEntry) return null
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

/** Delivery terminals by pos.config id. The flag is set on the registry row. */
function isDeliveryPosConfigId(cfgId: number | undefined): boolean {
  if (cfgId == null || !Number.isInteger(cfgId)) return false
  return REG.registers[String(cfgId)]?.delivery === true
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

function isDeliveryCommissionGlAccount(code: string, name: string, accountType = 'expense'): boolean {
  return classifyPlatformExpenseAccount(code, name, accountType) === 'platform_commission'
}

function isRentPayrollOrDeprGlAccount(code: string, name: string, accountType: string): boolean {
  if (accountType === 'expense_depreciation') return true
  const c = (code || '').trim()
  if (/^(403|40478|40493|4055|4076)/.test(c)) return true
  return /rental|ايجار|إيجار|salar|رواتب|اجور|أجور|depreciation|اهلاك|إهلاك/i.test(name || '')
}

const GL_LOCK_CACHE_TTL_MS = 15 * 60 * 1000
const glLockCache = new Map<string, { at: number; value: string | null }>()

/**
 * Phase 5 · Item 7: reads Odoo 17 `res.company` lock dates and returns the GL closed-through date.
 * Fail-closed: a read error yields `null` so no month is treated as closed.
 */
async function fetchGlClosedThroughDate(companyId: number | null): Promise<string | null> {
  const key = String(companyId ?? 'default')
  const cached = glLockCache.get(key)
  if (cached && Date.now() - cached.at < GL_LOCK_CACHE_TTL_MS) return cached.value
  let value: string | null = null
  try {
    const rows = await executeOdooKw<{ period_lock_date?: string | false; fiscalyear_lock_date?: string | false }[]>(
      'res.company',
      'search_read',
      [companyId ? [['id', '=', companyId]] : []],
      { fields: ['period_lock_date', 'fiscalyear_lock_date'], limit: 1 },
      { timeoutMs: 8000 },
    )
    const row = rows?.[0]
    value = row ? resolveGlClosedThroughDate(row.period_lock_date, row.fiscalyear_lock_date) : null
  } catch {
    value = null
  }
  glLockCache.set(key, { at: Date.now(), value })
  return value
}

function withGlClosedThrough<T extends OdooLedgerAccountingSummary | null | undefined>(
  acc: T,
  closedThrough: string | null,
): T {
  return acc ? ({ ...acc, glClosedThroughDate: closedThrough } as T) : acc
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
  let platformSubscription = 0
  let thirdPartyDelivery = 0
  const commissionAccounts: NonNullable<OdooLedgerAccountingSummary['commissionAccounts']> = []
  let expense = 0
  let depreciation = 0
  let accrualSignalTotal = 0
  let lineCount = 0
  const revenueAccounts: NonNullable<OdooLedgerAccountingSummary['revenueAccounts']> = []

  for (const r of rows) {
    const accId = m2oId(r.account_id)
    if (accId === null) continue
    const acc = accountById.get(accId)
    if (!acc) continue
    const bal = Number(r.balance) || 0
    const cnt = Math.max(0, Number(r.__count) || 0)
    lineCount += cnt
    if (acc.account_type === 'income' || acc.account_type === 'income_other') {
      const amount = r3(-bal)
      if (acc.account_type === 'income') income += -bal
      else otherIncome += -bal
      if (amount !== 0) {
        revenueAccounts.push({
          code: acc.code,
          name: acc.name,
          accountType: acc.account_type,
          amountKwd: amount,
        })
      }
    } else if (acc.account_type === 'expense_direct_cost') {
      cogs += bal
    } else if (acc.account_type === 'expense') {
      expense += bal
      const expenseClass = classifyPlatformExpenseAccount(acc.code, acc.name, acc.account_type)
      if (expenseClass === 'platform_commission') {
        deliveryCommissions += bal
        deliveryCommissionLinesCount += cnt
        if (bal !== 0) {
          commissionAccounts.push({ code: acc.code, name: acc.name, amountKwd: r3(bal) })
        }
      } else if (expenseClass === 'platform_subscription') {
        platformSubscription += bal
      } else if (expenseClass === 'third_party_delivery') {
        thirdPartyDelivery += bal
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
    revenueAccounts: revenueAccounts.sort((a, b) => Math.abs(b.amountKwd) - Math.abs(a.amountKwd)),
    income: cleanIncome,
    otherIncome: cleanOtherIncome,
    totalRevenue,
    cogs: cleanCogs,
    deliveryCommissions: cleanDeliveryComm,
    deliveryCommissionLinesCount,
    platformSubscriptionKwd: r3(platformSubscription),
    thirdPartyDeliveryKwd: r3(thirdPartyDelivery),
    commissionAccounts: commissionAccounts.sort((a, b) => a.code.localeCompare(b.code)),
    expense: cleanExpense,
    depreciation: cleanDepreciation,
    otherOpexAndDepreciation,
    operatingProfit,
    completeAccrualPosted,
    glIncomplete,
    ...(glIncomplete ? { glWarningAr: 'دفتر الأستاذ بلا بند مصروف لهذه الفترة' } : {}),
    aggregatorCommissionUnposted,
    ...(aggregatorCommissionUnposted
      ? { aggregatorCommissionDisplayAr: 'غير مُرحَّل بعد' }
      : {}),
    ...(!available
      ? {
          unavailableReasonAr: 'دفتر الأستاذ بلا بند مصروف لهذه الفترة',
          unavailableReasonEn: 'No posted General Ledger revenue lines exist for this period.',
        }
      : glIncomplete
        ? {
            unavailableReasonAr: 'دفتر الأستاذ بلا بند مصروف لهذه الفترة',
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
  let labelAr = accountName
  let labelEn = accountName
  if (accountCode === '10501') {
    labelAr = 'ذمم منصة طلبات (10501)'
    labelEn = 'Talabat Receivable (10501)'
  } else if (accountCode === '10502') {
    labelAr = 'تسويات منصة ديليفرو (10502)'
    labelEn = 'Deliveroo Receivable Clearing (10502)'
  } else if (accountCode === '10503') {
    labelAr = 'ذمم منصة كاري (10503)'
    labelEn = 'Cari Receivable (10503)'
  } else if (accountCode === '10504') {
    labelAr = 'ذمم منصة جاهز (10504)'
    labelEn = 'Jahez Receivable (10504)'
  } else if (accountCode === '10505') {
    labelAr = 'ذمم منصة كيتا (10505)'
    labelEn = 'Keeta Receivable (10505)'
  } else if (accountCode === '10507') {
    labelAr = 'تسويات منصة سنونو (10507)'
    labelEn = 'Snoonu Receivable Clearing (10507)'
  } else if (accountCode === '10508') {
    labelAr = 'ذمم الدفع الإلكتروني أونلاين (10508)'
    labelEn = 'Hesabe Online Receivable (10508)'
  } else if (accountCode === '10509') {
    labelAr = 'ذمم روابط الدفع المباشر (10509)'
    labelEn = 'Hesabe Payment Link Receivable (10509)'
  } else if (accountId === POS_CLEARING_ACCOUNT_ID) {
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
    partial: false,
    unavailableSections: [],
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

async function safeSubQuery<T>(
  fn: () => Promise<T>,
  fallback: T,
  onFailure?: { collector: Set<OdooUnavailableSectionKey>; section: OdooUnavailableSectionKey },
): Promise<T> {
  try {
    return await fn()
  } catch {
    onFailure?.collector.add(onFailure.section)
    return fallback
  }
}

/** Tolerance for "brand allocation and company order net describe the same orders" (1 fils). */
const ORDER_NET_MATCH_TOLERANCE_KWD = 0.001

type BucketBrandScope = Pick<
  OdooBucketSummary,
  'byBrand' | 'brandBasis' | 'brandBasisGapKwd' | 'byBrandByLocation' | 'byBrandDaily' | 'unbrandedNetKwd' | 'excludedLineNetKwd'
>

/**
 * Brand figures for one bucket. Uses the exact per-order allocation when it covers the same orders
 * as the company total; otherwise falls back to raw product-line totals, labelled with their gap.
 * Brand order counts come only from real counts; there is no pro-rata estimate.
 */
export function buildBucketBrandScope(input: {
  companyNetKwd: number
  brandRawWeights: ReadonlyMap<string, number>
  brandQtyWeights: ReadonlyMap<string, number>
  brandOrdersMap: ReadonlyMap<string, number | null> | null
  brandAllocation: BrandAllocationResult | null
}): BucketBrandScope {
  const qtyOf = (bid: string) => r3(Math.max(0, input.brandQtyWeights.get(bid) ?? 0))
  const allocation = input.brandAllocation
  const allocationMatches =
    allocation !== null &&
    Math.abs(allocation.orderNetKwd - input.companyNetKwd) <= ORDER_NET_MATCH_TOLERANCE_KWD
  if (allocation && allocationMatches) {
    const byBrand: NonNullable<OdooBucketSummary['byBrand']> = {}
    for (const bid of ACTIVE_BRAND_IDS) {
      const cell = allocation.byBrand[bid]
      byBrand[bid] = { netKwd: r3(cell?.netKwd ?? 0), orders: cell?.orders ?? 0, qty: qtyOf(bid) }
    }
    return {
      byBrand,
      brandBasis: 'order-allocated',
      brandBasisGapKwd: 0,
      byBrandByLocation: allocation.byBrandByLocation,
      byBrandDaily: allocation.byBrandDaily,
      unbrandedNetKwd: r3(allocation.unbrandedNetKwd),
      excludedLineNetKwd: r3(allocation.excludedLineNetKwd),
    }
  }
  const byBrand: NonNullable<OdooBucketSummary['byBrand']> = {}
  for (const bid of ACTIVE_BRAND_IDS) {
    const realOrders = input.brandOrdersMap?.get(bid)
    byBrand[bid] = {
      netKwd: r3(input.brandRawWeights.get(bid) ?? 0),
      orders: typeof realOrders === 'number' ? Math.max(0, Math.round(realOrders)) : null,
      qty: qtyOf(bid),
    }
  }
  const brandLineTotal = ACTIVE_BRAND_IDS.reduce((s, bid) => s + byBrand[bid].netKwd, 0)
  return {
    byBrand,
    brandBasis: 'product-lines',
    brandBasisGapKwd: r3(brandLineTotal - input.companyNetKwd),
    byBrandByLocation: null,
    byBrandDaily: null,
    unbrandedNetKwd: null,
    excludedLineNetKwd: null,
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
  /** Real distinct order counts per brand. Missing → `orders: null` (shown as `—`), never estimated. */
  brandOrdersMap?: ReadonlyMap<string, number | null> | null
  /** Exact per-order brand allocation; when it reconciles to order net it replaces line totals. */
  brandAllocation?: BrandAllocationResult | null
  locUiRawMap: Map<string, Record<string, { netKwd: number; orders: number }>>
  unmappedUiRaw?: Record<string, { netKwd: number; orders: number }>
  /** Per-config nets from the same allowed session groups that built the company total. */
  registerRows?: ReadonlyArray<{ configId: number; configName: string; netKwd: number; orders: number }>
  accounting?: OdooBucketSummary['accounting']
  totalsUnavailable?: boolean
  channelsUnavailable?: boolean
  brandsUnavailable?: boolean
  excludedUnavailable?: boolean
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
    brandAllocation,
    locUiRawMap,
    unmappedUiRaw,
    registerRows,
    accounting,
    totalsUnavailable = false,
    channelsUnavailable = false,
    brandsUnavailable = false,
    excludedUnavailable = false,
  } = params

  const mappedBranchNet = r3(
    ACTIVE_BRANCH_IDS.reduce((acc, lid) => acc + (locNetMap.get(lid) ?? 0), 0),
  )
  const mappedBranchOrders = Math.max(
    0,
    Math.round(
      ACTIVE_BRANCH_IDS.reduce((acc, lid) => acc + Math.max(0, locOrdersMap.get(lid) ?? 0), 0),
    ),
  )

  const unattributedSalesKwd = r3(unmappedNetKwd)
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

  const brandScope = buildBucketBrandScope({
    companyNetKwd: companyNet,
    brandRawWeights,
    brandQtyWeights,
    brandOrdersMap: brandOrdersMap ?? null,
    brandAllocation: brandAllocation ?? null,
  })

  const byLocation: NonNullable<OdooBucketSummary['byLocation']> = {}
  const mappedByLocation: NonNullable<OdooBucketSummary['mappedByLocation']> = {}
  const aggUiChannels: Record<string, { netKwd: number; orders: number }> = Object.fromEntries(
    UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }]),
  )

  for (const lid of ACTIVE_BRANCH_IDS) {
    const locRealNet = r3(locNetMap.get(lid) ?? 0)
    const locRealOrd = Math.max(0, Math.round(locOrdersMap.get(lid) ?? 0))
    const rawUi =
      locUiRawMap.get(lid) ??
      Object.fromEntries(UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }]))

    const rawUiMap = new Map<string, { netKwd: number; orders: number }>(
      UI_CHANNEL_KEYS.map((ck) => [
        ck,
        {
          netKwd: signedKwd(rawUi[ck]?.netKwd),
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
      uiChannels: channelsUnavailable ? null : locUi,
    }
    mappedByLocation[lid] = {
      netKwd: locRealNet,
      orders: locRealOrd,
    }
  }

  if (!channelsUnavailable && unmappedUiRaw) {
    for (const ck of UI_CHANNEL_KEYS) {
      const uEntry = unmappedUiRaw[ck]
      if (!uEntry) continue
      aggUiChannels[ck].netKwd = r3(aggUiChannels[ck].netKwd + signedKwd(uEntry.netKwd))
      aggUiChannels[ck].orders += Math.max(0, Math.round(Number(uEntry.orders) || 0))
    }
  }

  if (totalsUnavailable) {
    return {
      key,
      from,
      to,
      days,
      ...(isLatestOperationalDay ? { isLatestOperationalDay: true } : {}),
      totals: {
        netSalesKwd: null,
        orders: null,
        aovKwd: null,
        restaurantNetKwd: null,
        restaurantOrders: null,
      },
      byBrand: null,
      byLocation: null,
      mappedByLocation: null,
      unattributedSalesKwd: null,
      unattributedOrders: null,
      unattributedBranch: null,
      unmappedSummary: {
        netSalesKwd: null,
        orders: null,
      },
      ...(excludedUnavailable
        ? {}
        : {
            excludedSummary: {
              netSalesKwd: r3(Math.max(0, excludedNetKwd)),
              orders: Math.max(0, Math.round(excludedOrders)),
            },
          }),
      uiChannels: channelsUnavailable ? null : aggUiChannels,
      ...(accounting !== undefined ? { accounting } : {}),
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
    ...(brandsUnavailable ? { byBrand: null } : brandScope),
    byLocation,
    mappedByLocation,
    unattributedSalesKwd,
    unattributedOrders,
    unattributedBranch,
    unmappedSummary: {
      netSalesKwd: unattributedSalesKwd,
      orders: unattributedOrders,
    },
    ...(excludedUnavailable
      ? {}
      : {
          excludedSummary: {
            netSalesKwd: r3(Math.max(0, excludedNetKwd)),
            orders: Math.max(0, Math.round(excludedOrders)),
          },
        }),
    uiChannels: channelsUnavailable ? null : aggUiChannels,
    ...(registerRows
      ? { registerReconciliation: buildRegisterReconciliation(registerRows, companyNet) }
      : {}),
    ...(accounting !== undefined ? { accounting } : {}),
  }
}

type PosConfigReadRow = {
  id: number
  name: string
  active?: boolean
  company_id?: M2O
  picking_type_id?: M2O
}

/**
 * Active registers, plus any Qurain id even when archived. A second read logs
 * every pos.config whose name contains Qurain / قرين, or whose id is 24.
 */
async function fetchPosConfigsIncludingQurain(): Promise<PosConfigReadRow[]> {
  const active = await executeOdooKw<PosConfigReadRow[]>(
    'pos.config',
    'search_read',
    [[['active', '=', true]]],
    { fields: ['id', 'name', 'active', 'company_id', 'picking_type_id'] },
  ).catch(() =>
    executeOdooKw<PosConfigReadRow[]>(
      'pos.config',
      'search_read',
      [[['active', '=', true]]],
      { fields: ['id', 'name', 'active', 'company_id'] },
    ),
  )
  /* id-match-diagnostic-start */
  const diagnostic = await executeOdooKw<PosConfigReadRow[]>(
    'pos.config',
    'search_read',
    [[
      '|',
      '|',
      ['name', 'ilike', 'Qurain'],
      ['name', 'ilike', 'قرين'],
      ['id', 'in', [...QURAIN_POS_CONFIG_IDS]],
    ]],
    { fields: ['id', 'name', 'active', 'company_id'] },
  ).catch(() => [] as PosConfigReadRow[])
  for (const row of diagnostic) {
    logger.info('pos.config qurain diagnostic', {
      id: row.id,
      name: row.name,
      active: row.active !== false,
      companyId: m2oId(row.company_id),
    })
  }
  /* id-match-diagnostic-end */
  const byId = new Map<number, PosConfigReadRow>()
  for (const row of active) byId.set(row.id, row)
  for (const row of diagnostic) {
    if (!isQurainPosConfigId(row.id)) continue
    byId.set(row.id, { ...byId.get(row.id), ...row, id: row.id, name: row.name })
  }
  return [...byId.values()]
}

async function pullFreshCoreSnapshotFromOdoo(): Promise<CachedCoreSnapshot> {
  await hydrateAdminPosTerminalMappings()
  const cfg = readServerOdooConfig()
  if (!cfg) {
    throw new OdooConnectorError(
      'Odoo 17 environment variables are not configured on the server.',
      'ENV_NOT_CONFIGURED',
    )
  }

  const uid = await authenticateOdoo()
  const unavailableSectionSet = new Set<OdooUnavailableSectionKey>()
  const markFailure = (section: OdooUnavailableSectionKey) => ({
    collector: unavailableSectionSet,
    section,
  })

  // 1. Discover & map all POS configs (`id`, `name`, `company_id`, `picking_type_id`), POS categories, GL Chart of Accounts, user's company_id, and latest order timestamp
  const [allConfigs, posCategories, glAccountsRaw, userCompanyRows, latestOrderCandidates] = await Promise.all([
    fetchPosConfigsIncludingQurain().catch(() => [] as PosConfigReadRow[]),
    safeSubQuery(
      () =>
        executeOdooKw<{ id: number; name: string; parent_id: M2O }[]>(
          'pos.category',
          'search_read',
          [[]],
          { fields: ['id', 'name', 'parent_id'] },
        ),
      [],
      markFailure('pos.category'),
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
      markFailure('gl.accounts'),
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
  const companyConfigIds = new Set<number>()
  for (const c of allConfigs) {
    const extraCtx = `${m2oName(c.company_id) ?? ''} ${m2oName(c.picking_type_id) ?? ''}`.trim()
    const combined = `${c.name} ${extraCtx}`.trim()
    configNameById.set(c.id, combined)
    displayConfigNameById.set(c.id, sanitizePosTerminalDisplayName(c.id, c.name))
    if (isQurainPosConfigId(c.id)) {
      companyConfigIds.add(c.id)
      continue
    }
    if (c.active === false) {
      const isGenuinelyDecommissioned =
        isExcludedRecordId('pos_config', c.id) ||
        (isPinnedSchoolCanteenConfigId(c.id)
          ? !companyPosConfigAllowed(c.id, c.name, true)
          : isDecommissionedWarehouseRecord(c.name))
      if (isGenuinelyDecommissioned) {
        decommissionedConfigIds.add(c.id)
      }
      continue
    }
    if (isPinnedSchoolCanteenConfigId(c.id)) {
      if (!companyPosConfigAllowed(c.id, c.name, true)) {
        decommissionedConfigIds.add(c.id)
        continue
      }
    } else {
      if (isExcludedRecordId('pos_config', c.id) || isDecommissionedWarehouseRecord(combined)) {
        decommissionedConfigIds.add(c.id)
        continue
      }
      if (!companyPosConfigAllowed(c.id, c.name, true)) continue
    }
    companyConfigIds.add(c.id)
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
  if (allConfigs.length === 0) {
    for (const cfgId of [...new Set([...REG.allowedPosConfigIds, ...QURAIN_POS_CONFIG_IDS])]) {
      const knownName = configNameById.get(cfgId) ?? ''
      if (decommissionedConfigIds.has(cfgId) || !companyPosConfigAllowed(cfgId, knownName, true)) continue
      companyConfigIds.add(cfgId)
      if (!nativeBranchOfConfigId.has(cfgId)) {
        const nb = resolveRestaurantBranchForConfig(cfgId, knownName, '', {
          ignoreAdminOverride: true,
        })
        if (nb) nativeBranchOfConfigId.set(cfgId, nb)
      }
      if (!branchOfConfigId.has(cfgId)) {
        const b = resolveRestaurantBranchForConfig(cfgId, knownName)
        if (b) branchOfConfigId.set(cfgId, b)
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
  const resolveRootCatName = (catId: number | null): string | null => resolveRootCat(catId)?.name ?? null
  const excludedPosCategoryIds = new Set<number>()
  for (const c of posCategories) {
    const root = resolveRootCat(c.id)
    if (
      isExcludedRecordId('pos_category', c.id) ||
      isExcludedRecordId('pos_category', root?.id)
    ) {
      excludedPosCategoryIds.add(c.id)
    }
  }

  const excludedPosDomain: unknown[] =
    companyConfigIds.size > 0
      ? posRegisterScopeClauses({
          companyId: resolvedCompanyId,
          configIds: [...companyConfigIds],
          configField: 'session_id.config_id',
          companyField: 'company_id',
        })
      : [['id', '=', 0]]
  const excludedPosLineDomain: unknown[] = [
    ...(companyConfigIds.size > 0
      ? posRegisterScopeClauses({
          companyId: resolvedCompanyId,
          configIds: [...companyConfigIds],
          configField: 'order_id.session_id.config_id',
          companyField: 'company_id',
        })
      : [['id', '=', 0]]),
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
      if (cid !== null && isQurainPosConfigId(cid)) return true
      if (cid !== null && decommissionedConfigIds.has(cid)) return false
      if (resolvedCompanyId !== null && compId !== null && compId !== resolvedCompanyId) return false
      return true
    }) ?? latestOrderCandidates[0]
  const newestOrderConverted = odooUtcToKuwaitIso(newestActiveOrderRow?.date_order)

  const anchorDayKwIso = anchorKuwaitDay(todayKwIso, newestOrderConverted?.kuwaitDate ?? null)
  const anchorTomorrowKwIso = shiftIsoDate(anchorDayKwIso, 1)
  const todayIsFallbackDay = false

  const weekFromKwIso = shiftIsoDate(anchorDayKwIso, -6)
  const monthFromKwIso = `${anchorDayKwIso.slice(0, 7)}-01`
  // Rolling comparison stays a true 30-day window. The month bucket itself is calendar MTD.
  const rolling30FromKwIso = shiftIsoDate(anchorDayKwIso, -29)
  const prior30FromKwIso = shiftIsoDate(rolling30FromKwIso, -30)
  // Pre-index 65 days of daily history back from anchorDayKwIso up through tomorrowKwIso
  const series65FromKwIso = shiftIsoDate(anchorDayKwIso, -64)
  const mtdFromKwIso = monthFromKwIso
  const yearFromKwIso = `${anchorDayKwIso.slice(0, 4)}-01-01`

  const bounds65 = kuwaitRangeToOdooUtcStrings(series65FromKwIso, tomorrowKwIso)
  const boundsMonth = kuwaitRangeToOdooUtcStrings(monthFromKwIso, anchorTomorrowKwIso)
  const boundsWeek = kuwaitRangeToOdooUtcStrings(weekFromKwIso, anchorTomorrowKwIso)
  const boundsToday = kuwaitRangeToOdooUtcStrings(anchorDayKwIso, anchorTomorrowKwIso)
  const boundsYear = kuwaitRangeToOdooUtcStrings(yearFromKwIso, anchorTomorrowKwIso)

  const companyConfigList = [...companyConfigIds]
  const posOrderDomainOf = (
    b: { fromUtc: string; toUtc: string },
    nonRefundOnly = false,
  ): unknown[] =>
    companyConfigList.length > 0
      ? buildPosOrderUtcDomain({
          fromUtc: b.fromUtc,
          toExclusiveUtc: b.toUtc,
          companyId: resolvedCompanyId,
          configIds: companyConfigList,
          nonRefundOnly,
        })
      : [['id', '=', 0]]
  const posPaymentDomainOf = (
    b: { fromUtc: string; toUtc: string },
    nonRefundOnly = false,
  ): unknown[] =>
    companyConfigList.length > 0
      ? buildPosPaymentUtcDomain({
          fromUtc: b.fromUtc,
          toExclusiveUtc: b.toUtc,
          companyId: resolvedCompanyId,
          configIds: companyConfigList,
          nonRefundOnly,
        })
      : [['id', '=', 0]]

  // 3a. Exact brand scope rows (today + last 7 days) start now, alongside the main reads, under a
  // fixed time budget. A slow or failed read resolves `null` and the bucket keeps the labelled
  // product-line basis (see `startExactBrandRowsRead`).
  const companyLineWindowDomain = (b: { fromUtc: string; toUtc: string }): unknown[] => [
    ['order_id.date_order', '>=', b.fromUtc],
    ['order_id.date_order', '<', b.toUtc],
    ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
    ...(companyConfigIds.size > 0
      ? posRegisterScopeClauses({
          companyId: resolvedCompanyId,
          configIds: [...companyConfigIds],
          configField: 'order_id.session_id.config_id',
          companyField: 'company_id',
        })
      : [['id', '=', 0]]),
  ]
  const exactBrandRowsOf = (b: { fromUtc: string; toUtc: string }) =>
    startExactBrandRowsRead(executeOdooKw as OdooExecute, {
      orderDomain: posOrderDomainOf(b, false),
      lineDomain: companyLineWindowDomain(b),
      excludedCategoryIds: [...excludedPosCategoryIds],
    })
  const exactBrandRowsToday = exactBrandRowsOf(boundsToday)
  const exactBrandRowsWeek = exactBrandRowsOf(boundsWeek)
  const closedYearWindow = yearClosedWindow(boundsYear.fromUtc, boundsToday.fromUtc)
  const todayWindow = { fromUtc: boundsToday.fromUtc, toUtc: boundsToday.toUtc }
  const yearCachePrefix = `${resolvedCompanyId ?? 'none'}|${[...companyConfigList].sort((a, b) => a - b).join(',')}|${anchorDayKwIso}|${[...excludedPosCategoryIds].sort((a, b) => a - b).join(',')}`
  const yearKwargs = (window: { fromUtc: string; toUtc: string }) => yearReadCall(window).kwargs
  const yearTimeout = (window: { fromUtc: string; toUtc: string }) => yearReadCall(window).timeout
  const readYearPayments = async (
    window: { fromUtc: string; toUtc: string },
    nonRefundOnly: boolean,
  ) => {
    const ids = [...companyConfigList]
    const rows: { session_id: M2O; payment_method_id: M2O; amount?: number; __count?: number }[] = []
    if (ids.length === 0) return rows
    const initialCall = yearReadCall(window)
    const closedDeadlineAtMs = initialCall.timeout
      ? Date.now() + YEAR_CLOSED_READ_TIMEOUT_MS
      : undefined
    let cursor = 0
    const workers = Array.from({ length: Math.min(YEAR_REGISTER_READ_CONCURRENCY, ids.length) }, async () => {
      while (cursor < ids.length) {
        const cfgId = ids[cursor]
        cursor += 1
        const batchCall = yearReadCall(
          window,
          closedDeadlineAtMs !== undefined ? { deadlineAtMs: closedDeadlineAtMs } : undefined,
        )
        const page = await executeOdooKw<typeof rows>(
          'pos.payment',
          'read_group',
          [
            buildPosPaymentUtcDomain({
              fromUtc: window.fromUtc,
              toExclusiveUtc: window.toUtc,
              companyId: resolvedCompanyId,
              configIds: [cfgId],
              nonRefundOnly,
            }),
            ['amount:sum'],
            [...YEAR_PAYMENT_GROUP_BY],
          ],
          batchCall.kwargs,
          batchCall.timeout,
        )
        rows.push(...page)
      }
    })
    await Promise.all(workers)
    return rows
  }

  // 3. Parallel PostgreSQL-side `read_group` queries across ALL active company POS terminals.
  // Every `(net, nonRefundCount)` query pair executes as ONE atomic unit so a count failure never
  // leaves real KWD paired with 0 orders or a distorted average ticket.
  const [
    ordersByDaySessionPricelistRows,
    ordersByDaySessionPricelistCountRows,
    [ordersByHourRows, ordersByHourCountRows],
    [payments30Rows, payments30CountRows],
    [paymentsWeekRows, paymentsWeekCountRows],
    [paymentsTodayRows, paymentsTodayCountRows],
    [paymentsYearRows, paymentsYearCountRows],
    productLines30Rows,
    productLinesWeekRows,
    productLinesTodayRows,
    productLinesYearRows,
    [ytdAggRows, ytdAggCountRows],
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
        posOrderDomainOf(bounds65, false),
        ['amount_total:sum', 'amount_tax:sum'],
        ['session_id', 'pricelist_id', 'date_order:day'],
      ],
      { lazy: false, context: { tz: 'Asia/Kuwait' } },
    ),
    executeOdooKw<
      {
        __count?: number
        session_id: M2O
        pricelist_id?: M2O
        __range?: { 'date_order:day'?: { from?: string; to?: string } }
      }[]
    >(
      'pos.order',
      'read_group',
      [
        posOrderDomainOf(bounds65, true),
        ['amount_total:sum'],
        ['session_id', 'pricelist_id', 'date_order:day'],
      ],
      { lazy: false, context: { tz: 'Asia/Kuwait' } },
    ),
    safeSubQuery(
      () =>
        Promise.all([
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
              posOrderDomainOf(boundsMonth, false),
              ['amount_total:sum', 'amount_tax:sum'],
              ['date_order:hour'],
            ],
            { lazy: false, context: { tz: 'Asia/Kuwait' } },
          ),
          executeOdooKw<
            {
              __count?: number
              __range?: { 'date_order:hour'?: { from?: string; to?: string } }
            }[]
          >(
            'pos.order',
            'read_group',
            [
              posOrderDomainOf(boundsMonth, true),
              ['amount_total:sum'],
              ['date_order:hour'],
            ],
              { lazy: false, context: { tz: 'Asia/Kuwait' } },
            ),
          ]),
        [[], []],
        markFailure('hourly'),
      ),
      safeSubQuery(
        () =>
          Promise.all([
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
                posPaymentDomainOf(boundsMonth, false),
                ['amount:sum'],
                ['session_id', 'payment_method_id'],
              ],
              { lazy: false },
            ),
            executeOdooKw<
              {
                session_id: M2O
                payment_method_id: M2O
                __count?: number
              }[]
            >(
              'pos.payment',
              'read_group',
              [
                posPaymentDomainOf(boundsMonth, true),
                ['amount:sum'],
                ['session_id', 'payment_method_id'],
              ],
              { lazy: false },
            ),
          ]),
        [[], []],
        markFailure('channels.month'),
      ),
      safeSubQuery(
        () =>
          Promise.all([
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
                posPaymentDomainOf(boundsWeek, false),
                ['amount:sum'],
                ['session_id', 'payment_method_id'],
              ],
              { lazy: false },
            ),
            executeOdooKw<
              {
                session_id: M2O
                payment_method_id: M2O
                __count?: number
              }[]
            >(
              'pos.payment',
              'read_group',
              [
                posPaymentDomainOf(boundsWeek, true),
                ['amount:sum'],
                ['session_id', 'payment_method_id'],
              ],
              { lazy: false },
            ),
          ]),
        [[], []],
        markFailure('channels.week'),
      ),
      safeSubQuery(
        () =>
          Promise.all([
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
                posPaymentDomainOf(boundsToday, false),
                ['amount:sum'],
                ['session_id', 'payment_method_id'],
              ],
              { lazy: false },
            ),
            executeOdooKw<
              {
                session_id: M2O
                payment_method_id: M2O
                __count?: number
              }[]
            >(
              'pos.payment',
              'read_group',
              [
                posPaymentDomainOf(boundsToday, true),
                ['amount:sum'],
                ['session_id', 'payment_method_id'],
              ],
              { lazy: false },
            ),
          ]),
        [[], []],
        markFailure('channels.today'),
      ),
      safeSubQuery(
        () =>
          Promise.all([
            readClosedYearPlusToday({
              cacheKey: `channels.year.net|${yearCachePrefix}`,
              closed: closedYearWindow,
              today: todayWindow,
              read: (window) => readYearPayments(window, false),
              merge: (rows) =>
                mergeRowsByKey(rows, (row) => {
                  const session = Array.isArray(row.session_id) ? row.session_id[0] : 'none'
                  const method = Array.isArray(row.payment_method_id) ? row.payment_method_id[0] : 'none'
                  return `${session}|${method}`
                }, ['amount']),
            }),
            readClosedYearPlusToday({
              cacheKey: `channels.year.count|${yearCachePrefix}`,
              closed: closedYearWindow,
              today: todayWindow,
              read: (window) => readYearPayments(window, true),
              merge: (rows) =>
                mergeRowsByKey(rows, (row) => {
                  const session = Array.isArray(row.session_id) ? row.session_id[0] : 'none'
                  const method = Array.isArray(row.payment_method_id) ? row.payment_method_id[0] : 'none'
                  return `${session}|${method}`
                }, []),
            }),
          ]),
        [[], []],
        markFailure('channels.year'),
      ),
      unavailableSectionSet.has('pos.category')
        ? Promise.resolve([] as { product_id: M2O; price_subtotal: number; qty?: number }[])
        : safeSubQuery(
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
            markFailure('brands.month'),
          ),
      unavailableSectionSet.has('pos.category')
        ? Promise.resolve([] as { product_id: M2O; price_subtotal: number; qty?: number }[])
        : safeSubQuery(
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
            markFailure('brands.week'),
          ),
      unavailableSectionSet.has('pos.category')
        ? Promise.resolve([] as { product_id: M2O; price_subtotal: number; qty?: number }[])
        : safeSubQuery(
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
            markFailure('brands.today'),
          ),
      unavailableSectionSet.has('pos.category')
        ? Promise.resolve([] as { product_id: M2O; price_subtotal: number; qty?: number }[])
        : safeSubQuery(
            () =>
              readClosedYearPlusToday({
                cacheKey: `brands.year|${yearCachePrefix}`,
                closed: closedYearWindow,
                today: todayWindow,
                read: (window) =>
                  executeOdooKw<{ product_id: M2O; price_subtotal: number; qty?: number }[]>(
                    'pos.order.line',
                    'read_group',
                    [
                      [
                        ['order_id.date_order', '>=', window.fromUtc],
                        ['order_id.date_order', '<', window.toUtc],
                        ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
                        ...excludedPosLineDomain,
                      ],
                      ['price_subtotal:sum', 'qty:sum'],
                      ['product_id'],
                    ],
                    yearKwargs(window),
                    yearTimeout(window),
                  ),
                merge: mergeProductLineGroups,
              }),
            [],
            markFailure('brands.year'),
          ),
      safeSubQuery(
        () =>
          Promise.all([
            readClosedYearPlusToday({
              cacheKey: `year.net|${yearCachePrefix}`,
              closed: closedYearWindow,
              today: todayWindow,
              read: (window) =>
                executeOdooKw<{ session_id: M2O; amount_total?: number; amount_tax?: number; __count?: number }[]>(
                  'pos.order',
                  'read_group',
                  [
                    posOrderDomainOf(window, false),
                    ['amount_total:sum', 'amount_tax:sum'],
                    ['session_id'],
                  ],
                  yearKwargs(window),
                  yearTimeout(window),
                ),
              merge: (rows) =>
                mergeRowsByKey(rows, (row) => String(Array.isArray(row.session_id) ? row.session_id[0] : 'none'), [
                  'amount_total',
                  'amount_tax',
                ]),
            }),
            readClosedYearPlusToday({
              cacheKey: `year.count|${yearCachePrefix}`,
              closed: closedYearWindow,
              today: todayWindow,
              read: (window) =>
                executeOdooKw<{ session_id: M2O; __count?: number }[]>(
                  'pos.order',
                  'read_group',
                  [posOrderDomainOf(window, true), ['amount_total:sum'], ['session_id']],
                  yearKwargs(window),
                  yearTimeout(window),
                ),
              merge: (rows) =>
                mergeRowsByKey(rows, (row) => String(Array.isArray(row.session_id) ? row.session_id[0] : 'none'), []),
            }),
          ]),
        [[], []],
        markFailure('year'),
      ),
    safeSubQuery<OdooStockTransferSummary | null | undefined>(async () => {
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
        executeOdooKw<number>(
          'stock.picking',
          'search_count',
          [[['state', '=', 'done'], ['date_done', '>=', boundsMonth.fromUtc]]],
        ),
        executeOdooKw<number>(
          'stock.picking',
          'search_count',
          [[['state', 'in', ['assigned', 'waiting', 'confirmed']]]],
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
    }, null, markFailure('stockTransfers')),
    safeSubQuery<OdooReceivableClearingSummary | null | undefined>(async () => {
      const arDomain: unknown[][] = [
        ...companyDomain,
        ...buildOpenReceivableClauses(),
      ]
      const partnerDomain: unknown[][] = [
        ...arDomain,
        ['date', '!=', false],
      ]
      const [byAccRows, minDateRows, maxDateRows, maxMaturityRows, partnerGroups] = await Promise.all([
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
        executeOdooKw<
          {
            partner_id?: M2O
            account_id?: M2O
            amount_residual?: number
            __count?: number
            date?: string | false
            date_min?: string | false
            date_maturity?: string | false
            date_maturity_min?: string | false
          }[]
        >(
          'account.move.line',
          'read_group',
          [partnerDomain, ['amount_residual:sum', 'date:min', 'date_maturity:min'], ['partner_id', 'account_id']],
          { lazy: false },
        ),
      ])

      const unverifiedAccCount = byAccRows.filter(
        (r) => !isVerifiedReceivableAccountId(m2oId(r.account_id)),
      ).length
      if (unverifiedAccCount > 0) {
        logger.error('odoo_receivables_fail_closed_unverified_account_id', {
          stage: 'byAccount',
          totalRows: byAccRows.length,
          unverifiedCount: unverifiedAccCount,
        })
        throw new UnverifiedReceivableAccountError('byAccount', unverifiedAccCount)
      }

      const unverifiedPartnerAccCount = partnerGroups.filter(
        (g) => !isVerifiedReceivableAccountId(m2oId(g.account_id)),
      ).length
      if (unverifiedPartnerAccCount > 0) {
        logger.error('odoo_receivables_fail_closed_unverified_account_id', {
          stage: 'partnerGroups',
          totalRows: partnerGroups.length,
          unverifiedCount: unverifiedPartnerAccCount,
        })
        throw new UnverifiedReceivableAccountError('partnerGroups', unverifiedPartnerAccCount)
      }

      const byAccount: OdooReceivableAccountRow[] = []
      let netSum = 0
      let grossPositive = 0
      let creditOffset = 0
      let totalLines = 0
      let posClearingLinesCount = 0
      let posClearingNetKwd = 0

      for (const r of byAccRows) {
        const accId = m2oId(r.account_id) as number
        const accName = m2oName(r.account_id) ?? ''
        if (isDecommissionedWarehouseRecord(accName)) continue
        const resVal = Number(r.amount_residual) || 0
        const cnt = Math.max(0, Number(r.__count) || 0)
        netSum += resVal
        totalLines += cnt
        if (accId === POS_CLEARING_ACCOUNT_ID) {
          posClearingLinesCount += cnt
          posClearingNetKwd += resVal
        }
        if (resVal > 0) grossPositive += resVal
        else if (resVal < 0) creditOffset += resVal
        byAccount.push(formatReceivableAccountRow(accId, accName, resVal, cnt))
      }
      byAccount.sort((a, b) => b.residualKwd - a.residualKwd)

      const postingDay = (raw: string | false | undefined): string | null =>
        typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null
      const scopedPartnerGroups = partnerGroups
        .map((g) => ({
          partnerId: m2oId(g.partner_id),
          partnerName: m2oName(g.partner_id) ?? '',
          accountId: m2oId(g.account_id) as number,
          accountLabel: m2oName(g.account_id) ?? '',
          residualKwd: Number(g.amount_residual) || 0,
          linesCount: Math.max(0, Number(g.__count) || 0),
          oldestPostingDate: postingDay(g.date_min) ?? postingDay(g.date),
          oldestDueDate:
            postingDay(g.date_maturity_min) ??
            postingDay(g.date_maturity) ??
            postingDay(g.date_min) ??
            postingDay(g.date),
        }))
        .filter(
          (g) =>
            !isDecommissionedWarehouseRecord(g.accountLabel) &&
            !isDecommissionedWarehouseRecord(g.partnerName),
        )

      const partnerResiduals = buildReceivablePartnerRows(scopedPartnerGroups)
      const customerSplit = receivablesCustomerSplit(byAccount, partnerResiduals)
      if (customerSplit.failClosed) {
        throw new UnverifiedReceivableAccountError('customerSplit', 1)
      }
      const platformAndCorporateLinesCount = customerSplit.platformLineCount
      const platformNetKwd = customerSplit.platformNetKwd
      const byPartner = partnerResiduals
      const oldestOpenPostingDate =
        byPartner
          .map((row) => row.oldestPostingDate)
          .filter((day): day is string => Boolean(day))
          .sort()[0] ?? null

      const agingPartnerGroups =
        scopedPartnerGroups.length > 0
          ? scopedPartnerGroups
          : customerSplit.customerAccounts.map((acc) => ({
              partnerId: 0,
              accountId: acc.accountId,
              residualKwd: acc.residualKwd,
              linesCount: acc.linesCount,
              oldestPostingDate: todayKwIso,
              oldestDueDate: todayKwIso,
            }))

      const netPositiveDebtorGroups = agingPartnerGroups.filter(
        (g) => g.accountId !== POS_CLEARING_ACCOUNT_ID && Math.round(g.residualKwd * 1000) > 0,
      )

      const openDebtorLines: {
        id?: number | null
        partnerId: number | null
        accountId: number | null
        residualKwd: number
        dateMaturity: string | null
        date: string
      }[] = []

      if (netPositiveDebtorGroups.length > 0) {
        const positiveAccountIds = [...new Set(netPositiveDebtorGroups.map((g) => g.accountId))]
        const positivePartnerIds = [
          ...new Set(
            netPositiveDebtorGroups
              .map((g) => g.partnerId)
              .filter((id): id is number => typeof id === 'number' && id > 0),
          ),
        ]
        const hasPartnerlessDebtor = netPositiveDebtorGroups.some(
          (g) => g.partnerId === null || g.partnerId === 0,
        )
        const partnerClause: unknown[] =
          hasPartnerlessDebtor && positivePartnerIds.length > 0
            ? ['|', ['partner_id', '=', false], ['partner_id', 'in', positivePartnerIds]]
            : hasPartnerlessDebtor
              ? [['partner_id', '=', false]]
              : [['partner_id', 'in', positivePartnerIds]]
        const debtorLinesDomain: unknown[] = [
          ...arDomain,
          ['account_id', 'in', positiveAccountIds],
          ...partnerClause,
        ]
        const netPositiveKeys = new Set(
          netPositiveDebtorGroups.map((g) => `${g.partnerId ?? 0}:${g.accountId}`),
        )
        const AR_LINE_PAGE_SIZE = 500
        const AR_LINE_MAX_PAGES = 20
        for (let page = 0; page < AR_LINE_MAX_PAGES; page++) {
          const batch = await safeSubQuery(
            () =>
              executeOdooKw<
                {
                  id?: number
                  partner_id?: M2O
                  account_id?: M2O
                  amount_residual?: number
                  date_maturity?: string | false
                  date?: string | false
                }[]
              >(
                'account.move.line',
                'search_read',
                [debtorLinesDomain],
                {
                  fields: ['id', 'partner_id', 'account_id', 'amount_residual', 'date_maturity', 'date'],
                  order: 'date asc, id asc',
                  limit: AR_LINE_PAGE_SIZE,
                  offset: page * AR_LINE_PAGE_SIZE,
                },
              ),
            [],
          )
          if (!Array.isArray(batch) || batch.length === 0) break
          // Date-only projection rows without residual or account fields carry no line balances.
          const carriesLineBalances = batch.some(
            (row) =>
              row !== null &&
              typeof row === 'object' &&
              ('amount_residual' in row || 'account_id' in row),
          )
          if (!carriesLineBalances) break
          const unverifiedLineCount = batch.filter(
            (row) => !isVerifiedReceivableAccountId(m2oId(row.account_id)),
          ).length
          if (unverifiedLineCount > 0) {
            logger.error('odoo_receivables_fail_closed_unverified_account_id', {
              stage: 'debtorLines',
              totalRows: batch.length,
              unverifiedCount: unverifiedLineCount,
            })
            throw new UnverifiedReceivableAccountError('debtorLines', unverifiedLineCount)
          }
          for (const row of batch) {
            const lineAccId = m2oId(row.account_id) as number
            const lineAccName = m2oName(row.account_id) ?? ''
            const linePartnerName = m2oName(row.partner_id) ?? ''
            if (
              lineAccId === POS_CLEARING_ACCOUNT_ID ||
              isDecommissionedWarehouseRecord(lineAccName) ||
              isDecommissionedWarehouseRecord(linePartnerName)
            ) {
              continue
            }
            const linePartnerId = m2oId(row.partner_id)
            if (!netPositiveKeys.has(`${linePartnerId ?? 0}:${lineAccId}`)) continue
            openDebtorLines.push({
              id: typeof row.id === 'number' ? row.id : null,
              partnerId: linePartnerId,
              accountId: lineAccId,
              residualKwd: Number(row.amount_residual) || 0,
              dateMaturity: postingDay(row.date_maturity),
              date: postingDay(row.date) ?? todayKwIso,
            })
          }
          if (batch.length < AR_LINE_PAGE_SIZE) break
        }
      }

      const aging = computeUnifiedReceivableAging({
        todayIso: todayKwIso,
        partnerGroups: agingPartnerGroups,
        lines: openDebtorLines,
        fallbackDateIso: todayKwIso,
        throwOnUnverifiedAccountId: true,
      })
      const computedAging = aging.buckets

      const fromDate =
        typeof minDateRows?.[0]?.date === 'string' && minDateRows[0].date.trim()
          ? minDateRows[0].date.trim()
          : null
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
        maturityStatusAr: 'رصيد متبقٍ غير مسوّى — ليس تصنيف استحقاق',
        maturityStatusEn: 'Open residual — not a due-date status',
        openLinesExplanationAr: `إجمالي ${totalLines.toLocaleString('en-US')} سطراً غير مسوّى في أودو يتكون من ${posClearingLinesCount.toLocaleString('en-US')} قيد مقاصة إيصالات كاشير فردية بحساب 10552 (${r3(posClearingNetKwd).toLocaleString('en-US')} د.ك) + ${platformAndCorporateLinesCount.toLocaleString('en-US')} قيود منصات توصيل وعملاء شركات (${platformNetKwd >= 0 ? '+' : ''}${platformNetKwd.toLocaleString('en-US')} د.ك)، وبالمجموع: +${r3(customerSplit.platformOpenDebitsKwd).toLocaleString('en-US')} مدين موجب ناقص ${Math.abs(r3(customerSplit.platformUnappliedCreditsKwd)).toLocaleString('en-US')} مقاصة دائنة = ${r3(platformNetKwd).toLocaleString('en-US')} د.ك.`,
        openLinesExplanationEn: `The ${totalLines.toLocaleString('en-US')} unreconciled Odoo lines consist of ${posClearingLinesCount.toLocaleString('en-US')} individual POS receipt clearing entries in account 10552 (${r3(posClearingNetKwd).toLocaleString('en-US')} KWD) plus ${platformAndCorporateLinesCount.toLocaleString('en-US')} aggregator & corporate AR lines (${platformNetKwd >= 0 ? '+' : ''}${platformNetKwd.toLocaleString('en-US')} KWD): +${r3(customerSplit.platformOpenDebitsKwd).toLocaleString('en-US')} positive debit minus ${Math.abs(r3(customerSplit.platformUnappliedCreditsKwd)).toLocaleString('en-US')} credit clearing = ${r3(platformNetKwd).toLocaleString('en-US')} KWD.`,
        sourceModel: 'account.move.line',
        byAccount,
        agingBuckets: computedAging,
        agingBasis: aging.basis,
        openDebitsKwd: aging.openDebitsKwd,
        unappliedCreditsKwd: aging.unappliedCreditsKwd,
        unappliedCreditLinesCount: aging.unappliedCreditLinesCount,
        platformNetKwd,
        platformOpenDebitsKwd: customerSplit.platformOpenDebitsKwd,
        platformUnappliedCreditsKwd: customerSplit.platformUnappliedCreditsKwd,
        posClearingResidualKwd: customerSplit.posClearingResidualKwd,
        oldestOpenPostingDate,
        byPartner,
      }
    }, null, markFailure('receivables')),
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
          markFailure('excluded.month'),
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
          markFailure('gl.today'),
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
          markFailure('gl.week'),
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
          markFailure('gl.month'),
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
          markFailure('gl.year'),
        )
      : Promise.resolve([]),
  ])

  const mergedDaySessionPricelistRows = mergeDaySessionPricelistGroups(
    ordersByDaySessionPricelistRows,
    ordersByDaySessionPricelistCountRows,
  )
  const mergedHourRows = mergeHourGroups(ordersByHourRows, ordersByHourCountRows)
  const mergedPayments30Rows = mergeSessionPaymentGroups(payments30Rows, payments30CountRows)
  const mergedPaymentsWeekRows = mergeSessionPaymentGroups(paymentsWeekRows, paymentsWeekCountRows)
  const mergedPaymentsTodayRows = mergeSessionPaymentGroups(
    paymentsTodayRows,
    paymentsTodayCountRows,
  )
  const mergedPaymentsYearRows = mergeSessionPaymentGroups(paymentsYearRows, paymentsYearCountRows)
  const mergedYtdSessionRows = mergeSessionGroups(ytdAggRows, ytdAggCountRows)

  // 4. Resolve session -> config_id + product -> brand mapping
  const allSessionIds = [
    ...new Set(
      [
        ...mergedDaySessionPricelistRows.map((o) => o.sessionId),
        ...decommissionedOrders30Rows.map((o) => m2oId(o.session_id)),
        ...mergedPayments30Rows.map((p) => p.sessionId),
        ...mergedPaymentsWeekRows.map((p) => p.sessionId),
        ...mergedPaymentsTodayRows.map((p) => p.sessionId),
        ...mergedPaymentsYearRows.map((p) => p.sessionId),
        ...mergedYtdSessionRows.map((o) => o.sessionId),
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
      ? executeOdooKw<{ id: number; config_id: M2O }[]>(
          'pos.session',
          'read',
          [allSessionIds, ['id', 'config_id']],
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
          markFailure('products'),
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
    if (isExcludedOdooEntity(p.name) || isNonCompanyCatalogItem(null, p.name)) continue
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
  const registerToday = new Map<number, { net: number; orders: number }>()
  const registerWeek = new Map<number, { net: number; orders: number }>()
  const registerMonth = new Map<number, { net: number; orders: number }>()

  const bumpAllowedRegister = (
    map: Map<number, { net: number; orders: number }>,
    cfgId: number | undefined,
    amount: number,
    count: number,
  ) => {
    if (cfgId === undefined || !companyConfigIds.has(cfgId)) return
    const prev = map.get(cfgId) ?? { net: 0, orders: 0 }
    prev.net += amount
    prev.orders += count
    map.set(cfgId, prev)
  }
  const registerRowsFor = (map: Map<number, { net: number; orders: number }>) =>
    [...map.entries()].map(([configId, agg]) => ({
      configId,
      configName: displayConfigNameById.get(configId) ?? configNameById.get(configId) ?? '',
      netKwd: agg.net,
      orders: agg.orders,
    }))

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
  ) as Record<(typeof ACTIVE_BRANCH_IDS)[number], { netSalesKwd: number; orders: number }>

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
    const net = posOrderNet(exRow.amount_total, exRow.amount_tax)
    if (ordCount <= 0 && net === 0) continue
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

  for (const row of mergedDaySessionPricelistRows) {
    const rawFromUtc = row.dayFromUtc
    const parsedRange = rawFromUtc ? odooUtcToKuwaitIso(rawFromUtc) : null
    if (!parsedRange) continue

    const dayIso = parsedRange.kuwaitDate
    const net = row.netKwd
    const ordCount = row.orders
    if (ordCount <= 0 && net === 0) continue

    const sid = row.sessionId
    const cfgId = sid !== null ? configOfSession.get(sid) : undefined
    if (cfgId !== undefined && decommissionedConfigIds.has(cfgId)) {
      continue
    }
    if (dayIso === anchorDayKwIso) bumpAllowedRegister(registerToday, cfgId, net, ordCount)
    if (dayIso >= weekFromKwIso && dayIso <= anchorDayKwIso) bumpAllowedRegister(registerWeek, cfgId, net, ordCount)
    if (dayIso >= monthFromKwIso && dayIso <= anchorDayKwIso) bumpAllowedRegister(registerMonth, cfgId, net, ordCount)
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
        const plName = row.pricelistName
        const hintedCh = resolveUiChannelHint(`${plName} ${cfgName}`, false)
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
      const isDelivCfg = isDeliveryPosConfigId(cfgId)
      const plName = row.pricelistName
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
      c.active !== false &&
      companyConfigIds.has(c.id) &&
      !decommissionedConfigIds.has(c.id) &&
      !nativeBranchOfConfigId.has(c.id) &&
      !discoveredCandidateMap.has(c.id)
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

  const excludedMonthFailed = unavailableSectionSet.has('excluded.month')
  if (!excludedMonthFailed) {
    recordLiveDiscoveredPosLedger({
      candidateTerminals: [...discoveredCandidateMap.values()].sort(
        (a, b) => b.net_sales_kwd - a.net_sales_kwd || a.terminal_id - b.terminal_id,
      ),
      nativeMappedTerminals: nativeMappedTerminalsLive.filter(
        (row): row is typeof row & { branch_id: ActiveVentureBranchId } =>
          (ACTIVE_VENTURE_BRANCH_IDS as readonly string[]).includes(row.branch_id),
      ),
      baseBranches: Object.fromEntries(
        ACTIVE_VENTURE_BRANCH_IDS.map((id) => [
          id,
          nativeBranchMonthStats[id] ?? { netSalesKwd: 0, orders: 0 },
        ]),
      ) as Record<ActiveVentureBranchId, { netSalesKwd: number; orders: number }>,
      excludedEntitiesKwd: r3(excludedMonthNet),
      excludedEntitiesOrders: Math.round(excludedMonthOrd),
      excludedPos24Kwd: r3(excludedPos24Net),
      excludedPos24Orders: Math.round(excludedPos24Ord),
      excludedPos36Kwd: r3(excludedPos36Net),
      excludedPos36Orders: Math.round(excludedPos36Ord),
    })
  }

  for (const hRow of mergedHourRows) {
    const rawHourFromUtc = hRow.hourFromUtc
    const parsedHour = rawHourFromUtc ? odooUtcToKuwaitIso(rawHourFromUtc) : null
    if (!parsedHour) continue
    const kwHour = parsedHour.kuwaitHour
    hourlyAcc[kwHour].orders += hRow.orders
    hourlyAcc[kwHour].netKwd += hRow.netKwd
  }

  const dailySeries = [...dailyMap.entries()]
    .filter(([, v]) => v.orders > 0 || v.netKwd !== 0)
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

  const hourlySeries = unavailableSectionSet.has('hourly')
    ? null
    : hourlyAcc.map((h) => ({
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
      if (isExcludedOdooEntity(pName) || isNonCompanyCatalogItem(null, pName)) continue
      const bid =
        (pid !== null ? brandOfProductId.get(pid) : undefined) ??
        resolveBrandHintFromText(pName)
      if (!bid || !(ACTIVE_BRAND_IDS as readonly string[]).includes(bid)) continue
      netMap.set(bid, (netMap.get(bid) ?? 0) + signedKwd(r.price_subtotal))
      qtyMap.set(bid, (qtyMap.get(bid) ?? 0) + Math.max(0, Number(r.qty) || 0))
    }
    return { netMap, qtyMap }
  }

  const brandMetaFailed =
    unavailableSectionSet.has('products') || unavailableSectionSet.has('pos.category')
  const brand30 = buildBrandMaps(productLines30Rows)
  const brandWeek = buildBrandMaps(productLinesWeekRows)
  const brandToday = buildBrandMaps(productLinesTodayRows)
  const brandYear = buildBrandMaps(productLinesYearRows)

  // 6b. Exact brand scope: per-order allocation for short windows, real order counts for long ones.
  const resolveProductBrand = (productId: number | null, productName: string): string | null => {
    const bid = (productId !== null ? brandOfProductId.get(productId) : undefined) ?? resolveBrandHintFromText(productName)
    return bid && (ACTIVE_BRAND_IDS as readonly string[]).includes(bid) ? bid : null
  }
  const brandScopeMapping = {
    brandIds: ACTIVE_BRAND_IDS,
    locationKeys: [...ACTIVE_BRANCH_IDS, 'unattributed'],
    locationOfSession: (sessionId: number | null) => {
      const cfgId = sessionId !== null ? configOfSession.get(sessionId) : undefined
      return (cfgId !== undefined ? branchOfConfigId.get(cfgId) : undefined) ?? 'unattributed'
    },
    brandOfProduct: resolveProductBrand,
    isExcludedProductName: (name: string) => isExcludedOdooEntity(name) || isNonCompanyCatalogItem(null, name),
    kuwaitDayOf: (dateOrderUtc: string | undefined) => odooUtcToKuwaitIso(dateOrderUtc)?.kuwaitDate ?? null,
  }
  const exactBrandAllocationOf = async (rowsRead: Promise<ExactBrandRows | null>) => {
    const rows = await rowsRead
    return rows ? allocateExactBrandRows(rows, brandScopeMapping) : null
  }
  const productIdsByBrandOf = (rows: { product_id: M2O }[]): Map<string, number[]> => {
    const byBrand = new Map<string, number[]>()
    for (const r of rows) {
      const pid = m2oId(r.product_id)
      const pName = m2oName(r.product_id) ?? ''
      if (pid === null || brandScopeMapping.isExcludedProductName(pName)) continue
      const bid = resolveProductBrand(pid, pName)
      if (bid) byBrand.set(bid, [...(byBrand.get(bid) ?? []), pid])
    }
    return byBrand
  }
  const brandOrderCountsOf = (b: { fromUtc: string; toUtc: string }, rows: { product_id: M2O }[]) =>
    countOrdersPerBrandWithin(executeOdooKw as OdooExecute, posOrderDomainOf(b, true), productIdsByBrandOf(rows), ACTIVE_BRAND_IDS)
  // The per-order rows were started with the main reads (step 3); only the counts start here.
  const [brandAllocationToday, brandAllocationWeek, brandOrders30, brandOrdersYear] = brandMetaFailed
    ? [null, null, null, null]
    : await Promise.all([
        exactBrandAllocationOf(exactBrandRowsToday),
        exactBrandAllocationOf(exactBrandRowsWeek),
        brandOrderCountsOf(boundsMonth, productLines30Rows),
        brandOrderCountsOf(boundsYear, productLinesYearRows),
      ])

  const buildLocAndUnmappedUiMap = (
    payRows: { sessionId: number | null; paymentMethodName: string; netKwd: number; orders: number }[],
  ) => {
    const folded = foldYearBranchChannels({
      payments: payRows.flatMap((p) => {
        const cfgId = p.sessionId !== null ? configOfSession.get(p.sessionId) : undefined
        if (cfgId !== undefined && decommissionedConfigIds.has(cfgId)) return []
        return [{ configId: cfgId ?? null, methodName: p.paymentMethodName, netKwd: p.netKwd, orders: p.orders }]
      }),
      branchOfConfig: (configId) => branchOfConfigId.get(configId) ?? null,
      isDeliveryConfig: isDeliveryPosConfigId,
      channelOf: resolveUiChannelHint,
      branchIds: ACTIVE_BRANCH_IDS,
      channelKeys: UI_CHANNEL_KEYS,
    })
    return { locMap: new Map(Object.entries(folded.byBranch)), unmappedUi: folded.unmapped }
  }

  const channelsMonthFailed = unavailableSectionSet.has('channels.month')
  const channelsWeekFailed = unavailableSectionSet.has('channels.week')
  const channelsTodayFailed = unavailableSectionSet.has('channels.today')
  const channelsYearFailed = unavailableSectionSet.has('channels.year')
  const yearTotalsFailed = unavailableSectionSet.has('year')

  const has30Payments =
    !channelsMonthFailed && mergedPayments30Rows.some((p) => p.netKwd !== 0 || p.orders > 0)
  const built30Ui = buildLocAndUnmappedUiMap(mergedPayments30Rows)
  const locUi30 = has30Payments ? built30Ui.locMap : pricelistUiHints30
  const unmappedUi30 = has30Payments ? built30Ui.unmappedUi : unmappedPricelistUiHints30

  const builtWeekUi = buildLocAndUnmappedUiMap(mergedPaymentsWeekRows)
  const builtTodayUi = buildLocAndUnmappedUiMap(mergedPaymentsTodayRows)
  const builtYearUi = buildLocAndUnmappedUiMap(mergedPaymentsYearRows)

  // 7. Build YTD bucket (`year`) strictly from live `ytdAggRows` (`session_id -> config_id`) without forced reconciliation
  const locYearNet = new Map<string, number>()
  const locYearOrd = new Map<string, number>()
  const registerYear = new Map<number, { net: number; orders: number }>()
  let unmappedYearNet = 0
  let unmappedYearOrd = 0
  for (const yrRow of mergedYtdSessionRows) {
    const sid = yrRow.sessionId
    const cfgId = sid !== null ? configOfSession.get(sid) : undefined
    if (cfgId !== undefined && decommissionedConfigIds.has(cfgId)) continue
    bumpAllowedRegister(registerYear, cfgId, yrRow.netKwd, yrRow.orders)
    const net = yrRow.netKwd
    const ord = yrRow.orders
    if (ord <= 0 && net === 0) continue
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
  const glAccountsFailed = unavailableSectionSet.has('gl.accounts')
  const liveTodayAccountingRaw =
    glAccountsFailed || unavailableSectionSet.has('gl.today')
      ? null
      : activeGlAccountIds.length > 0
        ? buildLedgerAccountingFromGroups({
            fromIso: todayBucketFrom,
            toInclusiveIso: todayInclusiveIso >= todayBucketFrom ? todayInclusiveIso : todayBucketFrom,
            accountById: activeGlAccountById,
            rows: glTodayRows,
          })
        : undefined
  const liveWeekAccountingRaw =
    glAccountsFailed || unavailableSectionSet.has('gl.week')
      ? null
      : activeGlAccountIds.length > 0
        ? buildLedgerAccountingFromGroups({
            fromIso: weekFromKwIso,
            toInclusiveIso: canonicalInclusiveIso,
            accountById: activeGlAccountById,
            rows: glWeekRows,
          })
        : undefined
  const liveMonthAccountingRaw =
    glAccountsFailed || unavailableSectionSet.has('gl.month')
      ? null
      : activeGlAccountIds.length > 0
        ? buildLedgerAccountingFromGroups({
            fromIso: monthFromKwIso,
            toInclusiveIso: canonicalInclusiveIso,
            accountById: activeGlAccountById,
            rows: glMonthRows,
          })
        : undefined
  const liveYearAccountingRaw =
    glAccountsFailed || unavailableSectionSet.has('gl.year')
      ? null
      : activeGlAccountIds.length > 0
        ? buildLedgerAccountingFromGroups({
            fromIso: yearFromKwIso,
            toInclusiveIso: canonicalInclusiveIso,
            accountById: activeGlAccountById,
            rows: glYearRows,
          })
        : undefined
  const glClosedThroughDate = glAccountsFailed ? null : await fetchGlClosedThroughDate(resolvedCompanyId)
  const liveTodayAccounting = withGlClosedThrough(liveTodayAccountingRaw, glClosedThroughDate)
  const liveWeekAccounting = withGlClosedThrough(liveWeekAccountingRaw, glClosedThroughDate)
  const liveMonthAccounting = withGlClosedThrough(liveMonthAccountingRaw, glClosedThroughDate)
  const liveYearAccounting = withGlClosedThrough(liveYearAccountingRaw, glClosedThroughDate)

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
    channelsUnavailable: channelsTodayFailed,
    brandAllocation: brandAllocationToday,
    registerRows: registerRowsFor(registerToday),
    brandsUnavailable: brandMetaFailed || unavailableSectionSet.has('brands.today'),
    excludedUnavailable: excludedMonthFailed,
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
    channelsUnavailable: channelsWeekFailed,
    brandAllocation: brandAllocationWeek,
    registerRows: registerRowsFor(registerWeek),
    brandsUnavailable: brandMetaFailed || unavailableSectionSet.has('brands.week'),
    excludedUnavailable: excludedMonthFailed,
  })

  const mtdDays = Math.max(
    1,
    Math.round(
      (Date.parse(`${anchorTomorrowKwIso}T00:00:00Z`) - Date.parse(`${mtdFromKwIso}T00:00:00Z`)) /
        86_400_000,
    ),
  )

  const monthBucket = buildReconciledBucket({
    key: 'month',
    from: monthFromKwIso,
    to: canonicalBucketToExclusive,
    days: mtdDays,
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
    channelsUnavailable: channelsMonthFailed,
    brandOrdersMap: brandOrders30,
    registerRows: registerRowsFor(registerMonth),
    brandsUnavailable: brandMetaFailed || unavailableSectionSet.has('brands.month'),
    excludedUnavailable: excludedMonthFailed,
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
    totalsUnavailable: yearTotalsFailed,
    channelsUnavailable: channelsYearFailed,
    brandOrdersMap: brandOrdersYear,
    registerRows: registerRowsFor(registerYear),
    brandsUnavailable: brandMetaFailed || unavailableSectionSet.has('brands.year'),
  })

  const sumDailyWindow = (fromIso: string, toIso: string) => {
    let net = 0
    let orders = 0
    for (const [day, value] of dailyMap) {
      if (day < fromIso || day > toIso) continue
      net += value.netKwd
      orders += value.orders
    }
    return { net: r3(net), orders }
  }
  const rolling30Totals = sumDailyWindow(rolling30FromKwIso, anchorDayKwIso)
  const prior30ToKwIso = shiftIsoDate(rolling30FromKwIso, -1)
  const prior30Totals = sumDailyWindow(prior30FromKwIso, prior30ToKwIso)

  const journeyPulse: OdooLiveSummary['journeyPulse'] = {
            rolling30: {
              from: rolling30FromKwIso,
              to: anchorDayKwIso,
              days: 30,
              netKwd: rolling30Totals.net,
              orders: rolling30Totals.orders,
              perDayKwd: r3(rolling30Totals.net / 30),
            },
            prior30: {
              from: prior30FromKwIso,
              to: prior30ToKwIso,
              days: 30,
              netKwd: prior30Totals.net,
              orders: prior30Totals.orders,
              perDayKwd: r3(prior30Totals.net / 30),
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
    ACTIVE_BRANCH_IDS.reduce((s, lid) => s + (locMonthNet.get(lid) ?? 0), 0),
  )
  const liveExcludedMonthNet = excludedMonthFailed ? null : r3(excludedMonthNet)
  const liveExcludedMonthOrd = excludedMonthFailed ? null : Math.round(excludedMonthOrd)
  const monthCompanyNet = monthBucket.totals.netSalesKwd ?? 0
  const monthCompanyOrd = monthBucket.totals.orders ?? 0
  const liveGrossPreExclusionNet =
    liveExcludedMonthNet === null ? null : r3(monthCompanyNet + liveExcludedMonthNet)
  const unavailableSections = [...unavailableSectionSet]
  const partial = unavailableSections.length > 0

  return {
    fetchedAtMs,
    connected: true,
    sourceMode: 'odoo17-live',
    envConfigured: true,
    odooCompanyId: resolvedCompanyId,
    diagnosticCode: partial ? 'PARTIAL_LIVE' : 'OK_LIVE',
    partial,
    unavailableSections,
    latestRecordAt: resolvedLatestRecordAt,
    latestOperationalDate: resolvedOperationalDate,
    todayOrdersCount: rawTodayOrdersCount,
    todaySalesKwd: rawTodaySalesKwd,
    companyTotals: {
      grossPreExclusionKwd: liveGrossPreExclusionNet,
      excludedEntitiesKwd: liveExcludedMonthNet,
      excludedEntitiesOrders: liveExcludedMonthOrd,
      mappedBranchesNetKwd: liveMappedBranchesNet,
      netSalesKwd: monthCompanyNet,
      orders: monthCompanyOrd,
      unmappedTerminalsNetKwd: r3(unmappedMonthNet),
      unmappedTerminalsOrders: Math.round(unmappedMonthOrd),
      reconciliationGapKwd: excludedMonthFailed ? null : 0,
      reconciledExact: !excludedMonthFailed,
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
    ...(stockTransfers !== undefined ? { stockTransfers } : {}),
    ...(aggregatorReceivables !== undefined ? { aggregatorReceivables } : {}),
    ...(journeyPulse !== undefined ? { journeyPulse } : {}),
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
  const bucketTotalsUnavailable =
    bkt.totals.restaurantNetKwd === null || bkt.totals.restaurantOrders === null
  const totalNet = bkt.totals.restaurantNetKwd ?? 0

  const brands =
    bucketTotalsUnavailable || bkt.byBrand === null
      ? null
      : ACTIVE_BRAND_IDS.map((bid) => {
          const nv = bkt.byBrand?.[bid]?.netKwd ?? 0
          return {
            id: bid,
            brand: REG.brands.find((b) => b.id === bid)?.en ?? bid,
            netKwd: nv,
            sharePct: pct1(nv, totalNet),
          }
        })
          .filter(
            (b) => b.netKwd > 0,
          )
          .sort((a, b) => b.netKwd - a.netKwd)

  const branchSource = bkt.mappedByLocation ?? bkt.byLocation
  const rawBranches = bucketTotalsUnavailable
    ? []
    : ACTIVE_BRANCH_IDS.map((lid) => {
        const nv = r3(branchSource?.[lid]?.netKwd ?? 0)
        const ord = Math.max(0, Math.round(branchSource?.[lid]?.orders ?? 0))
        return {
          id: lid,
          name:
            lid === SCHOOL_CANTEEN_BRANCH_ID
              ? 'School canteens'
              : (REG.locations[lid]?.en ?? lid),
          unit:
            lid === SCHOOL_CANTEEN_BRANCH_ID
              ? 'school-canteen'
              : lid === EXHIBITION_BRANCH_ID
                ? 'exhibition'
                : 'restaurant',
          netSalesKwd: nv,
          orders: ord,
        }
      })

  const branchSumNet = bucketTotalsUnavailable
    ? null
    : r3(rawBranches.reduce((acc, b) => acc + b.netSalesKwd, 0))
  const branchSumOrd = bucketTotalsUnavailable
    ? null
    : rawBranches.reduce((acc, b) => acc + b.orders, 0)
  const bktUnmappedNet = bucketTotalsUnavailable
    ? null
    : bkt.unmappedSummary && bkt.unmappedSummary.netSalesKwd !== null
      ? r3(bkt.unmappedSummary.netSalesKwd)
      : r3(bkt.unattributedSalesKwd ?? 0)
  const bktUnmappedOrd = bucketTotalsUnavailable
    ? null
    : bkt.unmappedSummary && bkt.unmappedSummary.orders !== null
      ? Math.max(0, Math.round(bkt.unmappedSummary.orders))
      : Math.max(0, Math.round(bkt.unattributedOrders ?? 0))
  const bucketCompanyNet =
    branchSumNet === null || bktUnmappedNet === null ? null : r3(branchSumNet + bktUnmappedNet)
  const bucketCompanyOrd =
    branchSumOrd === null || bktUnmappedOrd === null ? null : branchSumOrd + bktUnmappedOrd
  const excludedUnavailableForBucket =
    !options.customBucket &&
    bucketKey !== 'year' &&
    core.unavailableSections.includes('excluded.month')
  const bktExcludedNet: number | null = excludedUnavailableForBucket
    ? null
    : bkt.excludedSummary
      ? r3(Math.max(0, bkt.excludedSummary.netSalesKwd))
      : bucketKey === 'month' && !options.customBucket
        ? core.companyTotals.excludedEntitiesKwd === null
          ? null
          : r3(Math.max(0, core.companyTotals.excludedEntitiesKwd ?? 0))
        : 0
  const bktExcludedOrd: number | null = excludedUnavailableForBucket
    ? null
    : bkt.excludedSummary
      ? Math.max(0, Math.round(bkt.excludedSummary.orders))
      : bucketKey === 'month' && !options.customBucket
        ? core.companyTotals.excludedEntitiesOrders === null
          ? null
          : Math.max(0, Math.round(core.companyTotals.excludedEntitiesOrders ?? 0))
        : 0
  const bucketGrossPreExclusionNet: number | null =
    bucketCompanyNet === null || bktExcludedNet === null
      ? null
      : r3(bucketCompanyNet + bktExcludedNet)
  const bucketReconciliationGap: number | null =
    bucketCompanyNet === null ||
    branchSumNet === null ||
    bktUnmappedNet === null ||
    bucketGrossPreExclusionNet === null ||
    bktExcludedNet === null
      ? null
      : r3(
          Math.max(
            Math.abs(r3(bucketGrossPreExclusionNet - bktExcludedNet) - bucketCompanyNet),
            Math.abs(r3(branchSumNet + bktUnmappedNet) - bucketCompanyNet),
          ),
        )

  const branches = bucketTotalsUnavailable
    ? null
    : rawBranches
        .map((b) => ({
          ...b,
          sharePct: pct1(b.netSalesKwd, bucketCompanyNet !== null && bucketCompanyNet > 0 ? bucketCompanyNet : totalNet),
        }))
        .sort((a, b) => b.netSalesKwd - a.netSalesKwd)

  const channels =
    bkt.uiChannels === null
      ? null
      : UI_CHANNEL_KEYS.map((ck) => ({
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
  const periodHasNoData =
    !bucketTotalsUnavailable &&
    bucketCompanyOrd !== null &&
    bucketCompanyNet !== null &&
    bucketCompanyOrd <= 0 &&
    bucketCompanyNet <= 0
  const unattributedBranch: OdooUnattributedBranchRow | null = bucketTotalsUnavailable
    ? null
    : (bkt.unattributedBranch ?? {
        id: 'unattributed',
        labelAr: UNMAPPED_BUCKET_LABEL_AR,
        labelEn: UNMAPPED_BUCKET_LABEL_EN,
        netSalesKwd: bktUnmappedNet ?? 0,
        orders: bktUnmappedOrd ?? 0,
        sharePct: pct1(bktUnmappedNet ?? 0, bucketCompanyNet ?? 0),
      })

  const partial = core.partial
  const unavailableSections = [...core.unavailableSections]

  const summaryPayload: OdooLiveSummary = {
    source: 'live',
    connected: effectiveConnected,
    sourceMode: effectiveSourceMode,
    noData: periodHasNoData,
    partial,
    unavailableSections,
    ...(partial
      ? {
          warningAr: PARTIAL_ODOO_WARNING_AR,
          warningEn: PARTIAL_ODOO_WARNING_EN,
        }
      : {}),
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
    ...(core.stockTransfers !== undefined ? { stockTransfers: core.stockTransfers } : {}),
    ...(core.aggregatorReceivables !== undefined
      ? { aggregatorReceivables: core.aggregatorReceivables }
      : {}),
    ...(core.journeyPulse === null
      ? { journeyPulse: null }
      : core.journeyPulse
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
    partial,
    unavailableSections,
    ...(partial
      ? {
          warningAr: PARTIAL_ODOO_WARNING_AR,
          warningEn: PARTIAL_ODOO_WARNING_EN,
        }
      : {}),
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
  const brandOrdW = new Map<string, number | null>()
  for (const bid of ACTIVE_BRAND_IDS) {
    brandNetW.set(bid, cube.byBrand[bid]?.netKwd ?? 0)
    brandQtyW.set(bid, cube.byBrand[bid]?.qty ?? 0)
    brandOrdW.set(bid, cube.byBrand[bid]?.orders ?? null)
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
    clearOpenPeriodCubesOnly()
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
    const nowAfterPull = Date.now()
    const previousGood = lastKnownGoodIsFresh(lastKnownGoodSnapshot, nowAfterPull) ? lastKnownGoodSnapshot : null
    if (lastKnownGoodSnapshot && !previousGood) lastKnownGoodSnapshot = null
    if (freshCore.unavailableSections.length > 0 && previousGood) {
      coreSnapshotCache = previousGood
      const customBucket = isCustomPeriod
        ? await fetchLiveOdooCustomBucket(options?.customFrom, options?.customTo, nowAfterPull)
        : undefined
      return formatEnvelopeFromCore(previousGood, bucket, {
        readOnly,
        cached: true,
        referenceNowMs: nowAfterPull,
        customBucket,
      })
    }
    coreSnapshotCache = freshCore
    if (freshCore.unavailableSections.length === 0) lastKnownGoodSnapshot = freshCore
    consecutiveUpstreamFailures = 0
    circuitOpenUntilMs = 0

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
  ) as CompleteCubeByBranch
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

type PeriodHourlyRow = { hour: number; orders: number; netKwd: number }

const emptyHourRows = (): PeriodHourlyRow[] =>
  Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, netKwd: 0 }))

/**
 * Light hourly read: `pos.order` aggregated per hour server-side (`read_group` on
 * `date_order:hour`, tz Asia/Kuwait) for the given registers and period only — no per-session
 * grouping. Net = amount_total − amount_tax; orders = non-refund count (same rules as the cube).
 * Read-only.
 */
async function fetchHourlyRowsForConfigs(params: {
  fromUtc: string
  toExclusiveUtc: string
  companyId: number | null
  configIds: readonly number[]
}): Promise<PeriodHourlyRow[]> {
  if (params.configIds.length === 0) return emptyHourRows()
  const domainOf = (nonRefundOnly: boolean) =>
    buildPosOrderUtcDomain({
      fromUtc: params.fromUtc,
      toExclusiveUtc: params.toExclusiveUtc,
      companyId: params.companyId,
      configIds: params.configIds,
      nonRefundOnly,
    })
  const [netRows, countRows] = await Promise.all([
    executeOdooKw<HourGroupRow[]>(
      'pos.order',
      'read_group',
      [domainOf(false), ['amount_total:sum', 'amount_tax:sum'], ['date_order:hour']],
      { lazy: false, context: { tz: 'Asia/Kuwait' } },
    ),
    executeOdooKw<HourGroupRow[]>(
      'pos.order',
      'read_group',
      [domainOf(true), ['amount_total:sum'], ['date_order:hour']],
      { lazy: false, context: { tz: 'Asia/Kuwait' } },
    ),
  ])
  const acc = emptyHourRows()
  for (const row of mergeHourGroups(netRows, countRows)) {
    const conv = row.hourFromUtc ? odooUtcToKuwaitIso(row.hourFromUtc) : null
    if (!conv) continue
    acc[conv.kuwaitHour].netKwd += row.netKwd
    acc[conv.kuwaitHour].orders += row.orders
  }
  return acc.map((h) => ({ hour: h.hour, orders: Math.round(h.orders), netKwd: r3(h.netKwd) }))
}

/**
 * Company and per-branch hourly sections, each with its own failure handling so one failing read
 * never removes the other (and never the rest of the cube).
 */
async function fetchPeriodHourlySections(params: {
  fromUtc: string
  toExclusiveUtc: string
  companyId: number | null
  companyCfgList: readonly number[]
  cfgIdsByBranch: ReadonlyMap<(typeof ACTIVE_BRANCH_IDS)[number], readonly number[]>
  branchOfCfg: ReadonlyMap<number, (typeof ACTIVE_BRANCH_IDS)[number]>
}): Promise<{
  hourlySeries: PeriodHourlyRow[]
  hourlyByBranch: Record<string, PeriodHourlyRow[]>
  hourlyAvailable: boolean
  hourlyByBranchAvailable: boolean
}> {
  const base = { fromUtc: params.fromUtc, toExclusiveUtc: params.toExclusiveUtc, companyId: params.companyId }
  const unattributedCfgIds = params.companyCfgList.filter((id) => !params.branchOfCfg.has(id))
  const [company, branches] = await Promise.all([
    fetchHourlyRowsForConfigs({ ...base, configIds: params.companyCfgList }).then(
      (rows) => ({ ok: true as const, rows }),
      () => ({ ok: false as const, rows: [] as PeriodHourlyRow[] }),
    ),
    Promise.all([
      ...ACTIVE_BRANCH_IDS.map(async (lid) => [
        lid,
        await fetchHourlyRowsForConfigs({ ...base, configIds: params.cfgIdsByBranch.get(lid) ?? [] }),
      ] as const),
      fetchHourlyRowsForConfigs({ ...base, configIds: unattributedCfgIds }).then(
        (rows) => ['unattributed', rows] as const,
      ),
    ]).then(
      (pairs) => ({ ok: true as const, byBranch: Object.fromEntries(pairs) as Record<string, PeriodHourlyRow[]> }),
      () => ({ ok: false as const, byBranch: {} as Record<string, PeriodHourlyRow[]> }),
    ),
  ])
  return {
    hourlySeries: company.rows,
    hourlyByBranch: branches.byBranch,
    hourlyAvailable: company.ok,
    hourlyByBranchAvailable: branches.ok,
  }
}

export interface OdooPeriodHourly {
  connected: boolean
  available: boolean
  dateRange: { from: string; to: string }
  hourlySeries: PeriodHourlyRow[]
}

/**
 * Independent company-wide hourly read for a Kuwait period, used when the full period cube is
 * unavailable. Same register scope as the cube (classifyPeriodCubeConfigs). Read-only.
 */
export async function fetchLiveOdooPeriodHourly(
  fromKwIso: string,
  toKwIso: string,
  referenceNowMs = Date.now(),
): Promise<OdooPeriodHourly> {
  assertServerRuntime()
  const isoRe = /^\d{4}-\d{2}-\d{2}$/
  const fallbackToday = getKuwaitTodayIso(referenceNowMs)
  const rawFrom = isoRe.test(fromKwIso) ? fromKwIso : fallbackToday
  const rawTo = isoRe.test(toKwIso) ? toKwIso : rawFrom
  const clamped = clampPeriodToKuwaitToday(
    { from: rawFrom <= rawTo ? rawFrom : rawTo, to: rawFrom <= rawTo ? rawTo : rawFrom },
    referenceNowMs,
  )
  const dateRange = { from: clamped.from, to: clamped.to }
  const unavailable: OdooPeriodHourly = { connected: false, available: false, dateRange, hourlySeries: [] }
  if (!isOdooLiveEnvConfigured()) return unavailable
  try {
    await hydrateAdminPosTerminalMappings()
    const uid = await authenticateOdoo()
    const bounds = kuwaitDateBoundsToOdooUtc(dateRange.from, dateRange.to)
    const [allConfigs, userCompanyRows] = await Promise.all([
      fetchPosConfigsIncludingQurain(),
      safeSubQuery(
        () => executeOdooKw<{ id: number; company_id?: M2O }[]>('res.users', 'read', [[uid], ['id', 'company_id']]),
        [],
      ),
    ])
    const companyId =
      m2oId(userCompanyRows?.[0]?.company_id) ??
      m2oId(allConfigs.find((c) => m2oId(c.company_id) !== null)?.company_id) ??
      null
    const { companyCfgIds } = classifyPeriodCubeConfigs(allConfigs)
    const hourlySeries = await fetchHourlyRowsForConfigs({
      fromUtc: bounds.fromUtc,
      toExclusiveUtc: bounds.toExclusiveUtc,
      companyId,
      configIds: [...companyCfgIds],
    })
    return { connected: true, available: true, dateRange, hourlySeries }
  } catch {
    return unavailable
  }
}

type PeriodCubeConfigRow = { id: number; name: string; active?: boolean; company_id?: M2O; picking_type_id?: M2O }

/**
 * Classifies pos.config registers for a period cube: the active company whitelist (pinned school
 * canteens and Delivery (Qurain) ids 24 and 36 included; Jahra and other excluded ids stay out)
 * and the branch of each register. Shared by the cube and the independent hourly fetch so both use
 * exactly the same scope.
 */
function classifyPeriodCubeConfigs(allConfigs: readonly PeriodCubeConfigRow[]) {
  const decommCfgIds = new Set<number>()
  const companyCfgIds = new Set<number>()
  const branchOfCfg = new Map<number, (typeof ACTIVE_BRANCH_IDS)[number]>()
  const cfgIdsByBranch = new Map<(typeof ACTIVE_BRANCH_IDS)[number], number[]>()
  for (const lid of ACTIVE_BRANCH_IDS) {
    cfgIdsByBranch.set(lid, [])
  }
  const cfgNameMap = new Map<number, string>()
  for (const c of allConfigs) {
    const extra = `${m2oName(c.company_id) ?? ''} ${m2oName(c.picking_type_id) ?? ''}`.trim()
    const combined = `${c.name} ${extra}`.trim()
    cfgNameMap.set(c.id, combined)
    if (isQurainPosConfigId(c.id)) {
      companyCfgIds.add(c.id)
      continue
    }
    if (c.active === false) {
      const isGenuinelyDecommissioned =
        isExcludedRecordId('pos_config', c.id) ||
        (isPinnedSchoolCanteenConfigId(c.id)
          ? !companyPosConfigAllowed(c.id, c.name, true)
          : isDecommissionedWarehouseRecord(c.name))
      if (isGenuinelyDecommissioned) {
        decommCfgIds.add(c.id)
      }
      continue
    }
    if (isPinnedSchoolCanteenConfigId(c.id)) {
      if (!companyPosConfigAllowed(c.id, c.name, true)) {
        decommCfgIds.add(c.id)
        continue
      }
    } else {
      if (isExcludedRecordId('pos_config', c.id) || isDecommissionedWarehouseRecord(combined)) {
        decommCfgIds.add(c.id)
        continue
      }
      if (!companyPosConfigAllowed(c.id, c.name, true)) continue
    }
    companyCfgIds.add(c.id)
    const mb = resolveRestaurantBranchForConfig(c.id, c.name, extra)
    if (mb) {
      branchOfCfg.set(c.id, mb)
      cfgIdsByBranch.get(mb)!.push(c.id)
    }
  }
  if (allConfigs.length === 0) {
    for (const cfgId of [...new Set([...REG.allowedPosConfigIds, ...QURAIN_POS_CONFIG_IDS])]) {
      const knownName = cfgNameMap.get(cfgId) ?? ''
      if (decommCfgIds.has(cfgId) || !companyPosConfigAllowed(cfgId, knownName, true)) continue
      companyCfgIds.add(cfgId)
      if (!branchOfCfg.has(cfgId)) {
        const mb = resolveRestaurantBranchForConfig(cfgId, knownName)
        if (mb) {
          branchOfCfg.set(cfgId, mb)
          cfgIdsByBranch.get(mb)!.push(cfgId)
        }
      }
    }
  }
  return { decommCfgIds, companyCfgIds, branchOfCfg, cfgIdsByBranch, cfgNameMap }
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
  await hydrateAdminPosTerminalMappings()
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

  const cfg = readServerOdooConfig()
  if (!cfg) {
    return buildDisconnectedPeriodCube(dateRange)
  }

  const isClosedHistorical = dateRange.to < fallbackToday
  const cubeTtlMs = isClosedHistorical ? YEAR_CLOSED_TTL_MS : 5 * 60_000
  const cacheKey = `${configFingerprint(cfg)}|${dateRange.from}..${dateRange.to}`
  const l2CubeKey = `period_cube|${cacheKey}`
  const cached = periodCubeCache.get(cacheKey)
  if (cached && referenceNowMs - cached.cachedAtMs <= cubeTtlMs) {
    periodCubeCache.delete(cacheKey)
    periodCubeCache.set(cacheKey, cached)
    return cached.cube
  }

  const existingInflight = periodCubeInflight.get(cacheKey)
  if (existingInflight) {
    return existingInflight
  }

  const pendingCube = (async (): Promise<OdooPeriodCube> => {
    if (isClosedHistorical) {
      const persistedCubeEntry = await readYearClosedPersistentEntry<OdooPeriodCube>(
        l2CubeKey,
        referenceNowMs,
      )
      const persistedCube = persistedCubeEntry?.rows?.[0]
      if (persistedCube && persistedCube.connected) {
        if (periodCubeCache.has(cacheKey)) {
          periodCubeCache.delete(cacheKey)
        }
        periodCubeCache.set(cacheKey, {
          fetchedAtMs: Date.now(),
          cachedAtMs: persistedCubeEntry.at,
          cube: persistedCube,
          closedHistorical: true,
        })
        while (periodCubeCache.size > YEAR_CLOSED_MAX) {
          const oldest = periodCubeCache.keys().next().value
          if (oldest === undefined) break
          periodCubeCache.delete(oldest)
        }
        return persistedCube
      }
    }

  try {
    const uid = await authenticateOdoo()
    const bounds = kuwaitDateBoundsToOdooUtc(dateRange.from, dateRange.to)
    const cubeUtcWindow = { fromUtc: bounds.fromUtc, toUtc: bounds.toExclusiveUtc }
    const closedCubeDeadlineAtMs =
      isClosedHistorical && yearReadCall(cubeUtcWindow).timeout
        ? Date.now() + YEAR_CLOSED_READ_TIMEOUT_MS
        : undefined
    const closedCubeTimeout = () =>
      closedCubeDeadlineAtMs !== undefined
        ? yearReadCall(cubeUtcWindow, { deadlineAtMs: closedCubeDeadlineAtMs }).timeout
        : undefined
    const days = Math.max(
      1,
      Math.round(
        (Date.parse(`${dateRange.to}T00:00:00Z`) - Date.parse(`${dateRange.from}T00:00:00Z`)) /
          86_400_000,
      ) + 1,
    )

    const [allConfigs, posCategories, glAccountsRaw, userCompanyRows, latestOrderRows] =
      await Promise.all([
        fetchPosConfigsIncludingQurain(),
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

    const { decommCfgIds, companyCfgIds, branchOfCfg, cfgIdsByBranch, cfgNameMap } =
      classifyPeriodCubeConfigs(allConfigs)

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
        isExcludedRecordId('pos_category', c.id) ||
        isExcludedRecordId('pos_category', root?.id)
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

    const companyCfgList = [...companyCfgIds]
    const cubeOrderDomain = (nonRefundOnly = false): unknown[] =>
      companyCfgList.length > 0
        ? buildPosOrderUtcDomain({
            fromUtc: bounds.fromUtc,
            toExclusiveUtc: bounds.toExclusiveUtc,
            companyId: resolvedCompanyId,
            configIds: companyCfgList,
            nonRefundOnly,
          })
        : [['id', '=', 0]]
    const cubePaymentDomain = (nonRefundOnly = false): unknown[] =>
      companyCfgList.length > 0
        ? buildPosPaymentUtcDomain({
            fromUtc: bounds.fromUtc,
            toExclusiveUtc: bounds.toExclusiveUtc,
            companyId: resolvedCompanyId,
            configIds: companyCfgList,
            nonRefundOnly,
          })
        : [['id', '=', 0]]
    const cubeLineClause: unknown[] =
      companyCfgIds.size > 0
        ? posRegisterScopeClauses({
            companyId: resolvedCompanyId,
            configIds: companyCfgList,
            configField: 'order_id.session_id.config_id',
            companyField: 'company_id',
          })
        : [['id', '=', 0]]
    const exclLineDomain: unknown[] = [
      ...cubeLineClause,
      ...(excludedPosCatIds.size > 0
        ? [['product_id.pos_categ_id', 'not in', [...excludedPosCatIds]]]
        : []),
    ]

    // Hourly path runs on its own (separate RPCs, own failure handling): a slow or failed hourly
    // query no longer nulls the cube, and a failed core query no longer blocks hourly.
    const hourlySectionsPromise = fetchPeriodHourlySections({
      fromUtc: bounds.fromUtc,
      toExclusiveUtc: bounds.toExclusiveUtc,
      companyId: resolvedCompanyId,
      companyCfgList,
      cfgIdsByBranch,
      branchOfCfg,
    })

    type LineGroupRow = {
      product_id: M2O
      price_subtotal?: number
      qty?: number
      discount?: number
      __count?: number
    }

    const [
      dailyOrderRows,
      dailyOrderCountRows,
      paymentRows,
      paymentCountRows,
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
          cubeOrderDomain(false),
          ['amount_total:sum', 'amount_tax:sum'],
          ['session_id', 'pricelist_id', 'date_order:day'],
        ],
        { lazy: false, context: { tz: 'Asia/Kuwait' } },
        closedCubeTimeout(),
      ),
      executeOdooKw<
        {
          __count?: number
          session_id: M2O
          pricelist_id?: M2O
          __range?: { 'date_order:day'?: { from?: string; to?: string } }
        }[]
      >(
        'pos.order',
        'read_group',
        [
          cubeOrderDomain(true),
          ['amount_total:sum'],
          ['session_id', 'pricelist_id', 'date_order:day'],
        ],
        { lazy: false, context: { tz: 'Asia/Kuwait' } },
        closedCubeTimeout(),
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
          cubePaymentDomain(false),
          ['amount:sum'],
          ['session_id', 'payment_method_id'],
        ],
        { lazy: false },
        closedCubeTimeout(),
      ),
      executeOdooKw<
        {
          session_id: M2O
          payment_method_id: M2O
          __count?: number
        }[]
      >(
        'pos.payment',
        'read_group',
        [
          cubePaymentDomain(true),
          ['amount:sum'],
          ['session_id', 'payment_method_id'],
        ],
        { lazy: false },
        closedCubeTimeout(),
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
        closedCubeTimeout(),
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
            closedCubeTimeout(),
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
                closedCubeTimeout(),
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
                closedCubeTimeout(),
              ),
            [],
          )
        : Promise.resolve([]),
    ])

    // Per-branch `pos.order.line` read_group in 2 small waves of <=4 to preserve Odoo worker pool
    const unmappedCompanyCfgIds = [...companyCfgIds].filter((id) => !branchOfCfg.has(id))
    const allMappedAndDecommCfgIds = unmappedCompanyCfgIds
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
          ? [['order_id.session_id.config_id', 'in', allMappedAndDecommCfgIds]]
          : [['id', '=', 0]],
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
                closedCubeTimeout(),
              ),
            [],
          ),
        ),
      )
      for (let j = 0; j < wave.length; j++) {
        lineRowsByTarget.set(wave[j].key, waveResults[j])
      }
    }

    const mergedDailyOrderRows = mergeDaySessionPricelistGroups(dailyOrderRows, dailyOrderCountRows)
    const mergedPaymentRows = mergeSessionPaymentGroups(paymentRows, paymentCountRows)

    const allSessionIds = [
      ...new Set(
        [
          ...mergedDailyOrderRows.map((o) => o.sessionId),
          ...mergedPaymentRows.map((p) => p.sessionId),
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
      if (isExcludedOdooEntity(pName) || isNonCompanyCatalogItem(null, pName)) continue
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
    ) as CompleteCubeByBranch
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

    for (const row of mergedDailyOrderRows) {
      const rawFromUtc = row.dayFromUtc
      const conv = rawFromUtc ? odooUtcToKuwaitIso(rawFromUtc) : null
      const dayIso = conv?.kuwaitDate ?? dateRange.from
      const sid = row.sessionId
      const cid = sid !== null ? cfgOfSession.get(sid) : undefined
      if (cid !== undefined && decommCfgIds.has(cid)) continue

      const net = row.netKwd
      const ord = row.orders
      if (ord <= 0 && net === 0) continue

      const branch = cid !== undefined ? branchOfCfg.get(cid) : undefined
      const cfgNm = (cid !== undefined ? cfgNameMap.get(cid) : '') ?? ''
      const plNm = row.pricelistName

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
        const chKey = resolveUiChannelHint(`${plNm} ${cfgNm}`, isDeliveryPosConfigId(cid))
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

        const isDeliv = isDeliveryPosConfigId(cid)
        const chKey = resolveUiChannelHint(`${plNm} ${cfgNm}`, isDeliv)
        pricelistFallbackByBranch[branch][chKey].netKwd += net
        pricelistFallbackByBranch[branch][chKey].orders += ord
      }
      dailyTotalsMap.set(dayIso, dPrev)
    }

    // Note: `pos.payment` `read_group` `__count` counts payment lines rather than distinct
    // `pos.order` records, so split-tender orders (multiple tenders on one receipt) increment
    // each tender method's payment count. UI columns label this count as Payments accordingly.
    const hasPayments = mergedPaymentRows.some((p) => p.netKwd !== 0 || p.orders > 0)
    if (hasPayments) {
      for (const p of mergedPaymentRows) {
        const sid = p.sessionId
        const cid = sid !== null ? cfgOfSession.get(sid) : undefined
        if (cid !== undefined && decommCfgIds.has(cid)) continue
        const branch = cid !== undefined ? branchOfCfg.get(cid) : undefined
        const cfgNm = (cid !== undefined ? cfgNameMap.get(cid) : '') ?? ''
        const isDeliv = isDeliveryPosConfigId(cid)
        const chKey = resolveUiChannelHint(p.paymentMethodName, isDeliv)
        const amt = p.netKwd
        const cnt = p.orders
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

    const { hourlySeries, hourlyByBranch, hourlyAvailable, hourlyByBranchAvailable } =
      await hourlySectionsPromise

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
      const sub = signedKwd(dRow.price_subtotal)
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
      if (isExcludedOdooEntity(rawLabel) || isNonCompanyCatalogItem(null, rawLabel)) continue
      const meta = productMetaById.get(pid)
      const fallbackBid = resolveBrandHintFromText(rawLabel)
      const bid = (meta?.brandId ?? fallbackBid) as (typeof ACTIVE_BRAND_IDS)[number] | null
      if (!bid || !(ACTIVE_BRAND_IDS as readonly string[]).includes(bid)) continue

      const net = signedKwd(lRow.price_subtotal)
      const qty = signedKwd(lRow.qty)
      if (net === 0 && qty === 0) continue
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
    const cubeProductIdsByBrand = new Map<string, number[]>()
    for (const lRow of lineRowsAll) {
      const pid = m2oId(lRow.product_id)
      const bid = pid !== null ? productMetaById.get(pid)?.brandId : undefined
      if (pid !== null && bid) cubeProductIdsByBrand.set(bid, [...(cubeProductIdsByBrand.get(bid) ?? []), pid])
    }
    // Bounded: a slow count leaves brand orders unknown (—) instead of holding the route.
    const cubeBrandOrders = await countOrdersPerBrandWithin(
      executeOdooKw as OdooExecute,
      cubeOrderDomain(true),
      cubeProductIdsByBrand,
      ACTIVE_BRAND_IDS,
    )

    for (const bid of ACTIVE_BRAND_IDS) {
      const b = byBrand[bid]
      b.netKwd = r3(b.netKwd)
      b.qty = r3(b.qty)
      b.discountKwd = r3(b.discountKwd)
      b.avgDiscountPct =
        b.linesCount > 0
          ? Math.round(((brandDiscNumerator.get(bid) ?? 0) / b.linesCount) * 100) / 100
          : 0
      b.orders = cubeBrandOrders?.get(bid) ?? null
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
        if (isExcludedOdooEntity(rawLabel) || isNonCompanyCatalogItem(null, rawLabel)) continue
        const meta = productMetaById.get(pid)
        const fallbackBid = resolveBrandHintFromText(rawLabel)
        const bid = (meta?.brandId ?? fallbackBid) as (typeof ACTIVE_BRAND_IDS)[number] | null
        if (!bid || !(ACTIVE_BRAND_IDS as readonly string[]).includes(bid)) continue
        const net = signedKwd(r.price_subtotal)
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

    const accounting = withGlClosedThrough(
      activeAccIds.length > 0
        ? buildLedgerAccountingFromGroups({
            fromIso: dateRange.from,
            toInclusiveIso: dateRange.to,
            accountById: activeAccMap,
            rows: glRows,
          })
        : undefined,
      activeAccIds.length > 0 ? await fetchGlClosedThroughDate(resolvedCompanyId) : null,
    )

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
      hourlyAvailable,
      hourlyByBranchAvailable,
      topProducts: [...topProductsRaw].sort((a, b) => b.netKwd - a.netKwd).slice(0, 50),
      // Every product line group (not only the top 50) — server-side menu engineering needs the
      // low sellers too. Stripped from client responses (see live-comparison route).
      menuProducts: [...topProductsRaw].sort((a, b) => b.netKwd - a.netKwd || a.productId - b.productId),
      ...(accounting ? { accounting } : {}),
      posConfigIds: {
        companyId: resolvedCompanyId,
        configIdsByBranch: Object.fromEntries(
          [...cfgIdsByBranch.entries()].map(([branch, ids]) => [
            branch,
            [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))],
          ]),
        ),
        includedConfigIds: [...companyCfgIds].filter((id) => Number.isInteger(id) && id > 0),
        excludedConfigIds: [...decommCfgIds].filter((id) => Number.isInteger(id) && id > 0),
        excludedPosCategoryIds: [...excludedPosCatIds].filter((id) => Number.isInteger(id) && id > 0),
      },
    }

    if (periodCubeCache.has(cacheKey)) {
      periodCubeCache.delete(cacheKey)
    }
    periodCubeCache.set(cacheKey, {
      fetchedAtMs,
      cachedAtMs: referenceNowMs,
      cube,
      closedHistorical: isClosedHistorical,
    })
    while (periodCubeCache.size > YEAR_CLOSED_MAX) {
      const oldest = periodCubeCache.keys().next().value
      if (oldest === undefined) break
      periodCubeCache.delete(oldest)
    }
    if (isClosedHistorical) {
      await writeYearClosedPersistentEntry(l2CubeKey, {
        rows: [cube],
        at: referenceNowMs,
      })
    }
    return cube
  } catch {
    return buildDisconnectedPeriodCube(dateRange)
  }
  })().finally(() => {
    if (periodCubeInflight.get(cacheKey) === pendingCube) {
      periodCubeInflight.delete(cacheKey)
    }
  })

  periodCubeInflight.set(cacheKey, pendingCube)
  return pendingCube
}

const RESTAURANT_STOCK_BRANCHES = new Set<StockLocationBranchId>([
  '360-mall',
  'al-kout',
  'assima',
  'promenade',
  'avenues',
  'salmiya',
  'ardiya',
])

let stockLocationMapCache: { at: number; roots: ResolvedStockRoots } | null = null

function branchOfRestaurantConfig(configId: number): StockLocationBranchId | null {
  const loc = REG.registers[String(configId)]?.location
  if (!loc || !RESTAURANT_STOCK_BRANCHES.has(loc as StockLocationBranchId)) return null
  return loc as StockLocationBranchId
}

/** pos.config → picking type → warehouse lot and view. Cached for 24 hours. */
async function loadStockRoots(): Promise<ResolvedStockRoots> {
  const now = Date.now()
  if (stockLocationMapCache && now - stockLocationMapCache.at < STOCK_LOCATION_MAP_TTL_MS) {
    return stockLocationMapCache.roots
  }
  const branchOfConfig: Record<number, StockLocationBranchId> = {}
  for (const [id, row] of Object.entries(REG.registers)) {
    const branch = branchOfRestaurantConfig(Number(id))
    if (branch) branchOfConfig[Number(id)] = branch
  }
  const configIds = [
    ...new Set<number>([
      ...Object.keys(branchOfConfig).map(Number),
      ...JAHRA_POS_CONFIG_IDS,
      ...KITCHEN_SOURCE_POS_CONFIG_IDS,
    ]),
  ]
  try {
    const configs = await executeOdooKw<{ id: number; picking_type_id?: M2O }[]>(
      'pos.config',
      'search_read',
      [[['id', 'in', configIds]]],
      { fields: ['id', 'picking_type_id'], context: { active_test: false } },
    )
    const pickingIds = [...new Set(configs.map((row) => m2oId(row.picking_type_id)).filter((id): id is number => id !== null))]
    const pickingTypes = pickingIds.length
      ? await executeOdooKw<{ id: number; warehouse_id?: M2O }[]>(
          'stock.picking.type',
          'read',
          [pickingIds, ['id', 'warehouse_id']],
        )
      : []
    const warehouseIds = [...new Set(pickingTypes.map((row) => m2oId(row.warehouse_id)).filter((id): id is number => id !== null))]
    const warehouses = warehouseIds.length
      ? await executeOdooKw<{ id: number; lot_stock_id?: M2O; view_location_id?: M2O }[]>(
          'stock.warehouse',
          'read',
          [warehouseIds, ['id', 'lot_stock_id', 'view_location_id']],
        )
      : []
    const roots = stockRootsFromRegisterChain({
      branchOfConfig,
      configs: configs.map((row): RegisterPickingLink => ({
        configId: row.id,
        pickingTypeId: m2oId(row.picking_type_id),
      })),
      pickingTypes: pickingTypes.map((row) => ({
        pickingTypeId: row.id,
        warehouseId: m2oId(row.warehouse_id),
      })),
      warehouses: warehouses.map((row) => ({
        warehouseId: row.id,
        lotStockId: m2oId(row.lot_stock_id),
        viewLocationId: m2oId(row.view_location_id),
      })),
    })
    stockLocationMapCache = { at: now, roots }
    logger.info('stock.location ids resolved', {
      branchLocationIds: roots.branchById,
      kitchenLocationIds: roots.kitchenIds,
      excludedLocationIds: roots.excludedIds,
    })
    return roots
  } catch (err) {
    logger.warn('stock.location id resolution failed', errorFields(err))
    return emptyStockRoots()
  }
}

function resolveStockLocationRole(
  locationId: number,
  usage: string,
  parentPath: string | null,
  roots: ResolvedStockRoots,
): {
  excluded: boolean
  usage: string
  role: 'ck' | 'branch' | 'supplier' | 'customer' | 'scrap' | 'transit' | 'other'
  branchId: (typeof ACTIVE_BRANCH_IDS)[number] | null
} {
  if (usage === 'supplier') {
    return { excluded: false, usage, role: 'supplier', branchId: null }
  }
  if (usage === 'customer') {
    return { excluded: false, usage, role: 'customer', branchId: null }
  }
  if (usage === 'inventory') {
    return { excluded: false, usage, role: 'scrap', branchId: null }
  }
  if (usage === 'transit') {
    if (isExcludedStockLocation(locationId, parentPath, roots)) {
      return { excluded: true, usage, role: 'transit', branchId: null }
    }
    return { excluded: false, usage, role: 'transit', branchId: null }
  }
  if (usage === 'internal' || usage === 'view') {
    if (isExcludedStockLocation(locationId, parentPath, roots)) {
      return { excluded: true, usage, role: 'other', branchId: null }
    }
    if (isCentralKitchenStockLocation(locationId, parentPath, roots)) {
      return { excluded: false, usage, role: 'ck', branchId: null }
    }
    const branchId = branchIdForStockLocation(locationId, parentPath, roots)
    if (branchId) {
      return { excluded: false, usage, role: 'branch', branchId }
    }
    return { excluded: false, usage, role: 'other', branchId: null }
  }
  return { excluded: false, usage, role: 'other', branchId: null }
}

function isWarehouseTimeout(err: unknown): boolean {
  if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) return true
  const msg = err instanceof Error ? err.message : ''
  return /abort|timeout|timed out/i.test(msg)
}

/** A failed warehouse read. This is an error, never an empty period. */
export function warehouseChainErrorPayload(
  dateRange: { from: string; to: string },
  kind: 'timeout' | 'error',
): OdooLiveWarehouseChainPayload {
  const payload = buildDisconnectedWarehouseChain(dateRange, '')
  const timeout = kind === 'timeout'
  return {
    ...payload,
    connected: false,
    noData: false,
    fetchStatus: kind,
    messageAr: timeout ? 'انتهت مهلة جلب حركات المخزن من أودو' : 'تعذّر قراءة حركات المخزن من أودو',
    messageEn: timeout
      ? 'The warehouse request to Odoo timed out.'
      : 'Warehouse movements could not be read from Odoo.',
  }
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
  if (cached && referenceNowMs - cached.fetchedAtMs < 5 * 60_000) {
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
        executeOdooKw<{ id: number; name: string; complete_name?: string; usage: string; parent_path?: string | false }[]>(
          'stock.location',
          'search_read',
          // View rows are included so a move into a child of the branch (child_of / parent_path) stays on that branch.
          [[['usage', 'in', ['internal', 'view', 'transit', 'supplier', 'customer', 'inventory']]]],
          {
            fields: ['id', 'name', 'complete_name', 'usage', 'parent_path'],
            context: { active_test: false },
            limit: 2000,
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
        isExcludedRecordId('pos_category', c.id) ||
        isExcludedRecordId('pos_category', root.id)
      ) {
        excludedPosCatIds.add(c.id)
      }
    }

    const stockRoots = await loadStockRoots()
    const locationMeta = new Map<
      number,
      ReturnType<typeof resolveStockLocationRole> & { label: string }
    >()
    const excludedLocationIds: number[] = []
    for (const loc of locationsRaw) {
      const label = (loc.complete_name || loc.name || `Location #${loc.id}`).trim()
      const parentPath = typeof loc.parent_path === 'string' ? loc.parent_path : null
      const meta = resolveStockLocationRole(loc.id, loc.usage || 'other', parentPath, stockRoots)
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
        { timeoutMs: STOCK_READ_GROUP_TIMEOUT_MS, timeoutCapMs: STOCK_READ_GROUP_TIMEOUT_MS },
      ).catch(() =>
        executeOdooKw<
          {
            product_id: M2O
            location_id: M2O
            quantity?: number
            __count?: number
          }[]
        >(
          'stock.quant',
          'read_group',
          [quantDomain, ['quantity:sum'], ['product_id', 'location_id']],
          { lazy: false },
          { timeoutMs: STOCK_READ_GROUP_TIMEOUT_MS, timeoutCapMs: STOCK_READ_GROUP_TIMEOUT_MS },
        ),
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
        { timeoutMs: STOCK_READ_GROUP_TIMEOUT_MS, timeoutCapMs: STOCK_READ_GROUP_TIMEOUT_MS },
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
        { timeoutMs: STOCK_READ_GROUP_TIMEOUT_MS, timeoutCapMs: STOCK_READ_GROUP_TIMEOUT_MS },
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
                // standard_price is company-dependent: read it in the company's context.
                resolvedCompanyId !== null
                  ? { context: { allowed_company_ids: [resolvedCompanyId], company_id: resolvedCompanyId } }
                  : {},
              ),
            [],
          )
        : []

    // Cost fallbacks for products without a standard price (read-only).
    const standardPriceById = new Map(prodRecords.map((p) => [p.id, Number(p.standard_price) || 0]))
    const uncostedIds = allProdIds.filter((pid) => !((standardPriceById.get(pid) ?? 0) > 0))
    const [layerGroups, purchaseGroups] = await Promise.all([
      uncostedIds.length > 0
        ? safeSubQuery(
            () =>
              executeOdooKw<{ product_id: M2O; value?: number; quantity?: number }[]>(
                'stock.valuation.layer',
                'read_group',
                [[...companyDomain, ['product_id', 'in', uncostedIds]], ['value:sum', 'quantity:sum'], ['product_id']],
                { lazy: false },
              ),
            [],
          )
        : Promise.resolve([] as { product_id: M2O; value?: number; quantity?: number }[]),
      uncostedIds.length > 0
        ? safeSubQuery(
            () =>
              executeOdooKw<{ product_id: M2O; price_subtotal?: number; product_uom_qty?: number }[]>(
                'purchase.order.line',
                'read_group',
                [
                  [...companyDomain, ['product_id', 'in', uncostedIds], ['state', 'in', ['purchase', 'done']]],
                  ['price_subtotal:sum', 'product_uom_qty:sum'],
                  ['product_id'],
                ],
                { lazy: false },
              ),
            [],
          )
        : Promise.resolve([] as { product_id: M2O; price_subtotal?: number; product_uom_qty?: number }[]),
    ])
    const productCosts = resolveProductCosts(allProdIds, {
      standardPrice: standardPriceById,
      valuationLayer: new Map(
        layerGroups
          .map((g) => [m2oId(g.product_id), { value: Number(g.value) || 0, quantity: Number(g.quantity) || 0 }] as const)
          .filter((e): e is [number, { value: number; quantity: number }] => e[0] !== null),
      ),
      purchase: new Map(
        purchaseGroups
          .map((g) => [m2oId(g.product_id), { subtotal: Number(g.price_subtotal) || 0, quantity: Number(g.product_uom_qty) || 0 }] as const)
          .filter((e): e is [number, { subtotal: number; quantity: number }] => e[0] !== null),
      ),
    })

    const prodInfoById = new Map<
      number,
      {
        name: string
        skuCode: string
        unitCostKwd: number
        costKnown: boolean
        costSource: CostSource | null
        categoryName: string
        uomName: string
        excluded: boolean
      }
    >()
    for (const p of prodRecords) {
      const posCatId = m2oId(p.pos_categ_id)
      const nm = (p.name || `Product #${p.id}`).trim()
      const skuCode =
        typeof p.default_code === 'string' && p.default_code.trim()
          ? p.default_code.trim()
          : `ODOO-${p.id}`
      const catNm = m2oName(p.categ_id) ?? 'General'
      const excluded =
        (posCatId !== null && excludedPosCatIds.has(posCatId)) ||
        isExcludedOdooEntity(nm) ||
        isExcludedOdooEntity(catNm) ||
        isNonCompanyCatalogItem(skuCode, nm)
      prodInfoById.set(p.id, {
        name: nm,
        skuCode,
        unitCostKwd: productCosts.get(p.id)?.unitCostKwd ?? 0,
        costKnown: productCosts.has(p.id),
        costSource: productCosts.get(p.id)?.source ?? null,
        categoryName: catNm,
        uomName: m2oName(p.uom_id) ?? 'Unit',
        excluded,
      })
    }

    const productAgg = new Map<number, OdooLiveWarehouseProductRow>()
    const ensureProdRow = (pid: number, fallbackLabel: string): OdooLiveWarehouseProductRow | null => {
      const meta = prodInfoById.get(pid)
      if (
        meta?.excluded ||
        isExcludedOdooEntity(fallbackLabel) ||
        isNonCompanyCatalogItem(meta?.skuCode ?? null, fallbackLabel)
      ) {
        return null
      }
      let row = productAgg.get(pid)
      if (!row) {
        row = {
          productId: pid,
          skuCode: meta?.skuCode ?? `ODOO-${pid}`,
          name: meta?.name ?? (fallbackLabel || `Product #${pid}`),
          categoryName: meta?.categoryName ?? 'General',
          uomName: meta?.uomName ?? 'Unit',
          unitCostKwd: r3(meta?.unitCostKwd ?? 0),
          costKnown: meta?.costKnown ?? false,
          costSource: meta?.costSource ?? null,
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

    const onHandCoverage = new CoverageCounter()
    const movesCoverage = new CoverageCounter()
    const scrapCoverage = new CoverageCounter()
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
      const quantValue = quantHasValueField && typeof (q as { value?: number }).value === 'number'
      onHandCoverage.add(qty, quantValue || pRow.costKnown === true)
      const val = quantValue ? Number((q as { value?: number }).value) || 0 : qty * pRow.unitCostKwd
      quantsCount += Math.max(0, Number(q.__count) || 0)
      currentOnHandQty += qty
      currentOnHandValueKwd += val
      pRow.onHandQty += qty
      pRow.onHandValueKwd += val

      if (loc?.role === 'branch' && loc.branchId) {
        branchesOnHandValueKwd += val
        byBranchOnHand[loc.branchId].qty = r3(byBranchOnHand[loc.branchId].qty + qty)
        byBranchOnHand[loc.branchId].valueKwd = r3(byBranchOnHand[loc.branchId].valueKwd + val)
      } else if (loc?.role === 'ck') {
        ckOnHandValueKwd += val
      }
    }

    const endpoint = (locationId: number | null) => {
      if (locationId === null) return undefined
      const loc = locationMeta.get(locationId)
      if (!loc) return undefined
      return {
        role: loc.role,
        branchId: loc.branchId,
        excluded: loc.excluded,
        locationId,
      }
    }
    const classifyMoveFlow = (srcLocId: number | null, dstLocId: number | null) =>
      classifyWarehouseMove(endpoint(srcLocId), endpoint(dstLocId))

    let inboundSupplierKwd = 0
    let ckToBranchTransferKwd = 0
    let posConsumptionKwd = 0
    let doneMovesCount = 0

    const productMoves: {
      flow: ReturnType<typeof classifyMoveFlow>
      pRow: NonNullable<ReturnType<typeof ensureProdRow>>
      qty: number
      valKwd: number
      count: number
    }[] = []
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
      const count = Math.max(0, Number(m.__count) || 0)
      doneMovesCount += count
      productMoves.push({ flow, pRow, qty, valKwd, count })
    }
    const countedProductTransfers = new Set(kitchenTransfersToCount(productMoves.map((row) => row.flow)))
    for (const row of productMoves) {
      const countedTransfer = countedProductTransfers.has(row.flow)
      if (row.flow.kind === 'internal_other' || row.flow.kind === 'transit_out' || (row.flow.kind === 'transit_in' && !countedTransfer)) {
        continue
      }
      if (row.flow.kind === 'inbound' || countedTransfer || row.flow.kind === 'consumption') {
        movesCoverage.add(row.qty, row.pRow.costKnown === true)
      }
      if (row.flow.kind === 'inbound') {
        inboundSupplierKwd += row.valKwd
        row.pRow.inboundQty += row.qty
        row.pRow.inboundValueKwd += row.valKwd
      } else if (countedTransfer) {
        ckToBranchTransferKwd += row.valKwd
        row.pRow.transferQty += row.qty
        row.pRow.transferValueKwd += row.valKwd
      } else if (row.flow.kind === 'consumption') {
        posConsumptionKwd += row.valKwd
        row.pRow.consumedQty += row.qty
        row.pRow.consumedValueKwd += row.valKwd
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
            receivedFromCkMoves: 0,
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

    const dayMoves: {
      flow: ReturnType<typeof classifyMoveFlow>
      day: string
      qty: number
      valKwd: number
      count: number
    }[] = []
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
      dayMoves.push({
        flow,
        day: conv.kuwaitDate,
        qty,
        valKwd: qty * (pMeta?.unitCostKwd ?? 0),
        count: Math.max(0, Number(md.__count) || (qty > 0 ? 1 : 0)),
      })
    }
    const countedDayTransfers = new Set(kitchenTransfersToCount(dayMoves.map((row) => row.flow)))
    for (const row of dayMoves) {
      const dRow = ensureDayRow(row.day)
      dRow.movesCount += row.count
      const countedTransfer = countedDayTransfers.has(row.flow)
      if (row.flow.kind === 'inbound') {
        dRow.inboundSupplierKwd += row.valKwd
        dRow.inboundSupplierQty += row.qty
      } else if (countedTransfer) {
        dRow.ckToBranchTransferKwd += row.valKwd
        dRow.ckToBranchTransferQty += row.qty
        const branchMove = row.flow.branchId ? dRow.byBranch[row.flow.branchId] : undefined
        if (branchMove) {
          branchMove.receivedFromCkKwd += row.valKwd
          branchMove.receivedFromCkQty += row.qty
          branchMove.receivedFromCkMoves = (branchMove.receivedFromCkMoves ?? 0) + row.count
        }
      } else if (row.flow.kind === 'consumption') {
        dRow.posConsumptionKwd += row.valKwd
        dRow.posConsumptionQty += row.qty
        if (row.flow.branchId && dRow.byBranch[row.flow.branchId]) {
          dRow.byBranch[row.flow.branchId].consumedKwd += row.valKwd
          dRow.byBranch[row.flow.branchId].consumedQty += row.qty
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
      scrapCoverage.add(sQty, pRow.costKnown === true)

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
            receivedFromCkMoves: Math.max(0, Math.round(b?.receivedFromCkMoves ?? 0)),
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
      valuation: {
        costedProducts: products.filter((p) => p.costKnown).length,
        uncostedProducts: products.filter((p) => !p.costKnown).length,
        sources: {
          standard_price: products.filter((p) => p.costSource === 'standard_price').length,
          valuation_layer: products.filter((p) => p.costSource === 'valuation_layer').length,
          purchase_price: products.filter((p) => p.costSource === 'purchase_price').length,
        },
        onHandCoveragePct: onHandCoverage.pct(),
        movesCoveragePct: movesCoverage.pct(),
        scrapCoveragePct: scrapCoverage.pct(),
        onHandValued: onHandCoverage.valued(),
        movesValued: movesCoverage.valued(),
        scrapValued: scrapCoverage.valued(),
      },
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
  } catch (err) {
    const kind = isWarehouseTimeout(err) ? 'timeout' : 'error'
    const redacted = redactOdooSecrets(err instanceof Error ? `${err.name}: ${err.message}` : 'warehouse chain query failed')
    console.error('[warehouse-chain]', kind, redacted)
    return warehouseChainErrorPayload(dateRange, kind)
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
      if (
        isDecommissionedWarehouseRecord(`${pName} ${vName}`) ||
        isExcludedOdooEntity(pName) ||
        isNonCompanyCatalogItem(null, pName)
      ) {
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
      const sub = signedKwd(ln.price_subtotal)
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

export interface OdooProductCostsPayload {
  connected: boolean
  /** productId → unit cost and the Odoo source it came from; products without a cost are absent. */
  costs: Record<number, { unitCostKwd: number; source: CostSource }>
  requested: number
  lastSyncAt: string | null
}

/**
 * Read-only unit cost for the given products (menu engineering): `product.product.standard_price`
 * in the company context, then valuation layers, then confirmed purchase lines — the same chain
 * as the warehouse chain. A product with no cost in Odoo is left out (never a 0.000 cost).
 */
export async function fetchLiveOdooProductCosts(productIds: readonly number[]): Promise<OdooProductCostsPayload> {
  assertServerRuntime()
  const ids = [...new Set(productIds.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 2000)
  const empty: OdooProductCostsPayload = { connected: false, costs: {}, requested: ids.length, lastSyncAt: null }
  if (!isOdooLiveEnvConfigured() || ids.length === 0) return empty
  try {
    const uid = await authenticateOdoo()
    const userRows = await safeSubQuery(
      () => executeOdooKw<{ id: number; company_id?: M2O }[]>('res.users', 'read', [[uid], ['id', 'company_id']]),
      [],
    )
    const companyId = m2oId(userRows?.[0]?.company_id) ?? null
    const companyDomain: unknown[][] = companyId !== null ? [['company_id', '=', companyId]] : []
    const prods = await safeSubQuery(
      () =>
        executeOdooKw<{ id: number; standard_price?: number }[]>(
          'product.product',
          'read',
          [ids, ['id', 'standard_price']],
          companyId !== null ? { context: { allowed_company_ids: [companyId], company_id: companyId } } : {},
        ),
      [],
    )
    const standardPrice = new Map(prods.map((p) => [p.id, Number(p.standard_price) || 0]))
    const uncosted = ids.filter((pid) => !((standardPrice.get(pid) ?? 0) > 0))
    const [layers, purchases] = await Promise.all([
      uncosted.length > 0
        ? safeSubQuery(
            () =>
              executeOdooKw<{ product_id: M2O; value?: number; quantity?: number }[]>(
                'stock.valuation.layer',
                'read_group',
                [[...companyDomain, ['product_id', 'in', uncosted]], ['value:sum', 'quantity:sum'], ['product_id']],
                { lazy: false },
              ),
            [],
          )
        : Promise.resolve([] as { product_id: M2O; value?: number; quantity?: number }[]),
      uncosted.length > 0
        ? safeSubQuery(
            () =>
              executeOdooKw<{ product_id: M2O; price_subtotal?: number; product_uom_qty?: number }[]>(
                'purchase.order.line',
                'read_group',
                [[...companyDomain, ['product_id', 'in', uncosted], ['state', 'in', ['purchase', 'done']]], ['price_subtotal:sum', 'product_uom_qty:sum'], ['product_id']],
                { lazy: false },
              ),
            [],
          )
        : Promise.resolve([] as { product_id: M2O; price_subtotal?: number; product_uom_qty?: number }[]),
    ])
    const resolved = resolveProductCosts(ids, {
      standardPrice,
      valuationLayer: new Map(
        layers
          .map((g) => [m2oId(g.product_id), { value: Number(g.value) || 0, quantity: Number(g.quantity) || 0 }] as const)
          .filter((e): e is [number, { value: number; quantity: number }] => e[0] !== null),
      ),
      purchase: new Map(
        purchases
          .map((g) => [m2oId(g.product_id), { subtotal: Number(g.price_subtotal) || 0, quantity: Number(g.product_uom_qty) || 0 }] as const)
          .filter((e): e is [number, { subtotal: number; quantity: number }] => e[0] !== null),
      ),
    })
    const costs: OdooProductCostsPayload['costs'] = {}
    for (const [pid, c] of resolved) costs[pid] = { unitCostKwd: Math.round(c.unitCostKwd * 1000) / 1000, source: c.source }
    return { connected: true, costs, requested: ids.length, lastSyncAt: new Date().toISOString() }
  } catch {
    return empty
  }
}
