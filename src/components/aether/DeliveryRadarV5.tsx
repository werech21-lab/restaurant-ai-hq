'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  FileText,
  Search,
  Truck,
  Wallet,
} from 'lucide-react'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  APPROVED_BRANCH_IDS,
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
import { InteractiveDonutChart, type DonutSliceDatum } from '@/components/aether/InteractiveHoverCharts'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
import { OdooPartialWarningBanner } from '@/components/erp/OdooPartialWarningBanner'
import { ChartCard, StateBlock } from '@/components/ui'
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
const UNPOSTED_COMMISSION_AR = 'غير مُرحَّل بعد'
const UNPOSTED_COMMISSION_EN = 'Not posted yet'
const GL_INCOMPLETE_AR = 'قيود غير مكتملة لهذه الفترة'
const GL_INCOMPLETE_EN = 'Incomplete GL entries for this period'

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
 * - يحذف تماماً أي تقسيم ثابت للعلامات من `ODOO.cube` وأي إيصالات ثابتة من `delivery-receipts-proof.json`.
 * - يعرض «غير مُرحَّل بعد» (لا صفراً!) على عمولات التطبيقات متى كانت غير مرحّلة في `account.move.line`.
 */
export function DeliveryRadarV5() {
  const { isAr, T } = useLang()
  const resolvedLocale: FormatLocale = isAr ? 'ar' : 'en'
  const unavailableTip = getUnavailableTooltip(resolvedLocale)
  const { filters, workspace, liveSummary, sessionRole } = useGlobalFilter()
  const maskInternalCosts = shouldMaskInternalCostsForRole(sessionRole)

  const [channelFilter, setChannelFilter] = useState<'all' | AggregatorChannelKey>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [liveCube, setLiveCube] = useState<OdooPeriodCube | null>(null)
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
      (activeBucket.uiChannels === null ||
        activeBucket.totals.restaurantNetKwd === null ||
        (filters.branch !== 'all' && activeBucket.byLocation?.[filters.branch]?.uiChannels === null)),
  )

  // Channel Totals (6 Aggregator Platforms + Direct Channels) directly from Odoo pos.payment
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
        const cell =
          filters.branch !== 'all'
            ? liveCube.byBranch?.[filters.branch]?.channels?.[key]
            : liveCube.byChannel?.[key]
        const parsed = readChannelCell(cell)
        salesKwd = parsed.salesKwd
        orders = parsed.orders
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
  const matrixRows = useMemo<BranchChannelMatrixRow[]>(() => {
    if (!workspace.odooConnected || workspace.noData) return []

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
            ...APPROVED_BRANCH_IDS.map((bid) => ({
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

    const out: BranchChannelMatrixRow[] = []
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

        out.push({
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
    const filtered = q
      ? out.filter(
          (r) =>
            r.branchLabelAr.toLowerCase().includes(q) ||
            r.branchLabelEn.toLowerCase().includes(q) ||
            r.channelLabelAr.toLowerCase().includes(q) ||
            r.channelLabelEn.toLowerCase().includes(q),
        )
      : out

    return channelsUnavailable ? filtered : filtered.sort((a, b) => (b.salesKwd ?? 0) - (a.salesKwd ?? 0))
  }, [
    activeBucket,
    channelFilter,
    channelsUnavailable,
    filters.branch,
    filters.channel,
    liveCube,
    searchQuery,
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
          ? `${f0(p.orders, resolvedLocale)} طلب`
          : `${f0(p.orders, resolvedLocale)} orders`,
        value: p.salesKwd,
        valueFormatted: fmtKwd(p.salesKwd, isAr),
        pctFormatted: f1Pct(p.sharePct, resolvedLocale),
        color: p.color,
      }))
  }, [channelsUnavailable, isAr, platformSummaries, resolvedLocale])

  const isInitialLoading = liveSummary === null
  const isDisconnectedOrEmpty =
    liveSummary !== null && (!workspace.odooConnected || workspace.noData)

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full space-y-5 pb-16">
      {/* Header */}
      <div className="ae-bento-card flex flex-col gap-3 rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.04] lg:flex-row lg:items-center lg:justify-between dark:bg-[#101815] dark:ring-emerald-400/[0.09]">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              {T('Delivery Platforms & Commissions Radar', 'رادار منصات التوصيل والعمولات')}
            </h2>
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Truck className="h-3.5 w-3.5" aria-hidden />
              <span>pos.payment + account.move.line</span>
            </span>
          </div>
          <p className="text-[13px] font-medium text-slate-600 dark:text-[#8FA39B]">
            {isAr
              ? `مبيعات وطلبات تطبيقات التوصيل الفعلية من طرق دفع نقاط البيع في أودو 17 (${periodWindow.fromIso} → ${periodWindow.toInclusiveIso}) بدون أي تقسيم افتراضي.`
              : `Actual aggregator sales & orders from Odoo 17 POS payment methods (${periodWindow.fromIso} → ${periodWindow.toInclusiveIso}) with zero synthetic splits.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Disabled Official Circular Button until real live Odoo governance breaches with admin thresholds exist */}
          <button
            type="button"
            disabled
            title={
              isAr
                ? 'معطّل حتى تتوفر تنبيهات مبنية فعلياً من استعلامات Odoo مع سقوف يحفظها الأدمن'
                : 'Disabled until real Odoo alerts with admin-saved server thresholds exist'
            }
            className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-xl bg-slate-100 px-4 text-xs font-bold text-slate-400 opacity-65 ring-1 ring-slate-900/10 dark:bg-white/[0.05] dark:text-slate-500 dark:ring-white/10"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden />
            <span>{T('Print / Export Official Circular', 'طباعة / تصدير تعميم رسمي')}</span>
          </button>
        </div>
      </div>

      <OdooPartialWarningBanner summary={liveSummary} isAr={isAr} />

      {filters.brand !== 'all' ? (
        <div
          role="note"
          className="rounded-2xl border border-amber-300/70 bg-amber-50/80 px-4 py-3 text-xs font-semibold text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200"
        >
          {isAr
            ? 'ملاحظة مصدر البيانات: طرق الدفع في أودو 17 (pos.payment) تُسجَّل على مستوى إيصال نقطة البيع والفرع لا على مستوى سطر العلامة؛ لذا تعكس الجداول أدناه إجمالي مبيعات القنوات الفعلية للفرع دون تقسيم نسبي مخترع.'
            : 'Source note: Odoo 17 POS payments (pos.payment) are recorded at receipt/branch level rather than brand line level; tables below reflect actual branch channel receipts without synthetic brand splitting.'}
        </div>
      ) : null}

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

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* KPI 1: Aggregator Gross POS Sales */}
            <article className="ae-kpi-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
              <p className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                {T('Aggregator POS Sales', 'إجمالي مبيعات منصات التوصيل')}
              </p>
              <div
                dir="ltr"
                data-unavailable={totalAggregatorSalesKwd === null ? 'true' : undefined}
                title={totalAggregatorSalesKwd === null ? unavailableTip : undefined}
                aria-label={totalAggregatorSalesKwd === null ? unavailableTip : undefined}
                className="mt-2.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-950 dark:text-white"
              >
                {fmtKwd(totalAggregatorSalesKwd, isAr)}
              </div>
              <p className="mt-1.5 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                {totalAggregatorOrders === null || totalAggregatorSalesKwd === null ? (
                  <span data-unavailable="true" title={unavailableTip} aria-label={unavailableTip}>
                    {isAr ? 'غير متاح' : '—'}
                  </span>
                ) : isAr ? (
                  <>
                    {f0(totalAggregatorOrders, 'ar')} طلب • متوسط{' '}
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
                    {f0(totalAggregatorOrders, 'en')} orders • AOV{' '}
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

            {/* KPI 2: Direct Dine-in & Takeaway Sales (0% Platform Fee) */}
            <article className="ae-kpi-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
              <p className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                {T('Direct Sales (Dine-in & Takeaway)', 'المبيعات المباشرة (الصالة والسفري)')}
              </p>
              <div
                dir="ltr"
                data-unavailable={directSalesSummary.salesKwd === null ? 'true' : undefined}
                title={directSalesSummary.salesKwd === null ? unavailableTip : undefined}
                aria-label={directSalesSummary.salesKwd === null ? unavailableTip : undefined}
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

            {/* KPI 3: Posted Aggregator Commissions in GL («غير مُرحَّل بعد» when unposted — NEVER 0!) */}
            <article className="ae-kpi-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
              <p className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                {T('Posted Aggregator Commissions (GL)', 'عمولات التطبيقات المرحّلة في الدفتر')}
              </p>

              {maskInternalCosts ? (
                <div className="mt-2.5 text-base font-bold text-slate-700 dark:text-slate-200">
                  {T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')}
                </div>
              ) : commissionUnposted ? (
                <div className="mt-2.5 space-y-1.5">
                  <span
                    data-commission-unposted="true"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-1.5 text-base font-extrabold text-amber-950 ring-1 ring-amber-500/30 dark:bg-amber-950/60 dark:text-amber-200"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                    <span>{isAr ? UNPOSTED_COMMISSION_AR : UNPOSTED_COMMISSION_EN}</span>
                  </span>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {isAr
                      ? 'قيود عمولات المنصات لم تُرحَّل بعد لهذه الفترة في دفتر الأستاذ العام (لا تُعرض صفراً).'
                      : 'Aggregator commission entries are not posted in Odoo GL for this window yet (never displayed as zero).'}
                  </p>
                </div>
              ) : (
                <>
                  <div
                    dir="ltr"
                    className="mt-2.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-rose-700 dark:text-rose-300"
                  >
                    {fmtKwd(gl.deliveryCommissionsKwd, isAr)}
                  </div>
                  <p className="mt-1.5 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                    {gl.deliveryCommPct !== null
                      ? isAr
                        ? `${f1Pct(gl.deliveryCommPct, 'ar')} من إجمالي إيراد الدفتر المرحّل`
                        : `${f1Pct(gl.deliveryCommPct, 'en')} of posted GL revenue`
                      : isAr
                        ? GL_INCOMPLETE_AR
                        : GL_INCOMPLETE_EN}
                  </p>
                </>
              )}

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

            {/* KPI 4: Open Receivables on Aggregators & POS Clearing */}
            <article className="ae-kpi-card flex flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                  {T('Open Unreconciled Receivables', 'الذمم المدينة المفتوحة للمنصات والمقاصة')}
                </p>
                <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
              </div>

              {maskInternalCosts ? (
                <div className="mt-2.5 text-base font-bold text-slate-700 dark:text-slate-200">
                  {T('Restricted to Finance/GM', 'محصور بالمالية والمدير العام')}
                </div>
              ) : (
                <>
                  <div
                    dir="ltr"
                    data-unavailable={workspace.receivables.unavailable ? 'true' : undefined}
                    title={workspace.receivables.unavailable ? unavailableTip : undefined}
                    aria-label={workspace.receivables.unavailable ? unavailableTip : undefined}
                    className="mt-2.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-amber-700 dark:text-amber-300"
                  >
                    {workspace.receivables.unavailable
                      ? isAr
                        ? 'غير متاح'
                        : '—'
                      : fmtKwd(workspace.receivables.openReceivableKwd, isAr)}
                  </div>
                  <p className="mt-1.5 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                    {workspace.receivables.unavailable ? (
                      <span data-unavailable="true" title={unavailableTip} aria-label={unavailableTip}>
                        {isAr ? 'غير متاح' : '—'}
                      </span>
                    ) : isAr ? (
                      `${f0(workspace.receivables.unreconciledLineCount, 'ar')} قيد غير مسوّى في دفتر الذمم`
                    ) : (
                      `${f0(workspace.receivables.unreconciledLineCount, 'en')} unreconciled receivable lines`
                    )}
                  </p>
                </>
              )}

              <KpiProvenanceBadge
                odooModel="account.move.line"
                dateRange={{
                  from: workspace.receivables.fromDate,
                  to: workspace.receivables.toDate,
                }}
                lastSyncAt={lastSyncIso}
                isStale24h={isStale24h}
                kind="فعلي"
                queryOrFormula="account.move.line(account_type='asset_receivable', parent_state='posted', reconciled=false)"
                compact
              />
            </article>
          </div>

          {/* Platform Breakdown Cards + Donut */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="ae-bento-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:ring-emerald-400/[0.09] xl:col-span-7">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                    {T('Sales by Delivery Platform', 'مبيعات وطلبات كل منصة توصيل')}
                  </h2>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {loadingCube
                      ? T('Refreshing period cube from Odoo 17...', 'جاري تحديث مكعب الفترة من أودو 17...')
                      : T('Actual POS payment totals per platform', 'إجماليات طرق الدفع الفعلية لكل منصة')}
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {platformSummaries.map((p) => (
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
                      <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: p.color }}
                          aria-hidden
                        />
                        {isAr ? p.labelAr : p.labelEn}
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
                      <span className="tabular-nums">
                        {p.orders === null ? (
                          <span data-unavailable="true" title={unavailableTip}>
                            {isAr ? 'غير متاح' : '—'}
                          </span>
                        ) : isAr ? (
                          `${f0(p.orders, 'ar')} طلب`
                        ) : (
                          `${f0(p.orders, 'en')} orders`
                        )}
                      </span>
                      <span dir="ltr" className="tabular-nums">
                        {p.orders !== null && p.orders > 0 && p.aovKwd !== null
                          ? fmtKwd(p.aovKwd, isAr)
                          : '—'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
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
                        ? `${f0(totalAggregatorOrders, 'ar')} طلب`
                        : `${f0(totalAggregatorOrders, 'en')} orders`
                  }
                  centerLabel={T('Aggregators', 'منصات التوصيل')}
                  isAr={isAr}
                  legendLayout="beside"
                />
              </ChartCard>
            </div>
          </div>

          {/* Branch × Platform Real Odoo Table (7 Branches + 8th «غير منسوب لفرع») */}
          <section className="ae-bento-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#101815] dark:ring-emerald-400/[0.09]">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                  {T(
                    'Branch × Platform Actual POS Matrix (7 Branches + Unattributed)',
                    'مصفوفة الفروع × منصات التوصيل الفعلية (7 فروع + غير منسوب لفرع)',
                  )}
                </h2>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'قراءات pos.payment الفعلية لكل فرع وقناة بدون تقسيم ODOO.cube أو إيصالات ثابتة.'
                    : 'Actual pos.payment figures per branch and channel with zero static cube splits or hardcoded receipts.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {channelFilter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => setChannelFilter('all')}
                    className="cursor-pointer rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-emerald-950/60 dark:text-emerald-300"
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
                    ? 'لا توجد صفوف مطابقة للتصفية الحالية'
                    : 'No rows match the active filter'
                }
                description={
                  isAr
                    ? 'جرّب مسح نص البحث أو اختيار قناة توصيل مختلفة.'
                    : 'Try clearing the search query or selecting a different channel filter.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-white/10 dark:text-slate-400">
                      <th className="py-2.5 text-start">{T('Branch', 'الفرع')}</th>
                      <th className="py-2.5 text-start">{T('Platform', 'منصة التوصيل')}</th>
                      <th className="py-2.5 text-end">{T('POS Sales (KWD)', 'المبيعات (د.ك)')}</th>
                      <th className="py-2.5 text-end">{T('Orders', 'الطلبات')}</th>
                      <th className="py-2.5 text-end">{T('Avg Basket', 'متوسط الطلب')}</th>
                      <th className="py-2.5 text-end">{T('Share of Delivery', 'حصة التوصيل')}</th>
                      <th className="py-2.5 text-end">{T('Posted Commission', 'العمولة المرحّلة')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-white/[0.06]">
                    {matrixRows.map((row) => (
                      <tr
                        key={row.rowId}
                        className={
                          row.isUnattributed
                            ? 'bg-amber-50/50 dark:bg-amber-950/15'
                            : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.03]'
                        }
                      >
                        <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                          <span className="inline-flex items-center gap-1.5">
                            <Building2
                              className={`h-3.5 w-3.5 ${
                                row.isUnattributed ? 'text-amber-600' : 'text-emerald-600'
                              }`}
                              aria-hidden
                            />
                            {isAr ? row.branchLabelAr : row.branchLabelEn}
                          </span>
                        </td>
                        <td className="py-2.5 font-semibold text-slate-700 dark:text-slate-200">
                          {isAr ? row.channelLabelAr : row.channelLabelEn}
                        </td>
                        <td
                          dir="ltr"
                          data-unavailable={row.salesKwd === null ? 'true' : undefined}
                          title={row.salesKwd === null ? unavailableTip : undefined}
                          className="py-2.5 text-end font-extrabold tabular-nums text-slate-950 dark:text-white"
                        >
                          {fmtKwd(row.salesKwd, isAr)}
                        </td>
                        <td
                          dir="ltr"
                          data-unavailable={row.orders === null ? 'true' : undefined}
                          title={row.orders === null ? unavailableTip : undefined}
                          className="py-2.5 text-end font-semibold tabular-nums text-slate-700 dark:text-slate-300"
                        >
                          {row.orders === null ? '—' : f0(row.orders, resolvedLocale)}
                        </td>
                        <td
                          dir="ltr"
                          data-unavailable={row.aovKwd === null ? 'true' : undefined}
                          title={row.aovKwd === null ? unavailableTip : undefined}
                          className="py-2.5 text-end font-medium tabular-nums text-slate-600 dark:text-slate-400"
                        >
                          {row.orders !== null && row.orders > 0 && row.aovKwd !== null
                            ? fmtKwd(row.aovKwd, isAr)
                            : '—'}
                        </td>
                        <td
                          dir="ltr"
                          data-unavailable={row.shareOfAggregatorPct === null ? 'true' : undefined}
                          title={row.shareOfAggregatorPct === null ? unavailableTip : undefined}
                          className="py-2.5 text-end font-semibold tabular-nums text-slate-700 dark:text-slate-300"
                        >
                          {row.shareOfAggregatorPct === null
                            ? '—'
                            : f1Pct(row.shareOfAggregatorPct, resolvedLocale)}
                        </td>
                        <td className="py-2.5 text-end">
                          {maskInternalCosts ? (
                            <span className="text-xs font-semibold text-slate-500">
                              {T('Restricted', 'محجوب')}
                            </span>
                          ) : commissionUnposted ? (
                            <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                              {isAr ? UNPOSTED_COMMISSION_AR : UNPOSTED_COMMISSION_EN}
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {T('Posted at company GL level', 'مرحّلة بإجمالي الدفتر العام')}
                            </span>
                          )}
                        </td>
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
