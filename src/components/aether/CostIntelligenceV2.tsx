'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Building2, Package, Receipt, RefreshCw, ShoppingCart } from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { formatPeriodCalendarWindow } from '@/lib/aether/global-filter-engine'
import KpiProvenanceBadge from '@/components/erp/KpiProvenanceBadge'
import { useI18n } from '@/lib/i18n'
import type { OdooLivePurchaseSummary } from '@/lib/odoo-live-connector'

export function CostIntelligenceV2() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
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

  const [loading, setLoading] = useState(true)
  const [purchaseSummary, setPurchaseSummary] = useState<OdooLivePurchaseSummary | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)

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
        if (!res.ok) return null
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
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [periodWindow.fromIso, periodWindow.toInclusiveIso])

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

  const fmtKwd = (v: number) =>
    `${v.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${
      isAr ? 'د.ك' : 'KWD'
    }`

  const noData =
    !purchaseSummary ||
    !purchaseSummary.connected ||
    purchaseSummary.noData ||
    purchaseSummary.totals.ordersCount === 0

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Receipt className="h-3.5 w-3.5" />
              {isAr
                ? 'أوامر الشراء وأسعار الموردين من Odoo (purchase.order)'
                : 'Odoo Purchase Orders & Vendor Unit Costs (purchase.order)'}
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isAr ? 'ذكاء التكلفة والمشتريات' : 'Cost & Procurement Intelligence'}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {isAr
                ? `الفترة المختارة: ${periodWindow.labelAr} (${periodWindow.fromIso} → ${periodWindow.toInclusiveIso})`
                : `Selected Period: ${periodWindow.labelEn} (${periodWindow.fromIso} → ${periodWindow.toInclusiveIso})`}
            </p>
          </div>

          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'ابحث باسم المورد أو الصنف...' : 'Filter vendor or item...'}
            className="w-full max-w-xs rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </section>

      {loading ? (
        <section className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
          <span className="text-sm font-semibold">
            {isAr ? 'جاري جلب أوامر الشراء من Odoo...' : 'Fetching purchase orders from Odoo...'}
          </span>
        </section>
      ) : noData ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600 dark:text-amber-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            لا توجد بيانات من Odoo لهذه الفترة
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {isAr
              ? `لم يتم العثور على أوامر شراء معتمدة (purchase.order بحالة purchase أو done) ضمن الفترة ${periodWindow.fromIso} إلى ${periodWindow.toInclusiveIso}.`
              : `No confirmed Odoo purchase orders (state in ['purchase', 'done']) found between ${periodWindow.fromIso} and ${periodWindow.toInclusiveIso}.`}
          </p>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                <span>{isAr ? 'إجمالي أوامر الشراء المعتمدة' : 'Confirmed Purchase Total'}</span>
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                {fmtKwd(purchaseSummary.totals.totalAmountKwd)}
              </p>
              <div className="mt-3">
                <KpiProvenanceBadge
                  model="purchase.order"
                  dateRange={purchaseSummary.dateRange}
                  lastSyncAt={purchaseSummary.lastSyncAt}
                  isStale24h={purchaseSummary.isStale24h}
                  kind="فعلي"
                  queryOrFormula="SUM(purchase.order.amount_total) WHERE state IN ('purchase','done')"
                  isAr={isAr}
                />
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                <span>{isAr ? 'عدد أوامر الشراء' : 'Purchase Orders Count'}</span>
                <Receipt className="h-4 w-4 text-sky-600" />
              </div>
              <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                {purchaseSummary.totals.ordersCount.toLocaleString('en-US')}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {isAr
                  ? `${purchaseSummary.totals.linesCount.toLocaleString('en-US')} سطر شراء`
                  : `${purchaseSummary.totals.linesCount.toLocaleString('en-US')} order lines`}
              </p>
              <div className="mt-2">
                <KpiProvenanceBadge
                  model="purchase.order"
                  dateRange={purchaseSummary.dateRange}
                  lastSyncAt={purchaseSummary.lastSyncAt}
                  isStale24h={purchaseSummary.isStale24h}
                  kind="فعلي"
                  queryOrFormula="COUNT(purchase.order) WHERE state IN ('purchase','done')"
                  isAr={isAr}
                />
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                <span>{isAr ? 'الموردون الفعليون في الفترة' : 'Active Vendors'}</span>
                <Building2 className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                {purchaseSummary.totals.vendorsCount.toLocaleString('en-US')}
              </p>
              <div className="mt-3">
                <KpiProvenanceBadge
                  model="purchase.order"
                  dateRange={purchaseSummary.dateRange}
                  lastSyncAt={purchaseSummary.lastSyncAt}
                  isStale24h={purchaseSummary.isStale24h}
                  kind="فعلي"
                  queryOrFormula="COUNT(DISTINCT purchase.order.partner_id) WHERE state IN ('purchase','done')"
                  isAr={isAr}
                />
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                <span>{isAr ? 'الأصناف المشتراة' : 'Purchased Products'}</span>
                <Package className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                {purchaseSummary.totals.productsCount.toLocaleString('en-US')}
              </p>
              <div className="mt-3">
                <KpiProvenanceBadge
                  model="purchase.order.line"
                  dateRange={purchaseSummary.dateRange}
                  lastSyncAt={purchaseSummary.lastSyncAt}
                  isStale24h={purchaseSummary.isStale24h}
                  kind="فعلي"
                  queryOrFormula="COUNT(DISTINCT purchase.order.line.product_id) WHERE order_id.state IN ('purchase','done')"
                  isAr={isAr}
                />
              </div>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
              {isAr ? 'مشتريات الموردين المعتمدة في Odoo' : 'Confirmed Odoo Vendor Spend'}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 dark:border-slate-800">
                    <th className="px-3 py-2.5 text-start">{isAr ? 'المورد' : 'Vendor'}</th>
                    <th className="px-3 py-2.5 text-center">{isAr ? 'الأوامر' : 'Orders'}</th>
                    <th className="px-3 py-2.5 text-center">{isAr ? 'السطور' : 'Lines'}</th>
                    <th className="px-3 py-2.5 text-end">{isAr ? 'صافي القيمة' : 'Untaxed'}</th>
                    <th className="px-3 py-2.5 text-end">{isAr ? 'الإجمالي' : 'Total'}</th>
                    <th className="px-3 py-2.5 text-center">{isAr ? 'آخر أمر شراء' : 'Latest Order'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.map((v) => (
                    <tr
                      key={v.partnerId}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                    >
                      <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                        {v.vendorName}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{v.ordersCount}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{v.linesCount}</td>
                      <td className="px-3 py-2.5 text-end tabular-nums">
                        {fmtKwd(v.totalUntaxedKwd)}
                      </td>
                      <td className="px-3 py-2.5 text-end font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {fmtKwd(v.totalAmountKwd)}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-slate-500" dir="ltr">
                        {v.latestOrderDate ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
              {isAr
                ? 'الأصناف المشتراة وتذبذب سعر الوحدة الفعلي (purchase.order.line)'
                : 'Purchased Items & Actual Unit-Price Variance (purchase.order.line)'}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 dark:border-slate-800">
                    <th className="px-3 py-2.5 text-start">{isAr ? 'الصنف' : 'Product'}</th>
                    <th className="px-3 py-2.5 text-center">{isAr ? 'الوحدة' : 'UoM'}</th>
                    <th className="px-3 py-2.5 text-end">{isAr ? 'الكمية' : 'Total Qty'}</th>
                    <th className="px-3 py-2.5 text-end">{isAr ? 'متوسط السعر المرجّح' : 'Weighted Avg Price'}</th>
                    <th className="px-3 py-2.5 text-end">{isAr ? 'أدنى — أعلى سعر' : 'Min — Max Price'}</th>
                    <th className="px-3 py-2.5 text-center">{isAr ? 'تذبذب السعر %' : 'Price Variance %'}</th>
                    <th className="px-3 py-2.5 text-end">{isAr ? 'إجمالي التكلفة' : 'Total Spend'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr
                      key={p.productId}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                    >
                      <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                        {p.productName}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-slate-500">{p.uomName}</td>
                      <td className="px-3 py-2.5 text-end tabular-nums">
                        {p.totalQty.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-end tabular-nums">
                        {fmtKwd(p.weightedAvgUnitPriceKwd)}
                      </td>
                      <td className="px-3 py-2.5 text-end text-xs tabular-nums text-slate-600 dark:text-slate-300">
                        {p.minUnitPriceKwd.toFixed(3)} — {p.maxUnitPriceKwd.toFixed(3)}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                            p.priceVariancePct > 5
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {p.priceVariancePct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-end font-bold tabular-nums text-slate-900 dark:text-white">
                        {fmtKwd(p.totalSubtotalKwd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
