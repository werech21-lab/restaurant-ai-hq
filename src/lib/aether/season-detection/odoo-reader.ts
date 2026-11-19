import 'server-only'

import { getKuwaitTodayIso } from '@/lib/aether/period-delta'
import { posOrderNet } from '@/lib/odoo/company-pos'
import { kuwaitDateBoundsToOdooUtc } from '@/lib/odoo/pos-order-query'
import {
  executeOdooKw,
  odooUtcToKuwaitIso,
  redactOdooSecrets,
} from '@/lib/odoo-live-connector'

export const SEASON_HISTORY_START_KUWAIT = '2024-12-31' as const
export const SEASON_DETECTION_TIMEZONE = 'Asia/Kuwait' as const
export const POS_ORDER_VALID_STATES = ['paid', 'done', 'invoiced'] as const
export const ODOO_SEARCH_READ_PAGE_LIMIT = 5000 as const
export const SEASON_DETECTION_BUDGET_MS = 60_000 as const
export const READ_ONLY_ODOO_METHODS = ['read_group', 'search_read'] as const

const SINGLE_CALL_TIMEOUT_CAP_MS = 20_000
const MIN_RPC_CAP_MS = 8_000
const MAX_SANITIZED_ERROR_CHARS = 240

export type ReadOnlyOdooMethod = (typeof READ_ONLY_ODOO_METHODS)[number]

export type ReadOnlyOdooExecutor = <T = unknown>(
  model: string,
  method: ReadOnlyOdooMethod,
  args: unknown[],
  kwargs: Record<string, unknown>,
  options?: { timeoutMs?: number; timeoutCapMs?: number },
) => Promise<T>

export type QueryMode = 'read_group' | 'search_read'

export type ConfigActiveStatus = 'active' | 'inactive' | 'unknown'

export interface DailySalesPoint {
  date: string
  orders: number
  netKwd: number
}

export interface SeasonDetectionError {
  scope: 'pos_config' | 'canteen' | 'booth' | 'system'
  configId?: number
  code: 'BUDGET_EXCEEDED' | 'TIMEOUT' | 'ODOO_RPC_ERROR' | 'INVALID_QUERY'
  message: string
}

export interface BudgetTracker {
  readonly budgetMs: number
  readonly startedAtMs: number
  readonly deadlineMs: number
  remainingMs(): number
  isExhausted(): boolean
  elapsedMs(): number
}

export interface ConfigDailyFetchResult {
  configId: number
  activeStatus: ConfigActiveStatus
  queryModeUsed: QueryMode
  daily: DailySalesPoint[]
  totalOrders: number
  totalNetKwd: number
  partial: boolean
  errors: SeasonDetectionError[]
}

const MONTH_NUMBER_BY_NAME: Readonly<Record<string, string>> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
}

export function roundKwd3(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 1000) / 1000
}

export function isValidIsoDate(value: string): boolean {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const utc = new Date(Date.UTC(year, month - 1, day))
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  )
}

export function isoDayDiff(earlierIso: string, laterIso: string): number {
  const earlierMs = Date.parse(`${earlierIso}T00:00:00Z`)
  const laterMs = Date.parse(`${laterIso}T00:00:00Z`)
  if (!Number.isFinite(earlierMs) || !Number.isFinite(laterMs)) {
    return 0
  }
  return Math.round((laterMs - earlierMs) / 86_400_000)
}

export function resolveSeasonWindowBounds(
  fromKuwaitDate?: string,
  toKuwaitDate?: string,
  now?: Date,
): {
  fromKuwaitDate: string
  toKuwaitDate: string
  fromUtc: string
  toExclusiveUtc: string
} {
  if (fromKuwaitDate !== undefined && !isValidIsoDate(fromKuwaitDate)) {
    throw new Error('Invalid fromKuwaitDate: expected valid YYYY-MM-DD calendar date.')
  }
  if (toKuwaitDate !== undefined && !isValidIsoDate(toKuwaitDate)) {
    throw new Error('Invalid toKuwaitDate: expected valid YYYY-MM-DD calendar date.')
  }

  const resolvedFrom = fromKuwaitDate ?? SEASON_HISTORY_START_KUWAIT
  const defaultTo = getKuwaitTodayIso(now ? now.getTime() : undefined)
  let resolvedTo = toKuwaitDate ?? defaultTo

  if (toKuwaitDate !== undefined && resolvedTo < resolvedFrom) {
    throw new Error('Invalid window: toKuwaitDate must be on or after fromKuwaitDate.')
  }
  if (resolvedTo < resolvedFrom) {
    resolvedTo = resolvedFrom
  }

  const bounds = kuwaitDateBoundsToOdooUtc(resolvedFrom, resolvedTo)
  return {
    fromKuwaitDate: resolvedFrom,
    toKuwaitDate: resolvedTo,
    fromUtc: bounds.fromUtc,
    toExclusiveUtc: bounds.toExclusiveUtc,
  }
}

export function sanitizeErrorText(err: unknown): string {
  let raw: string
  if (err instanceof Error) {
    raw = err.message || err.name
  } else if (typeof err === 'string') {
    raw = err
  } else if (
    err !== null &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    raw = (err as { message: string }).message
  } else {
    raw = String(err ?? 'Unknown Odoo RPC failure')
  }

  let cleaned = redactOdooSecrets(raw)
  cleaned = cleaned.replace(/https?:\/\/[^\s"'<>)]+/gi, '[REDACTED_URL]')
  cleaned = cleaned.replace(/\b[^\s:@/]+:[^\s@/]+@[^\s/]+/g, '[REDACTED_CREDENTIALS]')
  cleaned = cleaned.replace(
    /\b(api[_-]?key|password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|secret|authorization|bearer|cookie|database_url|odoo_[a-z0-9_]+)\s*([=:]\s*|\s+)(['"]?)[^\s,'"&;)]+\3/gi,
    '$1=[REDACTED]',
  )
  cleaned = cleaned.replace(
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    '[REDACTED_TOKEN]',
  )
  cleaned = cleaned.replace(/\b[a-f0-9]{32,128}\b/gi, '[REDACTED_KEY]')
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  if (!cleaned) {
    return 'Odoo RPC request failed'
  }
  if (cleaned.length > MAX_SANITIZED_ERROR_CHARS) {
    return `${cleaned.slice(0, MAX_SANITIZED_ERROR_CHARS - 3)}...`
  }
  return cleaned
}

export function createBudgetTracker(
  budgetMs: number = SEASON_DETECTION_BUDGET_MS,
  nowFn: () => number = Date.now,
): BudgetTracker {
  const safeBudgetMs = Number.isFinite(budgetMs)
    ? Math.max(0, Math.floor(budgetMs))
    : SEASON_DETECTION_BUDGET_MS
  const startedAtMs = nowFn()
  const deadlineMs = startedAtMs + safeBudgetMs

  return {
    budgetMs: safeBudgetMs,
    startedAtMs,
    deadlineMs,
    remainingMs(): number {
      return Math.max(0, deadlineMs - nowFn())
    },
    isExhausted(): boolean {
      return nowFn() >= deadlineMs
    },
    elapsedMs(): number {
      return Math.max(0, nowFn() - startedAtMs)
    },
  }
}

function extractGroupbyStrings(rawGroupby: unknown): string[] {
  if (typeof rawGroupby === 'string') {
    return [rawGroupby]
  }
  if (Array.isArray(rawGroupby)) {
    return rawGroupby.filter((item): item is string => typeof item === 'string')
  }
  return []
}

function hasForbiddenConfigIdGroupby(rawGroupby: unknown): boolean {
  for (const entry of extractGroupbyStrings(rawGroupby)) {
    const normalized = entry.trim().toLowerCase()
    if (
      normalized === 'config_id' ||
      normalized.startsWith('config_id:') ||
      normalized.endsWith('.config_id') ||
      normalized.includes('.config_id:')
    ) {
      return true
    }
  }
  return false
}

export function createReadOnlyOdooExecutor(
  baseExecute: typeof executeOdooKw = executeOdooKw,
): ReadOnlyOdooExecutor {
  return async <T = unknown>(
    model: string,
    method: ReadOnlyOdooMethod,
    args: unknown[],
    kwargs: Record<string, unknown>,
    options?: { timeoutMs?: number; timeoutCapMs?: number },
  ): Promise<T> => {
    if (!(READ_ONLY_ODOO_METHODS as readonly string[]).includes(method)) {
      throw new Error(`Write or non-read-only Odoo method blocked: ${String(method)}`)
    }

    if (
      method === 'read_group' &&
      (hasForbiddenConfigIdGroupby(args[2]) || hasForbiddenConfigIdGroupby(kwargs.groupby))
    ) {
      throw new Error('pos.order.config_id is not stored and must never appear in groupby')
    }

    const timeoutMs = options?.timeoutMs
    const timeoutCapMs =
      options?.timeoutCapMs ??
      (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs)
        ? Math.max(MIN_RPC_CAP_MS, timeoutMs)
        : undefined)

    const forwardedOptions =
      timeoutMs !== undefined || timeoutCapMs !== undefined
        ? { timeoutMs, timeoutCapMs }
        : undefined

    return baseExecute<T>(model, method, args, kwargs, forwardedOptions)
  }
}

export async function runWithRemainingBudget<T>(
  promise: Promise<T>,
  remainingMs: number,
): Promise<{ ok: true; value: T } | { ok: false; timedOut: boolean; error: unknown }> {
  promise.catch(() => undefined)

  const waitMs = Math.max(1, Math.floor(Number.isFinite(remainingMs) ? remainingMs : 1))
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeoutOutcome = new Promise<{
    ok: false
    timedOut: true
    error: Error
  }>((resolve) => {
    timer = setTimeout(() => {
      resolve({
        ok: false,
        timedOut: true,
        error: new Error(`Odoo RPC timed out after ${waitMs}ms remaining budget`),
      })
    }, waitMs)
  })

  const taskOutcome = promise.then(
    (value): { ok: true; value: T } => ({ ok: true, value }),
    (error: unknown): { ok: false; timedOut: false; error: unknown } => ({
      ok: false,
      timedOut: false,
      error,
    }),
  )

  try {
    return await Promise.race([taskOutcome, timeoutOutcome])
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  }
}

function parseMonthLabelDate(raw: string): string | null {
  const dmyMatch = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(raw)
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0')
    const month = MONTH_NUMBER_BY_NAME[dmyMatch[2].toLowerCase()]
    const year = dmyMatch[3]
    if (month) {
      const candidate = `${year}-${month}-${day}`
      return isValidIsoDate(candidate) ? candidate : null
    }
  }

  const mdyMatch = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(raw)
  if (mdyMatch) {
    const month = MONTH_NUMBER_BY_NAME[mdyMatch[1].toLowerCase()]
    const day = mdyMatch[2].padStart(2, '0')
    const year = mdyMatch[3]
    if (month) {
      const candidate = `${year}-${month}-${day}`
      return isValidIsoDate(candidate) ? candidate : null
    }
  }

  return null
}

function parseUtcOrIsoDayToken(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (isValidIsoDate(trimmed)) {
    return trimmed
  }
  const converted = odooUtcToKuwaitIso(trimmed)?.kuwaitDate
  if (converted && isValidIsoDate(converted)) {
    return converted
  }
  return null
}

export function parseKuwaitDayFromReadGroupRow(row: Record<string, unknown>): string | null {
  const rawRange = row.__range
  if (rawRange !== null && typeof rawRange === 'object') {
    const dayRange = (rawRange as Record<string, unknown>)['date_order:day']
    if (dayRange !== null && typeof dayRange === 'object') {
      const fromVal = (dayRange as Record<string, unknown>).from
      if (typeof fromVal === 'string') {
        const resolved = parseUtcOrIsoDayToken(fromVal)
        if (resolved) return resolved
      }
    }
  }

  if (Array.isArray(row.__domain)) {
    for (const clause of row.__domain) {
      if (
        Array.isArray(clause) &&
        clause.length >= 3 &&
        clause[0] === 'date_order' &&
        clause[1] === '>=' &&
        typeof clause[2] === 'string'
      ) {
        const resolved = parseUtcOrIsoDayToken(clause[2])
        if (resolved) return resolved
      }
    }
  }

  const rawDayField = row['date_order:day']
  if (typeof rawDayField === 'string') {
    const trimmed = rawDayField.trim()
    if (isValidIsoDate(trimmed)) {
      return trimmed
    }
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(trimmed)) {
      const converted = odooUtcToKuwaitIso(trimmed)?.kuwaitDate
      if (converted && isValidIsoDate(converted)) {
        return converted
      }
    }
    const parsedLabel = parseMonthLabelDate(trimmed)
    if (parsedLabel) {
      return parsedLabel
    }
  }

  return null
}

function classifyRpcErrorCode(err: unknown): SeasonDetectionError['code'] {
  const text = err instanceof Error ? err.message : String(err ?? '')
  if (
    text.includes('Write or non-read-only Odoo method blocked') ||
    text.includes('pos.order.config_id is not stored')
  ) {
    return 'INVALID_QUERY'
  }
  if (/timed?\s*out|abort/i.test(text)) {
    return 'TIMEOUT'
  }
  return 'ODOO_RPC_ERROR'
}

export async function fetchPosConfigActiveStatus(
  configIds: readonly number[],
  options: {
    executor: ReadOnlyOdooExecutor
    budget: BudgetTracker
  },
): Promise<{
  statusByConfigId: Map<number, ConfigActiveStatus>
  partial: boolean
  errors: SeasonDetectionError[]
}> {
  const uniqueIds = [...new Set(configIds.filter((id) => Number.isInteger(id) && id > 0))]
  const statusByConfigId = new Map<number, ConfigActiveStatus>()
  for (const id of uniqueIds) {
    statusByConfigId.set(id, 'unknown')
  }

  if (uniqueIds.length === 0) {
    return { statusByConfigId, partial: false, errors: [] }
  }

  if (options.budget.isExhausted()) {
    return {
      statusByConfigId,
      partial: true,
      errors: [
        {
          scope: 'pos_config',
          code: 'BUDGET_EXCEEDED',
          message: `Season detection ${options.budget.budgetMs}ms budget exhausted before loading pos.config active states.`,
        },
      ],
    }
  }

  const remainingMs = options.budget.remainingMs()
  const timeoutMs = Math.max(1, Math.min(remainingMs, SINGLE_CALL_TIMEOUT_CAP_MS))
  const timeoutCapMs = Math.max(MIN_RPC_CAP_MS, timeoutMs)

  const rpcPromise = options.executor<Array<Record<string, unknown>>>(
    'pos.config',
    'search_read',
    [[['id', 'in', [...uniqueIds]]]],
    {
      fields: ['id', 'active'],
      limit: Math.max(uniqueIds.length, 50),
      context: { active_test: false },
    },
    { timeoutMs, timeoutCapMs },
  )

  const outcome = await runWithRemainingBudget(rpcPromise, remainingMs)
  if (!outcome.ok) {
    return {
      statusByConfigId,
      partial: true,
      errors: [
        {
          scope: 'pos_config',
          code: outcome.timedOut ? 'TIMEOUT' : classifyRpcErrorCode(outcome.error),
          message: sanitizeErrorText(outcome.error),
        },
      ],
    }
  }

  if (!Array.isArray(outcome.value)) {
    return {
      statusByConfigId,
      partial: true,
      errors: [
        {
          scope: 'pos_config',
          code: 'ODOO_RPC_ERROR',
          message: 'Unexpected non-array response from pos.config search_read.',
        },
      ],
    }
  }

  for (const row of outcome.value) {
    const id = typeof row.id === 'number' && Number.isInteger(row.id) ? row.id : null
    if (id !== null && statusByConfigId.has(id)) {
      if (row.active === true) {
        statusByConfigId.set(id, 'active')
      } else if (row.active === false) {
        statusByConfigId.set(id, 'inactive')
      }
    }
  }

  return { statusByConfigId, partial: false, errors: [] }
}

export async function fetchConfigDailyPosHistory(params: {
  configId: number
  scope: 'canteen' | 'booth'
  fromKuwaitDate: string
  toKuwaitDate: string
  fromUtc: string
  toExclusiveUtc: string
  activeStatus?: ConfigActiveStatus
  mode?: QueryMode
  pageSize?: number
  executor: ReadOnlyOdooExecutor
  budget: BudgetTracker
}): Promise<ConfigDailyFetchResult> {
  const {
    configId,
    scope,
    fromKuwaitDate,
    toKuwaitDate,
    fromUtc,
    toExclusiveUtc,
    activeStatus = 'unknown',
    mode = 'read_group',
    executor,
    budget,
  } = params

  const errors: SeasonDetectionError[] = []
  let partial = false
  const byDate = new Map<string, { orders: number; netKwd: number }>()

  const addPoint = (kuwaitDate: string, ordersDelta: number, netDeltaKwd: number): void => {
    if (kuwaitDate < fromKuwaitDate || kuwaitDate > toKuwaitDate) {
      return
    }
    const existing = byDate.get(kuwaitDate)
    if (existing) {
      existing.orders += ordersDelta
      existing.netKwd = roundKwd3(existing.netKwd + netDeltaKwd)
    } else {
      byDate.set(kuwaitDate, {
        orders: ordersDelta,
        netKwd: roundKwd3(netDeltaKwd),
      })
    }
  }

  const domain: unknown[] = [
    ['config_id', '=', configId],
    ['state', 'in', [...POS_ORDER_VALID_STATES]],
    ['date_order', '>=', fromUtc],
    ['date_order', '<', toExclusiveUtc],
  ]

  const context = {
    tz: SEASON_DETECTION_TIMEZONE,
    active_test: false,
  }

  if (mode === 'read_group') {
    if (budget.isExhausted()) {
      return {
        configId,
        activeStatus,
        queryModeUsed: mode,
        daily: [],
        totalOrders: 0,
        totalNetKwd: 0,
        partial: true,
        errors: [
          {
            scope,
            configId,
            code: 'BUDGET_EXCEEDED',
            message: `Season detection ${budget.budgetMs}ms budget exhausted before querying pos.config ${configId}.`,
          },
        ],
      }
    }

    const remainingMs = budget.remainingMs()
    const timeoutMs = Math.max(1, Math.min(remainingMs, SINGLE_CALL_TIMEOUT_CAP_MS))
    const timeoutCapMs = Math.max(MIN_RPC_CAP_MS, timeoutMs)

    const rpcPromise = executor<Array<Record<string, unknown>>>(
      'pos.order',
      'read_group',
      [domain, ['amount_total:sum', 'amount_tax:sum'], ['date_order:day']],
      {
        lazy: false,
        orderby: 'date_order:day asc',
        context,
      },
      { timeoutMs, timeoutCapMs },
    )

    const outcome = await runWithRemainingBudget(rpcPromise, remainingMs)
    if (!outcome.ok) {
      partial = true
      errors.push({
        scope,
        configId,
        code: outcome.timedOut ? 'TIMEOUT' : classifyRpcErrorCode(outcome.error),
        message: sanitizeErrorText(outcome.error),
      })
    } else if (!Array.isArray(outcome.value)) {
      partial = true
      errors.push({
        scope,
        configId,
        code: 'ODOO_RPC_ERROR',
        message: `Unexpected non-array read_group response for pos.config ${configId}.`,
      })
    } else {
      let unparseableCount = 0
      for (const row of outcome.value) {
        const rawCount = row.__count ?? row.date_order_count ?? 0
        const orders = Math.max(0, Math.round(Number(rawCount) || 0))
        const rawTotal = row.amount_total ?? row['amount_total:sum'] ?? 0
        const rawTax = row.amount_tax ?? row['amount_tax:sum'] ?? 0
        const netKwd = posOrderNet(rawTotal, rawTax)
        const kuwaitDate = parseKuwaitDayFromReadGroupRow(row)

        if (!kuwaitDate) {
          if (orders > 0 || netKwd !== 0) {
            unparseableCount += 1
          }
          continue
        }
        addPoint(kuwaitDate, orders, netKwd)
      }

      if (unparseableCount > 0) {
        partial = true
        errors.push({
          scope,
          configId,
          code: 'ODOO_RPC_ERROR',
          message: `Could not parse Kuwait date on ${unparseableCount} read_group row(s) for pos.config ${configId}.`,
        })
      }
    }
  } else {
    const requestedPageSize =
      params.pageSize !== undefined && Number.isFinite(params.pageSize)
        ? Math.floor(params.pageSize)
        : ODOO_SEARCH_READ_PAGE_LIMIT
    const limit = Math.min(ODOO_SEARCH_READ_PAGE_LIMIT, Math.max(1, requestedPageSize))

    let offset = 0
    let unparseableRows = 0

    for (;;) {
      if (budget.isExhausted()) {
        partial = true
        errors.push({
          scope,
          configId,
          code: 'BUDGET_EXCEEDED',
          message: `Season detection ${budget.budgetMs}ms budget exhausted for pos.config ${configId} at search_read offset ${offset}.`,
        })
        break
      }

      const remainingMs = budget.remainingMs()
      const timeoutMs = Math.max(1, Math.min(remainingMs, SINGLE_CALL_TIMEOUT_CAP_MS))
      const timeoutCapMs = Math.max(MIN_RPC_CAP_MS, timeoutMs)

      const rpcPromise = executor<Array<Record<string, unknown>>>(
        'pos.order',
        'search_read',
        [domain],
        {
          fields: ['date_order', 'amount_total', 'amount_tax', 'state'],
          limit,
          offset,
          order: 'date_order asc, id asc',
          context,
        },
        { timeoutMs, timeoutCapMs },
      )

      const outcome = await runWithRemainingBudget(rpcPromise, remainingMs)
      if (!outcome.ok) {
        partial = true
        errors.push({
          scope,
          configId,
          code: outcome.timedOut ? 'TIMEOUT' : classifyRpcErrorCode(outcome.error),
          message: sanitizeErrorText(outcome.error),
        })
        break
      }

      if (!Array.isArray(outcome.value)) {
        partial = true
        errors.push({
          scope,
          configId,
          code: 'ODOO_RPC_ERROR',
          message: `Unexpected non-array search_read response for pos.config ${configId} at offset ${offset}.`,
        })
        break
      }

      const rows = outcome.value
      for (const row of rows) {
        if (
          typeof row.state === 'string' &&
          !(POS_ORDER_VALID_STATES as readonly string[]).includes(row.state)
        ) {
          continue
        }

        const rawDateOrder = typeof row.date_order === 'string' ? row.date_order : null
        const kuwaitDate =
          odooUtcToKuwaitIso(rawDateOrder)?.kuwaitDate ??
          (rawDateOrder && isValidIsoDate(rawDateOrder) ? rawDateOrder : null)

        if (!kuwaitDate) {
          unparseableRows += 1
          continue
        }

        const netKwd = posOrderNet(row.amount_total, row.amount_tax ?? 0)
        addPoint(kuwaitDate, 1, netKwd)
      }

      if (rows.length < limit) {
        break
      }
      offset += limit
    }

    if (unparseableRows > 0) {
      partial = true
      errors.push({
        scope,
        configId,
        code: 'ODOO_RPC_ERROR',
        message: `Could not parse date_order on ${unparseableRows} search_read row(s) for pos.config ${configId}.`,
      })
    }
  }

  const daily: DailySalesPoint[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, agg]) => ({
      date,
      orders: agg.orders,
      netKwd: roundKwd3(agg.netKwd),
    }))

  const totalOrders = daily.reduce((sum, point) => sum + point.orders, 0)
  const totalNetKwd = roundKwd3(daily.reduce((sum, point) => sum + point.netKwd, 0))

  return {
    configId,
    activeStatus,
    queryModeUsed: mode,
    daily,
    totalOrders,
    totalNetKwd,
    partial,
    errors,
  }
}
