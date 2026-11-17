'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FormatLocale } from '@/lib/format'

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

export function RunBriefButton({
  retryAt,
  locale = 'ar',
}: {
  retryAt: string | null
  locale?: FormatLocale
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const isAr = locale !== 'en'
  const cooling = retryAt != null && Date.parse(retryAt) > Date.now()

  async function run() {
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch('/api/erp/ai-brief/run', { method: 'POST' })
      if (response.status === 401) {
        setMessage(isAr ? 'يرجى تسجيل الدخول.' : 'Please sign in.')
        return
      }
      if (response.status === 403) {
        setMessage(isAr ? 'التشغيل اليدوي للمديرين التنفيذيين فقط.' : 'Manual run is restricted to executives.')
        return
      }
      if (response.status === 429) {
        setMessage(isAr ? 'التشغيل اليدوي متاح مرة كل عشر دقائق.' : 'Manual run is available once every 10 minutes.')
        return
      }
      if (!response.ok) {
        setMessage(isAr ? 'تعذّر تشغيل التحليل.' : 'Unable to run analysis right now.')
        return
      }
      const body = (await response.json()) as { status?: string }
      if (body.status === 'not_configured') {
        setMessage(isAr ? 'غير مُهيأ. مفاتيح المزودات غير موجودة.' : 'Not configured. Provider keys are missing.')
      } else if (body.status === 'no_odoo_data') {
        setMessage(isAr ? 'Odoo غير مرتبط. لم يُستدعَ أي نموذج.' : 'Odoo is not linked. No model was called.')
      } else {
        setMessage(isAr ? 'اكتمل التشغيل. لم يُطبَّق أي تغيير.' : 'Run completed. No changes were applied.')
      }
      router.refresh()
    } catch {
      setMessage(isAr ? 'تعذّر تشغيل التحليل.' : 'Unable to run analysis right now.')
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
        className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
      >
        {pending
          ? isAr
            ? 'جارٍ التشغيل…'
            : 'Running…'
          : isAr
            ? 'تشغيل التحليل الآن'
            : 'Run Analysis Now'}
      </button>
      {cooling && retryAt ? (
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {isAr ? (
            <>
              التشغيل اليدوي متاح عند{' '}
              <span dir="ltr" className="font-mono tabular-nums">
                {kuwaitClock(retryAt)}
              </span>{' '}
              بتوقيت الكويت.
            </>
          ) : (
            <>
              Next manual run at{' '}
              <span dir="ltr" className="font-mono tabular-nums">
                {kuwaitClock(retryAt)}
              </span>{' '}
              Asia/Kuwait.
            </>
          )}
        </p>
      ) : null}
      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-slate-700 dark:text-slate-300">
          {message}
        </p>
      ) : null}
    </div>
  )
}
