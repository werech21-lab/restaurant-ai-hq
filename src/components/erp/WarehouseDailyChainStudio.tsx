'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  TrendingUp,
  Truck,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { formatPeriodCalendarWindow } from '@/lib/aether/global-filter-engine'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
import { CompactInfoTooltip } from '@/components/ui/compact-info-tooltip'
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
  'ae-bento-card relative overflow-visible rounded-2xl bg-white p-3.5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:ring-white/10'
const KPI_CARD_CLS =
  'ae-kpi-card relative overflow-visible min-w-0 rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:ring-white/10'
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

const scrapTone = (v: number | null) =>
  v !== null && v > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'

const f1Nullable = (n: number | null | undefined) =>
  formatKwd(n, { showUnit: false, decimals: 1 })

function resolveDynamicWarehouseGridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 sm:grid-cols-2'
  if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
  if (count === 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
}

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
      <span
        data-health="no-movement"
        className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300"
      >
        {isAr ? 'لا حركة مسجلة' : 'No recorded movement'}
      </span>
    )
  }
  if (status === 'critical') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-950/60 dark:text-rose-200">
        <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden />
        <span>{isAr ? 'هدر مرتفع' : 'High Scrap'}</span>
      </span>
    )
  }
  if (status === 'watch') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300/70 dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-600/50">
        <span className="h-2 w-2 shrink-0 rounded-full bg-slate-500" aria-hidden />
        <span>{isAr ? 'مراقبة' : 'Monitor'}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300">
      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
      <span>{isAr ? 'ضمن النطاق' : 'Normal'}</span>
    </span>
  )
}

export interface WarehouseDailyChainStudioProps {
  initialWarehouseChain?: OdooLiveWarehouseChainPayload | null
  initialLoading?: boolean
  initialError?: boolean
  initialTimedOut?: boolean
  initialShowZeroRows?: boolean
}

export function WarehouseDailyChainStudio(props: WarehouseDailyChainStudioProps) {
  const {
    initialWarehouseChain,
    initialLoading,
    initialError = false,
    initialTimedOut = false,
    initialShowZeroRows = false,
  } = props ?? {}
  const { locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const isAr = fmtLocale !== 'en'
  const T = useCallback((en: string, ar: string) => (isAr ? ar : en), [isAr])

  const { filters, workspace, liveSummary } = useGlobalFilter()

  const hasInitialChain = initialWarehouseChain !== undefined
  const [materialCategory, setMaterialCategory] = useState<RawMaterialCategory>('all')
  const [showZeroRows, setShowZeroRows] = useState<boolean>(initialShowZeroRows)
  const [ledgerPage, setLedgerPage] = useState<number>(1)
  const [skuPage, setSkuPage] = useState<number>(1)
  const [skuSearch, setSkuSearch] = useState<string>('')
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
        if (data?.warehouseChain) {
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
    setSkuPage(1)
  }, [
    filters.period,
    filters.branch,
    filters.brand,
    filters.channel,
    filters.customFrom,
    filters.customTo,
    materialCategory,
    showZeroRows,
    skuSearch,
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

  const val = snap.valuation
  const kv = (n: number, ok: boolean): number | null => (ok ? n : null)

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

  const valuationTooltipText =
    snap.connected && !snap.noData && !(val.onHandValued && val.movesValued && val.scrapValued)
      ? isAr
        ? `القيم بالدينار غير متاحة للأصناف التي لا تحمل تكلفة معيارية في Odoo${val.uncostedProducts ? ` (${val.uncostedProducts} صنف بلا تكلفة)` : ''}. الكميات والحركات الفعلية معروضة كما سُجّلت.`
        : `KWD valuation is withheld where Odoo holds no unit cost${val.uncostedProducts ? ` (${val.uncostedProducts} uncosted items)` : ''}. Physical quantities and recorded moves are displayed directly.`
      : ''

  // Dynamic Executive KPI Cards — hide unpopulated/zero/uncosted-empty cards so zero blank `—` slots appear
  const kpiCards = useMemo(() => {
    const cards: { key: string; node: React.ReactNode }[] = []

    const onHandKwd = kv(snap.periodTotals.closingWarehouseKwd, val.onHandValued)
    const onHandQty = snap.periodTotals.closingWarehouseKg
    if ((onHandKwd !== null && Math.abs(onHandKwd) > 0.0005) || Math.abs(onHandQty) > 0.0005) {
      cards.push({
        key: 'on-hand',
        node: (
          <article className={KPI_CARD_CLS}>
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
                {T('Internal Stock On-Hand', 'رصيد المخزون الداخلي الحالي')}
              </p>
              <Package className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            </div>
            <div className="mt-2.5 text-xl sm:text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white">
              {onHandKwd !== null && Math.abs(onHandKwd) > 0.0005 ? (
                <span dir="ltr">{fmtKwd(onHandKwd)}</span>
              ) : (
                <span>
                  <span dir="ltr">{f1Nullable(onHandQty)}</span>{' '}
                  <span className="text-sm font-semibold text-slate-500">
                    {isAr ? 'وحدة' : 'units'}
                  </span>
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span dir="ltr" className="tabular-nums">
                {f1Nullable(onHandQty)}
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
        ),
      })
    }

    const inboundKwd = kv(snap.periodTotals.totalSupplierInboundKwd, val.movesValued)
    const inboundQty = snap.periodTotals.totalSupplierInboundKg
    if ((inboundKwd !== null && inboundKwd > 0.0005) || inboundQty > 0.0005) {
      cards.push({
        key: 'supplier-inbound',
        node: (
          <article className={KPI_CARD_CLS}>
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
                {T('Supplier Inbound Receipts', 'توريدات الموردين المستلمة')}
              </p>
              <ShoppingBag className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
            </div>
            <div className="mt-2.5 text-xl sm:text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white">
              {inboundKwd !== null && inboundKwd > 0.0005 ? (
                <span dir="ltr">{fmtKwd(inboundKwd)}</span>
              ) : (
                <span>
                  <span dir="ltr">{f1Nullable(inboundQty)}</span>{' '}
                  <span className="text-sm font-semibold text-slate-500">
                    {isAr ? 'وحدة' : 'units'}
                  </span>
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span dir="ltr" className="tabular-nums">
                {f1Nullable(inboundQty)}
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
        ),
      })
    }

    const transferKwd = kv(snap.periodTotals.totalDispatchedKwd, val.movesValued)
    const transferMoves = snap.periodTotals.totalDispatchMoves
    if ((transferKwd !== null && transferKwd > 0.0005) || transferMoves > 0) {
      cards.push({
        key: 'branch-transfers',
        node: (
          <article className={KPI_CARD_CLS}>
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
                {T('Transfers to Branches', 'تحويلات المطبخ المركزي للفروع')}
              </p>
              <Truck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            </div>
            <div className="mt-2.5 text-xl sm:text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white">
              {transferKwd !== null && transferKwd > 0.0005 ? (
                <span dir="ltr">{fmtKwd(transferKwd)}</span>
              ) : (
                <span>
                  <span dir="ltr">{fmtInt(transferMoves)}</span>{' '}
                  <span className="text-sm font-semibold text-slate-500">
                    {isAr ? 'حركة' : 'moves'}
                  </span>
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span dir="ltr" className="tabular-nums">
                {fmtInt(transferMoves)}
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
        ),
      })
    }

    const consumptionKwd = kv(snap.periodTotals.totalBomTheoreticalKwd, val.movesValued)
    const consumptionQty = snap.periodTotals.totalBomTheoreticalKg
    if ((consumptionKwd !== null && consumptionKwd > 0.0005) || consumptionQty > 0.0005) {
      cards.push({
        key: 'consumption',
        node: (
          <article className={KPI_CARD_CLS}>
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
                {T('Recorded Consumption Moves', 'المنصرف المخزني المسجّل للإنتاج والبيع')}
              </p>
              <Store className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
            </div>
            <div className="mt-2.5 text-xl sm:text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white">
              {consumptionKwd !== null && consumptionKwd > 0.0005 ? (
                <span dir="ltr">{fmtKwd(consumptionKwd)}</span>
              ) : (
                <span>
                  <span dir="ltr">{f1Nullable(consumptionQty)}</span>{' '}
                  <span className="text-sm font-semibold text-slate-500">
                    {isAr ? 'وحدة' : 'units'}
                  </span>
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span dir="ltr" className="tabular-nums">
                {f1Nullable(consumptionQty)}
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
        ),
      })
    }

    const scrapKwd = kv(snap.periodTotals.totalAbnormalShrinkageKwd, val.scrapValued)
    if ((scrapKwd !== null && scrapKwd > 0.0005) || snap.scraps.length > 0) {
      cards.push({
        key: 'scrap',
        node: (
          <article className={KPI_CARD_CLS}>
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
                {T('Recorded Stock Scrap', 'التالف والهدر الفعلي المسجّل')}
              </p>
              <Trash2 className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
            </div>
            <div className={`mt-2.5 text-xl sm:text-2xl font-extrabold tabular-nums ${scrapTone(scrapKwd)}`}>
              {scrapKwd !== null && scrapKwd > 0.0005 ? (
                <span dir="ltr">{fmtKwd(scrapKwd)}</span>
              ) : (
                <span>
                  <span dir="ltr">{fmtInt(snap.scraps.length)}</span>{' '}
                  <span className="text-sm font-semibold text-slate-500">
                    {isAr ? 'أمر إتلاف' : 'orders'}
                  </span>
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span dir="ltr" className="tabular-nums">
                {fmtInt(snap.scraps.length)}
              </span>{' '}
              {isAr ? 'أمر إتلاف' : 'scrap orders'}
              {snap.periodTotals.periodWastePct !== null && snap.periodTotals.periodWastePct > 0 ? (
                <>
                  {' • '}
                  <span dir="ltr" className="tabular-nums">
                    {fmtPct(snap.periodTotals.periodWastePct)}
                  </span>{' '}
                  {isAr ? 'من المنصرف' : 'of consumption'}
                </>
              ) : null}
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
        ),
      })
    }

    const totalBranchSales = snap.branchPeriodSummary.reduce(
      (sum, b) => sum + (typeof b.posSalesKwd === 'number' ? b.posSalesKwd : 0),
      0,
    )
    if (cards.length < 4 && totalBranchSales > 0.0005) {
      cards.push({
        key: 'branch-pos-sales',
        node: (
          <article className={KPI_CARD_CLS}>
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
                {T('Branch POS Sales in Window', 'مبيعات الفروع للفترة')}
              </p>
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            </div>
            <div dir="ltr" className="mt-2.5 text-xl sm:text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
              {fmtKwd(totalBranchSales)}
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {T('Mapped branches POS revenue', 'صافي إيرادات الفروع المربوطة')}
            </p>
            <KpiProvenanceBadge
              odooModel="pos.order"
              dateRange={provenanceRange}
              lastSyncAt={lastSyncIso}
              isStale24h={isStale24h}
              kind="فعلي"
              queryOrFormula="pos.order net sales across 7 mapped Venture Foods branches"
              compact
            />
          </article>
        ),
      })
    }

    return cards
  }, [
    T,
    fmtInt,
    fmtKwd,
    fmtPct,
    isAr,
    isStale24h,
    lastSyncIso,
    provenanceRange,
    snap.branchPeriodSummary,
    snap.periodTotals.closingWarehouseKg,
    snap.periodTotals.closingWarehouseKwd,
    snap.periodTotals.periodWastePct,
    snap.periodTotals.totalAbnormalShrinkageKwd,
    snap.periodTotals.totalBomTheoreticalKg,
    snap.periodTotals.totalBomTheoreticalKwd,
    snap.periodTotals.totalDispatchMoves,
    snap.periodTotals.totalDispatchedKwd,
    snap.periodTotals.totalSupplierInboundKg,
    snap.periodTotals.totalSupplierInboundKwd,
    snap.quantHasValueField,
    snap.scraps.length,
    val.movesValued,
    val.onHandValued,
    val.scrapValued,
  ])

  const visibleBranches = useMemo(
    () =>
      showZeroRows
        ? snap.branchPeriodSummary
        : snap.branchPeriodSummary.filter(
            (b) =>
              !(
                b.dispatchedKg <= 0 &&
                b.transferMoves <= 0 &&
                b.bomTheoreticalKg <= 0 &&
                b.abnormalShrinkageKg <= 0 &&
                Math.abs(b.closingStockQty) <= 0.0005 &&
                (b.posSalesKwd ?? 0) <= 0.0005
              ),
          ),
    [showZeroRows, snap.branchPeriodSummary],
  )
  const hiddenZeroBranchCount = snap.branchPeriodSummary.length - visibleBranches.length

  const branchCols = useMemo(() => {
    const rows = visibleBranches
    return {
      transfers: showZeroRows || rows.some((b) => b.dispatchedKg > 0 || b.transferMoves > 0),
      moves: showZeroRows || rows.some((b) => b.transferMoves > 0),
      dispensed: showZeroRows || rows.some((b) => b.bomTheoreticalKg > 0),
      scrap: showZeroRows || rows.some((b) => b.abnormalShrinkageKg > 0),
      onHand:
        showZeroRows ||
        rows.some(
          (b) =>
            Math.abs(b.closingStockQty) > 0.0005 ||
            (val.onHandValued && Math.abs(b.closingStockKwd) > 0.0005),
        ),
      posSales: showZeroRows || rows.some((b) => (b.posSalesKwd ?? 0) > 0.0005),
    }
  }, [showZeroRows, val.onHandValued, visibleBranches])

  const reversedDays = useMemo(() => [...snap.days].reverse(), [snap.days])
  const filteredDays = useMemo(() => {
    if (showZeroRows) return reversedDays
    return reversedDays.filter(
      (d) =>
        d.supplierInboundKg > 0.0005 ||
        d.supplierInboundKwd > 0.0005 ||
        d.warehouseDispatchedKg > 0.0005 ||
        d.warehouseDispatchedKwd > 0.0005 ||
        d.dispatchMoves > 0 ||
        d.bomTheoreticalKg > 0.0005 ||
        d.bomTheoreticalCostKwd > 0.0005 ||
        d.abnormalShrinkageKg > 0.0005 ||
        d.abnormalShrinkageKwd > 0.0005 ||
        (d.branchesPosSalesKwd ?? 0) > 0.0005,
    )
  }, [reversedDays, showZeroRows])
  const hiddenZeroDayCount = reversedDays.length - filteredDays.length

  const dayCols = useMemo(() => {
    const rows = filteredDays
    return {
      inbound:
        showZeroRows ||
        rows.some((d) => (val.movesValued ? d.supplierInboundKwd > 0.0005 : d.supplierInboundKg > 0.0005)),
      transfers:
        showZeroRows ||
        rows.some((d) =>
          val.movesValued ? d.warehouseDispatchedKwd > 0.0005 : d.warehouseDispatchedKg > 0.0005,
        ),
      moves: showZeroRows || rows.some((d) => d.dispatchMoves > 0),
      consumption:
        showZeroRows ||
        rows.some((d) =>
          val.movesValued ? d.bomTheoreticalCostKwd > 0.0005 : d.bomTheoreticalKg > 0.0005,
        ),
      scrap:
        showZeroRows ||
        rows.some((d) =>
          val.scrapValued ? d.abnormalShrinkageKwd > 0.0005 : d.abnormalShrinkageKg > 0.0005,
        ),
      posSales: showZeroRows || rows.some((d) => (d.branchesPosSalesKwd ?? 0) > 0.0005),
    }
  }, [filteredDays, showZeroRows, val.movesValued, val.scrapValued])

  const totalPages = Math.max(1, Math.ceil(filteredDays.length / PAGE_SIZE))
  const pagedDays = useMemo(
    () => filteredDays.slice((ledgerPage - 1) * PAGE_SIZE, ledgerPage * PAGE_SIZE),
    [filteredDays, ledgerPage],
  )

  const filteredSkus = useMemo(() => {
    const q = skuSearch.trim().toLowerCase()
    return snap.skuFlows.filter((sku) => {
      if (
        !showZeroRows &&
        Math.abs(sku.warehouseOnHandQty) <= 0.0005 &&
        Math.abs(sku.warehouseOnHandKwd) <= 0.0005 &&
        Math.abs(sku.scrapValueKwd) <= 0.0005
      ) {
        return false
      }
      if (!q) return true
      return (
        sku.code.toLowerCase().includes(q) ||
        sku.nameAr.toLowerCase().includes(q) ||
        sku.nameEn.toLowerCase().includes(q) ||
        sku.categoryLabelAr.toLowerCase().includes(q) ||
        sku.categoryLabelEn.toLowerCase().includes(q)
      )
    })
  }, [showZeroRows, skuSearch, snap.skuFlows])

  const skuCols = useMemo(() => {
    const rows = filteredSkus
    return {
      unitCost: showZeroRows || rows.some((s) => s.costKnown && s.unitCostKwd > 0.0005),
      onHandVal: showZeroRows || rows.some((s) => s.costKnown && Math.abs(s.warehouseOnHandKwd) > 0.0005),
      scrapVal: showZeroRows || rows.some((s) => s.costKnown && s.scrapValueKwd > 0.0005),
    }
  }, [filteredSkus, showZeroRows])

  const totalSkuPages = Math.max(1, Math.ceil(filteredSkus.length / PAGE_SIZE))
  const pagedSkus = useMemo(
    () => filteredSkus.slice((skuPage - 1) * PAGE_SIZE, skuPage * PAGE_SIZE),
    [filteredSkus, skuPage],
  )

  const totalHiddenZeros = hiddenZeroBranchCount + hiddenZeroDayCount

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto min-w-0 space-y-5 pb-16">
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
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Package className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span dir="ltr">stock.move • stock.scrap • stock.quant</span>
            </span>
            {valuationTooltipText ? (
              <CompactInfoTooltip
                text={valuationTooltipText}
                label={T('Odoo Inventory Valuation Note', 'ملاحظة تقييم المخزون في أودو')}
                isAr={isAr}
                dataValuationNote
              />
            ) : null}
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
            role="switch"
            aria-checked={showZeroRows}
            data-show-zero-rows-toggle="true"
            onClick={() => setShowZeroRows((prev) => !prev)}
            className={`inline-flex h-9.5 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
              showZeroRows
                ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/30'
                : 'bg-slate-100 text-slate-700 ring-1 ring-slate-300/70 hover:bg-slate-200/70 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/15 dark:hover:bg-white/10'
            }`}
          >
            {showZeroRows ? (
              <Eye className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
            ) : (
              <EyeOff className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
            )}
            <span>{T('Show zero rows', 'إظهار الصفوف الصفرية')}</span>
            {!showZeroRows && totalHiddenZeros > 0 ? (
              <span dir="ltr" className="rounded-full bg-white/90 px-1.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 dark:bg-white/10 dark:text-slate-200">
                {fmtInt(totalHiddenZeros)}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            disabled={loading}
            aria-label={T('Refresh Warehouse Data', 'تحديث بيانات المخزن')}
            className="ae-emerald-cta-pill inline-flex h-9.5 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            <span>{T('Refresh Warehouse Data', 'تحديث بيانات المخزن')}</span>
          </button>
          {narrowWindow.narrowed ? (
            <button
              type="button"
              data-warehouse-window={useFullPeriod ? 'full' : 'narrow'}
              onClick={() => setUseFullPeriod((open) => !open)}
              className="inline-flex h-9.5 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full px-4 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 dark:text-slate-200 dark:ring-white/15 dark:hover:bg-white/5"
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
          {/* Dynamic KPI Cards — Zero Empty Card Slots */}
          {kpiCards.length > 0 ? (
            <div className={`grid gap-3 sm:gap-4 ${resolveDynamicWarehouseGridClass(kpiCards.length)}`}>
              {kpiCards.map((item) => (
                <React.Fragment key={item.key}>{item.node}</React.Fragment>
              ))}
            </div>
          ) : null}

          {/* Branch Period Summary Table (Active Branches — Zero-Only Rows/Columns Hidden by Default) */}
          {visibleBranches.length > 0 ? (
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
                      'Active mapped Venture Foods locations from Odoo 17 stock locations',
                      'الفروع المعتمدة النشطة وفق مواقع المخزون المربوطة في أودو 17',
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
                <table className="w-full min-w-[540px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-white/10 dark:text-slate-400">
                      <th className="whitespace-nowrap px-2.5 py-2.5 text-start">{T('Branch', 'الفرع')}</th>
                      {branchCols.transfers ? (
                        <th className="whitespace-nowrap px-2.5 py-2.5 text-end">{T('Transfers (qty)', 'التحويلات المستلمة')}</th>
                      ) : null}
                      {branchCols.moves ? (
                        <th className="whitespace-nowrap px-2.5 py-2.5 text-end">{T('Moves Count', 'عدد الحركات')}</th>
                      ) : null}
                      {branchCols.dispensed ? (
                        <th className="whitespace-nowrap px-2.5 py-2.5 text-end">{T('Dispensed (qty)', 'الكمية المنصرفة')}</th>
                      ) : null}
                      {branchCols.scrap ? (
                        <th className="whitespace-nowrap px-2.5 py-2.5 text-end">{T('Scrap (qty)', 'كمية التالف')}</th>
                      ) : null}
                      {branchCols.onHand ? (
                        <th className="whitespace-nowrap px-2.5 py-2.5 text-end">{T('Current On-Hand', 'الرصيد الحالي')}</th>
                      ) : null}
                      {branchCols.posSales ? (
                        <th className="whitespace-nowrap px-2.5 py-2.5 text-end">{T('POS Sales', 'مبيعات الفرع')}</th>
                      ) : null}
                      <th className="whitespace-nowrap px-2.5 py-2.5 text-end">{T('Status', 'الحالة')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {visibleBranches.map((b) => (
                      <tr key={b.branchId} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                        <td className="whitespace-nowrap px-2.5 py-2.5 font-bold text-slate-900 dark:text-white">
                          {isAr ? b.branchNameAr : b.branchNameEn}
                        </td>
                        {branchCols.transfers ? (
                          <td className="whitespace-nowrap px-2.5 py-2.5 text-end font-semibold tabular-nums">
                            {b.dispatchedKg > 0 || b.transferMoves > 0 ? (
                              <bdi dir="ltr">{fmtInt(b.dispatchedKg)}</bdi>
                            ) : (
                              <span data-no-movement="true" className="text-slate-400 dark:text-slate-500">—</span>
                            )}
                          </td>
                        ) : null}
                        {branchCols.moves ? (
                          <td className="whitespace-nowrap px-2.5 py-2.5 text-end text-slate-600 dark:text-slate-300 tabular-nums">
                            {b.transferMoves > 0 ? (
                              <bdi dir="ltr">{fmtInt(b.transferMoves)}</bdi>
                            ) : (
                              <span data-no-movement="true" className="text-slate-400 dark:text-slate-500">—</span>
                            )}
                          </td>
                        ) : null}
                        {branchCols.dispensed ? (
                          <td className="whitespace-nowrap px-2.5 py-2.5 text-end font-semibold tabular-nums">
                            {b.bomTheoreticalKg > 0 ? (
                              <bdi dir="ltr">{fmtInt(b.bomTheoreticalKg)}</bdi>
                            ) : (
                              <span data-no-movement="true" className="text-slate-400 dark:text-slate-500">—</span>
                            )}
                          </td>
                        ) : null}
                        {branchCols.scrap ? (
                          <td className="whitespace-nowrap px-2.5 py-2.5 text-end font-semibold tabular-nums">
                            <bdi dir="ltr">{fmtInt(b.abnormalShrinkageKg)}</bdi>
                          </td>
                        ) : null}
                        {branchCols.onHand ? (
                          <td className="whitespace-nowrap px-2.5 py-2.5 text-end font-bold text-emerald-700 dark:text-emerald-300">
                            <span className="tabular-nums">
                              <span dir="ltr">{fmtInt(b.closingStockQty)}</span>
                              {val.onHandValued ? <span className="text-slate-500"> · {fmtKwd(b.closingStockKwd)}</span> : null}
                            </span>
                          </td>
                        ) : null}
                        {branchCols.posSales ? (
                          <td className="whitespace-nowrap px-2.5 py-2.5 text-end font-semibold">
                            <ValueCell
                              value={b.posSalesKwd}
                              locale={fmtLocale}
                              text={fmtKwd(b.posSalesKwd)}
                            />
                          </td>
                        ) : null}
                        <td className="whitespace-nowrap px-2.5 py-2.5 text-end">
                          <HealthBadge status={b.health} isAr={isAr} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!showZeroRows && hiddenZeroBranchCount > 0 ? (
                <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
                  {isAr
                    ? `${fmtInt(hiddenZeroBranchCount)} فرع بلا حركة مخزنية مسجّلة في هذه الفترة.`
                    : `${fmtInt(hiddenZeroBranchCount)} branch location(s) with zero recorded activity hidden.`}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* Daily Stock Movement Ledger */}
          {filteredDays.length > 0 ? (
            <section className={CARD_CLS}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                    {T('Daily Warehouse Movement Ledger', 'دفتر حركات المخزن اليومية الفعلية')}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span dir="ltr" className="tabular-nums">
                      {fmtInt(filteredDays.length)}
                    </span>{' '}
                    {isAr ? 'يوم نشط في الفترة المختارة' : 'active days in selected period'}
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
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-white/10 dark:text-slate-400">
                      <th className="whitespace-nowrap px-2.5 py-2.5 text-start">{T('Date', 'التاريخ')}</th>
                      {dayCols.inbound ? (
                        <th className="whitespace-nowrap px-2.5 py-2.5 text-end">
                          {val.movesValued ? T('Supplier Inbound', 'وارد الموردين') : T('Inbound Qty', 'كمية الوارد')}
                        </th>
                      ) : null}
                      {dayCols.transfers ? (
                        <th className="whitespace-nowrap px-2.5 py-2.5 text-end">
                          {val.movesValued ? T('Branch Transfers', 'تحويلات الفروع') : T('Transfers Qty', 'كمية التحويلات')}
                        </th>
                      ) : null}
                      {dayCols.moves ? (
                        <th className="whitespace-nowrap px-2.5 py-2.5 text-end">{T('Moves', 'الحركات')}</th>
                      ) : null}
                      {dayCols.consumption ? (
                        <th className="whitespace-nowrap px-2.5 py-2.5 text-end">
                          {val.movesValued ? T('Consumption', 'المنصرف') : T('Consumption Qty', 'كمية المنصرف')}
                        </th>
                      ) : null}
                      {dayCols.scrap ? (
                        <th className="whitespace-nowrap px-2.5 py-2.5 text-end">
                          {val.scrapValued ? T('Scrap', 'التالف') : T('Scrap Qty', 'كمية التالف')}
                        </th>
                      ) : null}
                      {dayCols.posSales ? (
                        <th className="whitespace-nowrap px-2.5 py-2.5 text-end">{T('POS Sales', 'مبيعات الفروع')}</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {pagedDays.map((d) => (
                      <tr key={d.dateIso} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                        <td className="whitespace-nowrap px-2.5 py-2.5 font-semibold text-slate-900 dark:text-white">
                          {isAr ? `${d.weekdayAr} • ${d.dayLabelAr}` : `${d.weekdayEn} • ${d.dayLabelEn}`}
                        </td>
                        {dayCols.inbound ? (
                          <td className="whitespace-nowrap px-2.5 py-2.5 text-end tabular-nums">
                            {val.movesValued ? (
                              <ValueCell
                                value={d.supplierInboundKwd}
                                locale={fmtLocale}
                                text={fmtKwd(d.supplierInboundKwd)}
                              />
                            ) : (
                              <span dir="ltr">{f1Nullable(d.supplierInboundKg)}</span>
                            )}
                          </td>
                        ) : null}
                        {dayCols.transfers ? (
                          <td className="whitespace-nowrap px-2.5 py-2.5 text-end tabular-nums">
                            {val.movesValued ? (
                              <ValueCell
                                value={d.warehouseDispatchedKwd}
                                locale={fmtLocale}
                                text={fmtKwd(d.warehouseDispatchedKwd)}
                              />
                            ) : (
                              <span dir="ltr">{f1Nullable(d.warehouseDispatchedKg)}</span>
                            )}
                          </td>
                        ) : null}
                        {dayCols.moves ? (
                          <td className="whitespace-nowrap px-2.5 py-2.5 text-end text-slate-600 dark:text-slate-300">
                            <ValueCell
                              value={d.dispatchMoves}
                              locale={fmtLocale}
                              text={fmtInt(d.dispatchMoves)}
                            />
                          </td>
                        ) : null}
                        {dayCols.consumption ? (
                          <td className="whitespace-nowrap px-2.5 py-2.5 text-end tabular-nums">
                            {val.movesValued ? (
                              <ValueCell
                                value={d.bomTheoreticalCostKwd}
                                locale={fmtLocale}
                                text={fmtKwd(d.bomTheoreticalCostKwd)}
                              />
                            ) : (
                              <span dir="ltr">{f1Nullable(d.bomTheoreticalKg)}</span>
                            )}
                          </td>
                        ) : null}
                        {dayCols.scrap ? (
                          <td className={`whitespace-nowrap px-2.5 py-2.5 text-end tabular-nums ${scrapTone(kv(d.abnormalShrinkageKwd, val.scrapValued))}`}>
                            {val.scrapValued ? (
                              <ValueCell
                                value={d.abnormalShrinkageKwd}
                                locale={fmtLocale}
                                text={fmtKwd(d.abnormalShrinkageKwd)}
                              />
                            ) : (
                              <span dir="ltr">{f1Nullable(d.abnormalShrinkageKg)}</span>
                            )}
                          </td>
                        ) : null}
                        {dayCols.posSales ? (
                          <td className="whitespace-nowrap px-2.5 py-2.5 text-end font-semibold">
                            <ValueCell
                              value={d.branchesPosSalesKwd}
                              locale={fmtLocale}
                              text={fmtKwd(d.branchesPosSalesKwd)}
                            />
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* Top SKU Stock Flows (Paginated & Filtered) */}
          {snap.skuFlows.length > 0 && (filteredSkus.length > 0 || skuSearch.trim() !== '') ? (
            <section className={CARD_CLS}>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                    {T('Top Inventory Items (Odoo Products)', 'أعلى الأصناف المخزنية حركة ورصيداً في أودو')}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span dir="ltr" className="tabular-nums">{fmtInt(filteredSkus.length)}</span>{' '}
                    {T('active product items', 'صنف مخزني نشط')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={skuSearch}
                      onChange={(e) => setSkuSearch(e.target.value)}
                      aria-label={T('Filter inventory items', 'بحث بالأصناف المخزنية')}
                      placeholder={T('Search item or code...', 'بحث بالصنف أو الكود...')}
                      className="h-9 rounded-xl border border-slate-200 bg-slate-50 ps-9 pe-3 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                    />
                  </div>
                  {totalSkuPages > 1 ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <button
                        type="button"
                        disabled={skuPage <= 1}
                        aria-label={T('Previous SKU page', 'صفحة الأصناف السابقة')}
                        onClick={() => setSkuPage((p) => Math.max(1, p - 1))}
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40 dark:bg-white/10"
                      >
                        {isAr ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronLeft className="h-4 w-4" aria-hidden />}
                      </button>
                      <span dir="ltr" className="px-2 tabular-nums">
                        {skuPage} / {totalSkuPages}
                      </span>
                      <button
                        type="button"
                        disabled={skuPage >= totalSkuPages}
                        aria-label={T('Next SKU page', 'صفحة الأصناف التالية')}
                        onClick={() => setSkuPage((p) => Math.min(totalSkuPages, p + 1))}
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40 dark:bg-white/10"
                      >
                        {isAr ? <ChevronLeft className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {pagedSkus.length === 0 ? (
                <StateBlock
                  state="empty"
                  compact
                  locale={fmtLocale}
                  title={T('No matching items found', 'لا توجد أصناف مطابقة للبحث')}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-white/10 dark:text-slate-400">
                        <th className="whitespace-nowrap px-2.5 py-2 text-start">{T('Code', 'الكود')}</th>
                        <th className="whitespace-nowrap px-2.5 py-2 text-start">{T('Product', 'الصنف')}</th>
                        <th className="whitespace-nowrap px-2.5 py-2 text-start">{T('Category', 'الفئة')}</th>
                        {skuCols.unitCost ? (
                          <th className="whitespace-nowrap px-2.5 py-2 text-end">{T('Unit Cost', 'تكلفة الوحدة')}</th>
                        ) : null}
                        <th className="whitespace-nowrap px-2.5 py-2 text-end">{T('On-Hand Qty', 'الرصيد الكمي')}</th>
                        {skuCols.onHandVal ? (
                          <th className="whitespace-nowrap px-2.5 py-2 text-end">{T('On-Hand Value', 'قيمة الرصيد')}</th>
                        ) : null}
                        {skuCols.scrapVal ? (
                          <th className="whitespace-nowrap px-2.5 py-2 text-end">{T('Scrap Value', 'قيمة التالف')}</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                      {pagedSkus.map((sku) => (
                        <tr key={`${sku.code}-${sku.nameEn}`} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                          <td className="whitespace-nowrap px-2.5 py-2 pe-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                            <bdi dir="ltr">{sku.code}</bdi>
                          </td>
                          <td className="max-w-[240px] truncate px-2.5 py-2 font-semibold text-slate-900 dark:text-white">
                            {isAr ? sku.nameAr : sku.nameEn}
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-2 text-xs text-slate-600 dark:text-slate-300">
                            {isAr ? sku.categoryLabelAr : sku.categoryLabelEn}
                          </td>
                          {skuCols.unitCost ? (
                            <td className="whitespace-nowrap px-2.5 py-2 text-end">
                              <ValueCell
                                value={kv(sku.unitCostKwd, sku.costKnown)}
                                locale={fmtLocale}
                                text={fmtKwd(kv(sku.unitCostKwd, sku.costKnown))}
                              />
                            </td>
                          ) : null}
                          <td className="whitespace-nowrap px-2.5 py-2 text-end tabular-nums">
                            <bdi dir="ltr" className="whitespace-nowrap">{f1Nullable(sku.warehouseOnHandQty)} {sku.uom}</bdi>
                          </td>
                          {skuCols.onHandVal ? (
                            <td className="whitespace-nowrap px-2.5 py-2 text-end font-bold text-emerald-700 dark:text-emerald-300">
                              <ValueCell
                                value={kv(sku.warehouseOnHandKwd, sku.costKnown)}
                                locale={fmtLocale}
                                text={fmtKwd(kv(sku.warehouseOnHandKwd, sku.costKnown))}
                              />
                            </td>
                          ) : null}
                          {skuCols.scrapVal ? (
                            <td className={`whitespace-nowrap px-2.5 py-2 text-end ${scrapTone(kv(sku.scrapValueKwd, sku.costKnown))}`}>
                              <ValueCell
                                value={kv(sku.scrapValueKwd, sku.costKnown)}
                                locale={fmtLocale}
                                text={fmtKwd(kv(sku.scrapValueKwd, sku.costKnown))}
                              />
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
