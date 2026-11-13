'use client'

import React, { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Paperclip,
  Plus,
  Printer,
  Send,
  Trash2,
  User,
  X,
  Building2,
  Tag,
  DollarSign,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
  BookOpen,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { OdooExpenseSheetReport, AdminApprovalStatus, ExpensePaymentStatus } from '@/lib/accounting/odoo-real-expenses-data'

export type ExpenseSheetStage = 'draft' | 'submitted' | 'approved' | 'posted' | 'paid'

interface ExpenseSheetLineItem {
  id: string
  date: string
  category: string
  descriptionAr: string
  descriptionEn: string
  branchAr: string
  branchEn: string
  amountKwd: number
}

export interface NewExpenseSheetPayload {
  reportNo: string
  titleAr: string
  titleEn: string
  custodianId: string
  custodianNameAr: string
  custodianNameEn: string
  managerAr: string
  managerEn: string
  journalAr: string
  journalEn: string
  date: string
  amountKwd: number
  adminApproval: AdminApprovalStatus
  paymentStatus: ExpensePaymentStatus
  items: ExpenseSheetLineItem[]
}

const CUSTODIANS_LIST = [
  { id: 'sanad', nameAr: 'سند — عهدة التعقيب الحكومي والعلاقات العامة', nameEn: 'Sanad — PRO Government Clearance' },
  { id: 'rabih', nameAr: 'ربيع أنيس يحيى (صيانة المطابخ والفروع)', nameEn: 'Rabih Anis Yahya (Kitchen & Branch Maint)' },
  { id: 'sheila', nameAr: 'شيلا أمبوس بولبولي (عهد العمليات والتشغيل)', nameEn: 'Sheila Ambos Bolboli (Operations)' },
  { id: 'amjad', nameAr: 'أمجد سمير جرجس ميخائيل (الرقابة والمشتريات)', nameEn: 'Amjad Samir Guirguis (Auditing & Purchasing)' },
  { id: 'shyam', nameAr: 'شيام (إدارة الموارد البشرية والشؤون الإدارية)', nameEn: 'Shyam (HR & Admin Affairs)' },
  { id: 'nader', nameAr: 'نادر نزهي (المطبخ المركزي والتصنيع)', nameEn: 'Nader Nazhi (Central Kitchen & MRP)' },
  { id: 'shukrallah', nameAr: 'شكر الله ناصيف (الصيانة والتجهيزات)', nameEn: 'Shukrallah Nassif (General Maintenance)' },
  { id: 'nousha', nameAr: 'نوشا أسانار (الرقابة الميدانية والتفتيش)', nameEn: 'Nousha Asanar (Field Inspection)' },
]

const MANAGERS_LIST = [
  { id: 'abdullah', nameAr: 'عبد الله عبد الغفار جمعة عويره (المدير العام والتشغيلي)', nameEn: 'Abdullah Abdulghaffar Owaira (General Manager)' },
  { id: 'abdulrahman', nameAr: 'عبد الرحمن محمد جمال الدين (المدير المالي والرقابي)', nameEn: 'Abdulrahman M. Jamaluddin (Financial Controller)' },
]

interface OdooExpenseSheetModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (payload: NewExpenseSheetPayload) => void
  existingSheet?: OdooExpenseSheetReport | null
}

export function OdooExpenseSheetModal({
  isOpen,
  onClose,
  onSave,
  existingSheet,
}: OdooExpenseSheetModalProps) {
  const { locale } = useI18n()
  const isAr = locale === 'ar'

  const [reportNo] = useState(
    existingSheet?.reportNo || `EXP/SHEET/2026/${Math.floor(100 + Math.random() * 900)}`
  )
  const [title, setTitle] = useState(
    existingSheet?.titleAr || (isAr ? 'كشف تصفية عهدة ومصروفات تشغيلية دورية' : 'Periodic Operational Expense Clearance Sheet')
  )
  const [custodianId, setCustodianId] = useState(existingSheet?.custodianId || 'sanad')
  const [managerId, setManagerId] = useState('abdullah')
  const [date, setDate] = useState(existingSheet?.date || '2026-11-04')
  const [stage, setStage] = useState<ExpenseSheetStage>(
    existingSheet
      ? existingSheet.paymentStatus === 'paid'
        ? 'paid'
        : existingSheet.adminApproval === 'approved'
        ? 'approved'
        : 'submitted'
      : 'draft'
  )

  const [lines, setLines] = useState<ExpenseSheetLineItem[]>([
    {
      id: 'line_1',
      date: '2026-11-04',
      category: isAr ? 'رسوم التراخيص والإعلانات' : 'Trade Licenses & Signage',
      descriptionAr: 'تجديد ترخيص تجاري لفرع السالمية — وزارة التجارة والصناعة',
      descriptionEn: 'Salmiya commercial license renewal — MOCI',
      branchAr: 'فرع السالمية',
      branchEn: 'Salmiya Branch',
      amountKwd: 45.000,
    },
    {
      id: 'line_2',
      date: '2026-11-03',
      category: isAr ? 'الضمان الصحي للإقامات' : 'MOH Health Insurance',
      descriptionAr: 'ضمان صحي عدد 3 عمال مطابخ — مركز الصباح الصحي',
      descriptionEn: 'Health insurance for 3 kitchen staff — Al-Sabah',
      branchAr: 'المطبخ المركزي',
      branchEn: 'Central Kitchen',
      amountKwd: 15.000,
    },
  ])

  // Chatter state
  const [activeChatterTab, setActiveChatterTab] = useState<'message' | 'note' | 'activity'>('note')
  const [chatterInput, setChatterInput] = useState('')
  const [chatterLogs, setChatterLogs] = useState<Array<{ id: string; author: string; time: string; text: string }>>([
    {
      id: 'log_1',
      author: isAr ? 'عبد الله عبد الغفار (المدير العام)' : 'Abdullah Abdulghaffar (GM)',
      time: isAr ? 'اليوم في 10:33 ص' : 'Today at 10:33 AM',
      text: isAr ? 'تم إنشاء كشف التصفية وحصر الفواتير المرفوعة للتدقيق.' : 'Expense sheet created and receipts aggregated for audit.',
    },
  ])

  if (!isOpen) return null

  const totalAmountKwd = lines.reduce((acc, l) => acc + (Number(l.amountKwd) || 0), 0)

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        id: `line_${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        category: isAr ? 'مصاريف تشغيلية متنوعة' : 'Miscellaneous OPEX',
        descriptionAr: 'شراء لوازم ومواد صيانة طارئة',
        descriptionEn: 'Emergency maintenance materials purchase',
        branchAr: 'فرع حولي',
        branchEn: 'Hawally Branch',
        amountKwd: 10.000,
      },
    ])
  }

  const handleRemoveLine = (id: string) => {
    if (lines.length === 1) return
    setLines(lines.filter((l) => l.id !== id))
  }

  const handleUpdateLine = (id: string, field: keyof ExpenseSheetLineItem, val: any) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, [field]: val } : l)))
  }

  const handleSendChatter = () => {
    if (!chatterInput.trim()) return
    setChatterLogs([
      {
        id: `c_${Date.now()}`,
        author: isAr ? 'الإدارة المالية — فنتشر فودز' : 'Venture Foods Finance',
        time: isAr ? 'الآن' : 'Just now',
        text: chatterInput.trim(),
      },
      ...chatterLogs,
    ])
    setChatterInput('')
  }

  const pipelineStages: { id: ExpenseSheetStage; labelAr: string; labelEn: string }[] = [
    { id: 'draft', labelAr: 'مسودة', labelEn: 'Draft' },
    { id: 'submitted', labelAr: 'مُرسل للمدير', labelEn: 'Submitted to Manager' },
    { id: 'approved', labelAr: 'معتمد إدارياً', labelEn: 'Approved' },
    { id: 'posted', labelAr: 'مُرحّل بالقيود', labelEn: 'Posted Journal Entries' },
    { id: 'paid', labelAr: 'تم السداد وإصدار الشيك', labelEn: 'Paid & Cheque Issued' },
  ]

  const currentStageIndex = pipelineStages.findIndex((s) => s.id === stage)

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const selectedCust = CUSTODIANS_LIST.find((c) => c.id === custodianId)
    const selectedMgr = MANAGERS_LIST.find((m) => m.id === managerId)

    const adminApproval: AdminApprovalStatus =
      stage === 'approved' || stage === 'posted' || stage === 'paid' ? 'approved' : 'submitted'

    const paymentStatus: ExpensePaymentStatus =
      stage === 'paid' ? 'paid' : stage === 'posted' ? 'in_settlement' : 'not_paid'

    onSave({
      reportNo,
      titleAr: title,
      titleEn: title,
      custodianId,
      custodianNameAr: selectedCust?.nameAr || 'سند',
      custodianNameEn: selectedCust?.nameEn || 'Sanad',
      managerAr: selectedMgr?.nameAr || 'عبد الله عبد الغفار',
      managerEn: selectedMgr?.nameEn || 'Abdullah Abdulghaffar',
      journalAr: 'يومية العهد والمصروفات النقدية (KWD)',
      journalEn: 'Petty Cash & Expenses Journal (KWD)',
      date,
      amountKwd: totalAmountKwd,
      adminApproval,
      paymentStatus,
      items: lines,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative flex flex-col my-auto w-full max-w-5xl rounded-3xl border border-white/15 bg-[#0f141c] text-white shadow-2xl overflow-hidden max-h-[95vh]">
        {/* Top Header Ribbon & Window Controls */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#0a0d14] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-black font-black text-sm shadow-md">
              📑
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">
                  {isAr ? `تقرير تصفية عهدة مجمع (${reportNo})` : `Expense Report Sheet (${reportNo})`}
                </span>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/30">
                  {isAr ? 'موديول hr.expense.sheet أودو' : 'Odoo hr.expense.sheet Module'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isAr
                  ? 'تجميع واعتماد المصروفات الدورية وإصدار شيكات الصرف'
                  : 'Aggregate periodic expenses, approve & issue settlement cheques'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            title={isAr ? 'إغلاق' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Ribbon & 5-Stage Approval Pipeline */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#121824] px-5 py-2.5">
          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setStage('submitted')
                setChatterLogs((prev) => [
                  {
                    id: `sub_${Date.now()}`,
                    author: isAr ? 'المستخدم الحالي' : 'Current User',
                    time: isAr ? 'الآن' : 'Just now',
                    text: isAr ? 'تم رفع التقرير المجمع للمدير العام للاعتماد النهائي.' : 'Expense sheet submitted to GM for final approval.',
                  },
                  ...prev,
                ])
              }}
              className="flex items-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-500/15 px-3 py-1.5 text-xs font-bold text-blue-300 hover:bg-blue-500/25"
            >
              <Send size={13} />
              <span>{isAr ? 'إرسال للمدير' : 'Submit to Manager'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStage('approved')
                setChatterLogs((prev) => [
                  {
                    id: `app_${Date.now()}`,
                    author: isAr ? 'عبد الله عبد الغفار (المدير العام)' : 'Abdullah Abdulghaffar (GM)',
                    time: isAr ? 'الآن' : 'Just now',
                    text: isAr ? 'تم الاعتماد الإداري لكشف التصفية بقيمة ' + totalAmountKwd.toFixed(3) + ' د.ك.' : 'Expense sheet administratively approved for ' + totalAmountKwd.toFixed(3) + ' KWD.',
                  },
                  ...prev,
                ])
              }}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 px-3.5 py-1.5 text-xs font-black text-white hover:brightness-110 shadow-sm"
            >
              <CheckCircle2 size={13} />
              <span>{isAr ? 'اعتماد إداري' : 'Approve'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStage('posted')
                setChatterLogs((prev) => [
                  {
                    id: `post_${Date.now()}`,
                    author: isAr ? 'عبد الرحمن جمال الدين (المالية)' : 'Abdulrahman Jamaluddin (Finance)',
                    time: isAr ? 'الآن' : 'Just now',
                    text: isAr ? 'تم ترحيل القيود المحاسبية وتوليد سند الصرف رقم JV-2026-944.' : 'Journal entries posted & voucher JV-2026-944 generated.',
                  },
                  ...prev,
                ])
              }}
              className="flex items-center gap-1.5 rounded-xl border border-purple-500/40 bg-purple-500/15 px-3 py-1.5 text-xs font-bold text-purple-300 hover:bg-purple-500/25"
            >
              <BookOpen size={13} />
              <span>{isAr ? 'ترحيل محاسبي بالقيود' : 'Post Journal Entries'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStage('paid')
                setChatterLogs((prev) => [
                  {
                    id: `pay_${Date.now()}`,
                    author: isAr ? 'الإدارة المالية — بنك الكويت الوطني' : 'NBK Corporate Banking',
                    time: isAr ? 'الآن' : 'Just now',
                    text: isAr ? 'تم سداد التقرير بالكامل وإصدار شيك بنك الكويت الوطني رقم CHQ-2026-4401.' : 'Fully paid via NBK corporate cheque CHQ-2026-4401.',
                  },
                  ...prev,
                ])
              }}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-black text-emerald-300 hover:bg-emerald-500/30"
            >
              <CreditCard size={13} />
              <span>{isAr ? 'إصدار شيك سداد' : 'Issue Cheque'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
              title={isAr ? 'طباعة كشف التصفية' : 'Print Sheet'}
            >
              <Printer size={13} />
              <span className="hidden sm:inline">{isAr ? 'طباعة الكشف' : 'Print'}</span>
            </button>
          </div>

          {/* 5-Stage Approval Pipeline */}
          <div className="flex items-center rounded-xl border border-white/10 bg-slate-900/90 p-0.5 text-xs font-bold">
            {pipelineStages.map((stg, idx) => {
              const isCurrent = stg.id === stage
              const isPassed = idx < currentStageIndex
              return (
                <button
                  key={stg.id}
                  type="button"
                  onClick={() => setStage(stg.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                    isCurrent
                      ? 'bg-gradient-to-l from-amber-400 to-amber-500 text-black font-black shadow-sm'
                      : isPassed
                      ? 'text-emerald-400 hover:bg-slate-800'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isPassed && <CheckCircle2 size={11} />}
                  <span>{isAr ? stg.labelAr : stg.labelEn}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Modal Main Content: Form + Lines Table + Chatter Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 overflow-y-auto">
          {/* Main Form & Lines Area (8 cols on lg) */}
          <form onSubmit={handleFormSubmit} className="lg:col-span-8 p-6 space-y-5 border-b lg:border-b-0 lg:border-e border-white/10">
            {/* Title & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'عنوان وموضوع كشف التصفية' : 'Expense Report Summary / Title'}
                  <span className="text-rose-400 ms-1">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'تاريخ التقرير' : 'Report Date'}
                  <span className="text-rose-400 ms-1">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Custodian & Manager */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'صاحب العهدة / الموظف (المستحق للتعويض)' : 'Custodian / Employee'}
                  <span className="text-rose-400 ms-1">*</span>
                </label>
                <select
                  value={custodianId}
                  onChange={(e) => setCustodianId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none font-semibold"
                >
                  {CUSTODIANS_LIST.map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {isAr ? cust.nameAr : cust.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'مدير الاعتماد المسؤول' : 'Approving Manager'}
                  <span className="text-rose-400 ms-1">*</span>
                </label>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none font-semibold"
                >
                  {MANAGERS_LIST.map((mgr) => (
                    <option key={mgr.id} value={mgr.id}>
                      {isAr ? mgr.nameAr : mgr.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Included Expense Lines Table */}
            <div className="rounded-2xl border border-white/10 bg-[#0a0d14] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-white">
                    {isAr ? 'جدول بنود المصروفات المشمولة في كشف التصفية:' : 'Expenses Included In This Sheet:'}
                  </span>
                  <p className="text-xs text-slate-400">
                    {isAr
                      ? `تم إدراج ${lines.length} حركات مدققة`
                      : `${lines.length} Audited Expense Lines`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-500"
                >
                  <Plus size={12} />
                  <span>{isAr ? 'إضافة سطر مصروف' : 'Add Expense Line'}</span>
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-xs">
                    <tr>
                      <th className="px-3 py-2">{isAr ? 'التاريخ' : 'Date'}</th>
                      <th className="px-3 py-2">{isAr ? 'فئة المصروف والبيان' : 'Category & Description'}</th>
                      <th className="px-3 py-2">{isAr ? 'الفرع / الموقع' : 'Branch / Location'}</th>
                      <th className="px-3 py-2">{isAr ? 'المبلغ (د.ك)' : 'Amount (KWD)'}</th>
                      <th className="px-2 py-2 text-center">✕</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-950/40 text-xs">
                    {lines.map((line) => (
                      <tr key={line.id} className="hover:bg-slate-900/40">
                        <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">
                          {line.date}
                        </td>
                        <td className="px-3 py-2 space-y-0.5">
                          <span className="block font-bold text-slate-200">
                            {line.category}
                          </span>
                          <span className="block text-xs text-slate-400 truncate max-w-xs">
                            {isAr ? line.descriptionAr : line.descriptionEn}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                          {isAr ? line.branchAr : line.branchEn}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-emerald-400 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.005"
                            value={line.amountKwd}
                            onChange={(e) =>
                              handleUpdateLine(line.id, 'amountKwd', parseFloat(e.target.value) || 0)
                            }
                            className="w-20 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-right font-mono text-xs font-bold text-emerald-400 focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(line.id)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary Footer */}
              <div className="flex items-center justify-between rounded-xl bg-slate-900/90 px-4 py-3 border border-slate-800">
                <span className="text-xs font-black text-slate-300">
                  {isAr ? 'إجمالي كشف التصفية النهائي المستحق للصرف:' : 'Total Settlement Amount Due:'}
                </span>
                <span className="font-mono text-lg font-black text-emerald-400">
                  {totalAmountKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                </span>
              </div>
            </div>

            {/* Bottom Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-l from-amber-400 to-amber-500 px-6 py-2.5 text-xs font-black text-black hover:brightness-110 shadow-lg shadow-amber-950/40"
              >
                <CheckCircle2 size={15} />
                <span>{isAr ? 'حفظ وتثبيت كشف التصفية' : 'Save & Post Sheet'}</span>
              </button>
            </div>
          </form>

          {/* Interactive Chatter Side (4 cols on lg) */}
          <div className="lg:col-span-4 bg-[#0a0d14] p-5 flex flex-col justify-between border-t lg:border-t-0 space-y-4">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-amber-400" />
                  <span className="text-xs font-black text-white">
                    {isAr ? 'سجل التدقيق والمحادثة' : 'Audit Trail & Chatter'}
                  </span>
                </div>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400 font-mono">
                  {chatterLogs.length}
                </span>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-slate-800 pt-2 pb-2">
                {[
                  { id: 'note' as const, labelAr: 'ملاحظة تدقيق', labelEn: 'Audit Note' },
                  { id: 'message' as const, labelAr: 'رسالة إدارية', labelEn: 'Message' },
                  { id: 'activity' as const, labelAr: 'نشاط', labelEn: 'Activity' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveChatterTab(tab.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                      activeChatterTab === tab.id
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isAr ? tab.labelAr : tab.labelEn}
                  </button>
                ))}
              </div>

              {/* Text Input */}
              <div className="mt-3 space-y-2">
                <textarea
                  rows={2}
                  value={chatterInput}
                  onChange={(e) => setChatterInput(e.target.value)}
                  placeholder={
                    isAr ? 'سجّل ملاحظة تدقيق أو توصية باعتماد الشيك...' : 'Log note or cheque clearance recommendation...'
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 p-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSendChatter}
                    className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1 text-xs font-bold text-amber-400 hover:bg-slate-700"
                  >
                    <Send size={11} />
                    <span>{isAr ? 'تسجيل الملاحظة' : 'Log Note'}</span>
                  </button>
                </div>
              </div>

              {/* Feed of Logs */}
              <div className="mt-4 space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {chatterLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">{log.author}</span>
                      <span className="text-slate-500">{log.time}</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">{log.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Cheque & Bank Settlement Notice */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-center gap-2.5">
              <span className="text-lg">🏦</span>
              <div className="text-xs leading-tight">
                <p className="font-bold text-amber-400">
                  {isAr ? 'بنك الكويت الوطني — حساب سداد العهد' : 'NBK Corporate Custody Account'}
                </p>
                <p className="text-slate-400">
                  {isAr
                    ? 'بعد الاعتماد يتم استخراج شيك سداد مصرفي وإقفال رصيد العهدة دفترياً.'
                    : 'Upon approval, settlement cheque is issued and custody ledger closed.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OdooExpenseSheetModal
