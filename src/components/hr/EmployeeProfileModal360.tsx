'use client'

import { useState } from 'react'
import type { VentureEmployee } from './venture-employees-directory'

type Props = {
  employee: VentureEmployee | null
  isOpen: boolean
  onClose: () => void
  locale: 'ar' | 'en'
}

type ModalTabKey = 'work' | 'pam' | 'docs' | 'private' | 'payroll' | 'activity'

export function EmployeeProfileModal360({ employee, isOpen, onClose, locale }: Props) {
  const [activeTab, setActiveTab] = useState<ModalTabKey>('work')
  const [copiedIban, setCopiedIban] = useState(false)
  const [printAlert, setPrintAlert] = useState<string | null>(null)
  const [notes, setNotes] = useState<Array<{ date: string; actionAr: string; actionEn: string; user: string }>>([])
  const [newNoteInput, setNewNoteInput] = useState('')

  if (!isOpen || !employee) return null

  const en = locale === 'en'
  const isArabic = !en

  const copyIban = () => {
    navigator.clipboard?.writeText(employee.iban)
    setCopiedIban(true)
    setTimeout(() => setCopiedIban(false), 2500)
  }

  const handlePrintBadge = () => {
    setPrintAlert(
      en
        ? `🖨️ Generating high-res NFC Badge for ${employee.nameEn} (Barcode: ${employee.code})…`
        : `🖨️ جاري تجهيز وطباعة بطاقة العمل الذكية (NFC) للموظف ${employee.nameAr} (رقم البصمة: ${employee.code})…`
    )
    setTimeout(() => setPrintAlert(null), 4000)
  }

  const handleSalaryCert = () => {
    setPrintAlert(
      en
        ? `📜 Generating official "To Whom It May Concern" salary certificate for ${employee.nameEn} (${employee.netSalary.toFixed(3)} KWD)…`
        : `📜 جاري إصدار شهادة راتب رسمية (لمن يهمه الأمر) للموظف ${employee.nameAr} بقيمة ${employee.netSalary.toFixed(3)} د.ك…`
    )
    setTimeout(() => setPrintAlert(null), 4000)
  }

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNoteInput.trim()) return
    const nowStr = new Date().toISOString().slice(0, 10)
    const newEntry = {
      date: nowStr,
      actionAr: newNoteInput.trim(),
      actionEn: newNoteInput.trim(),
      user: en ? 'HR Admin Specialist' : 'مسؤول الموارد البشرية والرواتب',
    }
    setNotes((prev) => [newEntry, ...prev])
    setNewNoteInput('')
  }

  const allAuditLogs = [...notes, ...employee.auditLog]
  const eosbEstimated = ((employee.basicSalary + employee.allowances) / 26 * 15 * 1.5).toFixed(3)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative flex max-h-[94vh] w-full max-w-6xl flex-col rounded-3xl border border-white/15 bg-[#0b0f17] text-white shadow-2xl"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Top Notification Toast */}
        {printAlert ? (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-amber-400/40 bg-amber-950/90 px-5 py-2.5 text-xs font-bold text-amber-200 shadow-xl backdrop-blur-md">
            {printAlert}
          </div>
        ) : null}

        {/* 1. TOP HEADER BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-lg border border-amber-500/20">
              🪪
            </span>
            <div>
              <p className="text-[11px] font-medium text-mist-400">
                {en ? 'Employees Directory / 360° Profile Dossier' : 'سجل الموظفين / الملف الشامل للموظف'}
              </p>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>{isArabic ? employee.nameAr : employee.nameEn}</span>
                <span className="rounded-lg bg-white/10 px-2 py-0.5 text-xs font-mono font-bold text-amber-300">
                  #{employee.code}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrintBadge}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10 transition-colors"
            >
              <span>🖨️</span>
              <span>{en ? 'Print Badge' : 'طباعة البطاقة'}</span>
            </button>
            <button
              type="button"
              onClick={handleSalaryCert}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10 transition-colors"
            >
              <span>📜</span>
              <span>{en ? 'Salary Certificate' : 'شهادة راتب'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sm font-bold text-mist-300 hover:bg-white/15 hover:text-white transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* SCROLLABLE CONTENT BODY */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* 2. TOP SMART STAT BUTTONS (Exact 7 Walnut/Odoo Buttons) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {/* 1. Documents */}
            <button
              type="button"
              onClick={() => setActiveTab('docs')}
              className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 text-center transition-all ${
                activeTab === 'docs'
                  ? 'border-amber-400 bg-amber-500/15 text-amber-200 shadow-lg'
                  : 'border-white/10 bg-[#121824] text-mist-300 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-1 text-sm">
                <span>📄</span>
                <span className="font-black text-white text-base">{employee.documents.length}</span>
              </div>
              <span className="mt-1 text-[11px] font-bold">{en ? 'Documents' : 'المستندات'}</span>
              <span className="text-[9px] text-mist-400">{en ? '6 Official Files' : '6 ملفات معتمدة'}</span>
            </button>

            {/* 2. Leave Balance */}
            <button
              type="button"
              onClick={() => setActiveTab('payroll')}
              className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 text-center transition-all ${
                activeTab === 'payroll'
                  ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200 shadow-lg'
                  : 'border-white/10 bg-[#121824] text-mist-300 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-1 text-sm">
                <span>🏖️</span>
                <span className="font-black text-emerald-300 text-base">{employee.leaves.balance} d</span>
              </div>
              <span className="mt-1 text-[11px] font-bold">{en ? 'Leave Balance' : 'رصيد الإجازات'}</span>
              <span className="text-[9px] text-mist-400">{en ? `Time Off: ${employee.leaves.taken} d` : `مستخدم: ${employee.leaves.taken} يوم`}</span>
            </button>

            {/* 3. Loans */}
            <button
              type="button"
              onClick={() => setActiveTab('payroll')}
              className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#121824] p-2.5 text-center hover:border-white/20 transition-all text-mist-300"
            >
              <div className="flex items-center gap-1 text-sm">
                <span>💳</span>
                <span className="font-black text-white text-base">{employee.loans.toFixed(3)}</span>
              </div>
              <span className="mt-1 text-[11px] font-bold">{en ? 'Loans' : 'السلف والقروض'}</span>
              <span className="text-[9px] text-mist-400">{en ? '0.000 KWD' : 'لا توجد سلف قائمة'}</span>
            </button>

            {/* 4. Shifts / Planning */}
            <button
              type="button"
              onClick={() => setActiveTab('work')}
              className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#121824] p-2.5 text-center hover:border-white/20 transition-all text-mist-300"
            >
              <div className="flex items-center gap-1 text-sm">
                <span>⏱️</span>
                <span className="font-black text-sky-300 text-base">48h</span>
              </div>
              <span className="mt-1 text-[11px] font-bold">{en ? 'Planning / Shifts' : 'الشفتات والتخطيط'}</span>
              <span className="text-[9px] text-mist-400">{en ? 'Asia/Kuwait' : 'شفتات الكويت القياسية'}</span>
            </button>

            {/* 5. Custody */}
            <button
              type="button"
              onClick={() => setActiveTab('payroll')}
              className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#121824] p-2.5 text-center hover:border-white/20 transition-all text-mist-300"
            >
              <div className="flex items-center gap-1 text-sm">
                <span>📦</span>
                <span className="font-black text-amber-300 text-base">{employee.custodyCount}</span>
              </div>
              <span className="mt-1 text-[11px] font-bold">{en ? 'Custody' : 'العهد المستلمة'}</span>
              <span className="text-[9px] text-mist-400">{en ? 'Active Equipment' : 'عهدة معدات مسجلة'}</span>
            </button>

            {/* 6. In Contract Since */}
            <button
              type="button"
              onClick={() => setActiveTab('pam')}
              className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#121824] p-2.5 text-center hover:border-white/20 transition-all text-mist-300"
            >
              <div className="flex items-center gap-1 text-sm">
                <span>📑</span>
                <span className="font-bold text-white text-xs">{employee.hireDate}</span>
              </div>
              <span className="mt-1 text-[11px] font-bold">{en ? 'Contract Start' : 'تاريخ مباشرة العمل'}</span>
              <span className="text-[9px] text-mist-400">{en ? 'Fixed Term (3Y)' : 'عقد محدد 3 سنوات'}</span>
            </button>

            {/* 7. EOSB Accrued */}
            <button
              type="button"
              onClick={() => setActiveTab('pam')}
              className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#121824] p-2.5 text-center hover:border-white/20 transition-all text-mist-300"
            >
              <div className="flex items-center gap-1 text-sm">
                <span>⚖️</span>
                <span className="font-black text-gold-300 text-xs">{eosbEstimated}</span>
              </div>
              <span className="mt-1 text-[11px] font-bold">{en ? 'EOSB Accrued' : 'نهاية الخدمة'}</span>
              <span className="text-[9px] text-mist-400">{en ? 'Kuwait Law Art. 51' : 'المادة 51 قانون العمل'}</span>
            </button>
          </div>

          {/* 3. HEADER IDENTITY BLOCK */}
          <div className="rounded-3xl border border-white/10 bg-[#121824] p-5 shadow-inner">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
              {/* Avatar Photo */}
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 via-sky-500/20 to-emerald-500/20 border-2 border-white/20 text-3xl font-black text-white shadow-xl">
                  {employee.nameEn
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <span
                  className={`absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#121824] text-xs ${
                    employee.status === 'ACTIVE'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-500 text-white'
                  }`}
                  title={employee.status === 'ACTIVE' ? 'على رأس العمل' : 'في إجازة سفر'}
                >
                  {employee.status === 'ACTIVE' ? '✓' : '✈'}
                </span>
              </div>

              {/* Identity Info */}
              <div className="flex-1 space-y-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                      {isArabic ? employee.nameAr : employee.nameEn}
                    </h1>
                    <span className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-1 font-mono text-sm font-black text-amber-300">
                      ID: {employee.code}
                    </span>
                    <span className="text-xl" title={employee.nationalityAr}>
                      {employee.flag}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        employee.status === 'ACTIVE'
                          ? 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                          : 'border border-amber-400/40 bg-amber-500/10 text-amber-300'
                      }`}
                    >
                      {employee.status === 'ACTIVE'
                        ? en
                          ? 'Active on Duty'
                          : '🟢 على رأس العمل'
                        : en
                          ? 'On Vacation Abroad'
                          : '🟠 في إجازة سفر خارج البلاد'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-mist-400 mt-0.5" dir="ltr">
                    {employee.nameEn}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                    💼 {isArabic ? employee.jobTitleAr : employee.jobTitleEn}
                  </span>
                  <span className="text-mist-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                    🏢 {isArabic ? employee.departmentAr : employee.department}
                  </span>
                  <span className="text-mist-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                    📍 {isArabic ? employee.workLocationAr : employee.workLocation}
                  </span>
                  <span className="font-mono text-emerald-300 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20" dir="ltr">
                    💰 {employee.netSalary.toFixed(3)} KWD / Month
                  </span>
                </div>
              </div>
            </div>

            {/* Quick 2-Column Key Facts Grid */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-white/10 pt-4 text-xs">
              <div className="space-y-1">
                <span className="text-mist-400 block text-[11px]">{en ? 'Mobile Phone' : 'رقم الجوال الشخصي'}</span>
                <a
                  href={`tel:${employee.mobile}`}
                  className="font-mono font-bold text-white hover:text-amber-300 flex items-center gap-1.5"
                  dir="ltr"
                >
                  <span>📱</span>
                  <span>{employee.mobile}</span>
                </a>
              </div>

              <div className="space-y-1">
                <span className="text-mist-400 block text-[11px]">{en ? 'Work Phone / Desk' : 'هاتف العمل والمكتب'}</span>
                <span className="font-mono font-bold text-white flex items-center gap-1.5" dir="ltr">
                  <span>☎️</span>
                  <span>{employee.phone}</span>
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-mist-400 block text-[11px]">{en ? 'Company Email' : 'البريد الإلكتروني للعمل'}</span>
                <a
                  href={`mailto:${employee.email}`}
                  className="font-mono text-mist-200 hover:text-white truncate block text-[11px]"
                  dir="ltr"
                >
                  {employee.email}
                </a>
              </div>

              <div className="space-y-1">
                <span className="text-mist-400 block text-[11px]">{en ? 'Direct Manager' : 'المدير المباشر'}</span>
                <span className="font-bold text-amber-200 flex items-center gap-1.5">
                  <span>👤</span>
                  <span>{isArabic ? employee.managerNameAr : employee.managerNameEn}</span>
                </span>
              </div>
            </div>
          </div>

          {/* 4. THE 6 TABS NAVIGATION */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
            {[
              { key: 'work' as ModalTabKey, icon: '🏢', ar: '1. بيانات العمل والهيكل', en: '1. Work Info & Org Chart' },
              { key: 'pam' as ModalTabKey, icon: '🆔', ar: '2. الشؤون والمدنية والبنك', en: '2. PAM, Civil ID & Bank' },
              { key: 'docs' as ModalTabKey, icon: '📁', ar: '3. خزينة المستندات الـ 6', en: '3. Documents Vault (6)' },
              { key: 'private' as ModalTabKey, icon: '👤', ar: '4. البيانات الشخصية', en: '4. Private Information' },
              { key: 'payroll' as ModalTabKey, icon: '💰', ar: '5. الرواتب والإجازات والعهد', en: '5. Payroll & Leaves' },
              { key: 'activity' as ModalTabKey, icon: '📜', ar: '6. سجل الأنشطة والتدقيق', en: '6. Activity & Chatter' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                  activeTab === t.key
                    ? 'border border-amber-400/40 bg-amber-500/20 text-amber-200 shadow-md'
                    : 'border border-transparent bg-white/5 text-mist-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{t.icon}</span>
                <span>{isArabic ? t.ar : t.en}</span>
              </button>
            ))}
          </div>

          {/* 5. TAB 1: WORK INFORMATION & VISUAL ORG CHART */}
          {activeTab === 'work' ? (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Work Details Card */}
                <div className="rounded-2xl border border-white/10 bg-[#121824] p-4 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gold-300">
                    {en ? 'Work Location & Schedule' : 'مقر وساعات العمل والورديات'}
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Work Location:' : 'موقع العمل الفعلي:'}</span>
                      <span className="font-bold text-white">{isArabic ? employee.workLocationAr : employee.workLocation}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Official Working Hours:' : 'ساعات العمل الرسمية:'}</span>
                      <span className="font-bold text-white">{employee.workingHours}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Timezone & Schedule:' : 'المنطقة الزمنية والجدول:'}</span>
                      <span className="font-mono text-mist-200">Asia/Kuwait (48 Hours/Week)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mist-400">{en ? 'Department:' : 'القسم والقطاع:'}</span>
                      <span className="font-bold text-amber-300">{isArabic ? employee.departmentAr : employee.department}</span>
                    </div>
                  </div>
                </div>

                {/* Approvers Card */}
                <div className="rounded-2xl border border-white/10 bg-[#121824] p-4 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gold-300">
                    {en ? 'Authorized Approvers' : 'المعتمدون والصلاحيات الإدارية'}
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Direct Manager / Lead:' : 'المدير المباشر والمشرف:'}</span>
                      <span className="font-bold text-amber-200">{isArabic ? employee.managerNameAr : employee.managerNameEn}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Expense & Petty Cash Approver:' : 'معتمد المصروفات والنثريات:'}</span>
                      <span className="font-bold text-white">أحمد عصام الإبراهيم (CEO)</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Leaves & Vacation Approver:' : 'معتمد الإجازات وتذاكر السفر:'}</span>
                      <span className="font-bold text-white">شيم حكمت الجاسم (HR Manager)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mist-400">{en ? 'WPS Payroll Authorization:' : 'اعتماد تحويل الرواتب WPS:'}</span>
                      <span className="font-bold text-emerald-300">هاني فيليب خليل (CFO)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual Org Chart Tree */}
              <div className="rounded-2xl border border-white/10 bg-[#121824] p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-gold-300 mb-4">
                  {en ? 'Hierarchical Organizational Structure' : 'الهيكل التنظيمي الإداري المرئي'}
                </h3>
                <div className="flex flex-col items-center space-y-3">
                  {/* Top Node: CEO */}
                  <div className="rounded-2xl border border-gold-400/40 bg-gold-500/10 px-6 py-2.5 text-center shadow-lg">
                    <p className="text-[11px] font-bold text-gold-300">{en ? 'Executive Leadership' : 'الرئيس التنفيذي العام'}</p>
                    <p className="text-sm font-black text-white">أحمد عصام محمد الإبراهيم (CEO)</p>
                  </div>
                  <div className="h-5 w-0.5 bg-white/20"></div>

                  {/* Middle Node: Current Employee */}
                  <div className="rounded-2xl border-2 border-amber-400 bg-amber-500/20 px-6 py-3 text-center shadow-xl">
                    <p className="text-[11px] font-bold text-amber-300">
                      {isArabic ? employee.jobTitleAr : employee.jobTitleEn}
                    </p>
                    <p className="text-base font-black text-white">
                      {isArabic ? employee.nameAr : employee.nameEn}
                    </p>
                    <p className="text-[10px] text-mist-300 mt-0.5">#{employee.code} · {isArabic ? employee.departmentAr : employee.department}</p>
                  </div>
                  <div className="h-5 w-0.5 bg-white/20"></div>

                  {/* Bottom Node: Subordinates / Operations Team */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-2 text-center text-xs text-mist-300">
                    <p className="font-bold text-white">
                      {en ? 'Operations & Branch Execution Team' : 'فريق التشغيل والدعم الميداني بالفروع'}
                    </p>
                    <p className="text-[10px] text-mist-400">
                      {en ? 'Reporting & Cross-Functional Coordination' : 'تنسيق تشغيلي وإداري مباشر'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* 6. TAB 2: PAM SETTINGS, CIVIL ID, RESIDENCY & BANK (WPS) */}
          {activeTab === 'pam' ? (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* PAM (Shuoon) Authority Box */}
                <div className="rounded-2xl border border-white/10 bg-[#121824] p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-gold-300">
                      {en ? 'Public Authority for Manpower (PAM / Asahal)' : 'الهيئة العامة للقوى العاملة (أسهل)'}
                    </h3>
                    <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/20">
                      {en ? 'Active & Valid' : 'ملف ساري ومطابق'}
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'PAM Sponsor Company:' : 'الشركة الكفيلة المسجلة:'}</span>
                      <span className="font-bold text-white text-right">{employee.pamSponsor}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Approved Quadruple Name:' : 'الاسم الرباعي المسجل بالشؤون:'}</span>
                      <span className="font-bold text-white">{employee.nameAr}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'PAM License Designation:' : 'المسمى المهني المعتمد بالترخيص:'}</span>
                      <span className="font-bold text-amber-300">{employee.pamDesignationAr}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'PAM Registered Salary:' : 'الراتب المعتمد بإذن العمل:'}</span>
                      <span className="font-mono font-bold text-emerald-300">{employee.pamSalary.toFixed(3)} KWD</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mist-400">{en ? 'Work Permit Expiry:' : 'تاريخ انتهاء إذن العمل:'}</span>
                      <span className="font-mono font-bold text-amber-200">
                        {employee.workPermitExpiry} (متبقي 188 يوماً)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Civil ID & Municipality Health Card Box */}
                <div className="rounded-2xl border border-white/10 bg-[#121824] p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-gold-300">
                      {en ? 'Civil ID & Municipality Health Card' : 'البطاقة المدنية PACI وكرت البلدية'}
                    </h3>
                    <span className="rounded-lg bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-300 border border-sky-500/20">
                      {en ? 'PACI Verified' : 'مطابق للرقم الموحد'}
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Civil ID Number:' : 'الرقم المدني الكويتي:'}</span>
                      <span className="font-mono font-black text-white" dir="ltr">{employee.civilId}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Civil ID Expiry Date:' : 'تاريخ صلاحية البطاقة المدنية:'}</span>
                      <span className="font-mono font-bold text-white">{employee.civilIdExpiry}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Passport Number:' : 'رقم جواز السفر الحالي:'}</span>
                      <span className="font-mono text-mist-200" dir="ltr">{employee.passportNo}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Passport Expiry:' : 'صلاحية جواز السفر:'}</span>
                      <span className="font-mono text-mist-200">{employee.passportExpiry}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mist-400">{en ? 'Municipality Health Card:' : 'كرت البلدية الصحي للأغذية:'}</span>
                      <span className="font-mono font-bold text-teal-300">MUNI-2025-99881 (ساري حتى 10/05/2026)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* WPS Bank Transfer & IBAN Block */}
              <div className="rounded-2xl border border-white/10 bg-[#121824] p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300">
                      {en ? 'WPS Banking & Salary Transfer Details (Kuwait Ministry of Social Affairs & Labor)' : 'بيانات حساب تحويل الراتب المصرفي WPS (نظام حماية الأجور الكويتي)'}
                    </h3>
                    <p className="text-[11px] text-mist-400 mt-0.5">
                      {en ? 'Linked directly to official monthly WPS payroll text file' : 'مرتبط تلقائياً بملف صرف الرواتب الشهري المعتمد للبنوك'}
                    </p>
                  </div>
                  <span className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-black text-emerald-300">
                    WPS STATUS: VERIFIED
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                    <span className="text-[11px] text-mist-400 block mb-1">{en ? 'Bank Name' : 'اسم البنك المصرفي'}</span>
                    <span className="font-bold text-white text-sm">{employee.bankName}</span>
                    <span className="text-[10px] text-mist-400 block mt-0.5">{employee.bankNameAr}</span>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                    <span className="text-[11px] text-mist-400 block mb-1">{en ? 'Account Number' : 'رقم الحساب الجاري'}</span>
                    <span className="font-mono font-bold text-white text-sm" dir="ltr">{employee.bankAccount}</span>
                    <span className="text-[10px] text-emerald-400 block mt-0.5">Salary Account · حساب رواتب</span>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                    <span className="text-[11px] text-mist-400 block mb-1">{en ? 'International Bank Account (IBAN)' : 'الآيبان البنكي المعتمد (IBAN)'}</span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-gold-300 text-xs truncate" dir="ltr">
                        {employee.iban}
                      </span>
                      <button
                        type="button"
                        onClick={copyIban}
                        className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-white hover:bg-white/20 shrink-0"
                      >
                        {copiedIban ? '✓ تم النسخ' : 'نسخ 📋'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* 7. TAB 3: DOCUMENTS VAULT (6 OFFICIAL FILES) */}
          {activeTab === 'docs' ? (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">
                    {en ? '📂 Archived Official Documents & Digital Dossier (6 Files)' : '📂 المستندات الرسمية المؤرشفة والخزانة الرقمية للموظف (6 ملفات)'}
                  </h3>
                  <p className="text-xs text-mist-400 mt-0.5">
                    {en
                      ? 'All documents are scanned, verified against Kuwait Labor Law, and archived with biometric timestamps.'
                      : 'جميع المستندات مدققة ومطابقة لاشتراطات وزارة الشؤون والبلدية ومؤرشفة رقمياً.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => alert(en ? 'Document upload wizard is ready.' : 'نافذة رفع مستند جديد جاهزة.')}
                  className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
                >
                  {en ? '+ Upload New Document' : '+ رفع مستند جديد'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {employee.documents.map((doc, idx) => (
                  <div
                    key={doc.id}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-[#121824] p-4 hover:border-amber-400/30 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-xl">
                        {idx === 0 ? '🪪' : idx === 1 ? '🛂' : idx === 2 ? '📜' : idx === 3 ? '📑' : idx === 4 ? '🩺' : '💳'}
                      </span>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-white">
                          {isArabic ? doc.nameAr : doc.nameEn}
                        </p>
                        <p className="font-mono text-[11px] text-mist-400" dir="ltr">
                          {doc.fileName} · {doc.size}
                        </p>
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/20">
                            {isArabic ? doc.statusAr : doc.statusEn}
                          </span>
                          <span className="text-[10px] text-mist-400">
                            {en ? `Uploaded: ${doc.uploadDate}` : `تاريخ الأرشفة: ${doc.uploadDate}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          alert(en ? `Previewing ${doc.fileName}…` : `جاري معاينة مستند ${doc.fileName} في نافذة آمنة…`)
                        }
                        className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-mist-200 hover:border-white/30 hover:text-white"
                      >
                        {en ? 'Preview' : 'معاينة'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          alert(en ? `Downloading ${doc.fileName}…` : `جاري تحميل ${doc.fileName}…`)
                        }
                        className="rounded-lg bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30"
                      >
                        {en ? 'Download' : 'تحميل'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* 8. TAB 4: PRIVATE INFORMATION */}
          {activeTab === 'private' ? (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Personal & Residency Card */}
                <div className="rounded-2xl border border-white/10 bg-[#121824] p-4 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gold-300">
                    {en ? 'Personal Demographics' : 'البيانات الشخصية والجنسية'}
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Nationality:' : 'الجنسية والبلد:'}</span>
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span>{employee.flag}</span>
                        <span>{isArabic ? employee.nationalityAr : employee.nationalityEn}</span>
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Marital Status:' : 'الحالة الاجتماعية:'}</span>
                      <span className="font-bold text-white">{en ? 'Married' : 'متزوج'}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Gender:' : 'الجنس:'}</span>
                      <span className="font-bold text-white">{en ? 'Male' : 'ذكر'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mist-400">{en ? 'Contract Type:' : 'نوع العقد المعتمد:'}</span>
                      <span className="font-bold text-white">{employee.contractType}</span>
                    </div>
                  </div>
                </div>

                {/* Kuwait Residential Address & Emergency Card */}
                <div className="rounded-2xl border border-white/10 bg-[#121824] p-4 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gold-300">
                    {en ? 'Kuwait Address & Emergency Contact' : 'عنوان السكن في الكويت والاتصال في الطوارئ'}
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Residential Address:' : 'عنوان السكن بالكويت:'}</span>
                      <span className="font-bold text-white text-right">
                        {isArabic ? 'محافظة حولي، السالمية، قطعة 4، شارع 12' : 'Hawally Gov, Salmiya, Block 4, St 12'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Company Housing:' : 'سكن الشركة الرسمي:'}</span>
                      <span className="font-bold text-emerald-300">
                        {isArabic ? 'بدل سكن نقدي مباشر' : 'Company Housing Allowance Provided'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-mist-400">{en ? 'Emergency Contact Name:' : 'جهة الاتصال في الطوارئ:'}</span>
                      <span className="font-bold text-white">
                        {isArabic ? 'سمير جرجس (قريب الموظف)' : 'Family Member Contact'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mist-400">{en ? 'Emergency Phone:' : 'هاتف الطوارئ:'}</span>
                      <span className="font-mono font-bold text-amber-300" dir="ltr">+965 99147158</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* 9. TAB 5: PAYROLL, LEAVES & CUSTODY */}
          {activeTab === 'payroll' ? (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Salary Breakdown Box */}
              <div className="rounded-2xl border border-white/10 bg-[#121824] p-5 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-gold-300">
                  {en ? 'Monthly Salary Breakdown (0.000 KWD)' : 'مفردات الراتب الشهري الصافي (دقة 3 خانات عشرية)'}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                    <span className="text-mist-400 text-[11px] block">{en ? 'Basic Salary' : 'الراتب الأساسي'}</span>
                    <span className="font-mono font-black text-white text-base" dir="ltr">
                      {employee.basicSalary.toFixed(3)} د.ك
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                    <span className="text-mist-400 text-[11px] block">{en ? 'Allowances' : 'إجمالي البدلات'}</span>
                    <span className="font-mono font-black text-amber-300 text-base" dir="ltr">
                      +{employee.allowances.toFixed(3)} د.ك
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                    <span className="text-mist-400 text-[11px] block">{en ? 'Deductions' : 'الخصومات'}</span>
                    <span className="font-mono font-black text-rose-400 text-base" dir="ltr">
                      -{employee.deductions.toFixed(3)} د.ك
                    </span>
                  </div>
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 p-3">
                    <span className="text-emerald-300 text-[11px] font-bold block">{en ? 'Net Package' : 'صافي الراتب المستحق'}</span>
                    <span className="font-mono font-black text-emerald-300 text-base" dir="ltr">
                      {employee.netSalary.toFixed(3)} د.ك
                    </span>
                  </div>
                </div>
              </div>

              {/* Custody Assets Card */}
              <div className="rounded-2xl border border-white/10 bg-[#121824] p-4 space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-gold-300">
                  {en ? 'Registered Custody Assets' : 'سجل العهد المستلمة المعتمدة'}
                </h3>
                {employee.custodyItems.map((c) => (
                  <div key={c.tag} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-3.5 py-2 text-xs">
                    <div>
                      <p className="font-bold text-white">{isArabic ? c.nameAr : c.nameEn}</p>
                      <p className="font-mono text-[10px] text-mist-400">Tag: {c.tag} · Date: {c.date}</p>
                    </div>
                    <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/20">
                      عهدة قيد الاستخدام
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* 10. TAB 6: ACTIVITY & AUDIT LOG CHATTER */}
          {activeTab === 'activity' ? (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="rounded-2xl border border-white/10 bg-[#121824] p-4 space-y-2">
                <label className="text-xs font-bold text-amber-200 block">
                  {en ? '+ Add Note, Reminder, or Action Log' : '+ إضافة ملاحظة أو تذكير إداري أو إجراء وظيفي'}
                </label>
                <div className="flex gap-2">
                  <input
                    value={newNoteInput}
                    onChange={(e) => setNewNoteInput(e.target.value)}
                    placeholder={
                      en
                        ? 'Type a note or reminder for this employee…'
                        : 'اكتب ملاحظة أو تذكيراً إدارياً يخص هذا الموظف…'
                    }
                    className="flex-1 rounded-xl border border-white/15 bg-black/40 px-3.5 py-2 text-xs text-white placeholder-mist-500 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-black hover:bg-amber-400 transition-colors"
                  >
                    {en ? 'Log Note' : 'حفظ الملاحظة'}
                  </button>
                </div>
              </form>

              {/* Timeline Items */}
              <div className="rounded-2xl border border-white/10 bg-[#121824] p-4 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-gold-300 mb-2">
                  {en ? 'Historical Activity & Audit Trail' : 'سجل الأحداث والتدقيق الزمني الشامل'}
                </h3>
                <div className="space-y-3">
                  {allAuditLogs.map((log, i) => (
                    <div key={i} className="flex items-start gap-3 border-b border-white/5 pb-2.5 last:border-b-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-xs text-amber-300 border border-amber-500/20">
                        ⏱️
                      </span>
                      <div className="flex-1 space-y-0.5">
                        <p className="text-xs text-white font-medium">
                          {isArabic ? log.actionAr : log.actionEn}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-mist-400 font-mono">
                          <span>{log.date}</span>
                          <span>•</span>
                          <span className="text-amber-300/80">{log.user}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* 11. FOOTER BAR */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-3 bg-[#0a0d12]/50 text-xs">
          <div className="flex items-center gap-2 text-mist-400">
            <span>🛡️</span>
            <span>{en ? 'Kuwait Labor Law No. 6/2010 & PAM Asahal Synchronized' : 'متوافق مع قانون العمل الكويتي رقم 6/2010 وبوابة أسهل'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-bold text-white hover:bg-white/15"
          >
            {en ? 'Close Dossier' : 'إغلاق الملف'}
          </button>
        </div>
      </div>
    </div>
  )
}
