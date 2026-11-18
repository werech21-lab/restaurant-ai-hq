'use client'

import React from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarRange,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Layers,
  Users,
  Wallet,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { useLang } from '@/components/aether/ui'
import { PartialWarningBanner, StateBlock } from '@/components/ui'
import { ReceivablesPendingStatus } from '@/components/ui/receivables-pending-status'
import { canShowReceivableAmounts } from '@/lib/aether/receivables-status'
import {
  formatInt,
  formatKuwaitDate,
  formatKuwaitDateTime,
  formatKwd,
} from '@/lib/format'
import type { OdooPartnerAgingRow, OdooReceivableAccountRow } from '@/lib/odoo/live-sync-core'

function PartnerAgingTable({
  rows,
  isAr,
  locale,
  kind,
}: {
  rows: readonly OdooPartnerAgingRow[]
  isAr: boolean
  locale: 'ar' | 'en'
  kind: 'ar' | 'ap'
}) {
  if (rows.length === 0) {
    return (
      <StateBlock
        state="empty"
        locale={locale}
        compact
        title={
          kind === 'ar'
            ? isAr
              ? 'لا توجد أرصدة مفتوحة حسب الشريك'
              : 'No partner receivable rows recorded'
            : isAr
              ? 'لا توجد ذمم دائنة مفتوحة حسب المورد'
              : 'No partner payable rows recorded'
        }
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-white/10">
      <table className="w-full min-w-[780px] border-collapse text-sm">
        <thead className="bg-[#F6F7F8] text-slate-600 dark:bg-[#09110E] dark:text-slate-300">
          <tr>
            <th className="px-4 py-3 text-start text-xs font-bold">
              {kind === 'ar'
                ? isAr
                  ? 'الشريك / العميل'
                  : 'Partner / Customer'
                : isAr
                  ? 'المورد / الشريك'
                  : 'Vendor / Partner'}
            </th>
            <th className="px-3 py-3 text-end text-xs font-bold">
              {kind === 'ar' ? (isAr ? '0–30 يوماً' : '0–30d') : isAr ? '0–30 يوماً' : '0–30d'}
            </th>
            <th className="px-3 py-3 text-end text-xs font-bold">
              {isAr ? '31–60 يوماً' : '31–60d'}
            </th>
            <th className="px-3 py-3 text-end text-xs font-bold">
              {isAr ? '+60 يوماً' : '60d+'}
            </th>
            <th className="px-3 py-3 text-end text-xs font-bold">
              {kind === 'ar'
                ? isAr
                  ? 'دفعات غير مطبقة'
                  : 'Unapplied Credits'
                : isAr
                  ? 'مدفوعات مقدمة'
                  : 'Unapplied Debits'}
            </th>
            <th className="px-3 py-3 text-end text-xs font-bold">
              {isAr ? 'عدد السطور' : 'Lines'}
            </th>
            <th className="px-4 py-3 text-end text-xs font-bold">
              {isAr ? 'صافي الرصيد' : 'Net Residual'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
          {rows.map((row) => {
            const b0 = row.buckets.find((b) => b.key === '0_30')?.residualKwd ?? 0
            const b1 = row.buckets.find((b) => b.key === '31_60')?.residualKwd ?? 0
            const b2 = row.buckets.find((b) => b.key === 'over_60')?.residualKwd ?? 0
            return (
              <tr
                key={`${row.partnerId ?? 'none'}-${row.partnerName}`}
                className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                  {row.partnerName}
                </td>
                <td dir="ltr" className="ds-num px-3 py-3 text-end font-mono text-xs tabular-nums">
                  {formatKwd(b0, locale)}
                </td>
                <td dir="ltr" className="ds-num px-3 py-3 text-end font-mono text-xs tabular-nums">
                  {formatKwd(b1, locale)}
                </td>
                <td dir="ltr" className="ds-num px-3 py-3 text-end font-mono text-xs tabular-nums">
                  {formatKwd(b2, locale)}
                </td>
                <td
                  dir="ltr"
                  className="ds-num px-3 py-3 text-end font-mono text-xs tabular-nums text-sky-700 dark:text-sky-300"
                >
                  {formatKwd(row.unappliedCreditsKwd, locale)}
                </td>
                <td
                  dir="ltr"
                  className="ds-num px-3 py-3 text-end font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300"
                >
                  {formatInt(row.linesCount, locale)}
                </td>
                <td
                  dir="ltr"
                  className={`ds-num px-4 py-3 text-end font-mono font-bold tabular-nums ${
                    row.residualKwd < 0
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {formatKwd(row.residualKwd, { locale, signed: true })}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AccountAgingTable({
  rows,
  isAr,
  locale,
  kind,
}: {
  rows: readonly OdooReceivableAccountRow[]
  isAr: boolean
  locale: 'ar' | 'en'
  kind: 'ar' | 'ap'
}) {
  if (rows.length === 0) {
    return (
      <StateBlock
        state="empty"
        locale={locale}
        compact
        title={
          kind === 'ar'
            ? isAr
              ? 'لا توجد حسابات ذمم مدينة مفتوحة'
              : 'No open receivable accounts'
            : isAr
              ? 'لا توجد حسابات ذمم دائنة مفتوحة'
              : 'No open payable accounts'
        }
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-white/10">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead className="bg-[#F6F7F8] text-slate-600 dark:bg-[#09110E] dark:text-slate-300">
          <tr>
            <th className="px-4 py-3 text-start text-xs font-bold">
              {isAr ? 'رمز الحساب' : 'Code'}
            </th>
            <th className="px-4 py-3 text-start text-xs font-bold">
              {kind === 'ar'
                ? isAr
                  ? 'المنصة / حساب الذمم المدينة'
                  : 'Platform / Receivable Account'
                : isAr
                  ? 'حساب الذمم الدائنة'
                  : 'Payable Account'}
            </th>
            <th className="px-4 py-3 text-end text-xs font-bold">
              {isAr ? 'عدد القيود المفتوحة' : 'Unreconciled Lines'}
            </th>
            <th className="px-4 py-3 text-end text-xs font-bold">
              {isAr ? 'الرصيد الصافي المفتوح' : 'Net Residual Balance'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
          {rows.map((row) => (
            <tr key={row.accountId} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
              <td
                dir="ltr"
                className="px-4 py-3 font-mono text-xs font-bold text-slate-700 dark:text-emerald-300"
              >
                {row.accountCode}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                {isAr ? row.labelAr : row.labelEn}
              </td>
              <td
                dir="ltr"
                className="px-4 py-3 text-end font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300"
              >
                {formatInt(row.linesCount, locale)}
              </td>
              <td
                dir="ltr"
                className={`ds-num px-4 py-3 text-end font-mono font-bold tabular-nums ${
                  row.residualKwd < 0
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {formatKwd(row.residualKwd, { locale, signed: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Receivables & Payables Aging Studio (`/erp/receivables`).
 * Keeps all monetary amounts hidden behind `PER_CUSTOMER_DUE_DATE_AGING_VERIFIED` while surfacing
 * real non-amount ledger facts (line counts, partner count, date span, and active accounts).
 */
export function ReceivablesAgingStudio() {
  const { isAr, T } = useLang()
  const resolvedLocale: 'ar' | 'en' = isAr ? 'ar' : 'en'
  const { workspace, liveSummary, syncingOdoo } = useGlobalFilter()
  const ar = workspace.receivables
  const amountsVisible = canShowReceivableAmounts(ar)

  const syncStamp = liveSummary?.kuwaitSyncedAt
    ? liveSummary.kuwaitSyncedAt
    : formatKuwaitDateTime(
        liveSummary?.latestOdooRecordAt ?? liveSummary?.syncedAt ?? null,
        resolvedLocale,
      )
  const asOfDisplay = ar.asOfDate ? formatKuwaitDate(ar.asOfDate, resolvedLocale) : syncStamp
  const companyScopeId = ar.companyId ?? workspace.odooCompanyId ?? liveSummary?.odooCompanyId ?? null

  const hasValidSpan = Boolean(ar.fromDate && ar.toDate)
  const fromFormatted = formatKuwaitDate(ar.fromDate, resolvedLocale)
  const toFormatted = formatKuwaitDate(ar.toDate, resolvedLocale)
  const maturityFormatted = ar.latestMaturityDate
    ? formatKuwaitDate(ar.latestMaturityDate, resolvedLocale)
    : isAr
      ? 'حالي'
      : 'Current'

  const accountNamesList = ar.accountNames ?? []
  const partnerRows = ar.byPartner ?? []
  const apAging = ar.apAging

  if (syncingOdoo && !liveSummary) {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-5 pb-12">
        <StateBlock
          state="loading"
          locale={resolvedLocale}
          skeletonRows={5}
          title={isAr ? 'جارٍ تحميل ذمم المنصات وأعمار الديون…' : 'Loading receivables aging…'}
        />
      </div>
    )
  }

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-[1920px] mx-auto space-y-5 pb-12 text-slate-900 dark:text-slate-100 min-w-0"
    >
      {/* Header Banner */}
      <section className="ae-bento-card ds-surface rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.1]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-500/25 dark:bg-amber-500/15 dark:text-amber-200">
                <Wallet className="h-3.5 w-3.5" aria-hidden />
                <span>
                  {T(
                    'Odoo 17 Receivable Ledger (account.move.line · reconciled=false)',
                    'دفتر ذمم أودو 17 غير المسوّاة (account.move.line · reconciled=false)',
                  )}
                </span>
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 ring-1 ring-slate-300/60 dark:bg-white/[0.07] dark:text-slate-200 dark:ring-white/10">
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                <span>
                  {isAr
                    ? `نطاق الشركة: فنتشر فودز لإدارة المطاعم ذ.م.م${companyScopeId ? ` (#${companyScopeId})` : ''}`
                    : `Company Scope: Venture Foods W.L.L.${companyScopeId ? ` (#${companyScopeId})` : ''}`}
                </span>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white break-words">
              {T(
                'Aggregator & Corporate Accounts Receivable Aging',
                'ذمم المنصات والعملاء وأعمار الديون التفصيلية',
              )}
            </h2>

            <p className="text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              {isAr
                ? `الرصيد المفتوح كما في ${asOfDisplay} (جميع البنود المفتوحة، مستقلة عن فلتر الفترة)`
                : `Open balance as of ${asOfDisplay} (all open items, independent of period filter)`}
            </p>

            <p className="text-xs font-medium text-slate-600 dark:text-[#8FA39B]">
              {isAr
                ? `نطاق القيود المفتوحة: ${fromFormatted} إلى ${toFormatted} • آخر استحقاق مفوتر: ${maturityFormatted} • آخر مزامنة: ${syncStamp}`
                : `Open ledger span: ${fromFormatted} to ${toFormatted} • Latest invoiced maturity: ${maturityFormatted} • Last sync: ${syncStamp}`}
            </p>
          </div>

          <Link
            href="/erp"
            className="ds-focus-ring ae-bento-subcard inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-slate-800 hover:text-emerald-700 dark:text-slate-100 dark:hover:text-emerald-300"
          >
            {isAr ? (
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            )}
            <span>{T('Back to Overview', 'العودة لملخص الشركة')}</span>
          </Link>
        </div>
      </section>

      <PartialWarningBanner summary={liveSummary} isAr={isAr} />

      {!workspace.odooConnected || workspace.noData || ar.unavailable ? (
        <StateBlock
          state={!workspace.odooConnected ? 'unlinked' : ar.unavailable ? 'unavailable' : 'empty'}
          locale={resolvedLocale}
          title={
            !workspace.odooConnected
              ? T('Odoo live connection is unavailable', 'الاتصال المباشر مع Odoo غير متاح حالياً')
              : ar.unavailable
                ? T('Unavailable', 'غير متاح')
                : T('No open receivables recorded', 'لا توجد ذمم مفتوحة مسجلة')
          }
          description={
            !workspace.odooConnected
              ? T(
                  'Connect your Odoo 17 integration to inspect receivable ledger lines.',
                  'اربط التكامل المباشر مع أودو 17 لعرض قيود الذمم المفتوحة.',
                )
              : undefined
          }
        />
      ) : !amountsVisible || ar.pendingReconciliation ? (
        <section data-receivables-pending="true" className="space-y-4">
          {/* Single Neutral Pending Reconciliation Pill */}
          <div className="ae-bento-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-white/10">
            <ReceivablesPendingStatus isAr={isAr} showDetail />
          </div>

          {/* 4 Real Non-Amount Fact Cards (Zero blank amount cards or dashes) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
                  {T('Unreconciled Move Lines', 'عدد القيود غير المسوّاة')}
                </p>
                <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
              </div>
              <div
                dir="ltr"
                className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white"
              >
                {formatInt(ar.unreconciledLineCount, resolvedLocale)}
              </div>
              <p className="mt-1.5 text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">
                {isAr
                  ? `${formatInt(ar.posClearingLinesCount, resolvedLocale)} مقاصة كاشير (10552) + ${formatInt(ar.platformAndCorporateLinesCount, resolvedLocale)} ذمم منصات وشركات`
                  : `${formatInt(ar.posClearingLinesCount, resolvedLocale)} POS clearing (10552) + ${formatInt(ar.platformAndCorporateLinesCount, resolvedLocale)} platform & trade`}
              </p>
            </article>

            <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
                  {typeof ar.partnerCount === 'number'
                    ? T('Distinct Partners with Open Items', 'عدد الشركاء ذوي البنود المفتوحة')
                    : T('Platform & Corporate Open Lines', 'بنود ذمم المنصات والشركات المفتوحة')}
                </p>
                <Users className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
              </div>
              <div
                dir="ltr"
                className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white"
              >
                {typeof ar.partnerCount === 'number'
                  ? formatInt(ar.partnerCount, resolvedLocale)
                  : formatInt(ar.platformAndCorporateLinesCount, resolvedLocale)}
              </div>
              <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                {typeof ar.partnerCount === 'number'
                  ? T(
                      'Distinct partner accounts in open receivable move lines',
                      'حسابات شركاء مميزة في قيود الذمم غير المسوّاة',
                    )
                  : T(
                      'Open receivable lines outside POS cashier clearing (10552)',
                      'القيود المفتوحة خارج حساب مقاصة نقاط البيع (10552)',
                    )}
              </p>
            </article>

            <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
                  {T('Open Ledger Date Span', 'المدى الزمني للقيود المفتوحة')}
                </p>
                <CalendarRange className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
              </div>
              <div
                dir="ltr"
                className="ds-num mt-2 text-base sm:text-lg font-extrabold tabular-nums text-slate-950 dark:text-white"
              >
                {hasValidSpan ? `${fromFormatted} → ${toFormatted}` : asOfDisplay}
              </div>
              <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                {isAr
                  ? `آخر تاريخ استحقاق مفوتر: ${maturityFormatted}`
                  : `Latest invoiced maturity: ${maturityFormatted}`}
              </p>
            </article>

            <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
                  {T('Active Receivable Accounts', 'حسابات الذمم النشطة')}
                </p>
                <Layers className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
              </div>
              {accountNamesList.length > 0 ? (
                <>
                  <div
                    dir="ltr"
                    className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white"
                  >
                    {formatInt(accountNamesList.length, resolvedLocale)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {accountNamesList.map((acc) => (
                      <span
                        key={`${acc.code}-${acc.name}`}
                        className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/10"
                      >
                        <span dir="ltr" className="font-mono font-bold text-slate-600 dark:text-slate-300">
                          {acc.code}
                        </span>{' '}
                        {isAr ? acc.labelAr : acc.labelEn}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-2 text-base font-extrabold text-slate-950 dark:text-white">
                    {T('Odoo asset_receivable', 'حسابات الذمم المدينة (asset_receivable)')}
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    {T(
                      'Includes POS clearing (10552), aggregator & corporate trade accounts',
                      'يشمل حساب مقاصة نقاط البيع (10552) وحسابات المنصات والشركات',
                    )}
                  </p>
                </>
              )}
            </article>
          </div>
        </section>
      ) : (
        <>
          {/* 4 Top Summary KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
              <p className="text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
                {T('Net Open Receivables Balance', 'صافي الرصيد المفتوح للذمم المدينة')}
              </p>
              <div
                dir="ltr"
                className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white"
              >
                {formatKwd(ar.openReceivableKwd, resolvedLocale)}
              </div>
              <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                {isAr ? `من ${fromFormatted} إلى ${toFormatted}` : `${fromFormatted} → ${toFormatted}`}
              </p>
            </article>

            <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
              <p className="text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
                {T('Open Positive Receivables (Debits)', 'إجمالي الذمم المدينة المفتوحة (المدين)')}
              </p>
              <div
                dir="ltr"
                className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300"
              >
                {formatKwd(ar.openDebitsKwd ?? ar.grossPositiveReceivableKwd, {
                  locale: resolvedLocale,
                  signed: true,
                })}
              </div>
              <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                {T('Positive open balances due from partners & platforms', 'أرصدة مدينة مفتوحة مستحقة من الشركاء والمنصات')}
              </p>
            </article>

            <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
              <p className="text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
                {T('Unapplied Credit Clearing Offset', 'أرصدة دفعات ومقاصة دائنة قيد التطبيق')}
              </p>
              <div
                dir="ltr"
                className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-sky-700 dark:text-sky-300"
              >
                {formatKwd(
                  ar.unappliedCreditsKwd ??
                    (ar.creditClearingOffsetKwd !== null
                      ? -Math.abs(ar.creditClearingOffsetKwd)
                      : null),
                  resolvedLocale,
                )}
              </div>
              <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                {T('Unmatched payments & POS clearing credits', 'الدفعات غير المطبقة وأرصدة مقاصة نقاط البيع')}
              </p>
            </article>

            <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
              <p className="text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
                {T('Unreconciled Move Lines & Partners', 'القيود المفتوحة والشركاء')}
              </p>
              <div
                dir="ltr"
                className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white"
              >
                {formatInt(ar.unreconciledLineCount, resolvedLocale)}
              </div>
              <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                {typeof ar.partnerCount === 'number'
                  ? isAr
                    ? `${formatInt(ar.partnerCount, resolvedLocale)} شريكاً · ${formatInt(ar.posClearingLinesCount, resolvedLocale)} كاشير`
                    : `${formatInt(ar.partnerCount, resolvedLocale)} partners · ${formatInt(ar.posClearingLinesCount, resolvedLocale)} POS clearing`
                  : isAr
                    ? `${formatInt(ar.posClearingLinesCount, resolvedLocale)} كاشير (10552) + ${formatInt(ar.platformAndCorporateLinesCount, resolvedLocale)} منصات وشركات`
                    : `${formatInt(ar.posClearingLinesCount, resolvedLocale)} POS (10552) + ${formatInt(ar.platformAndCorporateLinesCount, resolvedLocale)} platform/trade`}
              </p>
            </article>
          </div>

          {/* Explanation of Open Lines */}
          <section className="ae-bento-card rounded-2xl bg-slate-50 p-4 sm:p-5 ring-1 ring-slate-300/60 dark:bg-white/[0.04] dark:ring-white/10">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  {isAr
                    ? `تفسير الـ ${formatInt(ar.unreconciledLineCount, resolvedLocale)} سطراً المفتوحة في دفتر أستاذ أودو 17`
                    : `Why ${formatInt(ar.unreconciledLineCount, resolvedLocale)} Open Move Lines Exist in Odoo 17`}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  {isAr ? ar.openLinesExplanationAr : ar.openLinesExplanationEn}
                </p>
              </div>
            </div>
          </section>

          {/* Aging Buckets (0-30, 31-60, >60 Days) */}
          <section className="ae-bento-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.1]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                  {T(
                    'Aging Buckets (0–30, 31–60, >60 Days)',
                    'شرائح أعمار الذمم المدينة (0–30، 31–60، أكثر من 60 يوماً)',
                  )}
                </h3>
              </div>
              {typeof ar.unappliedCreditsKwd === 'number' ? (
                <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                  {isAr ? 'الدفعات غير المطبقة: ' : 'Unapplied credits: '}
                  <span dir="ltr" className="ds-num font-mono font-bold">
                    {formatKwd(ar.unappliedCreditsKwd, resolvedLocale)}
                  </span>
                </span>
              ) : null}
            </div>
            {ar.agingBuckets.length === 0 ? (
              <StateBlock
                state="empty"
                locale={resolvedLocale}
                compact
                title={T('No aging buckets recorded', 'لا توجد شرائح أعمار ديون مسجلة')}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {ar.agingBuckets.map((b) => (
                  <div
                    key={b.key}
                    className="rounded-2xl bg-[#F6F7F8] p-4 ring-1 ring-slate-900/[0.05] dark:bg-[#141F1B] dark:ring-emerald-400/[0.1]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                        {isAr ? b.labelAr : b.labelEn}
                      </span>
                      <span
                        dir="ltr"
                        className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 ring-1 ring-slate-900/10 dark:bg-[#101815] dark:text-slate-200"
                      >
                        {formatInt(b.linesCount, resolvedLocale)} {T('lines', 'قيد')}
                      </span>
                    </div>
                    <div
                      dir="ltr"
                      className="ds-num mt-2 text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300"
                    >
                      {formatKwd(b.residualKwd, resolvedLocale)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Per-Partner AR Aging Table */}
          <section className="ae-bento-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.1]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                  {T(
                    'Per-Partner Accounts Receivable Aging',
                    'أعمار الذمم المدينة حسب الشريك / العميل',
                  )}
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {formatInt(partnerRows.length, resolvedLocale)} {T('partners', 'شريك')}
              </span>
            </div>
            <PartnerAgingTable
              rows={partnerRows}
              isAr={isAr}
              locale={resolvedLocale}
              kind="ar"
            />
          </section>

          {/* Breakdown by Platform / Odoo Account */}
          <section className="ae-bento-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.1]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                {T(
                  'Breakdown by Delivery Platform & Receivable Account',
                  'التوزيع التفصيلي حسب منصة التوصيل وحساب الذمم في أودو',
                )}
              </h3>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                <span>{isAr ? ar.reconciliationFormulaAr : ar.reconciliationFormulaEn}</span>
              </span>
            </div>
            <AccountAgingTable
              rows={ar.byAccount}
              isAr={isAr}
              locale={resolvedLocale}
              kind="ar"
            />
          </section>

          {/* Accounts Payable (liability_payable) Aging Table */}
          {apAging?.readable ? (
            <section className="ae-bento-card space-y-4 rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.1]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-cyan-600 dark:text-cyan-400" aria-hidden />
                  <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                    {T(
                      'Accounts Payable Aging (liability_payable)',
                      'أعمار الذمم الدائنة للموردين (liability_payable)',
                    )}
                  </h3>
                </div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {isAr
                    ? `كما في ${formatKuwaitDate(apAging.asOfDate, resolvedLocale)} • ${formatInt(apAging.openLinesCount, resolvedLocale)} سطر مفتوح`
                    : `As of ${formatKuwaitDate(apAging.asOfDate, resolvedLocale)} • ${formatInt(apAging.openLinesCount, resolvedLocale)} open lines`}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-[#F6F7F8] p-3.5 ring-1 ring-slate-900/[0.05] dark:bg-[#141F1B]">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {T('Net Open Payables', 'صافي الذمم الدائنة المفتوحة')}
                  </p>
                  <p dir="ltr" className="ds-num mt-1 text-lg font-extrabold tabular-nums text-slate-950 dark:text-white">
                    {formatKwd(apAging.openPayableKwd, resolvedLocale)}
                  </p>
                </div>
                <div className="rounded-xl bg-[#F6F7F8] p-3.5 ring-1 ring-slate-900/[0.05] dark:bg-[#141F1B]">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {T('Open Vendor Bills', 'فواتير الموردين المستحقة')}
                  </p>
                  <p dir="ltr" className="ds-num mt-1 text-lg font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {formatKwd(apAging.openCreditsKwd, resolvedLocale)}
                  </p>
                </div>
                <div className="rounded-xl bg-[#F6F7F8] p-3.5 ring-1 ring-slate-900/[0.05] dark:bg-[#141F1B]">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {T('Unapplied Vendor Debits', 'دفعات مقدمة وإشعارات خصم')}
                  </p>
                  <p dir="ltr" className="ds-num mt-1 text-lg font-extrabold tabular-nums text-sky-700 dark:text-sky-300">
                    {formatKwd(apAging.unappliedDebitsKwd, resolvedLocale)}
                  </p>
                </div>
              </div>

              <PartnerAgingTable
                rows={apAging.byPartner}
                isAr={isAr}
                locale={resolvedLocale}
                kind="ap"
              />

              {apAging.byAccount.length > 0 ? (
                <AccountAgingTable
                  rows={apAging.byAccount}
                  isAr={isAr}
                  locale={resolvedLocale}
                  kind="ap"
                />
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
