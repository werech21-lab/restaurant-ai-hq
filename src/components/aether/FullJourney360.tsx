'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
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
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import type { SummaryCardData } from '@/lib/aether/global-filter-engine'
import { useLang } from '@/components/aether/ui'

interface EmeraldPillOption<K extends string> {
  id: K
  label: string
  icon?: ReactNode
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
      ? 'h-8 px-3 text-[12.5px]'
      : 'h-9 px-3.5 py-1.5 text-[13px] sm:text-[13.5px]'

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap items-center gap-1 rounded-full bg-[#F1F5F9] p-1 ring-1 ring-slate-900/[0.06] select-none dark:bg-[#0C141B] dark:ring-white/[0.08]"
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
            className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full font-bold whitespace-nowrap transition-all duration-150 focus:outline-none ${btnPadding} ${
              active
                ? 'btn-colored bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-[#04130D]'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
            }`}
          >
            {opt.icon ? <span className="shrink-0">{opt.icon}</span> : null}
            <span>{opt.label}</span>
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

/**
 * ملخص الشركة (`/erp`) — Pure Single-View Executive Financial Cockpit.
 * Strictly zero Profit Tips or Before & After sub-tabs:
 *  1) Top 4 Financial KPIs (with clean module link to `/erp/cores?tab=marketing`)
 *  2) 8 + 4 Bento Split: Cash Flow Timeline / Branch Bar Chart + 10 KWD Breakdown Donut
 *  3) Compact 3 × 2 Executive Module Jump Cards linking directly to specialized ERP pages
 */
export function FullJourney360() {
  const { isAr, T } = useLang()
  const { workspace, filters, liveSummary } = useGlobalFilter()

  const [flowGroup, setFlowGroup] = useState<FlowGroup>('timeline')
  const [syncing, setSyncing] = useState(false)

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
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-5 pb-12">
      {/* Masthead: Pure Single-View Executive Cockpit Header */}
      <header className="ae-bento-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-[26px]">
            {T('Company Summary', 'ملخص الشركة')}
          </h1>
          <p className="text-[14px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? workspace.subtitleAr : workspace.subtitleEn}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/erp/before-after"
            className="ae-bento-subcard inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-bold text-slate-700 transition-colors duration-150 hover:text-emerald-700 dark:text-slate-200 dark:hover:text-emerald-300"
          >
            <span>{T('Decision Impact (Before & After) ↗', 'أثر القرارات (قبل وبعد) ↗')}</span>
          </Link>

          <button
            type="button"
            onClick={() => void refreshLive()}
            disabled={syncing}
            aria-label={T('Refresh', 'تحديث')}
            title={T('Refresh Odoo Data', 'تحديث أرقام أودو')}
            className="ae-bento-subcard inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-slate-700 transition-all duration-150 hover:text-slate-950 disabled:opacity-50 dark:text-slate-200"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Pure Single-View Executive Financial Cockpit */}
      <section className="space-y-5">
        {/* Top Row: 4 Crisp Financial KPIs */}
        <div className="ae-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* KPI 1: المبيعات */}
          <article className="ae-kpi-card ae-glow-emerald p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="ae-icon-badge">
                <Wallet className="h-4 w-4" />
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {f0(workspace.orders)} {T('orders', 'طلب')}
              </span>
            </div>
            <p className="mt-3.5 text-[14px] font-bold text-slate-500 dark:text-slate-400">
              {T('Sales', 'المبيعات')}
            </p>
            <div
              dir="ltr"
              className="mt-1 text-[28px] font-black tracking-tight tabular-nums text-slate-950 dark:text-white sm:text-[32px]"
            >
              {fmtKwdVal(workspace.salesKwd)}
            </div>
            <p className="mt-1 text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
              {isAr ? `متوسط الفاتورة ${f2(workspace.aovKwd)} د.ك` : `Avg bill ${f2(workspace.aovKwd)} KWD`}
            </p>
          </article>

          {/* KPI 2: الباقي قبل الإيجار */}
          <article className="ae-kpi-card ae-glow-sky p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
                <TrendingUp className="h-4 w-4" />
              </span>
              <span
                dir="ltr"
                className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
              >
                {f1(beforeRentRatio * 100)}%
              </span>
            </div>
            <p className="mt-3.5 text-[14px] font-bold text-slate-500 dark:text-slate-400">
              {T('Left Before Rent', 'الباقي قبل الإيجار')}
            </p>
            <div
              dir="ltr"
              className="mt-1 text-[28px] font-black tracking-tight tabular-nums text-slate-950 dark:text-white sm:text-[32px]"
            >
              {fmtKwdVal(beforeRentKwd)}
            </div>
            <p className="mt-1 text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
              {isAr ? 'بعد خصم الأكل وعمولة التوصيل' : 'After food & delivery fees'}
            </p>
          </article>

          {/* KPI 3: الصافي بالجيب */}
          <article className="ae-kpi-card ae-glow-emerald p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="ae-icon-badge">
                <Sparkles className="h-4 w-4" />
              </span>
              <span
                dir="ltr"
                className={`rounded-full px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums ${
                  netPocketPct >= 12
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                }`}
              >
                {f1(netPocketPct)}%
              </span>
            </div>
            <p className="mt-3.5 text-[14px] font-bold text-slate-500 dark:text-slate-400">
              {T('Net in Pocket', 'الصافي بالجيب')}
            </p>
            <div
              dir="ltr"
              className="mt-1 text-[28px] font-black tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-[32px]"
            >
              {fmtKwdVal(netPocketKwd)}
            </div>
            <p className="mt-1 text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
              {isAr ? 'الصافي الفعلي بعد الإيجار وكل المصاريف' : 'Actual net cash after rent & all bills'}
            </p>
          </article>

          {/* KPI 4: فرص زيادة الربح (Direct Jump to Marketing & Growth Hub) */}
          <Link
            href="/erp/cores?tab=marketing"
            className="ae-kpi-card ae-glow-amber block cursor-pointer p-5 transition-transform duration-150 hover:-translate-y-0.5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                <Lightbulb className="h-4 w-4" />
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {coresSnap.marketing.growthPlays.length} {T('plays', 'خطط نمو')}
              </span>
            </div>
            <p className="mt-3.5 text-[14px] font-bold text-slate-500 dark:text-slate-400">
              {T('Profit Opportunities', 'فرص زيادة الربح')}
            </p>
            <div
              dir="ltr"
              className="mt-1 text-[28px] font-black tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-[32px]"
            >
              +{fmtKwdVal(workspace.totalPlaysBenefitPeriodKwd)}
            </div>
            <p className="mt-1 inline-flex items-center gap-1 text-[13.5px] font-bold text-emerald-700 dark:text-emerald-300">
              <span>{T('View Steps ↗', 'عرض الخطوات ↗')}</span>
            </p>
          </Link>
        </div>

        {/* Middle Bento Row: 8-Col Visual Cash-Flow Chart + 4-Col Interactive 10-KWD Donut */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* 8-Col Card: Interactive Cash-Flow & Net Performance Capsule Chart */}
          <div
            id="cash-flow-chart-card"
            className="ae-bento-card flex flex-col justify-between p-5 sm:p-6 lg:col-span-8"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-extrabold tracking-tight text-slate-950 dark:text-white">
                  {T('Sales & Net Cash Flow', 'المبيعات والصافي بالجيب')}
                </h2>
                <p className="text-[14px] font-medium text-slate-500 dark:text-slate-400">
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
          <div className="ae-bento-card flex flex-col justify-between p-5 sm:p-6 lg:col-span-4">
            <div className="mb-3">
              <h2 className="text-[18px] font-extrabold tracking-tight text-slate-950 dark:text-white">
                {T('Where Every 10 KWD Goes?', 'وين تروح كل ١٠ دنانير؟')}
              </h2>
              <p className="text-[14px] font-medium text-slate-500 dark:text-slate-400">
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

        {/* Compact 3 × 2 Executive Module Jump Cards (Zero Repeated Tables or Boilerplate) */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {workspace.summaryCards.map((c) => (
            <article
              key={c.id}
              className="ae-kpi-card flex min-h-[196px] flex-col justify-between p-6"
            >
              <div className="space-y-2">
                <h3 className="text-[15.5px] font-extrabold text-slate-800 dark:text-slate-100">
                  {isAr ? c.titleAr : c.titleEn}
                </h3>
                <div
                  className={`text-[28px] font-black tracking-tight tabular-nums ${ACCENT_RING[c.accent]}`}
                >
                  {isAr ? c.valueAr : c.valueEn}
                </div>
                <p className="text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {isAr ? c.descAr : c.descEn}
                </p>
              </div>

              <div className="mt-5 flex items-center justify-end">
                <Link
                  href={c.href ?? '/erp/cores'}
                  className="ae-bento-subcard inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[13.5px] font-bold text-slate-800 transition-colors duration-150 hover:text-emerald-700 dark:text-slate-100 dark:hover:text-emerald-300"
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
