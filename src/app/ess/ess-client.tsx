'use client'

import { useEffect, useState } from 'react'
import { SectionCard, StateBlock } from '@/components/ui'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatDateTime,
  formatKwd,
  getUnavailableTooltip,
} from '@/lib/format'
import { useI18n } from '@/lib/i18n'

export type EssProfile = {
  employee: {
    id: string
    code: string
    name: string
    jobTitle: string
    department: string
    civilId: string | null
    civilIdExpiry: string | null
    passportExpiry: string | null
    healthCardExpiry: string | null
    workPermitExpiry: string | null
    drivingLicenseExpiry: string | null
  }
  payrolls: Array<{ id: string; month: number; year: number; netSalary: number; basicSalary: number; status: string }>
  attendance: Array<{ id: string; date: string; status: string; checkIn: string | null; checkOut: string | null; hoursWorked: number }>
  documents: Array<{ id: string; fileName: string; category: string; expiryDate: string | null; fileUrl: string | null }>
}

function UnavailableMarker({ tooltip }: { tooltip: string }) {
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

function formatKuwaitClock(value: string | null | undefined): string | null {
  if (!value) return null
  const formatted = formatDateTime(value, { locale: 'en' })
  if (formatted === UNAVAILABLE_DASH) return null
  const spaceIdx = formatted.indexOf(' ')
  return spaceIdx >= 0 ? formatted.slice(spaceIdx + 1) : formatted
}

export function EssPortalClient({ initialProfile }: { initialProfile?: EssProfile | null }) {
  const { t, locale, dir, setLocale } = useI18n()
  const isAr = locale !== 'en'
  const unavailableTooltip = getUnavailableTooltip(locale)

  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const [initializing, setInitializing] = useState(initialProfile === undefined)
  const [profile, setProfile] = useState<EssProfile | null>(initialProfile ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [leaveType, setLeaveType] = useState<'compensatory' | 'legal' | 'sick'>('legal')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const label = (ar: string, en: string) => (isAr ? ar : en)

  async function loadMe() {
    try {
      const res = await fetch('/api/ess/me', { credentials: 'same-origin' })
      if (!res.ok) {
        setProfile(null)
        return
      }
      const json = (await res.json()) as { data?: EssProfile }
      setProfile(json.data ?? null)
    } catch {
      setProfile(null)
    } finally {
      setInitializing(false)
    }
  }

  useEffect(() => {
    if (initialProfile !== undefined) return
    void loadMe()
  }, [initialProfile])

  async function login(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/ess/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code, pin }),
      })
      if (!res.ok) {
        if (res.status === 429) {
          setError(label('محاولات تسجيل دخول متكررة. يرجى الانتظار قليلاً والمحاولة مجدداً.', 'Too many sign-in attempts. Please wait a moment and try again.'))
        } else if (res.status === 401) {
          setError(label('الرقم الوظيفي أو رمز PIN غير صحيح.', 'Invalid employee ID or PIN.'))
        } else {
          setError(label('تعذر تسجيل الدخول حالياً. يرجى المحاولة مجدداً.', 'Unable to sign in right now. Please try again.'))
        }
        return
      }
      await loadMe()
    } catch {
      setError(label('تعذر الاتصال بالخادم. يرجى المحاولة مجدداً.', 'Unable to reach the server. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    try {
      await fetch('/api/ess/login', { method: 'DELETE', credentials: 'same-origin' })
    } catch {
      // Clear local ESS state even if network request fails
    } finally {
      setProfile(null)
    }
  }

  async function submitLeave(event: React.FormEvent) {
    event.preventDefault()
    if (dateFrom && dateTo && dateTo < dateFrom) {
      setError(label('يجب أن يكون تاريخ نهاية الإجازة مساوياً لتاريخ البداية أو بعده.', 'End date must be on or after start date.'))
      return
    }
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      const res = await fetch('/api/ess/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ type: leaveType, dateFrom, dateTo, note }),
      })
      if (!res.ok) {
        if (res.status === 401) {
          setError(label('انتهت جلسة الدخول. يرجى تسجيل الدخول مجدداً.', 'Session expired. Please sign in again.'))
          setProfile(null)
        } else {
          setError(label('تعذر إرسال طلب الإجازة. تأكد من صحة التواريخ وحاول مجدداً.', 'Unable to submit leave request. Check dates and try again.'))
        }
        return
      }
      setNotice(
        label(
          'تم إرسال طلب الإجازة لـ Sheyam / Zahraa / Choukrallah للاعتماد',
          'Leave request sent to Sheyam / Zahraa / Choukrallah for approval',
        ),
      )
      setNote('')
      await loadMe()
    } catch {
      setError(label('تعذر الاتصال بالخادم أثناء إرسال الطلب.', 'Unable to reach the server while submitting request.'))
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'ds-focus-ring mt-1 w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-3 text-base text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]'

  return (
    <div dir={dir} className="min-w-0 space-y-4">
      <header className="ds-surface rounded-2xl border border-[var(--ds-border-accent)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--ds-accent)' }}>
              Venture Foods · ESS
            </p>
            <h1 className="mt-1 text-xl font-bold text-[var(--ds-text-primary)]">
              {label('بوابة الموظف الذاتية', 'Employee Self-Service')}
            </h1>
            <p className="ds-caption mt-1">
              {label('ادخل برقمك الوظيفي (Barcode) ورمز PIN', 'Sign in with your employee barcode and PIN')}
            </p>
          </div>
          <button
            type="button"
            aria-label={isAr ? 'التبديل إلى الإنجليزية' : 'Switch to Arabic'}
            className="ds-focus-ring shrink-0 cursor-pointer rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
            onClick={() => setLocale(isAr ? 'en' : 'ar')}
          >
            {isAr ? 'EN' : 'عربي'}
          </button>
        </div>
      </header>

      {initializing ? (
        <StateBlock
          state="loading"
          locale={locale}
          title={label('جارٍ التحقق من جلسة الموظف…', 'Checking employee session…')}
          skeletonRows={4}
        />
      ) : !profile ? (
        <form onSubmit={login} className="ds-surface space-y-3 rounded-2xl p-5">
          <label className="block text-sm font-semibold text-[var(--ds-text-secondary)]">
            <span>{label('الرقم الوظيفي / البصمة', 'Employee ID / Barcode')}</span>
            <input
              className={inputClass}
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={label('مثال: 2090', 'e.g. 2090')}
              required
            />
          </label>
          <label className="block text-sm font-semibold text-[var(--ds-text-secondary)]">
            <span>PIN</span>
            <input
              className={inputClass}
              dir="ltr"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              required
            />
          </label>
          <p className="ds-caption">
            {label('الرمز الافتراضي لأول دخول: 1234', 'Default first-login PIN: 1234')}
          </p>
          {error ? (
            <StateBlock
              state="error"
              compact
              locale={locale}
              title={label('تعذر تسجيل الدخول', 'Sign-in failed')}
              description={error}
            />
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="ds-focus-ring btn-colored w-full cursor-pointer rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? label('جارٍ الدخول…', 'Signing in…') : label('دخول', 'Sign in')}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <SectionCard locale={locale}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[var(--ds-text-primary)]">{profile.employee.name}</h2>
                <p className="mt-0.5 text-sm text-[var(--ds-text-secondary)]">
                  {profile.employee.jobTitle || UNAVAILABLE_DASH} · {profile.employee.department || UNAVAILABLE_DASH}
                </p>
                <p className="ds-caption ds-num mt-1 tabular-nums" dir="ltr">
                  ID {profile.employee.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="ds-focus-ring shrink-0 cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--ds-negative-bg)',
                  borderColor: 'var(--ds-negative-border)',
                  color: 'var(--ds-negative)',
                }}
              >
                {label('خروج', 'Logout')}
              </button>
            </div>
          </SectionCard>

          <SectionCard title={label('الوثائق الرسمية', 'Official documents')} locale={locale}>
            <ul className="divide-y divide-[var(--ds-border-hairline)] text-sm">
              {[
                [label('مدني / إقامة', 'Civil ID'), profile.employee.civilIdExpiry],
                [label('جواز', 'Passport'), profile.employee.passportExpiry],
                [label('كرت بلدية', 'Health card'), profile.employee.healthCardExpiry],
                [label('إذن عمل', 'Work permit'), profile.employee.workPermitExpiry],
                [label('رخصة قيادة', 'Driving license'), profile.employee.drivingLicenseExpiry],
              ].map(([title, value]) => {
                const formatted = value ? formatDate(String(value), locale) : UNAVAILABLE_DASH
                return (
                  <li key={String(title)} className="flex justify-between gap-2 py-2.5">
                    <span className="text-[var(--ds-text-secondary)]">{title}</span>
                    {formatted === UNAVAILABLE_DASH ? (
                      <UnavailableMarker tooltip={unavailableTooltip} />
                    ) : (
                      <span dir="ltr" className="ds-num font-semibold tabular-nums text-[var(--ds-text-primary)]">
                        {formatted}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </SectionCard>

          <SectionCard
            title={label('قسائم الراتب', 'Payslips')}
            locale={locale}
            state={profile.payrolls.length === 0 ? 'empty' : 'ready'}
            stateTitle={label('لا توجد قسائم رواتب', 'No payslips available')}
            stateDescription={label('ستظهر قسائم الراتب هنا فور اعتماد المسير الشهري.', 'Payslips will appear here once monthly payroll is posted.')}
          >
            <ul className="divide-y divide-[var(--ds-border-hairline)] text-sm">
              {profile.payrolls.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 py-2.5">
                  <span dir="ltr" className="ds-num tabular-nums text-[var(--ds-text-secondary)]">
                    {row.year}-{String(row.month).padStart(2, '0')}
                  </span>
                  <span dir="ltr" className="ds-num font-semibold tabular-nums text-[var(--ds-text-primary)]">
                    {formatKwd(row.netSalary, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title={label('الحضور والبصمة', 'Attendance')}
            locale={locale}
            state={profile.attendance.length === 0 ? 'empty' : 'ready'}
            stateTitle={label('لا توجد سجلات حضور مسجلة', 'No attendance records yet')}
            stateDescription={label('ستظهر حركات البصمة وساعات الدوام هنا عند تسجيلها.', 'Biometric attendance punches will appear here once recorded.')}
          >
            <ul className="max-h-56 divide-y divide-[var(--ds-border-hairline)] overflow-auto text-sm">
              {profile.attendance.map((row) => {
                const formattedDate = formatDate(row.date, locale)
                const checkInKw = formatKuwaitClock(row.checkIn)
                const checkOutKw = formatKuwaitClock(row.checkOut)
                return (
                  <li key={row.id} className="py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {formattedDate === UNAVAILABLE_DASH ? (
                        <UnavailableMarker tooltip={unavailableTooltip} />
                      ) : (
                        <span dir="ltr" className="ds-num font-semibold tabular-nums text-[var(--ds-text-primary)]">
                          {formattedDate}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-[var(--ds-text-secondary)]">{row.status}</span>
                    </div>
                    <span className="ds-caption ds-num mt-0.5 block tabular-nums" dir="ltr">
                      {checkInKw ?? UNAVAILABLE_DASH} → {checkOutKw ?? UNAVAILABLE_DASH}
                    </span>
                  </li>
                )
              })}
            </ul>
          </SectionCard>

          <SectionCard
            title={label('الملفات والمستندات المرفوعة', 'Uploaded Documents')}
            locale={locale}
            state={profile.documents.length === 0 ? 'empty' : 'ready'}
            stateTitle={label('لا توجد مستندات مرفوعة', 'No uploaded documents')}
            stateDescription={label('يضيف قسم الموارد البشرية نسخ العقود والبطاقات هنا.', 'HR attaches contract and ID copies to your dossier here.')}
          >
            <ul className="divide-y divide-[var(--ds-border-hairline)] text-sm">
              {profile.documents.map((doc) => {
                const exp = doc.expiryDate ? formatDate(doc.expiryDate, locale) : UNAVAILABLE_DASH
                return (
                  <li key={doc.id} className="flex items-center justify-between gap-2 py-2.5">
                    <span className="min-w-0 break-words font-medium text-[var(--ds-text-primary)]">{doc.fileName}</span>
                    {exp === UNAVAILABLE_DASH ? (
                      <UnavailableMarker tooltip={unavailableTooltip} />
                    ) : (
                      <span dir="ltr" className="ds-num shrink-0 tabular-nums text-xs text-[var(--ds-text-secondary)]">
                        {exp}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </SectionCard>

          <form onSubmit={submitLeave} className="ds-surface space-y-3 rounded-2xl p-5">
            <h3 className="font-bold text-[var(--ds-text-primary)]">{label('طلب إجازة', 'Leave request')}</h3>
            <select
              aria-label={label('نوع الإجازة', 'Leave type')}
              className="ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2.5 text-sm text-[var(--ds-text-primary)]"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as typeof leaveType)}
            >
              <option value="compensatory">{label('إجازة تعويضية', 'Compensatory Leave')}</option>
              <option value="legal">{label('إجازة سنوية / قانونية', 'Annual / Legal Leave')}</option>
              <option value="sick">{label('إجازة مرضية', 'Sick Leave')}</option>
            </select>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                <span>{label('من تاريخ', 'From date')}</span>
                <input
                  type="date"
                  dir="ltr"
                  required
                  className="ds-focus-ring mt-1 w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)]"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                <span>{label('إلى تاريخ', 'To date')}</span>
                <input
                  type="date"
                  dir="ltr"
                  required
                  className="ds-focus-ring mt-1 w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)]"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
            </div>
            <textarea
              aria-label={label('ملاحظة أو تقرير طبي', 'Note or medical report text')}
              className="ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]"
              rows={3}
              placeholder={label('ملاحظة / مرفق تقرير طبي (نص)', 'Note / medical report text')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {notice ? (
              <p
                role="status"
                className="rounded-xl border px-3 py-2 text-sm font-medium"
                style={{
                  backgroundColor: 'var(--ds-positive-bg)',
                  borderColor: 'var(--ds-positive-border)',
                  color: 'var(--ds-positive)',
                }}
              >
                {notice}
              </p>
            ) : null}
            {error ? (
              <StateBlock
                state="error"
                compact
                locale={locale}
                title={label('تعذر تنفيذ الطلب', 'Request error')}
                description={error}
              />
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="ds-focus-ring btn-colored w-full cursor-pointer rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy ? label('جارٍ الإرسال…', 'Submitting…') : label('إرسال للاعتماد', 'Submit for approval')}
            </button>
          </form>

          <p className="ds-caption text-center">{t('nav.hr')} · ESS</p>
        </div>
      )}
    </div>
  )
}
