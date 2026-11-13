'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { useGovernance } from '@/components/erp/GovernanceBellDrawer'
import { tierBadgeCls } from '@/components/erp/ops-expansion/DeliverySlaStudio'
import {
  ExecutiveComparisonControlBar,
  readInitialComparisonQueryFromEnv,
} from '@/components/erp/ExecutiveComparisonControlBar'
import {
  buildComparisonCsv,
  computeErpComparison,
  DEFAULT_COMPARISON_DATE_A,
  DEFAULT_COMPARISON_DATE_B,
  type BreakdownDimension,
  type ComparisonChartBucket,
  type EntityVarianceRow,
  type ErpComparisonQuery,
  type ExecutiveKpiDelta,
} from '@/lib/erp-comparison-engine'
import {
  computeWeekdayComparisonData,
  type LikeForLikeWeekdayRow,
  type TrafficLightTier,
} from '@/lib/ops-expansion-part2'

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

type ChartMetricKey = 'sales' | 'orders' | 'profit' | 'cumulative'
type TableTabKey = BreakdownDimension | 'weekday-rolling'
type SortColumnKey = 'valueA' | 'valueB' | 'deltaKwd' | 'deltaPct' | 'ordersA' | 'netProfitA' | 'marginDeltaPp'

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
const fmt2 = (n: number) => (Number.isFinite(n) ? n : 0).toFixed(2)
const fmtSigned0 = (n: number) => {
  const v = Math.round(Number.isFinite(n) ? n : 0)
  return `${v > 0 ? '+' : ''}${v.toLocaleString('en-US')}`
}
const fmtSignedPct = (n: number) => {
  const v = Number.isFinite(n) ? n : 0
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}
const fmtSignedPp = (n: number) => {
  const v = Number.isFinite(n) ? n : 0
  return `${v > 0 ? '+' : ''}${v.toFixed(1)} pp`
}

function tierDot(tier: TrafficLightTier): string {
  if (tier === 'green') return '🟢'
  if (tier === 'yellow') return '🟡'
  return '🔴'
}

function formatKpiPrimaryValue(kpi: ExecutiveKpiDelta): string {
  if (kpi.unit === 'orders') return fmt0(kpi.valueA)
  if (kpi.unit === 'pct') return `${kpi.valueA.toFixed(1)}%`
  return kpi.id === 'averageCheck' ? fmt2(kpi.valueA) : fmt0(kpi.valueA)
}

function formatKpiSecondaryValue(kpi: ExecutiveKpiDelta): string {
  if (kpi.unit === 'orders') return fmt0(kpi.valueB)
  if (kpi.unit === 'pct') return `${kpi.valueB.toFixed(1)}%`
  return kpi.id === 'averageCheck' ? fmt2(kpi.valueB) : fmt0(kpi.valueB)
}

function formatKpiDeltaBadge(kpi: ExecutiveKpiDelta): string {
  const arrow = kpi.trend === 'up' ? '▲' : kpi.trend === 'down' ? '▼' : '•'
  if (kpi.unit === 'pct') {
    return `${arrow} ${fmtSignedPp(kpi.deltaPct)}`
  }
  return `${arrow} ${fmtSignedPct(kpi.deltaPct)}`
}

export function WeekdayComparisonStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const kwd = isAr ? 'د.ك' : 'KWD'
  const { filters, workspace, liveSummary } = useGlobalFilter()
  const { requestApproval, getApprovalByRef, openDrawer } = useGovernance()

  const [query, setQuery] = useState<ErpComparisonQuery>(() => ({
    ...DEFAULT_STUDIO_QUERY,
    brandIds: filters.brand === 'all' ? 'all' : [filters.brand],
    branchIds: filters.branch === 'all' ? 'all' : [filters.branch],
    channelIds: filters.channel === 'all' ? 'all' : [filters.channel],
  }))

  useEffect(() => {
    setQuery(readInitialComparisonQueryFromEnv(DEFAULT_STUDIO_QUERY, filters))
    // Hydrate once on client mount from URL searchParams
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [chartMetric, setChartMetric] = useState<ChartMetricKey>('sales')
  const [selectedBucketIdx, setSelectedBucketIdx] = useState<number | null>(null)
  const [tableTab, setTableTab] = useState<TableTabKey>('branch')
  const [sortCol, setSortCol] = useState<SortColumnKey>('valueA')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [copiedReport, setCopiedReport] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ ar: string; en: string } | null>(null)

  const comparison = useMemo(
    () => computeErpComparison(query, liveSummary),
    [query, liveSummary],
  )
  const rollingWeekdays = useMemo(
    () => computeWeekdayComparisonData(workspace),
    [workspace],
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
      if (chartMetric === 'profit') {
        return { a: b.profitA, b: b.profitB, delta: b.profitDelta, unitLabel: kwd }
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
    // Default inspection to peak Selection A bucket
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
    return [...src].sort((a, b) => {
      const diff = a[sortCol] - b[sortCol]
      return sortDir === 'desc' ? -diff : diff
    })
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
    const sA = comparison.selectionA
    const sB = comparison.selectionB
    const lines = isAr
      ? [
          `📊 *تقرير المقارنة التنفيذي المخصص — فنتشر فودز (أودو 17)*`,
          `النطاق: ${comparison.scopeSummaryAr}`,
          `• الأساس (أ — ${sA.titleAr}): *${fmt0(sA.netSalesKwd)} د.ك* | ${fmt0(sA.completedOrders)} طلب | صافي الجيب ${fmt0(sA.netPocketCashKwd)} د.ك (${sA.netPocketMarginPct.toFixed(1)}%)`,
          `• المقارنة (ب — ${sB.titleAr}): *${fmt0(sB.netSalesKwd)} د.ك* | ${fmt0(sB.completedOrders)} طلب | صافي الجيب ${fmt0(sB.netPocketCashKwd)} د.ك (${sB.netPocketMarginPct.toFixed(1)}%)`,
          `• فرق المبيعات: *${fmtSigned0(comparison.kpis.netSales.deltaAbs)} د.ك (${fmtSignedPct(comparison.kpis.netSales.deltaPct)})*`,
          `• الملخص: ${comparison.insights.summaryAr}`,
        ]
      : [
          `📊 *Venture Foods Custom Executive Comparison (Odoo 17)*`,
          `Scope: ${comparison.scopeSummaryEn}`,
          `• Base A (${sA.titleEn}): *${fmt0(sA.netSalesKwd)} KWD* | ${fmt0(sA.completedOrders)} orders | Net Pocket ${fmt0(sA.netPocketCashKwd)} KWD (${sA.netPocketMarginPct.toFixed(1)}%)`,
          `• Compare B (${sB.titleEn}): *${fmt0(sB.netSalesKwd)} KWD* | ${fmt0(sB.completedOrders)} orders | Net Pocket ${fmt0(sB.netPocketCashKwd)} KWD (${sB.netPocketMarginPct.toFixed(1)}%)`,
          `• Net Variance: *${fmtSigned0(comparison.kpis.netSales.deltaAbs)} KWD (${fmtSignedPct(comparison.kpis.netSales.deltaPct)})*`,
          `• Insight: ${comparison.insights.summaryEn}`,
        ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopiedReport(true)
      window.setTimeout(() => setCopiedReport(false), 2000)
    } catch {
      // ignore clipboard errors
    }
  }, [comparison, isAr])

  const handleEscalateEntityRow = useCallback(
    (row: EntityVarianceRow) => {
      const recoveryTarget = Math.max(250, Math.round(Math.abs(row.deltaKwd) * 0.75))
      requestApproval({
        refKey: `comp-entity-recovery-${row.dimension}-${row.id}`,
        domain: 'operations',
        titleAr: `خطة معالجة تراجع ${row.nameAr} (فارق ${fmtSigned0(row.deltaKwd)} د.ك)`,
        titleEn: `Variance Recovery Action for ${row.nameEn} (${fmtSigned0(row.deltaKwd)} KWD Delta)`,
        summaryAr: `${row.nameAr}: المبيعات في (${comparison.selectionA.shortLabelAr}) بلغت ${fmt0(row.valueA)} د.ك مقابل ${fmt0(row.valueB)} د.ك في (${comparison.selectionB.shortLabelAr}) بفارق ${fmtSignedPct(row.deltaPct)} وصافي جيب ${fmt0(row.netProfitA)} د.ك. توجيه فريق التشغيل والتسويق لتنشيط الساعات الهادئة ومراجعة جاهزية الأصناف.`,
        summaryEn: `${row.nameEn}: ${fmt0(row.valueA)} KWD (${comparison.selectionA.shortLabelEn}) vs ${fmt0(row.valueB)} KWD (${comparison.selectionB.shortLabelEn}), delta ${fmtSignedPct(row.deltaPct)} and net pocket ${fmt0(row.netProfitA)} KWD. Trigger targeted operational & quiet-hour recovery.`,
        departmentAr: 'إدارة نمو المبيعات والتشغيل',
        departmentEn: 'Revenue Growth & Operations',
        budgetOrCostKwd: 110,
        expectedMonthlyReturnKwd: recoveryTarget * 3,
        href: '/erp/weekday-comparison',
      })
      setToastMsg({
        ar: `تم تصعيد خطة تحسين ${row.nameAr} إلى جرس المدير 🔔`,
        en: `Escalated ${row.nameEn} variance recovery plan to Manager Bell 🔔`,
      })
      window.setTimeout(() => setToastMsg(null), 3200)
    },
    [comparison.selectionA.shortLabelAr, comparison.selectionA.shortLabelEn, comparison.selectionB.shortLabelAr, comparison.selectionB.shortLabelEn, requestApproval],
  )

  const handleEscalateWeakDay = useCallback(
    (row: LikeForLikeWeekdayRow) => {
      const targetRecovery = Math.max(220, Math.round(Math.abs(row.varianceDisplayKwd) * 0.7))
      requestApproval({
        refKey: `weekday-recovery-plan-${row.dow}`,
        domain: 'marketing',
        titleAr: `خطة تعويض وتنشيط مبيعات يوم ${row.weekdayAr} (فارق ${fmtSigned0(row.varianceDisplayKwd)} د.ك)`,
        titleEn: `Recovery & Combo Plan for ${row.weekdayEn} (${fmtSigned0(row.varianceDisplayKwd)} KWD Variance)`,
        summaryAr: `مبيعات ${row.weekdayAr} هذا الأسبوع (${row.thisDate}: ${fmt0(row.thisDisplayKwd)} د.ك) مقابل ${row.weekdayAr} الأسبوع الماضي (${row.lastDate}: ${fmt0(row.lastDisplayKwd)} د.ك) بفارق ${fmtSignedPct(row.variancePct)}.`,
        summaryEn: `${row.weekdayEn} (${row.thisDate}: ${fmt0(row.thisDisplayKwd)} KWD) vs last ${row.weekdayEn} (${row.lastDate}: ${fmt0(row.lastDisplayKwd)} KWD, ${fmtSignedPct(row.variancePct)}).`,
        departmentAr: 'إدارة نمو المبيعات والتشغيل',
        departmentEn: 'Revenue Growth & Operations',
        budgetOrCostKwd: 95,
        expectedMonthlyReturnKwd: targetRecovery * 3,
        href: '/erp/weekday-comparison',
      })
      setToastMsg({
        ar: `تم تصعيد خطة تعويض يوم ${row.weekdayAr} إلى جرس المدير 🔔`,
        en: `Escalated ${row.weekdayEn} recovery plan to Manager Bell 🔔`,
      })
      window.setTimeout(() => setToastMsg(null), 3200)
    },
    [requestApproval],
  )

  // Build SVG Cumulative Polyline Points when chartMetric === 'cumulative'
  const cumulativeSvg = useMemo(() => {
    const bkts = comparison.chartBuckets
    if (bkts.length < 2) return null
    const maxCum = Math.max(
      1,
      ...bkts.map((b) => Math.max(b.cumulativeA, b.cumulativeB)),
    )
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
    return { w, h, ptsA, ptsB, maxCum }
  }, [comparison.chartBuckets])

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-[1920px] mx-auto space-y-5 pb-12 font-sans text-[14px] sm:text-[15px] text-neutral-900 antialiased dark:text-slate-100"
    >
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/95 px-4 py-3 text-[14px] font-medium text-emerald-950 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/60 dark:text-emerald-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{isAr ? toastMsg.ar : toastMsg.en}</span>
          </div>
          <button
            type="button"
            onClick={() => openDrawer('approvals')}
            className="cursor-pointer rounded-xl border border-emerald-300/70 bg-white px-3 py-1 text-[12.5px] font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-[#101C17] dark:text-emerald-200"
          >
            {isAr ? 'فتح جرس المدير' : 'Open Bell'}
          </button>
        </div>
      )}

      {/* ───────────── 1. Universal Executive Comparison Control Bar ───────────── */}
      <ExecutiveComparisonControlBar
        query={query}
        onQueryChange={setQuery}
        onReset={() => setQuery(DEFAULT_STUDIO_QUERY)}
        onExportCsv={handleExportCsv}
        extraActions={
          <button
            type="button"
            onClick={handleCopyReport}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#F6F7F8] px-3 text-[12.5px] font-semibold text-slate-700 ring-1 ring-slate-900/[0.06] transition-all duration-150 hover:bg-slate-200/70 dark:bg-[#0B1410] dark:text-slate-200 dark:ring-emerald-500/15"
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

      {/* ───────────── 2. Executive Insight Callout Strip (Top Gainer & Biggest Decline) ───────────── */}
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
                <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-white/[0.07] dark:text-slate-300">
                  {isAr ? comparison.scopeSummaryAr : comparison.scopeSummaryEn}
                </span>
              </div>
              {!comparison.isScopeCompatible && (
                <p className="mt-1 text-[12px] font-medium text-amber-700 dark:text-amber-300">
                  {isAr
                    ? 'تنبيه: المطعم المحدد لا يعمل داخل الفرع المختار في أودو — اختر «تحديد الكل» أو فرعاً متوافقاً.'
                    : 'Note: Selected Brand does not operate in the chosen Branch in Odoo — choose a compatible branch or All 7 Branches.'}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 tabular-nums">
            {comparison.insights.topGainer && (
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50/90 px-3 py-1.5 text-[12px] font-semibold text-emerald-900 ring-1 ring-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/25">
                <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                <span>
                  {isAr ? 'أعلى نمو:' : 'Top Gainer:'}{' '}
                  {isAr ? comparison.insights.topGainer.nameAr : comparison.insights.topGainer.nameEn}{' '}
                  ({fmtSigned0(comparison.insights.topGainer.deltaKwd)} {kwd})
                </span>
              </div>
            )}

            {comparison.insights.biggestDecline &&
              comparison.insights.biggestDecline.deltaKwd < 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50/90 px-3 py-1.5 text-[12px] font-semibold text-rose-900 ring-1 ring-rose-600/15 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/25">
                  <TrendingDown className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-300" />
                  <span>
                    {isAr ? 'أكبر تراجع:' : 'Biggest Decline:'}{' '}
                    {isAr
                      ? comparison.insights.biggestDecline.nameAr
                      : comparison.insights.biggestDecline.nameEn}{' '}
                    ({fmtSigned0(comparison.insights.biggestDecline.deltaKwd)} {kwd})
                  </span>
                </div>
              )}
          </div>
        </div>
      </section>

      {/* ───────────── 3. 6 Core Executive KPI Delta Cards (with Smart Polarity) ───────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
        {comparison.kpiList.map((kpi) => {
          const badgeTone =
            kpi.trend === 'flat'
              ? 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
              : kpi.isFavorable
                ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/30'
                : 'bg-rose-50 text-rose-800 ring-1 ring-rose-600/20 dark:bg-rose-500/20 dark:text-rose-200 dark:ring-rose-400/30'

          return (
            <div key={kpi.id} className={KPI_CLS}>
              <div className="flex items-start justify-between gap-1.5">
                <span className="text-[12px] sm:text-[12.5px] font-semibold leading-snug text-slate-600 dark:text-slate-300">
                  {isAr ? kpi.labelAr : kpi.labelEn}
                </span>
                {kpi.isFavorable ? (
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-baseline gap-1.5 tabular-nums">
                <span className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  {formatKpiPrimaryValue(kpi)}
                </span>
                {kpi.unit === 'KWD' && (
                  <span className="text-[11.5px] font-semibold text-slate-500">{kwd}</span>
                )}
                {kpi.unit === 'orders' && (
                  <span className="text-[11.5px] font-semibold text-slate-500">
                    {isAr ? 'طلب' : 'ord'}
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between gap-1.5 tabular-nums">
                <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${badgeTone}`}>
                  {formatKpiDeltaBadge(kpi)}
                </span>
                {kpi.id === 'foodAndAggregatorCost' && typeof kpi.shareOfSalesA === 'number' ? (
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {kpi.shareOfSalesA.toFixed(1)}% {isAr ? 'من المبيعات' : 'of sales'}
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {kpi.unit === 'pct'
                      ? `${kpi.deltaBps && kpi.deltaBps > 0 ? '+' : ''}${kpi.deltaBps ?? 0} bps`
                      : `${fmtSigned0(kpi.deltaAbs)} ${kpi.unit === 'KWD' ? kwd : ''}`}
                  </span>
                )}
              </div>

              <p className="mt-2 border-t border-slate-100 pt-1.5 text-[11.5px] leading-snug text-slate-500 tabular-nums dark:border-white/[0.06] dark:text-slate-400">
                {isAr ? 'مقارنة بـ:' : 'vs B:'}{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatKpiSecondaryValue(kpi)}
                  {kpi.unit === 'KWD' ? ` ${kwd}` : ''}
                </span>
                {kpi.id === 'foodAndAggregatorCost' && typeof kpi.shareOfSalesB === 'number'
                  ? ` (${kpi.shareOfSalesB.toFixed(1)}%)`
                  : ''}
              </p>
            </div>
          )
        })}
      </section>

      {/* ───────────── 4. Wide Horizontal Interactive Comparison Chart (min-h-[340px] w-full) ───────────── */}
      <section className={`${CARD_CLS} min-h-[340px] w-full`}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[16px] sm:text-[17px] font-semibold tracking-tight text-slate-950 dark:text-white">
              {comparison.chartKind === 'hourly-14'
                ? isAr
                  ? `المقارنة الأفقية بالساعة (11:00 ص – 12:00 ص): ${comparison.selectionA.shortLabelAr} مقابل ${comparison.selectionB.shortLabelAr}`
                  : `Horizontal Hourly Comparison (11:00 – 00:00): ${comparison.selectionA.shortLabelEn} vs ${comparison.selectionB.shortLabelEn}`
                : isAr
                  ? `المقارنة اليومية الأفقية للفترة: ${comparison.selectionA.shortLabelAr} مقابل ${comparison.selectionB.shortLabelAr}`
                  : `Day-by-Day Horizontal Range Comparison: ${comparison.selectionA.shortLabelEn} vs ${comparison.selectionB.shortLabelEn}`}
            </h2>
            <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-slate-500 dark:text-slate-400">
              {isAr
                ? 'اضغط أو مرر على أي عمود زمني لقراءة الأرقام الدقيقة والفارق المباشر بين الطرفين'
                : 'Hover or tap any horizontal time bucket to inspect exact A vs B values and net variance'}
            </p>
          </div>

          {/* Metric Switcher */}
          <div role="tablist" className={SEGMENT_TRACK_CLS}>
            {(
              [
                { id: 'sales', en: 'Sales KWD', ar: 'المبيعات د.ك' },
                { id: 'orders', en: 'Orders', ar: 'الطلبات' },
                { id: 'profit', en: 'Net Profit KWD', ar: 'صافي الجيب د.ك' },
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
          {/* Legend & Inspected Bucket Readout */}
          <div className="mb-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4 text-[12.5px] font-semibold">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                {isAr
                  ? `أ: ${comparison.selectionA.shortLabelAr} (${fmt0(comparison.selectionA.netSalesKwd)} ${kwd})`
                  : `A: ${comparison.selectionA.shortLabelEn} (${fmt0(comparison.selectionA.netSalesKwd)} ${kwd})`}
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                {isAr
                  ? `ب: ${comparison.selectionB.shortLabelAr} (${fmt0(comparison.selectionB.netSalesKwd)} ${kwd})`
                  : `B: ${comparison.selectionB.shortLabelEn} (${fmt0(comparison.selectionB.netSalesKwd)} ${kwd})`}
              </span>
            </div>

            {inspectedBucket && (() => {
              const pair = getBucketPair(inspectedBucket)
              return (
                <div className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-slate-900/[0.05] tabular-nums dark:bg-[#101C17] dark:text-slate-100 dark:ring-emerald-500/20">
                  <span className="text-emerald-700 dark:text-emerald-300">
                    {isAr ? inspectedBucket.labelAr : inspectedBucket.labelEn}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span>
                    A: <strong>{fmt0(pair.a)}</strong> {pair.unitLabel}
                  </span>
                  <span className="text-slate-400">vs</span>
                  <span>
                    B: <strong>{fmt0(pair.b)}</strong> {pair.unitLabel}
                  </span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                      pair.delta >= 0
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
                    }`}
                  >
                    {fmtSigned0(pair.delta)} {pair.unitLabel}
                  </span>
                </div>
              )
            })()}
          </div>

          {/* Optional Dual Cumulative Curve SVG Overlay */}
          {chartMetric === 'cumulative' && cumulativeSvg && (
            <div className="mb-4 rounded-xl bg-white/80 p-3 ring-1 ring-slate-900/[0.04] dark:bg-[#101C17]/70 dark:ring-white/[0.06]">
              <svg
                viewBox={`0 0 ${cumulativeSvg.w} ${cumulativeSvg.h}`}
                className="h-[150px] w-full overflow-visible"
                role="img"
                aria-label="Cumulative sales comparison curve"
              >
                <line
                  x1="24"
                  y1={cumulativeSvg.h - 16}
                  x2={cumulativeSvg.w - 24}
                  y2={cumulativeSvg.h - 16}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-700"
                  strokeWidth="1"
                />
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

          {/* Horizontal Paired Capsule Bars: 14-Column Grid in Single-Day, Horizontal Dynamic Columns in Range */}
          {comparison.chartKind === 'hourly-14' ? (
            <div dir="ltr" className="grid grid-cols-7 lg:grid-cols-14 gap-2 items-end">
              {comparison.chartBuckets.map((bkt, idx) => {
                const pair = getBucketPair(bkt)
                const hA = Math.max(8, Math.round((Math.max(0, pair.a) / maxBucketVal) * 148))
                const hB = Math.max(8, Math.round((Math.max(0, pair.b) / maxBucketVal) * 148))
                const isSelected = inspectedBucket?.id === bkt.id
                return (
                  <button
                    key={bkt.id}
                    type="button"
                    onMouseEnter={() => setSelectedBucketIdx(idx)}
                    onClick={() => setSelectedBucketIdx(idx)}
                    className={`group flex cursor-pointer flex-col items-center rounded-xl px-1 py-2 transition-all duration-150 ${
                      isSelected
                        ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-emerald-500/35 dark:bg-[#101C17]'
                        : 'hover:bg-white/60 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="mb-1 text-[10px] font-semibold tracking-tight text-slate-600 tabular-nums dark:text-slate-300">
                      {fmt0(pair.a)}
                    </span>
                    <div className="flex h-[156px] w-full items-end justify-center gap-1 rounded-lg bg-slate-200/45 px-1 py-1 dark:bg-white/[0.03]">
                      <div
                        style={{ height: `${hA}px` }}
                        className="w-2.5 sm:w-3 rounded-t-md bg-emerald-500 transition-all duration-150 group-hover:bg-emerald-400"
                        title={`${bkt.metaA}: ${fmt0(pair.a)} ${pair.unitLabel}`}
                      />
                      <div
                        style={{ height: `${hB}px` }}
                        className="w-2.5 sm:w-3 rounded-t-md bg-slate-300 transition-all duration-150 dark:bg-slate-600"
                        title={`${bkt.metaB}: ${fmt0(pair.b)} ${pair.unitLabel}`}
                      />
                    </div>
                    <span className="mt-1.5 text-[10.5px] font-semibold text-slate-600 tabular-nums dark:text-slate-300">
                      {isAr ? bkt.labelAr : bkt.labelEn}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div dir="ltr" className="overflow-x-auto pb-1">
              <div
                style={{
                  gridTemplateColumns: `repeat(${comparison.chartBuckets.length}, minmax(54px, 1fr))`,
                }}
                className="grid gap-2 items-end min-w-full"
              >
                {comparison.chartBuckets.map((bkt, idx) => {
                  const pair = getBucketPair(bkt)
                  const hA = Math.max(8, Math.round((Math.max(0, pair.a) / maxBucketVal) * 148))
                  const hB = Math.max(8, Math.round((Math.max(0, pair.b) / maxBucketVal) * 148))
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
                      <span className="mb-1 text-[10px] font-semibold tracking-tight text-slate-600 tabular-nums dark:text-slate-300">
                        {fmt0(pair.a)}
                      </span>
                      <div className="flex h-[156px] w-full items-end justify-center gap-1 rounded-lg bg-slate-200/45 px-1 py-1 dark:bg-white/[0.03]">
                        <div
                          style={{ height: `${hA}px` }}
                          className="w-3 rounded-t-md bg-emerald-500 transition-all duration-150"
                          title={`${bkt.metaA}: ${fmt0(pair.a)} ${pair.unitLabel}`}
                        />
                        <div
                          style={{ height: `${hB}px` }}
                          className="w-3 rounded-t-md bg-slate-300 transition-all duration-150 dark:bg-slate-600"
                          title={`${bkt.metaB}: ${fmt0(pair.b)} ${pair.unitLabel}`}
                        />
                      </div>
                      <span className="mt-1.5 text-[10.5px] font-semibold text-slate-700 tabular-nums dark:text-slate-200">
                        {bkt.labelEn}
                      </span>
                      <span className="text-[9.5px] text-slate-400 tabular-nums">{bkt.metaB}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ───────────── 5. Full-Width Sortable Variance Breakdown Table ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[16px] sm:text-[17px] font-semibold tracking-tight text-slate-950 dark:text-white">
              {isAr
                ? 'جدول تفصيل الفروقات والمطابقة المحاسبية (الفروع • المطاعم • القنوات)'
                : 'Dimensional Variance Breakdown Matrix (Branches • Brands • Channels)'}
            </h2>
            <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-slate-500 dark:text-slate-400">
              {isAr
                ? 'اضغط على أي عمود للترتيب الفوري — مجموع الفروع والمطاعم والقنوات يطابق الإجمالي بدقة 0.000 د.ك'
                : 'Click any numeric column to sort — sum of Branches, Brands, and Channels reconciles to 0.000 KWD'}
            </p>
          </div>

          <div role="tablist" className={SEGMENT_TRACK_CLS}>
            {(
              [
                { id: 'branch', en: 'By Branch (7)', ar: 'حسب الفرع (7)' },
                { id: 'brand', en: 'By Brand (6)', ar: 'حسب المطعم (6)' },
                { id: 'channel', en: 'By Channel (8)', ar: 'حسب القناة (8)' },
                { id: 'weekday-rolling', en: '7-Weekday Rolling', ar: 'معيار أيام الأسبوع (7)' },
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

        {tableTab !== 'weekday-rolling' ? (
          <div className={TABLE_SCROLL_CLS}>
            <table className="w-full min-w-[900px] border-collapse text-start text-[13.5px]">
              <thead>
                <tr className="border-b border-slate-200/80 text-[12px] font-semibold text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
                  <th className="py-2.5 pe-3 text-start">
                    {tableTab === 'branch'
                      ? isAr
                        ? 'الفرع (7)'
                        : 'Branch (7)'
                      : tableTab === 'brand'
                        ? isAr
                          ? 'المطعم (6)'
                          : 'Brand (6)'
                        : isAr
                          ? 'القناة (8)'
                          : 'Channel (8)'}
                  </th>
                  <th className="py-2.5 px-3 text-start">
                    <button
                      type="button"
                      onClick={() => toggleSort('valueA')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-300"
                    >
                      <span>
                        {isAr ? `أ (${comparison.selectionA.shortLabelAr})` : `A (${comparison.selectionA.shortLabelEn})`}
                      </span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-start">
                    <button
                      type="button"
                      onClick={() => toggleSort('valueB')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-300"
                    >
                      <span>
                        {isAr ? `ب (${comparison.selectionB.shortLabelAr})` : `B (${comparison.selectionB.shortLabelEn})`}
                      </span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-start">
                    <button
                      type="button"
                      onClick={() => toggleSort('deltaKwd')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-300"
                    >
                      <span>{isAr ? `الفارق (${kwd})` : `Variance (${kwd})`}</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-start">
                    <button
                      type="button"
                      onClick={() => toggleSort('deltaPct')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-300"
                    >
                      <span>{isAr ? 'التغير %' : 'Delta %'}</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-start">
                    <button
                      type="button"
                      onClick={() => toggleSort('ordersA')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-300"
                    >
                      <span>{isAr ? 'الطلبات (أ / ب)' : 'Orders (A / B)'}</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-start">
                    <button
                      type="button"
                      onClick={() => toggleSort('netProfitA')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-300"
                    >
                      <span>{isAr ? 'صافي الجيب (أ)' : 'Net Pocket (A)'}</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-start">
                    <button
                      type="button"
                      onClick={() => toggleSort('marginDeltaPp')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-300"
                    >
                      <span>{isAr ? 'الهامش %' : 'Margin Shift'}</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2.5 ps-3 text-end">{isAr ? 'الإجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 tabular-nums dark:divide-white/[0.06]">
                {activeEntityRows.map((row) => {
                  const existingApproval = getApprovalByRef(
                    `comp-entity-recovery-${row.dimension}-${row.id}`,
                  )
                  return (
                    <tr
                      key={row.id}
                      className={`transition hover:bg-slate-50/90 dark:hover:bg-white/[0.03] ${
                        !row.isCompatible ? 'opacity-45' : ''
                      }`}
                    >
                      <td className="py-3 pe-3">
                        <div className="font-semibold text-slate-950 dark:text-white">
                          {isAr ? row.nameAr : row.nameEn}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isAr ? row.subMetaAr : row.subMetaEn} • {row.shareOfTotalAPct.toFixed(1)}%
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-950 dark:text-white">
                        {fmt0(row.valueA)} {kwd}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-600 dark:text-slate-300">
                        {fmt0(row.valueB)} {kwd}
                      </td>
                      <td
                        className={`py-3 px-3 font-semibold ${
                          row.deltaKwd >= 0
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {fmtSigned0(row.deltaKwd)} {kwd}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${tierBadgeCls(row.tier)}`}
                        >
                          {tierDot(row.tier)} {fmtSignedPct(row.deltaPct)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {fmt0(row.ordersA)}{' '}
                        <span className="text-[11.5px] text-slate-400">/ {fmt0(row.ordersB)}</span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-emerald-700 dark:text-emerald-300">
                        {fmt0(row.netProfitA)} {kwd}
                        <span className="ms-1.5 text-[11px] font-medium text-slate-400">
                          ({fmtSigned0(row.netProfitDeltaKwd)})
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {row.marginPctA.toFixed(1)}%
                        </span>{' '}
                        <span
                          className={`text-[11.5px] font-semibold ${
                            row.marginDeltaPp >= 0
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          ({fmtSignedPp(row.marginDeltaPp)})
                        </span>
                      </td>
                      <td className="py-3 ps-3 text-end">
                        {row.tier === 'red' ? (
                          <button
                            type="button"
                            onClick={() => handleEscalateEntityRow(row)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-[12px] font-semibold text-rose-800 ring-1 ring-rose-600/20 transition hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-200"
                          >
                            {existingApproval
                              ? isAr
                                ? 'مُصعّد ✓'
                                : 'Escalated ✓'
                              : isAr
                                ? 'تصعيد ↗'
                                : 'Escalate ↗'}
                          </button>
                        ) : (
                          <span className="text-[12px] font-medium text-slate-400">
                            {row.deltaKwd >= 0 ? (isAr ? 'نمو مستقر' : 'Healthy') : isAr ? 'متابعة' : 'Watch'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-[#F7F8F9] font-semibold text-slate-950 tabular-nums dark:border-white/10 dark:bg-[#0B1410] dark:text-white">
                  <td className="py-3 pe-3">
                    {isAr ? 'الإجمالي المطابق (أودو 17)' : 'Reconciled Total (Odoo 17)'}
                  </td>
                  <td className="py-3 px-3">
                    {fmt0(comparison.selectionA.netSalesKwd)} {kwd}
                  </td>
                  <td className="py-3 px-3">
                    {fmt0(comparison.selectionB.netSalesKwd)} {kwd}
                  </td>
                  <td
                    className={`py-3 px-3 ${
                      comparison.kpis.netSales.deltaAbs >= 0
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {fmtSigned0(comparison.kpis.netSales.deltaAbs)} {kwd}
                  </td>
                  <td className="py-3 px-3">{fmtSignedPct(comparison.kpis.netSales.deltaPct)}</td>
                  <td className="py-3 px-3">
                    {fmt0(comparison.selectionA.completedOrders)} /{' '}
                    {fmt0(comparison.selectionB.completedOrders)}
                  </td>
                  <td className="py-3 px-3 text-emerald-700 dark:text-emerald-300">
                    {fmt0(comparison.selectionA.netPocketCashKwd)} {kwd}
                  </td>
                  <td className="py-3 px-3">
                    {comparison.selectionA.netPocketMarginPct.toFixed(1)}% (
                    {fmtSignedPp(comparison.kpis.netPocketMargin.deltaPct)})
                  </td>
                  <td className="py-3 ps-3 text-end text-[11.5px] text-emerald-700 dark:text-emerald-300">
                    0.000 {kwd}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          /* 7-Weekday Rolling Benchmark View with 1-click Load into Custom Date A vs Date B */
          <div className={TABLE_SCROLL_CLS}>
            <table className="w-full min-w-[860px] border-collapse text-start text-[13.5px]">
              <thead>
                <tr className="border-b border-slate-200/80 text-[12px] font-semibold text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
                  <th className="py-2.5 pe-3 text-start">{isAr ? 'اليوم' : 'Weekday'}</th>
                  <th className="py-2.5 px-3 text-start">{isAr ? 'هذا الأسبوع' : 'This Week'}</th>
                  <th className="py-2.5 px-3 text-start">{isAr ? 'الأسبوع الماضي' : 'Last Week'}</th>
                  <th className="py-2.5 px-3 text-start">{isAr ? 'الفارق' : 'Variance'}</th>
                  <th className="py-2.5 px-3 text-start">{isAr ? 'متوسط 4 أسابيع' : '4W Avg'}</th>
                  <th className="py-2.5 px-3 text-start">{isAr ? 'صافي الجيب' : 'Net Pocket'}</th>
                  <th className="py-2.5 ps-3 text-end">{isAr ? 'تحميل / تصعيد' : 'Load / Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 tabular-nums dark:divide-white/[0.06]">
                {rollingWeekdays.rows.map((r) => {
                  const existingApproval = getApprovalByRef(`weekday-recovery-plan-${r.dow}`)
                  return (
                    <tr
                      key={r.dow}
                      className="transition hover:bg-slate-50/90 dark:hover:bg-white/[0.03]"
                    >
                      <td className="py-3 pe-3 font-semibold text-slate-950 dark:text-white">
                        {isAr ? r.weekdayAr : r.weekdayEn}
                        <div className="text-[11px] font-normal text-slate-400">
                          {r.thisDate} vs {r.lastDate}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-950 dark:text-white">
                        {fmt0(r.thisDisplayKwd)} {kwd}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {fmt0(r.lastDisplayKwd)} {kwd}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${tierBadgeCls(r.tier)}`}
                        >
                          {tierDot(r.tier)} {fmtSigned0(r.varianceDisplayKwd)} {kwd} (
                          {fmtSignedPct(r.variancePct)})
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {fmt0(r.fourWeekAvgDisplayKwd)} {kwd} ({fmtSignedPct(r.vsFourWeekPct)})
                      </td>
                      <td className="py-3 px-3 font-semibold text-emerald-700 dark:text-emerald-300">
                        {fmt0(r.thisPocketProfitKwd)} {kwd}
                      </td>
                      <td className="py-3 ps-3 text-end">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setQuery((prev) => ({
                                ...prev,
                                mode: 'date-vs-date',
                                granularity: 'single',
                                periodA: { from: r.thisDate, to: r.thisDate },
                                periodB: { from: r.lastDate, to: r.lastDate },
                              }))
                            }
                            className="cursor-pointer rounded-lg bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-800 ring-1 ring-emerald-600/20 transition hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-200"
                          >
                            {isAr ? 'مقارنة بالتقويم ↗' : 'Load Dates ↗'}
                          </button>
                          {r.tier === 'red' && (
                            <button
                              type="button"
                              onClick={() => handleEscalateWeakDay(r)}
                              className="cursor-pointer rounded-lg bg-rose-50 px-2.5 py-1 text-[11.5px] font-semibold text-rose-800 ring-1 ring-rose-600/20 transition hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-200"
                            >
                              {existingApproval
                                ? isAr
                                  ? 'مُصعّد ✓'
                                  : 'Escalated ✓'
                                : isAr
                                  ? 'تصعيد ↗'
                                  : 'Escalate ↗'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
