'use client'

import { useState, type FormEvent } from 'react'
import { Lock, ShieldCheck } from 'lucide-react'
import { LanguageSwitch, useI18n } from '@/lib/i18n'

type LoginFormProps = {
  nextPath?: string
}

type LoginApiResponse = {
  ok?: boolean
  redirectTo?: string
  errorAr?: string
  errorEn?: string
}

export function LoginForm({ nextPath = '/erp' }: LoginFormProps) {
  const { t, locale, companyName } = useI18n()
  const isAr = locale === 'ar'
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<{ ar: string; en: string } | null>(
    null,
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')

    let next = nextPath || '/erp'
    if (typeof window !== 'undefined') {
      const fromQuery = new URLSearchParams(window.location.search).get('next')
      if (fromQuery && fromQuery.startsWith('/') && !fromQuery.startsWith('//')) {
        next = fromQuery
      }
    }

    setSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, next }),
      })

      const data = (await res.json().catch(() => ({}))) as LoginApiResponse

      if (!res.ok || !data.ok) {
        setErrorMsg({
          ar:
            data.errorAr ||
            'بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.',
          en:
            data.errorEn ||
            'Invalid credentials. Please check your email and password.',
        })
        setSubmitting(false)
        return
      }

      window.location.assign(data.redirectTo || '/erp')
    } catch {
      setErrorMsg({
        ar: 'تعذر الاتصال بالخادم حالياً. يرجى المحاولة مرة أخرى.',
        en: 'Unable to reach the authentication server. Please try again.',
      })
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md min-w-0 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8 dark:border-white/[0.08] dark:bg-[#0F1720]">
      {/* Mobile-only Venture Foods header & official scope */}
      <div className="mb-5 border-b border-slate-200/80 pb-4 lg:hidden dark:border-white/[0.08]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold tracking-wide text-emerald-700 dark:text-emerald-400">
            Aether BI Enterprise
          </span>
          <LanguageSwitch />
        </div>
        <p className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100">
          {companyName}
        </p>
        <p className="mt-1 text-xs font-medium tabular-nums text-slate-600 dark:text-slate-400">
          {isAr
            ? '6 مطاعم • 7 فروع • 8 قنوات'
            : '6 Brands • 7 Branches • 8 Channels'}
        </p>
      </div>

      {/* Desktop card header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {isAr ? 'وصول تنفيذي محمي' : 'Protected Executive Access'}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50">
            {t('login.title')}
          </h2>
        </div>
        <div className="hidden shrink-0 lg:block">
          <LanguageSwitch />
        </div>
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {t('login.lead')}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate={false}>
        {errorMsg ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-800 dark:border-red-500/30 dark:bg-red-950/60 dark:text-red-200"
          >
            {isAr ? errorMsg.ar : errorMsg.en}
          </div>
        ) : null}

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            {t('login.email')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            placeholder="name@venturefoodskw.com"
            dir="ltr"
            disabled={submitting}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-left text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 disabled:opacity-60 dark:border-white/15 dark:bg-[#090F15] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            {t('login.password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            dir="ltr"
            disabled={submitting}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-left text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 disabled:opacity-60 dark:border-white/15 dark:bg-[#090F15] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
        >
          <span>{submitting ? t('login.submitting') : t('login.submit')}</span>
        </button>
      </form>

      <div className="mt-6 flex items-center gap-2 border-t border-slate-200/80 pt-4 text-xs text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
        <ShieldCheck
          className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        />
        <span>{t('login.securityNote')}</span>
      </div>
    </div>
  )
}
