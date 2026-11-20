'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Eye,
  EyeOff,
  Search,
  Truck,
  Wallet,
} from 'lucide-react'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { aggregateAggregatorMatrix } from '@/lib/aether/aggregator-matrix'
import {
  DASHBOARD_BRANCH_CARD_IDS,
  formatPeriodCalendarWindow,
  getBranchLabel,
  getChannelLabel,
  type GlobalBranch,
  type GlobalChannel,
} from '@/lib/aether/global-filter-engine'
import {
  UNATTRIBUTED_BRANCH_LABEL_AR,
  UNATTRIBUTED_BRANCH_LABEL_EN,
} from '@/lib/aether/cores-hub-engine'
import {
  resolveReceivablesDateRange,
  selectReceivablesHeadline,
} from '@/lib/aether/receivables-headline'
import { InteractiveDonutChart, type DonutSliceDatum } from '@/components/aether/InteractiveHoverCharts'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
import { ChartCard, StateBlock } from '@/components/ui'
import { CompactInfoTooltip } from '@/components/ui/compact-info-tooltip'
import {
  formatInt,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { shouldMaskInternalCostsForRole } from '@/lib/auth/role-access-policy'
import { useLang } from '@/components/aether/ui'

type AggregatorChannelKey =
  | 'talabat-tgo'
  | 'talabat-tmp'
  | 'keeta'
  | 'deliveroo'
  | 'jahez'
  | 'snoonu'

const AGGREGATOR_CHANNELS: readonly {
  key: AggregatorChannelKey
  color: string
}[] = [
  { key: 'talabat-tgo', color: '#F97316' },
  { key: 'talabat-tmp', color: '#EA580C' },
  { key: 'keeta', color: '#EAB308' },
  { key: 'deliveroo', color: '#14B8A6' },
  { key: 'jahez', color: '#EF4444' },
  { key: 'snoonu', color: '#EC4899' },
] as const

const DIRECT_CHANNELS: readonly Exclude<GlobalChannel, 'all' | AggregatorChannelKey>[] = [
  'dine-in',
  'takeaway-direct',
]

const NO_ODOO_DATA_AR = 'لا توجد بيانات من Odoo لهذه الفترة'
const NO_ODOO_DATA_EN = 'No data from Odoo for this period'

const safeNum = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0

function readChannelCell(
  cell: { netKwd?: number | null; orders?: number | null } | null | undefined,
): { salesKwd: number | null; orders: number | null } {
  if (cell === null) {
    return { salesKwd: null, orders: null }
  }
  if (cell === undefined) {
    return { salesKwd: 0, orders: 0 }
  }
  return {
    salesKwd: cell.netKwd === null ? null : safeNum(cell.netKwd),
    orders: cell.orders === null ? null : Math.round(safeNum(cell.orders)),
  }
}

const f0 = (n: number, locale: FormatLocale = 'en') => formatInt(n, locale)
const f1Pct = (n: number, locale: FormatLocale = 'en') =>
  formatPct(n, { locale, decimals: 1 })

function fmtKwd(v: number | null | undefined, isAr: boolean): string {
  if (v === null || v === undefined || !Number.isFinite(v)) {
    return isAr ? 'غير متاح' : '—'
  }
  return formatKwd(v, { locale: isAr ? 'ar' : 'en', decimals: 3 })
}

function isZeroDeliveryRow(salesKwd: number | null, orders: number | null): boolean {
  return salesKwd !== null && Math.abs(salesKwd) <= 0.0005 && (orders ?? 0) === 0
}

function resolveRadarKpiGridCols(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 md:grid-cols-2'
  if (count === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
}

interface BranchChannelMatrixRow {
  rowId: string
  branchId: Exclude<GlobalBranch, 'all'> | 'unattributed'
  branchLabelAr: string
  branchLabelEn: string
  isUnattributed: boolean
  channelKey: AggregatorChannelKey
  channelLabelAr: string
  channelLabelEn: string
  salesKwd: number | null
  orders: number | null
  aovKwd: number | null
  shareOfAggregatorPct: number | null
}

/**
 * رادار منصات التوصيل والعمولات (`/erp/aggregator-radar` & `/erp/commissions`)
 * - يقرأ مبيعات وطلبات كل منصة وكل فرع مباشرةً من أودو 17 (`pos.payment` + `pos.order`).
 * - يخفي الصفوف والكروت الصفرية (`0.000 KWD` / `0 orders`) افتراضياً مع زر «إظهار الصفوف الصفرية».
 */
export function DeliveryRadarV5({
  initialLiveCube = null,
  initialShowZeroRows = false,
}: {
  initialLiveCube?: OdooPeriodCube | null
  initialShowZeroRows?: boolean
} = {}) {
  const { isAr, T } = useLang()
  const resolvedLocale: FormatLocale = isAr ? 'ar' : 'en'
  const unavailableTip = getUnavailableTooltip(resolvedLocale)
  const { filters, workspace, liveSummary, sessionRole } = useGlobalFilter()
  const maskInternalCosts = shouldMaskInternalCostsForRole(sessionRole)

  const [channelFilter, setChannelFilter] = useState<'all' | AggregatorChannelKey>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showZeroRows, setShowZeroRows] = useState<boolean>(initialShowZeroRows)
  const [liveCube, setLiveCube] = useState<OdooPeriodCube | null>(initialLiveCube)
  const [loadingCube, setLoadingCube] = useState(false)
  const [cubeError, setCubeError] = useState(false)
  const [retryTick, setRetryTick] = useState(0)

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

  const matrixRange = liveCube?.dateRange ?? provenanceRange

  const receivablesHeadline = useMemo(
    () => selectReceivablesHeadline(workspace.receivables),
    [workspace.receivables],
  )

  const receivablesDateRange = useMemo(
    () => resolveReceivablesDateRange(workspace.receivables, liveSummary?.aggregatorReceivables),
    [liveSummary?.aggregatorReceivables, workspace.receivables],
  )

  useEffect(() => {
    if (!workspace.odooConnected || workspace.noData) {
      setLiveCube(null)
      setCubeError(false)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    setLoadingCube(true)
    setCubeError(false)

    const qs = new URLSearchParams({
      fromA: periodWindow.fromIso,
      toA: periodWindow.toInclusiveIso,
      fromB: periodWindow.fromIso,
      toB: periodWindow.toInclusiveIso,
    })

    fetch(`/api/erp/live-comparison?${qs.toString()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP_ERROR')
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        if (data?.cubeA && data.cubeA.connected && !data.cubeA.noData) {
          setLiveCube(data.cubeA as OdooPeriodCube)
        } else {
          setLiveCube(null)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setLiveCube(null)
        setCubeError(true)
      })
      .finally(() => {
        if (!cancelled) setLoadingCube(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    periodWindow.fromIso,
    periodWindow.toInclusiveIso,
    workspace.noData,
    workspace.odooConnected,
    retryTick,
  ])

  const activeBucket = useMemo(() => {
    if (!liveSummary || liveSummary.connected !== true) return null
    if (filters.period === 'custom') return liveSummary.customBucket ?? null
    return liveSummary.buckets?.[filters.period] ?? null
  }, [filters.period, liveSummary])

  const gl = workspace.accounting
  const commissionUnposted = Boolean(
    workspace.aggregatorCommissionUnposted ||
      gl.aggregatorCommissionUnposted ||
      gl.deliveryCommissionsKwd === null ||
      filters.period === 'today' ||
      filters.period === 'week',
  )

  const lastSyncIso =
    liveCube?.lastSyncAt ??
    liveSummary?.lastSyncAt ??
    liveSummary?.syncedAt ??
    workspace.lastSyncAt ??
    workspace.lastSyncedAt ??
    null
  const isStale24h = Boolean(
    liveCube?.isStale24h || liveSummary?.isStale24h || workspace.isStale24h,
  )

  const channelsUnavailable = Boolean(
    !liveCube &&
      activeBucket &&
      (activeBucket.uiChannels == null ||
        activeBucket.totals.restaurantNetKwd === null ||
        (filters.branch !== 'all' && activeBucket.byLocation?.[filters.branch]?.uiChannels == null)),
  )

  // Channel Totals (6 Aggregator Platforms) directly from Odoo pos.payment
  const platformSummaries = useMemo(() => {
    if (!workspace.odooConnected || workspace.noData) return []

    const rows = AGGREGATOR_CHANNELS.map(({ key, color }) => {
      if (channelsUnavailable) {
        return {
          key,
          color,
          labelAr: getChannelLabel(key, true),
          labelEn: getChannelLabel(key, false),
          salesKwd: null as number | null,
          orders: null as number | null,
          aovKwd: null as number | null,
          sharePct: null as number | null,
        }
      }

      let salesKwd: number | null = 0
      let orders: number | null = 0

      if (liveCube) {
        if (filters.branch === 'all') {
          const summed = aggregateAggregatorMatrix({
            branchIds: DASHBOARD_BRANCH_CARD_IDS,
            channelKeys: [key],
            cell: (branchId, channelKey) =>
              liveCube.byBranch?.[branchId as Exclude<GlobalBranch, 'all'>]?.channels?.[
                channelKey as AggregatorChannelKey
              ],
            unattributed: (channelKey) =>
              liveCube.unattributed?.channels?.[channelKey as AggregatorChannelKey],
          })
          salesKwd = summed.byPlatform[key]?.netKwd ?? 0
          orders = summed.byPlatform[key]?.orders ?? 0
        } else {
          const cell = liveCube.byBranch?.[filters.branch]?.channels?.[key]
          const parsed = readChannelCell(cell)
          salesKwd = parsed.salesKwd
          orders = parsed.orders
        }
      } else if (activeBucket) {
        const cell =
          filters.branch !== 'all'
            ? activeBucket.byLocation?.[filters.branch]?.uiChannels?.[key]
            : activeBucket.uiChannels?.[key]
        const parsed = readChannelCell(cell)
        salesKwd = parsed.salesKwd
        orders = parsed.orders
      }

      return {
        key,
        color,
        labelAr: getChannelLabel(key, true),
        labelEn: getChannelLabel(key, false),
        salesKwd,
        orders,
        aovKwd:
          salesKwd === null || orders === null
            ? null
            : orders > 0
              ? salesKwd / orders
              : 0,
        sharePct: 0 as number | null,
      }
    })

    if (channelsUnavailable) return rows

    const hasNullSales = rows.some((r) => r.salesKwd === null)
    const totalAgg = hasNullSales
      ? null
      : rows.reduce((s, r) => s + (r.salesKwd as number), 0)
    return rows
      .map((r) => ({
        ...r,
        sharePct:
          totalAgg === null || r.salesKwd === null
            ? null
            : totalAgg > 0
              ? (r.salesKwd / totalAgg) * 100
              : 0,
      }))
      .sort((a, b) => (b.salesKwd ?? Number.NEGATIVE_INFINITY) - (a.salesKwd ?? Number.NEGATIVE_INFINITY))
  }, [activeBucket, channelsUnavailable, filters.branch, liveCube, workspace.noData, workspace.odooConnected])

  const visiblePlatformSummaries = useMemo(
    () =>
      showZeroRows
        ? platformSummaries
        : platformSummaries.filter(
            (p) => channelFilter === p.key || !isZeroDeliveryRow(p.salesKwd, p.orders),
          ),
    [channelFilter, platformSummaries, showZeroRows],
  )

  const idlePlatformLabels = useMemo(
    () =>
      platformSummaries
        .filter((p) => isZeroDeliveryRow(p.salesKwd, p.orders))
        .map((p) => (isAr ? p.labelAr : p.labelEn)),
    [isAr, platformSummaries],
  )

  const directSalesSummary = useMemo((): { salesKwd: number | null; orders: number | null } => {
    if (!workspace.odooConnected || workspace.noData || channelsUnavailable) {
      return { salesKwd: null, orders: null }
    }
    let salesKwd = 0
    let orders = 0
    for (const dKey of DIRECT_CHANNELS) {
      const cell = liveCube
        ? filters.branch !== 'all'
          ? liveCube.byBranch?.[filters.branch]?.channels?.[dKey]
          : liveCube.byChannel?.[dKey]
        : activeBucket
          ? filters.branch !== 'all'
            ? activeBucket.byLocation?.[filters.branch]?.uiChannels?.[dKey]
            : activeBucket.uiChannels?.[dKey]
          : undefined
      const parsed = readChannelCell(cell)
      if (parsed.salesKwd === null || parsed.orders === null) {
        return {
          salesKwd: parsed.salesKwd === null ? null : salesKwd,
          orders: parsed.orders === null ? null : orders,
        }
      }
      salesKwd += parsed.salesKwd
      orders += parsed.orders
    }
    return { salesKwd, orders }
  }, [activeBucket, channelsUnavailable, filters.branch, liveCube, workspace.noData, workspace.odooConnected])

  const totalAggregatorSalesKwd = useMemo<number | null>(() => {
    if (channelsUnavailable || platformSummaries.length === 0) return null
    if (platformSummaries.some((r) => r.salesKwd === null)) return null
    return platformSummaries.reduce((s, r) => s + (r.salesKwd as number), 0)
  }, [channelsUnavailable, platformSummaries])

  const totalAggregatorOrders = useMemo<number | null>(() => {
    if (channelsUnavailable || platformSummaries.length === 0) return null
    if (platformSummaries.some((r) => r.orders === null)) return null
    return platformSummaries.reduce((s, r) => s + (r.orders as number), 0)
  }, [channelsUnavailable, platformSummaries])

  // Branch × Channel Matrix (7 Mapped Branches + Explicit 8th «غير منسوب لفرع»)
  const { matrixRows, hiddenZeroMatrixCount } = useMemo<{
    matrixRows: BranchChannelMatrixRow[]
    hiddenZeroMatrixCount: number
  }>(() => {
    if (!workspace.odooConnected || workspace.noData) {
      return { matrixRows: [], hiddenZeroMatrixCount: 0 }
    }

    const branchList: Array<{
      id: Exclude<GlobalBranch, 'all'> | 'unattributed'
      labelAr: string
      labelEn: string
      isUnattributed: boolean
    }> =
      filters.branch !== 'all'
        ? [
            {
              id: filters.branch,
              labelAr: getBranchLabel(filters.branch, true),
              labelEn: getBranchLabel(filters.branch, false),
              isUnattributed: false,
            },
          ]
        : [
            ...DASHBOARD_BRANCH_CARD_IDS.map((bid) => ({
              id: bid,
              labelAr: getBranchLabel(bid, true),
              labelEn: getBranchLabel(bid, false),
              isUnattributed: false,
            })),
            {
              id: 'unattributed',
              labelAr: UNATTRIBUTED_BRANCH_LABEL_AR,
              labelEn: UNATTRIBUTED_BRANCH_LABEL_EN,
              isUnattributed: true,
            },
          ]

    const allCandidateRows: BranchChannelMatrixRow[] = []
    for (const br of branchList) {
      for (const ch of AGGREGATOR_CHANNELS) {
        if (channelFilter !== 'all' && ch.key !== channelFilter) continue
        if (
          filters.channel !== 'all' &&
          filters.channel !== 'dine-in' &&
          filters.channel !== 'takeaway-direct' &&
          ch.key !== filters.channel
        ) {
          continue
        }

        let salesKwd: number | null = 0
        let orders: number | null = 0
        if (channelsUnavailable) {
          salesKwd = null
          orders = null
        } else if (br.isUnattributed) {
          if (!liveCube) {
            salesKwd = null
            orders = null
          } else {
            const parsed = readChannelCell(liveCube.unattributed?.channels?.[ch.key])
            salesKwd = parsed.salesKwd
            orders = parsed.orders
          }
        } else if (liveCube) {
          const parsed = readChannelCell(
            liveCube.byBranch?.[br.id as Exclude<GlobalBranch, 'all'>]?.channels?.[ch.key],
          )
          salesKwd = parsed.salesKwd
          orders = parsed.orders
        } else if (activeBucket) {
          const locUiChannels =
            activeBucket.byLocation?.[br.id as Exclude<GlobalBranch, 'all'>]?.uiChannels
          if (locUiChannels === null) {
            salesKwd = null
            orders = null
          } else {
            const parsed = readChannelCell(locUiChannels?.[ch.key])
            salesKwd = parsed.salesKwd
            orders = parsed.orders
          }
        }

        // Unattributed 0.000 KWD / 0 orders is never a real branch and stays excluded
        if (br.isUnattributed && isZeroDeliveryRow(salesKwd, orders)) {
          continue
        }

        allCandidateRows.push({
          rowId: `${br.id}|${ch.key}`,
          branchId: br.id,
          branchLabelAr: br.labelAr,
          branchLabelEn: br.labelEn,
          isUnattributed: br.isUnattributed,
          channelKey: ch.key,
          channelLabelAr: getChannelLabel(ch.key, true),
          channelLabelEn: getChannelLabel(ch.key, false),
          salesKwd,
          orders,
          aovKwd:
            salesKwd === null || orders === null ? null : orders > 0 ? salesKwd / orders : 0,
          shareOfAggregatorPct:
            salesKwd === null || totalAggregatorSalesKwd === null
              ? null
              : totalAggregatorSalesKwd > 0
                ? (salesKwd / totalAggregatorSalesKwd) * 100
                : 0,
        })
      }
    }

    const q = searchQuery.trim().toLowerCase()
    const searched = q
      ? allCandidateRows.filter(
          (r) =>
            r.branchLabelAr.toLowerCase().includes(q) ||
            r.branchLabelEn.toLowerCase().includes(q) ||
            r.channelLabelAr.toLowerCase().includes(q) ||
            r.channelLabelEn.toLowerCase().includes(q),
        )
      : allCandidateRows

    const zeroCount = searched.filter((r) => isZeroDeliveryRow(r.salesKwd, r.orders)).length
    const visible = showZeroRows
      ? searched
      : searched.filter((r) => !isZeroDeliveryRow(r.salesKwd, r.orders))

    const sorted = channelsUnavailable
      ? visible
      : [...visible].sort((a, b) => (b.salesKwd ?? 0) - (a.salesKwd ?? 0))

    return { matrixRows: sorted, hiddenZeroMatrixCount: zeroCount }
  }, [
    activeBucket,
    channelFilter,
    channelsUnavailable,
    filters.branch,
    filters.channel,
    liveCube,
    searchQuery,
    showZeroRows,
    totalAggregatorSalesKwd,
    workspace.noData,
    workspace.odooConnected,
  ])

  const donutSlices = useMemo<DonutSliceDatum[]>(() => {
    if (channelsUnavailable) return []
    return platformSummaries
      .filter((p): p is typeof p & { salesKwd: number; orders: number; sharePct: number } =>
        p.salesKwd !== null && p.salesKwd > 0 && p.orders !== null && p.sharePct !== null,
      )
      .map((p) => ({
        id: p.key,
        label: isAr ? p.labelAr : p.labelEn,
        subLabel: isAr
          ? `${f0(p.orders, resolvedLocale)} عدد الدفعات`
          : `${f0(p.orders, resolvedLocale)} Payments`,
        value: p.salesKwd,
        valueFormatted: fmtKwd(p.salesKwd, isAr),
        pctFormatted: f1Pct(p.sharePct, resolvedLocale),
        color: p.color,
      }))
  }, [channelsUnavailable, isAr, platformSummaries, resolvedLocale])

  const showPostedCommissionCol = !maskInternalCosts && !commissionUnposted

  const headerNotes = useMemo(() => {
    const parts: string[] = []
    if (filters.brand !== 'all') {
      parts.push(
        isAr
          ? 'طرق الدفع في أودو 17 (pos.payment) تُسجَّل على مستوى إيصال الفرع لا على مستوى سطر العلامة دون تقسيم افتراضي.'
          : 'Odoo 17 POS payments (pos.payment) are recorded at receipt/branch level rather than brand line level without synthetic brand splits.',
      )
    }
    if (commissionUnposted && !maskInternalCosts) {
      parts.push(
        isAr
          ? 'قيود عمولات المنصات في دفتر الأستاذ تُرحَّل بنهاية الإقفال الشهري ولا تُعرض صفراً في الفترات المفتوحة.'
          : 'Aggregator GL commission entries post at month-end close and are withheld during open windows.',
      )
    }
    return parts.join(' — ')
  }, [commissionUnposted, filters.brand, isAr, maskInternalCosts])

  const kpiCards = useMemo(() => {
    const cards: { key: string; node: React.ReactNode }[] = []

    if (
      totalAggregatorSalesKwd !== null &&
      (!isZeroDeliveryRow(totalAggregatorSalesKwd, totalAggregatorOrders) ||
        (directSalesSummary.salesKwd ?? 0) <= 0.0005)
    ) {
      cards.push({
        key: 'agg-sales',
        node: (
          <article className="ae-kpi-card relative overflow-visible min-w-0 flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
            <p className="min-w-0 truncate text-[13px] font-semibold text-slate-600 dark:text-slate-300">
              {T('Aggregator POS Sales', 'إجمالي مبيعات منصات التوصيل')}
            </p>
            <div
              dir="ltr"
              className="mt-2.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-950 dark:text-white"
            >
              {fmtKwd(totalAggregatorSalesKwd, isAr)}
            </div>
            <p className="mt-1.5 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
              {totalAggregatorOrders === null ? (
                <span data-unavailable="true" title={unavailableTip} aria-label={unavailableTip}>
                  {isAr ? 'غير متاح' : '—'}
                </span>
              ) : isAr ? (
                <>
                  {f0(totalAggregatorOrders, 'ar')} عدد الدفعات • متوسط الدفعة{' '}
                  <span dir="ltr" className="tabular-nums">
                    {fmtKwd(
                      totalAggregatorOrders > 0
                        ? totalAggregatorSalesKwd / totalAggregatorOrders
                        : 0,
                      true,
                    )}
                  </span>
                </>
              ) : (
                <>
                  {f0(totalAggregatorOrders, 'en')} Payments • Avg per payment{' '}
                  <span dir="ltr" className="tabular-nums">
                    {fmtKwd(
                      totalAggregatorOrders > 0
                        ? totalAggregatorSalesKwd / totalAggregatorOrders
                        : 0,
                      false,
                    )}
                  </span>
                </>
              )}
            </p>
            <KpiProvenanceBadge
              odooModel="pos.payment + pos.order"
              dateRange={provenanceRange}
              lastSyncAt={lastSyncIso}
              isStale24h={isStale24h}
              kind="فعلي"
              queryOrFormula="pos.payment.read_group(groupby=['payment_method_id','pos_order_id.config_id']) across aggregator payment methods"
              compact
            />
          </article>
        ),
      })
    }

    if (
      directSalesSummary.salesKwd !== null &&
      !isZeroDeliveryRow(directSalesSummary.salesKwd, directSalesSummary.orders)
    ) {
      cards.push({
        key: 'direct-sales',
        node: (
          <article className="ae-kpi-card relative overflow-visible min-w-0 flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
            <p className="min-w-0 truncate text-[13px] font-semibold text-slate-600 dark:text-slate-300">
              {T('Direct Sales (Dine-in & Takeaway)', 'المبيعات المباشرة (الصالة والسفري)')}
            </p>
            <div
              dir="ltr"
              className="mt-2.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300"
            >
              {fmtKwd(directSalesSummary.salesKwd, isAr)}
            </div>
            <p className="mt-1.5 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
              {directSalesSummary.orders === null ? (
                <span data-unavailable="true" title={unavailableTip} aria-label={unavailableTip}>
                  {isAr ? 'غير متاح' : '—'}
                </span>
              ) : isAr ? (
                `${f0(directSalesSummary.orders, 'ar')} طلب مباشر بدون عمولة تطبيقات`
              ) : (
                `${f0(directSalesSummary.orders, 'en')} direct orders without aggregator commission`
              )}
            </p>
            <KpiProvenanceBadge
              odooModel="pos.payment + pos.order"
              dateRange={provenanceRange}
              lastSyncAt={lastSyncIso}
              isStale24h={isStale24h}
              kind="فعلي"
              queryOrFormula="pos.payment.read_group(direct cash/KNET/Visa/Mastercard payment methods)"
              compact
            />
          </article>
        ),
      })
    }

    if (!maskInternalCosts && !commissionUnposted && typeof gl.deliveryCommissionsKwd === 'number') {
      cards.push({
        key: 'posted-commissions',
        node: (
          <article className="ae-kpi-card relative overflow-visible min-w-0 flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
            <p className="min-w-0 truncate text-[13px] font-semibold text-slate-600 dark:text-slate-300">
              {T('Posted Aggregator Commissions (GL)', 'عمولات التطبيقات المرحّلة في الدفتر')}
            </p>
            <div
              dir="ltr"
              className="mt-2.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-rose-700 dark:text-rose-300"
            >
              {fmtKwd(gl.deliveryCommissionsKwd, isAr)}
            </div>
            <p className="mt-1.5 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
              {totalAggregatorSalesKwd !== null && totalAggregatorSalesKwd > 0
                ? isAr
                  ? `${f1Pct((gl.deliveryCommissionsKwd / totalAggregatorSalesKwd) * 100, 'ar')} من مبيعات تطبيقات التوصيل`
                  : `${f1Pct((gl.deliveryCommissionsKwd / totalAggregatorSalesKwd) * 100, 'en')} of aggregator POS sales`
                : null}
              {gl.deliveryCommPct !== null
                ? isAr
                  ? ` · ${f1Pct(gl.deliveryCommPct, 'ar')} من إيراد دفتر الأستاذ`
                  : ` · ${f1Pct(gl.deliveryCommPct, 'en')} of posted GL revenue`
                : null}
            </p>
            {typeof gl.platformSubscriptionKwd === 'number' ? (
              <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {isAr ? 'اشتراك المنصات' : 'Platform subscription'}: {fmtKwd(gl.platformSubscriptionKwd, isAr)}
              </p>
            ) : null}
            {typeof gl.thirdPartyDeliveryKwd === 'number' ? (
              <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {isAr ? 'توصيل طرف ثالث' : 'Third-party delivery'}: {fmtKwd(gl.thirdPartyDeliveryKwd, isAr)}
              </p>
            ) : null}
            {gl.commissionAccounts.length > 0 ? (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300">
                  {isAr ? 'حسابات العمولة' : 'Commission accounts'}
                </summary>
                <ul className="mt-1 space-y-0.5 tabular-nums">
                  {gl.commissionAccounts.map((account) => (
                    <li key={account.code} className="flex items-center justify-between gap-2 tabular-nums">
                      <span className="min-w-0 truncate">{account.code} {account.name}</span>
                      <span dir="ltr" className="shrink-0 whitespace-nowrap">{fmtKwd(account.amountKwd, isAr)}</span>
                    </li>
                  ))}
                </ul>
              </details>
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
          </article>
        ),
      })
    }

    const arHeadlineKwd = receivablesHeadline.openDebitsKwd ?? receivablesHeadline.netKwd
    if (!maskInternalCosts && !workspace.receivables.unavailable && arHeadlineKwd !== null) {
      cards.push({
        key: 'open-receivables',
        node: (
          <article className="ae-kpi-card relative overflow-visible min-w-0 flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                {T('Open Unreconciled Receivables', 'الذمم المدينة المفتوحة للمنصات والمقاصة')}
              </p>
              <Wallet className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
            </div>
            <div
              dir="ltr"
              className="mt-2.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-950 dark:text-white"
            >
              {fmtKwd(arHeadlineKwd, isAr)}
            </div>
            <p className="mt-1.5 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
              {isAr ? (
                <>
                  دفعات/مقاصة غير مطابقة:{' '}
                  <span dir="ltr">
                    {receivablesHeadline.unappliedCreditsKwd === null
                      ? '—'
                      : fmtKwd(receivablesHeadline.unappliedCreditsKwd, true)}
                  </span>
                  {' · '}الصافي:{' '}
                  <span dir="ltr">
                    {receivablesHeadline.netKwd === null
                      ? '—'
                      : fmtKwd(receivablesHeadline.netKwd, true)}
                  </span>
                </>
              ) : (
                <>
                  Unapplied payments/clearing:{' '}
                  <span dir="ltr">
                    {receivablesHeadline.unappliedCreditsKwd === null
                      ? '—'
                      : fmtKwd(receivablesHeadline.unappliedCreditsKwd, false)}
                  </span>
                  {' · '}Net:{' '}
                  <span dir="ltr">
                    {receivablesHeadline.netKwd === null
                      ? '—'
                      : fmtKwd(receivablesHeadline.netKwd, false)}
                  </span>
                </>
              )}
            </p>
            {receivablesHeadline.lines !== null ? (
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                {isAr
                  ? `${f0(receivablesHeadline.lines, 'ar')} قيد غير مسوّى في دفتر الذمم`
                  : `${f0(receivablesHeadline.lines, 'en')} unreconciled receivable lines`}
              </p>
            ) : null}
            <KpiProvenanceBadge
              odooModel="account.move.line"
              dateRange={receivablesDateRange}
              lastSyncAt={lastSyncIso}
              isStale24h={isStale24h}
              kind="فعلي"
              queryOrFormula="account.move.line(account_type='asset_receivable', parent_state='posted', reconciled=false)"
              compact
            />
          </article>
        ),
      })
    }

    return cards
  }, [
    T,
    commissionUnposted,
    directSalesSummary.orders,
    directSalesSummary.salesKwd,
    gl.commissionAccounts,
    gl.deliveryCommPct,
    gl.deliveryCommissionsKwd,
    gl.from,
    gl.platformSubscriptionKwd,
    gl.thirdPartyDeliveryKwd,
    gl.to,
    isAr,
    isStale24h,
    lastSyncIso,
    maskInternalCosts,
    provenanceRange,
    receivablesDateRange,
    receivablesHeadline.lines,
    receivablesHeadline.netKwd,
    receivablesHeadline.openDebitsKwd,
    receivablesHeadline.unappliedCreditsKwd,
    totalAggregatorOrders,
    totalAggregatorSalesKwd,
    unavailableTip,
    workspace.receivables.unavailable,
  ])

  const isInitialLoading = liveSummary === null
  const isDisconnectedOrEmpty =
    liveSummary !== null && (!workspace.odooConnected || workspace.noData)

  const platformGridCols =
    visiblePlatformSummaries.length <= 1
      ? 'grid-cols-1'
      : visiblePlatformSummaries.length === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full min-w-0 space-y-5 pb-16">
      {/* Header */}
      <div className="ae-bento-card relative overflow-visible flex flex-col gap-3 rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.04] lg:flex-row lg:items-center lg:justify-between dark:bg-[#101815] dark:ring-emerald-400/[0.09]">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              {T('Delivery Platforms & Commissions Radar', 'رادار منصات التوصيل والعمولات')}
            </h2>
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>pos.payment + account.move.line</span>
            </span>
            {headerNotes ? (
              <CompactInfoTooltip
                text={headerNotes}
                label={T('Accounting & POS Scope Note', 'ملاحظة نطاق البيانات والمحاسبة')}
                isAr={isAr}
                dataScopeNote={filters.brand !== 'all'}
                dataCommissionNote={commissionUnposted}
              />
            ) : null}
          </div>
          <p className="text-[13px] font-medium text-slate-600 dark:text-[#8FA39B]">
            {isAr
              ? `مبيعات ودفعات تطبيقات التوصيل الفعلية من طرق دفع نقاط البيع في أودو 17 (${periodWindow.fromIso} → ${periodWindow.toInclusiveIso}) بدون أي تقسيم افتراضي.`
              : `Actual aggregator sales and payments from Odoo 17 POS payment methods (${periodWindow.fromIso} → ${periodWindow.toInclusiveIso}) with zero synthetic splits.`}
          </p>
        </div>
      </div>

      {isInitialLoading ? (
        <StateBlock state="loading" locale={resolvedLocale} skeletonRows={4} />
      ) : isDisconnectedOrEmpty ? (
        <div data-odoo-no-data="true">
          <StateBlock
            state="empty"
            locale={resolvedLocale}
            title={isAr ? NO_ODOO_DATA_AR : NO_ODOO_DATA_EN}
            description={
              isAr
                ? (workspace.noDataMessageAr ?? NO_ODOO_DATA_AR)
                : `${NO_ODOO_DATA_EN} (${periodWindow.fromIso} → ${periodWindow.toInclusiveIso})`
            }
          />
        </div>
      ) : (
        <>
          {cubeError ? (
            <StateBlock
              state="error"
              compact
              locale={resolvedLocale}
              onRetry={() => setRetryTick((n) => n + 1)}
            />
          ) : null}

          {/* Dynamic KPI Cards — Zero Empty or Unposted Clutter Slots */}
          {kpiCards.length > 0 ? (
            <div className={`grid gap-4 ${resolveRadarKpiGridCols(kpiCards.length)}`}>
              {kpiCards.map((item) => (
                <React.Fragment key={item.key}>{item.node}</React.Fragment>
              ))}
            </div>
          ) : null}

          {/* Platform Breakdown Cards + Donut */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="ae-bento-card relative overflow-visible rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:ring-emerald-400/[0.09] xl:col-span-7">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                    {T('Sales by Delivery Platform', 'مبيعات ودفعات كل منصة توصيل')}
                  </h2>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {loadingCube
                      ? T('Refreshing period cube from Odoo 17...', 'جاري تحديث مكعب الفترة من أودو 17...')
                      : T('Actual POS payment totals per active platform', 'إجماليات طرق الدفع الفعلية للمنصات النشطة')}
                  </p>
                </div>
                <KpiProvenanceBadge
                  odooModel="pos.payment"
                  dateRange={provenanceRange}
                  lastSyncAt={lastSyncIso}
                  isStale24h={isStale24h}
                  kind="فعلي"
                  queryOrFormula="pos.payment.read_group(groupby=['payment_method_id'])"
                  compact
                />
              </div>

              {visiblePlatformSummaries.length === 0 ? (
                <StateBlock
                  state="empty"
                  compact
                  locale={resolvedLocale}
                  title={T('No active delivery platform payments in this window', 'لا توجد دفعات منصات توصيل مسجّلة في هذه الفترة')}
                />
              ) : (
                <div className={`grid gap-3 ${platformGridCols}`}>
                  {visiblePlatformSummaries.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={channelFilter === p.key}
                      onClick={() =>
                        setChannelFilter((prev) => (prev === p.key ? 'all' : p.key))
                      }
                      className={`flex cursor-pointer flex-col justify-between rounded-2xl p-3.5 text-start ring-1 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                        channelFilter === p.key
                          ? 'bg-emerald-50 ring-2 ring-emerald-600 dark:bg-emerald-950/40 dark:ring-emerald-400'
                          : 'bg-[#F6F7F8] ring-slate-900/[0.05] hover:bg-slate-100/80 dark:bg-[#141F1B] dark:ring-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex min-w-0 items-center gap-2 text-sm font-bold text-slate-950 dark:text-white">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: p.color }}
                            aria-hidden
                          />
                          <span className="truncate">{isAr ? p.labelAr : p.labelEn}</span>
                        </span>
                        <span
                          dir="ltr"
                          className="shrink-0 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-xs font-bold tabular-nums text-slate-700 dark:bg-white/10 dark:text-slate-200"
                        >
                          {p.sharePct === null ? '—' : f1Pct(p.sharePct, resolvedLocale)}
                        </span>
                      </div>

                      <div
                        dir="ltr"
                        data-unavailable={p.salesKwd === null ? 'true' : undefined}
                        title={p.salesKwd === null ? unavailableTip : undefined}
                        aria-label={p.salesKwd === null ? unavailableTip : undefined}
                        className="mt-3 text-xl font-extrabold tabular-nums text-slate-950 dark:text-white"
                      >
                        {fmtKwd(p.salesKwd, isAr)}
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                        <span className="min-w-0 truncate tabular-nums">
                          {p.orders === null ? (
                            <span data-unavailable="true" title={unavailableTip}>
                              {isAr ? 'غير متاح' : '—'}
                            </span>
                          ) : isAr ? (
                            `${f0(p.orders, 'ar')} عدد الدفعات`
                          ) : (
                            `${f0(p.orders, 'en')} Payments`
                          )}
                        </span>
                        <span dir="ltr" className="shrink-0 whitespace-nowrap tabular-nums">
                          {p.orders !== null && p.orders > 0 && p.aovKwd !== null
                            ? fmtKwd(p.aovKwd, isAr)
                            : '—'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!showZeroRows && idlePlatformLabels.length > 0 ? (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  {isAr ? 'بلا مبيعات مسجّلة في هذه الفترة: ' : 'No recorded sales in this window: '}
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {idlePlatformLabels.join(isAr ? '، ' : ', ')}
                  </span>
                </p>
              ) : null}
            </div>

            <div className="xl:col-span-5">
              <ChartCard
                title={T('Aggregator Mix Share', 'توزيع حصص منصات التوصيل')}
                subtitle={T('Share of total aggregator POS sales', 'نسبة كل منصة من إجمالي مبيعات التطبيقات')}
                period={`${periodWindow.fromIso} → ${periodWindow.toInclusiveIso}`}
                unit={isAr ? 'د.ك (KWD)' : 'KWD'}
                locale={resolvedLocale}
                showGridBackdrop={false}
                state={
                  channelsUnavailable
                    ? 'unavailable'
                    : donutSlices.length === 0 || totalAggregatorOrders === null
                      ? 'empty'
                      : 'ready'
                }
                stateTitle={
                  channelsUnavailable
                    ? isAr
                      ? 'غير متاح'
                      : 'Unavailable'
                    : isAr
                      ? NO_ODOO_DATA_AR
                      : NO_ODOO_DATA_EN
                }
              >
                <InteractiveDonutChart
                  slices={donutSlices}
                  centerValue={fmtKwd(totalAggregatorSalesKwd, isAr)}
                  centerSubValue={
                    totalAggregatorOrders === null
                      ? undefined
                      : isAr
                        ? `${f0(totalAggregatorOrders, 'ar')} عدد الدفعات`
                        : `${f0(totalAggregatorOrders, 'en')} Payments`
                  }
                  centerLabel={T('Aggregators', 'منصات التوصيل')}
                  isAr={isAr}
                  legendLayout="beside"
                />
              </ChartCard>
            </div>
          </div>

          {/* Branch × Platform Real Odoo Table (Zero Rows Hidden by Default + Toggle) */}
          <section className="ae-bento-card relative overflow-visible rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:ring-emerald-400/[0.09]">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                    {T(
                      'Branch × Platform Actual POS Matrix',
                      'مصفوفة الفروع × منصات التوصيل الفعلية',
                    )}
                  </h2>
                  <span
                    dir="ltr"
                    data-matrix-date-range="true"
                    className="shrink-0 whitespace-nowrap rounded-lg bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-slate-700 dark:bg-white/10 dark:text-slate-200"
                  >
                    {`${matrixRange.from} → ${matrixRange.to}`}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'قراءات pos.payment الفعلية لكل فرع وقناة توصيل؛ الصفوف الصفرية مخفية افتراضياً.'
                    : 'Actual pos.payment figures per branch and delivery channel; zero rows hidden by default.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={showZeroRows}
                  data-show-zero-rows-toggle="true"
                  onClick={() => setShowZeroRows((prev) => !prev)}
                  className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                    showZeroRows
                      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-400/30'
                      : 'bg-slate-100 text-slate-700 ring-1 ring-slate-300/70 hover:bg-slate-200/70 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/15 dark:hover:bg-white/10'
                  }`}
                >
                  {showZeroRows ? (
                    <Eye className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                  )}
                  <span>{T('Show zero rows', 'إظهار الصفوف الصفرية')}</span>
                  {!showZeroRows && hiddenZeroMatrixCount > 0 ? (
                    <span
                      dir="ltr"
                      className="rounded-full bg-white px-1.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 dark:bg-white/10 dark:text-slate-200"
                    >
                      {f0(hiddenZeroMatrixCount, resolvedLocale)}
                    </span>
                  ) : null}
                </button>

                {channelFilter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => setChannelFilter('all')}
                    className="shrink-0 cursor-pointer whitespace-nowrap rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-emerald-950/60 dark:text-emerald-300"
                  >
                    {T('Show All Platforms', 'عرض كل المنصات')}
                  </button>
                ) : null}

                <div className="relative">
                  <Search
                    className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    aria-label={T('Filter branch or platform', 'بحث بالفرع أو المنصة')}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={T('Filter branch or platform...', 'بحث بالفرع أو المنصة...')}
                    className="h-9 rounded-xl border border-slate-200 bg-[#F6F7F8] ps-9 pe-3 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-[#141F1B] dark:text-white"
                  />
                </div>
              </div>
            </div>

            {matrixRows.length === 0 ? (
              <StateBlock
                state="empty"
                compact
                locale={resolvedLocale}
                title={
                  isAr
                    ? 'لا توجد صفوف نشطة مطابقة للتصفية الحالية'
                    : 'No active rows match the current filter'
                }
                description={
                  !showZeroRows && hiddenZeroMatrixCount > 0
                    ? isAr
                      ? 'جميع الصفوف الصفرية مخفية افتراضياً. فعّل خيار «إظهار الصفوف الصفرية» أعلاه لعرضها.'
                      : 'All zero-value rows are hidden by default. Enable "Show zero rows" above to inspect them.'
                    : isAr
                      ? 'جرّب مسح نص البحث أو اختيار قناة توصيل مختلفة.'
                      : 'Try clearing the search query or selecting a different channel filter.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-white/10 dark:text-slate-400">
                      <th className="whitespace-nowrap px-3 py-2.5 text-start">{T('Branch', 'الفرع')}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-start">{T('Platform', 'منصة التوصيل')}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-end">{T('POS Sales (KWD)', 'المبيعات (د.ك)')}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-end">{T('Payments', 'عدد الدفعات')}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-end">{T('Avg per Payout', 'متوسط الدفعة')}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-end">{T('Share of Delivery', 'حصة التوصيل')}</th>
                      {showPostedCommissionCol ? (
                        <th className="whitespace-nowrap px-3 py-2.5 text-end">{T('Posted Commission', 'العمولة المرحّلة')}</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-white/[0.06]">
                    {matrixRows.map((row) => (
                      <tr
                        key={row.rowId}
                        data-matrix-row={row.rowId}
                        className={
                          row.isUnattributed
                            ? 'bg-slate-50/80 dark:bg-white/[0.03]'
                            : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.03]'
                        }
                      >
                        <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <Building2
                              className={`h-3.5 w-3.5 shrink-0 ${
                                row.isUnattributed ? 'text-slate-500' : 'text-emerald-600'
                              }`}
                              aria-hidden
                            />
                            <span className="truncate">{isAr ? row.branchLabelAr : row.branchLabelEn}</span>
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-200">
                          {isAr ? row.channelLabelAr : row.channelLabelEn}
                        </td>
                        <td
                          dir="ltr"
                          data-unavailable={row.salesKwd === null ? 'true' : undefined}
                          title={row.salesKwd === null ? unavailableTip : undefined}
                          className="whitespace-nowrap px-3 py-2.5 text-end font-extrabold tabular-nums text-slate-950 dark:text-white"
                        >
                          {fmtKwd(row.salesKwd, isAr)}
                        </td>
                        <td
                          dir="ltr"
                          data-unavailable={row.orders === null ? 'true' : undefined}
                          title={row.orders === null ? unavailableTip : undefined}
                          className="whitespace-nowrap px-3 py-2.5 text-end font-semibold tabular-nums text-slate-700 dark:text-slate-300"
                        >
                          {row.orders === null ? '—' : f0(row.orders, resolvedLocale)}
                        </td>
                        <td
                          dir="ltr"
                          data-unavailable={row.aovKwd === null ? 'true' : undefined}
                          title={row.aovKwd === null ? unavailableTip : undefined}
                          className="whitespace-nowrap px-3 py-2.5 text-end font-medium tabular-nums text-slate-600 dark:text-slate-400"
                        >
                          {row.orders !== null && row.orders > 0 && row.aovKwd !== null
                            ? fmtKwd(row.aovKwd, isAr)
                            : '—'}
                        </td>
                        <td
                          dir="ltr"
                          data-unavailable={row.shareOfAggregatorPct === null ? 'true' : undefined}
                          title={row.shareOfAggregatorPct === null ? unavailableTip : undefined}
                          className="whitespace-nowrap px-3 py-2.5 text-end font-semibold tabular-nums text-slate-700 dark:text-slate-300"
                        >
                          {row.shareOfAggregatorPct === null
                            ? '—'
                            : f1Pct(row.shareOfAggregatorPct, resolvedLocale)}
                        </td>
                        {showPostedCommissionCol ? (
                          <td className="whitespace-nowrap px-3 py-2.5 text-end">
                            <span className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-500 dark:text-slate-400">
                              {T('Posted at company GL level', 'مرحّلة بإجمالي الدفتر العام')}
                            </span>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
