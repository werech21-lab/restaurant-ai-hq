'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { useGovernance } from '@/components/erp/GovernanceBellDrawer'
import {
  computeWarehouseDailyChain,
  RAW_MATERIAL_CATEGORIES,
  type BranchDailyChainNode,
  type ChainHealthStatus,
  type RawMaterialCategory,
  type WarehouseDailyChainDay,
} from '@/lib/warehouse-prep-engine'

const CARD_CLS =
  'ae-bento-card rounded-2xl bg-white p-3.5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const KPI_CARD_CLS =
  'ae-kpi-card rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const SUBCARD_CLS =
  'rounded-2xl bg-[#F6F7F8] ring-1 ring-slate-900/[0.03] dark:bg-[#0B1410] dark:ring-emerald-500/[0.08]'
const SEGMENT_TRACK_CLS =
  'flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]'
const SEGMENT_BTN_CLS =
  'shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 cursor-pointer'
const SEGMENT_BTN_ACTIVE_CLS =
  'bg-white font-semibold text-emerald-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/25'
const SEGMENT_BTN_IDLE_CLS =
  'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
const TABLE_SCROLL_CLS = 'overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0'
const PAGE_SIZE = 12

const f0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')
const f1 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
const f2 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

function HealthBadge({ status, isAr }: { status: ChainHealthStatus; isAr: boolean }) {
  if (status === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs lg:text-[13px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
        <span>🔴</span>
        <span>{isAr ? 'تجاوز حرج' : 'Critical'}</span>
      </span>
    )
  }
  if (status === 'watch') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs lg:text-[13px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
        <span>🟡</span>
        <span>{isAr ? 'مراقبة هادئة' : 'Watch'}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs lg:text-[13px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
      <span>🟢</span>
      <span>{isAr ? 'مطابق' : 'Reconciled'}</span>
    </span>
  )
}

export function WarehouseDailyChainStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const T = useCallback((en: string, ar: string) => (isAr ? ar : en), [isAr])

  const { filters, workspace } = useGlobalFilter()
  const { requestApproval, getApprovalByRef, openDrawer } = useGovernance()

  const [materialCategory, setMaterialCategory] = useState<RawMaterialCategory>('all')
  const [selectedDayIso, setSelectedDayIso] = useState<string>('latest')
  const [ledgerPage, setLedgerPage] = useState<number>(1)
  const [toastMsg, setToastMsg] = useState<{ ar: string; en: string } | null>(null)

  const snap = useMemo(
    () => computeWarehouseDailyChain(filters, workspace, materialCategory),
    [filters, materialCategory, workspace],
  )

  useEffect(() => {
    setLedgerPage(1)
    setSelectedDayIso('latest')
  }, [
    filters.period,
    filters.branch,
    filters.brand,
    filters.channel,
    filters.customFrom,
    filters.customTo,
    materialCategory,
  ])

  const activeDay = useMemo(() => {
    if (selectedDayIso === 'period') return null
    if (selectedDayIso === 'latest') return snap.latestDay
    return snap.days.find((d) => d.dateIso === selectedDayIso) ?? snap.latestDay
  }, [selectedDayIso, snap.days, snap.latestDay])

  const activeBranchesRows: BranchDailyChainNode[] = useMemo(() => {
    if (!activeDay) return snap.branchPeriodSummary
    return [...activeDay.branches].sort((a, b) => b.posSalesKwd - a.posSalesKwd)
  }, [activeDay, snap.branchPeriodSummary])

  const unitLabel = isAr ? snap.categoryMeta.unitAr : snap.categoryMeta.unitEn

  const heroMetrics = useMemo(() => {
    if (activeDay) {
      return {
        modeTitleAr: `سلسلة يوم ${activeDay.dayLabelAr} (${activeDay.dateIso})`,
        modeTitleEn: `Daily Chain for ${activeDay.dayLabelEn} (${activeDay.dateIso})`,
        stage1StockKwd: activeDay.warehouseOnHandTotalKwd,
        stage1StockKg: activeDay.warehouseOnHandTotalKg,
        stage1SubAr: `افتتاح ${f0(activeDay.warehouseOpeningKwd)} + وارد ${f0(activeDay.supplierInboundKwd)} ➔ إغلاق ${f0(activeDay.warehouseClosingKwd)} د.ك`,
        stage1SubEn: `Open ${f0(activeDay.warehouseOpeningKwd)} + Inbound ${f0(activeDay.supplierInboundKwd)} ➔ Close ${f0(activeDay.warehouseClosingKwd)} KWD`,
        stage2OutKwd: activeDay.warehouseDispatchedKwd,
        stage2OutKg: activeDay.warehouseDispatchedKg,
        stage2Moves: activeDay.dispatchMoves,
        stage3RecvKwd: activeDay.branchesReceivedKwd,
        stage3RecvKg: activeDay.branchesReceivedKg,
        stage3GapKwd: activeDay.transitGapKwd,
        stage3GapKg: activeDay.transitGapKg,
        stage4SalesKwd: activeDay.branchesPosSalesKwd,
        stage4Orders: activeDay.branchesOrders,
        stage4TheoKwd: activeDay.bomTheoreticalCostKwd,
        stage4ConsumedKwd: activeDay.actualConsumedKwd,
        stage4ShrinkKwd: activeDay.abnormalShrinkageKwd,
        stage4ShrinkKg: activeDay.abnormalShrinkageKg,
        stage4WastePct: activeDay.wastePct,
      }
    }
    const p = snap.periodTotals
    return {
      modeTitleAr: `إجمالي السلسلة للفترة (${snap.fromIso} ← ${snap.toIso} · ${snap.dayCount} يوم)`,
      modeTitleEn: `Window Chain (${snap.fromIso} -> ${snap.toIso} · ${snap.dayCount}d)`,
      stage1StockKwd: p.avgDailyOnHandWarehouseKwd,
      stage1StockKg: p.avgDailyOnHandWarehouseKg,
      stage1SubAr: `افتتاح ${f0(p.openingWarehouseKwd)} + وارد ${f0(p.totalSupplierInboundKwd)} ➔ إغلاق ${f0(p.closingWarehouseKwd)} د.ك`,
      stage1SubEn: `Open ${f0(p.openingWarehouseKwd)} + Inbound ${f0(p.totalSupplierInboundKwd)} ➔ Close ${f0(p.closingWarehouseKwd)} KWD`,
      stage2OutKwd: p.totalDispatchedKwd,
      stage2OutKg: p.totalDispatchedKg,
      stage2Moves: p.totalDispatchMoves,
      stage3RecvKwd: p.totalBranchesReceivedKwd,
      stage3RecvKg: p.totalBranchesReceivedKg,
      stage3GapKwd: p.totalTransitGapKwd,
      stage3GapKg: p.totalTransitGapKg,
      stage4SalesKwd: p.totalBranchesSalesKwd,
      stage4Orders: p.totalBranchesOrders,
      stage4TheoKwd: p.totalBomTheoreticalKwd,
      stage4ConsumedKwd: p.totalActualConsumedKwd,
      stage4ShrinkKwd: p.totalAbnormalShrinkageKwd,
      stage4ShrinkKg: p.totalAbnormalShrinkageKg,
      stage4WastePct: p.periodWastePct,
    }
  }, [activeDay, snap.dayCount, snap.fromIso, snap.periodTotals, snap.toIso])

  const ArrowConnector = isAr ? ArrowLeft : ArrowRight

  const reversedDays = useMemo(() => [...snap.days].reverse(), [snap.days])
  const totalPages = Math.max(1, Math.ceil(reversedDays.length / PAGE_SIZE))
  const safePage = Math.min(ledgerPage, totalPages)
  const paginatedDays = useMemo(
    () => reversedDays.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [reversedDays, safePage],
  )

  const handleQueueBranchInvestigation = useCallback(
    (b: BranchDailyChainNode) => {
      const refKey = `warehouse-chain:${b.branchId}:${materialCategory}:${activeDay?.dateIso ?? snap.toIso}`
      const recoverableKwd = Math.max(55, Math.round(b.abnormalShrinkageKwd * 0.65 + b.transitGapKwd))
      requestApproval({
        refKey,
        domain: 'operations',
        titleAr: `تحقيق انحراف هدر حرج — فرع ${b.branchNameAr}`,
        titleEn: `Critical Waste & Transit Investigation — ${b.branchNameEn}`,
        summaryAr: `مخزن ومطبخ العارضية المركزي ➔ ${b.branchNameAr}: المنصرف ${f1(b.dispatchedFromWarehouseKwd)} د.ك، المستلم ${f1(b.receivedByBranchKwd)} د.ك (فرق نقل ${f2(b.transitGapKwd)} د.ك)، وانحراف هدر ${f1(b.abnormalShrinkageKwd)} د.ك (${f1(b.wastePct)}%).`,
        summaryEn: `Ardiya Central Warehouse ➔ ${b.branchNameEn}: Outbound ${f1(b.dispatchedFromWarehouseKwd)} KWD, Received ${f1(b.receivedByBranchKwd)} KWD (transit gap ${f2(b.transitGapKwd)} KWD), waste variance ${f1(b.abnormalShrinkageKwd)} KWD (${f1(b.wastePct)}%).`,
        departmentAr: 'مخزن ومطبخ العارضية المركزي والرقابة',
        departmentEn: 'Ardiya Central Warehouse & Audit',
        budgetOrCostKwd: 0,
        expectedMonthlyReturnKwd: recoverableKwd,
        href: '/erp/warehouse-chain',
      })
      setToastMsg({
        ar: `تم تصعيد انحراف فرع ${b.branchNameAr} إلى جرس المدير 🔔`,
        en: `Escalated ${b.branchNameEn} variance to Manager Bell 🔔`,
      })
      window.setTimeout(() => setToastMsg(null), 3200)
    },
    [activeDay?.dateIso, materialCategory, requestApproval, snap.toIso],
  )

  const handleQueueDayInvestigation = useCallback(
    (d: WarehouseDailyChainDay) => {
      const refKey = `warehouse-day:${d.dateIso}:${materialCategory}`
      const recoverableKwd = Math.max(65, Math.round(d.abnormalShrinkageKwd * 0.65 + d.transitGapKwd))
      requestApproval({
        refKey,
        domain: 'operations',
        titleAr: `تحقيق سلسلة المخزن والفروع ليوم ${d.dateIso}`,
        titleEn: `Daily Warehouse Chain Audit (${d.dateIso})`,
        summaryAr: `المنصرف من العارضية ${f1(d.warehouseDispatchedKwd)} د.ك مقابل المستلم ${f1(d.branchesReceivedKwd)} د.ك (فرق نقل ${f2(d.transitGapKwd)} د.ك) وانحراف هدر يومي ${f1(d.abnormalShrinkageKwd)} د.ك (${f1(d.wastePct)}%).`,
        summaryEn: `Ardiya outbound ${f1(d.warehouseDispatchedKwd)} KWD vs received ${f1(d.branchesReceivedKwd)} KWD (gap ${f2(d.transitGapKwd)} KWD) and daily waste ${f1(d.abnormalShrinkageKwd)} KWD (${f1(d.wastePct)}%).`,
        departmentAr: 'مخزن ومطبخ العارضية المركزي',
        departmentEn: 'Ardiya Central Warehouse',
        budgetOrCostKwd: 0,
        expectedMonthlyReturnKwd: recoverableKwd,
        href: '/erp/warehouse-chain',
      })
      setToastMsg({
        ar: `تم تصعيد يوم ${d.dateIso} إلى جرس المدير 🔔`,
        en: `Escalated daily chain (${d.dateIso}) to Manager Bell 🔔`,
      })
      window.setTimeout(() => setToastMsg(null), 3200)
    },
    [materialCategory, requestApproval],
  )

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-[1920px] mx-auto space-y-6 pb-12 font-sans text-[14px] sm:text-[15px] text-neutral-900 antialiased dark:text-slate-100"
    >
      {toastMsg ? (
        <div className="fixed bottom-20 lg:bottom-6 end-6 z-50 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[13.5px] font-semibold text-emerald-800 shadow-xl ring-1 ring-emerald-500/25 dark:bg-[#101C17] dark:text-emerald-300 dark:ring-emerald-500/20">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{isAr ? toastMsg.ar : toastMsg.en}</span>
        </div>
      ) : null}

      {/* ───────────── 1. Slim Contextual Bar + Scrollable Raw Material Category Segmented Control ───────────── */}
      <div className={`${CARD_CLS} !p-3.5 sm:!p-4 space-y-3`}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Package className="h-4 w-4" />
            </span>
            <p className="min-w-0 text-[13px] sm:text-[13.5px] font-medium leading-snug text-slate-600 dark:text-slate-300">
              {T(
                `Ardiya Central Warehouse ➔ 7 Branches • ${heroMetrics.modeTitleEn}`,
                `مخزن ومطبخ العارضية المركزي ⟵ الفروع الـ ٧ • ${heroMetrics.modeTitleAr}`,
              )}
            </p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1 text-[13px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>
                {T('0.000 Drift · 7 Branches', 'تطابق 0.000 · ٧ فروع')}
              </span>
            </span>
            <span
              className={`shrink-0 rounded-xl px-2.5 py-1 text-[13px] font-semibold tabular-nums ${
                heroMetrics.stage3GapKwd === 0
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
              }`}
            >
              {heroMetrics.stage3GapKwd === 0
                ? T('Transit Gap: 0.00 KWD', 'فرق النقل: 0.00 د.ك')
                : T(
                    `Transit Gap: ${f2(heroMetrics.stage3GapKwd)} KWD`,
                    `فرق النقل: ${f2(heroMetrics.stage3GapKwd)} د.ك`,
                  )}
            </span>
          </div>

          <div className="flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar">
            <div role="tablist" className={SEGMENT_TRACK_CLS}>
              <button
                type="button"
                role="tab"
                aria-selected={activeDay !== null}
                onClick={() => setSelectedDayIso('latest')}
                className={`${SEGMENT_BTN_CLS} ${
                  activeDay !== null ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                }`}
              >
                {T('Single Day 📅', 'حركة يوم بيوم 📅')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedDayIso === 'period'}
                onClick={() => setSelectedDayIso('period')}
                className={`${SEGMENT_BTN_CLS} ${
                  selectedDayIso === 'period' ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                }`}
              >
                {T(`Full Window (${snap.dayCount}d) 📊`, `إجمالي الفترة (${snap.dayCount} يوم) 📊`)}
              </button>
            </div>

            <Link
              href={`/erp/feryal-ai?prompt=${encodeURIComponent(
                isAr
                  ? `افحصي سلسلة مخزن ومطبخ العارضية المركزي (${heroMetrics.modeTitleAr} · ${snap.categoryMeta.ar}): رصيد المخزن ${f0(heroMetrics.stage1StockKwd)} د.ك، المنصرف للأفرع ${f1(heroMetrics.stage2OutKwd)} د.ك، المستلم ${f1(heroMetrics.stage3RecvKwd)} د.ك، والمباع ${f0(heroMetrics.stage4SalesKwd)} د.ك مع انحراف هدر ${f1(heroMetrics.stage4ShrinkKwd)} د.ك.`
                  : `Audit Ardiya Central Warehouse-to-Branch chain (${heroMetrics.modeTitleEn}).`,
              )}`}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-50 px-3.5 text-[13px] font-semibold text-emerald-800 ring-1 ring-emerald-500/20 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-400/25"
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>{T('Ask Feryal ✨', 'اسأل فريال ✨')}</span>
            </Link>
          </div>
        </div>

        {/* Horizontal Touch-Scrollable Raw Material Category Segmented Control */}
        <div
          role="tablist"
          aria-label={T('Raw Material Category', 'فئة المواد الخام بالمخزن')}
          className={SEGMENT_TRACK_CLS}
        >
          {RAW_MATERIAL_CATEGORIES.map((cat) => {
            const active = materialCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMaterialCategory(cat.id)}
                className={`${SEGMENT_BTN_CLS} ${
                  active ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                }`}
              >
                {isAr ? cat.ar : cat.en}
              </button>
            )
          })}
        </div>
      </div>

      {/* ───────────── 2. Connected 4-Stage KPI Grid (`2x2` Mobile Grid) ───────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Node 1 */}
        <article className={`${KPI_CARD_CLS} flex flex-col justify-between`}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1 text-[13px] sm:text-[12px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Package className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{T('1. Warehouse Stock', '١. رصيد المخزن')}</span>
            </span>
            <span className="hidden lg:inline-flex text-emerald-600 dark:text-emerald-400">
              <ArrowConnector className="h-4 w-4" />
            </span>
          </div>
          <div className="my-2.5 sm:my-3">
            <div className="text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white">
              {f0(heroMetrics.stage1StockKwd)}{' '}
              <span className="text-[12px] sm:text-[14px] font-semibold text-neutral-500">
                {isAr ? 'د.ك' : 'KWD'}
              </span>
            </div>
            <div className="mt-1 text-[12px] sm:text-[13px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              {f1(heroMetrics.stage1StockKg)} {unitLabel}
            </div>
          </div>
          <p className="text-[13px] sm:text-[12.5px] leading-snug text-neutral-500 dark:text-slate-400">
            {isAr ? heroMetrics.stage1SubAr : heroMetrics.stage1SubEn}
          </p>
        </article>

        {/* Node 2 */}
        <article className={`${KPI_CARD_CLS} flex flex-col justify-between`}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-xl bg-sky-50 px-2.5 py-1 text-[13px] sm:text-[12px] font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
              <Truck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{T('2. Daily Outbound', '٢. المنصرف الخارج')}</span>
            </span>
            <span className="hidden lg:inline-flex text-sky-600 dark:text-sky-400">
              <ArrowConnector className="h-4 w-4" />
            </span>
          </div>
          <div className="my-2.5 sm:my-3">
            <div className="text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white">
              {f1(heroMetrics.stage2OutKwd)}{' '}
              <span className="text-[12px] sm:text-[14px] font-semibold text-neutral-500">
                {isAr ? 'د.ك' : 'KWD'}
              </span>
            </div>
            <div className="mt-1 text-[12px] sm:text-[13px] font-semibold tabular-nums text-sky-700 dark:text-sky-300">
              {f1(heroMetrics.stage2OutKg)} {unitLabel} · {f0(heroMetrics.stage2Moves)}{' '}
              {isAr ? 'أمر' : 'mv'}
            </div>
          </div>
          <p className="text-[13px] sm:text-[12.5px] leading-snug text-neutral-500 dark:text-slate-400">
            {T(
              'Daily dispatches leaving Ardiya Central Warehouse.',
              'الكميات الخارجة يومياً من مخزن ومطبخ العارضية المركزي.',
            )}
          </p>
        </article>

        {/* Node 3 */}
        <article className={`${KPI_CARD_CLS} flex flex-col justify-between`}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-2.5 py-1 text-[13px] sm:text-[12px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              <Store className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{T('3. Branch Received', '٣. المستلم بالفرع')}</span>
            </span>
            <span className="hidden lg:inline-flex text-amber-600 dark:text-amber-400">
              <ArrowConnector className="h-4 w-4" />
            </span>
          </div>
          <div className="my-2.5 sm:my-3">
            <div className="text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white">
              {f1(heroMetrics.stage3RecvKwd)}{' '}
              <span className="text-[12px] sm:text-[14px] font-semibold text-neutral-500">
                {isAr ? 'د.ك' : 'KWD'}
              </span>
            </div>
            <div className="mt-1 text-[12px] sm:text-[13px] font-semibold tabular-nums text-amber-800 dark:text-amber-300">
              {f1(heroMetrics.stage3RecvKg)} {unitLabel}
            </div>
          </div>
          <p className="text-[13px] sm:text-[12.5px] leading-snug text-neutral-500 dark:text-slate-400">
            {heroMetrics.stage3GapKwd === 0
              ? T('100% signed across branches (0.00 gap).', 'مستلم وموقع بالكامل (فرق النقل = 0).')
              : T(
                  `Transit gap: ${f2(heroMetrics.stage3GapKwd)} KWD.`,
                  `فجوة نقل مكتشفة: ${f2(heroMetrics.stage3GapKwd)} د.ك.`,
                )}
          </p>
        </article>

        {/* Node 4 */}
        <article className={`${KPI_CARD_CLS} flex flex-col justify-between`}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1 text-[13px] sm:text-[12px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{T('4. Sold & Waste', '٤. المباع والهدر')}</span>
            </span>
            <span className="shrink-0 rounded-lg bg-[#F6F7F8] px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-700 dark:bg-[#0B1410] dark:text-emerald-300">
              {f0(heroMetrics.stage4Orders)}
            </span>
          </div>
          <div className="my-2.5 sm:my-3">
            <div className="text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white">
              {f0(heroMetrics.stage4SalesKwd)}{' '}
              <span className="text-[12px] sm:text-[14px] font-semibold text-neutral-500">
                {isAr ? 'د.ك' : 'KWD'}
              </span>
            </div>
            <div className="mt-1 text-[12px] sm:text-[13px] font-semibold tabular-nums text-neutral-600 dark:text-slate-300">
              {T(
                `Waste: ${f1(heroMetrics.stage4ShrinkKwd)} KWD (${f1(heroMetrics.stage4WastePct)}%)`,
                `الهدر: ${f1(heroMetrics.stage4ShrinkKwd)} د.ك (${f1(heroMetrics.stage4WastePct)}%)`,
              )}
            </div>
          </div>
          <p className="text-[13px] sm:text-[12.5px] leading-snug text-neutral-500 dark:text-slate-400">
            {T(
              `BOM ${f1(heroMetrics.stage4TheoKwd)} vs Actual ${f1(heroMetrics.stage4ConsumedKwd)} KWD.`,
              `معياري ${f1(heroMetrics.stage4TheoKwd)} مقابل فعلي ${f1(heroMetrics.stage4ConsumedKwd)} د.ك.`,
            )}
          </p>
        </article>
      </section>

      {/* ───────────── 3. 7-Branch Connected Chain Matrix (~85% 🟢/🟡 quiet, ONLY 1–2 🔴 escalate) ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight text-neutral-950 dark:text-white">
              {T(
                '7-Branch Daily Receipt, POS Depletion & Waste Variance Matrix',
                'مطابقة الفروع السبعة (الأفنيوز، مول 360، العاصمة، بروميناد، السالمية، الكوت، العارضية)',
              )}
            </h2>
            <p className="text-[13.5px] text-neutral-500 dark:text-slate-400">
              {T(
                'Green & Yellow branches operate without alarm clutter; only genuine critical (>3.2%) outliers show Escalate ↗.',
                'الفروع المنضبطة والمتوسطة تعمل بهدوء بدون ضوضاء أزرار؛ ويظهر زر تصعيد ↗ فقط عند وجود تجاوز حرج فعلي.',
              )}
            </p>
          </div>
        </div>

        <div className={TABLE_SCROLL_CLS}>
          <table className="w-full min-w-[1040px] border-collapse text-start text-[14px] sm:text-[14.5px]">
            <thead>
              <tr className="border-b border-neutral-100 text-xs lg:text-[13px] font-semibold text-neutral-500 dark:border-white/[0.06] dark:text-slate-400">
                <th className="sticky start-0 z-10 bg-white py-3 pe-3 text-start whitespace-nowrap dark:bg-[#101C17]">
                  {T('Branch', 'الفرع')}
                </th>
                <th className="px-3 py-3 text-start whitespace-nowrap">
                  {T('Warehouse Outbound', 'المنصرف من المخزن')}
                </th>
                <th className="px-3 py-3 text-start whitespace-nowrap">
                  {T('Branch Received', 'المستلم الفعلي بالفرع')}
                </th>
                <th className="px-3 py-3 text-start whitespace-nowrap">
                  {T('Transit Gap', 'المنصرف - المستلم')}
                </th>
                <th className="px-3 py-3 text-start whitespace-nowrap">
                  {T('POS Sold', 'المباع فعلياً (POS)')}
                </th>
                <th className="px-3 py-3 text-start whitespace-nowrap">
                  {T('Daily Waste Variance', 'انحراف الهدر اليومي')}
                </th>
                <th className="px-3 py-3 text-start whitespace-nowrap">{T('Status', 'الحالة')}</th>
                <th className="py-3 ps-3 text-end whitespace-nowrap">{T('Action', 'الإجراء')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
              {activeBranchesRows.map((b) => {
                const refKey = `warehouse-chain:${b.branchId}:${materialCategory}:${activeDay?.dateIso ?? snap.toIso}`
                const existing = getApprovalByRef(refKey)
                return (
                  <tr
                    key={b.branchId}
                    className="transition-colors hover:bg-[#F6F7F8]/70 dark:hover:bg-white/[0.03]"
                  >
                    <td className="sticky start-0 z-10 bg-white py-3.5 pe-3 font-semibold whitespace-nowrap text-neutral-950 dark:bg-[#101C17] dark:text-white">
                      <div>{isAr ? b.branchNameAr : b.branchNameEn}</div>
                      <div className="text-xs lg:text-[13px] font-normal text-neutral-400">
                        {f0(b.transferMoves)} {isAr ? 'حركة استلام' : 'moves'}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 tabular-nums">
                      <div className="font-semibold text-neutral-900 dark:text-slate-100">
                        {f1(b.dispatchedFromWarehouseKwd)} {isAr ? 'د.ك' : 'KWD'}
                      </div>
                      <div className="text-xs lg:text-[13px] text-sky-700 dark:text-sky-300">
                        {f1(b.dispatchedKg)} {unitLabel}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 tabular-nums">
                      <div className="font-semibold text-neutral-900 dark:text-slate-100">
                        {f1(b.receivedByBranchKwd)} {isAr ? 'د.ك' : 'KWD'}
                      </div>
                      <div className="text-xs lg:text-[13px] text-emerald-700 dark:text-emerald-300">
                        {f1(b.receivedKg)} {unitLabel}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 tabular-nums">
                      {b.transitGapKwd === 0 ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          0.00 {isAr ? 'مطابق' : 'Exact'}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[12px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                          {f2(b.transitGapKwd)} {isAr ? 'د.ك' : 'KWD'}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3.5 tabular-nums">
                      <div className="font-bold text-neutral-950 dark:text-white">
                        {f1(b.posSalesKwd)} {isAr ? 'د.ك' : 'KWD'}
                      </div>
                      <div className="text-[12px] text-neutral-500">
                        {f0(b.posOrders)} {isAr ? 'طلب' : 'orders'}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 tabular-nums">
                      <div className="text-neutral-700 dark:text-slate-200">
                        {isAr ? 'معياري' : 'BOM'} {f1(b.bomTheoreticalCostKwd)} ←{' '}
                        <span className="font-semibold">
                          {isAr ? 'فعلي' : 'Actual'} {f1(b.actualConsumedKwd)}
                        </span>
                      </div>
                      <div
                        className={`text-[12.5px] font-semibold ${
                          b.health === 'critical'
                            ? 'text-rose-600 dark:text-rose-400'
                            : b.health === 'watch'
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {f1(b.abnormalShrinkageKwd)} {isAr ? 'د.ك' : 'KWD'} ({f1(b.wastePct)}%)
                      </div>
                    </td>

                    <td className="px-3 py-3.5">
                      <HealthBadge status={b.health} isAr={isAr} />
                    </td>

                    <td className="py-3.5 ps-3 text-end">
                      {b.health === 'critical' ? (
                        existing ? (
                          <button
                            type="button"
                            onClick={() => openDrawer('approvals')}
                            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-3 text-[12.5px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300"
                          >
                            {T('Escalated ✓', 'تم التصعيد ✓')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="طلب تحقيق / إيقاف هدر عبر جرس المدير 🔔"
                            onClick={() => handleQueueBranchInvestigation(b)}
                            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-rose-200/80 bg-rose-50/70 px-3 text-[12.5px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200"
                          >
                            {T('Escalate ↗', 'تصعيد ↗')}
                          </button>
                        )
                      ) : (
                        <span className="select-none text-neutral-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ───────────── 4. Paginated Daily Chain Table (12 Rows / Page) ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight text-neutral-950 dark:text-white">
              {T(
                'Paginated Daily Warehouse-to-Branch Reconciled Ledger (12 Days / Page)',
                'دفتر السلسلة اليومية المتصلة يوماً بيوم (١٢ صفاً بالصفحة · ترحيل 0.000)',
              )}
            </h2>
            <p className="text-[13.5px] text-neutral-500 dark:text-slate-400">
              {T(
                'Opening + Inbound - Outbound === Closing every single day; click any row to inspect branch breakdown.',
                'رصيد أول اليوم + التوريد - المنصرف = رصيد الإغلاق بدقة تامة كل يوم؛ اضغط أي سطر لمعاينة تفصيل الفروع.',
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 text-[13px]">
            <span className="tabular-nums text-neutral-500 dark:text-slate-400">
              {T(
                `Page ${safePage} of ${totalPages} (${reversedDays.length} days)`,
                `صفحة ${safePage} من ${totalPages} (${reversedDays.length} يوم)`,
              )}
            </span>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-[#F6F7F8] text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-40 dark:bg-white/[0.06] dark:text-slate-200"
              aria-label={T('Previous page', 'الصفحة السابقة')}
            >
              {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setLedgerPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-[#F6F7F8] text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-40 dark:bg-white/[0.06] dark:text-slate-200"
              aria-label={T('Next page', 'الصفحة التالية')}
            >
              {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className={TABLE_SCROLL_CLS}>
          <table className="w-full min-w-[1080px] border-collapse text-start text-[14px] sm:text-[14.5px]">
            <thead>
              <tr className="border-b border-neutral-100 text-[12.5px] font-semibold text-neutral-500 dark:border-white/[0.06] dark:text-slate-400">
                <th className="sticky start-0 z-10 bg-white py-3 pe-3 text-start whitespace-nowrap dark:bg-[#101C17]">
                  {T('Date', 'التاريخ')}
                </th>
                <th className="px-3 py-3 text-start whitespace-nowrap">
                  {T('1. Opening + Inbound', '١. رصيد المخزن اليومي')}
                </th>
                <th className="px-3 py-3 text-start whitespace-nowrap">
                  {T('2. Warehouse Outbound', '٢. المنصرف الخارج يومياً')}
                </th>
                <th className="px-3 py-3 text-start whitespace-nowrap">
                  {T('Warehouse Closing', 'رصيد الإغلاق المرحّل')}
                </th>
                <th className="px-3 py-3 text-start whitespace-nowrap">
                  {T('3. Branch Received & Gap', '٣. المستلم الفعلي وفرق النقل')}
                </th>
                <th className="px-3 py-3 text-start whitespace-nowrap">
                  {T('4. Sold & Waste Variance', '٤. المباع وانحراف الهدر')}
                </th>
                <th className="px-3 py-3 text-start whitespace-nowrap">{T('Status', 'الحالة')}</th>
                <th className="py-3 ps-3 text-end whitespace-nowrap">{T('Action', 'الإجراء')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
              {paginatedDays.map((d) => {
                const selected = activeDay?.dateIso === d.dateIso
                const dayRef = `warehouse-day:${d.dateIso}:${materialCategory}`
                const dayQueued = getApprovalByRef(dayRef)
                return (
                  <tr
                    key={d.dateIso}
                    onClick={() => setSelectedDayIso(d.dateIso)}
                    className={`cursor-pointer transition-colors ${
                      selected
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30'
                        : 'hover:bg-[#F6F7F8]/80 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <td className="sticky start-0 z-10 bg-white py-3.5 pe-3 font-semibold whitespace-nowrap tabular-nums text-neutral-950 dark:bg-[#101C17] dark:text-white">
                      <div>{isAr ? d.dayLabelAr : d.dayLabelEn}</div>
                      <div className="text-[12px] font-normal text-neutral-400">{d.dateIso}</div>
                    </td>

                    <td className="px-3 py-3.5 tabular-nums">
                      <div className="font-semibold text-neutral-900 dark:text-white">
                        {f0(d.warehouseOnHandTotalKwd)} {isAr ? 'د.ك' : 'KWD'} (
                        {f1(d.warehouseOnHandTotalKg)} {unitLabel})
                      </div>
                      <div className="text-[12px] text-neutral-400">
                        {f0(d.warehouseOpeningKwd)} + {f0(d.supplierInboundKwd)}{' '}
                        {isAr ? 'توريد' : 'inbound'}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 font-semibold tabular-nums text-sky-700 dark:text-sky-300">
                      <div>
                        -{f1(d.warehouseDispatchedKwd)} {isAr ? 'د.ك' : 'KWD'}
                      </div>
                      <div className="text-[12px] font-normal text-neutral-400">
                        {f1(d.warehouseDispatchedKg)} {unitLabel} · {d.dispatchMoves}{' '}
                        {isAr ? 'حركة' : 'mv'}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 font-semibold tabular-nums text-neutral-800 dark:text-slate-200">
                      <div>
                        {f0(d.warehouseClosingKwd)} {isAr ? 'د.ك' : 'KWD'}
                      </div>
                      <div className="text-[12px] font-normal text-neutral-400">
                        {f1(d.warehouseClosingKg)} {unitLabel}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 tabular-nums">
                      <div className="font-semibold text-amber-800 dark:text-amber-300">
                        {f1(d.branchesReceivedKwd)} {isAr ? 'د.ك' : 'KWD'}
                      </div>
                      <div className="text-[12px] text-neutral-500">
                        {d.transitGapKwd === 0
                          ? isAr
                            ? 'فرق النقل: 0.00'
                            : 'Gap: 0.00'
                          : isAr
                            ? `فرق نقل: ${f2(d.transitGapKwd)} د.ك`
                            : `Gap: ${f2(d.transitGapKwd)} KWD`}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 tabular-nums">
                      <div className="font-bold text-emerald-800 dark:text-emerald-300">
                        {f1(d.branchesPosSalesKwd)} {isAr ? 'د.ك' : 'KWD'} ({f0(d.branchesOrders)}{' '}
                        {isAr ? 'طلب' : 'ord'})
                      </div>
                      <div
                        className={`text-[12px] font-medium ${
                          d.health === 'critical'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-neutral-500 dark:text-slate-400'
                        }`}
                      >
                        {isAr ? 'هدر:' : 'Waste:'} {f1(d.abnormalShrinkageKwd)}{' '}
                        {isAr ? 'د.ك' : 'KWD'} ({f1(d.wastePct)}%)
                      </div>
                    </td>

                    <td className="px-3 py-3.5">
                      <HealthBadge status={d.health} isAr={isAr} />
                    </td>

                    <td className="py-3.5 ps-3 text-end" onClick={(e) => e.stopPropagation()}>
                      {d.health === 'critical' ? (
                        dayQueued ? (
                          <button
                            type="button"
                            onClick={() => openDrawer('approvals')}
                            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-3 text-[12.5px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300"
                          >
                            {T('Escalated ✓', 'تم التصعيد ✓')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQueueDayInvestigation(d)}
                            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-rose-200/80 bg-rose-50/70 px-3 text-[12.5px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200"
                          >
                            {T('Escalate ↗', 'تصعيد ↗')}
                          </button>
                        )
                      ) : (
                        <span className="select-none text-neutral-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
