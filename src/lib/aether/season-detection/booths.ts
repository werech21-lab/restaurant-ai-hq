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

export const BOOTH_POS_CONFIG_IDS = [26, 27, 28, 29, 30, 31, 32, 33, 37, 38] as const
export const BOOTH_EVENT_GAP_DAYS = 3 as const

export interface BoothDailyPoint {
  date: string
  orders: number
  netKwd: number
  configs: number[]
}

export interface BoothEvent {
  name: string
  start: string
  end: string
  days: number
  sellingDays: number
  orders: number
  netKwd: number
  configs: number[]
  gapBeforeDays?: number
}

export interface BoothConfigSummary {
  configId: number
  activeStatus: ConfigActiveStatus
  daily: DailySalesPoint[]
  totalOrders: number
  totalNetKwd: number
  sellingDays: number
  partial: boolean
  errors: SeasonDetectionError[]
}

export interface BoothSeasonDetectionResult {
  configIds: readonly number[]
  gapThresholdDays: number
  fromKuwaitDate: string
  toKuwaitDate: string
  daily: BoothDailyPoint[]
  events: BoothEvent[]
  perConfig: BoothConfigSummary[]
  totalOrders: number
  totalNetKwd: number
  sellingDays: number
  partial: boolean
  errors: SeasonDetectionError[]
}

function normalizeConfigDailySeries(daily: readonly DailySalesPoint[]): DailySalesPoint[] {
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

export function detectBoothEventsFromPerConfigDaily(
  perConfigDaily: ReadonlyArray<{
    configId: number
    daily: readonly DailySalesPoint[]
  }>,
  gapThresholdDays: number = BOOTH_EVENT_GAP_DAYS,
): {
  daily: BoothDailyPoint[]
  events: BoothEvent[]
} {
  const threshold =
    Number.isFinite(gapThresholdDays) && gapThresholdDays >= 1
      ? Math.floor(gapThresholdDays)
      : BOOTH_EVENT_GAP_DAYS

  const combinedByDate = new Map<
    string,
    {
      orders: number
      netKwd: number
      configs: Set<number>
    }
  >()

  for (const cfg of perConfigDaily) {
    const normalized = normalizeConfigDailySeries(cfg.daily)
    for (const point of normalized) {
      const existing = combinedByDate.get(point.date)
      if (existing) {
        existing.orders += point.orders
        existing.netKwd = roundKwd3(existing.netKwd + point.netKwd)
        if (point.netKwd > 0) {
          existing.configs.add(cfg.configId)
        }
      } else {
        const configSet = new Set<number>()
        if (point.netKwd > 0) {
          configSet.add(cfg.configId)
        }
        combinedByDate.set(point.date, {
          orders: point.orders,
          netKwd: point.netKwd,
          configs: configSet,
        })
      }
    }
  }

  const daily: BoothDailyPoint[] = [...combinedByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, agg]) => agg.netKwd > 0)
    .map(([date, agg]) => ({
      date,
      orders: agg.orders,
      netKwd: roundKwd3(agg.netKwd),
      configs: [...agg.configs].sort((a, b) => a - b),
    }))

  if (daily.length === 0) {
    return { daily: [], events: [] }
  }

  const events: BoothEvent[] = []
  const first = daily[0]
  let currentStart = first.date
  let currentEnd = first.date
  let currentSellingDays = 1
  let currentOrders = first.orders
  let currentNetKwd = first.netKwd
  let currentConfigs = new Set<number>(first.configs)
  let currentGapBefore: number | undefined

  const pushCurrentEvent = (): void => {
    const event: BoothEvent = {
      name: '',
      start: currentStart,
      end: currentEnd,
      days: isoDayDiff(currentStart, currentEnd) + 1,
      sellingDays: currentSellingDays,
      orders: currentOrders,
      netKwd: roundKwd3(currentNetKwd),
      configs: [...currentConfigs].sort((a, b) => a - b),
    }
    if (currentGapBefore !== undefined) {
      event.gapBeforeDays = currentGapBefore
    }
    events.push(event)
  }

  for (let idx = 1; idx < daily.length; idx += 1) {
    const prev = daily[idx - 1]
    const curr = daily[idx]
    const gapDays = isoDayDiff(prev.date, curr.date) - 1

    if (gapDays >= threshold) {
      pushCurrentEvent()
      currentStart = curr.date
      currentEnd = curr.date
      currentSellingDays = 1
      currentOrders = curr.orders
      currentNetKwd = curr.netKwd
      currentConfigs = new Set<number>(curr.configs)
      currentGapBefore = gapDays
    } else {
      currentEnd = curr.date
      currentSellingDays += 1
      currentOrders += curr.orders
      currentNetKwd = roundKwd3(currentNetKwd + curr.netKwd)
      for (const cfgId of curr.configs) {
        currentConfigs.add(cfgId)
      }
    }
  }

  pushCurrentEvent()
  return { daily, events }
}

export function analyzeBoothHistory(input: {
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
}): BoothSeasonDetectionResult {
  const threshold =
    input.gapThresholdDays !== undefined &&
    Number.isFinite(input.gapThresholdDays) &&
    input.gapThresholdDays >= 1
      ? Math.floor(input.gapThresholdDays)
      : BOOTH_EVENT_GAP_DAYS

  const perConfig: BoothConfigSummary[] = input.perConfigDaily.map((entry) => {
    const daily = normalizeConfigDailySeries(entry.daily)
    const sellingDays = daily.filter((point) => point.netKwd > 0).length
    const totalOrders = daily.reduce((sum, point) => sum + point.orders, 0)
    const totalNetKwd = roundKwd3(daily.reduce((sum, point) => sum + point.netKwd, 0))
    const errors = [...(entry.errors ?? [])]
    const partial = Boolean(entry.partial) || errors.length > 0

    return {
      configId: entry.configId,
      activeStatus: entry.activeStatus ?? 'unknown',
      daily,
      totalOrders,
      totalNetKwd,
      sellingDays,
      partial,
      errors,
    }
  })

  const { daily, events } = detectBoothEventsFromPerConfigDaily(perConfig, threshold)
  const totalOrders = daily.reduce((sum, point) => sum + point.orders, 0)
  const totalNetKwd = roundKwd3(daily.reduce((sum, point) => sum + point.netKwd, 0))
  const sellingDays = daily.length

  const errors: SeasonDetectionError[] = [
    ...(input.extraErrors ?? []),
    ...perConfig.flatMap((cfg) => cfg.errors),
  ]
  const partial =
    Boolean(input.extraPartial) || perConfig.some((cfg) => cfg.partial) || errors.length > 0

  const configIds =
    perConfig.length > 0 ? perConfig.map((cfg) => cfg.configId) : [...BOOTH_POS_CONFIG_IDS]

  return {
    configIds,
    gapThresholdDays: threshold,
    fromKuwaitDate: input.fromKuwaitDate,
    toKuwaitDate: input.toKuwaitDate,
    daily,
    events,
    perConfig,
    totalOrders,
    totalNetKwd,
    sellingDays,
    partial,
    errors,
  }
}

export async function detectBoothSeasons(options?: {
  fromKuwaitDate?: string
  toKuwaitDate?: string
  mode?: QueryMode
  pageSize?: number
  executor?: ReadOnlyOdooExecutor
  budget?: BudgetTracker
  now?: Date
  activeStatusByConfigId?: ReadonlyMap<number, ConfigActiveStatus>
}): Promise<BoothSeasonDetectionResult> {
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
    const statusFetch = await fetchPosConfigActiveStatus(BOOTH_POS_CONFIG_IDS, {
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

  for (const configId of BOOTH_POS_CONFIG_IDS) {
    const result = await fetchConfigDailyPosHistory({
      configId,
      scope: 'booth',
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

  return analyzeBoothHistory({
    perConfigDaily: fetchedConfigs,
    fromKuwaitDate: windowBounds.fromKuwaitDate,
    toKuwaitDate: windowBounds.toKuwaitDate,
    gapThresholdDays: BOOTH_EVENT_GAP_DAYS,
    extraErrors,
    extraPartial,
  })
}
