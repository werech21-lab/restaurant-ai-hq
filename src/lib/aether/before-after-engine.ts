/**
 * Live Odoo Before-vs-After Comparison Engine (`src/lib/aether/before-after-engine.ts`)
 *
 * Evaluates Before ("قبل" / Period B) vs After ("بعد" / Period A) strictly from live
 * Odoo 17 period cubes (`OdooPeriodCube`), delegating slice, branch (7 branches +
 * standalone 8th «غير منسوب لفرع»), brand (6 brands), channel, and hourly/daily
 * bucket math to `computeErpComparison`.
 *
 * Strict Guarantees:
 *   - Zero static dataset imports, journey JSON files, or hardcoded milestones.
 *   - Zero synthetic multipliers on sales, brands, channels, or hours.
 *   - GL profit is reported only when complete accrual entries are posted in
 *     Odoo `account.move.line`; otherwise `glIncomplete: true` with
 *     `قيود غير مكتملة لهذه الفترة`.
 */

import {
  DEFAULT_GLOBAL_FILTERS,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import type { SocialCampaign } from '@/lib/aether/social-campaigns'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import {
  computeErpComparison,
  sanitizeIsoDate,
  shiftIsoDate,
  type BranchEntityId,
  type BrandEntityId,
  type ChannelEntityId,
  type ComparisonGranularity,
  type EntityVarianceRow,
  type ErpComparisonQuery,
} from '@/lib/erp-comparison-engine'
import { getKuwaitTimeContext } from '@/lib/aether/period-delta'

export type GlobalFilterState = GlobalFilters

export type ComparisonMode =
  | 'period-prev'
  | 'day-vs-day'
  | 'week-vs-week'
  | 'month-vs-month'
  | 'event'

export interface ApprovedDecisionItem {
  id: string
  approvedAt: string
  monthlyKwd: number
  titleAr: string
  titleEn: string
}

export interface ComparisonEventOption {
  id: string
  kind: 'campaign' | 'decision' | 'milestone'
  dateIso: string
  titleAr: string
  titleEn: string
  brand: GlobalBrand
  branch: GlobalBranch
  channel: GlobalChannel
  expectedMonthlyKwd: number
  noteAr: string
  noteEn: string
}

export interface MetricDeltaPair {
  before: number
  after: number
  deltaAbs: number
  deltaPct: number
  available?: boolean
}

export interface ComparisonTableRow {
  id: string
  nameAr: string
  nameEn: string
  subtitleAr?: string
  subtitleEn?: string
  isUnattributed?: boolean
  accountingAvailable: boolean
  beforeSalesKwd: number
  afterSalesKwd: number
  salesDeltaKwd: number
  salesDeltaPct: number
  beforeOrders: number
  afterOrders: number
  ordersDeltaPct: number
  beforePocketKwd: number
  afterPocketKwd: number
  pocketDeltaKwd: number
  pocketDeltaPct: number
  marginAfterPct: number
  marginDeltaPp: number
  verdict: 'improved' | 'declined' | 'steady'
}

export interface BeforeAfterLiveCubesInput {
  afterCube?: OdooPeriodCube | null
  beforeCube?: OdooPeriodCube | null
  cubeA?: OdooPeriodCube | null
  cubeB?: OdooPeriodCube | null
}

export interface BeforeAfterSnapshot {
  connected: boolean
  noData: boolean
  messageAr?: string
  glIncomplete: boolean
  glWarningAr: string | null
  mode: ComparisonMode
  beforeLabelAr: string
  beforeLabelEn: string
  afterLabelAr: string
  afterLabelEn: string
  daysCompared: number
  periodBefore: { from: string; to: string }
  periodAfter: { from: string; to: string }
  activeEvent: ComparisonEventOption | null
  availableEvents: ComparisonEventOption[]
  summary: {
    sales: MetricDeltaPair
    orders: MetricDeltaPair
    aov: MetricDeltaPair
    pocketProfit: MetricDeltaPair
    marginBeforePct: number
    marginAfterPct: number
    marginDeltaPp: number
    unattributedBeforeKwd: number
    unattributedAfterKwd: number
    unattributedBeforeOrders: number
    unattributedAfterOrders: number
    overallVerdict: 'improved' | 'declined' | 'steady'
    headlineAr: string
    headlineEn: string
    explanationAr: string
    explanationEn: string
  }
  byBrandRows: ComparisonTableRow[]
  byBranchRows: ComparisonTableRow[]
  byChannelRows: ComparisonTableRow[]
}

const NO_DATA_AR = 'لا توجد بيانات من Odoo لهذه الفترة'
const NO_DATA_EN = 'No data from Odoo for this period'
const GL_INCOMPLETE_AR = 'قيود غير مكتملة لهذه الفترة'

function round1(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 10) / 10
}

function round2(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100
}

function safePct(before: number, after: number): number {
  if (Math.abs(before) < 0.01) return after > 0 ? 100 : 0
  return round1(((after - before) / Math.abs(before)) * 100)
}

function pair(
  before: number,
  after: number,
  decimals: 0 | 1 | 2 = 0,
  available = true,
): MetricDeltaPair {
  const b =
    decimals === 2 ? round2(before) : decimals === 1 ? round1(before) : Math.round(before)
  const a =
    decimals === 2 ? round2(after) : decimals === 1 ? round1(after) : Math.round(after)
  return {
    before: b,
    after: a,
    deltaAbs:
      decimals === 2 ? round2(a - b) : decimals === 1 ? round1(a - b) : Math.round(a - b),
    deltaPct: safePct(before, after),
    available,
  }
}

function verdictFrom(salesPct: number): 'improved' | 'declined' | 'steady' {
  if (salesPct >= 1.5) return 'improved'
  if (salesPct <= -1.5) return 'declined'
  return 'steady'
}

function computePreviousFullMonthWindow(anchorIso: string): { from: string; to: string } {
  const [y, m] = anchorIso.split('-').map(Number)
  const firstPrev = new Date(Date.UTC(y || 2026, (m || 1) - 2, 1))
  const lastPrev = new Date(
    Date.UTC(firstPrev.getUTCFullYear(), firstPrev.getUTCMonth() + 1, 0),
  )
  return {
    from: firstPrev.toISOString().slice(0, 10),
    to: lastPrev.toISOString().slice(0, 10),
  }
}

export function buildBeforeAfterEvents(
  campaigns: SocialCampaign[],
  decisions: ApprovedDecisionItem[],
): ComparisonEventOption[] {
  const ctx = getKuwaitTimeContext()
  const list: ComparisonEventOption[] = []

  for (const c of campaigns) {
    const startRaw = c.startDate || c.date
    if (!startRaw) continue
    const titleAr = c.campaignName || 'حملة تسويقية'
    const titleEn = c.campaignNameEn || c.campaignName || 'Marketing Campaign'
    list.push({
      id: `camp-${c.id}`,
      kind: 'campaign',
      dateIso: sanitizeIsoDate(startRaw, ctx.yesterdayIso),
      titleAr: `حملة: ${titleAr}`,
      titleEn: `Campaign: ${titleEn}`,
      brand: c.brand,
      branch: c.branch ?? 'all',
      channel: 'all',
      expectedMonthlyKwd: Math.max(0, Math.round(c.spendKwd || 0)),
      noteAr: `${c.promotedItem || 'حملة رقمية'} · الإنفاق المسجل ${Math.round(c.spendKwd || 0).toLocaleString('en-US')} د.ك`,
      noteEn: `${c.promotedItem || 'Digital campaign'} · Logged spend ${Math.round(c.spendKwd || 0).toLocaleString('en-US')} KWD`,
    })
  }

  for (const d of decisions) {
    const iso = sanitizeIsoDate((d.approvedAt || '').slice(0, 10), ctx.yesterdayIso)
    list.push({
      id: `dec-${d.id}`,
      kind: 'decision',
      dateIso: iso,
      titleAr: `قرار معتمد: ${d.titleAr}`,
      titleEn: `Approved Decision: ${d.titleEn || d.titleAr}`,
      brand: 'all',
      branch: 'all',
      channel: 'all',
      expectedMonthlyKwd: d.monthlyKwd || 0,
      noteAr: `اعتمد بتاريخ ${iso}`,
      noteEn: `Approved on ${iso}`,
    })
  }

  return list.sort((a, b) => b.dateIso.localeCompare(a.dateIso))
}

export function resolveBeforeAfterWindows(
  filters: GlobalFilters = DEFAULT_GLOBAL_FILTERS,
  mode: ComparisonMode = 'period-prev',
  activeEvent: ComparisonEventOption | null = null,
): {
  granularity: ComparisonGranularity
  periodAfter: { from: string; to: string }
  periodBefore: { from: string; to: string }
} {
  const ctx = getKuwaitTimeContext()
  const yesterday = ctx.yesterdayIso
  const dayBefore = shiftIsoDate(yesterday, -1)

  if (mode === 'day-vs-day') {
    return {
      granularity: 'single',
      periodAfter: { from: yesterday, to: yesterday },
      periodBefore: { from: dayBefore, to: dayBefore },
    }
  }

  if (mode === 'week-vs-week') {
    const afterFrom = shiftIsoDate(yesterday, -6)
    const beforeTo = shiftIsoDate(afterFrom, -1)
    const beforeFrom = shiftIsoDate(beforeTo, -6)
    return {
      granularity: 'range',
      periodAfter: { from: afterFrom, to: yesterday },
      periodBefore: { from: beforeFrom, to: beforeTo },
    }
  }

  if (mode === 'month-vs-month') {
    const curMonthFirst = `${yesterday.slice(0, 8)}01`
    const prevMonth = computePreviousFullMonthWindow(yesterday)
    return {
      granularity: 'range',
      periodAfter: { from: curMonthFirst, to: yesterday },
      periodBefore: prevMonth,
    }
  }

  if (mode === 'event' && activeEvent) {
    const anchor = sanitizeIsoDate(activeEvent.dateIso, yesterday)
    const afterToRaw = shiftIsoDate(anchor, 6)
    const afterTo = afterToRaw > yesterday ? yesterday : afterToRaw
    const afterFrom = anchor > afterTo ? afterTo : anchor
    const beforeTo = shiftIsoDate(afterFrom, -1)
    const beforeFrom = shiftIsoDate(beforeTo, -6)
    return {
      granularity: 'range',
      periodAfter: { from: afterFrom, to: afterTo },
      periodBefore: { from: beforeFrom, to: beforeTo },
    }
  }

  const period = filters.period ?? 'month'
  if (period === 'today') {
    return {
      granularity: 'single',
      periodAfter: { from: yesterday, to: yesterday },
      periodBefore: { from: dayBefore, to: dayBefore },
    }
  }
  if (period === 'week') {
    const afterFrom = shiftIsoDate(yesterday, -6)
    const beforeTo = shiftIsoDate(afterFrom, -1)
    const beforeFrom = shiftIsoDate(beforeTo, -6)
    return {
      granularity: 'range',
      periodAfter: { from: afterFrom, to: yesterday },
      periodBefore: { from: beforeFrom, to: beforeTo },
    }
  }
  if (period === 'custom') {
    const f = sanitizeIsoDate(filters.customFrom, shiftIsoDate(yesterday, -6))
    const rawT = sanitizeIsoDate(filters.customTo, yesterday)
    const t = rawT > yesterday ? yesterday : rawT
    const fromIso = f <= t ? f : t
    const toIso = f <= t ? t : f
    const startMs = Date.parse(`${fromIso}T00:00:00Z`)
    const endMs = Date.parse(`${toIso}T00:00:00Z`)
    const span = Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1)
    const beforeTo = shiftIsoDate(fromIso, -1)
    const beforeFrom = shiftIsoDate(beforeTo, -(span - 1))
    return {
      granularity: span === 1 ? 'single' : 'range',
      periodAfter: { from: fromIso, to: toIso },
      periodBefore: { from: beforeFrom, to: beforeTo },
    }
  }

  const curMonthFirst = `${yesterday.slice(0, 8)}01`
  const prevMonth = computePreviousFullMonthWindow(yesterday)
  return {
    granularity: 'range',
    periodAfter: { from: curMonthFirst, to: yesterday },
    periodBefore: prevMonth,
  }
}

function mapVarianceRowToComparisonTableRow(row: EntityVarianceRow): ComparisonTableRow {
  const beforeSalesKwd = round1(row.valueB)
  const afterSalesKwd = round1(row.valueA)
  const salesDeltaKwd = round1(afterSalesKwd - beforeSalesKwd)
  const salesDeltaPct = safePct(beforeSalesKwd, afterSalesKwd)
  const accAvail = Boolean(row.accountingAvailable)
  const beforePocketKwd = accAvail ? round1(row.netProfitB) : 0
  const afterPocketKwd = accAvail ? round1(row.netProfitA) : 0
  const pocketDeltaKwd = accAvail ? round1(afterPocketKwd - beforePocketKwd) : 0
  const pocketDeltaPct = accAvail ? safePct(beforePocketKwd, afterPocketKwd) : 0
  const marginAfterPct = accAvail ? round1(row.marginPctA) : 0
  const marginDeltaPp = accAvail ? round1(row.marginDeltaPp) : 0

  return {
    id: row.id,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    subtitleAr: row.subMetaAr,
    subtitleEn: row.subMetaEn,
    isUnattributed: row.isUnattributed,
    accountingAvailable: accAvail,
    beforeSalesKwd,
    afterSalesKwd,
    salesDeltaKwd,
    salesDeltaPct,
    beforeOrders: row.ordersB,
    afterOrders: row.ordersA,
    ordersDeltaPct: safePct(row.ordersB, row.ordersA),
    beforePocketKwd,
    afterPocketKwd,
    pocketDeltaKwd,
    pocketDeltaPct,
    marginAfterPct,
    marginDeltaPp,
    verdict: verdictFrom(salesDeltaPct),
  }
}

export function computeBeforeAfterSnapshot(
  filters: GlobalFilters = DEFAULT_GLOBAL_FILTERS,
  mode: ComparisonMode = 'period-prev',
  selectedEventId: string | null = null,
  campaigns: SocialCampaign[] = [],
  decisions: ApprovedDecisionItem[] = [],
  liveSummary?: OdooLiveSummary | null,
  liveCubes?: BeforeAfterLiveCubesInput | null,
): BeforeAfterSnapshot {
  const availableEvents = buildBeforeAfterEvents(campaigns, decisions)
  const activeEvent =
    mode === 'event'
      ? availableEvents.find((e) => e.id === selectedEventId) ?? availableEvents[0] ?? null
      : null

  const { granularity, periodAfter, periodBefore } = resolveBeforeAfterWindows(
    filters,
    mode,
    activeEvent,
  )

  const summaryWithCubes = liveSummary as
    | (OdooLiveSummary & {
        cubeA?: OdooPeriodCube | null
        cubeB?: OdooPeriodCube | null
      })
    | null
    | undefined

  const afterCube =
    liveCubes?.afterCube ?? liveCubes?.cubeA ?? summaryWithCubes?.cubeA ?? null
  const beforeCube =
    liveCubes?.beforeCube ?? liveCubes?.cubeB ?? summaryWithCubes?.cubeB ?? null

  const brand = filters.brand ?? 'all'
  const branch = filters.branch ?? 'all'
  const channel = filters.channel ?? 'all'

  const query: ErpComparisonQuery = {
    mode: 'date-vs-date',
    granularity,
    periodA: periodAfter,
    periodB: periodBefore,
    brandIds: brand === 'all' ? 'all' : ([brand] as BrandEntityId[]),
    branchIds: branch === 'all' ? 'all' : ([branch] as BranchEntityId[]),
    channelIds: channel === 'all' ? 'all' : ([channel] as ChannelEntityId[]),
  }

  const comp = computeErpComparison(query, { cubeA: afterCube, cubeB: beforeCube })

  if (!comp.connected || comp.noData) {
    return {
      connected: Boolean(comp.connected),
      noData: true,
      messageAr: NO_DATA_AR,
      glIncomplete: true,
      glWarningAr: GL_INCOMPLETE_AR,
      mode,
      beforeLabelAr: comp.selectionB.titleAr,
      beforeLabelEn: comp.selectionB.titleEn,
      afterLabelAr: comp.selectionA.titleAr,
      afterLabelEn: comp.selectionA.titleEn,
      daysCompared: comp.selectionA.dayCount,
      periodBefore: {
        from: comp.selectionB.fromIso,
        to: comp.selectionB.toIso,
      },
      periodAfter: {
        from: comp.selectionA.fromIso,
        to: comp.selectionA.toIso,
      },
      activeEvent,
      availableEvents,
      summary: {
        sales: pair(0, 0, 1, false),
        orders: pair(0, 0, 0, false),
        aov: pair(0, 0, 2, false),
        pocketProfit: pair(0, 0, 1, false),
        marginBeforePct: 0,
        marginAfterPct: 0,
        marginDeltaPp: 0,
        unattributedBeforeKwd: 0,
        unattributedAfterKwd: 0,
        unattributedBeforeOrders: 0,
        unattributedAfterOrders: 0,
        overallVerdict: 'steady',
        headlineAr: NO_DATA_AR,
        headlineEn: NO_DATA_EN,
        explanationAr: NO_DATA_AR,
        explanationEn: NO_DATA_EN,
      },
      byBrandRows: [],
      byBranchRows: [],
      byChannelRows: [],
    }
  }

  const salesPair = pair(
    comp.selectionB.netSalesKwd,
    comp.selectionA.netSalesKwd,
    1,
    true,
  )
  const ordersPair = pair(
    comp.selectionB.completedOrders,
    comp.selectionA.completedOrders,
    0,
    true,
  )
  const aovPair = pair(comp.selectionB.aovKwd, comp.selectionA.aovKwd, 2, true)

  const bothGlPosted = comp.accountingAvailable
  const pocketPair = bothGlPosted
    ? pair(
        comp.selectionB.netPocketCashKwd,
        comp.selectionA.netPocketCashKwd,
        1,
        true,
      )
    : pair(0, 0, 1, false)
  const marginBeforePct = bothGlPosted ? round1(comp.selectionB.netPocketMarginPct) : 0
  const marginAfterPct = bothGlPosted ? round1(comp.selectionA.netPocketMarginPct) : 0
  const marginDeltaPp = bothGlPosted ? round1(marginAfterPct - marginBeforePct) : 0

  const overallVerdict = verdictFrom(salesPair.deltaPct)

  return {
    connected: true,
    noData: false,
    glIncomplete: !bothGlPosted,
    glWarningAr: bothGlPosted ? null : GL_INCOMPLETE_AR,
    mode,
    beforeLabelAr: comp.selectionB.titleAr,
    beforeLabelEn: comp.selectionB.titleEn,
    afterLabelAr: comp.selectionA.titleAr,
    afterLabelEn: comp.selectionA.titleEn,
    daysCompared: comp.selectionA.dayCount,
    periodBefore: {
      from: comp.selectionB.fromIso,
      to: comp.selectionB.toIso,
    },
    periodAfter: {
      from: comp.selectionA.fromIso,
      to: comp.selectionA.toIso,
    },
    activeEvent,
    availableEvents,
    summary: {
      sales: salesPair,
      orders: ordersPair,
      aov: aovPair,
      pocketProfit: pocketPair,
      marginBeforePct,
      marginAfterPct,
      marginDeltaPp,
      unattributedBeforeKwd: comp.unattributedB.salesKwd,
      unattributedAfterKwd: comp.unattributedA.salesKwd,
      unattributedBeforeOrders: comp.unattributedB.orders,
      unattributedAfterOrders: comp.unattributedA.orders,
      overallVerdict,
      headlineAr: comp.insights.headlineAr,
      headlineEn: comp.insights.headlineEn,
      explanationAr: comp.insights.summaryAr,
      explanationEn: comp.insights.summaryEn,
    },
    byBrandRows: comp.byBrand.map(mapVarianceRowToComparisonTableRow),
    byBranchRows: comp.byBranch.map(mapVarianceRowToComparisonTableRow),
    byChannelRows: comp.byChannel.map(mapVarianceRowToComparisonTableRow),
  }
}
