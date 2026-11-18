'use client'

import React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  GitCompareArrows,
  Landmark,
  Layers,
  Receipt,
  Scale,
  TrendingUp,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { PartialWarningBanner, StateBlock } from '@/components/ui'
import {
  PROFIT_AFTER_CLOSE_NOTE,
  lastClosedMonthDateRange,
} from '@/lib/aether/closed-month-policy'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKuwaitDate,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
} from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type {
  GlBalanceSheetSummary,
  GlIncomeStatementGroup,
  GlIncomeStatementGroupKey,
  GlStatementAccountLine,
  GlTrialBalanceSummary,
  OdooAnalyticBranchPnlSummary,
  OdooBudgetProbeSummary,
} from '@/lib/odoo/live-sync-core'
import { PLATFORM_EXPENSE_CLASS_LABELS } from '@/lib/odoo/platform-expense-accounts'

function NullableKwdCell({
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
      className={`ds-num inline-block font-mono tabular-nums ${className}`}
    >
      {formatKwd(value, { locale, signed })}
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

interface ResolvedStatementLine {
  id: string
  typeTag: string
  labelAr: string
  labelEn: string
  amountKwd: number | null
  pctOfRev: number | null
  tone: string
  expandable: boolean
  posted: boolean
  accounts: GlStatementAccountLine[]
  withheldReasonAr?: string
  withheldReasonEn?: string
  isSubtotal?: boolean
}

function sumAccountAmounts(accounts: readonly GlStatementAccountLine[]): number {
  return Math.round(accounts.reduce((s, a) => s + (Number(a.amountKwd) || 0), 0) * 1000) / 1000
}

function pctOfRevenue(amountKwd: number | null, revenueKwd: number | null): number | null {
  if (amountKwd === null || revenueKwd === null || revenueKwd <= 0) return null
  return Math.round((Math.abs(amountKwd) / revenueKwd) * 1000) / 10
}

function AnalyticBranchPnlCard({
  analytic,
  isAr,
  locale,
  fromIso,
  toIso,
}: {
  analytic: OdooAnalyticBranchPnlSummary
  isAr: boolean
  locale: 'ar' | 'en'
  fromIso: string
  toIso: string
}) {
  return (
    <section className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4 dark:border-slate-800 dark:bg-[#0b1320]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-emerald-600 dark:text-emerald-400" aria-hidden />
          <h3 className="text-base font-black text-slate-950 dark:text-white">
            {isAr
              ? 'قائمة الدخل التحليلية للفروع (account.analytic.line)'
              : 'Analytic Branch P&L (account.analytic.line)'}
          </h3>
        </div>
        <span dir="ltr" className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {fromIso} → {toIso}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[520px] text-xs">
          <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 dark:bg-slate-900/90 dark:text-slate-300 dark:border-slate-800">
            <tr>
              <th className="py-2.5 px-4 text-start font-bold">
                {isAr ? 'المركز التحليلي / الفرع' : 'Analytic Center / Branch'}
              </th>
              <th className="py-2.5 px-4 text-end font-bold">
                {isAr ? 'الصافي (د.ك)' : 'Net Amount (KWD)'}
              </th>
              <th className="py-2.5 px-4 text-end font-bold">
                {isAr ? 'الحصة' : 'Share'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/70">
            {analytic.branches.map((br) => (
              <tr key={`${br.analyticId ?? br.analyticName}-${br.analyticName}`}>
                <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                  {br.analyticName}
                </td>
                <td className="py-2.5 px-4 text-end font-bold">
                  <NullableKwdCell value={br.amountKwd} locale={locale} signed />
                </td>
                <td className="py-2.5 px-4 text-end text-slate-600 dark:text-slate-300">
                  <NullablePctCell value={br.sharePct} locale={locale} />
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50/70 dark:bg-slate-900/50">
              <td className="py-2.5 px-4 font-bold text-slate-700 dark:text-slate-300">
                {isAr ? 'قيود غير موزعة تحليلياً' : 'Unallocated GL Share'}
              </td>
              <td className="py-2.5 px-4 text-end font-bold text-amber-700 dark:text-amber-300">
                <NullableKwdCell value={analytic.unallocatedKwd} locale={locale} signed />
              </td>
              <td className="py-2.5 px-4 text-end text-slate-600 dark:text-slate-300">
                <NullablePctCell value={analytic.unallocatedSharePct} locale={locale} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function StatementStatementsGrid({
  trialBalance,
  balanceSheet,
  isAr,
  locale,
}: {
  trialBalance?: GlTrialBalanceSummary
  balanceSheet?: GlBalanceSheetSummary
  isAr: boolean
  locale: 'ar' | 'en'
}) {
  if (!trialBalance?.readable && !balanceSheet?.readable) {
    return null
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {trialBalance?.readable ? (
        <section className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3 shadow-xs dark:border-slate-800 dark:bg-[#0b1320]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-950 dark:text-white">
                {isAr ? 'ملخص ميزان المراجعة (Trial Balance)' : 'GL Trial Balance Summary'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span dir="ltr" className="font-mono">
                  {trialBalance.from} → {trialBalance.to}
                </span>{' '}
                · {formatInt(trialBalance.accountsCount, locale)} {isAr ? 'حساباً' : 'accounts'} ·{' '}
                {formatInt(trialBalance.linesCount, locale)} {isAr ? 'سطراً' : 'lines'}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                trialBalance.balanced
                  ? 'bg-emerald-500/10 text-emerald-800 ring-1 ring-emerald-500/30 dark:text-emerald-300'
                  : 'bg-amber-500/10 text-amber-800 ring-1 ring-amber-500/30 dark:text-amber-300'
              }`}
            >
              <CheckCircle2 size={12} aria-hidden />
              {trialBalance.balanced
                ? isAr
                  ? 'متوازن'
                  : 'Balanced'
                : isAr
                  ? `فرق ${formatKwd(trialBalance.differenceKwd, locale)}`
                  : `Diff ${formatKwd(trialBalance.differenceKwd, locale)}`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900/60">
              <span className="text-slate-500 dark:text-slate-400 block">
                {isAr ? 'إجمالي المدين' : 'Total Debit'}
              </span>
              <NullableKwdCell value={trialBalance.totalDebitKwd} locale={locale} className="mt-1 font-extrabold text-slate-950 dark:text-white" />
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900/60">
              <span className="text-slate-500 dark:text-slate-400 block">
                {isAr ? 'إجمالي الدائن' : 'Total Credit'}
              </span>
              <NullableKwdCell value={trialBalance.totalCreditKwd} locale={locale} className="mt-1 font-extrabold text-slate-950 dark:text-white" />
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900/60">
              <span className="text-slate-500 dark:text-slate-400 block">
                {isAr ? 'الفرق' : 'Difference'}
              </span>
              <NullableKwdCell value={trialBalance.differenceKwd} locale={locale} signed className="mt-1 font-extrabold text-emerald-700 dark:text-emerald-300" />
            </div>
          </div>

          {trialBalance.rows.length > 0 ? (
            <details className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-800">
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="inline-flex items-center gap-1.5">
                  <ChevronDown size={14} aria-hidden />
                  {isAr ? 'تفصيل حسابات ميزان المراجعة' : 'Expand Trial Balance Accounts'}
                </span>
                <span className="font-mono text-xs text-slate-500">
                  {formatInt(trialBalance.rows.length, locale)}
                </span>
              </summary>
              <div className="mt-2.5 max-h-72 overflow-auto">
                <table className="w-full min-w-[460px] text-xs">
                  <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="py-1.5 pe-2 text-start">{isAr ? 'الرمز' : 'Code'}</th>
                      <th className="py-1.5 pe-2 text-start">{isAr ? 'الحساب' : 'Account'}</th>
                      <th className="py-1.5 px-2 text-end">{isAr ? 'مدين' : 'Debit'}</th>
                      <th className="py-1.5 px-2 text-end">{isAr ? 'دائن' : 'Credit'}</th>
                      <th className="py-1.5 ps-2 text-end">{isAr ? 'الرصيد' : 'Balance'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                    {trialBalance.rows.map((r) => (
                      <tr key={`${r.accountId ?? r.code}-${r.name}`}>
                        <td dir="ltr" className="py-1.5 pe-2 font-mono font-bold text-slate-600 dark:text-slate-300">
                          {r.code}
                        </td>
                        <td className="py-1.5 pe-2 text-slate-900 dark:text-slate-100">{r.name}</td>
                        <td className="py-1.5 px-2 text-end">
                          <NullableKwdCell value={r.debitKwd} locale={locale} />
                        </td>
                        <td className="py-1.5 px-2 text-end">
                          <NullableKwdCell value={r.creditKwd} locale={locale} />
                        </td>
                        <td className="py-1.5 ps-2 text-end font-semibold">
                          <NullableKwdCell value={r.balanceKwd} locale={locale} signed />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      {balanceSheet?.readable ? (
        <section className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3 shadow-xs dark:border-slate-800 dark:bg-[#0b1320]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-950 dark:text-white">
                {isAr ? 'الميزانية العمومية (Balance Sheet)' : 'Balance Sheet Summary'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr
                  ? `كما في ${formatKuwaitDate(balanceSheet.asOfDate, locale)} · بداية السنة المالية: ${formatKuwaitDate(balanceSheet.fiscalYearStart, locale)}`
                  : `As of ${formatKuwaitDate(balanceSheet.asOfDate, locale)} · FY start: ${formatKuwaitDate(balanceSheet.fiscalYearStart, locale)}`}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                balanceSheet.equationBalanced
                  ? 'bg-emerald-500/10 text-emerald-800 ring-1 ring-emerald-500/30 dark:text-emerald-300'
                  : 'bg-amber-500/10 text-amber-800 ring-1 ring-amber-500/30 dark:text-amber-300'
              }`}
            >
              <CheckCircle2 size={12} aria-hidden />
              {balanceSheet.equationBalanced
                ? isAr
                  ? 'الأصول = الالتزامات + حقوق الملكية'
                  : 'Assets = Liabilities + Equity'
                : isAr
                  ? `فرق المعادلة ${formatKwd(balanceSheet.differenceKwd, locale)}`
                  : `Equation diff ${formatKwd(balanceSheet.differenceKwd, locale)}`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900/60">
              <span className="text-slate-500 dark:text-slate-400 block">
                {isAr ? 'إجمالي الأصول' : 'Total Assets'}
              </span>
              <NullableKwdCell value={balanceSheet.assetsTotalKwd} locale={locale} className="mt-1 font-extrabold text-slate-950 dark:text-white" />
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900/60">
              <span className="text-slate-500 dark:text-slate-400 block">
                {isAr ? 'الالتزامات' : 'Liabilities'}
              </span>
              <NullableKwdCell value={balanceSheet.liabilitiesTotalKwd} locale={locale} className="mt-1 font-extrabold text-slate-950 dark:text-white" />
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900/60">
              <span className="text-slate-500 dark:text-slate-400 block">
                {isAr ? 'حقوق الملكية' : 'Total Equity'}
              </span>
              <NullableKwdCell value={balanceSheet.equityTotalKwd} locale={locale} className="mt-1 font-extrabold text-emerald-700 dark:text-emerald-300" />
            </div>
          </div>

          <div className="space-y-2">
            {(
              [
                {
                  key: 'assets',
                  titleAr: 'تفاصيل الأصول',
                  titleEn: 'Asset Accounts',
                  total: balanceSheet.assetsTotalKwd,
                  rows: balanceSheet.assetsAccounts,
                },
                {
                  key: 'liabilities',
                  titleAr: 'تفاصيل الالتزامات',
                  titleEn: 'Liability Accounts',
                  total: balanceSheet.liabilitiesTotalKwd,
                  rows: balanceSheet.liabilitiesAccounts,
                },
                {
                  key: 'equity',
                  titleAr: 'تفاصيل حقوق الملكية والأرباح المرحلة',
                  titleEn: 'Equity & Current-Year Earnings',
                  total: balanceSheet.equityTotalKwd,
                  rows: balanceSheet.equityAccounts,
                },
              ] as const
            ).map((grp) => (
              <details
                key={grp.key}
                className="rounded-xl border border-slate-200/80 p-2.5 dark:border-slate-800"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="inline-flex items-center gap-1.5">
                    <ChevronDown size={13} aria-hidden />
                    {isAr ? grp.titleAr : grp.titleEn} ({formatInt(grp.rows.length, locale)})
                  </span>
                  <NullableKwdCell value={grp.total} locale={locale} />
                </summary>
                <ul className="mt-2 space-y-1 border-t border-slate-200/70 pt-2 text-xs dark:border-slate-800">
                  {grp.rows.map((acc) => (
                    <li key={`${acc.accountId ?? acc.code}-${acc.name}`} className="flex justify-between gap-2">
                      <span className="truncate text-slate-700 dark:text-slate-300">
                        <span dir="ltr" className="font-mono text-slate-500 dark:text-slate-400">
                          {acc.code}
                        </span>{' '}
                        {acc.name}
                      </span>
                      <NullableKwdCell value={acc.amountKwd} locale={locale} className="shrink-0" />
                    </li>
                  ))}
                  {grp.key === 'equity' ? (
                    <li className="flex justify-between gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                      <span>{isAr ? 'أرباح / (خسائر) العام الجاري' : 'Current-Year Earnings'}</span>
                      <NullableKwdCell value={balanceSheet.currentYearEarningsKwd} locale={locale} signed />
                    </li>
                  ) : null}
                </ul>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function BudgetComparisonSection({
  probe,
  isAr,
  locale,
}: {
  probe?: OdooBudgetProbeSummary
  isAr: boolean
  locale: 'ar' | 'en'
}) {
  if (!probe || !probe.readable || probe.lines.length === 0) {
    return null
  }

  return (
    <section className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3 shadow-xs dark:border-slate-800 dark:bg-[#0b1320]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
        <h3 className="text-sm font-black text-slate-950 dark:text-white">
          {isAr
            ? 'الموازنة مقابل الفعلي (crossovered.budget.lines)'
            : 'Budget vs Actual (crossovered.budget.lines)'}
        </h3>
        {probe.fiscalFrom && probe.fiscalTo ? (
          <span dir="ltr" className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {probe.fiscalFrom} → {probe.fiscalTo}
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[600px] text-xs">
          <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 dark:bg-slate-900/90 dark:text-slate-300 dark:border-slate-800">
            <tr>
              <th className="py-2.5 px-4 text-start font-bold">{isAr ? 'الموازنة' : 'Budget'}</th>
              <th className="py-2.5 px-4 text-start font-bold">{isAr ? 'المركز التحليلي' : 'Analytic'}</th>
              <th className="py-2.5 px-4 text-end font-bold">{isAr ? 'المخطط' : 'Planned'}</th>
              <th className="py-2.5 px-4 text-end font-bold">{isAr ? 'الفعلي' : 'Practical'}</th>
              <th className="py-2.5 px-4 text-end font-bold">{isAr ? 'الفرق' : 'Variance'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/70">
            {probe.lines.map((line, idx) => (
              <tr key={`${line.budgetName}-${line.analyticName ?? 'all'}-${idx}`}>
                <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                  {line.budgetName}
                </td>
                <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                  {line.analyticName ?? (isAr ? 'الشركة ككل' : 'Company-wide')}
                </td>
                <td className="py-2.5 px-4 text-end">
                  <NullableKwdCell value={line.plannedKwd} locale={locale} />
                </td>
                <td className="py-2.5 px-4 text-end">
                  <NullableKwdCell value={line.practicalKwd} locale={locale} />
                </td>
                <td className="py-2.5 px-4 text-end font-bold">
                  <NullableKwdCell value={line.varianceKwd} locale={locale} signed />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * General Ledger Income Statement & POS-to-GL Reconciliation Studio (`/erp/executive-pnl`).
 * Renders per-line posted GL accounts grouped by Odoo `account_type` + Part 2 §E expense classes,
 * enforces closed-month lock date gating, and keeps budget UI absent unless Odoo reports readable rows.
 */
export function ExecutivePnlStudio() {
  const { locale } = useI18n()
  const resolvedLocale: 'ar' | 'en' = locale === 'en' ? 'en' : 'ar'
  const isAr = resolvedLocale !== 'en'
  const { workspace, liveSummary, syncingOdoo, setCustomRange, filters } = useGlobalFilter()
  const gl = workspace.accounting
  const unavailableTooltip = getUnavailableTooltip(resolvedLocale)

  const isSubFilter = Boolean(
    filters.brand !== 'all' ||
      filters.branch !== 'all' ||
      filters.channel !== 'all' ||
      (filters.kuwaitSlice && filters.kuwaitSlice !== 'all'),
  )
  const closedMonthRange = lastClosedMonthDateRange(gl.glClosedThroughDate)
  const isViewingClosedMonth = Boolean(
    closedMonthRange &&
      filters.period === 'custom' &&
      filters.customFrom === closedMonthRange.fromIso &&
      filters.customTo === closedMonthRange.toIso,
  )

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

  const groupMap = new Map<GlIncomeStatementGroupKey, GlIncomeStatementGroup>(
    (gl.incomeStatementGroups ?? []).map((g) => [g.key, g]),
  )
  const revenueFallbackAccounts: GlStatementAccountLine[] = (gl.revenueAccounts ?? []).map((a) => ({
    code: a.code,
    name: a.name,
    accountType: a.accountType,
    amountKwd: a.amountKwd,
  }))

  const resolveExpenseLine = (
    key: Exclude<GlIncomeStatementGroupKey, 'revenue' | 'cogs' | 'depreciation'>,
    expenseClass:
      | 'platform_commission'
      | 'platform_subscription'
      | 'third_party_delivery'
      | 'payment_gateway'
      | 'bank_fees'
      | 'ads'
      | 'other',
    scalarFallback: number | null | undefined,
    fallbackAccounts: readonly GlStatementAccountLine[],
    typeTag: string,
    tone: string,
  ): ResolvedStatementLine => {
    const grp = groupMap.get(key)
    const breakdownBucket = gl.expenseBreakdown?.[expenseClass]
    const accounts = grp?.accounts ?? breakdownBucket?.accounts ?? [...fallbackAccounts]
    const rawTotal =
      grp !== undefined
        ? grp.posted || grp.totalKwd !== 0 || accounts.length > 0
          ? grp.totalKwd
          : null
        : breakdownBucket !== undefined
          ? breakdownBucket.linesCount > 0 || breakdownBucket.totalKwd !== 0 || accounts.length > 0
            ? breakdownBucket.totalKwd
            : null
          : typeof scalarFallback === 'number' && scalarFallback !== 0
            ? scalarFallback
            : accounts.length > 0
              ? sumAccountAmounts(accounts)
              : null

    const posted =
      grp?.posted ??
      (rawTotal !== null &&
        (rawTotal !== 0 || accounts.length > 0 || (breakdownBucket?.linesCount ?? 0) > 0))
    const label = PLATFORM_EXPENSE_CLASS_LABELS[expenseClass]

    return {
      id: key,
      typeTag,
      labelAr: grp?.labelAr ?? label.ar,
      labelEn: grp?.labelEn ?? label.en,
      amountKwd: posted && rawTotal !== null ? -Math.abs(rawTotal) : null,
      pctOfRev: posted ? pctOfRevenue(rawTotal, gl.totalRevenueKwd) : null,
      tone,
      expandable: true,
      posted,
      accounts,
    }
  }

  const revGroup = groupMap.get('revenue')
  const revAccounts = revGroup?.accounts ?? revenueFallbackAccounts
  const revPosted =
    gl.totalRevenueKwd !== null &&
    (revGroup?.posted ?? (gl.totalRevenueKwd !== 0 || revAccounts.length > 0))

  const cogsGroup = groupMap.get('cogs')
  const cogsAccounts = cogsGroup?.accounts ?? gl.cogsAccounts ?? []
  const cogsPosted =
    gl.cogsKwd !== null &&
    (cogsGroup?.posted ?? (gl.cogsKwd !== 0 || cogsAccounts.length > 0))

  const deprGroup = groupMap.get('depreciation')
  const deprAccounts = deprGroup?.accounts ?? gl.depreciationAccounts ?? []
  const deprRaw =
    deprGroup !== undefined
      ? deprGroup.posted || deprGroup.totalKwd !== 0 || deprAccounts.length > 0
        ? deprGroup.totalKwd
        : null
      : deprAccounts.length > 0
        ? sumAccountAmounts(deprAccounts)
        : null
  const deprPosted =
    deprGroup?.posted ??
    (deprRaw !== null && (deprRaw !== 0 || deprAccounts.length > 0))

  const otherOpexFallback =
    typeof gl.otherOpexKwd === 'number'
      ? gl.otherOpexKwd
      : !gl.expenseBreakdown && !gl.incomeStatementGroups && deprAccounts.length === 0
        ? gl.otherOpexAndDepreciationKwd
        : null

  const profitAllowed = Boolean(
    !gl.netProfitWithheld &&
      gl.glClosedThroughDate &&
      typeof gl.operatingProfitKwd === 'number',
  )

  const lineItems: ResolvedStatementLine[] = [
    {
      id: 'revenue',
      typeTag: 'income · income_other',
      labelAr: revGroup?.labelAr ?? 'الإيرادات المرحلة بدفتر الأستاذ العام',
      labelEn: revGroup?.labelEn ?? 'Posted General Ledger Revenue',
      amountKwd: revPosted ? gl.totalRevenueKwd : null,
      pctOfRev: revPosted && gl.totalRevenueKwd && gl.totalRevenueKwd > 0 ? 100 : null,
      tone: 'text-emerald-700 dark:text-emerald-400',
      expandable: true,
      posted: revPosted,
      accounts: revAccounts,
    },
    {
      id: 'cogs',
      typeTag: 'expense_direct_cost',
      labelAr: cogsGroup?.labelAr ?? 'تكلفة البضاعة والمواد المباشرة (COGS)',
      labelEn: cogsGroup?.labelEn ?? 'Cost of Goods Sold (expense_direct_cost)',
      amountKwd: cogsPosted && gl.cogsKwd !== null ? -Math.abs(gl.cogsKwd) : null,
      pctOfRev: cogsPosted ? gl.cogsPct : null,
      tone: 'text-rose-700 dark:text-rose-400',
      expandable: true,
      posted: cogsPosted,
      accounts: cogsAccounts,
    },
    {
      id: 'gross-profit',
      typeTag: 'GP',
      labelAr: 'مجمل الربح التشغيلي (الإيراد − تكلفة البضاعة)',
      labelEn: 'Gross Profit (Revenue − COGS)',
      amountKwd: revPosted ? glGrossProfitKwd : null,
      pctOfRev: revPosted ? glGrossMarginPct : null,
      tone: 'text-emerald-700 dark:text-emerald-300 font-black',
      expandable: false,
      posted: revPosted && glGrossProfitKwd !== null,
      accounts: [],
      isSubtotal: true,
    },
    resolveExpenseLine(
      'platform_commission',
      'platform_commission',
      gl.aggregatorCommissionUnposted ? null : gl.deliveryCommissionsKwd,
      [],
      'expense · platform_commission',
      'text-amber-700 dark:text-amber-400',
    ),
    resolveExpenseLine(
      'platform_subscription',
      'platform_subscription',
      gl.platformSubscriptionKwd,
      [],
      'expense · platform_subscription',
      'text-amber-700 dark:text-amber-300',
    ),
    resolveExpenseLine(
      'third_party_delivery',
      'third_party_delivery',
      gl.thirdPartyDeliveryKwd,
      [],
      'expense · third_party_delivery',
      'text-amber-700 dark:text-amber-300',
    ),
    resolveExpenseLine(
      'payment_gateway',
      'payment_gateway',
      gl.paymentGatewayKwd,
      [],
      'expense · payment_gateway',
      'text-slate-700 dark:text-slate-300',
    ),
    resolveExpenseLine(
      'bank_fees',
      'bank_fees',
      gl.bankFeesKwd,
      [],
      'expense · bank_fees',
      'text-slate-700 dark:text-slate-300',
    ),
    resolveExpenseLine(
      'ads',
      'ads',
      gl.adsKwd,
      [],
      'expense · ads',
      'text-slate-700 dark:text-slate-300',
    ),
    resolveExpenseLine(
      'other_opex',
      'other',
      otherOpexFallback,
      gl.expenseAccounts ?? [],
      'expense · other',
      'text-amber-700 dark:text-amber-300',
    ),
    {
      id: 'depreciation',
      typeTag: 'expense_depreciation',
      labelAr: deprGroup?.labelAr ?? 'الإهلاك والاستهلاك المرحل',
      labelEn: deprGroup?.labelEn ?? 'Posted Depreciation (expense_depreciation)',
      amountKwd: deprPosted && deprRaw !== null ? -Math.abs(deprRaw) : null,
      pctOfRev: deprPosted ? pctOfRevenue(deprRaw, gl.totalRevenueKwd) : null,
      tone: 'text-slate-700 dark:text-slate-300',
      expandable: true,
      posted: deprPosted,
      accounts: deprAccounts,
    },
    {
      id: 'operating-profit',
      typeTag: 'OP-NET',
      labelAr: 'صافي الربح التشغيلي الفعلي (الأشهر المُقفلة فقط)',
      labelEn: 'Actual Operating Profit (Closed GL Months Only)',
      amountKwd: profitAllowed ? gl.operatingProfitKwd : null,
      pctOfRev: profitAllowed ? gl.netProfitPct : null,
      tone:
        profitAllowed && typeof gl.operatingProfitKwd === 'number' && gl.operatingProfitKwd < 0
          ? 'text-rose-700 dark:text-rose-400 font-black'
          : 'text-emerald-700 dark:text-emerald-400 font-black',
      expandable: false,
      posted: profitAllowed,
      accounts: [],
      isSubtotal: true,
      withheldReasonAr:
        gl.netProfitWithheldReasonAr ?? PROFIT_AFTER_CLOSE_NOTE.ar,
      withheldReasonEn:
        gl.netProfitWithheldReasonEn ?? PROFIT_AFTER_CLOSE_NOTE.en,
    },
  ]

  const glFromFormatted = formatKuwaitDate(gl.from, resolvedLocale)
  const glToFormatted = formatKuwaitDate(gl.to, resolvedLocale)
  const glLinesFormatted = formatInt(gl.lineCount, resolvedLocale)
  const posVsGlVarianceKwd =
    !isSubFilter &&
    typeof workspace.nullableSalesKwd === 'number' &&
    typeof gl.totalRevenueKwd === 'number'
      ? Math.round((gl.totalRevenueKwd - workspace.nullableSalesKwd) * 1000) / 1000
      : null
  const posVsGlVariancePct =
    posVsGlVarianceKwd !== null &&
    typeof workspace.nullableSalesKwd === 'number' &&
    workspace.nullableSalesKwd > 0
      ? Math.round((posVsGlVarianceKwd / workspace.nullableSalesKwd) * 1000) / 10
      : null

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
                  ? 'قائمة الدخل ومطابقة نقاط البيع مع الأستاذ العام · أودو 17'
                  : 'Income Statement & POS–GL Reconciliation · Odoo 17'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white break-words">
              {isAr
                ? 'قائمة الدخل الفعلية ومطابقة نقاط البيع مع الأستاذ العام'
                : 'Actual Income Statement & POS–GL Reconciliation'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {isAr ? workspace.subtitleAr : workspace.subtitleEn} •{' '}
              {isAr
                ? `نطاق القيود المحاسبية: ${glFromFormatted} إلى ${glToFormatted} (${glLinesFormatted} سطر قيد)`
                : `GL Window: ${glFromFormatted} to ${glToFormatted} (${glLinesFormatted} move lines)`}
            </p>
            {workspace.odooConnected && !workspace.noData && !gl.glClosedThroughDate ? (
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {isAr
                  ? 'لا يوجد تاريخ إقفال محاسبي مُعيَّن في أودو بعد'
                  : 'No accounting lock date is configured in Odoo yet'}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {workspace.odooConnected && !workspace.noData && closedMonthRange ? (
              <button
                type="button"
                aria-pressed={isViewingClosedMonth}
                onClick={() => setCustomRange(closedMonthRange.fromIso, closedMonthRange.toIso)}
                className={`ds-focus-ring inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                  isViewingClosedMonth
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                    : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-300'
                }`}
              >
                <CalendarCheck2 size={14} aria-hidden />
                <span>
                  {isAr
                    ? `آخر شهر مُقفل (${closedMonthRange.labelAr})`
                    : `Last Closed Month (${closedMonthRange.labelEn})`}
                </span>
              </button>
            ) : null}

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
              <span>{isAr ? 'أعمار الذمم المدينة' : 'AR Aging'}</span>
              <ArrowUpRight size={13} aria-hidden />
            </Link>
          </div>
        </div>

        {workspace.odooConnected &&
        !workspace.noData &&
        !isSubFilter &&
        (gl.glIncomplete || !gl.available) ? (
          <div
            role="status"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-300/70 bg-amber-50/90 p-3.5 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden />
            <div>
              <span className="font-bold block">
                {isAr
                  ? `تنبيه محاسبي (${gl.from} → ${gl.to}): إقفال المصروفات الشهرية غير مكتمل لهذه الفترة`
                  : `Accounting Notice (${gl.from} → ${gl.to}): Month-end accruals are not fully posted for this window`}
              </span>
              <span className="text-amber-800 dark:text-amber-300/90">
                {isAr
                  ? gl.glWarningAr ??
                    gl.unavailableReasonAr ??
                    'تُعرض البنود المرحلة فعلياً في أودو أدناه، مع إظهار البنود غير المرحلة بوضوح في كل سطر.'
                  : 'Posted Odoo lines are displayed below per account group; any unposted items are marked clearly per line.'}
              </span>
            </div>
          </div>
        ) : null}
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

      {/* Top 4 KPI Cards */}
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
            <NullableKwdCell
              value={profitAllowed ? gl.operatingProfitKwd : null}
              locale={resolvedLocale}
            />
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-400 block">
            {isAr ? 'هامش التشغيل: ' : 'Operating Margin: '}
            <NullablePctCell
              value={profitAllowed ? gl.netProfitPct : null}
              locale={resolvedLocale}
            />
          </span>
          {!profitAllowed && (gl.netProfitWithheld || !gl.glClosedThroughDate) ? (
            <span
              data-net-profit-withheld="true"
              className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              {isAr
                ? gl.netProfitWithheldReasonAr ?? PROFIT_AFTER_CLOSE_NOTE.ar
                : gl.netProfitWithheldReasonEn ?? PROFIT_AFTER_CLOSE_NOTE.en}
            </span>
          ) : null}
        </div>
      </div>

      {/* Sub-filter Branch Analytic P&L or Concise Non-Partitioned Line */}
      {workspace.odooConnected && !workspace.noData && isSubFilter && !gl.available ? (
        gl.analyticPnl?.readable && gl.analyticPnl.populated ? (
          <AnalyticBranchPnlCard
            analytic={gl.analyticPnl}
            isAr={isAr}
            locale={resolvedLocale}
            fromIso={gl.from}
            toIso={gl.to}
          />
        ) : (
          <p
            role="status"
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300"
          >
            {isAr
              ? gl.unavailableReasonAr ??
                'قيود دفتر الأستاذ العام في أودو غير مقسّمة محاسبياً حسب هذا الفلتر الفرعي.'
              : gl.unavailableReasonEn ??
                'Odoo General Ledger entries are not analytically partitioned for this sub-filter.'}
          </p>
        )
      ) : (
        <>
          {/* Detailed General Ledger Income Statement by account_type + §E expense classes */}
          <div className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4 dark:border-slate-800 dark:bg-[#0b1320]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Scale size={18} className="text-emerald-600 dark:text-emerald-400" aria-hidden />
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  {isAr
                    ? 'جدول قائمة الدخل المحاسبية حسب فئات أودو (فنتشر فودز ذ.م.م.)'
                    : 'General Ledger Income Statement by Odoo Account Type (Venture Foods W.L.L.)'}
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 size={12} aria-hidden />
                {isAr ? 'تصنيف ديناميكي من أودو' : 'Dynamic Odoo GL'}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[660px] text-xs">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 dark:bg-slate-900/90 dark:text-slate-300 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 text-start font-bold">
                      {isAr ? 'نوع الحساب / الفئة' : 'Account Type / Class'}
                    </th>
                    <th className="py-3 px-4 text-start font-bold">
                      {isAr ? 'البند المحاسبي والحسابات المرحلة' : 'Statement Line & Posted Accounts'}
                    </th>
                    <th className="py-3 px-4 text-end font-bold">
                      {isAr ? 'المبلغ (د.ك)' : 'Amount (KWD)'}
                    </th>
                    <th className="py-3 px-4 text-end font-bold">
                      {isAr ? 'النسبة من الإيراد' : '% of Revenue'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/70">
                  {lineItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition ${
                        item.isSubtotal ? 'bg-slate-50/60 dark:bg-slate-900/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 align-top" dir="ltr">
                        {item.typeTag}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 align-top">
                        {item.expandable ? (
                          <details className="group">
                            <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                              <ChevronDown size={14} className="shrink-0 text-slate-500" aria-hidden />
                              <span>{isAr ? item.labelAr : item.labelEn}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {formatInt(item.accounts.length, resolvedLocale)}
                              </span>
                            </summary>
                            {item.accounts.length === 0 ? (
                              <p className="mt-2 ps-5 text-xs font-normal text-slate-500 dark:text-slate-400">
                                {isAr
                                  ? 'لا توجد حسابات مرحلة في هذه المجموعة'
                                  : 'No posted accounts in this group'}
                              </p>
                            ) : (
                              <ul className="mt-2 space-y-1 border-s-2 border-emerald-500/30 ps-3 text-xs font-normal">
                                {item.accounts.map((acc) => (
                                  <li
                                    key={`${acc.accountId ?? acc.code}-${acc.name}`}
                                    className="flex items-center justify-between gap-3 text-slate-700 dark:text-slate-300"
                                  >
                                    <span>
                                      <span dir="ltr" className="font-mono font-bold text-slate-600 dark:text-slate-400">
                                        {acc.code}
                                      </span>{' '}
                                      {acc.name}
                                    </span>
                                    <NullableKwdCell value={acc.amountKwd} locale={resolvedLocale} className="shrink-0 font-semibold" />
                                  </li>
                                ))}
                              </ul>
                            )}
                          </details>
                        ) : (
                          <span>{isAr ? item.labelAr : item.labelEn}</span>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-end font-bold align-top ${item.tone}`} dir="ltr">
                        {item.id === 'operating-profit' && !profitAllowed ? (
                          <span
                            dir={isAr ? 'rtl' : 'ltr'}
                            data-net-profit-withheld="true"
                            className="inline-block text-xs font-medium text-slate-500 dark:text-slate-400"
                          >
                            {isAr ? item.withheldReasonAr : item.withheldReasonEn}
                          </span>
                        ) : !item.posted || item.amountKwd === null ? (
                          <span
                            dir={isAr ? 'rtl' : 'ltr'}
                            className="inline-block text-xs font-semibold text-amber-700 dark:text-amber-400"
                          >
                            {isAr
                              ? 'لم يُرحَّل بعد في أودو لهذه الفترة'
                              : 'Not yet posted in Odoo for this period'}
                          </span>
                        ) : (
                          <NullableKwdCell value={item.amountKwd} locale={resolvedLocale} />
                        )}
                      </td>
                      <td className="py-3 px-4 text-end text-slate-700 dark:text-slate-300 align-top" dir="ltr">
                        {item.id === 'operating-profit' && !profitAllowed ? (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {isAr ? 'بعد الإقفال' : 'After close'}
                          </span>
                        ) : !item.posted || item.pctOfRev === null ? (
                          <span
                            dir={isAr ? 'rtl' : 'ltr'}
                            className="text-xs font-medium text-slate-500 dark:text-slate-400"
                          >
                            {isAr ? 'غير مرحّل' : 'Unposted'}
                          </span>
                        ) : (
                          <NullablePctCell value={item.pctOfRev} locale={resolvedLocale} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* POS vs GL Reconciliation Block */}
          <section className="ds-surface rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4 dark:border-slate-800 dark:bg-[#0b1320]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <GitCompareArrows size={18} className="text-cyan-600 dark:text-cyan-400" aria-hidden />
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  {isAr
                    ? 'مطابقة مبيعات نقاط البيع (POS) مع إيرادات الأستاذ العام (GL)'
                    : 'POS Net Sales vs General Ledger Revenue Reconciliation'}
                </h3>
              </div>
              <span dir="ltr" className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {gl.from} → {gl.to}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {isAr ? 'صافي مبيعات نقاط البيع (pos.order)' : 'POS Net Sales (pos.order)'}
                </p>
                <div className="mt-1.5 text-lg font-black text-slate-950 dark:text-white">
                  <NullableKwdCell value={workspace.nullableSalesKwd} locale={resolvedLocale} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {isAr ? 'إيرادات الأستاذ العام المرحلة (account.move.line)' : 'GL Posted Revenue (account.move.line)'}
                </p>
                <div className="mt-1.5 text-lg font-black text-emerald-700 dark:text-emerald-400">
                  <NullableKwdCell value={gl.totalRevenueKwd} locale={resolvedLocale} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {isAr ? 'الفارق (الأستاذ العام − نقاط البيع)' : 'Variance (GL − POS)'}
                </p>
                <div className="mt-1.5 flex items-baseline gap-2 text-lg font-black text-cyan-700 dark:text-cyan-300">
                  <NullableKwdCell value={posVsGlVarianceKwd} locale={resolvedLocale} signed />
                  {posVsGlVariancePct !== null ? (
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      (<NullablePctCell value={posVsGlVariancePct} locale={resolvedLocale} />)
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {isAr
                ? `أسباب الفرق بين نقاط البيع (pos.order) والأستاذ العام (account.move.line) خلال [${gl.from} → ${gl.to}]: (1) جلسات نقاط البيع المفتوحة التي لم تُقفل قيودها المحاسبية بعد، (2) فواتير المبيعات المباشرة والشركات (B2B) والقيود اليدوية المسجلة مباشرة في الأستاذ العام، (3) اختلاف توقيت الترحيل والقطع اليومي (Cutoff) وتسويات الضرائب والإشعارات الدائنة.`
                : `Why POS (pos.order) and GL (account.move.line) differ over [${gl.from} → ${gl.to}]: (1) unclosed POS sessions whose closing journal entries have not posted yet, (2) direct B2B/catering invoices or manual GL entries outside POS, and (3) operational-day vs accounting-date cutoff timing and tax/credit adjustments.`}
            </p>
          </section>

          {/* Trial Balance & Balance Sheet */}
          <StatementStatementsGrid
            trialBalance={gl.trialBalance}
            balanceSheet={gl.balanceSheet}
            isAr={isAr}
            locale={resolvedLocale}
          />

          {/* Dynamic Budget vs Actual (ONLY when crossovered.budget is readable and populated) */}
          <BudgetComparisonSection probe={gl.budgetProbe} isAr={isAr} locale={resolvedLocale} />
        </>
      )}

      {/* Brand & Branch POS Contribution */}
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
