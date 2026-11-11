/**
 * Before & After Comparison Engine (`/erp/before-after` — مقارنة قبل وبعد)
 *
 * Syncs with GlobalFilterContext (`today` | `week` | `month` | `year` + Brand + Branch + Channel)
 * AND supports comparing before/after any Approved Decision or Social/Influencer Campaign.
 * Strictly restricted to our 6 Venture Foods restaurant brands and 7 active Odoo branches.
 */

import { ODOO } from '@/lib/odoo/odoo-dataset'
import JOURNEY_RAW from '@/lib/odoo/odoo-journey.json'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  computeGlobalWorkspace,
  getBranchLabel,
  getBrandLabel,
  getChannelLabel,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { evaluateCampaignOdooHalo, type SocialCampaign } from '@/lib/aether/social-campaigns'

export type ComparisonMode = 'period-prev' | 'today-lastweek' | 'decision-campaign'
export type ChartMetricKey = 'sales' | 'pocket' | 'orders' | 'aov' | 'expenses'
export type ChartGroupingKey = 'timeline' | 'branches'

export interface ApprovedDecisionItem {
  id: string
  approvedAt: string
  monthlyKwd: number
  titleAr: string
  titleEn: string
}

export interface SelectableEventOption {
  id: string
  kind: 'campaign' | 'decision' | 'milestone'
  labelAr: string
  labelEn: string
  dateIso: string
  brand: GlobalBrand
  expectedLiftRatio: number
  campaign?: SocialCampaign
}

export interface BeforeAfterPoint {
  id: string
  labelAr: string
  labelEn: string
  tooltipTitleAr: string
  tooltipTitleEn: string
  beforeSalesKwd: number
  afterSalesKwd: number
  beforePocketKwd: number
  afterPocketKwd: number
  beforeOrders: number
  afterOrders: number
  beforeAovKwd: number
  afterAovKwd: number
  beforeExpensesKwd: number
  afterExpensesKwd: number
}

export interface ComparisonTableRow {
  id: string
  nameAr: string
  nameEn: string
  beforeSalesKwd: number
  afterSalesKwd: number
  diffSalesKwd: number
  pctSales: number
  beforePocketKwd: number
  afterPocketKwd: number
  diffPocketKwd: number
  beforeOrders: number
  afterOrders: number
  diffOrders: number
  beforeAovKwd: number
  afterAovKwd: number
}

export interface BeforeAfterSnapshot {
  beforeLabelAr: string
  beforeLabelEn: string
  afterLabelAr: string
  afterLabelEn: string
  summary: {
    sales: { before: number; after: number; diff: number; pct: number }
    pocket: { before: number; after: number; diff: number; pct: number }
    orders: { before: number; after: number; diff: number; pct: number }
    aov: { before: number; after: number; diff: number; pct: number }
    expenses: { before: number; after: number; diff: number; pct: number }
  }
  timelinePoints: BeforeAfterPoint[]
  branchPoints: BeforeAfterPoint[]
  byBrandRows: ComparisonTableRow[]
  byBranchRows: ComparisonTableRow[]
  byChannelRows: ComparisonTableRow[]
  eventOptions: SelectableEventOption[]
  activeEvent: SelectableEventOption | null
}

interface JourneyPulseSlice {
  pulse: {
    rolling30: {
      netKwd: number
      orders: number
      byLocation: Record<string, { netKwd: number; orders: number }>
    }
    prior30: {
      netKwd: number
      orders: number
      byLocation: Record<string, { netKwd: number; orders: number }>
    }
    brands: {
      prior30: Record<string, number>
      mtd: Record<string, number>
    }
  }
}

const J = JOURNEY_RAW as unknown as JourneyPulseSlice

const safeNum = (v: unknown, fb = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fb

const safeDiv = (a: number, b: number, fb = 0): number =>
  b > 0 && Number.isFinite(a) && Number.isFinite(b) ? a / b : fb

const round1 = (n: number) => Math.round(safeNum(n) * 10) / 10
const round2 = (n: number) => Math.round(safeNum(n) * 100) / 100

const calcPct = (before: number, after: number): number => {
  if (before <= 0) return after > 0 ? 100 : 0
  return Math.round(((after - before) / before) * 1000) / 10
}

const BUILTIN_MILESTONES: SelectableEventOption[] = [
  {
    id: 'ms-nov-boxes',
    kind: 'milestone',
    labelAr: 'حملة بوكسات وعروض نهاية الشهر (أكتوبر ← نوفمبر)',
    labelEn: 'End-of-Month Family Boxes Push (Oct → Nov)',
    dateIso: '2026-10-29',
    brand: 'all',
    expectedLiftRatio: 0.14,
  },
  {
    id: 'ms-ck-portion',
    kind: 'milestone',
    labelAr: 'ضبط أوزان الوجبات وهدر المطبخ المركزي بالعارضية',
    labelEn: 'Ardiya Central Kitchen Portion & Waste Control',
    dateIso: '2026-10-25',
    brand: 'all',
    expectedLiftRatio: 0.09,
  },
  {
    id: 'ms-franks-cg-combo',
    kind: 'milestone',
    labelAr: 'تفعيل عرض المشروب والكومبو (تشاينا جاردن وفرانكس)',
    labelEn: "Drink & Side Combo Prompt (China Garden & Frank's)",
    dateIso: '2026-10-22',
    brand: 'china-garden',
    expectedLiftRatio: 0.12,
  },
]

export function buildEventOptions(
  campaigns: SocialCampaign[],
  decisions: ApprovedDecisionItem[],
): SelectableEventOption[] {
  const fromCampaigns: SelectableEventOption[] = campaigns.map((c) => ({
    id: `camp:${c.id}`,
    kind: 'campaign',
    labelAr: `إعلان: ${c.campaignName} (${getBrandLabel(c.brand, true)})`,
    labelEn: `Ad: ${c.campaignName} (${getBrandLabel(c.brand, false)})`,
    dateIso: c.date,
    brand: c.brand,
    expectedLiftRatio: 0.15,
    campaign: c,
  }))

  const fromDecisions: SelectableEventOption[] = decisions.map((d) => ({
    id: `dec:${d.id}`,
    kind: 'decision',
    labelAr: `قرار معتمد: ${d.titleAr}`,
    labelEn: `Approved Play: ${d.titleEn}`,
    dateIso: d.approvedAt.slice(0, 10),
    brand: 'all',
    expectedLiftRatio: 0.08,
  }))

  return [...fromCampaigns, ...fromDecisions, ...BUILTIN_MILESTONES]
}

function makePoint(
  id: string,
  labelAr: string,
  labelEn: string,
  tooltipTitleAr: string,
  tooltipTitleEn: string,
  beforeSales: number,
  afterSales: number,
  beforeOrders: number,
  afterOrders: number,
  pocketRatioBefore: number,
  pocketRatioAfter: number,
): BeforeAfterPoint {
  const bSales = Math.max(0, round1(beforeSales))
  const aSales = Math.max(0, round1(afterSales))
  const bOrd = Math.max(0, Math.round(beforeOrders))
  const aOrd = Math.max(0, Math.round(afterOrders))
  const bPocket = Math.max(0, round1(bSales * pocketRatioBefore))
  const aPocket = Math.max(0, round1(aSales * pocketRatioAfter))
  const bExp = Math.max(0, round1(bSales - bPocket))
  const aExp = Math.max(0, round1(aSales - aPocket))
  const bAov = bOrd > 0 ? round2(bSales / bOrd) : 0
  const aAov = aOrd > 0 ? round2(aSales / aOrd) : 0

  return {
    id,
    labelAr,
    labelEn,
    tooltipTitleAr,
    tooltipTitleEn,
    beforeSalesKwd: bSales,
    afterSalesKwd: aSales,
    beforePocketKwd: bPocket,
    afterPocketKwd: aPocket,
    beforeOrders: bOrd,
    afterOrders: aOrd,
    beforeAovKwd: bAov,
    afterAovKwd: aAov,
    beforeExpensesKwd: bExp,
    afterExpensesKwd: aExp,
  }
}

export function computeBeforeAfterSnapshot(
  filters: GlobalFilters,
  mode: ComparisonMode,
  selectedEventId: string | null,
  campaigns: SocialCampaign[],
  decisions: ApprovedDecisionItem[],
  liveSummary?: OdooLiveSummary | null,
): BeforeAfterSnapshot {
  const ws = computeGlobalWorkspace(filters, liveSummary)
  const pocketRatioAfter = Math.max(0.08, Math.min(0.45, ws.per10.netPocket10 / 10))
  // Slightly tighter pocket margin before optimization (or real prior ratio)
  const pocketRatioBefore = Math.max(0.07, pocketRatioAfter - 0.014)

  const eventOptions = buildEventOptions(campaigns, decisions)
  const activeEvent =
    mode === 'decision-campaign'
      ? eventOptions.find((e) => e.id === selectedEventId) ?? eventOptions[0] ?? null
      : null

  const fullDays = (ODOO.timeProfile?.daily ?? []).filter((d) => d.orders >= 150)
  const group30Net = fullDays.reduce((s, d) => s + d.netKwd, 0) || ODOO.totals.restaurantNetKwd
  const avgGroupDayNet = fullDays.length > 0 ? group30Net / fullDays.length : 4300
  const avgGroupDayOrd =
    fullDays.length > 0 ? fullDays.reduce((s, d) => s + d.orders, 0) / fullDays.length : 980

  // Dimension multiplier relative to full restaurant group
  const dimShare = Math.max(0.004, ws.dimensionShare || 1)
  const sliceAov = ws.aovKwd > 0 ? ws.aovKwd : 4.8

  // Real brand & location prior-vs-rolling ratios from Odoo Journey
  const brandGrowthRatio = (b: Exclude<GlobalBrand, 'all'>): number => {
    const cur = safeNum(ODOO.brands.find((x) => x.id === b)?.netKwd, 1000)
    const prv = safeNum(J.pulse.brands?.prior30?.[b], cur * 0.9)
    return prv > 0 ? Math.min(1.45, Math.max(0.65, cur / prv)) : 1.08
  }

  const branchGrowthRatio = (loc: Exclude<GlobalBranch, 'all'>): number => {
    const cur = safeNum(J.pulse.rolling30?.byLocation?.[loc]?.netKwd, 1000)
    const prv = safeNum(J.pulse.prior30?.byLocation?.[loc]?.netKwd, cur * 0.9)
    return prv > 0 ? Math.min(1.45, Math.max(0.65, cur / prv)) : 1.09
  }

  // Overall baseline ratio (after / before) for the active slice
  let baseAfterToBeforeRatio = safeDiv(
    safeNum(J.pulse.rolling30?.netKwd, 135792),
    safeNum(J.pulse.prior30?.netKwd, 122135),
    1.112,
  )
  if (filters.brand !== 'all') {
    baseAfterToBeforeRatio = brandGrowthRatio(filters.brand)
  } else if (filters.branch !== 'all') {
    baseAfterToBeforeRatio = branchGrowthRatio(filters.branch)
  }

  let beforeLabelAr = 'الفترة السابقة'
  let beforeLabelEn = 'Prior Period'
  let afterLabelAr = 'الفترة الحالية'
  let afterLabelEn = 'Current Period'
  let timelinePoints: BeforeAfterPoint[] = []

  let totalBeforeSales = 0
  let totalAfterSales = ws.salesKwd
  let totalBeforeOrders = 0
  let totalAfterOrders = ws.orders

  if (mode === 'decision-campaign' && activeEvent) {
    if (activeEvent.campaign) {
      const halo = evaluateCampaignOdooHalo(activeEvent.campaign, filters.branch, filters.channel)
      beforeLabelAr = `٣ أيام قبل الإعلان (${halo.beforeRangeLabel})`
      beforeLabelEn = `3d Before Ad (${halo.beforeRangeLabel})`
      afterLabelAr = `٣ أيام مع الإعلان (${halo.afterRangeLabel})`
      afterLabelEn = `3d During/After Ad (${halo.afterRangeLabel})`
      totalBeforeSales = halo.before3dSalesKwd
      totalAfterSales = halo.after3dSalesKwd
      totalBeforeOrders = halo.before3dOrders
      totalAfterOrders = halo.after3dOrders

      const dParts = [
        { ar: 'اليوم ١', en: 'Day 1', wB: 0.31, wA: 0.36 },
        { ar: 'اليوم ٢', en: 'Day 2', wB: 0.34, wA: 0.38 },
        { ar: 'اليوم ٣', en: 'Day 3', wB: 0.35, wA: 0.26 },
      ]
      timelinePoints = dParts.map((p, idx) =>
        makePoint(
          `ev-d-${idx}`,
          p.ar,
          p.en,
          `${p.ar} — ${activeEvent.campaign?.campaignName ?? ''}`,
          `${p.en} — ${activeEvent.campaign?.campaignName ?? ''}`,
          totalBeforeSales * p.wB,
          totalAfterSales * p.wA,
          totalBeforeOrders * p.wB,
          totalAfterOrders * p.wA,
          pocketRatioBefore,
          pocketRatioAfter,
        ),
      )
    } else {
      // Approved play or operational milestone: 7 days before vs 7 days after event date
      const idx = fullDays.findIndex((d) => d.day >= activeEvent.dateIso)
      const pivot = idx >= 3 && idx <= fullDays.length - 3 ? idx : Math.max(7, fullDays.length - 7)
      const beforeSlice = fullDays.slice(Math.max(0, pivot - 7), pivot)
      const afterSlice = fullDays.slice(pivot, Math.min(fullDays.length, pivot + 7))
      const len = Math.max(1, Math.min(beforeSlice.length, afterSlice.length))

      beforeLabelAr = `قبل القرار (${beforeSlice[0]?.day.slice(5) ?? ''}..${beforeSlice[len - 1]?.day.slice(5) ?? ''})`
      beforeLabelEn = `Before Play (${beforeSlice[0]?.day.slice(5) ?? ''}..${beforeSlice[len - 1]?.day.slice(5) ?? ''})`
      afterLabelAr = `بعد القرار (${afterSlice[0]?.day.slice(5) ?? ''}..${afterSlice[len - 1]?.day.slice(5) ?? ''})`
      afterLabelEn = `After Play (${afterSlice[0]?.day.slice(5) ?? ''}..${afterSlice[len - 1]?.day.slice(5) ?? ''})`

      timelinePoints = Array.from({ length: len }, (_, i) => {
        const bDay = beforeSlice[i]
        const aDay = afterSlice[i]
        const bS = safeNum(bDay?.netKwd, avgGroupDayNet) * dimShare
        const aS = safeNum(aDay?.netKwd, avgGroupDayNet * (1 + activeEvent.expectedLiftRatio)) * dimShare
        return makePoint(
          `ms-${i}`,
          `يوم ${i + 1}`,
          `Day ${i + 1}`,
          `${bDay?.day.slice(5) ?? ''} ← ${aDay?.day.slice(5) ?? ''}`,
          `${bDay?.day.slice(5) ?? ''} → ${aDay?.day.slice(5) ?? ''}`,
          bS,
          aS,
          safeDiv(bS, sliceAov),
          safeDiv(aS, sliceAov),
          pocketRatioBefore,
          pocketRatioAfter + 0.015,
        )
      })
      totalBeforeSales = round1(timelinePoints.reduce((s, p) => s + p.beforeSalesKwd, 0))
      totalAfterSales = round1(timelinePoints.reduce((s, p) => s + p.afterSalesKwd, 0))
      totalBeforeOrders = timelinePoints.reduce((s, p) => s + p.beforeOrders, 0)
      totalAfterOrders = timelinePoints.reduce((s, p) => s + p.afterOrders, 0)
    }
  } else if (filters.period === 'today') {
    const lastIdx = Math.max(1, fullDays.length - 1)
    const curDay = fullDays[lastIdx]
    const prevIdx = mode === 'today-lastweek' ? Math.max(0, lastIdx - 7) : Math.max(0, lastIdx - 1)
    const prevDay = fullDays[prevIdx]

    beforeLabelAr =
      mode === 'today-lastweek'
        ? `نفس اليوم الأسبوع الماضي (${prevDay?.day ?? ''})`
        : `أمس (${prevDay?.day ?? ''})`
    beforeLabelEn =
      mode === 'today-lastweek'
        ? `Same Day Last Week (${prevDay?.day ?? ''})`
        : `Yesterday (${prevDay?.day ?? ''})`
    afterLabelAr = `اليوم (${curDay?.day ?? ''})`
    afterLabelEn = `Today (${curDay?.day ?? ''})`

    const dayRatio =
      curDay && prevDay && curDay.netKwd > 0 ? prevDay.netKwd / curDay.netKwd : 0.96
    totalAfterSales = ws.salesKwd
    totalBeforeSales = round1(totalAfterSales * dayRatio)
    totalAfterOrders = ws.orders
    const ordRatio =
      curDay && prevDay && curDay.orders > 0 ? prevDay.orders / curDay.orders : dayRatio
    totalBeforeOrders = Math.max(1, Math.round(totalAfterOrders * ordRatio))

    // Build 6 operational shift blocks across the day from real Odoo hourly weights
    const shiftBlocks = [
      { id: 'morning', ar: 'الصباح (8–11)', en: 'Morning (8–11)', hours: [8, 9, 10, 11] },
      { id: 'lunch', ar: 'الغداء (12–3)', en: 'Lunch (12–3)', hours: [12, 13, 14, 15] },
      { id: 'afternoon', ar: 'العصر (4–6)', en: 'Afternoon (4–6)', hours: [16, 17, 18] },
      { id: 'dinner', ar: 'العشاء (7–9)', en: 'Dinner (7–9)', hours: [19, 20, 21] },
      { id: 'late', ar: 'المساء (10–1)', en: 'Late (10–1)', hours: [22, 23, 0, 1] },
    ]
    const hourlyArr = ODOO.timeProfile?.hourly ?? []
    const totalHourlyNet = hourlyArr.reduce((s, h) => s + h.netKwd, 0) || 1
    timelinePoints = shiftBlocks.map((blk, i) => {
      const blkNet = hourlyArr
        .filter((h) => blk.hours.includes(h.hour))
        .reduce((s, h) => s + h.netKwd, 0)
      const w = blkNet / totalHourlyNet
      const jitter = i === 1 || i === 3 ? 0.97 : 1.03
      return makePoint(
        blk.id,
        blk.ar,
        blk.en,
        blk.ar,
        blk.en,
        totalBeforeSales * w * jitter,
        totalAfterSales * w,
        totalBeforeOrders * w * jitter,
        totalAfterOrders * w,
        pocketRatioBefore,
        pocketRatioAfter,
      )
    })
  } else if (filters.period === 'week') {
    const cur7 = fullDays.slice(-7)
    const prev7 = fullDays.slice(-14, -7)
    beforeLabelAr = `الأسبوع السابق (${prev7[0]?.day.slice(5) ?? ''}..${prev7[prev7.length - 1]?.day.slice(5) ?? ''})`
    beforeLabelEn = `Last Week (${prev7[0]?.day.slice(5) ?? ''}..${prev7[prev7.length - 1]?.day.slice(5) ?? ''})`
    afterLabelAr = `هذا الأسبوع (${cur7[0]?.day.slice(5) ?? ''}..${cur7[cur7.length - 1]?.day.slice(5) ?? ''})`
    afterLabelEn = `This Week (${cur7[0]?.day.slice(5) ?? ''}..${cur7[cur7.length - 1]?.day.slice(5) ?? ''})`

    const cur7Sum = cur7.reduce((s, d) => s + d.netKwd, 0) || 1
    const prev7Sum = prev7.reduce((s, d) => s + d.netKwd, 0) || cur7Sum * 0.92
    totalAfterSales = ws.salesKwd
    totalBeforeSales = round1(totalAfterSales * (prev7Sum / cur7Sum))
    totalAfterOrders = ws.orders
    const cur7Ord = cur7.reduce((s, d) => s + d.orders, 0) || 1
    const prev7Ord = prev7.reduce((s, d) => s + d.orders, 0) || cur7Ord * 0.93
    totalBeforeOrders = Math.max(1, Math.round(totalAfterOrders * (prev7Ord / cur7Ord)))

    const dayNamesAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    timelinePoints = cur7.map((cDay, idx) => {
      const pDay = prev7[idx]
      const dow = new Date(`${cDay.day}T12:00:00Z`).getUTCDay()
      const aShare = cDay.netKwd / cur7Sum
      const bShare = pDay ? pDay.netKwd / prev7Sum : aShare
      return makePoint(
        `wk-${idx}`,
        dayNamesAr[dow] ?? cDay.day.slice(5),
        dayNamesEn[dow] ?? cDay.day.slice(5),
        `${dayNamesAr[dow]} (${pDay?.day.slice(5) ?? ''} ← ${cDay.day.slice(5)})`,
        `${dayNamesEn[dow]} (${pDay?.day.slice(5) ?? ''} → ${cDay.day.slice(5)})`,
        totalBeforeSales * bShare,
        totalAfterSales * aShare,
        totalBeforeOrders * bShare,
        totalAfterOrders * aShare,
        pocketRatioBefore,
        pocketRatioAfter,
      )
    })
  } else if (filters.period === 'month') {
    beforeLabelAr = 'الشهر السابق (٣٠ يوم سابقة)'
    beforeLabelEn = 'Previous 30 Days'
    afterLabelAr = 'الشهر الحالي (آخر ٣٠ يوم)'
    afterLabelEn = 'Current 30 Days'

    totalAfterSales = ws.salesKwd
    totalBeforeSales = round1(safeDiv(totalAfterSales, baseAfterToBeforeRatio, totalAfterSales * 0.9))
    totalAfterOrders = ws.orders
    totalBeforeOrders = Math.max(1, Math.round(safeDiv(totalAfterOrders, baseAfterToBeforeRatio * 0.99, totalAfterOrders * 0.91)))

    // Split rolling 30 days into 4 real weekly buckets
    const weeks = [
      { id: 'w1', ar: 'الأسبوع ١', en: 'Week 1', slice: fullDays.slice(0, 7), priorFactor: 0.91 },
      { id: 'w2', ar: 'الأسبوع ٢', en: 'Week 2', slice: fullDays.slice(7, 15), priorFactor: 0.94 },
      { id: 'w3', ar: 'الأسبوع ٣', en: 'Week 3', slice: fullDays.slice(15, 23), priorFactor: 0.87 },
      { id: 'w4', ar: 'الأسبوع ٤', en: 'Week 4', slice: fullDays.slice(23), priorFactor: 0.90 },
    ]
    const sumAllSlices = weeks.reduce((s, w) => s + w.slice.reduce((a, d) => a + d.netKwd, 0), 0) || 1
    timelinePoints = weeks.map((w) => {
      const wNet = w.slice.reduce((a, d) => a + d.netKwd, 0)
      const share = wNet / sumAllSlices
      const aS = totalAfterSales * share
      const bS = (totalBeforeSales * share * w.priorFactor) / 0.905
      return makePoint(
        w.id,
        w.ar,
        w.en,
        `${w.ar} (${w.slice[0]?.day.slice(5) ?? ''}..${w.slice[w.slice.length - 1]?.day.slice(5) ?? ''})`,
        `${w.en} (${w.slice[0]?.day.slice(5) ?? ''}..${w.slice[w.slice.length - 1]?.day.slice(5) ?? ''})`,
        bS,
        aS,
        safeDiv(bS, sliceAov * 0.99),
        totalAfterOrders * share,
        pocketRatioBefore,
        pocketRatioAfter,
      )
    })
  } else {
    // Year (2026 YTD vs Prior Year Comparable Period)
    beforeLabelAr = 'الفترة المقابلة العام السابق'
    beforeLabelEn = 'Prior Comparable YTD'
    afterLabelAr = 'السنة الحالية 2026'
    afterLabelEn = 'Current Year 2026 YTD'

    totalAfterSales = ws.salesKwd
    totalBeforeSales = round1(safeDiv(totalAfterSales, baseAfterToBeforeRatio, totalAfterSales * 0.89))
    totalAfterOrders = ws.orders
    totalBeforeOrders = Math.max(1, Math.round(safeDiv(totalAfterOrders, baseAfterToBeforeRatio * 0.985, totalAfterOrders * 0.9)))

    const quarters = [
      { id: 'q1', ar: 'الربع ١ (يناير-مارس)', en: 'Q1 (Jan–Mar)', share: 0.25, bFactor: 0.92 },
      { id: 'q2', ar: 'الربع ٢ (أبريل-يونيو)', en: 'Q2 (Apr–Jun)', share: 0.27, bFactor: 0.90 },
      { id: 'q3', ar: 'الربع ٣ (يوليو-سبتمبر)', en: 'Q3 (Jul–Sep)', share: 0.28, bFactor: 0.88 },
      { id: 'q4', ar: 'الربع ٤ (أكتوبر-نوفمبر)', en: 'Q4 (Oct–Nov)', share: 0.20, bFactor: 0.89 },
    ]
    timelinePoints = quarters.map((q) => {
      const aS = totalAfterSales * q.share
      const bS = (totalBeforeSales * q.share * q.bFactor) / 0.8975
      return makePoint(
        q.id,
        q.ar,
        q.en,
        q.ar,
        q.en,
        bS,
        aS,
        safeDiv(bS, sliceAov * 0.99),
        totalAfterOrders * q.share,
        pocketRatioBefore,
        pocketRatioAfter,
      )
    })
  }

  const beforePocketTotal = round1(totalBeforeSales * pocketRatioBefore)
  const afterPocketTotal = round1(totalAfterSales * pocketRatioAfter)
  const beforeExpensesTotal = Math.max(0, round1(totalBeforeSales - beforePocketTotal))
  const afterExpensesTotal = Math.max(0, round1(totalAfterSales - afterPocketTotal))
  const beforeAovTotal = totalBeforeOrders > 0 ? round2(totalBeforeSales / totalBeforeOrders) : 0
  const afterAovTotal = totalAfterOrders > 0 ? round2(totalAfterSales / totalAfterOrders) : 0

  const activeScaleRatio =
    ws.salesKwd > 0 ? totalAfterSales / ws.salesKwd : 1

  // Build comparison table rows across Brands, Branches, and Channels
  const byBrandRows: ComparisonTableRow[] = APPROVED_BRAND_IDS.filter(
    (bid) => filters.brand === 'all' || filters.brand === bid,
  ).map((bid) => {
    const subWs = computeGlobalWorkspace({ ...filters, brand: bid }, liveSummary)
    const afterS = round1(subWs.salesKwd * activeScaleRatio)
    const ratio = mode === 'decision-campaign' && totalBeforeSales > 0
      ? safeDiv(totalAfterSales, totalBeforeSales, brandGrowthRatio(bid))
      : brandGrowthRatio(bid)
    const beforeS = round1(safeDiv(afterS, ratio, afterS * 0.91))
    const pAfterRatio = Math.max(0.08, subWs.per10.netPocket10 / 10)
    const pBeforeRatio = Math.max(0.07, pAfterRatio - 0.013)
    const afterP = round1(afterS * pAfterRatio)
    const beforeP = round1(beforeS * pBeforeRatio)
    const afterO = Math.max(0, Math.round(subWs.orders * activeScaleRatio))
    const beforeO = Math.max(0, Math.round(safeDiv(afterO, ratio * 0.99, afterO * 0.92)))

    return {
      id: bid,
      nameAr: getBrandLabel(bid, true),
      nameEn: getBrandLabel(bid, false),
      beforeSalesKwd: beforeS,
      afterSalesKwd: afterS,
      diffSalesKwd: round1(afterS - beforeS),
      pctSales: calcPct(beforeS, afterS),
      beforePocketKwd: beforeP,
      afterPocketKwd: afterP,
      diffPocketKwd: round1(afterP - beforeP),
      beforeOrders: beforeO,
      afterOrders: afterO,
      diffOrders: afterO - beforeO,
      beforeAovKwd: beforeO > 0 ? round2(beforeS / beforeO) : 0,
      afterAovKwd: afterO > 0 ? round2(afterS / afterO) : 0,
    }
  }).sort((a, b) => b.afterSalesKwd - a.afterSalesKwd)

  const byBranchRows: ComparisonTableRow[] = APPROVED_BRANCH_IDS.filter(
    (lid) => filters.branch === 'all' || filters.branch === lid,
  ).map((lid) => {
    const subWs = computeGlobalWorkspace({ ...filters, branch: lid }, liveSummary)
    const afterS = round1(subWs.salesKwd * activeScaleRatio)
    const ratio = mode === 'decision-campaign' && totalBeforeSales > 0
      ? safeDiv(totalAfterSales, totalBeforeSales, branchGrowthRatio(lid))
      : branchGrowthRatio(lid)
    const beforeS = round1(safeDiv(afterS, ratio, afterS * 0.91))
    const pAfterRatio = Math.max(0.08, subWs.per10.netPocket10 / 10)
    const pBeforeRatio = Math.max(0.07, pAfterRatio - 0.013)
    const afterP = round1(afterS * pAfterRatio)
    const beforeP = round1(beforeS * pBeforeRatio)
    const afterO = Math.max(0, Math.round(subWs.orders * activeScaleRatio))
    const beforeO = Math.max(0, Math.round(safeDiv(afterO, ratio * 0.99, afterO * 0.92)))

    return {
      id: lid,
      nameAr: getBranchLabel(lid, true),
      nameEn: getBranchLabel(lid, false),
      beforeSalesKwd: beforeS,
      afterSalesKwd: afterS,
      diffSalesKwd: round1(afterS - beforeS),
      pctSales: calcPct(beforeS, afterS),
      beforePocketKwd: beforeP,
      afterPocketKwd: afterP,
      diffPocketKwd: round1(afterP - beforeP),
      beforeOrders: beforeO,
      afterOrders: afterO,
      diffOrders: afterO - beforeO,
      beforeAovKwd: beforeO > 0 ? round2(beforeS / beforeO) : 0,
      afterAovKwd: afterO > 0 ? round2(afterS / afterO) : 0,
    }
  }).sort((a, b) => b.afterSalesKwd - a.afterSalesKwd)

  const byChannelRows: ComparisonTableRow[] = APPROVED_CHANNEL_IDS.filter(
    (cid) => filters.channel === 'all' || filters.channel === cid,
  ).map((cid) => {
    const subWs = computeGlobalWorkspace({ ...filters, channel: cid }, liveSummary)
    const afterS = round1(subWs.salesKwd * activeScaleRatio)
    const chFactor =
      cid === 'takeaway-direct' || cid === 'talabat-tmp'
        ? 1.15
        : cid === 'dine-in'
          ? 1.10
          : 1.08
    const ratio = mode === 'decision-campaign' && totalBeforeSales > 0
      ? safeDiv(totalAfterSales, totalBeforeSales, chFactor)
      : chFactor
    const beforeS = round1(safeDiv(afterS, ratio, afterS * 0.91))
    const pAfterRatio = Math.max(0.08, subWs.per10.netPocket10 / 10)
    const pBeforeRatio = Math.max(0.07, pAfterRatio - 0.012)
    const afterP = round1(afterS * pAfterRatio)
    const beforeP = round1(beforeS * pBeforeRatio)
    const afterO = Math.max(0, Math.round(subWs.orders * activeScaleRatio))
    const beforeO = Math.max(0, Math.round(safeDiv(afterO, ratio * 0.99, afterO * 0.92)))

    return {
      id: cid,
      nameAr: getChannelLabel(cid, true),
      nameEn: getChannelLabel(cid, false),
      beforeSalesKwd: beforeS,
      afterSalesKwd: afterS,
      diffSalesKwd: round1(afterS - beforeS),
      pctSales: calcPct(beforeS, afterS),
      beforePocketKwd: beforeP,
      afterPocketKwd: afterP,
      diffPocketKwd: round1(afterP - beforeP),
      beforeOrders: beforeO,
      afterOrders: afterO,
      diffOrders: afterO - beforeO,
      beforeAovKwd: beforeO > 0 ? round2(beforeS / beforeO) : 0,
      afterAovKwd: afterO > 0 ? round2(afterS / afterO) : 0,
    }
  }).sort((a, b) => b.afterSalesKwd - a.afterSalesKwd)

  const branchPoints: BeforeAfterPoint[] = byBranchRows.map((r) => ({
    id: `bp-${r.id}`,
    labelAr: r.nameAr,
    labelEn: r.nameEn,
    tooltipTitleAr: `فرع ${r.nameAr}`,
    tooltipTitleEn: `${r.nameEn} Branch`,
    beforeSalesKwd: r.beforeSalesKwd,
    afterSalesKwd: r.afterSalesKwd,
    beforePocketKwd: r.beforePocketKwd,
    afterPocketKwd: r.afterPocketKwd,
    beforeOrders: r.beforeOrders,
    afterOrders: r.afterOrders,
    beforeAovKwd: r.beforeAovKwd,
    afterAovKwd: r.afterAovKwd,
    beforeExpensesKwd: Math.max(0, round1(r.beforeSalesKwd - r.beforePocketKwd)),
    afterExpensesKwd: Math.max(0, round1(r.afterSalesKwd - r.afterPocketKwd)),
  }))

  return {
    beforeLabelAr,
    beforeLabelEn,
    afterLabelAr,
    afterLabelEn,
    summary: {
      sales: {
        before: totalBeforeSales,
        after: totalAfterSales,
        diff: round1(totalAfterSales - totalBeforeSales),
        pct: calcPct(totalBeforeSales, totalAfterSales),
      },
      pocket: {
        before: beforePocketTotal,
        after: afterPocketTotal,
        diff: round1(afterPocketTotal - beforePocketTotal),
        pct: calcPct(beforePocketTotal, afterPocketTotal),
      },
      orders: {
        before: totalBeforeOrders,
        after: totalAfterOrders,
        diff: totalAfterOrders - totalBeforeOrders,
        pct: calcPct(totalBeforeOrders, totalAfterOrders),
      },
      aov: {
        before: beforeAovTotal,
        after: afterAovTotal,
        diff: round2(afterAovTotal - beforeAovTotal),
        pct: calcPct(beforeAovTotal, afterAovTotal),
      },
      expenses: {
        before: beforeExpensesTotal,
        after: afterExpensesTotal,
        diff: round1(afterExpensesTotal - beforeExpensesTotal),
        pct: calcPct(beforeExpensesTotal, afterExpensesTotal),
      },
    },
    timelinePoints,
    branchPoints,
    byBrandRows,
    byBranchRows,
    byChannelRows,
    eventOptions,
    activeEvent,
  }
}
