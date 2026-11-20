'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Building2, Package, Receipt, RefreshCw, ShoppingCart } from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { formatPeriodCalendarWindow } from '@/lib/aether/global-filter-engine'
import KpiProvenanceBadge from '@/components/erp/KpiProvenanceBadge'
import { KpiCard } from '@/components/ui/kpi-card'
import { PartialWarningBanner } from '@/components/ui/partial-warning-banner'
import { StateBlock } from '@/components/ui/state-block'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatInt,
  formatKwd,
  formatPct,
  formatQty,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type { OdooLivePurchaseSummary } from '@/lib/odoo-live-connector'

export interface CostIntelligenceV2Props {
  initialSummary?: OdooLivePurchaseSummary | null
  initialLoading?: boolean
  initialError?: boolean
}

function NullableNumberCell({
  value,
  locale,
  formatter,
  className = '',
}: {
  value: number | null | undefined
  locale: FormatLocale
  formatter: (n: number) => string
  className?: string
}) {
  const unavailable = typeof value !== 'number' || !Number.isFinite(value)
  const tooltip = getUnavailableTooltip(locale)
  return (
    <span
      dir="ltr"
      data-unavailable={unavailable ? 'true' : undefined}
      title={unavailable ? tooltip : undefined}
      aria-label={unavailable ? tooltip : undefined}
      className={`tabular-nums ${className}`.trim()}
    >
      {unavailable ? UNAVAILABLE_DASH : formatter(value)}
    </span>
  )
}

export function CostIntelligenceV2(props: CostIntelligenceV2Props) {
  const {
    initialSummary,
    initialLoading,
    initialError = false,
  } = props ?? {}
  const { locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const isAr = fmtLocale !== 'en'
  const { filters, liveSummary } = useGlobalFilter()

  const periodWindow = useMemo(
    () =>
      formatPeriodCalendarWindow(filters.period ?? 'month', {
        customFrom: filters.customFrom,
        customTo: filters.customTo,
        liveSummary,
      }),
    [filters.period, filters.customFrom, filters.customTo, liveSummary],
  )

  const hasInitialSummary = initialSummary !== undefined
  const [loading, setLoading] = useState(
    initialLoading !== undefined ? initialLoading : !hasInitialSummary && !initialError,
  )
  const [fetchError, setFetchError] = useState(initialError)
  const [purchaseSummary, setPurchaseSummary] = useState<OdooLivePurchaseSummary | null>(
    initialSummary ?? null,
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    if (hasInitialSummary && reloadNonce === 0) return
    if (initialLoading !== undefined && reloadNonce === 0) return
    if (initialError && reloadNonce === 0) return

    let cancelled = false
    setLoading(true)
    setFetchError(false)

    const qs = new URLSearchParams({
      from: periodWindow.fromIso,
      to: periodWindow.toInclusiveIso,
    })

    fetch(`/api/erp/purchase-orders?${qs.toString()}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('fetch_failed')
        }
        const json = await res.json()
        return (json?.purchaseOrders ?? null) as OdooLivePurchaseSummary | null
      })
      .then((payload) => {
        if (!cancelled) {
          setPurchaseSummary(payload)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPurchaseSummary(null)
          setFetchError(true)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    hasInitialSummary,
    initialError,
    initialLoading,
    periodWindow.fromIso,
    periodWindow.toInclusiveIso,
    reloadNonce,
  ])

  const filteredProducts = useMemo(() => {
    if (!purchaseSummary?.byProduct) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return purchaseSummary.byProduct
    return purchaseSummary.byProduct.filter((p) => p.productName.toLowerCase().includes(q))
  }, [purchaseSummary, searchQuery])

  const filteredVendors = useMemo(() => {
    if (!purchaseSummary?.byVendor) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return purchaseSummary.byVendor
    return purchaseSummary.byVendor.filter((v) => v.vendorName.toLowerCase().includes(q))
  }, [purchaseSummary, searchQuery])

  const noData =
    !purchaseSummary ||
    !purchaseSummary.connected ||
    purchaseSummary.noData ||
    purchaseSummary.totals.ordersCount === 0

  const unavailableTooltip = getUnavailableTooltip(fmtLocale)
  const qtyFormatter = (n: number) => formatQty(n)

  return (
    <div className="space-y-6 min-w-0" dir={isAr ? 'rtl' : 'ltr'}>
      <PartialWarningBanner summary={liveSummary} isAr={isAr} />

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-white/10 dark:bg-[#101815]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">
              <Receipt className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                {isAr
                  ? 'أوامر الشراء وأسعار الموردين من Odoo (purchase.order)'
                  : 'Odoo Purchase Orders & Vendor Unit Costs (purchase.order)'}
              </span>
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {isAr ? 'ذكاء التكلفة والمشتريات' : 'Cost & Procurement Intelligence'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {isAr ? 'الفترة المختارة:' : 'Selected Period:'}{' '}
              {isAr ? periodWindow.labelAr : periodWindow.labelEn}{' '}
              <span dir="ltr" className="tabular-nums">
                ({periodWindow.fromIso} → {periodWindow.toInclusiveIso})
              </span>
            </p>
          </div>

          <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={isAr ? 'تصفية حسب اسم المورد أو الصنف' : 'Filter by vendor or item'}
              placeholder={isAr ? 'ابحث باسم المورد أو الصنف...' : 'Filter vendor or item...'}
              className="w-full sm:w-64 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/15 dark:bg-[#090E0C] dark:text-white"
            />
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              disabled={loading}
              aria-label={isAr ? 'تحديث أوامر الشراء' : 'Refresh purchase orders'}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-50 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-200 dark:hover:bg-emerald-950/60"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              <span>{isAr ? 'تحديث' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <StateBlock
          state="loading"
          locale={fmtLocale}
          skeletonRows={4}
          minHeightClass="min-h-[220px]"
          title={isAr ? 'جاري جلب أوامر الشراء من Odoo...' : 'Fetching purchase orders from Odoo...'}
        />
      ) : fetchError ? (
        <StateBlock
          state="error"
          locale={fmtLocale}
          onRetry={() => setReloadNonce((n) => n + 1)}
          title={
            isAr
              ? 'تعذّر جلب أوامر الشراء من Odoo حالياً'
              : 'Unable to load Odoo purchase orders right now'
          }
          description={
            isAr
              ? 'حدث خلل مؤقت أثناء الاتصال بمصدر المشتريات. يرجى المحاولة مجدداً.'
              : 'A temporary connection issue occurred while fetching purchase orders. Please retry.'
          }
        />
      ) : noData ? (
        <StateBlock
          state={purchaseSummary?.connected === false || !purchaseSummary ? 'unlinked' : 'empty'}
          locale={fmtLocale}
          title={
            isAr
              ? 'لا توجد بيانات من Odoo لهذه الفترة'
              : 'No Odoo purchase data for this period'
          }
          description={
            isAr
              ? `لم يتم العثور على أوامر شراء معتمدة (purchase.order بحالة purchase أو done) ضمن الفترة ${periodWindow.fromIso} إلى ${periodWindow.toInclusiveIso}.`
              : `No confirmed Odoo purchase orders (state in ['purchase', 'done']) found between ${periodWindow.fromIso} and ${periodWindow.toInclusiveIso}.`
          }
          onRetry={() => setReloadNonce((n) => n + 1)}
        />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label={isAr ? 'إجمالي أوامر الشراء المعتمدة' : 'Confirmed Purchase Total'}
              value={purchaseSummary.totals.totalAmountKwd}
              format="kwd"
              locale={fmtLocale}
              icon={<ShoppingCart className="h-4 w-4" />}
              provenance={
                <KpiProvenanceBadge
                  model="purchase.order"
                  dateRange={purchaseSummary.dateRange}
                  lastSyncAt={purchaseSummary.lastSyncAt}
                  isStale24h={purchaseSummary.isStale24h}
                  kind="فعلي"
                  queryOrFormula="SUM(purchase.order.amount_total) WHERE state IN ('purchase','done')"
                  isAr={isAr}
                />
              }
            />

            <KpiCard
              label={isAr ? 'عدد أوامر الشراء' : 'Purchase Orders Count'}
              value={purchaseSummary.totals.ordersCount}
              format="int"
              locale={fmtLocale}
              icon={<Receipt className="h-4 w-4" />}
              subtitle={
                <span dir="ltr" className="tabular-nums">
                  {formatInt(purchaseSummary.totals.linesCount, { locale: fmtLocale })}{' '}
                  {isAr ? 'سطر شراء' : 'order lines'}
                </span>
              }
              provenance={
                <KpiProvenanceBadge
                  model="purchase.order"
                  dateRange={purchaseSummary.dateRange}
                  lastSyncAt={purchaseSummary.lastSyncAt}
                  isStale24h={purchaseSummary.isStale24h}
                  kind="فعلي"
                  queryOrFormula="COUNT(purchase.order) WHERE state IN ('purchase','done')"
                  isAr={isAr}
                />
              }
            />

            <KpiCard
              label={isAr ? 'الموردون الفعليون في الفترة' : 'Active Vendors'}
              value={purchaseSummary.totals.vendorsCount}
              format="int"
              locale={fmtLocale}
              icon={<Building2 className="h-4 w-4" />}
              provenance={
                <KpiProvenanceBadge
                  model="purchase.order"
                  dateRange={purchaseSummary.dateRange}
                  lastSyncAt={purchaseSummary.lastSyncAt}
                  isStale24h={purchaseSummary.isStale24h}
                  kind="فعلي"
                  queryOrFormula="COUNT(DISTINCT purchase.order.partner_id) WHERE state IN ('purchase','done')"
                  isAr={isAr}
                />
              }
            />

            <KpiCard
              label={isAr ? 'الأصناف المشتراة' : 'Purchased Products'}
              value={purchaseSummary.totals.productsCount}
              format="int"
              locale={fmtLocale}
              icon={<Package className="h-4 w-4" />}
              provenance={
                <KpiProvenanceBadge
                  model="purchase.order.line"
                  dateRange={purchaseSummary.dateRange}
                  lastSyncAt={purchaseSummary.lastSyncAt}
                  isStale24h={purchaseSummary.isStale24h}
                  kind="فعلي"
                  queryOrFormula="COUNT(DISTINCT purchase.order.line.product_id) WHERE order_id.state IN ('purchase','done')"
                  isAr={isAr}
                />
              }
            />
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-white/10 dark:bg-[#101815]">
            <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
              {isAr ? 'مشتريات الموردين المعتمدة في Odoo' : 'Confirmed Odoo Vendor Spend'}
            </h3>
            {filteredVendors.length === 0 ? (
              <StateBlock
                state="empty"
                compact
                locale={fmtLocale}
                title={isAr ? 'لا يوجد موردون مطابقون للبحث' : 'No matching vendors'}
                description={
                  isAr
                    ? 'جرّب تعديل كلمة البحث لعرض الموردين.'
                    : 'Try clearing or adjusting your search query.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 dark:border-white/10 dark:text-slate-400">
                      <th className="whitespace-nowrap px-3 py-2.5 text-start">{isAr ? 'المورد' : 'Vendor'}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-center">{isAr ? 'الأوامر' : 'Orders'}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-center">{isAr ? 'السطور' : 'Lines'}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-end">{isAr ? 'صافي القيمة' : 'Untaxed'}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-end">{isAr ? 'الإجمالي' : 'Total'}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-center">{isAr ? 'آخر أمر شراء' : 'Latest Order'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVendors.map((v) => {
                      const latestDate = formatDate(v.latestOrderDate, { locale: fmtLocale })
                      const dateUnavailable = latestDate === UNAVAILABLE_DASH
                      return (
                        <tr
                          key={v.partnerId}
                          className="border-b border-slate-100 last:border-0 dark:border-white/[0.06]"
                        >
                          <td className="max-w-[260px] truncate px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                            {v.vendorName}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-center">
                            <NullableNumberCell
                              value={v.ordersCount}
                              locale={fmtLocale}
                              formatter={(n) => formatInt(n, { locale: fmtLocale })}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-center">
                            <NullableNumberCell
                              value={v.linesCount}
                              locale={fmtLocale}
                              formatter={(n) => formatInt(n, { locale: fmtLocale })}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-end">
                            <NullableNumberCell
                              value={v.totalUntaxedKwd}
                              locale={fmtLocale}
                              formatter={(n) => formatKwd(n, { locale: fmtLocale })}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-end font-bold text-emerald-700 dark:text-emerald-400">
                            <NullableNumberCell
                              value={v.totalAmountKwd}
                              locale={fmtLocale}
                              formatter={(n) => formatKwd(n, { locale: fmtLocale })}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-center text-xs text-slate-500 dark:text-slate-400">
                            <span
                              dir="ltr"
                              data-unavailable={dateUnavailable ? 'true' : undefined}
                              title={dateUnavailable ? unavailableTooltip : undefined}
                              aria-label={dateUnavailable ? unavailableTooltip : undefined}
                              className="whitespace-nowrap tabular-nums"
                            >
                              {latestDate}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-white/10 dark:bg-[#101815]">
            <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
              {isAr
                ? 'الأصناف المشتراة وتذبذب سعر الوحدة الفعلي (purchase.order.line)'
                : 'Purchased Items & Actual Unit-Price Variance (purchase.order.line)'}
            </h3>
            {filteredProducts.length === 0 ? (
              <StateBlock
                state="empty"
                compact
                locale={fmtLocale}
                title={isAr ? 'لا توجد أصناف مطابقة للبحث' : 'No matching items'}
                description={
                  isAr
                    ? 'جرّب تعديل كلمة البحث لعرض الأصناف.'
                    : 'Try clearing or adjusting your search query.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[740px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 dark:border-white/10 dark:text-slate-400">
                      <th className="whitespace-nowrap px-3 py-2.5 text-start">{isAr ? 'الصنف' : 'Product'}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-center">{isAr ? 'الوحدة' : 'UoM'}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-end">{isAr ? 'الكمية' : 'Total Qty'}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-end">{isAr ? 'متوسط السعر المرجّح' : 'Weighted Avg Price'}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-end">{isAr ? 'أدنى — أعلى سعر' : 'Min — Max Price'}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-center">{isAr ? 'تذبذب السعر %' : 'Price Variance %'}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-end">{isAr ? 'إجمالي التكلفة' : 'Total Spend'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => {
                      const minStr = formatKwd(p.minUnitPriceKwd, {
                        locale: fmtLocale,
                        showUnit: false,
                      })
                      const maxStr = formatKwd(p.maxUnitPriceKwd, {
                        locale: fmtLocale,
                        showUnit: false,
                      })
                      const minMaxUnavailable =
                        minStr === UNAVAILABLE_DASH || maxStr === UNAVAILABLE_DASH
                      const varianceUnavailable =
                        typeof p.priceVariancePct !== 'number' ||
                        !Number.isFinite(p.priceVariancePct)
                      return (
                        <tr
                          key={p.productId}
                          className="border-b border-slate-100 last:border-0 dark:border-white/[0.06]"
                        >
                          <td className="max-w-[260px] truncate px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                            {p.productName}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-center text-xs text-slate-500 dark:text-slate-400">
                            {p.uomName || UNAVAILABLE_DASH}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-end">
                            <NullableNumberCell
                              value={p.totalQty}
                              locale={fmtLocale}
                              formatter={qtyFormatter}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-end">
                            <NullableNumberCell
                              value={p.weightedAvgUnitPriceKwd}
                              locale={fmtLocale}
                              formatter={(n) => formatKwd(n, { locale: fmtLocale })}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-end text-xs text-slate-600 dark:text-slate-300">
                            <span
                              dir="ltr"
                              data-unavailable={minMaxUnavailable ? 'true' : undefined}
                              title={minMaxUnavailable ? unavailableTooltip : undefined}
                              aria-label={minMaxUnavailable ? unavailableTooltip : undefined}
                              className="whitespace-nowrap tabular-nums"
                            >
                              {minMaxUnavailable ? UNAVAILABLE_DASH : `${minStr} — ${maxStr}`}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-center">
                            <span
                              dir="ltr"
                              data-unavailable={varianceUnavailable ? 'true' : undefined}
                              title={varianceUnavailable ? unavailableTooltip : undefined}
                              aria-label={varianceUnavailable ? unavailableTooltip : undefined}
                              className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                                !varianceUnavailable && p.priceVariancePct > 5
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                              }`}
                            >
                              {formatPct(p.priceVariancePct, { locale: fmtLocale })}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-end font-bold text-slate-900 dark:text-white">
                            <NullableNumberCell
                              value={p.totalSubtotalKwd}
                              locale={fmtLocale}
                              formatter={(n) => formatKwd(n, { locale: fmtLocale })}
                            />
                          </td>
                        </tr>
                      )
                    })}
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
