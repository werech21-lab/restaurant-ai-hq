'use client'

import { BRAND_SHARE_BASIS, normalizeSharesTo100, sumShares } from '@/lib/aether/share-normalization'
import React from 'react'
import Link from 'next/link'
import { Award, ArrowUpRight, BarChart3, Store, Tag, TrendingUp } from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { PartialWarningBanner, StateBlock } from '@/components/ui'
import {
  computePeriodOverPeriodDeltaPct,
  formatSignedDelta,
  resolveSummaryBucket,
  type GlobalBranch,
} from '@/lib/aether/global-filter-engine'
import { UNMAPPED_TERMINALS_LABEL_AR, UNMAPPED_TERMINALS_LABEL_EN } from '@/lib/aether/period-delta'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
} from '@/lib/format'
import { useI18n } from '@/lib/i18n'

interface ScorecardBranchRow {
  id: GlobalBranch | 'unattributed'
  ar: string
  en: string
  salesKwd?: number
  orders: number | null
  isUnattributed?: boolean
}

export function SalesScorecardStudio() {
  const { locale } = useI18n()
  const resolvedLocale: 'ar' | 'en' = locale === 'en' ? 'en' : 'ar'
  const isAr = resolvedLocale !== 'en'
  const {
    filters,
    workspace,
    liveSummary,
    syncingOdoo,
    loadingSummary = false,
    setBrand,
    setBranch,
    setChannel,
  } = useGlobalFilter()
  const unavailableTooltip = getUnavailableTooltip(resolvedLocale)
  const activeBucket = resolveSummaryBucket(filters, liveSummary) ?? null

  const deltaPct = computePeriodOverPeriodDeltaPct(filters, workspace, liveSummary)
  const deltaBadge = formatSignedDelta(deltaPct ?? 0)

  const sortOptions = <T extends { salesKwd?: number }>(list: T[]): T[] =>
    [...list].sort((a, b) => {
      const aOk = typeof a.salesKwd === 'number'
      const bOk = typeof b.salesKwd === 'number'
      if (aOk && bOk) return (b.salesKwd as number) - (a.salesKwd as number)
      if (aOk) return -1
      if (bOk) return 1
      return 0
    })

  const brands = sortOptions(workspace.cascadingOptions.brands.filter((b) => b.id !== 'all'))
  const canteensReported =
    !activeBucket ||
    Boolean(
      activeBucket.byLocation?.['school-canteens'] ??
        activeBucket.mappedByLocation?.['school-canteens'] ??
        activeBucket.byBrandByLocation?.['school-canteens'],
    ) ||
    filters.branch === 'school-canteens'

  const resolveBranchOrders = (branchId: GlobalBranch, salesKwd?: number): number | null => {
    if (typeof salesKwd !== 'number' || !activeBucket || filters.kuwaitSlice !== 'all') {
      return null
    }
    if (filters.brand === 'all' && filters.channel === 'all') {
      const cell = activeBucket.mappedByLocation?.[branchId] ?? activeBucket.byLocation?.[branchId]
      return typeof cell?.orders === 'number' && Number.isFinite(cell.orders)
        ? Math.max(0, Math.round(cell.orders))
        : 0
    }
    if (filters.brand === 'all' && filters.channel !== 'all') {
      const cell = activeBucket.byLocation?.[branchId]?.uiChannels?.[filters.channel]
      return typeof cell?.orders === 'number' && Number.isFinite(cell.orders)
        ? Math.max(0, Math.round(cell.orders))
        : 0
    }
    if (filters.brand !== 'all' && filters.channel === 'all') {
      const cell = activeBucket.byBrandByLocation?.[branchId]?.[filters.brand]
      return typeof cell?.orders === 'number' && Number.isFinite(cell.orders)
        ? Math.max(0, Math.round(cell.orders))
        : null
    }
    return null
  }

  const mappedBranches: ScorecardBranchRow[] = sortOptions(
    workspace.cascadingOptions.branches
      .filter((b) => b.id !== 'all' && (b.id !== 'school-canteens' || canteensReported))
      .map((b) => ({
        id: b.id,
        ar: b.ar,
        en: b.en,
        salesKwd: b.salesKwd,
        orders: resolveBranchOrders(b.id, b.salesKwd),
      })),
  )

  const branches: ScorecardBranchRow[] = [...mappedBranches]
  if (
    filters.channel === 'all' &&
    filters.kuwaitSlice === 'all' &&
    mappedBranches.every((r) => typeof r.salesKwd === 'number')
  ) {
    if (filters.brand === 'all') {
      const unSales =
        Math.round(
          ((activeBucket?.unattributedSalesKwd ?? workspace.unattributedSalesKwd ?? 0) as number) *
            1000,
        ) / 1000
      const unOrdRaw = activeBucket?.unattributedOrders ?? workspace.unattributedOrders ?? 0
      const unOrders =
        typeof unOrdRaw === 'number' && Number.isFinite(unOrdRaw)
          ? Math.max(0, Math.round(unOrdRaw))
          : 0
      if (Math.round(unSales * 1000) !== 0 || unOrders > 0) {
        branches.push({
          id: 'unattributed',
          ar: UNMAPPED_TERMINALS_LABEL_AR,
          en: UNMAPPED_TERMINALS_LABEL_EN,
          salesKwd: unSales,
          orders: unOrders,
          isUnattributed: true,
        })
      }
    } else if (activeBucket?.byBrandByLocation?.unattributed?.[filters.brand]) {
      const uCell = activeBucket.byBrandByLocation.unattributed[filters.brand]
      const unSales = Math.round((Number(uCell.netKwd) || 0) * 1000) / 1000
      const unOrders =
        typeof uCell.orders === 'number' && Number.isFinite(uCell.orders)
          ? Math.max(0, Math.round(uCell.orders))
          : null
      if (Math.round(unSales * 1000) !== 0 || (unOrders !== null && unOrders > 0)) {
        branches.push({
          id: 'unattributed',
          ar: UNMAPPED_TERMINALS_LABEL_AR,
          en: UNMAPPED_TERMINALS_LABEL_EN,
          salesKwd: unSales,
          orders: unOrders,
          isUnattributed: true,
        })
      }
    }
  }

  const channels = sortOptions(workspace.cascadingOptions.channels.filter((c) => c.id !== 'all'))
  // Phase 5 · Item 4: each list's shares are over that list's own sum, normalised to 100.0%.
  const sharesFor = (rows: { salesKwd?: number | null }[]): number[] | null =>
    rows.every((r) => typeof r.salesKwd === 'number')
      ? normalizeSharesTo100(rows.map((r) => r.salesKwd as number))
      : null
  const brandShares = sharesFor(brands)
  const branchShares = sharesFor(branches)
  const channelShares = sharesFor(channels)
  const hasBrandSales =
    workspace.nullableSalesKwd !== null && brands.some((b) => typeof b.salesKwd === 'number')

  const isLoadingScorecard =
    (syncingOdoo || loadingSummary) &&
    (!liveSummary || (filters.period === 'custom' && activeBucket === null))

  if (isLoadingScorecard) {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-6">
        <StateBlock
          state="loading"
          locale={resolvedLocale}
          skeletonRows={5}
          title={isAr ? 'جارٍ تحميل بطاقة أداء المبيعات…' : 'Loading sales scorecard…'}
        />
      </div>
    )
  }

  if (!liveSummary || !workspace.odooConnected) {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-6 min-w-0">
        <StateBlock
          state="unavailable"
          locale={resolvedLocale}
          title={
            isAr
              ? 'الاتصال المباشر مع Odoo غير متاح حالياً'
              : 'Odoo live connection is Not available'
          }
        />
      </div>
    )
  }

  if (workspace.noData) {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-6 min-w-0">
        <PartialWarningBanner summary={liveSummary} isAr={isAr} />
        <StateBlock
          state="empty"
          locale={resolvedLocale}
          title={isAr ? 'لا توجد بيانات مبيعات لهذه الفترة' : 'No sales data for this period'}
        />
      </div>
    )
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-6 min-w-0">
      <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-emerald-500/25 dark:bg-[#0b1320]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <Award size={14} aria-hidden />
              <span>
                {isAr
                  ? 'بطاقة الأداء القياسية للمبيعات · 6 علامات تجارية × 7 فروع × 8 قنوات'
                  : 'Enterprise Sales Scorecard · 6 Brands × 7 Branches × 8 Channels'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white break-words">
              {isAr
                ? 'سجل وترتيب أداء المبيعات الفعلي حسب العلامة التجارية والفرع والقناة'
                : 'Odoo 17 Sales Ranking & Scorecard by Brand, Branch & Channel'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {isAr ? workspace.subtitleAr : workspace.subtitleEn}
            </p>
          </div>
          <Link
            href="/erp/sales-analysis"
            className="ds-focus-ring inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-500/20 transition dark:text-emerald-300"
          >
            <BarChart3 size={14} aria-hidden />
            <span>{isAr ? 'فتح التحليل التفصيلي للمبيعات' : 'Detailed Sales Analysis'}</span>
            <ArrowUpRight size={13} aria-hidden />
          </Link>
        </div>
      </div>

      <PartialWarningBanner summary={liveSummary} isAr={isAr} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
          <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'صافي المبيعات الإجمالي' : 'Total Net Sales'}
          </span>
          <div
            dir="ltr"
            data-kpi="net-sales"
            title={workspace.nullableSalesKwd === null ? unavailableTooltip : undefined}
            aria-label={workspace.nullableSalesKwd === null ? unavailableTooltip : undefined}
            data-unavailable={workspace.nullableSalesKwd === null ? 'true' : undefined}
            className="ds-num mt-1 text-2xl font-black font-mono tabular-nums text-slate-950 dark:text-white"
          >
            {workspace.nullableSalesKwd === null
              ? isAr
                ? 'غير متاح'
                : UNAVAILABLE_DASH
              : formatKwd(workspace.nullableSalesKwd, resolvedLocale)}
          </div>
          <span
            className={`mt-1 block text-xs font-bold tabular-nums ${
              deltaBadge.tone === 'emerald'
                ? 'text-emerald-700 dark:text-emerald-400'
                : deltaBadge.tone === 'rose'
                  ? 'text-rose-700 dark:text-rose-400'
                  : 'text-slate-600 dark:text-slate-400'
            }`}
            dir="ltr"
          >
            {workspace.nullableSalesKwd === null
              ? UNAVAILABLE_DASH
              : deltaPct === null
                ? UNAVAILABLE_DASH
                : formatPct(deltaPct, { locale: resolvedLocale, signed: true })}
          </span>
        </div>

        <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
          <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'عدد الطلبات المقبوضة' : 'Settled Orders'}
          </span>
          <div
            dir="ltr"
            title={workspace.nullableOrders === null ? unavailableTooltip : undefined}
            aria-label={workspace.nullableOrders === null ? unavailableTooltip : undefined}
            data-unavailable={workspace.nullableOrders === null ? 'true' : undefined}
            className="ds-num mt-1 text-2xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400"
          >
            {workspace.nullableOrders === null
              ? isAr
                ? 'غير متاح'
                : UNAVAILABLE_DASH
              : formatInt(workspace.nullableOrders, resolvedLocale)}
          </div>
          <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
            {isAr
              ? `خلال ${formatInt(workspace.periodDays, resolvedLocale)} يوم`
              : `Across ${formatInt(workspace.periodDays, resolvedLocale)} days`}
          </span>
        </div>

        <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
          <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'متوسط قيمة الفاتورة (AOV)' : 'Average Order Value (AOV)'}
          </span>
          <div
            dir="ltr"
            title={workspace.nullableAovKwd === null ? unavailableTooltip : undefined}
            aria-label={workspace.nullableAovKwd === null ? unavailableTooltip : undefined}
            data-unavailable={workspace.nullableAovKwd === null ? 'true' : undefined}
            className="ds-num mt-1 text-2xl font-black font-mono tabular-nums text-amber-700 dark:text-amber-300"
          >
            {workspace.nullableAovKwd === null
              ? isAr
                ? 'غير متاح'
                : UNAVAILABLE_DASH
              : formatKwd(workspace.nullableAovKwd, resolvedLocale)}
          </div>
          <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
            {isAr ? 'متوسط السلة الفعلي في أودو' : 'Actual Odoo POS basket'}
          </span>
        </div>

        <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
          <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'العلامة المتصدرة' : 'Top Performing Brand'}
          </span>
          <div
            title={!hasBrandSales ? unavailableTooltip : undefined}
            data-unavailable={!hasBrandSales ? 'true' : undefined}
            className="mt-1 text-xl font-black text-slate-950 dark:text-white break-words"
          >
            {hasBrandSales && brands[0]
              ? isAr
                ? brands[0].ar
                : brands[0].en
              : isAr
                ? 'غير متاح'
                : UNAVAILABLE_DASH}
          </div>
          <span
            dir="ltr"
            title={!hasBrandSales ? unavailableTooltip : undefined}
            className="ds-num mt-1 block text-xs text-emerald-700 dark:text-emerald-400 font-mono font-bold tabular-nums"
          >
            {hasBrandSales && typeof brands[0]?.salesKwd === 'number'
              ? formatKwd(brands[0].salesKwd, resolvedLocale)
              : isAr
                ? 'غير متاح'
                : UNAVAILABLE_DASH}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3 shadow-xs dark:border-slate-800 dark:bg-[#0b1320]">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            <Tag size={16} className="text-emerald-600 dark:text-emerald-400" aria-hidden />
            <h3 className="text-sm font-black text-slate-950 dark:text-white">
              {isAr ? 'ترتيب الـ 6 علامات تجارية' : '6 Brands Scorecard'}
            </h3>
          </div>
          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {brands.map((b, idx) => {
              const unavailable = typeof b.salesKwd !== 'number' || brandShares === null
              const sales = b.salesKwd ?? 0
              const share = brandShares?.[idx] ?? 0
              const selected = filters.brand === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setBrand(b.id)}
                  className={`ds-focus-ring w-full py-2.5 flex items-center justify-between gap-2 text-xs rounded-lg px-2 transition ${
                    selected
                      ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      dir="ltr"
                      className="h-5 w-5 shrink-0 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-mono font-bold tabular-nums flex items-center justify-center"
                    >
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white break-words text-start">
                      {isAr ? b.ar : b.en}
                    </span>
                  </div>
                  <div
                    dir="ltr"
                    title={unavailable ? unavailableTooltip : undefined}
                    className="ds-num text-end font-mono tabular-nums shrink-0"
                  >
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 block">
                      {unavailable
                        ? isAr
                          ? 'غير متاح'
                          : UNAVAILABLE_DASH
                        : formatKwd(sales, resolvedLocale)}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">
                      {unavailable ? UNAVAILABLE_DASH : formatPct(share, resolvedLocale)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
          {brandShares && brands.length > 1 ? (
            <p data-brand-share-basis="true" className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              <span dir="ltr" className="font-semibold tabular-nums">
                Σ {formatPct(sumShares(brandShares), resolvedLocale)}
              </span>
              {' · '}
              {isAr ? BRAND_SHARE_BASIS.ar : BRAND_SHARE_BASIS.en}
            </p>
          ) : null}
        </div>

        <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3 shadow-xs dark:border-slate-800 dark:bg-[#0b1320]">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            <Store size={16} className="text-cyan-600 dark:text-cyan-400" aria-hidden />
            <h3 className="text-sm font-black text-slate-950 dark:text-white">
              {isAr ? 'ترتيب الـ 7 فروع الفعلية' : '7 Active Branches Scorecard'}
            </h3>
          </div>
          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {branches.map((br, idx) => {
              const unavailable = typeof br.salesKwd !== 'number' || branchShares === null
              const sales = br.salesKwd ?? 0
              const share = branchShares?.[idx] ?? 0
              const selected = !br.isUnattributed && filters.branch === br.id
              const innerContent = (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      dir="ltr"
                      className="h-5 w-5 shrink-0 rounded-full bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 font-mono font-bold tabular-nums flex items-center justify-center"
                    >
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white break-words text-start">
                      {isAr ? br.ar : br.en}
                    </span>
                  </div>
                  <div
                    dir="ltr"
                    title={unavailable ? unavailableTooltip : undefined}
                    className="ds-num text-end font-mono tabular-nums shrink-0"
                  >
                    <span
                      data-scorecard-branch-sales={br.id}
                      className="font-bold text-cyan-700 dark:text-cyan-300 block"
                    >
                      {unavailable
                        ? isAr
                          ? 'غير متاح'
                          : UNAVAILABLE_DASH
                        : formatKwd(sales, resolvedLocale)}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">
                      <span data-scorecard-branch-orders={br.id}>
                        {unavailable || br.orders === null
                          ? UNAVAILABLE_DASH
                          : formatInt(br.orders, resolvedLocale)}
                      </span>
                      {' · '}
                      {unavailable ? UNAVAILABLE_DASH : formatPct(share, resolvedLocale)}
                    </span>
                  </div>
                </>
              )
              if (br.isUnattributed) {
                return (
                  <div
                    key={br.id}
                    data-scorecard-branch-row={br.id}
                    className="w-full py-2.5 flex items-center justify-between gap-2 text-xs rounded-lg px-2 bg-slate-50/70 dark:bg-slate-900/40"
                  >
                    {innerContent}
                  </div>
                )
              }
              return (
                <button
                  key={br.id}
                  type="button"
                  data-scorecard-branch-row={br.id}
                  aria-pressed={selected}
                  onClick={() => setBranch(br.id as GlobalBranch)}
                  className={`ds-focus-ring w-full py-2.5 flex items-center justify-between gap-2 text-xs rounded-lg px-2 transition ${
                    selected
                      ? 'bg-cyan-500/10 ring-1 ring-cyan-500/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
                  }`}
                >
                  {innerContent}
                </button>
              )
            })}
          </div>
        </div>

        <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3 shadow-xs dark:border-slate-800 dark:bg-[#0b1320]">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            <TrendingUp size={16} className="text-amber-600 dark:text-amber-400" aria-hidden />
            <h3 className="text-sm font-black text-slate-950 dark:text-white">
              {isAr ? 'ترتيب قنوات البيع الـ 8' : '8 Sales Channels Scorecard'}
            </h3>
          </div>
          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {channels.map((ch, idx) => {
              const unavailable = typeof ch.salesKwd !== 'number' || channelShares === null
              const sales = ch.salesKwd ?? 0
              const share = channelShares?.[idx] ?? 0
              const selected = filters.channel === ch.id
              return (
                <button
                  key={ch.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setChannel(ch.id)}
                  className={`ds-focus-ring w-full py-2.5 flex items-center justify-between gap-2 text-xs rounded-lg px-2 transition ${
                    selected
                      ? 'bg-amber-500/10 ring-1 ring-amber-500/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      dir="ltr"
                      className="h-5 w-5 shrink-0 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 font-mono font-bold tabular-nums flex items-center justify-center"
                    >
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white break-words text-start">
                      {isAr ? ch.ar : ch.en}
                    </span>
                  </div>
                  <div
                    dir="ltr"
                    title={unavailable ? unavailableTooltip : undefined}
                    className="ds-num text-end font-mono tabular-nums shrink-0"
                  >
                    <span className="font-bold text-amber-700 dark:text-amber-300 block">
                      {unavailable
                        ? isAr
                          ? 'غير متاح'
                          : UNAVAILABLE_DASH
                        : formatKwd(sales, resolvedLocale)}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">
                      {unavailable ? UNAVAILABLE_DASH : formatPct(share, resolvedLocale)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
