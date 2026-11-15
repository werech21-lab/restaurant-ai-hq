'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, FileText, Wallet } from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { useLang } from '@/components/aether/ui'

const fInt = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')
const f3 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })

export function ReceivablesAgingStudio() {
  const { isAr, T } = useLang()
  const { workspace, liveSummary } = useGlobalFilter()
  const ar = workspace.receivables
  const kwd = isAr ? 'د.ك' : 'KWD'
  const syncStamp =
    liveSummary?.kuwaitSyncedAt ?? liveSummary?.latestOdooRecordAt ?? liveSummary?.syncedAt ?? '—'

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-[1920px] mx-auto space-y-5 pb-12 text-slate-900 dark:text-slate-100"
    >
      {/* Header Banner */}
      <section className="ae-bento-card rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.1]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-500/25 dark:bg-amber-500/15 dark:text-amber-200">
              <Wallet className="h-3.5 w-3.5" />
              <span>
                {T(
                  'Odoo 17 Receivable Ledger (account.move.line · reconciled=false)',
                  'دفتر ذمم أودو 17 غير المسوّاة (account.move.line · reconciled=false)',
                )}
              </span>
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              {T(
                'Aggregator & Corporate Accounts Receivable Aging',
                'ذمم المنصات والعملاء وأعمار الديون التفصيلية',
              )}
            </h2>
            <p className="text-sm font-medium text-slate-600 dark:text-[#8FA39B]">
              {isAr
                ? `الفترة الزمنية للقيود المفتوحة: من ${ar.fromDate} إلى ${ar.toDate} • آخر استحقاق مفوتر: ${ar.latestMaturityDate ?? 'حالي'} • آخر مزامنة: ${syncStamp}`
                : `Unreconciled ledger window: ${ar.fromDate} to ${ar.toDate} • Latest invoiced maturity: ${ar.latestMaturityDate ?? 'Current'} • Last sync: ${syncStamp}`}
            </p>
          </div>

          <Link
            href="/erp"
            className="ae-bento-subcard inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-slate-800 hover:text-emerald-700 dark:text-slate-100 dark:hover:text-emerald-300"
          >
            {isAr ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
            <span>{T('Back to Overview', 'العودة لملخص الشركة')}</span>
          </Link>
        </div>
      </section>

      {/* 4 Top Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
          <p className="text-xs font-bold text-slate-500 dark:text-[#8FA39B]">
            {T('Net Open Receivables Balance', 'صافي الرصيد المفتوح للذمم المدينة')}
          </p>
          <div dir="ltr" className="mt-2 text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
            {f3(ar.openReceivableKwd)} {kwd}
          </div>
          <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {isAr ? `من ${ar.fromDate} إلى ${ar.toDate}` : `${ar.fromDate} → ${ar.toDate}`}
          </p>
        </article>

        <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
          <p className="text-xs font-bold text-slate-500 dark:text-[#8FA39B]">
            {T('Gross Positive Platform & Trade AR', 'إجمالي الذمم المدينة الموجبة (قبل المقاصة)')}
          </p>
          <div dir="ltr" className="mt-2 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white">
            +{f3(ar.grossPositiveReceivableKwd)} {kwd}
          </div>
          <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {T('Talabat, Trade AR, Hesabe, Jahez & Keeta', 'طلبات، ذمم شركات، حسابي، جاهز وكيتا')}
          </p>
        </article>

        <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
          <p className="text-xs font-bold text-slate-500 dark:text-[#8FA39B]">
            {T('Unapplied Credit Clearing Offset', 'أرصدة دفعات ومقاصة دائنة قيد التطبيق')}
          </p>
          <div dir="ltr" className="mt-2 text-2xl font-extrabold tabular-nums text-amber-700 dark:text-amber-300">
            -{f3(ar.creditClearingOffsetKwd)} {kwd}
          </div>
          <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {T('Deliveroo, POS Clearing (10552) & Snoonu', 'ديليفرو، مقاصة نقاط البيع 10552 وسنونو')}
          </p>
        </article>

        <article className="ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
          <p className="text-xs font-bold text-slate-500 dark:text-[#8FA39B]">
            {T('Unreconciled Move Lines Breakdown', 'تفصيل عدد القيود غير المسوّاة')}
          </p>
          <div dir="ltr" className="mt-2 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white">
            {fInt(ar.unreconciledLineCount)}
          </div>
          <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {isAr
              ? `${fInt(ar.posClearingLinesCount)} قيد كاشير (10552) + ${fInt(ar.platformAndCorporateLinesCount)} قيد منصات وشركات`
              : `${fInt(ar.posClearingLinesCount)} POS clearing (10552) + ${fInt(ar.platformAndCorporateLinesCount)} platform/trade`}
          </p>
        </article>
      </div>

      {/* Explanation of 66,569 Open Lines */}
      <section className="ae-bento-card rounded-2xl bg-amber-50/70 p-4 sm:p-5 ring-1 ring-amber-500/25 dark:bg-amber-950/25 dark:ring-amber-400/20">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-amber-950 dark:text-amber-100">
              {isAr
                ? `تفسير الـ ${fInt(ar.unreconciledLineCount)} سطراً المفتوحة في دفتر أستاذ أودو 17`
                : `Why ${fInt(ar.unreconciledLineCount)} Open Move Lines Exist in Odoo 17`}
            </h3>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {isAr ? ar.openLinesExplanationAr : ar.openLinesExplanationEn}
            </p>
          </div>
        </div>
      </section>

      {/* Aging Buckets (0-30, 31-60, >60 Days) */}
      <section className="ae-bento-card rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.1]">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 ring-1 ring-slate-900/10 dark:bg-[#101815] dark:text-slate-200">
                  {fInt(b.linesCount)} {T('lines', 'قيد')}
                </span>
              </div>
              <div dir="ltr" className="mt-2 text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                {f3(b.residualKwd)} {kwd}
              </div>
              <p dir="ltr" className="mt-1 text-xs font-medium tabular-nums text-slate-600 dark:text-[#8FA39B]">
                +{f3(b.positiveDebitKwd)} {T('debit', 'مدين')} / {f3(b.creditOffsetKwd)} {T('clearing', 'مقاصة')}
              </p>
            </div>
          ))}
        </div>
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
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{isAr ? ar.reconciliationFormulaAr : ar.reconciliationFormulaEn}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
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
              {ar.byAccount.map((row) => (
                <tr key={row.accountId} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700 dark:text-emerald-300">
                    {row.accountCode}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                    {isAr ? row.labelAr : row.labelEn}
                  </td>
                  <td dir="ltr" className="px-4 py-3 text-end font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                    {fInt(row.linesCount)}
                  </td>
                  <td
                    dir="ltr"
                    className={`px-4 py-3 text-end font-mono font-bold tabular-nums ${
                      row.residualKwd < 0
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {row.residualKwd > 0 ? '+' : ''}
                    {f3(row.residualKwd)} {kwd}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
