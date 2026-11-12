'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  Download,
  Printer,
  Receipt,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  BeforeAfterDualBarChart,
  InteractiveDonutChart,
  type DonutSliceDatum,
  type DualBarDatum,
} from '@/components/aether/InteractiveHoverCharts'
import { SlidingPillTabs } from '@/components/ui/SlidingPillTabs'
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

const DONUT_PALETTE = ['#10B981', '#0EA5E9', '#F59E0B', '#64748B']

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
    if (filters.period === 'today') return T('Today vs Yesterday', 'اليوم مقابل أمس')
    if (filters.period === 'week') return T('This Week vs Prior', 'هذا الأسبوع مقابل السابق')
    if (filters.period === 'year') return T('This Year vs Prior', 'هذه السنة مقابل السابق')
    return T('This Month vs Prior', 'هذا الشهر مقابل السابق')
  }, [T, filters.period])

  const modeOptions = useMemo(() => {
    const opts: { id: ComparisonMode; label: string }[] = [
      { id: 'period-prev', label: periodModeLabel },
    ]
    if (filters.period === 'today') {
      opts.push({
        id: 'today-lastweek',
        label: T('Same Day Last Week', 'نفس اليوم الأسبوع الماضي'),
      })
    }
    opts.push({
      id: 'decision-campaign',
      label: T('Campaign / Play', 'قبل وبعد قرار أو حملة'),
    })
    return opts
  }, [T, filters.period, periodModeLabel])

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

  // 4-Col Net Gain Donut Breakdown (by active Branches when Brand filtered, otherwise top active Brands)
  const netGainDonutSlices = useMemo<DonutSliceDatum[]>(() => {
    const sourceRows = filters.brand !== 'all' ? snap.byBranchRows : snap.byBrandRows
    const sorted = [...sourceRows].sort((a, b) => b.afterPocketKwd - a.afterPocketKwd)
    const top3 = sorted.slice(0, 3)
    const rest = sorted.slice(3)
    const totalAfterPocket = Math.max(1, sorted.reduce((acc, r) => acc + Math.max(0, r.afterPocketKwd), 0))

    const items: DonutSliceDatum[] = top3.map((r, i) => {
      const val = Math.max(0, r.afterPocketKwd)
      const share = (val / totalAfterPocket) * 100
      return {
        id: r.id,
        label: isAr ? r.nameAr : r.nameEn,
        subLabel: fmtSignedKwd(r.afterPocketKwd - r.beforePocketKwd, isAr),
        value: val,
        valueFormatted: fmtKwd(val, isAr),
        pctFormatted: `${f1(share)}%`,
        color: DONUT_PALETTE[i % DONUT_PALETTE.length],
      }
    })

    if (rest.length > 0) {
      const restPocket = rest.reduce((acc, r) => acc + Math.max(0, r.afterPocketKwd), 0)
      const restDiff = rest.reduce((acc, r) => acc + (r.afterPocketKwd - r.beforePocketKwd), 0)
      if (restPocket > 0) {
        items.push({
          id: 'others',
          label: isAr ? 'باقي الفروع والمطاعم' : 'Other Locations',
          subLabel: fmtSignedKwd(restDiff, isAr),
          value: restPocket,
          valueFormatted: fmtKwd(restPocket, isAr),
          pctFormatted: `${f1((restPocket / totalAfterPocket) * 100)}%`,
          color: DONUT_PALETTE[3],
        })
      }
    }

    return items
  }, [filters.brand, isAr, snap.byBranchRows, snap.byBrandRows])

  // 1-Click CSV Export
  const handleExportCsv = useCallback(() => {
    const headers = [
      isAr ? 'التصنيف' : 'Group',
      isAr ? 'الاسم' : 'Item',
      isAr ? 'المبيعات قبل (د.ك)' : 'Sales Before (KWD)',
      isAr ? 'المبيعات بعد (د.ك)' : 'Sales After (KWD)',
      isAr ? 'الفرق (د.ك)' : 'Diff (KWD)',
      isAr ? 'التغير %' : 'Change %',
      isAr ? 'الطلبات قبل' : 'Orders Before',
      isAr ? 'الطلبات بعد' : 'Orders After',
      isAr ? 'الصافي قبل (د.ك)' : 'Net Pocket Before (KWD)',
      isAr ? 'الصافي بعد (د.ك)' : 'Net Pocket After (KWD)',
    ]
    const toLines = (groupLabel: string, rows: ComparisonTableRow[]) =>
      rows.map((r) =>
        [
          `"${groupLabel}"`,
          `"${(isAr ? r.nameAr : r.nameEn).replace(/"/g, '""')}"`,
          r.beforeSalesKwd.toFixed(2),
          r.afterSalesKwd.toFixed(2),
          r.diffSalesKwd.toFixed(2),
          `${r.pctSales.toFixed(1)}%`,
          Math.round(r.beforeOrders),
          Math.round(r.afterOrders),
          r.beforePocketKwd.toFixed(2),
          r.afterPocketKwd.toFixed(2),
        ].join(','),
      )

    const csvLines = [
      headers.join(','),
      ...toLines(isAr ? 'المطعم' : 'Brand', snap.byBrandRows),
      ...toLines(isAr ? 'الفرع' : 'Branch', snap.byBranchRows),
      ...toLines(isAr ? 'القناة' : 'Channel', snap.byChannelRows),
    ]
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aetherbi-before-after-${filters.period}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [filters.period, isAr, snap.byBranchRows, snap.byBrandRows, snap.byChannelRows])

  const summaryCards = [
    {
      id: 'sales',
      titleAr: 'المبيعات',
      titleEn: 'Sales',
      icon: Wallet,
      beforeStr: fmtKwd(snap.summary.sales.before, isAr),
      afterStr: fmtKwd(snap.summary.sales.after, isAr),
      diffStr: fmtSignedKwd(snap.summary.sales.diff, isAr),
      pct: snap.summary.sales.pct,
      good: snap.summary.sales.diff >= 0,
    },
    {
      id: 'pocket',
      titleAr: 'الصافي بالجيب',
      titleEn: 'Net in Pocket',
      icon: Sparkles,
      beforeStr: fmtKwd(snap.summary.pocket.before, isAr),
      afterStr: fmtKwd(snap.summary.pocket.after, isAr),
      diffStr: fmtSignedKwd(snap.summary.pocket.diff, isAr),
      pct: snap.summary.pocket.pct,
      good: snap.summary.pocket.diff >= 0,
    },
    {
      id: 'orders',
      titleAr: 'الطلبات',
      titleEn: 'Orders',
      icon: ShoppingBag,
      beforeStr: f0(snap.summary.orders.before),
      afterStr: f0(snap.summary.orders.after),
      diffStr: `${snap.summary.orders.diff > 0 ? '+' : ''}${f0(snap.summary.orders.diff)} ${isAr ? 'طلب' : 'orders'}`,
      pct: snap.summary.orders.pct,
      good: snap.summary.orders.diff >= 0,
    },
    {
      id: 'aov',
      titleAr: 'متوسط الفاتورة',
      titleEn: 'Average Bill',
      icon: Receipt,
      beforeStr: fmtKwd(snap.summary.aov.before, isAr, 2),
      afterStr: fmtKwd(snap.summary.aov.after, isAr, 2),
      diffStr: fmtSignedKwd(snap.summary.aov.diff, isAr, 2),
      pct: snap.summary.aov.pct,
      good: snap.summary.aov.diff >= 0,
    },
  ]

  const renderSectionTable = (titleAr: string, titleEn: string, rows: ComparisonTableRow[]) => (
    <div className="space-y-2.5">
      <h3 className="text-[14.5px] font-extrabold text-slate-900 dark:text-white">
        {isAr ? titleAr : titleEn}
      </h3>
      <div className="ae-table-wrap rounded-2xl ring-1 ring-slate-950/[0.04] dark:ring-white/[0.06]">
        <table className="w-full min-w-[780px] border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-[#F4F6F9] text-slate-600 dark:bg-[#0C141B] dark:text-slate-300">
            <tr>
              <th className="px-4 py-3 text-start text-[12px] font-bold">{T('Item', 'البند')}</th>
              <th className="px-4 py-3 text-end text-[12px] font-bold">{T('Sales Before', 'المبيعات قبل')}</th>
              <th className="px-4 py-3 text-end text-[12px] font-bold">{T('Sales After', 'المبيعات بعد')}</th>
              <th className="px-4 py-3 text-end text-[12px] font-bold">{T('Diff (KWD)', 'الفرق (د.ك)')}</th>
              <th className="px-4 py-3 text-center text-[12px] font-bold">{T('Change %', 'التغير %')}</th>
              <th className="px-4 py-3 text-end text-[12px] font-bold">
                {T('Orders (Before → After)', 'الطلبات (قبل ← بعد)')}
              </th>
              <th className="px-4 py-3 text-end text-[12px] font-bold">
                {T('Net Pocket (Before → After)', 'الصافي بالجيب (قبل ← بعد)')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {rows.map((r) => {
              const up = r.diffSalesKwd >= 0
              return (
                <tr
                  key={r.id}
                  className="transition-colors duration-150 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/[0.05]"
                >
                  <td className="px-4 py-3 font-bold whitespace-nowrap text-slate-950 dark:text-white">
                    {isAr ? r.nameAr : r.nameEn}
                  </td>
                  <td
                    dir="ltr"
                    className="px-4 py-3 text-end font-medium whitespace-nowrap tabular-nums text-slate-500 dark:text-slate-400"
                  >
                    {fmtKwd(r.beforeSalesKwd, isAr)}
                  </td>
                  <td
                    dir="ltr"
                    className="px-4 py-3 text-end font-extrabold whitespace-nowrap tabular-nums text-slate-950 dark:text-white"
                  >
                    {fmtKwd(r.afterSalesKwd, isAr)}
                  </td>
                  <td
                    dir="ltr"
                    className={`px-4 py-3 text-end font-extrabold whitespace-nowrap tabular-nums ${
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
                  <td
                    dir="ltr"
                    className="px-4 py-3 text-end font-semibold whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200"
                  >
                    {f0(r.beforeOrders)} → {f0(r.afterOrders)}
                  </td>
                  <td
                    dir="ltr"
                    className="px-4 py-3 text-end font-bold whitespace-nowrap tabular-nums text-emerald-800 dark:text-emerald-300"
                  >
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
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full space-y-5 pb-12">
      {/* Masthead + Sliding Comparison Mode + 1-Click Export CSV / Print */}
      <header className="ae-bento-card flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>
              {isAr ? `${snap.beforeLabelAr}  ←  ${snap.afterLabelAr}` : `${snap.beforeLabelEn}  →  ${snap.afterLabelEn}`}
            </span>
          </div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-slate-950 sm:text-[26px] dark:text-white">
            {T('Before & After', 'مقارنة قبل وبعد')}
          </h1>
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? workspace.subtitleAr : workspace.subtitleEn}
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <SlidingPillTabs<ComparisonMode>
            ariaLabel={T('Comparison Mode', 'نوع المقارنة')}
            size="sm"
            value={mode}
            onChange={setMode}
            options={modeOptions}
          />

          {mode === 'decision-campaign' ? (
            <select
              value={snap.activeEvent?.id ?? ''}
              onChange={(e) => setSelectedEventId(e.target.value)}
              aria-label={T('Select approved play or campaign', 'اختر قرار أو حملة معتمدة')}
              className="ae-select h-9"
            >
              {snap.eventOptions.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {isAr ? ev.labelAr : ev.labelEn}
                </option>
              ))}
            </select>
          ) : null}

          <button
            type="button"
            onClick={handleExportCsv}
            className="ae-bento-subcard inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[12px] font-bold text-slate-800 transition-all duration-150 hover:text-slate-950 active:scale-95 dark:text-slate-100"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{T('Export CSV', 'تحميل CSV')}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="ae-bento-subcard inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[12px] font-bold text-slate-800 transition-all duration-150 hover:text-slate-950 active:scale-95 dark:text-slate-100"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
            <span>{T('Print', 'طباعة')}</span>
          </button>
        </div>
      </header>

      {/* Top Row: 4 Before-vs-After KPI Cards (tabular-nums + + / - KWD & % pills) */}
      <section className="ae-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((c) => {
          const Icon = c.icon
          return (
            <article
              key={c.id}
              className={`ae-kpi-card p-5 ${c.good ? 'ae-glow-emerald' : 'ae-glow-rose'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="ae-icon-badge">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[13.5px] font-extrabold text-slate-800 dark:text-slate-100">
                    {isAr ? c.titleAr : c.titleEn}
                  </span>
                </div>
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

              <div dir="ltr" className="mt-3.5 flex items-baseline justify-between gap-2">
                <div className="text-[13px] font-semibold tabular-nums text-slate-400 dark:text-slate-400">
                  <span className="block text-[10.5px] font-bold uppercase">{T('Before', 'قبل')}</span>
                  {c.beforeStr}
                </div>
                <span className="text-slate-300 dark:text-slate-600">→</span>
                <div className="text-end text-[23px] font-black tracking-tight tabular-nums text-slate-950 dark:text-white">
                  <span className="block text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">
                    {T('After', 'بعد')}
                  </span>
                  {c.afterStr}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[12px] dark:border-white/[0.06]">
                <span className="font-semibold text-slate-500 dark:text-slate-400">
                  {T('Delta:', 'الفرق:')}
                </span>
                <span
                  dir="ltr"
                  className={`rounded-full px-2.5 py-0.5 font-extrabold tabular-nums ${
                    c.good
                      ? 'bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-rose-50/80 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
                  }`}
                >
                  {c.diffStr}
                </span>
              </div>
            </article>
          )
        })}
      </section>

      {/* Middle Bento Row: 8-Col Dual Capsule Chart + 4-Col Net Gain Donut Breakdown */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* 8-Col Card: Interactive Before vs After Dual Capsule Chart */}
        <div className="ae-bento-card flex flex-col justify-between space-y-4 p-5 sm:p-6 lg:col-span-8">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <SlidingPillTabs<ChartMetricKey>
              ariaLabel={T('Metric', 'المؤشر')}
              size="sm"
              value={chartMetric}
              onChange={setChartMetric}
              options={[
                { id: 'sales', label: T('Sales', 'المبيعات') },
                { id: 'pocket', label: T('Net Pocket', 'الصافي بالجيب') },
                { id: 'orders', label: T('Orders', 'الطلبات') },
                { id: 'aov', label: T('Avg Bill', 'متوسط الفاتورة') },
                { id: 'expenses', label: T('Expenses', 'المصاريف') },
              ]}
            />

            <SlidingPillTabs<ChartGroupingKey>
              ariaLabel={T('Grouping', 'التقسيم')}
              size="sm"
              value={chartGrouping}
              onChange={setChartGrouping}
              options={[
                { id: 'timeline', label: T('By Date', 'حسب التاريخ') },
                { id: 'branches', label: T('By Branch', 'حسب الفروع') },
              ]}
            />
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
            heightClass="h-64"
          />
        </div>

        {/* 4-Col Card: Net Pocket Gain & Share Donut Breakdown */}
        <div className="ae-bento-card flex flex-col justify-between p-5 sm:p-6 lg:col-span-4">
          <div className="mb-3">
            <h2 className="text-[17px] font-extrabold tracking-tight text-slate-950 dark:text-white">
              {T('Net Pocket Breakdown', 'توزيعة الصافي بعد')}
            </h2>
            <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
              {T('Share of post-period net cash & delta', 'مساهمة كل مطعم أو فرع في الصافي والفرق')}
            </p>
          </div>

          <InteractiveDonutChart
            slices={netGainDonutSlices}
            centerValue={netGainDonutSlices[0]?.pctFormatted ?? '—'}
            centerSubValue={netGainDonutSlices[0]?.valueFormatted ?? ''}
            centerLabel={netGainDonutSlices[0]?.label ?? T('Top Contributor', 'أعلى مساهمة')}
            isAr={isAr}
            legendColumns={1}
          />
        </div>
      </section>

      {/* Clean Comparison Table Underneath */}
      <section className="ae-bento-card space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[17.5px] font-extrabold text-slate-950 dark:text-white">
            {T('Before vs After Table', 'جدول مقارنة قبل وبعد')}
          </h2>

          <SlidingPillTabs<TableScopeTab>
            ariaLabel={T('Table Filter', 'تصفية الجدول')}
            size="sm"
            value={tableTab}
            onChange={setTableTab}
            options={[
              { id: 'all', label: T('Show All', 'عرض الكل') },
              { id: 'brands', label: T('By Brand', 'حسب المطعم') },
              { id: 'branches', label: T('By Branch', 'حسب الفرع') },
              { id: 'channels', label: T('By Channel', 'حسب القناة') },
            ]}
          />
        </div>

        <div className="space-y-6">
          {(tableTab === 'all' || tableTab === 'brands') &&
            renderSectionTable('حسب المطعم', 'By Brand', snap.byBrandRows)}
          {(tableTab === 'all' || tableTab === 'branches') &&
            renderSectionTable('حسب الفرع', 'By Branch', snap.byBranchRows)}
          {(tableTab === 'all' || tableTab === 'channels') &&
            renderSectionTable('حسب القناة', 'By Channel', snap.byChannelRows)}
        </div>
      </section>
    </div>
  )
}
