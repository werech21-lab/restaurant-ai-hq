'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FileText, Plus, Search, ShieldCheck, Upload, Users, Wallet, Clock, Calculator } from 'lucide-react'
import { HrDigitalDossier } from '@/components/hr-digital-dossier'
import { HrWpsToolbar } from '@/components/hr-wps-toolbar'
import {
  DataTable,
  KpiCard,
  SectionCard,
  SlidingPillTabs,
  StateBlock,
  type DataTableColumn,
} from '@/components/ui'
import { isExcludedOdooEntity } from '@/lib/aether/period-delta'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatInt,
  formatKwd,
  getUnavailableTooltip,
} from '@/lib/format'
import { calculateKuwaitEosb, type HrCommandTabKey } from './hr-enterprise-data'
import type { HrEmployeeSummary } from './hr-employee-summary'
import { NewEmployeeWizardModal } from './NewEmployeeWizardModal'

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

type HubTab = Extract<HrCommandTabKey, 'employees' | 'payroll' | 'attendance' | 'eosb'>

const TABS: Array<{ key: HubTab; ar: string; en: string }> = [
  { key: 'employees', ar: 'دليل الموظفين', en: 'Employee Directory' },
  { key: 'payroll', ar: 'مسير الرواتب', en: 'Payroll' },
  { key: 'attendance', ar: 'الحضور والانصراف', en: 'Attendance' },
  { key: 'eosb', ar: 'حاسبة نهاية الخدمة', en: 'Kuwait EOSB Calculator' },
]

function UnavailableCell({ tooltip }: { tooltip: string }) {
  return (
    <span
      dir="ltr"
      title={tooltip}
      aria-label={tooltip}
      data-unavailable="true"
      className="ds-num tabular-nums"
      style={{ color: 'var(--ds-unavailable)' }}
    >
      {UNAVAILABLE_DASH}
    </span>
  )
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
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const label = (ar: string, en: string) => (isAr ? ar : en)
  const unavailableTooltip = getUnavailableTooltip(locale)

  const validInitial = TABS.find((t) => t.key === initialTab)?.key ?? 'employees'
  const [activeTab, setActiveTab] = useState<HubTab>(validInitial)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ON_VACATION' | 'INACTIVE'>('ALL')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  const [hireDate, setHireDate] = useState('')
  const [lastWorkingDate, setLastWorkingDate] = useState('')
  const [basicSalaryKwd, setBasicSalaryKwd] = useState(0)
  const [allowancesKwd, setAllowancesKwd] = useState(0)
  const [reason, setReason] = useState<'RESIGNATION' | 'TERMINATION' | 'CONTRACT_EXPIRY'>('TERMINATION')

  const safeEmployees = useMemo(
    () =>
      employees.filter(
        (emp) => !isExcludedOdooEntity(emp.name) && !isExcludedOdooEntity(emp.department),
      ),
    [employees],
  )

  const safePayrollRows = useMemo(
    () =>
      payrollRows.filter(
        (row) => !isExcludedOdooEntity(row.employeeName) && !isExcludedOdooEntity(row.department),
      ),
    [payrollRows],
  )

  const safeAttendanceRows = useMemo(
    () => attendanceRows.filter((row) => !isExcludedOdooEntity(row.employeeName)),
    [attendanceRows],
  )

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return safeEmployees.filter((emp) => {
      if (statusFilter !== 'ALL' && emp.status !== statusFilter) return false
      if (!q) return true
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.code.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q) ||
        emp.jobTitle.toLowerCase().includes(q)
      )
    })
  }, [safeEmployees, searchQuery, statusFilter])

  const selectedEmployee = useMemo(
    () => safeEmployees.find((e) => e.id === selectedEmployeeId) ?? null,
    [safeEmployees, selectedEmployeeId],
  )

  const activeCount = useMemo(
    () => safeEmployees.filter((e) => e.status === 'ACTIVE').length,
    [safeEmployees],
  )

  const totalNetPayrollKwd = useMemo(() => {
    if (safePayrollRows.length === 0) return null
    return safePayrollRows.reduce((sum, r) => sum + (Number.isFinite(r.netSalary) ? r.netSalary : 0), 0)
  }, [safePayrollRows])

  const eosbDateInvalid = Boolean(
    hireDate && lastWorkingDate && new Date(lastWorkingDate).getTime() < new Date(hireDate).getTime(),
  )

  const eosb =
    hireDate && lastWorkingDate && !eosbDateInvalid && basicSalaryKwd > 0
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

  const employeeColumns: ReadonlyArray<DataTableColumn<HrEmployeeSummary>> = [
    {
      key: 'code',
      header: label('الرمز', 'Code'),
      render: (emp) => (
        <span dir="ltr" className="ds-num font-mono font-bold tabular-nums">
          {emp.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: label('الموظف', 'Employee'),
      render: (emp) => (
        <div className="min-w-0">
          <p className="font-semibold text-[var(--ds-text-primary)]">{emp.name}</p>
          {emp.jobTitle ? (
            <p className="text-xs text-[var(--ds-text-muted)]">{emp.jobTitle}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'department',
      header: label('القسم', 'Department'),
      render: (emp) =>
        emp.department ? (
          <span>{emp.department}</span>
        ) : (
          <UnavailableCell tooltip={unavailableTooltip} />
        ),
    },
    {
      key: 'netPackage',
      header: label('صافي الراتب التعاقدي', 'Contract Net'),
      align: 'numeric',
      format: 'kwd',
      accessor: (emp) => {
        // No salary on file (basic 0, e.g. owners / outside partners) → «—», not a 0.000 KWD contract.
        if (!(emp.basicSalary > 0)) return null
        const net = emp.basicSalary + emp.allowances - emp.deductions
        return Number.isFinite(net) ? net : null
      },
    },
    {
      key: 'hireDate',
      header: label('تاريخ التعيين', 'Hire Date'),
      format: 'date',
      accessor: (emp) => emp.hireDate || null,
    },
    {
      key: 'status',
      header: label('الحالة', 'Status'),
      render: (emp) => {
        const isActive = emp.status === 'ACTIVE'
        return (
          <span
            className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: isActive ? 'var(--ds-positive-bg)' : 'var(--ds-warning-bg)',
              borderColor: isActive ? 'var(--ds-positive-border)' : 'var(--ds-warning-border)',
              color: isActive ? 'var(--ds-positive)' : 'var(--ds-warning)',
            }}
          >
            {isActive
              ? label('نشط', 'Active')
              : emp.status === 'ON_VACATION'
                ? label('إجازة', 'On Vacation')
                : emp.status}
          </span>
        )
      },
    },
    {
      key: 'dossier',
      header: label('الخزانة والوثائق', 'Dossier'),
      render: (emp) => (
        <button
          type="button"
          onClick={() => setSelectedEmployeeId((prev) => (prev === emp.id ? null : emp.id))}
          className="ds-focus-ring cursor-pointer rounded-xl border border-[var(--ds-border-accent)] bg-[var(--ds-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--ds-text-primary)] hover:brightness-95"
        >
          {selectedEmployeeId === emp.id
            ? label('إخفاء الملف', 'Hide Dossier')
            : label('عرض الملف', 'View Dossier')}
        </button>
      ),
    },
  ]

  const payrollColumns: ReadonlyArray<DataTableColumn<HrPayrollRow>> = [
    {
      key: 'code',
      header: label('الرمز', 'Code'),
      render: (r) => (
        <span dir="ltr" className="ds-num font-mono font-semibold tabular-nums">
          {r.employeeCode}
        </span>
      ),
    },
    {
      key: 'employee',
      header: label('الموظف', 'Employee'),
      render: (r) => (
        <div>
          <p className="font-semibold text-[var(--ds-text-primary)]">{r.employeeName}</p>
          {r.department ? <p className="text-xs text-[var(--ds-text-muted)]">{r.department}</p> : null}
        </div>
      ),
    },
    {
      key: 'basic',
      header: label('الأساسي', 'Basic'),
      align: 'numeric',
      format: 'kwd',
      accessor: (r) => r.basicSalary,
    },
    {
      key: 'allowances',
      header: label('البدلات', 'Allowances'),
      align: 'numeric',
      format: 'kwd',
      accessor: (r) => r.totalAllowances,
    },
    {
      key: 'deductions',
      header: label('الاستقطاعات', 'Deductions'),
      align: 'numeric',
      format: 'kwd',
      accessor: (r) => r.totalDeductions,
    },
    {
      key: 'net',
      header: label('صافي الراتب', 'Net Salary'),
      align: 'numeric',
      format: 'kwd',
      accessor: (r) => r.netSalary,
    },
    {
      key: 'absence',
      header: label('غياب / تأخير', 'Absent / Late'),
      align: 'center',
      render: (r) => (
        <span dir="ltr" className="ds-num tabular-nums">
          {formatInt(r.absentDays, locale)} / {formatInt(r.lateDays, locale)}
        </span>
      ),
    },
    {
      key: 'status',
      header: label('الحالة', 'Status'),
      render: (r) => {
        const paid = r.status === 'PAID'
        return (
          <span
            className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: paid ? 'var(--ds-positive-bg)' : 'var(--ds-warning-bg)',
              borderColor: paid ? 'var(--ds-positive-border)' : 'var(--ds-warning-border)',
              color: paid ? 'var(--ds-positive)' : 'var(--ds-warning)',
            }}
          >
            {paid ? label('مصروف', 'Paid') : label('مسودة', 'Draft')}
          </span>
        )
      },
    },
    {
      key: 'print',
      header: label('القسيمة', 'Payslip'),
      render: (r) => (
        <Link
          href={`/hr/payroll/${r.id}/print`}
          className="ds-focus-ring inline-flex items-center gap-1 rounded-lg border border-[var(--ds-border-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden />
          <span>{label('طباعة', 'Print')}</span>
        </Link>
      ),
    },
  ]

  const attendanceColumns: ReadonlyArray<DataTableColumn<HrAttendanceRow>> = [
    {
      key: 'date',
      header: label('التاريخ', 'Date'),
      format: 'date',
      accessor: (r) => r.date,
    },
    {
      key: 'code',
      header: label('الرمز', 'Code'),
      render: (r) => (
        <span dir="ltr" className="ds-num font-mono tabular-nums">
          {r.employeeCode}
        </span>
      ),
    },
    {
      key: 'employee',
      header: label('الموظف', 'Employee'),
      accessor: (r) => r.employeeName,
    },
    {
      key: 'status',
      header: label('الحالة', 'Status'),
      accessor: (r) => r.status,
    },
    {
      key: 'hours',
      header: label('الساعات', 'Hours'),
      align: 'numeric',
      render: (r) =>
        Number.isFinite(r.hoursWorked) ? (
          <span dir="ltr" className="ds-num tabular-nums">
            {r.hoursWorked.toFixed(2)}
          </span>
        ) : (
          <UnavailableCell tooltip={unavailableTooltip} />
        ),
    },
  ]

  const tabOptions = TABS.map((t) => ({
    id: t.key,
    label: isAr ? t.ar : t.en,
    badge:
      t.key === 'employees' && safeEmployees.length > 0
        ? formatInt(safeEmployees.length, locale)
        : t.key === 'payroll' && safePayrollRows.length > 0
          ? formatInt(safePayrollRows.length, locale)
          : t.key === 'attendance' && safeAttendanceRows.length > 0
            ? formatInt(safeAttendanceRows.length, locale)
            : undefined,
  }))

  return (
    <div dir={dir} className="mx-auto w-full max-w-7xl min-w-0 space-y-5 py-2">
      <header className="ds-surface flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 sm:p-5">
        <div className="min-w-0 space-y-1">
          <h1 className="ds-page-title break-words">
            {label('الموارد البشرية وشؤون العاملين', 'Human Resources & Workforce')}
          </h1>
          <p className="ds-caption">
            {label('الفترة:', 'Period:')}{' '}
            <span dir="ltr" className="ds-num font-semibold tabular-nums">
              {String(month).padStart(2, '0')}/{year}
            </span>{' '}
            —{' '}
            {label(
              'يُعرض فقط ما هو مسجل فعلياً في قاعدة البيانات أو مربوط بـ Odoo 17.',
              'Displays only records stored in DB or linked to Odoo 17.',
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/hr/compliance-radar"
            className="ds-focus-ring inline-flex items-center gap-1.5 rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3.5 py-2 text-xs font-bold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            <span>{label('رادار الإقامات', 'Compliance Radar')}</span>
          </Link>
          <Link
            href="/hr/smart-folder-upload"
            className="ds-focus-ring inline-flex items-center gap-1.5 rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3.5 py-2 text-xs font-bold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            <span>{label('رفع المجلد الذكي', 'Smart Folder Upload')}</span>
          </Link>
          {canCreate ? (
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="ds-focus-ring btn-colored inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              <span>{label('موظف جديد', 'New Employee')}</span>
            </button>
          ) : null}
          <Link
            href="/erp/feryal-ai"
            className="ds-focus-ring inline-flex items-center gap-1.5 rounded-xl border border-[var(--ds-border-accent)] bg-[var(--ds-accent-soft)] px-4 py-2 text-xs font-bold text-[var(--ds-text-primary)]"
          >
            <span>{label('اسأل فريال عن موظفي Odoo', 'Ask Feryal about Odoo HR')}</span>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={label('إجمالي الموظفين المسجلين', 'Registered Employees')}
          value={safeEmployees.length > 0 ? safeEmployees.length : null}
          format="int"
          locale={locale}
          icon={<Users className="h-4 w-4" aria-hidden />}
          subtitle={
            safeEmployees.length > 0
              ? label(`${formatInt(activeCount, locale)} على رأس العمل`, `${formatInt(activeCount, locale)} active`)
              : label('يتطلب ربط دليل الموظفين', 'Requires employee sync')
          }
        />
        <KpiCard
          label={label('صافي مسير الرواتب للفترة', 'Period Net Payroll')}
          value={totalNetPayrollKwd}
          format="kwd"
          locale={locale}
          icon={<Wallet className="h-4 w-4" aria-hidden />}
          subtitle={
            safePayrollRows.length > 0
              ? label(`${formatInt(safePayrollRows.length, locale)} قسيمة`, `${formatInt(safePayrollRows.length, locale)} payslips`)
              : label('لا توجد مسيرات لهذا الشهر', 'No payroll runs this month')
          }
        />
        <KpiCard
          label={label('سجلات الحضور والانصراف', 'Attendance Records')}
          value={safeAttendanceRows.length > 0 ? safeAttendanceRows.length : null}
          format="int"
          locale={locale}
          icon={<Clock className="h-4 w-4" aria-hidden />}
          subtitle={
            safeAttendanceRows.length > 0
              ? label('سجلات البصمة المعتمدة', 'Synced biometric entries')
              : label('لا توجد سجلات بصمة لهذه الفترة', 'No biometric entries for this period')
          }
        />
        <KpiCard
          label={label('حاسبة قانون العمل الكويتي', 'Kuwait EOSB Statutory Engine')}
          value={eosb ? eosb.netIndemnityPayableKwd : null}
          format="kwd"
          locale={locale}
          icon={<Calculator className="h-4 w-4" aria-hidden />}
          subtitle={label('قانون رقم 6 لسنة 2010', 'Kuwait Labor Law No. 6/2010')}
        />
      </div>

      <SlidingPillTabs
        options={tabOptions}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel={label('أقسام الموارد البشرية', 'HR Workspace Sections')}
        surface="white"
      />

      {activeTab === 'employees' ? (
        safeEmployees.length === 0 ? (
          <StateBlock
            state="empty"
            locale={locale}
            title={label('لا يوجد موظفون في هذه القائمة', 'No employees in this directory')}
            description={label(
              'لم تُسجَّل صفوف موظفين في هذه الوحدة بعد.',
              'No employee rows are stored in this panel yet.',
            )}
          />
        ) : (
          <div className="space-y-4">
            <DataTable
              columns={employeeColumns}
              rows={filteredEmployees}
              rowKey={(emp) => emp.id}
              locale={locale}
              emptyTitle={label('لا يوجد موظفون مطابقون للبحث', 'No matching employees')}
              emptyDescription={label(
                'جرّب تعديل كلمات البحث أو إعادة ضبط فلتر الحالة.',
                'Try adjusting your search keywords or resetting the status filter.',
              )}
              toolbar={
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative min-w-[200px] flex-1">
                    <Search
                      className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-muted)]"
                      aria-hidden
                    />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      aria-label={label('بحث عن موظف بالاسم أو الرمز أو القسم', 'Search employees by name, code, or department')}
                      placeholder={label('بحث بالاسم أو الرمز أو القسم…', 'Search by name, code, or department…')}
                      className="ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] py-2 pe-3 ps-9 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    aria-label={label('تصفية حالة الموظف', 'Filter employee status')}
                    className="ds-focus-ring rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)]"
                  >
                    <option value="ALL">{label('جميع الحالات', 'All Statuses')}</option>
                    <option value="ACTIVE">{label('على رأس العمل', 'Active')}</option>
                    <option value="ON_VACATION">{label('في إجازة', 'On Vacation')}</option>
                    <option value="INACTIVE">{label('غير نشط', 'Inactive')}</option>
                  </select>
                  {searchQuery || statusFilter !== 'ALL' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('')
                        setStatusFilter('ALL')
                      }}
                      className="ds-focus-ring cursor-pointer rounded-xl border border-[var(--ds-border-strong)] px-3 py-2 text-xs font-semibold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
                    >
                      {label('مسح الفلاتر', 'Reset')}
                    </button>
                  ) : null}
                </div>
              }
            />

            {selectedEmployee ? (
              <SectionCard
                title={selectedEmployee.name}
                subtitle={`${selectedEmployee.jobTitle || UNAVAILABLE_DASH} · ${selectedEmployee.department || UNAVAILABLE_DASH}`}
                locale={locale}
                actions={
                  <button
                    type="button"
                    onClick={() => setSelectedEmployeeId(null)}
                    className="ds-focus-ring cursor-pointer rounded-xl border border-[var(--ds-border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--ds-text-primary)]"
                  >
                    {label('إغلاق', 'Close')}
                  </button>
                }
              >
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3">
                    <p className="ds-caption">{label('الراتب الأساسي', 'Basic Salary')}</p>
                    <p dir="ltr" className="ds-num mt-1 font-bold tabular-nums">
                      {formatKwd(selectedEmployee.basicSalary, locale)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3">
                    <p className="ds-caption">{label('البدلات', 'Allowances')}</p>
                    <p dir="ltr" className="ds-num mt-1 font-bold tabular-nums">
                      {formatKwd(selectedEmployee.allowances, locale)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3">
                    <p className="ds-caption">{label('انتهاء البطاقة المدنية', 'Civil ID Expiry')}</p>
                    <p dir="ltr" className="ds-num mt-1 font-bold tabular-nums">
                      {selectedEmployee.civilIdExpiry ? (
                        formatDate(selectedEmployee.civilIdExpiry, locale)
                      ) : (
                        <UnavailableCell tooltip={unavailableTooltip} />
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3">
                    <p className="ds-caption">{label('انتهاء كرت البلدية', 'Health Card Expiry')}</p>
                    <p dir="ltr" className="ds-num mt-1 font-bold tabular-nums">
                      {selectedEmployee.healthCardExpiry ? (
                        formatDate(selectedEmployee.healthCardExpiry, locale)
                      ) : (
                        <UnavailableCell tooltip={unavailableTooltip} />
                      )}
                    </p>
                  </div>
                </div>
                <HrDigitalDossier employeeId={selectedEmployee.id} locale={locale} />
              </SectionCard>
            ) : null}
          </div>
        )
      ) : null}

      {activeTab === 'payroll' ? (
        <div className="space-y-4">
          {canEdit && safePayrollRows.length > 0 ? (
            <HrWpsToolbar month={month} year={year} locale={locale} />
          ) : null}
          {safePayrollRows.length === 0 ? (
            <StateBlock
              state="empty"
              locale={locale}
              title={label('لا توجد مسيرات رواتب لهذه الفترة', 'No payroll runs for this period')}
              description={label(
                'لا توجد صفوف رواتب مسجّلة لهذه الفترة.',
                'No payroll rows are recorded for this period.',
              )}
            />
          ) : (
            <DataTable
              columns={payrollColumns}
              rows={safePayrollRows}
              rowKey={(r) => r.id}
              locale={locale}
              caption={label('جدول مسير الرواتب الشهري', 'Monthly Payroll Ledger')}
            />
          )}
        </div>
      ) : null}

      {activeTab === 'attendance' ? (
        safeAttendanceRows.length === 0 ? (
          <StateBlock
            state="empty"
            locale={locale}
            title={label('لا توجد سجلات حضور لهذه الفترة', 'No attendance rows for this period')}
            description={label(
              'لا توجد صفوف حضور مسجّلة لهذه الفترة.',
              'No attendance rows are recorded for this period.',
            )}
          />
        ) : (
          <DataTable
            columns={attendanceColumns}
            rows={safeAttendanceRows}
            rowKey={(r) => r.id}
            locale={locale}
            caption={label('سجلات الحضور والانصراف', 'Biometric Attendance Records')}
          />
        )
      ) : null}

      {activeTab === 'eosb' ? (
        <SectionCard
          title={label(
            'حاسبة مكافأة نهاية الخدمة القانونية (قانون العمل الكويتي رقم 6 لسنة 2010)',
            'Statutory Kuwait Labor Law EOSB Calculator',
          )}
          locale={locale}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="space-y-1 text-xs font-semibold text-[var(--ds-text-secondary)]">
                <span>{label('تاريخ التعيين', 'Hire Date')}</span>
                <input
                  type="date"
                  dir="ltr"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  className="ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)]"
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-[var(--ds-text-secondary)]">
                <span>{label('آخر يوم عمل', 'Last Working Date')}</span>
                <input
                  type="date"
                  dir="ltr"
                  value={lastWorkingDate}
                  onChange={(e) => setLastWorkingDate(e.target.value)}
                  className="ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)]"
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-[var(--ds-text-secondary)]">
                <span>{label('الراتب الأساسي (د.ك)', 'Basic Salary (KWD)')}</span>
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  dir="ltr"
                  value={basicSalaryKwd || ''}
                  onChange={(e) => setBasicSalaryKwd(Number(e.target.value) || 0)}
                  placeholder="0.000"
                  className="ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm tabular-nums text-[var(--ds-text-primary)]"
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-[var(--ds-text-secondary)]">
                <span>{label('البدلات الثابتة (د.ك)', 'Allowances (KWD)')}</span>
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  dir="ltr"
                  value={allowancesKwd || ''}
                  onChange={(e) => setAllowancesKwd(Number(e.target.value) || 0)}
                  placeholder="0.000"
                  className="ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm tabular-nums text-[var(--ds-text-primary)]"
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-[var(--ds-text-secondary)]">
                <span>{label('سبب انتهاء الخدمة', 'Separation Reason')}</span>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as typeof reason)}
                  className="ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)]"
                >
                  <option value="TERMINATION">{label('إنهاء خدمات', 'Termination')}</option>
                  <option value="CONTRACT_EXPIRY">{label('انتهاء عقد', 'Contract Expiry')}</option>
                  <option value="RESIGNATION">{label('استقالة', 'Resignation')}</option>
                </select>
              </label>
            </div>

            {eosbDateInvalid ? (
              <StateBlock
                state="error"
                compact
                locale={locale}
                title={label('تاريخ نهاية الخدمة غير صحيح', 'Invalid service date range')}
                description={label(
                  'يجب أن يكون آخر يوم عمل مساوياً لتاريخ التعيين أو بعده.',
                  'Last working date must be on or after hire date.',
                )}
              />
            ) : eosb ? (
              <div
                className="space-y-3 rounded-2xl border p-4"
                style={{
                  backgroundColor: 'var(--ds-positive-bg)',
                  borderColor: 'var(--ds-positive-border)',
                }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--ds-text-primary)]">
                    {label('صافي مكافأة نهاية الخدمة المستحقة:', 'Net Payable Indemnity:')}
                  </span>
                  <strong
                    dir="ltr"
                    className="ds-num text-xl font-black tabular-nums"
                    style={{ color: 'var(--ds-positive)' }}
                  >
                    {formatKwd(eosb.netIndemnityPayableKwd, locale)}
                  </strong>
                </div>
                <p className="text-xs font-medium text-[var(--ds-text-secondary)]">
                  {isAr ? eosb.resignationEntitlementLabelAr : eosb.resignationEntitlementLabelEn}
                </p>
                <div className="grid grid-cols-1 gap-2 border-t border-[var(--ds-border-hairline)] pt-3 text-xs sm:grid-cols-3">
                  <div>
                    <span className="text-[var(--ds-text-muted)]">{label('مدة الخدمة:', 'Service Duration:')} </span>
                    <span dir="ltr" className="ds-num font-bold tabular-nums text-[var(--ds-text-primary)]">
                      {formatInt(eosb.years, locale)}y {formatInt(eosb.months, locale)}m {formatInt(eosb.days, locale)}d
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--ds-text-muted)]">{label('وعاء الأجر الشامل:', 'Remuneration Base:')} </span>
                    <span dir="ltr" className="ds-num font-bold tabular-nums text-[var(--ds-text-primary)]">
                      {formatKwd(eosb.remunerationBaseKwd, locale)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--ds-text-muted)]">{label('المكافأة الكاملة (قبل النسبة):', 'Gross Full Indemnity:')} </span>
                    <span dir="ltr" className="ds-num font-bold tabular-nums text-[var(--ds-text-primary)]">
                      {formatKwd(eosb.grossFullIndemnityKwd, locale)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <StateBlock
                state="empty"
                compact
                locale={locale}
                title={label('أدخل تواريخ الخدمة والراتب لحساب الاستحقاق القانوني', 'Enter service dates and salary to calculate')}
                description={label(
                  'الحساب يتم بالمعادلة القانونية الكويتية بدقة 3 خانات عشريّة دون أي بيانات افتراضية.',
                  'Calculated strictly via Kuwait statutory formulas to 3-decimal KWD precision with zero defaults.',
                )}
              />
            )}
          </div>
        </SectionCard>
      ) : null}

      <NewEmployeeWizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        en={!isAr}
      />
    </div>
  )
}
