'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Database,
  Download,
  FileText,
  Printer,
  Search,
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
import {
  buildLiveEnterpriseDepartments,
  type EnterpriseReportDef,
} from '@/lib/reports/enterprise-reports-registry'

interface Props {
  initialReportId?: string
  locale?: 'ar' | 'en'
  liveDbChildren?: React.ReactNode
}

export function DepartmentalReportsHub({
  initialReportId,
  locale = 'ar',
  liveDbChildren,
}: Props) {
  let ctxLocale: 'ar' | 'en' | null = null
  try {
    const i18n = useI18n()
    if (i18n?.locale) ctxLocale = i18n.locale
  } catch {}

  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)
  useEffect(() => {
    if (ctxLocale) setCurrentLocale(ctxLocale)
  }, [ctxLocale])

  const { filters, workspace, liveSummary, setPeriod } = useGlobalFilter()
  const isAr = currentLocale === 'ar'

  const [selectedReportId, setSelectedReportId] = useState<string | null>(initialReportId || null)
  const [activeDeptFilter, setActiveDeptFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showLocalDb, setShowLocalDb] = useState(false)

  const periodWindow = useMemo(
    () =>
      formatPeriodCalendarWindow(filters.period ?? 'month', {
        customFrom: filters.customFrom,
        customTo: filters.customTo,
        liveSummary,
      }),
    [filters.period, filters.customFrom, filters.customTo, liveSummary],
  )

  const departments = useMemo(
    () => buildLiveEnterpriseDepartments(workspace, liveSummary, isAr),
    [workspace, liveSummary, isAr],
  )

  const currentReport: EnterpriseReportDef | null = useMemo(() => {
    if (!selectedReportId) return null
    for (const d of departments) {
      const hit = d.reports.find((r) => r.id === selectedReportId)
      if (hit) return hit
    }
    return null
  }, [departments, selectedReportId])

  const filteredDepartments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return departments
      .filter((d) => activeDeptFilter === 'all' || d.id === activeDeptFilter)
      .map((d) => ({
        ...d,
        reports: d.reports.filter(
          (r) =>
            !q ||
            r.titleAr.toLowerCase().includes(q) ||
            r.titleEn.toLowerCase().includes(q) ||
            r.code.toLowerCase().includes(q),
        ),
      }))
      .filter((d) => d.reports.length > 0)
  }, [departments, activeDeptFilter, searchQuery])

  const handleExportCsv = (report: EnterpriseReportDef) => {
    if (report.rows.length === 0) return
    const headers = report.columns.map((c) => (isAr ? c.labelAr : c.labelEn))
    const lines = [
      headers.join(','),
      ...report.rows.map((r) =>
        report.columns
          .map((c) => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`)
          .join(','),
      ),
    ]
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.code}-${periodWindow.fromIso}-${periodWindow.toInclusiveIso}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <FileText className="h-3.5 w-3.5" />
              {isAr ? 'مركز التقارير المرتبط بـ Odoo 17' : 'Odoo 17 Connected Reports Center'}
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isAr
                ? 'مركز التقارير التنفيذية والمالية — فنتشر فودز'
                : 'Executive & Financial Reports Hub — Venture Foods'}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {isAr
                ? `الفترة المختارة: ${periodWindow.labelAr} (${periodWindow.fromIso} → ${periodWindow.toInclusiveIso})`
                : `Selected Period: ${periodWindow.labelEn} (${periodWindow.fromIso} → ${periodWindow.toInclusiveIso})`}
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

            {liveDbChildren && (
              <button
                type="button"
                onClick={() => setShowLocalDb((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Database className="h-3.5 w-3.5" />
                {isAr ? 'جداول النظام المحلي' : 'Local DB Tables'}
              </button>
            )}
          </div>
        </div>

        {!selectedReportId && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveDeptFilter('all')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                  activeDeptFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-emerald-600'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {isAr ? 'الكل' : 'All'}
              </button>
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => setActiveDeptFilter(dept.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                    activeDeptFilter === dept.id
                      ? 'bg-slate-900 text-white dark:bg-emerald-600'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {isAr ? dept.titleAr : dept.titleEn}
                </button>
              ))}
            </div>

            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'بحث في التقارير...' : 'Search reports...'}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pe-3 ps-9 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        )}
      </header>

      {showLocalDb && liveDbChildren && <div>{liveDbChildren}</div>}

      {currentReport ? (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelectedReportId(null)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {isAr ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
              {isAr ? 'العودة إلى دليل التقارير' : 'Back to Reports Directory'}
            </button>

            {currentReport.sourceState === 'odoo-live' && currentReport.rows.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportCsv(currentReport)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                >
                  <Download className="h-3.5 w-3.5" />
                  {isAr ? 'تصدير CSV' : 'Export CSV'}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Printer className="h-3.5 w-3.5" />
                  {isAr ? 'طباعة' : 'Print'}
                </button>
              </div>
            )}
          </div>

          {currentReport.sourceState === 'unlinked' ? (
            <UnlinkedSourceNotice
              isAr={isAr}
              titleAr={currentReport.titleAr}
              titleEn={currentReport.titleEn}
              reasonAr={currentReport.unlinkedReasonAr}
              reasonEn={currentReport.unlinkedReasonEn}
            />
          ) : !workspace.odooConnected || workspace.noData || currentReport.rows.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
              <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600 dark:text-amber-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                لا توجد بيانات من Odoo لهذه الفترة
              </h2>
            </div>
          ) : (
            <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div>
                <span className="text-xs font-bold text-emerald-600">{currentReport.code}</span>
                <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {isAr ? currentReport.titleAr : currentReport.titleEn}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {isAr ? currentReport.summaryAr : currentReport.summaryEn}
                </p>
              </div>

              {currentReport.glIncomplete && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>قيود غير مكتملة لهذه الفترة</span>
                </div>
              )}

              {currentReport.kpis.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {currentReport.kpis.map((kpi, idx) => (
                    <article
                      key={idx}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <p className="text-xs font-semibold text-slate-500">
                        {isAr ? kpi.labelAr : kpi.labelEn}
                      </p>
                      <p className="mt-1.5 text-xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                        {kpi.value}
                      </p>
                      {kpi.subtextAr && (
                        <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                          {isAr ? kpi.subtextAr : kpi.subtextEn ?? kpi.subtextAr}
                        </p>
                      )}
                      {kpi.odooModel && (
                        <div className="mt-2.5">
                          <KpiProvenanceBadge
                            model={kpi.odooModel}
                            dateRange={workspace.dateRange}
                            lastSyncAt={workspace.lastSyncAt}
                            isStale24h={workspace.isStale24h}
                            kind={kpi.provenanceKind ?? 'فعلي'}
                            queryOrFormula={kpi.queryOrFormula}
                            isAr={isAr}
                          />
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 dark:border-slate-800">
                      {currentReport.columns.map((col) => (
                        <th key={col.key} className="px-3 py-2.5 text-start">
                          {isAr ? col.labelAr : col.labelEn}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentReport.rows.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                      >
                        {currentReport.columns.map((col) => (
                          <td
                            key={col.key}
                            className="px-3 py-2.5 font-medium tabular-nums text-slate-900 dark:text-slate-100"
                          >
                            {String(row[col.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-6">
          {!workspace.odooConnected || workspace.noData ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
              <AlertCircle className="mx-auto mb-2 h-7 w-7 text-amber-600 dark:text-amber-400" />
              <p className="text-base font-bold text-slate-900 dark:text-white">
                لا توجد بيانات من Odoo لهذه الفترة
              </p>
            </div>
          ) : null}

          {filteredDepartments.map((dept) => (
            <section
              key={dept.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {dept.icon} {isAr ? dept.titleAr : dept.titleEn}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {isAr ? dept.descriptionAr : dept.descriptionEn}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {dept.reports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => setSelectedReportId(report.id)}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-start transition hover:border-emerald-500 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-emerald-500"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-500">{report.code}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            report.sourceState === 'unlinked'
                              ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {report.sourceState === 'unlinked'
                            ? 'غير مربوط بمصدر'
                            : report.odooModel ?? 'Odoo'}
                        </span>
                      </div>
                      <h3 className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                        {isAr ? report.titleAr : report.titleEn}
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {isAr ? report.summaryAr : report.summaryEn}
                      </p>
                    </div>
                    <div className="mt-4 border-t border-slate-200/80 pt-2.5 text-xs font-extrabold tabular-nums text-emerald-700 dark:border-slate-700 dark:text-emerald-400">
                      {isAr ? report.headlineMetricAr : report.headlineMetricEn}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
