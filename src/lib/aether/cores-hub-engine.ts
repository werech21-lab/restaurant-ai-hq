/**
 * Multi-Core Hub Data Engine (`/erp/cores` — المبيعات والتسويق والمينيو)
 *
 * Strictly uses live Odoo data (`OdooLiveSummary` + optional `OdooPeriodCube` from `/api/erp/live-comparison`).
 * Zero static JSON imports (`odoo-dataset`, `odoo-journey`, `odoo-intel`), zero forced remainder
 * reconciliation, zero invented ROI multipliers, zero invented promo basket uplifts, and zero quiet-window upside figures.
 * Strictly 6 brands and 7 branches + explicit 8th row `غير منسوب لفرع`.
 */

import { resolveBranchScope, resolveBrandHeadline, resolveDailySeriesForBrand } from '@/lib/aether/brand-scope'
import { selectCubeHeadline, type PeriodCubeHeadline } from '@/lib/aether/period-cube-headline'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { isExcludedOdooEntity } from '@/lib/aether/period-delta'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  computeGlobalWorkspace,
  formatPeriodCalendarWindow,
  getBranchLabel,
  getBrandLabel,
  getChannelLabel,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'

export const UNATTRIBUTED_BRANCH_LABEL_AR = 'غير منسوب لفرع'
export const UNATTRIBUTED_BRANCH_LABEL_EN = 'Unattributed to Branch'
import {
  evaluateCampaignOdooHalo,
  type CampaignHaloEvaluation,
  type SocialCampaign,
} from '@/lib/aether/social-campaigns'
import {
  reconcileHourlyToPeriod,
  selectDisplayHours,
  type HourlyReconciliation,
} from '@/lib/aether/hourly-integrity'

export type DishSimpleTag = 'golden' | 'reprice' | 'box-gem' | 'slow'

export interface MenuDishRow {
  id: string
  name: string
  brandId: Exclude<GlobalBrand, 'all'>
  brandAr: string
  brandEn: string
  category: string
  unitsSold: number
  monthlyUnitsSold: number
  unitPriceKwd: number
  unitCostKwd: number
  salesKwd: number
  costKwd: number
  netProfitKwd: number
  marginPct: number
  foodCostPct: number
  targetFoodCostPct: number
  costGapPct: number
  discountKwd: number
  avgDiscountPct: number
  linesCount: number
  costCreepNoteAr: string
  costCreepNoteEn: string
  tag: DishSimpleTag
  tagAr: string
  tagEn: string
  actionBadgeAr: string
  actionBadgeEn: string
  recommendedDeltaPriceKwd: number
  recommendedCostSavePct: number
  recommendedRetentionPct: number
  recommendedPromoLiftPct: number
  conservativeMonthlyGainKwd: number
}

export interface KuwaitGrowthPlay {
  id: string
  num: string
  titleAr: string
  titleEn: string
  scopeAr: string
  scopeEn: string
  badgeAr: string
  badgeEn: string
  upsideMinKwd: number
  upsideMaxKwd: number
  upsideBadgeAr: string
  upsideBadgeEn: string
  shortBulletsAr: string[]
  shortBulletsEn: string[]
  detailsAr: string
  detailsEn: string
  summaryAr: string
  summaryEn: string
  bulletsAr: string[]
  bulletsEn: string[]
  expectedAr: string
  expectedEn: string
  whatsappTextAr: string
  whatsappTextEn: string
}

export interface MarketingChartPoint {
  id: string
  labelAr: string
  labelEn: string
  tooltipTitleAr: string
  tooltipTitleEn: string
  organicSalesKwd: number
  promoAdSalesKwd: number
  totalSalesKwd: number
  orders: number
  marketingCostKwd: number
  netProfitKwd: number
}

export interface SalesPoint {
  id: string
  labelAr: string
  labelEn: string
  tooltipTitleAr: string
  tooltipTitleEn: string
  salesKwd: number
  displaySalesKwd: number
  /** `null` when Odoo could not supply a real order count for this row (shown as —). */
  orders: number | null
  aovKwd: number | null
  sharePct: number
  color?: string
}

export interface BranchQualityRow {
  branchId: Exclude<GlobalBranch, 'all'>
  branchAr: string
  branchEn: string
  rating: number
  cancelledOrders: number
  cancelledKwd: number
  cancelRatePct: number
  compOrders: number
  compKwd: number
  qualityScore: number
  alertAr: string
  alertEn: string
  fixAr: string
  fixEn: string
}

export interface PlatformRatingRow {
  id: string
  platformAr: string
  platformEn: string
  rating: number
  targetRating: number
  orders: number
  issueAr: string
  issueEn: string
  stepAr: string
  stepEn: string
}

export interface CoresHubSnapshot {
  connected: boolean
  noData: boolean
  lastSyncAt: string | null
  isStale24h: boolean
  dateRangeLabel: string
  isSingleDayWindow: boolean
  marketing: {
    evaluations: CampaignHaloEvaluation[]
    posDiscountsKwd: number
    posAvgDiscountPct: number
    posDiscountedLinesCount: number
    loggedCampaignSpendKwd: number
    kpis: {
      roasPer1Kwd: number
      promoAdSalesKwd: number
      organicSalesKwd: number
      promoSharePct: number
      totalMarketingCostKwd: number
      marketingCostPctOfSales: number
      netAfterAdSpendKwd: number
      netPocketAfterAdsKwd: number
      netPocketAfterAdsPct: number
      promoAovKwd: number
      organicAovKwd: number
      aovDeltaKwd: number
      aovDeltaPct: number
      incrementalOrders: number
    }
    chartPoints: MarketingChartPoint[]
    growthPlays: KuwaitGrowthPlay[]
    dishOfTheWeek: {
      dishName: string
      brandAr: string
      brandEn: string
      priceKwd: number
      marginPct: number
      angleAr: string
      angleEn: string
    } | null
  }
  sales: {
    headline: PeriodCubeHeadline
    hourlyUnavailable: boolean
    /** `sum(hourly) === selected period total` check (fils-exact); `null` until the period cube loads. */
    hourlyReconciliation: HourlyReconciliation | null
    channelsUnavailable: boolean
    branchesUnavailable: boolean
    brandsUnavailable: boolean
    /** `brand`: the timeline is the selected brand; `all-brands`: company series (label it). */
    timelineScope: 'brand' | 'all-brands'
    /** `brand`: branch rows are the selected brand's exact split; `all-brands`: company rows. */
    branchScope: 'brand' | 'all-brands'
    peakHourLabelAr: string
    peakHourLabelEn: string
    peakHourShortAr: string
    peakHourShortEn: string
    peakHourSalesKwd: number
    peakHourDisplayKwd: number
    peakHourOrders: number
    peakHourSharePct: number
    strongestDayLabelAr: string
    strongestDayLabelEn: string
    quietWindowAr: string
    quietWindowEn: string
    quietWindowSalesKwd: number
    quietWindowDisplayKwd: number
    quietWindowOrders: number
    quietWindowSharePct: number
    quietWindowUpsideKwd: number
    zeroCommSalesKwd: number
    zeroCommDisplayKwd: number
    zeroCommSharePct: number
    zeroCommOrders: number
    aggregatorSalesKwd: number
    aggregatorDisplayKwd: number
    aggregatorSharePct: number
    aggregatorOrders: number
    directNetMarginPct: number
    aggregatorNetMarginPct: number
    unattributedSalesKwd: number
    /** `null` when the brand-scoped unattributed cell has no real order count. */
    unattributedOrders: number | null
    timeline: SalesPoint[]
    hourly: SalesPoint[]
    brandShare: SalesPoint[]
    branchRanking: SalesPoint[]
    channelRanking: SalesPoint[]
  }
  menu: {
    menuUnavailable: boolean
    bomLinked: boolean
    totalActiveSkus: number
    totalUnitsSold: number
    totalSalesKwd: number
    totalDiscountKwd: number
    totalCostKwd: number
    totalNetProfitKwd: number
    avgMarginPct: number
    avgFoodCostPct: number
    effectiveChannelFeePct: number
    optimizationUpsideKwd: number
    topProfitDish: MenuDishRow | null
    topProfitHeroes: MenuDishRow[]
    topMarginBleeders: MenuDishRow[]
    quadrantCounts: Record<DishSimpleTag, number>
    dishes: MenuDishRow[]
  }
  quality: {
    avgPlatformRating: number
    cancelledOrders: number
    cancelledKwd: number
    qualityScore: number
    repeatGuests: number
    identifiedGuests: number
    branchQuality: BranchQualityRow[]
    platformRatings: PlatformRatingRow[]
  }
}

export interface DishSimulationResult {
  baseUnitsMo: number
  simUnitsMo: number
  newPriceKwd: number
  newUnitCostKwd: number
  newFoodCostPct: number
  newGrossMarginPct: number
  currentMonthlyNetKwd: number
  simulatedMonthlyNetKwd: number
  monthlyNetGainKwd: number
  unitNetBeforeKwd: number
  unitNetAfterKwd: number
}

const safeNum = (v: unknown, fb = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fb

const round1 = (n: number) => Math.round(safeNum(n) * 10) / 10
const round2 = (n: number) => Math.round(safeNum(n) * 100) / 100
const round3 = (n: number) => Math.round(safeNum(n) * 1000) / 1000

const BRAND_COLORS: Record<Exclude<GlobalBrand, 'all'>, string> = {
  'china-garden': '#10B981',
  franks: '#F59E0B',
  tahina: '#0EA5E9',
  'farm-brown': '#8B5CF6',
  'noodle-bar': '#EC4899',
  'karak-cafeteria': '#14B8A6',
}

function cleanDishName(raw: string): string {
  return raw.replace(/^\[[^\]]+\]\s*/, '').trim()
}

function formatHourAr(h: number): string {
  if (h === 0) return '12 ص'
  if (h < 12) return `${h} ص`
  if (h === 12) return '12 م'
  return `${h - 12} م`
}

function formatHourEn(h: number): string {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

export function simulateDishPriceAndCost(params: {
  monthlyUnitsSold: number
  unitPriceKwd: number
  unitCostKwd: number
  deltaPriceKwd: number
  costSavePct: number
  retentionPct: number
  promoLiftPct?: number
  channelFeePct: number
}): DishSimulationResult {
  const baseUnitsMo = Math.max(0, Math.round(safeNum(params.monthlyUnitsSold, 0)))
  const p0 = Math.max(0, safeNum(params.unitPriceKwd, 0))
  const c0 = Math.max(0, safeNum(params.unitCostKwd, 0))
  const dP = safeNum(params.deltaPriceKwd, 0)
  const saveRatio = Math.min(0.5, Math.max(0, safeNum(params.costSavePct, 0) / 100))
  const feeRatio = Math.min(0.5, Math.max(0, safeNum(params.channelFeePct, 0) / 100))
  const retRatio =
    dP > 0.001
      ? Math.min(1, Math.max(0.5, safeNum(params.retentionPct, 95) / 100))
      : 1
  const liftRatio = Math.min(0.5, Math.max(0, safeNum(params.promoLiftPct, 0) / 100))

  const newPriceKwd = round2(Math.max(0, p0 + dP))
  const newUnitCostKwd = round2(Math.max(0, c0 * (1 - saveRatio)))
  const simUnitsMo = Math.max(0, Math.round(baseUnitsMo * retRatio * (1 + liftRatio)))

  const unitNetBeforeKwd = round3(p0 * (1 - feeRatio) - c0)
  const unitNetAfterKwd = round3(newPriceKwd * (1 - feeRatio) - newUnitCostKwd)

  const currentMonthlyNetKwd = round1(baseUnitsMo * unitNetBeforeKwd)
  const simulatedMonthlyNetKwd = round1(simUnitsMo * unitNetAfterKwd)
  const monthlyNetGainKwd = round1(simulatedMonthlyNetKwd - currentMonthlyNetKwd)

  const newFoodCostPct = newPriceKwd > 0 ? round1((newUnitCostKwd / newPriceKwd) * 100) : 0
  const newGrossMarginPct = newPriceKwd > 0 ? round1(Math.max(0, 100 - newFoodCostPct)) : 0

  return {
    baseUnitsMo,
    simUnitsMo,
    newPriceKwd,
    newUnitCostKwd,
    newFoodCostPct,
    newGrossMarginPct,
    currentMonthlyNetKwd,
    simulatedMonthlyNetKwd,
    monthlyNetGainKwd,
    unitNetBeforeKwd,
    unitNetAfterKwd,
  }
}

/** A real order count, or `null` when the source did not supply one. */
function knownCount(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function extractBranchDailySeries(
  dailyByBranch:
    | Record<
        string,
        Record<string, { netKwd?: number | null; orders?: number | null } | undefined> | undefined
      >
    | null
    | undefined,
  branchKey: string,
  window?: { fromIso: string; toInclusiveIso: string },
): { day: string; orders: number; netKwd: number }[] {
  const out: { day: string; orders: number; netKwd: number }[] = []
  for (const [day, byBr] of Object.entries(dailyByBranch ?? {})) {
    if (window && (day < window.fromIso || day > window.toInclusiveIso)) continue
    const cell = byBr?.[branchKey]
    if (!cell || typeof cell.netKwd !== 'number' || !Number.isFinite(cell.netKwd)) {
      continue
    }
    out.push({
      day,
      netKwd: cell.netKwd,
      orders: typeof cell.orders === 'number' && Number.isFinite(cell.orders) ? cell.orders : 0,
    })
  }
  return out.sort((a, b) => a.day.localeCompare(b.day))
}

function toSalesPoint(params: {
  id: string
  labelAr: string
  labelEn: string
  tooltipTitleAr?: string
  tooltipTitleEn?: string
  salesKwd: number
  orders: number | null
  denominatorKwd: number
  color?: string
}): SalesPoint {
  const salesKwd = round3(Math.max(0, safeNum(params.salesKwd)))
  const orders = params.orders === null ? null : Math.max(0, Math.round(safeNum(params.orders)))
  const denom = safeNum(params.denominatorKwd)
  return {
    id: params.id,
    labelAr: params.labelAr,
    labelEn: params.labelEn,
    tooltipTitleAr: params.tooltipTitleAr ?? params.labelAr,
    tooltipTitleEn: params.tooltipTitleEn ?? params.labelEn,
    salesKwd,
    displaySalesKwd: Math.round(salesKwd),
    orders,
    aovKwd: orders === null ? null : orders > 0 ? round3(salesKwd / orders) : 0,
    sharePct: denom > 0 ? round1((salesKwd / denom) * 100) : 0,
    color: params.color,
  }
}

export function computeCoresHubSnapshot(
  filters: GlobalFilters,
  campaigns: SocialCampaign[],
  liveSummary?: OdooLiveSummary | null,
  liveCube?: OdooPeriodCube | null,
): CoresHubSnapshot {
  const ws = computeGlobalWorkspace(filters, liveSummary)
  const canonicalPeriodWin = formatPeriodCalendarWindow(filters.period ?? 'month', {
    customFrom: filters.customFrom,
    customTo: filters.customTo,
    liveSummary,
  })

  const connected = Boolean(
    (liveCube && liveCube.connected) || (ws.odooConnected && !ws.noData),
  )
  const noData = Boolean(
    !connected || (liveCube ? liveCube.noData : ws.noData),
  )
  const lastSyncAt = liveCube?.lastSyncAt ?? ws.lastSyncAt ?? null
  const isStale24h = Boolean(liveCube?.isStale24h ?? ws.isStale24h)
  const dateRangeLabel = liveCube?.dateRange
    ? `${liveCube.dateRange.from} → ${liveCube.dateRange.to}`
    : `${canonicalPeriodWin.fromIso} → ${canonicalPeriodWin.toInclusiveIso}`
  const effectiveFromIso = liveCube?.dateRange?.from ?? canonicalPeriodWin.fromIso
  const effectiveToIso = liveCube?.dateRange?.to ?? canonicalPeriodWin.toInclusiveIso
  const isSingleDayWindow = Boolean(
    effectiveFromIso && effectiveToIso && effectiveFromIso === effectiveToIso,
  )

  const visibleCampaigns =
    filters.brand === 'all' ? campaigns : campaigns.filter((c) => c.brand === filters.brand)
  const evaluations = visibleCampaigns.map((c) =>
    evaluateCampaignOdooHalo(c, filters.branch, filters.channel, liveSummary),
  )
  const loggedCampaignSpendKwd = round1(
    evaluations.reduce((s, e) => s + safeNum(e.campaign.spendKwd), 0),
  )

  if (!connected || noData) {
    return {
      connected,
      noData: true,
      lastSyncAt,
      isStale24h,
      dateRangeLabel,
      isSingleDayWindow,
      marketing: {
        evaluations,
        posDiscountsKwd: 0,
        posAvgDiscountPct: 0,
        posDiscountedLinesCount: 0,
        loggedCampaignSpendKwd,
        kpis: {
          roasPer1Kwd: 0,
          promoAdSalesKwd: 0,
          organicSalesKwd: 0,
          promoSharePct: 0,
          totalMarketingCostKwd: 0,
          marketingCostPctOfSales: 0,
          netAfterAdSpendKwd: 0,
          netPocketAfterAdsKwd: 0,
          netPocketAfterAdsPct: 0,
          promoAovKwd: 0,
          organicAovKwd: 0,
          aovDeltaKwd: 0,
          aovDeltaPct: 0,
          incrementalOrders: 0,
        },
        chartPoints: [],
        growthPlays: [],
        dishOfTheWeek: null,
      },
      sales: {
        headline: { netSalesKwd: null, orders: null, aovKwd: null },
        hourlyUnavailable: false,
        hourlyReconciliation: null,
        channelsUnavailable: false,
        branchesUnavailable: false,
        brandsUnavailable: false,
        timelineScope: 'all-brands',
        branchScope: 'all-brands',
        peakHourLabelAr: '—',
        peakHourLabelEn: '—',
        peakHourShortAr: '—',
        peakHourShortEn: '—',
        peakHourSalesKwd: 0,
        peakHourDisplayKwd: 0,
        peakHourOrders: 0,
        peakHourSharePct: 0,
        strongestDayLabelAr: '—',
        strongestDayLabelEn: '—',
        quietWindowAr: '3:00 م – 6:00 م',
        quietWindowEn: '3:00 PM – 6:00 PM',
        quietWindowSalesKwd: 0,
        quietWindowDisplayKwd: 0,
        quietWindowOrders: 0,
        quietWindowSharePct: 0,
        quietWindowUpsideKwd: 0,
        zeroCommSalesKwd: 0,
        zeroCommDisplayKwd: 0,
        zeroCommSharePct: 0,
        zeroCommOrders: 0,
        aggregatorSalesKwd: 0,
        aggregatorDisplayKwd: 0,
        aggregatorSharePct: 0,
        aggregatorOrders: 0,
        directNetMarginPct: 0,
        aggregatorNetMarginPct: 0,
        unattributedSalesKwd: 0,
        unattributedOrders: 0,
        timeline: [],
        hourly: [],
        brandShare: [],
        branchRanking: [],
        channelRanking: [],
      },
      menu: {
        menuUnavailable: false,
        bomLinked: false,
        totalActiveSkus: 0,
        totalUnitsSold: 0,
        totalSalesKwd: 0,
        totalDiscountKwd: 0,
        totalCostKwd: 0,
        totalNetProfitKwd: 0,
        avgMarginPct: 0,
        avgFoodCostPct: 0,
        effectiveChannelFeePct: 0,
        optimizationUpsideKwd: 0,
        topProfitDish: null,
        topProfitHeroes: [],
        topMarginBleeders: [],
        quadrantCounts: { golden: 0, reprice: 0, 'box-gem': 0, slow: 0 },
        dishes: [],
      },
      quality: {
        avgPlatformRating: 0,
        cancelledOrders: 0,
        cancelledKwd: 0,
        qualityScore: 0,
        repeatGuests: 0,
        identifiedGuests: 0,
        branchQuality: [],
        platformRatings: [],
      },
    }
  }

  // 1. Live daily series (brand series only when an exact one covers the window)
  const scopedDaily: { scope: 'brand' | 'all-brands'; series: { day: string; orders: number; netKwd: number }[] } = (() => {
    if (liveCube) {
      if (filters.branch !== 'all') {
        return {
          scope: 'all-brands',
          series: extractBranchDailySeries(liveCube.dailyByBranch, filters.branch),
        }
      }
      return { scope: 'all-brands', series: liveCube.dailySeries ?? [] }
    }
    const window = { fromIso: canonicalPeriodWin.fromIso, toInclusiveIso: canonicalPeriodWin.toInclusiveIso }
    if (filters.branch === 'all') return resolveDailySeriesForBrand(liveSummary, filters.brand, window)
    return {
      scope: 'all-brands',
      series: extractBranchDailySeries(liveSummary?.dailyByBranch, filters.branch, window),
    }
  })()
  const rawDailySeries = scopedDaily.series
  const timelineScope = scopedDaily.scope

  const dayNamesAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const shortDayEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const dailyTotalKwd = rawDailySeries.reduce((s, d) => s + safeNum(d.netKwd), 0)
  const timeline: SalesPoint[] = rawDailySeries.map((d) => {
    const dow = new Date(`${d.day}T12:00:00Z`).getUTCDay()
    const isShortRange = rawDailySeries.length <= 10
    return toSalesPoint({
      id: d.day,
      labelAr: isShortRange ? `${dayNamesAr[dow] ?? ''} ${d.day.slice(8, 10)}/${d.day.slice(5, 7)}` : `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}`,
      labelEn: isShortRange ? `${shortDayEn[dow] ?? ''} ${d.day.slice(5)}` : d.day.slice(5),
      tooltipTitleAr: `${dayNamesAr[dow] ?? ''} (${d.day})`,
      tooltipTitleEn: `${dayNamesEn[dow] ?? ''} (${d.day})`,
      salesKwd: d.netKwd,
      orders: d.orders,
      denominatorKwd: dailyTotalKwd || ws.salesKwd,
      color: dow === 4 || dow === 5 ? '#10B981' : '#38BDF8',
    })
  })

  // Strongest day of week from live daily series
  const dowTotals = [0, 0, 0, 0, 0, 0, 0]
  const dowCounts = [0, 0, 0, 0, 0, 0, 0]
  for (const d of rawDailySeries) {
    const dow = new Date(`${d.day}T12:00:00Z`).getUTCDay()
    if (dow >= 0 && dow <= 6 && safeNum(d.netKwd) > 0) {
      dowTotals[dow] += safeNum(d.netKwd)
      dowCounts[dow] += 1
    }
  }
  let bestDow = -1
  let bestDowAvg = 0
  for (let i = 0; i < 7; i++) {
    const avg = dowCounts[i] > 0 ? dowTotals[i] / dowCounts[i] : 0
    if (avg > bestDowAvg) {
      bestDowAvg = avg
      bestDow = i
    }
  }
  const strongestDayLabelAr = bestDow >= 0 ? dayNamesAr[bestDow] : '—'
  const strongestDayLabelEn = bestDow >= 0 ? dayNamesEn[bestDow] : '—'

  // 2. Live hourly series (from liveCube when loaded, or liveSummary.hourlySeries)
  // Phase 5 · Item 1: hourly buckets come ONLY from the selected-period cube. The summary's
  // hourly series covers month-to-date, so it is never substituted for another period.
  const hourlyUnavailable = Boolean(!liveCube && liveSummary?.hourlySeries === null)
  const rawHourly =
    liveCube
      ? filters.branch !== 'all'
        ? liveCube.hourlyByBranch?.[filters.branch] ?? []
        : liveCube.hourlySeries ?? []
      : []
  const orderedHours = selectDisplayHours(rawHourly)
  const hourlyPeriodTotalKwd: number | null = liveCube
    ? filters.branch === 'all'
      ? safeNum(liveCube.totals?.netSalesKwd)
      : (liveCube.byBranch as Record<string, { netKwd: number } | undefined>)?.[filters.branch]?.netKwd ?? null
    : null
  const hourlyReconciliation = reconcileHourlyToPeriod(rawHourly, hourlyPeriodTotalKwd)

  const hourlyDenom = rawHourly.reduce((s, r) => s + safeNum(r.netKwd), 0)
  const hourlyPrelim: SalesPoint[] =
    rawHourly.length > 0
      ? orderedHours.map((hr) => {
          const row = rawHourly.find((x) => x.hour === hr)
          return toSalesPoint({
            id: `hr-${hr}`,
            labelAr: formatHourAr(hr),
            labelEn: formatHourEn(hr),
            tooltipTitleAr: `الساعة ${formatHourAr(hr)}`,
            tooltipTitleEn: formatHourEn(hr),
            salesKwd: row?.netKwd ?? 0,
            orders: row?.orders ?? 0,
            denominatorKwd: hourlyDenom,
          })
        })
      : []

  const topPeakIds = new Set(
    [...hourlyPrelim]
      .filter((h) => h.salesKwd > 0)
      .sort((a, b) => b.salesKwd - a.salesKwd)
      .slice(0, 4)
      .map((h) => h.id),
  )
  const hourly: SalesPoint[] = hourlyPrelim.map((pt) => {
    const hrNum = Number(pt.id.replace('hr-', ''))
    const isAfternoon = hrNum >= 15 && hrNum <= 17
    return {
      ...pt,
      color: topPeakIds.has(pt.id) ? '#10B981' : isAfternoon ? '#F59E0B' : '#94A3B8',
    }
  })

  const peakHour = [...hourly].filter((h) => h.salesKwd > 0).sort((a, b) => b.salesKwd - a.salesKwd)[0]
  const peakHourShortAr = peakHour?.labelAr ?? '—'
  const peakHourShortEn = peakHour?.labelEn ?? '—'
  const peakHourSalesKwd = peakHour?.salesKwd ?? 0
  const peakHourDisplayKwd = peakHour?.displaySalesKwd ?? 0
  const peakHourOrders = peakHour?.orders ?? 0
  const peakHourSharePct = peakHour?.sharePct ?? 0
  const peakHourLabelAr = peakHour
    ? `${peakHour.labelAr} (${peakHour.displaySalesKwd.toLocaleString('en-US')} د.ك)`
    : '—'
  const peakHourLabelEn = peakHour
    ? `${peakHour.labelEn} (${peakHour.displaySalesKwd.toLocaleString('en-US')} KWD)`
    : '—'

  const quietHourRows = hourly.filter(
    (h) => h.id === 'hr-15' || h.id === 'hr-16' || h.id === 'hr-17',
  )
  const quietWindowSalesKwd = round3(quietHourRows.reduce((s, r) => s + r.salesKwd, 0))
  const quietWindowDisplayKwd = quietHourRows.reduce((s, r) => s + r.displaySalesKwd, 0)
  const quietWindowOrders = quietHourRows.reduce((s, r) => s + (r.orders ?? 0), 0)
  const quietWindowSharePct =
    hourlyDenom > 0 ? round1((quietWindowSalesKwd / hourlyDenom) * 100) : 0

  const activeBucket =
    filters.period === 'custom'
      ? liveSummary?.customBucket
      : liveSummary?.buckets?.[filters.period] ?? liveSummary?.buckets?.month

  // 3. Brand Share (6 brands strictly)
  const unavailableSet = new Set(liveSummary?.unavailableSections ?? [])
  const brandsUnavailable = Boolean(
    !liveCube &&
      (unavailableSet.has('products') ||
        unavailableSet.has('pos.category') ||
        (activeBucket &&
          (activeBucket.byBrand === null || activeBucket.totals.restaurantNetKwd === null))),
  )
  const brandIds =
    filters.brand === 'all' ? [...APPROVED_BRAND_IDS] : [filters.brand]
  const brandRowsRaw = brandsUnavailable
    ? []
    : brandIds.map((bid) => {
        if (liveCube) {
          if (filters.branch !== 'all') {
            // The cube has product-line counts per brand × branch, not order counts.
            const cell = liveCube.brandByBranch?.[filters.branch]?.[bid]
            return { bid, salesKwd: safeNum(cell?.netKwd), orders: null }
          }
          const bRow = liveCube.byBrand?.[bid]
          return { bid, salesKwd: safeNum(bRow?.netKwd), orders: knownCount(bRow?.orders) }
        }
        const bktBrand = activeBucket?.byBrand?.[bid]
        if (bktBrand) {
          // Same legacy guard as the headline: old payloads carry pro-rata brand orders (→ null).
          const headline = resolveBrandHeadline(activeBucket, bid)
          return { bid, salesKwd: safeNum(bktBrand.netKwd), orders: headline?.orders ?? null }
        }
        // No bucket: the cascading options carry sales only; the order count is unknown.
        const wsOpt = ws.cascadingOptions.brands.find((x) => x.id === bid)
        return { bid, salesKwd: safeNum(wsOpt?.salesKwd), orders: null }
      })
  const brandTotalKwd = brandRowsRaw.reduce((s, r) => s + r.salesKwd, 0)
  const brandShare: SalesPoint[] = brandRowsRaw
    .map((r) =>
      toSalesPoint({
        id: r.bid,
        labelAr: getBrandLabel(r.bid, true),
        labelEn: getBrandLabel(r.bid, false),
        salesKwd: r.salesKwd,
        orders: r.orders,
        denominatorKwd: brandTotalKwd,
        color: BRAND_COLORS[r.bid],
      }),
    )
    .sort((a, b) => b.salesKwd - a.salesKwd)

  // 4. Branch Ranking (7 branches + explicit 8th row `غير منسوب لفرع`)
  const branchIds: string[] =
    filters.branch === 'all' ? [...APPROVED_BRANCH_IDS, 'school-canteens'] : [filters.branch]
  const bucketBranchScope =
    liveCube || !activeBucket ? null : resolveBranchScope(activeBucket, filters.brand, branchIds)
  const branchesUnavailable = Boolean(
    !liveCube &&
      activeBucket &&
      (!bucketBranchScope?.available ||
        activeBucket.byLocation === null ||
        activeBucket.mappedByLocation === null ||
        activeBucket.totals.restaurantNetKwd === null),
  )
  const branchScope: 'brand' | 'all-brands' =
    bucketBranchScope?.available && bucketBranchScope.scope === 'brand' ? 'brand' : 'all-brands'
  const branchRowsRaw = branchesUnavailable
    ? []
    : branchIds.map((lid) => {
        if (liveCube) {
          if (filters.brand !== 'all') {
            // Product-line counts are not orders; brand × branch orders are unknown on the cube.
            const cell = liveCube.brandByBranch?.[lid]?.[filters.brand]
            return { lid, salesKwd: safeNum(cell?.netKwd), orders: null }
          }
          const lRow =
            liveCube.byBranch?.[lid as (typeof APPROVED_BRANCH_IDS)[number] | 'school-canteens']
          return { lid, salesKwd: safeNum(lRow?.netKwd), orders: knownCount(lRow?.orders) }
        }
        if (bucketBranchScope?.available) {
          const cell = bucketBranchScope.rows[lid]
          return { lid, salesKwd: safeNum(cell?.netKwd), orders: knownCount(cell?.orders) }
        }
        const wsOpt = ws.cascadingOptions.branches.find((x) => x.id === lid)
        return { lid, salesKwd: safeNum(wsOpt?.salesKwd), orders: null }
      })

  const bucketUnattributed = bucketBranchScope?.available ? bucketBranchScope.unattributed : null
  const unattributedSalesKwd =
    branchesUnavailable || filters.branch !== 'all'
      ? 0
      : round3(
          liveCube
            ? safeNum(liveCube.unattributed?.netKwd)
            : safeNum(bucketUnattributed ? bucketUnattributed.netKwd : ws.unattributedSalesKwd),
        )
  const unattributedOrdersRaw: number | null =
    branchesUnavailable || filters.branch !== 'all'
      ? 0
      : liveCube
        ? safeNum(liveCube.unattributed?.orders)
        : bucketUnattributed
          ? bucketUnattributed.orders
          : safeNum(ws.unattributedOrders)
  // A brand-scoped unattributed cell may have no real order count; keep it unknown.
  const unattributedOrders = unattributedOrdersRaw === null ? null : Math.round(unattributedOrdersRaw)

  const branchDenomKwd =
    branchRowsRaw.reduce((s, r) => s + r.salesKwd, 0) + unattributedSalesKwd

  const mappedBranchPoints: SalesPoint[] = branchRowsRaw
    .map((r) =>
      toSalesPoint({
        id: r.lid,
        labelAr: getBranchLabel(r.lid as GlobalBranch, true),
        labelEn: getBranchLabel(r.lid as GlobalBranch, false),
        salesKwd: r.salesKwd,
        orders: r.orders,
        denominatorKwd: branchDenomKwd,
        color: '#10B981',
      }),
    )
    .sort((a, b) => b.salesKwd - a.salesKwd)

  const branchRanking: SalesPoint[] = branchesUnavailable
    ? []
    : filters.branch === 'all'
      ? [
          ...mappedBranchPoints,
          toSalesPoint({
            id: 'unattributed',
            labelAr: UNATTRIBUTED_BRANCH_LABEL_AR,
            labelEn: UNATTRIBUTED_BRANCH_LABEL_EN,
            tooltipTitleAr: `${UNATTRIBUTED_BRANCH_LABEL_AR} (أجهزة غير مربوطة بفرع محدد)`,
            tooltipTitleEn: `${UNATTRIBUTED_BRANCH_LABEL_EN} (unmapped POS configs)`,
            salesKwd: unattributedSalesKwd,
            orders: unattributedOrders,
            denominatorKwd: branchDenomKwd,
            color: '#F59E0B',
          }),
        ]
      : mappedBranchPoints

  // 5. Channel Ranking (from live POS channel classification)
  const channelsUnavailable = Boolean(!liveCube && activeBucket && activeBucket.uiChannels === null)
  const channelIds =
    filters.channel === 'all' ? [...APPROVED_CHANNEL_IDS] : [filters.channel]
  const channelRowsRaw = channelsUnavailable
    ? []
    : channelIds.map((cid) => {
        if (liveCube && filters.brand === 'all') {
          if (filters.branch !== 'all') {
            const ch = liveCube.byBranch?.[filters.branch]?.channels?.[cid]
            return { cid, salesKwd: safeNum(ch?.netKwd), orders: knownCount(ch?.orders) }
          }
          const ch = liveCube.byChannel?.[cid]
          return { cid, salesKwd: safeNum(ch?.netKwd), orders: knownCount(ch?.orders) }
        }
        if (filters.branch !== 'all') {
          const chLoc = activeBucket?.byLocation?.[filters.branch]?.uiChannels?.[cid]
          if (chLoc) {
            return { cid, salesKwd: safeNum(chLoc.netKwd), orders: safeNum(chLoc.orders) }
          }
        }
        const chBkt = activeBucket?.uiChannels?.[cid]
        if (chBkt) {
          return { cid, salesKwd: safeNum(chBkt.netKwd), orders: safeNum(chBkt.orders) }
        }
        const wsOpt = ws.cascadingOptions.channels.find((x) => x.id === cid)
        return { cid, salesKwd: safeNum(wsOpt?.salesKwd), orders: null }
      })
  const channelDenomKwd = channelRowsRaw.reduce((s, r) => s + r.salesKwd, 0)
  const channelRanking: SalesPoint[] = channelRowsRaw
    .map((r) =>
      toSalesPoint({
        id: r.cid,
        labelAr: getChannelLabel(r.cid, true),
        labelEn: getChannelLabel(r.cid, false),
        salesKwd: r.salesKwd,
        orders: r.orders,
        denominatorKwd: channelDenomKwd,
        color: r.cid === 'dine-in' || r.cid === 'takeaway-direct' ? '#10B981' : '#0EA5E9',
      }),
    )
    .sort((a, b) => b.salesKwd - a.salesKwd)

  const zeroCommRows = channelRanking.filter(
    (c) => c.id === 'dine-in' || c.id === 'takeaway-direct',
  )
  const aggregatorRows = channelRanking.filter(
    (c) => c.id !== 'dine-in' && c.id !== 'takeaway-direct',
  )
  const zeroCommSalesKwd = round3(zeroCommRows.reduce((s, r) => s + r.salesKwd, 0))
  const zeroCommDisplayKwd = Math.round(zeroCommSalesKwd)
  const zeroCommOrders = zeroCommRows.reduce((s, r) => s + (r.orders ?? 0), 0)
  const aggregatorSalesKwd = round3(aggregatorRows.reduce((s, r) => s + r.salesKwd, 0))
  const aggregatorDisplayKwd = Math.round(aggregatorSalesKwd)
  const aggregatorOrders = aggregatorRows.reduce((s, r) => s + (r.orders ?? 0), 0)
  const zeroCommSharePct =
    channelDenomKwd > 0 ? round1((zeroCommSalesKwd / channelDenomKwd) * 100) : 0
  const aggregatorSharePct =
    channelDenomKwd > 0 ? round1((aggregatorSalesKwd / channelDenomKwd) * 100) : 0

  // 6. Live Menu Products from `pos.order.line` (no invented BOM recipes)
  const rawProducts = (liveCube?.topProducts ?? []).filter((p) => {
    if (isExcludedOdooEntity(p.name)) return false
    if (!p.brandId || !APPROVED_BRAND_IDS.includes(p.brandId)) return false
    if (filters.brand !== 'all' && p.brandId !== filters.brand) return false
    return p.netKwd > 0 && p.qty > 0
  })

  const periodDaysSafe = Math.max(1, ws.periodDays)
  const dishes: MenuDishRow[] = rawProducts.map((p, idx) => {
    const brandId = p.brandId as Exclude<GlobalBrand, 'all'>
    const unitsSold = Math.max(1, Math.round(p.qty))
    const monthlyUnitsSold = Math.max(1, Math.round((unitsSold / periodDaysSafe) * 30))
    const salesKwd = round3(p.netKwd)
    const unitPriceKwd = unitsSold > 0 ? round3(salesKwd / unitsSold) : 0
    const tag: DishSimpleTag =
      idx < 10 ? 'golden' : p.avgDiscountPct >= 15 ? 'reprice' : unitsSold >= 20 ? 'box-gem' : 'slow'

    return {
      id: `sku-${p.productId}`,
      name: cleanDishName(p.name),
      brandId,
      brandAr: getBrandLabel(brandId, true),
      brandEn: getBrandLabel(brandId, false),
      category: 'POS',
      unitsSold,
      monthlyUnitsSold,
      unitPriceKwd,
      unitCostKwd: 0,
      salesKwd,
      costKwd: 0,
      netProfitKwd: 0,
      marginPct: 0,
      foodCostPct: 0,
      targetFoodCostPct: 0,
      costGapPct: 0,
      discountKwd: round3(p.discountKwd),
      avgDiscountPct: round2(p.avgDiscountPct),
      linesCount: p.linesCount,
      costCreepNoteAr: 'تكلفة الوصفة المعيارية (BOM) غير مربوطة بمصدر بيانات',
      costCreepNoteEn: 'Recipe BOM cost not linked to data source',
      tag,
      tagAr: tag === 'golden' ? 'الأعلى مبيعاً' : tag === 'reprice' ? 'خصم مرتفع' : tag === 'box-gem' ? 'حجم جيد' : 'دوران هادئ',
      tagEn: tag === 'golden' ? 'Top Seller' : tag === 'reprice' ? 'High Discount' : tag === 'box-gem' ? 'Steady Volume' : 'Low Volume',
      actionBadgeAr: 'بيانات مبيعات POS الفعلية',
      actionBadgeEn: 'Actual POS sales lines',
      recommendedDeltaPriceKwd: 0,
      recommendedCostSavePct: 0,
      recommendedRetentionPct: 100,
      recommendedPromoLiftPct: 0,
      conservativeMonthlyGainKwd: 0,
    }
  })

  const totalUnitsSold = dishes.reduce((s, d) => s + d.unitsSold, 0)
  const totalDishSalesKwd = round3(dishes.reduce((s, d) => s + d.salesKwd, 0))
  const totalDiscountKwd = round3(dishes.reduce((s, d) => s + d.discountKwd, 0))
  const quadrantCounts: Record<DishSimpleTag, number> = {
    golden: dishes.filter((d) => d.tag === 'golden').length,
    reprice: dishes.filter((d) => d.tag === 'reprice').length,
    'box-gem': dishes.filter((d) => d.tag === 'box-gem').length,
    slow: dishes.filter((d) => d.tag === 'slow').length,
  }

  const posDiscountsKwd = round3(liveCube?.totals.totalDiscountKwd ?? totalDiscountKwd)
  const posAvgDiscountPct = round2(liveCube?.totals.avgDiscountPct ?? 0)
  const posDiscountedLinesCount = liveCube?.totals.discountedLinesCount ?? 0

  const menuUnavailable = Boolean(
    !liveCube &&
      (brandsUnavailable ||
        unavailableSet.has('products') ||
        unavailableSet.has('pos.category')),
  )

  const headline: PeriodCubeHeadline = liveCube
    ? selectCubeHeadline(liveCube, {
        branch: filters.branch,
        brand: filters.brand,
        channel: filters.channel,
      })
    : {
        netSalesKwd: ws.nullableSalesKwd,
        orders: ws.nullableOrders,
        aovKwd: ws.nullableAovKwd,
      }

  return {
    connected: true,
    noData: false,
    lastSyncAt,
    isStale24h,
    dateRangeLabel,
    isSingleDayWindow,
    marketing: {
      evaluations,
      posDiscountsKwd,
      posAvgDiscountPct,
      posDiscountedLinesCount,
      loggedCampaignSpendKwd,
      kpis: {
        roasPer1Kwd: 0,
        promoAdSalesKwd: 0,
        organicSalesKwd: 0,
        promoSharePct: 0,
        totalMarketingCostKwd: posDiscountsKwd,
        marketingCostPctOfSales:
          ws.salesKwd > 0 ? round2((posDiscountsKwd / ws.salesKwd) * 100) : 0,
        netAfterAdSpendKwd: 0,
        netPocketAfterAdsKwd: 0,
        netPocketAfterAdsPct: 0,
        promoAovKwd: 0,
        organicAovKwd: 0,
        aovDeltaKwd: 0,
        aovDeltaPct: 0,
        incrementalOrders: 0,
      },
      chartPoints: [],
      growthPlays: [],
      dishOfTheWeek: null,
    },
    sales: {
      headline,
      hourlyUnavailable,
      hourlyReconciliation: liveCube ? hourlyReconciliation : null,
      channelsUnavailable,
      branchesUnavailable,
      brandsUnavailable,
      timelineScope,
      branchScope,
      peakHourLabelAr,
      peakHourLabelEn,
      peakHourShortAr,
      peakHourShortEn,
      peakHourSalesKwd,
      peakHourDisplayKwd,
      peakHourOrders,
      peakHourSharePct,
      strongestDayLabelAr,
      strongestDayLabelEn,
      quietWindowAr: '3:00 م – 6:00 م',
      quietWindowEn: '3:00 PM – 6:00 PM',
      quietWindowSalesKwd,
      quietWindowDisplayKwd,
      quietWindowOrders,
      quietWindowSharePct,
      quietWindowUpsideKwd: 0,
      zeroCommSalesKwd,
      zeroCommDisplayKwd,
      zeroCommSharePct,
      zeroCommOrders,
      aggregatorSalesKwd,
      aggregatorDisplayKwd,
      aggregatorSharePct,
      aggregatorOrders,
      directNetMarginPct: 0,
      aggregatorNetMarginPct: 0,
      unattributedSalesKwd,
      unattributedOrders,
      timeline,
      hourly,
      brandShare,
      branchRanking,
      channelRanking,
    },
    menu: {
      menuUnavailable,
      bomLinked: false,
      totalActiveSkus: dishes.length,
      totalUnitsSold,
      totalSalesKwd: totalDishSalesKwd,
      totalDiscountKwd,
      totalCostKwd: 0,
      totalNetProfitKwd: 0,
      avgMarginPct: 0,
      avgFoodCostPct: 0,
      effectiveChannelFeePct: 0,
      optimizationUpsideKwd: 0,
      topProfitDish: dishes[0] ?? null,
      topProfitHeroes: dishes.slice(0, 8),
      topMarginBleeders: [],
      quadrantCounts,
      dishes,
    },
    quality: {
      avgPlatformRating: 0,
      cancelledOrders: 0,
      cancelledKwd: 0,
      qualityScore: 0,
      repeatGuests: 0,
      identifiedGuests: 0,
      branchQuality: [],
      platformRatings: [],
    },
  }
}
