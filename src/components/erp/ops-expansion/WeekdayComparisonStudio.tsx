'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Check,
  Copy,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import {
  formatInt,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
  UNAVAILABLE_DASH,
  type FormatLocale,
} from '@/lib/format'
import { publishPageOdooSync } from '@/lib/odoo-page-sync'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { formatSignedDelta } from '@/lib/aether/global-filter-engine'
import { resolveBestBranchBadge } from '@/lib/aether/period-delta'
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
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import {
  ExecutiveComparisonControlBar,
  readInitialComparisonQueryFromEnv,
} from '@/components/erp/ExecutiveComparisonControlBar'
import {
  buildComparisonCsv,
  computeErpComparison,
  DEFAULT_COMPARISON_DATE_A,
  DEFAULT_COMPARISON_DATE_B,
  resolveCompletedComparisonDefaults,
  type BreakdownDimension,
  type ComparisonChartBucket,
  type ErpComparisonQuery,
  type ExecutiveKpiDelta,
} from '@/lib/erp-comparison-engine'

const CARD_CLS =
  'ae-bento-card rounded-2xl border border-slate-200/85 bg-white p-3.5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/95'
const KPI_CLS =
  'ae-kpi-card rounded-2xl border border-slate-200/85 bg-white p-3.5 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 dark:border-slate-800 dark:bg-slate-900/95'
const SEGMENT_TRACK_CLS =
  'flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar rounded-2xl border border-slate-200/85 bg-slate-100/90 p-1 dark:border-slate-800 dark:bg-slate-900/80'
const SEGMENT_BTN_CLS =
  'shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 cursor-pointer'
const SEGMENT_BTN_ACTIVE_CLS =
  'bg-white font-semibold text-blue-700 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80 dark:bg-sky-500/20 dark:text-sky-200 dark:ring-sky-400/25'
const SEGMENT_BTN_IDLE_CLS =
  'text-slate-600 hover:bg-white/75 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
const TABLE_SCROLL_CLS =
  'overflow-x-auto rounded-2xl border border-slate-200/85 bg-slate-50/75 p-1 dark:border-slate-800 dark:bg-slate-950/60'

type ChartMetricKey = 'sales' | 'orders' | 'cumulative'
type SortColumnKey = 'valueA' | 'valueB' | 'deltaKwd' | 'deltaPct' | 'ordersA'

const DEFAULT_STUDIO_QUERY: ErpComparisonQuery = {
  mode: 'date-vs-date',
  granularity: 'single',
  periodA: { from: DEFAULT_COMPARISON_DATE_A, to: DEFAULT_COMPARISON_DATE_A },
  periodB: { from: DEFAULT_COMPARISON_DATE_B, to: DEFAULT_COMPARISON_DATE_B },
  brandIds: 'all',
  branchIds: 'all',
  channelIds: 'all',
  entityDimension: 'brand',
  entityA: 'china-garden',
  entityB: 'franks',
}

/** `null` (unknown, e.g. brand orders Odoo could not count) renders as —. */
const fmt0 = (n: number | null, locale: FormatLocale = 'en') => formatInt(n, locale)
const fmtKwd = (n: number | null, locale: FormatLocale = 'en') =>
  formatKwd(n, { locale, showUnit: false, decimals: 3 })
const fmtSignedKwd = (n: number, locale: FormatLocale = 'en') =>
  formatKwd(n, { locale, showUnit: false, decimals: 3, signed: true })
const fmtSignedPct = (n: number, locale: FormatLocale = 'en') =>
  formatPct(n, { locale, signed: true })
export function fmtSignedPp(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return UNAVAILABLE_DASH
  const normalized = Object.is(n, -0) ? 0 : n
  return `${normalized > 0 ? '+' : ''}${normalized.toFixed(1)} pp`
}

function tierBadgeCls(tier: 'green' | 'yellow' | 'red'): string {
  if (tier === 'green') {
    return 'bg-emerald-50/85 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300'
  }
  if (tier === 'yellow') {
    return 'bg-slate-100/90 text-slate-700 ring-1 ring-slate-300/60 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-slate-600/35'
  }
  return 'bg-rose-50/85 text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-500/15 dark:text-rose-300'
}

function tierDotCls(tier: 'green' | 'yellow' | 'red'): string {
  if (tier === 'green') return 'bg-emerald-500'
  if (tier === 'yellow') return 'bg-slate-400 dark:bg-slate-500'
  return 'bg-rose-500'
}

function formatKpiPrimaryValue(kpi: ExecutiveKpiDelta, locale: FormatLocale): string {
  if (kpi.unit === 'orders') return fmt0(kpi.valueA, locale)
  if (kpi.unit === 'pct') return formatPct(kpi.valueA, { locale })
  return fmtKwd(kpi.valueA, locale)
}

function formatKpiSecondaryValue(kpi: ExecutiveKpiDelta, locale: FormatLocale): string {
  if (kpi.unit === 'orders') return fmt0(kpi.valueB, locale)
  if (kpi.unit === 'pct') return formatPct(kpi.valueB, { locale })
  return fmtKwd(kpi.valueB, locale)
}

function formatKpiDeltaBadge(kpi: ExecutiveKpiDelta): string {
  const signed = formatSignedDelta(kpi.deltaPct)
  if (kpi.unit === 'pct') {
    return Number.isFinite(kpi.deltaPct)
      ? `${signed.arrow} ${fmtSignedPp(kpi.deltaPct)}`
      : UNAVAILABLE_DASH
  }
  return signed.text
}

export function WeekdayComparisonStudio() {
  const { locale } = useI18n()
  const resolvedLocale: FormatLocale = locale !== 'en' ? 'ar' : 'en'
  const isAr = resolvedLocale !== 'en'
  const unavailableTip = getUnavailableTooltip(resolvedLocale)
  const kwd = isAr ? 'د.ك' : 'KWD'
  const { filters, liveSummary } = useGlobalFilter()

  const hadInitialUrlDatesRef = useRef<boolean | null>(null)
  const userEditedDatesRef = useRef(false)

  const buildDefaultStudioQuery = useCallback((): ErpComparisonQuery => {
    const defs = resolveCompletedComparisonDefaults({
      granularity: 'single',
      liveSummary,
    })
    return {
      ...DEFAULT_STUDIO_QUERY,
      periodA: defs.periodA,
      periodB: defs.periodB,
      brandIds: filters.brand === 'all' ? 'all' : [filters.brand],
      branchIds: filters.branch === 'all' ? 'all' : [filters.branch],
      channelIds: filters.channel === 'all' ? 'all' : [filters.channel],
    }
  }, [filters.brand, filters.branch, filters.channel, liveSummary])

  const [query, setQuery] = useState<ErpComparisonQuery>(() => {
    const defs = resolveCompletedComparisonDefaults({ granularity: 'single', liveSummary })
    return {
      ...DEFAULT_STUDIO_QUERY,
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
    setQuery(readInitialComparisonQueryFromEnv(buildDefaultStudioQuery(), filters))
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
  const [tableTab, setTableTab] = useState<BreakdownDimension>('branch')
  const [sortCol, setSortCol] = useState<SortColumnKey>('valueA')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [copiedReport, setCopiedReport] = useState(false)

  // Always fetch real period cubes from `/api/erp/live-comparison`
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

  useEffect(() => {
    if (loading) return undefined
    const connected = Boolean(apiConnected && !apiNoData && apiLastSyncAt)
    publishPageOdooSync(
      connected
        ? { connected: true, lastSyncAt: apiLastSyncAt, source: 'live-comparison' }
        : { connected: false, lastSyncAt: null, source: 'live-comparison' },
    )
    return () => publishPageOdooSync(null)
  }, [apiConnected, apiLastSyncAt, apiNoData, loading])

  const comparison = useMemo(
    () =>
      cubeA && cubeB
        ? computeErpComparison(query, { cubeA, cubeB, liveSummary })
        : computeErpComparison(query, null),
    [query, cubeA, cubeB, liveSummary],
  )

  const getBucketPair = useCallback(
    (b: ComparisonChartBucket): { a: number; b: number; delta: number; unitLabel: string } => {
      if (chartMetric === 'orders') {
        return {
          a: b.ordersA,
          b: b.ordersB,
          delta: b.ordersDelta,
          unitLabel: isAr ? 'طلب' : 'orders',
        }
      }
      if (chartMetric === 'cumulative') {
        return {
          a: b.cumulativeA,
          b: b.cumulativeB,
          delta: b.cumulativeA - b.cumulativeB,
          unitLabel: kwd,
        }
      }
      return { a: b.seriesA, b: b.seriesB, delta: b.delta, unitLabel: kwd }
    },
    [chartMetric, isAr, kwd],
  )

  const peakBucket = useMemo(() => {
    if (comparison.chartBuckets.length === 0) return null
    let best = comparison.chartBuckets[0]
    for (const b of comparison.chartBuckets) {
      if (getBucketPair(b).a > getBucketPair(best).a) best = b
    }
    return best
  }, [comparison.chartBuckets, getBucketPair])

  const activeEntityRows = useMemo(() => {
    const src =
      tableTab === 'brand'
        ? comparison.byBrand
        : tableTab === 'channel'
          ? comparison.byChannel
          : comparison.byBranch

    // Keep standalone 8th unattributed row pinned at bottom of branch breakdown when sorting
    const mapped = src.filter((r) => !r.isUnattributed)
    const unattr = src.filter((r) => r.isUnattributed)

    mapped.sort((a, b) => {
      const diff = a[sortCol] - b[sortCol]
      return sortDir === 'desc' ? -diff : diff
    })

    return [...mapped, ...unattr]
  }, [comparison.byBranch, comparison.byBrand, comparison.byChannel, sortCol, sortDir, tableTab])

  const toggleSort = useCallback(
    (col: SortColumnKey) => {
      if (sortCol === col) {
        setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
      } else {
        setSortCol(col)
        setSortDir('desc')
      }
    },
    [sortCol],
  )

  const handleExportCsv = useCallback(() => {
    if (!comparison.connected || comparison.noData) return
    const csv = buildComparisonCsv(comparison, isAr)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `venture-foods-comparison-${comparison.selectionA.fromIso}-vs-${comparison.selectionB.fromIso}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [comparison, isAr])

  const handleCopyReport = useCallback(async () => {
    if (!comparison.connected || comparison.noData) return
    const sA = comparison.selectionA
    const sB = comparison.selectionB
    const lines = isAr
      ? [
          `📊 *تقرير المقارنة من Odoo 17 — فنتشر فودز*`,
          `النطاق: ${comparison.scopeSummaryAr}`,
          `• الأساس (أ — ${sA.titleAr}): *${fmtKwd(sA.netSalesKwd, 'ar')} د.ك* | ${fmt0(sA.completedOrders, 'ar')} طلب`,
          `• المقارنة (ب — ${sB.titleAr}): *${fmtKwd(sB.netSalesKwd, 'ar')} د.ك* | ${fmt0(sB.completedOrders, 'ar')} طلب`,
          `• فرق المبيعات: *${fmtSignedKwd(comparison.kpis.netSales.deltaAbs, 'ar')} د.ك (${fmtSignedPct(comparison.kpis.netSales.deltaPct, 'ar')})*`,
        ]
      : [
          `📊 *Venture Foods Comparison (Odoo 17)*`,
          `Scope: ${comparison.scopeSummaryEn}`,
          `• Base A (${sA.titleEn}): *${fmtKwd(sA.netSalesKwd, 'en')} KWD* | ${fmt0(sA.completedOrders, 'en')} orders`,
          `• Compare B (${sB.titleEn}): *${fmtKwd(sB.netSalesKwd, 'en')} KWD* | ${fmt0(sB.completedOrders, 'en')} orders`,
          `• Net Variance: *${fmtSignedKwd(comparison.kpis.netSales.deltaAbs, 'en')} KWD (${fmtSignedPct(comparison.kpis.netSales.deltaPct, 'en')})*`,
        ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopiedReport(true)
      window.setTimeout(() => setCopiedReport(false), 2000)
    } catch {}
  }, [comparison, isAr])

  const seriesLabelA = isAr
    ? `أ: ${comparison.selectionA.shortLabelAr}`
    : `A: ${comparison.selectionA.shortLabelEn}`
  const seriesLabelB = isAr
    ? `ب: ${comparison.selectionB.shortLabelAr}`
    : `B: ${comparison.selectionB.shortLabelEn}`

  const comparisonBarData = useMemo<ComparisonBarDatum[]>(() => {
    const isOrders = chartMetric === 'orders'
    return comparison.chartBuckets.map((bkt) => {
      const pair = getBucketPair(bkt)
      const bucketLabel = isAr ? bkt.labelAr : bkt.labelEn
      const tooltipTitle =
        bkt.metaA === bkt.metaB
          ? `${bucketLabel} · ${bkt.metaA}`
          : isAr
            ? `${bucketLabel} (${bkt.metaA} مقابل ${bkt.metaB})`
            : `${bucketLabel} (${bkt.metaA} vs ${bkt.metaB})`
      const pctNum = isOrders
        ? pair.b > 0
          ? ((pair.a - pair.b) / pair.b) * 100
          : pair.a > 0
            ? 100
            : 0
        : bkt.deltaPct
      const pctFormatted = fmtSignedPct(pctNum, resolvedLocale)
      const valueFormatted = isOrders
        ? `${fmt0(pair.a, resolvedLocale)} ${pair.unitLabel}`
        : formatChartKwdTooltip(pair.a, resolvedLocale)
      const comparisonFormatted = isOrders
        ? `${fmt0(pair.b, resolvedLocale)} ${pair.unitLabel}`
        : formatChartKwdTooltip(pair.b, resolvedLocale)
      const diffFormatted = isOrders
        ? `${formatInt(pair.delta, { locale: resolvedLocale, signed: true })} ${pair.unitLabel}`
        : formatChartKwdTooltip(pair.delta, resolvedLocale, { signed: true })

      const lines: ChartTooltipLine[] = [
        {
          label: seriesLabelB,
          value: comparisonFormatted,
          tone: 'slate',
        },
        {
          label: seriesLabelA,
          value: valueFormatted,
          tone: 'blue',
          bold: true,
        },
        {
          label: isAr ? 'الفارق' : 'Variance',
          value: diffFormatted,
          tone: pair.delta > 0 ? 'emerald' : pair.delta < 0 ? 'rose' : 'neutral',
          bold: true,
        },
      ]

      return {
        id: bkt.id,
        label: bucketLabel,
        tooltipTitle,
        value: pair.a,
        comparisonValue: pair.b,
        valueFormatted,
        comparisonFormatted,
        diffFormatted,
        pctFormatted,
        higherIsBetter: true,
        badgeText: pctFormatted,
        badgeTone: pair.delta > 0 ? 'emerald' : pair.delta < 0 ? 'rose' : 'neutral',
        lines,
      }
    })
  }, [
    chartMetric,
    comparison.chartBuckets,
    getBucketPair,
    isAr,
    resolvedLocale,
    seriesLabelA,
    seriesLabelB,
  ])

  const cumulativeTimeline = useMemo(() => {
    const buildLines = (bkt: ComparisonChartBucket): ChartTooltipLine[] => {
      const cumDelta = bkt.cumulativeA - bkt.cumulativeB
      return [
        {
          label: seriesLabelA,
          value: formatChartKwdTooltip(bkt.cumulativeA, resolvedLocale),
          tone: 'blue',
          bold: true,
        },
        {
          label: seriesLabelB,
          value: formatChartKwdTooltip(bkt.cumulativeB, resolvedLocale),
          tone: 'slate',
        },
        {
          label: isAr ? 'الفرق التراكمي' : 'Cumulative Variance',
          value: formatChartKwdTooltip(cumDelta, resolvedLocale, { signed: true }),
          tone: cumDelta > 0 ? 'emerald' : cumDelta < 0 ? 'rose' : 'neutral',
          bold: true,
        },
      ]
    }

    if (comparison.chartKind === 'hourly-14') {
      const summaryTitle = isAr
        ? `${comparison.selectionA.shortLabelAr} مقابل ${comparison.selectionB.shortLabelAr}`
        : `${comparison.selectionA.shortLabelEn} vs ${comparison.selectionB.shortLabelEn}`
      const dailySeries: TimelineAreaDatum[] = [
        {
          day: summaryTitle,
          label: summaryTitle,
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
          : isAr
            ? `${bucketLabel} (${bkt.metaA} مقابل ${bkt.metaB})`
            : `${bucketLabel} (${bkt.metaA} vs ${bkt.metaB})`
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
    seriesLabelA,
    seriesLabelB,
  ])

  const showNoData =
    !loading && !apiError && (!apiConnected || apiNoData || !comparison.connected || comparison.noData)
  const dateRangeBadge = `${comparison.selectionA.fromIso}..${comparison.selectionA.toIso} vs ${comparison.selectionB.fromIso}..${comparison.selectionB.toIso}`
  const isOrdersMetric = chartMetric === 'orders'
  const chartHeadlineKpi = isOrdersMetric
    ? comparison.selectionA.completedOrders === null
      ? UNAVAILABLE_DASH
      : `${fmt0(comparison.selectionA.completedOrders, resolvedLocale)} ${isAr ? 'طلب' : 'orders'}`
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

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="mx-auto w-full max-w-[1920px] space-y-5 pb-12 font-sans text-[14px] text-neutral-900 antialiased sm:text-[15px] dark:text-slate-100"
    >
      {/* 1. Control Bar */}
      <ExecutiveComparisonControlBar
        query={query}
        onQueryChange={(next) => {
          userEditedDatesRef.current = true
          setQuery(next)
        }}
        onReset={() => {
          userEditedDatesRef.current = false
          hadInitialUrlDatesRef.current = false
          setQuery(buildDefaultStudioQuery())
        }}
        onExportCsv={handleExportCsv}
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
        extraActions={
          <button
            type="button"
            disabled={showNoData || loading}
            onClick={handleCopyReport}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200/85 bg-slate-50/90 px-3 text-[12.5px] font-semibold text-slate-700 transition-all duration-150 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800/80"
          >
            {copiedReport ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            <span>
              {copiedReport
                ? isAr
                  ? 'تم النسخ ✓'
                  : 'Copied ✓'
                : isAr
                  ? 'نسخ الملخص'
                  : 'Copy Summary'}
            </span>
          </button>
        }
      />

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
          {/* 2. Summary Callout Strip */}
          <section className="rounded-2xl border border-slate-200/85 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-semibold tracking-tight text-slate-900 tabular-nums dark:text-white">
                      {isAr ? comparison.insights.headlineAr : comparison.insights.headlineEn}
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
                        <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50/90 px-3 py-1.5 text-[12px] font-semibold text-emerald-900 ring-1 ring-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-200">
                          <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
                          <span>
                            {isAr ? `${topBadge.labelAr}:` : `${topBadge.labelEn}:`}{' '}
                            {isAr
                              ? comparison.insights.topGainer.nameAr
                              : comparison.insights.topGainer.nameEn}{' '}
                            <span dir="ltr" className="tabular-nums">
                              ({fmtSignedKwd(comparison.insights.topGainer.deltaKwd, resolvedLocale)} {kwd})
                            </span>
                          </span>
                        </div>
                      )
                    }
                    if (comparison.insights.topGainer.deltaKwd < 0) {
                      return (
                        <div className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-900/10 dark:bg-white/10 dark:text-slate-200">
                          <TrendingDown className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-300" aria-hidden />
                          <span>
                            {isAr ? `${topBadge.labelAr}:` : `${topBadge.labelEn}:`}{' '}
                            {isAr
                              ? comparison.insights.topGainer.nameAr
                              : comparison.insights.topGainer.nameEn}{' '}
                            <span dir="ltr" className="tabular-nums">
                              ({fmtSignedKwd(comparison.insights.topGainer.deltaKwd, resolvedLocale)} {kwd})
                            </span>
                          </span>
                        </div>
                      )
                    }
                    return null
                  })()}

                {comparison.insights.biggestDecline &&
                comparison.insights.biggestDecline.deltaKwd < 0 ? (
                  <div className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50/90 px-3 py-1.5 text-[12px] font-semibold text-rose-900 ring-1 ring-rose-600/15 dark:bg-rose-500/15 dark:text-rose-200">
                    <TrendingDown className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-300" aria-hidden />
                    <span>
                      {isAr ? 'أكبر تراجع:' : 'Biggest Decline:'}{' '}
                      {isAr
                        ? comparison.insights.biggestDecline.nameAr
                        : comparison.insights.biggestDecline.nameEn}{' '}
                      <span dir="ltr" className="tabular-nums">
                        ({fmtSignedKwd(comparison.insights.biggestDecline.deltaKwd, resolvedLocale)} {kwd})
                      </span>
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* 3. KPI Delta Cards */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {comparison.kpiList.map((kpi) => {
              const isGlKpi =
                kpi.id === 'foodAndAggregatorCost' ||
                kpi.id === 'netPocketCash' ||
                kpi.id === 'netPocketMargin'
              const isUnavailable =
                kpi.available === false || (isGlKpi && !comparison.accountingAvailable)
              const unavailableReason = isGlKpi
                ? isAr
                  ? comparison.accountingUnavailableReasonAr ?? 'قيود غير مكتملة لهذه الفترة'
                  : comparison.accountingUnavailableReasonEn ?? 'Incomplete GL entries for this period'
                : isAr
                  ? kpi.unavailableReasonAr ?? 'غير متاح'
                  : kpi.unavailableReasonEn ?? 'Unavailable'
              const badgeTone =
                kpi.trend === 'flat'
                  ? 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                  : kpi.isFavorable
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20 dark:bg-emerald-500/20 dark:text-emerald-200'
                    : 'bg-rose-50 text-rose-800 ring-1 ring-rose-600/20 dark:bg-rose-500/20 dark:text-rose-200'

              return (
                <div key={kpi.id} className={KPI_CLS}>
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="text-[12px] font-semibold leading-snug text-slate-600 sm:text-[12.5px] dark:text-slate-300">
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
                        <UnavailableState compact isAr={isAr} reason={unavailableReason} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div dir="ltr" className="mt-2 flex flex-wrap items-baseline gap-1.5 tabular-nums">
                        <span className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl dark:text-white">
                          {formatKpiPrimaryValue(kpi, resolvedLocale)}
                        </span>
                        {kpi.unit === 'KWD' && (
                          <span className="text-[13px] font-semibold text-slate-500">{kwd}</span>
                        )}
                        {kpi.unit === 'orders' && (
                          <span className="text-[13px] font-semibold text-slate-500">
                            {isAr ? 'طلب' : 'ord'}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-1.5 tabular-nums">
                        <span
                          dir="ltr"
                          className={`rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums ${badgeTone}`}
                        >
                          {formatKpiDeltaBadge(kpi)}
                        </span>
                        <span dir="ltr" className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                          {kpi.unit === 'pct'
                            ? `${kpi.deltaBps && kpi.deltaBps > 0 ? '+' : ''}${kpi.deltaBps ?? 0} bps`
                            : `${kpi.unit === 'orders' ? formatInt(kpi.deltaAbs, { locale: resolvedLocale, signed: true }) : fmtSignedKwd(kpi.deltaAbs, resolvedLocale)} ${
                                kpi.unit === 'KWD' ? kwd : ''
                              }`}
                        </span>
                      </div>

                      <p className="mt-2 border-t border-slate-100 pt-1.5 text-[13px] leading-snug text-slate-500 tabular-nums dark:border-white/[0.06] dark:text-slate-400">
                        {isAr ? 'مقارنة بـ:' : 'vs B:'}{' '}
                        <span dir="ltr" className="font-semibold text-slate-700 dark:text-slate-200">
                          {formatKpiSecondaryValue(kpi, resolvedLocale)}
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
                </div>
              )
            })}
          </section>

          {/* 4. Hourly / Daily Comparison Chart */}
          <section
            role="region"
            aria-label={
              comparison.chartKind === 'hourly-14'
                ? isAr
                  ? `المقارنة الساعية — ${dateRangeBadge}`
                  : `Hourly Comparison — ${dateRangeBadge}`
                : isAr
                  ? `المقارنة اليومية — ${dateRangeBadge}`
                  : `Daily Comparison — ${dateRangeBadge}`
            }
            className={`${CARD_CLS} min-h-[340px] w-full`}
          >
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight text-slate-950 sm:text-[17px] dark:text-white">
                  {comparison.chartKind === 'hourly-14'
                    ? isAr
                      ? `المقارنة الساعية: ${comparison.selectionA.shortLabelAr} مقابل ${comparison.selectionB.shortLabelAr}`
                      : `Hourly Comparison: ${comparison.selectionA.shortLabelEn} vs ${comparison.selectionB.shortLabelEn}`
                    : isAr
                      ? `المقارنة اليومية للفترة: ${comparison.selectionA.shortLabelAr} مقابل ${comparison.selectionB.shortLabelAr}`
                      : `Daily Range Comparison: ${comparison.selectionA.shortLabelEn} vs ${comparison.selectionB.shortLabelEn}`}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {dateRangeBadge} ·{' '}
                  {chartMetric === 'orders'
                    ? isAr
                      ? 'الطلبات (طلب)'
                      : 'Orders'
                    : isAr
                      ? 'د.ك (KWD)'
                      : 'KWD'}
                </p>
              </div>

              <div role="tablist" className={SEGMENT_TRACK_CLS}>
                {(
                  [
                    { id: 'sales', en: 'Sales KWD', ar: 'المبيعات د.ك' },
                    { id: 'orders', en: 'Orders', ar: 'الطلبات' },
                    { id: 'cumulative', en: 'Cumulative Curve', ar: 'المنحنى التراكمي' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={chartMetric === m.id}
                    onClick={() => setChartMetric(m.id)}
                    className={`${SEGMENT_BTN_CLS} focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                      chartMetric === m.id ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                    }`}
                  >
                    {isAr ? m.ar : m.en}
                  </button>
                ))}
              </div>
            </div>

            {peakBucket &&
              (() => {
                const pair = getBucketPair(peakBucket)
                const isOrders = chartMetric === 'orders'
                return (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-slate-50/75 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-sky-400/15 dark:bg-slate-900/40 dark:text-slate-200">
                    <div className="flex flex-wrap items-center gap-3 tabular-nums">
                      <span className="font-semibold text-blue-700 dark:text-sky-300">
                        {seriesLabelA}:{' '}
                        <span dir="ltr">
                          {isOrders
                            ? comparison.selectionA.completedOrders === null
                              ? UNAVAILABLE_DASH
                              : `${fmt0(comparison.selectionA.completedOrders, resolvedLocale)} ${pair.unitLabel}`
                            : formatChartKwdTooltip(comparison.selectionA.netSalesKwd, resolvedLocale)}
                        </span>
                      </span>
                      <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                        ·
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {seriesLabelB}:{' '}
                        <span dir="ltr">
                          {isOrders
                            ? comparison.selectionB.completedOrders === null
                              ? UNAVAILABLE_DASH
                              : `${fmt0(comparison.selectionB.completedOrders, resolvedLocale)} ${pair.unitLabel}`
                            : formatChartKwdTooltip(comparison.selectionB.netSalesKwd, resolvedLocale)}
                        </span>
                      </span>
                    </div>
                    <div className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-200/80 tabular-nums dark:bg-slate-900/70 dark:text-slate-100 dark:ring-sky-400/20">
                      <span className="text-blue-700 dark:text-sky-300">
                        {isAr ? `الذروة: ${peakBucket.labelAr}` : `Peak: ${peakBucket.labelEn}`}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                        |
                      </span>
                      <span dir="ltr">
                        A:{' '}
                        <strong>
                          {isOrders
                            ? `${fmt0(pair.a, resolvedLocale)} ${pair.unitLabel}`
                            : formatChartKwdTooltip(pair.a, resolvedLocale)}
                        </strong>
                      </span>
                      <span className="text-slate-400">vs</span>
                      <span dir="ltr">
                        B:{' '}
                        <strong>
                          {isOrders
                            ? `${fmt0(pair.b, resolvedLocale)} ${pair.unitLabel}`
                            : formatChartKwdTooltip(pair.b, resolvedLocale)}
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
                title={seriesLabelA}
                kpiValue={chartHeadlineKpi}
                deltaPct={chartHeadlineDeltaPct}
                deltaLabel={seriesLabelB}
                infoLabel={isAr ? 'تفاصيل ومنهجية المقارنة' : 'Comparison details & basis'}
                infoContent={chartInfoContent}
                valueLabel={seriesLabelA}
                secondaryLabel={seriesLabelB}
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
                    : `Cumulative Comparison Timeline — ${dateRangeBadge}`
                }
              />
            ) : (
              <ComparisonBarChart
                data={comparisonBarData}
                isAr={isAr}
                title={seriesLabelA}
                kpiValue={chartHeadlineKpi}
                deltaPct={chartHeadlineDeltaPct}
                deltaLabel={seriesLabelB}
                infoLabel={isAr ? 'تفاصيل ومنهجية المقارنة' : 'Comparison details & basis'}
                infoContent={chartInfoContent}
                primaryLabel={seriesLabelA}
                comparisonLabel={seriesLabelB}
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
                  comparison.chartKind === 'hourly-14'
                    ? isAr
                      ? `المقارنة الساعية — ${dateRangeBadge}`
                      : `Hourly Comparison — ${dateRangeBadge}`
                    : isAr
                      ? `المقارنة اليومية — ${dateRangeBadge}`
                      : `Daily Comparison — ${dateRangeBadge}`
                }
              />
            )}
          </section>

          {/* 5. Dimensional Breakdown Table (7 Branches + Unattributed | 6 Brands | Channels) */}
          <section className={CARD_CLS}>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight text-slate-950 sm:text-[17px] dark:text-white">
                  {isAr
                    ? 'جدول تفصيل الفروقات من Odoo 17 (الفروع السبعة + غير منسوب لفرع • العلامات • القنوات)'
                    : 'Odoo 17 Variance Breakdown (7 Branches + Unattributed • 6 Brands • Channels)'}
                </h2>
              </div>

              <div role="tablist" className={SEGMENT_TRACK_CLS}>
                {(
                  [
                    {
                      id: 'branch',
                      en: 'By Branch (7 + Unattributed)',
                      ar: 'حسب الفرع (7 + غير منسوب لفرع)',
                    },
                    { id: 'brand', en: 'By Brand (6)', ar: 'حسب المطعم (6)' },
                    { id: 'channel', en: 'By Channel', ar: 'حسب القناة' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={tableTab === tab.id}
                    onClick={() => setTableTab(tab.id)}
                    className={`${SEGMENT_BTN_CLS} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
                      tableTab === tab.id ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                    }`}
                  >
                    {isAr ? tab.ar : tab.en}
                  </button>
                ))}
              </div>
            </div>

            <div className={TABLE_SCROLL_CLS}>
              <table className="w-full min-w-[780px] border-collapse rounded-xl bg-white text-start text-[13.5px] dark:bg-slate-900/95">
                <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900">
                  <tr className="border-b border-slate-200/85 text-[12px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-2.5 ps-4 pe-3 text-start">
                      {tableTab === 'branch'
                        ? isAr
                          ? 'الفرع (7 فروع + غير منسوب لفرع)'
                          : 'Branch (7 + Unattributed)'
                        : tableTab === 'brand'
                          ? isAr
                            ? 'المطعم (6)'
                            : 'Brand (6)'
                          : isAr
                            ? 'القناة'
                            : 'Channel'}
                    </th>
                    <th className="px-3 py-2.5 text-start">
                      <button
                        type="button"
                        onClick={() => toggleSort('valueA')}
                        className="inline-flex cursor-pointer items-center gap-1 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:hover:text-sky-300"
                      >
                        <span>
                          {isAr
                            ? `أ (${comparison.selectionA.shortLabelAr})`
                            : `A (${comparison.selectionA.shortLabelEn})`}
                        </span>
                        <ArrowUpDown className="h-3 w-3" aria-hidden />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-start">
                      <button
                        type="button"
                        onClick={() => toggleSort('valueB')}
                        className="inline-flex cursor-pointer items-center gap-1 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:hover:text-sky-300"
                      >
                        <span>
                          {isAr
                            ? `ب (${comparison.selectionB.shortLabelAr})`
                            : `B (${comparison.selectionB.shortLabelEn})`}
                        </span>
                        <ArrowUpDown className="h-3 w-3" aria-hidden />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-start">
                      <button
                        type="button"
                        onClick={() => toggleSort('deltaKwd')}
                        className="inline-flex cursor-pointer items-center gap-1 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:hover:text-sky-300"
                      >
                        <span>{isAr ? `الفارق (${kwd})` : `Variance (${kwd})`}</span>
                        <ArrowUpDown className="h-3 w-3" aria-hidden />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-start">
                      <button
                        type="button"
                        onClick={() => toggleSort('deltaPct')}
                        className="inline-flex cursor-pointer items-center gap-1 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:hover:text-sky-300"
                      >
                        <span>{isAr ? 'التغير %' : 'Delta %'}</span>
                        <ArrowUpDown className="h-3 w-3" aria-hidden />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-start">
                      <button
                        type="button"
                        onClick={() => toggleSort('ordersA')}
                        className="inline-flex cursor-pointer items-center gap-1 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:hover:text-sky-300"
                      >
                        <span>{isAr ? 'الطلبات (أ / ب)' : 'Orders (A / B)'}</span>
                        <ArrowUpDown className="h-3 w-3" aria-hidden />
                      </button>
                    </th>
                    <th className="py-2.5 ps-3 pe-4 text-end">
                      {isAr ? 'متوسط الفاتورة (أ / ب)' : 'AOV (A / B)'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 tabular-nums dark:divide-slate-800/80">
                  {activeEntityRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`transition hover:bg-slate-50/90 dark:hover:bg-slate-800/40 ${
                        row.isUnattributed
                          ? 'bg-slate-50/85 dark:bg-slate-800/35'
                          : !row.isCompatible
                            ? 'opacity-45'
                            : ''
                      }`}
                    >
                      <td className="py-3 ps-4 pe-3">
                        <div className="font-semibold text-slate-950 dark:text-white">
                          {isAr ? row.nameAr : row.nameEn}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {isAr ? row.subMetaAr : row.subMetaEn} •{' '}
                          <span dir="ltr" className="tabular-nums">
                            {formatPct(row.shareOfTotalAPct, { locale: resolvedLocale })}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">
                        <span dir="ltr" className="tabular-nums">
                          {fmtKwd(row.valueA, resolvedLocale)} {kwd}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-600 dark:text-slate-300">
                        <span dir="ltr" className="tabular-nums">
                          {fmtKwd(row.valueB, resolvedLocale)} {kwd}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-3 font-semibold ${
                          row.deltaKwd >= 0
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        <span dir="ltr" className="tabular-nums">
                          {fmtSignedKwd(row.deltaKwd, resolvedLocale)} {kwd}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          dir="ltr"
                          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold tabular-nums ${tierBadgeCls(row.tier)}`}
                        >
                          <span className={`h-2 w-2 shrink-0 rounded-full ${tierDotCls(row.tier)}`} aria-hidden />
                          <span>{fmtSignedPct(row.deltaPct, resolvedLocale)}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                        <span dir="ltr" className="tabular-nums">
                          {fmt0(row.ordersA, resolvedLocale)}{' '}
                          <span className="text-[13px] text-slate-400">
                            / {fmt0(row.ordersB, resolvedLocale)}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 ps-3 pe-4 text-end font-mono text-xs text-slate-600 dark:text-slate-300">
                        <span dir="ltr" className="tabular-nums">
                          {fmtKwd(row.aovA, resolvedLocale)} / {fmtKwd(row.aovB, resolvedLocale)}{' '}
                          {kwd}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-semibold text-slate-950 tabular-nums dark:border-slate-800 dark:bg-slate-900/95 dark:text-white">
                    <td className="py-3 ps-4 pe-3">
                      {isAr ? 'الإجمالي الفعلي (Odoo 17)' : 'Total (Odoo 17)'}
                    </td>
                    <td className="px-3 py-3">
                      <span dir="ltr" className="tabular-nums">
                        {fmtKwd(comparison.selectionA.netSalesKwd, resolvedLocale)} {kwd}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span dir="ltr" className="tabular-nums">
                        {fmtKwd(comparison.selectionB.netSalesKwd, resolvedLocale)} {kwd}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-3 ${
                        comparison.kpis.netSales.deltaAbs >= 0
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      <span dir="ltr" className="tabular-nums">
                        {fmtSignedKwd(comparison.kpis.netSales.deltaAbs, resolvedLocale)} {kwd}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span dir="ltr" className="tabular-nums">
                        {fmtSignedPct(comparison.kpis.netSales.deltaPct, resolvedLocale)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span dir="ltr" className="tabular-nums">
                        {fmt0(comparison.selectionA.completedOrders, resolvedLocale)} /{' '}
                        {fmt0(comparison.selectionB.completedOrders, resolvedLocale)}
                      </span>
                    </td>
                    <td className="py-3 ps-3 pe-4 text-end font-mono text-xs">
                      <span dir="ltr" className="tabular-nums">
                        {fmtKwd(comparison.selectionA.aovKwd, resolvedLocale)} /{' '}
                        {fmtKwd(comparison.selectionB.aovKwd, resolvedLocale)} {kwd}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
