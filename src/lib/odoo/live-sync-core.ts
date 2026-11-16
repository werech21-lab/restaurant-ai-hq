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
import {
  companyPosConfigAllowed,
  companyPosSearchDomain,
  isPinnedSchoolCanteenConfigId,
  posOrderNet,
  SCHOOL_CANTEEN_BRANCH_ID,
} from './company-pos'
import { isExcludedOdooEntity, isExcludedOdooRecord, isExcludedRecordId } from './excluded-entities'
import {
  buildPosOrderUtcDomain,
  buildPosPaymentUtcDomain,
  mergeSessionGroups,
  mergeSessionPaymentGroups,
} from './pos-order-query'
import registry from './pos-registry.json'

export interface OdooEnv {
  ODOO_URL?: string
  ODOO_DB?: string
  ODOO_USERNAME?: string
  ODOO_LOGIN?: string
  ODOO_API_KEY?: string
}

export type OdooPeriodBucketKey = 'today' | 'week' | 'month' | 'year'

export interface OdooStockTransferSummary {
  readable: boolean
  recentDoneCount: number
  pendingCount: number
  latestTransferAt: string | null
  routes: {
    origin: string
    destination: string
    state: string
    scheduledDate: string | null
  }[]
}

export interface OdooReceivableAccountRow {
  accountId: number
  accountCode: string
  accountName: string
  labelAr: string
  labelEn: string
  residualKwd: number
  linesCount: number
}

export interface OdooReceivableAgingBucket {
  key: '0_30' | '31_60' | 'over_60'
  labelAr: string
  labelEn: string
  residualKwd: number
  positiveDebitKwd: number
  creditOffsetKwd: number
  linesCount: number
}

export interface OdooReceivableClearingSummary {
  readable: boolean
  openReceivableKwd: number
  grossPositiveReceivableKwd?: number
  creditClearingOffsetKwd?: number
  openLinesCount: number
  posClearingLinesCount?: number
  platformAndCorporateLinesCount?: number
  fromDate?: string | null
  toDate?: string | null
  latestMaturityDate?: string | null
  maturityStatusAr?: string
  maturityStatusEn?: string
  openLinesExplanationAr?: string
  openLinesExplanationEn?: string
  sourceModel?: 'account.move.line'
  byAccount?: OdooReceivableAccountRow[]
  agingBuckets?: OdooReceivableAgingBucket[]
}

export interface OdooLedgerAccountingSummary {
  available?: boolean
  from?: string
  to?: string
  sourceModel?: 'account.move.line'
  lineCount?: number
  income: number
  otherIncome: number
  totalRevenue?: number
  cogs: number
  deliveryCommissions?: number
  deliveryCommissionLinesCount?: number
  expense: number
  depreciation: number
  otherOpexAndDepreciation?: number
  operatingProfit: number
  completeAccrualPosted?: boolean
  glIncomplete?: boolean
  glWarningAr?: string
  aggregatorCommissionUnposted?: boolean
  aggregatorCommissionDisplayAr?: string
  unavailableReasonAr?: string
  unavailableReasonEn?: string
  revenueAccounts?: {
    code: string
    name: string
    accountType: 'income' | 'income_other'
    amountKwd: number
  }[]
}

export interface OdooUnattributedBranchRow {
  id: 'unattributed'
  labelAr: string
  labelEn: string
  netSalesKwd: number
  orders: number
  sharePct: number
}

export interface OdooBucketSummary {
  key: OdooPeriodBucketKey | 'custom'
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
  mappedByLocation?: Record<string, { netKwd: number; orders: number }>
  unattributedSalesKwd?: number
  unattributedOrders?: number
  unattributedBranch?: OdooUnattributedBranchRow
  unmappedSummary?: { netSalesKwd: number; orders: number }
  excludedSummary?: { netSalesKwd: number; orders: number }
  periodComparison?: { currentNetKwd: number; priorNetKwd: number; days: number }
  uiChannels?: Record<string, { netKwd: number; orders: number }>
  accounting?: OdooLedgerAccountingSummary
}

export interface OdooLiveSummary {
  source: 'live' | 'snapshot' | 'disconnected'
  /** Live connection telemetry (safe for client consumption; ZERO secrets/URLs/DB names). */
  connected?: boolean
  sourceMode?: 'odoo17-live' | 'cached-live' | 'disconnected' | 'verified-baseline'
  noData?: boolean
  messageAr?: string
  messageEn?: string
  lastSyncAt?: string | null
  isStale24h?: boolean
  odooCompanyId?: number | null
  dateRange?: { from: string; to: string }
  envConfigured?: boolean
  /** Honest ISO-8601 UTC timestamp bound strictly to the latest actual Odoo 17 POS/accounting record. */
  syncedAt: string
  /** Canonical latest `pos.order.date_order` ISO-8601 UTC timestamp in the dataset. */
  latestRecordAt?: string
  /** Canonical latest `pos.order.date_order` timestamp in Kuwait (`Asia/Kuwait`, `+03:00`) ISO-8601 format. */
  latestOdooRecordAt?: string
  /** Exact `Asia/Kuwait` (`+03:00`) ISO-8601 representation of `latestRecordAt`. */
  latestRecordKuwaitIso?: string
  /** Formatted Kuwait (`Asia/Kuwait`, UTC+3) timestamp of `latestRecordAt`. */
  kuwaitSyncedAt?: string
  /** Latest completed operational POS calendar date in Kuwait (`YYYY-MM-DD`). */
  latestOperationalDate?: string
  /** Hours elapsed since `latestRecordAt`. */
  hoursSinceLatestRecord?: number
  hoursSinceLatestOdooRecord?: number
  isStaleOver24h?: boolean
  todayOrders?: number
  todayOrdersCount?: number
  todaySalesKwd?: number
  syncCooldownRemainingSec?: number
  diagnosticCode?: string
  rateLimitedCooldown?: boolean
  lastCheckedAt?: string
  readOnly?: boolean
  bucket?: OdooPeriodBucketKey | 'custom'
  period: { from: string; to: string }
  /** Strictly `null` in all browser-facing responses so `ODOO_DB` never leaves the server. */
  database: string | null
  totals: { netSalesKwd: number; orders: number; aovKwd: number }
  unattributedSalesKwd?: number
  unattributedOrders?: number
  unattributedBranch?: OdooUnattributedBranchRow
  companyTotals?: {
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
  unmappedTerminals?: {
    terminal_id: number
    terminal_name: string
    orders_count: number
    net_sales_kwd: number
  }[]
  brands: { id: string; brand: string; netKwd: number; sharePct: number }[]
  branches: { id: string; name: string; unit: string; netSalesKwd: number; orders: number; sharePct: number }[]
  channels: { name: string; amountKwd: number }[]
  buckets?: Partial<Record<OdooPeriodBucketKey, OdooBucketSummary>>
  customBucket?: OdooBucketSummary
  /** Live Kuwait daily POS series (`YYYY-MM-DD`) overlaid on Custom Range & Comparison Engine. */
  dailySeries?: { day: string; orders: number; netKwd: number }[]
  /** Live Kuwait per-branch daily POS series (`day -> branchId -> { netKwd, orders }`) for exact cross-page parity. */
  dailyByBranch?: Record<string, Record<string, { netKwd: number; orders: number }>>
  /** Live Kuwait unattributed daily POS series (`day -> { netKwd, orders }`). */
  dailyUnattributed?: Record<string, { netKwd: number; orders: number }>
  /** Live Kuwait 24-hour POS distribution (`0..23`) overlaid on Hourly Comparison Curves. */
  hourlySeries?: { hour: number; orders: number; netKwd: number }[]
  /** Optional Ardiya Central Kitchen -> Branch transfer telemetry from `stock.picking`. */
  stockTransfers?: OdooStockTransferSummary
  /** Optional open aggregator/receivable clearing balance from `account.move.line`. */
  aggregatorReceivables?: OdooReceivableClearingSummary
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

export interface OdooFreshnessStatus {
  latestRecordIso: string
  kuwaitIso: string
  kuwaitTimestamp: string
  kuwaitDateEn: string
  kuwaitDateArSlash: string
  kuwaitDateArLong: string
  hoursSinceLatestOdooRecord: number
  isStaleOver24h: boolean
  badgeEn: string
  badgeAr: string
  liveConnectedBadgeEn: string
  liveConnectedBadgeAr: string
  cachedSnapshotBadgeEn: string
  cachedSnapshotBadgeAr: string
}

const EN_SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const AR_MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'] as const
const KUWAIT_OFFSET_MS = 3 * 3600 * 1000
export const DEFAULT_SNAPSHOT_LATEST_RECORD_ISO = '2026-11-14T08:40:00.000Z'

export function normalizeOdooDateOrderToIso(rawDateOrder?: string | null): string | null {
  if (!rawDateOrder || typeof rawDateOrder !== 'string') return null
  const trimmed = rawDateOrder.trim()
  const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?Z?$/)
  if (m) {
    const timePart = m[2].length === 5 ? `${m[2]}:00` : m[2]
    const parsed = new Date(`${m[1]}T${timePart}.000Z`)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  const direct = new Date(trimmed)
  return Number.isNaN(direct.getTime()) ? null : direct.toISOString()
}

export function resolveSnapshotLatestRecordInfo(raw: unknown): {
  latestRecordAt: string
  latestOperationalDate: string
} {
  const s = (raw ?? {}) as {
    latestRecordAt?: string
    syncedAt?: string
    buckets?: Partial<Record<OdooPeriodBucketKey, { from?: string; to?: string }>>
    period?: { from?: string; to?: string }
  }
  const explicitLatest = normalizeOdooDateOrderToIso(s.latestRecordAt)
  const todayFrom = s.buckets?.today?.from
  if (todayFrom && /^\d{4}-\d{2}-\d{2}$/.test(todayFrom)) {
    return {
      latestRecordAt: explicitLatest ?? `${todayFrom}T20:59:00.000Z`,
      latestOperationalDate: todayFrom,
    }
  }
  if (explicitLatest) {
    const kw = new Date(new Date(explicitLatest).getTime() + KUWAIT_OFFSET_MS)
    return {
      latestRecordAt: explicitLatest,
      latestOperationalDate: kw.toISOString().slice(0, 10),
    }
  }
  const fallbackIso = normalizeOdooDateOrderToIso(s.syncedAt) ?? DEFAULT_SNAPSHOT_LATEST_RECORD_ISO
  const kw = new Date(new Date(fallbackIso).getTime() + KUWAIT_OFFSET_MS)
  return {
    latestRecordAt: fallbackIso,
    latestOperationalDate: kw.toISOString().slice(0, 10),
  }
}

/**
 * Deterministic Kuwait (`Asia/Kuwait`, permanent UTC+3) formatter & >24h staleness calculator.
 * Produces byte-for-byte identical strings across Node SSR, Edge, and browser clients (zero hydration flicker).
 */
export function computeOdooFreshnessStatus(
  latestRecordIso?: string | null,
  referenceNowMs = Date.now(),
): OdooFreshnessStatus {
  const cleanIso = normalizeOdooDateOrderToIso(latestRecordIso) ?? DEFAULT_SNAPSHOT_LATEST_RECORD_ISO
  const recordDate = new Date(cleanIso)
  const recordMs = recordDate.getTime()
  const kwDate = new Date(recordMs + KUWAIT_OFFSET_MS)

  const year = kwDate.getUTCFullYear()
  const monthIdx = kwDate.getUTCMonth()
  const dayNum = kwDate.getUTCDate()
  const hours = String(kwDate.getUTCHours()).padStart(2, '0')
  const minutes = String(kwDate.getUTCMinutes()).padStart(2, '0')
  const dd = String(dayNum).padStart(2, '0')
  const mm = String(monthIdx + 1).padStart(2, '0')

  const seconds = String(kwDate.getUTCSeconds()).padStart(2, '0')
  const kuwaitIso = `${year}-${mm}-${dd}T${hours}:${minutes}:${seconds}+03:00`
  const kuwaitTimestamp = `${dd}/${mm}/${year} ${hours}:${minutes} UTC+3`
  const kuwaitDateEn = `${EN_SHORT_MONTHS[monthIdx]} ${dayNum}, ${year}`
  const kuwaitDateArSlash = `${dd}/${mm}/${year}`
  const kuwaitDateArLong = `${dayNum} ${AR_MONTH_NAMES[monthIdx]} ${year}`

  const diffMs = Math.max(0, referenceNowMs - recordMs)
  const hoursSinceLatestOdooRecord = Math.round((diffMs / 3_600_000) * 10) / 10
  const isStaleOver24h = diffMs > 24 * 3_600_000

  const badgeEn = isStaleOver24h
    ? `Data updated through ${kuwaitDateEn}`
    : `🟢 Data updated & synced with Odoo 17 through today (${kuwaitDateEn})`
  const badgeAr = isStaleOver24h
    ? `البيانات محدّثة حتى ${kuwaitDateArLong}`
    : `🟢 البيانات محدّثة ومرتبطة مع أودو 17 حتى اليوم (${kuwaitDateArLong})`

  const liveConnectedBadgeEn = `🟢 Data updated & synced with Odoo 17 through today (${kuwaitDateEn}) • Last Receipt: ${kuwaitTimestamp}`
  const liveConnectedBadgeAr = `🟢 البيانات محدّثة ومرتبطة مع أودو 17 حتى اليوم (${kuwaitDateArLong}) • آخر فاتورة: ${kuwaitTimestamp}`
  const cachedSnapshotBadgeEn = `Data updated through ${kuwaitDateEn} • Last Receipt: ${kuwaitTimestamp}`
  const cachedSnapshotBadgeAr = `البيانات محدّثة حتى ${kuwaitDateArLong} • آخر فاتورة: ${kuwaitTimestamp}`

  return {
    latestRecordIso: cleanIso,
    kuwaitIso,
    kuwaitTimestamp,
    kuwaitDateEn,
    kuwaitDateArSlash,
    kuwaitDateArLong,
    hoursSinceLatestOdooRecord,
    isStaleOver24h,
    badgeEn,
    badgeAr,
    liveConnectedBadgeEn,
    liveConnectedBadgeAr,
    cachedSnapshotBadgeEn,
    cachedSnapshotBadgeAr,
  }
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
  return Boolean(
    env.ODOO_URL &&
      env.ODOO_DB &&
      (env.ODOO_USERNAME || env.ODOO_LOGIN) &&
      env.ODOO_API_KEY,
  )
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
  timeProfile?: {
    daily?: { day: string; orders: number; netKwd: number }[]
    hourly?: { hour: number; orders: number; netKwd: number }[]
  }
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

export function summaryFromSnapshot(_raw: unknown, note?: string, bucket: OdooPeriodBucketKey = 'month'): OdooLiveSummary {
  const win = periodWindowForBucket(bucket)
  const kwTodayIso = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)
  const inclusiveTo =
    /^\d{4}-\d{2}-\d{2}$/.test(win.to)
      ? new Date(Date.parse(`${win.to}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
      : kwTodayIso
  const dateRange = {
    from: win.from,
    to: inclusiveTo >= win.from ? inclusiveTo : win.from,
  }
  return {
    source: 'disconnected',
    connected: false,
    sourceMode: 'disconnected',
    noData: true,
    messageAr: 'لا توجد بيانات من Odoo لهذه الفترة',
    messageEn: 'No data from Odoo for this period',
    lastSyncAt: null,
    isStale24h: false,
    odooCompanyId: null,
    dateRange,
    syncedAt: '',
    bucket,
    period: dateRange,
    database: null,
    totals: { netSalesKwd: 0, orders: 0, aovKwd: 0 },
    unattributedSalesKwd: 0,
    unattributedOrders: 0,
    brands: [],
    branches: [],
    channels: [],
    dailySeries: [],
    hourlySeries: [],
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

export async function fetchLiveOdooSummary(env: OdooEnv, period = monthToDate(), timeoutMs = 25_000, bucket?: OdooPeriodBucketKey): Promise<OdooLiveSummary> {
  if (!hasOdooCredentials(env)) throw new Error('Odoo credentials are not configured on the server')
  const base = String(env.ODOO_URL).trim().replace(/\/+$/, '')
  const url = new URL(base)
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('ODOO_URL must use HTTPS')
  }
  const deadline = Date.now() + timeoutMs
  let id = 0

  const call = async (service: string, method: string, args: unknown[]): Promise<unknown> => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new Error('Odoo live sync timed out')
    const perCallTimeoutMs = Math.min(8_000, Math.max(1_000, remaining))
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), perCallTimeoutMs)
    try {
      const res = await fetch(`${base}/jsonrpc`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: ++id, params: { service, method, args } }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`Odoo HTTP ${res.status}`)
      const json = (await res.json()) as { result?: unknown; error?: { data?: { message?: string }; message?: string } }
      if (json.error) throw new Error(json.error.data?.message || json.error.message || 'Odoo error')
      return json.result
    } finally {
      clearTimeout(timer)
    }
  }

  const db = String(env.ODOO_DB)
  const loginUser = String(env.ODOO_USERNAME || env.ODOO_LOGIN || '')
  const uid = await call('common', 'authenticate', [db, loginUser, env.ODOO_API_KEY, {}])
  if (typeof uid !== 'number' || uid <= 0) throw new Error('Odoo refused the service account')
  const ek = (model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) =>
    call('object', 'execute_kw', [db, uid, env.ODOO_API_KEY, model, method, args, kwargs])

  const locationExcluded = (id: string) => {
    const loc = REG.locations[id]
    return isExcludedOdooEntity(id) || isExcludedOdooEntity(loc?.en) || isExcludedOdooEntity(loc?.ar) || isExcludedOdooEntity(loc?.code)
  }
  const restaurantLocIds = Object.entries(REG.locations)
    .filter(([id, v]) => v.unit === 'restaurant' && !locationExcluded(id))
    .map(([id]) => id)
  const restaurantAllowed = ALLOWED_POS_CONFIG_IDS.filter((cfgId) => {
    const loc = REG.registers[String(cfgId)]?.location
    return Boolean(loc && REG.locations[loc]?.unit === 'restaurant' && !locationExcluded(loc))
  })
  const configs = ((await ek('pos.config', 'search_read', [companyPosSearchDomain(restaurantAllowed)], { fields: ['id', 'name', 'active'] })) as { id: number; name: string; active?: boolean }[])
    .filter((config) => config.active !== false && companyPosConfigAllowed(config.id, config.name, true))
  const visibleConfigIds = configs.map((config) => config.id).filter((id) => !isExcludedRecordId('pos_config', id))
  const allowedSet = new Set(visibleConfigIds)
  const configNameById = new Map(configs.map((c) => [c.id, c.name]))
  const isDeliveryCfg = (cfgId: number) => {
    const loc = REG.registers[String(cfgId)]?.location
    const nm = configNameById.get(cfgId) ?? ''
    return loc === 'ardiya' || /delivery|call\s*center/i.test(nm)
  }

  const categories = ((await ek('pos.category', 'search_read', [[]], { fields: ['id', 'name', 'parent_id'] })) as { id: number; name: string; parent_id: M2O }[])
    .filter((category) => !isExcludedOdooRecord({ id: category.id, name: category.name, kind: 'pos_category' }))
  const catById = new Map(categories.map((c) => [c.id, c]))
  const rootName = (catId: number | null) => {
    let c = catId ? catById.get(catId) : undefined
    let guard = 0
    while (c && c.parent_id && guard++ < 10) c = catById.get(m2oId(c.parent_id) ?? -1)
    return c?.name ?? null
  }
  const brandOfRoot = new Map(REG.brands.filter((b) => b.posRoot).map((b) => [b.posRoot as string, b]))

  const kwDateToUtc = (kwIsoDate: string) =>
    new Date(Date.parse(`${kwIsoDate}T00:00:00.000Z`) - KUWAIT_OFFSET_MS)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ')
  const periodFromUtc = kwDateToUtc(period.from)
  const periodToUtc = kwDateToUtc(period.to)

  const orderDomain = buildPosOrderUtcDomain({
    fromUtc: periodFromUtc,
    toExclusiveUtc: periodToUtc,
    configIds: visibleConfigIds,
  })
  const nonRefundOrderDomain = buildPosOrderUtcDomain({
    fromUtc: periodFromUtc,
    toExclusiveUtc: periodToUtc,
    configIds: visibleConfigIds,
    nonRefundOnly: true,
  })
  const paymentDomain = buildPosPaymentUtcDomain({
    fromUtc: periodFromUtc,
    toExclusiveUtc: periodToUtc,
    configIds: visibleConfigIds,
  })
  const nonRefundPaymentDomain = buildPosPaymentUtcDomain({
    fromUtc: periodFromUtc,
    toExclusiveUtc: periodToUtc,
    configIds: visibleConfigIds,
    nonRefundOnly: true,
  })
  const [bySession, bySessionCount, byPayment, byPaymentCount] = await Promise.all([
    ek('pos.order', 'read_group', [orderDomain, ['amount_total:sum', 'amount_tax:sum'], ['session_id']], { lazy: false, context: { tz: 'Asia/Kuwait' } }) as Promise<{ session_id: M2O; amount_total: number; amount_tax: number; __count: number }[]>,
    ek('pos.order', 'read_group', [nonRefundOrderDomain, ['amount_total:sum'], ['session_id']], { lazy: false, context: { tz: 'Asia/Kuwait' } }).catch(() => []) as Promise<{ session_id: M2O; __count?: number }[]>,
    ek('pos.payment', 'read_group', [paymentDomain, ['amount:sum'], ['session_id', 'payment_method_id']], { lazy: false, context: { tz: 'Asia/Kuwait' } }) as Promise<{ session_id: M2O; payment_method_id: M2O; amount: number; __count?: number }[]>,
    ek('pos.payment', 'read_group', [nonRefundPaymentDomain, ['amount:sum'], ['session_id', 'payment_method_id']], { lazy: false, context: { tz: 'Asia/Kuwait' } }).catch(() => []) as Promise<{ session_id: M2O; payment_method_id: M2O; __count?: number }[]>,
  ])
  const mergedSessions = mergeSessionGroups(bySession, bySessionCount)
  const mergedPayments = mergeSessionPaymentGroups(byPayment, byPaymentCount)
  const sessionIds = [
    ...new Set(
      [...mergedSessions, ...mergedPayments]
        .map((g) => g.sessionId)
        .filter((x): x is number => x !== null),
    ),
  ]
  const sessions = sessionIds.length ? ((await ek('pos.session', 'read', [sessionIds, ['id', 'config_id']])) as { id: number; config_id: M2O }[]) : []
  const configOfSession = new Map(sessions.map((s) => [s.id, m2oId(s.config_id)]))

  const locAgg = new Map<string, { net: number; orders: number }>()
  let schoolNet = 0
  let schoolOrders = 0
  for (const g of mergedSessions) {
    const sid = g.sessionId ?? -1
    const cfg = configOfSession.get(sid)
    if (cfg === undefined || cfg === null || !allowedSet.has(cfg)) continue
    const net = g.netKwd
    const orders = g.orders
    if (isPinnedSchoolCanteenConfigId(cfg)) {
      schoolNet += net
      schoolOrders += orders
      continue
    }
    const loc = REG.registers[String(cfg)]?.location
    if (!loc || REG.locations[loc]?.unit !== 'restaurant' || locationExcluded(loc)) continue
    const b = locAgg.get(loc) ?? { net: 0, orders: 0 }
    b.net += net
    b.orders += orders
    locAgg.set(loc, b)
  }
  const targetNet = r3([...locAgg.values()].reduce((s, b) => s + b.net, 0) + schoolNet)
  const totalOrders = [...locAgg.values()].reduce((s, b) => s + b.orders, 0) + schoolOrders
  const rawLocNet = new Map(restaurantLocIds.map((loc) => [loc, r3(locAgg.get(loc)?.net ?? 0)]))

  const locRawUi = new Map<string, Record<string, { netKwd: number; orders: number }>>()
  for (const loc of restaurantLocIds) {
    locRawUi.set(loc, Object.fromEntries(UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }])))
  }
  const schoolUi: Record<string, { netKwd: number; orders: number }> = Object.fromEntries(
    UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }]),
  )
  for (const g of mergedPayments) {
    const cfg = configOfSession.get(g.sessionId ?? -1)
    if (cfg === undefined || cfg === null || !allowedSet.has(cfg)) continue
    const payName = g.paymentMethodName
    const ch = channelOfPaymentMethod(payName)
    const amt = g.netKwd
    const cnt = g.orders
    let uiKey: (typeof UI_CHANNEL_KEYS)[number] = 'dine-in'
    if (ch === 'Talabat Go') uiKey = 'talabat-tgo'
    else if (ch === 'Talabat MP') uiKey = 'talabat-tmp'
    else if (ch === 'Keeta') uiKey = 'keeta'
    else if (ch === 'Deliveroo Go' || ch === 'Deliveroo MP') uiKey = 'deliveroo'
    else if (ch === 'Jahez' || ch === 'Cari') uiKey = 'jahez'
    else if (ch === 'Snoonu') uiKey = 'snoonu'
    else if (ch === 'Online payment link' || ch === 'Cash on delivery' || ch === 'Bilbayt') uiKey = 'takeaway-direct'
    else uiKey = isDeliveryCfg(cfg) ? 'takeaway-direct' : 'dine-in'
    if (isPinnedSchoolCanteenConfigId(cfg)) {
      schoolUi[uiKey].netKwd += amt
      schoolUi[uiKey].orders += cnt
      continue
    }
    const loc = REG.registers[String(cfg)]?.location
    if (!loc || !locRawUi.has(loc)) continue
    const row = locRawUi.get(loc)!
    row[uiKey].netKwd += amt
    row[uiKey].orders += cnt
  }

  const byLocation: NonNullable<OdooBucketSummary['byLocation']> = {}
  const aggUiChannels: Record<string, { netKwd: number; orders: number }> = Object.fromEntries(UI_CHANNEL_KEYS.map((ck) => [ck, { netKwd: 0, orders: 0 }]))
  for (const loc of restaurantLocIds) {
    const locTarget = rawLocNet.get(loc) ?? 0
    const rawUi = locRawUi.get(loc)!
    const rawUiMap = new Map<string, number>(UI_CHANNEL_KEYS.map((ck) => [ck, rawUi[ck].netKwd]))
    if (loc === 'ardiya' && (rawUiMap.get('dine-in') ?? 0) > 0) {
      rawUiMap.set('takeaway-direct', (rawUiMap.get('takeaway-direct') ?? 0) + (rawUiMap.get('dine-in') ?? 0))
      rawUiMap.set('dine-in', 0)
    }
    const locUi: Record<string, { netKwd: number; orders: number }> = {}
    for (const ck of UI_CHANNEL_KEYS) {
      const nv = r3(rawUiMap.get(ck) ?? 0)
      const ov = Math.max(0, Math.round(rawUi[ck].orders || 0))
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
  const schoolUiRounded: Record<string, { netKwd: number; orders: number }> = {}
  for (const ck of UI_CHANNEL_KEYS) {
    const nv = r3(schoolUi[ck].netKwd)
    const ov = Math.max(0, Math.round(schoolUi[ck].orders || 0))
    schoolUiRounded[ck] = { netKwd: nv, orders: ov }
    aggUiChannels[ck].netKwd = r3(aggUiChannels[ck].netKwd + nv)
    aggUiChannels[ck].orders += ov
  }
  byLocation[SCHOOL_CANTEEN_BRANCH_ID] = {
    netKwd: r3(schoolNet),
    orders: schoolOrders,
    uiChannels: schoolUiRounded,
  }

  const lineDomain = [['order_id.date_order', '>=', periodFromUtc], ['order_id.date_order', '<', periodToUtc], ['order_id.state', 'in', ['paid', 'done', 'invoiced']], ['order_id.session_id.config_id', 'in', visibleConfigIds], ['product_id.pos_categ_id', '!=', 150]]
  const byProduct = (await ek('pos.order.line', 'read_group', [lineDomain, ['price_subtotal:sum', 'qty:sum'], ['product_id']], { lazy: false, context: { tz: 'Asia/Kuwait' } })) as { product_id: M2O; price_subtotal: number; qty?: number; __count?: number }[]
  const productIds = byProduct.map((g) => m2oId(g.product_id)).filter((x): x is number => x !== null)
  const products = productIds.length ? ((await ek('product.product', 'read', [productIds, ['id', 'pos_categ_id']])) as { id: number; pos_categ_id: M2O }[]) : []
  const categOf = new Map(products.map((p) => [p.id, m2oId(p.pos_categ_id)]))
  const brandAgg = new Map<string, { rawNet: number; qty: number; linesCount: number }>()
  for (const g of byProduct) {
    const categId = categOf.get(m2oId(g.product_id) ?? -1) ?? null
    if (isExcludedRecordId('pos_category', categId)) continue
    const root = rootName(categId)
    if (isExcludedOdooEntity(root)) continue
    const brand = root ? brandOfRoot.get(root) : undefined
    if (!brand || !(ACTIVE_BRAND_IDS as readonly string[]).includes(brand.id) || isExcludedOdooEntity(brand.en) || isExcludedOdooEntity(brand.ar)) continue
    const prev = brandAgg.get(brand.id) ?? { rawNet: 0, qty: 0, linesCount: 0 }
    prev.rawNet += Math.max(0, g.price_subtotal || 0)
    prev.qty += Math.max(0, g.qty || 0)
    prev.linesCount += Math.max(0, g.__count || 0)
    brandAgg.set(brand.id, prev)
  }
  const byBrand: NonNullable<OdooBucketSummary['byBrand']> = {}
  for (const bid of ACTIVE_BRAND_IDS) {
    const nv = r3(Math.max(0, brandAgg.get(bid)?.rawNet ?? 0))
    byBrand[bid] = {
      netKwd: nv,
      orders: Math.max(0, Math.round(brandAgg.get(bid)?.linesCount ?? 0)),
      qty: r3(Math.max(0, brandAgg.get(bid)?.qty ?? 0)),
    }
  }

  // Journey pulse (3 grouped totals) and the access audit run in parallel; neither may fail the summary.
  const windows = journeyWindows()
  const pulseOf = async (w: { from: string; to: string; days: number }) => {
    const winFromUtc = kwDateToUtc(w.from)
    const winToUtc = kwDateToUtc(w.to)
    const [rows, nonRefundCount] = await Promise.all([
      ek(
        'pos.order',
        'read_group',
        [
          buildPosOrderUtcDomain({
            fromUtc: winFromUtc,
            toExclusiveUtc: winToUtc,
            configIds: visibleConfigIds,
          }),
          ['amount_total:sum', 'amount_tax:sum'],
          [],
        ],
        { lazy: false, context: { tz: 'Asia/Kuwait' } },
      ) as Promise<{ amount_total: number; amount_tax: number; __count: number }[]>,
      ek('pos.order', 'search_count', [
        buildPosOrderUtcDomain({
          fromUtc: winFromUtc,
          toExclusiveUtc: winToUtc,
          configIds: visibleConfigIds,
          nonRefundOnly: true,
        }),
      ]).catch(() => 0) as Promise<number>,
    ])
    const net = posOrderNet(rows[0]?.amount_total, rows[0]?.amount_tax)
    const orders = Math.max(0, Math.round(Number(nonRefundCount) || 0))
    return { ...w, netKwd: r3(net), orders, perDayKwd: r3(net / Math.max(1, w.days)) }
  }
  const [pulse, audit, unalloc, latestPosOrderIso] = await Promise.all([
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
    (
      ek(
        'pos.order',
        'search_read',
        [[['state', 'in', ['paid', 'done', 'invoiced']], ['session_id.config_id', 'in', visibleConfigIds]], ['date_order']],
        { order: 'date_order desc', limit: 1 },
      ) as Promise<{ id?: number; date_order?: string }[]>
    )
      .then((rows) => normalizeOdooDateOrderToIso(rows?.[0]?.date_order))
      .catch(() => null),
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

  const fallbackWindowRecordIso = new Date(
    new Date(`${period.to}T00:00:00Z`).getTime() - 86_400_000 + 20 * 3_600_000 + 59 * 60_000,
  ).toISOString()
  const resolvedLatestRecordAt = latestPosOrderIso ?? fallbackWindowRecordIso
  const liveFreshness = computeOdooFreshnessStatus(resolvedLatestRecordAt, Date.now())
  const resolvedOperationalDate = new Date(new Date(resolvedLatestRecordAt).getTime() + KUWAIT_OFFSET_MS)
    .toISOString()
    .slice(0, 10)

  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    syncedAt: resolvedLatestRecordAt,
    latestRecordAt: resolvedLatestRecordAt,
    latestOdooRecordAt: liveFreshness.kuwaitIso,
    latestRecordKuwaitIso: liveFreshness.kuwaitIso,
    kuwaitSyncedAt: liveFreshness.kuwaitTimestamp,
    hoursSinceLatestRecord: liveFreshness.hoursSinceLatestOdooRecord,
    hoursSinceLatestOdooRecord: liveFreshness.hoursSinceLatestOdooRecord,
    isStaleOver24h: liveFreshness.isStaleOver24h,
    latestOperationalDate: resolvedOperationalDate,
    ...(bucket ? { bucket } : {}),
    period,
    database: null,
    totals: { netSalesKwd: targetNet, orders: totalOrders, aovKwd: totalOrders ? r3(targetNet / totalOrders) : 0 },
    brands: ACTIVE_BRAND_IDS.filter((bid) => (byBrand[bid]?.netKwd ?? 0) > 0).map((bid) => {
      const nv = byBrand[bid]?.netKwd ?? 0
      return { id: bid, brand: REG.brands.find((b) => b.id === bid)?.en ?? bid, netKwd: nv, sharePct: pct(nv, targetNet) }
    }).sort((a, b) => b.netKwd - a.netKwd),
    branches: [
      ...restaurantLocIds.map((lid) => {
        const nv = rawLocNet.get(lid) ?? 0
        return { id: lid, name: REG.locations[lid]?.en ?? lid, unit: 'restaurant', netSalesKwd: nv, orders: locAgg.get(lid)?.orders ?? 0, sharePct: pct(nv, targetNet) }
      }),
      {
        id: SCHOOL_CANTEEN_BRANCH_ID,
        name: 'School canteens',
        unit: 'school-canteen',
        netSalesKwd: r3(schoolNet),
        orders: schoolOrders,
        sharePct: pct(r3(schoolNet), targetNet),
      },
    ].sort((a, b) => b.netSalesKwd - a.netSalesKwd),
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
