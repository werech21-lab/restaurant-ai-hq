'use client'

import { BRAND_SHARE_BASIS, normalizeSharesTo100, sumShares } from '@/lib/aether/share-normalization'
import React from 'react'
import Link from 'next/link'
import { Award, ArrowUpRight, BarChart3, Store, Tag, TrendingUp } from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { StateBlock } from '@/components/ui'
import { computePeriodOverPeriodDeltaPct, formatSignedDelta } from '@/lib/aether/global-filter-engine'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
} from '@/lib/format'
import { useI18n } from '@/lib/i18n'

function resolveScorecardGridCols(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 sm:grid-cols-2'
  if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
  return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
}

export function SalesScorecardStudio() {
  const { locale } = useI18n()
  const resolvedLocale: 'ar' | 'en' = locale === 'en' ? 'en' : 'ar'
  const isAr = resolvedLocale !== 'en'
  const { filters, workspace, liveSummary, syncingOdoo, setBrand, setBranch, setChannel } =
    useGlobalFilter()
  const unavailableTooltip = getUnavailableTooltip(resolvedLocale)

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
  const branches = sortOptions(workspace.cascadingOptions.branches.filter((b) => b.id !== 'all'))
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
    workspace.nullableSalesKwd !== null &&
    brands.some((b) => typeof b.salesKwd === 'number' && b.salesKwd > 0)

  if (syncingOdoo && !liveSummary) {
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

  const kpiCards: { key: string; node: React.ReactNode }[] = []

  if (workspace.nullableSalesKwd !== null) {
    kpiCards.push({
      key: 'net-sales',
      node: (
        <div className="ds-surface relative overflow-visible rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'صافي المبيعات الإجمالي' : 'Total Net Sales'}
          </span>
          <div
            dir="ltr"
            className="ds-num mt-1 text-2xl font-black font-mono tabular-nums text-slate-950 dark:text-white"
          >
            {formatKwd(workspace.nullableSalesKwd, resolvedLocale)}
          </div>
          {deltaPct !== null ? (
            <span
              className={`mt-1 inline-block text-xs font-bold tabular-nums ${
                deltaBadge.tone === 'emerald'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : deltaBadge.tone === 'rose'
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-slate-600 dark:text-slate-400'
              }`}
              dir="ltr"
            >
              {formatPct(deltaPct, { locale: resolvedLocale, signed: true })}
            </span>
          ) : null}
        </div>
      ),
    })
  }

  if (workspace.nullableOrders !== null) {
    kpiCards.push({
      key: 'settled-orders',
      node: (
        <div className="ds-surface relative overflow-visible rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'عدد الطلبات المقبوضة' : 'Settled Orders'}
          </span>
          <div
            dir="ltr"
            className="ds-num mt-1 text-2xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400"
          >
            {formatInt(workspace.nullableOrders, resolvedLocale)}
          </div>
          <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
            {isAr
              ? `خلال ${formatInt(workspace.periodDays, resolvedLocale)} يوم`
              : `Across ${formatInt(workspace.periodDays, resolvedLocale)} days`}
          </span>
        </div>
      ),
    })
  }

  if (workspace.nullableAovKwd !== null) {
    kpiCards.push({
      key: 'aov',
      node: (
        <div className="ds-surface relative overflow-visible rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'متوسط قيمة الفاتورة (AOV)' : 'Average Order Value (AOV)'}
          </span>
          <div
            dir="ltr"
            className="ds-num mt-1 text-2xl font-black font-mono tabular-nums text-[#1E40AF] dark:text-sky-300"
          >
            {formatKwd(workspace.nullableAovKwd, resolvedLocale)}
          </div>
          <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
            {isAr ? 'متوسط السلة الفعلي في أودو' : 'Actual Odoo POS basket'}
          </span>
        </div>
      ),
    })
  }

  if (hasBrandSales && brands[0] && typeof brands[0].salesKwd === 'number') {
    kpiCards.push({
      key: 'top-brand',
      node: (
        <div className="ds-surface relative overflow-visible rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'العلامة المتصدرة' : 'Top Performing Brand'}
          </span>
          <div className="mt-1 text-xl font-black text-slate-950 dark:text-white break-words">
            {isAr ? brands[0].ar : brands[0].en}
          </div>
          <span
            dir="ltr"
            className="ds-num mt-1 block text-xs text-emerald-700 dark:text-emerald-400 font-mono font-bold tabular-nums"
          >
            {formatKwd(brands[0].salesKwd, resolvedLocale)}
          </span>
        </div>
      ),
    })
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
            className="ds-focus-ring inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-500/20 transition dark:text-emerald-300"
          >
            <BarChart3 size={14} className="shrink-0" aria-hidden />
            <span>{isAr ? 'فتح التحليل التفصيلي للمبيعات' : 'Detailed Sales Analysis'}</span>
            <ArrowUpRight size={13} className="shrink-0" aria-hidden />
          </Link>
        </div>
      </div>

      {!workspace.odooConnected || workspace.noData ? (
        <StateBlock
          state={!workspace.odooConnected ? 'unlinked' : 'empty'}
          locale={resolvedLocale}
          title={
            !workspace.odooConnected
              ? isAr
                ? 'الاتصال المباشر مع Odoo غير متاح حالياً'
                : 'Odoo live connection is unavailable'
              : isAr
                ? 'لا توجد بيانات مبيعات لهذه الفترة'
                : 'No sales data for this period'
          }
        />
      ) : (
        <>
          {kpiCards.length > 0 ? (
            <div className={`grid gap-3.5 ${resolveScorecardGridCols(kpiCards.length)}`}>
              {kpiCards.map((item) => (
                <React.Fragment key={item.key}>{item.node}</React.Fragment>
              ))}
            </div>
          ) : null}

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
                        <span className="min-w-0 truncate font-bold text-slate-900 dark:text-white text-start">
                          {isAr ? b.ar : b.en}
                        </span>
                      </div>
                      <div
                        dir="ltr"
                        title={unavailable ? unavailableTooltip : undefined}
                        className="ds-num shrink-0 whitespace-nowrap text-end font-mono tabular-nums"
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
                <Store size={16} className="text-[#0F766E] dark:text-[#5EEAD4]" aria-hidden />
                <h3 className="text-sm font-black text-slate-950 dark:text-white">
                  {isAr ? 'ترتيب الـ 7 فروع الفعلية' : '7 Active Branches Scorecard'}
                </h3>
              </div>
              <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {branches.map((br, idx) => {
                  const unavailable = typeof br.salesKwd !== 'number' || branchShares === null
                  const sales = br.salesKwd ?? 0
                  const share = branchShares?.[idx] ?? 0
                  const selected = filters.branch === br.id
                  return (
                    <button
                      key={br.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setBranch(br.id)}
                      className={`ds-focus-ring w-full py-2.5 flex items-center justify-between gap-2 text-xs rounded-lg px-2 transition ${
                        selected
                          ? 'bg-cyan-500/10 ring-1 ring-cyan-500/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          dir="ltr"
                          className="h-5 w-5 shrink-0 rounded-full bg-teal-500/15 text-teal-800 dark:text-[#5EEAD4] font-mono font-bold tabular-nums flex items-center justify-center"
                        >
                          {idx + 1}
                        </span>
                        <span className="ae-branch-name min-w-0 truncate font-bold text-[#0F766E] dark:text-[#5EEAD4] text-start">
                          {isAr ? br.ar : br.en}
                        </span>
                      </div>
                      <div
                        dir="ltr"
                        title={unavailable ? unavailableTooltip : undefined}
                        className="ds-num shrink-0 whitespace-nowrap text-end font-mono tabular-nums"
                      >
                        <span className="font-bold text-[#0F766E] dark:text-[#5EEAD4] block">
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

            <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3 shadow-xs dark:border-slate-800 dark:bg-[#0b1320]">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                <TrendingUp size={16} className="text-[#1E40AF] dark:text-sky-300" aria-hidden />
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
                          ? 'bg-sky-500/10 ring-1 ring-sky-500/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          dir="ltr"
                          className="h-5 w-5 shrink-0 rounded-full bg-[#1E40AF]/10 text-[#1E40AF] dark:bg-sky-400/15 dark:text-sky-300 font-mono font-bold tabular-nums flex items-center justify-center"
                        >
                          {idx + 1}
                        </span>
                        <span className="min-w-0 truncate font-bold text-slate-900 dark:text-white text-start">
                          {isAr ? ch.ar : ch.en}
                        </span>
                      </div>
                      <div
                        dir="ltr"
                        title={unavailable ? unavailableTooltip : undefined}
                        className="ds-num shrink-0 whitespace-nowrap text-end font-mono tabular-nums"
                      >
                        <span className="font-bold text-[#1E40AF] dark:text-sky-300 block">
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
        </>
      )}
    </div>
  )
}
