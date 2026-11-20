/**
 * Strategic Planning & Booth Feasibility Live Odoo Separation + AI Advisor Engine.
 *
 * Strictly separates:
 *  1) `Odoo Verified Actual` (`فعلي موثّق من أودو`) — read-only Odoo 17 POS & GL actuals
 *  2) `Manual What-If Input` (`مدخل محاكاة يدوي`) — interactive user simulator parameters
 *  3) `Deterministic Simulation` (`محاكاة رقمية حتمية`) — explicit formula-based projections
 *
 * Runtime-neutral (safe in both Next.js API routes and client studios).
 */

import {
  computePlanningHubSnapshot,
  computeStrategicPlanning,
  localizeArabicPlanningCopy,
  stripStrategicMarkdown,
  type ForecastHorizonId,
  type PlanningHubSnapshot,
  type StrategicRoadmapPhase,
} from '@/lib/aether/planning-engine'
import type { GlobalWorkspaceSlice } from '@/lib/aether/global-filter-engine'
import { GLOBAL_BRAND_OPTIONS } from '@/lib/aether/global-filter-engine'
import { branchLabel } from '@/lib/council/helpers'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import type { OdooBucketSummary, OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { isNonCompanyCatalogItem } from '@/lib/odoo/non-company-products'
import {
  ODOO_VERIFIED_ACTUALS_LABEL,
  PROPOSED_USER_INPUT_LABEL,
  reviewGroundedNumbers,
} from '@/server/ai/number-guard'

export { computePlanningHubSnapshot, computeStrategicPlanning }

export const LABEL_ODOO_ACTUAL = {
  en: 'Odoo Verified Actual',
  ar: 'فعلي موثّق من أودو',
} as const

export const LABEL_MANUAL_WHAT_IF = {
  en: 'Manual What-If Input',
  ar: 'مدخل محاكاة يدوي',
} as const

export const LABEL_DETERMINISTIC_SIM = {
  en: 'Deterministic Simulation',
  ar: 'محاكاة رقمية حتمية',
} as const

const ACTIVE_RESTAURANT_IDS = new Set([
  'avenues',
  '360-mall',
  'assima',
  'promenade',
  'salmiya',
  'al-kout',
  'ardiya',
])

export interface OdooVerifiedPlanningActuals {
  available: boolean
  periodFrom: string
  periodTo: string
  periodDays: number
  lastSyncAt: string | null
  activeNetSalesKwd: number
  activeOrders: number
  activeDailyRunRateKwd: number
  activeAovKwd: number | null
  month30dNetSalesKwd: number
  month30dOrders: number
  month30dDailyRunRateKwd: number
  month30dAovKwd: number | null
  ytdNetSalesKwd: number | null
  ytdOrders: number | null
  directSharePct: number
  aggregatorSharePct: number
  topBranch: {
    id: string
    labelAr: string
    labelEn: string
    netKwd: number
    orders: number
    sharePct: number
    dailyKwd: number
  } | null
  lowestBranch: {
    id: string
    labelAr: string
    labelEn: string
    netKwd: number
    orders: number
    sharePct: number
    dailyKwd: number
  } | null
  branchDailyMedianKwd: number | null
  branchDailyMedianOrders: number | null
  topBrand: {
    id: string
    labelAr: string
    labelEn: string
    netKwd: number
    orders: number | null
  } | null
  exhibitionsActuals: {
    available: boolean
    netKwd: number
    orders: number
    aovKwd: number | null
  }
}

export interface StrategicWhatIfInputs {
  targetGrowthPct: number
  directChannelShiftPct: number
  costEfficiencyPct: number
  horizonDays: number
  roadmapCostCapKwd: number
  roadmapMonthlyGainKwd: number
}

export interface StrategicWhatIfSimulationOutput {
  projectedSalesKwd: number
  projectedOrders: number
  projectedCostsKwd: number | null
  projectedNetCashKwd: number | null
  projectedMarginPct: number | null
  incrementalSalesDeltaKwd: number
  directCommissionProtectedVolumeKwd: number
  formulaEn: string
  formulaAr: string
}

export interface BoothWhatIfInputs {
  brandId: string
  brandLabelEn: string
  brandLabelAr: string
  days: number
  rentKwd: number
  setupKwd: number
  staffCount: number
  staffCostKwd: number
  avgTicketKwd: number
  foodCostPct: number
  expectedDailyOrders: number
}

export interface BoothSimulationSummary {
  fixedCostKwd: number
  gpPerOrderKwd: number
  breakEvenDailyOrders: number | null
  baseRevenueKwd: number
  baseProfitKwd: number
  conservativeProfitKwd: number
  upsideProfitKwd: number
  rentCeilingKwd: number
  rentSharePct: number
  verdict: 'go' | 'conditional' | 'walk'
}

export interface PlanningAdvisorRecommendation {
  id: string
  titleEn: string
  titleAr: string
  bodyEn: string
  bodyAr: string
  badgeEn: string
  badgeAr: string
}

export interface PlanningAdvisorResponsePayload {
  ok: true
  source: 'ai' | 'deterministic'
  modelLabelEn: string
  modelLabelAr: string
  updatedAtIso: string
  recommendations: PlanningAdvisorRecommendation[]
}

function r3(n: number): number {
  const v = Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0
  return Object.is(v, -0) ? 0 : v
}

function r1(n: number): number {
  const v = Number.isFinite(n) ? Math.round(n * 10) / 10 : 0
  return Object.is(v, -0) ? 0 : v
}

function fmtKwd(n: number): string {
  return r3(n).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

function fmtInt(n: number): string {
  return Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')
}

function resolveBrandLabels(brandId: string): { en: string; ar: string } {
  const found = GLOBAL_BRAND_OPTIONS.find((b) => b.id === brandId)
  if (found) return { en: found.en, ar: found.ar }
  return { en: brandId, ar: brandId }
}

/**
 * Extracts strictly read-only `Odoo Verified Actual` baseline metrics from `OdooLiveSummary`
 * and optional `GlobalWorkspaceSlice`. Zero invented numbers.
 */
export function extractOdooVerifiedPlanningActuals(
  liveSummary: OdooLiveSummary | null | undefined,
  workspace?: GlobalWorkspaceSlice | null,
): OdooVerifiedPlanningActuals {
  if (!liveSummary || liveSummary.connected === false || liveSummary.noData) {
    return {
      available: false,
      periodFrom: '',
      periodTo: '',
      periodDays: 0,
      lastSyncAt: null,
      activeNetSalesKwd: 0,
      activeOrders: 0,
      activeDailyRunRateKwd: 0,
      activeAovKwd: null,
      month30dNetSalesKwd: 0,
      month30dOrders: 0,
      month30dDailyRunRateKwd: 0,
      month30dAovKwd: null,
      ytdNetSalesKwd: null,
      ytdOrders: null,
      directSharePct: 0,
      aggregatorSharePct: 0,
      topBranch: null,
      lowestBranch: null,
      branchDailyMedianKwd: null,
      branchDailyMedianOrders: null,
      topBrand: null,
      exhibitionsActuals: { available: false, netKwd: 0, orders: 0, aovKwd: null },
    }
  }

  const monthBucket: OdooBucketSummary | null =
    liveSummary.buckets?.month ?? liveSummary.customBucket ?? null
  const yearBucket: OdooBucketSummary | null = liveSummary.buckets?.year ?? null

  const periodFrom =
    workspace?.dateRange?.from ?? monthBucket?.from ?? liveSummary.period?.from ?? ''
  const periodTo =
    workspace?.dateRange?.to ?? monthBucket?.to ?? liveSummary.period?.to ?? ''
  const periodDays = Math.max(1, workspace?.periodDays ?? monthBucket?.days ?? 30)
  const monthDays = Math.max(1, monthBucket?.days ?? periodDays)

  const activeNetSalesKwd = r3(
    workspace?.salesKwd ?? monthBucket?.totals.netSalesKwd ?? liveSummary.totals.netSalesKwd ?? 0,
  )
  const activeOrders = Math.max(
    0,
    Math.round(workspace?.orders ?? monthBucket?.totals.orders ?? liveSummary.totals.orders ?? 0),
  )
  const activeDailyRunRateKwd = r3(activeNetSalesKwd / periodDays)
  const activeAovKwd =
    workspace?.nullableAovKwd !== undefined && workspace.nullableAovKwd !== null
      ? r3(workspace.nullableAovKwd)
      : activeOrders > 0
        ? r3(activeNetSalesKwd / activeOrders)
        : null

  const month30dNetSalesKwd = r3(monthBucket?.totals.netSalesKwd ?? activeNetSalesKwd)
  const month30dOrders = Math.max(0, Math.round(monthBucket?.totals.orders ?? activeOrders))
  const month30dDailyRunRateKwd = r3(month30dNetSalesKwd / monthDays)
  const month30dAovKwd =
    monthBucket?.totals.aovKwd !== undefined && monthBucket.totals.aovKwd !== null
      ? r3(monthBucket.totals.aovKwd)
      : month30dOrders > 0
        ? r3(month30dNetSalesKwd / month30dOrders)
        : activeAovKwd

  const ytdRaw = yearBucket?.totals.netSalesKwd
  const ytdNetSalesKwd =
    typeof ytdRaw === 'number' && Number.isFinite(ytdRaw) && ytdRaw > 0.001 ? r3(ytdRaw) : null
  const ytdOrders =
    ytdNetSalesKwd !== null && typeof yearBucket?.totals.orders === 'number'
      ? Math.round(yearBucket.totals.orders)
      : null

  // Direct vs aggregator split
  let directKwd = 0
  let aggKwd = 0
  if (monthBucket?.uiChannels) {
    for (const [ch, val] of Object.entries(monthBucket.uiChannels)) {
      const kwd = Math.max(0, val?.netKwd ?? 0)
      if (ch === 'dine-in' || ch === 'takeaway-direct') directKwd += kwd
      else aggKwd += kwd
    }
  }
  const chTotal = directKwd + aggKwd
  const directSharePct = chTotal > 0 ? r1((directKwd / chTotal) * 100) : 0
  const aggregatorSharePct = chTotal > 0 ? r1((aggKwd / chTotal) * 100) : 0

  // Active restaurant branches
  const locMap = monthBucket?.mappedByLocation ?? monthBucket?.byLocation ?? null
  const branches: Array<{
    id: string
    labelAr: string
    labelEn: string
    netKwd: number
    orders: number
  }> = []

  if (locMap) {
    for (const [id, row] of Object.entries(locMap)) {
      if (!ACTIVE_RESTAURANT_IDS.has(id) || isExcludedOdooEntity(id)) continue
      const netKwd = r3(row?.netKwd ?? 0)
      const orders = Math.round(row?.orders ?? 0)
      if (netKwd <= 0.001 || orders <= 0) continue
      const lbl = branchLabel(id)
      branches.push({ id, labelAr: lbl.ar, labelEn: lbl.en, netKwd, orders })
    }
  } else if (Array.isArray(liveSummary.branches)) {
    for (const b of liveSummary.branches) {
      if (!ACTIVE_RESTAURANT_IDS.has(b.id) || isExcludedOdooEntity(b.id)) continue
      const netKwd = r3(b.netSalesKwd ?? 0)
      const orders = Math.round(b.orders ?? 0)
      if (netKwd <= 0.001 || orders <= 0) continue
      const lbl = branchLabel(b.id)
      branches.push({ id: b.id, labelAr: lbl.ar, labelEn: lbl.en, netKwd, orders })
    }
  }

  branches.sort((a, b) => b.netKwd - a.netKwd || a.id.localeCompare(b.id))
  const mappedTotal = branches.reduce((s, b) => s + b.netKwd, 0)
  const topB = branches[0] ?? null
  const lowB = branches.length >= 2 ? branches[branches.length - 1]! : null

  let branchDailyMedianKwd: number | null = null
  let branchDailyMedianOrders: number | null = null
  if (branches.length > 0) {
    const dailyNets = branches.map((b) => b.netKwd / monthDays).sort((a, b) => a - b)
    const dailyOrds = branches.map((b) => b.orders / monthDays).sort((a, b) => a - b)
    const mid = Math.floor(branches.length / 2)
    branchDailyMedianKwd = r3(
      branches.length % 2 === 1 ? dailyNets[mid]! : (dailyNets[mid - 1]! + dailyNets[mid]!) / 2,
    )
    branchDailyMedianOrders = r1(
      branches.length % 2 === 1 ? dailyOrds[mid]! : (dailyOrds[mid - 1]! + dailyOrds[mid]!) / 2,
    )
  }

  // Top brand
  let topBrand: OdooVerifiedPlanningActuals['topBrand'] = null
  if (monthBucket?.byBrand) {
    const brandList = Object.entries(monthBucket.byBrand)
      .filter(([id, v]) => !isExcludedOdooEntity(id) && (v?.netKwd ?? 0) > 0.001)
      .sort((a, b) => (b[1]?.netKwd ?? 0) - (a[1]?.netKwd ?? 0))
    if (brandList[0]) {
      const [id, v] = brandList[0]
      const lbl = resolveBrandLabels(id)
      topBrand = {
        id,
        labelAr: lbl.ar,
        labelEn: lbl.en,
        netKwd: r3(v.netKwd),
        orders: v.orders !== null && v.orders !== undefined ? Math.round(v.orders) : null,
      }
    }
  }

  // Exhibitions EXB actuals
  const exbRaw =
    monthBucket?.byLocation?.exhibitions ??
    yearBucket?.byLocation?.exhibitions ??
    null
  const exbBranchRow = Array.isArray(liveSummary.branches)
    ? liveSummary.branches.find((b) => b.id === 'exhibitions')
    : null
  const exbNetKwd = r3(exbRaw?.netKwd ?? exbBranchRow?.netSalesKwd ?? 0)
  const exbOrders = Math.max(0, Math.round(exbRaw?.orders ?? exbBranchRow?.orders ?? 0))
  const exbAvailable = exbNetKwd > 0.001

  return {
    available: activeNetSalesKwd > 0.001 || month30dNetSalesKwd > 0.001,
    periodFrom,
    periodTo,
    periodDays,
    lastSyncAt: liveSummary.lastSyncAt ?? liveSummary.syncedAt ?? null,
    activeNetSalesKwd,
    activeOrders,
    activeDailyRunRateKwd,
    activeAovKwd,
    month30dNetSalesKwd,
    month30dOrders,
    month30dDailyRunRateKwd,
    month30dAovKwd,
    ytdNetSalesKwd,
    ytdOrders,
    directSharePct,
    aggregatorSharePct,
    topBranch: topB
      ? {
          id: topB.id,
          labelAr: topB.labelAr,
          labelEn: topB.labelEn,
          netKwd: topB.netKwd,
          orders: topB.orders,
          sharePct: mappedTotal > 0 ? r1((topB.netKwd / mappedTotal) * 100) : 0,
          dailyKwd: r3(topB.netKwd / monthDays),
        }
      : null,
    lowestBranch: lowB
      ? {
          id: lowB.id,
          labelAr: lowB.labelAr,
          labelEn: lowB.labelEn,
          netKwd: lowB.netKwd,
          orders: lowB.orders,
          sharePct: mappedTotal > 0 ? r1((lowB.netKwd / mappedTotal) * 100) : 0,
          dailyKwd: r3(lowB.netKwd / monthDays),
        }
      : null,
    branchDailyMedianKwd,
    branchDailyMedianOrders,
    topBrand,
    exhibitionsActuals: {
      available: exbAvailable,
      netKwd: exbNetKwd,
      orders: exbOrders,
      aovKwd: exbAvailable && exbOrders > 0 ? r3(exbNetKwd / exbOrders) : null,
    },
  }
}

export function extractBrandOdooActual(
  liveSummary: OdooLiveSummary | null | undefined,
  brandId: string,
): { available: boolean; netKwd: number; orders: number | null; aovKwd: number | null } {
  if (!liveSummary || liveSummary.connected === false || liveSummary.noData) {
    return { available: false, netKwd: 0, orders: null, aovKwd: null }
  }
  const byBrand = liveSummary.buckets?.month?.byBrand
  const hit = byBrand?.[brandId]
  if (hit && hit.netKwd > 0.001) {
    const netKwd = r3(hit.netKwd)
    const orders = hit.orders !== null && hit.orders !== undefined ? Math.round(hit.orders) : null
    return {
      available: true,
      netKwd,
      orders,
      aovKwd: orders && orders > 0 ? r3(netKwd / orders) : null,
    }
  }
  const topHit = Array.isArray(liveSummary.brands)
    ? liveSummary.brands.find((b) => b.id === brandId)
    : null
  if (topHit && topHit.netKwd > 0.001) {
    return { available: true, netKwd: r3(topHit.netKwd), orders: null, aovKwd: null }
  }
  return { available: false, netKwd: 0, orders: null, aovKwd: null }
}

/**
 * Pure deterministic calculator for the custom What-If controls in Strategic Planning.
 */
export function computeWhatIfStrategicSimulation(
  snap: PlanningHubSnapshot,
  inputs: StrategicWhatIfInputs,
): StrategicWhatIfSimulationOutput {
  const months = Math.max(1 / 30, inputs.horizonDays / 30)
  const growthRatio = inputs.targetGrowthPct / 100
  const effRatio = inputs.costEfficiencyPct / 100
  const shiftRatio = inputs.directChannelShiftPct / 100

  const baseSales = snap.monthlyBaselineSalesKwd * months
  const roadmapSalesLift = inputs.roadmapMonthlyGainKwd * months * 0.85 * 0.2
  const projectedSalesKwd = r3(Math.max(0, baseSales * (1 + growthRatio) + roadmapSalesLift))
  const incrementalSalesDeltaKwd = r3(projectedSalesKwd - baseSales)

  const approxAov =
    snap.scenarios[1] && snap.scenarios[1].projectedOrders > 0
      ? snap.scenarios[1].projectedSalesKwd / snap.scenarios[1].projectedOrders
      : 5.5
  const projectedOrders = Math.max(1, Math.round(projectedSalesKwd / Math.max(0.5, approxAov)))

  const aggregatorBaseVolume = baseSales * Math.max(0, (100 - snap.directChannelSharePct) / 100)
  const directCommissionProtectedVolumeKwd = r3(aggregatorBaseVolume * shiftRatio)

  let projectedCostsKwd: number | null = null
  let projectedNetCashKwd: number | null = null
  let projectedMarginPct: number | null = null

  if (snap.accountingAvailable) {
    const baseCosts = snap.monthlyBaselineCostsKwd * months
    const varFactor = 1 + growthRatio * 0.58 - effRatio
    const capex = inputs.roadmapCostCapKwd * Math.min(1, months)
    const roadmapSaving = Math.min(baseCosts * 0.12, inputs.roadmapMonthlyGainKwd * months * 0.15)
    projectedCostsKwd = r3(Math.max(0, baseCosts * varFactor + capex - roadmapSaving))
    projectedNetCashKwd = r3(projectedSalesKwd - projectedCostsKwd)
    projectedMarginPct =
      projectedSalesKwd > 0 ? r1((projectedNetCashKwd / projectedSalesKwd) * 100) : 0
  }

  const formulaEn = `(${fmtInt(snap.monthlyBaselineSalesKwd)} KWD × ${months.toFixed(1)}m) × (1 + ${r1(inputs.targetGrowthPct)}%) + Roadmap Lift = ${fmtKwd(projectedSalesKwd)} KWD`
  const formulaAr = localizeArabicPlanningCopy(
    `(${fmtInt(snap.monthlyBaselineSalesKwd)} د.ك × ${months.toFixed(1)} شهر) × (1 + ${r1(inputs.targetGrowthPct)}%) + أثر المراحل = ${fmtKwd(projectedSalesKwd)} د.ك`,
  )

  return {
    projectedSalesKwd,
    projectedOrders,
    projectedCostsKwd,
    projectedNetCashKwd,
    projectedMarginPct,
    incrementalSalesDeltaKwd,
    directCommissionProtectedVolumeKwd,
    formulaEn,
    formulaAr,
  }
}

/**
 * Deterministic Odoo-grounded CFO/COO strategic recommendations for Strategic Planning
 * (used immediately and whenever LLM keys are absent or time out).
 */
export function buildStrategicAdvisorFallback(input: {
  actuals: OdooVerifiedPlanningActuals
  whatIf: StrategicWhatIfInputs
  sim: StrategicWhatIfSimulationOutput
}): PlanningAdvisorRecommendation[] {
  const { actuals, whatIf, sim } = input
  const recs: PlanningAdvisorRecommendation[] = []

  recs.push({
    id: 'rec-growth-pacing',
    titleEn: '1. Baseline Velocity vs What-If Growth Pacing',
    titleAr: '1. مواءمة معدل الدوران الفعلي مع النمو المستهدف',
    badgeEn: `${whatIf.targetGrowthPct >= 0 ? '+' : ''}${r1(whatIf.targetGrowthPct)}% What-If -> ${fmtKwd(sim.projectedSalesKwd)} KWD`,
    badgeAr: `${whatIf.targetGrowthPct >= 0 ? '+' : ''}${r1(whatIf.targetGrowthPct)}% محاكاة ← ${fmtKwd(sim.projectedSalesKwd)} د.ك`,
    bodyEn: `${ODOO_VERIFIED_ACTUALS_LABEL}: 30d POS net sales stand at ${fmtKwd(actuals.month30dNetSalesKwd)} KWD (${fmtKwd(actuals.month30dDailyRunRateKwd)} KWD/day${actuals.month30dAovKwd ? `, AOV ${fmtKwd(actuals.month30dAovKwd)} KWD` : ''}). Under your ${PROPOSED_USER_INPUT_LABEL} target of ${r1(whatIf.targetGrowthPct)}% over ${whatIf.horizonDays} days, projected sales reach ${fmtKwd(sim.projectedSalesKwd)} KWD (${sim.incrementalSalesDeltaKwd >= 0 ? '+' : ''}${fmtKwd(sim.incrementalSalesDeltaKwd)} KWD delta)${actuals.topBranch && actuals.lowestBranch ? ` — prioritize replicating ${actuals.topBranch.labelEn} (${fmtKwd(actuals.topBranch.netKwd)} KWD) combo attachment into ${actuals.lowestBranch.labelEn} (${fmtKwd(actuals.lowestBranch.netKwd)} KWD)` : ''}.`,
    bodyAr: localizeArabicPlanningCopy(
      `فعلي موثّق من أودو: سجل صافي مبيعات 30 يوماً ${fmtKwd(actuals.month30dNetSalesKwd)} د.ك بمعدل يومي ${fmtKwd(actuals.month30dDailyRunRateKwd)} د.ك${actuals.month30dAovKwd ? ` ومتوسط فاتورة ${fmtKwd(actuals.month30dAovKwd)} د.ك` : ''}. وعند تطبيق مدخل المحاكاة اليدوي (${r1(whatIf.targetGrowthPct)}% خلال ${whatIf.horizonDays} يوماً) تصل المبيعات المحاكاة إلى ${fmtKwd(sim.projectedSalesKwd)} د.ك${actuals.topBranch && actuals.lowestBranch ? ` — يُوصى بنقل رافعة متوسط الفاتورة من ${actuals.topBranch.labelAr} (${fmtKwd(actuals.topBranch.netKwd)} د.ك) إلى ${actuals.lowestBranch.labelAr} (${fmtKwd(actuals.lowestBranch.netKwd)} د.ك)` : ''}.`,
    ),
  })

  recs.push({
    id: 'rec-channel-shield',
    titleEn: '2. Direct Channel Margin Protection & Aggregator Cap',
    titleAr: '2. حماية القنوات المباشرة وضبط التعرض للمنصات',
    badgeEn: `${r1(actuals.directSharePct)}% Direct Actual · +${r1(whatIf.directChannelShiftPct)}% Shift`,
    badgeAr: `${r1(actuals.directSharePct)}% مباشر فعلي · +${r1(whatIf.directChannelShiftPct)}% تحويل`,
    bodyEn: `${ODOO_VERIFIED_ACTUALS_LABEL}: Zero-commission Dine-In & Direct currently represent ${r1(actuals.directSharePct)}% of channel sales vs ${r1(actuals.aggregatorSharePct)}% on delivery platforms. Executing your ${PROPOSED_USER_INPUT_LABEL} ${r1(whatIf.directChannelShiftPct)}% direct shift protects ${fmtKwd(sim.directCommissionProtectedVolumeKwd)} KWD of horizon volume from platform deductions${actuals.topBrand ? ` led by ${actuals.topBrand.labelEn} (${fmtKwd(actuals.topBrand.netKwd)} KWD)` : ''}.`,
    bodyAr: localizeArabicPlanningCopy(
      `فعلي موثّق من أودو: تبلغ حصة الصالة والطلب المباشر صفرية العمولة حالياً ${r1(actuals.directSharePct)}% مقابل ${r1(actuals.aggregatorSharePct)}% لمنصات التوصيل. تحقيق مدخل التحويل اليدوي (+${r1(whatIf.directChannelShiftPct)}%) يحمي حجماً تشغيلياً قدره ${fmtKwd(sim.directCommissionProtectedVolumeKwd)} د.ك من استقطاعات المنصات${actuals.topBrand ? ` بقيادة علامة ${actuals.topBrand.labelAr} (${fmtKwd(actuals.topBrand.netKwd)} د.ك)` : ''}.`,
    ),
  })

  recs.push({
    id: 'rec-capex-governance',
    titleEn: '3. Cost Cap Discipline & Ardiya Central Kitchen Execution',
    titleAr: '3. حوكمة سقف التكلفة وتشغيل مطبخ العارضية المركزي',
    badgeEn:
      sim.projectedNetCashKwd !== null
        ? `Sim Net: ${fmtKwd(sim.projectedNetCashKwd)} KWD`
        : `Cap: ${fmtKwd(whatIf.roadmapCostCapKwd)} KWD`,
    badgeAr:
      sim.projectedNetCashKwd !== null
        ? `صافي محاكاة: ${fmtKwd(sim.projectedNetCashKwd)} د.ك`
        : `سقف: ${fmtKwd(whatIf.roadmapCostCapKwd)} د.ك`,
    bodyEn:
      sim.projectedNetCashKwd !== null && sim.projectedCostsKwd !== null
        ? `With ${PROPOSED_USER_INPUT_LABEL} ${r1(whatIf.costEfficiencyPct)}% cost efficiency and ${fmtKwd(whatIf.roadmapCostCapKwd)} KWD phase cap, simulated horizon costs total ${fmtKwd(sim.projectedCostsKwd)} KWD for a net cash projection of ${fmtKwd(sim.projectedNetCashKwd)} KWD (${r1(sim.projectedMarginPct ?? 0)}%). Gate phase spend weekly against posted Odoo vendor bills.`
        : `Under ${PROPOSED_USER_INPUT_LABEL} ${fmtKwd(whatIf.roadmapCostCapKwd)} KWD phase cost cap and ${fmtKwd(whatIf.roadmapMonthlyGainKwd)} KWD/mo target upside, track central prep dispatches from Ardiya and withhold cost-margin assumptions until Odoo GL expense lines are fully posted (integration user 225 never estimates standard_price).`,
    bodyAr: localizeArabicPlanningCopy(
      sim.projectedNetCashKwd !== null && sim.projectedCostsKwd !== null
        ? `مع مدخل كفاءة التكاليف (${r1(whatIf.costEfficiencyPct)}%) وسقف المراحل اليدوي (${fmtKwd(whatIf.roadmapCostCapKwd)} د.ك)، تبلغ التكاليف المحاكاة ${fmtKwd(sim.projectedCostsKwd)} د.ك وصافي التدفق التقديري ${fmtKwd(sim.projectedNetCashKwd)} د.ك (${r1(sim.projectedMarginPct ?? 0)}%). يُشترط ربط الصرف الأسبوعي بفواتير الموردين المرحّلة في أودو.`
        : `ضمن سقف التكلفة اليدوي (${fmtKwd(whatIf.roadmapCostCapKwd)} د.ك) والعائد المستهدف (${fmtKwd(whatIf.roadmapMonthlyGainKwd)} د.ك/شهر)، تتم متابعة التحضير المركزي في العارضية مع عدم افتراض أي تكلفة معيارية غير مقروءة لمستخدم أودو 225 لحين اكتمال ترحيل قيود المصروفات.`,
    ),
  })

  return recs
}

/**
 * Deterministic Odoo-grounded CFO/COO recommendations for Booth Feasibility (`BoothStudyV5`).
 */
export function buildBoothAdvisorFallback(input: {
  actuals: OdooVerifiedPlanningActuals
  brandActual: { available: boolean; netKwd: number; orders: number | null; aovKwd: number | null }
  boothInputs: BoothWhatIfInputs
  sim: BoothSimulationSummary
}): PlanningAdvisorRecommendation[] {
  const { actuals, brandActual, boothInputs, sim } = input
  const beText = sim.breakEvenDailyOrders !== null ? fmtInt(sim.breakEvenDailyOrders) : '0'

  const exbBenchmarkEn = actuals.exhibitionsActuals.available
    ? `verified Odoo Exhibitions (EXB) actuals recorded ${fmtKwd(actuals.exhibitionsActuals.netKwd)} KWD across ${fmtInt(actuals.exhibitionsActuals.orders)} orders`
    : actuals.branchDailyMedianKwd !== null
      ? `active Venture Foods branch median velocity is ${fmtKwd(actuals.branchDailyMedianKwd)} KWD/day (${r1(actuals.branchDailyMedianOrders ?? 0)} orders/day)`
      : `company 30d POS velocity is ${fmtKwd(actuals.month30dDailyRunRateKwd)} KWD/day`

  const exbBenchmarkAr = actuals.exhibitionsActuals.available
    ? `سجلت بوثات مطبخ العارضية المركزي المتنقلة في أودو ${fmtKwd(actuals.exhibitionsActuals.netKwd)} د.ك عبر ${fmtInt(actuals.exhibitionsActuals.orders)} طلب`
    : actuals.branchDailyMedianKwd !== null
      ? `يبلغ وسيط مبيعات الفروع النشطة في أودو ${fmtKwd(actuals.branchDailyMedianKwd)} د.ك/يوم (${r1(actuals.branchDailyMedianOrders ?? 0)} طلب/يوم)`
      : `يبلغ المعدل اليومي لمبيعات الشركة في أودو ${fmtKwd(actuals.month30dDailyRunRateKwd)} د.ك/يوم`

  return [
    {
      id: 'booth-rec-verdict',
      titleEn: '1. Rent Negotiation & 60% Stress-Test Gate',
      titleAr: '1. سقف التفاوض على الإيجار واختبار الضغط (60%)',
      badgeEn: `Rent ${fmtKwd(boothInputs.rentKwd)} vs Ceiling ${fmtKwd(sim.rentCeilingKwd)} KWD`,
      badgeAr: `الإيجار ${fmtKwd(boothInputs.rentKwd)} مقابل السقف ${fmtKwd(sim.rentCeilingKwd)} د.ك`,
      bodyEn: `Under ${PROPOSED_USER_INPUT_LABEL} (${fmtInt(boothInputs.days)} days, ${fmtKwd(boothInputs.rentKwd)} KWD rent, ${fmtInt(boothInputs.expectedDailyOrders)} orders/day at ${fmtKwd(boothInputs.avgTicketKwd)} KWD ticket), break-even requires ${beText} orders/day and base net is ${fmtKwd(sim.baseProfitKwd)} KWD (60% traffic net: ${fmtKwd(sim.conservativeProfitKwd)} KWD). ${boothInputs.rentKwd > sim.rentCeilingKwd ? `Negotiate fixed rent down to ${fmtKwd(sim.rentCeilingKwd)} KWD or convert the excess into a revenue-share cap.` : `Rent sits safely inside the 60% traffic break-even ceiling of ${fmtKwd(sim.rentCeilingKwd)} KWD.`}`,
      bodyAr: localizeArabicPlanningCopy(
        `بناءً على مدخل المحاكاة اليدوي (${fmtInt(boothInputs.days)} يوم، إيجار ${fmtKwd(boothInputs.rentKwd)} د.ك، ${fmtInt(boothInputs.expectedDailyOrders)} طلب/يوم بمتوسط ${fmtKwd(boothInputs.avgTicketKwd)} د.ك)، تتطلب نقطة التعادل ${beText} طلب/يوم بصافي أساسي ${fmtKwd(sim.baseProfitKwd)} د.ك (وصافي عند إقبال 60%: ${fmtKwd(sim.conservativeProfitKwd)} د.ك). ${boothInputs.rentKwd > sim.rentCeilingKwd ? `يُوصى بالتفاوض لخفض الإيجار الثابت إلى ${fmtKwd(sim.rentCeilingKwd)} د.ك أو ربط الفارق بنسبة مبيعات مشروطة.` : `يقع الإيجار ضمن السقف الآمن لسيناريو التحفظ البالغ ${fmtKwd(sim.rentCeilingKwd)} د.ك.`}`,
      ),
    },
    {
      id: 'booth-rec-odoo-calibration',
      titleEn: `2. Calibration vs ${boothInputs.brandLabelEn} & Odoo Actuals`,
      titleAr: `2. معايرة الفرضيات مقابل فعليات ${boothInputs.brandLabelAr} في أودو`,
      badgeEn: brandActual.available
        ? `${boothInputs.brandLabelEn} 30d: ${fmtKwd(brandActual.netKwd)} KWD`
        : `Odoo AOV: ${fmtKwd(actuals.month30dAovKwd ?? boothInputs.avgTicketKwd)} KWD`,
      badgeAr: brandActual.available
        ? `فعلي ${boothInputs.brandLabelAr}: ${fmtKwd(brandActual.netKwd)} د.ك`
        : `متوسط أودو: ${fmtKwd(actuals.month30dAovKwd ?? boothInputs.avgTicketKwd)} د.ك`,
      bodyEn: `${ODOO_VERIFIED_ACTUALS_LABEL}: ${exbBenchmarkEn}${brandActual.available ? `, while ${boothInputs.brandLabelEn} generated ${fmtKwd(brandActual.netKwd)} KWD in the latest 30d window${brandActual.aovKwd ? ` (realized AOV ${fmtKwd(brandActual.aovKwd)} KWD vs your ${fmtKwd(boothInputs.avgTicketKwd)} KWD input)` : ''}` : ''}. Keep booth menu focused on top 6 fast-assembly SKUs prepped at Ardiya Central Kitchen to sustain peak queue throughput.`,
      bodyAr: localizeArabicPlanningCopy(
        `فعلي موثّق من أودو: ${exbBenchmarkAr}${brandActual.available ? `، فيما حققت علامة ${boothInputs.brandLabelAr} مبيعات فعلية قدرها ${fmtKwd(brandActual.netKwd)} د.ك خلال آخر 30 يوماً${brandActual.aovKwd ? ` (متوسط فاتورة فعلي ${fmtKwd(brandActual.aovKwd)} د.ك مقابل ${fmtKwd(boothInputs.avgTicketKwd)} د.ك مدخل يدوي)` : ''}` : ''}. يُنصح بقصر منيو البوث على 6 أصناف سريعة التسليم محضّرة مسبقاً في مطبخ العارضية المركزي.`,
      ),
    },
    {
      id: 'booth-rec-ops',
      titleEn: '3. Staffing, POS Register Isolation & Cash Control',
      titleAr: '3. ضبط الطاقم وعزل نقطة البيع في أودو',
      badgeEn: `Fixed Envelope: ${fmtKwd(sim.fixedCostKwd)} KWD`,
      badgeAr: `إجمالي الثابت: ${fmtKwd(sim.fixedCostKwd)} د.ك`,
      bodyEn: `Total entered fixed commitment is ${fmtKwd(sim.fixedCostKwd)} KWD (${fmtKwd(boothInputs.setupKwd)} KWD setup + ${fmtKwd(boothInputs.staffCostKwd)} KWD staff + ${fmtKwd(boothInputs.rentKwd)} KWD rent, ${r1(sim.rentSharePct)}% rent-to-sales). Assign a dedicated exhibition pos.config terminal in Odoo 17 before day 1 so every KNET and cash receipt reconciles independently.`,
      bodyAr: localizeArabicPlanningCopy(
        `يبلغ إجمالي الالتزام الثابت المدخل ${fmtKwd(sim.fixedCostKwd)} د.ك (${fmtKwd(boothInputs.setupKwd)} د.ك تجهيز + ${fmtKwd(boothInputs.staffCostKwd)} د.ك طاقم + ${fmtKwd(boothInputs.rentKwd)} د.ك إيجار بنسبة ${r1(sim.rentSharePct)}% من المبيعات المحاكاة). يجب تخصيص نقطة بيع مستقلة في أودو 17 قبل الافتتاح لقياس ربحية البوث الفعلية بدقة.`,
      ),
    },
  ]
}

/**
 * Validates AI-generated advisor recommendations strictly against `reviewGroundedNumbers`
 * and excluded-entity / non-company item filters.
 */
export function validateGroundedAdvisorSections(
  rawJsonText: string,
  facts: unknown,
  userInputs: readonly string[],
  fallback: readonly PlanningAdvisorRecommendation[],
): PlanningAdvisorRecommendation[] | null {
  const start = rawJsonText.indexOf('{')
  const end = rawJsonText.lastIndexOf('}')
  if (start < 0 || end <= start) return null

  let parsed: {
    recommendations?: Array<{
      titleEn?: string
      titleAr?: string
      bodyEn?: string
      bodyAr?: string
    }>
  }
  try {
    parsed = JSON.parse(rawJsonText.slice(start, end + 1)) as typeof parsed
  } catch {
    return null
  }

  const items = parsed.recommendations
  if (!Array.isArray(items) || items.length < 2) return null

  const validated: PlanningAdvisorRecommendation[] = []
  for (let i = 0; i < Math.min(3, fallback.length); i++) {
    const base = fallback[i]!
    const cand = items[i]
    if (!cand) {
      validated.push(base)
      continue
    }
    const cleanEn = stripStrategicMarkdown(String(cand.bodyEn ?? '')).trim()
    const cleanAr = localizeArabicPlanningCopy(
      stripStrategicMarkdown(String(cand.bodyAr ?? '')).trim(),
    )
    const guardedEn =
      cleanEn.length >= 40 &&
      !isExcludedOdooEntity(cleanEn) &&
      !isNonCompanyCatalogItem(null, cleanEn) &&
      reviewGroundedNumbers(`${PROPOSED_USER_INPUT_LABEL}: ${cleanEn}`, facts, { userInputs }).ok
    const guardedAr =
      cleanAr.length >= 40 &&
      !isExcludedOdooEntity(cleanAr) &&
      !isNonCompanyCatalogItem(null, cleanAr) &&
      reviewGroundedNumbers(`${PROPOSED_USER_INPUT_LABEL}: ${cleanAr}`, facts, { userInputs }).ok

    if (!guardedEn && !guardedAr) return null

    const candTitleEn = stripStrategicMarkdown(String(cand.titleEn ?? '')).trim()
    const candTitleAr = localizeArabicPlanningCopy(
      stripStrategicMarkdown(String(cand.titleAr ?? '')).trim(),
    )

    validated.push({
      id: base.id,
      titleEn:
        candTitleEn.length >= 6 && !isExcludedOdooEntity(candTitleEn)
          ? candTitleEn
          : base.titleEn,
      titleAr:
        candTitleAr.length >= 6 && !isExcludedOdooEntity(candTitleAr)
          ? candTitleAr
          : base.titleAr,
      bodyEn: guardedEn ? cleanEn : base.bodyEn,
      bodyAr: guardedAr ? cleanAr : base.bodyAr,
      badgeEn: base.badgeEn,
      badgeAr: base.badgeAr,
    })
  }

  return validated
}

export type { ForecastHorizonId, PlanningHubSnapshot, StrategicRoadmapPhase }
