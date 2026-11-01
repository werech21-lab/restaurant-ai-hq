'use client'

import { useState } from 'react'

export function HrWpsToolbar({ month, year, locale }: { month: number; year: number; locale: 'ar' | 'en' }) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const label = (ar: string, en: string) => (locale === 'en' ? en : ar)

  async function download() {
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
        data?: { accrualEntryNumber?: string; paymentEntryNumber?: string; totalNet?: string }
        error?: { message?: string }
      }
      if (!res.ok) throw new Error(json.error?.message || 'post_failed')
      setNotice(
        label(
          `تم الترحيل: ${json.data?.accrualEntryNumber} → ${json.data?.paymentEntryNumber} · صافي ${json.data?.totalNet} د.ك`,
          `Posted: ${json.data?.accrualEntryNumber} → ${json.data?.paymentEntryNumber} · net ${json.data?.totalNet} KWD`,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-4 space-y-2 rounded-2xl border border-white/10 bg-[#11161f] p-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void download()}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          {label('🏦 تصدير ملف تحويل الرواتب للبنك (NBK WPS)', '🏦 Export NBK WPS / Bank Payroll file')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void postJournal()}
          className="rounded-xl border border-emerald-600 bg-emerald-950/20 px-4 py-2 text-sm font-bold text-emerald-300 disabled:opacity-60"
        >
          {label('اعتماد وترحيل قيد الرواتب الشهري للمحاسبة', 'Approve & post monthly payroll journal')}
        </button>
      </div>
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
