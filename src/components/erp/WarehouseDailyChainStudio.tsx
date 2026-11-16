'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Package,
  RefreshCw,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { formatPeriodCalendarWindow } from '@/lib/aether/global-filter-engine'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
import { stripExcludedOdooTree } from '@/lib/odoo/excluded-entities'
import type { OdooLiveWarehouseChainPayload } from '@/lib/odoo-live-connector'
import {
  computeWarehouseDailyChain,
  RAW_MATERIAL_CATEGORIES,
  type ChainHealthStatus,
  type RawMaterialCategory,
} from '@/lib/warehouse-prep-engine'

const CARD_CLS =
  'ae-bento-card rounded-2xl bg-white p-3.5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const KPI_CARD_CLS =
  'ae-kpi-card min-w-0 overflow-hidden rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const SEGMENT_TRACK_CLS =
  'flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]'
const SEGMENT_BTN_CLS =
  'shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 cursor-pointer'
const SEGMENT_BTN_ACTIVE_CLS =
  'bg-white font-semibold text-emerald-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/25'
const SEGMENT_BTN_IDLE_CLS =
  'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'

const PAGE_SIZE = 12
const NO_ODOO_DATA_AR = 'لا توجد بيانات من Odoo لهذه الفترة'

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
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
        <span>🔴</span>
        <span>{isAr ? 'هدر مرتفع' : 'High Scrap'}</span>
      </span>
    )
  }
  if (status === 'watch') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
        <span>🟡</span>
        <span>{isAr ? 'مراقبة' : 'Monitor'}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
      <span>🟢</span>
      <span>{isAr ? 'ضمن النطاق' : 'Normal'}</span>
    </span>
  )
}

export function WarehouseDailyChainStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const T = useCallback((en: string, ar: string) => (isAr ? ar : en), [isAr])

  const { filters, workspace, liveSummary } = useGlobalFilter()

  const [materialCategory, setMaterialCategory] = useState<RawMaterialCategory>('all')
  const [ledgerPage, setLedgerPage] = useState<number>(1)
  const [warehouseChain, setWarehouseChain] = useState<OdooLiveWarehouseChainPayload | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [timedOut, setTimedOut] = useState(false)
  const [reloadNonce, setReloadNonce] = useState<number>(0)

  const periodWindow = useMemo(
    () =>
      formatPeriodCalendarWindow(filters.period, {
        customFrom: filters.customFrom,
        customTo: filters.customTo,
        liveSummary,
      }),
    [filters.customFrom, filters.customTo, filters.period, liveSummary],
  )

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 20_000)
    setLoading(true)
    setTimedOut(false)

    const qs = new URLSearchParams({
      from: periodWindow.fromIso,
      to: periodWindow.toInclusiveIso,
    })

    fetch(`/api/erp/warehouse-chain?${qs.toString()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data?.warehouseChain && data.connected) {
          setWarehouseChain(stripExcludedOdooTree(data.warehouseChain) as OdooLiveWarehouseChainPayload)
        } else {
          setWarehouseChain(null)
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setWarehouseChain(null)
        setTimedOut(error instanceof DOMException && error.name === 'AbortError')
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [periodWindow.fromIso, periodWindow.toInclusiveIso, reloadNonce])

  useEffect(() => {
    setLedgerPage(1)
  }, [
    filters.period,
    filters.branch,
    filters.brand,
    filters.channel,
    filters.customFrom,
    filters.customTo,
    materialCategory,
  ])

  const snap = useMemo(
    () =>
      computeWarehouseDailyChain(
        filters,
        workspace,
        materialCategory,
        liveSummary,
        warehouseChain,
      ),
    [filters, liveSummary, materialCategory, warehouseChain, workspace],
  )

  const provenanceRange = useMemo(
    () => ({
      from: snap.fromIso || periodWindow.fromIso,
      to: snap.toIso || periodWindow.toInclusiveIso,
    }),
    [periodWindow.fromIso, periodWindow.toInclusiveIso, snap.fromIso, snap.toIso],
  )

  const lastSyncIso =
    warehouseChain?.lastSyncAt ??
    liveSummary?.lastSyncAt ??
    liveSummary?.syncedAt ??
    workspace.lastSyncAt ??
    null
  const isStale24h = Boolean(
    warehouseChain?.isStale24h || liveSummary?.isStale24h || workspace.isStale24h,
  )

  const fmtKwd = useCallback(
    (v: number) => (isAr ? `${f2(v)} د.ك` : `${f2(v)} KWD`),
    [isAr],
  )

  const reversedDays = useMemo(() => [...snap.days].reverse(), [snap.days])
  const totalPages = Math.max(1, Math.ceil(reversedDays.length / PAGE_SIZE))
  const pagedDays = useMemo(
    () => reversedDays.slice((ledgerPage - 1) * PAGE_SIZE, ledgerPage * PAGE_SIZE),
    [ledgerPage, reversedDays],
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-5 pb-16">
      {/* Header */}
      <div className={`${CARD_CLS} flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              {T(
                'Central Warehouse & Branch Stock Chain',
                'سلسلة المخزن المركزي وحركات الفروع',
              )}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Package className="h-3.5 w-3.5" />
              <span>stock.move • stock.scrap • stock.quant</span>
            </span>
          </div>
          <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
            {isAr
              ? `قراءة حركات المخزون الفعلية والتالف المسجّل والأرصدة الداخلية من أودو 17 للفترة (${provenanceRange.from} → ${provenanceRange.to}).`
              : `Actual Odoo 17 stock moves, scrap orders, and internal quant balances for (${provenanceRange.from} → ${provenanceRange.to}).`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            disabled={loading}
            className="ae-emerald-cta-pill inline-flex h-9.5 cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-white disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{T('Refresh Warehouse Data', 'تحديث بيانات المخزن')}</span>
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className={SEGMENT_TRACK_CLS} role="tablist" aria-label={T('Material Category', 'فئة المواد')}>
        {RAW_MATERIAL_CATEGORIES.map((cat) => {
          const active = cat.id === materialCategory
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMaterialCategory(cat.id)}
              className={`${SEGMENT_BTN_CLS} ${active ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS}`}
            >
              {isAr ? cat.ar : cat.en}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className={`${CARD_CLS} py-12 text-center text-sm font-semibold text-slate-500 dark:text-slate-300`}>
          {T('Loading warehouse movements from Odoo 17...', 'جاري تحميل حركات المخزن من أودو 17...')}
        </div>
      ) : timedOut ? (
        <div className={`${CARD_CLS} py-12 text-center text-sm font-semibold text-amber-800 dark:text-amber-200`}>
          {T(
            'The warehouse request timed out. Odoo did not answer in time.',
            'انتهت مهلة جلب حركات المخزن من أودو. لم يصل الرد في الوقت المحدد.',
          )}
        </div>
      ) : !snap.connected || snap.noData ? (
        <section
          role="status"
          data-odoo-no-data="true"
          className="ae-bento-card mx-auto my-6 max-w-3xl rounded-3xl border border-amber-300/70 bg-white p-8 text-center shadow-xs dark:border-amber-500/30 dark:bg-[#101C17]"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100/90 text-amber-700 ring-1 ring-amber-500/25 dark:bg-amber-950/60 dark:text-amber-300">
            <Database className="h-7 w-7" aria-hidden />
          </div>
          <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">
            {NO_ODOO_DATA_AR}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-300">
            {snap.messageAr ?? NO_ODOO_DATA_AR}
          </p>
        </section>
      ) : (
        <>
          {/* 5 KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {/* 1. Current Warehouse On-Hand */}
            <article className={KPI_CARD_CLS}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {T('Internal Stock On-Hand', 'رصيد المخزون الداخلي الحالي')}
                </p>
                <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div
                dir="ltr"
                className="mt-2.5 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white"
              >
                {fmtKwd(snap.periodTotals.closingWarehouseKwd)}
              </div>
              <p className="mt-1 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                {isAr
                  ? `${f1(snap.periodTotals.closingWarehouseKg)} وحدة كمية حالية`
                  : `${f1(snap.periodTotals.closingWarehouseKg)} current units`}
              </p>
              <KpiProvenanceBadge
                odooModel="stock.quant"
                dateRange={provenanceRange}
                lastSyncAt={lastSyncIso}
                isStale24h={isStale24h}
                kind={snap.quantHasValueField ? 'فعلي' : 'محسوب بمعادلة'}
                queryOrFormula={
                  snap.quantHasValueField
                    ? "stock.quant.search_read([['location_id.usage','=','internal']]) -> sum(value)"
                    : "stock.quant(quantity) × product.product(standard_price)"
                }
                compact
              />
            </article>

            {/* 2. Supplier Inbound */}
            <article className={KPI_CARD_CLS}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {T('Supplier Inbound Receipts', 'توريدات الموردين المستلمة')}
                </p>
                <ShoppingBag className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div
                dir="ltr"
                className="mt-2.5 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white"
              >
                {fmtKwd(snap.periodTotals.totalSupplierInboundKwd)}
              </div>
              <p className="mt-1 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                {isAr
                  ? `${f1(snap.periodTotals.totalSupplierInboundKg)} كمية واردة للفترة`
                  : `${f1(snap.periodTotals.totalSupplierInboundKg)} inbound qty in period`}
              </p>
              <KpiProvenanceBadge
                odooModel="stock.move"
                dateRange={provenanceRange}
                lastSyncAt={lastSyncIso}
                isStale24h={isStale24h}
                kind="محسوب بمعادلة"
                queryOrFormula="stock.move(state='done', location_id.usage='supplier', location_dest_id.usage='internal') × standard_price"
                compact
              />
            </article>

            {/* 3. Dispatched to Branches */}
            <article className={KPI_CARD_CLS}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {T('Transfers to Branches', 'تحويلات المطبخ المركزي للفروع')}
                </p>
                <Truck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div
                dir="ltr"
                className="mt-2.5 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white"
              >
                {fmtKwd(snap.periodTotals.totalDispatchedKwd)}
              </div>
              <p className="mt-1 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                {isAr
                  ? `${f0(snap.periodTotals.totalDispatchMoves)} حركة مخزنية منفذة`
                  : `${f0(snap.periodTotals.totalDispatchMoves)} completed stock moves`}
              </p>
              <KpiProvenanceBadge
                odooModel="stock.move"
                dateRange={provenanceRange}
                lastSyncAt={lastSyncIso}
                isStale24h={isStale24h}
                kind="محسوب بمعادلة"
                queryOrFormula="stock.move(state='done', internal -> internal transfer) × standard_price"
                compact
              />
            </article>

            {/* 4. Outbound POS / Production Consumption */}
            <article className={KPI_CARD_CLS}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {T('Recorded Consumption Moves', 'المنصرف المخزني المسجّل للإنتاج والبيع')}
                </p>
                <Store className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div
                dir="ltr"
                className="mt-2.5 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white"
              >
                {fmtKwd(snap.periodTotals.totalBomTheoreticalKwd)}
              </div>
              <p className="mt-1 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                {isAr
                  ? `${f1(snap.periodTotals.totalBomTheoreticalKg)} كمية منصرفة`
                  : `${f1(snap.periodTotals.totalBomTheoreticalKg)} outbound qty`}
              </p>
              <KpiProvenanceBadge
                odooModel="stock.move"
                dateRange={provenanceRange}
                lastSyncAt={lastSyncIso}
                isStale24h={isStale24h}
                kind="محسوب بمعادلة"
                queryOrFormula="stock.move(state='done', internal -> customer/production) × standard_price"
                compact
              />
            </article>

            {/* 5. Recorded Scrap Orders */}
            <article className={KPI_CARD_CLS}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {T('Recorded Stock Scrap', 'التالف والهدر الفعلي المسجّل')}
                </p>
                <Trash2 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <div
                dir="ltr"
                className="mt-2.5 text-2xl font-extrabold tabular-nums text-rose-700 dark:text-rose-300"
              >
                {fmtKwd(snap.periodTotals.totalAbnormalShrinkageKwd)}
              </div>
              <p className="mt-1 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                {isAr
                  ? `${f0(snap.scraps.length)} أمر إتلاف • ${f1(snap.periodTotals.periodWastePct)}% من المنصرف`
                  : `${f0(snap.scraps.length)} scrap orders • ${f1(snap.periodTotals.periodWastePct)}% of consumption`}
              </p>
              <KpiProvenanceBadge
                odooModel="stock.scrap"
                dateRange={provenanceRange}
                lastSyncAt={lastSyncIso}
                isStale24h={isStale24h}
                kind="محسوب بمعادلة"
                queryOrFormula="stock.scrap(state='done', date_done in range) × product.standard_price"
                compact
              />
            </article>
          </div>

          {/* Branch Period Summary Table (7 Active Branches) */}
          <section className={CARD_CLS}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                  {T(
                    'Branch Stock Transfers, Scrap & On-Hand Summary',
                    'ملخص التحويلات والتالف والرصيد الحالي لكل فرع',
                  )}
                </h2>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {T(
                    'Strictly 7 mapped Venture Foods locations from Odoo 17 stock locations',
                    'الفروع السبعة المعتمدة فقط وفق مواقع المخزون المربوطة في أودو 17',
                  )}
                </p>
              </div>
              <KpiProvenanceBadge
                odooModel="stock.move + stock.scrap + stock.quant"
                dateRange={provenanceRange}
                lastSyncAt={lastSyncIso}
                isStale24h={isStale24h}
                kind="محسوب بمعادلة"
                queryOrFormula="stock.move/stock.scrap/stock.quant grouped by mapped Odoo internal stock.location"
                compact
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-white/10 dark:text-slate-400">
                    <th className="py-2.5 text-start">{T('Branch', 'الفرع')}</th>
                    <th className="py-2.5 text-end">{T('Transfers In (KWD)', 'التحويلات المستلمة')}</th>
                    <th className="py-2.5 text-end">{T('Moves Count', 'عدد الحركات')}</th>
                    <th className="py-2.5 text-end">{T('Consumption (KWD)', 'المنصرف المسجّل')}</th>
                    <th className="py-2.5 text-end">{T('Scrap (KWD)', 'التالف المسجّل')}</th>
                    <th className="py-2.5 text-end">{T('Current On-Hand', 'الرصيد الحالي')}</th>
                    <th className="py-2.5 text-end">{T('POS Sales', 'مبيعات الفرع')}</th>
                    <th className="py-2.5 text-end">{T('Status', 'الحالة')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {snap.branchPeriodSummary.map((b) => (
                    <tr key={b.branchId} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                      <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                        {isAr ? b.branchNameAr : b.branchNameEn}
                      </td>
                      <td dir="ltr" className="py-2.5 text-end font-semibold tabular-nums">
                        {fmtKwd(b.dispatchedFromWarehouseKwd)}
                      </td>
                      <td dir="ltr" className="py-2.5 text-end tabular-nums text-slate-600 dark:text-slate-300">
                        {f0(b.transferMoves)}
                      </td>
                      <td dir="ltr" className="py-2.5 text-end font-semibold tabular-nums">
                        {fmtKwd(b.bomTheoreticalCostKwd)}
                      </td>
                      <td dir="ltr" className="py-2.5 text-end font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                        {fmtKwd(b.abnormalShrinkageKwd)}
                      </td>
                      <td dir="ltr" className="py-2.5 text-end font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {fmtKwd(b.closingStockKwd)}
                      </td>
                      <td dir="ltr" className="py-2.5 text-end font-semibold tabular-nums">
                        {fmtKwd(b.posSalesKwd)}
                      </td>
                      <td className="py-2.5 text-end">
                        <HealthBadge status={b.health} isAr={isAr} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Daily Stock Movement Ledger */}
          <section className={CARD_CLS}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                  {T('Daily Warehouse Movement Ledger', 'دفتر حركات المخزن اليومية الفعلية')}
                </h2>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {isAr
                    ? `${f0(snap.days.length)} يوم في الفترة المختارة`
                    : `${f0(snap.days.length)} days in selected period`}
                </p>
              </div>
              {totalPages > 1 ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <button
                    type="button"
                    disabled={ledgerPage <= 1}
                    onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-slate-100 disabled:opacity-40 dark:bg-white/10"
                  >
                    {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  </button>
                  <span className="px-2 tabular-nums">
                    {ledgerPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={ledgerPage >= totalPages}
                    onClick={() => setLedgerPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-slate-100 disabled:opacity-40 dark:bg-white/10"
                  >
                    {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-white/10 dark:text-slate-400">
                    <th className="py-2.5 text-start">{T('Date', 'التاريخ')}</th>
                    <th className="py-2.5 text-end">{T('Supplier Inbound', 'وارد الموردين')}</th>
                    <th className="py-2.5 text-end">{T('Branch Transfers', 'تحويلات الفروع')}</th>
                    <th className="py-2.5 text-end">{T('Moves', 'الحركات')}</th>
                    <th className="py-2.5 text-end">{T('Consumption', 'المنصرف')}</th>
                    <th className="py-2.5 text-end">{T('Scrap', 'التالف')}</th>
                    <th className="py-2.5 text-end">{T('POS Sales', 'مبيعات الفروع')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {pagedDays.map((d) => (
                    <tr key={d.dateIso} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                      <td className="py-2.5 font-semibold text-slate-900 dark:text-white">
                        {isAr ? `${d.weekdayAr} • ${d.dayLabelAr}` : `${d.weekdayEn} • ${d.dayLabelEn}`}
                      </td>
                      <td dir="ltr" className="py-2.5 text-end tabular-nums">
                        {fmtKwd(d.supplierInboundKwd)}
                      </td>
                      <td dir="ltr" className="py-2.5 text-end tabular-nums">
                        {fmtKwd(d.warehouseDispatchedKwd)}
                      </td>
                      <td dir="ltr" className="py-2.5 text-end tabular-nums text-slate-600 dark:text-slate-300">
                        {f0(d.dispatchMoves)}
                      </td>
                      <td dir="ltr" className="py-2.5 text-end tabular-nums">
                        {fmtKwd(d.bomTheoreticalCostKwd)}
                      </td>
                      <td dir="ltr" className="py-2.5 text-end tabular-nums text-rose-700 dark:text-rose-300">
                        {fmtKwd(d.abnormalShrinkageKwd)}
                      </td>
                      <td dir="ltr" className="py-2.5 text-end font-semibold tabular-nums">
                        {fmtKwd(d.branchesPosSalesKwd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Top SKU Stock Flows */}
          {snap.skuFlows.length > 0 ? (
            <section className={CARD_CLS}>
              <div className="mb-4">
                <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                  {T('Top Inventory Items (Odoo Products)', 'أعلى الأصناف المخزنية حركة ورصيداً في أودو')}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-white/10 dark:text-slate-400">
                      <th className="py-2 text-start">{T('Code', 'الكود')}</th>
                      <th className="py-2 text-start">{T('Product', 'الصنف')}</th>
                      <th className="py-2 text-start">{T('Category', 'الفئة')}</th>
                      <th className="py-2 text-end">{T('Unit Cost', 'تكلفة الوحدة')}</th>
                      <th className="py-2 text-end">{T('On-Hand Qty', 'الرصيد الكمي')}</th>
                      <th className="py-2 text-end">{T('On-Hand Value', 'قيمة الرصيد')}</th>
                      <th className="py-2 text-end">{T('Scrap Value', 'قيمة التالف')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {snap.skuFlows.slice(0, 25).map((sku) => (
                      <tr key={`${sku.code}-${sku.nameEn}`} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                        <td dir="ltr" className="py-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {sku.code}
                        </td>
                        <td className="py-2 font-semibold text-slate-900 dark:text-white">
                          {isAr ? sku.nameAr : sku.nameEn}
                        </td>
                        <td className="py-2 text-xs text-slate-600 dark:text-slate-300">
                          {isAr ? sku.categoryLabelAr : sku.categoryLabelEn}
                        </td>
                        <td dir="ltr" className="py-2 text-end tabular-nums">
                          {fmtKwd(sku.unitCostKwd)}
                        </td>
                        <td dir="ltr" className="py-2 text-end tabular-nums">
                          {f1(sku.warehouseOnHandQty)} {sku.uom}
                        </td>
                        <td dir="ltr" className="py-2 text-end font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                          {fmtKwd(sku.warehouseOnHandKwd)}
                        </td>
                        <td dir="ltr" className="py-2 text-end tabular-nums text-rose-700 dark:text-rose-300">
                          {fmtKwd(sku.scrapValueKwd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
