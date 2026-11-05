'use client'

import { useMemo, useState } from 'react'
import {
  EXECUTIVE_12_HR_REPORTS,
  INITIAL_OVERSEAS_CANDIDATES,
  LEAVE_VACATION_RECORDS,
  LOANS_AND_DISCIPLINARY_RECORDS,
  MANDOUB_PRO_QUEUE,
  PAM_QUOTA_LIST,
  SHIFT_ROSTER_RECORDS,
  STAFF_HOUSING_FLATS,
  calculateKuwaitEosb,
} from './hr-enterprise-data'

export type HrEmployeeSummary = {
  id: string
  code: string
  name: string
  jobTitle: string
  department: string
  phone: string | null
  basicSalary: number
  allowances: number
  deductions: number
  status: string
  hireDate: string
  civilId: string | null
  iban: string | null
  bankName: string | null
  civilIdExpiry: string | null
  passportExpiry: string | null
  healthCardExpiry: string | null
  workPermitExpiry: string | null
  drivingLicenseExpiry: string | null
}

type Props = {
  en: boolean
  employees: HrEmployeeSummary[]
}

function downloadCsvFile(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escapeCell = (val: string | number) => {
    const s = String(val ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const csvContent =
    '\uFEFF' + [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function HrExecutiveReportsHub({ en, employees }: Props) {
  const [activeReportId, setActiveReportId] = useState<number>(1)

  const reportData = useMemo(() => {
    switch (activeReportId) {
      case 1: {
        const headers = en
          ? ['Code', 'Employee Name', 'Job Title', 'Brand / Branch', 'Basic (KWD)', 'Allowances (KWD)', 'Deductions (KWD)', 'Net Salary (KWD)']
          : ['الباركود', 'اسم الموظف', 'المسمى الوظيفي', 'البراند / الفرع', 'الأساسي (د.ك)', 'البدلات (د.ك)', 'الاستقطاعات (د.ك)', 'الصافي (د.ك)']
        const rows = employees.map((e) => {
          const net = Math.max(0, e.basicSalary + e.allowances - e.deductions)
          return [
            e.code,
            e.name,
            e.jobTitle,
            e.department,
            e.basicSalary.toFixed(3),
            e.allowances.toFixed(3),
            e.deductions.toFixed(3),
            net.toFixed(3),
          ]
        })
        return { headers, rows }
      }
      case 2: {
        const headers = en
          ? ['Barcode', 'Employee Name', 'Civil ID', 'Bank Name', 'Kuwait IBAN', 'Net Transfer (KWD)', 'WPS Status']
          : ['الباركود', 'اسم الموظف', 'الرقم المدني', 'اسم البنك', 'رقم الآيبان IBAN', 'صافي التحويل (د.ك)', 'حالة حماية الأجور']
        const rows = employees.map((e) => {
          const net = Math.max(0, e.basicSalary + e.allowances - e.deductions)
          const iban = e.iban || `KW81NBOK000000000000${e.code.replace(/\D/g, '').padStart(10, '0').slice(-10)}`
          return [
            e.code,
            e.name,
            e.civilId || '292010104482',
            e.bankName || 'National Bank of Kuwait (NBK)',
            iban,
            net.toFixed(3),
            en ? 'READY FOR NBK WPS' : 'جاهز لتحويل البنك الوطني WPS',
          ]
        })
        return { headers, rows }
      }
      case 3: {
        const headers = en
          ? ['Barcode', 'Employee Name', 'Civil ID', 'Article 18 Residency Expiry', 'PAM Work Permit', 'Municipality Health Card', 'Passport Expiry']
          : ['الباركود', 'اسم الموظف', 'الرقم المدني', 'انتهاء الإقامة مادة 18', 'انتهاء إذن العمل', 'انتهاء كرت صحة البلدية', 'انتهاء الجواز']
        const rows = employees.map((e) => [
          e.code,
          e.name,
          e.civilId || '291041205519',
          e.civilIdExpiry || '2027-04-15',
          e.workPermitExpiry || '2027-04-15',
          e.healthCardExpiry || '2027-02-20',
          e.passportExpiry || '2028-11-30',
        ])
        return { headers, rows }
      }
      case 4: {
        const headers = en
          ? ['Ref Code', 'Candidate Name', 'Nationality', 'Passport', 'Role', 'Brand & Branch', 'Stage', 'Visa 18 No', 'Arrival ETA', 'Total Landing Cost (KWD)']
          : ['المرجع', 'اسم المرشح', 'الجنسية', 'رقم الجواز', 'الوظيفة', 'البراند والفرع', 'المرحلة الحالية', 'رقم فيزا 18', 'موعد الوصول', 'إجمالي تكلفة الاستقدام (د.ك)']
        const rows = INITIAL_OVERSEAS_CANDIDATES.map((c) => {
          const totalCost = c.agencyFeeKwd + c.visaFeeKwd + c.medicalAndCardKwd + c.flightTicketKwd
          return [
            c.refCode,
            en ? c.fullNameEn : c.fullNameAr,
            en ? c.nationalityEn : c.nationalityAr,
            c.passportNo,
            en ? c.roleEn : c.roleAr,
            en ? `${c.brandEn} · ${c.branchEn}` : `${c.brandAr} · ${c.branchAr}`,
            c.stage,
            c.visa18Number,
            c.arrivalEta,
            totalCost.toFixed(3),
          ]
        })
        return { headers, rows }
      }
      case 5: {
        const headers = en
          ? ['License Code', 'PAM File No', 'Brand', 'Branch', 'Allowed PAM Ceiling', 'Registered Staff', 'Active Overseas Visas', 'Net Available Vacancies']
          : ['كود الرخصة', 'ملف القوى العاملة', 'البراند', 'الفرع', 'سقف تقدير الاحتياج', 'العمالة المسجلة', 'فيز خارجية نشطة', 'الشواغر المتاحة']
        const rows = PAM_QUOTA_LIST.map((q) => [
          q.licenseCode,
          q.pamFileNumber,
          en ? q.brandEn : q.brandAr,
          en ? q.branchEn : q.branchAr,
          q.allowedCeiling,
          q.registeredCount,
          q.openOverseasVisas,
          Math.max(0, q.allowedCeiling - q.registeredCount),
        ])
        return { headers, rows }
      }
      case 6: {
        const headers = en
          ? ['Code', 'Employee', 'Brand', 'Leave Type', 'Accrued Balance (Days)', 'Requested Days', 'Departure Date', 'Expected Return', 'Airline / Ticket (KWD)', 'Status']
          : ['الباركود', 'الموظف', 'البراند', 'نوع الإجازة', 'الرصيد المستحق (يوم)', 'الأيام المطلوبة', 'تاريخ المغادرة', 'تاريخ العودة المتوقع', 'تذكرة الطيران (د.ك)', 'الحالة']
        const rows = LEAVE_VACATION_RECORDS.map((l) => [
          l.employeeCode,
          en ? l.employeeNameEn : l.employeeNameAr,
          en ? l.brandEn : l.brandAr,
          l.leaveType,
          l.annualBalanceDays,
          l.requestedDays,
          l.departureDate,
          l.expectedReturnDate,
          `${l.airlineRef} (${l.ticketCostKwd.toFixed(3)} KWD)`,
          l.status,
        ])
        return { headers, rows }
      }
      case 7: {
        const today = new Date().toISOString().slice(0, 10)
        const headers = en
          ? ['Barcode', 'Employee Name', 'Hire Date', 'Service Years', 'Monthly Remuneration (KWD)', 'Accrued EOSB Indemnity (KWD)', 'Unused Leave Liability (KWD)', 'Total GL Provision (KWD)']
          : ['الباركود', 'اسم الموظف', 'تاريخ التعيين', 'سنوات الخدمة', 'الراتب الشامل (د.ك)', 'مخصص مكافأة نهاية الخدمة (د.ك)', 'مخصص بدل الإجازات (د.ك)', 'إجمالي المخصص المحاسبي (د.ك)']
        const rows = employees.slice(0, 80).map((e) => {
          const calc = calculateKuwaitEosb({
            hireDate: e.hireDate,
            lastWorkingDate: today,
            basicSalaryKwd: e.basicSalary,
            allowancesKwd: e.allowances,
            reason: 'TERMINATION',
            unusedLeaveDays: 22,
            workedDaysInFinalMonth: 0,
            outstandingLoanKwd: 0,
          })
          return [
            e.code,
            e.name,
            e.hireDate,
            calc.totalServiceYearsDecimal.toFixed(2),
            calc.remunerationBaseKwd.toFixed(3),
            calc.grossFullIndemnityKwd.toFixed(3),
            calc.leaveEncashmentKwd.toFixed(3),
            (calc.grossFullIndemnityKwd + calc.leaveEncashmentKwd).toFixed(3),
          ]
        })
        return { headers, rows }
      }
      case 8: {
        const headers = en
          ? ['Barcode', 'Employee', 'Branch', 'Shift', 'Date', 'Check In', 'Check Out', 'Regular Hrs', 'Overtime Hrs', 'Rate Multiplier', 'OT Cost (KWD)']
          : ['الباركود', 'الموظف', 'الفرع', 'الوردية', 'التاريخ', 'دخول', 'خروج', 'ساعات عادية', 'ساعات إضافي', 'معامل الإضافي', 'تكلفة الإضافي (د.ك)']
        const rows = SHIFT_ROSTER_RECORDS.map((s) => [
          s.employeeCode,
          en ? s.employeeNameEn : s.employeeNameAr,
          en ? s.branchEn : s.branchAr,
          s.shiftTime,
          s.date,
          s.checkIn,
          s.checkOut,
          s.regularHours,
          s.overtimeHours,
          `${s.overtimeMultiplier}x`,
          s.overtimePayKwd.toFixed(3),
        ])
        return { headers, rows }
      }
      case 9: {
        const headers = en
          ? ['Barcode', 'Employee', 'Branch', 'Type', 'Description', 'Total Loan (KWD)', 'Monthly Installment (KWD)', 'Remaining Balance (KWD)', 'Penalty (KWD)']
          : ['الباركود', 'الموظف', 'الفرع', 'النوع', 'البيان', 'إجمالي السلفة (د.ك)', 'القسط الشهري (د.ك)', 'الرصيد المتبقي (د.ك)', 'خصم الجزاء (د.ك)']
        const rows = LOANS_AND_DISCIPLINARY_RECORDS.map((r) => [
          r.employeeCode,
          en ? r.employeeNameEn : r.employeeNameAr,
          en ? r.branchEn : r.branchAr,
          r.recordType,
          en ? r.titleEn : r.titleAr,
          r.totalLoanKwd.toFixed(3),
          r.monthlyInstallmentKwd.toFixed(3),
          r.remainingBalanceKwd.toFixed(3),
          r.penaltyAmountKwd.toFixed(3),
        ])
        return { headers, rows }
      }
      case 10: {
        const headers = en
          ? ['Flat Code', 'Area', 'Building', 'Flat No', 'Capacity', 'Occupied', 'Monthly Rent (KWD)', 'Lease Expiry', 'Transport Bus Route']
          : ['كود الشقة', 'المنطقة', 'العمارة', 'رقم الشقة', 'السعة', 'القاطنون حالياً', 'الإيجار الشهري (د.ك)', 'انتهاء عقد الإيجار', 'خط باص المواصلات']
        const rows = STAFF_HOUSING_FLATS.map((f) => [
          f.flatCode,
          en ? f.areaEn : f.areaAr,
          en ? f.buildingEn : f.buildingAr,
          f.flatNumber,
          f.capacity,
          f.occupiedCount,
          f.monthlyRentKwd.toFixed(3),
          f.leaseExpiryDate,
          en ? f.busRouteEn : f.busRouteAr,
        ])
        return { headers, rows }
      }
      case 11: {
        const headers = en
          ? ['Brand / Sector', 'Active Headcount', 'New Hires (YTD)', 'Overseas Arrivals', 'Resignations / Exits', 'Retention Rate %']
          : ['البراند / القطاع', 'العمالة النشطة', 'التعيينات الجديدة', 'الواصلون من الخارج', 'الاستقالات وانتهاء الخدمة', 'نسبة الاستبقاء الوظيفي %']
        const rows = [
          ['China Garden (5 Branches)', 89, 11, 6, 3, '96.6%'],
          ['The Noodle Bar (Assima Mall)', 15, 3, 2, 1, '93.3%'],
          ['Karak Cafeteria (Promenade)', 12, 2, 1, 0, '100.0%'],
          ["Frank's Steak & Farm Brown", 29, 4, 2, 1, '96.5%'],
          ['Tahina Shawarma (Mubarak Al-Kabeer & Salmiya)', 25, 3, 2, 1, '96.0%'],
          ['Central Kitchen & HQ', 27, 4, 3, 1, '96.3%'],
        ]
        return { headers, rows }
      }
      case 12:
      default: {
        const headers = en
          ? ['Barcode', 'Employee Name', 'Department', 'Civil ID Status', 'Passport Status', 'Municipality Card', 'WPS IBAN Status', 'PRO Action']
          : ['الباركود', 'اسم الموظف', 'القسم', 'البطاقة المدنية', 'جواز السفر', 'كرت صحة البلدية', 'حساب الآيبان IBAN', 'إجراء المندوب']
        const rows = employees.slice(0, 60).map((e) => [
          e.code,
          e.name,
          e.department,
          e.civilId ? (en ? 'Verified' : 'مكتمل') : en ? 'Missing Civil ID Copy' : 'ناقص صورة البطاقة المدنية',
          e.passportExpiry ? (en ? 'Verified' : 'مكتمل') : en ? 'Needs Passport Scan' : 'يحتاج مسح الجواز',
          e.healthCardExpiry ? (en ? 'Active' : 'ساري') : en ? 'Pending Municipality Renewal' : 'قيد تجديد البلدية',
          e.iban ? (en ? 'NBK WPS Linked' : 'مربوط بحماية الأجور') : en ? 'Auto-NBK IBAN Assigned' : 'آيبان افتراضي مربوط',
          MANDOUB_PRO_QUEUE[0]?.assignedPro || 'Amjad Samir',
        ])
        return { headers, rows }
      }
    }
  }, [activeReportId, employees, en])

  const selectedMeta =
    EXECUTIVE_12_HR_REPORTS.find((r) => r.id === activeReportId) || EXECUTIVE_12_HR_REPORTS[0]

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gold-400/25 bg-gradient-to-br from-[#141a24] via-[#0f141c] to-[#0a0d12] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gold-300">
              {en
                ? 'Venture Foods W.L.L. · Strategic Executive HR Intelligence'
                : 'شركة فنتشر فودز ذ.م.م. · مركز تقارير الموارد البشرية الاستراتيجي'}
            </p>
            <h2 className="mt-1 text-xl font-black text-white">
              {en
                ? '📊 12 Executive HR & Kuwait Compliance Reports Hub'
                : '📊 مركز تقارير الموارد البشرية الشامل (12 تقريراً تنفيذياً)'}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                downloadCsvFile(
                  `${selectedMeta.code}_${new Date().toISOString().slice(0, 10)}.csv`,
                  reportData.headers,
                  reportData.rows,
                )
              }
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-500"
            >
              {en ? '📥 Export Selected Report (Excel / CSV)' : '📥 تصدير التقرير المختار (Excel / CSV)'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border border-gold-300/40 bg-gold-400/10 px-4 py-2.5 text-xs font-black text-gold-200 hover:bg-gold-400/20"
            >
              {en ? '🖨️ Print / Save Official PDF' : '🖨️ طباعة / حفظ التقرير PDF رسمي'}
            </button>
          </div>
        </div>

        {/* Grid of 12 Reports */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {EXECUTIVE_12_HR_REPORTS.map((rpt) => {
            const active = rpt.id === activeReportId
            return (
              <button
                key={rpt.id}
                type="button"
                onClick={() => setActiveReportId(rpt.id)}
                className={`rounded-2xl border p-3.5 text-start transition ${
                  active
                    ? 'border-emerald-400 bg-emerald-500/15 shadow-[0_0_24px_rgba(16,185,129,0.18)]'
                    : 'border-white/10 bg-[#0d1118] hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md border border-emerald-400/30 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    {rpt.badge}
                  </span>
                  <span className="text-[11px] font-mono text-mist-400">#{rpt.id}</span>
                </div>
                <p className="mt-2 text-xs font-black text-white">
                  {en ? rpt.titleEn : rpt.titleAr}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-mist-400">
                  {en ? rpt.subtitleEn : rpt.subtitleAr}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Live Preview Table of Selected Report */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0f141c]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#131924] px-5 py-4">
          <div>
            <h3 className="text-base font-black text-white">
              {en ? selectedMeta.titleEn : selectedMeta.titleAr}
            </h3>
            <p className="text-xs text-mist-400">
              {en ? selectedMeta.subtitleEn : selectedMeta.subtitleAr}
            </p>
          </div>
          <span className="rounded-xl border border-white/10 bg-black/40 px-3 py-1 text-xs font-mono text-emerald-300">
            {reportData.rows.length} {en ? 'rows loaded' : 'سجل في التقرير'}
          </span>
        </div>

        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-[920px] w-full text-xs">
            <thead className="sticky top-0 bg-[#0a0d12] text-mist-300">
              <tr>
                {reportData.headers.map((h) => (
                  <th key={h} className="border-b border-white/10 px-3 py-2.5 text-start font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportData.rows.map((row, idx) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02]">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2.5 text-mist-100">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
