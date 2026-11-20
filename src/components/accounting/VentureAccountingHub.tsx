'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  BookOpen,
  Database,
  Landmark,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  GLOBAL_PERIOD_OPTIONS,
  formatPeriodCalendarWindow,
  type GlobalPeriod,
} from '@/lib/aether/global-filter-engine'
import KpiProvenanceBadge from '@/components/erp/KpiProvenanceBadge'
import { StateBlock } from '@/components/ui'
import {
  formatInt,
  formatKwd,
} from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { GlStatementsPanel } from '@/components/accounting/GlStatementsPanel'
import { OdooAccountingAnalyticsHub } from './OdooAccountingAnalyticsHub'

export type VentureAccountingTabId = 'glSummary' | 'receivables' | 'localDb'

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

  const [activeTab, setActiveTab] = useState<VentureAccountingTabId>(initialTab)

  const periodWindow = formatPeriodCalendarWindow(filters.period ?? 'month', {
    customFrom: filters.customFrom,
    customTo: filters.customTo,
    liveSummary,
  })

  const tabs: Array<{
    id: typeof activeTab
    labelAr: string
    labelEn: string
    icon: React.ReactNode
  }> = [
    {
      id: 'glSummary',
      labelAr: 'ملخص دفتر الأستاذ العام',
      labelEn: 'Odoo General Ledger',
      icon: <BookOpen className="h-4 w-4" aria-hidden />,
    },
    {
      id: 'receivables',
      labelAr: 'الذمم المدينة المفتوحة',
      labelEn: 'Open receivables',
      icon: <Landmark className="h-4 w-4" aria-hidden />,
    },
    ...(liveChildren && !embeddedInErp
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

  const receivablesKpis = useMemo(() => {
    const rec = workspace.receivables
    if (rec.unavailable) return []
    const items: Array<{ key: string; node: React.ReactNode }> = []
    const range = {
      from: rec.fromDate || workspace.dateRange.from,
      to: rec.toDate || workspace.dateRange.to,
    }

    if (rec.figures?.netKwd != null) {
      items.push({
        key: 'net-ar',
        node: (
          <article className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <p className="min-w-0 truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
              {isAr ? 'صافي الذمم المدينة المفتوحة' : 'Net Open Receivables'}
            </p>
            <p
              dir="ltr"
              className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white"
            >
              {formatKwd(rec.figures.netKwd, currentLocale)}
            </p>
            <div className="mt-3">
              <KpiProvenanceBadge
                model="account.move.line"
                dateRange={range}
                lastSyncAt={workspace.lastSyncAt}
                isStale24h={workspace.isStale24h}
                kind="فعلي"
                queryOrFormula={rec.figures.formulaEn ?? 'Open residual'}
                queryOrFormulaAr={rec.figures.formulaAr ?? 'رصيد متبقٍ غير مسوّى'}
                isAr={isAr}
                compact
              />
            </div>
          </article>
        ),
      })
    }

    if (rec.figures?.openDebitsKwd != null && Math.abs(rec.figures.openDebitsKwd) > 0.0005) {
      items.push({
        key: 'open-debits',
        node: (
          <article className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <p className="min-w-0 truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
              {isAr ? 'إجمالي الأرصدة المدينة الموجبة' : 'Gross Positive Receivables'}
            </p>
            <p
              dir="ltr"
              className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400"
            >
              {formatKwd(rec.figures.openDebitsKwd, currentLocale)}
            </p>
            <div className="mt-3">
              <KpiProvenanceBadge
                model="account.move.line"
                dateRange={range}
                lastSyncAt={workspace.lastSyncAt}
                isStale24h={workspace.isStale24h}
                kind="فعلي"
                queryOrFormula="SUM(amount_residual > 0) ON asset_receivable"
                queryOrFormulaAr="مجموع الأرصدة المتبقية الموجبة على حسابات الذمم المدينة"
                isAr={isAr}
                compact
              />
            </div>
          </article>
        ),
      })
    }

    if (rec.figures?.unappliedCreditsKwd != null && Math.abs(rec.figures.unappliedCreditsKwd) > 0.0005) {
      items.push({
        key: 'credit-clearing',
        node: (
          <article className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <p className="min-w-0 truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
              {isAr ? 'مقاصة التسويات الدائنة قيد التصفية' : 'Credit Clearing Offset'}
            </p>
            <p
              dir="ltr"
              className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-sky-700 dark:text-sky-400"
            >
              {formatKwd(rec.figures.unappliedCreditsKwd, currentLocale)}
            </p>
            <div className="mt-3">
              <KpiProvenanceBadge
                model="account.move.line"
                dateRange={range}
                lastSyncAt={workspace.lastSyncAt}
                isStale24h={workspace.isStale24h}
                kind="فعلي"
                queryOrFormula="ABS(SUM(amount_residual < 0)) ON asset_receivable"
                queryOrFormulaAr="القيمة المطلقة لمجموع الأرصدة الدائنة غير المطبّقة على حسابات الذمم المدينة"
                isAr={isAr}
                compact
              />
            </div>
          </article>
        ),
      })
    }

    return items
  }, [
    currentLocale,
    isAr,
    workspace.dateRange.from,
    workspace.dateRange.to,
    workspace.isStale24h,
    workspace.lastSyncAt,
    workspace.receivables,
  ])

  const HeadingTag = embeddedInErp ? 'h2' : 'h1'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-6">
      <header className="ds-surface relative overflow-visible rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Landmark className="h-3.5 w-3.5" aria-hidden />
                {isAr ? 'الإدارة المالية ومحاسبة أودو 17' : 'Financial Accounting & Odoo 17 GL'}
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
            <div className="inline-flex max-w-full overflow-x-auto no-scrollbar rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
              {GLOBAL_PERIOD_OPTIONS.filter((p) => p.id !== 'custom').map((opt) => {
                const active = filters.period === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPeriod(opt.id as GlobalPeriod)}
                    className={`ds-focus-ring shrink-0 cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
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
                className="ds-focus-ring inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {isAr ? 'قيد يومية جديد' : 'New Journal Entry'}
              </Link>
            )}
          </div>
        </div>

        <nav
          role="tablist"
          aria-label={isAr ? 'أقسام المحاسبة' : 'Accounting sections'}
          className="mt-5 flex max-w-full gap-2 overflow-x-auto no-scrollbar border-t border-slate-200 pt-4 dark:border-slate-800"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`ds-focus-ring inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition ${
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
        <>
          <OdooAccountingAnalyticsHub
            isAr={isAr}
            locale={currentLocale}
            isAuditor={effectiveAuditor}
          />
          <GlStatementsPanel from={workspace.accounting.from} to={workspace.accounting.to} isAr={isAr} />
        </>
      )}

      {activeTab === 'receivables' && (
        !workspace.odooConnected || workspace.noData ? (
          <StateBlock
            state={!workspace.odooConnected ? 'unlinked' : 'empty'}
            locale={currentLocale}
            title={isAr ? 'لا توجد بيانات من Odoo لهذه الفترة' : 'No Odoo receivables data for this period'}
          />
        ) : workspace.receivables.unavailable ? (
          <StateBlock state="unavailable" locale={currentLocale} compact />
        ) : (
          <section className="space-y-6">
            {receivablesKpis.length > 0 ? (
              <div
                className={`grid gap-4 ${
                  receivablesKpis.length === 1
                    ? 'grid-cols-1'
                    : receivablesKpis.length === 2
                      ? 'grid-cols-1 md:grid-cols-2'
                      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {receivablesKpis.map((item) => (
                  <React.Fragment key={item.key}>{item.node}</React.Fragment>
                ))}
              </div>
            ) : null}

            <div
              data-finance-ai-insights="true"
              className="ds-surface relative overflow-visible flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-50/50 p-4 dark:border-emerald-400/20 dark:bg-[#0f1d18]"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {isAr
                    ? `يوجد ${formatInt(workspace.receivables.unreconciledLineCount, currentLocale)} سطر ذمم مفتوح غير مسوّى في أودو 17 — افتح استوديو أعمار الذمم لمطابقة المنصات والشركاء.`
                    : `${formatInt(workspace.receivables.unreconciledLineCount, currentLocale)} unreconciled receivable lines active in Odoo 17 — open AR Aging Studio for partner & platform matching.`}
                </span>
              </div>
              <Link
                href="/erp/receivables"
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <span>{isAr ? 'استوديو أعمار الذمم' : 'Open AR Aging Studio'}</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>

            {workspace.receivables.agingBuckets.length > 0 ? (
              <div className="ds-surface relative overflow-visible rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
                  {isAr ? 'توزيع أعمار الذمم المدينة من أودو' : 'Odoo Receivable Aging Buckets'}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[460px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                        <th className="whitespace-nowrap px-3 py-2.5 text-start">{isAr ? 'الفئة العمرية' : 'Aging Bucket'}</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-center">{isAr ? 'عدد السطور' : 'Lines'}</th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-end">{isAr ? 'صافي الرصيد' : 'Net Amount'}</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {workspace.receivables.agingBuckets.map((b) => (
                        <tr
                          key={b.key}
                          className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                        >
                          <td className="max-w-[220px] truncate px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                            {isAr ? b.labelAr : b.labelEn}
                          </td>
                          <td dir="ltr" className="ds-num whitespace-nowrap px-3 py-2.5 text-center tabular-nums">
                            {formatInt(b.linesCount, currentLocale)}
                          </td>
                          <td dir="ltr" className="ds-num whitespace-nowrap px-3 py-2.5 text-end font-bold tabular-nums">
                            {formatKwd(b.residualKwd, currentLocale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>
        )
      )}

      {activeTab === 'localDb' && liveChildren && <div>{liveChildren}</div>}
    </div>
  )
}
