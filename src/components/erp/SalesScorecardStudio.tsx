'use client'

import React from 'react'
import Link from 'next/link'
import { Award, ArrowUpRight, BarChart3, Store, Tag, TrendingUp } from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { OdooPartialWarningBanner } from '@/components/erp/OdooPartialWarningBanner'
import { computePeriodOverPeriodDeltaPct, formatSignedDelta } from '@/lib/aether/global-filter-engine'
import { useI18n } from '@/lib/i18n'

export function SalesScorecardStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const { filters, workspace, liveSummary, setBrand, setBranch, setChannel } = useGlobalFilter()

  const deltaPct = computePeriodOverPeriodDeltaPct(filters, workspace, liveSummary)
  const deltaBadge = formatSignedDelta(deltaPct)

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
  const hasBrandSales =
    workspace.nullableSalesKwd !== null && brands.some((b) => typeof b.salesKwd === 'number')

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-6">
      <div className="rounded-2xl border border-emerald-500/25 bg-[#0b1320] p-5 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
              <Award size={14} />
              <span>
                {isAr
                  ? 'بطاقة الأداء القياسية للمبيعات · 6 علامات تجارية × 7 فروع × 8 قنوات'
                  : 'Enterprise Sales Scorecard · 6 Brands × 7 Branches × 8 Channels'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {isAr
                ? 'سجل وترتيب أداء المبيعات الفعلي حسب العلامة التجارية والفرع والقناة'
                : 'Odoo 17 Sales Ranking & Scorecard by Brand, Branch & Channel'}
            </h2>
            <p className="text-xs text-slate-400">
              {isAr ? workspace.subtitleAr : workspace.subtitleEn}
            </p>
          </div>
          <Link
            href="/erp/sales-analysis"
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition"
          >
            <BarChart3 size={14} />
            <span>{isAr ? 'فتح التحليل التفصيلي للمبيعات' : 'Detailed Sales Analysis'}</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>

      <OdooPartialWarningBanner summary={liveSummary} isAr={isAr} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-800 bg-[#0d1524] p-4">
          <span className="text-xs font-bold text-slate-400">
            {isAr ? 'صافي المبيعات الإجمالي' : 'Total Net Sales'}
          </span>
          <div className="mt-1 text-2xl font-black font-mono text-white">
            {workspace.nullableSalesKwd === null
              ? isAr
                ? 'غير متاح'
                : '—'
              : `${Math.round(workspace.nullableSalesKwd).toLocaleString('en-US')} ${isAr ? 'د.ك' : 'KWD'}`}
          </div>
          <span
            className={`mt-1 inline-block text-xs font-bold ${
              deltaBadge.tone === 'emerald'
                ? 'text-emerald-400'
                : deltaBadge.tone === 'rose'
                  ? 'text-rose-400'
                  : 'text-slate-400'
            }`}
            dir="ltr"
          >
            {workspace.nullableSalesKwd === null ? '—' : deltaBadge.text}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d1524] p-4">
          <span className="text-xs font-bold text-slate-400">
            {isAr ? 'عدد الطلبات المقبوضة' : 'Settled Orders'}
          </span>
          <div className="mt-1 text-2xl font-black font-mono text-emerald-400">
            {workspace.nullableOrders === null
              ? isAr
                ? 'غير متاح'
                : '—'
              : workspace.nullableOrders.toLocaleString('en-US')}
          </div>
          <span className="mt-1 block text-xs text-slate-400">
            {isAr ? `خلال ${workspace.periodDays} يوم` : `Across ${workspace.periodDays} days`}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d1524] p-4">
          <span className="text-xs font-bold text-slate-400">
            {isAr ? 'متوسط قيمة الفاتورة (AOV)' : 'Average Order Value (AOV)'}
          </span>
          <div className="mt-1 text-2xl font-black font-mono text-amber-300">
            {workspace.nullableAovKwd === null
              ? isAr
                ? 'غير متاح'
                : '—'
              : `${workspace.nullableAovKwd.toFixed(3)} ${isAr ? 'د.ك' : 'KWD'}`}
          </div>
          <span className="mt-1 block text-xs text-slate-400">
            {isAr ? 'متوسط السلة الفعلي في أودو' : 'Actual Odoo POS basket'}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d1524] p-4">
          <span className="text-xs font-bold text-slate-400">
            {isAr ? 'العلامة المتصدرة' : 'Top Performing Brand'}
          </span>
          <div className="mt-1 text-xl font-black text-white truncate">
            {hasBrandSales && brands[0]
              ? isAr
                ? brands[0].ar
                : brands[0].en
              : isAr
                ? 'غير متاح'
                : '—'}
          </div>
          <span className="mt-1 block text-xs text-emerald-400 font-mono font-bold">
            {hasBrandSales && typeof brands[0]?.salesKwd === 'number'
              ? `${brands[0].salesKwd.toLocaleString('en-US')} ${isAr ? 'د.ك' : 'KWD'}`
              : isAr
                ? 'غير متاح'
                : '—'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-[#0b1320] p-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Tag size={16} className="text-emerald-400" />
            <h3 className="text-sm font-black text-white">
              {isAr ? 'ترتيب الـ 6 علامات تجارية' : '6 Brands Scorecard'}
            </h3>
          </div>
          <div className="divide-y divide-slate-800/70">
            {brands.map((b, idx) => {
              const totalNet = workspace.nullableSalesKwd
              const unavailable = typeof b.salesKwd !== 'number' || totalNet === null
              const sales = b.salesKwd ?? 0
              const share =
                !unavailable && totalNet !== null && totalNet > 0
                  ? (sales / totalNet) * 100
                  : 0
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBrand(b.id)}
                  className="w-full py-2.5 flex items-center justify-between text-xs hover:bg-slate-900/60 rounded-lg px-2 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-white">{isAr ? b.ar : b.en}</span>
                  </div>
                  <div className="text-end font-mono">
                    <span className="font-bold text-emerald-400 block">
                      {unavailable
                        ? isAr
                          ? 'غير متاح'
                          : '—'
                        : `${sales.toLocaleString('en-US')} ${isAr ? 'د.ك' : 'KWD'}`}
                    </span>
                    <span className="text-slate-400">
                      {unavailable ? '—' : `${share.toFixed(1)}%`}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0b1320] p-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Store size={16} className="text-cyan-400" />
            <h3 className="text-sm font-black text-white">
              {isAr ? 'ترتيب الـ 7 فروع الفعلية' : '7 Active Branches Scorecard'}
            </h3>
          </div>
          <div className="divide-y divide-slate-800/70">
            {branches.map((br, idx) => {
              const totalNet = workspace.nullableSalesKwd
              const unavailable = typeof br.salesKwd !== 'number' || totalNet === null
              const sales = br.salesKwd ?? 0
              const share =
                !unavailable && totalNet !== null && totalNet > 0
                  ? (sales / totalNet) * 100
                  : 0
              return (
                <button
                  key={br.id}
                  type="button"
                  onClick={() => setBranch(br.id)}
                  className="w-full py-2.5 flex items-center justify-between text-xs hover:bg-slate-900/60 rounded-lg px-2 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-cyan-500/15 text-cyan-300 font-mono font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-white">{isAr ? br.ar : br.en}</span>
                  </div>
                  <div className="text-end font-mono">
                    <span className="font-bold text-cyan-300 block">
                      {unavailable
                        ? isAr
                          ? 'غير متاح'
                          : '—'
                        : `${sales.toLocaleString('en-US')} ${isAr ? 'د.ك' : 'KWD'}`}
                    </span>
                    <span className="text-slate-400">
                      {unavailable ? '—' : `${share.toFixed(1)}%`}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0b1320] p-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <TrendingUp size={16} className="text-amber-400" />
            <h3 className="text-sm font-black text-white">
              {isAr ? 'ترتيب قنوات البيع الـ 8' : '8 Sales Channels Scorecard'}
            </h3>
          </div>
          <div className="divide-y divide-slate-800/70">
            {channels.map((ch, idx) => {
              const totalNet = workspace.nullableSalesKwd
              const unavailable = typeof ch.salesKwd !== 'number' || totalNet === null
              const sales = ch.salesKwd ?? 0
              const share =
                !unavailable && totalNet !== null && totalNet > 0
                  ? (sales / totalNet) * 100
                  : 0
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setChannel(ch.id)}
                  className="w-full py-2.5 flex items-center justify-between text-xs hover:bg-slate-900/60 rounded-lg px-2 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-amber-500/15 text-amber-300 font-mono font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-white">{isAr ? ch.ar : ch.en}</span>
                  </div>
                  <div className="text-end font-mono">
                    <span className="font-bold text-amber-300 block">
                      {unavailable
                        ? isAr
                          ? 'غير متاح'
                          : '—'
                        : `${sales.toLocaleString('en-US')} ${isAr ? 'د.ك' : 'KWD'}`}
                    </span>
                    <span className="text-slate-400">
                      {unavailable ? '—' : `${share.toFixed(1)}%`}
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
