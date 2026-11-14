/**
 * Strategic Planning, Multi-Scenario Forecasting & Odoo Compliance Synthesis Engine (`/erp/planning`).
 * Combines live Venture Foods Odoo 17 telemetry (6 brands, 7 active branches, Ardiya Central Kitchen,
 * Dine-In vs 15% internal fleet / 25% external aggregator margins, and Kuwait 20th-28th payday cycles)
 * with Kuwait F&B seasonality.
 */

import { ODOO } from '@/lib/odoo/odoo-dataset'
import {
  computeGlobalWorkspace,
  type GlobalWorkspaceSlice,
} from '@/lib/aether/global-filter-engine'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'

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
  horizonId: ForecastHorizonId
  horizonDays: number
  horizonMonths: number
  horizonLabelAr: string
  horizonLabelEn: string
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
  scenarios: ScenarioForecastCard[]
  signals: KuwaitMarketSignal[]
}

export const STRATEGIC_ROADMAP_STORAGE_KEY = 'vf_strategic_roadmap_v1'
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
    .replace(
      /(و)?(?:بوثات|معارض|المعارض)\s*EXB(?:\s*المتنقلة)?/gi,
      (_match, prefix: string | undefined) => `${prefix ?? ''}بوثات المطبخ المركزي المتنقلة`,
    )
    .replace(/\bEXB\b/gi, 'بوثات المطبخ المركزي المتنقلة')
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
 * Completeness guard: rejects empty, stub, or thinking-starved outputs (such as `## ملخ` -> `ملخ`)
 * shorter than 180 characters or ending in an unfinished fragment.
 */
export function isBriefingTruncatedOrIncomplete(cleanedPlainText: string): boolean {
  const trimmed = cleanedPlainText.trim()
  if (trimmed.length < MIN_VALID_STRATEGIC_BRIEFING_CHARS) return true
  if (/[:،,\-–—(]$/.test(trimmed)) return true
  return false
}

export const SEEDED_STRATEGIC_PHASES: StrategicRoadmapPhase[] = [
  {
    id: 'plan-phase-tmp-shift',
    phaseCode: 'P1',
    titleAr:
      'تحويل التوصيل القريب من طلبات منصات التوصيل الخارجي (25%) إلى أسطول التوصيل الداخلي المباشر (15%) والطلب المباشر',
    titleEn: 'Shift Nearby Delivery from Tgo (25%) to Own Fleet TMP (15%) & Direct',
    startDate: '2026-11-15',
    endDate: '2026-12-15',
    ownerAr: 'إدارة التشغيل والتوصيل',
    ownerEn: 'Operations & Fleet Team',
    costCapKwd: 250,
    expectedMonthlyGainKwd: 1850,
    targetKpiAr:
      'خفض متوسط عمولة المنصات بـ 3.8% ورفع حصة أسطول التوصيل الداخلي المباشر والطلب المباشر',
    targetKpiEn: 'Cut blended platform fee by 3.8% & grow TMP + Direct share',
    odooWatchMetricAr:
      'حصة طلبات منصات التوصيل الخارجي لا تتجاوز 32% من طلبات التوصيل القريبة',
    odooWatchMetricEn: 'Tgo share stays <= 32% on <=4km branch zones',
  },
  {
    id: 'plan-phase-ardiya-cogs',
    phaseCode: 'P2',
    titleAr: 'تثبيت عقود موردي مطبخ العارضية المركزي وضبط الهدر اليومي ≤ 1.8%',
    titleEn: 'Lock Ardiya Central Kitchen Supplier Caps & Daily Prep Waste <= 1.8%',
    startDate: '2026-11-20',
    endDate: '2027-01-20',
    ownerAr: 'المشتريات والشيف التنفيذي — العارضية',
    ownerEn: 'Procurement & Ardiya Head Chef',
    costCapKwd: 180,
    expectedMonthlyGainKwd: 1420,
    targetKpiAr: 'تثبيت تكلفة المواد الأولية ≤ 27.2% وإيقاف أي فاتورة مورد تتجاوز السقف',
    targetKpiEn: 'Hold food COGS <= 27.2% & auto-flag supplier price creep',
    odooWatchMetricAr: 'سقف زيادة سعر الوحدة بفواتير الموردين ≤ +3.0%',
    odooWatchMetricEn: 'Vendor bill unit-cost variance <= +3.0%',
  },
  {
    id: 'plan-phase-shared-kitchens',
    phaseCode: 'P3',
    titleAr: 'تشغيل علامة رديفة (طاحينة + نودل بار) داخل مطابخ السالمية والبروميناد',
    titleEn: 'Activate Co-Kitchen Brands (Tahina + Noodle Bar) Inside Salmiya & Promenade',
    startDate: '2026-12-01',
    endDate: '2027-02-15',
    ownerAr: 'مديرو فروع السالمية والبروميناد',
    ownerEn: 'Salmiya & Promenade Branch Managers',
    costCapKwd: 620,
    expectedMonthlyGainKwd: 2100,
    targetKpiAr: '+45 طلب يومياً بنفس الإيجار ونفس طاقم التحضير الأساسي',
    targetKpiEn: '+45 daily orders at zero incremental rent',
    odooWatchMetricAr: 'التزام التحضير ≤ 14 دقيقة وتقييم المنصات ≥ 4.6★',
    odooWatchMetricEn: 'Prep time <= 14m & app rating >= 4.6★',
  },
  {
    id: 'plan-phase-kashta-payday',
    phaseCode: 'P4',
    titleAr:
      'خطة موسم الشتاء والكشتات + باقات الرواتب (20–28 الشهر) وبوثات المطبخ المركزي المتنقلة',
    titleEn: 'Kuwait Winter KashtaBoxes + Payday (20th–28th) Bundles & EXB Cap',
    startDate: '2026-12-10',
    endDate: '2027-02-28',
    ownerAr: 'إدارة التسويق وبوثات المطبخ المركزي المتنقلة',
    ownerEn: 'Marketing & EXB Events Lead',
    costCapKwd: 450,
    expectedMonthlyGainKwd: 1600,
    targetKpiAr: 'عائد إعلاني ≥ 4.8x وسقف خصومات كاشير ≤ 3.0% وإيجار بوث ≤ 15%',
    targetKpiEn: 'ROAS >= 4.8x, POS discount <= 3.0% & booth rent <= 15%',
    odooWatchMetricAr: 'خصومات نقاط البيع ≤ 3.0% ولا استمرار لحملة خاسرة',
    odooWatchMetricEn: 'POS discounts <= 3.0% & zero negative-ROI ads',
  },
]

export function sanitizeStrategicPhases(raw: unknown): StrategicRoadmapPhase[] {
  if (!Array.isArray(raw) || raw.length === 0) return SEEDED_STRATEGIC_PHASES
  const out: StrategicRoadmapPhase[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Partial<StrategicRoadmapPhase>
    if (!r.id || !r.titleAr) continue
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
          : 'مراقبة الصرف والخصم عبر أودو 17',
      odooWatchMetricEn:
        typeof r.odooWatchMetricEn === 'string' && r.odooWatchMetricEn
          ? r.odooWatchMetricEn
          : 'Monitored live via Odoo 17 POS & bills',
    })
  }
  return out.length > 0 ? out : SEEDED_STRATEGIC_PHASES
}

export function computePlanningHubSnapshot(
  workspace: GlobalWorkspaceSlice,
  phases: StrategicRoadmapPhase[],
  horizonId: ForecastHorizonId,
  customFrom: string,
  customTo: string,
  liveSummary?: OdooLiveSummary | null,
): PlanningHubSnapshot {
  // Always compute Normalized 30-Day Monthly Run-Rate Baseline from the true 30-day `month` slice
  // for the active Brand × Branch × Channel filter so selecting `Period: Today` NEVER shrinks
  // Monthly Baseline (`129,212 KWD` sales / `18,994 KWD` net) to a single day's receipts!
  const hasFullLiveMonthBucket =
    Boolean(liveSummary?.buckets?.month) &&
    Number(liveSummary?.buckets?.month?.days ?? 0) >= 28 &&
    Number(liveSummary?.buckets?.month?.totals?.restaurantNetKwd ?? 0) >= 90_000

  const normalizedMonthWorkspace = computeGlobalWorkspace(
    {
      ...workspace.filters,
      period: 'month',
      kuwaitSlice: 'all',
      lens: 'all',
    },
    hasFullLiveMonthBucket ? liveSummary : undefined,
    '/erp/planning',
  )

  const monthlyBaselineSalesRaw = Math.max(0, normalizedMonthWorkspace.salesKwd)
  const monthlyBaselineNetRaw =
    monthlyBaselineSalesRaw * (normalizedMonthWorkspace.weightedNetPct / 100)
  const monthlyBaselineSalesKwd = Math.round(monthlyBaselineSalesRaw)
  const monthlyBaselineCostsKwd = Math.round(
    Math.max(0, monthlyBaselineSalesRaw - monthlyBaselineNetRaw),
  )
  const monthlyBaselineNetKwd = monthlyBaselineSalesKwd - monthlyBaselineCostsKwd
  const monthlyBaselineMarginPct =
    monthlyBaselineSalesKwd > 0
      ? (monthlyBaselineNetKwd / monthlyBaselineSalesKwd) * 100
      : 0
  const monthlyBaselineOrders = Math.max(1, Math.round(normalizedMonthWorkspace.orders))

  const dailyAverageSalesKwd = Math.round(monthlyBaselineSalesRaw / 30)
  const dailyAverageNetKwd = Math.round(monthlyBaselineNetRaw / 30)
  const activePeriodSalesKwd = Math.round(Math.max(0, workspace.salesKwd))
  const isTodayPeriodActive = workspace.filters.period === 'today'

  // Resolve exact horizon days & monthly multiplier (`30d=1x`, `90d=3x`, `6m=6x`, `12m=12x`, `custom=days/30`)
  let horizonDays = 90
  let monthsSpan = 3
  let horizonLabelAr = 'توقعات 90 يوم (موسم الشتاء والرواتب)'
  let horizonLabelEn = 'Next 90 Days (Winter & Payday Cycle)'

  if (horizonId === '30d') {
    horizonDays = 30
    monthsSpan = 1
    horizonLabelAr = 'توقعات 30 يوم القادمة (1× شهر)'
    horizonLabelEn = 'Next 30 Days Forecast (1x Month)'
  } else if (horizonId === '90d') {
    horizonDays = 90
    monthsSpan = 3
    horizonLabelAr = 'توقعات 90 يوم (موسم الشتاء والرواتب)'
    horizonLabelEn = 'Next 90 Days (Winter & Payday Cycle)'
  } else if (horizonId === '6m') {
    horizonDays = 180
    monthsSpan = 6
    horizonLabelAr = 'توقعات 6 أشهر (نصف سنوية)'
    horizonLabelEn = '6-Month Strategic Horizon'
  } else if (horizonId === '12m') {
    horizonDays = 365
    monthsSpan = 12
    horizonLabelAr = 'توقعات 12 شهر (خطة سنوية كاملة)'
    horizonLabelEn = '12-Month Full-Year Plan'
  } else {
    const startMs = new Date(`${customFrom}T00:00:00Z`).getTime()
    const endMs = new Date(`${customTo}T00:00:00Z`).getTime()
    const diff =
      Number.isFinite(startMs) && Number.isFinite(endMs)
        ? Math.round((Math.max(startMs, endMs) - Math.min(startMs, endMs)) / 86_400_000) + 1
        : 45
    horizonDays = Math.max(1, Math.min(730, diff))
    monthsSpan = horizonDays / 30
    horizonLabelAr = `فترة مخصصة (${customFrom} ← ${customTo} · ${horizonDays} يوم)`
    horizonLabelEn = `Custom Horizon (${customFrom} → ${customTo} · ${horizonDays}d)`
  }

  // Real Odoo payday vs mid-month lift from daily POS records
  const fullDays = (ODOO.timeProfile?.daily ?? []).filter((d) => d.orders >= 150)
  const paydayDays = fullDays.filter((d) => {
    const dom = Number(d.day.slice(8, 10))
    return dom >= 20 && dom <= 28
  })
  const midDays = fullDays.filter((d) => {
    const dom = Number(d.day.slice(8, 10))
    return dom >= 10 && dom <= 19
  })
  const avgPayday =
    paydayDays.length > 0
      ? paydayDays.reduce((s, d) => s + d.netKwd, 0) / paydayDays.length
      : 4720
  const avgMid =
    midDays.length > 0
      ? midDays.reduce((s, d) => s + d.netKwd, 0) / midDays.length
      : 3980
  const paydayLiftPct =
    avgMid > 0 ? Math.round(((avgPayday - avgMid) / avgMid) * 1000) / 10 : 18.4

  const ardiyaFoodPct = Math.round(normalizedMonthWorkspace.per10.food10 * 100) / 10
  const deliveryFeePct = Math.round(normalizedMonthWorkspace.per10.delivery10 * 100) / 10

  const groupDirectKwd = ODOO.channels
    .filter((c) => c.id === 'shop' || c.id === 'online-link')
    .reduce((s, c) => s + c.netKwd, 0)
  const directChannelSharePct =
    normalizedMonthWorkspace.filters.channel === 'dine-in' ||
    normalizedMonthWorkspace.filters.channel === 'takeaway-direct'
      ? 100
      : ODOO.totals.restaurantNetKwd > 0
        ? Math.round((groupDirectKwd / ODOO.totals.restaurantNetKwd) * 1000) / 10
        : 28.5

  // Scale roadmap cost cap & upside proportionally to the 30-day filtered slice share
  const isAllScope =
    normalizedMonthWorkspace.filters.brand === 'all' &&
    normalizedMonthWorkspace.filters.branch === 'all' &&
    normalizedMonthWorkspace.filters.channel === 'all'
  const sliceRatio = isAllScope
    ? 1
    : Math.max(0.05, Math.min(1, normalizedMonthWorkspace.dimensionShare || 0.1))

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
    const projectedCostsKwd = Math.round(
      Math.max(0, baseCostsHorizon * variableCostAdjust + capexForHorizon - roadmapCostSavingKwd),
    )
    // Strict CFO Reconciliation Identity: Net Cash === Math.round(Projected Sales) - Math.round(Total Costs)
    const projectedNetCashKwd = projectedSalesKwd - projectedCostsKwd
    const projectedOrders = Math.max(
      1,
      Math.round(monthlyBaselineOrders * monthsSpan * (1 + salesGrowthPct * 0.85)),
    )
    // Strict Margin Identity: Net Margin % === (Displayed Net Cash / Displayed Projected Sales) * 100
    const netMarginPct =
      projectedSalesKwd > 0 ? (projectedNetCashKwd / projectedSalesKwd) * 100 : 0

    const dailyIncrementalGain = Math.max(
      8,
      (totalMonthlyRoadmapGainKwd * roadmapCaptureRatio) / 30,
    )
    const paybackDays =
      totalRoadmapCapexKwd <= 0
        ? 0
        : Math.max(5, Math.min(180, Math.round(totalRoadmapCapexKwd / dailyIncrementalGain)))

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
      paybackLabelAr: paybackDays === 0 ? 'فوري (بدون رأسمال)' : `استرداد خلال ${paybackDays} يوم`,
      paybackLabelEn: paybackDays === 0 ? 'Immediate (Zero Capex)' : `${paybackDays}d Payback`,
      assumptionsAr: assumptionsAr.map(localizeArabicPlanningCopy),
      assumptionsEn,
    }
  }

  const scenarios: ScenarioForecastCard[] = [
    buildScenario(
      'conservative',
      'السيناريو المتحفظ 🛡️',
      'Conservative 🛡️',
      'ثبات السوق مع ضبط الخصومات والهدر فقط',
      'Flat market demand + strict cost & promo discipline',
      0.035,
      0.018,
      0.55,
      [
        'سقف خصومات الكاشير والتطبيقات عند ≤ 3.0%',
        'تحويل 25% فقط من طلبات منصات التوصيل الخارجي القريبة إلى أسطول التوصيل الداخلي المباشر',
        'تثبيت أسعار موردي العارضية بدون توسع تشغيلي إضافي',
      ],
      [
        'Cap POS & app promos strictly at <= 3.0%',
        'Convert 25% of nearby Tgo orders to own TMP fleet',
        'Hold Ardiya supplier unit costs flat with zero new capex',
      ],
    ),
    buildScenario(
      'realistic',
      'السيناريو الواقعي (الموصى به) ⭐',
      'Realistic (Target) ⭐',
      'تنفيذ المراحل الأربع + استغلال الرواتب وموسم الشتاء',
      'Execute 4 roadmap phases + Kuwait winter & payday pulse',
      0.095,
      0.034,
      0.85,
      [
        `استغلال قفزة الرواتب (+${paydayLiftPct}%) بباقات عائلية بدون حرق خصم`,
        'تشغيل طاحينة ونودل بار داخل مطابخ السالمية والبروميناد',
        'خفض هدر مطبخ العارضية إلى ≤ 1.8% وتثبيت عقود الدواجن والروبيان',
      ],
      [
        `Capture +${paydayLiftPct}% Kuwait payday surge via high-margin bundles`,
        'Run Tahina & Noodle Bar inside Salmiya & Promenade kitchens',
        'Cut Ardiya prep waste to <= 1.8% & lock protein supplier contracts',
      ],
    ),
    buildScenario(
      'ambitious',
      'السيناريو الطموح 🚀',
      'Ambitious 🚀',
      'نمو هجومي في الصالة والاستلام المباشر وبوثات الشتاء الرابحة',
      'Full direct-channel shift + peak winter Kashta & EXB booths',
      0.165,
      0.048,
      1.15,
      [
        'رفع حصة الصالة والاستلام المباشر (0% عمولة) بـ +6 نقاط مئوية',
        'تحويل كامل النطاق القريب إلى أسطول التوصيل الداخلي المباشر (15%) وإيقاف إعلانات النقرات الخاسرة',
        'تشغيل بوثات المطبخ المركزي المتنقلة المنتقاة بشرط إيجار ≤ 15% من المبيعات فقط',
      ],
      [
        'Grow zero-commission Dine-In & Direct Pickup share by +6 pts',
        'Full nearby TMP (15%) fleet routing + zero losing click ads',
        'Deploy selective winter EXB booths strictly under <= 15% rent cap',
      ],
    ),
  ]

  const signals: KuwaitMarketSignal[] = [
    {
      id: 'sig-payday',
      titleAr: 'نبض رواتب الكويت (20–28 الشهر)',
      titleEn: 'Kuwait Payday Surge (20th–28th)',
      impactBadgeAr: `+${paydayLiftPct}% مبيعات يومية`,
      impactBadgeEn: `+${paydayLiftPct}% Daily Lift`,
      detailAr:
        'إيصالات أودو تثبت قفزة متوسط السلة والطلبات العائلية في أسبوع الرواتب؛ نرفع الباقات العائلية ونمنع الخصم المفتوح.',
      detailEn:
        'Odoo POS confirms strong basket expansion during Kuwait salary week; push family platters without discounting.',
      tone: 'emerald',
    },
    {
      id: 'sig-winter-kashta',
      titleAr: 'موسم الشتاء والمخيمات والكشتات (نوفمبر – فبراير)',
      titleEn: 'Kuwait Winter & Kashta Season (Nov–Feb)',
      impactBadgeAr: '+12% إلى +16% مساءً',
      impactBadgeEn: '+12% to +16% Evening',
      detailAr:
        'ذروة الطلب المسائي (7م – 12ص) على بوكسات المشاركة العائلية في فرانكس وتشاينا جاردن وكرك كافيتريا؛ جهّز تحضير العارضية مبكراً.',
      detailEn:
        'Peak evening sharing-box demand across Frank’s, China Garden & Karak; pre-stage Ardiya evening dispatch.',
      tone: 'sky',
    },
    {
      id: 'sig-channel-spread',
      titleAr: 'فجوة عمولة التوصيل مقابل الصالة وأسطولنا',
      titleEn: 'Aggregator Fee vs Own Fleet & Dine-In',
      impactBadgeAr: `${deliveryFeePct}% اقتطاع توصيل`,
      impactBadgeEn: `${deliveryFeePct}% Delivery Cut`,
      detailAr: localizeArabicPlanningCopy(
        `حصة الصالة والمباشر حالياً ${directChannelSharePct}% بعمولة 0%، مقابل 25% في طلبات منصات التوصيل الخارجي و15% فقط في أسطول التوصيل الداخلي المباشر.`,
      ),
      detailEn: `Direct 0%-fee share is ${directChannelSharePct}%, vs 25% on Tgo and 15% on our own TMP drivers.`,
      tone: 'amber',
    },
  ]

  return {
    horizonId,
    horizonDays,
    horizonMonths: monthsSpan,
    horizonLabelAr,
    horizonLabelEn,
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
    scenarios,
    signals,
  }
}

/**
 * Builds the rich, deterministic 3-section Executive Strategic Briefing interpolated with live active numbers.
 */
export function buildDeterministicStrategicBriefingSections(
  snap: PlanningHubSnapshot,
  activeScenario: ScenarioForecastCard,
  scopeLabelAr: string,
  scopeLabelEn: string,
): StrategicBriefingSection[] {
  const cleanScopeAr = localizeArabicPlanningCopy(scopeLabelAr)
  return [
    {
      id: 'baseline',
      index: 1,
      titleAr: '1. تشخيص خط الأساس والهامش الحالي',
      titleEn: '1. Baseline & Current Margin Diagnosis',
      metricBadgeAr: `${fmtInt(snap.monthlyBaselineSalesKwd)} د.ك / شهر`,
      metricBadgeEn: `${fmtInt(snap.monthlyBaselineSalesKwd)} KWD / mo`,
      bodyAr: localizeArabicPlanningCopy(
        `يرتكز النطاق النشط (${cleanScopeAr}) على خط الأساس الشهري المعتمد لـ 30 يوماً بواقع ${fmtInt(snap.monthlyBaselineSalesKwd)} د.ك مبيعات (متوسط اليوم: ${fmtInt(snap.dailyAverageSalesKwd)} د.ك) وتكاليف ${fmtInt(snap.monthlyBaselineCostsKwd)} د.ك بصافي كاش فعلي ${fmtInt(snap.monthlyBaselineNetKwd)} د.ك (${fmtOne(snap.monthlyBaselineMarginPct)}%). تشكل مواد مطبخ العارضية ${fmtOne(snap.ardiyaFoodPct)}% وعمولات التوصيل ${fmtOne(snap.deliveryFeePct)}% مقابل ${fmtOne(snap.directChannelSharePct)}% للقنوات المباشرة الصفرية.`,
      ),
      bodyEn: `Active scope (${scopeLabelEn}) runs on a normalized 30-day monthly baseline of ${fmtInt(snap.monthlyBaselineSalesKwd)} KWD sales (daily average: ${fmtInt(snap.dailyAverageSalesKwd)} KWD) and ${fmtInt(snap.monthlyBaselineCostsKwd)} KWD costs, yielding ${fmtInt(snap.monthlyBaselineNetKwd)} KWD net pocket cash (${fmtOne(snap.monthlyBaselineMarginPct)}%). Ardiya food COGS is ${fmtOne(snap.ardiyaFoodPct)}% and delivery cut is ${fmtOne(snap.deliveryFeePct)}%, backed by a ${fmtOne(snap.directChannelSharePct)}% zero-fee direct share.`,
    },
    {
      id: 'seasonality',
      index: 2,
      titleAr: '2. أثر موسم الشتاء والرواتب في الكويت',
      titleEn: '2. Kuwait Winter & Salary Cycle Impact',
      metricBadgeAr: `+${fmtOne(snap.paydayLiftPct)}% ذروة الرواتب`,
      metricBadgeEn: `+${fmtOne(snap.paydayLiftPct)}% Payday Lift`,
      bodyAr: localizeArabicPlanningCopy(
        `ضمن أفق ${snap.horizonLabelAr}، تضيف دورة الرواتب في الكويت (20–28 الشهر) قفزة +${fmtOne(snap.paydayLiftPct)}% في المبيعات اليومية بالتزامن مع ذروة أمسيات الشتاء والكشتات (+12% إلى +16% مساءً). وعند اعتماد ${activeScenario.badgeAr} تصل المبيعات المتوقعة إلى ${fmtInt(activeScenario.projectedSalesKwd)} د.ك مقابل تكاليف ${fmtInt(activeScenario.projectedCostsKwd)} د.ك بصافي كاش +${fmtInt(activeScenario.projectedNetCashKwd)} د.ك وهامش ${fmtOne(activeScenario.netMarginPct)}%.`,
      ),
      bodyEn: `Across ${snap.horizonLabelEn}, Kuwait's 20th–28th salary cycle drives a +${fmtOne(snap.paydayLiftPct)}% daily sales surge alongside peak Nov–Feb winter evening Kashta demand (+12% to +16%). Adopting ${activeScenario.badgeEn} scales projected sales to ${fmtInt(activeScenario.projectedSalesKwd)} KWD vs ${fmtInt(activeScenario.projectedCostsKwd)} KWD costs, generating +${fmtInt(activeScenario.projectedNetCashKwd)} KWD net cash at a ${fmtOne(activeScenario.netMarginPct)}% margin.`,
    },
    {
      id: 'execution',
      index: 3,
      titleAr: '3. خطة التنفيذ الموصى بها وأولويات الفروع',
      titleEn: '3. Recommended Execution & Branch Priorities',
      metricBadgeAr: activeScenario.paybackLabelAr,
      metricBadgeEn: activeScenario.paybackLabelEn,
      bodyAr: localizeArabicPlanningCopy(
        `يُوصى بتحويل الطلبات القريبة من طلبات منصات التوصيل الخارجي (25%) إلى أسطول التوصيل الداخلي المباشر (15%) والاستلام المباشر، مع تثبيت هدر مطبخ العارضية عند ≤ 1.8% وسقف خصومات الكاشير ≤ 3.0%، وتشغيل طاحينة وذا نودل بار داخل مطابخ السالمية والبروميناد بدون إيجار إضافي، وقصر بوثات المطبخ المركزي المتنقلة على المواقع التي لا يتجاوز إيجارها 15% من المبيعات.`,
      ),
      bodyEn: `Shift <=4km delivery volume from 25%-fee external aggregators to the 15% direct internal fleet and pickup, hold Ardiya prep waste <= 1.8% and POS promos <= 3.0%, run Tahina & The Noodle Bar inside Salmiya and Promenade kitchens at zero extra rent, and restrict mobile central-kitchen booths to venues with rent <= 15% of sales (${activeScenario.paybackLabelEn}).`,
    },
  ]
}

function cleanParsedBulletLine(line: string, isAr: boolean): string {
  let out = stripStrategicMarkdown(line)
  if (isAr) out = localizeArabicPlanningCopy(out)
  // Strip leading numbering or echoed section titles so card body never repeats card heading
  out = out
    .replace(/^\s*[1-3١-٣][.)\-–:]\s*/, '')
    .replace(
      /^(?:تشخيص خط الأساس والهامش الحالي|أثر موسم الشتاء والرواتب في الكويت|خطة التنفيذ الموصى بها وأولويات الفروع|Baseline\s*&\s*Current Margin Diagnosis|Kuwait Winter\s*&\s*Salary Cycle Impact|Recommended Execution\s*&\s*Branch Priorities)\s*[:\-–—]?\s*/i,
      '',
    )
    .trim()
  return out
}

/**
 * Resolves AI forecast text through strict Markdown stripping, Arabic acronym localization,
 * and the >= 180-character completeness guard — always returning 3 complete executive sections.
 */
export function resolveStrategicBriefing(
  rawAiText: string | null | undefined,
  snap: PlanningHubSnapshot,
  activeScenario: ScenarioForecastCard,
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

  // Split into numbered sections or non-empty lines
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
  scenario: ScenarioForecastCard,
  isAr: boolean,
  sealId?: string,
): string {
  const stamp = sealId ?? `VF-PLAN-${new Date().getFullYear()}`
  if (!isAr) {
    return [
      `📢 *OFFICIAL EXECUTIVE CIRCULAR — VENTURE FOODS CO. W.L.L.*`,
      `🔖 Seal ID: ${stamp}`,
      `📌 Approved Plan (${phase.phaseCode}): ${phase.titleEn}`,
      `🗓️ Execution Window: ${phase.startDate} → ${phase.endDate}`,
      `👤 Responsible Owner: ${phase.ownerEn}`,
      `💰 Approved Cost Cap: ${phase.costCapKwd.toLocaleString('en-US')} KWD | Expected Return: +${phase.expectedMonthlyGainKwd.toLocaleString('en-US')} KWD/mo`,
      `🎯 Target KPI: ${phase.targetKpiEn}`,
      `🛡️ Live Odoo 17 Watchdog Rule: ${phase.odooWatchMetricEn}`,
      `📊 Linked Forecast Scenario (${scenario.badgeEn}): Sales ${scenario.projectedSalesKwd.toLocaleString('en-US')} KWD | Net Cash ${scenario.projectedNetCashKwd.toLocaleString('en-US')} KWD`,
      `✅ Mandatory across all 7 active branches + Ardiya Central Kitchen. Any deviation triggers an immediate Odoo Compliance Alert.`,
    ].join('\n')
  }

  return localizeArabicPlanningCopy(
    [
      `📢 تعميم إداري وتنفيذي رسمي — شركة فنتشر فودز لإدارة المطاعم ذ.م.م`,
      `🔖 رقم الختم التنفيذي: ${stamp}`,
      `📌 الخطة المعتمدة (${phase.phaseCode}): ${phase.titleAr}`,
      `🗓️ فترة التنفيذ: ${phase.startDate} ← ${phase.endDate}`,
      `👤 المسؤول عن التنفيذ: ${phase.ownerAr}`,
      `💰 سقف التكلفة المعتمد: ${phase.costCapKwd.toLocaleString('en-US')} د.ك | العائد الشهري المستهدف: +${phase.expectedMonthlyGainKwd.toLocaleString('en-US')} د.ك`,
      `🎯 مؤشر الأداء المستهدف: ${phase.targetKpiAr}`,
      `🛡️ قاعدة الرقابة الحية في أودو 17: ${phase.odooWatchMetricAr}`,
      `📊 السيناريو المرتبط (${scenario.badgeAr}): المبيعات ${scenario.projectedSalesKwd.toLocaleString('en-US')} د.ك | الصافي ${scenario.projectedNetCashKwd.toLocaleString('en-US')} د.ك`,
      `✅ يُعمم للعمل الفوري في الفروع السبعة ومطبخ العارضية المركزي، وأي تجاوز لسقف التكلفة أو الخصم يُرصد آلياً كمخالفة فورية.`,
    ].join('\n'),
  )
}
