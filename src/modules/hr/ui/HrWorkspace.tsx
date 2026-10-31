'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { dangerButton, errorClass, inputClass, labelClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor, parseKwdToMinor } from '@/lib/money'
import type {
  Appointment,
  Appraisal,
  Attendance,
  Employee,
  Employee360,
  EmployeeExpense,
  Leave,
  PayrollDashboard,
  PayrollRun,
  Payslip,
  Shift,
} from '@/modules/hr/client'
import SuperOdooBoard from '@/modules/suite/ui/SuperOdooBoard'

type Tab = 'employees' | 'departments' | 'documents' | 'custody' | 'loans' | 'overtimes' | 'attendance' | 'leaves' | 'payroll'
type PayrollSub = 'dashboard' | 'contracts' | 'affects' | 'entries' | 'payslips' | 'provisions' | 'reporting' | 'config'
type DrawerPane = 'contract' | 'payslips' | 'attendance' | 'leaves' | 'custody' | 'loans' | 'overtimes' | 'documents'

const tabs: readonly Tab[] = ['employees', 'departments', 'documents', 'custody', 'loans', 'overtimes', 'attendance', 'leaves', 'payroll']
const payrollSubs: readonly PayrollSub[] = ['dashboard', 'contracts', 'affects', 'entries', 'payslips', 'provisions', 'reporting', 'config']
const drawerPanes: readonly DrawerPane[] = ['contract', 'payslips', 'attendance', 'leaves', 'custody', 'loans', 'overtimes', 'documents']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function money(input: string): number | null {
  return parseKwdToMinor(input)
}

function countMap(values: Array<string | null | undefined>): Array<[string, number]> {
  const acc: Record<string, number> = {}
  for (const value of values) {
    const key = value && value.trim() ? value : '—'
    acc[key] = (acc[key] ?? 0) + 1
  }
  return Object.entries(acc).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function Workspace({ initialTab }: { initialTab: string }) {
  const { t } = useI18n()
  const canEmployees = useCan(permissions.hrEmployeeManage)
  const canLeave = useCan(permissions.hrLeaveApprove)
  const canPayroll = useCan(permissions.hrPayrollRun)
  const canExpense = useCan(permissions.hrExpenseApprove)
  const canAppointment = useCan(permissions.hrAppointmentManage)
  const canSuite = useCan(permissions.suiteManage)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'employees')
  const [payrollSub, setPayrollSub] = useState<PayrollSub>('dashboard')
  const [employeeView, setEmployeeView] = useState<'kanban' | 'list'>('kanban')
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null)
  const [locationFilter, setLocationFilter] = useState<string | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [slips, setSlips] = useState<Payslip[]>([])
  const [appraisals, setAppraisals] = useState<Appraisal[]>([])
  const [expenses, setExpenses] = useState<EmployeeExpense[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [dashboard, setDashboard] = useState<PayrollDashboard | null>(null)
  const [costMode, setCostMode] = useState<'monthly' | 'annually'>('monthly')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Employee360 | null>(null)
  const [drawerPane, setDrawerPane] = useState<DrawerPane>('contract')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [department, setDepartment] = useState('')
  const [salary, setSalary] = useState('')
  const [allowances, setAllowances] = useState('0')
  const [residency, setResidency] = useState('')
  const [period, setPeriod] = useState('2026-10')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))

  function load() {
    const controller = new AbortController()
    setPhase('loading')
    Promise.all([
      apiRequest<{ data: Employee[] }>('/api/v1/hr/employees', { signal: controller.signal }),
      apiRequest<{ data: Shift[] }>('/api/v1/hr/shifts', { signal: controller.signal }),
      apiRequest<{ data: Attendance[] }>('/api/v1/hr/attendances', { signal: controller.signal }),
      apiRequest<{ data: Leave[] }>('/api/v1/hr/leaves', { signal: controller.signal }),
      apiRequest<{ data: PayrollRun[] }>('/api/v1/hr/payroll', { signal: controller.signal }),
      apiRequest<{ data: Payslip[] }>('/api/v1/hr/payslips', { signal: controller.signal }),
      apiRequest<{ data: Appraisal[] }>('/api/v1/hr/appraisals', { signal: controller.signal }),
      apiRequest<{ data: EmployeeExpense[] }>('/api/v1/hr/expenses', { signal: controller.signal }),
      apiRequest<{ data: Appointment[] }>('/api/v1/hr/appointments', { signal: controller.signal }),
      apiRequest<{ data: PayrollDashboard }>('/api/v1/hr/payroll/dashboard', { signal: controller.signal }),
    ])
      .then(([employeePage, shiftPage, attendancePage, leavePage, payrollPage, slipPage, appraisalPage, expensePage, appointmentPage, dashPage]) => {
        setEmployees(employeePage.data)
        setShifts(shiftPage.data)
        setAttendance(attendancePage.data)
        setLeaves(leavePage.data)
        setRuns(payrollPage.data)
        setSlips(slipPage.data)
        setAppraisals(appraisalPage.data)
        setExpenses(expensePage.data)
        setAppointments(appointmentPage.data)
        setDashboard(dashPage.data)
        setPhase('ready')
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }

  useEffect(() => load(), [])

  useEffect(() => {
    if (!selectedId) {
      setProfile(null)
      return
    }
    const controller = new AbortController()
    apiRequest<{ data: Employee360 }>(`/api/v1/hr/employees/${selectedId}/profile`, { signal: controller.signal })
      .then((page) => setProfile(page.data))
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
      })
    return () => controller.abort()
  }, [selectedId])

  async function addEmployee(event: FormEvent) {
    event.preventDefault()
    const basic = money(salary)
    const extra = money(allowances)
    if (basic === null || extra === null) return
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest('/api/v1/hr/employees', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: {
          employeeCode: code,
          fullName: name,
          roleTitle: role,
          department,
          branchId: null,
          basicSalaryMinor: basic,
          allowancesMinor: extra,
          residencyExpiry: residency || null,
          status: 'active',
        },
      })
      setNotice(t('hr.saved'))
      setShowCreate(false)
      load()
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function runPayroll(event?: FormEvent) {
    event?.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest('/api/v1/hr/payroll', { method: 'POST', idempotencyKey: newIdempotencyKey(), body: { period, entryDate, deductions: [] } })
      setNotice(t('hr.saved'))
      load()
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function decideLeave(id: string, version: number, decision: 'approved' | 'rejected') {
    setBusy(true)
    try {
      await apiRequest(`/api/v1/hr/leaves/${id}`, { method: 'POST', body: { decision, version } })
      setNotice(t('hr.saved'))
      load()
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function removeEmployee(employee: Employee) {
    if (!window.confirm(t('hr.deleteConfirm'))) return
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest(`/api/v1/hr/employees/${employee.id}`, { method: 'DELETE' })
      setEmployees((current) => current.filter((row) => row.id !== employee.id))
      if (selectedId === employee.id) setSelectedId(null)
      setNotice(t('hr.saved'))
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function decideExpense(id: string, version: number) {
    setBusy(true)
    try {
      await apiRequest(`/api/v1/hr/expenses/${id}`, {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { decision: 'approved', entryDate, version },
      })
      setNotice(t('hr.saved'))
      load()
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  const kwd = t('admin.kwd')
  const departmentCounts = useMemo(() => countMap(employees.map((row) => row.departmentRoot ?? row.department)), [employees])
  const locationCounts = useMemo(() => countMap(employees.map((row) => row.workLocation)), [employees])
  const visibleEmployees = employees.filter((employee) => {
    const root = employee.departmentRoot ?? employee.department
    if (departmentFilter && root !== departmentFilter) return false
    if (locationFilter && (employee.workLocation ?? '—') !== locationFilter) return false
    return true
  })

  if (phase === 'loading') return <p className="text-sm text-gray-400">{t('hr.loading')}</p>
  if (phase === 'error') return <p className={errorClass} role="alert">{t(error)}</p>

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('hr.title')}</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">{t('hr.lead')}</p>
        </div>
        {tab === 'employees' && canEmployees ? (
          <button className={primaryButton} type="button" onClick={() => setShowCreate(true)}>+ {t('hr.new')}</button>
        ) : null}
      </header>
      {notice ? <p className={noticeClass}>{notice}</p> : null}

      <nav className="flex flex-wrap gap-2 border-b border-[#30363d] pb-3">
        {tabs.map((item) => (
          <button key={item} className={tab === item ? primaryButton : secondaryButton} type="button" onClick={() => setTab(item)}>
            {t(`hr.nav.${item}` as MessageKey)}
          </button>
        ))}
      </nav>

      {tab === 'employees' ? (
        <section className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className={`${panelClass} space-y-4`}>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('suite.facet.department')}</p>
              <button type="button" className={`block w-full rounded-lg px-2 py-1.5 text-start text-sm ${!departmentFilter ? 'bg-blue-500/20 text-blue-100' : 'text-gray-300 hover:bg-white/5'}`} onClick={() => setDepartmentFilter(null)}>
                {t('suite.all')} ({employees.length})
              </button>
              {departmentCounts.map(([label, count]) => (
                <button key={label} type="button" className={`block w-full rounded-lg px-2 py-1.5 text-start text-sm ${departmentFilter === label ? 'bg-blue-500/20 text-blue-100' : 'text-gray-300 hover:bg-white/5'}`} onClick={() => setDepartmentFilter(label)}>
                  {label} <span className="text-gray-500">({count})</span>
                </button>
              ))}
            </div>
            <div className="space-y-2 border-t border-[#30363d] pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('hr.facet.location')}</p>
              <button type="button" className={`block w-full rounded-lg px-2 py-1.5 text-start text-sm ${!locationFilter ? 'bg-blue-500/20 text-blue-100' : 'text-gray-300 hover:bg-white/5'}`} onClick={() => setLocationFilter(null)}>
                {t('suite.all')} ({employees.length})
              </button>
              {locationCounts.map(([label, count]) => (
                <button key={label} type="button" className={`block w-full rounded-lg px-2 py-1.5 text-start text-sm ${locationFilter === label ? 'bg-blue-500/20 text-blue-100' : 'text-gray-300 hover:bg-white/5'}`} onClick={() => setLocationFilter(label)}>
                  {label} <span className="text-gray-500">({count})</span>
                </button>
              ))}
            </div>
          </aside>

          <div className={panelClass}>
            <div className="mb-4 flex flex-wrap gap-2">
              <button type="button" className={employeeView === 'kanban' ? primaryButton : secondaryButton} onClick={() => setEmployeeView('kanban')}>{t('suite.view.kanban')}</button>
              <button type="button" className={employeeView === 'list' ? primaryButton : secondaryButton} onClick={() => setEmployeeView('list')}>{t('suite.view.list')}</button>
              <span className="ms-auto self-center text-xs text-gray-500">{visibleEmployees.length} / {employees.length}</span>
            </div>
            {visibleEmployees.length === 0 ? <p className="text-sm text-gray-400">{t('hr.empty')}</p> : null}
            {employeeView === 'kanban' && visibleEmployees.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleEmployees.map((employee) => (
                  <button key={employee.id} type="button" className="rounded-xl border border-[#30363d] bg-[#161b22] p-4 text-start transition hover:border-gold-400/40" onClick={() => { setSelectedId(employee.id); setDrawerPane('contract') }}>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-400/20 text-sm font-bold text-gold-300">
                        {employee.avatarInitials ?? employee.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <span className={`h-2.5 w-2.5 rounded-full ${employee.status === 'active' ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                    </div>
                    <p className="font-semibold text-white">{employee.fullName}</p>
                    <p className="text-xs text-gray-400">{employee.roleTitle}</p>
                    <p className="mt-2 text-xs text-gray-300">{t('hr.badge')}: {employee.badgeCode ?? employee.employeeCode}</p>
                    <p className="text-xs text-gray-400">{employee.workPhone || employee.mobilePhone || '—'}</p>
                    <p className="truncate text-xs text-gray-400">{employee.workEmail || '—'}</p>
                    {employee.workLocation ? <span className="mt-3 inline-block rounded-md bg-white/5 px-2 py-1 text-[11px] text-gold-200">{employee.workLocation}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
            {employeeView === 'list' && visibleEmployees.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr>
                    <th className="px-2 py-2 text-start">{t('hr.badge')}</th>
                    <th className="px-2 py-2 text-start">{t('hr.name')}</th>
                    <th className="px-2 py-2 text-start">{t('hr.role')}</th>
                    <th className="px-2 py-2 text-start">{t('hr.department')}</th>
                    <th className="px-2 py-2 text-start">{t('hr.facet.location')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.map((employee) => (
                    <tr key={employee.id} className="border-t border-[#30363d]">
                      <td className="px-2 py-3">{employee.badgeCode ?? employee.employeeCode}</td>
                      <td className="px-2 py-3">
                        <button type="button" className="text-start text-white hover:text-gold-300" onClick={() => setSelectedId(employee.id)}>{employee.fullName}</button>
                      </td>
                      <td className="px-2 py-3">{employee.roleTitle}</td>
                      <td className="px-2 py-3">{employee.departmentRoot ?? employee.department}</td>
                      <td className="px-2 py-3">{employee.workLocation ?? '—'}</td>
                      <td className="px-2 py-3">{canEmployees ? <button className={dangerButton} type="button" disabled={busy} onClick={() => void removeEmployee(employee)}>{t('hr.delete')}</button> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === 'departments' ? (
        <section className={panelClass}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {departmentCounts.map(([label, count]) => (
              <article key={label} className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
                <p className="font-semibold text-white">{label}</p>
                <p className="mt-2 text-2xl text-gold-300">{count}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'documents' || tab === 'custody' || tab === 'loans' || tab === 'overtimes' ? (
        <section className={panelClass}>
          <p className="text-sm text-gray-300">{t('hr.drawer.hint')}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {employees.slice(0, 24).map((employee) => (
              <button key={employee.id} type="button" className="rounded-lg border border-[#30363d] px-3 py-2 text-start text-sm text-gray-200 hover:border-gold-400/40" onClick={() => { setSelectedId(employee.id); setDrawerPane(tab === 'documents' ? 'documents' : tab === 'custody' ? 'custody' : tab === 'loans' ? 'loans' : 'overtimes'); setTab('employees') }}>
                {employee.fullName}
                <span className="mt-1 block text-xs text-gray-500">{employee.badgeCode ?? employee.employeeCode}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'attendance' ? (
        <section className={panelClass}>
          <h2 className="mb-3 text-sm text-gray-300">{t('hr.shift')}</h2>
          {shifts.length === 0 ? <p className="text-sm text-gray-400">{t('hr.empty')}</p> : shifts.map((shift) => (
            <p key={shift.id} className="text-sm text-gray-100">{shift.name} — {shift.startsAt}–{shift.endsAt}</p>
          ))}
          <h2 className="mb-3 mt-6 text-sm text-gray-300">{t('hr.nav.attendance')}</h2>
          {attendance.length === 0 ? <p className="text-sm text-gray-400">{t('hr.empty')}</p> : attendance.slice(0, 80).map((row) => (
            <p key={row.id} className="text-sm text-gray-100">{row.employeeName} — {row.checkIn} {row.checkOut ? `→ ${row.checkOut}` : ''} · {t('hr.overtime')} {row.overtimeMinutes}</p>
          ))}
        </section>
      ) : null}

      {tab === 'leaves' ? (
        <section className={panelClass}>
          {leaves.length === 0 ? <p className="text-sm text-gray-400">{t('hr.empty')}</p> : (
            <table className="w-full text-sm">
              <thead className="text-gray-400"><tr><th className="px-2 py-2 text-start">{t('hr.name')}</th><th className="px-2 py-2 text-start">{t('hr.leaveType')}</th><th className="px-2 py-2 text-start">{t('hr.days')}</th><th className="px-2 py-2 text-start">{t('hr.status')}</th><th /></tr></thead>
              <tbody>
                {leaves.slice(0, 100).map((leave) => (
                  <tr key={leave.id} className="border-t border-[#30363d]">
                    <td className="px-2 py-3">{leave.employeeName}</td>
                    <td className="px-2 py-3">{t(`hr.${leave.leaveType}` as MessageKey)}</td>
                    <td className="px-2 py-3">{leave.days}</td>
                    <td className="px-2 py-3">{t(`hr.${leave.approvalStatus}` as MessageKey)}</td>
                    <td className="px-2 py-3">
                      {canLeave && leave.approvalStatus === 'pending' ? (
                        <span className="flex gap-2">
                          <button className={primaryButton} type="button" disabled={busy} onClick={() => void decideLeave(leave.id, leave.version, 'approved')}>{t('hr.approve')}</button>
                          <button className={secondaryButton} type="button" disabled={busy} onClick={() => void decideLeave(leave.id, leave.version, 'rejected')}>{t('hr.reject')}</button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {tab === 'payroll' ? (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {payrollSubs.map((item) => (
              <button key={item} type="button" className={payrollSub === item ? primaryButton : secondaryButton} onClick={() => setPayrollSub(item)}>
                {t(`hr.pay.${item}` as MessageKey)}
              </button>
            ))}
          </div>

          {payrollSub === 'dashboard' && dashboard ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <article className={panelClass}>
                <h2 className="mb-3 text-sm font-semibold text-amber-200">{t('hr.pay.warnings')}</h2>
                <ul className="space-y-2 text-sm text-gray-200">
                  <li>{dashboard.warnings.withoutRunningContracts} {t('hr.payroll.warn.contracts')}</li>
                  <li>{dashboard.warnings.missingFromOpenBatches} {t('hr.payroll.warn.batches')}</li>
                  <li>{dashboard.warnings.conflicts} {t('hr.payroll.warn.conflicts')}</li>
                  <li>{dashboard.warnings.newContracts} {t('hr.pay.warn.newContracts')}</li>
                  <li>{dashboard.warnings.timeOffToDefer} {t('hr.pay.warn.defer')}</li>
                  <li>{dashboard.warnings.timeOffWithoutJoinedDocument} {t('hr.pay.warn.docs')}</li>
                </ul>
                <button className={`${secondaryButton} mt-4`} type="button" disabled={busy} onClick={() => void runPayroll()}>{t('hr.pay.aiResolve')}</button>
              </article>
              <article className={panelClass}>
                <h2 className="mb-3 text-sm font-semibold text-gray-300">{t('hr.payroll.batches')}</h2>
                <div className="space-y-3">
                  {dashboard.batches.map((batch) => (
                    <div key={batch.period} className="rounded-lg border border-[#30363d] p-3">
                      <p className="font-medium text-white">{batch.label}</p>
                      <p className="text-xs text-gray-400">[{batch.status === 'new' ? t('hr.pay.batch.new') : t('hr.pay.batch.done')} — {batch.payslipCount} {t('hr.pay.payslips')}]</p>
                      {batch.status === 'new' && batch.generateTarget > 0 && canPayroll ? (
                        <button className={`${primaryButton} mt-2`} type="button" disabled={busy} onClick={() => { setPeriod(batch.period); void runPayroll() }}>
                          {t('hr.pay.generate')} {batch.generateTarget}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
              <article className={panelClass}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-gray-300">{t('hr.pay.employerCost')}</h2>
                  <div className="flex gap-2">
                    <button type="button" className={costMode === 'monthly' ? primaryButton : secondaryButton} onClick={() => setCostMode('monthly')}>{t('hr.pay.monthly')}</button>
                    <button type="button" className={costMode === 'annually' ? primaryButton : secondaryButton} onClick={() => setCostMode('annually')}>{t('hr.pay.annually')}</button>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gold-300">
                  {formatMinor(costMode === 'monthly' ? dashboard.employerCostMonthlyMinor : dashboard.employerCostAnnualMinor)} {kwd}
                </p>
              </article>
              <article className={panelClass}>
                <h2 className="mb-3 text-sm font-semibold text-gray-300">{t('hr.pay.trends')}</h2>
                <p className="text-sm text-gray-200">{dashboard.trends.newEmployees} {t('hr.pay.newEmployees')}</p>
                <p className="text-sm text-gray-200">{dashboard.trends.lastDepartures} {t('hr.pay.departures')}</p>
                <div className="mt-4 flex items-end gap-3">
                  {dashboard.trends.bars.map((bar) => (
                    <div key={bar.month} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-28 w-full items-end gap-1">
                        <div className="w-1/2 rounded-t bg-emerald-500/70" style={{ height: `${Math.min(100, bar.hires * 20)}%` }} />
                        <div className="w-1/2 rounded-t bg-rose-500/70" style={{ height: `${Math.min(100, bar.departures * 20)}%` }} />
                      </div>
                      <span className="text-[11px] text-gray-500">{bar.month.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          ) : null}

          {payrollSub === 'payslips' || payrollSub === 'contracts' || payrollSub === 'entries' ? (
            <div className={panelClass}>
              {canPayroll && payrollSub === 'payslips' ? (
                <form className="mb-4 flex flex-wrap gap-3" onSubmit={(event) => void runPayroll(event)}>
                  <label className={labelClass}>{t('hr.period')}<input className={inputClass} required value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
                  <label className={labelClass}>{t('hr.start')}<input className={inputClass} type="date" required value={entryDate} onChange={(event) => setEntryDate(event.target.value)} /></label>
                  <div className="flex items-end"><button className={primaryButton} type="submit" disabled={busy}>{t('hr.run')}</button></div>
                </form>
              ) : null}
              {runs.map((run) => (
                <p key={run.id} className="text-sm text-gray-100">{run.period} — {run.status} — {t('hr.net')} {formatMinor(run.netMinor)} {kwd}</p>
              ))}
              <div className="mt-4 max-h-96 space-y-1 overflow-auto">
                {slips.slice(0, 200).map((slip) => (
                  <p key={slip.id} className="text-sm text-gray-300">{slip.period} · {slip.employeeName} — {t('hr.net')} {formatMinor(slip.netMinor)} {kwd}</p>
                ))}
              </div>
            </div>
          ) : null}

          {payrollSub === 'affects' || payrollSub === 'provisions' || payrollSub === 'reporting' || payrollSub === 'config' ? (
            <div className={panelClass}>
              <p className="text-sm text-gray-300">{t('hr.pay.subHint')}</p>
              <p className="mt-3 text-xs text-gray-500">{appraisals.length} {t('hr.tab.appraisals')} · {expenses.length} {t('hr.tab.expenses')} · {appointments.length} {t('hr.tab.appointments')}</p>
              {expenses.slice(0, 20).map((row) => (
                <div key={row.id} className="mt-2 flex flex-wrap items-center gap-3 border-t border-[#30363d] py-2 text-sm">
                  <span>{row.employeeName}</span>
                  <span>{row.category}</span>
                  <span>{formatMinor(row.amountMinor)} {kwd}</span>
                  {canExpense && row.approvalStatus === 'pending' ? <button className={primaryButton} type="button" disabled={busy} onClick={() => void decideExpense(row.id, row.version)}>{t('hr.approve')}</button> : null}
                </div>
              ))}
              {canAppointment ? <SuperOdooBoard app="recruitment" title="spec.recruitment" canManage={canSuite} /> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {showCreate ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <form className={`${panelClass} w-full max-w-xl space-y-3`} onSubmit={(event) => void addEmployee(event)}>
            <h2 className="text-lg font-semibold text-white">{t('hr.new')}</h2>
            <label className={labelClass}>{t('hr.code')}<input className={inputClass} required value={code} onChange={(event) => setCode(event.target.value)} /></label>
            <label className={labelClass}>{t('hr.name')}<input className={inputClass} required value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className={labelClass}>{t('hr.role')}<input className={inputClass} required value={role} onChange={(event) => setRole(event.target.value)} /></label>
            <label className={labelClass}>{t('hr.department')}<input className={inputClass} required value={department} onChange={(event) => setDepartment(event.target.value)} /></label>
            <label className={labelClass}>{t('hr.salary')}<input className={inputClass} required value={salary} onChange={(event) => setSalary(event.target.value)} /></label>
            <label className={labelClass}>{t('hr.allowances')}<input className={inputClass} required value={allowances} onChange={(event) => setAllowances(event.target.value)} /></label>
            <label className={labelClass}>{t('hr.residency')}<input className={inputClass} type="date" value={residency} onChange={(event) => setResidency(event.target.value)} /></label>
            <div className="flex gap-2">
              <button className={primaryButton} type="submit" disabled={busy}>{t('hr.add')}</button>
              <button className={secondaryButton} type="button" onClick={() => setShowCreate(false)}>{t('hr.cancel')}</button>
            </div>
          </form>
        </div>
      ) : null}

      {selectedId && profile ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50">
          <aside className="h-full w-full max-w-xl overflow-y-auto border-s border-[#30363d] bg-[#0d1117] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xl font-bold text-white">{profile.employee.fullName}</p>
                <p className="text-sm text-gray-400">{profile.employee.roleTitle}</p>
                <p className="mt-1 text-xs text-gray-500">{t('hr.badge')}: {profile.employee.badgeCode ?? profile.employee.employeeCode}</p>
              </div>
              <button type="button" className={secondaryButton} onClick={() => setSelectedId(null)}>{t('hr.close')}</button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {drawerPanes.map((pane) => (
                <button key={pane} type="button" className={drawerPane === pane ? primaryButton : secondaryButton} onClick={() => setDrawerPane(pane)}>
                  {t(`hr.drawer.${pane}` as MessageKey)}
                </button>
              ))}
            </div>
            {drawerPane === 'contract' ? (
              <div className="space-y-2 text-sm">
                {profile.contracts.length === 0 ? <p className="text-gray-400">{t('hr.empty')}</p> : profile.contracts.map((row) => (
                  <p key={row.id} className="rounded-lg border border-[#30363d] p-3 text-gray-200">{row.name} · {row.state} · {row.dateStart}{row.dateEnd ? ` → ${row.dateEnd}` : ''} · {formatMinor(row.wageMinor)} {kwd}</p>
                ))}
              </div>
            ) : null}
            {drawerPane === 'payslips' ? (
              <div className="space-y-2 text-sm">
                {profile.payslips.length === 0 ? <p className="text-gray-400">{t('hr.empty')}</p> : profile.payslips.map((row) => (
                  <p key={row.id} className="text-gray-200">{row.period} — {formatMinor(row.netMinor)} {kwd}</p>
                ))}
              </div>
            ) : null}
            {drawerPane === 'attendance' ? (
              <div className="space-y-2 text-sm">
                {profile.attendance.length === 0 ? <p className="text-gray-400">{t('hr.empty')}</p> : profile.attendance.map((row) => (
                  <p key={row.id} className="text-gray-200">{row.checkIn} {row.checkOut ? `→ ${row.checkOut}` : ''}</p>
                ))}
              </div>
            ) : null}
            {drawerPane === 'leaves' ? (
              <div className="space-y-2 text-sm">
                {profile.leaves.length === 0 ? <p className="text-gray-400">{t('hr.empty')}</p> : profile.leaves.map((row) => (
                  <p key={row.id} className="text-gray-200">{row.startDate} → {row.endDate} · {row.leaveType} · {row.approvalStatus}</p>
                ))}
              </div>
            ) : null}
            {drawerPane === 'custody' ? (
              <div className="space-y-2 text-sm">
                {profile.custody.length === 0 ? <p className="text-gray-400">{t('hr.empty')}</p> : profile.custody.map((row) => (
                  <p key={row.id} className="text-gray-200">{row.itemName} · {row.status}</p>
                ))}
              </div>
            ) : null}
            {drawerPane === 'loans' ? (
              <div className="space-y-2 text-sm">
                {profile.loans.length === 0 ? <p className="text-gray-400">{t('hr.empty')}</p> : profile.loans.map((row) => (
                  <p key={row.id} className="text-gray-200">{formatMinor(row.remainingMinor)} / {formatMinor(row.principalMinor)} {kwd}</p>
                ))}
              </div>
            ) : null}
            {drawerPane === 'overtimes' ? (
              <div className="space-y-2 text-sm">
                {profile.overtimes.length === 0 ? <p className="text-gray-400">{t('hr.empty')}</p> : profile.overtimes.map((row) => (
                  <p key={row.id} className="text-gray-200">{row.workDate} · {row.minutes} {t('hr.overtime')}</p>
                ))}
              </div>
            ) : null}
            {drawerPane === 'documents' ? (
              <div className="space-y-2 text-sm">
                {profile.documents.length === 0 ? <p className="text-gray-400">{t('hr.empty')}</p> : profile.documents.map((row) => (
                  <p key={row.id} className="text-gray-200">{row.title} · {row.docType} · {row.status}</p>
                ))}
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  )
}

export default function HrWorkspace({ permissions: held, initialTab }: { permissions: readonly string[]; initialTab: string }) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace initialTab={initialTab} />
    </PermissionProvider>
  )
}
