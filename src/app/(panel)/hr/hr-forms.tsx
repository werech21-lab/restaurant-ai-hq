'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { generatePayrollAction, payPayrollAction, recordAttendanceAction, saveEmployeeAction } from '@/app/actions/hr'
import { Alert, btnPrimary } from '@/components/erp-ui'

export function HrForms({
  employees,
  year,
  month,
  canCreate,
  canEdit,
  locale = 'ar',
}: {
  employees: Array<{ id: string; name: string }>
  year: number
  month: number
  canCreate: boolean
  canEdit: boolean
  locale?: 'ar' | 'en'
}) {
  const router = useRouter()
  const isAr = locale !== 'en'
  const label = (ar: string, en: string) => (isAr ? ar : en)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  const inputClass =
    'ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]'

  async function saveEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    setMessage('')
    try {
      const result = await saveEmployeeAction({
        code: String(form.get('code') || ''),
        name: String(form.get('name') || ''),
        jobTitle: String(form.get('jobTitle') || ''),
        department: String(form.get('department') || ''),
        phone: String(form.get('phone') || ''),
        basicSalary: Number(form.get('basicSalary') || 0),
        allowances: Number(form.get('allowances') || 0),
        deductions: Number(form.get('deductions') || 0),
        status: 'ACTIVE',
      })
      if (!result.ok) setError(result.message || label('تعذر حفظ الموظف.', 'Unable to save employee.'))
      else {
        setMessage(result.message || label('تم الحفظ', 'Saved'))
        router.refresh()
      }
    } catch {
      setError(label('تعذر حفظ الموظف حالياً.', 'Unable to save employee right now.'))
    } finally {
      setPending(false)
    }
  }

  async function attend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    setMessage('')
    try {
      const result = await recordAttendanceAction({
        employeeId: String(form.get('employeeId') || ''),
        status: String(form.get('status') || 'PRESENT'),
        checkIn: String(form.get('checkIn') || ''),
        checkOut: String(form.get('checkOut') || ''),
      })
      if (!result.ok) setError(result.message || label('تعذر تسجيل الحضور.', 'Unable to record attendance.'))
      else {
        setMessage(result.message || label('تم التسجيل', 'Recorded'))
        router.refresh()
      }
    } catch {
      setError(label('تعذر تسجيل الحضور حالياً.', 'Unable to record attendance right now.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mb-4 space-y-3">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {canCreate ? (
          <form onSubmit={saveEmployee} className="ds-surface grid gap-2.5 rounded-2xl p-4 md:grid-cols-2">
            <p className="font-bold text-[var(--ds-text-primary)] md:col-span-2">
              {label('موظف جديد', 'New Employee')}
            </p>
            <input
              name="code"
              aria-label={label('الرمز الوظيفي', 'Employee Code')}
              className={inputClass}
              placeholder={label('الرمز', 'Code')}
              required
            />
            <input
              name="name"
              aria-label={label('الاسم الكامل', 'Full Name')}
              className={inputClass}
              placeholder={label('الاسم', 'Name')}
              required
            />
            <input
              name="jobTitle"
              aria-label={label('المسمى الوظيفي', 'Job Title')}
              className={inputClass}
              placeholder={label('المسمى', 'Job Title')}
            />
            <input
              name="department"
              aria-label={label('القسم', 'Department')}
              className={inputClass}
              placeholder={label('القسم', 'Department')}
            />
            <input
              name="phone"
              dir="ltr"
              aria-label={label('رقم الهاتف', 'Phone')}
              className={`${inputClass} tabular-nums`}
              placeholder={label('الهاتف', 'Phone')}
            />
            <input
              name="basicSalary"
              type="number"
              min={0}
              step="0.001"
              dir="ltr"
              aria-label={label('الراتب الأساسي (د.ك)', 'Basic Salary (KWD)')}
              className={`${inputClass} tabular-nums`}
              placeholder={label('الراتب الأساسي (0.000)', 'Basic Salary (0.000)')}
              defaultValue="0"
            />
            <input
              name="allowances"
              type="number"
              min={0}
              step="0.001"
              dir="ltr"
              aria-label={label('البدلات (د.ك)', 'Allowances (KWD)')}
              className={`${inputClass} tabular-nums`}
              placeholder={label('البدلات (0.000)', 'Allowances (0.000)')}
              defaultValue="0"
            />
            <input
              name="deductions"
              type="number"
              min={0}
              step="0.001"
              dir="ltr"
              aria-label={label('الاستقطاعات الثابتة (د.ك)', 'Fixed Deductions (KWD)')}
              className={`${inputClass} tabular-nums`}
              placeholder={label('الاستقطاعات الثابتة (0.000)', 'Fixed Deductions (0.000)')}
              defaultValue="0"
            />
            <button type="submit" className={`${btnPrimary} ds-focus-ring`} disabled={pending}>
              {label('حفظ الموظف', 'Save Employee')}
            </button>
          </form>
        ) : null}
        {canCreate ? (
          <form onSubmit={attend} className="ds-surface space-y-2.5 rounded-2xl p-4">
            <p className="font-bold text-[var(--ds-text-primary)]">{label('حضور اليوم', "Today's Attendance")}</p>
            <select
              name="employeeId"
              aria-label={label('اختيار الموظف', 'Select Employee')}
              className={inputClass}
              required
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
            <select
              name="status"
              aria-label={label('حالة الحضور', 'Attendance Status')}
              className={inputClass}
              defaultValue="PRESENT"
            >
              <option value="PRESENT">{label('حاضر', 'Present')}</option>
              <option value="LATE">{label('متأخر', 'Late')}</option>
              <option value="ABSENT">{label('غائب', 'Absent')}</option>
              <option value="LEAVE">{label('إجازة', 'Leave')}</option>
            </select>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                name="checkIn"
                type="time"
                dir="ltr"
                aria-label={label('وقت الدخول', 'Check-in time')}
                className={inputClass}
                defaultValue="08:00"
              />
              <input
                name="checkOut"
                type="time"
                dir="ltr"
                aria-label={label('وقت الخروج', 'Check-out time')}
                className={inputClass}
                defaultValue="16:00"
              />
            </div>
            <button type="submit" className={`${btnPrimary} ds-focus-ring`} disabled={pending}>
              {label('تسجيل الحركة', 'Record Attendance')}
            </button>
          </form>
        ) : null}
      </div>
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`${btnPrimary} ds-focus-ring`}
            disabled={pending}
            onClick={async () => {
              setPending(true)
              setError('')
              setMessage('')
              try {
                const result = await generatePayrollAction(year, month)
                if (!result.ok) setError(result.message || label('تعذر توليد المسير.', 'Unable to generate payroll.'))
                else {
                  setMessage(result.message || label('تم التوليد', 'Generated'))
                  router.refresh()
                }
              } catch {
                setError(label('تعذر توليد المسير حالياً.', 'Unable to generate payroll right now.'))
              } finally {
                setPending(false)
              }
            }}
          >
            {label(`توليد مسير ${month}/${year}`, `Generate Payroll ${month}/${year}`)}
          </button>
          <button
            type="button"
            disabled={pending}
            className="ds-focus-ring cursor-pointer rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)] disabled:opacity-60"
            onClick={async () => {
              setPending(true)
              setError('')
              setMessage('')
              try {
                const result = await payPayrollAction(year, month, 'CASH')
                if (!result.ok) setError(result.message || label('تعذر الصرف.', 'Unable to pay payroll.'))
                else {
                  setMessage(result.message || label('تم الصرف', 'Paid'))
                  router.refresh()
                }
              } catch {
                setError(label('تعذر صرف المسير حالياً.', 'Unable to disburse payroll right now.'))
              } finally {
                setPending(false)
              }
            }}
          >
            {label('صرف من الصندوق', 'Pay via Cash')}
          </button>
          <button
            type="button"
            disabled={pending}
            className="ds-focus-ring cursor-pointer rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)] disabled:opacity-60"
            onClick={async () => {
              setPending(true)
              setError('')
              setMessage('')
              try {
                const result = await payPayrollAction(year, month, 'BANK')
                if (!result.ok) setError(result.message || label('تعذر الصرف.', 'Unable to pay payroll.'))
                else {
                  setMessage(result.message || label('تم الصرف', 'Paid'))
                  router.refresh()
                }
              } catch {
                setError(label('تعذر صرف المسير حالياً.', 'Unable to disburse payroll right now.'))
              } finally {
                setPending(false)
              }
            }}
          >
            {label('صرف من البنك', 'Pay via Bank')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
