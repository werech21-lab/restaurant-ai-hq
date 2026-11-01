'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'

type Profile = {
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

export function EssPortalClient() {
  const { t, locale, dir, setLocale } = useI18n()
  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [leaveType, setLeaveType] = useState<'compensatory' | 'legal' | 'sick'>('legal')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const label = (ar: string, en: string) => (locale === 'en' ? en : ar)

  async function loadMe() {
    const res = await fetch('/api/ess/me', { credentials: 'same-origin' })
    if (!res.ok) {
      setProfile(null)
      return
    }
    const json = (await res.json()) as { data: Profile }
    setProfile(json.data)
  }

  useEffect(() => {
    void loadMe()
  }, [])

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
      const json = (await res.json()) as { error?: { message?: string } }
      if (!res.ok) throw new Error(json.error?.message || 'login_failed')
      await loadMe()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    await fetch('/api/ess/login', { method: 'DELETE', credentials: 'same-origin' })
    setProfile(null)
  }

  async function submitLeave(event: React.FormEvent) {
    event.preventDefault()
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
      const json = (await res.json()) as { error?: { message?: string } }
      if (!res.ok) throw new Error(json.error?.message || 'leave_failed')
      setNotice(label('تم إرسال طلب الإجازة لـ Sheyam / Zahraa / Choukrallah للاعتماد', 'Leave request sent to Sheyam / Zahraa / Choukrallah for approval'))
      setNote('')
      await loadMe()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function money(value: number) {
    return `${value.toFixed(3)} KWD`
  }

  return (
    <div dir={dir} className="space-y-4">
      <header className="rounded-2xl border border-emerald-500/30 bg-[#11161f] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Venture Foods · ESS</p>
            <h1 className="mt-1 text-xl font-bold text-white">
              {label('بوابة الموظف الذاتية', 'Employee Self-Service')}
            </h1>
            <p className="mt-1 text-sm text-mist-300">
              {label('ادخل برقمك الوظيفي (Barcode) ورمز PIN', 'Sign in with your employee barcode and PIN')}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold"
            onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
          >
            {locale === 'ar' ? 'EN' : 'عربي'}
          </button>
        </div>
      </header>

      {!profile ? (
        <form onSubmit={login} className="space-y-3 rounded-2xl border border-white/10 bg-[#11161f] p-5 shadow-sm">
          <label className="block text-sm font-semibold text-mist-200">
            {label('الرقم الوظيفي / البصمة', 'Employee ID / Barcode')}
            <input
              className="mt-1 w-full rounded-xl border border-white/15 px-3 py-3 text-base"
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="2090"
              required
            />
          </label>
          <label className="block text-sm font-semibold text-mist-200">
            PIN
            <input
              className="mt-1 w-full rounded-xl border border-white/15 px-3 py-3 text-base"
              dir="ltr"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="1234"
              required
            />
          </label>
          <p className="text-xs text-mist-400">{label('الرمز الافتراضي لأول دخول: 1234', 'Default first-login PIN: 1234')}</p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button disabled={busy} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-60">
            {busy ? '…' : label('دخول', 'Sign in')}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-[#11161f] p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-white">{profile.employee.name}</h2>
                <p className="text-sm text-mist-300">
                  {profile.employee.jobTitle} · {profile.employee.department}
                </p>
                <p className="mt-1 text-xs text-mist-400" dir="ltr">
                  ID {profile.employee.code}
                </p>
              </div>
              <button type="button" onClick={() => void logout()} className="text-xs font-semibold text-red-700">
                {label('خروج', 'Logout')}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#11161f] p-5 shadow-sm">
            <h3 className="font-bold text-white">{label('الوثائق الرسمية', 'Official documents')}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                [label('مدني / إقامة', 'Civil ID'), profile.employee.civilIdExpiry],
                [label('جواز', 'Passport'), profile.employee.passportExpiry],
                [label('كرت بلدية', 'Health card'), profile.employee.healthCardExpiry],
                [label('إذن عمل', 'Work permit'), profile.employee.workPermitExpiry],
                [label('رخصة قيادة', 'Driving license'), profile.employee.drivingLicenseExpiry],
              ].map(([title, value]) => (
                <li key={String(title)} className="flex justify-between gap-2 border-b border-white/5 py-2">
                  <span>{title}</span>
                  <span dir="ltr">{value ? String(value).slice(0, 10) : '—'}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#11161f] p-5 shadow-sm">
            <h3 className="font-bold text-white">{label('قسائم الراتب', 'Payslips')}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {profile.payrolls.length === 0 ? (
                <li className="text-mist-400">{label('لا توجد قسائم', 'No payslips')}</li>
              ) : (
                profile.payrolls.map((row) => (
                  <li key={row.id} className="flex justify-between border-b border-white/5 py-2">
                    <span dir="ltr">
                      {row.year}-{String(row.month).padStart(2, '0')}
                    </span>
                    <span dir="ltr" className="font-semibold">
                      {money(row.netSalary)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#11161f] p-5 shadow-sm">
            <h3 className="font-bold text-white">{label('الحضور والبصمة', 'Attendance')}</h3>
            <ul className="mt-3 max-h-56 space-y-2 overflow-auto text-sm">
              {profile.attendance.map((row) => (
                <li key={row.id} className="border-b border-white/5 py-2">
                  <span dir="ltr">{String(row.date).slice(0, 10)}</span> · {row.status}
                  <span className="mt-0.5 block text-xs text-mist-400" dir="ltr">
                    {row.checkIn ? String(row.checkIn).slice(11, 19) : '--:--'} → {row.checkOut ? String(row.checkOut).slice(11, 19) : '--:--'}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <form onSubmit={submitLeave} className="space-y-3 rounded-2xl border border-white/10 bg-[#11161f] p-5 shadow-sm">
            <h3 className="font-bold text-white">{label('طلب إجازة', 'Leave request')}</h3>
            <select className="w-full rounded-xl border border-white/15 px-3 py-2" value={leaveType} onChange={(e) => setLeaveType(e.target.value as typeof leaveType)}>
              <option value="compensatory">Compensatory Leave</option>
              <option value="legal">Legal Leave</option>
              <option value="sick">Sick Leave</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" required className="rounded-xl border border-white/15 px-3 py-2" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <input type="date" required className="rounded-xl border border-white/15 px-3 py-2" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <textarea
              className="w-full rounded-xl border border-white/15 px-3 py-2 text-sm"
              rows={3}
              placeholder={label('ملاحظة / مرفق تقرير طبي (نص)', 'Note / medical report text')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button disabled={busy} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white disabled:opacity-60">
              {label('إرسال للاعتماد', 'Submit for approval')}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400">{t('nav.hr')} · isolated ESS</p>
        </div>
      )}
    </div>
  )
}
