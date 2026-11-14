'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  Building2,
  CalendarRange,
  Clock,
  Flame,
  Lightbulb,
  Plus,
  RefreshCw,
  ShieldAlert,
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
  computePeriodOverPeriodDeltaPct,
  formatArOpportunities,
  formatSignedDelta,
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
                className={`rounded-lg px-1.5 py-0.5 text-xs font-bold tabular-nums ${
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
  const { workspace, filters, liveSummary, isAuditor } = useGlobalFilter()
  const auditorReadOnly = isAuditor || Boolean(liveSummary?.readOnly)

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

  // Priority 2 (#2): Immediate executive Start-Here & Branch Pulse figures linked to exact Odoo KWD ledger
  const procurementCard = workspace.summaryCards.find((c) => c.id === 'procurement-kitchen')
  const receivablesCard = workspace.summaryCards.find((c) => c.id === 'delivery-dues')
  const quietHoursCard = workspace.summaryCards.find((c) => c.id === 'kitchen-capacity')
  const slaDisciplineCard = workspace.summaryCards.find((c) => c.id === 'branch-discipline')

  // 7-day Weekly Performance Analytics series (Sat–Fri / S M T W T F S) from verified POS ledger
  const weeklyPills = useMemo(() => {
    const isIsoDaily =
      coresSnap.sales.timeline.length >= 7 &&
      /^\d{4}-\d{2}-\d{2}$/.test(coresSnap.sales.timeline[0]?.id ?? '')
    const baseTimeline = isIsoDaily
      ? coresSnap.sales.timeline
      : computeCoresHubSnapshot({ ...filters, period: 'week' }, [], liveSummary).sales.timeline
    const sevenDays = baseTimeline.slice(-7)
    const maxSales = Math.max(...sevenDays.map((d) => Math.max(0, d.salesKwd)), 1)
    let strictPeakId = sevenDays[0]?.id ?? ''
    let strictPeakVal = -1
    for (const d of sevenDays) {
      const s = Math.max(0, d.salesKwd)
      if (s > strictPeakVal) {
        strictPeakVal = s
        strictPeakId = d.id
      }
    }

    const enLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    const enShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const arShort = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

    return sevenDays.map((pt, idx) => {
      const salesKwd = Math.max(0, pt.salesKwd)
      const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(pt.id)
      const dow = isoMatch
        ? new Date(
            Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]), 12, 0, 0),
          ).getUTCDay()
        : (idx + 6) % 7
      const shortDate = isoMatch ? `${isoMatch[3]}/${isoMatch[2]}` : pt.labelEn
      const isPeak = pt.id === strictPeakId
      const heightPct = isPeak
        ? 100
        : Math.max(30, Math.min(96, Math.round((salesKwd / maxSales) * 100)))
      const perfIndexPct = isPeak
        ? 100
        : Math.min(98, Math.max(35, Math.round((salesKwd / maxSales) * 100)))
      const compactKwd = `${(salesKwd / 1000).toFixed(1)}k`
      return {
        id: pt.id,
        isPeak,
        letterEn: enLetters[dow] ?? 'D',
        dayNameEn: enShort[dow] ?? pt.labelEn,
        dayNameAr: arShort[dow] ?? pt.labelAr,
        shortDate,
        salesKwd,
        compactKwd,
        orders: pt.orders,
        heightPct,
        perfIndexPct,
      }
    })
  }, [coresSnap.sales.timeline, filters, liveSummary])

  const peakPillId = useMemo(
    () => weeklyPills.find((p) => p.isPeak)?.id ?? weeklyPills[0]?.id ?? '',
    [weeklyPills],
  )

  const [selectedPillId, setSelectedPillId] = useState<string | null>(null)
  const activePillId =
    selectedPillId && weeklyPills.some((p) => p.id === selectedPillId)
      ? selectedPillId
      : peakPillId
  const activeWeeklyDay = weeklyPills.find((p) => p.id === activePillId) ?? weeklyPills[weeklyPills.length - 1]

  const topBranch = coresSnap.sales.branchRanking[0]
  const heroDelta = useMemo(
    () => formatSignedDelta(computePeriodOverPeriodDeltaPct(filters, workspace, liveSummary)),
    [filters, liveSummary, workspace],
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-4 sm:space-y-5 pb-28 sm:pb-12">
      {/* =====================================================================
          SPEC #3 PART 2: EXECUTIVE PAGE HEADER ROW (`Executive Dashboard` + CTAs)
         ===================================================================== */}
      <div className="ae-bento-card flex flex-col gap-3 rounded-2xl bg-white px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] lg:flex-row lg:items-center lg:justify-between sm:px-5 dark:bg-[#101815] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09]">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl sm:text-[24px] font-semibold tracking-tight text-slate-950 dark:text-white">
              {T('Executive Dashboard', 'لوحة القيادة التنفيذية')}
            </h2>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[13px] font-semibold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/20">
              {T('Company Summary', 'ملخص الشركة')}
            </span>
            {workspace.diagnosticStrip.showPeerComparison &&
            (isAr ? workspace.diagnosticStrip.benchmarkAr : workspace.diagnosticStrip.benchmarkEn) ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[13px] font-semibold tabular-nums text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300">
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
          <p className="min-w-0 whitespace-normal text-[13px] sm:text-[13.5px] font-medium text-slate-600 dark:text-[#8FA39B]">
            {isAr ? workspace.subtitleAr : workspace.subtitleEn}
          </p>
        </div>

        <div className="flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!auditorReadOnly ? (
            <button
              type="button"
              onClick={() => void refreshLive()}
              disabled={syncing}
              aria-label={T('Sync Odoo', 'مزامنة أودو')}
              title={T('Sync Live Odoo Ledger', 'مزامنة أرقام أودو المباشرة')}
              className="ae-emerald-cta-pill inline-flex h-9.5 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold text-white transition-all duration-150 hover:scale-[1.01] disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{T('+ Sync Odoo', '+ مزامنة أودو')}</span>
            </button>
          ) : null}

          <Link
            href="/erp/weekday-comparison"
            className="inline-flex h-9.5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#F6F7F8] px-3.5 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-900/[0.06] transition-colors duration-150 hover:bg-white hover:text-emerald-700 dark:bg-[#141F1B] dark:text-slate-200 dark:ring-emerald-400/[0.12] dark:hover:bg-white/[0.08] dark:hover:text-emerald-300"
          >
            <CalendarRange className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{T('Export / Compare Dates', 'تصدير / مقارنة التواريخ')}</span>
          </Link>

          <Link
            href="/erp/before-after"
            className="inline-flex h-9.5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#F6F7F8] px-3.5 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-900/[0.06] transition-colors duration-150 hover:bg-white hover:text-emerald-700 dark:bg-[#141F1B] dark:text-slate-200 dark:ring-emerald-400/[0.12] dark:hover:bg-white/[0.08] dark:hover:text-emerald-300"
          >
            <span>{T('Decision Impact (Before & After) ↗', 'أثر القرارات (قبل وبعد) ↗')}</span>
          </Link>
        </div>
      </div>

      {/* =====================================================================
          SPEC #4: 4-COLUMN HERO + MATTE KPI ROW
          Card 1: Rich Emerald Gradient Hero (`from-[#0F764A] to-[#064E3B]`)
          Cards 2–4: Deep Matte `#111A17` Cards with Circular Arrow Action Buttons
         ===================================================================== */}
      <section className="space-y-4 sm:space-y-5">
        <div className="ae-stagger grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Card 1 (Hero Featured Metric): Net Sales KWD */}
          <article className="ae-hero-emerald-card relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F764A] via-[#10935B] to-[#064E3B] p-3.5 sm:p-5 text-white shadow-[0_14px_30px_-10px_rgba(16,185,129,0.45)] ring-1 ring-emerald-300/25">
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-white/95">
                {T('Net Sales (KWD)', 'صافي المبيعات (د.ك)')}
              </p>
              <Link
                href="/erp/cores"
                aria-label={T('Inspect Sales Core', 'تفاصيل محور المبيعات')}
                className="ae-hero-circle-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-emerald-950 shadow-sm transition-transform duration-150 hover:scale-105"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div
              dir="ltr"
              className="mt-3 text-2xl sm:text-[34px] font-semibold leading-tight tracking-tight tabular-nums text-white"
            >
              {fmtKwdVal(workspace.salesKwd)}
            </div>

            <div className="mt-3.5 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  dir="ltr"
                  className={`ae-hero-pill inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs lg:text-[13px] font-semibold tabular-nums backdrop-blur-sm ${
                    heroDelta.tone === 'rose'
                      ? 'bg-rose-500/25 text-rose-50 ring-1 ring-rose-300/35'
                      : 'bg-white/15 text-white'
                  }`}
                >
                  {heroDelta.text} {T('vs prior period', 'مقارنة بالفترة السابقة')}
                </span>
                <span className="whitespace-normal text-[13px] font-medium tabular-nums text-white/85">
                  {isAr ? `• متوسط ${f2(workspace.aovKwd)} د.ك` : `• AOV ${f2(workspace.aovKwd)} KWD`}
                </span>
              </div>
              {(liveSummary?.companyTotals?.unmappedTerminalsNetKwd ?? 0) > 0 &&
              filters.brand === 'all' &&
              filters.branch === 'all' ? (
                <p className="whitespace-normal text-xs lg:text-[13px] font-medium tabular-nums text-white/80">
                  {T(
                    `Central / Multi-Branch POS Terminals included: ${f0(liveSummary!.companyTotals!.unmappedTerminalsNetKwd)} KWD`,
                    `شامل نقاط البيع المركزية والمتعددة: ${f0(liveSummary!.companyTotals!.unmappedTerminalsNetKwd)} د.ك`,
                  )}
                </p>
              ) : null}
            </div>
          </article>

          {/* Card 2 (Matte `#111A17`): Orders & Left Before Rent */}
          <article className="ae-kpi-card flex min-w-0 flex-col justify-between rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09]">
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                {T('Orders & Before Rent', 'الطلبات والباقي قبل الإيجار')}
              </p>
              <Link
                href="/erp/cores"
                aria-label={T('Inspect Orders & Margin', 'تفاصيل الطلبات والهامش')}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-900/[0.06] transition-transform duration-150 hover:scale-105 dark:bg-white/[0.06] dark:text-emerald-200 dark:ring-white/10"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div
              dir="ltr"
              className="mt-3 text-2xl sm:text-[32px] font-semibold leading-tight tracking-tight tabular-nums text-slate-950 dark:text-white"
            >
              {f0(workspace.orders)}
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
              <span
                dir="ltr"
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs lg:text-[13px] font-semibold tabular-nums ${
                  beforeRentRatio < 0
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                }`}
              >
                {beforeRentRatio > 0 ? '▲' : beforeRentRatio < 0 ? '▼' : '•'} {f1(beforeRentRatio * 100)}% • {fmtKwdVal(beforeRentKwd)}
              </span>
              <span className="whitespace-normal text-[13px] font-medium text-slate-600 dark:text-[#8FA39B]">
                {isAr ? 'بعد المواد والتوصيل' : 'left before rent'}
              </span>
            </div>
          </article>

          {/* Card 3 (Matte `#111A17`): Net Pocket Profit */}
          <article className="ae-kpi-card flex min-w-0 flex-col justify-between rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09]">
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                {T('Net Pocket Profit', 'الصافي بالجيب')}
              </p>
              <Link
                href="/erp/before-after"
                aria-label={T('Inspect Net Profit Impact', 'تفاصيل الصافي بالجيب')}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-900/[0.06] transition-transform duration-150 hover:scale-105 dark:bg-white/[0.06] dark:text-emerald-200 dark:ring-white/10"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div
              dir="ltr"
              className="mt-3 text-2xl sm:text-[32px] font-semibold leading-tight tracking-tight tabular-nums text-slate-950 dark:text-white"
            >
              {fmtKwdVal(netPocketKwd)}
            </div>

            <div className="mt-3.5 space-y-1">
              <span
                dir="ltr"
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs lg:text-[13px] font-semibold tabular-nums ${
                  netPocketPct < 0
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                    : netPocketPct >= 12
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                }`}
              >
                {netPocketPct > 0 ? '▲' : netPocketPct < 0 ? '▼' : '•'} {f1(netPocketPct)}% {T('net pocket share', 'نسبة الصافي')}
              </span>
              <p className="whitespace-normal text-[13px] font-medium leading-snug text-slate-600 dark:text-slate-300">
                {isAr
                  ? 'الصافي الفعلي بعد الإيجار وكافة المصاريف'
                  : 'Actual net cash after rent & all expenses'}
              </p>
            </div>
          </article>

          {/* Card 4 (Matte `#111A17`): Recoverable Profit Opportunities -> `/erp/planning` */}
          <Link
            href="/erp/planning"
            className="ae-kpi-card group flex min-w-0 flex-col justify-between rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] transition-transform duration-150 hover:-translate-y-0.5 dark:bg-[#111A17] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09]"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                {T('Recoverable Profit Opportunities', 'فرص زيادة الربح المتاحة')}
              </p>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-900/[0.06] transition-transform duration-150 group-hover:scale-105 dark:bg-white/[0.06] dark:text-emerald-200 dark:ring-white/10">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>

            <div
              dir="ltr"
              className="mt-3 text-2xl sm:text-[32px] font-semibold leading-tight tracking-tight tabular-nums text-slate-950 dark:text-white"
            >
              +{fmtKwdVal(workspace.totalPlaysBenefitPeriodKwd)}
            </div>

            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs lg:text-[13px] font-semibold tabular-nums text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                {T(
                  `Across 7 active branches • ${workspace.plays.length} actionable plays`,
                  `عبر 7 فروع نشطة • ${formatArOpportunities(workspace.plays.length)} قابلة للاسترداد`,
                )}
              </span>
              <span className="text-xs lg:text-[13px] font-bold text-emerald-700 dark:text-emerald-300">
                {T('View Steps ↗', 'عرض الخطوات ↗')}
              </span>
            </div>
          </Link>
        </div>

        {/* ===================================================================
            SPEC #5: 3-COLUMN EXECUTIVE BENTO ROW (`grid-cols-1 lg:grid-cols-12 gap-4`)
            - Left (`lg:col-span-6`): Weekly Performance Analytics (7 Pill Bars + Diagonal Hatch)
            - Center (`lg:col-span-3`): Executive Focus / Start Here This Week
            - Right (`lg:col-span-3`): Branch & Priority Pulse (`+ View All`)
           =================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Wide Card (`lg:col-span-6`): Weekly Performance Analytics */}
          <div className="ae-bento-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09] lg:col-span-6">
            <div className="flex flex-wrap items-start justify-between gap-2.5">
              <div className="min-w-0">
                <h2 className="text-[16px] sm:text-[17.5px] font-semibold tracking-tight text-slate-950 dark:text-white">
                  {T('Weekly Performance Analytics', 'تحليلات الأداء الأسبوعي')}
                </h2>
                <p className="mt-0.5 whitespace-normal text-[13px] font-medium text-slate-600 dark:text-[#8FA39B]">
                  {T(
                    '7-day POS ledger trajectory (Sat–Fri) · Select any pill bar',
                    'مسار 7 أيام من نقاط البيع (السبت – الجمعة) · اختر أي عمود كبسولة',
                  )}
                </p>
              </div>

              {activeWeeklyDay ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-[#F6F7F8] px-3 py-1 text-xs lg:text-[13px] font-semibold tabular-nums text-slate-800 ring-1 ring-slate-900/[0.06] dark:bg-[#141F1B] dark:text-emerald-200 dark:ring-emerald-400/[0.14]">
                  <span>{isAr ? activeWeeklyDay.dayNameAr : activeWeeklyDay.dayNameEn}</span>
                  <span aria-hidden className="text-slate-300 dark:text-white/20">
                    •
                  </span>
                  <span dir="ltr">{fmtKwdVal(activeWeeklyDay.salesKwd)}</span>
                </div>
              ) : null}
            </div>

            {/* 7 Sculptural Vertical Pill-Shaped Bars (`grid-cols-7`) */}
            <div
              dir="ltr"
              className="mt-5 grid grid-cols-7 items-end gap-2.5 sm:gap-4 pt-6 pb-1"
            >
              {weeklyPills.map((day) => {
                const isSelected = day.id === activePillId
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setSelectedPillId(day.id)}
                    onMouseEnter={() => setSelectedPillId(day.id)}
                    aria-pressed={isSelected}
                    aria-label={`${day.dayNameEn} (${day.shortDate}): ${fmtKwdVal(day.salesKwd)}`}
                    className="group flex cursor-pointer flex-col items-center focus:outline-none"
                  >
                    <div className="relative flex h-40 sm:h-44 w-full flex-col items-center justify-end">
                      {isSelected ? (
                        <span
                          dir="ltr"
                          className="mb-2 inline-flex items-center whitespace-nowrap rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs lg:text-[13px] font-bold tabular-nums text-emerald-800 ring-1 ring-emerald-500/35 dark:bg-emerald-400/20 dark:text-emerald-200 dark:ring-emerald-400/40"
                        >
                          {day.isPeak
                            ? T('100% (Peak)', '100% (الذروة)')
                            : `${day.compactKwd} ${isAr ? 'د.ك' : 'KWD'}`}
                        </span>
                      ) : (
                        <span
                          dir="ltr"
                          className="mb-2 text-xs lg:text-[13px] font-medium tabular-nums text-slate-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100 dark:text-[#8FA39B]"
                        >
                          {day.compactKwd}
                        </span>
                      )}

                      <div
                        style={
                          isSelected
                            ? { height: `${day.heightPct}%` }
                            : {
                                height: `${day.heightPct}%`,
                                backgroundImage:
                                  'repeating-linear-gradient(45deg, rgba(16,185,129,0.16) 0px, rgba(16,185,129,0.16) 4px, rgba(16,185,129,0.04) 4px, rgba(16,185,129,0.04) 9px)',
                              }
                        }
                        className={`w-full max-w-[44px] rounded-full transition-all duration-300 ${
                          isSelected
                            ? 'ae-emerald-peak-pill bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                            : 'ae-pill-hatch ring-1 ring-emerald-500/20 group-hover:ring-emerald-400/45 dark:ring-emerald-400/20'
                        }`}
                      />
                    </div>

                    <span
                      className={`mt-2.5 text-[12.5px] font-semibold tracking-tight ${
                        isSelected
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {isAr ? day.dayNameAr : day.letterEn}
                    </span>
                    <span className="text-xs lg:text-[13px] font-medium tabular-nums text-slate-600 dark:text-slate-300">
                      {day.shortDate}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Center Card (`lg:col-span-3`): Executive Focus / Start Here This Week */}
          <section
            aria-label={T('Start Here This Week', 'ابدأ من هنا هذا الأسبوع')}
            className="ae-bento-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09] lg:col-span-3"
          >
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15.5px] sm:text-[16.5px] font-semibold tracking-tight text-slate-950 dark:text-white">
                  {T('Start Here This Week', 'ابدأ من هنا هذا الأسبوع')}
                </h2>
                <span className="inline-flex items-center rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs lg:text-[13px] font-bold text-rose-700 dark:text-rose-300">
                  {T('#1 Priority', 'الأولوية #1')}
                </span>
              </div>

              {/* Primary Governance / Operational Focus Block */}
              <Link
                href="/erp/warehouse-chain"
                className="block rounded-2xl bg-[#F6F7F8] p-3.5 ring-1 ring-slate-900/[0.05] transition-colors hover:ring-emerald-500/35 dark:bg-[#141F1B] dark:ring-emerald-400/[0.09] dark:hover:ring-emerald-400/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="whitespace-normal text-[14px] font-semibold leading-snug text-slate-950 dark:text-white">
                    {T('Stop #1 Operational Leak', 'إيقاف أكبر نزيف تشغيلي')}
                  </span>
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
                </div>

                <div
                  dir="ltr"
                  className="mt-1.5 text-[22px] font-semibold tracking-tight tabular-nums text-rose-600 dark:text-rose-300"
                >
                  {procurementCard
                    ? isAr
                      ? procurementCard.valueAr
                      : procurementCard.valueEn
                    : fmtKwdVal(0)}
                </div>

                <div className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-slate-600 dark:text-[#8FA39B]">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="whitespace-normal">
                    {T(
                      'Window: 09:00 – 11:30 KWT · Kitchen & Supplier Audit',
                      'النافذة: 09:00 – 11:30 ص · تدقيق المطبخ والموردين',
                    )}
                  </span>
                </div>
              </Link>

              {/* Secondary Open Cumulative Balance Callout */}
              <Link
                href="/erp/aggregator-radar"
                className="block rounded-xl bg-amber-50/60 px-3 py-2.5 ring-1 ring-amber-500/20 transition-colors hover:bg-amber-50 dark:bg-amber-950/20 dark:ring-amber-400/15 dark:hover:bg-amber-950/35"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs lg:text-[13px] font-semibold text-amber-950 dark:text-amber-200">
                    {T('Aggregator Collection', 'متابعة تحصيل المنصات')}
                  </span>
                  <span className="rounded-md bg-amber-100/90 px-1.5 py-0.5 text-xs lg:text-[13px] font-bold text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                    {T('Cumulative Balance', 'رصيد متراكم')}
                  </span>
                </div>
                <p className="mt-1 whitespace-normal text-xs lg:text-[13px] font-medium text-slate-600 dark:text-[#8FA39B]">
                  {T(
                    '(Open cumulative balance from prior periods under collection)',
                    '(رصيد متراكم مفتوح من فترات سابقة قيد التحصيل)',
                  )}
                </p>
              </Link>
            </div>

            <Link
              href="/erp/feryal-ai"
              className="ae-emerald-cta-pill mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-[13px] font-semibold text-white transition-transform duration-150 hover:scale-[1.01]"
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>{T('Open Action / Ask Feryal', 'افتح الإجراء / اسأل فريال')}</span>
            </Link>
          </section>

          {/* Right Card (`lg:col-span-3`): Branch & Priority Pulse */}
          <section
            aria-label={T('Branch & Priority Pulse', 'نبض الفروع والأولويات')}
            className="ae-bento-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09] lg:col-span-3"
          >
            <div>
              <div className="mb-3.5 flex items-center justify-between gap-2">
                <h2 className="text-[15.5px] sm:text-[16.5px] font-semibold tracking-tight text-slate-950 dark:text-white">
                  {T('Branch & Priority Pulse', 'نبض الفروع والأولويات')}
                </h2>
                <Link
                  href="/erp/weekday-comparison"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F6F7F8] px-2.5 py-1 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-900/[0.06] transition-colors hover:text-emerald-700 dark:bg-[#141F1B] dark:text-emerald-300 dark:ring-emerald-400/[0.12] dark:hover:bg-white/[0.08]"
                >
                  <Plus className="h-3 w-3" />
                  <span>{T('View All', 'عرض الكل')}</span>
                </Link>
              </div>

              <div className="space-y-2.5">
                {/* Pulse Item 1: Lead Branch */}
                <Link
                  href="/erp/cores"
                  className="flex items-center justify-between gap-2.5 rounded-xl bg-[#F6F7F8] p-2.5 ring-1 ring-slate-900/[0.04] transition-colors hover:bg-emerald-50/50 dark:bg-[#141F1B] dark:ring-emerald-400/[0.08] dark:hover:bg-white/[0.06]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="whitespace-normal text-[13px] lg:text-sm font-semibold leading-tight text-slate-900 dark:text-white">
                        {topBranch
                          ? isAr
                            ? topBranch.labelAr
                            : topBranch.labelEn
                          : T('Lead Branch', 'الفرع المتصدر')}
                      </p>
                      <p className="mt-0.5 text-xs lg:text-[13px] font-medium text-slate-600 dark:text-slate-300">
                        {T('Peak POS Revenue · Today', 'أعلى إيراد نقاط بيع · اليوم')}
                      </p>
                    </div>
                  </div>
                  <span
                    dir="ltr"
                    className="shrink-0 text-xs lg:text-[13px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"
                  >
                    {topBranch ? fmtKwdVal(topBranch.salesKwd) : fmtKwdVal(workspace.salesKwd)}
                  </span>
                </Link>

                {/* Pulse Item 2: Quiet Hours 3–6 PM Upside */}
                <Link
                  href="/erp/weekday-comparison"
                  className="flex items-center justify-between gap-2.5 rounded-xl bg-[#F6F7F8] p-2.5 ring-1 ring-slate-900/[0.04] transition-colors hover:bg-emerald-50/50 dark:bg-[#141F1B] dark:ring-emerald-400/[0.08] dark:hover:bg-white/[0.06]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="whitespace-normal text-[13px] lg:text-sm font-semibold leading-tight text-slate-900 dark:text-white">
                        {T('Quiet Hours Upside (3–6 PM)', 'فرصة الساعات الهادئة (3–6 م)')}
                      </p>
                      <p className="mt-0.5 text-xs lg:text-[13px] font-medium text-slate-600 dark:text-slate-300">
                        {T('Due: Daily 15:00 KWT', 'التنفيذ: يومياً 3:00 عصراً')}
                      </p>
                    </div>
                  </div>
                  <span
                    dir="ltr"
                    className="shrink-0 text-xs lg:text-[13px] font-semibold tabular-nums text-sky-700 dark:text-sky-300"
                  >
                    {quietHoursCard
                      ? isAr
                        ? quietHoursCard.valueAr
                        : quietHoursCard.valueEn
                      : `+${fmtKwdVal(0)}`}
                  </span>
                </Link>

                {/* Pulse Item 3: Aggregator Receivables */}
                <Link
                  href="/erp/aggregator-radar"
                  className="flex items-center justify-between gap-2.5 rounded-xl bg-[#F6F7F8] p-2.5 ring-1 ring-slate-900/[0.04] transition-colors hover:bg-emerald-50/50 dark:bg-[#141F1B] dark:ring-emerald-400/[0.08] dark:hover:bg-white/[0.06]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                      <Wallet className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="whitespace-normal text-[13px] lg:text-sm font-semibold leading-tight text-slate-900 dark:text-white">
                        {T('Aggregator Settlement', 'تسوية ذمم المنصات')}
                      </p>
                      <p className="mt-0.5 text-xs lg:text-[13px] font-medium text-slate-600 dark:text-slate-300">
                        {T('Due: Weekly Treasury Run', 'الاستحقاق: دورة الخزينة الأسبوعية')}
                      </p>
                    </div>
                  </div>
                  <span
                    dir="ltr"
                    className="shrink-0 text-xs lg:text-[13px] font-semibold tabular-nums text-amber-700 dark:text-amber-300"
                  >
                    {receivablesCard
                      ? isAr
                        ? receivablesCard.valueAr
                        : receivablesCard.valueEn
                      : fmtKwdVal(0)}
                  </span>
                </Link>

                {/* Pulse Item 4: Kitchen Prep & Delivery SLA */}
                <Link
                  href="/erp/prep-sla"
                  className="flex items-center justify-between gap-2.5 rounded-xl bg-[#F6F7F8] p-2.5 ring-1 ring-slate-900/[0.04] transition-colors hover:bg-emerald-50/50 dark:bg-[#141F1B] dark:ring-emerald-400/[0.08] dark:hover:bg-white/[0.06]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-300">
                      <Flame className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="whitespace-normal text-[13px] lg:text-sm font-semibold leading-tight text-slate-900 dark:text-white">
                        {T('Kitchen Prep & Rider SLA', 'التزام التحضير والتوصيل')}
                      </p>
                      <p className="mt-0.5 text-xs lg:text-[13px] font-medium text-slate-600 dark:text-slate-300">
                        {T('Peak Window: 19:00 – 23:00', 'ذروة المساء: 7:00 – 11:00 م')}
                      </p>
                    </div>
                  </div>
                  <span
                    dir="ltr"
                    className="shrink-0 text-xs lg:text-[13px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"
                  >
                    {slaDisciplineCard
                      ? isAr
                        ? slaDisciplineCard.valueAr
                        : slaDisciplineCard.valueEn
                      : '82/100'}
                  </span>
                </Link>
              </div>
            </div>
          </section>
        </div>

        {/* Middle Bento Row: 7-Col Dual-Scale Sales+Net Combo Chart + 5-Col Unclipped 10-KWD Donut */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-12">
          {/* 7-Col Card: Dual-Scale Combo Bar + Emerald Net Profit Line Chart */}
          <div
            id="cash-flow-chart-card"
            className="ae-bento-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09] xl:col-span-7"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-[17px] sm:text-[18px] font-semibold tracking-tight text-slate-950 dark:text-white">
                  {T('Sales & Net in Pocket', 'المبيعات والصافي بالجيب')}
                </h2>
                <p className="whitespace-normal text-[13px] sm:text-[14px] font-medium text-slate-600 dark:text-[#8FA39B]">
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
          <div className="ae-bento-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09] xl:col-span-5">
            <div className="mb-4">
              <h2 className="text-[17px] sm:text-[18px] font-semibold tracking-tight text-slate-950 dark:text-white">
                {T(
                  'How Every 10 KWD of Sales Is Distributed',
                  'كيف تتوزع كل 10 دنانير من المبيعات؟',
                )}
              </h2>
              <p className="whitespace-normal text-[13px] sm:text-[14px] font-medium text-slate-600 dark:text-[#8FA39B]">
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
          <div className="flex flex-col gap-2 rounded-2xl bg-white/85 px-4 py-3 ring-1 ring-slate-900/[0.04] sm:flex-row sm:items-center sm:justify-between dark:bg-[#101815]/95 dark:ring-emerald-400/[0.09]">
            <h2 className="text-[15px] sm:text-[16px] font-semibold tracking-tight text-slate-900 dark:text-white">
              {T('Operational Control & Profit Modules', 'محاور الرقابة والربحية التشغيلية')}
            </h2>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] sm:text-[12.5px] font-semibold text-slate-700 dark:text-[#8FA39B]">
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
              const badgeLabel =
                c.id === 'delivery-dues'
                  ? isAr
                    ? 'رصيد متراكم'
                    : c.badgeEn ?? 'Cumulative Balance'
                  : c.id === 'branch-discipline'
                    ? isAr
                      ? c.statusLabelAr
                      : c.statusLabelEn
                    : isAr
                      ? c.badgeAr ?? c.statusLabelAr
                      : c.badgeEn ?? c.statusLabelEn

              return (
                <article
                  key={c.id}
                  className="ae-kpi-card flex min-h-[188px] sm:min-h-[196px] flex-col justify-between rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09]"
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="inline-flex items-center gap-1.5 text-[15px] sm:text-[15.5px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                        <span aria-hidden="true" className="shrink-0 text-[13.5px]">
                          {c.statusDot}
                        </span>
                        <span>{isAr ? c.titleAr : c.titleEn}</span>
                      </h3>

                      {badgeLabel ? (
                        <span
                          className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums ${CARD_BADGE_TONE[c.accent]}`}
                        >
                          {badgeLabel}
                        </span>
                      ) : null}
                    </div>

                    <div
                      className={`text-2xl sm:text-[28px] font-semibold tracking-tight tabular-nums ${ACCENT_RING[c.accent]}`}
                    >
                      {c.id === 'branch-discipline' ? (
                        isAr ? (
                          <span>
                            {`${c.valueAr} (${c.badgeAr ?? 'المستهدف: 85+'})`}
                          </span>
                        ) : (
                          <span dir="ltr">
                            {`${c.valueEn} (${c.badgeEn ?? 'Target: 85+'})`}
                          </span>
                        )
                      ) : isAr ? (
                        c.valueAr
                      ) : (
                        <span dir="ltr">{c.valueEn}</span>
                      )}
                    </div>

                    <p className="whitespace-normal text-[13.5px] sm:text-[14px] leading-relaxed text-slate-600 dark:text-[#8FA39B]">
                      {isAr ? c.descAr : c.descEn}
                    </p>
                  </div>

                  <div className="mt-4 sm:mt-5 flex items-center justify-end">
                    <Link
                      href={c.href}
                      className="ae-bento-subcard inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-slate-800 transition-colors duration-150 hover:text-emerald-700 dark:bg-[#141F1B] dark:text-slate-100 dark:hover:text-emerald-300"
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
