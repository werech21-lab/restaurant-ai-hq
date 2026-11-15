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
      className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar rounded-2xl bg-neutral-100/90 p-1 ring-1 ring-slate-900/[0.04] select-none dark:bg-white/[0.06] dark:ring-emerald-500/10"
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
            className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 focus:outline-none ${
              active
                ? 'btn-colored bg-emerald-600 font-semibold text-white shadow-sm dark:bg-emerald-500 dark:text-[#04130D]'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
            }`}
          >
            <span>{opt.label}</span>
            {opt.badge !== undefined ? (
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs font-extrabold tabular-nums ${
                  active
                    ? 'bg-white/20 text-white dark:bg-[#04130D]/20 dark:text-[#04130D]'
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
const fKwdNum = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
  })

const fmtKwd = (n: number, isAr: boolean) =>
  isAr ? `${fKwdNum(n)} د.ك` : `${fKwdNum(n)} KWD`

const fmtSignedKwd = (n: number, isAr: boolean) => {
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return `${sign}${fmtKwd(Math.abs(n), isAr)}`
}

const fmtSignedPct = (pct: number) => `${pct > 0 ? '+' : ''}${f1(pct)}%`
const fmtSignedPp = (pp: number) => `${pp > 0 ? '+' : ''}${f1(pp)} pp`

type TableScopeTab = 'all' | 'brands' | 'branches' | 'channels'
type ChartMetricKey = 'sales' | 'orders' | 'cumulative'

function formatKpiVal(kpi: ExecutiveKpiDelta, slot: 'after' | 'before'): string {
  const v = slot === 'after' ? kpi.valueA : kpi.valueB
  if (kpi.unit === 'orders') return f0(v)
  if (kpi.unit === 'pct') return `${f1(v)}%`
  return kpi.id === 'averageCheck' ? f2(v) : fKwdNum(v)
}

export function BeforeAfterStudio() {
  const { isAr, T } = useLang()
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
  const [apiConnected, setApiConnected] = useState<boolean>(false)
  const [apiNoData, setApiNoData] = useState<boolean>(false)
  const [apiLastSyncAt, setApiLastSyncAt] = useState<string | null>(null)
  const [apiIsStale24h, setApiIsStale24h] = useState<boolean>(false)

  const [chartMetric, setChartMetric] = useState<ChartMetricKey>('sales')
  const [selectedBucketIdx, setSelectedBucketIdx] = useState<number | null>(null)
  const [tableTab, setTableTab] = useState<TableScopeTab>('all')

  // Fetch directly from `/api/erp/live-comparison` (`cubeA`, `cubeB`)
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

  const maxBucketVal = useMemo(() => {
    let m = 1
    for (const bkt of comparison.chartBuckets) {
      const p = getBucketPair(bkt)
      if (Math.abs(p.after) > m) m = Math.abs(p.after)
      if (Math.abs(p.before) > m) m = Math.abs(p.before)
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
      if (getBucketPair(b).after > getBucketPair(best).after) best = b
    }
    return best
  }, [comparison.chartBuckets, getBucketPair, selectedBucketIdx])

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

  const showNoData = !loading && (!apiConnected || apiNoData || !comparison.connected || comparison.noData)
  const dateRangeBadge = `${comparison.selectionB.fromIso}..${comparison.selectionB.toIso} → ${comparison.selectionA.fromIso}..${comparison.selectionA.toIso}`

  const renderSectionTable = (
    key: string,
    titleAr: string,
    titleEn: string,
    rows: EntityVarianceRow[],
  ) => {
    const mapped = rows.filter((r) => !r.isUnattributed)
    const unattr = rows.filter((r) => r.isUnattributed)
    const orderedRows = [...mapped, ...unattr]

    return (
      <div key={key} className="space-y-2.5">
        <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">
          {isAr ? titleAr : titleEn}
        </h3>
        <div className="overflow-x-auto rounded-2xl bg-[#F7F7F8] p-1 dark:bg-[#09110E]">
          <table className="w-full min-w-[760px] border-collapse rounded-xl bg-white text-[13.5px] dark:bg-[#101C17]">
            <thead className="bg-[#F7F7F8] text-xs font-semibold text-slate-600 dark:bg-[#09110E] dark:text-slate-300">
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
                      ? 'bg-amber-50/60 dark:bg-amber-950/20'
                      : !r.isCompatible
                        ? 'opacity-45'
                        : ''
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
                    {fmtKwd(r.valueB, isAr)}
                  </td>
                  <td className="px-3 py-3 text-end font-mono font-semibold text-slate-900 dark:text-white">
                    {fmtKwd(r.valueA, isAr)}
                  </td>
                  <td
                    className={`px-3 py-3 text-end font-mono font-semibold ${
                      r.deltaKwd >= 0
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {fmtSignedKwd(r.deltaKwd, isAr)}
                  </td>
                  <td className="px-3 py-3 text-end font-mono">{fmtSignedPct(r.deltaPct)}</td>
                  <td className="px-4 py-3 text-end font-mono text-slate-700 dark:text-slate-300">
                    {f0(r.ordersB)} → {f0(r.ordersA)}
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
              className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#F6F7F8] px-3 text-[12.5px] font-semibold text-slate-700 ring-1 ring-slate-900/[0.06] transition-all duration-150 hover:bg-slate-200/70 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#0B1410] dark:text-slate-200 dark:ring-emerald-500/15"
            >
              <Printer className="h-3.5 w-3.5 shrink-0" />
              <span>{T('Print', 'طباعة')}</span>
            </button>
          }
        />
      </div>

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
          {/* 1B. Summary Strip */}
          <section className="rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-slate-900/[0.05] dark:bg-[#101C17] dark:ring-emerald-500/12">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-semibold tracking-tight text-slate-900 tabular-nums dark:text-white">
                      {isAr
                        ? `قبل (${comparison.selectionB.shortLabelAr}) ← بعد (${comparison.selectionA.shortLabelAr}): ${fmtSignedKwd(comparison.kpis.netSales.deltaAbs, true)} (${fmtSignedPct(comparison.kpis.netSales.deltaPct)})`
                        : `Before (${comparison.selectionB.shortLabelEn}) → After (${comparison.selectionA.shortLabelEn}): ${fmtSignedKwd(comparison.kpis.netSales.deltaAbs, false)} (${fmtSignedPct(comparison.kpis.netSales.deltaPct)})`}
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
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                          {isAr ? `${topBadge.labelAr}:` : `${topBadge.labelEn}:`}{' '}
                          {isAr
                            ? comparison.insights.topGainer.nameAr
                            : comparison.insights.topGainer.nameEn}{' '}
                          ({fmtSignedKwd(comparison.insights.topGainer.deltaKwd, isAr)})
                        </span>
                      )
                    }
                    return null
                  })()}
                {comparison.insights.biggestDecline &&
                  comparison.insights.biggestDecline.deltaKwd < 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50/90 px-3 py-1 text-[12px] font-semibold text-rose-900 ring-1 ring-rose-600/15 dark:bg-rose-500/15 dark:text-rose-200">
                      <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                      {isAr ? 'أكبر تراجع:' : 'Biggest Drop:'}{' '}
                      {isAr
                        ? comparison.insights.biggestDecline.nameAr
                        : comparison.insights.biggestDecline.nameEn}{' '}
                      ({fmtSignedKwd(comparison.insights.biggestDecline.deltaKwd, isAr)})
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
              const isUnavailable =
                isGlKpi && (!comparison.accountingAvailable || kpi.available === false)
              const signed = formatSignedDelta(kpi.deltaPct)
              const badgeTone =
                kpi.trend === 'flat' || signed.sign === 'flat'
                  ? 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                  : kpi.isFavorable
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20 dark:bg-emerald-500/20 dark:text-emerald-200'
                    : 'bg-rose-50 text-rose-800 ring-1 ring-rose-600/20 dark:bg-rose-500/20 dark:text-rose-200'

              return (
                <article
                  key={kpi.id}
                  className="ae-kpi-card rounded-2xl bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] sm:p-5 dark:bg-[#101C17] dark:ring-emerald-500/10"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="text-[12px] font-semibold text-neutral-500 sm:text-[12.5px] dark:text-slate-300">
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
                        {isAr ? 'قيود غير مكتملة لهذه الفترة' : 'Incomplete GL entries'}
                      </div>
                      <p className="mt-2 border-t border-slate-100 pt-1.5 text-xs leading-snug text-neutral-500 dark:border-white/[0.06] dark:text-slate-400">
                        {isAr
                          ? comparison.accountingUnavailableReasonAr ?? 'قيود غير مكتملة لهذه الفترة'
                          : comparison.accountingUnavailableReasonEn ?? 'Incomplete GL entries'}
                      </p>
                    </>
                  ) : (
                    <>
                      <div
                        dir="ltr"
                        className={`mt-2 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl ${
                          kpi.isFavorable
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {kpi.unit === 'pct'
                          ? fmtSignedPp(kpi.deltaPct)
                          : kpi.unit === 'orders'
                            ? `${kpi.deltaAbs > 0 ? '+' : ''}${f0(kpi.deltaAbs)}`
                            : fmtSignedKwd(kpi.deltaAbs, isAr)}
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-1.5 tabular-nums">
                        <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${badgeTone}`}>
                          {kpi.unit === 'pct'
                            ? `${signed.arrow} ${fmtSignedPp(signed.pct)}`
                            : signed.text}
                        </span>
                      </div>

                      <p
                        dir="ltr"
                        className="mt-2 border-t border-slate-100 pt-1.5 text-[13px] text-neutral-500 tabular-nums dark:border-white/[0.06] dark:text-slate-400"
                      >
                        {formatKpiVal(kpi, 'before')} →{' '}
                        <strong className="text-slate-800 dark:text-slate-100">
                          {formatKpiVal(kpi, 'after')}
                        </strong>{' '}
                        {kpi.unit === 'KWD' ? kwd : ''}
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
          <section className="ae-bento-card rounded-2xl bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] sm:p-6 dark:bg-[#101C17] dark:ring-emerald-500/10">
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
                    ? `مقارنة ${comparison.selectionB.titleAr} مقابل ${comparison.selectionA.titleAr}`
                    : `Comparing ${comparison.selectionB.titleEn} vs ${comparison.selectionA.titleEn}`}
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

            <div className="rounded-2xl bg-[#F7F7F8] p-4 ring-1 ring-slate-900/[0.03] dark:bg-[#0B1410] dark:ring-emerald-500/[0.08]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] font-semibold">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                    {isAr
                      ? `قبل: ${comparison.selectionB.shortLabelAr}`
                      : `Before: ${comparison.selectionB.shortLabelEn}`}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    {isAr
                      ? `بعد: ${comparison.selectionA.shortLabelAr}`
                      : `After: ${comparison.selectionA.shortLabelEn}`}
                  </span>
                </div>

                {inspectedBucket &&
                  (() => {
                    const p = getBucketPair(inspectedBucket)
                    const isOrders = chartMetric === 'orders'
                    return (
                      <div
                        dir="ltr"
                        className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-1 text-[12px] font-semibold text-slate-800 ring-1 ring-slate-900/[0.05] tabular-nums dark:bg-[#101C17] dark:text-slate-100"
                      >
                        <span className="text-emerald-700 dark:text-emerald-300">
                          {isAr ? inspectedBucket.labelAr : inspectedBucket.labelEn}
                        </span>
                        <span>
                          {isOrders ? f0(p.before) : fKwdNum(p.before)} →{' '}
                          <strong>{isOrders ? f0(p.after) : fKwdNum(p.after)}</strong> {p.unit}
                        </span>
                      </div>
                    )
                  })()}
              </div>

              <div dir="ltr" className="overflow-x-auto pb-1">
                <div
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, comparison.chartBuckets.length)}, minmax(50px, 1fr))`,
                  }}
                  className="grid min-w-full items-end gap-2"
                >
                  {comparison.chartBuckets.map((bkt, idx) => {
                    const p = getBucketPair(bkt)
                    const hBefore = Math.max(
                      6,
                      Math.round((Math.max(0, p.before) / maxBucketVal) * 132),
                    )
                    const hAfter = Math.max(
                      6,
                      Math.round((Math.max(0, p.after) / maxBucketVal) * 132),
                    )
                    const active = inspectedBucket?.id === bkt.id
                    return (
                      <button
                        key={bkt.id}
                        type="button"
                        onMouseEnter={() => setSelectedBucketIdx(idx)}
                        onClick={() => setSelectedBucketIdx(idx)}
                        className={`flex cursor-pointer flex-col items-center rounded-xl px-1 py-2 transition-all duration-150 ${
                          active
                            ? 'bg-white shadow-sm ring-1 ring-emerald-500/35 dark:bg-[#101C17]'
                            : 'hover:bg-white/60 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <span className="mb-1 text-xs font-semibold text-slate-600 tabular-nums dark:text-slate-300">
                          {chartMetric === 'orders' ? f0(p.after) : fKwdNum(p.after)}
                        </span>
                        <div className="flex h-[140px] w-full items-end justify-center gap-1 rounded-lg bg-slate-200/45 px-1 py-1 dark:bg-white/[0.03]">
                          <div
                            style={{ height: `${hBefore}px` }}
                            className="w-2.5 rounded-t-md bg-slate-300 sm:w-3 dark:bg-slate-600"
                            title={`Before (${bkt.metaB}): ${fKwdNum(p.before)} ${p.unit}`}
                          />
                          <div
                            style={{ height: `${hAfter}px` }}
                            className="w-2.5 rounded-t-md bg-emerald-500 sm:w-3"
                            title={`After (${bkt.metaA}): ${fKwdNum(p.after)} ${p.unit}`}
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

          {/* 2. Dimensional Before vs. After Variance Table (7 Branches + Unattributed, 6 Brands, Channels) */}
          <section className="ae-bento-card space-y-5 rounded-2xl bg-white px-3.5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] sm:p-6 dark:bg-[#101C17] dark:ring-emerald-500/10">
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
