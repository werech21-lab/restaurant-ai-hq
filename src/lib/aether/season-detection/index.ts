import { SALARY_WINDOW_DAYS, isSalaryWindowDay } from '@/lib/aether/salary-window'

import {
  BOOTH_EVENT_GAP_DAYS,
  BOOTH_POS_CONFIG_IDS,
  analyzeBoothHistory,
  detectBoothEventsFromPerConfigDaily,
  detectBoothSeasons,
  type BoothConfigSummary,
  type BoothDailyPoint,
  type BoothEvent,
  type BoothSeasonDetectionResult,
} from './booths'
import {
  CANTEEN_POS_CONFIG_IDS,
  CANTEEN_TERM_GAP_DAYS,
  analyzeCanteenHistory,
  detectCanteenSeasons,
  detectCanteenTermsFromDaily,
  type CanteenConfigSummary,
  type CanteenSeasonDetectionResult,
  type CanteenTermRun,
} from './canteens'
import {
  ODOO_SEARCH_READ_PAGE_LIMIT,
  POS_ORDER_VALID_STATES,
  READ_ONLY_ODOO_METHODS,
  SEASON_DETECTION_BUDGET_MS,
  SEASON_DETECTION_TIMEZONE,
  SEASON_HISTORY_START_KUWAIT,
  createBudgetTracker,
  createReadOnlyOdooExecutor,
  fetchConfigDailyPosHistory,
  fetchPosConfigActiveStatus,
  isoDayDiff,
  isValidIsoDate,
  parseKuwaitDayFromReadGroupRow,
  resolveSeasonWindowBounds,
  roundKwd3,
  runWithRemainingBudget,
  sanitizeErrorText,
  type BudgetTracker,
  type ConfigActiveStatus,
  type ConfigDailyFetchResult,
  type DailySalesPoint,
  type QueryMode,
  type ReadOnlyOdooExecutor,
  type ReadOnlyOdooMethod,
  type SeasonDetectionError,
} from './odoo-reader'

export {
  SALARY_WINDOW_DAYS,
  isSalaryWindowDay,
  SEASON_HISTORY_START_KUWAIT,
  SEASON_DETECTION_TIMEZONE,
  POS_ORDER_VALID_STATES,
  ODOO_SEARCH_READ_PAGE_LIMIT,
  SEASON_DETECTION_BUDGET_MS,
  READ_ONLY_ODOO_METHODS,
  CANTEEN_POS_CONFIG_IDS,
  CANTEEN_TERM_GAP_DAYS,
  BOOTH_POS_CONFIG_IDS,
  BOOTH_EVENT_GAP_DAYS,
  roundKwd3,
  isValidIsoDate,
  isoDayDiff,
  resolveSeasonWindowBounds,
  sanitizeErrorText,
  createBudgetTracker,
  createReadOnlyOdooExecutor,
  runWithRemainingBudget,
  parseKuwaitDayFromReadGroupRow,
  fetchPosConfigActiveStatus,
  fetchConfigDailyPosHistory,
  detectCanteenTermsFromDaily,
  analyzeCanteenHistory,
  detectCanteenSeasons,
  detectBoothEventsFromPerConfigDaily,
  analyzeBoothHistory,
  detectBoothSeasons,
}

export type {
  ReadOnlyOdooMethod,
  ReadOnlyOdooExecutor,
  QueryMode,
  ConfigActiveStatus,
  DailySalesPoint,
  SeasonDetectionError,
  BudgetTracker,
  ConfigDailyFetchResult,
  CanteenTermRun,
  CanteenConfigSummary,
  CanteenSeasonDetectionResult,
  BoothDailyPoint,
  BoothEvent,
  BoothConfigSummary,
  BoothSeasonDetectionResult,
}

export interface SeasonDetectionReport {
  ok: true
  generatedAt: string
  timezone: typeof SEASON_DETECTION_TIMEZONE
  window: {
    fromKuwaitDate: string
    toKuwaitDate: string
  }
  budgetMs: number
  elapsedMs: number
  partial: boolean
  errors: SeasonDetectionError[]
  salaryWindow: typeof SALARY_WINDOW_DAYS
  canteens: CanteenSeasonDetectionResult
  booths: BoothSeasonDetectionResult
}

function deduplicateErrors(
  allErrors: readonly SeasonDetectionError[],
): SeasonDetectionError[] {
  const seen = new Set<string>()
  const unique: SeasonDetectionError[] = []
  for (const err of allErrors) {
    const key = `${err.scope}|${err.configId ?? ''}|${err.code}|${err.message}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(err)
    }
  }
  return unique
}

export async function runSeasonDetection(options?: {
  fromKuwaitDate?: string
  toKuwaitDate?: string
  mode?: QueryMode
  pageSize?: number
  budgetMs?: number
  executor?: ReadOnlyOdooExecutor
  now?: Date
}): Promise<SeasonDetectionReport> {
  const referenceNow = options?.now ?? new Date()
  const windowBounds = resolveSeasonWindowBounds(
    options?.fromKuwaitDate,
    options?.toKuwaitDate,
    referenceNow,
  )
  const budget = createBudgetTracker(options?.budgetMs ?? SEASON_DETECTION_BUDGET_MS)
  const executor = options?.executor ?? createReadOnlyOdooExecutor()

  const allConfigIds = [...CANTEEN_POS_CONFIG_IDS, ...BOOTH_POS_CONFIG_IDS]
  const configMeta = await fetchPosConfigActiveStatus(allConfigIds, {
    executor,
    budget,
  })

  const canteens = await detectCanteenSeasons({
    fromKuwaitDate: windowBounds.fromKuwaitDate,
    toKuwaitDate: windowBounds.toKuwaitDate,
    mode: options?.mode,
    pageSize: options?.pageSize,
    executor,
    budget,
    now: referenceNow,
    activeStatusByConfigId: configMeta.statusByConfigId,
  })

  const booths = await detectBoothSeasons({
    fromKuwaitDate: windowBounds.fromKuwaitDate,
    toKuwaitDate: windowBounds.toKuwaitDate,
    mode: options?.mode,
    pageSize: options?.pageSize,
    executor,
    budget,
    now: referenceNow,
    activeStatusByConfigId: configMeta.statusByConfigId,
  })

  const errors = deduplicateErrors([
    ...configMeta.errors,
    ...canteens.errors,
    ...booths.errors,
  ])
  const partial =
    configMeta.partial || canteens.partial || booths.partial || errors.length > 0

  return {
    ok: true,
    generatedAt: referenceNow.toISOString(),
    timezone: SEASON_DETECTION_TIMEZONE,
    window: {
      fromKuwaitDate: windowBounds.fromKuwaitDate,
      toKuwaitDate: windowBounds.toKuwaitDate,
    },
    budgetMs: budget.budgetMs,
    elapsedMs: budget.elapsedMs(),
    partial,
    errors,
    salaryWindow: SALARY_WINDOW_DAYS,
    canteens,
    booths,
  }
}

const CSV_HEADER_COLUMNS = [
  'section',
  'scope',
  'config_ids',
  'name',
  'start_date',
  'end_date',
  'days',
  'selling_days',
  'orders',
  'net_kwd',
  'gap_before_days',
  'active_status',
  'partial',
  'error',
] as const

type CsvCellValue = string | number | boolean | undefined

function escapeCsvCell(value: CsvCellValue): string {
  if (value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '0'
  }
  if (value === '') return ''

  const isSignedNumericLiteral = /^-\d+(\.\d+)?$/.test(value)
  const formulaSafe =
    !isSignedNumericLiteral && /^[=+\-@]/.test(value) ? `'${value}` : value

  if (/[",\r\n]/.test(formulaSafe)) {
    return `"${formulaSafe.replace(/"/g, '""')}"`
  }
  return formulaSafe
}

function encodeCsvRow(cells: readonly CsvCellValue[]): string {
  return cells.map((cell) => escapeCsvCell(cell)).join(',')
}

export function serializeSeasonDetectionCsv(report: SeasonDetectionReport): string {
  const lines: string[] = [CSV_HEADER_COLUMNS.join(',')]

  const salarySpanDays = report.salaryWindow.end - report.salaryWindow.start + 1
  lines.push(
    encodeCsvRow([
      'salary_window',
      'company',
      '',
      'monthly_salary_window_day_of_month',
      String(report.salaryWindow.start),
      String(report.salaryWindow.end),
      salarySpanDays,
      '',
      '',
      '',
      '',
      '',
      report.partial,
      '',
    ]),
  )

  const canteenCombinedIds = report.canteens.configIds.join('|')
  for (const term of report.canteens.combined.terms) {
    lines.push(
      encodeCsvRow([
        'canteen_term',
        'canteen_combined',
        canteenCombinedIds,
        '',
        term.firstSellingDay,
        term.lastSellingDay,
        term.calendarDays,
        term.sellingDays,
        term.orders,
        term.netKwd.toFixed(3),
        term.gapBeforeDays,
        '',
        report.canteens.partial,
        '',
      ]),
    )
  }

  for (const cfg of report.canteens.perConfig) {
    for (const term of cfg.terms) {
      lines.push(
        encodeCsvRow([
          'canteen_term',
          'canteen_config',
          String(cfg.configId),
          '',
          term.firstSellingDay,
          term.lastSellingDay,
          term.calendarDays,
          term.sellingDays,
          term.orders,
          term.netKwd.toFixed(3),
          term.gapBeforeDays,
          cfg.activeStatus,
          cfg.partial,
          '',
        ]),
      )
    }
  }

  for (const event of report.booths.events) {
    lines.push(
      encodeCsvRow([
        'booth_event',
        'booth_combined',
        event.configs.join('|'),
        '',
        event.start,
        event.end,
        event.days,
        event.sellingDays,
        event.orders,
        event.netKwd.toFixed(3),
        event.gapBeforeDays,
        '',
        report.booths.partial,
        '',
      ]),
    )
  }

  for (const cfg of report.canteens.perConfig) {
    lines.push(
      encodeCsvRow([
        'config_status',
        'canteen',
        String(cfg.configId),
        '',
        report.canteens.fromKuwaitDate,
        report.canteens.toKuwaitDate,
        '',
        cfg.sellingDays,
        cfg.totalOrders,
        cfg.totalNetKwd.toFixed(3),
        '',
        cfg.activeStatus,
        cfg.partial,
        cfg.errors.map((e) => e.message).join(' | '),
      ]),
    )
  }

  for (const cfg of report.booths.perConfig) {
    lines.push(
      encodeCsvRow([
        'config_status',
        'booth',
        String(cfg.configId),
        '',
        report.booths.fromKuwaitDate,
        report.booths.toKuwaitDate,
        '',
        cfg.sellingDays,
        cfg.totalOrders,
        cfg.totalNetKwd.toFixed(3),
        '',
        cfg.activeStatus,
        cfg.partial,
        cfg.errors.map((e) => e.message).join(' | '),
      ]),
    )
  }

  for (const err of report.errors) {
    lines.push(
      encodeCsvRow([
        'error',
        err.scope,
        err.configId !== undefined ? String(err.configId) : '',
        err.code,
        report.window.fromKuwaitDate,
        report.window.toKuwaitDate,
        '',
        '',
        '',
        '',
        '',
        '',
        true,
        err.message,
      ]),
    )
  }

  return `${lines.join('\n')}\n`
}
