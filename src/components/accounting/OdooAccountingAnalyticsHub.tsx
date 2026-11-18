'use client'

import React from 'react'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  GitCompareArrows,
  Landmark,
  Layers,
  Receipt,
  Scale,
  TrendingUp,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import KpiProvenanceBadge from '@/components/erp/KpiProvenanceBadge'
import { StateBlock } from '@/components/ui'
import { ReceivablesPendingStatus } from '@/components/ui/receivables-pending-status'
import {
  RECEIVABLES_PENDING_DETAIL,
  canShowReceivableAmounts,
} from '@/lib/aether/receivables-status'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKuwaitDate,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
} from '@/lib/format'
import type {
  GlBalanceSheetSummary,
  GlStatementAccountLine,
  GlTrialBalanceSummary,
} from '@/lib/odoo/live-sync-core'
import {
  PLATFORM_EXPENSE_CLASSES,
  PLATFORM_EXPENSE_CLASS_LABELS,
  type PlatformExpenseClass,
} from '@/lib/odoo/platform-expense-accounts'

export interface OdooAccountingAnalyticsHubProps {
  isAr: boolean
  locale: string
  isAuditor?: boolean
}

function GlKwdValue({
  value,
  locale,
  signed = false,
  className = '',
}: {
  value: number | null | undefined
  locale: 'ar' | 'en'
  signed?: boolean
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
      className={`ds-num inline-block tabular-nums ${className}`}
    >
      {formatKwd(value, { locale, signed })}
    </span>
  )
}

function BalanceSheetGroupDetails({
  title,
  totalKwd,
  accounts,
  isAr,
  locale,
}: {
  title: string
  totalKwd: number
  accounts: readonly GlStatementAccountLine[]
  isAr: boolean
  locale: 'ar' | 'en'
}) {
  return (
    <details className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
        <span className="inline-flex items-center gap-1.5">
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden />
          <span>{title}</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
            {formatInt(accounts.length, locale)}
          </span>
        </span>
        <GlKwdValue value={totalKwd} locale={locale} className="font-mono font-extrabold" />
      </summary>
      {accounts.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {isAr ? 'لا توجد حسابات مرحلة في هذه المجموعة' : 'No posted accounts in this group'}
        </p>
      ) : (
        <ul className="mt-2.5 space-y-1 border-t border-slate-200/80 pt-2 text-xs dark:border-slate-800">
          {accounts.map((acc) => (
            <li
              key={`${acc.accountId ?? acc.code}-${acc.name}`}
              className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-300"
            >
              <span className="min-w-0 truncate">
                <span dir="ltr" className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                  {acc.code}
                </span>{' '}
                {acc.name}
              </span>
              <GlKwdValue value={acc.amountKwd} locale={locale} className="shrink-0 font-mono font-semibold" />
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}

function TrialBalancePanel({
  tb,
  isAr,
  locale,
}: {
  tb: GlTrialBalanceSummary
  isAr: boolean
  locale: 'ar' | 'en'
}) {
  if (!tb.readable) {
    return (
      <article className="ds-surface rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {isAr ? 'ملخص ميزان المراجعة (Trial Balance)' : 'GL Trial Balance Summary'}
          </h3>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'غير متاح في هذه الصلاحية' : 'Unavailable for current access'}
          </span>
        </div>
      </article>
    )
  }

  return (
    <article className="ds-surface space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {isAr ? 'ملخص ميزان المراجعة (Odoo GL)' : 'GL Trial Balance Summary'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span dir="ltr" className="font-mono">
              {tb.from} → {tb.to}
            </span>{' '}
            · {formatInt(tb.accountsCount, locale)} {isAr ? 'حساباً' : 'accounts'} ·{' '}
            {formatInt(tb.linesCount, locale)} {isAr ? 'سطراً' : 'lines'}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
            tb.balanced
              ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'bg-amber-50 text-amber-800 ring-1 ring-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          {tb.balanced
            ? isAr
              ? 'ميزان متوازن'
              : 'Balanced'
            : isAr
              ? `فرق: ${formatKwd(tb.differenceKwd, locale)}`
              : `Diff: ${formatKwd(tb.differenceKwd, locale)}`}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'إجمالي المدين' : 'Total Debit'}
          </p>
          <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">
            <GlKwdValue value={tb.totalDebitKwd} locale={locale} />
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'إجمالي الدائن' : 'Total Credit'}
          </p>
          <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">
            <GlKwdValue value={tb.totalCreditKwd} locale={locale} />
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'الفرق (مدين − دائن)' : 'Difference (Dr − Cr)'}
          </p>
          <p className="mt-1 text-base font-extrabold text-emerald-700 dark:text-emerald-300">
            <GlKwdValue value={tb.differenceKwd} locale={locale} signed />
          </p>
        </div>
      </div>

      {tb.rows.length > 0 ? (
        <details className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/30">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <span className="inline-flex items-center gap-1.5">
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              {isAr ? 'عرض حسابات ميزان المراجعة' : 'Inspect Trial Balance Accounts'}
            </span>
            <span className="font-mono text-xs text-slate-500">
              {formatInt(tb.rows.length, locale)}
            </span>
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[540px] text-xs">
              <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="py-2 pe-3 text-start">{isAr ? 'الرمز' : 'Code'}</th>
                  <th className="py-2 pe-3 text-start">{isAr ? 'الحساب' : 'Account'}</th>
                  <th className="py-2 px-3 text-end">{isAr ? 'مدين' : 'Debit'}</th>
                  <th className="py-2 px-3 text-end">{isAr ? 'دائن' : 'Credit'}</th>
                  <th className="py-2 ps-3 text-end">{isAr ? 'الرصيد' : 'Balance'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {tb.rows.map((row) => (
                  <tr key={`${row.accountId ?? row.code}-${row.name}`}>
                    <td dir="ltr" className="py-1.5 pe-3 font-mono font-bold text-slate-600 dark:text-slate-300">
                      {row.code}
                    </td>
                    <td className="py-1.5 pe-3 font-medium text-slate-900 dark:text-slate-100">
                      {row.name}
                    </td>
                    <td className="py-1.5 px-3 text-end font-mono">
                      <GlKwdValue value={row.debitKwd} locale={locale} />
                    </td>
                    <td className="py-1.5 px-3 text-end font-mono">
                      <GlKwdValue value={row.creditKwd} locale={locale} />
                    </td>
                    <td className="py-1.5 ps-3 text-end font-mono font-semibold">
                      <GlKwdValue value={row.balanceKwd} locale={locale} signed />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </article>
  )
}

function BalanceSheetPanel({
  bs,
  isAr,
  locale,
}: {
  bs: GlBalanceSheetSummary
  isAr: boolean
  locale: 'ar' | 'en'
}) {
  if (!bs.readable) {
    return (
      <article className="ds-surface rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {isAr ? 'ملخص المركز المالي (الميزانية العمومية)' : 'Balance Sheet Summary'}
          </h3>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'غير متاح في هذه الصلاحية' : 'Unavailable for current access'}
          </span>
        </div>
      </article>
    )
  }

  return (
    <article className="ds-surface space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {isAr ? 'ملخص الميزانية العمومية (Odoo GL)' : 'GL Balance Sheet Summary'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? `كما في ${formatKuwaitDate(bs.asOfDate, locale)} · بداية السنة المالية: ${formatKuwaitDate(bs.fiscalYearStart, locale)}`
              : `As of ${formatKuwaitDate(bs.asOfDate, locale)} · FY start: ${formatKuwaitDate(bs.fiscalYearStart, locale)}`}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
            bs.equationBalanced
              ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'bg-amber-50 text-amber-800 ring-1 ring-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          {bs.equationBalanced
            ? isAr
              ? 'الأصول = الالتزامات + حقوق الملكية'
              : 'Assets = Liabilities + Equity'
            : isAr
              ? `فرق المعادلة: ${formatKwd(bs.differenceKwd, locale)}`
              : `Equation diff: ${formatKwd(bs.differenceKwd, locale)}`}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'إجمالي الأصول' : 'Total Assets'}
          </p>
          <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">
            <GlKwdValue value={bs.assetsTotalKwd} locale={locale} />
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'إجمالي الالتزامات' : 'Total Liabilities'}
          </p>
          <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">
            <GlKwdValue value={bs.liabilitiesTotalKwd} locale={locale} />
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'حقوق الملكية (تشمل أرباح العام)' : 'Total Equity (incl. YTD Earnings)'}
          </p>
          <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">
            <GlKwdValue value={bs.equityTotalKwd} locale={locale} />
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {isAr ? 'أرباح العام الجاري: ' : 'Current-year earnings: '}
            <GlKwdValue value={bs.currentYearEarningsKwd} locale={locale} signed />
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'الالتزامات + حقوق الملكية' : 'Liabilities + Equity'}
          </p>
          <p className="mt-1 text-base font-extrabold text-emerald-700 dark:text-emerald-300">
            <GlKwdValue value={bs.liabilitiesAndEquityTotalKwd} locale={locale} />
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
        <BalanceSheetGroupDetails
          title={isAr ? 'حسابات الأصول' : 'Asset Accounts'}
          totalKwd={bs.assetsTotalKwd}
          accounts={bs.assetsAccounts}
          isAr={isAr}
          locale={locale}
        />
        <BalanceSheetGroupDetails
          title={isAr ? 'حسابات الالتزامات' : 'Liability Accounts'}
          totalKwd={bs.liabilitiesTotalKwd}
          accounts={bs.liabilitiesAccounts}
          isAr={isAr}
          locale={locale}
        />
        <BalanceSheetGroupDetails
          title={isAr ? 'حسابات حقوق الملكية' : 'Equity Accounts'}
          totalKwd={bs.equityTotalKwd}
          accounts={bs.equityAccounts}
          isAr={isAr}
          locale={locale}
        />
      </div>
    </article>
  )
}

/**
 * Odoo General Ledger & Finance Analytics Hub (`/erp/finance` `glSummary` tab).
 * Displays partial/incomplete posting banners inline without blanking posted lines, plus
 * 7-bucket platform expense breakdown, POS vs GL gap explanation, Trial Balance & Balance Sheet.
 */
export function OdooAccountingAnalyticsHub({
  isAr,
  isAuditor = false,
}: OdooAccountingAnalyticsHubProps) {
  const resolvedLocale: 'ar' | 'en' = isAr ? 'ar' : 'en'
  const { workspace } = useGlobalFilter()
  const acc = workspace.accounting
  const rec = workspace.receivables
  const unavailableTooltip = getUnavailableTooltip(resolvedLocale)
  const amountsVisible = canShowReceivableAmounts(rec)

  if (!workspace.odooConnected || workspace.noData || !acc.available) {
    return (
      <StateBlock
        state={!workspace.odooConnected ? 'unlinked' : 'empty'}
        locale={resolvedLocale}
        title={isAr ? 'لا توجد بيانات من Odoo لهذه الفترة' : 'No Odoo GL data for this period'}
        description={
          isAr
            ? acc.unavailableReasonAr ??
              'تعذر جلب قيود دفتر الأستاذ العام (account.move.line) من Odoo للفترة المحددة.'
            : acc.unavailableReasonEn ??
              'Unable to retrieve posted general ledger lines (account.move.line) from Odoo for this period.'
        }
      />
    )
  }

  const dateRange = { from: acc.from || workspace.dateRange.from, to: acc.to || workspace.dateRange.to }
  const glGapKwd =
    acc.totalRevenueKwd !== null && workspace.nullableSalesKwd !== null
      ? Math.round((acc.totalRevenueKwd - workspace.nullableSalesKwd) * 1000) / 1000
      : null

  const scalarByExpenseClass: Record<PlatformExpenseClass, number | null | undefined> = {
    platform_commission: acc.deliveryCommissionsKwd,
    platform_subscription: acc.platformSubscriptionKwd,
    third_party_delivery: acc.thirdPartyDeliveryKwd,
    payment_gateway: acc.paymentGatewayKwd,
    bank_fees: acc.bankFeesKwd,
    ads: acc.adsKwd,
    other: acc.otherOpexKwd,
  }

  const hasExpenseBreakdownData = Boolean(
    acc.expenseBreakdown ||
      PLATFORM_EXPENSE_CLASSES.some((cls) => typeof scalarByExpenseClass[cls] === 'number'),
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-6">
      {(workspace.glIncomplete || acc.glIncomplete) && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div className="space-y-1 text-sm">
            <p className="font-bold">
              {isAr
                ? `قيود غير مكتملة لهذه الفترة (${dateRange.from} → ${dateRange.to})`
                : `Incomplete GL entries for this period (${dateRange.from} → ${dateRange.to})`}
            </p>
            <p className="text-xs leading-relaxed opacity-90">
              {isAr
                ? acc.glWarningAr ??
                  workspace.glWarningAr ??
                  'لم يتم ترحيل جميع قيود الاستحقاق الشهرية (مثل الإهلاك أو الإيجارات أو الرواتب أو عمولات المنصات) في دفتر الأستاذ العام لهذه الفترة بعد؛ تُعرض القيود المرحلة فعلياً أدناه.'
                : 'Month-end accrual entries (depreciation, rent, payroll, or aggregator commissions) have not yet been fully posted in Odoo GL for this window; posted lines available in Odoo are shown below.'}
            </p>
          </div>
        </div>
      )}

      {/* Core GL KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className="ds-surface rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>{isAr ? 'إيرادات دفتر الأستاذ المرحلة' : 'Posted GL Revenue'}</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            <GlKwdValue value={acc.totalRevenueKwd} locale={resolvedLocale} />
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {isAr
              ? `${formatInt(acc.lineCount, resolvedLocale)} قيد مرحّل في الفترة`
              : `${formatInt(acc.lineCount, resolvedLocale)} posted journal lines`}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            {isAr ? 'يشمل إيرادات غير الكاشير' : 'Includes non-cashier revenue'}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {(acc.revenueAccounts ?? []).length > 0 ? (
              acc.revenueAccounts?.map((account) => (
                <li key={`${account.code}-${account.name}`}>
                  <span dir="ltr" className="font-mono">
                    {account.code}
                  </span>{' '}
                  {account.name} · <GlKwdValue value={account.amountKwd} locale={resolvedLocale} /> ·{' '}
                  {account.accountType === 'income'
                    ? isAr
                      ? 'إيراد'
                      : 'income'
                    : isAr
                      ? 'إيرادات أخرى'
                      : 'other income'}
                </li>
              ))
            ) : (
              <li className="text-slate-500 dark:text-slate-400">
                {isAr
                  ? 'لا توجد حسابات إيراد مرحّلة في هذه الفترة'
                  : 'No posted revenue accounts in this period'}
              </li>
            )}
          </ul>
          <div className="mt-3">
            <KpiProvenanceBadge
              model="account.move.line"
              dateRange={dateRange}
              lastSyncAt={workspace.lastSyncAt}
              isStale24h={workspace.isStale24h}
              kind="فعلي"
              queryOrFormula="SUM(credit - debit) ON income accounts WHERE parent_state = 'posted'"
              isAr={isAr}
            />
          </div>
        </article>

        <article className="ds-surface rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>{isAr ? 'تكلفة البضاعة المباعة المرحلة (COGS)' : 'Posted GL COGS'}</span>
            <Receipt className="h-4 w-4 text-rose-600" aria-hidden />
          </div>
          {acc.cogsKwd === null || (acc.cogsKwd === 0 && !(acc.cogsAccounts && acc.cogsAccounts.length > 0)) ? (
            <p className="mt-2 text-lg font-bold text-amber-700 dark:text-amber-400">
              {isAr ? 'لم يُرحَّل بعد في أودو لهذه الفترة' : 'Not yet posted in Odoo for this period'}
            </p>
          ) : (
            <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              <GlKwdValue value={acc.cogsKwd} locale={resolvedLocale} />
            </p>
          )}
          {acc.cogsPct !== null && acc.cogsKwd !== null && acc.cogsKwd !== 0 && (
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              <span dir="ltr" className="ds-num tabular-nums">
                {formatPct(acc.cogsPct, resolvedLocale)}
              </span>{' '}
              {isAr ? 'من الإيراد المرحل' : 'of posted revenue'}
            </p>
          )}
          <div className="mt-3">
            <KpiProvenanceBadge
              model="account.move.line"
              dateRange={dateRange}
              lastSyncAt={workspace.lastSyncAt}
              isStale24h={workspace.isStale24h}
              kind="فعلي"
              queryOrFormula="SUM(debit - credit) ON direct_cost accounts WHERE parent_state = 'posted'"
              isAr={isAr}
            />
          </div>
        </article>

        <article className="ds-surface rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>{isAr ? 'عمولات منصات التوصيل المرحلة' : 'Posted Aggregator Commissions'}</span>
            <BookOpen className="h-4 w-4 text-amber-600" aria-hidden />
          </div>
          {workspace.aggregatorCommissionUnposted || acc.aggregatorCommissionUnposted ? (
            <p className="mt-2 text-xl font-extrabold text-amber-700 dark:text-amber-400">
              {isAr ? 'غير مُرحَّل بعد' : 'Unposted'}
            </p>
          ) : (
            <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              <GlKwdValue value={acc.deliveryCommissionsKwd} locale={resolvedLocale} />
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? 'فئة عمولات المنصات فقط (مستقلة عن الاشتراكات والتوصيل والبنوك)'
              : 'Platform commission class only (separated from subscriptions, delivery & bank fees)'}
          </p>
          <div className="mt-3">
            <KpiProvenanceBadge
              model="account.move.line"
              dateRange={dateRange}
              lastSyncAt={workspace.lastSyncAt}
              isStale24h={workspace.isStale24h}
              kind="فعلي"
              queryOrFormula="account.move.line platform_commission accounts (parent_state='posted')"
              isAr={isAr}
            />
          </div>
        </article>

        <article className="ds-surface rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>{isAr ? 'المصاريف التشغيلية والإهلاك المرحلة' : 'Posted OPEX & Depreciation'}</span>
            <Scale className="h-4 w-4 text-indigo-600" aria-hidden />
          </div>
          {acc.otherOpexAndDepreciationKwd === null ||
          (acc.otherOpexAndDepreciationKwd === 0 &&
            !(acc.expenseAccounts && acc.expenseAccounts.length > 0) &&
            !(acc.depreciationAccounts && acc.depreciationAccounts.length > 0)) ? (
            <p className="mt-2 text-lg font-bold text-amber-700 dark:text-amber-400">
              {isAr ? 'لم يُرحَّل بعد في أودو لهذه الفترة' : 'Not yet posted in Odoo for this period'}
            </p>
          ) : (
            <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              <GlKwdValue value={acc.otherOpexAndDepreciationKwd} locale={resolvedLocale} />
            </p>
          )}
          <div className="mt-3">
            <KpiProvenanceBadge
              model="account.move.line"
              dateRange={dateRange}
              lastSyncAt={workspace.lastSyncAt}
              isStale24h={workspace.isStale24h}
              kind="فعلي"
              queryOrFormula="SUM(debit - credit) ON expense + expense_depreciation accounts WHERE parent_state = 'posted'"
              isAr={isAr}
            />
          </div>
        </article>

        <article className="ds-surface rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>{isAr ? 'صافي النتيجة الدفترية المرحلة' : 'Posted Operating Result'}</span>
            <Landmark className="h-4 w-4 text-emerald-600" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            <GlKwdValue value={acc.operatingProfitKwd} locale={resolvedLocale} />
          </p>
          {acc.netProfitWithheld ? (
            <p data-net-profit-withheld="true" className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? acc.netProfitWithheldReasonAr : acc.netProfitWithheldReasonEn}
            </p>
          ) : null}
          {(workspace.glIncomplete || acc.glIncomplete) && (
            <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
              {isAr ? 'قيود غير مكتملة لهذه الفترة' : 'Incomplete GL entries for this period'}
            </p>
          )}
          <div className="mt-3">
            <KpiProvenanceBadge
              model="account.move.line"
              dateRange={dateRange}
              lastSyncAt={workspace.lastSyncAt}
              isStale24h={workspace.isStale24h}
              kind="محسوب بمعادلة"
              queryOrFormula="الإيراد المرحل − تكلفة البضاعة − عمولات التوصيل − المصاريف والإهلاك المرحلة"
              isAr={isAr}
            />
          </div>
        </article>

        {/* POS vs GL Gap Card */}
        <article className="ds-surface rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>{isAr ? 'فرق الأستاذ العام عن نقاط البيع (POS vs GL)' : 'POS vs GL Revenue Gap'}</span>
            <GitCompareArrows className="h-4 w-4 text-cyan-600" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            <GlKwdValue value={glGapKwd} locale={resolvedLocale} signed />
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {isAr ? 'نقاط البيع: ' : 'POS Net: '}
            <GlKwdValue value={workspace.nullableSalesKwd} locale={resolvedLocale} /> ·{' '}
            {isAr ? 'الأستاذ العام: ' : 'GL Rev: '}
            <GlKwdValue value={acc.totalRevenueKwd} locale={resolvedLocale} />
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {isAr
              ? `الفارق للفترة (${dateRange.from} → ${dateRange.to}) ينتج عن جلسات نقاط البيع غير المقفلة بعد، أو فواتير المبيعات المباشرة/الشركات والقيود اليدوية، أو فروق توقيت الإقفال والضرائب.`
              : `Difference for [${dateRange.from} → ${dateRange.to}] arises from unclosed POS sessions, direct B2B/manual GL journal entries outside pos.order, and posting cutoff timing.`}
          </p>
        </article>
      </div>

      {/* 7-Bucket Platform Expense Breakdown */}
      {hasExpenseBreakdownData ? (
        <section className="ds-surface space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-600" aria-hidden />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr
                  ? 'تصنيف مصروفات المنصات والتشغيل (7 فئات حتمية من أودو)'
                  : '7-Bucket Platform & Operating Expense Breakdown'}
              </h3>
            </div>
            <span dir="ltr" className="font-mono text-xs text-slate-500 dark:text-slate-400">
              {dateRange.from} → {dateRange.to}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PLATFORM_EXPENSE_CLASSES.map((cls) => {
              const bucket = acc.expenseBreakdown?.[cls]
              const scalar = scalarByExpenseClass[cls]
              const totalKwd = bucket ? bucket.totalKwd : typeof scalar === 'number' ? scalar : null
              const linesCount = bucket?.linesCount ?? 0
              const accounts = bucket?.accounts ?? []
              const label = PLATFORM_EXPENSE_CLASS_LABELS[cls]
              const unposted =
                totalKwd === null ||
                (totalKwd === 0 && linesCount === 0 && accounts.length === 0)

              return (
                <div
                  key={cls}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {isAr ? label.ar : label.en}
                  </p>
                  {unposted ? (
                    <p className="mt-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      {isAr
                        ? 'لم يُرحَّل بعد في أودو لهذه الفترة'
                        : 'Not yet posted in Odoo for this period'}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-lg font-extrabold text-slate-900 dark:text-white">
                      <GlKwdValue value={totalKwd} locale={resolvedLocale} />
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {formatInt(accounts.length, resolvedLocale)} {isAr ? 'حساب' : 'accounts'} ·{' '}
                    {formatInt(linesCount, resolvedLocale)} {isAr ? 'قيد' : 'lines'}
                  </p>
                  {accounts.length > 0 ? (
                    <details className="mt-2 border-t border-slate-200/70 pt-2 dark:border-slate-800">
                      <summary className="cursor-pointer text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        {isAr ? 'عرض الحسابات' : 'Show accounts'}
                      </summary>
                      <ul className="mt-1.5 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                        {accounts.map((a) => (
                          <li key={`${a.accountId ?? a.code}-${a.name}`} className="flex justify-between gap-2">
                            <span className="truncate">
                              <span dir="ltr" className="font-mono font-semibold">
                                {a.code}
                              </span>{' '}
                              {a.name}
                            </span>
                            <GlKwdValue value={a.amountKwd} locale={resolvedLocale} className="shrink-0 font-mono" />
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* GL Trial Balance & Balance Sheet Summaries */}
      {(acc.trialBalance || acc.balanceSheet) && (
        <div className="grid grid-cols-1 gap-4">
          {acc.trialBalance ? (
            <TrialBalancePanel tb={acc.trialBalance} isAr={isAr} locale={resolvedLocale} />
          ) : null}
          {acc.balanceSheet ? (
            <BalanceSheetPanel bs={acc.balanceSheet} isAr={isAr} locale={resolvedLocale} />
          ) : null}
        </div>
      )}

      {/* Open Receivables Summary Card */}
      <article className="ds-surface rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span>{isAr ? 'صافي الذمم المدينة المفتوحة' : 'Net Open Receivables (AR)'}</span>
          <Landmark className="h-4 w-4 text-sky-600" aria-hidden />
        </div>
        <div
          dir="ltr"
          title={rec.unavailable ? unavailableTooltip : undefined}
          aria-label={rec.unavailable ? unavailableTooltip : undefined}
          data-unavailable={rec.unavailable ? 'true' : undefined}
          className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white"
        >
          {rec.unavailable ? (
            isAr ? (
              'غير متاح'
            ) : (
              UNAVAILABLE_DASH
            )
          ) : !amountsVisible || rec.pendingReconciliation ? (
            <ReceivablesPendingStatus isAr={isAr} size="sm" />
          ) : (
            formatKwd(rec.openReceivableKwd, resolvedLocale)
          )}
        </div>
        <p
          dir="ltr"
          title={rec.unavailable ? unavailableTooltip : undefined}
          className="mt-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums"
        >
          {rec.unavailable
            ? isAr
              ? 'غير متاح'
              : UNAVAILABLE_DASH
            : isAr
              ? `${formatInt(rec.unreconciledLineCount, resolvedLocale)} سطر ذمم غير مسوّى`
              : `${formatInt(rec.unreconciledLineCount, resolvedLocale)} unreconciled AR lines`}
        </p>
        {!rec.unavailable ? (
          !amountsVisible || rec.pendingReconciliation ? (
            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              {isAr ? RECEIVABLES_PENDING_DETAIL.ar : RECEIVABLES_PENDING_DETAIL.en}
            </p>
          ) : (
            <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {isAr ? rec.reconciliationFormulaAr : rec.reconciliationFormulaEn}
            </p>
          )
        ) : null}
        <div className="mt-3">
          <KpiProvenanceBadge
            model="account.move.line"
            dateRange={{ from: rec.fromDate || dateRange.from, to: rec.toDate || dateRange.to }}
            lastSyncAt={workspace.lastSyncAt}
            isStale24h={workspace.isStale24h}
            kind="فعلي"
            queryOrFormula="SUM(amount_residual) WHERE account_type = 'asset_receivable' AND reconciled = false"
            isAr={isAr}
          />
        </div>
      </article>

      {!isAuditor && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
          <span className="font-bold text-slate-800 dark:text-slate-100">
            {isAr ? 'تصنيف المخاطر المحاسبية:' : 'Accounting Risk Classification:'}
          </span>{' '}
          {isAr
            ? 'يتم تقييم اكتمال الترحيل المحاسبي آلياً استناداً إلى قيود account.move.line المرحلة في Odoo دون أرقام تقديرية.'
            : 'Posting completeness is evaluated strictly from posted Odoo account.move.line entries with zero synthetic estimates.'}
        </div>
      )}
    </div>
  )
}
