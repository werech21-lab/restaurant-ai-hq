'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  CheckCircle2,
  Copy,
  FileCheck2,
  Lock,
  MessageCircle,
  Printer,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { APPROVED_BRANCH_IDS, getBranchLabel, type GlobalBranch } from '@/lib/aether/global-filter-engine'
import {
  buildCircularSerialRef,
  type OfficialCircularDocument,
  type PersistedGovernanceStore,
} from '@/lib/governance-compliance'

export interface OfficialCircularPrintModalProps {
  open: boolean
  doc: OfficialCircularDocument | null
  store: PersistedGovernanceStore
  onClose: () => void
  onSealNow?: (doc: OfficialCircularDocument) => void
  onToggleBranchReceipt?: (circularKey: string, branchId: Exclude<GlobalBranch, 'all'>) => void
  onConfirmAllBranches?: (circularKey: string) => void
}

export function OfficialCircularPrintModal({
  open,
  doc,
  store,
  onClose,
  onSealNow,
  onToggleBranchReceipt,
  onConfirmAllBranches,
}: OfficialCircularPrintModalProps) {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    document.body.classList.add('vf-circular-modal-open')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('vf-circular-modal-open')
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!mounted || !open || !doc) return null

  const issuedMeta = store.issuedCirculars[doc.circularKey]
  const activeSealId = issuedMeta?.sealId || doc.sealId
  const activeApproverRoleAr = issuedMeta?.approverRoleAr || doc.approverRoleAr
  const activeApproverRoleEn = issuedMeta?.approverRoleEn || doc.approverRoleEn
  const activeApprovedByAr = issuedMeta?.approvedByAr || doc.approvedByAr
  const activeApprovedByEn = issuedMeta?.approvedByEn || doc.approvedByEn
  const activeIssuedIso = issuedMeta?.issuedAtIso || doc.issuedAtIso || new Date().toISOString()
  const serialRef = issuedMeta?.serialRef || doc.serialRef || buildCircularSerialRef(doc.circularKey)
  const formattedDate = activeIssuedIso.slice(0, 10)
  const formattedTime = activeIssuedIso.slice(11, 16)

  const receiptMap = store.branchReceipts[doc.circularKey] ?? {}
  const receivedCount = APPROVED_BRANCH_IDS.filter((b) => receiptMap[b]).length

  const rulesList = isAr ? doc.mandatoryRulesAr : doc.mandatoryRulesEn
  const titleText = isAr ? doc.titleAr : doc.titleEn
  const scopeText = isAr ? doc.scopeAr : doc.scopeEn
  const classText = isAr ? doc.classificationAr : doc.classificationEn
  const finText = isAr ? doc.financialSummaryAr : doc.financialSummaryEn

  const plainShareText = isAr
    ? [
        `*تعميم إداري وتنفيذي رسمي — شركة فنتشر فودز (Venture Foods Co.)*`,
        `• الرقم المرجعي: ${serialRef} | التاريخ: ${formattedDate}`,
        `• الموضوع: ${doc.titleAr}`,
        `• النطاق: ${doc.scopeAr}`,
        doc.financialSummaryAr ? `• الضوابط المالية: ${doc.financialSummaryAr}` : null,
        `• القواعد الإلزامية في أودو ١٧:`,
        ...doc.mandatoryRulesAr.map((r, i) => `  ${i + 1}. ${r}`),
        activeSealId
          ? `• معتمد رسمياً (${activeApproverRoleAr ?? 'الإدارة التنفيذية'}) — الختم: ${activeSealId}`
          : `• الحالة: بانتظار ختم المدير التنفيذي`,
      ]
        .filter(Boolean)
        .join('\n')
    : [
        `*OFFICIAL EXECUTIVE CIRCULAR — Venture Foods Co.*`,
        `• Serial Ref: ${serialRef} | Issue Date: ${formattedDate}`,
        `• Subject: ${doc.titleEn}`,
        `• Scope: ${doc.scopeEn}`,
        doc.financialSummaryEn ? `• Financial Guardrails: ${doc.financialSummaryEn}` : null,
        `• Mandatory Odoo 17 Rules:`,
        ...doc.mandatoryRulesEn.map((r, i) => `  ${i + 1}. ${r}`),
        activeSealId
          ? `• Verified Executive Digital Seal (${activeApproverRoleEn ?? 'Executive Management'}): ${activeSealId}`
          : `• Status: Pending Executive PIN Seal`,
      ]
        .filter(Boolean)
        .join('\n')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainShareText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const handlePrint = () => {
    if (typeof window === 'undefined') return
    window.print()
  }

  return createPortal(
    <>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          body.vf-circular-modal-open > *:not(#vf-official-circular-print-root) {
            display: none !important;
          }
          #vf-official-circular-print-root {
            position: static !important;
            inset: auto !important;
            background: #ffffff !important;
            padding: 0 !important;
            overflow: visible !important;
            display: block !important;
          }
          #vf-official-circular-toolbar {
            display: none !important;
          }
          #vf-official-circular-sheet {
            box-shadow: none !important;
            max-height: none !important;
            max-width: 100% !important;
            width: 100% !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            padding: 4mm 2mm !important;
          }
        }
      `}</style>

      <div
        id="vf-official-circular-print-root"
        role="dialog"
        aria-modal="true"
        aria-label={isAr ? 'تعميم رسمي قابل للطباعة' : 'Printable Official Executive Circular'}
        dir={isAr ? 'rtl' : 'ltr'}
        onClick={onClose}
        className="fixed inset-0 z-[135] flex flex-col items-center overflow-y-auto bg-[#09110E]/60 p-3 backdrop-blur-xs sm:p-6"
      >
        {/* Top Floating Action Bar (Hidden in Print) */}
        <div
          id="vf-official-circular-toolbar"
          onClick={(e) => e.stopPropagation()}
          className="mb-3 flex w-full max-w-[850px] flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 shadow-[0_8px_28px_rgba(15,23,42,0.18)] dark:bg-[#101C17]"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
              <FileCheck2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-neutral-950 dark:text-white">
                {isAr
                  ? 'ورق رسمي A4 للتعميم والأرشفة (PDF / طباعة)'
                  : 'Official A4 Corporate Circular (Print / Save PDF)'}
              </p>
              <p dir="ltr" className="font-mono text-[11px] tabular-nums text-neutral-400">
                {serialRef} {activeSealId ? `· ${activeSealId}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {!activeSealId && onSealNow ? (
              <button
                type="button"
                onClick={() => onSealNow(doc)}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-amber-50 px-3.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>{isAr ? 'اعتماد وختم بالـ PIN الآن 🔐' : 'Seal with Manager PIN 🔐'}</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={handlePrint}
              className="btn-colored inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white transition-all duration-150 hover:bg-emerald-500 dark:bg-emerald-500 dark:text-[#04130D]"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{isAr ? 'طباعة / تصدير PDF 🖨️' : 'Print / Save PDF 🖨️'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full bg-[#F7F7F8] px-3 text-xs font-medium text-neutral-800 hover:bg-neutral-200/70 dark:bg-[#09110E] dark:text-slate-200"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{isAr ? 'تم النسخ ✓' : 'Copied ✓'}</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>{isAr ? 'نسخ النص 📋' : 'Copy 📋'}</span>
                </>
              )}
            </button>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(plainShareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1 rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{isAr ? 'واتساب 📲' : 'WhatsApp 📲'}</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              aria-label={isAr ? 'إغلاق' : 'Close'}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#F7F7F8] text-neutral-500 hover:bg-neutral-200/80 hover:text-neutral-900 dark:bg-[#0C141B] dark:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Crisp White A4 Corporate Letterhead Sheet */}
        <article
          id="vf-official-circular-sheet"
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[850px] rounded-2xl bg-white p-6 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.28)] sm:p-10"
        >
          {/* 1. Corporate Letterhead Header */}
          <header className="flex flex-col justify-between gap-4 border-b-2 border-emerald-700 pb-5 sm:flex-row sm:items-start">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-xs font-black text-white">
                  VF
                </span>
                <div>
                  <h1 className="text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">
                    شركة فنتشر فودز — Venture Foods Co.
                  </h1>
                  <p className="text-xs font-medium text-slate-500">
                    {isAr
                      ? 'الإدارة التنفيذية والرقابة المالية والتشغيلية · نظام أودو ١٧ الموحد (الكويت)'
                      : 'Executive Management & Financial Compliance · Odoo 17 Enterprise HQ (Kuwait)'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[#F7F7F8] px-4 py-2.5 text-xs tabular-nums sm:text-end">
              <div className="font-mono text-[13px] font-bold text-emerald-800">{serialRef}</div>
              <div className="mt-0.5 text-slate-600">
                {isAr ? 'تاريخ الإصدار: ' : 'Issue Date: '}
                <span dir="ltr" className="font-semibold text-slate-900">
                  {formattedDate} · {formattedTime} UTC
                </span>
              </div>
              <div className="mt-0.5 font-semibold text-slate-700">{classText}</div>
            </div>
          </header>

          {/* 2. Subject & Scope Metadata Box */}
          <section className="mt-5 rounded-xl bg-[#F7F7F8] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-[11px] font-bold text-emerald-900">
                {classText}
              </span>
              {doc.effectiveWindow ? (
                <span dir="ltr" className="text-xs font-semibold tabular-nums text-slate-600">
                  {doc.effectiveWindow}
                </span>
              ) : null}
            </div>

            <h2 className="mt-2 text-base font-extrabold leading-snug text-slate-950 sm:text-lg">
              {titleText}
            </h2>

            <div className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-200/80 pt-3 text-xs sm:grid-cols-2">
              <div>
                <span className="font-semibold text-slate-500">
                  {isAr ? 'النطاق المشمول بالتعميم: ' : 'Applicable Scope: '}
                </span>
                <span className="font-bold text-slate-900">{scopeText}</span>
              </div>
              {finText ? (
                <div>
                  <span className="font-semibold text-slate-500">
                    {isAr ? 'السقف والأثر المالي المعتمد: ' : 'Approved Financial Guardrail: '}
                  </span>
                  <span dir="ltr" className="font-bold tabular-nums text-emerald-800">
                    {finText}
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          {/* 3. Mandatory Odoo 17 Compliance Rules */}
          <section className="mt-5 space-y-2.5">
            <h3 className="text-sm font-extrabold text-slate-950">
              {isAr
                ? 'أولاً: الضوابط والقواعد التنفيذية الإلزامية (مراقبة آلياً في أودو ١٧)'
                : 'I. Mandatory Executive & Odoo 17 Compliance Directives'}
            </h3>
            <ol className="space-y-2">
              {rulesList.map((rule, idx) => (
                <li
                  key={`${doc.circularKey}-rule-${idx}`}
                  className="flex items-start gap-2.5 rounded-xl bg-[#F7F7F8] px-3.5 py-2.5 text-xs leading-relaxed text-slate-800"
                >
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[11px] font-bold tabular-nums text-white">
                    {idx + 1}
                  </span>
                  <span className="font-medium">{rule}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* 4. Digital Executive PIN Approval Seal */}
          <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-12">
            <div className="rounded-xl bg-emerald-50/75 p-4 ring-1 ring-emerald-600/25 sm:col-span-7">
              <div className="flex items-center gap-2 text-emerald-900">
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" />
                <span className="text-xs font-extrabold">
                  {activeSealId
                    ? isAr
                      ? 'معتمد رسمياً بختم الإدارة التنفيذية'
                      : 'Officially Approved with Executive Digital Seal'
                    : isAr
                      ? 'مسودة تعميم بانتظار ختم رمز المدير (PIN)'
                      : 'Draft Circular Pending Manager PIN Seal'}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate-700">
                <div>
                  <span className="text-slate-500">
                    {isAr ? 'رقم الختم الرقمي: ' : 'Digital Seal ID: '}
                  </span>
                  <span dir="ltr" className="font-mono font-bold text-emerald-900">
                    {activeSealId ?? (isAr ? 'غير مختوم بعد' : 'UNSEALED DRAFT')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">
                    {isAr ? 'جهة وصفة الاعتماد: ' : 'Issuing Authority & Role: '}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {isAr
                      ? (activeApprovedByAr ??
                        (activeApproverRoleAr
                          ? `${activeApproverRoleAr} — شركة فنتشر فودز (تحقق برمز PIN الموثق)`
                          : 'الإدارة التنفيذية — شركة فنتشر فودز (تحقق برمز PIN الموثق)'))
                      : (activeApprovedByEn ??
                        (activeApproverRoleEn
                          ? `${activeApproverRoleEn} — Venture Foods Co. (PIN Verified)`
                          : 'Executive Management — Venture Foods Co. (PIN Verified)'))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl bg-[#F7F7F8] p-4 text-xs sm:col-span-5">
              <div className="font-bold text-slate-700">
                {isAr ? 'توقيع وختم الإدارة العامة' : 'Executive Signature & Stamp'}
              </div>
              <div className="my-2 flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-emerald-800">{serialRef}</span>
                {activeSealId ? (
                  <span className="rounded-full bg-emerald-700 px-2.5 py-0.5 text-[10px] font-bold text-white">
                    VERIFIED SEAL ✓
                  </span>
                ) : null}
              </div>
              <div className="border-t border-dashed border-slate-300 pt-1.5 text-[11px] text-slate-500">
                {isAr
                  ? 'يسري العمل بهذا التعميم فور صدوره ويُراقب آلياً عبر جرس الامتثال'
                  : 'Effective immediately upon issuance; monitored live by Odoo Watchdog'}
              </div>
            </div>
          </section>

          {/* 5. 7 Active Branches Acknowledgment Table */}
          <section className="mt-6 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-slate-950">
                {isAr
                  ? `ثانياً: جدول إقرار واستلام الفروع السبعة المعتمدة (${receivedCount}/7 إقرار إلكتروني)`
                  : `II. 7 Active Branches Acknowledgment Register (${receivedCount}/7 Digital Receipts)`}
              </h3>

              {onConfirmAllBranches ? (
                <button
                  type="button"
                  onClick={() => onConfirmAllBranches(doc.circularKey)}
                  className="no-print cursor-pointer rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  {isAr ? 'تأكيد استلام الـ 7 فروع إلكترونياً ✓' : 'Confirm All 7 Digital Receipts ✓'}
                </button>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-[#F7F7F8] text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-start font-bold">#</th>
                    <th className="px-3 py-2 text-start font-bold">
                      {isAr ? 'الفرع / الموقع المعتمد' : 'Active Branch / Unit'}
                    </th>
                    <th className="px-3 py-2 text-center font-bold">
                      {isAr ? 'الإقرار الإلكتروني بالنظام' : 'System Receipt'}
                    </th>
                    <th className="px-3 py-2 text-start font-bold">
                      {isAr ? 'اسم مدير الفرع والتوقيع' : 'Branch Manager & Signature'}
                    </th>
                    <th className="px-3 py-2 text-start font-bold">
                      {isAr ? 'التاريخ' : 'Date'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80">
                  {APPROVED_BRANCH_IDS.map((branchId, i) => {
                    const confirmed = Boolean(receiptMap[branchId])
                    return (
                      <tr key={branchId} className="bg-white">
                        <td className="px-3 py-2 font-semibold tabular-nums text-slate-500">
                          {i + 1}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-900">
                          {getBranchLabel(branchId, isAr)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              onToggleBranchReceipt?.(
                                doc.circularKey,
                                branchId as Exclude<GlobalBranch, 'all'>,
                              )
                            }
                            className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              confirmed
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {confirmed ? <CheckCircle2 className="h-3 w-3 text-emerald-700" /> : null}
                            <span>
                              {confirmed
                                ? isAr
                                  ? 'تم الاستلام إلكترونياً ✓'
                                  : 'Received Digitally ✓'
                                : isAr
                                  ? 'بانتظار التأكيد'
                                  : 'Pending'}
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-2 text-slate-400">
                          .................................
                        </td>
                        <td dir="ltr" className="px-3 py-2 tabular-nums text-slate-500">
                          {confirmed ? formattedDate : '2026 / __ / __'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </article>
      </div>
    </>,
    document.body,
  )
}
