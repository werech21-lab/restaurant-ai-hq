'use client'

import { useState } from 'react'
import { UNAVAILABLE_DASH, formatKwd, getUnavailableTooltip } from '@/lib/format'

export function HrWpsToolbar({
  month,
  year,
  locale,
}: {
  month: number
  year: number
  locale: 'ar' | 'en'
}) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isAr = locale !== 'en'
  const label = (ar: string, en: string) => (isAr ? ar : en)
  const unavailableTooltip = getUnavailableTooltip(locale)

  function download() {
    window.location.href = `/api/hr/wps-export?month=${month}&year=${year}&download=1`
  }

  async function postJournal() {
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      const res = await fetch('/api/hr/wps-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ month, year, action: 'post' }),
      })
      const json = (await res.json()) as {
        data?: { accrualEntryNumber?: string; paymentEntryNumber?: string; totalNet?: string | number }
        error?: { code?: string; message?: string }
      }
      if (!res.ok) {
        if (res.status === 403) {
          setError(label('ليست لديك صلاحية ترحيل قيود الرواتب.', 'You do not have permission to post payroll journals.'))
        } else {
          setError(label('تعذر ترحيل قيد الرواتب الشهري حالياً.', 'Unable to post the monthly payroll journal right now.'))
        }
        return
      }
      const rawNet = Number(json.data?.totalNet)
      const netFormatted = Number.isFinite(rawNet) ? formatKwd(rawNet, locale) : UNAVAILABLE_DASH
      const accrualRef = json.data?.accrualEntryNumber || UNAVAILABLE_DASH
      const paymentRef = json.data?.paymentEntryNumber || UNAVAILABLE_DASH
      setNotice(
        label(
          `تم الترحيل: ${accrualRef} → ${paymentRef} · صافي ${netFormatted}`,
          `Posted: ${accrualRef} → ${paymentRef} · net ${netFormatted}`,
        ),
      )
    } catch {
      setError(label('تعذر الاتصال بالخادم أثناء ترحيل القيد.', 'Unable to reach the server while posting the journal.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="ds-surface mb-4 space-y-2.5 rounded-2xl p-4"
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={download}
          className="ds-focus-ring btn-colored cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
        >
          {label('تصدير ملف تحويل الرواتب للبنك (NBK WPS)', 'Export NBK WPS / Bank Payroll File')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void postJournal()}
          className="ds-focus-ring cursor-pointer rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-60"
          style={{
            backgroundColor: 'var(--ds-accent-soft)',
            borderColor: 'var(--ds-border-accent)',
            color: 'var(--ds-text-primary)',
          }}
        >
          {busy
            ? label('جارٍ الترحيل…', 'Posting…')
            : label('اعتماد وترحيل قيد الرواتب الشهري للمحاسبة', 'Approve & Post Monthly Payroll Journal')}
        </button>
      </div>
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
        <p
          role="alert"
          title={unavailableTooltip}
          className="rounded-xl border px-3 py-2 text-sm font-medium"
          style={{
            backgroundColor: 'var(--ds-negative-bg)',
            borderColor: 'var(--ds-negative-border)',
            color: 'var(--ds-negative)',
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
