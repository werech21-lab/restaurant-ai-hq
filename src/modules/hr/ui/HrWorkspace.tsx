'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { errorClass, inputClass, labelClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor, parseKwdToMinor } from '@/lib/money'
import type { Appraisal, Attendance, Employee, EmployeeExpense, Leave, PayrollRun, Payslip, Shift } from '@/modules/hr/client'

type Tab = 'employees' | 'attendance' | 'leaves' | 'payroll' | 'appraisals' | 'expenses'
const tabs: readonly Tab[] = ['employees', 'attendance', 'leaves', 'payroll', 'appraisals', 'expenses']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function money(input: string): number | null {
  return parseKwdToMinor(input)
}

function Workspace({ initialTab }: { initialTab: string }) {
  const { t } = useI18n()
  const canEmployees = useCan(permissions.hrEmployeeManage)
  const canAttendance = useCan(permissions.hrAttendanceManage)
  const canLeave = useCan(permissions.hrLeaveApprove)
  const canPayroll = useCan(permissions.hrPayrollRun)
  const canAppraisal = useCan(permissions.hrAppraisalManage)
  const canExpense = useCan(permissions.hrExpenseApprove)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'employees')
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [slips, setSlips] = useState<Payslip[]>([])
  const [appraisals, setAppraisals] = useState<Appraisal[]>([])
  const [expenses, setExpenses] = useState<EmployeeExpense[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [department, setDepartment] = useState('')
  const [salary, setSalary] = useState('')
  const [allowances, setAllowances] = useState('0')
  const [residency, setResidency] = useState('')
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
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
    ])
      .then(([employeePage, shiftPage, attendancePage, leavePage, payrollPage, slipPage, appraisalPage, expensePage]) => {
        setEmployees(employeePage.data)
        setShifts(shiftPage.data)
        setAttendance(attendancePage.data)
        setLeaves(leavePage.data)
        setRuns(payrollPage.data)
        setSlips(slipPage.data)
        setAppraisals(appraisalPage.data)
        setExpenses(expensePage.data)
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
        body: { employeeCode: code, fullName: name, roleTitle: role, department, branchId: null, basicSalaryMinor: basic, allowancesMinor: extra, residencyExpiry: residency || null, status: 'active' },
      })
      setNotice(t('hr.saved'))
      load()
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function runPayroll(event: FormEvent) {
    event.preventDefault()
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

  async function decideExpense(id: string, version: number, decision: 'approved' | 'rejected') {
    setBusy(true)
    try {
      await apiRequest(`/api/v1/hr/expenses/${id}`, { method: 'POST', idempotencyKey: newIdempotencyKey(), body: { decision, entryDate, version } })
      setNotice(t('hr.saved'))
      load()
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  const kwd = t('admin.kwd')
  if (phase === 'loading') return <p className="text-sm text-gray-400">{t('hr.loading')}</p>
  if (phase === 'error') return <p className={errorClass} role="alert">{t(error)}</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">{t('hr.title')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">{t('hr.lead')}</p>
      </header>
      {notice ? <p className={noticeClass}>{notice}</p> : null}
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item} className={tab === item ? primaryButton : secondaryButton} type="button" onClick={() => setTab(item)}>{t(`hr.tab.${item}` as MessageKey)}</button>
        ))}
      </div>
      {tab === 'employees' ? (
        <section className={panelClass}>
          {canEmployees ? (
            <form className="mb-4 grid gap-3 sm:grid-cols-2" onSubmit={addEmployee}>
              <label className={labelClass}>{t('hr.code')}<input className={inputClass} required value={code} onChange={(event) => setCode(event.target.value)} /></label>
              <label className={labelClass}>{t('hr.name')}<input className={inputClass} required value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label className={labelClass}>{t('hr.role')}<input className={inputClass} required value={role} onChange={(event) => setRole(event.target.value)} /></label>
              <label className={labelClass}>{t('hr.department')}<input className={inputClass} required value={department} onChange={(event) => setDepartment(event.target.value)} /></label>
              <label className={labelClass}>{t('hr.salary')}<input className={inputClass} required value={salary} onChange={(event) => setSalary(event.target.value)} /></label>
              <label className={labelClass}>{t('hr.allowances')}<input className={inputClass} required value={allowances} onChange={(event) => setAllowances(event.target.value)} /></label>
              <label className={labelClass}>{t('hr.residency')}<input className={inputClass} type="date" value={residency} onChange={(event) => setResidency(event.target.value)} /></label>
              <div className="flex items-end"><button className={primaryButton} type="submit" disabled={busy}>{t('hr.add')}</button></div>
            </form>
          ) : null}
          {employees.length === 0 ? <p className="text-sm text-gray-400">{t('hr.empty')}</p> : (
            <table className="w-full text-sm">
              <thead className="text-gray-400"><tr><th className="px-2 py-2 text-start">{t('hr.code')}</th><th className="px-2 py-2 text-start">{t('hr.name')}</th><th className="px-2 py-2 text-start">{t('hr.role')}</th><th className="px-2 py-2 text-start">{t('hr.salary')}</th><th className="px-2 py-2 text-start">{t('hr.residency')}</th><th className="px-2 py-2 text-start">{t('hr.status')}</th></tr></thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="border-t border-[#30363d]">
                    <td className="px-2 py-3">{employee.employeeCode}</td>
                    <td className="px-2 py-3">{employee.fullName}</td>
                    <td className="px-2 py-3">{employee.roleTitle}</td>
                    <td className="px-2 py-3">{formatMinor(employee.basicSalaryMinor)} {kwd}</td>
                    <td className="px-2 py-3">{employee.residencyExpiry ?? '—'}</td>
                    <td className="px-2 py-3">{t(employee.status === 'active' ? 'hr.active' : 'hr.inactive')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
      {tab === 'attendance' ? (
        <section className={panelClass}>
          <h2 className="mb-3 text-sm text-gray-300">{t('hr.shift')}</h2>
          {shifts.length === 0 ? <p className="text-sm text-gray-400">{t('hr.empty')}</p> : shifts.map((shift) => (
            <p key={shift.id} className="text-sm text-gray-100">{shift.name} — {shift.startsAt}–{shift.endsAt}</p>
          ))}
          <h2 className="mb-3 mt-6 text-sm text-gray-300">{t('hr.tab.attendance')}</h2>
          {attendance.length === 0 ? <p className="text-sm text-gray-400">{t('hr.empty')}</p> : attendance.map((row) => (
            <p key={row.id} className="text-sm text-gray-100">{row.employeeName} — {t('hr.overtime')} {row.overtimeMinutes}</p>
          ))}
          {canAttendance ? null : null}
        </section>
      ) : null}
      {tab === 'leaves' ? (
        <section className={panelClass}>
          {leaves.length === 0 ? <p className="text-sm text-gray-400">{t('hr.empty')}</p> : (
            <table className="w-full text-sm">
              <thead className="text-gray-400"><tr><th className="px-2 py-2 text-start">{t('hr.name')}</th><th className="px-2 py-2 text-start">{t('hr.leaveType')}</th><th className="px-2 py-2 text-start">{t('hr.days')}</th><th className="px-2 py-2 text-start">{t('hr.status')}</th><th /></tr></thead>
              <tbody>
                {leaves.map((leave) => (
                  <tr key={leave.id} className="border-t border-[#30363d]">
                    <td className="px-2 py-3">{leave.employeeName}</td>
                    <td className="px-2 py-3">{t(`hr.${leave.leaveType}` as MessageKey)}</td>
                    <td className="px-2 py-3">{leave.days}</td>
                    <td className="px-2 py-3">{t(`hr.${leave.approvalStatus}` as MessageKey)}</td>
                    <td className="px-2 py-3">
                      {canLeave && leave.approvalStatus === 'pending' ? (
                        <span className="flex gap-2">
                          <button className={primaryButton} type="button" disabled={busy} onClick={() => decideLeave(leave.id, leave.version, 'approved')}>{t('hr.approve')}</button>
                          <button className={secondaryButton} type="button" disabled={busy} onClick={() => decideLeave(leave.id, leave.version, 'rejected')}>{t('hr.reject')}</button>
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
        <section className={panelClass}>
          {canPayroll ? (
            <form className="mb-4 flex flex-wrap gap-3" onSubmit={runPayroll}>
              <label className={labelClass}>{t('hr.period')}<input className={inputClass} required value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
              <label className={labelClass}>{t('hr.start')}<input className={inputClass} type="date" required value={entryDate} onChange={(event) => setEntryDate(event.target.value)} /></label>
              <div className="flex items-end"><button className={primaryButton} type="submit" disabled={busy}>{t('hr.run')}</button></div>
            </form>
          ) : null}
          {runs.length === 0 ? <p className="text-sm text-gray-400">{t('hr.empty')}</p> : runs.map((run) => (
            <p key={run.id} className="text-sm text-gray-100">{run.period} — {t('hr.net')} {formatMinor(run.netMinor)} {kwd}</p>
          ))}
          <div className="mt-4 space-y-1">
            {slips.map((slip) => (
              <p key={slip.id} className="text-sm text-gray-300">{slip.employeeName} — {t('hr.gross')} {formatMinor(slip.grossMinor)} / {t('hr.net')} {formatMinor(slip.netMinor)} {kwd}</p>
            ))}
          </div>
        </section>
      ) : null}
      {tab === 'appraisals' ? (
        <section className={panelClass}>
          {appraisals.length === 0 ? <p className="text-sm text-gray-400">{t('hr.empty')}</p> : appraisals.map((row) => (
            <p key={row.id} className="text-sm text-gray-100">{row.employeeName} — {t('hr.rating')} {row.rating} / {t('hr.kpi')} {row.kpiScore} — {row.reviewerNotes}</p>
          ))}
          {canAppraisal ? null : null}
        </section>
      ) : null}
      {tab === 'expenses' ? (
        <section className={panelClass}>
          {expenses.length === 0 ? <p className="text-sm text-gray-400">{t('hr.empty')}</p> : expenses.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-3 border-t border-[#30363d] py-3 text-sm">
              <span>{row.employeeName}</span>
              <span>{row.category}</span>
              <span>{formatMinor(row.amountMinor)} {kwd}</span>
              <span>{t(`hr.${row.approvalStatus}` as MessageKey)}</span>
              {canExpense && row.approvalStatus === 'pending' ? (
                <button className={primaryButton} type="button" disabled={busy} onClick={() => decideExpense(row.id, row.version, 'approved')}>{t('hr.approve')}</button>
              ) : null}
            </div>
          ))}
        </section>
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
