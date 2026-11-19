/**
 * Strategic Planning & Multi-Scenario Estimation Engine (`/erp/planning`).
 * Strictly bound to live Odoo 17 telemetry (`pos.order` & `account.move.line`) across
 * the 6 approved brands and 7 approved branches (+ unattributed sales).
 *
 * Rules enforced:
 *  - ZERO static fallback (no hardcoded monthly baseline, static ratios, or `ODOO` dataset).
 *  - When Odoo is disconnected or returns `noData`, `noData: true` is returned with zero numbers.
 *  - Every projected figure exposes its explicit mathematical formula (`formulaAr` / `formulaEn`)
 *    and is tagged as `«تقدير»` in the UI.
 */

import {
  DEFAULT_GLOBAL_FILTERS,
  calendarDaysInIsoMonth,
  computeGlobalWorkspace,
  type GlobalFilters,
  type GlobalWorkspaceSlice,
} from '@/lib/aether/global-filter-engine'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { isNonCompanyCatalogItem } from '@/lib/odoo/non-company-products'

export type ForecastHorizonId = '30d' | '90d' | '6m' | '12m' | 'custom'
export type ScenarioTierId = 'conservative' | 'realistic' | 'ambitious'

export interface ScenarioForecastCard {
  id: ScenarioTierId
  badgeAr: string
  badgeEn: string
  subtitleAr: string
  subtitleEn: string
  projectedSalesKwd: number
  projectedCostsKwd: number
  projectedNetCashKwd: number
  projectedOrders: number
  netMarginPct: number
  paybackDays: number
  paybackLabelAr: string
  paybackLabelEn: string
  salesFormulaAr: string
  salesFormulaEn: string
  costsFormulaAr: string
  costsFormulaEn: string
  netFormulaAr: string
  netFormulaEn: string
  assumptionsAr: string[]
  assumptionsEn: string[]
}

export interface StrategicRoadmapPhase {
  id: string
  phaseCode: string
  titleAr: string
  titleEn: string
  startDate: string
  endDate: string
  ownerAr: string
  ownerEn: string
  costCapKwd: number
  expectedMonthlyGainKwd: number
  targetKpiAr: string
  targetKpiEn: string
  odooWatchMetricAr: string
  odooWatchMetricEn: string
}

export interface KuwaitMarketSignal {
  id: string
  titleAr: string
  titleEn: string
  impactBadgeAr: string
  impactBadgeEn: string
  formulaAr: string
  formulaEn: string
  detailAr: string
  detailEn: string
  tone: 'emerald' | 'sky' | 'amber'
}

export interface StrategicBriefingSection {
  id: 'baseline' | 'seasonality' | 'execution'
  index: 1 | 2 | 3
  titleAr: string
  titleEn: string
  bodyAr: string
  bodyEn: string
  metricBadgeAr: string
  metricBadgeEn: string
}

export interface PlanningHubSnapshot {
  odooConnected: boolean
  noData: boolean
  noDataMessageAr: string
  noDataMessageEn: string
  isStale24h: boolean
  glIncomplete: boolean
  glWarningAr: string | null
  aggregatorCommissionUnposted: boolean
  horizonId: ForecastHorizonId
  horizonDays: number
  horizonMonths: number
  horizonLabelAr: string
  horizonLabelEn: string
  accountingAvailable: boolean
  unavailableReasonAr: string | null
  unavailableReasonEn: string | null
  lastSyncedAt: string | null
  periodFromIso: string
  periodToIso: string
  sourcePeriodDays: number
  monthlyBaselineSalesKwd: number
  monthlyBaselineCostsKwd: number
  monthlyBaselineNetKwd: number
  monthlyBaselineMarginPct: number
  dailyAverageSalesKwd: number
  dailyAverageNetKwd: number
  activePeriodSalesKwd: number
  isTodayPeriodActive: boolean
  ardiyaFoodPct: number
  deliveryFeePct: number
  paydayLiftPct: number
  directChannelSharePct: number
  baselineFormulaAr: string
  baselineFormulaEn: string
  costShareFormulaAr: string
  costShareFormulaEn: string
  momentumFormulaAr: string
  momentumFormulaEn: string
  scenarios: ScenarioForecastCard[]
  signals: KuwaitMarketSignal[]
}

export const STRATEGIC_ROADMAP_STORAGE_KEY = 'vf_strategic_roadmap_v2_clean'
export const MIN_VALID_STRATEGIC_BRIEFING_CHARS = 180

export const FORECAST_HORIZON_OPTIONS: readonly {
  id: ForecastHorizonId
  ar: string
  en: string
  days: number
  months: number
}[] = [
  { id: '30d', ar: '30 يوم', en: '30 Days', days: 30, months: 1 },
  { id: '90d', ar: '90 يوم', en: '90 Days', days: 90, months: 3 },
  { id: '6m', ar: '6 أشهر', en: '6 Months', days: 180, months: 6 },
  { id: '12m', ar: '12 شهر', en: '12 Months', days: 365, months: 12 },
  { id: 'custom', ar: 'مخصص 📅', en: 'Custom 📅', days: 45, months: 1.5 },
] as const

const fmtInt = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')
const fmtOne = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

/**
 * Replaces raw English operational codes (`TgO`/`Tgo`, `TMP`, `EXB`) inside Arabic copy
 * with fluent executive Arabic terminology so RTL lines never jumble with LTR acronyms.
 */
export function localizeArabicPlanningCopy(input: string): string {
  if (!input) return ''
  return input
    .replace(/بوثات المطبخ المركزي المتنقلة/g, 'بوثات مطبخ العارضية المركزي المتنقلة')
    .replace(
      /(و)?(?:بوثات|معارض|المعارض)\s*EXB(?:\s*المتنقلة)?/gi,
      (_match, prefix: string | undefined) => `${prefix ?? ''}بوثات مطبخ العارضية المركزي المتنقلة`,
    )
    .replace(/\bEXB\b/gi, 'بوثات مطبخ العارضية المركزي المتنقلة')
    .replace(
      /(و)?(?:منصة\s+توصيل\s+طلبات|أسطولنا|أسطول|سائقينا)\s*TMP/gi,
      (_match, prefix: string | undefined) => `${prefix ?? ''}أسطول التوصيل الداخلي المباشر`,
    )
    .replace(/\bTMP\b/gi, 'أسطول التوصيل الداخلي المباشر')
    .replace(
      /(و)?طلبات\s*TgO/gi,
      (_match, prefix: string | undefined) => `${prefix ?? ''}طلبات منصات التوصيل الخارجي`,
    )
    .replace(/\bTgO\b/gi, 'طلبات منصات التوصيل الخارجي')
}

/**
 * Strips raw Markdown tokens (`#`, `##`, `**`, `*`, `__`, backticks, code fences)
 * so AI output renders as clean executive plain text with zero raw Markdown symbols.
 */
export function stripStrategicMarkdown(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`+/g, '')
    .replace(/(^|\n)\s*#{1,6}\s*/g, '$1')
    .replace(/#{2,}/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/(^|\n)\s*[*•-]\s+/g, '$1')
    .replace(/(?<!\w)\*(?!\s)|(?<!\s)\*(?!\w)/g, '')
    .replace(/(^|\n)\s*>\s*/g, '$1')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Completeness guard: rejects empty, stub, or unfinished outputs shorter than 180 characters.
 */
export function isBriefingTruncatedOrIncomplete(cleanedPlainText: string): boolean {
  const trimmed = cleanedPlainText.trim()
  if (trimmed.length < MIN_VALID_STRATEGIC_BRIEFING_CHARS) return true
  if (/[:،,\-–—(]$/.test(trimmed)) return true
  return false
}

/** Zero pre-populated static phases — user defines phases explicitly. */
export const INITIAL_STRATEGIC_PHASES: StrategicRoadmapPhase[] = []

export function sanitizeStrategicPhases(raw: unknown): StrategicRoadmapPhase[] {
  if (!Array.isArray(raw) || raw.length === 0) return INITIAL_STRATEGIC_PHASES
  const out: StrategicRoadmapPhase[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Partial<StrategicRoadmapPhase>
    if (!r.id || !r.titleAr) continue
    const textFields = [
      r.titleAr,
      r.titleEn,
      r.ownerAr,
      r.ownerEn,
      r.targetKpiAr,
      r.targetKpiEn,
      r.odooWatchMetricAr,
      r.odooWatchMetricEn,
    ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    if (
      textFields.some(
        (txt) => isExcludedOdooEntity(txt) || isNonCompanyCatalogItem(null, txt),
      )
    ) {
      continue
    }
    out.push({
      id: String(r.id),
      phaseCode: typeof r.phaseCode === 'string' && r.phaseCode ? r.phaseCode : `P${out.length + 1}`,
      titleAr: localizeArabicPlanningCopy(String(r.titleAr)),
      titleEn: typeof r.titleEn === 'string' && r.titleEn ? r.titleEn : String(r.titleAr),
      startDate:
        typeof r.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.startDate)
          ? r.startDate
          : '2026-11-15',
      endDate:
        typeof r.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.endDate)
          ? r.endDate
          : '2026-12-31',
      ownerAr:
        typeof r.ownerAr === 'string' && r.ownerAr
          ? localizeArabicPlanningCopy(r.ownerAr)
          : 'إدارة التشغيل',
      ownerEn: typeof r.ownerEn === 'string' && r.ownerEn ? r.ownerEn : 'Operations Team',
      costCapKwd: Math.max(0, Number(r.costCapKwd) || 0),
      expectedMonthlyGainKwd: Math.max(0, Number(r.expectedMonthlyGainKwd) || 0),
      targetKpiAr:
        typeof r.targetKpiAr === 'string' && r.targetKpiAr
          ? localizeArabicPlanningCopy(r.targetKpiAr)
          : 'تحقيق المستهدف الربحي الشهري',
      targetKpiEn:
        typeof r.targetKpiEn === 'string' && r.targetKpiEn
          ? r.targetKpiEn
          : 'Hit monthly net profit target',
      odooWatchMetricAr:
        typeof r.odooWatchMetricAr === 'string' && r.odooWatchMetricAr
          ? localizeArabicPlanningCopy(r.odooWatchMetricAr)
          : 'متابعة الصرف عبر قيود أودو 17',
      odooWatchMetricEn:
        typeof r.odooWatchMetricEn === 'string' && r.odooWatchMetricEn
          ? r.odooWatchMetricEn
          : 'Tracked via Odoo 17 POS & vendor bills',
    })
  }
  return out
}

function resolveHorizonWindow(
  horizonId: ForecastHorizonId,
  customFrom: string,
  customTo: string,
): {
  horizonDays: number
  monthsSpan: number
  horizonLabelAr: string
  horizonLabelEn: string
} {
  if (horizonId === '30d') {
    return {
      horizonDays: 30,
      monthsSpan: 1,
      horizonLabelAr: 'تقديرات 30 يوم القادمة (1× شهر)',
      horizonLabelEn: 'Next 30 Days Estimate (1x Month)',
    }
  }
  if (horizonId === '90d') {
    return {
      horizonDays: 90,
      monthsSpan: 3,
      horizonLabelAr: 'تقديرات 90 يوم القادمة (3× أشهر)',
      horizonLabelEn: 'Next 90 Days Estimate (3x Months)',
    }
  }
  if (horizonId === '6m') {
    return {
      horizonDays: 180,
      monthsSpan: 6,
      horizonLabelAr: 'تقديرات 6 أشهر (نصف سنوية)',
      horizonLabelEn: '6-Month Horizon Estimate',
    }
  }
  if (horizonId === '12m') {
    return {
      horizonDays: 365,
      monthsSpan: 12,
      horizonLabelAr: 'تقديرات 12 شهر (سنة كاملة)',
      horizonLabelEn: '12-Month Full-Year Estimate',
    }
  }
  const startMs = new Date(`${customFrom}T00:00:00Z`).getTime()
  const endMs = new Date(`${customTo}T00:00:00Z`).getTime()
  const diff =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.round((Math.max(startMs, endMs) - Math.min(startMs, endMs)) / 86_400_000) + 1
      : 45
  const horizonDays = Math.max(1, Math.min(730, diff))
  return {
    horizonDays,
    monthsSpan: horizonDays / 30,
    horizonLabelAr: `فترة تقديرية مخصصة (${customFrom} ← ${customTo} · ${horizonDays} يوم)`,
    horizonLabelEn: `Custom Estimate Horizon (${customFrom} → ${customTo} · ${horizonDays}d)`,
  }
}

export function computePlanningHubSnapshot(
  workspace: GlobalWorkspaceSlice,
  phases: StrategicRoadmapPhase[],
  horizonId: ForecastHorizonId,
  customFrom: string,
  customTo: string,
  liveSummary?: OdooLiveSummary | null,
): PlanningHubSnapshot {
  const { horizonDays, monthsSpan, horizonLabelAr, horizonLabelEn } = resolveHorizonWindow(
    horizonId,
    customFrom,
    customTo,
  )

  const summaryDisconnected =
    liveSummary !== undefined && (!liveSummary || !liveSummary.connected || Boolean(liveSummary.noData))

  if (!workspace.odooConnected || workspace.noData || summaryDisconnected) {
    return {
      odooConnected: false,
      noData: true,
      noDataMessageAr: 'لا توجد بيانات من Odoo لهذه الفترة',
      noDataMessageEn: 'No data from Odoo for this period',
      isStale24h: Boolean(workspace.isStale24h),
      glIncomplete: Boolean(workspace.glIncomplete),
      glWarningAr: workspace.glWarningAr,
      aggregatorCommissionUnposted: Boolean(workspace.aggregatorCommissionUnposted),
      horizonId,
      horizonDays,
      horizonMonths: monthsSpan,
      horizonLabelAr,
      horizonLabelEn,
      accountingAvailable: false,
      unavailableReasonAr: 'لا توجد بيانات من Odoo لهذه الفترة',
      unavailableReasonEn: 'No data from Odoo for this period',
      lastSyncedAt: workspace.lastSyncAt ?? workspace.lastSyncedAt ?? null,
      periodFromIso: workspace.dateRange?.from ?? '',
      periodToIso: workspace.dateRange?.to ?? '',
      sourcePeriodDays: 0,
      monthlyBaselineSalesKwd: 0,
      monthlyBaselineCostsKwd: 0,
      monthlyBaselineNetKwd: 0,
      monthlyBaselineMarginPct: 0,
      dailyAverageSalesKwd: 0,
      dailyAverageNetKwd: 0,
      activePeriodSalesKwd: 0,
      isTodayPeriodActive: workspace.filters.period === 'today',
      ardiyaFoodPct: 0,
      deliveryFeePct: 0,
      paydayLiftPct: 0,
      directChannelSharePct: 0,
      baselineFormulaAr: '',
      baselineFormulaEn: '',
      costShareFormulaAr: '',
      costShareFormulaEn: '',
      momentumFormulaAr: '',
      momentumFormulaEn: '',
      scenarios: [],
      signals: [],
    }
  }

  // Respect the active period on `workspace.filters.period` (`today`, `week`, `month`, `year`) so switching periods
  // updates baselines, GL completeness warnings, and aggregator commission posting states dynamically.
  const baseWorkspace =
    liveSummary !== undefined
      ? computeGlobalWorkspace(
          {
            ...workspace.filters,
            kuwaitSlice: 'all',
            lens: 'all',
          },
          liveSummary ?? undefined,
          '/erp/planning',
        )
      : workspace

  if (!baseWorkspace.odooConnected || baseWorkspace.noData || baseWorkspace.salesKwd <= 0) {
    return {
      odooConnected: Boolean(workspace.odooConnected),
      noData: true,
      noDataMessageAr: 'لا توجد بيانات من Odoo لهذه الفترة',
      noDataMessageEn: 'No data from Odoo for this period',
      isStale24h: Boolean(workspace.isStale24h),
      glIncomplete: Boolean(workspace.glIncomplete),
      glWarningAr: workspace.glWarningAr,
      aggregatorCommissionUnposted: Boolean(workspace.aggregatorCommissionUnposted),
      horizonId,
      horizonDays,
      horizonMonths: monthsSpan,
      horizonLabelAr,
      horizonLabelEn,
      accountingAvailable: false,
      unavailableReasonAr: 'لا توجد بيانات من Odoo لهذه الفترة',
      unavailableReasonEn: 'No data from Odoo for this period',
      lastSyncedAt: workspace.lastSyncAt ?? workspace.lastSyncedAt ?? null,
      periodFromIso: baseWorkspace.dateRange?.from ?? workspace.dateRange?.from ?? '',
      periodToIso: baseWorkspace.dateRange?.to ?? workspace.dateRange?.to ?? '',
      sourcePeriodDays: 0,
      monthlyBaselineSalesKwd: 0,
      monthlyBaselineCostsKwd: 0,
      monthlyBaselineNetKwd: 0,
      monthlyBaselineMarginPct: 0,
      dailyAverageSalesKwd: 0,
      dailyAverageNetKwd: 0,
      activePeriodSalesKwd: 0,
      isTodayPeriodActive: workspace.filters.period === 'today',
      ardiyaFoodPct: 0,
      deliveryFeePct: 0,
      paydayLiftPct: 0,
      directChannelSharePct: 0,
      baselineFormulaAr: '',
      baselineFormulaEn: '',
      costShareFormulaAr: '',
      costShareFormulaEn: '',
      momentumFormulaAr: '',
      momentumFormulaEn: '',
      scenarios: [],
      signals: [],
    }
  }

  const sourcePeriodDays = Math.max(1, baseWorkspace.periodDays || 1)
  const monthLength =
    calendarDaysInIsoMonth(baseWorkspace.dateRange?.to) ?? sourcePeriodDays
  const monthlyScale = monthLength / sourcePeriodDays
  const monthlyBaselineSalesRaw = Math.max(0, baseWorkspace.salesKwd * monthlyScale)
  const monthlyBaselineSalesKwd = Math.round(monthlyBaselineSalesRaw)
  const monthlyBaselineOrders = Math.max(1, Math.round(baseWorkspace.orders * monthlyScale))

  const accountingAvailable =
    Boolean(baseWorkspace.accounting.available) &&
    baseWorkspace.accounting.netProfitPct !== null &&
    Number.isFinite(baseWorkspace.accounting.netProfitPct)

  const resolvedNetProfitPct = accountingAvailable
    ? (baseWorkspace.accounting.netProfitPct ?? 0)
    : 0

  const monthlyBaselineNetRaw = accountingAvailable
    ? monthlyBaselineSalesRaw * (resolvedNetProfitPct / 100)
    : 0
  const monthlyBaselineCostsKwd = accountingAvailable
    ? Math.round(Math.max(0, monthlyBaselineSalesRaw - monthlyBaselineNetRaw))
    : 0
  const monthlyBaselineNetKwd = accountingAvailable
    ? monthlyBaselineSalesKwd - monthlyBaselineCostsKwd
    : 0
  const monthlyBaselineMarginPct =
    accountingAvailable && monthlyBaselineSalesKwd > 0
      ? (monthlyBaselineNetKwd / monthlyBaselineSalesKwd) * 100
      : 0

  const dailyAverageSalesKwd = Math.round(Math.max(0, baseWorkspace.salesKwd) / sourcePeriodDays)
  const dailyAverageNetKwd = accountingAvailable
    ? Math.round(Math.max(0, baseWorkspace.salesKwd) * (resolvedNetProfitPct / 100) / sourcePeriodDays)
    : 0
  const activePeriodSalesKwd = Math.round(Math.max(0, workspace.salesKwd))
  const isTodayPeriodActive = workspace.filters.period === 'today'

  // Observed period-over-period sales momentum strictly from Odoo `periodComparison` (zero static 4720/3980/18.4%)
  const monthComparison = liveSummary?.buckets?.month?.periodComparison
  const paydayLiftPct =
    monthComparison && monthComparison.priorNetKwd > 0
      ? Math.round(
          ((monthComparison.currentNetKwd - monthComparison.priorNetKwd) /
            monthComparison.priorNetKwd) *
            1000,
        ) / 10
      : 0

  const ardiyaFoodPct =
    accountingAvailable && baseWorkspace.accounting.cogsPct !== null
      ? Math.round(baseWorkspace.accounting.cogsPct * 10) / 10
      : 0
  const deliveryFeePct =
    accountingAvailable &&
    !baseWorkspace.aggregatorCommissionUnposted &&
    baseWorkspace.accounting.deliveryCommPct !== null
      ? Math.round(baseWorkspace.accounting.deliveryCommPct * 10) / 10
      : 0

  // Direct zero-commission share strictly from live Odoo `uiChannels` / channel options (zero static 28.5%)
  const channelOpts = baseWorkspace.cascadingOptions.channels.filter((c) => c.id !== 'all')
  const totalChannelSales = channelOpts.reduce((s, c) => s + (c.salesKwd ?? 0), 0)
  const directChannelSales = channelOpts
    .filter((c) => c.id === 'dine-in' || c.id === 'takeaway-direct')
    .reduce((s, c) => s + (c.salesKwd ?? 0), 0)
  const directChannelSharePct =
    baseWorkspace.filters.channel === 'dine-in' || baseWorkspace.filters.channel === 'takeaway-direct'
      ? 100
      : totalChannelSales > 0
        ? Math.round((directChannelSales / totalChannelSales) * 1000) / 10
        : 0

  const periodFromIso = baseWorkspace.dateRange?.from || workspace.dateRange?.from || ''
  const periodToIso = baseWorkspace.dateRange?.to || workspace.dateRange?.to || ''

  const baselineFormulaAr = `خط الأساس التقديري (${monthLength} يوم) = مبيعات الفترة (${fmtInt(baseWorkspace.salesKwd)} د.ك ÷ ${sourcePeriodDays} يوم) × ${monthLength} = ${fmtInt(monthlyBaselineSalesKwd)} د.ك`
  const baselineFormulaEn = `${monthLength}d Baseline Estimate = (${fmtInt(baseWorkspace.salesKwd)} KWD ÷ ${sourcePeriodDays}d) × ${monthLength} = ${fmtInt(monthlyBaselineSalesKwd)} KWD`

  const costShareFormulaAr = accountingAvailable
    ? `نسبة تكلفة المواد (${fmtOne(ardiyaFoodPct)}%) = تكلفة البضاعة ÷ الإيراد | نسبة العمولات (${baseWorkspace.aggregatorCommissionUnposted ? 'غير مُرحَّل بعد' : `${fmtOne(deliveryFeePct)}%`}) | حصة المباشر (${fmtOne(directChannelSharePct)}%) = مبيعات الصالة والسفري ÷ إجمالي القنوات`
    : 'قيود التكلفة غير مكتملة في دفتر الأستاذ لهذه الفترة'
  const costShareFormulaEn = accountingAvailable
    ? `COGS% (${fmtOne(ardiyaFoodPct)}%) = COGS ÷ Revenue | Comm% (${baseWorkspace.aggregatorCommissionUnposted ? 'Unposted' : `${fmtOne(deliveryFeePct)}%`}) | Direct% (${fmtOne(directChannelSharePct)}%) = (Dine-in + Direct) ÷ Total`
    : 'GL cost lines incomplete for this period'

  const momentumFormulaAr =
    monthComparison && monthComparison.priorNetKwd > 0
      ? `التغير الدوري = ((${fmtInt(monthComparison.currentNetKwd)} − ${fmtInt(monthComparison.priorNetKwd)}) ÷ ${fmtInt(monthComparison.priorNetKwd)}) × 100 = ${paydayLiftPct >= 0 ? '+' : ''}${fmtOne(paydayLiftPct)}%`
      : 'التغير الدوري = 0.0% (بانتظار فترة مقارنة سابقة من pos.order)'
  const momentumFormulaEn =
    monthComparison && monthComparison.priorNetKwd > 0
      ? `Period Momentum = ((${fmtInt(monthComparison.currentNetKwd)} − ${fmtInt(monthComparison.priorNetKwd)}) ÷ ${fmtInt(monthComparison.priorNetKwd)}) × 100 = ${paydayLiftPct >= 0 ? '+' : ''}${fmtOne(paydayLiftPct)}%`
      : 'Period Momentum = 0.0% (no prior comparison window)'

  const isAllScope =
    baseWorkspace.filters.brand === 'all' &&
    baseWorkspace.filters.branch === 'all' &&
    baseWorkspace.filters.channel === 'all'
  const sliceRatio = isAllScope
    ? 1
    : Math.max(0.05, Math.min(1, baseWorkspace.dimensionShare || 0.1))

  const totalRoadmapCapexKwd = Math.round(
    phases.reduce((s, p) => s + p.costCapKwd, 0) * sliceRatio,
  )
  const totalMonthlyRoadmapGainKwd =
    phases.reduce((s, p) => s + p.expectedMonthlyGainKwd, 0) * sliceRatio

  const buildScenario = (
    id: ScenarioTierId,
    badgeAr: string,
    badgeEn: string,
    subtitleAr: string,
    subtitleEn: string,
    salesGrowthPct: number,
    costEfficiencyPct: number,
    roadmapCaptureRatio: number,
    assumptionsAr: string[],
    assumptionsEn: string[],
  ): ScenarioForecastCard => {
    const baseSalesHorizon = monthlyBaselineSalesKwd * monthsSpan
    const baseCostsHorizon = monthlyBaselineCostsKwd * monthsSpan

    const roadmapRevenueLiftKwd =
      totalMonthlyRoadmapGainKwd * monthsSpan * roadmapCaptureRatio * 0.2
    const roadmapCostSavingKwd = Math.min(
      baseCostsHorizon * 0.12,
      totalMonthlyRoadmapGainKwd * monthsSpan * roadmapCaptureRatio * 0.15,
    )

    const projectedSalesKwd = Math.round(
      Math.max(0, baseSalesHorizon * (1 + salesGrowthPct) + roadmapRevenueLiftKwd),
    )
    const variableCostAdjust = 1 + salesGrowthPct * 0.58 - costEfficiencyPct
    const capexForHorizon = Math.round(totalRoadmapCapexKwd * Math.min(1, monthsSpan))
    const projectedCostsKwd = accountingAvailable
      ? Math.round(
          Math.max(0, baseCostsHorizon * variableCostAdjust + capexForHorizon - roadmapCostSavingKwd),
        )
      : 0
    const projectedNetCashKwd = accountingAvailable ? projectedSalesKwd - projectedCostsKwd : 0
    const projectedOrders = Math.max(
      1,
      Math.round(monthlyBaselineOrders * monthsSpan * (1 + salesGrowthPct * 0.85)),
    )
    const netMarginPct =
      accountingAvailable && projectedSalesKwd > 0
        ? (projectedNetCashKwd / projectedSalesKwd) * 100
        : 0

    const dailyIncrementalGain =
      totalMonthlyRoadmapGainKwd > 0
        ? Math.max(1, (totalMonthlyRoadmapGainKwd * roadmapCaptureRatio) / 30)
        : 0
    const paybackDays =
      totalRoadmapCapexKwd <= 0 || dailyIncrementalGain <= 0
        ? 0
        : Math.max(5, Math.min(180, Math.round(totalRoadmapCapexKwd / dailyIncrementalGain)))

    const growthPctLabel = fmtOne(salesGrowthPct * 100)
    const effPctLabel = fmtOne(costEfficiencyPct * 100)
    const monthsLabel = fmtOne(monthsSpan)

    const salesFormulaAr = `المبيعات المقدّرة = (${fmtInt(monthlyBaselineSalesKwd)} × ${monthsLabel} شهر) × (1 + ${growthPctLabel}%) + أثر المراحل (${fmtInt(roadmapRevenueLiftKwd)}) = ${fmtInt(projectedSalesKwd)} د.ك`
    const salesFormulaEn = `Est. Sales = (${fmtInt(monthlyBaselineSalesKwd)} × ${monthsLabel}m) × (1 + ${growthPctLabel}%) + Roadmap Lift (${fmtInt(roadmapRevenueLiftKwd)}) = ${fmtInt(projectedSalesKwd)} KWD`

    const costsFormulaAr = accountingAvailable
      ? `التكاليف المقدّرة = (${fmtInt(monthlyBaselineCostsKwd)} × ${monthsLabel} شهر) × (1 + ${growthPctLabel}%×0.58 − ${effPctLabel}%) + سقف المراحل (${fmtInt(capexForHorizon)}) − وفورات (${fmtInt(roadmapCostSavingKwd)}) = ${fmtInt(projectedCostsKwd)} د.ك`
      : 'غير متوفر بدون اكتمال قيود التكلفة في account.move.line'
    const costsFormulaEn = accountingAvailable
      ? `Est. Costs = (${fmtInt(monthlyBaselineCostsKwd)} × ${monthsLabel}m) × (1 + ${growthPctLabel}%×0.58 − ${effPctLabel}%) + Capex (${fmtInt(capexForHorizon)}) − Savings (${fmtInt(roadmapCostSavingKwd)}) = ${fmtInt(projectedCostsKwd)} KWD`
      : 'Unavailable pending posted GL cost lines'

    const netFormulaAr = accountingAvailable
      ? `صافي التدفق المقدّر = المبيعات المقدّرة (${fmtInt(projectedSalesKwd)}) − التكاليف المقدّرة (${fmtInt(projectedCostsKwd)}) = ${projectedNetCashKwd >= 0 ? '+' : ''}${fmtInt(projectedNetCashKwd)} د.ك`
      : 'غير متوفر بدون اكتمال قيود دفتر الأستاذ'
    const netFormulaEn = accountingAvailable
      ? `Est. Net Cash = Est. Sales (${fmtInt(projectedSalesKwd)}) − Est. Costs (${fmtInt(projectedCostsKwd)}) = ${projectedNetCashKwd >= 0 ? '+' : ''}${fmtInt(projectedNetCashKwd)} KWD`
      : 'Unavailable pending GL postings'

    return {
      id,
      badgeAr,
      badgeEn,
      subtitleAr,
      subtitleEn,
      projectedSalesKwd,
      projectedCostsKwd,
      projectedNetCashKwd,
      projectedOrders,
      netMarginPct,
      paybackDays,
      paybackLabelAr: paybackDays === 0 ? 'بدون رأسمال إضافي' : `استرداد تقديري ${paybackDays} يوم`,
      paybackLabelEn: paybackDays === 0 ? 'Zero Extra Capex' : `Est. ${paybackDays}d Payback`,
      salesFormulaAr,
      salesFormulaEn,
      costsFormulaAr,
      costsFormulaEn,
      netFormulaAr,
      netFormulaEn,
      assumptionsAr: assumptionsAr.map(localizeArabicPlanningCopy),
      assumptionsEn,
    }
  }

  const scenarios: ScenarioForecastCard[] = [
    buildScenario(
      'conservative',
      'تقدير السيناريو المتحفظ 🛡️',
      'Conservative Estimate 🛡️',
      'افتراض نمو +3.5% مع خفض تكاليف متغيرة 1.8%',
      'Assumes +3.5% sales growth & 1.8% cost efficiency',
      0.035,
      0.018,
      0.55,
      [
        'معامل نمو مبيعات افتراضي +3.5% على خط الأساس الفعلي',
        'معامل كفاءة تكاليف افتراضي -1.8% عبر ضبط الهدر والخصومات',
        'احتساب 55% فقط من العائد المتوقع للمراحل المضافة يدوياً',
      ],
      [
        'Assumes +3.5% sales growth over normalized Odoo POS baseline',
        'Assumes -1.8% variable cost efficiency from waste & promo caps',
        'Applies 55% capture weight on user-entered roadmap phases',
      ],
    ),
    buildScenario(
      'realistic',
      'تقدير السيناريو الواقعي ⭐',
      'Realistic Estimate ⭐',
      'افتراض نمو +9.5% مع خفض تكاليف متغيرة 3.4%',
      'Assumes +9.5% sales growth & 3.4% cost efficiency',
      0.095,
      0.034,
      0.85,
      [
        'معامل نمو مبيعات افتراضي +9.5% على خط الأساس الفعلي',
        'معامل كفاءة تكاليف افتراضي -3.4% مع تحسين مزيج القنوات',
        'احتساب 85% من العائد المتوقع للمراحل المضافة يدوياً',
      ],
      [
        'Assumes +9.5% sales growth over normalized Odoo POS baseline',
        'Assumes -3.4% cost efficiency via channel & kitchen discipline',
        'Applies 85% capture weight on user-entered roadmap phases',
      ],
    ),
    buildScenario(
      'ambitious',
      'تقدير السيناريو الطموح 🚀',
      'Ambitious Estimate 🚀',
      'افتراض نمو +16.5% مع خفض تكاليف متغيرة 4.8%',
      'Assumes +16.5% sales growth & 4.8% cost efficiency',
      0.165,
      0.048,
      1.15,
      [
        'معامل نمو مبيعات افتراضي +16.5% عبر رفع حصة الصالة والطلب المباشر',
        'معامل كفاءة تكاليف افتراضي -4.8% عبر تحويل التوصيل القريب للسائقين الداخليين',
        'احتساب 115% من العائد المتوقع للمراحل المضافة يدوياً',
      ],
      [
        'Assumes +16.5% sales growth led by zero-commission Dine-In & Direct',
        'Assumes -4.8% cost efficiency via direct internal fleet routing',
        'Applies 115% capture weight on user-entered roadmap phases',
      ],
    ),
  ]

  const signals: KuwaitMarketSignal[] = [
    {
      id: 'sig-momentum',
      titleAr: 'زخم المبيعات الدوري من إيصالات نقاط البيع',
      titleEn: 'Observed POS Period-over-Period Momentum',
      impactBadgeAr: `${paydayLiftPct >= 0 ? '+' : ''}${fmtOne(paydayLiftPct)}% تغير دوري`,
      impactBadgeEn: `${paydayLiftPct >= 0 ? '+' : ''}${fmtOne(paydayLiftPct)}% Period Delta`,
      formulaAr: momentumFormulaAr,
      formulaEn: momentumFormulaEn,
      detailAr:
        'مقارنة صافي مبيعات الفترة المرجعية مقابل الفترة المماثلة السابقة في pos.order كمدخل استرشادي للتقدير.',
      detailEn:
        'Compares current reference window POS net sales against the immediately preceding window in pos.order.',
      tone: 'emerald',
    },
    {
      id: 'sig-direct-share',
      titleAr: 'حصة الصالة والسفري المباشر (0% عمولة)',
      titleEn: 'Zero-Commission Dine-In & Direct Share',
      impactBadgeAr: `${fmtOne(directChannelSharePct)}% حصة مباشرة`,
      impactBadgeEn: `${fmtOne(directChannelSharePct)}% Direct Share`,
      formulaAr: `(مبيعات الصالة + سفري ومباشر) ÷ إجمالي مبيعات القنوات × 100 = ${fmtOne(directChannelSharePct)}%`,
      formulaEn: `(Dine-In + Direct Sales) ÷ Total Channel Sales × 100 = ${fmtOne(directChannelSharePct)}%`,
      detailAr:
        'تُستخرج من توزيع إيصالات نقاط البيع حسب القناة وتُستخدم في تقدير أثر التحول من المنصات الخارجية.',
      detailEn:
        'Computed from POS channel receipts to estimate margin upside from shifting off external aggregators.',
      tone: 'sky',
    },
    {
      id: 'sig-channel-spread',
      titleAr: 'نسبة تكلفة المواد وعمولات التوصيل المرحّلة',
      titleEn: 'Posted COGS & Delivery Commission Ratio',
      impactBadgeAr: baseWorkspace.aggregatorCommissionUnposted
        ? 'عمولات: غير مُرحَّل بعد'
        : accountingAvailable
          ? `${fmtOne(ardiyaFoodPct)}% مواد + ${fmtOne(deliveryFeePct)}% عمولات`
          : '',
      impactBadgeEn: baseWorkspace.aggregatorCommissionUnposted
        ? 'Commissions: Unposted'
        : accountingAvailable
          ? `${fmtOne(ardiyaFoodPct)}% COGS + ${fmtOne(deliveryFeePct)}% Comm.`
          : 'GL Incomplete',
      formulaAr: costShareFormulaAr,
      formulaEn: costShareFormulaEn,
      detailAr: localizeArabicPlanningCopy(
        baseWorkspace.aggregatorCommissionUnposted
          ? 'عمولات منصات التوصيل غير مُرحَّلة بعد في هذه الفترة، لذا لا تُفترض صفراً في قراءة التكاليف.'
          : 'تُحسب من قيود account.move.line المرحّلة للفترة المرجعية كأساس لتقدير تكاليف السيناريوهات.',
      ),
      detailEn: baseWorkspace.aggregatorCommissionUnposted
        ? 'Aggregator commissions are not yet posted in GL for this period and are never assumed zero.'
        : 'Derived from posted account.move.line entries for scenario cost estimation.',
      tone: 'amber',
    },
  ]

  return {
    odooConnected: true,
    noData: false,
    noDataMessageAr: '',
    noDataMessageEn: '',
    isStale24h: Boolean(baseWorkspace.isStale24h || workspace.isStale24h),
    glIncomplete: Boolean(baseWorkspace.glIncomplete || workspace.glIncomplete),
    glWarningAr: baseWorkspace.glWarningAr ?? workspace.glWarningAr,
    aggregatorCommissionUnposted: Boolean(
      baseWorkspace.aggregatorCommissionUnposted || workspace.aggregatorCommissionUnposted,
    ),
    horizonId,
    horizonDays,
    horizonMonths: monthsSpan,
    horizonLabelAr,
    horizonLabelEn,
    accountingAvailable,
    unavailableReasonAr: baseWorkspace.accounting.unavailableReasonAr,
    unavailableReasonEn: baseWorkspace.accounting.unavailableReasonEn,
    lastSyncedAt:
      baseWorkspace.lastSyncAt ??
      workspace.lastSyncAt ??
      baseWorkspace.lastSyncedAt ??
      workspace.lastSyncedAt ??
      null,
    periodFromIso,
    periodToIso,
    sourcePeriodDays,
    monthlyBaselineSalesKwd,
    monthlyBaselineCostsKwd,
    monthlyBaselineNetKwd,
    monthlyBaselineMarginPct,
    dailyAverageSalesKwd,
    dailyAverageNetKwd,
    activePeriodSalesKwd,
    isTodayPeriodActive,
    ardiyaFoodPct,
    deliveryFeePct,
    paydayLiftPct,
    directChannelSharePct,
    baselineFormulaAr,
    baselineFormulaEn,
    costShareFormulaAr,
    costShareFormulaEn,
    momentumFormulaAr,
    momentumFormulaEn,
    scenarios,
    signals,
  }
}

/**
 * Builds the deterministic 3-section Executive Strategic Briefing strictly from live-derived estimates.
 */
export function buildDeterministicStrategicBriefingSections(
  snap: PlanningHubSnapshot,
  activeScenario: ScenarioForecastCard | undefined,
  scopeLabelAr: string,
  scopeLabelEn: string,
): StrategicBriefingSection[] {
  if (snap.noData || !snap.odooConnected || !activeScenario) {
    return []
  }
  const cleanScopeAr = localizeArabicPlanningCopy(scopeLabelAr)
  const hasGl = snap.accountingAvailable
  return [
    {
      id: 'baseline',
      index: 1,
      titleAr: '1. خط الأساس التقديري (تقدير مبني على pos.order)',
      titleEn: '1. Normalized Baseline Estimate (pos.order)',
      metricBadgeAr: `تقدير: ${fmtInt(snap.monthlyBaselineSalesKwd)} د.ك / شهر تقويمي`,
      metricBadgeEn: `Est: ${fmtInt(snap.monthlyBaselineSalesKwd)} KWD / calendar month`,
      bodyAr: localizeArabicPlanningCopy(
        hasGl
          ? `يرتكز النطاق النشط (${cleanScopeAr}) على خط أساس تقديري لطول الشهر التقويمي بواقع ${fmtInt(snap.monthlyBaselineSalesKwd)} د.ك مبيعات (متوسط اليوم التقديري: ${fmtInt(snap.dailyAverageSalesKwd)} د.ك) وتكاليف مقدّرة ${fmtInt(snap.monthlyBaselineCostsKwd)} د.ك وصافي تقديري ${fmtInt(snap.monthlyBaselineNetKwd)} د.ك (${fmtOne(snap.monthlyBaselineMarginPct)}%).`
          : `يرتكز النطاق النشط (${cleanScopeAr}) على خط أساس تقديري لطول الشهر التقويمي بواقع ${fmtInt(snap.monthlyBaselineSalesKwd)} د.ك مبيعات (متوسط اليوم التقديري: ${fmtInt(snap.dailyAverageSalesKwd)} د.ك)، بينما تقدير التكاليف وصافي التدفق غير متوفر لحين اكتمال قيود دفتر الأستاذ المرحّلة.`,
      ),
      bodyEn: hasGl
        ? `Active scope (${scopeLabelEn}) uses a calendar-month baseline estimate of ${fmtInt(snap.monthlyBaselineSalesKwd)} KWD sales (est. daily avg: ${fmtInt(snap.dailyAverageSalesKwd)} KWD), ${fmtInt(snap.monthlyBaselineCostsKwd)} KWD costs, and ${fmtInt(snap.monthlyBaselineNetKwd)} KWD net cash (${fmtOne(snap.monthlyBaselineMarginPct)}%).`
        : `Active scope (${scopeLabelEn}) uses a calendar-month POS baseline estimate of ${fmtInt(snap.monthlyBaselineSalesKwd)} KWD sales; cost and profit estimates await complete Odoo GL postings.`,
    },
    {
      id: 'seasonality',
      index: 2,
      titleAr: '2. معادلة التقدير للسيناريو المختار',
      titleEn: '2. Selected Scenario Projection Formula',
      metricBadgeAr: `تقدير: ${fmtInt(activeScenario.projectedSalesKwd)} د.ك`,
      metricBadgeEn: `Est: ${fmtInt(activeScenario.projectedSalesKwd)} KWD`,
      bodyAr: localizeArabicPlanningCopy(
        hasGl
          ? `ضمن أفق ${snap.horizonLabelAr}، يُقدّر ${activeScenario.badgeAr} مبيعات بنحو ${fmtInt(activeScenario.projectedSalesKwd)} د.ك وتكاليف بنحو ${fmtInt(activeScenario.projectedCostsKwd)} د.ك وصافي تدفق تقديري ${activeScenario.projectedNetCashKwd >= 0 ? '+' : ''}${fmtInt(activeScenario.projectedNetCashKwd)} د.ك (${fmtOne(activeScenario.netMarginPct)}%) وفق المعادلة الظاهرة أدناه.`
          : `ضمن أفق ${snap.horizonLabelAr}، يُقدّر ${activeScenario.badgeAr} مبيعات بنحو ${fmtInt(activeScenario.projectedSalesKwd)} د.ك (${fmtInt(activeScenario.projectedOrders)} طلب تقديري)، بينما التكاليف والصافي غير متوفرين بدون قيود دفتر الأستاذ.`,
      ),
      bodyEn: hasGl
        ? `Across ${snap.horizonLabelEn}, ${activeScenario.badgeEn} estimates ${fmtInt(activeScenario.projectedSalesKwd)} KWD sales, ${fmtInt(activeScenario.projectedCostsKwd)} KWD costs, and ${activeScenario.projectedNetCashKwd >= 0 ? '+' : ''}${fmtInt(activeScenario.projectedNetCashKwd)} KWD net cash (${fmtOne(activeScenario.netMarginPct)}%).`
        : `Across ${snap.horizonLabelEn}, ${activeScenario.badgeEn} estimates ${fmtInt(activeScenario.projectedSalesKwd)} KWD sales (${fmtInt(activeScenario.projectedOrders)} est. orders); cost and net cash require posted GL lines.`,
    },
    {
      id: 'execution',
      index: 3,
      titleAr: '3. ضوابط القراءة التنفيذية للتقديرات',
      titleEn: '3. Executive Estimation Safeguards',
      metricBadgeAr: 'تقدير (ليست أرقاماً فعلية)',
      metricBadgeEn: 'Estimate (Not Actuals)',
      bodyAr: localizeArabicPlanningCopy(
        `جميع الأرقام المعروضة في هذه الصفحة هي تقديرات استشرافية مبنية على معادلات رياضية فوق خط الأساس الفعلي من أودو (${snap.periodFromIso} إلى ${snap.periodToIso}) وليست قيوداً فعلية محققة؛ وتظل أوامر التجميد والتعاميم الرسمية معطّلة حتى ربط سقوف الأدمن بمخالفات فعلية في أودو.`,
      ),
      bodyEn: `All figures on this page are mathematical projections derived from the Odoo baseline (${snap.periodFromIso} → ${snap.periodToIso}), not realized accounting actuals; official circulars and freeze actions remain disabled.`,
    },
  ]
}

function cleanParsedBulletLine(line: string, isAr: boolean): string {
  let out = stripStrategicMarkdown(line)
  if (isAr) out = localizeArabicPlanningCopy(out)
  out = out
    .replace(/^\s*[1-3١-٣][.)\-–:]\s*/, '')
    .replace(
      /^(?:تشخيص خط الأساس والهامش الحالي|أثر موسم الشتاء والرواتب في الكويت|خطة التنفيذ الموصى بها وأولويات الفروع|Baseline\s*&\s*Current Margin Diagnosis|Kuwait Winter\s*&\s*Salary Cycle Impact|Recommended Execution\s*&\s*Branch Priorities)\s*[:\-–—]?\s*/i,
      '',
    )
    .trim()
  return out
}

export function resolveStrategicBriefing(
  rawAiText: string | null | undefined,
  snap: PlanningHubSnapshot,
  activeScenario: ScenarioForecastCard | undefined,
  scopeLabelAr: string,
  scopeLabelEn: string,
  isAr: boolean,
): {
  sections: StrategicBriefingSection[]
  fullPlainText: string
  usedFallback: boolean
} {
  const deterministic = buildDeterministicStrategicBriefingSections(
    snap,
    activeScenario,
    scopeLabelAr,
    scopeLabelEn,
  )

  if (deterministic.length === 0) {
    return {
      sections: [],
      fullPlainText: '',
      usedFallback: true,
    }
  }

  const deterministicPlainText = deterministic
    .map((s) => `${isAr ? s.titleAr : s.titleEn}: ${isAr ? s.bodyAr : s.bodyEn}`)
    .join('\n\n')

  if (!rawAiText || typeof rawAiText !== 'string') {
    return {
      sections: deterministic,
      fullPlainText: deterministicPlainText,
      usedFallback: true,
    }
  }

  const stripped = stripStrategicMarkdown(rawAiText)
  const localized = isAr ? localizeArabicPlanningCopy(stripped) : stripped

  if (isBriefingTruncatedOrIncomplete(localized)) {
    return {
      sections: deterministic,
      fullPlainText: deterministicPlainText,
      usedFallback: true,
    }
  }

  const rawChunks = localized
    .split(/\n+(?=\s*[1-3١-٣][.)\-–:])|\n{2,}|\n+/)
    .map((c) => cleanParsedBulletLine(c, isAr))
    .filter((c) => c.length >= 45)

  if (rawChunks.length < 3) {
    return {
      sections: deterministic,
      fullPlainText: deterministicPlainText,
      usedFallback: true,
    }
  }

  const mergedSections: StrategicBriefingSection[] = deterministic.map((base, idx) => {
    const customBody = rawChunks[idx] ?? (isAr ? base.bodyAr : base.bodyEn)
    return {
      ...base,
      bodyAr: isAr ? localizeArabicPlanningCopy(customBody) : base.bodyAr,
      bodyEn: !isAr ? customBody : base.bodyEn,
    }
  })

  const fullPlainText = mergedSections
    .map((s) => `${isAr ? s.titleAr : s.titleEn}: ${isAr ? s.bodyAr : s.bodyEn}`)
    .join('\n\n')

  return {
    sections: mergedSections,
    fullPlainText,
    usedFallback: false,
  }
}

export function buildPlanCircularText(
  phase: StrategicRoadmapPhase,
  scenario: ScenarioForecastCard | undefined,
  isAr: boolean,
  sealId?: string,
): string {
  const stamp = sealId ?? `VF-PLAN-${new Date().getFullYear()}`
  const salesEst = scenario ? scenario.projectedSalesKwd.toLocaleString('en-US') : '0'
  const netEst = scenario ? scenario.projectedNetCashKwd.toLocaleString('en-US') : '0'
  const scenLabelEn = scenario?.badgeEn ?? 'Estimate'
  const scenLabelAr = scenario?.badgeAr ?? 'تقدير'

  if (!isAr) {
    return [
      `DRAFT PLANNING SUMMARY (ESTIMATE) — VENTURE FOODS CO. W.L.L.`,
      `Ref: ${stamp}`,
      `Phase (${phase.phaseCode}): ${phase.titleEn}`,
      `Window: ${phase.startDate} -> ${phase.endDate}`,
      `Owner: ${phase.ownerEn}`,
      `Estimated Cost Cap: ${phase.costCapKwd.toLocaleString('en-US')} KWD | Estimated Return: +${phase.expectedMonthlyGainKwd.toLocaleString('en-US')} KWD/mo`,
      `Target KPI: ${phase.targetKpiEn}`,
      `Linked Scenario (${scenLabelEn}): Est. Sales ${salesEst} KWD | Est. Net Cash ${netEst} KWD`,
    ].join('\n')
  }

  return localizeArabicPlanningCopy(
    [
      `مسودة خطة تقديرية (تقدير) — شركة فنتشر فودز لإدارة المطاعم ذ.م.م`,
      `المرجع: ${stamp}`,
      `المرحلة (${phase.phaseCode}): ${phase.titleAr}`,
      `فترة التنفيذ: ${phase.startDate} ← ${phase.endDate}`,
      `المسؤول: ${phase.ownerAr}`,
      `سقف التكلفة التقديري: ${phase.costCapKwd.toLocaleString('en-US')} د.ك | العائد التقديري: +${phase.expectedMonthlyGainKwd.toLocaleString('en-US')} د.ك/شهر`,
      `المؤشر المستهدف: ${phase.targetKpiAr}`,
      `السيناريو التقديري (${scenLabelAr}): مبيعات مقدّرة ${salesEst} د.ك | صافي مقدّر ${netEst} د.ك`,
    ].join('\n'),
  )
}

function isGlobalWorkspaceSlice(
  candidate: Partial<GlobalFilters> | GlobalWorkspaceSlice | null | undefined,
): candidate is GlobalWorkspaceSlice {
  return Boolean(
    candidate &&
      typeof candidate === 'object' &&
      'filters' in candidate &&
      'odooConnected' in candidate &&
      'salesKwd' in candidate,
  )
}

/**
 * Convenience strategic planning entry point accepting either a computed `GlobalWorkspaceSlice`
 * or partial `GlobalFilters` alongside an optional `OdooLiveSummary`.
 */
export function computeStrategicPlanning(
  filtersOrWorkspace?: Partial<GlobalFilters> | GlobalWorkspaceSlice | null,
  liveSummary?: OdooLiveSummary | null,
  phases: StrategicRoadmapPhase[] = INITIAL_STRATEGIC_PHASES,
  horizonId: ForecastHorizonId = '30d',
  customFrom = '',
  customTo = '',
): PlanningHubSnapshot {
  const workspace = isGlobalWorkspaceSlice(filtersOrWorkspace)
    ? filtersOrWorkspace
    : computeGlobalWorkspace(
        {
          ...DEFAULT_GLOBAL_FILTERS,
          ...(filtersOrWorkspace ?? {}),
        },
        liveSummary ?? undefined,
        '/erp/planning',
      )
  return computePlanningHubSnapshot(workspace, phases, horizonId, customFrom, customTo, liveSummary)
}
