import type {
  AdvisorReport,
  FeryalBranchesData,
  FeryalBranchGroup,
  FeryalBranchPackItem,
  FeryalBrandsData,
  FeryalChannelsData,
  FeryalCompanyTotalsData,
  FeryalContextPack,
  FeryalDeltasData,
  FeryalGlData,
  FeryalHourlyData,
  FeryalHourlyPoint,
  FeryalHrData,
  FeryalPackSection,
  FeryalPackSource,
  FeryalPurchasesData,
  FeryalReceivablesData,
  FeryalStockData,
  FeryalTopProductsData,
  FeryalUnattributedData,
} from '@/lib/feryal-context-types'
import {
  ALL_FERYAL_BRANCHES,
  APPROVED_FERYAL_BRAND_LIST,
  APPROVED_FERYAL_CHANNEL_LIST,
  shiftIsoDateDays,
  type ApprovedFeryalBranchId,
  type ApprovedFeryalChannelId,
} from '@/lib/feryal-intent'
import { isWindowWithinClosedMonths } from '@/lib/aether/closed-month-policy'
import {
  PER_CUSTOMER_DUE_DATE_AGING_VERIFIED,
  RECEIVABLES_PENDING_STATUS,
} from '@/lib/aether/receivables-status'
import { logger } from '@/lib/logger'
import { isExcludedOdooEntity, isExcludedRecordId } from '@/lib/odoo/excluded-entities'
import type { OdooReceivableClearingSummary } from '@/lib/odoo/live-sync-core'
import type {
  OdooLiveHrSummary,
  OdooLivePurchaseSummary,
  OdooLiveWarehouseChainPayload,
  OdooPeriodCube,
  OdooPeriodCubeProductRow,
} from '@/lib/odoo-live-connector'
import { loadFeryalCompanyContext, loadLatestAdvisorReports } from './advisor-reports'

const EXCLUDED_POS_CONFIG_IDS = new Set<number>([24, 25, 39, 40])

type CanonicalCubeChannelId = Exclude<ApprovedFeryalChannelId, 'talabat'>

const CANONICAL_CHANNEL_IDS: readonly CanonicalCubeChannelId[] = APPROVED_FERYAL_CHANNEL_LIST.map(
  (c) => c.id,
).filter((id): id is CanonicalCubeChannelId => id !== 'talabat')

export interface FeryalContextDataSource {
  fetchPeriodCube: (
    fromIso: string,
    toIso: string,
    referenceNowMs?: number,
  ) => Promise<OdooPeriodCube | null>
  fetchPurchaseOrders?: (
    fromIso: string,
    toIso: string,
    referenceNowMs?: number,
  ) => Promise<OdooLivePurchaseSummary | null>
  fetchWarehouseChain?: (
    fromIso: string,
    toIso: string,
    referenceNowMs?: number,
  ) => Promise<OdooLiveWarehouseChainPayload | null>
  fetchReceivablesSummary?: () => Promise<OdooReceivableClearingSummary | null>
  getLastSyncAt?: () => Promise<string | null>
  fetchBranchTopProducts?: (
    fromIso: string,
    toIso: string,
    branchId: ApprovedFeryalBranchId,
    limit: number,
  ) => Promise<OdooPeriodCubeProductRow[] | null>
  fetchHrEmployees?: (referenceNowMs?: number) => Promise<OdooLiveHrSummary | null>
}

export interface BuildFeryalContextPackInput {
  period: {
    from: string
    to: string
    days?: number
    labelAr?: string
    labelEn?: string
  }
  dataSource: FeryalContextDataSource
  includePurchases?: boolean
  includeStock?: boolean
  includeGl?: boolean
  includeHr?: boolean
  referenceNowMs?: number
  advisorReports?: AdvisorReport[]
  companyContext?: string
}

type FetchResult<T> =
  | { ok: true; value: T | null }
  | { ok: false; errorCode: string }

function finiteOrZero(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : 0
}

function round1(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 10) / 10
}

function round3(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 1000) / 1000
}

function extractSafeErrorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const rec = error as { diagnosticCode?: unknown; code?: unknown; name?: unknown }
    for (const raw of [rec.diagnosticCode, rec.code, rec.name]) {
      if (typeof raw === 'string') {
        const cleaned = raw.trim().replace(/[^A-Za-z0-9_.-]/g, '')
        if (cleaned.length > 0) return cleaned.slice(0, 64)
      }
    }
  }
  return 'SECTION_FETCH_FAILED'
}

async function safeFetch<T>(fn: () => Promise<T | null>): Promise<FetchResult<T>> {
  try {
    const value = await fn()
    return { ok: true, value }
  } catch (error) {
    return { ok: false, errorCode: extractSafeErrorCode(error) }
  }
}

function computeInclusiveDays(fromIso: string, toIso: string): number {
  const fromMs = Date.parse(`${fromIso}T00:00:00.000Z`)
  const toMs = Date.parse(`${toIso}T00:00:00.000Z`)
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 1
  return Math.max(1, Math.round((toMs - fromMs) / 86_400_000) + 1)
}

function computeMonthDayMetrics(toIso: string): {
  elapsedDaysInMonth: number
  totalDaysInMonth: number
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toIso.trim())
  if (!match) {
    return { elapsedDaysInMonth: 1, totalDaysInMonth: 30 }
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) {
    return { elapsedDaysInMonth: 1, totalDaysInMonth: 30 }
  }
  const totalDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const elapsedDaysInMonth = Math.min(Math.max(1, day), totalDaysInMonth)
  return { elapsedDaysInMonth, totalDaysInMonth }
}

function isExcludedBranchOrConfig(
  id: string,
  nameAr?: string | null,
  nameEn?: string | null,
): boolean {
  if (isExcludedOdooEntity(id) || isExcludedOdooEntity(nameAr) || isExcludedOdooEntity(nameEn)) {
    return true
  }
  const trimmed = id.trim()
  if (/^\d+$/.test(trimmed)) {
    const numericId = Number(trimmed)
    if (EXCLUDED_POS_CONFIG_IDS.has(numericId) || isExcludedRecordId('pos_config', numericId)) {
      return true
    }
  }
  return false
}

function makeSource(
  model: string,
  period: { from: string; to: string },
  lastSyncAt: string | null,
): FeryalPackSource {
  return {
    model,
    period: { from: period.from, to: period.to },
    lastSyncAt,
  }
}

function unavailableSection<T>(
  reason: string,
  source: FeryalPackSource,
): FeryalPackSection<T> {
  return {
    status: 'unavailable',
    reason,
    source,
  }
}

function okSection<T>(data: T, source: FeryalPackSource): FeryalPackSection<T> {
  return {
    status: 'ok',
    source,
    data,
  }
}

function runSectionBuilder<T>(
  sectionName: string,
  source: FeryalPackSource,
  cubeResult: FetchResult<OdooPeriodCube>,
  builder: (cube: OdooPeriodCube) => FeryalPackSection<T>,
): FeryalPackSection<T> {
  if (!cubeResult.ok) {
    logger.warn('feryal context section failed', {
      section: sectionName,
      errorCode: cubeResult.errorCode,
    })
    return unavailableSection<T>(cubeResult.errorCode, source)
  }
  const cube = cubeResult.value
  if (!cube || !cube.connected) {
    return unavailableSection<T>(cube ? 'odoo_disconnected' : 'cube_unavailable', source)
  }
  try {
    return builder(cube)
  } catch (error) {
    const errorCode = extractSafeErrorCode(error)
    logger.warn('feryal context section failed', { section: sectionName, errorCode })
    return unavailableSection<T>(errorCode, source)
  }
}

function resolveBranchGroup(branchId: string): FeryalBranchGroup {
  if (branchId === 'exhibitions') return 'exhibition'
  if (branchId === 'school-canteens') return 'canteen'
  return 'restaurant'
}

function resolveBranchLabels(branchId: string, defaultAr: string, defaultEn: string): {
  nameAr: string
  nameEn: string
} {
  if (branchId === 'exhibitions') {
    return { nameAr: 'بوثات المعارض', nameEn: 'Exhibition Booths' }
  }
  if (branchId === 'school-canteens') {
    return { nameAr: 'مقاصف المدارس', nameEn: 'School canteens' }
  }
  return { nameAr: defaultAr, nameEn: defaultEn }
}

function buildBranchItems(cube: OdooPeriodCube): FeryalBranchPackItem[] {
  const items: FeryalBranchPackItem[] = []
  for (const meta of ALL_FERYAL_BRANCHES) {
    const cell = cube.byBranch?.[meta.id]
    if (!cell) continue
    const { nameAr, nameEn } = resolveBranchLabels(meta.id, meta.nameAr, meta.nameEn)
    if (isExcludedBranchOrConfig(meta.id, nameAr, nameEn)) continue
    const netKwd = finiteOrZero(cell.netKwd)
    const orders = Math.round(finiteOrZero(cell.orders))
    const aovKwd =
      Number.isFinite(cell.aovKwd) && cell.aovKwd !== 0
        ? cell.aovKwd
        : orders > 0
          ? round3(netKwd / orders)
          : 0
    items.push({
      branchId: meta.id,
      nameAr,
      nameEn,
      netKwd,
      orders,
      aovKwd,
      group: resolveBranchGroup(meta.id),
    })
  }
  return items.sort((a, b) => b.netKwd - a.netKwd || b.orders - a.orders)
}

function buildHourlyData(cube: OdooPeriodCube): FeryalHourlyData | null {
  if (cube.hourlyAvailable === false || !Array.isArray(cube.hourlySeries)) {
    return null
  }
  const hourlySeries: FeryalHourlyPoint[] = cube.hourlySeries
    .filter((row) => Number.isFinite(row.hour) && row.hour >= 0 && row.hour <= 23)
    .map((row) => ({
      hour: Math.round(row.hour),
      orders: Math.max(0, Math.round(finiteOrZero(row.orders))),
      netKwd: finiteOrZero(row.netKwd),
    }))
    .sort((a, b) => a.hour - b.hour)

  if (hourlySeries.length === 0) return null

  const active = hourlySeries.filter((h) => h.orders > 0 || h.netKwd > 0)
  const peakHour =
    active.length > 0
      ? [...active].sort((a, b) => b.netKwd - a.netKwd || b.orders - a.orders || a.hour - b.hour)[0]
      : null

  const weakestCandidates =
    active.length > 1 && peakHour ? active.filter((h) => h.hour !== peakHour.hour) : active
  const weakestHours = [...weakestCandidates]
    .sort((a, b) => a.netKwd - b.netKwd || a.orders - b.orders || a.hour - b.hour)
    .slice(0, 3)

  return {
    hourlySeries,
    peakHour,
    weakestHours,
  }
}

export async function buildFeryalContextPack(
  input: BuildFeryalContextPackInput,
): Promise<FeryalContextPack> {
  const {
    dataSource,
    includePurchases = true,
    includeStock = true,
    includeGl = true,
    includeHr = true,
    referenceNowMs,
  } = input

  const from = input.period.from
  const to = input.period.to
  const days =
    input.period.days && Number.isFinite(input.period.days) && input.period.days > 0
      ? Math.round(input.period.days)
      : computeInclusiveDays(from, to)
  const labelAr = input.period.labelAr ?? (from === to ? from : `${from} إلى ${to}`)
  const labelEn = input.period.labelEn ?? (from === to ? from : `${from} to ${to}`)

  const previousTo = shiftIsoDateDays(from, -1)
  const previousFrom = shiftIsoDateDays(from, -days)
  const previousPeriod = { from: previousFrom, to: previousTo }
  const { elapsedDaysInMonth, totalDaysInMonth } = computeMonthDayMetrics(to)

  const [
    currentCubeRes,
    previousCubeRes,
    purchasesRes,
    stockRes,
    receivablesRes,
    hrRes,
    advisorReports,
  ] = await Promise.all([
    safeFetch(() => dataSource.fetchPeriodCube(from, to, referenceNowMs)),
    safeFetch(() => dataSource.fetchPeriodCube(previousFrom, previousTo, referenceNowMs)),
    includePurchases && typeof dataSource.fetchPurchaseOrders === 'function'
      ? safeFetch(() => dataSource.fetchPurchaseOrders!(from, to, referenceNowMs))
      : Promise.resolve<FetchResult<OdooLivePurchaseSummary>>({ ok: true, value: null }),
    includeStock && typeof dataSource.fetchWarehouseChain === 'function'
      ? safeFetch(() => dataSource.fetchWarehouseChain!(from, to, referenceNowMs))
      : Promise.resolve<FetchResult<OdooLiveWarehouseChainPayload>>({ ok: true, value: null }),
    includeGl && typeof dataSource.fetchReceivablesSummary === 'function'
      ? safeFetch(() => dataSource.fetchReceivablesSummary!())
      : Promise.resolve<FetchResult<OdooReceivableClearingSummary>>({ ok: true, value: null }),
    includeHr && typeof dataSource.fetchHrEmployees === 'function'
      ? safeFetch(() => dataSource.fetchHrEmployees!(referenceNowMs))
      : Promise.resolve<FetchResult<OdooLiveHrSummary>>({ ok: true, value: null }),
    input.advisorReports !== undefined
      ? Promise.resolve(input.advisorReports)
      : loadLatestAdvisorReports().catch((error) => {
          logger.warn('feryal context section failed', {
            section: 'advisorReports',
            errorCode: extractSafeErrorCode(error),
          })
          return [] as AdvisorReport[]
        }),
  ])

  let fallbackLastSyncAt: string | null = null
  const cubeLastSyncAt = currentCubeRes.ok ? (currentCubeRes.value?.lastSyncAt ?? null) : null
  if (!cubeLastSyncAt && typeof dataSource.getLastSyncAt === 'function') {
    const syncRes = await safeFetch(() => dataSource.getLastSyncAt!())
    if (syncRes.ok) {
      fallbackLastSyncAt = syncRes.value
    } else {
      logger.warn('feryal context section failed', {
        section: 'lastSyncAt',
        errorCode: syncRes.errorCode,
      })
    }
  }

  const posLastSyncAt = cubeLastSyncAt ?? fallbackLastSyncAt
  const periodWindow = { from, to }

  const companyTotals = runSectionBuilder<FeryalCompanyTotalsData>(
    'companyTotals',
    makeSource('pos.order', periodWindow, posLastSyncAt),
    currentCubeRes,
    (cube) => {
      if (cube.noData) {
        return unavailableSection('no_data', makeSource('pos.order', periodWindow, posLastSyncAt))
      }
      const orders = Math.round(finiteOrZero(cube.totals.orders))
      const netSalesKwd = finiteOrZero(cube.totals.netSalesKwd)
      const aovKwd =
        Number.isFinite(cube.totals.aovKwd) && cube.totals.aovKwd !== 0
          ? cube.totals.aovKwd
          : orders > 0
            ? round3(netSalesKwd / orders)
            : 0
      return okSection(
        {
          netSalesKwd,
          orders,
          aovKwd,
          mappedBranchesNetKwd: finiteOrZero(cube.totals.mappedBranchesNetKwd),
          unattributedSalesKwd: finiteOrZero(cube.totals.unattributedSalesKwd),
          ...(cube.totals.totalDiscountKwd !== undefined
            ? { totalDiscountKwd: finiteOrZero(cube.totals.totalDiscountKwd) }
            : {}),
          ...(cube.totals.avgDiscountPct !== undefined
            ? { avgDiscountPct: finiteOrZero(cube.totals.avgDiscountPct) }
            : {}),
          ...(cube.totals.discountedLinesCount !== undefined
            ? { discountedLinesCount: Math.round(finiteOrZero(cube.totals.discountedLinesCount)) }
            : {}),
        },
        makeSource('pos.order', periodWindow, posLastSyncAt),
      )
    },
  )

  const branches = runSectionBuilder<FeryalBranchesData>(
    'branches',
    makeSource('pos.order', periodWindow, posLastSyncAt),
    currentCubeRes,
    (cube) => {
      if (cube.noData) {
        return unavailableSection('no_data', makeSource('pos.order', periodWindow, posLastSyncAt))
      }
      const items = buildBranchItems(cube)
      if (items.length === 0) {
        return unavailableSection('no_branches', makeSource('pos.order', periodWindow, posLastSyncAt))
      }
      return okSection({ items }, makeSource('pos.order', periodWindow, posLastSyncAt))
    },
  )

  const unattributed = runSectionBuilder<FeryalUnattributedData>(
    'unattributed',
    makeSource('pos.order', periodWindow, posLastSyncAt),
    currentCubeRes,
    (cube) => {
      if (cube.noData) {
        return unavailableSection('no_data', makeSource('pos.order', periodWindow, posLastSyncAt))
      }
      const labelArVal = cube.unattributed?.labelAr || 'غير منسوب لفرع'
      const labelEnVal = cube.unattributed?.labelEn || 'Unattributed to Branch'
      if (isExcludedOdooEntity(labelArVal) || isExcludedOdooEntity(labelEnVal)) {
        return unavailableSection('excluded_entity', makeSource('pos.order', periodWindow, posLastSyncAt))
      }
      return okSection(
        {
          labelAr: labelArVal,
          labelEn: labelEnVal,
          netKwd: finiteOrZero(cube.unattributed?.netKwd ?? cube.totals.unattributedSalesKwd),
          orders: Math.round(finiteOrZero(cube.unattributed?.orders ?? cube.totals.unattributedOrders)),
        },
        makeSource('pos.order', periodWindow, posLastSyncAt),
      )
    },
  )

  const channels = runSectionBuilder<FeryalChannelsData>(
    'channels',
    makeSource('pos.payment', periodWindow, posLastSyncAt),
    currentCubeRes,
    (cube) => {
      if (cube.noData) {
        return unavailableSection('no_data', makeSource('pos.payment', periodWindow, posLastSyncAt))
      }
      const rawCompany = CANONICAL_CHANNEL_IDS.map((channelId) => {
        const entry = cube.byChannel?.[channelId]
        return {
          channelId,
          netKwd: finiteOrZero(entry?.netKwd),
          payments: Math.round(finiteOrZero(entry?.orders)),
        }
      })
      const channelSum = rawCompany.reduce((s, row) => s + row.netKwd, 0)
      const denominator =
        finiteOrZero(cube.totals.netSalesKwd) > 0 ? finiteOrZero(cube.totals.netSalesKwd) : channelSum
      const company = rawCompany
        .map((row) => ({
          ...row,
          sharePct: denominator > 0 ? round1((row.netKwd / denominator) * 100) : 0,
        }))
        .sort((a, b) => b.netKwd - a.netKwd || b.payments - a.payments)

      const byBranch: Record<string, Array<{ channelId: string; netKwd: number; payments: number }>> =
        {}
      for (const meta of ALL_FERYAL_BRANCHES) {
        const cell = cube.byBranch?.[meta.id]
        if (!cell || isExcludedBranchOrConfig(meta.id, meta.nameAr, meta.nameEn)) continue
        byBranch[meta.id] = CANONICAL_CHANNEL_IDS.map((channelId) => ({
          channelId,
          netKwd: finiteOrZero(cell.channels?.[channelId]?.netKwd),
          payments: Math.round(finiteOrZero(cell.channels?.[channelId]?.orders)),
        })).sort((a, b) => b.netKwd - a.netKwd || b.payments - a.payments)
      }

      return okSection(
        { company, byBranch },
        makeSource('pos.payment', periodWindow, posLastSyncAt),
      )
    },
  )

  const brands = runSectionBuilder<FeryalBrandsData>(
    'brands',
    makeSource('pos.order.line', periodWindow, posLastSyncAt),
    currentCubeRes,
    (cube) => {
      if (cube.noData) {
        return unavailableSection(
          'no_data',
          makeSource('pos.order.line', periodWindow, posLastSyncAt),
        )
      }
      const items = APPROVED_FERYAL_BRAND_LIST.filter(
        (meta) =>
          !isExcludedOdooEntity(meta.id) &&
          !isExcludedOdooEntity(meta.nameAr) &&
          !isExcludedOdooEntity(meta.nameEn),
      )
        .map((meta) => {
          const entry = cube.byBrand?.[meta.id]
          return {
            brandId: meta.id,
            nameAr: meta.nameAr,
            nameEn: meta.nameEn,
            netKwd: finiteOrZero(entry?.netKwd),
            orders:
              entry?.orders === null || entry?.orders === undefined
                ? null
                : Math.round(finiteOrZero(entry.orders)),
            ...(entry?.qty !== undefined ? { qty: finiteOrZero(entry.qty) } : {}),
          }
        })
        .sort((a, b) => b.netKwd - a.netKwd)

      return okSection({ items }, makeSource('pos.order.line', periodWindow, posLastSyncAt))
    },
  )

  const topProducts = runSectionBuilder<FeryalTopProductsData>(
    'topProducts',
    makeSource('pos.order.line', periodWindow, posLastSyncAt),
    currentCubeRes,
    (cube) => {
      if (cube.noData) {
        return unavailableSection(
          'no_data',
          makeSource('pos.order.line', periodWindow, posLastSyncAt),
        )
      }
      const items = (cube.topProducts ?? [])
        .filter((row) => row && row.name && !isExcludedOdooEntity(row.name))
        .map((row) => ({
          productId: row.productId ?? null,
          name: row.name,
          netKwd: finiteOrZero(row.netKwd),
          qty: finiteOrZero(row.qty),
        }))
        .sort((a, b) => b.netKwd - a.netKwd)

      if (items.length === 0) {
        return unavailableSection(
          'no_product_lines',
          makeSource('pos.order.line', periodWindow, posLastSyncAt),
        )
      }

      return okSection(
        {
          items,
          ...(cube.totals.totalDiscountKwd !== undefined
            ? { totalDiscountKwd: finiteOrZero(cube.totals.totalDiscountKwd) }
            : {}),
          ...(cube.totals.discountedLinesCount !== undefined
            ? { discountedLinesCount: Math.round(finiteOrZero(cube.totals.discountedLinesCount)) }
            : {}),
        },
        makeSource('pos.order.line', periodWindow, posLastSyncAt),
      )
    },
  )

  const hourly = runSectionBuilder<FeryalHourlyData>(
    'hourly',
    makeSource('pos.order', periodWindow, posLastSyncAt),
    currentCubeRes,
    (cube) => {
      if (cube.noData) {
        return unavailableSection('no_data', makeSource('pos.order', periodWindow, posLastSyncAt))
      }
      const hourlyData = buildHourlyData(cube)
      if (!hourlyData) {
        return unavailableSection(
          'hourly_unavailable',
          makeSource('pos.order', periodWindow, posLastSyncAt),
        )
      }
      return okSection(hourlyData, makeSource('pos.order', periodWindow, posLastSyncAt))
    },
  )

  const deltas: FeryalPackSection<FeryalDeltasData> = (() => {
    const src = makeSource('pos.order', periodWindow, posLastSyncAt)
    if (!currentCubeRes.ok) {
      logger.warn('feryal context section failed', {
        section: 'deltas',
        errorCode: currentCubeRes.errorCode,
      })
      return unavailableSection(currentCubeRes.errorCode, src)
    }
    if (!previousCubeRes.ok) {
      logger.warn('feryal context section failed', {
        section: 'deltas',
        errorCode: previousCubeRes.errorCode,
      })
      return unavailableSection(previousCubeRes.errorCode, src)
    }
    const curr = currentCubeRes.value
    const prev = previousCubeRes.value
    if (!curr || !curr.connected || curr.noData) {
      return unavailableSection(curr?.noData ? 'no_data' : 'current_period_unavailable', src)
    }
    if (!prev || !prev.connected || prev.noData) {
      return unavailableSection(
        prev ? (prev.noData ? 'previous_period_no_data' : 'previous_period_disconnected') : 'previous_period_unavailable',
        src,
      )
    }
    try {
      const currentNetKwd = finiteOrZero(curr.totals.netSalesKwd)
      const previousNetKwd = finiteOrZero(prev.totals.netSalesKwd)
      const deltaKwd = round3(currentNetKwd - previousNetKwd)
      const deltaPct =
        previousNetKwd > 0 ? round1(((currentNetKwd - previousNetKwd) / previousNetKwd) * 100) : null
      const currentOrders = Math.round(finiteOrZero(curr.totals.orders))
      const previousOrders = Math.round(finiteOrZero(prev.totals.orders))
      const ordersDeltaPct =
        previousOrders > 0
          ? round1(((currentOrders - previousOrders) / previousOrders) * 100)
          : null
      return okSection(
        {
          currentNetKwd,
          previousNetKwd,
          deltaKwd,
          deltaPct,
          currentOrders,
          previousOrders,
          ordersDeltaPct,
        },
        src,
      )
    } catch (error) {
      const errorCode = extractSafeErrorCode(error)
      logger.warn('feryal context section failed', { section: 'deltas', errorCode })
      return unavailableSection(errorCode, src)
    }
  })()

  const gl: FeryalPackSection<FeryalGlData> = (() => {
    const src = makeSource('account.move.line', periodWindow, posLastSyncAt)
    if (!includeGl) {
      return unavailableSection('not_requested', src)
    }
    if (!currentCubeRes.ok) {
      logger.warn('feryal context section failed', {
        section: 'gl',
        errorCode: currentCubeRes.errorCode,
      })
      return unavailableSection(currentCubeRes.errorCode, src)
    }
    const cube = currentCubeRes.value
    const acc = cube?.accounting
    if (!cube || !cube.connected || !acc || acc.available === false) {
      return unavailableSection('gl_unavailable', src)
    }
    try {
      const totalRevenueKwd =
        acc.totalRevenue !== undefined && Number.isFinite(acc.totalRevenue)
          ? acc.totalRevenue
          : Number.isFinite(acc.income) || Number.isFinite(acc.otherIncome)
            ? finiteOrZero(acc.income) + finiteOrZero(acc.otherIncome)
            : null
      const cogsKwd = Number.isFinite(acc.cogs) ? acc.cogs : null
      const deliveryCommissionsKwd =
        acc.deliveryCommissions !== undefined && Number.isFinite(acc.deliveryCommissions)
          ? acc.deliveryCommissions
          : null
      const expenseKwd = Number.isFinite(acc.expense) ? acc.expense : null
      const glClosedThroughDate = acc.glClosedThroughDate ?? null
      const glIncomplete = Boolean(acc.glIncomplete || acc.completeAccrualPosted === false)
      const isClosed = isWindowWithinClosedMonths(acc.to ?? to, glClosedThroughDate)
      const profitWithheld = !isClosed
      const operatingProfitKwd =
        isClosed && Number.isFinite(acc.operatingProfit) ? acc.operatingProfit : null

      return okSection(
        {
          totalRevenueKwd,
          cogsKwd,
          deliveryCommissionsKwd,
          expenseKwd,
          operatingProfitKwd,
          profitWithheld,
          glIncomplete,
          glClosedThroughDate,
        },
        src,
      )
    } catch (error) {
      const errorCode = extractSafeErrorCode(error)
      logger.warn('feryal context section failed', { section: 'gl', errorCode })
      return unavailableSection(errorCode, src)
    }
  })()

  const receivables: FeryalPackSection<FeryalReceivablesData> = (() => {
    const src = makeSource('account.move.line', periodWindow, posLastSyncAt)
    if (!includeGl) {
      return unavailableSection('not_requested', src)
    }
    if (!receivablesRes.ok) {
      logger.warn('feryal context section failed', {
        section: 'receivables',
        errorCode: receivablesRes.errorCode,
      })
      return unavailableSection(receivablesRes.errorCode, src)
    }
    const rec = receivablesRes.value
    if (!rec || !rec.readable) {
      return unavailableSection(
        typeof dataSource.fetchReceivablesSummary !== 'function'
          ? 'not_supported'
          : 'receivables_unavailable',
        src,
      )
    }
    try {
      const pendingReconciliation = !PER_CUSTOMER_DUE_DATE_AGING_VERIFIED
      const openLinesCount = Math.max(0, Math.round(finiteOrZero(rec.openLinesCount)))
      return okSection(
        {
          openLinesCount,
          pendingReconciliation,
          statusAr: pendingReconciliation
            ? RECEIVABLES_PENDING_STATUS.ar
            : (rec.maturityStatusAr ?? 'مطابق ومُدقق'),
          statusEn: pendingReconciliation
            ? RECEIVABLES_PENDING_STATUS.en
            : (rec.maturityStatusEn ?? 'Verified'),
          ...(rec.fromDate !== undefined ? { fromDate: rec.fromDate } : {}),
          ...(rec.toDate !== undefined ? { toDate: rec.toDate } : {}),
        },
        src,
      )
    } catch (error) {
      const errorCode = extractSafeErrorCode(error)
      logger.warn('feryal context section failed', { section: 'receivables', errorCode })
      return unavailableSection(errorCode, src)
    }
  })()

  const purchases: FeryalPackSection<FeryalPurchasesData> = (() => {
    const poLastSync =
      purchasesRes.ok && purchasesRes.value?.lastSyncAt
        ? purchasesRes.value.lastSyncAt
        : posLastSyncAt
    const src = makeSource('purchase.order', periodWindow, poLastSync)
    if (!includePurchases) {
      return unavailableSection('not_requested', src)
    }
    if (!purchasesRes.ok) {
      logger.warn('feryal context section failed', {
        section: 'purchases',
        errorCode: purchasesRes.errorCode,
      })
      return unavailableSection(purchasesRes.errorCode, src)
    }
    const po = purchasesRes.value
    if (!po || !po.connected || po.noData) {
      return unavailableSection(
        typeof dataSource.fetchPurchaseOrders !== 'function'
          ? 'not_supported'
          : po?.noData
            ? 'no_data'
            : 'purchases_unavailable',
        src,
      )
    }
    try {
      const topVendors = (po.byVendor ?? [])
        .filter((v) => v && v.vendorName && !isExcludedOdooEntity(v.vendorName))
        .slice(0, 10)
        .map((v) => ({
          name: v.vendorName,
          totalKwd: finiteOrZero(v.totalAmountKwd),
        }))
      return okSection(
        {
          totalSpendKwd: finiteOrZero(po.totals.totalAmountKwd),
          ordersCount: Math.max(0, Math.round(finiteOrZero(po.totals.ordersCount))),
          topVendors,
        },
        src,
      )
    } catch (error) {
      const errorCode = extractSafeErrorCode(error)
      logger.warn('feryal context section failed', { section: 'purchases', errorCode })
      return unavailableSection(errorCode, src)
    }
  })()

  const stock: FeryalPackSection<FeryalStockData> = (() => {
    const whLastSync =
      stockRes.ok && stockRes.value?.lastSyncAt ? stockRes.value.lastSyncAt : posLastSyncAt
    const src = makeSource('stock.move', periodWindow, whLastSync)
    if (!includeStock) {
      return unavailableSection('not_requested', src)
    }
    if (!stockRes.ok) {
      logger.warn('feryal context section failed', {
        section: 'stock',
        errorCode: stockRes.errorCode,
      })
      return unavailableSection(stockRes.errorCode, src)
    }
    const wh = stockRes.value
    if (!wh || !wh.connected || wh.noData) {
      return unavailableSection(
        typeof dataSource.fetchWarehouseChain !== 'function'
          ? 'not_supported'
          : wh?.noData
            ? 'no_data'
            : 'stock_unavailable',
        src,
      )
    }
    try {
      const transferCount = Math.max(0, Math.round(finiteOrZero(wh.totals.doneMovesCount)))
      const scrapCount = Math.max(0, Math.round(finiteOrZero(wh.totals.scrapOrdersCount)))
      const dailyScrapQty = (wh.dailyMoves ?? []).reduce(
        (sum, row) => sum + finiteOrZero(row.scrapQty),
        0,
      )
      const rowScrapQty = (wh.scraps ?? [])
        .filter(
          (row) =>
            !isExcludedOdooEntity(row.locationName) && !isExcludedOdooEntity(row.productName),
        )
        .reduce((sum, row) => sum + finiteOrZero(row.scrapQty), 0)
      const hasScrapQty = (wh.dailyMoves?.length ?? 0) > 0 || (wh.scraps?.length ?? 0) > 0
      const scrapQty =
        dailyScrapQty > 0 ? dailyScrapQty : rowScrapQty > 0 ? rowScrapQty : 0

      return okSection(
        {
          transferCount,
          scrapCount,
          ...(hasScrapQty ? { scrapQty: round3(scrapQty) } : {}),
        },
        src,
      )
    } catch (error) {
      const errorCode = extractSafeErrorCode(error)
      logger.warn('feryal context section failed', { section: 'stock', errorCode })
      return unavailableSection(errorCode, src)
    }
  })()

  const hr: FeryalPackSection<FeryalHrData> = (() => {
    const hrLastSync =
      hrRes.ok && hrRes.value?.lastSyncAt ? hrRes.value.lastSyncAt : posLastSyncAt
    const src = makeSource('hr.employee', periodWindow, hrLastSync)
    if (!includeHr) {
      return unavailableSection('not_requested', src)
    }
    if (!hrRes.ok) {
      logger.warn('feryal context section failed', {
        section: 'hr',
        errorCode: hrRes.errorCode,
      })
      return unavailableSection(hrRes.errorCode, src)
    }
    const hrVal = hrRes.value
    if (!hrVal || !hrVal.connected || !hrVal.accessGranted || hrVal.noData) {
      const reason =
        typeof dataSource.fetchHrEmployees !== 'function'
          ? 'not_supported'
          : !hrVal
            ? 'hr_unavailable'
            : !hrVal.accessGranted
              ? 'hr_no_access'
              : 'hr_no_data'
      return unavailableSection(reason, src)
    }
    try {
      return okSection(
        {
          activeEmployeeCount: Math.max(0, Math.round(finiteOrZero(hrVal.totals.activeEmployeesCount))),
        },
        src,
      )
    } catch (error) {
      const errorCode = extractSafeErrorCode(error)
      logger.warn('feryal context section failed', { section: 'hr', errorCode })
      return unavailableSection(errorCode, src)
    }
  })()

  const companyContext = (() => {
    if (input.companyContext !== undefined) return input.companyContext
    try {
      return loadFeryalCompanyContext()
    } catch (error) {
      logger.warn('feryal context section failed', {
        section: 'companyContext',
        errorCode: extractSafeErrorCode(error),
      })
      return ''
    }
  })()

  const anySectionOk = [
    companyTotals,
    branches,
    unattributed,
    channels,
    brands,
    topProducts,
    hourly,
    deltas,
    gl,
    receivables,
    purchases,
    stock,
    hr,
  ].some((section) => section.status === 'ok')

  const connected =
    (currentCubeRes.ok && Boolean(currentCubeRes.value?.connected)) || anySectionOk

  return {
    generatedAtIso: new Date(referenceNowMs ?? Date.now()).toISOString(),
    connected,
    period: {
      from,
      to,
      days,
      labelAr,
      labelEn,
    },
    previousPeriod,
    elapsedDaysInMonth,
    totalDaysInMonth,
    companyTotals,
    branches,
    unattributed,
    channels,
    brands,
    topProducts,
    hourly,
    deltas,
    gl,
    receivables,
    purchases,
    stock,
    hr,
    advisorReports: advisorReports.filter(
      (r) =>
        r.evidence.every((e) => !isExcludedOdooEntity(e.text)) &&
        r.rootCauses.every((c) => !isExcludedOdooEntity(c.text)) &&
        r.proposals.every((p) => !isExcludedOdooEntity(p.text) && !isExcludedOdooEntity(p.owner)),
    ),
    companyContext,
  }
}

function addFinite(target: Set<number>, value: unknown): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    target.add(value === 0 ? 0 : value)
  }
}

/**
 * Collects every real finite numeric value from each available (`status === 'ok'`) section
 * of a `FeryalContextPack`, indexed by section name.
 */
export function collectPackSectionNumbers(pack: FeryalContextPack): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>()

  const periodSet = new Set<number>()
  addFinite(periodSet, pack.period.days)
  addFinite(periodSet, pack.elapsedDaysInMonth)
  addFinite(periodSet, pack.totalDaysInMonth)
  if (periodSet.size > 0) out.set('period', periodSet)

  if (pack.companyTotals.status === 'ok' && pack.companyTotals.data) {
    const s = new Set<number>()
    const d = pack.companyTotals.data
    addFinite(s, d.netSalesKwd)
    addFinite(s, d.orders)
    addFinite(s, d.aovKwd)
    addFinite(s, d.mappedBranchesNetKwd)
    addFinite(s, d.unattributedSalesKwd)
    addFinite(s, d.totalDiscountKwd)
    addFinite(s, d.avgDiscountPct)
    addFinite(s, d.discountedLinesCount)
    out.set('companyTotals', s)
  }

  if (pack.branches.status === 'ok' && pack.branches.data) {
    const s = new Set<number>()
    for (const item of pack.branches.data.items) {
      addFinite(s, item.netKwd)
      addFinite(s, item.orders)
      addFinite(s, item.aovKwd)
    }
    out.set('branches', s)
  }

  if (pack.unattributed.status === 'ok' && pack.unattributed.data) {
    const s = new Set<number>()
    addFinite(s, pack.unattributed.data.netKwd)
    addFinite(s, pack.unattributed.data.orders)
    out.set('unattributed', s)
  }

  if (pack.channels.status === 'ok' && pack.channels.data) {
    const s = new Set<number>()
    for (const ch of pack.channels.data.company) {
      addFinite(s, ch.netKwd)
      addFinite(s, ch.payments)
      addFinite(s, ch.sharePct)
    }
    for (const rows of Object.values(pack.channels.data.byBranch)) {
      for (const ch of rows) {
        addFinite(s, ch.netKwd)
        addFinite(s, ch.payments)
      }
    }
    out.set('channels', s)
  }

  if (pack.brands.status === 'ok' && pack.brands.data) {
    const s = new Set<number>()
    for (const item of pack.brands.data.items) {
      addFinite(s, item.netKwd)
      addFinite(s, item.orders)
      addFinite(s, item.qty)
    }
    out.set('brands', s)
  }

  if (pack.topProducts.status === 'ok' && pack.topProducts.data) {
    const s = new Set<number>()
    for (const item of pack.topProducts.data.items) {
      addFinite(s, item.netKwd)
      addFinite(s, item.qty)
    }
    addFinite(s, pack.topProducts.data.totalDiscountKwd)
    addFinite(s, pack.topProducts.data.discountedLinesCount)
    out.set('topProducts', s)
  }

  if (pack.hourly.status === 'ok' && pack.hourly.data) {
    const s = new Set<number>()
    for (const point of pack.hourly.data.hourlySeries) {
      addFinite(s, point.hour)
      addFinite(s, point.orders)
      addFinite(s, point.netKwd)
    }
    if (pack.hourly.data.peakHour) {
      addFinite(s, pack.hourly.data.peakHour.hour)
      addFinite(s, pack.hourly.data.peakHour.orders)
      addFinite(s, pack.hourly.data.peakHour.netKwd)
    }
    for (const point of pack.hourly.data.weakestHours) {
      addFinite(s, point.hour)
      addFinite(s, point.orders)
      addFinite(s, point.netKwd)
    }
    out.set('hourly', s)
  }

  if (pack.deltas.status === 'ok' && pack.deltas.data) {
    const s = new Set<number>()
    const d = pack.deltas.data
    addFinite(s, d.currentNetKwd)
    addFinite(s, d.previousNetKwd)
    addFinite(s, d.deltaKwd)
    addFinite(s, d.deltaPct)
    addFinite(s, d.currentOrders)
    addFinite(s, d.previousOrders)
    addFinite(s, d.ordersDeltaPct)
    out.set('deltas', s)
  }

  if (pack.gl.status === 'ok' && pack.gl.data) {
    const s = new Set<number>()
    const d = pack.gl.data
    addFinite(s, d.totalRevenueKwd)
    addFinite(s, d.cogsKwd)
    addFinite(s, d.deliveryCommissionsKwd)
    addFinite(s, d.expenseKwd)
    if (!d.profitWithheld) {
      addFinite(s, d.operatingProfitKwd)
    }
    out.set('gl', s)
  }

  if (pack.receivables.status === 'ok' && pack.receivables.data) {
    const s = new Set<number>()
    addFinite(s, pack.receivables.data.openLinesCount)
    out.set('receivables', s)
  }

  if (pack.purchases.status === 'ok' && pack.purchases.data) {
    const s = new Set<number>()
    const d = pack.purchases.data
    addFinite(s, d.totalSpendKwd)
    addFinite(s, d.ordersCount)
    for (const v of d.topVendors ?? []) {
      addFinite(s, v.totalKwd)
    }
    out.set('purchases', s)
  }

  if (pack.stock.status === 'ok' && pack.stock.data) {
    const s = new Set<number>()
    const d = pack.stock.data
    addFinite(s, d.transferCount)
    addFinite(s, d.scrapCount)
    addFinite(s, d.scrapQty)
    out.set('stock', s)
  }

  if (pack.hr.status === 'ok' && pack.hr.data) {
    const s = new Set<number>()
    addFinite(s, pack.hr.data.activeEmployeeCount)
    out.set('hr', s)
  }

  return out
}
