'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Award, Layers, ShoppingBag, TrendingUp } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { FormatLocale } from '@/lib/format'
import { formatKwd, formatPct } from '@/lib/format'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  formatPeriodCalendarWindow,
  getPeriodLabel,
} from '@/lib/aether/global-filter-engine'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import {
  InteractiveDonutChart,
  type DonutSliceDatum,
} from '@/components/aether/InteractiveHoverCharts'
import { OdooPartialWarningBanner } from '@/components/erp/OdooPartialWarningBanner'
import {
  ChartCard,
  DataTable,
  KpiCard,
  StateBlock,
  type DataTableColumn,
} from '@/components/ui'

type Props = {
  locale?: string
}

interface BrandAnalyticsRow {
  id: string
  nameAr: string
  nameEn: string
  color: string
  salesKwd: number | null
  orders: number | null
  aovKwd: number | null
  sharePct: number | null
}

function useSafeLocale(explicitLocale?: string): FormatLocale {
  try {
    const i18n = useI18n()
    if (explicitLocale === 'en' || explicitLocale === 'ar') return explicitLocale
    return i18n.locale === 'en' ? 'en' : 'ar'
  } catch {
    return explicitLocale === 'en' ? 'en' : 'ar'
  }
}

export function BrandSalesAnalyticsDashboard({ locale: explicitLocale }: Props = {}) {
  const resolvedLocale = useSafeLocale(explicitLocale)
  const isAr = resolvedLocale !== 'en'
  const { filters, workspace, liveSummary } = useGlobalFilter()

  const [liveCube, setLiveCube] = useState<OdooPeriodCube | null>(null)
  const [cubeLoading, setCubeLoading] = useState(false)
  const [cubeError, setCubeError] = useState(false)
  const [retryTick, setRetryTick] = useState(0)

  const periodWin = useMemo(
    () =>
      formatPeriodCalendarWindow(filters.period ?? 'month', {
        customFrom: filters.customFrom,
        customTo: filters.customTo,
        liveSummary,
      }),
    [filters.period, filters.customFrom, filters.customTo, liveSummary],
  )

  useEffect(() => {
    if (!workspace.odooConnected || workspace.noData) {
      setLiveCube(null)
      setCubeError(false)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    setCubeLoading(true)
    setCubeError(false)

    const qs = new URLSearchParams({
      dateA: periodWin.fromIso,
      toA: periodWin.toInclusiveIso,
      dateB: periodWin.fromIso,
      toB: periodWin.toInclusiveIso,
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
      .then((payload) => {
        if (cancelled) return
        if (payload?.cubeA && payload.cubeA.connected && !payload.cubeA.noData) {
          setLiveCube(payload.cubeA as OdooPeriodCube)
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
        if (!cancelled) setCubeLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    periodWin.fromIso,
    periodWin.toInclusiveIso,
    workspace.odooConnected,
    workspace.noData,
    retryTick,
  ])

  const snapshot = useMemo(
    () => computeCoresHubSnapshot(filters, [], liveSummary, liveCube),
    [filters, liveSummary, liveCube],
  )

  const activeBucket = useMemo(() => {
    if (!liveSummary || liveSummary.connected !== true) return null
    if (filters.period === 'custom') return liveSummary.customBucket ?? null
    return liveSummary.buckets?.[filters.period ?? 'month'] ?? null
  }, [filters.period, liveSummary])

  const isInitialLoading = liveSummary === null
  const noOdooData =
    liveSummary !== null && (!workspace.odooConnected || workspace.noData || snapshot.noData)
  const brandsUnavailable = snapshot.sales.brandsUnavailable

  const rawBrandRows = useMemo(() => {
    if (brandsUnavailable || noOdooData) return []
    return snapshot.sales.brandShare.map((b) => {
      let salesExplicitNull = false
      let ordersExplicitNull = false

      if (liveCube) {
        if (filters.branch !== 'all') {
          const cell = (
            liveCube.brandByBranch?.[filters.branch] as
              | Record<string, { netKwd?: number | null; linesCount?: number | null } | null>
              | undefined
          )?.[b.id]
          salesExplicitNull = cell === null || (cell !== undefined && cell.netKwd === null)
          ordersExplicitNull = cell === null || (cell !== undefined && cell.linesCount === null)
        } else {
          const cell = (
            liveCube.byBrand as
              | Record<string, { netKwd?: number | null; orders?: number | null } | null>
              | undefined
          )?.[b.id]
          salesExplicitNull = cell === null || (cell !== undefined && cell.netKwd === null)
          ordersExplicitNull = cell === null || (cell !== undefined && cell.orders === null)
        }
      } else if (activeBucket?.byBrand) {
        const cell = (
          activeBucket.byBrand as Record<
            string,
            { netKwd?: number | null; orders?: number | null } | null | undefined
          >
        )[b.id]
        salesExplicitNull = cell === null || (cell !== undefined && cell.netKwd === null)
        ordersExplicitNull = cell === null || (cell !== undefined && cell.orders === null)
      }

      const salesKwd = !salesExplicitNull && Number.isFinite(b.salesKwd) ? b.salesKwd : null
      const orders = !ordersExplicitNull && Number.isFinite(b.orders) ? b.orders : null

      return {
        id: b.id,
        nameAr: b.labelAr,
        nameEn: b.labelEn,
        color: b.color ?? '#10B981',
        salesKwd,
        orders,
        aovKwd:
          salesKwd !== null && orders !== null && orders > 0 ? salesKwd / orders : null,
      }
    })
  }, [activeBucket, brandsUnavailable, filters.branch, liveCube, noOdooData, snapshot.sales.brandShare])

  const totalBrandSalesKwd = useMemo<number | null>(() => {
    if (brandsUnavailable || noOdooData || rawBrandRows.length === 0) return null
    if (rawBrandRows.some((r) => r.salesKwd === null)) return null
    return rawBrandRows.reduce((acc, r) => acc + (r.salesKwd as number), 0)
  }, [brandsUnavailable, noOdooData, rawBrandRows])

  const brandRows: BrandAnalyticsRow[] = useMemo(
    () =>
      rawBrandRows.map((r) => ({
        ...r,
        sharePct:
          totalBrandSalesKwd === null || r.salesKwd === null
            ? null
            : totalBrandSalesKwd > 0
              ? (r.salesKwd / totalBrandSalesKwd) * 100
              : 0,
      })),
    [rawBrandRows, totalBrandSalesKwd],
  )

  const topBrand = useMemo(() => {
    if (brandsUnavailable || noOdooData || brandRows.length === 0) return null
    if (brandRows.some((r) => r.salesKwd === null)) return null
    return [...brandRows].sort((a, b) => (b.salesKwd as number) - (a.salesKwd as number))[0] ?? null
  }, [brandRows, brandsUnavailable, noOdooData])

  const donutSlices: DonutSliceDatum[] = useMemo(() => {
    if (brandsUnavailable || noOdooData) return []
    return brandRows
      .filter((r): r is BrandAnalyticsRow & { salesKwd: number; sharePct: number } =>
        r.salesKwd !== null && r.salesKwd > 0 && r.sharePct !== null,
      )
      .map((r) => ({
        id: r.id,
        label: isAr ? r.nameAr : r.nameEn,
        value: r.salesKwd,
        valueFormatted: formatKwd(r.salesKwd, { locale: resolvedLocale }),
        pctFormatted: formatPct(r.sharePct, { locale: resolvedLocale }),
        color: r.color,
      }))
  }, [brandRows, brandsUnavailable, isAr, noOdooData, resolvedLocale])

  const tableColumns = useMemo<DataTableColumn<BrandAnalyticsRow>[]>(
    () => [
      {
        key: 'brand',
        header: isAr ? 'العلامة التجارية' : 'Brand',
        align: 'start',
        render: (row) => (
          <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
              aria-hidden
            />
            <span className="truncate">{isAr ? row.nameAr : row.nameEn}</span>
          </span>
        ),
      },
      {
        key: 'salesKwd',
        header: isAr ? 'صافي المبيعات (د.ك)' : 'Net Sales (KWD)',
        align: 'numeric',
        format: 'kwd',
        accessor: (row) => row.salesKwd,
      },
      {
        key: 'orders',
        header: isAr ? 'الطلبات' : 'Orders',
        align: 'numeric',
        format: 'int',
        accessor: (row) => row.orders,
      },
      {
        key: 'aovKwd',
        header: isAr ? 'متوسط الفاتورة (د.ك)' : 'AOV (KWD)',
        align: 'numeric',
        format: 'kwd',
        accessor: (row) => row.aovKwd,
      },
      {
        key: 'sharePct',
        header: isAr ? 'الحصة %' : 'Share %',
        align: 'numeric',
        format: 'pct',
        accessor: (row) => row.sharePct,
      },
    ],
    [isAr],
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full space-y-5 pb-12">
      {/* Header */}
      <div className="ae-bento-card flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-950 dark:text-white">
            {isAr ? 'تحليلات مبيعات العلامات التجارية' : 'Brand Sales Analytics'}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {isAr
              ? `الفترة: ${getPeriodLabel(filters.period, true)} (${snapshot.dateRangeLabel}) · أودو 17 المباشر`
              : `Period: ${getPeriodLabel(filters.period, false)} (${snapshot.dateRangeLabel}) · Live Odoo 17`}
          </p>
        </div>

        <Link
          href="/erp/cores"
          className="ds-focus-ring inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
        >
          <span>{isAr ? 'فتح نواة المبيعات والمينيو' : 'Open Sales & Menu Core'}</span>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </Link>
      </div>

      <OdooPartialWarningBanner summary={liveSummary} isAr={isAr} />

      {isInitialLoading ? (
        <StateBlock state="loading" locale={resolvedLocale} skeletonRows={4} />
      ) : noOdooData ? (
        <StateBlock
          state="empty"
          locale={resolvedLocale}
          title={isAr ? 'لا توجد بيانات من Odoo لهذه الفترة' : 'No data from Odoo for this period'}
          description={
            isAr
              ? workspace.noDataMessageAr || 'تعذّر جلب مبيعات العلامات التجارية من أودو لهذه الفترة.'
              : 'Could not retrieve live brand sales from Odoo for the selected window.'
          }
        />
      ) : (
        <>
          {cubeError ? (
            <StateBlock
              state="error"
              locale={resolvedLocale}
              compact
              onRetry={() => setRetryTick((n) => n + 1)}
            />
          ) : null}

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={isAr ? 'إجمالي مبيعات العلامات الست' : 'Total 6-Brand Sales'}
              value={totalBrandSalesKwd}
              format="kwd"
              locale={resolvedLocale}
              loading={cubeLoading && totalBrandSalesKwd === null}
              icon={<TrendingUp className="h-4 w-4" />}
              provenance={{
                odooModel: 'pos.order.line + pos.category',
                dateRange: snapshot.dateRangeLabel,
                lastSyncAt: snapshot.lastSyncAt,
                isStale24h: snapshot.isStale24h,
                kind: 'فعلي',
              }}
            />

            <KpiCard
              label={isAr ? 'أعلى علامة تجارية مبيعاً' : 'Top Performing Brand'}
              value={topBrand ? (isAr ? topBrand.nameAr : topBrand.nameEn) : null}
              format="raw"
              locale={resolvedLocale}
              subtitle={
                topBrand && topBrand.salesKwd !== null && topBrand.sharePct !== null
                  ? `${formatKwd(topBrand.salesKwd, { locale: resolvedLocale })} (${formatPct(topBrand.sharePct, { locale: resolvedLocale })})`
                  : undefined
              }
              icon={<Award className="h-4 w-4" />}
              provenance={{
                odooModel: 'pos.order.line',
                dateRange: snapshot.dateRangeLabel,
                lastSyncAt: snapshot.lastSyncAt,
                isStale24h: snapshot.isStale24h,
                kind: 'فعلي',
              }}
            />

            <KpiCard
              label={isAr ? 'إجمالي الطلبات' : 'Total POS Orders'}
              value={workspace.nullableOrders}
              format="int"
              unit={isAr ? 'طلب' : 'orders'}
              locale={resolvedLocale}
              icon={<ShoppingBag className="h-4 w-4" />}
              provenance={{
                odooModel: 'pos.order',
                dateRange: snapshot.dateRangeLabel,
                lastSyncAt: snapshot.lastSyncAt,
                isStale24h: snapshot.isStale24h,
                kind: 'فعلي',
              }}
            />

            <KpiCard
              label={isAr ? 'متوسط الفاتورة (AOV)' : 'Average Order Value'}
              value={workspace.nullableAovKwd}
              format="kwd"
              locale={resolvedLocale}
              icon={<Layers className="h-4 w-4" />}
              provenance={{
                odooModel: 'pos.order.line + pos.order',
                dateRange: snapshot.dateRangeLabel,
                lastSyncAt: snapshot.lastSyncAt,
                isStale24h: snapshot.isStale24h,
                kind: 'محسوب بمعادلة',
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <ChartCard
                title={isAr ? 'توزيع الحصص بين العلامات الست' : '6-Brand Revenue Share'}
                period={snapshot.dateRangeLabel}
                unit={isAr ? 'د.ك (KWD)' : 'KWD'}
                locale={resolvedLocale}
                state={
                  brandsUnavailable
                    ? 'unavailable'
                    : cubeLoading && donutSlices.length === 0
                      ? 'loading'
                      : donutSlices.length === 0
                        ? 'empty'
                        : 'ready'
                }
                showGridBackdrop={false}
              >
                <InteractiveDonutChart
                  slices={donutSlices}
                  centerValue={formatKwd(totalBrandSalesKwd, {
                    locale: resolvedLocale,
                    showUnit: false,
                  })}
                  centerSubValue={isAr ? 'د.ك' : 'KWD'}
                  centerLabel={isAr ? 'العلامات' : 'Brands'}
                  isAr={isAr}
                />
              </ChartCard>
            </div>

            <div className="xl:col-span-7">
              <DataTable<BrandAnalyticsRow>
                columns={tableColumns}
                rows={brandRows}
                rowKey={(r) => r.id}
                locale={resolvedLocale}
                unavailable={brandsUnavailable}
                loading={cubeLoading && brandRows.length === 0 && !brandsUnavailable}
                caption={
                  isAr
                    ? 'تفصيل مبيعات العلامات التجارية الست من أودو 17'
                    : 'Six-brand POS sales breakdown from Odoo 17'
                }
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
