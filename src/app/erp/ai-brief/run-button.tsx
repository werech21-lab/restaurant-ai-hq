'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function kuwaitClock(iso: string): string {
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuwait',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(parsed)
}

export function RunBriefButton({ retryAt }: { retryAt: string | null }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const cooling = retryAt != null && Date.parse(retryAt) > Date.now()

  async function run() {
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch('/api/erp/ai-brief/run', { method: 'POST' })
      if (response.status === 401) {
        setMessage('يرجى تسجيل الدخول.')
        return
      }
      if (response.status === 403) {
        setMessage('التشغيل اليدوي للمديرين التنفيذيين فقط.')
        return
      }
      if (response.status === 429) {
        setMessage('التشغيل اليدوي متاح مرة كل عشر دقائق.')
        return
      }
      if (!response.ok) {
        setMessage('تعذّر تشغيل التحليل.')
        return
      }
      const body = (await response.json()) as { status?: string }
      if (body.status === 'not_configured') setMessage('غير مُهيأ. مفاتيح المزودات غير موجودة.')
      else if (body.status === 'no_odoo_data') setMessage('Odoo غير مرتبط. لم يُستدعَ أي نموذج.')
      else setMessage('اكتمل التشغيل. لم يُطبَّق أي تغيير.')
      router.refresh()
    } catch {
      setMessage('تعذّر تشغيل التحليل.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={pending || cooling}
        aria-busy={pending}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending ? 'جارٍ التشغيل' : 'تشغيل التحليل الآن'}
      </button>
      {cooling && retryAt ? (
        <p className="text-sm text-slate-700">
          التشغيل اليدوي متاح عند <span dir="ltr">{kuwaitClock(retryAt)}</span> بتوقيت الكويت.
        </p>
      ) : null}
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </div>
  )
}
