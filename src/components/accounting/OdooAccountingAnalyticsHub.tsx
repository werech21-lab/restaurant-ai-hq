'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Landmark,
  Receipt,
  Scale,
  ShoppingBag,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { lastClosedMonthRange } from '@/lib/aether/closed-month-policy'
import KpiProvenanceBadge from '@/components/erp/KpiProvenanceBadge'
import { StateBlock } from '@/components/ui'
import { CompactInfoTooltip } from '@/components/ui/compact-info-tooltip'
import {
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

function resolveHubKpiGridCols(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 md:grid-cols-2'
  if (count === 3 || count === 6) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
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
  const { workspace, setCustomRange } = useGlobalFilter()
  const acc = workspace.accounting
  const rec = workspace.receivables
  const closedMonth = lastClosedMonthRange(acc.glClosedThroughDate)

  const dateRange = useMemo(
    () => ({
      from: acc.from || workspace.dateRange.from,
      to: acc.to || workspace.dateRange.to,
    }),
    [acc.from, acc.to, workspace.dateRange.from, workspace.dateRange.to],
  )

  const commissionUnposted = Boolean(
    workspace.aggregatorCommissionUnposted ||
      acc.aggregatorCommissionUnposted ||
      acc.deliveryCommissionsKwd === null,
  )

  const scopeTooltipText = useMemo(() => {
    const notes: string[] = []
    if (!acc.available) {
      notes.push(
        isAr
          ? acc.unavailableReasonAr ?? 'قيود الاستحقاق الشهرية لم تُرحَّل بعد لهذه الفترة القصيرة.'
          : acc.unavailableReasonEn ?? 'Month-end GL accrual entries are not posted yet for this short window.',
      )
    }
    if (acc.netProfitWithheld) {
      notes.push(
        isAr
          ? acc.netProfitWithheldReasonAr ?? ''
          : acc.netProfitWithheldReasonEn ?? '',
      )
    }
    if (!isAuditor) {
      notes.push(
        isAr
          ? 'تُقرأ الأرقام حصراً من قيود دفتر الأستاذ العام المرحّلة في أودو دون أي تقديرات اصطناعية.'
          : 'Evaluated strictly from posted Odoo account.move.line entries with zero synthetic estimates.',
      )
    }
    return notes.filter((n) => n.trim().length > 0).join(' — ')
  }, [
    acc.available,
    acc.netProfitWithheld,
    acc.netProfitWithheldReasonAr,
    acc.netProfitWithheldReasonEn,
    acc.unavailableReasonAr,
    acc.unavailableReasonEn,
    isAr,
    isAuditor,
  ])

  // Deterministic Executive Odoo Intelligence & Recommendations (100% live Odoo figures)
  const aiInsights = useMemo(() => {
    if (!workspace.odooConnected || workspace.noData) return []
    const list: Array<{ id: string; title: string; body: string }> = []

    if (acc.available && acc.totalRevenueKwd !== null && acc.totalRevenueKwd > 0) {
      const totalPostedCosts =
        (acc.cogsKwd ?? 0) +
        (!commissionUnposted ? (acc.deliveryCommissionsKwd ?? 0) : 0) +
        (acc.otherOpexAndDepreciationKwd ?? 0)
      const costRatioPct = (totalPostedCosts / acc.totalRevenueKwd) * 100
      list.push({
        id: 'rev-vs-expense',
        title: isAr ? 'نسبة المصروفات المرحلة إلى الإيراد' : 'Posted Cost-to-Revenue Ratio',
        body: isAr
          ? `إجمالي الإيرادات المرحلة ${formatKwd(acc.totalRevenueKwd, 'ar')} مقابل مصروفات وتكاليف مرحلة بقيمة ${formatKwd(totalPostedCosts, 'ar')} (${formatPct(costRatioPct, 'ar')} من الإيراد عبر ${formatInt(acc.lineCount, 'ar')} قيد).`
          : `Posted GL revenue of ${formatKwd(acc.totalRevenueKwd, 'en')} vs ${formatKwd(totalPostedCosts, 'en')} in posted costs (${formatPct(costRatioPct, 'en')} of revenue across ${formatInt(acc.lineCount, 'en')} move lines).`,
      })
    } else if (workspace.nullableSalesKwd !== null) {
      list.push({
        id: 'live-pos-accrual',
        title: isAr ? 'إيرادات نقاط البيع وحالة الترحيل' : 'Live POS Revenue & GL Close Status',
        body: isAr
          ? `صافي مبيعات نقاط البيع الفعلي للفترة يبلغ ${formatKwd(workspace.nullableSalesKwd, 'ar')}${workspace.nullableOrders !== null ? ` (${formatInt(workspace.nullableOrders, 'ar')} طلب)` : ''}؛ مصروفات الإقفال الشهري في الدفتر العام تُعتمد بنهاية الشهر${closedMonth ? ` (مقفل حتى ${closedMonth.to})` : ''}.`
          : `Live POS net sales stand at ${formatKwd(workspace.nullableSalesKwd, 'en')}${workspace.nullableOrders !== null ? ` (${formatInt(workspace.nullableOrders, 'en')} orders)` : ''}; monthly GL accrual expenses post at month-end close${closedMonth ? ` (closed through ${closedMonth.to})` : ''}.`,
      })
    }

    const costDrivers = [
      {
        id: 'cogs',
        labelAr: 'تكلفة البضاعة المباعة والمواد',
        labelEn: 'Food & Packaging COGS',
        val: acc.cogsKwd,
        pct: acc.cogsPct,
      },
      {
        id: 'opex',
        labelAr: 'المصاريف التشغيلية والإهلاك',
        labelEn: 'OPEX, Rent & Depreciation',
        val: acc.otherOpexAndDepreciationKwd,
        pct: acc.opexRentDeprPct,
      },
      {
        id: 'comm',
        labelAr: 'عمولات منصات التوصيل',
        labelEn: 'Aggregator Commissions',
        val: commissionUnposted ? null : acc.deliveryCommissionsKwd,
        pct: commissionUnposted ? null : acc.deliveryCommPct,
      },
    ]
      .filter((d): d is typeof d & { val: number } => typeof d.val === 'number' && d.val > 0.0005)
      .sort((a, b) => b.val - a.val)

    if (costDrivers[0]) {
      const top = costDrivers[0]
      list.push({
        id: 'top-cost-driver',
        title: isAr ? 'أكبر محرّك للتكاليف المرحلة' : 'Primary Posted Cost Driver',
        body: isAr
          ? `${top.labelAr} يتصدر بنود التكلفة المرحلة بقيمة ${formatKwd(top.val, 'ar')}${top.pct !== null ? ` (${formatPct(top.pct, 'ar')} من الإيراد المرحل)` : ''}.`
          : `${top.labelEn} is the largest posted expense driver at ${formatKwd(top.val, 'en')}${top.pct !== null ? ` (${formatPct(top.pct, 'en')} of posted GL revenue)` : ''}.`,
      })
    }

    if (!rec.unavailable && rec.figures?.netKwd != null) {
      const debits = rec.figures.openDebitsKwd
      const credits = rec.figures.unappliedCreditsKwd
      list.push({
        id: 'ar-status',
        title: isAr ? 'وضع الذمم المدينة المفتوحة والمقاصة' : 'Open Receivables & Clearing Position',
        body: isAr
          ? `صافي الذمم المفتوحة يبلغ ${formatKwd(rec.figures.netKwd, 'ar')} (${debits !== null ? `مدين ${formatKwd(debits, 'ar')}` : ''}${credits !== null ? ` مقابل دائن غير مطبق ${formatKwd(credits, 'ar')}` : ''}) عبر ${formatInt(rec.unreconciledLineCount, 'ar')} سطر غير مسوّى.`
          : `Net open receivables total ${formatKwd(rec.figures.netKwd, 'en')} (${debits !== null ? `${formatKwd(debits, 'en')} open debits` : ''}${credits !== null ? ` vs ${formatKwd(credits, 'en')} unapplied credits` : ''}) across ${formatInt(rec.unreconciledLineCount, 'en')} unreconciled lines.`,
      })
    }

    return list
  }, [
    acc.available,
    acc.cogsKwd,
    acc.cogsPct,
    acc.deliveryCommPct,
    acc.deliveryCommissionsKwd,
    acc.lineCount,
    acc.opexRentDeprPct,
    acc.otherOpexAndDepreciationKwd,
    acc.totalRevenueKwd,
    closedMonth,
    commissionUnposted,
    isAr,
    rec.figures,
    rec.unavailable,
    rec.unreconciledLineCount,
    workspace.noData,
    workspace.nullableOrders,
    workspace.nullableSalesKwd,
    workspace.odooConnected,
  ])

  const kpiCards = useMemo(() => {
    const cards: Array<{ key: string; node: React.ReactNode }> = []

    if (acc.available && acc.totalRevenueKwd !== null) {
      cards.push({
        key: 'gl-revenue',
        node: (
          <article className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="min-w-0 truncate">{isAr ? 'إيرادات دفتر الأستاذ المرحلة' : 'Posted GL Revenue'}</span>
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              <GlKwdValue value={acc.totalRevenueKwd} locale={resolvedLocale} />
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {isAr
                ? `${formatInt(acc.lineCount, resolvedLocale)} قيد مرحّل في الفترة`
                : `${formatInt(acc.lineCount, resolvedLocale)} posted journal lines`}
            </p>
            {workspace.nullableSalesKwd !== null ? (
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                {isAr ? (
                  <>
                    صافي نقاط البيع <GlKwdValue value={workspace.nullableSalesKwd} locale="ar" /> · الفرق{' '}
                    <GlKwdValue value={acc.totalRevenueKwd - workspace.nullableSalesKwd} locale="ar" />
                  </>
                ) : (
                  <>
                    POS net <GlKwdValue value={workspace.nullableSalesKwd} locale="en" /> · gap{' '}
                    <GlKwdValue value={acc.totalRevenueKwd - workspace.nullableSalesKwd} locale="en" />
                  </>
                )}
              </p>
            ) : null}
            <div className="mt-3">
              <KpiProvenanceBadge
                model="account.move.line"
                dateRange={dateRange}
                lastSyncAt={workspace.lastSyncAt}
                isStale24h={workspace.isStale24h}
                kind="فعلي"
                queryOrFormula="SUM(credit - debit) ON income accounts WHERE parent_state = 'posted'"
                queryOrFormulaAr="مجموع (الدائن − المدين) على حسابات الإيرادات للقيود المرحّلة"
                isAr={isAr}
                compact
              />
            </div>
          </article>
        ),
      })
    } else if (workspace.nullableSalesKwd !== null) {
      cards.push({
        key: 'pos-net-sales',
        node: (
          <article className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="min-w-0 truncate">{isAr ? 'صافي مبيعات نقاط البيع الفعلي' : 'Live POS Net Sales'}</span>
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              <GlKwdValue value={workspace.nullableSalesKwd} locale={resolvedLocale} />
            </p>
            {workspace.nullableOrders !== null ? (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                {isAr
                  ? `${formatInt(workspace.nullableOrders, resolvedLocale)} طلب مقبوض في نقاط البيع`
                  : `${formatInt(workspace.nullableOrders, resolvedLocale)} settled POS orders`}
              </p>
            ) : null}
            <div className="mt-3">
              <KpiProvenanceBadge
                model="pos.order"
                dateRange={workspace.dateRange}
                lastSyncAt={workspace.lastSyncAt}
                isStale24h={workspace.isStale24h}
                kind="فعلي"
                queryOrFormula="pos.order net sales across mapped Venture Foods branches"
                queryOrFormulaAr="صافي مبيعات نقاط البيع عبر فروع فنتشر فودز المربوطة"
                isAr={isAr}
                compact
              />
            </div>
          </article>
        ),
      })
    }

    if (!acc.available && workspace.nullableAovKwd !== null) {
      cards.push({
        key: 'pos-aov',
        node: (
          <article className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="min-w-0 truncate">{isAr ? 'متوسط قيمة الطلب' : 'Average Order Value (AOV)'}</span>
              <ShoppingBag className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              <GlKwdValue value={workspace.nullableAovKwd} locale={resolvedLocale} />
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {isAr ? 'صافي المبيعات ÷ عدد الطلبات' : 'Net sales ÷ settled orders'}
            </p>
            <div className="mt-3">
              <KpiProvenanceBadge
                model="pos.order"
                dateRange={workspace.dateRange}
                lastSyncAt={workspace.lastSyncAt}
                isStale24h={workspace.isStale24h}
                kind="محسوب بمعادلة"
                queryOrFormula="netSalesKwd / orders"
                queryOrFormulaAr="صافي المبيعات ÷ عدد الطلبات المقبوضة"
                isAr={isAr}
                compact
              />
            </div>
          </article>
        ),
      })
    }

    if (acc.available && acc.cogsKwd !== null) {
      cards.push({
        key: 'gl-cogs',
        node: (
          <article className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="min-w-0 truncate">{isAr ? 'تكلفة البضاعة المباعة المرحّلة' : 'Posted GL COGS'}</span>
              <Receipt className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              <GlKwdValue value={acc.cogsKwd} locale={resolvedLocale} />
            </p>
            {acc.cogsPct !== null ? (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                <span dir="ltr" className="ds-num tabular-nums">
                  {formatPct(acc.cogsPct, resolvedLocale)}
                </span>{' '}
                {isAr ? 'من الإيراد المرحل' : 'of posted revenue'}
              </p>
            ) : null}
            <div className="mt-3">
              <KpiProvenanceBadge
                model="account.move.line"
                dateRange={dateRange}
                lastSyncAt={workspace.lastSyncAt}
                isStale24h={workspace.isStale24h}
                kind="فعلي"
                queryOrFormula="SUM(debit - credit) ON direct_cost accounts WHERE parent_state = 'posted'"
                queryOrFormulaAr="مجموع (المدين − الدائن) على حسابات تكلفة البضاعة المباعة للقيود المرحّلة"
                isAr={isAr}
                compact
              />
            </div>
          </article>
        ),
      })
    }

    if (acc.available && !commissionUnposted && acc.deliveryCommissionsKwd !== null) {
      cards.push({
        key: 'gl-commissions',
        node: (
          <article className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="min-w-0 truncate">{isAr ? 'عمولات منصات التوصيل المرحلة' : 'Posted Aggregator Commissions'}</span>
              <BookOpen className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              <GlKwdValue value={acc.deliveryCommissionsKwd} locale={resolvedLocale} />
            </p>
            {acc.deliveryCommPct !== null ? (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                <span dir="ltr" className="ds-num tabular-nums">
                  {formatPct(acc.deliveryCommPct, resolvedLocale)}
                </span>{' '}
                {isAr ? 'من الإيراد المرحل' : 'of posted revenue'}
              </p>
            ) : null}
            <div className="mt-3">
              <KpiProvenanceBadge
                model="account.move.line"
                dateRange={dateRange}
                lastSyncAt={workspace.lastSyncAt}
                isStale24h={workspace.isStale24h}
                kind="فعلي"
                queryOrFormula="account.move.line aggregator commission expense accounts (parent_state='posted')"
                queryOrFormulaAr="قيود الأستاذ العام المرحّلة لحسابات مصروف عمولات منصات التوصيل"
                isAr={isAr}
                compact
              />
            </div>
          </article>
        ),
      })
    }

    if (acc.available && acc.otherOpexAndDepreciationKwd !== null) {
      cards.push({
        key: 'gl-opex',
        node: (
          <article className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="min-w-0 truncate">{isAr ? 'المصاريف التشغيلية والإهلاك المرحلة' : 'Posted OPEX & Depreciation'}</span>
              <Scale className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              <GlKwdValue value={acc.otherOpexAndDepreciationKwd} locale={resolvedLocale} />
            </p>
            {acc.opexRentDeprPct !== null ? (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                <span dir="ltr" className="ds-num tabular-nums">
                  {formatPct(acc.opexRentDeprPct, resolvedLocale)}
                </span>{' '}
                {isAr ? 'من الإيراد المرحل' : 'of posted revenue'}
              </p>
            ) : null}
            <div className="mt-3">
              <KpiProvenanceBadge
                model="account.move.line"
                dateRange={dateRange}
                lastSyncAt={workspace.lastSyncAt}
                isStale24h={workspace.isStale24h}
                kind="فعلي"
                queryOrFormula="SUM(debit - credit) ON expense + expense_depreciation accounts WHERE parent_state = 'posted'"
                queryOrFormulaAr="مجموع (المدين − الدائن) على حسابات المصروفات التشغيلية والإهلاك المرحّلة"
                isAr={isAr}
                compact
              />
            </div>
          </article>
        ),
      })
    }

    if (acc.available && acc.operatingProfitKwd !== null && !acc.netProfitWithheld) {
      cards.push({
        key: 'gl-operating-result',
        node: (
          <article className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="min-w-0 truncate">{isAr ? 'صافي النتيجة الدفترية المرحلة' : 'Posted Operating Result'}</span>
              <Landmark className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
              <GlKwdValue value={acc.operatingProfitKwd} locale={resolvedLocale} />
            </p>
            {acc.netProfitPct !== null ? (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                <span dir="ltr" className="ds-num tabular-nums">
                  {formatPct(acc.netProfitPct, resolvedLocale)}
                </span>{' '}
                {isAr ? 'صافي هامش التشغيل' : 'operating margin'}
              </p>
            ) : null}
            <div className="mt-3">
              <KpiProvenanceBadge
                model="account.move.line"
                dateRange={dateRange}
                lastSyncAt={workspace.lastSyncAt}
                isStale24h={workspace.isStale24h}
                kind="محسوب بمعادلة"
                queryOrFormula="Posted Revenue - COGS - Aggregator Commissions - Posted OPEX & Depreciation"
                queryOrFormulaAr="الإيراد المرحّل − تكلفة البضاعة المباعة − عمولات التوصيل − المصروفات والإهلاك المرحّلة"
                isAr={isAr}
                compact
              />
            </div>
          </article>
        ),
      })
    }

    if (!rec.unavailable && rec.figures?.netKwd != null) {
      cards.push({
        key: 'ar-open',
        node: (
          <article className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="min-w-0 truncate">{isAr ? 'صافي الذمم المدينة المفتوحة' : 'Net Open Receivables (AR)'}</span>
              <Landmark className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
            </div>
            <div
              dir="ltr"
              className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white"
            >
              {formatKwd(rec.figures.netKwd, resolvedLocale)}
            </div>
            <p
              dir="ltr"
              className="mt-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums"
            >
              {isAr
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
                queryOrFormulaAr="مجموع الرصيد المتبقي على حسابات الذمم المدينة غير المسوّاة"
                isAr={isAr}
                compact
              />
            </div>
          </article>
        ),
      })
    }

    return cards
  }, [
    acc.available,
    acc.cogsKwd,
    acc.cogsPct,
    acc.deliveryCommPct,
    acc.deliveryCommissionsKwd,
    acc.lineCount,
    acc.netProfitPct,
    acc.netProfitWithheld,
    acc.operatingProfitKwd,
    acc.opexRentDeprPct,
    acc.otherOpexAndDepreciationKwd,
    acc.totalRevenueKwd,
    commissionUnposted,
    dateRange,
    isAr,
    rec.figures,
    rec.fromDate,
    rec.toDate,
    rec.unavailable,
    rec.unreconciledLineCount,
    resolvedLocale,
    workspace.dateRange,
    workspace.isStale24h,
    workspace.lastSyncAt,
    workspace.nullableAovKwd,
    workspace.nullableOrders,
    workspace.nullableSalesKwd,
  ])

  if (!workspace.odooConnected || workspace.noData) {
    return (
      <StateBlock
        state="unavailable"
        locale={resolvedLocale}
        title={isAr ? 'لا توجد بيانات من Odoo لهذه الفترة' : 'No Odoo GL data for this period'}
      />
    )
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-6">
      {/* Scope Bar + Quick Closed Month Action */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
            {isAr ? 'المؤشرات المالية التنفيذية من أودو 17' : 'Executive Odoo 17 Financial Indicators'}
          </h3>
          {scopeTooltipText ? (
            <CompactInfoTooltip
              text={scopeTooltipText}
              label={isAr ? 'نطاق الترحيل والرقابة المحاسبية' : 'Accounting Posting & Control Scope'}
              isAr={isAr}
              dataNetProfitWithheld={acc.netProfitWithheld}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!acc.available && closedMonth ? (
            <button
              type="button"
              onClick={() => setCustomRange(closedMonth.from, closedMonth.to)}
              className="ds-focus-ring inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-300"
            >
              {isAr ? 'فتح آخر شهر مُقفل' : 'Inspect Last Closed Month'}
            </button>
          ) : null}
          <Link
            href="/erp/executive-pnl"
            className="ds-focus-ring inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-emerald-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <span>{isAr ? 'قائمة الدخل' : 'Income Statement'}</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      {/* 1. Dynamic Executive KPI Grid */}
      {kpiCards.length === 5 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {kpiCards.slice(0, 3).map((item) => (
              <React.Fragment key={item.key}>{item.node}</React.Fragment>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {kpiCards.slice(3).map((item) => (
              <React.Fragment key={item.key}>{item.node}</React.Fragment>
            ))}
          </div>
        </div>
      ) : kpiCards.length > 0 ? (
        <div className={`grid gap-4 ${resolveHubKpiGridCols(kpiCards.length)}`}>
          {kpiCards.map((item) => (
            <React.Fragment key={item.key}>{item.node}</React.Fragment>
          ))}
        </div>
      ) : null}

      {/* 2. Executive Odoo Intelligence & Recommendations Strip */}
      {aiInsights.length > 0 ? (
        <section
          data-finance-ai-insights="true"
          className="ds-surface relative overflow-visible rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-50/70 via-white to-sky-50/50 p-4 sm:p-5 shadow-xs dark:border-emerald-400/20 dark:from-[#0f1d18] dark:via-slate-900 dark:to-[#0f1a24]"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">
              {isAr
                ? 'الرؤى المالية والتوصيات التنفيذية من دفتر الأستاذ (أودو 17)'
                : 'Executive General Ledger Intelligence & Recommendations (Odoo 17)'}
            </h3>
          </div>
          <div
            className={`grid gap-3 ${
              aiInsights.length === 1
                ? 'grid-cols-1'
                : aiInsights.length === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : 'grid-cols-1 lg:grid-cols-3'
            }`}
          >
            {aiInsights.map((insight) => (
              <div
                key={insight.id}
                className="rounded-xl border border-slate-200/80 bg-white/90 p-3.5 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <p className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                  {insight.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                  {insight.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 3. Visual Financial Allocation Bar (Posted GL Cost Split or Live AR Aging Split) */}
      {acc.available && acc.totalRevenueKwd !== null && acc.totalRevenueKwd > 0 ? (
        <section className="ds-surface relative overflow-visible rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h4 className="mb-3 text-sm font-extrabold text-slate-900 dark:text-white">
            {isAr ? 'توزيع الإيرادات المرحلة على بنود التكلفة والصافي' : 'Posted GL Revenue Allocation Breakdown'}
          </h4>
          <div className="space-y-3">
            {[
              {
                key: 'cogs',
                label: isAr ? 'تكلفة البضاعة المباعة' : 'Food & Packaging COGS',
                val: acc.cogsKwd,
                pct: acc.cogsPct,
                barCls: 'bg-rose-500',
              },
              {
                key: 'comm',
                label: isAr ? 'عمولات منصات التوصيل' : 'Aggregator Commissions',
                val: commissionUnposted ? null : acc.deliveryCommissionsKwd,
                pct: commissionUnposted ? null : acc.deliveryCommPct,
                barCls: 'bg-sky-500',
              },
              {
                key: 'opex',
                label: isAr ? 'المصاريف التشغيلية والإهلاك' : 'OPEX, Rent & Depreciation',
                val: acc.otherOpexAndDepreciationKwd,
                pct: acc.opexRentDeprPct,
                barCls: 'bg-indigo-500',
              },
              {
                key: 'net',
                label: isAr ? 'صافي النتيجة التشغيلية' : 'Operating Result',
                val: acc.netProfitWithheld ? null : acc.operatingProfitKwd,
                pct: acc.netProfitWithheld ? null : acc.netProfitPct,
                barCls: 'bg-emerald-600',
              },
            ]
              .filter((r): r is typeof r & { val: number } => typeof r.val === 'number')
              .map((row) => {
                const widthPct = Math.min(100, Math.max(2, Math.abs(row.pct ?? 0)))
                return (
                  <div key={row.key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-semibold text-slate-700 dark:text-slate-200">{row.label}</span>
                      <span dir="ltr" className="shrink-0 whitespace-nowrap font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatKwd(row.val, resolvedLocale)}
                        {row.pct !== null ? ` (${formatPct(row.pct, resolvedLocale)})` : ''}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-full rounded-full ${row.barCls}`} style={{ width: `${widthPct}%` }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      ) : !rec.unavailable && rec.agingBuckets.length > 0 ? (
        <section className="ds-surface relative overflow-visible rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {isAr ? 'ملخص أعمار الذمم المدينة المفتوحة (أودو 17)' : 'Open Receivables Aging Snapshot (Odoo 17)'}
            </h4>
            <Link
              href="/erp/receivables"
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-300"
            >
              <span>{isAr ? 'تفاصيل الذمم والتسويات' : 'Open AR Aging Studio'}</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <div
            className={`grid gap-3 ${
              rec.agingBuckets.length === 1
                ? 'grid-cols-1'
                : rec.agingBuckets.length === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : 'grid-cols-1 md:grid-cols-3'
            }`}
          >
            {rec.agingBuckets.map((b) => (
              <div
                key={b.key}
                className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/75 p-3.5 dark:border-slate-800 dark:bg-white/[0.03]"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate font-bold text-slate-700 dark:text-slate-200">
                    {isAr ? b.labelAr : b.labelEn}
                  </span>
                  <span dir="ltr" className="shrink-0 whitespace-nowrap tabular-nums text-slate-500">
                    {formatInt(b.linesCount, resolvedLocale)}
                  </span>
                </div>
                <p dir="ltr" className="mt-1.5 text-lg font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatKwd(b.residualKwd, resolvedLocale)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 4. Collapsible Revenue Accounts Breakdown (when populated) */}
      {(acc.revenueAccounts ?? []).length > 0 ? (
        <details
          data-ledger-collapsible="revenue-accounts"
          className="group relative overflow-visible rounded-2xl border border-slate-200/85 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
              <span className="min-w-0 truncate text-xs font-extrabold text-slate-900 dark:text-white">
                {isAr ? 'حسابات الإيرادات المرحلة في دفتر الأستاذ' : 'Posted GL Revenue Accounts'}
              </span>
              <span dir="ltr" className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-700 dark:bg-white/10 dark:text-slate-200">
                {formatInt(acc.revenueAccounts?.length ?? 0, resolvedLocale)}
              </span>
            </div>
            <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {isAr ? 'عرض / طي' : 'Expand / Collapse'}
            </span>
          </summary>
          <ul className="mt-3 divide-y divide-slate-100 text-xs tabular-nums text-slate-700 dark:divide-slate-800 dark:text-slate-200">
            {acc.revenueAccounts?.map((account) => (
              <li key={`${account.code}-${account.name}`} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate">
                  <span dir="ltr" className="font-mono font-semibold text-slate-500">
                    {account.code}
                  </span>{' '}
                  {account.name}
                </span>
                <GlKwdValue value={account.amountKwd} locale={resolvedLocale} className="shrink-0 whitespace-nowrap font-bold" />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
