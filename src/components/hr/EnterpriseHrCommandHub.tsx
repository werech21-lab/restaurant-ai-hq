'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'
import { calculateKuwaitEosb, type HrCommandTabKey } from './hr-enterprise-data'
import type { HrEmployeeSummary } from './HrExecutiveReportsHub'

export type HrPayrollRow = {
  id: string
  month: number
  year: number
  employeeId: string
  employeeCode: string
  employeeName: string
  department: string
  basicSalary: number
  totalAllowances: number
  totalDeductions: number
  netSalary: number
  absentDays: number
  lateDays: number
  status: string
}

export type HrAttendanceRow = {
  id: string
  employeeCode: string
  employeeName: string
  date: string
  status: string
  hoursWorked: number
}

type Props = {
  locale: 'ar' | 'en'
  initialTab?: string
  employees: HrEmployeeSummary[]
  payrollRows: HrPayrollRow[]
  attendanceRows: HrAttendanceRow[]
  year: number
  month: number
  canCreate: boolean
  canEdit: boolean
}

const TABS: Array<{ key: HrCommandTabKey; ar: string; en: string }> = [
  { key: 'employees', ar: 'دليل الموظفين', en: 'Employee Directory' },
  { key: 'payroll', ar: 'مسير الرواتب', en: 'Payroll' },
  { key: 'attendance', ar: 'الحضور والانصراف', en: 'Attendance' },
  { key: 'eosb', ar: 'حاسبة نهاية الخدمة', en: 'Kuwait EOSB Calculator' },
]

export function EnterpriseHrCommandHub({
  locale,
  initialTab,
  employees,
  payrollRows,
  attendanceRows,
  year,
  month,
}: Props) {
  const isAr = locale !== 'en'
  const validInitial = TABS.find((t) => t.key === initialTab)?.key ?? 'employees'
  const [activeTab, setActiveTab] = useState<HrCommandTabKey>(validInitial)

  const [hireDate, setHireDate] = useState('')
  const [lastWorkingDate, setLastWorkingDate] = useState('')
  const [basicSalaryKwd, setBasicSalaryKwd] = useState(0)
  const [allowancesKwd, setAllowancesKwd] = useState(0)
  const [reason, setReason] = useState<'RESIGNATION' | 'TERMINATION' | 'CONTRACT_EXPIRY'>('TERMINATION')

  const eosb =
    hireDate && lastWorkingDate && basicSalaryKwd > 0
      ? calculateKuwaitEosb({
          hireDate,
          lastWorkingDate,
          basicSalaryKwd,
          allowancesKwd,
          reason,
          unusedLeaveDays: 0,
          workedDaysInFinalMonth: 0,
          outstandingLoanKwd: 0,
        })
      : null

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-7xl space-y-6 p-6 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">
            {isAr ? 'الموارد البشرية وشؤون العاملين' : 'Human Resources & Workforce'}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {isAr
              ? `الفترة: ${month}/${year} — يُعرض فقط ما هو مسجل فعلياً في قاعدة البيانات أو مربوط بـ Odoo 17.`
              : `Period: ${month}/${year} — Displays only records stored in DB or linked to Odoo 17.`}
          </p>
        </div>
        <Link
          href="/erp/feryal-ai"
          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
        >
          {isAr ? 'اسأل فريال عن موظفي Odoo' : 'Ask Feryal about Odoo HR'}
        </Link>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === tab.key
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {isAr ? tab.ar : tab.en}
          </button>
        ))}
      </div>

      {activeTab === 'employees' &&
        (employees.length === 0 ? (
          <UnlinkedSourceNotice
            isAr={isAr}
            titleAr="غير مربوط بمصدر — دليل الموظفين التفصيلي"
            titleEn="غير مربوط بمصدر — Detailed Employee Directory"
            reasonAr="لا توجد سجلات موظفين مخزنة محلياً في هذه الوحدة، وتم حذف جميع قوائم الموظفين والرواتب ونسب الإجازات الثابتة غير الموثقة."
            reasonEn="No local employee records are stored in this panel, and all static placeholder directories have been removed."
            requiredSourceAr="ربط نموذج hr.employee وعقود hr.contract من Odoo 17 بصلاحية قراءة معتمدة."
            requiredSourceEn="Link Odoo 17 hr.employee and hr.contract models with read access."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="p-3 text-start">{isAr ? 'الرمز' : 'Code'}</th>
                  <th className="p-3 text-start">{isAr ? 'الاسم' : 'Name'}</th>
                  <th className="p-3 text-start">{isAr ? 'القسم' : 'Department'}</th>
                  <th className="p-3 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-slate-800/60">
                    <td className="p-3 font-mono">{emp.code}</td>
                    <td className="p-3 font-semibold">{emp.name}</td>
                    <td className="p-3">{emp.department || '—'}</td>
                    <td className="p-3">{emp.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {activeTab === 'payroll' &&
        (payrollRows.length === 0 ? (
          <UnlinkedSourceNotice
            isAr={isAr}
            titleAr="غير مربوط بمصدر — مسير الرواتب"
            titleEn="غير مربوط بمصدر — Payroll Ledger"
            reasonAr="لا توجد مسيرات رواتب مسجلة لهذه الفترة، ولا يتم عرض أي سلم رواتب افتراضي."
            reasonEn="No payroll runs are recorded for this period."
            requiredSourceAr="ربط مسيرات hr.payslip أو قيود الرواتب الفعلية في Odoo 17."
            requiredSourceEn="Link Odoo 17 hr.payslip or posted payroll journal entries."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="p-3 text-start">{isAr ? 'الرمز' : 'Code'}</th>
                  <th className="p-3 text-start">{isAr ? 'الموظف' : 'Employee'}</th>
                  <th className="p-3 text-end">{isAr ? 'صافي الراتب (د.ك)' : 'Net Salary (KWD)'}</th>
                </tr>
              </thead>
              <tbody>
                {payrollRows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/60">
                    <td className="p-3 font-mono">{r.employeeCode}</td>
                    <td className="p-3">{r.employeeName}</td>
                    <td className="p-3 text-end font-mono">{r.netSalary.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {activeTab === 'attendance' &&
        (attendanceRows.length === 0 ? (
          <UnlinkedSourceNotice
            isAr={isAr}
            titleAr="غير مربوط بمصدر — الحضور والبصمة"
            titleEn="غير مربوط بمصدر — Biometric Attendance"
            reasonAr="أجهزة البصمة وسجلات الشفتات غير مربوطة بمصدر بيانات فعلي حالياً."
            reasonEn="Biometric terminals and shift logs are not currently linked to an active source."
            requiredSourceAr="ربط نموذج hr.attendance في Odoo 17 أو واجهة جهاز البصمة."
            requiredSourceEn="Link Odoo 17 hr.attendance or biometric terminal API."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="p-3 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="p-3 text-start">{isAr ? 'الموظف' : 'Employee'}</th>
                  <th className="p-3 text-end">{isAr ? 'الساعات' : 'Hours'}</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/60">
                    <td className="p-3 font-mono">{r.date}</td>
                    <td className="p-3">{r.employeeName}</td>
                    <td className="p-3 text-end font-mono">{r.hoursWorked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {activeTab === 'eosb' && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">
            {isAr
              ? 'حاسبة مكافأة نهاية الخدمة القانونية (قانون العمل الكويتي رقم 6 لسنة 2010)'
              : 'Statutory Kuwait Labor Law EOSB Calculator'}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="space-y-1 text-xs">
              <span className="text-slate-400">{isAr ? 'تاريخ التعيين' : 'Hire Date'}</span>
              <input
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-slate-400">{isAr ? 'آخر يوم عمل' : 'Last Working Date'}</span>
              <input
                type="date"
                value={lastWorkingDate}
                onChange={(e) => setLastWorkingDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-slate-400">{isAr ? 'الراتب الأساسي (د.ك)' : 'Basic Salary (KWD)'}</span>
              <input
                type="number"
                min={0}
                step="0.001"
                value={basicSalaryKwd || ''}
                onChange={(e) => setBasicSalaryKwd(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-slate-400">{isAr ? 'البدلات الثابتة (د.ك)' : 'Allowances (KWD)'}</span>
              <input
                type="number"
                min={0}
                step="0.001"
                value={allowancesKwd || ''}
                onChange={(e) => setAllowancesKwd(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-slate-400">{isAr ? 'سبب انتهاء الخدمة' : 'Separation Reason'}</span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as typeof reason)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              >
                <option value="TERMINATION">{isAr ? 'إنهاء خدمات' : 'Termination'}</option>
                <option value="CONTRACT_EXPIRY">{isAr ? 'انتهاء عقد' : 'Contract Expiry'}</option>
                <option value="RESIGNATION">{isAr ? 'استقالة' : 'Resignation'}</option>
              </select>
            </label>
          </div>
          {eosb ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs space-y-1">
              <div>
                {isAr ? 'صافي مكافأة نهاية الخدمة المستحقة:' : 'Net Payable Indemnity:'}{' '}
                <strong className="font-mono text-emerald-300">
                  {eosb.netIndemnityPayableKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                </strong>
              </div>
              <div className="text-slate-400">
                {isAr ? eosb.resignationEntitlementLabelAr : eosb.resignationEntitlementLabelEn}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              {isAr
                ? 'أدخل تواريخ الخدمة والراتب لحساب الاستحقاق القانوني بدقة دون أي بيانات افتراضية.'
                : 'Enter service dates and salary to compute statutory entitlement.'}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
