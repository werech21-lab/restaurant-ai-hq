'use client'

import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  Building2,
  CreditCard,
  Database,
  Landmark,
  Plus,
  ShieldCheck,
  Truck,
  Wallet,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  GLOBAL_PERIOD_OPTIONS,
  formatPeriodCalendarWindow,
  type GlobalPeriod,
} from '@/lib/aether/global-filter-engine'
import KpiProvenanceBadge from '@/components/erp/KpiProvenanceBadge'
import UnlinkedSourceNotice from '@/components/erp/UnlinkedSourceNotice'
import { useI18n } from '@/lib/i18n'
import { OdooAccountingAnalyticsHub } from './OdooAccountingAnalyticsHub'

export function VentureAccountingHub({
  locale = 'ar',
  isAuditor = false,
  embeddedInErp = false,
  liveChildren,
}: {
  locale?: 'ar' | 'en'
  isAuditor?: boolean
  embeddedInErp?: boolean
  liveChildren?: React.ReactNode
}) {
  let ctxLocale: 'ar' | 'en' | null = null
  try {
    const i18n = useI18n()
    if (i18n?.locale) ctxLocale = i18n.locale
  } catch {}

  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)
  useEffect(() => {
    if (ctxLocale) setCurrentLocale(ctxLocale)
  }, [ctxLocale])

  const { filters, workspace, liveSummary, isAuditor: ctxAuditor, setPeriod } = useGlobalFilter()
  const effectiveAuditor = Boolean(isAuditor || ctxAuditor)
  const isAr = currentLocale === 'ar'

  const [activeTab, setActiveTab] = useState<
    'glSummary' | 'receivables' | 'pettyCash' | 'cheques' | 'leases' | 'fleet' | 'localDb'
  >('glSummary')

  const periodWindow = formatPeriodCalendarWindow(filters.period ?? 'month', {
    customFrom: filters.customFrom,
    customTo: filters.customTo,
    liveSummary,
  })

  const fmtKwd = (v: number) =>
    `${v.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${
      isAr ? 'د.ك' : 'KWD'
    }`

  const tabs: Array<{
    id: typeof activeTab
    labelAr: string
    labelEn: string
    icon: React.ReactNode
  }> = [
    {
      id: 'glSummary',
      labelAr: 'ملخص دفتر الأستاذ (Odoo GL)',
      labelEn: 'Odoo General Ledger',
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      id: 'receivables',
      labelAr: 'الذمم المدينة وأعمار الديون',
      labelEn: 'Receivables & Aging',
      icon: <Landmark className="h-4 w-4" />,
    },
    {
      id: 'pettyCash',
      labelAr: 'العهد النثرية',
      labelEn: 'Petty Cash',
      icon: <Wallet className="h-4 w-4" />,
    },
    {
      id: 'cheques',
      labelAr: 'الشيكات والتسويات البنكية',
      labelEn: 'Cheques & Bank Recon',
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      id: 'leases',
      labelAr: 'عقود الإيجارات',
      labelEn: 'Branch Leases',
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      id: 'fleet',
      labelAr: 'مصروفات الأسطول',
      labelEn: 'Fleet Expenses',
      icon: <Truck className="h-4 w-4" />,
    },
    ...(liveChildren && !embeddedInErp
      ? [
          {
            id: 'localDb' as const,
            labelAr: 'سجلات النظام المحلي',
            labelEn: 'Local Ledger Records',
            icon: <Database className="h-4 w-4" />,
          },
        ]
      : []),
  ]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Landmark className="h-3.5 w-3.5" />
                {isAr ? 'الإدارة المالية ومحاسبة Odoo 17' : 'Financial Accounting & Odoo 17 GL'}
              </span>

              {effectiveAuditor ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {isAr ? 'وضع المراجع الخارجي — قراءة فقط' : 'External Auditor Mode — Read Only'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {isAr ? 'تصنيف المخاطر والرقابة الداخلية' : 'Risk Classification & Internal Control'}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isAr
                ? 'مركز المحاسبة ودفتر الأستاذ العام — شركة فنتشر فودز'
                : 'General Ledger & Accounting Hub — Venture Foods W.L.L.'}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {isAr
                ? `الفترة المحاسبية المختارة: ${periodWindow.labelAr} (${periodWindow.fromIso} → ${periodWindow.toInclusiveIso})`
                : `Selected Accounting Period: ${periodWindow.labelEn} (${periodWindow.fromIso} → ${periodWindow.toInclusiveIso})`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
              {GLOBAL_PERIOD_OPTIONS.filter((p) => p.id !== 'custom').map((opt) => {
                const active = filters.period === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPeriod(opt.id as GlobalPeriod)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    {isAr ? opt.ar : opt.en}
                  </button>
                )
              })}
            </div>

            {!effectiveAuditor && (
              <a
                href="/accounting?tab=entry"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <Plus className="h-3.5 w-3.5" />
                {isAr ? 'قيد يومية جديد' : 'New Journal Entry'}
              </a>
            )}
          </div>
        </div>

        <nav className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          {tabs.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {tab.icon}
                <span>{isAr ? tab.labelAr : tab.labelEn}</span>
              </button>
            )
          })}
        </nav>
      </header>

      {activeTab === 'glSummary' && (
        <OdooAccountingAnalyticsHub
          isAr={isAr}
          locale={currentLocale}
          isAuditor={effectiveAuditor}
        />
      )}

      {activeTab === 'receivables' && (
        !workspace.odooConnected || workspace.noData ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600 dark:text-amber-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              لا توجد بيانات من Odoo لهذه الفترة
            </h3>
          </section>
        ) : (
          <section className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold text-slate-500">
                  {isAr ? 'صافي الذمم المدينة المفتوحة' : 'Net Open Receivables'}
                </p>
                <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                  {fmtKwd(workspace.receivables.openReceivableKwd)}
                </p>
                <div className="mt-3">
                  <KpiProvenanceBadge
                    model="account.move.line"
                    dateRange={{
                      from: workspace.receivables.fromDate || workspace.dateRange.from,
                      to: workspace.receivables.toDate || workspace.dateRange.to,
                    }}
                    lastSyncAt={workspace.lastSyncAt}
                    isStale24h={workspace.isStale24h}
                    kind="فعلي"
                    queryOrFormula={workspace.receivables.reconciliationFormulaAr}
                    isAr={isAr}
                  />
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold text-slate-500">
                  {isAr ? 'إجمالي الأرصدة المدينة الموجبة' : 'Gross Positive Receivables'}
                </p>
                <p className="mt-2 text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {fmtKwd(workspace.receivables.grossPositiveReceivableKwd)}
                </p>
                <div className="mt-3">
                  <KpiProvenanceBadge
                    model="account.move.line"
                    dateRange={{
                      from: workspace.receivables.fromDate || workspace.dateRange.from,
                      to: workspace.receivables.toDate || workspace.dateRange.to,
                    }}
                    lastSyncAt={workspace.lastSyncAt}
                    isStale24h={workspace.isStale24h}
                    kind="فعلي"
                    queryOrFormula="SUM(amount_residual > 0) ON asset_receivable"
                    isAr={isAr}
                  />
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold text-slate-500">
                  {isAr ? 'مقاصة التسويات الدائنة قيد التصفية' : 'Credit Clearing Offset'}
                </p>
                <p className="mt-2 text-2xl font-extrabold tabular-nums text-sky-700 dark:text-sky-400">
                  {fmtKwd(workspace.receivables.creditClearingOffsetKwd)}
                </p>
                <div className="mt-3">
                  <KpiProvenanceBadge
                    model="account.move.line"
                    dateRange={{
                      from: workspace.receivables.fromDate || workspace.dateRange.from,
                      to: workspace.receivables.toDate || workspace.dateRange.to,
                    }}
                    lastSyncAt={workspace.lastSyncAt}
                    isStale24h={workspace.isStale24h}
                    kind="فعلي"
                    queryOrFormula="ABS(SUM(amount_residual < 0)) ON asset_receivable"
                    isAr={isAr}
                  />
                </div>
              </article>
            </div>

            {workspace.receivables.agingBuckets.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
                  {isAr ? 'توزيع أعمار الذمم المدينة من Odoo' : 'Odoo Receivable Aging Buckets'}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 dark:border-slate-800">
                        <th className="px-3 py-2.5 text-start">{isAr ? 'الفئة العمرية' : 'Aging Bucket'}</th>
                        <th className="px-3 py-2.5 text-center">{isAr ? 'عدد السطور' : 'Lines'}</th>
                        <th className="px-3 py-2.5 text-end">{isAr ? 'صافي الرصيد' : 'Net Amount'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspace.receivables.agingBuckets.map((b) => (
                        <tr
                          key={b.key}
                          className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                        >
                          <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                            {isAr ? b.labelAr : b.labelEn}
                          </td>
                          <td className="px-3 py-2.5 text-center tabular-nums">{b.linesCount}</td>
                          <td className="px-3 py-2.5 text-end font-bold tabular-nums">
                            {fmtKwd(b.residualKwd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )
      )}

      {activeTab === 'pettyCash' && (
        <UnlinkedSourceNotice
          isAr={isAr}
          titleAr="العهد النقدية النثرية وكشوف التصفية (hr.expense)"
          titleEn="Petty Cash & Custodian Expense Sheets (hr.expense)"
          reasonAr="كشوف العهد النقدية التفصيلية غير مربوطة باستعلام من موديول hr.expense في Odoo."
          reasonEn="Detailed petty cash custodian sheets are not connected to an Odoo hr.expense feed."
        />
      )}

      {activeTab === 'cheques' && (
        <UnlinkedSourceNotice
          isAr={isAr}
          titleAr="حافظة الشيكات وكشوف المطابقة البنكية"
          titleEn="Cheque Register & Bank Statement Feeds"
          reasonAr="سجل الشيكات الصادرة وكشوف الحسابات البنكية التفصيلية غير مربوطة بمصدر بنكي."
          reasonEn="Issued cheque registers and bank statement feeds are not linked to a banking source."
        />
      )}

      {activeTab === 'leases' && (
        <UnlinkedSourceNotice
          isAr={isAr}
          titleAr="جداول عقود إيجارات الفروع (IFRS 16)"
          titleEn="Branch Lease Schedules (IFRS 16)"
          reasonAr="جداول استحقاق عقود الإيجارات التفصيلية للفروع غير مربوطة بموديول عقود منفصل في Odoo."
          reasonEn="Branch-level lease amortization schedules are not linked to a lease contract module in Odoo."
        />
      )}

      {activeTab === 'fleet' && (
        <UnlinkedSourceNotice
          isAr={isAr}
          titleAr="تكاليف ومخالفات أسطول المركبات والدراجات"
          titleEn="Fleet Fuel, Maintenance & Traffic Fines"
          reasonAr="تفاصيل مركبات التوصيل والوقود والمخالفات غير مربوطة بموديول fleet في Odoo."
          reasonEn="Delivery vehicle fuel, maintenance, and traffic fine logs are not linked to Odoo Fleet."
        />
      )}

      {activeTab === 'localDb' && liveChildren && <div>{liveChildren}</div>}
    </div>
  )
}
