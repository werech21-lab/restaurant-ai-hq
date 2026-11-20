'use client'

import React, { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, ShieldAlert, X } from 'lucide-react'
import {
  confirmDocumentIntakeDraft,
  EXTRACTED_DRAFT_UNCONFIRMED_LABEL,
  ODOO_VERIFIED_ACTUAL_LABEL,
  recomputeDocumentIntakeDraft,
  USER_INPUT_CONFIRMED_LABEL,
  type ConfirmedPriceSheet,
  type DocumentIntakeDraft,
  type DocumentIntakeRow,
} from '@/lib/feryal/document-intake-types'

export function updateDraftRowItemName(
  draft: DocumentIntakeDraft,
  rowId: string,
  itemName: string,
): DocumentIntakeDraft {
  const rows: DocumentIntakeRow[] = draft.rows.map((row) =>
    row.rowId === rowId ? { ...row, itemName } : row,
  )
  return recomputeDocumentIntakeDraft({ ...draft, rows })
}

export function updateDraftRowCurrentPrice(
  draft: DocumentIntakeDraft,
  rowId: string,
  sheetCurrentPriceKwd: string,
): DocumentIntakeDraft {
  const rows: DocumentIntakeRow[] = draft.rows.map((row) =>
    row.rowId === rowId
      ? { ...row, sheetCurrentPriceKwd: sheetCurrentPriceKwd.trim() ? sheetCurrentPriceKwd : null }
      : row,
  )
  return recomputeDocumentIntakeDraft({ ...draft, rows })
}

export function updateDraftRowProposedPrice(
  draft: DocumentIntakeDraft,
  rowId: string,
  optionKey: string,
  proposedPriceKwd: string,
): DocumentIntakeDraft {
  const rows: DocumentIntakeRow[] = draft.rows.map((row) => {
    if (row.rowId !== rowId) return row
    const hasOption = row.proposedOptions.some((opt) => opt.optionKey === optionKey)
    const proposedOptions = hasOption
      ? row.proposedOptions.map((opt) =>
          opt.optionKey === optionKey ? { ...opt, proposedPriceKwd } : opt,
        )
      : [...row.proposedOptions, { optionKey, label: optionKey, proposedPriceKwd }]
    return { ...row, proposedOptions }
  })
  return recomputeDocumentIntakeDraft({ ...draft, rows })
}

export function toggleDraftRowExcluded(
  draft: DocumentIntakeDraft,
  rowId: string,
): DocumentIntakeDraft {
  const rows: DocumentIntakeRow[] = draft.rows.map((row) =>
    row.rowId === rowId ? { ...row, excluded: !row.excluded } : row,
  )
  return recomputeDocumentIntakeDraft({ ...draft, rows })
}

export interface FeryalDocumentReviewCardProps {
  draft: DocumentIntakeDraft
  isAr: boolean
  submitting?: boolean
  onDraftChange: (nextDraft: DocumentIntakeDraft) => void
  onConfirmAndRun: (confirmedSheet: ConfirmedPriceSheet, reviewedDraft: DocumentIntakeDraft) => void
  onCancel: () => void
}

export function FeryalDocumentReviewCard({
  draft,
  isAr,
  submitting = false,
  onDraftChange,
  onConfirmAndRun,
  onCancel,
}: FeryalDocumentReviewCardProps) {
  const optionColumns = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of draft.rows) {
      for (const opt of row.proposedOptions) {
        if (!map.has(opt.optionKey)) {
          map.set(opt.optionKey, opt.label || opt.optionKey)
        }
      }
    }
    if (map.size === 0) {
      map.set('proposed', isAr ? 'السعر المقترح' : 'Proposed')
    }
    return [...map.entries()].map(([optionKey, label]) => ({ optionKey, label }))
  }, [draft.rows, isAr])

  const activeRows = useMemo(
    () => draft.rows.filter((row) => !row.excluded && row.itemName.trim().length > 0),
    [draft.rows],
  )

  const hasInvalidActivePrice = useMemo(
    () =>
      activeRows.some((row) =>
        row.anomalies.some((flag) => flag.code === 'MISSING_OR_INVALID_PRICE'),
      ),
    [activeRows],
  )

  const canConfirm = activeRows.length > 0 && !hasInvalidActivePrice && !submitting

  return (
    <section
      data-feryal-review-gate="true"
      data-source-tag={draft.sourceTag}
      aria-label={
        isAr
          ? 'جدول مراجعة وتأكيد الأسعار المستخرجة قبل التحليل التنفيذي'
          : 'Review and confirm extracted prices before executive analysis'
      }
      className="mb-3 min-w-0 space-y-3 rounded-2xl border border-amber-300/80 bg-amber-50/40 p-3.5 shadow-xs dark:border-amber-500/30 dark:bg-[#121C18]"
    >
      {/* Gate Header */}
      <div className="flex flex-wrap items-start justify-between gap-2.5 border-b border-amber-200/70 pb-2.5 dark:border-white/10">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-950 ring-1 ring-amber-500/30 dark:bg-amber-950/70 dark:text-amber-200">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span dir="ltr">{EXTRACTED_DRAFT_UNCONFIRMED_LABEL}</span>
            </span>

            <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-200 dark:bg-[#090E0C] dark:text-slate-200 dark:ring-white/15">
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              <span className="min-w-0 max-w-[220px] sm:max-w-[320px] truncate" title={draft.fileName}>
                {draft.fileName}
              </span>
              <span dir="ltr" className="shrink-0 font-mono text-xs text-slate-500 dark:text-slate-400">
                ({draft.fileKind.toUpperCase()})
              </span>
            </span>

            <span
              dir="ltr"
              className="shrink-0 whitespace-nowrap rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-900 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-200"
            >
              {draft.period.from} → {draft.period.to}
            </span>
          </div>

          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {isAr
              ? 'راجع الأصناف والأسعار المستخرجة مقابل أسعار البيع الفعلية في Odoo، وعدّل أي خطأ مطبعي أو استبعد الصفوف غير المطلوبة قبل اعتماد المحاكاة التنفيذية.'
              : 'Review extracted items and prices against Odoo realized unit prices, fix any OCR/sheet typos inline or exclude rows, then confirm to run the 3-scenario executive simulation.'}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-lg bg-emerald-100/90 px-2.5 py-1 text-xs font-bold text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {isAr
                ? `مطابق مع Odoo: ${draft.summary.matchedRows}/${activeRows.length}`
                : `Odoo Matched: ${draft.summary.matchedRows}/${activeRows.length}`}
            </span>
          </span>

          {draft.summary.criticalCount > 0 ? (
            <span
              data-anomaly-summary="critical"
              className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800 ring-1 ring-rose-500/30 dark:bg-rose-950/80 dark:text-rose-200"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                {isAr
                  ? `تنبيهات حرجة: ${draft.summary.criticalCount}`
                  : `Critical Flags: ${draft.summary.criticalCount}`}
              </span>
            </span>
          ) : null}

          {draft.summary.warningCount > 0 ? (
            <span
              data-anomaly-summary="warning"
              className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-500/30 dark:bg-amber-950/80 dark:text-amber-200"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                {isAr
                  ? `تحذيرات للمراجعة: ${draft.summary.warningCount}`
                  : `Warnings: ${draft.summary.warningCount}`}
              </span>
            </span>
          ) : null}

          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            aria-label={isAr ? 'إلغاء مسودة الأسعار' : 'Dismiss price draft'}
            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-[#090E0C] dark:text-slate-300 dark:ring-white/15"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Review & Confirm Table */}
      <div className="max-h-72 overflow-x-auto overflow-y-auto rounded-xl bg-white ring-1 ring-slate-200/90 dark:bg-[#090E0C] dark:ring-white/10">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-[#141F1B] dark:text-slate-200">
              <th className="whitespace-nowrap px-2.5 py-2 text-start font-bold">
                {isAr ? 'تضمين' : 'Include'}
              </th>
              <th className="whitespace-nowrap px-2.5 py-2 text-start font-bold">
                {isAr ? 'الصنف المستخرج' : 'Extracted Item'}
              </th>
              <th className="whitespace-nowrap px-2.5 py-2 text-start font-bold">
                {isAr ? 'مرجع Odoo الفعلي' : 'Odoo Actual'}
              </th>
              <th className="whitespace-nowrap px-2.5 py-2 text-start font-bold">
                {isAr ? 'الحالي بالملف (د.ك)' : 'Sheet Current (KWD)'}
              </th>
              {optionColumns.map((col) => (
                <th key={col.optionKey} className="whitespace-nowrap px-2.5 py-2 text-start font-bold">
                  <span>{col.label}</span>{' '}
                  <span dir="ltr" className="text-slate-500 dark:text-slate-400">
                    (KWD)
                  </span>
                </th>
              ))}
              <th className="whitespace-nowrap px-2.5 py-2 text-start font-bold">
                {isAr ? 'فحص الشذوذ والأخطاء' : 'Anomaly & Typo Guard'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {draft.rows.map((row) => {
              const hasCritical = row.anomalies.some((a) => a.severity === 'critical')
              const hasWarning = row.anomalies.some((a) => a.severity === 'warning')
              const rowBg = row.excluded
                ? 'bg-slate-50/80 opacity-55 dark:bg-white/[0.02]'
                : hasCritical
                  ? 'bg-rose-50/40 dark:bg-rose-950/20'
                  : hasWarning
                    ? 'bg-amber-50/35 dark:bg-amber-950/15'
                    : ''

              return (
                <tr key={row.rowId} data-intake-row-id={row.rowId} className={rowBg}>
                  <td className="px-2.5 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={!row.excluded}
                      disabled={submitting}
                      onChange={() => onDraftChange(toggleDraftRowExcluded(draft, row.rowId))}
                      aria-label={
                        isAr
                          ? `تضمين الصنف ${row.itemName} في المحاكاة`
                          : `Include ${row.itemName} in simulation`
                      }
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </td>

                  <td className="min-w-[170px] px-2.5 py-2 align-top">
                    <input
                      type="text"
                      value={row.itemName}
                      disabled={submitting || row.excluded}
                      onChange={(e) =>
                        onDraftChange(updateDraftRowItemName(draft, row.rowId, e.target.value))
                      }
                      aria-label={
                        isAr ? `اسم الصنف للصف ${row.rowId}` : `Item name for row ${row.rowId}`
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-900 focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:bg-slate-100 dark:border-white/15 dark:bg-[#101815] dark:text-white"
                    />
                    {row.brand ? (
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {row.brand}
                      </div>
                    ) : null}
                  </td>

                  <td className="min-w-[165px] px-2.5 py-2 align-top">
                    {row.matchedOdooProductId != null && row.odooRealizedUnitPriceKwd ? (
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {row.matchedOdooProductName ?? row.itemName}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            dir="ltr"
                            className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-xs font-bold tabular-nums text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                          >
                            {row.odooRealizedUnitPriceKwd} KWD
                          </span>
                          <span
                            dir="ltr"
                            className="text-xs text-emerald-700 dark:text-emerald-300"
                          >
                            ({ODOO_VERIFIED_ACTUAL_LABEL})
                          </span>
                        </div>
                        {row.odooQty ? (
                          <div dir="ltr" className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                            Qty: {row.odooQty}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-amber-100/80 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                        {isAr ? 'غير مطابق في Odoo' : 'Unmatched in Odoo'}
                      </span>
                    )}
                  </td>

                  <td className="min-w-[115px] px-2.5 py-2 align-top">
                    <input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      value={row.sheetCurrentPriceKwd ?? ''}
                      placeholder="—"
                      disabled={submitting || row.excluded}
                      onChange={(e) =>
                        onDraftChange(
                          updateDraftRowCurrentPrice(draft, row.rowId, e.target.value),
                        )
                      }
                      aria-label={
                        isAr
                          ? `السعر الحالي بالملف للصنف ${row.itemName}`
                          : `Sheet current price for ${row.itemName}`
                      }
                      className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-xs tabular-nums text-slate-900 focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:bg-slate-100 dark:border-white/15 dark:bg-[#101815] dark:text-white"
                    />
                  </td>

                  {optionColumns.map((col) => {
                    const optionEntry = row.proposedOptions.find(
                      (opt) => opt.optionKey === col.optionKey,
                    )
                    const optFlags = row.anomalies.filter(
                      (flag) => flag.optionKey === col.optionKey,
                    )
                    const optCritical = optFlags.some((flag) => flag.severity === 'critical')
                    const optWarning = optFlags.some((flag) => flag.severity === 'warning')
                    const borderCls = optCritical
                      ? 'border-rose-500 ring-1 ring-rose-500/30 bg-rose-50/40 dark:bg-rose-950/30'
                      : optWarning
                        ? 'border-amber-500 ring-1 ring-amber-500/30 bg-amber-50/40 dark:bg-amber-950/30'
                        : 'border-slate-200 bg-white dark:border-white/15 dark:bg-[#101815]'

                    return (
                      <td key={col.optionKey} className="min-w-[115px] px-2.5 py-2 align-top">
                        <input
                          type="text"
                          inputMode="decimal"
                          dir="ltr"
                          value={optionEntry?.proposedPriceKwd ?? ''}
                          disabled={submitting || row.excluded}
                          onChange={(e) =>
                            onDraftChange(
                              updateDraftRowProposedPrice(
                                draft,
                                row.rowId,
                                col.optionKey,
                                e.target.value,
                              ),
                            )
                          }
                          aria-label={
                            isAr
                              ? `السعر المقترح (${col.label}) للصنف ${row.itemName}`
                              : `Proposed price (${col.label}) for ${row.itemName}`
                          }
                          className={`w-24 rounded-lg border px-2 py-1 font-mono text-xs font-semibold tabular-nums text-slate-900 focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:bg-slate-100 dark:text-white ${borderCls}`}
                        />
                      </td>
                    )
                  })}

                  <td className="min-w-[220px] px-2.5 py-2 align-top">
                    {row.excluded ? (
                      <span className="inline-flex rounded-md bg-slate-200/80 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                        {isAr ? 'مستبعد من التحليل' : 'Excluded'}
                      </span>
                    ) : row.anomalies.length === 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100/90 px-2 py-0.5 text-xs font-bold text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>{isAr ? 'مطابق وجاهز' : 'Verified Ready'}</span>
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {row.anomalies.map((flag, idx) => (
                          <span
                            key={`${row.rowId}-${flag.code}-${flag.optionKey ?? idx}`}
                            data-anomaly-badge={flag.severity}
                            data-anomaly-code={flag.code}
                            className={`inline-flex items-start gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${
                              flag.severity === 'critical'
                                ? 'bg-rose-100 text-rose-900 ring-1 ring-rose-500/30 dark:bg-rose-950/80 dark:text-rose-200'
                                : 'bg-amber-100 text-amber-950 ring-1 ring-amber-500/30 dark:bg-amber-950/80 dark:text-amber-200'
                            }`}
                          >
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span>{isAr ? flag.messageAr : flag.messageEn}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Confirmation Gate Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {hasInvalidActivePrice ? (
            <span className="font-bold text-rose-700 dark:text-rose-300">
              {isAr
                ? 'يرجى تصحيح الأسعار الفارغة أو غير الصالحة أو استبعاد الصفوف المعنية قبل التأكيد.'
                : 'Fix missing/invalid prices or exclude those rows before confirming.'}
            </span>
          ) : draft.summary.criticalCount > 0 ? (
            <span className="font-semibold text-rose-800 dark:text-rose-200">
              {isAr
                ? `تنبيه: يوجد ${draft.summary.criticalCount} فرق سعري حرج باللون الأحمر — تأكد من صحته أو عدّله مباشرة قبل الاعتماد.`
                : `Notice: ${draft.summary.criticalCount} critical price anomaly highlighted in red — edit typos inline or confirm if intentional.`}
            </span>
          ) : (
            <span>
              {isAr
                ? `عند الضغط على الزر أدناه تتحول الصفوف المفعّلة (${activeRows.length}) إلى «${USER_INPUT_CONFIRMED_LABEL}» لتشغيل المحاكاة.`
                : `Confirming converts ${activeRows.length} active row(s) to "${USER_INPUT_CONFIRMED_LABEL}" and runs the executive simulation.`}
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="shrink-0 whitespace-nowrap cursor-pointer rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-[#090E0C] dark:text-slate-200 dark:ring-white/15"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="button"
            data-feryal-confirm-intake="true"
            disabled={!canConfirm}
            onClick={() => {
              const confirmed = confirmDocumentIntakeDraft(draft)
              onConfirmAndRun(confirmed, draft)
            }}
            className="inline-flex shrink-0 whitespace-nowrap cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>
              {isAr ? 'تأكيد وتشغيل التحليل التنفيذي' : 'Confirm & Run Executive Analysis'}
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}
