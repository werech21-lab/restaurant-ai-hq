/**
 * Strategic Planning, Multi-Scenario Forecasting & Odoo Compliance Synthesis Engine (`/erp/planning`).
 * Combines live Venture Foods Odoo 17 telemetry (6 brands, 7 active branches, Ardiya Central Kitchen,
 * Dine-In vs TMP 15% / Tgo 25% margins, and Kuwait 20th-28th payday cycles) with Kuwait F&B seasonality.
 */

import { ODOO } from '@/lib/odoo/odoo-dataset'
import type { GlobalWorkspaceSlice } from '@/lib/aether/global-filter-engine'

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

export interface PlanningHubSnapshot {
  horizonId: ForecastHorizonId
  horizonDays: number
  horizonLabelAr: string
  horizonLabelEn: string
  monthlyBaselineSalesKwd: number
  monthlyBaselineCostsKwd: number
  monthlyBaselineNetKwd: number
  ardiyaFoodPct: number
  deliveryFeePct: number
  paydayLiftPct: number
  directChannelSharePct: number
  scenarios: ScenarioForecastCard[]
  signals: KuwaitMarketSignal[]
}

export const STRATEGIC_ROADMAP_STORAGE_KEY = 'vf_strategic_roadmap_v1'

export const FORECAST_HORIZON_OPTIONS: readonly {
  id: ForecastHorizonId
  ar: string
  en: string
  days: number
}[] = [
  { id: '30d', ar: '30 يوم', en: '30 Days', days: 30 },
  { id: '90d', ar: '90 يوم', en: '90 Days', days: 90 },
  { id: '6m', ar: '6 أشهر', en: '6 Months', days: 180 },
  { id: '12m', ar: '12 شهر', en: '12 Months', days: 365 },
  { id: 'custom', ar: 'مخصص 📅', en: 'Custom 📅', days: 45 },
] as const

export const SEEDED_STRATEGIC_PHASES: StrategicRoadmapPhase[] = [
  {
    id: 'plan-phase-tmp-shift',
    phaseCode: 'P1',
    titleAr: 'تحويل التوصيل القريب من Tgo (25%) إلى سائقينا TMP (15%) والطلب المباشر',
    titleEn: 'Shift Nearby Delivery from Tgo (25%) to Own Fleet TMP (15%) & Direct',
    startDate: '2026-11-15',
    endDate: '2026-12-15',
    ownerAr: 'إدارة التشغيل والتوصيل',
    ownerEn: 'Operations & Fleet Team',
    costCapKwd: 250,
    expectedMonthlyGainKwd: 1850,
    targetKpiAr: 'خفض متوسط عمولة المنصات بـ 3.8% ورفع حصة TMP والمباشر',
    targetKpiEn: 'Cut blended platform fee by 3.8% & grow TMP + Direct share',
    odooWatchMetricAr: 'حصة Tgo لا تتجاوز 32% من طلبات التوصيل القريبة',
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
    titleAr: 'خطة موسم الشتاء والكشتات + باقات الرواتب (٢٠–٢٨ الشهر) ومعارض EXB',
    titleEn: 'Kuwait Winter KashtaBoxes + Payday (20th–28th) Bundles & EXB Cap',
    startDate: '2026-12-10',
    endDate: '2027-02-28',
    ownerAr: 'إدارة التسويق والمعارض EXB',
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
      titleAr: String(r.titleAr),
      titleEn: typeof r.titleEn === 'string' && r.titleEn ? r.titleEn : String(r.titleAr),
      startDate:
        typeof r.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.startDate)
          ? r.startDate
          : '2026-11-15',
      endDate:
        typeof r.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.endDate)
          ? r.endDate
          : '2026-12-31',
      ownerAr: typeof r.ownerAr === 'string' && r.ownerAr ? r.ownerAr : 'إدارة التشغيل',
      ownerEn: typeof r.ownerEn === 'string' && r.ownerEn ? r.ownerEn : 'Operations Team',
      costCapKwd: Math.max(0, Number(r.costCapKwd) || 0),
      expectedMonthlyGainKwd: Math.max(0, Number(r.expectedMonthlyGainKwd) || 0),
      targetKpiAr:
        typeof r.targetKpiAr === 'string' && r.targetKpiAr
          ? r.targetKpiAr
          : 'تحقيق المستهدف الربحي الشهري',
      targetKpiEn:
        typeof r.targetKpiEn === 'string' && r.targetKpiEn
          ? r.targetKpiEn
          : 'Hit monthly net profit target',
      odooWatchMetricAr:
        typeof r.odooWatchMetricAr === 'string' && r.odooWatchMetricAr
          ? r.odooWatchMetricAr
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
): PlanningHubSnapshot {
  // Normalize active workspace period into a clean 30-day monthly run-rate
  const activeDays = Math.max(1, workspace.periodDays || 30)
  const monthlyFactor = 30 / activeDays

  const monthlyBaselineSalesKwd = Math.max(1200, workspace.salesKwd * monthlyFactor)
  const monthlyBaselineNetKwd =
    workspace.salesKwd * (workspace.weightedNetPct / 100) * monthlyFactor
  const monthlyBaselineCostsKwd = Math.max(0, monthlyBaselineSalesKwd - monthlyBaselineNetKwd)
  const monthlyBaselineOrders = Math.max(50, Math.round(workspace.orders * monthlyFactor))

  // Resolve horizon days
  let horizonDays = 90
  let horizonLabelAr = 'توقعات 90 يوم (٣ أشهر)'
  let horizonLabelEn = '90-Day Forecast (3 Months)'

  if (horizonId === '30d') {
    horizonDays = 30
    horizonLabelAr = 'توقعات 30 يوم القادمة'
    horizonLabelEn = 'Next 30 Days Forecast'
  } else if (horizonId === '90d') {
    horizonDays = 90
    horizonLabelAr = 'توقعات 90 يوم (موسم الشتاء والرواتب)'
    horizonLabelEn = 'Next 90 Days (Winter & Payday Cycle)'
  } else if (horizonId === '6m') {
    horizonDays = 180
    horizonLabelAr = 'توقعات 6 أشهر (نصف سنوية)'
    horizonLabelEn = '6-Month Strategic Horizon'
  } else if (horizonId === '12m') {
    horizonDays = 365
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
    horizonLabelAr = `فترة مخصصة (${customFrom} ← ${customTo} · ${horizonDays} يوم)`
    horizonLabelEn = `Custom Horizon (${customFrom} → ${customTo} · ${horizonDays}d)`
  }

  const monthsSpan = horizonDays / 30

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

  const ardiyaFoodPct = Math.round(workspace.per10.food10 * 100) / 10
  const deliveryFeePct = Math.round(workspace.per10.delivery10 * 100) / 10

  const groupDirectKwd = ODOO.channels
    .filter((c) => c.id === 'shop' || c.id === 'online-link')
    .reduce((s, c) => s + c.netKwd, 0)
  const directChannelSharePct =
    workspace.filters.channel === 'dine-in' || workspace.filters.channel === 'takeaway-direct'
      ? 100
      : ODOO.totals.restaurantNetKwd > 0
        ? Math.round((groupDirectKwd / ODOO.totals.restaurantNetKwd) * 1000) / 10
        : 28.5

  // Scale roadmap cost cap & upside proportionally to filtered slice share
  const sliceRatio = Math.max(0.08, Math.min(1, workspace.dimensionShare || 1))
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

    const projectedSalesKwd = Math.round(baseSalesHorizon * (1 + salesGrowthPct))
    const variableCostAdjust = 1 + salesGrowthPct * 0.58 - costEfficiencyPct
    const projectedCostsKwd = Math.round(
      Math.max(0, baseCostsHorizon * variableCostAdjust + totalRoadmapCapexKwd),
    )
    const roadmapExtraNet = totalMonthlyRoadmapGainKwd * monthsSpan * roadmapCaptureRatio * 0.35
    const projectedNetCashKwd = Math.round(projectedSalesKwd - projectedCostsKwd + roadmapExtraNet)
    const projectedOrders = Math.max(
      1,
      Math.round(monthlyBaselineOrders * monthsSpan * (1 + salesGrowthPct * 0.85)),
    )
    const netMarginPct =
      projectedSalesKwd > 0
        ? Math.round((projectedNetCashKwd / projectedSalesKwd) * 1000) / 10
        : 0

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
      assumptionsAr,
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
        'تحويل 25% فقط من طلبات Tgo القريبة إلى TMP',
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
        'رفع حصة الصالة والاستلام المباشر (٠٪ عمولة) بـ +6 نقاط مئوية',
        'تحويل كامل النطاق القريب إلى أسطول TMP (15%) وإيقاف إعلانات النقرات الخاسرة',
        'تشغيل بوثات EXB المنتقاة بشرط إيجار ≤ 15% من المبيعات فقط',
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
      titleAr: 'نبض رواتب الكويت (٢٠–٢٨ الشهر)',
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
        'ذروة الطلب المسائي (٧م – ١٢ص) على بوكسات الشيرينج في فرانكس وتشاينا جاردن وكرك كافيتريا؛ جهّز تحضير العارضية مبكراً.',
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
      detailAr: `حصة الصالة والمباشر حالياً ${directChannelSharePct}% بعمولة 0%، مقابل 25% في Tgo و15% فقط في أسطولنا TMP.`,
      detailEn: `Direct 0%-fee share is ${directChannelSharePct}%, vs 25% on Tgo and 15% on our own TMP drivers.`,
      tone: 'amber',
    },
  ]

  return {
    horizonId,
    horizonDays,
    horizonLabelAr,
    horizonLabelEn,
    monthlyBaselineSalesKwd: Math.round(monthlyBaselineSalesKwd),
    monthlyBaselineCostsKwd: Math.round(monthlyBaselineCostsKwd),
    monthlyBaselineNetKwd: Math.round(monthlyBaselineNetKwd),
    ardiyaFoodPct,
    deliveryFeePct,
    paydayLiftPct,
    directChannelSharePct,
    scenarios,
    signals,
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

  return [
    `📢 *تعميم إداري وتنفيذي رسمي — شركة فنتشر فودز لإدارة المطاعم ذ.م.م*`,
    `🔖 رقم الختم التنفيذي: ${stamp}`,
    `📌 الخطة المعتمدة (${phase.phaseCode}): ${phase.titleAr}`,
    `🗓️ فترة التنفيذ: ${phase.startDate} ← ${phase.endDate}`,
    `👤 المسؤول عن التنفيذ: ${phase.ownerAr}`,
    `💰 سقف التكلفة المعتمد: ${phase.costCapKwd.toLocaleString('en-US')} د.ك | العائد الشهري المستهدف: +${phase.expectedMonthlyGainKwd.toLocaleString('en-US')} د.ك`,
    `🎯 مؤشر الأداء المستهدف: ${phase.targetKpiAr}`,
    `🛡️ قاعدة الرقابة الحية في أودو 17: ${phase.odooWatchMetricAr}`,
    `📊 السيناريو المرتبط (${scenario.badgeAr}): المبيعات ${scenario.projectedSalesKwd.toLocaleString('en-US')} د.ك | الصافي ${scenario.projectedNetCashKwd.toLocaleString('en-US')} د.ك`,
    `✅ يُعمم للعمل الفوري في الفروع السبعة ومطبخ العارضية المركزي، وأي تجاوز لسقف التكلفة أو الخصم يُرصد آلياً كمخالفة فورية.`,
  ].join('\n')
}
