'use client'

import React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FileSpreadsheet,
  Landmark,
  Receipt,
  Scale,
  TrendingUp,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { accountsForPnlGroup, GlStatementsPanel } from '@/components/accounting/GlStatementsPanel'
import type { GlAccountLine } from '@/lib/odoo/gl-statements'
import { lastClosedMonthRange } from '@/lib/aether/closed-month-policy'
import { PartialWarningBanner, StateBlock } from '@/components/ui'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKuwaitDate,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
} from '@/lib/format'
import { useI18n } from '@/lib/i18n'

function NullableKwdCell({
  value,
  locale,
  className = '',
}: {
  value: number | null | undefined
  locale: 'ar' | 'en'
  className?: string
}) {
  const unavailable = typeof value !== 'number' || !Number.isFinite(value)
  const tooltip = getUnavailableTooltip(locale)
  return (
    <span
      dir="ltr"
      title={unavailable ? tooltip : undefined}
      aria-label={unavailable ? tooltip : undefined}
      data-unavailable={unavailable ? 'true' : undefined}
      className={`ds-num inline-block font-mono tabular-nums ${className}`}
    >
      {formatKwd(value, locale)}
    </span>
  )
}

function NullablePctCell({
  value,
  locale,
  className = '',
}: {
  value: number | null | undefined
  locale: 'ar' | 'en'
  className?: string
}) {
  const unavailable = typeof value !== 'number' || !Number.isFinite(value)
  const tooltip = getUnavailableTooltip(locale)
  return (
    <span
      dir="ltr"
      title={unavailable ? tooltip : undefined}
      aria-label={unavailable ? tooltip : undefined}
      data-unavailable={unavailable ? 'true' : undefined}
      className={`ds-num inline-block font-mono tabular-nums ${className}`}
    >
      {formatPct(value, locale)}
    </span>
  )
}

export function ExecutivePnlStudio() {
  const { locale } = useI18n()
  const resolvedLocale: 'ar' | 'en' = locale === 'en' ? 'en' : 'ar'
  const isAr = resolvedLocale !== 'en'
  const { workspace, liveSummary, syncingOdoo, setCustomRange } = useGlobalFilter()
  const [glLines, setGlLines] = React.useState<GlAccountLine[]>([])
  const onGlLines = React.useCallback((lines: GlAccountLine[]) => setGlLines(lines), [])
  const closedMonth = lastClosedMonthRange(workspace.accounting.glClosedThroughDate)
  const gl = workspace.accounting
  const unavailableTooltip = getUnavailableTooltip(resolvedLocale)

  const brandRows = workspace.cascadingOptions.brands.filter((b) => b.id !== 'all')
  const branchRows = workspace.cascadingOptions.branches.filter((b) => b.id !== 'all')

  const glGrossProfitKwd =
    gl.totalRevenueKwd !== null && gl.cogsKwd !== null
      ? Math.round((gl.totalRevenueKwd - gl.cogsKwd) * 1000) / 1000
      : null
  const glGrossMarginPct =
    glGrossProfitKwd !== null && gl.totalRevenueKwd && gl.totalRevenueKwd > 0
      ? Math.round((glGrossProfitKwd / gl.totalRevenueKwd) * 1000) / 10
      : null

  const lineItems = [
    {
      code: 'income',
      labelAr: 'إجمالي الإيرادات المرحلة بدفتر الأستاذ العام (account.move.line)',
      labelEn: 'Posted General Ledger Revenue (account.move.line)',
      amountKwd: gl.totalRevenueKwd,
      pctOfRev: gl.totalRevenueKwd !== null && gl.totalRevenueKwd > 0 ? 100 : null,
      tone: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      code: 'expense_direct_cost',
      labelAr: 'تكلفة البضاعة والمواد الغذائية والتعبئة الفعلية (COGS)',
      labelEn: 'Posted Cost of Goods Sold & Packaging (COGS)',
      amountKwd: gl.cogsKwd !== null ? -gl.cogsKwd : null,
      pctOfRev: gl.cogsPct,
      tone: 'text-rose-700 dark:text-rose-400',
    },
    {
      code: 'GP',
      labelAr: 'مجمل الربح التشغيلي (بعد تكلفة المواد الخام)',
      labelEn: 'Gross Profit (After Food & Packaging Cost)',
      amountKwd: glGrossProfitKwd,
      pctOfRev: glGrossMarginPct,
      tone: 'text-emerald-700 dark:text-emerald-300 font-black',
    },
    {
      code: 'platform_commission',
      labelAr: 'عمولات منصات التوصيل المرحلة (طلبات، كيتا، ديليفرو، جاهز)',
      labelEn: 'Posted Aggregator Delivery Commissions',
      amountKwd: gl.deliveryCommissionsKwd !== null ? -gl.deliveryCommissionsKwd : null,
      pctOfRev: gl.deliveryCommPct,
      tone: 'text-amber-700 dark:text-amber-400',
    },
    {
      code: 'expense',
      labelAr: 'المصروفات التشغيلية والإيجارات والرواتب والإهلاك المرحلة',
      labelEn: 'Posted Operating Expenses, Rent, Payroll & Depreciation',
      amountKwd:
        gl.otherOpexAndDepreciationKwd !== null ? -gl.otherOpexAndDepreciationKwd : null,
      pctOfRev: gl.opexRentDeprPct,
      tone: 'text-amber-700 dark:text-amber-300',
    },
    {
      code: 'OP-NET',
      labelAr: 'صافي الربح التشغيلي الفعلي (مطابق لقيود الأستاذ العام)',
      labelEn: 'Actual Operating Profit (Reconciled to Odoo General Ledger)',
      amountKwd: gl.operatingProfitKwd,
      pctOfRev: gl.netProfitPct,
      tone:
        typeof gl.operatingProfitKwd === 'number' && gl.operatingProfitKwd < 0
          ? 'text-rose-700 dark:text-rose-400 font-black'
          : 'text-emerald-700 dark:text-emerald-400 font-black',
    },
  ]

  const glFromFormatted = formatKuwaitDate(gl.from, resolvedLocale)
  const glToFormatted = formatKuwaitDate(gl.to, resolvedLocale)
  const glLinesFormatted = formatInt(gl.lineCount, resolvedLocale)

  if (syncingOdoo && !liveSummary) {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-6">
        <StateBlock
          state="loading"
          locale={resolvedLocale}
          skeletonRows={5}
          title={isAr ? 'جارٍ تحميل قائمة الدخل من الأستاذ العام…' : 'Loading General Ledger P&L…'}
        />
      </div>
    )
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-6 min-w-0">
      <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-emerald-500/25 dark:bg-[#0b1320]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <FileSpreadsheet size={14} aria-hidden />
              <span>
                {isAr
                  ? 'قائمة الدخل التنفيذية وانحراف الأستاذ العام · أودو 17'
                  : 'Executive P&L & Odoo 17 General Ledger Statement'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white break-words">
              {isAr
                ? 'قائمة الدخل الفعلية ومطابقة إيرادات نقاط البيع مع قيود الأستاذ العام'
                : 'Actual Income Statement & POS-to-GL Reconciliation'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {isAr ? workspace.subtitleAr : workspace.subtitleEn} •{' '}
              {isAr
                ? `نطاق القيود المحاسبية: ${glFromFormatted} إلى ${glToFormatted} (${glLinesFormatted} سطر قيد)`
                : `GL Window: ${glFromFormatted} to ${glToFormatted} (${glLinesFormatted} move lines)`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {closedMonth ? (
              <button
                type="button"
                onClick={() => setCustomRange(closedMonth.from, closedMonth.to)}
                className="ds-focus-ring inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300"
              >
                {isAr ? 'آخر شهر مُقفل' : 'Last closed month'}
              </button>
            ) : (
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {isAr ? 'لا يوجد تاريخ إقفال في أودو.' : 'Odoo has no lock date.'}
              </p>
            )}
            <Link
              href="/erp/finance"
              className="ds-focus-ring inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 hover:border-emerald-500/40 hover:bg-white transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-white"
            >
              <Landmark size={14} aria-hidden />
              <span>{isAr ? 'المركز المالي الشامل' : 'Full Finance Hub'}</span>
              <ArrowUpRight size={13} aria-hidden />
            </Link>
            <Link
              href="/erp/receivables"
              className="ds-focus-ring inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-500/20 transition dark:text-emerald-300"
            >
              <Receipt size={14} aria-hidden />
              <span>{isAr ? 'الذمم المدينة المفتوحة' : 'Open receivables'}</span>
              <ArrowUpRight size={13} aria-hidden />
            </Link>
          </div>
        </div>

        {!gl.available && workspace.odooConnected && !workspace.noData && (
          <div
            role="status"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-300/70 bg-amber-50/90 p-3.5 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden />
            <div>
              <span className="font-bold block">
                {isAr
                  ? 'تنبيه محاسبي: إقفال المصروفات الشهرية غير مكتمل لهذه الفترة القصيرة'
                  : 'Accounting Notice: Month-end accruals are not posted for this short window'}
              </span>
              <span className="text-amber-800 dark:text-amber-300/90">
                {isAr ? gl.unavailableReasonAr : gl.unavailableReasonEn}
              </span>
            </div>
          </div>
        )}
      </div>

      <PartialWarningBanner summary={liveSummary} isAr={isAr} />

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
                ? 'لا توجد قيود مالية في هذه الفترة'
                : 'No financial entries for this period'
          }
          description={isAr ? gl.unavailableReasonAr : gl.unavailableReasonEn}
        />
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'صافي مبيعات نقاط البيع (POS)' : 'POS Net Sales (pos.order)'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">
            <NullableKwdCell value={workspace.nullableSalesKwd} locale={resolvedLocale} />
          </div>
          <span
            dir="ltr"
            title={workspace.nullableOrders === null ? unavailableTooltip : undefined}
            className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold block tabular-nums"
          >
            {workspace.nullableOrders === null
              ? isAr
                ? 'غير متاح'
                : UNAVAILABLE_DASH
              : `${formatInt(workspace.nullableOrders, resolvedLocale)} ${isAr ? 'طلب مقبوض' : 'settled orders'}`}
          </span>
        </div>

        <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'إيرادات الأستاذ العام (GL)' : 'GL Posted Revenue'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400">
            <NullableKwdCell value={gl.totalRevenueKwd} locale={resolvedLocale} />
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-400 block">
            {isAr ? 'من واقع account.move.line' : 'Source: account.move.line'}
          </span>
        </div>

        <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'تكلفة البضاعة الفعلية (COGS)' : 'Actual GL COGS'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-400">
            <NullableKwdCell value={gl.cogsKwd} locale={resolvedLocale} />
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-400 block">
            {isAr ? 'النسبة من الإيراد: ' : '% of Revenue: '}
            <NullablePctCell value={gl.cogsPct} locale={resolvedLocale} />
          </span>
        </div>

        <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'صافي الربح التشغيلي (GL)' : 'GL Operating Profit'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300">
            <NullableKwdCell value={gl.operatingProfitKwd} locale={resolvedLocale} />
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-400 block">
            {isAr ? 'هامش التشغيل: ' : 'Operating Margin: '}
            <NullablePctCell value={gl.netProfitPct} locale={resolvedLocale} />
          </span>
          {gl.netProfitWithheld ? (
            <span
              data-net-profit-withheld="true"
              className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              {isAr ? gl.netProfitWithheldReasonAr : gl.netProfitWithheldReasonEn}
            </span>
          ) : null}
        </div>
      </div>

      <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4 dark:border-slate-800 dark:bg-[#0b1320]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-emerald-600 dark:text-emerald-400" aria-hidden />
            <h3 className="text-base font-black text-slate-950 dark:text-white">
              {isAr
                ? 'جدول قائمة الدخل المحاسبية التفصيلية (فنتشر فودز ذ.م.م.)'
                : 'Detailed General Ledger Income Statement (Venture Foods W.L.L.)'}
            </h3>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={12} aria-hidden />
            {isAr ? 'حساب ديناميكي من أودو' : 'Dynamic Odoo GL'}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[600px] text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 dark:bg-slate-900/90 dark:text-slate-300 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 text-start font-bold">{isAr ? 'رمز الحساب' : 'GL Code'}</th>
                <th className="py-3 px-4 text-start font-bold">{isAr ? 'البند المحاسبي' : 'Statement Line'}</th>
                <th className="py-3 px-4 text-end font-bold">{isAr ? 'المبلغ (د.ك)' : 'Amount (KWD)'}</th>
                <th className="py-3 px-4 text-end font-bold">{isAr ? 'النسبة من الإيراد' : '% of Revenue'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/70">
              {lineItems.map((item) => (
                <React.Fragment key={item.code}>
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition">
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400" dir="ltr">
                    {item.code}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                    {isAr ? item.labelAr : item.labelEn}
                  </td>
                  <td className={`py-3 px-4 text-end font-bold ${item.tone}`} dir="ltr">
                    {item.code === 'OP-NET' && gl.netProfitWithheld ? (
                      <span>
                        {isAr ? gl.netProfitWithheldReasonAr : gl.netProfitWithheldReasonEn}
                      </span>
                    ) : item.amountKwd === null ? (
                      <span>
                        {isAr
                          ? 'لم يُرحَّل بعد في أودو لهذه الفترة'
                          : 'Not yet posted in Odoo for this period'}
                      </span>
                    ) : (
                      <NullableKwdCell value={item.amountKwd} locale={resolvedLocale} />
                    )}
                  </td>
                  <td className="py-3 px-4 text-end text-slate-700 dark:text-slate-300" dir="ltr">
                    <NullablePctCell value={item.pctOfRev} locale={resolvedLocale} />
                  </td>
                </tr>
                {accountsForPnlGroup(
                  glLines,
                  item.code,
                  gl.commissionAccounts.map((account) => account.code),
                ).map((account) => (
                  <tr key={`${item.code}-${account.code}`}>
                    <td className="py-1.5 px-4 font-mono text-slate-500" dir="ltr">{account.code}</td>
                    <td className="py-1.5 px-4 text-slate-600 dark:text-slate-300">{account.name}</td>
                    <td className="py-1.5 px-4 text-end" dir="ltr">
                      <NullableKwdCell
                        value={
                          item.code === 'income' ||
                          item.code === 'expense_direct_cost' ||
                          item.code === 'platform_commission' ||
                          item.code === 'expense'
                            ? -account.balance
                            : account.balance
                        }
                        locale={resolvedLocale}
                      />
                    </td>
                    <td />
                  </tr>
                ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <GlStatementsPanel from={gl.from} to={gl.to} isAr={isAr} onLines={onGlLines} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3 shadow-xs dark:border-slate-800 dark:bg-[#0b1320]">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
            <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" aria-hidden />
            <h3 className="text-sm font-black text-slate-950 dark:text-white">
              {isAr ? 'مساهمة الـ 6 علامات تجارية في الإيرادات' : 'Revenue Contribution Across 6 Brands'}
            </h3>
          </div>
          <div className="space-y-2.5">
            {brandRows.map((b) => {
              const totalNet = workspace.nullableSalesKwd
              const unavailable = typeof b.salesKwd !== 'number' || totalNet === null
              const sales = b.salesKwd ?? 0
              const share =
                !unavailable && totalNet !== null && totalNet > 0
                  ? Math.min(100, (sales / totalNet) * 100)
                  : 0
              const brandLabel = isAr ? b.ar : b.en
              return (
                <div key={b.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-900 dark:text-slate-200">{brandLabel}</span>
                    {unavailable ? (
                      <span
                        dir="ltr"
                        title={unavailableTooltip}
                        aria-label={unavailableTooltip}
                        data-unavailable="true"
                        className="font-mono font-bold text-slate-500 dark:text-slate-400"
                      >
                        {isAr ? 'غير متاح' : UNAVAILABLE_DASH}
                      </span>
                    ) : (
                      <span dir="ltr" className="ds-num font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatKwd(sales, resolvedLocale)} ({formatPct(share, resolvedLocale)})
                      </span>
                    )}
                  </div>
                  <div
                    role="progressbar"
                    aria-label={brandLabel}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={unavailable ? undefined : Math.round(share)}
                    className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
                  >
                    {!unavailable ? (
                      <div
                        className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500"
                        style={{ width: `${Math.max(2, share)}%` }}
                      />
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3 shadow-xs dark:border-slate-800 dark:bg-[#0b1320]">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
            <Landmark size={16} className="text-cyan-600 dark:text-cyan-400" aria-hidden />
            <h3 className="text-sm font-black text-slate-950 dark:text-white">
              {isAr ? 'مساهمة الـ 7 فروع الفعلية في الإيرادات' : 'Revenue Contribution Across 7 Active Branches'}
            </h3>
          </div>
          <div className="space-y-2.5">
            {branchRows.map((br) => {
              const totalNet = workspace.nullableSalesKwd
              const unavailable = typeof br.salesKwd !== 'number' || totalNet === null
              const sales = br.salesKwd ?? 0
              const share =
                !unavailable && totalNet !== null && totalNet > 0
                  ? Math.min(100, (sales / totalNet) * 100)
                  : 0
              const branchLabel = isAr ? br.ar : br.en
              return (
                <div key={br.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-900 dark:text-slate-200">{branchLabel}</span>
                    {unavailable ? (
                      <span
                        dir="ltr"
                        title={unavailableTooltip}
                        aria-label={unavailableTooltip}
                        data-unavailable="true"
                        className="font-mono font-bold text-slate-500 dark:text-slate-400"
                      >
                        {isAr ? 'غير متاح' : UNAVAILABLE_DASH}
                      </span>
                    ) : (
                      <span dir="ltr" className="ds-num font-mono font-bold tabular-nums text-cyan-700 dark:text-cyan-300">
                        {formatKwd(sales, resolvedLocale)} ({formatPct(share, resolvedLocale)})
                      </span>
                    )}
                  </div>
                  <div
                    role="progressbar"
                    aria-label={branchLabel}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={unavailable ? undefined : Math.round(share)}
                    className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
                  >
                    {!unavailable ? (
                      <div
                        className="h-full rounded-full bg-cyan-600 dark:bg-cyan-500"
                        style={{ width: `${Math.max(2, share)}%` }}
                      />
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
