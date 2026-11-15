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
import { AdminExecutiveDirectoryCard } from '@/components/erp/AdminExecutiveDirectoryCard'
import { AdminPosTerminalMappingPanel } from '@/components/erp/AdminPosTerminalMappingPanel'
import {
  canTriggerManualOdooSync,
  isErpRouteAllowedForRole,
  shouldMaskInternalCostsForRole,
} from '@/lib/auth/role-access-policy'
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
  formatPeriodCalendarWindow,
  type SummaryCardData,
} from '@/lib/aether/global-filter-engine'
import {
  buildWeeklyChartMeta,
  computePeriodDelta,
  formatAdminUnmappedAlertCopy,
  formatStaticMarginPill,
  resolveTopBranchCard,
  UNMAPPED_TERMINALS_LABEL_AR,
  UNMAPPED_TERMINALS_LABEL_EN,
} from '@/lib/aether/period-delta'
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
  const { workspace, filters, liveSummary, isAuditor, sessionRole } = useGlobalFilter()
  const auditorReadOnly = isAuditor || Boolean(liveSummary?.readOnly)
  const maskInternalCosts = shouldMaskInternalCostsForRole(sessionRole)
  const canSyncOdoo = !auditorReadOnly && canTriggerManualOdooSync(sessionRole)

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
      const qs =
        filters.period === 'custom'
          ? `period=custom&from=${encodeURIComponent(filters.customFrom)}&to=${encodeURIComponent(filters.customTo)}`
          : `period=${encodeURIComponent(filters.period)}`
      const res = await fetch(`/api/odoo-sync?${qs}`, {
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
  }, [filters.customFrom, filters.customTo, filters.period])

  const gl = workspace.accounting
  const hasFullGl = Boolean(
    gl.available &&
      gl.completeAccrualPosted &&
      gl.netProfitPct !== null &&
      gl.beforeRentPct !== null &&
      gl.operatingProfitKwd !== null &&
      gl.beforeRentKwd !== null,
  )

  const periodWindow = useMemo(
    () =>
      formatPeriodCalendarWindow(filters.period, {
        customFrom: filters.customFrom,
        customTo: filters.customTo,
        liveSummary,
      }),
    [filters.customFrom, filters.customTo, filters.period, liveSummary],
  )
  const periodFromToAr = `من ${periodWindow.fromIso} إلى ${periodWindow.toInclusiveIso}`
  const periodFromToEn = `${periodWindow.fromIso} to ${periodWindow.toInclusiveIso}`

  const syncStampLabel = useMemo(() => {
    const raw = liveSummary?.syncedAt ?? workspace.lastSyncedAt
    if (!raw) return isAr ? 'غير متزامن حالياً' : 'Not synced'
    const ms = Date.parse(raw)
    if (!Number.isFinite(ms)) return raw
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuwait',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(ms))
  }, [isAr, liveSummary?.syncedAt, workspace.lastSyncedAt])

  // 10-KWD breakdown derived strictly from Odoo GL (`account.move.line`) when available
  const { food10, delivery10, opexRent10, netPocket10 } = workspace.per10
  const beforeRentRatio = hasFullGl && gl.beforeRentPct !== null ? gl.beforeRentPct / 100 : 0
  const beforeRentKwd = hasFullGl && gl.beforeRentKwd !== null ? gl.beforeRentKwd : 0
  const netPocketKwd = hasFullGl && gl.operatingProfitKwd !== null ? gl.operatingProfitKwd : 0
  const netPocketPct = hasFullGl && gl.netProfitPct !== null ? gl.netProfitPct : 0

  const fmtKwdVal = useCallback(
    (v: number) => {
      const absV = Math.abs(Number.isFinite(v) ? v : 0)
      const sign = v < 0 ? '-' : ''
      const num = absV >= 100 ? f0(absV) : f1(absV)
      return isAr ? `${sign}${num} د.ك` : `${sign}${num} KWD`
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
    const canPlotPointMargin = hasFullGl && flowGroup === 'timeline'
    return src.map((pt) => {
      const sales = Math.max(0, pt.salesKwd)
      const pointMarginPct = canPlotPointMargin ? netPocketPct : 0
      const pointMarginRatio = canPlotPointMargin ? pointMarginPct / 100 : 0
      const pocket = canPlotPointMargin ? Math.max(0, sales * pointMarginRatio) : 0
      const beforeRent = canPlotPointMargin ? Math.max(0, sales * beforeRentRatio) : 0
      const foodAndDelivery = canPlotPointMargin ? Math.max(0, sales - beforeRent) : 0
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
        netKwd: maskInternalCosts || !canPlotPointMargin ? 0 : pocket,
        netMarginPct: maskInternalCosts || !canPlotPointMargin ? 0 : pointMarginPct,
        lines: maskInternalCosts
          ? [
              { label: isAr ? 'المبيعات:' : 'Sales:', value: fmtKwdVal(sales), bold: true },
              {
                label: isAr ? 'الإيجارات والرواتب والموردين:' : 'Rent, Payroll & Suppliers:',
                value: isAr ? 'محصور بالمالية والمدير العام' : 'Restricted to Finance/GM',
                tone: 'slate',
              },
            ]
          : canPlotPointMargin
            ? [
                { label: isAr ? 'المبيعات (pos.order):' : 'Sales (pos.order):', value: fmtKwdVal(sales), bold: true },
                {
                  label: isAr ? 'المواد والعمولات المرحّلة:' : 'Posted COGS & Commissions:',
                  value: fmtKwdVal(foodAndDelivery),
                  tone: 'amber',
                },
                {
                  label: isAr ? 'الباقي قبل الإيجار:' : 'Before Rent:',
                  value: fmtKwdVal(beforeRent),
                  tone: 'slate',
                },
                {
                  label: isAr ? 'صافي التشغيل (دفتر الأستاذ):' : 'GL Operating Net:',
                  value: fmtKwdVal(pocket),
                  tone: 'emerald',
                  bold: true,
                },
                {
                  label: isAr ? 'هامش دفتر الأستاذ:' : 'GL Margin:',
                  value: `${f1(pointMarginPct)}%`,
                  tone: 'emerald',
                },
              ]
            : [
                { label: isAr ? 'المبيعات (pos.order):' : 'Sales (pos.order):', value: fmtKwdVal(sales), bold: true },
                {
                  label: isAr ? 'هامش الربح المحاسبي:' : 'Accounting Profit Margin:',
                  value: isAr ? 'غير متوفر (account.move.line)' : 'Not available (account.move.line)',
                  tone: 'amber',
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
    hasFullGl,
    isAr,
    maskInternalCosts,
    netPocketPct,
  ])

  const tenKwdDonutSlices = useMemo<DonutSliceDatum[]>(() => {
    if (!hasFullGl) return []
    const foodTotal = gl.cogsKwd ?? 0
    const deliveryTotal = gl.deliveryCommissionsKwd ?? 0
    const opexTotal = gl.otherOpexAndDepreciationKwd ?? 0
    const pocketTotal = gl.operatingProfitKwd ?? 0

    return [
      {
        id: 'food',
        label: isAr ? 'تكلفة البضاعة والمواد (COGS)' : 'Cost of Goods & Packaging (COGS)',
        subLabel: isAr
          ? `من كل 10 د.ك • قيود أودو ${fmtKwdVal(foodTotal)}`
          : `per 10 KWD • Odoo GL ${fmtKwdVal(foodTotal)}`,
        value: Math.max(0, food10),
        valueFormatted: isAr ? `${f2(food10)} د.ك` : `${f2(food10)} KWD`,
        pctFormatted: `${f1(gl.cogsPct ?? 0)}%`,
        color: '#F59E0B',
      },
      {
        id: 'delivery',
        label: isAr ? 'عمولات التوصيل المرحّلة' : 'Posted Delivery Commissions',
        subLabel: isAr
          ? `من كل 10 د.ك • قيود أودو ${fmtKwdVal(deliveryTotal)}`
          : `per 10 KWD • Odoo GL ${fmtKwdVal(deliveryTotal)}`,
        value: Math.max(0, delivery10),
        valueFormatted: isAr ? `${f2(delivery10)} د.ك` : `${f2(delivery10)} KWD`,
        pctFormatted: `${f1(gl.deliveryCommPct ?? 0)}%`,
        color: '#F43F5E',
      },
      {
        id: 'opex',
        label: isAr ? 'الإيجارات والرواتب والإهلاك والمصاريف' : 'Rent, Payroll, Depr & Opex',
        subLabel: isAr
          ? `من كل 10 د.ك • قيود أودو ${fmtKwdVal(opexTotal)}`
          : `per 10 KWD • Odoo GL ${fmtKwdVal(opexTotal)}`,
        value: Math.max(0, opexRent10),
        valueFormatted: isAr ? `${f2(opexRent10)} د.ك` : `${f2(opexRent10)} KWD`,
        pctFormatted: `${f1(gl.opexRentDeprPct ?? 0)}%`,
        color: '#64748B',
      },
      {
        id: 'pocket',
        label: isAr ? 'صافي الربح التشغيلي (دفتر الأستاذ)' : 'GL Operating Profit',
        subLabel: isAr
          ? `من كل 10 د.ك • قيود أودو ${fmtKwdVal(pocketTotal)}`
          : `per 10 KWD • Odoo GL ${fmtKwdVal(pocketTotal)}`,
        value: Math.max(0, netPocket10),
        valueFormatted: isAr ? `${f2(netPocket10)} د.ك` : `${f2(netPocket10)} KWD`,
        pctFormatted: `${f1(gl.netProfitPct ?? 0)}%`,
        color: '#10B981',
      },
    ]
  }, [delivery10, fmtKwdVal, food10, gl, hasFullGl, isAr, netPocket10, opexRent10])

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

  const weeklyChartMeta = useMemo(
    () =>
      buildWeeklyChartMeta(
        weeklyPills.map((p) => p.id),
        { liveConnected: Boolean(liveSummary?.connected) },
      ),
    [weeklyPills, liveSummary?.connected],
  )

  const topBranchCard = useMemo(() => {
    const isUnfilteredSubScope =
      filters.brand === 'all' &&
      filters.channel === 'all' &&
      filters.kuwaitSlice === 'all' &&
      filters.lens === 'all'
    const bucketKey =
      filters.period === 'today' ||
      filters.period === 'week' ||
      filters.period === 'month' ||
      filters.period === 'year'
        ? filters.period
        : null
    const bucketMapLoc = bucketKey
      ? liveSummary?.buckets?.[bucketKey]?.mappedByLocation ??
        liveSummary?.buckets?.[bucketKey]?.byLocation ??
        null
      : null
    const periodBranches = isUnfilteredSubScope
      ? bucketKey
        ? liveSummary?.bucket === bucketKey && Array.isArray(liveSummary?.branches)
          ? liveSummary.branches
          : bucketMapLoc
            ? Object.entries(bucketMapLoc).map(([id, v]) => ({
                id,
                netSalesKwd: v.netKwd,
                orders: v.orders,
              }))
            : liveSummary?.branches ?? null
        : filters.period === 'custom'
          ? liveSummary?.customBucket?.mappedByLocation
            ? Object.entries(liveSummary.customBucket.mappedByLocation).map(([id, v]) => ({
                id,
                netSalesKwd: v.netKwd,
                orders: v.orders,
              }))
            : liveSummary?.period?.from === filters.customFrom &&
                liveSummary?.period?.to === filters.customTo
              ? liveSummary?.branches ?? null
              : null
          : null
      : null
    return resolveTopBranchCard({
      branches: periodBranches,
      period: filters.period,
      branchFilter: filters.branch,
      subScopeRatio: 1,
      fallbackBranches: coresSnap.sales.branchRanking,
    })
  }, [
    coresSnap.sales.branchRanking,
    filters.branch,
    filters.brand,
    filters.channel,
    filters.customFrom,
    filters.customTo,
    filters.kuwaitSlice,
    filters.lens,
    filters.period,
    liveSummary?.branches,
    liveSummary?.bucket,
    liveSummary?.buckets,
    liveSummary?.customBucket,
    liveSummary?.period?.from,
    liveSummary?.period?.to,
  ])
  const heroDelta = useMemo(() => {
    const rolling30Net = liveSummary?.journeyPulse?.rolling30?.netKwd ?? 0
    const prior30Net = liveSummary?.journeyPulse?.prior30?.netKwd ?? 0
    const isUnfilteredMonth =
      filters.period === 'month' &&
      filters.brand === 'all' &&
      filters.branch === 'all' &&
      filters.channel === 'all' &&
      filters.kuwaitSlice === 'all' &&
      filters.lens === 'all'
    if (isUnfilteredMonth && rolling30Net > 50_000 && prior30Net > 50_000) {
      return computePeriodDelta(rolling30Net, prior30Net)
    }
    const pct = computePeriodOverPeriodDeltaPct(filters, workspace, liveSummary)
    return computePeriodDelta(100 + pct, 100)
  }, [filters, liveSummary, workspace])

  const adminUnmappedNetKwd =
    sessionRole === 'admin' && !auditorReadOnly
      ? Math.max(0, liveSummary?.companyTotals?.unmappedTerminalsNetKwd ?? 0)
      : 0

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
          {canSyncOdoo ? (
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

      {adminUnmappedNetKwd > 0 ? (
        <div
          role="status"
          data-admin-unmapped-banner="true"
          className="ae-bento-card flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-amber-50/90 px-4 py-3 text-[13px] font-semibold text-amber-900 ring-1 ring-amber-500/25 dark:bg-amber-950/35 dark:text-amber-200 dark:ring-amber-400/25"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              {isAr
                ? `«${formatAdminUnmappedAlertCopy(adminUnmappedNetKwd, true)}»`
                : formatAdminUnmappedAlertCopy(adminUnmappedNetKwd, false)}
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              document
                .getElementById('admin-pos-terminal-mapping')
                ?.scrollIntoView({ behavior: 'smooth' })
            }
            className="inline-flex shrink-0 cursor-pointer items-center rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-950 transition-colors hover:bg-amber-500/25 dark:text-amber-100"
          >
            {T('Map POS Terminals ↓', 'ربط أجهزة الكاشير ↓')}
          </button>
        </div>
      ) : null}

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
                    heroDelta.tone === 'red'
                      ? 'bg-rose-500/25 text-rose-50 ring-1 ring-rose-300/35'
                      : heroDelta.tone === 'neutral'
                        ? 'bg-slate-900/25 text-white/90 ring-1 ring-white/20'
                        : 'bg-white/15 text-white'
                  }`}
                >
                  {heroDelta.badgeLabel} {T('vs prior period', 'مقارنة بالفترة السابقة')}
                </span>
                <span className="whitespace-normal text-[13px] font-medium tabular-nums text-white/85">
                  {isAr ? `• متوسط ${f2(workspace.aovKwd)} د.ك` : `• AOV ${f2(workspace.aovKwd)} KWD`}
                </span>
              </div>
              {(liveSummary?.companyTotals?.unmappedTerminalsNetKwd ?? 0) > 0 &&
              filters.brand === 'all' &&
              filters.branch === 'all' ? (
                <p className="whitespace-normal text-xs lg:text-[13px] font-medium tabular-nums text-white/80">
                  {isAr
                    ? `${UNMAPPED_TERMINALS_LABEL_AR}: ${f0(liveSummary!.companyTotals!.unmappedTerminalsNetKwd)} د.ك`
                    : `${UNMAPPED_TERMINALS_LABEL_EN}: ${f0(liveSummary!.companyTotals!.unmappedTerminalsNetKwd)} KWD`}
                </p>
              ) : null}
              <p className="whitespace-normal pt-0.5 text-xs font-medium tabular-nums text-white/80">
                {isAr
                  ? `الفترة: ${periodFromToAr} • المصدر: أودو 17 (pos.order) • آخر مزامنة: ${syncStampLabel}`
                  : `Period: ${periodFromToEn} • Source: Odoo 17 (pos.order) • Synced: ${syncStampLabel}`}
              </p>
            </div>
          </article>

          {/* Card 2 (Matte `#111A17`): Orders & Left Before Rent */}
          <article className="ae-kpi-card flex min-w-0 flex-col justify-between rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09]">
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                {maskInternalCosts
                  ? T('Total Orders', 'إجمالي الطلبات')
                  : T('Orders & Before Rent', 'الطلبات والباقي قبل الإيجار')}
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

            <div className="mt-3.5 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {maskInternalCosts ? (
                  <span
                    data-cost-mask="restricted-finance-gm"
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs lg:text-[13px] font-semibold text-slate-700 ring-1 ring-slate-900/10 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/10"
                  >
                    {T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')}
                  </span>
                ) : hasFullGl ? (
                  <>
                    <span
                      dir="ltr"
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs lg:text-[13px] font-semibold tabular-nums ${
                        beforeRentRatio < 0
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                      }`}
                    >
                      {formatStaticMarginPill(beforeRentRatio * 100)} • {fmtKwdVal(beforeRentKwd)}
                    </span>
                    <span className="whitespace-normal text-[13px] font-medium text-slate-600 dark:text-[#8FA39B]">
                      {isAr ? 'بعد المواد والعمولات المرحّلة' : 'after posted COGS & commissions'}
                    </span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs lg:text-[13px] font-semibold text-amber-800 ring-1 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300">
                    {gl.cogsPct !== null
                      ? isAr
                        ? `تكلفة المواد المرحّلة ${f1(gl.cogsPct)}% • الباقي: غير متوفر`
                        : `Posted COGS ${f1(gl.cogsPct)}% • Before rent: Not available`
                      : T('Before rent %: Not available', 'الباقي قبل الإيجار: غير متوفر')}
                  </span>
                )}
              </div>
              <p className="whitespace-normal text-xs font-medium tabular-nums text-slate-500 dark:text-[#8FA39B]">
                {isAr
                  ? `الفترة: ${periodFromToAr} • المصدر: أودو 17 (pos.order + account.move.line) • آخر مزامنة: ${syncStampLabel}`
                  : `Period: ${periodFromToEn} • Source: Odoo 17 (pos.order + account.move.line) • Synced: ${syncStampLabel}`}
              </p>
            </div>
          </article>

          {/* Card 3 (Matte `#111A17`): Net Pocket Profit */}
          <article className="ae-kpi-card flex min-w-0 flex-col justify-between rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09]">
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                {T('Net Pocket Profit', 'الصافي بالجيب')}
              </p>
              <Link
                href="/erp/executive-pnl"
                aria-label={T('Inspect Net Profit Impact', 'تفاصيل الصافي بالجيب')}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-900/[0.06] transition-transform duration-150 hover:scale-105 dark:bg-white/[0.06] dark:text-emerald-200 dark:ring-white/10"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            {maskInternalCosts ? (
              <>
                <div className="mt-3 text-[16px] sm:text-[18px] font-semibold leading-snug tracking-tight text-slate-700 dark:text-slate-200">
                  {T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')}
                </div>
                <div className="mt-3.5 space-y-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs lg:text-[13px] font-semibold text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">
                    {T(
                      'Rent, payroll & supplier figures masked',
                      'بيانات الإيجار والرواتب والموردين محجوبة',
                    )}
                  </span>
                </div>
              </>
            ) : hasFullGl ? (
              <>
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
                        : netPocketPct >= 10
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                    }`}
                  >
                    {formatStaticMarginPill(netPocketPct, T('GL net share', 'نسبة الصافي المحاسبي'))}
                  </span>
                  <p className="whitespace-normal text-[13px] font-medium leading-snug text-slate-600 dark:text-slate-300">
                    {isAr
                      ? 'الصافي الفعلي بعد الإيجار وكافة المصاريف'
                      : 'Actual net operating profit after rent & all expenses'}
                  </p>
                  <p className="whitespace-normal text-xs font-medium tabular-nums text-slate-500 dark:text-[#8FA39B]">
                    {isAr
                      ? `الفترة: من ${gl.from} إلى ${gl.to} • المصدر: أودو 17 (account.move.line) • آخر مزامنة: ${syncStampLabel}`
                      : `Period: ${gl.from} to ${gl.to} • Source: Odoo 17 (account.move.line) • Synced: ${syncStampLabel}`}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="mt-3 text-xl sm:text-[26px] font-semibold leading-tight tracking-tight text-amber-700 dark:text-amber-300">
                  {T('Not available', 'غير متوفر')}
                </div>

                <div className="mt-3.5 space-y-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs lg:text-[13px] font-semibold text-amber-800 ring-1 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300">
                    {T('Profit %: Not available', 'نسبة الربح: غير متوفر')}
                  </span>
                  <p className="whitespace-normal text-[12.5px] font-medium leading-snug text-slate-600 dark:text-slate-300">
                    {isAr
                      ? `الصافي الفعلي بعد الإيجار وكافة المصاريف (${gl.unavailableReasonAr ?? 'غير متوفر'})`
                      : `Actual net profit after rent & all expenses (${gl.unavailableReasonEn ?? 'Not available'})`}
                  </p>
                  <p className="whitespace-normal text-xs font-medium tabular-nums text-slate-500 dark:text-[#8FA39B]">
                    {isAr
                      ? `الفترة: من ${gl.from} إلى ${gl.to} • المصدر: أودو 17 (account.move.line) • آخر مزامنة: ${syncStampLabel}`
                      : `Period: ${gl.from} to ${gl.to} • Source: Odoo 17 (account.move.line) • Synced: ${syncStampLabel}`}
                  </p>
                </div>
              </>
            )}
          </article>

          {/* Card 4 (Matte `#111A17`): Recoverable Profit / Quiet-Hour Opportunities */}
          {maskInternalCosts ? (
            <Link
              href="/erp/weekday-comparison"
              className="ae-kpi-card group flex min-w-0 flex-col justify-between rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] transition-transform duration-150 hover:-translate-y-0.5 dark:bg-[#111A17] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09]"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                  {T('Quiet-Hour Demand Upside (3–6 PM)', 'فرصة نمو الساعات الهادئة (3–6 م)')}
                </p>
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-900/[0.06] transition-transform duration-150 group-hover:scale-105 dark:bg-white/[0.06] dark:text-emerald-200 dark:ring-white/10">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>

              <div
                dir="ltr"
                className="mt-3 text-2xl sm:text-[32px] font-semibold leading-tight tracking-tight tabular-nums text-slate-950 dark:text-white"
              >
                {quietHoursCard
                  ? isAr
                    ? quietHoursCard.valueAr
                    : quietHoursCard.valueEn
                  : `+${fmtKwdVal(0)}`}
              </div>

              <div className="mt-3.5 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs lg:text-[13px] font-semibold tabular-nums text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    {T(
                      '7 active branches · Afternoon bundle campaigns',
                      '7 فروع نشطة · حملات عروض فترة العصر',
                    )}
                  </span>
                  <span className="text-xs lg:text-[13px] font-bold text-emerald-700 dark:text-emerald-300">
                    {T('View Steps ↗', 'عرض الخطوات ↗')}
                  </span>
                </div>
                <p className="whitespace-normal text-xs font-medium tabular-nums text-slate-500 dark:text-[#8FA39B]">
                  {isAr
                    ? `الفترة: ${periodFromToAr} • المصدر: أودو 17 (pos.order) • آخر مزامنة: ${syncStampLabel}`
                    : `Period: ${periodFromToEn} • Source: Odoo 17 (pos.order) • Synced: ${syncStampLabel}`}
                </p>
              </div>
            </Link>
          ) : (
            <Link
              href="/erp/planning"
              className="ae-kpi-card group flex min-w-0 flex-col justify-between rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] transition-transform duration-150 hover:-translate-y-0.5 dark:bg-[#111A17] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                    {T('Recoverable Profit Opportunities', 'فرص زيادة الربح المتاحة')}
                  </p>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 ring-1 ring-amber-500/25 dark:bg-amber-500/20 dark:text-amber-200">
                    {T('Estimate', 'تقدير')}
                  </span>
                </div>
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-900/[0.06] transition-transform duration-150 group-hover:scale-105 dark:bg-white/[0.06] dark:text-emerald-200 dark:ring-white/10">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-baseline gap-2">
                <div
                  dir="ltr"
                  className="text-2xl sm:text-[32px] font-semibold leading-tight tracking-tight tabular-nums text-slate-950 dark:text-white"
                >
                  +{fmtKwdVal(workspace.totalPlaysBenefitPeriodKwd)}
                </div>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  ({T('Estimate', 'تقدير')})
                </span>
              </div>

              <div className="mt-3.5 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
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
                <p className="whitespace-normal text-xs font-medium tabular-nums text-slate-500 dark:text-[#8FA39B]">
                  {isAr
                    ? `الفترة: ${periodFromToAr} • المصدر: نموذج فرص التحسين • آخر مزامنة: ${syncStampLabel}`
                    : `Period: ${periodFromToEn} • Source: Modeled Ops Plays • Synced: ${syncStampLabel}`}
                </p>
              </div>
            </Link>
          )}
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
                  {isAr ? weeklyChartMeta.subtitleAr : weeklyChartMeta.subtitleEn}
                </p>
              </div>

              {activeWeeklyDay ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-[#F6F7F8] px-3 py-1 text-xs lg:text-[13px] font-semibold tabular-nums text-slate-800 ring-1 ring-slate-900/[0.06] dark:bg-[#141F1B] dark:text-emerald-200 dark:ring-emerald-400/[0.14]">
                  <span>{isAr ? activeWeeklyDay.dayNameAr : activeWeeklyDay.dayNameEn}</span>
                  <span aria-hidden className="text-slate-300 dark:text-white/20">
                    •
                  </span>
                  <span dir="ltr">{fmtKwdVal(activeWeeklyDay.salesKwd)}</span>
                  {weeklyChartMeta.bars.find((b) => b.id === activeWeeklyDay.id)?.isPartialToday ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">
                      {T('Partial', 'جزئي')}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* 7 Sculptural Vertical Pill-Shaped Bars (`grid-cols-7`) */}
            <div
              dir="ltr"
              className="mt-5 grid grid-cols-7 items-end gap-2.5 sm:gap-4 pt-6 pb-1"
            >
              {weeklyPills.map((day, barIdx) => {
                const isSelected = day.id === activePillId
                const isPartialToday = Boolean(weeklyChartMeta.bars[barIdx]?.isPartialToday)
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setSelectedPillId(day.id)}
                    onMouseEnter={() => setSelectedPillId(day.id)}
                    aria-pressed={isSelected}
                    aria-label={`${day.dayNameEn} (${day.shortDate})${isPartialToday ? ' Partial' : ''}: ${fmtKwdVal(day.salesKwd)}`}
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
                      ) : isPartialToday ? (
                        <span className="mb-2 inline-flex items-center whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-500/30 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/30">
                          {T('Partial', 'جزئي')}
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
                    {isPartialToday && isSelected ? (
                      <span className="mt-1 inline-flex items-center whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-500/30 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/30">
                        {T('Partial', 'جزئي')}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 whitespace-normal text-xs font-medium tabular-nums text-slate-500 dark:text-[#8FA39B]">
              {isAr
                ? `الفترة: من ${weeklyPills[0]?.id ?? periodWindow.fromIso} إلى ${weeklyPills[weeklyPills.length - 1]?.id ?? periodWindow.toInclusiveIso} • المصدر: أودو 17 (pos.order) • آخر مزامنة: ${syncStampLabel}`
                : `Period: ${weeklyPills[0]?.id ?? periodWindow.fromIso} to ${weeklyPills[weeklyPills.length - 1]?.id ?? periodWindow.toInclusiveIso} • Source: Odoo 17 (pos.order) • Synced: ${syncStampLabel}`}
            </p>
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
                href={maskInternalCosts ? '/erp/weekday-comparison' : '/erp/warehouse-chain'}
                className="block rounded-2xl bg-[#F6F7F8] p-3.5 ring-1 ring-slate-900/[0.05] transition-colors hover:ring-emerald-500/35 dark:bg-[#141F1B] dark:ring-emerald-400/[0.09] dark:hover:ring-emerald-400/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="whitespace-normal text-[14px] font-semibold leading-snug text-slate-950 dark:text-white">
                    {maskInternalCosts
                      ? T('Activate Quiet Hours (3–6 PM)', 'تفعيل حملات الساعات الهادئة (3–6 م)')
                      : T('Stop #1 Operational Leak', 'إيقاف أكبر نزيف تشغيلي')}
                  </span>
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
                </div>

                <div
                  dir="ltr"
                  className="mt-1.5 text-[22px] font-semibold tracking-tight tabular-nums text-rose-600 dark:text-rose-300"
                >
                  {maskInternalCosts
                    ? quietHoursCard
                      ? isAr
                        ? quietHoursCard.valueAr
                        : quietHoursCard.valueEn
                      : `+${fmtKwdVal(0)}`
                    : procurementCard
                      ? isAr
                        ? procurementCard.valueAr
                        : procurementCard.valueEn
                      : fmtKwdVal(0)}
                </div>

                <div className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-slate-600 dark:text-[#8FA39B]">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="whitespace-normal">
                    {maskInternalCosts
                      ? T(
                          'Supplier & kitchen costs: Restricted to Finance/GM',
                          'تكاليف الموردين والمطبخ: محصور بالمالية والمدير العام',
                        )
                      : T(
                          'Window: 09:00 – 11:30 KWT · Kitchen & Supplier Audit',
                          'النافذة: 09:00 – 11:30 ص · تدقيق المطبخ والموردين',
                        )}
                  </span>
                </div>
              </Link>

              {/* Secondary Open Cumulative Balance Callout */}
              <Link
                href={maskInternalCosts ? '/erp/social-reviews' : '/erp/receivables'}
                className="block rounded-xl bg-amber-50/60 px-3 py-2.5 ring-1 ring-amber-500/20 transition-colors hover:bg-amber-50 dark:bg-amber-950/20 dark:ring-amber-400/15 dark:hover:bg-amber-950/35"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs lg:text-[13px] font-semibold text-amber-950 dark:text-amber-200">
                    {maskInternalCosts
                      ? T('Social & Brand Reviews', 'تقييمات المنصات والسمعة')
                      : T('Aggregator Receivables', 'ذمم المنصات المفتوحة')}
                  </span>
                  <span className="rounded-md bg-amber-100/90 px-1.5 py-0.5 text-xs lg:text-[13px] font-bold text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                    {maskInternalCosts
                      ? T('Marketing Scope', 'نطاق التسويق')
                      : T('Cumulative Balance', 'رصيد متراكم')}
                  </span>
                </div>
                <p className="mt-1 whitespace-normal text-xs lg:text-[13px] font-medium text-slate-600 dark:text-[#8FA39B]">
                  {maskInternalCosts
                    ? T(
                        'Monitor ratings & campaign sentiment across all 6 brands',
                        'متابعة تقييمات العملاء وتفاعل الحملات عبر العلامات التجارية الـ 6',
                      )
                    : isAr
                      ? `الفترة: من ${workspace.receivables.fromDate} إلى ${workspace.receivables.toDate} • أعمار الذمم: 0–30ي (${f0(workspace.receivables.agingBuckets[0]?.residualKwd ?? 842)} د.ك) · 31–60ي (${f0(workspace.receivables.agingBuckets[1]?.residualKwd ?? 215)} د.ك) · +60ي (${f0(workspace.receivables.agingBuckets[2]?.residualKwd ?? 126)} د.ك) • ${f0(workspace.receivables.unreconciledLineCount)} قيد (${f0(workspace.receivables.posClearingLinesCount)} مقاصة كاشير 10552 + ${f0(workspace.receivables.platformAndCorporateLinesCount)} منصات)`
                      : `Period: ${workspace.receivables.fromDate} to ${workspace.receivables.toDate} • Aging: 0–30d (${f0(workspace.receivables.agingBuckets[0]?.residualKwd ?? 842)} KWD) · 31–60d (${f0(workspace.receivables.agingBuckets[1]?.residualKwd ?? 215)} KWD) · >60d (${f0(workspace.receivables.agingBuckets[2]?.residualKwd ?? 126)} KWD) • ${f0(workspace.receivables.unreconciledLineCount)} lines (${f0(workspace.receivables.posClearingLinesCount)} POS clearing + ${f0(workspace.receivables.platformAndCorporateLinesCount)} platforms)`}
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
                        {topBranchCard
                          ? isAr
                            ? topBranchCard.labelAr
                            : topBranchCard.labelEn
                          : T('Lead Branch', 'الفرع المتصدر')}
                      </p>
                      <p className="mt-0.5 text-xs lg:text-[13px] font-medium text-slate-600 dark:text-slate-300">
                        {topBranchCard
                          ? isAr
                            ? topBranchCard.subtitleAr
                            : topBranchCard.subtitleEn
                          : T('Peak POS Revenue · This Month', 'أعلى إيراد نقاط بيع · الشهر')}
                      </p>
                    </div>
                  </div>
                  <span
                    dir="ltr"
                    className="shrink-0 text-xs lg:text-[13px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"
                  >
                    {topBranchCard ? fmtKwdVal(topBranchCard.netSalesKwd) : fmtKwdVal(workspace.salesKwd)}
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
                  href={maskInternalCosts ? '/erp/cores' : '/erp/receivables'}
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
                      <p className="mt-0.5 whitespace-normal text-xs lg:text-[13px] font-medium text-slate-600 dark:text-slate-300">
                        {isAr
                          ? `من ${workspace.receivables.fromDate} إلى ${workspace.receivables.toDate} • آخر استحقاق ${workspace.receivables.latestMaturityDate ?? 'حالي'}`
                          : `${workspace.receivables.fromDate}–${workspace.receivables.toDate} • Due ${workspace.receivables.latestMaturityDate ?? 'Current'}`}
                      </p>
                    </div>
                  </div>
                  <span
                    dir="ltr"
                    className="shrink-0 text-xs lg:text-[13px] font-semibold tabular-nums text-amber-700 dark:text-amber-300"
                  >
                    {maskInternalCosts
                      ? T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')
                      : receivablesCard
                        ? isAr
                          ? receivablesCard.valueAr
                          : receivablesCard.valueEn
                        : fmtKwdVal(0)}
                  </span>
                </Link>

                {/* Pulse Item 4: Kitchen Prep & Delivery SLA */}
                <Link
                  href={maskInternalCosts ? '/erp/social-reviews' : '/erp/prep-sla'}
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

                {(liveSummary?.companyTotals?.unmappedTerminalsNetKwd ?? 0) > 0 &&
                filters.brand === 'all' &&
                filters.branch === 'all' ? (
                  <div className="flex items-center justify-between gap-2.5 rounded-xl bg-[#F6F7F8] p-2.5 ring-1 ring-slate-900/[0.04] dark:bg-[#141F1B] dark:ring-emerald-400/[0.08]">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="whitespace-normal text-[13px] lg:text-sm font-semibold leading-tight text-slate-900 dark:text-white">
                          {isAr ? UNMAPPED_TERMINALS_LABEL_AR : UNMAPPED_TERMINALS_LABEL_EN}
                        </p>
                        <p className="mt-0.5 text-xs lg:text-[13px] font-medium text-slate-600 dark:text-slate-300">
                          {T('Included in total company sales', 'مشمولة ضمن إجمالي مبيعات الشركة')}
                        </p>
                      </div>
                    </div>
                    <span
                      dir="ltr"
                      className="shrink-0 text-xs lg:text-[13px] font-semibold tabular-nums text-amber-700 dark:text-amber-300"
                    >
                      {fmtKwdVal(liveSummary!.companyTotals!.unmappedTerminalsNetKwd)}
                    </span>
                  </div>
                ) : null}
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
              salesLegend={T('Sales (pos.order)', 'المبيعات (pos.order)')}
              netLegend={
                hasFullGl
                  ? T('GL Operating Profit', 'صافي التشغيل (دفتر الأستاذ)')
                  : T('GL Profit (Not available)', 'صافي الربح (غير متوفر)')
              }
              heightClass="h-60 sm:h-64"
            />
            <p className="mt-2.5 whitespace-normal text-xs font-medium tabular-nums text-slate-500 dark:text-[#8FA39B]">
              {isAr
                ? `الفترة: ${periodFromToAr} • المصدر: أودو 17 (pos.order + account.move.line) • آخر مزامنة: ${syncStampLabel}`
                : `Period: ${periodFromToEn} • Source: Odoo 17 (pos.order + account.move.line) • Synced: ${syncStampLabel}`}
            </p>
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
                {T(
                  'Computed dynamically from Odoo 17 General Ledger (account.move.line)',
                  'محسوب مباشرة من قيود دفتر الأستاذ العام في أودو 17 (account.move.line)',
                )}
              </p>
            </div>

            {maskInternalCosts ? (
              <div className="flex flex-1 flex-col justify-between gap-3 rounded-2xl bg-[#F6F7F8] p-4 ring-1 ring-slate-900/[0.05] dark:bg-[#141F1B] dark:ring-emerald-400/[0.1]">
                <div className="space-y-1.5">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
                    {T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')}
                  </span>
                  <p className="whitespace-normal text-[13.5px] font-medium leading-relaxed text-slate-700 dark:text-slate-200">
                    {T(
                      'Internal lease rent, payroll ledger, supplier procurement costs, and net pocket margin splits are restricted to Finance (CFO), GM, DGM, and System Admin.',
                      'تفاصيل عقود الإيجار، مسيرات الرواتب، تكاليف الموردين، وصافي الهامش محصورة بالمدير المالي والمدير العام ونائبه ومسؤول النظام.',
                    )}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs font-semibold">
                  <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:ring-white/[0.06]">
                    <span className="block text-slate-500 dark:text-[#8FA39B]">
                      {T('Rent & Payroll', 'الإيجار والرواتب')}
                    </span>
                    <span className="mt-0.5 block text-slate-800 dark:text-slate-100">
                      {T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')}
                    </span>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:ring-white/[0.06]">
                    <span className="block text-slate-500 dark:text-[#8FA39B]">
                      {T('Supplier Cost', 'تكاليف الموردين')}
                    </span>
                    <span className="mt-0.5 block text-slate-800 dark:text-slate-100">
                      {T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')}
                    </span>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:ring-white/[0.06]">
                    <span className="block text-slate-500 dark:text-[#8FA39B]">
                      {T('Net Pocket', 'الصافي بالجيب')}
                    </span>
                    <span className="mt-0.5 block text-slate-800 dark:text-slate-100">
                      {T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')}
                    </span>
                  </div>
                </div>
              </div>
            ) : hasFullGl ? (
              <div className="space-y-2.5">
                <InteractiveDonutChart
                  slices={tenKwdDonutSlices}
                  centerValue={isAr ? `${f2(netPocket10)} د.ك` : `${f2(netPocket10)} KWD`}
                  centerSubValue={T('per 10 KWD', 'من كل 10 د.ك')}
                  centerLabel={T('GL Net Share', 'نصيب الصافي')}
                  isAr={isAr}
                  legendLayout="beside"
                />
                <p className="whitespace-normal text-xs font-medium tabular-nums text-slate-500 dark:text-[#8FA39B]">
                  {isAr
                    ? `الفترة: من ${gl.from} إلى ${gl.to} • المصدر: أودو 17 (account.move.line · ${f0(gl.lineCount)} قيد) • آخر مزامنة: ${syncStampLabel}`
                    : `Period: ${gl.from} to ${gl.to} • Source: Odoo 17 (account.move.line · ${f0(gl.lineCount)} lines) • Synced: ${syncStampLabel}`}
                </p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col justify-between gap-3 rounded-2xl bg-amber-50/60 p-4 ring-1 ring-amber-500/20 dark:bg-amber-950/20 dark:ring-amber-400/20">
                <div className="space-y-2">
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                    {T('Not available', 'غير متوفر')}
                  </span>
                  <p className="whitespace-normal text-[13.5px] font-medium leading-relaxed text-slate-800 dark:text-slate-200">
                    {isAr
                      ? gl.unavailableReasonAr ?? 'بيانات قيود المحاسبة غير متوفرة لهذه الفترة.'
                      : gl.unavailableReasonEn ?? 'Accounting journal entries are not available for this period.'}
                  </p>
                  {gl.cogsPct !== null && gl.cogsKwd !== null ? (
                    <p className="whitespace-normal text-xs font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                      {isAr
                        ? `تكلفة المواد المرحّلة في الفترة: ${f1(gl.cogsPct)}% (${fmtKwdVal(gl.cogsKwd)}) • باقي النسب: غير متوفر`
                        : `Posted COGS in period: ${f1(gl.cogsPct)}% (${fmtKwdVal(gl.cogsKwd)}) • Other ratios: Not available`}
                    </p>
                  ) : null}
                </div>
                <p className="whitespace-normal text-xs font-medium tabular-nums text-slate-600 dark:text-[#8FA39B]">
                  {isAr
                    ? `الفترة: من ${gl.from} إلى ${gl.to} • المصدر: أودو 17 (account.move.line) • آخر مزامنة: ${syncStampLabel}`
                    : `Period: ${gl.from} to ${gl.to} • Source: Odoo 17 (account.move.line) • Synced: ${syncStampLabel}`}
                </p>
              </div>
            )}
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
            {workspace.summaryCards
              .map((rawCard) =>
                isErpRouteAllowedForRole(sessionRole, rawCard.href)
                  ? rawCard
                  : { ...rawCard, href: '/erp/cores' },
              )
              .map((c) => {
              const isSensitiveCostCard =
                maskInternalCosts &&
                (c.id === 'food-waste' ||
                  c.id === 'delivery-dues' ||
                  c.id === 'expiring-items')
              const badgeLabel = isSensitiveCostCard
                ? T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')
                : c.id === 'delivery-dues'
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
                      {isSensitiveCostCard ? (
                        <span className="text-[16px] sm:text-[18px] text-slate-700 dark:text-slate-200">
                          {T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')}
                        </span>
                      ) : c.id === 'branch-discipline' ? (
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
                      {isSensitiveCostCard
                        ? T(
                            'Internal supplier, procurement & treasury ledger figures are restricted to Finance/GM.',
                            'تفاصيل الموردين والذمم والمخزون المالي محصورة بالإدارة المالية والمدير العام.',
                          )
                        : isAr
                          ? c.descAr
                          : c.descEn}
                    </p>
                    {!isSensitiveCostCard ? (
                      <p className="whitespace-normal text-xs font-medium tabular-nums text-slate-500 dark:text-[#8FA39B]">
                        {isAr
                          ? `الفترة: ${c.periodLabelAr ?? periodFromToAr} • المصدر: ${c.sourceLabelAr ?? 'أودو 17'} • آخر مزامنة: ${syncStampLabel}`
                          : `Period: ${c.periodLabelEn ?? periodFromToEn} • Source: ${c.sourceLabelEn ?? 'Odoo 17'} • Synced: ${syncStampLabel}`}
                      </p>
                    ) : null}
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

        {sessionRole === 'admin' && !auditorReadOnly ? (
          <div id="admin-pos-terminal-mapping" className="space-y-5">
            <AdminPosTerminalMappingPanel role={sessionRole} />
            <AdminExecutiveDirectoryCard role={sessionRole} />
          </div>
        ) : null}
      </section>
    </div>
  )
}
