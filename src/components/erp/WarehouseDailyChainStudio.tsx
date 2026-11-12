'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  Check,
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
  'ae-bento-card bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[#0D1614]'
const SUBCARD_CLS = 'rounded-2xl bg-[#F7F7F8] dark:bg-[#111E1B]'
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
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
        <span>🔴</span>
        <span>{isAr ? 'انحراف يتطلب تحقيق' : 'Critical Variance'}</span>
      </span>
    )
  }
  if (status === 'watch') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
        <span>🟡</span>
        <span>{isAr ? 'تجاوز ١٫٨٪ / فرق نقل' : 'Watch (>1.8% / Gap)'}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
      <span>🟢</span>
      <span>{isAr ? 'مطابق ومنضبط' : 'Reconciled'}</span>
    </span>
  )
}

export function WarehouseDailyChainStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const T = useCallback((en: string, ar: string) => (isAr ? ar : en), [isAr])

  const { filters, workspace, setBranch } = useGlobalFilter()
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
  }, [filters.period, filters.branch, filters.brand, filters.customFrom, filters.customTo, materialCategory])

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
        titleAr: `طلب تحقيق / إيقاف هدر — فرع ${b.branchNameAr}`,
        titleEn: `Transit & Waste Investigation — ${b.branchNameEn}`,
        summaryAr: `مخزن ومطبخ العارضية المركزي ➔ ${b.branchNameAr}: المنصرف ${f1(b.dispatchedFromWarehouseKwd)} د.ك، المستلم ${f1(b.receivedByBranchKwd)} د.ك (فرق نقل ${f2(b.transitGapKwd)} د.ك)، وانحراف هدر ${f1(b.abnormalShrinkageKwd)} د.ك (${f1(b.wastePct)}%).`,
        summaryEn: `Ardiya Central Warehouse ➔ ${b.branchNameEn}: Outbound ${f1(b.dispatchedFromWarehouseKwd)} KWD, Received ${f1(b.receivedByBranchKwd)} KWD (transit gap ${f2(b.transitGapKwd)} KWD), waste variance ${f1(b.abnormalShrinkageKwd)} KWD (${f1(b.wastePct)}%).`,
        departmentAr: 'مخزن ومطبخ العارضية المركزي والرقابة',
        departmentEn: 'Ardiya Central Warehouse & Audit',
        budgetOrCostKwd: 0,
        expectedMonthlyReturnKwd: recoverableKwd,
        href: '/erp/warehouse-chain',
      })
      setToastMsg({
        ar: `تم رفع طلب تحقيق / إيقاف هدر لفرع ${b.branchNameAr} إلى جرس المدير 🔔`,
        en: `Investigation & waste-cap request queued in Manager Bell for ${b.branchNameEn} 🔔`,
      })
      window.setTimeout(() => setToastMsg(null), 3400)
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
        ar: `تم رفع تحقيق يوم ${d.dateIso} إلى جرس المدير 🔔`,
        en: `Daily chain investigation (${d.dateIso}) sent to Manager Bell 🔔`,
      })
      window.setTimeout(() => setToastMsg(null), 3400)
    },
    [materialCategory, requestApproval],
  )

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="mx-auto w-full max-w-[1520px] space-y-5 pb-10 font-sans text-neutral-900 antialiased dark:text-slate-100"
    >
      {toastMsg ? (
        <div className="fixed bottom-6 end-6 z-50 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-semibold text-emerald-800 shadow-xl ring-1 ring-emerald-500/25 dark:bg-neutral-900 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{isAr ? toastMsg.ar : toastMsg.en}</span>
        </div>
      ) : null}

      {/* ───────────── 1. Studio Header + Category Filter Pills ───────────── */}
      <header className={`${CARD_CLS} space-y-4`}>
        <div className="flex flex-col gap-3.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Package className="h-4 w-4" />
              </span>
              <h1 className="text-[20px] font-semibold tracking-tight text-neutral-950 sm:text-[22px] dark:text-white">
                {T(
                  'Warehouse-to-Branch Continuous Daily Chain',
                  'سلسلة المخزن والفروع اليومية المتصلة — مخزن ومطبخ العارضية المركزي',
                )}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <ShieldCheck className="h-3 w-3" />
                <span>
                  {T(
                    '0.000 Drift · 7 Branches · 6 Brands',
                    'تطابق محاسبي 0.000 · ٧ فروع · ٦ مطاعم',
                  )}
                </span>
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              {T(
                'Ardiya Central Warehouse Opening + Inbound ➔ Daily Outbound ➔ Branch Signed Receipt ➔ POS Sold & Waste Variance.',
                'متابعة يومية متصلة بلا انقطاع من مخزن ومطبخ العارضية المركزي إلى الفروع السبعة: الرصيد اليومي ⟵ المنصرف الخارج ⟵ المستلم الفعلي ⟵ المباع وانحراف الهدر.',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-[#F7F7F8] p-1 dark:bg-[#111E1B]">
              <button
                type="button"
                onClick={() => setSelectedDayIso('latest')}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  activeDay !== null
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20 dark:bg-emerald-950/70 dark:text-emerald-200'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-slate-300'
                }`}
              >
                {T('Single Day 📅', 'حركة يوم بيوم 📅')}
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayIso('period')}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  selectedDayIso === 'period'
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20 dark:bg-emerald-950/70 dark:text-emerald-200'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-slate-300'
                }`}
              >
                {T(`Window (${snap.dayCount}d) 📊`, `إجمالي الفترة (${snap.dayCount} يوم) 📊`)}
              </button>
            </div>

            <Link
              href={`/erp/feryal?prompt=${encodeURIComponent(
                isAr
                  ? `افحصي سلسلة مخزن ومطبخ العارضية المركزي (${heroMetrics.modeTitleAr} · ${snap.categoryMeta.ar}): رصيد المخزن ${f0(heroMetrics.stage1StockKwd)} د.ك، المنصرف للأفرع ${f1(heroMetrics.stage2OutKwd)} د.ك، المستلم ${f1(heroMetrics.stage3RecvKwd)} د.ك، والمباع ${f0(heroMetrics.stage4SalesKwd)} د.ك مع انحراف هدر ${f1(heroMetrics.stage4ShrinkKwd)} د.ك.`
                  : `Audit Ardiya Central Warehouse-to-Branch chain (${heroMetrics.modeTitleEn}).`,
              )}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{T('Ask Feryal ✨', 'اسأل فريال ✨')}</span>
            </Link>
          </div>
        </div>

        {/* Raw Material Category Selector Strip */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="pe-1 text-xs font-medium text-neutral-400">
            {T('Raw Material Category:', 'فئة المواد الخام بالمخزن:')}
          </span>
          {RAW_MATERIAL_CATEGORIES.map((cat) => {
            const active = materialCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setMaterialCategory(cat.id)}
                className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : `${SUBCARD_CLS} text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-200`
                }`}
              >
                {isAr ? cat.ar : cat.en}
              </button>
            )
          })}
        </div>
      </header>

      {/* Day Quick-Select Strip when in Single-Day Mode */}
      {activeDay ? (
        <section className={`${CARD_CLS} py-3.5`}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800 dark:text-slate-200">
              <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{isAr ? heroMetrics.modeTitleAr : heroMetrics.modeTitleEn}</span>
            </div>
            <span className="text-[11px] text-neutral-400">
              {T('Select any day to inspect all 4 connected stages', 'اختر أي يوم لمعاينة المراحل الأربع المتصلة للفروع السبعة')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {reversedDays.slice(0, 14).map((d) => {
              const isSelected = activeDay.dateIso === d.dateIso
              return (
                <button
                  key={d.dateIso}
                  type="button"
                  onClick={() => setSelectedDayIso(d.dateIso)}
                  className={`shrink-0 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold tabular-nums transition-all duration-150 ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : `${SUBCARD_CLS} text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-200`
                  }`}
                >
                  <div>{isAr ? d.dayLabelAr : d.dayLabelEn}</div>
                  <div className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-neutral-400'}`}>
                    {f0(d.branchesPosSalesKwd)} {isAr ? 'د.ك' : 'KWD'}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* ───────────── 2. Visual Connected 4-Node Flow Diagram ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight text-neutral-950 dark:text-white">
              {T(
                'Connected 4-Stage Daily Warehouse-to-Branch Flow',
                'مخطط التدفق اليومي المتصل من مخزن العارضية إلى نقاط البيع بالفروع السبعة',
              )}
            </h2>
            <p className="text-xs text-neutral-400">
              {isAr
                ? `${heroMetrics.modeTitleAr} · ${snap.categoryMeta.ar}`
                : `${heroMetrics.modeTitleEn} · ${snap.categoryMeta.en}`}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-[11.5px] font-semibold tabular-nums ${
              heroMetrics.stage3GapKwd === 0
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
            }`}
          >
            {heroMetrics.stage3GapKwd === 0
              ? T('Transit Gap: 0.00 KWD (Exact)', 'فرق النقل (المنصرف - المستلم): 0.00 د.ك مطابق')
              : T(
                  `Transit Gap: ${f2(heroMetrics.stage3GapKwd)} KWD (${f1(heroMetrics.stage3GapKg)} ${unitLabel})`,
                  `فرق النقل (المنصرف - المستلم): ${f2(heroMetrics.stage3GapKwd)} د.ك (${f1(heroMetrics.stage3GapKg)} ${unitLabel})`,
                )}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          {/* Node 1: رصيد المخزن اليومي */}
          <div className={`${SUBCARD_CLS} flex flex-col justify-between p-4`}>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Package className="h-3.5 w-3.5" />
                <span>
                  {T('1. Opening + Inbound Stock', '١. رصيد المخزن اليومي')}
                </span>
              </span>
              <span className="hidden lg:inline-flex text-emerald-600 dark:text-emerald-400">
                <ArrowConnector className="h-4 w-4" />
              </span>
            </div>
            <div className="my-3">
              <div className="text-2xl font-bold tracking-tight tabular-nums text-neutral-950 dark:text-white">
                {f0(heroMetrics.stage1StockKwd)}{' '}
                <span className="text-xs font-semibold text-neutral-500">{isAr ? 'د.ك' : 'KWD'}</span>
              </div>
              <div className="mt-0.5 text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                {f1(heroMetrics.stage1StockKg)} {unitLabel}
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-slate-400">
              {isAr ? heroMetrics.stage1SubAr : heroMetrics.stage1SubEn}
            </p>
          </div>

          {/* Node 2: المنصرف الخارج من المخزن يومياً */}
          <div className={`${SUBCARD_CLS} flex flex-col justify-between p-4`}>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                <Truck className="h-3.5 w-3.5" />
                <span>
                  {T('2. Daily Warehouse Outbound', '٢. المنصرف الخارج من المخزن يومياً')}
                </span>
              </span>
              <span className="hidden lg:inline-flex text-sky-600 dark:text-sky-400">
                <ArrowConnector className="h-4 w-4" />
              </span>
            </div>
            <div className="my-3">
              <div className="text-2xl font-bold tracking-tight tabular-nums text-neutral-950 dark:text-white">
                {f1(heroMetrics.stage2OutKwd)}{' '}
                <span className="text-xs font-semibold text-neutral-500">{isAr ? 'د.ك' : 'KWD'}</span>
              </div>
              <div className="mt-0.5 text-xs font-semibold tabular-nums text-sky-700 dark:text-sky-300">
                {f1(heroMetrics.stage2OutKg)} {unitLabel} · {f0(heroMetrics.stage2Moves)}{' '}
                {isAr ? 'أمر صرف' : 'moves'}
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-slate-400">
              {T(
                'Exact daily dispatches leaving Ardiya Central Warehouse per target branch.',
                'الكميات والقيمة الخارجة يومياً من مخزن ومطبخ العارضية المركزي لكل فرع.',
              )}
            </p>
          </div>

          {/* Node 3: المستلم الفعلي بكل فرع يومياً */}
          <div className={`${SUBCARD_CLS} flex flex-col justify-between p-4`}>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                <Store className="h-3.5 w-3.5" />
                <span>
                  {T('3. Daily Branch Received', '٣. المستلم الفعلي بكل فرع يومياً')}
                </span>
              </span>
              <span className="hidden lg:inline-flex text-amber-600 dark:text-amber-400">
                <ArrowConnector className="h-4 w-4" />
              </span>
            </div>
            <div className="my-3">
              <div className="text-2xl font-bold tracking-tight tabular-nums text-neutral-950 dark:text-white">
                {f1(heroMetrics.stage3RecvKwd)}{' '}
                <span className="text-xs font-semibold text-neutral-500">{isAr ? 'د.ك' : 'KWD'}</span>
              </div>
              <div className="mt-0.5 text-xs font-semibold tabular-nums text-amber-800 dark:text-amber-300">
                {f1(heroMetrics.stage3RecvKg)} {unitLabel}
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-slate-400">
              {heroMetrics.stage3GapKwd === 0
                ? T(
                    '100% signed & verified across active branches (0.00 transit gap).',
                    'مستلم وموقع بالكامل في الفروع بدون أي نقص بالطريق (فرق النقل = 0).',
                  )
                : T(
                    `Transit gap (Outbound - Received): ${f2(heroMetrics.stage3GapKwd)} KWD.`,
                    `فجوة نقل مكتشفة تلقائياً (المنصرف - المستلم): ${f2(heroMetrics.stage3GapKwd)} د.ك.`,
                  )}
            </p>
          </div>

          {/* Node 4: المستهلك والمباع فعلياً بكل فرع يومياً */}
          <div className={`${SUBCARD_CLS} flex flex-col justify-between p-4`}>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>
                  {T('4. Daily Branch Sold & Depletion', '٤. المستهلك والمباع فعلياً بكل فرع يومياً')}
                </span>
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-emerald-700 dark:bg-neutral-900 dark:text-emerald-300">
                {f0(heroMetrics.stage4Orders)} {isAr ? 'طلب' : 'orders'}
              </span>
            </div>
            <div className="my-3">
              <div className="text-2xl font-bold tracking-tight tabular-nums text-neutral-950 dark:text-white">
                {f0(heroMetrics.stage4SalesKwd)}{' '}
                <span className="text-xs font-semibold text-neutral-500">{isAr ? 'د.ك' : 'KWD'}</span>
              </div>
              <div className="mt-0.5 text-xs font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {T(
                  `Waste Variance: ${f1(heroMetrics.stage4ShrinkKwd)} KWD (${f1(heroMetrics.stage4ShrinkKg)} ${unitLabel} · ${f1(heroMetrics.stage4WastePct)}%)`,
                  `انحراف الهدر اليومي: ${f1(heroMetrics.stage4ShrinkKwd)} د.ك (${f1(heroMetrics.stage4ShrinkKg)} ${unitLabel} · ${f1(heroMetrics.stage4WastePct)}%)`,
                )}
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-slate-400">
              {T(
                `Recipe BOM ${f1(heroMetrics.stage4TheoKwd)} KWD vs Actual Depletion ${f1(heroMetrics.stage4ConsumedKwd)} KWD.`,
                `استهلاك الوصفة المعياري ${f1(heroMetrics.stage4TheoKwd)} د.ك مقابل الفعلي ${f1(heroMetrics.stage4ConsumedKwd)} د.ك.`,
              )}
            </p>
          </div>
        </div>
      </section>

      {/* ───────────── 3. 7-Branch Connected Chain Matrix & Bell Governance ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight text-neutral-950 dark:text-white">
              {T(
                '7-Branch Daily Receipt, POS Depletion & Waste Variance Matrix',
                'مطابقة الفروع السبعة (الأفنيوز، مول 360، العاصمة، بروميناد، السالمية، الكوت، العارضية)',
              )}
            </h2>
            <p className="text-xs text-neutral-400">
              {T(
                'Automatically triggers 1-click Manager Bell investigation whenever Transit Gap !== 0 or Branch Waste > 1.8%.',
                'يُفعّل تلقائياً زر التحقيق وإيقاف الهدر عبر جرس المدير متى ما كان فرق النقل ≠ 0 أو تجاوز هدر الفرع ١٫٨٪.',
              )}
            </p>
          </div>

          {filters.branch !== 'all' ? (
            <button
              type="button"
              onClick={() => setBranch('all')}
              className="cursor-pointer rounded-full bg-[#F7F7F8] px-3.5 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-[#111E1B] dark:text-slate-200"
            >
              {T('Show All 7 Branches', 'عرض كل الفروع الـ 7')}
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-start text-xs">
            <thead>
              <tr className="border-b border-neutral-100 text-[11px] font-semibold text-neutral-400 dark:border-white/[0.06]">
                <th className="py-2.5 pe-3 text-start">{T('Branch', 'الفرع')}</th>
                <th className="px-3 py-2.5 text-start">
                  {T('Warehouse Outbound', 'المنصرف من المخزن')}
                </th>
                <th className="px-3 py-2.5 text-start">
                  {T('Branch Received', 'المستلم الفعلي بالفرع')}
                </th>
                <th className="px-3 py-2.5 text-start">
                  {T('Transit Gap', 'المنصرف - المستلم')}
                </th>
                <th className="px-3 py-2.5 text-start">
                  {T('POS Sold', 'المباع فعلياً (POS)')}
                </th>
                <th className="px-3 py-2.5 text-start">
                  {T('Daily Waste Variance', 'انحراف الهدر اليومي (كمية ودينار)')}
                </th>
                <th className="px-3 py-2.5 text-start">{T('Status', 'الحالة')}</th>
                <th className="py-2.5 ps-3 text-end">{T('Governance Action', 'إجراء جرس المدير')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
              {activeBranchesRows.map((b) => {
                const refKey = `warehouse-chain:${b.branchId}:${materialCategory}:${activeDay?.dateIso ?? snap.toIso}`
                const existing = getApprovalByRef(refKey)
                return (
                  <tr
                    key={b.branchId}
                    className="transition-colors hover:bg-[#F7F7F8]/70 dark:hover:bg-white/[0.03]"
                  >
                    <td className="py-3 pe-3 font-semibold text-neutral-950 dark:text-white">
                      <button
                        type="button"
                        onClick={() =>
                          setBranch(filters.branch === b.branchId ? 'all' : b.branchId)
                        }
                        className="cursor-pointer text-start hover:text-emerald-700 dark:hover:text-emerald-300"
                      >
                        <div>{isAr ? b.branchNameAr : b.branchNameEn}</div>
                        <div className="text-[10.5px] font-normal text-neutral-400">
                          {f0(b.transferMoves)} {isAr ? 'حركة استلام' : 'moves'}
                        </div>
                      </button>
                    </td>

                    <td className="px-3 py-3 tabular-nums">
                      <div className="font-semibold text-neutral-900 dark:text-slate-100">
                        {f1(b.dispatchedFromWarehouseKwd)} {isAr ? 'د.ك' : 'KWD'}
                      </div>
                      <div className="text-[10.5px] text-sky-700 dark:text-sky-300">
                        {f1(b.dispatchedKg)} {unitLabel}
                      </div>
                    </td>

                    <td className="px-3 py-3 tabular-nums">
                      <div className="font-semibold text-neutral-900 dark:text-slate-100">
                        {f1(b.receivedByBranchKwd)} {isAr ? 'د.ك' : 'KWD'}
                      </div>
                      <div className="text-[10.5px] text-emerald-700 dark:text-emerald-300">
                        {f1(b.receivedKg)} {unitLabel}
                      </div>
                    </td>

                    <td className="px-3 py-3 tabular-nums">
                      {b.transitGapKwd === 0 ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          0.00 {isAr ? 'مطابق' : 'Exact'}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                          {f2(b.transitGapKwd)} {isAr ? 'د.ك' : 'KWD'} ({f1(b.transitGapKg)}{' '}
                          {unitLabel})
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3 tabular-nums">
                      <div className="font-bold text-neutral-950 dark:text-white">
                        {f1(b.posSalesKwd)} {isAr ? 'د.ك' : 'KWD'}
                      </div>
                      <div className="text-[10.5px] text-neutral-500">
                        {f0(b.posOrders)} {isAr ? 'طلب' : 'orders'}
                      </div>
                    </td>

                    <td className="px-3 py-3 tabular-nums">
                      <div className="text-neutral-700 dark:text-slate-200">
                        {isAr ? 'معياري' : 'BOM'} {f1(b.bomTheoreticalCostKwd)} ←{' '}
                        <span className="font-semibold">
                          {isAr ? 'فعلي' : 'Actual'} {f1(b.actualConsumedKwd)}
                        </span>
                      </div>
                      <div
                        className={`text-[10.5px] font-semibold ${
                          b.wastePct > 1.8
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {f1(b.abnormalShrinkageKwd)} {isAr ? 'د.ك' : 'KWD'} ·{' '}
                        {f1(b.abnormalShrinkageKg)} {unitLabel} ({f1(b.wastePct)}%)
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <HealthBadge status={b.health} isAr={isAr} />
                    </td>

                    <td className="py-3 ps-3 text-end">
                      {existing ? (
                        <button
                          type="button"
                          onClick={() => openDrawer('approvals')}
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{T('Queued in Bell 🔔', 'مرفوع بالجرس 🔔')}</span>
                        </button>
                      ) : b.requiresInvestigation ? (
                        <button
                          type="button"
                          onClick={() => handleQueueBranchInvestigation(b)}
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-rose-50 px-3 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-200"
                        >
                          <Bell className="h-3.5 w-3.5" />
                          <span>
                            {T(
                              'Investigate / Cap Waste via Bell 🔔',
                              'طلب تحقيق / إيقاف هدر عبر جرس المدير 🔔',
                            )}
                          </span>
                        </button>
                      ) : (
                        <span className="inline-flex h-8 items-center rounded-full bg-[#F7F7F8] px-3 text-[11px] font-medium text-neutral-500 dark:bg-[#111E1B] dark:text-slate-400">
                          {T('Within <= 1.8% norm ✓', 'ضمن المعيار الآمن ≤ ١٫٨٪ ✓')}
                        </span>
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
            <h2 className="text-[16px] font-semibold tracking-tight text-neutral-950 dark:text-white">
              {T(
                'Paginated Daily Warehouse-to-Branch Reconciled Ledger (12 Days / Page)',
                'دفتر السلسلة اليومية المتصلة يوماً بيوم (١٢ صفاً بالصفحة · ترحيل 0.000)',
              )}
            </h2>
            <p className="text-xs text-neutral-400">
              {T(
                'Opening + Inbound - Outbound === Closing every single day; click any row to inspect branch breakdown.',
                'رصيد أول اليوم + التوريد - المنصرف = رصيد الإغلاق بدقة تامة كل يوم؛ اضغط أي سطر لمعاينة تفصيل الفروع.',
              )}
            </p>
          </div>

          {/* Pagination Controls (`12 rows/page`) */}
          <div className="flex items-center gap-2 text-xs">
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
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#F7F7F8] text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-40 dark:bg-[#111E1B] dark:text-slate-200"
              aria-label={T('Previous page', 'الصفحة السابقة')}
            >
              {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setLedgerPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#F7F7F8] text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-40 dark:bg-[#111E1B] dark:text-slate-200"
              aria-label={T('Next page', 'الصفحة التالية')}
            >
              {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] border-collapse text-start text-xs">
            <thead>
              <tr className="border-b border-neutral-100 text-[11px] font-semibold text-neutral-400 dark:border-white/[0.06]">
                <th className="py-2.5 pe-3 text-start">{T('Date', 'التاريخ')}</th>
                <th className="px-3 py-2.5 text-start">
                  {T('1. Opening + Inbound', '١. رصيد المخزن اليومي')}
                </th>
                <th className="px-3 py-2.5 text-start">
                  {T('2. Warehouse Outbound', '٢. المنصرف الخارج يومياً')}
                </th>
                <th className="px-3 py-2.5 text-start">
                  {T('Warehouse Closing', 'رصيد الإغلاق المرحّل')}
                </th>
                <th className="px-3 py-2.5 text-start">
                  {T('3. Branch Received & Gap', '٣. المستلم الفعلي وفرق النقل')}
                </th>
                <th className="px-3 py-2.5 text-start">
                  {T('4. Sold & Waste Variance', '٤. المباع وانحراف الهدر')}
                </th>
                <th className="py-2.5 ps-3 text-end">{T('Governance', 'جرس المدير')}</th>
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
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                        : 'hover:bg-[#F7F7F8]/80 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <td className="py-2.5 pe-3 font-semibold tabular-nums text-neutral-950 dark:text-white">
                      <div>{isAr ? d.dayLabelAr : d.dayLabelEn}</div>
                      <div className="text-[10.5px] font-normal text-neutral-400">{d.dateIso}</div>
                    </td>

                    <td className="px-3 py-2.5 tabular-nums">
                      <div className="font-semibold text-neutral-900 dark:text-white">
                        {f0(d.warehouseOnHandTotalKwd)} {isAr ? 'د.ك' : 'KWD'} (
                        {f1(d.warehouseOnHandTotalKg)} {unitLabel})
                      </div>
                      <div className="text-[10.5px] text-neutral-400">
                        {f0(d.warehouseOpeningKwd)} + {f0(d.supplierInboundKwd)}{' '}
                        {isAr ? 'توريد' : 'inbound'}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 font-semibold tabular-nums text-sky-700 dark:text-sky-300">
                      <div>
                        -{f1(d.warehouseDispatchedKwd)} {isAr ? 'د.ك' : 'KWD'}
                      </div>
                      <div className="text-[10.5px] font-normal text-neutral-400">
                        {f1(d.warehouseDispatchedKg)} {unitLabel} · {d.dispatchMoves}{' '}
                        {isAr ? 'حركة' : 'mv'}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 font-semibold tabular-nums text-neutral-800 dark:text-slate-200">
                      <div>
                        {f0(d.warehouseClosingKwd)} {isAr ? 'د.ك' : 'KWD'}
                      </div>
                      <div className="text-[10.5px] font-normal text-neutral-400">
                        {f1(d.warehouseClosingKg)} {unitLabel}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 tabular-nums">
                      <div className="font-semibold text-amber-800 dark:text-amber-300">
                        {f1(d.branchesReceivedKwd)} {isAr ? 'د.ك' : 'KWD'}
                      </div>
                      <div className="text-[10.5px] text-neutral-500">
                        {d.transitGapKwd === 0
                          ? isAr
                            ? 'فرق النقل: 0.00'
                            : 'Gap: 0.00'
                          : isAr
                            ? `فرق نقل: ${f2(d.transitGapKwd)} د.ك`
                            : `Gap: ${f2(d.transitGapKwd)} KWD`}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 tabular-nums">
                      <div className="font-bold text-emerald-800 dark:text-emerald-300">
                        {f1(d.branchesPosSalesKwd)} {isAr ? 'د.ك' : 'KWD'} ({f0(d.branchesOrders)}{' '}
                        {isAr ? 'طلب' : 'ord'})
                      </div>
                      <div
                        className={`text-[10.5px] font-medium ${
                          d.wastePct > 1.8
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-neutral-400'
                        }`}
                      >
                        {isAr ? 'هدر:' : 'Waste:'} {f1(d.abnormalShrinkageKwd)}{' '}
                        {isAr ? 'د.ك' : 'KWD'} ({f1(d.wastePct)}%)
                      </div>
                    </td>

                    <td
                      className="py-2.5 ps-3 text-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {dayQueued ? (
                        <button
                          type="button"
                          onClick={() => openDrawer('approvals')}
                          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-emerald-50 px-2.5 text-[10.5px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        >
                          <Check className="h-3 w-3" />
                          <span>{T('In Bell 🔔', 'بالجرس 🔔')}</span>
                        </button>
                      ) : d.requiresInvestigation ? (
                        <button
                          type="button"
                          onClick={() => handleQueueDayInvestigation(d)}
                          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-amber-50 px-2.5 text-[10.5px] font-semibold text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
                        >
                          <Bell className="h-3 w-3" />
                          <span>
                            {T(
                              'Investigate / Cap Waste 🔔',
                              'طلب تحقيق / إيقاف هدر عبر جرس المدير 🔔',
                            )}
                          </span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          {T('Balanced ✓', 'منضبط ✓')}
                        </span>
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
