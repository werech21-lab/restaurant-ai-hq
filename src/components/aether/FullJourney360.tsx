'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  Lightbulb,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  formatCompactAxisLabel,
  InteractiveDonutChart,
  SalesNetComboChart,
  type ComboBarLineDatum,
  type DonutSliceDatum,
} from '@/components/aether/InteractiveHoverCharts'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import {
  formatArOpportunities,
  type SummaryCardData,
} from '@/lib/aether/global-filter-engine'
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

const CARD_BADGE_TONE: Record<SummaryCardData['accent'], string> = {
  emerald:
    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300',
  sky: 'bg-sky-50 text-sky-700 ring-1 ring-sky-500/20 dark:bg-sky-950/60 dark:text-sky-300',
  amber:
    'bg-amber-50 text-amber-800 ring-1 ring-amber-500/25 dark:bg-amber-950/60 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-950/60 dark:text-rose-300',
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

  // Live daily & branch cash-flow series from cores engine
  const coresSnap = useMemo(
    () => computeCoresHubSnapshot(filters, [], liveSummary),
    [filters, liveSummary],
  )

  const comboData = useMemo<ComboBarLineDatum[]>(() => {
    const src = flowGroup === 'branches' ? coresSnap.sales.branchRanking : coresSnap.sales.timeline
    return src.map((pt) => {
      const sales = Math.max(0, pt.salesKwd)
      const branchOpt =
        flowGroup === 'branches'
          ? workspace.cascadingOptions.branches.find((b) => b.id === pt.id)
          : undefined
      const pointMarginPct =
        branchOpt?.weightedNetPct !== undefined ? branchOpt.weightedNetPct : netPocketPct
      const pointMarginRatio = Math.max(0, pointMarginPct / 100)
      const pocket = Math.max(0, sales * pointMarginRatio)
      const beforeRent = Math.max(0, sales * beforeRentRatio)
      const foodAndDelivery = Math.max(0, sales - beforeRent)
      const rawLabel = isAr ? pt.labelAr : pt.labelEn
      const axisLabel =
        flowGroup === 'branches'
          ? pt.id === 'avenues'
            ? isAr
              ? 'الأفنيوز'
              : 'Avenues'
            : pt.id === 'ardiya'
              ? isAr
                ? 'العارضية'
                : 'Ardiya'
              : rawLabel
          : formatCompactAxisLabel(rawLabel)
      return {
        id: pt.id,
        label: axisLabel,
        tooltipTitle: isAr ? pt.tooltipTitleAr : pt.tooltipTitleEn,
        salesKwd: sales,
        netKwd: pocket,
        netMarginPct: pointMarginPct,
        lines: [
          { label: isAr ? 'المبيعات:' : 'Sales:', value: fmtKwdVal(sales), bold: true },
          {
            label: isAr ? 'المواد الغذائية والتوصيل:' : 'Food & Delivery:',
            value: fmtKwdVal(foodAndDelivery),
            tone: 'amber',
          },
          {
            label: isAr ? 'الباقي قبل الإيجار:' : 'Before Rent:',
            value: fmtKwdVal(beforeRent),
            tone: 'slate',
          },
          {
            label: isAr ? 'الصافي بالجيب:' : 'Net in Pocket:',
            value: fmtKwdVal(pocket),
            tone: 'emerald',
            bold: true,
          },
          {
            label: isAr ? 'هامش الصافي:' : 'Net Margin:',
            value: `${f1(pointMarginPct)}%`,
            tone: 'emerald',
          },
        ],
      }
    })
  }, [
    beforeRentRatio,
    coresSnap.sales.branchRanking,
    coresSnap.sales.timeline,
    flowGroup,
    fmtKwdVal,
    isAr,
    netPocketPct,
    workspace.cascadingOptions.branches,
  ])

  const tenKwdDonutSlices = useMemo<DonutSliceDatum[]>(() => {
    const foodTotal = (workspace.salesKwd * food10) / 10
    const deliveryTotal = (workspace.salesKwd * delivery10) / 10
    const opexTotal = (workspace.salesKwd * opexRent10) / 10
    const pocketTotal = (workspace.salesKwd * netPocket10) / 10

    return [
      {
        id: 'food',
        label: isAr ? 'تكلفة المواد الغذائية' : 'Food & Ingredients Cost',
        subLabel: isAr
          ? `من كل 10 د.ك • إجمالي ${fmtKwdVal(foodTotal)}`
          : `per 10 KWD • Total ${fmtKwdVal(foodTotal)}`,
        value: food10,
        valueFormatted: isAr ? `${f2(food10)} د.ك` : `${f2(food10)} KWD`,
        pctFormatted: `${f1(food10 * 10)}%`,
        color: '#F59E0B',
      },
      {
        id: 'delivery',
        label: isAr ? 'عمولات منصات التوصيل' : 'Delivery Aggregator Commissions',
        subLabel: isAr
          ? `من كل 10 د.ك • إجمالي ${fmtKwdVal(deliveryTotal)}`
          : `per 10 KWD • Total ${fmtKwdVal(deliveryTotal)}`,
        value: delivery10,
        valueFormatted: isAr ? `${f2(delivery10)} د.ك` : `${f2(delivery10)} KWD`,
        pctFormatted: `${f1(delivery10 * 10)}%`,
        color: '#F43F5E',
      },
      {
        id: 'opex',
        label: isAr ? 'الإيجارات والرواتب' : 'Rent & Payroll',
        subLabel: isAr
          ? `من كل 10 د.ك • إجمالي ${fmtKwdVal(opexTotal)}`
          : `per 10 KWD • Total ${fmtKwdVal(opexTotal)}`,
        value: opexRent10,
        valueFormatted: isAr ? `${f2(opexRent10)} د.ك` : `${f2(opexRent10)} KWD`,
        pctFormatted: `${f1(opexRent10 * 10)}%`,
        color: '#64748B',
      },
      {
        id: 'pocket',
        label: isAr ? 'الصافي الفعلي بالجيب' : 'Actual Net in Pocket',
        subLabel: isAr
          ? `من كل 10 د.ك • إجمالي ${fmtKwdVal(pocketTotal)}`
          : `per 10 KWD • Total ${fmtKwdVal(pocketTotal)}`,
        value: netPocket10,
        valueFormatted: isAr ? `${f2(netPocket10)} د.ك` : `${f2(netPocket10)} KWD`,
        pctFormatted: `${f1(netPocket10 * 10)}%`,
        color: '#10B981',
      },
    ]
  }, [delivery10, fmtKwdVal, food10, isAr, netPocket10, opexRent10, workspace.salesKwd])

  // Priority 2 (#2): 3 immediate executive Start-Here cards linked to exact Odoo KWD figures
  const procurementCard = workspace.summaryCards.find((c) => c.id === 'procurement-kitchen')
  const receivablesCard = workspace.summaryCards.find((c) => c.id === 'delivery-dues')
  const quietHoursCard = workspace.summaryCards.find((c) => c.id === 'kitchen-capacity')

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-4 sm:space-y-5 pb-12">
      {/* Slim Executive Context & Action Bar (Smart Benchmark shown ONLY when filtering a specific brand/branch/channel/slice) */}
      <div className="ae-bento-card flex flex-col gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:bg-[#101C17] dark:ring-emerald-500/10">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="min-w-0 whitespace-normal text-[13px] sm:text-[14px] font-medium text-slate-600 dark:text-slate-300">
            {isAr ? workspace.subtitleAr : workspace.subtitleEn}
          </p>
          {workspace.diagnosticStrip.showPeerComparison &&
          (isAr ? workspace.diagnosticStrip.benchmarkAr : workspace.diagnosticStrip.benchmarkEn) ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300">
              <span>
                {workspace.diagnosticStrip.tone === 'emerald'
                  ? '🟢'
                  : workspace.diagnosticStrip.tone === 'amber'
                    ? '🟠'
                    : '🔴'}
              </span>
              <span>
                {isAr
                  ? workspace.diagnosticStrip.benchmarkAr
                  : workspace.diagnosticStrip.benchmarkEn}
              </span>
            </span>
          ) : null}
        </div>

        <div className="flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-2xl">
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

      {/* Priority 2 (#2): Crisp "ابدأ من هنا هذا الأسبوع" / "Start Here This Week" Executive Action Strip */}
      <section
        aria-label={T('Start Here This Week', 'ابدأ من هنا هذا الأسبوع')}
        className="ae-bento-card rounded-2xl bg-white p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[12px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              1–3
            </span>
            <h2 className="text-[14.5px] sm:text-[15.5px] font-bold tracking-tight text-slate-950 dark:text-white">
              {T('Start Here This Week', 'ابدأ من هنا هذا الأسبوع')}
            </h2>
          </div>
          <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
            {T(
              '3 direct high-impact actions backed by verified Odoo ledger figures',
              '3 أولويات تنفيذية فورية بأرقام دفتر أودو المعتمدة',
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Action 1: Stop #1 Operational Leak */}
          <Link
            href="/erp/warehouse-chain"
            className="group flex flex-col justify-between gap-2 rounded-xl bg-rose-50/45 p-3.5 ring-1 ring-rose-500/15 transition-all duration-150 hover:-translate-y-0.5 hover:bg-rose-50/80 dark:bg-rose-950/20 dark:ring-rose-500/20 dark:hover:bg-rose-950/35"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span aria-hidden="true" className="shrink-0 text-[13px]">
                  🔴
                </span>
                <span className="whitespace-normal text-[13.5px] font-bold leading-snug text-slate-900 dark:text-white">
                  {T('Stop #1 Operational Leak', 'إيقاف أكبر نزيف تشغيلي')}
                </span>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-rose-600 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:group-hover:-translate-x-0.5 dark:text-rose-400" />
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[19px] sm:text-[21px] font-bold tracking-tight tabular-nums text-rose-700 dark:text-rose-400">
                {procurementCard
                  ? isAr
                    ? procurementCard.valueAr
                    : procurementCard.valueEn
                  : fmtKwdVal(0)}
              </span>
              <span className="whitespace-normal text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
                {T(
                  'Kitchen gap & supplier price variance',
                  'فروقات أسعار الموردين وهدر المطبخ الصافي',
                )}
              </span>
            </div>
          </Link>

          {/* Action 2: Collect Cumulative Aggregator Receivables */}
          <Link
            href="/erp/aggregator-radar"
            className="group flex flex-col justify-between gap-2 rounded-xl bg-amber-50/50 p-3.5 ring-1 ring-amber-500/20 transition-all duration-150 hover:-translate-y-0.5 hover:bg-amber-50/85 dark:bg-amber-950/20 dark:ring-amber-500/20 dark:hover:bg-amber-950/35"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span aria-hidden="true" className="shrink-0 text-[13px]">
                  🟠
                </span>
                <span className="whitespace-normal text-[13.5px] font-bold leading-snug text-slate-900 dark:text-white">
                  {T(
                    'Collect Cumulative Aggregator Receivables',
                    'متابعة تحصيل ذمم منصات التوصيل المتراكمة',
                  )}
                </span>
                <span className="rounded-md bg-amber-100/90 px-2 py-0.5 text-[11px] font-bold text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                  {T('Cumulative Balance', 'رصيد تراكمي')}
                </span>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-amber-700 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:group-hover:-translate-x-0.5 dark:text-amber-400" />
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[19px] sm:text-[21px] font-bold tracking-tight tabular-nums text-amber-800 dark:text-amber-300">
                {receivablesCard
                  ? isAr
                    ? receivablesCard.valueAr
                    : receivablesCard.valueEn
                  : fmtKwdVal(0)}
              </span>
              <span className="whitespace-normal text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
                {T(
                  '(Open unsettled balance including prior periods)',
                  '(رصيد مفتوح قيد التحصيل يشمل فترات سابقة)',
                )}
              </span>
            </div>
          </Link>

          {/* Action 3: Activate Quiet Hours Upside (3–6 PM) */}
          <Link
            href="/erp/weekday-comparison"
            className="group flex flex-col justify-between gap-2 rounded-xl bg-emerald-50/50 p-3.5 ring-1 ring-emerald-500/20 transition-all duration-150 hover:-translate-y-0.5 hover:bg-emerald-50/85 dark:bg-emerald-950/25 dark:ring-emerald-500/20 dark:hover:bg-emerald-950/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span aria-hidden="true" className="shrink-0 text-[13px]">
                  🟢
                </span>
                <span className="whitespace-normal text-[13.5px] font-bold leading-snug text-slate-900 dark:text-white">
                  {T(
                    'Activate Quiet Hours Upside (3–6 PM)',
                    'تفعيل فرصة الساعات الهادئة (3–6 مساءً)',
                  )}
                </span>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-700 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:group-hover:-translate-x-0.5 dark:text-emerald-400" />
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[19px] sm:text-[21px] font-bold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
                {quietHoursCard
                  ? isAr
                    ? quietHoursCard.valueAr
                    : quietHoursCard.valueEn
                  : `+${fmtKwdVal(0)}`}
              </span>
              <span className="whitespace-normal text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
                {T(
                  'Monetize afternoon kitchen capacity with zero new rent',
                  'استثمار طاقة المطابخ عصراً بدون إيجار إضافي',
                )}
              </span>
            </div>
          </Link>
        </div>
      </section>

      <section className="space-y-4 sm:space-y-5">
        {/* Top Row: 4 Crisp Financial KPIs (2x2 on Mobile, 4-col on Desktop — ZERO clipped subtitles) */}
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
            <p className="mt-2.5 sm:mt-3.5 whitespace-normal text-[12.5px] sm:text-[14px] font-semibold leading-snug text-slate-500 dark:text-slate-400">
              {T('Sales', 'المبيعات')}
            </p>
            <div
              dir="ltr"
              className="mt-1 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-white"
            >
              {fmtKwdVal(workspace.salesKwd)}
            </div>
            <p className="mt-1.5 whitespace-normal text-[11.5px] sm:text-[13px] font-medium leading-snug tabular-nums text-slate-500 dark:text-slate-400">
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
            <p className="mt-2.5 sm:mt-3.5 whitespace-normal text-[12.5px] sm:text-[14px] font-semibold leading-snug text-slate-500 dark:text-slate-400">
              {T('Left Before Rent', 'الباقي قبل الإيجار')}
            </p>
            <div
              dir="ltr"
              className="mt-1 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-white"
            >
              {fmtKwdVal(beforeRentKwd)}
            </div>
            <p className="mt-1.5 whitespace-normal text-[11.5px] sm:text-[13px] font-medium leading-snug text-slate-500 dark:text-slate-400">
              {isAr
                ? 'بعد خصم تكلفة المواد الغذائية وعمولات التوصيل'
                : 'After food cost & delivery commissions'}
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
            <p className="mt-2.5 sm:mt-3.5 whitespace-normal text-[12.5px] sm:text-[14px] font-semibold leading-snug text-slate-500 dark:text-slate-400">
              {T('Net in Pocket', 'الصافي بالجيب')}
            </p>
            <div
              dir="ltr"
              className="mt-1 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
            >
              {fmtKwdVal(netPocketKwd)}
            </div>
            <p className="mt-1.5 whitespace-normal text-[11.5px] sm:text-[13px] font-medium leading-snug text-slate-500 dark:text-slate-400">
              {isAr
                ? 'الصافي الفعلي بعد الإيجار وكافة المصاريف'
                : 'Actual net cash after rent & all expenses'}
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
                {isAr ? formatArOpportunities(workspace.plays.length) : `${workspace.plays.length} plays`}
              </span>
            </div>
            <p className="mt-2.5 sm:mt-3.5 whitespace-normal text-[12.5px] sm:text-[14px] font-semibold leading-snug text-slate-500 dark:text-slate-400">
              {T('Profit Opportunities', 'فرص زيادة الربح')}
            </p>
            <div
              dir="ltr"
              className="mt-1 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
            >
              +{fmtKwdVal(workspace.totalPlaysBenefitPeriodKwd)}
            </div>
            <p className="mt-1.5 inline-flex items-center gap-1 text-[12px] sm:text-[13.5px] font-bold text-emerald-700 dark:text-emerald-300">
              <span>{T('View Steps ↗', 'عرض الخطوات ↗')}</span>
            </p>
          </Link>
        </div>

        {/* Middle Bento Row: 7-Col Dual-Scale Sales+Net Combo Chart + 5-Col Unclipped 10-KWD Donut */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-12">
          {/* 7-Col Card: Dual-Scale Combo Bar + Emerald Net Profit Line Chart */}
          <div
            id="cash-flow-chart-card"
            className="ae-bento-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10 xl:col-span-7"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-[17px] sm:text-[18px] font-bold tracking-tight text-slate-950 dark:text-white">
                  {T('Sales & Net in Pocket', 'المبيعات والصافي بالجيب')}
                </h2>
                <p className="whitespace-normal text-[13px] sm:text-[14px] font-medium text-slate-500 dark:text-slate-400">
                  {T(
                    'Tap or hover any bar to inspect exact KWD & net profit',
                    'اضغط أو مرر على أي عمود لعرض التفاصيل بالدينار وصافي الربح',
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

            <SalesNetComboChart
              data={comboData}
              isAr={isAr}
              salesLegend={T('Sales', 'المبيعات')}
              netLegend={T('Net in Pocket', 'الصافي بالجيب')}
              heightClass="h-60 sm:h-64"
            />
          </div>

          {/* 5-Col Card: Full Unclipped Vertical Donut Breakdown ("كيف تتوزع كل 10 دنانير من المبيعات؟") */}
          <div className="ae-bento-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10 xl:col-span-5">
            <div className="mb-4">
              <h2 className="text-[17px] sm:text-[18px] font-bold tracking-tight text-slate-950 dark:text-white">
                {T(
                  'How Every 10 KWD of Sales Is Distributed',
                  'كيف تتوزع كل 10 دنانير من المبيعات؟',
                )}
              </h2>
              <p className="whitespace-normal text-[13px] sm:text-[14px] font-medium text-slate-500 dark:text-slate-400">
                {T('Exact breakdown per 10 KWD of net sales', 'توزيع كل 10 دنانير من المبيعات الصافية')}
              </p>
            </div>

            <InteractiveDonutChart
              slices={tenKwdDonutSlices}
              centerValue={isAr ? `${f2(netPocket10)} د.ك` : `${f2(netPocket10)} KWD`}
              centerSubValue={T('per 10 KWD', 'من كل 10 د.ك')}
              centerLabel={T('Net Share', 'نصيب الصافي')}
              isAr={isAr}
              legendLayout="beside"
            />
          </div>
        </div>

        {/* Bottom 6 Executive Module Cards + Semantic Color Key Header */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-col gap-2 rounded-2xl bg-white/85 px-4 py-3 ring-1 ring-slate-900/[0.04] sm:flex-row sm:items-center sm:justify-between dark:bg-[#101C17]/90 dark:ring-emerald-500/10">
            <h2 className="text-[15px] sm:text-[16px] font-bold tracking-tight text-slate-900 dark:text-white">
              {T('Operational Control & Profit Modules', 'محاور الرقابة والربحية التشغيلية')}
            </h2>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] sm:text-[12.5px] font-semibold text-slate-700 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                {T('🔴 Urgent Action Required', '🔴 يتطلب ضبطاً عاجلاً')}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                •
              </span>
              <span className="inline-flex items-center gap-1.5">
                {T('🟠 Monitored Balance / Obligation', '🟠 رصيد/التزام تحت المتابعة')}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                •
              </span>
              <span className="inline-flex items-center gap-1.5">
                {T('🟢 Ready Profit Upside', '🟢 فرصة زيادة ربح جاهزة')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {workspace.summaryCards.map((c) => {
              const badgeLabel = isAr
                ? c.badgeAr ?? c.statusLabelAr
                : c.badgeEn ?? c.statusLabelEn

              return (
                <article
                  key={c.id}
                  className="ae-kpi-card flex min-h-[188px] sm:min-h-[196px] flex-col justify-between rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10"
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="inline-flex items-center gap-1.5 text-[15px] sm:text-[15.5px] font-bold text-slate-800 dark:text-slate-100">
                        <span aria-hidden="true" className="shrink-0 text-[13.5px]">
                          {c.statusDot}
                        </span>
                        <span>{isAr ? c.titleAr : c.titleEn}</span>
                      </h3>

                      {badgeLabel ? (
                        <span
                          className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-bold tabular-nums ${CARD_BADGE_TONE[c.accent]}`}
                        >
                          {badgeLabel}
                        </span>
                      ) : null}
                    </div>

                    <div
                      className={`text-2xl sm:text-[28px] font-semibold tracking-tight tabular-nums ${ACCENT_RING[c.accent]}`}
                    >
                      {isAr ? c.valueAr : <span dir="ltr">{c.valueEn}</span>}
                    </div>

                    <p className="whitespace-normal text-[13.5px] sm:text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
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
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
