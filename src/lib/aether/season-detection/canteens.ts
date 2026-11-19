import {
  createBudgetTracker,
  createReadOnlyOdooExecutor,
  fetchConfigDailyPosHistory,
  fetchPosConfigActiveStatus,
  isoDayDiff,
  isValidIsoDate,
  resolveSeasonWindowBounds,
  roundKwd3,
  type BudgetTracker,
  type ConfigActiveStatus,
  type DailySalesPoint,
  type QueryMode,
  type ReadOnlyOdooExecutor,
  type SeasonDetectionError,
} from './odoo-reader'

export const CANTEEN_POS_CONFIG_IDS = [41, 42, 43] as const
export const CANTEEN_TERM_GAP_DAYS = 7 as const

export interface CanteenTermRun {
  firstSellingDay: string
  lastSellingDay: string
  sellingDays: number
  calendarDays: number
  orders: number
  netKwd: number
  gapBeforeDays?: number
}

export interface CanteenConfigSummary {
  configId: number
  activeStatus: ConfigActiveStatus
  daily: DailySalesPoint[]
  terms: CanteenTermRun[]
  totalOrders: number
  totalNetKwd: number
  sellingDays: number
  partial: boolean
  errors: SeasonDetectionError[]
}

export interface CanteenSeasonDetectionResult {
  configIds: readonly number[]
  gapThresholdDays: number
  fromKuwaitDate: string
  toKuwaitDate: string
  perConfig: CanteenConfigSummary[]
  combined: {
    daily: DailySalesPoint[]
    terms: CanteenTermRun[]
    totalOrders: number
    totalNetKwd: number
    sellingDays: number
  }
  partial: boolean
  errors: SeasonDetectionError[]
}

function normalizeDailySalesSeries(daily: readonly DailySalesPoint[]): DailySalesPoint[] {
  const byDate = new Map<string, { orders: number; netKwd: number }>()
  for (const point of daily) {
    if (!isValidIsoDate(point.date)) continue
    const cleanOrders = Math.max(0, Math.round(Number(point.orders) || 0))
    const cleanNet = roundKwd3(point.netKwd)
    const existing = byDate.get(point.date)
    if (existing) {
      existing.orders += cleanOrders
      existing.netKwd = roundKwd3(existing.netKwd + cleanNet)
    } else {
      byDate.set(point.date, { orders: cleanOrders, netKwd: cleanNet })
    }
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, agg]) => ({
      date,
      orders: agg.orders,
      netKwd: roundKwd3(agg.netKwd),
    }))
}

export function detectCanteenTermsFromDaily(
  daily: readonly DailySalesPoint[],
  gapThresholdDays: number = CANTEEN_TERM_GAP_DAYS,
): CanteenTermRun[] {
  const threshold =
    Number.isFinite(gapThresholdDays) && gapThresholdDays >= 1
      ? Math.floor(gapThresholdDays)
      : CANTEEN_TERM_GAP_DAYS

  const sellingDays = normalizeDailySalesSeries(daily).filter((point) => point.netKwd > 0)
  if (sellingDays.length === 0) {
    return []
  }

  const runs: CanteenTermRun[] = []
  const first = sellingDays[0]
  let currentFirst = first.date
  let currentLast = first.date
  let currentSellingCount = 1
  let currentOrders = first.orders
  let currentNetKwd = first.netKwd
  let currentGapBefore: number | undefined

  const pushCurrentRun = (): void => {
    const run: CanteenTermRun = {
      firstSellingDay: currentFirst,
      lastSellingDay: currentLast,
      sellingDays: currentSellingCount,
      calendarDays: isoDayDiff(currentFirst, currentLast) + 1,
      orders: currentOrders,
      netKwd: roundKwd3(currentNetKwd),
    }
    if (currentGapBefore !== undefined) {
      run.gapBeforeDays = currentGapBefore
    }
    runs.push(run)
  }

  for (let idx = 1; idx < sellingDays.length; idx += 1) {
    const prev = sellingDays[idx - 1]
    const curr = sellingDays[idx]
    const gapDays = isoDayDiff(prev.date, curr.date) - 1

    if (gapDays >= threshold) {
      pushCurrentRun()
      currentFirst = curr.date
      currentLast = curr.date
      currentSellingCount = 1
      currentOrders = curr.orders
      currentNetKwd = curr.netKwd
      currentGapBefore = gapDays
    } else {
      currentLast = curr.date
      currentSellingCount += 1
      currentOrders += curr.orders
      currentNetKwd = roundKwd3(currentNetKwd + curr.netKwd)
    }
  }

  pushCurrentRun()
  return runs
}

export function analyzeCanteenHistory(input: {
  perConfigDaily: ReadonlyArray<{
    configId: number
    activeStatus?: ConfigActiveStatus
    daily: readonly DailySalesPoint[]
    partial?: boolean
    errors?: readonly SeasonDetectionError[]
  }>
  fromKuwaitDate: string
  toKuwaitDate: string
  gapThresholdDays?: number
  extraErrors?: readonly SeasonDetectionError[]
  extraPartial?: boolean
}): CanteenSeasonDetectionResult {
  const threshold =
    input.gapThresholdDays !== undefined &&
    Number.isFinite(input.gapThresholdDays) &&
    input.gapThresholdDays >= 1
      ? Math.floor(input.gapThresholdDays)
      : CANTEEN_TERM_GAP_DAYS

  const perConfig: CanteenConfigSummary[] = input.perConfigDaily.map((entry) => {
    const daily = normalizeDailySalesSeries(entry.daily)
    const terms = detectCanteenTermsFromDaily(daily, threshold)
    const sellingDays = daily.filter((point) => point.netKwd > 0).length
    const totalOrders = daily.reduce((sum, point) => sum + point.orders, 0)
    const totalNetKwd = roundKwd3(daily.reduce((sum, point) => sum + point.netKwd, 0))
    const errors = [...(entry.errors ?? [])]
    const partial = Boolean(entry.partial) || errors.length > 0

    return {
      configId: entry.configId,
      activeStatus: entry.activeStatus ?? 'unknown',
      daily,
      terms,
      totalOrders,
      totalNetKwd,
      sellingDays,
      partial,
      errors,
    }
  })

  const combinedDaily = normalizeDailySalesSeries(perConfig.flatMap((cfg) => cfg.daily))
  const combinedTerms = detectCanteenTermsFromDaily(combinedDaily, threshold)
  const combinedSellingDays = combinedDaily.filter((point) => point.netKwd > 0).length
  const combinedTotalOrders = combinedDaily.reduce((sum, point) => sum + point.orders, 0)
  const combinedTotalNetKwd = roundKwd3(
    combinedDaily.reduce((sum, point) => sum + point.netKwd, 0),
  )

  const errors: SeasonDetectionError[] = [
    ...(input.extraErrors ?? []),
    ...perConfig.flatMap((cfg) => cfg.errors),
  ]
  const partial =
    Boolean(input.extraPartial) || perConfig.some((cfg) => cfg.partial) || errors.length > 0

  const configIds =
    perConfig.length > 0 ? perConfig.map((cfg) => cfg.configId) : [...CANTEEN_POS_CONFIG_IDS]

  return {
    configIds,
    gapThresholdDays: threshold,
    fromKuwaitDate: input.fromKuwaitDate,
    toKuwaitDate: input.toKuwaitDate,
    perConfig,
    combined: {
      daily: combinedDaily,
      terms: combinedTerms,
      totalOrders: combinedTotalOrders,
      totalNetKwd: combinedTotalNetKwd,
      sellingDays: combinedSellingDays,
    },
    partial,
    errors,
  }
}

export async function detectCanteenSeasons(options?: {
  fromKuwaitDate?: string
  toKuwaitDate?: string
  mode?: QueryMode
  pageSize?: number
  executor?: ReadOnlyOdooExecutor
  budget?: BudgetTracker
  now?: Date
  activeStatusByConfigId?: ReadonlyMap<number, ConfigActiveStatus>
}): Promise<CanteenSeasonDetectionResult> {
  const windowBounds = resolveSeasonWindowBounds(
    options?.fromKuwaitDate,
    options?.toKuwaitDate,
    options?.now,
  )
  const executor = options?.executor ?? createReadOnlyOdooExecutor()
  const budget = options?.budget ?? createBudgetTracker()

  let statusMap = options?.activeStatusByConfigId
  let extraPartial = false
  let extraErrors: SeasonDetectionError[] = []

  if (!statusMap) {
    const statusFetch = await fetchPosConfigActiveStatus(CANTEEN_POS_CONFIG_IDS, {
      executor,
      budget,
    })
    statusMap = statusFetch.statusByConfigId
    extraPartial = statusFetch.partial
    extraErrors = statusFetch.errors
  }

  const fetchedConfigs: Array<{
    configId: number
    activeStatus: ConfigActiveStatus
    daily: DailySalesPoint[]
    partial: boolean
    errors: SeasonDetectionError[]
  }> = []

  for (const configId of CANTEEN_POS_CONFIG_IDS) {
    const result = await fetchConfigDailyPosHistory({
      configId,
      scope: 'canteen',
      fromKuwaitDate: windowBounds.fromKuwaitDate,
      toKuwaitDate: windowBounds.toKuwaitDate,
      fromUtc: windowBounds.fromUtc,
      toExclusiveUtc: windowBounds.toExclusiveUtc,
      activeStatus: statusMap.get(configId) ?? 'unknown',
      mode: options?.mode,
      pageSize: options?.pageSize,
      executor,
      budget,
    })
    fetchedConfigs.push({
      configId: result.configId,
      activeStatus: result.activeStatus,
      daily: result.daily,
      partial: result.partial,
      errors: result.errors,
    })
  }

  return analyzeCanteenHistory({
    perConfigDaily: fetchedConfigs,
    fromKuwaitDate: windowBounds.fromKuwaitDate,
    toKuwaitDate: windowBounds.toKuwaitDate,
    gapThresholdDays: CANTEEN_TERM_GAP_DAYS,
    extraErrors,
    extraPartial,
  })
}
