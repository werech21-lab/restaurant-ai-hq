'use client'

import React, { useEffect, useState } from 'react'
import { ReceivablesPendingStatus } from '@/components/ui/receivables-pending-status'
import { canShowReceivableAmounts } from '@/lib/aether/receivables-status'
import Link from 'next/link'
import {
  BookOpen,
  Database,
  Landmark,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  GLOBAL_PERIOD_OPTIONS,
  formatPeriodCalendarWindow,
  type GlobalPeriod,
} from '@/lib/aether/global-filter-engine'
import KpiProvenanceBadge from '@/components/erp/KpiProvenanceBadge'
import { PartialWarningBanner, StateBlock } from '@/components/ui'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKuwaitDate,
  formatKuwaitDateTime,
  formatKwd,
  getUnavailableTooltip,
} from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { OdooAccountingAnalyticsHub } from './OdooAccountingAnalyticsHub'

export type VentureAccountingTabId =
  | 'glSummary'
  | 'receivables'
  | 'localDb'

export function VentureAccountingHub({
  locale = 'ar',
  isAuditor = false,
  embeddedInErp = false,
  initialTab = 'glSummary',
  liveChildren,
}: {
  locale?: 'ar' | 'en'
  isAuditor?: boolean
  embeddedInErp?: boolean
  initialTab?: VentureAccountingTabId
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
  const unavailableTooltip = getUnavailableTooltip(currentLocale)

  const [activeTab, setActiveTab] = useState<VentureAccountingTabId>(initialTab)

  const periodWindow = formatPeriodCalendarWindow(filters.period ?? 'month', {
    customFrom: filters.customFrom,
    customTo: filters.customTo,
    liveSummary,
  })

  const hasLiveChildren = Boolean(liveChildren) && !embeddedInErp

  const tabs: Array<{
    id: VentureAccountingTabId
    labelAr: string
    labelEn: string
    icon: React.ReactNode
  }> = [
    {
      id: 'glSummary',
      labelAr: 'ملخص دفتر الأستاذ (Odoo GL)',
      labelEn: 'Odoo General Ledger',
      icon: <BookOpen className="h-4 w-4" aria-hidden />,
    },
    {
      id: 'receivables',
      labelAr: 'الذمم المدينة وأعمار الديون',
      labelEn: 'Receivables & Aging',
      icon: <Landmark className="h-4 w-4" aria-hidden />,
    },
    ...(hasLiveChildren
      ? [
          {
            id: 'localDb' as const,
            labelAr: 'سجلات النظام المحلي',
            labelEn: 'Local Ledger Records',
            icon: <Database className="h-4 w-4" aria-hidden />,
          },
        ]
      : []),
  ]

  const effectiveTab: VentureAccountingTabId = tabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : 'glSummary'

  const rec = workspace.receivables
  const amountsVisible = canShowReceivableAmounts(rec)
  const syncDateDisplay = rec.asOfDate
    ? formatKuwaitDate(rec.asOfDate, currentLocale)
    : liveSummary?.kuwaitSyncedAt ??
      formatKuwaitDateTime(liveSummary?.latestOdooRecordAt ?? liveSummary?.syncedAt ?? null, currentLocale)
  const companyScopeId = rec.companyId ?? workspace.odooCompanyId ?? liveSummary?.odooCompanyId ?? null

  const HeadingTag = embeddedInErp ? 'h2' : 'h1'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-6">
      <header className="ds-surface rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Landmark className="h-3.5 w-3.5" aria-hidden />
                {isAr ? 'الإدارة المالية ومحاسبة Odoo 17' : 'Financial Accounting & Odoo 17 GL'}
              </span>

              {effectiveAuditor ? (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-slate-100 text-slate-700 ring-1 ring-slate-300/60 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/15">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  {isAr ? 'وضع المراجع الخارجي — قراءة فقط' : 'External Auditor Mode — Read Only'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {isAr ? 'تصنيف المخاطر والرقابة الداخلية' : 'Risk Classification & Internal Control'}
                </span>
              )}
            </div>

            <HeadingTag className="text-2xl font-bold text-slate-900 dark:text-white break-words">
              {isAr
                ? 'مركز المحاسبة ودفتر الأستاذ العام — شركة فنتشر فودز'
                : 'General Ledger & Accounting Hub — Venture Foods W.L.L.'}
            </HeadingTag>
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
                    aria-pressed={active}
                    onClick={() => setPeriod(opt.id as GlobalPeriod)}
                    className={`ds-focus-ring rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
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
              <Link
                href="/accounting?tab=entry"
                className="ds-focus-ring inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {isAr ? 'قيد يومية جديد' : 'New Journal Entry'}
              </Link>
            )}
          </div>
        </div>

        <nav
          role="tablist"
          aria-label={isAr ? 'أقسام المحاسبة' : 'Accounting sections'}
          className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800"
        >
          {tabs.map((tab) => {
            const active = effectiveTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`ds-focus-ring inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
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

      {!embeddedInErp ? <PartialWarningBanner summary={liveSummary} isAr={isAr} /> : null}

      {effectiveTab === 'glSummary' && (
        <OdooAccountingAnalyticsHub
          isAr={isAr}
          locale={currentLocale}
          isAuditor={effectiveAuditor}
        />
      )}

      {effectiveTab === 'receivables' && (
        !workspace.odooConnected || workspace.noData ? (
          <StateBlock
            state={!workspace.odooConnected ? 'unlinked' : 'empty'}
            locale={currentLocale}
            title={isAr ? 'لا توجد بيانات من Odoo لهذه الفترة' : 'No Odoo receivables data for this period'}
          />
        ) : !rec.unavailable && (!amountsVisible || rec.pendingReconciliation) ? (
          <section
            data-receivables-pending="true"
            className="ds-surface space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span>
                {isAr
                  ? `نطاق الشركة: فنتشر فودز ذ.م.م${companyScopeId ? ` (#${companyScopeId})` : ''}`
                  : `Company Scope: Venture Foods W.L.L.${companyScopeId ? ` (#${companyScopeId})` : ''}`}
              </span>
              <span>
                {isAr
                  ? `الرصيد المفتوح كما في ${syncDateDisplay} (جميع البنود المفتوحة، مستقلة عن فلتر الفترة)`
                  : `Open balance as of ${syncDateDisplay} (all open items, independent of period filter)`}
              </span>
            </div>
            <ReceivablesPendingStatus isAr={isAr} showDetail />
            <div className="flex flex-wrap gap-3 text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">
              <span>
                {isAr
                  ? `${formatInt(rec.unreconciledLineCount, currentLocale)} قيد غير مسوّى (${formatInt(rec.posClearingLinesCount, currentLocale)} مقاصة كاشير + ${formatInt(rec.platformAndCorporateLinesCount, currentLocale)} ذمم منصات وشركات)`
                  : `${formatInt(rec.unreconciledLineCount, currentLocale)} unreconciled lines (${formatInt(rec.posClearingLinesCount, currentLocale)} POS clearing + ${formatInt(rec.platformAndCorporateLinesCount, currentLocale)} platform/corporate)`}
              </span>
              {typeof rec.partnerCount === 'number' ? (
                <span>
                  {isAr
                    ? `· ${formatInt(rec.partnerCount, currentLocale)} شريكاً`
                    : `· ${formatInt(rec.partnerCount, currentLocale)} partners`}
                </span>
              ) : null}
            </div>
            {rec.accountNames && rec.accountNames.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {rec.accountNames.map((acc) => (
                  <span
                    key={`${acc.code}-${acc.name}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <span dir="ltr" className="font-mono font-bold text-slate-600 dark:text-slate-300">
                      {acc.code}
                    </span>{' '}
                    {isAr ? acc.labelAr : acc.labelEn}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        ) : (
          <section className="space-y-6">
            {!rec.unavailable ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
                <span>
                  {isAr
                    ? `نطاق الشركة: فنتشر فودز ذ.م.م${companyScopeId ? ` (#${companyScopeId})` : ''}`
                    : `Company Scope: Venture Foods W.L.L.${companyScopeId ? ` (#${companyScopeId})` : ''}`}
                </span>
                <span>
                  {isAr
                    ? `الرصيد المفتوح كما في ${syncDateDisplay} (جميع البنود المفتوحة، مستقلة عن فلتر الفترة)`
                    : `Open balance as of ${syncDateDisplay} (all open items, independent of period filter)`}
                </span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <article className="ds-surface rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {isAr ? 'صافي الذمم المدينة المفتوحة' : 'Net Open Receivables'}
                </p>
                <p
                  dir="ltr"
                  title={rec.unavailable ? unavailableTooltip : undefined}
                  aria-label={rec.unavailable ? unavailableTooltip : undefined}
                  data-unavailable={rec.unavailable ? 'true' : undefined}
                  className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white"
                >
                  {rec.unavailable
                    ? isAr
                      ? 'غير متاح'
                      : UNAVAILABLE_DASH
                    : formatKwd(rec.openReceivableKwd, currentLocale)}
                </p>
                <div className="mt-3">
                  <KpiProvenanceBadge
                    model="account.move.line"
                    dateRange={{
                      from: rec.fromDate || workspace.dateRange.from,
                      to: rec.toDate || workspace.dateRange.to,
                    }}
                    lastSyncAt={workspace.lastSyncAt}
                    isStale24h={workspace.isStale24h}
                    kind="فعلي"
                    queryOrFormula={rec.reconciliationFormulaAr}
                    isAr={isAr}
                  />
                </div>
              </article>

              <article className="ds-surface rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {isAr ? 'إجمالي الأرصدة المدينة الموجبة' : 'Gross Positive Receivables'}
                </p>
                <p
                  dir="ltr"
                  title={rec.unavailable ? unavailableTooltip : undefined}
                  aria-label={rec.unavailable ? unavailableTooltip : undefined}
                  data-unavailable={rec.unavailable ? 'true' : undefined}
                  className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400"
                >
                  {rec.unavailable
                    ? isAr
                      ? 'غير متاح'
                      : UNAVAILABLE_DASH
                    : formatKwd(rec.grossPositiveReceivableKwd, currentLocale)}
                </p>
                <div className="mt-3">
                  <KpiProvenanceBadge
                    model="account.move.line"
                    dateRange={{
                      from: rec.fromDate || workspace.dateRange.from,
                      to: rec.toDate || workspace.dateRange.to,
                    }}
                    lastSyncAt={workspace.lastSyncAt}
                    isStale24h={workspace.isStale24h}
                    kind="فعلي"
                    queryOrFormula="SUM(amount_residual > 0) ON asset_receivable"
                    isAr={isAr}
                  />
                </div>
              </article>

              <article className="ds-surface rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {isAr ? 'مقاصة التسويات الدائنة قيد التصفية' : 'Credit Clearing Offset'}
                </p>
                <p
                  dir="ltr"
                  title={rec.unavailable ? unavailableTooltip : undefined}
                  aria-label={rec.unavailable ? unavailableTooltip : undefined}
                  data-unavailable={rec.unavailable ? 'true' : undefined}
                  className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-sky-700 dark:text-sky-400"
                >
                  {rec.unavailable
                    ? isAr
                      ? 'غير متاح'
                      : UNAVAILABLE_DASH
                    : formatKwd(rec.creditClearingOffsetKwd, currentLocale)}
                </p>
                <div className="mt-3">
                  <KpiProvenanceBadge
                    model="account.move.line"
                    dateRange={{
                      from: rec.fromDate || workspace.dateRange.from,
                      to: rec.toDate || workspace.dateRange.to,
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

            {rec.unavailable ? (
              <StateBlock state="unavailable" locale={currentLocale} compact />
            ) : rec.agingBuckets.length === 0 ? (
              <StateBlock
                state="empty"
                locale={currentLocale}
                compact
                title={isAr ? 'لا توجد شرائح أعمار ذمم مسجلة' : 'No receivable aging buckets recorded'}
              />
            ) : (
              <div className="ds-surface rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
                  {isAr ? 'توزيع أعمار الذمم المدينة من Odoo' : 'Odoo Receivable Aging Buckets'}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[460px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                        <th className="px-3 py-2.5 text-start">{isAr ? 'الفئة العمرية' : 'Aging Bucket'}</th>
                        <th className="px-3 py-2.5 text-center">{isAr ? 'عدد السطور' : 'Lines'}</th>
                        <th className="px-3 py-2.5 text-end">{isAr ? 'صافي الرصيد' : 'Net Amount'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rec.agingBuckets.map((b) => (
                        <tr
                          key={b.key}
                          className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                        >
                          <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                            {isAr ? b.labelAr : b.labelEn}
                          </td>
                          <td dir="ltr" className="ds-num px-3 py-2.5 text-center tabular-nums">
                            {formatInt(b.linesCount, currentLocale)}
                          </td>
                          <td dir="ltr" className="ds-num px-3 py-2.5 text-end font-bold tabular-nums">
                            {formatKwd(b.residualKwd, currentLocale)}
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

      {effectiveTab === 'localDb' && hasLiveChildren && <div>{liveChildren}</div>}
    </div>
  )
}
