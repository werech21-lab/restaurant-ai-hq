'use client'

import React from 'react'
import { AlertCircle, AlertTriangle, BookOpen, Landmark, Receipt, Scale, TrendingUp } from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import KpiProvenanceBadge from '@/components/erp/KpiProvenanceBadge'

export interface OdooAccountingAnalyticsHubProps {
  isAr: boolean
  locale: string
  isAuditor?: boolean
}

export function OdooAccountingAnalyticsHub({
  isAr,
  isAuditor = false,
}: OdooAccountingAnalyticsHubProps) {
  const { workspace } = useGlobalFilter()
  const acc = workspace.accounting
  const rec = workspace.receivables

  const fmtKwd = (v: number | null | undefined) => {
    if (v === null || v === undefined || !Number.isFinite(v)) {
      return isAr ? 'غير متوفر' : 'Unavailable'
    }
    return `${v.toLocaleString('en-US', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })} ${isAr ? 'د.ك' : 'KWD'}`
  }

  if (!workspace.odooConnected || workspace.noData || !acc.available) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600 dark:text-amber-400" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          لا توجد بيانات من Odoo لهذه الفترة
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {isAr
            ? acc.unavailableReasonAr ?? 'تعذر جلب قيود دفتر الأستاذ العام (account.move.line) من Odoo للفترة المحددة.'
            : acc.unavailableReasonEn ?? 'Unable to retrieve posted general ledger lines (account.move.line) from Odoo for this period.'}
        </p>
      </section>
    )
  }

  const dateRange = { from: acc.from || workspace.dateRange.from, to: acc.to || workspace.dateRange.to }

  return (
    <div className="space-y-6">
      {(workspace.glIncomplete || acc.glIncomplete) && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1 text-sm">
            <p className="font-bold">قيود غير مكتملة لهذه الفترة</p>
            <p className="text-xs leading-relaxed opacity-90">
              {acc.glWarningAr ??
                workspace.glWarningAr ??
                (isAr
                  ? 'لم يتم ترحيل جميع قيود الاستحقاق أو الإيجارات أو الرواتب أو عمولات المنصات في دفتر الأستاذ العام لهذه الفترة بعد.'
                  : 'Full accrual entries (rent, payroll, or aggregator commissions) have not yet been posted in Odoo GL for this period.')}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{isAr ? 'إيرادات دفتر الأستاذ المرحلة' : 'Posted GL Revenue'}</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
            {fmtKwd(acc.totalRevenueKwd)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {isAr
              ? `${acc.lineCount.toLocaleString('en-US')} قيد مرحّل في الفترة`
              : `${acc.lineCount.toLocaleString('en-US')} posted journal lines`}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            {isAr ? 'يشمل إيرادات غير الكاشير' : 'Includes non-cashier revenue'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {acc.totalRevenueKwd == null || workspace.nullableSalesKwd == null
              ? isAr
                ? 'فرق دفتر الأستاذ عن نقاط البيع: غير متاح'
                : 'GL versus POS gap: —'
              : isAr
                ? `صافي نقاط البيع ${fmtKwd(workspace.nullableSalesKwd)} · الفرق عن دفتر الأستاذ ${fmtKwd(
                    acc.totalRevenueKwd - workspace.nullableSalesKwd,
                  )}`
                : `POS net ${fmtKwd(workspace.nullableSalesKwd)} · gap versus GL ${fmtKwd(
                    acc.totalRevenueKwd - workspace.nullableSalesKwd,
                  )}`}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {(acc.revenueAccounts ?? []).length > 0 ? (
              acc.revenueAccounts?.map((account) => (
                <li key={`${account.code}-${account.name}`}>
                  {account.code} {account.name} · {fmtKwd(account.amountKwd)} ·{' '}
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

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{isAr ? 'تكلفة البضاعة المباعة المرحلة (COGS)' : 'Posted GL COGS'}</span>
            <Receipt className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
            {fmtKwd(acc.cogsKwd)}
          </p>
          {acc.cogsPct !== null && (
            <p className="mt-1 text-xs text-slate-500">
              {isAr ? `${acc.cogsPct.toFixed(1)}% من الإيراد المرحل` : `${acc.cogsPct.toFixed(1)}% of posted revenue`}
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

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{isAr ? 'عمولات منصات التوصيل المرحلة' : 'Posted Aggregator Commissions'}</span>
            <BookOpen className="h-4 w-4 text-amber-600" />
          </div>
          {workspace.aggregatorCommissionUnposted || acc.aggregatorCommissionUnposted ? (
            <p className="mt-2 text-xl font-extrabold text-amber-700 dark:text-amber-400">
              غير مُرحَّل بعد
            </p>
          ) : (
            <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
              {fmtKwd(acc.deliveryCommissionsKwd)}
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

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{isAr ? 'المصاريف التشغيلية والإهلاك المرحلة' : 'Posted OPEX & Depreciation'}</span>
            <Scale className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
            {fmtKwd(acc.otherOpexAndDepreciationKwd)}
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

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{isAr ? 'صافي النتيجة الدفترية المرحلة' : 'Posted Operating Result'}</span>
            <Landmark className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
            {fmtKwd(acc.operatingProfitKwd)}
          </p>
          {(workspace.glIncomplete || acc.glIncomplete) && (
            <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
              قيود غير مكتملة لهذه الفترة
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

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{isAr ? 'صافي الذمم المدينة المفتوحة' : 'Net Open Receivables (AR)'}</span>
            <Landmark className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
            {rec.unavailable ? (isAr ? 'غير متاح' : '—') : fmtKwd(rec.openReceivableKwd)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {rec.unavailable
              ? isAr
                ? 'غير متاح'
                : '—'
              : isAr
                ? `${rec.unreconciledLineCount.toLocaleString('en-US')} سطر ذمم غير مسوّى`
                : `${rec.unreconciledLineCount.toLocaleString('en-US')} unreconciled AR lines`}
          </p>
          <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
            {isAr
              ? 'أعمار الذمم حسب الشريك (0–30 / 31–60 / +60): غير مُتحقق'
              : 'Partner ageing (0–30 / 31–60 / 60+): unverified'}
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
