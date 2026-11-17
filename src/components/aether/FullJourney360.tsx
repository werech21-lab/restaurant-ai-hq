'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarRange,
  Database,
  Percent,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { V35GlassCard } from '@/components/aether/v35/V35GlassCard'
import { V35KpiRing } from '@/components/aether/v35/V35KpiRing'
import { AdminExecutiveDirectoryCard } from '@/components/erp/AdminExecutiveDirectoryCard'
import { AdminPosTerminalMappingPanel } from '@/components/erp/AdminPosTerminalMappingPanel'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
import { OdooPartialWarningBanner } from '@/components/erp/OdooPartialWarningBanner'
import {
  canTriggerManualOdooSync,
  isErpRouteAllowedForRole,
  shouldMaskInternalCostsForRole,
} from '@/lib/auth/role-access-policy'
import {
  formatCompactAxisLabel,
  formatCompactKwdTick,
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
  SCOPE_LABELS,
  companyWideBadgeFor,
  resolveBranchScope,
  resolveComboChartScope,
} from '@/lib/aether/brand-scope'
import { ScopeBadge } from '@/components/aether/ScopeBadge'
import { buildArTieOut } from '@/lib/odoo/receivable-aging'
import { canShowReceivableAmounts } from '@/lib/aether/receivables-status'
import { ReceivablesPendingStatus } from '@/components/ui/receivables-pending-status'
import { resolveHeroDeltaBadge } from '@/lib/aether/hero-delta'
import {
  DASHBOARD_BRANCH_CARD_IDS,
  formatPeriodCalendarWindow,
  getBranchLabel,
} from '@/lib/aether/global-filter-engine'
import {
  buildWeeklyChartMeta,
  formatAdminUnmappedAlertCopy,
  formatStaticMarginPill,
} from '@/lib/aether/period-delta'
import { useLang } from '@/components/aether/ui'
import { StateBlock } from '@/components/ui'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
} from '@/lib/format'
import { describePosOrderQuery } from '@/lib/odoo/pos-order-query'

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
      className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-2xl bg-blue-50/75 p-1 ring-1 ring-slate-400/25 backdrop-blur-md select-none dark:bg-[rgba(12,21,40,0.78)] dark:ring-sky-400/20"
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
            className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${btnPadding} ${
              active
                ? 'btn-colored bg-blue-600 font-semibold text-white shadow-[0_4px_12px_-2px_rgba(37,99,235,0.36)] dark:bg-sky-500 dark:text-slate-950'
                : 'text-slate-600 hover:bg-white/85 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white'
            }`}
          >
            {opt.icon ? <span className="shrink-0">{opt.icon}</span> : null}
            <span>{opt.label}</span>
            {opt.badge !== undefined ? (
              <span
                className={`rounded-lg px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                  active
                    ? 'bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950'
                    : 'bg-white/90 text-slate-700 dark:bg-white/10 dark:text-slate-300'
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

const NO_ODOO_DATA_AR = 'لا توجد بيانات من Odoo لهذه الفترة'
const NO_ODOO_DATA_EN = 'No Odoo data for this period'
const GL_INCOMPLETE_AR = 'قيود غير مكتملة لهذه الفترة'
const GL_INCOMPLETE_EN = 'Incomplete GL entries for this period'
const UNPOSTED_COMMISSION_AR = 'غير مُرحَّل بعد'
const UNPOSTED_COMMISSION_EN = 'Not posted yet'
const COMPANY_MARGIN_NOT_APPLIED_AR = 'هامش الشركة لا يُطبَّق على هذه السلسلة'
const COMPANY_MARGIN_NOT_APPLIED_EN = 'Company GL margin is not applied to this series'

interface BranchCardRow {
  id: string
  labelAr: string
  labelEn: string
  isUnattributed: boolean
  salesKwd: number | null
  orders: number | null
  aovKwd: number | null
  sharePct: number | null
}

/** ملخص الشركة — لوحة القيادة التنفيذية المربوطة مباشرةً ببيانات Odoo 17 */
export function FullJourney360() {
  const { isAr, T } = useLang()
  const activeLocale = isAr ? 'ar' : 'en'
  const unavailableTooltip = getUnavailableTooltip(activeLocale)
  const { workspace, filters, liveSummary, isAuditor, sessionRole, syncingOdoo } = useGlobalFilter()
  const auditorReadOnly = isAuditor || Boolean(liveSummary?.readOnly)
  const maskInternalCosts = shouldMaskInternalCostsForRole(sessionRole)
  const canSyncOdoo = !auditorReadOnly && canTriggerManualOdooSync(sessionRole)

  const [flowGroup, setFlowGroup] = useState<FlowGroup>('timeline')
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    document.documentElement.dataset.erpSubtab = 'summary'
    window.dispatchEvent(new CustomEvent('aether:erp-subtab', { detail: 'summary' }))
  }, [])

  const refreshOdoo = useCallback(async () => {
    setSyncing(true)
    setSyncError(false)
    try {
      const qs =
        filters.period === 'custom'
          ? `period=custom&from=${encodeURIComponent(filters.customFrom ?? '')}&to=${encodeURIComponent(filters.customTo ?? '')}`
          : `period=${encodeURIComponent(filters.period)}`
      const res = await fetch(`/api/odoo-sync?${qs}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        setSyncError(true)
        return
      }
      const d = await res.json()
      window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: d }))
    } catch {
      setSyncError(true)
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
    (v: number | null | undefined) => formatKwd(v, { locale: activeLocale }),
    [activeLocale],
  )
  const companyId = typeof liveSummary?.odooCompanyId === 'number' ? liveSummary.odooCompanyId : null
  const posSalesQuery = useMemo(
    () =>
      describePosOrderQuery({
        fromKuwaitDate: provenanceRange.from,
        toInclusiveKuwaitDate: provenanceRange.to,
        companyId,
        aggregate: 'read_group',
      }),
    [companyId, provenanceRange.from, provenanceRange.to],
  )
  const posOrdersQuery = useMemo(
    () =>
      describePosOrderQuery({
        fromKuwaitDate: provenanceRange.from,
        toInclusiveKuwaitDate: provenanceRange.to,
        companyId,
        aggregate: 'search_count',
      }),
    [companyId, provenanceRange.from, provenanceRange.to],
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

  // Branch figures that match the brand filter (exact brand split, or unavailable — never all-brand).
  const branchScope = useMemo(
    () => resolveBranchScope(activeBucket, filters.brand, DASHBOARD_BRANCH_CARD_IDS),
    [activeBucket, filters.brand],
  )
  const brandBranchScopeUnavailable = filters.brand !== 'all' && !branchScope.available

  // 7 Mapped Branches + Explicit 8th Row «غير منسوب لفرع»
  const branchCards = useMemo<BranchCardRow[]>(() => {
    if (
      !workspace.odooConnected ||
      workspace.noData ||
      workspace.sectionUnavailable ||
      brandBranchScopeUnavailable ||
      coresSnap.sales.branchesUnavailable ||
      (activeBucket &&
        (activeBucket.totals.restaurantNetKwd === null ||
          activeBucket.byLocation === null ||
          activeBucket.mappedByLocation === null))
    ) {
      return []
    }

    const brandScopedRows = filters.brand !== 'all' && branchScope.available ? branchScope : null
    const mappedRows: BranchCardRow[] = DASHBOARD_BRANCH_CARD_IDS.map((branchId) => {
      const bktLoc = brandScopedRows
        ? brandScopedRows.rows[branchId]
        : (activeBucket?.mappedByLocation?.[branchId] ?? activeBucket?.byLocation?.[branchId])
      const corePt = coresSnap.sales.branchRanking.find((x) => x.id === branchId)
      const useBucket =
        (brandScopedRows !== null || filters.brand === 'all') && filters.channel === 'all' && bktLoc !== undefined
      const rawSales = useBucket ? bktLoc?.netKwd : corePt?.salesKwd
      const rawOrders = useBucket ? bktLoc?.orders : corePt?.orders
      const salesKwd = typeof rawSales === 'number' && Number.isFinite(rawSales) ? rawSales : null
      const orders =
        typeof rawOrders === 'number' && Number.isFinite(rawOrders) ? Math.round(rawOrders) : null
      const aovKwd =
        salesKwd !== null && orders !== null && orders > 0 ? salesKwd / orders : null
      return {
        id: branchId,
        labelAr: getBranchLabel(branchId, true),
        labelEn: getBranchLabel(branchId, false),
        isUnattributed: false,
        salesKwd,
        orders,
        aovKwd,
        sharePct: null,
      }
    }).sort((a, b) => (b.salesKwd ?? Number.NEGATIVE_INFINITY) - (a.salesKwd ?? Number.NEGATIVE_INFINITY))

    const unattribSales = brandScopedRows
      ? brandScopedRows.unattributed.netKwd
      : workspace.unattributedSalesKwd === null
        ? null
        : typeof workspace.unattributedSalesKwd === 'number' &&
            Number.isFinite(workspace.unattributedSalesKwd)
          ? Math.max(0, workspace.unattributedSalesKwd)
          : 0
    const unattribOrders = brandScopedRows
      ? brandScopedRows.unattributed.orders
      : workspace.unattributedOrders === null
        ? null
        : typeof workspace.unattributedOrders === 'number' &&
            Number.isFinite(workspace.unattributedOrders)
          ? Math.max(0, Math.round(workspace.unattributedOrders))
          : 0

    const hasNullBranchSales =
      mappedRows.some((r) => r.salesKwd === null) || unattribSales === null
    const denom = hasNullBranchSales
      ? null
      : mappedRows.reduce((s, r) => s + (r.salesKwd as number), 0) + (unattribSales as number)

    const withShares = mappedRows.map((row) => ({
      ...row,
      sharePct:
        row.salesKwd !== null && denom !== null && denom > 0
          ? (row.salesKwd / denom) * 100
          : null,
    }))

    withShares.push({
      id: 'unattributed',
      labelAr: UNATTRIBUTED_BRANCH_LABEL_AR,
      labelEn: UNATTRIBUTED_BRANCH_LABEL_EN,
      isUnattributed: true,
      salesKwd: unattribSales,
      orders: unattribOrders,
      aovKwd:
        unattribSales !== null && unattribOrders !== null && unattribOrders > 0
          ? unattribSales / unattribOrders
          : null,
      sharePct:
        unattribSales !== null && denom !== null && denom > 0
          ? (unattribSales / denom) * 100
          : null,
    })

    return withShares
  }, [
    activeBucket,
    brandBranchScopeUnavailable,
    branchScope,
    coresSnap.sales.branchRanking,
    coresSnap.sales.branchesUnavailable,
    filters.brand,
    filters.channel,
    workspace.noData,
    workspace.odooConnected,
    workspace.sectionUnavailable,
    workspace.unattributedOrders,
    workspace.unattributedSalesKwd,
  ])

  const { food10, delivery10, opexRent10, netPocket10 } = workspace.per10
  const beforeRentRatio =
    gl.available && gl.beforeRentPct !== null ? gl.beforeRentPct / 100 : 0
  const netPocketKwd = gl.operatingProfitKwd ?? 0
  const netPocketPct = gl.netProfitPct ?? 0

  const comboScope = resolveComboChartScope({
    brand: filters.brand,
    group: flowGroup,
    timelineScope: coresSnap.sales.timelineScope,
  })
  const comboPlotsCompanyMargin = comboScope.plotCompanyMargin

  const comboData = useMemo<ComboBarLineDatum[]>(() => {
    if (
      !workspace.odooConnected ||
      workspace.noData ||
      (flowGroup === 'branches' && coresSnap.sales.branchesUnavailable)
    ) {
      return []
    }
    const src = flowGroup === 'branches' ? coresSnap.sales.branchRanking : coresSnap.sales.timeline
    const glReady = hasPostedOperatingProfit && !glIncomplete
    const canPlotPointMargin = glReady && comboPlotsCompanyMargin
    const glProfitStatusText =
      glReady && !comboPlotsCompanyMargin
        ? isAr
          ? COMPANY_MARGIN_NOT_APPLIED_AR
          : COMPANY_MARGIN_NOT_APPLIED_EN
        : isAr
          ? GL_INCOMPLETE_AR
          : GL_INCOMPLETE_EN
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
                  value: glProfitStatusText,
                  tone: 'amber',
                },
              ],
      }
    })
  }, [
    beforeRentRatio,
    coresSnap.sales.branchRanking,
    coresSnap.sales.branchesUnavailable,
    coresSnap.sales.timeline,
    comboPlotsCompanyMargin,
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
        valueFormatted: fmtKwdVal(food10),
        pctFormatted: formatPct(gl.cogsPct, activeLocale),
        color: '#38BDF8',
      },
      {
        id: 'delivery',
        label: isAr ? 'عمولات التوصيل المرحّلة' : 'Posted Delivery Commissions',
        subLabel: isAr
          ? `من كل 10 د.ك • قيود أودو ${fmtKwdVal(deliveryTotal)}`
          : `per 10 KWD • Odoo GL ${fmtKwdVal(deliveryTotal)}`,
        value: Math.max(0, delivery10),
        valueFormatted: fmtKwdVal(delivery10),
        pctFormatted: formatPct(gl.deliveryCommPct, activeLocale),
        color: '#818CF8',
      },
      {
        id: 'opex',
        label: isAr ? 'الإيجارات والرواتب والإهلاك والمصاريف' : 'Rent, Payroll, Depr & Opex',
        subLabel: isAr
          ? `من كل 10 د.ك • قيود أودو ${fmtKwdVal(opexTotal)}`
          : `per 10 KWD • Odoo GL ${fmtKwdVal(opexTotal)}`,
        value: Math.max(0, opexRent10),
        valueFormatted: fmtKwdVal(opexRent10),
        pctFormatted: formatPct(gl.opexRentDeprPct, activeLocale),
        color: '#94A3B8',
      },
      {
        id: 'pocket',
        label: isAr ? 'صافي الربح التشغيلي (دفتر الأستاذ)' : 'GL Operating Profit',
        subLabel: isAr
          ? `من كل 10 د.ك • قيود أودو ${fmtKwdVal(pocketTotal)}`
          : `per 10 KWD • Odoo GL ${fmtKwdVal(pocketTotal)}`,
        value: Math.max(0, netPocket10),
        valueFormatted: fmtKwdVal(netPocket10),
        pctFormatted: formatPct(gl.netProfitPct, activeLocale),
        color: '#2563EB',
      },
    ]
  }, [
    activeLocale,
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

  const weekSnapForPulse = useMemo(
    () => computeCoresHubSnapshot({ ...filters, period: 'week' }, [], liveSummary),
    [filters, liveSummary],
  )
  const weeklyPulseUsesCoreTimeline =
    coresSnap.sales.timeline.length >= 7 && /^\d{4}-\d{2}-\d{2}$/.test(coresSnap.sales.timeline[0]?.id ?? '')
  const weeklyPulseScope = weeklyPulseUsesCoreTimeline
    ? coresSnap.sales.timelineScope
    : weekSnapForPulse.sales.timelineScope

  const weeklyPills = useMemo(() => {
    if (!workspace.odooConnected || workspace.noData) return []
    const isIsoDaily =
      coresSnap.sales.timeline.length >= 7 &&
      /^\d{4}-\d{2}-\d{2}$/.test(coresSnap.sales.timeline[0]?.id ?? '')
    const baseTimeline = isIsoDaily
      ? coresSnap.sales.timeline
      : weekSnapForPulse.sales.timeline
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
      const compactKwd = formatCompactKwdTick(salesKwd, isAr)
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
  }, [coresSnap.sales.timeline, isAr, weekSnapForPulse.sales.timeline, workspace.noData, workspace.odooConnected])

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

  const heroDelta = useMemo(
    () => resolveHeroDeltaBadge(filters, workspace, liveSummary),
    [filters, liveSummary, workspace],
  )

  const adminUnmappedNetKwd =
    sessionRole === 'admin' && !auditorReadOnly && workspace.odooConnected && !workspace.noData
      ? Math.max(0, liveSummary?.companyTotals?.unmappedTerminalsNetKwd ?? workspace.unattributedSalesKwd ?? 0)
      : 0

  // Cards that stay company-wide say so whenever a brand is selected (no silent scope mixing).
  const companyWideScope = companyWideBadgeFor(filters.brand)
  const arTieOut = workspace.receivables.unavailable
    ? null
    : buildArTieOut({
        openDebitsKwd: workspace.receivables.openDebitsKwd,
        unappliedCreditsKwd: workspace.receivables.unappliedCreditsKwd,
        openReceivableKwd: workspace.receivables.openReceivableKwd,
      })

  const receivablesAmountsVisible = canShowReceivableAmounts(workspace.receivables)
  const isInitialLoading = syncingOdoo && !liveSummary
  const isDisconnectedOrEmpty = !workspace.odooConnected || workspace.noData

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-4 sm:space-y-5 pb-28 sm:pb-12">
      {/* Executive Header Row */}
      <V35GlassCard className="ae-bento-card flex flex-col gap-3.5 px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl sm:text-[24px] font-semibold tracking-tight text-slate-950 dark:text-white">
              {T('Executive Dashboard', 'لوحة القيادة التنفيذية')}
            </h2>
            <span className="inline-flex items-center rounded-full bg-blue-50/90 px-3 py-0.5 text-[13px] font-semibold text-blue-800 ring-1 ring-blue-500/20 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25">
              {T('Company Summary', 'ملخص الشركة')}
            </span>
          </div>
          <p className="min-w-0 whitespace-normal text-[13px] sm:text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
            {isAr ? workspace.subtitleAr : workspace.subtitleEn}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {canSyncOdoo ? (
            <button
              type="button"
              onClick={() => void refreshOdoo()}
              disabled={syncing}
              aria-label={T('Sync Odoo', 'مزامنة أودو')}
              title={T('Sync Odoo 17 Data', 'مزامنة بيانات أودو 17')}
              className="ae-emerald-cta-pill inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold text-white transition-all duration-150 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
              <span>{T('+ Sync Odoo', '+ مزامنة أودو')}</span>
            </button>
          ) : null}

          <Link
            href="/erp/weekday-comparison"
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-white/75 px-3.5 py-1.5 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-400/25 backdrop-blur-md transition-colors duration-150 hover:bg-white hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-sky-400/20 dark:hover:bg-white/[0.12] dark:hover:text-sky-200"
          >
            <CalendarRange className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-sky-400" />
            <span>{T('Compare Dates', 'مقارنة التواريخ')}</span>
          </Link>

          <Link
            href="/erp/before-after"
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-white/75 px-3.5 py-1.5 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-400/25 backdrop-blur-md transition-colors duration-150 hover:bg-white hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-sky-400/20 dark:hover:bg-white/[0.12] dark:hover:text-sky-200"
          >
            <span>{T('Before & After Comparison ↗', 'مقارنة الفترات (قبل وبعد) ↗')}</span>
          </Link>
        </div>
      </V35GlassCard>

      {syncError ? (
        <StateBlock
          state="error"
          locale={activeLocale}
          compact
          title={T('Unable to refresh Odoo data right now', 'تعذّر تحديث بيانات أودو حالياً')}
          description={T(
            'A temporary connection issue occurred while refreshing. Displayed figures remain unchanged.',
            'حدث خلل مؤقت أثناء الاتصال بأودو. تبقى الأرقام المعروضة دون تغيير.',
          )}
          onRetry={canSyncOdoo ? () => void refreshOdoo() : undefined}
          retryLabel={T('Retry', 'إعادة المحاولة')}
          className="rounded-[24px] backdrop-blur-xl ring-1 ring-rose-400/25 shadow-[0_10px_28px_-12px_rgba(190,18,60,0.16)]"
        />
      ) : null}

      <OdooPartialWarningBanner
        summary={liveSummary}
        isAr={isAr}
        className="!rounded-[24px] !bg-amber-50/80 dark:!bg-amber-950/40 backdrop-blur-xl !border-amber-300/60 dark:!border-amber-400/25 !ring-1 !ring-slate-400/20 sm:px-5 sm:py-3.5"
      />

      {/* Initial Sync Loading Skeleton (Zero Layout Shift) */}
      {isInitialLoading ? (
        <div className="space-y-4 sm:space-y-5" aria-busy="true">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {[0, 1, 2, 3].map((idx) => (
              <StateBlock
                key={idx}
                state="loading"
                locale={activeLocale}
                skeletonRows={3}
                minHeightClass="min-h-[164px]"
                className="rounded-[24px] bg-white/75 dark:bg-[rgba(15,26,48,0.75)] backdrop-blur-xl border border-slate-400/25 dark:border-slate-400/20 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.08)]"
              />
            ))}
          </div>
          <StateBlock
            state="loading"
            locale={activeLocale}
            skeletonRows={4}
            minHeightClass="min-h-[240px]"
            className="rounded-[24px] bg-white/75 dark:bg-[rgba(15,26,48,0.75)] backdrop-blur-xl border border-slate-400/25 dark:border-slate-400/20 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.08)]"
          />
        </div>
      ) : isDisconnectedOrEmpty ? (
        <V35GlassCard
          as="section"
          role="status"
          data-odoo-no-data="true"
          className="ae-bento-card mx-auto my-4 p-8 sm:p-10 text-center ring-1 ring-amber-400/30 dark:ring-amber-400/25"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100/80 text-amber-700 ring-1 ring-amber-400/30 backdrop-blur-sm dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25">
            <Database className="h-7 w-7" aria-hidden />
          </div>
          <h3 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            {T(NO_ODOO_DATA_EN, NO_ODOO_DATA_AR)}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {isAr ? (
              <>
                {workspace.noDataMessageAr ?? NO_ODOO_DATA_AR} (
                <span dir="ltr" className="tabular-nums">
                  {periodWindow.fromIso} → {periodWindow.toInclusiveIso}
                </span>
                )
              </>
            ) : (
              <>
                No records returned from Odoo 17 for the selected filter window (
                <span dir="ltr" className="tabular-nums">
                  {periodWindow.fromIso} → {periodWindow.toInclusiveIso}
                </span>
                ).
              </>
            )}
          </p>
          {canSyncOdoo ? (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => void refreshOdoo()}
                disabled={syncing}
                className="ae-emerald-cta-pill inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-60"
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
        </V35GlassCard>
      ) : (
        <>
          {adminUnmappedNetKwd > 0 ? (
            <V35GlassCard
              role="status"
              variant="subtle"
              data-admin-unmapped-banner="true"
              className="ae-bento-card flex flex-wrap items-center justify-between gap-3 bg-amber-50/75 px-4 py-3.5 text-[13px] font-semibold text-amber-950 ring-1 ring-amber-400/30 sm:px-5 dark:bg-amber-950/35 dark:text-amber-100 dark:ring-amber-400/25"
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
                className="inline-flex shrink-0 cursor-pointer items-center rounded-full bg-amber-500/15 px-3.5 py-1.5 text-xs font-bold text-amber-950 ring-1 ring-amber-500/25 transition-colors hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:text-amber-100"
              >
                {T('Map POS Terminals ↓', 'ربط أجهزة الكاشير ↓')}
              </button>
            </V35GlassCard>
          ) : null}

          {/* 4-Column Executive KPI Row (Strictly Actual / Ledger Metrics — Zero Static Estimates) */}
          <section className="space-y-4 sm:space-y-5">
            <div className="ae-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {/* Card 1: Net Sales KWD */}
              <V35GlassCard
                as="article"
                variant="hero"
                hoverLift
                className="ae-hero-emerald-card flex min-w-0 flex-col justify-between p-3.5 sm:p-5 text-white"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-white/95">
                    {T('Net Sales (KWD)', 'صافي المبيعات (د.ك)')}
                  </p>
                  <Link
                    href="/erp/cores"
                    aria-label={T('Sales Core Details', 'تفاصيل محور المبيعات')}
                    className="ae-hero-circle-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mt-3">
                  <V35KpiRing
                    tone="hero"
                    size="lg"
                    dataKpi="net-sales"
                    value={workspace.nullableSalesKwd}
                    display={fmtKwdVal(workspace.nullableSalesKwd ?? 0)}
                    unavailableTooltip={unavailableTooltip}
                    ringCenter={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
                    valueClassName="text-xl sm:text-2xl xl:text-[28px]"
                  />
                </div>

                <div className="mt-3.5 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      data-delta-comparison={heroDelta.hasComparison ? 'real' : 'none'}
                      title={isAr ? (heroDelta.titleAr ?? undefined) : (heroDelta.titleEn ?? undefined)}
                      className={`ae-hero-pill inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm ${
                        heroDelta.tone === 'red'
                          ? 'bg-rose-500/25 text-rose-50 ring-1 ring-rose-300/35'
                          : heroDelta.tone === 'neutral'
                            ? 'bg-slate-900/25 text-white/90 ring-1 ring-white/20'
                            : 'bg-white/15 text-white'
                      }`}
                    >
                      <span dir="ltr" className="tabular-nums">
                        {heroDelta.badgeLabel}
                      </span>{' '}
                      <span>
                        {heroDelta.hasComparison
                          ? T('vs prior period', 'مقارنة بالفترة السابقة')
                          : T(SCOPE_LABELS.noComparison.en, SCOPE_LABELS.noComparison.ar)}
                      </span>
                    </span>
                    <span className="whitespace-normal text-xs font-medium tabular-nums text-white/90">
                      {workspace.nullableAovKwd === null ? (
                        <span
                          title={unavailableTooltip}
                          aria-label={unavailableTooltip}
                          data-unavailable="true"
                        >
                          {isAr ? '• متوسط —' : '• AOV —'}
                        </span>
                      ) : isAr ? (
                        <>
                          • متوسط{' '}
                          <span dir="ltr" className="tabular-nums">
                            {fmtKwdVal(workspace.nullableAovKwd)}
                          </span>
                        </>
                      ) : (
                        <>
                          • AOV{' '}
                          <span dir="ltr" className="tabular-nums">
                            {fmtKwdVal(workspace.nullableAovKwd)}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                  {workspace.nullableSalesKwd !== null && workspace.brandBasis === 'product-lines' ? (
                    <p
                      data-brand-basis="product-lines"
                      className="whitespace-normal text-xs font-medium tabular-nums text-amber-100"
                    >
                      {T(SCOPE_LABELS.productLinesBasis.en, SCOPE_LABELS.productLinesBasis.ar)}
                      {workspace.brandBasisGapKwd !== null ? (
                        <>
                          {' • '}
                          {T(SCOPE_LABELS.allBrandsBasisGap.en, SCOPE_LABELS.allBrandsBasisGap.ar)}{' '}
                          <span dir="ltr" className="tabular-nums">
                            {fmtKwdVal(workspace.brandBasisGapKwd)}
                          </span>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {workspace.nullableSalesKwd !== null &&
                  workspace.unattributedSalesKwd > 0 &&
                  filters.brand === 'all' &&
                  filters.branch === 'all' ? (
                    <p className="whitespace-normal text-xs font-medium tabular-nums text-amber-100">
                      {isAr ? (
                        <>
                          منها {UNATTRIBUTED_BRANCH_LABEL_AR}:{' '}
                          <span dir="ltr" className="tabular-nums">
                            {fmtKwdVal(workspace.unattributedSalesKwd)}
                          </span>{' '}
                          ({formatInt(workspace.unattributedOrders)} طلب)
                        </>
                      ) : (
                        <>
                          Includes {UNATTRIBUTED_BRANCH_LABEL_EN}:{' '}
                          <span dir="ltr" className="tabular-nums">
                            {fmtKwdVal(workspace.unattributedSalesKwd)}
                          </span>{' '}
                          ({formatInt(workspace.unattributedOrders)} orders)
                        </>
                      )}
                    </p>
                  ) : null}
                  <div className="rounded-2xl bg-white/[0.12] px-2.5 py-2 ring-1 ring-white/20 backdrop-blur-md">
                    <KpiProvenanceBadge
                      odooModel="pos.order"
                      dateRange={provenanceRange}
                      lastSyncAt={lastSyncIso}
                      isStale24h={isStale24h}
                      kind="فعلي"
                      queryOrFormula={posSalesQuery}
                      compact
                      className="!mt-0"
                    />
                  </div>
                </div>
              </V35GlassCard>

              {/* Card 2: order count. Before-rent money stays in its own pill. */}
              <V35GlassCard
                as="article"
                hoverLift
                className="ae-kpi-card flex min-w-0 flex-col justify-between p-3.5 sm:p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                    {T('Total Orders', 'إجمالي الطلبات')}
                  </p>
                  <Link
                    href="/erp/cores"
                    aria-label={T('Orders Details', 'تفاصيل الطلبات')}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50/85 text-blue-700 ring-1 ring-slate-400/25 transition-transform duration-150 hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.08] dark:text-sky-300 dark:ring-sky-400/20"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mt-3">
                  <V35KpiRing
                    tone="blue"
                    size="md"
                    dataKpi="total-orders"
                    value={workspace.nullableOrders}
                    display={formatInt(workspace.nullableOrders ?? 0)}
                    unavailableTooltip={unavailableTooltip}
                    valueTooltip={
                      filters.brand !== 'all'
                        ? T(SCOPE_LABELS.multiBrandOrders.en, SCOPE_LABELS.multiBrandOrders.ar)
                        : undefined
                    }
                    ringCenter={<ShoppingBag className="h-4 w-4" aria-hidden="true" />}
                    valueClassName="text-xl sm:text-2xl xl:text-[26px]"
                  />
                </div>

                <div className="mt-3.5 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {maskInternalCosts ? (
                      <span
                        data-cost-mask="restricted-finance-gm"
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100/90 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-400/25 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/15"
                      >
                        {T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')}
                      </span>
                    ) : gl.beforeRentKwd !== null && gl.beforeRentPct !== null && !glIncomplete ? (
                      <span
                        dir="ltr"
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                          beforeRentRatio < 0
                            ? 'bg-rose-50/90 text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/25'
                            : 'bg-blue-50/90 text-blue-700 ring-1 ring-blue-500/20 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25'
                        }`}
                      >
                        {formatStaticMarginPill(gl.beforeRentPct)} • {fmtKwdVal(gl.beforeRentKwd)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50/90 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25">
                        {T(GL_INCOMPLETE_EN, GL_INCOMPLETE_AR)}
                      </span>
                    )}
                  </div>
                  <KpiProvenanceBadge
                    odooModel="pos.order"
                    dateRange={provenanceRange}
                    lastSyncAt={lastSyncIso}
                    isStale24h={isStale24h}
                    kind="فعلي"
                    queryOrFormula={posOrdersQuery}
                    compact
                  />
                </div>
              </V35GlassCard>

              {/* Card 3: Net Operating Profit (Explicitly warns «قيود غير مكتملة لهذه الفترة» whenever glIncomplete === true) */}
              <V35GlassCard
                as="article"
                hoverLift
                className="ae-kpi-card flex min-w-0 flex-col justify-between p-3.5 sm:p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                    {T('Operating Net Profit (GL)', 'صافي الربح التشغيلي (دفتر الأستاذ)')}
                  </p>
                  <ScopeBadge kind={companyWideScope} target="gl-operating-net" isAr={isAr} />
                  <Link
                    href="/erp/executive-pnl"
                    aria-label={T('Inspect Profit & Loss', 'تفاصيل قائمة الدخل')}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50/85 text-blue-700 ring-1 ring-slate-400/25 transition-transform duration-150 hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.08] dark:text-sky-300 dark:ring-sky-400/20"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>

                {maskInternalCosts ? (
                  <>
                    <div
                      data-cost-mask="restricted-finance-gm"
                      className="mt-3 text-[16px] sm:text-[18px] font-semibold leading-snug tracking-tight text-slate-700 dark:text-slate-200"
                    >
                      {T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')}
                    </div>
                    <div className="mt-3.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/90 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-400/25 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/15">
                        {T(
                          'Rent, payroll & supplier figures masked',
                          'بيانات الإيجار والرواتب والموردين محجوبة',
                        )}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-3 space-y-2">
                      <V35KpiRing
                        tone="indigo"
                        size="md"
                        dataKpi="operating-net"
                        value={hasPostedOperatingProfit && !glIncomplete ? netPocketKwd : null}
                        isUnavailable={!hasPostedOperatingProfit || glIncomplete}
                        percent={hasPostedOperatingProfit && !glIncomplete ? netPocketPct : null}
                        display={fmtKwdVal(netPocketKwd)}
                        unavailableTooltip={unavailableTooltip}
                        ringCenter={
                          hasPostedOperatingProfit && !glIncomplete ? (
                            <span dir="ltr" className="tabular-nums">
                              {`${netPocketPct.toFixed(1)}%`}
                            </span>
                          ) : undefined
                        }
                        valueClassName="text-xl sm:text-2xl xl:text-[26px]"
                      />
                      {!hasPostedOperatingProfit || glIncomplete ? (
                        <div className="space-y-1">
                          <div
                            data-net-profit-withheld={gl.netProfitWithheld ? 'true' : undefined}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100/90 px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300/60 backdrop-blur-sm dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/15"
                          >
                            <Clock className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                            <span>
                              {gl.netProfitWithheld
                                ? isAr
                                  ? gl.netProfitWithheldReasonAr
                                  : gl.netProfitWithheldReasonEn
                                : T(GL_INCOMPLETE_EN, GL_INCOMPLETE_AR)}
                            </span>
                          </div>
                          {hasPostedOperatingProfit ? (
                            <p className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                              {isAr ? (
                                <>
                                  الرصيد المرحّل جزئياً فقط:{' '}
                                  <span dir="ltr" className="tabular-nums">
                                    {fmtKwdVal(netPocketKwd)}
                                  </span>
                                </>
                              ) : (
                                <>
                                  Partially posted balance only:{' '}
                                  <span dir="ltr" className="tabular-nums">
                                    {fmtKwdVal(netPocketKwd)}
                                  </span>
                                </>
                              )}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3.5 space-y-1.5">
                      {glIncomplete ? (
                        <p className="whitespace-normal text-xs font-semibold text-amber-800 dark:text-amber-300">
                          {isAr
                            ? gl.unavailableReasonAr && gl.unavailableReasonAr !== GL_INCOMPLETE_AR
                              ? `${GL_INCOMPLETE_AR} — ${gl.unavailableReasonAr}`
                              : GL_INCOMPLETE_AR
                            : gl.unavailableReasonEn && gl.unavailableReasonEn !== GL_INCOMPLETE_EN
                              ? `${GL_INCOMPLETE_EN} — ${gl.unavailableReasonEn}`
                              : GL_INCOMPLETE_EN}
                        </p>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50/90 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-500/20 dark:bg-indigo-400/15 dark:text-indigo-200 dark:ring-indigo-400/25">
                          <span dir="ltr" className="tabular-nums">
                            {formatStaticMarginPill(netPocketPct)}
                          </span>{' '}
                          <span>{T('GL net share', 'نسبة الصافي المحاسبي')}</span>
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
              </V35GlassCard>

              {/* Card 4: Aggregator Commissions (Shows «غير مُرحَّل بعد» — never 0 — when unposted) */}
              <V35GlassCard
                as="article"
                hoverLift
                className="ae-kpi-card flex min-w-0 flex-col justify-between p-3.5 sm:p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-normal text-[13px] sm:text-[14px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                    {T('Aggregator Commissions', 'عمولات تطبيقات التوصيل')}
                  </p>
                  <ScopeBadge kind={companyWideScope} target="aggregator-commissions" isAr={isAr} />
                  <Link
                    href={isErpRouteAllowedForRole(sessionRole, '/erp/aggregator-radar') ? '/erp/aggregator-radar' : '/erp/cores'}
                    aria-label={T('Aggregator Radar', 'رادار تطبيقات التوصيل')}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50/85 text-blue-700 ring-1 ring-slate-400/25 transition-transform duration-150 hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.08] dark:text-sky-300 dark:ring-sky-400/20"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>

                {maskInternalCosts ? (
                  <>
                    <div
                      data-cost-mask="restricted-finance-gm"
                      className="mt-3 text-[16px] sm:text-[18px] font-semibold leading-snug tracking-tight text-slate-700 dark:text-slate-200"
                    >
                      {T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')}
                    </div>
                    <div className="mt-3.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/90 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-400/25 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/15">
                        {T('Commission ledger restricted', 'قيود العمولات محصورة بالمالية')}
                      </span>
                    </div>
                  </>
                ) : commissionUnposted ? (
                  <>
                    <div className="mt-3">
                      <span
                        data-commission-unposted="true"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100/85 px-3 py-1.5 text-base font-extrabold text-amber-950 ring-1 ring-amber-500/25 backdrop-blur-sm dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-400/25"
                      >
                        {T(UNPOSTED_COMMISSION_EN, UNPOSTED_COMMISSION_AR)}
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
                    <div className="mt-3">
                      <V35KpiRing
                        tone="sky"
                        size="md"
                        dataKpi="aggregator-commissions"
                        value={gl.deliveryCommissionsKwd}
                        display={fmtKwdVal(gl.deliveryCommissionsKwd)}
                        percent={typeof gl.deliveryCommPct === 'number' ? gl.deliveryCommPct : null}
                        unavailableTooltip={unavailableTooltip}
                        ringCenter={
                          typeof gl.deliveryCommPct === 'number' ? (
                            <span dir="ltr" className="tabular-nums">
                              {`${gl.deliveryCommPct.toFixed(1)}%`}
                            </span>
                          ) : (
                            <Percent className="h-4 w-4" aria-hidden="true" />
                          )
                        }
                        valueClassName="text-xl sm:text-2xl xl:text-[26px]"
                      />
                    </div>
                    <div className="mt-3.5 space-y-1.5">
                      {gl.deliveryCommPct !== null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50/90 px-2.5 py-0.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-500/20 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25">
                          <span dir="ltr" className="tabular-nums">
                            {formatPct(gl.deliveryCommPct, activeLocale)}
                          </span>{' '}
                          <span>{T('of GL revenue', 'من إيراد دفتر الأستاذ')}</span>
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
              </V35GlassCard>
            </div>

            {/* 7 Mapped Branches + Explicit 8th Card «غير منسوب لفرع» */}
            <V35GlassCard
              as="section"
              aria-label={T('Branches & Unattributed POS Sales', 'أداء الفروع السبعة والمبيعات غير المنسوبة لفرع')}
              className="ae-bento-card p-4 sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[16px] sm:text-[18px] font-semibold tracking-tight text-slate-950 dark:text-white">
                    {T(
                      '7 Mapped Restaurant Branches + Unattributed POS Sales',
                      'كروت الفروع السبعة + سطر المبيعات غير المنسوبة لفرع',
                    )}
                  </h2>
                  <p className="mt-0.5 text-[13px] font-medium text-slate-600 dark:text-slate-300">
                    {isAr ? (
                      <>
                        مبيعات وطلبات كل فرع من إيصالات نقاط البيع في أودو 17 (
                        <span dir="ltr" className="tabular-nums">
                          {periodWindow.fromIso} → {periodWindow.toInclusiveIso}
                        </span>
                        )
                      </>
                    ) : (
                      <>
                        Branch POS net sales & orders directly from Odoo 17 (
                        <span dir="ltr" className="tabular-nums">
                          {periodWindow.fromIso} → {periodWindow.toInclusiveIso}
                        </span>
                        )
                      </>
                    )}
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

              {branchCards.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {branchCards.map((bRow) => (
                    <V35GlassCard
                      key={bRow.id}
                      variant="nested"
                      hoverLift
                      data-branch-card={bRow.id}
                      className={`flex flex-col justify-between rounded-[20px] p-4 ${
                        bRow.isUnattributed
                          ? 'bg-amber-50/75 ring-1 ring-amber-400/35 dark:bg-amber-950/30 dark:ring-amber-400/25'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                              bRow.isUnattributed
                                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                                : 'bg-blue-500/15 text-blue-700 dark:bg-sky-400/15 dark:text-sky-300'
                            }`}
                          >
                            <Building2 className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-[14px] font-bold leading-snug text-slate-950 dark:text-white">
                              {bRow.isUnattributed
                                ? T(UNATTRIBUTED_BRANCH_LABEL_EN, UNATTRIBUTED_BRANCH_LABEL_AR)
                                : isAr
                                  ? bRow.labelAr
                                  : bRow.labelEn}
                            </h3>
                            <p className="text-xs font-medium leading-snug text-slate-600 dark:text-slate-300">
                              {bRow.isUnattributed
                                ? T('Unmapped POS terminals', 'أجهزة كاشير غير مربوطة بفرع محدد')
                                : T('Mapped Odoo POS location', 'فرع مربوط في نقاط بيع أودو')}
                            </p>
                          </div>
                        </div>
                        <span
                          dir="ltr"
                          title={bRow.sharePct === null ? unavailableTooltip : undefined}
                          data-unavailable={bRow.sharePct === null ? 'true' : undefined}
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                            bRow.isUnattributed
                              ? 'bg-amber-200/80 text-amber-950 ring-1 ring-amber-400/30 dark:bg-amber-900/60 dark:text-amber-200 dark:ring-amber-400/25'
                              : 'bg-blue-100/85 text-blue-900 ring-1 ring-blue-400/25 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25'
                          }`}
                        >
                          {formatPct(bRow.sharePct, activeLocale)}
                        </span>
                      </div>

                      <div className="mt-3.5 space-y-2.5">
                        {bRow.sharePct !== null && bRow.salesKwd !== null ? (
                          <V35KpiRing
                            size="sm"
                            tone={bRow.isUnattributed ? 'warning' : 'blue'}
                            value={bRow.salesKwd}
                            display={fmtKwdVal(bRow.salesKwd)}
                            percent={bRow.sharePct}
                            unavailableTooltip={unavailableTooltip}
                            ringCenter={
                              bRow.isUnattributed ? (
                                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                              ) : (
                                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                              )
                            }
                            valueClassName="text-lg sm:text-[19px] font-extrabold leading-tight"
                          />
                        ) : (
                          <span
                            dir="ltr"
                            title={bRow.salesKwd === null ? unavailableTooltip : undefined}
                            data-unavailable={bRow.salesKwd === null ? 'true' : undefined}
                            className="block text-xl font-extrabold tabular-nums text-slate-950 dark:text-white"
                          >
                            {fmtKwdVal(bRow.salesKwd)}
                          </span>
                        )}
                        <span className="block pt-0.5 text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                          {bRow.orders === null ? (
                            <span title={unavailableTooltip} data-unavailable="true">
                              {UNAVAILABLE_DASH}
                            </span>
                          ) : isAr ? (
                            `${formatInt(bRow.orders)} طلب`
                          ) : (
                            `${formatInt(bRow.orders)} orders`
                          )}
                          {bRow.orders !== null && bRow.orders > 0 ? (
                            bRow.aovKwd === null ? (
                              <span title={unavailableTooltip} data-unavailable="true">
                                {isAr ? ' • متوسط —' : ' • AOV —'}
                              </span>
                            ) : isAr ? (
                              <>
                                {' • متوسط '}
                                <span dir="ltr" className="tabular-nums">
                                  {fmtKwdVal(bRow.aovKwd)}
                                </span>
                              </>
                            ) : (
                              <>
                                {' • AOV '}
                                <span dir="ltr" className="tabular-nums">
                                  {fmtKwdVal(bRow.aovKwd)}
                                </span>
                              </>
                            )
                          ) : null}
                        </span>
                      </div>
                    </V35GlassCard>
                  ))}
                </div>
              ) : (
                <StateBlock
                  state="unavailable"
                  locale={activeLocale}
                  compact
                  className="rounded-[24px] backdrop-blur-md"
                  title={
                    brandBranchScopeUnavailable
                      ? T(SCOPE_LABELS.unavailableForFilter.en, SCOPE_LABELS.unavailableForFilter.ar)
                      : T('Branch breakdown unavailable', 'تفصيل الفروع غير متاح حالياً')
                  }
                  description={
                    brandBranchScopeUnavailable
                      ? T(
                          'No exact split of this brand by branch is available for this period, so all-brand branch figures are not shown.',
                          'لا يتوفر تقسيم دقيق لهذه العلامة حسب الفرع لهذه الفترة، لذلك لا تُعرض أرقام الفروع لكل العلامات.',
                        )
                      : T(
                          'Branch-level POS data is temporarily unavailable for this period.',
                          'بيانات نقاط البيع حسب الفروع غير متاحة مؤقتاً لهذه الفترة.',
                        )
                  }
                />
              )}
            </V35GlassCard>

            {/* 2-Column Row: Weekly Daily POS Bars + Open Ledger Receivables & Feryal */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
              {/* Left (`lg:col-span-7`): Weekly Performance Analytics */}
              <V35GlassCard className="ae-bento-card flex flex-col justify-between p-4 sm:p-6 lg:col-span-7">
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <h2 className="text-[16px] sm:text-[17.5px] font-semibold tracking-tight text-slate-950 dark:text-white">
                      {T('Daily POS Sales Pulse (Last 7 Days)', 'نبض مبيعات نقاط البيع اليومي (آخر 7 أيام)')}
                    </h2>
                    <ScopeBadge
                      kind={filters.brand !== 'all' && weeklyPulseScope === 'all-brands' ? 'all-brands' : null}
                      target="weekly-pulse"
                      isAr={isAr}
                      className="mt-1"
                    />
                    <p className="mt-0.5 whitespace-normal text-[13px] font-medium text-slate-600 dark:text-slate-300">
                      {isAr ? weeklyChartMeta.subtitleAr : weeklyChartMeta.subtitleEn}
                    </p>
                  </div>

                  {activeWeeklyDay ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-50/80 px-3.5 py-1 text-xs font-semibold tabular-nums text-slate-800 ring-1 ring-slate-400/25 backdrop-blur-sm dark:bg-sky-400/10 dark:text-sky-100 dark:ring-sky-400/25">
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
                          aria-label={`${isAr ? day.dayNameAr : day.dayNameEn} (${day.shortDate}): ${fmtKwdVal(day.salesKwd)}`}
                          className="group flex cursor-pointer flex-col items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                        >
                          <div className="relative flex h-40 sm:h-44 w-full flex-col items-center justify-end">
                            {isSelected ? (
                              <span
                                dir={isAr ? 'rtl' : 'ltr'}
                                className="mb-2 inline-flex items-center whitespace-nowrap rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-blue-800 ring-1 ring-blue-500/35 dark:bg-sky-400/20 dark:text-sky-200 dark:ring-sky-400/40"
                              >
                                {`${day.compactKwd} ${isAr ? 'د.ك' : 'KWD'}`}
                              </span>
                            ) : isPartialToday ? (
                              <span className="mb-2 inline-flex items-center whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-500/30 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/30">
                                {T('Partial', 'جزئي')}
                              </span>
                            ) : (
                              <span
                                dir={isAr ? 'rtl' : 'ltr'}
                                className="mb-2 text-xs font-medium tabular-nums text-slate-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100 dark:text-slate-300"
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
                                        'repeating-linear-gradient(45deg, rgba(59,130,246,0.16) 0px, rgba(59,130,246,0.16) 4px, rgba(96,165,250,0.05) 4px, rgba(96,165,250,0.05) 9px)',
                                    }
                              }
                              className={`w-full max-w-[44px] rounded-full transition-all duration-300 ${
                                isSelected
                                  ? 'ae-emerald-peak-pill bg-gradient-to-t from-blue-600 to-sky-400 shadow-[0_8px_22px_rgba(37,99,235,0.34)]'
                                  : 'ae-pill-hatch ring-1 ring-blue-500/20 group-hover:ring-blue-400/45 dark:ring-sky-400/25'
                              }`}
                            />
                          </div>

                          <span
                            className={`mt-2.5 text-[12.5px] font-semibold tracking-tight ${
                              isSelected
                                ? 'text-blue-700 dark:text-sky-300'
                                : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {isAr ? day.dayNameAr : day.letterEn}
                          </span>
                          <span dir="ltr" className="text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">
                            {day.shortDate}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="my-4">
                    <StateBlock
                      state={workspace.odooConnected && !workspace.noData ? 'unavailable' : 'empty'}
                      locale={activeLocale}
                      compact
                      className="rounded-[24px] backdrop-blur-md"
                      title={T(NO_ODOO_DATA_EN, NO_ODOO_DATA_AR)}
                    />
                  </div>
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
              </V35GlassCard>

              {/* Right (`lg:col-span-5`): Cumulative Open Receivables & Accounting Status */}
              <V35GlassCard
                as="section"
                aria-label={T('Open Receivables & Ledger Status', 'الذمم المدينة المفتوحة وحالة القيود')}
                className="ae-bento-card flex flex-col justify-between p-4 sm:p-6 lg:col-span-5"
              >
                <div className="space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[16px] sm:text-[17.5px] font-semibold tracking-tight text-slate-950 dark:text-white">
                      {T('Open Receivables & Ledger Status', 'الذمم المدينة المفتوحة وحالة الدفتر')}
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/90 px-2.5 py-0.5 text-xs font-bold text-slate-700 ring-1 ring-slate-300/60 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/15">
                      <Wallet className="h-3.5 w-3.5" />
                      <span>{T('Ledger AR', 'ذمم دفتر الأستاذ')}</span>
                    </span>
                    <ScopeBadge kind={companyWideScope} target="ledger-ar" isAr={isAr} />
                  </div>

                  {maskInternalCosts ? (
                    <div className="rounded-2xl bg-blue-50/70 p-4 text-sm font-medium text-slate-700 ring-1 ring-slate-400/25 backdrop-blur-sm dark:bg-white/[0.06] dark:text-slate-200 dark:ring-sky-400/20">
                      {T(
                        'Receivables & ledger balances are restricted to Finance/GM.',
                        'أرصدة الذمم المدينة وقيود دفتر الأستاذ محصورة بالمالية والمدير العام.',
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Link
                        href={isErpRouteAllowedForRole(sessionRole, '/erp/receivables') ? '/erp/receivables' : '/erp/cores'}
                        className="block rounded-[20px] bg-slate-50/80 p-4 ring-1 ring-slate-300/60 backdrop-blur-sm transition-colors hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.04] dark:ring-white/10 dark:hover:bg-white/[0.07]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {T('Unreconciled Open Receivables', 'إجمالي الذمم المدينة غير المسوّاة')}
                          </span>
                          <span
                            dir="ltr"
                            title={workspace.receivables.unavailable ? unavailableTooltip : undefined}
                            aria-label={workspace.receivables.unavailable ? unavailableTooltip : undefined}
                            data-unavailable={workspace.receivables.unavailable ? 'true' : undefined}
                            className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-slate-100"
                          >
                            {workspace.receivables.unavailable ? (
                              UNAVAILABLE_DASH
                            ) : receivablesAmountsVisible ? (
                              fmtKwdVal(workspace.receivables.openReceivableKwd)
                            ) : (
                              <ReceivablesPendingStatus isAr={isAr} size="sm" />
                            )}
                          </span>
                        </div>

                        {receivablesAmountsVisible &&
                        workspace.receivables.agingBuckets.length > 0 ? (
                          <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
                            {workspace.receivables.agingBuckets.map((bkt) => (
                              <div
                                key={bkt.key}
                                className="rounded-xl bg-white/80 p-2.5 ring-1 ring-amber-400/25 backdrop-blur-sm dark:bg-[rgba(15,26,48,0.72)] dark:ring-amber-400/20"
                              >
                                <span className="block font-medium text-slate-600 dark:text-slate-300">
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

                        {receivablesAmountsVisible && arTieOut ? (
                          <dl
                            data-ar-tie-out={arTieOut.ties ? 'ties' : 'mismatch'}
                            className="mt-2.5 space-y-1 text-xs font-medium text-slate-700 dark:text-slate-300"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <dt>{T('Aging total (open debits)', 'إجمالي أعمار الذمم (مدين مفتوح)')}</dt>
                              <dd dir="ltr" className="font-bold tabular-nums">{fmtKwdVal(arTieOut.openDebitsKwd)}</dd>
                            </div>
                            <div data-ar-unapplied-credits="true" className="flex items-center justify-between gap-2">
                              <dt>{T('Unapplied credits & clearing', 'دفعات ومقاصات غير مطابقة')}</dt>
                              <dd dir="ltr" className="font-bold tabular-nums">{fmtKwdVal(arTieOut.unappliedCreditsKwd)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-2 border-t border-amber-500/20 pt-1">
                              <dt>{T('= Open receivables', '= صافي الذمم المفتوحة')}</dt>
                              <dd dir="ltr" className="font-bold tabular-nums">{fmtKwdVal(arTieOut.openReceivableKwd)}</dd>
                            </div>
                            {arTieOut.ties ? null : (
                              <p className="text-amber-900 dark:text-amber-200">
                                {T('Does not tie; difference', 'لا يتطابق؛ الفرق')}{' '}
                                <span dir="ltr" className="tabular-nums">{fmtKwdVal(arTieOut.differenceKwd)}</span>
                              </p>
                            )}
                          </dl>
                        ) : null}
                        {receivablesAmountsVisible && workspace.receivables.agingHiddenReasonAr ? (
                          <p data-ar-aging-hidden="true" className="mt-2 text-xs font-medium text-amber-900 dark:text-amber-200">
                            {isAr ? workspace.receivables.agingHiddenReasonAr : workspace.receivables.agingHiddenReasonEn}
                          </p>
                        ) : null}

                        <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                          {workspace.receivables.unavailable ? (
                            <span
                              title={unavailableTooltip}
                              aria-label={unavailableTooltip}
                              data-unavailable="true"
                            >
                              {isAr ? 'غير متاح' : UNAVAILABLE_DASH}
                            </span>
                          ) : isAr ? (
                            `${formatInt(workspace.receivables.unreconciledLineCount)} قيد غير مسوّى (${formatInt(workspace.receivables.posClearingLinesCount)} مقاصة كاشير + ${formatInt(workspace.receivables.platformAndCorporateLinesCount)} ذمم منصات وشركات)`
                          ) : (
                            `${formatInt(workspace.receivables.unreconciledLineCount)} unreconciled lines (${formatInt(workspace.receivables.posClearingLinesCount)} POS clearing + ${formatInt(workspace.receivables.platformAndCorporateLinesCount)} platform/corporate)`
                          )}
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
                  className="ae-emerald-cta-pill mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-[13px] font-semibold text-white transition-transform duration-150 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>{T('Ask Feryal About Odoo Data', 'اسأل فريال عن بيانات أودو')}</span>
                </Link>
              </V35GlassCard>
            </div>

            {/* Combo Chart + 10-KWD Ledger Distribution */}
            <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-12">
              <V35GlassCard
                id="cash-flow-chart-card"
                className="ae-bento-card flex flex-col justify-between p-4 sm:p-6 xl:col-span-7"
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-[17px] sm:text-[18px] font-semibold tracking-tight text-slate-950 dark:text-white">
                      {T('POS Sales & Posted Operating Net', 'مبيعات نقاط البيع وصافي التشغيل المرحّل')}
                    </h2>
                    <ScopeBadge kind={comboScope.badge} target="sales-net-combo" isAr={isAr} className="mt-1" />
                    <p className="whitespace-normal text-[13px] sm:text-[14px] font-medium text-slate-600 dark:text-slate-300">
                      {glIncomplete
                        ? T(GL_INCOMPLETE_EN, GL_INCOMPLETE_AR)
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
                    ariaLabel={T('Chart grouping', 'تجميع الرسم البياني')}
                    options={[
                      { id: 'timeline', label: T('Timeline', 'حسب الفترة') },
                      { id: 'branches', label: T('Branches', 'حسب الفروع') },
                    ]}
                  />
                </div>

                {comboData.length > 0 ? (
                  <SalesNetComboChart
                    data={comboData}
                    isAr={isAr}
                    salesLegend={T('Sales (pos.order)', 'المبيعات (pos.order)')}
                    netLegend={
                      hasPostedOperatingProfit && !glIncomplete
                        ? comboPlotsCompanyMargin
                          ? T('GL Operating Profit', 'صافي التشغيل (دفتر الأستاذ)')
                          : T(COMPANY_MARGIN_NOT_APPLIED_EN, COMPANY_MARGIN_NOT_APPLIED_AR)
                        : T(GL_INCOMPLETE_EN, GL_INCOMPLETE_AR)
                    }
                    heightClass="h-60 sm:h-64"
                  />
                ) : (
                  <StateBlock
                    state="unavailable"
                    locale={activeLocale}
                    compact
                    className="rounded-[24px] backdrop-blur-md"
                    title={T('Chart series unavailable', 'سلسلة الرسم البياني غير متاحة')}
                    description={T(
                      'POS or branch breakdown data is temporarily unavailable for this view.',
                      'بيانات نقاط البيع أو تفصيل الفروع غير متاحة مؤقتاً لهذا العرض.',
                    )}
                  />
                )}

                <KpiProvenanceBadge
                  odooModel="pos.order + account.move.line"
                  dateRange={provenanceRange}
                  lastSyncAt={lastSyncIso}
                  isStale24h={isStale24h}
                  kind={hasPostedOperatingProfit && !glIncomplete ? 'محسوب بمعادلة' : 'فعلي'}
                  queryOrFormula="pos.order net sales per day/branch + account.move.line posted operating profit ratio"
                />
              </V35GlassCard>

              <V35GlassCard className="ae-bento-card flex flex-col justify-between p-4 sm:p-6 xl:col-span-5">
                <div className="mb-4">
                  <h2 className="text-[17px] sm:text-[18px] font-semibold tracking-tight text-slate-950 dark:text-white">
                    {T(
                      'How Every 10 KWD of Sales Is Distributed',
                      'كيف تتوزع كل 10 دنانير من المبيعات؟',
                    )}
                  </h2>
                  <ScopeBadge kind={companyWideScope} target="gl-distribution" isAr={isAr} className="mt-1" />
                  <p className="whitespace-normal text-[13px] sm:text-[14px] font-medium text-slate-600 dark:text-slate-300">
                    {T(
                      'Computed strictly from Odoo 17 General Ledger (account.move.line)',
                      'محسوب حصراً من قيود دفتر الأستاذ العام في أودو 17 (account.move.line)',
                    )}
                  </p>
                </div>

                {maskInternalCosts ? (
                  <div className="flex flex-1 flex-col justify-between gap-3 rounded-2xl bg-blue-50/75 p-4 ring-1 ring-slate-400/25 backdrop-blur-sm dark:bg-white/[0.06] dark:ring-sky-400/20">
                    <span className="inline-flex w-fit items-center rounded-full bg-blue-100/85 px-2.5 py-0.5 text-xs font-bold text-blue-800 ring-1 ring-blue-500/20 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25">
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
                      centerValue={fmtKwdVal(netPocket10)}
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
                  <div className="flex flex-1 flex-col justify-between gap-3 rounded-2xl bg-amber-50/70 p-4 ring-1 ring-amber-400/30 backdrop-blur-sm dark:bg-amber-950/25 dark:ring-amber-400/25">
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/90 px-2.5 py-1 text-xs font-extrabold text-amber-950 ring-1 ring-amber-400/30 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-400/25">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>{T(GL_INCOMPLETE_EN, GL_INCOMPLETE_AR)}</span>
                      </span>
                      <p className="whitespace-normal text-[13.5px] font-medium leading-relaxed text-slate-800 dark:text-slate-200">
                        {isAr
                          ? (gl.unavailableReasonAr ?? GL_INCOMPLETE_AR)
                          : (gl.unavailableReasonEn ?? GL_INCOMPLETE_EN)}
                      </p>
                      <div className="grid grid-cols-1 gap-2 pt-1 text-xs sm:grid-cols-2">
                        <div className="rounded-xl bg-white/80 p-2.5 ring-1 ring-amber-400/25 backdrop-blur-sm dark:bg-[rgba(15,26,48,0.72)] dark:ring-amber-400/20">
                          <span className="block text-slate-600 dark:text-slate-300">
                            {T('Posted COGS', 'تكلفة المواد المرحّلة')}
                          </span>
                          <span
                            dir={gl.cogsKwd !== null ? 'ltr' : undefined}
                            className="mt-0.5 block font-bold tabular-nums text-slate-900 dark:text-white"
                          >
                            {gl.cogsKwd !== null
                              ? fmtKwdVal(gl.cogsKwd)
                              : T(GL_INCOMPLETE_EN, GL_INCOMPLETE_AR)}
                          </span>
                        </div>
                        <div className="rounded-xl bg-white/80 p-2.5 ring-1 ring-amber-400/25 backdrop-blur-sm dark:bg-[rgba(15,26,48,0.72)] dark:ring-amber-400/20">
                          <span className="block text-slate-600 dark:text-slate-300">
                            {T('Aggregator Commissions', 'عمولات تطبيقات التوصيل')}
                          </span>
                          <span
                            dir={!commissionUnposted ? 'ltr' : undefined}
                            className="mt-0.5 block font-bold tabular-nums text-amber-900 dark:text-amber-200"
                          >
                            {commissionUnposted
                              ? T(UNPOSTED_COMMISSION_EN, UNPOSTED_COMMISSION_AR)
                              : fmtKwdVal(gl.deliveryCommissionsKwd)}
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
              </V35GlassCard>
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
