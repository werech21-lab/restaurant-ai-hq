'use client'

import React from 'react'
import { canShowReceivableAmounts } from '@/lib/aether/receivables-status'
import { customerReceivableNetKwd, isPosClearingAccount, receivablesCustomerSplit, splitOpenResiduals } from '@/lib/odoo/live-sync-core'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, FileText, Wallet } from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { useLang } from '@/components/aether/ui'
import { PartialWarningBanner, StateBlock } from '@/components/ui'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKuwaitDate,
  formatKuwaitDateTime,
  formatKwd,
  getUnavailableTooltip,
} from '@/lib/format'

export function ReceivablesAgingStudio() {
  const { isAr, T } = useLang()
  const resolvedLocale: 'ar' | 'en' = isAr ? 'ar' : 'en'
  const { workspace, liveSummary, syncingOdoo } = useGlobalFilter()
  const ar = workspace.receivables
  const unavailableTooltip = getUnavailableTooltip(resolvedLocale)
  const amountsVisible = canShowReceivableAmounts(ar)
  const partners = (ar.byPartner ?? []).filter((row) => !isPosClearingAccount(`${row.accountCode} ${row.accountName}`))
  const partnerSplit = partners.length > 0 ? splitOpenResiduals(partners) : null
  const split = receivablesCustomerSplit(ar.byAccount ?? [], partners)
  const customerAccounts = split.splitKnown
    ? [...split.customerAccounts].sort((a, b) => {
        const order = ['10501', '10502', '10503', '10504', '10505', '10507', '10508', '10509', '121000']
        const ai = order.indexOf(a.accountCode)
        const bi = order.indexOf(b.accountCode)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
    : []
  const platformNet = customerReceivableNetKwd(ar)
  const platformDebits = partnerSplit?.openDebitsKwd ?? ar.platformOpenDebitsKwd ?? split.platformOpenDebitsKwd
  const platformCredits = partnerSplit?.unappliedCreditsKwd ?? ar.platformUnappliedCreditsKwd ?? split.platformUnappliedCreditsKwd
  const platformLines = split.splitKnown ? split.platformLineCount : ar.platformAndCorporateLinesCount
  const posResidual = split.splitKnown ? split.posClearingResidualKwd : ar.posClearingResidualKwd
  const posLines = split.splitKnown ? split.posClearingLineCount : ar.posClearingLinesCount
  const oldestPosting = ar.oldestOpenPostingDate ?? (split.splitKnown ? null : ar.fromDate)
  const kuwaitToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuwait',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const openDays = (posting: string | null | undefined): number | null => {
    if (!posting || !/^\d{4}-\d{2}-\d{2}/.test(posting)) return null
    const ms = Date.parse(`${kuwaitToday}T00:00:00Z`) - Date.parse(`${posting.slice(0, 10)}T00:00:00Z`)
    if (!Number.isFinite(ms)) return null
    return Math.max(0, Math.round(ms / 86_400_000))
  }

  const syncStamp = liveSummary?.kuwaitSyncedAt
    ? liveSummary.kuwaitSyncedAt
    : formatKuwaitDateTime(
        liveSummary?.latestOdooRecordAt ?? liveSummary?.syncedAt ?? null,
        resolvedLocale,
      )
  const fromFormatted = formatKuwaitDate(ar.fromDate, resolvedLocale)
  const toFormatted = formatKuwaitDate(ar.toDate, resolvedLocale)

  if (syncingOdoo && !liveSummary) {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-5 pb-12">
        <StateBlock
          state="loading"
          locale={resolvedLocale}
          skeletonRows={5}
          title={isAr ? 'جارٍ تحميل ذمم المنصات والشركات…' : 'Loading open receivables…'}
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
          <div className="space-y-1.5 min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-500/25 dark:bg-amber-500/15 dark:text-amber-200">
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              <span>
                {T(
                  'Odoo 17 Receivable Ledger (account.move.line · reconciled=false)',
                  'دفتر ذمم أودو 17 غير المسوّاة (account.move.line · reconciled=false)',
                )}
              </span>
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white break-words">
              {T(
                'Platform & corporate open receivables',
                'ذمم المنصات والشركات المفتوحة',
              )}
            </h2>
            <p className="text-sm font-medium text-slate-600 dark:text-[#8FA39B]">
              {isAr
                ? `رصيد متبقٍ مفتوح حتى ${syncStamp} (قيود غير مسوّاة، مستقل عن فلتر الفترة) • أقدم تاريخ قيد ${oldestPosting ? formatKuwaitDate(oldestPosting, resolvedLocale) : fromFormatted}`
                : `Open residual as of ${syncStamp} (unreconciled lines, independent of the period filter) • Oldest posting date ${oldestPosting ? formatKuwaitDate(oldestPosting, resolvedLocale) : fromFormatted}`}
            </p>
          </div>

          <Link
            href="/erp"
            className="ds-focus-ring ae-bento-subcard inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-slate-800 hover:text-emerald-700 dark:text-slate-100 dark:hover:text-emerald-300"
          >
            {isAr ? <ArrowRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowLeft className="h-3.5 w-3.5" aria-hidden />}
            <span>{T('Back to Overview', 'العودة لملخص الشركة')}</span>
          </Link>
        </div>
      </section>

      <PartialWarningBanner summary={liveSummary} isAr={isAr} />

      <>
      {/* 4 Top Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
          <p className="text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
            {T('Platform & corporate open residual', 'المتبقي المفتوح للمنصات والشركات')}
          </p>
          <div
            dir="ltr"
            title={ar.unavailable ? unavailableTooltip : undefined}
            aria-label={ar.unavailable ? unavailableTooltip : undefined}
            data-unavailable={ar.unavailable ? 'true' : undefined}
            className={`ds-num mt-2 text-2xl font-extrabold tabular-nums ${ar.unavailable ? 'text-slate-500 dark:text-slate-400' : 'text-slate-950 dark:text-white'}`}
          >
            {ar.unavailable ? (
              isAr ? (
                'غير متاح'
              ) : (
                UNAVAILABLE_DASH
              )
            ) : (
              <span data-platform-residual="true">{formatKwd(platformNet, resolvedLocale)}</span>
            )}
          </div>
          <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {isAr ? `من ${fromFormatted} إلى ${toFormatted}` : `${fromFormatted} → ${toFormatted}`}
          </p>
        </article>

        <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
          <p className="text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
            {T('Gross open debits (excl. cashier clearing)', 'إجمالي المدين المفتوح (بدون مقاصة الكاشير)')}
          </p>
          <div
            dir="ltr"
            title={ar.unavailable ? unavailableTooltip : undefined}
            aria-label={ar.unavailable ? unavailableTooltip : undefined}
            data-unavailable={ar.unavailable ? 'true' : undefined}
            className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white"
          >
            {ar.unavailable
              ? isAr
                ? 'غير متاح'
                : UNAVAILABLE_DASH
              : formatKwd(platformDebits, {
                  locale: resolvedLocale,
                  signed: true,
                })}
          </div>
          <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {T('Talabat, Trade AR, Hesabe, Jahez & Keeta', 'طلبات، ذمم شركات، حسابي، جاهز وكيتا')}
          </p>
        </article>

        <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
          <p className="text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
            {T('Unapplied credits (excl. cashier clearing)', 'دائن غير مطبّق (بدون مقاصة الكاشير)')}
          </p>
          <div
            dir="ltr"
            title={ar.unavailable ? unavailableTooltip : undefined}
            aria-label={ar.unavailable ? unavailableTooltip : undefined}
            data-unavailable={ar.unavailable ? 'true' : undefined}
            className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white"
          >
            {ar.unavailable
              ? isAr
                ? 'غير متاح'
                : UNAVAILABLE_DASH
              : formatKwd(platformCredits, resolvedLocale)}
          </div>
          <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {T('Unapplied credits on platform and trade accounts', 'دائن غير مطبّق على حسابات المنصات والشركات')}
          </p>
        </article>

        <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
          <p className="text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
            {T('Open platform & corporate lines', 'قيود المنصات والشركات المفتوحة')}
          </p>
          <div
            dir="ltr"
            title={ar.unavailable ? unavailableTooltip : undefined}
            aria-label={ar.unavailable ? unavailableTooltip : undefined}
            data-unavailable={ar.unavailable ? 'true' : undefined}
            className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white"
          >
            {ar.unavailable
              ? isAr
                ? 'غير متاح'
                : UNAVAILABLE_DASH
              : formatInt(platformLines, resolvedLocale)}
          </div>
          <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {ar.unavailable
              ? isAr
                ? 'غير متاح'
                : UNAVAILABLE_DASH
              : isAr
                ? `أقدم تاريخ قيد ${oldestPosting ? formatKuwaitDate(oldestPosting, resolvedLocale) : '—'}`
                : `Oldest posting date ${oldestPosting ? formatKuwaitDate(oldestPosting, resolvedLocale) : '—'}`}
          </p>
        </article>
      </div>

      {/* Explanation of Open Lines */}
      <section className="ae-bento-card rounded-2xl bg-slate-50 p-4 sm:p-5 ring-1 ring-slate-300/60 dark:bg-white/[0.04] dark:ring-white/10">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {ar.unavailable
                ? isAr
                  ? 'تفسير السطور المفتوحة في دفتر أستاذ أودو 17: غير متاح'
                  : 'Open Move Lines Breakdown in Odoo 17: —'
                : isAr
                  ? `تفسير الـ ${formatInt(ar.unreconciledLineCount, resolvedLocale)} سطراً المفتوحة في دفتر أستاذ أودو 17`
                  : `Why ${formatInt(ar.unreconciledLineCount, resolvedLocale)} Open Move Lines Exist in Odoo 17`}
            </h3>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {isAr ? ar.openLinesExplanationAr : ar.openLinesExplanationEn}
            </p>
          </div>
        </div>
      </section>

      {amountsVisible && ar.agingBuckets.length > 0 ? (
      <section className="ae-bento-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.1]">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
            {T(
              'Aging Buckets (0–30, 31–60, >60 Days)',
              'شرائح أعمار الذمم المدينة (0–30، 31–60، أكثر من 60 يوماً)',
            )}
          </h3>
        </div>
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
                <p
                  dir="ltr"
                  className="ds-num mt-1 text-xs font-medium tabular-nums text-slate-600 dark:text-[#8FA39B]"
                >
                  {formatKwd(b.positiveDebitKwd, {
                    locale: resolvedLocale,
                    signed: true,
                    showUnit: false,
                  })}{' '}
                  {T('debit', 'مدين')} /{' '}
                  {formatKwd(b.creditOffsetKwd, {
                    locale: resolvedLocale,
                    showUnit: false,
                  })}{' '}
                  {T('clearing', 'مقاصة')}
                </p>
              </div>
            ))}
          </div>
      </section>
      ) : null}

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

        {ar.unavailable ? (
          <StateBlock state="unavailable" locale={resolvedLocale} compact />
        ) : customerAccounts.length === 0 ? null : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-white/10">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead className="bg-[#F6F7F8] text-slate-600 dark:bg-[#09110E] dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-bold">
                    {T('Code', 'رمز الحساب')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-bold">
                    {T('Platform / Receivable Account', 'المنصة / حساب الذمم المدينة')}
                  </th>
                  <th className="px-4 py-3 text-end text-xs font-bold">
                    {T('Unreconciled Lines', 'عدد القيود المفتوحة')}
                  </th>
                  <th className="px-4 py-3 text-end text-xs font-bold">
                    {T('Net Residual Balance', 'الرصيد الصافي المفتوح')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                {customerAccounts.map((row) => (
                  <tr key={row.accountId} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                    <td dir="ltr" className="px-4 py-3 font-mono text-xs font-bold text-slate-700 dark:text-emerald-300">
                      {row.accountCode}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {isAr ? row.labelAr : row.labelEn}
                    </td>
                    <td dir="ltr" className="px-4 py-3 text-end font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                      {formatInt(row.linesCount, resolvedLocale)}
                    </td>
                    <td
                      dir="ltr"
                      className={`ds-num px-4 py-3 text-end font-mono font-bold tabular-nums ${
                        row.residualKwd < 0
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {formatKwd(row.residualKwd, {
                        locale: resolvedLocale,
                        signed: true,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {partners.length > 0 ? (
        <section data-receivable-partners="true" className="ae-bento-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.1]">
          <h3 className="mb-3 text-base font-extrabold text-slate-950 dark:text-white">
            {T('Open residual by partner', 'المتبقي المفتوح حسب الشريك')}
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-white/10">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-[#F6F7F8] text-slate-600 dark:bg-[#09110E] dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-bold">{T('Partner', 'الشريك')}</th>
                  <th className="px-4 py-3 text-start text-xs font-bold">{T('Account', 'الحساب')}</th>
                  <th className="px-4 py-3 text-end text-xs font-bold">{T('Lines', 'القيود')}</th>
                  <th className="px-4 py-3 text-end text-xs font-bold">{T('Residual', 'المتبقي')}</th>
                  <th className="px-4 py-3 text-end text-xs font-bold">{T('Days open from posting date', 'أيام مفتوح حسب تاريخ القيد')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                {partners.map((row) => (
                  <tr key={`${row.partnerId}-${row.accountId}`}>
                    <td className="px-4 py-3 font-semibold">{row.partnerName}</td>
                    <td dir="ltr" className="px-4 py-3 font-mono text-xs">{row.accountCode}</td>
                    <td dir="ltr" className="px-4 py-3 text-end tabular-nums">{formatInt(row.linesCount, resolvedLocale)}</td>
                    <td dir="ltr" className="px-4 py-3 text-end font-bold tabular-nums">{formatKwd(row.residualKwd, { locale: resolvedLocale, signed: true })}</td>
                    <td dir="ltr" className="px-4 py-3 text-end tabular-nums">{formatInt(openDays(row.oldestPostingDate), resolvedLocale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {(posLines > 0 || (typeof posResidual === 'number' && posResidual !== 0)) ? (
        <section data-pos-clearing="10552" className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-white/[0.03] dark:ring-white/10">
          <p className="text-sm font-extrabold text-slate-900 dark:text-white">{T('Cashier clearing — not customer receivables', 'مقاصة كاشير — ليست ذمم عملاء')}</p>
          <p dir="ltr" className="mt-1 text-lg font-bold tabular-nums">{formatKwd(posResidual ?? null, resolvedLocale)}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {isAr ? `${formatInt(posLines, resolvedLocale)} قيد على الحساب 10552` : `${formatInt(posLines, resolvedLocale)} lines on account 10552`}
          </p>
        </section>
      ) : null}
      </>
    </div>
  )
}
