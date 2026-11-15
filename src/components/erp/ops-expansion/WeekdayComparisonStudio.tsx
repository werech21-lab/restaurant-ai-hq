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
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { formatSignedDelta } from '@/lib/aether/global-filter-engine'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
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
  'ae-bento-card rounded-2xl bg-white p-3.5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const KPI_CLS =
  'ae-kpi-card rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] transition-all duration-150 dark:bg-[#101C17] dark:ring-emerald-500/10'
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

const fmt0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')
const fmtKwd = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
  })
const fmt2 = (n: number) => (Number.isFinite(n) ? n : 0).toFixed(2)
const fmtSignedKwd = (n: number) => {
  const v = Number.isFinite(n) ? n : 0
  return `${v > 0 ? '+' : ''}${fmtKwd(v)}`
}
const fmtSignedPct = (n: number) => {
  const v = Number.isFinite(n) ? n : 0
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}
const fmtSignedPp = (n: number) => {
  const v = Number.isFinite(n) ? n : 0
  return `${v > 0 ? '+' : ''}${v.toFixed(1)} pp`
}

function tierBadgeCls(tier: 'green' | 'yellow' | 'red'): string {
  if (tier === 'green') {
    return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-200'
  }
  if (tier === 'yellow') {
    return 'bg-amber-50 text-amber-900 ring-1 ring-amber-500/25 dark:bg-amber-500/15 dark:text-amber-200'
  }
  return 'bg-rose-50 text-rose-800 ring-1 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-200'
}

function tierDot(tier: 'green' | 'yellow' | 'red'): string {
  if (tier === 'green') return '🟢'
  if (tier === 'yellow') return '🟡'
  return '🔴'
}

function formatKpiPrimaryValue(kpi: ExecutiveKpiDelta): string {
  if (kpi.unit === 'orders') return fmt0(kpi.valueA)
  if (kpi.unit === 'pct') return `${kpi.valueA.toFixed(1)}%`
  return kpi.id === 'averageCheck' ? fmt2(kpi.valueA) : fmtKwd(kpi.valueA)
}

function formatKpiSecondaryValue(kpi: ExecutiveKpiDelta): string {
  if (kpi.unit === 'orders') return fmt0(kpi.valueB)
  if (kpi.unit === 'pct') return `${kpi.valueB.toFixed(1)}%`
  return kpi.id === 'averageCheck' ? fmt2(kpi.valueB) : fmtKwd(kpi.valueB)
}

function formatKpiDeltaBadge(kpi: ExecutiveKpiDelta): string {
  const signed = formatSignedDelta(kpi.deltaPct)
  if (kpi.unit === 'pct') {
    return `${signed.arrow} ${fmtSignedPp(signed.pct)}`
  }
  return signed.text
}

export function WeekdayComparisonStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
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
  const [apiConnected, setApiConnected] = useState<boolean>(false)
  const [apiNoData, setApiNoData] = useState<boolean>(false)
  const [apiLastSyncAt, setApiLastSyncAt] = useState<string | null>(null)
  const [apiIsStale24h, setApiIsStale24h] = useState<boolean>(false)

  const [chartMetric, setChartMetric] = useState<ChartMetricKey>('sales')
  const [selectedBucketIdx, setSelectedBucketIdx] = useState<number | null>(null)
  const [tableTab, setTableTab] = useState<BreakdownDimension>('branch')
  const [sortCol, setSortCol] = useState<SortColumnKey>('valueA')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [copiedReport, setCopiedReport] = useState(false)

  // Always fetch real period cubes from `/api/erp/live-comparison`
  useEffect(() => {
    let active = true
    setLoading(true)
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
    })
      .then((res) => (res.ok ? res.json() : null))
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
      .catch(() => {
        if (!active) return
        setApiConnected(false)
        setApiNoData(true)
        setCubeA(null)
        setCubeB(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [
    query.periodA.from,
    query.periodA.to,
    query.periodB.from,
    query.periodB.to,
    query.mode,
    query.granularity,
    query.sameHoursLikeForLike,
  ])

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

  const maxBucketVal = useMemo(() => {
    let m = 1
    for (const bkt of comparison.chartBuckets) {
      const pair = getBucketPair(bkt)
      if (Math.abs(pair.a) > m) m = Math.abs(pair.a)
      if (Math.abs(pair.b) > m) m = Math.abs(pair.b)
    }
    return m
  }, [comparison.chartBuckets, getBucketPair])

  const inspectedBucket = useMemo(() => {
    if (comparison.chartBuckets.length === 0) return null
    if (selectedBucketIdx !== null && comparison.chartBuckets[selectedBucketIdx]) {
      return comparison.chartBuckets[selectedBucketIdx]
    }
    let best = comparison.chartBuckets[0]
    for (const b of comparison.chartBuckets) {
      if (getBucketPair(b).a > getBucketPair(best).a) best = b
    }
    return best
  }, [comparison.chartBuckets, getBucketPair, selectedBucketIdx])

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
          `• الأساس (أ — ${sA.titleAr}): *${fmtKwd(sA.netSalesKwd)} د.ك* | ${fmt0(sA.completedOrders)} طلب`,
          `• المقارنة (ب — ${sB.titleAr}): *${fmtKwd(sB.netSalesKwd)} د.ك* | ${fmt0(sB.completedOrders)} طلب`,
          `• فرق المبيعات: *${fmtSignedKwd(comparison.kpis.netSales.deltaAbs)} د.ك (${fmtSignedPct(comparison.kpis.netSales.deltaPct)})*`,
        ]
      : [
          `📊 *Venture Foods Comparison (Odoo 17)*`,
          `Scope: ${comparison.scopeSummaryEn}`,
          `• Base A (${sA.titleEn}): *${fmtKwd(sA.netSalesKwd)} KWD* | ${fmt0(sA.completedOrders)} orders`,
          `• Compare B (${sB.titleEn}): *${fmtKwd(sB.netSalesKwd)} KWD* | ${fmt0(sB.completedOrders)} orders`,
          `• Net Variance: *${fmtSignedKwd(comparison.kpis.netSales.deltaAbs)} KWD (${fmtSignedPct(comparison.kpis.netSales.deltaPct)})*`,
        ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopiedReport(true)
      window.setTimeout(() => setCopiedReport(false), 2000)
    } catch {}
  }, [comparison, isAr])

  const cumulativeSvg = useMemo(() => {
    const bkts = comparison.chartBuckets
    if (bkts.length < 2) return null
    const maxCum = Math.max(1, ...bkts.map((b) => Math.max(b.cumulativeA, b.cumulativeB)))
    const w = 1000
    const h = 150
    const padX = 24
    const padY = 16
    const toPt = (idx: number, val: number) => {
      const x = padX + (idx / (bkts.length - 1)) * (w - padX * 2)
      const y = h - padY - (val / maxCum) * (h - padY * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }
    const ptsA = bkts.map((b, i) => toPt(i, b.cumulativeA)).join(' ')
    const ptsB = bkts.map((b, i) => toPt(i, b.cumulativeB)).join(' ')
    return { w, h, ptsA, ptsB }
  }, [comparison.chartBuckets])

  const showNoData = !loading && (!apiConnected || apiNoData || !comparison.connected || comparison.noData)
  const dateRangeBadge = `${comparison.selectionA.fromIso}..${comparison.selectionA.toIso} vs ${comparison.selectionB.fromIso}..${comparison.selectionB.toIso}`

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
        extraActions={
          <button
            type="button"
            disabled={showNoData || loading}
            onClick={handleCopyReport}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#F6F7F8] px-3 text-[12.5px] font-semibold text-slate-700 ring-1 ring-slate-900/[0.06] transition-all duration-150 hover:bg-slate-200/70 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#0B1410] dark:text-slate-200 dark:ring-emerald-500/15"
          >
            {copiedReport ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5 shrink-0" />
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

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-[#101C17] dark:text-slate-300">
          {isAr
            ? 'جاري جلب مكعبات المقارنة الفعلية من Odoo 17...'
            : 'Fetching period cubes from Odoo 17...'}
        </div>
      ) : null}

      {showNoData ? (
        <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-8 text-center dark:border-amber-500/30 dark:bg-amber-950/25">
          <div className="text-base font-bold text-amber-950 dark:text-amber-200">
            {isAr
              ? 'لا توجد بيانات من Odoo لهذه الفترة'
              : 'No data from Odoo for this period'}
          </div>
          <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-300/90">
            {isAr
              ? 'لم تُسجَّل حركات نقاط بيع في Odoo للتواريخ المختارة أو أن الاتصال بـ Odoo منقطع حالياً.'
              : 'No POS records exist in Odoo for the selected dates or Odoo is currently disconnected.'}
          </p>
        </div>
      ) : null}

      {!loading && !showNoData ? (
        <>
          {/* 2. Summary Callout Strip */}
          <section className="rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-slate-900/[0.05] dark:bg-[#101C17] dark:ring-emerald-500/12">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Sparkles className="h-4 w-4" />
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
                {comparison.insights.topGainer && comparison.insights.topGainer.deltaKwd > 0 ? (
                  <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50/90 px-3 py-1.5 text-[12px] font-semibold text-emerald-900 ring-1 ring-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-200">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                    <span>
                      {isAr ? 'أكبر ارتفاع:' : 'Top Lift:'}{' '}
                      {isAr
                        ? comparison.insights.topGainer.nameAr
                        : comparison.insights.topGainer.nameEn}{' '}
                      ({fmtSignedKwd(comparison.insights.topGainer.deltaKwd)} {kwd})
                    </span>
                  </div>
                ) : null}

                {comparison.insights.biggestDecline &&
                comparison.insights.biggestDecline.deltaKwd < 0 ? (
                  <div className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50/90 px-3 py-1.5 text-[12px] font-semibold text-rose-900 ring-1 ring-rose-600/15 dark:bg-rose-500/15 dark:text-rose-200">
                    <TrendingDown className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-300" />
                    <span>
                      {isAr ? 'أكبر تراجع:' : 'Biggest Decline:'}{' '}
                      {isAr
                        ? comparison.insights.biggestDecline.nameAr
                        : comparison.insights.biggestDecline.nameEn}{' '}
                      ({fmtSignedKwd(comparison.insights.biggestDecline.deltaKwd)} {kwd})
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
              const isUnavailable = isGlKpi && (!comparison.accountingAvailable || kpi.available === false)
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
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    )}
                  </div>

                  {isUnavailable ? (
                    <>
                      <div className="mt-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                        {isAr ? 'قيود غير مكتملة لهذه الفترة' : 'Incomplete GL entries for this period'}
                      </div>
                      <p className="mt-2 border-t border-slate-100 pt-1.5 text-xs leading-snug text-slate-500 dark:border-white/[0.06] dark:text-slate-400">
                        {isAr
                          ? comparison.accountingUnavailableReasonAr ?? 'قيود غير مكتملة لهذه الفترة'
                          : comparison.accountingUnavailableReasonEn ?? 'Incomplete GL entries'}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="mt-2 flex flex-wrap items-baseline gap-1.5 tabular-nums">
                        <span className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl dark:text-white">
                          {formatKpiPrimaryValue(kpi)}
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
                        <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${badgeTone}`}>
                          {formatKpiDeltaBadge(kpi)}
                        </span>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {kpi.unit === 'pct'
                            ? `${kpi.deltaBps && kpi.deltaBps > 0 ? '+' : ''}${kpi.deltaBps ?? 0} bps`
                            : `${kpi.unit === 'orders' ? fmt0(kpi.deltaAbs) : fmtSignedKwd(kpi.deltaAbs)} ${
                                kpi.unit === 'KWD' ? kwd : ''
                              }`}
                        </span>
                      </div>

                      <p className="mt-2 border-t border-slate-100 pt-1.5 text-[13px] leading-snug text-slate-500 tabular-nums dark:border-white/[0.06] dark:text-slate-400">
                        {isAr ? 'مقارنة بـ:' : 'vs B:'}{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {formatKpiSecondaryValue(kpi)}
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
          <section className={`${CARD_CLS} min-h-[340px] w-full`}>
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
                    className={`${SEGMENT_BTN_CLS} ${
                      chartMetric === m.id ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                    }`}
                  >
                    {isAr ? m.ar : m.en}
                  </button>
                ))}
              </div>
            </div>

            <div className={`p-4 ${SUBCARD_CLS}`}>
              <div className="mb-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-4 text-[12.5px] font-semibold">
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    {isAr
                      ? `أ: ${comparison.selectionA.shortLabelAr} (${fmtKwd(comparison.selectionA.netSalesKwd)} ${kwd})`
                      : `A: ${comparison.selectionA.shortLabelEn} (${fmtKwd(comparison.selectionA.netSalesKwd)} ${kwd})`}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                    {isAr
                      ? `ب: ${comparison.selectionB.shortLabelAr} (${fmtKwd(comparison.selectionB.netSalesKwd)} ${kwd})`
                      : `B: ${comparison.selectionB.shortLabelEn} (${fmtKwd(comparison.selectionB.netSalesKwd)} ${kwd})`}
                  </span>
                </div>

                {inspectedBucket &&
                  (() => {
                    const pair = getBucketPair(inspectedBucket)
                    const isOrders = chartMetric === 'orders'
                    return (
                      <div className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-slate-900/[0.05] tabular-nums dark:bg-[#101C17] dark:text-slate-100 dark:ring-emerald-500/20">
                        <span className="text-emerald-700 dark:text-emerald-300">
                          {isAr ? inspectedBucket.labelAr : inspectedBucket.labelEn}
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span>
                          A: <strong>{isOrders ? fmt0(pair.a) : fmtKwd(pair.a)}</strong> {pair.unitLabel}
                        </span>
                        <span className="text-slate-400">vs</span>
                        <span>
                          B: <strong>{isOrders ? fmt0(pair.b) : fmtKwd(pair.b)}</strong> {pair.unitLabel}
                        </span>
                      </div>
                    )
                  })()}
              </div>

              {chartMetric === 'cumulative' && cumulativeSvg && (
                <div className="mb-4 rounded-xl bg-white/80 p-3 ring-1 ring-slate-900/[0.04] dark:bg-[#101C17]/70 dark:ring-white/[0.06]">
                  <svg
                    viewBox={`0 0 ${cumulativeSvg.w} ${cumulativeSvg.h}`}
                    className="h-[150px] w-full overflow-visible"
                    role="img"
                    aria-label="Cumulative sales comparison curve"
                  >
                    <polyline
                      fill="none"
                      stroke="#94A3B8"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                      points={cumulativeSvg.ptsB}
                    />
                    <polyline
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="3.2"
                      points={cumulativeSvg.ptsA}
                    />
                  </svg>
                </div>
              )}

              <div dir="ltr" className="overflow-x-auto pb-1">
                <div
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, comparison.chartBuckets.length)}, minmax(52px, 1fr))`,
                  }}
                  className="grid min-w-full items-end gap-2"
                >
                  {comparison.chartBuckets.map((bkt, idx) => {
                    const pair = getBucketPair(bkt)
                    const hA = Math.max(6, Math.round((Math.max(0, pair.a) / maxBucketVal) * 148))
                    const hB = Math.max(6, Math.round((Math.max(0, pair.b) / maxBucketVal) * 148))
                    const isSelected = inspectedBucket?.id === bkt.id
                    return (
                      <button
                        key={bkt.id}
                        type="button"
                        onMouseEnter={() => setSelectedBucketIdx(idx)}
                        onClick={() => setSelectedBucketIdx(idx)}
                        className={`group flex cursor-pointer flex-col items-center rounded-xl px-1.5 py-2 transition-all duration-150 ${
                          isSelected
                            ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-emerald-500/35 dark:bg-[#101C17]'
                            : 'hover:bg-white/60 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <span className="mb-1 text-xs font-semibold tracking-tight text-slate-600 tabular-nums dark:text-slate-300">
                          {chartMetric === 'orders' ? fmt0(pair.a) : fmtKwd(pair.a)}
                        </span>
                        <div className="flex h-[156px] w-full items-end justify-center gap-1 rounded-lg bg-slate-200/45 px-1 py-1 dark:bg-white/[0.03]">
                          <div
                            style={{ height: `${hA}px` }}
                            className="w-2.5 rounded-t-md bg-emerald-500 transition-all duration-150 sm:w-3"
                            title={`${bkt.metaA}: ${fmtKwd(pair.a)} ${pair.unitLabel}`}
                          />
                          <div
                            style={{ height: `${hB}px` }}
                            className="w-2.5 rounded-t-md bg-slate-300 transition-all duration-150 sm:w-3 dark:bg-slate-600"
                            title={`${bkt.metaB}: ${fmtKwd(pair.b)} ${pair.unitLabel}`}
                          />
                        </div>
                        <span className="mt-1.5 text-xs font-semibold text-slate-700 tabular-nums dark:text-slate-200">
                          {isAr ? bkt.labelAr : bkt.labelEn}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
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
                    className={`${SEGMENT_BTN_CLS} ${
                      tableTab === tab.id ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                    }`}
                  >
                    {isAr ? tab.ar : tab.en}
                  </button>
                ))}
              </div>
            </div>

            <div className={TABLE_SCROLL_CLS}>
              <table className="w-full min-w-[780px] border-collapse text-start text-[13.5px]">
                <thead>
                  <tr className="border-b border-slate-200/80 text-[12px] font-semibold text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
                    <th className="py-2.5 pe-3 text-start">
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
                        className="inline-flex cursor-pointer items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-300"
                      >
                        <span>
                          {isAr
                            ? `أ (${comparison.selectionA.shortLabelAr})`
                            : `A (${comparison.selectionA.shortLabelEn})`}
                        </span>
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-start">
                      <button
                        type="button"
                        onClick={() => toggleSort('valueB')}
                        className="inline-flex cursor-pointer items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-300"
                      >
                        <span>
                          {isAr
                            ? `ب (${comparison.selectionB.shortLabelAr})`
                            : `B (${comparison.selectionB.shortLabelEn})`}
                        </span>
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-start">
                      <button
                        type="button"
                        onClick={() => toggleSort('deltaKwd')}
                        className="inline-flex cursor-pointer items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-300"
                      >
                        <span>{isAr ? `الفارق (${kwd})` : `Variance (${kwd})`}</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-start">
                      <button
                        type="button"
                        onClick={() => toggleSort('deltaPct')}
                        className="inline-flex cursor-pointer items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-300"
                      >
                        <span>{isAr ? 'التغير %' : 'Delta %'}</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-start">
                      <button
                        type="button"
                        onClick={() => toggleSort('ordersA')}
                        className="inline-flex cursor-pointer items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-300"
                      >
                        <span>{isAr ? 'الطلبات (أ / ب)' : 'Orders (A / B)'}</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="py-2.5 ps-3 text-end">
                      {isAr ? 'متوسط الفاتورة (أ / ب)' : 'AOV (A / B)'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 tabular-nums dark:divide-white/[0.06]">
                  {activeEntityRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`transition hover:bg-slate-50/90 dark:hover:bg-white/[0.03] ${
                        row.isUnattributed
                          ? 'bg-amber-50/60 dark:bg-amber-950/20'
                          : !row.isCompatible
                            ? 'opacity-45'
                            : ''
                      }`}
                    >
                      <td className="py-3 pe-3">
                        <div className="font-semibold text-slate-950 dark:text-white">
                          {isAr ? row.nameAr : row.nameEn}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {isAr ? row.subMetaAr : row.subMetaEn} • {row.shareOfTotalAPct.toFixed(1)}%
                        </div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">
                        {fmtKwd(row.valueA)} {kwd}
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-600 dark:text-slate-300">
                        {fmtKwd(row.valueB)} {kwd}
                      </td>
                      <td
                        className={`px-3 py-3 font-semibold ${
                          row.deltaKwd >= 0
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {fmtSignedKwd(row.deltaKwd)} {kwd}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${tierBadgeCls(row.tier)}`}
                        >
                          {tierDot(row.tier)} {fmtSignedPct(row.deltaPct)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                        {fmt0(row.ordersA)}{' '}
                        <span className="text-[13px] text-slate-400">/ {fmt0(row.ordersB)}</span>
                      </td>
                      <td className="py-3 ps-3 text-end font-mono text-xs text-slate-600 dark:text-slate-300">
                        {fmt2(row.aovA)} / {fmt2(row.aovB)} {kwd}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-[#F7F8F9] font-semibold text-slate-950 tabular-nums dark:border-white/10 dark:bg-[#0B1410] dark:text-white">
                    <td className="py-3 pe-3">
                      {isAr ? 'الإجمالي الفعلي (Odoo 17)' : 'Total (Odoo 17)'}
                    </td>
                    <td className="px-3 py-3">
                      {fmtKwd(comparison.selectionA.netSalesKwd)} {kwd}
                    </td>
                    <td className="px-3 py-3">
                      {fmtKwd(comparison.selectionB.netSalesKwd)} {kwd}
                    </td>
                    <td
                      className={`px-3 py-3 ${
                        comparison.kpis.netSales.deltaAbs >= 0
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {fmtSignedKwd(comparison.kpis.netSales.deltaAbs)} {kwd}
                    </td>
                    <td className="px-3 py-3">{fmtSignedPct(comparison.kpis.netSales.deltaPct)}</td>
                    <td className="px-3 py-3">
                      {fmt0(comparison.selectionA.completedOrders)} /{' '}
                      {fmt0(comparison.selectionB.completedOrders)}
                    </td>
                    <td className="py-3 ps-3 text-end font-mono text-xs">
                      {fmt2(comparison.selectionA.aovKwd)} / {fmt2(comparison.selectionB.aovKwd)} {kwd}
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
