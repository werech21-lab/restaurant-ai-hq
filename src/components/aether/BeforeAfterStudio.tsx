'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Printer,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { formatSignedDelta } from '@/lib/aether/global-filter-engine'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
import { OdooPartialWarningBanner } from '@/components/erp/OdooPartialWarningBanner'
import { StateBlock, UnavailableState, formatChartKwdTooltip } from '@/components/ui'
import {
  ComparisonBarChart,
  TimelineAreaChart,
  type ChartTooltipLine,
  type ComparisonBarDatum,
  type TimelineAreaDatum,
  type TimelineHourlyDatum,
} from '@/components/charts/v35-chart-kit'
import { V35_CHART_COLORS } from '@/components/charts/v35-chart-theme'
import {
  formatInt,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
  UNAVAILABLE_DASH,
  type FormatLocale,
} from '@/lib/format'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import {
  ExecutiveComparisonControlBar,
  readInitialComparisonQueryFromEnv,
} from '@/components/erp/ExecutiveComparisonControlBar'
import {
  buildComparisonCsv,
  computeErpComparison,
  DEFAULT_RANGE_FROM_A,
  DEFAULT_RANGE_FROM_B,
  DEFAULT_RANGE_TO_A,
  DEFAULT_RANGE_TO_B,
  resolveCompletedComparisonDefaults,
  type ComparisonChartBucket,
  type EntityVarianceRow,
  type ErpComparisonQuery,
  type ExecutiveKpiDelta,
} from '@/lib/erp-comparison-engine'
import { useLang } from '@/components/aether/ui'
import { resolveBestBranchBadge } from '@/lib/aether/period-delta'

function EmeraldPillTabs<K extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { id: K; label: string; badge?: string | number }[]
  value: K
  onChange: (next: K) => void
  ariaLabel?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar rounded-2xl border border-slate-200/85 bg-slate-100/90 p-1 select-none dark:border-slate-800 dark:bg-slate-900/80"
    >
      {options.map((opt) => {
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60 ${
              active
                ? 'btn-colored bg-emerald-700 font-semibold text-white shadow-sm dark:bg-emerald-500 dark:text-slate-950'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
            }`}
          >
            <span>{opt.label}</span>
            {opt.badge !== undefined ? (
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs font-extrabold tabular-nums ${
                  active
                    ? 'bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950'
                    : 'bg-white text-slate-700 dark:bg-white/10 dark:text-slate-300'
                }`}
              >
                {opt.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Default Before-vs-After Query:
 *   - `periodB` = Before Period
 *   - `periodA` = After Period
 */
const DEFAULT_BEFORE_AFTER_QUERY: ErpComparisonQuery = {
  mode: 'date-vs-date',
  granularity: 'range',
  periodA: { from: DEFAULT_RANGE_FROM_A, to: DEFAULT_RANGE_TO_A },
  periodB: { from: DEFAULT_RANGE_FROM_B, to: DEFAULT_RANGE_TO_B },
  brandIds: 'all',
  branchIds: 'all',
  channelIds: 'all',
  entityDimension: 'brand',
  entityA: 'china-garden',
  entityB: 'franks',
}

const f0 = (n: number, locale: FormatLocale = 'en') => formatInt(n, locale)
const fKwdNum = (n: number, locale: FormatLocale = 'en') =>
  formatKwd(n, { locale, showUnit: false, decimals: 3 })
const fmtKwd = (n: number, isAr: boolean) =>
  formatKwd(n, { locale: isAr ? 'ar' : 'en', showUnit: true, decimals: 3 })
const fmtSignedKwd = (n: number, isAr: boolean) =>
  formatKwd(n, { locale: isAr ? 'ar' : 'en', showUnit: true, decimals: 3, signed: true })
const fmtSignedPct = (pct: number, locale: FormatLocale = 'en') =>
  formatPct(pct, { locale, signed: true })
export function fmtSignedPp(pp: number | null | undefined): string {
  if (typeof pp !== 'number' || !Number.isFinite(pp)) return UNAVAILABLE_DASH
  const normalized = Object.is(pp, -0) ? 0 : pp
  return `${normalized > 0 ? '+' : ''}${normalized.toFixed(1)} pp`
}

type TableScopeTab = 'all' | 'brands' | 'branches' | 'channels'
type ChartMetricKey = 'sales' | 'orders' | 'cumulative'

function formatKpiVal(kpi: ExecutiveKpiDelta, slot: 'after' | 'before', locale: FormatLocale): string {
  const v = slot === 'after' ? kpi.valueA : kpi.valueB
  if (kpi.unit === 'orders') return f0(v, locale)
  if (kpi.unit === 'pct') return formatPct(v, { locale })
  return fKwdNum(v, locale)
}

export function BeforeAfterStudio() {
  const { isAr, T } = useLang()
  const resolvedLocale: FormatLocale = isAr ? 'ar' : 'en'
  const unavailableTip = getUnavailableTooltip(resolvedLocale)
  const kwd = isAr ? 'د.ك' : 'KWD'
  const { filters, liveSummary } = useGlobalFilter()

  const hadInitialUrlDatesRef = useRef<boolean | null>(null)
  const userEditedDatesRef = useRef(false)

  const buildDefaultQuery = useCallback((): ErpComparisonQuery => {
    const defs = resolveCompletedComparisonDefaults({
      granularity: 'range',
      liveSummary,
    })
    return {
      ...DEFAULT_BEFORE_AFTER_QUERY,
      periodA: defs.periodA,
      periodB: defs.periodB,
      brandIds: filters.brand === 'all' ? 'all' : [filters.brand],
      branchIds: filters.branch === 'all' ? 'all' : [filters.branch],
      channelIds: filters.channel === 'all' ? 'all' : [filters.channel],
    }
  }, [filters.brand, filters.branch, filters.channel, liveSummary])

  const [query, setQuery] = useState<ErpComparisonQuery>(() => {
    const defs = resolveCompletedComparisonDefaults({ granularity: 'range', liveSummary })
    return {
      ...DEFAULT_BEFORE_AFTER_QUERY,
      periodA: defs.periodA,
      periodB: defs.periodB,
      brandIds: filters.brand === 'all' ? 'all' : [filters.brand],
      branchIds: filters.branch === 'all' ? 'all' : [filters.branch],
      channelIds: filters.channel === 'all' ? 'all' : [filters.channel],
    }
  })

  useEffect(() => {
    if (typeof window !== 'undefined' && hadInitialUrlDatesRef.current === null) {
      const sp = new URLSearchParams(window.location.search)
      hadInitialUrlDatesRef.current = sp.has('dateA') || sp.has('dateB')
    }
    setQuery(readInitialComparisonQueryFromEnv(buildDefaultQuery(), filters))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!liveSummary?.connected || typeof window === 'undefined') return
    if (hadInitialUrlDatesRef.current || userEditedDatesRef.current) return
    setQuery((prev) => {
      const defs = resolveCompletedComparisonDefaults({
        granularity: prev.granularity,
        sameHoursLikeForLike: prev.sameHoursLikeForLike,
        liveSummary,
      })
      if (
        prev.periodA.from === defs.periodA.from &&
        prev.periodA.to === defs.periodA.to &&
        prev.periodB.from === defs.periodB.from &&
        prev.periodB.to === defs.periodB.to
      ) {
        return prev
      }
      return {
        ...prev,
        periodA: defs.periodA,
        periodB: defs.periodB,
      }
    })
  }, [liveSummary])

  const [cubeA, setCubeA] = useState<OdooPeriodCube | null>(null)
  const [cubeB, setCubeB] = useState<OdooPeriodCube | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [apiError, setApiError] = useState<boolean>(false)
  const [retryTick, setRetryTick] = useState<number>(0)
  const [apiConnected, setApiConnected] = useState<boolean>(false)
  const [apiNoData, setApiNoData] = useState<boolean>(false)
  const [apiLastSyncAt, setApiLastSyncAt] = useState<string | null>(null)
  const [apiIsStale24h, setApiIsStale24h] = useState<boolean>(false)

  const [chartMetric, setChartMetric] = useState<ChartMetricKey>('sales')
  const [tableTab, setTableTab] = useState<TableScopeTab>('all')

  // Fetch directly from `/api/erp/live-comparison` (`cubeA`, `cubeB`)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setLoading(true)
    setApiError(false)
    const qs = new URLSearchParams({
      dateA: query.periodA.from,
      toA: query.periodA.to,
      dateB: query.periodB.from,
      toB: query.periodB.to,
      mode: query.mode,
      granularity: query.granularity,
      ...(query.sameHoursLikeForLike ? { sameHours: '1' } : {}),
    })

    fetch(`/api/erp/live-comparison?${qs.toString()}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP_ERROR')
        return res.json()
      })
      .then((payload) => {
        if (!active) return
        if (!payload || payload.connected === false || !payload.cubeA || !payload.cubeB) {
          setApiConnected(false)
          setApiNoData(true)
          setCubeA(null)
          setCubeB(null)
          setApiLastSyncAt(null)
          setApiIsStale24h(false)
          return
        }
        setApiConnected(true)
        setApiNoData(Boolean(payload.noData))
        setCubeA(payload.cubeA as OdooPeriodCube)
        setCubeB(payload.cubeB as OdooPeriodCube)
        setApiLastSyncAt(payload.lastSyncAt ?? payload.cubeA.lastSyncAt ?? null)
        setApiIsStale24h(Boolean(payload.isStale24h ?? payload.cubeA.isStale24h))
      })
      .catch((err: unknown) => {
        if (!active) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setApiConnected(false)
        setApiNoData(false)
        setApiError(true)
        setCubeA(null)
        setCubeB(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [
    query.periodA.from,
    query.periodA.to,
    query.periodB.from,
    query.periodB.to,
    query.mode,
    query.granularity,
    query.sameHoursLikeForLike,
    retryTick,
  ])

  const comparison = useMemo(
    () =>
      cubeA && cubeB
        ? computeErpComparison(query, { cubeA, cubeB, liveSummary })
        : computeErpComparison(query, null),
    [query, cubeA, cubeB, liveSummary],
  )

  const getBucketPair = useCallback(
    (b: ComparisonChartBucket): { before: number; after: number; delta: number; unit: string } => {
      if (chartMetric === 'orders') {
        return {
          before: b.ordersB,
          after: b.ordersA,
          delta: b.ordersDelta,
          unit: isAr ? 'طلب' : 'orders',
        }
      }
      if (chartMetric === 'cumulative') {
        return {
          before: b.cumulativeB,
          after: b.cumulativeA,
          delta: b.cumulativeA - b.cumulativeB,
          unit: kwd,
        }
      }
      return { before: b.seriesB, after: b.seriesA, delta: b.delta, unit: kwd }
    },
    [chartMetric, isAr, kwd],
  )

  const peakBucket = useMemo(() => {
    if (comparison.chartBuckets.length === 0) return null
    let best = comparison.chartBuckets[0]
    for (const b of comparison.chartBuckets) {
      if (getBucketPair(b).after > getBucketPair(best).after) best = b
    }
    return best
  }, [comparison.chartBuckets, getBucketPair])

  const seriesLabelBefore = isAr
    ? `قبل: ${comparison.selectionB.shortLabelAr}`
    : `Before: ${comparison.selectionB.shortLabelEn}`
  const seriesLabelAfter = isAr
    ? `بعد: ${comparison.selectionA.shortLabelAr}`
    : `After: ${comparison.selectionA.shortLabelEn}`

  const comparisonBarData = useMemo<ComparisonBarDatum[]>(() => {
    const isOrders = chartMetric === 'orders'
    return comparison.chartBuckets.map((bkt) => {
      const p = getBucketPair(bkt)
      const bucketLabel = isAr ? bkt.labelAr : bkt.labelEn
      const tooltipTitle =
        bkt.metaA === bkt.metaB
          ? `${bucketLabel} · ${bkt.metaA}`
          : `${bucketLabel} (${bkt.metaB} → ${bkt.metaA})`
      const pctNum = isOrders
        ? p.before > 0
          ? ((p.after - p.before) / p.before) * 100
          : p.after > 0
            ? 100
            : 0
        : bkt.deltaPct
      const pctFormatted = fmtSignedPct(pctNum, resolvedLocale)
      const beforeFormatted = isOrders
        ? `${f0(p.before, resolvedLocale)} ${p.unit}`
        : formatChartKwdTooltip(p.before, resolvedLocale)
      const afterFormatted = isOrders
        ? `${f0(p.after, resolvedLocale)} ${p.unit}`
        : formatChartKwdTooltip(p.after, resolvedLocale)
      const diffFormatted = isOrders
        ? `${formatInt(p.delta, { locale: resolvedLocale, signed: true })} ${p.unit}`
        : formatChartKwdTooltip(p.delta, resolvedLocale, { signed: true })

      const lines: ChartTooltipLine[] = [
        {
          label: seriesLabelBefore,
          value: beforeFormatted,
          tone: 'slate',
        },
        {
          label: seriesLabelAfter,
          value: afterFormatted,
          tone: 'blue',
          bold: true,
        },
        {
          label: isAr ? 'الفارق' : 'Delta',
          value: diffFormatted,
          tone: p.delta > 0 ? 'emerald' : p.delta < 0 ? 'rose' : 'neutral',
          bold: true,
        },
      ]

      return {
        id: bkt.id,
        label: bucketLabel,
        tooltipTitle,
        value: p.after,
        comparisonValue: p.before,
        valueFormatted: afterFormatted,
        comparisonFormatted: beforeFormatted,
        diffFormatted,
        pctFormatted,
        higherIsBetter: true,
        badgeText: pctFormatted,
        badgeTone: p.delta > 0 ? 'emerald' : p.delta < 0 ? 'rose' : 'neutral',
        lines,
      }
    })
  }, [
    chartMetric,
    comparison.chartBuckets,
    getBucketPair,
    isAr,
    resolvedLocale,
    seriesLabelAfter,
    seriesLabelBefore,
  ])

  const cumulativeTimeline = useMemo(() => {
    const buildLines = (bkt: ComparisonChartBucket): ChartTooltipLine[] => {
      const cumDelta = bkt.cumulativeA - bkt.cumulativeB
      return [
        {
          label: seriesLabelBefore,
          value: formatChartKwdTooltip(bkt.cumulativeB, resolvedLocale),
          tone: 'slate',
        },
        {
          label: seriesLabelAfter,
          value: formatChartKwdTooltip(bkt.cumulativeA, resolvedLocale),
          tone: 'blue',
          bold: true,
        },
        {
          label: isAr ? 'الفارق التراكمي' : 'Cumulative Delta',
          value: formatChartKwdTooltip(cumDelta, resolvedLocale, { signed: true }),
          tone: cumDelta > 0 ? 'emerald' : cumDelta < 0 ? 'rose' : 'neutral',
          bold: true,
        },
      ]
    }

    if (comparison.chartKind === 'hourly-14') {
      const summaryTitle = `${comparison.selectionB.shortLabelAr} ← ${comparison.selectionA.shortLabelAr}`
      const summaryTitleEn = `${comparison.selectionB.shortLabelEn} → ${comparison.selectionA.shortLabelEn}`
      const resolvedTitle = isAr ? summaryTitle : summaryTitleEn
      const dailySeries: TimelineAreaDatum[] = [
        {
          day: resolvedTitle,
          label: resolvedTitle,
          netKwd: comparison.selectionA.netSalesKwd,
          secondaryValue: comparison.selectionB.netSalesKwd,
          tooltipLines:
            comparison.chartBuckets.length > 0
              ? buildLines(comparison.chartBuckets[comparison.chartBuckets.length - 1])
              : undefined,
        },
      ]
      const hourlySeries: TimelineHourlyDatum[] = comparison.chartBuckets.map((bkt, idx) => ({
        hour: idx,
        label: isAr ? bkt.labelAr : bkt.labelEn,
        netKwd: bkt.cumulativeA,
        secondaryValue: bkt.cumulativeB,
        tooltipLines: buildLines(bkt),
      }))
      return { dailySeries, hourlySeries }
    }

    const dailySeries: TimelineAreaDatum[] = comparison.chartBuckets.map((bkt) => {
      const bucketLabel = isAr ? bkt.labelAr : bkt.labelEn
      const dayTitle =
        bkt.metaA === bkt.metaB
          ? `${bucketLabel} · ${bkt.metaA}`
          : `${bucketLabel} (${bkt.metaB} → ${bkt.metaA})`
      return {
        day: dayTitle,
        label: bucketLabel,
        netKwd: bkt.cumulativeA,
        secondaryValue: bkt.cumulativeB,
        tooltipLines: buildLines(bkt),
      }
    })
    return { dailySeries, hourlySeries: undefined }
  }, [
    comparison.chartBuckets,
    comparison.chartKind,
    comparison.selectionA.netSalesKwd,
    comparison.selectionA.shortLabelAr,
    comparison.selectionA.shortLabelEn,
    comparison.selectionB.netSalesKwd,
    comparison.selectionB.shortLabelAr,
    comparison.selectionB.shortLabelEn,
    isAr,
    resolvedLocale,
    seriesLabelAfter,
    seriesLabelBefore,
  ])

  const handleExportCsv = useCallback(() => {
    if (!comparison.connected || comparison.noData) return
    const csv = buildComparisonCsv(comparison, isAr)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `before-after-${comparison.selectionB.fromIso}-vs-${comparison.selectionA.fromIso}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [comparison, isAr])

  const showNoData =
    !loading && !apiError && (!apiConnected || apiNoData || !comparison.connected || comparison.noData)
  const dateRangeBadge = `${comparison.selectionB.fromIso}..${comparison.selectionB.toIso} → ${comparison.selectionA.fromIso}..${comparison.selectionA.toIso}`
  const isOrdersMetric = chartMetric === 'orders'
  const chartHeadlineKpi = isOrdersMetric
    ? comparison.selectionA.completedOrders === null
      ? UNAVAILABLE_DASH
      : `${f0(comparison.selectionA.completedOrders, resolvedLocale)} ${isAr ? 'طلب' : 'orders'}`
    : formatChartKwdTooltip(comparison.selectionA.netSalesKwd, resolvedLocale)
  const chartHeadlineDeltaPct = isOrdersMetric
    ? comparison.kpis.completedOrders.available === false
      ? null
      : comparison.kpis.completedOrders.deltaPct
    : comparison.kpis.netSales.deltaPct
  const chartInfoContent = (
    <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
      <p className="font-semibold">
        {isAr
          ? 'مقارنة فعلية مباشرة من مكعبات أودو 17 (pos.order + pos.order.line).'
          : 'Computed directly from Odoo 17 period cubes (pos.order + pos.order.line).'}
      </p>
      <p className="text-slate-600 dark:text-slate-300">
        <span dir="ltr" className="tabular-nums">
          {dateRangeBadge}
        </span>
      </p>
      <p className="text-slate-600 dark:text-slate-300">
        {isAr ? comparison.scopeSummaryAr : comparison.scopeSummaryEn}
      </p>
    </div>
  )

  const renderSectionTable = (
    key: string,
    titleAr: string,
    titleEn: string,
    rows: EntityVarianceRow[],
  ) => {
    // Largest movers first (by absolute change); the unattributed reconciliation row stays last.
    const mapped = rows.filter((r) => !r.isUnattributed).sort((a, b) => Math.abs(b.deltaKwd) - Math.abs(a.deltaKwd))
    const unattr = rows.filter((r) => r.isUnattributed)
    const orderedRows = [...mapped, ...unattr]

    return (
      <div key={key} className="space-y-2.5">
        <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">
          {isAr ? titleAr : titleEn}
        </h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200/85 bg-slate-50/75 p-1 dark:border-slate-800 dark:bg-slate-950/60">
          <table className="w-full min-w-[760px] border-collapse rounded-xl bg-white text-[13.5px] dark:bg-slate-900/95">
            <thead className="sticky top-0 z-10 border-b border-slate-200/85 bg-slate-50/95 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2.5 text-start">{isAr ? 'البند' : 'Entity'}</th>
                <th className="px-3 py-2.5 text-end">{isAr ? 'قبل (ب)' : 'Before (B)'}</th>
                <th className="px-3 py-2.5 text-end">{isAr ? 'بعد (أ)' : 'After (A)'}</th>
                <th className="px-3 py-2.5 text-end">{isAr ? 'الفارق' : 'Delta'}</th>
                <th className="px-3 py-2.5 text-end">{isAr ? 'التغير %' : 'Delta %'}</th>
                <th className="px-4 py-2.5 text-end">
                  {isAr ? 'الطلبات (قبل ← بعد)' : 'Orders (Before → After)'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-white/[0.05]">
              {orderedRows.map((r) => (
                <tr
                  key={r.id}
                  className={
                    r.isUnattributed
                      ? 'bg-slate-50/85 dark:bg-slate-800/35'
                      : !r.isCompatible
                        ? 'opacity-45'
                        : 'even:bg-slate-50/60 hover:bg-[#ECFDF5]/70 dark:even:bg-white/[0.02] dark:hover:bg-white/[0.04]'
                  }
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {isAr ? r.nameAr : r.nameEn}
                    </div>
                    <div className="text-xs text-slate-500">
                      {isAr ? r.subMetaAr : r.subMetaEn}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-end font-mono text-slate-600 dark:text-slate-300">
                    <span dir="ltr" className="tabular-nums">
                      {fmtKwd(r.valueB, isAr)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-end font-mono font-semibold text-slate-900 dark:text-white">
                    <span dir="ltr" className="tabular-nums">
                      {fmtKwd(r.valueA, isAr)}
                    </span>
                  </td>
                  <td
                    className={`px-3 py-3 text-end font-mono font-semibold ${
                      r.deltaKwd >= 0
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    <span dir="ltr" className="tabular-nums">
                      {fmtSignedKwd(r.deltaKwd, isAr)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-end font-mono">
                    <span dir="ltr" className="tabular-nums">
                      {fmtSignedPct(r.deltaPct, resolvedLocale)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end font-mono text-slate-700 dark:text-slate-300">
                    <span dir="ltr" className="tabular-nums">
                      {f0(r.ordersB, resolvedLocale)} → {f0(r.ordersA, resolvedLocale)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="mx-auto w-full max-w-[1920px] space-y-5 pb-12 font-sans text-[14px] text-neutral-900 antialiased sm:text-[15px] dark:text-slate-100"
    >
      {/* 1. Control Bar */}
      <div className="print:hidden">
        <ExecutiveComparisonControlBar
          query={query}
          odooGap={
            loading
              ? null
              : {
                  connected: Boolean(
                    apiConnected && !apiNoData && comparison.connected && !comparison.noData,
                  ),
                  gapKwd:
                    apiConnected && !apiNoData && comparison.connected && !comparison.noData
                      ? comparison.reconciliation.maxSalesGapKwd
                      : null,
                }
          }
          order="b-first"
          labelBEn="Before (Baseline)"
          labelBAr="قبل (الأساس)"
          labelAEn="After (Selected)"
          labelAAr="بعد (المختار)"
          onQueryChange={(next) => {
            userEditedDatesRef.current = true
            setQuery(next)
          }}
          onReset={() => {
            userEditedDatesRef.current = false
            hadInitialUrlDatesRef.current = false
            setQuery(buildDefaultQuery())
          }}
          onExportCsv={handleExportCsv}
          extraActions={
            <button
              type="button"
              disabled={showNoData || loading}
              onClick={() => window.print()}
              aria-label={T('Print comparison report', 'طباعة تقرير المقارنة')}
              className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200/85 bg-slate-50/90 px-3 text-[12.5px] font-semibold text-slate-700 transition-all duration-150 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800/80"
            >
              <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{T('Print', 'طباعة')}</span>
            </button>
          }
        />
      </div>

      <OdooPartialWarningBanner summary={liveSummary} isAr={isAr} />

      {loading ? (
        <StateBlock
          state="loading"
          locale={resolvedLocale}
          skeletonRows={4}
          title={
            isAr
              ? 'جاري جلب مكعبات المقارنة الفعلية من Odoo 17...'
              : 'Fetching period cubes from Odoo 17...'
          }
        />
      ) : null}

      {!loading && apiError ? (
        <StateBlock
          state="error"
          locale={resolvedLocale}
          onRetry={() => setRetryTick((n) => n + 1)}
        />
      ) : null}

      {showNoData ? (
        <StateBlock
          state="empty"
          locale={resolvedLocale}
          title={isAr ? 'لا توجد بيانات من Odoo لهذه الفترة' : 'No data from Odoo for this period'}
          description={
            isAr
              ? 'لم تُسجَّل حركات نقاط بيع في Odoo للتواريخ المختارة أو أن الاتصال بـ Odoo منقطع حالياً.'
              : 'No POS records exist in Odoo for the selected dates or Odoo is currently disconnected.'
          }
        />
      ) : null}

      {!loading && !apiError && !showNoData ? (
        <>
          {/* 1B. Summary Strip */}
          <section className="rounded-2xl border border-slate-200/85 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-semibold tracking-tight text-slate-900 tabular-nums dark:text-white">
                      {isAr
                        ? `قبل (${comparison.selectionB.shortLabelAr}) ← بعد (${comparison.selectionA.shortLabelAr}): `
                        : `Before (${comparison.selectionB.shortLabelEn}) → After (${comparison.selectionA.shortLabelEn}): `}
                      <span dir="ltr" className="tabular-nums">
                        {fmtSignedKwd(comparison.kpis.netSales.deltaAbs, isAr)} (
                        {fmtSignedPct(comparison.kpis.netSales.deltaPct, resolvedLocale)})
                      </span>
                    </span>
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/[0.07] dark:text-slate-300">
                      {isAr ? comparison.scopeSummaryAr : comparison.scopeSummaryEn}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 tabular-nums">
                {comparison.insights.topGainer &&
                  (() => {
                    const topBadge = resolveBestBranchBadge(comparison.insights.topGainer.deltaKwd)
                    if (topBadge.tone === 'emerald') {
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50/90 px-3 py-1 text-[12px] font-semibold text-emerald-900 ring-1 ring-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-200">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                          <span>
                            {isAr ? `${topBadge.labelAr}:` : `${topBadge.labelEn}:`}{' '}
                            {isAr
                              ? comparison.insights.topGainer.nameAr
                              : comparison.insights.topGainer.nameEn}{' '}
                            <span dir="ltr" className="tabular-nums">
                              ({fmtSignedKwd(comparison.insights.topGainer.deltaKwd, isAr)})
                            </span>
                          </span>
                        </span>
                      )
                    }
                    if (comparison.insights.topGainer.deltaKwd < 0) {
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-900/10 dark:bg-white/10 dark:text-slate-200">
                          <TrendingDown className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                          <span>
                            {isAr ? `${topBadge.labelAr}:` : `${topBadge.labelEn}:`}{' '}
                            {isAr
                              ? comparison.insights.topGainer.nameAr
                              : comparison.insights.topGainer.nameEn}{' '}
                            <span dir="ltr" className="tabular-nums">
                              ({fmtSignedKwd(comparison.insights.topGainer.deltaKwd, isAr)})
                            </span>
                          </span>
                        </span>
                      )
                    }
                    return null
                  })()}
                {comparison.insights.biggestDecline &&
                  comparison.insights.biggestDecline.deltaKwd < 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50/90 px-3 py-1 text-[12px] font-semibold text-rose-900 ring-1 ring-rose-600/15 dark:bg-rose-500/15 dark:text-rose-200">
                      <TrendingDown className="h-3.5 w-3.5 text-rose-600" aria-hidden />
                      <span>
                        {isAr ? 'أكبر تراجع:' : 'Biggest Drop:'}{' '}
                        {isAr
                          ? comparison.insights.biggestDecline.nameAr
                          : comparison.insights.biggestDecline.nameEn}{' '}
                        <span dir="ltr" className="tabular-nums">
                          ({fmtSignedKwd(comparison.insights.biggestDecline.deltaKwd, isAr)})
                        </span>
                      </span>
                    </span>
                  )}
              </div>
            </div>
          </section>

          {/* 1C. KPI Delta Cards */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {comparison.kpiList.map((kpi) => {
              const isGlKpi =
                kpi.id === 'foodAndAggregatorCost' ||
                kpi.id === 'netPocketCash' ||
                kpi.id === 'netPocketMargin'
              // GL KPIs follow the accounting state; order KPIs are unavailable when counts are unknown.
              const isUnavailable =
                kpi.available === false || (isGlKpi && !comparison.accountingAvailable)
              const unavailableNoteAr = kpi.unavailableReasonAr ?? 'غير متاح'
              const unavailableNoteEn = kpi.unavailableReasonEn ?? 'Unavailable'
              const signed = formatSignedDelta(kpi.deltaPct)
              const badgeTone =
                kpi.trend === 'flat' || signed.sign === 'flat'
                  ? 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                  : kpi.isFavorable
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20 dark:bg-emerald-500/20 dark:text-emerald-200'
                    : 'bg-rose-50 text-rose-800 ring-1 ring-rose-600/20 dark:bg-rose-500/20 dark:text-rose-200'

              if (isGlKpi && isUnavailable) return null
              return (
                <article
                  key={kpi.id}
                  className="ae-kpi-card rounded-2xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5 dark:border-slate-800 dark:bg-slate-900/95"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="text-[12px] font-semibold text-neutral-500 sm:text-[12.5px] dark:text-slate-300">
                      {isAr ? kpi.labelAr : kpi.labelEn}
                    </span>
                    {isUnavailable ? null : kpi.isFavorable ? (
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
                    )}
                  </div>

                  {isUnavailable ? (
                    <>
                      <div
                        dir="ltr"
                        data-unavailable="true"
                        title={unavailableTip}
                        aria-label={unavailableTip}
                        className="mt-2 text-xl font-semibold tabular-nums text-slate-400"
                      >
                        {UNAVAILABLE_DASH}
                      </div>
                      <div className="mt-2">
                        <UnavailableState
                          compact
                          isAr={isAr}
                          reason={isAr ? unavailableNoteAr : unavailableNoteEn}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* The value AFTER is the headline; the change is a labelled badge — a signed
                          change is never shown as if it were the sales figure itself. */}
                      <div dir="ltr" className="mt-2 flex flex-wrap items-baseline gap-1.5 tabular-nums">
                        <span className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl dark:text-white">
                          {formatKpiVal(kpi, 'after', resolvedLocale)}
                        </span>
                        {kpi.unit === 'KWD' ? <span className="text-[13px] font-semibold text-slate-500">{kwd}</span> : null}
                        {kpi.unit === 'orders' ? <span className="text-[13px] font-semibold text-slate-500">{isAr ? 'طلب' : 'ord'}</span> : null}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 tabular-nums">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{isAr ? 'التغيّر' : 'Change'}</span>
                        <span
                          dir="ltr"
                          data-kpi-change="true"
                          className={`rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums ${badgeTone}`}
                        >
                          {kpi.unit === 'pct'
                            ? Number.isFinite(kpi.deltaPct)
                              ? `${signed.arrow} ${fmtSignedPp(kpi.deltaPct)}`
                              : UNAVAILABLE_DASH
                            : `${kpi.unit === 'orders' ? formatInt(kpi.deltaAbs, { locale: resolvedLocale, signed: true }) : fmtSignedKwd(kpi.deltaAbs, isAr)} · ${signed.text}`}
                        </span>
                      </div>

                      <p className="mt-2 border-t border-slate-100 pt-1.5 text-[13px] text-neutral-500 tabular-nums dark:border-white/[0.06] dark:text-slate-400">
                        {isAr ? 'قبل:' : 'Before:'}{' '}
                        <span dir="ltr" className="font-semibold text-slate-700 dark:text-slate-200">
                          {formatKpiVal(kpi, 'before', resolvedLocale)}
                          {kpi.unit === 'KWD' ? ` ${kwd}` : ''}
                        </span>
                      </p>
                    </>
                  )}

                  <KpiProvenanceBadge
                    odooModel={isGlKpi ? 'account.move.line' : 'pos.order.line'}
                    dateRange={dateRangeBadge}
                    lastSyncAt={apiLastSyncAt}
                    isStale24h={apiIsStale24h}
                    kind={kpi.id === 'averageCheck' || kpi.unit === 'pct' ? 'محسوب بمعادلة' : 'فعلي'}
                  />
                </article>
              )
            })}
          </section>

          {/* 1D. Visual Before-vs-After Trend Chart */}
          <section
            role="region"
            aria-label={
              isAr
                ? `المنحنى الزمني للمقارنة — ${dateRangeBadge}`
                : `Before vs After Period Trend — ${dateRangeBadge}`
            }
            className="ae-bento-card rounded-2xl border border-slate-200/85 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6 dark:border-slate-800 dark:bg-slate-900/95"
          >
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-[16px] font-extrabold tracking-tight text-neutral-950 sm:text-[17px] dark:text-white">
                  {T(
                    'Before vs. After Period Trend',
                    'المنحنى الزمني للمقارنة (قبل مقابل بعد)',
                  )}
                </h2>
                <p className="text-[13px] text-neutral-500 dark:text-slate-400">
                  {isAr
                    ? `مقارنة ${comparison.selectionB.titleAr} مقابل ${comparison.selectionA.titleAr} · ${chartMetric === 'orders' ? 'الطلبات (طلب)' : 'د.ك (KWD)'}`
                    : `Comparing ${comparison.selectionB.titleEn} vs ${comparison.selectionA.titleEn} · ${chartMetric === 'orders' ? 'Orders' : 'KWD'}`}
                </p>
              </div>

              <EmeraldPillTabs<ChartMetricKey>
                ariaLabel={T('Chart Metric', 'مؤشر الرسم البياني')}
                value={chartMetric}
                onChange={setChartMetric}
                options={[
                  { id: 'sales', label: T('Sales KWD', 'المبيعات د.ك') },
                  { id: 'orders', label: T('Orders', 'الطلبات') },
                  { id: 'cumulative', label: T('Cumulative', 'التراكمي') },
                ]}
              />
            </div>

            {peakBucket &&
              (() => {
                const p = getBucketPair(peakBucket)
                const isOrders = chartMetric === 'orders'
                return (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-slate-50/75 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-emerald-400/15 dark:bg-slate-900/40 dark:text-slate-200">
                    <div className="flex flex-wrap items-center gap-3 tabular-nums">
                      <span className="text-slate-600 dark:text-slate-300">
                        {seriesLabelBefore}:{' '}
                        <span dir="ltr">
                          {isOrders
                            ? comparison.selectionB.completedOrders === null
                              ? UNAVAILABLE_DASH
                              : `${f0(comparison.selectionB.completedOrders, resolvedLocale)} ${p.unit}`
                            : formatChartKwdTooltip(comparison.selectionB.netSalesKwd, resolvedLocale)}
                        </span>
                      </span>
                      <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                        {isAr ? '←' : '→'}
                      </span>
                      <span className="font-semibold text-[#047857] dark:text-emerald-300">
                        {seriesLabelAfter}:{' '}
                        <span dir="ltr">
                          {isOrders
                            ? comparison.selectionA.completedOrders === null
                              ? UNAVAILABLE_DASH
                              : `${f0(comparison.selectionA.completedOrders, resolvedLocale)} ${p.unit}`
                            : formatChartKwdTooltip(comparison.selectionA.netSalesKwd, resolvedLocale)}
                        </span>
                      </span>
                    </div>
                    <div
                      dir={isAr ? 'rtl' : 'ltr'}
                      className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-200/80 tabular-nums dark:bg-slate-900/70 dark:text-slate-100 dark:ring-emerald-400/20"
                    >
                      <span className="text-[#047857] dark:text-emerald-300">
                        {isAr ? `الذروة: ${peakBucket.labelAr}` : `Peak: ${peakBucket.labelEn}`}
                      </span>
                      <span dir="ltr">
                        {isOrders
                          ? `${f0(p.before, resolvedLocale)} ${p.unit}`
                          : formatChartKwdTooltip(p.before, resolvedLocale)}{' '}
                        →{' '}
                        <strong>
                          {isOrders
                            ? `${f0(p.after, resolvedLocale)} ${p.unit}`
                            : formatChartKwdTooltip(p.after, resolvedLocale)}
                        </strong>
                      </span>
                    </div>
                  </div>
                )
              })()}

            {comparison.chartBuckets.length === 0 ? (
              <StateBlock state="empty" compact locale={resolvedLocale} />
            ) : chartMetric === 'cumulative' ? (
              <TimelineAreaChart
                dailySeries={cumulativeTimeline.dailySeries}
                hourlySeries={cumulativeTimeline.hourlySeries}
                isAr={isAr}
                title={seriesLabelAfter}
                kpiValue={chartHeadlineKpi}
                deltaPct={chartHeadlineDeltaPct}
                deltaLabel={seriesLabelBefore}
                infoLabel={isAr ? 'تفاصيل ومنهجية المقارنة' : 'Comparison details & basis'}
                infoContent={chartInfoContent}
                valueLabel={seriesLabelAfter}
                secondaryLabel={seriesLabelBefore}
                yAxisLabel={
                  isAr
                    ? 'المحور الرأسي: المبيعات التراكمية (د.ك)'
                    : 'Y-Axis: Cumulative Sales (KWD)'
                }
                xAxisLabel={
                  comparison.chartKind === 'hourly-14'
                    ? isAr
                      ? 'الساعات التشغيلية (توقيت الكويت)'
                      : 'Operating Hours (Asia/Kuwait)'
                    : isAr
                      ? 'الأيام (توقيت الكويت)'
                      : 'Days (Asia/Kuwait)'
                }
                formatValue={(v) => formatChartKwdTooltip(v, resolvedLocale)}
                height={280}
                ariaLabel={
                  isAr
                    ? `المنحنى التراكمي للمقارنة — ${dateRangeBadge}`
                    : `Cumulative Before vs After Timeline — ${dateRangeBadge}`
                }
              />
            ) : (
              <ComparisonBarChart
                data={comparisonBarData}
                isAr={isAr}
                title={seriesLabelAfter}
                kpiValue={chartHeadlineKpi}
                deltaPct={chartHeadlineDeltaPct}
                deltaLabel={seriesLabelBefore}
                infoLabel={isAr ? 'تفاصيل ومنهجية المقارنة' : 'Comparison details & basis'}
                infoContent={chartInfoContent}
                primaryLabel={seriesLabelAfter}
                comparisonLabel={seriesLabelBefore}
                primaryColor={V35_CHART_COLORS.primary}
                comparisonColor={V35_CHART_COLORS.comparison}
                yAxisLabel={
                  chartMetric === 'orders'
                    ? isAr
                      ? 'المحور الرأسي: عدد الطلبات'
                      : 'Y-Axis: Orders'
                    : isAr
                      ? 'المحور الرأسي: صافي المبيعات (د.ك)'
                      : 'Y-Axis: Net Sales (KWD)'
                }
                xAxisLabel={
                  comparison.chartKind === 'hourly-14'
                    ? isAr
                      ? 'الساعات التشغيلية (توقيت الكويت)'
                      : 'Operating Hours (Asia/Kuwait)'
                    : isAr
                      ? 'الأيام (توقيت الكويت)'
                      : 'Days (Asia/Kuwait)'
                }
                formatTick={
                  chartMetric === 'orders' ? (v) => formatInt(v, resolvedLocale) : undefined
                }
                formatTooltip={
                  chartMetric === 'orders'
                    ? (v) => `${formatInt(v, resolvedLocale)} ${isAr ? 'طلب' : 'orders'}`
                    : (v) => formatChartKwdTooltip(v, resolvedLocale)
                }
                height={280}
                ariaLabel={
                  isAr
                    ? `المنحنى الزمني للمقارنة — ${dateRangeBadge}`
                    : `Before vs After Period Trend — ${dateRangeBadge}`
                }
              />
            )}
          </section>

          {/* 2. Dimensional Before vs. After Variance Table (7 Branches + Unattributed, 6 Brands, Channels) */}
          <section className="ae-bento-card space-y-5 rounded-2xl border border-slate-200/85 bg-white px-3.5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6 dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-[18px] font-extrabold tracking-tight text-neutral-950 dark:text-white">
                  {T(
                    'Before vs. After Dimensional Variance Table',
                    'جدول الفروقات التفصيلي (قبل وبعد)',
                  )}
                </h2>
                <p className="mt-0.5 text-[14px] text-neutral-500 dark:text-slate-400">
                  {isAr
                    ? 'مقارنة الفروقات الفعلية من Odoo 17 عبر العلامات التجارية الست والفروع السبعة وسطر غير منسوب لفرع والقنوات.'
                    : 'Actual Odoo 17 POS variance across the 6 brands, 7 branches + Unattributed to Branch, and channels.'}
                </p>
              </div>

              <EmeraldPillTabs<TableScopeTab>
                ariaLabel={T('Table Filter', 'تصفية الجدول')}
                value={tableTab}
                onChange={setTableTab}
                options={[
                  { id: 'all', label: T('Show All', 'عرض الكل') },
                  { id: 'branches', label: T('By Branch (7 + Unattributed)', 'حسب الفرع (7 + غير منسوب لفرع)') },
                  { id: 'brands', label: T('By Brand (6)', 'حسب المطعم (6)') },
                  { id: 'channels', label: T('By Channel', 'حسب القناة') },
                ]}
              />
            </div>

            <div className="space-y-6">
              {(tableTab === 'all' || tableTab === 'branches') &&
                renderSectionTable(
                  'branches',
                  'حسب الفرع (7 فروع + غير منسوب لفرع)',
                  'By Branch (7 Branches + Unattributed)',
                  comparison.byBranch,
                )}
              {(tableTab === 'all' || tableTab === 'brands') &&
                renderSectionTable('brands', 'حسب المطعم (6 علامات)', 'By Brand (6 Brands)', comparison.byBrand)}
              {(tableTab === 'all' || tableTab === 'channels') &&
                renderSectionTable('channels', 'حسب القناة', 'By Channel', comparison.byChannel)}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
