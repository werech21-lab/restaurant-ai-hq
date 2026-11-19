'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
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
import { PartialWarningBanner } from '@/components/ui/partial-warning-banner'
import { StateBlock } from '@/components/ui/state-block'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { stripExcludedOdooTree } from '@/lib/odoo/excluded-entities'
import type { OdooLiveWarehouseChainPayload } from '@/lib/odoo-live-connector'
import {
  computeWarehouseDailyChain,
  defaultWarehouseQueryWindow,
  RAW_MATERIAL_CATEGORIES,
  type ChainHealthStatus,
  type RawMaterialCategory,
} from '@/lib/warehouse-prep-engine'

const CARD_CLS =
  'ae-bento-card rounded-2xl bg-white p-3.5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:ring-white/10'
const KPI_CARD_CLS =
  'ae-kpi-card min-w-0 overflow-hidden rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:ring-white/10'
const SEGMENT_TRACK_CLS =
  'flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]'
const SEGMENT_BTN_CLS =
  'shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60'
const SEGMENT_BTN_ACTIVE_CLS =
  'bg-white font-semibold text-emerald-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/25'
const SEGMENT_BTN_IDLE_CLS =
  'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'

const PAGE_SIZE = 12
const NO_ODOO_DATA_AR = 'لا توجد بيانات من Odoo لهذه الفترة'

/** Scrap is red only when a real, non-zero value is known. */
const scrapTone = (v: number | null) =>
  v !== null && v > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'

const f1Nullable = (n: number | null | undefined) =>
  formatKwd(n, { showUnit: false, decimals: 1 })

function ValueCell({
  value,
  locale,
  text,
  className = '',
}: {
  value: number | null | undefined
  locale: FormatLocale
  text: string
  className?: string
}) {
  const unavailable = typeof value !== 'number' || !Number.isFinite(value)
  const tooltip = getUnavailableTooltip(locale)
  return (
    <span
      dir="ltr"
      data-unavailable={unavailable ? 'true' : undefined}
      title={unavailable ? tooltip : undefined}
      aria-label={unavailable ? tooltip : undefined}
      className={`tabular-nums ${className}`.trim()}
    >
      {unavailable ? UNAVAILABLE_DASH : text}
    </span>
  )
}

function HealthBadge({ status, isAr }: { status: ChainHealthStatus; isAr: boolean }) {
  if (status === 'no-movement') {
    return (
      <span data-health="no-movement" className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
        {isAr ? 'لا حركة مسجلة' : 'No recorded movement'}
      </span>
    )
  }
  if (status === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
        <span aria-hidden>🔴</span>
        <span>{isAr ? 'هدر مرتفع' : 'High Scrap'}</span>
      </span>
    )
  }
  if (status === 'watch') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
        <span aria-hidden>🟡</span>
        <span>{isAr ? 'مراقبة' : 'Monitor'}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
      <span aria-hidden>🟢</span>
      <span>{isAr ? 'ضمن النطاق' : 'Normal'}</span>
    </span>
  )
}

export interface WarehouseDailyChainStudioProps {
  initialWarehouseChain?: OdooLiveWarehouseChainPayload | null
  initialLoading?: boolean
  initialError?: boolean
  initialTimedOut?: boolean
}

export function WarehouseDailyChainStudio(props: WarehouseDailyChainStudioProps) {
  const {
    initialWarehouseChain,
    initialLoading,
    initialError = false,
    initialTimedOut = false,
  } = props ?? {}
  const { locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const isAr = fmtLocale !== 'en'
  const T = useCallback((en: string, ar: string) => (isAr ? ar : en), [isAr])

  const { filters, workspace, liveSummary } = useGlobalFilter()

  const hasInitialChain = initialWarehouseChain !== undefined
  const [materialCategory, setMaterialCategory] = useState<RawMaterialCategory>('all')
  const [ledgerPage, setLedgerPage] = useState<number>(1)
  const [warehouseChain, setWarehouseChain] = useState<OdooLiveWarehouseChainPayload | null>(
    initialWarehouseChain
      ? (stripExcludedOdooTree(initialWarehouseChain) as OdooLiveWarehouseChainPayload)
      : null,
  )
  const [loading, setLoading] = useState<boolean>(
    initialLoading !== undefined ? initialLoading : !hasInitialChain && !initialError && !initialTimedOut,
  )
  const [timedOut, setTimedOut] = useState(initialTimedOut)
  const [fetchError, setFetchError] = useState(initialError)
  const [reloadNonce, setReloadNonce] = useState<number>(0)
  const [useFullPeriod, setUseFullPeriod] = useState(false)

  const periodWindow = useMemo(
    () =>
      formatPeriodCalendarWindow(filters.period, {
        customFrom: filters.customFrom,
        customTo: filters.customTo,
        liveSummary,
      }),
    [filters.customFrom, filters.customTo, filters.period, liveSummary],
  )
  const narrowWindow = useMemo(() => defaultWarehouseQueryWindow(periodWindow), [periodWindow])
  const queryWindow = useFullPeriod || !narrowWindow.narrowed ? periodWindow : narrowWindow

  useEffect(() => {
    setUseFullPeriod(false)
  }, [periodWindow.fromIso, periodWindow.toInclusiveIso])

  useEffect(() => {
    if (hasInitialChain && reloadNonce === 0) return
    if (initialLoading !== undefined && reloadNonce === 0) return
    if ((initialError || initialTimedOut) && reloadNonce === 0) return

    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 32_000)
    setLoading(true)
    setTimedOut(false)
    setFetchError(false)

    const qs = new URLSearchParams({
      from: queryWindow.fromIso,
      to: queryWindow.toInclusiveIso,
    })

    fetch(`/api/erp/warehouse-chain?${qs.toString()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as {
          connected?: boolean
          noData?: boolean
          fetchStatus?: string
          timedOut?: boolean
          warehouseChain?: OdooLiveWarehouseChainPayload | null
        } | null
        if (cancelled) return
        const status = data?.fetchStatus
        if (res.status === 504 || data?.timedOut || status === 'timeout') {
          setWarehouseChain(null)
          setTimedOut(true)
          return
        }
        if (!res.ok || status === 'error') {
          setWarehouseChain(null)
          setFetchError(true)
          return
        }
        if (data?.warehouseChain && data.connected) {
          setWarehouseChain(stripExcludedOdooTree(data.warehouseChain) as OdooLiveWarehouseChainPayload)
        } else if (data?.warehouseChain) {
          setWarehouseChain(stripExcludedOdooTree(data.warehouseChain) as OdooLiveWarehouseChainPayload)
        } else {
          setWarehouseChain(null)
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setWarehouseChain(null)
        const isAbort = error instanceof DOMException && error.name === 'AbortError'
        setTimedOut(isAbort)
        if (!isAbort) {
          setFetchError(true)
        }
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
  }, [
    hasInitialChain,
    initialError,
    initialLoading,
    initialTimedOut,
    queryWindow.fromIso,
    queryWindow.toInclusiveIso,
    reloadNonce,
  ])

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

  // A KWD figure is shown only when Odoo holds the cost behind it; otherwise «غير متاح» (never 0.000).
  const val = snap.valuation
  const kv = (n: number, ok: boolean): number | null => (ok ? n : null)
  /** A branch with no recorded movement shows a quiet «—» (none), not a row of 0.000 values. */
  const noneCell = (
    <span data-no-movement="true" className="text-slate-400 dark:text-slate-500" title={isAr ? 'لا حركة مسجلة' : 'No recorded movement'}>
      —
    </span>
  )

  const fmtKwd = useCallback(
    (v: number | null | undefined) => formatKwd(v, { locale: fmtLocale }),
    [fmtLocale],
  )
  const fmtInt = useCallback(
    (v: number | null | undefined) => formatInt(v, { locale: fmtLocale }),
    [fmtLocale],
  )
  const fmtPct = useCallback(
    (v: number | null | undefined) => formatPct(v, { locale: fmtLocale }),
    [fmtLocale],
  )

  const reversedDays = useMemo(() => [...snap.days].reverse(), [snap.days])
  const totalPages = Math.max(1, Math.ceil(reversedDays.length / PAGE_SIZE))
  const pagedDays = useMemo(
    () => reversedDays.slice((ledgerPage - 1) * PAGE_SIZE, ledgerPage * PAGE_SIZE),
    [ledgerPage, reversedDays],
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto min-w-0 space-y-5 pb-16">
      <PartialWarningBanner summary={liveSummary} isAr={isAr} />
      {snap.connected && !snap.noData && !(val.onHandValued && val.movesValued && val.scrapValued) ? (
        <p
          role="note"
          data-valuation-note="true"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
        >
          {isAr
            ? `القيم بالدينار غير متاحة حيث لا توجد تكلفة مسجلة في Odoo للأصناف${val.uncostedProducts ? ` (${val.uncostedProducts} صنف بلا تكلفة)` : ''}. الكميات والحركات معروضة كما هي. لتفعيل القيم: سجّل تكلفة الصنف (Cost) في Odoo أو اعتمد تقييم المخزون.`
            : `KWD values are unavailable where Odoo holds no cost for the items${val.uncostedProducts ? ` (${val.uncostedProducts} items without a cost)` : ''}. Quantities and moves are shown as recorded. To enable values, record each item's Cost in Odoo or turn on inventory valuation.`}
        </p>
      ) : null}

      {/* Header */}
      <div className={`${CARD_CLS} flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              {T(
                'Central Warehouse & Branch Stock Chain',
                'سلسلة المخزن المركزي وحركات الفروع',
              )}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Package className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span dir="ltr">stock.move • stock.scrap • stock.quant</span>
            </span>
          </div>
          <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
            {isAr
              ? 'قراءة حركات المخزون الفعلية والتالف المسجّل والأرصدة الداخلية من أودو 17 للفترة'
              : 'Actual Odoo 17 stock moves, scrap orders, and internal quant balances for'}{' '}
            <span dir="ltr" className="tabular-nums">
              ({provenanceRange.from} → {provenanceRange.to})
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            disabled={loading}
            aria-label={T('Refresh Warehouse Data', 'تحديث بيانات المخزن')}
            className="ae-emerald-cta-pill inline-flex h-9.5 cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            <span>{T('Refresh Warehouse Data', 'تحديث بيانات المخزن')}</span>
          </button>
          {narrowWindow.narrowed ? (
            <button
              type="button"
              data-warehouse-window={useFullPeriod ? 'full' : 'narrow'}
              onClick={() => setUseFullPeriod((open) => !open)}
              className="inline-flex h-9.5 cursor-pointer items-center rounded-full px-4 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 dark:text-slate-200 dark:ring-white/15 dark:hover:bg-white/5"
            >
              {useFullPeriod
                ? T('Back to this month', 'العودة لبداية الشهر')
                : T('Show the full selected period', 'عرض الفترة المحددة كاملة')}
            </button>
          ) : null}
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
        <StateBlock
          state="loading"
          locale={fmtLocale}
          skeletonRows={4}
          minHeightClass="min-h-[240px]"
          title={T('Loading warehouse movements from Odoo 17...', 'جاري تحميل حركات المخزن من أودو 17...')}
        />
      ) : timedOut ? (
        <StateBlock
          state="error"
          locale={fmtLocale}
          onRetry={() => setReloadNonce((n) => n + 1)}
          title={T(
            'The warehouse request timed out',
            'انتهت مهلة جلب حركات المخزن من أودو',
          )}
          description={T(
            'Odoo did not respond in time. Please try refreshing again.',
            'لم يصل رد أودو في الوقت المحدد. يرجى إعادة المحاولة.',
          )}
        />
      ) : fetchError ? (
        <StateBlock
          state="error"
          locale={fmtLocale}
          onRetry={() => setReloadNonce((n) => n + 1)}
          title={T(
            'Unable to load warehouse movements right now',
            'تعذّر تحميل حركات المخزن حالياً',
          )}
          description={T(
            'A temporary connection issue occurred while reading Odoo inventory telemetry.',
            'حدث خلل مؤقت أثناء قراءة بيانات المخزن من أودو. يرجى المحاولة مجدداً.',
          )}
        />
      ) : !snap.connected || snap.noData ? (
        <StateBlock
          state={!snap.connected ? 'unlinked' : 'empty'}
          locale={fmtLocale}
          onRetry={() => setReloadNonce((n) => n + 1)}
          title={T('No Odoo warehouse data for this period', NO_ODOO_DATA_AR)}
          description={
            isAr
              ? (snap.messageAr ?? NO_ODOO_DATA_AR)
              : 'No completed stock moves, scrap orders, or internal quant balances found for this period.'
          }
        />
      ) : (
        <>
          {/* 5 KPI Cards (2x2 mobile, 4-col lg, 5-col xl) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {/* 1. Current Warehouse On-Hand */}
            <article className={KPI_CARD_CLS}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {T('Internal Stock On-Hand', 'رصيد المخزون الداخلي الحالي')}
                </p>
                <Package className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              </div>
              <div className="mt-2.5 text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white">
                <ValueCell
                  value={kv(snap.periodTotals.closingWarehouseKwd, val.onHandValued)}
                  locale={fmtLocale}
                  text={fmtKwd(kv(snap.periodTotals.closingWarehouseKwd, val.onHandValued))}
                />
              </div>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span dir="ltr" className="tabular-nums">
                  {f1Nullable(snap.periodTotals.closingWarehouseKg)}
                </span>{' '}
                {isAr ? 'وحدة كمية حالية' : 'current units'}
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
                    : 'stock.quant(quantity) × product.product(standard_price)'
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
                <ShoppingBag className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
              </div>
              <div className="mt-2.5 text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white">
                <ValueCell
                  value={kv(snap.periodTotals.totalSupplierInboundKwd, val.movesValued)}
                  locale={fmtLocale}
                  text={fmtKwd(kv(snap.periodTotals.totalSupplierInboundKwd, val.movesValued))}
                />
              </div>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span dir="ltr" className="tabular-nums">
                  {f1Nullable(snap.periodTotals.totalSupplierInboundKg)}
                </span>{' '}
                {isAr ? 'كمية واردة للفترة' : 'inbound qty in period'}
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
                <Truck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              </div>
              <div className="mt-2.5 text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white">
                <ValueCell
                  value={kv(snap.periodTotals.totalDispatchedKwd, val.movesValued)}
                  locale={fmtLocale}
                  text={fmtKwd(kv(snap.periodTotals.totalDispatchedKwd, val.movesValued))}
                />
              </div>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span dir="ltr" className="tabular-nums">
                  {fmtInt(snap.periodTotals.totalDispatchMoves)}
                </span>{' '}
                {isAr ? 'حركة مخزنية منفذة' : 'completed stock moves'}
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
                <Store className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
              </div>
              <div className="mt-2.5 text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white">
                <ValueCell
                  value={kv(snap.periodTotals.totalBomTheoreticalKwd, val.movesValued)}
                  locale={fmtLocale}
                  text={fmtKwd(kv(snap.periodTotals.totalBomTheoreticalKwd, val.movesValued))}
                />
              </div>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span dir="ltr" className="tabular-nums">
                  {f1Nullable(snap.periodTotals.totalBomTheoreticalKg)}
                </span>{' '}
                {isAr ? 'كمية منصرفة' : 'outbound qty'}
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
                <Trash2 className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
              </div>
              <div className={`mt-2.5 text-xl sm:text-2xl font-extrabold ${scrapTone(kv(snap.periodTotals.totalAbnormalShrinkageKwd, val.scrapValued))}`}>
                <ValueCell
                  value={kv(snap.periodTotals.totalAbnormalShrinkageKwd, val.scrapValued)}
                  locale={fmtLocale}
                  text={fmtKwd(kv(snap.periodTotals.totalAbnormalShrinkageKwd, val.scrapValued))}
                />
              </div>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span dir="ltr" className="tabular-nums">
                  {fmtInt(snap.scraps.length)}
                </span>{' '}
                {isAr ? 'أمر إتلاف' : 'scrap orders'} •{' '}
                <span dir="ltr" className="tabular-nums">
                  {fmtPct(snap.periodTotals.periodWastePct)}
                </span>{' '}
                {isAr ? 'من المنصرف' : 'of consumption'}
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
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                  {T(
                    'Branch Stock Transfers, Scrap & On-Hand Summary',
                    'ملخص التحويلات والتالف والرصيد الحالي لكل فرع',
                  )}
                </h3>
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
                    <th className="px-2 py-2.5 text-start">{T('Branch', 'الفرع')}</th>
                    <th className="px-2 py-2.5 text-end">{T('Transfers In (KWD)', 'التحويلات المستلمة')}</th>
                    <th className="px-2 py-2.5 text-end">{T('Moves Count', 'عدد الحركات')}</th>
                    <th className="px-2 py-2.5 text-end">{T('Consumption (KWD)', 'المنصرف المسجّل')}</th>
                    <th className="px-2 py-2.5 text-end">{T('Scrap (KWD)', 'التالف المسجّل')}</th>
                    <th className="px-2 py-2.5 text-end">{T('Current On-Hand', 'الرصيد الحالي')}</th>
                    <th className="px-2 py-2.5 text-end">{T('POS Sales', 'مبيعات الفرع')}</th>
                    <th className="px-2 py-2.5 text-end">{T('Status', 'الحالة')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {snap.branchPeriodSummary.map((b) => (
                    <tr key={b.branchId} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                      <td className="px-2 py-2.5 font-bold text-slate-900 dark:text-white">
                        {isAr ? b.branchNameAr : b.branchNameEn}
                      </td>
                      <td className="px-2 py-2.5 text-end font-semibold">
                        {b.transferMoves > 0 || b.dispatchedKg > 0 ? (
                          <span className="tabular-nums">
                            <span dir="ltr">{fmtInt(b.dispatchedKg)}</span>
                            {val.movesValued ? <span className="text-slate-500"> · {fmtKwd(b.dispatchedFromWarehouseKwd)}</span> : null}
                          </span>
                        ) : (
                          noneCell
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-end text-slate-600 dark:text-slate-300">
                        {b.transferMoves > 0 ? (
                          <ValueCell
                            value={b.transferMoves}
                            locale={fmtLocale}
                            text={fmtInt(b.transferMoves)}
                          />
                        ) : (
                          noneCell
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-end font-semibold">
                        {b.health === 'no-movement' && b.bomTheoreticalCostKwd === 0 ? noneCell : (
                          <ValueCell
                            value={kv(b.bomTheoreticalCostKwd, val.movesValued)}
                            locale={fmtLocale}
                            text={fmtKwd(kv(b.bomTheoreticalCostKwd, val.movesValued))}
                          />
                        )}
                      </td>
                      <td className={`px-2 py-2.5 text-end font-semibold ${scrapTone(kv(b.abnormalShrinkageKwd, val.scrapValued))}`}>
                        {b.health === 'no-movement' && b.abnormalShrinkageKwd === 0 ? noneCell : (
                          <ValueCell
                            value={kv(b.abnormalShrinkageKwd, val.scrapValued)}
                            locale={fmtLocale}
                            text={fmtKwd(kv(b.abnormalShrinkageKwd, val.scrapValued))}
                          />
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-end font-bold text-emerald-700 dark:text-emerald-300">
                        <span className="tabular-nums">
                          <span dir="ltr">{fmtInt(b.closingStockQty)}</span>
                          {val.onHandValued ? <span className="text-slate-500"> · {fmtKwd(b.closingStockKwd)}</span> : null}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-end font-semibold">
                        <ValueCell
                          value={b.posSalesKwd}
                          locale={fmtLocale}
                          text={fmtKwd(b.posSalesKwd)}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-end">
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
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                  {T('Daily Warehouse Movement Ledger', 'دفتر حركات المخزن اليومية الفعلية')}
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span dir="ltr" className="tabular-nums">
                    {fmtInt(snap.days.length)}
                  </span>{' '}
                  {isAr ? 'يوم في الفترة المختارة' : 'days in selected period'}
                </p>
              </div>
              {totalPages > 1 ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <button
                    type="button"
                    disabled={ledgerPage <= 1}
                    aria-label={T('Previous page', 'الصفحة السابقة')}
                    onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40 dark:bg-white/10"
                  >
                    {isAr ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronLeft className="h-4 w-4" aria-hidden />}
                  </button>
                  <span dir="ltr" className="px-2 tabular-nums">
                    {ledgerPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={ledgerPage >= totalPages}
                    aria-label={T('Next page', 'الصفحة التالية')}
                    onClick={() => setLedgerPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40 dark:bg-white/10"
                  >
                    {isAr ? <ChevronLeft className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-white/10 dark:text-slate-400">
                    <th className="px-2 py-2.5 text-start">{T('Date', 'التاريخ')}</th>
                    <th className="px-2 py-2.5 text-end">{T('Supplier Inbound', 'وارد الموردين')}</th>
                    <th className="px-2 py-2.5 text-end">{T('Branch Transfers', 'تحويلات الفروع')}</th>
                    <th className="px-2 py-2.5 text-end">{T('Moves', 'الحركات')}</th>
                    <th className="px-2 py-2.5 text-end">{T('Consumption', 'المنصرف')}</th>
                    <th className="px-2 py-2.5 text-end">{T('Scrap', 'التالف')}</th>
                    <th className="px-2 py-2.5 text-end">{T('POS Sales', 'مبيعات الفروع')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {pagedDays.map((d) => (
                    <tr key={d.dateIso} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                      <td className="px-2 py-2.5 font-semibold text-slate-900 dark:text-white">
                        {isAr ? `${d.weekdayAr} • ${d.dayLabelAr}` : `${d.weekdayEn} • ${d.dayLabelEn}`}
                      </td>
                      <td className="px-2 py-2.5 text-end">
                        <ValueCell
                          value={kv(d.supplierInboundKwd, val.movesValued)}
                          locale={fmtLocale}
                          text={fmtKwd(kv(d.supplierInboundKwd, val.movesValued))}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-end">
                        <ValueCell
                          value={kv(d.warehouseDispatchedKwd, val.movesValued)}
                          locale={fmtLocale}
                          text={fmtKwd(kv(d.warehouseDispatchedKwd, val.movesValued))}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-end text-slate-600 dark:text-slate-300">
                        <ValueCell
                          value={d.dispatchMoves}
                          locale={fmtLocale}
                          text={fmtInt(d.dispatchMoves)}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-end">
                        <ValueCell
                          value={kv(d.bomTheoreticalCostKwd, val.movesValued)}
                          locale={fmtLocale}
                          text={fmtKwd(kv(d.bomTheoreticalCostKwd, val.movesValued))}
                        />
                      </td>
                      <td className={`px-2 py-2.5 text-end ${scrapTone(kv(d.abnormalShrinkageKwd, val.scrapValued))}`}>
                        <ValueCell
                          value={kv(d.abnormalShrinkageKwd, val.scrapValued)}
                          locale={fmtLocale}
                          text={fmtKwd(kv(d.abnormalShrinkageKwd, val.scrapValued))}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-end font-semibold">
                        <ValueCell
                          value={d.branchesPosSalesKwd}
                          locale={fmtLocale}
                          text={fmtKwd(d.branchesPosSalesKwd)}
                        />
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
                <h3 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                  {T('Top Inventory Items (Odoo Products)', 'أعلى الأصناف المخزنية حركة ورصيداً في أودو')}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-white/10 dark:text-slate-400">
                      <th className="px-2 py-2 text-start">{T('Code', 'الكود')}</th>
                      <th className="px-2 py-2 text-start">{T('Product', 'الصنف')}</th>
                      <th className="px-2 py-2 text-start">{T('Category', 'الفئة')}</th>
                      <th className="px-2 py-2 text-end">{T('Unit Cost', 'تكلفة الوحدة')}</th>
                      <th className="px-2 py-2 text-end">{T('On-Hand Qty', 'الرصيد الكمي')}</th>
                      <th className="px-2 py-2 text-end">{T('On-Hand Value', 'قيمة الرصيد')}</th>
                      <th className="px-2 py-2 text-end">{T('Scrap Value', 'قيمة التالف')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {snap.skuFlows.slice(0, 25).map((sku) => (
                      <tr key={`${sku.code}-${sku.nameEn}`} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                        <td className="px-2 py-2 pe-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                          <bdi dir="ltr">{sku.code}</bdi>
                        </td>
                        <td className="px-2 py-2 font-semibold text-slate-900 dark:text-white">
                          {isAr ? sku.nameAr : sku.nameEn}
                        </td>
                        <td className="px-2 py-2 text-xs text-slate-600 dark:text-slate-300">
                          {isAr ? sku.categoryLabelAr : sku.categoryLabelEn}
                        </td>
                        <td className="px-2 py-2 text-end">
                          <ValueCell
                            value={kv(sku.unitCostKwd, sku.costKnown)}
                            locale={fmtLocale}
                            text={fmtKwd(kv(sku.unitCostKwd, sku.costKnown))}
                          />
                        </td>
                        <td className="px-2 py-2 text-end tabular-nums">
                          <bdi dir="ltr" className="whitespace-nowrap">{f1Nullable(sku.warehouseOnHandQty)} {sku.uom}</bdi>
                        </td>
                        <td className="px-2 py-2 text-end font-bold text-emerald-700 dark:text-emerald-300">
                          <ValueCell
                            value={kv(sku.warehouseOnHandKwd, sku.costKnown)}
                            locale={fmtLocale}
                            text={fmtKwd(kv(sku.warehouseOnHandKwd, sku.costKnown))}
                          />
                        </td>
                        <td className={`px-2 py-2 text-end ${scrapTone(kv(sku.scrapValueKwd, sku.costKnown))}`}>
                          <ValueCell
                            value={kv(sku.scrapValueKwd, sku.costKnown)}
                            locale={fmtLocale}
                            text={fmtKwd(kv(sku.scrapValueKwd, sku.costKnown))}
                          />
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
