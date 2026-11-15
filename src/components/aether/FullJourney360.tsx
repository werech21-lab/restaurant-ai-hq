'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarRange,
  Database,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { AdminExecutiveDirectoryCard } from '@/components/erp/AdminExecutiveDirectoryCard'
import { AdminPosTerminalMappingPanel } from '@/components/erp/AdminPosTerminalMappingPanel'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
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
import {
  computeCoresHubSnapshot,
  UNATTRIBUTED_BRANCH_LABEL_AR,
  UNATTRIBUTED_BRANCH_LABEL_EN,
} from '@/lib/aether/cores-hub-engine'
import {
  APPROVED_BRANCH_IDS,
  computePeriodOverPeriodDeltaPct,
  formatPeriodCalendarWindow,
  getBranchLabel,
} from '@/lib/aether/global-filter-engine'
import {
  buildWeeklyChartMeta,
  computePeriodDelta,
  formatAdminUnmappedAlertCopy,
  formatStaticMarginPill,
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

const NO_ODOO_DATA_AR = 'لا توجد بيانات من Odoo لهذه الفترة'
const GL_INCOMPLETE_AR = 'قيود غير مكتملة لهذه الفترة'
const UNPOSTED_COMMISSION_AR = 'غير مُرحَّل بعد'

interface BranchCardRow {
  id: string
  labelAr: string
  labelEn: string
  isUnattributed: boolean
  salesKwd: number
  orders: number
  aovKwd: number
  sharePct: number
}

/** ملخص الشركة — لوحة القيادة التنفيذية المربوطة مباشرةً ببيانات Odoo 17 */
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

  const refreshOdoo = useCallback(async () => {
    setSyncing(true)
    try {
      const qs =
        filters.period === 'custom'
          ? `period=custom&from=${encodeURIComponent(filters.customFrom ?? '')}&to=${encodeURIComponent(filters.customTo ?? '')}`
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
      // ignore transient network failure; state reflects disconnect honestly
    } finally {
      setSyncing(false)
    }
  }, [filters.customFrom, filters.customTo, filters.period])

  const gl = workspace.accounting
  const glIncomplete = Boolean(workspace.glIncomplete || gl.glIncomplete || !gl.completeAccrualPosted)
  const commissionUnposted = Boolean(
    workspace.aggregatorCommissionUnposted ||
      gl.aggregatorCommissionUnposted ||
      gl.deliveryCommissionsKwd === null,
  )
  const hasPostedOperatingProfit = Boolean(
    gl.available && gl.operatingProfitKwd !== null && gl.netProfitPct !== null,
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

  const provenanceRange = useMemo(
    () => ({
      from: periodWindow.fromIso,
      to: periodWindow.toInclusiveIso,
    }),
    [periodWindow.fromIso, periodWindow.toInclusiveIso],
  )

  const lastSyncIso = liveSummary?.lastSyncAt ?? liveSummary?.syncedAt ?? workspace.lastSyncAt ?? workspace.lastSyncedAt ?? null
  const isStale24h = Boolean(liveSummary?.isStale24h || workspace.isStale24h)

  const fmtKwdVal = useCallback(
    (v: number) => {
      const clean = Number.isFinite(v) ? v : 0
      const absV = Math.abs(clean)
      const sign = clean < 0 ? '-' : ''
      const hasTenths = Math.abs(absV - Math.round(absV)) >= 0.05
      const num = absV >= 1000 && !hasTenths ? f0(absV) : hasTenths ? f1(absV) : f0(absV)
      return isAr ? `${sign}${num} د.ك` : `${sign}${num} KWD`
    },
    [isAr],
  )

  const coresSnap = useMemo(
    () => computeCoresHubSnapshot(filters, [], liveSummary),
    [filters, liveSummary],
  )

  const activeBucket = useMemo(() => {
    if (!liveSummary || liveSummary.connected !== true) return null
    if (filters.period === 'custom') return liveSummary.customBucket ?? null
    return liveSummary.buckets?.[filters.period] ?? null
  }, [filters.period, liveSummary])

  // 7 Mapped Branches + Explicit 8th Row «غير منسوب لفرع»
  const branchCards = useMemo<BranchCardRow[]>(() => {
    if (!workspace.odooConnected || workspace.noData) return []

    const mappedRows: BranchCardRow[] = APPROVED_BRANCH_IDS.map((branchId) => {
      const bktLoc =
        activeBucket?.mappedByLocation?.[branchId] ?? activeBucket?.byLocation?.[branchId]
      const corePt = coresSnap.sales.branchRanking.find((x) => x.id === branchId)
      const salesKwd =
        filters.brand === 'all' && filters.channel === 'all' && bktLoc
          ? Number(bktLoc.netKwd ?? 0)
          : Number(corePt?.salesKwd ?? 0)
      const orders =
        filters.brand === 'all' && filters.channel === 'all' && bktLoc
          ? Math.round(Number(bktLoc.orders ?? 0))
          : Math.round(Number(corePt?.orders ?? 0))
      return {
        id: branchId,
        labelAr: getBranchLabel(branchId, true),
        labelEn: getBranchLabel(branchId, false),
        isUnattributed: false,
        salesKwd,
        orders,
        aovKwd: orders > 0 ? salesKwd / orders : 0,
        sharePct: 0,
      }
    }).sort((a, b) => b.salesKwd - a.salesKwd)

    const unattribSales = Math.max(0, Number(workspace.unattributedSalesKwd ?? 0))
    const unattribOrders = Math.max(0, Math.round(Number(workspace.unattributedOrders ?? 0)))

    const denom =
      mappedRows.reduce((s, r) => s + r.salesKwd, 0) + unattribSales

    const withShares = mappedRows.map((row) => ({
      ...row,
      sharePct: denom > 0 ? (row.salesKwd / denom) * 100 : 0,
    }))

    withShares.push({
      id: 'unattributed',
      labelAr: UNATTRIBUTED_BRANCH_LABEL_AR,
      labelEn: `${UNATTRIBUTED_BRANCH_LABEL_AR} (${UNATTRIBUTED_BRANCH_LABEL_EN})`,
      isUnattributed: true,
      salesKwd: unattribSales,
      orders: unattribOrders,
      aovKwd: unattribOrders > 0 ? unattribSales / unattribOrders : 0,
      sharePct: denom > 0 ? (unattribSales / denom) * 100 : 0,
    })

    return withShares
  }, [
    activeBucket,
    coresSnap.sales.branchRanking,
    filters.brand,
    filters.channel,
    workspace.noData,
    workspace.odooConnected,
    workspace.unattributedOrders,
    workspace.unattributedSalesKwd,
  ])

  const { food10, delivery10, opexRent10, netPocket10 } = workspace.per10
  const beforeRentRatio =
    gl.available && gl.beforeRentPct !== null ? gl.beforeRentPct / 100 : 0
  const netPocketKwd = gl.operatingProfitKwd ?? 0
  const netPocketPct = gl.netProfitPct ?? 0

  const comboData = useMemo<ComboBarLineDatum[]>(() => {
    if (!workspace.odooConnected || workspace.noData) return []
    const src = flowGroup === 'branches' ? coresSnap.sales.branchRanking : coresSnap.sales.timeline
    const canPlotPointMargin =
      hasPostedOperatingProfit && !glIncomplete && flowGroup === 'timeline'
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
              : pt.id === 'unattributed'
                ? isAr
                  ? UNATTRIBUTED_BRANCH_LABEL_AR
                  : 'Unattributed'
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
              ]
            : [
                { label: isAr ? 'المبيعات (pos.order):' : 'Sales (pos.order):', value: fmtKwdVal(sales), bold: true },
                {
                  label: isAr ? 'حالة قيود الربح:' : 'GL Profit Status:',
                  value: GL_INCOMPLETE_AR,
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
    glIncomplete,
    hasPostedOperatingProfit,
    isAr,
    maskInternalCosts,
    netPocketPct,
    workspace.noData,
    workspace.odooConnected,
  ])

  const tenKwdDonutSlices = useMemo<DonutSliceDatum[]>(() => {
    if (!hasPostedOperatingProfit || glIncomplete || commissionUnposted) return []
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
  }, [
    commissionUnposted,
    delivery10,
    fmtKwdVal,
    food10,
    gl,
    glIncomplete,
    hasPostedOperatingProfit,
    isAr,
    netPocket10,
    opexRent10,
  ])

  const weeklyPills = useMemo(() => {
    if (!workspace.odooConnected || workspace.noData) return []
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
        : Math.max(24, Math.min(96, Math.round((salesKwd / maxSales) * 100)))
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
      }
    })
  }, [coresSnap.sales.timeline, filters, liveSummary, workspace.noData, workspace.odooConnected])

  const peakPillId = useMemo(
    () => weeklyPills.find((p) => p.isPeak)?.id ?? weeklyPills[0]?.id ?? '',
    [weeklyPills],
  )

  const [selectedPillId, setSelectedPillId] = useState<string | null>(null)
  const activePillId =
    selectedPillId && weeklyPills.some((p) => p.id === selectedPillId)
      ? selectedPillId
      : peakPillId
  const activeWeeklyDay =
    weeklyPills.find((p) => p.id === activePillId) ?? weeklyPills[weeklyPills.length - 1]

  const weeklyChartMeta = useMemo(
    () =>
      buildWeeklyChartMeta(
        weeklyPills.map((p) => p.id),
        { liveConnected: Boolean(liveSummary?.connected) },
      ),
    [weeklyPills, liveSummary?.connected],
  )

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
    if (isUnfilteredMonth && rolling30Net > 0 && prior30Net > 0) {
      return computePeriodDelta(rolling30Net, prior30Net)
    }
    const pct = computePeriodOverPeriodDeltaPct(filters, workspace, liveSummary)
    return computePeriodDelta(100 + pct, 100)
  }, [filters, liveSummary, workspace])

  const adminUnmappedNetKwd =
    sessionRole === 'admin' && !auditorReadOnly && workspace.odooConnected && !workspace.noData
      ? Math.max(0, liveSummary?.companyTotals?.unmappedTerminalsNetKwd ?? workspace.unattributedSalesKwd ?? 0)
      : 0

  const isDisconnectedOrEmpty = !workspace.odooConnected || workspace.noData

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-4 sm:space-y-5 pb-28 sm:pb-12">
      {/* Executive Header Row */}
      <div className="ae-bento-card flex flex-col gap-3 rounded-2xl bg-white px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] lg:flex-row lg:items-center lg:justify-between sm:px-5 dark:bg-[#101815] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09]">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl sm:text-[24px] font-semibold tracking-tight text-slate-950 dark:text-white">
              {T('Executive Dashboard', 'لوحة القيادة التنفيذية')}
            </h2>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[13px] font-semibold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/20">
              {T('Company Summary', 'ملخص الشركة')}
            </span>
          </div>
          <p className="min-w-0 whitespace-normal text-[13px] sm:text-[13.5px] font-medium text-slate-600 dark:text-[#8FA39B]">
            {isAr ? workspace.subtitleAr : workspace.subtitleEn}
          </p>
        </div>

        <div className="flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {canSyncOdoo ? (
            <button
              type="button"
              onClick={() => void refreshOdoo()}
              disabled={syncing}
              aria-label={T('Sync Odoo', 'مزامنة أودو')}
              title={T('Sync Odoo 17 Data', 'مزامنة بيانات أودو 17')}
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
            <span>{T('Compare Dates', 'مقارنة التواريخ')}</span>
          </Link>

          <Link
            href="/erp/before-after"
            className="inline-flex h-9.5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#F6F7F8] px-3.5 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-900/[0.06] transition-colors duration-150 hover:bg-white hover:text-emerald-700 dark:bg-[#141F1B] dark:text-slate-200 dark:ring-emerald-400/[0.12] dark:hover:bg-white/[0.08] dark:hover:text-emerald-300"
          >
            <span>{T('Before & After Comparison ↗', 'مقارنة الفترات (قبل وبعد) ↗')}</span>
          </Link>
        </div>
      </div>

      {/* Honest Empty / Disconnected State — Zero Invented Numbers */}
      {isDisconnectedOrEmpty ? (
        <section
          role="status"
          data-odoo-no-data="true"
          className="ae-bento-card mx-auto my-4 rounded-3xl border border-amber-300/70 bg-white p-8 text-center shadow-xs dark:border-amber-500/30 dark:bg-[#101815]"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100/90 text-amber-700 ring-1 ring-amber-500/25 dark:bg-amber-950/60 dark:text-amber-300">
            <Database className="h-7 w-7" aria-hidden />
          </div>
          <h3 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            {NO_ODOO_DATA_AR}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {isAr
              ? (workspace.noDataMessageAr ?? NO_ODOO_DATA_AR)
              : `${NO_ODOO_DATA_AR} — No records returned from Odoo 17 for the selected filter window (${periodWindow.fromIso} → ${periodWindow.toInclusiveIso}).`}
          </p>
          {canSyncOdoo ? (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => void refreshOdoo()}
                disabled={syncing}
                className="ae-emerald-cta-pill inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                <span>{T('Retry Odoo Sync', 'إعادة مزامنة أودو')}</span>
              </button>
            </div>
          ) : null}

          {sessionRole === 'admin' && !auditorReadOnly ? (
            <div id="admin-pos-terminal-mapping" className="mt-8 space-y-5 text-start">
              <AdminPosTerminalMappingPanel role={sessionRole} />
              <AdminExecutiveDirectoryCard role={sessionRole} />
            </div>
          ) : null}
        </section>
      ) : (
        <>
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

          {/* 4-Column Executive KPI Row (Strictly Actual / Ledger Metrics — Zero Static Estimates) */}
          <section className="space-y-4 sm:space-y-5">
            <div className="ae-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {/* Card 1: Net Sales KWD */}
              <article className="ae-hero-emerald-card relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F764A] via-[#10935B] to-[#064E3B] p-3.5 sm:p-5 text-white shadow-[0_14px_30px_-10px_rgba(16,185,129,0.45)] ring-1 ring-emerald-300/25">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-white/95">
                    {T('Net Sales (KWD)', 'صافي المبيعات (د.ك)')}
                  </p>
                  <Link
                    href="/erp/cores"
                    aria-label={T('Sales Core Details', 'تفاصيل محور المبيعات')}
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

                <div className="mt-3.5 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      dir="ltr"
                      className={`ae-hero-pill inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums backdrop-blur-sm ${
                        heroDelta.tone === 'red'
                          ? 'bg-rose-500/25 text-rose-50 ring-1 ring-rose-300/35'
                          : heroDelta.tone === 'neutral'
                            ? 'bg-slate-900/25 text-white/90 ring-1 ring-white/20'
                            : 'bg-white/15 text-white'
                      }`}
                    >
                      {heroDelta.badgeLabel} {T('vs prior period', 'مقارنة بالفترة السابقة')}
                    </span>
                    <span className="whitespace-normal text-xs font-medium tabular-nums text-white/90">
                      {isAr ? `• متوسط ${f2(workspace.aovKwd)} د.ك` : `• AOV ${f2(workspace.aovKwd)} KWD`}
                    </span>
                  </div>
                  {workspace.unattributedSalesKwd > 0 &&
                  filters.brand === 'all' &&
                  filters.branch === 'all' ? (
                    <p className="whitespace-normal text-xs font-medium tabular-nums text-amber-100">
                      {isAr
                        ? `منها ${UNATTRIBUTED_BRANCH_LABEL_AR}: ${fmtKwdVal(workspace.unattributedSalesKwd)} (${f0(workspace.unattributedOrders)} طلب)`
                        : `Includes ${UNATTRIBUTED_BRANCH_LABEL_AR}: ${fmtKwdVal(workspace.unattributedSalesKwd)} (${f0(workspace.unattributedOrders)} orders)`}
                    </p>
                  ) : null}
                  <div className="rounded-xl bg-black/20 p-1.5">
                    <KpiProvenanceBadge
                      odooModel="pos.order"
                      dateRange={provenanceRange}
                      lastSyncAt={lastSyncIso}
                      isStale24h={isStale24h}
                      kind="فعلي"
                      queryOrFormula={`pos.order.read_group([['state','in',['paid','done','invoiced']], ['date_order','>=','${provenanceRange.from}'], ['date_order','<=','${provenanceRange.to}']], ['amount_total:sum','amount_tax:sum'])`}
                      compact
                      className="!mt-0"
                    />
                  </div>
                </div>
              </article>

              {/* Card 2: Total Orders & Before Rent */}
              <article className="ae-kpi-card flex min-w-0 flex-col justify-between rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09]">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                    {maskInternalCosts
                      ? T('Total Orders', 'إجمالي الطلبات')
                      : T('Orders & Before Rent', 'الطلبات والباقي قبل الإيجار')}
                  </p>
                  <Link
                    href="/erp/cores"
                    aria-label={T('Orders Details', 'تفاصيل الطلبات')}
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

                <div className="mt-3.5 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {maskInternalCosts ? (
                      <span
                        data-cost-mask="restricted-finance-gm"
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-900/10 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/10"
                      >
                        {T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')}
                      </span>
                    ) : gl.beforeRentKwd !== null && gl.beforeRentPct !== null && !glIncomplete ? (
                      <span
                        dir="ltr"
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                          beforeRentRatio < 0
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        }`}
                      >
                        {formatStaticMarginPill(gl.beforeRentPct)} • {fmtKwdVal(gl.beforeRentKwd)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300">
                        {GL_INCOMPLETE_AR}
                      </span>
                    )}
                  </div>
                  <KpiProvenanceBadge
                    odooModel="pos.order"
                    dateRange={provenanceRange}
                    lastSyncAt={lastSyncIso}
                    isStale24h={isStale24h}
                    kind="فعلي"
                    queryOrFormula={`pos.order.search_count([['state','in',['paid','done','invoiced']], ['date_order','>=','${provenanceRange.from}'], ['date_order','<=','${provenanceRange.to}']])`}
                    compact
                  />
                </div>
              </article>

              {/* Card 3: Net Operating Profit (Explicitly warns «قيود غير مكتملة لهذه الفترة» whenever glIncomplete === true) */}
              <article className="ae-kpi-card flex min-w-0 flex-col justify-between rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09]">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                    {T('Operating Net Profit (GL)', 'صافي الربح التشغيلي (دفتر الأستاذ)')}
                  </p>
                  <Link
                    href="/erp/executive-pnl"
                    aria-label={T('Inspect Profit & Loss', 'تفاصيل قائمة الدخل')}
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
                    <div className="mt-3.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">
                        {T(
                          'Rent, payroll & supplier figures masked',
                          'بيانات الإيجار والرواتب والموردين محجوبة',
                        )}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {hasPostedOperatingProfit && !glIncomplete ? (
                      <div
                        dir="ltr"
                        className="mt-3 text-2xl sm:text-[32px] font-semibold leading-tight tracking-tight tabular-nums text-slate-950 dark:text-white"
                      >
                        {fmtKwdVal(netPocketKwd)}
                      </div>
                    ) : (
                      <div className="mt-3 space-y-1">
                        <div className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100/90 px-3 py-1.5 text-sm font-extrabold text-amber-950 ring-1 ring-amber-500/30 dark:bg-amber-950/60 dark:text-amber-200">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span>{GL_INCOMPLETE_AR}</span>
                        </div>
                        {hasPostedOperatingProfit ? (
                          <p
                            dir="ltr"
                            className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400"
                          >
                            {isAr
                              ? `الرصيد المرحّل جزئياً فقط: ${fmtKwdVal(netPocketKwd)}`
                              : `Partially posted balance only: ${fmtKwdVal(netPocketKwd)}`}
                          </p>
                        ) : null}
                      </div>
                    )}

                    <div className="mt-3.5 space-y-1.5">
                      {glIncomplete ? (
                        <p className="whitespace-normal text-xs font-semibold text-amber-800 dark:text-amber-300">
                          {GL_INCOMPLETE_AR}
                          {gl.unavailableReasonAr && gl.unavailableReasonAr !== GL_INCOMPLETE_AR
                            ? ` — ${gl.unavailableReasonAr}`
                            : ''}
                        </p>
                      ) : (
                        <span
                          dir="ltr"
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        >
                          {formatStaticMarginPill(netPocketPct, T('GL net share', 'نسبة الصافي المحاسبي'))}
                        </span>
                      )}
                      <KpiProvenanceBadge
                        odooModel="account.move.line"
                        dateRange={{ from: gl.from, to: gl.to }}
                        lastSyncAt={lastSyncIso}
                        isStale24h={isStale24h}
                        kind="محسوب بمعادلة"
                        queryOrFormula="account.move.line(parent_state='posted'): Income - COGS - DeliveryCommissions - Opex - Depreciation"
                        compact
                      />
                    </div>
                  </>
                )}
              </article>

              {/* Card 4: Aggregator Commissions (Shows «غير مُرحَّل بعد» — never 0 — when unposted) */}
              <article className="ae-kpi-card flex min-w-0 flex-col justify-between rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09]">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                    {T('Aggregator Commissions', 'عمولات تطبيقات التوصيل')}
                  </p>
                  <Link
                    href={isErpRouteAllowedForRole(sessionRole, '/erp/aggregator-radar') ? '/erp/aggregator-radar' : '/erp/cores'}
                    aria-label={T('Aggregator Radar', 'رادار تطبيقات التوصيل')}
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
                    <div className="mt-3.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">
                        {T('Commission ledger restricted', 'قيود العمولات محصورة بالمالية')}
                      </span>
                    </div>
                  </>
                ) : commissionUnposted ? (
                  <>
                    <div className="mt-3">
                      <span
                        data-commission-unposted="true"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100/90 px-3 py-1.5 text-base font-extrabold text-amber-950 ring-1 ring-amber-500/30 dark:bg-amber-950/60 dark:text-amber-200"
                      >
                        {UNPOSTED_COMMISSION_AR}
                      </span>
                    </div>
                    <div className="mt-3.5 space-y-1.5">
                      <p className="whitespace-normal text-xs font-medium text-slate-600 dark:text-slate-300">
                        {isAr
                          ? 'لم تُرحَّل فواتير عمولات المنصات في دفتر الأستاذ العام لهذه الفترة بعد (لا تُعرض كصفر).'
                          : 'Platform commission invoices are not posted in Odoo GL for this window yet (never shown as zero).'}
                      </p>
                      <KpiProvenanceBadge
                        odooModel="account.move.line"
                        dateRange={{ from: gl.from, to: gl.to }}
                        lastSyncAt={lastSyncIso}
                        isStale24h={isStale24h}
                        kind="فعلي"
                        queryOrFormula="account.move.line(parent_state='posted', delivery commission expense accounts)"
                        compact
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      dir="ltr"
                      className="mt-3 text-2xl sm:text-[32px] font-semibold leading-tight tracking-tight tabular-nums text-slate-950 dark:text-white"
                    >
                      {fmtKwdVal(gl.deliveryCommissionsKwd ?? 0)}
                    </div>
                    <div className="mt-3.5 space-y-1.5">
                      {gl.deliveryCommPct !== null ? (
                        <span
                          dir="ltr"
                          className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                        >
                          {f1(gl.deliveryCommPct)}% {T('of GL revenue', 'من إيراد دفتر الأستاذ')}
                        </span>
                      ) : null}
                      <KpiProvenanceBadge
                        odooModel="account.move.line"
                        dateRange={{ from: gl.from, to: gl.to }}
                        lastSyncAt={lastSyncIso}
                        isStale24h={isStale24h}
                        kind="فعلي"
                        queryOrFormula="account.move.line(parent_state='posted', delivery commission expense accounts)"
                        compact
                      />
                    </div>
                  </>
                )}
              </article>
            </div>

            {/* 7 Mapped Branches + Explicit 8th Card «غير منسوب لفرع» */}
            <section
              aria-label={T('Branches & Unattributed POS Sales', 'أداء الفروع السبعة والمبيعات غير المنسوبة لفرع')}
              className="ae-bento-card rounded-2xl bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09]"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[16px] sm:text-[18px] font-semibold tracking-tight text-slate-950 dark:text-white">
                    {T(
                      '7 Mapped Restaurant Branches + Unattributed POS Sales',
                      'كروت الفروع السبعة + سطر المبيعات غير المنسوبة لفرع',
                    )}
                  </h2>
                  <p className="mt-0.5 text-[13px] font-medium text-slate-600 dark:text-[#8FA39B]">
                    {isAr
                      ? `مبيعات وطلبات كل فرع من إيصالات نقاط البيع في أودو 17 (${periodWindow.fromIso} → ${periodWindow.toInclusiveIso})`
                      : `Branch POS net sales & orders directly from Odoo 17 (${periodWindow.fromIso} → ${periodWindow.toInclusiveIso})`}
                  </p>
                </div>
                <KpiProvenanceBadge
                  odooModel="pos.order"
                  dateRange={provenanceRange}
                  lastSyncAt={lastSyncIso}
                  isStale24h={isStale24h}
                  kind="فعلي"
                  queryOrFormula="pos.order.read_group(groupby=['config_id']) mapped via pos-registry.json + unattributed bucket"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {branchCards.map((bRow) => (
                  <div
                    key={bRow.id}
                    data-branch-card={bRow.id}
                    className={`flex flex-col justify-between rounded-2xl p-3.5 ring-1 transition-colors ${
                      bRow.isUnattributed
                        ? 'bg-amber-50/80 ring-amber-500/30 dark:bg-amber-950/25 dark:ring-amber-400/25'
                        : 'bg-[#F6F7F8] ring-slate-900/[0.05] dark:bg-[#141F1B] dark:ring-emerald-400/[0.1]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                            bRow.isUnattributed
                              ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div>
                          <h3 className="text-[14px] font-bold text-slate-950 dark:text-white">
                            {bRow.isUnattributed
                              ? UNATTRIBUTED_BRANCH_LABEL_AR
                              : isAr
                                ? bRow.labelAr
                                : bRow.labelEn}
                          </h3>
                          <p className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                            {bRow.isUnattributed
                              ? T('Unmapped POS terminals', 'أجهزة كاشير غير مربوطة بفرع محدد')
                              : T('Mapped Odoo POS location', 'فرع مربوط في نقاط بيع أودو')}
                          </p>
                        </div>
                      </div>
                      <span
                        dir="ltr"
                        className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                          bRow.isUnattributed
                            ? 'bg-amber-200/80 text-amber-950 dark:bg-amber-900/60 dark:text-amber-200'
                            : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300'
                        }`}
                      >
                        {f1(bRow.sharePct)}%
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between gap-2">
                      <span
                        dir="ltr"
                        className="text-xl font-extrabold tabular-nums text-slate-950 dark:text-white"
                      >
                        {fmtKwdVal(bRow.salesKwd)}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                        {isAr ? `${f0(bRow.orders)} طلب` : `${f0(bRow.orders)} orders`}
                        {bRow.orders > 0
                          ? isAr
                            ? ` • متوسط ${f2(bRow.aovKwd)} د.ك`
                            : ` • AOV ${f2(bRow.aovKwd)}`
                          : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 2-Column Row: Weekly Daily POS Bars + Open Ledger Receivables & Feryal */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left (`lg:col-span-7`): Weekly Performance Analytics */}
              <div className="ae-bento-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09] lg:col-span-7">
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <h2 className="text-[16px] sm:text-[17.5px] font-semibold tracking-tight text-slate-950 dark:text-white">
                      {T('Daily POS Sales Pulse (Last 7 Days)', 'نبض مبيعات نقاط البيع اليومي (آخر 7 أيام)')}
                    </h2>
                    <p className="mt-0.5 whitespace-normal text-[13px] font-medium text-slate-600 dark:text-[#8FA39B]">
                      {isAr ? weeklyChartMeta.subtitleAr : weeklyChartMeta.subtitleEn}
                    </p>
                  </div>

                  {activeWeeklyDay ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#F6F7F8] px-3 py-1 text-xs font-semibold tabular-nums text-slate-800 ring-1 ring-slate-900/[0.06] dark:bg-[#141F1B] dark:text-emerald-200 dark:ring-emerald-400/[0.14]">
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

                {weeklyPills.length > 0 ? (
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
                          aria-label={`${day.dayNameEn} (${day.shortDate}): ${fmtKwdVal(day.salesKwd)}`}
                          className="group flex cursor-pointer flex-col items-center focus:outline-none"
                        >
                          <div className="relative flex h-40 sm:h-44 w-full flex-col items-center justify-end">
                            {isSelected ? (
                              <span
                                dir="ltr"
                                className="mb-2 inline-flex items-center whitespace-nowrap rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-800 ring-1 ring-emerald-500/35 dark:bg-emerald-400/20 dark:text-emerald-200 dark:ring-emerald-400/40"
                              >
                                {`${day.compactKwd} ${isAr ? 'د.ك' : 'KWD'}`}
                              </span>
                            ) : isPartialToday ? (
                              <span className="mb-2 inline-flex items-center whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-500/30 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/30">
                                {T('Partial', 'جزئي')}
                              </span>
                            ) : (
                              <span
                                dir="ltr"
                                className="mb-2 text-xs font-medium tabular-nums text-slate-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100 dark:text-[#8FA39B]"
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
                          <span className="text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">
                            {day.shortDate}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="my-8 text-center text-sm font-semibold text-slate-500">
                    {NO_ODOO_DATA_AR}
                  </p>
                )}

                <KpiProvenanceBadge
                  odooModel="pos.order"
                  dateRange={{
                    from: weeklyPills[0]?.id ?? periodWindow.fromIso,
                    to: weeklyPills[weeklyPills.length - 1]?.id ?? periodWindow.toInclusiveIso,
                  }}
                  lastSyncAt={lastSyncIso}
                  isStale24h={isStale24h}
                  kind="فعلي"
                  queryOrFormula="pos.order daily series grouped by Asia/Kuwait calendar day"
                />
              </div>

              {/* Right (`lg:col-span-5`): Cumulative Open Receivables & Accounting Status */}
              <section
                aria-label={T('Open Receivables & Ledger Status', 'الذمم المدينة المفتوحة وحالة القيود')}
                className="ae-bento-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09] lg:col-span-5"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-[16px] sm:text-[17.5px] font-semibold tracking-tight text-slate-950 dark:text-white">
                      {T('Open Receivables & Ledger Status', 'الذمم المدينة المفتوحة وحالة الدفتر')}
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                      <Wallet className="h-3.5 w-3.5" />
                      <span>{T('Ledger AR', 'ذمم دفتر الأستاذ')}</span>
                    </span>
                  </div>

                  {maskInternalCosts ? (
                    <div className="rounded-2xl bg-[#F6F7F8] p-4 text-sm font-medium text-slate-700 ring-1 ring-slate-900/[0.05] dark:bg-[#141F1B] dark:text-slate-200">
                      {T(
                        'Receivables & ledger balances are restricted to Finance/GM.',
                        'أرصدة الذمم المدينة وقيود دفتر الأستاذ محصورة بالمالية والمدير العام.',
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Link
                        href={isErpRouteAllowedForRole(sessionRole, '/erp/receivables') ? '/erp/receivables' : '/erp/cores'}
                        className="block rounded-2xl bg-amber-50/70 p-3.5 ring-1 ring-amber-500/20 transition-colors hover:bg-amber-50 dark:bg-amber-950/20 dark:ring-amber-400/20"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-amber-950 dark:text-amber-200">
                            {T('Unreconciled Open Receivables', 'إجمالي الذمم المدينة غير المسوّاة')}
                          </span>
                          <span
                            dir="ltr"
                            className="text-lg font-extrabold tabular-nums text-amber-900 dark:text-amber-200"
                          >
                            {fmtKwdVal(workspace.receivables.openReceivableKwd)}
                          </span>
                        </div>

                        {workspace.receivables.agingBuckets.length > 0 ? (
                          <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
                            {workspace.receivables.agingBuckets.map((bkt) => (
                              <div
                                key={bkt.key}
                                className="rounded-xl bg-white/80 p-2 ring-1 ring-amber-500/15 dark:bg-[#101815]/80"
                              >
                                <span className="block font-medium text-slate-500 dark:text-slate-400">
                                  {isAr ? bkt.labelAr : bkt.labelEn}
                                </span>
                                <span
                                  dir="ltr"
                                  className="mt-0.5 block font-bold tabular-nums text-slate-900 dark:text-white"
                                >
                                  {fmtKwdVal(bkt.residualKwd)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <p className="mt-2 text-xs font-medium text-slate-600 dark:text-[#8FA39B]">
                          {isAr
                            ? `${f0(workspace.receivables.unreconciledLineCount)} قيد غير مسوّى (${f0(workspace.receivables.posClearingLinesCount)} مقاصة كاشير + ${f0(workspace.receivables.platformAndCorporateLinesCount)} ذمم منصات وشركات)`
                            : `${f0(workspace.receivables.unreconciledLineCount)} unreconciled lines (${f0(workspace.receivables.posClearingLinesCount)} POS clearing + ${f0(workspace.receivables.platformAndCorporateLinesCount)} platform/corporate)`}
                        </p>
                      </Link>

                      <KpiProvenanceBadge
                        odooModel="account.move.line"
                        dateRange={{
                          from: workspace.receivables.fromDate,
                          to: workspace.receivables.toDate,
                        }}
                        lastSyncAt={lastSyncIso}
                        isStale24h={isStale24h}
                        kind="فعلي"
                        queryOrFormula="account.move.line(account_type='asset_receivable', parent_state='posted', reconciled=false) -> sum(amount_residual)"
                      />
                    </div>
                  )}
                </div>

                <Link
                  href="/erp/feryal-ai"
                  className="ae-emerald-cta-pill mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-[13px] font-semibold text-white transition-transform duration-150 hover:scale-[1.01]"
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>{T('Ask Feryal About Odoo Data', 'اسأل فريال عن بيانات أودو')}</span>
                </Link>
              </section>
            </div>

            {/* Combo Chart + 10-KWD Ledger Distribution */}
            <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-12">
              <div
                id="cash-flow-chart-card"
                className="ae-bento-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-emerald-400/[0.09] xl:col-span-7"
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-[17px] sm:text-[18px] font-semibold tracking-tight text-slate-950 dark:text-white">
                      {T('POS Sales & Posted Operating Net', 'مبيعات نقاط البيع وصافي التشغيل المرحّل')}
                    </h2>
                    <p className="whitespace-normal text-[13px] sm:text-[14px] font-medium text-slate-600 dark:text-[#8FA39B]">
                      {glIncomplete
                        ? GL_INCOMPLETE_AR
                        : T(
                            'Tap or hover any bar to inspect exact KWD from Odoo 17',
                            'اضغط أو مرر على أي عمود لعرض القيم الفعلية من أودو 17',
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
                    hasPostedOperatingProfit && !glIncomplete
                      ? T('GL Operating Profit', 'صافي التشغيل (دفتر الأستاذ)')
                      : GL_INCOMPLETE_AR
                  }
                  heightClass="h-60 sm:h-64"
                />

                <KpiProvenanceBadge
                  odooModel="pos.order + account.move.line"
                  dateRange={provenanceRange}
                  lastSyncAt={lastSyncIso}
                  isStale24h={isStale24h}
                  kind={hasPostedOperatingProfit && !glIncomplete ? 'محسوب بمعادلة' : 'فعلي'}
                  queryOrFormula="pos.order net sales per day/branch + account.move.line posted operating profit ratio"
                />
              </div>

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
                      'Computed strictly from Odoo 17 General Ledger (account.move.line)',
                      'محسوب حصراً من قيود دفتر الأستاذ العام في أودو 17 (account.move.line)',
                    )}
                  </p>
                </div>

                {maskInternalCosts ? (
                  <div className="flex flex-1 flex-col justify-between gap-3 rounded-2xl bg-[#F6F7F8] p-4 ring-1 ring-slate-900/[0.05] dark:bg-[#141F1B] dark:ring-emerald-400/[0.1]">
                    <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
                      {T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')}
                    </span>
                    <p className="whitespace-normal text-[13.5px] font-medium leading-relaxed text-slate-700 dark:text-slate-200">
                      {T(
                        'Internal lease rent, payroll ledger, supplier procurement costs, and net margin splits are restricted to Finance (CFO), GM, DGM, and System Admin.',
                        'تفاصيل عقود الإيجار، مسيرات الرواتب، تكاليف الموردين، وصافي الهامش محصورة بالمدير المالي والمدير العام ونائبه ومسؤول النظام.',
                      )}
                    </p>
                  </div>
                ) : tenKwdDonutSlices.length > 0 ? (
                  <div className="space-y-2.5">
                    <InteractiveDonutChart
                      slices={tenKwdDonutSlices}
                      centerValue={isAr ? `${f2(netPocket10)} د.ك` : `${f2(netPocket10)} KWD`}
                      centerSubValue={T('per 10 KWD', 'من كل 10 د.ك')}
                      centerLabel={T('GL Net Share', 'نصيب الصافي')}
                      isAr={isAr}
                      legendLayout="beside"
                    />
                    <KpiProvenanceBadge
                      odooModel="account.move.line"
                      dateRange={{ from: gl.from, to: gl.to }}
                      lastSyncAt={lastSyncIso}
                      isStale24h={isStale24h}
                      kind="محسوب بمعادلة"
                      queryOrFormula="(COGS + DeliveryCommissions + OpexRentDepr + OperatingProfit) / Revenue * 10 KWD"
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col justify-between gap-3 rounded-2xl bg-amber-50/60 p-4 ring-1 ring-amber-500/20 dark:bg-amber-950/20 dark:ring-amber-400/20">
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-950 dark:bg-amber-500/20 dark:text-amber-200">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>{GL_INCOMPLETE_AR}</span>
                      </span>
                      <p className="whitespace-normal text-[13.5px] font-medium leading-relaxed text-slate-800 dark:text-slate-200">
                        {isAr
                          ? (gl.unavailableReasonAr ?? GL_INCOMPLETE_AR)
                          : (gl.unavailableReasonEn ?? GL_INCOMPLETE_AR)}
                      </p>
                      <div className="grid grid-cols-1 gap-2 pt-1 text-xs sm:grid-cols-2">
                        <div className="rounded-xl bg-white/80 p-2.5 ring-1 ring-amber-500/15 dark:bg-[#101815]/80">
                          <span className="block text-slate-500 dark:text-slate-400">
                            {T('Posted COGS', 'تكلفة المواد المرحّلة')}
                          </span>
                          <span className="mt-0.5 block font-bold tabular-nums text-slate-900 dark:text-white">
                            {gl.cogsKwd !== null ? fmtKwdVal(gl.cogsKwd) : GL_INCOMPLETE_AR}
                          </span>
                        </div>
                        <div className="rounded-xl bg-white/80 p-2.5 ring-1 ring-amber-500/15 dark:bg-[#101815]/80">
                          <span className="block text-slate-500 dark:text-slate-400">
                            {T('Aggregator Commissions', 'عمولات تطبيقات التوصيل')}
                          </span>
                          <span className="mt-0.5 block font-bold text-amber-900 dark:text-amber-200">
                            {commissionUnposted
                              ? UNPOSTED_COMMISSION_AR
                              : fmtKwdVal(gl.deliveryCommissionsKwd ?? 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <KpiProvenanceBadge
                      odooModel="account.move.line"
                      dateRange={{ from: gl.from, to: gl.to }}
                      lastSyncAt={lastSyncIso}
                      isStale24h={isStale24h}
                      kind="فعلي"
                      queryOrFormula="account.move.line(parent_state='posted') — accrual completeness guard"
                    />
                  </div>
                )}
              </div>
            </div>

            {sessionRole === 'admin' && !auditorReadOnly ? (
              <div id="admin-pos-terminal-mapping" className="space-y-5">
                <AdminPosTerminalMappingPanel role={sessionRole} />
                <AdminExecutiveDirectoryCard role={sessionRole} />
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  )
}
