'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { BeforeAfterDualBarChart, type DualBarDatum } from '@/components/aether/InteractiveHoverCharts'
import {
  computeBeforeAfterSnapshot,
  type ApprovedDecisionItem,
  type ChartGroupingKey,
  type ChartMetricKey,
  type ComparisonMode,
  type ComparisonTableRow,
} from '@/lib/aether/before-after-engine'
import {
  sanitizeCampaigns,
  SEEDED_SOCIAL_CAMPAIGNS,
  SOCIAL_CAMPAIGNS_STORAGE_KEY,
  type SocialCampaign,
} from '@/lib/aether/social-campaigns'
import { useLang } from '@/components/aether/ui'

const APPROVALS_STORE = 'vf-journey-approvals-v1'

const f0 = (n: number) => Math.round(n).toLocaleString('en-US')
const f1 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const f2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtKwd = (n: number, isAr: boolean, decimals = 0) => {
  const numStr = decimals === 2 ? f2(n) : decimals === 1 || (Math.abs(n) > 0 && Math.abs(n) < 100) ? f1(n) : f0(n)
  return isAr ? `${numStr} د.ك` : `${numStr} KWD`
}

const fmtSignedKwd = (n: number, isAr: boolean, decimals = 0) => {
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return `${sign}${fmtKwd(Math.abs(n), isAr, decimals)}`
}

const fmtSignedPct = (pct: number) => `${pct > 0 ? '+' : ''}${f1(pct)}%`

type TableScopeTab = 'all' | 'brands' | 'branches' | 'channels'

export function BeforeAfterStudio() {
  const { isAr, T } = useLang()
  const { filters, workspace, liveSummary } = useGlobalFilter()

  const [mode, setMode] = useState<ComparisonMode>('period-prev')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [chartMetric, setChartMetric] = useState<ChartMetricKey>('sales')
  const [chartGrouping, setChartGrouping] = useState<ChartGroupingKey>('timeline')
  const [tableTab, setTableTab] = useState<TableScopeTab>('all')

  const [campaigns, setCampaigns] = useState<SocialCampaign[]>(SEEDED_SOCIAL_CAMPAIGNS)
  const [decisions, setDecisions] = useState<ApprovedDecisionItem[]>([])

  useEffect(() => {
    try {
      const savedCamps = localStorage.getItem(SOCIAL_CAMPAIGNS_STORAGE_KEY)
      if (savedCamps) setCampaigns(sanitizeCampaigns(JSON.parse(savedCamps)))
    } catch {
      // ignore storage error
    }
    try {
      const savedDec = localStorage.getItem(APPROVALS_STORE)
      if (savedDec) {
        const parsed = JSON.parse(savedDec)
        if (Array.isArray(parsed)) setDecisions(parsed as ApprovedDecisionItem[])
      }
    } catch {
      // ignore storage error
    }
  }, [])

  // Reset today-lastweek mode when user switches away from 'today'
  useEffect(() => {
    if (filters.period !== 'today' && mode === 'today-lastweek') {
      setMode('period-prev')
    }
  }, [filters.period, mode])

  const snap = useMemo(
    () => computeBeforeAfterSnapshot(filters, mode, selectedEventId, campaigns, decisions, liveSummary),
    [filters, mode, selectedEventId, campaigns, decisions, liveSummary],
  )

  const periodModeLabel = useMemo(() => {
    if (filters.period === 'today') {
      return T('Today vs Yesterday', 'اليوم مقابل أمس')
    }
    if (filters.period === 'week') {
      return T('This Week vs Last Week', 'هذا الأسبوع مقابل السابق')
    }
    if (filters.period === 'year') {
      return T('This Year vs Prior Period', 'هذه السنة مقابل الفترة المقابلة')
    }
    return T('This Month vs Last Month', 'هذا الشهر مقابل السابق')
  }, [T, filters.period])

  // Build DualBarDatum[] for the active metric & grouping
  const chartData = useMemo<DualBarDatum[]>(() => {
    const srcPoints = chartGrouping === 'branches' ? snap.branchPoints : snap.timelinePoints
    return srcPoints.map((pt) => {
      let before = pt.beforeSalesKwd
      let after = pt.afterSalesKwd
      let beforeFormatted = fmtKwd(pt.beforeSalesKwd, isAr)
      let afterFormatted = fmtKwd(pt.afterSalesKwd, isAr)
      let diffFormatted = fmtSignedKwd(pt.afterSalesKwd - pt.beforeSalesKwd, isAr)
      let higherIsBetter = true
      const salesDiffKwd = fmtSignedKwd(pt.afterSalesKwd - pt.beforeSalesKwd, isAr)

      if (chartMetric === 'pocket') {
        before = pt.beforePocketKwd
        after = pt.afterPocketKwd
        beforeFormatted = fmtKwd(pt.beforePocketKwd, isAr)
        afterFormatted = fmtKwd(pt.afterPocketKwd, isAr)
        diffFormatted = fmtSignedKwd(pt.afterPocketKwd - pt.beforePocketKwd, isAr)
      } else if (chartMetric === 'orders') {
        before = pt.beforeOrders
        after = pt.afterOrders
        beforeFormatted = `${f0(pt.beforeOrders)} ${isAr ? 'طلب' : 'orders'}`
        afterFormatted = `${f0(pt.afterOrders)} ${isAr ? 'طلب' : 'orders'}`
        const dOrd = pt.afterOrders - pt.beforeOrders
        diffFormatted = `${dOrd > 0 ? '+' : ''}${f0(dOrd)} ${isAr ? 'طلب' : 'orders'} (${salesDiffKwd})`
      } else if (chartMetric === 'aov') {
        before = pt.beforeAovKwd
        after = pt.afterAovKwd
        beforeFormatted = fmtKwd(pt.beforeAovKwd, isAr, 2)
        afterFormatted = fmtKwd(pt.afterAovKwd, isAr, 2)
        diffFormatted = fmtSignedKwd(pt.afterAovKwd - pt.beforeAovKwd, isAr, 2)
      } else if (chartMetric === 'expenses') {
        before = pt.beforeExpensesKwd
        after = pt.afterExpensesKwd
        beforeFormatted = fmtKwd(pt.beforeExpensesKwd, isAr)
        afterFormatted = fmtKwd(pt.afterExpensesKwd, isAr)
        diffFormatted = fmtSignedKwd(pt.afterExpensesKwd - pt.beforeExpensesKwd, isAr)
        higherIsBetter = false
      }

      const pct = before > 0 ? ((after - before) / before) * 100 : after > 0 ? 100 : 0

      return {
        id: pt.id,
        label: isAr ? pt.labelAr : pt.labelEn,
        tooltipTitle: isAr ? pt.tooltipTitleAr : pt.tooltipTitleEn,
        before,
        after,
        beforeFormatted,
        afterFormatted,
        diffFormatted,
        pctFormatted: fmtSignedPct(pct),
        higherIsBetter,
        extraLines:
          chartMetric === 'orders'
            ? [
                {
                  label: isAr ? 'فرق المبيعات:' : 'Sales Diff:',
                  value: salesDiffKwd,
                  tone: pt.afterSalesKwd >= pt.beforeSalesKwd ? 'emerald' : 'rose',
                  bold: true,
                },
              ]
            : [
                {
                  label: isAr ? 'الطلبات (قبل ← بعد):' : 'Orders (Before → After):',
                  value: `${f0(pt.beforeOrders)} → ${f0(pt.afterOrders)}`,
                  tone: 'slate',
                },
              ],
      }
    })
  }, [chartGrouping, chartMetric, isAr, snap.branchPoints, snap.timelinePoints])

  const summaryCards = [
    {
      id: 'sales',
      titleAr: 'المبيعات (قبل ← بعد)',
      titleEn: 'Sales (Before → After)',
      beforeStr: fmtKwd(snap.summary.sales.before, isAr),
      afterStr: fmtKwd(snap.summary.sales.after, isAr),
      diffStr: fmtSignedKwd(snap.summary.sales.diff, isAr),
      pct: snap.summary.sales.pct,
      good: snap.summary.sales.diff >= 0,
    },
    {
      id: 'pocket',
      titleAr: 'الصافي بالجيب (قبل ← بعد)',
      titleEn: 'Net in Pocket (Before → After)',
      beforeStr: fmtKwd(snap.summary.pocket.before, isAr),
      afterStr: fmtKwd(snap.summary.pocket.after, isAr),
      diffStr: fmtSignedKwd(snap.summary.pocket.diff, isAr),
      pct: snap.summary.pocket.pct,
      good: snap.summary.pocket.diff >= 0,
    },
    {
      id: 'orders',
      titleAr: 'عدد الطلبات (قبل ← بعد)',
      titleEn: 'Orders (Before → After)',
      beforeStr: f0(snap.summary.orders.before),
      afterStr: f0(snap.summary.orders.after),
      diffStr: `${snap.summary.orders.diff > 0 ? '+' : ''}${f0(snap.summary.orders.diff)} ${isAr ? 'طلب' : 'orders'}`,
      pct: snap.summary.orders.pct,
      good: snap.summary.orders.diff >= 0,
    },
    {
      id: 'aov',
      titleAr: 'متوسط الفاتورة (قبل ← بعد)',
      titleEn: 'Avg Bill (Before → After)',
      beforeStr: fmtKwd(snap.summary.aov.before, isAr, 2),
      afterStr: fmtKwd(snap.summary.aov.after, isAr, 2),
      diffStr: fmtSignedKwd(snap.summary.aov.diff, isAr, 2),
      pct: snap.summary.aov.pct,
      good: snap.summary.aov.diff >= 0,
    },
  ]

  const renderSectionTable = (titleAr: string, titleEn: string, rows: ComparisonTableRow[]) => (
    <div className="space-y-2.5">
      <h3 className="text-[14.5px] font-extrabold text-neutral-900 dark:text-white">
        {isAr ? titleAr : titleEn}
      </h3>
      <div className="overflow-x-auto rounded-2xl ring-1 ring-neutral-950/[0.05] dark:ring-white/10">
        <table className="w-full min-w-[780px] border-collapse bg-white text-[13px] dark:bg-[#0D1320]">
          <thead className="bg-[#F7F7F8] text-neutral-600 dark:bg-slate-900/80 dark:text-slate-300">
            <tr>
              <th className="px-4 py-2.5 text-start text-[12px] font-bold">{T('Item', 'البند')}</th>
              <th className="px-4 py-2.5 text-end text-[12px] font-bold">{T('Sales Before', 'المبيعات قبل')}</th>
              <th className="px-4 py-2.5 text-end text-[12px] font-bold">{T('Sales After', 'المبيعات بعد')}</th>
              <th className="px-4 py-2.5 text-end text-[12px] font-bold">{T('Diff (KWD)', 'الفرق (د.ك)')}</th>
              <th className="px-4 py-2.5 text-center text-[12px] font-bold">{T('Change %', 'التغير %')}</th>
              <th className="px-4 py-2.5 text-end text-[12px] font-bold">{T('Orders (Before → After)', 'الطلبات (قبل ← بعد)')}</th>
              <th className="px-4 py-2.5 text-end text-[12px] font-bold">{T('Net Pocket (Before → After)', 'الصافي بالجيب (قبل ← بعد)')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.06]">
            {rows.map((r) => {
              const up = r.diffSalesKwd >= 0
              return (
                <tr key={r.id} className="transition-colors duration-150 hover:bg-neutral-50/80 dark:hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-bold text-neutral-950 whitespace-nowrap dark:text-white">
                    {isAr ? r.nameAr : r.nameEn}
                  </td>
                  <td dir="ltr" className="px-4 py-3 text-end font-medium tabular-nums text-neutral-500 whitespace-nowrap dark:text-slate-400">
                    {fmtKwd(r.beforeSalesKwd, isAr)}
                  </td>
                  <td dir="ltr" className="px-4 py-3 text-end font-extrabold tabular-nums text-neutral-950 whitespace-nowrap dark:text-white">
                    {fmtKwd(r.afterSalesKwd, isAr)}
                  </td>
                  <td
                    dir="ltr"
                    className={`px-4 py-3 text-end font-extrabold tabular-nums whitespace-nowrap ${
                      up ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {fmtSignedKwd(r.diffSalesKwd, isAr)}
                  </td>
                  <td dir="ltr" className="px-4 py-3 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold tabular-nums ${
                        up
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {fmtSignedPct(r.pctSales)}
                    </span>
                  </td>
                  <td dir="ltr" className="px-4 py-3 text-end font-semibold tabular-nums text-neutral-700 whitespace-nowrap dark:text-slate-200">
                    {f0(r.beforeOrders)} → {f0(r.afterOrders)}
                  </td>
                  <td dir="ltr" className="px-4 py-3 text-end font-bold tabular-nums text-emerald-800 whitespace-nowrap dark:text-emerald-300">
                    {fmtKwd(r.beforePocketKwd, isAr)} → {fmtKwd(r.afterPocketKwd, isAr)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-[1540px] space-y-6 pb-12">
      {/* Masthead + Comparison Mode Selector */}
      <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] lg:flex-row lg:items-center lg:justify-between dark:bg-[#0F1626] dark:ring-white/[0.07]">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>
              {isAr ? `${snap.beforeLabelAr}  ←  ${snap.afterLabelAr}` : `${snap.beforeLabelEn}  →  ${snap.afterLabelEn}`}
            </span>
          </div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-neutral-950 sm:text-[28px] dark:text-white">
            {T('Before & After', 'مقارنة قبل وبعد')}
          </h1>
          <p className="text-[13.5px] font-medium text-neutral-500 dark:text-slate-400">
            {isAr ? workspace.subtitleAr : workspace.subtitleEn}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-[#F7F7F8] p-1 ring-1 ring-neutral-950/[0.04] dark:bg-white/[0.05] dark:ring-white/[0.08]">
            <button
              type="button"
              onClick={() => setMode('period-prev')}
              className={`rounded-full px-3.5 py-2 text-[12.5px] font-bold transition duration-150 ${
                mode === 'period-prev'
                  ? 'bg-neutral-950 text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-white dark:text-neutral-950'
                  : 'text-neutral-600 hover:text-neutral-950 dark:text-slate-300'
              }`}
            >
              {periodModeLabel}
            </button>

            {filters.period === 'today' ? (
              <button
                type="button"
                onClick={() => setMode('today-lastweek')}
                className={`rounded-full px-3.5 py-2 text-[12.5px] font-bold transition duration-150 ${
                  mode === 'today-lastweek'
                    ? 'bg-neutral-950 text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-white dark:text-neutral-950'
                    : 'text-neutral-600 hover:text-neutral-950 dark:text-slate-300'
                }`}
              >
                {T('Same Day Last Week', 'نفس اليوم الأسبوع الماضي')}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setMode('decision-campaign')}
              className={`rounded-full px-3.5 py-2 text-[12.5px] font-bold transition duration-150 ${
                mode === 'decision-campaign'
                  ? 'bg-neutral-950 text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-white dark:text-neutral-950'
                  : 'text-neutral-600 hover:text-neutral-950 dark:text-slate-300'
              }`}
            >
              {T('Before & After Campaign / Play', 'مقارنة قبل وبعد قرار أو حملة معتمدة')}
            </button>
          </div>

          {mode === 'decision-campaign' ? (
            <select
              value={snap.activeEvent?.id ?? ''}
              onChange={(e) => setSelectedEventId(e.target.value)}
              aria-label={T('Select approved play or campaign', 'اختر قرار أو حملة معتمدة')}
              className="h-10 max-w-full rounded-full bg-white px-4 text-[12.5px] font-bold text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-900/80 focus:outline-none dark:bg-[#0F1626] dark:text-white dark:ring-white/60"
            >
              {snap.eventOptions.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {isAr ? ev.labelAr : ev.labelEn}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </header>

      {/* 4 Simple Summary Cards (tabular-nums) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.07]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold text-neutral-600 dark:text-slate-300">
                {isAr ? c.titleAr : c.titleEn}
              </span>
              <span
                dir="ltr"
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold tabular-nums ${
                  c.good
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                }`}
              >
                {c.good ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {fmtSignedPct(c.pct)}
              </span>
            </div>

            <div dir="ltr" className="mt-3 flex items-baseline justify-between gap-2">
              <div className="text-[13px] font-semibold tabular-nums text-neutral-400 dark:text-slate-400">
                <span className="block text-[10.5px] font-bold uppercase">{T('Before', 'قبل')}</span>
                {c.beforeStr}
              </div>
              <span className="text-neutral-300 dark:text-slate-600">→</span>
              <div className="text-end text-[22px] font-extrabold tabular-nums text-neutral-950 dark:text-white">
                <span className="block text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">
                  {T('After', 'بعد')}
                </span>
                {c.afterStr}
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-neutral-100 pt-2 text-[12.5px] dark:border-white/[0.06]">
              <span className="font-medium text-neutral-500 dark:text-slate-400">{T('Difference:', 'الفرق:')}</span>
              <span
                dir="ltr"
                className={`font-extrabold tabular-nums ${
                  c.good ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {c.diffStr}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Interactive Dual Chart with Rich Hover Numbers */}
      <section className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] space-y-5 dark:bg-[#0F1626] dark:ring-white/[0.07]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* 5 Metric Switcher Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['sales', T('Sales', 'المبيعات')],
                ['pocket', T('Net in Pocket', 'الصافي بالجيب')],
                ['orders', T('Orders', 'الطلبات')],
                ['aov', T('Avg Bill', 'متوسط الفاتورة')],
                ['expenses', T('Expenses', 'المصاريف')],
              ] as const
            ).map(([key, label]) => {
              const active = chartMetric === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setChartMetric(key)}
                  className={`rounded-full px-4 py-2 text-[13px] font-bold transition duration-150 ${
                    active
                      ? 'bg-neutral-950 text-white ring-1 ring-neutral-900/80 dark:bg-white dark:text-neutral-950'
                      : 'bg-[#F7F7F8] text-neutral-700 hover:bg-neutral-200/70 dark:bg-white/[0.06] dark:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Grouping Toggle: Timeline vs Branches */}
          <div className="inline-flex items-center gap-1 rounded-full bg-[#F7F7F8] p-1 dark:bg-white/[0.05]">
            <button
              type="button"
              onClick={() => setChartGrouping('timeline')}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition duration-150 ${
                chartGrouping === 'timeline'
                  ? 'bg-white text-neutral-950 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-neutral-600 dark:text-slate-300'
              }`}
            >
              {T('By Date / Time', 'حسب التاريخ')}
            </button>
            <button
              type="button"
              onClick={() => setChartGrouping('branches')}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition duration-150 ${
                chartGrouping === 'branches'
                  ? 'bg-white text-neutral-950 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-neutral-600 dark:text-slate-300'
              }`}
            >
              {T('By Branch', 'حسب الفروع')}
            </button>
          </div>
        </div>

        <BeforeAfterDualBarChart
          data={chartData}
          isAr={isAr}
          beforeLegend={`${T('Before', 'قبل')} (${isAr ? snap.beforeLabelAr : snap.beforeLabelEn})`}
          afterLegend={`${T('After', 'بعد')} (${isAr ? snap.afterLabelAr : snap.afterLabelEn})`}
          formatAxisValue={
            chartMetric === 'aov'
              ? (v) => v.toFixed(1)
              : (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toLocaleString('en-US'))
          }
        />
      </section>

      {/* Simple Comparison Tables Underneath: Brand, Branch, Channel */}
      <section className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] space-y-5 dark:bg-[#0F1626] dark:ring-white/[0.07]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[18px] font-extrabold text-neutral-950 dark:text-white">
            {T('Detailed Before vs After Table', 'جدول مقارنة قبل وبعد التفصيلي')}
          </h2>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['all', T('Show All', 'عرض الكل')],
                ['brands', T('By Brand', 'حسب المطعم')],
                ['branches', T('By Branch', 'حسب الفرع')],
                ['channels', T('By Channel', 'حسب القناة')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTableTab(id)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition duration-150 ${
                  tableTab === id
                    ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                    : 'bg-[#F7F7F8] text-neutral-700 hover:bg-neutral-200/70 dark:bg-white/[0.06] dark:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {(tableTab === 'all' || tableTab === 'brands') &&
            renderSectionTable('حسب المطعم (براندات فنتشر فودز المعتمدة)', 'By Venture Foods Brand', snap.byBrandRows)}
          {(tableTab === 'all' || tableTab === 'branches') &&
            renderSectionTable('حسب الفرع الفعلي', 'By Active Branch', snap.byBranchRows)}
          {(tableTab === 'all' || tableTab === 'channels') &&
            renderSectionTable('حسب قناة البيع والتوصيل', 'By Sales & Delivery Channel', snap.byChannelRows)}
        </div>
      </section>
    </div>
  )
}
