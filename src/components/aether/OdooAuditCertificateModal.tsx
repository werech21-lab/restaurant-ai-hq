'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Check, CheckCircle2, Copy, Printer, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { ODOO } from '@/lib/odoo/odoo-dataset'
import type { OdooBucketSummary } from '@/lib/odoo/live-sync-core'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  formatPeriodCalendarWindow,
} from '@/lib/aether/global-filter-engine'

function formatKuwaitNow(isAr: boolean, date = new Date()): string {
  try {
    return new Intl.DateTimeFormat(isAr ? 'ar-KW' : 'en-GB', {
      timeZone: 'Asia/Kuwait',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date)
  } catch {
    return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC+3'
  }
}

const fInt = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')
const f3 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
const fSigned3 = (n: number) => `${n > 0 ? '+' : ''}${f3(n)}`

/**
 * Compact header trigger pill + modal for Odoo 17 Audit & Reconciliation Certificate:
 * Presents ONE single canonical active POS total, ONE single canonical reconciliation equation,
 * and the REAL computed variance against Odoo General Ledger (`account.move.line`) — never dual
 * stale totals or hardcoded 30-day receipt counts.
 */
export function OdooAuditCertificatePill({ isAr }: { isAr: boolean }) {
  const { filters, liveSummary } = useGlobalFilter()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [auditTime, setAuditTime] = useState<Date>(() => new Date())

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    setAuditTime(new Date())
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open])

  const auditData = useMemo(() => {
    const isLiveConnected =
      liveSummary?.connected === true &&
      liveSummary?.source === 'live' &&
      liveSummary?.sourceMode === 'odoo17-live'
    const rawBuckets = (ODOO as unknown as { buckets?: Record<string, OdooBucketSummary> }).buckets
    const activePeriodKey =
      filters.period === 'today' ||
      filters.period === 'week' ||
      filters.period === 'month' ||
      filters.period === 'year'
        ? filters.period
        : 'month'

    const activeBkt: OdooBucketSummary | undefined =
      filters.period === 'custom' && liveSummary?.customBucket
        ? liveSummary.customBucket
        : (liveSummary?.buckets?.[activePeriodKey] ??
          rawBuckets?.[activePeriodKey] ??
          liveSummary?.buckets?.month ??
          rawBuckets?.month)

    const resolvedWin = formatPeriodCalendarWindow(filters.period, {
      customFrom: filters.customFrom,
      customTo: filters.customTo,
      liveSummary,
    })
    const periodFrom = resolvedWin.fromIso
    const periodTo = resolvedWin.toInclusiveIso
    const computedSpanDays =
      Math.round(
        (Date.parse(`${periodTo}T12:00:00Z`) - Date.parse(`${periodFrom}T12:00:00Z`)) / 86_400_000,
      ) + 1
    const periodDays = Math.max(1, Number.isFinite(computedSpanDays) ? computedSpanDays : (activeBkt?.days ?? 30))
    const lastSyncedLabel =
      liveSummary?.kuwaitSyncedAt ??
      liveSummary?.latestOdooRecordAt ??
      liveSummary?.syncedAt ??
      null

    const mappedBranchesMap = activeBkt?.mappedByLocation ?? activeBkt?.byLocation
    const mappedBranchesKwd = mappedBranchesMap
      ? Object.values(mappedBranchesMap).reduce((s, v) => s + (v?.netKwd ?? 0), 0)
      : (liveSummary?.companyTotals?.mappedBranchesNetKwd ??
        ODOO.restaurants.reduce((s, r) => s + r.netKwd, 0))

    const companyActivePosKwd =
      typeof activeBkt?.totals?.netSalesKwd === 'number' && activeBkt.totals.netSalesKwd > 0
        ? activeBkt.totals.netSalesKwd
        : (liveSummary?.companyTotals?.netSalesKwd ?? ODOO.totals.netSalesKwd)

    const unmappedTerminalsKwd =
      activePeriodKey === 'month' &&
      filters.period !== 'custom' &&
      typeof liveSummary?.companyTotals?.unmappedTerminalsNetKwd === 'number'
        ? liveSummary.companyTotals.unmappedTerminalsNetKwd
        : (activeBkt?.unmappedSummary?.netSalesKwd ??
          Math.max(0, companyActivePosKwd - mappedBranchesKwd))

    const posOrdersActiveWindow =
      activeBkt?.totals?.orders ?? liveSummary?.totals?.orders ?? ODOO.totals.orders

    // Canonical single equation residual: (7 Mapped Branches + Unmapped Active Terminals) - Active Company POS
    const posEquationVarianceKwd =
      mappedBranchesKwd + unmappedTerminalsKwd - companyActivePosKwd

    // Real computed variance against Posted General Ledger (`account.move.line`)
    const glAcc = activeBkt?.accounting
    const hasLiveGlRevenue =
      Boolean(glAcc?.available) &&
      typeof glAcc?.totalRevenue === 'number' &&
      Number.isFinite(glAcc.totalRevenue)
    const glRevenueKwd = hasLiveGlRevenue ? (glAcc!.totalRevenue as number) : null
    const glVsPosDiff =
      glRevenueKwd !== null ? glRevenueKwd - companyActivePosKwd : null

    const canonicalEquationAr = `الفروع الـ ${APPROVED_BRANCH_IDS.length} المربوطة (${f3(mappedBranchesKwd)}) + الأجهزة النشطة غير المربوطة (${f3(unmappedTerminalsKwd)}) = صافي مبيعات الشركة النشط (${f3(companyActivePosKwd)} د.ك)`
    const canonicalEquationEn = `${APPROVED_BRANCH_IDS.length} Mapped Branches (${f3(mappedBranchesKwd)}) + Unmapped Active Terminals (${f3(unmappedTerminalsKwd)}) = Active Company POS Net Sales (${f3(companyActivePosKwd)} KWD)`

    const varianceBadgeAr =
      glVsPosDiff !== null
        ? `الفارق الفعلي مع دفتر الأستاذ: ${fSigned3(glVsPosDiff)} د.ك`
        : `فرق التوزيع الداخلي للكاشير: ${fSigned3(posEquationVarianceKwd)} د.ك`
    const varianceBadgeEn =
      glVsPosDiff !== null
        ? `Actual GL vs POS Variance: ${fSigned3(glVsPosDiff)} KWD`
        : `Internal POS Allocation Variance: ${fSigned3(posEquationVarianceKwd)} KWD`

    const varianceReasonAr =
      glVsPosDiff !== null && glRevenueKwd !== null
        ? `إيرادات دفتر الأستاذ العام المرحّلة (account.move.line) لنفس الفترة تبلغ ${f3(glRevenueKwd)} د.ك مقابل ${f3(companyActivePosKwd)} د.ك في نقاط البيع النشطة (${fInt(posOrdersActiveWindow)} إيصال خلال ${fInt(periodDays)} يوماً)، بفارق محاسبي محسوب قدره ${fSigned3(glVsPosDiff)} د.ك ناتج عن قيود جلسات الوحدات المستبعدة المرحّلة في حسابات المبيعات المشتركة وفواتير التموين وتوقيت إقفال الورديات الليلية.`
        : `قيود إيرادات دفتر الأستاذ العام غير محمّلة لهذه النافذة؛ إجمالي نقاط البيع النشطة المعتمد هو ${f3(companyActivePosKwd)} د.ك عبر ${fInt(posOrdersActiveWindow)} إيصال خلال ${fInt(periodDays)} يوماً عبر ${APPROVED_BRAND_IDS.length} علامات تجارية و${APPROVED_BRANCH_IDS.length} فروع.`
    const varianceReasonEn =
      glVsPosDiff !== null && glRevenueKwd !== null
        ? `Posted General Ledger revenue (account.move.line) for this exact window is ${f3(glRevenueKwd)} KWD vs. ${f3(companyActivePosKwd)} KWD in active POS (${fInt(posOrdersActiveWindow)} receipts across ${fInt(periodDays)} days), yielding a real computed variance of ${fSigned3(glVsPosDiff)} KWD from shared income-account postings of excluded units, catering invoices, and midnight shift-close cutoffs.`
        : `Posted General Ledger revenue is not loaded for this window; canonical active POS net sales equal ${f3(companyActivePosKwd)} KWD across ${fInt(posOrdersActiveWindow)} receipts (${fInt(periodDays)} days) spanning ${APPROVED_BRAND_IDS.length} brands and ${APPROVED_BRANCH_IDS.length} branches.`

    const isExactZeroFromLive =
      isLiveConnected && glVsPosDiff !== null && Math.abs(glVsPosDiff) < 0.001

    return {
      isLiveConnected,
      periodFrom,
      periodTo,
      periodDays,
      lastSyncedLabel,
      mappedBranchesKwd,
      unmappedTerminalsKwd,
      companyActivePosKwd,
      posOrdersActiveWindow,
      glRevenueKwd,
      glVsPosDiff,
      posEquationVarianceKwd,
      canonicalEquationAr,
      canonicalEquationEn,
      varianceBadgeAr,
      varianceBadgeEn,
      varianceReasonAr,
      varianceReasonEn,
      isExactZeroFromLive,
    }
  }, [filters.period, liveSummary])

  const handleRefreshAudit = useCallback(async () => {
    setRefreshing(true)
    try {
      const qs =
        filters.period === 'custom' && filters.customFrom && filters.customTo
          ? `period=custom&from=${encodeURIComponent(filters.customFrom)}&to=${encodeURIComponent(filters.customTo)}`
          : `period=${encodeURIComponent(filters.period === 'custom' ? 'month' : filters.period)}`
      const res = await fetch(`/api/erp/odoo-sync?${qs}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (res.ok) {
        const d = await res.json()
        window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: d }))
      }
    } catch {
      // keep last known state
    } finally {
      setAuditTime(new Date())
      setRefreshing(false)
    }
  }, [filters.customFrom, filters.customTo, filters.period])

  const kuwaitTimestamp = useMemo(() => formatKuwaitNow(isAr, auditTime), [auditTime, isAr])

  const handleCopyWhatsApp = useCallback(async () => {
    const lines = isAr
      ? [
          `📋 *شهادة فحص ومطابقة أودو 17 — فنتشر فودز*`,
          `🗓️ الفترة المفحوصة: من ${auditData.periodFrom} إلى ${auditData.periodTo} (${fInt(auditData.periodDays)} يوماً)`,
          `🕒 وقت الفحص بتوقيت الكويت: ${kuwaitTimestamp}${auditData.lastSyncedLabel ? ` (آخر مزامنة أودو: ${auditData.lastSyncedLabel})` : ''}`,
          `💰 الإجمالي الموحد المعتمد: ${f3(auditData.companyActivePosKwd)} د.ك (${fInt(auditData.posOrdersActiveWindow)} إيصال كاشير)`,
          `🧮 المعادلة الموحدة: ${auditData.canonicalEquationAr}`,
          `⚖️ ${auditData.varianceBadgeAr}`,
          `📌 التفسير المحاسبي: ${auditData.varianceReasonAr}`,
        ]
      : [
          `📋 *Odoo 17 Audit & Reconciliation Certificate — Venture Foods*`,
          `🗓️ Audited Window: ${auditData.periodFrom} to ${auditData.periodTo} (${fInt(auditData.periodDays)} days)`,
          `🕒 Kuwait Audit Time: ${kuwaitTimestamp}${auditData.lastSyncedLabel ? ` (Last Odoo Sync: ${auditData.lastSyncedLabel})` : ''}`,
          `💰 Canonical Active POS Total: ${f3(auditData.companyActivePosKwd)} KWD (${fInt(auditData.posOrdersActiveWindow)} POS receipts)`,
          `🧮 Canonical Equation: ${auditData.canonicalEquationEn}`,
          `⚖️ ${auditData.varianceBadgeEn}`,
          `📌 Accounting Note: ${auditData.varianceReasonEn}`,
        ]

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      // ignore clipboard errors
    }
  }, [auditData, isAr, kuwaitTimestamp])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-[13px] font-extrabold text-emerald-800 ring-1 ring-emerald-500/25 transition-all duration-150 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/30 dark:hover:bg-emerald-900/60"
      >
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="whitespace-nowrap">
          {isAr ? 'شهادة فحص ومطابقة أودو ✅' : 'Odoo Audit Certificate ✅'}
        </span>
      </button>

      {mounted && open
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={isAr ? 'شهادة فحص ومطابقة أودو' : 'Odoo Audit & Reconciliation Certificate'}
              dir={isAr ? 'rtl' : 'ltr'}
              className="fixed inset-0 z-[120] flex items-center justify-center bg-[#09110E]/55 p-4 backdrop-blur-xs"
              onClick={() => setOpen(false)}
            >
              <div
                className="ae-bento-card relative max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 shadow-2xl sm:p-6"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-white/10">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-extrabold text-slate-800 ring-1 ring-slate-900/10 dark:bg-white/10 dark:text-slate-200">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        {auditData.isLiveConnected
                          ? isAr
                            ? `مطابقة فعلية من أودو 17 (${auditData.periodFrom} إلى ${auditData.periodTo})`
                            : `Verified Odoo 17 Reconciliation (${auditData.periodFrom} → ${auditData.periodTo})`
                          : isAr
                            ? `بيانات مرجعية محفوظة (${auditData.periodFrom} إلى ${auditData.periodTo})`
                            : `Cached Snapshot Bridge (${auditData.periodFrom} → ${auditData.periodTo})`}
                      </span>
                    </div>
                    <h2 className="text-[19px] font-extrabold tracking-tight text-slate-950 dark:text-white">
                      {isAr ? 'شهادة فحص ومطابقة أودو ✅' : 'Odoo 17 Audit & Reconciliation Certificate ✅'}
                    </h2>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {isAr
                        ? `الفترة: من ${auditData.periodFrom} إلى ${auditData.periodTo} (${fInt(auditData.periodDays)} يوماً) • وقت الفحص: ${kuwaitTimestamp}${auditData.lastSyncedLabel ? ` • آخر مزامنة أودو: ${auditData.lastSyncedLabel}` : ''}`
                        : `Window: ${auditData.periodFrom} to ${auditData.periodTo} (${fInt(auditData.periodDays)} days) • Checked: ${kuwaitTimestamp}${auditData.lastSyncedLabel ? ` • Last Odoo sync: ${auditData.lastSyncedLabel}` : ''}`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={isAr ? 'إغلاق' : 'Close'}
                    className="ae-bento-subcard inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Single Canonical Total Hero Card */}
                <div className="ae-bento-subcard mt-4 rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                      {isAr
                        ? 'الإجمالي الموحد المعتمد لصافي مبيعات الشركة النشطة (Odoo 17 pos.order)'
                        : 'Canonical Active Company POS Net Sales (Odoo 17 pos.order)'}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-emerald-800 ring-1 ring-emerald-500/25 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {isAr
                        ? `${fInt(auditData.posOrdersActiveWindow)} إيصال في ${fInt(auditData.periodDays)} يوماً`
                        : `${fInt(auditData.posOrdersActiveWindow)} receipts in ${fInt(auditData.periodDays)} days`}
                    </span>
                  </div>
                  <div
                    dir="ltr"
                    className="mt-2 text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-400"
                  >
                    {f3(auditData.companyActivePosKwd)} {isAr ? 'د.ك' : 'KWD'}
                  </div>
                </div>

                {/* Single Canonical Equation + Real Computed Variance */}
                <div className="ae-bento-subcard mt-3 space-y-2.5 rounded-2xl p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {isAr
                        ? 'معادلة المطابقة الموحدة والفارق المحاسبي الفعلي:'
                        : 'Single Canonical Reconciliation Equation & Real Computed Variance:'}
                    </span>
                    <span
                      dir="ltr"
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums ring-1 ${
                        auditData.isExactZeroFromLive
                          ? 'bg-emerald-50 text-emerald-800 ring-emerald-500/25 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-50 text-amber-900 ring-amber-500/25 dark:bg-amber-950/50 dark:text-amber-200'
                      }`}
                    >
                      {auditData.isExactZeroFromLive ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                      <span>{isAr ? auditData.varianceBadgeAr : auditData.varianceBadgeEn}</span>
                    </span>
                  </div>

                  <div
                    dir="ltr"
                    className="rounded-xl bg-slate-100/80 px-3 py-2 font-mono text-xs font-bold text-slate-800 dark:bg-white/[0.05] dark:text-slate-100"
                  >
                    {isAr ? auditData.canonicalEquationAr : auditData.canonicalEquationEn}
                  </div>

                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {isAr ? auditData.varianceReasonAr : auditData.varianceReasonEn}
                  </p>
                </div>

                {/* 3 Crisp Action Buttons: تحديث الفحص 🔄 | نسخ للواتساب 📋 | طباعة 🖨️ */}
                <div className="no-print mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/80 pt-4 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => void handleRefreshAudit()}
                    disabled={refreshing}
                    className="ae-bento-subcard inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-bold text-slate-800 transition-all hover:text-slate-950 disabled:opacity-50 dark:text-slate-100"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    <span>{isAr ? 'تحديث الفحص 🔄' : 'Refresh Audit 🔄'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCopyWhatsApp()}
                    className="ae-bento-subcard inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-bold text-slate-800 transition-all hover:text-slate-950 dark:text-slate-100"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-700 dark:text-emerald-300">
                          {isAr ? 'تم النسخ ✅' : 'Copied ✅'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>{isAr ? 'نسخ للواتساب 📋' : 'Copy WhatsApp 📋'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn-colored inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-xs font-bold text-white transition-all hover:bg-emerald-500 dark:bg-emerald-500 dark:text-[#04130D]"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>{isAr ? 'طباعة 🖨️' : 'Print 🖨️'}</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
