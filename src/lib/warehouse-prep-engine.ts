/**
 * Live Odoo Warehouse Chain & Unlinked Order Prep SLA Engine
 * (`src/lib/warehouse-prep-engine.ts`)
 *
 * Powers:
 *   1. `/erp/warehouse-chain` — Live Odoo 17 inventory & stock flow engine backed
 *      exclusively by `stock.move` (`state='done'`), `stock.scrap` (`state='done'`),
 *      and `stock.quant` (`location_id.usage='internal'`).
 *   2. `/erp/prep-sla` — Explicitly disabled (`unlinkedSource: true`,
 *      `messageAr: 'غير مربوط بمصدر'`) because Odoo 17 POS in this deployment has
 *      no KDS kitchen preparation timestamps connected.
 *
 * Strict Guarantees:
 *   - Zero fixed opening balances, zero fixed waste percentages, zero hardcoded
 *     dates, and zero synthetic KDS tickets.
 */

import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import type {
  OdooLiveWarehouseChainPayload,
  OdooLiveWarehouseProductRow,
  OdooLiveWarehouseScrapRow,
} from '@/lib/odoo-live-connector'
import {
  APPROVED_BRANCH_IDS,
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  getBranchLabel,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
  type GlobalFilters,
  type GlobalWorkspaceSlice,
} from '@/lib/aether/global-filter-engine'
import { getKuwaitTimeContext } from '@/lib/aether/period-delta'

export type ActiveBranchId = Exclude<GlobalBranch, 'all'>
export type ActiveBrandId = Exclude<GlobalBrand, 'all'>
export type ActiveChannelId = Exclude<GlobalChannel, 'all'>
export type ChainHealthStatus = 'healthy' | 'watch' | 'critical'

export type RawMaterialCategory =
  | 'all'
  | 'proteins'
  | 'dairy-sauces'
  | 'packaging'
  | 'dry-goods'

export interface RawMaterialCategoryOption {
  id: RawMaterialCategory
  ar: string
  en: string
  labelAr: string
  labelEn: string
  unitAr: string
  unitEn: string
  costShare: number
  avgKwdPerUnit: number
}

export const RAW_MATERIAL_CATEGORIES: readonly RawMaterialCategoryOption[] = [
  {
    id: 'all',
    ar: 'كل فئات المخزن',
    en: 'All Categories',
    labelAr: 'كل فئات المخزن',
    labelEn: 'All Categories',
    unitAr: 'كجم / وحدة',
    unitEn: 'kg / units',
    costShare: 0,
    avgKwdPerUnit: 0,
  },
  {
    id: 'proteins',
    ar: 'اللحوم والدواجن والبروتينات',
    en: 'Proteins / Beef / Chicken',
    labelAr: 'اللحوم والدواجن والبروتينات',
    labelEn: 'Proteins / Beef / Chicken',
    unitAr: 'كجم',
    unitEn: 'kg',
    costShare: 0,
    avgKwdPerUnit: 0,
  },
  {
    id: 'dairy-sauces',
    ar: 'الألبان والصوصات',
    en: 'Dairy & Sauces',
    labelAr: 'الألبان والصوصات',
    labelEn: 'Dairy & Sauces',
    unitAr: 'كجم / لتر',
    unitEn: 'kg / L',
    costShare: 0,
    avgKwdPerUnit: 0,
  },
  {
    id: 'packaging',
    ar: 'التغليف والعلب',
    en: 'Packaging',
    labelAr: 'التغليف والعلب',
    labelEn: 'Packaging',
    unitAr: 'ربطة / علبة',
    unitEn: 'packs / units',
    costShare: 0,
    avgKwdPerUnit: 0,
  },
  {
    id: 'dry-goods',
    ar: 'المواد الجافة والأرز والنودلز',
    en: 'Dry Goods',
    labelAr: 'المواد الجافة والأرز والنودلز',
    labelEn: 'Dry Goods',
    unitAr: 'كجم',
    unitEn: 'kg',
    costShare: 0,
    avgKwdPerUnit: 0,
  },
] as const

export interface BranchDailyChainNode {
  branchId: ActiveBranchId
  branchNameAr: string
  branchNameEn: string
  dispatchedFromWarehouseKwd: number
  dispatchedKg: number
  transferMoves: number
  receivedByBranchKwd: number
  receivedKg: number
  transitGapKwd: number
  transitGapKg: number
  posSalesKwd: number
  posOrders: number
  aovKwd: number
  bomTheoreticalCostKwd: number
  bomTheoreticalKg: number
  actualConsumedKwd: number
  actualConsumedKg: number
  abnormalShrinkageKwd: number
  abnormalShrinkageKg: number
  abnormalPctOfSales: number
  wastePct: number
  requiresInvestigation: boolean
  branchNetStockDeltaKwd: number
  closingStockKwd: number
  health: ChainHealthStatus
}

export interface WarehouseDailyChainDay {
  dateIso: string
  dayLabelAr: string
  dayLabelEn: string
  weekdayAr: string
  weekdayEn: string
  isWeekend: boolean
  warehouseOpeningKwd: number
  warehouseOpeningKg: number
  supplierInboundKwd: number
  supplierInboundKg: number
  warehouseOnHandTotalKwd: number
  warehouseOnHandTotalKg: number
  warehouseDispatchedKwd: number
  warehouseDispatchedKg: number
  dispatchMoves: number
  warehouseClosingKwd: number
  warehouseClosingKg: number
  branchesReceivedKwd: number
  branchesReceivedKg: number
  transitGapKwd: number
  transitGapKg: number
  branchesPosSalesKwd: number
  branchesOrders: number
  bomTheoreticalCostKwd: number
  bomTheoreticalKg: number
  actualConsumedKwd: number
  actualConsumedKg: number
  abnormalShrinkageKwd: number
  abnormalShrinkageKg: number
  wastePct: number
  requiresInvestigation: boolean
  health: ChainHealthStatus
  branches: BranchDailyChainNode[]
}

export interface WarehouseSkuFlowRow {
  code: string
  nameEn: string
  nameAr: string
  category: Exclude<RawMaterialCategory, 'all'>
  categoryLabelAr: string
  categoryLabelEn: string
  uom: string
  unitCostKwd: number
  warehouseOnHandQty: number
  warehouseOnHandKwd: number
  dailyOutboundQty: number
  dailyOutboundKwd: number
  dailyBranchReceivedQty: number
  dailyBranchConsumedQty: number
  scrapQty: number
  scrapValueKwd: number
  daysOfCover: number
  status: ChainHealthStatus
}

export interface WarehouseChainSnapshot {
  connected: boolean
  noData: boolean
  messageAr: string | null
  quantHasValueField: boolean
  filters: GlobalFilters
  materialCategory: RawMaterialCategory
  categoryMeta: RawMaterialCategoryOption
  workspace: GlobalWorkspaceSlice
  fromIso: string
  toIso: string
  dayCount: number
  latestDay: WarehouseDailyChainDay
  days: WarehouseDailyChainDay[]
  periodTotals: {
    openingWarehouseKwd: number
    openingWarehouseKg: number
    totalSupplierInboundKwd: number
    totalSupplierInboundKg: number
    avgDailyOnHandWarehouseKwd: number
    avgDailyOnHandWarehouseKg: number
    closingWarehouseKwd: number
    closingWarehouseKg: number
    totalDispatchedKwd: number
    totalDispatchedKg: number
    totalDispatchMoves: number
    totalBranchesReceivedKwd: number
    totalBranchesReceivedKg: number
    totalTransitGapKwd: number
    totalTransitGapKg: number
    totalBranchesSalesKwd: number
    totalBranchesOrders: number
    totalBomTheoreticalKwd: number
    totalBomTheoreticalKg: number
    totalActualConsumedKwd: number
    totalActualConsumedKg: number
    totalAbnormalShrinkageKwd: number
    totalAbnormalShrinkageKg: number
    periodWastePct: number
  }
  branchPeriodSummary: BranchDailyChainNode[]
  skuFlows: WarehouseSkuFlowRow[]
  scraps: OdooLiveWarehouseScrapRow[]
}

const NO_DATA_AR = 'لا توجد بيانات من Odoo لهذه الفترة'

const WEEKDAYS_AR = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const

const MONTHS_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

function r1(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 10) / 10
}

function r2(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100
}

function parseIsoUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1))
}

function formatUtcIso(dt: Date): string {
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDayBadge(iso: string): {
  dayLabelAr: string
  dayLabelEn: string
  weekdayAr: string
  weekdayEn: string
  isWeekend: boolean
} {
  const dt = parseIsoUtc(iso)
  const wd = dt.getUTCDay()
  const day = dt.getUTCDate()
  const mo = dt.getUTCMonth()
  return {
    dayLabelAr: `${WEEKDAYS_AR[wd]} ${day} ${MONTHS_AR[mo]}`,
    dayLabelEn: `${WEEKDAYS_EN[wd]}, ${MONTHS_EN[mo]} ${day}`,
    weekdayAr: WEEKDAYS_AR[wd],
    weekdayEn: WEEKDAYS_EN[wd],
    isWeekend: wd === 4 || wd === 5 || wd === 6,
  }
}

function classifyHealth(wastePct: number): ChainHealthStatus {
  if (wastePct > 5) return 'critical'
  if (wastePct > 2) return 'watch'
  return 'healthy'
}

function classifyProductCategory(
  row: OdooLiveWarehouseProductRow,
): Exclude<RawMaterialCategory, 'all'> {
  const text = `${row.categoryName} ${row.name}`.toLowerCase()
  if (
    /meat|beef|chicken|poultry|lamb|fish|shrimp|burger|wagyu|rib|brisket|لحم|دجاج|برجر|سمك|روبيان|بروتين/.test(
      text,
    )
  ) {
    return 'proteins'
  }
  if (
    /dairy|milk|cheese|cream|butter|cheddar|mozzarella|yogurt|sauce|oil|syrup|dressing|mayo|ketchup|حليب|جبن|كريمة|زبدة|ألبان|صوص|صلصة|زيت/.test(
      text,
    )
  ) {
    return 'dairy-sauces'
  }
  if (
    /pack|box|cup|bag|lid|napkin|wrap|fork|spoon|straw|تغليف|علب|أكواب|أكياس|مناديل/.test(text)
  ) {
    return 'packaging'
  }
  return 'dry-goods'
}

function buildEmptyDay(dateIso: string): WarehouseDailyChainDay {
  const badge = formatDayBadge(dateIso)
  return {
    dateIso,
    dayLabelAr: badge.dayLabelAr,
    dayLabelEn: badge.dayLabelEn,
    weekdayAr: badge.weekdayAr,
    weekdayEn: badge.weekdayEn,
    isWeekend: badge.isWeekend,
    warehouseOpeningKwd: 0,
    warehouseOpeningKg: 0,
    supplierInboundKwd: 0,
    supplierInboundKg: 0,
    warehouseOnHandTotalKwd: 0,
    warehouseOnHandTotalKg: 0,
    warehouseDispatchedKwd: 0,
    warehouseDispatchedKg: 0,
    dispatchMoves: 0,
    warehouseClosingKwd: 0,
    warehouseClosingKg: 0,
    branchesReceivedKwd: 0,
    branchesReceivedKg: 0,
    transitGapKwd: 0,
    transitGapKg: 0,
    branchesPosSalesKwd: 0,
    branchesOrders: 0,
    bomTheoreticalCostKwd: 0,
    bomTheoreticalKg: 0,
    actualConsumedKwd: 0,
    actualConsumedKg: 0,
    abnormalShrinkageKwd: 0,
    abnormalShrinkageKg: 0,
    wastePct: 0,
    requiresInvestigation: false,
    health: 'healthy',
    branches: [],
  }
}

function resolveDateBounds(filters: GlobalFilters): {
  fromIso: string
  toIso: string
  days: string[]
} {
  const ctx = getKuwaitTimeContext()
  let fromIso = ctx.yesterdayIso
  let toIso = ctx.yesterdayIso
  const period = filters.period ?? 'month'

  if (period === 'today') {
    fromIso = ctx.todayIso
    toIso = ctx.todayIso
  } else if (period === 'week') {
    toIso = ctx.todayIso
    const dt = parseIsoUtc(toIso)
    fromIso = formatUtcIso(new Date(dt.getTime() - 6 * 86_400_000))
  } else if (period === 'month') {
    toIso = ctx.todayIso
    fromIso = `${toIso.slice(0, 8)}01`
  } else if (period === 'custom') {
    fromIso =
      filters.customFrom && /^\d{4}-\d{2}-\d{2}$/.test(filters.customFrom)
        ? filters.customFrom
        : ctx.yesterdayIso
    toIso =
      filters.customTo && /^\d{4}-\d{2}-\d{2}$/.test(filters.customTo)
        ? filters.customTo
        : fromIso
    if (fromIso > toIso) {
      const tmp = fromIso
      fromIso = toIso
      toIso = tmp
    }
  }

  const start = parseIsoUtc(fromIso)
  const end = parseIsoUtc(toIso)
  const span = Math.max(
    1,
    Math.min(366, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1),
  )
  const days: string[] = []
  for (let i = 0; i < span; i++) {
    days.push(formatUtcIso(new Date(start.getTime() + i * 86_400_000)))
  }
  return { fromIso: days[0], toIso: days[days.length - 1], days }
}

/**
 * Computes the warehouse inventory & scrap snapshot strictly from live Odoo
 * `stock.move`, `stock.scrap`, and `stock.quant` payloads.
 */
export function computeWarehouseDailyChain(
  filters: GlobalFilters = DEFAULT_GLOBAL_FILTERS,
  workspaceOverride?: GlobalWorkspaceSlice,
  materialCategory: RawMaterialCategory = 'all',
  liveSummary?: OdooLiveSummary | null,
  liveWarehouseChain?: OdooLiveWarehouseChainPayload | null,
): WarehouseChainSnapshot {
  const categoryMeta =
    RAW_MATERIAL_CATEGORIES.find((c) => c.id === materialCategory) ??
    RAW_MATERIAL_CATEGORIES[0]
  const ws = workspaceOverride ?? computeGlobalWorkspace(filters, liveSummary)
  const bounds = resolveDateBounds(filters)

  const summaryWithChain = liveSummary as
    | (OdooLiveSummary & { warehouseChain?: OdooLiveWarehouseChainPayload | null })
    | null
    | undefined
  const chain = liveWarehouseChain ?? summaryWithChain?.warehouseChain ?? null

  if (!chain || !chain.connected) {
    const emptyLatest = buildEmptyDay(bounds.toIso)
    return {
      connected: false,
      noData: true,
      messageAr: NO_DATA_AR,
      quantHasValueField: false,
      filters,
      materialCategory,
      categoryMeta,
      workspace: ws,
      fromIso: chain?.dateRange?.from ?? bounds.fromIso,
      toIso: chain?.dateRange?.to ?? bounds.toIso,
      dayCount: bounds.days.length,
      latestDay: emptyLatest,
      days: [],
      periodTotals: {
        openingWarehouseKwd: 0,
        openingWarehouseKg: 0,
        totalSupplierInboundKwd: 0,
        totalSupplierInboundKg: 0,
        avgDailyOnHandWarehouseKwd: 0,
        avgDailyOnHandWarehouseKg: 0,
        closingWarehouseKwd: 0,
        closingWarehouseKg: 0,
        totalDispatchedKwd: 0,
        totalDispatchedKg: 0,
        totalDispatchMoves: 0,
        totalBranchesReceivedKwd: 0,
        totalBranchesReceivedKg: 0,
        totalTransitGapKwd: 0,
        totalTransitGapKg: 0,
        totalBranchesSalesKwd: 0,
        totalBranchesOrders: 0,
        totalBomTheoreticalKwd: 0,
        totalBomTheoreticalKg: 0,
        totalActualConsumedKwd: 0,
        totalActualConsumedKg: 0,
        totalAbnormalShrinkageKwd: 0,
        totalAbnormalShrinkageKg: 0,
        periodWastePct: 0,
      },
      branchPeriodSummary: [],
      skuFlows: [],
      scraps: [],
    }
  }

  const branchFilter = filters.branch ?? 'all'
  const activeBranches: ActiveBranchId[] =
    branchFilter === 'all'
      ? [...APPROVED_BRANCH_IDS]
      : APPROVED_BRANCH_IDS.filter((b) => b === branchFilter)

  const startDt = parseIsoUtc(chain.dateRange.from)
  const endDt = parseIsoUtc(chain.dateRange.to)
  const dayCount = Math.max(
    1,
    Math.min(366, Math.round((endDt.getTime() - startDt.getTime()) / 86_400_000) + 1),
  )
  const dayIsos: string[] = []
  for (let i = 0; i < dayCount; i++) {
    dayIsos.push(formatUtcIso(new Date(startDt.getTime() + i * 86_400_000)))
  }

  const moveByDay = new Map(chain.dailyMoves.map((m) => [m.day, m]))

  const days: WarehouseDailyChainDay[] = dayIsos.map((dateIso) => {
    const badge = formatDayBadge(dateIso)
    const moveRow = moveByDay.get(dateIso)
    const posDayMap =
      liveSummary?.connected !== false ? liveSummary?.dailyByBranch?.[dateIso] : undefined

    const branchNodes: BranchDailyChainNode[] = activeBranches.map((brId) => {
      const bMove = moveRow?.byBranch?.[brId]
      const posCell = posDayMap?.[brId]
      const onHandCell = chain.byBranchOnHand?.[brId]

      const receivedKwd = r2(bMove?.receivedFromCkKwd ?? 0)
      const receivedKg = r1(bMove?.receivedFromCkQty ?? 0)
      const consumedKwd = r2(bMove?.consumedKwd ?? 0)
      const consumedKg = r1(bMove?.consumedQty ?? 0)
      const scrapKwd = r2(bMove?.scrapKwd ?? 0)
      const scrapKg = r1(bMove?.scrapQty ?? 0)
      const actualConsumedKwd = r2(consumedKwd + scrapKwd)
      const actualConsumedKg = r1(consumedKg + scrapKg)
      const posSalesKwd = r2(posCell?.netKwd ?? 0)
      const posOrders = Math.round(posCell?.orders ?? 0)
      const aovKwd = posOrders > 0 ? r2(posSalesKwd / posOrders) : 0
      const wastePct =
        actualConsumedKwd > 0 ? r1((scrapKwd / actualConsumedKwd) * 100) : 0
      const closingStockKwd = r2(onHandCell?.valueKwd ?? 0)

      return {
        branchId: brId,
        branchNameAr: getBranchLabel(brId, true),
        branchNameEn: getBranchLabel(brId, false),
        dispatchedFromWarehouseKwd: receivedKwd,
        dispatchedKg: receivedKg,
        transferMoves: receivedKwd > 0 || receivedKg > 0 ? 1 : 0,
        receivedByBranchKwd: receivedKwd,
        receivedKg,
        transitGapKwd: 0,
        transitGapKg: 0,
        posSalesKwd,
        posOrders,
        aovKwd,
        bomTheoreticalCostKwd: consumedKwd,
        bomTheoreticalKg: consumedKg,
        actualConsumedKwd,
        actualConsumedKg,
        abnormalShrinkageKwd: scrapKwd,
        abnormalShrinkageKg: scrapKg,
        abnormalPctOfSales: posSalesKwd > 0 ? r1((scrapKwd / posSalesKwd) * 100) : 0,
        wastePct,
        requiresInvestigation: wastePct > 2,
        branchNetStockDeltaKwd: r2(receivedKwd - actualConsumedKwd),
        closingStockKwd,
        health: classifyHealth(wastePct),
      }
    })

    const sumBr = (fn: (b: BranchDailyChainNode) => number) =>
      branchNodes.reduce((s, b) => s + fn(b), 0)

    const supplierInboundKwd = r2(moveRow?.inboundSupplierKwd ?? 0)
    const supplierInboundKg = r1(moveRow?.inboundSupplierQty ?? 0)
    const warehouseDispatchedKwd = r2(moveRow?.ckToBranchTransferKwd ?? 0)
    const warehouseDispatchedKg = r1(moveRow?.ckToBranchTransferQty ?? 0)
    const branchesReceivedKwd = r2(sumBr((b) => b.receivedByBranchKwd))
    const branchesReceivedKg = r1(sumBr((b) => b.receivedKg))
    const transitGapKwd = r2(warehouseDispatchedKwd - branchesReceivedKwd)
    const transitGapKg = r1(warehouseDispatchedKg - branchesReceivedKg)
    const branchesPosSalesKwd = r2(sumBr((b) => b.posSalesKwd))
    const branchesOrders = Math.round(sumBr((b) => b.posOrders))
    const bomTheoreticalCostKwd = r2(sumBr((b) => b.bomTheoreticalCostKwd))
    const bomTheoreticalKg = r1(sumBr((b) => b.bomTheoreticalKg))
    const abnormalShrinkageKwd = r2(moveRow?.scrapKwd ?? 0)
    const abnormalShrinkageKg = r1(moveRow?.scrapQty ?? 0)
    const actualConsumedKwd = r2(bomTheoreticalCostKwd + abnormalShrinkageKwd)
    const actualConsumedKg = r1(bomTheoreticalKg + abnormalShrinkageKg)
    const wastePct =
      actualConsumedKwd > 0 ? r1((abnormalShrinkageKwd / actualConsumedKwd) * 100) : 0
    const ckClosingKwd = r2(chain.totals.ckOnHandValueKwd)
    const ckClosingKg = r1(chain.totals.currentOnHandQty)

    return {
      dateIso,
      dayLabelAr: badge.dayLabelAr,
      dayLabelEn: badge.dayLabelEn,
      weekdayAr: badge.weekdayAr,
      weekdayEn: badge.weekdayEn,
      isWeekend: badge.isWeekend,
      warehouseOpeningKwd: 0,
      warehouseOpeningKg: 0,
      supplierInboundKwd,
      supplierInboundKg,
      warehouseOnHandTotalKwd: ckClosingKwd,
      warehouseOnHandTotalKg: ckClosingKg,
      warehouseDispatchedKwd,
      warehouseDispatchedKg,
      dispatchMoves: moveRow?.movesCount ?? 0,
      warehouseClosingKwd: ckClosingKwd,
      warehouseClosingKg: ckClosingKg,
      branchesReceivedKwd,
      branchesReceivedKg,
      transitGapKwd,
      transitGapKg,
      branchesPosSalesKwd,
      branchesOrders,
      bomTheoreticalCostKwd,
      bomTheoreticalKg,
      actualConsumedKwd,
      actualConsumedKg,
      abnormalShrinkageKwd,
      abnormalShrinkageKg,
      wastePct,
      requiresInvestigation: wastePct > 2,
      health: classifyHealth(wastePct),
      branches: branchNodes,
    }
  })

  const branchPeriodSummary: BranchDailyChainNode[] = activeBranches.map((brId) => {
    let dispatchedKwd = 0
    let dispatchedKg = 0
    let moves = 0
    let posSalesKwd = 0
    let posOrders = 0
    let theoKwd = 0
    let theoKg = 0
    let scrapKwd = 0
    let scrapKg = 0
    for (const d of days) {
      const b = d.branches.find((x) => x.branchId === brId)
      if (!b) continue
      dispatchedKwd += b.dispatchedFromWarehouseKwd
      dispatchedKg += b.dispatchedKg
      moves += b.transferMoves
      posSalesKwd += b.posSalesKwd
      posOrders += b.posOrders
      theoKwd += b.bomTheoreticalCostKwd
      theoKg += b.bomTheoreticalKg
      scrapKwd += b.abnormalShrinkageKwd
      scrapKg += b.abnormalShrinkageKg
    }
    const actualKwd = r2(theoKwd + scrapKwd)
    const actualKg = r1(theoKg + scrapKg)
    const wastePct = actualKwd > 0 ? r1((scrapKwd / actualKwd) * 100) : 0
    const closingStockKwd = r2(chain.byBranchOnHand?.[brId]?.valueKwd ?? 0)
    return {
      branchId: brId,
      branchNameAr: getBranchLabel(brId, true),
      branchNameEn: getBranchLabel(brId, false),
      dispatchedFromWarehouseKwd: r2(dispatchedKwd),
      dispatchedKg: r1(dispatchedKg),
      transferMoves: moves,
      receivedByBranchKwd: r2(dispatchedKwd),
      receivedKg: r1(dispatchedKg),
      transitGapKwd: 0,
      transitGapKg: 0,
      posSalesKwd: r2(posSalesKwd),
      posOrders: Math.round(posOrders),
      aovKwd: posOrders > 0 ? r2(posSalesKwd / posOrders) : 0,
      bomTheoreticalCostKwd: r2(theoKwd),
      bomTheoreticalKg: r1(theoKg),
      actualConsumedKwd: actualKwd,
      actualConsumedKg: actualKg,
      abnormalShrinkageKwd: r2(scrapKwd),
      abnormalShrinkageKg: r1(scrapKg),
      abnormalPctOfSales: posSalesKwd > 0 ? r1((scrapKwd / posSalesKwd) * 100) : 0,
      wastePct,
      requiresInvestigation: wastePct > 2,
      branchNetStockDeltaKwd: r2(dispatchedKwd - actualKwd),
      closingStockKwd,
      health: classifyHealth(wastePct),
    }
  })

  const filteredProducts = chain.products.filter((p) =>
    materialCategory === 'all' ? true : classifyProductCategory(p) === materialCategory,
  )

  const skuFlows: WarehouseSkuFlowRow[] = filteredProducts.map((p) => {
    const cat = classifyProductCategory(p)
    const catOpt =
      RAW_MATERIAL_CATEGORIES.find((c) => c.id === cat) ?? RAW_MATERIAL_CATEGORIES[0]
    const dailyOutboundQty = dayCount > 0 ? r1(p.transferQty / dayCount) : 0
    const dailyOutboundKwd = dayCount > 0 ? r2(p.transferValueKwd / dayCount) : 0
    const dailyConsumedQty = dayCount > 0 ? r1(p.consumedQty / dayCount) : 0
    const denom = p.consumedQty + p.scrapQty
    const shrinkPct = denom > 0 ? r1((p.scrapQty / denom) * 100) : 0
    return {
      code: p.skuCode,
      nameEn: p.name,
      nameAr: p.name,
      category: cat,
      categoryLabelAr: catOpt.ar,
      categoryLabelEn: catOpt.en,
      uom: p.uomName,
      unitCostKwd: r2(p.unitCostKwd),
      warehouseOnHandQty: r1(p.onHandQty),
      warehouseOnHandKwd: r2(p.onHandValueKwd),
      dailyOutboundQty,
      dailyOutboundKwd,
      dailyBranchReceivedQty: dailyOutboundQty,
      dailyBranchConsumedQty: dailyConsumedQty,
      scrapQty: r1(p.scrapQty),
      scrapValueKwd: r2(p.scrapValueKwd),
      daysOfCover: dailyConsumedQty > 0 ? r1(p.onHandQty / dailyConsumedQty) : 0,
      status: classifyHealth(shrinkPct),
    }
  })

  const latestDay = days[days.length - 1] ?? buildEmptyDay(chain.dateRange.to)
  const totalSupplierInboundKwd = r2(chain.totals.inboundSupplierKwd)
  const totalSupplierInboundKg = r1(
    days.reduce((s, d) => s + d.supplierInboundKg, 0),
  )
  const totalDispatchedKwd = r2(chain.totals.ckToBranchTransferKwd)
  const totalDispatchedKg = r1(
    days.reduce((s, d) => s + d.warehouseDispatchedKg, 0),
  )
  const totalDispatchMoves = chain.totals.doneMovesCount
  const totalBranchesReceivedKwd = r2(
    days.reduce((s, d) => s + d.branchesReceivedKwd, 0),
  )
  const totalBranchesReceivedKg = r1(
    days.reduce((s, d) => s + d.branchesReceivedKg, 0),
  )
  const totalBranchesSalesKwd = r2(
    days.reduce((s, d) => s + d.branchesPosSalesKwd, 0),
  )
  const totalBranchesOrders = Math.round(
    days.reduce((s, d) => s + d.branchesOrders, 0),
  )
  const totalBomTheoreticalKwd = r2(chain.totals.posConsumptionKwd)
  const totalBomTheoreticalKg = r1(
    days.reduce((s, d) => s + d.bomTheoreticalKg, 0),
  )
  const totalAbnormalShrinkageKwd = r2(chain.totals.scrapKwd)
  const totalAbnormalShrinkageKg = r1(
    days.reduce((s, d) => s + d.abnormalShrinkageKg, 0),
  )
  const totalActualConsumedKwd = r2(
    totalBomTheoreticalKwd + totalAbnormalShrinkageKwd,
  )
  const totalActualConsumedKg = r1(
    totalBomTheoreticalKg + totalAbnormalShrinkageKg,
  )
  const periodWastePct =
    totalActualConsumedKwd > 0
      ? r1((totalAbnormalShrinkageKwd / totalActualConsumedKwd) * 100)
      : 0

  const hasData =
    !chain.noData &&
    (chain.totals.doneMovesCount > 0 ||
      chain.totals.scrapOrdersCount > 0 ||
      chain.totals.quantsCount > 0)

  return {
    connected: true,
    noData: !hasData,
    messageAr: hasData ? null : NO_DATA_AR,
    quantHasValueField: chain.quantHasValueField,
    filters,
    materialCategory,
    categoryMeta,
    workspace: ws,
    fromIso: chain.dateRange.from,
    toIso: chain.dateRange.to,
    dayCount,
    latestDay,
    days,
    periodTotals: {
      openingWarehouseKwd: 0,
      openingWarehouseKg: 0,
      totalSupplierInboundKwd,
      totalSupplierInboundKg,
      avgDailyOnHandWarehouseKwd: r2(chain.totals.ckOnHandValueKwd),
      avgDailyOnHandWarehouseKg: r1(chain.totals.currentOnHandQty),
      closingWarehouseKwd: r2(chain.totals.ckOnHandValueKwd),
      closingWarehouseKg: r1(chain.totals.currentOnHandQty),
      totalDispatchedKwd,
      totalDispatchedKg,
      totalDispatchMoves,
      totalBranchesReceivedKwd,
      totalBranchesReceivedKg,
      totalTransitGapKwd: r2(totalDispatchedKwd - totalBranchesReceivedKwd),
      totalTransitGapKg: r1(totalDispatchedKg - totalBranchesReceivedKg),
      totalBranchesSalesKwd,
      totalBranchesOrders,
      totalBomTheoreticalKwd,
      totalBomTheoreticalKg,
      totalActualConsumedKwd,
      totalActualConsumedKg,
      totalAbnormalShrinkageKwd,
      totalAbnormalShrinkageKg,
      periodWastePct,
    },
    branchPeriodSummary,
    skuFlows,
    scraps: chain.scraps,
  }
}

// =============================================================================
// PART 2: KITCHEN ORDER PREPARATION SLA — UNLINKED SOURCE (`غير مربوط بمصدر`)
// =============================================================================

export type PrepSlaTier = 'green' | 'yellow' | 'red'

export interface PrepSlaOrderTicket {
  orderId: string
  dateIso: string
  arrivedAt: string
  readyAt: string
  hourIndex: number
  hourLabelAr: string
  hourLabelEn: string
  prepSeconds: number
  prepMinutes: number
  durationMmSs: string
  brandId: ActiveBrandId
  brandNameAr: string
  brandNameEn: string
  branchId: ActiveBranchId
  branchNameAr: string
  branchNameEn: string
  channelId: ActiveChannelId
  channelNameAr: string
  channelNameEn: string
  basketKwd: number
  tier: PrepSlaTier
  delayRootCauseAr: string
  delayRootCauseEn: string
}

export interface PrepSlaEntitySummary<ID extends string> {
  id: ID
  nameAr: string
  nameEn: string
  ticketCount: number
  avgPrepMinutes: number
  avgDurationMmSs: string
  p90PrepMinutes: number
  greenCount: number
  yellowCount: number
  redCount: number
  greenPct: number
  yellowPct: number
  redPct: number
  tier: PrepSlaTier
}

export interface PrepSlaBrandBranchCell {
  brandId: ActiveBrandId
  branchId: ActiveBranchId
  ticketCount: number
  avgPrepMinutes: number
  tier: PrepSlaTier
  redPct: number
}

export interface PrepSlaHourBucket {
  hourIndex: number
  labelAr: string
  labelEn: string
  totalTickets: number
  greenCount: number
  yellowCount: number
  redCount: number
  redSharePct: number
  avgPrepMinutes: number
  tier: PrepSlaTier
}

export interface OrderPrepSlaSnapshot {
  unlinkedSource: boolean
  messageAr: string
  messageEn: string
  filters: GlobalFilters
  totalTickets: number
  avgPrepMinutes: number
  avgDurationMmSs: string
  p90PrepMinutes: number
  greenCount: number
  yellowCount: number
  redCount: number
  greenPct: number
  yellowPct: number
  redPct: number
  overallTier: PrepSlaTier
  branchMatrix: PrepSlaEntitySummary<ActiveBranchId>[]
  brandMatrix: PrepSlaEntitySummary<ActiveBrandId>[]
  brandBranchCells: PrepSlaBrandBranchCell[]
  hourlyBottlenecks: PrepSlaHourBucket[]
  tickets: PrepSlaOrderTicket[]
}

export function classifyPrepSlaTier(prepMinutes: number): PrepSlaTier {
  if (prepMinutes <= 12.0) return 'green'
  if (prepMinutes <= 18.0) return 'yellow'
  return 'red'
}

export function formatSecondsMmSs(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Disabled KDS ticket engine: Odoo 17 POS has no live KDS prep timestamps
 * connected in this deployment. Returns `unlinkedSource: true` and
 * `messageAr: 'غير مربوط بمصدر'` with zero tickets.
 */
export function computeOrderPrepSlaSnapshot(
  filters: GlobalFilters = DEFAULT_GLOBAL_FILTERS,
  _workspaceOverride?: GlobalWorkspaceSlice,
  _liveSummary?: OdooLiveSummary | null,
): OrderPrepSlaSnapshot {
  return {
    unlinkedSource: true,
    messageAr: 'غير مربوط بمصدر',
    messageEn: 'Not linked to a KDS data source',
    filters,
    totalTickets: 0,
    avgPrepMinutes: 0,
    avgDurationMmSs: '00:00',
    p90PrepMinutes: 0,
    greenCount: 0,
    yellowCount: 0,
    redCount: 0,
    greenPct: 0,
    yellowPct: 0,
    redPct: 0,
    overallTier: 'green',
    branchMatrix: [],
    brandMatrix: [],
    brandBranchCells: [],
    hourlyBottlenecks: [],
    tickets: [],
  }
}
