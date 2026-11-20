'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Users } from 'lucide-react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { HrDigitalDossier } from '@/components/hr-digital-dossier'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatDateTime,
  formatInt,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { parseKwdToMinor } from '@/lib/money'
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

function HrDossierPanel({
  employeeCode,
  employeeName,
}: {
  employeeCode: string
  employeeName: string
}) {
  const { locale } = useI18n()
  const [prismaId, setPrismaId] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/hr/ingest-folder', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as {
          data?: { employees?: Array<{ id: string; code: string; name: string }> }
        }
        const list = json.data?.employees || []
        const hit =
          list.find((row) => row.code === employeeCode) ||
          list.find((row) => row.name.toLowerCase() === employeeName.toLowerCase()) ||
          null
        setPrismaId(hit?.id ?? null)
      })
      .catch(() => setPrismaId(null))
    return () => controller.abort()
  }, [employeeCode, employeeName])

  if (!prismaId) {
    return (
      <p className="text-xs text-slate-600 dark:text-slate-400">
        {locale === 'en'
          ? 'No panel dossier linked yet.'
          : 'لا توجد خزانة مربوطة في اللوحة بعد.'}
      </p>
    )
  }
  return (
    <div className="ds-surface-subtle rounded-xl p-2">
      <HrDigitalDossier employeeId={prismaId} locale={locale} />
    </div>
  )
}

type Tab =
  | 'employees'
  | 'departments'
  | 'documents'
  | 'custody'
  | 'loans'
  | 'overtimes'
  | 'attendance'
  | 'leaves'
  | 'payroll'
type PayrollSub =
  | 'dashboard'
  | 'contracts'
  | 'affects'
  | 'entries'
  | 'payslips'
  | 'provisions'
  | 'reporting'
  | 'config'
type DrawerPane =
  | 'contract'
  | 'payslips'
  | 'attendance'
  | 'leaves'
  | 'custody'
  | 'loans'
  | 'overtimes'
  | 'documents'

const tabs: readonly Tab[] = [
  'employees',
  'departments',
  'documents',
  'custody',
  'loans',
  'overtimes',
  'attendance',
  'leaves',
  'payroll',
]
const payrollSubs: readonly PayrollSub[] = [
  'dashboard',
  'contracts',
  'affects',
  'entries',
  'payslips',
  'provisions',
  'reporting',
  'config',
]
const drawerPanes: readonly DrawerPane[] = [
  'contract',
  'payslips',
  'attendance',
  'leaves',
  'custody',
  'loans',
  'overtimes',
  'documents',
]

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function money(input: string): number | null {
  return parseKwdToMinor(input)
}

const UNSPECIFIED_DEPT = '—'

function countMap(values: Array<string | null | undefined>): Array<[string, number]> {
  const acc: Record<string, number> = {}
  for (const value of values) {
    const key = value && value.trim() ? value : UNSPECIFIED_DEPT
    acc[key] = (acc[key] ?? 0) + 1
  }
  return Object.entries(acc).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

const inputCls =
  'ds-focus-ring mt-1.5 w-full rounded-xl border border-slate-300/90 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/15 dark:bg-[#0D1512] dark:text-slate-100'
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300'
const primaryBtnCls =
  'ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
const secondaryBtnCls =
  'ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-slate-300/90 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-100 dark:hover:bg-white/[0.06]'
const dangerBtnCls =
  'ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-rose-500/40 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/70'
const noticeCls =
  'rounded-xl border border-emerald-500/30 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200'

export interface HrWorkspaceInitialData {
  employees?: Employee[]
  shifts?: Shift[]
  attendance?: Attendance[]
  leaves?: Leave[]
  runs?: PayrollRun[]
  slips?: Payslip[]
  appraisals?: Appraisal[]
  expenses?: EmployeeExpense[]
  appointments?: Appointment[]
  dashboard?: PayrollDashboard | null
}

function formatMinorKwd(minor: number | null | undefined, locale: FormatLocale): string {
  if (typeof minor !== 'number' || !Number.isSafeInteger(minor)) {
    return UNAVAILABLE_DASH
  }
  return formatKwd(minor / 1000, { locale })
}

function Workspace({
  initialTab,
  initialPhase,
  initialError,
  initialData,
}: {
  initialTab: string
  initialPhase?: 'loading' | 'ready' | 'error'
  initialError?: MessageKey
  initialData?: HrWorkspaceInitialData
}) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const isAr = fmtLocale === 'ar'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)
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
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>(initialPhase ?? 'loading')
  const [error, setError] = useState<MessageKey>(initialError ?? 'erp.err.generic')
  const [actionError, setActionError] = useState<MessageKey | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const [employees, setEmployees] = useState<Employee[]>(initialData?.employees ?? [])
  const [shifts, setShifts] = useState<Shift[]>(initialData?.shifts ?? [])
  const [attendance, setAttendance] = useState<Attendance[]>(initialData?.attendance ?? [])
  const [leaves, setLeaves] = useState<Leave[]>(initialData?.leaves ?? [])
  const [runs, setRuns] = useState<PayrollRun[]>(initialData?.runs ?? [])
  const [slips, setSlips] = useState<Payslip[]>(initialData?.slips ?? [])
  const [appraisals, setAppraisals] = useState<Appraisal[]>(initialData?.appraisals ?? [])
  const [expenses, setExpenses] = useState<EmployeeExpense[]>(initialData?.expenses ?? [])
  const [appointments, setAppointments] = useState<Appointment[]>(
    initialData?.appointments ?? [],
  )
  const [dashboard, setDashboard] = useState<PayrollDashboard | null>(
    initialData?.dashboard ?? null,
  )

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
  const [entryDate, setEntryDate] = useState(() => formatDate(new Date(), 'en'))
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1)
  }, [])

  useEffect(() => {
    if (initialPhase !== undefined && reloadToken === 0) return
    const controller = new AbortController()
    setPhase('loading')
    Promise.all([
      apiRequest<{ data: Employee[] }>('/api/v1/hr/employees', { signal: controller.signal }),
      apiRequest<{ data: Shift[] }>('/api/v1/hr/shifts', { signal: controller.signal }),
      apiRequest<{ data: Attendance[] }>('/api/v1/hr/attendances', {
        signal: controller.signal,
      }),
      apiRequest<{ data: Leave[] }>('/api/v1/hr/leaves', { signal: controller.signal }),
      apiRequest<{ data: PayrollRun[] }>('/api/v1/hr/payroll', { signal: controller.signal }),
      apiRequest<{ data: Payslip[] }>('/api/v1/hr/payslips', { signal: controller.signal }),
      apiRequest<{ data: Appraisal[] }>('/api/v1/hr/appraisals', {
        signal: controller.signal,
      }),
      apiRequest<{ data: EmployeeExpense[] }>('/api/v1/hr/expenses', {
        signal: controller.signal,
      }),
      apiRequest<{ data: Appointment[] }>('/api/v1/hr/appointments', {
        signal: controller.signal,
      }),
      apiRequest<{ data: PayrollDashboard }>('/api/v1/hr/payroll/dashboard', {
        signal: controller.signal,
      }),
    ])
      .then(
        ([
          employeePage,
          shiftPage,
          attendancePage,
          leavePage,
          payrollPage,
          slipPage,
          appraisalPage,
          expensePage,
          appointmentPage,
          dashPage,
        ]) => {
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
          setActionError(null)
          setPhase('ready')
        },
      )
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }, [initialPhase, reloadToken])

  useEffect(() => {
    if (!selectedId) {
      setProfile(null)
      return
    }
    const controller = new AbortController()
    apiRequest<{ data: Employee360 }>(`/api/v1/hr/employees/${selectedId}/profile`, {
      signal: controller.signal,
    })
      .then((page) => setProfile(page.data))
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setActionError(errorKey(caught))
      })
    return () => controller.abort()
  }, [selectedId])

  useEffect(() => {
    if (!showCreate && !selectedId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selectedId) setSelectedId(null)
        else if (showCreate) setShowCreate(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showCreate, selectedId])

  async function addEmployee(event: FormEvent) {
    event.preventDefault()
    const basic = money(salary)
    const extra = money(allowances)
    if (basic === null || extra === null) {
      setActionError('erp.err.validation_failed')
      return
    }
    setBusy(true)
    setNotice(null)
    setActionError(null)
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
      reload()
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function runPayroll(event?: FormEvent, periodOverride?: string) {
    event?.preventDefault()
    const usePeriod = periodOverride ?? period
    const useEntryDate = usePeriod === '2026-10' ? '2026-10-31' : entryDate
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      await apiRequest('/api/v1/hr/payroll', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { period: usePeriod, entryDate: useEntryDate, deductions: [] },
      })
      if (periodOverride) setPeriod(periodOverride)
      setNotice(usePeriod === '2026-10' ? t('hr.pay.branchPosted') : t('hr.saved'))
      reload()
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function decideLeave(
    id: string,
    version: number,
    decision: 'approved' | 'rejected',
  ) {
    setBusy(true)
    setActionError(null)
    try {
      await apiRequest(`/api/v1/hr/leaves/${id}`, {
        method: 'POST',
        body: { decision, version },
      })
      setNotice(t('hr.saved'))
      reload()
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function removeEmployee(employee: Employee) {
    if (!window.confirm(t('hr.deleteConfirm'))) return
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      await apiRequest(`/api/v1/hr/employees/${employee.id}`, { method: 'DELETE' })
      setEmployees((current) => current.filter((row) => row.id !== employee.id))
      if (selectedId === employee.id) setSelectedId(null)
      setNotice(t('hr.saved'))
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function decideExpense(id: string, version: number) {
    setBusy(true)
    setActionError(null)
    try {
      await apiRequest(`/api/v1/hr/expenses/${id}`, {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { decision: 'approved', entryDate, version },
      })
      setNotice(t('hr.saved'))
      reload()
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  const departmentCounts = useMemo(
    () => countMap(employees.map((row) => row.departmentRoot ?? row.department)),
    [employees],
  )
  const locationCounts = useMemo(
    () => countMap(employees.map((row) => row.workLocation)),
    [employees],
  )
  const visibleEmployees = employees.filter((employee) => {
    const root = employee.departmentRoot ?? employee.department
    if (departmentFilter && root !== departmentFilter) return false
    if (locationFilter && (employee.workLocation ?? UNAVAILABLE_DASH) !== locationFilter) {
      return false
    }
    return true
  })

  if (phase === 'loading') {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-4">
        <StateBlock state="loading" locale={fmtLocale} skeletonRows={5} title={t('hr.loading')} />
      </div>
    )
  }

  if (phase === 'error') {
    const isForbidden = error === 'erp.err.forbidden' || error === 'erp.err.unauthenticated'
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-4">
        <StateBlock
          state={isForbidden ? 'forbidden' : 'error'}
          locale={fmtLocale}
          title={t(error)}
          onRetry={isForbidden ? undefined : reload}
        />
      </div>
    )
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-5">
      <SectionCard
        locale={fmtLocale}
        icon={<Users className="h-4 w-4" aria-hidden />}
        title={t('hr.title')}
        subtitle={t('hr.lead')}
        actions={
          tab === 'employees' && canEmployees ? (
            <button
              className={primaryBtnCls}
              type="button"
              onClick={() => setShowCreate(true)}
            >
              + {t('hr.new')}
            </button>
          ) : undefined
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <a
            href="/hr/smart-folder-upload"
            className="ds-focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
          >
            {t('hr.smartUpload')}
          </a>
          <a
            href="/hr/compliance-radar"
            className="ds-focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-700"
          >
            {t('hr.complianceRadar')}
          </a>
          <a
            href="/ess"
            className="ds-focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-slate-300/90 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-100"
          >
            {t('hr.ess')}
          </a>
          <a
            href={`/api/hr/wps-export?month=${period.slice(5, 7)}&year=${period.slice(0, 4)}&download=1`}
            className="ds-focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-amber-500/40 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {t('hr.wpsExport')}
          </a>
        </div>

        {notice ? (
          <p role="status" className={`${noticeCls} mb-4`}>
            {notice}
          </p>
        ) : null}
        {actionError ? (
          <div className="mb-4">
            <StateBlock
              state={actionError === 'erp.err.forbidden' ? 'forbidden' : 'error'}
              compact
              locale={fmtLocale}
              title={t(actionError)}
            />
          </div>
        ) : null}

        <nav
          role="tablist"
          aria-label={t('hr.title')}
          className="mb-5 flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar border-b border-[var(--ds-border-hairline)] pb-3"
        >
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              id={`hr-tab-${item}`}
              aria-selected={tab === item}
              aria-controls={`hr-panel-${item}`}
              className={`shrink-0 whitespace-nowrap ${tab === item ? primaryBtnCls : secondaryBtnCls}`}
              onClick={() => setTab(item)}
            >
              {t(`hr.nav.${item}` as MessageKey)}
            </button>
          ))}
        </nav>

        <div role="tabpanel" id={`hr-panel-${tab}`} aria-labelledby={`hr-tab-${tab}`}>
          {tab === 'employees' ? (
            <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
              <aside className="ds-surface-subtle space-y-4 rounded-2xl p-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300">
                    {t('suite.facet.department')}
                  </p>
                  <button
                    type="button"
                    className={`ds-focus-ring block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-start text-sm ${
                      !departmentFilter
                        ? 'bg-emerald-600 font-semibold text-white'
                        : 'text-slate-700 hover:bg-slate-200/70 dark:text-slate-200 dark:hover:bg-white/[0.06]'
                    }`}
                    onClick={() => setDepartmentFilter(null)}
                  >
                    {t('suite.all')}{' '}
                    <span dir="ltr" className="ds-num">
                      ({formatInt(employees.length, fmtLocale)})
                    </span>
                  </button>
                  {departmentCounts.map(([label, count]) => (
                    <button
                      key={label}
                      type="button"
                      className={`ds-focus-ring block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-start text-sm ${
                        departmentFilter === label
                          ? 'bg-emerald-600 font-semibold text-white'
                          : 'text-slate-700 hover:bg-slate-200/70 dark:text-slate-200 dark:hover:bg-white/[0.06]'
                      }`}
                      onClick={() => setDepartmentFilter(label)}
                    >
                      {label === UNSPECIFIED_DEPT ? t('hr.dept.unspecified') : label}{' '}
                      <span dir="ltr" className="ds-num opacity-75">
                        ({formatInt(count, fmtLocale)})
                      </span>
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5 border-t border-[var(--ds-border-hairline)] pt-4">
                  <p className="text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300">
                    {t('hr.facet.location')}
                  </p>
                  <button
                    type="button"
                    className={`ds-focus-ring block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-start text-sm ${
                      !locationFilter
                        ? 'bg-emerald-600 font-semibold text-white'
                        : 'text-slate-700 hover:bg-slate-200/70 dark:text-slate-200 dark:hover:bg-white/[0.06]'
                    }`}
                    onClick={() => setLocationFilter(null)}
                  >
                    {t('suite.all')}{' '}
                    <span dir="ltr" className="ds-num">
                      ({formatInt(employees.length, fmtLocale)})
                    </span>
                  </button>
                  {locationCounts.map(([label, count]) => (
                    <button
                      key={label}
                      type="button"
                      className={`ds-focus-ring block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-start text-sm ${
                        locationFilter === label
                          ? 'bg-emerald-600 font-semibold text-white'
                          : 'text-slate-700 hover:bg-slate-200/70 dark:text-slate-200 dark:hover:bg-white/[0.06]'
                      }`}
                      onClick={() => setLocationFilter(label)}
                    >
                      {label}{' '}
                      <span dir="ltr" className="ds-num opacity-75">
                        ({formatInt(count, fmtLocale)})
                      </span>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="ds-surface-subtle min-w-0 rounded-2xl p-4">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={employeeView === 'kanban' ? primaryBtnCls : secondaryBtnCls}
                    onClick={() => setEmployeeView('kanban')}
                  >
                    {t('suite.view.kanban')}
                  </button>
                  <button
                    type="button"
                    className={employeeView === 'list' ? primaryBtnCls : secondaryBtnCls}
                    onClick={() => setEmployeeView('list')}
                  >
                    {t('suite.view.list')}
                  </button>
                  <span
                    dir="ltr"
                    className="ds-num ms-auto self-center text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    {formatInt(visibleEmployees.length, fmtLocale)} /{' '}
                    {formatInt(employees.length, fmtLocale)}
                  </span>
                </div>

                {visibleEmployees.length === 0 ? (
                  <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
                ) : null}

                {employeeView === 'kanban' && visibleEmployees.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleEmployees.map((employee) => {
                      const phone = employee.workPhone || employee.mobilePhone
                      const email = employee.workEmail
                      return (
                        <button
                          key={employee.id}
                          type="button"
                          className="ds-surface ds-focus-ring cursor-pointer rounded-xl p-4 text-start transition hover:border-emerald-500/40"
                          onClick={() => {
                            setSelectedId(employee.id)
                            setDrawerPane('contract')
                          }}
                        >
                          <div className="mb-3 flex items-center gap-3">
                            {employee.avatarPhoto ? (
                              <span
                                role="img"
                                aria-hidden
                                className="h-12 w-12 shrink-0 rounded-full bg-cover bg-center"
                                style={{ backgroundImage: `url(${employee.avatarPhoto})` }}
                              />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200">
                                {employee.avatarInitials ??
                                  employee.fullName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                employee.status === 'active'
                                  ? 'bg-emerald-500'
                                  : 'bg-slate-400'
                              }`}
                            />
                          </div>
                          <p className="font-semibold text-slate-900 dark:text-slate-50">
                            {employee.fullName}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            {employee.roleTitle}
                          </p>
                          <p className="mt-2 text-xs text-slate-700 dark:text-slate-200">
                            {t('hr.badge')}:{' '}
                            <span dir="ltr" className="ds-num font-semibold">
                              {employee.badgeCode ?? employee.employeeCode}
                            </span>
                          </p>
                          {phone ? (
                            <p
                              className="text-xs text-slate-600 dark:text-slate-300"
                              dir="ltr"
                            >
                              {phone}
                            </p>
                          ) : null}
                          {email ? (
                            <p
                              className="break-all text-xs text-slate-600 dark:text-slate-300"
                              dir="ltr"
                            >
                              {email}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {employee.odooId ? (
                              <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                                {t('hr.contact.odoo')}
                              </span>
                            ) : null}
                            {!phone && !email ? (
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">
                                {t('hr.contact.missing')}
                              </span>
                            ) : null}
                            {employee.workLocation ? (
                              <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                                {employee.workLocation}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : null}

                {employeeView === 'list' && visibleEmployees.length > 0 ? (
                  <div className="w-full overflow-x-auto">
                    <table className="w-full min-w-[40rem] text-sm">
                      <thead className="border-b border-[var(--ds-border-hairline)] text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <tr>
                          <th className="px-2 py-2 text-start">{t('hr.badge')}</th>
                          <th className="px-2 py-2 text-start">{t('hr.name')}</th>
                          <th className="px-2 py-2 text-start">{t('hr.role')}</th>
                          <th className="px-2 py-2 text-start">{t('hr.department')}</th>
                          <th className="px-2 py-2 text-start">{t('hr.facet.location')}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                        {visibleEmployees.map((employee) => (
                          <tr key={employee.id}>
                            <td className="px-2 py-3">
                              <span dir="ltr" className="ds-num">
                                {employee.badgeCode ?? employee.employeeCode}
                              </span>
                            </td>
                            <td className="px-2 py-3">
                              <button
                                type="button"
                                className="ds-focus-ring cursor-pointer text-start font-semibold text-slate-900 hover:text-emerald-700 dark:text-slate-100 dark:hover:text-emerald-300"
                                onClick={() => setSelectedId(employee.id)}
                              >
                                {employee.fullName}
                              </button>
                            </td>
                            <td className="px-2 py-3 text-slate-700 dark:text-slate-300">
                              {employee.roleTitle}
                            </td>
                            <td className="px-2 py-3 text-slate-700 dark:text-slate-300">
                              {employee.departmentRoot ?? employee.department}
                            </td>
                            <td
                              className="px-2 py-3 text-slate-600 dark:text-slate-300"
                              title={!employee.workLocation ? unavailableTooltip : undefined}
                            >
                              {employee.workLocation ?? UNAVAILABLE_DASH}
                            </td>
                            <td className="px-2 py-3">
                              {canEmployees ? (
                                <button
                                  className={dangerBtnCls}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void removeEmployee(employee)}
                                >
                                  {t('hr.delete')}
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === 'departments' ? (
            departmentCounts.length === 0 ? (
              <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {departmentCounts.map(([label, count]) => (
                  <article key={label} className="ds-surface-subtle rounded-xl p-4">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {label === UNSPECIFIED_DEPT ? t('hr.dept.unspecified') : label}
                    </p>
                    <p
                      dir="ltr"
                      className="ds-num mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300"
                    >
                      {formatInt(count, fmtLocale)}
                    </p>
                  </article>
                ))}
              </div>
            )
          ) : null}

          {tab === 'documents' ||
          tab === 'custody' ||
          tab === 'loans' ||
          tab === 'overtimes' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {t('hr.drawer.hint')}
              </p>
              {employees.length === 0 ? (
                <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {employees.slice(0, 24).map((employee) => (
                    <button
                      key={employee.id}
                      type="button"
                      className="ds-surface-subtle ds-focus-ring cursor-pointer rounded-xl px-3.5 py-2.5 text-start text-sm font-medium text-slate-900 hover:border-emerald-500/40 dark:text-slate-100"
                      onClick={() => {
                        setSelectedId(employee.id)
                        setDrawerPane(
                          tab === 'documents'
                            ? 'documents'
                            : tab === 'custody'
                              ? 'custody'
                              : tab === 'loans'
                                ? 'loans'
                                : 'overtimes',
                        )
                        setTab('employees')
                      }}
                    >
                      {employee.fullName}
                      <span
                        dir="ltr"
                        className="ds-num mt-1 block text-xs text-slate-600 dark:text-slate-400"
                      >
                        {employee.badgeCode ?? employee.employeeCode}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {tab === 'attendance' ? (
            <div className="space-y-5">
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                  {t('hr.shift')}
                </h3>
                {shifts.length === 0 ? (
                  <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
                ) : (
                  <div className="space-y-2">
                    {shifts.map((shift) => (
                      <p
                        key={shift.id}
                        className="ds-surface-subtle rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
                      >
                        {shift.name} —{' '}
                        <span dir="ltr" className="ds-num">
                          {shift.startsAt}–{shift.endsAt}
                        </span>
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                  {t('hr.nav.attendance')}
                </h3>
                {attendance.length === 0 ? (
                  <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
                ) : (
                  <div className="space-y-2">
                    {attendance.slice(0, 80).map((row) => (
                      <p
                        key={row.id}
                        className="ds-surface-subtle rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
                      >
                        {row.employeeName} —{' '}
                        <span dir="ltr" className="ds-num">
                          {formatDateTime(row.checkIn, fmtLocale)}
                          {row.checkOut ? ` → ${formatDateTime(row.checkOut, fmtLocale)}` : ''}
                        </span>{' '}
                        · {t('hr.overtime')}{' '}
                        <span dir="ltr" className="ds-num font-semibold">
                          {formatInt(row.overtimeMinutes, fmtLocale)}
                        </span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {tab === 'leaves' ? (
            leaves.length === 0 ? (
              <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead className="border-b border-[var(--ds-border-hairline)] text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-2 py-2 text-start">{t('hr.name')}</th>
                      <th className="px-2 py-2 text-start">{t('hr.leaveType')}</th>
                      <th className="px-2 py-2 text-end">{t('hr.days')}</th>
                      <th className="px-2 py-2 text-start">{t('hr.status')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                    {leaves.slice(0, 100).map((leave) => (
                      <tr key={leave.id}>
                        <td className="px-2 py-3 font-medium text-slate-900 dark:text-slate-100">
                          {leave.employeeName}
                        </td>
                        <td className="px-2 py-3 text-slate-700 dark:text-slate-300">
                          {t(`hr.${leave.leaveType}` as MessageKey)}
                        </td>
                        <td
                          dir="ltr"
                          className="ds-num px-2 py-3 text-end text-slate-800 dark:text-slate-200"
                        >
                          {formatInt(leave.days, fmtLocale)}
                        </td>
                        <td className="px-2 py-3 text-slate-700 dark:text-slate-300">
                          {t(`hr.${leave.approvalStatus}` as MessageKey)}
                        </td>
                        <td className="px-2 py-3">
                          {canLeave && leave.approvalStatus === 'pending' ? (
                            <span className="flex flex-wrap gap-2">
                              <button
                                className={primaryBtnCls}
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void decideLeave(leave.id, leave.version, 'approved')
                                }
                              >
                                {t('hr.approve')}
                              </button>
                              <button
                                className={secondaryBtnCls}
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void decideLeave(leave.id, leave.version, 'rejected')
                                }
                              >
                                {t('hr.reject')}
                              </button>
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {tab === 'payroll' ? (
            <div className="space-y-4">
              <div className="flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {payrollSubs.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`shrink-0 whitespace-nowrap ${payrollSub === item ? primaryBtnCls : secondaryBtnCls}`}
                    onClick={() => setPayrollSub(item)}
                  >
                    {t(`hr.pay.${item}` as MessageKey)}
                  </button>
                ))}
              </div>

              {payrollSub === 'dashboard' && dashboard ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  <article className="ds-surface-subtle rounded-2xl p-4">
                    <h3 className="mb-3 text-sm font-bold text-amber-800 dark:text-amber-200">
                      {t('hr.pay.warnings')}
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-800 dark:text-slate-200">
                      <li>
                        <span dir="ltr" className="ds-num font-semibold">
                          {formatInt(dashboard.warnings.withoutRunningContracts, fmtLocale)}
                        </span>{' '}
                        {t('hr.payroll.warn.contracts')}
                      </li>
                      <li>
                        <span dir="ltr" className="ds-num font-semibold">
                          {formatInt(dashboard.warnings.missingFromOpenBatches, fmtLocale)}
                        </span>{' '}
                        {t('hr.payroll.warn.batches')}
                      </li>
                      <li>
                        <span dir="ltr" className="ds-num font-semibold">
                          {formatInt(dashboard.warnings.conflicts, fmtLocale)}
                        </span>{' '}
                        {t('hr.payroll.warn.conflicts')}
                      </li>
                      <li>
                        <span dir="ltr" className="ds-num font-semibold">
                          {formatInt(dashboard.warnings.newContracts, fmtLocale)}
                        </span>{' '}
                        {t('hr.pay.warn.newContracts')}
                      </li>
                      <li>
                        <span dir="ltr" className="ds-num font-semibold">
                          {formatInt(dashboard.warnings.timeOffToDefer, fmtLocale)}
                        </span>{' '}
                        {t('hr.pay.warn.defer')}
                      </li>
                      <li>
                        <span dir="ltr" className="ds-num font-semibold">
                          {formatInt(dashboard.warnings.timeOffWithoutJoinedDocument, fmtLocale)}
                        </span>{' '}
                        {t('hr.pay.warn.docs')}
                      </li>
                    </ul>
                    <button
                      className={`${secondaryBtnCls} mt-4`}
                      type="button"
                      disabled={busy}
                      onClick={() => void runPayroll()}
                    >
                      {t('hr.pay.aiResolve')}
                    </button>
                  </article>

                  <article className="ds-surface-subtle rounded-2xl p-4">
                    <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                      {t('hr.payroll.batches')}
                    </h3>
                    <div className="space-y-3">
                      {dashboard.batches.map((batch) => (
                        <div key={batch.period} className="ds-surface rounded-xl p-3">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {batch.label}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            [{batch.status === 'new' ? t('hr.pay.batch.new') : t('hr.pay.batch.done')} —{' '}
                            <span dir="ltr" className="ds-num">
                              {formatInt(batch.payslipCount, fmtLocale)}
                            </span>{' '}
                            {t('hr.pay.payslips')}]
                          </p>
                          {batch.status === 'new' && batch.generateTarget > 0 && canPayroll ? (
                            <button
                              className={`${primaryBtnCls} mt-2`}
                              type="button"
                              disabled={busy}
                              onClick={() => void runPayroll(undefined, batch.period)}
                            >
                              {batch.period === '2026-10'
                                ? `${t('hr.pay.generateOct')} (${formatInt(batch.generateTarget, fmtLocale)} ${t('hr.pay.payslips')})`
                                : `${t('hr.pay.generate')} ${formatInt(batch.generateTarget, fmtLocale)}`}
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="ds-surface-subtle rounded-2xl p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {t('hr.pay.employerCost')}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={costMode === 'monthly' ? primaryBtnCls : secondaryBtnCls}
                          onClick={() => setCostMode('monthly')}
                        >
                          {t('hr.pay.monthly')}
                        </button>
                        <button
                          type="button"
                          className={costMode === 'annually' ? primaryBtnCls : secondaryBtnCls}
                          onClick={() => setCostMode('annually')}
                        >
                          {t('hr.pay.annually')}
                        </button>
                      </div>
                    </div>
                    <p
                      dir="ltr"
                      className="ds-num text-2xl font-bold text-emerald-700 sm:text-3xl dark:text-emerald-300"
                    >
                      {formatMinorKwd(
                        costMode === 'monthly'
                          ? dashboard.employerCostMonthlyMinor
                          : dashboard.employerCostAnnualMinor,
                        fmtLocale,
                      )}
                    </p>
                  </article>

                  <article className="ds-surface-subtle rounded-2xl p-4">
                    <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                      {t('hr.pay.trends')}
                    </h3>
                    <p className="text-sm text-slate-800 dark:text-slate-200">
                      <span dir="ltr" className="ds-num font-semibold">
                        {formatInt(dashboard.trends.newEmployees, fmtLocale)}
                      </span>{' '}
                      {t('hr.pay.newEmployees')}
                    </p>
                    <p className="text-sm text-slate-800 dark:text-slate-200">
                      <span dir="ltr" className="ds-num font-semibold">
                        {formatInt(dashboard.trends.lastDepartures, fmtLocale)}
                      </span>{' '}
                      {t('hr.pay.departures')}
                    </p>
                    <div className="mt-4 flex items-end gap-3">
                      {dashboard.trends.bars.map((bar) => (
                        <div key={bar.month} className="flex flex-1 flex-col items-center gap-2">
                          <div className="flex h-28 w-full items-end gap-1">
                            <div
                              className="w-1/2 rounded-t bg-emerald-500/80"
                              style={{ height: `${Math.min(100, bar.hires * 20)}%` }}
                            />
                            <div
                              className="w-1/2 rounded-t bg-rose-500/80"
                              style={{ height: `${Math.min(100, bar.departures * 20)}%` }}
                            />
                          </div>
                          <span
                            dir="ltr"
                            className="ds-num text-xs text-slate-600 dark:text-slate-400"
                          >
                            {bar.month.slice(5)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              ) : null}

              {payrollSub === 'payslips' ||
              payrollSub === 'contracts' ||
              payrollSub === 'entries' ? (
                <div className="ds-surface-subtle space-y-4 rounded-2xl p-4">
                  {canPayroll && payrollSub === 'payslips' ? (
                    <form
                      className="flex flex-wrap gap-3"
                      onSubmit={(event) => void runPayroll(event)}
                    >
                      <label className={labelCls}>
                        {t('hr.period')}
                        <input
                          className={inputCls}
                          dir="ltr"
                          required
                          value={period}
                          onChange={(event) => setPeriod(event.target.value)}
                        />
                      </label>
                      <label className={labelCls}>
                        {t('hr.start')}
                        <input
                          className={inputCls}
                          dir="ltr"
                          type="date"
                          required
                          value={entryDate}
                          onChange={(event) => setEntryDate(event.target.value)}
                        />
                      </label>
                      <div className="flex items-end">
                        <button className={primaryBtnCls} type="submit" disabled={busy}>
                          {t('hr.run')}
                        </button>
                      </div>
                    </form>
                  ) : null}
                  {runs.length === 0 ? (
                    <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
                  ) : (
                    runs.map((run) => (
                      <p
                        key={run.id}
                        className="text-sm text-slate-900 dark:text-slate-100"
                      >
                        <span dir="ltr" className="ds-num font-semibold">
                          {run.period}
                        </span>{' '}
                        — {run.status} — {t('hr.net')}{' '}
                        <span dir="ltr" className="ds-num font-semibold">
                          {formatMinorKwd(run.netMinor, fmtLocale)}
                        </span>
                      </p>
                    ))
                  )}
                  <div className="mt-4 max-h-96 space-y-1.5 overflow-auto">
                    {slips.slice(0, 200).map((slip) => (
                      <p
                        key={slip.id}
                        className="text-sm text-slate-700 dark:text-slate-300"
                      >
                        <span dir="ltr" className="ds-num">
                          {slip.period}
                        </span>{' '}
                        · {slip.employeeName} — {t('hr.net')}{' '}
                        <span dir="ltr" className="ds-num font-semibold">
                          {formatMinorKwd(slip.netMinor, fmtLocale)}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {payrollSub === 'affects' ||
              payrollSub === 'provisions' ||
              payrollSub === 'reporting' ||
              payrollSub === 'config' ? (
                <div className="ds-surface-subtle space-y-3 rounded-2xl p-4">
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {t('hr.pay.subHint')}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    <span dir="ltr" className="ds-num font-semibold">
                      {formatInt(appraisals.length, fmtLocale)}
                    </span>{' '}
                    {t('hr.tab.appraisals')} ·{' '}
                    <span dir="ltr" className="ds-num font-semibold">
                      {formatInt(expenses.length, fmtLocale)}
                    </span>{' '}
                    {t('hr.tab.expenses')} ·{' '}
                    <span dir="ltr" className="ds-num font-semibold">
                      {formatInt(appointments.length, fmtLocale)}
                    </span>{' '}
                    {t('hr.tab.appointments')}
                  </p>
                  {expenses.slice(0, 20).map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center gap-3 border-t border-[var(--ds-border-hairline)] py-2 text-sm text-slate-900 dark:text-slate-100"
                    >
                      <span>{row.employeeName}</span>
                      <span>{row.category}</span>
                      <span dir="ltr" className="ds-num font-semibold">
                        {formatMinorKwd(row.amountMinor, fmtLocale)}
                      </span>
                      {canExpense && row.approvalStatus === 'pending' ? (
                        <button
                          className={primaryBtnCls}
                          type="button"
                          disabled={busy}
                          onClick={() => void decideExpense(row.id, row.version)}
                        >
                          {t('hr.approve')}
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {canAppointment ? (
                    <SuperOdooBoard
                      app="recruitment"
                      title="spec.recruitment"
                      canManage={canSuite}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </SectionCard>

      {showCreate ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowCreate(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label={t('hr.new')}
            className="ds-surface-elevated w-full max-w-xl space-y-3 rounded-2xl p-5"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => void addEmployee(event)}
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              {t('hr.new')}
            </h3>
            <label className={labelCls}>
              {t('hr.code')}
              <input
                className={inputCls}
                dir="ltr"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            <label className={labelCls}>
              {t('hr.name')}
              <input
                className={inputCls}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className={labelCls}>
              {t('hr.role')}
              <input
                className={inputCls}
                required
                value={role}
                onChange={(event) => setRole(event.target.value)}
              />
            </label>
            <label className={labelCls}>
              {t('hr.department')}
              <input
                className={inputCls}
                required
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
              />
            </label>
            <label className={labelCls}>
              {t('hr.salary')}
              <input
                className={inputCls}
                dir="ltr"
                inputMode="decimal"
                required
                value={salary}
                onChange={(event) => setSalary(event.target.value)}
              />
            </label>
            <label className={labelCls}>
              {t('hr.allowances')}
              <input
                className={inputCls}
                dir="ltr"
                inputMode="decimal"
                required
                value={allowances}
                onChange={(event) => setAllowances(event.target.value)}
              />
            </label>
            <label className={labelCls}>
              {t('hr.residency')}
              <input
                className={inputCls}
                dir="ltr"
                type="date"
                value={residency}
                onChange={(event) => setResidency(event.target.value)}
              />
            </label>
            <div className="flex gap-2 pt-2">
              <button className={primaryBtnCls} type="submit" disabled={busy}>
                {t('hr.add')}
              </button>
              <button
                className={secondaryBtnCls}
                type="button"
                onClick={() => setShowCreate(false)}
              >
                {t('hr.cancel')}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {selectedId && profile ? (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/50"
          onClick={() => setSelectedId(null)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={profile.employee.fullName}
            onClick={(event) => event.stopPropagation()}
            className="ds-surface-elevated h-full w-full max-w-xl overflow-y-auto border-s border-[var(--ds-border-hairline)] p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-50">
                  {profile.employee.fullName}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {profile.employee.roleTitle}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {t('hr.badge')}:{' '}
                  <span dir="ltr" className="ds-num">
                    {profile.employee.badgeCode ?? profile.employee.employeeCode}
                  </span>
                </p>
              </div>
              <button
                type="button"
                className={secondaryBtnCls}
                aria-label={t('hr.close')}
                onClick={() => setSelectedId(null)}
              >
                {t('hr.close')}
              </button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {drawerPanes.map((pane) => (
                <button
                  key={pane}
                  type="button"
                  className={drawerPane === pane ? primaryBtnCls : secondaryBtnCls}
                  onClick={() => setDrawerPane(pane)}
                >
                  {t(`hr.drawer.${pane}` as MessageKey)}
                </button>
              ))}
            </div>
            {drawerPane === 'contract' ? (
              <div className="space-y-2 text-sm">
                {profile.contracts.length === 0 ? (
                  <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
                ) : (
                  profile.contracts.map((row) => (
                    <p
                      key={row.id}
                      className="ds-surface-subtle rounded-xl p-3 text-slate-900 dark:text-slate-100"
                    >
                      {row.name} · {row.state} ·{' '}
                      <span dir="ltr" className="ds-num">
                        {formatDate(row.dateStart, fmtLocale)}
                        {row.dateEnd ? ` → ${formatDate(row.dateEnd, fmtLocale)}` : ''}
                      </span>{' '}
                      ·{' '}
                      <span dir="ltr" className="ds-num font-semibold">
                        {formatMinorKwd(row.wageMinor, fmtLocale)}
                      </span>
                    </p>
                  ))
                )}
              </div>
            ) : null}
            {drawerPane === 'payslips' ? (
              <div className="space-y-2 text-sm">
                {profile.payslips.length === 0 ? (
                  <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
                ) : (
                  profile.payslips.map((row) => (
                    <p key={row.id} className="text-slate-800 dark:text-slate-200">
                      <span dir="ltr" className="ds-num">
                        {row.period}
                      </span>{' '}
                      —{' '}
                      <span dir="ltr" className="ds-num font-semibold">
                        {formatMinorKwd(row.netMinor, fmtLocale)}
                      </span>
                    </p>
                  ))
                )}
              </div>
            ) : null}
            {drawerPane === 'attendance' ? (
              <div className="space-y-2 text-sm">
                {profile.attendance.length === 0 ? (
                  <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
                ) : (
                  profile.attendance.map((row) => (
                    <p key={row.id} className="text-slate-800 dark:text-slate-200">
                      <span dir="ltr" className="ds-num">
                        {formatDateTime(row.checkIn, fmtLocale)}
                        {row.checkOut ? ` → ${formatDateTime(row.checkOut, fmtLocale)}` : ''}
                      </span>
                    </p>
                  ))
                )}
              </div>
            ) : null}
            {drawerPane === 'leaves' ? (
              <div className="space-y-2 text-sm">
                {profile.leaves.length === 0 ? (
                  <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
                ) : (
                  profile.leaves.map((row) => (
                    <p key={row.id} className="text-slate-800 dark:text-slate-200">
                      <span dir="ltr" className="ds-num">
                        {formatDate(row.startDate, fmtLocale)} → {formatDate(row.endDate, fmtLocale)}
                      </span>{' '}
                      · {row.leaveType} · {row.approvalStatus}
                    </p>
                  ))
                )}
              </div>
            ) : null}
            {drawerPane === 'custody' ? (
              <div className="space-y-2 text-sm">
                {profile.custody.length === 0 ? (
                  <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
                ) : (
                  profile.custody.map((row) => (
                    <p key={row.id} className="text-slate-800 dark:text-slate-200">
                      {row.itemName} · {row.status}
                    </p>
                  ))
                )}
              </div>
            ) : null}
            {drawerPane === 'loans' ? (
              <div className="space-y-2 text-sm">
                {profile.loans.length === 0 ? (
                  <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
                ) : (
                  profile.loans.map((row) => (
                    <p key={row.id} className="text-slate-800 dark:text-slate-200">
                      <span dir="ltr" className="ds-num font-semibold">
                        {formatMinorKwd(row.remainingMinor, fmtLocale)} /{' '}
                        {formatMinorKwd(row.principalMinor, fmtLocale)}
                      </span>
                    </p>
                  ))
                )}
              </div>
            ) : null}
            {drawerPane === 'overtimes' ? (
              <div className="space-y-2 text-sm">
                {profile.overtimes.length === 0 ? (
                  <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
                ) : (
                  profile.overtimes.map((row) => (
                    <p key={row.id} className="text-slate-800 dark:text-slate-200">
                      <span dir="ltr" className="ds-num">
                        {formatDate(row.workDate, fmtLocale)}
                      </span>{' '}
                      ·{' '}
                      <span dir="ltr" className="ds-num font-semibold">
                        {formatInt(row.minutes, fmtLocale)}
                      </span>{' '}
                      {t('hr.overtime')}
                    </p>
                  ))
                )}
              </div>
            ) : null}
            {drawerPane === 'documents' ? (
              <div className="space-y-3 text-sm">
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                  {t('hr.dossier')}
                </p>
                <HrDossierPanel
                  employeeCode={profile.employee.employeeCode}
                  employeeName={profile.employee.fullName}
                />
                {profile.documents.length === 0
                  ? null
                  : profile.documents.map((row) => (
                      <p key={row.id} className="text-slate-800 dark:text-slate-200">
                        {row.title} · {row.docType} · {row.status}
                      </p>
                    ))}
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  )
}

export default function HrWorkspace({
  permissions: held,
  initialTab,
  initialPhase,
  initialError,
  initialData,
}: {
  permissions: readonly string[]
  initialTab: string
  initialPhase?: 'loading' | 'ready' | 'error'
  initialError?: MessageKey
  initialData?: HrWorkspaceInitialData
}) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace
        initialTab={initialTab}
        initialPhase={initialPhase}
        initialError={initialError}
        initialData={initialData}
      />
    </PermissionProvider>
  )
}
