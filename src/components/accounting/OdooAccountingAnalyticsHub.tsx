'use client'

import React from 'react'
import { AlertTriangle, BookOpen, Landmark, Receipt, Scale, TrendingUp } from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import KpiProvenanceBadge from '@/components/erp/KpiProvenanceBadge'
import { StateBlock } from '@/components/ui'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
} from '@/lib/format'

export interface OdooAccountingAnalyticsHubProps {
  isAr: boolean
  locale: string
  isAuditor?: boolean
}

function GlKwdValue({
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
      className={`ds-num inline-block tabular-nums ${className}`}
    >
      {formatKwd(value, locale)}
    </span>
  )
}

export function OdooAccountingAnalyticsHub({
  isAr,
  isAuditor = false,
}: OdooAccountingAnalyticsHubProps) {
  const resolvedLocale: 'ar' | 'en' = isAr ? 'ar' : 'en'
  const { workspace } = useGlobalFilter()
  const acc = workspace.accounting
  const rec = workspace.receivables
  const unavailableTooltip = getUnavailableTooltip(resolvedLocale)

  if (!workspace.odooConnected || workspace.noData) {
    return (
      <StateBlock
        state="unavailable"
        locale={resolvedLocale}
        title={isAr ? 'لا توجد بيانات من Odoo لهذه الفترة' : 'No Odoo GL data for this period'}
      />
    )
  }

  if (!acc.available) {
    return (
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {isAr
          ? acc.unavailableReasonAr ?? 'لم يُرحَّل بعد في أودو لهذه الفترة'
          : acc.unavailableReasonEn ?? 'Not yet posted in Odoo for this period'}
      </p>
    )
  }

  const dateRange = { from: acc.from || workspace.dateRange.from, to: acc.to || workspace.dateRange.to }

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
              {isAr ? 'قيود غير مكتملة لهذه الفترة' : 'Incomplete GL entries for this period'}
            </p>
            <p className="text-xs leading-relaxed opacity-90">
              {isAr
                ? acc.glWarningAr ??
                  workspace.glWarningAr ??
                  'لم يتم ترحيل جميع قيود الاستحقاق أو الإيجارات أو الرواتب أو عمولات المنصات في دفتر الأستاذ العام لهذه الفترة بعد.'
                : 'Full accrual entries (rent, payroll, or aggregator commissions) have not yet been posted in Odoo GL for this period.'}
            </p>
          </div>
        </div>
      )}

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
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {acc.totalRevenueKwd == null || workspace.nullableSalesKwd == null ? (
              <span title={unavailableTooltip}>
                {isAr ? 'فرق دفتر الأستاذ عن نقاط البيع: غير متاح' : 'GL versus POS gap: —'}
              </span>
            ) : isAr ? (
              <>
                صافي نقاط البيع{' '}
                <GlKwdValue value={workspace.nullableSalesKwd} locale="ar" /> · الفرق عن دفتر الأستاذ{' '}
                <GlKwdValue
                  value={acc.totalRevenueKwd - workspace.nullableSalesKwd}
                  locale="ar"
                />
              </>
            ) : (
              <>
                POS net <GlKwdValue value={workspace.nullableSalesKwd} locale="en" /> · gap versus GL{' '}
                <GlKwdValue
                  value={acc.totalRevenueKwd - workspace.nullableSalesKwd}
                  locale="en"
                />
              </>
            )}
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
              <li className="font-semibold text-amber-800 dark:text-amber-300">
                {isAr ? 'قائمة الحسابات: غير مُتحقق' : 'Account list: unverified'}
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
          <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            <GlKwdValue value={acc.cogsKwd} locale={resolvedLocale} />
          </p>
          {acc.cogsPct !== null && (
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
          <div className="mt-3">
            <KpiProvenanceBadge
              model="account.move.line"
              dateRange={dateRange}
              lastSyncAt={workspace.lastSyncAt}
              isStale24h={workspace.isStale24h}
              kind="فعلي"
              queryOrFormula="account.move.line aggregator commission expense accounts (parent_state='posted')"
              isAr={isAr}
            />
          </div>
        </article>

        <article className="ds-surface rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>{isAr ? 'المصاريف التشغيلية والإهلاك المرحلة' : 'Posted OPEX & Depreciation'}</span>
            <Scale className="h-4 w-4 text-indigo-600" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            <GlKwdValue value={acc.otherOpexAndDepreciationKwd} locale={resolvedLocale} />
          </p>
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
      </div>

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
