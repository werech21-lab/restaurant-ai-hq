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
import { useI18n } from '@/lib/i18n'

function fmtKwd(value: number | null | undefined, isAr: boolean): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return isAr ? 'غير متوفر' : 'Not available'
  }
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
  return isAr ? `${formatted} د.ك` : `${formatted} KWD`
}

function fmtPct(value: number | null | undefined, isAr: boolean): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return isAr ? 'غير متوفر' : 'N/A'
  }
  return `${value.toFixed(1)}%`
}

export function ExecutivePnlStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const { workspace } = useGlobalFilter()
  const gl = workspace.accounting

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
      code: '4000–4999',
      labelAr: 'إجمالي الإيرادات المرحلة بدفتر الأستاذ العام (account.move.line)',
      labelEn: 'Posted General Ledger Revenue (account.move.line)',
      amountKwd: gl.totalRevenueKwd,
      pctOfRev: gl.totalRevenueKwd ? 100 : null,
      tone: 'text-emerald-400',
    },
    {
      code: '5000–5199',
      labelAr: 'تكلفة البضاعة والمواد الغذائية والتعبئة الفعلية (COGS)',
      labelEn: 'Posted Cost of Goods Sold & Packaging (COGS)',
      amountKwd: gl.cogsKwd !== null ? -gl.cogsKwd : null,
      pctOfRev: gl.cogsPct,
      tone: 'text-rose-400',
    },
    {
      code: 'GP',
      labelAr: 'مجمل الربح التشغيلي (بعد تكلفة المواد الخام)',
      labelEn: 'Gross Profit (After Food & Packaging Cost)',
      amountKwd: glGrossProfitKwd,
      pctOfRev: glGrossMarginPct,
      tone: 'text-emerald-300 font-black',
    },
    {
      code: '6120',
      labelAr: 'عمولات منصات التوصيل المرحلة (طلبات، كيتا، ديليفرو، جاهز)',
      labelEn: 'Posted Aggregator Delivery Commissions',
      amountKwd: gl.deliveryCommissionsKwd !== null ? -gl.deliveryCommissionsKwd : null,
      pctOfRev: gl.deliveryCommPct,
      tone: 'text-amber-400',
    },
    {
      code: '6200–7999',
      labelAr: 'المصروفات التشغيلية والإيجارات والرواتب والإهلاك المرحلة',
      labelEn: 'Posted Operating Expenses, Rent, Payroll & Depreciation',
      amountKwd:
        gl.otherOpexAndDepreciationKwd !== null ? -gl.otherOpexAndDepreciationKwd : null,
      pctOfRev: gl.opexRentDeprPct,
      tone: 'text-amber-300',
    },
    {
      code: 'OP-NET',
      labelAr: 'صافي الربح التشغيلي الفعلي (مطابق لقيود الأستاذ العام)',
      labelEn: 'Actual Operating Profit (Reconciled to Odoo General Ledger)',
      amountKwd: gl.operatingProfitKwd,
      pctOfRev: gl.netProfitPct,
      tone:
        typeof gl.operatingProfitKwd === 'number' && gl.operatingProfitKwd < 0
          ? 'text-rose-400 font-black'
          : 'text-emerald-400 font-black',
    },
  ]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-6">
      <div className="rounded-2xl border border-emerald-500/25 bg-[#0b1320] p-5 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
              <FileSpreadsheet size={14} />
              <span>
                {isAr
                  ? 'قائمة الدخل التنفيذية وانحراف الأستاذ العام · أودو 17'
                  : 'Executive P&L & Odoo 17 General Ledger Statement'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {isAr
                ? 'قائمة الدخل الفعلية ومطابقة إيرادات نقاط البيع مع قيود الأستاذ العام'
                : 'Actual Income Statement & POS-to-GL Reconciliation'}
            </h2>
            <p className="text-xs text-slate-400">
              {isAr ? workspace.subtitleAr : workspace.subtitleEn} •{' '}
              {isAr
                ? `نطاق القيود المحاسبية: ${gl.from ?? '—'} إلى ${gl.to ?? '—'} (${gl.lineCount.toLocaleString('en-US')} سطر قيد)`
                : `GL Window: ${gl.from ?? '—'} to ${gl.to ?? '—'} (${gl.lineCount.toLocaleString('en-US')} move lines)`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/erp/finance"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-200 hover:border-emerald-500/40 hover:text-white transition"
            >
              <Landmark size={14} />
              <span>{isAr ? 'المركز المالي الشامل' : 'Full Finance Hub'}</span>
              <ArrowUpRight size={13} />
            </Link>
            <Link
              href="/erp/receivables"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              <Receipt size={14} />
              <span>{isAr ? 'أعمار الذمم المدينة' : 'AR Aging'}</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>

        {!gl.available && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/30 p-3.5 text-xs text-amber-200">
            <AlertTriangle size={16} className="shrink-0 text-amber-400 mt-0.5" />
            <div>
              <span className="font-bold block">
                {isAr
                  ? 'تنبيه محاسبي: إقفال المصروفات الشهرية غير مكتمل لهذه الفترة القصيرة'
                  : 'Accounting Notice: Month-end accruals are not posted for this short window'}
              </span>
              <span className="text-amber-300/90">
                {isAr ? gl.unavailableReasonAr : gl.unavailableReasonEn}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-800 bg-[#0d1524] p-4 space-y-1">
          <span className="text-xs font-bold text-slate-400">
            {isAr ? 'صافي مبيعات نقاط البيع (POS)' : 'POS Net Sales (pos.order)'}
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-white">
            {fmtKwd(workspace.salesKwd, isAr)}
          </div>
          <span className="text-xs text-emerald-400 font-semibold block">
            {workspace.orders.toLocaleString('en-US')} {isAr ? 'طلب مقبوض' : 'settled orders'}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d1524] p-4 space-y-1">
          <span className="text-xs font-bold text-slate-400">
            {isAr ? 'إيرادات الأستاذ العام (GL)' : 'GL Posted Revenue'}
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
            {fmtKwd(gl.totalRevenueKwd, isAr)}
          </div>
          <span className="text-xs text-slate-400 block">
            {isAr ? 'من واقع account.move.line' : 'Source: account.move.line'}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d1524] p-4 space-y-1">
          <span className="text-xs font-bold text-slate-400">
            {isAr ? 'تكلفة البضاعة الفعلية (COGS)' : 'Actual GL COGS'}
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-400">
            {fmtKwd(gl.cogsKwd, isAr)}
          </div>
          <span className="text-xs text-slate-400 block">
            {isAr ? `النسبة من الإيراد: ${fmtPct(gl.cogsPct, isAr)}` : `% of Revenue: ${fmtPct(gl.cogsPct, isAr)}`}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d1524] p-4 space-y-1">
          <span className="text-xs font-bold text-slate-400">
            {isAr ? 'صافي الربح التشغيلي (GL)' : 'GL Operating Profit'}
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-300">
            {fmtKwd(gl.operatingProfitKwd, isAr)}
          </div>
          <span className="text-xs text-slate-400 block">
            {isAr ? `هامش التشغيل: ${fmtPct(gl.netProfitPct, isAr)}` : `Operating Margin: ${fmtPct(gl.netProfitPct, isAr)}`}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0b1320] p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-emerald-400" />
            <h3 className="text-base font-black text-white">
              {isAr
                ? 'جدول قائمة الدخل المحاسبية التفصيلية (فنتشر فودز ذ.م.م.)'
                : 'Detailed General Ledger Income Statement (Venture Foods W.L.L.)'}
            </h3>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
            <CheckCircle2 size={12} />
            {isAr ? 'حساب ديناميكي من أودو' : 'Dynamic Odoo GL'}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 text-start font-bold">{isAr ? 'رمز الحساب' : 'GL Code'}</th>
                <th className="py-3 px-4 text-start font-bold">{isAr ? 'البند المحاسبي' : 'Statement Line'}</th>
                <th className="py-3 px-4 text-end font-bold">{isAr ? 'المبلغ (د.ك)' : 'Amount (KWD)'}</th>
                <th className="py-3 px-4 text-end font-bold">{isAr ? 'النسبة من الإيراد' : '% of Revenue'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {lineItems.map((item) => (
                <tr key={item.code} className="hover:bg-slate-900/40 transition">
                  <td className="py-3 px-4 font-mono text-slate-400" dir="ltr">
                    {item.code}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-100">
                    {isAr ? item.labelAr : item.labelEn}
                  </td>
                  <td className={`py-3 px-4 text-end font-mono font-bold ${item.tone}`} dir="ltr">
                    {fmtKwd(item.amountKwd, isAr)}
                  </td>
                  <td className="py-3 px-4 text-end font-mono text-slate-300" dir="ltr">
                    {fmtPct(item.pctOfRev, isAr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-[#0b1320] p-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <TrendingUp size={16} className="text-emerald-400" />
            <h3 className="text-sm font-black text-white">
              {isAr ? 'مساهمة الـ 6 علامات تجارية في الإيرادات' : 'Revenue Contribution Across 6 Brands'}
            </h3>
          </div>
          <div className="space-y-2.5">
            {brandRows.map((b) => {
              const sales = b.salesKwd ?? 0
              const share = workspace.salesKwd > 0 ? Math.min(100, (sales / workspace.salesKwd) * 100) : 0
              return (
                <div key={b.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">{isAr ? b.ar : b.en}</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {sales.toLocaleString('en-US')} {isAr ? 'د.ك' : 'KWD'} ({share.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.max(2, share)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0b1320] p-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <Landmark size={16} className="text-cyan-400" />
            <h3 className="text-sm font-black text-white">
              {isAr ? 'مساهمة الـ 7 فروع الفعلية في الإيرادات' : 'Revenue Contribution Across 7 Active Branches'}
            </h3>
          </div>
          <div className="space-y-2.5">
            {branchRows.map((br) => {
              const sales = br.salesKwd ?? 0
              const share = workspace.salesKwd > 0 ? Math.min(100, (sales / workspace.salesKwd) * 100) : 0
              return (
                <div key={br.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">{isAr ? br.ar : br.en}</span>
                    <span className="font-mono text-cyan-300 font-bold">
                      {sales.toLocaleString('en-US')} {isAr ? 'د.ك' : 'KWD'} ({share.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-cyan-500"
                      style={{ width: `${Math.max(2, share)}%` }}
                    />
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
