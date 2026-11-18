'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { OdooPeriodCube, OdooPeriodHourly } from '@/lib/odoo-live-connector'
import {
  Info,
  ArrowUpDown,
  ArrowUpRight,
  Building2,
  CalendarRange,
  Database,
  Percent,
  RefreshCw,
  Search,
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
  StackedProgressBar,
  V35Sparkline,
  type StackedProgressSegment,
  type TimelineHourlyDatum,
} from '@/components/charts/v35-chart-kit'
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
import { PROFIT_AFTER_CLOSE_NOTE } from '@/lib/aether/closed-month-policy'
import { buildArTieOut } from '@/lib/odoo/receivable-aging'
import { canShowReceivableAmounts } from '@/lib/aether/receivables-status'
import { normalizeSharesTo100 } from '@/lib/aether/share-normalization'
import { ReceivablesPendingStatus } from '@/components/ui/receivables-pending-status'
import { resolveHeroDeltaBadge } from '@/lib/aether/hero-delta'
import {
  DASHBOARD_BRANCH_CARD_IDS,
  isExhibitionGroupReported,
  formatPeriodCalendarWindow,
  getBranchLabel,
} from '@/lib/aether/global-filter-engine'
import {
  buildWeeklyChartMeta,
  formatAdminUnmappedAlertCopy,
  formatStaticMarginPill,
} from '@/lib/aether/period-delta'
import { useLang } from '@/components/aether/ui'
import { ChartCard, StateBlock, UnavailableState } from '@/components/ui'
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
      className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-2xl border border-slate-200/85 bg-slate-100/85 p-1 backdrop-blur-md select-none dark:border-slate-800 dark:bg-slate-900/85"
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
type LedgerSortKey = 'label' | 'salesKwd' | 'orders' | 'aovKwd' | 'sharePct'

const NO_ODOO_DATA_AR = 'لا توجد بيانات من Odoo لهذه الفترة'
const NO_ODOO_DATA_EN = 'No Odoo data for this period'
const GL_INCOMPLETE_AR = 'قيود غير مكتملة لهذه الفترة'
const GL_INCOMPLETE_EN = 'Incomplete GL entries for this period'
const COMPANY_MARGIN_NOT_APPLIED_AR = 'هامش الشركة لا يُطبَّق على هذه السلسلة'
const COMPANY_MARGIN_NOT_APPLIED_EN = 'Company GL margin is not applied to this series'
const HOME_AGGREGATOR_CHANNEL_IDS = [
  'talabat-tgo',
  'talabat-tmp',
  'keeta',
  'deliveroo',
  'jahez',
  'snoonu',
] as const

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
const SPARKLINE_UNAVAILABLE_EN = 'Trend not available — no hourly data for this period'
const SPARKLINE_UNAVAILABLE_AR = 'الاتجاه غير متاح — لا توجد بيانات ساعية لهذه الفترة'

export function FullJourney360({
  initialLiveCube = null,
}: {
  /** Selected-period cube (tests / SSR); otherwise fetched from /api/erp/live-comparison. */
  initialLiveCube?: OdooPeriodCube | null
} = {}) {
  const { isAr, T } = useLang()
  const activeLocale = isAr ? 'ar' : 'en'
  const unavailableTooltip = getUnavailableTooltip(activeLocale)
  const { workspace, filters, liveSummary, isAuditor, sessionRole, syncingOdoo } = useGlobalFilter()
  const auditorReadOnly = isAuditor || Boolean(liveSummary?.readOnly)
  const maskInternalCosts = shouldMaskInternalCostsForRole(sessionRole)
  const canSyncOdoo = !auditorReadOnly && canTriggerManualOdooSync(sessionRole)

  const [flowGroup, setFlowGroup] = useState<FlowGroup>('timeline')
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [ledgerSortCol, setLedgerSortCol] = useState<LedgerSortKey>('salesKwd')
  const [ledgerSortDir, setLedgerSortDir] = useState<'asc' | 'desc'>('desc')
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(false)

  const toggleLedgerSort = useCallback(
    (col: LedgerSortKey) => {
      if (ledgerSortCol === col) {
        setLedgerSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setLedgerSortCol(col)
        setLedgerSortDir(col === 'label' ? 'asc' : 'desc')
      }
    },
    [ledgerSortCol],
  )

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
  const hasPostedOperatingNetAmount = Boolean(
    gl.available && gl.operatingProfitKwd !== null,
  )
  const showOperatingNetCard =
    maskInternalCosts ||
    Boolean(gl.available && (hasPostedOperatingNetAmount || gl.netProfitWithheld))
  const showCommissionCard =
    maskInternalCosts ||
    Boolean(gl.available && !commissionUnposted && gl.deliveryCommissionsKwd !== null)
  const visibleTopKpiCount =
    2 + (showOperatingNetCard ? 1 : 0) + (showCommissionCard ? 1 : 0)
  const topKpiGridColsClass =
    visibleTopKpiCount >= 4
      ? 'sm:grid-cols-2 lg:grid-cols-4'
      : visibleTopKpiCount === 3
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : 'sm:grid-cols-2 lg:grid-cols-2'

  const periodWindow = useMemo(
    () =>
      formatPeriodCalendarWindow(filters.period, {
        customFrom: filters.customFrom,
        customTo: filters.customTo,
        liveSummary,
      }),
    [filters.customFrom, filters.customTo, filters.period, liveSummary],
  )
  const glDisplayToIso = gl.to || periodWindow.toInclusiveIso
  const glIncompleteNote = isAr
    ? `القيود المرحّلة حتى ${glDisplayToIso}؛ العمولات والاستهلاك تُرحَّل نهاية الشهر`
    : `Posted entries through ${glDisplayToIso}; commissions & depreciation post at month-end`

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

  // Phase 5 · Item 1: the Home hourly chart uses the SELECTED-period cube (exactly as Cores does),
  // never the summary's month-to-date hourly series.
  const [homeCube, setHomeCube] = useState<OdooPeriodCube | null>(initialLiveCube)
  const [homeHourly, setHomeHourly] = useState<OdooPeriodHourly | null>(null)
  useEffect(() => {
    if (!workspace.odooConnected || workspace.noData) {
      setHomeCube(null)
      return
    }
    const fromIso = periodWindow.fromIso
    const toIso = periodWindow.toInclusiveIso
    if (!fromIso || !toIso) return
    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 20_000)
    fetch(
      `/api/erp/live-comparison?dateA=${encodeURIComponent(fromIso)}&toA=${encodeURIComponent(toIso)}&dateB=${encodeURIComponent(fromIso)}&toB=${encodeURIComponent(toIso)}`,
      { cache: 'no-store', signal: controller.signal },
    )
      .then((r) => {
        if (!r.ok) throw new Error('HTTP_ERROR')
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        setHomeCube(data?.cubeA ? (data.cubeA as OdooPeriodCube) : null)
        setHomeHourly(data?.hourlyA ? (data.hourlyA as OdooPeriodHourly) : null)
      })
      .catch(() => {
        if (cancelled) return
        setHomeCube(null)
        setHomeHourly(null)
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [periodWindow.fromIso, periodWindow.toInclusiveIso, workspace.odooConnected, workspace.noData])

  const coresSnap = useMemo(
    () => computeCoresHubSnapshot(filters, [], liveSummary, homeCube, homeHourly),
    [filters, liveSummary, homeCube, homeHourly],
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
    const boothsReported = isExhibitionGroupReported(activeBucket)
    const mappedRows: BranchCardRow[] = DASHBOARD_BRANCH_CARD_IDS.filter(
      (id) => id !== 'exhibitions' || boothsReported,
    ).map((branchId) => {
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

    // Phase 5 · Item 4: one-decimal shares that total exactly 100.0% (largest remainder).
    if (denom !== null && denom > 0 && withShares.every((r) => r.salesKwd !== null)) {
      const normalized = normalizeSharesTo100(withShares.map((r) => r.salesKwd as number))
      return withShares.map((r, i) => ({ ...r, sharePct: normalized[i] }))
    }
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
    const glReady = hasPostedOperatingProfit
    const canPlotPointMargin = glReady && comboPlotsCompanyMargin
    const glProfitStatusText =
      glReady && !comboPlotsCompanyMargin
        ? isAr
          ? COMPANY_MARGIN_NOT_APPLIED_AR
          : COMPANY_MARGIN_NOT_APPLIED_EN
        : !gl.available
          ? isAr
            ? NO_ODOO_DATA_AR
            : NO_ODOO_DATA_EN
          : gl.netProfitWithheld
            ? isAr
              ? 'صافي التشغيل يُعرض للأشهر المُقفلة فقط'
              : 'Operating profit shown for closed months only'
            : isAr
              ? GL_INCOMPLETE_AR
              : GL_INCOMPLETE_EN
    return src.map((pt) => {
      const sales = Math.max(0, pt.salesKwd)
      const pointMarginPct = canPlotPointMargin ? netPocketPct : 0
      const pointMarginRatio = canPlotPointMargin ? pointMarginPct / 100 : 0
      const pocket = canPlotPointMargin ? Math.max(0, sales * pointMarginRatio) : 0
      const beforeRent =
        canPlotPointMargin && gl.beforeRentPct !== null ? Math.max(0, sales * beforeRentRatio) : 0
      const foodAndDelivery =
        canPlotPointMargin && gl.beforeRentPct !== null ? Math.max(0, sales - beforeRent) : 0
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
                ...(gl.beforeRentPct !== null
                  ? [
                      {
                        label: isAr ? 'المواد والعمولات المرحّلة:' : 'Posted COGS & Commissions:',
                        value: fmtKwdVal(foodAndDelivery),
                        tone: 'slate' as const,
                      },
                      {
                        label: isAr ? 'الباقي قبل الإيجار:' : 'Before Rent:',
                        value: fmtKwdVal(beforeRent),
                        tone: 'slate' as const,
                      },
                    ]
                  : gl.cogsPct !== null
                    ? [
                        {
                          label: isAr ? 'تكلفة البضاعة المرحّلة (COGS):' : 'Posted COGS:',
                          value: fmtKwdVal(Math.max(0, sales * (gl.cogsPct / 100))),
                          tone: 'slate' as const,
                        },
                      ]
                    : []),
                {
                  label: isAr ? 'صافي التشغيل (دفتر الأستاذ):' : 'GL Operating Net:',
                  value: fmtKwdVal(pocket),
                  tone: 'emerald' as const,
                  bold: true,
                },
              ]
            : [
                { label: isAr ? 'المبيعات (pos.order):' : 'Sales (pos.order):', value: fmtKwdVal(sales), bold: true },
                {
                  label: isAr ? 'حالة قيود الربح:' : 'GL Profit Status:',
                  value: glProfitStatusText,
                  tone: 'slate',
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
    gl.available,
    gl.beforeRentPct,
    gl.cogsPct,
    gl.netProfitWithheld,
    hasPostedOperatingProfit,
    isAr,
    maskInternalCosts,
    netPocketPct,
    workspace.noData,
    workspace.odooConnected,
  ])

  const comboHourlyFallback = useMemo<TimelineHourlyDatum[] | undefined>(() => {
    if (flowGroup !== 'timeline' || coresSnap.sales.hourlyUnavailable || coresSnap.sales.hourly.length === 0) {
      return undefined
    }
    return coresSnap.sales.hourly.map((pt) => {
      const hrNum = Number(pt.id.replace('hr-', ''))
      const hourLabel = isAr ? pt.labelAr : pt.labelEn
      return {
        hour: Number.isFinite(hrNum) ? hrNum : hourLabel,
        label: hourLabel,
        netKwd: Math.max(0, pt.salesKwd),
        orders: typeof pt.orders === 'number' && Number.isFinite(pt.orders) ? pt.orders : undefined,
      }
    })
  }, [coresSnap.sales.hourly, coresSnap.sales.hourlyUnavailable, flowGroup, isAr])

  const tenKwdDonutSlices = useMemo<DonutSliceDatum[]>(() => {
    if (!hasPostedOperatingProfit || !gl.totalRevenueKwd || gl.totalRevenueKwd <= 0) return []
    const foodTotal = gl.cogsKwd ?? 0
    const deliveryTotal = gl.deliveryCommissionsKwd ?? 0
    const opexTotal = gl.otherOpexAndDepreciationKwd ?? 0
    const pocketTotal = gl.operatingProfitKwd ?? 0

    const candidates: Array<{ include: boolean; slice: DonutSliceDatum }> = [
      {
        include: foodTotal > 0,
        slice: {
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
      },
      {
        include: !commissionUnposted && deliveryTotal > 0,
        slice: {
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
      },
      {
        include: opexTotal > 0,
        slice: {
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
      },
      {
        include: pocketTotal > 0,
        slice: {
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
      },
    ]

    return candidates.filter((c) => c.include && c.slice.value > 0).map((c) => c.slice)
  }, [
    activeLocale,
    commissionUnposted,
    delivery10,
    fmtKwdVal,
    food10,
    gl,
    hasPostedOperatingProfit,
    isAr,
    netPocket10,
    opexRent10,
  ])

  const showGlDistributionCard =
    maskInternalCosts || Boolean(gl.available && tenKwdDonutSlices.length > 0)

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
        openReceivableKwd: workspace.receivables.openReceivableKwd ?? 0,
      })

  const receivablesAmountsVisible = canShowReceivableAmounts(workspace.receivables)
  const salesSparkline = useMemo<number[]>(() => {
    if (
      !workspace.odooConnected ||
      workspace.noData ||
      workspace.sectionUnavailable ||
      workspace.nullableSalesKwd === null
    ) {
      return []
    }
    if (
      coresSnap.sales.timeline.length >= 2 &&
      (filters.brand === 'all' || coresSnap.sales.timelineScope === 'brand')
    ) {
      return coresSnap.sales.timeline
        .map((p) => p.salesKwd)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    }
    if (
      coresSnap.sales.timeline.length <= 1 &&
      !coresSnap.sales.hourlyUnavailable &&
      coresSnap.sales.hourly.length >= 2 &&
      filters.brand === 'all'
    ) {
      return coresSnap.sales.hourly
        .map((h) => h.salesKwd)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    }
    return []
  }, [
    coresSnap.sales.hourly,
    coresSnap.sales.hourlyUnavailable,
    coresSnap.sales.timeline,
    coresSnap.sales.timelineScope,
    filters.brand,
    workspace.noData,
    workspace.nullableSalesKwd,
    workspace.odooConnected,
    workspace.sectionUnavailable,
  ])

  // No real hourly/daily series for the selected period → calm note instead of a sparkline.
  const sparklineUnavailableShown =
    workspace.odooConnected &&
    !workspace.noData &&
    !workspace.sectionUnavailable &&
    workspace.nullableSalesKwd !== null

  const ordersSparkline = useMemo<number[]>(() => {
    if (
      !workspace.odooConnected ||
      workspace.noData ||
      workspace.sectionUnavailable ||
      workspace.nullableOrders === null ||
      filters.brand !== 'all'
    ) {
      return []
    }
    const source =
      coresSnap.sales.timeline.length >= 2
        ? coresSnap.sales.timeline
        : !coresSnap.sales.hourlyUnavailable && coresSnap.sales.hourly.length >= 2
          ? coresSnap.sales.hourly
          : []
    const vals = source
      .map((pt) => pt.orders)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    return vals.length >= 2 ? vals : []
  }, [
    coresSnap.sales.hourly,
    coresSnap.sales.hourlyUnavailable,
    coresSnap.sales.timeline,
    filters.brand,
    workspace.noData,
    workspace.nullableOrders,
    workspace.odooConnected,
    workspace.sectionUnavailable,
  ])

  const channelMixAvailable =
    filters.brand === 'all' &&
    workspace.odooConnected &&
    !workspace.noData &&
    !workspace.sectionUnavailable &&
    workspace.nullableSalesKwd !== null &&
    !coresSnap.sales.channelsUnavailable &&
    !(
      filters.branch !== 'all' &&
      activeBucket &&
      activeBucket.byLocation?.[filters.branch]?.uiChannels === null
    )

  const channelMixSegments = useMemo<StackedProgressSegment[]>(() => {
    if (!channelMixAvailable) return []
    return coresSnap.sales.channelRanking
      .filter((ch) => ch.salesKwd > 0)
      .map((ch) => ({
        id: ch.id,
        label: isAr ? ch.labelAr : ch.labelEn,
        value: ch.salesKwd,
        valueFormatted: fmtKwdVal(ch.salesKwd),
        pctFormatted: formatPct(ch.sharePct, activeLocale),
        orders:
          typeof ch.orders === 'number' && Number.isFinite(ch.orders) ? ch.orders : undefined,
        color: ch.color,
      }))
  }, [activeLocale, channelMixAvailable, coresSnap.sales.channelRanking, fmtKwdVal, isAr])

  const channelMixTotalKwd = useMemo(
    () =>
      channelMixSegments.length > 0
        ? channelMixSegments.reduce((sum, seg) => sum + seg.value, 0)
        : null,
    [channelMixSegments],
  )

  const aggregatorPosSalesKwd = useMemo<number | null>(() => {
    if (!workspace.odooConnected || workspace.noData) return null
    if (homeCube?.byChannel) {
      let sum = 0
      for (const cid of HOME_AGGREGATOR_CHANNEL_IDS) {
        const val = homeCube.byChannel[cid]?.netKwd
        if (val === null) return null
        if (typeof val === 'number' && Number.isFinite(val)) sum += val
      }
      return Math.round(sum * 1000) / 1000
    }
    if (activeBucket) {
      if (activeBucket.uiChannels === null) return null
      if (activeBucket.uiChannels) {
        let sum = 0
        for (const cid of HOME_AGGREGATOR_CHANNEL_IDS) {
          const cell = activeBucket.uiChannels[cid]
          if (cell === null || cell?.netKwd === null) return null
          if (typeof cell?.netKwd === 'number' && Number.isFinite(cell.netKwd)) sum += cell.netKwd
        }
        return Math.round(sum * 1000) / 1000
      }
    }
    if (!channelMixAvailable) return null
    const sum = channelMixSegments
      .filter((seg) => (HOME_AGGREGATOR_CHANNEL_IDS as readonly string[]).includes(seg.id))
      .reduce((acc, seg) => acc + seg.value, 0)
    return Math.round(sum * 1000) / 1000
  }, [
    activeBucket,
    channelMixAvailable,
    channelMixSegments,
    homeCube,
    workspace.noData,
    workspace.odooConnected,
  ])

  const commPctOfAggSales =
    gl.deliveryCommissionsKwd !== null &&
    aggregatorPosSalesKwd !== null &&
    aggregatorPosSalesKwd > 0
      ? Math.round((gl.deliveryCommissionsKwd / aggregatorPosSalesKwd) * 1000) / 10
      : null

  const ledgerRows = useMemo(() => {
    if (brandBranchScopeUnavailable || branchCards.length === 0) return []
    const q = ledgerSearch.trim().toLowerCase()
    const filtered = q
      ? branchCards.filter(
          (r) =>
            r.labelAr.toLowerCase().includes(q) ||
            r.labelEn.toLowerCase().includes(q) ||
            r.id.toLowerCase().includes(q),
        )
      : [...branchCards]

    const compareNullableNum = (a: number | null, b: number | null) => {
      if (a === null && b === null) return 0
      if (a === null) return 1
      if (b === null) return -1
      return ledgerSortDir === 'asc' ? a - b : b - a
    }

    filtered.sort((a, b) => {
      if (ledgerSortCol === 'label') {
        const la = isAr ? a.labelAr : a.labelEn
        const lb = isAr ? b.labelAr : b.labelEn
        return ledgerSortDir === 'asc' ? la.localeCompare(lb) : lb.localeCompare(la)
      }
      return compareNullableNum(a[ledgerSortCol], b[ledgerSortCol])
    })
    return filtered
  }, [branchCards, brandBranchScopeUnavailable, isAr, ledgerSearch, ledgerSortCol, ledgerSortDir])

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
          className="rounded-[24px] backdrop-blur-xl ring-1 ring-slate-300/60 shadow-[0_10px_28px_-12px_rgba(15,23,42,0.12)] dark:ring-white/10"
        />
      ) : null}

      <OdooPartialWarningBanner
        summary={liveSummary}
        isAr={isAr}
        className="!rounded-[24px] sm:px-5 sm:py-3.5"
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
          className="ae-bento-card mx-auto my-4 p-8 sm:p-10 text-center ring-1 ring-slate-300/70 dark:ring-slate-600/40"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100/85 text-slate-700 ring-1 ring-slate-300/70 backdrop-blur-sm dark:bg-slate-800/75 dark:text-slate-200 dark:ring-slate-600/40">
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
              className="ae-bento-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-medium text-slate-700 ring-1 ring-slate-900/[0.04] sm:px-5 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:ring-white/5"
            >
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
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
                className="inline-flex shrink-0 cursor-pointer items-center rounded-full bg-slate-100/90 px-3.5 py-1.5 text-xs font-semibold text-slate-800 ring-1 ring-slate-300/70 transition-colors hover:bg-slate-200/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.08] dark:text-slate-100 dark:ring-white/15 dark:hover:bg-white/[0.14]"
              >
                {T('Map POS Terminals ↓', 'ربط أجهزة الكاشير ↓')}
              </button>
            </V35GlassCard>
          ) : null}

          {/* Dynamic Executive KPI Row (Strictly Actual / Ledger Metrics — Zero Empty Cards) */}
          <section className="space-y-4 sm:space-y-5">
            <div className={`ae-stagger grid grid-cols-1 ${topKpiGridColsClass} gap-3.5 sm:gap-4`}>
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
                    valueClassName="whitespace-nowrap text-[clamp(1.25rem,1.9vw,1.9rem)]"
                  />
                </div>

                {salesSparkline.length >= 2 ? (
                  <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-2.5 py-1.5">
                    <span className="text-xs font-medium text-sky-100/95">
                      {coresSnap.sales.timeline.length >= 2
                        ? T('Period trend', 'اتجاه الفترة')
                        : T('Hourly trend', 'اتجاه اليوم')}
                    </span>
                    <V35Sparkline values={salesSparkline} color="#E0F2FE" width={92} height={26} />
                  </div>
                ) : sparklineUnavailableShown ? (
                  <div
                    role="status"
                    data-sparkline-unavailable="true"
                    className="mt-2.5 rounded-xl border border-white/15 bg-white/[0.08] px-2.5 py-1.5 text-xs font-medium text-sky-100/90"
                  >
                    {T(SPARKLINE_UNAVAILABLE_EN, SPARKLINE_UNAVAILABLE_AR)}
                  </div>
                ) : null}

                <div className="mt-3.5 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      data-delta-comparison={heroDelta.hasComparison ? 'real' : 'none'}
                      title={isAr ? (heroDelta.titleAr ?? undefined) : (heroDelta.titleEn ?? undefined)}
                      className={`ae-hero-pill inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm ${
                        heroDelta.tone === 'red'
                          ? 'bg-slate-900/25 text-white/90 ring-1 ring-white/20'
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
                      className="whitespace-normal text-xs font-medium tabular-nums text-sky-100/95"
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
                    <p className="whitespace-normal text-xs font-medium tabular-nums text-sky-100/95">
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

                {ordersSparkline.length >= 2 ? (
                  <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/75 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-800/50">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {coresSnap.sales.timeline.length >= 2
                        ? T('Order trend', 'اتجاه الطلبات')
                        : T('Hourly orders', 'الطلبات بالساعة')}
                    </span>
                    <V35Sparkline values={ordersSparkline} color="#2563EB" width={92} height={26} />
                  </div>
                ) : sparklineUnavailableShown && workspace.nullableOrders !== null && filters.brand === 'all' ? (
                  <div
                    role="status"
                    data-sparkline-unavailable="true"
                    className="mt-2.5 rounded-xl border border-slate-200/80 bg-slate-50/75 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400"
                  >
                    {T(SPARKLINE_UNAVAILABLE_EN, SPARKLINE_UNAVAILABLE_AR)}
                  </div>
                ) : null}

                <div className="mt-3.5 space-y-1.5">
                  {maskInternalCosts ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        data-cost-mask="restricted-finance-gm"
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100/90 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-400/25 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/15"
                      >
                        {T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')}
                      </span>
                    </div>
                  ) : gl.beforeRentKwd !== null && gl.beforeRentPct !== null ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        dir="ltr"
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                          beforeRentRatio < 0
                            ? 'bg-slate-100/90 text-slate-700 ring-1 ring-slate-300/60 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/15'
                            : 'bg-blue-50/90 text-blue-700 ring-1 ring-blue-500/20 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25'
                        }`}
                      >
                        {formatStaticMarginPill(gl.beforeRentPct)} • {fmtKwdVal(gl.beforeRentKwd)}
                      </span>
                    </div>
                  ) : null}
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

              {/* Card 3: Net Operating Profit (Renders posted GL operating net even when glIncomplete=true with month-end note; withheld in open months; removed when no GL exists) */}
              {showOperatingNetCard ? (
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
                  ) : hasPostedOperatingNetAmount ? (
                    <>
                      <div className="mt-3">
                        <V35KpiRing
                          tone="indigo"
                          size="md"
                          dataKpi="operating-net"
                          value={gl.operatingProfitKwd}
                          percent={typeof gl.netProfitPct === 'number' ? gl.netProfitPct : null}
                          display={fmtKwdVal(gl.operatingProfitKwd)}
                          unavailableTooltip={unavailableTooltip}
                          ringCenter={
                            typeof gl.netProfitPct === 'number' ? (
                              <span dir="ltr" className="tabular-nums">
                                {`${gl.netProfitPct.toFixed(1)}%`}
                              </span>
                            ) : (
                              <TrendingUp className="h-4 w-4" aria-hidden="true" />
                            )
                          }
                          valueClassName="text-xl sm:text-2xl xl:text-[26px]"
                        />
                      </div>

                      <div className="mt-3.5 space-y-1.5">
                        {typeof gl.netProfitPct === 'number' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50/90 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-500/20 dark:bg-indigo-400/15 dark:text-indigo-200 dark:ring-indigo-400/25">
                            <span dir="ltr" className="tabular-nums">
                              {formatStaticMarginPill(gl.netProfitPct)}
                            </span>{' '}
                            <span>{T('GL net share', 'نسبة الصافي المحاسبي')}</span>
                          </span>
                        ) : null}
                        {glIncomplete ? (
                          <p
                            data-gl-incomplete-note="true"
                            className="whitespace-normal rounded-xl border border-slate-200/80 bg-slate-50/75 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300"
                          >
                            {glIncompleteNote}
                          </p>
                        ) : null}
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
                  ) : (
                    <>
                      <div data-net-profit-withheld="true" className="mt-3 space-y-2">
                        <UnavailableState
                          isAr={isAr}
                          compact
                          reason={
                            isAr
                              ? gl.netProfitWithheldReasonAr ?? PROFIT_AFTER_CLOSE_NOTE.ar
                              : gl.netProfitWithheldReasonEn ?? PROFIT_AFTER_CLOSE_NOTE.en
                          }
                        />
                        {typeof gl.totalRevenueKwd === 'number' && gl.totalRevenueKwd > 0 ? (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">
                            <span>
                              {T('Posted GL Rev:', 'إيراد الأستاذ:')}{' '}
                              <span dir="ltr" className="font-semibold text-slate-800 dark:text-slate-100">
                                {fmtKwdVal(gl.totalRevenueKwd)}
                              </span>
                            </span>
                            {typeof gl.cogsKwd === 'number' && gl.cogsKwd > 0 ? (
                              <span>
                                {T('COGS:', 'التكلفة:')}{' '}
                                <span dir="ltr" className="font-semibold text-slate-800 dark:text-slate-100">
                                  {fmtKwdVal(gl.cogsKwd)}
                                </span>
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-3.5">
                        <KpiProvenanceBadge
                          odooModel="account.move.line"
                          dateRange={{ from: gl.from, to: gl.to }}
                          lastSyncAt={lastSyncIso}
                          isStale24h={isStale24h}
                          kind="فعلي"
                          queryOrFormula="account.move.line(parent_state='posted') — open month profit withheld"
                          compact
                        />
                      </div>
                    </>
                  )}
                </V35GlassCard>
              ) : null}

              {/* Card 4: Aggregator Commissions (platform_commission from Part 2; omitted completely when unposted/0) */}
              {showCommissionCard ? (
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
                  ) : (
                    (() => {
                      const commissionRingPct = commPctOfAggSales ?? gl.deliveryCommPct
                      return (
                        <>
                          <div className="mt-3">
                            <V35KpiRing
                              tone="sky"
                              size="md"
                              dataKpi="aggregator-commissions"
                              value={gl.deliveryCommissionsKwd}
                              display={fmtKwdVal(gl.deliveryCommissionsKwd)}
                              percent={typeof commissionRingPct === 'number' ? commissionRingPct : null}
                              unavailableTooltip={unavailableTooltip}
                              ringCenter={
                                typeof commissionRingPct === 'number' ? (
                                  <span dir="ltr" className="tabular-nums">
                                    {`${commissionRingPct.toFixed(1)}%`}
                                  </span>
                                ) : (
                                  <Percent className="h-4 w-4" aria-hidden="true" />
                                )
                              }
                              valueClassName="text-xl sm:text-2xl xl:text-[26px]"
                            />
                          </div>
                          <div className="mt-3.5 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {commPctOfAggSales !== null ? (
                                <span
                                  data-commission-agg-pct="true"
                                  className="inline-flex items-center gap-1 rounded-full bg-sky-50/90 px-2.5 py-0.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-500/20 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25"
                                >
                                  <span dir="ltr" className="tabular-nums">
                                    {formatPct(commPctOfAggSales, activeLocale)}
                                  </span>{' '}
                                  <span>{T('of aggregator sales', 'من مبيعات تطبيقات التوصيل')}</span>
                                </span>
                              ) : null}
                              {gl.deliveryCommPct !== null ? (
                                <span
                                  data-commission-gl-pct="true"
                                  className="inline-flex items-center gap-1 rounded-full bg-slate-100/90 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300/60 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/15"
                                >
                                  <span dir="ltr" className="tabular-nums">
                                    {formatPct(gl.deliveryCommPct, activeLocale)}
                                  </span>{' '}
                                  <span>{T('of GL revenue', 'من إيراد دفتر الأستاذ')}</span>
                                </span>
                              ) : null}
                            </div>
                            <KpiProvenanceBadge
                              odooModel="account.move.line"
                              dateRange={{ from: gl.from, to: gl.to }}
                              lastSyncAt={lastSyncIso}
                              isStale24h={isStale24h}
                              kind="فعلي"
                              queryOrFormula="account.move.line(parent_state='posted', platform_commission accounts)"
                              compact
                            />
                          </div>
                        </>
                      )
                    })()
                  )}
                </V35GlassCard>
              ) : null}
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
                          ? 'border !border-dashed border-slate-300/90 bg-slate-50/75 dark:border-slate-700/80 dark:bg-slate-900/40'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                              bRow.isUnattributed
                                ? 'bg-slate-200/80 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300'
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
                              ? 'bg-slate-200/80 text-slate-700 ring-1 ring-slate-300/70 dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-600/50'
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
                            tone={bRow.isUnattributed ? 'neutral' : 'blue'}
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
              <V35GlassCard className="ae-bento-card flex flex-col justify-between border border-slate-200/85 p-4 sm:p-6 lg:col-span-7 dark:border-slate-800">
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
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/85 bg-blue-50/80 px-3.5 py-1 text-xs font-semibold tabular-nums text-slate-800 backdrop-blur-sm dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-100">
                      <span>{isAr ? activeWeeklyDay.dayNameAr : activeWeeklyDay.dayNameEn}</span>
                      <span aria-hidden className="text-slate-300 dark:text-white/20">
                        •
                      </span>
                      <span dir="ltr">{fmtKwdVal(activeWeeklyDay.salesKwd)}</span>
                      {weeklyChartMeta.bars.find((b) => b.id === activeWeeklyDay.id)?.isPartialToday ? (
                        <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300/70 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600/50">
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
                              <span className="mb-2 inline-flex items-center whitespace-nowrap rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300/70 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600/50">
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
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-300/80 bg-slate-100/90 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-600/60 dark:bg-slate-800/70 dark:text-slate-200">
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
                        className="block rounded-[20px] border border-slate-300/80 bg-slate-50/75 p-4 backdrop-blur-sm transition-colors hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:border-slate-700/75 dark:bg-slate-900/45 dark:hover:bg-slate-800/60"
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
                            className="text-lg font-extrabold tabular-nums text-slate-950 dark:text-white"
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
                                className="rounded-xl border border-slate-200/80 bg-white/85 p-2.5 backdrop-blur-sm dark:border-slate-700/60 dark:bg-[rgba(15,26,48,0.72)]"
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
                            <div className="flex items-center justify-between gap-2 border-t border-slate-200/80 pt-1 dark:border-slate-700/60">
                              <dt>{T('= Open receivables', '= صافي الذمم المفتوحة')}</dt>
                              <dd dir="ltr" className="font-bold tabular-nums">{fmtKwdVal(arTieOut.openReceivableKwd)}</dd>
                            </div>
                            {arTieOut.ties ? null : (
                              <p className="text-slate-600 dark:text-slate-300">
                                {T('Does not tie; difference', 'لا يتطابق؛ الفرق')}{' '}
                                <span dir="ltr" className="tabular-nums">{fmtKwdVal(arTieOut.differenceKwd)}</span>
                              </p>
                            )}
                          </dl>
                        ) : null}
                        {receivablesAmountsVisible && workspace.receivables.agingHiddenReasonAr ? (
                          <p data-ar-aging-hidden="true" className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
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
                className={`ae-bento-card flex flex-col justify-between border border-slate-200/85 p-4 sm:p-6 ${
                  showGlDistributionCard ? 'xl:col-span-7' : 'xl:col-span-12'
                } dark:border-slate-800`}
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-[17px] sm:text-[18px] font-semibold tracking-tight text-slate-950 dark:text-white">
                      {T('POS Sales & Posted Operating Net', 'مبيعات نقاط البيع وصافي التشغيل المرحّل')}
                    </h2>
                    <ScopeBadge kind={comboScope.badge} target="sales-net-combo" isAr={isAr} className="mt-1" />
                    <p className="whitespace-normal text-[13px] sm:text-[14px] font-medium text-slate-600 dark:text-slate-300">
                      {hasPostedOperatingProfit
                        ? glIncomplete
                          ? glIncompleteNote
                          : T(
                              'Tap or hover any bar to inspect exact KWD from Odoo 17',
                              'اضغط أو مرر على أي عمود لعرض القيم الفعلية من أودو 17',
                            )
                        : !gl.available
                          ? T(
                              'Tap or hover any bar to inspect exact POS sales from Odoo 17',
                              'اضغط أو مرر على أي عمود لعرض مبيعات نقاط البيع الفعلية من أودو 17',
                            )
                          : gl.netProfitWithheld
                            ? T(
                                'Sales bars from Odoo POS; GL operating profit awaits month close',
                                'أعمدة المبيعات من نقاط بيع أودو؛ صافي التشغيل بعد إقفال الشهر',
                              )
                            : T(GL_INCOMPLETE_EN, GL_INCOMPLETE_AR)}
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
                    hourlyFallback={comboHourlyFallback}
                    isAr={isAr}
                    salesLegend={T('Sales (pos.order)', 'المبيعات (pos.order)')}
                    netLegend={
                      hasPostedOperatingProfit
                        ? comboPlotsCompanyMargin
                          ? T('GL Operating Profit', 'صافي التشغيل (دفتر الأستاذ)')
                          : T(COMPANY_MARGIN_NOT_APPLIED_EN, COMPANY_MARGIN_NOT_APPLIED_AR)
                        : !gl.available
                          ? T('POS Sales Only (no GL entries)', 'المبيعات فقط (لا توجد قيود)')
                          : gl.netProfitWithheld
                            ? T('Operating net withheld (open month)', 'الصافي محجوب (شهر مفتوح)')
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
                  kind={hasPostedOperatingProfit ? 'محسوب بمعادلة' : 'فعلي'}
                  queryOrFormula="pos.order net sales per day/branch + account.move.line posted operating profit ratio"
                />
              </V35GlassCard>

              {showGlDistributionCard ? (
                <V35GlassCard className="ae-bento-card flex flex-col justify-between border border-slate-200/85 p-4 sm:p-6 xl:col-span-5 dark:border-slate-800">
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
                    <div className="flex flex-1 flex-col justify-between gap-3 rounded-2xl border border-slate-200/85 bg-blue-50/75 p-4 backdrop-blur-sm dark:border-slate-800 dark:bg-white/[0.06]">
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
                  ) : (
                    <div className="space-y-2.5">
                      <InteractiveDonutChart
                        slices={tenKwdDonutSlices}
                        centerValue={fmtKwdVal(netPocket10)}
                        centerSubValue={T('per 10 KWD', 'من كل 10 د.ك')}
                        centerLabel={T('GL Net Share', 'نصيب الصافي')}
                        isAr={isAr}
                        legendLayout="beside"
                      />
                      {glIncomplete ? (
                        <p
                          data-gl-incomplete-note="true"
                          className="whitespace-normal rounded-xl border border-slate-200/80 bg-slate-50/75 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300"
                        >
                          {glIncompleteNote}
                        </p>
                      ) : null}
                      <KpiProvenanceBadge
                        odooModel="account.move.line"
                        dateRange={{ from: gl.from, to: gl.to }}
                        lastSyncAt={lastSyncIso}
                        isStale24h={isStale24h}
                        kind="محسوب بمعادلة"
                        queryOrFormula="(COGS + DeliveryCommissions + OpexRentDepr + OperatingProfit) / Revenue * 10 KWD"
                      />
                    </div>
                  )}
                </V35GlassCard>
              ) : null}
            </div>

            {/* Channel Mix Share + Sortable & Searchable Operational Ledger Summary Table */}
            <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-12">
              <div className="xl:col-span-5">
                <ChartCard
                  title={T('Sales Mix by Channel', 'توزيع المبيعات حسب القناة')}
                  subtitle={T('Share of active POS channels', 'حصة كل قناة نشطة من صافي المبيعات')}
                  period={`${periodWindow.fromIso} → ${periodWindow.toInclusiveIso}`}
                  unit={isAr ? 'د.ك' : 'KWD'}
                  locale={activeLocale}
                  kpiValue={channelMixTotalKwd !== null ? fmtKwdVal(channelMixTotalKwd) : undefined}
                  infoLabel={T('Channel mix provenance', 'مصدر بيانات القنوات')}
                  infoContent={
                    <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
                      <p className="font-semibold">
                        {T(
                          'Computed directly from Odoo 17 POS payment and order channels (pos.payment + pos.order).',
                          'محسوب مباشرة من قنوات الدفع والطلبات الفعلية في أودو 17 (pos.payment + pos.order).',
                        )}
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">
                        {T('Window:', 'الفترة:')}{' '}
                        <span dir="ltr" className="font-semibold tabular-nums">
                          {periodWindow.fromIso} → {periodWindow.toInclusiveIso}
                        </span>
                      </p>
                      {filters.brand !== 'all' ? (
                        <p className="text-slate-600 dark:text-slate-300">
                          {T(
                            'Withheld when brand-scoped without an exact brand-by-channel payment split.',
                            'يُحجب عند تصفية علامة تجارية دون تقسيم دقيق حسب القناة.',
                          )}
                        </p>
                      ) : null}
                    </div>
                  }
                  showGridBackdrop={false}
                  minHeightClass="min-h-0"
                >
                  {channelMixSegments.length > 0 ? (
                    <StackedProgressBar
                      segments={channelMixSegments}
                      isAr={isAr}
                      locale={activeLocale}
                    />
                  ) : (
                    <UnavailableState
                      compact
                      isAr={isAr}
                      reason={isAr ? 'غير متاح بعد' : 'Not available yet'}
                    />
                  )}
                </ChartCard>
              </div>

              <V35GlassCard
                as="section"
                data-ledger-table="true"
                aria-label={T('Operational Ledger Summary', 'ملخص سجل العمليات حسب الفرع')}
                className="ae-bento-card flex flex-col justify-between border border-slate-200/85 p-4 sm:p-5 xl:col-span-7 dark:border-slate-800"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-[16px] sm:text-[17.5px] font-semibold tracking-tight text-slate-950 dark:text-white">
                      {T('Operational Branch Ledger', 'ملخص سجل الفروع التشغيلي')}
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {T(
                        'Actual Odoo 17 POS totals across mapped branches and unattributed terminals',
                        'قراءات نقاط البيع الفعلية للفروع السبعة والسطر غير المنسوب لفرع',
                      )}
                    </p>
                  </div>

                  {branchCards.length > 0 && !brandBranchScopeUnavailable ? (
                    <div className="relative w-full sm:w-56">
                      <Search
                        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={ledgerSearch}
                        onChange={(e) => setLedgerSearch(e.target.value)}
                        placeholder={isAr ? 'ابحث…' : 'Search branch…'}
                        aria-label={isAr ? 'ابحث عن فرع' : 'Search branch'}
                        className="h-9 w-full rounded-xl border border-slate-200/90 bg-slate-50/80 ps-9 pe-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-slate-700/80 dark:bg-slate-800/70 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-sky-400 dark:focus:bg-slate-900"
                      />
                    </div>
                  ) : null}
                </div>

                {branchCards.length === 0 || brandBranchScopeUnavailable ? (
                  <div className="mt-4">
                    <UnavailableState
                      compact
                      isAr={isAr}
                      reason={isAr ? 'غير متاح بعد' : 'Not available yet'}
                    />
                  </div>
                ) : (
                  <div className="mt-4 max-h-[420px] overflow-x-auto overflow-y-auto rounded-2xl border border-slate-200/85 bg-white dark:border-slate-800 dark:bg-slate-900/95">
                    <table className="w-full min-w-[560px] border-collapse text-start text-[13px]">
                      <thead className="sticky top-0 z-10 border-b border-slate-200/85 bg-slate-50/95 text-xs font-semibold text-slate-600 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-300">
                        <tr>
                          {(
                            [
                              { key: 'label', label: T('Branch', 'الفرع'), align: 'start' },
                              { key: 'salesKwd', label: T('Net Sales', 'صافي المبيعات'), align: 'end' },
                              { key: 'orders', label: T('Orders', 'الطلبات'), align: 'end' },
                              { key: 'aovKwd', label: T('AOV', 'متوسط الطلب'), align: 'end' },
                              { key: 'sharePct', label: T('Share', 'الحصة'), align: 'end' },
                            ] as const
                          ).map((col) => {
                            const isSorted = ledgerSortCol === col.key
                            const ariaSort: 'ascending' | 'descending' | 'none' = isSorted
                              ? ledgerSortDir === 'asc'
                                ? 'ascending'
                                : 'descending'
                              : 'none'
                            return (
                              <th
                                key={col.key}
                                scope="col"
                                aria-sort={ariaSort}
                                className={`whitespace-nowrap px-3.5 py-2.5 ${
                                  col.align === 'start' ? 'text-start ps-4' : 'text-end last:pe-4'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleLedgerSort(col.key)}
                                  className={`inline-flex cursor-pointer items-center gap-1 font-semibold transition-colors hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:hover:text-sky-300 ${
                                    isSorted ? 'text-blue-700 dark:text-sky-300' : ''
                                  }`}
                                >
                                  <span>{col.label}</span>
                                  <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-75" aria-hidden="true" />
                                </button>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-slate-800/80">
                        {ledgerRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400"
                            >
                              {T('No matching branches found', 'لا توجد فروع مطابقة للبحث')}
                            </td>
                          </tr>
                        ) : (
                          ledgerRows.map((row) => (
                            <tr
                              key={row.id}
                              className={`transition-colors hover:bg-slate-50/85 dark:hover:bg-slate-800/45 ${
                                row.isUnattributed ? 'bg-slate-50/70 dark:bg-slate-800/30' : ''
                              }`}
                            >
                              <td className="ps-4 pe-3 py-2.5 text-start font-semibold text-slate-950 dark:text-white">
                                <span>
                                  {row.isUnattributed
                                    ? T(UNATTRIBUTED_BRANCH_LABEL_EN, UNATTRIBUTED_BRANCH_LABEL_AR)
                                    : isAr
                                      ? row.labelAr
                                      : row.labelEn}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-end font-semibold text-slate-950 dark:text-white">
                                <span
                                  dir="ltr"
                                  title={row.salesKwd === null ? unavailableTooltip : undefined}
                                  data-unavailable={row.salesKwd === null ? 'true' : undefined}
                                  className="tabular-nums"
                                >
                                  {fmtKwdVal(row.salesKwd)}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-end text-slate-700 dark:text-slate-200">
                                <span
                                  dir="ltr"
                                  title={row.orders === null ? unavailableTooltip : undefined}
                                  data-unavailable={row.orders === null ? 'true' : undefined}
                                  className="tabular-nums"
                                >
                                  {formatInt(row.orders, { locale: activeLocale })}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-end text-slate-700 dark:text-slate-200">
                                <span
                                  dir="ltr"
                                  title={row.aovKwd === null ? unavailableTooltip : undefined}
                                  data-unavailable={row.aovKwd === null ? 'true' : undefined}
                                  className="tabular-nums"
                                >
                                  {fmtKwdVal(row.aovKwd)}
                                </span>
                              </td>
                              <td className="ps-3.5 pe-4 py-2.5 text-end text-slate-700 dark:text-slate-200">
                                <span
                                  dir="ltr"
                                  title={row.sharePct === null ? unavailableTooltip : undefined}
                                  data-unavailable={row.sharePct === null ? 'true' : undefined}
                                  className="tabular-nums"
                                >
                                  {formatPct(row.sharePct, activeLocale)}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
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
