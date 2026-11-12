'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Lightbulb,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  InteractiveDonutChart,
  InteractiveHoverBarChart,
  type DonutSliceDatum,
  type MultiSeriesBarDatum,
} from '@/components/aether/InteractiveHoverCharts'
import { OdooAuditCertificatePill } from '@/components/aether/OdooAuditCertificateModal'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import type { SummaryCardData } from '@/lib/aether/global-filter-engine'
import { useLang } from '@/components/aether/ui'

interface EmeraldPillOption<K extends string> {
  id: K
  label: string
  icon?: ReactNode
  badge?: string | number
}

function EmeraldPillTabs<K extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
}: {
  options: readonly EmeraldPillOption<K>[]
  value: K
  onChange: (next: K) => void
  ariaLabel?: string
  size?: 'sm' | 'md'
}) {
  const btnPadding =
    size === 'sm'
      ? 'px-3 py-1.5 text-[12.5px]'
      : 'px-3.5 py-2 text-[13px]'

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-1 rounded-2xl bg-neutral-100/90 ring-1 ring-slate-900/[0.04] select-none dark:bg-white/[0.06] dark:ring-emerald-500/10"
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
            className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-medium transition-all duration-150 focus:outline-none ${btnPadding} ${
              active
                ? 'btn-colored bg-emerald-600 font-semibold text-white shadow-sm dark:bg-emerald-500 dark:text-[#04130D]'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
            }`}
          >
            {opt.icon ? <span className="shrink-0">{opt.icon}</span> : null}
            <span>{opt.label}</span>
            {opt.badge !== undefined ? (
              <span
                className={`rounded-lg px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
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

type FlowGroup = 'timeline' | 'branches'

const ACCENT_RING: Record<SummaryCardData['accent'], string> = {
  emerald: 'text-emerald-700 dark:text-emerald-400',
  sky: 'text-sky-700 dark:text-sky-400',
  amber: 'text-amber-700 dark:text-amber-400',
  rose: 'text-rose-700 dark:text-rose-400',
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

/** ملخص الشركة — Pure Single-View Executive Financial Cockpit */
export function FullJourney360() {
  const { isAr, T } = useLang()
  const { workspace, filters, liveSummary } = useGlobalFilter()

  const [flowGroup, setFlowGroup] = useState<FlowGroup>('timeline')
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    document.documentElement.dataset.erpSubtab = 'summary'
    window.dispatchEvent(new CustomEvent('aether:erp-subtab', { detail: 'summary' }))
  }, [])

  const refreshLive = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await fetch(`/api/odoo-sync?period=${encodeURIComponent(filters.period)}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (res.ok) {
        const d = await res.json()
        window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: d }))
      }
    } catch {
      // silent fallback
    } finally {
      setSyncing(false)
    }
  }, [filters.period])

  // 10-KWD breakdown & derived executive KPIs
  const { food10, delivery10, opexRent10, netPocket10 } = workspace.per10
  const beforeRentRatio = Math.max(0, (10 - food10 - delivery10) / 10)
  const netPocketRatio = Math.max(0, netPocket10 / 10)
  const beforeRentKwd = workspace.salesKwd * beforeRentRatio
  const netPocketKwd = workspace.salesKwd * netPocketRatio
  const netPocketPct = netPocket10 * 10

  const fmtKwdVal = useCallback(
    (v: number) => {
      const num = v >= 100 ? f0(v) : f1(v)
      return isAr ? `${num} د.ك` : `${num} KWD`
    },
    [isAr],
  )

  // Live daily & branch cash-flow capsule series from cores engine
  const coresSnap = useMemo(
    () => computeCoresHubSnapshot(filters, [], liveSummary),
    [filters, liveSummary],
  )

  const cashFlowBars = useMemo<MultiSeriesBarDatum[]>(() => {
    const src = flowGroup === 'branches' ? coresSnap.sales.branchRanking : coresSnap.sales.timeline
    return src.map((pt) => {
      const sales = Math.max(0, pt.salesKwd)
      const pocket = Math.max(0, sales * netPocketRatio)
      const beforeRent = Math.max(0, sales * beforeRentRatio)
      const foodAndDelivery = Math.max(0, sales - beforeRent)
      return {
        id: pt.id,
        label: isAr ? pt.labelAr : pt.labelEn,
        tooltipTitle: isAr ? pt.tooltipTitleAr : pt.tooltipTitleEn,
        primaryValue: sales,
        secondaryValue: pocket,
        badgeText: `${f1(netPocketPct)}%`,
        badgeTone: netPocketPct >= 12 ? 'emerald' : 'amber',
        primaryColor: '#334155',
        secondaryColor: '#10B981',
        lines: [
          { label: isAr ? 'المبيعات:' : 'Sales:', value: fmtKwdVal(sales), bold: true },
          { label: isAr ? 'الأكل والتوصيل:' : 'Food & Delivery:', value: fmtKwdVal(foodAndDelivery), tone: 'amber' },
          { label: isAr ? 'الباقي قبل الإيجار:' : 'Before Rent:', value: fmtKwdVal(beforeRent), tone: 'slate' },
          { label: isAr ? 'الصافي بالجيب:' : 'Net in Pocket:', value: fmtKwdVal(pocket), tone: 'emerald', bold: true },
        ],
      }
    })
  }, [beforeRentRatio, coresSnap.sales.branchRanking, coresSnap.sales.timeline, flowGroup, fmtKwdVal, isAr, netPocketPct, netPocketRatio])

  const tenKwdDonutSlices = useMemo<DonutSliceDatum[]>(
    () => [
      {
        id: 'food',
        label: isAr ? 'تكلفة الأكل' : 'Food Cost',
        value: food10,
        valueFormatted: isAr ? `${f2(food10)} د.ك` : `${f2(food10)} KWD`,
        pctFormatted: `${f1(food10 * 10)}%`,
        color: '#F59E0B',
      },
      {
        id: 'delivery',
        label: isAr ? 'عمولة التوصيل' : 'Delivery Fee',
        value: delivery10,
        valueFormatted: isAr ? `${f2(delivery10)} د.ك` : `${f2(delivery10)} KWD`,
        pctFormatted: `${f1(delivery10 * 10)}%`,
        color: '#F43F5E',
      },
      {
        id: 'opex',
        label: isAr ? 'الإيجار والرواتب' : 'Rent & Payroll',
        value: opexRent10,
        valueFormatted: isAr ? `${f2(opexRent10)} د.ك` : `${f2(opexRent10)} KWD`,
        pctFormatted: `${f1(opexRent10 * 10)}%`,
        color: '#64748B',
      },
      {
        id: 'pocket',
        label: isAr ? 'الصافي بالجيب' : 'Net in Pocket',
        value: netPocket10,
        valueFormatted: isAr ? `${f2(netPocket10)} د.ك` : `${f2(netPocket10)} KWD`,
        pctFormatted: `${f1(netPocket10 * 10)}%`,
        color: '#10B981',
      },
    ],
    [delivery10, food10, isAr, netPocket10, opexRent10],
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-4 sm:space-y-5 pb-12">
      {/* Slim Executive Context & Action Bar (Title rendered once globally in TopFilterBar) */}
      <div className="ae-bento-card flex flex-col gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:bg-[#101C17] dark:ring-emerald-500/10">
        <p className="min-w-0 truncate text-[13px] sm:text-[14px] font-medium text-slate-600 dark:text-slate-300">
          {isAr ? workspace.subtitleAr : workspace.subtitleEn}
        </p>

        <div className="flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="shrink-0">
            <OdooAuditCertificatePill isAr={isAr} />
          </div>

          <Link
            href="/erp/before-after"
            className="ae-bento-subcard inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-[13px] font-semibold text-slate-700 transition-colors duration-150 hover:text-emerald-700 dark:text-slate-200 dark:hover:text-emerald-300"
          >
            <span>{T('Decision Impact (Before & After) ↗', 'أثر القرارات (قبل وبعد) ↗')}</span>
          </Link>

          <button
            type="button"
            onClick={() => void refreshLive()}
            disabled={syncing}
            aria-label={T('Refresh', 'تحديث')}
            title={T('Refresh Odoo Data', 'تحديث أرقام أودو')}
            className="ae-bento-subcard inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-700 transition-all duration-150 hover:text-slate-950 disabled:opacity-50 dark:text-slate-200"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <section className="space-y-4 sm:space-y-5">
        {/* Top Row: 4 Crisp Financial KPIs (2x2 on Mobile, 4-col on Desktop) */}
        <div className="ae-stagger grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* KPI 1: المبيعات */}
          <article className="ae-kpi-card ae-glow-emerald min-w-0 rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
            <div className="flex items-center justify-between gap-1.5">
              <span className="ae-icon-badge !h-8 !w-8 sm:!h-9 sm:!w-9">
                <Wallet className="h-4 w-4" />
              </span>
              <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] sm:text-[12px] font-bold tabular-nums text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {f0(workspace.orders)} {T('orders', 'طلب')}
              </span>
            </div>
            <p className="mt-2.5 sm:mt-3.5 truncate text-[12.5px] sm:text-[14px] font-semibold text-slate-500 dark:text-slate-400">
              {T('Sales', 'المبيعات')}
            </p>
            <div
              dir="ltr"
              className="mt-1 truncate text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-white"
            >
              {fmtKwdVal(workspace.salesKwd)}
            </div>
            <p className="mt-1 truncate text-[11.5px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400">
              {isAr ? `متوسط الفاتورة ${f2(workspace.aovKwd)} د.ك` : `Avg bill ${f2(workspace.aovKwd)} KWD`}
            </p>
          </article>

          {/* KPI 2: الباقي قبل الإيجار */}
          <article className="ae-kpi-card ae-glow-sky min-w-0 rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
            <div className="flex items-center justify-between gap-1.5">
              <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
                <TrendingUp className="h-4 w-4" />
              </span>
              <span
                dir="ltr"
                className="shrink-0 rounded-lg bg-sky-50 px-2 py-0.5 text-[11px] sm:text-[12px] font-bold tabular-nums text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
              >
                {f1(beforeRentRatio * 100)}%
              </span>
            </div>
            <p className="mt-2.5 sm:mt-3.5 truncate text-[12.5px] sm:text-[14px] font-semibold text-slate-500 dark:text-slate-400">
              {T('Left Before Rent', 'الباقي قبل الإيجار')}
            </p>
            <div
              dir="ltr"
              className="mt-1 truncate text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-white"
            >
              {fmtKwdVal(beforeRentKwd)}
            </div>
            <p className="mt-1 line-clamp-1 text-[11.5px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400">
              {isAr ? 'بعد خصم الأكل وعمولة التوصيل' : 'After food & delivery fees'}
            </p>
          </article>

          {/* KPI 3: الصافي بالجيب */}
          <article className="ae-kpi-card ae-glow-emerald min-w-0 rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
            <div className="flex items-center justify-between gap-1.5">
              <span className="ae-icon-badge !h-8 !w-8 sm:!h-9 sm:!w-9">
                <Sparkles className="h-4 w-4" />
              </span>
              <span
                dir="ltr"
                className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] sm:text-[12px] font-bold tabular-nums ${
                  netPocketPct >= 12
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                }`}
              >
                {f1(netPocketPct)}%
              </span>
            </div>
            <p className="mt-2.5 sm:mt-3.5 truncate text-[12.5px] sm:text-[14px] font-semibold text-slate-500 dark:text-slate-400">
              {T('Net in Pocket', 'الصافي بالجيب')}
            </p>
            <div
              dir="ltr"
              className="mt-1 truncate text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
            >
              {fmtKwdVal(netPocketKwd)}
            </div>
            <p className="mt-1 line-clamp-1 text-[11.5px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400">
              {isAr ? 'الصافي الفعلي بعد الإيجار وكل المصاريف' : 'Actual net cash after rent & all bills'}
            </p>
          </article>

          {/* KPI 4: فرص زيادة الربح -> Canonical Direct Link to /erp/planning */}
          <Link
            href="/erp/planning"
            className="ae-kpi-card ae-glow-amber block min-w-0 rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] transition-transform duration-150 hover:-translate-y-0.5 dark:bg-[#101C17] dark:ring-emerald-500/10"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                <Lightbulb className="h-4 w-4" />
              </span>
              <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] sm:text-[12px] font-bold tabular-nums text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {workspace.plays.length} {T('plays', 'فرصة')}
              </span>
            </div>
            <p className="mt-2.5 sm:mt-3.5 truncate text-[12.5px] sm:text-[14px] font-semibold text-slate-500 dark:text-slate-400">
              {T('Profit Opportunities', 'فرص زيادة الربح')}
            </p>
            <div
              dir="ltr"
              className="mt-1 truncate text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
            >
              +{fmtKwdVal(workspace.totalPlaysBenefitPeriodKwd)}
            </div>
            <p className="mt-1 inline-flex items-center gap-1 text-[12px] sm:text-[13.5px] font-bold text-emerald-700 dark:text-emerald-300">
              <span>{T('View Steps ↗', 'عرض الخطوات ↗')}</span>
            </p>
          </Link>
        </div>

        {/* Middle Bento Row: 8-Col Visual Cash-Flow Chart + 4-Col Interactive 10-KWD Donut */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
          {/* 8-Col Card: Interactive Cash-Flow & Net Performance Capsule Chart */}
          <div
            id="cash-flow-chart-card"
            className="ae-bento-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10 lg:col-span-8"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-[17px] sm:text-[18px] font-bold tracking-tight text-slate-950 dark:text-white">
                  {T('Sales & Net Cash Flow', 'المبيعات والصافي بالجيب')}
                </h2>
                <p className="text-[13px] sm:text-[14px] font-medium text-slate-500 dark:text-slate-400">
                  {T(
                    'Hover any capsule bar to inspect exact sales, costs, and net pocket cash',
                    'مرّر الماوس على أي عمود لمعرفة المبيعات والمصاريف والصافي بالجيب بدقة',
                  )}
                </p>
              </div>

              <EmeraldPillTabs<FlowGroup>
                size="sm"
                value={flowGroup}
                onChange={setFlowGroup}
                options={[
                  { id: 'timeline', label: T('Timeline', 'حسب الفترة') },
                  { id: 'branches', label: T('Branches', 'حسب الفروع') },
                ]}
              />
            </div>

            <InteractiveHoverBarChart
              data={cashFlowBars}
              isAr={isAr}
              primaryLegend={T('Sales', 'المبيعات')}
              secondaryLegend={T('Net in Pocket', 'الصافي بالجيب')}
              primaryColor="#334155"
              secondaryColor="#10B981"
              heightClass="h-64"
            />
          </div>

          {/* 4-Col Card: Interactive Donut Ring ("وين تروح كل ١٠ دنانير؟") */}
          <div className="ae-bento-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10 lg:col-span-4">
            <div className="mb-3">
              <h2 className="text-[17px] sm:text-[18px] font-bold tracking-tight text-slate-950 dark:text-white">
                {T('Where Every 10 KWD Goes?', 'وين تروح كل ١٠ دنانير؟')}
              </h2>
              <p className="text-[13px] sm:text-[14px] font-medium text-slate-500 dark:text-slate-400">
                {T('Per 10 KWD of sales', 'توزيعة كل ١٠ دنانير مبيعات')}
              </p>
            </div>

            <InteractiveDonutChart
              slices={tenKwdDonutSlices}
              centerValue={isAr ? `${f2(netPocket10)} د.ك` : `${f2(netPocket10)} KWD`}
              centerSubValue={T('per 10 KWD', 'من كل ١٠ د.ك')}
              centerLabel={T('Net Share', 'نصيب الصافي')}
              isAr={isAr}
              legendColumns={2}
            />
          </div>
        </div>

        {/* Non-Redundant 3 × 2 (6-Card) Executive Module Jump Cards -> Direct Canonical Links */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {workspace.summaryCards.map((c) => (
            <article
              key={c.id}
              className="ae-kpi-card flex min-h-[180px] sm:min-h-[192px] flex-col justify-between rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10"
            >
              <div className="space-y-2">
                <h3 className="text-[15px] sm:text-[15.5px] font-bold text-slate-800 dark:text-slate-100">
                  {isAr ? c.titleAr : c.titleEn}
                </h3>
                <div
                  className={`text-2xl sm:text-[28px] font-semibold tracking-tight tabular-nums ${ACCENT_RING[c.accent]}`}
                >
                  {isAr ? c.valueAr : c.valueEn}
                </div>
                <p className="text-[13.5px] sm:text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {isAr ? c.descAr : c.descEn}
                </p>
              </div>

              <div className="mt-4 sm:mt-5 flex items-center justify-end">
                <Link
                  href={c.href}
                  className="ae-bento-subcard inline-flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-[13px] font-semibold text-slate-800 transition-colors duration-150 hover:text-emerald-700 dark:text-slate-100 dark:hover:text-emerald-300"
                >
                  <span>{isAr ? c.ctaAr : c.ctaEn}</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
