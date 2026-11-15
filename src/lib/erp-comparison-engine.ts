/**
 * Live Odoo Period-Cube Enterprise Comparison Engine (`src/lib/erp-comparison-engine.ts`)
 *
 * Computes all comparison KPIs, hourly/daily chart buckets, and entity variance
 * rows (7 approved operational branches + standalone 8th «غير منسوب لفرع» bucket,
 * 6 approved brands, and payment channels) strictly from live Odoo 17 period
 * cubes (`OdooPeriodCube` A & B).
 *
 * Strict Guarantees:
 *   - Zero static dataset imports, snapshots, or invented weights.
 *   - Standalone unattributed POS terminal sales (`غير منسوب لفرع`) are surfaced
 *     explicitly as row #8 in `byBranch` and never redistributed into the 7 branches.
 *   - GL profit/expense metrics report real values only when complete accrual entries
 *     are posted in Odoo `account.move.line`; otherwise `accountingAvailable: false`
 *     with `قيود غير مكتملة لهذه الفترة`.
 */

import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import {
  getKuwaitTimeContext,
  UNMAPPED_TERMINALS_LABEL_AR,
  UNMAPPED_TERMINALS_LABEL_EN,
} from '@/lib/aether/period-delta'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  getBranchLabel,
  getBrandLabel,
  getChannelLabel,
  isBrandBranchCompatible,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
} from '@/lib/aether/global-filter-engine'

export type BrandEntityId = Exclude<GlobalBrand, 'all'>
export type BranchEntityId = Exclude<GlobalBranch, 'all'>
export type ChannelEntityId = Exclude<GlobalChannel, 'all'>

export type ComparisonModeType = 'date-vs-date' | 'entity-vs-entity'
export type ComparisonGranularity = 'single' | 'range'
export type EntityComparisonDimension = 'brand' | 'branch'
export type BreakdownDimension = 'branch' | 'brand' | 'channel'

export const UNATTRIBUTED_BRANCH_ROW_ID = 'unattributed' as const

export interface DateWindowSelection {
  from: string
  to: string
}

export interface ErpComparisonQuery {
  mode: ComparisonModeType
  granularity: ComparisonGranularity
  periodA: DateWindowSelection
  periodB: DateWindowSelection
  brandIds: 'all' | readonly BrandEntityId[]
  branchIds: 'all' | readonly BranchEntityId[]
  channelIds: 'all' | readonly ChannelEntityId[]
  entityDimension?: EntityComparisonDimension
  entityA?: BrandEntityId | BranchEntityId
  entityB?: BrandEntityId | BranchEntityId
  sameHoursLikeForLike?: boolean
}

export type ExecutiveKpiId =
  | 'netSales'
  | 'completedOrders'
  | 'averageCheck'
  | 'foodAndAggregatorCost'
  | 'netPocketCash'
  | 'netPocketMargin'

export interface ExecutiveKpiDelta {
  id: ExecutiveKpiId
  labelEn: string
  labelAr: string
  unit: 'KWD' | 'orders' | 'pct'
  polarity: 'higher-is-better' | 'lower-is-better'
  available?: boolean
  unavailableReasonAr?: string
  unavailableReasonEn?: string
  valueA: number
  valueB: number
  shareOfSalesA?: number
  shareOfSalesB?: number
  deltaAbs: number
  deltaPct: number
  deltaBps?: number
  trend: 'up' | 'down' | 'flat'
  isFavorable: boolean
}

export interface ComparisonSliceTotals {
  titleEn: string
  titleAr: string
  shortLabelEn: string
  shortLabelAr: string
  badgeEn: string
  badgeAr: string
  fromIso: string
  toIso: string
  dayCount: number
  netSalesKwd: number
  completedOrders: number
  aovKwd: number
  foodCostKwd: number
  aggregatorFeeKwd: number
  foodAndAggregatorCostKwd: number
  foodAndAggregatorPct: number
  fixedOpexKwd: number
  netPocketCashKwd: number
  netPocketMarginPct: number
  unattributedSalesKwd: number
  unattributedOrders: number
  accountingAvailable: boolean
}

export interface ComparisonChartBucket {
  id: string
  index: number
  labelEn: string
  labelAr: string
  metaA: string
  metaB: string
  seriesA: number
  seriesB: number
  delta: number
  deltaPct: number
  cumulativeA: number
  cumulativeB: number
  ordersA: number
  ordersB: number
  ordersDelta: number
  profitA: number
  profitB: number
  profitDelta: number
  cumulativeProfitA: number
  cumulativeProfitB: number
}

export interface EntityVarianceRow {
  id: string
  dimension: BreakdownDimension
  nameEn: string
  nameAr: string
  subMetaEn: string
  subMetaAr: string
  isCompatible: boolean
  isUnattributed?: boolean
  accountingAvailable: boolean
  valueA: number
  valueB: number
  deltaKwd: number
  deltaPct: number
  ordersA: number
  ordersB: number
  ordersDelta: number
  ordersDeltaPct: number
  aovA: number
  aovB: number
  foodAggCostA: number
  foodAggCostB: number
  netProfitA: number
  netProfitB: number
  netProfitDeltaKwd: number
  marginPctA: number
  marginPctB: number
  marginDeltaPp: number
  shareOfTotalAPct: number
  tier: 'green' | 'yellow' | 'red'
}

export interface ComparisonAutoInsightEntity {
  id: string
  dimension: BreakdownDimension
  nameEn: string
  nameAr: string
  valueA: number
  valueB: number
  deltaKwd: number
  deltaPct: number
  netProfitDeltaKwd: number
}

export interface ErpComparisonAutoInsights {
  topGainer: ComparisonAutoInsightEntity | null
  biggestDecline: ComparisonAutoInsightEntity | null
  topGainerBrand: ComparisonAutoInsightEntity | null
  biggestDeclineBrand: ComparisonAutoInsightEntity | null
  topGainerBranch: ComparisonAutoInsightEntity | null
  biggestDeclineBranch: ComparisonAutoInsightEntity | null
  headlineEn: string
  headlineAr: string
  summaryEn: string
  summaryAr: string
}

export interface ComparisonLikeForLikeMeta {
  sameHoursLikeForLike: boolean
  excludedIncompleteToday: boolean
  operationalTodayIso: string
  lastCompletedDayIso: string
  kuwaitHhMm: string
  intradayShare: number
  helperNoteEn: string
  helperNoteAr: string
}

export interface ErpComparisonResult {
  connected: boolean
  noData: boolean
  messageAr?: string
  query: ErpComparisonQuery
  isScopeCompatible: boolean
  scopeSummaryEn: string
  scopeSummaryAr: string
  selectionA: ComparisonSliceTotals
  selectionB: ComparisonSliceTotals
  unattributedA: { salesKwd: number; orders: number }
  unattributedB: { salesKwd: number; orders: number }
  kpiList: readonly [
    ExecutiveKpiDelta,
    ExecutiveKpiDelta,
    ExecutiveKpiDelta,
    ExecutiveKpiDelta,
    ExecutiveKpiDelta,
    ExecutiveKpiDelta,
  ]
  kpis: {
    netSales: ExecutiveKpiDelta
    completedOrders: ExecutiveKpiDelta
    averageCheck: ExecutiveKpiDelta
    foodAndAggregatorCost: ExecutiveKpiDelta
    netPocketCash: ExecutiveKpiDelta
    netPocketMargin: ExecutiveKpiDelta
  }
  chartKind: 'hourly-14' | 'daily-aligned'
  chartBuckets: ComparisonChartBucket[]
  byBranch: EntityVarianceRow[]
  byBrand: EntityVarianceRow[]
  byChannel: EntityVarianceRow[]
  insights: ErpComparisonAutoInsights
  likeForLikeMeta: ComparisonLikeForLikeMeta
  accountingAvailable: boolean
  accountingUnavailableReasonAr: string | null
  accountingUnavailableReasonEn: string | null
  lastSyncedAt: string | null
  reconciliation: {
    maxSalesGapKwd: number
    maxProfitGapKwd: number
    maxOrdersGap: number
    maxChartSalesGapKwd: number
  }
}

export interface ErpComparisonLiveCubesInput {
  cubeA?: OdooPeriodCube | null
  cubeB?: OdooPeriodCube | null
  liveSummary?: OdooLiveSummary | null
}

function shiftIsoDateBootstrap(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

const INITIAL_COMPLETED_YESTERDAY_ISO = getKuwaitTimeContext().yesterdayIso
export const DEFAULT_COMPARISON_DATE_A = INITIAL_COMPLETED_YESTERDAY_ISO
export const DEFAULT_COMPARISON_DATE_B = shiftIsoDateBootstrap(
  INITIAL_COMPLETED_YESTERDAY_ISO,
  -7,
)
export const DEFAULT_RANGE_FROM_A = shiftIsoDateBootstrap(
  INITIAL_COMPLETED_YESTERDAY_ISO,
  -6,
)
export const DEFAULT_RANGE_TO_A = INITIAL_COMPLETED_YESTERDAY_ISO
export const DEFAULT_RANGE_FROM_B = shiftIsoDateBootstrap(
  INITIAL_COMPLETED_YESTERDAY_ISO,
  -13,
)
export const DEFAULT_RANGE_TO_B = shiftIsoDateBootstrap(
  INITIAL_COMPLETED_YESTERDAY_ISO,
  -7,
)

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const NO_DATA_AR = 'لا توجد بيانات من Odoo لهذه الفترة'
const NO_DATA_EN = 'No data from Odoo for this period'
const GL_INCOMPLETE_AR = 'قيود غير مكتملة لهذه الفترة'
const GL_INCOMPLETE_EN = 'Incomplete GL entries for this period'

const EN_WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const EN_WEEKDAYS_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const
const AR_WEEKDAYS = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const
const EN_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const
const AR_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const

export const OPERATING_HOURS_14: ReadonlyArray<{
  hour24: number
  slotKey: string
  labelEn: string
  labelAr: string
  compactEn: string
}> = [
  { hour24: 11, slotKey: '11:00', labelEn: '11:00', labelAr: '11 ص', compactEn: '11 AM' },
  { hour24: 12, slotKey: '12:00', labelEn: '12:00', labelAr: '12 م', compactEn: '12 PM' },
  { hour24: 13, slotKey: '13:00', labelEn: '13:00', labelAr: '1 م', compactEn: '1 PM' },
  { hour24: 14, slotKey: '14:00', labelEn: '14:00', labelAr: '2 م', compactEn: '2 PM' },
  { hour24: 15, slotKey: '15:00', labelEn: '15:00', labelAr: '3 م', compactEn: '3 PM' },
  { hour24: 16, slotKey: '16:00', labelEn: '16:00', labelAr: '4 م', compactEn: '4 PM' },
  { hour24: 17, slotKey: '17:00', labelEn: '17:00', labelAr: '5 م', compactEn: '5 PM' },
  { hour24: 18, slotKey: '18:00', labelEn: '18:00', labelAr: '6 م', compactEn: '6 PM' },
  { hour24: 19, slotKey: '19:00', labelEn: '19:00', labelAr: '7 م', compactEn: '7 PM' },
  { hour24: 20, slotKey: '20:00', labelEn: '20:00', labelAr: '8 م', compactEn: '8 PM' },
  { hour24: 21, slotKey: '21:00', labelEn: '21:00', labelAr: '9 م', compactEn: '9 PM' },
  { hour24: 22, slotKey: '22:00', labelEn: '22:00', labelAr: '10 م', compactEn: '10 PM' },
  { hour24: 23, slotKey: '23:00', labelEn: '23:00', labelAr: '11 م', compactEn: '11 PM' },
  { hour24: 0, slotKey: '00:00', labelEn: '00:00', labelAr: '12 ص', compactEn: '12 AM' },
]

const r2 = (n: number): number => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0)
const r1 = (n: number): number => (Number.isFinite(n) ? Math.round(n * 10) / 10 : 0)

function safePctDelta(valA: number, valB: number): number {
  if (!Number.isFinite(valA) || !Number.isFinite(valB)) return 0
  if (Math.abs(valB) < 0.0001) return Math.abs(valA) < 0.0001 ? 0 : 100
  return r1(((valA - valB) / Math.abs(valB)) * 100)
}

export function sanitizeIsoDate(
  raw: string | undefined | null,
  fallback = DEFAULT_COMPARISON_DATE_A,
): string {
  if (!raw || !ISO_DATE_RE.test(raw.trim())) return fallback
  const clean = raw.trim()
  const [y, m, d] = clean.split('-').map(Number)
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return fallback
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (Number.isNaN(dt.getTime())) return fallback
  return dt.toISOString().slice(0, 10)
}

export function shiftIsoDate(iso: string, deltaDays: number): string {
  const clean = sanitizeIsoDate(iso)
  const [y, m, d] = clean.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

export function shiftIsoMonth(iso: string, deltaMonths: number): string {
  const clean = sanitizeIsoDate(iso)
  const [y, m, d] = clean.split('-').map(Number)
  const targetYear = y + Math.floor((m - 1 + deltaMonths) / 12)
  const targetMonthIdx = (((m - 1 + deltaMonths) % 12) + 12) % 12
  const maxDay = new Date(Date.UTC(targetYear, targetMonthIdx + 1, 0)).getUTCDate()
  const dt = new Date(Date.UTC(targetYear, targetMonthIdx, Math.min(d, maxDay)))
  return dt.toISOString().slice(0, 10)
}

export function normalizeWindowSelection(
  input: DateWindowSelection,
  granularity: ComparisonGranularity,
  fallbackIso = DEFAULT_COMPARISON_DATE_A,
): { fromIso: string; toIso: string; dayCount: number; dates: string[] } {
  const cleanFrom = sanitizeIsoDate(input.from, fallbackIso)
  const cleanTo = granularity === 'single' ? cleanFrom : sanitizeIsoDate(input.to, cleanFrom)
  const fromIso = cleanFrom <= cleanTo ? cleanFrom : cleanTo
  const toIso = cleanFrom <= cleanTo ? cleanTo : cleanFrom

  const startMs = new Date(`${fromIso}T00:00:00Z`).getTime()
  const endMs = new Date(`${toIso}T00:00:00Z`).getTime()
  const rawDays = Math.round((endMs - startMs) / 86_400_000) + 1
  const dayCount = Math.max(1, Math.min(366, Number.isFinite(rawDays) ? rawDays : 1))

  const dates: string[] = []
  for (let i = 0; i < dayCount; i++) {
    dates.push(shiftIsoDate(fromIso, i))
  }
  return { fromIso, toIso, dayCount, dates }
}

export function formatCalendarDateBadge(
  iso: string,
  isAr: boolean,
  includeYear = true,
): { full: string; shortDdMm: string; weekdayShort: string; weekdayFull: string } {
  const clean = sanitizeIsoDate(iso)
  const dt = new Date(`${clean}T00:00:00Z`)
  const dow = dt.getUTCDay()
  const day = dt.getUTCDate()
  const mIdx = dt.getUTCMonth()
  const year = dt.getUTCFullYear()
  const shortDdMm = `${String(day).padStart(2, '0')}/${String(mIdx + 1).padStart(2, '0')}`

  if (isAr) {
    const wd = AR_WEEKDAYS[dow]
    const mo = AR_MONTHS[mIdx]
    return {
      full: includeYear ? `${wd}، ${day} ${mo} ${year}` : `${wd}، ${day} ${mo}`,
      shortDdMm,
      weekdayShort: wd,
      weekdayFull: wd,
    }
  }
  const wdS = EN_WEEKDAYS_SHORT[dow]
  const wdF = EN_WEEKDAYS_FULL[dow]
  const mo = EN_MONTHS_SHORT[mIdx]
  return {
    full: includeYear ? `${wdS}, ${day} ${mo} ${year}` : `${wdS}, ${day} ${mo}`,
    shortDdMm,
    weekdayShort: wdS,
    weekdayFull: wdF,
  }
}

export function resolveCompletedComparisonDefaults(options?: {
  granularity?: ComparisonGranularity
  sameHoursLikeForLike?: boolean
  liveSummary?: OdooLiveSummary | null
  referenceNowMs?: number
}): {
  operationalTodayIso: string
  lastCompletedDayIso: string
  kuwaitHhMm: string
  periodA: DateWindowSelection
  periodB: DateWindowSelection
} {
  const kwCtx = getKuwaitTimeContext(options?.referenceNowMs)
  const operationalTodayIso = kwCtx.todayIso
  const lastCompletedDayIso = shiftIsoDate(operationalTodayIso, -1)
  const anchorTo = options?.sameHoursLikeForLike ? operationalTodayIso : lastCompletedDayIso
  const granularity = options?.granularity === 'range' ? 'range' : 'single'

  if (granularity === 'range') {
    return {
      operationalTodayIso,
      lastCompletedDayIso,
      kuwaitHhMm: kwCtx.hhMm,
      periodA: { from: shiftIsoDate(anchorTo, -6), to: anchorTo },
      periodB: { from: shiftIsoDate(anchorTo, -13), to: shiftIsoDate(anchorTo, -7) },
    }
  }

  return {
    operationalTodayIso,
    lastCompletedDayIso,
    kuwaitHhMm: kwCtx.hhMm,
    periodA: { from: anchorTo, to: anchorTo },
    periodB: { from: shiftIsoDate(anchorTo, -7), to: shiftIsoDate(anchorTo, -7) },
  }
}

export function getCompatibleBranchesForBrands(
  brandIds: 'all' | readonly BrandEntityId[],
): BranchEntityId[] {
  const activeBrands: readonly BrandEntityId[] =
    brandIds === 'all' || brandIds.length === 0 ? APPROVED_BRAND_IDS : brandIds
  return APPROVED_BRANCH_IDS.filter((br) =>
    activeBrands.some((b) => isBrandBranchCompatible(b, br)),
  )
}

interface ResolvedEntityScope {
  brandIds: BrandEntityId[]
  branchIds: BranchEntityId[]
  includeUnattributed: boolean
  channelIds: ChannelEntityId[]
}

function sanitizeBrandSelection(raw: 'all' | readonly BrandEntityId[]): BrandEntityId[] {
  if (raw === 'all' || raw.length === 0) return [...APPROVED_BRAND_IDS]
  const valid = raw.filter((id): id is BrandEntityId =>
    (APPROVED_BRAND_IDS as readonly string[]).includes(id),
  )
  return valid.length > 0 ? Array.from(new Set(valid)) : [...APPROVED_BRAND_IDS]
}

function sanitizeBranchSelection(raw: 'all' | readonly BranchEntityId[]): {
  branchIds: BranchEntityId[]
  includeUnattributed: boolean
} {
  if (raw === 'all' || raw.length === 0) {
    return { branchIds: [...APPROVED_BRANCH_IDS], includeUnattributed: true }
  }
  const valid = raw.filter((id): id is BranchEntityId =>
    (APPROVED_BRANCH_IDS as readonly string[]).includes(id),
  )
  if (valid.length === 0) {
    return { branchIds: [...APPROVED_BRANCH_IDS], includeUnattributed: true }
  }
  return { branchIds: Array.from(new Set(valid)), includeUnattributed: false }
}

function sanitizeChannelSelection(raw: 'all' | readonly ChannelEntityId[]): ChannelEntityId[] {
  if (raw === 'all' || raw.length === 0) return [...APPROVED_CHANNEL_IDS]
  const valid = raw.filter((id): id is ChannelEntityId =>
    (APPROVED_CHANNEL_IDS as readonly string[]).includes(id),
  )
  return valid.length > 0 ? Array.from(new Set(valid)) : [...APPROVED_CHANNEL_IDS]
}

function getEntityNames(
  dim: BreakdownDimension,
  id: string,
): { nameAr: string; nameEn: string; subMetaAr: string; subMetaEn: string } {
  if (dim === 'branch') {
    if (id === UNATTRIBUTED_BRANCH_ROW_ID) {
      return {
        nameAr: UNMAPPED_TERMINALS_LABEL_AR,
        nameEn: UNMAPPED_TERMINALS_LABEL_EN,
        subMetaAr: 'أجهزة نقاط بيع غير مربوطة بفرع تشغيلي في Odoo',
        subMetaEn: 'POS terminals not linked to an operational branch in Odoo',
      }
    }
    return {
      nameAr: getBranchLabel(id as GlobalBranch, true),
      nameEn: getBranchLabel(id as GlobalBranch, false),
      subMetaAr: 'فرع تشغيلي مربوط',
      subMetaEn: 'Mapped operational branch',
    }
  }
  if (dim === 'brand') {
    return {
      nameAr: getBrandLabel(id as GlobalBrand, true),
      nameEn: getBrandLabel(id as GlobalBrand, false),
      subMetaAr: 'علامة معتمدة',
      subMetaEn: 'Approved brand',
    }
  }
  return {
    nameAr: getChannelLabel(id as GlobalChannel, true),
    nameEn: getChannelLabel(id as GlobalChannel, false),
    subMetaAr: 'قناة دفع فعلية',
    subMetaEn: 'Live payment channel',
  }
}

function formatSliceHeaderLabels(
  fromIso: string,
  toIso: string,
  dayCount: number,
): {
  titleEn: string
  titleAr: string
  shortLabelEn: string
  shortLabelAr: string
  badgeEn: string
  badgeAr: string
} {
  if (dayCount === 1 || fromIso === toIso) {
    const ar = formatCalendarDateBadge(fromIso, true, true)
    const en = formatCalendarDateBadge(fromIso, false, true)
    return {
      titleAr: ar.full,
      titleEn: en.full,
      shortLabelAr: `${ar.weekdayShort} ${ar.shortDdMm}`,
      shortLabelEn: `${en.weekdayShort} ${en.shortDdMm}`,
      badgeAr: ar.shortDdMm,
      badgeEn: en.shortDdMm,
    }
  }
  const fAr = formatCalendarDateBadge(fromIso, true, false)
  const tAr = formatCalendarDateBadge(toIso, true, true)
  const fEn = formatCalendarDateBadge(fromIso, false, false)
  const tEn = formatCalendarDateBadge(toIso, false, true)
  return {
    titleAr: `${fAr.full} ← ${tAr.full} (${dayCount} أيام)`,
    titleEn: `${fEn.full} – ${tEn.full} (${dayCount}d)`,
    shortLabelAr: `${fAr.shortDdMm}–${tAr.shortDdMm}`,
    shortLabelEn: `${fEn.shortDdMm}–${tEn.shortDdMm}`,
    badgeAr: `${dayCount} أيام`,
    badgeEn: `${dayCount}d`,
  }
}

export function normalizeComparisonQueryWindows(rawQuery: ErpComparisonQuery): {
  mode: ComparisonModeType
  granularity: ComparisonGranularity
  normA: { fromIso: string; toIso: string; dayCount: number; dates: string[] }
  normB: { fromIso: string; toIso: string; dayCount: number; dates: string[] }
  cutoffHour24: number | null
  likeForLikeMeta: ComparisonLikeForLikeMeta
} {
  const kwCtx = getKuwaitTimeContext()
  const operationalTodayIso = kwCtx.todayIso
  const lastCompletedDayIso = kwCtx.yesterdayIso
  const mode: ComparisonModeType =
    rawQuery.mode === 'entity-vs-entity' ? 'entity-vs-entity' : 'date-vs-date'
  const granularity: ComparisonGranularity =
    rawQuery.granularity === 'range' ? 'range' : 'single'

  let normA = normalizeWindowSelection(rawQuery.periodA, granularity, lastCompletedDayIso)
  let normB =
    mode === 'entity-vs-entity'
      ? normA
      : normalizeWindowSelection(
          rawQuery.periodB,
          granularity,
          shiftIsoDate(lastCompletedDayIso, -7),
        )

  let excludedIncompleteToday = false
  let sameHoursApplied = false
  let cutoffHour24: number | null = null

  const aTouchesToday =
    normA.fromIso <= operationalTodayIso && normA.toIso >= operationalTodayIso
  const bTouchesToday =
    normB.fromIso <= operationalTodayIso && normB.toIso >= operationalTodayIso

  if (aTouchesToday || bTouchesToday) {
    if (
      rawQuery.sameHoursLikeForLike === true &&
      granularity === 'single' &&
      normA.dayCount === 1 &&
      normB.dayCount === 1
    ) {
      sameHoursApplied = true
      cutoffHour24 = Math.max(0, Math.min(23, kwCtx.hour24))
    } else {
      excludedIncompleteToday = true
      if (granularity === 'single') {
        if (normA.fromIso >= operationalTodayIso) {
          normA = normalizeWindowSelection(
            { from: lastCompletedDayIso, to: lastCompletedDayIso },
            'single',
            lastCompletedDayIso,
          )
        }
        if (mode === 'entity-vs-entity') {
          normB = normA
        } else if (
          normB.fromIso >= operationalTodayIso ||
          normB.fromIso === normA.fromIso
        ) {
          const fallbackB = shiftIsoDate(normA.fromIso, -7)
          normB = normalizeWindowSelection(
            { from: fallbackB, to: fallbackB },
            'single',
            fallbackB,
          )
        }
      } else {
        if (normA.toIso >= operationalTodayIso) {
          const clampedFrom =
            normA.fromIso > lastCompletedDayIso ? lastCompletedDayIso : normA.fromIso
          normA = normalizeWindowSelection(
            { from: clampedFrom, to: lastCompletedDayIso },
            'range',
            lastCompletedDayIso,
          )
        }
        if (mode === 'entity-vs-entity') {
          normB = normA
        } else if (normB.toIso >= operationalTodayIso) {
          const endB = shiftIsoDate(normA.fromIso, -1)
          const startB = shiftIsoDate(endB, -(normA.dayCount - 1))
          normB = normalizeWindowSelection({ from: startB, to: endB }, 'range', endB)
        }
      }
    }
  }

  const intradayShare =
    sameHoursApplied && cutoffHour24 !== null ? r2((cutoffHour24 + 1) / 24) : 1

  const likeForLikeMeta: ComparisonLikeForLikeMeta = {
    sameHoursLikeForLike: sameHoursApplied,
    excludedIncompleteToday,
    operationalTodayIso,
    lastCompletedDayIso,
    kuwaitHhMm: kwCtx.hhMm,
    intradayShare,
    helperNoteAr: sameHoursApplied
      ? `مقارنة نفس الساعات (Like-for-Like) حتى الساعة ${kwCtx.hhMm} بتوقيت الكويت`
      : excludedIncompleteToday
        ? `تم استبعاد اليوم غير المكتمل (${operationalTodayIso}) تلقائياً لضمان عدالة المقارنة`
        : '',
    helperNoteEn: sameHoursApplied
      ? `Same-hours Like-for-Like cutoff through ${kwCtx.hhMm} Kuwait time`
      : excludedIncompleteToday
        ? `Incomplete current day (${operationalTodayIso}) automatically excluded for fair comparison`
        : '',
  }

  return { mode, granularity, normA, normB, cutoffHour24, likeForLikeMeta }
}

function extractLiveCubes(
  mode: ComparisonModeType,
  liveInput?: OdooLiveSummary | ErpComparisonLiveCubesInput | null,
): { cubeA: OdooPeriodCube | null; cubeB: OdooPeriodCube | null; lastSyncedAt: string | null } {
  if (!liveInput || typeof liveInput !== 'object') {
    return { cubeA: null, cubeB: null, lastSyncedAt: null }
  }
  if ('cubeA' in liveInput || 'cubeB' in liveInput) {
    const typed = liveInput as ErpComparisonLiveCubesInput
    const cA = typed.cubeA ?? null
    const cB = mode === 'entity-vs-entity' ? (typed.cubeB ?? cA) : (typed.cubeB ?? null)
    return {
      cubeA: cA,
      cubeB: cB,
      lastSyncedAt: cA?.lastSyncAt ?? cB?.lastSyncAt ?? typed.liveSummary?.lastSyncAt ?? null,
    }
  }
  const maybeWithCubes = liveInput as OdooLiveSummary & {
    cubeA?: OdooPeriodCube | null
    cubeB?: OdooPeriodCube | null
  }
  if (maybeWithCubes.cubeA || maybeWithCubes.cubeB) {
    const cA = maybeWithCubes.cubeA ?? null
    const cB =
      mode === 'entity-vs-entity'
        ? (maybeWithCubes.cubeB ?? cA)
        : (maybeWithCubes.cubeB ?? null)
    return {
      cubeA: cA,
      cubeB: cB,
      lastSyncedAt: cA?.lastSyncAt ?? maybeWithCubes.lastSyncAt ?? maybeWithCubes.syncedAt ?? null,
    }
  }
  return { cubeA: null, cubeB: null, lastSyncedAt: maybeWithCubes.lastSyncAt ?? null }
}

function computeCubeSliceTotals(
  cube: OdooPeriodCube | null,
  fromIso: string,
  toIso: string,
  dayCount: number,
  headers: {
    titleEn: string
    titleAr: string
    shortLabelEn: string
    shortLabelAr: string
    badgeEn: string
    badgeAr: string
  },
  scope: ResolvedEntityScope,
  cutoffHour24: number | null,
): ComparisonSliceTotals {
  if (!cube || !cube.connected) {
    return {
      ...headers,
      fromIso,
      toIso,
      dayCount,
      netSalesKwd: 0,
      completedOrders: 0,
      aovKwd: 0,
      foodCostKwd: 0,
      aggregatorFeeKwd: 0,
      foodAndAggregatorCostKwd: 0,
      foodAndAggregatorPct: 0,
      fixedOpexKwd: 0,
      netPocketCashKwd: 0,
      netPocketMarginPct: 0,
      unattributedSalesKwd: 0,
      unattributedOrders: 0,
      accountingAvailable: false,
    }
  }

  const allBrands = scope.brandIds.length === APPROVED_BRAND_IDS.length
  const allBranches =
    scope.branchIds.length === APPROVED_BRANCH_IDS.length && scope.includeUnattributed
  const allChannels = scope.channelIds.length === APPROVED_CHANNEL_IDS.length
  const fullScope = allBrands && allBranches && allChannels && cutoffHour24 === null

  const targetKeys: string[] = [
    ...scope.branchIds,
    ...(scope.includeUnattributed ? [UNATTRIBUTED_BRANCH_ROW_ID] : []),
  ]

  let salesKwd = 0
  let orders = 0

  if (cutoffHour24 !== null && allBrands && allChannels) {
    if (allBranches) {
      for (const hRow of cube.hourlySeries) {
        if (hRow.hour <= cutoffHour24) {
          salesKwd += hRow.netKwd
          orders += hRow.orders
        }
      }
    } else {
      for (const key of targetKeys) {
        for (const hRow of cube.hourlyByBranch[key] ?? []) {
          if (hRow.hour <= cutoffHour24) {
            salesKwd += hRow.netKwd
            orders += hRow.orders
          }
        }
      }
    }
  } else if (fullScope) {
    salesKwd = cube.totals.netSalesKwd
    orders = cube.totals.orders
  } else if (allBrands && allChannels) {
    for (const key of targetKeys) {
      if (key === UNATTRIBUTED_BRANCH_ROW_ID) {
        salesKwd += cube.unattributed.netKwd
        orders += cube.unattributed.orders
      } else {
        const br = cube.byBranch[key as BranchEntityId]
        if (br) {
          salesKwd += br.netKwd
          orders += br.orders
        }
      }
    }
  } else if (allBrands && !allChannels) {
    if (allBranches) {
      for (const ch of scope.channelIds) {
        const chRow = cube.byChannel[ch]
        if (chRow) {
          salesKwd += chRow.netKwd
          orders += chRow.orders
        }
      }
    } else {
      for (const key of targetKeys) {
        const chMap =
          key === UNATTRIBUTED_BRANCH_ROW_ID
            ? cube.unattributed.channels
            : cube.byBranch[key as BranchEntityId]?.channels
        if (!chMap) continue
        for (const ch of scope.channelIds) {
          const chRow = chMap[ch]
          if (chRow) {
            salesKwd += chRow.netKwd
            orders += chRow.orders
          }
        }
      }
    }
  } else {
    if (allBranches) {
      for (const bId of scope.brandIds) {
        const bRow = cube.byBrand[bId]
        if (bRow) {
          salesKwd += bRow.netKwd
          orders += bRow.orders
        }
      }
    } else {
      for (const key of targetKeys) {
        const bMap = cube.brandByBranch[key]
        if (!bMap) continue
        for (const bId of scope.brandIds) {
          const bRow = bMap[bId]
          if (bRow) {
            salesKwd += bRow.netKwd
            orders += bRow.linesCount
          }
        }
      }
    }
  }

  const netSalesKwd = r1(salesKwd)
  const completedOrders = Math.round(orders)
  const aovKwd = completedOrders > 0 ? r2(netSalesKwd / completedOrders) : 0
  const unattributedSalesKwd = scope.includeUnattributed
    ? r1(cube.totals.unattributedSalesKwd)
    : 0
  const unattributedOrders = scope.includeUnattributed
    ? Math.round(cube.totals.unattributedOrders)
    : 0

  const acc = cube.accounting
  if (fullScope && acc && acc.completeAccrualPosted === true && !acc.glIncomplete) {
    const foodCostKwd = r1(acc.cogs)
    const aggregatorFeeKwd = r1(acc.deliveryCommissions ?? 0)
    const foodAndAggregatorCostKwd = r1(foodCostKwd + aggregatorFeeKwd)
    const foodAndAggregatorPct =
      netSalesKwd > 0 ? r1((foodAndAggregatorCostKwd / netSalesKwd) * 100) : 0
    const fixedOpexKwd = r1((acc.expense ?? 0) + (acc.depreciation ?? 0))
    const netPocketCashKwd = r1(acc.operatingProfit)
    const netPocketMarginPct =
      netSalesKwd > 0 ? r1((netPocketCashKwd / netSalesKwd) * 100) : 0

    return {
      ...headers,
      fromIso,
      toIso,
      dayCount,
      netSalesKwd,
      completedOrders,
      aovKwd,
      foodCostKwd,
      aggregatorFeeKwd,
      foodAndAggregatorCostKwd,
      foodAndAggregatorPct,
      fixedOpexKwd,
      netPocketCashKwd,
      netPocketMarginPct,
      unattributedSalesKwd,
      unattributedOrders,
      accountingAvailable: true,
    }
  }

  return {
    ...headers,
    fromIso,
    toIso,
    dayCount,
    netSalesKwd,
    completedOrders,
    aovKwd,
    foodCostKwd: 0,
    aggregatorFeeKwd: 0,
    foodAndAggregatorCostKwd: 0,
    foodAndAggregatorPct: 0,
    fixedOpexKwd: 0,
    netPocketCashKwd: 0,
    netPocketMarginPct: 0,
    unattributedSalesKwd,
    unattributedOrders,
    accountingAvailable: false,
  }
}

function buildLiveDayCell(
  cube: OdooPeriodCube | null,
  dayIso: string | undefined,
  scope: ResolvedEntityScope,
): { salesKwd: number; orders: number } {
  if (!cube || !cube.connected || !dayIso) return { salesKwd: 0, orders: 0 }
  const allBranches =
    scope.branchIds.length === APPROVED_BRANCH_IDS.length && scope.includeUnattributed
  if (allBranches) {
    const found = cube.dailySeries.find((d) => d.day === dayIso)
    return {
      salesKwd: r1(found?.netKwd ?? 0),
      orders: Math.round(found?.orders ?? 0),
    }
  }
  let sales = 0
  let orders = 0
  const dayMap = cube.dailyByBranch[dayIso]
  if (dayMap) {
    for (const brId of scope.branchIds) {
      const cell = dayMap[brId]
      if (cell) {
        sales += cell.netKwd
        orders += cell.orders
      }
    }
  }
  if (scope.includeUnattributed) {
    const unattr = cube.dailyUnattributed[dayIso]
    if (unattr) {
      sales += unattr.netKwd
      orders += unattr.orders
    }
  }
  return { salesKwd: r1(sales), orders: Math.round(orders) }
}

function buildLiveHourCell(
  cube: OdooPeriodCube | null,
  hour24: number,
  scope: ResolvedEntityScope,
  cutoffHour24: number | null,
): { salesKwd: number; orders: number } {
  if (!cube || !cube.connected) return { salesKwd: 0, orders: 0 }
  if (cutoffHour24 !== null && hour24 > cutoffHour24) {
    return { salesKwd: 0, orders: 0 }
  }
  const allBranches =
    scope.branchIds.length === APPROVED_BRANCH_IDS.length && scope.includeUnattributed
  if (allBranches) {
    const row = cube.hourlySeries.find((h) => h.hour === hour24)
    return {
      salesKwd: r1(row?.netKwd ?? 0),
      orders: Math.round(row?.orders ?? 0),
    }
  }
  let sales = 0
  let orders = 0
  for (const brId of scope.branchIds) {
    const row = (cube.hourlyByBranch[brId] ?? []).find((h) => h.hour === hour24)
    if (row) {
      sales += row.netKwd
      orders += row.orders
    }
  }
  if (scope.includeUnattributed) {
    const row = (cube.hourlyByBranch[UNATTRIBUTED_BRANCH_ROW_ID] ?? []).find(
      (h) => h.hour === hour24,
    )
    if (row) {
      sales += row.netKwd
      orders += row.orders
    }
  }
  return { salesKwd: r1(sales), orders: Math.round(orders) }
}

function buildChartBuckets(
  chartKind: 'hourly-14' | 'daily-aligned',
  datesA: string[],
  datesB: string[],
  cubeA: OdooPeriodCube | null,
  cubeB: OdooPeriodCube | null,
  scopeA: ResolvedEntityScope,
  scopeB: ResolvedEntityScope,
  cutoffHour24: number | null,
): ComparisonChartBucket[] {
  if (chartKind === 'hourly-14') {
    const dayA = datesA[0]
    const dayB = datesB[0]
    const bA = formatCalendarDateBadge(dayA, false, false)
    const bB = formatCalendarDateBadge(dayB, false, false)

    let cumA = 0
    let cumB = 0
    return OPERATING_HOURS_14.map((slot, index) => {
      const cellA = buildLiveHourCell(cubeA, slot.hour24, scopeA, cutoffHour24)
      const cellB = buildLiveHourCell(cubeB, slot.hour24, scopeB, cutoffHour24)
      cumA = r1(cumA + cellA.salesKwd)
      cumB = r1(cumB + cellB.salesKwd)
      const delta = r1(cellA.salesKwd - cellB.salesKwd)
      return {
        id: `h-${slot.hour24}`,
        index,
        labelEn: slot.compactEn,
        labelAr: slot.labelAr,
        metaA: `${bA.shortDdMm} · ${slot.slotKey}`,
        metaB: `${bB.shortDdMm} · ${slot.slotKey}`,
        seriesA: cellA.salesKwd,
        seriesB: cellB.salesKwd,
        delta,
        deltaPct: safePctDelta(cellA.salesKwd, cellB.salesKwd),
        cumulativeA: cumA,
        cumulativeB: cumB,
        ordersA: cellA.orders,
        ordersB: cellB.orders,
        ordersDelta: cellA.orders - cellB.orders,
        profitA: 0,
        profitB: 0,
        profitDelta: 0,
        cumulativeProfitA: 0,
        cumulativeProfitB: 0,
      }
    })
  }

  const maxLen = Math.max(datesA.length, datesB.length)
  let cumA = 0
  let cumB = 0
  const buckets: ComparisonChartBucket[] = []

  for (let i = 0; i < maxLen; i++) {
    const isoA = datesA[i]
    const isoB = datesB[i]
    const cellA = buildLiveDayCell(cubeA, isoA, scopeA)
    const cellB = buildLiveDayCell(cubeB, isoB, scopeB)
    cumA = r1(cumA + cellA.salesKwd)
    cumB = r1(cumB + cellB.salesKwd)

    const bAAr = isoA ? formatCalendarDateBadge(isoA, true, false) : null
    const bAEn = isoA ? formatCalendarDateBadge(isoA, false, false) : null
    const bBEn = isoB ? formatCalendarDateBadge(isoB, false, false) : null

    const dayNum = i + 1
    buckets.push({
      id: `d-${dayNum}`,
      index: i,
      labelAr:
        maxLen <= 10 && bAAr
          ? `${bAAr.weekdayShort} ${bAAr.shortDdMm}`
          : `يوم ${dayNum}`,
      labelEn:
        maxLen <= 10 && bAEn
          ? `${bAEn.weekdayShort} ${bAEn.shortDdMm}`
          : `Day ${dayNum}`,
      metaA: bAEn ? `${bAEn.weekdayShort} ${bAEn.shortDdMm}` : '—',
      metaB: bBEn ? `${bBEn.weekdayShort} ${bBEn.shortDdMm}` : '—',
      seriesA: cellA.salesKwd,
      seriesB: cellB.salesKwd,
      delta: r1(cellA.salesKwd - cellB.salesKwd),
      deltaPct: safePctDelta(cellA.salesKwd, cellB.salesKwd),
      cumulativeA: cumA,
      cumulativeB: cumB,
      ordersA: cellA.orders,
      ordersB: cellB.orders,
      ordersDelta: cellA.orders - cellB.orders,
      profitA: 0,
      profitB: 0,
      profitDelta: 0,
      cumulativeProfitA: 0,
      cumulativeProfitB: 0,
    })
  }

  return buckets
}

function computeBranchCell(
  cube: OdooPeriodCube | null,
  rowId: BranchEntityId | typeof UNATTRIBUTED_BRANCH_ROW_ID,
  scope: ResolvedEntityScope,
  cutoffHour24: number | null,
): { salesKwd: number; orders: number } {
  if (!cube || !cube.connected) return { salesKwd: 0, orders: 0 }
  const allBrands = scope.brandIds.length === APPROVED_BRAND_IDS.length
  const allChannels = scope.channelIds.length === APPROVED_CHANNEL_IDS.length

  if (cutoffHour24 !== null && allBrands && allChannels) {
    let sales = 0
    let orders = 0
    for (const h of cube.hourlyByBranch[rowId] ?? []) {
      if (h.hour <= cutoffHour24) {
        sales += h.netKwd
        orders += h.orders
      }
    }
    return { salesKwd: r1(sales), orders: Math.round(orders) }
  }

  if (allBrands && allChannels) {
    if (rowId === UNATTRIBUTED_BRANCH_ROW_ID) {
      return {
        salesKwd: r1(cube.unattributed.netKwd),
        orders: Math.round(cube.unattributed.orders),
      }
    }
    const br = cube.byBranch[rowId]
    return {
      salesKwd: r1(br?.netKwd ?? 0),
      orders: Math.round(br?.orders ?? 0),
    }
  }

  if (allBrands && !allChannels) {
    const chMap =
      rowId === UNATTRIBUTED_BRANCH_ROW_ID
        ? cube.unattributed.channels
        : cube.byBranch[rowId]?.channels
    let sales = 0
    let orders = 0
    if (chMap) {
      for (const ch of scope.channelIds) {
        sales += chMap[ch]?.netKwd ?? 0
        orders += chMap[ch]?.orders ?? 0
      }
    }
    return { salesKwd: r1(sales), orders: Math.round(orders) }
  }

  const bMap = cube.brandByBranch[rowId]
  let sales = 0
  let lines = 0
  if (bMap) {
    for (const bId of scope.brandIds) {
      sales += bMap[bId]?.netKwd ?? 0
      lines += bMap[bId]?.linesCount ?? 0
    }
  }
  return { salesKwd: r1(sales), orders: Math.round(lines) }
}

function computeBrandCell(
  cube: OdooPeriodCube | null,
  brandId: BrandEntityId,
  scope: ResolvedEntityScope,
): { salesKwd: number; orders: number } {
  if (!cube || !cube.connected) return { salesKwd: 0, orders: 0 }
  const allBranches =
    scope.branchIds.length === APPROVED_BRANCH_IDS.length && scope.includeUnattributed
  if (allBranches) {
    const bRow = cube.byBrand[brandId]
    return {
      salesKwd: r1(bRow?.netKwd ?? 0),
      orders: Math.round(bRow?.orders ?? 0),
    }
  }
  let sales = 0
  let lines = 0
  const targetKeys: string[] = [
    ...scope.branchIds,
    ...(scope.includeUnattributed ? [UNATTRIBUTED_BRANCH_ROW_ID] : []),
  ]
  for (const key of targetKeys) {
    const cell = cube.brandByBranch[key]?.[brandId]
    if (cell) {
      sales += cell.netKwd
      lines += cell.linesCount
    }
  }
  return { salesKwd: r1(sales), orders: Math.round(lines) }
}

function computeChannelCell(
  cube: OdooPeriodCube | null,
  channelId: ChannelEntityId,
  scope: ResolvedEntityScope,
): { salesKwd: number; orders: number } {
  if (!cube || !cube.connected) return { salesKwd: 0, orders: 0 }
  const allBranches =
    scope.branchIds.length === APPROVED_BRANCH_IDS.length && scope.includeUnattributed
  if (allBranches) {
    const chRow = cube.byChannel[channelId]
    return {
      salesKwd: r1(chRow?.netKwd ?? 0),
      orders: Math.round(chRow?.orders ?? 0),
    }
  }
  let sales = 0
  let orders = 0
  for (const brId of scope.branchIds) {
    const cell = cube.byBranch[brId]?.channels?.[channelId]
    if (cell) {
      sales += cell.netKwd
      orders += cell.orders
    }
  }
  if (scope.includeUnattributed) {
    const cell = cube.unattributed.channels?.[channelId]
    if (cell) {
      sales += cell.netKwd
      orders += cell.orders
    }
  }
  return { salesKwd: r1(sales), orders: Math.round(orders) }
}

function classifyRowTier(deltaPct: number): 'green' | 'yellow' | 'red' {
  if (deltaPct >= 2) return 'green'
  if (deltaPct <= -2) return 'red'
  return 'yellow'
}

function buildBreakdownRows(
  dimension: BreakdownDimension,
  cubeA: OdooPeriodCube | null,
  cubeB: OdooPeriodCube | null,
  scopeA: ResolvedEntityScope,
  scopeB: ResolvedEntityScope,
  cutoffHour24: number | null,
): EntityVarianceRow[] {
  const rowIds: string[] =
    dimension === 'branch'
      ? [
          ...APPROVED_BRANCH_IDS,
          ...(scopeA.includeUnattributed || scopeB.includeUnattributed
            ? [UNATTRIBUTED_BRANCH_ROW_ID]
            : []),
        ]
      : dimension === 'brand'
        ? [...APPROVED_BRAND_IDS]
        : [...APPROVED_CHANNEL_IDS]

  const rawRows = rowIds.map((id) => {
    const inA =
      dimension === 'branch'
        ? id === UNATTRIBUTED_BRANCH_ROW_ID
          ? scopeA.includeUnattributed
          : scopeA.branchIds.includes(id as BranchEntityId)
        : dimension === 'brand'
          ? scopeA.brandIds.includes(id as BrandEntityId)
          : scopeA.channelIds.includes(id as ChannelEntityId)

    const inB =
      dimension === 'branch'
        ? id === UNATTRIBUTED_BRANCH_ROW_ID
          ? scopeB.includeUnattributed
          : scopeB.branchIds.includes(id as BranchEntityId)
        : dimension === 'brand'
          ? scopeB.brandIds.includes(id as BrandEntityId)
          : scopeB.channelIds.includes(id as ChannelEntityId)

    const cellA = !inA
      ? { salesKwd: 0, orders: 0 }
      : dimension === 'branch'
        ? computeBranchCell(
            cubeA,
            id as BranchEntityId | typeof UNATTRIBUTED_BRANCH_ROW_ID,
            scopeA,
            cutoffHour24,
          )
        : dimension === 'brand'
          ? computeBrandCell(cubeA, id as BrandEntityId, scopeA)
          : computeChannelCell(cubeA, id as ChannelEntityId, scopeA)

    const cellB = !inB
      ? { salesKwd: 0, orders: 0 }
      : dimension === 'branch'
        ? computeBranchCell(
            cubeB,
            id as BranchEntityId | typeof UNATTRIBUTED_BRANCH_ROW_ID,
            scopeB,
            cutoffHour24,
          )
        : dimension === 'brand'
          ? computeBrandCell(cubeB, id as BrandEntityId, scopeB)
          : computeChannelCell(cubeB, id as ChannelEntityId, scopeB)

    const isCompatible =
      dimension === 'branch'
        ? id === UNATTRIBUTED_BRANCH_ROW_ID
          ? true
          : scopeA.brandIds.some((b) => isBrandBranchCompatible(b, id as BranchEntityId))
        : dimension === 'brand'
          ? scopeA.branchIds.some((br) => isBrandBranchCompatible(id as BrandEntityId, br))
          : true

    return { id, cellA, cellB, isCompatible }
  })

  const totalSalesA = rawRows.reduce((acc, r) => acc + r.cellA.salesKwd, 0)

  const rows: EntityVarianceRow[] = rawRows.map(({ id, cellA, cellB, isCompatible }) => {
    const meta = getEntityNames(dimension, id)
    const isUnattributed = id === UNATTRIBUTED_BRANCH_ROW_ID
    const deltaKwd = r1(cellA.salesKwd - cellB.salesKwd)
    const deltaPct = safePctDelta(cellA.salesKwd, cellB.salesKwd)
    const ordersDelta = cellA.orders - cellB.orders
    return {
      id,
      dimension,
      nameEn: meta.nameEn,
      nameAr: meta.nameAr,
      subMetaEn: meta.subMetaEn,
      subMetaAr: meta.subMetaAr,
      isCompatible,
      isUnattributed,
      accountingAvailable: false,
      valueA: cellA.salesKwd,
      valueB: cellB.salesKwd,
      deltaKwd,
      deltaPct,
      ordersA: cellA.orders,
      ordersB: cellB.orders,
      ordersDelta,
      ordersDeltaPct: safePctDelta(cellA.orders, cellB.orders),
      aovA: cellA.orders > 0 ? r2(cellA.salesKwd / cellA.orders) : 0,
      aovB: cellB.orders > 0 ? r2(cellB.salesKwd / cellB.orders) : 0,
      foodAggCostA: 0,
      foodAggCostB: 0,
      netProfitA: 0,
      netProfitB: 0,
      netProfitDeltaKwd: 0,
      marginPctA: 0,
      marginPctB: 0,
      marginDeltaPp: 0,
      shareOfTotalAPct: totalSalesA > 0 ? r1((cellA.salesKwd / totalSalesA) * 100) : 0,
      tier: classifyRowTier(deltaPct),
    }
  })

  return rows.sort((a, b) => {
    if (a.isUnattributed && !b.isUnattributed) return 1
    if (!a.isUnattributed && b.isUnattributed) return -1
    return b.valueA - a.valueA
  })
}

function makeKpiDelta(params: {
  id: ExecutiveKpiId
  labelEn: string
  labelAr: string
  unit: 'KWD' | 'orders' | 'pct'
  polarity: 'higher-is-better' | 'lower-is-better'
  valueA: number
  valueB: number
  available?: boolean
  unavailableReasonAr?: string
  unavailableReasonEn?: string
  shareOfSalesA?: number
  shareOfSalesB?: number
}): ExecutiveKpiDelta {
  const available = params.available ?? true
  const valA = available ? params.valueA : 0
  const valB = available ? params.valueB : 0
  const deltaAbs =
    params.unit === 'orders' ? Math.round(valA - valB) : r2(valA - valB)
  const deltaPct =
    params.unit === 'pct' ? r1(valA - valB) : safePctDelta(valA, valB)
  const deltaBps = params.unit === 'pct' ? Math.round((valA - valB) * 100) : undefined
  const trend: 'up' | 'down' | 'flat' =
    Math.abs(deltaPct) < 0.3 ? 'flat' : deltaAbs > 0 ? 'up' : 'down'
  const isFavorable =
    trend === 'flat'
      ? true
      : params.polarity === 'higher-is-better'
        ? deltaAbs >= 0
        : deltaAbs <= 0

  return {
    id: params.id,
    labelEn: params.labelEn,
    labelAr: params.labelAr,
    unit: params.unit,
    polarity: params.polarity,
    available,
    unavailableReasonAr: params.unavailableReasonAr,
    unavailableReasonEn: params.unavailableReasonEn,
    valueA: valA,
    valueB: valB,
    shareOfSalesA: params.shareOfSalesA,
    shareOfSalesB: params.shareOfSalesB,
    deltaAbs,
    deltaPct,
    deltaBps,
    trend,
    isFavorable,
  }
}

function toInsightEntity(row: EntityVarianceRow | undefined): ComparisonAutoInsightEntity | null {
  if (!row) return null
  return {
    id: row.id,
    dimension: row.dimension,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    valueA: row.valueA,
    valueB: row.valueB,
    deltaKwd: row.deltaKwd,
    deltaPct: row.deltaPct,
    netProfitDeltaKwd: row.netProfitDeltaKwd,
  }
}

function buildInsights(
  connected: boolean,
  noData: boolean,
  selectionA: ComparisonSliceTotals,
  selectionB: ComparisonSliceTotals,
  byBranch: EntityVarianceRow[],
  byBrand: EntityVarianceRow[],
  accountingAvailable: boolean,
): ErpComparisonAutoInsights {
  if (!connected || noData) {
    return {
      topGainer: null,
      biggestDecline: null,
      topGainerBrand: null,
      biggestDeclineBrand: null,
      topGainerBranch: null,
      biggestDeclineBranch: null,
      headlineAr: NO_DATA_AR,
      headlineEn: NO_DATA_EN,
      summaryAr: NO_DATA_AR,
      summaryEn: NO_DATA_EN,
    }
  }

  const mappedBranches = byBranch.filter((r) => !r.isUnattributed)
  const sortedBr = [...mappedBranches].sort((a, b) => b.deltaKwd - a.deltaKwd)
  const topGainerBranch =
    sortedBr[0] && sortedBr[0].deltaKwd > 0 ? toInsightEntity(sortedBr[0]) : null
  const biggestDeclineBranch =
    sortedBr.length > 0 && sortedBr[sortedBr.length - 1].deltaKwd < 0
      ? toInsightEntity(sortedBr[sortedBr.length - 1])
      : null

  const sortedBrand = [...byBrand].sort((a, b) => b.deltaKwd - a.deltaKwd)
  const topGainerBrand =
    sortedBrand[0] && sortedBrand[0].deltaKwd > 0 ? toInsightEntity(sortedBrand[0]) : null
  const biggestDeclineBrand =
    sortedBrand.length > 0 && sortedBrand[sortedBrand.length - 1].deltaKwd < 0
      ? toInsightEntity(sortedBrand[sortedBrand.length - 1])
      : null

  const topGainer = topGainerBranch ?? topGainerBrand
  const biggestDecline = biggestDeclineBranch ?? biggestDeclineBrand

  const salesDeltaKwd = r1(selectionA.netSalesKwd - selectionB.netSalesKwd)
  const salesDeltaPct = safePctDelta(selectionA.netSalesKwd, selectionB.netSalesKwd)
  const sign = salesDeltaKwd > 0 ? '+' : ''

  const headlineAr = `صافي المبيعات من Odoo: ${selectionA.netSalesKwd.toLocaleString('en-US')} د.ك مقابل ${selectionB.netSalesKwd.toLocaleString('en-US')} د.ك (${sign}${salesDeltaPct}%)`
  const headlineEn = `Live Odoo Net Sales: ${selectionA.netSalesKwd.toLocaleString('en-US')} KWD vs ${selectionB.netSalesKwd.toLocaleString('en-US')} KWD (${sign}${salesDeltaPct}%)`

  const unattrPartAr =
    selectionA.unattributedSalesKwd > 0 || selectionB.unattributedSalesKwd > 0
      ? ` · بند «${UNMAPPED_TERMINALS_LABEL_AR}» مستقل: ${selectionA.unattributedSalesKwd.toLocaleString('en-US')} د.ك في (أ) مقابل ${selectionB.unattributedSalesKwd.toLocaleString('en-US')} د.ك في (ب).`
      : ''
  const unattrPartEn =
    selectionA.unattributedSalesKwd > 0 || selectionB.unattributedSalesKwd > 0
      ? ` · Standalone "${UNMAPPED_TERMINALS_LABEL_EN}": ${selectionA.unattributedSalesKwd.toLocaleString('en-US')} KWD in (A) vs ${selectionB.unattributedSalesKwd.toLocaleString('en-US')} KWD in (B).`
      : ''

  const glPartAr = accountingAvailable ? '' : ` · ${GL_INCOMPLETE_AR}.`
  const glPartEn = accountingAvailable ? '' : ` · ${GL_INCOMPLETE_EN}.`

  return {
    topGainer,
    biggestDecline,
    topGainerBrand,
    biggestDeclineBrand,
    topGainerBranch,
    biggestDeclineBranch,
    headlineAr,
    headlineEn,
    summaryAr: `${headlineAr}${unattrPartAr}${glPartAr}`,
    summaryEn: `${headlineEn}${unattrPartEn}${glPartEn}`,
  }
}

function buildScopeSummary(query: ErpComparisonQuery): { ar: string; en: string } {
  const brandAr =
    query.brandIds === 'all' || query.brandIds.length >= APPROVED_BRAND_IDS.length
      ? 'كل العلامات (6)'
      : query.brandIds.map((id) => getBrandLabel(id, true)).join(' + ')
  const brandEn =
    query.brandIds === 'all' || query.brandIds.length >= APPROVED_BRAND_IDS.length
      ? 'All Brands (6)'
      : query.brandIds.map((id) => getBrandLabel(id, false)).join(' + ')

  const branchAr =
    query.branchIds === 'all' || query.branchIds.length >= APPROVED_BRANCH_IDS.length
      ? `الفروع السبعة (7) + ${UNMAPPED_TERMINALS_LABEL_AR}`
      : query.branchIds.map((id) => getBranchLabel(id, true)).join(' + ')
  const branchEn =
    query.branchIds === 'all' || query.branchIds.length >= APPROVED_BRANCH_IDS.length
      ? `All 7 Branches + ${UNMAPPED_TERMINALS_LABEL_EN}`
      : query.branchIds.map((id) => getBranchLabel(id, false)).join(' + ')

  const channelAr =
    query.channelIds === 'all' || query.channelIds.length >= APPROVED_CHANNEL_IDS.length
      ? 'كل القنوات'
      : query.channelIds.map((id) => getChannelLabel(id, true)).join(' + ')
  const channelEn =
    query.channelIds === 'all' || query.channelIds.length >= APPROVED_CHANNEL_IDS.length
      ? 'All Channels'
      : query.channelIds.map((id) => getChannelLabel(id, false)).join(' + ')

  return {
    ar: `${brandAr} · ${branchAr} · ${channelAr}`,
    en: `${brandEn} · ${branchEn} · ${channelEn}`,
  }
}

/**
 * Computes the complete executive comparison strictly from live `OdooPeriodCube` A & B.
 */
export function computeErpComparison(
  rawQuery: ErpComparisonQuery,
  liveInput?: OdooLiveSummary | ErpComparisonLiveCubesInput | null,
): ErpComparisonResult {
  const { mode, granularity, normA, normB, cutoffHour24, likeForLikeMeta } =
    normalizeComparisonQueryWindows(rawQuery)

  const baseBrands = sanitizeBrandSelection(rawQuery.brandIds)
  const baseBranches = sanitizeBranchSelection(rawQuery.branchIds)
  const baseChannels = sanitizeChannelSelection(rawQuery.channelIds)

  const isScopeCompatible = baseBranches.branchIds.some((br) =>
    baseBrands.some((b) => isBrandBranchCompatible(b, br)),
  )

  let scopeA: ResolvedEntityScope = {
    brandIds: baseBrands,
    branchIds: baseBranches.branchIds,
    includeUnattributed: baseBranches.includeUnattributed,
    channelIds: baseChannels,
  }
  let scopeB: ResolvedEntityScope = {
    brandIds: baseBrands,
    branchIds: baseBranches.branchIds,
    includeUnattributed: baseBranches.includeUnattributed,
    channelIds: baseChannels,
  }

  let headersA = formatSliceHeaderLabels(normA.fromIso, normA.toIso, normA.dayCount)
  let headersB = formatSliceHeaderLabels(normB.fromIso, normB.toIso, normB.dayCount)

  if (mode === 'entity-vs-entity') {
    const dim: EntityComparisonDimension =
      rawQuery.entityDimension === 'branch' ? 'branch' : 'brand'
    if (dim === 'branch') {
      const brA: BranchEntityId = (APPROVED_BRANCH_IDS as readonly string[]).includes(
        rawQuery.entityA ?? '',
      )
        ? (rawQuery.entityA as BranchEntityId)
        : APPROVED_BRANCH_IDS[0]
      const brB: BranchEntityId = (APPROVED_BRANCH_IDS as readonly string[]).includes(
        rawQuery.entityB ?? '',
      )
        ? (rawQuery.entityB as BranchEntityId)
        : brA === APPROVED_BRANCH_IDS[1]
          ? APPROVED_BRANCH_IDS[2]
          : APPROVED_BRANCH_IDS[1]
      scopeA = { ...scopeA, branchIds: [brA], includeUnattributed: false }
      scopeB = { ...scopeB, branchIds: [brB], includeUnattributed: false }
      const arA = getBranchLabel(brA, true)
      const enA = getBranchLabel(brA, false)
      const arB = getBranchLabel(brB, true)
      const enB = getBranchLabel(brB, false)
      headersA = {
        ...headersA,
        titleAr: `${arA} (${headersA.shortLabelAr})`,
        titleEn: `${enA} (${headersA.shortLabelEn})`,
        shortLabelAr: arA,
        shortLabelEn: enA,
      }
      headersB = {
        ...headersB,
        titleAr: `${arB} (${headersB.shortLabelAr})`,
        titleEn: `${enB} (${headersB.shortLabelEn})`,
        shortLabelAr: arB,
        shortLabelEn: enB,
      }
    } else {
      const bA: BrandEntityId = (APPROVED_BRAND_IDS as readonly string[]).includes(
        rawQuery.entityA ?? '',
      )
        ? (rawQuery.entityA as BrandEntityId)
        : APPROVED_BRAND_IDS[0]
      const bB: BrandEntityId = (APPROVED_BRAND_IDS as readonly string[]).includes(
        rawQuery.entityB ?? '',
      )
        ? (rawQuery.entityB as BrandEntityId)
        : bA === APPROVED_BRAND_IDS[1]
          ? APPROVED_BRAND_IDS[2]
          : APPROVED_BRAND_IDS[1]
      scopeA = { ...scopeA, brandIds: [bA] }
      scopeB = { ...scopeB, brandIds: [bB] }
      const arA = getBrandLabel(bA, true)
      const enA = getBrandLabel(bA, false)
      const arB = getBrandLabel(bB, true)
      const enB = getBrandLabel(bB, false)
      headersA = {
        ...headersA,
        titleAr: `${arA} (${headersA.shortLabelAr})`,
        titleEn: `${enA} (${headersA.shortLabelEn})`,
        shortLabelAr: arA,
        shortLabelEn: enA,
      }
      headersB = {
        ...headersB,
        titleAr: `${arB} (${headersB.shortLabelAr})`,
        titleEn: `${enB} (${headersB.shortLabelEn})`,
        shortLabelAr: arB,
        shortLabelEn: enB,
      }
    }
  }

  const { cubeA, cubeB, lastSyncedAt } = extractLiveCubes(mode, liveInput)
  const connected = Boolean(cubeA?.connected && cubeB?.connected)
  const noData = !connected || Boolean(cubeA?.noData && cubeB?.noData)
  const messageAr = !connected || noData ? NO_DATA_AR : undefined

  const selectionA = computeCubeSliceTotals(
    cubeA,
    normA.fromIso,
    normA.toIso,
    normA.dayCount,
    headersA,
    scopeA,
    cutoffHour24,
  )
  const selectionB = computeCubeSliceTotals(
    cubeB,
    normB.fromIso,
    normB.toIso,
    normB.dayCount,
    headersB,
    scopeB,
    cutoffHour24,
  )

  const accountingAvailable =
    connected && selectionA.accountingAvailable && selectionB.accountingAvailable
  const accountingUnavailableReasonAr = accountingAvailable ? null : GL_INCOMPLETE_AR
  const accountingUnavailableReasonEn = accountingAvailable ? null : GL_INCOMPLETE_EN

  const netSalesKpi = makeKpiDelta({
    id: 'netSales',
    labelAr: 'صافي المبيعات (Odoo POS)',
    labelEn: 'Net Sales (Odoo POS)',
    unit: 'KWD',
    polarity: 'higher-is-better',
    valueA: selectionA.netSalesKwd,
    valueB: selectionB.netSalesKwd,
    available: connected,
  })
  const completedOrdersKpi = makeKpiDelta({
    id: 'completedOrders',
    labelAr: 'الطلبات المكتملة',
    labelEn: 'Completed Orders',
    unit: 'orders',
    polarity: 'higher-is-better',
    valueA: selectionA.completedOrders,
    valueB: selectionB.completedOrders,
    available: connected,
  })
  const averageCheckKpi = makeKpiDelta({
    id: 'averageCheck',
    labelAr: 'متوسط الفاتورة (AOV)',
    labelEn: 'Average Check (AOV)',
    unit: 'KWD',
    polarity: 'higher-is-better',
    valueA: selectionA.aovKwd,
    valueB: selectionB.aovKwd,
    available: connected,
  })
  const foodAndAggregatorCostKpi = makeKpiDelta({
    id: 'foodAndAggregatorCost',
    labelAr: 'تكلفة المواد وعمولات المنصات (GL)',
    labelEn: 'COGS & Platform Commissions (GL)',
    unit: 'KWD',
    polarity: 'lower-is-better',
    valueA: selectionA.foodAndAggregatorCostKwd,
    valueB: selectionB.foodAndAggregatorCostKwd,
    available: accountingAvailable,
    unavailableReasonAr: GL_INCOMPLETE_AR,
    unavailableReasonEn: GL_INCOMPLETE_EN,
    shareOfSalesA: accountingAvailable ? selectionA.foodAndAggregatorPct : undefined,
    shareOfSalesB: accountingAvailable ? selectionB.foodAndAggregatorPct : undefined,
  })
  const netPocketCashKpi = makeKpiDelta({
    id: 'netPocketCash',
    labelAr: 'صافي الربح التشغيلي (GL)',
    labelEn: 'Operating Net Profit (GL)',
    unit: 'KWD',
    polarity: 'higher-is-better',
    valueA: selectionA.netPocketCashKwd,
    valueB: selectionB.netPocketCashKwd,
    available: accountingAvailable,
    unavailableReasonAr: GL_INCOMPLETE_AR,
    unavailableReasonEn: GL_INCOMPLETE_EN,
  })
  const netPocketMarginKpi = makeKpiDelta({
    id: 'netPocketMargin',
    labelAr: 'هامش الربح التشغيلي (GL)',
    labelEn: 'Operating Net Margin (GL)',
    unit: 'pct',
    polarity: 'higher-is-better',
    valueA: selectionA.netPocketMarginPct,
    valueB: selectionB.netPocketMarginPct,
    available: accountingAvailable,
    unavailableReasonAr: GL_INCOMPLETE_AR,
    unavailableReasonEn: GL_INCOMPLETE_EN,
  })

  const kpiList = [
    netSalesKpi,
    completedOrdersKpi,
    averageCheckKpi,
    foodAndAggregatorCostKpi,
    netPocketCashKpi,
    netPocketMarginKpi,
  ] as const

  const chartKind: 'hourly-14' | 'daily-aligned' =
    granularity === 'single' && normA.dayCount === 1 && normB.dayCount === 1
      ? 'hourly-14'
      : 'daily-aligned'

  const chartBuckets = buildChartBuckets(
    chartKind,
    normA.dates,
    normB.dates,
    cubeA,
    cubeB,
    scopeA,
    scopeB,
    cutoffHour24,
  )

  const byBranch = buildBreakdownRows('branch', cubeA, cubeB, scopeA, scopeB, cutoffHour24)
  const byBrand = buildBreakdownRows('brand', cubeA, cubeB, scopeA, scopeB, cutoffHour24)
  const byChannel = buildBreakdownRows('channel', cubeA, cubeB, scopeA, scopeB, cutoffHour24)

  const insights = buildInsights(
    connected,
    noData,
    selectionA,
    selectionB,
    byBranch,
    byBrand,
    accountingAvailable,
  )

  const scopeSummary = buildScopeSummary(rawQuery)

  const branchSumA = r1(byBranch.reduce((s, r) => s + r.valueA, 0))
  const chartSumA = r1(chartBuckets.reduce((s, b) => s + b.seriesA, 0))

  return {
    connected,
    noData,
    ...(messageAr ? { messageAr } : {}),
    query: rawQuery,
    isScopeCompatible,
    scopeSummaryEn: scopeSummary.en,
    scopeSummaryAr: scopeSummary.ar,
    selectionA,
    selectionB,
    unattributedA: {
      salesKwd: selectionA.unattributedSalesKwd,
      orders: selectionA.unattributedOrders,
    },
    unattributedB: {
      salesKwd: selectionB.unattributedSalesKwd,
      orders: selectionB.unattributedOrders,
    },
    kpiList,
    kpis: {
      netSales: netSalesKpi,
      completedOrders: completedOrdersKpi,
      averageCheck: averageCheckKpi,
      foodAndAggregatorCost: foodAndAggregatorCostKpi,
      netPocketCash: netPocketCashKpi,
      netPocketMargin: netPocketMarginKpi,
    },
    chartKind,
    chartBuckets,
    byBranch,
    byBrand,
    byChannel,
    insights,
    likeForLikeMeta,
    accountingAvailable,
    accountingUnavailableReasonAr,
    accountingUnavailableReasonEn,
    lastSyncedAt,
    reconciliation: {
      maxSalesGapKwd: connected ? r2(Math.abs(selectionA.netSalesKwd - branchSumA)) : 0,
      maxProfitGapKwd: 0,
      maxOrdersGap: 0,
      maxChartSalesGapKwd: connected ? r2(Math.abs(selectionA.netSalesKwd - chartSumA)) : 0,
    },
  }
}

export function buildComparisonCsv(result: ErpComparisonResult, isAr: boolean): string {
  const lines: string[] = []
  const esc = (v: string | number | null | undefined) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  lines.push(
    isAr
      ? `تقرير المقارنة الحية من Odoo,${esc(result.selectionA.titleAr)},مقابل,${esc(result.selectionB.titleAr)}`
      : `Live Odoo Comparison Report,${esc(result.selectionA.titleEn)},VS,${esc(result.selectionB.titleEn)}`,
  )
  lines.push(
    isAr
      ? `النطاق,${esc(result.scopeSummaryAr)}`
      : `Scope,${esc(result.scopeSummaryEn)}`,
  )
  if (!result.connected || result.noData) {
    lines.push(isAr ? `الحالة,${NO_DATA_AR}` : `Status,${NO_DATA_EN}`)
    return `\uFEFF${lines.join('\r\n')}`
  }
  lines.push('')

  lines.push(
    isAr
      ? 'المؤشر,الفترة (أ),الفترة (ب),الفرق,التغير %'
      : 'KPI,Selection A,Selection B,Variance,Variance %',
  )
  for (const k of result.kpiList) {
    const unavail = isAr ? GL_INCOMPLETE_AR : GL_INCOMPLETE_EN
    lines.push(
      [
        esc(isAr ? k.labelAr : k.labelEn),
        esc(k.available === false ? unavail : k.valueA),
        esc(k.available === false ? unavail : k.valueB),
        esc(k.available === false ? '—' : k.deltaAbs),
        esc(k.available === false ? '—' : `${k.deltaPct}%`),
      ].join(','),
    )
  }
  lines.push('')

  const pushTable = (titleAr: string, titleEn: string, rows: EntityVarianceRow[]) => {
    lines.push(isAr ? titleAr : titleEn)
    lines.push(
      isAr
        ? 'الاسم,مبيعات (أ) د.ك,مبيعات (ب) د.ك,الفرق د.ك,التغير %,طلبات (أ),طلبات (ب)'
        : 'Entity,Sales A (KWD),Sales B (KWD),Delta (KWD),Delta %,Orders A,Orders B',
    )
    for (const r of rows) {
      lines.push(
        [
          esc(isAr ? r.nameAr : r.nameEn),
          esc(r.valueA),
          esc(r.valueB),
          esc(r.deltaKwd),
          esc(`${r.deltaPct}%`),
          esc(r.ordersA),
          esc(r.ordersB),
        ].join(','),
      )
    }
    lines.push('')
  }

  pushTable(
    `الفروع السبعة + ${UNMAPPED_TERMINALS_LABEL_AR}`,
    `7 Operational Branches + ${UNMAPPED_TERMINALS_LABEL_EN}`,
    result.byBranch,
  )
  pushTable('العلامات المعتمدة (6)', '6 Approved Brands', result.byBrand)
  pushTable('قنوات الدفع الفعلية', 'Live Payment Channels', result.byChannel)

  return `\uFEFF${lines.join('\r\n')}`
}
