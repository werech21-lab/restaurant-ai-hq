'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { generatePayrollAction, payPayrollAction } from '@/app/actions/hr'
import { HrDigitalDossier } from '@/components/hr-digital-dossier'
import { HrWpsToolbar } from '@/components/hr-wps-toolbar'
import {
  INITIAL_OVERSEAS_CANDIDATES,
  LEAVE_VACATION_RECORDS,
  LOANS_AND_DISCIPLINARY_RECORDS,
  MANDOUB_PRO_QUEUE,
  OVERSEAS_STAGES,
  PAM_QUOTA_LIST,
  SHIFT_ROSTER_RECORDS,
  STAFF_HOUSING_FLATS,
  calculateKuwaitEosb,
  type HrCommandTabKey,
  type OverseasCandidate,
  type OverseasStage,
} from './hr-enterprise-data'
import { HrExecutiveReportsHub, type HrEmployeeSummary } from './HrExecutiveReportsHub'
import { HrOfficialLettersHub } from './HrOfficialLettersHub'
import { NewEmployeeWizardModal } from './NewEmployeeWizardModal'
import { SmartPhotoDocAutoMatcherModal } from './SmartPhotoDocAutoMatcherModal'
import { OdooExpenseSingleModal, type NewExpensePayload } from '@/components/accounting/OdooExpenseSingleModal'
import { OdooExpenseSheetModal, type NewExpenseSheetPayload } from '@/components/accounting/OdooExpenseSheetModal'
import type { OdooExpenseSheetReport } from '@/lib/accounting/odoo-real-expenses-data'

import {
  loadCustomAvatars,
  getEmployeeAvatarUrl,
  saveCustomAvatar,
  compressImageFile,
} from './hr-avatar-utils'
import {
  VENTURE_EMPLOYEES,
  VENTURE_DEPARTMENTS,
  VENTURE_WORK_LOCATIONS,
  type VentureEmployee,
} from './venture-employees-directory'
import { EmployeeProfileModal360 } from './EmployeeProfileModal360'
import { OdooPlanningGanttView } from './OdooPlanningGanttView'
import { ODOO_LEADERSHIP_SALARY_BENCHMARKS } from '@/lib/hr/odoo-hr-dashboard-data'
import {
  ODOO_REAL_EXPENSE_SHEETS,
  ODOO_SANAD_STATEMENT_DETAILS,
  ODOO_CUSTODIANS_7,
} from '@/lib/accounting/odoo-real-expenses-data'
import Link from 'next/link'

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

const COMMAND_TABS: Array<{
  key: HrCommandTabKey
  icon: string
  ar: string
  en: string
}> = [
  {
    key: 'employees',
    icon: '🪪',
    ar: '1. دليل وبطاقات الموظفين (166 موظفاً)',
    en: '1. Employee Directory & 360 Profiles (166 Staff)',
  },
  {
    key: 'payroll',
    icon: '📋',
    ar: '2. مسير الرواتب وحماية الأجور وسلم الوظائف',
    en: '2. Payroll, NBK WPS & Leadership Salary Scale',
  },
  {
    key: 'planningGantt',
    icon: '📅',
    ar: '3. مخطط الشفتات والدوام الأسبوعي',
    en: '3. Weekly Shift Planning & Gantt Roster',
  },
  {
    key: 'expensesCustody',
    icon: '💼',
    ar: '4. تقارير عهد ومصروفات الموظفين والإقامات',
    en: '4. Employee Expense Sheets & Residency Tracking',
  },
  {
    key: 'recruitment',
    icon: '✈️',
    ar: '5. الاستقدام الخارجي وفيزا 18',
    en: '5. Overseas Recruitment & Visa 18',
  },
  {
    key: 'residency',
    icon: '🆔',
    ar: '6. الإقامات والبلدية ومتابعة المندوب',
    en: '6. Residencies, Health Cards & PRO Queue',
  },
  {
    key: 'leaves',
    icon: '🏖️',
    ar: '7. الإجازات وتذاكر السفر',
    en: '7. Leaves, Air Tickets & Vacation',
  },
  {
    key: 'attendance',
    icon: '⏱️',
    ar: '8. البصمة والشفتات والإضافي',
    en: '8. Attendance, Shift Roster & Overtime',
  },
  {
    key: 'loans',
    icon: '💳',
    ar: '9. السلف والقروض والجزاءات',
    en: '9. Loans, Advances & Disciplinary',
  },
  {
    key: 'housing',
    icon: '🏢',
    ar: '10. سكن العمال والمواصلات',
    en: '10. Staff Accommodation & Transport',
  },
  {
    key: 'eosb',
    icon: '⚖️',
    ar: '11. حاسبة نهاية الخدمة والمخالصات',
    en: '11. Kuwait EOSB Calculator & Offboarding',
  },
  {
    key: 'letters',
    icon: '🖨️',
    ar: '12. الشهادات والعقود الرسمية',
    en: '12. 1-Click Official HR Letters & Contracts',
  },
  {
    key: 'reports',
    icon: '📊',
    ar: 'مركز التقارير الـ 12 الشامل',
    en: '12 Executive HR Reports Hub',
  },
]

function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null
  const ms = new Date(dateIso).getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

export function EnterpriseHrCommandHub({
  locale,
  initialTab,
  employees,
  payrollRows,
  attendanceRows,
  year,
  month,
  canCreate,
  canEdit,
}: Props) {
  const router = useRouter()
  const en = locale === 'en'
  const isArabic = !en

  const validInitialTab = COMMAND_TABS.find((t) => t.key === initialTab)?.key || 'employees'
  const [activeTab, setActiveTab] = useState<HrCommandTabKey>(validInitialTab)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [selectedDossierEmpId, setSelectedDossierEmpId] = useState<string | null>(null)

  // Filters & View Mode for Tab 1 (Employees Directory)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL')
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL')
  const [selectedProfileEmployee, setSelectedProfileEmployee] = useState<VentureEmployee | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [brandFilter, setBrandFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [autoMatcherOpen, setAutoMatcherOpen] = useState(false)
  const [customAvatars, setCustomAvatars] = useState<Record<string, string>>({})

  // Real-time synchronization of custom avatars from localStorage and window events
  useEffect(() => {
    setCustomAvatars(loadCustomAvatars())

    const handleAvatarUpdated = (e: any) => {
      if (e.detail?.code && e.detail?.dataUrl) {
        setCustomAvatars((prev) => ({ ...prev, [e.detail.code]: e.detail.dataUrl }))
      }
    }
    const handleBatchUpdated = (e: any) => {
      if (e.detail) {
        setCustomAvatars((prev) => ({ ...prev, ...e.detail }))
      }
    }

    window.addEventListener('venture-avatar-updated', handleAvatarUpdated)
    window.addEventListener('venture-avatar-batch-updated', handleBatchUpdated)

    return () => {
      window.removeEventListener('venture-avatar-updated', handleAvatarUpdated)
      window.removeEventListener('venture-avatar-batch-updated', handleBatchUpdated)
    }
  }, [])

  const handleSingleEmployeePhotoUpload = async (empCode: string, file: File) => {
    try {
      const compressed = await compressImageFile(file, 320, 0.85)
      saveCustomAvatar(empCode, compressed)
    } catch (err) {
      console.error('Failed to upload single avatar:', err)
    }
  }

  // State for Tab 2 (Overseas Recruitment)
  const [candidates, setCandidates] = useState<OverseasCandidate[]>(INITIAL_OVERSEAS_CANDIDATES)
  const [showNewOverseasForm, setShowNewOverseasForm] = useState(false)
  const [ovName, setOvName] = useState('')
  const [ovNationality, setOvNationality] = useState('India')
  const [ovPassport, setOvPassport] = useState('Z9910234')
  const [ovRole, setOvRole] = useState('Wok Chef')
  const [ovBrand, setOvBrand] = useState('China Garden')
  const [ovBranch, setOvBranch] = useState('Salmiya Branch')
  const [ovAgencyKwd, setOvAgencyKwd] = useState('120.000')
  const [ovVisaKwd, setOvVisaKwd] = useState('70.000')
  const [ovMedicalKwd, setOvMedicalKwd] = useState('45.000')
  const [ovFlightKwd, setOvFlightKwd] = useState('95.000')
  const [ovSalaryKwd, setOvSalaryKwd] = useState('260.000')

  // State for Tab 4 (Interactive Payroll Calculator)
  const [calcBasic, setCalcBasic] = useState('300.000')
  const [calcAllowances, setCalcAllowances] = useState('75.000')
  const [calcOvertime, setCalcOvertime] = useState('22.500')
  const [calcLoans, setCalcLoans] = useState('25.000')
  const [calcAbsencePenalties, setCalcAbsencePenalties] = useState('0.000')
  const [calcIsKuwaitiPifss, setCalcIsKuwaitiPifss] = useState(false)
  const [payrollBusy, setPayrollBusy] = useState(false)
  const [payrollNotice, setPayrollNotice] = useState<string | null>(null)

  // State for Tab 9 (Kuwait EOSB Indemnity Calculator)
  const [eosbEmpId, setEosbEmpId] = useState<string>(employees[0]?.id || '')
  const [eosbReason, setEosbReason] = useState<'RESIGNATION' | 'TERMINATION' | 'CONTRACT_EXPIRY'>('TERMINATION')
  const [eosbLastDate, setEosbLastDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [eosbUnusedLeaveDays, setEosbUnusedLeaveDays] = useState<string>('24')
  const [eosbWorkedDaysFinalMonth, setEosbWorkedDaysFinalMonth] = useState<string>('20')
  const [eosbLoanBalance, setEosbLoanBalance] = useState<string>('0.000')

  // State for Alert Dispatch (Stage 3: 3 Exclusive Recipients + Sheyam Hekmat)
  const [alertBusy, setAlertBusy] = useState(false)
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null)

  // State for Odoo hr.expense & hr.expense.sheet Modals in HR
  const [showHrExpenseSingleModal, setShowHrExpenseSingleModal] = useState(false)
  const [showHrExpenseSheetModal, setShowHrExpenseSheetModal] = useState(false)
  const [selectedHrSheetForModal, setSelectedHrSheetForModal] = useState<OdooExpenseSheetReport | null>(null)
  const [hrExpenseSheets, setHrExpenseSheets] = useState<OdooExpenseSheetReport[]>(ODOO_REAL_EXPENSE_SHEETS)

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (brandFilter !== 'ALL' && !emp.department.toLowerCase().includes(brandFilter.toLowerCase())) {
        return false
      }
      if (statusFilter !== 'ALL' && emp.status !== statusFilter) {
        return false
      }
      if (!searchQ.trim()) return true
      const q = searchQ.toLowerCase()
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.code.toLowerCase().includes(q) ||
        emp.jobTitle.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q) ||
        (emp.civilId || '').toLowerCase().includes(q)
      )
    })
  }, [employees, brandFilter, statusFilter, searchQ])

  const filteredVentureEmployees = useMemo(() => {
    return VENTURE_EMPLOYEES.filter((emp) => {
      if (selectedDepartment !== 'ALL' && emp.department !== selectedDepartment) {
        return false
      }
      if (selectedLocation !== 'ALL' && emp.workLocation !== selectedLocation) {
        return false
      }
      if (statusFilter !== 'ALL' && emp.status !== statusFilter) {
        return false
      }
      if (!searchQ.trim()) return true
      const q = searchQ.toLowerCase().trim()
      return (
        emp.nameAr.toLowerCase().includes(q) ||
        emp.nameEn.toLowerCase().includes(q) ||
        emp.code.toLowerCase().includes(q) ||
        emp.jobTitleAr.toLowerCase().includes(q) ||
        emp.jobTitleEn.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q) ||
        emp.departmentAr.toLowerCase().includes(q) ||
        emp.workLocation.toLowerCase().includes(q) ||
        emp.workLocationAr.toLowerCase().includes(q) ||
        emp.civilId.toLowerCase().includes(q) ||
        emp.phone.toLowerCase().includes(q)
      )
    })
  }, [selectedDepartment, selectedLocation, statusFilter, searchQ])

  const eosbSelectedEmployee = useMemo(
    () => employees.find((e) => e.id === eosbEmpId) || employees[0],
    [employees, eosbEmpId],
  )

  const eosbCalculation = useMemo(
    () =>
      calculateKuwaitEosb({
        hireDate: eosbSelectedEmployee?.hireDate || '2020-03-01',
        lastWorkingDate: eosbLastDate,
        basicSalaryKwd: eosbSelectedEmployee?.basicSalary ?? 280,
        allowancesKwd: eosbSelectedEmployee?.allowances ?? 60,
        reason: eosbReason,
        unusedLeaveDays: Number(eosbUnusedLeaveDays) || 0,
        workedDaysInFinalMonth: Number(eosbWorkedDaysFinalMonth) || 0,
        outstandingLoanKwd: Number(eosbLoanBalance) || 0,
      }),
    [
      eosbSelectedEmployee,
      eosbLastDate,
      eosbReason,
      eosbUnusedLeaveDays,
      eosbWorkedDaysFinalMonth,
      eosbLoanBalance,
    ],
  )

  const pifssDeduction = calcIsKuwaitiPifss
    ? ((Number(calcBasic) || 0) + (Number(calcAllowances) || 0)) * 0.105
    : 0
  const calcNetSalary = Math.max(
    0,
    (Number(calcBasic) || 0) +
      (Number(calcAllowances) || 0) +
      (Number(calcOvertime) || 0) -
      (Number(calcLoans) || 0) -
      (Number(calcAbsencePenalties) || 0) -
      pifssDeduction,
  )

  async function dispatchInstantHrAlert(kind: 'residency_health' | 'overseas_arrival', candidateName?: string) {
    setAlertBusy(true)
    setAlertFeedback(null)
    try {
      const res = await fetch('/api/hr/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          candidateName,
        }),
      })
      const payload = (await res.json()) as {
        data?: { urgentCount?: number; timestamp?: string }
        error?: { message?: string }
      }
      if (!res.ok) throw new Error(payload.error?.message || 'Alert failed')
      setAlertFeedback(
        en
          ? `✅ Instant HR Compliance & Arrival Alert dispatched to: Sec@venturefoodskw.com, operations@venturefoodskw.com, abdelrahmanm@venturefoodskw.com & HR Manager Sheyam Hekmat (sheyamh@venturefoodskw.com).`
          : `✅ تم إرسال التنبيه الفوري بنجاح إلى الثلاثة المعتمدين (Sec@ · operations@ · abdelrahmanm@) ومديرة الموارد البشرية شيام حكمت (sheyamh@venturefoodskw.com).`,
      )
    } catch (err) {
      setAlertFeedback(
        err instanceof Error
          ? err.message
          : en
            ? 'Failed to dispatch alert'
            : 'تعذر إرسال التنبيه',
      )
    } finally {
      setAlertBusy(false)
    }
  }

  function handleAddOverseasCandidate(e: React.FormEvent) {
    e.preventDefault()
    if (!ovName.trim()) return
    const nextItem: OverseasCandidate = {
      id: `ov-${Date.now()}`,
      refCode: `OV-2026-${108 + candidates.length}`,
      fullNameEn: ovName.trim(),
      fullNameAr: ovName.trim(),
      nationalityEn: ovNationality,
      nationalityAr: ovNationality,
      passportNo: ovPassport.trim(),
      roleEn: ovRole.trim(),
      roleAr: ovRole.trim(),
      brandEn: ovBrand,
      brandAr: ovBrand,
      branchEn: ovBranch,
      branchAr: ovBranch,
      stage: 'REQUISITION',
      visa18Number: 'PAM-REQ-NEW',
      arrivalEta: '2026-12-20',
      agencyFeeKwd: Number(ovAgencyKwd) || 0,
      visaFeeKwd: Number(ovVisaKwd) || 0,
      medicalAndCardKwd: Number(ovMedicalKwd) || 0,
      flightTicketKwd: Number(ovFlightKwd) || 0,
      offeredBasicKwd: Number(ovSalaryKwd) || 0,
    }
    setCandidates((prev) => [nextItem, ...prev])
    setOvName('')
    setShowNewOverseasForm(false)
  }

  function advanceCandidateStage(id: string, nextStage: OverseasStage) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, stage: nextStage } : c)))
  }

  const totalPamCeiling = PAM_QUOTA_LIST.reduce((s, q) => s + q.allowedCeiling, 0)
  const totalPamRegistered = PAM_QUOTA_LIST.reduce((s, q) => s + q.registeredCount, 0)
  const totalPamVacancies = Math.max(0, totalPamCeiling - totalPamRegistered)

  return (
    <div className="space-y-6 text-mist-100" dir={en ? 'ltr' : 'rtl'} style={{ background: '#0a0d12' }}>
      {/* Executive Top Header */}
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#121824] via-[#0d1118] to-[#0a0d12] p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-300">
              {en
                ? 'Venture Foods Restaurant Management W.L.L. · Kuwait Labor Law No. 6/2010'
                : 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م. · قانون العمل الكويتي رقم 6 لسنة 2010'}
            </p>
            <h1 className="text-2xl font-black text-white sm:text-3xl">
              {en
                ? '🏛️ Enterprise HRMS & Overseas Recruitment Command Center'
                : '🏛️ منظومة الموارد البشرية والاستقدام الخارجي المتكاملة (Enterprise HRMS)'}
            </h1>
            <p className="max-w-3xl text-xs sm:text-sm text-mist-300">
              {en
                ? `6 Brands · 10 Branches & Central Kitchen · ${employees.length} Active Staff · 618 Contracts · 1,000 Odoo Payslips · PAM (Asahal) & Kuwait Municipality Linked`
                : `6 براندات · 10 فروع والمطبخ المركزي · ${employees.length} موظفاً مسجلاً · 618 عقد عمل · 1,000 قسيمة راتب مستوردة · ربط كامل مع القوى العاملة (أسهل) وبلدية الكويت`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="rounded-2xl bg-gradient-to-l from-[#8cc63f] to-[#10b981] px-5 py-3 text-xs sm:text-sm font-black text-ink-950 shadow-lg hover:brightness-110"
            >
              {en ? '➕ New Employee Wizard (4 Steps)' : '➕ إنشاء موظف جديد (New Employee Wizard)'}
            </button>
            <button
              type="button"
              disabled={alertBusy}
              onClick={() => void dispatchInstantHrAlert('residency_health')}
              className="rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-xs font-black text-amber-200 hover:bg-amber-500/25 disabled:opacity-50"
            >
              {alertBusy
                ? en
                  ? 'Sending Alert…'
                  : 'جارٍ الإرسال…'
                : en
                  ? '🔔 Alert 3 Approved + HR Manager (Sheyam)'
                  : '🔔 إرسال تنبيه الإقامات والوصول للثلاثة المعتمدين + مديرة الـ HR'}
            </button>
            <a
              href="/hr/smart-folder-upload"
              className="rounded-2xl border border-emerald-400/35 bg-emerald-950/40 px-4 py-3 text-xs font-bold text-emerald-200 hover:bg-emerald-950/60"
            >
              {en ? '📁 AI Smart HR Folder Upload' : '📁 رفع مجلد الموظفين الذكي'}
            </a>
            <a
              href="/ess"
              className="rounded-2xl border border-white/15 bg-[#11161f] px-4 py-3 text-xs font-bold text-mist-100 hover:border-white/30"
            >
              {en ? '📱 Employee Self-Service (/ess)' : '📱 بوابة الموظف الذاتية (/ess)'}
            </a>
          </div>
        </div>

        {/* Authorized Alert Recipients Banner */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5 text-[11px] text-mist-300">
          <span>
            {en
              ? '🛡️ Linked Compliance & Airport Arrival Dispatch Recipients:'
              : '🛡️ المستلمون المعتمدون لتنبيهات الإقامات وكروت البلدية ووصول العمالة من المطار:'}
          </span>
          <span className="font-mono text-emerald-300" dir="ltr">
            Sec@venturefoodskw.com · operations@venturefoodskw.com · abdelrahmanm@venturefoodskw.com · sheyamh@venturefoodskw.com (Sheyam Hekmat)
          </span>
        </div>

        {alertFeedback ? (
          <p className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-950/40 px-4 py-2.5 text-xs font-semibold text-emerald-100">
            {alertFeedback}
          </p>
        ) : null}
      </header>

      {/* 10 Specialized HR Command Tabs + 12 Reports Center */}
      <nav
        aria-label={en ? 'HR Command Tabs' : 'تبويبات منظومة الموارد البشرية'}
        className="flex flex-wrap gap-2 rounded-3xl border border-white/10 bg-[#0f141c] p-3"
      >
        {COMMAND_TABS.map((t) => {
          const isCurrent = activeTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`rounded-2xl px-3.5 py-2.5 text-xs font-black transition ${
                isCurrent
                  ? 'bg-gradient-to-l from-emerald-500 to-teal-500 text-ink-950 shadow-md shadow-emerald-950/50'
                  : 'border border-white/10 bg-[#141b26] text-mist-200 hover:border-emerald-400/40 hover:text-white'
              }`}
            >
              {t.icon} {en ? t.en : t.ar}
            </button>
          )
        })}
      </nav>

      {/* =====================================================================
          TAB 1: EMPLOYEES DIRECTORY & ODOO KANBAN CARDS WITH LEFT SIDEBAR
         ===================================================================== */}
      {activeTab === 'employees' ? (
        <section className="space-y-4">
          {/* Top 4 KPI Metrics */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-white/10 bg-[#0f141c] p-4">
              <p className="text-xs text-mist-400">
                {en ? 'Total Registered Employees (Odoo Sync)' : 'إجمالي الموظفين المسجلين (مستورد من Odoo)'}
              </p>
              <p className="mt-1 text-2xl font-black text-white">{VENTURE_EMPLOYEES.length}</p>
              <p className="mt-1 text-[11px] text-emerald-300">
                {en ? 'Across 6 Brands, 9 Locations & CK (Jahra Closed)' : 'موزعين على 6 براندات و9 مواقع والمطبخ المركزي (الجهراء مغلق)'}
              </p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-[#0f141c] p-4">
              <p className="text-xs text-mist-400">
                {en ? 'Historical Employment Contracts' : 'إجمالي عقود العمل المؤرشفة (hr.contract)'}
              </p>
              <p className="mt-1 text-2xl font-black text-gold-300">618</p>
              <p className="mt-1 text-[11px] text-mist-400">
                {en ? 'Kuwait Labor Law Art. 24 & 51 Compliant' : 'متوافقة مع قانون العمل الكويتي رقم 6/2010'}
              </p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-[#0f141c] p-4">
              <p className="text-xs text-mist-400">
                {en ? 'Historical Payslips (hr.payslip)' : 'قسائم الرواتب التاريخية المستوردة (hr.payslip)'}
              </p>
              <p className="mt-1 text-2xl font-black text-emerald-300">1,000</p>
              <p className="mt-1 text-[11px] text-mist-400">
                {en ? '3-Decimal Precision (0.000 KWD)' : 'بدقة 3 خانات عشرية (0.000 د.ك)'}
              </p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-[#0f141c] p-4">
              <p className="text-xs text-mist-400">
                {en ? 'Active Overseas Visa 18 Pipeline' : 'مرشحو الاستقدام الخارجي (فيزا 18 نشطة)'}
              </p>
              <p className="mt-1 text-2xl font-black text-sky-300">{candidates.length}</p>
              <p className="mt-1 text-[11px] text-mist-400">
                {en ? 'India · Philippines · Egypt · Nepal · Sri Lanka' : 'الهند · الفلبين · مصر · نيبال · سريلانكا'}
              </p>
            </article>
          </div>

          {/* Main Layout: Left Filter Sidebar + Employees Cards/Table Area */}
          <div className="flex flex-col lg:flex-row gap-5 items-start">
            {/* LEFT FILTER SIDEBAR (Exact Odoo/Walnut SS Design) */}
            <aside className="w-full lg:w-64 xl:w-72 shrink-0 space-y-4">
              {/* Department Filter Section */}
              <div className="rounded-3xl border border-white/10 bg-[#0f141c] p-4 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gold-300 flex items-center gap-1.5">
                    <span>🏢</span>
                    <span>{en ? 'DEPARTMENT' : 'الأقسام الإدارية'}</span>
                  </h3>
                  <span className="text-[10px] text-mist-400 font-mono">{en ? '166 Staff' : '166 موظفاً'}</span>
                </div>
                <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
                  {VENTURE_DEPARTMENTS.map((dept) => {
                    const isSelected = selectedDepartment === dept.key
                    return (
                      <button
                        key={dept.key}
                        type="button"
                        onClick={() => setSelectedDepartment(dept.key)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-start ${
                          isSelected
                            ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40 font-black shadow-sm'
                            : 'text-mist-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="truncate pr-1">
                          {dept.key === 'ALL'
                            ? en ? 'All Departments' : 'جميع الأقسام'
                            : isArabic ? dept.ar : dept.en}
                        </span>
                        <span
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-mono shrink-0 ${
                            isSelected ? 'bg-amber-400 text-black font-black' : 'bg-white/10 text-mist-300'
                          }`}
                        >
                          {dept.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Work Location Filter Section (NO JAHRA!) */}
              <div className="rounded-3xl border border-white/10 bg-[#0f141c] p-4 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gold-300 flex items-center gap-1.5">
                    <span>📍</span>
                    <span>{en ? 'WORK LOCATION' : 'مواقع العمل والفروع'}</span>
                  </h3>
                  <span className="text-[10px] text-mist-400 font-mono">{en ? '9 Locations' : '9 مواقع عمل'}</span>
                </div>
                <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
                  {VENTURE_WORK_LOCATIONS.map((loc) => {
                    const isSelected = selectedLocation === loc.key
                    return (
                      <button
                        key={loc.key}
                        type="button"
                        onClick={() => setSelectedLocation(loc.key)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-start ${
                          isSelected
                            ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 font-black shadow-sm'
                            : 'text-mist-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="truncate pr-1">
                          {loc.key === 'ALL'
                            ? en ? 'All Locations' : 'جميع مواقع العمل'
                            : isArabic ? loc.ar : loc.en}
                        </span>
                        <span
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-mono shrink-0 ${
                            isSelected ? 'bg-sky-400 text-black font-black' : 'bg-white/10 text-mist-300'
                          }`}
                        >
                          {loc.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </aside>

            {/* MAIN CONTENT AREA: SEARCH & CARDS / TABLE */}
            <div className="flex-1 w-full rounded-3xl border border-white/10 bg-[#0f141c] p-5 space-y-4">
              {/* Controls Bar: Search, Filters, View Mode Toggle, Count */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder={
                      en
                        ? 'Search by name, barcode, Civil ID, job title, or location…'
                        : 'بحث بالاسم، رقم البصمة، الرقم المدني، المسمى، أو الموقع…'
                    }
                    className="w-72 rounded-xl border border-white/15 bg-[#141b26] px-3.5 py-2 text-xs text-white placeholder-mist-500 focus:border-amber-400 focus:outline-none"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-xl border border-white/15 bg-[#141b26] px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="ALL">{en ? 'All Work Statuses' : 'جميع حالات العمل'}</option>
                    <option value="ACTIVE">{en ? 'Active on Duty' : 'على رأس العمل'}</option>
                    <option value="ON_VACATION">{en ? 'On Vacation Abroad' : 'في إجازة سفر خارج البلاد'}</option>
                  </select>

                  {(selectedDepartment !== 'ALL' || selectedLocation !== 'ALL' || searchQ) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDepartment('ALL')
                        setSelectedLocation('ALL')
                        setSearchQ('')
                        setStatusFilter('ALL')
                      }}
                      className="rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-mist-300 hover:text-white"
                    >
                      {en ? '✕ Reset Filters' : '✕ مسح الفلاتر'}
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* View Mode Toggle Buttons */}
                  <div className="flex items-center rounded-xl border border-white/15 bg-[#141b26] p-1">
                    <button
                      type="button"
                      onClick={() => setViewMode('cards')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        viewMode === 'cards'
                          ? 'bg-amber-500 text-black shadow-md'
                          : 'text-mist-300 hover:text-white'
                      }`}
                    >
                      <span>🪪</span>
                      <span>{en ? 'Cards View' : 'عرض البطاقات'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        viewMode === 'table'
                          ? 'bg-amber-500 text-black shadow-md'
                          : 'text-mist-300 hover:text-white'
                      }`}
                    >
                      <span>📋</span>
                      <span>{en ? 'Table View' : 'عرض الجدول'}</span>
                    </button>
                  </div>

                  <span className="text-xs text-mist-400 font-mono">
                    {en
                      ? `Showing ${filteredVentureEmployees.length} of ${VENTURE_EMPLOYEES.length}`
                      : `عرض ${filteredVentureEmployees.length} من أصل ${VENTURE_EMPLOYEES.length} موظفاً`}
                  </span>

                  <button
                    type="button"
                    onClick={() => setAutoMatcherOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/40 bg-sky-600/30 px-3.5 py-2 text-xs font-black text-sky-200 hover:bg-sky-500 hover:text-white transition-all shadow-md shadow-sky-950/40"
                  >
                    <span>📸</span>
                    <span>{en ? 'Sync Photos & Docs' : 'استيراد صور وأوراق الموظفين'}</span>
                  </button>

                  {canCreate ? (
                    <button
                      type="button"
                      onClick={() => setWizardOpen(true)}
                      className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-500 transition-colors"
                    >
                      {en ? '➕ New Employee Wizard' : '➕ إنشاء موظف جديد'}
                    </button>
                  ) : null}
                </div>
              </div>

              {/* VIEW 1: ODOO-STYLE PHOTO CARDS GRID */}
              {viewMode === 'cards' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 mt-2 max-h-[750px] overflow-y-auto pr-1">
                  {filteredVentureEmployees.map((emp) => (
                    <article
                      key={emp.id}
                      onClick={() => setSelectedProfileEmployee(emp)}
                      className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#121824] p-4 hover:border-amber-400/50 hover:bg-[#161f2e] transition-all cursor-pointer shadow-sm hover:shadow-xl"
                    >
                      <div>
                        {/* Card Top: Avatar, Status Dot, Flag, Barcode */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="relative group/avatar">
                              <div className="relative flex h-12 w-12 overflow-hidden rounded-xl border border-white/20 bg-[#162030] shadow-inner">
                                <img
                                  src={getEmployeeAvatarUrl(emp, customAvatars)}
                                  alt={emp.nameEn}
                                  className="h-full w-full object-cover transition-transform duration-200 group-hover/avatar:scale-105"
                                  loading="lazy"
                                  onError={(e) => {
                                    const target = e.currentTarget
                                    target.style.display = 'none'
                                    if (target.nextElementSibling) {
                                      (target.nextElementSibling as HTMLElement).style.display = 'flex'
                                    }
                                  }}
                                />
                                <div className="hidden h-full w-full items-center justify-center bg-gradient-to-br from-amber-500/20 via-sky-500/20 to-emerald-500/20 font-black text-white text-xs">
                                  {emp.nameEn
                                    .split(' ')
                                    .map((n) => n[0])
                                    .slice(0, 2)
                                    .join('')}
                                </div>

                                {/* 1-Click Upload Camera Overlay on Hover */}
                                <label
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer text-xs"
                                  title={en ? 'Upload photo for this employee' : 'رفع صورة لهذا الموظف'}
                                >
                                  <span>📷</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        handleSingleEmployeePhotoUpload(emp.code, e.target.files[0])
                                        e.target.value = ''
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                              <span
                                className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#121824] ${
                                  emp.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}
                                title={emp.status === 'ACTIVE' ? 'على رأس العمل' : 'في إجازة سفر'}
                              />
                            </div>

                            <div>
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-xs font-black text-amber-300">
                                  #{emp.code}
                                </span>
                                <span className="text-sm" title={emp.nationalityAr}>
                                  {emp.flag}
                                </span>
                              </div>
                              <span className="text-[10px] text-mist-400 block font-mono" dir="ltr">
                                {emp.phone}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              emp.status === 'ACTIVE'
                                ? 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                                : 'border border-amber-400/30 bg-amber-500/10 text-amber-300'
                            }`}
                          >
                            {emp.status === 'ACTIVE'
                              ? en ? 'On Duty' : 'على رأس العمل'
                              : en ? 'Vacation' : 'في إجازة'}
                          </span>
                        </div>

                        {/* Names: Arabic prominent + English beneath */}
                        <div className="mt-3">
                          <h4 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                            {isArabic ? emp.nameAr : emp.nameEn}
                          </h4>
                          <p className="text-[11px] text-mist-400 font-medium line-clamp-1" dir="ltr">
                            {emp.nameEn}
                          </p>
                        </div>

                        {/* Job Title & Department & Location */}
                        <div className="mt-2.5 space-y-1">
                          <p className="text-xs font-bold text-amber-200/90 line-clamp-1">
                            💼 {isArabic ? emp.jobTitleAr : emp.jobTitleEn}
                          </p>
                          <p className="text-[11px] text-mist-300 line-clamp-1">
                            🏢 {isArabic ? emp.departmentAr : emp.department}
                          </p>
                          <p className="text-[11px] text-mist-400 line-clamp-1">
                            📍 {isArabic ? emp.workLocationAr : emp.workLocation}
                          </p>
                        </div>

                        {/* Identifiers & Salary */}
                        <div className="mt-3 pt-2.5 border-t border-white/5 space-y-1 text-[11px]">
                          <div className="flex items-center justify-between text-mist-300">
                            <span className="font-mono text-mist-400 text-[10px]" dir="ltr">
                              ID: {emp.civilId}
                            </span>
                            <span className="font-mono text-emerald-300 font-bold" dir="ltr">
                              {emp.netSalary.toFixed(3)} KWD
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedProfileEmployee(emp)
                          }}
                          className="flex-1 rounded-xl bg-amber-500/15 border border-amber-500/30 py-1.5 text-center text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-colors"
                        >
                          {en ? '🪪 360° Profile' : '🪪 عرض الملف الشامل'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedDossierEmpId(emp.id)
                          }}
                          className="rounded-xl bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs font-medium text-mist-300 hover:bg-white/10 hover:text-white transition-colors"
                          title={en ? 'Digital Dossier' : 'الخزانة الرقمية'}
                        >
                          📂
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              {/* VIEW 2: FINANCIAL & BARCODE TABLE */}
              {viewMode === 'table' ? (
                <div className="mt-2 max-h-[700px] overflow-auto rounded-2xl border border-white/10">
                  <table className="min-w-[980px] w-full text-xs">
                    <thead className="sticky top-0 bg-[#0a0d12] text-mist-400 z-10">
                      <tr>
                        <th className="px-3 py-2.5 text-start">{en ? 'Barcode' : 'رقم البصمة'}</th>
                        <th className="px-3 py-2.5 text-start">{en ? 'Employee Name' : 'اسم الموظف'}</th>
                        <th className="px-3 py-2.5 text-start">{en ? 'Job Title' : 'المسمى الوظيفي'}</th>
                        <th className="px-3 py-2.5 text-start">{en ? 'Department & Location' : 'القسم ومقر العمل'}</th>
                        <th className="px-3 py-2.5 text-start">{en ? 'Basic (KWD)' : 'الأساسي'}</th>
                        <th className="px-3 py-2.5 text-start">{en ? 'Allowances' : 'البدلات'}</th>
                        <th className="px-3 py-2.5 text-start">{en ? 'Net Package' : 'الصافي'}</th>
                        <th className="px-3 py-2.5 text-start">{en ? 'Status & Actions' : 'الحالة والإجراء'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVentureEmployees.map((emp) => (
                        <tr
                          key={emp.id}
                          onClick={() => setSelectedProfileEmployee(emp)}
                          className="border-t border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer"
                        >
                          <td className="px-3 py-2.5 font-mono font-bold text-amber-300" dir="ltr">
                            #{emp.code}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-[#162030]">
                                <img
                                  src={getEmployeeAvatarUrl(emp, customAvatars)}
                                  alt={emp.nameEn}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    const target = e.currentTarget
                                    target.style.display = 'none'
                                    if (target.nextElementSibling) {
                                      (target.nextElementSibling as HTMLElement).style.display = 'flex'
                                    }
                                  }}
                                />
                                <div className="hidden h-full w-full items-center justify-center bg-white/5 text-[10px] font-bold text-white">
                                  {emp.nameEn.slice(0, 2)}
                                </div>
                              </div>
                              <div>
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span>{isArabic ? emp.nameAr : emp.nameEn}</span>
                                  <span className="text-xs">{emp.flag}</span>
                                </div>
                                <div className="text-[10px] text-mist-400 font-medium" dir="ltr">
                                  {emp.nameEn}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-mist-200">
                            <div>{isArabic ? emp.jobTitleAr : emp.jobTitleEn}</div>
                            <div className="text-[10px] text-mist-400" dir="ltr">{emp.phone}</div>
                          </td>
                          <td className="px-3 py-2.5 text-mist-300">
                            <div>{isArabic ? emp.departmentAr : emp.department}</div>
                            <div className="text-[10px] text-mist-400">📍 {isArabic ? emp.workLocationAr : emp.workLocation}</div>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-mist-200" dir="ltr">
                            {emp.basicSalary.toFixed(3)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-mist-200" dir="ltr">
                            {emp.allowances.toFixed(3)}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-bold text-emerald-300" dir="ltr">
                            {emp.netSalary.toFixed(3)} KWD
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                                  emp.status === 'ACTIVE'
                                    ? 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                                    : 'border border-amber-400/30 bg-amber-500/10 text-amber-300'
                                }`}
                              >
                                {emp.status === 'ACTIVE' ? (en ? 'On Duty' : 'على رأس العمل') : (en ? 'Vacation' : 'في إجازة')}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedProfileEmployee(emp)
                                }}
                                className="rounded-lg border border-amber-400/30 bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-200 hover:bg-amber-500/30"
                              >
                                {en ? '360° Profile' : 'الملف الشامل'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>

          {/* Full 360° Employee Profile Modal */}
          <EmployeeProfileModal360
            employee={selectedProfileEmployee}
            isOpen={selectedProfileEmployee !== null}
            onClose={() => setSelectedProfileEmployee(null)}
            locale={locale}
          />

          {/* Digital Dossier View if triggered */}
          {selectedDossierEmpId ? (
            <div className="rounded-3xl border border-emerald-400/30 bg-[#0f141c] p-5 mt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-black text-emerald-200">
                  {en ? '📂 Employee Digital Dossier & Archived Documents' : '📂 الخزانة الرقمية ومستندات الموظف'}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedDossierEmpId(null)}
                  className="text-xs text-mist-400 hover:text-white"
                >
                  {en ? 'Close ✕' : 'إغلاق ✕'}
                </button>
              </div>
              <HrDigitalDossier employeeId={selectedDossierEmpId} locale={locale} />
            </div>
          ) : null}
        </section>
      ) : null}

      {/* =====================================================================
          TAB 2: ODOO SHIFT PLANNING GANTT, WORKFORCE UNITS & SALARY BENCHMARKS
         ===================================================================== */}
      {activeTab === 'planningGantt' ? (
        <section className="space-y-6">
          <OdooPlanningGanttView locale={en ? 'en' : 'ar'} />
        </section>
      ) : null}

      {/* =====================================================================
          TAB 4: EMPLOYEE EXPENSE SHEETS & RESIDENCY TRACKING
         ===================================================================== */}
      {activeTab === 'expensesCustody' ? (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0f141c] p-6 rounded-3xl border border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
                  💼 {en ? 'Employee Expense Sheets & Custodies' : 'تقارير عهد ومصروفات الموظفين والإقامات'}
                </span>
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
                  {en ? 'Odoo hr.expense.sheet Sync' : 'مطابقة شاشة تصفية العهد Odoo'}
                </span>
              </div>
              <h2 className="mt-2 text-xl font-black text-white">
                {en
                  ? 'Employee Operational Custodies, Expense Reports & Sanad Clearances'
                  : 'كشوفات عهد الموظفين التشغيلية ومصروفات الإقامات والبلدية الموثقة'}
              </h2>
              <p className="text-xs text-mist-400 mt-1 max-w-2xl">
                {en
                  ? 'Central monitoring for all 9 official petty cash holders, municipal permits, and PAM work permits clearances linked directly to accounting.'
                  : 'متابعة مركزية لتقارير تصفية العهد الـ 9 الرسمية وتراخيص البلدية وأذونات العمل وربطها المباشر بقسم المحاسبة.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHrExpenseSingleModal(true)}
                className="flex items-center gap-1.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs sm:text-sm font-black text-emerald-400 hover:bg-emerald-500/20 shadow-sm transition-all"
              >
                <span>➕</span>
                <span>{en ? 'New Single Expense' : 'تسجيل مصروف فردي جديد'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedHrSheetForModal(null)
                  setShowHrExpenseSheetModal(true)
                }}
                className="flex items-center gap-1.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs sm:text-sm font-black text-amber-300 hover:bg-amber-500/20 shadow-sm transition-all"
              >
                <span>📑</span>
                <span>{en ? 'New Expense Report Sheet' : 'إنشاء تقرير تصفية عهدة مجمع'}</span>
              </button>

              <Link
                href="/accounting?tab=pettyCash"
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-emerald-500 to-teal-500 px-5 py-3 text-xs sm:text-sm font-black text-ink-950 shadow-lg hover:brightness-110"
              >
                <span>🏛️</span>
                <span>{en ? 'Open Accounting Petty Cash Hub ↵' : 'فتح مركز تسوية العهد بالمحاسبة ↵'}</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-[#0f141c] p-4">
              <p className="text-xs text-mist-400">{en ? 'Total Custodians' : 'أصحاب العهد المعتمدون'}</p>
              <p className="mt-1 text-2xl font-black text-white">9</p>
              <p className="mt-1 text-[11px] text-emerald-300">{en ? 'Across Ops, Kitchen, HR & PRO' : 'العمليات، الصيانة، الموارد البشرية والتعقيب'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0f141c] p-4">
              <p className="text-xs text-mist-400">{en ? 'Total Audited Custody OPEX' : 'إجمالي المصروفات المدققة'}</p>
              <p className="mt-1 text-2xl font-black text-emerald-300">51,154.950 {en ? 'KWD' : 'د.ك'}</p>
              <p className="mt-1 text-[11px] text-mist-400">{en ? '2,213 Audited Transactions' : '2,213 معاملة مدققة'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0f141c] p-4">
              <p className="text-xs text-mist-400">{en ? 'Submitted Expense Sheets' : 'تقارير التصفية المرفوعة'}</p>
              <p className="mt-1 text-2xl font-black text-amber-300">{ODOO_REAL_EXPENSE_SHEETS.length}</p>
              <p className="mt-1 text-[11px] text-mist-400">{en ? 'All Reports Odoo Module' : 'شاشة All Reports الرسمية'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0f141c] p-4">
              <p className="text-xs text-mist-400">{en ? 'Sanad Clearances & Residencies' : 'كشوفات سند للإقامات'}</p>
              <p className="mt-1 text-2xl font-black text-sky-300">{ODOO_SANAD_STATEMENT_DETAILS.length}</p>
              <p className="mt-1 text-[11px] text-mist-400">{en ? 'Health Insurance & PAM Permits' : 'الضمان الصحي وأذونات العمل'}</p>
            </div>
          </div>

          {/* Custodians Summary Cards */}
          <div className="rounded-3xl border border-white/10 bg-[#0f141c] p-5">
            <h3 className="text-base font-black text-white mb-3">
              {en ? '👥 Official Petty Cash Custodians & Expense Ledgers' : '👥 أصحاب العهد التشغيلية المعتمدون في الشركة'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ODOO_CUSTODIANS_7.map((c) => (
                <div key={c.id} className="rounded-2xl border border-white/10 bg-[#141b26] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{en ? c.nameEn : c.nameAr}</span>
                    <span className="font-mono text-xs font-black text-emerald-400">{c.totalKwd.toFixed(3)} {en ? 'KWD' : 'د.ك'}</span>
                  </div>
                  <p className="text-[11px] text-mist-400">{en ? c.roleEn : c.roleAr}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-white/5 font-mono">
                    <span>{c.txCount} {en ? 'txns' : 'معاملة'}</span>
                    <span className="text-amber-400">{c.accountCode}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Odoo Expense Sheets Table Preview */}
          <div className="rounded-3xl border border-white/10 bg-[#0f141c] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">
                {en ? '📋 Recent Staff Expense Reports (Odoo hr.expense.sheet)' : '📋 تقارير تصفية العهد المرفوعة للأقسام والفروع'}
              </h3>
              <Link
                href="/accounting?tab=pettyCash"
                className="text-xs text-emerald-400 hover:underline font-bold"
              >
                {en ? 'View & Pay in Accounting ↵' : 'عرض واعتماد وصرف الشيكات بالمحاسبة ↵'}
              </Link>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="bg-black/40 text-mist-400 font-bold">
                  <tr>
                    <th className="px-3 py-2.5 text-start">{en ? 'Report No & Date' : 'رقم التقرير والتاريخ'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Custodian' : 'صاحب العهدة'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Description & Works' : 'بيان التقرير والأعمال'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Cost Center' : 'مركز التكلفة'}</th>
                    <th className="px-3 py-2.5 text-end">{en ? 'Amount (KWD)' : 'المبلغ (د.ك)'}</th>
                    <th className="px-3 py-2.5 text-center">{en ? 'Approval' : 'الاعتماد'}</th>
                    <th className="px-3 py-2.5 text-center">{en ? 'Payment Status' : 'حالة السداد'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {hrExpenseSheets.slice(0, 10).map((sheet) => (
                    <tr key={sheet.id} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 font-mono">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedHrSheetForModal(sheet)
                            setShowHrExpenseSheetModal(true)
                          }}
                          className="text-amber-300 font-bold hover:underline"
                        >
                          {sheet.reportNo}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-white">{en ? sheet.custodianNameEn : sheet.custodianNameAr}</td>
                      <td className="px-3 py-2.5 max-w-xs truncate">{en ? sheet.titleEn : sheet.titleAr}</td>
                      <td className="px-3 py-2.5 text-slate-400">{en ? sheet.costCenterEn : sheet.costCenterAr}</td>
                      <td className="px-3 py-2.5 text-end font-mono font-bold text-emerald-400">{sheet.amountKwd.toFixed(3)} {en ? 'KWD' : 'د.ك'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          sheet.adminApproval === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {sheet.adminApproval === 'approved' ? (en ? '🟢 Approved' : '🟢 معتمد إدارياً') : (en ? '🔵 Submitted' : '🔵 مرسل للاعتماد')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          sheet.paymentStatus === 'paid' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}>
                          {sheet.paymentStatus === 'paid' ? (en ? '🟢 Paid' : '🟢 تم الدفع') : (en ? '🔴 Not Paid' : '🔴 غير مدفوع')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {/* =====================================================================
          TAB 3: OVERSEAS RECRUITMENT & VISA 18 PIPELINE + PAM QUOTA TRACKER
         ===================================================================== */}
      {activeTab === 'recruitment' ? (
        <section className="space-y-6">
          {/* PAM Quota Tracker */}
          <div className="rounded-3xl border border-white/10 bg-[#0f141c] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gold-300">
                  {en
                    ? 'Public Authority for Manpower (PAM / Asahal) — License Quota Tracker'
                    : 'الهيئة العامة للقوى العاملة (بوابة أسهل) — لوحة كوتا وتقدير الاحتياج للرخص والفروع'}
                </p>
                <h2 className="mt-1 text-lg font-black text-white">
                  {en
                    ? `PAM Ceiling: ${totalPamCeiling} · Registered: ${totalPamRegistered} · Available Vacancies: ${totalPamVacancies}`
                    : `سقف تقدير الاحتياج: ${totalPamCeiling} · المسجلون حالياً: ${totalPamRegistered} · الشواغر المتاحة للاستقدام: ${totalPamVacancies}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowNewOverseasForm((v) => !v)}
                className="rounded-2xl bg-gradient-to-l from-emerald-500 to-teal-500 px-5 py-2.5 text-xs font-black text-ink-950 shadow-lg hover:brightness-110"
              >
                {en
                  ? '➕ Request New Overseas Worker (Visa 18)'
                  : '➕ طلب استقدام عامل جديد من الخارج (فيزا 18)'}
              </button>
            </div>

            {showNewOverseasForm ? (
              <form
                onSubmit={handleAddOverseasCandidate}
                className="mt-4 grid gap-3 rounded-2xl border border-emerald-400/30 bg-[#131a26] p-4 sm:grid-cols-4"
              >
                <input
                  required
                  value={ovName}
                  onChange={(e) => setOvName(e.target.value)}
                  placeholder={en ? 'Candidate Full Name' : 'اسم المرشح الكامل'}
                  className="rounded-xl border border-white/15 bg-[#0d1118] px-3 py-2 text-xs text-white"
                />
                <select
                  value={ovNationality}
                  onChange={(e) => setOvNationality(e.target.value)}
                  className="rounded-xl border border-white/15 bg-[#0d1118] px-3 py-2 text-xs text-white"
                >
                  <option value="India">{en ? 'India' : 'الهند (India)'}</option>
                  <option value="Philippines">{en ? 'Philippines' : 'الفلبين (Philippines)'}</option>
                  <option value="Egypt">{en ? 'Egypt' : 'مصر (Egypt)'}</option>
                  <option value="Nepal">{en ? 'Nepal' : 'نيبال (Nepal)'}</option>
                  <option value="Sri Lanka">{en ? 'Sri Lanka' : 'سريلانكا (Sri Lanka)'}</option>
                  <option value="Bangladesh">{en ? 'Bangladesh' : 'بنغلاديش (Bangladesh)'}</option>
                </select>
                <input
                  value={ovPassport}
                  onChange={(e) => setOvPassport(e.target.value)}
                  placeholder={en ? 'Passport Number' : 'رقم الجواز'}
                  className="rounded-xl border border-white/15 bg-[#0d1118] px-3 py-2 text-xs font-mono text-white"
                />
                <input
                  value={ovRole}
                  onChange={(e) => setOvRole(e.target.value)}
                  placeholder={en ? 'Job Role (e.g. Wok Chef)' : 'المهنة المطلوبة'}
                  className="rounded-xl border border-white/15 bg-[#0d1118] px-3 py-2 text-xs text-white"
                />
                <input
                  value={ovBrand}
                  onChange={(e) => setOvBrand(e.target.value)}
                  placeholder={en ? 'Brand' : 'البراند'}
                  className="rounded-xl border border-white/15 bg-[#0d1118] px-3 py-2 text-xs text-white"
                />
                <input
                  value={ovBranch}
                  onChange={(e) => setOvBranch(e.target.value)}
                  placeholder={en ? 'Branch' : 'الفرع'}
                  className="rounded-xl border border-white/15 bg-[#0d1118] px-3 py-2 text-xs text-white"
                />
                <input
                  dir="ltr"
                  value={ovAgencyKwd}
                  onChange={(e) => setOvAgencyKwd(e.target.value)}
                  placeholder={en ? 'Agency Fee KWD' : 'رسوم المكتب د.ك'}
                  className="rounded-xl border border-white/15 bg-[#0d1118] px-3 py-2 text-xs font-mono text-white"
                />
                <input
                  dir="ltr"
                  value={ovFlightKwd}
                  onChange={(e) => setOvFlightKwd(e.target.value)}
                  placeholder={en ? 'Flight Ticket KWD' : 'تذكرة الطيران د.ك'}
                  className="rounded-xl border border-white/15 bg-[#0d1118] px-3 py-2 text-xs font-mono text-white"
                />
                <div className="sm:col-span-4 flex items-center justify-between">
                  <span className="text-xs text-emerald-300" dir="ltr">
                    {en ? 'Estimated Total Recruitment Cost:' : 'إجمالي تكلفة الاستقدام التقديرية:'}{' '}
                    {(
                      (Number(ovAgencyKwd) || 0) +
                      (Number(ovVisaKwd) || 0) +
                      (Number(ovMedicalKwd) || 0) +
                      (Number(ovFlightKwd) || 0)
                    ).toFixed(3)}{' '}
                    KWD
                  </span>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black text-white hover:bg-emerald-500"
                  >
                    {en ? 'Save Overseas Requisition' : 'اعتماد وإضافة لخط الاستقدام'}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[880px] w-full text-xs">
                <thead className="bg-black/40 text-mist-400">
                  <tr>
                    <th className="px-3 py-2 text-start">{en ? 'License Code' : 'كود الرخصة'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'PAM File No' : 'رقم ملف القوى العاملة'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Brand & Branch' : 'البراند والفرع'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Allowed PAM Ceiling' : 'السقف المسموح (تقدير الاحتياج)'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Registered Staff' : 'المسجلون حالياً'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Open Overseas Visas' : 'فيز خارجية قيد الإجراء'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Available Quota Vacancies' : 'الشواغر المتاحة'}</th>
                  </tr>
                </thead>
                <tbody>
                  {PAM_QUOTA_LIST.map((q) => {
                    const avail = Math.max(0, q.allowedCeiling - q.registeredCount)
                    return (
                      <tr key={q.licenseCode} className="border-t border-white/5">
                        <td className="px-3 py-2.5 font-mono font-bold text-gold-300" dir="ltr">
                          {q.licenseCode}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-mist-300" dir="ltr">
                          {q.pamFileNumber}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-white">
                          {en ? `${q.brandEn} · ${q.branchEn}` : `${q.brandAr} · ${q.branchAr}`}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-white">{q.allowedCeiling}</td>
                        <td className="px-3 py-2.5 font-mono text-mist-200">{q.registeredCount}</td>
                        <td className="px-3 py-2.5 font-mono text-sky-300">{q.openOverseasVisas}</td>
                        <td className="px-3 py-2.5">
                          <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono font-bold text-emerald-300">
                            {avail} {en ? 'open slots' : 'شاغر متاح'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 7-Stage Overseas Recruitment Pipeline */}
          <div className="rounded-3xl border border-white/10 bg-[#0f141c] p-5">
            <h3 className="text-base font-black text-white">
              {en
                ? '✈️ 7-Stage Overseas Recruitment & Visa 18 Pipeline (India, Philippines, Egypt, Nepal, Sri Lanka, Bangladesh)'
                : '✈️ خط أنابيب الاستقدام الخارجي وفيزا مادة 18 (7 مراحل من طلب الاحتياج حتى البطاقة المدنية)'}
            </h3>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {OVERSEAS_STAGES.map((stg) => {
                const count = candidates.filter((c) => c.stage === stg.key).length
                return (
                  <div key={stg.key} className={`rounded-2xl border p-3 ${stg.badgeColor}`}>
                    <p className="text-[11px] font-bold">{en ? stg.en : stg.ar}</p>
                    <p className="mt-1 text-xl font-black">{count}</p>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[980px] w-full text-xs">
                <thead className="bg-black/40 text-mist-400">
                  <tr>
                    <th className="px-3 py-2 text-start">{en ? 'Ref & Passport' : 'المرجع والجواز'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Candidate & Country' : 'اسم المرشح والدولة'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Role & Target Branch' : 'المهنة والفرع الطالب'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Current Pipeline Stage (1–7)' : 'المرحلة الحالية (1–7)'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Visa 18 & Arrival ETA' : 'رقم فيزا 18 وموعد الوصول'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Landing Cost (0.000 KWD)' : 'تكلفة الاستقدام (0.000 د.ك)'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Actions' : 'إجراءات'}</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => {
                    const totalCost =
                      c.agencyFeeKwd + c.visaFeeKwd + c.medicalAndCardKwd + c.flightTicketKwd
                    return (
                      <tr key={c.id} className="border-t border-white/5 align-top">
                        <td className="px-3 py-3 font-mono" dir="ltr">
                          <p className="font-bold text-gold-300">{c.refCode}</p>
                          <p className="text-[11px] text-mist-400">Pass: {c.passportNo}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-bold text-white">{en ? c.fullNameEn : c.fullNameAr}</p>
                          <p className="text-[11px] text-emerald-300">
                            🌍 {en ? c.nationalityEn : c.nationalityAr}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-mist-100">{en ? c.roleEn : c.roleAr}</p>
                          <p className="text-[11px] text-mist-400">
                            {en ? `${c.brandEn} · ${c.branchEn}` : `${c.brandAr} · ${c.branchAr}`}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={c.stage}
                            onChange={(e) =>
                              advanceCandidateStage(c.id, e.target.value as OverseasStage)
                            }
                            className="rounded-xl border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs text-white"
                          >
                            {OVERSEAS_STAGES.map((s) => (
                              <option key={s.key} value={s.key}>
                                {en ? s.en : s.ar}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3 font-mono" dir="ltr">
                          <p className="text-sky-300">{c.visa18Number}</p>
                          <p className="text-[11px] text-mist-400">ETA: {c.arrivalEta}</p>
                        </td>
                        <td className="px-3 py-3 font-mono" dir="ltr">
                          <p className="font-bold text-emerald-300">{totalCost.toFixed(3)} KWD</p>
                          <p className="text-[10px] text-mist-400">
                            Salary: {c.offeredBasicKwd.toFixed(3)} KWD
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              void dispatchInstantHrAlert('overseas_arrival', c.fullNameEn)
                            }
                            className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25"
                          >
                            {en ? '✈️ Alert Airport Arrival' : '✈️ إشعار وصول المطار'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {/* =====================================================================
          TAB 3: RESIDENCY, MUNICIPALITY HEALTH CARDS & PRO / MANDOUB QUEUE
         ===================================================================== */}
      {activeTab === 'residency' ? (
        <section className="space-y-6">
          {/* Mandoub / PRO Daily Action Queue */}
          <div className="rounded-3xl border border-white/10 bg-[#0f141c] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {en
                    ? 'Daily Government Relations (GRO / Mandoub) Action Queue'
                    : 'جدول مهام المندوب اليومي (أسهل · القوى العاملة · شؤون الإقامة · البلدية · البطاقة المدنية)'}
                </p>
                <h2 className="mt-1 text-lg font-black text-white">
                  {en
                    ? '🆔 Active Government Transactions & Official Renewal Fees (KWD)'
                    : '🆔 المعاملات الحكومية الجارية ورسوم التجديد الرسمية بالدينار الكويتي'}
                </h2>
              </div>
              <a
                href="/hr/compliance-radar"
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-ink-950 hover:bg-amber-400"
              >
                {en ? '🛡️ Open Full Compliance Radar' : '🛡️ فتح رادار الامتثال الكامل'}
              </a>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[920px] w-full text-xs">
                <thead className="bg-black/40 text-mist-400">
                  <tr>
                    <th className="px-3 py-2 text-start">{en ? 'Tx Ref' : 'رقم المعاملة'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Employee' : 'الموظف'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Authority' : 'الجهة الحكومية'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Transaction Description' : 'تفاصيل المعاملة'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Gov Fee (KWD)' : 'الرسوم الحكومية'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Due Date & PRO' : 'موعد الإنجاز والمندوب'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Status' : 'الحالة'}</th>
                  </tr>
                </thead>
                <tbody>
                  {MANDOUB_PRO_QUEUE.map((task) => (
                    <tr key={task.id} className="border-t border-white/5">
                      <td className="px-3 py-2.5 font-mono font-bold text-gold-300" dir="ltr">
                        {task.txCode}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-white">
                        [{task.employeeCode}] {en ? task.employeeNameEn : task.employeeNameAr}
                      </td>
                      <td className="px-3 py-2.5 text-emerald-300">
                        {en ? task.authorityEn : task.authorityAr}
                      </td>
                      <td className="px-3 py-2.5 text-mist-200">
                        {en ? task.taskEn : task.taskAr}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-white" dir="ltr">
                        {task.govFeeKwd.toFixed(3)} KWD
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-mist-300" dir="ltr">
                        {task.dueDate} · {task.assignedPro}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-lg border border-sky-400/30 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                          {task.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unified Expiry Ledger */}
          <div className="rounded-3xl border border-white/10 bg-[#0f141c] p-5">
            <h3 className="text-base font-black text-white">
              {en
                ? '📋 Unified Expiry Matrix (Article 18 Residency, PAM Work Permit, Civil ID, Passport, Municipality Health Card & Driver License)'
                : '📋 الكشف الموحد لتواريخ انتهاء (الإقامة مادة 18، إذن العمل، البطاقة المدنية، الجواز، كرت صحة البلدية، ورخصة القيادة)'}
            </h3>
            <div className="mt-4 max-h-[480px] overflow-auto">
              <table className="min-w-[960px] w-full text-xs">
                <thead className="sticky top-0 bg-[#0a0d12] text-mist-400">
                  <tr>
                    <th className="px-3 py-2 text-start">{en ? 'Barcode & Name' : 'الباركود والاسم'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Civil ID & Residency (Art. 18)' : 'البطاقة المدنية والإقامة'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'PAM Work Permit' : 'إذن العمل (أسهل)'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Municipality Health Card' : 'شهادة صحة البلدية'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Passport Expiry' : 'انتهاء جواز السفر'}</th>
                    <th className="px-3 py-2 text-start">{en ? 'Remaining Days' : 'عداد الأيام المتبقية'}</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.slice(0, 80).map((emp) => {
                    const civExp = emp.civilIdExpiry || '2027-04-15'
                    const wpExp = emp.workPermitExpiry || civExp
                    const hcExp = emp.healthCardExpiry || '2027-01-20'
                    const passExp = emp.passportExpiry || '2028-09-30'
                    const minDays = Math.min(
                      daysUntil(civExp) ?? 365,
                      daysUntil(hcExp) ?? 365,
                      daysUntil(wpExp) ?? 365,
                    )
                    return (
                      <tr key={emp.id} className="border-t border-white/5">
                        <td className="px-3 py-2.5">
                          <p className="font-bold text-white">
                            [{emp.code}] {emp.name}
                          </p>
                          <p className="text-[11px] text-mist-400">{emp.department}</p>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-mist-200" dir="ltr">
                          {civExp}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-mist-200" dir="ltr">
                          {wpExp}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-emerald-300" dir="ltr">
                          {hcExp}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-mist-200" dir="ltr">
                          {passExp}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold" dir="ltr">
                          <span
                            className={`rounded-lg px-2 py-0.5 text-[11px] ${
                              minDays <= 30
                                ? 'bg-red-500/20 text-red-300'
                                : minDays <= 60
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-emerald-500/15 text-emerald-300'
                            }`}
                          >
                            {minDays} {en ? 'days' : 'يوماً'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {/* =====================================================================
          TAB 4: PAYROLL, PAYSLIPS & NBK WPS
         ===================================================================== */}
      {activeTab === 'payroll' ? (
        <section className="space-y-6">
          {/* Approved Leadership & Key Roles Salary Benchmarks (Odoo Official Scale) */}
          <div className="rounded-3xl border border-amber-500/30 bg-[#0f141c] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
                    💼 {en ? 'Approved Leadership Salary Benchmarks' : 'سلم الرواتب المعتمدة للوظائف والقيادات'}
                  </span>
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
                    {en ? '10 Key Leadership Positions' : '10 وظائف رئيسية من لوحة أودو الرسمية'}
                  </span>
                </div>
                <h3 className="mt-1 text-lg font-black text-white">
                  {en
                    ? 'Executive & Operational Leadership Compensation Benchmark (WPS Registered)'
                    : 'هيكل الرواتب المعتمدة للقيادات والوظائف التشغيلية (المسجلة في WPS بنك الكويت الوطني)'}
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="px-4 py-3 text-center w-12">#</th>
                    <th className="px-4 py-3 text-start">{en ? 'Position / Role' : 'المسمى الوظيفي والمسؤولية'}</th>
                    <th className="px-4 py-3 text-center">{en ? 'Department Unit' : 'القطاع الإداري'}</th>
                    <th className="px-4 py-3 text-center">{en ? 'Organizational Tier' : 'الدرجة التنظيمية'}</th>
                    <th className="px-4 py-3 text-end">{en ? 'Approved Salary (KWD)' : 'الراتب المعتمد (د.ك)'}</th>
                    <th className="px-4 py-3 text-center">{en ? 'WPS Status' : 'حالة الاعتماد'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {ODOO_LEADERSHIP_SALARY_BENCHMARKS.map((item) => (
                    <tr key={item.rank} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-center font-mono text-slate-500 font-bold">{item.rank}</td>
                      <td className="px-4 py-3">
                        <span className="font-black text-white block">{en ? item.roleEn : item.roleAr}</span>
                        <span className="text-[10px] text-slate-400">{en ? item.roleAr : item.roleEn}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 font-semibold border border-slate-700">
                          {en ? item.categoryEn : item.categoryAr}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-amber-300">
                        {en ? item.levelEn : item.levelAr}
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-black text-emerald-400 text-sm">
                        {item.salaryKwd.toFixed(3)} {en ? 'KWD' : 'د.ك'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                          <span>✓</span>
                          {en ? item.statusEn : item.statusAr}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Interactive Kuwait Payroll & PIFSS Calculator */}
          <div className="rounded-3xl border border-emerald-400/30 bg-[#0f141c] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  {en
                    ? 'Automated Kuwait Payroll & PIFSS Calculator (0.000 KWD)'
                    : 'حاسبة المسير التلقائية وحماية الأجور والتأمينات الاجتماعية للكويتيين (PIFSS)'}
                </p>
                <h2 className="mt-1 text-lg font-black text-white">
                  {en
                    ? '💰 Monthly Payroll Engine · NBK WPS SIF Export · Official Payslips'
                    : '💰 محرك الرواتب الشهري (الأساسي + البدلات + الإضافي − السلف − الغياب والجزاءات − التأمينات PIFSS)'}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/hr/wps-export?month=${month}&year=${year}&download=1`}
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs font-black text-ink-950 shadow-md hover:brightness-110"
                >
                  {en
                    ? '🏦 Export NBK WPS SIF File'
                    : '🏦 تصدير ملف حماية الأجور للبنك الوطني NBK WPS SIF'}
                </a>
                {canEdit ? (
                  <button
                    type="button"
                    disabled={payrollBusy}
                    onClick={async () => {
                      setPayrollBusy(true)
                      const res = await generatePayrollAction(year, month)
                      setPayrollBusy(false)
                      setPayrollNotice(res.message || null)
                      router.refresh()
                    }}
                    className="rounded-xl border border-gold-300/40 bg-gold-400/15 px-4 py-2.5 text-xs font-black text-gold-200 hover:bg-gold-400/25"
                  >
                    {en ? `⚙️ Generate ${month}/${year} Payroll` : `⚙️ توليد مسير شهر ${month}/${year}`}
                  </button>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    disabled={payrollBusy}
                    onClick={async () => {
                      setPayrollBusy(true)
                      const res = await payPayrollAction(year, month, 'BANK')
                      setPayrollBusy(false)
                      setPayrollNotice(res.message || null)
                      router.refresh()
                    }}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20"
                  >
                    {en ? '💳 Settle via NBK Bank' : '💳 اعتماد وصرف عبر البنك'}
                  </button>
                ) : null}
              </div>
            </div>

            {payrollNotice ? (
              <p className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
                {payrollNotice}
              </p>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-6">
              <label className="block text-xs text-mist-300">
                {en ? 'Basic Salary (KWD)' : 'الراتب الأساسي (د.ك)'}
                <input
                  dir="ltr"
                  value={calcBasic}
                  onChange={(e) => setCalcBasic(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#141b26] px-3 py-2 font-mono text-xs text-white"
                />
              </label>
              <label className="block text-xs text-mist-300">
                {en ? 'Allowances (KWD)' : 'البدلات الثابتة (د.ك)'}
                <input
                  dir="ltr"
                  value={calcAllowances}
                  onChange={(e) => setCalcAllowances(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#141b26] px-3 py-2 font-mono text-xs text-white"
                />
              </label>
              <label className="block text-xs text-mist-300">
                {en ? 'Overtime Pay (KWD)' : 'أجر الساعات الإضافية (د.ك)'}
                <input
                  dir="ltr"
                  value={calcOvertime}
                  onChange={(e) => setCalcOvertime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#141b26] px-3 py-2 font-mono text-xs text-emerald-300"
                />
              </label>
              <label className="block text-xs text-mist-300">
                {en ? 'Loan Installment (KWD)' : 'قسط السلفة (د.ك)'}
                <input
                  dir="ltr"
                  value={calcLoans}
                  onChange={(e) => setCalcLoans(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#141b26] px-3 py-2 font-mono text-xs text-amber-300"
                />
              </label>
              <label className="block text-xs text-mist-300">
                {en ? 'Absence / Penalties (KWD)' : 'الغياب والجزاءات (د.ك)'}
                <input
                  dir="ltr"
                  value={calcAbsencePenalties}
                  onChange={(e) => setCalcAbsencePenalties(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#141b26] px-3 py-2 font-mono text-xs text-red-300"
                />
              </label>
              <div className="rounded-xl border border-gold-400/30 bg-gold-500/10 p-2.5">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-gold-200">
                  <input
                    type="checkbox"
                    checked={calcIsKuwaitiPifss}
                    onChange={(e) => setCalcIsKuwaitiPifss(e.target.checked)}
                  />
                  <span>{en ? 'Kuwaiti PIFSS (10.5%)' : 'تأمينات الكويتيين PIFSS'}</span>
                </label>
                <p className="mt-1 font-mono text-base font-black text-gold-300" dir="ltr">
                  {calcNetSalary.toFixed(3)} KWD
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0f141c] p-5">
            <HrWpsToolbar month={month} year={year} locale={locale} />
            <div className="max-h-[500px] overflow-auto">
              <table className="min-w-[940px] w-full text-xs">
                <thead className="sticky top-0 bg-[#0a0d12] text-mist-400">
                  <tr>
                    <th className="px-3 py-2.5 text-start">{en ? 'Barcode & Employee' : 'الباركود والموظف'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Brand / Branch' : 'البراند / الفرع'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Basic (KWD)' : 'الأساسي (د.ك)'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Allowances (KWD)' : 'البدلات (د.ك)'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Deductions (KWD)' : 'الاستقطاعات (د.ك)'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Net Salary (KWD)' : 'الصافي (د.ك)'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Payslip Print' : 'طباعة القسيمة'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(payrollRows.length > 0
                    ? payrollRows
                    : employees.map((e) => ({
                        id: e.id,
                        month,
                        year,
                        employeeId: e.id,
                        employeeCode: e.code,
                        employeeName: e.name,
                        department: e.department,
                        basicSalary: e.basicSalary,
                        totalAllowances: e.allowances,
                        totalDeductions: e.deductions,
                        netSalary: Math.max(0, e.basicSalary + e.allowances - e.deductions),
                        absentDays: 0,
                        lateDays: 0,
                        status: 'ACTIVE',
                      }))
                  ).map((row) => (
                    <tr key={row.id} className="border-t border-white/5">
                      <td className="px-3 py-2.5 font-bold text-white">
                        [{row.employeeCode}] {row.employeeName}
                      </td>
                      <td className="px-3 py-2.5 text-mist-300">{row.department}</td>
                      <td className="px-3 py-2.5 font-mono" dir="ltr">
                        {row.basicSalary.toFixed(3)}
                      </td>
                      <td className="px-3 py-2.5 font-mono" dir="ltr">
                        {row.totalAllowances.toFixed(3)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-amber-300" dir="ltr">
                        {row.totalDeductions.toFixed(3)}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-emerald-300" dir="ltr">
                        {row.netSalary.toFixed(3)} KWD
                      </td>
                      <td className="px-3 py-2.5">
                        <a
                          href={payrollRows.length > 0 ? `/hr/payroll/${row.id}/print` : '#'}
                          onClick={(e) => {
                            if (payrollRows.length === 0) {
                              e.preventDefault()
                              setActiveTab('letters')
                            }
                          }}
                          className="rounded-lg border border-gold-300/40 bg-gold-400/10 px-2.5 py-1 text-[11px] font-bold text-gold-200 hover:bg-gold-400/20"
                        >
                          {en ? '📄 Print Payslip' : '📄 طباعة قسيمة راتب'}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {/* =====================================================================
          TAB 5: LEAVES, AIR TICKETS & VACATION TRACKER
         ===================================================================== */}
      {activeTab === 'leaves' ? (
        <section className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-[#0f141c] p-5">
            <h2 className="text-lg font-black text-white">
              {en
                ? '🏖️ Leaves, Annual Flight Tickets & Airport Return Tracker (Kuwait Labor Law Art. 69 & 70)'
                : '🏖️ إدارة الإجازات السنوية والمرضية وتذاكر السفر ومتابعة العودة من السفر'}
            </h2>
            <p className="mt-1 text-xs text-mist-400">
              {en
                ? 'Statutory Sick Leave Tiers (Art. 69): 15 days @ 100% pay · 10 days @ 75% pay · 10 days @ 50% pay · 10 days @ 25% pay · 30 days unpaid. Annual Leave: 30 paid days/year.'
                : 'شرائح الإجازات المرضية (مادة 69): 15 يوماً بأجر كامل · 10 أيام بـ 75% · 10 أيام بـ 50% · 10 أيام بـ 25% · 30 يوماً بدون أجر. الإجازة السنوية: 30 يوماً مدفوعة.'}
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[940px] w-full text-xs">
                <thead className="bg-black/40 text-mist-400">
                  <tr>
                    <th className="px-3 py-2.5 text-start">{en ? 'Employee' : 'الموظف'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Brand / Dept' : 'البراند / القسم'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Leave Type' : 'نوع الإجازة'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Accrued / Requested' : 'الرصيد / المطلوب'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Departure & Return' : 'تاريخ المغادرة والعودة'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Destination & Airline Ticket' : 'الوجهة وتذكرة الطيران'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Status' : 'الحالة'}</th>
                  </tr>
                </thead>
                <tbody>
                  {LEAVE_VACATION_RECORDS.map((lv) => (
                    <tr key={lv.id} className="border-t border-white/5">
                      <td className="px-3 py-3 font-bold text-white">
                        [{lv.employeeCode}] {en ? lv.employeeNameEn : lv.employeeNameAr}
                      </td>
                      <td className="px-3 py-3 text-mist-300">{en ? lv.brandEn : lv.brandAr}</td>
                      <td className="px-3 py-3 font-semibold text-gold-300">{lv.leaveType}</td>
                      <td className="px-3 py-3 font-mono" dir="ltr">
                        {lv.annualBalanceDays}d / {lv.requestedDays}d
                      </td>
                      <td className="px-3 py-3 font-mono text-mist-200" dir="ltr">
                        {lv.departureDate} → {lv.expectedReturnDate}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-white">{en ? lv.destinationEn : lv.destinationAr}</p>
                        <p className="font-mono text-[11px] text-emerald-300" dir="ltr">
                          {lv.airlineRef} · {lv.ticketCostKwd.toFixed(3)} KWD
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-200">
                          {lv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {/* =====================================================================
          TAB 6: ATTENDANCE, SHIFT ROSTER & OVERTIME
         ===================================================================== */}
      {activeTab === 'attendance' ? (
        <section className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-[#0f141c] p-5">
            <h2 className="text-lg font-black text-white">
              {en
                ? '⏱️ Biometric Attendance, 10-Branch Shift Roster & Statutory Overtime (1.25x / 1.50x / 2.00x)'
                : '⏱️ سجل البصمة الفعلي، جدول شفتات الفروع الـ 10 والمطبخ المركزي، واعتماد الساعات الإضافية'}
            </h2>
            <p className="mt-1 text-xs text-mist-400">
              {en
                ? 'Kuwait Labor Law Art. 64–68: Regular Day Overtime = 1.25x · Weekly Rest Day = 1.50x · Official Public Holiday = 2.00x.'
                : 'معاملات الساعات الإضافية وفق قانون العمل الكويتي: يوم عادي 1.25x · يوم الراحة الأسبوعية 1.50x · عطلة رسمية 2.00x.'}
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[920px] w-full text-xs">
                <thead className="bg-black/40 text-mist-400">
                  <tr>
                    <th className="px-3 py-2.5 text-start">{en ? 'Employee' : 'الموظف'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Branch / Kitchen' : 'الفرع / المطبخ'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Assigned Shift' : 'الوردية المجدولة'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Check-In / Out' : 'بصمة الدخول / الخروج'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Regular / OT Hours' : 'الساعات العادية / الإضافي'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Multiplier & OT Pay' : 'المعامل وقيمة الإضافي'}</th>
                  </tr>
                </thead>
                <tbody>
                  {SHIFT_ROSTER_RECORDS.map((sh) => (
                    <tr key={sh.id} className="border-t border-white/5">
                      <td className="px-3 py-2.5 font-bold text-white">
                        [{sh.employeeCode}] {en ? sh.employeeNameEn : sh.employeeNameAr}
                      </td>
                      <td className="px-3 py-2.5 text-mist-300">
                        {en ? sh.branchEn : sh.branchAr}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-gold-300" dir="ltr">
                        {sh.shiftTime}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-mist-200" dir="ltr">
                        {sh.checkIn} → {sh.checkOut}
                      </td>
                      <td className="px-3 py-2.5 font-mono" dir="ltr">
                        {sh.regularHours}h + {sh.overtimeHours}h OT
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-emerald-300" dir="ltr">
                        {sh.overtimeMultiplier}x · {sh.overtimePayKwd.toFixed(3)} KWD
                      </td>
                    </tr>
                  ))}
                  {attendanceRows.slice(0, 25).map((att) => (
                    <tr key={att.id} className="border-t border-white/5">
                      <td className="px-3 py-2.5 font-semibold text-white">
                        [{att.employeeCode}] {att.employeeName}
                      </td>
                      <td className="px-3 py-2.5 text-mist-400">
                        {en ? 'Biometric Terminal' : 'جهاز البصمة'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-mist-300" dir="ltr">
                        {att.date}
                      </td>
                      <td className="px-3 py-2.5 text-emerald-300">{att.status}</td>
                      <td className="px-3 py-2.5 font-mono" dir="ltr">
                        {att.hoursWorked}h
                      </td>
                      <td className="px-3 py-2.5 font-mono text-mist-400" dir="ltr">
                        1.00x
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {/* =====================================================================
          TAB 7: LOANS, ADVANCES & DISCIPLINARY ACTIONS
         ===================================================================== */}
      {activeTab === 'loans' ? (
        <section className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-[#0f141c] p-5">
            <h2 className="text-lg font-black text-white">
              {en
                ? '💳 Staff Loans, Monthly Installments & Legal Disciplinary Register'
                : '💳 سجل السلف والقروض والأقساط الشهرية والإنذارات والجزاءات القانونية'}
            </h2>
            <p className="mt-1 text-xs text-mist-400">
              {en
                ? 'Kuwait Labor Law Art. 31 & 59: Monthly loan deductions may not exceed 10% of salary; disciplinary penalties may not exceed 5 days pay per month.'
                : 'مادة 31 و59 من قانون العمل الكويتي: لا يجوز أن يزيد قسط السلفة عن 10% من الراتب، ولا يتجاوز خصم الجزاء التأديبي 5 أيام في الشهر الواحد.'}
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[920px] w-full text-xs">
                <thead className="bg-black/40 text-mist-400">
                  <tr>
                    <th className="px-3 py-2.5 text-start">{en ? 'Employee & Branch' : 'الموظف والفرع'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Record Type' : 'نوع السجل'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Description' : 'البيان والتفاصيل'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Total Loan (KWD)' : 'إجمالي السلفة (د.ك)'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Monthly Deduction (KWD)' : 'القسط الشهري (د.ك)'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Remaining Balance (KWD)' : 'الرصيد المتبقي (د.ك)'}</th>
                    <th className="px-3 py-2.5 text-start">{en ? 'Disciplinary Penalty' : 'خصم الجزاء'}</th>
                  </tr>
                </thead>
                <tbody>
                  {LOANS_AND_DISCIPLINARY_RECORDS.map((row) => (
                    <tr key={row.id} className="border-t border-white/5">
                      <td className="px-3 py-3">
                        <p className="font-bold text-white">
                          [{row.employeeCode}] {en ? row.employeeNameEn : row.employeeNameAr}
                        </p>
                        <p className="text-[11px] text-mist-400">
                          {en ? row.branchEn : row.branchAr}
                        </p>
                      </td>
                      <td className="px-3 py-3 font-semibold text-gold-300">{row.recordType}</td>
                      <td className="px-3 py-3 text-mist-200">
                        {en ? row.titleEn : row.titleAr}
                      </td>
                      <td className="px-3 py-3 font-mono" dir="ltr">
                        {row.totalLoanKwd.toFixed(3)} KWD
                      </td>
                      <td className="px-3 py-3 font-mono text-amber-300" dir="ltr">
                        {row.monthlyInstallmentKwd.toFixed(3)} KWD
                      </td>
                      <td className="px-3 py-3 font-mono font-bold text-emerald-300" dir="ltr">
                        {row.remainingBalanceKwd.toFixed(3)} KWD
                      </td>
                      <td className="px-3 py-3 font-mono text-red-300" dir="ltr">
                        {row.penaltyDaysDeducted > 0
                          ? `${row.penaltyDaysDeducted}d (${row.penaltyAmountKwd.toFixed(3)} KWD)`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {/* =====================================================================
          TAB 8: STAFF ACCOMMODATION & TRANSPORT
         ===================================================================== */}
      {activeTab === 'housing' ? (
        <section className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-[#0f141c] p-5">
            <h2 className="text-lg font-black text-white">
              {en
                ? '🏢 Company Staff Accommodation Flats & Daily Bus Transport Routes'
                : '🏢 سجل شقق سكن موظفي الشركة وخطوط باصات المواصلات اليومية'}
            </h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {STAFF_HOUSING_FLATS.map((flat) => (
                <article
                  key={flat.id}
                  className="rounded-2xl border border-white/10 bg-[#141b26] p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-gold-300" dir="ltr">
                      {flat.flatCode}
                    </span>
                    <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200">
                      {flat.occupiedCount} / {flat.capacity} {en ? 'Beds Occupied' : 'مقيم حالياً'}
                    </span>
                  </div>
                  <p className="text-sm font-black text-white">
                    {en
                      ? `${flat.areaEn} · ${flat.buildingEn}`
                      : `${flat.areaAr} · ${flat.buildingAr}`}
                  </p>
                  <p className="text-xs text-mist-300">{flat.flatNumber}</p>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-2.5 text-xs">
                    <p className="font-semibold text-mist-400">
                      {en ? 'Occupants:' : 'الموظفون القاطنون بالشقة:'}
                    </p>
                    <p className="mt-1 text-mist-200">
                      {(en ? flat.occupantsEn : flat.occupantsAr).join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-mono font-bold text-emerald-300" dir="ltr">
                      Rent: {flat.monthlyRentKwd.toFixed(3)} KWD/mo
                    </span>
                    <span className="font-mono text-mist-400" dir="ltr">
                      Lease Exp: {flat.leaseExpiryDate}
                    </span>
                  </div>
                  <p className="border-t border-white/10 pt-2 text-[11px] text-sky-300">
                    🚌 {en ? flat.busRouteEn : flat.busRouteAr} ({en ? flat.driverNameEn : flat.driverNameAr})
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* =====================================================================
          TAB 9: KUWAIT EOSB INDEMNITY CALCULATOR & OFFBOARDING
         ===================================================================== */}
      {activeTab === 'eosb' ? (
        <section className="space-y-6">
          <div className="rounded-3xl border border-gold-400/30 bg-[#0f141c] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gold-300">
                  {en
                    ? 'Kuwait Labor Law No. 6 of 2010 (Articles 51, 52, 53 & 70) — Interactive EOSB Calculator'
                    : 'حاسبة مستحقات نهاية الخدمة والمخالصة النهائية وفق قانون العمل الكويتي رقم 6 لسنة 2010'}
                </p>
                <h2 className="mt-1 text-xl font-black text-white">
                  {en
                    ? '⚖️ End-of-Service Indemnity (EOSB), Leave Encashment & Final Settlement Calculator'
                    : '⚖️ حساب مكافأة نهاية الخدمة (15 يوماً لأول 5 سنوات + 30 يوماً لما زاد) ونسب الاستقالة القانونية'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('letters')
                }}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-xs font-black text-ink-950 shadow-lg hover:brightness-110"
              >
                {en
                  ? '🖨️ Print Final Clearance & Settlement Form'
                  : '🖨️ طباعة إقرار المخالصة النهائية وإخلاء الطرف'}
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <label className="block text-xs font-semibold text-mist-300 sm:col-span-2">
                {en ? 'Select Employee' : 'اختر الموظف'}
                <select
                  value={eosbEmpId}
                  onChange={(e) => setEosbEmpId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#141b26] px-3 py-2 text-xs text-white"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      [{e.code}] {e.name} — {e.basicSalary.toFixed(3)} KWD
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Separation Reason (Art. 51 / 53)' : 'سبب انتهاء الخدمة'}
                <select
                  value={eosbReason}
                  onChange={(e) =>
                    setEosbReason(
                      e.target.value as 'RESIGNATION' | 'TERMINATION' | 'CONTRACT_EXPIRY',
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#141b26] px-3 py-2 text-xs text-white"
                >
                  <option value="RESIGNATION">
                    {en ? 'Resignation (استقالة — Art. 53)' : 'استقالة (Resignation — مادة 53)'}
                  </option>
                  <option value="TERMINATION">
                    {en ? 'Termination by Employer (إنهاء خدمات — 100%)' : 'إنهاء خدمات (Termination — 100%)'}
                  </option>
                  <option value="CONTRACT_EXPIRY">
                    {en ? 'Contract Expiry (انتهاء عقد — 100%)' : 'انتهاء مدة العقد (Contract Expiry — 100%)'}
                  </option>
                </select>
              </label>

              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Last Working Day' : 'تاريخ آخر يوم عمل'}
                <input
                  type="date"
                  dir="ltr"
                  value={eosbLastDate}
                  onChange={(e) => setEosbLastDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#141b26] px-3 py-2 text-xs text-white"
                />
              </label>

              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Unused Leave Balance (Days)' : 'رصيد الإجازات غير المستعمل (يوم)'}
                <input
                  dir="ltr"
                  value={eosbUnusedLeaveDays}
                  onChange={(e) => setEosbUnusedLeaveDays(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#141b26] px-3 py-2 font-mono text-xs text-white"
                />
              </label>

              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Outstanding Loan Balance (KWD)' : 'رصيد السلف المتبقي (د.ك)'}
                <input
                  dir="ltr"
                  value={eosbLoanBalance}
                  onChange={(e) => setEosbLoanBalance(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#141b26] px-3 py-2 font-mono text-xs text-amber-300"
                />
              </label>
            </div>

            {/* Calculation Breakdown Cards */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-[#141b26] p-4">
                <p className="text-xs text-mist-400">
                  {en ? 'Exact Length of Service' : 'مدة الخدمة الفعلية'}
                </p>
                <p className="mt-1 text-xl font-black text-white">
                  {en
                    ? `${eosbCalculation.years}y · ${eosbCalculation.months}m · ${eosbCalculation.days}d`
                    : `${eosbCalculation.years} سنة · ${eosbCalculation.months} شهر · ${eosbCalculation.days} يوم`}
                </p>
                <p className="mt-1 text-[11px] text-emerald-300">
                  {en
                    ? `Remuneration Base: ${eosbCalculation.remunerationBaseKwd.toFixed(3)} KWD (26-day rate: ${eosbCalculation.dailyWage26Kwd.toFixed(3)} KWD)`
                    : `الراتب الشامل للحساب: ${eosbCalculation.remunerationBaseKwd.toFixed(3)} د.ك (أجر اليوم /26: ${eosbCalculation.dailyWage26Kwd.toFixed(3)} د.ك)`}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#141b26] p-4">
                <p className="text-xs text-mist-400">
                  {en ? 'Full Gross Indemnity & Statutory Ratio' : 'إجمالي المكافأة ونسبة الاستحقاق القانونية'}
                </p>
                <p className="mt-1 font-mono text-xl font-black text-gold-300" dir="ltr">
                  {eosbCalculation.netIndemnityPayableKwd.toFixed(3)} KWD
                </p>
                <p className="mt-1 text-[11px] text-mist-300">
                  {en
                    ? eosbCalculation.resignationEntitlementLabelEn
                    : eosbCalculation.resignationEntitlementLabelAr}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#141b26] p-4">
                <p className="text-xs text-mist-400">
                  {en
                    ? 'Leave Encashment + Final Month Pay'
                    : 'بدل رصيد الإجازات + راتب أيام الشهر الأخير'}
                </p>
                <p className="mt-1 font-mono text-xl font-black text-sky-300" dir="ltr">
                  {(eosbCalculation.leaveEncashmentKwd + eosbCalculation.finalMonthSalaryKwd).toFixed(3)} KWD
                </p>
                <p className="mt-1 text-[11px] text-mist-400" dir="ltr">
                  Leave: {eosbCalculation.leaveEncashmentKwd.toFixed(3)} + Days:{' '}
                  {eosbCalculation.finalMonthSalaryKwd.toFixed(3)} KWD
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 p-4">
                <p className="text-xs font-bold text-emerald-200">
                  {en ? 'FINAL NET SETTLEMENT PAYABLE' : 'صافي المخالصة النهائية المستحق للصرف'}
                </p>
                <p className="mt-1 font-mono text-2xl font-black text-white" dir="ltr">
                  {eosbCalculation.finalSettlementNetKwd.toFixed(3)} KWD
                </p>
                <p className="mt-1 text-[11px] text-emerald-200">
                  {en ? 'After deducting outstanding loans' : 'بعد خصم رصيد السلف المتبقي'}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* =====================================================================
          TAB 10: OFFICIAL HR LETTERS & CONTRACTS
         ===================================================================== */}
      {activeTab === 'letters' ? (
        <HrOfficialLettersHub en={en} employees={employees} />
      ) : null}

      {/* =====================================================================
          STAGE 2: 12 EXECUTIVE HR REPORTS CENTER
         ===================================================================== */}
      {activeTab === 'reports' ? (
        <HrExecutiveReportsHub en={en} employees={employees} />
      ) : null}

      {/* 4-Step New Employee Wizard Modal */}
      <NewEmployeeWizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        en={en}
      />

      {/* Smart Auto-Matcher Modal for Bulk Employee Photos & Documents */}
      <SmartPhotoDocAutoMatcherModal
        isOpen={autoMatcherOpen}
        onClose={() => setAutoMatcherOpen(false)}
      />

      {/* Odoo Single Expense Registration Modal */}
      <OdooExpenseSingleModal
        isOpen={showHrExpenseSingleModal}
        onClose={() => setShowHrExpenseSingleModal(false)}
        onSave={(payload) => {
          const newSheet: OdooExpenseSheetReport = {
            id: `sheet_hr_${Date.now()}`,
            reportNo: `EXP/HR/2026/${Math.floor(1000 + Math.random() * 9000)}`,
            date: payload.date,
            custodianId: payload.custodianId,
            custodianNameAr: payload.custodianId === 'sanad' ? 'سند' : payload.custodianId === 'rabih' ? 'ربيع أنيس يحيى' : 'الموظف المسؤول',
            custodianNameEn: payload.custodianId === 'sanad' ? 'Sanad' : payload.custodianId === 'rabih' ? 'Rabih Anis Yahya' : 'Responsible Staff',
            titleAr: payload.descriptionAr,
            titleEn: payload.descriptionEn,
            descriptionAr: payload.descriptionAr,
            descriptionEn: payload.descriptionEn,
            costCenterAr: 'الفروع ومراكز التكلفة المعتمدة',
            costCenterEn: 'Approved Branch Cost Centers',
            brandAr: 'البراندات الرسمية',
            brandEn: 'Official Brands',
            amountKwd: payload.amountKwd,
            accountCode: '40355 / 7120',
            adminApproval: payload.status === 'approved' || payload.status === 'paid' ? 'approved' : 'submitted',
            paymentStatus: payload.status === 'paid' ? 'paid' : 'not_paid',
          }
          setHrExpenseSheets([newSheet, ...hrExpenseSheets])
        }}
      />

      {/* Odoo Expense Report Sheet Modal */}
      <OdooExpenseSheetModal
        isOpen={showHrExpenseSheetModal}
        onClose={() => {
          setShowHrExpenseSheetModal(false)
          setSelectedHrSheetForModal(null)
        }}
        onSave={(payload) => {
          const newSheet: OdooExpenseSheetReport = {
            id: `sheet_hr_${Date.now()}`,
            reportNo: payload.reportNo,
            date: payload.date,
            custodianId: payload.custodianId,
            custodianNameAr: payload.custodianNameAr,
            custodianNameEn: payload.custodianNameEn,
            titleAr: payload.titleAr,
            titleEn: payload.titleEn,
            descriptionAr: payload.titleAr,
            descriptionEn: payload.titleEn,
            costCenterAr: 'الفروع الـ 9 والمطبخ المركزي',
            costCenterEn: '9 Branches & Central Kitchen',
            brandAr: 'البراندات الـ 6 الرسمية',
            brandEn: '6 Official Brands',
            amountKwd: payload.amountKwd,
            accountCode: '1142 / 6150 / 7120',
            adminApproval: payload.adminApproval,
            paymentStatus: payload.paymentStatus,
          }
          setHrExpenseSheets([newSheet, ...hrExpenseSheets])
        }}
        existingSheet={selectedHrSheetForModal}
      />

    </div>
  )
}
